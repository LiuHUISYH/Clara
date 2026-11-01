/**
 * quiz.js —— 模块 B：课后练习
 * ------------------------------------------------------------------
 * 功能：
 *   - 练习中心：按章节选择练习，或随机抽题、错题巩固
 *   - 答题会话：单选 / 判断 / 填空，即时判分，逐题显示详细解析
 *   - 错题自动入库，重做正确可自动标记“已掌握”
 *   - 会话结束给出成绩单与逐题回顾
 * 对外接口：
 *   CL.quiz.renderIndex()   渲染练习中心
 *   CL.quiz.start(options)  开始一次答题会话
 */
(function (global) {
  'use strict';

  var CL = global.CL = global.CL || {};
  var U = CL.utils;

  // 当前会话（同一时间只允许一个）
  var session = null;

  /* ============================ 判分基础 ============================ */

  /**
   * 判断某题作答是否正确
   * @param {Object} question 题目
   * @param {*} answer 用户答案
   */
  function grade(question, answer) {
    if (answer === undefined || answer === null || answer === '') return false;

    if (question.type === 'single') {
      return Number(answer) === Number(question.answer);
    }
    if (question.type === 'judge') {
      return Boolean(answer) === Boolean(question.answer);
    }
    if (question.type === 'fill') {
      return U.isAnswerMatch(answer, question.answer);
    }
    return false;
  }

  /** 把答案格式化为可读文本 */
  function formatAnswer(question, answer) {
    if (answer === undefined || answer === null || answer === '') return '未作答';

    if (question.type === 'single') {
      var index = Number(answer);
      var text = question.options[index] || '';
      return String.fromCharCode(65 + index) + '. ' + text;
    }
    if (question.type === 'judge') {
      return answer ? '正确' : '错误';
    }
    return String(answer);
  }

  /** 正确答案的可读文本 */
  function correctAnswerText(question) {
    if (question.type === 'single') {
      var index = Number(question.answer);
      return String.fromCharCode(65 + index) + '. ' + (question.options[index] || '');
    }
    if (question.type === 'judge') {
      return question.answer ? '正确' : '错误';
    }
    return (question.answer || []).join(' 或 ');
  }

  /** 题型名称 */
  function typeName(type) {
    return { single: '单选题', judge: '判断题', fill: '填空题' }[type] || '题目';
  }

  /* ============================ 练习中心 ============================ */

  /** 渲染练习中心页面 */
  function renderIndex() {
    var root = U.$('#view-root');
    var attempt = CL.store.attemptStats();
    var wrong = CL.store.wrongStats();

    var chapterCards = CL.data.chapters().map(function (chapter) {
      var questions = CL.data.questionsOf(chapter.id);
      var stats = CL.store.chapterStats(chapter.id);
      var types = questions.reduce(function (acc, item) {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {});

      return '<article class="quiz-chapter-card" style="--chapter-color:' + chapter.color + '">' +
        '<div class="quiz-chapter-card__head">' +
        '<span class="quiz-chapter-card__icon" aria-hidden="true">' + chapter.icon + '</span>' +
        '<div>' +
        '<h3>' + U.escapeHtml(chapter.title) + '</h3>' +
        '<p class="muted">' + U.escapeHtml(chapter.titleEn) + '</p>' +
        '</div>' +
        '</div>' +
        '<div class="quiz-chapter-card__meta">' +
        '<span class="chip">' + questions.length + ' 题</span>' +
        '<span class="chip">单选 ' + (types.single || 0) + '</span>' +
        '<span class="chip">判断 ' + (types.judge || 0) + '</span>' +
        '<span class="chip">填空 ' + (types.fill || 0) + '</span>' +
        '</div>' +
        '<div class="quiz-chapter-card__stats">' +
        '<div><strong>' + stats.attempts + '</strong><span>累计作答</span></div>' +
        '<div><strong>' + stats.accuracy + '%</strong><span>正确率</span></div>' +
        '</div>' +
        '<a class="btn btn--primary btn--block" href="#/quiz/' + chapter.id + '">开始本章练习</a>' +
        '</article>';
    }).join('');

    root.innerHTML =
      '<section class="page page--quiz">' +
      '<header class="page-head">' +
      '<div class="page-head__text">' +
      '<h1 class="page-title">课后练习</h1>' +
      '<p class="page-subtitle">每章 9 道题，覆盖单选、判断与填空；提交后立即判分，做错自动进入错题集。</p>' +
      '</div>' +
      '<div class="page-head__extra"><div class="overview-pill"><strong>' + attempt.accuracy + '%</strong><span>总体正确率</span></div></div>' +
      '</header>' +

      '<div class="quiz-quick">' +
      '<button class="quick-card" id="start-random" type="button">' +
      '<span class="quick-card__icon">🎲</span>' +
      '<span class="quick-card__title">随机练习 10 题</span>' +
      '<span class="quick-card__desc">从全部 ' + CL.data.stats().questions + ' 道题中随机抽取，检验综合水平</span>' +
      '</button>' +
      '<button class="quick-card" id="start-consolidate" type="button">' +
      '<span class="quick-card__icon">🔁</span>' +
      '<span class="quick-card__title">错题再次巩固</span>' +
      '<span class="quick-card__desc">当前有 ' + wrong.pending + ' 道待巩固错题，随机抽取重练</span>' +
      '</button>' +
      '<a class="quick-card" href="#/wrongbook">' +
      '<span class="quick-card__icon">📕</span>' +
      '<span class="quick-card__title">打开错题集</span>' +
      '<span class="quick-card__desc">按章节查看错题、重做与标记已掌握</span>' +
      '</a>' +
      '</div>' +

      '<h2 class="section-title">按章节练习</h2>' +
      '<div class="quiz-chapter-grid">' + chapterCards + '</div>' +

      '<div class="tip-box">' +
      '<strong>练习建议：</strong>先读完本章知识点再做题；做错的题不要只看答案，务必修正“错因”并回到对应知识点复习，然后在错题集中重做一遍。' +
      '</div>' +
      '</section>';

    var randomBtn = U.$('#start-random');
    if (randomBtn) {
      randomBtn.addEventListener('click', function () {
        CL.router.navigate('/quiz/random');
      });
    }

    var consolidateBtn = U.$('#start-consolidate');
    if (consolidateBtn) {
      consolidateBtn.addEventListener('click', function () {
        if (!wrong.pending) {
          U.toast('错题集里没有待巩固的题目，先去练习吧！', 'info');
          return;
        }
        CL.router.navigate('/quiz/consolidate');
      });
    }

    CL.router.setTitle('课后练习');
  }

  /* ============================ 会话创建 ============================ */

  /**
   * 根据选项构建题目列表
   * @param {Object} options
   */
  function buildQuestions(options) {
    if (options.questionIds && options.questionIds.length) {
      return options.questionIds.map(function (id) {
        return CL.data.question(id);
      }).filter(Boolean);
    }

    if (options.mode === 'random') {
      return U.sample(CL.data.allQuestions(), options.limit || 10);
    }

    if (options.mode === 'consolidate') {
      var pending = CL.store.getWrongList({ status: 'pending' }).map(function (item) {
        return CL.data.question(item.questionId) || item.question;
      }).filter(Boolean);
      return U.sample(pending, options.limit || 10);
    }

    if (options.chapterId) {
      return CL.data.questionsOf(options.chapterId).slice();
    }

    return U.sample(CL.data.allQuestions(), options.limit || 10);
  }

  /**
   * 开始一次答题会话
   * @param {Object} options { chapterId, mode, questionIds, title, container, onExit, compact }
   */
  function start(options) {
    options = options || {};

    var questions = buildQuestions(options);
    if (!questions.length) {
      U.toast('没有可用的题目，请先选择章节', 'warn');
      return;
    }

    var chapter = options.chapterId ? CL.data.chapter(options.chapterId) : null;

    session = {
      container: options.container || U.$('#view-root'),
      questions: questions,
      index: 0,
      answers: questions.map(function () { return undefined; }),
      submitted: questions.map(function () { return false; }),
      results: questions.map(function () { return null; }),
      correctCount: 0,
      mode: options.mode || 'chapter',
      chapterId: options.chapterId || '',
      title: options.title || (chapter ? chapter.title + ' · 章节练习' : '综合练习'),
      returnTo: options.returnTo || (options.chapterId ? '#/chapter/' + options.chapterId : '#/quiz'),
      compact: !!options.compact,
      onExit: options.onExit || null,
      startedAt: Date.now()
    };

    renderSession();
  }

  /* ============================ 会话渲染 ============================ */

  /** 渲染整个答题会话 */
  function renderSession() {
    if (!session) return;
    var container = session.container;

    container.innerHTML =
      '<section class="page page--session' + (session.compact ? ' page--compact' : '') + '">' +
      '<header class="session-head">' +
      '<div class="session-head__left">' +
      (session.compact ? '' : '<a class="btn btn--ghost btn--sm" href="' + session.returnTo + '" id="exit-session">← 退出</a>') +
      '<div>' +
      '<h1 class="session-title">' + U.escapeHtml(session.title) + '</h1>' +
      '<p class="session-subtitle" id="session-progress-text"></p>' +
      '</div>' +
      '</div>' +
      '<div class="session-head__right">' +
      '<span class="score-chip" id="score-chip">✓ 0</span>' +
      '<button class="btn btn--ghost btn--sm" id="finish-early" type="button">提前交卷</button>' +
      '</div>' +
      '</header>' +
      '<div class="progress-bar"><div class="progress-bar__fill" id="session-progress-bar"></div></div>' +
      '<div class="session-body">' +
      '<aside class="palette" id="question-palette" aria-label="题目导航"></aside>' +
      '<div class="session-main">' +
      '<div id="question-stage"></div>' +
      '<div class="session-nav">' +
      '<button class="btn btn--ghost" id="prev-question" type="button">← 上一题</button>' +
      '<div class="session-nav__right">' +
      '<button class="btn btn--primary" id="submit-answer" type="button">提交答案</button>' +
      '<button class="btn btn--primary" id="next-question" type="button" hidden>下一题 →</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</section>';

    bindSessionEvents();
    renderQuestion();

    if (!session.compact) {
      CL.router.setTitle(session.title);
    }
  }

  /** 绑定会话级事件（只绑定一次） */
  function bindSessionEvents() {
    var prevBtn = U.$('#prev-question');
    var nextBtn = U.$('#next-question');
    var submitBtn = U.$('#submit-answer');
    var finishBtn = U.$('#finish-early');
    var exitLink = U.$('#exit-session');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (session.index > 0) {
          session.index -= 1;
          renderQuestion();
        } else {
          U.toast('已经是第一题了', 'info');
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (session.index < session.questions.length - 1) {
          session.index += 1;
          renderQuestion();
        } else {
          finish();
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', submitCurrent);
    }

    if (finishBtn) {
      finishBtn.addEventListener('click', function () {
        var unanswered = session.submitted.filter(function (flag) { return !flag; }).length;
        var message = unanswered
          ? '还有 ' + unanswered + ' 题没有提交，确定要提前交卷吗？'
          : '确定要结束本次练习并查看成绩吗？';
        U.confirmDialog(message, { title: '交卷确认', confirmText: '交卷' }).then(function (ok) {
          if (ok) finish();
        });
      });
    }

    if (exitLink) {
      exitLink.addEventListener('click', function (event) {
        var answered = session.submitted.filter(Boolean).length;
        if (answered === 0) return; // 没有作答直接离开
        event.preventDefault();
        U.confirmDialog('退出后本次未提交的作答将丢失，确定退出吗？', {
          title: '退出练习', confirmText: '退出', danger: true
        }).then(function (ok) {
          if (ok) global.location.hash = session.returnTo;
        });
      });
    }
  }

  /** 更新顶部进度与题号面板 */
  function updateProgress() {
    if (!session) return;
    var total = session.questions.length;
    var answered = session.submitted.filter(Boolean).length;

    var progressText = U.$('#session-progress-text');
    if (progressText) {
      progressText.textContent = '第 ' + (session.index + 1) + ' / ' + total + ' 题 · 已提交 ' + answered + ' 题';
    }

    var bar = U.$('#session-progress-bar');
    if (bar) {
      bar.style.width = Math.round((answered / total) * 100) + '%';
    }

    var score = U.$('#score-chip');
    if (score) {
      score.textContent = '✓ ' + session.correctCount;
    }

    var palette = U.$('#question-palette');
    if (palette) {
      palette.innerHTML = '<div class="palette__title">题目导航</div>' +
        '<div class="palette__grid">' +
        session.questions.map(function (item, i) {
          var classes = ['palette__item'];
          if (i === session.index) classes.push('is-current');
          if (session.submitted[i]) {
            classes.push(session.results[i] ? 'is-correct' : 'is-wrong');
          }
          return '<button type="button" class="' + classes.join(' ') + '" data-index="' + i + '" ' +
            'aria-label="第 ' + (i + 1) + ' 题">' + (i + 1) + '</button>';
        }).join('') +
        '</div>' +
        '<div class="palette__legend">' +
        '<span><i class="dot dot--correct"></i>正确</span>' +
        '<span><i class="dot dot--wrong"></i>错误</span>' +
        '<span><i class="dot dot--current"></i>当前</span>' +
        '</div>';

      Array.prototype.forEach.call(palette.querySelectorAll('.palette__item'), function (button) {
        button.addEventListener('click', function () {
          session.index = Number(button.getAttribute('data-index'));
          renderQuestion();
        });
      });
    }
  }

  /** 渲染当前题目 */
  function renderQuestion() {
    if (!session) return;
    var question = session.questions[session.index];
    var submitted = session.submitted[session.index];
    var result = session.results[session.index];
    var answer = session.answers[session.index];
    var stage = U.$('#question-stage');
    if (!stage) return;

    var knowledge = question.knowledgeId ? CL.data.point(question.knowledgeId) : null;
    var chapter = CL.data.chapter(question.chapter);
    var bodyHtml = '';

    if (question.type === 'single') {
      bodyHtml = '<div class="option-list">' +
        question.options.map(function (text, i) {
          var classes = ['option'];
          var isChosen = Number(answer) === i;
          var isCorrect = i === Number(question.answer);
          if (isChosen && !submitted) classes.push('is-selected');
          if (submitted && isCorrect) classes.push('is-correct');
          if (submitted && isChosen && !isCorrect) classes.push('is-wrong');
          if (submitted) classes.push('is-locked');
          return '<button type="button" class="' + classes.join(' ') + '" data-value="' + i + '"' +
            (submitted ? ' disabled' : '') + '>' +
            '<span class="option__label">' + String.fromCharCode(65 + i) + '</span>' +
            '<span class="option__text">' + U.escapeHtml(text) + '</span>' +
            '</button>';
        }).join('') +
        '</div>';
    } else if (question.type === 'judge') {
      bodyHtml = '<div class="option-list option-list--judge">' +
        [true, false].map(function (value) {
          var classes = ['option option--judge'];
          var isChosen = answer === value;
          var isCorrect = Boolean(question.answer) === value;
          if (isChosen && !submitted) classes.push('is-selected');
          if (submitted && isCorrect) classes.push('is-correct');
          if (submitted && isChosen && !isCorrect) classes.push('is-wrong');
          if (submitted) classes.push('is-locked');
          return '<button type="button" class="' + classes.join(' ') + '" data-value="' + (value ? 'true' : 'false') + '"' +
            (submitted ? ' disabled' : '') + '>' +
            '<span class="option__icon">' + (value ? '✓' : '✕') + '</span>' +
            '<span class="option__text">' + (value ? '正确' : '错误') + '</span>' +
            '</button>';
        }).join('') +
        '</div>';
    } else {
      bodyHtml = '<div class="fill-wrap">' +
        '<label class="fill-label" for="fill-answer">请填写答案（支持数字、化学式或文字，不必写单位）</label>' +
        '<input id="fill-answer" class="fill-input" type="text" autocomplete="off" ' +
        'placeholder="在此输入答案…" value="' + U.escapeHtml(answer === undefined ? '' : answer) + '"' +
        (submitted ? ' disabled' : '') + '>' +
        '<p class="fill-hint">例如：0.96、sp³、107、-1.86</p>' +
        '</div>';
    }

    var feedbackHtml = '';
    if (submitted) {
      var isRight = !!result;
      feedbackHtml = '<div class="feedback ' + (isRight ? 'feedback--correct' : 'feedback--wrong') + '">' +
        '<div class="feedback__head">' +
        '<span class="feedback__icon">' + (isRight ? '✅' : '❌') + '</span>' +
        '<strong>' + (isRight ? '回答正确！' : '回答错误') + '</strong>' +
        '</div>' +
        '<div class="feedback__row">' +
        '<span>你的答案：' + U.escapeHtml(formatAnswer(question, answer)) + '</span>' +
        '<span>正确答案：' + U.escapeHtml(correctAnswerText(question)) + '</span>' +
        '</div>' +
        '<div class="feedback__block">' +
        '<h4>📖 详细解析</h4>' +
        '<p>' + U.escapeHtml(question.explanation) + '</p>' +
        '</div>' +
        (!isRight && question.wrongAnalysis ?
          '<div class="feedback__block feedback__block--warn">' +
          '<h4>🔎 错因分析</h4>' +
          '<p>' + U.escapeHtml(question.wrongAnalysis) + '</p>' +
          '</div>' : '') +
        (knowledge ?
          '<div class="feedback__link">相关知识点：' +
          '<a href="#/knowledge/' + knowledge.id + '">' + U.escapeHtml(knowledge.title) + ' →</a>' +
          '</div>' : '') +
        '</div>';
    }

    stage.innerHTML =
      '<article class="question-card" data-question-id="' + question.id + '">' +
      '<div class="question-card__meta">' +
      '<span class="badge badge--type">' + typeName(question.type) + '</span>' +
      '<span class="badge">' + U.escapeHtml(question.difficulty || '基础') + '</span>' +
      (chapter ? '<span class="badge badge--chapter" style="--chapter-color:' + chapter.color + '">' +
        U.escapeHtml(chapter.title) + '</span>' : '') +
      '<span class="question-card__id">' + question.id + '</span>' +
      '</div>' +
      '<h2 class="question-card__stem">' + (session.index + 1) + '. ' + U.escapeHtml(question.question) + '</h2>' +
      bodyHtml +
      feedbackHtml +
      '</article>';

    // 选项点击
    Array.prototype.forEach.call(stage.querySelectorAll('.option'), function (button) {
      button.addEventListener('click', function () {
        if (session.submitted[session.index]) return;
        var value = button.getAttribute('data-value');
        if (question.type === 'judge') {
          session.answers[session.index] = value === 'true';
        } else {
          session.answers[session.index] = Number(value);
        }
        renderQuestion();
      });
    });

    // 填空输入
    var fillInput = U.$('#fill-answer');
    if (fillInput) {
      fillInput.addEventListener('input', function () {
        session.answers[session.index] = fillInput.value;
        updateSubmitState();
      });
      fillInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          submitCurrent();
        }
      });
      if (!submitted) fillInput.focus();
    }

    updateSubmitState();
    updateProgress();
  }

  /** 根据是否已提交切换“提交 / 下一题”按钮 */
  function updateSubmitState() {
    var submitBtn = U.$('#submit-answer');
    var nextBtn = U.$('#next-question');
    if (!submitBtn || !nextBtn) return;

    var submitted = session.submitted[session.index];
    submitBtn.hidden = submitted;
    nextBtn.hidden = !submitted;
    nextBtn.textContent = session.index === session.questions.length - 1 ? '查看成绩 →' : '下一题 →';
  }

  /* ============================ 提交与判分 ============================ */

  /** 提交当前题目 */
  function submitCurrent() {
    if (!session) return;
    var index = session.index;
    if (session.submitted[index]) return;

    var question = session.questions[index];
    var answer = session.answers[index];

    if (answer === undefined || answer === null || answer === '') {
      U.toast('请先作答再提交', 'warn');
      return;
    }

    var correct = grade(question, answer);
    session.submitted[index] = true;
    session.results[index] = correct;
    if (correct) session.correctCount += 1;

    // 记录答题历史（用于统计正确率）
    CL.store.recordAttempt({
      questionId: question.id,
      chapter: question.chapter,
      correct: correct,
      answer: answer,
      mode: session.mode
    });

    if (correct) {
      var wrongItem = CL.store.getWrongItem(question.id);
      if (wrongItem && !wrongItem.mastered) {
        CL.store.markMastered(question.id, true);
        U.toast('答对了！已自动标记为“已掌握”', 'success');
      }
    } else {
      CL.store.addWrong(question, answer);
      U.toast('已加入错题集，请查看解析', 'warn');
    }

    if (CL.app && typeof CL.app.refreshHeader === 'function') CL.app.refreshHeader();
    renderQuestion();
  }

  /* ============================ 成绩单 ============================ */

  /** 结束会话并渲染成绩单 */
  function finish() {
    if (!session) return;
    var total = session.questions.length;
    var answered = session.submitted.filter(Boolean).length;
    var correct = session.correctCount;
    var accuracy = answered ? Math.round((correct / answered) * 100) : 0;
    var minutes = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000));

    var review = session.questions.map(function (question, i) {
      var isSubmitted = session.submitted[i];
      var isRight = !!session.results[i];
      var chapter = CL.data.chapter(question.chapter);
      var knowledge = question.knowledgeId ? CL.data.point(question.knowledgeId) : null;

      return '<li class="review-item ' + (!isSubmitted ? 'is-skipped' : (isRight ? 'is-correct' : 'is-wrong')) + '">' +
        '<div class="review-item__head">' +
        '<span class="review-item__index">' + (i + 1) + '</span>' +
        '<span class="review-item__status">' +
        (!isSubmitted ? '未作答' : (isRight ? '✓ 正确' : '✕ 错误')) + '</span>' +
        '<span class="review-item__chapter">' + U.escapeHtml(chapter ? chapter.title : '') + '</span>' +
        '</div>' +
        '<p class="review-item__question">' + U.escapeHtml(question.question) + '</p>' +
        '<p class="review-item__answer">你的答案：' +
        U.escapeHtml(formatAnswer(question, session.answers[i])) +
        ' ｜ 正确答案：' + U.escapeHtml(correctAnswerText(question)) + '</p>' +
        (knowledge ? '<a class="review-item__link" href="#/knowledge/' + knowledge.id + '">回顾：' +
          U.escapeHtml(knowledge.title) + ' →</a>' : '') +
        '</li>';
    }).join('');

    var wrongCount = answered - correct;
    var resultClass = accuracy >= 80 ? 'excellent' : (accuracy >= 60 ? 'good' : 'need-work');
    var encouragement = accuracy >= 80
      ? '掌握得不错！可以挑战其他章节或随机练习。'
      : (accuracy >= 60 ? '基础已经具备，建议把错题重做一遍再继续。' : '别灰心，先回到知识点重新阅读讲解，再来做一遍错题。');

    session.container.innerHTML =
      '<section class="page page--result">' +
      '<header class="result-head">' +
      '<div class="result-ring ' + resultClass + '">' +
      U.progressRing(accuracy, { size: 132, stroke: 10, color: accuracy >= 80 ? '#10b981' : (accuracy >= 60 ? '#f59e0b' : '#ef4444') }) +
      '</div>' +
      '<div class="result-head__text">' +
      '<span class="eyebrow">练习完成</span>' +
      '<h1>' + U.escapeHtml(session.title) + '</h1>' +
      '<p>' + encouragement + '</p>' +
      '</div>' +
      '</header>' +

      '<div class="result-stats">' +
      '<div class="result-stat"><strong>' + correct + '</strong><span>答对</span></div>' +
      '<div class="result-stat"><strong>' + wrongCount + '</strong><span>答错</span></div>' +
      '<div class="result-stat"><strong>' + (total - answered) + '</strong><span>未作答</span></div>' +
      '<div class="result-stat"><strong>' + minutes + '</strong><span>用时（分钟）</span></div>' +
      '</div>' +

      '<div class="result-actions">' +
      '<button class="btn btn--primary" id="retry-quiz" type="button">再做一次</button>' +
      (wrongCount > 0 ? '<a class="btn btn--ghost" href="#/wrongbook">查看错题集</a>' : '') +
      '<a class="btn btn--ghost" href="' + (session.chapterId ? '#/chapter/' + session.chapterId : '#/chapters') + '">复习知识点</a>' +
      (session.compact ? '<button class="btn btn--ghost" id="close-result" type="button">关闭</button>' :
        '<a class="btn btn--ghost" href="#/quiz">返回练习中心</a>') +
      '</div>' +

      '<h2 class="section-title">逐题回顾</h2>' +
      '<ul class="review-list">' + review + '</ul>' +
      '</section>';

    var retryBtn = U.$('#retry-quiz');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        start({
          chapterId: session.chapterId,
          mode: session.mode,
          questionIds: session.questions.map(function (item) { return item.id; }),
          title: session.title,
          container: session.container,
          compact: session.compact,
          onExit: session.onExit
        });
      });
    }

    var closeBtn = U.$('#close-result');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        if (typeof session.onExit === 'function') session.onExit();
        else U.closeModal();
      });
    }

    if (CL.app && typeof CL.app.refreshHeader === 'function') CL.app.refreshHeader();
    if (!session.compact) {
      CL.router.setTitle('练习结果');
    }
    U.scrollTop();
  }

  CL.quiz = {
    renderIndex: renderIndex,
    start: start,
    grade: grade,
    formatAnswer: formatAnswer,
    correctAnswerText: correctAnswerText,
    typeName: typeName,
    current: function () { return session; }
  };
})(window);
