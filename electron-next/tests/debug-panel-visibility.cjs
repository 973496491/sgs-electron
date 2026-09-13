// Actual debug-panel, switch and asynchronous log functions with a simulated DOM.
// Run: node electron-next/tests/debug-panel-visibility.cjs [--source <userscript>]
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const sourceArg = process.argv.indexOf("--source");
assert(sourceArg < 0 || process.argv[sourceArg + 1], "--source requires a file path");
const source = fs.readFileSync(sourceArg < 0 ? path.join(__dirname, "../resources/daxiaochao.user.js") : process.argv[sourceArg + 1], "utf8");
function slice(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, "source boundaries: " + start);
  return source.slice(a, b);
}
const panelSource = slice("  function getLocalSkinDebugState()", "  function normalizeLocalSkinDebugIgnoreRules(") +
  slice("  function ensureLocalSkinDebugPanel()", "  function shallowDumpLocalSkinDebug(") +
  slice("  function beginLocalSkinDebugBlock(", "  function createLocalSkinDebugDumpWorker(") +
  slice("  function stopLocalSkinDebugDumpWorker(", "  function scheduleLocalSkinDebugDumpPost(") +
  slice("  function notifyLocalSkinError(", "  function findSwitchContainer(") +
  slice("  function setDebugSwitchState(", "  function insertDebugButton(");
