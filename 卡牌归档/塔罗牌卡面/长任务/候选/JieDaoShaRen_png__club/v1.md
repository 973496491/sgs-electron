# 借刀 · 梅花 · v1

- 任务：`JieDaoShaRen_png__club`
- 状态：`reviewed`
- 原名：借刀杀人；代表ID：77；代表点数：Q（不烘焙到底图）
- 徽记：无；攻击范围：非武器
- 原生生成ID：`ig_07e36f7cedee0fd8016ad8842cad6487d095e7ab23d7e9ba7b`
- 原图SHA-256：`fca8f78dd6d147aa22f6863936df981d8d5c89f5b76ae56c3c33300c79ab0a27`
- 导出SHA-256：`d01912e871479d7ae24e85c1b31e282366cc8ae7c89b6514589c77be9d999266`

仅离线素材制作；未修改游戏接入、主任务队列或守护状态。

## 离线视觉验收 2026-10-21T09:22:56.697313+00:00

结论：accepted-offline。已实际查看186×260交付PNG一次：标题仅借刀两字，横排左至右，字形清晰完整，无杀人；上中及右上梅花正确，无右下徽记，左上留位仅连续自然暗底与低对比纹理，无点数、功能花色、内饰金线或边界补丁；外框完整，字组与上下装饰留白合理。视觉检查通过。

## 完整提交提示词

```text
[TAROT-PROD:JieDaoShaRen_png__club:v1]
Use case: precise-object-edit. Edit the single shown reference into ONE final card, full-bleed portrait 186:260, complete outer frame; no sheet or mockup.
Preserve the club family: upper-center and upper-right suit ornaments, dark frosted ground, subdued foliage, thin gold frame and pale champagne-gold embossed brush typography. No bright glow.
Replace the title with exactly "借刀". All 2 characters in one horizontal left-to-right line; center the group without stretching glyphs. Keep clear, complete strokes and balanced spacing.
No lower-right badge. Remove any reference badge and its entire ring, seamlessly restoring the dark ground.
Reserve the upper-left (x,y,w,h)=(8, 8, 38, 64) on the 186x260 grid: continuous natural dark ground only, no rank, corner suit, inner gold lines, hanging ornaments or foliage. Keep only the outermost frame there; no visible patch/ellipse/panel.
Only the exact title and specified badge may contain text. No old title, fixed card rank, IDs, watermark or tracking tag. Remain readable at 93x130. Output this card only; no extra background or preview image.
```
