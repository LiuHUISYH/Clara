/**
 * art.js —— 器材的真实尺寸表与几何基准（1 单位 = 1 mm）
 * ------------------------------------------------------------------
 * 实验室里所有器材共用一把尺子：**1 个单位 = 1 毫米**，页面上 1 单位渲染成
 * 1 个 CSS 像素（PX_PER_MM）。因此
 *   · 250mL 烧杯 78×100（含导流槽，杯身 φ68×90）
 *   · 20mL 试管 20×152（管身 φ16×146）
 *   · 铁架台 200×560（底板 200×14，立杆 φ10，铁圈 φ92）
 * 摆在一起就是真实实验台上的比例，不需要任何「美术缩放」。
 *
 * 每个器型给出四类几何，绘图与物理判定只读这里：
 *   size     实体在画布上占的矩形（mm），SVG 的 viewBox 就是 0 0 size.width size.height
 *   base     器底（接触桌面 / 石棉网 / 铁圈的那条线）在 size 里的 y
 *   mouth    瓶口椭圆中心（倾倒对准、水柱起点）
 *   top/bottom/x/width   液体可用的内腔范围（液面高度按它映射）
 *
 * Glass.jsx 只负责「怎么画」，store.js 只负责「怎么算」，两边都从这里取数，
 * 于是画面、碰撞盒、吸附点、火焰判定永远一致。
 */

export var PX_PER_MM = 1;

/* ---------------- 玻璃容器 ---------------- */

