/**
 * geometry.js —— Canvas 实验台的毫米坐标系与落位规则
 * ------------------------------------------------------------------
 * Konva 画布直接工作在 art.js 的毫米坐标里（1 单位 = 1 mm，Stage 不做缩放），
 * 所以拖拽边界、吸附判定、器底对齐全部在纯函数里算完再交给组件 ——
 * 组件只负责把结果写进 Konva 节点和 store。
 *
 * 分工：这里是「画面上的物理」，store.js 是「实验逻辑」。
 *   clampPosition  拖拽时不能拖出实验台（左右不出画布、器底不沉到台面线以下）
 *   snapTo         靠近铁圈 / 焰尖 / 石棉网 / 酒精灯时强制对齐（Snap）
 *   containerUnder 松手落点是否压在另一个容器上（倒液 / 叠放）
 * 阈值与 store.js 的同名常量一致：口径一样，画面和判定才不会打架。
 */
import { GLASS, TOOLS, sizeOf, baseOf } from '../art.js';

/* 画布底边到台面线的距离，和 store.js 的 DESK_MARGIN 一致。 */
export var DESK_MARGIN = 58;
/* 玻璃底中心到铁圈圈心的吸附半径，和 store.js 的 CLAMP_RADIUS 一致。 */
export var RING_SNAP = 52;
/* 容器中心离焰心多远还算「架在火上」。 */
export var FLAME_X_RANGE = 26;
/* 器底落在焰尖上方 6mm，像被火苗托住（store.js 的 settleY 用同一个数）。 */
export var FLAME_SEAT = 6;
/* 石棉网与容器的水平吸附范围（网宽 120，半宽 60，留一点余量）。 */
export var GAUZE_X_RANGE = 44;
/* 石棉网架在火焰上时，网底与焰尖的贴合间距。 */
export var GAUZE_FLAME_GAP = 10;
/* 酒精灯往容器底下放：水平 / 垂直吸附范围。 */
export var BURNER_X_RANGE = 22;
export var BURNER_Y_RANGE = 26;

/* 容器 = art.js 里有玻璃轮廓的器型；工具在 TOOLS 表里。 */
export function isContainer(type) {
  return !!GLASS[type];
}

/* 实验台的可用区域：台面线以上都能放东西，台面线以下是留给标签的余量。 */
export function benchBounds(width, height) {
  return {
    width: Math.max(0, width),
    height: Math.max(0, height),
    deskY: Math.max(80, height - DESK_MARGIN)
  };
}

/* 器材在画布上的外框（mm）。 */
export function rectOf(type, x, y) {
  var size = sizeOf(type);
  return { x: x, y: y, width: size.width, height: size.height };
}

/*
 * 边界钳制：拖到哪里都还在实验台上。
 *   x ∈ [0, 画布宽 − 器材宽]   —— 不会拖到左右墙外
 *   y ∈ [0, 台面线 − 器底]     —— 最多让器底压在台面线上，不会沉进桌面
 * 画布太矮（器材比台面还高）时退回 0，让器材顶到画布上沿，而不是被弹飞。
 */
export function clampPosition(type, x, y, bounds) {
  var size = sizeOf(type);
  var maxX = Math.max(0, bounds.width - size.width);
  var maxY = Math.max(0, bounds.deskY - baseOf(type));
  var nextX = Math.min(maxX, Math.max(0, Math.round(x)));
  var nextY = Math.min(maxY, Math.max(0, Math.round(y)));

  return {
    x: nextX,
    y: nextY,
    clampedX: nextX !== Math.round(x),
    clampedY: nextY !== Math.round(y)
  };
}

/* 两个外框是否相交（贴着边不算）。 */
export function overlapsRect(a, b) {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}


/*
 * 探针点：判断「离得近不近」时用器材身上最有意义的一点。
 *   容器 / 大多数量具  用器底中心（贴台面、贴铁圈、贴网面都看它）
 *   酒精灯            用焰尖（焰尖对着器底才算架上去）
 */
export function probePoint(type, x, y) {
  var size = sizeOf(type);
  if (type === 'burner') {
    return { x: x + TOOLS.burner.flameX, y: y + TOOLS.burner.flameTip };
  }
  return { x: x + size.width / 2, y: y + baseOf(type) };
}

/*
 * 吸附候选：别的器材提供的「可贴位置」，都是 { kind, id, x, y, anchor }，
 * 其中 (x, y) 是拖动中的器材该落到的左上角，(anchor) 是判定距离用的锚点。
 *   ring            容器 → 铁架台铁圈（x 对准圈心、玻璃底落在圈心线上）
 *   gauze           容器 → 石棉网上表面
 *   flame           容器 → 燃着的酒精灯：器底在焰尖上方 6mm
 *   gauze-on-flame  石棉网 → 燃着的酒精灯：网底贴住焰尖
 *   burner-seat     酒精灯 → 容器正下方：焰尖 6mm 对着器底
 */
