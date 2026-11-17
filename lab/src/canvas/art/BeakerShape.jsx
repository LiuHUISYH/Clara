/**
 * BeakerShape.jsx —— Step 2 的主角：有厚度的 250mL 烧杯
 * ------------------------------------------------------------------
 * 坐标系就是 art.js 的毫米（78×100），一个单位一个像素，所以下面的
 * 所有数字都能对着尺子读：杯口 y=8、杯底 y=98、内腔 7.2~67.2。
 *
 * 立体感靠五层叠出来（不是一张描边图）：
 *   ① 玻璃本体  横向渐变：左缘高光 → 中间透 → 右缘厚度偏暗；描边 0.8mm + 冷色投影
 *   ② 内腔空气  上白下灰的纵向渐变，容器里「有空间」
 *   ③ 液体      波形上沿 + clipFunc 裁进内腔（底部圆角贴着杯底弧度），再叠一层纵深灰阶
 *                —— Step 3 起交给 LiquidBody.jsx，液面会缓慢起伏
 *   ④ 内壁厚度  wall / edge 两条内缘线：左边是白高光，右边是暗边
 *   ⑤ 杯口与导流槽  rim 实线 + 内弧 + 导流槽尖嘴上的一道白高光
 * 刻度、反光柱、漫反射斑按 art.js 里的毫米坐标摆放，和 SVG 版同一张表。
 */
import React from 'react';
import { Group, Path, Rect, Ellipse, Line, Text } from 'react-konva';
import { GLASS } from '../../art.js';
import { interiorOf } from '../liquid.js';
import { GLASS_BODY, GLASS_AIR, GLASS_SHADOW, HOT_TINT, MONO } from '../palette.js';
import LiquidBody from './LiquidBody.jsx';

var ART = GLASS.beaker;

/* 杯壁刻度：50 / 100 / 150 / 200 mL 四条 + 三条中间短刻。 */
function Graduations() {
  var marks = [];

  ART.graduations.forEach(function (line) {
    marks.push(
      <Line
        key={'grad-' + line.text}
        points={[line.x1, line.y, line.x2, line.y]}
        stroke="rgba(15, 23, 42, 0.44)"
        strokeWidth={0.4}
        listening={false}
      />
    );
    marks.push(
      <Text
        key={'grad-text-' + line.text}
        x={line.tx}
        y={line.y - 2.2}
        text={line.text}
        fontSize={4.2}
        fontFamily={MONO}
        fill="rgba(15, 23, 42, 0.5)"
        listening={false}
      />
    );
  });

  ART.ticks.forEach(function (tick) {
    marks.push(
      <Line
        key={'tick-' + tick[0]}
        points={[tick[1], tick[0], tick[2], tick[0]]}
        stroke="rgba(15, 23, 42, 0.22)"
        strokeWidth={0.3}
        listening={false}
      />
    );
  });

  return <Group listening={false}>{marks}</Group>;
}

export default function BeakerShape(props) {
  var item = props.item;
  var box = interiorOf('beaker');
  var hot = (item.temperature || 0) >= 60;

  return (
    <Group>
      {/* ① 玻璃本体：横向渐变 + 冷色投影，杯壁有厚度 */}
      <Path
        data={ART.body}
        fillLinearGradientStartPoint={{ x: 4, y: 0 }}
        fillLinearGradientEndPoint={{ x: 74, y: 0 }}
        fillLinearGradientColorStops={GLASS_BODY}
        stroke="rgba(15, 23, 42, 0.3)"
        strokeWidth={1}
        lineJoin="round"
        shadowColor={GLASS_SHADOW}
        shadowBlur={9}
        shadowOffsetY={3}
        shadowOpacity={0.9}
      />

      {/* ② 内腔空气：上白下灰，杯子是空的也有纵深 */}
      <Path
        data={ART.body}
        fillLinearGradientStartPoint={{ x: 39, y: 8 }}
        fillLinearGradientEndPoint={{ x: 39, y: 98 }}
        fillLinearGradientColorStops={GLASS_AIR}
        listening={false}
      />

      {/* 导流槽：右上角那块厚玻璃，倒液时液体从这里出去 */}
      <Path
        data={ART.spout}
        fill="rgba(255, 255, 255, 0.7)"
        stroke="rgba(15, 23, 42, 0.26)"
        strokeWidth={0.7}
        lineJoin="round"
        listening={false}
      />

      {/* ③ 液体：波形上沿 + 裁进内腔，底部贴着杯底圆角（Step 3 起会流动） */}
      <LiquidBody box={box} item={item} />

      {/* ④ 内壁厚度：左白右暗，玻璃的「边」看得出来 */}
      <Path data={ART.wall} stroke="rgba(255, 255, 255, 0.9)" strokeWidth={1.1} listening={false} />
      <Path data={ART.edge} stroke="rgba(15, 23, 42, 0.15)" strokeWidth={0.7} listening={false} />
      <Path data={ART.bottomArc} stroke="rgba(15, 23, 42, 0.1)" strokeWidth={0.6} listening={false} />

      {/* ⑤ 杯口、导流槽与内弧 */}
      <Path data={ART.rim} stroke="rgba(15, 23, 42, 0.34)" strokeWidth={1.1} listening={false} />
      <Line points={[4, 9.4, 70.4, 9.4]} stroke="rgba(255, 255, 255, 0.9)" strokeWidth={0.7} listening={false} />
      <Path data={ART.spoutArc} stroke="rgba(255, 255, 255, 0.92)" strokeWidth={0.9} listening={false} />
      <Path data={ART.mouthArc} stroke="rgba(15, 23, 42, 0.16)" strokeWidth={0.7} listening={false} />

      <Graduations />

      {/* 反光柱与漫反射斑：白底玻璃的「亮」 */}
      <Rect
        x={8.6}
        y={16}
        width={1.5}
        height={72}
        cornerRadius={0.75}
        fillLinearGradientStartPoint={{ x: 0, y: 16 }}
        fillLinearGradientEndPoint={{ x: 0, y: 88 }}
        fillLinearGradientColorStops={[
          0,
          'rgba(255, 255, 255, 0.86)',
          0.55,
          'rgba(255, 255, 255, 0.34)',
          1,
          'rgba(255, 255, 255, 0.06)'
        ]}
        listening={false}
      />
      <Rect
        x={69.2}
        y={18}
        width={1.1}
        height={56}
        cornerRadius={0.55}
        fill="rgba(255, 255, 255, 0.46)"
        listening={false}
      />
      <Ellipse
        x={ART.gloss.cx}
        y={ART.gloss.cy}
        radiusX={ART.gloss.rx}
        radiusY={ART.gloss.ry}
        fillRadialGradientStartPoint={{ x: 0, y: 0 }}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndPoint={{ x: 0, y: 0 }}
        fillRadialGradientEndRadius={ART.gloss.rx * 2}
        fillRadialGradientColorStops={[
          0,
          'rgba(255, 255, 255, 0.52)',
          0.6,
          'rgba(255, 255, 255, 0.12)',
          1,
          'rgba(255, 255, 255, 0)'
        ]}
        listening={false}
      />

      {/* 受热：玻璃整体透一层暖棕（≥ 60°C） */}
      {hot ? <Path data={ART.body} fill={HOT_TINT} listening={false} /> : null}
    </Group>
  );
}

