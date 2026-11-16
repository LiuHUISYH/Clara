/**
 * store.js —— 虚拟实验室的 Zustand 全局状态与容器操作
 * ------------------------------------------------------------------
 * 容器统一模型：{ id, type, contents, temperature, color, ph, volume, capacity }
 * 加试剂、倾倒产生的混合都会先经过 reactions.js 的规则引擎（反应、沉淀、
 * 放气、放热、指示剂变色），再由 syncItem() 统一重算体积、颜色与 pH。
 */

import { create } from 'zustand';
import {
  reactContents,
  describeReaction,
  describeGas,
  hasIndicator,
  indicatorTint,
  indicatorText,
  speciesColor,
  speciesPh
} from './reactions';

/* 气泡的显示时长：tickHeating 到期后清除 gas 标记。 */
var GAS_DURATION = 6000;

/* ---------------- 加热模型 ----------------
 * 点燃的酒精灯不是「靠近就加热」，而是按火焰位置做碰撞判定：容器必须真的架在
 * 火焰上方，横向对准、纵向高度合适才算受热（见 inFlame）。
 *
 * 令牌坐标（104 宽的器材令牌，SVG 92×120 居中）：
 *   火焰尖端   x=52（令牌中心）、y=26（viewBox 40,21 → 缩放 1.15 + 2px 内边距）
 *   容器玻璃底 y=113（viewBox 底边 94~96 → 缩放 1.15 + 2px 内边距，各器型差 ±2px）
 *
 * 受热每秒升温 HEAT_RATE：有液体止于沸点并转入沸腾（bubbles 变密、副标题标「沸腾」），
 * 空容器干烧止于 DRY_LIMIT；离开火焰每秒降温 COOL_RATE 直到回到室温。
 * 所有温度更新都经过 syncItem()。
 */
var TOKEN_WIDTH = 104;
var FLAME_CENTRE_X = 52;
var FLAME_TIP_Y = 26;
var VESSEL_BASE_Y = 113;
var FLAME_X_RANGE = 30;
var FLAME_GAP = 50;
var FLAME_OVERLAP = 24;
var HEAT_RATE = 4;
var COOL_RATE = 2;
var AMBIENT = 25;
var BOIL_POINT = 100;
var DRY_LIMIT = 160;

/* ---------------- 石棉网匀热 ----------------
 * 玻璃容器直接架在焰尖上受热不均，实验规范是垫一张石棉网：网面把火焰摊开，
 * 容器坐在网面上，离焰尖反而更远。令牌里网面的位置由 GauzeGraphic 的 viewBox
 * （16~64 × 48~68，×1.15 缩放 + 2px 内边距）换算而来：
 *   网面顶 y=57、网面底 y=80，中心 x 与火焰中心同为 52。
 *
 * 于是加热变成两段判定：火焰 → 石棉网（gauzeInFlame）、石棉网 → 容器（onGauze）。
 * 容器坐在石棉网上时底部离焰尖 50px 以上，单纯用 inFlame 判不到，所以由
 * heatSource() 把「直接受热」和「隔着石棉网受热」两条路径合成一个结论。
 */
var GAUZE_TOP_Y = 57;
var GAUZE_BOTTOM_Y = 80;
var GAUZE_X_RANGE = 34;
var GAUZE_GAP = 16;
var GAUZE_OVERLAP = 8;
var GAUZE_FLAME_GAP = 14;
var GAUZE_FLAME_OVERLAP = 12;
/* 直接受热到这个温度就开始受热不均，记一条建议垫石棉网的警告。 */
var UNEVEN_TEMPERATURE = 60;

/* 令牌几何对外暴露给页面：吸附石棉网时页面要用同一套数值算落点。 */
export var LAB_GEOMETRY = {
  tokenWidth: TOKEN_WIDTH,
  vesselBaseY: VESSEL_BASE_Y,
  flameTipY: FLAME_TIP_Y,
  gauzeTopY: GAUZE_TOP_Y,
  gauzeBottomY: GAUZE_BOTTOM_Y
};

/* 一根火柴能燃多久：够从容走到酒精灯旁，又不会一直亮着。 */
var MATCH_DURATION = 9000;

