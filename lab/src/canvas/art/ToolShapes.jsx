/**
 * ToolShapes.jsx —— 非玻璃工具（酒精灯 / 铁架台 / 石棉网 / 玻璃棒 / 滴管 / 火柴 / pH 试纸）
 * ------------------------------------------------------------------
 * 轮廓与 Vessel.jsx 的 SVG 完全同源，只是换成 Konva 的 Path / Rect / Ellipse，
 * 并把 SVG 的 linearGradient 换成 Konva 的 fillLinearGradientColorStops。
 * 工具没有液体，但都有「金属 / 橡胶 / 木头」的材质渐变和一层落地阴影。
 *
 * 火焰由 FlameShape.jsx 逐帧抖动（外焰橙 / 中焰金 / 焰心蓝），这里只留灯芯与灯体。
 */
import React from 'react';
import { Group, Path, Rect, Ellipse, Line, Circle } from 'react-konva';
import { TOOLS } from '../../art.js';
import {
  STEEL,
  METAL,
  RUBBER,
  BURNER_BODY,
  ALCOHOL,
  GAUZE_FRAME,
  GAUZE_PAD,
  GAUZE_HOT
} from '../palette.js';
import FlameShape from './FlameShape.jsx';

/* 酒精灯：玻璃灯体 + 灯内酒精 + 金属灯芯管 + 灯芯 + 三层火焰。 */
export function BurnerShape(props) {
  var lit = !!props.item.lit;

  return (
    <Group>
      <Path
        data="M6.4 112 Q4.6 82 22.4 62 Q26 58 26 54.4 H54 Q54 58 57.6 62 Q75.4 82 73.6 112 Z"
        fillLinearGradientStartPoint={{ x: 4, y: 0 }}
        fillLinearGradientEndPoint={{ x: 76, y: 0 }}
        fillLinearGradientColorStops={BURNER_BODY}
        stroke="rgba(15, 23, 42, 0.16)"
        strokeWidth={0.8}
        shadowColor="rgba(12, 42, 54, 0.24)"
        shadowBlur={6}
        shadowOffsetY={2}
        shadowOpacity={0.8}
      />
      <Path
        data="M9.6 94 Q40 98 70.4 94 L72 108.4 Q40 113 8 108.4 Z"
        fillLinearGradientStartPoint={{ x: 0, y: 94 }}
        fillLinearGradientEndPoint={{ x: 0, y: 112 }}
        fillLinearGradientColorStops={ALCOHOL}
        listening={false}
      />
      <Path
        data="M12 106 Q10.6 84 22 66 Q26 60 26 57"
        stroke="rgba(255, 255, 255, 0.8)"
        strokeWidth={1.2}
        listening={false}
      />
      <Path
        data="M68 104 Q68.6 84 58 64"
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth={1}
        listening={false}
      />

      {/* 灯芯管：两段金属套筒 */}
      <Rect
        x={28}
        y={50.8}
        width={24}
        height={3.8}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 24, y: 0 }}
        fillLinearGradientColorStops={METAL}
        stroke="rgba(15, 23, 42, 0.14)"
        strokeWidth={0.3}
      />
      <Rect
        x={32}
        y={44.6}
        width={16}
        height={6.2}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 16, y: 0 }}
        fillLinearGradientColorStops={METAL}
        stroke="rgba(15, 23, 42, 0.14)"
        strokeWidth={0.3}
      />
      <Line points={[28, 52.8, 52, 52.8]} stroke="rgba(15, 23, 42, 0.16)" strokeWidth={0.3} listening={false} />
      <Line points={[32, 47.8, 48, 47.8]} stroke="rgba(15, 23, 42, 0.16)" strokeWidth={0.3} listening={false} />

      {/* 灯芯 */}
      <Rect x={37.4} y={39.4} width={5.2} height={5.2} fill="rgba(126, 116, 102, 0.9)" />

      {lit ? (
        /* 火焰（Step 4）：三层火苗逐帧抖动，暖光跟着呼吸 —— 见 FlameShape.jsx */
        <FlameShape x={40} baseY={39.4} height={31.4} width={16.8} seed={props.item.id} />
      ) : null}
    </Group>
  );
}

