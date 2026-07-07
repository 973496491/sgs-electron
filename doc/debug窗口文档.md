# debug 窗口文档

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
