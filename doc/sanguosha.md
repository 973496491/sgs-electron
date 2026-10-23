# 三国杀OL 解包数据使用指南

本文中的本地路径和命令以仓库根目录为基准。项目执行规则见 [rules.md](../rules.md) 与 [AGENTS.md](../AGENTS.md)；小抄调用链见 [代码架构表](代码架构表.md) 与 [彩虹表](彩虹表.js)。

> 写给想研究/编写「三国杀OL网页版」辅助脚本的玩家。
>
> 本文介绍：解包数据是什么、怎么获取、里面有什么，以及最关键的一部分——这些数据如何帮助写脚本。
>
> 仅供学习交流，请遵守游戏用户协议。

---

## 一、先搞清楚：OL 和十周年是两套客户端

- **三国杀OL（网页版）**
  - `https://web.sanguosha.com/220/h5_2/`
  - 4399/快玩等入口内部同源

- **三国杀十周年**
  - `https://web.sanguosha.com/10/pc/`

两者代码、加密方式、配置结构都不一样，解包脚本不能混用。

本文只针对 **OL**。

## 2026-10-08 实际核验

- **结论：可以作为本项目的开发和排查指南，但配套工具、索引文件需要补齐。** 本次直接下载公开资源，在内存中完成 ZIP 解包、AES 解密和 JSON 解析，没有修改游戏脚本。
- 原配置地址中的 `/220/h52/` 返回 404；正确路径为 `/220/h5_2/`。本次配置 ZIP 为 4,142,728 字节，包含 138 个 `.sgs` 配置，使用下文 Key/IV 全部成功解析为 JSON。
- 主程序下载地址可用，ZIP 内含 `sgsGame.sgs`，解压后为 27,492,996 字节的明文 JS；仍包含压缩代码和混淆变量名。已确认 `InitOfb`、`regNewProto`、`MailWindow`、`SelectGeneralWindow`、`GsCRoleOptTargetNtf`、`IsInActivityTime` 等检索入口存在。
- 当前工作区未找到 `ol_decrypt.mjs`、`code/sgsGame.main.js`、配置 JSON 和三张 TSV 索引；本文提到这些文件，不代表当前仓库已附带。下面的 41 个 JSON、协议/类/事件数量属于原文所述快照，不能作为当前完整性校验值。
- 当前小抄的实际消息入口是 `SGSMODULE -> main -> logic`，兼容 `ClassName/className`，类解析封装为 `laya.class`；文中的 `handleRuntimeEvent`、`QI.class` 是示例名称，不能直接当成本仓库入口。修改前仍须结合 `doc/代码架构表.md`、`doc/彩虹表.js` 和调试窗口日志确认调用条件。
- 配置和客户端代码可用于分析客户端收到的数据与处理逻辑；不能据此取得服务端未下发的隐藏手牌、身份或服务端实现。此次核验未进行游戏内功能实测。

### 完整解包仍缺什么（2026-10-08 补充核验）

当前仅完成下载/解码的内存核验，工作区尚无完整解包目录。上面的可行性结论限已验证的普通配置和主程序分支；完整客户端资源归档还需以下内容。

| 缺项 | 核验结果与待完成工作 |
|---|---|
| 可重复执行的工具与产物 | 补齐下载、ZIP 解包、解密、输出工具，保存原包、明文 JS、配置 JSON、协议 `.proto`、错误报告；当前没有 `ol_decrypt.mjs`，也没有将本次内存结果落盘。 |
| 两套主程序和配套引擎 | 官方 `libs/after.js` 根据 `supportES6` 选择 `sgsGame_a.sgs + libs/min/laya_a.sgs`，否则选择无 `_a` 的两包；还受 `channelUnsuportES6` 影响。两套 ZIP 都可获取。`sgsGame_a.sgs` 内明文为 22,561,844 字节，无 `_a` 版为 27,492,996 字节；两套引擎各有 22 个文件，包含 Laya、Spine、ByteBuffer、Long、解压等库，须分别保存。 |
| 启动配置与协议包 | `res/config/h5_global_conf.sgs` 可用原 Key/IV 解出 498,960 字节 JSON；`res/proto/Proto.sgs` 内 `client.sgs` 经 AES/gzip 后是 3,040 字节的 `.proto` 文本，不能强制按 JSON 解析。该文件仅定义 6 个 message，含聊天消息，不能当成全部游戏协议；其余消息仍要回查主程序。 |
| `_w` 的 WASM 解密分支 | `Config_w.sgs`、`h5_global_conf_w.sgs`、`Proto_w.sgs` 均存在；`Config_w.sgs` 也含 138 个文件，但与普通版包哈希不同。样本套用原 AES 参数均不能得到有效 gzip，不能视为同格式副本。主程序 `l0t.IsWasmCrypt` 判断 `!c1t.IsApp && !!window.WebAssembly`，命中后 `l0t.I()` 返回 `CtrUtil.Ctr`，并先调用 `CtrUtil.Init()`；尚缺 `CtrUtil` 对应 JS/WASM 依赖定位、解密实现和全量验证。此判断独立于 `_a` 的 ES6 分支。 |
| 启动入口与版本固定 | 还需取得实际启动页及依赖清单，保存 `window.mainVersion`、`window.layaVersion`、`HKt.ConfigVersion` 和资源根路径。官方加载器使用 `fflate/JSZipUtils` 等；仓库 `resources/after.js` 是本地替换补丁，不能代替官方完整加载器。目录 `/220/h5_2/` 本次返回 403，`index.html` 返回 404，不能把目录地址当成已取得的启动 HTML。 |
| 资源清单与实际资源 | `res/default.res.json` 可下载，含 322 个分组和 637 条资源记录；`version.json` 可下载，含 11,831 个路径条目。尚未下载图集及图片、皮肤动画、声音、字体等，也未递归补齐图集引用的贴图、动画关联文件及动态拼接路径。版本表条目数不等于已证明完整的资源总数。根目录 `runtime_version.json` 本次为 404；主程序存在条件加载它与 `version/version_<编号>.json` 的分支，须按实际入口判断，不能认定所有入口都必需。 |
| 派生索引与完整性验收 | 补齐 `protocol_map.tsv`、`window_class_registry.tsv`、`event_names.tsv` 的生成器与输出，保留源码位置和来源。记录每个原包/产物的 URL、抓取时间、版本参数、字节数、SHA-256、解码状态；核对 ZIP 条目、全部 JSON、`.proto` 类型、资源引用和失败清单。三张索引属于分析辅助产物，不是官方原包内自带文件。 |

