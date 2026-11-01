/**
 * molecule3d.js —— 模块 D：3D 分子可视化
 * ------------------------------------------------------------------
 * 实现方式：使用原生 Canvas 2D 手写一个轻量 3D 渲染器（不依赖 Three.js，
 * 因此离线、双击打开都能运行）：
 *   1. 原子坐标绕 X / Y 轴旋转，再做一个简单的透视投影
 *   2. 化学键按屏幕空间绘制，支持单键 / 双键 / 三键 / 离子键虚线 / 芳香键
 *   3. 原子使用 CPK 配色 + 径向渐变模拟球体，按深度排序实现前后遮挡
 *   4. 支持拖拽旋转、滚轮缩放、双击复位、自动旋转、悬停提示、下载图片
 * 若输入的物质不在内置数据库中，会用简化的 VSEPR 规则推测几何构型，
 * 并给出“教学级推测”的说明与示意图，满足 PRD 中“未知输入有友好提示”的要求。
 */
(function (global) {
  'use strict';

  var CL = global.CL = global.CL || {};
  var U = CL.utils;

  // 元素默认参数（数据文件会覆盖）
  var DEFAULT_ELEMENT = { name: '未知元素', color: '#9aa4b2', radius: 0.55 };

  // 3D 视图状态
  var state = {
    mol: null,
    isEstimate: false,
    query: '',
    rotX: -0.22,
    rotY: 0.55,
    zoom: 1,
    autoRotate: true,
    showLabels: true,
    canvas: null,
    ctx: null,
    wrap: null,
    dpr: 1,
    width: 0,
    height: 0,
    scale: 100,
    radius: 1,
    center: { x: 0, y: 0, z: 0 },
    dragging: false,
    lastX: 0,
    lastY: 0,
    hovered: -1,
    raf: 0
  };

  /* ============================ 元素与化学式工具 ============================ */

  /** 读取元素信息 */
  function elementInfo(element) {
    var table = CL.data.elements ? CL.data.elements() : {};
    return table[element] || DEFAULT_ELEMENT;
  }

  /** 解析化学式，返回元素计数（支持括号与常见水合物点号） */
  function parseFormula(formula) {
    var text = String(formula || '')
      .replace(/[₀-₉]/g, function (ch) { return '₀₁₂₃₄₅₆₇₈₉'.indexOf(ch); })
      .replace(/[（]/g, '(').replace(/[）]/g, ')')
      .replace(/\s+/g, '');
    if (!text) return null;

    var stack = [{}];
    var i = 0;

    while (i < text.length) {
      var ch = text.charAt(i);

      if (ch === '(') {
        stack.push({});
        i += 1;
        continue;
      }

      if (ch === ')') {
        var group = stack.pop();
        i += 1;
        var multiplier = '';
        while (i < text.length && /[0-9]/.test(text.charAt(i))) {
          multiplier += text.charAt(i);
          i += 1;
        }
        var factor = multiplier ? parseInt(multiplier, 10) : 1;
        Object.keys(group).forEach(function (key) {
          stack[stack.length - 1][key] = (stack[stack.length - 1][key] || 0) + group[key] * factor;
        });
        continue;
      }

      if (ch === '·' || ch === '*') {
        stack.push({});
        i += 1;
        continue;
      }

      if (/[A-Z]/.test(ch)) {
        var element = ch;
        if (/[a-z]/.test(text.charAt(i + 1))) {
          element += text.charAt(i + 1);
          i += 1;
        }
        i += 1;
        var number = '';
        while (i < text.length && /[0-9]/.test(text.charAt(i))) {
          number += text.charAt(i);
          i += 1;
        }
        var count = number ? parseInt(number, 10) : 1;
        var target = stack[stack.length - 1];
        target[element] = (target[element] || 0) + count;
        continue;
      }

      i += 1;
    }

    // 合并所有部分（处理水合物）
    var merged = {};
    stack.forEach(function (part) {
      Object.keys(part).forEach(function (key) {
        merged[key] = (merged[key] || 0) + part[key];
      });
    });

    return Object.keys(merged).length ? merged : null;
  }

  /** 估算中心原子：优先取第 1 个非 H 且只出现一次的元素 */
  function pickCentral(counts) {
    var keys = Object.keys(counts).filter(function (key) { return key !== 'H'; });
    if (!keys.length) return null;

    var metals = ['Li', 'Na', 'K', 'Mg', 'Ca', 'Al', 'Fe', 'Cu', 'Zn', 'Ag'];
    for (var i = 0; i < keys.length; i++) {
      if (counts[keys[i]] === 1 && ['F', 'Cl', 'Br', 'I'].indexOf(keys[i]) < 0) return keys[i];
    }
    for (var j = 0; j < keys.length; j++) {
      if (metals.indexOf(keys[j]) >= 0) return keys[j];
    }
    return keys[0];
  }

  /** 价电子数表（主族元素） */
  var VALENCE = {
    H: 1, B: 3, C: 4, N: 5, O: 6, F: 7,
    Si: 4, P: 5, S: 6, Cl: 7, Br: 7, I: 7,
    Xe: 8, Kr: 8, Se: 6, As: 5, Te: 6
  };

  /** 按电子域数与孤对电子数返回几何构型名称 */
  function geometryName(domains, lonePairs) {
    var table = {
      2: { 0: '直线形' },
      3: { 0: '平面三角形', 1: '角形（V 形）' },
      4: { 0: '正四面体形', 1: '三角锥形', 2: '角形（V 形）' },
      5: { 0: '三角双锥形', 1: '跷跷板形', 2: 'T 形', 3: '直线形' },
      6: { 0: '正八面体形', 1: '四方锥形', 2: '平面正方形' }
    };
    var row = table[domains];
    return (row && row[lonePairs]) || '不规则构型';
  }

  /** 向量归一化 */
  function normalize(v) {
    var length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  }

  /** 各几何构型对应的配体方向 */
  function geometryDirections(domains, lonePairs, ligandCount) {
    var tetra = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(normalize);
    var trigonal = [[1, 0, 0], [-0.5, 0.866, 0], [-0.5, -0.866, 0]];
    var tbp = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-0.5, 0, 0.866], [-0.5, 0, -0.866]];
    var octa = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    var square = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

    if (domains === 2) return [[1, 0, 0], [-1, 0, 0]];
    if (domains === 3) return trigonal.slice(0, ligandCount);
    if (domains === 4) {
      if (lonePairs === 2) {
        return [[0.76, 0.64, 0], [-0.76, 0.64, 0]];
      }
      return tetra.slice(0, ligandCount);
    }
    if (domains === 5) {
      if (lonePairs === 3) return [[0, 1, 0], [0, -1, 0]];
      if (lonePairs === 2) return [tbp[0], tbp[2], tbp[3]];
      if (lonePairs === 1) return [tbp[0], tbp[1], tbp[2], tbp[3]];
      return tbp.slice(0, ligandCount);
    }
    if (domains === 6) {
      if (lonePairs === 2) return square;
      return octa.slice(0, ligandCount);
    }
    return tetra.slice(0, Math.min(ligandCount, 4));
  }

  /**
   * 用简化 VSEPR 规则推测未知分子的几何构型
   * @param {string} formula 化学式
   * @returns {Object|null} 与 molecules.json 中分子结构一致的临时对象
   */
  function estimateGeometry(formula) {
    var counts = parseFormula(formula);
    if (!counts) return null;

    var keys = Object.keys(counts);

    // 单质双原子分子
    if (keys.length === 1 && counts[keys[0]] === 2) {
      return {
        id: 'estimate-' + formula,
        formula: formula,
        names: [formula],
        geometry: '直线形（推测）',
        geometryEn: 'Predicted by VSEPR',
        bondAngle: '180°',
        hybridization: '视元素而定',
        polarity: '非极性分子（推测）',
        imf: '色散力',
        notes: '同种元素组成的双原子分子通常是直线形。该结果由简化规则推测，仅供教学参考。',
        atoms: [
          { element: keys[0], x: -0.6, y: 0, z: 0, label: keys[0] },
          { element: keys[0], x: 0.6, y: 0, z: 0, label: keys[0] }
        ],
        bonds: [{ a: 0, b: 1, order: 1, type: 'covalent' }],
        atomCount: 2,
        bondCount: 1,
        estimate: true
      };
    }

    var central = pickCentral(counts);
    var ligandCount = 0;
    Object.keys(counts).forEach(function (key) {
      if (key !== central) ligandCount += counts[key];
    });
    if (!central || !ligandCount) return null;

    var valence = VALENCE[central] || 4;
    var bonds = [];
    var atoms = [{ element: central, x: 0, y: 0, z: 0, label: central }];
    var ligandElements = [];
    Object.keys(counts).forEach(function (key) {
      if (key === central) return;
      for (var i = 0; i < counts[key]; i++) ligandElements.push(key);
    });

    // 孤对电子估算：先按单键计算，再对 O / S 等多重键做修正
    // 例如 CS2、SO2 中碳/硫与氧、硫之间更倾向形成双键，需要额外扣除电子
    var lonePairs = Math.max(0, Math.round((valence - ligandCount) / 2));
    var multipleLigands = (counts.O || 0) + (counts.S || 0) + (counts.Se || 0);
    if (['C', 'S', 'N', 'P'].indexOf(central) >= 0 &&
        multipleLigands > 0 && ligandCount < valence) {
      var extra = Math.min(multipleLigands, Math.floor(valence / 2));
      lonePairs = Math.max(0, Math.round((valence - ligandCount - extra) / 2));
    }

    var domains = Math.min(6, ligandCount + lonePairs);
    lonePairs = Math.max(0, Math.min(domains - ligandCount, lonePairs));

    var geometry = geometryName(domains, lonePairs);
    var angleMap = {
      '直线形': '180°',
      '平面三角形': '120°',
      '正四面体形': '109.5°',
      '三角锥形': '约 107°',
      '角形（V 形）': '小于 120°（随孤对电子数变化）',
      '三角双锥形': '90° / 120°',
      '跷跷板形': '约 90° / 120°',
      'T 形': '约 90°',
      '四方锥形': '约 90°',
      '平面正方形': '90°',
      '正八面体形': '90°'
    };

    var isPolar = ['角形（V 形）', '三角锥形', '跷跷板形', 'T 形', '四方锥形'].indexOf(geometry) >= 0;
    var hasHydrogenBond = counts.H && ['N', 'O', 'F'].indexOf(central) >= 0;
    var imf = hasHydrogenBond
      ? '氢键 + 偶极-偶极作用力 + 色散力'
      : (isPolar ? '偶极-偶极作用力 + 色散力' : '色散力');

    var dirs = geometryDirections(domains, lonePairs, ligandCount);

    ligandElements.forEach(function (element, i) {
      var dir = dirs[i] || dirs[dirs.length - 1] || [0, 1, 0];
      var length = element === 'H' ? 1.05 : 1.45;
      atoms.push({
        element: element,
        x: dir[0] * length,
        y: dir[1] * length,
        z: dir[2] * length,
        label: element
      });
      bonds.push({ a: 0, b: i + 1, order: 1, type: 'covalent' });
    });

    return {
      id: 'estimate-' + formula,
      formula: formula,
      names: [formula],
      geometry: geometry + '（推测）',
      geometryEn: 'Predicted by VSEPR',
      bondAngle: angleMap[geometry] || '—',
      hybridization: geometry === '直线形' ? 'sp' :
        (['平面三角形', '角形（V 形）'].indexOf(geometry) >= 0 ? 'sp²' : 'sp³ 或更高'),
      polarity: isPolar ? '极性分子（推测）' : '非极性分子（推测）',
      imf: imf,
      notes: '该物质不在内置 3D 数据库中，以上几何构型由简化 VSEPR 规则推测，仅供教学参考，不代表量子化学计算结果。',
      atoms: atoms,
      bonds: bonds,
      atomCount: atoms.length,
      bondCount: bonds.length,
      estimate: true,
      lonePairs: lonePairs,
      domains: domains
    };
  }

  /* ============================ 页面模板 ============================ */

  var HOT_MOLECULES = [
    { label: '水', query: 'H2O' },
    { label: '甲烷', query: 'CH4' },
    { label: '二氧化碳', query: 'CO2' },
    { label: '氨气', query: 'NH3' },
    { label: '苯', query: 'C6H6' },
    { label: '食盐', query: 'NaCl' },
    { label: '乙烯', query: 'C2H4' },
    { label: '乙醇', query: 'C2H5OH' },
    { label: '四氟化氙', query: 'XeF4' },
    { label: '铵根', query: 'NH4+' }
  ];

  /** 渲染 3D 分子页面 */
  function render(params) {
    var root = U.$('#view-root');
    var stats = CL.data.stats();

    root.innerHTML =
      '<section class="page page--molecule">' +
      '<header class="page-head">' +
      '<div class="page-head__text">' +
      '<h1 class="page-title">3D 分子可视化</h1>' +
      '<p class="page-subtitle">输入化学式或生活中常见的物质名称，生成可旋转、可缩放的 3D 结构。内置 ' +
      stats.molecules + ' 个分子模型与 ' + stats.names + ' 条名称映射。</p>' +
      '</div>' +
      '<div class="page-head__extra"><span class="chip chip--soft">常驻功能 · 无需后端</span></div>' +
      '</header>' +

      '<form class="molecule-search" id="molecule-form" autocomplete="off">' +
      '<div class="molecule-search__field">' +
      '<span class="molecule-search__icon" aria-hidden="true">🧬</span>' +
      '<input id="molecule-input" type="text" placeholder="输入化学式或名称，例如 H2O、甲烷、食盐、苯…" aria-label="输入化学式或物质名称">' +
      '</div>' +
      '<button class="btn btn--primary" type="submit">生成 3D</button>' +
      '</form>' +

      '<div class="suggest-row" id="molecule-suggest">' +
      '<span class="suggest-row__label">热门：</span>' +
      HOT_MOLECULES.map(function (item) {
        return '<button type="button" class="chip chip--btn" data-query="' + item.query + '">' +
          item.label + '</button>';
      }).join('') +
      '</div>' +

      '<div class="molecule-layout">' +
      '<div class="molecule-stage">' +
      '<div class="canvas-wrap" id="canvas-wrap">' +
      '<canvas id="molecule-canvas" aria-label="3D 分子结构图"></canvas>' +
      '<div class="canvas-badge" id="canvas-badge"></div>' +
      '<div class="atom-tooltip" id="atom-tooltip" hidden></div>' +
      '<div class="canvas-controls">' +
      '<button type="button" class="icon-btn" data-action="toggle-rotate" title="自动旋转" aria-label="自动旋转">⟳</button>' +
      '<button type="button" class="icon-btn" data-action="toggle-labels" title="显示/隐藏元素符号" aria-label="显示或隐藏元素符号">A</button>' +
      '<button type="button" class="icon-btn" data-action="zoom-in" title="放大" aria-label="放大">+</button>' +
      '<button type="button" class="icon-btn" data-action="zoom-out" title="缩小" aria-label="缩小">−</button>' +
      '<button type="button" class="icon-btn" data-action="reset" title="重置视角" aria-label="重置视角">⤾</button>' +
      '<button type="button" class="icon-btn" data-action="download" title="保存图片" aria-label="保存图片">⭳</button>' +
      '</div>' +
      '<div class="canvas-hint">拖拽旋转 · 滚轮缩放 · 双击复位</div>' +
      '</div>' +
      '<div class="molecule-notice" id="molecule-notice" hidden></div>' +
      '<div class="legend" id="molecule-legend" aria-label="元素图例"></div>' +
      '</div>' +
      '<aside class="molecule-panel" id="molecule-panel"></aside>' +
      '</div>' +
      '</section>';

    state.canvas = U.$('#molecule-canvas');
    state.ctx = state.canvas.getContext('2d');
    state.wrap = U.$('#canvas-wrap');

    bindUI();

    var initial = (params && params.query) ? decodeURIComponent(params.query) : 'H2O';
    var input = U.$('#molecule-input');
    if (input) input.value = initial;
    show(initial, true);
    startLoop();
    CL.router.setTitle('3D 分子');
  }

  /** 绑定页面交互 */
  function bindUI() {
    var form = U.$('#molecule-form');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var input = U.$('#molecule-input');
        show(input ? input.value : '');
      });
    }

    var suggest = U.$('#molecule-suggest');
    if (suggest) {
      U.delegate(suggest, 'click', '[data-query]', function (event, button) {
        var query = button.getAttribute('data-query');
        var input = U.$('#molecule-input');
        if (input) input.value = query;
        show(query);
      });
    }

    var controls = U.$('.canvas-controls');
    if (controls) {
      U.delegate(controls, 'click', '[data-action]', function (event, button) {
        var action = button.getAttribute('data-action');
        if (action === 'toggle-rotate') {
          state.autoRotate = !state.autoRotate;
          button.classList.toggle('is-active', state.autoRotate);
          U.toast(state.autoRotate ? '已开启自动旋转' : '已暂停自动旋转', 'info', 1400);
        } else if (action === 'toggle-labels') {
          state.showLabels = !state.showLabels;
          button.classList.toggle('is-active', state.showLabels);
        } else if (action === 'zoom-in') {
          state.zoom = U.clamp(state.zoom * 1.18, 0.45, 3.6);
        } else if (action === 'zoom-out') {
          state.zoom = U.clamp(state.zoom / 1.18, 0.45, 3.6);
        } else if (action === 'reset') {
          resetView();
        } else if (action === 'download') {
          downloadImage();
        }
      });
    }

    // 初始按钮状态
    var rotateBtn = U.$('[data-action="toggle-rotate"]');
    if (rotateBtn) rotateBtn.classList.toggle('is-active', state.autoRotate);
    var labelBtn = U.$('[data-action="toggle-labels"]');
    if (labelBtn) labelBtn.classList.toggle('is-active', state.showLabels);

    bindCanvasEvents();
    global.addEventListener('resize', U.throttle(resizeCanvas, 150));
  }

  /** 绑定画布事件：拖拽旋转、滚轮缩放、悬停提示 */
  function bindCanvasEvents() {
    var canvas = state.canvas;
    if (!canvas) return;

    canvas.addEventListener('pointerdown', function (event) {
      state.dragging = true;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-grabbing');
    });

    canvas.addEventListener('pointermove', function (event) {
      if (state.dragging) {
        var dx = event.clientX - state.lastX;
        var dy = event.clientY - state.lastY;
        state.lastX = event.clientX;
        state.lastY = event.clientY;
        state.rotY += dx * 0.01;
        state.rotX = U.clamp(state.rotX + dy * 0.01, -1.45, 1.45);
        hideTooltip();
      } else {
        updateHover(event);
      }
    });

    function endDrag() {
      state.dragging = false;
      canvas.classList.remove('is-grabbing');
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', function () {
      endDrag();
      hideTooltip();
      state.hovered = -1;
    });

    canvas.addEventListener('wheel', function (event) {
      event.preventDefault();
      var factor = Math.exp(-event.deltaY * 0.0012);
      state.zoom = U.clamp(state.zoom * factor, 0.45, 3.6);
    }, { passive: false });

    canvas.addEventListener('dblclick', resetView);
  }

  /* ============================ 数据加载与信息面板 ============================ */

  /**
   * 解析输入并切换分子
   * @param {string} query 化学式或名称
   * @param {boolean} [silent] 是否静默（不弹提示）
   */
  function show(query, silent) {
    var raw = String(query || '').trim();
    if (!raw) {
      if (!silent) U.toast('请输入化学式或物质名称', 'warn');
      return;
    }

    var molecule = CL.data.resolveMolecule(raw);
    var estimate = false;

    if (!molecule) {
      molecule = estimateGeometry(raw);
      estimate = true;
    }

    if (!molecule) {
      showNotice('error',
        '暂时无法识别“' + raw + '”',
        '请尝试输入常见化学式（如 H2O、CO2、C6H6）或物质名称（如水、甲烷、食盐）。' +
        '也支持 H2SO4、Ca(OH)2 这类化学式的 VSEPR 推测。');
      if (!silent) U.toast('无法识别该输入，请查看下方提示', 'error');
      return;
    }

    state.mol = molecule;
    state.isEstimate = estimate || !!molecule.estimate;
    state.query = raw;
    state.rotX = -0.22;
    state.rotY = 0.55;
    state.zoom = 1;
    state.hovered = -1;

    computeGeometry();
    resizeCanvas();
    hideTooltip();
    renderPanel(molecule, state.isEstimate);
    renderLegend(molecule);
    renderNotice(molecule, state.isEstimate, raw);
    updateBadge();

    // 立即绘制一帧：避免 requestAnimationFrame 被浏览器延后时出现空白画布
    draw();

    if (!silent) {
      U.toast(estimate ? '未内置该分子，已用 VSEPR 规则生成示意结构' : '已生成 ' + molecule.formula + ' 的 3D 结构',
        estimate ? 'warn' : 'success');
    }

    // 同步 URL（replaceState 不触发 hashchange，避免重复渲染）
    try {
      global.history.replaceState(null, '', '#/molecule/' + encodeURIComponent(raw));
    } catch (error) {
      // 某些浏览器在 file:// 下可能限制 replaceState，忽略即可
    }
  }

  /** 计算模型中心与半径，用于自动适配画布 */
  function computeGeometry() {
    var molecule = state.mol;
    if (!molecule || !molecule.atoms || !molecule.atoms.length) return;

    var minX = Infinity, minY = Infinity, minZ = Infinity;
    var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    var maxRadius = 0.5;

    molecule.atoms.forEach(function (atom) {
      minX = Math.min(minX, atom.x);
      maxX = Math.max(maxX, atom.x);
      minY = Math.min(minY, atom.y);
      maxY = Math.max(maxY, atom.y);
      minZ = Math.min(minZ, atom.z);
      maxZ = Math.max(maxZ, atom.z);
      maxRadius = Math.max(maxRadius, elementInfo(atom.element).radius || 0.5);
    });

    state.center = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    };

    var radius = 0;
    molecule.atoms.forEach(function (atom) {
      var dx = atom.x - state.center.x;
      var dy = atom.y - state.center.y;
      var dz = atom.z - state.center.z;
      radius = Math.max(radius, Math.sqrt(dx * dx + dy * dy + dz * dz));
    });

    state.radius = Math.max(radius + maxRadius, 1.2);
  }

  /** 信息面板 */
  function renderPanel(molecule, estimate) {
    var panel = U.$('#molecule-panel');
    if (!panel) return;

    var names = (molecule.names || []).slice(0, 3).join(' / ');
    var properties = [
      ['化学式', molecule.formula],
      ['几何构型', molecule.geometry],
      ['键角', molecule.bondAngle || '—'],
      ['杂化方式', molecule.hybridization || '—'],
      ['分子极性', molecule.polarity || '—'],
      ['分子间作用力', molecule.imf || '—']
    ];

    panel.innerHTML =
      '<div class="panel-card">' +
      '<span class="eyebrow">' + (estimate ? 'VSEPR 推测结构' : '内置 3D 模型') + '</span>' +
      '<h2 class="panel-title">' + U.escapeHtml(names || molecule.formula) +
      '<span class="panel-title__formula">' + U.escapeHtml(molecule.formula) + '</span></h2>' +
      '<div class="panel-tags">' +
      '<span class="chip chip--accent">' + U.escapeHtml(molecule.geometry) + '</span>' +
      '<span class="chip">' + U.escapeHtml(molecule.polarity || '') + '</span>' +
      '</div>' +
      '<dl class="property-list">' +
      properties.map(function (row) {
        return '<div class="property-row"><dt>' + row[0] + '</dt><dd>' +
          U.escapeHtml(row[1]) + '</dd></div>';
      }).join('') +
      '</dl>' +
      '<div class="panel-stats">' +
      '<div><strong>' + (molecule.atomCount || (molecule.atoms || []).length) + '</strong><span>原子</span></div>' +
      '<div><strong>' + (molecule.bondCount || (molecule.bonds || []).length) + '</strong><span>化学键</span></div>' +
      '</div>' +
      '<p class="panel-note">' + U.escapeHtml(molecule.notes || '拖拽可以旋转分子，滚轮可以缩放。') + '</p>' +
      (estimate ?
        '<div class="panel-warn">此结构由简化 VSEPR 规则推测，仅用于教学理解，实际键长键角请以实验数据为准。</div>' : '') +
      '<div class="panel-links">' +
      '<a class="btn btn--ghost btn--sm" href="#/chapters">去学习相关章节</a>' +
      '<a class="btn btn--ghost btn--sm" href="#/tools/identify">用工具分析物质</a>' +
      '</div>' +
      '</div>';
  }

  /** 元素图例 */
  function renderLegend(molecule) {
    var legend = U.$('#molecule-legend');
    if (!legend) return;

    var seen = {};
    (molecule.atoms || []).forEach(function (atom) {
      seen[atom.element] = true;
    });

    legend.innerHTML = Object.keys(seen).map(function (element) {
      var info = elementInfo(element);
      return '<span class="legend__item">' +
        '<i class="legend__dot" style="background:' + info.color + '"></i>' +
        element + ' · ' + U.escapeHtml(info.name) +
        '</span>';
    }).join('') +
      '<span class="legend__item legend__item--hint">坐标为教学级近似值</span>';
  }

  /** 画布角标 */
  function updateBadge() {
    var badge = U.$('#canvas-badge');
    if (!badge || !state.mol) return;
    badge.textContent = state.mol.formula + (state.isEstimate ? ' · VSEPR 推测' : ' · 内置模型');
  }

  /** 显示提示条 */
  function showNotice(type, title, text) {
    var notice = U.$('#molecule-notice');
    if (!notice) return;
    notice.hidden = false;
    notice.className = 'molecule-notice molecule-notice--' + type;
    notice.innerHTML = '<strong>' + U.escapeHtml(title) + '</strong><p>' + U.escapeHtml(text) + '</p>';
  }

  /** 根据是否推测显示说明 */
  function renderNotice(molecule, estimate, raw) {
    if (estimate) {
      var detail = '推测过程：由化学式解析出中心原子与配体数目，再按价电子对互斥理论估算孤对电子数，' +
        '得到电子域数 ' + (molecule.domains || '—') + '、孤对电子 ' +
        (molecule.lonePairs === undefined ? '—' : molecule.lonePairs) +
        ' 对，因此判断为 ' + molecule.geometry + '。';
      showNotice('warn', '“' + raw + '”不在内置数据库中，已按 VSEPR 规则推测', detail);
    } else {
      showNotice('info', '已加载内置 3D 模型',
        '该模型的原子坐标按理想几何构型与标准键长生成（教学级精度）。拖拽旋转、滚轮缩放，悬停原子可查看元素信息。');
    }
  }

  /* ============================ 画布尺寸与视角 ============================ */

  /** 根据容器大小与设备像素比调整画布 */
  function resizeCanvas() {
    if (!state.canvas || !state.wrap) return;

    var rect = state.wrap.getBoundingClientRect();
    var width = Math.max(320, rect.width);
    var height = Math.max(320, rect.height || 480);
    var dpr = global.devicePixelRatio || 1;

    state.width = width;
    state.height = height;
    state.dpr = dpr;
    state.canvas.width = Math.round(width * dpr);
    state.canvas.height = Math.round(height * dpr);
    state.canvas.style.width = width + 'px';
    state.canvas.style.height = height + 'px';

    var ctx = state.ctx;
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    state.scale = Math.min(width, height) / (2.35 * state.radius);
  }

  /** 重置视角 */
  function resetView() {
    state.rotX = -0.22;
    state.rotY = 0.55;
    state.zoom = 1;
    U.toast('视角已重置', 'info', 1200);
  }

  /** 保存当前画面为 PNG */
  function downloadImage() {
    if (!state.canvas || !state.mol) return;
    try {
      var link = document.createElement('a');
      link.href = state.canvas.toDataURL('image/png');
      link.download = 'chemlearn-' + state.mol.formula + '.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      U.toast('图片已保存', 'success');
    } catch (error) {
      console.warn('[molecule] 导出图片失败：', error);
      U.toast('当前浏览器不支持导出画布图片', 'error');
    }
  }

  /* ============================ 3D 投影 ============================ */

  /**
   * 将原子坐标投影到屏幕
   * @param {Object} atom 原子
   * @returns {{x:number,y:number,z:number,radius:number}}
   */
  function project(atom) {
    var x = atom.x - state.center.x;
    var y = atom.y - state.center.y;
    var z = atom.z - state.center.z;

    // 绕 Y 轴旋转
    var cosY = Math.cos(state.rotY);
    var sinY = Math.sin(state.rotY);
    var x1 = x * cosY + z * sinY;
    var z1 = -x * sinY + z * cosY;

    // 绕 X 轴旋转
    var cosX = Math.cos(state.rotX);
    var sinX = Math.sin(state.rotX);
    var y1 = y * cosX - z1 * sinX;
    var z2 = y * sinX + z1 * cosX;

    // 透视投影：相机距离取 9 个分子单位
    var distance = 9;
    var perspective = distance / Math.max(0.9, distance + z2);

    var scale = state.scale * state.zoom * perspective;
    var radius = (elementInfo(atom.element).radius || 0.5) * scale * 0.95;

    return {
      x: state.width / 2 + x1 * scale,
      y: state.height / 2 - y1 * scale,
      z: z2,
      radius: Math.max(3.5, radius)
    };
  }

  /* ============================ 颜色工具 ============================ */

  function hexToRgb(hex) {
    var value = String(hex || '#888888').replace('#', '');
    if (value.length === 3) {
      value = value.split('').map(function (ch) { return ch + ch; }).join('');
    }
    var number = parseInt(value, 16);
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255
    };
  }

  function mixColor(hex, target, ratio) {
    var rgb = hexToRgb(hex);
    return 'rgb(' +
      Math.round(rgb.r + (target - rgb.r) * ratio) + ',' +
      Math.round(rgb.g + (target - rgb.g) * ratio) + ',' +
      Math.round(rgb.b + (target - rgb.b) * ratio) + ')';
  }

  function isLightColor(hex) {
    var rgb = hexToRgb(hex);
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 160;
  }

  /* ============================ 绘制 ============================ */

  /** 绘制背景（中心略亮的径向渐变，营造空间感） */
  function drawBackground(ctx) {
    var gradient = ctx.createRadialGradient(
      state.width / 2, state.height / 2, 20,
      state.width / 2, state.height / 2, Math.max(state.width, state.height) * 0.72
    );
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.55, 'rgba(241,245,249,0.9)');
    gradient.addColorStop(1, 'rgba(226,232,240,0.75)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  /** 绘制一条屏幕空间的线段 */
  function drawLine(ctx, x1, y1, x2, y2, color, width, dashed) {
    ctx.beginPath();
    ctx.setLineDash(dashed ? [6, 5] : []);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * 绘制化学键
   * @param {Object} bond 透视后的键信息
   */
  function drawBond(ctx, bond) {
    var a = bond.a;
    var b = bond.b;
    var colorA = elementInfo(bond.atomA.element).color;
    var colorB = elementInfo(bond.atomB.element).color;

    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / length;
    var uy = dy / length;
    var nx = -uy;
    var ny = ux;

    // 两端缩短，避免线头从球心穿出
    var startX = a.x + ux * a.radius * 0.72;
    var startY = a.y + uy * a.radius * 0.72;
    var endX = b.x - ux * b.radius * 0.72;
    var endY = b.y - uy * b.radius * 0.72;
    var midX = (startX + endX) / 2;
    var midY = (startY + endY) / 2;

    var baseWidth = Math.max(2, Math.min(9, state.scale * state.zoom * 0.055));
    var order = bond.order || 1;
    var offsets = [0];

    if (bond.type === 'aromatic') {
      offsets = [0, 3.2];
    } else if (order >= 3) {
      offsets = [-3.4, 0, 3.4];
    } else if (order === 2) {
      offsets = [-2.4, 2.4];
    }

    offsets.forEach(function (offset, index) {
      var ox = nx * offset;
      var oy = ny * offset;

      if (bond.type === 'ionic') {
        drawLine(ctx, startX + ox, startY + oy, endX + ox, endY + oy,
          'rgba(100,116,139,0.85)', 2, true);
        return;
      }

      if (bond.type === 'aromatic' && index === 1) {
        drawLine(ctx, startX + ox, startY + oy, endX + ox, endY + oy,
          mixColor(colorA, 0, 0.2), Math.max(1.5, baseWidth * 0.42), true);
        return;
      }

      var width = order >= 2 ? baseWidth * 0.55 : baseWidth;
      // 左半段用 A 的颜色，右半段用 B 的颜色，体现成键双方
      drawLine(ctx, startX + ox, startY + oy, midX + ox, midY + oy,
        mixColor(colorA, 30, 0.25), width, false);
      drawLine(ctx, midX + ox, midY + oy, endX + ox, endY + oy,
        mixColor(colorB, 30, 0.25), width, false);
    });
  }

  /** 绘制单个原子 */
  function drawAtom(ctx, item) {
    var atom = item.atom;
    var point = item.point;
    var info = elementInfo(atom.element);
    var radius = point.radius;
    var hovered = state.hovered === item.index;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
    ctx.shadowBlur = Math.max(4, radius * 0.35);
    ctx.shadowOffsetY = Math.max(1, radius * 0.12);

    var gradient = ctx.createRadialGradient(
      point.x - radius * 0.36,
      point.y - radius * 0.4,
      radius * 0.08,
      point.x,
      point.y,
      radius
    );
    gradient.addColorStop(0, mixColor(info.color, 255, 0.72));
    gradient.addColorStop(0.55, info.color);
    gradient.addColorStop(1, mixColor(info.color, 0, 0.42));

    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.lineWidth = hovered ? 2.5 : 1;
    ctx.strokeStyle = hovered ? '#2563eb' : 'rgba(15, 23, 42, 0.28)';
    ctx.stroke();

    if (state.showLabels && radius > 8) {
      var label = atom.label || atom.element;
      ctx.fillStyle = isLightColor(info.color) ? '#0f172a' : '#ffffff';
      ctx.font = '600 ' + Math.max(9, Math.min(15, radius * 0.95)) +
        'px system-ui, -apple-system, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, point.x, point.y + 0.5);
    }

    ctx.restore();
  }

  /** 绘制一帧 */
  function draw() {
    var ctx = state.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, state.width, state.height);
    drawBackground(ctx);

    if (!state.mol) return;

    var atoms = state.mol.atoms || [];
    var bonds = state.mol.bonds || [];
    var projected = atoms.map(function (atom, index) {
      return { atom: atom, index: index, point: project(atom) };
    });

    // 化学键按平均深度排序（远的先画）
    var bondList = bonds.map(function (bond) {
      var a = projected[bond.a];
      var b = projected[bond.b];
      if (!a || !b) return null;
      return {
        a: a.point,
        b: b.point,
        atomA: a.atom,
        atomB: b.atom,
        order: bond.order,
        type: bond.type,
        depth: (a.point.z + b.point.z) / 2
      };
    }).filter(Boolean).sort(function (x, y) { return y.depth - x.depth; });

    bondList.forEach(function (bond) {
      drawBond(ctx, bond);
    });

    // 原子按深度排序（远的先画，实现前后遮挡）
    projected.sort(function (x, y) { return y.point.z - x.point.z; });
    projected.forEach(function (item) {
      drawAtom(ctx, item);
    });
  }

  /* ============================ 悬停提示 ============================ */

  /** 找出鼠标下的原子并显示提示 */
  function updateHover(event) {
    if (!state.mol) return;

    var canvas = state.canvas;
    var rect = canvas.getBoundingClientRect();
    var mouseX = event.clientX - rect.left;
    var mouseY = event.clientY - rect.top;

    var bestIndex = -1;
    var bestDepth = Infinity;

    (state.mol.atoms || []).forEach(function (atom, index) {
      var point = project(atom);
      var dx = mouseX - point.x;
      var dy = mouseY - point.y;
      if (Math.sqrt(dx * dx + dy * dy) <= point.radius * 1.05 && point.z < bestDepth) {
        bestIndex = index;
        bestDepth = point.z;
      }
    });

    state.hovered = bestIndex;
    canvas.style.cursor = bestIndex >= 0 ? 'pointer' : 'grab';

    if (bestIndex >= 0) {
      showTooltip(bestIndex, mouseX, mouseY);
    } else {
      hideTooltip();
    }
  }

  /** 显示原子提示框 */
  function showTooltip(index, mouseX, mouseY) {
    var tooltip = U.$('#atom-tooltip');
    if (!tooltip || !state.mol) return;

    var atom = state.mol.atoms[index];
    var info = elementInfo(atom.element);

    tooltip.hidden = false;
    tooltip.innerHTML =
      '<span class="atom-tooltip__dot" style="background:' + info.color + '"></span>' +
      '<strong>' + U.escapeHtml(atom.element) + '</strong> ' + U.escapeHtml(info.name) +
      '<span class="atom-tooltip__coord">(' +
      atom.x.toFixed(2) + ', ' + atom.y.toFixed(2) + ', ' + atom.z.toFixed(2) + ') Å</span>' +
      '<span class="atom-tooltip__coord">原子序号 #' + (index + 1) + '</span>';

    var wrapRect = state.wrap.getBoundingClientRect();
    var left = Math.max(12, Math.min(mouseX + 16, wrapRect.width - 170));
    var top = Math.max(12, mouseY - 20);
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function hideTooltip() {
    var tooltip = U.$('#atom-tooltip');
    if (tooltip) tooltip.hidden = true;
  }

  /* ============================ 动画循环 ============================ */

  /** 启动渲染循环（重复调用会先取消旧循环） */
  function startLoop() {
    if (state.raf) global.cancelAnimationFrame(state.raf);

    function tick() {
      // 离开 3D 页面后停止循环，避免在已移除的画布上持续绘制
      if (!state.canvas || !document.body.contains(state.canvas)) {
        state.raf = 0;
        return;
      }

      if (!document.hidden) {
        if (state.autoRotate && !state.dragging && state.mol) {
          state.rotY += 0.004;
        }
        draw();
      }
      state.raf = global.requestAnimationFrame(tick);
    }

    state.raf = global.requestAnimationFrame(tick);
  }

  CL.molecule = {
    render: render,
    show: show,
    estimate: estimateGeometry,
    parseFormula: parseFormula,
    startLoop: startLoop,
    redraw: draw,
    state: state
  };
})(window);
