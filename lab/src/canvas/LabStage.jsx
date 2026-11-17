/**
 * LabStage.jsx —— Konva Stage：三层画布
 * ------------------------------------------------------------------
 * Layer 1  background  实验台背景（网格 / 台面线 / 标尺），不接收指针
 * Layer 2  equipment   所有器材，一件一个 draggable Group
 * Layer 3  effects     特效层：气泡 / 涡流 / 沉淀 / 蒸汽 + 倒液水柱（Step 3 / 4）
 *
 * Stage 的宽高由 KonvaBench 用 ResizeObserver 量出来传进来，单位是 CSS 像素，
 * Konva 自己按 devicePixelRatio 放大画布，所以 1mm 在视网膜屏上依然是 1 逻辑像素。
 * 点在空白处（Stage 本身）才取消选中：器材和面板的点击都会冒泡到 Stage，
 * 用 event.target === stage 把它们区分开。
 */
import React from 'react';
import { Stage, Layer } from 'react-konva';
import DeskLayer from './DeskLayer.jsx';
import EquipmentNode from './EquipmentNode.jsx';
import VesselFx from './effects/VesselFx.jsx';
import PourStream from './effects/PourStream.jsx';
import { benchBounds } from './geometry.js';

export default function LabStage(props) {
  var width = props.width;
  var height = props.height;
  var bounds = benchBounds(width, height);

  /*
   * 层级：夹在铁架台上的容器画在铁架台之后 —— 物理上它被举在铁圈上，
   * 不该被铸铁圈压住。其余器材保持 store 顺序（拖动时 moveItem 会把它排到最后）。
   */
  var ordered = props.items.filter(function (item) {
    return !item.clamp;
  });
  props.items.forEach(function (item) {
    if (item.clamp) ordered.push(item);
  });

  function handleBlank(event) {
    if (event.target === event.target.getStage()) {
      if (props.onDeselect) props.onDeselect();
    }
  }

  return (
    <Stage
      ref={props.stageRef}
      width={width}
      height={height}
      onMouseDown={handleBlank}
      onTouchStart={handleBlank}
      style={{ display: 'block' }}
    >

      <DeskLayer width={width} height={height} deskY={bounds.deskY} empty={props.items.length === 0} />

      <Layer name="equipment">
        {ordered.map(function (item) {
          return (
            <EquipmentNode
              key={item.id}
              item={item}
              selected={item.id === props.selectedId}
              bounds={bounds}
              deskY={bounds.deskY}
              subText={props.subText}
              onSelect={props.onSelect}
              onDrop={props.onDrop}
              onToggleStopper={props.onToggleStopper}
            />
          );
        })}
      </Layer>

      {/*
       * 特效层：不接指针，只画「此刻正在发生的事」。
       *   气泡 / 涡流 / 沉淀 / 蒸汽   按器材坐标挂过去，裁进各自的内腔
       *   倒液水柱                    源瓶口 → 目标瓶口的一条贝塞尔液柱
       * 这一层和器材层一起由 Konva.Animation 每帧重绘，所以都是动的。
       */}
      <Layer name="effects" listening={false}>
        {props.items.map(function (item) {
          return <VesselFx key={'fx-' + item.id} item={item} />;
        })}
        <PourStream flow={props.pourFlow} items={props.items} />
      </Layer>
    </Stage>
  );
}
