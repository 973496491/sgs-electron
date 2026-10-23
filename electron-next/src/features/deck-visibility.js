// Independent draggable deck overlay. The host owns game state and refresh scheduling.
module.exports = function createDeckVisibilityPanel(options) {
  const doc = options.document;
  const win = options.window;
  const expanded = { top: false, bottom: false };
  let floatSize = null, resizeGrip = null;
  const storageKey = "xcDeckVisibilitySettings";
  let preferences = { visible: false, topLimit: 20, bottomLimit: 20 };
  let preferenceSaved = true;
  let sceneActive = false, controls = null, settingsPopup = null;
  function validLimit(value) { return Number.isSafeInteger(value) && value > 0; }
  function log(message) {
    try { if (options.log) options.log(message); } catch (_) {}
  }
  try {
    const saved = JSON.parse(options.storage && options.storage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") preferences = {
      visible: saved.visible === true,
      topLimit: validLimit(saved.topLimit) ? saved.topLimit : 20,
      bottomLimit: validLimit(saved.bottomLimit) ? saved.bottomLimit : 20,
    };
  } catch (error) { log("读取设置失败：" + String(error)); }
  let root = null, panel = null, signature = null;
  let position = null, drag = null, suppressClickUntil = 0;
  let enabled = true;
  const sections = new Map();
  const styles = `
    .xc-deck-floating{position:fixed;z-index:10000000000;width:max-content;max-width:calc(100vw - 16px);}
    .xc-deck-panel{box-sizing:border-box;width:max-content;max-width:100%;padding:6px 6px 22px;border:1px solid #a78b54;
      border-radius:8px;background:rgba(24,22,19,.94);color:#f2de9c;box-shadow:0 4px 14px #0007;
      font:13px/1.4 "Microsoft YaHei",sans-serif;pointer-events:auto;user-select:none;
      max-height:70vh;overflow:auto;overscroll-behavior:contain;}
    .xc-deck-panel .xc-deck-toggle{box-sizing:border-box;display:inline-flex;align-items:center;
      gap:8px;width:auto;white-space:nowrap;padding:6px 8px;margin:0;border:0;border-radius:4px;
      background:#453b2b;color:#f2de9c;font:inherit;cursor:grab;text-align:left;touch-action:none;}
    .xc-deck-floating[data-dragging="true"] .xc-deck-toggle{cursor:grabbing;}
    .xc-deck-panel .xc-deck-toggle:hover{background:#615039;}
    .xc-deck-panel .xc-deck-toggle:focus-visible{outline:2px solid #ead49b;outline-offset:-2px;}
    .xc-deck-panel .xc-deck-section+.xc-deck-section{margin-top:6px;}
    .xc-deck-panel .xc-deck-viewport{box-sizing:border-box;width:266px;max-width:calc(100vw - 30px);}
    .xc-deck-panel .xc-deck-viewport[hidden]{display:none;}
    .xc-deck-panel .xc-deck-list{display:flex;flex-direction:row;direction:ltr;flex-wrap:wrap;
      justify-content:flex-start;gap:5px;padding:7px 2px 2px;align-content:flex-start;
      box-sizing:border-box;max-height:none;overflow:visible;}
    .xc-deck-panel .xc-deck-list[hidden]{display:none;}
    .xc-deck-floating>.xc-deck-resize{position:absolute;right:3px;bottom:3px;width:16px;height:16px;
      cursor:nwse-resize;touch-action:none;border-radius:2px;
      background:repeating-linear-gradient(135deg,transparent 0 3px,#b7a174 3px 5px);
      clip-path:polygon(100% 0,100% 100%,0 100%);}
    .xc-deck-floating>.xc-deck-resize:focus-visible{outline:2px solid #ead49b;}
    .xc-deck-panel .xc-deck-slot{display:flex;align-items:center;}
    .xc-deck-panel .xc-deck-origin{display:inline-flex;align-items:center;justify-content:center;
      box-sizing:border-box;min-width:30px;min-height:24px;flex-shrink:0;border:1px solid #b7a174;
      border-radius:3px;background:#615039;color:#f2de9c;font-weight:bold;}
    .xc-deck-panel .xc-deck-slot>.shoupai{display:inline-block!important;margin:0;float:none;}
    .xc-deck-panel .xc-deck-unknown{display:inline-flex;align-items:center;justify-content:center;
      box-sizing:border-box;min-width:30px;height:24px;border:1px dashed #8c8169;border-radius:3px;
      color:#c5bba6;background:#353127;font-size:16px;}
    .xc-deck-panel .xc-deck-empty{padding:4px;color:#b6ab95;font-size:12px;}
  `;

  function getRanges(cards) {
    // Unknown node IDs are bookkeeping candidates, not visible card identities.
    const slots = Array.from(cards || [], (card, index) => ({
      index, card, known: !!card && card.key > 0 && card.id > 0,
    }));
    function trimUnknownTail(window) {
      let last = window.length - 1;
      while (last >= 0 && !window[last].known) last--;
      return window.slice(0, last + 1);
    }
    return {
      top: trimUnknownTail(slots.slice(0, preferences.topLimit)),
      bottom: trimUnknownTail(slots.slice(-preferences.bottomLimit).reverse()),
    };
  }

  function savePreferences() {
    try {
      if (options.storage) options.storage.setItem(storageKey, JSON.stringify(preferences));
      return true;
    } catch (error) { log("保存设置失败：" + String(error)); return false; }
  }

  function setVisible(value) {
    if (!enabled) return false;
    preferences.visible = !!value;
    preferenceSaved = savePreferences();
    if (controls) controls.input.checked = preferences.visible;
    refresh(sceneActive);
    return true;
  }

  function setLimits(topLimit, bottomLimit) {
    if (!enabled || !validLimit(topLimit) || !validLimit(bottomLimit)) return false;
    preferences.topLimit = topLimit;
    preferences.bottomLimit = bottomLimit;
    signature = null;
    preferenceSaved = savePreferences();
    refresh(sceneActive);
    return true;
  }

  function closeSettings(restoreFocus) {
    const state = settingsPopup;
    if (!state) return;
    settingsPopup = null;
    state.cleanup();
    state.node.remove();
    state.owner.caption.setAttribute("aria-expanded", "false");
    if (restoreFocus && state.owner.caption.isConnected) state.owner.caption.focus();
  }

  function openSettings(owner) {
    if (!enabled || controls !== owner) return;
    if (settingsPopup && settingsPopup.owner === owner) { closeSettings(true); return; }
    closeSettings(false);
    const node = doc.createElement("div");
    node.id = "xcDeckVisibilitySettings";
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-label", "牌堆记录设置");
    node.style.cssText = "position:fixed;z-index:2147483647;width:240px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:12px;border:1px solid #a78b54;border-radius:8px;background:#211e19;color:#f2de9c;box-shadow:0 4px 16px #0008;font:13px/1.5 Microsoft YaHei,sans-serif";
    node.innerHTML = `<style>
      #xcDeckVisibilitySettings label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 0;}
      #xcDeckVisibilitySettings input{box-sizing:border-box;width:82px;padding:4px;color:#f2de9c;background:#353127;border:1px solid #887955;border-radius:3px;}
      #xcDeckVisibilitySettings button{padding:4px 9px;color:#f2de9c;background:#453b2b;border:1px solid #887955;border-radius:4px;cursor:pointer;}
      #xcDeckVisibilitySettings .xc-deck-settings-head{display:flex;align-items:center;justify-content:space-between;}
      #xcDeckVisibilitySettings p{margin:8px 0;font-size:12px;color:#b6ab95;}
    </style><div class="xc-deck-settings-head"><strong>牌堆记录设置</strong><button type="button" data-close aria-label="关闭设置">×</button></div>
    <form><label>顶部记录上限（张）<input name="topLimit" type="number" min="1" step="1" required></label>
    <label>底部记录上限（张）<input name="bottomLimit" type="number" min="1" step="1" required></label>
    <p>从牌顶或牌底起计数，问号也占一张。</p><p data-feedback role="status"></p><button type="submit">保存</button></form>`;
    const top = node.querySelector('[name="topLimit"]'), bottom = node.querySelector('[name="bottomLimit"]');
    const form = node.querySelector("form"), close = node.querySelector("[data-close]");
    top.value = String(preferences.topLimit);
    bottom.value = String(preferences.bottomLimit);
    const removers = [];
    function listen(target, type, callback, capture) {
      target.addEventListener(type, callback, capture);
      removers.push(() => target.removeEventListener(type, callback, capture));
    }
    function positionSettings() {
      if (!settingsPopup || settingsPopup.node !== node) return;
      const rect = owner.caption.getBoundingClientRect();
      if (!owner.caption.isConnected || !rect.width || !rect.height) { closeSettings(false); return; }
      const anchor = owner.container.getBoundingClientRect();
      const width = node.offsetWidth, height = node.offsetHeight;
      let y = Math.max(rect.bottom, anchor.bottom) + 8;
      if (y + height > win.innerHeight - 8) y = Math.min(rect.top, anchor.top) - height - 8;
      node.style.left = Math.max(8, Math.min(rect.left, win.innerWidth - width - 8)) + "px";
      node.style.top = Math.max(8, Math.min(y, win.innerHeight - height - 8)) + "px";
    }
    listen(form, "submit", event => {
      event.preventDefault();
      if (!settingsPopup || settingsPopup.node !== node || controls !== owner) return;
      const ok = setLimits(Number(top.value), Number(bottom.value));
      node.querySelector("[data-feedback]").textContent = ok
        ? preferenceSaved ? "已保存" : "已生效，未能保存到本机"
        : "请填写大于 0 的整数";
      positionSettings();
    });
    listen(close, "click", () => closeSettings(true));
    listen(doc, "pointerdown", event => {
      if (!node.contains(event.target) && !owner.container.contains(event.target)) closeSettings(false);
    }, true);
    listen(doc, "keydown", event => { if (event.key === "Escape") { event.preventDefault(); closeSettings(true); } });
    listen(win, "resize", positionSettings);
    listen(win, "scroll", positionSettings, true);
    const observer = win.ResizeObserver ? new win.ResizeObserver(positionSettings) : null;
    if (observer) { observer.observe(owner.caption); removers.push(() => observer.disconnect()); }
    settingsPopup = { node, owner, cleanup() { removers.splice(0).forEach(remove => remove()); } };
    doc.body.appendChild(node);
    owner.caption.setAttribute("aria-expanded", "true");
    positionSettings();
    top.focus();
  }

  function cleanupControls() {
    closeSettings(false);
    if (!controls) return;
    controls.input.onchange = controls.caption.onclick = controls.caption.onkeydown = controls.container.onclick = null;
    controls.container.remove();
    controls = null;
  }

  function mountControls() {
    if (!enabled) return false;
    const general = doc.getElementById("generalSwitch"), reference = doc.getElementById("wallpaperContainer");
    const row = general && general.closest(".switch-container-row");
    if (!row || !reference) { cleanupControls(); return false; }
    if (controls && controls.container.parentNode === row && controls.container.isConnected) {
      controls.input.checked = preferences.visible;
      return true;
    }
    cleanupControls();
    const container = reference.cloneNode(true);
    for (const element of [container].concat(Array.from(container.querySelectorAll("*")))) {
      element.removeAttribute("id");
      for (const attribute of Array.from(element.attributes))
        if (/^on/i.test(attribute.name) || /^data-/.test(attribute.name)) element.removeAttribute(attribute.name);
    }
    const input = container.querySelector("input"), caption = container.querySelector(".explanation");
    if (!input || !caption) return false;
    container.id = "xcDeckVisibilityControl";
    container.setAttribute("data-tooltip", "开启牌顶、牌底浮层；点击齿轮设置记录上限");
    input.id = "xcDeckVisibilityToggle"; // Avoid the native input[id$=Switch] binder.
    input.name = "";
    input.checked = preferences.visible;
    input.disabled = false;
    input.setAttribute("aria-label", "牌堆记录");
    caption.textContent = "牌堆记录";
    caption.setAttribute("role", "button");
    caption.tabIndex = 0;
    caption.setAttribute("aria-label", "牌堆记录设置");
    caption.setAttribute("aria-haspopup", "dialog");
    caption.setAttribute("aria-controls", "xcDeckVisibilitySettings");
    caption.setAttribute("aria-expanded", "false");
    caption.style.cursor = "pointer";
    const owner = { container, input, caption };
    controls = owner;
    input.onchange = event => { event.stopPropagation(); if (controls === owner) setVisible(input.checked); };
    caption.onclick = event => { event.preventDefault(); event.stopPropagation(); if (controls === owner) openSettings(owner); };
    caption.onkeydown = event => { if (event.key === "Enter" || event.key === " ") caption.onclick(event); };
    container.onclick = event => event.stopPropagation();
    row.appendChild(container);
    return true;
  }

  function release() {
    stopDrag();
    win.removeEventListener("resize", layout);
    for (const { button } of sections.values()) {
      button.onclick = button.onpointerdown = null;
    }
    if (resizeGrip) resizeGrip.onpointerdown = resizeGrip.onkeydown = null;
    resizeGrip = null;
    sections.clear();
    if (root) root.remove();
    root = panel = null;
    signature = null;
    suppressClickUntil = 0;
  }

  function clampPosition() {
    if (!root) return;
    const width = root.offsetWidth || 280, height = root.offsetHeight || 80;
    const requested = position || { x: win.innerWidth - width - 18, y: 90 };
    position = {
      x: Math.max(8, Math.min(requested.x, win.innerWidth - width - 8)),
      y: Math.max(8, Math.min(requested.y, win.innerHeight - height - 8)),
    };
    root.style.left = position.x + "px";
    root.style.top = position.y + "px";
  }

  function constrainSize(size) {
    const maxWidth = Math.max(80, win.innerWidth - 16);
    const maxHeight = Math.max(72, Math.floor(win.innerHeight * 0.7));
    return {
      width: Math.max(Math.min(160, maxWidth), Math.min(size.width, maxWidth)),
      height: Math.max(Math.min(100, maxHeight), Math.min(size.height, maxHeight)),
    };
  }

  function layout() {
    if (root && floatSize) {
      const size = constrainSize(floatSize);
      root.style.width = size.width + "px";
      root.style.height = size.height + "px";
      panel.style.width = "100%";
      panel.style.height = "100%";
      panel.style.maxHeight = "none";
      for (const { viewport } of sections.values()) viewport.style.width = "100%";
    }
    clampPosition();
  }

  function stopDrag() {
    win.removeEventListener("pointermove", moveDrag);
    win.removeEventListener("pointerup", endDrag);
    win.removeEventListener("pointercancel", endDrag);
    win.removeEventListener("blur", stopDrag);
    if (root) root.dataset.dragging = "false";
    drag = null;
  }

  function beginDrag(event, resize = false) {
    if (event.button !== 0 || !root) return;
    stopDrag();
    const rect = root.getBoundingClientRect();
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY,
      left: rect.left, top: rect.top, moved: false, resize,
      width: rect.width || root.offsetWidth || 280,
      height: rect.height || root.offsetHeight || 120 };
    win.addEventListener("pointermove", moveDrag, { passive: false });
    win.addEventListener("pointerup", endDrag);
    win.addEventListener("pointercancel", endDrag);
    win.addEventListener("blur", stopDrag);
    if (resize) event.preventDefault();
    event.stopPropagation();
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    drag.moved = true;
    if (drag.resize) {
      floatSize = constrainSize({ width: drag.width + dx, height: drag.height + dy });
      layout();
    } else {
      root.dataset.dragging = "true";
      position = { x: drag.left + dx, y: drag.top + dy };
      clampPosition();
    }
    event.preventDefault();
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (drag.moved) suppressClickUntil = Date.now() + 250;
    stopDrag();
  }

  function mount() {
    if (root && root.parentNode === doc.body && panel && panel.parentNode === root) return;
    release();
    const host = doc.createElement("div");
    host.id = "deckEdgeUI";
    host.className = "xc-deck-floating";
    root = host;
    panel = doc.createElement("div");
    panel.className = "xc-deck-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "牌堆可见牌");
    const style = doc.createElement("style");
    style.textContent = styles;
    panel.appendChild(style);
    for (const [side, text] of [["top", "顶部卡牌"], ["bottom", "底部卡牌"]]) {
      const section = doc.createElement("div");
      section.className = "xc-deck-section";
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "xc-deck-toggle";
      button.dataset.side = side;
      const label = doc.createElement("span");
      label.textContent = text;
      const icon = doc.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      button.appendChild(label);
      button.appendChild(icon);
      const list = doc.createElement("div");
      list.id = side === "top" ? "deckTopEdge" : "deckBottomEdge";
      list.className = "xc-deck-list";
      const viewport = doc.createElement("div");
      viewport.className = "xc-deck-viewport";
      viewport.dataset.side = side;
      button.setAttribute("aria-controls", list.id);
      const entry = { button, icon, list, text, viewport };
      sections.set(side, entry);
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        // A handler saved from an old scene must not change the replacement panel.
        if (root !== host || sections.get(side) !== entry) return;
        if (Date.now() < suppressClickUntil) return;
        expanded[side] = !expanded[side];
        refresh(true);
      };
      button.onpointerdown = event => {
        if (root === host && sections.get(side) === entry) beginDrag(event);
      };
      button.setAttribute("aria-description", "单击展开或关闭，拖动移动浮层");
      section.appendChild(button);
      viewport.appendChild(list);
      section.appendChild(viewport);
      panel.appendChild(section);
    }
    host.appendChild(panel);
    const grip = doc.createElement("span");
    grip.className = "xc-deck-resize";
    grip.setAttribute("role", "button");
    grip.setAttribute("tabindex", "0");
    grip.setAttribute("aria-label", "调整牌堆浮层大小");
    grip.title = "统一调整浮层宽高；方向键微调";
    resizeGrip = grip;
    grip.onpointerdown = event => {
      if (root === host && resizeGrip === grip) beginDrag(event, true);
    };
    grip.onkeydown = event => {
      const delta = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[event.key];
      if (!delta || root !== host || resizeGrip !== grip) return;
      const box = host.getBoundingClientRect();
      floatSize = constrainSize({ width: box.width + delta[0], height: box.height + delta[1] });
      layout();
      event.preventDefault();
      event.stopPropagation();
    };
    host.appendChild(grip);
    doc.body.appendChild(host);
    win.addEventListener("resize", layout);
    layout();
  }

  function renderList(side, slots) {
    const { button, icon, list, text, viewport } = sections.get(side);
    const open = expanded[side];
    button.setAttribute("aria-expanded", String(open));
    button.title = (open ? "关闭" : "展开") + text + "（可拖动）";
    icon.textContent = open ? "▾" : "▸";
    list.hidden = !open;
    viewport.hidden = !open;
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!open) return;
    // Direction labels are presentation-only and never consume a card position or limit.
    const origin = doc.createElement("span");
    origin.className = "xc-deck-origin";
    origin.textContent = side === "top" ? "顶" : "底";
    list.appendChild(origin);
    if (!slots.length) {
      const empty = doc.createElement("span");
      empty.className = "xc-deck-empty";
      empty.textContent = "暂无已记录的可见牌";
      list.appendChild(empty);
      return;
    }
    const fragment = doc.createDocumentFragment();
    slots.forEach(({ index, card, known }) => {
      const slot = doc.createElement("span");
      slot.className = "xc-deck-slot";
      slot.dataset.index = String(index);
      slot.dataset.key = String(known ? card.id : 0);
      let face = null;
      if (known) {
        try { face = options.renderKnownCard(card); }
        catch (error) {
          if (options.log) options.log("牌堆卡牌绘制失败：" + String(error));
        }
      }
      if (!face) {
        face = doc.createElement("span");
        face.className = "xc-deck-unknown";
        face.textContent = "？";
      }
      slot.appendChild(face);
      fragment.appendChild(slot);
    });
    list.appendChild(fragment);
  }

  function refresh(active) {
    if (!enabled) return;
    sceneActive = !!active;
    if (!preferences.visible || !sceneActive || !doc.body) { release(); return; }
    mount();
    const cards = options.readCards() || [];
    const nextSignature = cards.map(card => card && card.key > 0 ? card.id : 0).join(",") +
      "|" + expanded.top + "|" + expanded.bottom;
    if (signature !== nextSignature) {
      const ranges = getRanges(cards);
      renderList("top", ranges.top);
      renderList("bottom", ranges.bottom);
      signature = nextSignature;
    }
    layout();
  }

  // Keep expansion, position and the unified float size for this page; discard scene DOM/data.
  return {
    refresh, reset: release, getRanges, setVisible, setLimits, mountControls,
    getSettings: () => ({ ...preferences }),
    start() { enabled = true; },
    dispose() { enabled = false; sceneActive = false; release(); cleanupControls(); },
  };
};
