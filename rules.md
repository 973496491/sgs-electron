# 三国杀 OL 文档与客户端资料使用规则

适用范围：本仓库的三国杀 OL 小抄维护、官方客户端配置/协议/窗口排查与解包。由根目录 [AGENTS.md](AGENTS.md) 引入；以下路径均相对仓库根目录。

## 按任务查找资料

| 当前任务 | 资料入口与处理方式 |
|---|---|
| 已有小抄功能、混淆代码 | 先检索 [代码架构表](doc/代码架构表.md) 和 [彩虹表](doc/彩虹表.js) 的 `manualLookupNotes`，再查具体 decoder 的 `all/used` 和源码。 |
| 官方客户端解包或资料完整性 | 先读 [OL 解包指南](doc/sanguosha.md) 的核验记录和缺项清单，再检查本地实际有哪些原包、明文、工具和索引。 |
| 协议与消息字段 | 有 `protocol_map.tsv` 时先查映射，再到同一快照主程序核对注册、字段读写与 `Deal*` 处理；最后对照小抄 `SGSMODULE -> main -> logic` 和调试窗口中的实际消息。 |
| 窗口、类与挂钩方法 | 有 `window_class_registry.tsv` 时先定位注册，再核对类实现、实例获取和生命周期；本仓库类解析为 `laya.class`，指南示例 `QI.class/handleRuntimeEvent` 不能直接当作现有入口。 |
| 原生事件 | 有 `event_names.tsv` 时先检索，再核对派发点与监听条件；脚本自己定义的事件可能不在原生事件表中，缺项本身不能证明事件无效。 |
| 活动、武将、皮肤、卡牌配置 | 先定位解密 JSON 和主程序中的使用位置；活动时间结合客户端服务器时间与实际判断实现，配置存在不等于当前账号可领取、持有或可见。 |

三张 TSV 是从主程序生成的辅助索引，不是官方包内默认附带文件；缺少索引时可直接查主程序注册与调用点。资料搜索应围绕当前功能进行，完整解包清单不自动扩大当前任务范围。

## 已验证的普通版解包方法

- OL 资源路径为 `/220/h5_2/`，不要沿用拼错的 `/220/h52/`；十周年 `/10/pc/` 的配置和解包方法另行确认。
- 普通版 `Config.sgs` 是 ZIP，内部 `.sgs` 按指南 Key/IV 做 AES-128-CFB（CFB128）解密，再 gzip 解压为 JSON。Node.js 可直接处理原长度密文；每个文件重新创建解密器、重置 IV。
- 若复用客户端 `Ofb_Dec` 的补零流程，解密后须先裁回原始密文长度再解压；不要把补零产生的尾部字节交给 gzip。
- `h5_global_conf.sgs` 是独立的加密启动配置，不在 `Config.sgs` 的文件计数内。`Proto.sgs` 是 ZIP，内部 `client.sgs` 解密/解压后为 `.proto` 文本，不能一律执行 `JSON.parse`，也不能把该协议文件当成全部游戏协议。
- 主程序及引擎 `.sgs` 包是 ZIP。官方 `libs/after.js` 根据 ES6 支持选择 `sgsGame_a.sgs + libs/min/laya_a.sgs` 或普通版配对；仓库 `electron-next/resources/after.js` 是本地替换补丁，不能代替官方加载器。

密钥、下载路径、样本规模和完整步骤统一维护在 [doc/sanguosha.md](doc/sanguosha.md)。文件数、大小及接口状态均是抓取时的证据，后续快照需重新核对。

## 分支与证据边界

- `_a` 的 ES6 分支和 `_w` 的 WASM 加密分支彼此独立。`Config_w.sgs`、`h5_global_conf_w.sgs`、`Proto_w.sgs` 应沿 `IsWasmCrypt -> CtrUtil.Init/CtrUtil.Ctr` 核对；不能套用普通版 Key/IV 后宣称验证通过，当前进度以解包指南记录为准。
- `res/default.res.json` 提供资源分组，`version.json` 提供路径/版本条目；完整归档还需核对启动依赖、图集贴图、动画关联文件、动态路径及失败项。单个版本表不能证明资源已穷尽。
- 保存资料时记录 URL、抓取时间、版本参数、字节数、SHA-256 和解码结果；区分“已下载”“已解包”“已解码验证”“已保存产物”“已在游戏内验证”。查询参数中的日期不是固定历史快照的证明。
- 当前小抄兼容 `ClassName/className`，实际响应还需检查封装层与调用条件；例如 `ClientGameRecordInfoRep` 属于战绩链，不应作为邮件领取响应处理。配置或客户端代码不会提供服务端尚未下发的信息。

## 回写与验收

- 解包方法、分支和完整性进度更新到 `doc/sanguosha.md`；稳定的功能入口与调用链更新到 `doc/代码架构表.md`；用户脚本 decoder 映射只写 `doc/彩虹表.js` 的 `manualLookupNotes`，不手改生成表。
- 小抄日志、打包及源码检查沿用 `AGENTS.md`：调试写 `appendLocalSkinDebugLine()`；按用户授权范围处理 asar；改动 userscript/彩虹表后运行相应 `node --check`。
- 仅调整文档时检查本地链接、移动后的路径和 `rg` 检索；不要将旧快照的配置数或索引行数写成永久验收常量。
