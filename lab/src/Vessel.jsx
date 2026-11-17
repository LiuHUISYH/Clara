/**
 * Vessel.jsx —— 虚拟实验室的器材出口：容器交给 Glass.jsx，工具在这里画
 * ------------------------------------------------------------------
 * 容器（烧杯 / 试管 / 锥形瓶 / 圆底烧瓶 / 容量瓶 / 试剂瓶）是玻璃仪器 + 液体 +
 * 沉淀，统一由 Glass.jsx 用 SVG 绘制；本文件画酒精灯（玻璃灯体 + 灯帽 + 三层
 * 火焰）、火柴（梗 + 火柴头 + 划燃后的小火苗）与铁架台、玻璃棒、胶头滴管、
 * 石棉网、pH 试纸，并提供 LabGraphic 出口。
 *
 * 工具与容器共用 art.js 的毫米基准：酒精灯 80×118、铁架台 200×560、
 * 石棉网 120×10、玻璃棒 10×240、胶头滴管 24×112 —— 每件 svg 的 viewBox
 * 就是它自己的真实尺寸，并排放在台面上时比例是对的（铁架台比烧杯高五倍多）。
 * 白底玻璃 / 金属统一走「浅灰描边 + 白色高光 + 右缘厚度」的做法，不引入深色。
 */
import React from 'react';
import { ContainerGraphic } from './Glass';
import { TOOLS } from './art';

