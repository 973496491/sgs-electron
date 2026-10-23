# rank_9 · v1

状态：accepted
来源：generated-native
生成ID：`ig_0d8faa272d9ae9e0016ad86decec9487d0ad0e2157daca98b3`
原图SHA：`2940c335220e3c6a5d0f39a5ff8975a6b505ddf3e46c759168dc2a3ac47b7795`
成品SHA：`aeb56316eb75da3616bc817261ad114896bc28ea9dac4018318869cf3b8ff18b`

## 离线验收

reviewed：已实际查看 rank_9.v1.png 小检查图：仅单个数字9，直立经典字形完整，圆形字腔开放，尾部及端部无裁切；香槟金实心面、细缎纹、克制浮雕与褐色边缘延续参考2。38x34及19x17在深浅背景均可辨认，无其他文字或装饰。外围与字腔随检查底色呈现，结合RGBA Alpha范围0..255及四角0确认真实透明；通过离线视觉检查，待父流程accept。

## 实际提示词

```text
[TAROT-UI:rank_9:v1]
Use case: stylized-concept. Output exactly ONE standalone functional game UI sprite as a PNG with genuinely transparent alpha background.
The one small reference image is a MATERIAL AND STYLE reference only; its dark preview matte must NOT appear in the output.
Transparent outside the contour and inside all holes. Clean antialiased alpha, no baked checkerboard, no white/gray/black background, no card fragment or rectangular panel.
Landscape canvas aspect 19:17. Leave generous clear padding, keep the complete subject inside the canvas. Legible when downscaled to 19x17 UI units.
Text (verbatim): "9". This exact rank is the ONLY visible content. Replace the reference numeral 2 with 9.
Match the approved numeral 2: upright classical serif, warm ivory/champagne-gold solid face, fine satin texture, restrained bevel, subtle brown edge. Similar stroke weight and serif proportions. No script, no italic, no blackletter or ornamental flourishes.
Full glyph approximately 82% of canvas height. Keep natural width; visual center around x=42% of canvas, baseline around y=88%; a little less padding above and left than below and right.
For rank 10, show two clear digits 1 followed by 0, naturally spaced as one rank, complete and proportionate, with neither compression nor clipping.
No outer ring, medallion, plaque, rays, stars, glow, cast shadow, leaves, text other than the requested rank, extra symbols, watermark, contact sheet or mockup.
The first bracketed tag is metadata only; never draw it.
```