function fixture() {
  globalThis.window = globalThis;
  globalThis.XC = { isDebug: false };
  class Element {
    constructor() { this.children = []; this.style = {}; this.handlers = {}; this.text = ""; }
    appendChild(child) { if (child.parentNode) child.parentNode.removeChild(child); this.children.push(child); child.parentNode = this; return child; }
    removeChild(child) { this.children = this.children.filter(node => node !== child); child.parentNode = null; }
    contains(child) { return this === child || this.children.some(node => node.contains(child)); }
    addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
    get textContent() { return this.text + this.children.map(node => node.textContent).join(""); }
    set textContent(text) { this.children.forEach(node => { node.parentNode = null; }); this.children = []; this.text = String(text); }
  }
  const root = new Element(), body = root.appendChild(new Element());
  const find = (node, id) => node.id === id ? node : node.children.map(child => find(child, id)).find(Boolean) || null;
  globalThis.document = {
    documentElement: root, body, createElement: () => new Element(),
    createTextNode: text => Object.assign(new Element(), { text: String(text) }),
    getElementById: id => find(root, id), addEventListener() {},
  };
  globalThis.panel = () => document.getElementById("xcDebugPanel");
  globalThis.callbacks = new Map();
  let nextId = 0;
  globalThis.setTimeout = globalThis.requestAnimationFrame = callback => { callbacks.set(++nextId, callback); return nextId; };
  globalThis.clearTimeout = globalThis.cancelAnimationFrame = id => callbacks.delete(id);
  globalThis.drain = () => {
    let count = 0;
    while (callbacks.size) {
      if (++count > 10) throw Error("unexpected ongoing timer");
      const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback());
    }
  };
  globalThis.loadLocalSkinDebugIgnoreRules = () => [];
  globalThis.toggleLocalSkinDebugConfigPanel = globalThis.installLocalSkinDebugResponseHook = () => {};
  globalThis.URL = { revokeObjectURL() {} };
  globalThis.toggle = { checked: false };
}
function harness() {
  const context = vm.createContext({});
  vm.runInContext("(" + fixture.toString() + ")()\n" + panelSource, context);
  return { context, run: code => vm.runInContext(code, context) };
}
let passed = 0, failed = 0;
function test(name, run) {
  try { run(harness()); passed++; process.stdout.write("PASS " + name + "\n"); }
  catch (error) { failed++; process.stdout.write("FAIL " + name + ": " + error.message.split("\n")[0] + "\n"); }
}
test("forced line cannot open the panel with its switch off", h => {
  h.run('appendLocalSkinDebugLine("forced",true);');
  assert.equal(h.run("panel()"),null);
  assert.equal(h.run("XC.isDebug"),false);
});
test("initial deal diagnostic cannot force the panel open", h => {
  h.run('__xcAutoSQKDebugLog("deal:start",{cards:[7]});');
  assert.equal(h.run("panel()"),null);
});
test("forced async block cannot create the panel with its switch off", h => {
  assert.equal(h.run('beginLocalSkinDebugBlock("forced",true)'),null);
  h.run('appendLocalSkinDebugBlockAsync("late","payload",true); drain();');
  assert.equal(h.run("panel()"),null);
});
test("direct ensure obeys the closed switch", h => {
  assert.equal(h.run("ensureLocalSkinDebugPanel()"),null);
  assert.equal(h.run("panel()"),null);
});
test("error/info fallback cannot reopen the disabled panel", h => {
  h.run('notifyLocalSkinError(new Error("skin response")); notifyLocalSkinInfo("skin done");');
  assert.equal(h.run("panel()"),null);
});
test("manual open still creates and writes to the panel", h => {
  h.run('toggle.checked=true; openDebugFromButton(toggle); appendLocalSkinDebugLine("normal"); appendLocalSkinDebugLine("forced",true);');
  assert(h.run("panel()"));
  assert(h.run('getLocalSkinDebugState().panelBody.textContent.includes("normal")'));
  assert(h.run('getLocalSkinDebugState().panelBody.textContent.includes("forced")'));
  assert.equal(h.run("toggle.checked"),true);
});
test("close survives delayed normal/forced/deal messages", h => {
  h.run(`
    toggle.checked=true; openDebugFromButton(toggle);
    setTimeout(()=>appendLocalSkinDebugLine("late forced",true),1);
    setTimeout(()=>__xcAutoSQKDebugLog("deal:start",{cards:[7]}),1);
    toggle.checked=false; openDebugFromButton(toggle);
    appendLocalSkinDebugLine("normal after close"); drain();
  `);
  assert.equal(h.run("panel()"),null);
  assert.equal(h.run("toggle.checked || XC.isDebug"),false);
});
test("close terminates dump jobs and delayed worker output stays closed", h => {
  h.run(`
    toggle.checked=true; openDebugFromButton(toggle);
    globalThis.terminated=0;
    const state=getLocalSkinDebugState();
    state.dumpWorker={terminate(){terminated++}};
    state.dumpJobs={1:{title:"worker",force:true}};
    const block=beginLocalSkinDebugBlock("pending",true);
    queueLocalSkinDebugBlockChunk(block,"queued");
    toggle.checked=false; openDebugFromButton(toggle);
    handleLocalSkinDebugDumpWorkerMessage({data:{id:1,type:"chunk",chunk:"late"}}); drain();
  `);
  assert.equal(h.run("terminated"),1);
  assert.equal(h.run("getLocalSkinDebugState().debugChunkQueue.length"),0);
  assert.equal(h.run("panel()"),null);
});
test("reopening manually after closing restores async output", h => {
  h.run(`
    toggle.checked=true; openDebugFromButton(toggle);
    toggle.checked=false; openDebugFromButton(toggle);
    appendLocalSkinDebugLine("discarded",true);
    toggle.checked=true; openDebugFromButton(toggle);
    appendLocalSkinDebugBlockAsync("block","new chunk",true); drain();
  `);
  assert(h.run('panel().textContent.includes("new chunk")'));
  assert(!h.run('panel().textContent.includes("discarded")'));
});
test("detached panel rebuilds only while debugging is enabled", h => {
  h.run('toggle.checked=true; openDebugFromButton(toggle); document.body.removeChild(panel()); XC.isDebug=false; appendLocalSkinDebugLine("late",true);');
  assert.equal(h.run("panel()"),null);
  h.run('toggle.checked=true; openDebugFromButton(toggle);');
  assert(h.run("panel()"));
});
process.stdout.write(`${passed} passed, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
