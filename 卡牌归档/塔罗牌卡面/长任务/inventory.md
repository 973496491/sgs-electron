# 塔罗牌卡面素材盘点与单卡队列

快照：2026-10-20T18:57:57.489Z。来源为本地已解密配置与原始图集；没有读取游戏实时模型。

## 计数

- `atlasResources`：111
- `atlasDistinctRectangles`：109
- `effectiveConfigRows`：2990
- `cardH5Overrides`：18
- `generateResources`：87
- `retainOriginalResources`：24
- `explicitRetainResources`：20
- `missingInformationRetainResources`：4
- `resourceSuitMappings`：197
- `uniqueGenerationTasks`：194
- `reuseTasks`：3
- `needsLayoutTasks`：0
- `junzhengResourceSuitMappings`：71
- `nonJunzhengResourceSuitMappings`：126

## 采用口径

- abbreviation短字段展开；card_H5按同ID覆盖；不假设为所有configData2/服务器运行时变体
- 原始图集内资源，汇总有效GamePlayCards实体记录实际出现的普通花色1..4，且点数为1..13；不按点数分别生成，不用CardsBook花色并集扩充。
- 用户未限定军争，故保留其他模式有实际实体记录的花色。军争优先仅决定代表ID和任务顺序，不裁去其他模式真实花色。
- 不会按四花色模板主动补齐缺失颜色；寒冰剑只有黑桃，藤甲只有黑桃/梅花。
- 生产底图不固化代表点数或左上小花色；代表点数仅用于分层预览。
- 武器type=3/subType=1，攻击范围来自h/attRange，不是f/number；军争优先，非军争按最小有效ID。赤血刀按ChiXueRen_0/赤血刃别名落3。
- 用户杀/闪按独立组合资源AoZhanShaShan匹配；普通Sha和Shan不被这一排除项误匹配。
- 藤甲同花色两别名复用；水淹七军同花色两别名复用。相同原位槽不允许两份不同像素相互覆盖。
- 本清单仅安排生成与离线素材，不声称单一同名底图能自动按真实花色/模式切换。
- 长名使用已登记逐条映射：鬼龙斩月、三尖两刃、五行鹤翎、金环衔鳞；国战无懈可击主标题四字、右下国徽记。没有通用字符串截断。

## 名称、范围与模式差异

- 用户“同党伐异”匹配官方“党同伐异”/`DangTongFaYi_png`，保留原图。
- 用户“赤血刀”匹配当前图集“赤血刃”/`ChiXueRen_0_png`，范围3；`ChiXueRen_4_png`没有实体记录，按原图保留。
- 寒冰剑是黑桃2（代表ID108），范围2；全配置仍只出现黑桃，但ID2035的特殊模式范围为1。
- 藤甲实际黑桃/梅花；`TengJia_png`与`TengJia2_png`共享矩形，同色复用，共需2份视觉。
- 贯石斧、寒冰剑、青釭剑、丈八蛇矛在部分模式配置范围1，军争代表分别3、2、2、3。`tasks.json`保留异常ID与范围，不把这些差异静默覆盖。
- `CardsBook`某些模式装备图鉴列四花色，不能直接当本次实体牌花色：这样会误把寒冰剑扩成四张。
- 全实体口径为197个资源花色映射/194份唯一视觉；若错误地把所有军争已有资源限为军争花色，则为158/155，会漏掉39个有实体记录的模式颜色。此处采用全实体口径并逐项保留证据。

## 逐条长名设计映射

| 原名 | 主标题 | 右下徽记 |
|---|---|---|
| 青龙偃月刀 | 青龙偃月 | 攻击范围3 |
| 雌雄双股剑 | 雌雄双股 | 攻击范围2 |
| 鬼龙斩月刀 | 鬼龙斩月 | 攻击范围3 |
| 三尖两刃刀 | 三尖两刃 | 攻击范围3 |
| 五行鹤翎扇 | 五行鹤翎 | 攻击范围4 |
| 金环衔鳞甲 | 金环衔鳞 | 无；防具不是武器 |
| 无懈可击·国 / WuXieKeJiGuo | 无懈可击 | 国 |

前两项为用户既有简称；新增四个装备简称是本轮主流程明确登记的逐条设计映射，不是通用截断。国战无懈可击按资源键统一保留国徽记，即使个别配置行的name没有“·国”。

## 资源处理表

