/**
 * motion.js —— Canvas 动画时钟（Step 3 / Step 4 的时间源）
 * ------------------------------------------------------------------
 * 为什么单独抽一个模块：Konva 的 `sceneFunc` 只在 **绘制** 时被调用，
 * 如果液面波、火焰、气泡靠 React state 驱动，就要每秒 30 次重渲染整棵树，
 * 反而比画布本身贵得多。这里的约定反过来：
 *
 *   · React 只负责把「静态结构」画进画布（一次）；
 *   · 每帧变化的部分在 sceneFunc 里直接读 `clock.t` / `scene.*`；
 *   · KonvaBench 里一个 `Konva.Animation` 每帧推进 clock 并重绘两层。
 *
 * 于是动画不产生任何 React 渲染，掉帧也不会写坏状态：clock.t 始终按真实
 * 时间累加（单帧最多 0.1s），暂停后继续播放也不会跳变。
 *
 * `scene` 是一份可变快照（倒液流、每件器材的倾角），由动画循环写入；
 * sceneFunc 读它 —— 不订阅 store，就不会在绘制过程中触发 React 更新。
 */

/* 时钟：t 秒、frame 帧序号、draws 真正重绘的次数、last 上次重绘时间（ms）。 */
export var clock = { t: 0, frame: 0, draws: 0, last: 0, fps: 0, running: false };

/* 场景快照：动画循环写的、sceneFunc 读的「此刻画面」。
 *   flow    当前 pourFlow（倒液流用它决定起点 / 落点）
 *   tilt    { itemId: 弧度 } —— 倾倒中的容器，液体要反向转回来保持水平
 */
export var scene = { flow: null, tilt: {} };

export function setFlow(flow) {
  scene.flow = flow || null;
}

/* 画布上的「现在」，单位秒。 */
export function time() {
  return clock.t;
}

/* 系统是否要求减少动态效果：是的话不起动画，画面停在第一帧。 */
export function prefersReducedMotion() {
  return !!(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/*
 * 确定性伪随机：同一件器材的气泡 / 火焰抖动每帧都一致。
 * 用 id 算种子（不随机的随机），用序号取样 —— 刷新页面也长得一样。
 */
export function hashSeed(text) {
  var value = String(text === undefined || text === null ? '' : text);
  var seed = 7;
  for (var i = 0; i < value.length; i += 1) {
    seed = (seed * 31 + value.charCodeAt(i)) % 100003;
  }
  return seed;
}

export function noise(seed, index) {
  var x = Math.sin(seed * 0.0173 + index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/* 小数部分：气泡进度靠它自然循环（0→1→0），不会计数溢出。 */
export function fract(value) {
  return value - Math.floor(value);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* 指数缓动：每帧向目标靠拢 rate，末段吸附，避免永远差一点点。 */
export function ease(current, target, rate) {
  var next = current + (target - current) * rate;
  return Math.abs(target - next) < 0.05 ? target : next;
}

/*
 * 倾倒旋转登记表：器材节点挂载时把「内层 Group」登记进来，
 * 动画循环按 store 的 pourFlow 逐帧缓动它的 rotation。
 * 用登记表而不是每帧 stage.findOne('#item-…')：一帧最多两件在转，
 * 查询字符串攒起来也是开销。
 */
var tiltNodes = {};

export function bindTilt(id, node, lip) {
  if (!node) {
    delete tiltNodes[id];
    delete scene.tilt[id];
    return;
  }

  tiltNodes[id] = node;
  /* 绕瓶口旋转：offset 与 position 都设成瓶口坐标，转动时瓶口钉在原地。 */
  if (lip) {
    node.offset({ x: lip.x, y: lip.y });
    node.position({ x: lip.x, y: lip.y });
  }
}

export function eachTilt(visit) {
  Object.keys(tiltNodes).forEach(function (id) {
    visit(tiltNodes[id], id);
  });
}
