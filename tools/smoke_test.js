/**
 * smoke_test.js —— 无浏览器冒烟测试
 * ------------------------------------------------------------------
 * 使用 macOS 自带的 JavaScriptCore（jsc）运行，不需要 Node.js：
 *
 *     cd ChemLearn
 *     /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/smoke_test.js
 *
 * 测试内容：
 *   1. 所有 js 文件能否被正确解析并加载（语法检查）
 *   2. 数据是否完整（章节 / 知识点 / 题目 / 分子 / 名称 / 方程式）
 *   3. 配平算法、摩尔质量、物质识别、分子解析与 VSEPR 推测
 *   4. 判分逻辑（单选 / 判断 / 填空）
 */
var window = this;
window.window = window;

/* ---------- 最小 DOM / BOM 桩，只为让模块加载不报错 ---------- */

function makeClassList() {
  return {
    add: function () {},
    remove: function () {},
    toggle: function () { return false; },
    contains: function () { return false; }
  };
}

function makeElement() {
  return {
    style: {},
    dataset: {},
    classList: makeClassList(),
    children: [],
    appendChild: function (child) { this.children.push(child); return child; },
    removeChild: function () {},
    setAttribute: function () {},
    removeAttribute: function () {},
    addEventListener: function () {},
    removeEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    getBoundingClientRect: function () { return { width: 600, height: 480, left: 0, top: 0 }; }
  };
}

window.document = {
  readyState: 'loading',
  body: makeElement(),
  addEventListener: function () {},
  removeEventListener: function () {},
  createElement: function () { return makeElement(); },
  createTextNode: function (text) { return { text: text }; },
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; }
};

window.localStorage = {
  _data: {},
  getItem: function (key) {
    return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null;
  },
  setItem: function (key, value) { this._data[key] = String(value); },
  removeItem: function (key) { delete this._data[key]; }
};

window.location = { hash: '#/home', protocol: 'file:' };
window.history = { replaceState: function () {} };
window.addEventListener = function () {};
window.removeEventListener = function () {};
window.devicePixelRatio = 1;
window.requestAnimationFrame = function () { return 1; };
window.cancelAnimationFrame = function () {};
window.alert = function () {};

/* ---------- 加载数据与脚本 ---------- */

load('data/knowledge.js');
load('data/quiz.js');
load('data/molecules.js');
load('data/nameMap.js');
load('data/equations.js');

load('js/utils.js');
load('js/storage.js');
load('js/data.js');
load('js/router.js');
load('js/knowledge.js');
load('js/quiz.js');
load('js/wrongbook.js');
load('js/molecule3d.js');
load('js/tools.js');
load('js/app.js');

/* ---------- 断言工具 ---------- */

var passed = 0;
var failed = 0;

function check(name, actual, expected) {
  var ok;
  if (typeof expected === 'number' && typeof actual === 'number') {
    ok = Math.abs(actual - expected) < 0.02;
  } else {
    ok = actual === expected;
  }
  if (ok) {
    passed += 1;
    print('  ✓ ' + name);
  } else {
    failed += 1;
    print('  ✗ ' + name + '  期望：' + expected + '  实际：' + actual);
  }
}

function checkTruthy(name, value) {
  if (value) {
    passed += 1;
    print('  ✓ ' + name);
  } else {
    failed += 1;
    print('  ✗ ' + name + '（值为假）');
  }
}

print('ChemLearn 冒烟测试');
print('==============================================');

