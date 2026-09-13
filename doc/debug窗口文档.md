# debug 窗口文档

## 2026-09-13：关闭调试后禁止日志唤起窗口

- 用户反馈关闭“打开调试”后仍被自动拉起。已复现：`__xcAutoSQKDebugLog("deal:start")` 在关闭状态仍执行探针，调用 `appendLocalSkinDebugLine(...,true)`；真实面板函数允许 `force` 绕过 `XC.isDebug`，再调用无开关检查的 `ensureLocalSkinDebugPanel()` 创建/显示窗口。其他强制错误日志和异步 block 也存在同一路径。
- 现统一在 `appendLocalSkinDebugLine`、`beginLocalSkinDebugBlock` 和 `ensureLocalSkinDebugPanel` 检查 `window.XC.isDebug`。`force` 只保留参数兼容，**不得绕过用户关闭的调试开关**；此规则取代下文历史记录中的“强制写调试窗口”行为。关闭时丢弃日志，不缓存到下一次打开。
- 开关设置、关闭时移除面板/清理 Worker/分片任务、再次手动打开、开启状态下场景重建面板仍按原链路工作。保留核心安全日志桥和业务/身份探针执行，避免日志关闭影响移牌状态。
- `node electron-next/tests/debug-panel-visibility.cjs` 使用实际函数和模拟 DOM，10 项通过；同一检查修复前 8 项失败，明确复现关闭状态下的强制唤起。对实际客户端脚本 `--source C:\Users\97349\AppData\Roaming\SGSOL\三国杀打小抄.js` 验证通过，另外 20 项可见牌回归也通过。
- 已备份并同步客户端真实读取的用户脚本，保持 CRLF；备份位置、实际加载链和回滚说明见 `doc/代码架构表.md` 的“调试窗口关闭后被强制唤起”。需页面重载或退出重开客户端后生效，未编译 asar。
- 关键词：`关闭后强制拉起`、`force=true`、`debugPanelVisibility`、`ensureLocalSkinDebugPanel`、`appendLocalSkinDebugLine`、`beginLocalSkinDebugBlock`、`XC.isDebug`、`deal:start`、`debug-panel-visibility.cjs`。

## 2026-07-08 第 1 段：读取任务记录

- 已读取 `doc/本地皮肤按钮改造任务记录.md`。
- 确认上一轮本地皮肤按钮逻辑集中在 `electron-next/resources/daxiaochao.user.js` 末尾非混淆段。
- 本轮目标：在本地皮肤按钮旁新增“打开调试”按钮，将 `isOpenCopy` 改为 `isDebug`，并把后续日志统一输出到调试窗口。
- 当前工作区已有与本轮无关的删除/新增状态，本轮不回滚用户已有改动。

## 2026-07-08 第 2 段：收窄范围

- 用户明确本轮暂不处理 `local-skin-enable.js`，后续独立 JS 另行处理。
- 本轮只处理 `electron-next/resources/daxiaochao.user.js` 小抄脚本本身。
- 新增要求：删除与皮肤调试无关的日志打印。
- 新增要求：调试窗口内增加“接口打印”开关，关闭时不打印接口数据，且该开关允许开启和关闭。

## 2026-07-08 第 3 段：定位改造点

- 已定位 `electron-next/resources/daxiaochao.user.js` 末尾非混淆块。
- 外部按钮入口在 `insertLocalSkinButton()` 和 `layoutLocalSkinButton()`。
- 内联皮肤调试入口在 `runLocalSkinEnableInline()`。
- 旧字段 `window.XC.isOpenCopy` 只在内联皮肤调试块中控制调试面板显示和日志追加，本轮改为 `window.XC.isDebug`。
- 接口响应打印集中在 `state.respHook` 的 `appendDebugLine('服务端响应 ...')`，本轮会加独立开关控制。

## 2026-07-08 第 4 段：字段改名

