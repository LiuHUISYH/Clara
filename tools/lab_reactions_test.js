/**
 * lab_reactions_test.js —— 虚拟实验室反应引擎自测
 * ------------------------------------------------------------------
 * 用 macOS 自带的 JavaScriptCore 运行，不需要 Node.js：
 *
 *     cd ChemLearn
 *     /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/lab_reactions_test.js
 *
 * 由于 jsc 不支持 ES Module，这里先用 readFile 读出 lab/src/reactions.js，
 * 去掉 `export` 前缀后在函数作用域里求值，再取回具名导出。
 *
 * 覆盖：规则表自检、中和放热、沉淀生成、放气、金属置换、活动性顺序、
 *      沉淀溶于酸、指示剂显色、逐滴加入、多规则串联。
 */

var window = this;
window.window = window;

var log = typeof print === 'function' ? print : console.log;
var NL = String.fromCharCode(10);

function loadLabModule(path) {
  var source = readFile(path);
  var names = [];

  source.replace(/^export\s+(?:var|function|const)\s+([A-Za-z0-9_$]+)/gm, function (match, name) {
    names.push(name);
    return match;
  });

  var code = source.replace(/^export\s+/gm, '');
  var factory = new Function(code + NL + 'return { ' + names.join(', ') + ' };');
  return factory();
}

var lab = loadLabModule('lab/src/reactions.js');
var SPECIES = lab.SPECIES;
var RULES = lab.RULES;
var reactContents = lab.reactContents;
var describeReaction = lab.describeReaction;
var describeGas = lab.describeGas;
var indicatorTint = lab.indicatorTint;
var indicatorText = lab.indicatorText;
var hasIndicator = lab.hasIndicator;
var speciesColor = lab.speciesColor;
var speciesPh = lab.speciesPh;

var failures = 0;

