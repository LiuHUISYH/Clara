/**
 * knowledge.js —— 模块 A：知识讲解
 * ------------------------------------------------------------------
 * 负责三个页面：
 *   1. 章节列表（#/chapters）：5 个章节行 + 进度 + 搜索
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

    var rows = CL.data.chapters().map(function (chapter) {
      var points = CL.data.pointsOf(chapter.id);
      var progress = CL.store.chapterProgress(chapter.id, points);
      var questionCount = CL.data.questionsOf(chapter.id).length;

      return '<li>' +
        '<a class="chapter-row" href="#/chapter/' + chapter.id + '">' +
        '<span class="chapter-row__index" aria-hidden="true">' +
        (chapter.index < 10 ? '0' : '') + chapter.index + '</span>' +
        '<span class="chapter-row__main">' +
        '<span class="chapter-row__title">' + U.escapeHtml(chapter.title) + '</span>' +
        '<span class="chapter-row__en">' + U.escapeHtml(chapter.titleEn) + '</span>' +
        '<span class="chapter-row__desc">' + U.escapeHtml(chapter.description) + '</span>' +
        '</span>' +
        '<span class="chapter-row__meta">' +
        '<span>' + points.length + ' 个知识点</span>' +
        '<span>' + questionCount + ' 道练习</span>' +
        '<span>' + U.escapeHtml(chapter.examWeight) + '</span>' +
        '</span>' +
        '<span class="chapter-row__progress">' +
        '<span class="chapter-row__percent">' + progress.percent + '%</span>' +
        '<span class="meter"><span class="meter__fill" style="width:' + progress.percent +
        '%"></span></span>' +
        '<span class="chapter-row__read">已学 ' + progress.read + ' / ' + progress.total + '</span>' +
        '</span>' +
        '<span class="chapter-row__arrow" aria-hidden="true">→</span>' +
        '</a>' +
        '</li>';
    }).join('');

    root.innerHTML =
      '<section class="page page--chapters">' +
      pageHeader('章节学习',
        stats.chapters + ' 个章节 · ' + stats.points + ' 个知识点 · ' + stats.questions +
        ' 道练习 · 已学 ' + readCount + ' / ' + stats.points + '（' + overall +
        '%）· 答题正确率 ' + attempt.accuracy + '%') +
      '<div class="search-bar search-bar--line">' +
      '<span class="search-bar__icon" aria-hidden="true">' + U.icon('search') + '</span>' +
      '<input id="knowledge-search" type="search" placeholder="搜索知识点，例如：氢键、VSEPR、依数性……" autocomplete="off" aria-label="搜索知识点">' +
      '<button class="btn btn--ghost btn--sm" id="search-clear" type="button" hidden>清除</button>' +
      '</div>' +
      '<div id="search-results" class="search-results" hidden></div>' +
      '<ul class="chapter-list">' + rows + '</ul>' +
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
        '<div class="empty-state__icon">' + U.icon('search') + '</div><h2>没有找到该章节</h2>' +
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

    var pointRows = points.map(function (point, index) {
      var isRead = CL.store.isPointRead(point.id);
      return '<li>' +
        '<a class="point-row" href="#/knowledge/' + point.id + '">' +
        '<span class="point-row__index" aria-hidden="true">' +
        (index < 9 ? '0' : '') + (index + 1) + '</span>' +
        '<span class="point-row__main">' +
        '<span class="point-row__title">' + U.escapeHtml(point.title) + '</span>' +
        '<span class="point-row__en">' + U.escapeHtml(point.titleEn) + '</span>' +
        '</span>' +
        '<span class="point-row__status ' + (isRead ? 'is-read' : '') + '">' +
        (isRead ? '已学' : '未学') + '</span>' +
        '<span class="point-row__arrow" aria-hidden="true">→</span>' +
        '</a>' +
        '</li>';
    }).join('');

    root.innerHTML =
      '<section class="page page--chapter">' +
      breadcrumb([
        { label: '首页', href: '#/home' },
        { label: '章节学习', href: '#/chapters' },
        { label: chapter.title }
      ]) +
      '<header class="chapter-head">' +
      '<div class="chapter-head__text">' +
      '<p class="eyebrow">第 ' + U.cnNumber(chapter.index) + ' 章 · 考试占比 ' +
      U.escapeHtml(chapter.examWeight) + '</p>' +
      '<h1 class="chapter-head__title">' + U.escapeHtml(chapter.title) + '</h1>' +
      '<p class="chapter-head__en">' + U.escapeHtml(chapter.titleEn) + '</p>' +
      '<p class="chapter-head__desc">' + U.escapeHtml(chapter.description) + '</p>' +
      '<p class="chapter-head__meta">' + points.length + ' 个知识点 · ' +
      CL.data.questionsOf(chapter.id).length + ' 道练习 · 练习正确率 ' +
      quizStats.accuracy + '%（' + quizStats.attempts + ' 次作答）</p>' +
      '</div>' +
      '<div class="chapter-head__aside">' +
      '<span class="chapter-head__percent">' + progress.percent + '%</span>' +
      '<span class="meter chapter-head__meter"><span class="meter__fill" style="width:' +
      progress.percent + '%"></span></span>' +
      '<span class="chapter-head__read">已学 ' + progress.read + ' / ' + progress.total + '</span>' +
      '<a class="text-link" href="#/quiz/' + chapter.id + '">去做本章练习 →</a>' +
      '</div>' +
      '</header>' +
      '<div class="section-head">' +
      '<h2 class="section-title">知识点清单</h2>' +
      '<span class="section-head__meta">共 ' + points.length + ' 节</span>' +
      '</div>' +
      '<ul class="point-list">' + pointRows + '</ul>' +
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
        '<div class="empty-state__icon">' + U.icon('book') + '</div><h2>没有找到该知识点</h2>' +
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

    var examplesHtml = (point.examples || []).map(function (example) {
      return '<article class="example-item">' +
        '<h3 class="example-item__title">' + U.escapeHtml(example.title) + '</h3>' +
        '<p class="example-item__content">' + U.escapeHtml(example.content) + '</p>' +
        '<ol class="example-item__steps">' +
        (example.steps || []).map(function (step) {
          return '<li>' + U.escapeHtml(step) + '</li>';
        }).join('') +
        '</ol>' +
        '</article>';
    }).join('');

    var pitfallsHtml = (point.pitfalls || []).map(function (item) {
      return '<li class="pitfall-item"><span class="pitfall-item__icon" aria-hidden="true">' +
        U.icon('alert') + '</span>' +
        '<span>' + U.escapeHtml(item) + '</span></li>';
    }).join('');

    var summaryHtml = (point.summary || []).map(function (item, i) {
      return '<li class="summary-item"><span class="summary-item__index">' +
        (i < 9 ? '0' : '') + (i + 1) + '</span>' +
        '<p>' + U.escapeHtml(item) + '</p></li>';
    }).join('');

    var tagsHtml = (point.tags || []).map(function (tag) {
      return '<span class="tag">' + U.escapeHtml(tag) + '</span>';
    }).join('');

    root.innerHTML =
      '<section class="page page--knowledge">' +
      breadcrumb([
        { label: '首页', href: '#/home' },
        { label: '章节学习', href: '#/chapters' },
        { label: chapter ? chapter.title : '章节', href: '#/chapter/' + point.chapter },
        { label: point.title }
      ]) +
      '<article class="knowledge-article">' +
      '<header class="knowledge-head">' +
      '<p class="knowledge-head__meta">' +
      '<span>' + (chapter ? U.escapeHtml(chapter.title) : '章节') + '</span>' +
      '<span>第 ' + (index + 1) + ' / ' + siblings.length + ' 节</span>' +
      (isRead ? '<span class="knowledge-head__read">已学</span>' : '') +
      '</p>' +
      '<h1 class="knowledge-title">' + U.escapeHtml(point.title) + '</h1>' +
      '<p class="knowledge-title-en">' + U.escapeHtml(point.titleEn) + '</p>' +
      '<div class="knowledge-tags">' + tagsHtml + '</div>' +
      '</header>' +

      '<section class="knowledge-section knowledge-section--lead">' +
      '<h2>定义</h2>' +
      '<p class="definition-cn">' + U.escapeHtml(point.definition.cn) + '</p>' +
      '<p class="definition-en" lang="en">' + U.escapeHtml(point.definition.en) + '</p>' +
      '</section>' +

      '<section class="knowledge-section">' +
      '<h2>细致讲解</h2>' +
      '<div class="prose">' + explanationHtml + '</div>' +
      '</section>' +

      '<section class="knowledge-section">' +
      '<h2>举例分析</h2>' +
      '<div class="example-list">' + examplesHtml + '</div>' +
      '</section>' +

      '<section class="knowledge-section knowledge-section--pitfalls">' +
      '<h2>易错点</h2>' +
      '<ul class="pitfall-list">' + pitfallsHtml + '</ul>' +
      '</section>' +

      '<section class="knowledge-section">' +
      '<h2>小结</h2>' +
      '<ol class="summary-list">' + summaryHtml + '</ol>' +
      '</section>' +

      '<footer class="knowledge-footer">' +
      '<div class="knowledge-footer__actions">' +
      '<button class="btn btn--ghost btn--sm" id="toggle-read" type="button">' +
      (isRead ? '标记为未学' : '标记为已学') + '</button>' +
      '<a class="text-link" href="#/quiz/' + point.chapter + '">去本章练习 →</a>' +
      '</div>' +
      '<nav class="knowledge-pager">' +
      (prev ? '<a class="pager-link" href="#/knowledge/' + prev.id + '">← 上一节：' + U.escapeHtml(prev.title) + '</a>' : '<span></span>') +
      (next ? '<a class="pager-link pager-link--next" href="#/knowledge/' + next.id + '">下一节：' + U.escapeHtml(next.title) + ' →</a>' : '<span></span>') +
      '</nav>' +
      '</footer>' +
      '</article>' +
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