- 已将 `electron-next/resources/daxiaochao.user.js` 非混淆块中的运行字段从 `window.XC.isOpenCopy` 改为 `window.XC.isDebug`。
- 本段只改字段引用，不改按钮布局和日志策略。

## 2026-07-08 第 5 段：调试窗口工具外提

- 已新增外层 `getLocalSkinDebugState()`，复用 `window.__localSkinDebug` 状态对象，避免本地皮肤未启动时无法打开调试窗口。
- 已新增外层 `ensureLocalSkinDebugPanel()` 和 `appendLocalSkinDebugLine()`。
- 调试窗口内已加入“接口打印”复选框，状态保存为 `state.printResp`，默认开启。
- 本段只新增工具函数，暂未接按钮和日志调用。

## 2026-07-08 第 6 段：新增调试按钮

- 已新增 `DEBUG_SWITCH_ID` / `DEBUG_TEXT` / `DEBUG_LABEL_ID`。
- 已把浮动文字抽为 `ensureFloatingLabel()`，本地皮肤按钮继续用 `ensureLocalSkinLabel()`。
- 已把按钮布局抽为 `layoutClonedSwitchButton()`：本地皮肤使用第 1 个偏移列，打开调试使用第 2 个偏移列。
- 已让 `findLocalSkinLayoutParent()` 按目标列数判断父容器宽度，避免“打开调试”第二列被窄父容器夹回原位。
- 已新增 `insertDebugButton()`，等待 `#cardBackThemeSwitch` 时和本地皮肤按钮一起插入。
- “打开调试”开关打开时设置 `window.XC.isDebug = true` 并打开调试窗口；关闭时设置为 `false`。

## 2026-07-08 第 7 段：日志输出统一

- 已让内联 `ensureDebugPanel()` 复用外层 `ensureLocalSkinDebugPanel()`。
- 已让内联 `appendDebugLine()` 统一调用外层 `appendLocalSkinDebugLine()`。
- 已将内联 `log()` 从 `console` 输出改为写入调试窗口，且受 `window.XC.isDebug` 控制。
- 已删除 `debugSkinResp` 触发 `debugger` 的调试方式。
- 已删除 `state.diag()` 内的 `console.log('[local-skin-debug] diag:', info)`，改为只写调试窗口。
- 已让 `服务端响应 ... deepDump(first)` 受调试窗口内“接口打印”开关控制；关闭时仍保留必要的 pendingSkin 修改日志。
- 已将 `notifyLocalSkinError()` / `notifyLocalSkinInfo()` 的无 tooltip fallback 从 console 改为强制写调试窗口。

## 2026-07-08 第 8 段：调试按钮可见性修正

> 本段方案已在第 9 段撤销，保留为过程记录。

- 用户反馈“打开调试”开关按钮没出现。
- 检查后判断风险点在第二偏移列：父容器宽度不足时 `maxLeft` 会把按钮夹回到前一列，可能和本地皮肤按钮重叠导致不可见。
- 已给 `layoutClonedSwitchButton()` 增加 `fallbackBelow` 参数。
- `layoutDebugButton()` 仍优先使用第 2 偏移列；如果被父容器夹回，则自动改到本地皮肤同列下一行，优先保证按钮可见。

## 2026-07-08 第 9 段：固定调试按钮在本地皮肤右侧

- 用户确认父容器宽度足够，要求移除下一行兜底，并固定放在本地皮肤同一行右边。
- 已撤掉 `layoutClonedSwitchButton()` 的 `fallbackBelow` 参数和下移逻辑。
- 已将 `insertDebugButton()` 的定位锚点改为 `#localSkinThemeSwitch` 所在容器；找不到时才回退到 `#cardBackThemeSwitch`。
- 已将 `layoutDebugButton()` 改为相对本地皮肤按钮向右偏移 1 列，固定与本地皮肤同一行。

## 2026-07-08 第 10 段：关闭调试窗口

