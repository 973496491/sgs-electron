from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OLD = ROOT / '卡牌毛玻璃'
SOFT = OLD / '闪_v6_四花色/柔光版'
LAYERS = SOFT / '红桃2_分层'
TEMP = ROOT / 'tmp/imagegen'
OUT = ROOT / '塔罗牌卡面'
SOURCE_ROOTS = [OLD, TEMP/'shan-v6', TEMP/'heart2-split']
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'}
TEXT_EXTENSIONS = {'.md', '.txt', '.json', '.html', '.py', '.ps1', '.js'}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if OUT.exists():
    raise SystemExit('Destination already exists; refusing to merge or overwrite it.')
inventory = []
for source_root in SOURCE_ROOTS:
    assert source_root.is_dir(), source_root
    for file in sorted(source_root.rglob('*')):
        if file.is_file():
            if file.suffix.lower() not in IMAGE_EXTENSIONS | TEXT_EXTENSIONS:
                raise SystemExit(f'Unclassified source file: {file}')
            inventory.append({'path': file.relative_to(ROOT).as_posix(), 'bytes': file.stat().st_size, 'sha256': sha(file)})

OUT.mkdir()
copied = []
def copy(source, destination, role):
    destination = OUT / destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    assert sha(source) == sha(destination)
    copied.append({'source': source.relative_to(ROOT).as_posix(),
                   'target': destination.relative_to(ROOT).as_posix(), 'sha256': sha(destination), 'role': role})
    return destination

def write(name, content):
    target = OUT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')

suits = [('heart','红桃'),('diamond','方块'),('spade','黑桃'),('club','梅花')]
for suit, label in suits:
    copy(SOFT/f'大图/{label}.png', f'四花色样板/大图/{label}.png', 'final-suit-large')
    copy(SOFT/f'186x260/Shan_{suit}.png', f'四花色样板/186x260/Shan_{suit}.png', 'final-suit-186x260')
    copy(SOFT/f'提示词/{label}.txt', f'提示词/四花色/{label}.txt', 'final-suit-prompt')
copy(SOFT/'四花色对比.png', '四花色样板/四花色对比.png', 'final-suit-overview')
for original, destination in [('Shan_heart_base.png','Shan_heart_base.png'), ('red_2_v2.png','red_2.png'), ('heart.png','heart.png'), ('分层预览_v2.png','分层预览.png')]:
    copy(LAYERS/original, f'红桃2分层/{destination}', 'final-layer-or-preview')
copy(OLD/'闪_v1/原始闪.png', '参考/原始闪.png', 'original-reference-not-generated')
copy(OLD/'闪_v3/1.png', '参考/用户风格参考.png', 'user-reference-not-generated')

# Keep every original text record, including old wording/prompts. Old runnable
# preview/helper files become plain-text archives instead of stale entry points.
for item in inventory:
    source = ROOT/item['path']
    if source.suffix.lower() not in TEXT_EXTENSIONS:
        continue
    relative = Path(item['path'])
    if source.suffix.lower() in {'.html','.py','.ps1','.js'}:
        relative = relative.with_name(relative.name + '.txt')
    copy(source, Path('文档/历史记录')/relative, 'historical-text-snapshot')

layer_generations = []
for stem, filename in [('base','01_底图.txt'),('rank','02_点数2提取.txt'),('suit','03_红桃提取.txt'),('rank-shifted','04_点数位置微调.txt')]:
    record = json.loads((TEMP/f'heart2-split/{stem}-record.json').read_text(encoding='utf-8-sig'))
    write(f'提示词/分层/{filename}', record['prompt'] + '\n')
    layer_generations.append({'stage': stem, 'generationId': record['id'], 'generatedAt': record['timestamp'],
                              'originalGenerationSize': record['size'], 'promptFile': f'../提示词/分层/{filename}'})
rank_preview_readme = (SOFT/'README.md').read_text(encoding='utf-8-sig')
flat_prompt = re.findall(r'```text\s*\n(.*?)\n```', rank_preview_readme, flags=re.S)[0]
write('提示词/历史_红桃2整图布局.txt', flat_prompt + '\n')

record = json.loads((SOFT/'generation-record.json').read_text(encoding='utf-8-sig'))
for variant in record['variants']:
    variant['promptFile'] = f"../提示词/四花色/{variant['label']}.txt"
record['previewFiles'] = ['../preview.html', '四花色对比.png']
record['outputStatus'] = 'Retained final soft four-suit designs; migrated into 塔罗牌卡面; no game integration'
record['historicalComparisonNote'] = 'v5 edge statistics describe historical measurements; old comparison images were removed during cleanup.'
write('四花色样板/generation-record.json', json.dumps(record, ensure_ascii=False, indent=2)+'\n')

