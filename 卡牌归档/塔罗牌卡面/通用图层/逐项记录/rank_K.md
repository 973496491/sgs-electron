# rank_K · v1

状态：accepted
来源：generated-native
生成ID：`ig_0d48eff3cb7f9d4c016ad87098e51c87d09cb46d20463bf794`
原图SHA：`28c0fc7b50856c46d0e58eb9e156705ed5297d52a9bb63097619ea8f0e9ab9fd`
成品SHA：`318c9e5fba71a6fc87c51aa972f63c5696b31ecec64bd08b866c4eed74f34041`

## 离线验收

reviewed：已实际查看760×390小检查图。唯一内容为大写K；主竖、上右斜笔、下右斜笔及衬线完整，字形直立无花饰，38×34和19×17均能清楚辨认。暖香槟金实心字面、细缎纹与轻浮雕棕色边沿延续参考2风格；深浅底上轮廓清楚，无矩形底板或烘焙棋盘格。原生和导出均有真实Alpha 0..255且四角透明，透明裁切和等比缩放后字形未截断。离线视觉通过，待父流程accept。

## 实际提示词

```text
[TAROT-UI:rank_K:v1]
Use case: stylized-concept. Output exactly ONE standalone functional game UI sprite as a PNG with genuinely transparent alpha background.
The one small reference image is a MATERIAL AND STYLE reference only; its dark preview matte must NOT appear in the output.
Transparent outside the contour and inside all holes. Clean antialiased alpha, no baked checkerboard, no white/gray/black background, no card fragment or rectangular panel.
Landscape canvas aspect 19:17. Leave generous clear padding, keep the complete subject inside the canvas. Legible when downscaled to 19x17 UI units.
Text (verbatim): "K". This exact rank is the ONLY visible content. Replace the reference numeral 2 with K.
Match the approved numeral 2: upright classical serif, warm ivory/champagne-gold solid face, fine satin texture, restrained bevel, subtle brown edge. Similar stroke weight and serif proportions. No script, no italic, no blackletter or ornamental flourishes.
Full glyph approximately 82% of canvas height. Keep natural width; visual center around x=42% of canvas, baseline around y=88%; a little less padding above and left than below and right.
For rank 10, show two clear digits 1 followed by 0, naturally spaced as one rank, complete and proportionate, with neither compression nor clipping.
No outer ring, medallion, plaque, rays, stars, glow, cast shadow, leaves, text other than the requested rank, extra symbols, watermark, contact sheet or mockup.
The first bracketed tag is metadata only; never draw it.
```
