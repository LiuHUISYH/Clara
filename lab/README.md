# 虚拟实验室

`lab/src` 是虚拟实验室的 React 源码。运行时不依赖 Node 或开发服务器：`index.html`
直接加载已经打包好的 `lab/chem-lab.js`。

## 当前进度

- ✅ 步骤 1：三块基础骨架（左侧器材/试剂库、中间点阵实验台、底部实验日志）。
- ✅ 步骤 2：从左侧拖拽器材到实验台并在画布内移动；点击选中后出现操作条，
  容器可“加入试剂 / 倒出 / 清空 / 移除”，试剂也可直接拖到容器上。
- ✅ 步骤 3：试剂、体积、温度、pH 与容器内物质列表；酒精灯点燃后把容器架到火焰上加热，
  温度实时显示在容器副标题，液体到沸点会写入警告日志，移开后自然降温。
- ✅ 步骤 4：规则引擎（`src/reactions.js`）——41 种物质、33 条规则，覆盖沉淀、
  碳酸盐放气、金属 + 酸、金属置换、中和放热、沉淀溶于酸与受热分解；沉淀按质量画在容器底部，
  放气时液面下冒气泡并显示 `↑ CO₂` 徽标，酚酞 / 石蕊按 pH 改变液体颜色。
- ✅ 步骤 5：温度阈值触发的反应——NaHCO₃ / Cu(OH)₂ 到 80°C、CaCO₃ 到 120°C 自动分解，
  由 `tickHeating()` 每帧把当前温度传回引擎，蓝色 Cu(OH)₂ 变黑成 CuO、NaHCO₃ 放出 CO₂ 与 H₂O。
- ✅ 渲染增强步骤 1：白底玻璃器材与酒精灯重绘——容器改用浅灰描边（`#c3ced2`）+ 白色高光条 +
  右缘厚度 + 内缘暗线的玻璃质感，纵向薄雾在液体之上模拟折射；烧杯有加厚唇边与口内弧，
  试管 / 烧瓶是椭圆开口；液体用 `clip-path` + 波浪 `<path>` 渲染，液面缓慢漂移，填充色变化有
  480ms 过渡。酒精灯改为玻璃灯体（含酒精液面）、金属灯芯管、可移除灯帽与外焰 / 中焰 / 焰心
  三层火焰，点燃时灯帽平移让位。
- ✅ 渲染增强步骤 2：画布内自由拖动——台上任意容器 / 工具都能跟手移动：拖起的瞬间把完整 SVG
  复制进 `DragOverlay`（含液面与温度文字），原件淡成占位；松手按令牌左上角换算落点、用实测宽高
  钳制在画布内，并把器材排到数组末尾（同层级置顶）。容器互拖时只有指针压到目标中心（±56×±64px）
  才算倒液，令牌外框擦边重叠只当摆放，避免想摆近一点就被误判为倒掉。
- ✅ 渲染增强步骤 3：火焰碰撞加热——受热不再按“离酒精灯多近”判断，而是拿容器的玻璃底与焰尖做
  矩形碰撞：横向 ±30px、焰尖到容器底 −24 ~ +50px 才算架在火焰上，并排摆在灯旁只当摆放。火焰上
  有容器时外焰增亮、光晕放大；液体到 100°C 转入沸腾（8 颗更密的气泡 + 副标题「沸腾」+ 警告日志），
  100°C 时继续加热不再升温，移开后降温、沸腾自动结束。
- ✅ 渲染增强步骤 4：火柴点火——器材库新增「火柴」，选中后可「划燃 / 熄灭」，划燃的火柴头冒出
  三层小火苗并显示剩余秒数（`MATCH_DURATION` 9 秒），燃尽自动熄灭并记一条「火柴 燃尽了。」。
  酒精灯不再能凭空点燃：必须台面上有一根燃着的火柴，选中灯点「点燃」或用火柴直接拖到灯上
  （`lightItem()` 统一处理），点不着时写一条「酒精灯 要用火柴点燃」的警告日志。
