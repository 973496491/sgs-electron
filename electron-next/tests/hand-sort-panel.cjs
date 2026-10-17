// Run: node electron-next/tests/hand-sort-panel.cjs [--preview]
// Uses installed Chromium with the independent feature and client adapter.
// Shared DOM helpers come from the userscript; game services are simulated.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../resources/daxiaochao.user.js"), "utf8");
const createHandCardsModule = require("../src/features/hand-cards.js");
const createHandCardsClient = require("../src/adapters/hand-cards-client.js");
const panelSource = "const createHandCardsModule=" + createHandCardsModule.toString() + ";\nconst createHandCardsClient=" + createHandCardsClient.toString() + ";";
const commonStart = source.indexOf("  function findSwitchContainer(");
const commonEnd = source.indexOf("  function setLocalSkinSwitchState(", commonStart);
const anchorStart = source.indexOf("  function getHandSortSwitchAnchor(");
const anchorEnd = source.indexOf("  // Hand-card main-panel host.", anchorStart);
assert(commonStart >= 0 && commonEnd > commonStart && anchorStart >= 0 && anchorEnd > anchorStart);
const helpersSource = source.slice(commonStart, commonEnd) + source.slice(anchorStart, anchorEnd);
// Use the actual native caption/dialog CSS, including the margin:0/inset:auto rule.
const tableStart = source.indexOf("  function D() {"), tableEnd = source.indexOf("    ];", tableStart);
const templateStrings = vm.runInNewContext(source.slice(source.indexOf("[", tableStart), tableEnd + 5));
function decodeTemplate(text) {
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
const nativeTemplate = templateStrings.filter(text => text.length > 3000).map(decodeTemplate).find(text => text.includes('id="wallpaperContainer"'));
assert(nativeTemplate, "native settings template exists");
const nativeSettingsCss = [...nativeTemplate.matchAll(/([^{}<>]+)\{([^{}]*)\}/g)]
  .filter(match => /(^|,)\s*dialog(?:\b|[.:#])/.test(match[1]) || /\.expandable-switch|\.explanation|\.switch-container/.test(match[1]))
  .map(match => match[0]).join("\n");
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
  window.testFeatureEnabled = { value: true };
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
  window.gameContext = { CanOperationInGame: () => true, IsPokerDDZ: false };
  window.laya = {
    class(name) { if (name !== "GameContext") throw Error("unexpected class"); return gameContext; },
    gamescene: { SelfSeatUi: { cardContainer: hand } },
    find(scene, seat, container) {
      if (scene !== this.gamescene || seat !== "SelfSeatUi" || container !== "cardContainer")
        throw Error("lookup escaped current self seat");
      return scene.fallbackHand || null;
    },
  };
  window.makeSelectableHand = () => {
    const h = { cardUis: [], areChoosingCard: true, operations: [], externalSelected: 0 };
    const selector = { SelectCountMax: 20, get SelectedCount() {
      return h.externalSelected + h.cardUis.filter(ui => ui.Card.Selected).length;
    } };
    h.selectCardContext = { CardSelector: selector };
    h.cardUis = [3, 1, 4, 2, 1].map((suit, index) => {
      const card = { FlowerOnSeat: suit, CardFlower: suit, IsInHand: true, IsVirtualCard: false, Selected: false };
      return { id: String(index), Card: card, Activated: true, CardUI_Click() {
        if (!gameContext.CanOperationInGame() || !h.areChoosingCard || !this.Activated) return;
        if (!card.Selected && selector.SelectedCount >= selector.SelectCountMax) throw Error("must never evict an existing selection");
        card.Selected = !card.Selected;
        h.operations.push([index, card.Selected]);
        if (h.afterClick) h.afterClick(this);
      } };
    });
    return h;
  };
}


// Test views read DOM/public interfaces only; feature-private state is never exported.
function moduleHarness() {
  window.activeIntervals = new Set();
  const nativeSet = window.setInterval.bind(window), nativeClear = window.clearInterval.bind(window);
  window.setInterval = (...args) => { const id = nativeSet(...args); activeIntervals.add(id); return id; };
  window.clearInterval = id => { activeIntervals.delete(id); nativeClear(id); };
  window.activeTimeouts = new Set(); window.timeoutHistory = []; window.frameHistory = [];
  const nativeTimeout = window.setTimeout.bind(window), nativeClearTimeout = window.clearTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => {
    const id = nativeTimeout(() => { activeTimeouts.delete(id); callback(...args); }, delay);
    activeTimeouts.add(id); timeoutHistory.push({ delay, callback: () => callback(...args) }); return id;
  };
  window.clearTimeout = id => { activeTimeouts.delete(id); nativeClearTimeout(id); };
  const nativeFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => { frameHistory.push(callback); return nativeFrame(callback); };
  window.activeObservers = new Set();
  for (const name of ["ResizeObserver", "MutationObserver"]) {
    const NativeObserver = window[name];
    window[name] = class extends NativeObserver {
      constructor(callback) { super(callback); activeObservers.add(this); }
      disconnect() { super.disconnect(); activeObservers.delete(this); }
    };
  }
  window.handCardsClient = createHandCardsClient({ getLaya: () => laya, isEnabled: () => testFeatureEnabled.value });
  window.handCardsHost = {
    getControls: () => ({ exchange: document.getElementById("CDKNotificationSwitch"), debug: document.getElementById("localSkinDebugSwitch"), settings: document.getElementById("wallpaperContainer") || document.getElementById("blockEffectContainer") }),
    findSwitchContainer, clearDuplicateIds, clearText: setLocalSkinLabel,
    ensureFloatingLabel, getAnchor: getHandSortSwitchAnchor,
  };
  window.recreateHandCards = () => {
    window.handCards?.dispose();
    window.handCards = createHandCardsModule({ window, document, client: handCardsClient, storage: localStorage,
      log: (event, data) => sortLogs.push("[整理手牌] " + event + " " + JSON.stringify(data)) });
    handCards.start();
    handCards.attachMainPanel(handCardsHost);
  };
  window.panelView = {
    get panel() { return document.getElementById("xcHandSortPanel"); },
    get body() { return this.panel?.firstElementChild; },
    get buttons() { return [...this.panel.querySelectorAll("[data-hand-sort-mode]")]; },
    get suitInputs() { return [...this.panel.querySelectorAll("[data-hand-select-suit]")]; },
    get selectionButtons() { return [...this.panel.querySelectorAll("[data-hand-select-action]")]; },
    get hidden() { return !handCards.isVisible(); },
    get timer() { return activeIntervals.size ? true : null; },
    get left() { return parseFloat(this.panel?.style.left) || 0; },
    get top() { return parseFloat(this.panel?.style.top) || 0; },
    get orientation() { return handCards.getOptions().orientation; },
    get suitSelection() { return handCards.getOptions().suitSelection; },
  };
  recreateHandCards();
}

async function browserChecks() {
  const checks = [];
  function check(value, label) { if (!value) throw Error(label); checks.push(label); }
  const order = (container = hand) => container.cardUis.map((card) => card.id).join("");
  const byMode = (mode) => document.querySelector('[data-hand-sort-mode="' + mode + '"]');
  const oldControls = document.getElementById("exchangeRow").outerHTML + document.getElementById("debugRow").outerHTML;
  const center = (node) => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  function checkAlignment(label) {
    handCards.requestMainPanel();
    const target = center(document.querySelector("#xcHandSortSwitchRow .slider"));
    const exchange = center(document.querySelector("#exchangeRow .slider"));
    const debug = center(document.querySelector("#debugRow .slider"));
    check(Math.abs(target.x - debug.x) < 1 && Math.abs(target.y - exchange.y) < 1, label + " " + JSON.stringify({target, exchange, debug}));
  }
  try {
    const panel = handCards.mount();
    check(panel.parentElement === document.body, "panel mounts independently in body");
    check(handCards.mount() === panel, "initialization is idempotent");
    check(panel.style.display === "none" && panelView.timer === null, "panel initially waits for its settings switch");
    check(panel.querySelectorAll("button").length === 4 && panel.querySelectorAll('input[type="checkbox"]').length === 4 && !panel.textContent.includes("手牌"), "two sorting buttons, two selection buttons and four suits replace the count");
    check(!document.getElementById("xcHandSortLauncher"), "standalone launcher is removed");
    check(handCards.requestMainPanel(), "settings switch is installed");
    const toggle = document.getElementById("handSortPanelSwitch");
    check(!toggle.checked && toggle.closest("#createIframe") && toggle.nextElementSibling.className === "slider", "new switch uses the existing settings markup");
    checkAlignment("new switch shares exchange row and debug column");
    handCards.requestMainPanel();
    check(document.querySelectorAll("#handSortPanelSwitch").length === 1 && document.querySelectorAll("#handSortPanelLabel").length === 1, "reinstall does not duplicate switch or caption");
    toggle.click();
    check(toggle.checked && panel.style.display === "block", "settings switch opens the compact panel");
    const allButtons = [...panelView.buttons, ...panelView.selectionButtons];
    const buttonRects = allButtons.map(button => button.getBoundingClientRect());
    const buttonRect = buttonRects[0];
    const suitRects = panelView.suitInputs.map(input => input.parentElement.getBoundingClientRect());
    check(buttonRects.every((rect, index) => rect.width < 72 && rect.height < 32 && Math.abs(rect.width - suitRects[index].width) < 0.1 && Math.abs(rect.height - suitRects[index].height) < 0.1 && Math.abs(rect.left - suitRects[index].left) < 0.1) && allButtons.map(button => button.textContent).join(",") === "按花色,按点数,全选,反选" && panelView.suitInputs.map(input => input.parentElement.textContent).join(",") === "黑桃,红桃,梅花,方块" && panelView.suitInputs.every(input => input.getAttribute("aria-label") === input.parentElement.textContent), "equal-sized aligned rows use text-only suits and restored sort labels");
    check(suitRects.every(rect => rect.top === suitRects[0].top && rect.bottom < buttonRect.top) && buttonRects.every(rect => rect.top === buttonRect.top), "four suits above four buttons form exactly two rows");
    check(Math.abs(suitRects[0].left - buttonRect.left) < 0.1 && Math.abs(suitRects[3].right - buttonRects[3].right) < 0.1 && Math.abs(buttonRect.top - suitRects[0].bottom - 8) < 0.1 && suitRects.slice(1).every((rect,index) => Math.abs(rect.left - suitRects[index].right - 8) < 0.1) && buttonRects.slice(1).every((rect,index) => Math.abs(rect.left - buttonRects[index].right - 8) < 0.1), "both rows align at the edges with equal eight-pixel horizontal and vertical gaps");
    check(panelView.suitInputs.every(input => Math.abs(input.getBoundingClientRect().width - 14.4 * 0.9) < 0.1 && Math.abs(parseFloat(getComputedStyle(input.parentElement).fontSize) - 13.2 * 0.9) < 0.1), "checkboxes and text shrink ten percent together");
    check(panelView.suitInputs.every(input => {
      const range = document.createRange();
      range.selectNodeContents(input.parentElement.lastChild);
      return input.parentElement.getBoundingClientRect().right - range.getBoundingClientRect().right < 6.6;
    }), "suit labels hug the text without stretched trailing blank space");
    const gear = document.getElementById("xcHandSortSettingsButton");
    check(gear && gear.getAttribute("aria-haspopup") === "dialog", "main panel exposes a dedicated settings gear");
    const nativeCaption = document.querySelector("#wallpaperContainer .explanation");
    const blockCaption = document.querySelector("#blockEffectContainer .explanation");
    const pseudoProperties = ["content", "fontSize", "right", "top", "transform", "opacity"];
    check(gear.matches(".expandable-switch .explanation") && gear.textContent === "整理手牌" &&
      pseudoProperties.every(key => getComputedStyle(gear, "::after")[key] === getComputedStyle(nativeCaption, "::after")[key] && getComputedStyle(gear, "::after")[key] === getComputedStyle(blockCaption, "::after")[key]), "hand settings reuse the same native gear pseudo-element as wallpaper and block settings");
    function checkNativeCaption(label) {
      const own = gear.getBoundingClientRect(), ref = nativeCaption.getBoundingClientRect();
      const ownAnchor = getHandSortSwitchAnchor(toggle).getBoundingClientRect();
      const refAnchor = getHandSortSwitchAnchor(document.getElementById("skinPaperSwitch")).getBoundingClientRect();
      check(Math.abs(own.width - ref.width) < 1 && Math.abs(own.left - ownAnchor.left - (ref.left - refAnchor.left)) < 1 &&
        Math.abs(own.top - ownAnchor.top - (ref.top - refAnchor.top)) < 1 && getComputedStyle(gear).font === getComputedStyle(nativeCaption).font, label);
    }
    checkNativeCaption("caption width, typography and switch-relative placement match the native settings entry");
    gear.click();
    const settingsDialog = document.getElementById("xcHandSortSettingsDialog");
    const suitToggle = document.getElementById("xcHandSuitSelectionToggle");
    const horizontal = settingsDialog.querySelector('input[value="horizontal"]');
    const vertical = settingsDialog.querySelector('input[value="vertical"]');
    check(settingsDialog.open && toggle.checked && panel.style.display === "block", "gear opens configuration without toggling the floating panel");
    const switchAnchor = getHandSortSwitchAnchor(toggle).getBoundingClientRect();
    const dialogRect = settingsDialog.getBoundingClientRect();
    check(Math.abs(dialogRect.left - switchAnchor.left) < 1 && Math.abs(dialogRect.top - switchAnchor.bottom - 8) < 1, "settings dialog opens beside its switch under the native dialog CSS");
    const settingsRoot = document.getElementById("createIframe");
    settingsRoot.style.transform = "scale(0.75)";
    handCards.requestMainPanel();
    checkNativeCaption("settings caption keeps native alignment when the main panel is scaled");
    let anchored = getHandSortSwitchAnchor(toggle).getBoundingClientRect(), positioned = settingsDialog.getBoundingClientRect();
    check(Math.abs(positioned.left - anchored.left) < 1 && Math.abs(positioned.top - anchored.bottom - 8) < 1, "scaled main-panel coordinates anchor the unscaled dialog correctly");
    settingsRoot.style.transform = "";
    settingsRoot.style.left = innerWidth - 260 + "px";
    settingsRoot.style.top = innerHeight - 70 + "px";
    handCards.requestMainPanel();
    positioned = settingsDialog.getBoundingClientRect(); anchored = getHandSortSwitchAnchor(toggle).getBoundingClientRect();
    check(positioned.left >= 8 && positioned.right <= innerWidth - 7 && positioned.top >= 8 && positioned.bottom <= anchored.top - 7, "dialog flips above the switch and stays inside the viewport near the bottom-right edge");
    settingsRoot.style.left = "55px"; settingsRoot.style.top = "70px";
    window.dispatchEvent(new Event("scroll"));
    positioned = settingsDialog.getBoundingClientRect(); anchored = getHandSortSwitchAnchor(toggle).getBoundingClientRect();
    check(Math.abs(positioned.left - anchored.left) < 1 && Math.abs(positioned.top - anchored.bottom - 8) < 1, "open settings follow their anchor on scroll");
    settingsRoot.style.left = "25px"; settingsRoot.style.top = "30px";
    window.dispatchEvent(new Event("resize"));
    handCards.requestMainPanel();
    check(settingsDialog.textContent.includes("·打开花色选中·") && settingsDialog.textContent.includes("切换面板UI样式") && suitToggle.checked && horizontal.checked && !vertical.checked, "settings show the requested switch and default horizontal radio group");
    gear.click();
    check(document.querySelectorAll("#xcHandSortSettingsDialog").length === 1, "reopening settings does not duplicate the dialog");
    suitToggle.click();
    check([...panel.querySelectorAll("button")].filter(button => button.getBoundingClientRect().width > 0).map(button => button.textContent).join(",") === "按花色,按点数" && panelView.suitInputs.every(input => input.getBoundingClientRect().width === 0), "disabling suit selection restores the two-button basic panel");
    vertical.parentElement.click();
    check(vertical.checked && !horizontal.checked && panelView.orientation === "vertical" && byMode("CardFlower").getBoundingClientRect().top === byMode("CardNumber").getBoundingClientRect().top, "vertical preference is exclusive and basic mode retains one sorting row");
    const optionsSaved = JSON.parse(localStorage.getItem("xcHandSortFloatingPanel"));
    check(optionsSaved.suitSelection === false && optionsSaved.orientation === "vertical", "switch and orientation changes persist immediately");
    suitToggle.click();
    const verticalSuits = panelView.suitInputs.map(input => input.parentElement.getBoundingClientRect());
    const verticalButtons = allButtons.map(button => button.getBoundingClientRect());
    check(verticalSuits.every((rect,index) => rect.left === verticalSuits[0].left && (index === 0 || rect.top > verticalSuits[index - 1].bottom)) && verticalButtons.every((rect,index) => rect.left > verticalSuits[index].right && Math.abs(rect.top - verticalSuits[index].top) < 0.1), "vertical layout uses four suit rows with the matching action to the right");
    check(verticalButtons.every((rect,index) => Math.abs(rect.width - verticalSuits[index].width) < 0.1 && Math.abs(rect.height - verticalSuits[index].height) < 0.1), "vertical rows retain equal suit and button sizes");
    horizontal.parentElement.click();
    horizontal.parentElement.click();
    check(horizontal.checked && !vertical.checked && settingsDialog.querySelectorAll('input[type="radio"]:checked').length === 1, "layout radio group always has exactly one selected option");
    check(panelView.suitInputs.every(input => input.parentElement.getBoundingClientRect().top === suitRects[0].top) && hand.layouts === 0, "horizontal layout restores without sorting or selecting cards");
    settingsDialog.querySelector(".dialog-close-btn").click();
    check(!settingsDialog.open && gear.getAttribute("aria-expanded") === "false", "settings close button closes the dialog and updates the entry state");
    gear.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    check(settingsDialog.open && gear.getAttribute("aria-expanded") === "true", "native-style settings caption supports keyboard activation");
    handCards.closeSettings();
    document.getElementById("handSortPanelLabel").click();
    check(settingsDialog.open && toggle.checked, "clicking the main caption opens settings like the native settings captions");
    handCards.closeSettings();
    check(!byMode("CardFlower").disabled, "own hand enables controls");
    byMode("CardFlower").click();
    check(order() === "bcda", "suit sorting is ascending and stable for ties");
    byMode("CardNumber").click();
    check(order() === "bdca", "number sorting supports numeric strings and keeps ties stable");
    check(hand.layouts === 2 && hand.cardUis.every((card) => !card.selected && card.draws === 2), "both actions clear selection, redraw and relayout once");
    check(sortLogs.filter((line) => line.includes("sort:done")).length === 2, "one operation and one debug-window log per click");
    check(!panel.querySelector('[role="status"]'), "count display and count output are removed");
    check(!handCards.sort("unsupported") && hand.layouts === 2, "invalid mode does not mutate the hand");
    const originalDraw = hand.cardUis[0].Draw;
    hand.cardUis[0].Draw = null;
    check(!handCards.sort("CardFlower") && order() === "bdca", "invalid UI data is rejected before sorting");
    hand.cardUis[0].Draw = originalDraw;

    let leakedKeys = 0;
    const onKey = () => leakedKeys++;
    document.addEventListener("keydown", onKey);
    byMode("CardNumber").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    document.removeEventListener("keydown", onKey);
    check(leakedKeys === 0, "panel keyboard events do not bubble to game handlers");
    const state = panelView;
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

    testFeatureEnabled.value = false;
    handCards.mount();
    byMode("CardNumber").dispatchEvent(new Event("click"));
    check(byMode("CardNumber").disabled && hand.layouts === 2, "availability is rechecked even for synthetic clicks");
    testFeatureEnabled.value = true;
    laya.gamescene = null;
    handCards.mount();
    check(byMode("CardFlower").disabled && !handCards.sort(), "lobby never sorts a stale hand");
    const nextHand = makeHand();
    laya.gamescene = { fallbackHand: nextHand };
    handCards.mount();
    byMode("CardNumber").click();
    check(order(nextHand) === "bdca" && hand.layouts === 2, "scene change resolves the new self hand via the scoped fallback");
    nextHand.cardUis.reverse();
    const beforePolling = order(nextHand);
    await new Promise((resolve) => setTimeout(resolve, 900));
    check(order(nextHand) === beforePolling && nextHand.layouts === 1, "status polling never automatically sorts");

    // Synthetic pointer events do not create a native active pointer. Stub only
    // capture; exercise dragging only on the empty panel padding.
    panel.setPointerCapture = () => {};
    const initialLeft = state.left;
    const initialTop = state.top;
    state.body.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: initialLeft + 8, clientY: initialTop + 8, bubbles: true }));
    panel.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 78, clientY: 98, bubbles: true }));
    panel.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true }));
    check(state.left === 70 && state.top === 90, "empty-padding dragging moves the compact panel");
    state.suitInputs[0].parentElement.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 2, button: 0, clientX: 75, clientY: 95, bubbles: true }));
    panel.dispatchEvent(new PointerEvent("pointermove", { pointerId: 2, clientX: 200, clientY: 200, bubbles: true }));
    panel.dispatchEvent(new PointerEvent("pointerup", { pointerId: 2, bubbles: true }));
    check(state.left === 70 && state.top === 90, "checkbox label gestures do not start dragging");
    const noSelectionBefore = state.suitInputs[0].checked;
    const beforeIdleLogs = sortLogs.length;
    state.suitInputs[0].parentElement.click();
    check(state.suitInputs[0].checked !== noSelectionBefore && !handCardsClient.getSelectionContext(), "whole checkbox label remains clickable without a selection context");
    check(sortLogs.length === beforeIdleLogs, "idle filter changes trigger no selection attempt or selection log");
    handCards.mount();
    check(state.suitInputs[0].checked !== noSelectionBefore, "unavailable selection does not revert the user checkbox");
    const saved = JSON.parse(localStorage.getItem("xcHandSortFloatingPanel"));
    check(saved.left === 70 && saved.top === 90, "drag position is persisted");
    state.body.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 3, button: 0, clientX: state.left + 8, clientY: state.top + 8, bubbles: true }));
    panel.dispatchEvent(new PointerEvent("pointermove", { pointerId: 3, clientX: 99999, clientY: 99999, bubbles: true }));
    panel.dispatchEvent(new PointerEvent("pointerup", { pointerId: 3, bubbles: true }));
    window.dispatchEvent(new Event("resize"));
    const rect = panel.getBoundingClientRect();
    check(rect.right <= innerWidth && rect.bottom <= innerHeight, "resize keeps panel within viewport");
    check(document.getElementById("exchangeRow").outerHTML + document.getElementById("debugRow").outerHTML === oldControls, "original exchange and debug controls are unchanged");

    const suitInput = suit => state.suitInputs.find(input => Number(input.value) === suit);
    const chosen = h => h.cardUis.filter(ui => ui.Card.Selected).map(ui => ui.id).join("");
    const configureSuits = suits => {
      state.suitInputs.forEach(input => { input.checked = suits.includes(Number(input.value)); });
      state.suitInputs[0].dispatchEvent(new Event("change", { bubbles: true }));
    };
    const setSuits = (suits, inverse = false) => {
      configureSuits(suits);
      state.selectionButtons[inverse ? 1 : 0].click();
    };
    const h = makeSelectableHand();
    laya.gamescene = { SelfSeatUi: { cardContainer: h } };
    handCards.mount();
    check(suitInput(3).checked && state.suitInputs.every(input => !input.disabled) && chosen(h) === "", "new hand retains configured filters without selecting cards");
    configureSuits([1]);
    check(chosen(h) === "" && h.operations.length === 0, "changing suits during selection does not select cards");
    state.selectionButtons[0].click();
    check(chosen(h) === "14", "all button selects configured active hearts");
    state.selectionButtons[1].click();
    check(chosen(h) === "023", "hearts plus inverse selects only non-hearts");
    const beforeOptions = h.operations.length;
    handCards.setOptions({ suitSelection: false, orientation: "vertical" });
    state.selectionButtons[0].dispatchEvent(new Event("click"));
    check(h.operations.length === beforeOptions && chosen(h) === "023", "basic mode blocks hidden selection actions without clearing existing cards");
    handCards.setOptions({ suitSelection: true, orientation: "horizontal" });
    check(h.operations.length === beforeOptions && suitInput(1).checked, "restoring enhanced mode retains filters without replaying selection");
    setSuits([1, 2]);
    check(chosen(h) === "134", "multiple suits select their union");
    setSuits([1, 2], true);
    check(chosen(h) === "02", "multiple suits plus inverse select their complement");
    setSuits([]);
    check(chosen(h) === "", "no suits in normal mode clears hand selection");
    setSuits([], true);
    check(chosen(h) === "01234", "no suits plus inverse selects all eligible hand cards");
    setSuits([1, 2, 3, 4], true);
    check(chosen(h) === "", "all four suits plus inverse selects none");
    h.cardUis[4].Activated = false;
    setSuits([1]);
    check(chosen(h) === "1", "disabled matching cards are skipped");
    h.cardUis[4].Activated = true;
    setSuits([]);
    h.cardUis[0].Card.FlowerOnSeat = 1;
    setSuits([1]);
    check(chosen(h) === "014", "effective suit includes transformed spades as hearts");
    setSuits([]);
    h.cardUis[0].Card.FlowerOnSeat = 3;
    h.externalSelected = 1;
    h.selectCardContext.CardSelector.SelectCountMax = 2;
    setSuits([1]);
    check(chosen(h) === "1" && h.externalSelected === 1, "total selector count reserves external selection and never overflows");
    h.externalSelected = 0;
    h.selectCardContext.CardSelector.SelectCountMax = 20;
    setSuits([]);
    h.cardUis[2].Card.IsInHand = false;
    h.cardUis[3].Card.IsVirtualCard = true;
    setSuits([], true);
    check(chosen(h) === "014", "equipment-area and virtual cards are excluded");
    setSuits([]);
    h.cardUis[2].Card.IsInHand = true;
    h.cardUis[3].Card.IsVirtualCard = false;
    h.afterClick = ui => { if (ui.id === "1") h.cardUis[4].Activated = false; };
    setSuits([1]);
    check(chosen(h) === "1", "activation changes are rechecked after each native click");
    h.afterClick = null;
    h.cardUis[4].Activated = true;
    setSuits([]);
    h.afterClick = () => { h.selectCardContext = { CardSelector: { SelectCountMax: 20, SelectedCount: 0 } }; };
    setSuits([1]);
    check(chosen(h) === "1", "selector replacement stops the remaining batch");
    h.afterClick = null;
    const beforeBlocked = h.operations.length;
    gameContext.CanOperationInGame = () => false;
    setSuits([3]);
    check(h.operations.length === beforeBlocked && !suitInput(3).disabled && suitInput(3).checked, "native operation gate blocks selection while checkbox input remains usable");
    gameContext.CanOperationInGame = () => true;
    gameContext.IsPokerDDZ = true;
    handCards.mount();
    const beforePoker = h.operations.length;
    state.selectionButtons[1].click();
    check(!suitInput(3).disabled && h.operations.length === beforePoker, "poker mode skips selection without disabling filters");
    gameContext.IsPokerDDZ = false;
    handCards.mount();
    const beforeRefresh = h.operations.length;
    handCards.mount();
    await new Promise(resolve => setTimeout(resolve, 900));
    check(h.operations.length === beforeRefresh, "refresh polling never automatically selects cards");
    const newHand = makeSelectableHand();
    laya.gamescene = { SelfSeatUi: { cardContainer: newHand } };
    handCards.mount();
    check(suitInput(3).checked && chosen(newHand) === "", "scene change retains filters without operating the new hand");
    configureSuits([4]);
    check(chosen(newHand) === "", "new scene filter waits for the selection button");
    state.selectionButtons[0].click();
    check(chosen(newHand) === "2" && h.operations.length === beforeRefresh, "new scene selection button uses only the new hand");
    const originalClass = laya.class;
    laya.class = () => undefined;
    setSuits([1]);
    check(chosen(newHand) === "14" && suitInput(1).checked, "missing public GameContext does not block native suit selection");
    laya.class = () => { throw Error("class not registered"); };
    setSuits([1], true);
    check(chosen(newHand) === "023", "class lookup failure still uses native card click");
    gameContext.CanOperationInGame = () => false;
    const hiddenGateBefore = newHand.operations.length;
    setSuits([1]);
    check(newHand.operations.length === hiddenGateBefore && chosen(newHand) === "023", "native click still blocks selection when public GameContext is absent");
    gameContext.CanOperationInGame = () => true;
    laya.class = originalClass;
    check(sortLogs.some(line => line.includes("suit:select")) && !sortLogs.some(line => line.includes("suit:error")), "selection diagnostics use the existing debug window bridge");

    const latestPanelPreferences = JSON.parse(localStorage.getItem("xcHandSortFloatingPanel"));
    state.panel.remove();
    handCards.mount();
    check(document.querySelectorAll("#xcHandSortPanel").length === 1 && !document.getElementById("xcHandSortLauncher"), "detached panel is rebuilt without a launcher");
    recreateHandCards();
    handCards.mount();
    check(panelView.left === latestPanelPreferences.left && panelView.top === latestPanelPreferences.top && !panelView.hidden, "fresh panel restores the latest saved position and switch state");
    handCards.setOptions({ suitSelection: false, orientation: "vertical" });
    recreateHandCards();
    handCards.mount();
    check(!panelView.suitSelection && panelView.orientation === "vertical", "rebuilt panel restores both feature and orientation preferences");
    handCards.setOptions({ suitSelection: true });
    check(panelView.orientation === "vertical", "enabling the feature preserves the chosen orientation");
    recreateHandCards();
    localStorage.setItem("xcHandSortFloatingPanel", "malformed-json");
    handCards.mount();
    check(!!panelView.panel.isConnected && panelView.hidden, "invalid preferences default to a hidden panel");
    check(panelView.suitSelection && panelView.orientation === "horizontal", "missing or invalid options retain enhanced horizontal defaults");
    handCards.setVisible(true);
    check(toggle.checked, "core visibility bridge synchronizes the settings switch");
    document.getElementById("xcHandSortSwitchRow").remove();
    handCards.requestMainPanel();
    check(document.querySelectorAll("#handSortPanelSwitch").length === 1 && document.querySelectorAll("#handSortPanelLabel").length === 1, "detached settings switch is rebuilt without duplicates");
    check(document.querySelectorAll("#xcHandSortSettingsButton").length === 1, "settings gear is rebuilt without duplicates");
    // Exercise complete ownership, including canceled callbacks retained by the browser/test.
    handCards.openSettings();
    const staleSettingsToggle = document.getElementById("xcHandSuitSelectionToggle");
    const staleCaption = document.getElementById("handSortPanelLabel");
    const storedBeforeDispose = localStorage.getItem("xcHandSortFloatingPanel");
    window.dispatchEvent(new Event("resize"));
    const staleFrame = frameHistory.at(-1);
    const controls = document.getElementById("nativeControls"), controlsParent = controls.parentElement;
    controls.remove();
    handCards.requestMainPanel();
    const staleRetry = timeoutHistory.at(-1);
    const pendingCount = activeTimeouts.size;
    handCards.requestMainPanel();
    handCards.requestMainPanel();
    check(staleRetry.delay === 250 && activeTimeouts.size === pendingCount, "missing main controls use one owned installation retry");
    handCards.dispose();
    check(!document.getElementById("xcHandSortPanel") && !document.getElementById("xcHandSortSettingsDialog") && !document.getElementById("xcHandSortSwitchRow") && !document.getElementById("xcHandSortSettingsButton"), "dispose removes floating panel, dialog and main controls together");
    check(activeIntervals.size === 0 && activeTimeouts.size === 0 && activeObservers.size === 0, "dispose releases polling, bootstrap/retry timers and all observers");
    check(localStorage.getItem("xcHandSortFloatingPanel") === storedBeforeDispose, "dispose preserves persisted preferences");
    const queriedOptions = handCards.getOptions();
    queriedOptions.orientation = "modified outside";
    check(!handCards.isVisible() && handCards.getOptions().orientation !== "modified outside" && !document.getElementById("xcHandSortPanel"), "read-only queries neither recreate UI nor expose mutable state");
    check(!handCards.setVisible(true) && !handCards.setOptions({ orientation: "vertical" }) && !handCards.mount() && !handCards.openSettings() && !handCards.requestMainPanel(), "disposed entry points do not silently restart the module");
    staleRetry.callback(); staleFrame(); staleSettingsToggle.click(); staleCaption.click();
    check(!document.getElementById("xcHandSortPanel") && activeTimeouts.size === 0 && localStorage.getItem("xcHandSortFloatingPanel") === storedBeforeDispose, "old retry, animation and detached DOM callbacks stay inert after disposal");
    controlsParent.appendChild(controls);
    handCards.start(); handCards.start(); handCards.mount();
    const restarted = document.getElementById("xcHandSortPanel");
    staleRetry.callback(); staleFrame(); staleSettingsToggle.click(); staleCaption.click();
    check(restarted && document.getElementById("xcHandSortPanel") === restarted && document.querySelectorAll("#xcHandSortSwitchRow").length === 1 && activeIntervals.size === 1 && activeObservers.size === 2, "explicit restart is idempotent and old callbacks cannot mutate the new mount");
    check(!document.getElementById("xcHandSortSettingsDialog") && localStorage.getItem("xcHandSortFloatingPanel") === storedBeforeDispose, "detached settings and caption listeners cannot reopen or change a restarted module");
    handCards.dispose();
    Object.defineProperty(document, "readyState", { configurable: true, value: "loading" });
    handCards.start(); handCards.dispose();
    document.dispatchEvent(new Event("DOMContentLoaded"));
    delete document.readyState;
    check(!document.getElementById("xcHandSortPanel") && activeTimeouts.size === 0, "dispose also cancels a pending DOM-ready bootstrap");
    handCards.start(); handCards.mount();
    const disposedMidSelection = makeSelectableHand();
    laya.gamescene = { SelfSeatUi: { cardContainer: disposedMidSelection } };
    handCards.mount();
    configureSuits([1]);
    disposedMidSelection.afterClick = () => handCards.dispose();
    handCards.selectBySuit(false);
    check(chosen(disposedMidSelection) === "1" && !document.getElementById("xcHandSortPanel"), "disposal during a native selection stops the rest of the batch");
    document.getElementById("result").textContent = "PASS " + checks.length + " checks: " + checks.join("; ");
  } catch (error) {
    document.getElementById("result").textContent = "FAIL " + error.stack;
  } finally {
    handCards.dispose();
  }
}

