# debug 窗口文档

## 2026-11-20后续：调试分区

设置现在按“常用设置、屏蔽设置、普通设置、调试”排列。打开调试localSkinDebugSwitch与十周年皮肤xcTenYearSkinsToggle进入最后的调试分区（内部xcSettingsTrailing），仍保留打开调试为区内最后一项。标题使用原jie-group-title样式，由共享settingsLayout.ensureSections幂等维护；原按钮ID、开关/显隐/日志处理与持久状态沿原链，未新增业务监听或轮询。静态/动态创建、重建后归位的21组设置检查及27项Chromium交互通过，未游戏内实测，部署见架构表“设置面板四分区”。下文此前的“设置末尾网格”记录以本节新标题和分配为准。

## 2026-11-20：打开调试按钮移至设置末尾

用户要求“武将评分”加入设置并将“打开调试”放在最后。原localSkinDebugSwitch由共享settingsLayout移出常规组，放入整个`.setting.panel-content`最后的`xcSettingsTrailing`网格；动态创建、重复布局和设置重建仍保持末位。只改布局位置，原按钮ID/状态、开关handler、窗口显隐、诊断快照、日志分区和接口打印规则保持。真实模板Chromium布局/交互20项、原调试显隐10项及日志分类26项通过，未游戏内实测；具体持久化和部署见架构表“武将评分设置开关”。

## 2026-11-19 补修：八人身份 request:send 旧日志误入调试页

- 实际原因：上一版 `logEightIdentity(label,data,force)` 只把 `interface-probe/settlement-probe/room-context-probe` 和 dispatch 房间探针分给 api，其余标签默认传 `debug`。`getseven -> logEightIdentity('request:prepare'/'request:send',...,true) -> 核心 IIFE 安全代理 -> __xcAppendLocalSkinDebugLine` 因此直接进入 `panelBody`，绕过了接口打印门槛；并非用户开关没关、文件版本未确认或 Worker 漏取消。原测试还把 `record:accepted` 的旧结果日志作为正常区保留项，接受标准本身不完整。
- 修复：旧的 `logEightIdentity` 入口**固定传 api**，不再按少数标签排除后把其它标签提升为 debug；`request:*`（包含用户描述中的 `requese:send` 拼写）、`record:*`、房间/开局/探针以及以后经此入口添加的未知标签全部遵守接口开关。关闭接口打印时两页均不新增这些行；开启后只进入 `接口/心跳` 页。`force=true/false` 均不绕过；同一个响应 `className` 的可选前缀过滤继续沿原桥透传。
- 该入口只负责旧战绩/身份追踪的输出和既有 `localStorage.xcEightIdentityTrace` 历史记录；未改变请求、模式列表、UID、战绩处理、trace 最多200条的存储或对局状态。该独立历史记录不回灌窗口；关闭打印期间不会新增隐藏日志 DOM。新功能必要诊断继续在调用点显式使用 `debug` + `[模块名] 非空正文`，旧包装器不能统一替调用方取得 debug 权限。
- 真实入口验证：抽取实际 `getseven()`，按手工彩虹表已核实的 `_0x47c207=_0x3812` 映射还原依赖：`868=get`、`1634=SevenDayResultWindow`、`158=sendReq`、`1626=uuid`、`530=req`、`1643=from`、`743=del`。接口关闭时仍发送全部 `[26,35,44,5,7,1]`，两页没有 prepare/send；接口开启时发送行为相同，prepare/send 只在接口页。窗口缺失仍不发请求，blocked 同样遵守开关。
- `tests/debug-log-channels.cjs` 从20项扩展至25项，并修正旧结果日志的错误保留断言；新规则在修复前共6项失败，修复后25项全部通过。覆盖未知/误拼标签、force、开关前后、接口页复制、保留独立trace、真正 getseven 请求/阻塞链。调试关闭可见性10项、配置7项、本地皮肤响应顺序19项、userscript 语法及装配检查通过；这些是模拟与文件检查，尚非游戏内实测。
- 回退注意：恢复旧的 `api : debug` 分支会重新放行 request/record 等旧日志；不要以新增标签黑名单代替旧入口默认 api。状态/挂钩/任务生命周期不变，本次未增加发布文件、版本、重试或定时器。
- 同步验收：重新核对实际宿主 `F:/Game/SGSOL/resources/app/main.js` 的 `read-local-script -> %APPDATA%/SGSOL/三国杀打小抄.js` 与 `script/electron_frame.js` 的 `dom-ready` 注入；锁内确认无待恢复事务，按现有发布映射仅备份/原子替换主脚本。部署前源/目标相同，本轮主脚本仅 `logEightIdentity` 一处分类变更；其它未提交功能、模块、账号/用户配置及1.0.13版本记录保留。备份 `C:/Users/97349/AppData/Roaming/SGSOL/.xiaochao-install-work/ff09e8503a2d48d3bb9cded38e9cf146/backup/0`，同目录 `deployment.json` 记录本轮结果；源/目标 SHA256 `35A10ABED98D1DB3E209FD1C18E9C7DE83054F4B9392D82A285DBF21DC6179FB` 一致，部署副本语法及25+10+7项调试检查通过，事务已完成。需重载游戏页面或退出重开客户端后生效；未重启、热注入、生成asar或游戏内实测。

