/**
 * reactions.js —— 虚拟实验室的规则反应引擎
 * ------------------------------------------------------------------
 * 规则只按化学式匹配，不依赖任何第三方库，也不做真正的摩尔配平。
 * 结算口径（教学近似，界面上不宣称定量准确）：
 *   · 一份 = 1 mL 液体 / 1 g 固体；
 *   · 一次反应从每种反应物各消耗一份，液体体积守恒到液体产物中；
 *   · 放出气体时，按 gas.loss 扣掉一部分体积（气体离开容器）；
 *   · 沉淀与置换出的金属以固体形式留在容器底部，质量按 1 g/次 估算；
 *   · 放热反应按 heat（°C/次）升温，上限 65°C；
 *   · 受热分解规则用 minTemperature 控制温度门槛，pair 只写一种物质。
 *
 * 规则只声明「两种反应物 → 产物 + 现象」，二进制匹配让引擎保持可读，
 * 新增反应只需往 RULES 里追加一条，不需要改引擎本身。
 */

/* 物质登记表：label 用于日志与选择器，color 是溶液 / 固体颜色，ph 为近似值。 */
export var SPECIES = {
  /* 酸与碱 */
  HCl: { label: 'HCl', name: '盐酸', color: '#e2ecef', ph: 1 },
  H2SO4: { label: 'H₂SO₄', name: '硫酸', color: '#e2ecef', ph: 0.5 },
  HNO3: { label: 'HNO₃', name: '硝酸', color: '#e2ecef', ph: 1 },
  NaOH: { label: 'NaOH', name: '氢氧化钠', color: '#e2ecef', ph: 13 },
  KOH: { label: 'KOH', name: '氢氧化钾', color: '#e2ecef', ph: 13 },

  /* 盐溶液 */
  NaCl: { label: 'NaCl', name: '氯化钠', color: '#e2ecef', ph: 7 },
  KCl: { label: 'KCl', name: '氯化钾', color: '#e2ecef', ph: 7 },
  NaNO3: { label: 'NaNO₃', name: '硝酸钠', color: '#e2ecef', ph: 7 },
  KNO3: { label: 'KNO₃', name: '硝酸钾', color: '#e2ecef', ph: 7 },
  Na2SO4: { label: 'Na₂SO₄', name: '硫酸钠', color: '#e2ecef', ph: 7 },
  K2SO4: { label: 'K₂SO₄', name: '硫酸钾', color: '#e2ecef', ph: 7 },
  CaCl2: { label: 'CaCl₂', name: '氯化钙', color: '#e2ecef', ph: 7 },
  CaNO32: { label: 'Ca(NO₃)₂', name: '硝酸钙', color: '#e2ecef', ph: 7 },
  BaCl2: { label: 'BaCl₂', name: '氯化钡', color: '#e2ecef', ph: 7 },
  AgNO3: { label: 'AgNO₃', name: '硝酸银', color: '#e2ecef', ph: 6 },
  Na2CO3: { label: 'Na₂CO₃', name: '碳酸钠', color: '#e2ecef', ph: 11 },
  CuSO4: { label: 'CuSO₄', name: '硫酸铜', color: '#4f8bc8', ph: 4.5 },
  CuCl2: { label: 'CuCl₂', name: '氯化铜', color: '#5b96c0', ph: 4.5 },
  CuNO32: { label: 'Cu(NO₃)₂', name: '硝酸铜', color: '#4f8bc8', ph: 4.5 },
  FeCl2: { label: 'FeCl₂', name: '氯化亚铁', color: '#dfe7d8', ph: 5.5 },
  FeSO4: { label: 'FeSO₄', name: '硫酸亚铁', color: '#dfe7d8', ph: 5.5 },
  ZnCl2: { label: 'ZnCl₂', name: '氯化锌', color: '#e6ecec', ph: 6 },
  ZnSO4: { label: 'ZnSO₄', name: '硫酸锌', color: '#e6ecec', ph: 6 },
  MgCl2: { label: 'MgCl₂', name: '氯化镁', color: '#e6ecec', ph: 6.5 },
  MgSO4: { label: 'MgSO₄', name: '硫酸镁', color: '#e6ecec', ph: 6.5 },
  H2O: { label: 'H₂O', name: '水', color: '#eef3f4', ph: 7 },

  /* 指示剂：本身不参与 pH 加权，只决定显色 */
  phenolphthalein: { label: '酚酞', name: '酚酞', color: '#edf2f1', ph: null },
  litmus: { label: '石蕊', name: '石蕊', color: '#e8eef0', ph: null },

  /* 固体：单质、碳酸钙与沉淀 */
  Fe: { label: 'Fe', name: '铁', solid: true, color: '#686760' },
  Cu: { label: 'Cu', name: '铜', solid: true, color: '#ad6d4f' },
  Zn: { label: 'Zn', name: '锌', solid: true, color: '#969c9b' },
  Mg: { label: 'Mg', name: '镁', solid: true, color: '#b2b2a8' },
  CaCO3: { label: 'CaCO₃', name: '碳酸钙', solid: true, color: '#c9c5b7' },
  NaHCO3: { label: 'NaHCO₃', name: '碳酸氢钠', solid: true, color: '#efeee6' },
  CuO: { label: 'CuO', name: '氧化铜', solid: true, color: '#3b3733' },
  CaO: { label: 'CaO', name: '氧化钙', solid: true, color: '#f2f0e8' },
  AgCl: { label: 'AgCl', name: '氯化银', solid: true, color: '#eceade' },
  BaSO4: { label: 'BaSO₄', name: '硫酸钡', solid: true, color: '#efeee7' },
  BaCO3: { label: 'BaCO₃', name: '碳酸钡', solid: true, color: '#f0ede1' },
  CuOH2: { label: 'Cu(OH)₂', name: '氢氧化铜', solid: true, color: '#5d9dc9' },
  Ag: { label: 'Ag', name: '银', solid: true, color: '#cfcfc7' }
};

