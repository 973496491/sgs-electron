# 三国杀 OL 文档与客户端资料使用规则

适用范围：本仓库的三国杀 OL 小抄维护、官方客户端配置/协议/窗口排查与解包。由根目录 [AGENTS.md](AGENTS.md) 引入；以下路径均相对仓库根目录。

## 按任务查找资料

| 当前任务 | 资料入口与处理方式 |
|---|---|
| 发布文件新增、删除、改名、移动或打包安装 | 遵守“发布映射与文件增删”；同步唯一发布映射，覆盖 Roaming 中相关加载文件，不能只修改源码或脚本内文件列表。 |
| 已有小抄功能、混淆代码 | 先检索 [代码架构表](doc/代码架构表.md) 和 [彩虹表](doc/彩虹表.js) 的 `manualLookupNotes`，再查具体 decoder 的 `all/used` 和源码。 |
| 牌上标记、牌面标记、卡牌标记、族荀攸百出 | 先读 [牌面标记链路](doc/牌面标记链路.md) 和 `manualLookupNotes.cardFaceMarks`。区别 `Card.TagArr1` 技能标签与 `ui.tempCardTag` 临时标签，沿已有 `AddShunJiCardTags` 核对刷新后补回，保留原生及小抄已有挂钩。 |
| 官方客户端解包或资料完整性 | 先读 [OL 解包指南](doc/sanguosha.md) 的核验记录和缺项清单，再检查本地实际有哪些原包、明文、工具和索引。 |
| 协议与消息字段 | 有 `protocol_map.tsv` 时先查映射，再到同一快照主程序核对注册、字段读写与 `Deal*` 处理；最后对照小抄 `SGSMODULE -> main -> logic` 和调试窗口中的实际消息。 |
| 窗口、类与挂钩方法 | 有 `window_class_registry.tsv` 时先定位注册，再核对类实现、实例获取和生命周期；本仓库类解析为 `laya.class`，指南示例 `QI.class/handleRuntimeEvent` 不能直接当作现有入口。 |
| 原生事件 | 有 `event_names.tsv` 时先检索，再核对派发点与监听条件；脚本自己定义的事件可能不在原生事件表中，缺项本身不能证明事件无效。 |
| 活动、武将、皮肤、卡牌配置 | 先定位解密 JSON 和主程序中的使用位置；活动时间结合客户端服务器时间与实际判断实现，配置存在不等于当前账号可领取、持有或可见。 |

三张 TSV 是从主程序生成的辅助索引，不是官方包内默认附带文件；缺少索引时可直接查主程序注册与调用点。资料搜索应围绕当前功能进行，完整解包清单不自动扩大当前任务范围。

## 小抄架构与 AI 开发约束

### 发布映射与文件增删

- **唯一配置**：[electron-next/release-files.json](electron-next/release-files.json) 是已建立的小抄发布文件映射，打包与安装共用这一份配置。打包时随发布文件夹带上配置副本，安装直接读取包内副本，不依赖开发仓库。此配置是文件搬运映射，不是运行时自动加载清单，也不替代现有模块装配定义。
- **具体入口**：双击 [electron-next/pack.cmd](electron-next/pack.cmd)，调用 [scripts/package-release.ps1](electron-next/scripts/package-release.ps1)。打包入口的 `xcProjectRoot` 固定为 `C:\Users\97349\Downloads\electron\electron-next`，可单独复制到桌面使用，当前桌面副本名为 `小抄打包.cmd`；工程迁移时更新该变量及入口副本。安装模板为 [scripts/install.cmd](electron-next/scripts/install.cmd)、[scripts/install.ps1](electron-next/scripts/install.ps1)，共用路径助手 [scripts/release-common.ps1](electron-next/scripts/release-common.ps1)；它们由映射的 `packageFiles` 复制到发布包根目录。安装入口继续按自身位置查找包内脚本，使用时先解压 ZIP，再双击发布包内的 `install.cmd`。

当前 `files` 的完整业务清单如下，执行时始终以 JSON 映射为准；文件增删时同时维护本节涉及的文件名。

| 仓库来源（`sourceRoot=repo`） | `%APPDATA%\SGSOL` 下的安装位置（`target`） |
|---|---|
| `electron-next/resources/daxiaochao.user.js` | `三国杀打小抄.js` |
| `electron-next/src/features/hand-cards.js` | `modules/features/hand-cards.js` |
| `electron-next/src/adapters/hand-cards-client.js` | `modules/adapters/hand-cards-client.js` |

2026-10-17 核对 `%APPDATA%\SGSOL`，当前独立小抄加载脚本只有 `三国杀打小抄.js`，已由工程主脚本映射覆盖，没有其他需额外登记的 Roaming 加载脚本。此记录不是未来文件清单的替代；以后出现配套加载文件须登记。`remove` 当前为空，尚无本发布流程需要清理的旧安装路径。

映射采用逐文件的 `files` 条目，字段约定如下；打包文件夹内使用 `files/` 加 `target` 保存文件，安装再按同一 `target` 落到目标目录。