function check(name, condition, extra) {
  if (condition) {
    log('  ok   ' + name);
  } else {
    failures += 1;
    log('  FAIL ' + name + (extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  }
}

function liquid(chemical, volume) {
  var species = SPECIES[chemical] || {};
  return {
    chemical: chemical,
    label: species.label || chemical,
    name: species.name || chemical,
    state: 'liquid',
    volume: volume
  };
}

function solid(chemical, mass) {
  var species = SPECIES[chemical] || {};
  return {
    chemical: chemical,
    label: species.label || chemical,
    name: species.name || chemical,
    state: 'solid',
    mass: mass,
    volume: 0
  };
}

function find(contents, chemical) {
  return contents.filter(function (entry) {
    return entry.chemical === chemical;
  })[0];
}

function total(contents) {
  return Math.round(
    contents.reduce(function (sum, entry) {
      return sum + (entry.state === 'solid' ? 0 : entry.volume || 0);
    }, 0) * 10
  ) / 10;
}

log(NL + '[1] 规则表自检');
var unknown = [];
RULES.forEach(function (rule) {
  rule.pair.forEach(function (chemical) {
    if (!SPECIES[chemical]) unknown.push(rule.id + ':pair:' + chemical);
  });
  rule.products.forEach(function (product) {
    if (!SPECIES[product.chemical]) unknown.push(rule.id + ':product:' + product.chemical);
  });
  if (rule.pair[0] === rule.pair[1]) unknown.push(rule.id + ':same-pair');
});
check('规则引用的化学式都在 SPECIES 中', unknown.length === 0, unknown);
check('规则数量 ≥ 20', RULES.length >= 20, RULES.length);
var ids = {};
var duplicate = [];
RULES.forEach(function (rule) {
  if (ids[rule.id]) duplicate.push(rule.id);
  ids[rule.id] = true;
});
check('规则 id 唯一', duplicate.length === 0, duplicate);

log(NL + '[2] 中和反应：HCl + NaOH');
var neutral = reactContents([liquid('HCl', 10), liquid('NaOH', 10)], 25);
check('全部生成 NaCl', neutral.contents.length === 1 && neutral.contents[0].chemical === 'NaCl', neutral.contents);
check('体积守恒 20mL', total(neutral.contents) === 20, total(neutral.contents));
check('放热升温', neutral.temperature > 25 && neutral.temperature <= 65, neutral.temperature);
check('只记录一条规则', neutral.events.length === 1 && neutral.events[0].times === 10, neutral.events.length);
check('日志包含方程式', describeReaction(neutral.events[0]).indexOf('HCl + NaOH') === 0, describeReaction(neutral.events[0]));
var neutralPh = (function () {
  var weighted = 0;
  var volume = 0;
  neutral.contents.forEach(function (entry) {
    weighted += speciesPh(entry.chemical) * entry.volume;
    volume += entry.volume;
  });
  return weighted / volume;
})();
check('pH 约为 7', Math.abs(neutralPh - 7) < 0.01, neutralPh);

log(NL + '[3] 沉淀：AgNO3 + NaCl');
var precip = reactContents([liquid('AgNO3', 10), liquid('NaCl', 10)], 25);
var agcl = find(precip.contents, 'AgCl');
check('生成 AgCl 固体', !!agcl && agcl.state === 'solid', precip.contents);
check('AgCl 有颜色', !!agcl && typeof agcl.color === 'string', agcl && agcl.color);
check('AgCl 质量 = 反应次数', !!agcl && agcl.mass === precip.events[0].times, agcl && agcl.mass);
check('母液为 NaNO3', !!find(precip.contents, 'NaNO3'), precip.contents);
check('无气体记录', describeGas(precip.events) === null, describeGas(precip.events));


log(NL + '[4] 放气：Na2CO3 + HCl');
var fizz = reactContents([liquid('Na2CO3', 10), liquid('HCl', 10)], 25);
check('生成 CO2 气泡', describeGas(fizz.events) !== null, describeGas(fizz.events));
check('没有固体残留', fizz.contents.every(function (entry) { return entry.state !== 'solid'; }), fizz.contents);
check('气体带走体积', total(fizz.contents) < 20, total(fizz.contents));
check('生成 NaCl', !!find(fizz.contents, 'NaCl'), fizz.contents);

log(NL + '[5] 置换：Fe + CuSO4');
var replace = reactContents([liquid('CuSO4', 10), solid('Fe', 1)], 25);
check('析出铜', !!find(replace.contents, 'Cu'), replace.contents);
check('生成 FeSO4', !!find(replace.contents, 'FeSO4'), replace.contents);
check('铁被消耗完', !find(replace.contents, 'Fe'), replace.contents);
check('一次反应', replace.events.length === 1, replace.events.length);

log(NL + '[6] 活动性顺序：Cu + HCl 不反应');
var noReaction = reactContents([liquid('HCl', 10), solid('Cu', 1)], 25);
check('不产生反应', noReaction.changed === false && noReaction.events.length === 0, noReaction.events);
check('内容保持不变', noReaction.contents.length === 2, noReaction.contents.length);
check('温度不变', noReaction.temperature === 25, noReaction.temperature);

log(NL + '[7] 沉淀溶解：Cu(OH)2 + HCl');
var dissolve = reactContents([solid('CuOH2', 4), liquid('HCl', 10)], 25);
check('沉淀全部溶解', !find(dissolve.contents, 'CuOH2'), dissolve.contents);
check('生成 CuCl2', !!find(dissolve.contents, 'CuCl2'), dissolve.contents);
check('溶液呈蓝绿色', speciesColor('CuCl2') !== '#e2ecef', speciesColor('CuCl2'));

log(NL + '[8] 指示剂显色');
var phenolphthalein = [liquid('NaOH', 10), liquid('phenolphthalein', 1)];
check('酚酞遇碱变红', indicatorTint(phenolphthalein, 13) === '#d4728f', indicatorTint(phenolphthalein, 13));
check('酚酞在酸中无色', indicatorTint([liquid('HCl', 10), liquid('phenolphthalein', 1)], 1) === null);
check('碱性文案', indicatorText(phenolphthalein, 13).indexOf('变红') > 0, indicatorText(phenolphthalein, 13));
check('识别指示剂', hasIndicator(phenolphthalein) === true && hasIndicator([liquid('NaCl', 5)]) === false);
check('石蕊遇酸变红', indicatorTint([liquid('litmus', 1)], 1) === '#c07a80');
check('石蕊遇碱变蓝', indicatorTint([liquid('litmus', 1)], 12) === '#6f86b8');

log(NL + '[9] 逐滴加入：少量碱滴入过量酸');
var drop = reactContents([liquid('HCl', 10), liquid('NaOH', 2)], 25);
check('只中和 2mL', drop.events[0].times === 2, drop.events[0].times);
check('酸过量仍剩 HCl', !!find(drop.contents, 'HCl'), drop.contents);
check('剩余 HCl 8mL', find(drop.contents, 'HCl').volume === 8, find(drop.contents, 'HCl').volume);

log(NL + '[10] 多规则串联：BaCl2 + Na2CO3 再加 HCl');
var cascade = reactContents([liquid('BaCl2', 6), liquid('Na2CO3', 6)], 25);
check('先生成 BaCO3', !!find(cascade.contents, 'BaCO3'), cascade.contents);
var cascade2 = reactContents(cascade.contents.concat(liquid('HCl', 10)), 25);
check('沉淀被酸溶解', !find(cascade2.contents, 'BaCO3'), cascade2.contents);
check('放出 CO2', describeGas(cascade2.events) !== null, describeGas(cascade2.events));

log(NL + '[11] 受热分解（温度门槛）');
var coldHydroxide = reactContents([solid('CuOH2', 4)], 25);
check('室温下 Cu(OH)2 不分解', coldHydroxide.changed === false, coldHydroxide.events);
check('低温时内容物不变', !!find(coldHydroxide.contents, 'CuOH2'), coldHydroxide.contents);

var hotHydroxide = reactContents([solid('CuOH2', 4)], 100);
var copperOxide = find(hotHydroxide.contents, 'CuO');
check('高温分解出 CuO', !!copperOxide && copperOxide.state === 'solid', hotHydroxide.contents);
check('CuO 是黑色固体', !!copperOxide && copperOxide.color === '#3b3733', copperOxide && copperOxide.color);
check('同时生成水', !!find(hotHydroxide.contents, 'H2O'), hotHydroxide.contents);
check('Cu(OH)2 被完全消耗', !find(hotHydroxide.contents, 'CuOH2'), hotHydroxide.contents);

var soda = reactContents([solid('NaHCO3', 2)], 120);
var sodaAsh = find(soda.contents, 'Na2CO3');
check('碳酸氢钠受热放气', describeGas(soda.events) !== null, describeGas(soda.events));
check('生成固体碳酸钠', !!sodaAsh && sodaAsh.state === 'solid', soda.contents);
check('固体产物不计入液体体积', !!sodaAsh && sodaAsh.volume === 0, sodaAsh && sodaAsh.volume);
check('生成的水与消耗量一致', find(soda.contents, 'H2O').volume === 2, find(soda.contents, 'H2O').volume);
check('2g 触发两次分解', soda.events.length === 1 && soda.events[0].times === 2, soda.events);

var limestoneCool = reactContents([solid('CaCO3', 1)], 100);
check('100°C 不足以煅烧石灰石', limestoneCool.changed === false, limestoneCool.events);
var limestoneHot = reactContents([solid('CaCO3', 1)], 130);
check('130°C 生成 CaO', !!find(limestoneHot.contents, 'CaO'), limestoneHot.contents);
check('煅烧放出 CO2', describeGas(limestoneHot.events) !== null, describeGas(limestoneHot.events));

var suspension = reactContents([solid('CuOH2', 2), liquid('H2O', 10)], 100);
check('悬浊液受热也分解', !!find(suspension.contents, 'CuO'), suspension.contents);
check('产物水与原有水合并', find(suspension.contents, 'H2O').volume === 12, find(suspension.contents, 'H2O').volume);

log(NL + (failures === 0 ? '全部通过 ✓' : failures + ' 项失败 ✗'));
if (typeof quit === 'function') quit(failures === 0 ? 0 : 1);

