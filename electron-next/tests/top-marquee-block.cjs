// Run: node electron-next/tests/top-marquee-block.cjs [--source <userscript>]
// Actual controller + decoded panel DOM in headless Chromium; game services are simulated.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const sourceArg = process.argv.indexOf("--source");
const sourcePath = sourceArg < 0 ? path.join(__dirname, "../resources/daxiaochao.user.js") : process.argv[sourceArg + 1];
assert(sourcePath, "--source requires a path");
const source = fs.readFileSync(sourcePath, "utf8");
function slice(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, "source boundaries: " + start);
  return source.slice(a, b);
}
const controller = slice("  // 顶部跑马灯：", "  async function setProto()");
for (const [saved, expected] of [["true", true], ["false", false], ["broken", false]]) {
  const context = { window: {}, localStorage: { getItem: () => saved } };
  vm.runInNewContext(controller, context);
  assert.equal(context.window.__xcIsTopMarqueeBlocked(), expected, "saved preference on fresh load: " + saved);
}
const button = slice("  // 顶部广播按钮：", "  function waitForCardBackSwitch(");
const helpers = slice("  function findSwitchContainer(", "  function setLocalSkinSwitchState(") +
  slice("  function getHandSortSwitchAnchor(", "  function syncHandSortPanelSwitch(");
assert(!source.includes('redefine(laya[i(671)](i(996)), i(1128), { value: function () {} })'), "old permanent block removed");
assert(source.includes("      installTopMarqueeBlocker(),"), "login patch installs the controller");
assert(source.includes("      window.__xcInstallTopMarqueeButton();"), "panel rebuild reinstalls button");

