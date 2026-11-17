/**
 * PourStream.jsx —— 倒液水柱（Step 3，画在特效层）
 * ------------------------------------------------------------------
 * DOM 版的 `PourStream` 是一条盖在画布上的 SVG；画布版直接画在 Konva 特效层，
 * 和玻璃共用一块画布，也就不再需要「SVG 坐标 = 画布像素」的约定。
 *
 * 分四层画，和真实液流的观感对应：
 *   ① 实体   上宽下窄的一条液柱（自由下落的液流会被重力拉细）
 *   ② 亮芯   颜色最深的一道，液流中心流速最快
 *   ③ 高光   一条细白线 + 几粒随流动下移的亮斑（看得见「在流」）
 *   ④ 落点   液流砸进目标瓶口：一圈扩散的涟漪 + 一点溅起的水花
 *
 * 颜色取源液体的 `flow.color`，粗细取倒出的量；进度由 store 的
 * `pourFlow.progress` 驱动，动画结束才真正结算体积 —— 和 DOM 版同一套时序。
 */
import React from 'react';
import { Group, Shape } from 'react-konva';
import { mouthPoint } from '../../store.js';
import { liquidSurface } from '../liquid.js';
import { time, fract, scene } from '../motion.js';
import { pourGeometry, lipPoint, traceStream, traceCore, quadPoint, splashRadius } from '../flow.js';

/* 把源液体的颜色压暗一点：无色液体（水）也要在水柱边缘看得出来。 */
function shade(color, factor) {
  if (typeof color !== 'string' || color.charAt(0) !== '#' || color.length !== 7) return color;
  var r = Math.min(255, Math.round(parseInt(color.slice(1, 3), 16) * factor));
  var g = Math.min(255, Math.round(parseInt(color.slice(3, 5), 16) * factor));
  var b = Math.min(255, Math.round(parseInt(color.slice(5, 7), 16) * factor));
  return 'rgb(' + r + ', ' + g + ', ' + b + ')';
}

/*
 * 水是几乎无色的（#eef3f4），直接画在白纸上一片白。
 * 近白的液体换一层冷灰蓝来画液流：还是「这杯液体的颜色」，
 * 只是提了一点对比度 —— 和玻璃描边同一个色系，不会显得串色。
 */
function streamTint(color) {
  if (typeof color !== 'string' || color.charAt(0) !== '#' || color.length !== 7) return color;
  var r = parseInt(color.slice(1, 3), 16);
  var g = parseInt(color.slice(3, 5), 16);
  var b = parseInt(color.slice(5, 7), 16);
  return Math.min(r, g, b) > 228 ? '#b6cfda' : color;
}

/* 水柱本体 + 亮芯 + 流动亮斑。 */
function drawStream(ctx, geometry, flow) {
  var t = time();
  var thickness = geometry.thickness * (1 + 0.06 * Math.sin(t * 14));
  var tint = streamTint(flow.color);
  /* 水是无色的：亮芯用一点点提过对比度的水色，边缘再压暗一档 */
  var core = shade(tint, 0.92);
  var edge = shade(tint, 0.72);

  /* ① 实体：半透明，压在亮芯下面，有体积感；描一圈淡边让水在纸上看得见 */
  ctx.save();
  ctx.beginPath();
  traceStream(ctx, geometry);
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = tint;
  ctx.shadowColor = 'rgba(15, 42, 54, 0.18)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 0.6;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = edge;
  ctx.stroke();
  ctx.restore();

  /* ② 亮芯 */
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  traceCore(ctx, geometry);
  ctx.strokeStyle = core;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.stroke();

  /* ②b 亮芯的下缘：一道更深的线，无色液体的液流不会消失在白纸上 */
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  traceCore(ctx, geometry);
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(0.35, thickness * 0.28);
  ctx.stroke();

  /* ③ 高光：细白线 + 沿流向移动的亮斑 */
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  traceCore(ctx, geometry);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = Math.max(0.5, thickness - 1.8);
  ctx.stroke();

  for (var i = 0; i < 3; i += 1) {
    var at = fract(t * 1.7 + i / 3);
    var spot = quadPoint(geometry.from, geometry.control, geometry.to, at);
    ctx.globalAlpha = 0.45 * (1 - Math.abs(at - 0.5));
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, Math.max(0.6, thickness * 0.42), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/* 落点：扩散的涟漪 + 一点水花，跟着进度一起加大。 */
function drawSplash(ctx, geometry, flow) {
  var t = time();
  var drop = geometry.to;
  var radius = splashRadius(flow.progress || 0);
  var tint = streamTint(flow.color);

  /* 两圈错开的涟漪：第二圈比第一圈晚半个周期，看起来像连续落液 */
  for (var i = 0; i < 2; i += 1) {
    var phase = fract(t * 1.5 + i * 0.5);
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y + 1.4, radius * (0.7 + phase * 0.7), 1.4 + phase * 1.4, 0, 0, Math.PI * 2);
    ctx.globalAlpha = (1 - phase) * 0.4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  /* 落点那一小团液体：液流砸出来的「坑」 */
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(drop.x, drop.y + 1.4, radius * 0.55, 1.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = tint;
  ctx.fill();

  /* 溅起来的液滴：两三粒，位置由时间与序号确定 */
  for (var k = 0; k < 3; k += 1) {
    var life = fract(t * 2.2 + k / 3);
    var side = k % 2 === 0 ? -1 : 1;
    ctx.globalAlpha = (1 - life) * 0.7;
    ctx.beginPath();
    ctx.arc(
      drop.x + side * (1.4 + life * 5 + k * 0.6),
      drop.y - life * 5 + life * life * 5,
      0.55 + (1 - life) * 0.35,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = tint;
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

export default function PourStream(props) {
  var flow = props.flow;
  if (!flow) return null;

  var source = null;
  var target = null;

  (props.items || []).forEach(function (entry) {
    if (entry.id === flow.sourceId) source = entry;
    if (entry.id === flow.targetId) target = entry;
  });

  if (!source || !target) return null;

  /* 落点定在目标容器「当前液面」上：液流砸进液体里，而不是停在瓶口 */
  var surface = liquidSurface(target);
  var dropY = surface === null ? undefined : target.y + surface + 1;

  /* 起点用倾斜后的唇边：瓶子转多少，水就从最低那一侧挂出去 */
  var dir = mouthPoint(target).x < mouthPoint(source).x ? -1 : 1;
  var lip = lipPoint(source, dir, scene.tilt[source.id] || 0);
  var geometry = pourGeometry(source, target, flow.amount, mouthPoint, dropY, lip);

  return (
    <Group listening={false}>
      <Shape
        name="pour-stream"
        sceneFunc={function (ctx) { drawStream(ctx, geometry, flow); }}
      />
      <Shape
        name="pour-splash"
        sceneFunc={function (ctx) { drawSplash(ctx, geometry, flow); }}
      />
    </Group>
  );
}
