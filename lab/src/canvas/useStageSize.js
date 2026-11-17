/**
 * useStageSize.js —— Konva Stage 的像素尺寸
 * ------------------------------------------------------------------
 * Konva 的 Stage 必须拿到确定的宽高（Canvas 不会自己撑满父元素），
 * 而实验台是 flex 布局里的一个可伸缩区域，所以用 ResizeObserver 监听
 * 宿主 div，把内容盒尺寸喂给 Stage；窗口缩放、侧栏折叠都会跟着变。
 *
 * 返回值取整到整数像素：Stage 的宽高带小数时，Konva 会在视网膜屏上
 * 产生半像素模糊，器材边缘的 1px 高光会糊掉。
 */
import { useEffect, useState } from 'react';

export default function useStageSize(ref, fallback) {
  var [size, setSize] = useState(fallback || { width: 0, height: 0 });

  useEffect(
    function () {
      var node = ref.current;
      if (!node) return undefined;

      function measure() {
        var box = node.getBoundingClientRect();
        var width = Math.max(0, Math.round(box.width));
        var height = Math.max(0, Math.round(box.height));

        setSize(function (prev) {
          if (prev.width === width && prev.height === height) return prev;
          return { width: width, height: height };
        });
      }

      measure();

      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', measure);
        return function () {
          window.removeEventListener('resize', measure);
        };
      }

      var observer = new ResizeObserver(measure);
      observer.observe(node);

      return function () {
        observer.disconnect();
      };
    },
    [ref]
  );

  return size;
}
