/**
 * Vessel.jsx —— 虚拟实验室的器材出口：容器交给 Glass.jsx，工具在这里画
 * ------------------------------------------------------------------
 * 容器（烧杯 / 试管 / 锥形瓶 / 圆底烧瓶 / 容量瓶）是玻璃仪器 + 液体 + 沉淀，
 * 统一由 Glass.jsx 用 SVG 绘制；本文件画酒精灯（玻璃灯体 + 灯帽 + 三层火焰）、
 * 火柴（梗 + 火柴头 + 划燃后的小火苗）与铁架台、玻璃棒、胶头滴管、石棉网、
 * pH 试纸，并提供 LabGraphic 出口。石棉网在火焰上会转暖色，提示正在匀热。
 * 白底玻璃统一走「浅灰描边 + 白色高光 + 右缘厚度」的做法，不引入深色。
 */
import React from 'react';
import { ContainerGraphic } from './Glass';

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
 * 酒精灯：玻璃灯体（含酒精液面）+ 金属灯芯管 + 灯芯 + 可移除灯帽。
 * 未点燃时灯帽扣在灯芯管上；点燃后灯帽平移到灯旁台面（CSS transform 过渡），
 * 火焰由外焰 / 中焰 / 焰心三层 SVG 路径叠加而成，动画在 pages.css。
 */
function BurnerGraphic(props) {
  var prefix = props.prefix;
  var lit = !!props.lit;

  return (
    <g className="lab-burner">
      <BurnerDefs prefix={prefix} />

      {/* 台面上的接触阴影 */}
      <ellipse className="lab-burner__shadow" cx="40" cy="96.6" rx="20.5" ry="2.4" />

      {/* 灯体玻璃 */}
      <path
        className="lab-burner__body"
        d="M21.8 95.6 Q20.4 79.8 29.8 67 Q33 62.6 33 56.4 H47 Q47 62.6 50.2 67 Q59.6 79.8 58.2 95.6 Z"
        fill={'url(#' + prefix + '-body)'}
      />

      {/* 灯内酒精：液面带一点起伏，底部略暗 */}
      <path
        className="lab-burner__alcohol"
        d="M23.4 84.4 Q40 87.1 56.6 84.4 L57 93.6 Q40 96.2 23 93.6 Z"
      />

      {/* 瓶身轮廓与内壁高光 */}
      <path className="lab-burner__outline" d="M21.8 95.6 Q20.4 79.8 29.8 67 Q33 62.6 33 56.4 H47 Q47 62.6 50.2 67 Q59.6 79.8 58.2 95.6" />
      <path className="lab-burner__specular" d="M25 89.4 Q24 78 31.4 67.6 Q34 63.4 34 58.4" />
      <path className="lab-burner__specular lab-burner__specular--soft" d="M55 88 Q55.6 77 49.4 68.4" />

      {/* 灯芯管 */}
      <path className="lab-burner__collar" d="M31.6 56.6 H48.4 V54.2 H31.6 Z" fill={'url(#' + prefix + '-metal)'} />
      <path className="lab-burner__collar" d="M34 54.2 H46 V49.4 H34 Z" fill={'url(#' + prefix + '-metal)'} />
      <path className="lab-burner__collar-line" d="M31.6 55.4 H48.4" />
      <path className="lab-burner__collar-line" d="M34 50.6 H46" />

      {/* 灯芯：未点燃时露出一小截 */}
      <path className="lab-burner__wick" d="M37.4 49.4 H42.6 V45.2 H37.4 Z" />

      {lit ? (
        <g className={'lab-flame' + (props.inUse ? ' lab-flame--in-use' : '')} aria-hidden="true">
          <ellipse className="lab-flame__glow" cx="40" cy="50" rx="12.4" ry="3.6" fill={'url(#' + prefix + '-glow)'} />
          <path
            className="lab-flame__outer"
            d="M40 21 C43.4 28.4 47.4 35.4 47.4 41.4 C47.4 46 44.6 49.8 42.6 50.8 C41.8 51.2 41 51.6 40 51.6 C39 51.6 38.2 51.2 37.4 50.8 C35.4 49.8 32.6 46 32.6 41.4 C32.6 35.4 36.6 28.4 40 21 Z"
          />
          <path
            className="lab-flame__mid"
            d="M40 29.6 C42.2 35.4 44.4 39.6 44.4 43 C44.4 45.8 42.6 48.2 41.2 49.2 C40.8 49.5 40.4 49.7 40 49.7 C39.6 49.7 39.2 49.5 38.8 49.2 C37.4 48.2 35.6 45.8 35.6 43 C35.6 39.6 37.8 35.4 40 29.6 Z"
          />
          <path
            className="lab-flame__core"
            d="M40 38.4 C41.6 41.8 42.8 44.4 42.8 46.2 C42.8 47.8 41.6 48.8 40 48.8 C38.4 48.8 37.2 47.8 37.2 46.2 C37.2 44.4 38.4 41.8 40 38.4 Z"
          />
        </g>
      ) : null}

      {/* 灯帽：点燃后移到灯旁台面上 */}
      <g className={'lab-burner__cap' + (lit ? ' lab-burner__cap--off' : '')} aria-hidden="true">
        <ellipse className="lab-burner__cap-shadow" cx="40" cy="58.2" rx="9.6" ry="1.7" />
        <path
          className="lab-burner__cap-body"
          d="M32.2 58 H47.8 L47 46.6 Q46.9 45.4 45.6 45.4 H34.4 Q33.1 45.4 33 46.6 Z"
          fill={'url(#' + prefix + '-metal)'}
        />
        <path className="lab-burner__cap-band" d="M32.2 55.6 H47.8" />
        <path className="lab-burner__cap-highlight" d="M35.4 47.6 V54.4" />
        <path className="lab-burner__cap-knob" d="M38.9 45.4 V42.4 Q38.9 41.1 40 41.1 Q41.1 41.1 41.1 42.4 V45.4" />
      </g>
    </g>
  );
}

