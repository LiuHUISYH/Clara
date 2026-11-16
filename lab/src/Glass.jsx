/**
 * Glass.jsx —— 虚拟实验室的玻璃器材渲染
 * ------------------------------------------------------------------
 * 器材全部用 SVG 绘制（viewBox 0 0 80 104）。白底玻璃的做法：
 *   描边    浅灰（#c3ced2 一类），高温时整体转浅暖棕
 *   玻璃体  白色高光条 + 右缘略深的厚度渐变 + 纵向薄雾渐变
 *   内缘    edge（右侧与底部一条 rgba(0,0,0,0.13) 暗线）给出玻璃厚度
 *   底/口   base 底部椭圆内壁、mouthArc 瓶口内弧，让直口容器也有立体感
 * 液体用一条正弦波顶边的 path 填充，靠 CSS 横向漂移做出液面起伏；
 * 颜色变化通过 CSS transition 平滑过渡（0.48s），供变色反应使用。
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
  beaker: {
    body: 'M14 26 H66 V90 Q66 96 60 96 H20 Q14 96 14 90 Z',
    top: 28,
    bottom: 94,
    x: 14,
    width: 52,
    rim: 'M13.2 25.4 H66.8',
    mouthArc: 'M14.2 26.6 Q40 29.8 65.8 26.6',
    wall: 'M16.6 30 V88.4 Q16.9 93.2 20.6 93.6',
    edge: 'M64.8 28 V90.2 Q64.8 95.3 59.4 95.3',
    base: 'M20.2 92.2 Q40 96.7 59.8 92.2',
    highlight: 'M18.8 33 V86.6',
    highlightSoft: 'M61.2 35 V72',
    ticks: [
      [80, 18, 24],
      [66, 18, 24],
      [52, 18, 28],
      [38, 18, 24]
    ]
  },
  'test-tube': {
    body: 'M30 14 H50 V82 Q50 94 40 94 Q30 94 30 82 Z',
    top: 16,
    bottom: 93,
    x: 30,
    width: 20,
    mouth: { cx: 40, cy: 14.2, rx: 10.2, ry: 2.4 },
    mouthArc: 'M31.2 15.6 Q40 18.4 48.8 15.6',
    edge: 'M49.1 16.6 V81.8 Q49.1 92.7 40 92.7 Q32.2 92.7 31.6 83.4',
    base: 'M32.4 87.2 Q40 92.4 47.6 87.2',
    highlight: 'M32.8 19 V79',
    highlightSoft: 'M47.2 21 V42',
    ticks: [
      [46, 30.4, 35.4],
      [62, 30.4, 35.4]
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
   * 试剂瓶（细口瓶）：直筒瓶身 + 短颈 + 玻璃瓶塞。
   * stopper 字段里的几何同时被瓶塞图形与点击热区使用；开塞后瓶塞按 CSS
   * 抬离瓶口（见 pages.css 的 .lab-stopper--open）。
   */
  'reagent-bottle': {
    body: 'M33 30 V17 H47 V30 H55 Q59 30 59 34 V89 Q59 95.5 52.5 95.5 H27.5 Q21 95.5 21 89 V34 Q21 30 25 30 Z',
    top: 34,
    bottom: 94.5,
    x: 21,
    width: 38,
    mouth: { cx: 40, cy: 16, rx: 7, ry: 1.9 },
    mouthArc: 'M33.4 17.4 Q40 19.6 46.6 17.4',
    wall: 'M24.4 36 V87.4',
    edge: 'M58.2 36.4 V87.6 Q58.2 94.2 51.8 94.4',
    base: 'M25.4 91.4 Q40 95.4 54.6 91.4',
    highlight: 'M25.6 39 V85.6',
    highlightSoft: 'M55.4 41 V68',
    ticks: [
      [86, 50, 55],
      [74, 50, 55],
      [62, 50, 55]
    ],
    stopper: {
      plug: 'M34.7 18 L35.4 9.8 H44.6 L45.3 18 Z',
      knob: 'M40 1.4 Q44.3 1.4 44.3 5.4 Q44.3 9.4 40 9.4 Q35.7 9.4 35.7 5.4 Q35.7 1.4 40 1.4 Z',
      spec: 'M37.2 4.6 Q37.2 2.9 38.7 2.5',
      hit: { x: 31.4, y: 0.4, width: 17.2, height: 19.6 }
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

/* 一条由 segments 个波峰组成的横波，用于液面顶边。 */
function wavePath(left, right, y, crest, segments) {
  var step = (right - left) / segments;
  var d = 'M' + round(left) + ' ' + round(y);

  for (var i = 0; i < segments; i += 1) {
    d +=
      ' q' +
      round(step / 2) +
      ' ' +
      round(-crest * 2) +
      ' ' +
      round(step) +
      ' 0';
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

      {/* 液体纵深：液面下方高光、靠近底部略暗，模拟折射 */}
      <linearGradient id={prefix + '-liquid-shade'} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
        <stop offset="0.24" stopColor="#ffffff" stopOpacity="0.04" />
        <stop offset="0.7" stopColor="#0f2b33" stopOpacity="0.02" />
        <stop offset="1" stopColor="#0f2b33" stopOpacity="0.16" />
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

  return (
    <g className="lab-glass-marks" aria-hidden="true">
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

      <GlassMarks shape={shape} />
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