- ✅ 渲染增强步骤 5：石棉网匀热——器材库里的「石棉网」可以垫在容器与火焰之间：石棉网拖到容器上
  由 `stackGauze()` 一次 `set()` 换位（容器正架在火焰上时连容器一起抬起，网面落在焰尖上方、
  容器坐在网面上，日志只留一条），容器拖到网上由 `standOnGauze()` 吸附到底。加热变成两段判定：
  `gauzeInFlame()`（网架在火焰上）+ `onGauze()`（容器坐在网面上）→ `heatSource()` 先查隔网、
  再退回直接受热。隔着网受热记 `evenHeat`，操作条显示「受热: 垫石棉网 · 均匀受热」；直接架在
  火焰上升温到 60°C（`UNEVEN_TEMPERATURE`）时记一条「受热不均（建议垫上石棉网）」警告，
  每件容器只记一次，温度回落即复位。网面被火焰烤着时网格转暖色并透出光晕，酒精灯外焰同样增亮，
  说明文字移到网面右侧不压火焰。
- ✅ 交互增强步骤 6：真实器械手感——
  **① 带塞试剂瓶**：器材库新增「试剂瓶」（细口瓶 + 玻璃瓶塞），`open` 默认 `false`，点画布上的瓶塞
  或操作条的 `Status: Closed` 切换开合（瓶塞按 `translate(-13px,-20px) rotate(15deg)` 抬离瓶口），
  `pour()` / `addReagent()` / `dumpLiquid()` 都有开塞门禁，塞着时记一条「瓶塞没打开」警告；
  **② 物理倾倒动画**：松手不再瞬间倒完，`startPour()` 先起一段 `pourFlow`（源容器 38° 倾斜、
  `stroke-dashoffset` 流动的水柱颜色取自源液体、目标容器液面按进度上涨），1.1s 后 `pour()` 一次性
  结算，反应日志仍只出现一次；源容器在目标左侧时向左倒（镜像旋转中心）；
  **③ 铁架台铁夹吸附**：容器松手时玻璃底中心距铁圈心 < `CLAMP_RADIUS`（46px）或直接落在铁架台上
  就夹住（`clampOnStand()`），夹住后移动铁架台带着容器一起走、搬走容器即解夹、拆掉铁架台自动放开；
  夹持容器的火焰判定放宽到 `CLAMP_HEAT_GAP`（96px），把酒精灯放到试管正下方就能受热；
  **④ 读数与沸腾**：操作条新增 `Status: Open / Closed` 读数（带塞容器可点）、`Volume` 与 `Contents`
  字段，沸腾时液面从缓慢漂移换成 `lab-liquid-churn` 翻滚，气泡更密。
- ✅ 交互增强步骤 7：把交互换成几何驱动 + 现象补全——
  **① 实体边界（简化 ECS）**：每件器材都是 `{ id, type, position, dimensions, state }`，
  `dimensions` 直接挂在实体上，`boundsOf()` / `mouthPoint()` / `overlaps()` / `pourAlign()`
  全部由 store 用坐标算出，页面不再拿 DOM 尺寸做几何判断（`LAB_GEOMETRY` 对外暴露同一套数值，
  调试可读 `window.CL.lab.pourAlign`）；
  **② 倾倒改成几何对准**：`pourAlign()` 比较两个容器的**瓶口**——水平中心差 ≤ 26px
  （`POUR_ALIGN_X`），且源瓶口高出目标瓶口 6–90px（悬停倾倒）或两容器外框基本叠住
  （松手叠放，高差 ≤ 46px）；拖拽途中 `useDndMonitor` 实时算 `canPour`，目标容器套一圈虚线瓶口罩
  （`.lab-vessel--pour-ready`）提示「松手就倒进去」，没对准（如横向偏 60px）只按摆放处理；
  水柱的起点 / 落点也改用 `mouthPoint()`，线宽随转移量（2.2–3.8px）；
  **③ 铁夹锁定**：吸附半径按规格收紧到 `CLAMP_RADIUS = 30`（玻璃底中心到圈心），
  夹住后容器是锁定实体——`useDraggable` 被 `disabled`、`moveItem()` 直接拒绝并写「先「取下」再移动」，
  指针变 `not-allowed`，副标题标「铁夹上」；操作条出现「取下」按钮（`releaseClamp()`）松开夹具后
  才能继续拖动；石棉网也不会再把锁定的容器搬来搬去；
  **④ 浑浊 / 水蒸气 / 絮状沉淀**：`syncItem()` 由固含量派生 `turbidity`，液体上叠一层冷灰白雾
  （`640ms` 过渡，白底上也看得出「浑」）；沸腾时瓶口飘出 5 团模糊水蒸气（`lab-steam-rise`）；
  沉淀堆体压矮到液面以下并撒 5 颗浮动颗粒（`lab-solid-mote`），絮状沉淀不再是一块干净色块；
  气泡数量随反应剧烈程度（`gasTimes`）增加，气泡改成浅青灰 + 深描边，白底上也看得清；
  **⑤ 极简工控读数**：底部日志换成仿终端深色面板（`#14171a`，绿色 `> ` 提示符、反应行绿色、
  警告行琥珀色），操作条读数改为 `Vol / Temp / PH` + `Contents: [HCl 10mL]` 方括号列表，
  反应日志统一以「发生反应：」开头。

