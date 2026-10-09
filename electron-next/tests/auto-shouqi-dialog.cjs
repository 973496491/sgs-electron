// Run: node electron-next/tests/auto-shouqi-dialog.cjs
// Real Chromium dialog + extracted UI, matching, native-confirm and fallback hooks.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const source = fs.readFileSync(path.join(__dirname, "../resources/daxiaochao.user.js"), "utf8");
const tables = require("../../doc/彩虹表.js").tables;
const maps = Object.fromEntries(["_0x3812", "_0x3911"].map(key => [key, { ...tables[key].all, ...tables[key].used }]));
const anchor = source.indexOf("function layoutAutoShouQiConfigWindow(win)");
const hookStart = source.lastIndexOf("(async function () {", anchor);
const hookEnd = source.indexOf("\n      })(),", anchor);
const hooks = source.slice(hookStart, hookEnd + "\n      })()".length);
const uiStart = source.indexOf("  // 自动手气独立选牌面板");
const uiEnd = source.indexOf("  function openAutoShouQiConfig()", uiStart);
const checkStart = source.indexOf("  function checkHandCards(");
const checkEnd = source.indexOf("  const _0xcbf83c", checkStart);
const fallbackStart = source.indexOf("  function runAutoShouQiFallback()");
assert(uiStart > fallbackStart && checkEnd > checkStart && hookEnd > anchor);
assert(source.slice(source.indexOf("        ready(n) {"), source.indexOf("        start() {", source.indexOf("        ready(n) {"))).includes('closeAutoShouQiDialog("reset")'));
const browserPath = [process.env.SQK_TEST_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p => p && fs.existsSync(p));
assert(browserPath, "Chromium is required");

function fixture() {
  window.logs = []; window.clicks = []; window.schedules = []; window.cancels = []; window.nativeEvents = []; window.nativeShows = [];
  window.globalState = { configHandCards: [], configHandCardsMode: "all", configHandCardsRejected: false };
  window.globalConfig = { autoSQKSwitch: true };
  window.room = { myID: 0 };
  window.currentCards = [14];
  window.Zone = { shoupai: () => currentCards };
  window.XC = { sqkName: {}, sqk: {}, allCard: {} };
  window._0x5984e1 = { 14: { name: "连弩" }, 52: { name: "爪黄+1" }, 70: { name: "的卢+1" }, 83: { name: "绝影+1" }, 1010: { name: "绝影+1" }, 134: { name: "骅骝+1" }, 108: { name: "寒冰剑" } };
  XC.allCard = _0x5984e1;
  window.Laya = { Event: { CLICK: "click" } };
  window.__xcAutoSQKDebugLog = (event, data) => logs.push({ event, data });
  window.cancelAutoShouQiFallback = reason => cancels.push(reason);
  window.scheduleAutoShouQiFallback = (...args) => schedules.push(args);
  window.retryAutoShouQiFallback = () => {};
  window.autoShouQiFallbackTimer = null;
  window.autoShouQiFallbackSource = "test";
  window.autoShouQiFallbackAttempt = 0;
  window.autoShouQiFallbackLastClickCards = "";
  const prototype = { btnOkHandler() {}, Close() {}, UpdateInfo() {}, pushHandCardUis() {}, updateCardUIs() {}, SendClientChr1v1CardReq() {} };
  window.laya = {
    get: () => Object.create(prototype),
    win: name => name === "ShouQiKaAskWindow" ? { useBtn: { onMouse: event => clicks.push(event) } } : null,
    ged: { event: (...args) => nativeEvents.push(args), ShowWindow: (...args) => nativeShows.push(args) },
  };
  window.redefine = (target, key, descriptor) => {
    target["__" + key] = target[key];
    Object.defineProperty(target, key, { ...descriptor, configurable: true });
  };
}

