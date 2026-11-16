import React, { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { LAB_LIBRARY, LAB_ITEM_COUNT, LAB_REAGENTS } from './library';
import { useLabStore } from './store';
import { LabGraphic } from './Vessel';

var TOKEN_WIDTH = 104;
var TOKEN_HEIGHT = 128;
var TARGET_PREFIX = 'target:';

/*
 * 倾倒手势的空间阈值：只有被拖容器的中心落在目标容器中心附近（约令牌的
 * 半宽、半高）时才认定为“倒进去”。两个令牌外框只是擦边重叠时算自由摆放，
 * 否则想把两个容器摆得近一点都会被误判成倒液。
 */
var POUR_RANGE_X = 56;
var POUR_RANGE_Y = 64;

function rectCentre(rect) {
  if (!rect) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/* 指针离目标容器中心足够近，才算“把东西倒进这个容器”。 */
function withinPourRange(point, targetRect) {
  var centre = rectCentre(targetRect);
  if (!point || !centre) return false;

  return Math.abs(point.x - centre.x) <= POUR_RANGE_X && Math.abs(point.y - centre.y) <= POUR_RANGE_Y;
}

/*
 * 指针落在容器上时优先命中容器，否则落回整张实验台。
 * 实验台上的容器互拖时还要校验距离：擦边重叠只是摆放，压到中心才倒液。
 * 从器材库拖出来的试剂 / 器材不受影响，落点只要在容器内就生效。
 * 酒精灯也是落点，但只认火柴：把火柴凑到灯芯上才点亮，其它器材压上去
 * 仍然只是摆放，免得「把烧杯架到火焰上」被误判成倒液。
 */
function labCollisionDetection(args) {
  var hits = pointerWithin(args);
  if (hits.length === 0) return [];

  var data = args.active.data.current;
  var fromBench = !!data && data.kind === 'bench-item';
  var isMatch = !!data && !!data.item && data.item.type === 'match';
  var activeRect = args.active.rect.current ? args.active.rect.current.translated : null;
  var point = args.pointerCoordinates || rectCentre(activeRect);
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
     * 这两种情况都不走“倒液”判定，所以先于容器的距离校验返回。
     */
    if (data && data.item) {
      if (data.item.type === 'wire-gauze' && targetItem.kind === 'container') return [hits[i]];
      if (data.item.kind === 'container' && targetItem.type === 'wire-gauze') return [hits[i]];
    }

    if (isMatch && targetItem.type === 'burner') return [hits[i]];
    if (targetItem.kind !== 'container') continue;

    if (!fromBench || withinPourRange(point, args.droppableRects.get(hits[i].id))) {
      return [hits[i]];
    }
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

/* ============================ 左侧：器材库 ============================ */

function LibraryItem(props) {
  var item = props.item;
  var drag = useDraggable({
    id: 'library:' + item.id,
    data: { kind: 'library', item: item }
  });

  var tail = item.formula || (item.capacity ? item.capacity + 'mL' : '');

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
  var drag = useDraggable({
    id: 'bench:' + item.id,
    data: { kind: 'bench-item', id: item.id, item: item }
  });
  var drop = useDroppable({
    id: TARGET_PREFIX + item.id,
    data: { kind: item.kind, id: item.id },
    disabled: item.kind !== 'container' && item.type !== 'burner' && item.type !== 'wire-gauze'
  });

  function setNode(node) {
    drag.setNodeRef(node);
    drop.setNodeRef(node);
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

  return (
    <div
      ref={setNode}
      className={className}
      style={{ left: item.x, top: item.y }}
      data-item-id={item.id}
      {...drag.attributes}
      {...drag.listeners}
      aria-label={'选择' + item.name}
      onClick={function (event) {
        event.stopPropagation();
        props.onSelect(item.id);
      }}
    >
      <LabGraphic item={item} />
      {item.kind === 'container' && item.gas ? (
        <span className="lab-vessel__gas" aria-hidden="true">{'↑ ' + item.gas}</span>
      ) : null}
      <span className="lab-vessel__name">{item.name}</span>
      <span className="lab-vessel__sub">{itemSubText(item)}</span>
    </div>
  );
}

function Workbench(props) {
  const items = useLabStore(function (state) {
    return state.items;
  });
  const selectedId = useLabStore(function (state) {
    return state.selectedId;
  });
  const clearSelection = useLabStore(function (state) {
    return state.clearSelection;
  });
  const canvas = useDroppable({ id: 'bench' });

  var selected = null;
  for (var i = 0; i < items.length; i += 1) {
    if (items[i].id === selectedId) selected = items[i];
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
            />
          );
        })}
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
          <span className="lab-actions__line">
            Temp: {item.temperature}°C | PH: {phText} | Vol: {item.volume}mL
          </span>
        ) : (
          <span className="lab-actions__line">{toolStatus(item, matchBurning)}</span>
        )}
        {isContainer ? (
          <span
            className={
              'lab-actions__heat' +
              (item.evenHeat
                ? ' lab-actions__heat--even'
                : item.heating
                  ? ' lab-actions__heat--uneven'
                  : '')
            }
          >
            {item.evenHeat
              ? '受热: 垫石棉网 · 均匀受热'
              : item.heating
                ? '受热: 直接受热 · 玻璃受热不均'
                : '受热: 未受热'}
          </span>
        ) : null}
        {isContainer ? (
          <span className="lab-actions__contents">内容: {contentText(item.contents)}</span>
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
  const pour = useLabStore(function (state) {
    return state.pour;
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

        if (targetItem && targetItem.kind === 'container' && data.item.kind === 'container') {
          pour(data.id, target);
          return;
        }
      }

      if (over.id === 'bench' || target) {
        var point = dragPoint(canvasRef.current, event);
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
