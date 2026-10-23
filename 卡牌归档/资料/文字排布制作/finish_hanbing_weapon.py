from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import shutil

folder=Path(__file__).resolve().parent
archive=folder.parents[1]
root=archive.parent
tarot=archive/'塔罗牌卡面'
samples=tarot/'文字排布样板'
records_path=samples/'generation-record.json'
records=json.loads(records_path.read_text(encoding='utf-8'))
old=next(row for row in records['variants'] if row['file']=='02_寒冰箭_黑桃2.png')
new=next(row for row in records['variants'] if row['file']=='02_寒冰剑_黑桃2_攻击范围2.png')
assert hashlib.sha256((samples/new['file']).read_bytes()).hexdigest()==new['sha256']
assert new['generationId']=='ig_0c1520d577599cb5016ad7b4da8c9487d0a1ed1f45c3076515'
new.update({'attackRange':2,'rangeSource':'weapon-range-source.json','rangeBadge':'右下黑曜石圆形徽记、双细金环、数字2',
            'status':'visually-reviewed-offline; awaiting user design feedback',
            'visualReview':{'nativeImage':True,'ui93x130':True,'inGame':False,
                            'checks':['correct title 寒冰剑','spade rank 2','separate bottom-right attack-range 2','readable lower-right badge']}})
historical_prompt=tarot/'提示词/历史/02_寒冰箭_已废弃.txt'
historical_prompt.parent.mkdir(exist_ok=True)
if historical_prompt.exists(): raise SystemExit('Historical prompt already exists')
shutil.copyfile(samples/old['promptFile'],historical_prompt)
old.update({'status':'superseded; image removal scheduled by user','imageRemoved':False,
            'promptFile':'../提示词/历史/02_寒冰箭_已废弃.txt','replacement':new['file']})
records.setdefault('supersededVariants',[]).append(old)
records['variants']=sorted((row for row in records['variants'] if row is not old),key=lambda row:row['file'])
records_path.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

old_name='02_寒冰箭_黑桃2'
new_name='02_寒冰剑_黑桃2_攻击范围2'
for rel in ['README.md','preview.html','提示词/README.md']:
    path=tarot/rel
    text=path.read_text(encoding='utf-8')
    text=text.replace(old_name,new_name).replace('寒冰箭','寒冰剑')
    path.write_text(text,encoding='utf-8')

norm=tarot/'文档/卡名文字排布规范.md'
text=norm.read_text(encoding='utf-8')
text=text.replace('寒冰箭已生成并检查小尺寸；待用户确认','寒冰剑已重做并加入右下范围2；待用户确认')
text=text.replace('| 寒冰剑（原始牌表）；用户本轮指定“寒冰箭” | 寒冰箭 | 三字横排；仅作用户指定文字的预览，不改原始映射 |','| 寒冰剑 | 寒冰剑 | 三字横排；右下攻击范围2 |')
text=text.replace('本轮只生成借刀、寒冰箭、无懈可击三张','当前三张样板为借刀、寒冰剑、无懈可击')
text=text.replace('三字样板沿用寒冰剑牌ID108的黑桃2信息，显示文字按本轮要求写“寒冰箭”','三字样板使用寒冰剑牌ID108的黑桃2信息及攻击范围2')
text=text.replace('本轮按借刀、寒冰箭、无懈可击的顺序分别完成保存与落文档','本轮三张均逐张完成保存与落文档，寒冰剑随后按用户要求修正名称并补齐武器范围')
section='''### 02 寒冰剑：三字横排与右下攻击范围（2026-10-21修订）

- 当前文件：[寒冰剑 · 黑桃2 · 攻击范围2](../文字排布样板/02_寒冰剑_黑桃2_攻击范围2.png)；[完整提示词](../提示词/文字排布/02_寒冰剑_黑桃2_攻击范围2.txt)。
- 原始牌ID108，正确名称“寒冰剑”，黑桃2；配置`h=attRange=2`、军争图鉴“攻击范围：2”和原始PNG中的范围信息一致。
- 卡名三字横排、整组居中；右下独立圆形徽记写数字2，采用黑曜石/珐琅材质和双细金环，呼应上方主花色。下方右侧花枝让位，左上点数2保持独立含义。
- 已检查大图和93×130缩略图：名称使用“剑”，右下2可辨；没有额外加一串难读的小字。徽记属于本次合成样板，尚未做独立范围层或游戏接入。
- 新内置工具生成ID：`ig_0c1520d577599cb5016ad7b4da8c9487d0a1ed1f45c3076515`；原始PNG为1061×1482。
- 旧“寒冰箭”无范围版本按用户要求移除；其[历史提示词](../提示词/历史/02_寒冰箭_已废弃.txt)和原生成记录只用于溯源，不再作为当前显示名或预览入口。
- 武器后续生成统一参照[武器攻击范围与徽记规范](武器攻击范围与徽记规范.md)，不能把左上点数当作攻击范围。

'''
text,count=re.subn(r'### 02 寒冰箭：.*?(?=### 03 无懈可击)',section,text,flags=re.S)
assert count==1
norm.write_text(text,encoding='utf-8')

