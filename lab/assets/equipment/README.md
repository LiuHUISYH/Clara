# 器材贴图（可选）

`lab/src/canvas/EquipmentImage.jsx` 会按下面的规则找图：

```
lab/assets/equipment/<type>.png      # 例如 beaker.png / test-tube.png / burner.png
```

- **文件名**就是 `art.js` 里的器型 key：`beaker`、`test-tube`、`erlenmeyer`、
  `round-flask`、`volumetric-flask`、`reagent-bottle`、`burner`、`stand`、
  `wire-gauze`、`rod`、`dropper`、`match`、`ph-paper`。
- **透明底 PNG**，长边建议 2× 于毫米尺寸（烧杯 156×200、试管 40×304、铁架台 400×1120），
  浏览器会按设备像素密度自动取用，不必再准备 `@2x` 目录。
- **比例不用管**：组件从 `art.js` 读 `size.width / height` 设置 `Konva.Image` 的宽高，
  图片会被拉伸到真实毫米比例（1px = 1mm）。请按同一比例出图，否则会被拉变形。
- 图片加载失败（还没放素材）时**自动退回矢量绘制**（`canvas/art/*.jsx`），
  所以仓库里可以只有代码、没有 PNG；放入同名图片即自动替换，无需改代码。
- 想给某件器材单独指定贴图，可在库条目上写 `sprite: 'lab/assets/equipment/xxx.png'`；
  写 `sprite: false` 表示这件器材只用矢量。

落地阴影不由图片提供：`ContactShadow` 在贴图下方单独画一条椭圆，
这样器材被拖起时阴影仍然贴在地面上。
