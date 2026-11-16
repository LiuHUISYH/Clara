/**
 * Vessel.jsx —— 虚拟实验室的器材出口：容器交给 Glass.jsx，工具在这里画
 * ------------------------------------------------------------------
 * 容器（烧杯 / 试管 / 锥形瓶 / 圆底烧瓶 / 容量瓶）是玻璃仪器 + 液体 + 沉淀，
 * 统一由 Glass.jsx 用 SVG 绘制；本文件画酒精灯（玻璃灯体 + 灯帽 + 三层火焰）、
 * 火柴（梗 + 火柴头 + 划燃后的小火苗）与铁架台、玻璃棒、胶头滴管、石棉网、
 * pH 试纸，并提供 LabGraphic 出口。
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

function StandGraphic() {
  return (
    <g className="lab-tool-drawing">
      <path d="M18 94 H58" />
      <path d="M38 94 V20" />
      <path d="M38 42 H62" />
      <path d="M62 42 V52" />
    </g>
  );
}

function RodGraphic() {
  return (
    <g className="lab-tool-drawing">
      <path d="M24 88 L56 24" />
      <path d="M20 94 H44" />
    </g>
  );
}

function DropperGraphic() {
  return (
    <g className="lab-tool-drawing">
      <path d="M40 18 V28" />
      <path d="M31 32 Q31 24 40 24 Q49 24 49 32 Q49 40 40 40 Q31 40 31 32 Z" />
      <path d="M36 40 V82 Q36 90 40 90 Q44 90 44 82 V40" />
      <path d="M34 82 H46" />
    </g>
  );
}

function GauzeGraphic() {
  return (
    <g className="lab-tool-drawing">
      <path d="M16 48 H64 V68 H16 Z" />
      <path d="M16 58 H64" />
      <path d="M28 48 V68" />
      <path d="M40 48 V68" />
      <path d="M52 48 V68" />
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
  var prefix = 'lab-' + item.id;

  return (
    <svg className="lab-vessel__svg" viewBox="0 0 80 104" aria-hidden="true" focusable="false">
      {type === 'burner' ? (
        <BurnerGraphic lit={!!item.lit} inUse={!!item.inUse} prefix={prefix} />
      ) : null}
      {type === 'stand' ? <StandGraphic /> : null}
      {type === 'match' ? <MatchGraphic burning={!!item.lit} /> : null}
      {type === 'rod' ? <RodGraphic /> : null}
      {type === 'dropper' ? <DropperGraphic /> : null}
      {type === 'wire-gauze' ? <GauzeGraphic /> : null}
      {type === 'ph-paper' ? <PaperGraphic /> : null}
    </svg>
  );
}

export function LabGraphic(props) {
  if (props.item.kind === 'container') {
    return <ContainerGraphic item={props.item} />;
  }
  return <ToolGraphic item={props.item} />;
}