rules='''# 武器攻击范围与右下徽记规范

## 已核实来源

使用已归档的官方配置`sys_playcard.json`（2026-10-20获取），不是凭武器牌名或牌面点数猜测。原始映射为`h=attRange`，`f=number`是点数，`i=attDistance`、`j=defDistance`是另外的距离字段。

数据与来源哈希见[weapon-range-source.json](../文字排布样板/weapon-range-source.json)，原配置为[sys_playcard.json](../../卡牌拆分/source/junzheng-check/sys_playcard.json)。

寒冰剑牌ID108：`f=2,g=3,h=2,p=HanBingJian`，即黑桃2、攻击范围2；军争图鉴`CardsBook[Model=1,ModelTab=2,cardid=108].dese`开头明确写“攻击范围：2”。[原始卡面](../../卡牌拆分/军争卡牌/HanBingJian_png.png)自身也画有“攻击范围 2”。

## 军争范围速查

| 武器 | 攻击范围 |
|---|---|
| 诸葛连弩 | 1 |
| 雌雄双股剑、青釭剑、寒冰剑、古锭刀 | 2 |
| 贯石斧、青龙偃月刀、丈八蛇矛 | 3 |
| 方天画戟、朱雀羽扇 | 4 |
| 麒麟弓 | 5 |

这张表只对应军争牌ID1～161，共12张实体武器、11种武器底图。其他模式按具体牌ID核对；例如同名寒冰剑ID2035的`h=1`，不能把军争值当成所有模式的统一值。批量任务中的赤血刀/赤血刃按用户明确要求写3。

## 卡面设计规则

- 武器卡必须展示攻击范围。徽记位于右下框内，主体数字与上方主花色使用同一套黑曜石/珐琅、细金边材质。
- 本次寒冰剑使用圆形暗底、双细金环、数字2；右下花朵/枝叶局部让位，数字不被枝叶穿过，保留与外框的间隔。
- 主卡名仍居中，范围徽记次于卡名。左上点数与右下范围是两种信息，即使都是2也保留各自位置。
- 不把“攻击范围”四个小字塞入徽记，不额外增加无法在93×130下识别的微型文案。非武器普通牌不加无意义的范围数字。
- 用户指定的火杀/冰杀/雷杀主标题统一写“杀”，右下同位置使用“火”“冰”“雷”属性徽记，含义不同于数字攻击范围。

本次仅验证配置数据、图鉴和原始图片，未证明`bmpRange`已承担动态显示链；现有原图已经带范围文字。当前新图是合成预览，批量正式底图须同时遵守左上点数/花色留位规范。
'''
(tarot/'文档/武器攻击范围与徽记规范.md').write_text(rules,encoding='utf-8')
readme=tarot/'README.md'
text=readme.read_text(encoding='utf-8').replace('| 卡名文字排布 |','| 武器范围 | [来源、速查与右下徽记规范](文档/武器攻击范围与徽记规范.md) |\n| 卡名文字排布 |',1)
readme.write_text(text,encoding='utf-8')

