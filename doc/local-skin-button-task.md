# 本地皮肤按钮改造任务记录

## 2026-07-08 第 1 段：定位

- 已确认 `doc` 目录存在。
- 初步定位到本地皮肤逻辑文件：
  - `electron-next/resources/daxiaochao.user.js`
  - `electron-next/resources/local-skin-enable.js`
- 初步定位到面板和脚本注入入口：
  - `electron-next/src/renderer/renderer.js`
  - `electron-next/resources/local-card-back-enable.js`
- 下一段只读取相关片段，不运行大段代码。

## 2026-07-08 第 2 段：自动加载来源

- `renderer.js` 的 `loadingxiaochao()` 当前只加载：
  - `daxiaochao.user.js`
  - `local-card-back-enable.js`
- 本地皮肤自动加载来自 `daxiaochao.user.js` 末尾追加的自启动块：
  - 使用 `window.__localSkinInlineScheduled` 防重复。
  - 等待 `XC.addTooltip` 或超时后调用 `runLocalSkinEnableInline()`。
- 改造方向：
  - 保留 `runLocalSkinEnableInline()` 的实际本地皮肤逻辑。
  - 移除末尾自启动调度。
  - 暴露一个手动启动函数，供面板按钮点击调用。
  - 按钮开启后当前页面进程内保持不可关闭状态。

## 2026-07-08 第 3 段：按钮接入方案

- 用户要求不要创建独立脚本，改为直接放在小抄主体中，方便后续调整。
- 修正后的方案：
  - 不新增 `local-skin-button-enable.js`。
  - 不改 `interceptor.js` 的资源映射。
  - 直接修改 `electron-next/resources/daxiaochao.user.js` 末尾非混淆段。
  - 保留现有内联 `runLocalSkinEnableInline()` 本地皮肤逻辑。
  - 移除自动等待 tooltip 后加载的调度。
  - 新增非混淆按钮安装逻辑，等待 `#cardBackThemeSwitch` 出现后在其旁边插入“本地皮肤”开关。
  - 点击开关后才执行 `runLocalSkinEnableInline()`；成功后当前页面进程内锁定为开启且禁止关闭。

## 2026-07-08 第 4 段：代码改动

- 已修改 `electron-next/resources/daxiaochao.user.js` 末尾非混淆段。
- 已移除原先的自动加载调度：
  - 不再使用 `__localSkinInlineScheduled`。
  - 不再 hook `XC.addTooltip` 等待小抄提示后自动执行。
  - 不再调用 `waitForXiaoChaoTooltip(0)`。
- 已新增手动按钮逻辑：
  - 等待 `#cardBackThemeSwitch` 出现。
  - 克隆卡牌美化开关所在容器，插入 `#localSkinThemeSwitch`。
  - 文案改为“本地皮肤”。
  - 用户点击开启后执行原有 `runLocalSkinEnableInline()`。
  - 开启成功后设置 `__localSkinButtonLocked`，并将按钮置为选中且禁用。

## 2026-07-08 第 5 段：验证

- 已执行语法检查：
  - `node --check electron-next/resources/daxiaochao.user.js`
  - 结果：通过，无语法错误输出。
- 已执行目标符号检查：
  - `__localSkinInlineScheduled`：仅在本文档历史记录中出现，代码中已移除。
  - `waitForXiaoChaoTooltip`：代码中已移除。
  - `localSkinThemeSwitch`：代码中存在，作为新增本地皮肤开关 ID。
  - `waitForCardBackSwitch(0)`：代码中存在，作为新入口。
- 已补充容器选择条件：
  - 克隆卡牌美化按钮容器时，候选容器必须有文字，避免误克隆只有开关本体的内层元素。
- 备注：
  - 当前目录无法使用 `git status` / `git diff`，Git 报告不是仓库；本次验证改用文件内容检查和 Node 语法检查。

## 2026-07-08 第 6 段：按钮位置修正

- 用户反馈按钮已生效，但位置不对。
- 已调整 `electron-next/resources/daxiaochao.user.js` 末尾非混淆按钮逻辑：
  - 文案改为独立 `#localSkinThemeLabel`，固定放在本地皮肤开关上方。
  - 新增 `findExchangeCodeAnchor()`，优先按 `CDKNotificationSwitch` / `CDK_NOTIFICATION_SWITCH` 找兑换码开关；找不到时按“兑换码 / CDK”文本回退查找。
  - 新增 `layoutLocalSkinButton()`，将本地皮肤开关的 X 轴对齐兑换码按钮，将 Y 轴对齐卡牌美化按钮。
  - 插入后立即布局，并在 100ms / 500ms 后各重算一次，适配面板初始布局抖动。
- 已检查 `doc/彩虹表.js`：
  - 已存在 `cardBackThemeSwitch` 映射。
  - 已存在 `CDKNotificationSwitch` / `CDK` / “找到兑换码”相关映射。
  - 文件头标注 generated / do not edit by hand，因此未手工补充 `彩虹表.js`。
- `doc/代码架构表.md` 当前为空；由于 `彩虹表.js` 已有对应映射，按“如果有则不补充”的要求，本轮未补充架构表。
- 已再次执行 `node --check electron-next/resources/daxiaochao.user.js`，结果通过。

## 2026-07-08 第 7 段：固定布局兜底

