/**
 * Glass.jsx —— 虚拟实验室的玻璃器材渲染
 * ------------------------------------------------------------------
 * 器材全部用 SVG 绘制（viewBox 0 0 80 104）。白底玻璃的做法：
 *   描边    统一 rgba(0,0,0,0.15)，悬停由 CSS 加深；高温时整体转浅暖棕
 *   玻璃体  GlassDefs 里的六层渐变——本体（左缘白高光 → 右缘厚度）、纵向薄雾、
 *           液体纵深、液面柔光带、液面反光斑、漫反射斑（-gloss，被 body 裁切）
 *   内缘    edge（右侧与底部一条 rgba(0,0,0,0.13) 暗线）给出玻璃厚度
 *   底/口   base 底部椭圆内壁、mouthArc 瓶口内弧，让直口容器也有立体感
 *   结构    beaker 把导流槽尖嘴写进 body 轮廓，graduations 用 <text> 印毫升数；
 *           reagent-bottle 带 neckRing 与 labelRect（BottleLabel 排白底黑字标签）
 * 液体用一条正弦波顶边的 path 填充（相邻波峰上下交替，不是锯齿），靠 CSS 横向漂移
 * 做出液面起伏；颜色变化通过 CSS transition 平滑过渡（0.48s），供变色反应使用。
 * 沉淀生成后液体再叠一层冷灰白浑浊（turbidity → lab-liquid__haze），
 * 底部沉积堆体旁撒几颗浮动颗粒；沸腾时瓶口升起模糊水蒸气（lab-steam）。
 * 几何字段（body / x / width / top / bottom）同时被液体与沉淀复用，
 * 调整时不要只改轮廓：液体高度按 top..bottom 映射。
 */
import React from 'react';

function round(value) {
  return Math.round(value * 100) / 100;
}