// The embedded panel uses decoder m (alias C). Decode only its static string array.
const dataStart = source.indexOf("  function D() {");
const dataEnd = source.indexOf("    ];", dataStart);
const strings = vm.runInNewContext(source.slice(source.indexOf("[", dataStart), dataEnd + 5));
function decode(text) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
  let bytes = "", value = 0, count = 0;
  for (const char of text) {
    const n = alphabet.indexOf(char);
    if (n < 0) continue;
    value = count % 4 ? 64 * value + n : n;
    if (count++ % 4) bytes += String.fromCharCode(255 & (value >> ((-2 * count) & 6)));
  }
  return decodeURIComponent(Array.from(bytes, c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
}
const markup = strings.filter(s => s.length > 3000).map(decode).find(s => s.includes('id="seatUISwitch"'));
assert(markup, "actual panel template found");

function fixture() {
  window.logs = [];
  window.appendLocalSkinDebugLine = (line, force) => {
    if (force !== false) throw Error("must respect debug window visibility");
    logs.push(line);
  };
  window.gameTimers = [];
  window.Laya = { timer: {
    once(delay, owner, callback) { this.clear(owner, callback); gameTimers.push({ owner, callback }); },
    clear(owner, callback) { window.gameTimers = gameTimers.filter(t => t.owner !== owner || t.callback !== callback); },
    clearAll(owner) { window.gameTimers = gameTimers.filter(t => t.owner !== owner); },
  } };
  window.runGameTimer = () => {
    const timer = gameTimers.shift();
    if (timer) timer.callback.call(timer.owner);
  };
  class Dict {
    constructor() { this.items = new Map(); }
    forEach(callback) { this.items.forEach((value, key) => callback(key, value)); }
    del(key) { this.items.delete(key); }
  }
  window.makeUI = (id, isNew, posId = 0) => ({
    noticeId: id, isNew, posId, destroyed: false,
    destroy() { this.destroyed = true; this.isNew = false; },
  });
  class PromptLayer {
    constructor() {
      this.marqueeUIList = new Dict();
      this.marqueeUIActList = new Dict();
      this.rendered = [];
    }
    ShowMarquee(message, isNew = false, extra) {
      if (message) {
        this.rendered.push({ message, isNew, extra });
        this.marqueeUIList.items.set(message.ID, makeUI(message.ID, isNew));
      }
      return 42;
    }
    ShowOldMarquee() { this.ShowMarquee(window.chat.BannerSystemNoticeList.shift()); }
    ShowNewMarquee() {
      window.manager.nowPlayeNoticeId = 0;
      const message = window.manager.queue.shift();
      if (message) {
        window.manager.nowPlayeNoticeId = message.ID;
        Laya.timer.once(50000, window.manager, window.manager.OnTimeOut);
      }
      this.ShowMarquee(message, true);
    }
    HideMarquee(id) {
      this.marqueeUIList.items.get(id)?.destroy();
      this.marqueeUIList.del(id);
    }
    ShowTextPrompt(text) { this.prompt = text; }
    HideAllMarquee() { throw Error("must not clear activity rows"); }
  }
  window.PromptLayer = PromptLayer;
  window.layer = new PromptLayer();
  window.chat = { BannerSystemNoticeList: [], history: ["normal chat"] };
  window.makeManager = () => ({
    queue: [], nowPlayeNoticeId: 0, ended: 0,
    AddNotice(message) { this.queue.push(message); this.playNotice(); },
    playNotice() { if (!this.nowPlayeNoticeId) window.layer.ShowNewMarquee(); },
    OnTimeOut() { this.OnNoticPlayEnd(); },
    OnNoticPlayEnd() {
      this.ended++;
      this.nowPlayeNoticeId = 0;
      Laya.timer.once(1000, this, this.playNotice);
    },
    ClearData() { throw Error("manager data must not be reset"); },
  });
  window.manager = makeManager();
  window.servicesReady = true;
  window.laya = { class(name) {
    if (!servicesReady) return null;
    return { PromptLayer: window.layer, ChatSysNewsManager: window.manager, ChatManager: window.chat }[name];
  } };
  window.nativeShow = PromptLayer.prototype.ShowMarquee;
  localStorage.removeItem("xcTopMarqueeBlocked");
}

async function checks() {
  const passed = [];
  const check = (condition, name) => { if (!condition) throw Error(name); passed.push(name); };
  const center = node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const frame = () => new Promise(resolve => setTimeout(resolve, 80));
  const settings = document.getElementById("seatUISwitch").closest(".setting.panel-content");
  const header = settings.previousElementSibling;
  settings.style.maxHeight = "5000px";
  header.classList.add("active");
  let headerClicks = 0;
  header.addEventListener("click", () => headerClicks++);
  function alignment(label) {
    layoutTopMarqueeButton();
    const target = center(document.querySelector("#xcTopMarqueeSwitchRow .slider"));
    const column = center(getHandSortSwitchAnchor(document.getElementById("seatUISwitch")));
    const row = center(getHandSortSwitchAnchor(document.getElementById("skinPaperSwitch")));
    check(Math.abs(target.x - column.x) < 1 && Math.abs(target.y - row.y) < 1,
      label + " wallpaper row and visible-card column " + JSON.stringify({ target, column, row }));
    const captionNode = document.querySelector('#xcTopMarqueeSwitchRow > label[for="xcTopMarqueeToggle"]');
    const nativeCaption = document.querySelector("#wallpaperContainer .explanation");
    const caption = captionNode.getBoundingClientRect();
    const nativeRect = nativeCaption.getBoundingClientRect();
    const slider = document.querySelector("#xcTopMarqueeSwitchRow .slider").getBoundingClientRect();
    check(caption.bottom <= slider.top + 1 && Math.abs(caption.top - nativeRect.top) < 1 &&
      Math.abs(caption.left - slider.left - (nativeRect.left - getHandSortSwitchAnchor(document.getElementById("skinPaperSwitch")).getBoundingClientRect().left)) < 1 &&
      ["fontSize", "fontFamily", "fontWeight", "lineHeight", "color"].every(key => getComputedStyle(captionNode)[key] === getComputedStyle(nativeCaption)[key]),
      label + " caption above switch matches native position and typography");
  }
  try {
    await frame();
    check(installTopMarqueeBlocker(), "controller installs");
    const hook = layer.ShowMarquee;
    check(installTopMarqueeBlocker() && layer.ShowMarquee === hook, "controller installation is idempotent");
    check(!__xcIsTopMarqueeBlocked(), "first launch defaults off");
    const msg = { ID: 1, chatMsg: "first" };
    check(layer.ShowMarquee(msg, false, "extra") === 42 && layer.rendered[0].message === msg &&
      layer.rendered[0].extra === "extra", "off delegates original this, arguments and result");
    manager.AddNotice({ ID: 2, chatMsg: "new" });
    const active = layer.marqueeUIList.items.get(2);
    const activity = makeUI(90, true, 1);
    layer.marqueeUIActList.items.set(90, activity);
    Laya.timer.once(100, active, () => { throw Error("destroyed banner timer survived"); });
    chat.BannerSystemNoticeList.push({ ID: 3 }, { ID: 4 });
    check(installTopMarqueeButton(), "button installs into actual panel");
    alignment("native panel");
    const input = document.getElementById("xcTopMarqueeToggle");
    input.click();
    check(input.checked && __xcIsTopMarqueeBlocked() && localStorage.getItem("xcTopMarqueeBlocked") === "true", "click enables and persists block");
    check(headerClicks === 0 && header.nextElementSibling === settings && settings.contains(input),
      "toggle follows settings collapse and leaves native header chain intact");
    check(active.destroyed && layer.marqueeUIList.items.size === 0 && manager.nowPlayeNoticeId === 0,
      "enabling removes existing top banners and releases active new message");
    check(!gameTimers.some(t => t.owner === active || t.callback === manager.OnTimeOut), "visible banner and timeout timers cleared");
    check(!activity.destroyed && layer.marqueeUIActList.items.get(90) === activity, "activity extra rows remain");
    check(chat.BannerSystemNoticeList.length === 0 && chat.history[0] === "normal chat", "only old banner backlog cleared");
    const count = layer.rendered.length;
    chat.BannerSystemNoticeList.push({ ID: 5 }, { ID: 6 });
    layer.ShowOldMarquee();
    manager.queue.push({ ID: 7 }, { ID: 8 });
    manager.playNotice();
    for (let i = 0; i < 4; i++) runGameTimer();
    check(layer.rendered.length === count && manager.queue.length === 0 && manager.nowPlayeNoticeId === 0,
      "old and new branches suppressed while new queue advances");
    layer.ShowTextPrompt("game prompt");
    check(layer.prompt === "game prompt" && chat.history.length === 1, "game prompts and chat unaffected");
    input.click();
    manager.AddNotice({ ID: 9 });
    chat.BannerSystemNoticeList.push({ ID: 10 });
    layer.ShowOldMarquee();
    check(!input.checked && layer.rendered.length === count + 2 && localStorage.getItem("xcTopMarqueeBlocked") === "false",
      "off restores both old and new future broadcasts");
    manager.nowPlayeNoticeId = 88;
    const ended = manager.ended;
    finishBlockedTopMarquee({ ID: 77 });
    check(manager.nowPlayeNoticeId === 88 && manager.ended === ended, "old overlapping UI cannot end current message");
    const originalAdd = manager.AddNotice;
    manager.__AddNotice = originalAdd;
    manager.AddNotice = function () {};
    installTopMarqueeBlocker();
    check(manager.AddNotice === originalAdd && !manager.__AddNotice, "legacy permanent empty hook restored");
    const otherHook = function (msg) { return msg; };
    manager.__AddNotice = originalAdd;
    manager.AddNotice = otherHook;
    installTopMarqueeBlocker();
    check(manager.AddNotice === otherHook, "unrelated nonempty AddNotice hook preserved");
    manager.AddNotice = originalAdd;
    delete manager.__AddNotice;
    input.click();
    window.layer = new PromptLayer();
    window.manager = makeManager();
    manager.AddNotice({ ID: 11 });
    check(layer.rendered.length === 0 && manager.nowPlayeNoticeId === 0, "prototype hook and fresh manager lookup survive service replacement");
    cleanupTopMarqueeBlocker();
    check(layer.ShowMarquee === nativeShow && topMarqueeState.hooks.length === 0, "cleanup restores native method");
    window.servicesReady = false;
    check(!installTopMarqueeBlocker() && topMarqueeState.retryTimer !== null, "late services schedule retry");
    const retry = topMarqueeState.retryTimer;
    installTopMarqueeBlocker();
    check(topMarqueeState.retryTimer === retry, "retry loop is deduplicated");
    window.servicesReady = true;
    await new Promise(resolve => setTimeout(resolve, 550));
    check(layer.ShowMarquee !== nativeShow && topMarqueeState.retryTimer === null, "retry installs when services become ready");
    document.getElementById("createIframe").style.transform = "scale(0.75)";
    await frame();
    alignment("scaled panel");
    settings.style.maxHeight = "0px";
    await frame();
    alignment("collapsed settings");
    settings.style.maxHeight = "5000px";
    document.getElementById("createIframe").style.transform = "";
    await frame();
    alignment("expanded settings");
    document.querySelector('#xcTopMarqueeSwitchRow > label[for="xcTopMarqueeToggle"]').click();
    check(!input.checked && headerClicks === 0, "caption toggles without collapsing settings");
    installTopMarqueeButton();
    check(document.querySelectorAll("#xcTopMarqueeToggle").length === 1, "button reinstall has no duplicates");
    const parent = settings.parentElement;
    const clone = parent.cloneNode(true);
    clone.querySelector("#xcTopMarqueeSwitchRow").remove();
    parent.replaceWith(clone);
    installTopMarqueeButton();
    check(document.querySelectorAll("#xcTopMarqueeToggle").length === 1 && !document.getElementById("xcTopMarqueeToggle").checked,
      "rebuilt panel restores switch state");
    check(logs.some(line => line.includes("toggle:on")) && logs.some(line => line.includes("toggle:off")), "diagnostics use debug-window bridge");
    document.getElementById("xcMarqueeTestResult").textContent = "PASS " + passed.length + " checks: " + passed.join("; ");
  } catch (error) {
    document.getElementById("xcMarqueeTestResult").textContent = "FAIL after " + passed.length + " checks: " + error.stack;
  } finally {
    cleanupTopMarqueeBlocker();
    cleanupTopMarqueeButton();
  }
}

const html = '<!doctype html><meta charset="utf-8"><style>body{background:#202020}#createIframe{position:relative;margin:30px;width:380px;transform-origin:top left}#iframe-source{position:relative;display:flow-root}</style>' +
  '<div id="createIframe"><div id="iframe-source">' + markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "") + '</div></div><pre id="xcMarqueeTestResult">PENDING</pre>' +
  '<script>window.onerror=function(message,url,line){document.getElementById("xcMarqueeTestResult").textContent="FAIL script: "+message+" line "+line;};</script>' +
  '<script>(' + fixture + ')();</script><script>' + controller + helpers + button + '</script><script>window.addEventListener("load",' + checks + ');</script>';
