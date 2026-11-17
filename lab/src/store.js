/**
 * store.js —— 虚拟实验室的 Zustand 全局状态、实体几何与容器操作
 * ------------------------------------------------------------------
 * 实体统一模型（简化 ECS）：{ id, type, dimensions, x, y, contents, temperature,
 * color, ph, volume, capacity, open, clamp, ... }。几何判定不读 DOM：
 *   boundsOf()  绝对包围盒      mouthPoint()  瓶口中心
 *   overlaps()  AABB 相交       pourAlign()   倾倒对准（悬停 / 叠放 / canPour）
 * 加试剂、倾倒产生的混合都会先经过 reactions.js 的规则引擎（反应、沉淀、
 * 放气、放热、指示剂变色），再由 syncItem() 统一重算体积、颜色、pH 与浑浊度。
 * 搅拌（玻璃棒）与加热都是「随时间推进」的动作：页面按固定节奏调用
 * tickStir / tickHeating，容积、温度、溶解量的每一次变化都回到 syncItem。
 */

import { create } from 'zustand';
import { artOf, baseOf, mouthYOf, sizeOf, TOOLS } from './art';
import {
  reactContents,
  describeReaction,
  describeGas,
  hasIndicator,
  indicatorTint,
  indicatorText,
  speciesColor,
  speciesPh,
  speciesSoluble
} from './reactions';

/* 气泡的显示时长：tickHeating 到期后清除 gas 标记。 */
var GAS_DURATION = 6000;

/* ---------------- 加热模型 ----------------
 * 点燃的酒精灯不是「靠近就加热」，而是按火焰位置做碰撞判定：容器必须真的架在
 * 火焰上方，横向对准、纵向高度合适才算受热（见 inFlame）。
 *
 * 几何全部来自 art.js 的毫米表，不再有「令牌缩放」这一层：
 *   火焰尖端   y=8、焰心 x=40（酒精灯 80×118 的灯体里，焰尖就在灯肩上方）
 *   容器玻璃底 各自 art.base（烧杯 98、试管 150、锥形瓶 106、圆底烧瓶 112 …）
 * 于是判定就是毫米级的：横向 ±26mm 内、器底比焰尖高不超过 26mm，
 * 最多允许探进火苗 20mm（真实实验里烧杯底确实会压进外焰一点）。
 *
 * 受热每秒升温 HEAT_RATE：有液体止于沸点并转入沸腾（bubbles 变密、副标题标「沸腾」），
 * 空容器干烧止于 DRY_LIMIT；离开火焰每秒降温 COOL_RATE 直到回到室温。
 * 所有温度更新都经过 syncItem()。
 */
var FLAME_CENTRE_X = TOOLS.burner.flameX;
var FLAME_TIP_Y = TOOLS.burner.flameTip;
var FLAME_X_RANGE = 26;
var FLAME_GAP = 26;
var FLAME_OVERLAP = 20;
var HEAT_RATE = 4;
var COOL_RATE = 2;
var AMBIENT = 25;
var BOIL_POINT = 100;
var DRY_LIMIT = 160;

/* ---------------- 石棉网匀热 ----------------
 * 玻璃容器直接架在焰尖上受热不均，实验规范是垫一张石棉网：网面把火焰摊开，
 * 容器坐在网面上，离焰尖反而更远。石棉网在 art.js 里是 120×10 的薄片：
 *   网面顶 y=0、网面底 y=10，网心 x=60。
 *
 * 于是加热变成两段判定：火焰 → 石棉网（gauzeInFlame）、石棉网 → 容器（onGauze）。
 * 容器坐在石棉网上时底部离焰尖 10mm 以上，单纯用 inFlame 判不到，所以由
 * heatSource() 把「直接受热」和「隔着石棉网受热」两条路径合成一个结论。
 */
var GAUZE_TOP_Y = TOOLS['wire-gauze'].top;
var GAUZE_BOTTOM_Y = TOOLS['wire-gauze'].base;
var GAUZE_X_RANGE = 44;
var GAUZE_GAP = 4;
var GAUZE_OVERLAP = 4;
var GAUZE_FLAME_GAP = 10;
var GAUZE_FLAME_OVERLAP = 8;
/* 直接受热到这个温度就开始受热不均，记一条建议垫石棉网的警告。 */
var UNEVEN_TEMPERATURE = 60;

/* ---------------- 铁架台夹持 ----------------
 * 铁架台 200×560，铁圈外径 92、圈心在 art.js 的 (98, 400) —— 台面上方 160mm。
 * 容器松手时玻璃底中心离圈心小于 CLAMP_RADIUS，或直接落在铁架台上，就夹进去：
 * 夹住后 x 对准圈心、玻璃底落在圈心，容器进入锁定态（clamp / clampedTo），
 * 不能再单独拖动，必须先「取下」（releaseClamp）；移动铁架台时夹着的容器
 * 作为刚体跟着一起走（见 moveItem）。夹在台上的容器离台面更高，火焰判定
 * 放宽到 CLAMP_HEAT_GAP，把酒精灯放到试管正下方就能受热。
 */
var STAND_RING_X = TOOLS.stand.ring.x;
var STAND_RING_Y = TOOLS.stand.ring.y;
/* 吸附半径：玻璃底中心到圈心的距离（圈半径 46 + 一点余量）。 */
var CLAMP_RADIUS = 52;
/* 夹住的试管底在台面上方 160mm，火焰尖端约 110mm：留 64mm 的判定余量。 */
var CLAMP_HEAT_GAP = 64;

/* 画布底边到台面线的距离：器材落在台面上时 base 就压在这条线上。 */
var DESK_MARGIN = 58;

/* ---------------- 玻璃棒搅拌 ----------------
 * 搅拌是「握住玻璃棒在液体里打旋」的一次限时动作：STIR_DURATION 内页面每 120ms
 * 调一次 tickStir 推进，期间
 *   · 玻璃棒插进液面、小幅摇摆（LabPage 加 lab-vessel--stirring-rod 类名）；
 *   · 液面出现涡流凹面与打旋亮弧（Glass.jsx 的 Swirl）；
 *   · 可溶固体按 DISSOLVE_STEP / tick 溶解成同种物质的溶液（1g ≈ 1mL）；
 *   · 受热更均匀（不再判「受热不均」）且升温更快（STIR_HEAT_RATE）。
 * 时间到自动停手：玻璃棒挪到容器右侧待用，放空容器 / 移走容器时也会被收手。
 *
 * 玻璃棒的落点由杆尖反算：art.js 里玻璃棒是 10×240，杆尖就在 (5, 238)，
 * CSS 的摇摆也绕这一点转。所以只要把「杆尖坐标」对准「液面下 8~18mm 的搅拌点」，
 * 棒子的角度怎么摆都不会悬空搅空气。
 */
var STIR_DURATION = 4200;
var STIR_HEAT_RATE = 6;
var DISSOLVE_STEP = 0.12;
var ROD_TIP_X = TOOLS.rod.tip.x;
var ROD_TIP_Y = TOOLS.rod.tip.y;
/* 收手后停在容器右侧 12mm、器底与容器同一条台面线上。 */
var ROD_PARK_GAP = 12;

/* ---------------- 液面几何（和 Glass.jsx 的液体绘制同一套） ----------------
 * Glass.jsx 里液体高度 = (bottom − top) × (体积 / 容量)^0.75，最薄留 6mm；
 * top / bottom 是 art.js 的内腔上下沿，单位就是毫米，所以这里不用再换算。
 * 搅拌时用同一张表反算杆尖该插到液面下多深 —— 一眼能看出棒子真的插在液体里。
 */
var LIQUID_MIN = 6;

/* 内腔底在实体内的 y（没装液体时液面就在这儿）。 */
function liquidBottomY(item) {
  var art = artOf(item.type);
  return art && typeof art.bottom === 'number' ? art.bottom : null;
}

/* 液面在实体内的 y：容器空着或类型未知时返回 null。 */
function liquidSurfaceY(item) {
  var art = artOf(item.type);
  var ratio = art && item.capacity ? Math.max(0, Math.min(1, item.volume / item.capacity)) : 0;

  if (!art || typeof art.bottom !== 'number' || !ratio) return null;

  var height = Math.max(LIQUID_MIN, (art.bottom - art.top) * Math.pow(ratio, 0.75));

  return art.bottom - height;
}

