/**
 * liquid.js —— Canvas 里的液面几何
 * ------------------------------------------------------------------
 * 液面高度和 store.js / Glass.jsx 用的是同一套换算：
 *   有效高度 = (bottom − top) × (体积 ÷ 容量) ^ 0.75，最薄留 6mm
 * 只是画布这边要把它变成 Konva 的裁剪区域与填充矩形，所以这里额外给出
 * 每种器型的「内腔矩形」（左 / 右 / 上 / 下 + 底部圆角），由 art.js 的
 * x / width / top / bottom 换算而来 —— 圆角取器底的实际弧度，
 * 液体贴不到玻璃壁外，也不会在直角处露出玻璃底。
 *
 * 液体用 clipFunc 裁进内腔：Konva 在调用 clipFunc 之前已经 beginPath()，
 * 所以这里只往当前路径里塞圆角矩形即可（不要自己再 beginPath）。
 */
import { artOf } from '../art.js';

/* 最薄一层液体 6mm：10mL 在 250mL 烧杯里也看得见（与 Glass.jsx 一致）。 */
export var LIQUID_MIN = 6;

/*
 * 内腔矩形（mm）：left / right 是内壁，top / bottom 是液体能到的最上 / 最下，
 * radius 是器底圆角 —— 烧杯 6、试管整整半个管径、烧瓶更大一些。
 */
var INTERIOR = {
  beaker: { left: 7.2, right: 67.2, top: 10.5, bottom: 95, radius: 6 },
  'test-tube': { left: 3.9, right: 16.1, top: 6.4, bottom: 146, radius: 6.1 },
  erlenmeyer: { left: 12, right: 78, top: 42, bottom: 102, radius: 10 },
  'round-flask': { left: 8, right: 86, top: 40, bottom: 108, radius: 16 },
  'volumetric-flask': { left: 6, right: 62, top: 38, bottom: 116, radius: 8 },
  'reagent-bottle': { left: 6.4, right: 55.2, top: 40, bottom: 178, radius: 7 }
};

/* 器型的内腔矩形；没有登记的器型退化成整个器身（工具不需要液体）。 */
export function interiorOf(type) {
  if (INTERIOR[type]) return INTERIOR[type];
  var art = artOf(type);
  if (!art || typeof art.bottom !== 'number') return null;

  return {
    left: art.x === undefined ? 0 : art.x,
    right: (art.x === undefined ? 0 : art.x) + (art.width === undefined ? art.size.width : art.width),
    top: art.top,
    bottom: art.bottom,
    radius: 4
  };
}

/*
 * 把内腔写进当前路径——给 Konva Group 的 clipFunc 用。
 * 上部方角、底部圆角：液体的下沿始终贴着器底弧度，不会从直角边上漏出去。
 */
export function interiorPath(ctx, box) {
  var r = Math.min(box.radius, (box.bottom - box.top) / 2, (box.right - box.left) / 2);

  ctx.moveTo(box.left, box.top);
  ctx.lineTo(box.right, box.top);
  ctx.lineTo(box.right, box.bottom - r);
  ctx.quadraticCurveTo(box.right, box.bottom, box.right - r, box.bottom);
  ctx.lineTo(box.left + r, box.bottom);
  ctx.quadraticCurveTo(box.left, box.bottom, box.left, box.bottom - r);
  ctx.closePath();
}

/* 液面高度（mm）：0 表示空容器。 */
export function liquidHeight(item) {
  var art = artOf(item.type);
  if (!art || typeof art.bottom !== 'number' || !item.capacity || !item.volume) return 0;

  var ratio = Math.max(0, Math.min(1, item.volume / item.capacity));
  if (!ratio) return 0;

  return Math.max(LIQUID_MIN, (art.bottom - art.top) * Math.pow(ratio, 0.75));
}

/* 液面在器身里的 y（相对器材左上角）；空容器返回 null。 */
export function liquidSurface(item) {
  var height = liquidHeight(item);
  var box = interiorOf(item.type);
  if (!height || !box) return null;
  return box.bottom - height;
}

/* 液体颜色：反应结算后由 store 写进 item.color，空容器给一层水色。 */
export function liquidColor(item) {
  return item.color || '#dfe9ec';
}

/*
 * 倾倒动画中的「显示体积」：源容器按进度减少、目标容器按进度增加。
 * 只影响画面（不写回 store），一次倾倒仍然只结算一次。
 */
export function shownItem(item, flow) {
  if (!flow) return item;
  var pouring = flow.sourceId === item.id;
  var receiving = flow.targetId === item.id;
  if (!pouring && !receiving) return item;

  var delta = (receiving ? 1 : -1) * flow.amount * flow.progress;
  var shown = Object.assign({}, item, {
    volume: Math.max(0, Math.round((item.volume + delta) * 10) / 10)
  });

  /* 空容器接液时先露出源液体的颜色，颜色混合等结算后再接上。 */
  if (receiving && item.volume === 0) shown.color = flow.color;
  return shown;
}
