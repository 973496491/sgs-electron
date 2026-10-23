# rank_3 · v1

状态：accepted
来源：generated-native
生成ID：`ig_03479d0e0b4168a6016ad86a6891cc87d09d9929f10bfc4cea`
原图SHA：`645c6654898cf5bb571a510737ef60eb0d8cc377aeef91a35175c06a6b281bea`
成品SHA：`4a7fbe221afa24790acc6e02d631f75d35d7494fb38b0a8483a7a46af3ad775a`

## 离线验收

reviewed：已实际查看 rank_3.v1.png 小检查图：唯一数字3完整，双圆弧和端部清楚、无裁切或额外符号；直立经典衬线轮廓、香槟金缎面和克制浅浮雕与参考2一致。38x34与19x17在深浅底均可辨认，浅底由细棕边保持轮廓。原图及导出均为真实RGBA，Alpha范围0..255、四角为0；检查图未见背景块或伪透明。视觉检查通过，留父流程accept。

## 实际提示词

```text
[TAROT-UI:rank_3:v1]
Use case: stylized-concept. Output exactly ONE standalone functional game UI sprite as a PNG with genuinely transparent alpha background.
The one small reference image is a MATERIAL AND STYLE reference only; its dark preview matte must NOT appear in the output.
Transparent outside the contour and inside all holes. Clean antialiased alpha, no baked checkerboard, no white/gray/black background, no card fragment or rectangular panel.
Landscape canvas aspect 19:17. Leave generous clear padding, keep the complete subject inside the canvas. Legible when downscaled to 19x17 UI units.
Text (verbatim): "3". This exact rank is the ONLY visible content. Replace the reference numeral 2 with 3.
Match the approved numeral 2: upright classical serif, warm ivory/champagne-gold solid face, fine satin texture, restrained bevel, subtle brown edge. Similar stroke weight and serif proportions. No script, no italic, no blackletter or ornamental flourishes.
Full glyph approximately 82% of canvas height. Keep natural width; visual center around x=42% of canvas, baseline around y=88%; a little less padding above and left than below and right.
For rank 10, show two clear digits 1 followed by 0, naturally spaced as one rank, complete and proportionate, with neither compression nor clipping.
No outer ring, medallion, plaque, rays, stars, glow, cast shadow, leaves, text other than the requested rank, extra symbols, watermark, contact sheet or mockup.
The first bracketed tag is metadata only; never draw it.
```