/* 杆尖相对容器的 y：插到液面下六成深度（8~18mm），留 5mm 不戳杯底。 */
function stirTipY(container) {
  var surface = liquidSurfaceY(container);
  var art = artOf(container.type);

  if (surface === null) return Math.round((art.base || art.size.height) * 0.7);

  var bottom = art.bottom;
  var depth = Math.max(8, Math.min(18, (bottom - surface) * 0.6));

  return Math.min(bottom - 5, surface + depth);
}

/* ---------------- 实体边界（简化 ECS） ----------------
 * 每件器材都是一个实体：{ id, type, position(x,y), dimensions, state }。
 * dimensions 直接取 art.js 的真实尺寸（烧杯 78×100、试管 20×152、铁架台 200×560），
 * 落在画布上的位置就是它的左上角，包围盒、瓶口、火焰判定全部由 store 算出，
 * 页面不再用 DOM 尺寸做几何判断 —— 状态与画面永远一致。
 */

/* 细长工具（玻璃棒 φ6、火柴、pH 试纸）真实宽度只有几个毫米，
 * 命中区域给一个 18mm 的下限，否则几乎点不到；视觉尺寸不变（SVG 居中）。 */
var MIN_HIT_WIDTH = 18;

/* 实体外框：真实尺寸，但细长工具放宽到可点击的宽度。 */
function hitBox(type) {
  var size = sizeOf(type);
  return { width: Math.max(MIN_HIT_WIDTH, size.width), height: size.height };
}

/* 倾倒对准：瓶口中心水平差 ≤ POUR_ALIGN_X（约半个瓶口），松手叠放高差 ≤ POUR_DROP_Y。 */
var POUR_ALIGN_X = 30;
var POUR_DROP_Y = 70;
/* 悬停对准：源瓶口必须高于目标瓶口 POUR_GAP_MIN~POUR_GAP_MAX，水柱才有落差。 */
var POUR_GAP_MIN = 8;
var POUR_GAP_MAX = 150;

/* 倒液动画：倾斜 + 水柱 + 液面按进度上涨，走完才真正结算体积与反应。 */
var POUR_DURATION = 1100;

/* 几何对外暴露给页面：吸附石棉网 / 铁夹、边界落位都用同一套数值。 */
export var LAB_GEOMETRY = {
  flameTipY: FLAME_TIP_Y,
  flameX: FLAME_CENTRE_X,
  gauzeTopY: GAUZE_TOP_Y,
  gauzeBottomY: GAUZE_BOTTOM_Y,
  standRingX: STAND_RING_X,
  standRingY: STAND_RING_Y,
  clampRadius: CLAMP_RADIUS,
  pourAlignX: POUR_ALIGN_X,
  pourDropY: POUR_DROP_Y,
  deskMargin: DESK_MARGIN,
  rodTipX: ROD_TIP_X,
  rodTipY: ROD_TIP_Y
};

/* 铁圈圈心（画布坐标）：页面用它判断拖拽中的容器是否该吸到铁夹上。 */
export function clampPoint(stand) {
  return { x: stand.x + STAND_RING_X, y: stand.y + STAND_RING_Y };
}

/* 台面线在画布坐标里的 y：画布底边留 DESK_MARGIN 的余量放标签。 */
export function deskLineY(canvasHeight) {
  return Math.max(80, canvasHeight - DESK_MARGIN);
}

/* 实体尺寸（页面渲染 / 拖拽换算用）。 */
export function dimensionsOf(type) {
  return hitBox(type);
}

/* 实体的包围盒（绝对坐标）：碰撞、边界钳制、命中判定都读这里。 */
export function boundsOf(item) {
  var size = item.dimensions || hitBox(item.type);
  return {
    x: item.x,
    y: item.y,
    width: size.width,
    height: size.height
  };
}

/* 容器瓶口中心（绝对坐标）：倾倒对准与水柱起点。 */
export function mouthPoint(item) {
  var size = item.dimensions || hitBox(item.type);
  return {
    x: item.x + size.width / 2,
    y: item.y + mouthYOf(item.type)
  };
}

/* 器底中心的绝对坐标：吸铁圈、坐石棉网、判断是不是压在火焰上。 */
export function basePoint(item) {
  var size = item.dimensions || hitBox(item.type);
  return { x: item.x + size.width / 2, y: item.y + baseOf(item.type) };
}

/*
 * 重力落位：器材松手后必须有个「托着它的东西」——
 *   · 铁架台的铁圈（clampOnStand 另行处理，这里只留圈上的高度）；
 *   · 架在火焰里的石棉网（器底坐在网面上）；
 *   · 点着的酒精灯火焰（器底落在焰尖上方 6mm，像被火苗托住）；
 *   · 否则落到台面线上（base 压在台面线）。
 * 返回落点的 y（实体左上角），页面在 moveItem / addItem 之前调用。
 */
export function settleY(type, x, y, canvasHeight, items) {
  var base = baseOf(type);
  var floor = deskLineY(canvasHeight) - base;
  var width = sizeOf(type).width;
  var centreX = x + width / 2;
  var best = null;

  items.forEach(function (entry) {
    if (entry.type === 'wire-gauze') {
      if (type === 'wire-gauze') return;
      var gauzeCentre = entry.x + entry.dimensions.width / 2;
      if (Math.abs(gauzeCentre - centreX) > GAUZE_X_RANGE) return;
      best = entry.y + GAUZE_TOP_Y - base;
      return;
    }

    if (entry.type === 'burner' && entry.lit) {
      var flameCentre = entry.x + FLAME_CENTRE_X;
      if (Math.abs(flameCentre - centreX) > FLAME_X_RANGE) return;
      if (type === 'wire-gauze') {
        best = entry.y + FLAME_TIP_Y - GAUZE_BOTTOM_Y;
        return;
      }
      /* 容器：只有真的放到火焰高度附近才被火苗托住，从别处拖过去照常落台面。 */
      if (type === 'stand' || entry.kind !== 'container') return;
      var flameSeat = entry.y + FLAME_TIP_Y + 6 - base;
      if (Math.abs(flameSeat - y) <= 60) best = flameSeat;
    }
  });

  if (best !== null) return Math.round(best);

  return Math.round(floor);
}

/* AABB 相交：两件器材的外框是否真的叠在一起（用于「瓶口对上没有」之类粗判）。 */
export function overlaps(a, b) {
  var boxA = boundsOf(a);
  var boxB = boundsOf(b);

  return (
    boxA.x < boxB.x + boxB.width &&
    boxA.x + boxA.width > boxB.x &&
    boxA.y < boxB.y + boxB.height &&
    boxA.y + boxA.height > boxB.y
  );
}

/*
 * 倾倒对准判定（两个容器之间，纯几何）：
 *   · dx   瓶口中心的水平偏差 —— 水柱要垂直落进瓶口，超过 POUR_ALIGN_X（30mm）就不算对准
 *   · gap  源瓶口高出目标瓶口多少 —— 正值表示源在上方，有落差才能倒
 *   悬停倾倒（aligned）：源瓶口高于目标瓶口 8~150mm 且 dx 对齐，页面据此画对准框
 *   松手叠放（droppable）：两容器外框基本重合（把容器直接拖到另一个容器上）
 *   canPour = 两种手势任一成立 —— 提示与结算共用同一个结论，看到对准圈就一定能倒
 */
export function pourAlign(source, target) {
  var from = mouthPoint(source);
  var to = mouthPoint(target);
  var dx = Math.abs(from.x - to.x);
  var gap = to.y - from.y;
  var aligned = dx <= POUR_ALIGN_X && gap >= POUR_GAP_MIN && gap <= POUR_GAP_MAX;
  var droppable = dx <= POUR_ALIGN_X && Math.abs(source.y - target.y) <= POUR_DROP_Y;

  return {
    dx: Math.round(dx * 10) / 10,
    gap: Math.round(gap * 10) / 10,
    aligned: aligned,
    droppable: droppable,
    canPour: aligned || droppable
  };
}

/* 一根火柴能燃多久：够从容走到酒精灯旁，又不会一直亮着。 */
var MATCH_DURATION = 9000;

