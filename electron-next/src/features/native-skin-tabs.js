// OL picker tabs share the native list/render/pick lifecycle. GetWindow returns before Show;
// enterWindow runs after resources/Init are ready, so it is the single page initialization entry.
module.exports = function createNativeSkinTabs({ window, laya, groups = [], labels = {}, link, prepareView = () => {}, extension = null, log = () => {} }) {
  const WIDTH = 713, HEIGHT = 543, ROW = 28, GAP = 6, ARROW = 14, ARROW_GAP = 4, FONT = 13;
  // ahs is the currently registered in-game picker, not an obsolete SelectSkinWindow class.
  const NAMES = ['ChangeSkinWindow', 'SelectSkinWindow', 'ModifyShowSkinWindow'];
  const byId = new Map();
  for (const row of groups) {
    if (!Array.isArray(row) || row.length < 3) continue;
    for (const id of row.slice(1)) if (Number(id) > 0) byId.set(Number(id), row);
  }
  let active = false, mounted = null, listUndo = null, managerUndo = null, eligibilityUndo = null;
  const windows = new Map(), pages = new Map(), scopes = [];
  const diagnosticIDs = new WeakMap();
  let nextDiagnosticID = 0, sequence = 0, lastEvent = '', lastError = '';

  function idOf(value) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return 0;
    if (!diagnosticIDs.has(value)) diagnosticIDs.set(value, ++nextDiagnosticID);
    return diagnosticIDs.get(value);
  }
  function shape(value) {
    return { type: Array.isArray(value) ? 'array' : typeof value, class: value?.constructor?.name || '',
      getWindow: typeof value?.GetWindow, getWindowData: typeof value?.GetWindowData,
      skinBucket: typeof value?.getOnlineSKinListByGeneralId };
  }
  function errorInfo(error) {
    return { message: String(error?.message || error),
      stack: String(error?.stack || '').split('\n').slice(0, 5).join(' | ') };
  }
  // Diagnostics use the injected debug-window adapter. No console, cache, polling or automatic repair.
  function trace(event, detail) {
    lastEvent = event;
    try { log('#' + (++sequence) + ' ' + event + ' ' + JSON.stringify(detail)); } catch (_) {}
  }
  function failure(event, error, detail = {}) {
    lastError = event + ': ' + String(error?.message || error);
    trace(event, { ...detail, ...errorInfo(error) });
  }
  function snapshot(win) {
    try {
      const page = pages.get(win), view = win.selectView, bar = page?.bar;
      const children = [];
      for (let i = Math.max(0, (win.numChildren || 0) - 8); i < (win.numChildren || 0); i++) {
        const node = win.getChildAt(i);
        children.push({ name: node?.name || '', class: node?.constructor?.name || '', z: node?.zOrder || 0 });
      }
      return { windowID: idOf(win), name: win.name, generalID: win.generalID || 0,
        viewID: idOf(view), viewGeneralID: view?.realGeneralID || 0, loading: !!win.loading,
        destroyed: !!win.destroyed, closing: !!win.closeing, visible: win.visible !== false,
        attached: !!win.parent, x: win.x, y: win.y,
        width: win.width, height: win.height, scaleX: win.scaleX, scaleY: win.scaleY,
        panel: view?.pannel ? { x: view.pannel.x, y: view.pannel.y, width: view.pannel.width, height: view.pannel.height } : null,
        tabCount: page?.tabs.length || 0, activeTab: page?.activeTab || '', skinCount: view?.list?.length || 0,
        bar: bar ? { attached: bar.parent === win, destroyed: !!bar.destroyed, visible: bar.visible !== false,
          alpha: bar.alpha, x: bar.x, y: bar.y, width: bar.width, height: bar.height, z: bar.zOrder || 0,
          mouse: bar.mouseEnabled,
          index: win.getChildIndex?.(bar), clipWidth: page.clipWidth,
          parent: bar.parent?.name || bar.parent?.constructor?.name || '',
          clip: { attached: page.clip?.parent === bar, visible: page.clip?.visible !== false,
            width: page.clip?.width, height: page.clip?.height, mouse: page.clip?.mouseEnabled },
          strip: { attached: page.strip?.parent === page.clip, x: page.strip?.x,
            width: page.strip?.width, mouse: page.strip?.mouseEnabled } } : null,
        children };
    } catch (error) { return { windowID: idOf(win), ...errorInfo(error) }; }
  }
  function logAfterFrame(page) {
    if (!page || !window.XC?.isDebug || typeof window.requestAnimationFrame !== 'function') return;
    page.diagnosticFrame = window.requestAnimationFrame(function () {
      page.diagnosticFrame = null;
      if (current(page)) trace('下一帧状态', snapshot(page.win));
    });
  }

  function namespace() { return window.Laya || window.laya; }
  function windowManager() {
    try { return typeof laya === 'function' ? laya('WindowManager') : null; }
    catch (error) { failure('窗口管理器解析失败', error); return null; }
  }
  function holderOf(object, name) {
    for (let item = object; item; item = Object.getPrototypeOf(item)) {
      if (Object.prototype.hasOwnProperty.call(item, name)) return item;
    }
    return object;
  }
  // Deactivate even when a later wrapper still calls ours; never overwrite that later wrapper.
  function wrap(target, name, handler) {
    if (!target || typeof target[name] !== 'function') {
      trace('挂钩跳过', { method: name, reason: 'method-missing', target: shape(target) });
      return null;
    }
    const original = target[name], own = Object.getOwnPropertyDescriptor(target, name);
    let enabled = true;
    const wrapper = function () {
      return enabled ? handler.call(this, original, arguments) : original.apply(this, arguments);
    };
    try {
      Object.defineProperty(target, name, { value: wrapper, writable: true, configurable: true,
        enumerable: own ? own.enumerable : false });
    } catch (error) {
      failure('挂钩失败', error, { method: name, target: shape(target),
        writable: own?.writable, configurable: own?.configurable });
      return null;
    }
    return function () {
      enabled = false;
      if (target[name] !== wrapper) return;
      if (own) Object.defineProperty(target, name, own);
      else delete target[name];
    };
  }
  function current(page) {
    return active && pages.get(page.win) === page && !page.win.destroyed &&
      !page.win.closeing && !page.view.destroyed;
  }
  function tabbed(page) { return current(page) && (page.tabs.length > 1 || page.external); }
  function appendExternal(list, generalID, tab, showAll = false) {
    // Native share-skin probing requests showAll=true. Local display entries must never
    // enter SendReqShareItem; the normal picker query still receives them.
    if (!extension || showAll) return list || [];
    const extra = extension.entries(generalID, tab.label);
    return (list || []).concat(extra);
  }
  function listFor(manager, tab, showAll, share, generalID) {
    return link.withBucket(function () {
      const out = [], seen = new Set();
      for (const id of tab.ids) {
        const part = manager.getOnlineSKinListByGeneralId(id, showAll, share);
        for (const skin of part || []) {
          if (!skin || seen.has(skin.skinID)) continue;
          seen.add(skin.skinID); out.push(skin);
        }
      }
      return appendExternal(out, generalID, tab, showAll);
    });
  }
  function buildTabs(id, view, diagnostic) {
    const externalPages = extension?.pages(Number(id)) || [];
    const row = byId.get(Number(id)) || (externalPages.length ? ['', Number(id)] : null);
    if (!row) {
      if (diagnostic) trace('分页跳过', { ...diagnostic, generalID: Number(id), reason: 'no-group' });
      return [];
    }
    const buckets = new Map();
    for (const peer of row.slice(1)) {
      if (Number(peer) === Number(id)) continue;
      const label = labels[peer] || ('武将' + peer);
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label).push(Number(peer));
    }
    const selfLabel = extension?.label(Number(id)) || '默认';
    if (extension && selfLabel !== '默认') {
      // Multiple OL IDs with this exact display label join the current page too.
      const same = buckets.get(selfLabel) || [];
      buckets.delete(selfLabel);
      if (same.length) buckets.set(selfLabel, same);
      for (const page of externalPages) {
        if (!buckets.has(page.label)) buckets.set(page.label, []);
        for (const peer of page.ids) if (Number(peer) !== Number(id) && !buckets.get(page.label).includes(peer)) buckets.get(page.label).push(peer);
      }
    }
    const selfPeers = buckets.get(selfLabel) || [];
    if (extension) buckets.delete(selfLabel);
    const manager = link.manager();
    const out = [{ key: 'self', label: selfLabel, ids: [Number(id), ...selfPeers], self: true }];
    const counts = [];
    for (const [label, ids] of buckets) {
      const tab = { key: ids.length ? 'peer:' + ids[0] : 'name:' + label, label, ids, self: false };
      let skins;
      try { skins = listFor(manager, tab, false, !!view.isShareSkin, Number(id)); }
      catch (error) {
        if (diagnostic) failure('变体取数失败', error, { ...diagnostic, ids, label, manager: shape(manager) });
        throw error;
      }
      counts.push({ label, ids, count: skins.length });
      if (skins.length) out.push(tab);
    }
    if (extension && out.length > 1) {
      const own = appendExternal(link.withBucket(() => manager.GetOnlineSKinList(Number(id), false, !!view.isShareSkin)), Number(id), out[0]);
      if (!own.length) out.shift(); // Original/default entry remains available inside each native page.
    }
    if (diagnostic) trace('分页生成', { ...diagnostic, generalID: Number(id), group: row[0],
      manager: shape(manager), share: !!view.isShareSkin, buckets: counts,
      tabCount: out.length, reason: out.length > 1 ? 'multiple-pages' : 'peer-empty' });
    return out;
  }
  function installListHook() {
    if (listUndo) return true;
    const holder = link.getHolder();
    if (extension && !eligibilityUndo && typeof holder?.HaveOnlineByGeneralId === 'function') {
      eligibilityUndo = wrap(holder, 'HaveOnlineByGeneralId', function (original, args) {
        if (original.apply(this, args)) return true;
        return extension.pages(Number(args[0])).some(page => extension.entries(Number(args[0]), page.label).length > 0 ||
          page.ids.some(id => (link.withBucket(() => this.getOnlineSKinListByGeneralId(id, false, false)) || []).length > 0));
      });
    }
    trace('皮肤取数挂钩', shape(holder));
    listUndo = wrap(holder, 'GetOnlineSKinList', function (original, args) {
      const page = scopes[scopes.length - 1];
      if (!page || !tabbed(page) || Number(args[0]) !== page.generalID) return original.apply(this, args);
      const tab = page.tabs.find(item => item.key === page.activeTab);
      // The default page keeps official GeneralSkinParent sharing; each peer page is a pure bucket.
      if (!tab.self) return listFor(this, tab, args[1], args[2], page.generalID);
      const out = (link.withBucket(() => original.apply(this, args)) || []).slice();
      const seen = new Set(out.map(skin => skin.skinID));
      for (const peer of tab.ids.slice(1)) for (const skin of link.withBucket(() => this.getOnlineSKinListByGeneralId(peer, args[1], args[2])) || []) {
        if (!seen.has(skin.skinID)) { seen.add(skin.skinID); out.push(skin); }
      }
      return appendExternal(out, page.generalID, tab, args[1]);
    });
    return !!listUndo;
  }
  function ensureTop(page) {
    if (page.bar && typeof page.win.setChildIndex === 'function') {
      page.win.setChildIndex(page.bar, page.win.numChildren - 1);
    }
  }
  function applyLayout(page) {
    if (!tabbed(page)) return;
    const { win, view } = page;
    // initBg triggers native resize/animation work. Do it only when the dimensions change.
    if (win.width !== WIDTH || win.height !== HEIGHT) win.initBg(WIDTH, HEIGHT, WIDTH);
    if (!win.closeBtn && typeof win.addCloseBtn === 'function') {
      win.addCloseBtn(); page.addedClose = win.closeBtn;
    }
    view.size(WIDTH, HEIGHT);
    view.itemCtn = 4;
    view.pannel.pos(20, 84);
    view.pannel.size(WIDTH - 25, 420);
    if (win.countdownTimer) win.countdownTimer.y = HEIGHT - 30;
    if (page.bar) {
      page.bar.pos(20, 46);
      ensureTop(page);
    }
  }
  function scope(page, original, receiver, args) {
    if (!tabbed(page)) return original.apply(receiver, args);
    scopes.push(page);
    try { return original.apply(receiver, args); } finally { scopes.pop(); }
  }
  function hookView(page) {
    const { view, win } = page;
    function hook(target, name, handler) {
      const undo = wrap(target, name, handler);
      if (undo) page.undo.push(undo);
    }
    for (const name of ['initSkinListData', 'initSelectListData', 'RefreshShareSkin']) {
      hook(view, name, function (original, args) { return scope(page, original, this, args); });
    }
    hook(view, 'calculateSize', function (original, args) {
      if (!tabbed(page)) return original.apply(this, args);
      applyLayout(page);
    });
    hook(win, 'calculateSize', function (original, args) {
      if (!tabbed(page)) return original.apply(this, args);
      applyLayout(page);
    });
    hook(view, 'updateContent', function (original, args) {
      applyLayout(page);
      const result = original.apply(this, args);
      if (tabbed(page)) ensureTop(page);
      return result;
    });
    hook(view, 'event', function (original, args) {
      if (tabbed(page) && args[0] === 'CLOSE_SKIN_WINDOW') {
        if (scopes.includes(page) || !this.clickCheck) {
          trace('保留窗口', { windowID: idOf(win), reason: scopes.includes(page) ? 'list-refresh' : 'no-pick' });
          return;
        }
        log('选择皮肤：gid=' + page.generalID + ' sid=' + this.closeSelectSkinId);
      }
      return original.apply(this, args);
    });
    hook(view, 'destroy', function (original, args) {
      // Keep the native destroy -> closeSelectSure submission, including local-skin send isolation.
      trace('视图销毁', { windowID: idOf(win), viewID: idOf(this), picked: !!this.clickCheck,
        skinID: this.closeSelectSkinId });
      try { return original.apply(this, args); } finally { releasePage(page, 'view-destroy'); }
    });
  }
  function releasePage(page, reason) {
    if (pages.get(page.win) !== page) return;
    trace('释放分页', { reason, ...snapshot(page.win) });
    if (page.diagnosticFrame != null) window.cancelAnimationFrame?.(page.diagnosticFrame);
    pages.delete(page.win);
    if (mounted === page) mounted = Array.from(pages.values()).find(current) || null;
    for (const undo of page.undo.reverse()) undo();
    if (page.bar) page.bar.destroy(true);
    if (page.addedClose && page.win.closeBtn === page.addedClose) {
      page.win.removeChild(page.addedClose);
      page.addedClose.destroy?.(true);
      page.win.closeBtn = null;
    }
  }
  function startPage(win, generalID) {
    if (pages.has(win)) releasePage(pages.get(win), 'new-enter');
    const view = win.selectView, Laya = namespace();
    const diagnostic = { windowID: idOf(win), viewID: idOf(view), name: win.name, generalID: Number(generalID) || 0 };
    if (!view || view.destroyed || !Number(generalID)) {
      trace('分页前置未满足', { ...diagnostic, hasView: !!view, viewDestroyed: !!view?.destroyed });
      return null;
    }
    // Every picker instance needs a current local-selection owner, including single-page generals.
    // Bind before native UpdateInfo builds cards/captures callbacks and before our instance wrappers.
    trace('视图登记开始', diagnostic);
    let registered;
    try { registered = prepareView(view); }
    catch (error) { failure('视图登记失败', error, diagnostic); throw error; }
    trace('视图登记完成', { ...diagnostic, registered: registered ?? 'unknown',
      localSendHook: !!view.closeSelectSure?.__localSkinDebugHooked });
    if (!Laya?.Sprite || !installListHook()) {
      trace('分页依赖未满足', { ...diagnostic, sprite: typeof Laya?.Sprite, listHook: !!listUndo });
      return null;
    }
    extension?.bindView(view);
    const page = { win, view, generalID: Number(generalID), activeTab: 'self', external: !!extension?.pages(Number(generalID)).length,
      tabs: buildTabs(generalID, view, diagnostic), undo: [], bar: null, items: [], offset: 0, addedClose: null };
    if (!page.tabs.some(tab => tab.key === 'self')) page.activeTab = page.tabs[0]?.key || 'self';
    pages.set(win, page); mounted = page;
    try {
      if (page.tabs.length > 1 || page.external) { hookView(page); buildBar(page); }
    } catch (error) {
      failure('Tab创建失败', error, diagnostic);
      releasePage(page, 'build-error');
      throw error;
    }
    log('分页初始化：窗口=' + win.name + ' gid=' + page.generalID + ' 页数=' + page.tabs.length);
    return page;
  }
  function bindWindow(win) {
    if (!active || !win || win.destroyed || windows.has(win)) return;
    const undo = [];
    undo.push(wrap(win, 'enterWindow', function (original, args) {
      if (!active) return original.apply(this, args);
      trace('原生开窗进入', { requestedGeneralID: Number(args[0]) || 0, ...snapshot(this) });
      let page;
      try { page = startPage(this, args[0]); }
      catch (error) { failure('初始化分页失败', error, { windowID: idOf(this) }); }
      let result;
      try { result = page?.external ? scope(page, original, this, args) : original.apply(this, args); }
      catch (error) { failure('原生开窗失败', error, { windowID: idOf(this) }); throw error; }
      if (page) applyLayout(page);
      trace('原生开窗完成', snapshot(this));
      logAfterFrame(page);
      return result;
    }));
    undo.push(wrap(win, 'destroy', function (original, args) {
      try { return original.apply(this, args); }
      finally {
        if (pages.has(this)) releasePage(pages.get(this), 'window-destroy');
        unbindWindow(this);
      }
    }));
    windows.set(win, undo.filter(Boolean));
    trace('窗口挂钩完成', { windowID: idOf(win), name: win.name, enterHook: !!undo[0], destroyHook: !!undo[1] });
  }
  function unbindWindow(win) {
    for (const undo of (windows.get(win) || []).reverse()) undo();
    windows.delete(win);
  }
  function installWindowHook() {
    if (managerUndo) return true;
    const manager = windowManager();
    trace('窗口管理器', shape(manager));
    managerUndo = wrap(manager && holderOf(manager, 'GetWindow'), 'GetWindow', function (original, args) {
      const win = original.apply(this, args);
      if (active && NAMES.includes(args[0])) {
        trace('取得选肤窗口', win ? snapshot(win) : { name: args[0], reason: 'window-null' });
        bindWindow(win);
      }
      return win;
    });
    return !!managerUndo;
  }
  // Read existing windows once when enabling, never create one or poll for it.
  function ensureMounted() {
    if (!active) return false;
    const manager = windowManager();
    if (!manager || typeof manager.GetWindowData !== 'function') return false;
    installWindowHook();
    for (const name of NAMES) {
      const win = manager.GetWindowData(name);
      trace('启用时窗口检查', { name, found: !!win, loading: !!win?.loading,
        destroyed: !!win?.destroyed, closing: !!win?.closeing });
      if (!win || win.destroyed || win.closeing) continue;
      bindWindow(win);
      if (pages.has(win) || !win.selectView || !Number(win.generalID)) continue;
      const page = startPage(win, win.generalID);
      if (page && tabbed(page)) { rebuild(page); logAfterFrame(page); }
    }
    return !!mounted;
  }
  function drawTab(entry, selected) {
    const { item, label } = entry;
    item.graphics.clear();
    item.graphics.drawRect(0, 0, item.width, ROW, selected ? '#6b4a1d' : '#2a1a0d');
    item.graphics.drawRect(0, ROW - 2, item.width, selected ? 2 : 1, selected ? '#e8c07a' : '#5a4326');
    label.color = selected ? '#ffe9b0' : '#c2a678'; label.bold = selected;
  }
  function scrollBy(page, delta) {
    if (!current(page)) return;
    page.offset = Math.max(0, Math.min(page.offset + delta, Math.max(0, page.stripWidth - page.clipWidth)));
    page.strip.x = -page.offset;
  }
  function buildBar(page) {
    const Laya = namespace(), bar = new Laya.Sprite(), clip = new Laya.Sprite(), strip = new Laya.Sprite();
    const width = WIDTH - 40, clipWidth = width - 2 * (ARROW + ARROW_GAP);
    bar.name = 'xcSkinTabs'; bar.size(width, ROW); bar.mouseEnabled = true;
    // Isolate this input before native flat-container handlers see it.
    for (const type of [Laya.Event.MOUSE_DOWN, Laya.Event.MOUSE_UP, Laya.Event.CLICK]) {
      if (type) bar.on(type, null, event => event?.stopPropagation?.());
    }
    clip.mouseEnabled = strip.mouseEnabled = true;
    clip.pos(ARROW + ARROW_GAP, 0); clip.size(clipWidth, ROW);
    clip.scrollRect = new Laya.Rectangle(0, 0, clipWidth, ROW);
    clip.addChild(strip); bar.addChild(clip);
    Object.assign(page, { bar, clip, strip, clipWidth });
    let x = 0;
    for (const tab of page.tabs) {
      const item = new Laya.Sprite(), label = new Laya.Text();
      item.size(Math.max(46, tab.label.length * FONT + 22), ROW); item.pos(x, 0); item.mouseEnabled = true;
      label.text = tab.label; label.fontSize = FONT; label.width = item.width; label.height = ROW;
      label.align = 'center'; label.valign = 'middle'; label.mouseEnabled = false;
      item.addChild(label); strip.addChild(item);
      const entry = { tab, item, label }; page.items.push(entry);
      drawTab(entry, tab.key === page.activeTab);
      // Tab sprites stay alive across switches. Only their paint and the skin content change.
      item.on(Laya.Event.CLICK, null, function (event) {
        event?.stopPropagation?.();
        selectPageTab(page, tab.key);
      });
      x += item.width + GAP;
    }
    page.stripWidth = Math.max(0, x - GAP); strip.size(Math.max(clipWidth, page.stripWidth), ROW);
    for (const left of [true, false]) {
      const arrow = new Laya.Sprite(); arrow.size(ARROW, ROW); arrow.mouseEnabled = true;
      arrow.graphics.drawRect(0, 0, ARROW, ROW, '#241408');
      arrow.graphics.drawPoly(0, 0, left ? [4, 14, 9, 9, 9, 19] : [9, 14, 4, 9, 4, 19], '#d9b06a');
      arrow.pos(left ? 0 : width - ARROW, 0); arrow.visible = page.stripWidth > clipWidth;
      arrow.on(Laya.Event.CLICK, null, () => scrollBy(page, left ? -120 : 120)); bar.addChild(arrow);
    }
    page.win.addChild(bar);
    trace('Tab挂载完成', snapshot(page.win));
  }
  function rebuild(page) {
    if (!tabbed(page)) return;
    page.view.initSkinListData();
    applyLayout(page);
    page.view.selectTex.visible = false;
    page.view.updateContent();
    if (page.view.pannel.vScrollBar) page.view.pannel.vScrollBar.value = 0;
    page.win.updateSkinNum?.();
    ensureTop(page);
  }
  function selectPageTab(page, key) {
    if (!current(page) || key === page.activeTab || !page.tabs.some(tab => tab.key === key)) return;
    mounted = page; page.activeTab = key;
    for (const entry of page.items) drawTab(entry, entry.tab.key === key);
    try {
      rebuild(page);
      log('切页完成：' + key + ' 皮肤=' + (page.view.list?.length || 0));
    } catch (error) { failure('切换分页失败', error, { windowID: idOf(page.win), key }); }
  }
  function selectTab(key) { if (mounted) selectPageTab(mounted, key); }
  function attach() {
    if (active) return true;
    trace('启用分页', { groups: groups.length, generals: byId.size });
    active = true;
    extension?.attach();
    const linked = link.attach();
    trace('皮肤互通状态', { attached: linked, ...link.status?.() });
    installListHook();
    const ready = installWindowHook();
    ensureMounted();
    log(ready ? '分页已接入原生开窗入口' : '分页未接入：WindowManager.GetWindow 不可用');
    return ready;
  }
  function detach() {
    if (!active) return false;
    active = false;
    extension?.detach();
    if (managerUndo) { managerUndo(); managerUndo = null; }
    if (listUndo) { listUndo(); listUndo = null; }
    if (eligibilityUndo) { eligibilityUndo(); eligibilityUndo = null; }
    for (const page of Array.from(pages.values())) {
      releasePage(page, 'detach');
      if (!page.win.destroyed && !page.win.closeing && !page.view.destroyed) {
        page.view.initSkinListData(); page.view.calculateSize();
        page.win.calculateSize((page.view.list?.length || 0) + 1); page.view.updateContent();
        page.win.updateSkinNum?.();
      }
    }
    for (const win of Array.from(windows.keys())) unbindWindow(win);
    return true;
  }
  function status() {
    return { active, hooked: !!listUndo, windowHooked: !!managerUndo, mounted: !!mounted,
      bar: !!mounted?.bar, tabs: (mounted?.tabs || []).map(tab => ({ key: tab.key, label: tab.label, ids: tab.ids.slice() })),
      activeTab: mounted?.activeTab || 'self', generalID: mounted?.generalID || 0,
      window: mounted?.win.name || '', lastEvent, lastError };
  }
  function diagnose() {
    const report = { ...status(), windows: Array.from(windows.keys()).map(snapshot) };
    trace('诊断快照', report);
    return report;
  }
  function plan(id) {
    return buildTabs(id, mounted?.view || { isShareSkin: false }).map(tab => ({ key: tab.key, label: tab.label, ids: tab.ids.slice() }));
  }
  window.__xcSkinTabsStatus = status; window.__xcSkinTabsPlan = plan;
  return { attach, detach, status, plan, selectTab, ensureMounted, diagnose,
    get active() { return active; }, get tabs() { return mounted?.tabs || []; } };
};