## 已实现的交互细节

| 能力 | 说明 |
| --- | --- |
| 器材 / 试剂库 | 6 个分类、31 项；点击分类折叠，点击条目直接放入实验台 |
| 拖拽 | `@dnd-kit/core`：库里拖入画布、画布内自由移动（跟手幽灵 + 边界钳制 + 松手置顶）、试剂拖到容器上；`PointerSensor` 设 6px 起拖阈值，避免点击被当成拖动 |
| 选中 | 点击器械出现底部操作条；Esc 或点击空白取消选中；拖动松手也会选中刚移动的器材 |
| 容器状态 | `contents[]`（试剂、体积、温度）+ `volume` / `ph` / `color` / `temperature` / `turbidity` / `open`，所有变更统一经过 `syncItem()` |
| 实体几何 | 每个实体带 `dimensions`（104×128）；`boundsOf()` 给绝对包围盒，`mouthPoint()` 由类型表换算瓶口中心（烧杯 31.5 / 试管 19 / 烧瓶 18.2 / 细口瓶 20.5），`overlaps()` 做 AABB 相交；`LAB_GEOMETRY` 与 `window.CL.lab` 暴露同一套数值供页面与自测复用 |
| 瓶塞开合 | 带塞容器（试剂瓶）`stopper: true`、`open: false`；点画布上的瓶塞（`.lab-stopper__hit` 透明热区，`pointerdown` 拦截以免被当成拖拽）或操作条的 `Status` 读数调用 `toggleStopper()`；瓶塞按 `translate(-13px,-20px) rotate(15deg)` 抬离瓶口（320ms 过渡）；`pour()` / `addReagent()` / `dumpLiquid()` 都以 `open` 为前置条件，塞着时写「瓶塞没打开」警告 |
| 倒液 | 容器互拖时用 `pourAlign()` 判瓶口：X 中心差 ≤ `POUR_ALIGN_X`（26px），且「悬停倾倒」源口高于目标口 6–90px 或「松手叠放」两容器中心高差 ≤ `POUR_DROP_Y`（46px）才算倒液（`canPour`）；目标容器高亮并在拖拽途中套上虚线瓶口罩；`startPour()` 起 1.1s 的 `pourFlow` 动画（源容器 38° 倾斜、目标液面按进度上涨、水柱 `stroke-dashoffset` 流动），结束再调 `pour()` 按容量部分转移、保留温度与 pH；没对准（如横向偏 60px）只按摆放处理 |
| 倾倒动画 | `.lab-vessel--pouring` 让 `svg` 绕 `78% 84%` 转 38°（向左倒镜像成 `22% 84%` / -38°），`PourStream` 从 `mouthPoint(源)` 到 `mouthPoint(目标)` 画一条 `Q` 曲线水柱（颜色 = `pourFlow.color`、线宽 2.2–3.8px 随转移量，虚线流动 + 落点水滴），目标容器用「显示体积 = 实际体积 + 进度 × 转移量」逐帧上涨，动画期间不写回 store，因此只结算一次 |
| 铁架台吸附 | 容器松手时玻璃底中心到铁圈圈心（`clampPoint()`，令牌偏移 67 / 43.5）距离 < `CLAMP_RADIUS`（30px）或直接落在台上，`clampOnStand()` 把容器夹住（x 对准圈心、玻璃底落在圈心）并进入锁定态：`useDraggable` 禁用、`moveItem()` 拒绝并记「先「取下」再移动」、指针 `not-allowed`；`moveItem()` 对铁架台做刚体平移，夹着的容器同步位移；「取下」（`releaseClamp()`）或移除铁架台才解锁 |
| 点火 | 火柴是唯一的火源：`lightItem()` 里火柴划燃后燃烧 `MATCH_DURATION`（9 秒），`tickHeating()` 每秒刷新剩余秒数，燃尽自动熄灭；酒精灯只有台面上存在燃着的火柴时才能点燃（按钮或把火柴拖到灯上），灯帽随 `lit` 平移让位 |
| 加热 | 酒精灯“点燃 / 熄灭”（需先用火柴划燃）；火焰碰撞判定（`inFlame()`）：容器中心与火焰中心横向偏差 < `FLAME_X_RANGE`（30px）、焰尖到容器玻璃底 −`FLAME_OVERLAP`（24px）~ `FLAME_GAP`（50px，夹在铁架台上的容器放宽到 `CLAMP_HEAT_GAP` 96px）；受热 `HEAT_RATE = 4°C/s`、降温 `COOL_RATE = 2°C/s`；液体止于 100°C（`boiling`），干烧止于 160°C |
| 石棉网 | `heatSource()` 先查「架在火焰上的石棉网托着容器」（`gauzeInFlame()` + `onGauze()`，网面顶 y=57 / 底 y=80、横向 ±34px），再退回直接受热；隔网加热记 `evenHeat`，操作条显示「受热: 垫石棉网 · 均匀受热」；直接加热到 `UNEVEN_TEMPERATURE`（60°C）记一次「受热不均（建议垫上石棉网）」警告；石棉网拖到容器上由 `stackGauze()` 垫入（容器在火焰上时连容器一起抬起），容器拖到网上由 `standOnGauze()` 吸附 |
| 反应结算 | `settleContents()` 在加试剂 / 倒液 / 清空后调用 `reactContents()`，`tickHeating()` 在每次温度变化后也会调用它来触发受热分解；沉淀累积在 `contents[]` 的 solid 条目里（新生成的固体带 `lab-solid-settle` 下沉动画），生成的液体与剩余液体合并，`loss` 表示逸出气体带走的体积 |
| 规则表 | `RULES` 33 条：AgCl / BaSO₄ / Cu(OH)₂ 等沉淀，CO₃²⁻ + 2H⁺ 放气，Zn / Fe / Mg + 酸，Fe + Cu²⁺ 置换，H⁺ + OH⁻ 中和（放热至多 +65°C），沉淀 + 酸溶解，NaHCO₃ / Cu(OH)₂ / CaCO₃ 受热分解 |
| 受热分解 | 规则带 `minTemperature`（NaHCO₃ / Cu(OH)₂ 80°C、CaCO₃ 120°C）；`tickHeating()` 每次升温后把温度传回 `reactContents()`，到点立即分解并写入日志，干烧到 160°C 上限后继续分解剩余固体 |
| 指示剂 | 酚酞 pH > 8.2 变红、石蕊酸红碱蓝；颜色通过 `indicatorTint()` 覆盖液体填充色，pH 翻转时补一条日志 |
| 现象反馈 | 三层火焰（外焰 / 中焰 / 焰心 + 底部光晕）带 `prefers-reduced-motion` 分支，火焰上架着容器时加 `lab-flame--in-use`（外焰更亮、光晕放大 1.28 倍，石棉网架在火焰上同样触发）；≥60°C 的容器描边转浅暖色；受热容器把说明文字移到右侧避让火焰（石棉网上的容器还会再让开网面）；沸腾时气泡升到 9 颗、以 1.05s 更快上升，液面改用 `lab-liquid-churn` 剧烈翻滚，瓶口飘出 5 团模糊水蒸气（`lab-steam-rise`，`prefers-reduced-motion` 下静止），副标题显示「沸腾」；放气气泡数量随 `gasTimes`（同一次操作里规则触发次数）增加；沉淀堆体 + 5 颗浮动颗粒（`lab-solid-mote`）；石棉网被火焰烤着时网格与垫子转暖色、底部透出 `lab-gauze__glow` 光晕、副标题显示「匀热中」；划燃的火柴复用同一套三层火苗，副标题显示「燃烧中 · 9s」并转暖色 |
| 数据读数 | 操作条用等宽字体给出 `Status: Open / Closed`、`Vol: 30mL | Temp: 100°C | PH: 5.0`、`Contents: [NaNO₃ 20mL + AgCl 10g + HCl 10mL]` 与受热 / 夹持状态；选中容器即刷新，沸腾、夹持、现象各有独立字段 |
| 玻璃渲染 | `src/Glass.jsx`：浅灰描边 + 白色高光条 + 右缘厚度 + 内缘暗线 + 纵向薄雾；烧杯唇边 / 试管的椭圆开口 / 瓶口内弧；试剂瓶的短颈 + 玻璃瓶塞（塞芯、塞头、高光各一条 `<path>`，热区是一块透明 `rect`）；液体用内腔 `clip-path` 裁切，顶边是正弦波 `<path>`，液面缓慢漂移；固含量 > 0 时液体上叠一层冷灰白雾（`turbidity` 0–0.86，640ms 过渡） |
| 酒精灯渲染 | `src/Vessel.jsx`：玻璃灯体（酒精液面随瓶身裁切）+ 2 段金属灯芯管 + 灯芯 + 灯帽；未点燃时灯帽扣在灯芯管上，点燃后平移 27×38 移到灯旁台面并淡入接触阴影 |
| 日志 | 仿终端深色控制台（`#14171a`）：等宽字、绿色 `> ` 提示符、反应行绿色 / 警告行琥珀色，记录放置、移动、加试剂、开合瓶塞、倾斜倒液、划燃 / 熄灭火柴、点燃 / 熄灭酒精灯、夹持 / 取下、受热、沸腾、降温等操作；反应日志统一以「发生反应：」开头（`describeReaction()` 文本 + 现象 + 注释） |

