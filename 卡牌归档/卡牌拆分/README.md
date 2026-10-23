# 原始卡牌拆分

打开 `preview.html` 可以按牌名或纹理名查找并预览；每张图片在 `cards/` 文件夹。

军争专用副本在 [军争卡牌](军争卡牌/README.md)：161个牌ID对应44张独立底图，另附完整对应表。该子目录的编辑不会自动同步；处理完复制同名PNG回本目录的 `cards/` 再合并。

直接编辑 `cards/` 中的 PNG，保留原文件名、像素尺寸和透明通道。这里导出的是图集中的原始像素，没有按 UI 的 scale=2 缩小。花色、点数通常由游戏另外绘制。

编辑后双击 `merge.cmd`。每次会在 `merged/时间戳/` 新建 `cards.png`、原样保留的 `cards.atlas` 和 `merge-report.json`，不覆盖原始素材或先前合并结果。生成的图集没有自动安装到游戏。

- `manifest.json`：每张图片的纹理键、缓存路径、原图矩形、sourceSize、spriteSourceSize、scale、像素哈希和可查的牌名/ID。
- `card-index.csv`：可用 Excel 查看坐标和名称。名称来自 2026-10-08 配置快照，未知名称保留原纹理键。
- `source/cards.png`、`source/cards.atlas`：用于合回的原图及原始图集配置，不要编辑；图集外的空隙和其他像素由原图保留。
- `source/downloads.json`：官方资源来源、下载时间、字节数、SHA-256，以及与用户提供 PNG 的哈希核对。
- `roundtrip-verification.json`：未编辑时拆分再合并的逐字节 RGBA 比对结果。

这是对当前 `cards.png` 整张图集的拆分，包括图集内的特殊牌、占位图和装饰层；不是全部游戏图集的归档。没有读取运行中游戏的 `baseCardTexMap`，使用的是该缓存对应的官方 atlas 纹理名和坐标。

工具会检查所有 PNG 是否齐全及尺寸是否匹配，不会自动缩放图片。当前支持单页、无旋转图集；保留 atlas 所有帧属性和既有间隔，不重新排版。文件夹可以单独保存；移动到另一台电脑时安装 Python 和依赖：

```text
python -m pip install Pillow==13.0.0
python atlas_tool.py merge --workspace .
```

本图集有 111 个纹理名、109 个独立区域。`ShuiYanQiJun2_png.png / ShuiYanQiJun_png.png` 和 `TengJia2_png.png / TengJia_png.png` 分别共享坐标。每组只修改一份即可；合并后同组两个纹理名都会显示修改后的内容。如果同组两份改成了不同内容，工具会报告冲突，不生成结果。要让共享纹理显示不同图片，需要另做图集重排和坐标调整，本工具保持原坐标。

开发源码位于工程 `tools/card_atlas.py`，本目录的 `atlas_tool.py` 是交付副本。

## 统一归档位置

本目录现位于`卡牌归档/卡牌拆分/`，原始输入图集为[../cards.png](../cards.png)。`merge.cmd`优先查找本目录上级或上两级的`.venv-card-atlas`，否则使用PATH中的Python；工作目录由脚本自身位置确定。随目录已有`atlas_tool.py`和`requirements.txt`，可单独归档或复制到其他电脑。

历史来源/验证JSON中的旧绝对路径保留为当时记录；实际合并使用`manifest.json`中的相对路径。
