/**
 * FlameShape.jsx —— 会动的火焰（Step 4）
 * ------------------------------------------------------------------
 * Step 2 的火焰是三条写死的贝塞尔路径：形状正确，但像一张贴纸。
 * 真实的酒精灯火焰每秒抖十几下 —— 外焰拉长、焰尖左右摆、焰心一亮一暗。
 * 这里把三条路径改成「由时间算出来的」：
 *
 *   焰尖 y   = 基准 − 高度 × (1 + 0.05 sin(8t))
 *   焰尖 x   = 中心 + 宽度 × 0.06 × sin(5.2t + 相位)
 *   外焰腰   = 宽度 × (1 + 0.06 sin(6.5t))
 *   整体亮度 = 0.92 + 0.08 sin(9.3t)
 *
 * 三层（外焰橙 / 中焰金 / 焰心蓝）用同一个相位族，所以它们是同一个火苗
 * 的三层，而不是三团各自抖动的火。所有抖动都由 motion 的时钟驱动，
 * 不产生 React 渲染。
 *
 * 火焰外面那圈暖光是径向渐变：酒精灯亮着时桌面会被照着，
 * 光晕的透明度跟着亮度一起呼吸。
 */
import React from 'react';
import { Shape } from 'react-konva';
import { FLAME_OUTER, FLAME_MID, FLAME_CORE } from '../palette.js';
import { time, hashSeed } from '../motion.js';

/*
 * 画一层火苗：底边贴着 baseY，向上一根尖。
 *   width   底部宽度（mm）
 *   height  焰尖到底边的高度（mm）
 *   waist   腰部收缩系数（0.35 → 上宽下窄的泪滴形）
 */
function drawLayer(ctx, x, baseY, width, height, waist, tipX, fill) {
  var half = width / 2;
  var tipY = baseY - height;

  ctx.beginPath();
  ctx.moveTo(x - half, baseY);
  ctx.bezierCurveTo(
    x - half - half * 0.35,
    baseY - height * 0.36,
    tipX - half * waist,
    tipY + height * 0.26,
    tipX,
    tipY
  );
  ctx.bezierCurveTo(
    tipX + half * waist,
    tipY + height * 0.26,
    x + half + half * 0.35,
    baseY - height * 0.36,
    x + half,
    baseY
  );
  /* 底边收成一点弧：火苗是「坐」在灯芯上的，不是被切断的 */
  ctx.quadraticCurveTo(x, baseY + height * 0.05, x - half, baseY);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export default function FlameShape(props) {
  var x = props.x;
  var baseY = props.baseY;
  var height = props.height;
  var width = props.width;
  var seed = hashSeed(props.seed === undefined ? 'flame' : props.seed) % 628 * 0.01;

  return (
    <Shape
      name="flame"
      listening={false}
      sceneFunc={function (ctx) {
        var t = time();
        /* 三个不同频率叠加：看上去是「跳动」，而不是一条正弦在晃 */
        var sway = (Math.sin(t * 5.2 + seed) * 0.6 + Math.sin(t * 8.7 + seed * 1.7) * 0.4) * width * 0.11;
        var lift = 1 + 0.07 * Math.sin(t * 8.1 + seed) + 0.03 * Math.sin(t * 13.3 + seed * 2.3);
        var flare = 1 + 0.09 * Math.sin(t * 6.5 + seed * 0.7);
        var bright = 0.92 + 0.1 * Math.sin(t * 9.3 + seed * 1.4);
        var tipX = x + sway;
        var top = baseY - height * lift;

        /* ① 桌面上的暖光：跟着亮度呼吸 */
        var halo = ctx.createRadialGradient(x, baseY - height * 0.42, 0, x, baseY - height * 0.42, width * 1.7);
        halo.addColorStop(0, 'rgba(255, 198, 126, ' + (0.16 * bright).toFixed(3) + ')');
        halo.addColorStop(0.55, 'rgba(255, 198, 126, ' + (0.07 * bright).toFixed(3) + ')');
        halo.addColorStop(1, 'rgba(255, 198, 126, 0)');
        ctx.beginPath();
        ctx.ellipse(x, baseY - height * 0.42, width * 1.7, height * 0.95, 0, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        /* ② 外焰：最宽、最高、最亮，焰尖摆得最厉害 */
        ctx.globalAlpha = 0.9 * bright;
        drawLayer(ctx, x, baseY, width * flare, baseY - top, 1.05, tipX, FLAME_OUTER);

        /* ③ 中焰：比外焰短三成，焰尖稍微偏一点相位 */
        ctx.globalAlpha = 0.92 * bright;
        drawLayer(
          ctx,
          x,
          baseY - height * 0.06,
          width * 0.62 * flare,
          height * 0.72 * lift,
          0.9,
          x + sway * 0.7,
          FLAME_MID
        );

        /* ④ 焰心：贴着灯芯的一小团蓝火，抖动最小（它是最稳定的部分） */
        ctx.globalAlpha = 0.9;
        drawLayer(
          ctx,
          x,
          baseY - height * 0.04,
          width * 0.3,
          height * 0.34 * (1 + 0.03 * Math.sin(t * 11 + seed)),
          0.8,
          x + sway * 0.35,
          FLAME_CORE
        );

        ctx.globalAlpha = 1;
      }}
    />
  );
}
