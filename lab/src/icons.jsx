/**
 * icons.js —— 器材库的极简线稿图标
 * ------------------------------------------------------------------
 * 左侧器材库用网格排列，每一项都要能一眼认出来是什么：容器画器型、工具画工具、
 * 试剂按物态画（液体 = 带液柱的试管，固体 = 一小堆晶体），液体颜色直接取
 * reactions.js 的 speciesColor，和倒进烧杯后的颜色一致。
 *
 * 统一 32×32 viewBox、1 单位 = 1px、stroke=currentColor，
 * 只有容器里那一点液体 / 晶体会用实色填充 —— 与实验台的浅色极简风格一致。
 */
import React from 'react';
import { speciesColor } from './reactions';

var LINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

/* 把实体的 id / shape 归到一类图形上，避免为每瓶试剂单写一个图标。 */
function iconKind(item) {
  if (item.shape) return item.shape;
  if (item.kind === 'reagent') return item.state === 'solid' ? 'solid' : 'liquid';
  return item.id;
}

function BeakerIcon(props) {
  return (
    <g>
      <path {...LINE} d="M8 8 H22 L26 5 V25 Q26 27 23.5 27 H8.5 Q6 27 6 25 V8" />
      <path {...LINE} d="M8 8 H22" />
      <path d="M8 16 H24 V24.6 Q24 26 22.4 26 H9.6 Q8 26 8 24.6 Z" fill={props.tint} opacity="0.55" />
      <path {...LINE} d="M10 12 H13 M10 19 H13" opacity="0.6" />
    </g>
  );
}

function TubeIcon(props) {
  return (
    <g>
      <path {...LINE} d="M13 5 H19 V24 Q19 28 16 28 Q13 28 13 24 Z" />
      <path d="M13.8 14 H18.2 V24 Q18.2 26.6 16 26.6 Q13.8 26.6 13.8 24 Z" fill={props.tint} opacity="0.55" />
      <path {...LINE} d="M12 5 H20" />
    </g>
  );
}

function FlaskIcon(props) {
  return (
    <g>
      <path {...LINE} d="M13 5 H19 V14 L25 25 Q25.6 27 23.4 27 H8.6 Q6.4 27 7 25 L13 14 Z" />
      <path d="M9.6 20 H22.4 L24.4 25 Q24.8 26 23.4 26 H8.6 Q7.2 26 7.6 25 Z" fill={props.tint} opacity="0.55" />
    </g>
  );
}

function RoundFlaskIcon(props) {
  return (
    <g>
      <path {...LINE} d="M13 5 H19 V11 C24 14 27 17 27 21 C27 25.4 22 28 16 28 C10 28 5 25.4 5 21 C5 17 8 14 13 11 Z" />
      <path
        d="M6.6 20.4 C10 18.6 22 18.6 25.4 20.4 C24 25 20.4 26.6 16 26.6 C11.6 26.6 8 25 6.6 20.4 Z"
        fill={props.tint}
        opacity="0.55"
      />
    </g>
  );
}

function VolumetricIcon(props) {
  return (
    <g>
      <path
        {...LINE}
        d="M13.4 4 H18.6 V12 C23 15 25.4 18 25.4 21.4 C25.4 25.4 21 28 16 28 C11 28 6.6 25.4 6.6 21.4 C6.6 18 9 15 13.4 12 Z"
      />
      <path {...LINE} d="M12.4 12.6 H19.6" />
    </g>
  );
}

function BottleIcon(props) {
  var band = props.band || '#b9c6cc';

  return (
    <g>
      <path
        {...LINE}
        d="M13 9 V6 Q13 4.6 14.4 4.6 H17.6 Q19 4.6 19 6 V9 Q23 10 24.4 13 Q25.4 15 25.4 17 V25 Q25.4 27 23.4 27 H8.6 Q6.6 27 6.6 25 V17 Q6.6 15 7.6 13 Q9 10 13 9 Z"
      />
      <rect x="9.4" y="16" width="13.2" height="7" fill="#ffffff" stroke="currentColor" strokeWidth="0.8" opacity="0.9" />
      <rect x="9.4" y="16" width="13.2" height="1.6" fill={band} />
      <path {...LINE} d="M12.6 5.6 H18.4" />
    </g>
  );
}

function BurnerIcon() {
  return (
    <g>
      <path {...LINE} d="M8 27 Q6.4 18 12 13 H20 Q25.6 18 24 27 Z" />
      <path {...LINE} d="M13 13 V10 H19 V13" />
      <path d="M16 3 C18.4 6.6 19.6 8.6 17.4 10.6 C15.2 8.6 13.6 6.6 16 3 Z" fill="#f0b064" opacity="0.75" />
    </g>
  );
}

