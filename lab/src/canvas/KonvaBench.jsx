/**
 * KonvaBench.jsx —— Canvas 版实验台（Step 1 – 4）
 * ------------------------------------------------------------------
 * 把 Konva Stage 装进原来的 `.lab-bench__canvas` 里，负责所有「落位」决策：
 *   1. 边界钳制   clampPosition：器材永远在实验台内
 *   2. 吸附       snapTo：铁圈 / 焰尖 / 石棉网 / 酒精灯托底，直接调 store 的
 *                 原子操作（clampOnStand / standOnGauze）或对齐坐标
 *   3. 叠放      containerUnder：玻璃棒搅拌、石棉网垫底、容器对口倾倒
 *   4. 其余      settleY 落台面（和 HTML 版同一个重力函数）
 *
 * Step 3 / 4 起还多担一件事：整个画布只有**一个** Konva.Animation —— 推进
 * 动画时钟、30fps 重绘器材层与特效层、按 pourFlow 缓动倾倒中容器的倾角。
 * 液面波、火焰、气泡都读同一份时钟，所以它们永远在同一个节拍上。
 *
 * 器材库仍然用 @dnd-kit 拖进画布（左栏的拖拽手感不变），落点由 LabPage
 * 换算成毫米坐标后调 store.addItem；进入画布之后的移动全部交给 Konva，
 * 一次拖拽只写一次 store，所以不会出现「拖到一半被 React 重排打断」。
 */
import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useLabStore, settleY, pourAlign, mouthPoint } from '../store.js';
import useStageSize from './useStageSize.js';
import LabStage from './LabStage.jsx';
import { benchBounds, clampPosition, snapTo, containerUnder } from './geometry.js';
import { shownItem } from './liquid.js';
import { clock, scene, setFlow, eachTilt, ease, prefersReducedMotion } from './motion.js';

/* 器材层有阴影和渐变，30fps 足够顺滑；特效层不额外加帧，两层的帧永远对齐。 */
var FRAME_STEP = 1000 / 30;
/* 倾倒时瓶身最大的倾角（度）：再大液体就不像在瓶里了。 */
var POUR_TILT = 19;

