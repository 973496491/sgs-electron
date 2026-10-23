# suit_diamond · v3

状态：accepted
来源：generated-native
生成ID：`ig_02d5c802384f4e77016ad8669a9b7887d0a751c66f34149988`
原图SHA：`029d11be93fe27ad56f7da00e62ac1c7a908ed92061aa154903590566230130a`
成品SHA：`346a83698acc29318c709335796c5a33229f624edc2ffa69e61f5f4077819d08`

## 离线验收

reviewed：已实际查看深浅底检查图，原始图为四条直边的标准红宝石方块，单层细金边，无多余符号/背景/阴影。38x34与19x17仍清楚，改用Alpha>8可见边界后成品可见框为(10,4,28,30)，高度26px，与既有红桃量级一致，保留自然菱形比例；四角全透明，Alpha0..255。此v3只将v2同一原始PNG重新裁切/等比缩放/透明留边，原图SHA与生成ID未变，没有再生成或重绘轮廓。通过离线图层验收。

## 实际提示词

```text
[TAROT-UI:suit_diamond:v2]
Use case: stylized-concept. Output exactly ONE standalone functional game UI sprite as a PNG with genuinely transparent alpha background.
The one small reference image is a MATERIAL AND STYLE reference only; its dark preview matte must NOT appear in the output.
Transparent outside the contour and inside all holes. Clean antialiased alpha, no baked checkerboard, no white/gray/black background, no card fragment or rectangular panel.
Landscape canvas aspect 19:17. Leave generous clear padding, keep the complete subject inside the canvas. Legible when downscaled to 19x17 UI units.
Subject: a single symmetric DIAMOND suit, straight four-sided elongated rhombus, sharp upper/lower and side corners. Only this one standard playing-card suit silhouette.
Material: rich dark ruby-red enamel/crystal, a very fine champagne-gold beveled contour matching the reference heart. Keep reflections subtle and the body solid and readily recognized at tiny size.
Center naturally on the canvas, visible height around 76% of canvas; preserve the normal suit's natural width and silhouette, generous transparent border on every side.
No outer ring, medallion, plaque, rays, stars, glow, cast shadow, leaves, text other than the requested rank, extra symbols, watermark, contact sheet or mockup.
The first bracketed tag is metadata only; never draw it.
Targeted correction: Replace the concave curved outline with a regular four-sided rhombus: each of its four outer edges must be one perfectly STRAIGHT line between the top, right, bottom and left corners. No inward arcs, no outward arcs. Use one hairline champagne-gold contour, far thinner than the reference, at most 4 percent of the visible icon width. Keep dark ruby-red solid enamel and subtle faceting, no added flourishes, no second outline. Preserve genuine transparent alpha everywhere outside this single complete diamond.
```
