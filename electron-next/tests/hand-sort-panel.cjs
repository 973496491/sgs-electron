// Run: node electron-next/tests/hand-sort-panel.cjs
// Uses installed Chromium to exercise the actual DOM and extracted userscript
// functions. Only game data is mocked; no game server or live account is used.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "../resources/daxiaochao.user.js"), "utf8");
const start = source.indexOf("  // 整理手牌：");
const end = source.indexOf("  function _0x14cdaf", start);
assert(start >= 0 && end > start, "hand sort source boundaries must exist");
const panelSource = source.slice(start, end);
const commonStart = source.indexOf("  function findSwitchContainer(");
const commonEnd = source.indexOf("  function setLocalSkinSwitchState(", commonStart);
const switchStart = source.indexOf("  function getHandSortSwitchAnchor(");
const switchEnd = source.indexOf("  window.__xcInstallHandSortPanelButton =", switchStart);
assert(commonStart >= 0 && commonEnd > commonStart && switchStart >= 0 && switchEnd > switchStart);
const switchSource = 'var HAND_SORT_SWITCH_ID="handSortPanelSwitch",HAND_SORT_LABEL_ID="handSortPanelLabel",DEBUG_SWITCH_ID="localSkinDebugSwitch",handSortSwitchLayout=null;\n' +
  source.slice(commonStart, commonEnd) + source.slice(switchStart, switchEnd);