关键词：`八人身份旧日志漏控`、`request:send`、`requese:send`、`getseven`、`logEightIdentity`、`旧包装器固定api`、`record:accepted`、`debug-log-channels.cjs`。

## 2026-11-19：出牌读秒诊断日志（先取证，再修复）

- 用户确认全程无数字后要求先加日志，未授权在此次诊断阶段顺便改计时/补装/控件工厂。新增 `[出牌读秒]` 日志经 `appendLocalSkinDebugLine(...,false,'debug')` 和既有核心桥进入“调试日志”页，接口打印保持关闭即可。总调试关闭不写/不缓存/不打开窗口。
- 安装日志 `install:start/window/result/error` 区分窗口/方法缺失、原型目标缺失、已有保存原方法和成功；首次更新 `update:first/text:create/text:updated` 与 `native:error/text:error` 区分原生回调、控件创建、字号/文字写入。异常仍原对象抛出，既有一次安装、关开关后的行为不变。
- 登录阶段日志通常早于手动开调试。现由 `openDebugFromButton -> xc:play-countdown-diagnose -> playCountdownDiagnostics.inspect` 读取当前状态，未监听输出 `inspect:unavailable core-diagnostics-not-started`；不回放关闭期间日志。读秒的原配置事件同链输出 `inspect source=switch-change`，不执行功能修复。原生handler是否缓存旧引用、当前timer/text/textField尺寸/alpha/颜色、父链/裁切/Stage连接均有摘要。诊断只读现存实例，不构造游戏窗口或取类。
- 私有状态/监听/计时器实例去重归核心 `playCountdownDiagnostics`；setProto入口start，Exit dispose。每次开调试只记录最多16实例的首次/每错误阶段一次，显式快照最多12实例；没有帧日志流、巡检或后台诊断计时器。详细链与回退见架构表“出牌读秒链路核查与诊断日志”。专项17项、日志分类26项、窗口可见性10项及语法/装配检查通过，未游戏内实测。
- 使用：重新加载页面后登录，开启调试并保持“调试日志”页/接口打印关闭；读秒关开一次，开始一局，进度条出现数秒后再关开一次，复制该前缀的全部日志交回分析。当前阶段不宣称已修复读秒。

## 2026-11-19：调试日志与接口/心跳分区，新增日志默认屏蔽规则

本节取代历史记录中的“接口打印默认开启”“所有日志直接写 panelBody”和“接口 dump 仅在 pendingSkin 时输出”。用户允许把旧日志归入可屏蔽类型，并要求以后不符合规则的日志在关闭接口打印时直接不输出。

