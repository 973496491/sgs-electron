# 打小抄外部链路审计

检查文件：

- `electron-next/resources/daxiaochao.user.js`
- `electron-next/resources/daxiaochao-rainbow-table.js`

范围：小抄脚本中出现的、或通过彩虹表解码出的非 `sanguosha.com` 网络地址和外部站点链接。本文件只记录审计结果，未修改脚本代码。

## 主动或潜在联网链路

| 链路 | 发现位置 | 作用判断 | 备注 | 处理 |
| --- | --- | --- | --- | --- |
| `https://goka.top:8080/` | 彩虹表 `_0x2e57`，请求 URL 构造器使用 | 小抄自己的远端 API 默认基址。脚本会用 `new URL(endpoint, "https://goka.top:8080/")` 拼接口，并追加 `uid` 查询参数。 | 相关接口名包括 `signup?code=`、`timesync`、`setting`、`blacklist`、`gameRecords/save`、`gameRecords/get`、`support?username=`、`getLottery?username=`、`recLottery`、`le`、`CDK`。当前脚本里部分接口会先被本地 `localStorage` 逻辑拦截处理，未拦截时仍可能继续走远端 `fetch`。 | TODO |
| `http://localhost:8080/` | 彩虹表 `_0x2e57` | 本地或开发环境 API 基址候选。 | 已解码且彩虹表标记为使用过，但这次没有确认到当前脚本把它作为实际请求基址。暂按遗留或备用常量处理。 | TODO |
| `https://llsccm.github.io/sgstools/workerloader.js` | 彩虹表 `_0x871b` | 历史/残留的 workerloader 地址；当前脚本未确认到实际调用。 | 精确反查 `_0x871b` 作用域，没有 `_0x871b(299)`、`_0x41a3d0(299)` 或等价调用。下载远端文件后确认其内容与本地 `electron-next/resources/workerloader.js` 统一换行后完全一致。当前 Electron 实际通过 `atom://workerloader.js` 加载本地 worker。 | 已确认：不构成当前运行时远程代码加载 |

## 用户点击后打开的外链

| 链路 | 发现位置 | 作用判断 | 备注 | 处理 |
| --- | --- | --- | --- | --- |
| `https://www.bilibili.com/video/BV1QHx4zVEgq/` | 彩虹表 `_0x2e57` | 黄盖主公小号刷百胜功能的说明或演示视频。 | 相关提示被点击时通过 `openLink(...)` 打开。 | TODO |
| `https://www.bilibili.com/video/BV137e9zgEjk` | 彩虹表 `_0x871b` | 山河图挂机功能介绍视频。 | 满足特定条件时会弹提示，用户点击后通过 `openLink(...)` 打开。 | TODO |

## 用户脚本元数据和运行范围

这些项目本身不代表脚本主动调用 API。它们影响脚本管理器显示信息，或决定用户脚本可以在哪些第三方页面运行。

| 链路或域名 | 元数据字段 | 作用判断 | 处理 |
| --- | --- | --- | --- |
| `https://greasyfork.org/scripts/448004` | `@namespace` | 用户脚本命名空间或来源标识。 | TODO |
| `https://i0.hdslb.com/bfs/new_dyn/17ec41a0ca79633b77399065ab80da3f2138912.png` | `@icon` | 用户脚本图标。脚本管理器可能会加载这张图片。 | TODO |
| `game.4399iw2.com/yxsgs/` | `@match` | 允许脚本在该第三方游戏入口运行。 | TODO |
| `my.4399.com/yxsgs/` | `@match` | 允许脚本在该第三方游戏入口运行。 | TODO |
| `web.kuaiwan.com/kwsgsn/` | `@match` | 允许脚本在该第三方游戏入口运行。 | TODO |
| `wan.baidu.com/microend?gameId=19793595/` | `@match` | 允许脚本在该第三方游戏入口运行。 | TODO |
| `www.7k7k.com/special/sgs/?*` | `@match` | 允许脚本在该第三方游戏入口运行。 | TODO |
| `playgame.iqiyi.com/login/iframe_page_web/top?game_id=146` | `@match` | 允许脚本在该第三方游戏入口运行。 | TODO |
| `game.4399iw2.com/yxxsgs/` | `@exclude` | 阻止脚本在该页面运行。 | TODO |
| `wan.baidu.com/*gameId=19793616*` | `@exclude` | 阻止脚本在该页面运行。 | TODO |
| `h5.7k7k.com/web/H5GAMES.html?gid=960982bec2f555de44ea43ca8a7ef418/*` | `@exclude` | 阻止脚本在该页面运行。 | TODO |
| `qqgame.qq.com/webappframe/?appid=10951` | `@exclude` | 阻止脚本在该页面运行。 | TODO |
| `s118.app1107877410.qqopenapp.com/pc/qqLobby_index.php*` | `@exclude` | 阻止脚本在该页面运行。 | TODO |

## 不按外部网络请求处理