var GLASS = {
  /*
   * 烧杯：直筒杯身 + 右侧导流槽（倒液时看得见液体从哪边出去）+ 杯壁印刷刻度。
   * body 是裁切与描边的唯一轮廓，spout 是叠在轮廓上的外翻唇边，
   * graduations 里的毫升数用 <text> 印在杯壁左侧，和真烧杯的刻度一致。
   */
  beaker: {
    /* 右侧杯口直接收成一个尖嘴（导流槽），倒液时液体从这一侧离开杯口 */
    body:
      'M14 26.2 V90 Q14 96 20 96 H60 Q66 96 66 90 V28.6 L69.6 22.9 Q67 21.4 63.8 25.2 L63.4 26.2 H14 Z',
    top: 28.4,
    bottom: 94,
    x: 14,
    width: 52,
    spoutArc: 'M63.9 25.6 Q66.8 23.8 69 23.5',
    rim: 'M13.4 25.8 H63.6',
    mouthArc: 'M14.4 27 Q40 30.6 63.2 27',
    wall: 'M16.6 30 V88.4 Q16.9 93.2 20.6 93.6',
    edge: 'M64.8 28 V90.2 Q64.8 95.3 59.4 95.3',
    base: 'M20.2 92.2 Q40 96.7 59.8 92.2',
    highlight: 'M18.8 33 V86.6',
    highlightSoft: 'M61.2 35 V72',
    gloss: { cx: 23.4, cy: 62, rx: 8.6, ry: 26 },
    graduations: [
      { y: 34, text: '200', x1: 16.8, x2: 23.6, tx: 25.4, anchor: 'start' },
      { y: 48, text: '150', x1: 16.8, x2: 23.6, tx: 25.4, anchor: 'start' },
      { y: 62, text: '100', x1: 16.8, x2: 23.6, tx: 25.4, anchor: 'start' },
      { y: 76, text: '50', x1: 16.8, x2: 23.6, tx: 25.4, anchor: 'start' }
    ],
    ticks: [
      [41, 16.8, 20.4],
      [55, 16.8, 20.4],
      [69, 16.8, 20.4]
    ]
  },
  'test-tube': {
    body: 'M30.6 14 H49.4 V78 Q49.4 94 40 94 Q30.6 94 30.6 78 Z',
    top: 16,
    bottom: 93,
    x: 30.6,
    width: 18.8,
    mouth: { cx: 40, cy: 14.2, rx: 9.4, ry: 2.2 },
    rim: 'M30.2 13.6 H49.8',
    mouthArc: 'M31 16 Q40 19 49 16',
    edge: 'M48.4 17.4 V77.6 Q48.4 92.6 40 92.6 Q33.4 92.6 32.2 81',
    base: 'M36 92.8 Q40 94.6 44 92.8',
    highlight: 'M33 19.6 V77',
    highlightSoft: 'M46.8 21 V44',
    gloss: { cx: 34.4, cy: 58, rx: 3.2, ry: 24 },
    graduations: [
      { y: 40, text: '15', x1: 31.2, x2: 35.2, tx: 36.6, anchor: 'start' },
      { y: 55, text: '10', x1: 31.2, x2: 35.2, tx: 36.6, anchor: 'start' },
      { y: 70, text: '5', x1: 31.2, x2: 35.2, tx: 36.6, anchor: 'start' }
    ],
    ticks: [
      [47.5, 31.2, 33.6],
      [62.5, 31.2, 33.6]
    ]
  },
  erlenmeyer: {
    body: 'M34 14 H46 V34 L62 88 Q64 94 58 94 H22 Q16 94 18 88 L34 34 Z',
    top: 38,
    bottom: 93,
    x: 18,
    width: 44,
    mouth: { cx: 40, cy: 14, rx: 6.2, ry: 2 },
    neckHighlight: 'M36.6 18.6 V29.4',
    highlight: 'M25.4 84 Q30.2 64 34.4 44',
    highlightSoft: 'M57.8 86 Q52 68 46.4 46',
    edge: 'M59.8 84.4 Q62.6 91.6 56.6 93',
    base: 'M23.4 89.4 Q40 94.4 56.6 89.4',
    ticks: [
      [52, 30, 36],
      [60, 28, 34]
    ]
  },
  'round-flask': {
    body: 'M34 14 H46 V30 C48.4 30.8 51 32.8 53.4 36 C60.4 45.6 66.4 52.6 66.4 62.6 C66.4 80.4 55 94 40 94 C25 94 13.6 80.4 13.6 62.6 C13.6 52.6 19.6 45.6 26.6 36 C29 32.8 31.6 30.8 34 30 Z',
    top: 38,
    bottom: 93,
    x: 12,
    width: 56,
    mouth: { cx: 40, cy: 14, rx: 6.2, ry: 2 },
    neckHighlight: 'M36.6 18.4 V28.6',
    highlight: 'M21.4 70 Q21.8 52 28.6 40.4',
    highlightSoft: 'M59.4 62 Q58.4 48 49.6 40.4',
    edge: 'M63.8 70 Q62.6 84.4 51.4 91.2',
    base: 'M27.4 87.6 Q40 93.4 52.6 87.6'
  },
  'volumetric-flask': {
    body: 'M34 14 H46 V30 C58 34 64 44 64 58 C64 80 53 94 40 94 C27 94 16 80 16 58 C16 44 22 34 34 30 Z',
    top: 34,
    bottom: 93,
    x: 16,
    width: 48,
    mouth: { cx: 40, cy: 14, rx: 6.2, ry: 2 },
    neckHighlight: 'M36.6 18.4 V27.6',
    highlight: 'M23 60 Q25 46 34.6 39.2',
    highlightSoft: 'M56.6 62 Q54.6 48 46 40.4',
    edge: 'M60.6 62 Q59.4 80 48.6 89',
    base: 'M28.6 86.2 Q40 92 51.4 86.2',
    mark: 'M28.6 62 Q40 65 51.4 62'
  },
  /*
   * 试剂瓶（细口瓶）：圆肩瓶身 + 短颈 + 玻璃瓶塞 + 白底黑字标签。
   * labelRect / labelBand 是标签纸的几何，标签文字由 BottleLabel 按 item.label
   * 逐行排（名称 / 化学式 / 等级 / 净含量）；没有 label 的空瓶留一张空白标签。
   * stopper 字段里的几何同时被瓶塞图形与点击热区使用；开塞后瓶塞按 CSS
   * 抬离瓶口（见 pages.css 的 .lab-stopper--open）。
   */
  'reagent-bottle': {
    body: 'M34 30 V18 Q34 14.6 37.4 14.6 H42.6 Q46 14.6 46 18 V30 Q52 31.8 55.4 35.2 Q59 39 59 45.4 V89 Q59 96 52 96 H28 Q21 96 21 89 V45.4 Q21 39 24.6 35.2 Q28 31.8 34 30 Z',
    top: 37,
    bottom: 95,
    x: 21,
    width: 38,
    mouth: { cx: 40, cy: 14.4, rx: 6.2, ry: 1.8 },
    neckRing: 'M33.6 16.6 H46.4',
    mouthArc: 'M34 16 Q40 18.2 46 16',
    wall: 'M23.6 47 V89.6',
    edge: 'M57.6 47 V88 Q57.6 94.6 51.6 94.8',
    base: 'M25.6 91.4 Q40 95.6 54.4 91.4',
    highlight: 'M24.8 49 V86',
    highlightSoft: 'M55 51 V70',
    gloss: { cx: 27.4, cy: 72, rx: 4.4, ry: 20 },
    ticks: [],
    labelRect: { x: 25.2, y: 52, width: 29.6, height: 26.4 },
    labelBand: { x: 25.2, y: 52, width: 29.6, height: 2.2 },
    stopper: {
      plug: 'M34.2 15.8 L35 8.8 H45 L45.8 15.8 Z',
      knob: 'M40 1 Q44.6 1 44.6 5.2 Q44.6 9.4 40 9.4 Q35.4 9.4 35.4 5.2 Q35.4 1 40 1 Z',
      spec: 'M37 4.4 Q37 2.7 38.6 2.4',
      hit: { x: 31, y: 0.2, width: 18, height: 18.8 }
    }
  }
};

