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

  /** 刷新顶部的学习进度与错题徽标 */
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

    var moleculeBadge = U.$('#header-molecules');
    if (moleculeBadge) {
      moleculeBadge.textContent = CL.data.stats().molecules;
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

  /** 渲染首页 */
  function renderHome() {
    var root = U.$('#view-root');
    var stats = CL.data.stats();
    var readCount = CL.store.readCount();
    var overall = U.percent(readCount, stats.points);
    var attempt = CL.store.attemptStats();
    var wrong = CL.store.wrongStats();

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
    var continueLabel = nextPoint ? '继续学习：' + nextPoint.title : '全部知识点已学完，去复习';

    var heroHtml =
      '<section class="hero">' +
      '<div class="hero__content">' +
      '<span class="eyebrow">AP Chemistry · 学练一体</span>' +
      '<h1 class="hero__title">把抽象的化学结构<br><span>看懂、练会、记住</span></h1>' +
      '<p class="hero__desc">5 个 AP 化学章节、' + stats.points + ' 个知识点、' + stats.questions +
      ' 道练习、' + stats.molecules + ' 个可旋转的 3D 分子模型。讲解细、能练习、能纠错、能可视化。</p>' +
      '<div class="hero__actions">' +
      '<a class="btn btn--primary btn--lg" href="' + continueHref + '">' + U.escapeHtml(continueLabel) + '</a>' +
      '<a class="btn btn--ghost btn--lg" href="#/molecule">打开 3D 分子</a>' +
      '</div>' +
      '<div class="hero__stats">' +
      '<div><strong>' + stats.chapters + '</strong><span>章节</span></div>' +
      '<div><strong>' + stats.points + '</strong><span>知识点</span></div>' +
      '<div><strong>' + stats.questions + '</strong><span>练习</span></div>' +
      '<div><strong>' + stats.molecules + '</strong><span>3D 分子</span></div>' +
      '</div>' +
      '</div>' +
      '<div class="hero__visual" aria-hidden="true">' +
      '<div class="hero-orbit">' +
      '<span class="hero-atom hero-atom--o">O</span>' +
      '<span class="hero-atom hero-atom--h1">H</span>' +
      '<span class="hero-atom hero-atom--h2">H</span>' +
      '<span class="hero-bond hero-bond--1"></span>' +
      '<span class="hero-bond hero-bond--2"></span>' +
      '</div>' +
      '<p class="hero__caption">H₂O · 104.5° · sp³</p>' +
      '</div>' +
      '</section>';

    var dashboardHtml =
      '<section class="dashboard">' +
      '<div class="dashboard__card dashboard__card--progress">' +
      U.progressRing(overall, { size: 96, stroke: 8 }) +
      '<div>' +
      '<h2>学习进度</h2>' +
      '<p>已学完 <strong>' + readCount + '</strong> / ' + stats.points + ' 个知识点</p>' +
      '<a class="text-link" href="#/chapters">查看章节 →</a>' +
      '</div>' +
      '</div>' +
      '<div class="dashboard__card">' +
      '<span class="dashboard__icon" aria-hidden="true">✍️</span>' +
      '<h2>练习正确率</h2>' +
      '<p><strong>' + attempt.accuracy + '%</strong> · 累计作答 ' + attempt.total + ' 次</p>' +
      '<a class="text-link" href="#/quiz">继续练习 →</a>' +
      '</div>' +
      '<div class="dashboard__card">' +
      '<span class="dashboard__icon" aria-hidden="true">📕</span>' +
      '<h2>待巩固错题</h2>' +
      '<p><strong>' + wrong.pending + '</strong> 道 · 已掌握 ' + wrong.mastered + ' 道</p>' +
      '<a class="text-link" href="#/wrongbook">打开错题集 →</a>' +
      '</div>' +
      '</section>';

    var chapterCards = CL.data.chapters().map(function (chapter) {
      var chapterPoints = CL.data.pointsOf(chapter.id);
      var progress = CL.store.chapterProgress(chapter.id, chapterPoints);
      return '<a class="mini-chapter" href="#/chapter/' + chapter.id + '" style="--chapter-color:' + chapter.color + '">' +
        '<span class="mini-chapter__icon" aria-hidden="true">' + chapter.icon + '</span>' +
        '<span class="mini-chapter__body">' +
        '<strong>' + U.escapeHtml(chapter.title) + '</strong>' +
        '<span class="mini-chapter__meta">' + progress.read + '/' + progress.total + ' 知识点 · ' +
        CL.store.chapterStats(chapter.id).accuracy + '% 正确率</span>' +
        '</span>' +
        '<span class="mini-chapter__ring">' +
        U.progressRing(progress.percent, { size: 44, stroke: 4, color: chapter.color }) +
        '</span>' +
        '</a>';
    }).join('');

    var recentWrong = CL.store.getWrongList({ status: 'pending', limit: 3 });
    var wrongHtml = recentWrong.length
      ? recentWrong.map(function (item) {
        var question = CL.data.question(item.questionId) || item.question;
        return '<li class="home-wrong-item">' +
          '<a href="#/wrongbook">' +
          U.escapeHtml(U.truncate(question ? question.question : item.questionId, 52)) +
          '</a>' +
          '<span class="muted">答错 ' + item.wrongCount + ' 次</span>' +
          '</li>';
      }).join('')
      : '<li class="home-wrong-item home-wrong-item--empty">还没有错题，保持下去！</li>';

    var pathHtml =
      '<ol class="path-list">' +
      '<li><span class="path-index">1</span><div><strong>读讲解</strong>' +
      '<p>先看定义与细致讲解，再对照例子推导一遍，最后扫一遍易错点与小结。</p></div></li>' +
      '<li><span class="path-index">2</span><div><strong>做练习</strong>' +
      '<p>每章 9 道题，提交后立即查看解析，弄清每一步为什么对、为什么错。</p></div></li>' +
      '<li><span class="path-index">3</span><div><strong>清错题</strong>' +
      '<p>错题自动入库。回到对应知识点复习，再重做，直到标记为“已掌握”。</p></div></li>' +
      '<li><span class="path-index">4</span><div><strong>看结构</strong>' +
      '<p>用 3D 分子旋转、缩放，把 VSEPR、杂化与极性真正“看见”。</p></div></li>' +
      '</ol>';

    var featureHtml =
      '<div class="feature-grid">' +
      '<a class="feature-card" href="#/chapters"><span class="feature-card__icon">📘</span>' +
      '<h3>知识讲解</h3><p>定义、细致讲解、举例、易错点、小结卡片，一个都不少。</p></a>' +
      '<a class="feature-card" href="#/quiz"><span class="feature-card__icon">✍️</span>' +
      '<h3>课后练习</h3><p>单选、判断、填空三种题型，即时判分，解析详细。</p></a>' +
      '<a class="feature-card" href="#/wrongbook"><span class="feature-card__icon">📕</span>' +
      '<h3>错题集</h3><p>自动收集、按章分组、支持重做与一键巩固，localStorage 持久化。</p></a>' +
      '<a class="feature-card" href="#/molecule"><span class="feature-card__icon">🧬</span>' +
      '<h3>3D 分子</h3><p>' + stats.molecules + ' 个分子模型，支持旋转、缩放与原子悬停提示。</p></a>' +
      '<a class="feature-card" href="#/tools"><span class="feature-card__icon">⚖️</span>' +
      '<h3>辅助工具</h3><p>配平助手、物质识别、摩尔质量计算，练习时随用随查。</p></a>' +
      '</div>';

    root.innerHTML =
      '<section class="page page--home">' +
      heroHtml +
      dashboardHtml +

      '<section class="home-section">' +
      '<div class="section-head">' +
      '<h2 class="section-title">章节速览</h2>' +
      '<a class="text-link" href="#/chapters">全部章节 →</a>' +
      '</div>' +
      '<div class="mini-chapter-grid">' + chapterCards + '</div>' +
      '</section>' +

      '<section class="home-section home-section--split">' +
      '<div class="home-panel">' +
      '<h2 class="section-title">学习路径</h2>' + pathHtml +
      '</div>' +
      '<div class="home-panel">' +
      '<h2 class="section-title">最近错题</h2>' +
      '<ul class="home-wrong-list">' + wrongHtml + '</ul>' +
      '<div class="home-panel__actions">' +
      '<a class="btn btn--primary btn--sm" href="#/quiz/consolidate">一键巩固错题</a>' +
      '<a class="btn btn--ghost btn--sm" href="#/wrongbook">查看全部</a>' +
      '</div>' +
      '</div>' +
      '</section>' +

      '<section class="home-section">' +
      '<h2 class="section-title">五个模块，一个闭环</h2>' +
      featureHtml +
      '</section>' +
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
        '<div class="empty-state__icon">🧭</div>' +
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
      '<div class="empty-state__icon">⚠️</div>' +
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
