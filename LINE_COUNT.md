# ChemLearn 代码行数统计说明

本文件用于证明交付代码量满足 PRD「总代码量 ≥ 8000 行（HTML + CSS + JS + JSON 数据合计，以实际文件行数为准）」的要求，并说明统计口径。

## 一、统计命令

在项目根目录执行：

```bash
wc -l index.html css/*.css js/*.js lab/src/*.js lab/src/*.jsx lab/src/canvas/* lab/src/canvas/art/* lab/src/canvas/effects/* data/*.json
```

结果（2026-11 统计）：

| 文件 | 行数 |
| --- | ---: |
| `index.html` | 117 |
| `css/base.css` | 512 |
| `css/layout.css` | 440 |
| `css/components.css` | 1,634 |
| `css/pages.css` | 3,207 |
| `js/utils.js` | 570 |
| `js/storage.js` | 400 |
| `js/data.js` | 325 |
| `js/router.js` | 218 |
| `js/knowledge.js` | 374 |
| `js/quiz.js` | 677 |
| `js/wrongbook.js` | 277 |
| `js/molecule3d.js` | 985 |
| `js/tools.js` | 765 |
| `js/app.js` | 299 |
| `lab/src/LabPage.jsx` | 1,569 |
| `lab/src/store.js` | 1,781 |
| `lab/src/canvas/art/LiquidBody.jsx` | 346 |
| `lab/src/canvas/art/FlameShape.jsx` | 125 |
| `lab/src/canvas/art/ToolShapes.jsx` | 406 |
| `lab/src/canvas/art/GlassShape.jsx` | 264 |
| `lab/src/canvas/art/BeakerShape.jsx` | 178 |
| `lab/src/canvas/effects/PourStream.jsx` | 189 |
| `lab/src/canvas/effects/VesselFx.jsx` | 200 |
| `lab/src/canvas/flow.js` | 134 |
| `lab/src/canvas/motion.js` | 106 |
| `lab/src/canvas/geometry.js` | 249 |
| `lab/src/canvas/KonvaBench.jsx` | 362 |
| `lab/src/canvas/DeskLayer.jsx` | 186 |
| `lab/src/canvas/palette.js` | 138 |
| `lab/src/canvas/EquipmentNode.jsx` | 153 |
| `lab/src/canvas/EquipmentArt.jsx` | 121 |
| `lab/src/canvas/EquipmentImage.jsx` | 106 |
| `lab/src/canvas/liquid.js` | 105 |
| `lab/src/canvas/LabStage.jsx` | 87 |
| `lab/src/canvas/useStageSize.js` | 52 |
| `lab/src/Glass.jsx` | 666 |
| `lab/src/reactions.js` | 633 |
| `lab/src/Vessel.jsx` | 432 |
| `lab/src/art.js` | 274 |
| `lab/src/icons.jsx` | 227 |
| `lab/src/library.js` | 140 |
| `lab/src/engine.js` | 19 |
| `lab/src/main.jsx` | 48 |
| `data/knowledge.json` | 1,098 |
| `data/quiz.json` | 640 |
| `data/molecules.json` | 2,551 |
| `data/nameMap.json` | 55 |
| `data/equations.json` | 414 |
| **合计** | **24,854** |

## 二、分类汇总

| 类别 | 行数 | 占比 |
| --- | ---: | ---: |
| HTML | 117 | 0.5% |
| CSS | 5,793 | 23.3% |
| JavaScript / JSX | 14,186 | 57.1% |
| JSON 数据 | 4,758 | 19.1% |
| **核心交付代码合计** | **24,854** | **100%** |

```
24,854 ÷ 8,000 ≈ 3.11 倍
```

超出 PRD 最低要求约 211%。

## 三、附加文件（不计入核心交付代码）

| 文件 | 行数 | 说明 |
| --- | ---: | --- |
| `tools/gen_molecules.py` | 746 | 由理想几何构型生成 33 个分子坐标 |
| `tools/build_data.py` | 231 | 校验数据并生成 `data/*.js` 包装文件 |
| `tools/smoke_test.js` | 220 | 44 项断言的冒烟测试（JavaScriptCore） |
| `tools/lab_reactions_test.js` | 225 | 56 项断言的实验室反应引擎自测（JavaScriptCore） |
| `tools/syntax_check.js` | 74 | 逐文件语法与加载检查 |
| `data/*.js`（5 个） | 30 | 自动生成的包装文件（每个 6 行） |
| `package.json` | 20 | 实验室源码重建依赖与脚本（含 Konva / react-konva） |
| `lab/README.md` | 419 | 实验室分步说明与重建命令 |
| `lab/assets/equipment/README.md` | 22 | 可选 PNG 器材贴图的命名与出图约定 |
| `lab/chem-lab.js` | 87 | esbuild 打包运行时（含第三方库与许可注释） |
| **附加合计** | **2,074** | |

全部文件（含附加）总计：**26,928 行**（另附 `README.md` 530 行说明文档，不计入）。

## 四、统计口径说明

