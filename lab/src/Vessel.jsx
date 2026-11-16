import React from 'react';

var GLASS = {
  beaker: {
    body: 'M14 26 H66 V90 Q66 96 60 96 H20 Q14 96 14 90 Z',
    top: 28,
    bottom: 94,
    x: 14,
    width: 52
  },
  'test-tube': {
    body: 'M30 14 H50 V82 Q50 94 40 94 Q30 94 30 82 Z',
    top: 16,
    bottom: 93,
    x: 30,
    width: 20
  },
  erlenmeyer: {
    body: 'M34 14 H46 V34 L62 88 Q64 94 58 94 H22 Q16 94 18 88 L34 34 Z',
    top: 38,
    bottom: 93,
    x: 18,
    width: 44
  },
  'round-flask': {
    body: 'M34 14 H46 V32 C62 34 68 48 68 62 C68 80 56 94 40 94 C24 94 12 80 12 62 C12 48 18 34 34 32 Z',
    top: 38,
    bottom: 93,
    x: 12,
    width: 56
  },
  'volumetric-flask': {
    body: 'M34 14 H46 V30 C58 34 64 44 64 58 C64 80 53 94 40 94 C27 94 16 80 16 58 C16 44 22 34 34 30 Z',
    top: 34,
    bottom: 93,
    x: 16,
    width: 48
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
  return Math.max(3, (shape.bottom - shape.top) * ratio);
}

function SolidMarks(props) {
  var solids = props.contents.filter(function (entry) {
    return entry.state === 'solid';
  });
  if (solids.length === 0) return null;

  var shape = props.shape;
  var centre = shape.x + shape.width / 2;

  return (
    <g clipPath={'url(#' + props.clipId + ')'} className="lab-solid-group">
      {solids.map(function (entry, index) {
        var mass = entry.mass || 1;
        var width = Math.max(12, Math.min(shape.width - 4, 12 + mass * 7));
        var rise = Math.max(4, Math.min(14, 3 + mass * 2));
        var offset = solids.length > 1 ? (index - (solids.length - 1) / 2) * 6 : 0;
        var left = centre - width / 2 + offset;
        var right = left + width;

        return (
          <path
            className="lab-solid"
            key={entry.chemical + '-' + index}
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
            fill={SOLID_COLORS[entry.chemical] || '#8e8b81'}
          />
        );
      })}
    </g>
  );
}

function ContainerGraphic(props) {
  var item = props.item;
  var shape = GLASS[item.type] || GLASS.beaker;
  var clipId = 'lab-clip-' + item.id;
  var height = liquidHeight(item, shape);

  return (
    <svg className="lab-vessel__svg" viewBox="0 0 80 104" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <path d={shape.body} />
        </clipPath>
      </defs>

      {height > 0 ? (
        <g clipPath={'url(#' + clipId + ')'}>
          <rect
            className="lab-liquid"
            x={shape.x}
            y={shape.bottom - height}
            width={shape.width}
            height={height}
            fill={item.color || '#e2ecef'}
          />
          <line
            className="lab-liquid-surface"
            x1={shape.x - 2}
            y1={shape.bottom - height}
            x2={shape.x + shape.width + 2}
            y2={shape.bottom - height}
          />
        </g>
      ) : null}

      <SolidMarks contents={item.contents} shape={shape} clipId={clipId} />
      <path className="lab-glass" d={shape.body} />

      {item.type === 'beaker' ? (
        <g className="lab-glass-detail">
          <path d="M10 26 H70" />
          <path d="M22 40 H34" />
          <path d="M22 52 H34" />
          <path d="M22 64 H34" />
        </g>
      ) : null}

      {item.type === 'test-tube' ? (
        <g className="lab-glass-detail">
          <path d="M26 14 H54" />
          <path d="M30 36 H38" />
        </g>
      ) : null}

      {item.type === 'erlenmeyer' ? (
        <g className="lab-glass-detail">
          <path d="M30 14 H50" />
          <path d="M22 78 H30" />
        </g>
      ) : null}

      {item.type === 'round-flask' ? (
        <g className="lab-glass-detail">
          <path d="M30 14 H50" />
          <path d="M18 66 H24" />
        </g>
      ) : null}

      {item.type === 'volumetric-flask' ? (
        <g className="lab-glass-detail">
          <path d="M30 14 H50" />
          <path d="M64 52 H70" />
          <path d="M63 60 H69" />
        </g>
      ) : null}
    </svg>
  );
}

function BurnerGraphic(props) {
  return (
    <g className="lab-tool-drawing">
      <path d="M18 92 H62" />
      <path d="M27 90 L31 62 H49 L53 90 Z" />
      <path d="M36 62 H44" />
      <path d="M40 62 V52" />
      <path d="M24 96 H56" />
      {props.lit ? (
        <g className="lab-flame" aria-hidden="true">
          <path
            className="lab-flame__outer"
            d="M40 18 C46 32 51 42 49 51 C47 57 42 59 40 59 C38 59 33 57 31 51 C29 42 34 32 40 18 Z"
          />
          <path
            className="lab-flame__inner"
            d="M40 38 C42 44 44 48 42.5 52 C41.5 55 40.5 56 40 56 C39.5 56 38.5 55 37.5 52 C36 48 38 44 40 38 Z"
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
  var type = props.item.type;
  var lit = !!props.item.lit;

  return (
    <svg className="lab-vessel__svg" viewBox="0 0 80 104" aria-hidden="true" focusable="false">
      {type === 'burner' ? <BurnerGraphic lit={lit} /> : null}
      {type === 'stand' ? <StandGraphic /> : null}
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
