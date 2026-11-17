/**
 * EquipmentImage.jsx —— 器材贴图出口（Konva.Image）
 * ------------------------------------------------------------------
 * 工业级素材走 PNG：`lab/assets/equipment/<type>.png`（透明底、@2x 由浏览器
 * 自己按像素密度取用）。组件只做三件事：
 *   1. 按 art.js 的真实毫米尺寸设置 width / height —— 素材比例永远等于
 *      实验台上的比例，换图不会把烧杯拉成试管；
 *   2. 图片加载失败（仓库里还没放素材）就退回矢量图形（children），
 *      所以「没有素材也能跑」，有素材就自动换成照片级外观；
 *   3. 统一的落地阴影：阴影画在图纸下面，而不是烘焙进图片里，
 *      这样器材被拖起来时阴影能跟着变。
 *
 * item.sprite 可以覆盖图片路径；item.sprite === false 表示这件器材只用矢量。
 */
import React, { useEffect, useState } from 'react';
import { Image as KonvaImage, Group, Rect } from 'react-konva';
import { sizeOf, baseOf } from '../art.js';

/* 素材目录（相对页面根路径）；放一张 <type>.png 就能替换对应器材。 */
export var SPRITE_BASE = 'lab/assets/equipment/';

/* 载入一张图片；失败返回 null，让组件退回矢量绘制。 */
export function useSprite(src) {
  var [image, setImage] = useState(null);

  useEffect(
    function () {
      if (!src || typeof window === 'undefined') {
        setImage(null);
        return undefined;
      }

      var alive = true;
      var img = new window.Image();
      img.decoding = 'async';
      img.onload = function () {
        if (alive) setImage(img);
      };
      img.onerror = function () {
        if (alive) setImage(null);
      };
      img.src = src;

      return function () {
        alive = false;
        img.onload = null;
        img.onerror = null;
      };
    },
    [src]
  );

  return src ? image : null;
}

/*
 * 器材的接触阴影：一条压在器底上的椭圆，模糊半径跟着器材宽度走。
 * 单独一层、不接收指针事件，因此不会干扰拖拽命中。
 */
export function ContactShadow(props) {
  var type = props.type;
  var size = sizeOf(type);

  return (
    <Rect
      x={size.width * 0.14}
      y={baseOf(type) - 1.2}
      width={size.width * 0.72}
      height={2.4}
      cornerRadius={1.2}
      fill="rgba(15, 42, 54, 0.12)"
      shadowColor="rgba(15, 42, 54, 0.22)"
      shadowBlur={props.blur === undefined ? 5 : props.blur}
      shadowOffsetY={1.2}
      shadowOpacity={0.8}
      listening={false}
    />
  );
}

export default function EquipmentImage(props) {
  var item = props.item;
  var type = item.type || item.id;
  var size = sizeOf(type);
  var src = props.sprite === false ? null : props.sprite || SPRITE_BASE + type + '.png';
  var image = useSprite(src);

  return (
    <Group listening={props.listening === false ? false : true}>
      {props.shadow === false ? null : <ContactShadow type={type} />}
      {image ? (
        <KonvaImage
          image={image}
          width={size.width}
          height={size.height}
          shadowColor="rgba(15, 42, 54, 0.22)"
          shadowBlur={6}
          shadowOffsetY={2}
          shadowOpacity={0.75}
        />
      ) : (
        props.children || null
      )}
    </Group>
  );
}