/* 每次反应消耗的份额：液体 1mL，固体 1g。 */
var PORTION = 1;
/* 单次操作最多结算的轮数（250mL 容量下 1mL 一步也够用），防止规则互相触发放大。 */
var MAX_ROUNDS = 400;
/* 放热上限，避免中和反应把温度推到不合理的高度。 */
var HEAT_CAP = 65;

function round1(value) {
  return Math.round(value * 10) / 10;
}

function speciesOf(chemical) {
  return SPECIES[chemical] || null;
}

export function speciesColor(chemical) {
  var species = speciesOf(chemical);
  return species && species.color ? species.color : '#e2ecef';
}

export function speciesPh(chemical) {
  var species = speciesOf(chemical);
  return species && typeof species.ph === 'number' ? species.ph : null;
}

function entryQuantity(entry) {
  return entry.state === 'solid' ? entry.mass || 0 : entry.volume || 0;
}

function indexOfChemical(contents, chemical) {
  for (var i = 0; i < contents.length; i += 1) {
    if (contents[i].chemical === chemical) return i;
  }
  return -1;
}

function addEntry(list, entry) {
  for (var i = 0; i < list.length; i += 1) {
    if (list[i].chemical === entry.chemical && list[i].state === entry.state) {
      if (entry.state === 'solid') {
        list[i].mass = round1((list[i].mass || 0) + (entry.mass || 0));
      } else {
        list[i].volume = round1((list[i].volume || 0) + (entry.volume || 0));
      }
      return;
    }
  }
  list.push(entry);
}

/* ============================ 反应规则 ============================ */

/*
 * pair：两种反应物的化学式，顺序无关；受热分解只写一种；
 * equation：直接用于日志的方程式；
 * phenomenon：一句话现象；
 * note：可选的教学提示；
 * minTemperature：可选，容器温度达到该值才允许反应；
 * products：产物，固体自动按沉淀 / 析出渲染，可用 state 强制指定物态；
 * gas：{ label, loss } 放气并扣掉一部分液体体积；
 * heat：每次反应升高的温度。
 */