export var GLASS = {
  /*
   * 烧杯（250 mL）：直筒杯身 φ68×90，右侧导流槽（倒液时看得见液体从哪边出去），
   * 杯壁丝印 50 / 100 / 150 / 200 mL 刻度。body 同时是描边与裁切轮廓。
   */
  beaker: {
    size: { width: 78, height: 100 },
    base: 98,
    top: 10.5,
    bottom: 95,
    x: 6.4,
    width: 61.2,
    body: 'M4 8 H70.4 L77.8 4.4 Q75.4 3.2 73.8 7.6 V92 Q73.8 98 67.8 98 H10 Q4 98 4 92 Z',
    spout: 'M70.4 8 L77.8 4.4 Q75.4 3.2 73.8 7.6 Z',
    spoutArc: 'M70.8 8.4 Q74.4 6.6 77 4.6',
    rim: 'M4 8 H70.4',
    mouth: { cx: 39, cy: 8, rx: 33, ry: 2.2 },
    mouthArc: 'M6 9.6 Q39 13.4 71.6 9.4',
    wall: 'M6.8 12 V91.6 Q7.2 95.4 10.6 95.8',
    edge: 'M72.2 10 V91.8 Q72.2 96.4 67 96.4',
    bottomArc: 'M10.4 94.6 Q39 98.4 67.6 94.6',
    highlight: 'M9 16 V89',
    highlightSoft: 'M69.4 18 V74',
    gloss: { cx: 14.6, cy: 58, rx: 7, ry: 34 },
    graduations: [
      { y: 27.4, text: '200', x1: 7.2, x2: 14, tx: 15.6, anchor: 'start' },
      { y: 44.3, text: '150', x1: 7.2, x2: 14, tx: 15.6, anchor: 'start' },
      { y: 61.2, text: '100', x1: 7.2, x2: 14, tx: 15.6, anchor: 'start' },
      { y: 78.1, text: '50', x1: 7.2, x2: 14, tx: 15.6, anchor: 'start' }
    ],
    ticks: [
      [35.9, 7.2, 11.4],
      [52.8, 7.2, 11.4],
      [69.7, 7.2, 11.4]
    ]
  },

  /* 试管（20 mL）：φ16×146 圆底，管口微微外翻，刻度 5 / 10 / 15 mL。 */
  'test-tube': {
    size: { width: 20, height: 152 },
    base: 150,
    top: 6.4,
    bottom: 146,
    x: 3.6,
    width: 12.8,
    body: 'M2 4 V132 Q2 150 10 150 Q18 150 18 132 V4 Z',
    mouth: { cx: 10, cy: 4.2, rx: 7.6, ry: 1.6 },
    rim: 'M1.8 4 H18.2',
    mouthArc: 'M2.6 5.6 Q10 8 17.4 5.6',
    edge: 'M16.6 6.4 V131 Q16.6 147.4 10 147.4 Q4.6 147.4 3.6 141',
    bottomArc: 'M5 148 Q10 150.4 15 148',
    highlight: 'M4.4 8 V128',
    highlightSoft: 'M15.4 10 V40',
    gloss: { cx: 5.6, cy: 80, rx: 1.8, ry: 46 },
    graduations: [
      { y: 41.8, text: '15', x1: 3.4, x2: 7.6, tx: 8.8, anchor: 'start' },
      { y: 77.2, text: '10', x1: 3.4, x2: 7.6, tx: 8.8, anchor: 'start' },
      { y: 112.6, text: '5', x1: 3.4, x2: 7.6, tx: 8.8, anchor: 'start' }
    ],
    ticks: [
      [59.5, 3.4, 6.2],
      [95, 3.4, 6.2]
    ]
  },

  /* 锥形瓶（250 mL）：16 宽瓶颈 → φ84 瓶底，瓶身 106 高。 */
  erlenmeyer: {
    size: { width: 90, height: 110 },
    base: 106,
    top: 42,
    bottom: 102,
    x: 12,
    width: 66,
    body: 'M37 6 H53 V40 L82 96 Q85.6 106 76 106 H14 Q4.4 106 8 96 L37 40 Z',
    mouth: { cx: 45, cy: 6, rx: 7, ry: 2 },
    rim: 'M36.6 6 H53.4',
    mouthArc: 'M38 7.8 Q45 10.4 52 7.8',
    neckHighlight: 'M39.6 11 V36',
    highlight: 'M18.6 96 Q26 74 36 46',
    highlightSoft: 'M74 94 Q64 72 52 44',
    edge: 'M79 94 Q82.6 102 74 104.6',
    bottomArc: 'M16 100 Q45 106.4 74 100',
    ticks: [
      [58, 46, 54],
      [72, 40, 50]
    ]
  },

  /* 圆底烧瓶（250 mL）：φ82 球体 + 18 宽瓶颈。 */
  'round-flask': {
    size: { width: 94, height: 114 },
    base: 112,
    top: 40,
    bottom: 108,
    x: 8,
    width: 78,
    body:
      'M38 6 H56 V32 C70 41 88 52 88 72 C88 96 70 112 47 112 C24 112 6 96 6 72 C6 52 24 41 38 32 Z',
    mouth: { cx: 47, cy: 6, rx: 7, ry: 2 },
    rim: 'M37.6 6 H56.4',
    mouthArc: 'M39 7.8 Q47 10.4 55 7.8',
    neckHighlight: 'M40.6 10.6 V30',
    highlight: 'M16.4 74 Q17.4 54 28 40',
    highlightSoft: 'M79 70 Q77 52 66 40',
    edge: 'M84.6 74 Q83 92 68 104',
    bottomArc: 'M29 104 Q47 111.4 65 104'
  },

  /* 容量瓶（100 mL）：φ58 球体 + 12 宽瓶颈 + 环状刻度线。 */
  'volumetric-flask': {
    size: { width: 68, height: 124 },
    base: 120,
    top: 38,
    bottom: 116,
    x: 6,
    width: 56,
    body:
      'M28 6 H40 V44 C52 49 64 60 64 78 C64 104 50 120 34 120 C18 120 4 104 4 78 C4 60 16 49 28 44 Z',
    mouth: { cx: 34, cy: 6, rx: 5.4, ry: 1.8 },
    rim: 'M27.6 6 H40.4',
    mouthArc: 'M28.6 7.6 Q34 10 39.4 7.6',
    neckHighlight: 'M30.2 10.4 V41',
    highlight: 'M12.4 78 Q13.6 62 22.6 48',
    highlightSoft: 'M58.6 74 Q56.6 58 46 47',
    edge: 'M62.6 78 Q61 100 46 114',
    bottomArc: 'M20.4 110 Q34 118 47.6 110',
    mark: 'M9.4 52 Q34 56.6 58.6 52'
  },

  /*
   * 试剂瓶（500 mL 细口瓶）：φ54×140 瓶身 + 颈 + 玻璃塞 + 白底黑字标签；
   * 预置试剂瓶复用这个器型（item.label 决定标签上的四行文字）。
   */
  'reagent-bottle': {
    size: { width: 62, height: 182 },
    base: 180,
    top: 40,
    bottom: 178,
    x: 6.4,
    width: 48.8,
    body:
      'M23 32 V18 Q23 15 26.6 15 H35.4 Q39 15 39 18 V32 Q49 34 53.6 40 Q57.6 46 57.6 53 V172 Q57.6 180 49.6 180 H12.4 Q4.4 180 4.4 172 V53 Q4.4 46 8.4 40 Q13 34 23 32 Z',
    mouth: { cx: 31, cy: 15, rx: 8, ry: 1.8 },
    neckRing: 'M22.6 17.6 H39.4',
    mouthArc: 'M23 17 Q31 19.6 39 17',
    wall: 'M7.2 56 V170',
    edge: 'M55.2 56 V168 Q55.2 177 48.6 178',
    bottomArc: 'M13.6 174 Q31 179.6 48 174',
    highlight: 'M8.8 60 V164',
    highlightSoft: 'M52.6 64 V130',
    gloss: { cx: 11.4, cy: 128, rx: 3.6, ry: 40 },
    ticks: [],
    labelRect: { x: 9, y: 88, width: 44, height: 46 },
    labelBand: { x: 9, y: 88, width: 44, height: 3.2 },
    stopper: {
      plug: 'M24.6 16.4 L25.8 8.8 H36.2 L37.4 16.4 Z',
      knob: 'M31 0.8 Q37.2 0.8 37.2 5.2 Q37.2 9.6 31 9.6 Q24.8 9.6 24.8 5.2 Q24.8 0.8 31 0.8 Z',
      spec: 'M27.4 3.6 Q27.4 2.2 28.8 1.9',
      hit: { x: 21, y: 0.2, width: 20, height: 18 }
    }
  }
};