| 资源键 | 原始名称 | 实际花色 | 操作 | 任务数/保留原因 |
|---|---|---|---|---|
| AoZhanShaShan_png | 无记录 | 无普通花色 | retain-original | 用户明确保留资源键 |
| BaGuaZhen_png | 八卦阵 | 黑桃、梅花 | generate | 2 |
| BaiBiDao_png | 百辟刀 | 黑桃 | generate | 1 |
| BaiYinShiZi_png | 白银狮子 | 梅花 | generate | 1 |
| BaZhiJing_png | 昆仑镜 | 红桃、方块、黑桃、梅花 | generate | 4 |
| BingLiangCunDuan_png | 兵粮寸断 | 红桃、方块、黑桃、梅花 | generate | 4 |
| BingSha_png | 杀 | 红桃、方块、黑桃、梅花 | generate | 4 |
| BinTieShuangJi_png | 镔铁双戟 | 方块 | generate | 1 |
| CadjArmor_png | 长安大舰 | 红桃、黑桃 | retain-original | 用户明确保留名称：长安大舰 |
| CadjJiaMa_png | 长安大舰 | 红桃、黑桃 | retain-original | 用户明确保留名称：长安大舰 |
| CadjJianMa_png | 长安大舰 | 红桃、黑桃 | retain-original | 用户明确保留名称：长安大舰 |
| CadjTreasure_png | 长安大舰 | 红桃、黑桃 | retain-original | 用户明确保留名称：长安大舰 |
| CadjWeapon_png | 长安大舰 | 红桃、黑桃 | retain-original | 用户明确保留名称：长安大舰 |
| ChiLing_png | 敕令 | 梅花 | generate | 1 |
| ChiTu_png | 赤兔 | 红桃 | generate | 1 |
| ChiXueRen_0_png | 赤血刃 | 红桃 | generate | 1 |
| ChiXueRen_4_png | 无记录 | 无普通花色 | retain-original | 原始图集存在，但有效配置无对应卡牌信息；按用户要求保留原图 |
| ChuQiBuYi_png | 出其不意 | 红桃、方块、黑桃、梅花 | generate | 4 |
| CiXiongShuangGuJian_png | 雌雄双股剑 | 黑桃 | generate | 1 |
| DangTongFaYi_png | 党同伐异 | 方块、黑桃、梅花 | retain-original | 用户“同党伐异”对应原始牌名“党同伐异” |
| DaWan_png | 大宛 | 黑桃 | generate | 1 |
| DiLu_png | 的卢 | 梅花 | generate | 1 |
| DJJ_Zhao_png | 无记录 | 无普通花色 | retain-original | 原始图集存在，但有效配置无对应卡牌信息；按用户要求保留原图 |
| DongZhuXianJi_png | 洞烛先机 | 红桃、方块、黑桃、梅花 | generate | 4 |
| FangTianHuaJi_png | 方天画戟 | 方块 | generate | 1 |
| FeiLunZhanYu_png | 飞轮战舆 | 黑桃 | generate | 1 |
| GouXiang_png | 钩镶 | 红桃、方块、黑桃、梅花 | generate | 4 |
| GuanShiFu_png | 贯石斧 | 方块 | generate | 1 |
| GuDingDao_png | 古锭刀 | 黑桃 | generate | 1 |
| GuiLongZhanYueDao_png | 鬼龙斩月刀 | 黑桃 | generate | 1 |
| GuoHeChaiQiao_png | 过河拆桥 | 红桃、方块、黑桃、梅花 | generate | 4 |
| GuoZhanXianQu_png | 先驱 | 无普通花色 | retain-original | 用户明确保留名称：先驱 |
| GuoZhanYiBoYunTian_png | 义薄云天 | 无普通花色 | retain-original | 用户明确保留名称：义薄云天 |
| GuoZhanYinYangYu_png | 阴阳鱼 | 无普通花色 | retain-original | 用户明确保留名称：阴阳鱼 |
| GuoZhanZhuLianBiHe_png | 珠联璧合 | 无普通花色 | retain-original | 用户明确保留名称：珠联璧合 |
| HanBingJian_png | 寒冰剑 | 黑桃 | generate | 1 |
| HuaLiu_png | 骅骝 | 方块 | generate | 1 |
| HunTianYi_png | 浑天仪 | 方块 | generate | 1 |
| HuoGong_png | 火攻 | 红桃、方块、黑桃、梅花 | generate | 4 |
| HuoSha_png | 杀 | 红桃、方块、黑桃、梅花 | generate | 4 |
| HuXinJing_png | 护心镜 | 梅花 | generate | 1 |
| JieDaoShaRen_png | 借刀杀人 | 红桃、方块、黑桃、梅花 | generate | 4 |
| JinHuanXianLinJia_png | 金环衔鳞甲 | 黑桃 | generate | 1 |
| JinShu_png | 金梳 | 红桃 | retain-original | 用户明确保留名称：金梳 |
| Jiu_png | 酒 | 红桃、方块、黑桃、梅花 | generate | 4 |
| JiuJieBian_png | 五行鹤翎扇 | 方块 | generate | 1 |
| JueChenJinGe_png | 绝尘金戈 | 黑桃 | retain-original | 用户明确保留名称：绝尘金戈 |
| JueDou_png | 决斗 | 红桃、方块、黑桃、梅花 | generate | 4 |
| JueYing_png | 绝影 | 黑桃 | generate | 1 |
| LangGuZhiJi_png | 逐近弃远 | 黑桃、梅花 | generate | 2 |
| LeBuSiShu_png | 乐不思蜀 | 红桃、方块、黑桃、梅花 | generate | 4 |
| LeiQie_png | 雷震 | 红桃、方块、黑桃、梅花 | generate | 4 |
| LeiSha_png | 杀 | 红桃、方块、黑桃、梅花 | generate | 4 |
| LianNu_png | 无记录 | 无普通花色 | retain-original | 原始图集存在，但有效配置无对应卡牌信息；按用户要求保留原图 |
| LiaoYuanZhiHuo_png | 燎原之火 | 红桃、梅花 | retain-original | 用户明确保留名称：燎原之火 |
| LiuXingChui_png | 乌铁锁链 | 方块、黑桃 | generate | 2 |
| MuNiuLiuMa_png | 木牛流马 | 方块 | generate | 1 |
| NanManRuQin_png | 南蛮入侵 | 红桃、方块、黑桃、梅花 | generate | 4 |
| PiLiChe_png | 霹雳车 | 方块 | generate | 1 |
| PingAnYuShou_png | 平安符 | 红桃、方块、黑桃、梅花 | generate | 4 |
| QiLinGong_png | 麒麟弓 | 红桃 | generate | 1 |
| QingGangJian_png | 青釭剑 | 黑桃 | generate | 1 |
| QingLongYanYueDao_png | 青龙偃月刀 | 黑桃 | generate | 1 |
| QiongShu_png | 琼梳 | 黑桃 | retain-original | 用户明确保留名称：琼梳 |
| RenWangDun_png | 仁王盾 | 梅花 | generate | 1 |
| SanJianLiangRenDao_png | 三尖两刃刀 | 方块 | generate | 1 |
| SanLve_png | 三略 | 黑桃 | generate | 1 |
| Sha_png | 杀 | 红桃、方块、黑桃、梅花 | generate | 4 |
| Shan_png | 闪 | 红桃、方块、黑桃、梅花 | generate | 4 |
| ShanDian_png | 闪电 | 红桃、方块、黑桃、梅花 | generate | 4 |
| ShanShan_png | 闪闪 | 方块 | generate | 1 |
| ShiQuanJian_png | 断魂 | 红桃、方块、黑桃、梅花 | generate | 4 |
| ShuiYanQiJun2_png | 水淹七军 | 黑桃、梅花 | generate | 2 |
| ShuiYanQiJun_png | 水淹七军 | 梅花 | generate | 1 |
| ShunShouQianYang_png | 顺手牵羊 | 红桃、方块、黑桃、梅花 | generate | 4 |
| SiChengLiangYu_png | 四乘粮舆 | 红桃 | generate | 1 |
| SiZhaoJian_png | 思召剑 | 方块 | retain-original | 用户明确保留名称：思召剑 |
| SuiJiYingBian_png | 随机应变 | 红桃、方块、黑桃 | generate | 3 |
| TaiGongYinFu_png | 太公阴符 | 黑桃 | generate | 1 |
| Tao_png | 桃 | 红桃、方块、黑桃、梅花 | generate | 4 |
| TaoYuanJieYi_png | 桃园结义 | 红桃、方块、黑桃、梅花 | generate | 4 |
| TengJia2_png | 藤甲 | 黑桃、梅花 | generate | 2 |
| TengJia_png | 藤甲 | 黑桃、梅花 | generate | 2 |
| TianJiTu_png | 天机图 | 梅花 | generate | 1 |
| TiaoJiYanMei_png | 调剂盐梅 | 梅花 | retain-original | 用户明确保留名称：调剂盐梅 |
| TieSuoLianHuan_png | 铁索连环 | 红桃、方块、黑桃、梅花 | generate | 4 |
| TongQue_png | 铜雀 | 黑桃、梅花 | generate | 2 |
| TongZiQieAnGang_png | 斩魂刀 | 红桃、方块、黑桃、梅花 | generate | 4 |
| WanJianQiFa_png | 万箭齐发 | 红桃、方块、黑桃、梅花 | generate | 4 |
| WuGuFengDeng_png | 五谷丰登 | 红桃、方块、黑桃、梅花 | generate | 4 |
| WuLiuJian_png | 吴六剑 | 方块 | generate | 1 |
| WuXieKeJi_png | 无懈可击 | 红桃、方块、黑桃、梅花 | generate | 4 |
| WuXieKeJiGuo_png | 无懈可击·国／无懈可击 | 方块、黑桃、梅花 | generate | 3 |
| WuZhongShengYou_png | 无中生有 | 红桃、方块、黑桃、梅花 | generate | 4 |
| XiShu_png | 犀梳 | 梅花 | retain-original | 用户明确保留名称：犀梳 |
| YaoDaoCunZheng_png | 妖刀赤瞳 | 红桃、方块、黑桃、梅花 | generate | 4 |
| YiTianShiNi_png | 倚天弑逆 | 黑桃 | generate | 1 |
| YiYiDaiLao_png | 以逸待劳 | 红桃、方块 | generate | 2 |
| YouBi_png | 右臂 | 无普通花色 | retain-original | 用户明确保留名称：右臂 |
| YuanJiaoJinGong_png | 远交近攻 | 红桃 | generate | 1 |
| YuXi_png | 玉玺 | 梅花 | generate | 1 |
| ZengJuZu_png | 铁甲胄 | 红桃、方块、黑桃、梅花 | generate | 4 |
| ZhangBaSheMao_png | 丈八蛇矛 | 黑桃 | generate | 1 |
| ZhiJiZhiBi_png | 知己知彼 | 梅花 | generate | 1 |
| ZhuaHuangFeiDian_png | 爪黄飞电 | 红桃 | generate | 1 |
| ZhuGeLianNu3v3_png | 连弩 | 方块、梅花 | generate | 2 |
| ZhuGeLianNu_png | 诸葛连弩 | 方块、梅花 | generate | 2 |
| ZhuJinQiYuan_png | 无记录 | 无普通花色 | retain-original | 原始图集存在，但有效配置无对应卡牌信息；按用户要求保留原图 |
| ZhuQueYuShan_png | 朱雀羽扇 | 方块 | generate | 1 |
| ZiXing_png | 紫騂／紫骍 | 方块 | generate | 1 |
| ZuoBang_png | 左膀 | 无普通花色 | retain-original | 用户明确保留名称：左膀 |