- 用户反馈点击关闭调试后，调试窗口没有关闭。
- 原因：关闭开关只设置 `window.XC.isDebug = false`，并没有隐藏或移除 `#xcDebugPanel`。
- 已新增 `closeLocalSkinDebugPanel()`，关闭时移除面板 DOM，并清空 `state.panelEl` / `state.panelBody` / `state.panelMinimized`。
- 已将 `openDebugFromButton()` 的关闭分支改为调用 `closeLocalSkinDebugPanel()`，不再追加“关闭”日志，避免强制写日志时重新打开窗口。

## 2026-07-08 第 11 段：调试按钮独立 X 偏移

- 用户要求“打开调试”不要复用 `LOCAL_SKIN_COLUMN_STEP`，避免调整调试按钮时同时影响本地皮肤按钮。
- 已新增 `DEBUG_BUTTON_X_OFFSET = 75`。
- 已让 `layoutClonedSwitchButton()` 支持可选 `xOffset` 参数。
- `layoutDebugButton()` 现在使用 `DEBUG_BUTTON_X_OFFSET`；本地皮肤按钮仍使用 `LOCAL_SKIN_COLUMN_STEP`。

## 2026-07-15 第 12 段：接口打印失效修复

- 用户反馈调试窗口“接口打印”看不到数据。
- 原因：旧实现只在 `runLocalSkinEnableInline()` 里的 `installSgsModuleHook()` 安装 `state.respHook`；单独点击“打开调试”只打开 `#xcDebugPanel`，不会安装 `window.SGSMODULE` 响应监听。
- 已新增外层 `installLocalSkinDebugResponseHook()`，复用 `window.__localSkinDebug` 状态，负责安装/重挂 `state.respHook`。
- `openDebugFromButton()` 打开调试窗口时会主动调用 `installLocalSkinDebugResponseHook()`；如果 `window.SGSMODULE` 还没初始化，会最多重试约 20 秒，并在调试窗口输出 `接口监听：等待 SGSMODULE 初始化` / `接口监听：已安装`。
- `runLocalSkinEnableInline()` 内的 `installSgsModuleHook()` 不再内联创建另一份响应 hook，改为复用外层 `installLocalSkinDebugResponseHook()`，避免本地皮肤和调试窗口路径行为不一致。
- “服务端响应 ...”不再强制要求 `className` 包含 `skin`，只要响应对象有 `className` / `WindowName` / `Protocol.className` / `Protocol.ProtoObj.className` 即可打印；`ChangeSkinWindow` 仍跳过，避免窗口启动事件污染接口日志。
- 本地皮肤替换相关的 `pendingSkin` 修改逻辑仍只在皮肤相关响应或实际含 `GeneralSkinList` 时执行，避免开着接口打印时被无关事件刷屏。
- 当 `pendingSkin` 等待替换时，`state.respHook` 只记录皮肤候选响应（名称包含 `skin`、`GsCUpdateRoleDataExNtf` / `GsCUpdateRoleDataNtf`，或带 `GeneralSkinList`）；`MsgActionStateNtf` 等普通通知不再打印，避免刷屏。
- 关键检索词：`installLocalSkinDebugResponseHook`、`openDebugFromButton`、`state.respHook`、`state.printResp`、`服务端响应`、`接口监听`、`SGSMODULE`。

## 2026-07-15 第 13 段：接口打印子线程与分片输出