若目标仅是维护小抄，普通配置、全局配置、对应主程序/引擎、协议定义和索引可先构成可用分析资料；若目标是完整网页客户端归档，则需继续覆盖 WASM 分支、启动依赖和全部资源引用。离线运行还依赖登录/游戏服务端，不能把完成静态解包等同于可离线对战。

核验入口：[官方加载器](https://web.sanguosha.com/220/h5_2/libs/after.js)、[资源分组清单](https://web.sanguosha.com/220/h5_2/res/default.res.json)、[资源版本清单](https://web.sanguosha.com/220/h5_2/version.json)。这些地址会更新，以上数量仅代表本次核验结果。

### 已落地的专项查询：牌面标记 / 族荀攸百出

2026-10-08 复用已保存的普通配置与 ES6 主程序快照，确认族荀攸 `573`、百出 `3338/BaiChu`，核对 `GsCUpdateRoleDataExNtf -> markSkills` 数据入口及 `SetCardUIRemark -> SkillCardRemark -> Card.TagArr1 -> UpdateTag` 牌面重算链，同时定位 UI 临时标签 `AddCardTag/DelCardTag` 和小抄已有顺机/弹雀/炁挂钩。详见 [牌面标记链路](牌面标记链路.md)，彩虹表入口 `manualLookupNotes.cardFaceMarks`。已做源码与抽取方法验证，尚未游戏内实测；后续直接按该文档检索，不必为同一问题重新做全客户端解包。

### 已落地的专项查询：谋周瑜醉锋

2026-10-08 按本文方法，定向解密 `character.sgs/cha_spell.sgs/cha_spellextend.sgs/sys_h5_text.sgs` 并检索 `sgsGame_a.sgs`，确认武将 `770`、醉锋 `4025`、顾曲 `4024`。官方 `GsCRoleOptTargetNtf(Type=28).Params -> SelectCardWindow` 链已核实，并据此接入小抄可见手牌。证据、源码入口、测试与来源哈希见 [谋周瑜醉锋可见牌](谋周瑜醉锋可见牌.md)。原包和解出资料保存在该记录列出的临时目录，仓库保存查询结论；这不改变全量资料与 WASM 分支尚未完成的状态。

---

### 已落地的专项查询：牌顶 / 牌底可见牌完整性核对（2026-10-23）

复查前确认 `C:\Users\97349\AppData\Local\Temp\codex-ol-zuifeng-qJebR9\sgsGame.main.js` 仍存在，复用2026-10-08的ES6明文快照，没有重新下载在线版。`107011 -> decodeGameDealPileTopCardList` 的官方事件名是 `GS_CLIENT_REPLAY_RECORD_DEAL_PILE_CARD_TOP`，处理函数从 `Protocol.Data.ProtoObj.list_card_id` 写入 `c1t.CardTopIds`（字符偏移约9247724）；属于回放链，不能凭名称认定普通实战必发或小抄已接入。原生移牌类 `O$t` 附近11085372明确 `POS_FRONT_BOTTOM=0`、`POS_BACK_TOP=65280`、`POS_RANDOM=65281`、`POS_NEEDLESS=65282`；小抄 `RAND=65282`，位置语义核对不得混淆后两者。符号及偏移仅适用于该快照。

小抄模型和真实镜像函数的模拟结果、48px折叠显示、明暗混合信息丢失及非零位置 `slice(pos,length)` 漏记详见 [代码架构表](代码架构表.md)“牌顶 / 牌底可见牌完整性核对”，手工索引 `manualLookupNotes.deckVisibilityAudit`；该节保留修改前基线。随后按用户要求实现的独立可拖动浮层及普通牌堆混合明暗/非零位置修复见同表“独立可拖动浮层”和 `manualLookupNotes.deckVisibilityFloatingPanel`。未游戏内实测，也没有证明所有技能消息覆盖；不改变上述官方快照协议结论。

### 已落地的专项查询：武将攻击动效

2026-10-15 复用仍存在的 2026-10-08 ES6 主程序和普通配置快照，定向解密 `cha_gs_dbs_fs_skininfo.sgs`，确认 `PubGsCUseCard -> ShowUseCardAni -> USE_CARD -> useCardAniPlay -> onPlayNewSpEffect(3) -> xingxiang.json/GongJi`。已核对皮肤/形态选路、`skinEffectNew/Small/Big`、Spine 加载、出框/震屏/全屏/声音标签与停止恢复。详见 [武将攻击动效链路](武将攻击动效链路.md)，彩虹表入口 `manualLookupNotes.generalAttackAnimation`；31 项抽取方法模拟验证通过，未游戏内实测或下载动画依赖，不改变全量归档及 WASM 分支的未完成状态。

### 已落地的专项查询：原始卡面 / 卡牌资源（2026-10-20）

- **本地来源**：确认 `C:\Users\97349\AppData\Local\Temp\codex-ol-zuifeng-qJebR9` 中 `Config.sgs`、`sgsGame.main.js`、`sources.json` 仍存在，复用 2026-10-08 普通配置及 ES6 主程序快照；主程序 SHA-256 为 `f62c194174dd2ff4531bc44a795616b6a51f449a3c7c2bec5270f390da55f245`。本次没有重新下载在线客户端。
- **配置与产物**：定向 AES-CFB/gzip 解出 `sys_playcard.sgs` 和 `sys_appearance.sgs`，JSON 已解析通过。临时输出为 `C:\Users\97349\AppData\Local\Temp\codex-ol-card-face-OtAFpU`，含两份 JSON、`card-face-index.json` 和来源记录；索引保留原始行及 `source=card/card_H5`，不是去重后的运行时表。临时目录可能被清理。
- **字段恢复**：`sys_playcard.abbreviation` 明确 `a=id`、`b=name`、`f=number`、`g=color`、`m=spellId`、`n=imageId`、`p=res`。`GamePlayCards.card` 有 2878 行、`card_H5` 有 43 行，共 2921 行、2903 个不同 ID；非空 `res` 共 169 种，201 行没有显式 `res`，不能把行数等同于可提取图片数。`card_H5` 使用长字段名，初始化时覆盖同 ID 的普通行；还存在 `configData2` 二次解析入口，离线索引不代表当前完整运行时状态。

| 卡牌 ID | 原始名称 | 普通三国杀花色 / 点数 | `res` | 默认纹理键 |
|---|---|---|---|---|
| 7 | 杀 | 方块 7 | `Sha` | `Sha_png` |
| 14 | 诸葛连弩 | 方块 A | `ZhuGeLianNu` | `ZhuGeLianNu_png` |
| 25 | 桃 | 方块 Q | `Tao` | `Tao_png` |
| 136 / 149 | 藤甲 | 黑桃 2 / 梅花 2 | `TengJia` | `TengJia_png` |

- **默认卡面链**：快照 `Yx.initCardsByClassName/initCardJson -> GetCardById -> L$t.CardId/CardInfo -> resName=t.res -> zzt.UpdateCardFace/SetCardFace -> fwt.GetRes(Card.ResName+"_png") -> bmpFace.texture`。`imageId` 是另一配置字段，本次确认的 H5 默认显示链实际使用 `res`。`iVi.UpdateCardFace` 再单独设置 `bmpFlower/bmpNumber`，花色点数不必烘焙在底图里；普通三国杀 `_q` 为 `1=红桃、2=方块、3=黑桃、4=梅花`，不要套用扑克牌斗地主的花色编码。`bF.NORMAL_SIZE=93×130` 是 UI 显示尺寸，不是原图分辨率。
- **皮肤与例外**：`sys_appearance.CardsShow` 的 `id=0`、`type=1/2` 标题为“经典卡牌”；`jV` 将 type 2 用作 FaceVO、type 1 用作 BackVo，拼接 `card/kamian/<id>.png`、`card/kabei/<id>.png`、`card/icon/<id>.png`（均相对资源根）。普通 UI 先画卡牌自身底图，再经 `SetCardFaceEffect` 加装饰；这不是每种牌插画的路径表。此入口要求本人座位及 `Bottom_CardFace` 开放，实际装饰绘制还排除 `IsMatchOB`。空牌走 `EmptyCard_png` 等卡背，易牌可用 `WuTianWuJie_png`，扑克牌显示与技能变牌还有独立分支，不能把当前 `bmpFace.texture` 无条件当作原始卡面。
- **图片本体边界**：`fwt.GetRes` 先查图集子项，再查资源配置 URL；`rwt.parseAtlas` 从 `frames` 去扩展名建立纹理键，路径由 `meta.prefix` 或图集路径派生。`Sha_png` 是资源键，不是已证实的独立 `Sha.png` 下载地址。还需匹配的资源清单、图集 JSON 与贴图，才能确认实际 URL、裁切坐标和像素尺寸。本次未提取图片、未验证图片文件齐全或游戏内效果，也未改游戏代码。
- **小抄已有原图入口**：`electron-next/resources/daxiaochao.user.js` 的 `_0x262d` 解码器及 rotation/string array 已隔离抽取，440 个条目与彩虹表一致。`_0x3b9f65` 保存原卡面预览图集地址 `https://web.sanguosha.com/220/h5_2/res/assets/cards/normal/cards.png`，预览常量为整图 `4096×2048`、裁切 `{x:2046,y:4,w:186,h:260}`；同目录 `cards.webp` 用在原始卡背预览。以上是当前小抄源码常量，本次没有请求该图片或验证当前像素/裁切内容，不能当成完整图集坐标表。
- **小抄原始纹理保存/恢复**：`_0x52c243 -> window.__cardTheme` 维护 `baseCardTexMap/miaoCardTexMap/cardUiRegistry`。`getCardUrl` 将 `Sha_png` 归一为 `Laya.URL.formatURL('cards/Sha_png.png')` 这类图集子纹理缓存路径，`seedBaseTextureMap` 从 `Laya.Loader.textureMap` 收集原始纹理，`syncTextureMap` 在关闭替换时写回，`refresh` 对注册 UI 调 `UpdateCardFace`。`#originCardUseBtn` 点击将 `globalConfig.miaoCardSwitch=false`；与“原始卡背”独立。这里只确认已有源码路径，没有读取当前游戏内存中的 Map 或实际点击按钮。额外索引保存为临时目录的 `userscript-original-face.json`。

复查字符偏移：`Yx=2457004`、`initAbbreviation=1166923`、`_q=3100594`、`L$t=11054189`、`zzt.SetCardFace=10259200`、`iVi.UpdateCardFace=17105233`、`rwt.parseAtlas=4942817`、`QV/jV=2701023` 附近。这些混淆符号与偏移仅用于该快照；手工索引为 `manualLookupNotes.originalCardFaces`。

关键词：`原始卡面`、`原始卡牌`、`sys_playcard`、`sys_appearance`、`GamePlayCards`、`abbreviation`、`imageId`、`resName`、`Sha_png`、`ZhuGeLianNu_png`、`TengJia_png`、`GetAtlasUrl`、`parseAtlas`、`card-face-index.json`。

#### 分层卡面 / 原始插画叠加核验（2026-10-21）

用户游戏内确认：塔罗背景、点数和花色已显示，原始“闪”的卡名和下部插画仍覆盖其上。本次定向取得官方 `sgsGame_a.sgs` 和 `libs/min/laya_a.sgs`，按已知ZIP方法解包，核对实际卡牌内容层；未重新下载全量配置或素材，未做完整客户端/WASM覆盖验证。

| 来源 | 获取UTC时间 | 原包字节 / SHA-256 |
|---|---|---|
| [官方ES6主程序](https://web.sanguosha.com/220/h5_2/sgsGame_a.sgs) | 2026-10-21 07:38:24 | 5386498 / `e01e94a8c0866067169418488c4834259ee6670ca49936f2014a6d052c98101b` |
| [配套引擎包](https://web.sanguosha.com/220/h5_2/libs/min/laya_a.sgs) | 2026-10-21 07:37:15 | 452271 / `93e54cfa230bf85772fc73d0da5459832d8ebc45e2f71cdc11ef0e4ccfa30cf2` |

原包、来源JSON、解出的主程序和22个引擎脚本当前保存在 `C:/Users/97349/AppData/Local/Temp/xc-tarot-engine-5jmgmo/`。明文主程序23053259字节，SHA-256为 `bb49b68b44ee8732248a310511bf2a88dfe3f080d12433c82762a9dfe31c94d2`。临时目录可被清理；仓库已保存9段相关原生方法、字符偏移、原包URL/获取时间/哈希于 `electron-next/tests/fixtures/card-face-layers-20261021.json`，对应行为检查为 `tests/card-theme-layers.cjs`。

- 普通牌UI为本快照的 `Gqi extends xjt`，`isNewCardUI` 默认true；`SetCardFace -> getCardFaceBaseTexture` 选择 `cardFace_<id>` 或 `cardFace_0` 背景，再执行 `updateNewCardFace`。原牌插画由 `bmpFace2` 单独加载 `face_<ResName>`，基础牌名字由 `bmpNormalName` 加载 `name_<ResName>`；非基础牌另用 `bmpName/bmpNameBg/bmpCardType/bmpSmallDesc`。布局中基础插画通常y=50，存在类型图层时y=28，与用户看到的下部插画残留吻合。10月8日旧快照的单底图路径仍作为旧客户端依据，不能等同本快照的完整结构。
- `updateNewCardFace` 会重新设置六个内容节点的可见性并调用layout，不能只在开关时隐藏一次。`UpdateCardFaceRes` 可直接改插画/名字（本快照有 `face_JunZi_<n>/name_JunZi` 调用）；`UpdateCardFaceOrBackRes` 可强制正反面并隐藏符号，应保留这些显式显示。`resetNewCardFace` 在Clear和扑克切换等路径清空内容层，主题卸载不能恢复已被原生清空的旧层。
- 同时核对原生纹理图元 `CO`（旧快照为 `CSt`）的纹理setter、更新指令与图层可见性，以及首批三个186×260生产PNG的Alpha最小/最大均为255；本问题是独立内容层未接管，不能靠扩大PNG、覆盖选中框或清空全部上层节点解决。
- 已接入的修复仅在匹配且塔罗底图加载成功时隐藏六个原生内容层，保存并恢复各自原生可见性。状态及清理归属见架构表；12项真实摘录方法/模拟检查通过，原主题29项保留，实际DOM/PNG检查增至18项。用户游戏内残留已定位，修复后的完整游戏场景仍待回测；以上资源请求时间不代表固定历史版本。

检索关键词：`分层卡面`、`原始插画叠加`、`isNewCardUI`、`getCardFaceBaseTexture`、`cardFace_0`、`face_Shan`、`name_Shan`、`bmpFace2`、`bmpNormalName`、`UpdateCardFaceRes`、`UpdateCardFaceOrBackRes`、`resetNewCardFace`。

#### 点数 / 花色赋值与自定义图案可行性（2026-10-21，仅调查）

塔罗第一阶段已经实现于 `electron-next/src/features/card-theme.js` 与 `src/adapters/card-theme-client.js`，并装配进主脚本；实施事实及回归见架构表“塔罗牌卡面第一阶段”。用户确定塔罗点数红黑共用13张，原生点数则为红黑各13项；2026-10-21 17:59批次已接入36款底图、完整13个点数及4个花色，空缺仍独立回退。清单内组合的武器范围按底图徽记，不按特殊模式校验；未覆盖的牌、装备槽及特殊显示仍走原生。用户已确认塔罗可以显示，后续分层修复的游戏内效果待回测。

用户曾确认能显示塔罗，但会退回原图。2026-10-21复查10月8日本地主程序快照：`skillCardLabelChange -> UpdateMultiSkill` 是普通牌也会经过的例行链；`IsMultiSkillState=false` 且无 `multiSkillAnimate` 时该方法不重画，不能见调用即恢复主题。`RefreshCardFace` 则只调用 `this.SetCardFace`，不保证经过 `UpdateCardFace`；小抄已有卡背包装器在普通UI原型保存 `__SetCardFace`，后挂父类会被绕过，表现为原生底图与塔罗符号混合。两项已用真实抽取方法复现并修复，挂钩位置、状态判断及29项回归见架构表；源码偏移 `UpdateMultiSkill=17111220`、`RefreshCardFace=10266830` 仍只对该10月8日快照有效，游戏修复效果待回测。

复用上节实际存在的 `sgsGame.main.js`，重新核对 SHA-256 仍为 `f62c194174dd2ff4531bc44a795616b6a51f449a3c7c2bec5270f390da55f245`；这是 2026-10-08 快照的源码结论，不代表已验证最新在线或游戏内效果。小抄核对文件为 `electron-next/resources/daxiaochao.user.js`，未修改运行代码、安装文件、开关或 asar。

- **点数来源与更新**：`sys_playcard.number -> Yx.GetCardById().Number -> NormalCard(L$t).CardInfo` 用 `Number(t.Number)` 同时初始化 `cardNumberOri/cardNumber`。`CardNumber` 是当前值，`CardNumberOri` 保存配置原值；`set CardNumber` 在值变化时发 `Eq.CARD_CHANGE`，`zzt.addCardEvent -> iVi.onCardChange -> UpdateCardFace` 重画。快照确有 `AddCardAvatarSkill` 将当前点数改为 13、失效后恢复 `CardNumberOri` 的分支，所以按牌 ID 重查配置不能代替读取当前模型。
- **底图与符号分层**：`zzt.Card` setter 先换模型及事件，再 `UpdateCardFace`；`iVi.createChildren` 单独建立 `bmpFlower/bmpNumber`。普通刷新先经父类设置 `bmpFace.texture`，随后将 `fwt.GetRes(_q.GetFlowerResName(flower))`、`fwt.GetRes(_q.GetNumberResName(CardNumber,flower))` 分别赋给这两个图元的 `texture`。这两个符号可以单独替换为自定义纹理，无需按每张实体牌制作完整底图，也不需要修改 `CardNumber/CardFlower` 游戏数据。
- **显示花色口径**：原生普通牌使用 `card.IsModyfifyByServer ? card.FlowerOnSeat : card.CardFlower`，恰与 `card.DisplayFlower` getter 一致；`FlowerOnSeat = SuitChange || TransFromFlower(card,seat)` 是有效花色。只按 `FlowerOnSeat` 画所有牌会改变原生展示口径，例如单纯红颜转换不等同服务端改色。字段名 `IsModyfifyByServer` 的拼写来自原源码。

| 普通牌数据 | 纹理键 / 行为 |
|---|---|
| 花色 1 / 2 / 3 / 4 | `heart / diamond / spade / club`，即红桃 / 方块 / 黑桃 / 梅花 |
| 点数 1～13 | `A,2,3,4,5,6,7,8,9,10,J,Q,K` |
| 红桃、方块点数 | `red_A`～`red_K`；如方块 7 为 `red_7` |
| 黑桃、梅花点数 | `black_A`～`black_K`；如黑桃 Q 为 `black_Q` |
| 点数 / 花色为 0 | 对应图元用空纹理，不应画“0”或任意默认花色 |

- **独立的技能显示入口**：`ChangeCardFlowerNumber(cardId,flower,number) -> gameScene -> stackCardContainer.cardUiDict -> ui.ChangeFlowerAndNumber(flower,number)` 直接更新符号及 `change_color_bg`，不写模型点数/花色。快照有 `JOi.CGsRoleSpellOptRepSelRespinse` 按参数显示黑桃 5 / 红桃 5 的实例。包装此入口时应使用调用参数；重新读模型会画回原牌。再次普通 `UpdateCardFace` 会恢复模型数据，不能把一次显示覆盖永久缓存到牌号上。
- **接入建议（尚未实现）**：在现有 `initCardThemeFeature -> installCardThemeRuntime` 所在真实加载链接入独立的符号主题职责，负责资源 Map、启用状态、安装/注销与刷新；可复用现有 `cardUiRegistry` 查询接口，不直接写底图主题内部 Map。普通 `UpdateCardFace` 原调用后按当前模型选择自定义纹理，`ChangeFlowerAndNumber` 原调用后按入参选择；若扩到装备区，还要覆盖 `EquipCardUi(sVi).UpdateCardFace` 的独立实现，不能只挂父类。缺素材回退原生纹理。统一风格需要 26 张点数（红黑各 13）+ 4 张花色；也可以从自定义 atlas 建立这 30 个逻辑项。
- **现有主题与资产边界**：`window.__cardTheme` 主要围绕 `cards/<key>.png`、底图白名单、`baseCardTexMap/miaoCardTexMap` 换图；它不等于已有点数/花色自定义入口。已拆分的 `卡牌归档/卡牌拆分/source/cards.atlas` 111 个条目不含上述 30 个符号键，因此只改 `cards.png` 无法替换这些独立图元。符号所在的官方 atlas 本次未定位、未下载；新增自定义素材不必先取得官方符号原图。全局拦截这些公共资源键还会影响图鉴、奖励等调用方，局部牌 UI 替换范围更明确。
- **布局、场景与清理限制**：`iVi.layout` 对普通大尺寸分支将符号设为 19×17，点数在 `(4,4)`，花色在其下方；非大尺寸为 `ceil(0.8×19)` / `ceil(0.8×17)` 即 16×14，点数 `(3,3)`。这些是 UI 尺寸，不是 PNG 像素；只换高清图片会沿用原生显示大小，若改大小/位置还需协调 `layout`。空牌、无牌清空；不展示原始点数的虚拟牌使用 `virtural_card_<VirtualColor>` 且无点数；`dontUpdateCard` 和 `isPokerCardFace` 提前走独立分支。装备区其他座位用 `other_` 前缀，扑克牌用 `poker_` 资源及独立编码，不能套普通牌规则。`HideFlowerAndNumber`、小抄旧 `CardConfigWindow/pushHandCardUis` 会主动隐藏符号；替换不能强行设为可见。`Clear`/对象池复用、换牌、换局和关闭时需清理自有覆盖；异步回调核对当前 UI/Card 与主题代次，原生包装器保留后装链。
- **验证与回归边界**：`卡牌归档/资料/点数花色调查/verify.cjs` 抽取同快照 `_q/iVi/L$t`，以资源加载器及父类桩验证 63 项：52 种花色点数组合、服务端改色、空牌/零值、虚拟牌、仅 UI 改写及再刷新、扑克牌/禁止重画分支、隐藏状态、布局、模型当前/原始点数和事件、显示/有效花色差异、事件重画、现有图集不含符号。结果及偏移写入相邻 `verification.json`；临时调查文件不属于发布载荷。本次没有实现自定义挂钩或测真实 GPU 纹理加载，不能把这些检查当作新功能已完成。后续需游戏内验证上述入口、装备区、已有卡面/卡背/技能标签兼容及关闭恢复；本次无运行代码回退项。

复查字符偏移：`static GetNumberResName=3103471`、`L$t=11054189`、`iVi=17102901`、`UpdateCardFace=17105233`、`ChangeFlowerAndNumber=17110039`、`layout=17121454`、`Clear=17130276`、`UpdatePokerCardFace=17132531`、`sVi=17134023`；仅对该哈希快照有效。

关键词：`自定义点数`、`自定义花色`、`CardNumberOri`、`DisplayFlower`、`IsModyfifyByServer`、`bmpNumber`、`bmpFlower`、`GetNumberResName`、`red_A`、`black_K`、`ChangeFlowerAndNumber`、`ChangeCardFlowerNumber`、`虚拟牌`、`63项`。

#### 武器攻击范围来源（2026-10-21）

- 复用2026-10-20获取的普通配置`卡牌归档/卡牌拆分/source/junzheng-check/sys_playcard.json`，`abbreviation`明确`h=attRange`；`f=number`为点数，`i=attDistance/j=defDistance`为另外的距离字段。配置文件SHA-256：`5f4511709f238e7f8eb9ea53bdc944509ea0253d7adf9cb39e619c27cdd5ef40`。
- 军争牌ID108寒冰剑：`f=2,g=3,h=2,p=HanBingJian`，即黑桃2、攻击范围2；对应`CardsBook[Model=1,ModelTab=2,cardid=108].dese`开头是“攻击范围：2”，已拆原始`HanBingJian_png.png`图像自身也带“攻击范围 2”。本次没有将`bmpRange`的创建/清空代码当作动态范围显示已验证。
- 军争ID1～161中`type=3,subType=1`有12张实体武器/11种底图；范围数据保存于`卡牌归档/塔罗牌卡面/文字排布样板/weapon-range-source.json`。范围必须按牌ID/模式取值，同名寒冰剑ID2035为1，不能按名称无条件沿用军争2。
- 新样板将寒冰剑名称更正并在右下以黑曜石/金边徽记显示2；仅生成设计素材，未改游戏数据、原始图集或运行代码。长任务规则与用户对赤血刀范围3的覆盖属于设计任务配置，不回写官方配置。

关键词：`武器攻击范围`、`attRange`、`attDistance`、`defDistance`、`寒冰剑`、`HanBingJian`、`右下徽记`、`weapon-range-source.json`。

#### 卡牌拆分与原位合并（2026-10-20，后续实际完成）

2026-10-21 已将原始图集、卡牌拆分、塔罗牌卡面及点数花色调查资料统一迁入[卡牌归档](../卡牌归档/README.md)。图片内容保持不变，合并入口已适配新目录；归档内包含当前卡牌说明摘录。工程工具源码仍在 `tools/card_atlas.py`，交付副本随拆分目录归档。

- **输入匹配与来源**：用户提供的 `cards.png`（现归档于 `卡牌归档/cards.png`），实际为 **2048×4096 RGBA PNG**。本次下载官方 `res/assets/cards/normal/cards.atlas`、同目录 `cards.png` 和 `res/default.res.json`；用户图片与官方下载图片 SHA-256 相同，均为 `14e786fd774fc5a9e1de952ad6a042ec5b87220bf434bc2d8410584eae01c3df`，图集 JSON SHA-256 为 `f4ee16929bce2f4beb04020f87f8e4bdc267942a166bcda63913ace3d3630f15`。下载时间、URL、字节数和哈希已保存到 `卡牌归档/卡牌拆分/source/downloads.json`。上节4096×2048仅是小抄预览旧常量，本次拆分使用匹配的 atlas，未修改小抄预览代码。
- **与 baseCardTexMap 的关系**：本次没有读取游戏内存。使用生成原始纹理缓存的官方 atlas：`meta.prefix=cards/`，例如 `Sha_png.png -> cards/Sha_png.png`；`frames[*].frame` 给出实际裁切矩形。全部111个纹理名对应109个不同矩形，110项为186×260、一项 `DJJ_Zhao_png.png` 为200×282，保留原始尺寸及 `scale/sourceSize/spriteSourceSize`，不按UI尺寸缩小。包括图集内特殊牌、占位图和装饰层，不把111项都宣称为不同实体卡牌。
- **产物与工具**：[卡牌归档/卡牌拆分/README.md](../卡牌归档/卡牌拆分/README.md) 记录用户操作；`cards/` 有111份PNG，`manifest.json` 保存每项原始 atlas 数据、纹理键、文件名、共享坐标和像素哈希；`card-index.csv` 与可搜索的 `preview.html` 方便按名称查找。名称/ID来自此前2026-10-08配置，不能据此认定当前全量牌表。开发工具为 [tools/card_atlas.py](../tools/card_atlas.py)，交付目录保存同内容 `atlas_tool.py`；依赖 `Pillow==13.0.0`，本机安装于工程 `.venv-card-atlas`，开发依赖和资产不是游戏发布载荷，无需加入 `release-files.json`。
- **共享坐标**：`ShuiYanQiJun2_png.png/ShuiYanQiJun_png.png` 共用 `{x:392,y:1880,w:186,h:260}`，`TengJia2_png.png/TengJia_png.png` 共用 `{x:198,y:2148,w:186,h:260}`。合并按矩形分组：只改一份时使用修改后的版本；多份修改但像素相同也可合并；同组不同修改报冲突，不依文件遍历顺序相互覆盖。保持原atlas时共享名必然显示相同内容，若需不同内容，应另做重排及坐标修改。
- **合并行为**：双击 `merge.cmd`，或 `python atlas_tool.py merge --workspace .`，在 `merged/<时间戳>/` 新建 `cards.png/cards.atlas/merge-report.json`。以原图为底按原坐标无mask覆盖RGBA，保留图集外间隔和未编辑像素；atlas逐字节保留。校验原始源文件哈希、每张图存在且尺寸正确；不自动缩放、不覆盖原始素材、不自动装入游戏。工具仅支持已验证的单页无旋转图集，部分交叠会报错。
- **验证**：`roundtrip-verification.json` 确认111份拆分图合回后RGBA字节完全一致，包含透明像素的RGB；整图RGBA SHA-256 `b4fecf571b9806b5ae2dd5cfca12755e57d1ad69321ea316299d55ab3db7ab92`。`tool-verification.json` 记录9项检查：原图往返、单个共享纹理修改及其余像素不变、编辑结果PNG读回/atlas不变、共享冲突、错误尺寸、缺图、真实CMD中文路径入口、真实CMD输出逐像素相同、交付工具与源码一致。已查看拆出的杀卡面；PNG重新编码后文件SHA可能不同，不能将文件字节不同当作像素丢失。未进行游戏内替换测试。
- **范围**：只拆分用户这张 `cards.png`。资源清单另有 `cardsNew.atlas/activityCards.atlas/emptyCard.atlas/sjybEffect.atlas`，本次未将其图片一并下载拆分，也不以运行时 Map 的已加载项证明全部资源完整。
- **按军争归类的已核实入口**：2026-10-08快照 `CardsBookWindow(cQi).createLeftTabSelectBtn` 将 `Model=1` 显示为“身份”；`CARDS_WORD_TAB_LIST=["","应变","军争","标准","排位","五人身份"]`，`onTopTabClick` 按 `ModelTab` 过滤。因此“身份→军争”为 `sys_playcard.CardsBook` 的 `Model=1 && ModelTab=2`。2026-10-20再次获取当前官方 `Config.sgs` 并定向解出 `sys_playcard.sgs`，仍为44条、44种 `res`、`num` 合计161；物理牌ID 1～161的 `(res,color,number)` 多重集合与图鉴 `color` 列表完全一致，包括重复数量。44种均存在于已拆图集。卡面种类、实体牌数量和图集条目数是不同口径，103未在这条映射中得到证实，不通过选入其他模式图片凑数。
- **军争独立文件夹已生成**：[军争卡牌](../卡牌归档/卡牌拆分/军争卡牌/README.md) 直接保存44份同名PNG、`preview.html`、`161张牌对应表.csv`、`卡面清单.csv`、`texture-mapping.json`；每份与原 `cards/` 文件逐字节相同。映射保留图集矩形、scale、共享别名、全部161个牌ID和文件哈希。此目录是独立副本；编辑后复制同名PNG回上一层 `cards/` 再运行原 `merge.cmd`，不会自动同步或覆盖完整图集。未改变工具、游戏源码或发布映射。
- **最新军争配置来源**：获取时间 `2026-10-20T15:37:48.924324+00:00`，官方 `Config.sgs` 4,153,280字节，SHA-256 `9d2b017d7112c1d5999d61b48600945b4139fe237d840a38784623114706de9f`；未保存整包，只保存定向提取的 `卡牌归档/卡牌拆分/source/junzheng-check/sys_playcard.sgs`、解码JSON和 `source.json`。解压明文原始字节SHA-256 `05584b30f7986c06158ee6e47f78417b3d5f1c7fbc61174cfad26e12a5ee64ab`；格式化JSON文件哈希与原始明文哈希不同。身份军争完整映射已核对，没有将44张独立底图描述为103张。

复用命令（仓库根目录；拆分输出目录必须尚无 `cards/manifest.json`，避免覆盖编辑）：

```powershell
& '.\.venv-card-atlas\Scripts\python.exe' -X utf8 tools/card_atlas.py split --atlas 卡牌归档/卡牌拆分/source/cards.atlas --image 卡牌归档/cards.png --out 新拆分目录
& '.\.venv-card-atlas\Scripts\python.exe' -X utf8 tools/card_atlas.py verify --workspace 卡牌归档/卡牌拆分
& '.\.venv-card-atlas\Scripts\python.exe' -X utf8 tools/card_atlas.py merge --workspace 卡牌归档/卡牌拆分
```

关键词：`卡牌拆分`、`图集拆分`、`原位合并`、`baseCardTexMap`、`cards.atlas`、`sharedFrameGroups`、`共享坐标`、`RGBA`、`111`、`109`、`card_atlas.py`、`merge.cmd`、`roundtrip-verification.json`。

## 二、解包数据是什么

2026-08-08 抓取的 OL 客户端快照，解包后得到三类东西：

| 类型 | 内容 | 规模 |
|---|---|---|
| 配置数据 | 活动/商城/武将/礼包/兑换/任务等配置 | 41 个 JSON，约 9.8MB |
| 主程序代码 | 客户端实现（明文 JS，仍有压缩和混淆标识符） | `sgsGame.main.js` 约 26.9MB |
| 引擎与工具 | Laya 引擎全套、协议库、解密类 | `laya.*.min.js` 等 |

一句话：

> **配置 JSON 告诉你「有什么、什么时候开、多少钱」；主程序告诉你「这些功能在代码里是怎么实现的」。**

两者配合，基本可以覆盖大部分功能的开发与排查。

---

# 三、怎么获取解包数据

## 1. 下载并解压全局配置

OL 的全局配置是明文 zip，可以直接下载：

以下为 Bash 命令示例，需要 `curl` 和 `unzip`。Windows PowerShell 中下载可使用 `curl.exe`，解包可使用支持 ZIP 的工具；不要把下载与解包粘成一条命令。

```bash
curl -fL -o Config.sgs "https://web.sanguosha.com/220/h5_2/res/config/Config.sgs"
unzip -o Config.sgs -d Config.sgszip
```


---

## 2. 解密内部 `.sgs` 配置

内部每个 `.sgs` 文件是：

- AES-128-CFB 加密（CFB128，反馈段为 16 字节）
- gzip 压缩

密钥与 IV 编码存在客户端 JS
`sgsGame.main.js` 的 `InitOfb` 中。

### Key

key = 21 51 69 107 85 94 55 120 97 78 63 45 114 101 81 62


### IV

iv = 144 101 62 55 36 70 86 69 35 117 67 33 109 85 97 226


### 解密流程

Node.js 可直接处理原长度密文：

原始 `.sgs` 字节 ↓ `createDecipheriv("aes-128-cfb", key, iv)` ↓ gzip 解压 ↓ JSON

每个文件重新创建解密器，重置为同一个初始 IV。

客户端 `Ofb_Dec` 为适配所用库，会先补零，再解密，最后通过 `SliceUA(h, 0, s)` 裁回原始密文长度 `s`，然后才进入解压。若照客户端方式补零，必须保留裁剪步骤；把补零后多出的解密字节一起交给 gzip 会造成解压错误。本次使用 Node.js 不补零的流程，138/138 个配置均成功解析。


原文提及工具（当前仓库尚未提供，需先补齐）：

ol_decrypt.mjs


例如：

```bash
node ol_decrypt.mjs Config.sgszip/ff_dbs_pay_gift.sgs -o json/ff_dbs_pay_gift.json
```

上述仅为约定的调用示例，不能在工具缺失时直接执行。


---

## 3. 获取主程序 JS

主程序同样可以下载解出。

得到约 **26.9MB** 的明文 JS：

```bash
curl -fL -o sgsGame.sgs "https://web.sanguosha.com/220/h5_2/sgsGame.sgs?v=2026080601"

unzip -o sgsGame.sgs -d sgsGame_zip

mkdir -p code
mv sgsGame_zip/sgsGame.sgs code/sgsGame.main.js
```


> 版本号 `v=...` 会随更新变化。
> 查询参数可访问不等于服务端保留了该日期的历史快照；需要保存抓取时间和文件哈希才能固定分析对象。
> 抓取日期不同，数据会略有差异，建议定期刷新。

---

# 四、解包数据里有什么

## 配置 JSON（41 个）

文件	内容
character.json	武将数据（1612 名，ID↔姓名）
ff_dbs_pay_gift.json	充值礼包/活动总表（762 条，含起止时间）
ff_qifu_new.json / ff_qifu_config.json	祈福活动与掉落池
ff_treasure_new.json	珍宝/夺宝
ff_seckill.json / ff_seckill_new.json	秒杀活动
ff_exchange_new.json	兑换活动
此外还包含其他活动、商城、任务等配置。

五、派生对照表（写脚本时最常用）
从主程序里自动提取的三张表：

这三张表是派生产物，本仓库尚未附带，也未提供生成脚本。应从实际下载的主程序中生成，并记录来源哈希；协议 ID 可能写成科学计数法，提取时不能只匹配十进制整数字面量。类注册表同时包含协议类和 UI 类，查到注册名后仍要确认用途与实例获取方式。

文件	内容	用途
protocol_map.tsv	2450 条协议名 ↔ 数字 ID	排查网络消息
window_class_registry.tsv	5411 个窗口/类注册名	QI.class 解析、挂钩
event_names.tsv	2732 条事件名	确认游戏原生事件
六、这些数据怎么帮写脚本（重点）
1. 协议层：看懂并拦截游戏消息
OL 的所有对战/结算/活动消息都是“协议”。

主程序里常用两套注册：

this.regNewProto(数字ID, "协议名")
this.r("协议名", 类)
其中：

数字 ID ↔ 协议名
消息类型注册
DealXXX 负责对应的消息处理
写脚本时，例如脚本里的：

handleRuntimeEvent
会根据：

msg.className
进行消息分发。

遇到一个看不懂的消息，可以先查：

rg "GsCRoleOptTargetNtf" protocol_map.tsv
然后再去主程序中寻找真实处理逻辑：

rg -o ".{80}GsCRoleOptTargetNtf.{200}" code/sgsGame.main.js
这样就能知道：

这个协议什么时候发
字段是什么
官方怎么处理
脚本应该如何根据消息更新自己的状态
例如：

记牌
牌堆
手牌数
游戏状态
都可以通过分析协议消息来完成。

2. 窗口/类：解决 QI.class('XXX') 解析问题
脚本经常需要拿游戏里的窗口实例或者类来进行挂钩，例如：

QI.class('SelectGeneralWindow')
或者：

patchMethod(原型, "方法", ...)
类名写错或者版本更新改名，都会导致解析失败。

可以使用：

rg "^SelectGeneralWindow|^MailWindow" window_class_registry.tsv
查询真实的类名。

确认原生类名后，再在主程序里搜索该类。

这样就可以进一步查看：

原型方法
按钮回调
属性结构
窗口管理器
挂钩时应该使用的方法
3. 事件：确认事件名真实存在
游戏内很多行为靠事件驱动：

this.event("XXX", ...)
.on("XXX", ...)
写脚本监听事件前，最好先确认事件名是否真实存在。

例如：

rg "^ACTIVITY_SWITCH_TAB|^LOGIN_SUCCESS|^HIDE_ACTIVITY_WIN" event_names.tsv
注意：

脚本自己定义/派发的事件，例如：

SEC_KILL
SET_SEAT_STATE
并不在游戏原生事件表中。

这属于脚本内部事件，查不到是正常的。

4. 活动功能：直接复用官方时间判断
活动类功能，例如：

自动领取
判断是否开放
秒杀倒计时
活动状态判断
最怕脚本自己的时间判断和游戏官方逻辑不一致。

主程序里已经有完整的官方判断函数，可以直接参考：

GetBarDataById
IsOpenActivity
IsInActivityTime
GetIsInServerActivityTimeById
checkActivityStillOpen
例如搜索：

rg -o ".{60}IsInActivityTime.{180}" code/sgsGame.main.js
按照官方逻辑做，可以避免：

脚本显示可以领取，但是游戏实际上已经结束。
5. 官方检测：知己知彼
主程序里有官方的辅助脚本检测函数：

checkUserIsUseXC
相关逻辑包括：

登录成功后 10 秒触发检查
检测 WSGM.SGModule 是否存在于 window
再检查元素 #AC 的 placeholder 是否包含特定标记
对应逻辑类似：

Laya.timer.once(1e4, this, this.checkUserIsUseXC)
如果脚本需要考虑共存/兼容问题，可以研究这段官方实现，确认：

官方检测了什么
检测什么时候执行
检测依赖哪些全局变量
哪些状态是全局标记
6. 座位/卡牌 API：读对局状态
记牌、明牌、手牌数、技能标记等功能，都需要读取游戏座位与卡牌对象。

主程序里这些接口大量存在，可以直接搜索原型和调用位置：

rg -o "HasSkill" code/sgsGame.main.js | head

rg -o "GetStateValue" code/sgsGame.main.js | head

rg -o "SetGeneralSkin" code/sgsGame.main.js | head
常见高频 API（从主程序统计）：

HasSkill          (266)
GetStateValue     (455)
SetGeneralSkin    (43)
seatContainer     (372)
cardContainer     (329)
SelfSeatUi        (43)
gameRoundInfo     (65)
这些 API 可以作为分析游戏对象和对局状态的重要入口。

7. 离线解密：配置解析不用抓包
如果已经有：

ol_decrypt.mjs
并确认 AES 密钥，就可以离线解析配置。

这样可以做一个后台工具：

定时拉取
    ↓
解密
    ↓
摘要
    ↓
对比增量
    ↓
发现新武将 / 新皮肤 / 新活动
脚本加载时直接使用解析后的结果，不必在游戏里逐条读取界面。

七、一套完整排查流程示例
场景：

脚本里“自动领邮件”失效，控制台只有一条协议日志。
可以按照下面的流程排查。

1. 从日志拿到 msg.ClassName
例如：

`<邮件响应名>`（须替换成实际日志中的邮件响应名；`ClientGameRecordInfoRep` 是战绩响应，不能用来代替邮件领取响应）
2. 查协议映射
rg "<邮件响应名>" protocol_map.tsv
拿到协议数字 ID。

3. 在主程序里搜索协议
查看：

什么时候发送
字段结构
官方处理方式
4. 查窗口/类名
例如：

rg "MailWindow|MailManager" window_class_registry.tsv
确认邮件窗口、管理器的真实类名。

5. 对照官方 Deal* 处理逻辑
查看官方对应的：

DealXXX
处理方法。

重点检查：

脚本挂钩的方法是否变化
事件名是否变化
数据结构是否变化
版本更新后类名是否变化
6. 修改脚本
根据官方实际实现修正：

方法名
事件名
类名
参数
数据字段
最后重新测试。

八、常用命令速查
反查协议 ID
rg "GsCUseSpell|10809" protocol_map.tsv
查窗口/类名
rg "^SelectGeneralWindow" window_class_registry.tsv
查事件
rg "^ACTIVITY_SWITCH_TAB|^LOGIN_SUCCESS|^HIDE_ACTIVITY_WIN" event_names.tsv
查 API
rg -o "HasSkill" code/sgsGame.main.js | head

rg -o "GetStateValue" code/sgsGame.main.js | head

rg -o "SetGeneralSkin" code/sgsGame.main.js | head
查活动时间判断
rg -o ".{60}IsInActivityTime.{180}" code/sgsGame.main.js
查协议处理逻辑
rg -o ".{80}GsCRoleOptTargetNtf.{200}" code/sgsGame.main.js
九、核心思路总结
整个数据分析过程可以概括成：

游戏客户端
    │
    ├── 配置 JSON
    │      ├── 活动
    │      ├── 商城
    │      ├── 武将
    │      ├── 礼包
    │      ├── 兑换
    │      └── 任务
    │
    ├── 主程序 JS
    │      ├── 协议处理
    │      ├── UI / Window
    │      ├── Event
    │      ├── API
    │      └── 官方逻辑
    │
    └── 派生索引
           ├── protocol_map.tsv
           ├── window_class_registry.tsv
           └── event_names.tsv
最重要的关系是：

配置解决“有什么”；协议解决“怎么通信”；Window/Class 解决“对象在哪里”；Event 解决“什么时候发生”；主程序解决“官方是怎么实现的”。
把这几部分结合起来，就能大幅提高脚本开发和排查效率。
