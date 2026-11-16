/**
 * store.js —— 虚拟实验室的 Zustand 全局状态与容器操作
 * ------------------------------------------------------------------
 * 容器统一模型：{ id, type, contents, temperature, color, ph, volume, capacity }
 * 本步骤实现落台、移动、加试剂、倾倒、倒出与清空；加热和反应引擎
 * 在后续步骤接入，所有 contents / temperature 更新都必须经过 syncItem()。
 */

import { create } from 'zustand';

var LIQUID_COLORS = {
  HCl: '#e2ecef',
  H2SO4: '#e2ecef',
  HNO3: '#e2ecef',
  NaOH: '#e2ecef',
  KOH: '#e2ecef',
  NaCl: '#e2ecef',
  CuSO4: '#4f8bc8',
  AgNO3: '#e2ecef',
  BaCl2: '#e2ecef',
  Na2CO3: '#e2ecef',
  phenolphthalein: '#edf2f1',
  litmus: '#e8eef0'
};

var LIQUID_PH = {
  HCl: 1,
  H2SO4: 0.5,
  HNO3: 1,
  NaOH: 13,
  KOH: 13,
  NaCl: 7,
  CuSO4: 4.5,
  AgNO3: 6,
  BaCl2: 7,
  Na2CO3: 11
};

/* ---------------- 加热模型 ----------------
 * 酒精灯点燃后，与「火焰令牌」中心距小于 HEAT_RANGE 的容器每秒升温 HEAT_RATE；
 * 离开火焰的容器每秒降温 COOL_RATE 直到回到室温。有液体时升温止于沸点，
 * 空容器（干烧）止于 DRY_LIMIT。所有温度更新都经过 syncItem()。
 */
var TOKEN_WIDTH = 104;
var TOKEN_HEIGHT = 128;
var HEAT_RANGE = 122;
var HEAT_RATE = 4;
var COOL_RATE = 2;
var AMBIENT = 25;
var BOIL_POINT = 100;
var DRY_LIMIT = 160;

var ITEM_SERIAL = 0;
var LOG_SERIAL = 0;

function itemCentre(item) {
  return { x: item.x + TOKEN_WIDTH / 2, y: item.y + TOKEN_HEIGHT / 2 };
}

function centreDistance(first, second) {
  var a = itemCentre(first);
  var b = itemCentre(second);
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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
    var color = hexToRgb(LIQUID_COLORS[entry.chemical] || '#e2ecef');
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
    if (typeof LIQUID_PH[entry.chemical] !== 'number') return;
    known.push(entry);
    total += entry.volume;
  });

  if (known.length === 0 || total === 0) return null;

  var weighted = 0;
  known.forEach(function (entry) {
    weighted += LIQUID_PH[entry.chemical] * entry.volume;
  });

  return Math.round((weighted / total) * 10) / 10;
}

function syncItem(item, contents, temperature) {
  return Object.assign({}, item, {
    contents: contents,
    volume: Math.round(totalVolume(contents) * 10) / 10,
    color: mixColor(contents),
    ph: mixPh(contents),
    temperature:
      typeof temperature === 'number' ? Math.round(temperature * 10) / 10 : item.temperature
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
    heating: false
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

      replaceItem(
        Object.assign({}, item, {
          x: nextX,
          y: nextY
        })
      );
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

    /* 点燃 / 熄灭酒精灯。返回点燃后的状态。 */
    toggleBurner: function (id) {
      var item = findItem(get().items, id);
      if (!item || item.type !== 'burner') {
        addLog('警告', '只有酒精灯可以点燃。');
        return false;
      }

      var lit = !item.lit;
      replaceItem(Object.assign({}, item, { lit: lit }));
      addLog('操作', (lit ? '点燃 ' : '熄灭 ') + item.name + '。');
      return lit;
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

      var logs = [];
      var changed = false;

      var nextItems = state.items.map(function (item) {
        if (item.kind !== 'container') return item;

        var heated = burners.some(function (burner) {
          return centreDistance(item, burner) <= HEAT_RANGE;
        });

        if (!heated && item.temperature <= AMBIENT) {
          if (!item.heating) return item;
          changed = true;
          return Object.assign({}, item, { heating: false });
        }

        var wet = item.contents.some(isLiquid);
        var limit = wet ? BOIL_POINT : DRY_LIMIT;
        var temperature = item.temperature;

        if (heated) {
          temperature = Math.min(limit, temperature + HEAT_RATE);
          if (!item.heating) logs.push(['操作', item.name + ' 开始受热。']);
          if (wet && item.temperature < BOIL_POINT && temperature >= BOIL_POINT) {
            logs.push(['警告', item.name + ' 中的液体沸腾了（' + BOIL_POINT + '°C）。']);
          }
        } else {
          temperature = Math.max(AMBIENT, temperature - COOL_RATE);
          if (item.heating) logs.push(['操作', item.name + ' 停止受热，开始降温。']);
        }

        temperature = Math.round(temperature * 10) / 10;
        if (temperature === item.temperature && heated === !!item.heating) return item;

        changed = true;
        return syncItem(Object.assign({}, item, { heating: heated }), item.contents, temperature);
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
          volume: 0
        };
        var solidContents = mergeContents(target.contents, [solid]);
        replaceItem(syncItem(target, solidContents, target.temperature));
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
      replaceItem(syncItem(target, contents, target.temperature));

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
      var targetNext = syncItem(
        target,
        mergeContents(target.contents, moved),
        Math.round(targetTemperature * 10) / 10
      );

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
      replaceItem(syncItem(item, remaining, item.temperature));
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
            temperature: 25
          }),
          [],
          25
        )
      );
      addLog('操作', '清空 ' + item.name + '。');
    }
  };
});