- 用户反馈位置仍不对，并允许固定布局。
- 已再次调整 `electron-next/resources/daxiaochao.user.js`：
  - 新增 `isVisibleAnchor()`，避免用隐藏的配置输入作为兑换码坐标。
  - 新增 `findPanelRoot()`，优先在卡牌美化按钮所在设置面板内查找兑换码/CDK 控件。
  - `findExchangeCodeAnchor()` 现在只返回可见控件，并按与卡牌美化按钮的距离排序。
  - 新增 `fallbackFixedLeft()`：找不到可见兑换码控件时，固定放到卡牌美化按钮左侧一列，避免按钮留在原 DOM 插入位置。
  - `layoutLocalSkinButton()` 继续让 Y 轴对齐 `cardBackThemeSwitch`，X 轴优先对齐兑换码控件，失败时走固定兜底。
- 已执行 `node --check electron-next/resources/daxiaochao.user.js`，结果通过。

## 2026-07-08 第 8 段：可见锚点修正

- 用户反馈 X/Y 仍不对，按钮仍在卡牌美化正下方。
- 判断原因：
  - `#cardBackThemeSwitch` 很可能是隐藏配置 input。
  - 直接用它的 `getBoundingClientRect()` 会得到 0 尺寸，导致布局函数提前返回。
  - 返回后按钮保留在 DOM 插入位置，所以表现为在卡牌美化下方。
- 已修改 `electron-next/resources/daxiaochao.user.js`：
  - `visibleControlIn()` 支持 `button`、可见 checkbox/radio、`role="switch"`、`role="button"`。
  - 新增 `findCardBackAnchor()`，从 `#cardBackThemeSwitch` 向外找到卡牌美化的可见控件或可见容器。
  - `findExchangeCodeAnchor()` 和 `fallbackFixedLeft()` 都改用可见卡牌美化锚点。
  - `layoutLocalSkinButton()` 改为按可见锚点中心点对齐，而不是按隐藏 input 的 top/left。
- 已执行 `node --check electron-next/resources/daxiaochao.user.js`，结果通过。

## 2026-07-08 第 9 段：按截图改为设置网格固定列

- 用户提供 `浮层面板.png`，截图显示：
  - 设置区是三列网格。
  - `卡牌美化` 在左列。
  - `兑换码` 在中列。
  - 本地皮肤目标位置应为：卡牌美化同一行、中列。
- 已撤掉上一版复杂的可见锚点/兑换码搜索定位。
- 已修改 `electron-next/resources/daxiaochao.user.js`：
  - 新增 `LOCAL_SKIN_COLUMN_STEP = 90`。
  - `layoutLocalSkinButton(row, source)` 改为相对 `卡牌美化` 所在设置网格父容器绝对定位。
  - `top = 卡牌美化容器 top`。
  - `left = 卡牌美化容器 left + 90px`，即固定移动到中列。
  - 使用父容器相对定位，避免按钮跑出浮层或消失。
- 已执行 `node --check electron-next/resources/daxiaochao.user.js`，结果通过。

## 2026-07-08 第 10 段：X 轴重叠修正

- 用户反馈 Y 轴正确，但 X 轴仍和卡牌美化重叠。
- 判断原因：
  - 上一版用 `source.parentNode` 作为布局父容器。
  - 实际父容器可能只是卡牌美化单元格，宽度约等于按钮自身。
  - `maxLeft` 把 `left + 90px` 夹回 0，导致重叠。
- 已修改 `electron-next/resources/daxiaochao.user.js`：
  - 新增 `findLocalSkinLayoutParent(source)`，向上查找足够宽的设置网格父容器。
  - 只有父容器确实有可用宽度时才限制 `left` 最大值。
  - 保留 `LOCAL_SKIN_COLUMN_STEP = 90` 作为中列偏移。
- 已执行 `node --check electron-next/resources/daxiaochao.user.js`，结果通过。

## 2026-07-08 第 11 段：文字显示修正

- 用户反馈按钮位置大致正确，但缺失文字。
- 已修改 `electron-next/resources/daxiaochao.user.js`：
  - `#localSkinThemeLabel` 强制设置 `color: #f2de9c`、`font-size: 14px`、`visibility: visible`、`opacity: 1`。
  - 本地皮肤按钮容器设置 `height: auto`、`minHeight = 原按钮高度 + 18px`、`overflow: visible`。
  - 目的：避免克隆来的按钮容器高度或 overflow 裁掉上方文字。
- 已执行 `node --check electron-next/resources/daxiaochao.user.js`，结果通过。

## 2026-07-08 第 12 段：文字不撑高按钮

- 用户确认按钮文案应为“本地皮肤”，并指出上一版把文字放进按钮容器导致按钮高度被撑开。
- 已修改 `electron-next/resources/daxiaochao.user.js`：
  - `setLocalSkinLabel()` 只清空克隆来的旧文字，不再把新文字插入按钮内部。
  - 新增 `ensureLocalSkinLabel(row)`，创建独立的 `#localSkinThemeLabel`。
  - `#localSkinThemeLabel` 作为按钮兄弟节点，绝对定位到按钮上方 `top - 18px`。
  - 按钮容器高度恢复为原 `sourceRect.height`，不再使用额外 `minHeight` 撑开。
- 已执行 `node --check electron-next/resources/daxiaochao.user.js`，结果通过。
