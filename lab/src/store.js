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
function inFlame(item, burner) {
  var dx = item.x + TOKEN_WIDTH / 2 - (burner.x + FLAME_CENTRE_X);
  if (Math.abs(dx) >= FLAME_X_RANGE) return false;

  var gap = burner.y + FLAME_TIP_Y - (item.y + VESSEL_BASE_Y);
  return gap <= FLAME_GAP && gap >= -FLAME_OVERLAP;
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
        if (item.kind !== 'container') return;
        burners.forEach(function (burner) {
          if (inFlame(item, burner)) flameInUse[burner.id] = true;
        });
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

        /* 酒精灯：火焰上是否架着容器，决定光晕强弱。 */
        if (item.type === 'burner') {
          var inUse = !!item.lit && !!flameInUse[item.id];
          if (inUse === !!item.inUse) return item;
          changed = true;
          return Object.assign({}, item, { inUse: inUse });
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

        var heated = burners.some(function (burner) {
          return inFlame(item, burner);
        });

        if (!heated && base.temperature <= AMBIENT) {
          if (!base.heating) return base;
          changed = true;
          return Object.assign({}, base, { heating: false });
        }

        var wet = base.contents.some(isLiquid);
        var limit = wet ? BOIL_POINT : DRY_LIMIT;
        var temperature = base.temperature;
        var itemLogs = [];

        if (heated) {
          temperature = Math.min(limit, temperature + HEAT_RATE);
          if (!base.heating) itemLogs.push(['操作', item.name + ' 开始受热。']);
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
        var draft = Object.assign({}, base, { heating: heated });
        var settled = settleContents(draft, draft.contents, temperature);
        var stateChanged = temperature !== base.temperature || heated !== !!base.heating;

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

