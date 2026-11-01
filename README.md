# ChemLearn · AP 化学学习与练习平台

> 一个纯前端、可离线运行的 AP Chemistry 学习工具：**细致讲解 + 即时练习 + 错题重练 + 3D 分子可视化 + 辅助工具**。

ChemLearn 面向“课堂听不懂、课后没人讲、刷题没反馈”的 AP 化学学习者。它把 5 个核心章节拆成 20 个知识点，每个知识点都配有定义（中英对照）、4 段细致讲解、带步骤的举例、易错点与小结卡片；每章配 9 道练习，提交后立即判分并展示详细解析；做错的题自动进入错题集，可重做、可标记已掌握、可一键巩固；常驻的 3D 分子模块内置 33 个分子模型与 46 条中文名称映射，支持旋转、缩放与原子悬停提示。

- **无需后端**：所有数据都是本地文件，所有状态保存在浏览器 `localStorage`。
- **无需安装**：双击 `index.html` 即可运行，也可以用任意静态服务器托管。
- **无第三方依赖**：3D 渲染使用原生 Canvas 2D 手写实现，不依赖 Three.js 或任何 CDN。

---

## 一、快速开始

### 方式 1：直接双击（推荐给普通使用者）

直接双击项目根目录的 `index.html`。

为了让 `file://` 协议下也能加载数据，项目同时提供了：

- `data/*.json`：标准 JSON 数据（可读、可校验）
- `data/*.js`：由 `tools/build_data.py` 从 JSON 生成的包装文件，把同一份数据挂到 `window.CHEM_DATA`

`index.html` 通过 `<script>` 加载包装文件，`js/data.js` 优先读取 `window.CHEM_DATA`，读不到时才回退到 `fetch('data/*.json')`。因此**双击打开与本地服务器访问都能正常工作**。

### 方式 2：本地静态服务器

```bash
cd ChemLearn
python3 -m http.server 8000
# 然后浏览 http://localhost:8000
```

### 浏览器要求

- Chrome / Edge / Safari 最新版（项目使用了 `color-mix()`、CSS 变量、`backdrop-filter` 等现代特性）
- 桌面端与移动端均可使用（已做响应式适配）
- 若浏览器禁用了 `localStorage`，应用会自动退化为“内存模式”，功能可用但刷新后进度丢失

---

## 二、功能总览

| 模块 | 页面 | 主要能力 |
| --- | --- | --- |
| **A. 知识讲解** | `#/chapters`、`#/chapter/:id`、`#/knowledge/:id` | 5 章 20 个知识点；每个知识点含定义、中英对照、细致讲解、举例推导、易错点、小结；记录学习进度；支持关键词搜索 |
| **B. 课后练习** | `#/quiz`、`#/quiz/:id` | 45 道题（每章 9 道）；单选 / 判断 / 填空；即时判分；详细解析 + 错因分析 + 知识点链接；随机练习；错题巩固 |
| **C. 错题集** | `#/wrongbook` | 自动入库、按章节分组、按状态/章节筛选、弹窗重做、标记已掌握、一键巩固、导出备份；`localStorage` 持久化 |
| **D. 3D 分子** | `#/molecule`、`#/molecule/:query` | 33 个分子模型、46 条中文名称映射；拖拽旋转、滚轮缩放、自动旋转、原子标签、悬停信息、保存 PNG；未知输入给出 VSEPR 推测 |
| **E. 辅助工具** | `#/tools/balance`、`#/tools/identify`、`#/tools/molar` | 方程式配平（含 18 组内置分步解析）、物质识别、摩尔质量计算 |

### 首页与全局

- 首页展示学习进度、练习正确率、待巩固错题、章节速览、学习路径与最近错题
- 顶部导航常驻“3D 分子”入口，任何页面都可以一键打开
- 学习进度与错题数量实时显示在导航徽标上
- 键盘快捷键：先按 `g`，再按 `h` / `c` / `q` / `w` / `m` / `t` 分别跳转首页、章节、练习、错题集、3D 分子、工具

---

## 三、目录结构