/*
 * 火柴：木梗斜靠 + 深红火柴头；划燃后火柴头上冒出三层小火苗。
 * 火焰复用酒精灯的 lab-flame__outer / mid / core 造型与摇曳动画，
 * 只是缩到火柴头的尺度，视觉上同源、不用另写一套动画。
 */
function MatchGraphic(props) {
  var burning = !!props.burning;

  return (
    <g className="lab-match">
      <ellipse className="lab-match__shadow" cx="36" cy="90.4" rx="15" ry="2.2" />

      {/* 木梗：主料 + 一道高光 */}
      <path className="lab-match__stick" d="M24 89.4 L47.4 32.6" />
      <path className="lab-match__stick-shine" d="M25.8 87.6 L46.2 36.8" />

      {/* 火柴头 */}
      <path
        className="lab-match__head"
        d="M50.6 27.8 Q54.2 31.6 51.4 35.6 Q47.6 36.4 46.4 32.6 Q46.6 28.6 50.6 27.8 Z"
      />

      {burning ? (
        <g className="lab-flame lab-match__flame" aria-hidden="true">
          <path
            className="lab-flame__outer"
            d="M49.6 28.4 C52.2 23.4 53.6 20.2 49.8 12.8 C45.8 20.2 47.6 23.4 49.6 28.4 Z"
          />
          <path
            className="lab-flame__mid"
            d="M49.6 27.6 C51 23.6 51.8 21.4 49.8 16.6 C47.8 21.4 48.6 23.6 49.6 27.6 Z"
          />
          <path
            className="lab-flame__core"
            d="M49.6 26.8 C50.4 24.4 50.8 22.8 49.8 20.4 C48.8 22.8 49 24.4 49.6 26.8 Z"
          />
        </g>
      ) : null}
    </g>
  );
}

/*
 * 铁架台：底座 + 立杆 + 铁圈 + 固定螺丝。铁圈用来托石棉网，
 * 所以画成正面看过去的椭圆环，和石棉网的铁框呼应。
 */
function StandGraphic() {
  return (
    <g className="lab-tool-drawing">
      <path
        className="lab-stand__base"
        d="M16 95 H60 Q65 95 65 90.6 Q65 86 60 86 H16 Q11 86 11 90.6 Q11 95 16 95 Z"
      />
      <path d="M36 86 V16" />
      <path className="lab-stand__cap" d="M33.2 16.6 H38.8" />
      <path d="M40 36 H48" />
      <ellipse className="lab-stand__ring" cx="53" cy="36" rx="10.5" ry="4.4" />
      <path d="M40 46 H45" />
      <circle className="lab-stand__screw" cx="45.6" cy="46" r="1.7" />
    </g>
  );
}

