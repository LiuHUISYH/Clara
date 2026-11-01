/**
 * wrongbook.js —— 模块 C：错题集
 * ------------------------------------------------------------------
 * 功能：
 *   - 按章节分组展示所有错题（localStorage 持久化）
 *   - 支持重做单题（弹窗内嵌练习引擎），答对自动标记“已掌握”
 *   - 支持手动标记 / 取消已掌握、删除错题
 *   - 支持“再次巩固”：随机抽取待巩固错题组成一次练习
 *   - 支持按状态与章节筛选
 */
(function (global) {
  'use strict';

  var CL = global.CL = global.CL || {};
  var U = CL.utils;

  // 当前筛选条件（模块级状态，刷新页面后重置）
  var filters = {
    status: 'all',
    chapter: ''
  };

  /* ============================ 页面渲染 ============================ */

  /** 渲染错题集页面 */
  function render() {
    var root = U.$('#view-root');
    var stats = CL.store.wrongStats();
    var items = CL.store.getWrongList({
      status: filters.status,
      chapter: filters.chapter || undefined
    });

    var chapterOptions = '<option value="">全部章节</option>' +
      CL.data.chapters().map(function (chapter) {
        return '<option value="' + chapter.id + '"' +
          (filters.chapter === chapter.id ? ' selected' : '') + '>' +
          U.escapeHtml(chapter.title) + '</option>';
      }).join('');

    var filtersHtml = '<div class="filter-bar">' +
      '<div class="segmented" role="group" aria-label="按状态筛选">' +
      ['all', 'pending', 'mastered'].map(function (status) {
        var labels = { all: '全部', pending: '待巩固', mastered: '已掌握' };
        return '<button type="button" class="segmented__btn' +
          (filters.status === status ? ' is-active' : '') +
          '" data-status="' + status + '">' + labels[status] + '</button>';
      }).join('') +
      '</div>' +
      '<label class="select-wrap"><span class="sr-only">选择章节</span>' +
      '<select id="wrong-chapter-filter" class="select">' + chapterOptions + '</select></label>' +
      '<button class="btn btn--primary btn--sm" id="start-consolidate-wrong" type="button">' +
      '再次巩固（' + stats.pending + '）</button>' +
      '</div>';

    var bodyHtml;
    if (!items.length) {
      bodyHtml = '<div class="empty-state">' +
        '<div class="empty-state__icon">🎉</div>' +
        '<h2>' + (stats.total ? '当前筛选条件下没有错题' : '错题集是空的') + '</h2>' +
        '<p>' + (stats.total
          ? '试试切换筛选条件，或回到练习继续挑战。'
          : '做错的题会自动收集到这里，方便你集中复习与重做。') + '</p>' +
        '<div class="empty-state__actions">' +
        '<a class="btn btn--primary" href="#/quiz">去练习</a>' +
        (stats.total ? '<button class="btn btn--ghost" id="reset-filter" type="button">清除筛选</button>' : '') +
        '</div>' +
        '</div>';
    } else {
      // 按章节分组
      var groups = {};
      items.forEach(function (item) {
        var key = item.chapter || 'unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });

      bodyHtml = CL.data.chapters().map(function (chapter) {
        var list = groups[chapter.id];
        if (!list || !list.length) return '';
        return '<section class="wrong-group" style="--chapter-color:' + chapter.color + '">' +
          '<header class="wrong-group__head">' +
          '<h2><span class="wrong-group__icon">' + chapter.icon + '</span>' +
          U.escapeHtml(chapter.title) + '</h2>' +
          '<span class="chip">' + list.length + ' 道</span>' +
          '</header>' +
          '<ul class="wrong-list">' +
          list.map(function (item) { return wrongItemHtml(item); }).join('') +
          '</ul>' +
          '</section>';
      }).join('');

      if (groups.unknown) {
        bodyHtml += '<section class="wrong-group"><header class="wrong-group__head"><h2>其他</h2></header>' +
          '<ul class="wrong-list">' + groups.unknown.map(wrongItemHtml).join('') + '</ul></section>';
      }
    }

    root.innerHTML =
      '<section class="page page--wrongbook">' +
      '<header class="page-head">' +
      '<div class="page-head__text">' +
      '<h1 class="page-title">错题集</h1>' +
      '<p class="page-subtitle">做错的题会自动收集到这里。重做答对后会自动标记为“已掌握”，并保留历史记录。</p>' +
      '</div>' +
      '<div class="page-head__extra">' +
      '<div class="overview-pill"><strong>' + stats.pending + '</strong><span>待巩固错题</span></div>' +
      '</div>' +
      '</header>' +

      '<div class="stat-strip">' +
      '<div class="stat-strip__item"><strong>' + stats.total + '</strong><span>错题总数</span></div>' +
      '<div class="stat-strip__item"><strong>' + stats.pending + '</strong><span>待巩固</span></div>' +
      '<div class="stat-strip__item"><strong>' + stats.mastered + '</strong><span>已掌握</span></div>' +
      '<div class="stat-strip__item"><strong>' + CL.store.attemptStats().accuracy + '%</strong><span>总体正确率</span></div>' +
      '</div>' +

      filtersHtml +
      bodyHtml +

      (stats.total ?
        '<footer class="wrong-footer">' +
        '<button class="btn btn--ghost btn--sm" id="export-wrong" type="button">导出学习数据</button>' +
        '<button class="btn btn--danger btn--sm" id="clear-wrong" type="button">清空错题集</button>' +
        '<span class="muted">错题数据保存在本机浏览器中（localStorage），不会上传到任何服务器。</span>' +
        '</footer>' : '') +
      '</section>';

    bindEvents();
    CL.router.setTitle('错题集');
  }

  /** 单条错题卡片 */
  function wrongItemHtml(item) {
    var question = CL.data.question(item.questionId) || item.question;
    var knowledge = item.knowledgeId ? CL.data.point(item.knowledgeId) : null;
    var questionText = question ? question.question : '（题目数据缺失）';

    return '<li class="wrong-item ' + (item.mastered ? 'is-mastered' : '') + '" data-id="' + item.questionId + '">' +
      '<div class="wrong-item__head">' +
      '<span class="wrong-item__status">' + (item.mastered ? '✓ 已掌握' : '待巩固') + '</span>' +
      '<span class="wrong-item__count">答错 ' + item.wrongCount + ' 次</span>' +
      '<span class="wrong-item__time">' + U.relativeTime(item.lastWrongAt) + '</span>' +
      '</div>' +
      '<p class="wrong-item__question">' + U.escapeHtml(U.truncate(questionText, 120)) + '</p>' +
      '<div class="wrong-item__meta">' +
      (question ? '<span class="chip">' + CL.quiz.typeName(question.type) + '</span>' : '') +
      (knowledge ? '<a class="chip chip--link" href="#/knowledge/' + knowledge.id + '">' +
        U.escapeHtml(knowledge.title) + '</a>' : '') +
      '<span class="muted">首次答错：' + U.formatTime(item.firstWrongAt).slice(0, 10) + '</span>' +
      '</div>' +
      '<div class="wrong-item__actions">' +
      '<button class="btn btn--primary btn--sm" data-action="redo" type="button">重做</button>' +
      '<button class="btn btn--ghost btn--sm" data-action="master" type="button">' +
      (item.mastered ? '取消已掌握' : '标记已掌握') + '</button>' +
      '<button class="btn btn--ghost btn--sm btn--danger-text" data-action="remove" type="button">移除</button>' +
      '</div>' +
      '</li>';
  }

  /* ============================ 交互事件 ============================ */

  /** 绑定筛选、清空、导出与单题操作 */
  function bindEvents() {
    // 状态筛选
    Array.prototype.forEach.call(U.$$('.segmented__btn'), function (button) {
      button.addEventListener('click', function () {
        filters.status = button.getAttribute('data-status');
        render();
      });
    });

    // 章节筛选
    var select = U.$('#wrong-chapter-filter');
    if (select) {
      select.addEventListener('change', function () {
        filters.chapter = select.value;
        render();
      });
    }

    // 再次巩固
    var consolidateBtn = U.$('#start-consolidate-wrong');
    if (consolidateBtn) {
      consolidateBtn.addEventListener('click', function () {
        var stats = CL.store.wrongStats();
        if (!stats.pending) {
          U.toast('没有待巩固的错题，先去做几道新题吧', 'info');
          return;
        }
        CL.router.navigate('/quiz/consolidate');
      });
    }

    // 清除筛选
    var resetBtn = U.$('#reset-filter');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        filters.status = 'all';
        filters.chapter = '';
        render();
      });
    }

    // 清空错题集
    var clearBtn = U.$('#clear-wrong');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        U.confirmDialog('确定要清空全部错题吗？此操作不可恢复，已掌握记录也会一并删除。', {
          title: '清空错题集', confirmText: '全部清空', danger: true
        }).then(function (ok) {
          if (!ok) return;
          CL.store.clearWrong();
          U.toast('错题集已清空', 'success');
          render();
          if (CL.app) CL.app.refreshHeader();
        });
      });
    }

    // 导出学习数据
    var exportBtn = U.$('#export-wrong');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var data = CL.store.exportAll();
        U.download('chemlearn-backup-' + U.formatTime(Date.now()).replace(/[: ]/g, '-') + '.json',
          JSON.stringify(data, null, 2));
        U.toast('已导出学习数据备份', 'success');
      });
    }

    // 单题操作（事件委托）
    var root = U.$('#view-root');
    if (root && !root.dataset.boundWrongbook) {
      root.dataset.boundWrongbook = '1';
      U.delegate(root, 'click', '[data-action]', function (event, button) {
        var itemNode = button.closest('.wrong-item');
        if (!itemNode) return;
        var questionId = itemNode.getAttribute('data-id');
        var action = button.getAttribute('data-action');

        if (action === 'redo') {
          redoItem(questionId);
        } else if (action === 'master') {
          var item = CL.store.getWrongItem(questionId);
          if (!item) return;
          CL.store.markMastered(questionId, !item.mastered);
          U.toast(item.mastered ? '已取消“已掌握”标记' : '已标记为“已掌握”', 'success');
          render();
          if (CL.app) CL.app.refreshHeader();
        } else if (action === 'remove') {
          U.confirmDialog('确定要从错题集中移除这道题吗？', {
            title: '移除错题', confirmText: '移除', danger: true
          }).then(function (ok) {
            if (!ok) return;
            CL.store.removeWrong(questionId);
            U.toast('已移除该错题', 'info');
            render();
            if (CL.app) CL.app.refreshHeader();
          });
        }
      });
    }
  }

  /* ============================ 错题重做 ============================ */

  /**
   * 在弹窗中重做一道错题
   * @param {string} questionId
   */
  function redoItem(questionId) {
    var question = CL.data.question(questionId);
    if (!question) {
      U.toast('题目数据缺失，无法重做', 'error');
      return;
    }

    var body = U.el('div', { class: 'redo-body' });
    U.openModal({
      title: '错题重做 · ' + question.id,
      body: body,
      width: '860px',
      onClose: function () {
        render();
      }
    });

    CL.quiz.start({
      questionIds: [question.id],
      mode: 'redo',
      title: '错题重做',
      container: body,
      compact: true,
      onExit: function () {
        U.closeModal();
      }
    });
  }

  CL.wrongbook = {
    render: render,
    redo: redoItem
  };
})(window);
