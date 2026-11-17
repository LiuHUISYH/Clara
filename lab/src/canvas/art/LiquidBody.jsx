/**
 * LiquidBody.jsx —— 有波动的液体（Step 3）
 * ------------------------------------------------------------------
 * 和 Step 2 的平面液体相比只改了一件事：上沿不再是直线，而是由
 * 「此刻时间」算出来的一条横波。液面以下仍然裁进内腔（底部圆角贴着器底），
 * 所以波形再大也爬不出玻璃壁。
 *
 * 为什么要波形：
 *   · 静止的液面看起来像一块塑料片，有一条缓慢起伏的亮线才有「液体」的感觉；
 *   · 沸腾 / 搅拌 / 振荡时同一套公式只改振幅与频率，不用换一套图形 ——
 *     烧开时液面剧烈翻涌、搅拌时中间凹下去，都是参数，不是新代码。
 *
 * 每帧重绘由 KonvaBench 的 Konva.Animation 驱动：sceneFunc 里直接读
 * motion 的时钟，React 一次都不重渲染。液面高度、颜色仍来自 store，
 * 状态一变（加液体 / 变色 / 升温）下一次 React 渲染自然更新。
 */
import React from 'react';
import { Group, Shape, Rect } from 'react-konva';
import { interiorOf, interiorPath, liquidHeight, liquidColor } from '../liquid.js';
import { LIQUID_DEPTH } from '../palette.js';
import { time, hashSeed, scene, clamp } from '../motion.js';

/* 液面的采样段数：14 段足以让 1mm 的波在 68mm 的杯口里看着平滑。 */
var SEGMENTS = 14;

/*
 * 振幅（mm）：静置时约 0.3mm，沸腾升到 1.2~2.6mm。
 * 振幅跟着液层厚度走 —— 一层 6mm 的液体不该翻出 3mm 的浪。
 */
function amplitudeOf(item, height) {
  var base = clamp(height * 0.055, 0.3, 1);

  if (item.boiling) return clamp(1.2 + height * 0.1, 1.2, 2.6);
  if (item.shaking) return clamp(0.9 + height * 0.12, 0.9, 2.4);
  if (item.stirring) return base * 0.55;
  return base;
}

/* 波动速度：沸腾时快一倍多，静置时慢到几乎察觉不到。 */
function speedOf(item) {
  if (item.boiling) return 5.4;
  if (item.shaking) return 6.2;
  if (item.stirring) return 4.2;
  return 1.45;
}

/*
 * 液面在 x 处的 y：两条不同波长 / 不同方向的正弦叠加，避免看出「单频」的
 * 机械感；贴壁处减去一点（表面张力让液面沿玻璃微微上翘），搅拌时中间下凹。
 */
function surfaceAt(box, surface, item, x, t, phase) {
  var width = box.right - box.left;
  var mid = (box.left + box.right) / 2;
  var u = (x - box.left) / width;
  var amp = amplitudeOf(item, box.bottom - surface);
  var speed = speedOf(item);

  var y =
    surface +
    amp * (Math.sin(u * Math.PI * 3 + t * speed + phase) * 0.62 +
      Math.sin(u * Math.PI * 5.4 - t * speed * 1.31 + phase * 1.7) * 0.38);

  /* 贴壁的上翘：只在离壁约 3mm 内有效，像毛细爬升。 */
  y -= 0.45 * (Math.exp(-u * 12) + Math.exp(-(1 - u) * 12));

  /* 搅拌：中心被玻璃棒带走一块，液面凹成碗形。 */
  if (item.stirring) {
    var dip = Math.min(4.2, (box.bottom - surface) * 0.34);
    y += dip * (1 - Math.pow((x - mid) / (width / 2), 2));
  }

  return y;
}

/* 把「波形上沿 + 器底圆角」围成一条闭合路径。 */
function traceBody(ctx, box, surface, item, t, phase) {
  var step = (box.right - box.left) / SEGMENTS;

  ctx.moveTo(box.left, surfaceAt(box, surface, item, box.left, t, phase));
  for (var i = 1; i <= SEGMENTS; i += 1) {
    var x = box.left + step * i;
    ctx.lineTo(x, surfaceAt(box, surface, item, x, t, phase));
  }

  /* 液面以下就是内腔本身：右侧下到底、底部圆角、左侧回来。 */
  var r = Math.min(box.radius, (box.bottom - surface) / 2, (box.right - box.left) / 2);
  ctx.lineTo(box.right, box.bottom - r);
  ctx.quadraticCurveTo(box.right, box.bottom, box.right - r, box.bottom);
  ctx.lineTo(box.left + r, box.bottom);
  ctx.quadraticCurveTo(box.left, box.bottom, box.left, box.bottom - r);
  ctx.closePath();
}