## 实体几何与倾倒判定

`lab/src/store.js` 的几何层是所有交互的唯一来源，页面只负责把结果画出来：

| 导出 | 作用 |
| --- | --- |
| `ITEM_DIMENSIONS` / `item.dimensions` | 实体包围盒尺寸（104×128），随实体一起存在 Zustand 里 |
| `boundsOf(item)` | 绝对坐标 AABB，用于命中、边界与重叠判断 |
| `mouthPoint(item)` | 瓶口中心：`x = item.x + 52`，`y = item.y + MOUTH_Y[type]`（由 Glass 的 viewBox × 1.1538 换算） |
| `overlaps(a, b)` | 两个实体的 AABB 是否相交 |
| `pourAlign(source, target)` | 返回 `{ dx, gap, aligned, droppable, canPour }`：`aligned` 是「悬停倾倒」（源口高于目标口 6–90px 且 `dx ≤ 26`），`droppable` 是「松手叠放」（中心高差 ≤ 46px），`canPour` 是两者的并集 |
| `clampPoint(stand)` | 铁圈圈心（令牌内 67 / 43.5），吸附半径 `CLAMP_RADIUS = 30` |

`LabPage.jsx` 的 `labCollisionDetection()` 会把拖拽中的令牌矩形对回画布坐标（`dragOrigin()`），
构造一个临时实体再和落点容器做 `pourAlign()`；`Workbench` 用 `useDndMonitor({ onDragMove })` 做同一件事，
给命中的容器加 `.lab-vessel--pour-ready`（虚线瓶口罩）。因此**提示与结算永远是同一个结论**：
看到对准圈松手一定倒得进去，没对准就只是摆放。