## 单卡队列

| 顺序 | 任务ID | 显示名 | 代表牌 | 右下徽记 | 状态 | 复用源 |
|---|---|---|---|---|---|---|
| 1 | HanBingJian_png__spade | 寒冰剑 | 黑桃2 / 108 | 2 | pending |  |
| 2 | JueDou_png__diamond | 决斗 | 方块A / 1 | 无 | pending |  |
| 3 | Shan_png__diamond | 闪 | 方块2 / 2 | 无 | pending |  |
| 4 | ShunShouQianYang_png__diamond | 顺手牵羊 | 方块3 / 3 | 无 | pending |  |
| 5 | GuanShiFu_png__diamond | 贯石斧 | 方块5 / 5 | 3 | pending |  |
| 6 | Sha_png__diamond | 杀 | 方块6 / 6 | 无 | pending |  |
| 7 | FangTianHuaJi_png__diamond | 方天画戟 | 方块Q / 12 | 4 | pending |  |
| 8 | ZiXing_png__diamond | 紫騂 | 方块K / 13 | 无 | pending |  |
| 9 | ZhuGeLianNu_png__diamond | 诸葛连弩 | 方块A / 14 | 1 | pending |  |
| 10 | Tao_png__diamond | 桃 | 方块Q / 25 | 无 | pending |  |
| 11 | WanJianQiFa_png__heart | 万箭齐发 | 红桃A / 27 | 无 | pending |  |
| 12 | Shan_png__heart | 闪 | 红桃2 / 28 | 无 | pending |  |
| 13 | WuGuFengDeng_png__heart | 五谷丰登 | 红桃3 / 29 | 无 | pending |  |
| 14 | ChiTu_png__heart | 赤兔 | 红桃5 / 31 | 无 | pending |  |
| 15 | LeBuSiShu_png__heart | 乐不思蜀 | 红桃6 / 32 | 无 | pending |  |
| 16 | WuZhongShengYou_png__heart | 无中生有 | 红桃7 / 33 | 无 | pending |  |
| 17 | Sha_png__heart | 杀 | 红桃10 / 36 | 无 | pending |  |
| 18 | GuoHeChaiQiao_png__heart | 过河拆桥 | 红桃Q / 38 | 无 | pending |  |
| 19 | TaoYuanJieYi_png__heart | 桃园结义 | 红桃A / 40 | 无 | pending |  |
| 20 | Tao_png__heart | 桃 | 红桃3 / 42 | 无 | pending |  |
| 21 | QiLinGong_png__heart | 麒麟弓 | 红桃5 / 44 | 5 | pending |  |
| 22 | ZhuaHuangFeiDian_png__heart | 爪黄飞电 | 红桃K / 52 | 无 | pending |  |
| 23 | JueDou_png__club | 决斗 | 梅花A / 53 | 无 | pending |  |
| 24 | Sha_png__club | 杀 | 梅花2 / 54 | 无 | pending |  |
| 25 | WuXieKeJi_png__club | 无懈可击 | 梅花Q / 64 | 无 | pending |  |
| 26 | ZhuGeLianNu_png__club | 诸葛连弩 | 梅花A / 66 | 1 | pending |  |
| 27 | BaGuaZhen_png__club | 八卦阵 | 梅花2 / 67 | 无 | pending |  |
| 28 | GuoHeChaiQiao_png__club | 过河拆桥 | 梅花3 / 68 | 无 | pending |  |
| 29 | DiLu_png__club | 的卢 | 梅花5 / 70 | 无 | pending |  |
| 30 | LeBuSiShu_png__club | 乐不思蜀 | 梅花6 / 71 | 无 | pending |  |
| 31 | NanManRuQin_png__club | 南蛮入侵 | 梅花7 / 72 | 无 | pending |  |
| 32 | JieDaoShaRen_png__club | 借刀 | 梅花Q / 77 | 无 | pending |  |
| 33 | JueDou_png__spade | 决斗 | 黑桃A / 79 | 无 | pending |  |
| 34 | CiXiongShuangGuJian_png__spade | 雌雄双股 | 黑桃2 / 80 | 2 | pending |  |
| 35 | ShunShouQianYang_png__spade | 顺手牵羊 | 黑桃3 / 81 | 无 | pending |  |
| 36 | JueYing_png__spade | 绝影 | 黑桃5 / 83 | 无 | pending |  |
| 37 | QingGangJian_png__spade | 青釭剑 | 黑桃6 / 84 | 2 | pending |  |
| 38 | Sha_png__spade | 杀 | 黑桃7 / 85 | 无 | pending |  |
| 39 | GuoHeChaiQiao_png__spade | 过河拆桥 | 黑桃Q / 90 | 无 | pending |  |
| 40 | NanManRuQin_png__spade | 南蛮入侵 | 黑桃K / 91 | 无 | pending |  |
| 41 | ShanDian_png__spade | 闪电 | 黑桃A / 92 | 无 | pending |  |
| 42 | BaGuaZhen_png__spade | 八卦阵 | 黑桃2 / 93 | 无 | pending |  |
| 43 | QingLongYanYueDao_png__spade | 青龙偃月 | 黑桃5 / 96 | 3 | pending |  |
| 44 | LeBuSiShu_png__spade | 乐不思蜀 | 黑桃6 / 97 | 无 | pending |  |
| 45 | WuXieKeJi_png__spade | 无懈可击 | 黑桃J / 102 | 无 | pending |  |
| 46 | ZhangBaSheMao_png__spade | 丈八蛇矛 | 黑桃Q / 103 | 3 | pending |  |
| 47 | DaWan_png__spade | 大宛 | 黑桃K / 104 | 无 | pending |  |
| 48 | ShanDian_png__heart | 闪电 | 红桃Q / 105 | 无 | pending |  |
| 49 | WuXieKeJi_png__diamond | 无懈可击 | 方块Q / 106 | 无 | pending |  |
| 50 | RenWangDun_png__club | 仁王盾 | 梅花2 / 107 | 无 | pending |  |
| 51 | WuXieKeJi_png__heart | 无懈可击 | 红桃A / 109 | 无 | pending |  |
| 52 | HuoGong_png__heart | 火攻 | 红桃2 / 110 | 无 | pending |  |
| 53 | HuoSha_png__heart | 杀 | 红桃4 / 112 | 火 | pending |  |
| 54 | ZhuQueYuShan_png__diamond | 朱雀羽扇 | 方块A / 122 | 4 | pending |  |
| 55 | HuoSha_png__diamond | 杀 | 方块4 / 125 | 火 | pending |  |
| 56 | Jiu_png__diamond | 酒 | 方块9 / 130 | 无 | pending |  |
| 57 | HuoGong_png__diamond | 火攻 | 方块Q / 133 | 无 | pending |  |
| 58 | HuaLiu_png__diamond | 骅骝 | 方块K / 134 | 无 | pending |  |
| 59 | GuDingDao_png__spade | 古锭刀 | 黑桃A / 135 | 2 | pending |  |
| 60 | TengJia_png__spade | 藤甲 | 黑桃2 / 136 | 无 | pending |  |
| 61 | Jiu_png__spade | 酒 | 黑桃3 / 137 | 无 | pending |  |
| 62 | LeiSha_png__spade | 杀 | 黑桃4 / 138 | 雷 | pending |  |
| 63 | BingLiangCunDuan_png__spade | 兵粮寸断 | 黑桃10 / 144 | 无 | pending |  |
| 64 | TieSuoLianHuan_png__spade | 铁索连环 | 黑桃J / 145 | 无 | pending |  |
| 65 | BaiYinShiZi_png__club | 白银狮子 | 梅花A / 148 | 无 | pending |  |
| 66 | TengJia_png__club | 藤甲 | 梅花2 / 149 | 无 | pending |  |
| 67 | Jiu_png__club | 酒 | 梅花3 / 150 | 无 | pending |  |
| 68 | BingLiangCunDuan_png__club | 兵粮寸断 | 梅花4 / 151 | 无 | pending |  |
| 69 | LeiSha_png__club | 杀 | 梅花5 / 152 | 雷 | pending |  |
| 70 | TieSuoLianHuan_png__club | 铁索连环 | 梅花10 / 157 | 无 | pending |  |
| 71 | MuNiuLiuMa_png__diamond | 木牛流马 | 方块5 / 161 | 无 | pending |  |
| 72 | GuiLongZhanYueDao_png__spade | 鬼龙斩月 | 黑桃5 / 312 | 3 | pending |  |
| 73 | YuanJiaoJinGong_png__heart | 远交近攻 | 红桃9 / 1044 | 无 | pending |  |
| 74 | YiYiDaiLao_png__heart | 以逸待劳 | 红桃J / 1048 | 无 | pending |  |
| 75 | ZhiJiZhiBi_png__club | 知己知彼 | 梅花3 / 1061 | 无 | pending |  |
| 76 | WuXieKeJiGuo_png__club | 无懈可击 | 梅花K / 1081 | 国 | pending |  |
| 77 | YiYiDaiLao_png__diamond | 以逸待劳 | 方块4 / 1088 | 无 | pending |  |
| 78 | WuLiuJian_png__diamond | 吴六剑 | 方块6 / 1092 | 2 | pending |  |
| 79 | SanJianLiangRenDao_png__diamond | 三尖两刃 | 方块Q / 1105 | 3 | pending |  |
| 80 | WuXieKeJiGuo_png__diamond | 无懈可击 | 方块Q / 1106 | 国 | pending |  |
| 81 | WuXieKeJiGuo_png__spade | 无懈可击 | 黑桃K / 1147 | 国 | pending |  |
| 82 | YuXi_png__club | 玉玺 | 梅花A / 1148 | 无 | pending |  |
| 83 | ChiLing_png__club | 敕令 | 梅花3 / 1150 | 无 | pending |  |
| 84 | ShuiYanQiJun_png__club | 水淹七军 | 梅花Q / 1159 | 无 | pending |  |
| 85 | ShuiYanQiJun2_png__spade | 水淹七军 | 黑桃3 / 1277 | 无 | pending |  |
| 86 | BingSha_png__spade | 杀 | 黑桃8 / 1279 | 冰 | pending |  |
| 87 | LangGuZhiJi_png__spade | 逐近弃远 | 黑桃3 / 1283 | 无 | pending |  |
| 88 | LiuXingChui_png__spade | 乌铁锁链 | 黑桃K / 1288 | 3 | pending |  |
| 89 | DongZhuXianJi_png__heart | 洞烛先机 | 红桃7 / 1290 | 无 | pending |  |
| 90 | ChuQiBuYi_png__heart | 出其不意 | 红桃2 / 1292 | 无 | pending |  |
| 91 | TaiGongYinFu_png__spade | 太公阴符 | 黑桃2 / 1294 | 无 | pending |  |
| 92 | HuXinJing_png__club | 护心镜 | 梅花A / 1299 | 无 | pending |  |
| 93 | TongQue_png__club | 铜雀 | 梅花5 / 1300 | 无 | pending |  |
| 94 | LangGuZhiJi_png__club | 逐近弃远 | 梅花Q / 1301 | 无 | pending |  |
| 95 | JiuJieBian_png__diamond | 五行鹤翎 | 方块A / 1302 | 4 | pending |  |
| 96 | ZhuGeLianNu3v3_png__diamond | 连弩 | 方块A / 3014 | 1 | pending |  |
| 97 | ZhuGeLianNu3v3_png__club | 连弩 | 梅花A / 3066 | 1 | pending |  |
| 98 | BingLiangCunDuan_png__diamond | 兵粮寸断 | 方块4 / 4086 | 无 | pending |  |
| 99 | PiLiChe_png__diamond | 霹雳车 | 方块9 / 4308 | 9 | pending |  |
| 100 | BaiBiDao_png__spade | 百辟刀 | 黑桃2 / 6002 | 2 | pending |  |
| 101 | SuiJiYingBian_png__spade | 随机应变 | 黑桃2 / 6004 | 无 | pending |  |
| 102 | SanLve_png__spade | 三略 | 黑桃5 / 6009 | 无 | pending |  |
| 103 | TianJiTu_png__club | 天机图 | 梅花Q / 6023 | 无 | pending |  |
| 104 | ChuQiBuYi_png__diamond | 出其不意 | 方块Q / 6061 | 无 | pending |  |
| 105 | LiuXingChui_png__diamond | 乌铁锁链 | 方块Q / 6062 | 3 | pending |  |
| 106 | BinTieShuangJi_png__diamond | 镔铁双戟 | 方块K / 6063 | 3 | pending |  |
| 107 | TongQue_png__spade | 铜雀 | 黑桃9 / 6201 | 无 | pending |  |
| 108 | BingSha_png__club | 杀 | 梅花4 / 6202 | 冰 | pending |  |
| 109 | SiChengLiangYu_png__heart | 四乘粮舆 | 红桃5 / 10045 | 无 | pending |  |
| 110 | FeiLunZhanYu_png__spade | 飞轮战舆 | 黑桃5 / 10047 | 无 | pending |  |
| 111 | ShanShan_png__diamond | 闪闪 | 方块3 / 12140 | 无 | pending |  |
| 112 | Shan_png__spade | 闪 | 黑桃2 / 20409 | 无 | pending |  |
| 113 | Shan_png__club | 闪 | 梅花2 / 20411 | 无 | pending |  |
| 114 | Tao_png__spade | 桃 | 黑桃8 / 20413 | 无 | pending |  |
| 115 | Tao_png__club | 桃 | 梅花8 / 20415 | 无 | pending |  |
| 116 | Jiu_png__heart | 酒 | 红桃9 / 20418 | 无 | pending |  |
| 117 | ShunShouQianYang_png__heart | 顺手牵羊 | 红桃6 / 20422 | 无 | pending |  |
| 118 | ShunShouQianYang_png__club | 顺手牵羊 | 梅花6 / 20423 | 无 | pending |  |
| 119 | GuoHeChaiQiao_png__diamond | 过河拆桥 | 方块6 / 20428 | 无 | pending |  |
| 120 | WuGuFengDeng_png__spade | 五谷丰登 | 黑桃5 / 20429 | 无 | pending |  |
| 121 | WuGuFengDeng_png__club | 五谷丰登 | 梅花5 / 20431 | 无 | pending |  |
| 122 | WuGuFengDeng_png__diamond | 五谷丰登 | 方块5 / 20432 | 无 | pending |  |
| 123 | JueDou_png__heart | 决斗 | 红桃Q / 20434 | 无 | pending |  |
| 124 | NanManRuQin_png__heart | 南蛮入侵 | 红桃J / 20438 | 无 | pending |  |
| 125 | NanManRuQin_png__diamond | 南蛮入侵 | 方块J / 20440 | 无 | pending |  |
| 126 | WanJianQiFa_png__spade | 万箭齐发 | 黑桃10 / 20441 | 无 | pending |  |
| 127 | WanJianQiFa_png__club | 万箭齐发 | 梅花10 / 20443 | 无 | pending |  |
| 128 | WanJianQiFa_png__diamond | 万箭齐发 | 方块10 / 20444 | 无 | pending |  |
| 129 | ShanDian_png__club | 闪电 | 梅花A / 20447 | 无 | pending |  |
| 130 | ShanDian_png__diamond | 闪电 | 方块A / 20448 | 无 | pending |  |
| 131 | TaoYuanJieYi_png__spade | 桃园结义 | 黑桃8 / 20449 | 无 | pending |  |
| 132 | TaoYuanJieYi_png__club | 桃园结义 | 梅花8 / 20451 | 无 | pending |  |
| 133 | TaoYuanJieYi_png__diamond | 桃园结义 | 方块8 / 20452 | 无 | pending |  |
| 134 | LeBuSiShu_png__diamond | 乐不思蜀 | 方块4 / 20460 | 无 | pending |  |
| 135 | TieSuoLianHuan_png__heart | 铁索连环 | 红桃3 / 20462 | 无 | pending |  |
| 136 | TieSuoLianHuan_png__diamond | 铁索连环 | 方块3 / 20464 | 无 | pending |  |
| 137 | BingLiangCunDuan_png__heart | 兵粮寸断 | 红桃4 / 20466 | 无 | pending |  |
| 138 | JieDaoShaRen_png__spade | 借刀 | 黑桃3 / 20469 | 无 | pending |  |
| 139 | JieDaoShaRen_png__heart | 借刀 | 红桃3 / 20470 | 无 | pending |  |
| 140 | JieDaoShaRen_png__diamond | 借刀 | 方块3 / 20472 | 无 | pending |  |
| 141 | HuoGong_png__spade | 火攻 | 黑桃J / 20473 | 无 | pending |  |
| 142 | HuoGong_png__club | 火攻 | 梅花J / 20475 | 无 | pending |  |
| 143 | WuZhongShengYou_png__spade | 无中生有 | 黑桃10 / 20477 | 无 | pending |  |
| 144 | WuZhongShengYou_png__club | 无中生有 | 梅花10 / 20479 | 无 | pending |  |
| 145 | WuZhongShengYou_png__diamond | 无中生有 | 方块10 / 20480 | 无 | pending |  |
| 146 | ShiQuanJian_png__spade | 断魂 | 黑桃5 / 20824 | 2 | pending |  |
| 147 | BaZhiJing_png__spade | 昆仑镜 | 黑桃Q / 20825 | 无 | pending |  |
| 148 | PingAnYuShou_png__diamond | 平安符 | 方块K / 20827 | 无 | pending |  |
| 149 | LeiQie_png__club | 雷震 | 梅花A / 20828 | 2 | pending |  |
| 150 | ZengJuZu_png__club | 铁甲胄 | 梅花2 / 20830 | 无 | pending |  |
| 151 | TongZiQieAnGang_png__spade | 斩魂刀 | 黑桃2 / 20831 | 3 | pending |  |
| 152 | YaoDaoCunZheng_png__spade | 妖刀赤瞳 | 黑桃6 / 20832 | 3 | pending |  |
| 153 | GouXiang_png__spade | 钩镶 | 黑桃2 / 20833 | 无 | pending |  |
| 154 | ShiQuanJian_png__heart | 断魂 | 红桃5 / 20836 | 2 | pending |  |
| 155 | ShiQuanJian_png__diamond | 断魂 | 方块5 / 20837 | 2 | pending |  |
| 156 | ShiQuanJian_png__club | 断魂 | 梅花5 / 20839 | 2 | pending |  |
| 157 | BaZhiJing_png__heart | 昆仑镜 | 红桃Q / 20841 | 无 | pending |  |
| 158 | BaZhiJing_png__diamond | 昆仑镜 | 方块Q / 20842 | 无 | pending |  |
| 159 | BaZhiJing_png__club | 昆仑镜 | 梅花Q / 20844 | 无 | pending |  |
| 160 | PingAnYuShou_png__heart | 平安符 | 红桃K / 20851 | 无 | pending |  |
| 161 | PingAnYuShou_png__spade | 平安符 | 黑桃K / 20853 | 无 | pending |  |
| 162 | PingAnYuShou_png__club | 平安符 | 梅花K / 20854 | 无 | pending |  |
| 163 | LeiQie_png__heart | 雷震 | 红桃A / 20856 | 2 | pending |  |
| 164 | LeiQie_png__diamond | 雷震 | 方块A / 20857 | 2 | pending |  |
| 165 | LeiQie_png__spade | 雷震 | 黑桃A / 20858 | 2 | pending |  |
| 166 | ZengJuZu_png__heart | 铁甲胄 | 红桃2 / 20866 | 无 | pending |  |
| 167 | ZengJuZu_png__diamond | 铁甲胄 | 方块2 / 20867 | 无 | pending |  |
| 168 | ZengJuZu_png__spade | 铁甲胄 | 黑桃2 / 20868 | 无 | pending |  |
| 169 | TongZiQieAnGang_png__heart | 斩魂刀 | 红桃2 / 20871 | 3 | pending |  |
| 170 | TongZiQieAnGang_png__diamond | 斩魂刀 | 方块2 / 20872 | 3 | pending |  |
| 171 | TongZiQieAnGang_png__club | 斩魂刀 | 梅花2 / 20874 | 3 | pending |  |
| 172 | YaoDaoCunZheng_png__heart | 妖刀赤瞳 | 红桃6 / 20876 | 3 | pending |  |
| 173 | YaoDaoCunZheng_png__diamond | 妖刀赤瞳 | 方块6 / 20877 | 3 | pending |  |
| 174 | YaoDaoCunZheng_png__club | 妖刀赤瞳 | 梅花6 / 20879 | 3 | pending |  |
| 175 | GouXiang_png__heart | 钩镶 | 红桃2 / 20881 | 无 | pending |  |
| 176 | GouXiang_png__diamond | 钩镶 | 方块2 / 20882 | 无 | pending |  |
| 177 | GouXiang_png__club | 钩镶 | 梅花2 / 20884 | 无 | pending |  |
| 178 | YiTianShiNi_png__spade | 倚天弑逆 | 黑桃6 / 21112 | 4 | pending |  |
| 179 | JinHuanXianLinJia_png__spade | 金环衔鳞 | 黑桃2 / 21113 | 无 | pending |  |
| 180 | HunTianYi_png__diamond | 浑天仪 | 方块A / 31020 | 无 | pending |  |
| 181 | HuoSha_png__spade | 杀 | 黑桃9 / 31083 | 火 | pending |  |
| 182 | HuoSha_png__club | 杀 | 梅花10 / 31084 | 火 | pending |  |
| 183 | LeiSha_png__diamond | 杀 | 方块Q / 31086 | 雷 | pending |  |
| 184 | LeiSha_png__heart | 杀 | 红桃K / 31087 | 雷 | pending |  |
| 185 | BingSha_png__diamond | 杀 | 方块8 / 31092 | 冰 | pending |  |
| 186 | BingSha_png__heart | 杀 | 红桃7 / 31093 | 冰 | pending |  |
| 187 | ChuQiBuYi_png__spade | 出其不意 | 黑桃6 / 31112 | 无 | pending |  |
| 188 | ChuQiBuYi_png__club | 出其不意 | 梅花6 / 31113 | 无 | pending |  |
| 189 | SuiJiYingBian_png__heart | 随机应变 | 红桃6 / 31114 | 无 | pending |  |
| 190 | SuiJiYingBian_png__diamond | 随机应变 | 方块6 / 31115 | 无 | pending |  |
| 191 | DongZhuXianJi_png__diamond | 洞烛先机 | 方块6 / 31119 | 无 | pending |  |
| 192 | DongZhuXianJi_png__spade | 洞烛先机 | 黑桃6 / 31120 | 无 | pending |  |
| 193 | DongZhuXianJi_png__club | 洞烛先机 | 梅花6 / 31121 | 无 | pending |  |
| 194 | ChiXueRen_0_png__heart | 赤血刃 | 红桃K / 31275 | 3 | pending |  |
| 195 | TengJia2_png__spade | 藤甲 | 黑桃2 / 6003 | 无 | waiting-for-shared-asset | TengJia_png__spade |
| 196 | TengJia2_png__club | 藤甲 | 梅花2 / 6040 | 无 | waiting-for-shared-asset | TengJia_png__club |
| 197 | ShuiYanQiJun2_png__club | 水淹七军 | 梅花6 / 31117 | 无 | waiting-for-shared-asset | ShuiYanQiJun_png__club |

## 共享矩形与最终合并限制

- `ShuiYanQiJun2_png.png / ShuiYanQiJun_png.png`共享矩形，梅花任务复用。
- `TengJia2_png.png / TengJia_png.png`共享矩形，黑桃与梅花任务分别复用。

原始图集一个资源槽位不能同时保存多个花色版本；共享槽位也不能保存两种不同图案。后续合并需明确花色分包、资源映射或接入方式，不能将194份图直接覆盖111个原槽位并声称会自动换色。

关键词：卡牌盘点、实际花色、军争、攻击范围、attRange、寒冰剑、藤甲、党同伐异、赤血刃、共享矩形、鬼龙斩月、三尖两刃、五行鹤翎、金环衔鳞、国战无懈可击。
