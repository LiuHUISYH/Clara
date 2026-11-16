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

/* 指针落在容器上时优先命中容器，否则落回整张实验台。 */
function labCollisionDetection(args) {
  var hits = pointerWithin(args);
  if (hits.length === 0) return [];

  var target = hits.filter(function (hit) {
    return String(hit.id).indexOf(TARGET_PREFIX) === 0;
  })[0];

  return target ? [target] : hits;
}

function dragPoint(canvas, event) {
  if (!canvas) return { x: 24, y: 24 };

  var rect = canvas.getBoundingClientRect();
  var translated = event.active.rect.current && event.active.rect.current.translated;
  if (!translated) return { x: 24, y: 24 };

  var x = translated.left - rect.left + translated.width / 2 - TOKEN_WIDTH / 2;
  var y = translated.top - rect.top + translated.height / 2 - TOKEN_HEIGHT / 2;
  var maxX = Math.max(4, rect.width - TOKEN_WIDTH - 4);
  var maxY = Math.max(4, rect.height - TOKEN_HEIGHT - 4);

  return {
    x: Math.round(Math.max(4, Math.min(maxX, x))),
    y: Math.round(Math.max(4, Math.min(maxY, y)))
  };
}

function targetId(over) {
  if (!over) return null;
  var id = String(over.id);
  return id.indexOf(TARGET_PREFIX) === 0 ? id.slice(TARGET_PREFIX.length) : null;
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
    data: { kind: 'container', id: item.id },
    disabled: item.kind !== 'container'
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
  if (item.heating) className += ' lab-vessel--heating';

  var subText;
  if (item.kind === 'container') {
    var body =
      item.volume > 0
        ? item.volume + ' / ' + item.capacity + ' mL'
        : item.contents.length > 0
          ? '固体 ' + item.contents.reduce(function (mass, entry) { return mass + (entry.mass || 0); }, 0) + ' g'
          : '空 · ' + item.capacity + ' mL';
    subText = (item.temperature !== 25 ? item.temperature + '°C · ' : '') + body;
  } else {
    subText = item.type === 'burner' && item.lit ? '燃烧中' : '工具';
  }

  return (
    <div
      ref={setNode}
      className={className}
      style={{ left: item.x, top: item.y }}
      {...drag.attributes}
      {...drag.listeners}
      aria-label={'选择' + item.name}
      onClick={function (event) {
        event.stopPropagation();
        props.onSelect(item.id);
      }}
    >
      <LabGraphic item={item} />
      <span className="lab-vessel__name">{item.name}</span>
      <span className="lab-vessel__sub">{subText}</span>
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
  var toggleBurner = useLabStore(function (state) {
    return state.toggleBurner;
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

  return (
    <div className="lab-bench__actions" onClick={function (event) { event.stopPropagation(); }}>
      <div className="lab-actions__status">
        <span className="lab-actions__name">{item.name}</span>
        {isContainer ? (
          <span className="lab-actions__line">
            Temp: {item.temperature}°C | PH: {phText} | Vol: {item.volume}mL
          </span>
        ) : (
          <span className="lab-actions__line">
            {item.type === 'burner'
              ? item.lit
                ? '状态: 燃烧中 · 靠近容器即可加热'
                : '状态: 未点燃'
              : '工具'}
          </span>
        )}
        {isContainer ? (
          <span className="lab-actions__contents">内容: {contentText(item.contents)}</span>
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
          {item.type === 'burner' ? (
            <button
              className={'lab-action' + (item.lit ? ' lab-action--active' : '')}
              type="button"
              aria-pressed={!!item.lit}
              onClick={function () {
                toggleBurner(item.id);
              }}
            >
              {item.lit ? '熄灭' : '点燃'}
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

function DragPreview(props) {
  var item = props.data.item;

  return (
    <div className="lab-drag-preview">
      <span className="lab-drag-preview__name">{item.name}</span>
      {item.formula ? <span className="lab-drag-preview__formula">{item.formula}</span> : null}
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
      if (target && target !== data.id && data.item.kind === 'container') {
        pour(data.id, target);
        return;
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