- 调试窗口有 `调试日志` / `接口/心跳` 两个页签；`panelBody` 只接收合规功能日志，`responseBody` 接收接口、心跳及所有未分类日志。两个 DOM 各自滚动、保留内容；`复制` / `清空` 仅作用于当前页，最小化后恢复所选页。切页不会打开接口打印。
- `state.printResp` 新页面默认 `false`；同页关闭/重开面板保留开关。不新增 localStorage 偏好，不覆盖已有接口前缀配置 `xcLocalSkinDebugIgnoreRules`。关闭接口打印后，接口类日志在入口直接丢弃，不缓存、不序列化、不追加隐藏 DOM；已显示历史内容保留在接口页，需清空时手动清空该页。`force=true` 不能绕过接口开关或 `XC.isDebug`。
- **后续新增日志必须遵守的规则**：只有显式传第三参 `"debug"`，且文本/异步块标题符合 `[模块名] 事件 内容`（非空模块名、右括号后有空白和非空正文）的功能诊断，才能进入正常调试区。接口返回、协议原文、游戏接口检查、重复巡检/心跳必须传 `"api"`。没有类型、类型拼错、显式 debug 但格式不合规，全部降为 api；不能靠加一个 `[模块名]` 自动取得正常日志权限，不能给接口原文标 debug 来规避开关。旧调用未逐项迁移，默认属于可屏蔽日志，因此关闭接口打印时部分既有功能诊断也不再显示；以后按实际排查需要迁移合规的必要事件。

```js
// 操作结果、异常、状态变化等必要功能诊断：明确类型 + 模块前缀。
appendLocalSkinDebugLine('[整理手牌] sort:done count=8', false, 'debug');
// 接口/心跳/检查返回；可选第四参是响应名，沿用接口拦截前缀规则。
appendLocalSkinDebugLine('[接口检查] HeartBeatRep ok=true', false, 'api', 'HeartBeatRep');
// 第一 IIFE 的同名代理已透传第三、四参；其它模块使用现有明确日志依赖或桥：
window.__xcAppendLocalSkinDebugLine('[模块名] action:error reason=...', false, 'debug');
// 异步普通诊断块同样要求合规标题与显式类型；原始响应请走已有 dump 队列。
appendLocalSkinDebugBlockAsync('[模块名] inspect:result', text, false, 'debug');
queueLocalSkinDebugResponseDump('HeartBeatRep', response);
```

