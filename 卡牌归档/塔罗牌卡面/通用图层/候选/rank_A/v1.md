# rank_A · v1

状态：accepted
来源：generated-native
生成ID：`ig_0dea6d6047789cd6016ad8698482ec87d0b746354cc902e5d6`
原图SHA：`503097ebd9e3a24f66963eda523aba23cf9e2fb9a3da9b51f1dc2de2fb1ee804`
成品SHA：`1a670f7df3b9d761badc3e434b759e6810536e58f7766fc9dfa357fbf9e37ddb`

## 离线验收

reviewed：已实际查看小检查图：仅一个完整直立衬线A，字顶、横杠和两侧衬线齐全；香槟金缎面、轻浮雕与细棕金边延续参考2。深浅背景均能透过三角字腔及外部透明区，无矩形底；38×34和19×17均可辨为A，浅底仍有细边界。原生与导出RGBA的Alpha范围0..255、四角均为0。视觉检查通过，等待父流程验收。

## 实际提示词

```text
[TAROT-UI:rank_A:v1]
Use case: stylized-concept. Output exactly ONE standalone functional game UI sprite as a PNG with genuinely transparent alpha background.
The one small reference image is a MATERIAL AND STYLE reference only; its dark preview matte must NOT appear in the output.
Transparent outside the contour and inside all holes. Clean antialiased alpha, no baked checkerboard, no white/gray/black background, no card fragment or rectangular panel.
Landscape canvas aspect 19:17. Leave generous clear padding, keep the complete subject inside the canvas. Legible when downscaled to 19x17 UI units.
Text (verbatim): "A". This exact rank is the ONLY visible content. Replace the reference numeral 2 with A.
Match the approved numeral 2: upright classical serif, warm ivory/champagne-gold solid face, fine satin texture, restrained bevel, subtle brown edge. Similar stroke weight and serif proportions. No script, no italic, no blackletter or ornamental flourishes.
Full glyph approximately 82% of canvas height. Keep natural width; visual center around x=42% of canvas, baseline around y=88%; a little less padding above and left than below and right.
For rank 10, show two clear digits 1 followed by 0, naturally spaced as one rank, complete and proportionate, with neither compression nor clipping.
No outer ring, medallion, plaque, rays, stars, glow, cast shadow, leaves, text other than the requested rank, extra symbols, watermark, contact sheet or mockup.
The first bracketed tag is metadata only; never draw it.
```
