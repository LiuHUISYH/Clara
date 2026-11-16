import React from 'react';
import { createRoot } from 'react-dom/client';
import LabPage from './LabPage';
import { useLabStore } from './store';

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
  store: useLabStore
};
