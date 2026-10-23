# 爪黄飞电 · 红桃 · v1

- 任务：`ZhuaHuangFeiDian_png__heart`
- 状态：`reviewed`
- 原名：爪黄飞电；代表ID：52；代表点数：K（不烘焙到底图）
- 徽记：无；攻击范围：非武器
- 原生生成ID：`ig_0a17ce68a49003f9016ad87b6bf26087d0a76af6c3dba31c07`
- 原图SHA-256：`6ba0988bda78b8540e700bacb7a9238b6d1de4c27aa0c7221ddabc8d2081d87d`
- 导出SHA-256：`cb7da003251796ae17b6ed0e08a34c1a11c5fe4f4bc68db7977417c6ef14194b`

仅离线素材制作；未修改游戏接入、主任务队列或守护状态。

## 离线视觉验收 2026-10-21T08:45:51.039349+00:00

结论：accepted-offline。已实际查看186×260交付PNG一次：标题为爪黄／飞电，2×2横读字序正确、四字完整清晰；上中及右上红桃正确；按任务无右下徽记；左上x8..46、y8..72仅连续自然暗红黑底纹与最外框，无点数、功能小花色、内金线悬饰或有边界补丁；完整外框，主体与装饰间距合理。内置image_gen使用prepare冻结提示词生成，验收通过。

## 完整提交提示词

```text
[TAROT-PROD:ZhuaHuangFeiDian_png__heart:v1]
Use case: precise-object-edit. Edit the single shown reference into ONE final card, full-bleed portrait 186:260, complete outer frame; no sheet or mockup.
Preserve the heart family: upper-center and upper-right suit ornaments, dark frosted ground, subdued foliage, thin gold frame and pale champagne-gold embossed brush typography. No bright glow.
Replace the title with exactly "爪黄飞电". Exactly 2 columns by 2 rows: top "爪黄", bottom "飞电"; read across each row, whole block centered. Keep clear, complete strokes and balanced spacing.
No lower-right badge. Remove any reference badge and its entire ring, seamlessly restoring the dark ground.
Reserve the upper-left (x,y,w,h)=(8, 8, 38, 64) on the 186x260 grid: continuous natural dark ground only, no rank, corner suit, inner gold lines, hanging ornaments or foliage. Keep only the outermost frame there; no visible patch/ellipse/panel.
Only the exact title and specified badge may contain text. No old title, fixed card rank, IDs, watermark or tracking tag. Remain readable at 93x130. Output this card only; no extra background or preview image.
```