const settingsFixture = '<style>' + nativeSettingsCss + '.switch{position:relative;display:block;width:56px;height:26px}.switch input{opacity:0;width:0;height:0}.slider{position:absolute;top:0;left:0;right:0;bottom:0;border:1px solid #f2de9c;border-radius:34px;background:#23201d}.slider:before{position:absolute;content:"";height:20px;width:20px;left:2px;bottom:2px;background:#f2de9c;border-radius:50%}.status{position:absolute;top:50%;left:5px;transform:translateY(-50%)}input:checked+.slider{background:#ff7b54}input:checked+.slider:before{transform:translateX(30px)}input+.slider+.status:before{content:"关"}input:checked+.slider+.status:before{content:"开"}</style>' +
  '<div id="createIframe" style="position:fixed;left:25px;top:30px;width:230px;height:200px;transform-origin:top left"><div id="nativeControls">' +
  '<label id="exchangeRow" class="switch" style="position:absolute;left:78px;top:25px"><input id="CDKNotificationSwitch" type="checkbox"><span class="slider"></span><span class="status"></span></label>' +
  '<label id="debugRow" class="switch" style="position:absolute;left:150px;top:90px"><input id="localSkinDebugSwitch" type="checkbox"><span class="slider"></span><span class="status"></span></label>' +
  '<div id="wallpaperContainer" class="switch-container expandable-switch" style="position:absolute;left:0;top:145px;width:72px;font:14px/16px Arial;color:#f2de9c"><span class="explanation">壁纸设置</span><label class="switch"><input id="skinPaperSwitch" type="checkbox"><span class="slider"></span></label></div>' +
  '<div id="blockEffectContainer" class="switch-container expandable-switch" style="position:absolute;left:90px;top:145px;width:72px;font:14px/16px Arial;color:#f2de9c"><span class="explanation">屏蔽设置</span><label class="switch"><input id="effectBlockSwitch" type="checkbox"><span class="slider"></span></label></div></div></div>';