var SOLID_COLORS = {
  Fe: '#686760',
  Cu: '#ad6d4f',
  Zn: '#969c9b',
  Mg: '#b2b2a8',
  CaCO3: '#c9c5b7'
};

function liquidHeight(item, shape) {
  if (!item.capacity || !item.volume) return 0;
  var ratio = Math.max(0, Math.min(1, item.volume / item.capacity));
  if (ratio === 0) return 0;
  /* 体积→高度用 0.75 次幂：10 mL 在 250 mL 烧杯里也看得见，高低仍随体积单调变化。
     最薄一层留 8px，少体积液体才不会缩成一条看不出颜色的细线。 */
  return Math.max(8, (shape.bottom - shape.top) * Math.pow(ratio, 0.75));
}

/* 一条由 segments 个波峰组成的横波，用于液面顶边；相邻波峰上下交替，才是一条平滑的波。 */
function wavePath(left, right, y, crest, segments) {
  var step = (right - left) / segments;
  var d = 'M' + round(left) + ' ' + round(y);

  for (var i = 0; i < segments; i += 1) {
    var lift = i % 2 === 0 ? -crest * 2 : crest * 2;
    d += ' q' + round(step / 2) + ' ' + round(lift) + ' ' + round(step) + ' 0';
  }

  return d;
}

