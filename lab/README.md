# 虚拟实验室

`lab/src` 是虚拟实验室的 React 源码。运行时不依赖 Node 或开发服务器：`index.html`
直接加载已经打包好的 `lab/chem-lab.js`。

## 当前进度

- ✅ 步骤 1：三块基础骨架（左侧器材/试剂库、中间点阵实验台、底部实验日志）。
- ✅ 步骤 2：从左侧拖拽器材到实验台并在画布内移动；点击选中后出现操作条（重构步骤 3 起改为浮层面板），
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
- ✅ Canvas 引擎步骤 1–2：实验台改用 Konva（`react-konva` 18.2.16 + `konva` 9.3.20）绘制——Stage 分三层
  （背景 / 器材 / 特效），背景层用 `sceneFunc` 画 22mm 点阵、台面线与毫米标尺；器材每件一个 `draggable`
  的 Konva `Group`，锚点就是 `art.js` 的左上角，拖动时按「画布宽 − 器材宽」「台面线 − 器底」钳制，
  松手后 `snapTo()` 把玻璃底吸到铁圈（52mm）、焰尖（器底离焰尖 6mm）或石棉网上，其余交给 `settleY()`
  落台面；按下 / 拖动自动 `moveToTop()`，夹在铁架台上的容器渲染在铁架台之后。烧杯按五层画（横向渐变
  玻璃本体 + 内腔空气 + `clipFunc` 裁进内腔的液体 + 内壁厚度线 + 杯口导流槽），刻度、反光柱与漫反射斑
  全部对齐 `art.js` 的毫米坐标。
- ✅ Canvas 引擎步骤 3–4：把「会动的东西」搬进画布——整块画布只有一个 `Konva.Animation`（`canvas/motion.js`
  的 `clock`），30fps 重绘器材层与特效层，掉帧时按真实时间补（单帧最多 0.12s），页面切后台自动停；
  台面上没有任何液体 / 火焰 / 倒液流时 `hasMotion()` 直接跳过重绘（空台面 0 次 `draw`），
  **① 液面波**：`canvas/art/LiquidBody.jsx` 用两条不同波长 / 方向的正弦叠出液面，贴壁处微微上翘，
  沸腾时振幅 1.2–2.6mm、频率翻倍，搅拌时中心凹成碗形，`clipFunc` 裁进内腔所以波形再大也爬不出玻璃；
  液面亮线 + 暗线 + 漂移的反光斑同帧画出，浑浊度叠一层白雾，接液时落点压一圈涟漪；
  **② 倾倒**：`canvas/effects/PourStream.jsx` 画在特效层——源头取瓶口最外侧的唇边（`lipPoint()` 跟着
  倾角转），落点取目标容器**当前液面**，路径是上粗下细的二次贝塞尔实体 + 亮芯 + 流动亮斑 + 落点涟漪 / 飞溅；
  同时 `KonvaBench` 把倾倒中的容器绕瓶口缓动 ±19°（`bindTilt()` 用 offset 把瓶口钉在原位），
  `LiquidBody` 再按倾角把液面拉回世界水平（裁出「水平面以下」的四边形再填内腔），所以瓶子斜了、液面还是平的；
  **③ 气泡与沉淀**：`canvas/effects/VesselFx.jsx` 按 `gas` / `boiling` / `turbidity` / `stirring` 画上升气泡
  （沸腾 14 颗、放气 3–10 颗，相位由 `hashSeed(item.id)` 决定，不会一帧换一批）、搅拌涡流三圈亮弧、
  器底沉渣与悬浮颗粒、沸腾时瓶口飘出的蒸汽；**④ 火焰**：`canvas/art/FlameShape.jsx` 把三层火苗改成按时间算的
  贝塞尔（焰尖左右摆、焰高呼吸、亮度闪烁），酒精灯与火柴共用。动画全部在 `sceneFunc` 里读时钟，
  React 一次都不重渲染。
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
- ✅ 重构步骤 1–2：预置试剂瓶 + 高保真器材渲染——
  **① 预置试剂瓶**：器材库最前面新增「预置试剂瓶」分类（盐酸 / 氢氧化钠 / 硫酸铜，各 500mL），
  条目字段 `shape: 'reagent-bottle'` / `stock: true` / `label` / `reagent`；`createItem()` 用
  `source.shape` 决定器型，并把 `reagent` 直接灌进 `contents` 再走一遍 `syncItem()`，所以拖出来的
  就是一瓶装着 500mL、贴着标签、塞着瓶塞的试剂（`volume = 500`、CuSO₄ 的 `color` 为 `#4f8bc8`），
  日志写「拖拽 500mL 盐酸试剂瓶 至 实验台（HCl 500mL）。」；库里每条带一枚液体色块
  （`.lab-item__swatch`）与「HCl · 500mL」尾注，合计 7 个分类、34 项；
  **② 高保真玻璃**：描边统一成 `rgba(0,0,0,0.15)`（悬停加深），玻璃体由 6 层渐变叠出来——
  本体（左缘白高光 → 右缘厚度）、纵向薄雾、液体纵深（底部冷调）、液面柔光带、液面反光斑、
  `lab-glass__gloss` 漫反射白光斑（被瓶身 `clipPath` 裁切），直筒不再是线框；
  **③ 液面**：波浪改成相邻波峰上下交替的正弦（不再是一条锯齿），液面下方铺 18px 柔光带 +
  中央反光椭圆，无色液体（HCl / NaOH）靠冷调纵深与加粗的弯月面也能看出「装着东西」；
  **④ 器材结构**：烧杯杯口直接收成导流槽（尖嘴写进 `body` 轮廓，液面按 `top = 28.4` 映射），
  杯壁丝印 `200 / 150 / 100 / 50` 四道带毫升数的刻度；试管加厚唇口椭圆 + `15 / 10 / 5` 刻度；
  试剂瓶改成圆肩 + 颈环 + 玻璃瓶塞，瓶身贴白底黑字标签（名称 / 化学式 / 分析纯 AR / 净含量，
  酸红碱蓝色带，由 `BottleLabel` 按 `item.label` 排版），空细口瓶只留一张空白标签；
  **⑤ 工具拟物**：玻璃棒换成两端磨圆的高硼硅杆（左侧长高光 + 右缘暗边 + 端头收口），
  胶头滴管换成橡胶椭球 + 收细玻璃滴嘴（`item.dropperFill` 为真时显示管内液柱）；
  瓶塞开合幅度收到 `translate(-4px,-4px) rotate(10deg)`，开塞后停在瓶口上方而不是飞走。
