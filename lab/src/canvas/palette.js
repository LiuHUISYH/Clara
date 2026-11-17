/**
 * palette.js —— Canvas 器材的配色与渐变停靠点
 * ------------------------------------------------------------------
 * 和 CSS 里的白底玻璃保持同一套色：冷灰蓝的玻璃、暖棕的高温、克制的阴影。
 * Konva 的渐变是「停靠点数组」——[offset, color, offset, color, …]，
 * 集中放在这里，玻璃 / 工具 / 火焰三组各自复用，避免每个图形写一遍。
 */

/* 玻璃描边与阴影：白底玻璃靠一层淡描边 + 一层冷色投影立住。 */
export var GLASS_STROKE = 'rgba(15, 23, 42, 0.16)';
export var GLASS_STROKE_SOFT = 'rgba(15, 23, 42, 0.08)';
export var GLASS_SHADOW = 'rgba(12, 42, 54, 0.26)';
export var GLASS_HI = 'rgba(255, 255, 255, 0.92)';

/* 文字与刻度：实验台上的器材标签用等宽字体，和日志区一致。 */
export var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
export var INK = 'rgba(51, 65, 85, 0.92)';
export var INK_MUTED = 'rgba(100, 116, 139, 0.9)';
export var INK_FAINT = 'rgba(148, 163, 184, 0.85)';

/* 高温（≥ 60°C）时玻璃整体透一点暖棕，和 CSS 的 .lab-vessel--hot 一致。 */
export var HOT_TINT = 'rgba(214, 112, 54, 0.12)';
export var GLOW = 'rgba(240, 176, 100, 0.9)';

/* 玻璃本体：左缘高光 → 中间几乎透明 → 右缘厚度偏暗（横向渐变）。 */
export var GLASS_BODY = [
  0,
  'rgba(255, 255, 255, 0.92)',
  0.07,
  'rgba(255, 255, 255, 0.6)',
  0.34,
  'rgba(232, 242, 246, 0.18)',
  0.62,
  'rgba(214, 232, 238, 0.16)',
  0.86,
  'rgba(176, 202, 212, 0.3)',
  0.96,
  'rgba(140, 172, 185, 0.4)',
  1,
  'rgba(118, 150, 164, 0.5)'
];

/* 玻璃内的空气：底部略暗一点，容器才有纵深。 */
export var GLASS_AIR = [
  0,
  'rgba(255, 255, 255, 0.14)',
  0.45,
  'rgba(214, 232, 238, 0.05)',
  0.86,
  'rgba(168, 195, 205, 0.1)',
  1,
  'rgba(136, 168, 181, 0.18)'
];

/* 液体纵深：液面下亮、越深越沉（叠在真实颜色之上的灰阶层）。 */
export var LIQUID_DEPTH = [
  0,
  'rgba(255, 255, 255, 0.34)',
  0.18,
  'rgba(255, 255, 255, 0.06)',
  0.72,
  'rgba(21, 51, 63, 0.06)',
  1,
  'rgba(21, 51, 63, 0.18)'
];

/* 不锈钢立杆 / 底座：左亮右暗的圆柱感。 */
export var STEEL = [
  0,
  'rgba(233, 237, 238, 1)',
  0.22,
  'rgba(251, 252, 252, 1)',
  0.58,
  'rgba(213, 219, 221, 1)',
  1,
  'rgba(174, 185, 189, 1)'
];

/* 灯芯管的黄铜拉丝。 */
export var METAL = [
  0,
  'rgba(223, 229, 232, 1)',
  0.18,
  'rgba(246, 248, 249, 1)',
  0.52,
  'rgba(230, 234, 236, 1)',
  1,
  'rgba(198, 207, 211, 1)'
];

/* 胶头滴管的橡胶头。 */
export var RUBBER = [
  0,
  'rgba(109, 116, 120, 1)',
  0.24,
  'rgba(154, 163, 167, 1)',
  0.55,
  'rgba(93, 101, 105, 1)',
  1,
  'rgba(63, 70, 73, 1)'
];

/* 酒精灯玻璃灯体：上亮下暗，底部沉一点。 */
export var BURNER_BODY = [
  0,
  'rgba(255, 255, 255, 0.9)',
  0.26,
  'rgba(226, 238, 241, 0.55)',
  0.72,
  'rgba(178, 200, 208, 0.42)',
  1,
  'rgba(154, 167, 173, 0.42)'
];

/* 灯内酒精：淡琥珀色，液面一层薄光。 */
export var ALCOHOL = [
  0,
  'rgba(226, 236, 232, 0.55)',
  1,
  'rgba(206, 219, 214, 0.75)'
];

/* 火焰三层：外焰橙、中焰金、焰心蓝（FlameShape.jsx 按时间改控制点，逐帧抖动）。 */
export var FLAME_OUTER = 'rgba(240, 160, 74, 0.92)';
export var FLAME_MID = 'rgba(247, 196, 96, 0.9)';
export var FLAME_CORE = 'rgba(126, 186, 236, 0.85)';

/* 石棉网的金属框与石棉垫。 */
export var GAUZE_FRAME = [
  0,
  'rgba(240, 243, 244, 1)',
  0.55,
  'rgba(223, 228, 230, 1)',
  1,
  'rgba(197, 207, 210, 1)'
];
export var GAUZE_PAD = 'rgba(250, 250, 246, 0.95)';
export var GAUZE_HOT = 'rgba(240, 186, 120, 0.55)';