var ITEM_SERIAL = 0;
var LOG_SERIAL = 0;

/*
 * 火焰碰撞：容器的玻璃底是否落在酒精灯的火焰上。
 *   · 横向：容器中心与火焰中心的水平偏差必须小于 FLAME_X_RANGE（26mm）
 *   · 纵向：焰尖到容器底的间距在 -FLAME_OVERLAP ~ FLAME_GAP 之间
 *     （正数 = 容器悬在焰尖上方，最多 26mm；负数 = 焰尖已探进容器底部，最多 20mm）
 * 摆得再近但没架在火焰上（比如并排摆在灯旁边）不算受热。
 */
export function inFlame(item, burner) {
  var dx = basePoint(item).x - (burner.x + FLAME_CENTRE_X);
  if (Math.abs(dx) >= FLAME_X_RANGE) return false;

  var gap = burner.y + FLAME_TIP_Y - basePoint(item).y;
  /* 夹在铁架台上的容器架得更高，酒精灯放在下方时间距自然更大。 */
  var reach = item.clamp ? CLAMP_HEAT_GAP : FLAME_GAP;
  return gap <= reach && gap >= -FLAME_OVERLAP;
}

/* 石棉网是否架在火焰上：网面中心对准焰心，网底落在焰尖附近（可以稍微探进去）。 */
function gauzeInFlame(gauze, burner) {
  var dx = gauze.x + gauze.dimensions.width / 2 - (burner.x + FLAME_CENTRE_X);
  if (Math.abs(dx) >= GAUZE_X_RANGE) return false;

  var gap = burner.y + FLAME_TIP_Y - (gauze.y + GAUZE_BOTTOM_Y);
  return gap <= GAUZE_FLAME_GAP && gap >= -GAUZE_FLAME_OVERLAP;
}

/* 容器是否坐在石棉网上：中心对齐，容器玻璃底落在网面上下 GAUZE_GAP / GAUZE_OVERLAP 内。 */
function onGauze(item, gauze) {
  var dx = basePoint(item).x - (gauze.x + gauze.dimensions.width / 2);
  if (Math.abs(dx) >= GAUZE_X_RANGE) return false;

  var gap = gauze.y + GAUZE_TOP_Y - basePoint(item).y;
  return gap <= GAUZE_GAP && gap >= -GAUZE_OVERLAP;
}

/*
 * 受热来源：先看有没有一张「架在火焰上的石棉网」正好托着容器 —— 石棉网一旦垫进
 * 去，火焰就先烤网面，容器是被网面匀热，不再算直接受热（否则垫了网还会被判成
 * 受热不均，网就白垫了）。没有再退回直接受热。
 * 返回 { burner, gauze }，gauze 为 null 表示直接受热。
 */
function heatSource(item, items, burners) {
  var i;
  for (i = 0; i < burners.length; i += 1) {
    for (var j = 0; j < items.length; j += 1) {
      var gauze = items[j];
      if (gauze.type !== 'wire-gauze') continue;
      if (gauzeInFlame(gauze, burners[i]) && onGauze(item, gauze)) {
        return { burner: burners[i], gauze: gauze };
      }
    }
  }

  for (i = 0; i < burners.length; i += 1) {
    if (inFlame(item, burners[i])) return { burner: burners[i], gauze: null };
  }

  return null;
}