const browserPath = [
  process.env.HAND_SORT_TEST_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((candidate) => candidate && fs.existsSync(candidate));
assert(browserPath, "Set HAND_SORT_TEST_BROWSER to an installed Chromium executable");

function browserFixture() {
  window.sortLogs = [];
  window.XC = { isDebug: true };
  window.__xcAppendLocalSkinDebugLine = (line) => sortLogs.push(line);
  window._0x46e1d4 = { v: true };
  window.makeHand = () => {
    const hand = { layouts: 0, invalidateLayoutHandCard() { this.layouts++; } };
    hand.cardUis = [["a", 13, 3], ["b", 2, 1], ["c", 7, 1], ["d", "2", 2]].map(([id, number, suit]) => ({
      id, Card: { CardNumber: number, FlowerOnSeat: suit }, selected: true, draws: 0,
      clear(flag) { if (flag !== false) throw Error("clear(false) required"); this.selected = false; },
      Draw(target) { if (target !== hand) throw Error("wrong container"); this.draws++; },
    }));
    return hand;
  };
  window.hand = makeHand();
  window.laya = {
    gamescene: { SelfSeatUi: { cardContainer: hand } },
    find(scene, seat, container) {
      if (scene !== this.gamescene || seat !== "SelfSeatUi" || container !== "cardContainer")
        throw Error("lookup escaped current self seat");
      return scene.fallbackHand || null;
    },
  };
}

async function browserChecks() {
  const checks = [];
  function check(value, label) { if (!value) throw Error(label); checks.push(label); }
  const order = (container = hand) => container.cardUis.map((card) => card.id).join("");
  const byMode = (mode) => document.querySelector('[data-hand-sort-mode="' + mode + '"]');
  const oldControls = document.getElementById("exchangeRow").outerHTML + document.getElementById("debugRow").outerHTML;
  const center = (node) => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  function checkAlignment(label) {
    layoutHandSortPanelButton();
    const target = center(document.querySelector("#xcHandSortSwitchRow .slider"));
    const exchange = center(document.querySelector("#exchangeRow .slider"));
    const debug = center(document.querySelector("#debugRow .slider"));
    check(Math.abs(target.x - debug.x) < 1 && Math.abs(target.y - exchange.y) < 1, label + " " + JSON.stringify({target, exchange, debug}));
  }
  try {
    const panel = ensureHandSortFloatingPanel();
    check(panel.parentElement === document.body, "panel mounts independently in body");
    check(ensureHandSortFloatingPanel() === panel, "initialization is idempotent");
    check(panel.style.display === "none" && handSortPanelState.timer === null, "panel initially waits for its settings switch");
    check(panel.querySelectorAll("button").length === 2 && panel.textContent === "按花色按点数手牌 4 张", "only two sorting buttons and the hand count remain");
    check(!document.getElementById("xcHandSortLauncher"), "standalone launcher is removed");
    check(insertHandSortPanelButton(), "settings switch is installed");
    const toggle = document.getElementById("handSortPanelSwitch");
    check(!toggle.checked && toggle.closest("#createIframe") && toggle.nextElementSibling.className === "slider", "new switch uses the existing settings markup");
    checkAlignment("new switch shares exchange row and debug column");
    insertHandSortPanelButton();
    check(document.querySelectorAll("#handSortPanelSwitch").length === 1 && document.querySelectorAll("#handSortPanelLabel").length === 1, "reinstall does not duplicate switch or caption");
    toggle.click();
    check(toggle.checked && panel.style.display === "block", "settings switch opens the compact panel");
    check(!byMode("CardFlower").disabled, "own hand enables controls");
    byMode("CardFlower").click();
    check(order() === "bcda", "suit sorting is ascending and stable for ties");
    byMode("CardNumber").click();
    check(order() === "bdca", "number sorting supports numeric strings and keeps ties stable");
    check(hand.layouts === 2 && hand.cardUis.every((card) => !card.selected && card.draws === 2), "both actions clear selection, redraw and relayout once");
    check(sortLogs.filter((line) => line.includes("sort:done")).length === 2, "one operation and one debug-window log per click");
    check(handSortPanelState.status.textContent === "手牌 4 张", "sorting feedback does not replace the hand count");
    check(!reorderCard("unsupported") && hand.layouts === 2, "invalid mode does not mutate the hand");
    const originalDraw = hand.cardUis[0].Draw;
    hand.cardUis[0].Draw = null;
    check(!reorderCard("CardFlower") && order() === "bdca", "invalid UI data is rejected before sorting");
    hand.cardUis[0].Draw = originalDraw;

    let leakedKeys = 0;
    const onKey = () => leakedKeys++;
    document.addEventListener("keydown", onKey);
    byMode("CardNumber").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    document.removeEventListener("keydown", onKey);
    check(leakedKeys === 0, "panel keyboard events do not bubble to game handlers");
    const state = handSortPanelState;
    toggle.click();
    check(state.hidden && state.panel.style.display === "none" && state.timer === null, "settings switch hides the panel and stops polling");
    toggle.click();
    check(!state.hidden && state.timer !== null && state.panel === panel, "switch reopens the same panel with polling");
    const settings = document.getElementById("createIframe");
    settings.style.transform = "scale(0.75)";
    checkAlignment("anchor alignment survives settings scale");
    settings.style.display = "none";
    check(panel.getBoundingClientRect().width > 0, "collapsed settings do not hide the independent sorting panel");
    settings.style.display = "block";
    settings.style.transform = "";
    checkAlignment("anchor alignment recovers after settings expand");

    _0x46e1d4.v = false;
    refreshHandSortPanel();
    byMode("CardNumber").dispatchEvent(new Event("click"));
    check(byMode("CardNumber").disabled && hand.layouts === 2, "availability is rechecked even for synthetic clicks");
    _0x46e1d4.v = true;
    laya.gamescene = null;
    refreshHandSortPanel();
    check(byMode("CardFlower").disabled && !reorderCard(), "lobby never sorts a stale hand");
    const nextHand = makeHand();
    laya.gamescene = { fallbackHand: nextHand };
    refreshHandSortPanel();
    byMode("CardNumber").click();
    check(order(nextHand) === "bdca" && hand.layouts === 2, "scene change resolves the new self hand via the scoped fallback");
    nextHand.cardUis.reverse();
    const beforePolling = order(nextHand);
    await new Promise((resolve) => setTimeout(resolve, 900));
    check(order(nextHand) === beforePolling && nextHand.layouts === 1, "status polling never automatically sorts");

    // Synthetic pointer events do not create a native active pointer. Stub only
    // capture; exercise dragging on the count row without adding a header.
    panel.setPointerCapture = () => {};
    const initialLeft = state.left;
    const initialTop = state.top;
    state.status.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: initialLeft + 8, clientY: initialTop + 8, bubbles: true }));
    panel.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 78, clientY: 98, bubbles: true }));
    panel.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true }));
    check(state.left === 70 && state.top === 90, "count-row dragging moves the compact panel");
    const saved = JSON.parse(localStorage.getItem("xcHandSortFloatingPanel"));
    check(saved.left === 70 && saved.top === 90, "drag position is persisted");
    state.left = 99999; state.top = 99999;
    window.dispatchEvent(new Event("resize"));
    const rect = panel.getBoundingClientRect();
    check(rect.right <= innerWidth && rect.bottom <= innerHeight, "resize keeps panel within viewport");
    check(document.getElementById("exchangeRow").outerHTML + document.getElementById("debugRow").outerHTML === oldControls, "original exchange and debug controls are unchanged");

    state.panel.remove();
    ensureHandSortFloatingPanel();
    check(document.querySelectorAll("#xcHandSortPanel").length === 1 && !document.getElementById("xcHandSortLauncher"), "detached panel is rebuilt without a launcher");
    handSortPanelState.cleanup();
    handSortPanelState = null;
    ensureHandSortFloatingPanel();
    check(handSortPanelState.left === 70 && handSortPanelState.top === 90 && !handSortPanelState.hidden, "fresh panel restores position and switch state");
    handSortPanelState.cleanup();
    handSortPanelState = null;
    localStorage.setItem("xcHandSortFloatingPanel", "malformed-json");
    ensureHandSortFloatingPanel();
    check(!!handSortPanelState.panel.isConnected && handSortPanelState.hidden, "invalid preferences default to a hidden panel");
    window.__xcSetHandSortPanelVisible(true);
    check(toggle.checked, "core visibility bridge synchronizes the settings switch");
    handSortSwitchLayout.row.remove();
    insertHandSortPanelButton();
    check(document.querySelectorAll("#handSortPanelSwitch").length === 1 && document.querySelectorAll("#handSortPanelLabel").length === 1, "detached settings switch is rebuilt without duplicates");
    document.getElementById("result").textContent = "PASS " + checks.length + " checks: " + checks.join("; ");
  } catch (error) {
    document.getElementById("result").textContent = "FAIL " + error.stack;
  } finally {
    if (handSortPanelState?.cleanup) handSortPanelState.cleanup();
    if (handSortSwitchLayout?.cleanup) handSortSwitchLayout.cleanup();
  }
}

