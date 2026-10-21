# 三国杀 OL 小抄开发与客户端资料使用规则

适用范围：本仓库的三国杀 OL 小抄维护、官方客户端配置/协议/窗口排查与解包。由根目录 [AGENTS.md](AGENTS.md) 引入；以下路径均相对仓库根目录。

## 按任务查找资料

| 当前任务 | 资料入口与处理方式 |
|---|---|
| 小抄新增功能、修复、UI/配置与模块拆分 | 先读下方“小抄架构与 AI 开发约束”，再检索架构表中对应功能的真实入口、状态和生命周期；按任务范围增量修改。 |
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

适用于后续小抄功能开发、修复、重构及其加载集成。目标是在人工主要验收功能的情况下，让 AI 能限定修改范围并验证实际行为。以下是增量开发约束，不表示现有脚本已经完成模块化；用户当前明确要求优先。日常任务由 AI 根据这些边界选择实现，不要求用户逐项批准类名、文件划分或内部接口。

### 模块边界与拆分尺度

| 职责 | 边界 |
|---|---|
| 启动与生命周期 | 负责装配依赖、注册功能、通知进入/退出场景和释放资源；具体选牌、皮肤等规则留在所属功能。 |
| 客户端适配 | 集中封装本次涉及的场景、本人手牌、座位、原生调用与客户端兼容差异；复用已核实入口，避免各功能重复探测混淆字段。 |
| 公共基础 | 提供配置读写、调试日志、订阅/清理和挂钩协作能力；按已出现的共享需求提取，不提前搭建通用框架。 |
| 独立业务模块 | 整理选牌、自动手气、本地皮肤、皮肤屏蔽、牌面标记、身份显示、战绩等按实际职责划分；各自维护规则、状态与对外接口。 |

- 拆分依据是“哪些行为一起变化、由谁维护状态、能否独立验证”。同一功能的界面、操作和清理可放在一个内聚模块，复杂后再拆；不为每个按钮或函数创建类。
- 类、对象、闭包模块都可用；类适合封装状态与生命周期，纯筛选/排序规则优先普通函数。禁止将所有功能合并进万能类，也不要通过深继承、多层转发或大量碎文件增加理解成本。
- 优先复用现有明确接口；业务模块不直接修改其他模块内部状态或形成循环依赖。确有共享需求时抽取有归属的公共能力，不把全部功能对象塞入一个任意访问的全局上下文。

### 状态归属与依赖接口

- 每份可变状态由一个模块负责写入和清理。区分持久偏好、页面状态、当前对局状态和异步任务状态；退出对局应清理局内对象及任务，不误删需要保留的用户偏好。
- 跨模块明确提供输入、结果与必要失败原因，直接函数依赖或已有事件均可；只有真实解耦需求才增加事件层。跨 IIFE 复用已存在的明确桥接，不依赖局部变量穿透作用域或页面同名 `laya`，不随意扩大 `window` 导出面。
- 只读查询与会选牌、发请求、改模型的操作分开，名称和文档说明副作用。现有 `laya.card()` 无参可能执行全选，不能用作只读手牌查询；当前手牌、有效花色、原生选牌权限应沿已核实链获取。
- 客户端适配负责能力探测和兼容，业务模块负责策略与场景规则。执行副作用前重读当前场景/对象和条件，避免把初始化时取得的对象永久缓存用于后续对局。

### 初始化、清理与挂钩协作