| 字符串 | 发现位置 | 不按外链处理的原因 |
| --- | --- | --- |
| `http://www.w3.org/2000/svg` | 彩虹表解码出的内联 `data:image/svg+xml` 水印样式 | 这是 SVG 命名空间，位于内联 data URI 中，不会向 `w3.org` 发起网络请求。 |

## 建议处理顺序

1. 优先决定是否删除或中和 `https://goka.top:8080/`，因为它是主要远端服务基址。
2. `https://llsccm.github.io/sgstools/workerloader.js` 已核查：当前代码不请求该 GitHub 地址，Electron 使用本地 `atom://workerloader.js`。
3. 决定 B 站和 QQ 群这类用户点击外链是否保留。
4. 决定是否还需要第三方平台的 `@match` 支持。
5. 如果目标是完全无第三方资源引用，再处理 `@icon` 这类元数据链接。

## 2026-07-07 恢复记录

### 已完成小节：恢复当前任务状态

- 用户要求：检查 `https://llsccm.github.io/sgstools/workerloader.js` 这段代码链路的作用，并在每个小节完成后把进度落盘到本文档，方便中断后恢复。
- 当前工作目录：`C:\Users\97349\Downloads\electron`。
- 已确认本地存在 `electron-next/resources/workerloader.js`，长度约 7.3 KB，内容是图片资源缓存与解码用 Web Worker。
- 已确认 `electron-next/src/renderer/renderer.js` 的“开启缓存”菜单不会直接请求 GitHub URL，而是执行 `fetch('atom://workerloader.js')`，读取本地 worker 代码后用 `Blob` 和 `URL.createObjectURL` 创建 `Worker`，再替换 `Laya.WorkerLoader.I.worker`。
- 已确认 `electron-next/src/electron/interceptor.js` 注册 `atom` 协议，把 `atom://workerloader.js` 映射到本地 `resources/workerloader.js`；同文件还会把 `www.desuwa.link/sgs/workerloader.js` 重定向到本地 `workerloader.js`。
- 下一步：继续定位 `https://llsccm.github.io/sgstools/workerloader.js` 在 `daxiaochao.user.js` 混淆代码中的实际调用点，确认它是否会被远程加载，还是只残留在彩虹表常量中。

### 已完成小节：`_0x871b` 字符串表初步定位

- `https://llsccm.github.io/sgstools/workerloader.js` 出现在 `electron-next/resources/daxiaochao-rainbow-table.js` 的 `_0x871b` 解码表中。
- 该表的元信息：`decoder = _0x871b`，`arrayFunction = _0x518b`，`offset = 106`，`sourceIndex = 612251`，`arrayLength = 555`。
- 该 URL 在 `_0x871b` 表里的已解码调用参数是 `299`；同表还包含 `Worker`、`preload`、`WorkerLoader`、`worker`、`script`、`src`、`appendChild` 等与远程加载/worker 相关的字符串。
- 重要注意：不能只用 `a(299)` / `n(299)` 这类通用正则判断实际调用点，因为混淆代码中不同函数会把不同解码器临时别名为 `a`、`n`、`e`。后续必须确认局部别名到底指向 `_0x871b` 还是其它表。
- 下一步：从 `_0x871b` 作用域中精确提取相关函数，替换该表字符串，确认 `https://llsccm.github.io/sgstools/workerloader.js` 是否参与 `new Worker(...)`、动态 `<script src=...>`、或 Laya `WorkerLoader` 初始化。

### 已完成小节：确认 `llsccm.github.io` 链路是否被当前代码调用

- 全局源码搜索结果：`electron-next/resources/daxiaochao.user.js` 中没有明文 `https://llsccm.github.io`、`sgstools`、`workerloader.js`。
- 精确反查 `_0x871b` 作用域结果：在 `_0x41a3d0 = _0x871b` 到下一张表 `_0xd9c1b3 = _0x138e` 之间，没有 `_0x871b(299)`、`_0x41a3d0(299)` 或等价调用，也没有直接调用同表的 `Worker`、`WorkerLoader`、`preload`、`script`、`src` 索引。
- 因此 `https://llsccm.github.io/sgstools/workerloader.js` 在当前 `daxiaochao.user.js` 中更像是混淆字符串表残留，未确认到实际运行路径会请求这个 URL。
- 已用 `curl.exe -L https://llsccm.github.io/sgstools/workerloader.js` 下载远端文件到临时文件 `tmp-llsccm-workerloader.js` 进行比对。
- 远端文件与本地 `electron-next/resources/workerloader.js` 统一换行后 SHA256 完全一致：`e48bea42f378fdb71fff184d4598fc122b215620e1a5c6e2da78ec9083ee2def`。原始文件哈希不同是因为本地文件使用 CRLF，远端文件使用 LF。
- 当前 Electron 实际加载链路在 `electron-next/src/renderer/renderer.js`：菜单“开启缓存”执行 `fetch('atom://workerloader.js')`，读取本地 worker 文本，用 `Blob` / `URL.createObjectURL` 创建 `Worker`，再替换 `Laya.WorkerLoader.I.worker`。
- `electron-next/src/electron/interceptor.js` 负责把 `atom://workerloader.js` 映射到本地 `resources/workerloader.js`；同文件还保留 `www.desuwa.link/sgs/workerloader.js -> workerloader.js` 的本地重定向，但没有处理 `llsccm.github.io`。
- 下一步：总结 `workerloader.js` 的具体作用和风险边界，更新上方 TODO 处理建议。

