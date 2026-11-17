import React, { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDndMonitor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { LAB_LIBRARY, LAB_ITEM_COUNT, LAB_REAGENTS } from './library';
import { LibraryIcon } from './icons';
import {
  useLabStore,
  LAB_GEOMETRY,
  basePoint,
  clampPoint,
  dimensionsOf,
  pourAlign,
  mouthPoint,
  settleY
} from './store';
import { LabGraphic } from './Vessel';
import KonvaBench from './canvas/KonvaBench';
import { LAB_ENGINE } from './engine';
import { containerAt } from './canvas/geometry';

/* 实体尺寸随器型走（烧杯 78×100、试管 20×152、铁架台 200×560），页面不再有统一令牌。 */
var TARGET_PREFIX = 'target:';

/*
 * 倾倒手势的几何判定全部来自 store 的实体坐标（ECS）：
 * 用拖拽中的令牌外框 + 画布矩形换算出「源容器现在在哪」，再和落点容器做
 * pourAlign（瓶口 X 中心对齐 + 上下叠住）。不读 DOM 尺寸，页面缩放也不会跑偏。
 */

/*
 * 指针在器材内的落点偏移（拖拽开始时记下，单位 px）。
 * 松手瞬间的器材位置以「指针 + 这个偏移」换算：active.rect 的 translated 晚一帧，
 * 快速拖动时能差出一整步（几十像素），倒液对准就会误判成「瓶口没对上」。
 */
var grabOffset = { x: 40, y: 56 };

/* 画布 droppable 的真实 DOM 节点（args.droppableContainers 是数组，不是 Map）。 */
function benchNode(args) {
  var list = args.droppableContainers || [];

  for (var i = 0; i < list.length; i += 1) {
    if (list[i].id !== 'bench') continue;
    var node = list[i].node && list[i].node.current;
    if (node) return node;
  }

  return null;
}

/* 拖拽中的令牌左上角 → 画布坐标（画布本身也是一个 droppable，能拿到它的节点）。 */
function dragOrigin(args) {
  var rects = args.active.rect.current;
  var translated = rects && rects.translated;

  /*
   * 画布矩形优先取 droppable 的真实 DOM 节点：droppableRects 里的是测量缓存，
   * 窗口滚动 / 布局微调后可能和 DOM 差几十像素，倒液对准就会算歪。
   */
  var node = benchNode(args);
  var bench = node ? node.getBoundingClientRect() : args.droppableRects.get('bench');
  if (!bench) return null;

  if (args.pointerCoordinates) {
    return {
      x: args.pointerCoordinates.x - grabOffset.x - bench.left,
      y: args.pointerCoordinates.y - grabOffset.y - bench.top
    };
  }

  if (!translated) return null;

  return { x: translated.left - bench.left, y: translated.top - bench.top };
}

/* 把拖拽中的容器换算成一个临时的实体（坐标用当前拖拽位置，其余字段照抄）。 */
function dragEntity(args) {
  var data = args.active.data.current;
  var origin = dragOrigin(args);
  if (!data || !data.item || !origin) return null;

  return Object.assign({}, data.item, origin);
}

/*
 * 指针落在容器上时优先命中容器，否则落回整张实验台。
 * 实验台上的容器互拖时用 pourAlign 判定：瓶口 X 中心差 ≤ 26px 且两容器上下叠住
 * 才算「倒进去」，只是擦边重叠就当自由摆放 —— 想把两个容器摆近一点不会被误判。
 * 从器材库拖出来的试剂 / 器材不受影响，落点只要在容器内就生效。
 * 酒精灯也是落点，但只认火柴；铁架台与石棉网各有自己的吸附落点。
 */
function labCollisionDetection(args) {
  var hits = pointerWithin(args);
  if (hits.length === 0) return [];

  var data = args.active.data.current;
  var isMatch = !!data && !!data.item && data.item.type === 'match';
  var dragged = data && data.kind === 'bench-item' ? dragEntity(args) : null;
  var rest = [];

  for (var i = 0; i < hits.length; i += 1) {
    if (String(hits[i].id).indexOf(TARGET_PREFIX) !== 0) {
      rest.push(hits[i]);
      continue;
    }

    /*
     * 被拖的器材自己也是一个落点（幽灵跟着指针走，常常正好压在目标上），
     * 必须先排除，否则松手时可能把自己当成落点 —— 倒液、落棒都会白做。
     */
    if (dragged && String(hits[i].id).slice(TARGET_PREFIX.length) === dragged.id) continue;

    var targetItem = benchItemById(String(hits[i].id).slice(TARGET_PREFIX.length));
    if (!targetItem) continue;

    /*
     * 石棉网与容器互为落点：容器拖到网上就吸上去，石棉网拖到容器上就垫到下面。
     * 这两种情况都不走“倒液”判定，所以先于容器的对准校验返回。
     */
    if (data && data.item) {
      if (data.item.type === 'wire-gauze' && targetItem.kind === 'container') return [hits[i]];
      if (data.item.kind === 'container' && targetItem.type === 'wire-gauze') return [hits[i]];
    }

    /* 铁架台也是落点：容器松手在台上就夹进铁圈（见 clampOnStand）。 */
    if (data && data.item && data.item.kind === 'container' && targetItem.type === 'stand') {
      return [hits[i]];
    }

    /* 玻璃棒放到容器上：直接开始搅拌（见 stir），不走倒液对准判定。 */
    if (data && data.item && data.item.type === 'rod' && targetItem.kind === 'container') {
      return [hits[i]];
    }

    if (isMatch && targetItem.type === 'burner') return [hits[i]];
    if (targetItem.kind !== 'container') continue;

    /* 容器 → 容器：瓶口对准才认作倒液；没对准就继续找其它落点（按自由摆放处理）。 */
    if (dragged && targetItem.id !== dragged.id) {
      if (pourAlign(dragged, targetItem).canPour) return [hits[i]];
      continue;
    }

    return [hits[i]];
  }

  return rest;
}

/* 器材副标题：容器的温度 / 沸腾 / 体积，工具的燃烧与受热状态。 */
function itemSubText(item) {
  if (item.kind !== 'container') {
    if (item.type === 'match') {
      return item.lit ? '燃烧中 · ' + item.matchLeft + 's' : '未点燃';
    }
    if (item.type === 'wire-gauze') {
      return item.hot ? '匀热中' : '未受热';
    }
    if (item.type === 'rod' && item.stirring) return '搅拌中';
    return item.type === 'burner' ? (item.lit ? '燃烧中' : '未点燃') : '工具';
  }

  var body;
  if (item.volume > 0) {
    body = item.volume + ' / ' + item.capacity + ' mL';
  } else if (item.contents.length > 0) {
    var solid = item.contents.reduce(function (mass, entry) {
      return mass + (entry.mass || 0);
    }, 0);
    body = '固体 ' + solid + ' g';
  } else {
    body = '空 · ' + item.capacity + ' mL';
  }

  return (
    (item.clamp ? '铁夹上 · ' : '') +
    (item.temperature !== 25 ? item.temperature + '°C · ' : '') +
    (item.boiling ? '沸腾 · ' : '') +
    (item.stirring ? '搅拌中 · ' : '') +
    body
  );
}

/*
 * 工具的状态文案。酒精灯必须用燃着的火柴点燃，所以未点燃时按台面上有没有
 * 火源给出不同的下一步；火柴自己则报出剩余燃烧秒数。
 */
function toolStatus(item, matchBurning) {
  if (item.type === 'match') {
    return item.lit
      ? '状态: 燃烧中 · 剩 ' + item.matchLeft + ' 秒，趁现在点燃酒精灯'
      : '状态: 未点燃 · 划燃后把火柴凑到灯芯上';
  }

  if (item.type === 'burner') {
    if (item.lit) return '状态: 燃烧中 · 把容器架到火焰上即可加热';
    return matchBurning ? '状态: 未点燃 · 用燃着的火柴点燃' : '状态: 未点燃 · 先用火柴划燃';
  }

  if (item.type === 'wire-gauze') {
    return item.hot
      ? '状态: 架在火焰上 · 把容器放上来就能均匀受热'
      : '状态: 未受热 · 架到火焰与容器之间';
  }

  return '工具';
}

/*
 * 落点换算：把拖拽中器材的实时矩形对回画布坐标。
 * 直接取左上角（而不是中心）能让器材落在幽灵停下的位置，配合实测宽高做
 * 边界钳制，避免器材被拖出画布；落台面 / 石棉网 / 火焰的纵向吸附由 settleY 完成。
 */
function dragPoint(canvas, event, type) {
  var size = dimensionsOf(type);
  if (!canvas) return { x: 24, y: Math.max(4, 320 - size.height) };

  var rect = canvas.getBoundingClientRect();
  var translated = event.active.rect.current && event.active.rect.current.translated;
  if (!translated) return { x: 24, y: Math.max(4, 320 - size.height) };

  var width = translated.width || size.width;
  var height = translated.height || size.height;
  var maxX = Math.max(4, rect.width - width - 4);
  var maxY = Math.max(4, rect.height - height - 4);

  return {
    x: Math.round(Math.max(4, Math.min(maxX, translated.left - rect.left))),
    y: Math.round(Math.max(0, Math.min(maxY, translated.top - rect.top)))
  };
}

/*
 * 松手落位：先按画布边界钳制，再交给 settleY 决定纵向落点
 * （铁圈 / 石棉网 / 火焰 / 台面线），保证器材不会停在半空。
 */
function landedPoint(canvas, event, type) {
  var raw = dragPoint(canvas, event, type);
  var height = canvas ? canvas.getBoundingClientRect().height : 520;
  var items = useLabStore.getState().items;

  return {
    x: raw.x,
    y: settleY(type, raw.x, raw.y, height, items)
  };
}

/* 把拖拽开始时指针在令牌里的位置记下来（松手位置的换算要用同一个偏移）。 */
function recordGrabOffset(event) {
  var activator = event.activatorEvent;
  var rects = event.active.rect.current;
  var initial = rects && rects.initial;

  if (
    activator &&
    initial &&
    typeof activator.clientX === 'number' &&
    typeof activator.clientY === 'number'
  ) {
    grabOffset = { x: activator.clientX - initial.left, y: activator.clientY - initial.top };
    return;
  }

  grabOffset = {
    x: initial && initial.width ? initial.width / 2 : 40,
    y: initial && initial.height ? initial.height / 2 : 56
  };
}

function targetId(over) {
  if (!over) return null;
  var id = String(over.id);
  return id.indexOf(TARGET_PREFIX) === 0 ? id.slice(TARGET_PREFIX.length) : null;
}

/* 按 id 取台面上的器材：碰撞检测与拖拽结算都要知道落点是容器还是酒精灯。 */
function benchItemById(id) {
  var items = useLabStore.getState().items;
  for (var i = 0; i < items.length; i += 1) {
    if (items[i].id === id) return items[i];
  }
  return null;
}

/*
 * 落点离哪个铁架台的铁圈最近：容器玻璃底中心到圈心小于 CLAMP_RADIUS 就算吸住。
 * 用距离而不是「指针正压在铁架台上」，拖到铁架台旁边也能吸上去，和真实
 * 摆器材的手感一致。
 */
function nearestStand(item, point) {
  var items = useLabStore.getState().items;
  var box = item.dimensions || dimensionsOf(item.type);
  var base = basePoint(Object.assign({}, item, { x: point.x, y: point.y }));
  var centre = { x: point.x + box.width / 2, y: point.y + box.height / 2 };
  var best = null;
  var bestDistance = LAB_GEOMETRY.clampRadius;

  items.forEach(function (entry) {
    if (entry.type !== 'stand') return;
    var ring = clampPoint(entry);
    /* 器底中心与实体中心都算：提着试管中部往圈里放，和拎着底往上凑都能吸住 */
    var toBase = Math.sqrt(Math.pow(ring.x - base.x, 2) + Math.pow(ring.y - base.y, 2));
    var toCentre = Math.sqrt(Math.pow(ring.x - centre.x, 2) + Math.pow(ring.y - centre.y, 2));
    var distance = Math.min(toBase, toCentre);
    if (distance <= bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  });

  return best ? best.id : null;
}

/* ============================ 左侧：器材库 ============================ */

/*
 * 器材库里的一格：极简线稿图标 + 名称 + 规格。整格可拖、可点。
 * 图标颜色来自 speciesColor（液体会显示自己的颜色），一眼能认出是哪一种试剂。
 */
function LibraryItem(props) {
  var item = props.item;
  var drag = useDraggable({
    id: 'library:' + item.id,
    data: { kind: 'library', item: item }
  });

  var tail = item.formula
    ? item.capacity
      ? item.formula + ' · ' + item.capacity + 'mL'
      : item.formula
    : item.capacity
      ? item.capacity + 'mL'
      : item.state === 'solid'
        ? '固体'
        : item.kind === 'tool'
          ? '工具'
          : '';

  return (
    <li
      ref={drag.setNodeRef}
      className={'lab-item lab-item--drag' + (drag.isDragging ? ' lab-item--dragging' : '')}
      {...drag.attributes}
      {...drag.listeners}
      aria-label={'拖拽或点击' + item.name}
      title="拖到实验台，或点击放入"
      onClick={function () {
        props.onPick(item);
      }}
    >
      <span className="lab-item__icon" aria-hidden="true">
        <LibraryIcon item={item} />
      </span>
      <span className="lab-item__name">{item.name}</span>
      {tail ? <span className="lab-item__formula">{tail}</span> : null}
    </li>
  );
}

function Library(props) {
  const [openId, setOpenId] = useState(LAB_LIBRARY[0].id);

  return (
    <aside className="lab-library" aria-label="器材与试剂库">
      <div className="lab-library__bar">
        <span>器材 / 试剂</span>
        <span>{LAB_ITEM_COUNT}</span>
      </div>

      <div className="lab-library__body">
        {LAB_LIBRARY.map(function (group) {
          const isOpen = openId === group.id;

          return (
            <section className="lab-group" key={group.id}>
              <button
                className="lab-group__head"
                type="button"
                aria-expanded={isOpen}
                aria-controls={'lab-group-' + group.id}
                onClick={function () {
                  setOpenId(isOpen ? null : group.id);
                }}
              >
                <span className="lab-group__label">{group.label}</span>
                <span className="lab-group__tail">
                  <span>{group.items.length}</span>
                  <span className="lab-group__sign" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </span>
              </button>

              {isOpen ? (
                <ul className="lab-group__items" id={'lab-group-' + group.id}>
                  {group.items.map(function (item) {
                    return <LibraryItem item={item} key={item.id} onPick={props.onPick} />;
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

/* ============================ 中间：实验台 ============================ */

function BenchItem(props) {
  var item = props.item;
  var flow = props.pour;
  var toggleStopper = useLabStore(function (state) {
    return state.toggleStopper;
  });
  var drag = useDraggable({
    id: 'bench:' + item.id,
    data: { kind: 'bench-item', id: item.id, item: item },
    /* 夹在铁架台上的容器是锁定实体：先「取下」才能再拖。 */
    disabled: !!item.clamp
  });
  var drop = useDroppable({
    id: TARGET_PREFIX + item.id,
    data: { kind: item.kind, id: item.id },
    disabled:
      item.kind !== 'container' &&
      item.type !== 'burner' &&
      item.type !== 'wire-gauze' &&
      item.type !== 'stand'
  });

  function setNode(node) {
    drag.setNodeRef(node);
    drop.setNodeRef(node);
  }

  /*
   * 倒液进行中：源容器的液面按进度下降、目标容器按进度上涨。这里只改传给
   * 图形的显示体积（不写回 store），所以一次倾倒只结算一次，动画也能逐帧走。
   */
  var pouring = !!flow && flow.sourceId === item.id;
  var receiving = !!flow && flow.targetId === item.id;
  var shown = item;
  if (pouring || receiving) {
    var delta = (receiving ? 1 : -1) * flow.amount * flow.progress;
    shown = Object.assign({}, item, {
      volume: Math.max(0, Math.round((item.volume + delta) * 10) / 10)
    });
    /* 空容器接液时先露出源液体的颜色，颜色混合等结算后再接上。 */
    if (receiving && item.volume === 0) shown.color = flow.color;
  }

  var className = 'lab-vessel';
  if (props.selected) className += ' lab-vessel--selected';
  if (drag.isDragging) className += ' lab-vessel--dragging';
  if (drop.isOver) className += ' lab-vessel--over';
  if (item.kind === 'container') className += ' lab-vessel--container';
  else className += ' lab-vessel--tool';
  if (item.kind === 'container' && item.temperature >= 60) className += ' lab-vessel--hot';
  if (item.lit) className += ' lab-vessel--lit';
  if (item.type === 'wire-gauze') className += ' lab-vessel--gauze';
  if (item.type === 'wire-gauze' && item.hot) className += ' lab-vessel--gauze-hot';
  if (item.heating) className += ' lab-vessel--heating';
  if (item.boiling) className += ' lab-vessel--boiling';
  if (item.shaking) className += ' lab-vessel--shaking';
  /* 搅拌中的容器：液面涡流；插进液里的玻璃棒：小幅摇摆、隐藏文字。 */
  if (item.stirring) {
    className += item.type === 'rod' ? ' lab-vessel--stirring-rod' : ' lab-vessel--stirring';
  }
  if (item.clamp) className += ' lab-vessel--clamped';
  if (props.pourReady) className += ' lab-vessel--pour-ready';
  if (pouring && props.pourTarget) {
    className +=
      ' lab-vessel--pouring' + (props.pourTarget.x < item.x ? ' lab-vessel--pour-left' : '');
  }

  /*
   * 实体的盒子就是它的真实尺寸：玻璃底、瓶口都与 store 的几何一一对应。
   * 下面两行文字绝对定位在盒子下方，不参与命中与碰撞（工具再高也不会把标签顶飞）。
   * --lab-mouth-y / --lab-mouth-w 给「松手就倒进去」的瓶口提示圈用。
   */
  var box = item.dimensions || dimensionsOf(item.type);
  var mouth = mouthPoint(item);

  return (
    <div
      ref={setNode}
      className={className}
      style={{
        left: item.x,
        top: item.y,
        width: box.width,
        height: box.height,
        '--lab-mouth-y': Math.round(mouth.y - item.y) + 'px',
        '--lab-mouth-w': Math.round(box.width * 0.58) + 'px'
      }}
      data-item-id={item.id}
      {...drag.attributes}
      {...drag.listeners}
      aria-label={
        item.clamp ? item.name + '（已夹在铁架台上）' : '选择' + item.name
      }
      title={item.clamp ? '已夹在铁架台上：先在操作条上「取下」' : undefined}
      onClick={function (event) {
        event.stopPropagation();
        props.onSelect(item.id);
      }}
    >
      <LabGraphic
        item={shown}
        onToggleStopper={
          item.stopper
            ? function () {
                toggleStopper(item.id);
              }
            : null
        }
      />
      {item.kind === 'container' && item.gas ? (
        <span className="lab-vessel__gas" aria-hidden="true">{'↑ ' + item.gas}</span>
      ) : null}
      <span className="lab-vessel__name">{item.name}</span>
      <span className="lab-vessel__sub">{itemSubText(item)}</span>
    </div>
  );
}

/*
 * 倒液水柱：在两个容器的瓶口之间画一条流动的液柱，颜色与粗细都取源液体。
 * 纯视觉层 —— 进度、体积都由 store 的 pourFlow 驱动，动画结束后才结算。
 * 起点 / 落点来自 store 的 mouthPoint（瓶口中心），源容器倾斜 38° 后瓶口甩向
 * 目标一侧，所以起点再往倾倒方向偏移半指宽，水柱从唇边落到目标瓶口里。
 *
 * 水柱分三层画：先是上宽下窄的实体（lab-pour__body，自由下落的液流会被拉细），
 * 再压一条亮芯（lab-pour__stream，颜色最深），最后是白色高光与落点溅起的水花。
 */
function round(value) {
  return Math.round(value * 10) / 10;
}

/* 二次贝塞尔取点：水柱实体按采样点建，宽度沿落差线性收细。 */
function quadPoint(from, control, to, t) {
  var mt = 1 - t;
  return {
    x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
    y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y
  };
}

/* 沿水柱中心线左右各偏半个线宽（法线方向），左侧正走、右侧倒走围成实体。 */
function streamBody(from, control, to, mouthWidth, dropWidth) {
  var steps = 10;
  var left = [];
  var right = [];

  for (var i = 0; i <= steps; i += 1) {
    var t = i / steps;
    var point = quadPoint(from, control, to, t);
    var ahead = quadPoint(from, control, to, Math.min(1, t + 0.02));
    var behind = quadPoint(from, control, to, Math.max(0, t - 0.02));
    var dx = ahead.x - behind.x;
    var dy = ahead.y - behind.y;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    var half = (mouthWidth + (dropWidth - mouthWidth) * t) / 2;
    var nx = (-dy / length) * half;
    var ny = (dx / length) * half;

    left.push(round(point.x + nx) + ' ' + round(point.y + ny));
    right.push(round(point.x - nx) + ' ' + round(point.y - ny));
  }

  return 'M' + left.join(' L') + ' L' + right.reverse().join(' L') + ' Z';
}

function PourStream(props) {
  var flow = props.flow;
  if (!flow) return null;

  var source = null;
  var target = null;
  props.items.forEach(function (entry) {
    if (entry.id === flow.sourceId) source = entry;
    if (entry.id === flow.targetId) target = entry;
  });
  if (!source || !target) return null;

  var from = mouthPoint(source);
  var to = mouthPoint(target);
  var toLeft = to.x < from.x;
  var mouthX = from.x + (toLeft ? -12 : 12);
  var mouthY = from.y + 3;
  var dropX = to.x;
  var dropY = to.y + 6;
  var bendX = mouthX + (toLeft ? -12 : 12);
  var bendY = (mouthY + dropY) / 2;
  var thickness = 2.2 + Math.min(1.6, flow.amount / 12);
  var d =
    'M' + Math.round(mouthX) + ' ' + Math.round(mouthY) +
    ' Q' + Math.round(bendX) + ' ' + Math.round(bendY) + ' ' + Math.round(dropX) + ' ' + Math.round(dropY);
  var body = streamBody(
    { x: mouthX, y: mouthY },
    { x: bendX, y: bendY },
    { x: dropX, y: dropY },
    thickness * 1.9,
    thickness * 1.15
  );

  return (
    <svg className="lab-pour" aria-hidden="true" focusable="false">
      <path className="lab-pour__body" d={body} style={{ fill: flow.color }} />
      <path className="lab-pour__stream" d={d} style={{ stroke: flow.color, strokeWidth: thickness }} />
      <path className="lab-pour__glint" d={d} style={{ strokeWidth: Math.max(0.5, thickness - 1.8) }} />
      {/* 落点水花：液流砸进目标液面时溅起的一圈 */}
      <ellipse
        className="lab-pour__splash"
        cx={round(dropX)}
        cy={round(dropY + 1.4)}
        rx="5"
        ry="1.8"
        style={{ fill: flow.color }}
      />
      <circle
        className="lab-pour__drop"
        cx={Math.round(dropX)}
        cy={Math.round(dropY)}
        r="1.9"
        style={{ fill: flow.color }}
      />
    </svg>
  );
}

function Workbench(props) {
  const items = useLabStore(function (state) {
    return state.items;
  });
  const selectedId = useLabStore(function (state) {
    return state.selectedId;
  });
  const pourFlow = useLabStore(function (state) {
    return state.pourFlow;
  });
  const clearSelection = useLabStore(function (state) {
    return state.clearSelection;
  });
  const canvas = useDroppable({ id: 'bench' });
  const [pourReadyId, setPourReadyId] = useState(null);

  /*
   * 悬停对准提示（物理层）：拖拽过程中把令牌当前位置换算成实体坐标，
   * 用 pourAlign 找「瓶口在目标瓶口上方且 X 对齐」的容器，给它套一圈虚线瓶口罩。
   * 判定和松手结算共用 canPour，看到提示就一定倒得进去。
   */
  useDndMonitor({
    onDragMove: function (event) {
      var data = event.active.data.current;
      var canvasNode = props.canvasRef.current;
      var translated = event.active.rect.current ? event.active.rect.current.translated : null;

      if (
        !data ||
        data.kind !== 'bench-item' ||
        !data.item ||
        data.item.kind !== 'container' ||
        !canvasNode ||
        !translated
      ) {
        setPourReadyId(function (current) {
          return current === null ? current : null;
        });
        return;
      }

      var rect = canvasNode.getBoundingClientRect();
      var moving = Object.assign({}, data.item, {
        x: translated.left - rect.left,
        y: translated.top - rect.top
      });
      var ready = null;

      useLabStore.getState().items.forEach(function (entry) {
        if (ready || entry.kind !== 'container' || entry.id === moving.id) return;
        if (pourAlign(moving, entry).canPour) ready = entry.id;
      });

      setPourReadyId(function (current) {
        return current === ready ? current : ready;
      });
    },
    onDragEnd: function () {
      setPourReadyId(null);
    },
    onDragCancel: function () {
      setPourReadyId(null);
    }
  });

  var selected = null;
  var pourTarget = null;
  for (var i = 0; i < items.length; i += 1) {
    if (items[i].id === selectedId) selected = items[i];
    if (pourFlow && items[i].id === pourFlow.targetId) pourTarget = items[i];
  }

  function setCanvas(node) {
    props.canvasRef.current = node;
    canvas.setNodeRef(node);
  }

  return (
    <section className="lab-bench" aria-label="实验台">
      <div className="lab-bench__bar">
        <span>实验台</span>
        <span>
          {items.length} 件 · 1px = 1mm
        </span>
      </div>

      <div
        ref={setCanvas}
        className={
          'lab-bench__canvas' +
          (LAB_ENGINE === 'konva' ? ' lab-bench__canvas--konva' : '') +
          (canvas.isOver ? ' lab-bench__canvas--over' : '')
        }
        onClick={function (event) {
          if (event.target === event.currentTarget) clearSelection();
        }}
      >
        {/*
         * Canvas 引擎（默认）：Konva Stage 画台面、器材、液体，
         * 拖拽 / 吸附 / 层级都在画布对象上完成。属性面板仍然是 HTML，
         * 作为浮层挂在右下角 —— 输入框、按钮留在 DOM 里更好用。
         */}
        {LAB_ENGINE === 'konva' ? (
          <KonvaBench subText={itemSubText} panel={<BenchPanel item={selected} />} />
        ) : (
          <React.Fragment>
            {/* 台面线：所有器材的玻璃底 / 底座都压在这条线上，器材不会浮在半空 */}
            <div className="lab-bench__desk" aria-hidden="true">
              <span className="lab-bench__desk-label">实验台面</span>
            </div>

            {items.length === 0 ? (
              <p className="lab-bench__empty">拖拽器材或试剂到此处</p>
            ) : null}

            {items.map(function (item) {
              return (
                <BenchItem
                  item={item}
                  key={item.id}
                  selected={item.id === selectedId}
                  onSelect={props.onSelect}
                  pour={pourFlow}
                  pourTarget={pourTarget}
                  pourReady={item.id === pourReadyId}
                />
              );
            })}

            <PourStream flow={pourFlow} items={items} />

            {/* 属性面板浮在画布右上角：选中器材即出现，取消选中就只剩提示卡 */}
            <BenchPanel item={selected} />
          </React.Fragment>
        )}
      </div>
    </section>
  );
}

function contentText(contents) {
  if (contents.length === 0) return '空';
  return contents
    .map(function (entry) {
      return (
        (entry.label || entry.chemical) +
        ' ' +
        (entry.state === 'solid' ? entry.mass + 'g' : entry.volume + 'mL')
      );
    })
    .join(' + ');
}

/* ============================ 选中后的属性面板 ============================ */

/* 器型 → 中文名，用在面板表头与读数行。 */
var TYPE_LABEL = {
  beaker: '烧杯',
  'test-tube': '试管',
  erlenmeyer: '锥形瓶',
  'round-flask': '圆底烧瓶',
  'volumetric-flask': '容量瓶',
  'reagent-bottle': '试剂瓶',
  burner: '酒精灯',
  stand: '铁架台',
  rod: '玻璃棒',
  dropper: '胶头滴管',
  'wire-gauze': '石棉网',
  'ph-paper': 'pH 试纸',
  match: '火柴'
};

/*
 * 属性面板：选中器材后浮在实验台右上角（画布内的绝对定位卡片）。
 * 三层信息：
 *   表头  名称 · 器型 · 取消选中
 *   参数  名称输入框、浓度输入框（mol/L）—— 打字只改本地草稿，回车 / 失焦才提交，
 *         避免每敲一个字符就往全局状态与日志里写一条
 *   操作  搅拌 · 振荡 · 冲洗 · 加入试剂 · 倒出 · 移走（工具换成 点燃 / 取下）
 * 没有选中任何器材时保留一张提示卡，面板位置不会跳。
 */
function BenchPanel(props) {
  var item = props.item;
  var [pickerOpen, setPickerOpen] = useState(false);
  var [nameDraft, setNameDraft] = useState('');
  var [concDraft, setConcDraft] = useState('');

  var renameItem = useLabStore(function (state) {
    return state.renameItem;
  });
  var setConcentration = useLabStore(function (state) {
    return state.setConcentration;
  });
  var clearSelection = useLabStore(function (state) {
    return state.clearSelection;
  });
  var addReagent = useLabStore(function (state) {
    return state.addReagent;
  });
  var dumpLiquid = useLabStore(function (state) {
    return state.dumpLiquid;
  });
  var clearContents = useLabStore(function (state) {
    return state.clearContents;
  });
  var removeItem = useLabStore(function (state) {
    return state.removeItem;
  });
  var lightItem = useLabStore(function (state) {
    return state.lightItem;
  });
  var toggleStopper = useLabStore(function (state) {
    return state.toggleStopper;
  });
  var releaseClamp = useLabStore(function (state) {
    return state.releaseClamp;
  });
  var stir = useLabStore(function (state) {
    return state.stir;
  });
  var stopStir = useLabStore(function (state) {
    return state.stopStir;
  });
  var shakeItem = useLabStore(function (state) {
    return state.shakeItem;
  });
  var rinseItem = useLabStore(function (state) {
    return state.rinseItem;
  });
  var addLog = useLabStore(function (state) {
    return state.addLog;
  });
  var items = useLabStore(function (state) {
    return state.items;
  });

  var activeId = item ? item.id : null;

  /* 换选中对象时重置草稿与试剂抽屉（面板永远显示当前器材的真实参数）。 */
  useEffect(
    function () {
      setNameDraft(item ? item.name : '');
      setConcDraft(item && item.molarity ? String(item.molarity) : '');
      setPickerOpen(false);
    },
    [activeId]
  );

  if (!item) {
    return (
      <div className="lab-panel lab-panel--empty">
        <span className="lab-panel__hint">点击台面上的器材，查看参数与操作</span>
      </div>
    );
  }

  var isContainer = item.kind === 'container';
  var phText = item.ph === null ? '--' : item.ph.toFixed(1);
  var matchBurning = items.some(function (entry) {
    return entry.type === 'match' && entry.lit && entry.litUntil > Date.now();
  });
  /* 面板的「搅拌」会自动拿台上闲置的那根玻璃棒；台上没有棒子就提示先取一根。 */
  var rod = null;
  items.forEach(function (entry) {
    if (!rod && entry.type === 'rod' && !entry.stirring) rod = entry;
  });

  function commitName() {
    renameItem(item.id, nameDraft);
  }

  function commitConcentration() {
    setConcentration(item.id, concDraft === '' ? 0 : concDraft);
  }

  function enterCommits(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.currentTarget.blur();
  }

  return (
    <div className="lab-panel" onClick={function (event) { event.stopPropagation(); }}>
      <div className="lab-panel__head">
        <span className="lab-panel__title">{item.name}</span>
        <span className="lab-panel__type">
          {TYPE_LABEL[item.type] || item.type} · {isContainer ? item.capacity + 'mL' : '工具'}
        </span>
        <button
          className="lab-panel__close"
          type="button"
          aria-label="取消选中"
          title="取消选中"
          onClick={clearSelection}
        >
          ×
        </button>
      </div>

      <div className="lab-panel__fields">
        <label className="lab-field">
          <span className="lab-field__label">名称</span>
          <input
            className="lab-field__input"
            type="text"
            value={nameDraft}
            maxLength={16}
            onChange={function (event) {
              setNameDraft(event.target.value);
            }}
            onBlur={commitName}
            onKeyDown={enterCommits}
          />
        </label>

        {isContainer ? (
          <label className="lab-field">
            <span className="lab-field__label">浓度 mol/L</span>
            <input
              className="lab-field__input"
              type="number"
              min="0"
              max="18"
              step="0.1"
              value={concDraft}
              placeholder="0"
              onChange={function (event) {
                setConcDraft(event.target.value);
              }}
              onBlur={commitConcentration}
              onKeyDown={enterCommits}
            />
          </label>
        ) : null}
      </div>

      <div className="lab-panel__stats">
        {isContainer ? (
          <span className="lab-panel__line">
            Vol: {item.volume}mL | Temp: {item.temperature}°C | PH: {phText}
          </span>
        ) : (
          <span className="lab-panel__line">{toolStatus(item, matchBurning)}</span>
        )}

        {isContainer ? (
          <span
            className={
              'lab-panel__heat' +
              (item.clamp || item.evenHeat
                ? ' lab-panel__heat--even'
                : item.heating
                  ? ' lab-panel__heat--uneven'
                  : '')
            }
          >
            {item.clamp
              ? '夹持: 铁夹锁定 · 先「取下」才能移动'
              : item.evenHeat
                ? item.stirring
                  ? '受热: 搅拌中 · 均匀受热'
                  : '受热: 垫石棉网 · 均匀受热'
                : item.heating
                  ? '受热: 直接受热 · 玻璃受热不均'
                  : '受热: 未受热'}
          </span>
        ) : null}

        {isContainer ? (
          <span className="lab-panel__contents">
            Contents: {item.contents.length ? '[' + contentText(item.contents) + ']' : '空'}
          </span>
        ) : null}

        {isContainer && item.phenomenon ? (
          <span className="lab-panel__phenomenon">现象: {item.phenomenon}</span>
        ) : null}
      </div>

      <div className="lab-panel__actions">
        {isContainer ? (
          <button
            className={'lab-action' + (pickerOpen ? ' lab-action--active' : '')}
            type="button"
            aria-expanded={pickerOpen}
            aria-controls="lab-reagent-picker"
            onClick={function () {
              setPickerOpen(!pickerOpen);
            }}
          >
            加入试剂
          </button>
        ) : null}

        {isContainer ? (
          <button
            className="lab-action"
            type="button"
            onClick={function () {
              dumpLiquid(item.id);
            }}
          >
            倒出
          </button>
        ) : null}

        {isContainer ? (
          <button
            className={'lab-action' + (item.stirring ? ' lab-action--active' : '')}
            type="button"
            aria-pressed={!!item.stirring}
            title={
              item.stirring
                ? '提前收手'
                : rod
                  ? '用台上的玻璃棒搅拌：旋起涡流，可溶固体溶解更快'
                  : '先在辅助工具里取一根玻璃棒'
            }
            onClick={function () {
              if (item.stirring) {
                stopStir(item.id);
                return;
              }
              if (rod) stir(rod.id, item.id);
              else addLog('警告', '先把玻璃棒放到实验台上，再回来搅拌。');
            }}
          >
            {item.stirring ? '停手' : '搅拌'}
          </button>
        ) : null}

        {isContainer ? (
          <button
            className={'lab-action' + (item.shaking ? ' lab-action--active' : '')}
            type="button"
            aria-pressed={!!item.shaking}
            title="振荡摇匀：让液体与固体充分接触"
            onClick={function () {
              shakeItem(item.id);
            }}
          >
            振荡
          </button>
        ) : null}

        {isContainer ? (
          <button
            className="lab-action"
            type="button"
            title="用蒸馏水冲洗：倒掉内容物并回到室温"
            onClick={function () {
              rinseItem(item.id);
            }}
          >
            冲洗
          </button>
        ) : null}

        {isContainer && item.stopper ? (
          <button
            className={'lab-action' + (item.open ? ' lab-action--active' : '')}
            type="button"
            aria-pressed={!!item.open}
            title={item.open ? '点击塞上瓶塞' : '点击打开瓶塞，才能倒液 / 加试剂'}
            onClick={function () {
              toggleStopper(item.id);
            }}
          >
            {item.open ? '塞上' : '开塞'}
          </button>
        ) : null}

        {isContainer ? (
          <button
            className="lab-action"
            type="button"
            onClick={function () {
              clearContents(item.id);
            }}
          >
            清空
          </button>
        ) : null}

        {item.clamp ? (
          <button
            className="lab-action lab-action--active"
            type="button"
            onClick={function () {
              releaseClamp(item.id);
            }}
          >
            取下
          </button>
        ) : null}

        {!isContainer && (item.type === 'burner' || item.type === 'match') ? (
          <button
            className={'lab-action' + (item.lit ? ' lab-action--active' : '')}
            type="button"
            aria-pressed={!!item.lit}
            onClick={function () {
              lightItem(item.id);
            }}
          >
            {item.lit ? '熄灭' : item.type === 'match' ? '划燃' : '点燃'}
          </button>
        ) : null}

        <button
          className="lab-action lab-action--ghost"
          type="button"
          onClick={function () {
            removeItem(item.id);
          }}
        >
          {isContainer ? '移走' : '移走工具'}
        </button>
      </div>

      {isContainer && pickerOpen ? (
        <div className="lab-panel__picker" id="lab-reagent-picker">
          {LAB_REAGENTS.map(function (reagent) {
            return (
              <button
                className="lab-panel__reagent"
                type="button"
                key={reagent.id}
                title={reagent.name}
                onClick={function () {
                  addReagent(item.id, reagent);
                  setPickerOpen(false);
                }}
              >
                {reagent.logName || reagent.formula || reagent.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}


/* ============================ 底部：实验日志 ============================ */

function Console() {
  const logs = useLabStore(function (state) {
    return state.logs;
  });
  const clearLogs = useLabStore(function (state) {
    return state.clearLogs;
  });
  var listRef = useRef(null);

  /* 新日志出现时滚动到底部，保证最新一条始终可见。 */
  useEffect(
    function () {
      var node = listRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    },
    [logs.length]
  );

  return (
    <section className="lab-console" aria-label="实验日志">
      <div className="lab-console__bar">
        <span>实验日志</span>
        <button
          className="lab-console__clear"
          type="button"
          onClick={clearLogs}
          disabled={logs.length === 0}
        >
          清空
        </button>
      </div>

      <ol className="lab-log" ref={listRef} aria-live="polite">
        {logs.length === 0 ? (
          <li className="lab-log__empty">暂无记录</li>
        ) : (
          logs.map(function (log) {
            const levelClass =
              log.level === '警告'
                ? 'lab-log__level--warn'
                : log.level === '反应'
                  ? 'lab-log__level--reaction'
                  : '';

            return (
              <li className="lab-log__row" key={log.id}>
                <span className="lab-log__time">{log.time}</span>
                <span className={'lab-log__level ' + levelClass}>
                  [{log.level}]
                </span>
                <span className="lab-log__text">{log.text}</span>
              </li>
            );
          })
        )}
      </ol>
    </section>
  );
}

/* ============================ 页面 ============================ */

/*
 * 拖拽预览：器材库拖出来的是名称胶囊，实验台上的器材则复制一份完整图形，
 * 让 SVG 跟着指针走（原件留在原位淡成占位），松手后才落到新坐标。
 */
function DragPreview(props) {
  var data = props.data;

  if (data.kind === 'bench-item') {
    var item = data.item;
    var ghostClass = 'lab-drag-ghost';
    if (item.kind === 'container' && item.temperature >= 60) ghostClass += ' lab-vessel--hot';
    if (item.lit) ghostClass += ' lab-vessel--lit';
    if (item.type === 'wire-gauze') ghostClass += ' lab-vessel--gauze';
    if (item.type === 'wire-gauze' && item.hot) ghostClass += ' lab-vessel--gauze-hot';
    if (item.heating) ghostClass += ' lab-vessel--heating';
    if (item.boiling) ghostClass += ' lab-vessel--boiling';

    var ghostBox = item.dimensions || dimensionsOf(item.type);

    return (
      <div
        className={ghostClass}
        data-item-id={item.id}
        style={{ width: ghostBox.width, height: ghostBox.height }}
      >
        {/* suffix 让幽灵的 SVG id 与台上的原件错开，避免重复 id 影响裁切 */}
        <LabGraphic item={item} suffix="-ghost" />
        <span className="lab-vessel__name">{item.name}</span>
        <span className="lab-vessel__sub">{itemSubText(item)}</span>
      </div>
    );
  }

  var libraryItem = data.item;

  return (
    <div className="lab-drag-preview">
      <span className="lab-drag-preview__name">{libraryItem.name}</span>
      {libraryItem.formula ? (
        <span className="lab-drag-preview__formula">{libraryItem.formula}</span>
      ) : null}
    </div>
  );
}

function LabPage() {
  const itemCount = useLabStore(function (state) {
    return state.items.length;
  });
  const addLog = useLabStore(function (state) {
    return state.addLog;
  });
  const addItem = useLabStore(function (state) {
    return state.addItem;
  });
  const moveItem = useLabStore(function (state) {
    return state.moveItem;
  });
  const addReagent = useLabStore(function (state) {
    return state.addReagent;
  });
  const startPour = useLabStore(function (state) {
    return state.startPour;
  });
  const clampOnStand = useLabStore(function (state) {
    return state.clampOnStand;
  });
  const lightItem = useLabStore(function (state) {
    return state.lightItem;
  });
  const standOnGauze = useLabStore(function (state) {
    return state.standOnGauze;
  });
  const stackGauze = useLabStore(function (state) {
    return state.stackGauze;
  });
  const stir = useLabStore(function (state) {
    return state.stir;
  });
  const selectItem = useLabStore(function (state) {
    return state.selectItem;
  });

  var sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );
  var [activeDrag, setActiveDrag] = useState(null);
  var canvasRef = useRef(null);
  var lastDragAt = useRef(0);

  function handleDragStart(event) {
    setActiveDrag(event.active.data.current || null);
    recordGrabOffset(event);
  }

  function handleDragEnd(event) {
    var active = event.active;
    var over = event.over;
    var data = active.data.current;
    var target = targetId(over);

    setActiveDrag(null);
    lastDragAt.current = Date.now();
    if (!over || !data) return;

    if (data.kind === 'library') {
      if (data.item.kind === 'reagent') {
        var dropId = target;

        /*
         * Canvas 引擎里容器是 Konva 对象、不是 DOM 节点，没有 droppable 可接，
         * 所以按拖拽令牌的落点做一次矩形命中，找压在最上面的容器。
         */
        if (!dropId) {
          var shape = data.item.shape || 'dropper';
          var spot = dragPoint(canvasRef.current, event, shape);
          var box = dimensionsOf(shape);
          var hit = containerAt(
            spot.x + box.width / 2,
            spot.y + box.height / 2,
            useLabStore.getState().items
          );
          if (hit) dropId = hit.id;
        }

        if (dropId) {
          addReagent(dropId, data.item);
        } else {
          addLog('警告', '请把试剂拖到容器中。');
        }
        return;
      }

      if (over.id === 'bench' || target) {
        addItem(
          data.item,
          landedPoint(canvasRef.current, event, data.item.shape || data.item.id)
        );
      }
      return;
    }

    if (data.kind === 'bench-item') {
      /* 松手即选中：操作条立刻切到刚移动的器材，方便接着加试剂 / 点燃。 */
      selectItem(data.id);

      if (target && target !== data.id) {
        var targetItem = benchItemById(target);

        /*
         * 拿着火柴凑到酒精灯上：能点就点（火柴得先划燃，没燃会记一条警告），
         * 点完火柴留在落点，顺手也就完成了一次摆放。
         */
        if (data.item.type === 'match' && targetItem && targetItem.type === 'burner' && !targetItem.lit) {
          lightItem(target);
          var spot = landedPoint(canvasRef.current, event, data.item.type);
          moveItem(data.id, spot.x, spot.y);
          return;
        }

        /*
         * 容器 ↔ 石棉网的两种吸附：
         *   · 容器放到网上：中心对齐、底部贴住网面，直接形成受热链；
         *   · 石棉网放到容器上：垫在容器下面；若容器正架在火焰上，连容器一起抬高。
         */
        if (targetItem && targetItem.type === 'wire-gauze' && data.item.kind === 'container') {
          standOnGauze(data.id, target);
          return;
        }

        if (data.item.type === 'wire-gauze' && targetItem && targetItem.kind === 'container') {
          stackGauze(data.id, target);
          return;
        }

        /* 容器放到铁架台上：夹进铁圈，之后移动铁架台会带着它一起走。 */
        if (targetItem && targetItem.type === 'stand' && data.item.kind === 'container') {
          clampOnStand(data.id, target);
          return;
        }

        /* 玻璃棒放进容器：开始搅拌（液面旋涡、可溶固体逐渐溶解、传热更均匀）。 */
        if (data.item.type === 'rod' && targetItem && targetItem.kind === 'container') {
          stir(data.id, target);
          return;
        }

        if (targetItem && targetItem.kind === 'container' && data.item.kind === 'container') {
          startPour(data.id, target);
          return;
        }
      }

      if (over.id === 'bench' || target) {
        var point = landedPoint(canvasRef.current, event, data.item.type);

        /*
         * 容器松手在铁圈附近（玻璃底中心距圈心 < CLAMP_RADIUS）也吸上去。
         * 判定放在 moveItem 之前：被夹住的容器拖回原位时不会先解夹再夹一次。
         */
        if (data.item.kind === 'container') {
          var standId = nearestStand(data.item, point);
          if (standId) {
            clampOnStand(data.id, standId);
            return;
          }
        }

        moveItem(data.id, point.x, point.y);
      }
    }
  }

  function handleDragCancel() {
    setActiveDrag(null);
    lastDragAt.current = Date.now();
  }

  function handleSelect(id) {
    if (Date.now() - lastDragAt.current < 160) return;
    selectItem(id);
  }

  /* 点击（而非拖拽）器材库条目时直接放入实验台，方便触屏与键盘用户。 */
  function handleLibraryPick(item) {
    if (Date.now() - lastDragAt.current < 160) return;

    if (item.kind === 'reagent') {
      var state = useLabStore.getState();
      var selected = null;
      for (var i = 0; i < state.items.length; i += 1) {
        if (state.items[i].id === state.selectedId) selected = state.items[i];
      }
      if (selected && selected.kind === 'container') {
        addReagent(selected.id, item);
      } else {
        addLog('警告', '请先选中一个容器，或把试剂拖到容器上。');
      }
      return;
    }

    /* 点击放入：沿台面依次排开，纵向交给 settleY 落在台面线上。 */
    var canvas = canvasRef.current;
    var state = useLabStore.getState();
    var type = item.shape || item.id;
    var x = 36 + (state.items.length % 6) * 104;
    var height = canvas ? canvas.getBoundingClientRect().height : 520;

    addItem(item, { x: x, y: settleY(type, x, 40, height, state.items) });
  }

  /* 加热引擎：每秒结算一次酒精灯对邻近容器的加热，离开火焰的容器自然降温。 */
  useEffect(function () {
    var timer = window.setInterval(function () {
      useLabStore.getState().tickHeating();
    }, 1000);

    return function () {
      window.clearInterval(timer);
    };
  }, []);

  /* 倒液动画：每 60ms 推进一步，倾斜角度、水柱与目标液面一起走，1.1s 后结算。 */
  useEffect(function () {
    var timer = window.setInterval(function () {
      useLabStore.getState().tickPour();
    }, 60);

    return function () {
      window.clearInterval(timer);
    };
  }, []);

  /*
   * 搅拌引擎：每 120ms 推进一次涡流进度与溶解量，4.2s 到点自动收棒。
   * 节奏比加热快得多，涡流和固体逐份消失才连续。
   */
  useEffect(function () {
    var timer = window.setInterval(function () {
      useLabStore.getState().tickStir();
    }, 120);

    return function () {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={labCollisionDetection}
      autoScroll={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <section className="page page--lab">
        <header className="lab-head">
          <h1 className="lab-title">虚拟实验室</h1>
          <p className="lab-meta">{itemCount} 件器材</p>
        </header>

        <div className="lab-shell">
          <Library onPick={handleLibraryPick} />
          <Workbench canvasRef={canvasRef} onSelect={handleSelect} />
          <Console />
        </div>
      </section>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? <DragPreview data={activeDrag} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default LabPage;
