/**
 * data.js —— 数据加载与索引
 * ------------------------------------------------------------------
 * 数据源有两份：
 *   1. data/*.json —— 标准 JSON，便于阅读与校验（推荐用本地服务器访问）
 *   2. data/*.js  —— 由 tools/build_data.py 生成的包装文件，把同样的 JSON
 *                    挂到 window.CHEM_DATA 上，保证双击 index.html 也能运行
 * 加载策略：优先使用 window.CHEM_DATA（同步、无 CORS 问题），
 *          若不存在再尝试 fetch JSON。
 */
(function (global) {
  'use strict';

  var CL = global.CL = global.CL || {};

  var FILES = {
    knowledge: 'data/knowledge.json',
    quiz: 'data/quiz.json',
    molecules: 'data/molecules.json',
    nameMap: 'data/nameMap.json',
    equations: 'data/equations.json'
  };

  var state = {
    loaded: false,
    source: '',
    knowledge: null,
    quiz: null,
    molecules: null,
    nameMap: null,
    equations: null
  };

  var index = {
    chapters: {},
    points: {},
    pointsByChapter: {},
    questions: {},
    questionsByChapter: {},
    moleculesByFormula: {},
    moleculeByName: {},
    equationsById: {}
  };

  /* ============================ 工具 ============================ */

  /**
   * 标准化化学式：下标转数字、去掉空格与状态符号、统一大小写
   * 例如 "h₂o" → "H2O"，"NH4+" → "NH4+"
   */
  function normalizeFormula(input) {
    if (!input) return '';
    var text = String(input).trim();

    // 下标数字转普通数字
    var subscripts = '₀₁₂₃₄₅₆₇₈₉';
    text = text.replace(/[₀-₉]/g, function (ch) {
      return String(subscripts.indexOf(ch));
    });

    // 上标电荷：⁺ → +，⁻ → -
    text = text.replace(/⁺/g, '+').replace(/⁻/g, '-');

    // 去掉空格与括号中的状态符号
    text = text.replace(/[\s（(].*?[)）]/g, '').replace(/\s+/g, '');

    // 元素符号首字母大写、第二个字母小写
    text = text.replace(/([a-zA-Z]{1,2})/g, function (symbol) {
      return symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase();
    });

    return text;
  }

  /** 标准化名称（去空格、转小写） */
  function normalizeName(input) {
    return String(input || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  /** 从 window.CHEM_DATA 读取 */
  function fromWindow(key) {
    return global.CHEM_DATA && global.CHEM_DATA[key] ? global.CHEM_DATA[key] : null;
  }

  /** 通过 fetch 读取 JSON */
  function fetchJSON(path) {
    return fetch(path, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('加载失败：' + path + '（HTTP ' + response.status + '）');
      return response.json();
    });
  }

  /* ============================ 建立索引 ============================ */

  function buildIndexes() {
    // 章节
    (state.knowledge.chapters || []).forEach(function (chapter) {
      index.chapters[chapter.id] = chapter;
    });

    // 知识点
    (state.knowledge.points || []).forEach(function (point) {
      index.points[point.id] = point;
      if (!index.pointsByChapter[point.chapter]) index.pointsByChapter[point.chapter] = [];
      index.pointsByChapter[point.chapter].push(point);
    });

    // 题目
    (state.quiz.questions || []).forEach(function (question) {
      index.questions[question.id] = question;
      if (!index.questionsByChapter[question.chapter]) index.questionsByChapter[question.chapter] = [];
      index.questionsByChapter[question.chapter].push(question);
    });

    // 分子：化学式、名称、别名都建索引
    (state.molecules.molecules || []).forEach(function (molecule) {
      index.moleculesByFormula[normalizeFormula(molecule.formula)] = molecule;
      (molecule.names || []).forEach(function (name) {
        index.moleculeByName[normalizeName(name)] = molecule;
      });
      index.moleculeByName[normalizeName(molecule.formula)] = molecule;
    });

    // 名称映射表中的别名也指向对应分子（没有 3D 模型的返回 null）
    (state.nameMap.entries || []).forEach(function (entry) {
      var molecule = index.moleculesByFormula[normalizeFormula(entry.formula)] || null;
      var names = [entry.name].concat(entry.aliases || []);
      names.forEach(function (name) {
        var key = normalizeName(name);
        if (!index.moleculeByName[key]) index.moleculeByName[key] = molecule;
      });
    });

    // 方程式
    (state.equations.equations || []).forEach(function (equation) {
      index.equationsById[equation.id] = equation;
    });
  }

  /* ============================ 加载入口 ============================ */

  /**
   * 初始化数据（返回 Promise）
   * 优先使用 window.CHEM_DATA，缺失时回退到 fetch。
   */
  function init() {
    var keys = Object.keys(FILES);
    var usedWindow = false;
    var usedFetch = false;

    return keys.reduce(function (promise, key) {
      return promise.then(function () {
        var local = fromWindow(key);
        if (local) {
          state[key] = local;
          usedWindow = true;
          return null;
        }
        return fetchJSON(FILES[key]).then(function (json) {
          state[key] = json;
          usedFetch = true;
        });
      });
    }, Promise.resolve()).then(function () {
      state.source = usedFetch && usedWindow ? 'mixed' : (usedFetch ? 'json' : 'bundle');
      buildIndexes();
      state.loaded = true;
      return state;
    }).catch(function (error) {
      console.error('[data] 数据加载失败：', error);
      throw error;
    });
  }

  /* ============================ 查询接口 ============================ */

  function chapters() {
    return (state.knowledge && state.knowledge.chapters) || [];
  }

  function chapter(chapterId) {
    return index.chapters[chapterId] || null;
  }

  function pointsOf(chapterId) {
    return index.pointsByChapter[chapterId] || [];
  }

  function point(pointId) {
    return index.points[pointId] || null;
  }

  function allPoints() {
    return (state.knowledge && state.knowledge.points) || [];
  }

  function questionsOf(chapterId) {
    return index.questionsByChapter[chapterId] || [];
  }

  function allQuestions() {
    return (state.quiz && state.quiz.questions) || [];
  }

  function question(questionId) {
    return index.questions[questionId] || null;
  }

  /**
   * 关键词搜索知识点
   * @param {string} keyword
   */
  function searchPoints(keyword) {
    var text = String(keyword || '').trim().toLowerCase();
    if (!text) return [];
    return allPoints().filter(function (item) {
      var haystack = [
        item.title,
        item.titleEn,
        item.definition && item.definition.cn,
        (item.tags || []).join(' ')
      ].join(' ').toLowerCase();
      return haystack.indexOf(text) >= 0;
    });
  }

  /**
   * 解析分子输入：化学式 / 中文名 / 英文名
   * @param {string} query
   * @returns {Object|null} 分子对象
   */
  function resolveMolecule(query) {
    if (!query) return null;
    var raw = String(query).trim();

    // 1. 化学式精确匹配
    var byFormula = index.moleculesByFormula[normalizeFormula(raw)];
    if (byFormula) return byFormula;

    // 2. 名称精确匹配（含别名）
    var byName = index.moleculeByName[normalizeName(raw)];
    if (byName) return byName;

    // 3. 名称映射表 → 化学式（针对没有 3D 模型的物质，仍返回 null）
    var entries = (state.nameMap && state.nameMap.entries) || [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var names = [entry.name].concat(entry.aliases || []);
      for (var j = 0; j < names.length; j++) {
        if (normalizeName(names[j]) === normalizeName(raw)) {
          var matched = index.moleculesByFormula[normalizeFormula(entry.formula)];
          if (matched) return matched;
        }
      }
    }

    // 4. 模糊匹配（包含关系），仅对长度 ≥ 2 的输入生效
    if (raw.length >= 2) {
      var keys = Object.keys(index.moleculeByName);
      var target = normalizeName(raw);
      for (var k = 0; k < keys.length; k++) {
        if (keys[k] && (keys[k].indexOf(target) >= 0 || target.indexOf(keys[k]) >= 0)) {
          var fuzzy = index.moleculeByName[keys[k]];
          if (fuzzy) return fuzzy;
        }
      }
    }

    return null;
  }

  /** 按化学式取分子 */
  function moleculeByFormula(formula) {
    return index.moleculesByFormula[normalizeFormula(formula)] || null;
  }

  /** 全部方程式 */
  function equations() {
    return (state.equations && state.equations.equations) || [];
  }

  /** 名称映射表条目 */
  function nameEntries() {
    return (state.nameMap && state.nameMap.entries) || [];
  }

  /** 元素配色表 */
  function elements() {
    return (state.molecules && state.molecules.elements) || {};
  }

  /** 元信息与统计 */
  function stats() {
    return {
      chapters: chapters().length,
      points: allPoints().length,
      questions: allQuestions().length,
      molecules: (state.molecules && state.molecules.molecules.length) || 0,
      names: nameEntries().length,
      equations: equations().length
    };
  }

  CL.data = {
    init: init,
    state: state,
    chapters: chapters,
    chapter: chapter,
    pointsOf: pointsOf,
    point: point,
    allPoints: allPoints,
    questionsOf: questionsOf,
    allQuestions: allQuestions,
    question: question,
    searchPoints: searchPoints,
    resolveMolecule: resolveMolecule,
    moleculeByFormula: moleculeByFormula,
    equations: equations,
    nameEntries: nameEntries,
    elements: elements,
    stats: stats,
    normalizeFormula: normalizeFormula,
    normalizeName: normalizeName
  };
})(window);