/* 每件器材独立一套渐变与裁切，避免同页多件器材 id 冲突。 */
function GlassDefs(props) {
  var prefix = props.prefix;

  return (
    <defs>
      <clipPath id={prefix + '-clip'}>
        <path d={props.shape.body} />
      </clipPath>

      {/* 玻璃本体：左缘一条白色高光 → 中部近乎透明 → 右缘略深的玻璃厚度 */}
      <linearGradient id={prefix + '-glass'} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.58" />
        <stop offset="0.05" stopColor="#ffffff" stopOpacity="0.95" />
        <stop offset="0.16" stopColor="#ffffff" stopOpacity="0.3" />
        <stop offset="0.52" stopColor="#ffffff" stopOpacity="0.06" />
        <stop offset="0.86" stopColor="currentColor" stopOpacity="0.16" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.46" />
      </linearGradient>

      {/* 纵向薄雾：顶部略亮、底部略沉，白底容器才有体积感 */}
      <linearGradient id={prefix + '-veil'} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
        <stop offset="0.14" stopColor="#ffffff" stopOpacity="0.1" />
        <stop offset="0.58" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.88" stopColor="#111827" stopOpacity="0.03" />
        <stop offset="1" stopColor="#111827" stopOpacity="0.09" />
      </linearGradient>

      {/* 液体纵深：液面下方高光、靠近底部略暗，模拟折射（无色液体靠这层冷调读出「有液体」） */}
      <linearGradient id={prefix + '-liquid-shade'} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
        <stop offset="0.22" stopColor="#ffffff" stopOpacity="0.03" />
        <stop offset="0.62" stopColor="#8fb0bd" stopOpacity="0.08" />
        <stop offset="1" stopColor="#6f93a0" stopOpacity="0.2" />
      </linearGradient>

      {/* 液面正下方的一层柔光：液体不是一块平涂色，靠它做出「有厚度」的感觉 */}
      <linearGradient id={prefix + '-liquid-top'} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.42" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.08" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>

      {/* 液面中央的反光斑 */}
      <radialGradient id={prefix + '-sheen'} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>

      {/* 玻璃上的柔和反光：横向的漫反射让直筒看起来是弧面 */}
      <radialGradient id={prefix + '-gloss'} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.78" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.2" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>

      {/* 标签纸：米白纸浆质感，边缘略暗 */}
      <linearGradient id={prefix + '-label'} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.55" stopColor="#faf9f3" />
        <stop offset="1" stopColor="#eeece3" />
      </linearGradient>
    </defs>
  );
}

/* 液体：波浪顶边 + 玻璃内腔裁切 + 缓慢横向漂移；沉淀越多，叠一层白色浑浊。 */
function LiquidLayer(props) {
  var shape = props.shape;
  var height = props.height;
  if (height <= 0) return null;

  var surface = shape.bottom - height;
  var crest = Math.max(0.6, Math.min(1.8, height * 0.14));
  var left = shape.x - 30;
  var right = shape.x + shape.width + 30;
  var wave = wavePath(left, right, surface, crest, 12);
  var body = wave + ' V' + round(shape.bottom + 8) + ' H' + round(left) + ' Z';
  var haze = Math.max(0, Math.min(0.86, props.turbidity || 0));

  return (
    <g clipPath={'url(#' + props.clipId + ')'} className="lab-liquid" aria-hidden="true">
      <g className="lab-liquid__wave">
        <path className="lab-liquid__fill" d={body} fill={props.color || '#e2ecef'} />
        {/* 悬浮固体把液体变浑：白色雾层的不透明度跟着固含量平滑过渡 */}
        {haze > 0 ? (
          <path className="lab-liquid__haze" d={body} style={{ opacity: haze }} />
        ) : null}
        <path className="lab-liquid__shade" d={body} fill={'url(#' + props.prefix + '-liquid-shade)'} />
        {/* 液面下的一层柔光：液体有纵深感，不是一块平涂色 */}
        <rect
          className="lab-liquid__top"
          x={round(shape.x - 4)}
          y={round(surface)}
          width={round(shape.width + 8)}
          height={round(Math.min(18, height))}
          fill={'url(#' + props.prefix + '-liquid-top)'}
        />
        <ellipse
          className="lab-liquid__sheen"
          cx={round(shape.x + shape.width / 2)}
          cy={round(surface + 2.6)}
          rx={round(Math.max(3, shape.width / 2 - 1.4))}
          ry={round(Math.min(3.4, Math.max(1.6, height * 0.16)))}
          fill={'url(#' + props.prefix + '-sheen)'}
        />
        <path className="lab-liquid__meniscus" d={wave} />
        <path className="lab-liquid__meniscus-shade" d={wave} transform="translate(0 1.2)" />
      </g>
    </g>
  );
}