- 分类由 `getLocalSkinDebugLogChannel(text,channel)` 统一收口；`appendLocalSkinDebugLine` / `beginLocalSkinDebugBlock` 在创建窗口、构造日志 DOM 之前检查类别和开关。`canPrintLocalSkinDebugResponse(name)` 统一检查总调试开关、接口开关及可选响应名前缀；功能诊断不按响应名过滤。添加日志后回归“接口关闭时合规 debug 可见、未分类/格式错误/api 完全无输出；接口开启时仅出现在接口页”。禁止新增控制台输出或旁路 DOM 写入。
- 关闭接口打印同步调用 `stopLocalSkinDebugDumpWorker()` 和 `clearLocalSkinDebugPendingChunks('api')`：终止 Worker，撤销 post/fallback 队列与定时器，丢弃接口分片；正常诊断的异步分片保留。`responseLogGeneration` 防止旧块重新入队，Worker 回调校验所属实例，旧 Worker 的迟到异常不能停止新 Worker。最终分片写入还校验当前 body、父节点、分类开关和代次。
- 监听继续由 `openDebugFromButton -> installLocalSkinDebugResponseHook -> state.respHook` 幂等接入 `SGSMODULE`。开启接口打印时所有有响应名的非 `ChangeSkinWindow` 响应可入队，保留前缀过滤；本地皮肤 `localSkinSelections.apply` / `pendingSkin` 处理始终执行，关闭打印不拦截游戏业务。核心 IIFE 的 dispatch、dispatch-probe、战绩字段探针透传 api；八人身份旧入口的全部标签现固定 api，取代此前将处理结果默认放行到 debug 的错误分类。外层 interface-probe 直接使用本作用域日志入口，不再错误依赖另一 IIFE 的局部 `logEightIdentity`。皮肤 Tab 的 `巡检心跳：` 及 `[缓存] 巡检心跳：` 在注入的日志适配器归为 api，挂载/选择等事件保留显式 debug。
- 状态由既有 `window.__localSkinDebug` 持有：`activeLogChannel/panelTabs/panelBody/responseBody` 管理窗口，`responseLogGeneration` 管理接口分片身份，原有 dump/fallback 状态继续归日志输出链。窗口关闭或脱离文档重建时终止旧任务、清理节点与拖拽 document 监听；同页重开不会复活旧任务。无对局模式限制，总开关关闭时丢弃所有类型。
- 验证：新增 `tests/debug-log-channels.cjs` 抽取真实函数、桥接和 Tab 日志适配器，初版修前 13 项中 11 项失败，最终扩展为 20 项全部通过；覆盖默认关闭、严格分类、两区滚动/复制/清空、Worker/fallback/迟到回调、面板重建、前缀过滤、无 pending 的接口监听及关闭打印仍处理皮肤。原调试可见性 10 项、配置面板 7 项、皮肤响应顺序 19 项通过。可见牌 33 项中 4 项因现有测试桩缺 `handCards` 失败，对修改前游戏加载副本运行也同样 4 项失败；本次未扩展修改该功能。模拟 DOM/回调验证不等于游戏内验收。
- 回退需整体恢复入口分类、两个日志 body、开关即时取消和异步回调保护；不要只删最终门槛，避免恢复漏控。新测试和文档不属于发布文件，主脚本安装路径不变，无需改发布映射。
- 同步记录：已重新核对 `F:/Game/SGSOL/resources/app/main.js` 的 `read-local-script -> app.getPath('userData')/三国杀打小抄.js` 和 `script/electron_frame.js` 的 `dom-ready` 注入。持 `.xiaochao-install.lock` 独占锁，确认无未恢复事务后按映射备份、暂存、原子替换主脚本，最后将已有工程 `version.json` 1.0.13 同步到安装记录（此前记录仍为1.0.11，实际加载脚本已是1.0.13；未增加工程版本）。本轮操作清单中的 `modules/features/native-skin-tabs.js` 与当前源已一致，跳过覆盖；其它模块和账号/用户配置不动。备份/部署报告：`C:/Users/97349/AppData/Roaming/SGSOL/.xiaochao-install-work/09cde3f18d784c6486fa9cbf099a5bfb/`，`backup/0` 为同步前主脚本，`backup/1` 为版本记录，`deployment.json` 为校验结果；主脚本源/部署 SHA256 `85EE64E34A4BE7EAE4E037125CE815631CECAC13A451872305002132C841A5B3`。部署副本语法、日志分类20项、关闭可见性10项、配置7项通过；装配和版本检查通过，安装状态文件已清除。尚未重载当前游戏页面或游戏内实测；需重载页面/退出重开客户端加载，不热注入、不重启、不生成asar、不发布云端。

提交边界：`appendLocalSkinTabDebugLine` 是调试日志侧拥有的皮肤 Tab 日志适配器，保持心跳/缓存心跳归 api、挂载/选肤事件归 debug 的既有行为。适配器独立于皮肤分页实现，专项直接验证该函数；本次 Git 提交只包含调试日志工具、相关文档和测试，工作区尚未提交的皮肤分页工厂/装配/发布映射/版本改动不混入本提交。

