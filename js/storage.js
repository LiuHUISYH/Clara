/**
 * storage.js —— 本地数据持久化
 * ------------------------------------------------------------------
 * 使用 localStorage 保存学习进度、错题本、答题记录与设置。
 * 所有 key 统一加上 "chemlearn.v1." 前缀，避免与其它页面冲突。
 * 读取失败（例如浏览器禁用 localStorage）时回退到内存数据，
 * 保证页面仍然可以正常使用，只是刷新后数据丢失。
 */
(function (global) {
  'use strict';

  var CL = global.CL = global.CL || {};

  var PREFIX = 'chemlearn.v1.';
  var KEYS = {
    progress: PREFIX + 'progress',
    wrongbook: PREFIX + 'wrongbook',
    attempts: PREFIX + 'attempts',
    settings: PREFIX + 'settings'
  };

  var MAX_ATTEMPTS = 400;

  // 内存回退（localStorage 不可用时使用）
  var memory = {};

  /** 读取 JSON，失败时返回默认值 */
  function read(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (raw === null || raw === undefined) {
        if (Object.prototype.hasOwnProperty.call(memory, key)) return memory[key];
        return fallback;
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('[storage] 读取失败：', key, error);
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback;
    }
  }

  /** 写入 JSON，返回是否成功 */
  function write(key, value) {
    memory[key] = value;
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[storage] 写入失败（可能已超出配额或禁用存储）：', key, error);
      return false;
    }
  }

  /** 删除某个 key */
  function remove(key) {
    delete memory[key];
    try {
      global.localStorage.removeItem(key);
    } catch (error) {
      console.warn('[storage] 删除失败：', key, error);
    }
  }

  /** 生成默认的进度结构 */
  function defaultProgress() {
    return {
      version: 1,
      knowledgeRead: {},   // { pointId: timestamp }
      quizStats: {},       // { chapterId: { attempts, correct } }
      lastVisit: null,
      createdAt: Date.now()
    };
  }

  /** 生成默认设置 */
  function defaultSettings() {
    return {
      autoRotate: true,
      showLabels: true,
      reduceMotion: false
    };
  }

  var store = {
    KEYS: KEYS,

    /** 初始化：确保结构存在 */
    init: function () {
      var progress = read(KEYS.progress, null);
      if (!progress || typeof progress !== 'object') {
        write(KEYS.progress, defaultProgress());
      } else if (!progress.knowledgeRead || !progress.quizStats) {
        write(KEYS.progress, Object.assign(defaultProgress(), progress));
      }

      if (!Array.isArray(read(KEYS.wrongbook, null))) {
        write(KEYS.wrongbook, []);
      }
      if (!Array.isArray(read(KEYS.attempts, null))) {
        write(KEYS.attempts, []);
      }
      var settings = read(KEYS.settings, null);
      if (!settings || typeof settings !== 'object') {
        write(KEYS.settings, defaultSettings());
      }

      var prog = read(KEYS.progress, defaultProgress());
      prog.lastVisit = Date.now();
      write(KEYS.progress, prog);
      return store;
    },

    /* ======================== 学习进度 ======================== */

    getProgress: function () {
      return read(KEYS.progress, defaultProgress());
    },

    /**
     * 标记知识点已学习
     * @param {string} pointId
     */
    markPointRead: function (pointId) {
      var progress = store.getProgress();
      if (!progress.knowledgeRead[pointId]) {
        progress.knowledgeRead[pointId] = Date.now();
        write(KEYS.progress, progress);
        return true;
      }
      return false;
    },

    /** 取消已读标记 */
    unmarkPointRead: function (pointId) {
      var progress = store.getProgress();
      if (progress.knowledgeRead[pointId]) {
        delete progress.knowledgeRead[pointId];
        write(KEYS.progress, progress);
        return true;
      }
      return false;
    },

    isPointRead: function (pointId) {
      return !!store.getProgress().knowledgeRead[pointId];
    },

    /** 已读知识点数量 */
    readCount: function () {
      return Object.keys(store.getProgress().knowledgeRead).length;
    },

    /**
     * 章节学习进度
     * @param {string} chapterId
     * @param {Array<{id:string}>} points 该章节知识点
     * @returns {{read:number,total:number,percent:number}}
     */
    chapterProgress: function (chapterId, points) {
      var progress = store.getProgress();
      var read = 0;
      (points || []).forEach(function (point) {
        if (progress.knowledgeRead[point.id]) read += 1;
      });
      var total = (points || []).length;
      return {
        read: read,
        total: total,
        percent: total ? Math.round((read / total) * 100) : 0
      };
    },

    /* ======================== 答题记录 ======================== */

    /**
     * 记录一次答题
     * @param {Object} payload { questionId, chapter, correct, answer, mode }
     */
    recordAttempt: function (payload) {
      var attempts = read(KEYS.attempts, []);
      var record = {
        questionId: payload.questionId,
        chapter: payload.chapter || '',
        correct: !!payload.correct,
        answer: payload.answer === undefined ? null : payload.answer,
        mode: payload.mode || 'chapter',
        at: Date.now()
      };
      attempts.push(record);
      if (attempts.length > MAX_ATTEMPTS) {
        attempts = attempts.slice(attempts.length - MAX_ATTEMPTS);
      }
      write(KEYS.attempts, attempts);

      // 更新章节统计
      var progress = store.getProgress();
      var key = record.chapter || 'unknown';
      if (!progress.quizStats[key]) progress.quizStats[key] = { attempts: 0, correct: 0 };
      progress.quizStats[key].attempts += 1;
      if (record.correct) progress.quizStats[key].correct += 1;
      write(KEYS.progress, progress);

      return record;
    },

    getAttempts: function () {
      return read(KEYS.attempts, []);
    },

    /** 总体答题统计 */
    attemptStats: function () {
      var list = store.getAttempts();
      var correct = list.filter(function (item) { return item.correct; }).length;
      return {
        total: list.length,
        correct: correct,
        accuracy: list.length ? Math.round((correct / list.length) * 100) : 0
      };
    },

    /** 某章节答题统计 */
    chapterStats: function (chapterId) {
      var stats = store.getProgress().quizStats[chapterId] || { attempts: 0, correct: 0 };
      return {
        attempts: stats.attempts,
        correct: stats.correct,
        accuracy: stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0
      };
    },

    /* ======================== 错题本 ======================== */

    /**
     * 记录一道错题（已存在则累加错误次数并重新激活）
     * @param {Object} question 题目对象
     * @param {*} answer 用户答案
     */
    addWrong: function (question, answer) {
      var list = read(KEYS.wrongbook, []);
      var index = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i].questionId === question.id) {
          index = i;
          break;
        }
      }

      var now = Date.now();
      if (index >= 0) {
        var item = list[index];
        item.wrongCount += 1;
        item.lastWrongAt = now;
        item.mastered = false;
        item.masteredAt = null;
        item.question = question; // 同步最新题目内容
        item.history = (item.history || []).concat([{ at: now, answer: answer === undefined ? null : answer }]);
        if (item.history.length > 20) item.history = item.history.slice(item.history.length - 20);
        list[index] = item;
        write(KEYS.wrongbook, list);
        return item;
      }

      var record = {
        questionId: question.id,
        chapter: question.chapter || '',
        knowledgeId: question.knowledgeId || '',
        question: question,
        wrongCount: 1,
        firstWrongAt: now,
        lastWrongAt: now,
        mastered: false,
        masteredAt: null,
        history: [{ at: now, answer: answer === undefined ? null : answer }]
      };
      list.push(record);
      write(KEYS.wrongbook, list);
      return record;
    },

    /**
     * 获取错题列表
     * @param {Object} [options] { chapter, status: 'all'|'pending'|'mastered', limit }
     */
    getWrongList: function (options) {
      options = options || {};
      var list = read(KEYS.wrongbook, []).filter(function (item) {
        if (options.chapter && item.chapter !== options.chapter) return false;
        if (options.status === 'pending' && item.mastered) return false;
        if (options.status === 'mastered' && !item.mastered) return false;
        return true;
      });

      list.sort(function (a, b) {
        return (b.lastWrongAt || 0) - (a.lastWrongAt || 0);
      });

      if (options.limit) return list.slice(0, options.limit);
      return list;
    },

    getWrongItem: function (questionId) {
      var list = read(KEYS.wrongbook, []);
      for (var i = 0; i < list.length; i++) {
        if (list[i].questionId === questionId) return list[i];
      }
      return null;
    },

    /** 标记 / 取消“已掌握” */
    markMastered: function (questionId, mastered) {
      var list = read(KEYS.wrongbook, []);
      for (var i = 0; i < list.length; i++) {
        if (list[i].questionId === questionId) {
          list[i].mastered = mastered !== false;
          list[i].masteredAt = mastered !== false ? Date.now() : null;
          write(KEYS.wrongbook, list);
          return list[i];
        }
      }
      return null;
    },

    /** 从错题本移除 */
    removeWrong: function (questionId) {
      var list = read(KEYS.wrongbook, []);
      var next = list.filter(function (item) { return item.questionId !== questionId; });
      write(KEYS.wrongbook, next);
      return list.length !== next.length;
    },

    /** 清空错题本 */
    clearWrong: function () {
      write(KEYS.wrongbook, []);
    },

    /** 错题统计 */
    wrongStats: function () {
      var list = read(KEYS.wrongbook, []);
      var mastered = list.filter(function (item) { return item.mastered; }).length;
      return {
        total: list.length,
        mastered: mastered,
        pending: list.length - mastered
      };
    },

    /* ======================== 设置 ======================== */

    getSettings: function () {
      return read(KEYS.settings, defaultSettings());
    },

    updateSettings: function (patch) {
      var settings = Object.assign(defaultSettings(), store.getSettings(), patch || {});
      write(KEYS.settings, settings);
      return settings;
    },

    /* ======================== 导入 / 导出 ======================== */

    /** 导出全部学习数据（用于备份） */
    exportAll: function () {
      return {
        app: 'ChemLearn',
        version: 1,
        exportedAt: new Date().toISOString(),
        progress: store.getProgress(),
        wrongbook: store.getWrongList(),
        attempts: store.getAttempts(),
        settings: store.getSettings()
      };
    },

    /**
     * 导入备份数据
     * @param {string|Object} payload JSON 字符串或对象
     */
    importAll: function (payload) {
      var data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!data || data.app !== 'ChemLearn') {
        throw new Error('文件格式不正确：缺少 ChemLearn 标识');
      }
      if (data.progress) write(KEYS.progress, data.progress);
      if (Array.isArray(data.wrongbook)) write(KEYS.wrongbook, data.wrongbook);
      if (Array.isArray(data.attempts)) write(KEYS.attempts, data.attempts);
      if (data.settings) write(KEYS.settings, data.settings);
      return true;
    },

    /** 清除全部数据（恢复初始状态） */
    resetAll: function () {
      Object.keys(KEYS).forEach(function (name) {
        remove(KEYS[name]);
      });
      store.init();
    }
  };

  CL.store = store;
})(window);
