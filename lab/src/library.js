/**
 * library.js —— 虚拟实验室的器材与试剂清单
 * ------------------------------------------------------------------
 * kind 区分容器、工具与试剂；容器带容量，试剂带默认加入量和物态。
 * 试剂名称使用中文，chemical 保留 ASCII 化学式供反应引擎匹配。
 */

export const LAB_LIBRARY = [
  {
    id: 'glassware',
    label: '基础容器',
    items: [
      { id: 'beaker', name: '烧杯', kind: 'container', capacity: 250 },
      { id: 'test-tube', name: '试管', kind: 'container', capacity: 20 },
      { id: 'erlenmeyer', name: '锥形瓶', kind: 'container', capacity: 250 },
      { id: 'round-flask', name: '圆底烧瓶', kind: 'container', capacity: 250 },
      { id: 'volumetric-flask', name: '容量瓶', kind: 'container', capacity: 100 }
    ]
  },
  {
    id: 'tools',
    label: '辅助工具',
    items: [
      { id: 'burner', name: '酒精灯', kind: 'tool' },
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
      { id: 'caco3', name: '碳酸钙', formula: 'CaCO₃', chemical: 'CaCO3', kind: 'reagent', state: 'solid', defaultMass: 1 }
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