提交前复核：从 Git 暂存区导出独立副本，语法、装配/版本一致性、日志分类20项、关闭可见性10项、配置7项、皮肤响应顺序19项全部通过，不依赖未提交的皮肤分页源码。适配器归属整理后的工作脚本再次按相同安装锁/事务/备份/原子替换流程同步，部署副本37项调试检查通过，SHA256 `452F53B3394C93DBAD43EE6948DCC478B5701552BF55722A1F867B0D058F8635`；本次备份 `.xiaochao-install-work/f1e6bce8be814d06ab6997fa06f59fee/backup/0` 为上一部署脚本，未改变版本或其它安装文件。未热注入或重启游戏。

关键词：`默认屏蔽`、`日志分类规则`、`未分类日志`、`接口/心跳`、`debug-log-channels.cjs`、`getLocalSkinDebugLogChannel`、`canPrintLocalSkinDebugResponse`、`appendLocalSkinTabDebugLine`、`activeLogChannel`、`responseBody`、`responseLogGeneration`、`api`、`debug`。

## 2026-11-19 皮肤Tab消失的普通诊断日志

分页诊断由既有appendLocalSkinTabDebugLine归显式debug，行格式 `[皮肤Tab] #序号 事件 JSON`。总调试必须打开，接口打印可关闭。复现前先打开普通日志，再启用本地皮肤并开/关/重开马超选择器；复制取得窗口、视图登记结果、分页生成的桶数、Tab挂载完成、原生开窗完成、下一帧状态和释放分页日志。异常带阶段/message/短栈，不是接口原文。

不缓存调试关闭时的行、不自动弹窗，不以打开接口打印作为必要条件。分页模块只有调试开启时每次开窗的一次RAF读数，关闭/卸载清理并按页身份拒绝旧回调；无心跳/巡检/补挂。详细诊断状态归属与回归见原生皮肤互通链路3.1.3，尚未取得本轮游戏内日志，未据此宣称修复。

## 2026-09-19 第 21 段：标题改名 + 接口拦截配置单行化

