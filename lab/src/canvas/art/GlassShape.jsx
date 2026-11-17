/**
 * GlassShape.jsx —— 其余玻璃容器（试管 / 锥形瓶 / 圆底烧瓶 / 容量瓶 / 试剂瓶）
 * ------------------------------------------------------------------
 * 全部按 art.js 的字段驱动，不写死任何一种器型：
 *   body            外形轮廓（同时是描边与液体裁剪的边界）
 *   top / bottom    内腔上下沿 → 液面高度
 *   rim / mouthArc  瓶口实线与内弧
 *   wall / edge     左右内壁：一条白高光、一条暗边
 *   graduations / ticks  刻度
 *   neckHighlight   细颈上的高光（锥形瓶 / 容量瓶）
 *   labelRect / labelBand / stopper  试剂瓶的标签与玻璃塞
 * 新增器型只要往 art.js 里补数据，这里不用改。
 */
import React from 'react';
import { Group, Path, Rect, Line, Text } from 'react-konva';
import { artOf } from '../../art.js';
import { interiorOf } from '../liquid.js';
import {
  GLASS_BODY,
  GLASS_AIR,
  GLASS_STROKE,
  GLASS_SHADOW,
  HOT_TINT,
  INK,
  INK_FAINT,
  MONO
} from '../palette.js';
import LiquidBody from './LiquidBody.jsx';


/* 试剂瓶标签：白底、顶部一道色带、四行等宽字（名称 / 化学式 / 分析纯 / 净含量）。 */
function BottleLabel(props) {
  var art = props.art;
  var label = props.label;
  var rect = art.labelRect;
  var band = art.labelBand;

  return (
    <Group listening={false}>
      <Rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="rgba(255, 255, 255, 0.94)"
        stroke="rgba(15, 23, 42, 0.16)"
        strokeWidth={0.3}
        cornerRadius={0.6}
      />
      <Rect
        x={band.x}
        y={band.y}
        width={band.width}
        height={band.height}
        fill={label && label.band ? label.band : 'rgba(148, 163, 184, 0.85)'}
      />
      {label ? (
        <Text
          x={rect.x + 1.4}
          y={rect.y + 5}
          width={rect.width - 2.8}
          text={label.title}
          align="center"
          fontSize={4.6}
          fontStyle="bold"
          fontFamily={MONO}
          fill={INK}
        />
      ) : null}
      {label ? (
        <Text
          x={rect.x + 1.4}
          y={rect.y + 11}
          width={rect.width - 2.8}
          text={label.formula}
          align="center"
          fontSize={4.2}
          fontFamily={MONO}
          fill={INK}
        />
      ) : null}
      <Text
        x={rect.x + 1.4}
        y={rect.y + rect.height - 14}
        width={rect.width - 2.8}
        text={label ? label.grade : ''}
        align="center"
        fontSize={3.2}
        fontFamily={MONO}
        fill={INK_FAINT}
      />
      <Text
        x={rect.x + 1.4}
        y={rect.y + rect.height - 8}
        width={rect.width - 2.8}
        text={label ? label.volume : ''}
        align="center"
        fontSize={3.2}
        fontFamily={MONO}
        fill={INK_FAINT}
      />
    </Group>
  );
}