`window.CL.lab` 另外暴露 `geometry` / `boundsOf` / `mouthPoint` / `pourAlign`，自测脚本可以直接复用，
不必在测试里重算常量。

## 玻璃与液体渲染

`src/Glass.jsx` 负责容器，`src/Vessel.jsx` 负责酒精灯（玻璃灯体 / 灯帽 / 三层火焰）与铁架台、
玻璃棒、胶头滴管、石棉网、pH 试纸，并通过 `LabGraphic` 对外出口。白底玻璃不靠深色线，而靠
「浅灰描边 + 白色高光 + 右缘厚度」勾形，容器的 SVG（`viewBox 0 0 80 104`，页面上按 92×120
显示）按下面的顺序叠放：

1. `GlassDefs`：`clipPath`（内腔 `body`）+ 横向玻璃渐变 `-glass` + 纵向薄雾 `-veil` +
   液体纵深渐变 `-liquid-shade`；id 带器材 id，同一页多件容器互不冲突。
2. 玻璃本体：`-glass` 渐变填充——左缘白色高光（0.95）、中部近透明、右缘 `currentColor` 0.46
   的玻璃厚度；`.lab-glass__fill` 不再整体降透明度，改由渐变各档的 alpha 控制浓淡。
3. `LiquidLayer`：顶边是 12 段正弦波的 `<path>`，向下封口后整块填充，并被内腔裁切；
   上面再叠一层 `-liquid-shade` 纵深渐变、一条白色液面线与一条淡色阴影线。
