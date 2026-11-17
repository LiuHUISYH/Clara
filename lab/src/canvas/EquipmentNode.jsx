/**
 * EquipmentNode.jsx —— 实验台上的一件器材（Konva Group）
 * ------------------------------------------------------------------
 * 一件器材 = 一个 draggable 的 Group，锚点就是 art.js 里的左上角，
 * 所以 Group 的 (x, y) 与 store 的 item.x / item.y 完全同义，拖拽结束时
 * 直接把坐标写回 store 即可，不需要任何 DOM 尺寸换算。
 *
 * 三个交互约定：
 *   · 按下就选中，并把 Group 提到最顶层（moveToTop）—— 拿起来的器材压住别人
 *   · 拖动过程中被 clampPosition 关在实验台里，器底不会沉到台面线以下
 *   · 松手交给 onDrop：吸附（铁圈 / 焰尖 / 石棉网）与 store 结算由上层决定
 * 夹在铁架台上（clampedTo）或正在搅拌（stirring）的器材不可拖动，
 * 和 store.moveItem 的拒绝规则一致 —— 画面先拦住，用户就不会白拖一次。
 */
import React, { useEffect, useRef } from 'react';
import { Group, Rect } from 'react-konva';
import { sizeOf, baseOf, mouthYOf } from '../art.js';
import { clampPosition } from './geometry.js';
import { bindTilt } from './motion.js';
import EquipmentImage from './EquipmentImage.jsx';
import { EquipmentShape, EquipmentLabels } from './EquipmentArt.jsx';

export default function EquipmentNode(props) {
  var item = props.item;
  var size = sizeOf(item.type);
  var locked = !!item.clampedTo || !!item.stirring;
  var groupRef = useRef(null);
  var tiltRef = useRef(null);

  /*
   * 注册「可以倾倒的机身」：动画循环按 pourFlow 缓动这个内层 Group 的 rotation，
   * 枢轴就是瓶口中心 —— 转动时瓶口钉在原地，水柱起点才不会跟着甩。
   * 标签与选中框留在外层，不跟着斜。
   */
  useEffect(
    function () {
      var node = tiltRef.current;
      if (!node) return undefined;
      bindTilt(item.id, node, { x: size.width / 2, y: mouthYOf(item.type) });
      return function () {
        bindTilt(item.id, null);
      };
    },
    [item.id, item.type, size.width]
  );

  function raise() {
    var node = groupRef.current;
    if (node) node.moveToTop();
  }

  function clampNode(node) {
    var pos = clampPosition(item.type, node.x(), node.y(), props.bounds);
    if (pos.x !== node.x() || pos.y !== node.y()) node.position({ x: pos.x, y: pos.y });
    return pos;
  }

  return (
    <Group
      ref={groupRef}
      id={'item-' + item.id}
      name="lab-item"
      x={item.x}
      y={item.y}
      /*
       * draggable 永远是 true：Konva 只在 setDraggable() 时为节点挂上
       * mousedown.konva 监听，属性在 true/false 之间来回切一次，监听就再也
       * 装不回来（react-konva 改的是 attr，不走 setDraggable）。
       * 锁定态（夹在铁架台 / 正在搅拌）改为在 dragstart 里立刻 stopDrag，
       * 画面先拦住，store.moveItem 再拒绝一次，规则不变。
       */
      draggable={true}
      onMouseDown={function () {
        raise();
        if (props.onSelect) props.onSelect(item.id);
      }}
      onTouchStart={function () {
        raise();
        if (props.onSelect) props.onSelect(item.id);
      }}
      onDragStart={function (event) {
        if (locked) {
          event.target.stopDrag();
          event.target.position({ x: item.x, y: item.y });
          return;
        }
        raise();
        if (props.onSelect) props.onSelect(item.id);
      }}
      onDragMove={function (event) {
        if (locked) return;
        clampNode(event.target);
      }}
      onDragEnd={function (event) {
        if (locked) {
          event.target.position({ x: item.x, y: item.y });
          return;
        }
        var node = event.target;
        var pos = clampNode(node);
        node.position({ x: item.x, y: item.y });
        if (props.onDrop) props.onDrop(item, pos.x, pos.y);
      }}
    >
      {/* 选中框：套在器材外面，不改玻璃本身的颜色 */}
      {props.selected ? (
        <Rect
          x={-4}
          y={-4}
          width={size.width + 8}
          height={baseOf(item.type) + 8}
          cornerRadius={2}
          stroke="rgba(91, 124, 136, 0.9)"
          strokeWidth={1}
          dash={[4, 3]}
          fill="rgba(91, 124, 136, 0.04)"
          listening={false}
        />
      ) : null}

      {/* 器材本体：有 PNG 用 PNG，没有就画矢量；外层 Group 的 rotation 由倾倒动画驱动 */}
      <Group ref={tiltRef} name="tilt">
        <EquipmentImage item={item} sprite={item.sprite}>
          <EquipmentShape item={item} onToggleStopper={props.onToggleStopper} />
        </EquipmentImage>

        {/*
         * 命中区：
         *   · 常规器材靠画出来的玻璃 / 金属本身接事件（铁架台只有杆和圈能点中，
         *     不会用一个 200×560 的透明矩形把台面上的其它器材全盖住）；
         *   · 细长工具（玻璃棒 φ6、火柴、pH 试纸）真实宽度不到 18mm，补一条
         *     18mm 宽的透明热区，否则几乎点不到。
         */}
        {size.width < 18 ? (
          <Rect
            x={(size.width - 18) / 2}
            y={0}
            width={18}
            height={baseOf(item.type)}
            fill="rgba(255, 255, 255, 0.001)"
          />
        ) : null}
      </Group>

      <EquipmentLabels
        item={item}
        show={props.selected}
        deskY={props.deskY}
        subText={props.subText}
      />
    </Group>
  );
}