export var RULES = [
  /* ---------- 沉淀反应 ---------- */
  {
    id: 'agcl-nacl',
    pair: ['AgNO3', 'NaCl'],
    equation: 'AgNO₃ + NaCl → AgCl↓ + NaNO₃',
    phenomenon: '生成白色沉淀 AgCl',
    note: 'AgCl 不溶于稀硝酸，是检验 Cl⁻ 的特征反应。',
    products: [{ chemical: 'AgCl' }, { chemical: 'NaNO3' }]
  },
  {
    id: 'agcl-hcl',
    pair: ['AgNO3', 'HCl'],
    equation: 'AgNO₃ + HCl → AgCl↓ + HNO₃',
    phenomenon: '生成白色沉淀 AgCl',
    note: '盐酸中的 Cl⁻ 同样会与 Ag⁺ 结合。',
    products: [{ chemical: 'AgCl' }, { chemical: 'HNO3' }]
  },
  {
    id: 'baso4',
    pair: ['BaCl2', 'H2SO4'],
    equation: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
    phenomenon: '生成白色沉淀 BaSO₄',
    note: 'BaSO₄ 既不溶于水也不溶于酸，可用于检验 SO₄²⁻。',
    products: [{ chemical: 'BaSO4' }, { chemical: 'HCl' }]
  },
  {
    id: 'baco3',
    pair: ['BaCl2', 'Na2CO3'],
    equation: 'BaCl₂ + Na₂CO₃ → BaCO₃↓ + 2NaCl',
    phenomenon: '生成白色沉淀 BaCO₃',
    note: 'BaCO₃ 能溶于盐酸，加酸后沉淀会消失并冒出气泡。',
    products: [{ chemical: 'BaCO3' }, { chemical: 'NaCl' }]
  },
  {
    id: 'cuoh2-naoh',
    pair: ['CuSO4', 'NaOH'],
    equation: 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄',
    phenomenon: '生成蓝色沉淀 Cu(OH)₂，溶液的蓝色褪去',
    note: '蓝色絮状沉淀是检验 Cu²⁺ 的常用方法。',
    products: [{ chemical: 'CuOH2' }, { chemical: 'Na2SO4' }]
  },
  {
    id: 'cuoh2-koh',
    pair: ['CuSO4', 'KOH'],
    equation: 'CuSO₄ + 2KOH → Cu(OH)₂↓ + K₂SO₄',
    phenomenon: '生成蓝色沉淀 Cu(OH)₂',
    products: [{ chemical: 'CuOH2' }, { chemical: 'K2SO4' }]
  },

  /* ---------- 沉淀溶解 ---------- */
  {
    id: 'cuoh2-hcl',
    pair: ['CuOH2', 'HCl'],
    equation: 'Cu(OH)₂ + 2HCl → CuCl₂ + 2H₂O',
    phenomenon: '蓝色沉淀溶解，溶液变成蓝绿色',
    note: '沉淀能溶于酸，说明 Cu(OH)₂ 具有碱性。',
    products: [{ chemical: 'CuCl2' }]
  },
  {
    id: 'cuoh2-h2so4',
    pair: ['CuOH2', 'H2SO4'],
    equation: 'Cu(OH)₂ + H₂SO₄ → CuSO₄ + 2H₂O',
    phenomenon: '蓝色沉淀溶解，溶液恢复蓝色',
    products: [{ chemical: 'CuSO4' }]
  },
  {
    id: 'baco3-hcl',
    pair: ['BaCO3', 'HCl'],
    equation: 'BaCO₃ + 2HCl → BaCl₂ + H₂O + CO₂↑',
    phenomenon: '白色沉淀溶解并产生气泡（CO₂）',
    note: '沉淀溶解 + 冒气泡，说明原沉淀是碳酸盐。',
    products: [{ chemical: 'BaCl2' }],
    gas: { label: 'CO₂', loss: 0.4 }
  },

  /* ---------- 碳酸盐与酸 ---------- */
  {
    id: 'co2-na2co3-hcl',
    pair: ['Na2CO3', 'HCl'],
    equation: 'Na₂CO₃ + 2HCl → 2NaCl + H₂O + CO₂↑',
    phenomenon: '产生大量无色气泡（CO₂）',
    note: '生成的气体能使燃着的木条熄灭，可用来区分碳酸盐与硫酸盐。',
    products: [{ chemical: 'NaCl' }],
    gas: { label: 'CO₂', loss: 0.4 }
  },
  {
    id: 'co2-na2co3-h2so4',
    pair: ['Na2CO3', 'H2SO4'],
    equation: 'Na₂CO₃ + H₂SO₄ → Na₂SO₄ + H₂O + CO₂↑',
    phenomenon: '产生大量无色气泡（CO₂）',
    products: [{ chemical: 'Na2SO4' }],
    gas: { label: 'CO₂', loss: 0.4 }
  },
  {
    id: 'co2-na2co3-hno3',
    pair: ['Na2CO3', 'HNO3'],
    equation: 'Na₂CO₃ + 2HNO₃ → 2NaNO₃ + H₂O + CO₂↑',
    phenomenon: '产生大量无色气泡（CO₂）',
    products: [{ chemical: 'NaNO3' }],
    gas: { label: 'CO₂', loss: 0.4 }
  },
  {
    id: 'co2-caco3-hcl',
    pair: ['CaCO3', 'HCl'],
    equation: 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑',
    phenomenon: '固体逐渐溶解并产生气泡（CO₂）',
    note: '这是实验室制取 CO₂ 的常用反应。',
    products: [{ chemical: 'CaCl2' }],
    gas: { label: 'CO₂', loss: 0.4 }
  },
  {
    id: 'co2-caco3-hno3',
    pair: ['CaCO3', 'HNO3'],
    equation: 'CaCO₃ + 2HNO₃ → Ca(NO₃)₂ + H₂O + CO₂↑',
    phenomenon: '固体逐渐溶解并产生气泡（CO₂）',
    products: [{ chemical: 'CaNO32' }],
    gas: { label: 'CO₂', loss: 0.4 }
  },

  /* ---------- 金属与酸（活动性顺序） ---------- */
  {
    id: 'h2-zn-hcl',
    pair: ['Zn', 'HCl'],
    equation: 'Zn + 2HCl → ZnCl₂ + H₂↑',
    phenomenon: '锌粒表面产生气泡（H₂）',
    products: [{ chemical: 'ZnCl2' }],
    gas: { label: 'H₂', loss: 0.3 }
  },
  {
    id: 'h2-zn-h2so4',
    pair: ['Zn', 'H2SO4'],
    equation: 'Zn + H₂SO₄ → ZnSO₄ + H₂↑',
    phenomenon: '锌粒表面产生气泡（H₂）',
    products: [{ chemical: 'ZnSO4' }],
    gas: { label: 'H₂', loss: 0.3 }
  },
  {
    id: 'h2-fe-hcl',
    pair: ['Fe', 'HCl'],
    equation: 'Fe + 2HCl → FeCl₂ + H₂↑',
    phenomenon: '产生气泡（H₂），溶液逐渐变成浅绿色',
    products: [{ chemical: 'FeCl2' }],
    gas: { label: 'H₂', loss: 0.3 }
  },
  {
    id: 'h2-fe-h2so4',
    pair: ['Fe', 'H2SO4'],
    equation: 'Fe + H₂SO₄ → FeSO₄ + H₂↑',
    phenomenon: '产生气泡（H₂），溶液逐渐变成浅绿色',
    products: [{ chemical: 'FeSO4' }],
    gas: { label: 'H₂', loss: 0.3 }
  },
  {
    id: 'h2-mg-hcl',
    pair: ['Mg', 'HCl'],
    equation: 'Mg + 2HCl → MgCl₂ + H₂↑',
    phenomenon: '剧烈反应，迅速产生气泡（H₂）',
    note: '镁比锌、铁活泼，反应速率明显更快。',
    products: [{ chemical: 'MgCl2' }],
    gas: { label: 'H₂', loss: 0.3 }
  },
  {
    id: 'h2-mg-h2so4',
    pair: ['Mg', 'H2SO4'],
    equation: 'Mg + H₂SO₄ → MgSO₄ + H₂↑',
    phenomenon: '剧烈反应，迅速产生气泡（H₂）',
    products: [{ chemical: 'MgSO4' }],
    gas: { label: 'H₂', loss: 0.3 }
  },

  /* ---------- 金属置换 ---------- */
  {
    id: 'cu-fe-cuso4',
    pair: ['Fe', 'CuSO4'],
    equation: 'Fe + CuSO₄ → FeSO₄ + Cu↓',
    phenomenon: '蓝色溶液褪去，析出红色固体铜',
    note: '活动性 Fe > Cu，所以铁能从铜盐溶液中置换出铜。',
    products: [{ chemical: 'FeSO4' }, { chemical: 'Cu', mass: 1 }]
  },
  {
    id: 'cu-zn-cuso4',
    pair: ['Zn', 'CuSO4'],
    equation: 'Zn + CuSO₄ → ZnSO₄ + Cu↓',
    phenomenon: '蓝色溶液褪去，锌粒表面析出红色铜',
    products: [{ chemical: 'ZnSO4' }, { chemical: 'Cu', mass: 1 }]
  },
  {
    id: 'cu-mg-cuso4',
    pair: ['Mg', 'CuSO4'],
    equation: 'Mg + CuSO₄ → MgSO₄ + Cu↓',
    phenomenon: '蓝色溶液褪去，析出红色铜',
    products: [{ chemical: 'MgSO4' }, { chemical: 'Cu', mass: 1 }]
  },
  {
    id: 'ag-cu-agno3',
    pair: ['Cu', 'AgNO3'],
    equation: 'Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag↓',
    phenomenon: '铜表面析出银白色的银，溶液逐渐变蓝',
    note: '活动性 Cu > Ag，所以铜能置换出银。',
    products: [{ chemical: 'CuNO32' }, { chemical: 'Ag', mass: 1 }]
  },

  /* ---------- 中和反应（放热） ---------- */
  {
    id: 'nacl-h2o',
    pair: ['HCl', 'NaOH'],
    equation: 'HCl + NaOH → NaCl + H₂O',
    phenomenon: '外观无明显变化，溶液放热、pH 趋于 7',
    note: '强酸与强碱中和生成盐和水，可用酚酞判断终点。',
    products: [{ chemical: 'NaCl' }],
    heat: 0.8
  },
  {
    id: 'kcl-h2o',
    pair: ['HCl', 'KOH'],
    equation: 'HCl + KOH → KCl + H₂O',
    phenomenon: '外观无明显变化，溶液放热、pH 趋于 7',
    products: [{ chemical: 'KCl' }],
    heat: 0.8
  },
  {
    id: 'na2so4-h2o',
    pair: ['H2SO4', 'NaOH'],
    equation: 'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O',
    phenomenon: '外观无明显变化，溶液放热、pH 趋于 7',
    products: [{ chemical: 'Na2SO4' }],
    heat: 0.8
  },
  {
    id: 'k2so4-h2o',
    pair: ['H2SO4', 'KOH'],
    equation: 'H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O',
    phenomenon: '外观无明显变化，溶液放热、pH 趋于 7',
    products: [{ chemical: 'K2SO4' }],
    heat: 0.8
  },
  {
    id: 'nano3-h2o',
    pair: ['HNO3', 'NaOH'],
    equation: 'HNO₃ + NaOH → NaNO₃ + H₂O',
    phenomenon: '外观无明显变化，溶液放热、pH 趋于 7',
    products: [{ chemical: 'NaNO3' }],
    heat: 0.8
  },
  {
    id: 'kno3-h2o',
    pair: ['HNO3', 'KOH'],
    equation: 'HNO₃ + KOH → KNO₃ + H₂O',
    phenomenon: '外观无明显变化，溶液放热、pH 趋于 7',
    products: [{ chemical: 'KNO3' }],
    heat: 0.8
  },

  /* ---------- 受热分解（温度门槛） ---------- */
  {
    id: 'nahco3-decompose',
    pair: ['NaHCO3'],
    minTemperature: 80,
    equation: '2NaHCO₃ →(Δ) Na₂CO₃ + H₂O + CO₂↑',
    phenomenon: '白色固体减少，试管口出现水珠并放出气体',
    products: [
      { chemical: 'Na2CO3', state: 'solid', color: '#f1efe6' },
      { chemical: 'H2O' }
    ],
    gas: { label: 'CO₂', loss: 0.4 },
    note: '碳酸氢钠受热就分解，所以要用小火加热、并及时把导管移出水面。'
  },
  {
    id: 'cuoh2-decompose',
    pair: ['CuOH2'],
    minTemperature: 80,
    equation: 'Cu(OH)₂ →(Δ) CuO + H₂O',
    phenomenon: '蓝色沉淀变成黑色固体（CuO）',
    products: [{ chemical: 'CuO' }, { chemical: 'H2O' }],
    note: '蓝色变黑是氢氧化铜受热分解成氧化铜，说明它不稳定。'
  },
  {
    id: 'caco3-decompose',
    pair: ['CaCO3'],
    minTemperature: 120,
    equation: 'CaCO₃ →(Δ) CaO + CO₂↑',
    phenomenon: '固体变白、变疏松，放出使澄清石灰水变浑浊的气体',
    products: [{ chemical: 'CaO' }],
    gas: { label: 'CO₂', loss: 0 },
    note: '工业上煅烧石灰石制生石灰，需要高温（约 800°C 以上），这里用干烧近似。'
  }
];

