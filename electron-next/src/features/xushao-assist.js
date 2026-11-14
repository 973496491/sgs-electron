// Visual-only Xu Shao hints. Owns preference, movable DOM and enabled-only polling.
module.exports = function createXuShaoAssist({ window, document, storage, client, placeControl, refreshLayout, log = () => {} }) {
  const key = "xcXuShaoAssist";
  let options = { enabled: false, position: null };
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (saved) options = { enabled: saved.enabled === true,
      position: Number.isFinite(saved.position?.left) && Number.isFinite(saved.position?.top)
        ? { left: saved.position.left, top: saved.position.top } : null };
  } catch (_) {}
  // Legacy mode/delay values are deliberately ignored; the adapter has no action API.
  let active = false, generation = 0, poll = null, control = null, panel = null;
  let current = null, rendered = null, heading = null, content = null, drag = null, dragCleanup = null;
  function persist(next) {
    try { storage.setItem(key, JSON.stringify(next)); options = next; return true; }
    catch (error) { log("save-error", String(error)); return false; }
  }
  function endDrag(save = false) {
    const previous = drag; drag = null;
    if (dragCleanup) dragCleanup(); dragCleanup = null;
    if (previous?.moved && save && panel && active && options.enabled) {
      const next = { ...options, position: { left: parseFloat(panel.style.left), top: parseFloat(panel.style.top) } };
      if (!persist(next)) options = next;
    }
  }
  function removePanel() {
    endDrag(); panel?.remove(); panel = null; heading = null; content = null; rendered = null;
  }
  function resetBoard() { current = null; removePanel(); client.clearEggs(); client.clearHighlights(); }
  function stopPolling() {
    generation++;
    if (poll !== null) window.clearInterval(poll);
    poll = null; resetBoard();
  }
  function sameBoard(a, b) {
    return !!a && a.board === b.board && a.scene === b.scene && a.wordsIdentity === b.wordsIdentity &&
      a.skill === b.skill && a.seat === b.seat;
  }
  function placeAt(left, top) {
    if (!panel) return;
    const width = panel.getBoundingClientRect().width || 230;
    const height = panel.getBoundingClientRect().height || 200;
    panel.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, left)) + "px";
    panel.style.top = Math.max(8, Math.min(window.innerHeight - height - 8, top)) + "px";
  }
  function positionPanel(frame) {
    if (!panel || drag) return;
    if (options.position) { placeAt(options.position.left, options.position.top); return; }
    const rect = client.bounds(frame);
    if (!rect) { placeAt(window.innerWidth - 246, 80); return; }
    const width = panel.getBoundingClientRect().width || 230;
    let left = rect.right + 8;
    if (left + width > window.innerWidth - 8) left = rect.left - width - 8;
    placeAt(left, rect.top);
  }
  function beginDrag(event) {
    if (!active || !options.enabled || !panel || event.currentTarget !== heading || event.button !== 0 || drag) return;
    event.preventDefault(); event.stopPropagation();
    const owner = panel, token = generation, rect = owner.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
    function move(e) {
      if (!drag || e.pointerId !== drag.id || generation !== token || panel !== owner || !active || !options.enabled) return;
      e.preventDefault(); e.stopPropagation();
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      drag.moved = true; placeAt(drag.left + dx, drag.top + dy);
    }
    function finish(e) {
      if (!drag || e.pointerId !== drag.id || generation !== token || panel !== owner) return;
      e.stopPropagation(); endDrag(true);
    }
    window.addEventListener("pointermove", move, { passive: false, capture: true });
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", finish, true);
    window.addEventListener("blur", cancel);
    function cancel() { if (generation === token && panel === owner) endDrag(true); }
    dragCleanup = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", finish, true);
      window.removeEventListener("blur", cancel);
    };
  }
  function showCombinations(frame, rows) {
    if (panel && !panel.isConnected) removePanel();
    if (!panel) {
      panel = document.createElement("section"); panel.id = "xcXuShaoCombinations";
      panel.setAttribute("aria-label", "许劭可连线组合");
      panel.style.cssText = "position:fixed;z-index:2147483646;width:230px;max-width:calc(100vw - 16px);max-height:70vh;overflow:auto;box-sizing:border-box;padding:12px;color:#f2de9c;background:rgba(26,23,21,.96);border:1px solid #a88e51;border-radius:8px;font:13px/1.6 Arial,sans-serif;box-shadow:0 4px 20px #0008;pointer-events:auto";
      heading = document.createElement("div"); heading.id = "xcXuShaoDragHandle";
      heading.title = "拖动标题移动面板";
      heading.style.cssText = "cursor:move;touch-action:none;user-select:none;font-weight:bold;padding-bottom:6px";
      heading.addEventListener("pointerdown", beginDrag);
      content = document.createElement("div"); panel.append(heading, content);
      for (const type of ["pointerdown", "pointermove", "pointerup", "mousedown", "click", "wheel", "keydown"])
        panel.addEventListener(type, event => event.stopPropagation());
      document.body.appendChild(panel);
    }
    const signature = JSON.stringify(rows);
    if (rendered !== signature) {
      rendered = signature; content.textContent = "";
      heading.textContent = "可连线组合（" + rows.length + "）";
      if (!rows.length) { const empty = document.createElement("div"); empty.textContent = "当前没有可连线组合"; content.appendChild(empty); }
      for (const row of rows) {
        const item = document.createElement("div"); item.style.cssText = "padding:8px 0;border-top:1px solid #a88e5144";
        const name = document.createElement("strong"); name.textContent = row.name;
        const word = document.createElement("div"); word.textContent = row.text;
        name.style.color = word.style.color = row.color;
        const location = document.createElement("div"); location.style.color = "#c3bba9";
        location.textContent = row.direction + "：" + (Math.floor(row.begin / 6) + 1) + "行" + (row.begin % 6 + 1) + "列 → " +
          (Math.floor(row.end / 6) + 1) + "行" + (row.end % 6 + 1) + "列" + (row.hidden ? " · 含遮挡格" : "") + (row.helped ? " · 已获帮助" : "");
        item.append(name, word, location); content.appendChild(item);
      }
    }
    positionPanel(frame);
  }
  function tick() {
    if (!active || !options.enabled) return;
    try {
      const frame = client.read();
      if (!frame) { resetBoard(); return; }
      if (!sameBoard(current, frame)) { resetBoard(); current = frame; }
      const rows = client.combinations(frame);
      client.hideEggs(frame);
      client.highlight(frame, rows);
      showCombinations(frame, rows);
    } catch (error) { resetBoard(); log("error", String(error)); }
  }
  function run() {
    stopPolling();
    if (active && options.enabled) {
      const token = generation;
      tick(); poll = window.setInterval(() => { if (token === generation) tick(); }, 200);
    }
  }
  function setEnabled(enabled) {
    if (!active) return false;
    const next = { ...options, enabled: !!enabled };
    if (!persist(next)) { if (enabled) return false; options = next; }
    if (control) control.querySelector("input").checked = options.enabled;
    run(); log("toggle", { enabled: options.enabled }); return true;
  }
  function mount() {
    if (!active) return;
    const anchor = document.getElementById("autoSignSwitch");
    if (!anchor?.isConnected || control?.isConnected) return;
    control?.remove(); document.getElementById("xcXuShaoControl")?.remove();
    control = document.createElement("div"); control.id = "xcXuShaoControl"; control.className = "switch-container";
    const caption = document.createElement("label"); caption.className = "explanation"; caption.textContent = "许劭辅助";
    caption.htmlFor = "xcXuShaoToggle";
    const label = document.createElement("label"); label.className = "switch";
    const input = document.createElement("input"); input.id = "xcXuShaoToggle"; input.type = "checkbox"; input.checked = options.enabled;
    input.setAttribute("aria-label", "许劭辅助");
    const slider = document.createElement("span"), status = document.createElement("span"); slider.className = "slider"; status.className = "status";
    label.append(input, slider, status); control.append(caption, label);
    input.addEventListener("change", event => {
      event.stopPropagation(); if (!control?.contains(input)) return;
      if (!setEnabled(input.checked)) input.checked = options.enabled;
    });
    const reference = anchor.closest(".xc-settings-flow-item") || anchor.closest(".expandable-switch") || anchor.parentNode;
    reference.parentNode.insertBefore(control, reference); placeControl(control); refreshLayout();
  }
  function start() { if (active) return; active = true; mount(); run(); }
  function dispose() { active = false; stopPolling(); control?.remove(); control = null; }
  return Object.freeze({ start, mount, dispose, setEnabled,
    getOptions: () => ({ enabled: options.enabled, position: options.position ? { ...options.position } : null }) });
};
