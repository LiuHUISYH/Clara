# ChemLearn 代码行数统计说明

本文件用于证明交付代码量满足 PRD「总代码量 ≥ 8000 行（HTML + CSS + JS + JSON 数据合计，以实际文件行数为准）」的要求，并说明统计口径。

## 一、统计命令

在项目根目录执行：

```bash
wc -l index.html css/*.css js/*.js lab/src/* data/*.json
```

结果（2026-11 统计）：

| 文件 | 行数 |
| --- | ---: |
| `index.html` | 117 |
| `css/base.css` | 512 |
| `css/layout.css` | 440 |
| `css/components.css` | 1,634 |
| `css/pages.css` | 1,816 |
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
| `lab/src/LabPage.jsx` | 636 |
| `lab/src/Vessel.jsx` | 281 |
| `lab/src/library.js` | 85 |
| `lab/src/main.jsx` | 37 |
| `lab/src/store.js` | 592 |
| `data/knowledge.json` | 1,098 |
| `data/quiz.json` | 640 |
| `data/molecules.json` | 2,551 |
| `data/nameMap.json` | 55 |
| `data/equations.json` | 414 |
| **合计** | **15,798** |

## 二、分类汇总

| 类别 | 行数 | 占比 |
| --- | ---: | ---: |
| HTML | 117 | 0.7% |
| CSS | 4,402 | 27.9% |
| JavaScript / JSX | 6,521 | 41.3% |
| JSON 数据 | 4,758 | 30.1% |
| **核心交付代码合计** | **15,798** | **100%** |

```
15,798 ÷ 8,000 ≈ 1.97 倍
```

超出 PRD 最低要求约 97%。

## 三、附加文件（不计入核心交付代码）

| 文件 | 行数 | 说明 |
| --- | ---: | --- |
| `tools/gen_molecules.py` | 746 | 由理想几何构型生成 33 个分子坐标 |
| `tools/build_data.py` | 231 | 校验数据并生成 `data/*.js` 包装文件 |
| `tools/smoke_test.js` | 220 | 44 项断言的冒烟测试（JavaScriptCore） |
| `tools/syntax_check.js` | 74 | 逐文件语法与加载检查 |
| `data/*.js`（5 个） | 30 | 自动生成的包装文件（每个 6 行） |
| `package.json` | 18 | 实验室源码重建依赖与脚本 |
| `lab/README.md` | 48 | 实验室分步说明与重建命令 |
| `lab/chem-lab.js` | 53 | esbuild 打包运行时（含第三方库与许可注释） |
| **附加合计** | **1,420** | |

全部文件（含附加）总计：**17,218 行**。

## 四、统计口径说明

1. **行数来源**：使用系统 `wc -l` 统计物理行数，不以“有效代码行”折算，也不排除空行与注释；这与 PRD「以实际文件行数为准」的表述一致。
2. **不灌水**：
   - 没有任何空函数、占位 TODO 或复制粘贴的重复逻辑；
   - 知识点讲解、题目解析、易错点均为针对具体概念撰写的实质内容（例如“氢键与水的反常性质”包含 4 段讲解、2 个带步骤的实例、4 条易错点与 4 条小结）；
   - CSS 按组件 / 页面拆分，全站页面改版后已删除无引用的旧卡片、统计条与徽标样式，保留的选择器均有实际用途；
   - 3D 渲染器、配平算法、VSEPR 推测均为真实实现，并配有测试；
   - 虚拟实验室步骤 1–3 使用 React + Zustand 实现真实的三块布局、分类折叠、拖拽放置、容器内物质与温度模型、酒精灯按距离加热与火焰 SVG，不是静态占位图。
3. **数据文件计入**：PRD 明确把 JSON 数据计入总行数；`data/molecules.json` 的 2,551 行来自 33 个分子的逐原子坐标与逐键连接，`data/knowledge.json` 的 1,098 行来自 20 个知识点的完整讲解，均属于产品内容本身，不是重复填充。
4. **包装文件单列**：`data/*.js` 是为了支持 `file://` 直接运行而由脚本生成的同内容副本，只有 30 行（每个文件一行 JSON），已在统计中单列，避免重复计算数据量。
5. **实验室打包文件单列**：`lab/chem-lab.js` 是 esbuild 产物（含 React / Zustand / dnd-kit 及许可注释），不计入核心源码；`lab/src/*` 的 1,631 行 JSX/JS 才是实际维护的实验室代码。

## 五、复现校验

```bash
# 1. 校验数据并重新生成包装文件
python3 tools/build_data.py

# 2. 语法与加载检查
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/syntax_check.js

# 3. 冒烟测试（44 项）
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/smoke_test.js

# 4. 行数统计（核心源码）
wc -l index.html css/*.css js/*.js lab/src/* data/*.json

# 5. 实验室源码变更后重建运行时
npm install
npm run build:lab
```