CL.data.init().then(function () {
  var stats = CL.data.stats();
  check('章节数量', stats.chapters, 5);
  check('知识点数量', stats.points, 20);
  check('题目数量', stats.questions, 45);
  check('分子数量', stats.molecules, 33);
  check('名称映射数量', stats.names, 46);
  check('方程式数量', stats.equations, 18);

  // ---- 配平算法 ----
  check('配平 H2 + O2', CL.tools.balance('H2 + O2 -> H2O').equation, '2H2 + O2 → 2H2O');
  check('配平 Fe + O2', CL.tools.balance('Fe + O2 -> Fe2O3').equation, '4Fe + 3O2 → 2Fe2O3');
  check('配平丙烷燃烧', CL.tools.balance('C3H8 + O2 -> CO2 + H2O').equation,
    'C3H8 + 5O2 → 3CO2 + 4H2O');
  check('配平中和反应', CL.tools.balance('NaOH + H2SO4 -> Na2SO4 + H2O').equation,
    '2NaOH + H2SO4 → Na2SO4 + 2H2O');
  check('无法解析时返回错误', !!CL.tools.balance('这不是一个方程式').error, true);

  // ---- 摩尔质量 ----
  check('H2O 摩尔质量', CL.tools.molarMass('H2O').total, 18.015);
  check('NaCl 摩尔质量', CL.tools.molarMass('NaCl').total, 58.44);
  check('Ca(OH)2 摩尔质量', CL.tools.molarMass('Ca(OH)2').total, 74.093);
  check('CuSO4·5H2O 摩尔质量', CL.tools.molarMass('CuSO4·5H2O').total, 249.685);

  // ---- 物质识别 ----
  var salt = CL.tools.identify('食盐');
  check('食盐的化学式', salt.formula, 'NaCl');
  check('食盐的类别', salt.category, '离子化合物');
  var water = CL.tools.identify('水');
  check('水的键型包含极性共价键', water.bondType.indexOf('极性共价键') >= 0, true);
  check('水的分子间作用力包含氢键', water.imf.indexOf('氢键') >= 0, true);
  var unknown = CL.tools.identify('K2Cr2O7');
  check('未知物质标记为推测', unknown.isEstimate, true);

  // ---- 分子解析与 VSEPR ----
  check('解析 Ca(OH)2 的钙原子数', CL.molecule.parseFormula('Ca(OH)2').Ca, 1);
  check('解析 Ca(OH)2 的氧原子数', CL.molecule.parseFormula('Ca(OH)2').O, 2);
  check('解析 Ca(OH)2 的氢原子数', CL.molecule.parseFormula('Ca(OH)2').H, 2);

  check('按名称解析水', CL.data.resolveMolecule('水').formula, 'H2O');
  check('按化学式解析苯', CL.data.resolveMolecule('c6h6').formula, 'C6H6');
  check('按别名解析食盐', CL.data.resolveMolecule('sodium chloride').formula, 'NaCl');
  check('解析四氟化氙', CL.data.resolveMolecule('四氟化氙').formula, 'XeF4');

  var estimate = CL.molecule.estimate('H2SO4');
  checkTruthy('H2SO4 能给出推测构型', estimate && estimate.geometry);
  var estimate2 = CL.molecule.estimate('PBr3');
  checkTruthy('PBr3 能给出推测构型', estimate2 && estimate2.atoms.length === 4);

  var cs2 = CL.molecule.estimate('CS2');
  check('CS2 推测为直线形', cs2.geometry.indexOf('直线') >= 0, true);
  var so2e = CL.molecule.estimate('SO2');
  check('SO2 推测为角形', so2e.geometry.indexOf('角形') >= 0, true);

  // ---- 判分逻辑 ----
  var q1 = CL.data.question('q-1-1');
  check('单选正确判分', CL.quiz.grade(q1, 1), true);
  check('单选错误判分', CL.quiz.grade(q1, 0), false);

  var q3 = CL.data.question('q-1-3');
  check('判断正确判分', CL.quiz.grade(q3, false), true);
  check('判断错误判分', CL.quiz.grade(q3, true), false);

  var q5 = CL.data.question('q-1-5');
  check('填空正确判分', CL.quiz.grade(q5, '0.96'), true);
  check('填空错误判分', CL.quiz.grade(q5, '0.95'), false);
  check('填空容错（全角）', CL.utils.isAnswerMatch('０.９６', ['0.96']), true);
  check('负数与 Unicode 负号', CL.utils.isAnswerMatch('−1.86', ['-1.86']), true);
  check('化学式大小写容错', CL.utils.isAnswerMatch('sp³', ['sp3', 'sp³']), true);

  // ---- 存储 ----
  CL.store.markPointRead('ch1-1');
  check('已读进度可写入', CL.store.isPointRead('ch1-1'), true);
  CL.store.recordAttempt({ questionId: 'q-1-1', chapter: 'ch1', correct: true, answer: 1 });
  check('答题记录统计', CL.store.attemptStats().total, 1);
  CL.store.addWrong(CL.data.question('q-1-3'), true);
  check('错题入库', CL.store.wrongStats().total, 1);
  CL.store.markMastered('q-1-3', true);
  check('标记已掌握', CL.store.wrongStats().mastered, 1);

  print('==============================================');
  print('通过：' + passed + ' 项，失败：' + failed + ' 项');
  if (failed > 0) {
    throw new Error('冒烟测试存在失败项');
  }
  print('全部测试通过 ✅');
}).catch(function (error) {
  print('测试执行失败：' + error);
  if (error && error.stack) print(error.stack);
  throw error;
});
