# Repository Agent Instructions

This workspace contains a patched Electron wrapper and the `daxiaochao.user.js` userscript. Before changing or reviewing userscript behavior, build context from the local docs first.

## Required Context Lookup

- Search `doc/` before source edits, especially:
  - `doc/代码架构表.md`
  - `doc/彩虹表.js`
  - any task-specific notes under `doc/*.md`
- For obfuscated or minified `electron-next/resources/daxiaochao.user.js` work, use `doc/彩虹表.js` before guessing string meanings.
- Check `DAXIAOCHAO_RAINBOW_TABLE.manualLookupNotes` for hand-verified workflows, then fall back to `tables[decoder].all` and `tables[decoder].used`.
- When the task involves 小抄, 彩虹表, 自动手气, 自动刷牌, 本地皮肤, 卡背, or debug panel behavior, use the `daxiaochao-doc-rainbow` skill if it is available.
- 日志输出规则：不要使用 `console.log`、`debug` 或其他仅输出到开发者控制台的调试输出；userscript 调试日志统一通过 `appendLocalSkinDebugLine()` 写入调试窗口。只有用户明确要求开发者控制台日志时才允许例外。
- 打包规则：不要编译或重新生成 `asar` 文件；只修改源码和必要文档，除非用户明确要求编译 `asar`。
- 排查规则：不要默认怀疑代码新旧或要求用户反复确认文件版本；应优先检查并修复实际运行链路、调用条件和日志出口。

## Documentation Updates

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
