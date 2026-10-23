// Exercise the Python packer, relocated CMD launcher, ZIP extraction and PowerShell installer.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const project = path.resolve(__dirname, "..");
const repository = path.dirname(project);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "xc-release-tests-"));
const fixtureRepo = path.join(sandbox, "工程 空间");
const fixtureProject = path.join(fixtureRepo, "electron-next");
const desktopLauncher = path.join(sandbox, "桌面 入口", "小抄打包.cmd");
const roaming = path.join(sandbox, "来源 Roaming", "SGSOL");
const destination = path.join(sandbox, "安装 目录", "SGSOL");
const powershell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
const mapping = JSON.parse(fs.readFileSync(path.join(project, "release-files.json"), "utf8"));
const original = structuredClone(mapping);
let passed = 0;

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function saveMapping() { write(path.join(fixtureProject, "release-files.json"), JSON.stringify(mapping, null, 2)); }
function check(name, action) { action(); passed++; process.stdout.write("PASS " + name + "\n"); }
function quote(value) { return "'" + value.replace(/'/g, "''") + "'"; }
function command(script, args, expected = 0) {
  // Invoke the real CMD wrapper; only this child suppresses the double-click pause.
  const expression = "& " + quote(script) + " " + args.map(quote).join(" ") + "; exit $LASTEXITCODE";
  const result = spawnSync(powershell, ["-NoProfile", "-Command", expression], {
    cwd: os.tmpdir(), encoding: "utf8", windowsHide: true,
    env: { ...process.env, XC_RELEASE_NO_PAUSE: "1" },
  });
  assert.equal(result.status, expected, result.error?.message || result.stdout + result.stderr);
  return result;
}
function pack(name, expected = 0, options = []) {
  const output = path.join(sandbox, "发布 包", name);
  command(desktopLauncher, ["-OutputDirectory", output, "-SgsolDirectory", roaming, "-NoOpen", "--no-upload", ...options], expected);
  return output;
}
function unpack(output) {
  const expanded = output + "-extracted";
  const result = spawnSync(powershell, ["-NoProfile", "-Command",
    "Expand-Archive -LiteralPath " + quote(output + ".zip") + " -DestinationPath " + quote(expanded) + " -ErrorAction Stop"],
  { cwd: os.tmpdir(), encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  const extractedRoot = path.join(expanded, path.basename(output));
  assert.deepEqual(fs.readdirSync(expanded), [path.basename(output)]);
  for (const entry of mapping.files) {
    assert.deepEqual(fs.readFileSync(path.join(extractedRoot, "files", entry.target)), fs.readFileSync(source(entry)));
  }
  for (const entry of mapping.packageFiles) {
    assert.deepEqual(fs.readFileSync(path.join(extractedRoot, entry.target)), fs.readFileSync(source(entry)));
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(extractedRoot, "release-files.json"), "utf8")), mapping);
  return extractedRoot;
}
function install(output, expected = 0) {
  return command(path.join(output, "install.cmd"), ["-TargetDirectory", destination], expected);
}
function source(entry) { return path.join(entry.sourceRoot === "repo" ? fixtureRepo : roaming, entry.source); }
function assertInstalled() {
  for (const entry of mapping.files) {
    assert.deepEqual(fs.readFileSync(path.join(destination, entry.target)), fs.readFileSync(source(entry)));
  }
}

try {
  for (const relative of ["electron-next/pack.cmd", "electron-next/scripts/package_release.py", "electron-next/scripts/cos_upload.py", "electron-next/scripts/release_version.py",
    ...mapping.packageFiles.map(entry => entry.source)]) {
    write(path.join(fixtureRepo, relative), fs.readFileSync(path.join(repository, relative)));
  }
  // File transport does not execute business code; keep fixtures independent of feature commits.
  for (const [index, entry] of mapping.files.entries()) {
    if (entry.source.startsWith("electron-next/scripts/")) {
      write(source(entry), fs.readFileSync(path.join(repository, entry.source)));
      continue;
    }
    const data = /^card-themes\/.+\/manifest\.json$/.test(entry.target) ? fs.readFileSync(path.join(repository, entry.source)) :
      entry.target === "version.json" ? '{"version":"0.0.9"}\n' :
      entry.target === "三国杀打小抄.js" ? '// @version      0.0.9\r\nconst _0x43f342 = "0.0.9";\r\nconst _0x38a6c4 = "0.0.9";\r\n' :
      `// release fixture ${index}\r\n// 中文业务文件\r\n`;
    write(source(entry), Buffer.from(data));
  }
  // Keep the actual launcher behavior, pointing its absolute project path at this fixture.
  const launcher = fs.readFileSync(path.join(project, "pack.cmd"), "utf8")
    .replace(/^set "xcProjectRoot=[^\r\n]*"/m, () => `set "xcProjectRoot=${fixtureProject}"`);
  write(desktopLauncher, launcher);
  const extra = { sourceRoot: "sgsol", source: "加载/额外 [脚本].js", target: "modules/额外 [脚本].js" };
  write(path.join(roaming, extra.source), Buffer.from("// additional loader\r\nwindow.extra = true;\r\n"));
  mapping.files.push(extra);
  mapping.remove.push("modules/old-feature.js");
  saveMapping();
  write(path.join(destination, "config.json"), '{"keep":"user configuration"}');
  write(path.join(destination, "modules/user-note.txt"), "keep this unrelated file");
  write(path.join(destination, "modules/old-feature.js"), "obsolete");
  write(path.join(destination, mapping.files[0].target), "previous version");

  let bundle;
  check("a referenced PNG omitted from the release mapping stops packaging before output", () => {
    const index = mapping.files.findIndex(entry => entry.target === "card-themes/tarot/ranks/2.png");
    assert(index >= 0);
    const removed = mapping.files.splice(index, 1)[0];
    saveMapping();
    try {
      const output = pack("missing-theme-mapping", 1);
      assert(!fs.existsSync(output)); assert(!fs.existsSync(output + ".zip"));
    } finally { mapping.files.splice(index, 0, removed); saveMapping(); }
  });
  check("a relocated desktop launcher copies mapped files and ships a standalone installer", () => {
    bundle = pack("first");
    for (const entry of mapping.files) {
      assert.deepEqual(fs.readFileSync(path.join(bundle, "files", entry.target)), fs.readFileSync(source(entry)));
    }
    for (const entry of mapping.packageFiles) {
      assert.deepEqual(fs.readFileSync(path.join(bundle, entry.target)), fs.readFileSync(source(entry)));
    }
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(bundle, "release-files.json"), "utf8")), mapping);
    assert(!fs.existsSync(path.join(bundle, "files/config.json")));
    assert(fs.statSync(bundle + ".zip").size > 0);
  });
  check("an unattended desktop launch defaults to local packaging without COS configuration", () => {
    const output = path.join(sandbox, "发布 包", "default-local");
    const result = command(desktopLauncher, ["--output-directory", output, "--sgsol-directory", roaming,
      "--no-open", "--cos-config", path.join(sandbox, "missing-cos.json")]);
    assert(result.stdout.includes("本地打包完成，未上传云端。"), result.stdout);
    assert(fs.statSync(output + ".zip").size > 0);
  });
  check("the Ultra ZIP extracts all payload and installer files under one release folder", () => {
    bundle = unpack(bundle);
  });
  check("Python level 9 compression also preserves all files and Chinese bracket paths", () => {
    unpack(pack("python-maximum", 0, ["-CompressionTool", "Python"]));
  });
  check("install.cmd moves files, overwrites old content and preserves configuration", () => {
    const result = install(bundle);
    assert(result.stdout.includes("[1/7] 检查目标目录与安装状态"), result.stdout);
    assert(result.stdout.includes("[7/7] 完成安装并清理临时文件"), result.stdout);
    assert(result.stdout.includes("安装成功"), result.stdout);
    assert(result.stdout.includes("已安装版本：0.0.9"), result.stdout);
    assert(result.stdout.includes("完整安装日志："), result.stdout);
    assert(result.stdout.includes("安装程序已结束，可以关闭此窗口。"), result.stdout);
    assertInstalled();
    for (const entry of mapping.files) assert(!fs.existsSync(path.join(bundle, "files", entry.target)));
    assert(!fs.existsSync(path.join(destination, "modules/old-feature.js")));
    assert.equal(fs.readFileSync(path.join(destination, "config.json"), "utf8"), '{"keep":"user configuration"}');
    assert.equal(fs.readFileSync(path.join(destination, "modules/user-note.txt"), "utf8"), "keep this unrelated file");
  });
  check("reusing a consumed package reports failure and tells the user to extract it again", () => {
    const result = install(bundle, 1);
    assert(result.stdout.includes("安装失败，未完成安装"), result.stdout);
    assert(result.stdout.includes("失败步骤：检查安装包与文件清单"), result.stdout);
    assert(result.stdout.includes("请重新解压完整 ZIP"), result.stdout);
    assert(!result.stdout.includes("安装成功"), result.stdout);
    assertInstalled();
  });
  check("a fresh package installs again over an existing installation", () => {
    install(pack("second"));
    assertInstalled();
  });
  check("mapping deletion and rename control both package contents and old installed paths", () => {
    mapping.files.pop();
    const previousTarget = mapping.files[1].target;
    mapping.files[1].target = "modules/features/hand-cards-renamed.js";
    mapping.remove.push(extra.target, previousTarget);
    saveMapping();
    const output = pack("renamed");
    assert(!fs.existsSync(path.join(output, "files", extra.target)));
    assert(!fs.existsSync(path.join(output, "files", previousTarget)));
    install(output);
    assertInstalled();
    assert(!fs.existsSync(path.join(destination, extra.target)));
    assert(!fs.existsSync(path.join(destination, previousTarget)));
  });
  check("reusing an output folder fails without clearing its contents", () => {
    const output = path.join(sandbox, "发布 包", "renamed");
    write(path.join(output, "keep.txt"), "existing package");
    pack("renamed", 1);
    assert.equal(fs.readFileSync(path.join(output, "keep.txt"), "utf8"), "existing package");
  });
  check("an existing ZIP is not updated or overwritten by a new package", () => {
    const archive = path.join(sandbox, "发布 包", "existing-zip.zip");
    write(archive, "keep existing archive");
    pack("existing-zip", 1);
    assert.equal(fs.readFileSync(archive, "utf8"), "keep existing archive");
  });
  check("a missing mapped source reports failure instead of silently omitting it", () => {
    mapping.files.push({ sourceRoot: "repo", source: "missing.js", target: "missing.js" });
    saveMapping();
    pack("missing", 1);
    mapping.files.pop();
  });
  check("removal cannot escape the install root and fails before moving any payload", () => {
    const outside = path.join(path.dirname(destination), "outside.js");
    write(outside, "outside file");
    mapping.remove.push("../outside.js");
    saveMapping();
    const output = pack("outside");
    install(output, 1);
    assert.equal(fs.readFileSync(outside, "utf8"), "outside file");
    assert(fs.existsSync(path.join(output, "files", mapping.files[0].target)));
    mapping.remove.pop();
  });
  check("an active target cannot also be removed", () => {
    mapping.remove.push(mapping.files[0].target);
    saveMapping();
    const output = pack("conflict");
    install(output, 1);
    assert(fs.existsSync(path.join(output, "files", mapping.files[0].target)));
    assertInstalled();
    mapping.remove.pop();
  });
  check("only individual obsolete files can be removed", () => {
    mapping.remove.push("modules");
    saveMapping();
    const output = pack("directory");
    install(output, 1);
    assertInstalled();
    mapping.remove.pop();
  });
  check("desktop CMD saves version and notes to the project and delivers the same script in the ZIP", () => {
    saveMapping();
    const script = path.join(fixtureProject, "resources/daxiaochao.user.js");
    const before = fs.readFileSync(path.join(project, "resources/daxiaochao.user.js"), "utf8");
    write(script, before);
    const notes = "修复桌面打包；保留中文与更新内容";
    const output = unpack(pack("metadata", 0, ["--version", "2.3.4", "--notes", notes]));
    const updated = fs.readFileSync(script, "utf8");
    assert.equal(JSON.parse(fs.readFileSync(path.join(fixtureProject, "version.json"), "utf8")).version, "2.3.4");
    assert(updated.includes("// @version      2.3.4"));
    assert(updated.includes('const XIAOCHAO_VERSION = "2.3.4";'));
    new vm.Script(updated, { filename: script });
    const start = updated.indexOf("  const _0x378fb5 =");
    const end = updated.indexOf("  function Init()", start);
    assert(start >= 0 && end > start);
    const value = vm.runInNewContext(updated.slice(start, end) + "\n_0x378fb5", {
      _0x41a3d0: index => ({ 555: "replace", 526: "<br>" })[index],
    });
    assert.equal(value, "修复桌面打包<br>保留中文与更新内容");
    const mask = text => text.replace(/^(\/\/[ \t]*@version[ \t]+)[^\r\n]+/m, "$1<version>")
      .replace(/(const XIAOCHAO_VERSION = ")[^"\r\n]+(";)/, "$1<version>$2")
      .replace(/(const _0x378fb5\s*=\s*)"(?:[^"\\\r\n]|\\.)*"/, '$1"<notes>"');
    assert.equal(mask(updated), mask(before));
    install(output);
    assertInstalled();
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(project, "release-files.json"), "utf8")), original);
  process.stdout.write(`${passed} release checks passed (Python packer + Windows PowerShell 5.1 installer).\n`);
} finally {
  // Delete only this test's freshly allocated directory, never an installation.
  const resolved = fs.realpathSync(sandbox);
  const tempRoot = fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(resolved).toLowerCase(), tempRoot.toLowerCase());
  assert(path.basename(resolved).startsWith("xc-release-tests-"));
  fs.rmSync(resolved, { recursive: true, force: true });
}
