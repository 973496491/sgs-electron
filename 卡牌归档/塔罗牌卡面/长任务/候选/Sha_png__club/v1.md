# 杀 · 梅花 · v1

- 任务：`Sha_png__club`
- 状态：`reviewed`
- 原名：杀；代表ID：54；代表点数：2（不烘焙到底图）
- 徽记：无；攻击范围：非武器
- 原生生成ID：`ig_0d1bbd88130a17c3016ad87e20f6e887d0959a82ab6ff64608`
- 原图SHA-256：`d86bfb56ed974f5751ecfa96a8bc6b19fd4af9ab795d9a462b3bda6b211977f1`
- 导出SHA-256：`ba8e406c3ccef3566a9ef9952b1356f30f23498e5d033538bb1554d4c9796797`

仅离线素材制作；未修改游戏接入、主任务队列或守护状态。

## 离线视觉验收 2026-10-21T08:57:13.889235+00:00

结论：accepted-offline。已实际查看唯一186×260交付PNG：标题为单字简体杀，上部交叉撇捺、下部木，无右侧殳；笔画完整且居中清晰。上中及右上梅花纹样保留，无右下徽记、旧标题、点数或多余文字。左上x8..46、y8..72为连续自然暗色底纹，未见功能花色、内侧悬饰或有边界补丁；外框四边完整，枝叶与标题间距合理。视觉检查通过。

## 完整提交提示词

```text
[TAROT-PROD:Sha_png__club:v1]
Use case: precise-object-edit. Edit the single shown reference into ONE final card, full-bleed portrait 186:260, complete outer frame; no sheet or mockup.
Preserve the club family: upper-center and upper-right suit ornaments, dark frosted ground, subdued foliage, thin gold frame and pale champagne-gold embossed brush typography. No bright glow.
Replace the title with exactly "杀". One large character, optically centered. Use six-stroke simplified 杀 (U+6740), never 殺; no right-side 殳. Keep clear, complete strokes and balanced spacing.
No lower-right badge. Remove any reference badge and its entire ring, seamlessly restoring the dark ground.
Reserve the upper-left (x,y,w,h)=(8, 8, 38, 64) on the 186x260 grid: continuous natural dark ground only, no rank, corner suit, inner gold lines, hanging ornaments or foliage. Keep only the outermost frame there; no visible patch/ellipse/panel.
Only the exact title and specified badge may contain text. No old title, fixed card rank, IDs, watermark or tracking tag. Remain readable at 93x130. Output this card only; no extra background or preview image.
```
