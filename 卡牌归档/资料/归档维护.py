from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import shutil
import sys
from PIL import Image

ARCHIVE = Path(__file__).resolve().parents[1]
ROOT = ARCHIVE.parent
REPORT = ARCHIVE / '归档迁移记录.json'
MOVES = [
    ('cards.png', 'cards.png'),
    ('卡牌拆分', '卡牌拆分'),
    ('塔罗牌卡面', '塔罗牌卡面'),
    ('tmp/card-face-inspection', '资料/点数花色调查'),
    ('tmp/tarot-asset-cleanup', '资料/上一轮整理脚本'),
]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def rewrite(path, replacements):
    data = path.read_bytes()
    text = data.decode('utf-8-sig')
    for old, new in replacements:
        if old not in text:
            raise ValueError(f'Missing expected text in {path}: {old}')
        text = text.replace(old, new)
    path.write_text(text, encoding='utf-8', newline='')

def capture():
    if REPORT.exists():
        raise SystemExit('Existing archive migration report; refusing to restart.')
    files = []
    for old, new in MOVES:
        src, dst = ROOT/old, ARCHIVE/new
        assert src.exists() and not dst.exists(), (src, dst)
        entries = [src] if src.is_file() else sorted(p for p in src.rglob('*') if p.is_file())
        for file in entries:
            target = dst if src.is_file() else dst/file.relative_to(src)
            files.append({'source':file.relative_to(ROOT).as_posix(), 'target':target.relative_to(ARCHIVE).as_posix(),
                          'sha256Before':sha(file), 'bytesBefore':file.stat().st_size})
    save_json(REPORT, {'createdAt':datetime.now(timezone.utc).isoformat(),'workspace':str(ROOT),'archive':str(ARCHIVE),
                      'status':'captured-before-move','moves':[{'source':str(ROOT/a),'target':str(ARCHIVE/b)} for a,b in MOVES], 'files':files})
    print(json.dumps({'files':len(files),'imageFiles':sum(Path(f['source']).suffix.lower() in {'.png','.jpg','.webp'} for f in files)},ensure_ascii=False))