layer_record = {'canvasPx':[186,260], 'uiCanvas':[93,130], 'assetPixelScale':2,
 'layers':[
   {'role':'base','file':'Shan_heart_base.png','pixelSize':[186,260],'positionPx':[0,0],'uiSize':[93,130],'uiPosition':[0,0]},
   {'role':'rank','file':'red_2.png','pixelSize':[38,34],'positionPx':[8,8],'uiSize':[19,17],'uiPosition':[4,4],
    'visibleContentOffsetPx':[-3,-2],'visibleContentOffsetUi':[-1.5,-1], 'visibleBoundsAlphaAbove8':[6,2,26,30], 'previousName':'red_2_v2.png'},
   {'role':'suit','file':'heart.png','pixelSize':[38,34],'positionPx':[8,38],'uiSize':[19,17],'uiPosition':[4,19]}],
 'previewFile':'分层预览.png', 'generations':layer_generations,
 'sourceCard':{'id':28,'name':'闪','suit':'heart','rank':'2'},
 'scope':'Design assets only. Current rank is the accepted up-left adjustment. No game integration.'}
for layer in layer_record['layers']:
    path = OUT/'红桃2分层'/layer['file']
    with Image.open(path) as image:
        layer['alphaRange'] = image.getchannel('A').getextrema()
        assert list(image.size) == layer['pixelSize']
    layer['sha256'] = sha(path)
write('红桃2分层/layout.json', json.dumps(layer_record,ensure_ascii=False,indent=2)+'\n')

