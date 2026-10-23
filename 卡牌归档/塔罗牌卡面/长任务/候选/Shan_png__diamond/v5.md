# 闪 · 方块 · v5

- 任务：`Shan_png__diamond`
- 状态：`reviewed`
- 原名：闪；代表ID：2；代表点数：2（不烘焙到底图）
- 徽记：无；攻击范围：非武器
- 原生生成ID：`ig_061bc5c0f5b0d7b3016ad84b61657c87d09b3a03ea6955b7a7`
- 原图SHA-256：`a8506c7b5e9b2e473e4a7f9e3fb6a18a0be3f658a76afd3c25db6aff59bcd42f`
- 导出SHA-256：`296aef3ae991dc3fb8644846e0435119bcd2504e92f322f62f52aae2fa25a406`

仅离线素材制作；未修改游戏接入、主任务队列或守护状态。

## 离线视觉验收 2026-10-21T05:26:17.264789+00:00

结论：accepted-offline。主流程接手验收：已查看465x650检查图、93x130实际UI缩图，并从1061x1483原始PNG按186x260坐标裁取左上x8..46/y8..72逐像素区域。中央单字闪完整居中，上中大方块与右上装饰方块正确；无固定点数、左上功能花色或右下徽记。原先侵入的左侧菱形悬饰、圆点、竖线和叶尖整组已移除，预留区为连续暗底，原像素裁切中未见内侧装饰或补丁边界。四边细框完整，底部枝叶与主字分隔；暗红背景低于金色主字，93x130仍能识别。PNG导出186x260 RGBA，允许原图轻微比例舍入。通过离线素材验收，未接入游戏。v1-v4拒绝候选保留。

## 完整提交提示词

```text
[TAROT-PROD:Shan_png__diamond:v5]
Use case: precise-object-edit. Edit only the displayed reference card.
Remove the ENTIRE vertical ornamental cluster on the LEFT side above the title midpoint: the red/gold diamond at about 9% width and 33% height, its gold spear-shaped frame, its thin vertical pole starting at 26% height, little hanging diamonds/dots and all strands beneath it, up to 45% of card height. Replace this whole cluster with continuous dark charcoal ground, seamlessly matching the adjacent background. The upper-left interior must be empty: in 186x260 coordinates, x8..46 and y8..72 contain NO inner ornaments. Keep only the very outer gold card frame on this upper-left side.
The large upper-center diamond, upper-right ornament, lower foliage, central Chinese character 闪, and all four outside frame edges stay unchanged. No number, no lower-right badge. Keep full portrait card 186:260. Do not draw the bracketed tracking tag.
```
