// Owns the persisted switch, settings control, native window leases and score labels.
module.exports = function createSelectionRatings({ window, client, document, storage,
  placeControl = () => {}, refreshLayout = () => {}, log = () => {}, isDebug = () => true }) {
  let active = false, requested = false, enabled = true, managerUndo = null, poll = null, retry = null, epoch = 0;
  const key = 'xcGeneralRatingsEnabled';
  const description = '显示当前模式下, 所属身份和座次所在的武将评分, 当前服务器返回的评分中: 谋周瑜和曹金玉缺失信息';
  let control = null;
  try { const saved = JSON.parse(storage?.getItem(key) ?? 'null'); if (typeof saved === 'boolean') enabled = saved; } catch (_) {}
  const scopes = new Map();
  function trace(message) { try { log(message); } catch (_) {} }
  function wrap(target, name, after, before) {
    if (!target || typeof target[name] !== 'function') return null;
    const original = target[name], own = Object.getOwnPropertyDescriptor(target, name);
    let live = true;
    const wrapper = function () {
      if (live && active) { try { before?.(this); } catch (e) { trace('清理失败 ' + e.message); } }
      const result = original.apply(this, arguments);
      if (live && active) { try { after?.(this, result, arguments); } catch (e) { trace('刷新失败 ' + e.message); } }
      return result;
    };
    try { Object.defineProperty(target, name, { value: wrapper, configurable: true, writable: true, enumerable: own?.enumerable || false }); }
    catch (e) { trace('挂钩失败 ' + name + ' ' + e.message); return null; }
    return () => {
      live = false;
      if (target[name] !== wrapper) return;
      if (own) Object.defineProperty(target, name, own); else delete target[name];
    };
  }
  function restoreLayout(scope) {
    for (const [node, saved] of scope.positions) {
      if (!node.destroyed && node.y === saved.applied) node.y = saved.base;
    }
    scope.positions.clear();
  }
  function move(scope, node, y) {
    if (node.y === y) return;
    scope.positions.set(node, { base: node.y, applied: y }); node.y = y;
  }
  function clear(scope) {
    restoreLayout(scope);
    for (const text of scope.labels.values()) if (!text.destroyed) text.destroy(true);
    scope.labels.clear(); scope.signature = '';
  }
  function visible(win) { return !win.destroyed && !win.closeing && win.parent && win.visible !== false; }
  function stopPollIfIdle() {
    if (poll !== null && !Array.from(scopes.values()).some(scope => scope.open)) {
      window.clearInterval(poll); poll = null;
    }
  }
  function refresh(scope) {
    if (!active || !enabled || !scope.open || !visible(scope.win)) { clear(scope); return; }
    restoreLayout(scope);
    const frame = client.read(scope.win), present = new Set(frame.entries.map(entry => entry.card));
    for (const [card, text] of scope.labels) if (!present.has(card) || card.destroyed) {
      if (!text.destroyed) text.destroy(true); scope.labels.delete(card);
    }
    // Reserve a narrow line between rows. Keep native card sizes and horizontal positions intact.
    const parents = new Map();
    for (const entry of frame.entries) {
      if (!parents.has(entry.card.parent)) parents.set(entry.card.parent, []);
      parents.get(entry.card.parent).push(entry.card);
    }
    for (const [parent, cards] of parents) {
      const rows = [];
      for (const card of cards.slice().sort((a, b) => a.y - b.y)) {
        let row = rows.find(item => Math.abs(item.y - card.y) < 3);
        if (!row) { row = { y: card.y, cards: [] }; rows.push(row); }
        row.cards.push(card);
      }
      let bottom = -Infinity, originalBottom = -Infinity;
      for (const row of rows) {
        const shift = Math.max(0, bottom + 18 - row.y);
        for (const card of row.cards) {
          originalBottom = Math.max(originalBottom, card.y + card.height);
          move(scope, card, card.y + shift);
        }
        bottom = Math.max(...row.cards.map(card => card.y + card.height));
      }
      const controls = ['lessHuanJiangLabel', 'countdownTimer', 'bottomTipTxt', 'confirmBtn']
        .map(key => scope.win[key]).filter(node => node && !node.destroyed && node.parent === parent &&
          node.visible !== false && node.y >= originalBottom - 1);
      if (controls.length && Number.isFinite(bottom)) {
        const shift = Math.max(0, bottom + 19 - Math.min(...controls.map(node => node.y)));
        for (const node of controls) move(scope, node, node.y + shift);
      }
    }
    for (const { card, value } of frame.entries) {
      let text = scope.labels.get(card);
      if (!text || text.destroyed) {
        text = client.createLabel();
        if (!text) { trace('文字创建失败：Laya.Text不可用'); break; }
        scope.labels.set(card, text);
      }
      if (text.parent !== card) card.addChild(text);
      text.text = value + '/10'; text.x = 0; text.y = card.height + 1; text.width = card.width;
    }
    const signature = JSON.stringify([frame.rows, frame.dimension, frame.reason, frame.contextSource, client.loadState?.().phase,
      frame.entries.map(entry => [entry.id, entry.value, entry.reason])]);
    if (signature !== scope.signature) {
      scope.signature = signature;
      trace('显示 ' + scope.name + ' 配置=' + frame.rows + ' 维度=' + frame.dimension +
        ' 状态=' + frame.reason + ' ' + frame.entries.map(entry => entry.id + ':' + entry.value + '/10(' + entry.reason + ')').join(' '));
      if (isDebug()) trace('链路 ' + scope.name + ' ' + JSON.stringify(client.diagnose(scope.win)));
    }
  }
  function tick() {
    for (const scope of Array.from(scopes.values())) {
      if (scope.win.destroyed) { release(scope); continue; }
      if (scope.open && visible(scope.win)) scope.seenVisible = true;
      else if (scope.open && scope.seenVisible) close(scope);
      try { refresh(scope); } catch (e) {
        const error = String(e.message || e);
        if (scope.error !== error) { scope.error = error; trace('刷新失败 ' + scope.name + ' ' + error); }
      }
    }
    stopPollIfIdle();
  }
  function open(scope) {
    if (!active || !enabled || scope.win.destroyed) return;
    if (!scope.open) scope.seenVisible = false;
    scope.open = true;
    if (poll === null) poll = window.setInterval(tick, 250);
    // enterWindow can finish before the native Show attaches its window to the stage.
  }
  function close(scope) { scope.open = false; clear(scope); stopPollIfIdle(); }
  function release(scope) {
    close(scope); for (const undo of scope.undos.reverse()) undo(); scopes.delete(scope.win);
  }
  function bind(win, name) {
    if (!win || win.destroyed || scopes.has(win)) return;
    const scope = { win, name, open: false, labels: new Map(), positions: new Map(), undos: [], signature: '', error: '' };
    scopes.set(win, scope);
    for (const method of ['enterWindow', 'Show']) {
      const undo = wrap(win, method, () => open(scope)); if (undo) scope.undos.push(undo);
    }
    // Restore our offsets before native layout/reuse so it never calculates from shifted values.
    for (const method of ['layoutBeforAdapter', 'resetGeneralCardUiPos', 'ShowGenerals', 'UpdateWindow', 'onTabClick']) {
      const undo = wrap(win, method, () => { if (scope.open) refresh(scope); }, () => restoreLayout(scope));
      if (undo) scope.undos.push(undo);
    }
    for (const method of ['Close', 'Hide']) {
      const undo = wrap(win, method, null, () => close(scope)); if (undo) scope.undos.push(undo);
    }
    const undo = wrap(win, 'destroy', () => release(scope), () => close(scope));
    if (undo) scope.undos.push(undo);
    if (visible(win)) open(scope);
  }
  function install() {
    if (!active || !enabled) return false;
    const manager = client.manager();
    if (!managerUndo) managerUndo = wrap(manager, 'GetWindow', (owner, win, args) => {
      if (enabled && client.names.includes(args[0])) bind(win, args[0]);
    });
    if (!managerUndo) return false;
    for (const entry of client.existing()) bind(entry.win, entry.name);
    return true;
  }
  function start() {
    requested = true;
    window.addEventListener?.('xc:selection-ratings-diagnose', onDiagnose);
    mount();
    if (!enabled) return;
    if (active && (managerUndo || retry !== null)) return;
    active = true; const token = ++epoch;
    let attempts = 0;
    function attempt() {
      retry = null;
      if (!active || !enabled || epoch !== token) return;
      try { if (install()) { trace('已安装：卡下评分验证版，无评分显示0/10'); return; } }
      catch (e) { if (!attempts) trace('等待客户端 ' + e.message); }
      if (++attempts < 60) retry = window.setTimeout(attempt, 500);
      else trace('未安装：窗口管理器未就绪');
    }
    attempt();
  }
  function stopRunning() {
    for (const scope of Array.from(scopes.values())) release(scope);
    active = false; epoch++;
    if (retry !== null) window.clearTimeout(retry); retry = null;
    if (poll !== null) window.clearInterval(poll); poll = null;
    managerUndo?.(); managerUndo = null;
  }
  function dispose() {
    stopRunning(); requested = false;
    window.removeEventListener?.('xc:selection-ratings-diagnose', onDiagnose);
    control?.remove(); control = null;
  }
  function setEnabled(value) {
    const next = !!value;
    if (next === enabled) return true;
    try { storage?.setItem(key, JSON.stringify(next)); }
    catch (error) { trace('设置保存失败 ' + String(error.message || error)); return false; }
    enabled = next;
    const input = control?.querySelector('input'); if (input) input.checked = enabled;
    if (!enabled) stopRunning(); else if (requested) start();
    trace('开关 ' + (enabled ? '开启' : '关闭'));
    return true;
  }
  function mount() {
    if (!requested || !document) return;
    const grid = document.getElementById('xcSettingsGeneral');
    if (!grid?.isConnected) return;
    if (control?.isConnected) { placeControl(control); return; }
    control?.remove(); document.getElementById('xcGeneralRatingsControl')?.remove();
    control = document.createElement('div'); control.id = 'xcGeneralRatingsControl'; control.className = 'switch-container';
    control.setAttribute('data-tooltip', description);
    const caption = document.createElement('label'); caption.className = 'explanation'; caption.htmlFor = 'xcGeneralRatingsToggle';
    caption.textContent = '武将评分';
    const label = document.createElement('label'); label.className = 'switch';
    const input = document.createElement('input'); input.id = 'xcGeneralRatingsToggle'; input.type = 'checkbox'; input.checked = enabled;
    input.setAttribute('aria-label', '武将评分'); input.setAttribute('aria-description', description);
    const slider = document.createElement('span'), status = document.createElement('span');
    slider.className = 'slider'; status.className = 'status';
    label.append(input, slider, status); control.append(caption, label);
    const owner = control;
    input.addEventListener('change', event => {
      event.stopImmediatePropagation();
      if (!requested || control !== owner || !owner.isConnected) return;
      if (!setEnabled(input.checked)) input.checked = enabled;
    });
    grid.appendChild(control); placeControl(control); refreshLayout();
  }
  function diagnose(source = 'manual') {
    if (!isDebug()) return null;
    const windows = [];
    for (const scope of Array.from(scopes.values()).slice(0, 8)) {
      scope.signature = ''; // Opening debug after a silent first draw must report the next current state.
      try { windows.push({ name: scope.name, open: scope.open, visible: !!visible(scope.win), ...client.diagnose(scope.win) }); }
      catch (e) { windows.push({ name: scope.name, error: String(e.message || e).slice(0, 240) }); }
    }
    const report = { source, active, enabled, installed: !!managerUndo, polling: poll !== null,
      current: client.diagnose(null), windows };
    trace('诊断 ' + JSON.stringify(report));
    return report;
  }
  function onDiagnose(event) {
    if (!requested || !isDebug()) return;
    if (event.detail) event.detail.handled = true;
    try { diagnose(event.detail?.source || 'event'); } catch (e) { trace('诊断失败 ' + String(e.message || e).slice(0, 240)); }
  }
  return Object.freeze({ start, mount, dispose, setEnabled, isEnabled: () => enabled, diagnose });
};