- 用户反馈调试窗口打印完接口数据后直接卡死，并明确要求不要限制输出长度，允许不实时打印。
- 原因：旧链路在 `state.respHook` 内同步执行 `deepDumpLocalSkinDebug(first)`，再用 `appendLocalSkinDebugLine()` 一次性写入完整文本；大响应会同时卡住 JSON 序列化和 DOM 插入。
- 已新增 `queueLocalSkinDebugResponseDump()`：`state.respHook` 现在只把 `服务端响应 ...` 入队，不再在接口回调里同步 dump。
- 已新增 `createLocalSkinDebugDumpWorker()`：优先用 Web Worker 在子线程完整 `JSON.stringify` 响应对象，保留循环引用、函数、BigInt、Map、Set、TypedArray 的可读兜底输出，不做长度截断。
- 已新增 `beginLocalSkinDebugBlock()` / `queueLocalSkinDebugBlockChunk()` / `flushLocalSkinDebugChunks()`：Worker 返回的数据按 64KB 左右分片进入主线程，主线程每帧只追加有限字符，最终输出完整数据。
- Worker 不可用、创建失败或 `postMessage` 无法克隆响应对象时，会显示 `fallback` 标记并改用主线程兜底打印；第 14 段已把这个兜底改成分时遍历和分片输出，不再同步 `deepDumpLocalSkinDebug()`。
- “清空”调试窗口会终止当前 Worker、清空待写分片；关闭调试窗口也会终止后台 dump 队列，避免关闭后继续占用 CPU。
- 关键检索词：`queueLocalSkinDebugResponseDump`、`createLocalSkinDebugDumpWorker`、`beginLocalSkinDebugBlock`、`queueLocalSkinDebugBlockChunk`、`flushLocalSkinDebugChunks`、`stopLocalSkinDebugDumpWorker`、`子线程`、`分片输出`、`fallback:postMessage-failed`。

## 2026-07-15 第 14 段：不可克隆响应的 fallback 卡死修复

- 用户反馈出现 `响应对象无法发送到子线程，改用延迟主线程打印` 后仍然卡死。
- 原因：`postMessage` 失败说明响应对象里有函数、DOM、Window、Proxy 等不可结构化克隆的内容；旧 `queueLocalSkinDebugFallbackDump()` 用 `setTimeout` 延迟后仍调用同步 `deepDumpLocalSkinDebug(job.payload)`，只是晚一点卡住主线程。
- 已将兜底改为 `fallback-incremental`：`queueLocalSkinDebugFallbackDump()` 只入队，`runLocalSkinDebugFallbackDumpStep()` 每次最多处理一小段对象遍历，再通过 `queueLocalSkinDebugBlockChunk()` 分片写 DOM。
- 兜底遍历完整保留普通对象、数组、Map、Set、TypedArray 的内容；循环引用输出 `[Circular]`，函数 / BigInt / undefined / Symbol 输出可读占位，属性 getter 抛错时输出 `[Thrown: ...]`。
- DOM、`window`、`document` 不能也不应该展开成完整对象树，兜底会输出 `[DOM ...]` / `[Window]` / `[Document]`，避免把页面运行环境整棵对象树打印进日志。
- 用户看到的文案已改为 `改用分片主线程打印`；这条路径不追求实时，但不会再同步全量 stringify。
- 关键检索词：`fallback-incremental`、`runLocalSkinDebugFallbackDumpStep`、`processLocalSkinDebugFallbackFrame`、`pushLocalSkinDebugFallbackValue`、`quoteLocalSkinDebugString`、`响应对象无法发送到子线程`、`分片主线程打印`。

## 2026-07-15 第 15 段：聊天通知接口过滤

- 用户反馈接口打印里出现大量 `服务端响应 decodeSSCChatmsgNtf ...` 聊天通知数据。
- 已新增 `isLocalSkinDebugResponsePrintIgnored()`；它只过滤 `queueLocalSkinDebugResponseDump()`，不能阻断 `pendingSkin` 的本地皮肤替换；第 16 段已将规则来源改为可配置列表。
- 默认过滤规则包含 `decodeSSCChatmsgNtf`，响应名以前缀命中时跳过 Worker、fallback 和 DOM dump，但仍允许本地皮肤替换链路处理响应。
- 日志收敛：`state.pendingSkin` 成功替换后立即清空；接口 dump 只在 pending 期间且响应被判定为皮肤候选时入队，避免普通接口和后续重复响应刷屏。
- 关键检索词：`decodeSSCChatmsgNtf`、`isLocalSkinDebugResponsePrintIgnored`、`接口打印过滤`、`聊天通知接口过滤`。

