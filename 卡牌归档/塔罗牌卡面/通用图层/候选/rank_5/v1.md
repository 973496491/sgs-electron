# rank_5 · v1

状态：accepted
来源：generated-native
生成ID：`ig_082dcfcef9b1c067016ad86b863fc887d09ccbfd5416c3e83d`
原图SHA：`cf2014380620e24471a77140f5f642df983daad6b6dbddb04c9beb3909fa3376`
成品SHA：`cf722b330eb391759234cfd8ed9aaa998d30c84801c22da5ada101ec894e02d7`

## 离线验收

reviewed：已实际查看保存后的小检查图：仅有完整数字5，直立经典衬线轮廓和上横、下弧均清楚，无裁切或多余符号；香槟金实心表面、细斜向缎纹、轻浮雕及棕色细边与参考2一致。38x34及19x17在深底清晰，浅底对比较轻但数字仍可辨。原图和导出均RGBA真实Alpha，四角为0，深浅底无矩形底色或伪棋盘格。通过离线视觉检查，待父流程accept。

## 实际提示词

```text
[TAROT-UI:rank_5:v1]
Use case: stylized-concept. Output exactly ONE standalone functional game UI sprite as a PNG with genuinely transparent alpha background.
The one small reference image is a MATERIAL AND STYLE reference only; its dark preview matte must NOT appear in the output.
Transparent outside the contour and inside all holes. Clean antialiased alpha, no baked checkerboard, no white/gray/black background, no card fragment or rectangular panel.
Landscape canvas aspect 19:17. Leave generous clear padding, keep the complete subject inside the canvas. Legible when downscaled to 19x17 UI units.
Text (verbatim): "5". This exact rank is the ONLY visible content. Replace the reference numeral 2 with 5.
Match the approved numeral 2: upright classical serif, warm ivory/champagne-gold solid face, fine satin texture, restrained bevel, subtle brown edge. Similar stroke weight and serif proportions. No script, no italic, no blackletter or ornamental flourishes.
Full glyph approximately 82% of canvas height. Keep natural width; visual center around x=42% of canvas, baseline around y=88%; a little less padding above and left than below and right.
For rank 10, show two clear digits 1 followed by 0, naturally spaced as one rank, complete and proportionate, with neither compression nor clipping.
No outer ring, medallion, plaque, rays, stars, glow, cast shadow, leaves, text other than the requested rank, extra symbols, watermark, contact sheet or mockup.
The first bracketed tag is metadata only; never draw it.
```