function BurnerDefs(props) {
  var prefix = props.prefix;

  return (
    <defs>
      {/* 灯体玻璃：白底上靠左侧高光与右缘厚度勾勒瓶身 */}
      <linearGradient id={prefix + '-body'} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.62" />
        <stop offset="0.06" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="0.2" stopColor="#ffffff" stopOpacity="0.26" />
        <stop offset="0.62" stopColor="#ffffff" stopOpacity="0.04" />
        <stop offset="0.88" stopColor="#9aa7ad" stopOpacity="0.16" />
        <stop offset="1" stopColor="#9aa7ad" stopOpacity="0.42" />
      </linearGradient>

      {/* 灯芯管与灯帽的金属拉丝：上亮下暗 */}
      <linearGradient id={prefix + '-metal'} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#dfe5e8" />
        <stop offset="0.18" stopColor="#f6f8f9" />
        <stop offset="0.52" stopColor="#e6eaec" />
        <stop offset="1" stopColor="#c6cfd3" />
      </linearGradient>

      {/* 火焰底部的克制光晕 */}
      <radialGradient id={prefix + '-glow'} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#f0b064" stopOpacity="0.22" />
        <stop offset="0.55" stopColor="#f0b064" stopOpacity="0.12" />
        <stop offset="1" stopColor="#f0b064" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/*
 * 酒精灯：φ72 玻璃灯体（含酒精液面）+ 金属灯芯管 + 灯芯 + 可移除灯帽。
 * 未点燃时灯帽扣在灯芯管上；点燃后灯帽平移到灯旁台面（CSS transform 过渡），
 * 火焰由外焰 / 中焰 / 焰心三层 SVG 路径叠加而成，动画在 pages.css。
 * 焰尖 y=8、焰心 x=40 —— store 的 inFlame 判定读的就是这两个数。
 */
function BurnerGraphic(props) {
  var prefix = props.prefix;
  var lit = !!props.lit;

  return (
    <g className="lab-burner">
      <BurnerDefs prefix={prefix} />

      {/* 台面上的接触阴影 */}
      <ellipse className="lab-burner__shadow" cx="40" cy="114.4" rx="34" ry="2.8" />

      {/* 灯体玻璃 φ72 */}
      <path
        className="lab-burner__body"
        d="M6.4 112 Q4.6 82 22.4 62 Q26 58 26 54.4 H54 Q54 58 57.6 62 Q75.4 82 73.6 112 Z"
        fill={'url(#' + prefix + '-body)'}
      />

      {/* 灯内酒精：液面带一点起伏，底部略暗 */}
      <path
        className="lab-burner__alcohol"
        d="M9.6 94 Q40 98 70.4 94 L72 108.4 Q40 113 8 108.4 Z"
      />

      {/* 瓶身轮廓与内壁高光 */}
      <path
        className="lab-burner__outline"
        d="M6.4 112 Q4.6 82 22.4 62 Q26 58 26 54.4 M54 54.4 Q54 58 57.6 62 Q75.4 82 73.6 112"
      />
      <path className="lab-burner__specular" d="M12 106 Q10.6 84 22 66 Q26 60 26 57" />
      <path className="lab-burner__specular lab-burner__specular--soft" d="M68 104 Q68.6 84 58 64" />

      {/* 灯芯管 */}
      <path className="lab-burner__collar" d="M28 54.6 H52 V50.8 H28 Z" fill={'url(#' + prefix + '-metal)'} />
      <path className="lab-burner__collar" d="M32 50.8 H48 V44.6 H32 Z" fill={'url(#' + prefix + '-metal)'} />
      <path className="lab-burner__collar-line" d="M28 52.8 H52" />
      <path className="lab-burner__collar-line" d="M32 47.8 H48" />

      {/* 灯芯：未点燃时露出一小截 */}
      <path className="lab-burner__wick" d="M37.4 44.6 H42.6 V39.4 H37.4 Z" />

      {lit ? (
        <g className={'lab-flame' + (props.inUse ? ' lab-flame--in-use' : '')} aria-hidden="true">
          <ellipse
            className="lab-flame__glow"
            cx="40"
            cy="37"
            rx="15"
            ry="4.4"
            fill={'url(#' + prefix + '-glow)'}
          />
          <path
            className="lab-flame__outer"
            d="M40 8 C43.8 16.4 48.4 24.6 48.4 32.4 C48.4 36.6 44.8 39.2 40 39.2 C35.2 39.2 31.6 36.6 31.6 32.4 C31.6 24.6 36.2 16.4 40 8 Z"
          />
          <path
            className="lab-flame__mid"
            d="M40 17.6 C42.4 23.4 44.8 28 44.8 31.8 C44.8 34.6 42.6 36.8 40 36.8 C37.4 36.8 35.2 34.6 35.2 31.8 C35.2 28 37.6 23.4 40 17.6 Z"
          />
          <path
            className="lab-flame__core"
            d="M40 27.4 C41.4 30.6 42.6 32.8 42.6 34.6 C42.6 36 41.4 37 40 37 C38.6 37 37.4 36 37.4 34.6 C37.4 32.8 38.6 30.6 40 27.4 Z"
          />
        </g>
      ) : null}

      {/* 灯帽：点燃后移到灯旁台面上 */}
      <g className={'lab-burner__cap' + (lit ? ' lab-burner__cap--off' : '')} aria-hidden="true">
        <ellipse className="lab-burner__cap-shadow" cx="40" cy="54.6" rx="11" ry="1.8" />
        <path
          className="lab-burner__cap-body"
          d="M28.8 54.6 H51.2 L50 40.4 Q49.8 38.6 48 38.6 H32 Q30.2 38.6 30 40.4 Z"
          fill={'url(#' + prefix + '-metal)'}
        />
        <path className="lab-burner__cap-band" d="M29.2 51.4 H50.8" />
        <path className="lab-burner__cap-highlight" d="M33.4 41.4 V49.6" />
        <path className="lab-burner__cap-knob" d="M37.2 38.6 V34.6 Q37.2 33 40 33 Q42.8 33 42.8 34.6 V38.6" />
      </g>
    </g>
  );
}

/*
 * 火柴：木梗 φ1.6×42 + 深红火柴头；划燃后火柴头上冒出三层小火苗。
 * 火焰复用酒精灯的 lab-flame__outer / mid / core 造型与摇曳动画，
 * 只是缩到火柴头的尺度，视觉上同源、不用另写一套动画。
 */
function MatchGraphic(props) {
  var burning = !!props.burning;

  return (
    <g className="lab-match">
      <ellipse className="lab-match__shadow" cx="6" cy="52.6" rx="7" ry="1.6" />

      {/* 木梗：主料 + 一道高光 */}
      <path className="lab-match__stick" d="M5.2 52.4 L5.6 12 L6.4 12 L6.8 52.4 Z" />
      <path className="lab-match__stick-shine" d="M5.9 50 V14.4" />

      {/* 火柴头 */}
      <ellipse className="lab-match__head" cx="6" cy="9" rx="2.6" ry="4" />

      {burning ? (
        <g className="lab-flame lab-match__flame" aria-hidden="true">
          <path className="lab-flame__outer" d="M6 6.4 C8.4 2.6 9.2 0.4 6 -4 C2.8 0.4 3.6 2.6 6 6.4 Z" />
          <path className="lab-flame__mid" d="M6 6 C7.4 3.2 7.8 1.6 6 -1.6 C4.2 1.6 4.6 3.2 6 6 Z" />
          <path className="lab-flame__core" d="M6 5.6 C6.8 3.6 7 2.4 6 0.4 C5 2.4 5.2 3.6 6 5.6 Z" />
        </g>
      ) : null}
    </g>
  );
}

/*
 * 铁架台：200×560。底板 200×14、立杆 φ10（x 148~158）、铁圈外径 92 内径 80，
 * 圈心 (98, 400) —— 台面上方 160mm，夹在圈里的试管正好落在酒精灯火焰上方。
 * 铁圈画成正面看过去的椭圆环，和石棉网的铁框呼应；圈心同时是 store 的吸附点。
 */
function StandGraphic(props) {
  var prefix = props.prefix;
  var art = TOOLS.stand;

  return (
    <g className="lab-tool-drawing">
      <defs>
        {/* 立杆与底座的拉丝钢：左亮右暗，圆柱感 */}
        <linearGradient id={prefix + '-steel'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9edee" />
          <stop offset="0.22" stopColor="#fbfcfc" />
          <stop offset="0.58" stopColor="#d5dbdd" />
          <stop offset="1" stopColor="#aeb9bd" />
        </linearGradient>
      </defs>

      {/* 底座铸铁平台 */}
      <path
        className="lab-stand__base"
        d="M8 546 H192 Q200 546 200 552.6 V554 Q200 560 191 560 H9 Q0 560 0 554 V552.6 Q0 546 8 546 Z"
      />
      <path className="lab-stand__base-line" d="M4 550 H196" />

      {/* 立杆 φ10 */}
      <rect
        x={art.rod.x - 5}
        y={art.rod.top}
        width={art.rod.width}
        height={art.basePlate.y - art.rod.top}
        rx="2"
        fill={'url(#' + prefix + '-steel)'}
      />
      <path className="lab-stand__rod-spec" d={'M' + (art.rod.x - 3.4) + ' 18 V' + (art.basePlate.y - 4)} />

      {/* 铁圈：外环 + 内环 + 支臂 + 固定螺丝 */}
      <ellipse className="lab-stand__ring" cx={art.ring.x} cy={art.ring.y} rx={art.ring.rx} ry={art.ring.ry} />
      <ellipse
        className="lab-stand__ring-inner"
        cx={art.ring.x}
        cy={art.ring.y}
        rx={art.ring.inner}
        ry={art.ring.ry - 3.6}
      />
      <path className="lab-stand__arm" d={'M' + art.arm.x1 + ' ' + art.ring.y + ' H' + (art.rod.x - 5)} />
      <circle className="lab-stand__screw" cx={art.rod.x - 2} cy={art.ring.y + 9} r="3.2" />
    </g>
  );
}

/*
 * 玻璃棒：φ6×236 的高硼硅玻璃杆，靠渐变做圆柱感（左侧高光、右缘偏暗）。
 * 杆尖在 (5, 238)：搅拌时 CSS 就绕这一点旋转，杆子左右摇摆而尖端始终插在
 * 液面下的同一个位置 —— 和真实搅棒「手腕在动、棒尖画圈」的手感一致。
 */
function RodGraphic(props) {
  var prefix = props.prefix;

  return (
    <g className="lab-rod">
      <defs>
        <linearGradient id={prefix + '-rod'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.14" stopColor="#ffffff" stopOpacity="0.46" />
          <stop offset="0.46" stopColor="#eef4f6" stopOpacity="0.22" />
          <stop offset="0.82" stopColor="#a9b8be" stopOpacity="0.3" />
          <stop offset="1" stopColor="#8798a0" stopOpacity="0.44" />
        </linearGradient>
      </defs>

      {/* 杆身 */}
      <rect
        x="2"
        y="2"
        width="6"
        height="236"
        rx="3"
        fill={'url(#' + prefix + '-rod)'}
        stroke="rgba(0, 0, 0, 0.15)"
        strokeWidth="0.9"
      />
      {/* 左缘长高光 + 右缘暗边，杆子才有圆柱的弧度 */}
      <path className="lab-rod__spec" d="M3.7 8 V232" />
      <path className="lab-rod__edge" d="M6.4 8 V232" />
      {/* 两端磨圆的收口 */}
      <path className="lab-rod__tip" d="M3.4 4.6 Q5 2.6 6.6 4.6" />
      <path className="lab-rod__tip" d="M3.4 235.4 Q5 237.4 6.6 235.4" />
    </g>
  );
}

/*
 * 胶头滴管：橡胶头（深灰渐变 + 高光）+ 细玻璃管（透明 + 白高光 + 内部液柱）。
 * 液柱颜色按滴管当前吸附的试剂着色，没有试剂时是空的。
 */
function DropperGraphic(props) {
  var prefix = props.prefix;
  var filled = !!props.filled;

  return (
    <g className="lab-dropper">
      <defs>
        <linearGradient id={prefix + '-bulb'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6d7478" />
          <stop offset="0.24" stopColor="#9aa3a7" />
          <stop offset="0.55" stopColor="#5d6569" />
          <stop offset="1" stopColor="#3f4649" />
        </linearGradient>
        <linearGradient id={prefix + '-tube'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="0.22" stopColor="#ffffff" stopOpacity="0.36" />
          <stop offset="0.72" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#93a4ab" stopOpacity="0.34" />
        </linearGradient>
      </defs>

      {/* 橡胶头：略扁的椭球，左上一条高光 */}
      <ellipse
        className="lab-dropper__bulb"
        cx="12"
        cy="16"
        rx="9"
        ry="15"
        fill={'url(#' + prefix + '-bulb)'}
      />
      <path className="lab-dropper__bulb-spec" d="M5.4 11.6 Q6.2 6.6 10 5.4" />
      {/* 胶头与玻璃管的收口 */}
      <path className="lab-dropper__collar" d="M8.4 29.6 H15.6" />
      {/* 玻璃细管：直管收成一根很细的滴嘴 */}
      <path
        className="lab-dropper__tube"
        d="M9.6 29.6 H14.4 V88 L13.2 100 Q12 102.8 10.8 100 L9.6 88 Z"
        fill={'url(#' + prefix + '-tube)'}
      />
      {/* 管内液柱（吸了试剂才出现） */}
      {filled ? (
        <path
          className="lab-dropper__liquid"
          d="M10.4 46 H13.6 V87.6 L12.6 98 Q12 99.4 11.4 98 L10.4 87.6 Z"
        />
      ) : null}
      <path className="lab-dropper__spec" d="M10.8 33 V86" />
      <path className="lab-dropper__tip" d="M11 101.4 Q12 102.8 13 101.4" />
    </g>
  );
}

/*
 * 石棉网：120×10 的金属框 + 交叉网格 + 中间一块白色石棉垫。
 * 架在燃着的火焰上时加 lab-gauze--hot：网格与垫子转暖色并透出一层光晕，
 * 一眼能看出「热量正从网面摊开」。
 */
function GauzeGraphic(props) {
  var prefix = props.prefix;
  var hot = !!props.hot;
  var pad = TOOLS['wire-gauze'].pad;

  return (
    <g className={'lab-gauze' + (hot ? ' lab-gauze--hot' : '')}>
      <defs>
        <linearGradient id={prefix + '-frame'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0f3f4" />
          <stop offset="0.55" stopColor="#dfe4e6" />
          <stop offset="1" stopColor="#c5cfd2" />
        </linearGradient>
        <clipPath id={prefix + '-clip'}>
          <rect x="0" y="0" width="120" height="10" rx="1.4" />
        </clipPath>
      </defs>

      <ellipse className="lab-gauze__shadow" cx="60" cy="11.6" rx="56" ry="1.8" />

      {hot ? <ellipse className="lab-gauze__glow" cx="60" cy="5" rx="40" ry="7" /> : null}

      <rect
        className="lab-gauze__frame"
        x="0"
        y="0"
        width="120"
        height="10"
        rx="1.4"
        fill={'url(#' + prefix + '-frame)'}
      />

      <g className="lab-gauze__mesh" clipPath={'url(#' + prefix + '-clip)'}>
        <path d="M-4 8 L14 0" />
        <path d="M6 10 L24 0" />
        <path d="M16 11 L34 0" />
        <path d="M26 12 L44 0" />
        <path d="M36 12 L54 0" />
        <path d="M46 12 L64 0" />
        <path d="M56 12 L74 0" />
        <path d="M66 12 L84 0" />
        <path d="M76 12 L94 0" />
        <path d="M86 12 L104 0" />
        <path d="M96 12 L114 0" />
        <path d="M106 10 L124 0" />
        <path d="M116 8 L130 1" />
      </g>

      {/* 石棉垫：白色圆片，受热时透出暖色 */}
      <ellipse className="lab-gauze__pad" cx={pad.cx} cy={pad.cy} rx={pad.rx} ry={pad.ry} />
      <path className="lab-gauze__edge" d="M2.4 1.6 H117.6" />
    </g>
  );
}

/* pH 试纸：8×50 的纸条，压着五道比色刻度。 */
function PaperGraphic() {
  return (
    <g className="lab-tool-drawing">
      <path d="M2 2 H14 V52 H2 Z" />
      <path d="M2 12 H14" />
      <path d="M2 22 H14" />
      <path d="M2 32 H14" />
      <path d="M2 42 H14" />
    </g>
  );
}

function ToolGraphic(props) {
  var item = props.item;
  var type = item.type;
  /* 拖拽幽灵会和台上的原件同时存在，用 suffix 让人造 id 不重复 */
  var prefix = 'lab-' + item.id + (props.suffix || '');
  var art = TOOLS[type] || { size: { width: 80, height: 104 } };

  return (
    <svg
      className="lab-vessel__svg"
      viewBox={'0 0 ' + art.size.width + ' ' + art.size.height}
      aria-hidden="true"
      focusable="false"
    >
      {type === 'burner' ? (
        <BurnerGraphic lit={!!item.lit} inUse={!!item.inUse} prefix={prefix} />
      ) : null}
      {type === 'stand' ? <StandGraphic prefix={prefix} /> : null}
      {type === 'match' ? <MatchGraphic burning={!!item.lit} /> : null}
      {type === 'rod' ? <RodGraphic prefix={prefix} /> : null}
      {type === 'dropper' ? <DropperGraphic prefix={prefix} filled={!!item.dropperFill} /> : null}
      {type === 'wire-gauze' ? <GauzeGraphic prefix={prefix} hot={!!item.hot} /> : null}
      {type === 'ph-paper' ? <PaperGraphic /> : null}
    </svg>
  );
}

export function LabGraphic(props) {
  if (props.item.kind === 'container') {
    return (
      <ContainerGraphic
        item={props.item}
        suffix={props.suffix}
        onToggleStopper={props.onToggleStopper}
      />
    );
  }
  return <ToolGraphic item={props.item} suffix={props.suffix} />;
}