```text
ChemLearn/
├── index.html                  # 单页应用入口（导航 / 页脚 / 模态框容器 / 脚本加载）
├── README.md                   # 本文件
├── LINE_COUNT.md               # 代码行数统计说明（PRD 交付物）
├── css/
│   ├── base.css                # 设计变量、重置、排版、按钮、表单、通用工具类
│   ├── layout.css              # 头部、导航、主体、页脚、栅格与响应式
│   ├── components.css          # 卡片、标签、模态框、提示条、答题控件、成绩单、表格等
│   └── pages.css               # 首页 Hero、章节页、知识点页、3D 页、工具页、页面级响应式
├── js/
│   ├── utils.js                # DOM / 字符串 / 随机 / 日期 / Toast / Modal / 答案标准化
│   ├── storage.js              # localStorage 封装：进度、错题、答题记录、设置、导入导出
│   ├── data.js                 # 数据加载（window.CHEM_DATA 或 fetch）与查询索引
│   ├── router.js               # 哈希路由：注册、匹配、导航高亮、404
│   ├── knowledge.js            # 模块 A：章节列表、章节详情、知识点详情
│   ├── quiz.js                 # 模块 B：练习中心、答题会话、判分、成绩单
│   ├── wrongbook.js            # 模块 C：错题筛选、重做弹窗、已掌握、巩固练习
│   ├── molecule3d.js           # 模块 D：Canvas 3D 渲染器、交互、VSEPR 推测
│   ├── tools.js                # 模块 E：配平、物质识别、摩尔质量
│   └── app.js                  # 启动引导、路由注册、首页渲染、顶部状态刷新
├── data/
│   ├── knowledge.json          # 5 章 20 个知识点（含长篇讲解、举例、易错点、小结）
│   ├── quiz.json               # 45 道题（单选 26 / 判断 8 / 填空 11）
│   ├── molecules.json          # 33 个分子的原子坐标、化学键、几何参数
│   ├── nameMap.json            # 46 条物质名称 / 别名 → 化学式映射
│   ├── equations.json          # 18 组配平例题（含分步推导）
│   └── *.js                    # 由 tools/build_data.py 生成的同内容包装文件
└── tools/
    ├── gen_molecules.py        # 由理想几何构型 + 标准键长生成 molecules.json
    ├── build_data.py           # 校验全部数据并生成 data/*.js 包装文件
    ├── smoke_test.js           # JavaScriptCore 冒烟测试（数据 / 算法 / 判分）
    └── syntax_check.js         # 逐个加载 js 文件，检查语法与初始化错误
```

---

## 四、数据文件格式

所有数据文件均为 UTF-8 编码的标准 JSON，第一个键是 `meta`（版本与说明），其余为业务数据。

### 4.1 `knowledge.json`

```json
{
  "meta": { "version": "1.0.0", "chapterCount": 5, "pointCount": 20 },
  "chapters": [
    {
      "id": "ch1",
      "index": 1,
      "title": "化学键基本概念",
      "titleEn": "Basic Concepts of Chemical Bonding",
      "description": "……",
      "icon": "🔗",
      "color": "#4f7cff",
      "examWeight": "高频（选择题 + 结构推断）"
    }
  ],
  "points": [
    {
      "id": "ch1-1",
      "chapter": "ch1",
      "title": "离子键与晶格能",
      "titleEn": "Ionic Bonding & Lattice Energy",
      "definition": { "cn": "……", "en": "……" },
      "explanation": ["第一段……", "第二段……", "第三段……", "第四段……"],
      "examples": [
        { "title": "例 1：……", "content": "……", "steps": ["步骤 1", "步骤 2"] }
      ],
      "pitfalls": ["易错点 1", "易错点 2", "易错点 3"],
      "summary": ["要点 1", "要点 2", "要点 3", "要点 4"],
      "tags": ["离子键", "晶格能"],
      "quizIds": ["q-1-1", "q-1-2"]
    }
  ]
}
```

### 4.2 `quiz.json`

```json
{
  "questions": [
    {
      "id": "q-1-1",
      "chapter": "ch1",
      "knowledgeId": "ch1-1",
      "type": "single",              // single | judge | fill
      "difficulty": "基础",
      "question": "题干",
      "options": ["A", "B", "C", "D"],
      "answer": 1,                    // 单选题：正确选项索引
      "explanation": "详细解析",
      "wrongAnalysis": "常见错因",
      "tags": ["晶格能"]
    },
    {
      "id": "q-1-3",
      "type": "judge",
      "answer": false,                // 判断题：布尔值
      "options": ["正确", "错误"],
      "explanation": "……"
    },
    {
      "id": "q-1-5",
      "type": "fill",
      "answer": ["0.96", ".96"],      // 填空题：可接受答案列表
      "explanation": "……"
    }
  ]
}
```

