# suit_spade · v1

状态：accepted
来源：generated-native
生成ID：`ig_08e5a5ac43e90b46016ad86856c3b487d0bb968c56255bc51e`
原图SHA：`e3f52f576f3caf7d761ffe0e9d13e6575620bc9125be0ff7d0e8b0f442b36b10`
成品SHA：`8abc2f092a5c6395adb8220b8842825aef25efe65c10100cb1e6f2163d0051e3`

## 离线验收

reviewed：已实际查看760×390小检查图：单个正常黑桃，上尖、双圆下瓣与居中外展短柄完整；黑曜石黑色主体配金边，无额外符号、背景板或投影。原图及38×34导出均为真实RGBA透明，Alpha范围0到255且四角为0；深浅背景无矩形底色。38×34及19×17下轮廓、顶尖和短柄仍可区分，深底依靠金边、浅底依靠黑色主体可读。视觉通过，等待父流程accept。

## 实际提示词

```text
[TAROT-UI:suit_spade:v1]
Use case: stylized-concept. Output exactly ONE standalone functional game UI sprite as a PNG with genuinely transparent alpha background.
The one small reference image is a MATERIAL AND STYLE reference only; its dark preview matte must NOT appear in the output.
Transparent outside the contour and inside all holes. Clean antialiased alpha, no baked checkerboard, no white/gray/black background, no card fragment or rectangular panel.
Landscape canvas aspect 19:17. Leave generous clear padding, keep the complete subject inside the canvas. Legible when downscaled to 19x17 UI units.
Subject: a single SPade suit, sharp upward tip, two rounded lower lobes and a short centered flared stem. Only this one standard playing-card suit silhouette.
Material: deep black obsidian / black enamel with restrained cool gray reflections, a very fine champagne-gold beveled contour matching the reference heart. Keep reflections subtle and the body solid and readily recognized at tiny size.
Center naturally on the canvas, visible height around 76% of canvas; preserve the normal suit's natural width and silhouette, generous transparent border on every side.
No outer ring, medallion, plaque, rays, stars, glow, cast shadow, leaves, text other than the requested rank, extra symbols, watermark, contact sheet or mockup.
The first bracketed tag is metadata only; never draw it.
```
