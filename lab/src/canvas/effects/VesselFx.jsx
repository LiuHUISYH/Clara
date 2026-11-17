/**
 * VesselFx.jsx —— 容器里的动态现象（Step 4）
 * ------------------------------------------------------------------
 * 挂在特效层（Stage 坐标）上，按器材的 x/y 平移过去，再裁进同一套内腔，
 * 于是气泡贴着真实的玻璃壁上升，不会爬到铁架台上。
 *
 * 四种现象共用一份「时间 + 确定性随机」：
 *   气泡   gas 反应放气 / 沸腾时从底部升起，沸腾的更密更快
 *   涡流   搅拌时液面下的三圈亮弧（液体被带着打旋）
 *   沉淀   悬浮固体（turbidity > 0）先飘着，停下来后沉到器底积一层
 *   蒸汽   沸腾时从瓶口飘出的白雾（不裁剪，可以越过器物轮廓）
 *
 * 每个气泡的相位来自 hashSeed(item.id) + 序号：刷新页面也长在同一个位置，
 * 不会有「一帧换一批」的闪烁。
 */
import React from 'react';
import { Group, Shape } from 'react-konva';
import { artOf } from '../../art.js';
import { interiorOf, interiorPath, liquidHeight } from '../liquid.js';
import { time, hashSeed, noise, fract, clamp } from '../motion.js';

/* 气泡数量：沸腾 14 个，普通放气最多 10 个。 */
function bubbleCount(item) {
  if (item.boiling) return 14;
  if (!item.gas) return 0;
  return clamp(3 + (item.gasTimes || 1) * 2, 3, 10);
}

