// Hand-card feature: UI, preferences and owned lifecycle. No userscript globals.
module.exports = function createHandCardsModule({ window, document, storage, client, log = () => {} }) {
  const setTimeout = window.setTimeout.bind(window), clearTimeout = window.clearTimeout.bind(window);
  const setInterval = window.setInterval.bind(window), clearInterval = window.clearInterval.bind(window);
  const requestAnimationFrame = window.requestAnimationFrame.bind(window), cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const getComputedStyle = window.getComputedStyle.bind(window);
  const { ResizeObserver, MutationObserver, CustomEvent } = window;
  const HAND_SORT_SWITCH_ID = "handSortPanelSwitch", HAND_SORT_LABEL_ID = "handSortPanelLabel";
  let active = false, generation = 0, mainHost = null, handSortSwitchLayout = null;
  let bootTimer = null, retryTimer = null, retryAttempts = 0, readyListener = null;
  function scope() {
    let closed = false;
    const listeners = [];
    return {
      listen(target, type, handler, options) {
        function wrapped(...args) { if (!closed && active) return handler.apply(this, args); }
        target.addEventListener(type, wrapped, options);
        listeners.push(() => target.removeEventListener(type, wrapped, options));
      },
      dispose() { if (closed) return; closed = true; listeners.splice(0).forEach(remove => remove()); },
    };
  }
  function getHandSortContainer() { return client.getContainer(); }
  function getHandSuitSelectionContext() { return client.getSelectionContext(); }
  function reorderCard(mode) { return active && client.sort(mode); }
  function ensureState() {
    if (!handSortPanelState) {
      let saved = {};
      try { saved = JSON.parse(storage.getItem("xcHandSortFloatingPanel")) || {}; } catch {}
      handSortPanelState = {
        left: Number.isFinite(saved.left) ? saved.left : window.innerWidth - 350,
        top: Number.isFinite(saved.top) ? saved.top : 80,
        hidden: saved.visible !== true,
        suitSelection: saved.suitSelection !== false,
        orientation: saved.orientation === "vertical" ? "vertical" : "horizontal",
        timer: null, cleanup: null, suits: [], selecting: false,
      };
    }
    return handSortPanelState;
  }
  var handSortPanelState = null;
  var handSortSettingsState = null;
  // OL 普通牌花色：红桃1、方块2、黑桃3、梅花4；不套用扑克牌模式的编码。
  const HAND_SELECT_SUITS = [[3, "黑桃"], [1, "红桃"], [4, "梅花"], [2, "方块"]];
  function isHandSuitCard(ui) {
    return client.isHandCard(ui) && HAND_SELECT_SUITS.some(([suit]) => suit === ui.Card.FlowerOnSeat);
  }
  function selectHandCardsBySuit(inverse = false) {
    if (!active) return false;
    const state = handSortPanelState, entry = getHandSuitSelectionContext();
    if (!state || !state.suitSelection || state.selecting) return false;
    if (!entry) {
      const container = getHandSortContainer();
      logHandSortPanel("suit:skip", {
        reason: "selection-unavailable", scene: !!client.getScene(), container: !!container,
        context: !!(container?.SelectContext || container?.selectCardContext),
        choosing: container?.AreChoosingCard ?? container?.areChoosingCard ?? null,
      });
      return false;
    }
    const suits = new Set(state.suits), token = generation;
    const cards = entry.container.cardUis.filter(isHandSuitCard).map(ui => ({ ui, card: ui.Card }));
    const matches = card => inverse !== suits.has(card.FlowerOnSeat);
    const stillCurrent = () => {
      if (!active || token !== generation) return false;
      const current = getHandSuitSelectionContext();
      return current && current.scene === entry.scene && current.container === entry.container &&
        current.context === entry.context && current.selector === entry.selector;
    };
    let changed = 0, stopped = false;
    state.selecting = true;
    try {
      // 先移除不属于目标花色集合的已选手牌，再补选目标；装备等其他区域不参与。
      for (const selecting of [false, true]) {
        for (const { ui, card } of cards) {
          if (!stillCurrent()) { stopped = true; break; }
          if (ui.Card !== card || !entry.container.cardUis.includes(ui) || !isHandSuitCard(ui) ||
              !ui.Activated || matches(card) !== selecting || !!card.Selected === selecting) continue;
          if (selecting && entry.selector.SelectedCount >= entry.selector.SelectCountMax) break;
          client.click(ui);
          if (!!card.Selected === selecting) changed++;
        }
        if (stopped) break;
      }
      logHandSortPanel("suit:select", { suits: [...suits], inverse, changed, stopped });
      return !stopped;
    } catch (error) {
      logHandSortPanel("suit:error", { message: String(error.message || error) });
      return false;
    } finally {
      state.selecting = false;
    }
  }
  function logHandSortPanel(event, data) {
    try { log(event, data || {}); } catch {}
  }
  function getHandSortAvailability() {
    try {
      const container = getHandSortContainer();
      const hasCards = Array.isArray(container?.cardUis) && container.cardUis.length > 0;
      // 与 initAllButtons 的 vip 分组使用同一可用条件。
      if (!client.isEnabled())
        return { ready: false, message: "整理手牌功能尚未启用" };
      return { ready: hasCards, message: hasCards ? "" : "等待自己的手牌" };
    } catch (error) {
      return { ready: false, message: "等待游戏初始化" };
    }
  }
  function saveHandSortPanelPosition() {
    const state = handSortPanelState;
    try {
      storage.setItem("xcHandSortFloatingPanel", JSON.stringify({
        left: state.left, top: state.top, visible: !state.hidden,
        suitSelection: state.suitSelection, orientation: state.orientation,
      }));
    } catch (error) {
      logHandSortPanel("position:save-error", { message: String(error.message || error) });
    }
  }
  function positionHandSortPanel() {
    const state = handSortPanelState;
    if (!state?.panel?.isConnected) return;
    if (state.hidden) return;
    state.left = Math.max(0, Math.min(state.left, window.innerWidth - state.panel.offsetWidth - 8));
    state.top = Math.max(0, Math.min(state.top, window.innerHeight - state.panel.offsetHeight - 8));
    state.panel.style.left = state.left + "px";
    state.panel.style.top = state.top + "px";
  }
  function applyHandSortPanelLayout() {
    const state = handSortPanelState;
    if (!state?.body) return;
    const extended = state.suitSelection, vertical = extended && state.orientation === "vertical";
    state.body.style.gridTemplateColumns = extended
      ? (vertical ? "repeat(2,1fr)" : "repeat(4,max-content)")
      : "repeat(2,max-content)";
    state.suitInputs.forEach((input, index) => {
      const label = input.parentElement;
      label.style.display = extended ? "inline-flex" : "none";
      label.style.gridColumn = String(vertical ? 1 : index + 1);
      label.style.gridRow = String(vertical ? index + 1 : 1);
    });
    [...state.buttons, ...state.selectionButtons].forEach((button, index) => {
      button.style.display = extended || index < 2 ? "" : "none";
      button.style.gridColumn = String(vertical ? 2 : index + 1);
      button.style.gridRow = String(vertical ? index + 1 : extended ? 2 : 1);
      // 基础模式恢复两枚独立排序按钮，增强模式沿用花色列的尺寸。
      button.style.minWidth = extended ? "0" : "54px";
    });
    positionHandSortPanel();
  }
  function cleanupSettings() {
    const settings = handSortSettingsState;
    if (!settings) return;
    settings.scope.dispose();
    closeSettings();
    settings.dialog.remove();
    handSortSettingsState = null;
  }
  function syncHandSortSettings() {
    const settings = handSortSettingsState, state = handSortPanelState;
    if (!settings?.dialog.isConnected || !state) return;
    settings.toggle.checked = state.suitSelection;
    settings.radios.forEach(input => { input.checked = input.value === state.orientation; });
  }
  function getOptions() {
    ensureState();
    return { suitSelection: handSortPanelState?.suitSelection !== false,
      orientation: handSortPanelState?.orientation || "horizontal" };
  };
  function setOptions(options) {
    if (!ensureHandSortFloatingPanel()) return false;
    const state = handSortPanelState;
    if (typeof options?.suitSelection === "boolean") state.suitSelection = options.suitSelection;
    if (options?.orientation === "horizontal" || options?.orientation === "vertical")
      state.orientation = options.orientation;
    applyHandSortPanelLayout();
    syncHandSortSettings();
    saveHandSortPanelPosition();
    logHandSortPanel("panel:options", { suitSelection: state.suitSelection, orientation: state.orientation });
    return true;
  };
  function closeSettings() {
    const dialog = handSortSettingsState?.dialog;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else { dialog.removeAttribute("open"); dialog.style.display = "none"; }
    handSortSwitchLayout?.gear.setAttribute("aria-expanded", "false");
  };
  function positionHandSortSettings() {
    const dialog = handSortSettingsState?.dialog;
    if (!active || !dialog?.open) return;
    let anchor = handSortSwitchLayout?.input.isConnected
      ? mainHost.getAnchor(handSortSwitchLayout.input) : null;
    let rect = anchor?.getBoundingClientRect();
    if (!rect?.width || !rect.height) rect = handSortPanelState?.panel?.getBoundingClientRect();
    const width = dialog.offsetWidth, height = dialog.offsetHeight, gap = 8;
    const maxLeft = Math.max(gap, window.innerWidth - width - gap);
    const maxTop = Math.max(gap, window.innerHeight - height - gap);
    let left = (window.innerWidth - width) / 2, top = (window.innerHeight - height) / 2;
    if (rect?.width && rect.height) {
      left = rect.left;
      top = rect.bottom + gap;
      if (top > maxTop) top = rect.top - height - gap;
    }
    dialog.style.left = Math.max(gap, Math.min(left, maxLeft)) + "px";
    dialog.style.top = Math.max(gap, Math.min(top, maxTop)) + "px";
  }
  function openSettings() {
    if (!ensureHandSortFloatingPanel()) return null;
    if (!handSortSettingsState?.dialog.isConnected) {
      cleanupSettings();
      const settingsScope = scope();
      const dialog = document.createElement("dialog");
      dialog.id = "xcHandSortSettingsDialog";
      dialog.setAttribute("aria-labelledby", "xcHandSortSettingsTitle");
      dialog.style.cssText = "position:fixed;inset:auto;margin:0;transform:none;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 16px);overflow-y:auto;padding:0;box-sizing:border-box;background:#28241f;color:#f2de9c;border:1px solid #8c7954;border-radius:10px;font:13px/1.5 Arial,sans-serif;box-shadow:0 10px 32px #0008";
      const style = document.createElement("style");
      style.textContent = "#xcHandSortSettingsDialog::backdrop{background:#0007}#xcHandSortSettingsDialog .switch{position:relative;display:inline-block;width:56px;height:26px;flex:0 0 56px}#xcHandSortSettingsDialog .switch input{opacity:0;width:0;height:0}#xcHandSortSettingsDialog .slider{position:absolute;inset:0;border:1px solid #f2de9c;border-radius:34px;background:#23201d;cursor:pointer}#xcHandSortSettingsDialog .slider:before{position:absolute;content:'';height:20px;width:20px;left:2px;bottom:2px;background:#f2de9c;border-radius:50%}#xcHandSortSettingsDialog input:checked+.slider{background:#ff7b54}#xcHandSortSettingsDialog input:checked+.slider:before{transform:translateX(30px)}#xcHandSortSettingsDialog .status{position:absolute;top:50%;left:5px;transform:translateY(-50%);color:#555;pointer-events:none}#xcHandSortSettingsDialog input+.slider+.status:before{content:'关'}#xcHandSortSettingsDialog input:checked+.slider+.status:before{content:'开'}#xcHandSortSettingsDialog input:focus-visible+.slider{outline:2px solid #fff;outline-offset:2px}";
      dialog.appendChild(style);
      const header = document.createElement("div");
      header.className = "dialog-header";
      header.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #f2de9c4d";
      const title = document.createElement("h3");
      title.id = "xcHandSortSettingsTitle";
      title.textContent = "整理手牌设置";
      title.style.cssText = "font-size:14px;margin:0";
      const close = document.createElement("button");
      close.type = "button";
      close.className = "dialog-close-btn";
      close.setAttribute("aria-label", "关闭整理手牌设置");
      close.textContent = "×";
      close.style.cssText = "width:24px;height:24px;padding:0;background:none;border:0;color:inherit;font-size:20px;cursor:pointer";
      settingsScope.listen(close, "click", closeSettings);
      header.append(title, close);
      dialog.appendChild(header);
      const content = document.createElement("div");
      content.className = "dialog-content";
      content.style.cssText = "display:grid;gap:18px;padding:18px 16px";
      const first = document.createElement("div");
      first.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px";
      const caption = document.createElement("label");
      caption.htmlFor = "xcHandSuitSelectionToggle";
      caption.textContent = "·打开花色选中·";
      caption.style.cursor = "pointer";
      const toggleLabel = document.createElement("label");
      toggleLabel.className = "switch";
      const toggle = document.createElement("input");
      toggle.id = "xcHandSuitSelectionToggle";
      toggle.type = "checkbox";
      const slider = document.createElement("span"), status = document.createElement("span");
      slider.className = "slider"; status.className = "status";
      toggleLabel.append(toggle, slider, status);
      first.append(caption, toggleLabel);
      content.appendChild(first);
      settingsScope.listen(toggle, "change", () => setOptions({ suitSelection: toggle.checked }));
      const second = document.createElement("fieldset");
      second.style.cssText = "display:flex;align-items:center;gap:14px;border:0;padding:0;margin:0;min-width:0";
      const heading = document.createElement("span");
      heading.id = "xcHandSortOrientationTitle";
      heading.textContent = "切换面板UI样式";
      second.setAttribute("aria-labelledby", heading.id);
      second.appendChild(heading);
      const radios = [["水平", "horizontal"], ["垂直", "vertical"]].map(([text, value]) => {
        const label = document.createElement("label");
        label.style.cssText = "display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap";
        const input = document.createElement("input");
        input.type = "radio"; input.name = "xcHandSortOrientation"; input.value = value;
        input.style.cssText = "margin:0;accent-color:#e4c779";
        label.append(input, document.createTextNode(text));
        second.appendChild(label);
        settingsScope.listen(input, "change", () => {
          if (input.checked) setOptions({ orientation: value });
        });
        return input;
      });
      content.appendChild(second);
      dialog.appendChild(content);
      settingsScope.listen(dialog, "click", event => {
        if (event.target === dialog) closeSettings();
      });
      for (const name of ["pointerdown", "mousedown", "click", "keydown", "keyup"])
        settingsScope.listen(dialog, name, event => event.stopPropagation());
      settingsScope.listen(dialog, "close", () => handSortSwitchLayout?.gear.setAttribute("aria-expanded", "false"));
      settingsScope.listen(window, "resize", positionHandSortSettings);
      settingsScope.listen(window, "scroll", positionHandSortSettings, true);
      document.body.appendChild(dialog);
      handSortSettingsState = { dialog, toggle, radios, scope: settingsScope };
    }
    syncHandSortSettings();
    const dialog = handSortSettingsState.dialog;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else { dialog.setAttribute("open", ""); dialog.style.display = "block"; }
    }
    handSortSwitchLayout?.gear.setAttribute("aria-expanded", "true");
    positionHandSortSettings();
    return dialog;
  };
  function refreshHandSortPanel() {
    if (!active) return null;
    const state = handSortPanelState;
    if (!state?.panel?.isConnected) return ensureHandSortFloatingPanel();
    const availability = getHandSortAvailability();
    state.buttons.forEach((button) => {
      button.disabled = !availability.ready;
      button.title = availability.message;
      button.style.opacity = availability.ready ? "1" : "0.45";
      button.style.cursor = availability.ready ? "pointer" : "not-allowed";
    });
    const selection = getHandSuitSelectionContext();
    const selectable = !!selection && selection.container.cardUis.some(ui => isHandSuitCard(ui) && ui.Activated);
    for (const input of state.suitInputs) {
      input.checked = state.suits.includes(Number(input.value));
      // 勾选是用户的筛选输入，不能因当前没轮到选牌或类解析缺失而禁止点击。
      input.disabled = false;
      input.parentElement.style.opacity = "1";
      input.parentElement.title = "设置花色后，点击右侧全选或反选执行";
    }
    for (const button of state.selectionButtons) {
      button.title = selectable
        ? (button.dataset.handSelectAction === "inverse" ? "选择所勾花色以外的手牌" : "选择所勾花色的手牌")
        : "当前不能选牌；可先勾选花色，进入选牌状态后点击执行";
    }
  }
  function updateHandSortPanelVisibility() {
    const state = handSortPanelState;
    state.panel.style.display = state.hidden ? "none" : "block";
    if (state.timer !== null) clearInterval(state.timer);
    state.timer = null;
    if (!state.hidden) {
      refreshHandSortPanel();
      state.timer = setInterval(refreshHandSortPanel, 800);
    }
    positionHandSortPanel();
  }
  function ensureHandSortFloatingPanel() {
    if (!active || !document.body) return null;
    if (handSortPanelState?.panel?.isConnected) return handSortPanelState.panel;
    ensureState();
    const state = handSortPanelState;
    if (state.cleanup) state.cleanup();
    const panelScope = scope();
    let cleaned = false;
    const panel = document.createElement("section");
    panel.id = "xcHandSortPanel";
    panel.setAttribute("aria-label", "整理手牌");
    panel.style.cssText = "position:fixed;width:max-content;max-width:calc(100vw - 16px);box-sizing:border-box;z-index:2147483647;background:#1f1f2e;color:#eee;font:13px/1.5 Arial,sans-serif;border:1px solid #4a4a6a;border-radius:6px;box-shadow:0 6px 24px #0006;user-select:none;pointer-events:auto";
    panel.style.cursor = "move";
    panel.style.touchAction = "none";
    function makeButton(text, parent) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.style.cssText = "box-sizing:border-box;width:100%;min-width:0;height:28.8px;padding:0;cursor:pointer;background:#3a3a4f;color:#eee;border:1px solid #777;border-radius:3.6px;font:11.88px/1.5 Arial,sans-serif";
      parent.appendChild(button);
      return button;
    }
    const body = document.createElement("div");
    // 两行共用四列，按钮宽度由上方花色标签的自然宽度决定。
    body.style.cssText = "padding:10px;display:grid;grid-template-columns:repeat(4,max-content);gap:8px";
    const actions = document.createElement("div");
    actions.style.display = "contents";
    body.appendChild(actions);
    const buttons = [["按花色", "CardFlower"], ["按点数", "CardNumber"]].map(([text, mode]) => {
      const button = makeButton(text, actions);
      button.dataset.handSortMode = mode;
      panelScope.listen(button, "click", () => {
        const available = getHandSortAvailability();
        if (!available.ready) return refreshHandSortPanel();
        try {
          const ok = reorderCard(mode);
          refreshHandSortPanel();
          if (!ok) button.title = "手牌数据尚未就绪，请稍后重试";
          logHandSortPanel(ok ? "sort:done" : "sort:skip", { mode });
        } catch (error) {
          button.title = "整理失败，请查看调试面板";
          logHandSortPanel("sort:error", { mode, message: String(error.message || error) });
        }
      });
      return button;
    });
    function makeCheckbox(text, parent, suit) {
      const label = document.createElement("label");
      label.style.cssText = "box-sizing:border-box;display:inline-flex;width:max-content;align-items:center;gap:4.5px;min-height:28.8px;padding:3.6px 5.4px;white-space:nowrap;cursor:pointer;font:11.88px/1.5 Arial,sans-serif;border:1px solid #4a4a6a;border-radius:3.6px;background:#272737";
      if (suit === 1 || suit === 2) label.style.color = "#ff9b9b";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.style.cssText = "margin:0;width:12.96px;height:12.96px;flex:0 0 12.96px;accent-color:#d8b66a;cursor:pointer";
      input.setAttribute("aria-label", text);
      input.dataset.handSelectSuit = String(suit);
      input.value = String(suit);
      label.append(input, document.createTextNode(text));
      parent.appendChild(label);
      panelScope.listen(input, "change", () => {
        // 花色只保存筛选条件，不触发原生选牌；空闲时同样可设置。
        state.suits = state.suitInputs.filter(node => node.checked).map(node => Number(node.value));
      });
      return input;
    }
    const suitRow = document.createElement("div");
    suitRow.dataset.handSelectRow = "1";
    suitRow.style.display = "contents";
    body.insertBefore(suitRow, actions);
    const suitInputs = HAND_SELECT_SUITS.map(([suit, text]) => makeCheckbox(text, suitRow, suit));
    const selectionButtons = [["全选", false], ["反选", true]].map(([text, inverse]) => {
      const button = makeButton(text, actions);
      button.dataset.handSelectAction = inverse ? "inverse" : "all";
      panelScope.listen(button, "click", () => {
        selectHandCardsBySuit(inverse);
        refreshHandSortPanel();
      });
      return button;
    });
    panel.appendChild(body);
    document.body.appendChild(panel);
    Object.assign(state, { panel, body, buttons, suitInputs, selectionButtons });
    applyHandSortPanelLayout();
    refreshHandSortPanel();
    // 仅空白区域拖动；按钮、勾选框及其文字不启动拖拽。
    let drag = null;
    panelScope.listen(panel, "pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button,input,label")) return;
      drag = { id: event.pointerId, x: event.clientX - state.left, y: event.clientY - state.top };
      panel.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    panelScope.listen(panel, "pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      state.left = event.clientX - drag.x;
      state.top = event.clientY - drag.y;
      positionHandSortPanel();
    });
    function finishDrag() {
      if (!drag) return;
      drag = null;
      saveHandSortPanelPosition();
    }
    panelScope.listen(panel, "pointerup", finishDrag);
    panelScope.listen(panel, "pointercancel", finishDrag);
    panelScope.listen(panel, "lostpointercapture", finishDrag);
    for (const name of ["pointerdown", "mousedown", "click", "dblclick", "keydown", "keyup"])
      panelScope.listen(panel, name, (event) => event.stopPropagation());
    panelScope.listen(window, "resize", positionHandSortPanel);
    state.cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      panelScope.dispose();
      if (state.timer !== null) clearInterval(state.timer);
      state.timer = null;
      cleanupSettings();
      panel.remove();
    };
    updateHandSortPanelVisibility();
    logHandSortPanel("panel:ready");
    return panel;
  }
  function setVisible(visible) {
    if (!ensureHandSortFloatingPanel()) return false;
    handSortPanelState.hidden = !visible;
    updateHandSortPanelVisibility();
    saveHandSortPanelPosition();
    window.dispatchEvent(new CustomEvent("xc-hand-sort-panel-visibility"));
    logHandSortPanel("panel:toggle", { visible: !handSortPanelState.hidden });
    return !handSortPanelState.hidden;
  };
  function isVisible() {
    return active && !!handSortPanelState && !handSortPanelState.hidden;
  };
  function syncHandSortPanelSwitch() {
    var input = document.getElementById(HAND_SORT_SWITCH_ID);
    if (!input) return;
    input.disabled = false;
    input.checked = isVisible();
    input.title = input.checked ? "关闭整理手牌浮窗" : "打开整理手牌浮窗";
  }
  function openHandSortSettingsFromPanel(event) {
    event.preventDefault();
    event.stopPropagation();
    openSettings();
  }

  function layoutHandSortPanelButton() {
    var state = handSortSwitchLayout;
    if (!state?.row.isConnected) return;
    // 兑换码同一行（Y），打开调试同一列（X）；不用隐藏 input 的零尺寸坐标。
    var exchange = mainHost.getAnchor(state.exchange);
    var debug = mainHost.getAnchor(state.debug);
    if (!exchange || !debug) return;
    var parentRect = state.parent.getBoundingClientRect();
    if (!parentRect.width) return;
    var source = mainHost.findSwitchContainer(state.debug);
    var row = state.row;
    row.style.width = source.offsetWidth + "px";
    row.style.height = source.offsetHeight + "px";
    var own = mainHost.getAnchor(state.input);
    if (!own) return;
    var scaleX = parentRect.width / state.parent.offsetWidth || 1;
    var scaleY = state.parent.offsetHeight ? parentRect.height / state.parent.offsetHeight : scaleX;
    var x = debug.getBoundingClientRect();
    var y = exchange.getBoundingClientRect();
    var ownRect = own.getBoundingClientRect();
    var rowRect = row.getBoundingClientRect();
    var left = (x.left + x.width / 2 - parentRect.left -
      (ownRect.left + ownRect.width / 2 - rowRect.left)) / scaleX +
      state.parent.scrollLeft - state.parent.clientLeft;
    var top = (y.top + y.height / 2 - parentRect.top -
      (ownRect.top + ownRect.height / 2 - rowRect.top)) / scaleY +
      state.parent.scrollTop - state.parent.clientTop;
    row.style.left = left + "px";
    row.style.top = top + "px";
    row.style.visibility = "visible";
    var label = state.label;
    var reference = mainHost.getControls().settings;
    var caption = reference?.querySelector(".explanation");
    var referenceAnchor = reference?.querySelector("input");
    referenceAnchor = referenceAnchor && mainHost.getAnchor(referenceAnchor);
    var captionRect = caption?.getBoundingClientRect(), anchorRect = referenceAnchor?.getBoundingClientRect();
    if (captionRect?.width && anchorRect?.width) {
      var referenceScaleX = anchorRect.width / referenceAnchor.offsetWidth || scaleX;
      var referenceScaleY = anchorRect.height / referenceAnchor.offsetHeight || scaleY;
      label.style.left = left + (ownRect.left - rowRect.left) / scaleX + (captionRect.left - anchorRect.left) / referenceScaleX + "px";
      label.style.top = top + (ownRect.top - rowRect.top) / scaleY + (captionRect.top - anchorRect.top) / referenceScaleY + "px";
      label.style.width = captionRect.width / referenceScaleX + "px";
      var nativeStyle = getComputedStyle(caption);
      for (var property of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "color", "textAlign", "justifyContent", "alignItems"])
        state.gear.style[property] = nativeStyle[property];
    } else {
      label.style.left = left + source.offsetWidth / 2 - 40 + "px";
      label.style.top = top - 18 + "px";
      label.style.width = "80px";
    }
    label.style.visibility = "visible";
    positionHandSortSettings();
  }

  function insertHandSortPanelButton() {
    if (!active || !mainHost) return false;
    var { exchange, debug } = mainHost.getControls();
    if (!exchange || !debug) return false;
    if (handSortSwitchLayout?.row.isConnected && handSortSwitchLayout.gear?.isConnected &&
        handSortSwitchLayout.exchange === exchange && handSortSwitchLayout.debug === debug) {
      syncHandSortPanelSwitch();
      layoutHandSortPanelButton();
      return true;
    }
    if (handSortSwitchLayout) handSortSwitchLayout.cleanup();
    var source = mainHost.findSwitchContainer(debug);
    var parent = source.parentElement;
    while (parent && !parent.contains(exchange)) parent = parent.parentElement;
    if (!parent || parent === document.body) return false;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    var row = source.cloneNode(true);
    mainHost.clearDuplicateIds(row);
    mainHost.clearText(row);
    row.id = "xcHandSortSwitchRow";
    row.style.position = "absolute";
    row.style.margin = "0";
    row.style.left = "0";
    row.style.top = "0";
    row.style.visibility = "hidden";
    row.style.overflow = "visible";
    var input = row.querySelector("input");
    if (!input) return false;
    // 保留该区域的 switch/slider/status 样式，移除克隆来的行为和配置标记。
    for (var node of [row].concat(Array.from(row.querySelectorAll("*")))) {
      for (var attribute of Array.from(node.attributes))
        if (/^on/i.test(attribute.name) || /^data-/.test(attribute.name))
          node.removeAttribute(attribute.name);
    }
    input.id = HAND_SORT_SWITCH_ID;
    input.type = "checkbox";
    input.name = "";
    input.removeAttribute("checked");
    input.setAttribute("aria-label", "整理手牌");
    for (var label of row.querySelectorAll("[for]")) label.htmlFor = HAND_SORT_SWITCH_ID;
    const mainScope = scope();
    parent.appendChild(row);
    var settingsLabel = document.createElement("span");
    settingsLabel.id = HAND_SORT_LABEL_ID;
    settingsLabel.className = "expandable-switch";
    settingsLabel.style.cssText = "position:absolute;display:block;color:#f2de9c;font:14px/16px Arial,sans-serif;visibility:hidden;z-index:2147483647;pointer-events:auto";
    settingsLabel.onclick = openHandSortSettingsFromPanel;
    var gear = document.createElement("span");
    gear.id = "xcHandSortSettingsButton";
    gear.className = "explanation";
    gear.setAttribute("role", "button");
    gear.tabIndex = 0;
    gear.textContent = "整理手牌";
    gear.title = "整理手牌设置";
    gear.setAttribute("aria-label", "整理手牌设置");
    gear.setAttribute("aria-haspopup", "dialog");
    gear.setAttribute("aria-controls", "xcHandSortSettingsDialog");
    gear.setAttribute("aria-expanded", "false");
    // Native .expandable-switch .explanation::after supplies exactly the same gear as wallpaper/block settings.
    gear.style.cssText = "margin:0;width:100%;cursor:pointer;position:relative";
    mainScope.listen(gear, "click", openHandSortSettingsFromPanel);
    mainScope.listen(gear, "keydown", event => {
      if (event.key === "Enter" || event.key === " ") openHandSortSettingsFromPanel(event);
    });
    settingsLabel.appendChild(gear);
    parent.appendChild(settingsLabel);
    var frame = null;
    let stopped = false;
    const token = generation;
    function scheduleLayout() {
      if (stopped || !active || token !== generation || frame !== null) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        if (!stopped && active && token === generation) layoutHandSortPanelButton();
      });
    }
    mainScope.listen(input, "change", function (event) {
      event.stopPropagation();
      setVisible(input.checked);
      syncHandSortPanelSwitch();
    });
    var resize = new ResizeObserver(scheduleLayout);
    resize.observe(parent);
    resize.observe(mainHost.findSwitchContainer(exchange));
    resize.observe(source);
    const reference = mainHost.getControls().settings;
    if (reference) resize.observe(reference);
    var observer = new MutationObserver(function (records) {
      if (records.some(function (record) {
        return !row.contains(record.target) && !gear.contains(record.target) && record.target.id !== HAND_SORT_LABEL_ID &&
          (record.type !== "childList" || Array.from(record.addedNodes).concat(Array.from(record.removedNodes))
            .some(function (node) { return node.id !== HAND_SORT_LABEL_ID && node !== gear; }));
      })) scheduleLayout();
    });
    observer.observe(parent, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
    mainScope.listen(window, "resize", scheduleLayout);
    mainScope.listen(parent, "scroll", scheduleLayout, true);
    mainScope.listen(window, "xc-hand-sort-panel-visibility", syncHandSortPanelSwitch);
    const owner = {
      row, input, parent, exchange, debug, gear, label: settingsLabel,
      cleanup: function () {
        if (stopped) return;
        stopped = true;
        mainScope.dispose();
        resize.disconnect();
        observer.disconnect();
        if (frame !== null) cancelAnimationFrame(frame);
        window.removeEventListener("resize", scheduleLayout);
        parent.removeEventListener("scroll", scheduleLayout, true);
        window.removeEventListener("xc-hand-sort-panel-visibility", syncHandSortPanelSwitch);
        if (owner.label) owner.label.onclick = null;
        owner.label?.remove();
        gear.remove();
        if (handSortSwitchLayout === owner) closeSettings();
        row.remove();
      },
    };
    handSortSwitchLayout = owner;
    syncHandSortPanelSwitch();
    layoutHandSortPanelButton();
    return true;
  }


  function requestMainPanel() {
    if (!active || !mainHost) return false;
    if (insertHandSortPanelButton()) {
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = null; retryAttempts = 0;
      return true;
    }
    if (retryTimer === null && retryAttempts < 240) {
      const token = generation;
      retryTimer = setTimeout(() => {
        if (!active || token !== generation) return;
        retryTimer = null; retryAttempts++;
        requestMainPanel();
      }, 250);
    }
    return false;
  }
  function attachMainPanel(host) {
    if (mainHost !== host) {
      handSortSwitchLayout?.cleanup();
      handSortSwitchLayout = null;
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = null; retryAttempts = 0;
      mainHost = host;
    }
    return requestMainPanel();
  }
  function mount() {
    if (!active) return null;
    const panel = ensureHandSortFloatingPanel();
    if (panel) refreshHandSortPanel();
    requestMainPanel();
    return panel;
  }
  function start() {
    if (active) return;
    active = true;
    const token = ++generation;
    const boot = () => {
      if (!active || token !== generation) return;
      readyListener = null; bootTimer = null;
      mount();
    };
    if (document.readyState === "loading") {
      readyListener = boot;
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else bootTimer = setTimeout(boot, 0);
  }
  function dispose() {
    active = false; generation++;
    if (bootTimer !== null) clearTimeout(bootTimer);
    if (retryTimer !== null) clearTimeout(retryTimer);
    if (readyListener) document.removeEventListener("DOMContentLoaded", readyListener);
    bootTimer = retryTimer = readyListener = null; retryAttempts = 0;
    handSortSwitchLayout?.cleanup();
    handSortSwitchLayout = null;
    handSortPanelState?.cleanup?.();
    cleanupSettings();
    if (handSortPanelState) Object.assign(handSortPanelState, {
      panel: null, body: null, buttons: [], suitInputs: [], selectionButtons: [],
      cleanup: null, timer: null, selecting: false,
    });
  }
  return Object.freeze({
    start, mount, dispose, attachMainPanel, requestMainPanel,
    sort: reorderCard, selectBySuit: selectHandCardsBySuit,
    setVisible, isVisible, getOptions, setOptions, openSettings, closeSettings,
  });
};