- ✅ 步骤 3 精修：玻璃棒搅拌与「倒得像真的」——
  **① 搅拌**：把玻璃棒拖进容器（或选中容器后点「搅拌」）就开搅，`stir()` 把棒子斜插进液面、
    容器进入 `stirring`，之后 `tickStir()` 每帧推进 `stirProgress`：可溶固体按 `DISSOLVE_STEP`
    溶成同种物质的溶液（1g ≈ 1mL），4.2s 后自动收手并写「搅拌结束，液体混合均匀」；
  **② 涡流视觉**：`Glass.jsx` 的 `Swirl` 画出涡心凹面（`lab-swirl__dip`）、3 段打旋亮弧
    （`lab-swirl-fade` + `lab-swirl-spin`）与随棒子摆动的液面（`lab-liquid-stir`），固体颗粒
    跟着涡流打转（`lab-solid-group--swirl`），棒身绕杆尖在 −16°→−6° 之间以 1.45s 周期摇摆（`lab-rod-rock`）；
  **③ 杆尖入液**：搅拌位置不再写死偏移，而是按 `Glass.jsx` 的液面算法反算杆尖——
    `liquidSurfaceY()` 用同一套「体积 ÷ 容量 的 0.75 次幂」求出液面，`stirTipY()` 让杆尖插到
    液面下六成深度（8~18mm，留 5mm 不戳杯底），液面低时棒子自动放低，不会悬空搅空气；
  **④ 搅拌即匀热**：`heatSource()` 把「正在搅拌」当作垫了石棉网的同等待遇（`evenHeat`），
    升温按 `STIR_HEAT_RATE`（6°C/s）比直火 `HEAT_RATE`（4°C/s）更快，停手后立刻退回「受热不均」；
    搅拌中的容器是锁定实体（`moveItem()` 拒绝并提示先「停手」），移走容器 / 清空液体会自动收手；
  **⑤ 倒得更像真的**：`PourStream` 拆成三层——上宽下窄的实体水柱（`lab-pour__body`，从
    芯线宽度的 1.9 倍沿曲线收窄到 1.15 倍，`mix-blend-mode: multiply` 压在玻璃上）、中间的实芯
    （`lab-pour__stream`，线宽 2.2–3.8px 随转移量）、白色高光虚线（`lab-pour__glint`）；
    落点新增一圈扩散的水花（`lab-pour__splash`，0.62s 循环）与一滴悬空液滴（`lab-pour__drop`），
    源容器 38° 倾斜、水柱从瓶口斜下方甩出，落点按 `mouthPoint()` 对齐目标液面。
