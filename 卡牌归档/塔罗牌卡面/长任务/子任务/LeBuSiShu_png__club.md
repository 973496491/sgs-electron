# 乐不思蜀 · 梅花 · v1

- 任务：`LeBuSiShu_png__club`
- 状态：`reviewed`
- 原名：乐不思蜀；代表ID：71；代表点数：6（不烘焙到底图）
- 徽记：无；攻击范围：非武器
- 原生生成ID：`ig_071399df6a9c378d016ad882bcede087d093b11ff8b81c0f7a`
- 原图SHA-256：`df691cb76e095f1f8ffb4cb468df6f4b6801e06bf1cbf90e0d6aca2260181572`
- 导出SHA-256：`830d48888d3a652ab52f8bbeaa7d49e7d716f6f8ffb3eaeafd630fdd4bc29570`

仅离线素材制作；未修改游戏接入、主任务队列或守护状态。

## 离线视觉验收 2026-10-21T09:16:50.559644+00:00

结论：accepted-offline。已实际查看唯一186×260交付PNG：简体乐不／思蜀按2列2行、逐行阅读正确，完整字形清晰且主体居中；上中及右上为梅花，右下无徽记与徽记圈；左上x8..46、y8..72为连续自然暗底，无点数、小功能花色、内侧金线悬饰或明显补丁；最外卡框完整，金字和上下装饰间距可读。单卡离线视觉检查通过，待父流程commit及高清导出。

## 完整提交提示词

```text
[TAROT-PROD:LeBuSiShu_png__club:v1]
Use case: precise-object-edit. Edit the single shown reference into ONE final card, full-bleed portrait 186:260, complete outer frame; no sheet or mockup.
Preserve the club family: upper-center and upper-right suit ornaments, dark frosted ground, subdued foliage, thin gold frame and pale champagne-gold embossed brush typography. No bright glow.
Replace the title with exactly "乐不思蜀". Exactly 2 columns by 2 rows: top "乐不", bottom "思蜀"; read across each row, whole block centered. Keep clear, complete strokes and balanced spacing.
No lower-right badge. Remove any reference badge and its entire ring, seamlessly restoring the dark ground.
Reserve the upper-left (x,y,w,h)=(8, 8, 38, 64) on the 186x260 grid: continuous natural dark ground only, no rank, corner suit, inner gold lines, hanging ornaments or foliage. Keep only the outermost frame there; no visible patch/ellipse/panel.
Only the exact title and specified badge may contain text. No old title, fixed card rank, IDs, watermark or tracking tag. Remain readable at 93x130. Output this card only; no extra background or preview image.
```