/* 只描液面那一条线，用来压高光 / 暗边；lift 是整体下移的毫米数。 */
function traceSurface(ctx, box, surface, item, t, phase, lift) {
  var step = (box.right - box.left) / SEGMENTS;

  ctx.moveTo(box.left, surfaceAt(box, surface, item, box.left, t, phase) + lift);
  for (var i = 1; i <= SEGMENTS; i += 1) {
    var x = box.left + step * i;
    ctx.lineTo(x, surfaceAt(box, surface, item, x, t, phase) + lift);
  }
}

/*
 * 倾斜时的液面：**世界坐标里始终水平**，所以在（已经斜了的）局部坐标里
 * 它是一条斜线。这里给出这条线的两个端点 + 局部坐标里的「向下」方向，
 * 液体 = 内腔 ∩ 这条线以下的半个平面 —— 玻璃斜了，液体贴着斜面重新分布，
 * 而不是整块液体跟着瓶子转出去（那样一转就全被裁掉了）。
 */
function levelOf(box, surface, tilt) {
  var pivotX = (box.left + box.right) / 2;
  var pivotY = box.top;
  var cos = Math.cos(tilt);
  var sin = Math.sin(tilt);

  /*
   * world → local：瓶身转了 +tilt（屏幕上顺时针），所以局部坐标 = 绕着瓶口转 −tilt。
   * Konva 的 +rotation 对应矩阵 [[cos, −sin], [sin, cos]]，逆变换就是这里的两行。
   */
  function toLocal(x, y) {
    var dx = x - pivotX;
    var dy = y - pivotY;
    return { x: pivotX + dx * cos + dy * sin, y: pivotY - dx * sin + dy * cos };
  }

  return {
    left: toLocal(box.left - 30, surface),
    right: toLocal(box.right + 30, surface),
    /* 局部坐标里的「世界向下」方向：R(−tilt) · (0, 1) */
    down: { x: sin, y: cos },
    depth: (box.bottom - box.top) * 3 + 80
  };
}

/* 液面以下的四边形（局部坐标），用来裁剪液体。 */
function traceLevelQuad(ctx, level) {
  var l = level.left;
  var r = level.right;
  var d = level.down;
  var z = level.depth;

  ctx.moveTo(l.x, l.y);
  ctx.lineTo(r.x, r.y);
  ctx.lineTo(r.x + d.x * z, r.y + d.y * z);
  ctx.lineTo(l.x + d.x * z, l.y + d.y * z);
  ctx.closePath();
}