填空题判分由 `CL.utils.isAnswerMatch` 完成：会做全角转半角、下标/上标转数字、去掉空格与常见单位、统一 Unicode 负号，并对纯数字答案允许极小的误差。

### 4.3 `molecules.json`

```json
{
  "meta": { "unit": "angstrom", "coordinateNote": "教学级理想几何坐标" },
  "elements": {
    "O": { "name": "氧", "color": "#ff2b2b", "radius": 0.55 }
  },
  "molecules": [
    {
      "id": "h2o",
      "formula": "H2O",
      "names": ["水", "water"],
      "geometry": "角形（V 形）",
      "geometryEn": "Bent",
      "bondAngle": "104.5°",
      "hybridization": "sp³",
      "polarity": "极性分子（偶极矩 1.85 D）",
      "imf": "氢键 + 偶极-偶极作用力 + 色散力",
      "notes": "……",
      "atoms": [
        { "element": "O", "x": 0, "y": 0.22, "z": 0, "label": "O" }
      ],
      "bonds": [
        { "a": 0, "b": 1, "order": 1, "type": "covalent" }
      ],
      "atomCount": 3,
      "bondCount": 2
    }
  ]
}
```

- 坐标单位为埃（Å），由 `tools/gen_molecules.py` 按理想几何构型与标准键长生成（教学级近似，不是量子化学计算结果）
- `bond.type` 支持 `covalent` / `ionic` / `aromatic`，`bond.order` 支持 1 / 2 / 3 / 1.5

### 4.4 `nameMap.json`

```json
{
  "entries": [
    {
      "name": "水",
      "formula": "H2O",
      "aliases": ["water", "一氧化二氢"],
      "category": "共价化合物",
      "note": "角形分子，分子间存在氢键"
    }
  ]
}
```

### 4.5 `equations.json`

```json
{
  "equations": [
    {
      "id": "eq-001",
      "equation": "H2 + O2 → H2O",
      "balanced": "2H2 + O2 → 2H2O",
      "type": "化合反应",
      "difficulty": "入门",
      "reactants": [{ "formula": "H2", "coefficient": 2 }, { "formula": "O2", "coefficient": 1 }],
      "products": [{ "formula": "H2O", "coefficient": 2 }],
      "steps": ["步骤 1", "步骤 2"],
      "note": "……"
    }
  ]
}
```

---

## 五、关键实现说明

### 5.1 单页路由

`js/router.js` 使用 `location.hash` 做前端路由，支持 `:param` 形式的动态段：

```js
CL.router.register('/knowledge/:id', function (params) {
  CL.knowledge.renderPoint(params);
});
```

路由变化时自动更新导航高亮、页面标题、滚动位置；未匹配路径渲染 404 页面。

### 5.2 学习数据持久化

`js/storage.js` 统一使用前缀 `chemlearn.v1.`，包含四个 key：

| key | 内容 |
| --- | --- |
| `chemlearn.v1.progress` | 已读知识点、各章答题次数与正确数、最近访问时间 |
| `chemlearn.v1.wrongbook` | 错题列表（错误次数、首次/最近错误时间、已掌握状态、历史作答） |
| `chemlearn.v1.attempts` | 最近 400 条答题记录（用于统计正确率） |
| `chemlearn.v1.settings` | 3D 模块的自动旋转、标签显示等偏好 |

所有读取都做了 `try/catch`，并在 `localStorage` 不可用时退化为内存存储。

### 5.3 判分与错题流转

1. 用户提交答案 → `CL.quiz.grade(question, answer)` 判分
2. `CL.store.recordAttempt(...)` 写入答题历史，更新章节正确率
3. 答错 → `CL.store.addWrong(question, answer)` 自动入库
4. 答对且该题在错题集中 → 自动标记“已掌握”
5. 错题集中重做答对 → 同样自动标记“已掌握”，并保留历史记录

### 5.4 方程式配平算法

`js/tools.js` 中的 `balance()`：

1. 解析输入，支持 `->`、`→`、`=`、`⇌` 四种箭头，自动去除状态符号与前置系数
2. 用 `CL.molecule.parseFormula()` 解析每种物质的元素计数（支持括号）
3. 反应物取正、生成物取负，构造元素 × 物质的齐次线性方程组 `A·x = 0`
4. 用**有理数**高斯-约当消元求零空间向量（避免浮点误差）
5. 将比例化为最简正整数系数，并校验所有元素守恒
6. 在内置题库中查找相同方程式，若有则展示其分步推导，否则自动生成“设系数 → 列守恒方程 → 求解”的步骤