def finish():
    report = json.loads(REPORT.read_text(encoding='utf-8-sig'))
    assert report['status'] == 'captured-before-move'
    for item in report['files']:
        assert sha(ARCHIVE/item['target']) == item['sha256Before'], item['target']
    for old, new in MOVES:
        assert not (ROOT/old).exists() and (ARCHIVE/new).exists()

    guide = ROOT/'doc/sanguosha.md'
    rewrite(guide, [
        ('卡牌拆分/', '卡牌归档/卡牌拆分/'),
        ('tmp/card-face-inspection', '卡牌归档/资料/点数花色调查'),
        ('--workspace 卡牌拆分', '--workspace 卡牌归档/卡牌拆分'),
        ('--image cards.png', '--image 卡牌归档/cards.png'),
        ('用户随后提供工程根目录 `cards.png`', '用户提供的 `cards.png`（现归档于 `卡牌归档/cards.png`）'),
        ('#### 卡牌拆分与原位合并（2026-10-20，后续实际完成）', '#### 卡牌拆分与原位合并（2026-10-20，后续实际完成）\n\n2026-10-21 已将原始图集、卡牌拆分、塔罗牌卡面及点数花色调查资料统一迁入[卡牌归档](../卡牌归档/README.md)。图片内容保持不变，合并入口已适配新目录；归档内包含当前卡牌说明摘录。工程工具源码仍在 `tools/card_atlas.py`，交付副本随拆分目录归档。'),
    ])
    architecture = ROOT/'doc/代码架构表.md'
    rewrite(architecture, [('卡牌拆分/', '卡牌归档/卡牌拆分/'),
        ('## 原始卡面 / 本地卡牌配置查询与图集拆分（2026-10-20）', '## 原始卡面 / 本地卡牌配置查询与图集拆分（2026-10-20）\n\n- **归档位置（2026-10-21）**：原始图集为 `卡牌归档/cards.png`，完整拆分与军争副本在 `卡牌归档/卡牌拆分/`，最终设计、分层和提示词在 `卡牌归档/塔罗牌卡面/`；点数花色调查移至 `卡牌归档/资料/点数花色调查/`。预览与合并入口已同步路径，图片按迁移前SHA校验；没有变更游戏功能或发布载荷。')])
    rainbow = ROOT/'doc/彩虹表.js'
    text = rainbow.read_bytes().decode('utf-8')
    marker = 'DAXIAOCHAO_RAINBOW_TABLE.manualLookupNotes = {'
    generated, manual = text.split(marker,1)
    manual = manual.replace('tmp/card-face-inspection', '卡牌归档/资料/点数花色调查').replace('卡牌拆分/', '卡牌归档/卡牌拆分/')
    needle = '      "首次查询仅复用2026-10-08本地快照'
    assert needle in manual
    manual = manual.replace(needle, '      "2026-10-21素材归档：原始图集位于卡牌归档/cards.png，完整拆分在卡牌归档/卡牌拆分，最终四花色与分层在卡牌归档/塔罗牌卡面。合并脚本适配两级父目录的开发Python环境；图片未改动，未修改游戏代码或发布载荷。",\n'+needle,1)
    rainbow.write_bytes((generated+marker+manual).encode('utf-8'))
    rewrite(ROOT/'rules.md', [('使用 `tools/card_atlas.py` 与匹配的 atlas/图片；', '离线卡牌素材统一在 `卡牌归档/`；使用 `tools/card_atlas.py` 与匹配的 atlas/图片；')])

    merge = ARCHIVE/'卡牌拆分/merge.cmd'
    data = merge.read_bytes().decode('utf-8-sig')
    line = 'set "ATLAS_PYTHON=python"'
    assert line in data
    data = data.replace(line, line+'\r\nif exist "%~dp0..\\..\\.venv-card-atlas\\Scripts\\python.exe" set "ATLAS_PYTHON=%~dp0..\\..\\.venv-card-atlas\\Scripts\\python.exe"',1)
    merge.write_bytes(data.encode('utf-8'))
    with (ARCHIVE/'卡牌拆分/README.md').open('a',encoding='utf-8') as file:
        file.write('\n## 统一归档位置\n\n本目录现位于`卡牌归档/卡牌拆分/`，原始输入图集为[../cards.png](../cards.png)。`merge.cmd`优先查找本目录上级或上两级的`.venv-card-atlas`，否则使用PATH中的Python；工作目录由脚本自身位置确定。随目录已有`atlas_tool.py`和`requirements.txt`，可单独归档或复制到其他电脑。\n\n历史来源/验证JSON中的旧绝对路径保留为当时记录；实际合并使用`manifest.json`中的相对路径。\n')
    rewrite(ARCHIVE/'资料/点数花色调查/verify.cjs', [
        ("fs.readFileSync('卡牌拆分/source/cards.atlas', 'utf8')", "fs.readFileSync(path.join(__dirname, '../../卡牌拆分/source/cards.atlas'), 'utf8')")
    ])

    tarot = ARCHIVE/'塔罗牌卡面'
    rewrite(tarot/'文档/分层与UI布局.md', [('../../doc/sanguosha.md','../../资料/卡牌说明.md')])
    rewrite(tarot/'文档/来源与兼容边界.md', [
        ('../../doc/sanguosha.md','../../资料/卡牌说明.md'),
        ('../../doc/代码架构表.md','../../资料/卡牌架构摘录.md'),
        ('../../doc/彩虹表.js','../../资料/卡牌链路索引.json'),
        ('这些项目文档保留在原维护位置，本目录通过相对链接引用，避免复制出另一份过期的客户端说明。', '工程维护源仍在项目doc目录；本归档的资料目录保存2026-10-21卡牌相关摘录和手工链路索引，便于离开工程后查阅。归档摘录记录当时结论，不替代工程维护源。')
    ])
    previous_report = tarot/'文档/整理记录.json'
    shutil.copyfile(previous_report, ARCHIVE/'资料/上一轮整理脚本/整理记录_归档前.json')
    old = json.loads(previous_report.read_text(encoding='utf-8-sig'))
    old['destination'] = str(tarot)
    for entry in old['preservedCopies']:
        if entry['target'].startswith('塔罗牌卡面/'):
            entry['target'] = '卡牌归档/'+entry['target']
    for entry in old['originalInventory']:
        entry['preservedAs'] = ['卡牌归档/'+p if p.startswith('塔罗牌卡面/') else p for p in entry['preservedAs']]
    old['subsequentArchiveMove'] = {'date':'2026-10-21','newRoot':'卡牌归档/塔罗牌卡面','originalReport':'../../资料/上一轮整理脚本/整理记录_归档前.json'}
    save_json(previous_report, old)

    # Archive just the card-related documentation, keeping the maintained files
    # in doc/. Relative links in these reading snapshots point inside the archive.
    source = guide.read_text(encoding='utf-8')
    excerpt = source.split('### 已落地的专项查询：原始卡面 / 卡牌资源',1)[1].split('## 二、解包数据是什么',1)[0]
    excerpt = '### 已落地的专项查询：原始卡面 / 卡牌资源'+excerpt
    excerpt = excerpt.replace('../卡牌归档/','../').replace('../tools/card_atlas.py','../卡牌拆分/atlas_tool.py')
    excerpt = excerpt.replace("& '.\\.venv-card-atlas\\Scripts\\python.exe' -X utf8 tools/card_atlas.py", 'python 卡牌拆分/atlas_tool.py')
    excerpt = excerpt.replace('--atlas 卡牌归档/', '--atlas ').replace('--image 卡牌归档/', '--image ').replace('--workspace 卡牌归档/', '--workspace ')
    excerpt = excerpt.replace('复用命令（仓库根目录；','复用命令（卡牌归档目录；')
    (ARCHIVE/'资料/卡牌说明.md').write_text('# 卡牌资料摘录\n\n2026-10-21从工程`doc/sanguosha.md`摘录，仅包含卡牌相关内容，阅读链接及示例命令已适配归档目录。\n\n'+excerpt,encoding='utf-8')
    arch = architecture.read_text(encoding='utf-8').split('## 原始卡面 / 本地卡牌配置查询与图集拆分',1)[1].split('## 官服 / 4399',1)[0]
    arch = ('## 原始卡面 / 本地卡牌配置查询与图集拆分'+arch).replace('(sanguosha.md#','(卡牌说明.md#').replace('(sanguosha.md)','(卡牌说明.md)')
    (ARCHIVE/'资料/卡牌架构摘录.md').write_text('# 卡牌架构摘录\n\n来自2026-10-21工程`doc/代码架构表.md`的卡牌章节。\n\n'+arch,encoding='utf-8')

    (ARCHIVE/'README.md').write_text('''# 卡牌归档

将本文件夹整体复制或压缩即可归档卡面素材、拆分结果、最终设计、提示词及相关资料。

| 内容 | 入口 |
|---|---|
| 原始完整图集 | [cards.png](cards.png)，2048×4096 |
| 全部111项原始拆分 | [卡牌拆分预览](卡牌拆分/preview.html) · [使用说明](卡牌拆分/README.md) |
| 军争44种底图、161张牌映射 | [军争预览](卡牌拆分/军争卡牌/preview.html) · [牌表](卡牌拆分/军争卡牌/161张牌对应表.csv) |
| 最终四花色与红桃2分层 | [塔罗牌卡面预览](塔罗牌卡面/preview.html) · [资料索引](塔罗牌卡面/README.md) |
| 卡牌说明与调查记录 | [资料目录](资料/README.md) |
| 本次迁移校验 | [归档迁移记录](归档迁移记录.json) |

`卡牌拆分`自带合并工具、依赖清单、图集配置和来源图片；其source目录内的图集副本是合并所需输入，予以保留。目录内已有的合并结果也原样保留。

原始图集SHA-256：`14e786fd774fc5a9e1de952ad6a042ec5b87220bf434bc2d8410584eae01c3df`。原始图和所有迁移图片已逐文件核对，没有重新生成或改画。

工程工具源码、Python虚拟环境和公共文档仍在原维护位置；归档中已包含可独立使用的拆分工具副本及卡牌相关文档摘录。其他电脑使用合并工具时，先安装Python和`卡牌拆分/requirements.txt`中的依赖。
''',encoding='utf-8')
    (ARCHIVE/'资料/README.md').write_text('''# 卡牌资料

- [卡牌说明](卡牌说明.md)：原始资源、点数/花色分层、拆分与合并方法的归档摘录。
- [卡牌架构摘录](卡牌架构摘录.md)：已核实入口和边界。
- [卡牌链路索引](卡牌链路索引.json)：彩虹表中两份手工卡牌笔记，不含整份生成表。
- [点数花色调查](点数花色调查/)：已有63项抽取方法检查及脚本。脚本使用原记录中的客户端快照路径；快照不在本卡牌素材归档中。
- [上一轮整理脚本](上一轮整理脚本/)：前一轮清理所用的脚本、页面模板和原迁移记录，仅作为历史资料，脚本中的旧目录不是当前操作入口。
- [归档维护脚本](归档维护.py)：本次迁移路径修正和校验的记录；已完成的capture/finish阶段不可重复执行。

归档摘录日期为2026-10-21，工程内维护源仍是`doc/sanguosha.md`、`doc/代码架构表.md`和`doc/彩虹表.js`。本次未变更游戏运行代码或生成asar。
''',encoding='utf-8')
    report['status'] = 'moved-and-paths-updated; final-verification-pending'
    save_json(REPORT,report)
    print(json.dumps({'movedFilesVerified':len(report['files']),'imagePixels':'unchanged','status':report['status']},ensure_ascii=False))