write('README.md', '''# 塔罗牌卡面

当前保留“闪”的最终柔光四花色样板，以及红桃2的最新三层拆分效果。点数采用已确认的左移3 px、上移2 px版本；旧名 `red_2_v2.png` 已整理为 `红桃2分层/red_2.png`。

直接打开 [预览页面](preview.html)，可查看四花色、叠牌效果，并单独开关红桃2的点数/花色图层。

| 内容 | 入口 |
|---|---|
| 四花色大图 | [红桃](四花色样板/大图/红桃.png) · [方块](四花色样板/大图/方块.png) · [黑桃](四花色样板/大图/黑桃.png) · [梅花](四花色样板/大图/梅花.png) |
| 186×260样板与对比 | [素材目录](四花色样板/186x260/) · [四花色对比](四花色样板/四花色对比.png) |
| 最新红桃2分层 | [底图](红桃2分层/Shan_heart_base.png) · [点数2](红桃2分层/red_2.png) · [红桃](红桃2分层/heart.png) · [分层效果](红桃2分层/分层预览.png) |
| 布局参数 | [分层与UI布局](文档/分层与UI布局.md) · [layout.json](红桃2分层/layout.json) |
| 设计与来源 | [设计说明](文档/设计说明.md) · [来源与兼容边界](文档/来源与兼容边界.md) |
| 提示词 | [提示词索引](提示词/README.md) |
| 旧文案与生成记录 | [历史记录说明](文档/历史记录/README.md) · [整理记录](文档/整理记录.json) |

当前四花色样板是整体设计稿，只有红桃2做了独立底图、点数、花色三层。仍为素材设计阶段，未修改游戏代码或图集，未生成asar，也未验证游戏内接入。

保留了两份来源参考：原始“闪”底图及用户提供的风格参考。旧版生成图片、旧合成效果与临时图片已按本次整理要求清理；相关提示词、JSON、说明及辅助脚本文本保存在历史记录中。
''')
write('文档/设计说明.md', '''# 设计说明与已确认要求

## 最终四花色

- 红桃：深酒红、心形曲线与玫瑰；红宝石花色与细金边。
- 方块：深红底色、菱形切面、几何边饰，区别于红桃的花枝曲线。
- 黑桃：保留获认可的黑曜石大花色、尖拱与冷灰色装饰。
- 梅花：黑色主体、低饱和绿灰底色、三瓣结构和圆弧枝叶。

共同保留居中的金色“闪”、暗色毛玻璃氛围、细金属边框。用户明确要求花纹稍淡、装饰不再过亮，多张叠放时不抢眼；当前保留的是完成此调整后的柔光版。

## 点数与分层

点数写法为A、2～10、J、Q、K。布局信息放左上，点数在上、小花色在下，宽度需兼容两位数10。本次只制作真实原始牌表中红桃2的“闪”（牌ID28）作为样例，没有生成全部点数。

最新调整：数字在自身38×34透明图层内左移3 px、上移2 px；画布大小、图层合成坐标和花色位置不变。无需让数字与花色完全居中对齐。

底图左上不再固定绘制功能点数和小花色；上方大红桃、右上红桃仍作为主题装饰。对应三层坐标见[分层与UI布局](分层与UI布局.md)。

## 生成与资源约束

使用OpenAI Responses内置图像工具，参考图先压缩，每次只生成并返回一个资产，控制请求体大小。用户要求尽量少生成资源：当前保留最终样板、最新分层及必要预览，旧生成效果删除，文字和提示词归档。

分层参考原本是合成PNG，AI编辑用于补底与透明提取；不声称恢复了被原图遮挡处的原始像素。点数微调后按既定可见范围尺寸与偏移校准透明留边。
''')
write('文档/分层与UI布局.md', '''# 红桃2分层与UI布局

当前素材位于[红桃2分层](../红桃2分层/)，机器可读参数为[layout.json](../红桃2分层/layout.json)。

| 图层 | 文件尺寸（px） | UI尺寸 | UI坐标 | 186×260合成坐标 |
|---|---|---|---|---|
| 底图 | 186×260 | 93×130 | (0,0) | (0,0) |
| 点数2 | 38×34 | 19×17 | (4,4) | (8,8) |
| 红桃 | 38×34 | 19×17 | (4,19) | (8,38) |

这三个是独立叠加的绘制层。UI尺寸与PNG像素不是同一概念；当前素材按2倍UI尺寸导出。符号透明留边包含在图层尺寸中，19×17不是笔画的紧贴边界。点数和花色矩形重叠2个UI单位，但可见图案由透明留边隔开。

点数当前可见边界（Alpha>8）为`(6,2,26,30)`，宽20、高28；微调前为`(9,4,29,32)`。图层内偏移为`(-3,-2)`px，即`(-1.5,-1)`UI单位。外部图层位置仍为`(4,4)`UI单位，花色仍为`(4,19)`。

底图为不透明RGBA，两个符号具有真实Alpha透明通道（0～255），四角透明。预览的棋盘格仅用来展示透明度，不包含在素材里。底图里的大红桃和右上红桃是装饰，独立花色层只负责左上小红桃。

依据项目[OL指南](../../doc/sanguosha.md)的“点数 / 花色赋值与自定义图案可行性”：已有2026-10-08源码快照中`bF.MAX_SIZE/NORMAL_SIZE=93×130`；普通大尺寸采用上述布局。非大尺寸分支为16×14，点数`(3,3)`、花色`(3,15)`，本次没有另做小尺寸素材或修改原生layout。

交付前检查了像素尺寸、透明通道、点数可见范围和按坐标合成效果。本次没有接入客户端，不能将离线预览当作游戏内验收。
''')
write('文档/来源与兼容边界.md', '''# 来源与兼容边界

## 原始资料

- [OL指南](../../doc/sanguosha.md)：原始底图资源、三层绘制、点数/花色赋值与自定义素材可行性。
- [代码架构表](../../doc/代码架构表.md)：原始卡面与点数/花色调查摘要。
- [彩虹表](../../doc/彩虹表.js)：`manualLookupNotes.originalCardFaces/cardRankSuit`。
- [军争161张牌对应表](../../卡牌拆分/军争卡牌/161张牌对应表.csv)：牌ID28是红桃2“闪”；其他红桃闪有各自点数。
- [原始闪底图](../参考/原始闪.png)及[用户风格参考](../参考/用户风格参考.png)：来源参考，不属于本次删除的旧生成效果。

这些项目文档保留在原维护位置，本目录通过相对链接引用，避免复制出另一份过期的客户端说明。

## 分层设计与游戏接入的区别

底图、点数`bmpNumber`、花色`bmpFlower`是独立绘制层。普通点数1～13映射A～K；红色系与黑色系使用各自数字纹理，0应使用空纹理。原生点数可能受技能改变，显示花色应遵循原生展示规则，不能只按配置原值固定。

四花色“闪”原生共用`Shan_png`，目前四款样板的不同文件名只是设计区分，不表示游戏已能自动按花色切换。底图里的大花色装饰也需要与后续选择的主题保持一致。已拆cards图集不包含独立数字/花色资源，不能只换底图就宣称三层兼容。

本次仅整理素材。挂钩、技能临时改点/改色、装备区、空牌/虚拟牌、主动隐藏、对象复用及关闭恢复，均沿原指南记录的实现与验收边界；没有新增实现或游戏内验证。
''')
write('提示词/README.md', '''# 提示词索引

## 当前四花色样板

[红桃](四花色/红桃.txt) · [方块](四花色/方块.txt) · [黑桃](四花色/黑桃.txt) · [梅花](四花色/梅花.txt)

## 红桃2分层

1. [底图清理与留位](分层/01_底图.txt)
2. [点数2透明提取](分层/02_点数2提取.txt)
3. [红桃透明提取](分层/03_红桃提取.txt)
4. [点数左移、上移](分层/04_点数位置微调.txt)

[红桃2整图布局历史提示词](历史_红桃2整图布局.txt)是分层前参考，当前图片已由最新分层效果替代。

更早v1/v2/v4/v5/v6等阶段的完整提示词、原始说明、生成ID、尺寸与哈希均保留在[历史记录](../文档/历史记录/README.md)中。本目录提示词保存原文，没有将历史prompt中的旧参考关系改写为新生成内容。
''')
write('文档/历史记录/README.md', '''# 历史文字记录

此目录按原相对路径保留原卡面工作目录及两个图像临时目录的全部文字资料：提示词、Markdown说明、生成JSON，以及预览页面/辅助脚本的文本快照。文件内容保持原字节；HTML、Python、PowerShell、JavaScript快照额外添加`.txt`，不作为可运行入口。

这里的旧图片链接、旧绝对路径、文件名和SHA是历史溯源信息，不代表图片仍存在。旧效果图片已经清理，当前可用素材统一从[总说明](../../README.md)和[预览页面](../../preview.html)进入。

- `卡牌毛玻璃/`：v1毛玻璃、v2边框、v4居中设计、v5旧四花色、v6柔光及红桃2分层各阶段文字记录。
- `tmp/imagegen/shan-v6/`：四花色生成记录及相关辅助脚本文本。
- `tmp/imagegen/heart2-split/`：分层生成ID、提示词、点数微调参数及相关辅助脚本文本。

用户提供的v3风格参考没有独立文字记录，图片已单独保留在`参考/用户风格参考.png`。
''')
write('preview.html', (Path(__file__).parent/'preview-template.html').read_text(encoding='utf-8'))

