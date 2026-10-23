# rank_10 · v1

状态：accepted
来源：generated-native
生成ID：`ig_09ceebd2dbfcc92b016ad86e949cc487d0968b9ade6047e6be`
原图SHA：`bbd5e9d4a326f4d8f563df729a4aff374eaae99acd60676138971dc94ed4f1ba`
成品SHA：`913a085169bba6d23ef8ce77ca8ca45e2281bbfdf765607c0494fe5f3a85e7f7`

## 离线验收

reviewed：已实际查看 rank_10.v1.png 小检查图：仅有完整直立衬线数字10，1与0自然分隔，香槟金亮面、细棕边及轻浮雕与参考2一致，无压扁、裁切或额外装饰；深浅背景均能辨认，19×17小图仍明确读作10。0字腔真实透出两种底色，原图与导出为RGBA且四角Alpha均为0。等比导出可见边界(1,6,31,30)，因双字符自然宽度在30px宽约束下为24px高，未横向压缩；与已验收2的(6,2,26,30)共用底部y=30及中心x=16，基线一致。候选通过本次视觉检查，待父流程accept。

## 实际提示词

```text
[TAROT-UI:rank_10:v1]
Use case: stylized-concept. Output exactly ONE standalone functional game UI sprite as a PNG with genuinely transparent alpha background.
The one small reference image is a MATERIAL AND STYLE reference only; its dark preview matte must NOT appear in the output.
Transparent outside the contour and inside all holes. Clean antialiased alpha, no baked checkerboard, no white/gray/black background, no card fragment or rectangular panel.
Landscape canvas aspect 19:17. Leave generous clear padding, keep the complete subject inside the canvas. Legible when downscaled to 19x17 UI units.
Text (verbatim): "10". This exact rank is the ONLY visible content. Replace the reference numeral 2 with 10.
Match the approved numeral 2: upright classical serif, warm ivory/champagne-gold solid face, fine satin texture, restrained bevel, subtle brown edge. Similar stroke weight and serif proportions. No script, no italic, no blackletter or ornamental flourishes.
Full glyph approximately 82% of canvas height. Keep natural width; visual center around x=42% of canvas, baseline around y=88%; a little less padding above and left than below and right.
For rank 10, show two clear digits 1 followed by 0, naturally spaced as one rank, complete and proportionate, with neither compression nor clipping.
No outer ring, medallion, plaque, rays, stars, glow, cast shadow, leaves, text other than the requested rank, extra symbols, watermark, contact sheet or mockup.
The first bracketed tag is metadata only; never draw it.
```