/*
 * 沉淀：按质量画成容器底部的弧形堆积，颜色取自物质表。
 * 堆体之外再撒几颗更小的颗粒（lab-solid-mote）：絮状沉淀一团一团的质感，
 * 而不是一块干净的色块；堆体高度也压得比液体浅，避免超过真实液面。
 */
function SolidMarks(props) {
  var solids = props.contents.filter(function (entry) {
    return entry.state === 'solid';
  });
  if (solids.length === 0) return null;

  var shape = props.shape;
  var centre = shape.x + shape.width / 2;

  return (
    <g clipPath={'url(#' + props.clipId + ')'} className="lab-solid-group" aria-hidden="true">
      {solids.map(function (entry, index) {
        var mass = entry.mass || 1;
        var color = entry.color || SOLID_COLORS[entry.chemical] || '#8e8b81';
        var width = Math.max(10, Math.min(shape.width - 6, 10 + mass * 4.5));
        /* 堆积高度随质量增长，但不超过底宽的 26%，不会在细试管里堆成尖锥 */
        var rise = Math.max(2.4, Math.min(width * 0.26, 2.4 + mass * 1.1));
        var offset = solids.length > 1 ? (index - (solids.length - 1) / 2) * 6 : 0;
        var left = centre - width / 2 + offset;
        var right = left + width;
        var motes = [];

        for (var m = 0; m < 5; m += 1) {
          motes.push(
            <circle
              className="lab-solid-mote"
              key={'mote-' + m}
              cx={round(left + width * ((m + 0.5) / 5))}
              cy={round(shape.bottom - rise * (0.5 + (m % 3) * 0.45))}
              r={round(0.8 + (m % 3) * 0.35)}
              fill={color}
              style={{ animationDelay: (m * 0.55 + index * 0.3).toFixed(1) + 's' }}
            />
          );
        }

        return (
          <g key={entry.chemical + '-' + index}>
            <path
              className="lab-solid"
              d={
                'M' +
                left +
                ' ' +
                shape.bottom +
                ' Q' +
                (left + width / 2) +
                ' ' +
                (shape.bottom - rise * 2) +
                ' ' +
                right +
                ' ' +
                shape.bottom +
                ' Z'
              }
              fill={color}
            />
            {motes}
          </g>
        );
      })}
    </g>
  );
}

/*
 * 放气 / 沸腾现象：液面下升起一组气泡，CSS 负责漂浮动画。
 * 气泡数量由 store 的 gasTimes（同一次操作里规则触发次数）决定 —— 反应越剧烈
 * 气泡越密；沸腾时在此基础上再加密、加速（lab-bubbles--boil），一眼能分出
 * 「在冒气」和「水开了」。
 */
function Bubbles(props) {
  var shape = props.shape;
  var height = props.height;
  var boiling = !!props.boiling;
  var count = Math.max(3, Math.min(10, props.count || 5));
  var rise = Math.max(6, Math.min(28, height - 6));
  var bubbles = [];

  for (var index = 0; index < count; index += 1) {
    var cx = shape.x + shape.width * (0.14 + (index % 4) * 0.24) + (index % 2 ? 1.6 : -1.2);
    var radius = boiling ? 1.6 + (index % 3) * 0.5 : 1.4 + (index % 3) * 0.45;

    bubbles.push(
      <circle
        className="lab-bubble"
        key={index}
        cx={round(cx)}
        cy={shape.bottom - 3}
        r={round(radius)}
        style={{
          animationDelay: (boiling ? index * 0.12 : index * 0.32).toFixed(2) + 's',
          '--lab-rise': '-' + rise + 'px'
        }}
      />
    );
  }

  return (
    <g
      clipPath={'url(#' + props.clipId + ')'}
      className={'lab-bubbles' + (boiling ? ' lab-bubbles--boil' : '')}
      aria-hidden="true"
    >
      {bubbles}
    </g>
  );
}

