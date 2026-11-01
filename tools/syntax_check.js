/**
 * syntax_check.js —— 用 JavaScriptCore 逐个检查 js 文件的语法
 *
 *     /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/syntax_check.js
 */
var window = this;
window.window = window;

window.document = {
  readyState: 'loading',
  body: {
    classList: { add: function () {}, remove: function () {}, toggle: function () {} }
  },
  addEventListener: function () {},
  createElement: function () {
    return {
      style: {},
      dataset: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {} },
      appendChild: function () {},
      setAttribute: function () {},
      addEventListener: function () {}
    };
  },
  createTextNode: function (text) { return { text: text }; },
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; }
};
window.localStorage = {
  _data: {},
  getItem: function (key) { return this._data[key] || null; },
  setItem: function (key, value) { this._data[key] = String(value); },
  removeItem: function (key) { delete this._data[key]; }
};
window.location = { hash: '#/home', protocol: 'file:' };
window.history = { replaceState: function () {} };
window.addEventListener = function () {};
window.devicePixelRatio = 1;
window.requestAnimationFrame = function () { return 1; };
window.cancelAnimationFrame = function () {};

var files = [
  'data/knowledge.js',
  'data/quiz.js',
  'data/molecules.js',
  'data/nameMap.js',
  'data/equations.js',
  'js/utils.js',
  'js/storage.js',
  'js/data.js',
  'js/router.js',
  'js/knowledge.js',
  'js/quiz.js',
  'js/wrongbook.js',
  'js/molecule3d.js',
  'js/tools.js',
  'js/app.js'
];

var failed = 0;
files.forEach(function (file) {
  try {
    load(file);
    print('✓ ' + file);
  } catch (error) {
    failed += 1;
    print('✗ ' + file + ' → ' + error);
    if (error && error.stack) print(error.stack.split('\n').slice(0, 3).join('\n'));
  }
});

print('----------------------------------------');
print(failed === 0 ? '全部文件语法与加载检查通过 ✅' : ('失败 ' + failed + ' 个文件'));