- ✅ 重构步骤 3：按「1px = 1mm」重建尺度、器材库与操作面板——
  **① 一把尺子量到底**：新增 `src/art.js`，每件器材只写真实毫米尺寸——250mL 烧杯 78×100
  （杯身 φ68×90，含导流槽）、20mL 试管 20×152、锥形瓶 90×110、圆底烧瓶 94×114、
  容量瓶 68×124、500mL 细口瓶 62×182、铁架台 200×560（底板 200×14、立杆 φ10、铁圈 φ92、圈心 (98, 400)）、
  酒精灯 80×118（焰尖 y=8）、石棉网 120×10、玻璃棒 φ6×236、胶头滴管 24×112、
  火柴 12×54、pH 试纸 16×54，并给出器底 `base`、内腔 `top/bottom`、瓶口 `mouth`。
  SVG 的 `viewBox` 直接取毫米数、页面按 1:1 显示，容器不再统一缩放到 104×128 的令牌里：
  250mL 烧杯在 20mL 试管旁边就是「矮而胖」，铁架台比两者都高一个头。`store.js` 的
  `hitBox()` / `dimensionsOf()` / `boundsOf()` / `mouthPoint()` / `basePoint()` 全部改读这张表
  （薄长工具如玻璃棒、火柴按 18mm 最小可点宽度放宽命中盒，画面仍是真实粗细）。
  **② 图标网格器材库**：`src/icons.jsx` 用 32×32 线稿按器型（烧杯 / 试管 / 锥形瓶 / 圆底烧瓶 /
  容量瓶 / 细口瓶 / 酒精灯 / 铁架台 / 玻璃棒 / 胶头滴管 / 石棉网 / pH 试纸 / 火柴）与物态
  （液体 / 固体）分派到 15 个图案，液体试剂的色相取自 `speciesColor()`，和倒进烧杯后的颜色同源；
  库里改成两列卡片（图标 + 名称 + 「HCl · 500mL」尾注），一屏能扫完一组。
  **③ 重力与落台面**：`settleY(type, x, y, canvasHeight, items)` 是松手后的唯一去处——先看有没有石棉网在下面（落网面），再看是否压在燃着的焰尖上（架上去加热），都没有就落到台面线 `deskLineY()`（画布底边留 `DESK_MARGIN = 58` 放标签）；落在铁圈附近的容器另由 `clampOnStand()` 吸进铁夹。库里拖出来、画布里拖动、点击直接放置走的是同一条路径，
  所以「从库拖到半空」也会自己掉到台面上，不会浮在半空。
  **④ 吸附**：试管落点离铁圈圈心小于 `CLAMP_RADIUS`（52mm）或直接落在铁架台上就夹进铁夹
  （`clampOnStand()`，x 对准圈心、玻璃底落在圈心线上）；石棉网落到焰尖上方按
  `GAUZE_FLAME_GAP` / `GAUZE_FLAME_OVERLAP` 吸附成「网在火上」，容器再落到网上按 `onGauze()`
  吸附成「容器在网面上」；酒精灯只认燃着的火柴（`lightItem()`），灯帽按 `lit` 平移让位。
  **⑤ 浮层属性面板**：选中器材后在实验台右上角浮出 `BenchPanel`——名称可直接改名
  （草稿态，失焦 / 回车才 `renameItem()`）、浓度按 mol·L⁻¹ 录入（`setConcentration()`，超出
  0–18 夹回并回写输入框）、`Vol / Temp / PH` 一行读数、受热状态（「直接受热 · 玻璃受热不均」/
  「垫石棉网 · 均匀受热」/「搅拌中 · 均匀受热」）、`Contents` 方括号清单与反应现象，下面按器材
  能力排操作按钮：加入试剂 / 倒出 / 搅拌 / 振荡 / 冲洗 / 开塞 / 清空 / 取下 / 点燃 / 移走；
  面板宽度固定、贴着实验台右侧，窄屏（< 1080px）自动落到底部日志上方。

## 已实现的交互细节