async function checks() {
  let count = 0;
  const check = (value, message) => { if (!value) throw Error(message); count++; };
  const button = id => document.querySelector('[data-card-id="' + id + '"]');
  const choose = id => button(id).click();
  const clear = () => { while (document.querySelector(".sqk-chip")) document.querySelector(".sqk-chip").click(); };
  try {
    await hookReady;
    document.getElementById("focus-before").focus();
    check(triggerAutoShouQiConfigWindow(currentCards, "openConfig"), "existing trigger opens the panel");
    check(isAutoShouQiDialogOpen() && nativeEvents.length === 0, "custom UI bypasses native popup");
    check(document.querySelectorAll(".sqk-card").length === 22 && !button(327) && button(25) && button(130), "22 candidates; peach and wine remain separate without the combined option");
    const equipment = Array.from(document.querySelectorAll("section:first-child .sqk-card"));
    check(equipment.length === 8, "eight equipment choices");
    check([52, 70, 1010, 134, 108].every(id => button(id)), "four distinct horses and Ice Sword");
    const bounds = document.querySelector("dialog").getBoundingClientRect();
    check(bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight, "dialog fits viewport");
    for (const card of equipment) {
      const r = card.getBoundingClientRect();
      check(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest(".sqk-card") === card, "equipment exposed and clickable: " + card.ariaLabel);
      const label = card.querySelector(".sqk-name");
      check(label.scrollWidth <= card.clientWidth, "equipment name fits: " + card.ariaLabel);
    }
    choose(52); choose(70); choose(1010); choose(134);
    check(autoShouQiDialog.selected.length === 4 && button(108).disabled, "four-target capacity");
    document.querySelector('[aria-label="移除的卢"]').click();
    check(!button(108).disabled && autoShouQiDialog.selected.length === 3, "chip removal updates choices");
    triggerAutoShouQiConfigWindow([52, 83, 134], "deal");
    check(document.querySelectorAll("#xcAutoShouQiDialog").length === 1 && autoShouQiDialog.selected.length === 3, "repeated deals preserve pending selection");
    runAutoShouQiFallback();
    check(clicks.length === 0 && cancels.at(-1) === "config-window-present", "fallback pauses while selecting");
    currentCards = [52, 83, 134];
    document.querySelector('[data-mode="all"]').click();
    check(!isAutoShouQiDialogOpen() && globalState.configHandCards.join() === "52,1010,134", "native confirmation receives selection");
    check(globalState.configHandCardsMode === "all" && clicks.length === 0, "matched all does not use a card");
    check(document.activeElement.id === "focus-before", "focus restored");
    triggerAutoShouQiConfigWindow(currentCards);
    clear(); choose(108);
    currentCards = [14];
    document.querySelector('[data-mode="any"]').click();
    check(globalState.configHandCardsMode === "any" && clicks.length === 1 && clicks[0].type === "click", "unmatched any clicks the actual ask button once");
    check(schedules.at(-1).join() === "config:save,600,14", "existing fallback receives dedup signature");
    triggerAutoShouQiConfigWindow(currentCards);
    const savedHandler = autoShouQiConfirmHandler;
    autoShouQiConfirmHandler = undefined;
    document.querySelector('[data-mode="all"]').click();
    check(isAutoShouQiDialogOpen() && clicks.length === 1 && autoShouQiDialog.status.textContent.includes("尚未就绪"), "unready handler never sends native construction requests");
    autoShouQiConfirmHandler = savedHandler;
    document.querySelector(".sqk-skip").click();
    check(globalState.configHandCardsRejected && !globalState.configHandCards.length && !isAutoShouQiDialogOpen(), "skip rejects this round");
    runAutoShouQiFallback();
    check(cancels.at(-1) === "rejected" && clicks.length === 1, "rejected round does not retry");
    globalState.configHandCardsRejected = false;
    triggerAutoShouQiConfigWindow(currentCards);
    document.querySelector("dialog").dispatchEvent(new Event("cancel", { cancelable: true }));
    check(!isAutoShouQiDialogOpen() && globalState.configHandCardsRejected, "Escape dismisses an empty selection");
    globalState.configHandCardsRejected = false;
    triggerAutoShouQiConfigWindow(currentCards);
    choose(52);
    closeAutoShouQiDialog("reset");
    saveAutoShouQiDialog("all");
    check(!isAutoShouQiDialogOpen() && !globalState.configHandCards.length && !globalState.configHandCardsRejected, "new-game cleanup cannot submit stale targets");
    const show = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = () => { throw Error("test popup failure"); };
    triggerAutoShouQiConfigWindow(currentCards);
    check(!document.querySelector("#xcAutoShouQiDialog") && nativeEvents.length === 1, "DOM failure cleans up and falls back to native UI");
    HTMLDialogElement.prototype.showModal = show;
    triggerAutoShouQiConfigWindow(currentCards);
    choose(52); choose(1010); choose(108);
    await new Promise(resolve => setTimeout(resolve, 350));
    check(nativeShows.length === 0, "late native fallback does not cover a recovered custom panel");
    document.getElementById("result").textContent = "PASS " + count + " checks";
  } catch (error) {
    document.getElementById("result").textContent = "FAIL " + error.stack;
  }
}

const scripts = 'const maps=' + JSON.stringify(maps) + ';const n=id=>maps._0x3812[id];const _0x4efae6=id=>maps._0x3911[id];(' + fixture + ')();\n' + source.slice(checkStart, checkEnd) + '\nwindow.hookReady=' + hooks + ';\n' + source.slice(fallbackStart, uiEnd) + '\nwindow.addEventListener("load",' + checks + ');';
const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#303b46}#result{display:none}</style><button id="focus-before">Game fixture</button><pre id="result">PENDING</pre><script>' + scripts.replace(/<\/script/gi, "<\\/script") + '</script>';
const server = http.createServer((request, response) => { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(html); });
function run(port, size) {
  return new Promise(resolve => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "xc-sqk-dialog-"));
    const screenshot = path.join(profile, "panel.png");
    const browser = spawn(browserPath, ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--window-size=" + size, "--dump-dom", "--virtual-time-budget=2500", "--screenshot=" + screenshot, "--user-data-dir=" + profile, "http://127.0.0.1:" + port], { windowsHide: true });
    let output = "", diagnostics = "";
    browser.stdout.on("data", chunk => { output += chunk; });
    browser.stderr.on("data", chunk => { diagnostics += chunk; });
    const timeout = setTimeout(() => browser.kill(), 30000);
    browser.on("error", error => { diagnostics += error.message; });
    browser.on("close", () => {
      clearTimeout(timeout);
      const result = output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1] || diagnostics.slice(-1500) || "No browser result";
      process.stdout.write(size + ": " + result + "\nScreenshot: " + screenshot + "\n");
      resolve(result.startsWith("PASS "));
    });
  });
}
server.listen(0, "127.0.0.1", async () => {
  const outcomes = await Promise.all([run(server.address().port, "1000,780"), run(server.address().port, "540,740")]);
  server.close();
  process.exitCode = outcomes.every(Boolean) ? 0 : 1;
});