### 已完成小节：`workerloader.js` 作用总结

- `workerloader.js` 是给 Laya `WorkerLoader` 使用的图片加载 worker，不是小抄远端 API 客户端。
- 主线程向 worker 发送图片 URL；worker 先按 URL 路径选择 CacheStorage 分区，例如 `caches-window`、`caches-skin`、`caches-game`、`caches-animate`、`caches-runtime`、`caches-shop` 等。
- 对静态资源会去掉版本查询参数作为缓存 key；对 `/window/` 资源会用 `etag` / `last-modified` 做一次协商缓存校验。
- 缓存命中时读取 `arrayBuffer`，再通过 `createImageBitmap` 解码图片，并用 `postMessage(data, [imageBitmap])` 把 `ImageBitmap` 传回主线程。
- 缓存未命中时执行 `fetch(link)` 下载图片；除 `/Ad` 广告路径外，会把响应写入 CacheStorage。
- 它会访问的网络地址取决于主线程传入的图片 URL，正常是 `web.sanguosha.com` 的游戏资源；脚本本身没有硬编码 `goka.top`、`llsccm.github.io`、`desuwa.link` 等外部 API。
- 风险边界：如果运行时真的从 GitHub URL 创建 worker，那就是远程代码加载风险；但当前 Electron 代码没有走这条路径，而是通过 `atom://workerloader.js` 使用本地同内容文件。
- 恢复点：本轮 `https://llsccm.github.io/sgstools/workerloader.js` 链路已核查完毕。下一步若继续外链审计，应回到 `https://goka.top:8080/` 远端 API 链路，或决定是否处理 B 站/第三方平台 `@match` 链路。

### 已完成小节：删除影响评估

- 运行脚本 `electron-next/resources/daxiaochao.user.js` 中没有明文 `https://llsccm.github.io/sgstools/workerloader.js`、`llsccm.github.io`、`sgstools/workerloader.js` 或 `workerloader.js`。
- 当前可直接删除/替换的可见文本只有生成物 `electron-next/resources/daxiaochao-rainbow-table.js` 中 3 处，以及本文档中的审计记录。
- 如果目标只是阻止运行时访问这条 GitHub 链路：当前无需改业务代码，因为没有确认到运行路径会访问它。
- 如果目标是让审计搜索完全看不到这条 URL：可以改 `daxiaochao-rainbow-table.js` 的 3 处生成物记录，但这只是移除解码索引/报告，不改变运行行为；更规范的做法是重新生成彩虹表或在审计规则里标记为残留。
- 不建议手动从混淆后的 `daxiaochao.user.js` 字符串数组中“删除”该编码项。混淆解码器按数组位置和旋转后的索引取值，直接删除一个元素会导致后续索引整体错位，容易造成大量字符串解码错误和脚本异常。
- 如果必须改运行脚本里的编码值，只能在充分确认索引未被调用的前提下把该单个数组元素替换成惰性占位字符串，不能删除数组元素；完成后还需要重新生成彩虹表并验证关键功能。

## 2026-07-08 替换记录

### 已完成小节：非 `sanguosha.com` 域名等长占位

- 修改文件：`electron-next/resources/daxiaochao.user.js`、`electron-next/resources/daxiaochao-rainbow-table.js`。
- 替换方式：只替换域名/主机名本体，保留协议、路径、端口、通配符和数组结构；每个占位符长度与原主机名完全一致。
- 已替换主机名：`game.4399iw2.com`、`greasyfork.org`、`h5.7k7k.com`、`i0.hdslb.com`、`my.4399.com`、`playgame.iqiyi.com`、`qm.qq.com`、`qqgame.qq.com`、`s118.app1107877410.qqopenapp.com`、`wan.baidu.com`、`web.kuaiwan.com`、`www.7k7k.com`、`goka.top`、`llsccm.github.io`、`localhost`、`www.bilibili.com`、`www.w3.org`。
- 未替换：`sanguosha.com` 及其子域，例如 `web.sanguosha.com`、`test.sanguosha.com`。
- 验证结果：两个目标文件中，主机名统计只剩 `sanguosha.com` / `web.sanguosha.com` / `test.sanguosha.com`；`panel.style.top`、`rect.top`、`th.style.top`、`tth.style.top` 是正则误报，不是域名。
- 文件大小保持不变：`daxiaochao.user.js` 为 `759140` 字节，`daxiaochao-rainbow-table.js` 为 `836682` 字节。