| 能力 | 说明 |
| --- | --- |
| 器材 / 试剂库 | 7 个分类、34 项，两列图标网格（`src/icons.jsx` 的 32×32 线稿：图标 + 名称 + 「HCl · 500mL」尾注），点击分类折叠，点击条目直接放入实验台（走 `settleY()` 落台面）。第一类「预置试剂瓶」是拖出来就带着 500mL 液体、贴着标签、塞着瓶塞的整瓶试剂（`stock: true`），其余容器仍是空器皿 |
| 拖拽 | `@dnd-kit/core`：库里拖入画布、画布内自由移动（跟手幽灵 + 按真实尺寸钳制 + 松手置顶 + `settleY()` 落台面）、试剂拖到容器上；`PointerSensor` 设 6px 起拖阈值，避免点击被当成拖动 |
| 选中 | 点击器械在实验台右上角浮出属性面板 `BenchPanel`（名称 / 浓度 / 读数 / 受热 / 内容物 / 操作）；Esc 或点击空白取消选中；拖动松手也会选中刚移动的器材 |
| 容器状态 | `contents[]`（试剂、体积、温度）+ `volume` / `ph` / `color` / `temperature` / `turbidity` / `open` / `molarity`，预置试剂瓶另有 `stock` / `label`（标签四行文字），所有变更统一经过 `syncItem()` |
| 实体几何 | 每件器材的 `dimensions` 取自 `src/art.js` 的真实毫米尺寸（烧杯 78×100、试管 20×152、铁架台 200×560…），`hitBox()` 只给玻璃棒 / 火柴这类薄长工具补到 18mm 可点宽度；`boundsOf()` 给绝对包围盒，`mouthPoint()` / `basePoint()` 从同一张表取瓶口与器底，`overlaps()` 做 AABB 相交；`LAB_GEOMETRY` 与 `window.CL.lab` 暴露同一套数值供页面与自测复用 |
| 瓶塞开合 | 带塞容器（试剂瓶 / 预置试剂瓶）`stopper: true`、`open: false`；点画布上的瓶塞（`.lab-stopper__hit` 透明热区，`pointerdown` 拦截以免被当成拖拽）或面板上的「开塞」按钮调用 `toggleStopper()`；瓶塞按 `translate(-4px,-4px) rotate(10deg)` 抬离瓶口（320ms 过渡，停在瓶口上方不脱离瓶子）；`pour()` / `addReagent()` / `dumpLiquid()` 都以 `open` 为前置条件，塞着时写「瓶塞没打开」警告 |
| 倒液 | 容器互拖时用 `pourAlign()` 判瓶口：X 中心差 ≤ `POUR_ALIGN_X`（30mm），且「悬停倾倒」源口高于目标口 `POUR_GAP_MIN`~`POUR_GAP_MAX`（8–150mm）或「松手叠放」两容器 Y 差 ≤ `POUR_DROP_Y`（70mm）才算倒液（`canPour`）；目标容器高亮并在拖拽途中套上虚线瓶口罩；`startPour()` 起 1.1s 的 `pourFlow` 动画（源容器 38° 倾斜、目标液面按进度上涨、锥形水柱 + 落点水花），结束再调 `pour()` 按容量部分转移、保留温度与 pH；没对准只按摆放处理 |
| 倾倒动画 | `.lab-vessel--pouring` 让 `svg` 绕 `78% 84%` 转 38°（向左倒镜像成 `22% 84%` / -38°），`PourStream` 从 `mouthPoint(源)` 到 `mouthPoint(目标)` 画一条 `Q` 曲线：上宽下窄的实体水柱（`lab-pour__body`，1.9 → 1.15 倍收窄）、实芯（`lab-pour__stream`，线宽 2.2–3.8px 随转移量）、白色高光虚线，落点是扩散的水花（`lab-pour__splash`）加一滴液滴；目标容器用「显示体积 = 实际体积 + 进度 × 转移量」逐帧上涨，动画期间不写回 store，因此只结算一次 |
| 搅拌 | 玻璃棒拖进容器即 `stir()`：棒子斜插进液面（`stirTipY()` 按 `art.top/bottom` 与当前体积反算杆尖深度，杆尖 x 取命中盒中心）、容器进入 `stirring` 并在 4.2s 内由 `tickStir()`（120ms 一次）推进涡流与溶解；`DISSOLVE_STEP` 每 tick 溶掉 0.12g 可溶固体（1g ≈ 1mL 并进液体），到点自动收手写「搅拌结束，液体混合均匀（溶解 x g 固体）」；面板按钮在「搅拌 / 停手」之间切换（`stopStir()` 可提前收手，收棒位置与自动到期一致）；搅拌中的容器锁定移动（`moveItem()` 记「先「停手」再移动」），移走容器 / 清空液体会自动收手 |
| 振荡 / 冲洗 | 「振荡」（`shakeItem()`）让容器进入 `shaking` 并在 CSS 里晃 0.26s 一个来回，同时记一条「振荡 <名称>，液体摇匀。」；「冲洗」（`rinseItem()`）清空内容物、把温度拉回 25°C 并记「用蒸馏水冲洗 <名称>。」 |
| 铁架台吸附 | 容器松手时玻璃底中心到铁圈圈心（`clampPoint(stand)` = 实体内的 (98, 400)，即台面上方 160mm）距离 < `CLAMP_RADIUS`（52mm）或直接落在台上（横向对齐圈心且竖直方向进入铁架台范围），`clampOnStand()` 把容器夹住（x 对准圈心、玻璃底落在圈心）并进入锁定态：`useDraggable` 禁用、`moveItem()` 拒绝并记「先「取下」再移动」、指针 `not-allowed`；`moveItem()` 对铁架台做刚体平移，夹着的容器同步位移；「取下」（`releaseClamp()`）或移除铁架台才解锁 |
| 点火 | 火柴是唯一的火源：`lightItem()` 里火柴划燃后燃烧 `MATCH_DURATION`（9 秒），`tickHeating()` 每秒刷新剩余秒数，燃尽自动熄灭；酒精灯只有台面上存在燃着的火柴时才能点燃（按钮或把火柴拖到灯上），灯帽随 `lit` 平移让位 |
| 加热 | 酒精灯“点燃 / 熄灭”（需先用火柴划燃）；火焰碰撞判定（`inFlame()`）：容器中心与火焰中心横向偏差 < `FLAME_X_RANGE`（26mm）、焰尖到容器玻璃底 −`FLAME_OVERLAP`（20mm）~ `FLAME_GAP`（26mm，夹在铁架台上的容器放宽到 `CLAMP_HEAT_GAP` 64mm）；受热 `HEAT_RATE = 4°C/s`、降温 `COOL_RATE = 2°C/s`；液体止于 100°C（`boiling`），干烧止于 160°C |
| 石棉网 | `heatSource()` 先查「架在火焰上的石棉网托着容器」（`gauzeInFlame()` + `onGauze()`，网面取 `TOOLS['wire-gauze'].top/base`（0 / 10mm），横向 ±`GAUZE_X_RANGE`），再退回直接受热；隔网加热记 `evenHeat`，面板显示「受热: 垫石棉网 · 均匀受热」；直接加热到 `UNEVEN_TEMPERATURE`（60°C）记一次「受热不均（建议垫上石棉网）」警告；石棉网拖到容器上由 `stackGauze()` 垫入（容器在火焰上时连容器一起抬起），容器拖到网上由 `standOnGauze()` 吸附 |
| 搅拌匀热 | 正在搅拌的容器同样算 `evenHeat`（涡流把热量从杯壁带进液体，和垫石棉网等价，面板显示「受热: 搅拌中 · 均匀受热」并跳过「受热不均」警告），升温按 `STIR_HEAT_RATE`（6°C/s）比静置直火的 `HEAT_RATE`（4°C/s）快 50%；「停手」后立刻退回 4°C/s 与不均匀判定 |
| 反应结算 | `settleContents()` 在加试剂 / 倒液 / 清空后调用 `reactContents()`，`tickHeating()` 在每次温度变化后也会调用它来触发受热分解；沉淀累积在 `contents[]` 的 solid 条目里（新生成的固体带 `lab-solid-settle` 下沉动画），生成的液体与剩余液体合并，`loss` 表示逸出气体带走的体积 |
| 规则表 | `RULES` 33 条：AgCl / BaSO₄ / Cu(OH)₂ 等沉淀，CO₃²⁻ + 2H⁺ 放气，Zn / Fe / Mg + 酸，Fe + Cu²⁺ 置换，H⁺ + OH⁻ 中和（放热至多 +65°C），沉淀 + 酸溶解，NaHCO₃ / Cu(OH)₂ / CaCO₃ 受热分解 |
| 受热分解 | 规则带 `minTemperature`（NaHCO₃ / Cu(OH)₂ 80°C、CaCO₃ 120°C）；`tickHeating()` 每次升温后把温度传回 `reactContents()`，到点立即分解并写入日志，干烧到 160°C 上限后继续分解剩余固体 |
| 指示剂 | 酚酞 pH > 8.2 变红、石蕊酸红碱蓝；颜色通过 `indicatorTint()` 覆盖液体填充色，pH 翻转时补一条日志 |
| 现象反馈 | 三层火焰（外焰 / 中焰 / 焰心 + 底部光晕）带 `prefers-reduced-motion` 分支，火焰上架着容器时加 `lab-flame--in-use`（外焰更亮、光晕放大 1.28 倍，石棉网架在火焰上同样触发）；≥60°C 的容器描边转浅暖色；受热容器把说明文字移到右侧避让火焰（石棉网上的容器还会再让开网面）；沸腾时气泡升到 9 颗、以 1.05s 更快上升，液面改用 `lab-liquid-churn` 剧烈翻滚，瓶口飘出 5 团模糊水蒸气（`lab-steam-rise`，`prefers-reduced-motion` 下静止），副标题显示「沸腾」；放气气泡数量随 `gasTimes`（同一次操作里规则触发次数）增加；沉淀堆体 + 5 颗浮动颗粒（`lab-solid-mote`）；石棉网被火焰烤着时网格与垫子转暖色、底部透出 `lab-gauze__glow` 光晕、副标题显示「匀热中」；划燃的火柴复用同一套三层火苗，副标题显示「燃烧中 · 9s」并转暖色 |
| 数据读数 | 浮层面板用等宽字体给出 `Vol: 30mL | Temp: 100°C | PH: 5.0`、`Contents: [NaNO₃ 20mL + AgCl 10g + HCl 10mL]`、受热状态与反应现象；另有名称输入框（`renameItem()`）与浓度输入框（`setConcentration()`，0–18 mol·L⁻¹）；选中容器即刷新，沸腾、夹持、现象各有独立字段 |
| 玻璃渲染 | `src/Glass.jsx`：轮廓统一 `rgba(0,0,0,0.15)`（悬停加深），玻璃体叠 6 层渐变——本体（左缘白高光 → 右缘厚度）、纵向薄雾、液体纵深、液面柔光带、液面反光斑、`lab-glass__gloss` 漫反射斑；烧杯导流槽写进 `body` 轮廓、杯壁丝印 `200/150/100/50`；试管厚唇口 + `15/10/5`；试剂瓶圆肩 + 颈环 + 玻璃瓶塞（塞芯、塞头、高光各一条 `<path>`，热区是一块透明 `rect`）+ `BottleLabel` 白底黑字标签（名称 / 化学式 / 分析纯 AR / 净含量，酸红碱蓝色带；空瓶留空白标签）；液体用内腔 `clip-path` 裁切，顶边是相邻波峰上下交替的正弦波 `<path>`，液面缓慢漂移；固含量 > 0 时液体上叠一层冷灰白雾（`turbidity` 0–0.86，640ms 过渡） |
| 酒精灯渲染 | `src/Vessel.jsx`：玻璃灯体（酒精液面随瓶身裁切）+ 2 段金属灯芯管 + 灯芯 + 灯帽；未点燃时灯帽扣在灯芯管上，点燃后平移 27×38 移到灯旁台面并淡入接触阴影 |
| 工具渲染 | `src/Vessel.jsx`：玻璃棒是两端磨圆的高硼硅杆（`linearGradient` 左高光 → 右暗边 + 端头收口弧线）；胶头滴管是橡胶椭球（深灰渐变 + 左上高光）+ 收细的玻璃滴嘴，`item.dropperFill` 为真时显示管内液柱 |
| 日志 | 仿终端深色控制台（`#14171a`）：等宽字、绿色 `> ` 提示符、反应行绿色 / 警告行琥珀色，记录放置、移动、加试剂、开合瓶塞、倾斜倒液、划燃 / 熄灭火柴、点燃 / 熄灭酒精灯、夹持 / 取下、受热、沸腾、降温等操作；反应日志统一以「发生反应：」开头（`describeReaction()` 文本 + 现象 + 注释） |