### 5.5 3D 分子渲染

`js/molecule3d.js` 用原生 Canvas 2D 实现了一个轻量 3D 管线：

- **旋转**：绕 Y 轴、X 轴依次旋转原子坐标
- **透视投影**：`perspective = 9 / (9 + z)`，相机距离 9 Å
- **深度排序**：化学键按平均深度、原子按深度由远到近绘制，实现前后遮挡
- **化学键**：单键 / 双键 / 三键（屏幕空间法线偏移）、芳香键（实线 + 虚线）、离子键（灰色虚线）
- **原子**：CPK 配色 + 径向渐变 + 阴影，白色氢原子自动使用深色标签
- **交互**：Pointer Events 拖拽旋转、滚轮缩放、双击复位、自动旋转、悬停提示、导出 PNG
- **未知物质**：解析中心原子与配体数 → 估算孤对电子 → 得到电子域数与几何构型，并生成示意结构；界面会明确标注“VSEPR 推测”，不会伪装成精确数据

### 5.6 响应式与可访问性

- 断点：1080px / 980px / 900px / 860px / 820px / 720px / 620px / 520px
- 移动端导航为抽屉式菜单，点击链接后自动收起
- 语义化标签、`aria-label` / `aria-current` / `aria-live`、键盘焦点样式、跳转到主内容的 skip link
- `prefers-reduced-motion` 未强制禁用动画，但所有动画都较短且不影响功能

---

## 六、质量保障与自测

项目自带两套不依赖第三方库的测试脚本（使用 macOS 自带的 JavaScriptCore，不需要 Node.js）。

### 6.1 数据校验 + 生成包装文件

```bash
python3 tools/build_data.py
```

会依次检查：

- `knowledge.json`：5 章、≥20 个知识点，每条都含定义（中英）、≥3 段讲解、≥1 个举例、≥2 条易错点、≥3 条小结
- `quiz.json`：≥40 题、每章 ≥8 题、题型合法、答案索引有效、关联知识点存在、解析非空
- `molecules.json`：≥25 个分子、原子字段完整、化学键索引不越界、元素有配色
- `nameMap.json`：≥30 条映射
- `equations.json`：≥15 组方程式，且每组都有分步解析

校验通过后生成 `data/*.js` 包装文件（供 `file://` 直接运行）。

### 6.2 语法与加载检查

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/syntax_check.js
```

逐个加载 5 个数据包与 10 个 JS 模块，确认没有语法错误、没有初始化异常。

### 6.3 冒烟测试（44 项断言）

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/smoke_test.js
```

覆盖：

- 数据规模（章节 / 知识点 / 题目 / 分子 / 名称 / 方程式数量）
- 配平算法（H₂ + O₂、Fe + O₂、丙烷燃烧、中和反应、非法输入）
- 摩尔质量（H₂O、NaCl、Ca(OH)₂、CuSO₄·5H₂O）
- 物质识别（食盐、水、未知物推测标记）
- 化学式解析（Ca(OH)₂）、名称 / 别名 / 化学式解析
- VSEPR 推测（H₂SO₄、PBr₃）
- 判分逻辑（单选 / 判断 / 填空、全角字符、Unicode 负号）
- localStorage 读写（进度、答题统计、错题入库、已掌握）

### 6.4 浏览器端验证（开发时执行）

开发过程中额外用 WebKit（WKWebView）加载页面，验证了：

- `#/home`、`#/chapters`、`#/chapter/ch1`、`#/knowledge/ch1-1`、`#/quiz`、`#/quiz/ch1`、`#/wrongbook`、`#/molecule`、`#/tools` 等 13 条路由均能渲染，控制台错误数为 0
- 点击选项 → 提交 → 判定为错误 → 展示解析 → 错题自动入库 → 导航徽标变为 1
- 3D 画布真实绘制：CH₄ 的碳原子、H₂O 的红色氧原子均能在像素数据中被检测到
- 配平工具输入 `Fe + O2 -> Fe2O3` 输出 `4Fe + 3O2 → 2Fe2O3`
- 物质识别输入 `MgO` 正确返回离子化合物信息
- `python3 -m http.server` 方式访问时所有静态资源均返回 200

---

## 七、代码规模

完整统计见 [`LINE_COUNT.md`](./LINE_COUNT.md)，核心交付代码（不含生成脚本与包装文件）约 **14,200 行**，远超 PRD 要求的 8,000 行：