- 功能必须在真实的启动、面板或事件链中接通，并明确初始化时机、启用条件、场景门槛和清理入口；不以“函数定义存在”证明已启用。名称为 `init/dispose` 等只是可选形式，不要求改名现有入口。
- 定时器、事件订阅、观察器、DOM、原生挂钩分别指定维护者；重复调用初始化不能重复注册。开关关闭时停止该功能不再需要的任务，页面/场景重建时释放旧引用并按需要补装，保留负责再次启用的必要监听。
- 异步任务与重试按任务身份或场景身份隔离；旧回调失效后不能写入新局或清理新任务。重试要有明确停止条件与合理预算，重复入口合并任务，避免每次通知都重新开启完整轮询；已有任务机制可满足需求时直接复用。
- 包装原生方法前查找已有包装器及依赖功能，保留原来的 `this`、参数、返回值和异常语义，除非当前需求明确改变对应行为。按目标对象/原型与方法保证幂等，避免后装覆盖前装。
- 卸载时只有当前方法仍属于本功能包装器才直接恢复原描述符；若后续包装器依赖本层，则通过协作注销或停用本层副作用处理，不能用旧快照覆盖整条链。牌面标记等共享入口还须保留专项文档要求的已有挂钩。
- 失败、跳过与已执行要能从既有调试窗口区分；沿 `appendLocalSkinDebugLine()` 及现有跨 IIFE 日志桥输出必要信息，不另建控制台日志通道，也不强行打开调试窗口。

### 渐进迁移与实际加载

- 新功能在明确业务边界内实现；修改旧功能时，只迁移完成当前任务所需的部分，并保留无关行为、配置兼容与可回退路径。普通修复不自动扩大为全量重写、整文件反混淆、批量改名或框架替换。
- 源码组织和交付形式分别选择。可先在现有 `daxiaochao.user.js` 内用对象/闭包建立边界；需要拆文件时，核对加载顺序、作用域、运行环境和唯一维护源，接通实际注入或生成流程，不能只创建未加载模块。
- 单个 userscript 仍可作为最终交付文件。当前规则不表示仓库已有模块构建器，不要求为模块化引入构建工具；若按任务新增生成流程，说明源文件与产物关系并验证产物可加载。继续遵守 `AGENTS.md` 的 asar 限制。

### 发布映射与文件增删

- **唯一配置**：[electron-next/release-files.json](electron-next/release-files.json) 是已建立的小抄发布文件映射，打包与安装共用这一份配置。打包时随发布文件夹带上配置副本，安装直接读取包内副本，不依赖开发仓库。此配置是文件搬运映射，不是运行时自动加载清单，也不替代现有模块装配定义。
- **具体入口**：双击 [electron-next/pack.cmd](electron-next/pack.cmd)，调用 Python [scripts/package_release.py](electron-next/scripts/package_release.py)。入口优先使用工程 `.venv-release/Scripts/python.exe`，否则使用 `py -3` 或 `python`；`xcProjectRoot` 固定为 `C:\Users\97349\Downloads\electron\electron-next`，桌面副本为 `小抄打包.cmd`。工程迁移或入口变更须同步变量及桌面副本。旧 `scripts/package-release.ps1` 已由 Python 打包器替代。安装模板仍为 [scripts/install.cmd](electron-next/scripts/install.cmd)、[scripts/install.ps1](electron-next/scripts/install.ps1)，共用路径助手 [scripts/release-common.ps1](electron-next/scripts/release-common.ps1)，由 `packageFiles` 复制到包根目录；解压 ZIP 后双击 `install.cmd`，安装端不要求 Python。

当前 `files` 的完整业务清单如下，执行时始终以 JSON 映射为准；文件增删时同时维护本节涉及的文件名。

| 仓库来源（`sourceRoot=repo`） | `%APPDATA%\SGSOL` 下的安装位置（`target`） |
|---|---|
| `electron-next/resources/daxiaochao.user.js` | `三国杀打小抄.js` |
| `electron-next/src/features/hand-cards.js` | `modules/features/hand-cards.js` |
| `electron-next/src/features/top-marquee.js` | `modules/features/top-marquee.js` |
| `electron-next/src/adapters/hand-cards-client.js` | `modules/adapters/hand-cards-client.js` |
| `electron-next/src/features/card-theme.js` | `modules/features/card-theme.js` |
| `electron-next/src/adapters/card-theme-client.js` | `modules/adapters/card-theme-client.js` |
| `electron-next/src/electron/card-theme-assets.js` | `modules/runtime/card-theme-assets.js` |
| `electron-next/resources/card-themes/tarot/manifest.json` | `card-themes/tarot/manifest.json` |
| `electron-next/resources/card-themes/tarot/faces/Shan_heart.png` | `card-themes/tarot/faces/Shan_heart.png` |
| `electron-next/resources/card-themes/tarot/faces/Shan_diamond.png` | `card-themes/tarot/faces/Shan_diamond.png` |
| `electron-next/resources/card-themes/tarot/faces/HanBingJian_spade.png` | `card-themes/tarot/faces/HanBingJian_spade.png` |
| `electron-next/resources/card-themes/tarot/ranks/2.png` | `card-themes/tarot/ranks/2.png` |
| `electron-next/resources/card-themes/tarot/suits/heart.png` | `card-themes/tarot/suits/heart.png` |
| `electron-next/src/electron/release-update.js` | `modules/runtime/release-update.js` |
| `electron-next/src/electron/release-install.js` | `modules/runtime/release-install.js` |
| `electron-next/scripts/install.ps1` | `modules/runtime/install.ps1` |
| `electron-next/scripts/release-common.ps1` | `modules/runtime/release-common.ps1` |
| `electron-next/version.json` | `version.json` |