## 实体几何与倾倒判定

`lab/src/store.js` 的几何层是所有交互的唯一来源，页面只负责把结果画出来：

| 导出 | 作用 |
| --- | --- |
| `art.js` 的 `GLASS` / `TOOLS` / `artOf(type)` / `sizeOf(type)` | 器材的毫米尺寸、器底 `base`、内腔 `top/bottom`、瓶口 `mouth`、铁圈 (98, 400)、焰尖 y、杆尖 (5, 238) —— 绘图与物理共用的唯一来源 |
| `item.dimensions` / `hitBox(item)` | 实体包围盒尺寸（真实毫米；玻璃棒 / 火柴等薄长工具按 18mm 最小可点宽度放宽），随实体一起存在 Zustand 里 |
| `boundsOf(item)` | 绝对坐标 AABB，用于命中、边界与重叠判断 |
| `mouthPoint(item)` | 瓶口中心：`x = item.x + mouth.cx`，`y = item.y + mouth.cy`（直接读 `art.js`，不再有 × 1.1538 的换算） |
| `basePoint(item)` | 器底中点：`x = item.x + width / 2`，`y = item.y + base` —— 落台面 / 落铁圈 / 落焰尖都按它算 |
| `settleY(type, x, y, canvasHeight, items)` | 松手后的落点：石棉网网面 → 点着的焰尖 → 台面线（铁圈吸附另由 `clampOnStand()` 处理） |
| `deskLineY()` | 台面线：`canvasHeight - DESK_MARGIN(58)`，桌下留出器材名称的高度 |
| `overlaps(a, b)` | 两个实体的 AABB 是否相交 |
| `pourAlign(source, target)` | 返回 `{ dx, gap, aligned, droppable, canPour }`：`aligned` 是「悬停倾倒」（源口高于目标口 8–150mm 且 `dx ≤ 30`），`droppable` 是「松手叠放」（Y 差 ≤ 70mm），`canPour` 是两者的并集 |
| `clampPoint(stand)` | 铁圈圈心 = 实体坐标 + (98, 400)，吸附半径 `CLAMP_RADIUS = 52` |