var ITEM_SERIAL = 0;
var LOG_SERIAL = 0;

/*
 * 火焰碰撞：容器的玻璃底是否落在酒精灯的火焰上。
 *   · 横向：容器中心与火焰中心的水平偏差必须小于 FLAME_X_RANGE（30px）
 *   · 纵向：焰尖到容器底的间距在 -FLAME_OVERLAP ~ FLAME_GAP 之间
 *     （正数 = 容器悬在焰尖上方，最多 50px；负数 = 焰尖已探进容器底部，最多 24px）
 * 摆得再近但没架在火焰上（比如并排摆在灯旁边）不算受热。
 */
export function inFlame(item, burner) {
  var dx = item.x + TOKEN_WIDTH / 2 - (burner.x + FLAME_CENTRE_X);
  if (Math.abs(dx) >= FLAME_X_RANGE) return false;

  var gap = burner.y + FLAME_TIP_Y - (item.y + VESSEL_BASE_Y);
  return gap <= FLAME_GAP && gap >= -FLAME_OVERLAP;
}

/* 石棉网是否架在火焰上：网面中心对准焰心，网底落在焰尖附近（可以稍微探进去）。 */
function gauzeInFlame(gauze, burner) {
  var dx = gauze.x + TOKEN_WIDTH / 2 - (burner.x + FLAME_CENTRE_X);
  if (Math.abs(dx) >= GAUZE_X_RANGE) return false;

  var gap = burner.y + FLAME_TIP_Y - (gauze.y + GAUZE_BOTTOM_Y);
  return gap <= GAUZE_FLAME_GAP && gap >= -GAUZE_FLAME_OVERLAP;
}

/* 容器是否坐在石棉网上：中心对齐，容器玻璃底落在网面上下 GAUZE_GAP / GAUZE_OVERLAP 内。 */
function onGauze(item, gauze) {
  var dx = item.x + TOKEN_WIDTH / 2 - (gauze.x + TOKEN_WIDTH / 2);
  if (Math.abs(dx) >= GAUZE_X_RANGE) return false;

  var gap = gauze.y + GAUZE_TOP_Y - (item.y + VESSEL_BASE_Y);
  return gap <= GAUZE_GAP && gap >= -GAUZE_OVERLAP;
}

/*
 * 受热来源：先看有没有一张「架在火焰上的石棉网」正好托着容器 —— 石棉网一旦垫进
 * 去，火焰就先烤网面，容器是被网面匀热，不再算直接受热（否则垫了网还会被判成
 * 受热不均，网就白垫了）。没有再退回直接受热。
 * 返回 { burner, gauze }，gauze 为 null 表示直接受热。
 */
function heatSource(item, items, burners) {
  var i;
  for (i = 0; i < burners.length; i += 1) {
    for (var j = 0; j < items.length; j += 1) {
      var gauze = items[j];
      if (gauze.type !== 'wire-gauze') continue;
      if (gauzeInFlame(gauze, burners[i]) && onGauze(item, gauze)) {
        return { burner: burners[i], gauze: gauze };
      }
    }
  }

  for (i = 0; i < burners.length; i += 1) {
    if (inFlame(item, burners[i])) return { burner: burners[i], gauze: null };
  }

  return null;
}