source_to_copy = {}
for item in copied:
    source_to_copy.setdefault(item['source'], []).append(item['target'])
retained_image_hashes = {item['sha256'] for item in copied if Path(item['target']).suffix.lower() in IMAGE_EXTENSIONS}
for item in inventory:
    item['preservedAs'] = source_to_copy.get(item['path'], [])
    if item['preservedAs']:
        item['action'] = 'source-copy-removed-after-preservation'
    elif Path(item['path']).suffix.lower() in IMAGE_EXTENSIONS:
        item['action'] = 'duplicate-image-removed' if item['sha256'] in retained_image_hashes else 'superseded-image-removed'
    else:
        raise SystemExit('Text file was not preserved: '+item['path'])

checks = []
for file in OUT.rglob('*'):
    if not file.is_file() or '历史记录' in file.parts:
        continue
    if file.suffix == '.md':
        references = re.findall(r'\]\(([^)]+)\)', file.read_text(encoding='utf-8'))
    elif file.suffix == '.html':
        references = re.findall(r'(?:href|src)="([^"]+)"', file.read_text(encoding='utf-8'))
    else:
        continue
    for ref in references:
        if '://' in ref or ref.startswith('#'):
            continue
        path = (file.parent/ref.split('#')[0]).resolve()
        # The migration report is written after the validation inventory.
        if path == OUT/'文档/整理记录.json':
            continue
        assert path.exists(), (file, ref)
        checks.append({'file': file.relative_to(OUT).as_posix(), 'target': ref})
for copied_file in copied:
    assert sha(ROOT/copied_file['source']) == sha(ROOT/copied_file['target']) == copied_file['sha256']
for file in (OUT/'四花色样板/186x260').glob('*.png'):
    with Image.open(file) as image:
        assert image.size == (186,260)
for suit, label in suits:
    assert sha(OUT/f'四花色样板/大图/{label}.png') == next(v['largeSha256'] for v in record['variants'] if v['suit']==suit)
stats = {'retainedImages': len(list(OUT.rglob('*.png'))), 'archivedTextFiles': sum(c['role']=='historical-text-snapshot' for c in copied),
         'supersededImagesToDelete': sum(i['action']=='superseded-image-removed' for i in inventory),
         'duplicateImagesToDelete': sum(i['action']=='duplicate-image-removed' for i in inventory),
         'originalSourceFilesToRemove': len(inventory), 'relativeLinksChecked':len(checks)}
manifest = {'createdAt': datetime.now(timezone.utc).isoformat(), 'workspace':str(ROOT), 'destination':str(OUT),
            'status':'copied-and-verified; source-cleanup-pending', 'cleanupRoots':[str(p) for p in SOURCE_ROOTS],
            'stats':stats, 'preservedCopies':copied, 'originalInventory':inventory,
            'notes':'The original game resources and canonical project docs are outside cleanup scope. Historical text snapshots retain original paths as provenance.'}
write('文档/整理记录.json', json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
script = re.search(r'<script>(.*?)</script>', (OUT/'preview.html').read_text(encoding='utf-8'), re.S).group(1)
(Path(__file__).parent/'preview-check.js').write_text(script, encoding='utf-8')
print(json.dumps({'destination':str(OUT),'stats':stats,'verification':'image copies, all text snapshots, alpha/layout and current relative links verified'},ensure_ascii=False,indent=2))