def verify():
    report = json.loads(REPORT.read_text(encoding='utf-8-sig'))
    images=0
    for item in report['files']:
        p=ARCHIVE/item['target']
        assert p.is_file(), p
        item['sha256After']=sha(p)
        item['contentChangedForRelocation']=item['sha256After']!=item['sha256Before']
        if p.suffix.lower() in {'.png','.jpg','.jpeg','.webp'}:
            assert not item['contentChangedForRelocation'], p
            images+=1
    checked=0
    for p in ARCHIVE.rglob('*'):
        if not p.is_file() or '历史记录' in p.parts or '上一轮整理脚本' in p.parts:
            continue
        if p.suffix=='.md':
            refs=re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf-8'))
        elif p.suffix=='.html':
            refs=re.findall(r'(?:href|src)="([^"]+)"',p.read_text(encoding='utf-8'))
        else:
            continue
        for ref in refs:
            if '://' in ref or ref.startswith('#'):
                continue
            target=(p.parent/ref.split('#')[0]).resolve()
            assert target.exists(), (p,ref)
            checked+=1
    with Image.open(ARCHIVE/'cards.png') as im:
        assert im.size==(2048,4096)
        im.verify()
    report['status']='complete'
    report['completedAt']=datetime.now(timezone.utc).isoformat()
    report['verification']={'movedImagesHashUnchanged':images,'relativeLinksChecked':checked,'originalImageReadable':True}
    save_json(REPORT,report)
    print(json.dumps(report['verification'],ensure_ascii=False))

if __name__=='__main__':
    {'capture':capture,'finish':finish,'verify':verify}[sys.argv[1]]()