/* ============================ 引擎 ============================ */

/* 找出第一对可以反应的组合；规则顺序即优先级，minTemperature 挡住低温。 */
function findRule(contents, temperature) {
  var heat = typeof temperature === 'number' ? temperature : 25;

  for (var i = 0; i < RULES.length; i += 1) {
    var rule = RULES[i];
    if (typeof rule.minTemperature === 'number' && heat < rule.minTemperature) continue;

    var first = indexOfChemical(contents, rule.pair[0]);
    if (first < 0 || entryQuantity(contents[first]) < PORTION) continue;

    /* 单反应物规则（受热分解）：只要这一种物质够了就算匹配。 */
    if (rule.pair.length === 1) return rule;

    var second = indexOfChemical(contents, rule.pair[1]);
    if (second < 0 || entryQuantity(contents[second]) < PORTION) continue;
    return rule;
  }
  return null;
}

function productEntry(product) {
  var species = speciesOf(product.chemical) || {};
  var state = product.state || (species.solid ? 'solid' : 'liquid');
  var solid = state === 'solid';

  return {
    chemical: product.chemical,
    label: species.label || product.chemical,
    name: species.name || product.chemical,
    state: state,
    volume: solid ? 0 : product.volume || 0,
    mass: solid ? product.mass || PORTION : 0,
    color: product.color || species.color || '#e2ecef'
  };
}

