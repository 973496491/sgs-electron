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

## 自动任务查询别名定向核验（2026-11-21）

- 用户反馈点击自动领任务未领取。复用已保存的11月10日普通ES6明文，并定向获取当前公开普通 `https://web.sanguosha.com/220/h5_2/sgsGame_a.sgs`；UTC获取时间 `2026-11-21T15:21:34.564326+00:00`。ZIP为5,647,901字节、SHA256 `473b4c67921161a021d1393e4ac80aac735196b7c869c0ddfcc0deb61e8680eb`；ZIP直接解出的JS为24,139,039字节、SHA256 `5e26cc635c4e0cdc2a7ee12d480a0372061cd768ec07ab1d9812ae851b063553`。未下载配置、未涉及AES或WASM `_w`，未发送账号请求。
- 当前 `class $ei` 约字符13093220处，查询 `Z` 约13104205处：先 `this.allTasks.get`，再 `this.ct` 本地配置回退，再 `zhi.I().Z` 新任务回退；旧字面 `GetNoGetTaskDataByTaskID` 已无。领奖 `st` 约13100662处仍包含 `TaskRewardSelectWindow`，新任务委托zhi、旧任务构造gB；`getTaskListFromServer` 约13107181处仍在。符号和偏移仅属于本快照。旧快照查询D内的GetNoGetTaskDataByTaskID被混淆为ct，故依赖旧字面的小抄全任务查询别名失效；单纯GetServerTaskDataByTaskID只查旧缓存，不能替代整个查询。
- 原包来源记录、明文、TaskManager摘录及修前小抄副本临时保存在 `C:/Users/97349/AppData/Local/Temp/xc-task-audit-20261121-f__vel7y/`，本轮已核实存在；仓库持久摘录为 `electron-next/tests/fixtures/auto-task-native-20261121.json`，含来源及旧快照哈希。两个完整原生原型通过真实caller离线核对新Z/st、旧D/J；19项真实入口/原生方法模拟及边界、15项月周卡、26项日志验证通过，修前复现查询别名缺失。实现、状态/生命周期和同步见架构表“自动任务”节、`manualLookupNotes.autoTaskChain`。不将离线适配通过表述为账号奖励已到账。

检索：自动任务查询别名、GetAllTaskDataByTaskID、GetNoGetTaskDataByTaskID、missingMethods、allTasks、constructor、auto-task-native-20261121。

## 节钺令奖励串接定向核验（2026-11-21）

- **2026-11-22现场反馈修正**：用户日志00:56:37 `start/source=button`，00:56:47 `step-error/节钺令奖励/任务奖励回包超时，节钺令留待下次领取`，断点在小抄任务确认前置，尚未发170298，并非本日志证明节钺令协议/资格失效。成功任务原生会派发REWARD_REP，不等于每次提交都一定出现成功事件；尚不确定具体未确认ID及服务端原因。已改为任务先发、有界等确认，未齐记录task-rewards-unconfirmed/taskIds并继续刷新节钺令，仅按刷新后的原生可领状态领奖；未确认仍不记每日完成，不重发任务。节钺令自身状态超时仍不领。没有新下载/解包/协议映射变化，沿用下方原生摘录；31项自动任务、15项月周卡、26项日志检查通过，真实登录/按钮缺任务回包场景修前失败、修后继续查询；未游戏内到账实测。实现/同步见架构表自动任务同日记录。
- **同日追加：局后失败重复触发**：用户01:00:00/10/14日志为game.end重复start/error/finish。问题属于小抄game.end(true)/end(false)清理与完成后再触发策略，不是新的原生协议映射；已在真实game.start状态转换接beginMatch，同局只消费一次局后入口，并给其它失败自动触发加1/2/4/最多5分钟退避，手动立即重试。真实脚本方法摘取模拟复现修前3轮、修后1轮；当前35项自动任务+15项月周卡+26项日志通过。无新下载或解包；状态、接口、清理/回退及实际同步维护于架构表自动任务节与manualLookupNotes.autoTaskChain。

- 用户称“节约令”，同日普通ES6快照中文字确认原名“节钺令”，对应 `NEW_JD_JIEYUE / NewJunDianViewCtrl`。复用上节已核实存在的同哈希明文，不重下载配置或资源、不涉及AES/WASM。原生UI `oneClickDrawAwds` 明确复用 `HasNewJDRewardRed -> ReqDrawAllNewJDRwd`，与旧军典 `HasJDRewardRed -> ReqDrawAllJDRwd` 独立。
- 原生ActivityManager=chi：约13462471处 `SendGetNewJDRewardReq -> 170296({id,is_bp,is_all})`，一键传0/false/true；约13462641处 `SendGetNewJDInfoReq -> 170298({})`。170299普通列表、170306付费列表各分片累计，`type||0=0`尾包提交并派发NEW_JD_INFO_SUC；hadBuyNewJD为真须等待付费列表，不能看到一次共用NEW_JD_INFO_SUC就假定两类均已更新。170297结果0为成功，但本次自动链只记录提交，不统计到账。
- 约13463697处HasNewJDRewardRed按原生活动IsOpen、CurrentNewSeasonMainVo、奖励组、11987201积分阈值、普通已领列表以及已购买档位的付费已领列表决定。约13868911处新任务onOpCompleteTask与旧TaskAward_Response均在更新状态后派发TaskManager.REWARD_REP(id)，可用于“先任务奖励、再节钺令”的顺序；没有请求流水号，不据单个ID事件证明其它轮次全部请求成功。ServerProxy.AddEventListener经GetProtocolNameById映射170299/170306到decodeClientNewJDInfoNtf/decodeClientNewJDBpAwardNtf，既有管理器监听先安装；新增监听不覆盖原链。
- 稳定摘录、协议号及名字映射保存为 `electron-next/tests/fixtures/jieyue-native-20261121.json`（复用上节source哈希/时间）；原方法与真实控制器的30项模拟通过，含免费/付费、慢包/分片尾包、原生新旧任务回包、清理/上下文/异常隔离。相邻月周卡15项、日志26项通过，未发送真实账号请求。实现与实际同步记录见架构表自动任务节，手工索引manualLookupNotes.autoTaskChain；不将模拟或部署当游戏内到账验证。