/* 铁架台：底板 + 立杆 + 铁圈 + 支臂 + 固定螺丝（圈心 98,400 是 store 的吸附点）。 */
export function StandShape() {
  var art = TOOLS.stand;

  return (
    <Group>
      <Path
        data="M8 546 H192 Q200 546 200 552.6 V554 Q200 560 191 560 H9 Q0 560 0 554 V552.6 Q0 546 8 546 Z"
        fillLinearGradientStartPoint={{ x: 0, y: 546 }}
        fillLinearGradientEndPoint={{ x: 0, y: 560 }}
        fillLinearGradientColorStops={[
          0,
          'rgba(238, 241, 242, 1)',
          0.6,
          'rgba(206, 213, 216, 1)',
          1,
          'rgba(154, 165, 170, 1)'
        ]}
        stroke="rgba(15, 23, 42, 0.2)"
        strokeWidth={0.7}
        shadowColor="rgba(12, 42, 54, 0.28)"
        shadowBlur={7}
        shadowOffsetY={2}
        shadowOpacity={0.85}
      />
      <Line points={[4, 550, 196, 550]} stroke="rgba(255, 255, 255, 0.75)" strokeWidth={0.8} listening={false} />

      <Rect
        x={art.rod.x - 5}
        y={art.rod.top}
        width={art.rod.width}
        height={art.basePlate.y - art.rod.top}
        cornerRadius={2}
        fillLinearGradientStartPoint={{ x: art.rod.x - 5, y: 0 }}
        fillLinearGradientEndPoint={{ x: art.rod.x + 5, y: 0 }}
        fillLinearGradientColorStops={STEEL}
        stroke="rgba(15, 23, 42, 0.16)"
        strokeWidth={0.5}
      />
      <Line
        points={[art.rod.x - 3.4, 18, art.rod.x - 3.4, art.basePlate.y - 4]}
        stroke="rgba(255, 255, 255, 0.85)"
        strokeWidth={1.1}
        listening={false}
      />

      {/* 支臂与圈：外环粗、内环细，正面看过去的椭圆环 */}
      <Line
        points={[art.arm.x1, art.ring.y, art.rod.x - 4, art.ring.y]}
        stroke="rgba(198, 207, 211, 1)"
        strokeWidth={6}
        lineCap="round"
        shadowColor="rgba(12, 42, 54, 0.2)"
        shadowBlur={3}
        shadowOffsetY={1}
      />
      <Ellipse
        x={art.ring.x}
        y={art.ring.y}
        radiusX={art.ring.rx}
        radiusY={art.ring.ry}
        stroke="rgba(176, 187, 192, 1)"
        strokeWidth={6}
        shadowColor="rgba(12, 42, 54, 0.22)"
        shadowBlur={4}
        shadowOffsetY={1.4}
      />
      <Ellipse
        x={art.ring.x}
        y={art.ring.y}
        radiusX={art.ring.rx - 1}
        radiusY={art.ring.ry - 1}
        stroke="rgba(255, 255, 255, 0.7)"
        strokeWidth={1.1}
        listening={false}
      />
      <Ellipse
        x={art.ring.x}
        y={art.ring.y}
        radiusX={art.ring.inner}
        radiusY={art.ring.ry - 3.6}
        stroke="rgba(15, 23, 42, 0.18)"
        strokeWidth={1}
        listening={false}
      />
      <Circle
        x={art.rod.x - 2}
        y={art.ring.y + 9}
        radius={3.2}
        fill="rgba(150, 161, 166, 1)"
        stroke="rgba(15, 23, 42, 0.2)"
        strokeWidth={0.4}
      />
    </Group>
  );
}