const html = '<!doctype html><meta charset="utf-8">' + settingsFixture + '<pre id="result">PENDING</pre><script>(' + browserFixture + ')();</script><script>' + panelSource + '</script><script>' + helpersSource + '(' + moduleHarness + ')();</script><script>window.addEventListener("load", ' + browserChecks + ');</script>';
const previewArgument = process.argv.find(arg => arg.startsWith("--preview="));
const preview = process.argv.includes("--preview") || !!previewArgument;
const previewMode = previewArgument?.split("=")[1] || "horizontal";
const previewOptions = { suitSelection: previewMode !== "basic", orientation: previewMode === "vertical" ? "vertical" : "horizontal" };
const previewHtml = '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#171922}</style>' + (previewMode === "settings" ? settingsFixture : '') + '<script>(' + browserFixture + ')();laya.gamescene={SelfSeatUi:{cardContainer:makeSelectableHand()}};localStorage.setItem("xcHandSortFloatingPanel",JSON.stringify({left:24,top:24,visible:true}));</script><script>' + panelSource + '</script><script>' + helpersSource + '(' + moduleHarness + ')();</script><script>window.addEventListener("load",()=>{handCards.mount();handCards.setVisible(true);handCards.setOptions(' + JSON.stringify(previewOptions) + ');' + (previewMode === "settings" ? 'handCards.openSettings();' : previewMode === "basic" ? '' : 'panelView.suitInputs.find(x=>x.value==="1").click();panelView.selectionButtons[1].click();') + '});</script>';

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "xc-hand-sort-test-"));
const screenshotPath = path.join(profile, "hand-sort-panel-" + previewMode + ".png");
if (preview) fs.writeFileSync(path.join(profile, "preview.html"), previewHtml);
const server = http.createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(preview ? previewHtml : html);
});
server.listen(0, "127.0.0.1", () => {
  const browser = spawn(browserPath, [
    "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", preview ? "--window-size=500,400" : "--window-size=1000,700", "--dump-dom",
    ...(preview ? ["--force-device-scale-factor=2", "--screenshot=" + screenshotPath] : []),
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
    process.stdout.write((preview ? "Preview: " + screenshotPath : result || diagnostics || "No browser result") + "\n");
    process.stdout.write("Temporary browser profile: " + profile + "\n");
    process.exitCode = (preview ? fs.existsSync(screenshotPath) : result?.startsWith("PASS ")) ? 0 : 1;
  });
});
