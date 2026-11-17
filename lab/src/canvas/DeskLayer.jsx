/**
 * DeskLayer.jsx —— 实验台背景层（点阵网格 + 台面线 + 毫米标尺）
 * ------------------------------------------------------------------
 * 这一层是纯背景，`listening={false}`：鼠标事件直接穿过去，只有器材接得住。
 * 画的内容和 HTML 版一一对应，只是搬到 Canvas 里：
 *   · 22mm 的点阵（对应 CSS 的 background-image 虚线格）
 *   · 台面线 y = 画布高 − 58mm（和 store.deskLineY 同一个数）
 *   · 底边一把毫米标尺：每 10mm 一短刻，每 50mm 一长刻并标数字
 * 网格用 sceneFunc 直接画线，而不是几百个小矩形：一帧只画一条路径，
 * 器材多的时候也不会把渲染预算浪费在背景上。
 */
import React from 'react';
import { Layer, Rect, Shape, Line, Text } from 'react-konva';
import { MONO } from './palette.js';

var GRID = 22;
var GRID_MAJOR = GRID * 5;

function drawGrid(context, shape) {
  var width = shape.width();
  var height = shape.height();
  var deskY = shape.getAttr('deskY');
  var x;
  var y;

  context.setLineDash([1.6, 6.4]);
  context.beginPath();
  for (x = GRID; x < width; x += GRID) {
    context.moveTo(x, 0);
    context.lineTo(x, deskY);
  }
  for (y = GRID; y < deskY; y += GRID) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.fillStrokeShape(shape);

  /* 每 110mm 一根实线：给出「一格 11cm」的空间感，又不会压过器材。 */
  context.setLineDash([]);
  context.beginPath();
  for (x = GRID_MAJOR; x < width; x += GRID_MAJOR) {
    context.moveTo(x, 0);
    context.lineTo(x, deskY);
  }
  for (y = GRID_MAJOR; y < deskY; y += GRID_MAJOR) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.fillStrokeShape(shape);
}

/* 底边毫米标尺：短刻 10mm、长刻 50mm，数字只标长刻。 */
function drawRuler(context, shape) {
  var width = shape.width();
  var height = shape.height();
  var x;

  context.beginPath();
  for (x = 10; x < width; x += 10) {
    var tall = x % 50 === 0;
    context.moveTo(x, height - (tall ? 9 : 4));
    context.lineTo(x, height);
  }
  context.fillStrokeShape(shape);
}

export default function DeskLayer(props) {
  var width = props.width;
  var height = props.height;
  var deskY = props.deskY;
  var marks = [];
  var x;

  for (x = 50; x < width; x += 50) {
    marks.push(
      <Text
        key={'ruler-' + x}
        x={x - 14}
        y={height - 20}
        width={28}
        text={String(x)}
        align="center"
        fontSize={7}
        fontFamily={MONO}
        fill="rgba(148, 163, 184, 0.9)"
        listening={false}
      />
    );
  }

  return (
    <Layer listening={false}>
      {/* 实验台底色：上白下暖，和页面留白同一个色系 */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: height }}
        fillLinearGradientColorStops={[
          0,
          'rgba(252, 252, 250, 1)',
          0.72,
          'rgba(249, 249, 246, 1)',
          1,
          'rgba(243, 244, 239, 1)'
        ]}
      />

      {/* 点阵网格：浅灰虚线，只在台面线以上 */}
      <Shape
        sceneFunc={drawGrid}
        width={width}
        height={height}
        deskY={deskY}
        stroke="rgba(214, 216, 211, 0.85)"
        strokeWidth={1}
        perfectDrawEnabled={false}
      />

      {/* 台面线：器材的器底都压在这条线上 */}
      <Rect
        x={0}
        y={deskY}
        width={width}
        height={height - deskY}
        fillLinearGradientStartPoint={{ x: 0, y: deskY }}
        fillLinearGradientEndPoint={{ x: 0, y: height }}
        fillLinearGradientColorStops={[
          0,
          'rgba(238, 240, 234, 0.55)',
          1,
          'rgba(243, 244, 239, 1)'
        ]}
      />
      <Line
        points={[0, deskY, width, deskY]}
        stroke="rgba(203, 213, 225, 0.9)"
        strokeWidth={1}
        shadowColor="rgba(148, 163, 184, 0.35)"
        shadowBlur={3}
        shadowOffsetY={1}
      />
      <Text
        x={width - 62}
        y={deskY + 4}
        width={54}
        text="实验台面"
        align="right"
        fontSize={8}
        letterSpacing={0.6}
        fontFamily={MONO}
        fill="rgba(148, 163, 184, 0.95)"
        listening={false}
      />

      {/* 底边标尺 */}
      <Shape
        sceneFunc={drawRuler}
        width={width}
        height={height}
        stroke="rgba(148, 163, 184, 0.75)"
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      {marks}

      {/* 空画布提示：和 HTML 版同一句话 */}
      {props.empty ? (
        <Text
          x={0}
          y={deskY - 12}
          width={width}
          text="拖拽器材或试剂到此处"
          align="center"
          fontSize={11}
          letterSpacing={1.4}
          fontFamily={MONO}
          fill="rgba(148, 163, 184, 0.9)"
          listening={false}
        />
      ) : null}
    </Layer>
  );
}