/* 石棉网：金属框 + 斜向网格 + 白色石棉垫；架在火上时转暖色。 */
export function GauzeShape(props) {
  var pad = TOOLS['wire-gauze'].pad;
  var hot = !!props.item.hot;
  var mesh = [];
  var i;

  for (i = 0; i < 13; i += 1) {
    mesh.push(
      <Line
        key={'mesh-' + i}
        points={[-4 + i * 10, 8, 14 + i * 10, 0]}
        stroke="rgba(120, 132, 138, 0.4)"
        strokeWidth={0.4}
        listening={false}
      />
    );
  }

  return (
    <Group>
      {hot ? (
        <Ellipse x={60} y={5} radiusX={40} radiusY={7} fill="rgba(240, 176, 100, 0.22)" listening={false} />
      ) : null}
      <Rect
        x={0}
        y={0}
        width={120}
        height={10}
        cornerRadius={1.4}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: 10 }}
        fillLinearGradientColorStops={GAUZE_FRAME}
        stroke="rgba(15, 23, 42, 0.2)"
        strokeWidth={0.6}
        shadowColor="rgba(12, 42, 54, 0.24)"
        shadowBlur={4}
        shadowOffsetY={1.4}
      />
      <Group
        clipFunc={function (ctx) {
          ctx.moveTo(0, 0);
          ctx.lineTo(120, 0);
          ctx.lineTo(120, 10);
          ctx.lineTo(0, 10);
          ctx.closePath();
        }}
        listening={false}
      >
        {mesh}
      </Group>
      <Ellipse
        x={pad.cx}
        y={pad.cy}
        radiusX={pad.rx}
        radiusY={pad.ry}
        fill={hot ? GAUZE_HOT : GAUZE_PAD}
        listening={false}
      />
      <Line points={[2.4, 1.6, 117.6, 1.6]} stroke="rgba(255, 255, 255, 0.8)" strokeWidth={0.7} listening={false} />
    </Group>
  );
}


/* 玻璃棒：φ6×236，左侧高光、右缘暗边，两端磨圆。 */
export function RodShape() {
  return (
    <Group>
      <Rect
        x={2}
        y={2}
        width={6}
        height={236}
        cornerRadius={3}
        fillLinearGradientStartPoint={{ x: 2, y: 0 }}
        fillLinearGradientEndPoint={{ x: 8, y: 0 }}
        fillLinearGradientColorStops={[
          0,
          'rgba(255, 255, 255, 0.92)',
          0.14,
          'rgba(255, 255, 255, 0.62)',
          0.46,
          'rgba(238, 244, 246, 0.3)',
          0.82,
          'rgba(169, 184, 190, 0.42)',
          1,
          'rgba(135, 152, 160, 0.55)'
        ]}
        stroke="rgba(15, 23, 42, 0.15)"
        strokeWidth={0.9}
        shadowColor="rgba(12, 42, 54, 0.18)"
        shadowBlur={4}
        shadowOffsetY={1.4}
      />
      <Line points={[3.7, 8, 3.7, 232]} stroke="rgba(255, 255, 255, 0.9)" strokeWidth={1} listening={false} />
      <Line points={[6.4, 8, 6.4, 232]} stroke="rgba(15, 23, 42, 0.12)" strokeWidth={0.6} listening={false} />
      <Path data="M3.4 4.6 Q5 2.6 6.6 4.6" stroke="rgba(255, 255, 255, 0.9)" strokeWidth={0.6} listening={false} />
      <Path data="M3.4 235.4 Q5 237.4 6.6 235.4" stroke="rgba(255, 255, 255, 0.7)" strokeWidth={0.6} listening={false} />
    </Group>
  );
}