`LabPage.jsx` 的 `labCollisionDetection()` 会把拖拽中的令牌矩形对回画布坐标（`dragOrigin()`），
构造一个临时实体再和落点容器做 `pourAlign()`；`Workbench` 用 `useDndMonitor({ onDragMove })` 做同一件事，
给命中的容器加 `.lab-vessel--pour-ready`（虚线瓶口罩）。因此**提示与结算永远是同一个结论**：
看到对准圈松手一定倒得进去，没对准就只是摆放。

`dragOrigin()` 有三处细节，缺一处就会出现「明明对上了却没倒」：

1. 画布矩形取 droppable 的**真实 DOM 节点**（`benchNode()`）而不是 `droppableRects` 的测量缓存，
   否则滚动 / 布局微调后会给坐标带上几十像素的偏差；
2. 松手位置按「指针坐标 − 拖拽开始时记下的指针偏移」（`recordGrabOffset()` 存在 `grabOffset` 里）换算，
   不用 `active.rect.current.translated`——后者晚一帧，快速拖动时会差出一整步；
3. 碰撞回调里跳过**正在拖的那件器材自己**的落点（否则拖起烧杯时指针永远压在自己的令牌上，
   自己被判成「落点」而不是对面那只烧杯）。

`window.CL.lab` 另外暴露 `geometry` / `boundsOf` / `mouthPoint` / `pourAlign`，自测脚本可以直接复用，
不必在测试里重算常量。

## 玻璃与液体渲染

`src/Glass.jsx` 负责容器，`src/Vessel.jsx` 负责酒精灯（玻璃灯体 / 灯帽 / 三层火焰）与铁架台、
玻璃棒、胶头滴管、石棉网、pH 试纸、火柴，并通过 `LabGraphic` 对外出口。白底玻璃不靠深色线，而靠
「浅灰描边 + 白色高光 + 右缘厚度」勾形；每只容器的 `viewBox` 就是它在 `art.js` 里的毫米尺寸
（烧杯 `0 0 78 100`、试管 `0 0 20 152`、铁架台 `0 0 200 560`），页面按 1:1 显示，
所以线宽、刻度字高在每件器材上都是同一个物理尺度。容器的 SVG 按下面的顺序叠放：

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

铁架台与石棉网也是同一套线稿（`viewBox` 分别为 `0 0 200 560` 与 `0 0 120 10`）：

- 铁架台（`StandGraphic`）：200×14 的圆角底板 + φ10 立杆（x 148~158，与底板焊在一起）+
  侧面固定螺丝 + 正面看过去的铁圈 `-ring`（圈心 (98, 400)，外径 92 / 内径 80，离台面 160mm），
  铁圈与石棉网的铁框用同一种金属灰，摆在一起能看出「网是架在圈上的」。
- 石棉网（`GauzeGraphic`）：120×10 的金属框 `-frame`（线性渐变拉出金属反光）+ 被 `-clip`
  裁在框内的 8 条交叉斜线 `-mesh` + 中间白色石棉垫 `-pad`（φ68 的椭圆，真实 12.5cm 见方）+ 顶边亮线 `-edge`，
  落在台面上时压一片 `-shadow` 椭圆。架在燃着的火焰上时加 `lab-gauze--hot`：网格与垫子转暖色，
  网面下透出一层 `lab-gauze__glow` 椭圆光晕。
- 玻璃棒（`RodGraphic`）：φ6×236 的两端磨圆高硼硅杆，倾斜搅拌时绕杆尖 (5, 238) 摇摆；
  胶头滴管（`DropperGraphic`）：φ4.8 玻璃管 + 橡胶头，全长 112；火柴（`MatchGraphic`）：
  φ1.6×42 木梗 + 火柴头，划燃后复用酒精灯的三层火苗。

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
- 液面高度 = `(bottom - top) × pow(volume / capacity, 0.75)`，最少 6mm：10 mL 在 250 mL
  烧杯里也看得见，相对高低仍随体积单调变化（内腔毫米数直接来自 `art.js`）。