- 用户要求：调试面板标题由 `皮肤调试日志` 改为 `调试日志`；`配置` 展开的 `接口拦截配置` 由“每条规则一行”改为一行、字段用逗号分割，方便一次性取出全部拦截配置；点击 `添加` 仍与现在一致（展开一个新的空行）；点击 `保存` 后把新增行追加到配置行末尾。本轮只改 `C:\Users\97349\Downloads\electron` 项目文件，不动用户目录 `C:\Users\97349\AppData\Roaming\SGSOL\三国杀打小抄.js`，也不编译 asar。
- 标题：`ensureLocalSkinDebugPanel()` 里 `title.textContent` 由 `\u76ae\u80a4\u8c03\u8bd5\u65e5\u5fd7`（皮肤调试日志）改为 `调试日志`；`runLocalSkinEnableInline()` 内 `ensureDebugPanel()` 的不可达副本（`return ensureLocalSkinDebugPanel();` 之后的旧代码）和 `electron-next/resources/local-skin-enable.js` 的旧面板副本同步改名，避免旧入口弹出仍是旧标题。
- 配置行：`renderLocalSkinDebugConfigPanel()` 现在先渲染唯一的配置行 `input[data-xc-debug-ignore-rule-line="1"]`，值为 `getLocalSkinDebugIgnoreRules().join(",")`，即全量拦截前缀；下方是 `addedList` 容器和一行灰色提示。配置行可直接复制整串配置，不必逐行抄。
- 分隔符：新增 `splitLocalSkinDebugIgnoreRuleText(text)`，用 `/[,，、;；\s]+/` 拆分，英文逗号、中文逗号、顿号、分号、空白都算分隔符；空片段丢弃。配置行和新增行都支持逗号分割，新增行里也能一次粘贴多条。
- 新增/保存：点击 `添加` 仍调用 `addRow("", true)`，把空行插入 `addedList` 顶部并 `panel.scrollTop = 0` + 聚焦，行为与第 19 段的“新增行置顶”一致；点击 `保存` 时 `collectLocalSkinDebugConfigRules(root)` 先取配置行，再按 DOM 从上到下取 `input[data-xc-debug-ignore-rule="1"]` 新增行，等价于“新增行追加到配置行最后”，随后重绘回单行，新增行消失。
- 去重与存储：结果仍走 `normalizeLocalSkinDebugIgnoreRules()` 去重（保留首次出现顺序）并写入 `localStorage["xcLocalSkinDebugIgnoreRules"]`；`isLocalSkinDebugResponsePrintIgnored()` 的前缀匹配逻辑未变，保存前后过滤行为一致。新增行上的 `删除` 按钮只删当前面板里的临时行，不影响已保存配置。
- 验证：`node --check electron-next/resources/daxiaochao.user.js`、`node --check electron-next/resources/local-skin-enable.js`、`node electron-next/tests/debug-config-panel.cjs`（新增，7 项：单行渲染、添加行、保存追加到末尾、多行逗号分割按视觉顺序、编辑配置行覆盖、重复去重、标题为 `调试日志`）、`node electron-next/tests/debug-panel-visibility.cjs`（10 项）、`node electron-next/tests/hand-sort-panel.cjs`（37 项）全部通过。未编译 asar，实际客户端需重新加载脚本后生效。
- 关键检索词：`调试日志`、`皮肤调试日志`、`配置行单行`、`配置行逗号分割`、`data-xc-debug-ignore-rule-line`、`splitLocalSkinDebugIgnoreRuleText`、`collectLocalSkinDebugConfigRules`、`新增行并入配置行末尾`、`addedList`、`addRow("", true)`、`debug-config-panel.cjs`、`接口拦截配置`。

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
- 当时 scheduler 每次新触发都先清理并替换旧 timer，并输出 `scheduler:start/invoke/result`；2026-10-08 改为保留原截止点合并 timer，2026-10-16 又增加终止后状态变化唤醒，当前链见下方补记和架构表。
- 关键检索词：`openDebugFromButton`、`debug-open:v5-dispatch`、`v5-direct-result`、`v5-direct-error`、`v5-scheduler-result`、`__xcRunEightPveFigureOut`、`__xcAppendLocalSkinDebugLine`、`debug.open.v5`、`script.bootstrap`、`scheduleEightPveFigureOut`、`八人PVE身份`、`figureValue`、`seat.figure`、`UpdateFigureList`、`__UpdateFigureList`、`rightViewRefresh`、`IIFE`、`作用域桥`。

### 2026-10-16 补记：身份数值不等于图标刷新

- 复用原生客户端快照确认 `figureManager.SetFigure -> setCurrentFigure` 才会更新 `currentFigure.texture/visible`；旧 `figureValue + repaint + rightView.UpdateFigureList` 不会更新座位贴图，旧 `applied>0/rightViewRefresh=UpdateFigureList` 不能证明身份已可见。
- 当前 `figureOut` 优先走 `seatUI.updateFigure -> figureManager.SetFigure`，保留 `SubFigure`、底栏布局、原生本人隐藏偏好；已非零的身份也重绘。仅兼容属性写入时补 `UpdateFigureTex`；缺失刷新能力返回 `figure-ui-refresh-unavailable`。日志新增 `uiUpdated/uiRefreshUnavailable`，`writeModes` 会标明实际原生入口；所有日志仍受调试开关控制。
- 终止缓存不再覆盖整个场景：`getEightPveFigureState` 检测门槛/座位数据/身份模型/UI/贴图变化，后续事件输出 `scheduler:state-changed {source,attempt,previousReason}` 后补执行；同状态继续停止，间隔保持至少1秒，不重置十次重试预算。耗尽后变化只补一次，不新建十次循环。
- 自动回归27项通过，旧代码同套测试14项失败；未进行游戏内视觉实测。回退和完整链路见 [代码架构表](代码架构表.md) 的“八人场 PVE 自动显示身份链路”。