export default function GlassShape(props) {
  var item = props.item;
  var type = item.type;
  var art = artOf(type);
  var box = interiorOf(type);
  var hot = (item.temperature || 0) >= 60;
  var stopper = art.stopper && item.stopper && !item.open ? art.stopper : null;

  return (
    <Group>
      {/* 玻璃本体：和烧杯同一套横向渐变，换器型只换轮廓 */}
      <Path
        data={art.body}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: art.size.width, y: 0 }}
        fillLinearGradientColorStops={GLASS_BODY}
        stroke={GLASS_STROKE}
        strokeWidth={0.8}
        lineJoin="round"
        shadowColor={GLASS_SHADOW}
        shadowBlur={6}
        shadowOffsetY={2}
        shadowOpacity={0.8}
      />
      <Path
        data={art.body}
        fillLinearGradientStartPoint={{ x: 0, y: art.top }}
        fillLinearGradientEndPoint={{ x: 0, y: art.bottom }}
        fillLinearGradientColorStops={GLASS_AIR}
        listening={false}
      />

      {/* 液体：波形上沿 + 内腔裁剪，圆角贴着器底（Step 3 起会流动） */}
      {box ? <LiquidBody box={box} item={item} /> : null}

      {/* 内壁与高光 */}
      {art.wall ? (
        <Path data={art.wall} stroke="rgba(255, 255, 255, 0.88)" strokeWidth={1} listening={false} />
      ) : null}
      {art.edge ? (
        <Path data={art.edge} stroke="rgba(15, 23, 42, 0.15)" strokeWidth={0.65} listening={false} />
      ) : null}
      {art.highlight ? (
        <Path
          data={art.highlight}
          stroke="rgba(255, 255, 255, 0.8)"
          strokeWidth={1.4}
          listening={false}
        />
      ) : null}
      {art.highlightSoft ? (
        <Path
          data={art.highlightSoft}
          stroke="rgba(255, 255, 255, 0.42)"
          strokeWidth={1.1}
          listening={false}
        />
      ) : null}
      {art.neckHighlight ? (
        <Path
          data={art.neckHighlight}
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth={1.1}
          listening={false}
        />
      ) : null}

      {/* 瓶口 */}
      {art.rim ? (
        <Path data={art.rim} stroke="rgba(15, 23, 42, 0.24)" strokeWidth={0.9} listening={false} />
      ) : null}
      {art.mouthArc ? (
        <Path data={art.mouthArc} stroke="rgba(15, 23, 42, 0.12)" strokeWidth={0.6} listening={false} />
      ) : null}
      {art.neckRing ? (
        <Path data={art.neckRing} stroke="rgba(15, 23, 42, 0.18)" strokeWidth={0.5} listening={false} />
      ) : null}

      {/* 刻度 */}
      {art.graduations
        ? art.graduations.map(function (line) {
            return (
              <Group key={'g-' + line.text} listening={false}>
                <Line
                  points={[line.x1, line.y, line.x2, line.y]}
                  stroke="rgba(15, 23, 42, 0.32)"
                  strokeWidth={0.32}
                />
                <Text
                  x={line.tx}
                  y={line.y - 2}
                  text={line.text}
                  fontSize={3.4}
                  fontFamily={MONO}
                  fill={INK_FAINT}
                />
              </Group>
            );
          })
        : null}
      {art.ticks
        ? art.ticks.map(function (tick) {
            return (
              <Line
                key={'t-' + tick[0]}
                points={[tick[1], tick[0], tick[2], tick[0]]}
                stroke="rgba(15, 23, 42, 0.2)"
                strokeWidth={0.28}
                listening={false}
              />
            );
          })
        : null}

      {/* 试剂瓶标签 */}
      {art.labelRect ? <BottleLabel art={art} label={item.label} /> : null}

      {/* 玻璃塞：点一下开 / 关（store 的 toggleStopper） */}
      {stopper ? (
        <Group
          onClick={function (event) {
            event.cancelBubble = true;
            if (props.onToggleStopper) props.onToggleStopper();
          }}
          onTap={function (event) {
            event.cancelBubble = true;
            if (props.onToggleStopper) props.onToggleStopper();
          }}
        >
          <Path
            data={stopper.plug}
            fill="rgba(226, 238, 241, 0.9)"
            stroke="rgba(15, 23, 42, 0.18)"
            strokeWidth={0.4}
          />
          <Path
            data={stopper.knob}
            fill="rgba(240, 247, 249, 0.94)"
            stroke="rgba(15, 23, 42, 0.16)"
            strokeWidth={0.4}
          />
          <Path data={stopper.spec} stroke="rgba(255, 255, 255, 0.9)" strokeWidth={0.6} />
          <Rect
            x={stopper.hit.x}
            y={stopper.hit.y}
            width={stopper.hit.width}
            height={stopper.hit.height}
            fill="rgba(255, 255, 255, 0.001)"
          />
        </Group>
      ) : null}

      {/* 受热：玻璃整体透暖棕 */}
      {hot ? <Path data={art.body} fill={HOT_TINT} listening={false} /> : null}
    </Group>
  );
}