## 2026-07-15 第 16 段：接口拦截配置窗口

- 用户要求调试窗口新增“配置”按钮，打开后可以维护数量不固定的接口打印拦截规则，并本地保存，避免每次新增过滤都改代码。
- 已在调试窗口头部新增 `配置` 按钮，点击后在日志区域上方展开 `接口拦截配置` 面板。
- 拦截规则是响应名前缀列表：每一行一个前缀，`isLocalSkinDebugResponsePrintIgnored(name)` 用 `text.indexOf(rule) === 0` 判断是否跳过。
- 规则保存在 `localStorage["xcLocalSkinDebugIgnoreRules"]`，默认值是 `["decodeSSCChatmsgNtf"]`；用户保存过后尊重本地配置。
- 配置窗口支持“添加 / 删除 / 保存 / 关闭”。编辑和删除只改当前面板，只有点击“保存”才写入本地存储。
- 关键检索词：`DEBUG_IGNORE_RULES_STORAGE_KEY`、`xcLocalSkinDebugIgnoreRules`、`DEFAULT_DEBUG_IGNORE_RULES`、`openLocalSkinDebugConfigPanel`、`toggleLocalSkinDebugConfigPanel`、`saveLocalSkinDebugIgnoreRules`、`接口拦截配置`。

## 2026-07-26 第 17 段：打开配置文件按钮

- 用户要求在调试窗口 `配置` 展开后的三个按钮旁新增 `打开配置文件` 按钮。
- 已在 `接口拦截配置` 面板操作区加入 `打开配置文件`，位置在 `保存` 和 `关闭` 之间。
- 点击链路优先走 `openLocalSkinDebugConfigFile()` -> `window.daxiaochaoElectron.openConfigFile()` -> IPC `open-config-file` -> Electron `shell.openPath(userData/config.json)`。
- 主进程会在 `config.json` 不存在时先创建 `{}`，打开失败时调用 `shell.showItemInFolder()` 并把错误回传到调试窗口日志。
- 注意：接口拦截规则仍保存在页面 `localStorage["xcLocalSkinDebugIgnoreRules"]`；本按钮打开的是 Electron 外壳配置文件 `app.getPath("userData")/config.json`。
- 关键检索词：`打开配置文件`、`openLocalSkinDebugConfigFile`、`daxiaochaoElectron.openConfigFile`、`open-config-file`、`configFilePath`、`userData/config.json`。

## 2026-07-26 第 18 段：配置文件接口不可见修复

- 用户反馈点击 `打开配置文件` 后日志显示 `当前环境没有 Electron 配置文件接口`。
- 原因：小抄脚本运行在 webview 页面主世界，`window.daxiaochaoElectron` 可能因为 webview preload 未注入、context bridge 不可见、或客户端未重启而拿不到。
- 已新增共享主进程实现 `electron-next/src/electron/configFile.js`，`open-config-file` IPC、`atom://open-config-file` 协议、`window.open("atom://open-config-file")` 拦截都复用同一个 `openConfigFile()`。
- `openLocalSkinDebugConfigFile()` 现在优先调用 `window.daxiaochaoElectron.openConfigFile()`；如果接口不存在，则改用 `fetch("atom://open-config-file")`，再兜底 `window.open("atom://open-config-file")`。
- 这类主进程 / 协议处理改动需要重启 Electron 客户端后生效；只重新加载小抄脚本不会刷新主进程代码。
- 关键检索词：`配置文件接口不可见`、`openLocalSkinDebugConfigFileByAtom`、`atom://open-config-file`、`configFile.js`、`openConfigFile`、`window.open("atom://open-config-file")`。

