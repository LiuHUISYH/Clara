/**
 * router.js —— 极简哈希路由
 * ------------------------------------------------------------------
 * 使用 location.hash 实现单页应用路由，无需后端配合，双击 index.html
 * 也能正常工作。路由格式： #/chapter/ch1?tab=points
 * 支持的注册方式：
 *   CL.router.register('/chapter/:id', function (params, query) { ... });
 */
(function (global) {
  'use strict';

  var CL = global.CL = global.CL || {};

  var routes = [];
  var baseTitle = 'ChemLearn · AP 化学学习平台';
  var currentRoute = null;
  var notFoundHandler = null;

  /** 注册一条路由 */
  function register(pattern, handler) {
    routes.push({
      pattern: pattern,
      segments: pattern.split('/').filter(Boolean),
      handler: handler
    });
    return CL.router;
  }

  /** 注册 404 处理函数 */
  function setNotFound(handler) {
    notFoundHandler = handler;
    return CL.router;
  }

  /** 解析当前 hash */
  function parseHash() {
    var raw = global.location.hash.replace(/^#/, '');
    if (!raw) raw = '/home';

    var queryIndex = raw.indexOf('?');
    var path = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
    var queryString = queryIndex >= 0 ? raw.slice(queryIndex + 1) : '';

    var query = {};
    queryString.split('&').forEach(function (pair) {
      if (!pair) return;
      var parts = pair.split('=');
      query[decodeURIComponent(parts[0])] = decodeURIComponent(parts.slice(1).join('=') || '');
    });

    return {
      path: path,
      segments: path.split('/').filter(Boolean).map(decodeURIComponent),
      query: query
    };
  }

  /** 匹配路由，返回 { route, params } */
  function matchRoute(segments) {
    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      if (route.segments.length !== segments.length) continue;

      var params = {};
      var matched = true;
      for (var j = 0; j < route.segments.length; j++) {
        var patternSegment = route.segments[j];
        var actualSegment = segments[j];

        if (patternSegment.charAt(0) === ':') {
          params[patternSegment.slice(1)] = actualSegment;
        } else if (patternSegment !== actualSegment) {
          matched = false;
          break;
        }
      }

      if (matched) return { route: route, params: params };
    }
    return null;
  }

  /** 设置页面标题 */
  function setTitle(title) {
    document.title = title ? title + ' | ' + baseTitle : baseTitle;
  }

  /** 根据路由更新导航高亮 */
  function updateNav(name) {
    var nav = document.getElementById('main-nav');
    if (!nav) return;

    var alias = {
      chapter: 'chapters',
      knowledge: 'chapters',
      quiz: 'quiz',
      wrongbook: 'wrongbook',
      molecule: 'molecule',
      tools: 'tools',
      home: 'home'
    };
    var active = alias[name] || name;

    Array.prototype.forEach.call(nav.querySelectorAll('[data-nav]'), function (link) {
      var isActive = link.getAttribute('data-nav') === active;
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  /** 渲染当前路由 */
  function render() {
    var parsed = parseHash();
    var matched = matchRoute(parsed.segments);

    if (!matched) {
      updateNav('');
      if (typeof notFoundHandler === 'function') {
        notFoundHandler(parsed);
      }
      return;
    }

    currentRoute = {
      name: matched.route.segments[0].replace(':', ''),
      params: matched.params,
      query: parsed.query
    };

    try {
      matched.route.handler(matched.params, parsed.query);
    } catch (error) {
      console.error('[router] 渲染失败：', error);
      var outlet = document.getElementById('view-root');
      if (outlet) {
        outlet.innerHTML =
          '<section class="page"><div class="empty-state">' +
          '<div class="empty-state__icon">⚠️</div>' +
          '<h2>页面渲染出错</h2>' +
          '<p>' + CL.utils.escapeHtml(error.message || String(error)) + '</p>' +
          '<a class="btn btn--primary" href="#/home">返回首页</a>' +
          '</div></section>';
      }
    }

    document.body.classList.remove('nav-open');
    updateNav(currentRoute.name);

    // 路由切换后回到页面顶部（跳过 hash 定位）
    try {
      global.scrollTo({ top: 0, behavior: 'auto' });
    } catch (error) {
      global.scrollTo(0, 0);
    }
  }

  /** 跳转到指定路径（不带 #） */
  function navigate(path, replace) {
    var hash = '#' + (path.charAt(0) === '/' ? path : '/' + path);
    if (global.location.hash === hash) {
      render();
      return;
    }
    if (replace) {
      global.history.replaceState(null, '', hash);
      render();
    } else {
      global.location.hash = hash;
    }
  }

  /** 返回当前路由信息 */
  function current() {
    return currentRoute;
  }

  /** 启动路由 */
  function start() {
    global.addEventListener('hashchange', render);
    if (!global.location.hash) {
      global.history.replaceState(null, '', '#/home');
    }
    render();
  }

  CL.router = {
    register: register,
    setNotFound: setNotFound,
    navigate: navigate,
    render: render,
    start: start,
    current: current,
    setTitle: setTitle
  };
})(window);
