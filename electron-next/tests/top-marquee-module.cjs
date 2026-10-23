// Lifecycle and real userscript wiring, without a running game or network.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const createTopMarqueeModule = require("../src/features/top-marquee");
const { assemble, definitions } = require("../scripts/build-userscript-modules.cjs");
const sourceArg = process.argv.indexOf("--source");
const source = fs.readFileSync(sourceArg < 0 ? path.join(__dirname, "../resources/daxiaochao.user.js") :
  process.argv[sourceArg + 1], "utf8").replace(/\r\n/g, "\n");
let passed = 0;
function check(name, run) { run(); passed++; process.stdout.write("PASS " + name + "\n"); }
function slice(begin, end) {
  const a = source.indexOf(begin), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, begin);
  return source.slice(a, b);
}
function harness(saved) {
  let nextId = 0, ready = false, reads = 0;
  const jobs = new Map(), storage = new Map(), logs = [], events = [];
  if (saved !== undefined) storage.set("xcTopMarqueeBlocked", saved);
  const window = {
    setTimeout(callback, delay) { const id = ++nextId; jobs.set(id, { callback, delay }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    requestAnimationFrame() { throw Error("unexpected DOM frame"); }, cancelAnimationFrame() {},
    getComputedStyle() { throw Error("unexpected DOM"); },
    CustomEvent: class { constructor(type) { this.type = type; } },
    dispatchEvent(event) { events.push(event.type); },
  };
  Object.defineProperty(window, "laya", { get() { throw Error("must use captured core dependency"); } });
  const document = { getElementById() { return null; } };
  class Layer {
    ShowMarquee(...args) {
      this.calls.push(args);
      if (args[0] && args[0].error) throw args[0].error;
      return 42;
    }
    constructor() { this.calls = []; }
  }
  const layer = new Layer(), nativeShow = Layer.prototype.ShowMarquee;
  const manager = { nowPlayeNoticeId: 0, ended: 0, playNotice() {}, OnTimeOut() {},
    OnNoticPlayEnd() { this.ended++; this.nowPlayeNoticeId = 0; } };
  const chat = { BannerSystemNoticeList: [] };
  const laya = { class(name, force) {
    reads++; assert.equal(force, true);
    return ready ? { PromptLayer: layer, ChatSysNewsManager: manager, ChatManager: chat }[name] : null;
  } };
  const options = {
    window, document, getLaya: () => laya, getTimer: () => ({ clear() {}, clearAll() {} }),
    storage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    log: (event, error) => logs.push([event, error]),
  };
  const api = createTopMarqueeModule(options);
  return { api, options, window, document, jobs, storage, logs, events, layer, manager, nativeShow, laya,
    host: { findSwitchContainer() {}, clearDuplicateIds() {}, getAnchor() {} },
    ready(value) { ready = value; }, reads: () => reads,
    run(id) { const job = jobs.get(id); assert(job); jobs.delete(id); job.callback(); },
  };
}
check("single-file assembly matches all source modules and preserves CRLF", () => {
  assert.equal(assemble(source), source);
  assert.equal(assemble(assemble(source.replace(/\n/g, "\r\n"))), source.replace(/\n/g, "\r\n"));
  for (const { id } of definitions)
    assert.throws(() => assemble(source.replace("// END GENERATED MODULE: " + id + "\n", "// missing\n")), /boundaries/);
});
check("release mapping delivers the independently maintained marquee module", () => {
  const mapping = JSON.parse(fs.readFileSync(path.join(__dirname, "../release-files.json"), "utf8"));
  assert(mapping.files.some(entry => entry.source === "electron-next/src/features/top-marquee.js" &&
    entry.target === "modules/features/top-marquee.js"));
});
check("preference reads are inert before start and storage errors default to off", () => {
  for (const [saved, expected] of [[undefined, false], ["true", true], ["false", false], ["broken", false]]) {
    const h = harness(saved);
    assert.equal(h.api.isBlocked(), expected);
    assert.equal(h.api.install(), false);
    assert.equal(h.api.setBlocked(!expected), false);
    assert.equal(h.api.attachMainPanel(h.host), false);
    assert.equal(h.jobs.size, 0); assert.equal(h.reads(), 0);
  }
  const h = harness();
  const api = createTopMarqueeModule({ ...h.options, storage: { getItem() { throw Error("denied"); } } });
  assert.equal(api.isBlocked(), false);
});
check("repeated initialization merges controller and panel retries", () => {
  const h = harness();
  h.api.start(); h.api.install(); h.api.attachMainPanel(h.host);
  const ids = [...h.jobs.keys()];
  for (let i = 0; i < 5; i++) { h.api.start(); h.api.install(); h.api.requestMainPanel(); }
  assert.deepEqual([...h.jobs.keys()], ids);
  assert.deepEqual([...h.jobs.values()].map(job => job.delay), [500, 250]);
  h.api.dispose(); assert.equal(h.jobs.size, 0);
});
check("controller and UI retries have finite independent budgets", () => {
  for (const [kind, expected] of [["controller", 60], ["panel", 240]]) {
    const h = harness(); h.api.start();
    if (kind === "controller") h.api.install(); else h.api.attachMainPanel(h.host);
    let calls = 0;
    while (h.jobs.size) {
      assert(calls < 250, "unbounded retry");
      h.run([...h.jobs.keys()][0]); calls++;
    }
    assert.equal(calls, expected);
    h.api.dispose();
  }
});
check("old callbacks cannot rearm or clear a restarted instance's tasks", () => {
  const h = harness("true"); h.api.start(); h.api.install(); h.api.attachMainPanel(h.host);
  const oldCallbacks = [...h.jobs.values()].map(job => job.callback);
  h.api.dispose(); h.api.dispose();
  oldCallbacks.forEach(callback => callback());
  assert.equal(h.jobs.size, 0);
  assert.equal(h.api.requestMainPanel(), false);
  h.api.start(); h.api.install(); h.api.requestMainPanel();
  const currentIds = [...h.jobs.keys()], reads = h.reads();
  oldCallbacks.forEach(callback => callback());
  assert.deepEqual([...h.jobs.keys()], currentIds); assert.equal(h.reads(), reads);
  h.ready(true); h.run(currentIds[0]);
  assert.notEqual(h.layer.ShowMarquee, h.nativeShow);
  h.api.dispose(); assert.equal(h.layer.ShowMarquee, h.nativeShow);
});
check("later wrappers survive disposal and the retained marquee layer becomes inert", () => {
  const h = harness("true"); h.ready(true); h.api.start(); h.api.install();
  const previous = h.layer.ShowMarquee;
  let calls = 0;
  const later = function (...args) { calls++; return previous.apply(this, args); };
  Object.getPrototypeOf(h.layer).ShowMarquee = later;
  h.api.dispose();
  assert.equal(h.layer.ShowMarquee, later);
  assert.equal(h.layer.ShowMarquee({ ID: 1 }, false, "extra"), 42);
  assert.equal(h.layer.calls[0][2], "extra");
  h.api.start(); h.api.install(); h.api.install();
  h.manager.nowPlayeNoticeId = 2;
  h.layer.ShowMarquee({ ID: 2 }, true);
  assert.equal(h.layer.ShowMarquee, later); assert.equal(calls, 2);
  assert.equal(h.manager.ended, 1); assert.equal(h.layer.calls.length, 1);
  h.api.dispose();
  const sentinel = Error("native exception");
  assert.throws(() => h.layer.ShowMarquee({ error: sentinel }), error => error === sentinel);
});
check("failed persistence or logging does not break the toggle", () => {
  const h = harness();
  const api = createTopMarqueeModule({ ...h.options, storage: { getItem() {}, setItem() { throw Error("denied"); } },
    log() { throw Error("log unavailable"); } });
  api.start();
  assert.equal(api.setBlocked(true), true); assert.equal(api.isBlocked(), true);
  assert.deepEqual(h.events, ["xc-top-marquee-change"]); api.dispose();
});
check("actual core and second-IIFE host wiring share the same instance", () => {
  const h = harness("true");
  let deckDisposals = 0;
  const sandbox = {
    window: h.window, document: h.document, laya: h.laya, Laya: { timer: h.options.getTimer() },
    localStorage: h.options.storage, appendLocalSkinDebugLine: (text, force) => {
      assert.equal(force, false); h.logs.push(text);
    },
    ...h.host, getHandSortSwitchAnchor: h.host.getAnchor,
    _0x41a3d0: () => "", handCards: { start() {}, mount() {}, dispose() {} },
    cardThemeFeature: { dispose() {} },
    autoTasks: { dispose() {} },
    deckVisibilityPanel: { dispose() { deckDisposals++; } },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(slice("  // 顶部跑马灯：", "  async function setProto()"), context);
  assert.equal(h.jobs.size, 0, "creating module must not probe game before original install point");
  vm.runInContext(slice("  // 顶部广播按钮：", "  function waitForCardBackSwitch("), context);
  assert.equal([...h.jobs.values()][0].delay, 250);
  h.ready(true);
  assert.equal(vm.runInContext("installTopMarqueeBlocker()", context), true);
  h.manager.nowPlayeNoticeId = 3; h.layer.ShowMarquee({ ID: 3 }, true);
  assert.equal(h.manager.ended, 1); assert.equal(h.layer.calls.length, 0);
  vm.runInContext(slice("  function Exit() {", "    cleanupSkinEffectBlocker();") + "\n  }\nExit();", context);
  assert.equal(deckDisposals, 1);
  assert.equal(h.jobs.size, 0); assert.equal(h.layer.ShowMarquee, h.nativeShow);
  assert.equal(h.window.__xcInstallTopMarqueeButton(), false);
  assert.equal(h.window.__xcSetTopMarqueeBlocked(false), false);
  assert.equal(h.window.__xcIsTopMarqueeBlocked(), true);
  vm.runInContext(slice("    handCards.start();\n    handCards.mount();", "    installSkinEffectBlocker();"), context);
  assert.notEqual(h.layer.ShowMarquee, h.nativeShow);
  assert.equal(h.jobs.size, 1);
  h.window.__xcCleanupTopMarqueeButton();
  assert.equal(h.jobs.size, 0);
  vm.runInContext("topMarquee.dispose()", context);
});
process.stdout.write("PASS " + passed + " marquee module/lifecycle checks\n");