2026-10-17 已接入自动安装及屏蔽弹幕模块；2026-10-21塔罗第一阶段增加两个装配模块、素材读取模块及6项PNG/清单，当前18个业务文件。手牌、屏蔽弹幕和卡面模块装配进主脚本，更新/安装/素材读取模块由宿主主进程实际 require。旧客户端已有的Electron remote桥可在素材接口缺失时加载随包模块并自动注册；此兼容链已用Electron10验证，无需覆盖宿主main或重建asar，不能省略读取模块和安装协调器。自动安装只接受新协议包；安装顺序固定为其它业务文件、废弃文件、主脚本、最后版本记录。本机私有配置不打包，`remove` 当前为空。

映射采用逐文件的 `files` 条目，字段约定如下；打包文件夹内使用 `files/` 加 `target` 保存文件，安装再按同一 `target` 落到目标目录。

| 字段 | 含义 |
|---|---|
| `sourceRoot` | 来源根目录：`repo` 表示仓库根目录，`sgsol` 表示当前用户 `%APPDATA%\SGSOL`。工程中已维护的文件优先以仓库为来源；仅存在于 Roaming 的必要配套文件显式使用 `sgsol`。 |
| `source` | 相对于来源根目录的文件路径。 |
| `target` | 相对于安装根目录 `%APPDATA%\SGSOL` 的文件路径；允许与来源路径、文件名不同，不写死用户名或 C 盘绝对路径。 |

`packageFiles` 使用相同条目字段，但 `target` 相对于发布包根目录，只用于携带安装工具，不复制到 Roaming；当前为 `install.cmd`、`install.ps1`、`release-common.ps1`。映射文件自身由打包器固定复制为包根目录 `release-files.json`，安装器只消费 `files/remove`。