4. `Bubbles` / `SolidMarks`：气泡与底部固体堆积。
5. `-veil` 纵向薄雾：压在液体之上，顶部略亮、底部略沉，液体颜色像透过玻璃被提亮。
6. `GlassMarks`：内壁线、内缘暗线 `-edge`（`rgba(17,24,39,0.13)`，给出玻璃厚度）、底部椭圆
   `-base`、白色高光、刻度、瓶口（烧杯唇边 + 口内弧 / 试管与烧瓶的椭圆开口）。
7. 外轮廓：`stroke-width 1.3`，颜色取 `.lab-vessel__svg` 自己的 `color`（`#c3ced2`，hover 加深），
   加热到 60°C 以上转浅暖色 `#c1a582`。

酒精灯没有灯罩式的透明壳，而是「玻璃灯体 + 金属件」：

- 灯体轮廓与灯内酒精都是 `<path>`，`-body` 渐变给出左缘高光与右缘厚度；
- 灯芯管画成两段金属梯形，`-metal` 渐变模拟拉丝金属，灯芯是深灰小矩形；
- 灯帽（`-cap`）是一个带提钮的圆台，未点燃时扣在灯芯管上；点燃后加 `--off` 类，
  `transform: translate(27px, 38px)` 用 320ms 过渡移到灯旁台面，同时淡入一片接触阴影；
- 火焰分三层：外焰 `rgba(226,150,66,0.42)`、中焰 `rgba(246,202,108,0.82)`、
  焰心 `rgba(158,208,232,0.92)`，各自用 `lab-flame-sway` 做 1.7s / 1.15s / 0.85s 的
  缩放呼吸，底部再叠一层 `-glow` 径向光晕；`prefers-reduced-motion: reduce` 时全部静止。

铁架台与石棉网也是同一套线稿（`viewBox 0 0 80 104`）：

- 铁架台（`StandGraphic`）：圆角梯形底座 + 立杆 + 侧面固定螺丝 + 正面看过去的椭圆铁圈 `-ring`，
  铁圈与石棉网的铁框用同一种金属灰，摆在一起能看出「网是架在圈上的」。
- 石棉网（`GauzeGraphic`）：金属框 `-frame`（三段线性渐变拉出金属反光）+ 被 `-clip`
  裁在框内的 8 条交叉斜线 `-mesh` + 中间白色石棉垫 `-pad` + 顶边亮线 `-edge`，
  落在台面上时压一片 `-shadow` 椭圆。架在燃着的火焰上时加 `lab-gauze--hot`：网格与垫子转暖色，
  网面下透出一层 `lab-gauze__glow` 椭圆光晕。

拖拽幽灵与台上的原件是同一件器材的两份 SVG，所以 `ContainerGraphic` / `ToolGraphic` /
`LabGraphic` 都接受 `suffix` prop（幽灵传 `-ghost`），把 `clipPath` 与渐变的 id 区分开。
同 id 时浏览器只认第一份 `clipPath`，幽灵的液面就会被原件的内腔裁掉——曾经就是这条把
「拖起的烧杯里液体溢出杯身」画了出来。

倒液与瓶塞是页面层的两段动作，容器状态仍然只由 store 决定：

- **瓶塞**（`Stopper`）：塞芯与塞头各一条 `<path>` 加一条白色高光，热区是一块透明 `<rect>`
  （`pointer-events: all`）；`onPointerDown` 阻止冒泡，避免拨塞子被 dnd-kit 当成一次拖拽。
  开塞后 `.lab-stopper--open` 用 `transform-box: view-box` + `translate(-13px,-20px) rotate(15deg)`
  把塞子抬到瓶口斜上方，塞上时同一条过渡回去。