- `.lab-liquid__wave` 用 `lab-liquid-drift` 做 9 秒往返漂移；`prefers-reduced-motion: reduce`
  时关闭动画。

搅拌（`Swirl`）叠在液面之上、同样被内腔 `clip-path` 裁切：

- 涡心是一块下凹的椭圆（`.lab-swirl__dip`，`rgba(18,38,52,0.16)`），往下压出「中间低、四边高」的漏斗感；
- 3 条打旋亮弧（`.lab-swirl__arc`）绕涡心慢转（`lab-swirl-spin` 1.9s），各自带 1.2s 的明暗呼吸
  （`lab-swirl-fade`），深浅错开才像被搅动的水面；
- 液面顶边换 `lab-liquid-stir`（0.95s）跟着棒子小幅晃动，底部沉淀整组加 `lab-solid-group--swirl`
  打旋，看得出「固体被涡流卷起来了」；
- 玻璃棒加 `lab-vessel--stirring-rod`：名称 / 读数淡出、`svg` 绕杆尖（`transform-origin: 50% 99.2%`）
  在 −16° → −6° 之间摇摆（`lab-rod-rock` 1.45s）；摇摆幅度刚好让杆尖（已插到液面下 8~18mm）不会甩出液面。

## Canvas 渲染引擎（Konva）

实验台默认由 Konva 绘制（开关在 `lab/src/engine.js` 的 `LAB_ENGINE`）。旧的 SVG + DOM 实现完整保留：
地址栏加 `#/lab?engine=dom`（或控制台执行 `CL.labEngine = 'dom'` 后重进实验室）即可切回，用来对照与兜底。

| 文件 | 职责 |
| --- | --- |
| `canvas/LabStage.jsx` | Stage 与三层 Layer：背景（`listening={false}`）/ 器材 / 特效（气泡、涡流、沉淀、蒸汽与倒液水柱） |
| `canvas/DeskLayer.jsx` | 22mm 点阵、台面线（`deskY = 画布高 − 58`）、底边毫米标尺、空台提示；用 `sceneFunc` 一帧画一条路径 |
| `canvas/EquipmentNode.jsx` | 一件器材 = 一个 `draggable` 的 Konva `Group`；选中虚线框、拖动钳制、`moveToTop()`、锁定态拦截；内层 `tilt` Group 供倾倒动画绕瓶口旋转 |
| `canvas/EquipmentImage.jsx` | 贴图出口：加载 `lab/assets/equipment/<type>.png`，失败就退回矢量；`ContactShadow` 单独画落地阴影 |
| `canvas/EquipmentArt.jsx` | 器型分发（烧杯 / 其余玻璃 / 7 种工具）与选中读数（名称 + 状态，贴在台面线下方） |
| `canvas/art/BeakerShape.jsx` | 烧杯五层画法：横向渐变玻璃、内腔空气、`clipFunc` 液体、内壁厚度线、杯口导流槽，外加刻度 / 反光柱 / 漫反射斑 |
| `canvas/art/GlassShape.jsx` | 其余玻璃容器，全部按 `art.js` 字段驱动（`body` / `rim` / `wall` / `edge` / `graduations` / `labelRect` / `stopper`） |
| `canvas/art/ToolShapes.jsx` | 酒精灯（玻璃灯体 + 金属灯芯管 + `FlameShape` 火焰）、铁架台、石棉网、玻璃棒、滴管、火柴、pH 试纸 |
| `canvas/geometry.js` | 纯函数：`benchBounds` / `clampPosition` / `overlapsRect` / `snapTargets` / `snapTo` / `containerUnder` / `containerAt` |
| `canvas/liquid.js` | 内腔矩形 `interiorOf()`、裁剪路径 `interiorPath()`、液面高度与颜色、倾倒中的显示体积 |
| `canvas/motion.js` | 动画时钟 `clock` / 场景快照 `scene`（倒液流、倾角）、`hashSeed` / `noise` / `fract` / `ease`、`bindTilt`；`prefersReducedMotion()` 时不启动动画 |
| `canvas/flow.js` | 倒液水柱几何：`pourGeometry`（源唇边 → 目标液面）、`lipPoint`、`traceStream` / `traceCore`、`splashRadius` |
| `canvas/art/LiquidBody.jsx` | 有波动的液体：波形上沿 + 内腔裁剪 + 液面亮线 / 暗线 + 反光斑 + 浑浊白雾；倾斜时按世界水平面重新裁出液体 |
| `canvas/art/FlameShape.jsx` | 逐帧抖动的三层火焰（焰尖摆动 / 焰高呼吸 / 亮度闪烁）+ 桌面暖光，酒精灯与火柴共用 |
| `canvas/effects/VesselFx.jsx` | 气泡、搅拌涡流、器底沉渣与悬浮颗粒、沸腾蒸汽；都裁进各自内腔 |
| `canvas/effects/PourStream.jsx` | 特效层的倒液水柱：贝塞尔实体 + 亮芯 + 流动亮斑 + 落点涟漪 / 飞溅，落点是目标容器的当前液面 |
| `canvas/palette.js` | 玻璃 / 不锈钢 / 橡胶 / 火焰的渐变停靠点与文字色（和 CSS 的白底玻璃同一套色） |
| `canvas/useStageSize.js` | `ResizeObserver` 量宿主尺寸并取整 —— Stage 宽高带小数会在视网膜屏上糊掉 1px 高光 |
| `canvas/KonvaBench.jsx` | 把上面的零件接起来：显示体积、松手后的吸附 / 叠放 / 倾倒 / 落台面决策，以及唯一的 `Konva.Animation`（时钟 + 30fps 重绘 + 倾倒倾角） |