function clock() {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function number(value) {
  var rounded = Math.round(value * 10) / 10;
  return String(rounded);
}

function isLiquid(entry) {
  return entry.state !== 'solid' && entry.volume > 0;
}

function totalVolume(contents) {
  return contents.reduce(function (total, entry) {
    return isLiquid(entry) ? total + entry.volume : total;
  }, 0);
}

function mergeContents(base, additions) {
  var merged = base.map(function (entry) {
    return Object.assign({}, entry);
  });

  additions.forEach(function (addition) {
    var existing = null;
    for (var i = 0; i < merged.length; i += 1) {
      if (merged[i].chemical === addition.chemical && merged[i].state === addition.state) {
        existing = merged[i];
        break;
      }
    }

    if (existing) {
      if (addition.state === 'solid') {
        existing.mass = (existing.mass || 0) + (addition.mass || 0);
      } else {
        existing.volume = (existing.volume || 0) + (addition.volume || 0);
      }
      if (addition.label) existing.label = addition.label;
    } else {
      merged.push(Object.assign({}, addition));
    }
  });

  return merged.filter(function (entry) {
    return (entry.volume || 0) > 0 || (entry.mass || 0) > 0;
  });
}
function hexToRgb(hex) {
  var value = (hex || '').replace('#', '');
  if (value.length === 3) {
    value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
  }
  return [
    parseInt(value.slice(0, 2), 16) || 0,
    parseInt(value.slice(2, 4), 16) || 0,
    parseInt(value.slice(4, 6), 16) || 0
  ];
}

function rgbToHex(rgb) {
  return (
    '#' +
    rgb
      .map(function (value) {
        var part = Math.max(0, Math.min(255, Math.round(value))).toString(16);
        return part.length === 1 ? '0' + part : part;
      })
      .join('')
  );
}

function mixColor(contents) {
  var liquids = contents.filter(isLiquid);
  if (liquids.length === 0) return '#ffffff';

  var total = 0;
  var rgb = [0, 0, 0];

  liquids.forEach(function (entry) {
    var weight = entry.volume;
    var color = hexToRgb(speciesColor(entry.chemical));
    total += weight;
    rgb[0] += color[0] * weight;
    rgb[1] += color[1] * weight;
    rgb[2] += color[2] * weight;
  });

  return rgbToHex([rgb[0] / total, rgb[1] / total, rgb[2] / total]);
}

function mixPh(contents) {
  var liquids = contents.filter(isLiquid);
  var known = [];
  var total = 0;

  liquids.forEach(function (entry) {
    var ph = speciesPh(entry.chemical);
    if (ph === null) return;
    known.push(entry);
    total += entry.volume;
  });

  if (known.length === 0 || total === 0) return null;

  var weighted = 0;
  known.forEach(function (entry) {
    weighted += speciesPh(entry.chemical) * entry.volume;
  });

  return Math.round((weighted / total) * 10) / 10;
}

/*
 * 内容 → 容器状态的唯一收口。
 * 颜色先按液体体积加权混色，再由指示剂显色覆盖（酚酞红 / 石蕊红蓝）。
 * 沸腾也在这里派生：只有「有液体 + 温度到沸点」才沸腾，倒掉液体或降温后
 * 自动复位，不需要额外的状态清理。
 */
function isBoiling(contents, temperature) {
  return temperature >= BOIL_POINT - 0.5 && contents.some(isLiquid);
}

function syncItem(item, contents, temperature) {
  var ph = mixPh(contents);
  var tint = indicatorTint(contents, ph);
  var nextTemperature =
    typeof temperature === 'number' ? Math.round(temperature * 10) / 10 : item.temperature;

  return Object.assign({}, item, {
    contents: contents,
    volume: Math.round(totalVolume(contents) * 10) / 10,
    color: tint || mixColor(contents),
    ph: ph,
    temperature: nextTemperature,
    boiling: isBoiling(contents, nextTemperature)
  });
}

function createItem(source, point, index) {
  ITEM_SERIAL += 1;

  var fallbackX = 24 + (index % 4) * 124;
  var fallbackY = 24 + Math.floor(index / 4) * 140;

  return {
    id: 'lab-item-' + ITEM_SERIAL,
    type: source.id,
    kind: source.kind,
    name: source.name,
    formula: source.formula || '',
    x: Math.round(point ? point.x : fallbackX),
    y: Math.round(point ? point.y : fallbackY),
    contents: [],
    temperature: 25,
    color: '#ffffff',
    ph: null,
    volume: 0,
    capacity: source.capacity || 0,
    lit: false,
    litUntil: 0,
    matchLeft: 0,
    inUse: false,
    heating: false,
    boiling: false,
    hot: false,
    evenHeat: false,
    unevenWarned: false,
    gas: null,
    gasAt: 0,
    phenomenon: null,
    phenomenonAt: 0
  };
}

function reagentLabel(reagent) {
  return reagent.logName || reagent.formula || reagent.chemical || reagent.name;
}

function findItem(items, id) {
  for (var i = 0; i < items.length; i += 1) {
    if (items[i].id === id) return items[i];
  }
  return null;
}

/* 台面上是否有一根还燃着的火柴：酒精灯点火的前提。 */
function burningMatch(items) {
  var now = Date.now();

  for (var i = 0; i < items.length; i += 1) {
    var item = items[i];
    if (item.type === 'match' && item.lit && item.litUntil > now) return item;
  }
  return null;
}

var bootLog = {
  id: 'boot',
  time: clock(),
  level: '系统',
  text: '实验室已就绪。'
};


export var useLabStore = create(function (set, get) {
  function addLog(level, text) {
    LOG_SERIAL += 1;
    set(function (state) {
      return {
        logs: state.logs.concat({
          id: 'log-' + Date.now() + '-' + LOG_SERIAL,
          time: clock(),
          level: level,
          text: text
        })
      };
    });
  }

  function replaceItem(next) {
    set(function (state) {
      return {
        items: state.items.map(function (item) {
          return item.id === next.id ? next : item;
        })
      };
    });
  }

  /*
   * 只计算不写状态：把混合后的 contents 交给反应引擎结算，
   * 返回反应后的容器、是否真的发生了反应，以及需要写入实验日志的条目。
   */
  function settleContents(item, contents, temperature) {
    var beforeTint = indicatorTint(item.contents, item.ph);
    var result = reactContents(contents, temperature);
    var next = syncItem(item, result.contents, result.temperature);
    var logs = [];

    if (result.changed) {
      var gasEvent = null;
      result.events.forEach(function (event) {
        if (event.rule.gas) gasEvent = event;
      });
      var last = result.events[result.events.length - 1];

      next = Object.assign({}, next, {
        gas: gasEvent ? gasEvent.rule.gas.label : null,
        gasAt: gasEvent ? Date.now() : 0,
        phenomenon: last.rule.phenomenon,
        phenomenonAt: Date.now()
      });

      result.events.forEach(function (event) {
        logs.push(['反应', describeReaction(event)]);
      });

      var gasText = describeGas(result.events);
      if (gasText) logs.push(['反应', gasText]);
    }

    /* 指示剂刚加入，或颜色随 pH 翻转时补一条现象说明。 */
    var afterTint = indicatorTint(next.contents, next.ph);
    var indicatorChanged =
      afterTint !== beforeTint ||
      (!hasIndicator(item.contents) && hasIndicator(next.contents));
    var tintText = indicatorText(next.contents, next.ph);
    if (indicatorChanged && tintText) logs.push(['反应', tintText]);

    return { item: next, logs: logs, reacted: result.changed };
  }

  function applySettled(settled) {
    replaceItem(settled.item);
    settled.logs.forEach(function (entry) {
      addLog(entry[0], entry[1]);
    });
  }

  return {
    items: [],
    selectedId: null,
    logs: [bootLog],

    addLog: addLog,

    clearLogs: function () {
      set({ logs: [] });
    },

    addItem: function (source, point) {
      if (!source || (source.kind !== 'container' && source.kind !== 'tool')) {
        addLog('警告', '只有容器和工具可以放到实验台。');
        return null;
      }

      var state = get();
      var next = createItem(source, point, state.items.length);

      set({
        items: state.items.concat(next),
        selectedId: next.id
      });
      addLog('操作', '放置 ' + source.name + '。');
      return next.id;
    },

    moveItem: function (id, x, y) {
      var item = findItem(get().items, id);
      if (!item) return;
      var nextX = Math.round(x);
      var nextY = Math.round(y);
      if (nextX === item.x && nextY === item.y) return;

      /*
       * 移动后把器材排到数组末尾：DOM 顺序靠后，同层级时压在其它器材上面，
       * 符合“拿起来放到别处就该在最前面”的直觉。
       */
      set(function (state) {
        var moved = null;
        var rest = state.items.filter(function (entry) {
          if (entry.id !== id) return true;
          moved = Object.assign({}, entry, { x: nextX, y: nextY });
          return false;
        });

        return moved ? { items: rest.concat(moved) } : {};
      });
      addLog('操作', '移动 ' + item.name + '。');
    },

    selectItem: function (id) {
      var item = findItem(get().items, id);
      if (!item) {
        set({ selectedId: null });
        return;
      }
      if (get().selectedId === id) return;

      set({ selectedId: id });
    },

    removeItem: function (id) {
      var item = findItem(get().items, id);
      if (!item) return false;

      set(function (state) {
        return {
          items: state.items.filter(function (entry) {
            return entry.id !== id;
          }),
          selectedId: state.selectedId === id ? null : state.selectedId
        };
      });
      addLog('操作', '移走 ' + item.name + '。');
      return true;
    },

    clearSelection: function () {
      set({ selectedId: null });
    },

    /*
     * 点燃 / 熄灭可以点火的东西，返回操作后的点燃状态。
     * 火柴本身是火源：划燃后只能烧 MATCH_DURATION 毫秒，燃尽自动熄灭；
     * 酒精灯必须用还燃着的火柴点，于是顺序是「取出火柴 → 划燃 → 点燃酒精灯」，
     * 和真实实验里的操作一致。灯帽的移开动画由 Vessel.jsx 按 lit 状态播放。
     */
    lightItem: function (id) {
      var items = get().items;
      var item = findItem(items, id);
      if (!item) return false;

      if (item.type === 'match') {
        var strike = !item.lit;
        replaceItem(
          Object.assign({}, item, {
            lit: strike,
            litUntil: strike ? Date.now() + MATCH_DURATION : 0,
            matchLeft: strike ? Math.round(MATCH_DURATION / 1000) : 0
          })
        );
        addLog('操作', (strike ? '划燃 ' : '熄灭 ') + item.name + '。');
        return strike;
      }

      if (item.type !== 'burner') {
        addLog('警告', '只有火柴和酒精灯可以点燃。');
        return false;
      }

      if (item.lit) {
        replaceItem(Object.assign({}, item, { lit: false, inUse: false }));
        addLog('操作', '熄灭 ' + item.name + '。');
        return false;
      }

      if (!burningMatch(items)) {
        addLog('警告', item.name + ' 要用火柴点燃：先取出火柴并划燃。');
        return false;
      }

      replaceItem(Object.assign({}, item, { lit: true }));
      addLog('操作', '用火柴点燃 ' + item.name + '。');
      return true;
    },

    /*
     * 把容器架到石棉网上：x 对齐、玻璃底贴住网面（留 2px 缝隙）。
     * 吸附后容器底正好落在 onGauze 的判定窗口里，只要石棉网架在火焰上，
     * 就能隔着网受热（受热均匀，不会再记「受热不均」的警告）。
     */
    standOnGauze: function (containerId, gauzeId) {
      var items = get().items;
      var container = findItem(items, containerId);
      var gauze = findItem(items, gauzeId);
      if (!container || !gauze) return false;

      get().moveItem(containerId, gauze.x, gauze.y + GAUZE_TOP_Y - VESSEL_BASE_Y - 2);
      addLog('操作', container.name + ' 架在石棉网上。');
      return true;
    },

    /*
     * 把石棉网垫到容器下面。容器正架在火焰上时连容器一起抬起来：网面落在焰尖
     * 上方、容器坐在网面上，两件器材在一次 set() 里换位，日志只留一条。
     */
    stackGauze: function (gauzeId, containerId) {
      var state = get();
      var gauze = findItem(state.items, gauzeId);
      var container = findItem(state.items, containerId);
      if (!gauze || !container) return false;

      var burner = null;
      state.items.forEach(function (entry) {
        if (burner || entry.type !== 'burner' || !entry.lit) return;
        if (inFlame(container, entry)) burner = entry;
      });

      var nextGauze;
      var nextContainer = null;

      if (burner) {
        nextGauze = Object.assign({}, gauze, {
          x: burner.x,
          y: Math.max(4, burner.y + FLAME_TIP_Y - GAUZE_BOTTOM_Y - 2)
        });
        nextContainer = Object.assign({}, container, {
          x: burner.x,
          y: Math.max(4, nextGauze.y + GAUZE_TOP_Y - VESSEL_BASE_Y - 2)
        });
      } else {
        nextGauze = Object.assign({}, gauze, {
          x: container.x,
          y: Math.max(4, container.y + VESSEL_BASE_Y - GAUZE_TOP_Y - 2)
        });
      }

      set(function (current) {
        return {
          items: current.items.map(function (entry) {
            if (entry.id === nextGauze.id) return nextGauze;
            if (nextContainer && entry.id === nextContainer.id) return nextContainer;
            return entry;
          })
        };
      });

      addLog(
        '操作',
        burner
          ? '石棉网 垫在 ' + container.name + ' 与火焰之间。'
          : '石棉网 垫在 ' + container.name + ' 下面。'
      );
      return true;
    },

    /*
     * 加热引擎，由页面每 1s 调用一次。
     * 点燃的酒精灯给邻近容器升温；没有火焰的容器自然降温回室温。
     * 温度没有变化时直接返回，避免无意义的重渲染。
     */
    tickHeating: function () {
      var state = get();
      var burners = state.items.filter(function (item) {
        return item.type === 'burner' && item.lit;
      });

      /*
       * 先算出「哪些火焰上真的架了容器」，再逐件结算：
       * 容器在数组里的顺序会随拖拽置顶变化，两遍扫描才能保证酒精灯的 inUse
       * 和容器的受热结果一致（有容器架着时火焰光晕更亮）。
       */
      var flameInUse = {};
      state.items.forEach(function (item) {
        if (item.kind === 'container') {
          burners.forEach(function (burner) {
            if (inFlame(item, burner)) flameInUse[burner.id] = true;
          });
          return;
        }

        /* 石棉网架在火焰上也算「火焰上有东西」，外焰同样增亮。 */
        if (item.type === 'wire-gauze') {
          burners.forEach(function (burner) {
            if (gauzeInFlame(item, burner)) flameInUse[burner.id] = true;
          });
        }
      });

      var logs = [];
      var changed = false;

      var nextItems = state.items.map(function (item) {
        /* 火柴：每秒刷新剩余燃烧时间，燃尽后自动熄灭。 */
        if (item.type === 'match') {
          if (!item.lit) return item;

          var matchLeft = Math.max(0, Math.ceil((item.litUntil - Date.now()) / 1000));
          if (matchLeft <= 0) {
            changed = true;
            logs.push(['操作', '火柴 燃尽了。']);
            return Object.assign({}, item, { lit: false, litUntil: 0, matchLeft: 0 });
          }
          if (matchLeft === item.matchLeft) return item;

          changed = true;
          return Object.assign({}, item, { matchLeft: matchLeft });
        }

        /* 酒精灯：火焰上是否架着容器 / 石棉网，决定光晕强弱。 */
        if (item.type === 'burner') {
          var inUse = !!item.lit && !!flameInUse[item.id];
          if (inUse === !!item.inUse) return item;
          changed = true;
          return Object.assign({}, item, { inUse: inUse });
        }

        /* 石棉网：网面是否正被火焰烤着，决定网格是否转暖色。 */
        if (item.type === 'wire-gauze') {
          var gauzeHot = burners.some(function (burner) {
            return gauzeInFlame(item, burner);
          });
          if (gauzeHot === !!item.hot) return item;
          changed = true;
          return Object.assign({}, item, { hot: gauzeHot });
        }

        if (item.kind !== 'container') return item;

        /*
         * 气泡只显示 GAS_DURATION 毫秒，到期由加热 tick 顺带清掉；
         * 放气时同步写入的现象说明也一起收起，避免文字和画面不一致。
         * 沉淀等其他现象不设时限，因为固体一直留在容器里。
         */
        var expiredGas = !!item.gas && Date.now() - item.gasAt > GAS_DURATION;
        var base = expiredGas
          ? Object.assign({}, item, { gas: null, gasAt: 0, phenomenon: null, phenomenonAt: 0 })
          : item;
        if (expiredGas) changed = true;

        var source = heatSource(base, state.items, burners);
        var heated = !!source;
        var even = heated && !!source.gauze;

        if (!heated && base.temperature <= AMBIENT) {
          if (!base.heating && !base.unevenWarned) return base;
          changed = true;
          return Object.assign({}, base, {
            heating: false,
            evenHeat: false,
            unevenWarned: false
          });
        }

        var wet = base.contents.some(isLiquid);
        var limit = wet ? BOIL_POINT : DRY_LIMIT;
        var temperature = base.temperature;
        var itemLogs = [];
        var unevenWarned = !!base.unevenWarned;

        if (heated) {
          temperature = Math.min(limit, temperature + HEAT_RATE);
          if (!base.heating) itemLogs.push(['操作', item.name + ' 开始受热。']);
          if (!even && !unevenWarned && temperature >= UNEVEN_TEMPERATURE) {
            itemLogs.push([
              '警告',
              item.name + ' 直接架在火焰上，玻璃受热不均（建议垫上石棉网）。'
            ]);
            unevenWarned = true;
          }
          if (wet && base.temperature < BOIL_POINT && temperature >= BOIL_POINT) {
            itemLogs.push(['警告', item.name + ' 中的液体沸腾了（' + BOIL_POINT + '°C）。']);
          }
        } else {
          temperature = Math.max(AMBIENT, temperature - COOL_RATE);
          if (base.heating) itemLogs.push(['操作', item.name + ' 停止受热，开始降温。']);
        }

        temperature = Math.round(temperature * 10) / 10;

        /*
         * 温度变化后再让引擎结算一次：受热分解靠规则的 minTemperature 触发，
         * 已经到上限（100°C / 160°C）还在受热的容器也能继续分解剩余固体。
         */
        var draft = Object.assign({}, base, {
          heating: heated,
          evenHeat: even,
          unevenWarned: unevenWarned
        });
        var settled = settleContents(draft, draft.contents, temperature);
        var stateChanged =
          temperature !== base.temperature ||
          heated !== !!base.heating ||
          even !== !!base.evenHeat;

        if (!stateChanged && !settled.reacted) return base;

        changed = true;
        itemLogs.forEach(function (entry) {
          logs.push(entry);
        });

        if (settled.reacted) {
          settled.logs.forEach(function (entry) {
            logs.push(entry);
          });
        }

        return settled.item;
      });

      if (!changed) return;

      set({ items: nextItems });
      logs.forEach(function (entry) {
        addLog(entry[0], entry[1]);
      });
    },


    addReagent: function (targetId, reagent, amount) {
      var target = findItem(get().items, targetId);
      if (!target || target.kind !== 'container') {
        addLog('警告', '试剂只能加入容器。');
        return false;
      }

      if (reagent.state === 'solid') {
        var mass = amount || reagent.defaultMass || 1;
        var solid = {
          chemical: reagent.chemical || reagent.name,
          label: reagentLabel(reagent),
          name: reagent.name,
          state: 'solid',
          mass: mass,
          volume: 0,
          color: speciesColor(reagent.chemical || reagent.name)
        };
        var solidContents = mergeContents(target.contents, [solid]);
        applySettled(settleContents(target, solidContents, target.temperature));
        addLog('操作', '将 ' + number(mass) + 'g ' + reagentLabel(reagent) + ' 加入' + target.name + '。');
        return true;
      }

      var free = Math.max(0, target.capacity - totalVolume(target.contents));
      var wanted = amount || reagent.defaultVolume || 10;
      var volume = Math.round(Math.min(wanted, free) * 10) / 10;

      if (volume <= 0) {
        addLog('警告', target.name + ' 已满，无法加入 ' + reagentLabel(reagent) + '。');
        return false;
      }

      var liquid = {
        chemical: reagent.chemical || reagent.name,
        label: reagentLabel(reagent),
        name: reagent.name,
        state: 'liquid',
        volume: volume
      };
      var contents = mergeContents(target.contents, [liquid]);
      applySettled(settleContents(target, contents, target.temperature));

      addLog(
        '操作',
        '将 ' + number(volume) + 'mL ' + reagentLabel(reagent) + ' 加入' + target.name + '。' +
          (volume < wanted ? '（容器容量不足）' : '')
      );
      return true;
    },


    pour: function (sourceId, targetId) {
      if (sourceId === targetId) return false;

      var state = get();
      var source = findItem(state.items, sourceId);
      var target = findItem(state.items, targetId);

      if (!source || !target || source.kind !== 'container' || target.kind !== 'container') {
        addLog('警告', '只能把液体倒入另一个容器。');
        return false;
      }

      var sourceLiquids = source.contents.filter(isLiquid);
      var sourceVolume = totalVolume(source.contents);
      if (sourceVolume <= 0) {
        addLog('警告', source.name + ' 中没有可倾倒的液体。');
        return false;
      }

      var free = Math.max(0, target.capacity - totalVolume(target.contents));
      if (free <= 0) {
        addLog('警告', target.name + ' 已满，无法接收更多液体。');
        return false;
      }

      var ratio = Math.min(1, free / sourceVolume);
      var movedAmounts = sourceLiquids.map(function (entry) {
        return Math.round(entry.volume * ratio * 10) / 10;
      });
      var moved = sourceLiquids
        .map(function (entry, index) {
          return Object.assign({}, entry, { volume: movedAmounts[index] });
        })
        .filter(function (entry) {
          return entry.volume > 0;
        });

      var movedVolume = totalVolume(moved);
      if (movedVolume <= 0) {
        addLog('警告', target.name + ' 无法接收液体。');
        return false;
      }

      var remaining = [];
      source.contents.forEach(function (entry) {
        if (!isLiquid(entry)) {
          remaining.push(Object.assign({}, entry));
          return;
        }
        var index = sourceLiquids.indexOf(entry);
        var left = Math.round((entry.volume - movedAmounts[index]) * 10) / 10;
        if (left > 0) {
          remaining.push(Object.assign({}, entry, { volume: left }));
        }
      });

      var targetVolumeBefore = totalVolume(target.contents);
      var targetTemperature =
        targetVolumeBefore > 0
          ? (target.temperature * targetVolumeBefore + source.temperature * movedVolume) /
            (targetVolumeBefore + movedVolume)
          : source.temperature;

      var sourceNext = syncItem(source, remaining, source.temperature);
      var settled = settleContents(
        target,
        mergeContents(target.contents, moved),
        Math.round(targetTemperature * 10) / 10
      );
      var targetNext = settled.item;

      set(function (current) {
        return {
          items: current.items.map(function (item) {
            if (item.id === sourceNext.id) return sourceNext;
            if (item.id === targetNext.id) return targetNext;
            return item;
          })
        };
      });

      addLog(
        '操作',
        '将 ' + number(movedVolume) + 'mL 液体从' + source.name + '倒入' + target.name + '。' +
          (movedVolume < sourceVolume - 0.05 ? '（' + target.name + ' 容量不足）' : '')
      );
      settled.logs.forEach(function (entry) {
        addLog(entry[0], entry[1]);
      });
      return true;
    },


    dumpLiquid: function (id) {
      var item = findItem(get().items, id);
      if (!item || item.kind !== 'container') return;

      var volume = totalVolume(item.contents);
      if (volume <= 0) {
        addLog('警告', item.name + ' 中没有液体。');
        return;
      }

      var remaining = item.contents.filter(function (entry) {
        return !isLiquid(entry);
      });
      replaceItem(
        syncItem(Object.assign({}, item, { gas: null, gasAt: 0 }), remaining, item.temperature)
      );
      addLog('操作', '倒出 ' + number(volume) + 'mL 液体（' + item.name + '）。');
    },

    clearContents: function (id) {
      var item = findItem(get().items, id);
      if (!item || item.kind !== 'container') return;

      if (item.contents.length === 0) {
        addLog('警告', item.name + ' 已经是空的。');
        return;
      }

      replaceItem(
        syncItem(
          Object.assign({}, item, {
            temperature: 25,
            gas: null,
            gasAt: 0,
            phenomenon: null,
            phenomenonAt: 0
          }),
          [],
          25
        )
      );
      addLog('操作', '清空 ' + item.name + '。');
    }
  };
});

