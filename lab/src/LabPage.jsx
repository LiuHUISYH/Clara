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
import { useLabStore, LAB_GEOMETRY, clampPoint, pourAlign, mouthPoint } from './store';
import { LabGraphic } from './Vessel';

/* 令牌外框直接取 store 的实体尺寸，页面与碰撞判定不会各说各话。 */
var TOKEN_WIDTH = LAB_GEOMETRY.itemWidth;
var TOKEN_HEIGHT = LAB_GEOMETRY.itemHeight;
var TARGET_PREFIX = 'target:';

/*
 * 倾倒手势的几何判定全部来自 store 的实体坐标（ECS）：
 * 用拖拽中的令牌外框 + 画布矩形换算出「源容器现在在哪」，再和落点容器做
 * pourAlign（瓶口 X 中心对齐 + 上下叠住）。不读 DOM 尺寸，页面缩放也不会跑偏。
 */

/* 拖拽中的令牌左上角 → 画布坐标（画布本身也是一个 droppable，能拿到它的矩形）。 */
function dragOrigin(args) {
  var translated = args.active.rect.current && args.active.rect.current.translated;
  var bench = args.droppableRects.get('bench');
  if (!translated || !bench) return null;

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
 * 落点换算：把拖拽中令牌的实时矩形对回画布坐标。
 * 直接取左上角（而不是中心）能让器材落在幽灵停下的位置，配合实测宽高做
 * 边界钳制，避免文字行把器材顶出画布底部。
 */
function dragPoint(canvas, event) {
  if (!canvas) return { x: 24, y: 24 };

  var rect = canvas.getBoundingClientRect();
  var translated = event.active.rect.current && event.active.rect.current.translated;
  if (!translated) return { x: 24, y: 24 };

  var width = translated.width || TOKEN_WIDTH;
  var height = translated.height || TOKEN_HEIGHT;
  var maxX = Math.max(4, rect.width - width - 4);
  var maxY = Math.max(4, rect.height - height - 4);

  return {
    x: Math.round(Math.max(4, Math.min(maxX, translated.left - rect.left))),
    y: Math.round(Math.max(4, Math.min(maxY, translated.top - rect.top)))
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
function nearestStand(point) {
  var items = useLabStore.getState().items;
  var base = {
    x: point.x + TOKEN_WIDTH / 2,
    y: point.y + LAB_GEOMETRY.vesselBaseY
  };
  var best = null;
  var bestDistance = LAB_GEOMETRY.clampRadius;

  items.forEach(function (entry) {
    if (entry.type !== 'stand') return;
    var ring = clampPoint(entry);
    var distance = Math.sqrt(Math.pow(ring.x - base.x, 2) + Math.pow(ring.y - base.y, 2));
    if (distance <= bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  });

  return best ? best.id : null;
}

/* ============================ 左侧：器材库 ============================ */

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
      {item.swatch ? (
        <span className="lab-item__swatch" style={{ background: item.swatch }} aria-hidden="true" />
      ) : null}
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
  if (item.clamp) className += ' lab-vessel--clamped';
  if (props.pourReady) className += ' lab-vessel--pour-ready';
  if (pouring && props.pourTarget) {
    className +=
      ' lab-vessel--pouring' + (props.pourTarget.x < item.x ? ' lab-vessel--pour-left' : '');
  }

  return (
    <div
      ref={setNode}
      className={className}
      style={{ left: item.x, top: item.y }}
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
 * 倒液水柱：在两个容器的瓶口之间画一条流动的虚线，颜色与线宽都取源液体。
 * 纯视觉层 —— 进度、体积都由 store 的 pourFlow 驱动，动画结束后才结算。
 * 起点 / 落点来自 store 的 mouthPoint（瓶口中心），源容器倾斜 38° 后瓶口甩向
 * 目标一侧，所以起点再往倾倒方向偏移半指宽，水柱从唇边落到目标瓶口里。
 */
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

  return (
    <svg className="lab-pour" aria-hidden="true" focusable="false">
      <path className="lab-pour__stream" d={d} style={{ stroke: flow.color, strokeWidth: thickness }} />
      <path className="lab-pour__glint" d={d} style={{ strokeWidth: Math.max(0.5, thickness - 1.8) }} />
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
        <span>{items.length} 件</span>
      </div>

      <div
        ref={setCanvas}
        className={'lab-bench__canvas' + (canvas.isOver ? ' lab-bench__canvas--over' : '')}
        onClick={function (event) {
          if (event.target === event.currentTarget) clearSelection();
        }}
      >
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
      </div>

      <BenchActions item={selected} />
    </section>
  );
}

/* ============================ 选中后的操作条 ============================ */

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

function BenchActions(props) {
  var item = props.item;
  var [pickerOpen, setPickerOpen] = useState(false);
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
  var items = useLabStore(function (state) {
    return state.items;
  });

  var activeId = item ? item.id : null;
  useEffect(
    function () {
      setPickerOpen(false);
    },
    [activeId]
  );

  if (!item) return null;

  var isContainer = item.kind === 'container';
  var phText = item.ph === null ? '--' : item.ph.toFixed(1);
  var matchBurning = items.some(function (entry) {
    return entry.type === 'match' && entry.lit && entry.litUntil > Date.now();
  });

  return (
    <div className="lab-bench__actions" onClick={function (event) { event.stopPropagation(); }}>
      <div className="lab-actions__status">
        <span className="lab-actions__name">{item.name}</span>
        {isContainer ? (
          item.stopper ? (
            <button
              className={
                'lab-actions__state' +
                (item.open ? ' lab-actions__state--open' : ' lab-actions__state--closed')
              }
              type="button"
              aria-pressed={!!item.open}
              title={item.open ? '点击塞上瓶塞' : '点击打开瓶塞'}
              onClick={function () {
                toggleStopper(item.id);
              }}
            >
              Status: {item.open ? 'Open' : 'Closed'}
            </button>
          ) : (
            <span className="lab-actions__state">Status: Open</span>
          )
        ) : null}
        {isContainer ? (
          <span className="lab-actions__line">
            Vol: {item.volume}mL | Temp: {item.temperature}°C | PH: {phText}
          </span>
        ) : (
          <span className="lab-actions__line">{toolStatus(item, matchBurning)}</span>
        )}
        {isContainer ? (
          <span
            className={
              'lab-actions__heat' +
              (item.clamp
                ? ' lab-actions__heat--even'
                : item.evenHeat
                  ? ' lab-actions__heat--even'
                  : item.heating
                    ? ' lab-actions__heat--uneven'
                    : '')
            }
          >
            {item.clamp
              ? '夹持: 铁夹锁定 · 先「取下」才能移动'
              : item.evenHeat
                ? '受热: 垫石棉网 · 均匀受热'
                : item.heating
                  ? '受热: 直接受热 · 玻璃受热不均'
                  : '受热: 未受热'}
          </span>
        ) : null}
        {isContainer ? (
          <span className="lab-actions__contents">
            Contents: {item.contents.length ? '[' + contentText(item.contents) + ']' : '空'}
          </span>
        ) : null}
        {isContainer && item.phenomenon ? (
          <span className="lab-actions__phenomenon">现象: {item.phenomenon}</span>
        ) : null}
      </div>

      {isContainer ? (
        <div className="lab-actions__buttons">
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
          <button
            className="lab-action"
            type="button"
            onClick={function () {
              dumpLiquid(item.id);
            }}
          >
            倒出
          </button>
          <button
            className="lab-action"
            type="button"
            onClick={function () {
              clearContents(item.id);
            }}
          >
            清空
          </button>
          {item.clamp ? (
            <button
              className="lab-action lab-action--active"
              type="button"
              onClick={function () {
                setPickerOpen(false);
                releaseClamp(item.id);
              }}
            >
              取下
            </button>
          ) : null}
          <button
            className="lab-action lab-action--ghost"
            type="button"
            onClick={function () {
              setPickerOpen(false);
              removeItem(item.id);
            }}
          >
            移除
          </button>
        </div>
      ) : (
        <div className="lab-actions__buttons">
          {item.type === 'burner' || item.type === 'match' ? (
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
            移走工具
          </button>
        </div>
      )}

      {isContainer && pickerOpen ? (
        <div className="lab-reagent-picker" id="lab-reagent-picker">
          <span className="lab-reagent-picker__label">加入试剂</span>
          {LAB_REAGENTS.map(function (reagent) {
            return (
              <button
                className="lab-reagent-picker__item"
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

    return (
      <div className={ghostClass} data-item-id={item.id}>
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
        if (target) {
          addReagent(target, data.item);
        } else {
          addLog('警告', '请把试剂拖到容器中。');
        }
        return;
      }

      if (over.id === 'bench' || target) {
        addItem(data.item, dragPoint(canvasRef.current, event));
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
          var spot = dragPoint(canvasRef.current, event);
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

        if (targetItem && targetItem.kind === 'container' && data.item.kind === 'container') {
          startPour(data.id, target);
          return;
        }
      }

      if (over.id === 'bench' || target) {
        var point = dragPoint(canvasRef.current, event);

        /*
         * 容器松手在铁圈附近（玻璃底中心距圈心 < 50px）也吸上去。
         * 判定放在 moveItem 之前：被夹住的容器拖回原位时不会先解夹再夹一次。
         */
        if (data.item.kind === 'container') {
          var standId = nearestStand(point);
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

    addItem(item);
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