/* ---------------- 工具 ---------------- */

export var TOOLS = {
  /* 酒精灯：φ72 玻璃灯体 114 高，金属灯芯管 + 灯芯，火焰 8~38（焰尖 y=8）。 */
  burner: {
    size: { width: 80, height: 118 },
    base: 114,
    flameTip: 8,
    flameBase: 38,
    flameX: 40
  },

  /*
   * 铁架台：200×560。底板 200×14，立杆 φ10（x 148~158），
   * 铁圈外径 92 / 内径 80，圈心 (98, 400) —— 台面上方 160mm，
   * 夹住的试管正好落在酒精灯火焰上方。
   */
  stand: {
    size: { width: 200, height: 560 },
    base: 560,
    rod: { x: 153, width: 10, top: 14 },
    basePlate: { x: 0, y: 546, width: 200, height: 14 },
    ring: { x: 98, y: 400, rx: 46, ry: 13, inner: 40 },
    arm: { x1: 138, x2: 153 }
  },

  /* 石棉网：120×10 的金属框 + 中间白色石棉垫（真实 12.5cm 见方）。 */
  'wire-gauze': {
    size: { width: 120, height: 10 },
    base: 10,
    top: 0,
    pad: { cx: 60, cy: 5, rx: 34, ry: 4.2 }
  },

  /* 玻璃棒：φ6×236，手工圆头。杆尖 (5, 238) 是搅拌时的转轴。 */
  rod: {
    size: { width: 10, height: 240 },
    base: 240,
    tip: { x: 5, y: 238 }
  },

  /* 胶头滴管：φ4.8 玻璃管 + 橡胶头，全长 112。 */
  dropper: {
    size: { width: 24, height: 112 },
    base: 110,
    bulb: { cx: 12, cy: 16, rx: 9, ry: 15 }
  },

  /* 火柴：梗 φ1.6×42 + 火柴头，全长 54。 */
  match: {
    size: { width: 12, height: 54 },
    base: 52,
    head: { cx: 6, cy: 9, rx: 2.6, ry: 4 }
  },

  /* pH 试纸：8×50 的纸条。 */
  'ph-paper': {
    size: { width: 16, height: 54 },
    base: 52
  }
};

/* 没在表里的器具（理论上不会出现）用一个安全默认值，避免页面炸掉。 */
var FALLBACK = { size: { width: 60, height: 90 }, base: 90 };

/* 按实体类型取几何：容器查 GLASS，工具查 TOOLS。 */
export function artOf(type) {
  return GLASS[type] || TOOLS[type] || FALLBACK;
}

/* 实体在画布上占的矩形（mm → px）。 */
export function sizeOf(type) {
  var art = artOf(type);
  return { width: art.size.width * PX_PER_MM, height: art.size.height * PX_PER_MM };
}

/* 器底在实体内的 y（没有 base 字段的工具退化成整个高度）。 */
export function baseOf(type) {
  var art = artOf(type);
  return (typeof art.base === 'number' ? art.base : art.size.height) * PX_PER_MM;
}

/* 瓶口中心的 y（相对实体顶）；没有瓶口的工具给 0。 */
export function mouthYOf(type) {
  var art = artOf(type);
  return art.mouth ? art.mouth.cy * PX_PER_MM : 0;
}
