/**
 * tools.js —— 模块 E：辅助练习小工具
 * ------------------------------------------------------------------
 * 包含三个工具：
 *   1. 方程式配平助手：解析未配平方程式，用有理数高斯消元求最简整数系数，
 *      并给出分步思路；内置 18 组常见方程式及标准推导。
 *   2. 物质识别小工具：输入名称或化学式，返回类别、键型、极性、
 *      分子间作用力与结构说明。
 *   3. 摩尔质量计算器：支持括号、结晶水与常见元素，展示每种元素的贡献。
 */
(function (global) {
  'use strict';

  var CL = global.CL = global.CL || {};
  var U = CL.utils;

  var TABS = [
    { id: 'balance', label: '方程式配平', icon: '⚖️' },
    { id: 'identify', label: '物质识别', icon: '🔎' },
    { id: 'molar', label: '摩尔质量', icon: '🧮' }
  ];

  var currentTab = 'balance';

  /* ============================ 页面框架 ============================ */

  /** 渲染工具页 */
  function render(params) {
    var root = U.$('#view-root');
    currentTab = (params && params.tab) || 'balance';
    if (['balance', 'identify', 'molar'].indexOf(currentTab) < 0) currentTab = 'balance';

    root.innerHTML =
      '<section class="page page--tools">' +
      '<header class="page-head">' +
      '<div class="page-head__text">' +
      '<h1 class="page-title">辅助工具</h1>' +
      '<p class="page-subtitle">三个轻量小工具，帮助你在练习中快速检查配平、识别物质类别与计算摩尔质量。</p>' +
      '</div>' +
      '<div class="page-head__extra"><span class="chip chip--soft">全部在本地运行</span></div>' +
      '</header>' +
      '<nav class="tabs" role="tablist" aria-label="工具切换">' +
      TABS.map(function (tab) {
        return '<button type="button" class="tabs__btn' + (tab.id === currentTab ? ' is-active' : '') +
          '" role="tab" aria-selected="' + (tab.id === currentTab) + '" data-tab="' + tab.id + '">' +
          '<span aria-hidden="true">' + tab.icon + '</span> ' + tab.label + '</button>';
      }).join('') +
      '</nav>' +
      '<div id="tool-panel" class="tool-panel"></div>' +
      '</section>';

    U.delegate(U.$('.tabs'), 'click', '[data-tab]', function (event, button) {
      var tab = button.getAttribute('data-tab');
      CL.router.navigate('/tools/' + tab);
    });

    if (currentTab === 'identify') renderIdentify();
    else if (currentTab === 'molar') renderMolar();
    else renderBalance();

    CL.router.setTitle('辅助工具');
  }

  /* ============================ 工具一：配平助手 ============================ */

  /** 有理数工具：{n, d}，始终保持最简与正分母 */
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  function frac(n, d) {
    if (d === 0) return { n: 0, d: 1 };
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  function fAdd(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }
  function fSub(a, b) { return frac(a.n * b.d - b.n * a.d, a.d * b.d); }
  function fMul(a, b) { return frac(a.n * b.n, a.d * b.d); }
  function fDiv(a, b) { return frac(a.n * b.d, a.d * b.n); }
  function fZero(a) { return a.n === 0; }

  /**
   * 求齐次线性方程组的零空间向量（自由度必须为 1）
   * @param {Array<Array<number>>} matrix 元素 × 物质 的计数矩阵
   * @param {number} cols 物质数
   */
  function solveNullSpace(matrix, cols) {
    var rows = matrix.length;
    var m = matrix.map(function (row) {
      return row.map(function (value) { return frac(value, 1); });
    });

    var pivotCols = [];
    var r = 0;

    for (var c = 0; c < cols && r < rows; c++) {
      var pivot = -1;
      for (var i = r; i < rows; i++) {
        if (!fZero(m[i][c])) { pivot = i; break; }
      }
      if (pivot < 0) continue;

      var tmp = m[r]; m[r] = m[pivot]; m[pivot] = tmp;

      var pv = m[r][c];
      for (var j = 0; j < cols; j++) m[r][j] = fDiv(m[r][j], pv);

      for (var i2 = 0; i2 < rows; i2++) {
        if (i2 === r || fZero(m[i2][c])) continue;
        var factor = m[i2][c];
        for (var j2 = 0; j2 < cols; j2++) {
          m[i2][j2] = fSub(m[i2][j2], fMul(factor, m[r][j2]));
        }
      }

      pivotCols.push(c);
      r += 1;
    }

    var freeCols = [];
    for (var k = 0; k < cols; k++) {
      if (pivotCols.indexOf(k) < 0) freeCols.push(k);
    }
    if (freeCols.length !== 1) return null;

    var freeCol = freeCols[0];
    var vector = [];
    for (var v = 0; v < cols; v++) vector.push(frac(0, 1));
    vector[freeCol] = frac(1, 1);

    for (var p = 0; p < pivotCols.length; p++) {
      vector[pivotCols[p]] = fSub(frac(0, 1), m[p][freeCol]);
    }

    return vector;
  }

  /** 把有理数向量转成最简正整数系数 */
  function toIntegerCoefficients(vector) {
    var lcm = 1;
    vector.forEach(function (value) {
      lcm = lcm / gcd(lcm, value.d) * value.d;
    });

    var integers = vector.map(function (value) {
      return Math.round(value.n * (lcm / value.d));
    });

    var divisor = integers.reduce(function (acc, value) {
      return gcd(acc, value);
    }, 0) || 1;
    integers = integers.map(function (value) { return value / divisor; });

    var hasNegative = integers.some(function (value) { return value < 0; });
    var hasPositive = integers.some(function (value) { return value > 0; });
    if (!hasPositive) return null;
    if (hasNegative) integers = integers.map(function (value) { return -value; });

    return integers;
  }

  /** 拆分方程式两侧 */
  function parseEquationInput(text) {
    var raw = String(text || '')
      .replace(/[→⟶]/g, '->')
      .replace(/[＝=]/g, '->')
      .replace(/[⇌]/g, '->')
      .replace(/\s+/g, '');

    var parts = raw.split('->');
    if (parts.length !== 2) return null;

    function splitSide(side) {
      return side.split('+').map(function (item) {
        return item
          .replace(/[↑↓]/g, '')
          .replace(/\((s|l|g|aq)\)/gi, '')
          .replace(/^[0-9]+/, '');
      }).filter(Boolean);
    }

    var reactants = splitSide(parts[0]);
    var products = splitSide(parts[1]);
    if (!reactants.length || !products.length) return null;

    return { reactants: reactants, products: products };
  }

  /** 把解析结果变成元素计数矩阵 */
  function buildMatrix(parsed) {
    var species = parsed.reactants.concat(parsed.products);
    var countsList = species.map(function (formula) {
      return CL.molecule.parseFormula(formula);
    });

    if (countsList.some(function (counts) { return !counts; })) return null;

    var elements = [];
    countsList.forEach(function (counts) {
      Object.keys(counts).forEach(function (element) {
        if (elements.indexOf(element) < 0) elements.push(element);
      });
    });

    var matrix = elements.map(function (element) {
      return countsList.map(function (counts, index) {
        var count = counts[element] || 0;
        // 反应物取正、生成物取负，求 A·x = 0
        return index < parsed.reactants.length ? count : -count;
      });
    });

    return { species: species, elements: elements, countsList: countsList, matrix: matrix };
  }

  /** 生成配平结果对象 */
  function balance(text) {
    var parsed = parseEquationInput(text);
    if (!parsed) {
      return { error: '无法解析方程式。请使用“反应物 + 反应物 -> 生成物 + 生成物”的格式，例如：H2 + O2 -> H2O' };
    }

    var built = buildMatrix(parsed);
    if (!built) {
      return { error: '存在无法解析的化学式，请检查大小写与括号是否匹配（例如 Ca(OH)2）。' };
    }

    var vector = solveNullSpace(built.matrix, built.species.length);
    if (!vector) {
      return { error: '无法配平：该方程式可能缺少物质、元素不守恒，或存在多组线性无关解。请检查反应物与生成物。' };
    }

    var coefficients = toIntegerCoefficients(vector);
    if (!coefficients) {
      return { error: '求得的系数不是全正数，请检查方程式是否写错（例如把生成物写到了反应物一侧）。' };
    }

    var before = {};
    var after = {};
    built.elements.forEach(function (element) {
      before[element] = 0;
      after[element] = 0;
    });

    built.countsList.forEach(function (counts, index) {
      Object.keys(counts).forEach(function (element) {
        if (index < parsed.reactants.length) {
          before[element] += counts[element] * coefficients[index];
        } else {
          after[element] += counts[element] * coefficients[index];
        }
      });
    });

    var left = parsed.reactants.map(function (formula, index) {
      return (coefficients[index] === 1 ? '' : coefficients[index]) + formula;
    }).join(' + ');
    var right = parsed.products.map(function (formula, index) {
      return (coefficients[index + parsed.reactants.length] === 1 ? '' :
        coefficients[index + parsed.reactants.length]) + formula;
    }).join(' + ');

    return {
      parsed: parsed,
      species: built.species,
      elements: built.elements,
      coefficients: coefficients,
      before: before,
      after: after,
      equation: left + ' → ' + right,
      library: findLibraryEquation(parsed)
    };
  }

  /** 在内置题库中查找相同方程式 */
  function findLibraryEquation(parsed) {
    var list = CL.data.equations();
    var target = parsed.reactants.slice().sort().join('+') + '>' +
      parsed.products.slice().sort().join('+');

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var reactKey = item.reactants.map(function (r) { return r.formula; }).sort().join('+');
      var prodKey = item.products.map(function (p) { return p.formula; }).sort().join('+');
      if (reactKey + '>' + prodKey === target) return item;
    }
    return null;
  }

  /* ============================ 配平页面 ============================ */

  /** 渲染配平工具 */
  function renderBalance() {
    var panel = U.$('#tool-panel');
    var library = CL.data.equations();

    panel.innerHTML =
      '<div class="tool-card">' +
      '<h2 class="tool-card__title">⚖️ 方程式配平助手</h2>' +
      '<p class="tool-card__desc">输入未配平的化学方程式，工具会用线性代数方法求出最简整数系数，并给出配平步骤与验算表。支持 “->”“→”“=” 三种箭头写法。</p>' +
      '<form class="tool-form" id="balance-form" autocomplete="off">' +
      '<input id="balance-input" class="tool-input" type="text" placeholder="例如：Fe + O2 -> Fe2O3" value="H2 + O2 -> H2O" aria-label="输入未配平方程式">' +
      '<button class="btn btn--primary" type="submit">开始配平</button>' +
      '</form>' +
      '<div class="suggest-row"><span class="suggest-row__label">试试：</span>' +
      ['CH4 + O2 -> CO2 + H2O', 'Fe + O2 -> Fe2O3', 'C3H8 + O2 -> CO2 + H2O', 'NaOH + H2SO4 -> Na2SO4 + H2O'].map(function (text) {
        return '<button type="button" class="chip chip--btn" data-equation="' + U.escapeHtml(text) + '">' +
          U.escapeHtml(text) + '</button>';
      }).join('') +
      '</div>' +
      '<div id="balance-result" class="tool-result" aria-live="polite"></div>' +
      '</div>' +

      '<div class="tool-card tool-card--library">' +
      '<h3 class="tool-card__title">📚 内置例题（' + library.length + ' 组，含分步解析）</h3>' +
      '<div class="equation-list">' +
      library.map(function (item) {
        return '<button type="button" class="equation-item" data-library="' + item.id + '">' +
          '<span class="equation-item__formula">' + U.escapeHtml(item.equation) + '</span>' +
          '<span class="equation-item__meta">' + U.escapeHtml(item.type) + ' · ' + U.escapeHtml(item.difficulty) + '</span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '</div>';

    // 表单提交
    var form = U.$('#balance-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = U.$('#balance-input');
      renderBalanceResult(balance(input.value));
    });

    // 示例按钮
    U.delegate(panel, 'click', '[data-equation]', function (event, button) {
      var text = button.getAttribute('data-equation');
      U.$('#balance-input').value = text;
      renderBalanceResult(balance(text));
    });

    // 内置题库
    U.delegate(panel, 'click', '[data-library]', function (event, button) {
      var id = button.getAttribute('data-library');
      var item = CL.data.equations().filter(function (eq) { return eq.id === id; })[0];
      if (!item) return;
      U.$('#balance-input').value = item.equation;
      var result = balance(item.equation);
      result.library = item;
      renderBalanceResult(result);
    });

    renderBalanceResult(balance('H2 + O2 -> H2O'));
  }

  /** 渲染配平结果 */
  function renderBalanceResult(result) {
    var box = U.$('#balance-result');
    if (!box) return;

    if (!result || result.error) {
      box.innerHTML = '<div class="tool-error">⚠️ ' +
        U.escapeHtml(result ? result.error : '未知错误') + '</div>';
      return;
    }

    var table = '<table class="data-table"><thead><tr><th>元素</th><th>反应物侧</th><th>生成物侧</th><th>是否守恒</th></tr></thead><tbody>' +
      result.elements.map(function (element) {
        var balanced = result.before[element] === result.after[element];
        return '<tr><td>' + element + '</td><td>' + result.before[element] + '</td><td>' +
          result.after[element] + '</td><td>' +
          (balanced ? '<span class="text-success">✓ 守恒</span>' : '<span class="text-danger">✕ 不守恒</span>') +
          '</td></tr>';
      }).join('') +
      '</tbody></table>';

    var coefficientChips = result.species.map(function (formula, index) {
      return '<span class="coef-chip"><strong>' + result.coefficients[index] + '</strong>' +
        U.escapeHtml(formula) + '</span>';
    }).join('');

    var steps;
    if (result.library && result.library.steps) {
      steps = result.library.steps.map(function (step) {
        return '<li>' + U.escapeHtml(step) + '</li>';
      }).join('');
    } else {
      var letters = 'abcdefghijklmnop';
      var setup = result.species.map(function (formula, index) {
        return letters.charAt(index) + '（' + formula + '）';
      }).join('、');

      var equations = result.elements.map(function (element) {
        var left = [];
        var right = [];
        result.species.forEach(function (formula, index) {
          var counts = CL.molecule.parseFormula(formula) || {};
          if (!counts[element]) return;
          var term = (counts[element] === 1 ? '' : counts[element]) + letters.charAt(index);
          if (index < result.parsed.reactants.length) left.push(term);
          else right.push(term);
        });
        return '对 ' + element + ' 守恒：' + (left.join(' + ') || '0') + ' = ' + (right.join(' + ') || '0');
      });

      steps =
        '<li>设各物质的系数依次为 ' + U.escapeHtml(setup) + '。</li>' +
        equations.map(function (line) { return '<li>' + U.escapeHtml(line) + '</li>'; }).join('') +
        '<li>联立方程求解，得到一组比例，再化为最简整数比。</li>' +
        '<li>得到系数：' + result.coefficients.join(' : ') + '。</li>' +
        '<li>代回原式验算（见上表），各元素反应前后数目相等，配平完成。</li>';
    }

    box.innerHTML =
      '<div class="balance-answer">' +
      '<span class="eyebrow">配平结果</span>' +
      '<p class="balance-equation">' + U.escapeHtml(result.equation) + '</p>' +
      '<div class="coef-row">' + coefficientChips + '</div>' +
      '</div>' +
      '<div class="result-grid">' +
      '<div class="result-block"><h4>元素守恒验算</h4>' + table + '</div>' +
      '<div class="result-block"><h4>配平步骤</h4><ol class="step-list">' + steps + '</ol></div>' +
      '</div>' +
      (result.library ? '<div class="tool-note"><strong>题目说明：</strong>' +
        U.escapeHtml(result.library.note || '') + '</div>' : '') +
      '<div class="tool-note">提示：配平只改变系数，不能改动化学式；遇到分数系数时，全式同乘分母化为整数。</div>';
  }

  /* ============================ 工具二：物质识别 ============================ */

  /**
   * 常见物质的属性库（按化学式索引）
   * 说明：这里的性质均为教学常用近似值，用于帮助建立“结构—性质”联系。
   */
  var SUBSTANCE_DB = {
    'H2O': { category: '共价化合物', bondType: '极性共价键', polarity: '极性分子', imf: '氢键 + 偶极-偶极 + 色散力', structure: '角形（V 形），键角 104.5°', mp: '0 ℃', bp: '100 ℃', solubility: '与水互溶（自身）', note: '氢键使水的沸点、比热容异常高，冰的密度小于水。' },
    'CH4': { category: '共价化合物（烃）', bondType: '非极性共价键（C-H 弱极性）', polarity: '非极性分子', imf: '色散力', structure: '正四面体形，109.5°', mp: '−182 ℃', bp: '−161 ℃', solubility: '难溶于水，易溶于有机溶剂', note: '天然气的主要成分，完全燃烧生成 CO₂ 与 H₂O。' },
    'CO2': { category: '共价化合物', bondType: '极性共价键（C=O）', polarity: '非极性分子', imf: '色散力', structure: '直线形，180°', mp: '−78 ℃（升华）', bp: '−78 ℃（升华）', solubility: '微溶于水（1:1 体积）', note: '含极性键但分子对称，偶极为 0；固态为干冰。' },
    'NH3': { category: '共价化合物', bondType: '极性共价键', polarity: '极性分子', imf: '氢键 + 偶极-偶极 + 色散力', structure: '三角锥形，107°', mp: '−78 ℃', bp: '−33 ℃', solubility: '极易溶于水（1:700）', note: '孤对电子使其成为 Lewis 碱，可与 H⁺ 结合成 NH₄⁺。' },
    'C6H6': { category: '共价化合物（芳香烃）', bondType: '芳香键（键级 1.5）', polarity: '非极性分子', imf: '色散力 + π-π 堆积', structure: '平面正六边形，120°', mp: '5.5 ℃', bp: '80 ℃', solubility: '难溶于水，易溶于有机溶剂', note: '离域大 π 键使苯具有特殊稳定性，易发生取代而非加成。' },
    'NaCl': { category: '离子化合物', bondType: '离子键', polarity: '离子化合物（无分子偶极）', imf: '离子-偶极作用（溶于水时）', structure: '面心立方晶格，配位数 6:6', mp: '801 ℃', bp: '1413 ℃', solubility: '易溶于水（36 g/100 g 水）', note: '固态不导电，熔融或水溶液导电。' },
    'O2': { category: '非金属单质', bondType: '非极性共价键（O=O）', polarity: '非极性分子', imf: '色散力', structure: '直线形，180°', mp: '−218 ℃', bp: '−183 ℃', solubility: '微溶于水（约 4.9 mL/100 mL）', note: '含两个未成对电子，具有顺磁性。' },
    'N2': { category: '非金属单质', bondType: '非极性共价键（N≡N）', polarity: '非极性分子', imf: '色散力', structure: '直线形，180°', mp: '−210 ℃', bp: '−196 ℃', solubility: '难溶于水', note: 'N≡N 键能 941 kJ/mol，化学性质极稳定。' },
    'H2': { category: '非金属单质', bondType: '非极性共价键', polarity: '非极性分子', imf: '色散力（极弱）', structure: '直线形，180°', mp: '−259 ℃', bp: '−253 ℃', solubility: '难溶于水', note: '密度最小的气体，清洁能源。' },
    'HCl': { category: '共价化合物', bondType: '极性共价键', polarity: '极性分子', imf: '偶极-偶极 + 色散力', structure: '直线形，180°', mp: '−115 ℃', bp: '−85 ℃', solubility: '极易溶于水（1:500）', note: '水溶液为盐酸，强酸；不能形成分子间氢键。' },
    'H2O2': { category: '共价化合物', bondType: '极性共价键（O-O 非极性）', polarity: '极性分子', imf: '氢键 + 偶极-偶极 + 色散力', structure: '书页形（非平面）', mp: '−0.4 ℃', bp: '150 ℃', solubility: '与水互溶', note: 'O-O 键较弱，易分解，常作氧化剂与消毒剂。' },
    'SO2': { category: '共价化合物', bondType: '极性共价键', polarity: '极性分子', imf: '偶极-偶极 + 色散力', structure: '角形，约 119°', mp: '−72 ℃', bp: '−10 ℃', solubility: '易溶于水（1:40）', note: '形成酸雨的主要污染物，可使品红溶液褪色。' },
    'SO3': { category: '共价化合物', bondType: '极性共价键', polarity: '非极性分子', imf: '色散力', structure: '平面三角形，120°', mp: '16.9 ℃', bp: '44.8 ℃', solubility: '遇水剧烈反应生成硫酸', note: '强 Lewis 酸，工业制硫酸的中间产物。' },
    'NO2': { category: '共价化合物', bondType: '极性共价键（含离域键）', polarity: '极性分子', imf: '偶极-偶极 + 色散力', structure: '角形，约 134°', mp: '−11 ℃', bp: '21 ℃', solubility: '与水反应生成硝酸与 NO', note: '红棕色、有刺激性气味，易二聚为 N₂O₄。' },
    'C2H4': { category: '共价化合物（烯烃）', bondType: 'C=C 双键（1σ+1π）', polarity: '非极性分子', imf: '色散力', structure: '平面形，键角约 121°', mp: '−169 ℃', bp: '−104 ℃', solubility: '难溶于水，易溶于有机溶剂', note: 'π 键不能自由旋转，使六个原子共平面；可作植物催熟剂。' },
    'C2H2': { category: '共价化合物（炔烃）', bondType: 'C≡C 三键（1σ+2π）', polarity: '非极性分子', imf: '色散力', structure: '直线形，180°', mp: '−81 ℃', bp: '−84 ℃（升华）', solubility: '微溶于水，易溶于有机溶剂', note: '氧炔焰温度可达 3000 ℃，用于焊接与切割金属。' },
    'CH3OH': { category: '共价化合物（醇）', bondType: '极性共价键', polarity: '极性分子', imf: '氢键 + 偶极-偶极 + 色散力', structure: '四面体（以碳为中心）', mp: '−98 ℃', bp: '65 ℃', solubility: '与水互溶', note: '有毒，误饮可致失明；工业上由 CO 与 H₂ 合成。' },
    'C2H5OH': { category: '共价化合物（醇）', bondType: '极性共价键', polarity: '极性分子', imf: '氢键 + 偶极-偶极 + 色散力', structure: '四面体（以碳为中心）', mp: '−114 ℃', bp: '78 ℃', solubility: '与水互溶', note: '消毒酒精常用 75% 体积分数；沸点远高于相对分子质量相近的丙烷。' },
    'CO': { category: '共价化合物', bondType: '极性共价键（三键）', polarity: '极性分子（偶极矩很小）', imf: '偶极-偶极 + 色散力', structure: '直线形，180°', mp: '−205 ℃', bp: '−192 ℃', solubility: '难溶于水', note: '与血红蛋白结合能力远强于 O₂，剧毒；与 N₂ 为等电子体。' },
    'HCN': { category: '共价化合物', bondType: '极性共价键（三键）', polarity: '极性分子', imf: '偶极-偶极 + 色散力 + 弱氢键', structure: '直线形，180°', mp: '−14 ℃', bp: '26 ℃', solubility: '与水互溶', note: '极弱酸但极毒，抑制细胞色素氧化酶。' },
    'BF3': { category: '共价化合物', bondType: '极性共价键', polarity: '非极性分子', imf: '色散力', structure: '平面三角形，120°', mp: '−127 ℃', bp: '−100 ℃', solubility: '遇水水解', note: '硼只有 6 个价电子，是典型 Lewis 酸。' },
    'PCl5': { category: '共价化合物', bondType: '极性共价键', polarity: '非极性分子', imf: '色散力', structure: '三角双锥形', mp: '167 ℃（升华）', bp: '—', solubility: '遇水水解', note: '超价分子，轴向与赤道向键长不等。' },
    'SF6': { category: '共价化合物', bondType: '极性共价键', polarity: '非极性分子', imf: '色散力', structure: '正八面体形，90°', mp: '−50 ℃（升华）', bp: '—', solubility: '不溶于水', note: '高度对称、化学惰性，用作高压电气设备绝缘气体。' },
    'XeF4': { category: '共价化合物', bondType: '极性共价键', polarity: '非极性分子', imf: '色散力', structure: '平面正方形，90°', mp: '114 ℃', bp: '—', solubility: '与水反应', note: 'Xe 有两对孤对电子占据轴向，4 个 F 共平面。' },
    'Cl2': { category: '非金属单质', bondType: '非极性共价键', polarity: '非极性分子', imf: '色散力', structure: '直线形，180°', mp: '−101 ℃', bp: '−34 ℃', solubility: '可溶于水（1:2）', note: '黄绿色有毒气体，与水反应生成盐酸与次氯酸。' },
    'HF': { category: '共价化合物', bondType: '极性共价键', polarity: '极性分子', imf: '强氢键 + 偶极-偶极 + 色散力', structure: '直线形，180°', mp: '−83 ℃', bp: '20 ℃', solubility: '与水互溶', note: '弱酸但能腐蚀玻璃（与 SiO₂ 反应），氢键很强。' },
    'O3': { category: '非金属单质', bondType: '极性共价键（离域）', polarity: '极性分子', imf: '偶极-偶极 + 色散力', structure: '角形，116.8°', mp: '−192 ℃', bp: '−111 ℃', solubility: '微溶于水', note: '强氧化性，能吸收紫外线，保护地球生物。' },
    'NH4+': { category: '离子（多原子阳离子）', bondType: '极性共价键（N-H）', polarity: '离子（无分子偶极）', imf: '离子-偶极作用（溶液中）', structure: '正四面体形，109.5°', mp: '—', bp: '—', solubility: '与阴离子共存于盐中', note: '与 CH₄ 等电子，四个 N-H 键完全等价。' },
    'H3O+': { category: '离子（多原子阳离子）', bondType: '极性共价键', polarity: '离子（有偶极）', imf: '离子-偶极 + 氢键', structure: '三角锥形，约 113°', mp: '—', bp: '—', solubility: '存在于酸性水溶液中', note: '水溶液中质子的真实存在形式。' },
    'CH3COOH': { category: '共价化合物（羧酸）', bondType: '极性共价键', polarity: '极性分子', imf: '强氢键 + 偶极-偶极 + 色散力', structure: '羧基平面 + 甲基四面体', mp: '17 ℃', bp: '118 ℃', solubility: '与水互溶', note: '弱酸，常以二聚体形式存在，沸点显著升高。' },
    'SiO2': { category: '共价晶体', bondType: '共价键（三维网络）', polarity: '非分子（无分子极性）', imf: '共价键（晶格内）', structure: 'SiO₄ 四面体共用顶点', mp: '1710 ℃', bp: '2230 ℃', solubility: '不溶于水，溶于 HF', note: '共价网络晶体，硬度大、熔点极高。' },
    'H2S': { category: '共价化合物', bondType: '极性共价键', polarity: '极性分子', imf: '偶极-偶极 + 色散力', structure: '角形，92°', mp: '−82 ℃', bp: '−60 ℃', solubility: '微溶于水（1:2.6）', note: '有臭鸡蛋气味，有毒；不能形成有效氢键。' },
    'PH3': { category: '共价化合物', bondType: '极性共价键', polarity: '极性分子', imf: '偶极-偶极 + 色散力', structure: '三角锥形，93.5°', mp: '−133 ℃', bp: '−88 ℃', solubility: '难溶于水', note: '键角接近 90°，杂化程度低，碱性远弱于 NH₃。' },
    'CaO': { category: '离子化合物', bondType: '离子键', polarity: '离子化合物', imf: '离子键（晶格内）', structure: 'NaCl 型晶格', mp: '2572 ℃', bp: '2850 ℃', solubility: '与水反应生成 Ca(OH)₂', note: '生石灰，常用作干燥剂。' },
    'MgO': { category: '离子化合物', bondType: '离子键', polarity: '离子化合物', imf: '离子键（晶格内）', structure: 'NaCl 型晶格', mp: '2852 ℃', bp: '3600 ℃', solubility: '难溶于水', note: '晶格能极大，熔点极高，用作耐火材料。' },
    'HBr': { category: '共价化合物', bondType: '极性共价键', polarity: '极性分子', imf: '偶极-偶极 + 色散力', structure: '直线形，180°', mp: '−87 ℃', bp: '−67 ℃', solubility: '极易溶于水', note: '水溶液为氢溴酸，强酸。' },
    'HI': { category: '共价化合物', bondType: '极性共价键', polarity: '极性分子', imf: '偶极-偶极 + 色散力', structure: '直线形，180°', mp: '−51 ℃', bp: '−35 ℃', solubility: '极易溶于水', note: '强酸且易被氧化，需避光保存。' },
    'H2SO4': { category: '共价化合物（强酸）', bondType: '极性共价键', polarity: '极性分子', imf: '强氢键 + 偶极-偶极 + 色散力', structure: '四面体（以硫为中心）', mp: '10 ℃', bp: '337 ℃', solubility: '与水任意比互溶（放热）', note: '二元强酸，浓硫酸具有强吸水性与脱水性。' },
    'HNO3': { category: '共价化合物（强酸）', bondType: '极性共价键', polarity: '极性分子', imf: '氢键 + 偶极-偶极 + 色散力', structure: '平面形', mp: '−42 ℃', bp: '83 ℃', solubility: '与水互溶', note: '强氧化性一元酸，见光易分解。' },
    'NaOH': { category: '离子化合物', bondType: '离子键（含 O-H 共价键）', polarity: '离子化合物', imf: '离子-偶极作用', structure: '离子晶格', mp: '318 ℃', bp: '1388 ℃', solubility: '易溶于水（放热）', note: '强碱，易潮解，需密封保存。' },
    'CaCO3': { category: '离子化合物', bondType: '离子键（含 C-O 共价键）', polarity: '离子化合物', imf: '离子键（晶格内）', structure: '方解石/文石晶型', mp: '825 ℃（分解）', bp: '—', solubility: '难溶于水', note: '石灰石、大理石的主要成分，高温分解生成 CaO 与 CO₂。' },
    'C6H12O6': { category: '共价化合物（糖类）', bondType: '极性共价键', polarity: '极性分子', imf: '氢键 + 偶极-偶极 + 色散力', structure: '多羟基醛（链状或环状）', mp: '146 ℃', bp: '—', solubility: '易溶于水', note: '生命活动的主要能源物质。' },
  };

  var METALS = ['Li', 'Na', 'K', 'Rb', 'Cs', 'Mg', 'Ca', 'Sr', 'Ba', 'Al',
    'Fe', 'Cu', 'Zn', 'Ag', 'Pb', 'Sn', 'Mn', 'Cr', 'Ni', 'Co', 'Ti',
    'Au', 'Pt', 'Hg', 'U'];

  /** 在名称映射表中查找 */
  function lookupNameEntry(query) {
    var target = CL.data.normalizeName(query);
    var entries = CL.data.nameEntries();
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var names = [entry.name].concat(entry.aliases || []);
      for (var j = 0; j < names.length; j++) {
        if (CL.data.normalizeName(names[j]) === target) return entry;
      }
    }
    return null;
  }

  /**
   * 识别物质：名称或化学式 → 类别 / 键型 / 极性 / 分子间作用力
   * @param {string} query
   */
  function identify(query) {
    var raw = String(query || '').trim();
    if (!raw) return { error: '请输入物质名称或化学式，例如“水”“NaCl”。' };

    var entry = lookupNameEntry(raw);
    var formula = entry ? entry.formula : raw;
    var molecule = CL.data.resolveMolecule(raw);

    if (molecule) formula = molecule.formula;

    var normalized = CL.data.normalizeFormula(formula);
    var counts = CL.molecule.parseFormula(formula);
    if (!counts) {
      return { error: '无法解析化学式“' + formula + '”，请检查大小写与括号。' };
    }

    var known = SUBSTANCE_DB[normalized];
    var estimate = CL.molecule.estimate(formula);
    var elements = Object.keys(counts);
    var hasMetal = elements.some(function (element) {
      return METALS.indexOf(element) >= 0;
    });

    var category = known ? known.category :
      (elements.length === 1 ? '单质（' + (hasMetal ? '金属' : '非金属') + '）' :
        (hasMetal ? '离子化合物（推测）' : '共价化合物（推测）'));

    var bondType = known ? known.bondType :
      (elements.length === 1 ? (hasMetal ? '金属键' : '非极性共价键') :
        (hasMetal ? '离子键' : '共价键'));

    var polarity = known ? known.polarity :
      (estimate ? estimate.polarity : (hasMetal ? '离子化合物（无分子偶极）' : '无法判断'));
    var imf = known ? known.imf : (estimate ? estimate.imf : '不确定');
    var structure = known ? known.structure : (estimate ? estimate.geometry : '暂无数据');

    return {
      query: raw,
      name: entry ? entry.name : (molecule && molecule.names ? molecule.names[0] : raw),
      formula: molecule ? molecule.formula : formula,
      normalized: normalized,
      category: category,
      bondType: bondType,
      polarity: polarity,
      imf: imf,
      structure: structure,
      mp: known ? known.mp : '—',
      bp: known ? known.bp : '—',
      solubility: known ? known.solubility : '—',
      note: known ? known.note :
        (estimate ? estimate.notes : '该物质暂无内置资料，以上为根据化学式做出的初步判断。'),
      isEstimate: !known
    };
  }

  /** 渲染物质识别工具 */
  function renderIdentify() {
    var panel = U.$('#tool-panel');

    panel.innerHTML =
      '<div class="tool-card">' +
      '<h2 class="tool-card__title">🔎 物质识别小工具</h2>' +
      '<p class="tool-card__desc">输入物质名称或化学式，快速判断它属于离子化合物、共价化合物还是单质，并给出键型、极性、分子间作用力与结构说明。</p>' +
      '<form class="tool-form" id="identify-form" autocomplete="off">' +
      '<input id="identify-input" class="tool-input" type="text" placeholder="例如：食盐、CO2、NH3、MgO" value="水" aria-label="输入物质名称或化学式">' +
      '<button class="btn btn--primary" type="submit">识别</button>' +
      '</form>' +
      '<div class="suggest-row"><span class="suggest-row__label">试试：</span>' +
      ['水', '食盐', '干冰', '氨气', '金刚石', 'MgO', '乙醇'].map(function (name) {
        return '<button type="button" class="chip chip--btn" data-name="' + U.escapeHtml(name) + '">' +
          U.escapeHtml(name) + '</button>';
      }).join('') +
      '</div>' +
      '<div id="identify-result" class="tool-result" aria-live="polite"></div>' +
      '</div>' +
      '<div class="tool-note tool-note--standalone">' +
      '<strong>使用提示：</strong>“相似相溶”、键的极性、分子几何与分子间作用力是相互关联的判断链条。' +
      '识别结果可以帮助你快速建立这条链条，但考试时仍需要写出推理过程。' +
      '</div>';

    var form = U.$('#identify-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      renderIdentifyResult(identify(U.$('#identify-input').value));
    });

    U.delegate(panel, 'click', '[data-name]', function (event, button) {
      var name = button.getAttribute('data-name');
      U.$('#identify-input').value = name;
      renderIdentifyResult(identify(name));
    });

    renderIdentifyResult(identify('水'));
  }

  /** 渲染识别结果 */
  function renderIdentifyResult(result) {
    var box = U.$('#identify-result');
    if (!box) return;

    if (!result || result.error) {
      box.innerHTML = '<div class="tool-error">⚠️ ' +
        U.escapeHtml(result ? result.error : '未知错误') + '</div>';
      return;
    }

    var rows = [
      ['物质类别', result.category],
      ['化学键类型', result.bondType],
      ['分子极性', result.polarity],
      ['分子间作用力', result.imf],
      ['空间结构', result.structure],
      ['熔点', result.mp],
      ['沸点', result.bp],
      ['溶解性', result.solubility]
    ];

    box.innerHTML =
      '<div class="identify-head">' +
      '<div>' +
      '<span class="eyebrow">' + (result.isEstimate ? '基于化学式的初步判断' : '内置物质资料') + '</span>' +
      '<h3 class="identify-title">' + U.escapeHtml(result.name) +
      '<span class="identify-formula">' + U.escapeHtml(result.formula) + '</span></h3>' +
      '</div>' +
      '<a class="btn btn--ghost btn--sm" href="#/molecule/' + encodeURIComponent(result.formula) + '">查看 3D 结构</a>' +
      '</div>' +
      '<dl class="property-list property-list--wide">' +
      rows.map(function (row) {
        return '<div class="property-row"><dt>' + row[0] + '</dt><dd>' +
          U.escapeHtml(row[1] || '—') + '</dd></div>';
      }).join('') +
      '</dl>' +
      '<p class="panel-note">' + U.escapeHtml(result.note) + '</p>' +
      (result.isEstimate ?
        '<div class="panel-warn">该物质不在内置资料库中，类别与结构为推测结果，建议结合课本数据核对。</div>' : '');
  }

  /* ============================ 工具三：摩尔质量 ============================ */

  /** 常用元素的相对原子质量（IUPAC 常用值，保留三位小数） */
  var ATOMIC_MASS = {
    H: 1.008, He: 4.003, Li: 6.94, Be: 9.012, B: 10.81, C: 12.011,
    N: 14.007, O: 15.999, F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305,
    Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948,
    K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996,
    Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38,
    Ga: 69.723, Ge: 72.630, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798,
    Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224, Ag: 107.868, Cd: 112.414,
    In: 114.818, Sn: 118.710, Sb: 121.760, I: 126.904, Xe: 131.293, Cs: 132.905,
    Ba: 137.327, Pt: 195.084, Au: 196.967, Hg: 200.592, Pb: 207.2, U: 238.029
  };

  /**
   * 计算摩尔质量
   * @param {string} formula 化学式（支持括号与结晶水，如 CuSO4·5H2O）
   */
  function molarMass(formula) {
    var text = String(formula || '').trim()
      .replace(/[₀-₉]/g, function (ch) { return '₀₁₂₃₄₅₆₇₈₉'.indexOf(ch); });
    if (!text) return { error: '请输入化学式，例如 H2O 或 CuSO4·5H2O。' };

    var parts = text.split(/[·*]/);
    var totals = {};
    var partList = [];

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part) continue;

      var match = part.match(/^(\d+)/);
      var multiplier = match ? parseInt(match[1], 10) : 1;
      var clean = part.replace(/^\d+/, '');

      var counts = CL.molecule.parseFormula(clean);
      if (!counts) {
        return { error: '无法解析化学式片段“' + part + '”，请检查大小写、括号与下标。' };
      }

      Object.keys(counts).forEach(function (element) {
        totals[element] = (totals[element] || 0) + counts[element] * multiplier;
      });

      partList.push({ formula: clean, multiplier: multiplier, counts: counts });
    }

    var elements = Object.keys(totals);
    if (!elements.length) return { error: '没有解析到任何元素。' };

    var unknown = elements.filter(function (element) {
      return ATOMIC_MASS[element] === undefined;
    });
    if (unknown.length) {
      return { error: '暂不支持元素：' + unknown.join('、') + '，可补充相对原子质量数据。' };
    }

    var rows = elements.map(function (element) {
      var count = totals[element];
      var mass = ATOMIC_MASS[element];
      return {
        element: element,
        count: count,
        atomicMass: mass,
        subtotal: mass * count
      };
    });

    var total = rows.reduce(function (sum, row) { return sum + row.subtotal; }, 0);
    rows.forEach(function (row) {
      row.percent = total ? (row.subtotal / total) * 100 : 0;
    });

    return {
      formula: text,
      parts: partList,
      rows: rows,
      total: total
    };
  }

  /** 渲染摩尔质量工具 */
  function renderMolar() {
    var panel = U.$('#tool-panel');

    panel.innerHTML =
      '<div class="tool-card">' +
      '<h2 class="tool-card__title">🧮 摩尔质量计算器</h2>' +
      '<p class="tool-card__desc">输入化学式，计算摩尔质量并查看各元素的质量贡献。支持括号与结晶水，例如 Ca(OH)2、CuSO4·5H2O。</p>' +
      '<form class="tool-form" id="molar-form" autocomplete="off">' +
      '<input id="molar-input" class="tool-input" type="text" placeholder="例如：CuSO4·5H2O" value="H2O" aria-label="输入化学式">' +
      '<button class="btn btn--primary" type="submit">计算</button>' +
      '</form>' +
      '<div class="suggest-row"><span class="suggest-row__label">试试：</span>' +
      ['H2O', 'NaCl', 'Ca(OH)2', 'CuSO4·5H2O', 'C6H12O6', 'NH4NO3'].map(function (formula) {
        return '<button type="button" class="chip chip--btn" data-formula="' + U.escapeHtml(formula) + '">' +
          U.escapeHtml(formula) + '</button>';
      }).join('') +
      '</div>' +
      '<div id="molar-result" class="tool-result" aria-live="polite"></div>' +
      '</div>' +
      '<div class="tool-note tool-note--standalone">' +
      '<strong>复习提示：</strong>摩尔质量 M 在数值上等于相对分子质量，单位是 g/mol。' +
      '计算物质的量时使用 n = m / M；配制溶液时再结合 M = n / V 求浓度。' +
      '</div>';

    var form = U.$('#molar-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      renderMolarResult(molarMass(U.$('#molar-input').value));
    });

    U.delegate(panel, 'click', '[data-formula]', function (event, button) {
      var formula = button.getAttribute('data-formula');
      U.$('#molar-input').value = formula;
      renderMolarResult(molarMass(formula));
    });

    renderMolarResult(molarMass('H2O'));
  }

  /** 渲染摩尔质量结果 */
  function renderMolarResult(result) {
    var box = U.$('#molar-result');
    if (!box) return;

    if (!result || result.error) {
      box.innerHTML = '<div class="tool-error">⚠️ ' +
        U.escapeHtml(result ? result.error : '未知错误') + '</div>';
      return;
    }

    var table = '<table class="data-table"><thead><tr>' +
      '<th>元素</th><th>原子个数</th><th>相对原子质量</th><th>质量小计</th><th>质量分数</th>' +
      '</tr></thead><tbody>' +
      result.rows.map(function (row) {
        return '<tr><td>' + row.element + '</td><td>' + row.count + '</td><td>' +
          row.atomicMass + '</td><td>' + row.subtotal.toFixed(3) + '</td><td>' +
          row.percent.toFixed(2) + '%</td></tr>';
      }).join('') +
      '</tbody></table>';

    var hydrateNote = result.parts.length > 1
      ? '<p class="panel-note">结晶水已按系数展开：' +
      result.parts.map(function (part) {
        return part.multiplier + ' × ' + part.formula;
      }).join(' + ') + '。</p>'
      : '';

    box.innerHTML =
      '<div class="molar-answer">' +
      '<span class="eyebrow">摩尔质量</span>' +
      '<p class="molar-value">' + result.total.toFixed(3) + ' <span>g/mol</span></p>' +
      '<p class="molar-formula">' + U.escapeHtml(result.formula) + '</p>' +
      '</div>' +
      '<div class="result-block"><h4>组成明细</h4>' + table + '</div>' +
      hydrateNote +
      '<div class="tool-note">若题目给出质量 m（g），则物质的量 n = m ÷ M = ' +
      'm ÷ ' + result.total.toFixed(2) + ' mol。' +
      '例如 m = ' + result.total.toFixed(2) + ' g 时，n = 1.00 mol，约含 6.022×10²³ 个粒子。</div>';
  }

  CL.tools = {
    render: render,
    balance: balance,
    identify: identify,
    molarMass: molarMass,
    parseEquationInput: parseEquationInput
  };
})(window);