1. **行数来源**：使用系统 `wc -l` 统计物理行数，不以“有效代码行”折算，也不排除空行与注释；这与 PRD「以实际文件行数为准」的表述一致。
2. **不灌水**：
   - 没有任何空函数、占位 TODO 或复制粘贴的重复逻辑；
   - 知识点讲解、题目解析、易错点均为针对具体概念撰写的实质内容（例如“氢键与水的反常性质”包含 4 段讲解、2 个带步骤的实例、4 条易错点与 4 条小结）；
   - CSS 按组件 / 页面拆分，全站页面改版后已删除无引用的旧卡片、统计条与徽标样式，保留的选择器均有实际用途；
   - 3D 渲染器、配平算法、VSEPR 推测均为真实实现，并配有测试；
   - 虚拟实验室使用 React + Zustand 按「1px = 1mm」的物理尺度重写：左侧是按分类折叠的 2 列图标库（32×32 线稿图标按器材形状 / 试剂状态 / 液体色相分派，替代旧文字列表），中间是带标尺网格与台面线的实验台，右侧是浮层属性面板（器材名称可直接改名、mol·L⁻¹ 浓度可录入、Vol / Temp / PH、受热状态、Contents、现象、加入试剂 / 倒出 / 搅拌 / 振荡 / 冲洗 / 开塞 / 清空 / 取下 / 点燃 / 移走）。器材按真实毫米尺寸建模（250mL 烧杯 78×100、20mL 试管 20×152、铁架台 200×560、玻璃棒 φ6×236、酒精灯 80×118、石棉网 120×10、试剂瓶 62×182），拖拽落点按真实 hit-box 钳制，松手后按重力沉降：先判定石棉网、再判定焰尖、最后落到台面；试管松手时按底部到环的距离吸附进铁夹，石棉网落焰吸附，火柴只能点燃燃着的酒精灯；倾倒用几何对准（瓶口对准容器口 + 高度差）生成三层水柱并做体积 / 容量结算，不是静态占位图。
3. **数据文件计入**：PRD 明确把 JSON 数据计入总行数；`data/molecules.json` 的 2,551 行来自 33 个分子的逐原子坐标与逐键连接，`data/knowledge.json` 的 1,098 行来自 20 个知识点的完整讲解，均属于产品内容本身，不是重复填充。
4. **包装文件单列**：`data/*.js` 是为了支持 `file://` 直接运行而由脚本生成的同内容副本，只有 30 行（每个文件一行 JSON），已在统计中单列，避免重复计算数据量。
5. **实验室打包文件单列**：`lab/chem-lab.js` 是 esbuild 产物（含 React / Zustand / Konva / react-konva / dnd-kit 及许可注释），不计入核心源码；`lab/src/` 下 9,296 行 JSX/JS 才是实际维护的实验室代码（其中 3,507 行是 `canvas/` 的 Canvas 引擎：Stage 与三层 Layer、背景网格 / 台面线 / 标尺、器材节点与贴图出口、烧杯五层玻璃与其余 12 种器型的矢量外形、边界钳制与吸附几何、内腔与液面、渐变调色，以及步骤 3–4 的动画时钟 `motion.js`、倒液水柱几何 `flow.js`、会起伏的 `LiquidBody`、逐帧抖动的 `FlameShape` 与气泡 / 沉淀 / 蒸汽特效），其中 1,781 行是 Zustand 状态与物理引擎（毫米级 `TOOLS` 尺寸表、`hitBox` / `dimensionsOf` / `boundsOf` / `mouthPoint` / `basePoint`、松手 `settleY` 的石棉网 → 焰尖 → 台面三级沉降、铁架台铁夹距离吸附、火焰与石棉网两段受热判定、均匀受热与受热不均、沸腾派生、火柴燃烧计时与点火校验、瓶塞开合门禁、倾倒动画状态机、按 `art.top/bottom` 反算液面与杆尖、搅拌 / 振荡 / 冲洗 / 改名 / 浓度）、1,569 行是页面与交互（图标库、跟手幽灵、指针偏移换算、试剂落点命中、浮层 `BenchPanel` 的草稿提交与操作按钮、窄屏面板下移），666 行是三段 SVG 渲染（液面 / 反应现象），633 行是反应规则表与引擎，432 行是器材 SVG（酒精灯玻璃灯体 / 可移除灯帽 / 三层火焰 + 受用高亮、火柴、铁架台 200×560 与环、φ6 玻璃棒、胶头滴管、石棉网、pH 试纸），274 行是毫米尺寸与器材映射表 `art.js`，227 行是 32×32 线稿图标 `icons.jsx`，140 行是器材与预置试剂清单，19 行是引擎开关 `engine.js`，48 行是入口挂载。

## 五、复现校验

```bash
# 1. 校验数据并重新生成包装文件
python3 tools/build_data.py

# 2. 语法与加载检查
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/syntax_check.js

# 3. 冒烟测试（44 项）
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/smoke_test.js

# 4. 实验室反应引擎测试（56 项）
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/lab_reactions_test.js

# 5. 行数统计（核心源码）
wc -l index.html css/*.css js/*.js lab/src/*.js lab/src/*.jsx lab/src/canvas/*.js lab/src/canvas/*.jsx lab/src/canvas/art/*.jsx lab/src/canvas/effects/*.jsx data/*.json

# 6. 实验室源码变更后重建运行时
npm install
npm run build:lab
```
