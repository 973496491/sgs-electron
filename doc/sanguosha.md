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

---

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