/*
 * 水蒸气：沸腾时从瓶口飘出的白色雾团（不受玻璃裁切，可以越过器物轮廓）。
 * 每组雾团的大小 / 横向漂移 / 延迟都写在内联 CSS 变量里，动画在 pages.css，
 * 统一用 blur 做出「模糊白雾」，避免和气泡混淆。
 */
function Steam(props) {
  var shape = props.shape;
  var mouthY = shape.mouth ? shape.mouth.cy : shape.top;
  var mouthX = shape.mouth ? shape.mouth.cx : shape.x + shape.width / 2;
  var puffs = [];

  for (var index = 0; index < 5; index += 1) {
    puffs.push(
      <circle
        className="lab-steam"
        key={index}
        cx={round(mouthX + (index - 2) * 4.2)}
        cy={round(mouthY - 2)}
        r={round(4 + (index % 3) * 1.3)}
        style={{
          animationDelay: (index * 0.42).toFixed(2) + 's',
          '--lab-drift': (index % 2 ? 1 : -1) * (2 + index) + 'px'
        }}
      />
    );
  }

  return (
    <g className="lab-steam-group" aria-hidden="true">
      {puffs}
    </g>
  );
}

/* 玻璃细节：内缘厚度、内壁、高光、刻度、瓶口。画在液体之上，像玻璃挡在液体前面。 */
function GlassMarks(props) {
  var shape = props.shape;
  var ticks = shape.ticks || [];
  var graduations = shape.graduations || [];

  return (
    <g className="lab-glass-marks" aria-hidden="true">
      {/* 导流槽（烧杯唇边）：先铺一层玻璃色，再压一条内侧弧线 */}
      {shape.spout ? (
        <path
          className="lab-glass__spout"
          d={shape.spout}
          fill={'url(#' + props.prefix + '-glass)'}
        />
      ) : null}
      {shape.spoutArc ? <path className="lab-glass__spout-arc" d={shape.spoutArc} /> : null}
      {shape.wall ? <path className="lab-glass__wall" d={shape.wall} /> : null}
      {shape.edge ? <path className="lab-glass__edge" d={shape.edge} /> : null}
      {shape.base ? <path className="lab-glass__base" d={shape.base} /> : null}
      {shape.highlight ? <path className="lab-glass__specular" d={shape.highlight} /> : null}
      {shape.highlightSoft ? (
        <path className="lab-glass__specular lab-glass__specular--soft" d={shape.highlightSoft} />
      ) : null}
      {shape.neckHighlight ? (
        <path className="lab-glass__specular lab-glass__specular--soft" d={shape.neckHighlight} />
      ) : null}
      {/* 印刷刻度：短线 + 毫升数，像真器材上的丝印 */}
      {graduations.map(function (grad, index) {
        return (
          <g className="lab-glass__grad" key={'grad-' + index}>
            <path d={'M' + grad.x1 + ' ' + grad.y + ' H' + grad.x2} />
            <text x={grad.tx} y={round(grad.y + 1.1)} textAnchor={grad.anchor}>
              {grad.text}
            </text>
          </g>
        );
      })}
      {ticks.map(function (tick, index) {
        return (
          <path
            className="lab-glass__tick"
            key={'tick-' + index}
            d={'M' + tick[1] + ' ' + tick[0] + ' H' + tick[2]}
          />
        );
      })}
      {shape.mark ? <path className="lab-glass__mark" d={shape.mark} /> : null}
      {shape.neckRing ? <path className="lab-glass__rim" d={shape.neckRing} /> : null}
      {shape.mouth ? (
        <ellipse
          className="lab-glass__mouth"
          cx={shape.mouth.cx}
          cy={shape.mouth.cy}
          rx={shape.mouth.rx}
          ry={shape.mouth.ry}
        />
      ) : null}
      {shape.mouthArc ? <path className="lab-glass__mouth-arc" d={shape.mouthArc} /> : null}
      {shape.rim ? <path className="lab-glass__rim" d={shape.rim} /> : null}
      {shape.lip ? <path className="lab-glass__lip" d={shape.lip} /> : null}
    </g>
  );
}