/* 胶头滴管：橡胶头 + 细玻璃管 +（吸了试剂时的）管内液柱。 */
export function DropperShape(props) {
  var filled = !!props.item.dropperFill;

  return (
    <Group>
      <Ellipse
        x={12}
        y={16}
        radiusX={9}
        radiusY={15}
        fillLinearGradientStartPoint={{ x: 3, y: 0 }}
        fillLinearGradientEndPoint={{ x: 21, y: 0 }}
        fillLinearGradientColorStops={RUBBER}
        stroke="rgba(15, 23, 42, 0.2)"
        strokeWidth={0.5}
        shadowColor="rgba(12, 42, 54, 0.24)"
        shadowBlur={4}
        shadowOffsetY={1.4}
      />
      <Path
        data="M5.4 11.6 Q6.2 6.6 10 5.4"
        stroke="rgba(255, 255, 255, 0.55)"
        strokeWidth={1.4}
        lineCap="round"
        listening={false}
      />
      <Line points={[8.4, 29.6, 15.6, 29.6]} stroke="rgba(15, 23, 42, 0.24)" strokeWidth={0.6} listening={false} />
      <Path
        data="M9.6 29.6 H14.4 V88 L13.2 100 Q12 102.8 10.8 100 L9.6 88 Z"
        fillLinearGradientStartPoint={{ x: 9.6, y: 0 }}
        fillLinearGradientEndPoint={{ x: 14.4, y: 0 }}
        fillLinearGradientColorStops={[
          0,
          'rgba(255, 255, 255, 0.9)',
          0.3,
          'rgba(255, 255, 255, 0.4)',
          0.8,
          'rgba(255, 255, 255, 0.16)',
          1,
          'rgba(147, 164, 171, 0.4)'
        ]}
        stroke="rgba(15, 23, 42, 0.16)"
        strokeWidth={0.5}
      />
      {filled ? (
        <Path
          data="M10.4 46 H13.6 V87.6 L12.6 98 Q12 99.4 11.4 98 L10.4 87.6 Z"
          fill="rgba(196, 214, 220, 0.85)"
          listening={false}
        />
      ) : null}
      <Line points={[10.8, 33, 10.8, 86]} stroke="rgba(255, 255, 255, 0.85)" strokeWidth={0.7} listening={false} />
      <Path data="M11 101.4 Q12 102.8 13 101.4" stroke="rgba(15, 23, 42, 0.2)" strokeWidth={0.5} listening={false} />
    </Group>
  );
}

/* 火柴：木梗 + 火柴头；划燃后头顶三层火苗。 */
export function MatchShape(props) {
  var burning = !!props.item.lit;

  return (
    <Group>
      <Path
        data="M5.2 52.4 L5.6 12 L6.4 12 L6.8 52.4 Z"
        fill="rgba(206, 186, 152, 1)"
        stroke="rgba(15, 23, 42, 0.16)"
        strokeWidth={0.3}
      />
      <Line points={[5.9, 50, 5.9, 14.4]} stroke="rgba(255, 255, 255, 0.6)" strokeWidth={0.4} listening={false} />
      <Ellipse x={6} y={9} radiusX={2.6} radiusY={4} fill="rgba(178, 74, 58, 1)" listening={false} />
      {burning ? (
        /* 火柴的火苗更小更急：同一套火焰，尺寸小一号、相位由器材 id 决定 */
        <FlameShape x={6} baseY={6} height={10.4} width={5.2} seed={props.item.id} />
      ) : null}
    </Group>
  );
}

/* pH 试纸：8×50 的纸条 + 四道比色刻度（变色由 store 的 pH 结算，Step 4 接上）。 */
export function PaperShape(props) {
  var tint = props.item.paperColor || 'rgba(248, 245, 226, 1)';

  return (
    <Group>
      <Rect
        x={2}
        y={2}
        width={12}
        height={50}
        fill={tint}
        stroke="rgba(15, 23, 42, 0.18)"
        strokeWidth={0.4}
        shadowColor="rgba(12, 42, 54, 0.18)"
        shadowBlur={3}
        shadowOffsetY={1}
      />
      <Line points={[2, 12, 14, 12]} stroke="rgba(15, 23, 42, 0.14)" strokeWidth={0.4} listening={false} />
      <Line points={[2, 22, 14, 22]} stroke="rgba(15, 23, 42, 0.14)" strokeWidth={0.4} listening={false} />
      <Line points={[2, 32, 14, 32]} stroke="rgba(15, 23, 42, 0.14)" strokeWidth={0.4} listening={false} />
      <Line points={[2, 42, 14, 42]} stroke="rgba(15, 23, 42, 0.14)" strokeWidth={0.4} listening={false} />
    </Group>
  );
}