function clock() {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function number(value) {
  var rounded = Math.round(value * 10) / 10;
  return String(rounded);
}

function isLiquid(entry) {
  return entry.state !== 'solid' && entry.volume > 0;
}

function totalVolume(contents) {
  return contents.reduce(function (total, entry) {
    return isLiquid(entry) ? total + entry.volume : total;
  }, 0);
}

function mergeContents(base, additions) {
  var merged = base.map(function (entry) {
    return Object.assign({}, entry);
  });

  additions.forEach(function (addition) {
    var existing = null;
    for (var i = 0; i < merged.length; i += 1) {
      if (merged[i].chemical === addition.chemical && merged[i].state === addition.state) {
        existing = merged[i];
        break;
      }
    }

    if (existing) {
      if (addition.state === 'solid') {
        existing.mass = (existing.mass || 0) + (addition.mass || 0);
      } else {
        existing.volume = (existing.volume || 0) + (addition.volume || 0);
      }
      if (addition.label) existing.label = addition.label;
    } else {
      merged.push(Object.assign({}, addition));
    }
  });

  return merged.filter(function (entry) {
    return (entry.volume || 0) > 0 || (entry.mass || 0) > 0;
  });
}

/*
 * 搅拌溶解：把可溶固体按 budget（克）转成同种物质的溶液（1g ≈ 1mL）。
 * 只处理 species 表里标了 soluble 的固体，碳酸钙 / 金属 / 沉淀都不动 ——
 * 搅拌能让它们悬浮（SolidMarks 的打旋），但不会凭空消失。
 * 返回 { contents, dissolved }：dissolved 是本次真正溶掉的质量，没溶动就返回原数组，
 * 让 tickStir 能靠引用相同判断「这一 tick 什么都没发生」。
 */
function dissolveSolids(contents, budget) {
  var remaining = budget;
  var taken = {};
  var solidMass = 0;

  contents.forEach(function (entry) {
    if (remaining <= 0 || entry.state !== 'solid' || !speciesSoluble(entry.chemical)) return;
    var mass = entry.mass || 0;
    if (mass <= 0) return;
    var take = Math.min(remaining, mass);
    taken[entry.chemical] = Math.round(((taken[entry.chemical] || 0) + take) * 100) / 100;
    remaining = Math.round((remaining - take) * 100) / 100;
    solidMass = Math.round((solidMass + take) * 100) / 100;
  });

  if (solidMass <= 0) return { contents: contents, dissolved: 0 };

  var next = contents.map(function (entry) {
    if (entry.state !== 'solid' || !taken[entry.chemical]) return Object.assign({}, entry);
    var mass = Math.round(((entry.mass || 0) - taken[entry.chemical]) * 100) / 100;
    return Object.assign({}, entry, { mass: Math.max(0, mass) });
  });

  var kept = next.filter(function (entry) {
    return entry.state === 'solid' ? (entry.mass || 0) > 0.05 : (entry.volume || 0) > 0.05;
  });

  /* 溶掉的部分沿用原固体的名称与颜色，只把物态改写成 liquid 并交给 mergeContents 合并。 */
  Object.keys(taken).forEach(function (chemical) {
    var source = null;
    contents.forEach(function (entry) {
      if (!source && entry.chemical === chemical) source = entry;
    });
    kept = mergeContents(kept, [
      {
        chemical: chemical,
        label: source && source.label ? source.label : chemical,
        name: source && source.name ? source.name : chemical,
        state: 'liquid',
        volume: taken[chemical],
        mass: 0,
        color: source && source.color ? source.color : speciesColor(chemical)
      }
    ]);
  });

  return { contents: kept, dissolved: solidMass };
}
function hexToRgb(hex) {
  var value = (hex || '').replace('#', '');
  if (value.length === 3) {
    value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
  }
  return [
    parseInt(value.slice(0, 2), 16) || 0,
    parseInt(value.slice(2, 4), 16) || 0,
    parseInt(value.slice(4, 6), 16) || 0
  ];
}

function rgbToHex(rgb) {
  return (
    '#' +
    rgb
      .map(function (value) {
        var part = Math.max(0, Math.min(255, Math.round(value))).toString(16);
        return part.length === 1 ? '0' + part : part;
      })
      .join('')
  );
}

function mixColor(contents) {
  var liquids = contents.filter(isLiquid);
  if (liquids.length === 0) return '#ffffff';

  var total = 0;
  var rgb = [0, 0, 0];

  liquids.forEach(function (entry) {
    var weight = entry.volume;
    var color = hexToRgb(speciesColor(entry.chemical));
    total += weight;
    rgb[0] += color[0] * weight;
    rgb[1] += color[1] * weight;
    rgb[2] += color[2] * weight;
  });

  return rgbToHex([rgb[0] / total, rgb[1] / total, rgb[2] / total]);
}

function mixPh(contents) {
  var liquids = contents.filter(isLiquid);
  var known = [];
  var total = 0;

  liquids.forEach(function (entry) {
    var ph = speciesPh(entry.chemical);
    if (ph === null) return;
    known.push(entry);
    total += entry.volume;
  });

  if (known.length === 0 || total === 0) return null;

  var weighted = 0;
  known.forEach(function (entry) {
    weighted += speciesPh(entry.chemical) * entry.volume;
  });

  return Math.round((weighted / total) * 10) / 10;
}

/*
 * 内容 → 容器状态的唯一收口。
 * 颜色先按液体体积加权混色，再由指示剂显色覆盖（酚酞红 / 石蕊红蓝）。
 * 沸腾也在这里派生：只有「有液体 + 温度到沸点」才沸腾，倒掉液体或降温后
 * 自动复位，不需要额外的状态清理。
 */
function isBoiling(contents, temperature) {
  return temperature >= BOIL_POINT - 0.5 && contents.some(isLiquid);
}

function syncItem(item, contents, temperature) {
  var ph = mixPh(contents);
  var tint = indicatorTint(contents, ph);
  var nextTemperature =
    typeof temperature === 'number' ? Math.round(temperature * 10) / 10 : item.temperature;
  /* 固体（尤其沉淀）越多，液体越浑浊：0 = 澄清，1 = 完全不透光。 */
  var solidMass = contents.reduce(function (total, entry) {
    return total + (entry.state === 'solid' ? entry.mass || 0 : 0);
  }, 0);

  return Object.assign({}, item, {
    contents: contents,
    volume: Math.round(totalVolume(contents) * 10) / 10,
    color: tint || mixColor(contents),
    ph: ph,
    temperature: nextTemperature,
    turbidity: Math.min(0.86, Math.round(solidMass * 14) / 100),
    boiling: isBoiling(contents, nextTemperature)
  });
}

function createItem(source, point, index) {
  ITEM_SERIAL += 1;

  var fallbackX = 24 + (index % 4) * 124;
  var fallbackY = 24 + Math.floor(index / 4) * 140;
  /* 预置试剂瓶复用细口瓶器型：type 决定 Glass.jsx 画哪一只瓶子，也决定真实尺寸 */
  var type = source.shape || source.id;

  var base = {
    id: 'lab-item-' + ITEM_SERIAL,
    type: type,
    kind: source.kind,
    name: source.name,
    formula: source.formula || '',
    /* stock = 出厂预置的整瓶试剂（瓶身贴标签、瓶里已有液体） */
    stock: !!source.stock,
    label: source.label || null,
    /* 实体边界：真实毫米尺寸（细长工具放宽到 18mm 命中宽度），不含任何猜测 */
    dimensions: hitBox(type),
    x: Math.round(point ? point.x : fallbackX),
    y: Math.round(point ? point.y : fallbackY),
    contents: [],
    temperature: 25,
    color: '#ffffff',
    turbidity: 0,
    ph: null,
    volume: 0,
    capacity: source.capacity || 0,
    lit: false,
    litUntil: 0,
    matchLeft: 0,
    inUse: false,
    /* 带塞容器的开合状态：试剂瓶默认塞着，试管烧杯这类敞口容器恒为 true。 */
    open: !source.stopper,
    stopper: !!source.stopper,
    clamp: false,
    clampedTo: null,
    heating: false,
    boiling: false,
    hot: false,
    evenHeat: false,
    unevenWarned: false,
    gas: null,
    gasAt: 0,
    gasTimes: 0,
    phenomenon: null,
    phenomenonAt: 0,
    /* 搅拌：容器记 stirring / 进度 / 本轮溶掉的固体质量，玻璃棒记搅拌对象。 */
    stirring: false,
    stirStartedAt: 0,
    stirProgress: 0,
    dissolved: 0,
    stirTargetId: null,
    /* 振荡：短暂摇匀，shakeUntil 到点由 tickStir 收手。 */
    shaking: false,
    shakeUntil: 0,
    /* 属性面板里的浓度（mol/L），只作实验参数记录。 */
    molarity: 0
  };

  /*
   * 预置试剂瓶出厂就是满的：内容物在建实体时一次灌进去，体积、颜色、pH
   * 都由 syncItem 派生，和后面真正倒出来时的口径完全一致。
   */
  if (source.reagent) {
    return syncItem(base, [Object.assign({ mass: 0 }, source.reagent)], 25);
  }

  return base;
}

function reagentLabel(reagent) {
  return reagent.logName || reagent.formula || reagent.chemical || reagent.name;
}

function findItem(items, id) {
  for (var i = 0; i < items.length; i += 1) {
    if (items[i].id === id) return items[i];
  }
  return null;
}

/* 台面上是否有一根还燃着的火柴：酒精灯点火的前提。 */
function burningMatch(items) {
  var now = Date.now();

  for (var i = 0; i < items.length; i += 1) {
    var item = items[i];
    if (item.type === 'match' && item.lit && item.litUntil > now) return item;
  }
  return null;
}

var bootLog = {
  id: 'boot',
  time: clock(),
  level: '系统',
  text: '实验室已就绪。'
};


export var useLabStore = create(function (set, get) {
  function addLog(level, text) {
    LOG_SERIAL += 1;
    set(function (state) {
      return {
        logs: state.logs.concat({
          id: 'log-' + Date.now() + '-' + LOG_SERIAL,
          time: clock(),
          level: level,
          text: text
        })
      };
    });
  }

  function replaceItem(next) {
    set(function (state) {
      return {
        items: state.items.map(function (item) {
          return item.id === next.id ? next : item;
        })
      };
    });
  }

  /*
   * 只计算不写状态：把混合后的 contents 交给反应引擎结算，
   * 返回反应后的容器、是否真的发生了反应，以及需要写入实验日志的条目。
   */
  function settleContents(item, contents, temperature) {
    var beforeTint = indicatorTint(item.contents, item.ph);
    var result = reactContents(contents, temperature);
    var next = syncItem(item, result.contents, result.temperature);
    var logs = [];

    if (result.changed) {
      var gasEvent = null;
      result.events.forEach(function (event) {
        if (event.rule.gas) gasEvent = event;
      });
      var last = result.events[result.events.length - 1];

      next = Object.assign({}, next, {
        gas: gasEvent ? gasEvent.rule.gas.label : null,
        gasAt: gasEvent ? Date.now() : 0,
        /* 同一条放气规则在一次操作里连发几次，气泡就画得更密（剧烈反应）。 */
        gasTimes: gasEvent ? gasEvent.times : 0,
        phenomenon: last.rule.phenomenon,
        phenomenonAt: Date.now()
      });

      result.events.forEach(function (event) {
        logs.push(['反应', '发生反应：' + describeReaction(event)]);
      });

      var gasText = describeGas(result.events);
      if (gasText) logs.push(['反应', gasText]);
    }

    /* 指示剂刚加入，或颜色随 pH 翻转时补一条现象说明。 */
    var afterTint = indicatorTint(next.contents, next.ph);
    var indicatorChanged =
      afterTint !== beforeTint ||
      (!hasIndicator(item.contents) && hasIndicator(next.contents));
    var tintText = indicatorText(next.contents, next.ph);
    if (indicatorChanged && tintText) logs.push(['反应', tintText]);

    return { item: next, logs: logs, reacted: result.changed };
  }

  function applySettled(settled) {
    replaceItem(settled.item);
    settled.logs.forEach(function (entry) {
      addLog(entry[0], entry[1]);
    });
  }

  return {
    items: [],
    selectedId: null,
    logs: [bootLog],
    /* 进行中的倾倒动画：{ sourceId, targetId, amount, color, progress, startedAt } */
    pourFlow: null,

    addLog: addLog,

    clearLogs: function () {
      set({ logs: [] });
    },

    addItem: function (source, point) {
      if (!source || (source.kind !== 'container' && source.kind !== 'tool')) {
        addLog('警告', '只有容器和工具可以放到实验台。');
        return null;
      }

      var state = get();
      var next = createItem(source, point, state.items.length);

      set({
        items: state.items.concat(next),
        selectedId: next.id
      });
      if (source.stock) {
        /* 预置试剂瓶：日志按实验室口吻写成「拖拽 500mL 盐酸试剂瓶 至 实验台。」 */
        var filled = next.contents[0];
        addLog(
          '系统',
          '拖拽 ' +
            (source.label ? source.label.volume + ' ' : '') +
            source.name +
            ' 至 实验台' +
            (filled ? '（' + filled.label + ' ' + next.volume + 'mL）' : '') +
            '。'
        );
      } else {
        addLog('操作', '放置 ' + source.name + '。');
      }
      return next.id;
    },

    moveItem: function (id, x, y) {
      var item = findItem(get().items, id);
      if (!item) return false;

      /*
       * 夹在铁架台上的容器是锁定实体：不能单独拖动，只能整体搬铁架台，
       * 或者先按「取下」（releaseClamp）回到自由状态 —— 和真实实验里
       * 试管夹住之后必须先松开夹具才能换位置一致。
       */
      if (item.clampedTo) {
        addLog('警告', item.name + ' 已夹在铁架台上，先「取下」再移动。');
        return false;
      }

      /*
       * 正在搅拌的器材是「手上有动作」的整体：玻璃棒插在液体里打旋，
       * 这时挪容器会把棒子留在原地，所以统一要求先停手。
       */
      if (item.stirring) {
        addLog(
          '警告',
          item.type === 'rod'
            ? item.name + ' 正插在液体里搅拌，先停手再移动。'
            : '正在搅拌 ' + item.name + '，先「停手」再移动。'
        );
        return false;
      }

      var nextX = Math.round(x);
      var nextY = Math.round(y);
      if (nextX === item.x && nextY === item.y) return false;

      var dx = nextX - item.x;
      var dy = nextY - item.y;

      /*
       * 移动后把器材排到数组末尾：DOM 顺序靠后，同层级时压在其它器材上面，
       * 符合“拿起来放到别处就该在最前面”的直觉。
       * 铁架台是刚性整体：夹在上面的容器跟着一起平移，两者的相对位置不变。
       */
      set(function (state) {
        var moved = [];
        var rest = [];

        state.items.forEach(function (entry) {
          if (entry.id === id) {
            moved.push(Object.assign({}, entry, { x: nextX, y: nextY }));
            return;
          }

          if (item.type === 'stand' && entry.clampedTo === id) {
            moved.push(
              Object.assign({}, entry, {
                x: entry.x + dx,
                y: Math.max(4, entry.y + dy)
              })
            );
            return;
          }

          rest.push(entry);
        });

        return { items: rest.concat(moved) };
      });

      addLog('操作', '移动 ' + item.name + '。');
      return true;
    },

    selectItem: function (id) {
      var item = findItem(get().items, id);
      if (!item) {
        set({ selectedId: null });
        return;
      }
      if (get().selectedId === id) return;

      set({ selectedId: id });
    },

    /*
     * 属性面板：改名。器材的 id 不变（搅拌、铁夹、倾倒都按 id 记），
     * 只是给它贴一张新标签，日志里也从此按新名字称呼。
     */
    renameItem: function (id, name) {
      var item = findItem(get().items, id);
      var next = String(name || '').trim().slice(0, 16);
      if (!item || !next || next === item.name) return false;

      replaceItem(Object.assign({}, item, { name: next }));
      addLog('操作', item.name + ' 标记为「' + next + '」。');
      return true;
    },

    /*
     * 属性面板：浓度（mol/L）。真实实验里浓度是配液时就定好的参数，
     * 这里同样只记录在器材上（不凭空改变已有内容物），供倾倒 / 反应对账。
     */
    setConcentration: function (id, value) {
      var item = findItem(get().items, id);
      var next = Number(value);
      if (!item || !isFinite(next) || next < 0) return false;

      next = Math.min(18, Math.round(next * 100) / 100);
      replaceItem(Object.assign({}, item, { molarity: next }));
      addLog('操作', item.name + ' 浓度设为 ' + number(next) + ' mol/L。');
      return true;
    },

    /* 属性面板：振荡。短暂摇匀（页面播放 lab-vessel--shaking 动画），1.2s 后自动停。 */
    shakeItem: function (id) {
      var item = findItem(get().items, id);
      if (!item || item.kind !== 'container') return false;
      if (totalVolume(item.contents) <= 0) {
        addLog('警告', item.name + ' 里没有液体，摇不出什么。');
        return false;
      }

      replaceItem(
        Object.assign({}, item, { shaking: true, shakeUntil: Date.now() + 1200 })
      );
      addLog('操作', '振荡 ' + item.name + '，液体摇匀。');
      return true;
    },

    /*
     * 属性面板：冲洗。倒掉内容物、温度回室温，等于用蒸馏水涮过一遍；
     * 冲洗时如果正插着玻璃棒，顺手收手（否则棒子会留在空杯里）。
     */
    rinseItem: function (id) {
      var item = findItem(get().items, id);
      if (!item || item.kind !== 'container') return false;

      if (item.contents.length === 0 && item.temperature === 25) {
        addLog('警告', item.name + ' 本来就干净。');
        return false;
      }

      if (item.stirring) get().stopStir(id);
      get().clearContents(id);
      addLog('操作', '用蒸馏水冲洗 ' + item.name + '。');
      return true;
    },

    removeItem: function (id) {
      var item = findItem(get().items, id);
      if (!item) return false;

      set(function (state) {
        return {
          items: state.items
            .filter(function (entry) {
              return entry.id !== id;
            })
            .map(function (entry) {
              /* 拆走铁架台时，夹在上面的容器一并放开，不会留下悬空的器材。 */
              if (entry.clampedTo !== id) return entry;
              return Object.assign({}, entry, { clamp: false, clampedTo: null });
            }),
          selectedId: state.selectedId === id ? null : state.selectedId
        };
      });
      addLog('操作', '移走 ' + item.name + '。');
      return true;
    },

    clearSelection: function () {
      set({ selectedId: null });
    },

    /*
     * 点燃 / 熄灭可以点火的东西，返回操作后的点燃状态。
     * 火柴本身是火源：划燃后只能烧 MATCH_DURATION 毫秒，燃尽自动熄灭；
     * 酒精灯必须用还燃着的火柴点，于是顺序是「取出火柴 → 划燃 → 点燃酒精灯」，
     * 和真实实验里的操作一致。灯帽的移开动画由 Vessel.jsx 按 lit 状态播放。
     */
    lightItem: function (id) {
      var items = get().items;
      var item = findItem(items, id);
      if (!item) return false;

      if (item.type === 'match') {
        var strike = !item.lit;
        replaceItem(
          Object.assign({}, item, {
            lit: strike,
            litUntil: strike ? Date.now() + MATCH_DURATION : 0,
            matchLeft: strike ? Math.round(MATCH_DURATION / 1000) : 0
          })
        );
        addLog('操作', (strike ? '划燃 ' : '熄灭 ') + item.name + '。');
        return strike;
      }

      if (item.type !== 'burner') {
        addLog('警告', '只有火柴和酒精灯可以点燃。');
        return false;
      }

      if (item.lit) {
        replaceItem(Object.assign({}, item, { lit: false, inUse: false }));
        addLog('操作', '熄灭 ' + item.name + '。');
        return false;
      }

      if (!burningMatch(items)) {
        addLog('警告', item.name + ' 要用火柴点燃：先取出火柴并划燃。');
        return false;
      }

      replaceItem(Object.assign({}, item, { lit: true }));
      addLog('操作', '用火柴点燃 ' + item.name + '。');
      return true;
    },

    /*
     * 开合瓶塞：带塞容器（试剂瓶）默认塞着，倒液与加试剂都被 open 门禁挡住；
     * 试管、烧杯这类敞口容器没有塞子，open 恒为 true，行为与之前一致。
     */
    toggleStopper: function (id) {
      var item = findItem(get().items, id);
      if (!item) return false;
      if (!item.stopper) {
        addLog('警告', item.name + ' 没有瓶塞可开合。');
        return false;
      }

      var open = !item.open;
      replaceItem(Object.assign({}, item, { open: open }));
      addLog('操作', (open ? '打开 ' : '塞上 ') + item.name + ' 的瓶塞。');
      return open;
    },

    /*
     * 把容器夹到铁架台的铁圈上：x 对准圈心，玻璃底落在圈心高度。
     * 夹住后 clampedTo 记住铁架台，移动铁架台时容器跟着走（见 moveItem）；
     * 加热判定也放宽（见 inFlame），酒精灯放在下方就能把试管烧起来。
     */
    clampOnStand: function (containerId, standId) {
      var items = get().items;
      var container = findItem(items, containerId);
      var stand = findItem(items, standId);
      if (!container || !stand) return false;
      if (container.kind !== 'container' || stand.type !== 'stand') return false;
      if (container.clampedTo === standId) return false;

      var next = Object.assign({}, container, {
        x: Math.round(stand.x + STAND_RING_X - container.dimensions.width / 2),
        y: Math.round(Math.max(4, stand.y + STAND_RING_Y - baseOf(container.type))),
        clamp: true,
        clampedTo: stand.id
      });

      set(function (current) {
        return {
          items: current.items.map(function (entry) {
            return entry.id === next.id ? next : entry;
          })
        };
      });

      addLog('操作', container.name + ' 夹在 ' + stand.name + ' 的铁夹上。');
      return true;
    },

    /* 「取下」：松开铁夹，容器留在原处变回自由实体，之后才能再拖动。 */
    releaseClamp: function (id) {
      var item = findItem(get().items, id);
      if (!item || !item.clampedTo) return false;

      replaceItem(Object.assign({}, item, { clamp: false, clampedTo: null }));
      addLog('操作', '从铁架台上取下 ' + item.name + '。');
      return true;
    },

    /*
     * 把容器架到石棉网上：x 对齐、玻璃底贴住网面（留 2px 缝隙）。
     * 吸附后容器底正好落在 onGauze 的判定窗口里，只要石棉网架在火焰上，
     * 就能隔着网受热（受热均匀，不会再记「受热不均」的警告）。
     */
    standOnGauze: function (containerId, gauzeId) {
      var items = get().items;
      var container = findItem(items, containerId);
      var gauze = findItem(items, gauzeId);
      if (!container || !gauze) return false;
      if (container.clampedTo) {
        addLog('警告', container.name + ' 已夹在铁架台上，先「取下」再架到石棉网上。');
        return false;
      }

      get().moveItem(
        containerId,
        gauze.x + (gauze.dimensions.width - container.dimensions.width) / 2,
        gauze.y + GAUZE_TOP_Y - baseOf(container.type) - 2
      );
      addLog('操作', container.name + ' 架在石棉网上。');
      return true;
    },

    /*
     * 把石棉网垫到容器下面。容器正架在火焰上时连容器一起抬起来：网面落在焰尖
     * 上方、容器坐在网面上，两件器材在一次 set() 里换位，日志只留一条。
     */
    stackGauze: function (gauzeId, containerId) {
      var state = get();
      var gauze = findItem(state.items, gauzeId);
      var container = findItem(state.items, containerId);
      if (!gauze || !container) return false;

      var burner = null;
      state.items.forEach(function (entry) {
        if (burner || entry.type !== 'burner' || !entry.lit) return;
        if (inFlame(container, entry)) burner = entry;
      });

      var nextGauze;
      var nextContainer = null;

      if (burner && !container.clampedTo) {
        nextGauze = Object.assign({}, gauze, {
          x: burner.x + FLAME_CENTRE_X - gauze.dimensions.width / 2,
          y: Math.max(4, burner.y + FLAME_TIP_Y - GAUZE_BOTTOM_Y - 2)
        });
        nextContainer = Object.assign({}, container, {
          x: nextGauze.x + (gauze.dimensions.width - container.dimensions.width) / 2,
          y: Math.max(4, nextGauze.y + GAUZE_TOP_Y - baseOf(container.type) - 2)
        });
      } else {
        /* 容器被铁夹锁住时只把网垫到它下面，不动容器的坐标。 */
        nextGauze = Object.assign({}, gauze, {
          x: container.x + (container.dimensions.width - gauze.dimensions.width) / 2,
          y: Math.max(4, container.y + baseOf(container.type) - GAUZE_TOP_Y - 2)
        });
      }

      set(function (current) {
        return {
          items: current.items.map(function (entry) {
            if (entry.id === nextGauze.id) return nextGauze;
            if (nextContainer && entry.id === nextContainer.id) return nextContainer;
            return entry;
          })
        };
      });

      addLog(
        '操作',
        burner
          ? '石棉网 垫在 ' + container.name + ' 与火焰之间。'
          : '石棉网 垫在 ' + container.name + ' 下面。'
      );
      return true;
    },

    /*
     * 用玻璃棒搅拌容器：棒子插进液面、容器进入 stirring 状态，
     * 之后由 tickStir 推进涡流进度、溶解与自动停手。
     * 干容器搅不动（没有液体就没有涡流），已经搅着的容器不会被重置计时。
     */
    stir: function (rodId, containerId) {
      var items = get().items;
      var rod = findItem(items, rodId);
      var container = findItem(items, containerId);

      if (!rod || rod.type !== 'rod') {
        addLog('警告', '只有玻璃棒可以搅拌。');
        return false;
      }
      if (!container || container.kind !== 'container') {
        addLog('警告', '把玻璃棒放进容器里才能搅拌。');
        return false;
      }
      if (container.stirring) return false;
      if (rod.stirring) {
        addLog('警告', '这根玻璃棒正在搅拌另一只容器，先停手。');
        return false;
      }
      if (totalVolume(container.contents) <= 0) {
        addLog('警告', container.name + ' 里没有液体，搅不出漩涡。');
        return false;
      }

      var nextRod = Object.assign({}, rod, {
        stirring: true,
        stirTargetId: container.id,
        /*
         * 杆尖落在容器宽度 62% 处的液面下：玻璃棒的 SVG 在 18mm 命中框里居中，
         * 所以杆尖的 x 就是命中框中心（rod.dimensions.width / 2）。
         */
        x: Math.round(
          Math.max(0, container.x + container.dimensions.width * 0.62 - rod.dimensions.width / 2)
        ),
        y: Math.round(Math.max(4, container.y + stirTipY(container) - ROD_TIP_Y))
      });
      var nextContainer = Object.assign({}, container, {
        stirring: true,
        stirStartedAt: Date.now(),
        stirProgress: 0,
        dissolved: 0
      });

      set(function (state) {
        return {
          items: state.items.map(function (entry) {
            if (entry.id === nextRod.id) return nextRod;
            if (entry.id === nextContainer.id) return nextContainer;
            return entry;
          })
        };
      });

      addLog('操作', '用玻璃棒搅拌 ' + container.name + '，液体旋起漩涡。');
      return true;
    },

    /* 「停手」：提前结束搅拌，收棒动作与 tickStir 自然到期完全一致。 */
    stopStir: function (containerId) {
      var item = findItem(get().items, containerId);
      if (!item || !item.stirring) return false;

      replaceItem(
        Object.assign({}, item, {
          stirring: false,
          stirProgress: 1,
          stirStartedAt: 0,
          dissolved: 0
        })
      );
      addLog('操作', '停止搅拌 ' + item.name + '。');
      get().tickStir();
      return true;
    },

    /*
     * 搅拌引擎，由页面每 120ms 调用一次。
     *   · 容器：按 STIR_DURATION 推进 stirProgress（涡流强度跟着走），
     *     每个 tick 溶掉 DISSOLVE_STEP 克可溶固体；到点记一条「混合均匀」并收手。
     *   · 玻璃棒：搅拌对象停下或被移走就松开，挪到容器右侧待用。
     * 没有正在搅拌的器材时直接返回，避免无意义的重渲染。
     */
    tickStir: function () {
      var state = get();
      var busy = state.items.some(function (item) {
        return (
          (item.kind === 'container' && (item.stirring || item.shaking)) ||
          (item.type === 'rod' && item.stirring)
        );
      });
      if (!busy) return;

      var now = Date.now();
      var logs = [];
      var active = {};

      var nextItems = state.items.map(function (item) {
        /* 振荡到点自动收手：只改标记，液面与动画由页面按类名收尾。 */
        if (item.shaking && now >= item.shakeUntil) {
          return Object.assign({}, item, { shaking: false, shakeUntil: 0 });
        }
        if (item.kind !== 'container' || !item.stirring) return item;

        var progress = Math.min(1, (now - item.stirStartedAt) / STIR_DURATION);
        var dissolved = item.dissolved || 0;
        var contents = item.contents;

        if (progress < 1) {
          var step = dissolveSolids(contents, DISSOLVE_STEP);
          if (step.dissolved > 0) {
            contents = step.contents;
            dissolved = Math.round((dissolved + step.dissolved) * 100) / 100;
          }
          active[item.id] = true;
          return syncItem(
            Object.assign({}, item, { stirProgress: progress, dissolved: dissolved }),
            contents,
            item.temperature
          );
        }

        logs.push([
          '操作',
          item.name +
            ' 搅拌结束，液体混合均匀' +
            (dissolved > 0 ? '（溶解 ' + number(dissolved) + 'g 固体）' : '') +
            '。'
        ]);
        return syncItem(
          Object.assign({}, item, {
            stirring: false,
            stirProgress: 1,
            stirStartedAt: 0,
            dissolved: 0
          }),
          contents,
          item.temperature
        );
      });

      nextItems = nextItems.map(function (item) {
        if (item.type !== 'rod' || !item.stirring) return item;
        if (item.stirTargetId && active[item.stirTargetId]) return item;

        var host = findItem(state.items, item.stirTargetId);
        return Object.assign({}, item, {
          stirring: false,
          stirTargetId: null,
          /* 收手后立在容器右侧、器底落在同一条台面线上 */
          x: host ? Math.round(host.x + host.dimensions.width + ROD_PARK_GAP) : item.x,
          y: host
            ? Math.round(host.y + baseOf(host.type) - TOOLS.rod.size.height)
            : item.y
        });
      });

      set({ items: nextItems });
      logs.forEach(function (entry) {
        addLog(entry[0], entry[1]);
      });
    },

    /*
     * 加热引擎，由页面每 1s 调用一次。
     * 点燃的酒精灯给邻近容器升温；没有火焰的容器自然降温回室温。
     * 温度没有变化时直接返回，避免无意义的重渲染。
     */
    tickHeating: function () {
      var state = get();
      var burners = state.items.filter(function (item) {
        return item.type === 'burner' && item.lit;
      });

      /*
       * 先算出「哪些火焰上真的架了容器」，再逐件结算：
       * 容器在数组里的顺序会随拖拽置顶变化，两遍扫描才能保证酒精灯的 inUse
       * 和容器的受热结果一致（有容器架着时火焰光晕更亮）。
       */
      var flameInUse = {};
      state.items.forEach(function (item) {
        if (item.kind === 'container') {
          burners.forEach(function (burner) {
            if (inFlame(item, burner)) flameInUse[burner.id] = true;
          });
          return;
        }

        /* 石棉网架在火焰上也算「火焰上有东西」，外焰同样增亮。 */
        if (item.type === 'wire-gauze') {
          burners.forEach(function (burner) {
            if (gauzeInFlame(item, burner)) flameInUse[burner.id] = true;
          });
        }
      });

      var logs = [];
      var changed = false;

      var nextItems = state.items.map(function (item) {
        /* 火柴：每秒刷新剩余燃烧时间，燃尽后自动熄灭。 */
        if (item.type === 'match') {
          if (!item.lit) return item;

          var matchLeft = Math.max(0, Math.ceil((item.litUntil - Date.now()) / 1000));
          if (matchLeft <= 0) {
            changed = true;
            logs.push(['操作', '火柴 燃尽了。']);
            return Object.assign({}, item, { lit: false, litUntil: 0, matchLeft: 0 });
          }
          if (matchLeft === item.matchLeft) return item;

          changed = true;
          return Object.assign({}, item, { matchLeft: matchLeft });
        }

        /* 酒精灯：火焰上是否架着容器 / 石棉网，决定光晕强弱。 */
        if (item.type === 'burner') {
          var inUse = !!item.lit && !!flameInUse[item.id];
          if (inUse === !!item.inUse) return item;
          changed = true;
          return Object.assign({}, item, { inUse: inUse });
        }

        /* 石棉网：网面是否正被火焰烤着，决定网格是否转暖色。 */
        if (item.type === 'wire-gauze') {
          var gauzeHot = burners.some(function (burner) {
            return gauzeInFlame(item, burner);
          });
          if (gauzeHot === !!item.hot) return item;
          changed = true;
          return Object.assign({}, item, { hot: gauzeHot });
        }

        if (item.kind !== 'container') return item;

        /*
         * 气泡只显示 GAS_DURATION 毫秒，到期由加热 tick 顺带清掉；
         * 放气时同步写入的现象说明也一起收起，避免文字和画面不一致。
         * 沉淀等其他现象不设时限，因为固体一直留在容器里。
         */
        var expiredGas = !!item.gas && Date.now() - item.gasAt > GAS_DURATION;
        var base = expiredGas
          ? Object.assign({}, item, {
              gas: null,
              gasAt: 0,
              gasTimes: 0,
              phenomenon: null,
              phenomenonAt: 0
            })
          : item;
        if (expiredGas) changed = true;

        var source = heatSource(base, state.items, burners);
        var heated = !!source;
        /* 搅拌让热量在液体里散得更开：垫了石棉网或正在搅拌，都算受热均匀。 */
        var even = heated && (!!source.gauze || !!base.stirring);

        if (!heated && base.temperature <= AMBIENT) {
          if (!base.heating && !base.unevenWarned) return base;
          changed = true;
          return Object.assign({}, base, {
            heating: false,
            evenHeat: false,
            unevenWarned: false
          });
        }

        var wet = base.contents.some(isLiquid);
        var limit = wet ? BOIL_POINT : DRY_LIMIT;
        var temperature = base.temperature;
        var itemLogs = [];
        var unevenWarned = !!base.unevenWarned;
        /* 搅拌加速传热：涡流把热量从杯壁带进液体，升温比静置快，沸腾也更早到。 */
        var heatRate = base.stirring ? STIR_HEAT_RATE : HEAT_RATE;

        if (heated) {
          temperature = Math.min(limit, temperature + heatRate);
          if (!base.heating) itemLogs.push(['操作', item.name + ' 开始受热。']);
          if (!even && !unevenWarned && temperature >= UNEVEN_TEMPERATURE) {
            itemLogs.push([
              '警告',
              item.name + ' 直接架在火焰上，玻璃受热不均（建议垫上石棉网）。'
            ]);
            unevenWarned = true;
          }
          if (wet && base.temperature < BOIL_POINT && temperature >= BOIL_POINT) {
            itemLogs.push(['警告', item.name + ' 中的液体沸腾了（' + BOIL_POINT + '°C）。']);
          }
        } else {
          temperature = Math.max(AMBIENT, temperature - COOL_RATE);
          if (base.heating) itemLogs.push(['操作', item.name + ' 停止受热，开始降温。']);
        }

        temperature = Math.round(temperature * 10) / 10;

        /*
         * 温度变化后再让引擎结算一次：受热分解靠规则的 minTemperature 触发，
         * 已经到上限（100°C / 160°C）还在受热的容器也能继续分解剩余固体。
         */
        var draft = Object.assign({}, base, {
          heating: heated,
          evenHeat: even,
          unevenWarned: unevenWarned
        });
        var settled = settleContents(draft, draft.contents, temperature);
        var stateChanged =
          temperature !== base.temperature ||
          heated !== !!base.heating ||
          even !== !!base.evenHeat;

        if (!stateChanged && !settled.reacted) return base;

        changed = true;
        itemLogs.forEach(function (entry) {
          logs.push(entry);
        });

        if (settled.reacted) {
          settled.logs.forEach(function (entry) {
            logs.push(entry);
          });
        }

        return settled.item;
      });

      if (!changed) return;

      set({ items: nextItems });
      logs.forEach(function (entry) {
        addLog(entry[0], entry[1]);
      });
    },


    addReagent: function (targetId, reagent, amount) {
      var target = findItem(get().items, targetId);
      if (!target || target.kind !== 'container') {
        addLog('警告', '试剂只能加入容器。');
        return false;
      }

      if (target.stopper && !target.open) {
        addLog('警告', target.name + ' 的瓶塞没打开，加不进试剂。');
        return false;
      }

      if (reagent.state === 'solid') {
        var mass = amount || reagent.defaultMass || 1;
        var solid = {
          chemical: reagent.chemical || reagent.name,
          label: reagentLabel(reagent),
          name: reagent.name,
          state: 'solid',
          mass: mass,
          volume: 0,
          color: speciesColor(reagent.chemical || reagent.name)
        };
        var solidContents = mergeContents(target.contents, [solid]);
        applySettled(settleContents(target, solidContents, target.temperature));
        addLog('操作', '将 ' + number(mass) + 'g ' + reagentLabel(reagent) + ' 加入' + target.name + '。');
        return true;
      }

      var free = Math.max(0, target.capacity - totalVolume(target.contents));
      var wanted = amount || reagent.defaultVolume || 10;
      var volume = Math.round(Math.min(wanted, free) * 10) / 10;

      if (volume <= 0) {
        addLog('警告', target.name + ' 已满，无法加入 ' + reagentLabel(reagent) + '。');
        return false;
      }

      var liquid = {
        chemical: reagent.chemical || reagent.name,
        label: reagentLabel(reagent),
        name: reagent.name,
        state: 'liquid',
        volume: volume
      };
      var contents = mergeContents(target.contents, [liquid]);
      applySettled(settleContents(target, contents, target.temperature));

      addLog(
        '操作',
        '将 ' + number(volume) + 'mL ' + reagentLabel(reagent) + ' 加入' + target.name + '。' +
          (volume < wanted ? '（容器容量不足）' : '')
      );
      return true;
    },


    pour: function (sourceId, targetId) {
      if (sourceId === targetId) return false;

      var state = get();
      var source = findItem(state.items, sourceId);
      var target = findItem(state.items, targetId);

      if (!source || !target || source.kind !== 'container' || target.kind !== 'container') {
        addLog('警告', '只能把液体倒入另一个容器。');
        return false;
      }

      /* 塞着瓶塞的试剂瓶倒不出液体：先开塞（画布上点瓶塞，或操作条上的 Status）。 */
      if (source.stopper && !source.open) {
        addLog('警告', source.name + ' 的瓶塞没打开，倒不出液体。');
        return false;
      }

      var sourceLiquids = source.contents.filter(isLiquid);
      var sourceVolume = totalVolume(source.contents);
      if (sourceVolume <= 0) {
        addLog('警告', source.name + ' 中没有可倾倒的液体。');
        return false;
      }

      var free = Math.max(0, target.capacity - totalVolume(target.contents));
      if (free <= 0) {
        addLog('警告', target.name + ' 已满，无法接收更多液体。');
        return false;
      }

      var ratio = Math.min(1, free / sourceVolume);
      var movedAmounts = sourceLiquids.map(function (entry) {
        return Math.round(entry.volume * ratio * 10) / 10;
      });
      var moved = sourceLiquids
        .map(function (entry, index) {
          return Object.assign({}, entry, { volume: movedAmounts[index] });
        })
        .filter(function (entry) {
          return entry.volume > 0;
        });

      var movedVolume = totalVolume(moved);
      if (movedVolume <= 0) {
        addLog('警告', target.name + ' 无法接收液体。');
        return false;
      }

      var remaining = [];
      source.contents.forEach(function (entry) {
        if (!isLiquid(entry)) {
          remaining.push(Object.assign({}, entry));
          return;
        }
        var index = sourceLiquids.indexOf(entry);
        var left = Math.round((entry.volume - movedAmounts[index]) * 10) / 10;
        if (left > 0) {
          remaining.push(Object.assign({}, entry, { volume: left }));
        }
      });

      var targetVolumeBefore = totalVolume(target.contents);
      var targetTemperature =
        targetVolumeBefore > 0
          ? (target.temperature * targetVolumeBefore + source.temperature * movedVolume) /
            (targetVolumeBefore + movedVolume)
          : source.temperature;

      var sourceNext = syncItem(source, remaining, source.temperature);
      var settled = settleContents(
        target,
        mergeContents(target.contents, moved),
        Math.round(targetTemperature * 10) / 10
      );
      var targetNext = settled.item;

      set(function (current) {
        return {
          items: current.items.map(function (item) {
            if (item.id === sourceNext.id) return sourceNext;
            if (item.id === targetNext.id) return targetNext;
            return item;
          })
        };
      });

      addLog(
        '操作',
        '将 ' + number(movedVolume) + 'mL 液体从' + source.name + '倒入' + target.name + '。' +
          (movedVolume < sourceVolume - 0.05 ? '（' + target.name + ' 容量不足）' : '')
      );
      settled.logs.forEach(function (entry) {
        addLog(entry[0], entry[1]);
      });
      return true;
    },

    /*
     * 带倾斜过渡的倾倒：松手后先放完「源容器倾斜 → 水柱落下 → 目标液面跟着涨」
     * 这段动画，pourFlow 里只记动画进度、不动 contents；动画结束才调 pour()
     * 结算一次。这样反应日志仍然只出现一次，体积也一次到位，不会边倒边反复
     * 触发规则引擎。
     */
    startPour: function (sourceId, targetId) {
      if (sourceId === targetId) return false;

      var state = get();
      var source = findItem(state.items, sourceId);
      var target = findItem(state.items, targetId);

      if (!source || !target || source.kind !== 'container' || target.kind !== 'container') {
        addLog('警告', '只能把液体倒入另一个容器。');
        return false;
      }
      if (source.stopper && !source.open) {
        addLog('警告', source.name + ' 的瓶塞没打开，倒不出液体。');
        return false;
      }

      var sourceVolume = totalVolume(source.contents);
      if (sourceVolume <= 0) {
        addLog('警告', source.name + ' 中没有可倾倒的液体。');
        return false;
      }

      var free = Math.max(0, target.capacity - totalVolume(target.contents));
      if (free <= 0) {
        addLog('警告', target.name + ' 已满，无法接收更多液体。');
        return false;
      }

      var amount = Math.round(Math.min(free, sourceVolume) * 10) / 10;

      set({
        pourFlow: {
          sourceId: sourceId,
          targetId: targetId,
          amount: amount,
          color: source.color,
          progress: 0,
          startedAt: Date.now()
        }
      });
      addLog('操作', source.name + ' 倾斜，倒向 ' + target.name + '。');
      return true;
    },

    /* 页面每 60ms 调一次：推进倒液进度，走完 100% 再交给 pour() 收尾。 */
    tickPour: function () {
      var flow = get().pourFlow;
      if (!flow) return;

      var progress = Math.min(1, (Date.now() - flow.startedAt) / POUR_DURATION);
      if (progress < 1) {
        set({ pourFlow: Object.assign({}, flow, { progress: progress }) });
        return;
      }

      set({ pourFlow: null });
      get().pour(flow.sourceId, flow.targetId);
    },

    cancelPour: function () {
      if (get().pourFlow) set({ pourFlow: null });
    },


    dumpLiquid: function (id) {
      var item = findItem(get().items, id);
      if (!item || item.kind !== 'container') return;

      if (item.stopper && !item.open) {
        addLog('警告', item.name + ' 的瓶塞没打开，倒不出来。');
        return;
      }

      var volume = totalVolume(item.contents);
      if (volume <= 0) {
        addLog('警告', item.name + ' 中没有液体。');
        return;
      }

      var remaining = item.contents.filter(function (entry) {
        return !isLiquid(entry);
      });
      replaceItem(
        syncItem(Object.assign({}, item, { gas: null, gasAt: 0, gasTimes: 0 }), remaining, item.temperature)
      );
      addLog('操作', '倒出 ' + number(volume) + 'mL 液体（' + item.name + '）。');
    },

    clearContents: function (id) {
      var item = findItem(get().items, id);
      if (!item || item.kind !== 'container') return;

      if (item.contents.length === 0) {
        addLog('警告', item.name + ' 已经是空的。');
        return;
      }

      replaceItem(
        syncItem(
          Object.assign({}, item, {
            temperature: 25,
            gas: null,
            gasAt: 0,
            gasTimes: 0,
            phenomenon: null,
            phenomenonAt: 0
          }),
          [],
          25
        )
      );
      addLog('操作', '清空 ' + item.name + '。');
    }
  };
});