export default function KonvaBench(props) {
  var hostRef = useRef(null);
  var stageRef = useRef(null);
  var size = useStageSize(hostRef, { width: 0, height: 0 });

  var items = useLabStore(function (state) {
    return state.items;
  });
  var selectedId = useLabStore(function (state) {
    return state.selectedId;
  });
  var pourFlow = useLabStore(function (state) {
    return state.pourFlow;
  });
  var moveItem = useLabStore(function (state) {
    return state.moveItem;
  });
  var selectItem = useLabStore(function (state) {
    return state.selectItem;
  });
  var clearSelection = useLabStore(function (state) {
    return state.clearSelection;
  });
  var clampOnStand = useLabStore(function (state) {
    return state.clampOnStand;
  });
  var standOnGauze = useLabStore(function (state) {
    return state.standOnGauze;
  });
  var stackGauze = useLabStore(function (state) {
    return state.stackGauze;
  });
  var stir = useLabStore(function (state) {
    return state.stir;
  });
  var lightItem = useLabStore(function (state) {
    return state.lightItem;
  });
  var startPour = useLabStore(function (state) {
    return state.startPour;
  });
  var toggleStopper = useLabStore(function (state) {
    return state.toggleStopper;
  });
  var addLog = useLabStore(function (state) {
    return state.addLog;
  });

  /* 把 Stage 交给调试端（自测脚本靠它读节点坐标，相当于 DOM 版的 data-item-id）。 */
  useEffect(
    function () {
      if (window.CL && window.CL.lab) window.CL.lab.stage = stageRef.current;
    },
    [size.width, size.height]
  );

  /* 倒液流写进场景快照：液面 / 水柱的 sceneFunc 每帧直接读，不惊动 React。 */
  useEffect(
    function () {
      setFlow(pourFlow);
    },
    [pourFlow]
  );

  /*
   * 动画引擎（Step 3 / 4）——整个画布只有这一个 Konva.Animation：
   *
   *   · 每帧推进 clock.t，液面波、火焰、气泡全部按它取时间；
   *   · 30fps 重绘器材层与特效层（掉帧时按真实时间补，不会变慢动作）；
   *   · 顺带缓动倾倒中容器的倾角：绕瓶口转 ±19°，液面反向转回来；
   *   · 页面切到后台就停，回来再续 —— 后台空转没有意义。
   *
   * 注意 Konva.Animation 的回调返回 false 时本帧不重绘，这里用它做限帧。
   */
  useEffect(
    function () {
      var stage = stageRef.current;
      if (!stage) return undefined;

      var layers = stage.getLayers();
      var anim = null;
      var reduced = prefersReducedMotion();

      /* 倾倒倾角：找出现在该转哪件、转多少，然后逐帧缓动到目标。 */
      function tiltTick() {
        var state = useLabStore.getState();
        var flow = state.pourFlow;
        var sourceId = null;
        var want = 0;

        if (flow) {
          var source = null;
          var target = null;
          state.items.forEach(function (entry) {
            if (entry.id === flow.sourceId) source = entry;
            if (entry.id === flow.targetId) target = entry;
          });

          if (source && target) {
            var from = mouthPoint(source);
            var to = mouthPoint(target);
            var dir = to.x < from.x ? -1 : 1;
            /* 前 25% 的进度用来「抬起瓶身」，之后保持满角度直到倒完 */
            var lift = Math.min(1, (flow.progress || 0) * 4);
            sourceId = flow.sourceId;
            want = dir * POUR_TILT * lift;
          }
        }

        eachTilt(function (node, id) {
          var angle = ease(node.rotation(), id === sourceId ? want : 0, 0.2);
          node.rotation(angle);
          /* 液体读这个弧度反向转：瓶子斜了，液面仍然水平 */
          scene.tilt[id] = (angle * Math.PI) / 180;
        });
      }

      /*
       * 台上有没有「正在动」的东西：有液体（液面波）、点着的火、冒气、倒液流
       * 才需要每帧重绘。空台面或只有一把铁架台时直接跳过，别白烧 CPU。
       */
      function hasMotion() {
        var state = useLabStore.getState();
        if (state.pourFlow) return true;

        for (var i = 0; i < state.items.length; i += 1) {
          var entry = state.items[i];
          if (entry.volume > 0 || entry.lit || entry.gas) return true;
        }

        var tilting = false;
        eachTilt(function (node) {
          if (Math.abs(node.rotation()) > 0.02) tilting = true;
        });

        return tilting;
      }

      function frame(frame2) {
        var elapsed = frame2.time;
        if (elapsed - clock.last < FRAME_STEP - 4) return false;

        /* 用真实时间推进：掉帧时动画变慢一点，而不是跳一段 */
        clock.t += Math.min(0.12, (elapsed - clock.last) / 1000);
        clock.last = elapsed;
        clock.frame += 1;
        clock.fps = frame2.frameRate;

        tiltTick();
        if (!hasMotion()) return false;

        clock.draws += 1;
        return true;
      }

      function start() {
        if (anim || reduced) return;
        clock.last = 0;
        clock.running = true;
        anim = new Konva.Animation(frame, layers);
        anim.start();
      }

      function stop() {
        if (!anim) return;
        anim.stop();
        anim = null;
        clock.running = false;
      }

      function onVisibility() {
        if (document.hidden) stop();
        else start();
      }

      start();
      clock.running = !!anim;
      /* 减少动态效果时也画一帧：液面 / 火焰是静止的，不是空白 */
      if (!anim) {
        tiltTick();
        stage.draw();
      }

      window.CL = window.CL || {};
      window.CL.lab = window.CL.lab || {};
      window.CL.lab.motion = {
        get t() {
          return clock.t;
        },
        get frames() {
          return clock.frame;
        },
        get draws() {
          return clock.draws;
        },
        get fps() {
          return clock.fps;
        },
        get running() {
          return clock.running;
        },
        stop: stop,
        start: start
      };

      document.addEventListener('visibilitychange', onVisibility);

      return function () {
        document.removeEventListener('visibilitychange', onVisibility);
        stop();
        if (window.CL && window.CL.lab && window.CL.lab.motion) delete window.CL.lab.motion;
      };
    },
    [size.width, size.height]
  );

  /*
   * 倾倒动画进行中：源 / 目标容器的显示体积按进度浮动（不写回 store），
   * 一次倾倒仍然只结算一次 —— 和 HTML 版的 shown 逻辑一致。
   */
  var shown =
    items.length === 0
      ? items
      : items.map(function (item) {
          return pourFlow ? shownItem(item, pourFlow) : item;
        });

  /* 一件器材松手：吸附 → 叠放 → 落台面。 */
  function handleDrop(item, x, y) {
    var state = useLabStore.getState();
    var live = null;

    state.items.forEach(function (entry) {
      if (entry.id === item.id) live = entry;
    });
    if (!live) return;

    /* 判定时把自己排除掉：否则「吸附到自己」永远成立 */
    var others = state.items.filter(function (entry) {
      return entry.id !== live.id;
    });
    var bounds = benchBounds(size.width, size.height);
    var pos = clampPosition(live.type, x, y, bounds);
    var snap = snapTo(live.type, pos.x, pos.y, others);

    if (snap) {
      if (snap.kind === 'ring') {
        clampOnStand(live.id, snap.id);
        return;
      }

      if (snap.kind === 'gauze') {
        standOnGauze(live.id, snap.id);
        return;
      }

      if (snap.kind === 'flame') {
        moveItem(live.id, snap.x, snap.y);
        addLog('操作', live.name + ' 架在火焰上。');
        return;
      }

      if (snap.kind === 'gauze-on-flame') {
        moveItem(live.id, snap.x, snap.y);
        addLog('操作', live.name + ' 架在酒精灯上。');
        return;
      }

      if (snap.kind === 'burner-seat') {
        moveItem(live.id, snap.x, snap.y);
        addLog('操作', live.name + ' 移到容器下方。');
        return;
      }
    }

    /* 压在另一件容器上：点火 / 搅拌 / 垫网 / 对口倾倒 */
    var under = containerUnder(live.type, pos.x, pos.y, others);

    if (under) {
      if (live.type === 'match' && under.type === 'burner' && !under.lit) {
        lightItem(under.id);
        moveItem(live.id, pos.x, pos.y);
        return;
      }

      if (live.type === 'rod') {
        stir(live.id, under.id);
        return;
      }

      if (live.type === 'wire-gauze') {
        stackGauze(live.id, under.id);
        return;
      }

      if (live.kind === 'container') {
        var seated = Object.assign({}, live, { x: pos.x, y: pos.y });
        if (pourAlign(seated, under).canPour) {
          moveItem(live.id, pos.x, pos.y);
          startPour(live.id, under.id);
          return;
        }
      }
    }

    /* 平地落位：交给 store 的重力函数压在台面线 / 石棉网 / 焰尖上 */
    moveItem(live.id, pos.x, settleY(live.type, pos.x, pos.y, size.height, state.items));
  }

  return (
    <div className="lab-canvas-host" ref={hostRef}>
      {size.width > 0 && size.height > 0 ? (
        <LabStage
          stageRef={stageRef}
          width={size.width}
          height={size.height}
          items={shown}
          selectedId={selectedId}
          pourFlow={pourFlow}
          subText={props.subText}
          onSelect={selectItem}
          onDeselect={clearSelection}
          onDrop={handleDrop}
          onToggleStopper={toggleStopper}
        />
      ) : null}
      {props.panel}
    </div>
  );
}