/*
 * 玻璃表面的漫反射反光斑：一块被瓶身裁切的柔和白光。
 * 直筒玻璃只靠描边会显得很「线框」，这一层把它压成有弧面的玻璃。
 */
function GlossOverlay(props) {
  var gloss = props.shape.gloss;
  if (!gloss) return null;

  return (
    <g clipPath={'url(#' + props.clipId + ')'} className="lab-glass__gloss" aria-hidden="true">
      <ellipse
        cx={gloss.cx}
        cy={gloss.cy}
        rx={gloss.rx}
        ry={gloss.ry}
        fill={'url(#' + props.prefix + '-gloss)'}
      />
    </g>
  );
}

/*
 * 瓶身标签：白纸底 + 黑色印刷字（名称 / 化学式 / 等级 / 净含量）。
 * 预置试剂瓶带 item.label；空细口瓶留一张空白标签（只有纸、色带与两条横线），
 * 和实验台上「还没贴标签的空瓶」一致。文字用 viewBox 坐标排，缩放后不会跑位。
 */
function BottleLabel(props) {
  var shape = props.shape;
  var rect = shape.labelRect;
  if (!rect) return null;

  var info = props.label || null;
  var band = shape.labelBand;
  var cx = round(rect.x + rect.width / 2);

  return (
    <g className="lab-label" aria-hidden="true">
      <rect
        className="lab-label__paper"
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx="0.7"
        fill={'url(#' + props.prefix + '-label)'}
      />
      {band ? (
        <rect
          className="lab-label__band"
          x={band.x}
          y={band.y}
          width={band.width}
          height={band.height}
          style={info && info.band ? { fill: info.band } : undefined}
        />
      ) : null}
      {info ? (
        <g className="lab-label__text">
          <text className="lab-label__title" x={cx} y={round(rect.y + 8.8)} textAnchor="middle">
            {info.title}
          </text>
          <text className="lab-label__formula" x={cx} y={round(rect.y + 14.2)} textAnchor="middle">
            {info.formula}
          </text>
          <path
            className="lab-label__rule"
            d={
              'M' +
              round(rect.x + 3.6) +
              ' ' +
              round(rect.y + 16.6) +
              ' H' +
              round(rect.x + rect.width - 3.6)
            }
          />
          <text className="lab-label__meta" x={cx} y={round(rect.y + 20.4)} textAnchor="middle">
            {info.grade}
          </text>
          <text
            className="lab-label__volume"
            x={round(rect.x + rect.width - 2.2)}
            y={round(rect.y + rect.height - 2.2)}
            textAnchor="end"
          >
            {info.volume}
          </text>
        </g>
      ) : (
        <path
          className="lab-label__blank"
          d={
            'M' +
            round(rect.x + 4) +
            ' ' +
            round(rect.y + 9) +
            ' H' +
            round(rect.x + rect.width - 4) +
            ' M' +
            round(rect.x + 4) +
            ' ' +
            round(rect.y + 15) +
            ' H' +
            round(rect.x + rect.width - 4) +
            ' M' +
            round(rect.x + 4) +
            ' ' +
            round(rect.y + 21) +
            ' H' +
            round(rect.x + rect.width - 11)
          }
        />
      )}
    </g>
  );
}

