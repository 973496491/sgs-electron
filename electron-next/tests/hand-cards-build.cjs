// Deterministic module assembly plus execution of the real userscript host wiring.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { assemble, definitions } = require("../scripts/build-userscript-modules.cjs");
const source = fs.readFileSync(path.join(__dirname, "../resources/daxiaochao.user.js"), "utf8").replace(/\r\n/g, "\n");
let passed = 0;
function check(name, verify) { verify(); passed++; process.stdout.write("PASS " + name + "\n"); }
function region(text, id) {
  const begin = "  // BEGIN GENERATED MODULE: " + id + "\n";
  const end = "  // END GENERATED MODULE: " + id + "\n";
  const start = text.indexOf(begin), finish = text.indexOf(end, start);
  assert(start >= 0 && finish > start);
  return { start, end: finish + end.length, begin, close: end };
}
check("committed module regions match independent sources", () => assert.equal(assemble(source), source));
check("assembly is idempotent and preserves CRLF", () => {
  const crlf = source.replace(/\n/g, "\r\n");
  assert.equal(assemble(assemble(crlf)), crlf);
});
check("stale modules regenerate without rewriting surrounding source", () => {
  let stale = source;
  for (const { id } of definitions) {
    const block = region(stale, id);
    stale = stale.slice(0, block.start) + block.begin + "  // intentionally stale\n" + block.close + stale.slice(block.end);
  }
  const untouched = "\n// unrelated integration comment\n";
  assert.equal(assemble(stale + untouched), source + untouched);
});
check("missing or duplicate boundaries fail before writing", () => {
  assert.throws(() => assemble(source.replace("// END GENERATED MODULE: hand-cards\n", "// missing\n")), /boundaries/);
  assert.throws(() => assemble(source + "  // BEGIN GENERATED MODULE: hand-cards\n"), /boundaries/);
});
const timeouts = new Map(), intervals = new Map(), events = new Map();
let sequence = 0;
const storage = new Map();
const window = {
  innerWidth: 1000, innerHeight: 700,
  setTimeout(fn) { const id = ++sequence; timeouts.set(id, fn); return id; },
  clearTimeout(id) { timeouts.delete(id); },
  setInterval(fn) { const id = ++sequence; intervals.set(id, fn); return id; },
  clearInterval(id) { intervals.delete(id); },
  requestAnimationFrame() { throw Error("unexpected UI creation"); }, cancelAnimationFrame() {},
  getComputedStyle() { throw Error("unexpected UI access"); },
};
const document = {
  body: null, readyState: "loading",
  addEventListener(type, fn) { events.set(type, fn); },
  removeEventListener(type, fn) { if (events.get(type) === fn) events.delete(type); },
  getElementById() { return null; },
  createElement() { throw Error("queries must not create DOM"); },
};
const sandbox = { window, document, laya: { gamescene: null, find: () => null }, _0x46e1d4: { v: true },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) } };
const context = vm.createContext(sandbox);
const start = source.indexOf("  // BEGIN GENERATED MODULE: hand-cards-client\n");
const end = source.indexOf("  function _0x14cdaf", start);
check("actual single-file host initializes deferred module and compatibility bridges", () => {
  vm.runInContext(source.slice(start, end), context);
  assert(events.has("DOMContentLoaded"));
  assert.equal(typeof window.__xcOpenHandSortSettings, "function");
  assert.equal(typeof window.__xcAttachHandCardsMainPanel, "function");
  assert.equal(window.__xcIsHandSortPanelVisible(), false);
  assert.equal(window.__xcGetHandSortOptions().orientation, "horizontal");
});
check("legacy reorder action uses closure laya, never the page alias", () => {
  Object.defineProperty(window, "laya", { get() { throw Error("wrong dependency"); } });
  const calls = [];
  const container = { cardUis: [7, 2].map(number => ({ Card: { CardNumber: number },
    clear(flag) { calls.push(flag); }, Draw(owner) { assert.equal(owner, container); } })),
    invalidateLayoutHandCard() { calls.push("layout"); } };
  sandbox.laya.gamescene = { SelfSeatUi: { cardContainer: container } };
  assert.equal(vm.runInContext('reorderCard("CardNumber")', context), true);
  assert.deepEqual(container.cardUis.map(ui => ui.Card.CardNumber), [2, 7]);
  assert.deepEqual(calls, [false, false, "layout"]);
});
check("actual second-IIFE host attachment requests a single bounded retry", () => {
  Object.assign(sandbox, { DEBUG_SWITCH_ID: "localSkinDebugSwitch", findSwitchContainer() {}, clearDuplicateIds() {},
    setLocalSkinLabel() {}, ensureFloatingLabel() {}, getHandSortSwitchAnchor() {} });
  const a = source.indexOf("  // Hand-card main-panel host."), b = source.indexOf("  // 皮肤屏蔽按钮：", a);
  assert(a >= 0 && b > a);
  vm.runInContext(source.slice(a, b), context);
  for (let i = 0; i < 5; i++) window.__xcInstallHandSortPanelButton();
  assert.equal(timeouts.size, 1);
});
check("host disposal disables all legacy bridges without reinitialization", () => {
  const oldReady = events.get("DOMContentLoaded"), oldRetry = [...timeouts.values()][0];
  vm.runInContext("handCards.dispose()", context);
  assert.equal(events.size, 0); assert.equal(timeouts.size, 0); assert.equal(intervals.size, 0);
  oldReady(); oldRetry();
  assert.equal(window.__xcIsHandSortPanelVisible(), false);
  assert.equal(window.__xcSetHandSortPanelVisible(true), false);
  assert.equal(window.__xcOpenHandSortSettings(), null);
  assert.equal(window.__xcInstallHandSortPanelButton(), false);
  assert.equal(window.__xcGetHandSortOptions().orientation, "horizontal");
  assert.equal(timeouts.size, 0);
});
process.stdout.write("PASS " + passed + " module assembly/host checks\n");
