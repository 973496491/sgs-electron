# 红桃 2 · 按原生 UI 分层效果

基于当前 `红桃2_点数预览.png` 的样式，用 OpenAI Responses 内置图像工具逐张制作底图、点数2和左上红桃。本目录只包含这三个素材和一张分层预览，没有制作其余点数、花色或游戏接入。

## 文件与坐标

| 文件 | 文件像素 | 93×130 UI 中的尺寸 | UI 左上坐标 | 186×260 合成坐标 |
|---|---|---|---|---|
| `Shan_heart_base.png` | 186×260 | 93×130 | (0,0) | (0,0) |
| `red_2.png` | 38×34 | 19×17 | (4,4) | (8,8) |
| `heart.png` | 38×34 | 19×17 | (4,19) | (8,38) |

- `分层预览.png` 展示三个图层、按上述坐标重组的结果，以及实际93×130 UI尺寸示意。
- 点数与花色文件拥有真实Alpha透明通道；棋盘格只存在于预览展示背景中，没有烘焙到透明素材里。符号包含透明留边，所以19×17是图层矩形，不是可见笔画的紧贴边界。
- 底图去除左上的功能点数与小红桃；上方大红桃、右上红桃仍属于主题装饰。
- `red_2` 沿用红桃/方块点数的逻辑命名，图案材质按当前预览保留浅金色。
- 点数2来自原始牌表中的红桃闪示例（牌ID28）；本次没有扩展到整套A～K。

## UI依据与检查

依据 `doc/sanguosha.md` 的“点数 / 花色赋值与自定义图案可行性”，并复核已有2026-10-08客户端快照：`bF.MAX_SIZE` 与 `NORMAL_SIZE` 均为93×130；普通大尺寸分支的点数、花色各19×17，点数(4,4)，花色(4,19)。这两个矩形在高度上相交2个UI单位，透明留边使可见图案保持间距。导出按2倍像素建立，不改变原生UI布局。

底图为不透明RGBA；两个符号的Alpha范围均为0～255，四角透明。合成预览使用交付的三层素材按整数坐标叠加。已检查分层和实际尺寸效果，未修改游戏、userscript、图集、发布映射或asar，未做游戏内接入验证。

原参考是一张合成PNG，原本没有独立图层；本次为参照样式的图像编辑与透明提取，不声称能从原图恢复被遮挡处的原始像素。高分辨率生成中间稿保留在工程 `tmp/imagegen/heart2-split/`，本目录仅交付所需素材。

## 生成记录与完整提示词

### 底图

生成ID：`ig_00f1a263b1e86c7b016ad7a04ca2f887d098a5d4106b0a3812`。原始尺寸：1061×1482，模式：RGB。

```text
Precise localized edit of the MOST RECENT burgundy HEART 2 card reference, for splitting it into actual UI layers. Output ONE BACKGROUND CARD LAYER only: opaque full-bleed portrait, same 186:260 aspect. Preserve the current approved card: exact central gold brush character “闪”, upper-center large ruby heart, upper-right little heart decoration, gold/bronze frame, dark burgundy frosted celestial field and lower roses. Remove ONLY the top-left numeral “2” and the little red heart directly beneath it. Also gently clear the adjoining top-left inner filigree/leaf fragments where the original game UI will overlay the separate symbols. Reserve a quiet dark burgundy-black area spanning x=4.3% to 24.8% of card width and y=3.1% to 27.8% of card height (equivalent to x=8..46,y=8..72 on a 186x260 image). This is a seamless continuation of the dark card ground, NOT a visible rectangular panel, no outline, no box, no added decoration or bright stars in the reserved area. Keep the slim outer perimeter intact; leave all art outside this small top-left reserved area as unchanged as possible, including existing restrained lighting and texture. There must be no rank and no functional corner heart baked into the reserved upper-left region. Keep the decorative upper-center heart and upper-right heart. Only text remaining is “闪”. Do not generate the extracted glyphs here. One clean background layer only, not an exploded view, no grid, no labels or surrounding scene.
```

### 点数2

生成ID：`ig_00c134af2c907e53016ad7a10c0c3087d0b000675f28673972`。原始尺寸：1327×1186，模式：RGBA。

```text
Use case: background-extraction. The MOST RECENT close-up image is the EDIT TARGET: the exact champagne-gold serif numeral “2” from the approved card. Extract only this same numeral as ONE standalone UI sprite on a genuinely TRANSPARENT background with an alpha channel. Preserve its precise elegant serif shape, warm ivory-gold solid face, fine satin texture, restrained bevel, existing highlights and subtle brown edge; do not redesign the digit or turn it into calligraphy. Remove ALL dark burgundy background, all dust/star pixels, and every rectangular card fragment. Transparent outside the numeral AND inside its open curve. No baked checkerboard, no white or black background, no shadow cast onto a plane, no border, no decorative objects. Sprite canvas landscape aspect 19:17; center the numeral with balanced transparent margins, keeping the glyph approximately 80% of canvas height and 48–52% of its width, with ample left/right empty space for a consistent rank atlas. The only visible object is the upright exact numeral “2”. Clean antialiased alpha edges, crisp and legible when this sprite is displayed at 19x17 UI units. Output ONE transparent PNG sprite, not a sheet, not a card or mockup.
```

