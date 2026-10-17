// Version synchronization and actual consumers; no game, credentials or remote service.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { build, stampVersion, definitions } = require("../scripts/build-userscript-modules.cjs");
const { readLocalVersion } = require("../src/electron/release-update");
const project = path.resolve(__dirname, "..");
const scriptPath = path.join(project, "resources/daxiaochao.user.js");
const recordPath = path.join(project, "version.json");
const original = fs.readFileSync(scriptPath, "utf8");
const record = fs.readFileSync(recordPath, "utf8");
const version = JSON.parse(record).version;
const source = original.replace(/\r\n/g, "\n");
let passed = 0;
function check(name, action) { action(); passed++; process.stdout.write("PASS " + name + "\n"); }
function slice(begin, end) {
  const start = source.indexOf(begin), finish = source.indexOf(end, start);
  assert(start >= 0 && finish > start, begin);
  return source.slice(start, finish);
}
check("working script, runtime detection and version record agree", () => {
  assert.equal(build(original, version), original);
  assert.equal(readLocalVersion({ versionFile: recordPath, scriptFile: scriptPath }), version);
  assert.equal((source.match(/const XIAOCHAO_VERSION = /g) || []).length, 1);
  assert(!/_0x43f342|_0x38a6c4/.test(source));
});
check("version synchronization preserves other metadata, business code and line endings", () => {
  const normalized = text => text.replace(/^(\/\/[ \t]*@version[ \t]+)[^\r\n]+/m, "$1<version>")
    .replace(/(const XIAOCHAO_VERSION = ")[^"]+(";)/, "$1<version>$2");
  for (const input of [source, source.replace(/\n/g, "\r\n")]) {
    const changed = stampVersion(input, "9.8.7");
    assert.equal(normalized(changed), normalized(input));
    assert.equal(stampVersion(changed, "9.8.7"), changed);
    assert(changed.includes("// @grant        none"));
    assert(changed.includes("// @run-at       document-start"));
  }
});
check("invalid versions and ambiguous markers are rejected", () => {
  for (const value of ["", "1.2", "01.2.3", "1.2.3-beta", "1000000000.0.0", null, 1])
    assert.throws(() => stampVersion(source, value), /three-part/);
  for (const input of [
    source.replace(/^\/\/[ \t]*@version[^\n]+\n/m, ""),
    source + '\n// @version 9.8.7\n',
    source.replace(/  const XIAOCHAO_VERSION = "[^"]+";\n/, ""),
    source + '\nconst XIAOCHAO_VERSION = "9.8.7";\n',
  ]) assert.throws(() => stampVersion(input, "9.8.7"), /Missing or duplicate/);
});
check("actual activation payload uses the unified version", () => {
  const declaration = source.match(/  const XIAOCHAO_VERSION = "[^"]+";/)[0];
  const table = require("../../doc/彩虹表.js").tables._0x2e57.all;
  const context = {
    _0x1ca036: index => table[index], _0x19414b: (...codes) => String.fromCharCode(...codes),
    _0xe6ae52: { userID: "fixture", nickname: "test", guildID: 0, d: 0 },
  };
  const result = vm.runInNewContext(declaration + "\n" + slice("  function _0x53d3d5(", "  const vld =") +
    '\n_0x53d3d5("fixture-code")', context);
  assert.equal(JSON.parse(result).version, version);
});
check("actual title and update-notice logic use the same version and do not repeat notices", () => {
  const declaration = source.match(/  const XIAOCHAO_VERSION = "[^"]+";/)[0];
  const titles = source.match(/"小抄月见版 " \+ XIAOCHAO_VERSION/g);
  assert.equal(titles.length, 2);
  for (const expression of titles)
    assert.equal(vm.runInNewContext(declaration + "\n" + expression), "小抄月见版 " + version);
  const table = require("../../doc/彩虹表.js").tables._0x871b.all;
  const saved = new Map([["DXCVersion", "previous-version"]]), notices = [];
  const context = vm.createContext({
    n: index => table[index], _0x378fb5: "fixture notes",
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    _0x327542: text => notices.push(text),
  });
  vm.runInContext(declaration, context);
  const expression = slice("        localStorage[n(388)](n(627)) != XIAOCHAO_VERSION",
    "\n        document[n(503)]").trim().replace(/,$/, "");
  vm.runInContext(expression, context);
  assert.equal(saved.get("DXCVersion"), version);
  assert.equal(notices.length, 1); assert(notices[0].startsWith("小抄已经更新到" + version));
  vm.runInContext(expression, context); assert.equal(notices.length, 1);
});
const root = fs.mkdtempSync(path.join(os.tmpdir(), "xc-version-build-"));
try {
  for (const relative of ["scripts/build-userscript-modules.cjs", ...definitions.map(item => item.file)]) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(project, relative), target);
  }
  const target = path.join(root, "resources/daxiaochao.user.js");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, stampVersion(original, "0.0.1"));
  fs.writeFileSync(path.join(root, "version.json"), '{"version":"9.8.7"}\n');
  const run = (...args) => spawnSync(process.execPath, [path.join(root, "scripts/build-userscript-modules.cjs"), ...args],
    { encoding: "utf8", windowsHide: true });
  check("check detects a changed version.json without writing; build synchronizes working files without packaging", () => {
    const stale = fs.readFileSync(target);
    const checkResult = run("--check");
    assert.equal(checkResult.status, 1, checkResult.stderr);
    assert.deepEqual(fs.readFileSync(target), stale);
    const result = run(); assert.equal(result.status, 0, result.stderr);
    assert.equal(run("--check").status, 0);
    assert.equal(readLocalVersion({ versionFile: path.join(root, "version.json"), scriptFile: target }), "9.8.7");
    assert(fs.readFileSync(target, "utf8").includes('const XIAOCHAO_VERSION = "9.8.7";'));
    assert(!fs.existsSync(path.join(root, "release")));
  });
  check("invalid version.json fails before touching the working script", () => {
    const before = fs.readFileSync(target);
    for (const content of ['{"version":"bad"}', '{}', '{broken']) {
      fs.writeFileSync(path.join(root, "version.json"), content);
      assert.notEqual(run().status, 0);
      assert.deepEqual(fs.readFileSync(target), before);
    }
  });
} finally {
  const real = fs.realpathSync(root), parent = fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(real).toLowerCase(), parent.toLowerCase());
  assert(path.basename(real).startsWith("xc-version-build-"));
  fs.rmSync(real, { recursive: true, force: true });
}
assert.equal(fs.readFileSync(scriptPath, "utf8"), original);
assert.equal(fs.readFileSync(recordPath, "utf8"), record);
process.stdout.write("PASS " + passed + " unified userscript version checks\n");