/*
 * 瓶塞：玻璃塞头 + 塞芯，点击即可开合（onToggleStopper 由页面传入）。
 * 热区是一块透明 rect，pointerdown 阻止冒泡 —— 否则拨塞子的动作会被 dnd-kit
 * 当成一次拖拽。开塞后瓶塞抬离瓶口，位置由 pages.css 的 transform 过渡完成。
 */
function Stopper(props) {
  var stopper = props.shape.stopper;
  var toggle = props.onToggle;

  return (
    <g
      className={'lab-stopper' + (props.open ? ' lab-stopper--open' : '')}
      aria-label={props.open ? '塞上瓶塞' : '打开瓶塞'}
      role={toggle ? 'button' : undefined}
      onPointerDown={
        toggle
          ? function (event) {
              event.stopPropagation();
            }
          : undefined
      }
      onClick={
        toggle
          ? function (event) {
              event.stopPropagation();
              toggle();
            }
          : undefined
      }
    >
      <path className="lab-stopper__plug" d={stopper.plug} />
      <path className="lab-stopper__knob" d={stopper.knob} />
      <path className="lab-stopper__spec" d={stopper.spec} />
      <rect
        className="lab-stopper__hit"
        x={stopper.hit.x}
        y={stopper.hit.y}
        width={stopper.hit.width}
        height={stopper.hit.height}
      />
    </g>
  );
}

export function ContainerGraphic(props) {
  var item = props.item;
  var shape = GLASS[item.type] || GLASS.beaker;
  /* 拖拽幽灵会和台上的原件同时存在，用 suffix 让人造 id 不重复 */
  var prefix = 'lab-' + item.id + (props.suffix || '');
  var clipId = prefix + '-clip';
  var height = liquidHeight(item, shape);

  return (
    <svg className="lab-vessel__svg" viewBox="0 0 80 104" aria-hidden="true" focusable="false">
      <GlassDefs prefix={prefix} shape={shape} />

      {/* 玻璃本体：半透明填充，让后面的液面隐约透出玻璃厚度 */}
      <path className="lab-glass__fill" d={shape.body} fill={'url(#' + prefix + '-glass)'} />

      <LiquidLayer
        shape={shape}
        height={height}
        color={item.color}
        turbidity={item.turbidity}
        clipId={clipId}
        prefix={prefix}
      />

      {/* 放气或沸腾时从液面升起气泡；沸腾的气泡更多更密（lab-bubbles--boil）。 */}
      {item.gas || item.boiling ? (
        <Bubbles
          shape={shape}
          height={height}
          clipId={clipId}
          boiling={!!item.boiling}
          count={item.boiling ? 9 : Math.min(10, 4 + (item.gasTimes || 0) * 2)}
        />
      ) : null}
      <SolidMarks contents={item.contents} shape={shape} clipId={clipId} />

      {/* 纵向薄雾压在液体上：玻璃挡在前面，液体颜色略被提亮 */}
      <path className="lab-glass__veil" d={shape.body} fill={'url(#' + prefix + '-veil)'} />

      {/* 瓶身标签贴在玻璃内侧，玻璃边缘与反光会压在标签之上 */}
      <BottleLabel shape={shape} label={item.label} prefix={prefix} />

      <GlassMarks shape={shape} prefix={prefix} />
      <GlossOverlay shape={shape} prefix={prefix} clipId={clipId} />
      <path className="lab-glass" d={shape.body} />
      {/* 水蒸气画在玻璃之上：沸腾的雾气会越过器物轮廓继续上升 */}
      {item.boiling && height > 0 ? <Steam shape={shape} /> : null}
      {shape.stopper ? (
        <Stopper
          shape={shape}
          open={!!item.open}
          onToggle={props.onToggleStopper}
        />
      ) : null}
    </svg>
  );
}
