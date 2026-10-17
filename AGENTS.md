# Repository Agent Instructions

This workspace contains a patched Electron wrapper and the `daxiaochao.user.js` userscript. Before changing or reviewing userscript behavior, build context from the local docs first.

## Required Context Lookup

- For OL client data, protocol/window/config investigation, or unpacking tasks, read [rules.md](rules.md) and [doc/sanguosha.md](doc/sanguosha.md) before applying the documented methods. `rules.md` is the project workflow entry point; the guide records verified methods and remaining gaps.
- Search `doc/` before source edits, especially:
  - `doc/代码架构表.md`
  - `doc/彩虹表.js`
  - `doc/sanguosha.md` for official OL data, unpacking branches, and derived indexes
  - any task-specific notes under `doc/*.md`
- For obfuscated or minified `electron-next/resources/daxiaochao.user.js` work, use `doc/彩虹表.js` before guessing string meanings.
- Check `DAXIAOCHAO_RAINBOW_TABLE.manualLookupNotes` for hand-verified workflows, then fall back to `tables[decoder].all` and `tables[decoder].used`.
- When the task involves 小抄, 彩虹表, 自动手气, 自动刷牌, 本地皮肤, 卡背, 牌上标记/牌面标记/卡牌标记（如族荀攸百出）, debug panel behavior, or OL client unpacking/protocol/config investigation, use the `daxiaochao-doc-rainbow` skill if it is available.
- 牌面标记任务先读 [doc/牌面标记链路.md](doc/牌面标记链路.md)、架构表同名章节和 `manualLookupNotes.cardFaceMarks`。已核实百出 `3338/BaiChu` 的 `SkillCardRemark -> Card.TagArr1 -> UpdateTag` 链；区别牌模型 `Card.AddCardTag` 与 UI 临时标签 `ui.AddCardTag/DelCardTag`。原生重算会清空 `TagArr1`，持续标记参考 `AddShunJiCardTags` 刷新后补回，保留现有顺机/弹雀/炁挂钩；槽位容量、协议解析和对象复用限制以专项文档为准。
- 日志输出规则：不要使用 `console.log`、`debug` 或其他仅输出到开发者控制台的调试输出；userscript 调试日志统一通过 `appendLocalSkinDebugLine()` 写入调试窗口。只有用户明确要求开发者控制台日志时才允许例外。
- 打包规则：不要编译或重新生成 `asar` 文件；只修改源码和必要文档，除非用户明确要求编译 `asar`。
- 排查规则：不要默认怀疑代码新旧或要求用户反复确认文件版本；应优先检查并修复实际运行链路、调用条件和日志出口。

## Architecture and AI Development

- 修改小抄功能、UI/配置、注入入口或公共挂钩前，阅读 [rules.md](rules.md) 的“小抄架构与 AI 开发约束”。该节是详细开发约束的维护入口；本节保留必须遵守的原则。
- 按业务模块组织增量代码：启动与生命周期、客户端适配、公共基础、独立功能各有职责。模块可用类、对象或闭包实现；有状态和生命周期时考虑类，简单计算用函数，不按按钮、代码行数或固定类数机械拆分。
- 每份可变状态有明确归属，跨模块通过显式接口访问；共享业务状态也指定维护者。禁止通过新增万能类、全局状态袋或相互直接写内部字段延续耦合。
- 功能入口必须从真实加载/事件链可达；订阅、定时器、观察器、DOM 与挂钩明确安装和清理责任。重复初始化应幂等；换局、重建和旧异步回调不得污染当前实例。
- 多功能共用原生方法时复用或协调现有挂钩，保留原调用语义；卸载不得覆盖后来安装的包装器。跨 IIFE 使用明确桥接，禁止假设局部变量或页面同名对象就是目标依赖。
- 采用渐进拆分：新增功能建立边界，旧功能按当前任务迁移必要部分。单文件交付允许内部模块化；分文件时必须接通实际注入链。不得借普通修复默认全量重写、强制引入构建器或生成 asar。
- 发布文件新增、删除、改名或移动时，必须在同一次修改中同步 [electron-next/release-files.json](electron-next/release-files.json) 的 `files/remove`；包内安装工具增删同步 `packageFiles`。打包入口为 [electron-next/pack.cmd](electron-next/pack.cmd)，发布包安装入口为 `install.cmd`。打包与安装共用该配置，不分别硬编码文件清单，也不只依靠目录递归收集。映射须覆盖小抄主脚本、剥离模块及 Roaming 中相关配套加载文件；具体文件、字段和废弃文件处理见 [rules.md](rules.md) 的“发布映射与文件增删”。
- 先确定可观察的验收行为；关键业务变更按风险验证状态、场景、生命周期及相邻功能。语法通过、模拟通过、接口调用成功与游戏内效果分别报告；纯文案/样式等低影响修改不强制新增测试框架。
- 在现有功能文档中记录本次涉及的模块职责、状态归属、依赖接口和初始化/清理链；不把目标架构写成已完成重构，也不另建与架构表重复的链路清单。

## Documentation Updates

- Keep the OL guide at `doc/sanguosha.md`. Persist verified extraction methods and outstanding branches there; update `rules.md` and the related skill only when a reusable workflow changes. Verify local tools/artifacts exist before describing them as available, and distinguish ordinary AES-CFB data from the `_w` WASM branch.
- Any userscript feature implementation, behavior change, bugfix, scene-gate change, config change, or UI switch/handler change must be persisted to the docs before the task is considered complete.
- For changed feature chains, update `doc/代码架构表.md` with the entry point, handler chain, state/config fields, scene restrictions, rollback/regression notes, and high-signal search keywords.
- For obfuscated mappings or hand-verified chains, update `DAXIAOCHAO_RAINBOW_TABLE.manualLookupNotes` in `doc/彩虹表.js` with decoded indexes and searchable notes.
- If a source change genuinely does not need a documentation update, state the reason in the final response.
- If a task uncovers stable decoder mappings, feature chains, scene restrictions, or fragile workflow knowledge, add a concise searchable note to `doc/代码架构表.md`.
- Add manual rainbow-table notes only under `DAXIAOCHAO_RAINBOW_TABLE.manualLookupNotes`; do not hand-edit generated decoder tables unless explicitly regenerating them.
- Keep notes keyword-rich so later searches with `rg` find them quickly.

## Verification

- Run `node --check electron-next/resources/daxiaochao.user.js` after changing the userscript.
- Run `node --check doc/彩虹表.js` after changing manual notes in the rainbow table.
- Before final response, verify the relevant doc keywords are searchable with `rg` when a feature change touched docs.