export function snapTargets(type, items) {
  var size = sizeOf(type);
  var base = baseOf(type);
  var list = [];

  items.forEach(function (entry) {
    if (!entry || entry.id === undefined) return;

    if (entry.type === 'stand' && isContainer(type)) {
      var ring = TOOLS.stand.ring;
      var ringAnchor = { x: entry.x + ring.x, y: entry.y + ring.y };
      list.push({
        kind: 'ring',
        id: entry.id,
        x: ringAnchor.x - size.width / 2,
        y: ringAnchor.y - base,
        anchor: ringAnchor
      });
    }

    if (entry.type === 'wire-gauze' && type !== 'wire-gauze') {
      var gauzeWidth = sizeOf('wire-gauze').width;
      var gauzeAnchor = { x: entry.x + gauzeWidth / 2, y: entry.y };
      list.push({
        kind: 'gauze',
        id: entry.id,
        x: gauzeAnchor.x - size.width / 2,
        y: gauzeAnchor.y - base,
        anchor: gauzeAnchor
      });
    }

    if (entry.type === 'burner' && entry.lit) {
      var flameX = entry.x + TOOLS.burner.flameX;
      if (type === 'wire-gauze') {
        var gauzeSeat = { x: flameX, y: entry.y + TOOLS.burner.flameTip };
        list.push({
          kind: 'gauze-on-flame',
          id: entry.id,
          x: gauzeSeat.x - size.width / 2,
          y: gauzeSeat.y - GAUZE_FLAME_GAP,
          anchor: gauzeSeat
        });
      } else if (isContainer(type)) {
        var flameSeat = { x: flameX, y: entry.y + TOOLS.burner.flameTip + FLAME_SEAT };
        list.push({
          kind: 'flame',
          id: entry.id,
          x: flameSeat.x - size.width / 2,
          y: flameSeat.y - base,
          anchor: flameSeat
        });
      }
    }

    /* 反向：酒精灯往容器底下塞，焰尖 6mm 对着器底。 */
    if (type === 'burner' && isContainer(entry.type)) {
      var target = sizeOf(entry.type);
      var targetBase = entry.y + baseOf(entry.type);
      var seat = { x: entry.x + target.width / 2, y: targetBase };
      list.push({
        kind: 'burner-seat',
        id: entry.id,
        x: seat.x - TOOLS.burner.flameX,
        y: seat.y - TOOLS.burner.flameTip - FLAME_SEAT,
        anchor: seat
      });
    }
  });

  return list;
}

/* 每种吸附的作用半径（mm）——和 store.js 的判定常数同源。 */
var SNAP_TOLERANCE = {
  ring: RING_SNAP,
  gauze: GAUZE_X_RANGE,
  flame: FLAME_X_RANGE,
  'gauze-on-flame': GAUZE_X_RANGE,
  'burner-seat': BURNER_X_RANGE
};

/*
 * 松手时的吸附：在所有候选里找距离最近、且在阈值内（纵向也要进范围）的一个。
 * 返回 { kind, id, x, y, gap } —— 组件据此决定调 store 的哪个原子操作
 * （clampOnStand / standOnGauze / 直接落位），或者干脆自己对齐坐标。
 */
export function snapTo(type, x, y, items) {
  var probe = probePoint(type, x, y);
  var best = null;

  snapTargets(type, items).forEach(function (entry) {
    var dx = probe.x - entry.anchor.x;
    var dy = probe.y - entry.anchor.y;
    var tolerance = SNAP_TOLERANCE[entry.kind] || RING_SNAP;

    if (Math.abs(dx) > tolerance) return;
    if (Math.abs(dy) > tolerance + (entry.kind === 'flame' ? 54 : 12)) return;

    var gap = Math.sqrt(dx * dx + dy * dy);
    if (!best || gap < best.gap) {
      best = { kind: entry.kind, id: entry.id, x: entry.x, y: entry.y, gap: gap };
    }
  });

  return best;
}

/*
 * 画布坐标里点到哪件容器（倒试剂用）：容器不是 DOM 节点，没有 droppable 可接，
 * 所以按落点做一次矩形命中，后放的器材压在先放的上面。
 */
export function containerAt(x, y, items) {
  var hit = null;

  items.forEach(function (entry) {
    if (!isContainer(entry.type)) return;
    var box = rectOf(entry.type, entry.x, entry.y);
    if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) hit = entry;
  });

  return hit;
}

/*
 * 松手后压在哪件容器上（外框相交面积最大的那件）——倒液、叠放石棉网都看它。
 */
export function containerUnder(type, x, y, items) {
  var box = rectOf(type, x, y);
  var hit = null;
  var area = 0;

  items.forEach(function (entry) {
    if (!isContainer(entry.type)) return;
    var other = rectOf(entry.type, entry.x, entry.y);
    if (!overlapsRect(box, other)) return;

    var w = Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x);
    var h = Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y);
    if (w * h > area) {
      area = w * h;
      hit = entry;
    }
  });

  return hit;
}