/* 倾斜时沿液面画波动的亮线：方向是 level 的方向，波动走它的法线。 */
function strokeLevel(ctx, level, item, t, phase, offset, style, width) {
  var lx = level.left.x;
  var ly = level.left.y;
  var dx = level.right.x - lx;
  var dy = level.right.y - ly;
  var nx = -dy / (Math.sqrt(dx * dx + dy * dy) || 1);
  var ny = dx / (Math.sqrt(dx * dx + dy * dy) || 1);
  var amp = amplitudeOf(item, 40);
  var speed = speedOf(item);

  ctx.beginPath();
  for (var i = 0; i <= SEGMENTS; i += 1) {
    var u = i / SEGMENTS;
    var wob =
      amp *
      (Math.sin(u * Math.PI * 3 + t * speed + phase) * 0.62 +
        Math.sin(u * Math.PI * 5.4 - t * speed * 1.31 + phase * 1.7) * 0.38);
    var x = lx + dx * u + nx * (wob + offset);
    var y = ly + dy * u + ny * (wob + offset);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.stroke();
}

/* 倾斜时的一小块反光：跟着液面一起斜。 */
function sheenLevel(ctx, level, height) {
  var dx = level.right.x - level.left.x;
  var dy = level.right.y - level.left.y;
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  var rx = Math.max(3, len * 0.16);

  ctx.save();
  ctx.translate(level.left.x + dx / 2, level.left.y + dy / 2);
  ctx.rotate(Math.atan2(dy, dx));
  var glow = ctx.createRadialGradient(0, 1.4, 0, 0, 1.4, rx);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.beginPath();
  ctx.ellipse(0, 1.4, rx, Math.min(2.6, height * 0.2), 0, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  ctx.restore();
}


/*
 * 液体主体：一次 sceneFunc 里画完「填充 + 浑浊 + 液面亮线 + 反光斑」。
 * 拆成四个 Konva 节点也行，但每帧四次路径重算反而更慢，何况它们共用同一条波形。
 */
function drawLiquid(ctx, shape, props) {
  var item = props.item;
  var box = props.box;
  var height = liquidHeight(item);
  if (height <= 0) return;

  var surface = box.bottom - height;
  var t = time();
  var phase = (hashSeed(item.id) % 360) * 0.0175;
  var turbulence = item.turbidity || 0;
  var flow = scene.flow;
  var receiving = !!(flow && flow.targetId === item.id);
  var mid = (box.left + box.right) / 2;
  var width = box.right - box.left;
  var tilt = scene.tilt[item.id] || 0;

  ctx.save();

  /*
   * 倾倒中（|tilt| > 0.4°）：液面以「世界水平」为准。
   * 先裁出液面以下那块区域，再把内腔填满 —— 液体在斜着的玻璃里重新分布，
   * 体积感/浑浊/清亮都还在，只是不再跟着瓶子一起转出去。
   */
  if (Math.abs(tilt) > 0.007) {
    var level = levelOf(box, surface, tilt);
    ctx.beginPath();
    traceLevelQuad(ctx, level);
    ctx.clip();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = liquidColor(item);
    ctx.fillRect(box.left - 40, box.top - 60, width + 80, box.bottom - box.top + 140);

    if (turbulence > 0.02) {
      ctx.globalAlpha = Math.min(0.86, turbulence);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(box.left - 40, box.top - 60, width + 80, box.bottom - box.top + 140);
    }

    ctx.globalAlpha = 1;
    strokeLevel(ctx, level, item, t, phase, 0.4, 'rgba(255, 255, 255, 0.72)', 0.9);
    strokeLevel(ctx, level, item, t, phase, 1.5, 'rgba(15, 42, 54, 0.14)', 0.7);
    sheenLevel(ctx, level, height);

    ctx.restore();
    return;
  }

  /* ① 液体本体 */
  ctx.beginPath();
  traceBody(ctx, box, surface, item, t, phase);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = liquidColor(item);
  ctx.fill();

  /* ② 悬浮固体把液体变浑：一层白雾，浓度就是 turbidity */
  if (turbulence > 0.02) {
    ctx.globalAlpha = Math.min(0.86, turbulence);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /* ③ 液面：一条亮线 + 紧贴其下的暗线，做出水膜的厚度 */
  ctx.globalAlpha = 1;
  ctx.beginPath();
  traceSurface(ctx, box, surface, item, t, phase, 0);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  ctx.beginPath();
  traceSurface(ctx, box, surface, item, t, phase, 1.1);
  ctx.strokeStyle = 'rgba(15, 42, 54, 0.16)';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  /* ④ 反光斑：在液面上慢慢左右漂（液体在动，光斑也得动） */
  var cx = mid + Math.sin(t * 0.55 + phase) * width * 0.17;
  var rx = Math.max(3, width * 0.2);
  var glow = ctx.createRadialGradient(cx, surface + 1.4, 0, cx, surface + 1.4, rx);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.beginPath();
  ctx.ellipse(cx, surface + 1.4, rx, Math.min(2.6, height * 0.2), 0, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  /* ⑤ 正在接液：落点附近压一圈细涟漪，液面被砸得更高一点 */
  if (receiving) {
    var ripple = clamp(flow.progress || 0, 0, 1);
    ctx.beginPath();
    ctx.ellipse(mid, surface + 1, 6 + ripple * 8, 1.4 + ripple * 1.4, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  ctx.restore();
}

export default function LiquidBody(props) {
  var item = props.item;
  var box = props.box || interiorOf(item.type);
  var height = liquidHeight(item);
  if (!box || height <= 0) return null;

  var surface = box.bottom - height;
  var width = box.right - box.left;

  return (
    <Group clipFunc={function (ctx) { interiorPath(ctx, box); }} listening={false}>
      {/* 波形本体：每帧由 Konva.Animation 重绘 */}
      <Shape
        name="liquid-wave"
        sceneFunc={function (ctx, shape) { drawLiquid(ctx, shape, props); }}
      />

      {/* 纵深：液面下亮、越深越沉（静态渐变，不用每帧重算） */}
      <Rect
        x={box.left}
        y={surface}
        width={width}
        height={box.bottom - surface + 2}
        fillLinearGradientStartPoint={{ x: 0, y: surface }}
        fillLinearGradientEndPoint={{ x: 0, y: box.bottom }}
        fillLinearGradientColorStops={LIQUID_DEPTH}
        opacity={0.9}
      />

      {/* 靠左壁的一道反光柱：液体贴着玻璃的那一侧更亮 */}
      <Rect
        x={box.left + 1.4}
        y={surface + 2}
        width={Math.max(1.2, width * 0.035)}
        height={Math.max(0, height - 8)}
        cornerRadius={1}
        fillLinearGradientStartPoint={{ x: 0, y: surface }}
        fillLinearGradientEndPoint={{ x: 0, y: box.bottom }}
        fillLinearGradientColorStops={[0, 'rgba(255, 255, 255, 0.34)', 1, 'rgba(255, 255, 255, 0)']}
      />
    </Group>
  );
}
