import React from 'react';
import { createRoot } from 'react-dom/client';
import LabPage from './LabPage';
import { useLabStore, LAB_GEOMETRY, boundsOf, mouthPoint, pourAlign } from './store';
import { LAB_ENGINE } from './engine';

var CL = (window.CL = window.CL || {});
var root = null;

function unmount() {
  if (!root) return;
  try {
    root.unmount();
  } catch (error) {
    console.warn('[lab] React 根节点卸载失败：', error);
  }
  root = null;
}

function render() {
  var outlet = document.getElementById('view-root');
  if (!outlet) return;

  unmount();
  outlet.innerHTML = '<div id="lab-root"></div>';

  root = createRoot(document.getElementById('lab-root'));
  root.render(<LabPage />);

  if (CL.router && CL.router.onLeave) CL.router.onLeave(unmount);
  if (CL.router) CL.router.setTitle('实验室');
}

CL.lab = {
  render: render,
  unmount: unmount,
  store: useLabStore,
  /*
   * 实体几何对外暴露：自测脚本与调试可以直接复用页面的碰撞判定
   * （boundsOf / mouthPoint / pourAlign），不必在测试里重算一遍常量。
   */
  geometry: LAB_GEOMETRY,
  boundsOf: boundsOf,
  mouthPoint: mouthPoint,
  pourAlign: pourAlign,
  /* 当前渲染引擎（'konva' | 'dom'），README 与自测脚本都读这个值 */
  engine: LAB_ENGINE
};