### 坐标、钳制与吸附

- Group 的 `(x, y)` 与 store 的 `item.x / item.y` **完全同义**（都取 `art.js` 的左上角，1 单位 = 1mm），
  所以拖拽结束只写一次 `moveItem()`，不需要任何 DOM 尺寸换算。
- 拖动中 `clampPosition()` 把器材关在实验台里：`x ∈ [0, 画布宽 − 器材宽]`、`y ∈ [0, 台面线 − 器底]`；
  器底最多压在台面线上，不会沉进桌面，画布太矮时退回 0 而不是负数弹飞。
- 松手先试 `snapTo()`，阈值与 `store.js` 同源：

  | 吸附 | 锚点 | 作用半径 | 结果 |
  | --- | --- | --- | --- |
  | `ring` | 铁圈圈心（`stand.x + 98, stand.y + 400`） | 52mm | `clampOnStand()`，x 对准圈心、玻璃底落在圈心线 |
  | `flame` | 焰尖上方 6mm | 26mm | 器底被火苗托住，直接受热 |
  | `gauze` | 石棉网网面中心 | 44mm | `standOnGauze()`，容器的底贴住网面 |
  | `gauze-on-flame` | 焰尖 | 44mm | 石棉网架到火上（网底离焰尖 10mm） |
  | `burner-seat` | 容器器底中心 | 22mm | 酒精灯塞到容器正下方，焰尖离器底 6mm |

  没有吸附时再看 `containerUnder()`：火柴 → 酒精灯点火、玻璃棒 → 容器搅拌、石棉网 → 容器垫底、
  容器 → 容器按 `pourAlign()` 判断是否倾倒；都不是才交给 `settleY()` 落台面（石棉网 → 焰尖 → 台面线）。
- 层级：`onMouseDown` / `onDragStart` 立刻 `moveToTop()`；夹在铁架台上的容器在渲染时排到铁架台之后
  （它是被举在铁圈上的，不该被圈压住）。store 的 `moveItem()` 也把刚移动的器材排到数组末尾，两边一致。
- 命中区：**不再给每件器材盖一块全尺寸透明矩形**，而是让画出来的玻璃 / 金属自己接事件 —— 铁架台只有
  底座、立杆和铁圈能点中，不会用 200×560 的盒子挡住台面上的其它器材；只有玻璃棒（φ6）、火柴（φ1.6）、
  pH 试纸这类薄长工具补一条 18mm 宽的透明热区。
- `draggable` 恒为 `true`：Konva 只在 `setDraggable()` 时挂 `mousedown.konva` 监听，属性切成 `false` 再切回来
  就再也装不上（react-konva 改的是 attr）。锁定态（夹在铁架台 / 正在搅拌）改为在 `dragstart` 里 `stopDrag()`
  并把坐标复位，`moveItem()` 再拒绝一次，规则与提示都不变。

### 贴图与矢量兜底

`EquipmentImage` 先找 `lab/assets/equipment/<type>.png`，找不到就用 `canvas/art/*` 的矢量画法 ——
仓库里可以只有代码，把同名 PNG 放进目录即自动替换，比例由 `art.js` 的毫米尺寸强制对齐。
命名与出图要求见 `lab/assets/equipment/README.md`。

### 自测约定

Konva 的拖拽监听的是 `mousedown.konva` / `touchstart.konva`，自测脚本必须派发**真实鼠标事件**
（`mousedown → mousemove × n → mouseup`）；`pointerdown` 只能触发点击选中。Konva 节点带
`id="item-<id>"`，脚本用 `CL.lab.stage.findOne('#item-…')` 读节点坐标，和 DOM 版的 `data-item-id` 等价。


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
| 画布 | Konva 9.3.20 + react-konva 18.2.16（Stage / Layer / Group / Path / `clipFunc`；旧的 SVG + DOM 实现保留为 `engine=dom`） |
| 状态 | Zustand 4 |
| 拖拽 | `@dnd-kit/core` 6（器材库 → 画布）；进入画布后的拖动、钳制与吸附由 Konva 的 `draggable` + `canvas/geometry.js` 接管 |
| 打包 | esbuild，输出单文件 IIFE，兼容 `file://` |

## 重建运行时

需要 Node.js 与 npm：

```bash
npm install
npm run build:lab
```

依赖只有 6 个（`react` / `react-dom` / `zustand` / `konva` / `react-konva` / `@dnd-kit/core`），
全部打进 `lab/chem-lab.js`，页面运行时不再发任何外部请求。

源码修改后必须重新生成 `lab/chem-lab.js`，否则页面仍加载旧运行时。
只改了 `canvas/` 下的绘制或几何时也一样 —— 画布代码在打包产物里。