- **倾倒**（`PourStream`）：动画参数（`amount` / `color` / `progress`）只存在 `pourFlow` 里，
  `BenchItem` 用它算出「显示体积」再交给 `ContainerGraphic`，于是液面在动画里逐帧上涨、源容器
  逐帧下降，而 store 里的 `contents` 一直没动，`pour()` 在动画结束时才结算一次。水柱是一条
  `Q` 曲线，`stroke-dasharray` 配 `lab-pour-flow` 让虚线往下流，落点再叠一颗 `lab-pour-drop`
  水滴；源容器在目标左侧时 `.lab-vessel--pour-left` 把旋转中心镜像到 `22% 84%`。

液体相关的三个约定：

- 颜色来自容器状态 `color`（`syncItem()` 混色 + 指示剂覆盖），`.lab-liquid__fill` 的
  `transition: fill 480ms` 负责变色反应的平滑过渡。
- 液面高度 = `(bottom - top) × pow(volume / capacity, 0.75)`，最少 5px：10 mL 在 250 mL
  烧杯里也看得见，相对高低仍随体积单调变化。
- `.lab-liquid__wave` 用 `lab-liquid-drift` 做 9 秒往返漂移；`prefers-reduced-motion: reduce`
  时关闭动画。

## 反应引擎

`src/reactions.js` 把化学知识写成数据，引擎本身与具体反应无关：

| 导出 | 作用 |
| --- | --- |
| `SPECIES` | 物质表（41 种）：中文名、`label`（带下标的化学式）、颜色、pH、是否为固体、别名 |
| `RULES` | 33 条规则：`pair`（两种反应物，受热分解只写一种）、`products`、`phenomenon`（操作条文案），可选 `gas`（label / loss）、`heat`、`minTemperature`、`note` |
| `reactContents()` | 反复匹配直到没有新反应（上限 400 轮），返回 `{ contents, temperature, events, changed }` |
| `describeReaction()` / `describeGas()` | 拼出“HCl + NaOH → NaCl + H₂O（…，共 10 次）”式日志 |
| `indicatorTint()` / `indicatorText()` / `hasIndicator()` | 按 pH 决定液体颜色与提示文案 |

- 匹配只看化学式，与加入顺序无关；1 份试剂 = 1 次反应，不做化学计量配平。
- 生成气体时按规则的 `loss` 扣减液体体积（体积守恒的教学近似），气泡、`↑ CO₂` 徽标与现象文字在 6 秒后一起收起。
- 加试剂 / 倒液 / 清空后立即结算；受热分解（`minTemperature`）由 `tickHeating()` 在每次温度变化时结算，所以必须先点酒精灯把容器加热到门槛温度。
- 纯固体分解没有液体可分配时，把消耗的固体折算成等量产物体积（1g ≈ 1mL）；规则里写 `state: 'solid'` 的产物（如分解出的 Na₂CO₃）不占液体体积。

改动规则表后可以先用无依赖的自测脚本确认没有改坏：

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/lab_reactions_test.js
```

脚本用 `readFile` 读取 `lab/src/reactions.js` 并去掉 `export` 前缀后在函数作用域内求值，因此不需要 Node 或打包步骤。目前共 56 项断言：规则表自检（化学式都在 `SPECIES` 里、id 唯一）、沉淀 / 放气 / 置换 / 中和放热 / 指示剂 / 多步串联，以及受热分解的温度门槛（室温不分解、100°C 出黑色 CuO、NaHCO₃ 放 CO₂、130°C 煅烧石灰石）。

## 技术栈

| 层 | 实现 |
| --- | --- |
| 视图 | React 18 |
| 状态 | Zustand 4 |
| 拖拽 | `@dnd-kit/core` 6（步骤 2 接入交互） |
| 打包 | esbuild，输出单文件 IIFE，兼容 `file://` |

## 重建运行时

需要 Node.js 与 npm：

```bash
npm install
npm run build:lab
```

源码修改后必须重新生成 `lab/chem-lab.js`，否则页面仍加载旧运行时。
