/**
 * utils.js —— 通用工具函数
 * ------------------------------------------------------------------
 * 这里集中存放与业务无关的小工具：DOM 查询、元素创建、字符串转义、
 * 随机抽样、提示条、模态框、进度环、答案标准化等。
 * 所有函数都挂载在 CL.utils 命名空间下，供其它模块复用。
 */
(function (global) {
  'use strict';

  var CL = global.CL = global.CL || {};

  /* ============================ DOM 基础 ============================ */

  /** 查询单个元素 */
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  /** 查询多个元素，返回数组 */
  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /**
   * 创建 DOM 元素
   * @param {string} tag 标签名
   * @param {Object} [attrs] 属性：class / text / html / dataset / on* 事件等
   * @param {Array|string|Node} [children] 子节点
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};

    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value === null || value === undefined || value === false) return;

      if (key === 'class' || key === 'className') {
        node.className = value;
      } else if (key === 'text') {
        node.textContent = value;
      } else if (key === 'html') {
        node.innerHTML = value;
      } else if (key === 'dataset') {
        Object.keys(value).forEach(function (k) {
          node.dataset[k] = value[k];
        });
      } else if (key.indexOf('on') === 0 && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'style' && typeof value === 'object') {
        Object.keys(value).forEach(function (k) {
          node.style[k] = value[k];
        });
      } else if (value === true) {
        node.setAttribute(key, '');
      } else {
        node.setAttribute(key, String(value));
      }
    });

    appendChildren(node, children);
    return node;
  }

  /** 递归追加子节点，支持字符串、节点与数组 */
  function appendChildren(node, children) {
    if (children === null || children === undefined) return;
    if (Array.isArray(children)) {
      children.forEach(function (child) {
        appendChildren(node, child);
      });
      return;
    }
    if (children instanceof Node) {
      node.appendChild(children);
      return;
    }
    node.appendChild(document.createTextNode(String(children)));
  }

  /** 清空元素内容 */
  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /** 事件委托 */
  function delegate(root, eventName, selector, handler) {
    root.addEventListener(eventName, function (event) {
      var target = event.target.closest(selector);
      if (target && root.contains(target)) handler(event, target);
    });
  }

  /* ============================ 字符串工具 ============================ */

  /** 转义 HTML，防止把用户输入当成标签 */
  function escapeHtml(input) {
    if (input === null || input === undefined) return '';
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 截断长文本 */
  function truncate(text, max) {
    if (!text) return '';
    var str = String(text);
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  /** 中文数字（用于“第几章”等展示） */
  var CN_NUMBERS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function cnNumber(n) {
    if (n <= 10) return CN_NUMBERS[n];
    if (n < 20) return '十' + CN_NUMBERS[n - 10];
    return String(n);
  }

  /** 把关键词在文本中高亮（返回 HTML 字符串，调用前需确保文本已转义） */
  function highlight(text, keyword) {
    var safe = escapeHtml(text);
    if (!keyword) return safe;
    var escapedKeyword = escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp('(' + escapedKeyword + ')', 'gi'), '<mark class="hl">$1</mark>');
  }

  /* ============================ 数组 / 数字 ============================ */

  /** Fisher-Yates 洗牌，返回新数组，不修改原数组 */
  function shuffle(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** 随机抽取 n 个元素（不重复） */
  function sample(list, n) {
    return shuffle(list).slice(0, n);
  }

  /** 限制数值范围 */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** 百分比（0~100 整数） */
  function percent(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  /** 保留小数位，去掉多余的 0 */
  function formatNum(value, digits) {
    if (typeof value !== 'number' || !isFinite(value)) return String(value);
    var fixed = value.toFixed(digits === undefined ? 2 : digits);
    return fixed.replace(/\.?0+$/, '');
  }

  /* ============================ 日期 ============================ */

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /** 格式化为 YYYY-MM-DD HH:mm */
  function formatTime(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** 相对时间：刚刚 / 5 分钟前 / 3 小时前 / 2 天前 */
  function relativeTime(ts) {
    var diff = Date.now() - (ts || 0);
    var minute = 60 * 1000;
    var hour = 60 * minute;
    var day = 24 * hour;

    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + ' 分钟前';
    if (diff < day) return Math.floor(diff / hour) + ' 小时前';
    if (diff < 30 * day) return Math.floor(diff / day) + ' 天前';
    return formatTime(ts).slice(0, 10);
  }

  /* ============================ 提示条 Toast ============================ */

  /**
   * 显示一条轻提示
   * @param {string} message 文本
   * @param {string} [type] info / success / warn / error
   */
  function toast(message, type, duration) {
    var root = $('#toast-root');
    if (!root) return;

    var icons = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };
    var node = el('div', {
      class: 'toast toast--' + (type || 'info'),
      role: 'status'
    }, [
      el('span', { class: 'toast__icon', text: icons[type || 'info'] || icons.info }),
      el('span', { class: 'toast__text', text: message })
    ]);

    root.appendChild(node);
    // 触发进入动画
    requestAnimationFrame(function () {
      node.classList.add('is-visible');
    });

    var timer = setTimeout(remove, duration || 2600);
    node.addEventListener('click', remove);

    function remove() {
      clearTimeout(timer);
      node.classList.remove('is-visible');
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 220);
    }
  }

  /* ============================ 模态框 ============================ */

  var modalCleanup = null;

  /**
   * 打开模态框
   * @param {Object} options { title, body, footer, width, onClose }
   */
  function openModal(options) {
    options = options || {};
    closeModal();

    var root = $('#modal-root');
    if (!root) return null;

    var dialog = el('div', { class: 'modal', style: { maxWidth: options.width || '720px' } });
    var header = el('div', { class: 'modal__header' }, [
      el('h3', { class: 'modal__title', text: options.title || '提示' }),
      el('button', { class: 'modal__close', type: 'button', 'aria-label': '关闭', text: '✕', onclick: closeModal })
    ]);

    var body = el('div', { class: 'modal__body' });
    if (typeof options.body === 'string') {
      body.innerHTML = options.body;
    } else if (options.body instanceof Node) {
      body.appendChild(options.body);
    }

    var footer = null;
    if (options.footer) {
      footer = el('div', { class: 'modal__footer' });
      if (typeof options.footer === 'string') {
        footer.innerHTML = options.footer;
      } else if (options.footer instanceof Node) {
        footer.appendChild(options.footer);
      }
    }

    dialog.appendChild(header);
    dialog.appendChild(body);
    if (footer) dialog.appendChild(footer);

    var overlay = el('div', { class: 'modal-overlay' }, dialog);
    root.appendChild(overlay);
    document.body.classList.add('modal-open');

    requestAnimationFrame(function () {
      overlay.classList.add('is-open');
    });

    // 点击遮罩关闭
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeModal();
    });

    // ESC 关闭
    function onKeydown(event) {
      if (event.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', onKeydown);

    modalCleanup = function () {
      document.removeEventListener('keydown', onKeydown);
      if (typeof options.onClose === 'function') options.onClose();
    };

    return { overlay: overlay, dialog: dialog, body: body, footer: footer };
  }

  /** 关闭模态框 */
  function closeModal() {
    var root = $('#modal-root');
    if (!root) return;
    var overlays = $$('.modal-overlay', root);
    overlays.forEach(function (overlay) {
      overlay.classList.remove('is-open');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 180);
    });
    document.body.classList.remove('modal-open');
    if (modalCleanup) {
      var fn = modalCleanup;
      modalCleanup = null;
      fn();
    }
  }

  /**
   * 确认对话框，返回 Promise<boolean>
   * @param {string} message
   * @param {Object} [options] { title, confirmText, cancelText, danger }
   */
  function confirmDialog(message, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var footer = el('div', { class: 'modal__actions' });
      var cancel = el('button', {
        class: 'btn btn--ghost', type: 'button', text: options.cancelText || '取消',
        onclick: function () {
          closeModal();
          resolve(false);
        }
      });
      var ok = el('button', {
        class: 'btn ' + (options.danger ? 'btn--danger' : 'btn--primary'),
        type: 'button',
        text: options.confirmText || '确定',
        onclick: function () {
          closeModal();
          resolve(true);
        }
      });
      footer.appendChild(cancel);
      footer.appendChild(ok);

      openModal({
        title: options.title || '请确认',
        body: '<p class="confirm-text">' + escapeHtml(message) + '</p>',
        footer: footer,
        width: '460px',
        onClose: function () { resolve(false); }
      });
    });
  }

  /* ============================ 进度环 ============================ */

  /**
   * 生成 SVG 环形进度条
   * @param {number} value 0~100
   * @param {Object} [options] { size, stroke, color }
   */
  function progressRing(value, options) {
    options = options || {};
    var size = options.size || 64;
    var stroke = options.stroke || 6;
    var color = options.color || 'var(--accent)';
    var radius = (size - stroke) / 2;
    var circumference = 2 * Math.PI * radius;
    var offset = circumference * (1 - clamp(value, 0, 100) / 100);

    return '' +
      '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle class="ring__bg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + radius +
      '" fill="none" stroke-width="' + stroke + '"></circle>' +
      '<circle class="ring__fg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + radius +
      '" fill="none" stroke="' + color + '" stroke-width="' + stroke +
      '" stroke-linecap="round" stroke-dasharray="' + circumference.toFixed(1) +
      '" stroke-dashoffset="' + offset.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"></circle>' +
      '<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" class="ring__text">' + Math.round(value) + '%</text>' +
      '</svg>';
  }

  /* ============================ 答案标准化 ============================ */

  /**
   * 标准化填空答案：
   * 1. 全角转半角
   * 2. 下标/上标数字转普通数字
   * 3. 去掉空白与常见单位
   * 4. 转小写
   */
  function normalizeAnswer(input) {
    if (input === null || input === undefined) return '';
    var text = String(input);

    // 全角字符转半角
    text = text.replace(/[\uFF01-\uFF5E]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    }).replace(/\u3000/g, ' ');

    // 各种“负号 / 破折号”统一为半角减号（学生从网页复制时很常见）
    text = text.replace(/[−–—﹣－]/g, '-');

    // 下标与上标数字
    var subscripts = '₀₁₂₃₄₅₆₇₈₉';
    var superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    text = text.replace(/[₀-₉]/g, function (ch) {
      return String(subscripts.indexOf(ch));
    }).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, function (ch) {
      return String(superscripts.indexOf(ch));
    });

    // 去掉常见单位与“倍”字
    text = text.replace(/(℃|°c|mol\/l|mol\/kg|g\/mol|kj\/mol|ml|l|g|mol|倍|个)/gi, '');

    // 去掉空白、括号、标点
    text = text.replace(/[\s，。、,.；;：:·'"“”‘’()（）\[\]【】]/g, '');

    return text.toLowerCase();
  }

  /**
   * 判断填空答案是否匹配（支持多个可接受答案与数值容差）
   * @param {string} input 用户输入
   * @param {Array<string>} accepted 可接受答案列表
   */
  function isAnswerMatch(input, accepted) {
    var normalized = normalizeAnswer(input);
    if (!normalized) return false;

    var list = Array.isArray(accepted) ? accepted : [accepted];
    for (var i = 0; i < list.length; i++) {
      if (normalized === normalizeAnswer(list[i])) return true;
    }

    // 数值比较（允许极小误差）
    var userNumber = parseFloat(normalized);
    if (!isNaN(userNumber)) {
      for (var j = 0; j < list.length; j++) {
        var target = parseFloat(normalizeAnswer(list[j]));
        if (!isNaN(target) && Math.abs(userNumber - target) < 0.011) return true;
      }
    }
    return false;
  }

  /* ============================ 其他 ============================ */

  /** 防抖 */
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(self, args);
      }, wait || 200);
    };
  }

  /** 节流 */
  function throttle(fn, wait) {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= (wait || 100)) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }

  /** 触发文件下载 */
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** 滚动到页面顶部（平滑） */
  function scrollTop() {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }

  CL.utils = {
    $: $,
    $$: $$,
    el: el,
    clear: clear,
    delegate: delegate,
    escapeHtml: escapeHtml,
    truncate: truncate,
    cnNumber: cnNumber,
    highlight: highlight,
    shuffle: shuffle,
    sample: sample,
    clamp: clamp,
    percent: percent,
    formatNum: formatNum,
    formatTime: formatTime,
    relativeTime: relativeTime,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    confirmDialog: confirmDialog,
    progressRing: progressRing,
    normalizeAnswer: normalizeAnswer,
    isAnswerMatch: isAnswerMatch,
    debounce: debounce,
    throttle: throttle,
    download: download,
    scrollTop: scrollTop
  };
})(window);