- **收集范围**：小抄主脚本、剥离业务模块、客户端适配及实际需要的辅助脚本/资源都显式登记，尤其不得遗漏 `%APPDATA%\SGSOL` 中与小抄有关的入口和配套加载文件。不将账号配置、缓存、日志、历史 `.bak` 或整个 Roaming 目录加入映射。
- **同步义务**：新增发布文件时增加条目；删除文件时移除旧条目；改名、移动或改变安装位置时同步 `sourceRoot/source/target`。这些更新必须与对应文件变更一起完成，不能留待打包时人工补齐。纯内容修改且路径不变无需机械修改映射；与发布无关的测试、文档不登记。
- **卡面素材引用校验**：打包器在创建发布目录前校验映射内 `card-themes/*/manifest.json` 的faces/ranks/suits引用；每个非空PNG路径必须有对应 `files` 条目，缺项立即失败。null或空字符串保留原生回退语义；不会自动扫描目录或把整份卡牌归档加入包。新增图时须同时维护素材清单和发布映射。桌面 `小抄打包.cmd` 共用此校验，入口改动同步工程与桌面副本。
- **删除与旧路径**：同一配置的 `remove` 列表记录已废弃的小抄安装相对路径。删除发布文件或改变其安装目标时，移除旧映射并登记旧 `target`，供安装脚本清理旧文件；仅改变来源而安装目标不变时不登记删除。`remove` 不包含当前有效目标，不使用通配符或整目录清空；只处理明确废弃的小抄文件，保留用户数据。
- **脚本职责**：Python 打包器按映射复制文件、同步暂存版本、极限压缩，再按用户选择决定是否发布 COS。手动和自动安装共用 `install.ps1/release-common.ps1` 与包内映射；自动入口使用本机运行时安装器，不直接执行 ZIP 中的脚本。当前为 9 个业务文件、3 个包根安装工具和 1 份映射，共 13 个文件。Python/SDK/凭据仍仅在开发端，客户端安装使用系统 Windows PowerShell 5.1 和 .NET。
- **输出与使用**：每次打包生成全新的 `electron-next/release/xiaochao-年月日-时分秒-毫秒/` 及同名 `.zip`，保留文件夹，不合并旧目录或覆盖已有 ZIP。业务文件位于包内 `files/`，安装工具和映射位于包根目录，ZIP 内保留一个完整发布文件夹；压缩成功即打开资源管理器并选中 ZIP，之后才开始可选上传，双击脚本结束后保留窗口显示结果。`show_archive -> select_archive_in_explorer` 使用 Windows `SHParseDisplayName/SHOpenFolderAndSelectItems` 传 Unicode 路径，避免把 `/select,"路径"` 作为 Python 参数再次转义而打开错误位置；失败回退 `os.startfile` 打开实际 ZIP 父目录，并说明未选中文件。两个入口都失败时显示绝对路径，不把已完成的打包判为失败。手动安装仍消费解压后的业务载荷；自动安装使用独立暂存目录并保留下载 ZIP。两者都不清空用户目录。
- **极限 ZIP**：默认优先调用 PATH 或标准安装目录中的 `7z.exe`，使用 `a -tzip -mx=9 -mm=Deflate -mfb=258 -mpass=15`；UTF-8 临时列表逐项指定映射文件，完成后清理列表。保留标准 Deflate ZIP，Windows 自带解压可读取。找不到 7-Zip 时使用 Python `zipfile.ZIP_DEFLATED`、`compresslevel=9`。这是两种实现各自的最高压缩设置，不承诺不同压缩器得到完全相同体积。压缩失败返回 1，保留已生成目录，不执行上传。
- **Python 环境与依赖**：2026-10-17 已核实 `C:\Python314\python.exe` 为 Python 3.14.4，pip/TLS/zlib 正常，无须升级解释器。在工程创建 `.venv-release`，安装 [scripts/requirements-release.txt](electron-next/scripts/requirements-release.txt) 中固定版本 `cos-python-sdk-v5==1.9.44`，`pip check` 通过。重建命令（在 `electron-next`）：`python -m venv .venv-release`，然后 `.venv-release\Scripts\python.exe -m pip install -r scripts\requirements-release.txt`。SDK 导入只发生在上传时，`--no-upload` 可仅用标准库/7-Zip 打包。
- **版本来源与交付**：[version.json](electron-next/version.json) 是统一维护入口，采用三个数字分段。在 `electron-next` 执行 `npm run build:userscript`，除装配模块外还同步工作脚本头部 `@version` 与唯一业务常量 `XIAOCHAO_VERSION`；`npm run check:userscript` 同时检查模块和版本是否过期。无需打包即可同步工作脚本，默认不写实际 Roaming。客户端检测仍优先实际加载脚本头部 `@version`，缺失才回退同目录记录，因此单改工程 JSON 而未装配/同步实际文件，不会改变当前客户端。原 `_0x43f342/_0x38a6c4` 已移除，请求参数、标题、更新提示统一引用 `XIAOCHAO_VERSION`。发布端 `scripts/release_version.py` 只调整暂存副本的 `@version/XIAOCHAO_VERSION` 与包内记录，仍兼容旧包的两个混淆常量；`--version` 只覆盖此次交付，不回写工作文件。
- **上传选项 / COS 自动上传**：桌面 `小抄打包.cmd` 与工程入口共用 `package_release.py:choose_upload`。无参数标志时先询问 `1 仅本地打包 / 2 打包并上传到云端`，回车默认1；无交互输入或EOF也仅本地，Ctrl+C取消。`--upload/-Upload` 与 `--no-upload/-NoUpload` 互斥并跳过询问；`--upload-only` 是显式补传，不再询问。仅本地模式不读取 COS 配置、不请求云端。选择上传后，`upload_release` 从 ZIP 内取版本并检查与脚本一致，签名读取已有 `releases/version.json`，拒绝用旧版覆盖较新版本；随后先上传 ZIP、再上传固定路径的 JSON，只有两步都成功才报告发布完成。JSON 为 `version/packageKey/publishedAt`，使用 `application/json; charset=utf-8` 和 `Cache-Control: no-store, max-age=0`。`--upload-only` 也按该 ZIP 内记录发布，不使用后来变更的工程版本。需要所选目录的 `cos:GetObject` 和 `cos:PutObject`；ZIP 仍限单次 5 GB。保持桶原有私有权限，上传配置 `cos-upload.local.json`、环境变量及官方 SDK 使用方式沿原规则，凭据不进入 Git 或发布包。参考 [Python SDK](https://cloud.tencent.com/document/product/436/12269) 和 [PUT Object](https://cloud.tencent.com/document/product/436/7749)。
- **本机更新配置**：主进程使用 `cos-update.local.json` 固定密钥签名 GET，不依赖 Python，不下发凭据到页面，不开放桶 ACL。宿主注入下载目录、共享 installer 和显式 restart 回调；用户点击“下载并安装”后自动完成下载及安装，成功提示“重启客户端 / 稍后”，仅点击重启才退出当前游戏。安装失败可用已下载 ZIP 重试，不重新下载。
- **自动安装与恢复**：`release-install.js` 按目标目录合并任务，隐藏启动本机 `modules/runtime/install.ps1 -ArchivePath <ZIP> -ExpectedVersion <版本> -TargetDirectory <userData>`。PS 用单根目录暂存解压，拒绝路径越界、链接、重复路径、超过 5000 条目或 512 MiB 解压内容；核对协议、映射、包内脚本/版本和目标版本，自动模式拒绝降级。所有将修改的文件先备份并写 `.xiaochao-install-state.json`，逐文件原子替换，主脚本和版本最后写；失败按记录恢复，失败恢复资料保留。下次 `-RecoverOnly` 可继续恢复。`.xiaochao-install.lock` 用系统独占文件锁防跨进程并发，暂存和备份只清理自建 GUID 工作目录，ZIP 保留。
- **手动安装进度与成功判定**：双击 `install.cmd` 默认传 `-ShowProgress`，列出检查、备份、逐文件写入、校验和清理七步，最终显示成功/失败、版本/目录及重启提示，保留窗口。详细输出保存到目标目录 `.xiaochao-install-logs/install-<时间>-<GUID>.log`；失败列出所处步骤与恢复状态。共用安装器在删除事务记录前以 .NET SHA256 核对源/目标内容及废弃文件清理结果，校验失败执行原恢复链。无开关的自动调用继续只输出 `XC_INSTALL_RESULT`；CMD 保持 ASCII、PS1 为 UTF-8 BOM。手动成功仍消费包内业务文件，再次安装需重新解压，脚本会明确提示。仅文件内容变更，无须改发布映射。
- **加载与退出协调**：实际宿主 `read-local-script`、仓库版本地脚本协议读取均先等待 `whenIdle()`；恢复失败时阻止注入，禁止转旧远程脚本兜底。仓库版资源解析优先使用已安装的 Roaming 主脚本。用户在安装途中退出时 `before-quit` 先等安装/恢复结束再退出；关闭窗口不会杀掉正在提交的安装器。成功不热替换页面，重启才完整加载新模块。诊断沿用 `app-log.txt`，不新增控制台日志。
- **固定密钥配置**：打包端模板为 `cos-upload.example.json`，真实文件为被 Git 忽略的 `cos-upload.local.json`，字段 `bucket/region/prefix/secret_id/secret_key`；对应 `COS_BUCKET/COS_REGION/COS_PREFIX/COS_SECRET_ID/COS_SECRET_KEY` 环境变量优先，默认前缀 `releases/`。`.venv-release` 和真实配置均不进入发布包。客户端本机读取配置与打包配置分别维护，业务包只携带无凭据的检查代码。
- **上传失败与重试**：缺少配置/SDK、权限错误或上传失败返回 2，保留 ZIP，打印 `pack.cmd --upload-only "<zip路径>"` 用于不重新打包的补传。网络错误、429、5xx 最多尝试 3 次，每次重新打开文件；403 不重复重试。SDK 关闭内部重复重试及原始日志，错误输出仅含状态/错误码，不打印密钥；收到 ETag 才报告上传完成，避免把重定向响应误判成功。本地 ZIP 已在上传前定位，上传失败不重复打开目录。
- **参数与维护**：`pack.cmd --output-directory <新目录> --sgsol-directory <Roaming来源目录>` 调整路径；`--compression-tool auto|7zip|python` 选择实现；`--no-open` 禁止资源管理器定位；`--upload` 明确上传，`--no-upload` 明确仅本地打包；两者均未指定时按上述交互规则选择；`--cos-config <JSON路径>` 指定认证配置；`--version <版本>` 覆盖本次交付版本；`--upload-only <ZIP路径>` 补传 ZIP 及版本清单，与 `--version` 互斥。原长参数别名保留，旧 `Windows` 压缩选项映射到 Python level 9。打包只同步暂存版本，不自动重建手牌模块；安装仍支持 `install.ps1 -TargetDirectory <安装目录>`。
- **搬运边界**：仅接受各自根目录内的相对文件路径；拒绝越界路径、链接重定向、把有效目标列入 `remove` 或按目录删除。缺失文件/复制移动失败会返回非零退出码，不静默漏文件；自动安装还核对包协议和版本，落盘内容校验沿上述安装链；这些检查不等于游戏内验收。
- **脚本验证**：`node electron-next/tests/release-package.cjs` 在临时目录通过实际 CMD/Python 打包、Windows 自带解压和 PowerShell 安装器验证 12 项：两种 ZIP 的完整内容及顶层目录、中文/空格/方括号路径、覆盖移动、映射增删改名、废弃路径限制、已有 ZIP 和用户配置保留。`.venv-release\Scripts\python.exe tests\release_upload.py`（在 `electron-next`）通过真实 SDK + 回环 HTTP 服务验证上传文件字节、签名、路径编码、重试预算、403、重定向、配置隔离、补传及缺配置时保留 ZIP；不连接真实 COS，不安装到真实 Roaming。真实云上传结果单独记录于架构表，不把回环测试当成云端验收。
- **范围限制**：自动安装只改映射声明的 userData 业务文件，保留账号、用户配置、认证文件、缓存和日志；不更新 Electron 本体、不编译 asar、不自动中断当前对局。事务备份仅用于本次安装失败/中断恢复，不扩展成通用备份框架；主进程日志走 `app-log.txt`，userscript 仍按原规则写调试窗口。
- **版本检查验证**：`tests/release_upload.py` 当前 17 项，包含发布顺序、失败不写版本清单、旧包防倒退和暂存版本隔离。`node electron-next/tests/release-update.cjs` 默认执行离线/回环检查；显式设置 `XC_UPDATE_LIVE_DIR` 可使用指定本机配置读取真实 COS，设置 `XC_UPDATE_HOST_MAIN` 可验证实际宿主包装器。这两项测试拦截 dialog，不弹真实窗口、不安装文件；`XC_UPDATE_TEST_REPORT` 可输出运行引擎与结果。已用实际 Electron 10.4.5 的 Node 12.16.3 验证完整 11 项；真实可见弹窗与游戏场景效果仍由用户启动验收。
- **客户端下载验证**：`node electron-next/tests/release-download.cjs` 默认验证 15 项：目录/同桶限制、官方 SDK 中文签名样例、流式字节、并发及同名文件保留、403/重定向/非 ZIP/超限/中断/超时/磁盘错误、稍后不下载、完成定位、手动重试和关闭清理。设置同样的 `XC_UPDATE_LIVE_DIR/XC_UPDATE_HOST_MAIN` 后增加真实宿主下载检查，目标限定在测试临时目录，核对与已发布 ZIP 字节一致及本地脚本/版本不变；共 16 项，已在实际 Electron 10.4.5 / Node 12.16.3 通过。测试不打开真实弹窗或资源管理器。
- **自动安装验证**：`python electron-next/tests/release_install.py` 验证真实 PowerShell 安装、版本最后提交、写入失败恢复、残留事务恢复、文件锁及坏包/路径/协议/版本边界；`node electron-next/tests/release-auto-install.cjs` 验证下载后自动安装、重试复用 ZIP、窗口关闭不打断提交、读取等待和并发版本隔离。设置 `XC_INSTALL_LIVE_HOST`、`XC_INSTALL_LIVE_USERDATA` 后，实际宿主链路会从真实 COS 下载并只安装到临时副本；测试还验证 before-quit 在提交后才退出，实际 userData 不升级。`XC_UPDATE_TEST_REPORT` 保存引擎/结果。PowerShell 5.1 的 `File.Replace` 第三个参数必须用 `[NullString]::Value`，普通 `$null` 会被转换为空路径；脚本含中文路径，保留 UTF-8 BOM。

检索关键词：`发布映射`、`文件增删`、`release-files.json`、`sourceRoot`、`source`、`target`、`remove`、`Roaming加载文件`、`打包安装`、`同步映射`、`绝对定位`、`桌面打包`、`Python打包`、`极限压缩`、`7-Zip`、`compresslevel=9`、`package_release.py`、`cos_upload.py`、`cos-upload.local.json`、`COS自动上传`、`固定密钥`、`PutObject`、`upload-only`、`no-upload`、`release_upload.py`。

### 验收、回归与文档

- 已落地的局部装配：整理手牌的唯一源码为 `electron-next/src/features/hand-cards.js` 和 `electron-next/src/adapters/hand-cards-client.js`，屏蔽弹幕的唯一源码为 `electron-next/src/features/top-marquee.js`。修改后在 `electron-next` 执行 `npm run build:userscript`，以 `npm run check:userscript` 检查交付脚本是否同步；不要手改主脚本的三个 `GENERATED MODULE` 区块。装配只更新登记区块及上述两处版本值，不生成 asar，其余手写内容保留。版本同步验证为 `node tests/userscript-version.cjs` 和 `python tests/release_version.py`；各业务模块验证入口见架构表。

- 修改前从需求确定可观察行为及适用场景。简单任务可直接体现在验证与最终说明中，不强制另写方案文件；涉及取舍时在进度中简要说明选择及影响。
- 对关键选牌、状态写入、异步重试和共享挂钩变更，运行相关既有测试；有覆盖缺口时补能证明行为的用例。按改动风险覆盖无上下文、数量限制、重复初始化、晚到数据、切场/重建、关闭/清理及共用入口相邻功能，不要求每次完整扫描所有功能。
- 修复已有缺陷时，有可执行复现就验证修前失败、修后通过；依赖桩应依据已核实的客户端行为或实际证据。不要只断言函数存在、返回成功或某行源码匹配，也不要让模拟桩重复实现同一错误假设。
- 语法检查、单元/模拟测试、真实 DOM 验证、游戏内实测分别表述。数值写入和接口调用不能单独证明图标、选牌或动画效果正确；无法游戏内验证时明确剩余验收点。纯文案、样式和规则文档按风险检查，不为低影响改动强制新增框架或机械测试。
- 在 [代码架构表](doc/代码架构表.md) 对应功能节补充本次涉及的职责边界、状态归属、依赖接口、初始化/清理链及回归/回退要点；已存在的内容只更新变化，不复制整张清单。仅当确有混淆映射或手工核实链变化时更新彩虹表 `manualLookupNotes`。
- 架构约束统一维护在本节，`AGENTS.md` 保留核心要求，相关技能负责发现和执行；功能文档记录已实现事实，不把建议中的类名、模块文件或构建流程写成已存在。仅规则文档修改不必改动业务架构表或彩虹表。

检索关键词：`业务模块`、`状态归属`、`显式依赖`、`生命周期`、`幂等初始化`、`挂钩协作`、`跨 IIFE`、`渐进拆分`、`单文件交付`、`可观察验收`、`相邻功能回归`。

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
