# 闪 · 四花色柔光版

根据“花纹稍微淡化、降低装饰亮度，多张卡面堆叠时不抢眼”的反馈，使用 OpenAI Responses 内置图像工具逐张生成。本目录是完整四花色交付版本。

- `大图/`：四张原始生成 PNG，没有覆盖 v5 或上一轮样张。
- `186x260/`：186×260、不透明 RGBA PNG。
- `preview.html`：单张和叠牌预览，可调整露出宽度、数量、叠放方向，并与 v5 原版比较。
- `四花色对比.png`：游戏尺寸的四张独立卡面。
- `叠牌对比.png`：v5 与柔光版在相同尺寸、相同间距下的对照。
- `提示词/`：四次生成的完整提示词。
- `generation-record.json`：原生生成 ID、文件映射、尺寸、SHA-256、透明度检查和边缘亮度辅助比较。

红桃保留心形曲线和玫瑰，方块采用菱形切面与几何边饰，梅花使用三瓣枝叶和圆弧，黑桃保留原有尖拱与黑曜石花色造型。统一压低边框、枝叶、花朵和星光的视觉权重，让“闪”和主花色优先可见。

为控制请求体，每次使用压缩 JPEG 参考，并且每次只生成一张。大图保留工具原始结果；缩图与预览拼接使用本地 System.Drawing，不重新绘制卡面。边缘亮度数值仅辅助判断，已检查小尺寸叠放预览。

这是设计素材，未替换游戏资源，未合回图集，也没有生成 asar。游戏内四花色切换行为不在本次素材生成范围内。

## 点数位置单张预览（2026-10-21）

- 图片：[红桃2_点数预览.png](红桃2_点数预览.png)，本次仅生成这一张，不另做整套、小图、拼图或新预览页面。
- 信息来源：`卡牌拆分/军争卡牌/161张牌对应表.csv` 的牌ID 28，牌名“闪”、红桃、点数2；这是具体示例，不表示所有红桃闪均为2。
- 点数写法：A、2、3、4、5、6、7、8、9、10、J、Q、K。设计建议为左上竖排，上方点数、下方小花色，按两位数10预留宽度。
- 这是单张布局预览；客户端原生花色/点数仍是独立UI图层，本次未更改其位置或把此预览安装为共用底图。
- 工具：OpenAI Responses native image_generation；生成ID：`ig_0ed5014f9b9871fc016ad79e14cd0c87d0b1e65f277cd98776`。

完整提示词：

```text
Precise localized edit of the MOST RECENT single dark burgundy HEART card reference. Generate ONE preview of an authentic HEART 2 “闪” card (original local card table: card ID 28, name 闪, suit hearts, rank 2). Preserve the already approved soft ornamental design everywhere except the small TOP-LEFT index area: same garnet heart medallion at upper center, same exact centered Chinese brush character “闪”, same muted bronze rose vines and border, dark red frosted-glass background, subdued brightness, original proportions. Add the conventional readable rank-and-suit index in the TOP-LEFT, where it remains visible when cards overlap horizontally. An upright exact numeral “2” ABOVE a small classic heart “♥”, both aligned on one vertical centerline. Rework the EXISTING top-left tiny heart and its corner curl into this single functional index; do not leave a second heart above the numeral. Index occupies approximately x=5–17% of card width and y=4–22% of card height, clear of the outer rim. At 186x260 equivalent, the numeral is about 21–23px tall, the heart 12–14px tall, with 3–4px vertical gap; allow width for future two-digit “10”. Use a crisp sturdy elegant serif numeral, warm pale ivory/champagne solid fill with restrained shallow relief, high readability, no glowing outline. Small heart is clearly ruby red with a thin muted-gold edge. Clear interfering fine filigree from behind this small index, leaving a calm dark glass patch with no big plaque or bright box. Do NOT add any rank elsewhere; retain the upper-right small heart and upper-center large heart unchanged. Only new text is the numeral “2”; preserve the sole Chinese text “闪”. Do not render A–10/JQK as a list, do not invent rules or descriptions, no extra pips, no signature, no people, no scene or comparison sheet. Keep the other 90% of the approved artwork unchanged. One full-bleed opaque portrait card, 186:260 aspect ratio.
```