function StandIcon() {
  return (
    <g>
      <path {...LINE} d="M4 27 H16" />
      <path {...LINE} d="M15 27 V3" />
      <path {...LINE} d="M15 14 H8" />
      <ellipse {...LINE} cx="6.6" cy="17.6" rx="4.6" ry="2.4" />
    </g>
  );
}

function RodIcon() {
  return (
    <g>
      <path {...LINE} d="M10 27 L22 5" strokeWidth="2.4" opacity="0.75" />
      <path {...LINE} d="M9 27 L21 5" strokeWidth="0.8" opacity="0.5" />
    </g>
  );
}

function DropperIcon(props) {
  return (
    <g>
      <ellipse cx="16" cy="8.6" rx="4.4" ry="6" fill="#8e989c" opacity="0.75" />
      <path {...LINE} d="M14 14 H18 V22 L17 26.4 H15 L14 22 Z" />
      <path d="M14.8 17 H17.2 V22.4 L16.6 25 H15.4 L14.8 22.4 Z" fill={props.tint} opacity="0.8" />
    </g>
  );
}

function GauzeIcon() {
  return (
    <g>
      <rect {...LINE} x="4" y="15" width="24" height="6" rx="1" />
      <path {...LINE} d="M4 18 H28" opacity="0.5" />
      <path {...LINE} d="M9 15 V21 M14 15 V21 M19 15 V21 M24 15 V21" opacity="0.5" />
      <ellipse cx="16" cy="18" rx="4" ry="1.8" fill="#ffffff" stroke="currentColor" strokeWidth="0.8" />
    </g>
  );
}

function PaperIcon() {
  return (
    <g>
      <rect {...LINE} x="11" y="4" width="10" height="24" rx="0.6" />
      <path {...LINE} d="M11 10 H21 M11 15 H21 M11 20 H21 M11 25 H21" opacity="0.55" />
    </g>
  );
}

function MatchIcon() {
  return (
    <g>
      <path {...LINE} d="M9 27 L21 9" strokeWidth="1.6" />
      <ellipse cx="22" cy="7" rx="2.4" ry="3" fill="#b8453a" opacity="0.8" />
      <path d="M22 4.2 C23.4 2 23.8 0.8 22 -1 C20.2 0.8 20.6 2 22 4.2 Z" fill="#f0b064" opacity="0.7" />
    </g>
  );
}

function LiquidIcon(props) {
  return (
    <g>
      <path {...LINE} d="M12 5 H20 V24 Q20 28 16 28 Q12 28 12 24 Z" />
      <path d="M12.8 15 H19.2 V24 Q19.2 26.6 16 26.6 Q12.8 26.6 12.8 24 Z" fill={props.tint} opacity="0.72" />
      <path {...LINE} d="M11 5 H21" />
    </g>
  );
}

function SolidIcon(props) {
  return (
    <g>
      <path d="M8 24 L11 17 L15 20 L18 15 L22 22 L25 19 L24 26 H8 Z" fill={props.tint} opacity="0.7" />
      <path {...LINE} d="M7 26.4 H25" />
      <circle cx="12.4" cy="12.6" r="1.2" fill={props.tint} opacity="0.8" />
      <circle cx="19.6" cy="10.4" r="0.9" fill={props.tint} opacity="0.8" />
    </g>
  );
}

/*
 * 器材库图标出口：按 shape / kind / 物态分派。
 * 液体试剂的颜色取 speciesColor，和它倒进烧杯后的颜色是同一个来源。
 */
export function LibraryIcon(props) {
  var item = props.item;
  var kind = iconKind(item);
  var tint =
    item.swatch ||
    (item.chemical ? speciesColor(item.chemical) : '#dfe8ea') ||
    '#dfe8ea';

  var glyph = null;

  if (kind === 'beaker') glyph = <BeakerIcon tint={tint} />;
  else if (kind === 'test-tube') glyph = <TubeIcon tint={tint} />;
  else if (kind === 'erlenmeyer') glyph = <FlaskIcon tint={tint} />;
  else if (kind === 'round-flask') glyph = <RoundFlaskIcon tint={tint} />;
  else if (kind === 'volumetric-flask') glyph = <VolumetricIcon tint={tint} />;
  else if (kind === 'reagent-bottle') {
    glyph = <BottleIcon band={item.label ? item.label.band : null} />;
  } else if (kind === 'burner') glyph = <BurnerIcon />;
  else if (kind === 'stand') glyph = <StandIcon />;
  else if (kind === 'rod') glyph = <RodIcon />;
  else if (kind === 'dropper') glyph = <DropperIcon tint={tint} />;
  else if (kind === 'wire-gauze') glyph = <GauzeIcon />;
  else if (kind === 'ph-paper') glyph = <PaperIcon />;
  else if (kind === 'match') glyph = <MatchIcon />;
  else if (kind === 'solid') glyph = <SolidIcon tint={tint} />;
  else glyph = <LiquidIcon tint={tint} />;

  return (
    <svg className="lab-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {glyph}
    </svg>
  );
}