| 类别 | 行数 |
| --- | --- |
| HTML（`index.html`） | 119 |
| CSS（`css/*.css`） | 4,209 |
| JavaScript（`js/*.js`） | 5,163 |
| JSON 数据（`data/*.json`） | 4,763 |
| **合计** | **14,254** |

此外还有数据生成与测试脚本约 1,271 行、自动生成的包装文件 30 行。

---

## 八、PRD 验收对照

### 8.1 功能验收

| 验收项 | 状态 | 说明 |
| --- | --- | --- |
| 5 个章节全部有知识点，每条含定义 / 细致讲解 / 举例 / 易错点 / 小结 | ✅ | 20 个知识点，讲解 4 段，举例均含分步推导 |
| 每章 ≥8 题、全书 ≥40 题，可作答、可判分、错题有详细解析 | ✅ | 每章 9 题，共 45 题；解析 + 错因分析 + 知识点链接 |
| 错题自动入库；可重做、可标记已掌握、可生成巩固练习；localStorage 生效 | ✅ | 支持筛选、弹窗重做、自动/手动掌握、一键巩固、导出备份 |
| 3D 分子常驻入口；≥25 个分子；≥30 条名称映射；旋转缩放；未知输入友好提示 | ✅ | 33 个分子 / 46 条映射；拖拽 + 滚轮 + 自动旋转；未知输入给出 VSEPR 推测 |
| 辅助工具 ≥2 个（配平助手 + 物质识别） | ✅ | 额外提供摩尔质量计算器 |
| 页面导航清晰：首页 / 章节学习 / 练习 / 错题集 / 3D 分子 / 工具 | ✅ | 顶部固定导航 + 移动端抽屉菜单 |
| 代码量 ≥8000 行 | ✅ | 约 14,254 行（见 `LINE_COUNT.md`） |
| 结构清晰：`index.html` + `css/` + `js/` 按模块拆分 + `data/` | ✅ | 10 个 JS 模块、4 个 CSS 文件、5 个 JSON 数据文件 |
| 无后端依赖，双击或静态服务器均可运行 | ✅ | 数据 JS 包装 + fetch 回退双通道 |
| 关键函数中文注释，数据格式统一、可校验 | ✅ | 所有模块带文件头注释与函数注释；`tools/build_data.py` 统一校验 |
| 浏览器控制台无报错 | ✅ | WebKit 实测 13 条路由 + 交互流程，错误数 0 |
| 不覆盖范围（不做登录 / AI 出题 / 原生 App / 超出 5 章 / 量子化学精度） | ✅ | 均未实现，符合 Out of Scope 约定 |

### 8.2 交付物清单

- ✅ 完整可运行的前端项目文件夹
- ✅ `README.md`：运行方式、目录结构、功能说明、实现细节、测试方式
- ✅ 数据文件：`knowledge.json`、`quiz.json`、`molecules.json`、`nameMap.json`、`equations.json`
- ✅ `LINE_COUNT.md`：代码行数统计说明

---

## 九、已知限制与后续扩展

**已知限制**

1. 3D 分子坐标是“理想几何 + 标准键长”的教学级数据，键长键角为近似值，不能用于科研计算。
2. VSEPR 推测只处理主族元素、单中心分子；对有机大分子、配合物、过渡金属化合物可能给出过于简化的结果，界面已明确标注“推测”。
3. 配平助手面向常见无机 / 简单有机方程式，不支持氧化还原半反应配平、离子方程式电荷配平与有机反应机理。
4. 数据全部在本地，清除浏览器数据会丢失学习记录（可在错题集页导出备份）。
5. 未做 Service Worker 离线缓存；不过因为所有资源都是本地文件，直接打开时本来就是离线的。

**可扩展方向**

- 增加章节测验与限时模拟考试
- 支持错题导出为 PDF / Anki 卡片
- 使用真实晶体学数据替换教学级坐标
- 增加更多分子与反应类型（配合物、有机机理）
- 增加学习日历、连续学习天数等激励设计

---

## 十、说明

本项目为教学演示用途，内容依据 AP Chemistry 常见考纲整理，例题与解析均为原创撰写。若用于正式教学，请结合教材与最新考纲核对数据。

如果只想快速体验：双击 `index.html` → 顶部点击「3D 分子」→ 输入「水」或「苯」→ 拖拽旋转。

