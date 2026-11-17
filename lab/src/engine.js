/**
 * engine.js —— 实验台渲染引擎开关
 * ------------------------------------------------------------------
 * konva（默认）  Canvas 渲染：Stage / Layer / Konva.Image，器材是有厚度的图形对象
 * dom            旧的 SVG + DOM 实现，保留下来做对照与回退
 *
 * 切换方式（不用改代码）：
 *   · 地址栏加 #/lab?engine=dom
 *   · 或在控制台执行 CL.labEngine = 'dom' 后重新进入实验室
 * 默认走 Canvas：新的拖拽、吸附、特效都在 Konva 里实现，DOM 版只剩保底能力。
 */
export var LAB_ENGINE = (function () {
  if (typeof window === 'undefined') return 'konva';

  if (window.CL && window.CL.labEngine) return window.CL.labEngine;

  var hash = String(window.location.hash || '');
  return hash.indexOf('engine=dom') >= 0 ? 'dom' : 'konva';
})();
