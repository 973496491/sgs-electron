// Exercise Windows PowerShell 5.1 and the shipped CMD entry points in a temporary tree.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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
  command(desktopLauncher, ["-OutputDirectory", output, "-SgsolDirectory", roaming, "-NoOpen", ...options], expected);
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
  for (const relative of ["electron-next/pack.cmd", "electron-next/scripts/package-release.ps1",
    ...mapping.packageFiles.map(entry => entry.source)]) {
    write(path.join(fixtureRepo, relative), fs.readFileSync(path.join(repository, relative)));
  }
  // File transport does not execute business code; keep fixtures independent of feature commits.
  for (const [index, entry] of mapping.files.entries()) {
    write(source(entry), Buffer.from(`// release fixture ${index}\r\n// 中文业务文件\r\n`));
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
  check("the fast ZIP extracts all payload and installer files under one release folder", () => {
    bundle = unpack(bundle);
  });
  check("Windows Fastest compression also preserves all files and Chinese bracket paths", () => {
    unpack(pack("windows-fastest", 0, ["-CompressionTool", "Windows"]));
  });
  check("install.cmd moves files, overwrites old content and preserves configuration", () => {
    install(bundle);
    assertInstalled();
    for (const entry of mapping.files) assert(!fs.existsSync(path.join(bundle, "files", entry.target)));
    assert(!fs.existsSync(path.join(destination, "modules/old-feature.js")));
    assert.equal(fs.readFileSync(path.join(destination, "config.json"), "utf8"), '{"keep":"user configuration"}');
    assert.equal(fs.readFileSync(path.join(destination, "modules/user-note.txt"), "utf8"), "keep this unrelated file");
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
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(project, "release-files.json"), "utf8")), original);
  process.stdout.write(`${passed} release packaging/install checks passed (Windows PowerShell 5.1).\n`);
} finally {
  // Delete only this test's freshly allocated directory, never an installation.
  const resolved = fs.realpathSync(sandbox);
  const tempRoot = fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(resolved).toLowerCase(), tempRoot.toLowerCase());
  assert(path.basename(resolved).startsWith("xc-release-tests-"));
  fs.rmSync(resolved, { recursive: true, force: true });
}
