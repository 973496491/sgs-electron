// Debug panel "接口拦截配置" line mode: rules live in one comma separated config line,
// "添加" still opens a new row, and saving appends that row to the end of the line.
// Run: node electron-next/tests/debug-config-panel.cjs [--source <userscript>]
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const sourceArg = process.argv.indexOf("--source");
assert(
  sourceArg < 0 || process.argv[sourceArg + 1],
  "--source requires a file path",
);
const sourcePath =
  sourceArg < 0
    ? path.join(__dirname, "../resources/daxiaochao.user.js")
    : path.resolve(process.argv[sourceArg + 1]);
const source = fs.readFileSync(sourcePath, "utf8");

function slice(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert(a >= 0 && b > a, "source boundaries: " + start);
  return source.slice(a, b);
}

const configSource =
  slice(
    "  function normalizeLocalSkinDebugIgnoreRules(",
    "  function closeLocalSkinDebugConfigPanel(",
  ) +
  slice(
    "  function collectLocalSkinDebugConfigRules(",
    "  function openLocalSkinDebugConfigPanel(",
  );

function fixture() {
  globalThis.window = globalThis;
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  };
  globalThis.__storage = storage;
  globalThis.DEBUG_IGNORE_RULES_STORAGE_KEY = "xcLocalSkinDebugIgnoreRules";
  globalThis.DEFAULT_DEBUG_IGNORE_RULES = ["decodeSSCChatmsgNtf"];
  globalThis.__state = {};
  globalThis.getLocalSkinDebugState = () => globalThis.__state;
  globalThis.appendLocalSkinDebugLine = () => {};
  globalThis.openLocalSkinDebugConfigFile = () => {};
  globalThis.closeLocalSkinDebugConfigPanel = () => {};
  globalThis.document = { createElement: (tag) => new FakeElement(tag) };
}

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.attrs = {};
    this.children = [];
    this.parentNode = null;
    this.handlers = {};
    this.style = {};
    this.text = "";
    this.value = "";
    this.focused = false;
  }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  insertBefore(child, ref) {
    if (child.parentNode) child.parentNode.removeChild(child);
    const index = this.children.indexOf(ref);
    this.children.splice(index < 0 ? this.children.length : index, 0, child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter((node) => node !== child);
    child.parentNode = null;
  }
  addEventListener(type, handler) {
    (this.handlers[type] ||= []).push(handler);
  }
  get firstChild() {
    return this.children[0] || null;
  }
  get textContent() {
    return this.text + this.children.map((node) => node.textContent).join("");
  }
  set textContent(text) {
    this.children.forEach((node) => {
      node.parentNode = null;
    });
    this.children = [];
    this.text = String(text);
  }
  matches(selector) {
    if (selector === "button") return this.tagName === "button";
    if (selector === 'input[data-xc-debug-ignore-rule-line="1"]')
      return (
        this.tagName === "input" &&
        this.attrs["data-xc-debug-ignore-rule-line"] === "1"
      );
    if (selector === 'input[data-xc-debug-ignore-rule="1"]')
      return (
        this.tagName === "input" &&
        this.attrs["data-xc-debug-ignore-rule"] === "1"
      );
    throw Error("unsupported selector: " + selector);
  }
  querySelectorAll(selector) {
    const found = [];
    const walk = (node) =>
      node.children.forEach((child) => {
        if (child.matches(selector)) found.push(child);
        walk(child);
      });
    walk(this);
    return found;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  click() {
    (this.handlers.click || []).forEach((handler) => handler({ target: this }));
  }
  focus() {
    this.focused = true;
  }
}

function harness() {
  const context = vm.createContext({});
  vm.runInContext(
    "(" +
      fixture.toString() +
      ")()\n" +
      "class FakeElement " +
      FakeElement.toString().replace(/^class FakeElement /, "") +
      "\n" +
      configSource,
    context,
  );
  return context;
}

const evaluate = (context, code) => vm.runInContext(code, context);

const tests = [];
const test = (name, run) => tests.push({ name, run });

function withPanel(rules, body) {
  const context = harness();
  context.__storage.set("xcLocalSkinDebugIgnoreRules", JSON.stringify(rules));
  const panel = context.document.createElement("div");
  context.__state.configPanelEl = panel;
  context.__state.responseIgnoreRules = evaluate(
    context,
    "loadLocalSkinDebugIgnoreRules()",
  );
  evaluate(context, "renderLocalSkinDebugConfigPanel()");
  const line = () =>
    panel.querySelector('input[data-xc-debug-ignore-rule-line="1"]');
  const addedInputs = () =>
    panel.querySelectorAll('input[data-xc-debug-ignore-rule="1"]');
  const button = (label) =>
    panel.querySelectorAll("button").find((node) => node.textContent === label);
  return body({ context, panel, line, addedInputs, button });
}

test("config panel keeps every rule in one comma separated line", () =>
  withPanel(
    ["decodeSSCChatmsgNtf", "GsCUpdateRoleDataNtf"],
    ({ line, addedInputs }) => {
      assert.equal(line().value, "decodeSSCChatmsgNtf,GsCUpdateRoleDataNtf");
      assert.equal(addedInputs().length, 0);
    },
  ));

test("添加 opens a new empty row exactly like before", () =>
  withPanel(["decodeSSCChatmsgNtf"], ({ button, addedInputs, line }) => {
    button("添加").click();
    assert.equal(addedInputs().length, 1);
    assert.equal(addedInputs()[0].value, "");
    assert.equal(addedInputs()[0].focused, true);
    assert.equal(line().value, "decodeSSCChatmsgNtf");
  }));

test("保存 appends the added row to the end of the config line", () =>
  withPanel(
    ["decodeSSCChatmsgNtf"],
    ({ context, button, addedInputs, line }) => {
      button("添加").click();
      addedInputs()[0].value = "GsCUpdateRoleDataExNtf";
      button("保存").click();
      assert.deepEqual(
        JSON.parse(context.__storage.get("xcLocalSkinDebugIgnoreRules")),
        ["decodeSSCChatmsgNtf", "GsCUpdateRoleDataExNtf"],
      );
      assert.equal(line().value, "decodeSSCChatmsgNtf,GsCUpdateRoleDataExNtf");
      assert.equal(addedInputs().length, 0);
    },
  ));

test("added rows accept comma separated text and follow their visual order", () =>
  withPanel(["a"], ({ context, button, addedInputs }) => {
    button("添加").click();
    addedInputs()[0].value = "e";
    button("添加").click();
    addedInputs()[0].value = "f, g";
    button("保存").click();
    assert.deepEqual(
      JSON.parse(context.__storage.get("xcLocalSkinDebugIgnoreRules")),
      ["a", "f", "g", "e"],
    );
  }));

test("editing the config line replaces the saved rules", () =>
  withPanel(["a", "b"], ({ context, button, line }) => {
    line().value = "x, y";
    button("保存").click();
    assert.deepEqual(
      JSON.parse(context.__storage.get("xcLocalSkinDebugIgnoreRules")),
      ["x", "y"],
    );
    assert.equal(line().value, "x,y");
  }));

test("duplicate rules collapse into the first occurrence", () =>
  withPanel(["a", "b"], ({ context, button, addedInputs, line }) => {
    button("添加").click();
    addedInputs()[0].value = "a";
    button("保存").click();
    assert.deepEqual(
      JSON.parse(context.__storage.get("xcLocalSkinDebugIgnoreRules")),
      ["a", "b"],
    );
    assert.equal(line().value, "a,b");
  }));

test("debug panel is still titled 调试日志", () => {
  assert.match(source, /title\.textContent = "调试日志"/);
  assert.equal(
    source.includes("\\u76ae\\u80a4\\u8c03\\u8bd5\\u65e5\\u5fd7"),
    false,
  );
});

let failed = 0;
tests.forEach(({ name, run }) => {
  try {
    run();
    console.log("PASS " + name);
  } catch (error) {
    failed += 1;
    console.log("FAIL " + name + ": " + (error && error.message));
  }
});
console.log(tests.length - failed + " passed, " + failed + " failed");
process.exitCode = failed ? 1 : 0;