### 红桃

生成ID：`ig_0e03e1afb090f834016ad7a156721487d0a0ab6170c5f610d8`。原始尺寸：1326×1187，模式：RGBA。

```text
Use case: background-extraction. The MOST RECENT close-up of a small ruby HEART is the EDIT TARGET. Extract exactly this heart suit emblem as ONE standalone UI sprite on a genuinely TRANSPARENT PNG background with an alpha channel. Preserve the approved heart silhouette, two rounded upper lobes and pointed bottom, rich dark ruby-red enamel/crystal body, fine champagne-gold beveled outline, and the same restrained reflections. This is the little functional corner heart, not the large central medallion. Remove ALL burgundy card background and tiny stray star/glint pixels outside the emblem. Keep only the heart and its narrow gold edge; no outer ring, rays, flourish, plaque, glow, cast shadow or text. Transparent outside the contour with clean antialiased edges; do not bake in checkerboard, black, gray or white. Use a landscape sprite canvas aspect 19:17. Center the heart; approximately 76–80% of canvas height, preserving its natural shape and generous clear padding on every side. The sprite must remain recognizable at 19x17 UI units. Output ONE transparent heart sprite only, not a sheet, not a card, no mockup.
```

## 文件校验

```json
[
  {
    "file": "Shan_heart_base.png",
    "size": [
      186,
      260
    ],
    "mode": "RGBA",
    "alpha": [
      255,
      255
    ],
    "sha256": "75612a0ec5c2c28becc8f8aea48427d33f8a986dce85c9f565a1a5a24593e45a"
  },
  {
    "file": "red_2.png",
    "size": [
      38,
      34
    ],
    "mode": "RGBA",
    "alpha": [
      0,
      255
    ],
    "sha256": "1c474cd39faa39f08646ed04f86c4db7543aa03fda57416abccbe2335f06dbcf"
  },
  {
    "file": "heart.png",
    "size": [
      38,
      34
    ],
    "mode": "RGBA",
    "alpha": [
      0,
      255
    ],
    "sha256": "f97a96f4552b679f5eea134794cfce9ff71fe9cfd0efb8a0b8a0d7905da3fcef"
  },
  {
    "file": "分层预览.png",
    "size": [
      1020,
      680
    ],
    "mode": "RGB",
    "alpha": null,
    "sha256": "6ae2f277b508c59af44964b890001b3a01258eb25da7bc6a13109dd757dc4c8e"
  }
]
```

## 点数位置微调 v2（2026-10-21）

当前推荐点数层：[red_2_v2.png](red_2_v2.png)；效果：[分层预览_v2.png](分层预览_v2.png)。保留原版方便对照，底图和花色文件逐字节未变。

38×34画布、点数层合成坐标(8,8)、花色层合成坐标(8,38)均不变。可见数字在自身层内左移3 px、上移2 px，对应UI左移1.5、上移1单位；数字不再与花色中心完全对齐。按Alpha>8测得可见边界从(9,4,29,32)变为(6,2,26,30)，可见范围仍为20×28，无裁断。

使用内置图像工具完成单独点数层编辑，再按原可见范围尺寸与目标偏移校准透明留边；没有重新生成底图或花色，没有进行游戏接入。

生成ID：`ig_051fea5d232504cf016ad7a385f62c87d0a9a01c99583b917b`。完整提示词：

```text
Precise sprite-layout edit of the MOST RECENT transparent champagne-gold numeral 2. Keep the entire transparent canvas unchanged in its 19:17 landscape aspect ratio. Move only the existing numeral LEFT by 7.895% of canvas width and UP by 5.882% of canvas height (equivalent to left 3 pixels and up 2 pixels on a 38x34 sprite). Preserve the numeral's EXACT size, glyph shape, material, bevel, color, highlights, opacity and antialiased edges. This is a small translation inside the existing layer, NOT a redraw, resize, recentering or crop-to-content. The moved glyph should have slightly less empty space above and on the left, more empty space to its right and below. Keep every part of the numeral inside the canvas. Do not center it again. Output ONLY this one updated transparent PNG sprite, actual alpha transparency, no visible background, no checkerboard, no new decoration, no card, no additional symbols.
```

参数记录：

```json
{
  "canvas": [
    38,
    34
  ],
  "visibleBoundsThreshold": "alpha > 8",
  "previousBounds": [
    9,
    4,
    29,
    32
  ],
  "updatedBounds": [
    6,
    2,
    26,
    30
  ],
  "offsetInsideLayerPx": [
    -3,
    -2
  ],
  "offsetUiUnits": [
    -1.5,
    -1
  ],
  "layerPlacementPx": [
    8,
    8
  ],
  "layerPlacementUi": [
    4,
    4
  ],
  "postprocess": "Normalize the native edit to the previous visible glyph size and requested internal offset; preserve RGBA alpha."
}
```
