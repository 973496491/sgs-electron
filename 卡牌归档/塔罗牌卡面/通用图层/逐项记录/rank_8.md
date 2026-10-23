# rank_8 · v1

状态：accepted
来源：generated-native
生成ID：`ig_0ef7d35072cefd02016ad86d4e7efc87d0965db2eaaf883f85`
原图SHA：`62503b421a4f1102b5cad15591bb2d0a6a350c8af545fad743bafdd2d07903ff`
成品SHA：`93fd103953280a6a91a9ead289b822a22ff6e3a69aa470394933af228cd48698`

## 离线验收

reviewed：已实际查看保存后的小检查图：只有完整直立点数8，上下两环比例自然且未裁切；香槟金实心面、细缎纹与克制浅浮雕、棕色边缘延续参考2。外部及上下两处字腔在深浅底均显出对应背景，真实RGBA Alpha范围0..255且四角为0。38x34与19x17在深浅底均可辨认为8，无底板、额外符号或明显杂点。视觉检查通过，待父流程accept。

## 实际提示词

```text
[TAROT-UI:rank_8:v1]
Use case: stylized-concept. Output exactly ONE standalone functional game UI sprite as a PNG with genuinely transparent alpha background.
The one small reference image is a MATERIAL AND STYLE reference only; its dark preview matte must NOT appear in the output.
Transparent outside the contour and inside all holes. Clean antialiased alpha, no baked checkerboard, no white/gray/black background, no card fragment or rectangular panel.
Landscape canvas aspect 19:17. Leave generous clear padding, keep the complete subject inside the canvas. Legible when downscaled to 19x17 UI units.
Text (verbatim): "8". This exact rank is the ONLY visible content. Replace the reference numeral 2 with 8.
Match the approved numeral 2: upright classical serif, warm ivory/champagne-gold solid face, fine satin texture, restrained bevel, subtle brown edge. Similar stroke weight and serif proportions. No script, no italic, no blackletter or ornamental flourishes.
Full glyph approximately 82% of canvas height. Keep natural width; visual center around x=42% of canvas, baseline around y=88%; a little less padding above and left than below and right.
For rank 10, show two clear digits 1 followed by 0, naturally spaced as one rank, complete and proportionate, with neither compression nor clipping.
No outer ring, medallion, plaque, rays, stars, glow, cast shadow, leaves, text other than the requested rank, extra symbols, watermark, contact sheet or mockup.
The first bracketed tag is metadata only; never draw it.
```