检索：节约令、节钺令、先任务再节钺令、NEW_JD_JIEYUE、HasNewJDRewardRed、ReqDrawAllNewJDRwd、REWARD_REP、170296、170298、170299、170306、jieyue-native-20261121。

十周年原生座位SK补核（2026-11-21，最新）：用户确认马云騄两款动态已游戏内显示，乐貂蝉两款未动。原生GeneralAvatarSprite.loadSkeleton对ShowFrame使用SmallStandByAnimateInfos首文件或daiji2.sk，区别大图daiji.sk/skel；SmallStandBy VO自动补.sk，轮播首段按索引0播放。乐貂蝉7133801/8133801在线大图daiji.sk为404、daiji/beijing.skel头4.0.56，而座位daiji2.sk为LAYAANIMATION1.6.0，匹配PNG及真实Electron/Laya连续帧变化均通过。已据此将同名官方配对动态候选从103扩到553（103big保留、450seat按需验证），未把旧version快照当在线全集。真实摘录tests/fixtures/ten-year-seat-idle-native-20261118.json，获取哈希tmp/ten-year-userscript-audit-20261120/dynamic-probe/yue-seat-sources.json，步骤、范围和同步见迁移报告17.7；未加载Spine4大图或完整轮播/攻击链。

十周年动态适配补核（2026-11-21）：旧缓存Config.sgs中的GameItemConfig.sgs已复用相同十周年resc/CtrUtil解密，32062条ItemConf；原生包装器及重复解密字节一致。物品RelationSkinItemID明确连接静态/动态，不能用BigResource或ID算术替代。马云騄744001的beijing/daiji/chuchang三个SK及匹配PNG定向GET有效；本机Electron10.4.5+11-16保存的OL core/ani已实际解析/绘制，隔离页连续帧变化与清理回静态通过。首阶段103个SK候选接同名选肤和本人背景/角色待机，非全690动态/动作/语音兼容；源码职责、验收和同步见[迁移报告第17节](十周年皮肤迁移到OL本地链路可行性报告.md#17-十周年sk动态待机接入2026-11-21版本不变)。新解密证据tmp/ten-year-userscript-audit-20261120/decode-dynamic-result.json，资源哈希dynamic-probe/sources.json；未更新OL普通AES方法或宣称当前游戏内实测。

十周年独立分支进度（2026-11-21，仅调查）：沿用户提供的`lkfun.github.io/script/daxiaochao.user.js`的`Es -> GeneralSkinInfoConfig.sgs -> SkinConf`入口，新定向取得官方`/10/pc/libs/min/laya.sgs`（526386字节，SHA256`7430decb6adc1313d120a24086150027177f743f197ea72c5f6b04e903e237a8`），确认`CtrUtil`实际位于包内`laya.core.min.js`末尾。复用11-18缓存resc和配置/主程序，4份配置解密、gzip、JSON和原生封装一致性通过；已取得5435条SkinConf、80套皮肤、动作/语音配置及武将表，主程序解后为ZIP。产物在`tmp/ten-year-userscript-audit-20261120/`，详情/哈希/可复核步骤见[十周年皮肤读取调查](十周年皮肤读取调查.md)最新节。不是使用本文普通AES Key/IV，也不表示下文OL `_w`分支、完整资源归档或游戏内效果已通过；没有运行代码改动或部署。

## 武将评分 / 强度评分定向核查（2026-11-19，仅调查）

曹金玉/谋周瑜缺项复核（2026-11-20，仅调查）：定向读取官方普通`res/config/Config.sgs`，UTC`2026-11-19T17:16:35.651853+00:00`，4547800字节、ZIP SHA256`b98d30f9b30ef6f092510d098ae6d87fbfc73771bef3d21dbad8ceddb3bcac65`；只保留character密文、按既有普通AES-CFB/gzip解出的JSON和source/result，未保留整包，也未处理_w。character密文SHA256`d2f064c7312f96fec5dae08aaffac210aa5356cd938f033b81ef4993554253d0`、JSON`646ad9b8fea6e56e81717b2bb46199ec3f818b4c0fd8c6c0d82690594d165efb`，与11月19日本地快照相同。基础表1651行中有740/CaoJinYu、770/MouZhouYu，565条CharGrade均无这两个ID；实际adapter在九种评分维度都返回general-missing，0为缺项占位，不是只少军八分数或名字查错。证据`tmp/ol-general-rating-audit/missing-generals-20261120/`，详见架构表及评分调查报告同名节；未尝试账号补分请求、未改运行代码或部署，不能断言原生服务端也无分。

2026-11-20上下文访问修复：用户真实日志已证明565行评分和候选读取成功，失败在门面GameContext返回undefined；不是评分配置未解出。定向读取普通ES6 `https://web.sanguosha.com/220/h5_2/sgsGame_a.sgs`，UTC `2026-11-19T16:46:01.210351+00:00`，ZIP SHA256 `473b4c67921161a021d1393e4ac80aac735196b7c869c0ddfcc0deb61e8680eb`，明文24139039字节、SHA256 `5e26cc635c4e0cdc2a7ee12d480a0372061cd768ec07ab1d9812ae851b063553`；ZIP直解，不涉及配置AES或WASM。已保存`tmp/ol-general-rating-audit/native-20261120/{main.sgs,main.js,source.json}`。新鲜明文仍有GameContext=Zni导出（字符5919623附近）和GetModeType/GetGroupID，不能把当前页面的门面失败推断成整个官方删除出口。

同快照核对qCs.InitUI的身份条件建立figurePart、this.manager=CurrentScene.Manager及ShowGenerals的this.selfFigure=SelfSeat.Figure；pti.SelfSeat/Seats getter已归档到selection-ratings-native fixture。修复adapter独立检查引擎出口，出口均缺时用有明确模式证据的选将窗口及其身份读取评分，不改全局GameContext或原生对象。共有主公杀/斗地主窗口须以身份面板区分；本地普通Config中mode148/149/154为gameMode33，与身份RULE_SHENFEN=1不同，本轮仅用于核验条件而非运行期硬编码。30组专项包含修前全0复现及修后按角色恢复，未游戏内复测，详情/同步见架构表“全0现场定位与上下文访问修复”。

2026-11-20全0现场诊断追加：不下载新包，复查小抄真实loadConfig_w可见评分导出晚于整包Promise.all与后续整理。真实k函数隔离故障注入可复现“character已解出但其他配置失败导致未导出”，只证明这种路径可能存在，不确认用户军八/斗地主的全0原因。已加入generalGradeLoadState阶段/条数/字段名/有限错误观察和debug-open即时快照；下载、解密、导出和取分语义保持，未套用普通AES解密_w、未补发游戏请求。当前实现/23组验证与部署见架构表“军八/斗地主全0诊断”。

2026-11-20实现追加：现有小抄第一IIFE的`XC.loadConfig_w(k)`早已通过JSZip、当前`CtrUtil.Ctr.Ofb_Dec`和Zlib解析`character.sgs`；本轮仅在其现有Object.assign(w,...)保留`WuJiangs.CharGrade -> XC.initMap.generalGrades`，供选将评分adapter读取，无新增下载、密钥或WASM解包流程，也未把普通配置AES方法套用于_w。不是直接取得原生aMt实例，尚未接其服务端评分缓存补缺。卡下N/10、缺分0/10、无UI开关的验证版及14组真实摘录/配置导出检查、隔离Laya显示/同步记录见架构表“选将评分验证版”；下文原生调查与缺口保留历史范围，未游戏内实测。

复用已核实存在的11月18日普通ES6明文 `C:/Users/97349/AppData/Local/Temp/xc-load-audit-c_7em4my/main/sgsGame_a.sgs`（SHA256 `62158152c88b48edfb468a46c609061532d7fb1722a890c82f91d57dbeeddbc7`），以及本地 `tmp/ol-lamp/Config.sgs`（SHA256 `5e4ca84f6c742e1a631978119efe664b6bdf04e1a75e1c817a22bc80373854e0`）。原包character密文与已提取文件相同；按本文普通AES-CFB/gzip参数再次解析，与本地character.json语义一致（文件SHA256 `646ad9b8fea6e56e81717b2bb46199ec3f818b4c0fd8c6c0d82690594d165efb`）。没有新下载、完整解包、WASM或账号接口操作。

配置 `WuJiangs.CharGrade` 含565个ID、0～10分整数，`CharTips`有9种模式/身份说明。主程序 `initGeneralCharGrades`先配置后缓存补缺，106017响应的 `SetGeneralsCharGrade`把九项/10后只补不存在的ID；详情 `showPingding -> ShowPingdingInfo -> GetGeneralCharGrade -> fe -> Czt -> k_i` 展示“强度评分”。106016/106017批量实现与170023/170024单条定义存在，但GetGeneralCharGrade不发请求，批量请求只发现方法定义，不能声称缺项自动在线补齐。仅找到既有评分及显示处理，没有找到基础分数生成算法。详情、样例和来源边界见 [武将评分逻辑调查](武将评分逻辑调查.md)，架构表同名节与 `manualLookupNotes.generalStrengthRating`；工作文件 `tmp/ol-general-rating-audit/` 的5组离线解密/真实摘录检查通过，未游戏内实测，无运行代码变更或同步。

选将评分显示后续核查（同日，仅报告）：复用同哈希主程序，无新下载。普通qCs/l4i、排位XLs/rSs及另一注册新版rLs/Cai为不同入口，Card setter/换将/SP替换链和模式身份字段可定位；普通双排7px、新排位15px不足以无条件增加独立文字行。aMt无已确认全局导出或现有小抄门面，GameGeneralManager=nhi不可混用，当前运行评分数据适配尚未接通。可实现卡下显示，但不能以离线表或最高分冒充当前身份实时分数。详见 [选将界面武将评分显示可行性报告](选将界面武将评分显示可行性报告.md) 与架构表同名小节；9项只读源码结构核对通过，不是界面/运行期验收，未改功能代码或部署。

## 出牌读秒 / 原生计时条核查（2026-11-19）

复用已核验存在的11月18日普通ES6明文 `C:/Users/97349/AppData/Local/Temp/xc-load-audit-c_7em4my/main/sgsGame_a.sgs`，SHA256 `62158152c88b48edfb468a46c609061532d7fb1722a890c82f91d57dbeeddbc7`；无新下载、解密或 `_w` 调查。原生注册 `GamePopUpWindow=Dgs`（注册字符偏移420193、类22005087），`ShowCountdownTimer` 创建 `T4i@18692666 extends Isi@12536693`；`Isi.onUpdate@12543401` 计算并写入 RemainValue，普通本人/他人计时分别 new T4i / new Isi，共用该方法。`ShowCountdown` 通过 Laya.Handler 捕获方法引用，事后改原型不能更新旧Handler；储备时间用 `onReserveTimeUpdata` 更新动画位置，不经过 onUpdate，也不维护 RemainValue。

`qi._ -> qi.r -> MOt.J -> Laya.ClassUtils.regClass` 仍为原生注册链，本轮未发现注册改为不可用私有表；不因 `qi.r`/`MOt.J` 混淆名称误判旧 `ClassUtils.getInstance` 已废弃。小抄数字控件却是门面 `laya.class("SgsSpriteFilterBtn") -> scene.topMenu.backBtn.constructor` 的推断结果，缺场景依赖时可失败。真实计时类摘录与主脚本挂钩/get/redefine 的7组隔离检查证明一次性安装失败不恢复、控件缺失抛错、关闭残留及储备时间漏更，不能唯一确认当前游戏现场是哪条失败路径。初轮偏好落盘true、工程/部署读秒区块相同、无保存的 XC_LAST_ERROR，未访问当前页面内存或修改运行文件。随后按用户要求仅加现场诊断日志，仍待日志后修复，详见架构表“出牌读秒链路核查与诊断日志”；没有新原生下载或解包。证据目录 `C:/Users/97349/AppData/Local/Temp/xc-play-countdown-audit-r7of15/`，手工索引 `manualLookupNotes.playCountdown`。

## 小抄不加载 / SystemContext 导出缺失（2026-11-18）

- 定向获取官方 `https://web.sanguosha.com/220/h5_2/sgsGame_a.sgs`，UTC `2026-11-18T14:19:54.712682+00:00`，5,647,897字节，ZIP SHA256 `437f4a4540d8ae7ae0551a04f41168def85689d2a81c7b6eb6e510ded8f942a8`；按普通ZIP解出明文，无配置解密或WASM操作。临时证据目录 `C:/Users/97349/AppData/Local/Temp/xc-load-audit-c_7em4my/`。配套公开libs/after.js为29,952字节，SHA256 `99f1799a8cfc14d12c4c4deed9ed3ec438cd1016c3cde07c5c1a1fd7fafca773`。
- 对照仍存在的11月10日明文：原 `regWindowclass(){Laya.Browser.window.ChannelUtils=Y2t,Laya.Browser.window.SystemContext=cAt}` 变为 `regWindowclass(){Laya.Browser.window.ChannelUtils=qni}`；当前内部尺寸类 `_kt` 仍存在（字符偏移5066785附近）。这解释依赖全局SystemContext的小抄Init一直等待；不证明当前运行页面仅此一处异常。本轮未连接在线账号、未取得当前页面运行状态。
- 用户新增.js的尺寸计算与当天 `_kt.UpdateGameSize/updateGameAdaptation` 在720组对照中一致；补丁后部署原始Init进入initFrame，补丁前等待。随后按用户要求实现有启动/停止责任的兼容控制器；原生类摘录及差分测试固化在仓库tests/fixtures/system-context-native-20261118.json与tests/system-context-compat.cjs，11项通过。实现、生命周期、实际同步与回退见架构表同名节；未游戏内实测。


## OL互通皮肤Tab / 原生开窗入口核查（2026-11-19）

复用已核验存在的11月18日明文 `C:/Users/97349/AppData/Local/Temp/xc-load-audit-c_7em4my/main/sgsGame_a.sgs`，SHA256 `62158152c88b48edfb468a46c609061532d7fb1722a890c82f91d57dbeeddbc7`，不重新下载/解密，不涉及十周年或 `_w`。`B9t.GetWindow@11486561` 返回后调用者才Show；资源未齐时Show保存args，`xsi.loadResComplete -> Init -> enterWindow`。所以GetWindow返回时安装实例enterWindow钩子，在原生UpdateInfo/列表初始化之前建分页即可覆盖首次、异步资源和重开，无须巡检/扫树/重试/Show双入口。

`nqt@9744028` 在卡片on时捕获itemClick，`tTs@22835861` Init捕获Close；选择链仍为itemClick置clickCheck -> CLOSE -> Close/AutoReclaim -> destroy中closeSelectSure。分页只替换取数与尺寸/空列表关闭分支，不重写选肤提交。Tab保持同一精灵，切页只改样式/加载区，尺寸不变不重复initBg触发resize/动画。真实管理器GetWindow、窗口enterWindow、视图UpdateInfo及资源loadResComplete等方法已加入 `tests/fixtures/native-skin-tabs-20261118.json`；39组原生摘录+模拟通过，修改前模块在禁止补挂定时器/稳定Tab/快速同将重开三项失败。职责、生命周期和同步见架构表“开窗入口收敛”；尚未游戏内实测。

局内入口补核（用户反馈无Tab）：同快照 `regWindowclass` 实际映射ChangeSkinWindow=ahs@21049773、SelectSkinWindow=tTs@22835861、ModifyShowSkinWindow=vps@22552827；`Ugs.onSKinClick@22057523` 明确从座位主/副将GeneralId/General2Id打开ChangeSkinWindow。旧可行性报告把ahs误当旧实现，导致运行白名单与39组测试都漏了局内窗。已校正文档/白名单，夹具加入真实注册、ahs方法和座位按钮；修前第40组复现无Tab，修后42组通过，未游戏内实测。无新增解包流程/下载/十周年链路。

同日组合复核：皮肤Tab列表/原生close通过并不证明本地选择已登记。既有localSkin bootstrap只挂首个picker原型，其他入口的view可能缺views WeakMap owner；真实主脚本+原生响应消费模拟复现“选择后关窗仍默认”。已通过prepareView -> state.bindSelectView同步登记每个原生视图，详见架构表/互通文档“新视图漏登记”，8个组合场景通过，仍未游戏内实测，无新客户端下载/协议解包或十周年改动。

## 本地皮肤首次打开 / 原生条目权限核查（2026-11-16）

复用已核验存在的11月10日普通ES6明文 `C:/Users/97349/AppData/Local/Temp/xc-new-cards-audit-phdf4rol/sgsGame_a.sgs`，SHA256 `52e27bc74779059a3d2e075755c6e11ed9a9d31d83e482f588a323aadb835f63`，未下载或解密新包，不涉及 `_w`。`KPt.InitBaseData`（字符偏移7106669附近）把传入持有状态写入 `hasSkin/bg.mouseEnabled/blackbg.visible`，`HasSkin` getter直接返回hasSkin；选择视图 `itemClick`（7097730附近）在 `!item.HasSkin` 时提前返回。偏移仅对该快照有效，方法源码已固化 `electron-next/tests/fixtures/local-skin-native-20261110.json`，无需依赖临时明文才能运行测试。

小抄首次发现窗口后只安装后续初始化钩子，漏补当前实例，解释再次打开才生效；修复及职责/状态/回归/部署见代码架构表“首次打开需重开修复”，索引 `manualLookupNotes.localSkinFirstOpen`。17项真实摘录与启动/发送链模拟及19项乱序响应/默认隔离模拟通过，未游戏内实测，不证明服务端赋予皮肤所有权或所有玩法可用。

补充同快照：原生场景 `generalSkinUpdateRep`（9004685附近）遍历GeneralSkinList，按ClientID（Type5按座位号）匹配玩家，再 `SetGeneralSkin`；不存在“后到响应自动尊重本地选择”的保护。`sA`（1187940附近）的IsDynamic由state===1派生。`GetSelfUsingSkinID/SaveUsingSkinID`（8201639）是已用皮肤缓存，响应会更新它，不能在本地改写之后才当真实默认读取；`SendClientGeneralSkinReq`（8202150）将传入SkinID/State写入SkinItem。选择视图 `closeSelectSure`（7099935）按真实场景走原生请求选路，上述场景消费/选择提交/请求构造方法已补同一fixture，测试中的对应验证使用真实摘录（当前测试总计17+19=36个场景/行为组），而非仅比较自建请求对象。实现保存入站改写前值并在发送边界临时使用真实默认；无默认0。未实发请求，未游戏内验证。关键词：回传默认皮肤、真实皮肤覆盖、serverDefaults、SkinItem.State。

动态丢失追加核查：同快照KPt.InitData（710万附近）在未拥有且非共享、非免费场景不设置dynamicState，条目默认0；`canUpdateDynamic`（4231236）仅查皮肤配置IsChuChangOnlyDySkin/IsClenitDynamic/skinlevel/CanUpdate，与账号持有没有等价关系。方法已补入同一native fixture。本地解锁需单独按配置和真实持有查询补动态状态，不能把原生未拥有条目0当作用户静态偏好；已有/共享偏好仍保留。新增6组动态检查对旧部署镜像复现失败，修后23+19=42组通过；修复/部署/回归见架构表“动态丢失修复”，未游戏内复测。

## 本地壁纸 / SgsFlatImage纹理加载核查（2026-11-16）

2026-11-17用户在最终普通Graphics绘图版本同步后确认“有了”，已确认本地壁纸可见。下文关于“当前游戏空白/未验收”的叙述保留为当时排查记录；本次未证明特定GPU或滤镜内部根因，最终实现和验收见架构表“游戏内验收”。

现场显示链补充：用户完整日志证实壁纸经原生_qt连Stage且全部visible/alpha正常。已从同一明文追加 `hj/A$t/y$t/GD/bD/UZt/_qt` 到wallpaper-native fixture（不是手写重建父类），按Stage3492×2043、背景层width/height0、scale2.618556701、偏移y11、游戏1333.333×766.667复测，旧路径仍可画，不能把零尺寸当成已证实裁切故障。当前本地节点采用普通Graphics命令并去掉滤镜缓存；实际游戏空白仍须结合新增“背景与舞台像素”诊断，不把新的隔离渲染通过解释为已复现根因。

宿主本地资源入口补充：已核对 `F:/Game/SGSOL/resources/app/interceptor.js` 存在 `protocol.registerFileProtocol('myprotocol')`，处理路径为 `request.url.substr(12) -> path.join(__dirname,url)`，原卡面/壁纸编号图使用该入口。当前本地壁纸缓存接到app根的local-wallpapers并用同款协议读取，回退仍从缓存字节解码。已在隔离Electron10.4.5的HTTPS来源页验证该协议和真实Laya绘制用户1920px JPEG；不是仅file://页面验证，也未修改宿主协议处理器或编号原图。用户实际日志只证明parent/texture=true，后续“完整显示链”诊断才可确认stage连接、父层visible/alpha；目录限制尚非已证实根因。详见架构表“当前缓存位置 / 原生资源协议”。

同日二次排查补充：旧小抄静态图片适配并非总能取得p$t。`laya.class("SgsFlatImage")` 的局内优先链为 `SelfSeatUi.getEffectType(4).constructor`，而本快照 `ResType_Spine=3/ResType_Spine_AllBig=4`，getEffectType对3/4返回uO（Spine动画），其它值返回E$t。这条链不能作为静态图片类证据，方法已补入同一native fixture。当前本地壁纸直接使用Laya.Sprite挂BackgroundLayer并赋Texture，保留原生场景层次和遮罩，详见架构表“当前渲染链 / 二次局内修复”；完整背景树中的遮挡、隐藏/恢复和真实JPEG像素通过隔离Electron/Laya验证，不把单张Texture的离屏绘制等同于当前游戏可见。

复用已确认存在的11月10日ES6明文 `C:/Users/97349/AppData/Local/Temp/xc-new-cards-audit-phdf4rol/sgsGame_a.sgs`（SHA256 `52e27bc74779059a3d2e075755c6e11ed9a9d31d83e482f588a323aadb835f63`），核实 `p$t.skin/loadImage -> mNt.GetResByUrl`（字符偏移9968561/5163373）：不含 `://` 的Data URL被当作相对路径，经配置 `getResourceUrl` 添加 `res/`，无法成为有效壁纸。原生类及两段资源解析方法已固化到 `electron-next/tests/fixtures/wallpaper-native-20261110.json`，不是仅靠模拟猜测。

本次仅定向取得普通官方 `libs/min/laya_a.sgs`，ZIP SHA256 `ca0c4517cba02ae77ac758ce0f6c23e6b7601b6cd7616e050e258e39e7ff84db`，22个JS及source.json位于已核验目录 `C:/Users/97349/AppData/Local/Temp/xc-wallpaper-laya-xvz5io89`。不涉及AES配置或 `_w` 分支，不更新完整归档结论。`Laya.loader.load(data,Handler,null,Laya.Loader.IMAGE)` 可直接产生真实Texture，赋给 `SgsFlatImage.texture` 时应清空skin，业务负责复用/释放，不能只依赖普通Image成功判定游戏渲染成功。实际Electron10.4.5隔离验证1px PNG及用户缓存1440px JPEG：真实Laya.drawToCanvas读回alpha=255、原字节一致；原生父类及游戏背景层仍为测试替身，当前对局效果待用户验证。实现与部署见架构表“局内未替换修复”，不再重复下载包做同一映射调查。

## 许劭世论 / 评鉴棋盘定向核查（2026-11-13，仅调查）

后续已实现“许劭辅助”，用户最新要求改为只读连线提示、允许拖动，自动提交链路和方式/延时设置已移除。当前行为与34项浏览器/显示验证见架构表“许劭辅助：只读连线提示与可拖动面板”；下文“未改代码”仅描述最初调查。运行时通过WindowInstanceDict或laya.win只读定位已有窗口，不能使用可能构造弹窗的GetWindowByName；官方快照约5136890处明确暴露Laya.Browser.window.GameContext。79项XSPJ+技能名内嵌adapter，今后增删需更新；归档原生源码保存在tests/fixtures/xushao-native-20261110.json作为构造数据与不调用原生操作的验证依据。

- 2026-11-14闪动修复：原UpdateUI(4)辅助高亮与native type5来回切换会重复启动playInEff；已改为静态字色，不改ui.type。鸡蛋分支通过仅对齐preHideIds渲染缓存跳过新建/播放，窗口playEggEff/onEggEffStoped有效期内不再排Tween/计时器。帮助格playGrayEff和仅帮助来源的playMultiGridEff被拦截，保留changeData/帮助结果/选中完成显示/真实获得技能的播放，不屏蔽协议；旧alpha隐藏作为接管前回调的兜底。34项真实原生摘录/浏览器检查含连续100次刷新、零新Tween和延迟任务通过；未游戏内验证卡顿已完全消失。详见架构表“静态高亮与闪动修复/鸡蛋与帮助表现拦截”。

- 原生高亮补充：同一快照 `P3t` 字符偏移11806376，`UpdateUI(4)` 为蓝色起始格提示（字色#60C5FF），1/2/3/5分别为已完成/选中/帮助/普通。已复用到所有可连横竖组合的格子，并保留选中/完成优先、帮助底纹和遮挡可见性，关闭时按当前原生状态释放显示租约。P3t源码已补入同一native fixture的cell字段，未重新下载资源。没有调用原生连线或发协议，详见架构表“复用原生格子高亮”。

- 用户指定带棋盘的许劭技能，已核实 `757/XuShao -> 3911/世论/ShiLun -> PingJianWindow` 六行六列文字连线界面，相邻技能为 `3912/濯名/ZhuoMing`。本次不是“评荐”旧名推断；配置明确把3911的效果称为“评鉴”。配置词库 `cha_spellextend.XSPJ` 共79项，记录战功词条ID、文字、获得技能ID和triggerID；棋盘初始化Params直接下发主词条起止位置和词条ID，另有干扰字，Param用于随机铺底。选中后 `CGsRoleSpellOptRep(3911,Type=0,Datas=[begin,end])` 提交；`Type=82/OPT_PINGJIAN_DATAS` 回到窗口更新成功/帮助/遮挡结果。开窗操作与增量通知是两条入口，不能把82当作开窗Type。
- 复用仍存在的11月10日ES6明文 `C:/Users/97349/AppData/Local/Temp/xc-new-cards-audit-phdf4rol/sgsGame_a.sgs`，SHA256 `52e27bc74779059a3d2e075755c6e11ed9a9d31d83e482f588a323aadb835f63`。字符偏移：`Pai/ShiLun=14805096`、`Zds/PingJianWindow=22086840`、`y1t/CGsRoleSpellOptRep=11396297`、`AW=2623528`、`Jds=22086397`、`Pg=1025661`、`optPingJianDatasFunc=1641849`；符号和偏移仅对该快照有效，不作运行时类名依赖。
- 定向取得普通 [Config.sgs](https://web.sanguosha.com/220/h5_2/res/config/Config.sgs)，UTC `2026-11-13T11:32:39.485758+00:00`，4,179,564字节，SHA256 `d694fc743b205d99518c267dbe8e1bbdc1995672f44ca04dab3bbdde8a4489b9`；只保留 `character/cha_spell/cha_spellextend/sys_h5_text` 四份密文与AES-CFB/gzip解码JSON，均解析成功。来源记录、查询脚本和原生类摘录在 `C:/Users/97349/AppData/Local/Temp/xc-xushao-audit-20261113/`；临时目录可清理，不作为仓库必需工具。没有涉及WASM `_w`、全量素材或账号接口；新配置与11月10日主程序为不同日期快照，不宣称已验证当前在线完整行为。
- 调用链、Params/Datas布局、帮助/妨碍、状态归属与清理细节见 [代码架构表](代码架构表.md)“许劭世论 / 评鉴棋盘”，手工索引 `manualLookupNotes.xuShaoPingJianBoard`。本次未改userscript、未注入/同步运行环境、未生成asar、未发游戏操作；未取得实战开窗Type，也未追完获得技能后的座位模型增删链。

- 后续按用户“只考虑横竖、不改代码”要求核对可行性：可复用原生拖动方法/选择检查生成端点提交，也可只读当前棋盘与XSPJ/cha_spell列出可连技能、词条和横竖格序。候选须排除已完成或被覆盖区间，区分帮助/遮挡状态，识别阶段不得调用可能发送请求的checkSelectIds。原生onItemClick为空；遮挡只隐藏文字，本地未显式禁选，不推断服务端接受结果。上述临时目录新增 `verify-board.cjs/board-verification.json`，抽取真实原生方法、拦截发送的14项离线模拟通过；不含游戏内验证，未改任何运行代码。完整操作门槛、状态刷新与验证范围见架构表“棋盘操作可行性 / 可连技能识别（横竖限定）”。

关键词：许劭、世论、评鉴、棋盘、濯名、757、3911、3912、PingJianWindow、XSPJ、OPT_PINGJIAN_DATAS、108016、棋盘操作可行性、可连技能识别、横竖限定。

## 新月卡 / 新周卡定向核查（2026-11-10，仅调查）

同日后续已按用户要求把自动月卡迁移到新协议，原生查询结论保持本节快照范围；实际控制器/caller接入、旧协议废弃、生命周期与验证见架构表“新月卡 / 新周卡领取链路与自动月卡迁移”及manualLookupNotes.newMonthWeekCards。以下“未改运行代码/旧WelfareManger”只描述最初调查阶段，不表示后续未实施。

- 先复用仍存在的11月4日ES6快照定位，再定向取得当前公开普通 `sgsGame_a.sgs` 与 `res/config/Config.sgs`，未涉及 `_w`、全量素材或账号接口。当前明文保存于 `C:/Users/97349/AppData/Local/Temp/xc-new-cards-audit-phdf4rol/sgsGame_a.sgs`，原主程序ZIP SHA256 `f82d928b09a43a82082e0d06dba259e08800c3a46b100d00168c24faa92bc16d`、5,406,286字节，明文SHA256 `52e27bc74779059a3d2e075755c6e11ed9a9d31d83e482f588a323aadb835f63`。实际UTC获取时间见该目录 `main-source.json`，北京时间为11月10日。
- 普通Config获取UTC `2026-11-09T16:41:09.686642+00:00`，4,174,318字节、SHA256 `e4a9109f1efe72a74f28e0e04856764702f53b8bdadc404395254993b2f87aeb`，二次读取哈希一致；仅保留 `ff_dbs_pay_gift/sys_h5_task/sys_h5_quest` 密文与按本文AES-CFB/gzip解出的JSON，不保留全包。`source.json`初次提取记录为前两份，`sys_h5_quest`为同哈希二次读取补提取。
- 已核实 `NEW_PRIVILEGE=79 -> NewWelfarePrivilegeViewCtrl(j2t) -> jNt -> $Nt -> N0t` 新特权卡链；配置 `new_card_content` 月卡 `ID=1/goodsId=12980101`、周卡 `ID=2/goodsId=12980201`。`160118/160119`查询状态，`160120({card_id})/160121`领取每日奖励，`160122`激活通知；周卡附加任务为58538“周卡每日奖励”，走TaskManager.D/J，与卡每日领奖协议独立。小抄 `yueka` 仍调用旧WelfareManger链。详细字段、门槛、状态所有权、生命周期、回查防重复与接入缺项见架构表同名章节、`manualLookupNotes.newMonthWeekCards`。
- 本次主程序字符偏移：`N0t=11028140`、`SendNewPrivilegeCardDailyRewardReq=11030173`、`jNt=5478740`、`$Nt=5484964`、`oY=2767268`、`j2t=11650313`、`initNewCardData=2300990`、卡状态解码 `Ont=3646404`；仅对本次明文有效。相关类摘录保存在该临时目录，临时文件可能清理；并非仓库附带的通用工具。未改运行代码、安装文件、开关、版本或asar，未发账号请求、未游戏内实测。

抽取当前真实N0t方法的9项隔离模拟通过，报告保存于上述临时目录verification.json，覆盖激活/到期、服务器日期、协议参数、成功事件与清理；依赖桩不代表真实账号或游戏内验证。彩虹表语法通过，三份文档相关关键词已用rg核对。

关键词：新月卡、新周卡、新特权卡、new_card_content、NewWelfarePrivilegeViewCtrl、160118、160120、58538、card_id、goodsId。

## 充消返利Node定向核查（2026-11-09，仅调查）

- 范围为用户所称“冲消返利”，沿 `WelfareRebateActivityView -> GetRebateActivityListType -> GetQuest -> TaskManager.D/J` 核对一键领取，不扩展其它活动。复用仍存在的11月4日ES6明文 `C:/Users/97349/AppData/Local/Temp/xc-faction-check-wnk21qd9/sgsGame_a.sgs`：返利类型 `REBATE_NEW/2/3=39/49/50`；`GetTaskItemType=10305788`，新任务 `TaskRewardItem=11397484`，返利视图 `13581998`，领取 `J=10409883`，字符偏移只对本快照有效。
- 旧临时Config.sgs已缺失，本次定向读取官方普通 `https://web.sanguosha.com/220/h5_2/res/config/Config.sgs`，抓取时间 `2026-11-08T16:59:35.412293+00:00`（北京时间11月9日00:59），SHA256 `68d0e2eb7e3bdbbb8a1b451a20298904488762a397bbf0333d07ccfbc7444a90`。两次读取包哈希一致，仅提取 `sys_h5_task.sgs/sys_h5_quest.sgs/sys_gs_dbs_fs_goodsbaseinfo.sgs`，按本文普通AES-CFB/gzip解析；另定向解析h5_global_conf，但其中未检出“充消返利”标签，未以此证明当前页面按钮文案。没有涉及 `_w`，没有重新归档全客户端。
- 当前期11月7～14日返利任务Node1001“充值福利”、1005“消费福利”，40条有配置任务；1363801原始道具字段 `a=1363801,b=通用抵价券（满7000抵2000）`。原生getter将 `Rewards/Count` 和 `ExtraRewards` 合并为 `TaskRewardItem`，小抄按奖励道具名含“抵价券”跳过整项任务，含附加券的11项均被隔离。与主脚本真实控制器及原生getter/任务类型方法抽取合用公开配置模拟，11项不提交、其余29项在统一CanAward=true且无持有阻挡假设下提交；不证明账号已满足条件或实际到账。任务号及完整边界见架构表同名补充。
- 临时目录 `C:/Users/97349/AppData/Local/Temp/xc-rebate-audit-4us0o7bg/` 保存定向密文/JSON、source.json、coupon-goods.json与verification.json；模拟脚本仅本轮内存执行，未声称已落地可复用工具。主程序较配置早5天，是静态跨快照核对，未运行当前在线UI或发送账号请求。无运行脚本、配置开关、asar或安装文件修改。

## 非国战场上势力数核验（2026-11-04，仅调查）

此前临时目录仍存在，但其中主程序文件已缺失；本次仅定向下载 `https://web.sanguosha.com/220/h5_2/sgsGame_a.sgs`，按普通 ZIP 解出 `sgsGame_a.sgs` 明文 JS，无需配置 AES 解密，也未涉及 `_w` WASM 分支。抓取时间为 `2026-11-03T16:09:26Z`（北京时间11月4日00:09），原包 SHA-256 为 `c4843fbdc49adfa966688112fc9b5a82884e543b9ed6605d616bd3a86734842f`；解出文件本次位于 `C:/Users/97349/AppData/Local/Temp/xc-faction-check-wnk21qd9/sgsGame_a.sgs`。临时文件可被清理，使用前需重新确认存在。

已核实原生 `V2t.CountryCount()` 按 `IsLegalOperable` 座位的当前 `Country` 去重，死亡链为 `ServerProxy_Dead -> seat.Dead -> IsDead=true -> qk.DEAD`，开局原生 `gameStartTurn` 派发 `GAME_START_TURN`。关键字符偏移：`CountryCount=11541083`、`ServerProxy_Dead=9060626`、`IsLegalOperable=20779228`、`IsDead=20803180`、座位 `Country=20830839`；符号及偏移只适用于本快照。`Country` 会考虑改势力、化身及模式势力，不能只按原武将配置；开局 Country=0 未就绪时原生计数会包含0。抽取真实计数方法及存活条件的6项模拟通过，未修改小抄运行代码或做游戏内验证。具体接入候选、时序边界和非国战范围见 [架构表](代码架构表.md)“非国战场上势力数”及 `manualLookupNotes.aliveCountryCount`。

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

2026-10-25定向检索补充：复用上述仍存在的快照，`O$t`（约11084546）确认位置常量及 `dealSetData` 直接读取两个unsigned-short位置，`Mode_Take=8`。小抄已修复65281误作数组下标；无法定位的检索会正确减数量，将实际模型的顺序降为候选，另保留历史可见顺序并画红色待确认框，不用于暗摸推断。确认实体ID在非牌堆区域后剔除历史；两人手牌记录中的候选也用红框标归属不明。入口、清理与验证见 [代码架构表](代码架构表.md)“定向检索 / 随机位置与待确认红框”和 `manualLookupNotes.deckSearchAudit`。无重新下载客户端，未取得具体技能实战日志，不宣称所有技能覆盖。

### 已落地的专项查询：弃牌堆区域显示可行性（2026-10-24）

复用已核实仍存在的 `C:/Users/97349/AppData/Local/Temp/codex-ol-zuifeng-qJebR9/sgsGame.main.js`，未重新下载在线客户端。该ES6快照 `pq`（字符偏移约3116838）确认 `ZONE_DISCARDPILE=2`、`ZONE_STACK=3`、`ZONE_SHUFFLE=9`、`ZONE_DISCARD_BUFFER=11`。`toDiscardBufferFunc`（约1813638）记录 `tempDisCards` 并调用弃牌动画，`processTempDiscardCardIds`（约1804594）从后续正式动画列表去掉缓存ID；缓存区不能与正式弃牌重复累计。`toShuffleFunc`（约1813753）将 `CardCount` 交给 `UpdateCardPileCardCount(...,true)`；仅凭此方法不能推断完整服务端洗牌范围和消息顺序。

小抄已有 `Zone.obj["2-255"]/Zone.qipai` 当前弃牌模型，旧 `qipaiCards` 仅筛选当前turn/round。同日后续已按用户“漏记明牌可当暗牌，优先保序”要求，复用牌顶牌底浮层加入第三个弃牌堆区；2026-10-25增加默认最新20张上限，三个区域开关与上限统一在“牌堆记录”设置。最新调整移除点击折叠，顶/底/弃起始按钮仅供拖动，区域启用后直接显示；弃牌临时窗口倒序，最新在最左、显示index0，底层历史仍保持原顺序。未知占位计数，不裁窗口暗牌，不猜暗取位置。移牌、空堆洗牌和生命周期验证，以及保留的非牌堆 `[7,0]` 漏记、非空洗牌边界，见 [代码架构表](代码架构表.md)的弃牌核查与牌堆记录设置章节、`manualLookupNotes.discardVisibilityAudit/deckVisibilityFloatingPanel`。未游戏内实测、未验证全部特殊技能或重连补全，不改变客户端完整归档状态。

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

2026-10-25复核上述 `card-face-index.json` 仍存在：同名“顺手牵羊”ID3/4分别为方块3/4；同为方块2“闪”的ID2和15也不同。因此名称、花色、点数乃至相同牌面资源都不足以唯一标识实体卡牌，移牌CardIDs和记牌候选应按具体ID匹配，不能按牌名合并。此处是本地普通配置快照核对，不把配置存在当作当前持有证据。

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

## 禁将方案搜索原生复核（2026-11-17）

定向下载普通ES6 `https://web.sanguosha.com/220/h5_2/sgsGame_a.sgs`，按ZIP读取内部同名文件，无AES或WASM解密。UTC抓取时间2026-11-16T17:26:04，压缩包SHA256 `413eda0733abb4fb01c2fc211b141ca6ed040480821aeea5dc1e5d1cea998518`，明文SHA256 `5c5ef52211598f842281dd842040026721f909ac0dbebfd8adcf377d4a988671`。临时证据`C:/Users/97349/AppData/Local/Temp/xc-general-native-pgx9qa1p/source.json`及主程序已保存；U2i/ModeGeneralPoolWindow整个类与11月10日明文相同，updateList仍走this.updateItems，tabGroup.SelectedValue仍为分类值。另定向读取当前libs/min/laya_a.sgs，核对DOM input -> Input._processInputting -> TextInput._onInput -> INPUT链仍存在；不表示完整引擎归档或游戏内复现。搜索当前分类、现场未筛选问题及诊断日志见架构表“禁将方案搜索诊断”，根因待现场确认。
