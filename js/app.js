/**
 * app.js —— 应用入口
 * ------------------------------------------------------------------
 * 负责：
 *   1. 初始化本地存储与数据
 *   2. 注册路由
 *   3. 渲染首页
 *   4. 维护顶部导航的进度徽标、错题数量
 *   5. 移动端菜单、键盘快捷键、加载失败提示
 */
(function (global) {
  'use strict';

  var CL = global.CL = global.CL || {};
  var U = CL.utils;

  /* ============================ 顶部与外壳 ============================ */

  /** 刷新顶部的学习进度与错题数量 */
  function refreshHeader() {
    if (!CL.data.state.loaded) return;

    var readCount = CL.store.readCount();
    var total = CL.data.allPoints().length;
    var wrong = CL.store.wrongStats();

    var progress = U.$('#header-progress');
    if (progress) {
      progress.textContent = '已学 ' + readCount + ' / ' + total;
    }

    var badge = U.$('#wrong-badge');
    if (badge) {
      badge.textContent = wrong.pending;
      badge.classList.toggle('is-zero', wrong.pending === 0);
      badge.setAttribute('aria-label', '待巩固错题 ' + wrong.pending + ' 道');
    }
  }

  /** 绑定外壳交互：移动端菜单、回到顶部、快捷键 */
  function bindShell() {
    var toggle = U.$('#nav-toggle');
    var header = U.$('.site-header');
    if (toggle && header) {
      toggle.addEventListener('click', function () {
        var open = header.classList.toggle('nav-open');
        document.body.classList.toggle('nav-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    // 点击导航后自动收起移动端菜单
    var nav = U.$('#main-nav');
    if (nav) {
      U.delegate(nav, 'click', 'a', function () {
        if (header) header.classList.remove('nav-open');
        document.body.classList.remove('nav-open');
      });
    }

    // 回到顶部按钮
    var backTop = U.$('#back-top');
    if (backTop) {
      backTop.addEventListener('click', U.scrollTop);
      global.addEventListener('scroll', U.throttle(function () {
        backTop.classList.toggle('is-visible', global.scrollY > 600);
      }, 200));
    }

    // 键盘快捷键：按 g 后再按 h/c/q/w/m/t 跳转
    var pendingG = false;
    var pendingTimer = null;
    document.addEventListener('keydown', function (event) {
      var tag = (event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || event.target.isContentEditable) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'g') {
        pendingG = true;
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(function () { pendingG = false; }, 1200);
        return;
      }

      if (pendingG) {
        var map = { h: '/home', c: '/chapters', q: '/quiz', w: '/wrongbook', m: '/molecule', t: '/tools' };
        var target = map[event.key.toLowerCase()];
        pendingG = false;
        if (target) {
          event.preventDefault();
          CL.router.navigate(target);
        }
      }
    });

    var year = U.$('#footer-year');
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ============================ 首页 ============================ */

  /** 渲染首页：首屏只保留 Hero，其他内容由独立页面承载 */
  function renderHome() {
    var root = U.$('#view-root');

    // 找到第一个未学习的知识点，作为“继续学习”入口
    var nextPoint = null;
    var points = CL.data.allPoints();
    for (var i = 0; i < points.length; i++) {
      if (!CL.store.isPointRead(points[i].id)) {
        nextPoint = points[i];
        break;
      }
    }

    var continueHref = nextPoint ? '#/knowledge/' + nextPoint.id : '#/chapters';
    var hasProgress = CL.store.readCount() > 0;
    var continueLabel = hasProgress
      ? (nextPoint ? '继续学习' : '去复习')
      : '开始学习';

    var heroHtml =
      '<section class="hero">' +
      '<div class="hero__content">' +
      '<p class="eyebrow">AP CHEMISTRY · 学练一体</p>' +
      '<h1 class="hero__title">把抽象的化学结构<br><em>看懂、练会、记住</em></h1>' +
      '<p class="hero__desc">专为 AP 化学打造的可视化学习平台，提供 3D 分子模型与针对性练习。</p>' +
      '<div class="hero__actions">' +
      '<a class="btn btn--primary btn--lg" href="' + continueHref + '">' + U.escapeHtml(continueLabel) + '</a>' +
      '<a class="hero__link" href="#/molecule">打开 3D 分子 →</a>' +
      '</div>' +
      '</div>' +
      '<div class="hero__visual">' +
      '<figure class="hero__figure">' +
      '<div class="hero__figure-canvas">' +
      '<svg viewBox="55 40 250 210" role="img" aria-label="水分子 H2O 的结构示意图">' +
      '<line x1="128" y1="117" x2="168" y2="150" stroke="#b6bcc4" stroke-width="7"/>' +
      '<line x1="253" y1="124" x2="200" y2="152" stroke="#b6bcc4" stroke-width="7"/>' +
      '<circle cx="180" cy="170" r="52" fill="#c0392b" stroke="#8f2a20" stroke-width="2"/>' +
      '<text x="180" y="181" text-anchor="middle" font-family="Menlo, Consolas, monospace" font-size="28" fill="#ffffff">O</text>' +
      '<circle cx="112" cy="96" r="30" fill="#f9fafb" stroke="#9ca3af" stroke-width="2"/>' +
      '<text x="112" y="105" text-anchor="middle" font-family="Menlo, Consolas, monospace" font-size="19" fill="#374151">H</text>' +
      '<circle cx="272" cy="110" r="30" fill="#f9fafb" stroke="#9ca3af" stroke-width="2"/>' +
      '<text x="272" y="119" text-anchor="middle" font-family="Menlo, Consolas, monospace" font-size="19" fill="#374151">H</text>' +
      '</svg>' +
      '</div>' +
      '<figcaption class="hero__caption">H₂O · 104.5° · sp³</figcaption>' +
      '</figure>' +
      '</div>' +
      '</section>';

    root.innerHTML =
      '<section class="page page--home">' +
      heroHtml +
      '</section>';

    CL.router.setTitle('首页');
    refreshHeader();
  }

  /* ============================ 路由注册 ============================ */

  /** 注册全部路由 */
  function registerRoutes() {
    CL.router.register('/home', renderHome);

    CL.router.register('/chapters', function () {
      CL.knowledge.renderChapters();
    });

    CL.router.register('/chapter/:id', function (params) {
      CL.knowledge.renderChapter(params);
    });

    CL.router.register('/knowledge/:id', function (params) {
      CL.knowledge.renderPoint(params);
    });

    CL.router.register('/quiz', function () {
      CL.quiz.renderIndex();
    });

    CL.router.register('/quiz/:id', function (params) {
      var id = params.id;

      if (id === 'random') {
        CL.quiz.start({ mode: 'random', title: '随机练习（10 题）' });
        return;
      }

      if (id === 'consolidate') {
        var stats = CL.store.wrongStats();
        if (!stats.pending) {
          U.toast('没有待巩固的错题，先去做几道新题吧', 'info');
          CL.router.navigate('/quiz', true);
          return;
        }
        CL.quiz.start({ mode: 'consolidate', title: '错题再次巩固' });
        return;
      }

      var chapter = CL.data.chapter(id);
      if (chapter) {
        CL.quiz.start({
          chapterId: id,
          mode: 'chapter',
          title: chapter.title + ' · 章节练习'
        });
      } else {
        U.toast('未找到该章节，已返回练习中心', 'warn');
        CL.router.navigate('/quiz', true);
      }
    });

    CL.router.register('/wrongbook', function () {
      CL.wrongbook.render();
    });

    CL.router.register('/molecule', function (params) {
      CL.molecule.render(params);
    });

    CL.router.register('/molecule/:query', function (params) {
      CL.molecule.render(params);
    });

    CL.router.register('/tools', function (params) {
      CL.tools.render(params);
    });

    CL.router.register('/tools/:tab', function (params) {
      CL.tools.render(params);
    });

    CL.router.setNotFound(function (parsed) {
      var root = U.$('#view-root');
      root.innerHTML =
        '<section class="page page--notfound">' +
        '<div class="empty-state">' +
        '<div class="empty-state__icon">' + U.icon('compass') + '</div>' +
        '<h1>页面走丢了</h1>' +
        '<p>找不到路径 <code>#' + U.escapeHtml(parsed.path) + '</code>，它可能已被移动或删除。</p>' +
        '<div class="empty-state__actions">' +
        '<a class="btn btn--primary" href="#/home">返回首页</a>' +
        '<a class="btn btn--ghost" href="#/chapters">去章节学习</a>' +
        '</div>' +
        '</div>' +
        '</section>';
      CL.router.setTitle('页面未找到');
    });
  }

  /* ============================ 启动 ============================ */

  /** 数据加载失败时的兜底页面 */
  function renderLoadError(error) {
    var root = U.$('#view-root');
    if (!root) return;
    root.innerHTML =
      '<section class="page">' +
      '<div class="empty-state">' +
      '<div class="empty-state__icon">' + U.icon('alert') + '</div>' +
      '<h1>数据加载失败</h1>' +
      '<p>' + U.escapeHtml(error && error.message ? error.message : String(error)) + '</p>' +
      '<p class="muted">如果你直接双击打开了 index.html，请确认 data/ 目录下的 .js 数据文件存在；' +
      '也可以在项目根目录运行 <code>python3 -m http.server 8000</code> 后访问 ' +
      '<code>http://localhost:8000</code>。</p>' +
      '<button class="btn btn--primary" onclick="location.reload()" type="button">重新加载</button>' +
      '</div>' +
      '</section>';
  }

  /** 应用启动 */
  function boot() {
    try {
      CL.store.init();
    } catch (error) {
      console.warn('[app] 本地存储初始化失败，将以内存模式运行：', error);
    }

    bindShell();

    CL.data.init().then(function () {
      registerRoutes();
      CL.router.start();
      refreshHeader();
      console.info('[ChemLearn] 数据来源：' + CL.data.state.source +
        '，知识点 ' + CL.data.stats().points + ' 个，题目 ' + CL.data.stats().questions + ' 道。');
    }).catch(function (error) {
      renderLoadError(error);
    });
  }

  CL.app = {
    boot: boot,
    renderHome: renderHome,
    refreshHeader: refreshHeader
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