function drawBubbles(ctx, item, box, surface, seed) {
  var count = bubbleCount(item);
  if (!count) return;
  var t = time();
  var boiling = !!item.boiling;
  var rise = Math.max(6, box.bottom - surface - 2);
  var speed = boiling ? 0.72 : 0.34;

  for (var i = 0; i < count; i += 1) {
    var progress = fract(t * speed + noise(seed, i + 3));
    /* 半径：沸腾的气泡更大，而且一路变大（上升时外压变小） */
    var radius = (boiling ? 0.85 : 0.6) + noise(seed, i + 17) * (boiling ? 0.9 : 0.6) + progress * 0.5;
    var x =
      box.left + 2 + (box.right - box.left - 4) * noise(seed, i + 31) +
      Math.sin(t * 2.1 + i) * 0.8;
    var y = box.bottom - 2.4 - rise * progress;
    var alpha = progress > 0.88 ? (1 - progress) / 0.12 : 1;

    ctx.globalAlpha = 0.55 * alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();
    ctx.globalAlpha = 0.5 * alpha;
    ctx.lineWidth = 0.35;
    ctx.strokeStyle = 'rgba(126, 160, 172, 0.8)';
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

/* 搅拌涡流：三圈亮弧，相位错开，读起来是「在转」。 */
function drawSwirl(ctx, box, surface) {
  var t = time();
  var mid = (box.left + box.right) / 2;
  var maxR = Math.min((box.right - box.left) / 2 - 1.6, 16);

  for (var i = 0; i < 3; i += 1) {
    var r = maxR - i * 2.6;
    if (r <= 2) continue;
    ctx.beginPath();
    ctx.ellipse(
      mid,
      surface + 1.6 + i * 1.1,
      r,
      Math.max(1, r * 0.3),
      t * (1.6 + i * 0.2),
      0,
      Math.PI * 1.25
    );
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.5 - i * 0.12).toFixed(2) + ')';
    ctx.lineWidth = 0.8 - i * 0.15;
    ctx.stroke();
  }
}


/*
 * 沉淀：器底一条逐渐加厚的沉渣 + 几粒慢慢飘的悬浮固体。
 * 浑浊度（turbidity）同时是沉渣高度和悬浮颗粒数量的来源 ——
 * 静置一会儿会「沉下去」，搅拌时又飘满整罐。
 */
function drawSediment(ctx, item, box, surface, seed) {
  var haze = item.turbidity || 0;
  if (haze <= 0.02) return;
  var t = time();
  var solids = (item.contents || []).filter(function (entry) {
    return entry.state === 'solid';
  });
  var color = solids.length && solids[0].color ? solids[0].color : '#c9c5b7';
  var bedHeight = clamp(haze * 9, 0.6, 8);
  var width = box.right - box.left;

  /* 器底沉渣：上沿是一条缓慢起伏的软线，像被液体压住的粉末堆 */
  ctx.beginPath();
  ctx.moveTo(box.left, box.bottom - bedHeight * 0.4);
  for (var i = 1; i <= 8; i += 1) {
    var x = box.left + (width / 8) * i;
    var y = box.bottom - bedHeight + Math.sin(i * 1.1 + t * 0.8) * bedHeight * 0.18;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(box.right, box.bottom);
  ctx.lineTo(box.left, box.bottom);
  ctx.closePath();
  ctx.globalAlpha = Math.min(0.72, 0.24 + haze);
  ctx.fillStyle = color;
  ctx.fill();

  /* 悬浮颗粒：搅拌 / 加热时飘满液体，静置时慢慢下坠 */
  var floating = item.stirring || item.boiling ? 14 : 6;
  for (var k = 0; k < floating; k += 1) {
    var phase = fract(t * (item.stirring ? 0.5 : 0.12) + noise(seed, k + 5));
    var px = box.left + 3 + (width - 6) * noise(seed, k + 41);
    var py = item.stirring
      ? surface + 2 + (box.bottom - surface - 4) * noise(seed, k + 61)
      : box.bottom - bedHeight - (box.bottom - surface - bedHeight) * phase;
    ctx.beginPath();
    ctx.arc(px, py, 0.5 + noise(seed, k + 71) * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/* 沸腾蒸汽：从瓶口升起的三团白雾，越往上越大越淡。 */
function drawSteam(ctx, item, box) {
  var t = time();
  var art = artOf(item.type);
  var mouth = art && art.mouth ? art.mouth : { cx: (box.left + box.right) / 2, cy: box.top };
  var seed = hashSeed(item.id) + 9;

  for (var i = 0; i < 3; i += 1) {
    var progress = fract(t * 0.32 + i / 3 + noise(seed, i) * 0.2);
    var rise = progress * 34;
    var radius = 4 + progress * 9;
    var cx = mouth.cx + Math.sin(t * 1.1 + i * 2) * (2 + progress * 4);
    var cy = mouth.cy - rise;
    var alpha = (1 - progress) * 0.2;

    var puff = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    puff.addColorStop(0, 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')');
    puff.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = puff;
    ctx.fill();
  }
}

export default function VesselFx(props) {
  var item = props.item;
  if (item.kind !== 'container') return null;

  var box = interiorOf(item.type);
  var height = liquidHeight(item);
  if (!box || height <= 0) return null;

  var surface = box.bottom - height;
  var seed = hashSeed(item.id);
  var showBubbles = !!item.boiling || !!item.gas;
  var showSediment = (item.turbidity || 0) > 0.02;
  var showSteam = !!item.boiling;

  if (!showBubbles && !showSediment && !item.stirring && !showSteam) return null;

  return (
    <Group x={item.x} y={item.y} listening={false}>
      <Group clipFunc={function (ctx) { interiorPath(ctx, box); }}>
        {showSediment ? (
          <Shape
            name="lab-sediment"
            sceneFunc={function (ctx) { drawSediment(ctx, item, box, surface, seed); }}
          />
        ) : null}
        {showBubbles ? (
          <Shape
            name="lab-bubbles"
            sceneFunc={function (ctx) { drawBubbles(ctx, item, box, surface, seed); }}
          />
        ) : null}
        {item.stirring ? (
          <Shape name="lab-swirl" sceneFunc={function (ctx) { drawSwirl(ctx, box, surface); }} />
        ) : null}
      </Group>
      {showSteam ? (
        <Shape name="lab-steam" sceneFunc={function (ctx) { drawSteam(ctx, item, box); }} />
      ) : null}
    </Group>
  );
}