## 2026-07-26 第 19 段：接口拦截新增行置顶

- 用户反馈接口拦截规则很多时，点击 `添加` 后新行出现在底部，来回滚动耗时。
- 已将配置面板内 `addRow(value)` 扩展为 `addRow(value, prepend)`；已有规则渲染仍按保存顺序追加，只有点击 `添加` 时调用 `addRow("", true)`。
- 新增空行现在插入到列表顶部，并立即设置 `panel.scrollTop = 0` 后聚焦输入框，便于连续录入新规则。
- 关键检索词：`新增行置顶`、`addRow("", true)`、`list.insertBefore`、`panel.scrollTop = 0`、`接口拦截配置`。

## 2026-08-01 第 20 段：打开调试时补跑八人 PVE 身份探测

- 实测只有 `调试窗口已打开` 和自动手气配置日志时，说明身份显示的 `room.ready/game.start/deal:start` 入口可能发生在调试开启之前；旧 `openDebugFromButton()` 只打开面板和接口监听，不会补跑身份显示。
- 实测 v4 显示 `schedulerReady=true/localExecutorReady=false`：原因是核心和调试窗口分属两个 IIFE，按钮作用域里的页面全局 `laya` 不是核心闭包内的 `laya`，因此看不到其 `figureOut`。
- 核心 IIFE 现在导出 `window.__xcRunEightPveFigureOut(source,attempt)`，调试 IIFE 导出 `window.__xcAppendLocalSkinDebugLine`；身份执行和日志均通过显式作用域桥连接。
- `openDebugFromButton()` 的 v5 分支固定输出 `debug-open:v5-dispatch`，通过执行桥调用真实 `figureOut` 并输出 `v5-direct-result/v5-direct-error`；最后调用 scheduler 并输出含 `retry/reason/message` 的 `v5-scheduler-result`。
- v5 实测进一步定位到 `figureManager.Figure` 为 getter-only，旧直接赋值抛 `Cannot set property Figure ... which has only a getter`。执行器现使用 setter/backing key/`seat.figure`/实例自有属性的兼容写入链，`figure-out:result` 会打印实际 `writeModes` 和 descriptor 摘要。
- 后续实测 `applied=7/writeFailed=0` 但图标仍不可见，说明只改 `figureValue` 没有触发原生 UI 刷新。执行器现同步 `seat.figure`，调用 `rightView.UpdateFigureList/__UpdateFigureList` 并对身份管理器和座位 UI 执行 `repaint()`；结果日志新增 `modelSynced/modelSyncFailed/repainted/refreshFailed/rightViewRefresh/refreshErrors`，便于区分状态写入与显示刷新。
- userscript 初始化后另有 `script.bootstrap` 延迟入口，覆盖脚本中途加载、已经错过进房和开局通知的场景。
- 实测出现 `debug-open:dispatch {"schedulerReady":true}` 后仍完全无身份日志，定位为旧 scheduler 在 `eightPveFigureRetryTimer` 为真时直接返回；timer 若已被场景生命周期清理，本地句柄不会自动归零，会永久吞掉所有新入口。
- scheduler 现在每次新触发都先清理并替换旧 timer，并输出 `scheduler:start/invoke/result`；因此 `debug-open:dispatch` 后至少能看到执行器存在性和明确返回原因。
- 关键检索词：`openDebugFromButton`、`debug-open:v5-dispatch`、`v5-direct-result`、`v5-direct-error`、`v5-scheduler-result`、`__xcRunEightPveFigureOut`、`__xcAppendLocalSkinDebugLine`、`debug.open.v5`、`script.bootstrap`、`scheduleEightPveFigureOut`、`八人PVE身份`、`figureValue`、`seat.figure`、`UpdateFigureList`、`__UpdateFigureList`、`rightViewRefresh`、`IIFE`、`作用域桥`。