const settingsFixture = '<style>.switch{position:relative;display:block;width:56px;height:26px}.switch input{opacity:0;width:0;height:0}.slider{position:absolute;top:0;left:0;right:0;bottom:0;border:1px solid #f2de9c;border-radius:34px;background:#23201d}.slider:before{position:absolute;content:"";height:20px;width:20px;left:2px;bottom:2px;background:#f2de9c;border-radius:50%}.status{position:absolute;top:50%;left:5px;transform:translateY(-50%)}input:checked+.slider{background:#ff7b54}input:checked+.slider:before{transform:translateX(30px)}input+.slider+.status:before{content:"关"}input:checked+.slider+.status:before{content:"开"}</style>' +
  '<div id="createIframe" style="position:fixed;left:25px;top:30px;width:230px;height:200px;transform-origin:top left"><div id="nativeControls">' +
  '<label id="exchangeRow" class="switch" style="position:absolute;left:78px;top:25px"><input id="CDKNotificationSwitch" type="checkbox"><span class="slider"></span><span class="status"></span></label>' +
  '<label id="debugRow" class="switch" style="position:absolute;left:150px;top:90px"><input id="localSkinDebugSwitch" type="checkbox"><span class="slider"></span><span class="status"></span></label></div></div>';
const html = '<!doctype html><meta charset="utf-8">' + settingsFixture + '<pre id="result">PENDING</pre><script>(' + browserFixture + ')();</script><script>' + panelSource + '</script><script>' + switchSource + '</script><script>window.addEventListener("load", ' + browserChecks + ');</script>';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "xc-hand-sort-test-"));
const server = http.createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});
server.listen(0, "127.0.0.1", () => {
  const browser = spawn(browserPath, [
    "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--window-size=1000,700", "--dump-dom",
    "--virtual-time-budget=5000", "--user-data-dir=" + profile,
    "http://127.0.0.1:" + server.address().port,
  ], { windowsHide: true });
  let output = "";
  let diagnostics = "";
  browser.stdout.on("data", (chunk) => { output += chunk; });
  browser.stderr.on("data", (chunk) => { diagnostics += chunk; });
  const timeout = setTimeout(() => browser.kill(), 30000);
  browser.on("error", (error) => { diagnostics += error.stack; });
  browser.on("close", () => {
    clearTimeout(timeout);
    server.close();
    const result = output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    process.stdout.write((result || diagnostics || "No browser result") + "\n");
    process.stdout.write("Temporary browser profile: " + profile + "\n");
    process.exitCode = result?.startsWith("PASS ") ? 0 : 1;
  });
});
