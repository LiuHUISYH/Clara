/**
 * flow.js —— 倒液水柱的几何（Canvas 版）
 * ------------------------------------------------------------------
 * 和 LabPage.jsx 的 DOM 水柱同一套算法，只是把「拼 SVG 的 d 字符串」换成
 * 「往 Canvas 路径里加线段」，这样水柱可以画在 Konva 特效层上，
 * 和玻璃、铁架台共用一块画布，不再需要一层覆盖在画布上的 SVG。
 *
 * 几何用的是二次贝塞尔：起点在源容器唇边（往倾倒方向偏移半个瓶口），
 * 控制点在起点斜下方（液流先被重力拉弯），落点在目标瓶口内 6mm。
 * 自由下落的液流会被拉细，所以实体沿落差从 mouthWidth 收到 dropWidth。
 */
import { PX_PER_MM, artOf } from '../art.js';

function round(value) {
  return Math.round(value * 10) / 10;
}

/*
 * 倾倒中容器的「唇边」：瓶口椭圆最外侧那一点，瓶子倾斜后它还跟着转。
 * 水柱从唇边出去（而不是瓶口中心），倾斜角度越大，唇边越往下、越往外 ——
 * 和真实倒水时最后一滴从最低处挂下来是同一个位置。
 */
export function lipPoint(item, dir, tilt) {
  var art = artOf(item.type);
  var mouth = art && art.mouth ? art.mouth : null;
  if (!mouth) return null;

  var pivot = { x: item.x + mouth.cx, y: item.y + mouth.cy };
  var local = { x: dir * mouth.rx * 0.92, y: 0.8 };
  var cos = Math.cos(tilt || 0);
  var sin = Math.sin(tilt || 0);

  return {
    x: pivot.x + local.x * cos - local.y * sin,
    y: pivot.y + local.x * sin + local.y * cos
  };
}

/* 二次贝塞尔取点。 */
export function quadPoint(from, control, to, t) {
  var mt = 1 - t;
  return {
    x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
    y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y
  };
}

/*
 * 水柱的中心线：源瓶口 → 目标液面。
 *   source / target 是 store 的器材（含 x / y / type）
 *   mouthOf(item)   由调用方注入，避免这里再依赖 store
 *   dropY           落点的绝对 y：给了就用它（目标容器里的液面），
 *                   没给就落在目标瓶口下方 6mm（空容器：液体砸在瓶底附近）
 */
export function pourGeometry(source, target, amount, mouthOf, dropY, fromPoint) {
  var from = fromPoint || mouthOf(source);
  var to = mouthOf(target);
  var toLeft = to.x < from.x;
  var dir = toLeft ? -1 : 1;
  var mouthX = from.x + dir * 4;
  var mouthY = from.y + 2;
  var dropX = to.x;
  var dropYAt = typeof dropY === 'number' && dropY > mouthY ? dropY : to.y + 6;
  var bendX = mouthX + dir * 12;
  var bendY = (mouthY + dropYAt) / 2;
  /* 水柱粗细跟着倒出的量走：10mL 细一线，60mL 有分量。 */
  var thickness = 2.4 + Math.min(1.8, (amount || 0) / 12);

  return {
    from: { x: round(mouthX), y: round(mouthY) },
    control: { x: round(bendX), y: round(bendY) },
    to: { x: round(dropX), y: round(dropYAt) },
    dir: dir,
    left: toLeft,
    thickness: thickness,
    mouthWidth: thickness * 1.9,
    dropWidth: thickness * 1.15
  };
}

/*
 * 把水柱实体写进当前路径：沿中心线左右各偏半个线宽（法线方向），
 * 左边正走、右边倒走，围成一条上粗下细的液柱。
 */
export function traceStream(ctx, geometry, steps) {
  var count = steps || 10;
  var from = geometry.from;
  var control = geometry.control;
  var to = geometry.to;
  var left = [];
  var right = [];

  for (var i = 0; i <= count; i += 1) {
    var t = i / count;
    var point = quadPoint(from, control, to, t);
    var ahead = quadPoint(from, control, to, Math.min(1, t + 0.02));
    var behind = quadPoint(from, control, to, Math.max(0, t - 0.02));
    var dx = ahead.x - behind.x;
    var dy = ahead.y - behind.y;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    var half = (geometry.mouthWidth + (geometry.dropWidth - geometry.mouthWidth) * t) / 2;
    var nx = (-dy / length) * half;
    var ny = (dx / length) * half;

    left.push({ x: point.x + nx, y: point.y + ny });
    right.push({ x: point.x - nx, y: point.y - ny });
  }

  ctx.moveTo(left[0].x, left[0].y);
  for (var k = 1; k < left.length; k += 1) ctx.lineTo(left[k].x, left[k].y);
  for (var j = right.length - 1; j >= 0; j -= 1) ctx.lineTo(right[j].x, right[j].y);
  ctx.closePath();
}

/* 中心线本身（亮芯、高光都沿它描边）。 */
export function traceCore(ctx, geometry) {
  ctx.moveTo(geometry.from.x, geometry.from.y);
  ctx.quadraticCurveTo(
    geometry.control.x,
    geometry.control.y,
    geometry.to.x,
    geometry.to.y
  );
}

/* 液流在目标瓶口砸出的一圈涟漪半径（随进度扩散）。 */
export function splashRadius(progress) {
  return 4 + Math.min(1, Math.max(0, progress)) * 6;
}

/* 毫米 → 像素：水柱的粗细也是毫米，和玻璃共用一把尺子。 */
export function mmToPx(mm) {
  return mm * PX_PER_MM;
}
