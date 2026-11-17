/**
 * EquipmentArt.jsx —— 器型分发：一件器材该画成什么
 * ------------------------------------------------------------------
 * 画布里的每件器材都是一层 Group：先按 type 选矢量外形，再在器底下方挂
 * 两行标签（名称 / 状态）。选中时不是改颜色，而是在外面套一圈虚线框 ——
 * 玻璃的颜色只表示化学状态，不表示 UI 状态。
 *
 * 矢量外形只是「没有 PNG 素材时的兜底」：EquipmentImage 一旦在
 * lab/assets/equipment/ 里找到同名图片，就会用 Konva.Image 盖上，
 * 这里的代码不用改。
 */
import React from 'react';
import { Group, Text, Rect, Line } from 'react-konva';
import { GLASS, sizeOf, baseOf } from '../art.js';
import BeakerShape from './art/BeakerShape.jsx';
import GlassShape from './art/GlassShape.jsx';
import {
  BurnerShape,
  StandShape,
  GauzeShape,
  RodShape,
  DropperShape,
  MatchShape,
  PaperShape
} from './art/ToolShapes.jsx';
import { MONO, INK_MUTED } from './palette.js';

/* 器型 → 矢量图形。没登记的器型画一只空杯子轮廓，不至于整件消失。 */
export function EquipmentShape(props) {
  var item = props.item;
  var type = item.type;

  if (type === 'beaker') return <BeakerShape item={item} onToggleStopper={props.onToggleStopper} />;
  if (GLASS[type]) return <GlassShape item={item} onToggleStopper={props.onToggleStopper} />;
  if (type === 'burner') return <BurnerShape item={item} />;
  if (type === 'stand') return <StandShape item={item} />;
  if (type === 'wire-gauze') return <GauzeShape item={item} />;
  if (type === 'rod') return <RodShape item={item} />;
  if (type === 'dropper') return <DropperShape item={item} />;
  if (type === 'match') return <MatchShape item={item} />;
  if (type === 'ph-paper') return <PaperShape item={item} />;

  return (
    <Rect
      x={2}
      y={2}
      width={sizeOf(type).width - 4}
      height={baseOf(type) - 4}
      stroke="rgba(15, 23, 42, 0.25)"
      dash={[3, 3]}
      listening={false}
    />
  );
}

/*
 * 选中器材的读数：名称 + 状态，贴在台面线下方一行。
 * 为什么不做「每件器材都挂标签」：真实比例下器材挨得很近（烧杯 78mm、
 * 酒精灯 80mm），标签会互相压住，也会盖住火焰和铁圈。改成选中才显示，
 * 读数固定在台面线以下，既不挡器材，也像仪器面板上的一行注记。
 */
export function EquipmentLabels(props) {
  var item = props.item;
  if (!props.show) return null;

  var size = sizeOf(item.type);
  var width = Math.max(150, size.width);
  var x = (size.width - width) / 2;
  var baseY = baseOf(item.type);
  var y = (props.deskY === undefined ? baseY + 5 : props.deskY + 4) - item.y;
  var sub = props.subText ? props.subText(item) : '';
  var gap = y - baseY;

  return (
    <Group listening={false}>
      {/* 器材离台面较高时拉一条细引线，读数不至于「浮在半空」 */}
      {gap > 10 ? (
        <Line
          points={[size.width / 2, baseY + 1, size.width / 2, y - 2]}
          stroke="rgba(148, 163, 184, 0.4)"
          strokeWidth={0.6}
          dash={[2, 2]}
        />
      ) : null}
      <Text
        x={x}
        y={y}
        width={width}
        text={item.name}
        align="center"
        fontSize={9.5}
        fontFamily={MONO}
        fill={INK_MUTED}
      />
      {sub ? (
        <Text
          x={x}
          y={y + 11}
          width={width}
          text={sub}
          align="center"
          fontSize={8.6}
          fontFamily={MONO}
          fill="rgba(120, 137, 152, 0.9)"
        />
      ) : null}
      {item.kind === 'container' && item.gas ? (
        <Text
          x={x}
          y={y - 12}
          width={width}
          text={'↑ ' + item.gas}
          align="center"
          fontSize={9}
          fontFamily={MONO}
          fill="rgba(96, 128, 118, 0.9)"
        />
      ) : null}
    </Group>
  );
}