note='''#### 武器攻击范围来源（2026-10-21）

- 复用2026-10-20获取的普通配置`卡牌归档/卡牌拆分/source/junzheng-check/sys_playcard.json`，`abbreviation`明确`h=attRange`；`f=number`为点数，`i=attDistance/j=defDistance`为另外的距离字段。配置文件SHA-256：`5f4511709f238e7f8eb9ea53bdc944509ea0253d7adf9cb39e619c27cdd5ef40`。
- 军争牌ID108寒冰剑：`f=2,g=3,h=2,p=HanBingJian`，即黑桃2、攻击范围2；对应`CardsBook[Model=1,ModelTab=2,cardid=108].dese`开头是“攻击范围：2”，已拆原始`HanBingJian_png.png`图像自身也带“攻击范围 2”。本次没有将`bmpRange`的创建/清空代码当作动态范围显示已验证。
- 军争ID1～161中`type=3,subType=1`有12张实体武器/11种底图；范围数据保存于`卡牌归档/塔罗牌卡面/文字排布样板/weapon-range-source.json`。范围必须按牌ID/模式取值，同名寒冰剑ID2035为1，不能按名称无条件沿用军争2。
- 新样板将寒冰剑名称更正并在右下以黑曜石/金边徽记显示2；仅生成设计素材，未改游戏数据、原始图集或运行代码。长任务规则与用户对赤血刀范围3的覆盖属于设计任务配置，不回写官方配置。

关键词：`武器攻击范围`、`attRange`、`attDistance`、`defDistance`、`寒冰剑`、`HanBingJian`、`右下徽记`、`weapon-range-source.json`。

'''
for path in [root/'doc/sanguosha.md',archive/'资料/卡牌说明.md']:
    text=path.read_text(encoding='utf-8')
    anchor='#### 卡牌拆分与原位合并'
    assert anchor in text and '#### 武器攻击范围来源' not in text
    path.write_text(text.replace(anchor,note+anchor,1),encoding='utf-8')
architecture_note='- **武器攻击范围（2026-10-21）**：官方配置短字段`h=attRange`，区别`f=number`和`i/j`距离字段；军争寒冰剑ID108黑桃2的范围为2，与图鉴及原始PNG一致。跨模式同名牌可不同（ID2035寒冰剑范围1），按ID/模式核对。范围来源、军争11种武器速查和右下徽记规则见OL指南“武器攻击范围来源”及`卡牌归档/塔罗牌卡面/文档/武器攻击范围与徽记规范.md`；仅离线调查/素材设计，无游戏数据或显示挂钩变更。\n\n'
for path in [root/'doc/代码架构表.md',archive/'资料/卡牌架构摘录.md']:
    text=path.read_text(encoding='utf-8')
    index=text.index('关键词：')
    path.write_text(text[:index]+architecture_note+text[index:],encoding='utf-8')
rainbow=root/'doc/彩虹表.js'
text=rainbow.read_bytes().decode('utf-8')
marker='DAXIAOCHAO_RAINBOW_TABLE.manualLookupNotes = {'
generated,manual=text.split(marker,1)
anchor='      "首次查询仅复用2026-10-08本地快照'
new_note='      "2026-10-21武器范围：sys_playcard.abbreviation的h=attRange，f是点数，i/j为attDistance/defDistance。军争寒冰剑ID108为黑桃2且攻击范围2，与CardsBook(Model=1,ModelTab=2,cardid=108).dese及原始PNG范围文字一致；其他模式ID2035同名范围1，不能按名字或牌点数推断。来源及武器速查在OL指南武器攻击范围来源；本次未验证动态bmpRange显示或改游戏数据。",\n'
assert anchor in manual
rainbow.write_bytes((generated+marker+manual.replace(anchor,new_note+anchor,1)).encode('utf-8'))

delete_paths=[samples/'02_寒冰箭_黑桃2.png', folder/'hanbing-review.jpg', folder/'hanbing-ui-check.png',tarot/'提示词/文字排布/02_寒冰箭_黑桃2.txt']
delete_record={'newFile':str(samples/new['file']),'newSha256':new['sha256'],'historicalPrompt':str(historical_prompt),
               'paths':[{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in delete_paths]}
(folder/'replace-hanbing-cleanup.json').write_text(json.dumps(delete_record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'replacement':new['file'],'attackRange':2,'deletePaths':len(delete_paths),'docsUpdated':True},ensure_ascii=False))