/*
 * 玻璃棒：一根两端磨圆的高硼硅玻璃杆，靠渐变做圆柱感（左侧高光、右缘偏暗），
 * 斜放在台面上；Step 3 的搅拌会把这根杆送进容器里并让它绕圈。
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

      <g transform="rotate(-16 40 56)">
        {/* 杆身 */}
        <rect
          x="36.6"
          y="14"
          width="6.8"
          height="78"
          rx="3.4"
          fill={'url(#' + prefix + '-rod)'}
          stroke="rgba(0, 0, 0, 0.15)"
          strokeWidth="1"
        />
        {/* 左缘长高光 + 右缘暗边，杆子才有圆柱的弧度 */}
        <path className="lab-rod__spec" d="M38.5 18.5 V88" />
        <path className="lab-rod__edge" d="M41.8 18.5 V88" />
        {/* 两端磨圆的收口 */}
        <path className="lab-rod__tip" d="M37.4 16.4 Q40 14.2 42.6 16.4" />
        <path className="lab-rod__tip" d="M37.4 89.6 Q40 91.8 42.6 89.6" />
      </g>
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
        cx="40"
        cy="17"
        rx="8.4"
        ry="9.6"
        fill={'url(#' + prefix + '-bulb)'}
      />
      <path className="lab-dropper__bulb-spec" d="M34.8 12.2 Q35.4 8.8 38.6 8.2" />
      {/* 胶头与玻璃管的收口 */}
      <path className="lab-dropper__collar" d="M36.4 25.2 H43.6" />
      {/* 玻璃细管：直管收成一根很细的滴嘴 */}
      <path
        className="lab-dropper__tube"
        d="M37.4 25.2 H42.6 V74.4 L41.2 84.4 Q40 87.2 38.8 84.4 L37.4 74.4 Z"
        fill={'url(#' + prefix + '-tube)'}
      />
      {/* 管内液柱（吸了试剂才出现） */}
      {filled ? (
        <path
          className="lab-dropper__liquid"
          d="M38.4 44 H41.6 V74 L40.9 81.4 Q40 82.6 39.1 81.4 L38.4 74 Z"
        />
      ) : null}
      <path className="lab-dropper__spec" d="M38.8 29 V73.6" />
      <path className="lab-dropper__tip" d="M38.9 86.2 Q40 87.8 41.1 86.2" />
    </g>
  );
}

/*
 * 石棉网：金属框 + 交叉网格 + 中间一块白色石棉垫。
 * 架在燃着的火焰上时加 lab-gauze--hot：网格与垫子转暖色并透出一层光晕，
 * 一眼能看出「热量正从网面摊开」。
 */
function GauzeGraphic(props) {
  var prefix = props.prefix;
  var hot = !!props.hot;

  return (
    <g className={'lab-gauze' + (hot ? ' lab-gauze--hot' : '')}>
      <defs>
        <linearGradient id={prefix + '-frame'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0f3f4" />
          <stop offset="0.55" stopColor="#dfe4e6" />
          <stop offset="1" stopColor="#c5cfd2" />
        </linearGradient>
        <clipPath id={prefix + '-clip'}>
          <rect x="16" y="48" width="48" height="20" rx="2.4" />
        </clipPath>
      </defs>

      <ellipse className="lab-gauze__shadow" cx="40" cy="70.6" rx="25" ry="2.4" />

      {hot ? <ellipse className="lab-gauze__glow" cx="40" cy="58" rx="20" ry="8" /> : null}

      <rect
        className="lab-gauze__frame"
        x="15"
        y="47"
        width="50"
        height="22"
        rx="3"
        fill={'url(#' + prefix + '-frame)'}
      />

      <g className="lab-gauze__mesh" clipPath={'url(#' + prefix + '-clip)'}>
        <path d="M10 46 L44 70" />
        <path d="M20 45 L54 69" />
        <path d="M30 45 L64 69" />
        <path d="M40 45 L74 69" />
        <path d="M50 45 L84 69" />
        <path d="M30 45 L16 69" />
        <path d="M40 45 L26 69" />
        <path d="M50 45 L36 69" />
        <path d="M60 45 L46 69" />
        <path d="M70 45 L56 69" />
      </g>

      {/* 石棉垫：白色圆片，受热时透出暖色 */}
      <ellipse className="lab-gauze__pad" cx="40" cy="57.6" rx="11.6" ry="5.6" />
      <path className="lab-gauze__edge" d="M17.6 48.6 H62.4" />
    </g>
  );
}

function PaperGraphic() {
  return (
    <g className="lab-tool-drawing">
      <path d="M30 20 H50 V86 H30 Z" />
      <path d="M30 34 H50" />
      <path d="M30 44 H50" />
      <path d="M30 54 H50" />
      <path d="M30 64 H50" />
      <path d="M30 74 H50" />
    </g>
  );
}

function ToolGraphic(props) {
  var item = props.item;
  var type = item.type;
  /* 拖拽幽灵会和台上的原件同时存在，用 suffix 让人造 id 不重复 */
  var prefix = 'lab-' + item.id + (props.suffix || '');

  return (
    <svg className="lab-vessel__svg" viewBox="0 0 80 104" aria-hidden="true" focusable="false">
      {type === 'burner' ? (
        <BurnerGraphic lit={!!item.lit} inUse={!!item.inUse} prefix={prefix} />
      ) : null}
      {type === 'stand' ? <StandGraphic /> : null}
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
