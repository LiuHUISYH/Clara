/**
 * library.js —— 虚拟实验室的器材与试剂清单
 * ------------------------------------------------------------------
 * kind 区分容器、工具与试剂；容器带容量，试剂带默认加入量和物态。
 * 试剂名称使用中文，chemical 保留 ASCII 化学式供反应引擎匹配。
 *
 * 「预置试剂瓶」是实验室里最常拿的东西：不是空烧杯，而是贴好标签、装好液体、
 * 塞着瓶塞的整瓶试剂。这类条目的字段：
 *   shape    指向 Glass.jsx 的器型（细口瓶），store 用它做 item.type
 *   stock    true 表示「出厂预置」，日志用「拖拽 … 至 实验台」，不进试剂通道
 *   label    瓶身标签（白底黑字）上的四行文字
 *   reagent  预置内容物，store 建实体时直接灌进去（体积按 capacity 计）
 */
export const LAB_LIBRARY = [
  {
    id: 'stocks',
    label: '预置试剂瓶',
    items: [
      {
        id: 'stock-hcl',
        name: '盐酸试剂瓶',
        formula: 'HCl',
        shape: 'reagent-bottle',
        kind: 'container',
        capacity: 500,
        stopper: true,
        stock: true,
        swatch: '#e2ecef',
        label: { title: '盐酸', formula: 'HCl', grade: '分析纯 AR', volume: '500mL', band: '#b8453a' },
        reagent: { chemical: 'HCl', label: 'HCl', state: 'liquid', volume: 500 }
      },
      {
        id: 'stock-naoh',
        name: '氢氧化钠试剂瓶',
        formula: 'NaOH',
        shape: 'reagent-bottle',
        kind: 'container',
        capacity: 500,
        stopper: true,
        stock: true,
        swatch: '#e8eeef',
        label: { title: '氢氧化钠', formula: 'NaOH', grade: '分析纯 AR', volume: '500mL', band: '#3a6fb5' },
        reagent: { chemical: 'NaOH', label: 'NaOH', state: 'liquid', volume: 500 }
      },
      {
        id: 'stock-cuso4',
        name: '硫酸铜试剂瓶',
        formula: 'CuSO₄',
        shape: 'reagent-bottle',
        kind: 'container',
        capacity: 500,
        stopper: true,
        stock: true,
        swatch: '#4f8bc8',
        label: { title: '硫酸铜', formula: 'CuSO₄', grade: '分析纯 AR', volume: '500mL', band: '#3a6fb5' },
        reagent: { chemical: 'CuSO4', label: 'CuSO₄', state: 'liquid', volume: 500 }
      }
    ]
  },
  {
    id: 'glassware',
    label: '基础容器',
    items: [
      { id: 'beaker', name: '烧杯', kind: 'container', capacity: 250 },
      { id: 'test-tube', name: '试管', kind: 'container', capacity: 20 },
      { id: 'erlenmeyer', name: '锥形瓶', kind: 'container', capacity: 250 },
      { id: 'round-flask', name: '圆底烧瓶', kind: 'container', capacity: 250 },
      { id: 'volumetric-flask', name: '容量瓶', kind: 'container', capacity: 100 },
      /* stopper: 带瓶塞的细口瓶，必须先开塞才能倒液或加试剂（store.open 门禁）。 */
      { id: 'reagent-bottle', name: '试剂瓶', kind: 'container', capacity: 250, stopper: true }
    ]
  },
  {
    id: 'tools',
    label: '辅助工具',
    items: [
      { id: 'burner', name: '酒精灯', kind: 'tool' },
      { id: 'match', name: '火柴', kind: 'tool' },
      { id: 'stand', name: '铁架台', kind: 'tool' },
      { id: 'rod', name: '玻璃棒', kind: 'tool' },
      { id: 'dropper', name: '胶头滴管', kind: 'tool' },
      { id: 'wire-gauze', name: '石棉网', kind: 'tool' },
      { id: 'ph-paper', name: 'pH 试纸', kind: 'tool' }
    ]
  },
  {
    id: 'acids',
    label: '强酸 / 强碱',
    items: [
      { id: 'hcl', name: '盐酸', formula: 'HCl', chemical: 'HCl', kind: 'reagent', state: 'liquid', defaultVolume: 10 },
      { id: 'h2so4', name: '硫酸', formula: 'H₂SO₄', chemical: 'H2SO4', kind: 'reagent', state: 'liquid', defaultVolume: 10 },
      { id: 'hno3', name: '硝酸', formula: 'HNO₃', chemical: 'HNO3', kind: 'reagent', state: 'liquid', defaultVolume: 10 },
      { id: 'naoh', name: '氢氧化钠', formula: 'NaOH', chemical: 'NaOH', kind: 'reagent', state: 'liquid', defaultVolume: 10 },
      { id: 'koh', name: '氢氧化钾', formula: 'KOH', chemical: 'KOH', kind: 'reagent', state: 'liquid', defaultVolume: 10 }
    ]
  },
  {
    id: 'salts',
    label: '盐类',
    items: [
      { id: 'nacl', name: '氯化钠', formula: 'NaCl', chemical: 'NaCl', kind: 'reagent', state: 'liquid', defaultVolume: 10 },
      { id: 'cuso4', name: '硫酸铜', formula: 'CuSO₄', chemical: 'CuSO4', kind: 'reagent', state: 'liquid', defaultVolume: 10 },
      { id: 'agno3', name: '硝酸银', formula: 'AgNO₃', chemical: 'AgNO3', kind: 'reagent', state: 'liquid', defaultVolume: 10 },
      { id: 'bacl2', name: '氯化钡', formula: 'BaCl₂', chemical: 'BaCl2', kind: 'reagent', state: 'liquid', defaultVolume: 10 },
      { id: 'na2co3', name: '碳酸钠', formula: 'Na₂CO₃', chemical: 'Na2CO3', kind: 'reagent', state: 'liquid', defaultVolume: 10 },
      { id: 'caco3', name: '碳酸钙', formula: 'CaCO₃', chemical: 'CaCO3', kind: 'reagent', state: 'solid', defaultMass: 1 },
      { id: 'nahco3', name: '碳酸氢钠', formula: 'NaHCO₃', chemical: 'NaHCO3', kind: 'reagent', state: 'solid', defaultMass: 1 }
    ]
  },
  {
    id: 'indicators',
    label: '指示剂',
    items: [
      { id: 'phenolphthalein', name: '酚酞', formula: 'C₂₀H₁₄O₄', chemical: 'phenolphthalein', logName: '酚酞', kind: 'reagent', state: 'liquid', defaultVolume: 1 },
      { id: 'litmus', name: '石蕊', formula: '', chemical: 'litmus', logName: '石蕊', kind: 'reagent', state: 'liquid', defaultVolume: 1 }
    ]
  },
  {
    id: 'metals',
    label: '固体单质',
    items: [
      { id: 'fe', name: '铁', formula: 'Fe', chemical: 'Fe', kind: 'reagent', state: 'solid', defaultMass: 1 },
      { id: 'cu', name: '铜', formula: 'Cu', chemical: 'Cu', kind: 'reagent', state: 'solid', defaultMass: 1 },
      { id: 'zn', name: '锌', formula: 'Zn', chemical: 'Zn', kind: 'reagent', state: 'solid', defaultMass: 1 },
      { id: 'mg', name: '镁', formula: 'Mg', chemical: 'Mg', kind: 'reagent', state: 'solid', defaultMass: 1 }
    ]
  }
];

export const LAB_ITEM_COUNT = LAB_LIBRARY.reduce(function (total, group) {
  return total + group.items.length;
}, 0);

export const LAB_REAGENTS = LAB_LIBRARY.reduce(function (all, group) {
  return all.concat(
    group.items.filter(function (item) {
      return item.kind === 'reagent';
    })
  );
}, []);