/*
 * 结算一次反应：每种反应物各消耗一份，液体体积转给液体产物，
 * 气体带走 gas.loss 毫升，固体产物按 1g/次 沉积。
 */
function settleOnce(contents, rule, temperature) {
  var next = contents.map(function (entry) {
    return Object.assign({}, entry);
  });
  var liquidPool = 0;
  var solidPool = 0;

  rule.pair.forEach(function (chemical) {
    var index = indexOfChemical(next, chemical);
    if (index < 0) return;
    var entry = next[index];

    if (entry.state === 'solid') {
      entry.mass = round1((entry.mass || 0) - PORTION);
      solidPool = round1(solidPool + PORTION);
      if (entry.mass <= 0.05) next.splice(index, 1);
      return;
    }

    var taken = Math.min(PORTION, entry.volume || 0);
    liquidPool += taken;
    entry.volume = round1((entry.volume || 0) - taken);
    if (entry.volume <= 0.05) next.splice(index, 1);
  });

  var loss = rule.gas ? Math.min(rule.gas.loss, liquidPool) : 0;
  var remaining = round1(Math.max(0, liquidPool - loss));
  /* 纯固体受热分解没有液体可分配，就把消耗掉的固体折算成产物液体（1g ≈ 1mL）。 */
  var pool = remaining > 0 ? remaining : solidPool;

  var liquidProducts = [];
  var solidProducts = [];
  rule.products.forEach(function (product) {
    var species = speciesOf(product.chemical) || {};
    var declared = product.state || (species.solid ? 'solid' : 'liquid');
    if (declared === 'solid') solidProducts.push(product);
    else liquidProducts.push(product);
  });

  var share = liquidProducts.length > 0 ? round1(pool / liquidProducts.length) : 0;

  liquidProducts.forEach(function (product) {
    if (share <= 0) return;
    var entry = productEntry(product);
    entry.volume = share;
    addEntry(next, entry);
  });

  solidProducts.forEach(function (product) {
    addEntry(next, productEntry(product));
  });

  var heat = rule.heat || 0;
  var nextTemperature = heat > 0 ? Math.min(HEAT_CAP, round1(temperature + heat)) : temperature;

  return { contents: next, temperature: nextTemperature };
}