| 字段 | 含义 |
|---|---|
| `sourceRoot` | 来源根目录：`repo` 表示仓库根目录，`sgsol` 表示当前用户 `%APPDATA%\SGSOL`。工程中已维护的文件优先以仓库为来源；仅存在于 Roaming 的必要配套文件显式使用 `sgsol`。 |
| `source` | 相对于来源根目录的文件路径。 |
| `target` | 相对于安装根目录 `%APPDATA%\SGSOL` 的文件路径；允许与来源路径、文件名不同，不写死用户名或 C 盘绝对路径。 |

`packageFiles` 使用相同条目字段，但 `target` 相对于发布包根目录，只用于携带安装工具，不复制到 Roaming；当前为 `install.cmd`、`install.ps1`、`release-common.ps1`。映射文件自身由打包器固定复制为包根目录 `release-files.json`，安装器只消费 `files/remove`。

- **收集范围**：小抄主脚本、剥离业务模块、客户端适配及实际需要的辅助脚本/资源都显式登记，尤其不得遗漏 `%APPDATA%\SGSOL` 中与小抄有关的入口和配套加载文件。不将账号配置、缓存、日志、历史 `.bak` 或整个 Roaming 目录加入映射。
- **同步义务**：新增发布文件时增加条目；删除文件时移除旧条目；改名、移动或改变安装位置时同步 `sourceRoot/source/target`。这些更新必须与对应文件变更一起完成，不能留待打包时人工补齐。纯内容修改且路径不变无需机械修改映射；与发布无关的测试、文档不登记。
- **删除与旧路径**：同一配置的 `remove` 列表记录已废弃的小抄安装相对路径。删除发布文件或改变其安装目标时，移除旧映射并登记旧 `target`，供安装脚本清理旧文件；仅改变来源而安装目标不变时不登记删除。`remove` 不包含当前有效目标，不使用通配符或整目录清空；只处理明确废弃的小抄文件，保留用户数据。
- **脚本职责**：打包脚本按映射复制文件到发布文件夹；安装脚本按包内映射移动/覆盖到 `%APPDATA%\SGSOL`，并处理明确登记的废弃文件。脚本不维护第二份业务文件清单，不用“扫描到什么就打包什么”替代映射。安装采用 CMD + Windows PowerShell，不使用 Python。
- **输出与使用**：每次打包生成全新的 `electron-next/release/xiaochao-年月日-时分秒-毫秒/` 及同名 `.zip`，保留文件夹，不合并旧目录或覆盖已有 ZIP。业务文件位于包内 `files/`，安装工具和映射位于包根目录，ZIP 内保留一个完整发布文件夹；成功后自动打开资源管理器并选中生成的 ZIP，双击脚本结束后保留窗口显示结果。打开文件位置失败只提示，不把已完成的打包判为失败。安装会将解压后的业务文件移走，同名目标覆盖；再次安装可重新解压 ZIP 或使用另一份完整发布包，不会自动清空安装目录。
- **快速 ZIP**：默认优先调用 PATH 或标准安装目录中的 `7z.exe`，参数 `a -tzip -mx=1`；找不到 7-Zip 时使用系统 `Compress-Archive -CompressionLevel Fastest`。已核实本机 `C:\Program Files\7-Zip\7z.exe` 可用，Windows PowerShell 5.1 的快速 ZIP 分支也已实测。压缩失败返回非零退出码，输出目录保留，不把失败的压缩当作发布成功。
- **参数与维护**：`package-release.ps1 -OutputDirectory <新目录> -SgsolDirectory <Roaming来源目录>` 可调整发布位置和 `sgsol` 来源；`-CompressionTool Auto|7Zip|Windows` 可选择压缩实现，默认 `Auto`；`-NoOpen` 关闭完成后的资源管理器定位，用于自动化测试。`install.ps1 -TargetDirectory <安装目录>` 可用于隔离测试，默认仍为当前用户 `%APPDATA%\SGSOL`。打包只复制现有文件并压缩，不自动装配源码；修改独立模块后先按模块对应的装配流程更新主脚本。安装的模块副本不由这些脚本自动加载。
- **搬运边界**：仅接受各自根目录内的相对文件路径；拒绝越界路径、链接重定向、把有效目标列入 `remove` 或按目录删除。缺失文件/复制移动失败会返回非零退出码，不静默漏文件；这些是文件操作的边界与错误处理，不执行哈希、版本或游戏运行校验。
- **脚本验证**：[electron-next/tests/release-package.cjs](electron-next/tests/release-package.cjs) 在临时目录调用真实 Windows PowerShell 5.1 和移到桌面的 CMD 入口，验证映射来源、安装工具、两种快速 ZIP 解压后的完整文件及顶层目录、中文/空格/方括号路径、覆盖与移动、增删改名映射、废弃文件处理、已有 ZIP 保留和用户配置保留；执行 `node electron-next/tests/release-package.cjs`。测试不安装到真实 Roaming。
- **范围限制**：这项工作只管理文件收集、路径对应、快速 ZIP 压缩和安装搬运，不据此添加哈希校验、自动加载改造、备份回滚框架或 asar 编译。已有业务开发与模块装配的验证要求仍按原规则执行。

检索关键词：`发布映射`、`文件增删`、`release-files.json`、`sourceRoot`、`source`、`target`、`remove`、`Roaming加载文件`、`打包安装`、`同步映射`、`绝对定位`、`桌面打包`、`快速ZIP`、`7-Zip`、`CompressionTool`、`Fastest`。

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
