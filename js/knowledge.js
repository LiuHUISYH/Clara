/**
 * knowledge.js —— 模块 A：知识讲解
 * ------------------------------------------------------------------
 * 负责三个页面：
 *   1. 章节列表（#/chapters）：5 个章节卡片 + 进度 + 搜索
 *   2. 章节详情（#/chapter/:id）：知识点清单 + 学习进度 + 练习入口
 *   3. 知识点详情（#/knowledge/:id）：定义、细致讲解、举例、易错点、小结
 */
(function (global) {
  'use strict';

  var CL = global.CL = global.CL || {};
  var U = CL.utils;

  /* ============================ 公共片段 ============================ */

  /** 面包屑 */
  function breadcrumb(items) {
    return '<nav class="breadcrumb" aria-label="面包屑">' +
      items.map(function (item, index) {
        var isLast = index === items.length - 1;
        var inner = isLast
          ? '<span aria-current="page">' + U.escapeHtml(item.label) + '</span>'
          : '<a href="' + item.href + '">' + U.escapeHtml(item.label) + '</a>';
        return inner + (isLast ? '' : '<span class="breadcrumb__sep">/</span>');
      }).join('') +
      '</nav>';
  }

  /** 页面标题区 */
  function pageHeader(title, subtitle, extra) {
    return '<header class="page-head">' +
      '<div class="page-head__text">' +
      '<h1 class="page-title">' + title + '</h1>' +
      (subtitle ? '<p class="page-subtitle">' + subtitle + '</p>' : '') +
      '</div>' +
      (extra ? '<div class="page-head__extra">' + extra + '</div>' : '') +
      '</header>';
  }

  /* ============================ 章节列表 ============================ */

  /** 渲染章节列表页 */
  function renderChapters() {
    var root = U.$('#view-root');
    var stats = CL.data.stats();
    var readCount = CL.store.readCount();
    var overall = U.percent(readCount, stats.points);
    var attempt = CL.store.attemptStats();

    var cards = CL.data.chapters().map(function (chapter) {
      var points = CL.data.pointsOf(chapter.id);
      var progress = CL.store.chapterProgress(chapter.id, points);
      var quizStats = CL.store.chapterStats(chapter.id);

      return '<article class="chapter-card" style="--chapter-color:' + chapter.color + '">' +
        '<div class="chapter-card__head">' +
        '<span class="chapter-card__icon" aria-hidden="true">' + chapter.icon + '</span>' +
        '<span class="chapter-card__index">第 ' + U.cnNumber(chapter.index) + ' 章</span>' +
        '</div>' +
        '<h2 class="chapter-card__title">' + U.escapeHtml(chapter.title) + '</h2>' +
        '<p class="chapter-card__en">' + U.escapeHtml(chapter.titleEn) + '</p>' +
        '<p class="chapter-card__desc">' + U.escapeHtml(chapter.description) + '</p>' +
        '<div class="chapter-card__meta">' +
        '<span class="chip">' + points.length + ' 个知识点</span>' +
        '<span class="chip">' + CL.data.questionsOf(chapter.id).length + ' 道练习</span>' +
        '<span class="chip chip--soft">' + U.escapeHtml(chapter.examWeight) + '</span>' +
        '</div>' +
        '<div class="chapter-card__progress">' +
        '<div class="chapter-card__ring">' + U.progressRing(progress.percent, { size: 62, color: chapter.color }) + '</div>' +
        '<div class="chapter-card__progress-text">' +
        '<span>已学 ' + progress.read + ' / ' + progress.total + ' 个知识点</span>' +
        '<span class="muted">练习正确率 ' + quizStats.accuracy + '%（' + quizStats.attempts + ' 次作答）</span>' +
        '</div>' +
        '</div>' +
        '<div class="chapter-card__actions">' +
        '<a class="btn btn--primary btn--sm" href="#/chapter/' + chapter.id + '">查看知识点</a>' +
        '<a class="btn btn--ghost btn--sm" href="#/quiz/' + chapter.id + '">开始练习</a>' +
        '</div>' +
        '</article>';
    }).join('');

    root.innerHTML =
      '<section class="page page--chapters">' +
      pageHeader('章节学习',
        '覆盖 AP 化学五大章节，每个知识点都包含定义、细致讲解、举例推导、易错点与小结。',
        '<div class="overview-pill"><strong>' + overall + '%</strong><span>总体学习进度</span></div>') +
      '<div class="stat-strip">' +
      '<div class="stat-strip__item"><strong>' + stats.points + '</strong><span>知识点</span></div>' +
      '<div class="stat-strip__item"><strong>' + stats.questions + '</strong><span>练习题</span></div>' +
      '<div class="stat-strip__item"><strong>' + readCount + '</strong><span>已学完</span></div>' +
      '<div class="stat-strip__item"><strong>' + attempt.accuracy + '%</strong><span>答题正确率</span></div>' +
      '</div>' +
      '<div class="search-bar">' +
      '<span class="search-bar__icon" aria-hidden="true">🔍</span>' +
      '<input id="knowledge-search" type="search" placeholder="搜索知识点，例如：氢键、VSEPR、依数性……" autocomplete="off" aria-label="搜索知识点">' +
      '<button class="btn btn--ghost btn--sm" id="search-clear" type="button" hidden>清除</button>' +
      '</div>' +
      '<div id="search-results" class="search-results" hidden></div>' +
      '<div class="chapter-grid">' + cards + '</div>' +
      '</section>';

    bindSearch();
    CL.router.setTitle('章节学习');
  }

  /** 绑定知识点搜索 */
  function bindSearch() {
    var input = U.$('#knowledge-search');
    var results = U.$('#search-results');
    var clearBtn = U.$('#search-clear');
    if (!input || !results) return;

    function doSearch() {
      var keyword = input.value.trim();
      if (!keyword) {
        results.hidden = true;
        results.innerHTML = '';
        clearBtn.hidden = true;
        return;
      }

      clearBtn.hidden = false;
      var matched = CL.data.searchPoints(keyword);
      results.hidden = false;

      if (!matched.length) {
        results.innerHTML = '<div class="search-results__empty">没有找到匹配的知识点，试试“氢键”“杂化”“晶胞”“依数性”等关键词。</div>';
        return;
      }

      results.innerHTML = '<div class="search-results__head">找到 ' + matched.length + ' 个相关知识点</div>' +
        '<ul class="search-results__list">' +
        matched.map(function (point) {
          var chapter = CL.data.chapter(point.chapter);
          return '<li><a href="#/knowledge/' + point.id + '">' +
            '<span class="search-results__title">' + U.highlight(point.title, keyword) + '</span>' +
            '<span class="search-results__meta">' + U.escapeHtml(chapter ? chapter.title : '') + ' · ' +
            U.escapeHtml(U.truncate(point.definition.cn, 60)) + '</span>' +
            '</a></li>';
        }).join('') +
        '</ul>';
    }

    input.addEventListener('input', U.debounce(doSearch, 180));
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        input.value = '';
        doSearch();
      }
    });
    clearBtn.addEventListener('click', function () {
      input.value = '';
      doSearch();
      input.focus();
    });
  }

  /* ============================ 章节详情 ============================ */

  /** 渲染某一章节的知识点清单 */
  function renderChapter(params) {
    var chapter = CL.data.chapter(params.id);
    var root = U.$('#view-root');

    if (!chapter) {
      root.innerHTML = '<section class="page"><div class="empty-state">' +
        '<div class="empty-state__icon">🔍</div><h2>没有找到该章节</h2>' +
        '<p>请检查链接是否正确，或返回章节列表重新选择。</p>' +
        '<a class="btn btn--primary" href="#/chapters">返回章节列表</a></div></section>';
      return;
    }

    var points = CL.data.pointsOf(chapter.id);
    var progress = CL.store.chapterProgress(chapter.id, points);
    var quizStats = CL.store.chapterStats(chapter.id);
    var chapters = CL.data.chapters();
    var currentIndex = chapters.findIndex(function (item) { return item.id === chapter.id; });
    var prev = chapters[currentIndex - 1];
    var next = chapters[currentIndex + 1];

    var pointCards = points.map(function (point, index) {
      var isRead = CL.store.isPointRead(point.id);
      return '<li class="point-row">' +
        '<span class="point-row__index">' + (index + 1) + '</span>' +
        '<div class="point-row__main">' +
        '<a class="point-row__title" href="#/knowledge/' + point.id + '">' + U.escapeHtml(point.title) + '</a>' +
        '<span class="point-row__en">' + U.escapeHtml(point.titleEn) + '</span>' +
        '<div class="point-row__tags">' +
        (point.tags || []).slice(0, 4).map(function (tag) {
          return '<span class="tag">' + U.escapeHtml(tag) + '</span>';
        }).join('') +
        '</div>' +
        '</div>' +
        '<span class="point-row__status ' + (isRead ? 'is-read' : '') + '">' +
        (isRead ? '✓ 已学' : '未学') + '</span>' +
        '<a class="btn btn--ghost btn--sm" href="#/knowledge/' + point.id + '">' +
        (isRead ? '复习' : '学习') + '</a>' +
        '</li>';
    }).join('');

    root.innerHTML =
      '<section class="page page--chapter" style="--chapter-color:' + chapter.color + '">' +
      breadcrumb([
        { label: '首页', href: '#/home' },
        { label: '章节学习', href: '#/chapters' },
        { label: chapter.title }
      ]) +
      '<header class="chapter-hero">' +
      '<div class="chapter-hero__icon" aria-hidden="true">' + chapter.icon + '</div>' +
      '<div class="chapter-hero__text">' +
      '<span class="chapter-hero__index">第 ' + U.cnNumber(chapter.index) + ' 章 · ' + U.escapeHtml(chapter.examWeight) + '</span>' +
      '<h1>' + U.escapeHtml(chapter.title) + '</h1>' +
      '<p class="chapter-hero__en">' + U.escapeHtml(chapter.titleEn) + '</p>' +
      '<p class="chapter-hero__desc">' + U.escapeHtml(chapter.description) + '</p>' +
      '</div>' +
      '<div class="chapter-hero__progress">' +
      U.progressRing(progress.percent, { size: 92, stroke: 8, color: chapter.color }) +
      '<span>已学 ' + progress.read + ' / ' + progress.total + '</span>' +
      '</div>' +
      '</header>' +
      '<div class="chapter-actions">' +
      '<a class="btn btn--primary" href="#/quiz/' + chapter.id + '">去做本章练习（' +
      CL.data.questionsOf(chapter.id).length + ' 题）</a>' +
      '<span class="muted">本章练习正确率：' + quizStats.accuracy + '%（共 ' + quizStats.attempts + ' 次作答）</span>' +
      '</div>' +
      '<h2 class="section-title">知识点清单</h2>' +
      '<ul class="point-list">' + pointCards + '</ul>' +
      '<nav class="chapter-pager">' +
      (prev ? '<a class="pager-link" href="#/chapter/' + prev.id + '">← ' + U.escapeHtml(prev.title) + '</a>' : '<span></span>') +
      (next ? '<a class="pager-link pager-link--next" href="#/chapter/' + next.id + '">' + U.escapeHtml(next.title) + ' →</a>' : '<span></span>') +
      '</nav>' +
      '</section>';

    CL.router.setTitle(chapter.title);
  }

  /* ============================ 知识点详情 ============================ */

  /** 渲染单个知识点（定义 / 细致讲解 / 举例 / 易错点 / 小结） */
  function renderPoint(params) {
    var point = CL.data.point(params.id);
    var root = U.$('#view-root');

    if (!point) {
      root.innerHTML = '<section class="page"><div class="empty-state">' +
        '<div class="empty-state__icon">📘</div><h2>没有找到该知识点</h2>' +
        '<p>它可能已被移除，或链接有误。</p>' +
        '<a class="btn btn--primary" href="#/chapters">返回章节列表</a></div></section>';
      return;
    }

    var chapter = CL.data.chapter(point.chapter);
    var siblings = CL.data.pointsOf(point.chapter);
    var index = siblings.findIndex(function (item) { return item.id === point.id; });
    var prev = siblings[index - 1];
    var next = siblings[index + 1];

    // 进入页面即记录学习进度（幂等）
    CL.store.markPointRead(point.id);
    var isRead = CL.store.isPointRead(point.id);

    var explanationHtml = (point.explanation || []).map(function (paragraph, i) {
      return '<p class="prose__paragraph" data-paragraph="' + (i + 1) + '">' + U.escapeHtml(paragraph) + '</p>';
    }).join('');

    var examplesHtml = (point.examples || []).map(function (example, i) {
      return '<article class="example-card">' +
        '<h4 class="example-card__title">' + U.escapeHtml(example.title) + '</h4>' +
        '<p class="example-card__content">' + U.escapeHtml(example.content) + '</p>' +
        '<ol class="example-card__steps">' +
        (example.steps || []).map(function (step) {
          return '<li>' + U.escapeHtml(step) + '</li>';
        }).join('') +
        '</ol>' +
        '</article>';
    }).join('');

    var pitfallsHtml = (point.pitfalls || []).map(function (item) {
      return '<li class="pitfall-item"><span class="pitfall-item__icon" aria-hidden="true">⚠️</span>' +
        '<span>' + U.escapeHtml(item) + '</span></li>';
    }).join('');

    var summaryHtml = (point.summary || []).map(function (item, i) {
      return '<div class="summary-card"><span class="summary-card__index">' + (i + 1) + '</span>' +
        '<p>' + U.escapeHtml(item) + '</p></div>';
    }).join('');

    var tagsHtml = (point.tags || []).map(function (tag) {
      return '<span class="tag tag--accent">' + U.escapeHtml(tag) + '</span>';
    }).join('');

    root.innerHTML =
      '<section class="page page--knowledge" style="--chapter-color:' + (chapter ? chapter.color : '#4f7cff') + '">' +
      breadcrumb([
        { label: '首页', href: '#/home' },
        { label: '章节学习', href: '#/chapters' },
        { label: chapter ? chapter.title : '章节', href: '#/chapter/' + point.chapter },
        { label: point.title }
      ]) +
      '<header class="knowledge-head">' +
      '<div class="knowledge-head__meta">' +
      '<span class="pill" style="background:' + (chapter ? chapter.color : '#4f7cff') + '22;color:' + (chapter ? chapter.color : '#4f7cff') + '">' +
      (chapter ? U.escapeHtml(chapter.title) : '') + '</span>' +
      '<span class="chip">第 ' + (index + 1) + ' / ' + siblings.length + ' 个知识点</span>' +
      (isRead ? '<span class="chip chip--success">✓ 已记录学习</span>' : '') +
      '</div>' +
      '<h1 class="knowledge-title">' + U.escapeHtml(point.title) + '</h1>' +
      '<p class="knowledge-title-en">' + U.escapeHtml(point.titleEn) + '</p>' +
      '<div class="knowledge-tags">' + tagsHtml + '</div>' +
      '</header>' +

      '<section class="content-block content-block--definition">' +
      '<h2 class="content-block__title">📌 定义</h2>' +
      '<p class="definition-cn">' + U.escapeHtml(point.definition.cn) + '</p>' +
      '<p class="definition-en" lang="en">' + U.escapeHtml(point.definition.en) + '</p>' +
      '</section>' +

      '<section class="content-block">' +
      '<h2 class="content-block__title">🧠 细致讲解</h2>' +
      '<div class="prose">' + explanationHtml + '</div>' +
      '</section>' +

      '<section class="content-block">' +
      '<h2 class="content-block__title">🔬 举例分析</h2>' +
      examplesHtml +
      '</section>' +

      '<section class="content-block content-block--pitfalls">' +
      '<h2 class="content-block__title">⚠️ 易错点提示</h2>' +
      '<ul class="pitfall-list">' + pitfallsHtml + '</ul>' +
      '</section>' +

      '<section class="content-block">' +
      '<h2 class="content-block__title">🗂️ 小结卡片</h2>' +
      '<div class="summary-grid">' + summaryHtml + '</div>' +
      '</section>' +

      '<footer class="knowledge-footer">' +
      '<div class="knowledge-footer__actions">' +
      '<button class="btn btn--ghost" id="toggle-read" type="button">' +
      (isRead ? '标记为未学' : '标记为已学') + '</button>' +
      '<a class="btn btn--primary" href="#/quiz/' + point.chapter + '">去本章练习</a>' +
      '</div>' +
      '<nav class="knowledge-pager">' +
      (prev ? '<a class="pager-link" href="#/knowledge/' + prev.id + '">← ' + U.escapeHtml(prev.title) + '</a>' : '<span></span>') +
      (next ? '<a class="pager-link pager-link--next" href="#/knowledge/' + next.id + '">' + U.escapeHtml(next.title) + ' →</a>' : '<span></span>') +
      '</nav>' +
      '</footer>' +
      '</section>';

    var toggleBtn = U.$('#toggle-read');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        if (CL.store.isPointRead(point.id)) {
          CL.store.unmarkPointRead(point.id);
          toggleBtn.textContent = '标记为已学';
          U.toast('已取消该知识点的学习标记', 'info');
        } else {
          CL.store.markPointRead(point.id);
          toggleBtn.textContent = '标记为未学';
          U.toast('已记录学习进度', 'success');
        }
        CL.app.refreshHeader();
      });
    }

    CL.router.setTitle(point.title);
    U.scrollTop();
  }

  CL.knowledge = {
    renderChapters: renderChapters,
    renderChapter: renderChapter,
    renderPoint: renderPoint
  };
})(window);