/*
 * 对容器内容反复匹配规则，直到没有可反应的组合。
 * temperature 同时参与匹配：低于规则的 minTemperature 时受热分解不会发生。
 * 返回 { contents, temperature, events, changed }；
 * events 按规则聚合，times 记录本次操作中发生的次数。
 */
export function reactContents(contents, temperature) {
  var working = contents.map(function (entry) {
    return Object.assign({}, entry);
  });
  var current = typeof temperature === 'number' ? temperature : 25;
  var events = [];
  var rounds = 0;

  while (rounds < MAX_ROUNDS) {
    rounds += 1;
    var rule = findRule(working, current);
    if (!rule) break;

    var settled = settleOnce(working, rule, current);
    working = settled.contents;
    current = settled.temperature;

    var record = null;
    for (var i = 0; i < events.length; i += 1) {
      if (events[i].rule.id === rule.id) record = events[i];
    }
    if (record) record.times += 1;
    else events.push({ rule: rule, times: 1 });
  }

  return {
    contents: working,
    temperature: current,
    events: events,
    changed: events.length > 0
  };
}

/* 生成一条可直接写入实验日志的反应记录。 */
export function describeReaction(event) {
  var rule = event.rule;
  var text = rule.equation + '（' + rule.phenomenon;
  if (event.times > 1) text += '，共 ' + event.times + ' 次';
  text += '）。';
  if (rule.note) text += rule.note;
  return text;
}