const browserPath = [process.env.TOP_MARQUEE_TEST_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p => p && fs.existsSync(p));
assert(browserPath, "an installed Chromium browser is required");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "xc-top-marquee-test-"));
const server = http.createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:" });
  response.end(html);
});
server.listen(0, "127.0.0.1", () => {
  const browser = spawn(browserPath, ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--window-size=1000,900", "--dump-dom", "--virtual-time-budget=5000", "--user-data-dir=" + profile, "http://127.0.0.1:" + server.address().port], { windowsHide: true });
  let output = "", diagnostics = "";
  browser.stdout.on("data", chunk => { output += chunk; });
  browser.stderr.on("data", chunk => { diagnostics += chunk; });
  const timeout = setTimeout(() => browser.kill(), 30000);
  browser.on("error", error => { diagnostics += error.stack; });
  browser.on("close", () => {
    clearTimeout(timeout);
    server.close();
    const result = output.match(/<pre id="xcMarqueeTestResult">([\s\S]*?)<\/pre>/)?.[1];
    process.stdout.write((result || diagnostics || "No browser result") + "\n");
    fs.writeFileSync(path.join(profile, "result.html"), output);
    process.stdout.write("Test artifacts: " + profile + "\n");
    process.exitCode = result?.startsWith("PASS ") ? 0 : 1;
  });
});