/* 气体现象：把最近一次放气转成日志文案。 */
export function describeGas(events) {
  var gasEvent = null;
  events.forEach(function (event) {
    if (event.rule.gas) gasEvent = event;
  });
  if (!gasEvent) return null;

  return '有气泡从液面逸出（' + gasEvent.rule.gas.label + '↑）。';
}

/* 判断容器里是否含有指示剂。 */
export function hasIndicator(contents) {
  return (
    indexOfChemical(contents, 'phenolphthalein') >= 0 || indexOfChemical(contents, 'litmus') >= 0
  );
}

/* 指示剂显色：返回覆盖液体的颜色；无色或没有指示剂时返回 null。 */
export function indicatorTint(contents, ph) {
  if (typeof ph !== 'number') return null;

  if (indexOfChemical(contents, 'phenolphthalein') >= 0) {
    return ph >= 8.2 ? '#d4728f' : null;
  }

  if (indexOfChemical(contents, 'litmus') >= 0) {
    if (ph <= 5) return '#c07a80';
    if (ph >= 8) return '#6f86b8';
    return '#8f83a8';
  }

  return null;
}

/* 指示剂变色的说明文字，用于写日志。 */
export function indicatorText(contents, ph) {
  if (typeof ph !== 'number') return '';
  var value = ph.toFixed(1);

  if (indexOfChemical(contents, 'phenolphthalein') >= 0) {
    return ph >= 8.2
      ? '酚酞遇碱变红（pH ' + value + '）。'
      : '酚酞在酸性或中性溶液中无色（pH ' + value + '）。';
  }

  if (indexOfChemical(contents, 'litmus') >= 0) {
    if (ph <= 5) return '石蕊遇酸变红（pH ' + value + '）。';
    if (ph >= 8) return '石蕊遇碱变蓝（pH ' + value + '）。';
    return '石蕊在近中性溶液中呈紫色（pH ' + value + '）。';
  }

  return '';
}


