const assert = require('node:assert/strict');
const createLink = require('../src/features/native-skin-link');
const createTabs = require(require.main === module && process.argv[2] && process.argv[2] !== '--coverage' ? process.argv[2] : '../src/features/native-skin-tabs');
const native = require('./fixtures/native-skin-tabs-20261118.json');
const groups = require('../src/features/native-skin-groups')();
const labels = require('../src/features/native-skin-labels')();

function vo(skinID, generalID) { return { skinID, generalID }; }

// Laya subset: enough Sprite/Text/Rectangle surface for the bar, plus synchronous click dispatch.
function makeLaya() {
  class Node {
    constructor() {
      this.children = []; this.x = 0; this.y = 0; this.width = 0; this.height = 0;
      this.visible = true; this.handlers = {}; this.destroyed = false;
      this.graphics = { clear() {}, drawRect() {}, drawPoly() {} };
    }
    addChild(node) { this.children.push(node); node.parent = this; return node; }
    removeChild(node) {
      const at = this.children.indexOf(node);
      if (at >= 0) this.children.splice(at, 1);
      node.parent = null;
    }
    removeChildren() { for (const node of this.children) node.parent = null; this.children = []; }
    size(w, h) { this.width = w; this.height = h; }
    pos(x, y) { this.x = x; this.y = y; }
    on(event, caller, fn) { (this.handlers[event] = this.handlers[event] || []).push(fn); }
    dispatch(type, event = { stopped: false, stopPropagation() { this.stopped = true; } }) {
      for (const fn of this.handlers[type] || []) fn(event);
      if (!event.stopped && this.parent && this.parent.dispatch) this.parent.dispatch(type, event);
      return event;
    }
    click() { return this.dispatch('click'); }
    destroy() { this.destroyed = true; this.removeSelf(); }
    removeSelf() { if (this.parent) this.parent.removeChild(this); this.removed = true; }
  }
  return {
    Sprite: class extends Node {},
    Text: class extends Node {},
    Rectangle: class { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } },
    Event: { CLICK: 'click', MOUSE_DOWN: 'mousedown', MOUSE_UP: 'mouseup' }
  };
}

// Mirrors the native chain: buckets -> GetGeneralSkinIncludeHide -> getOnlineSKinListByGeneralId,
// and GetOnlineSKinList additionally merges the official GeneralSkinParent list.
function makeManager(skins, parents = {}, useNative = false) {
  const manager = {
    GetGeneralSkinIncludeHide(id) {
      const bucket = skins[Number(id)];
      return bucket ? bucket.slice() : null;
    },
    GetSkinListBySkinID() { return [{}]; },
    GetSelfUsingSkinID() { return 0; },
    getOnlineSKinListByGeneralId(id, a, b) {
      const list = this.GetGeneralSkinIncludeHide(id, a, b);
      return list && list.length ? list : null;
    },
    GetOnlineSKinList(id, a, b) {
      const self = this.getOnlineSKinListByGeneralId(id, a, b) || [];
      const out = self.slice();
      for (const peer of parents[Number(id)] || []) {
        for (const item of this.getOnlineSKinListByGeneralId(peer, a, b) || []) {
          if (out.indexOf(item) < 0) out.push(item);
        }
      }
      return out.length ? out : null;
    }
  };
  if (useNative) Object.assign(manager, new Function('G8t', 'aMt', 'Zni',
    'return ({' + ['GetGeneralSkinIncludeHide', 'GetOnlineSKinList', 'getOnlineSKinListByGeneralId']
      .map(name => native.manager[name]).join(',\n') + '})')(
        { I: () => ({ GetGeneralSkin: id => skins[id] || [] }) },
        { I: () => ({ GetGeneralInfo: id => ({ GeneralSkinParentIDs: parents[id] || [] }) }) },
        { ChecHasShareSkin: () => false }));
  return manager;
}

// One base class per harness; real registered picker methods are selected by window name below.
function makeWindowClass() {
  return class FakeWindow {
    constructor(generalID, view) {
      this.generalID = 0;
      this.selectView = view;
      this.width = 540;
      this.height = 509;
      this.children = [];
      this.closes = 0;
      this.closed = false;
      this.windowTitleTxt = { contextWidth: 120, contextHeight: 20, y: 10, size() {}, pos() {} };
      // CLOSE_SKIN_WINDOW is bound to Close in the native window's Init(), and Init adds the view
      // to the window (selectView.parent is how the tabs module finds the window on later opens).
      view.closeHandler = this.Close.bind(this);
      view.parent = this;
    }
    get numChildren() { return this.children.length; }
    getChildAt(index) { return this.children[index] || null; }
    addChild(node) { this.children.push(node); node.parent = this; return node; }
    removeChild(node) {
      const at = this.children.indexOf(node);
      if (at >= 0) this.children.splice(at, 1);
      node.parent = null;
    }
    getChildIndex(node) { return this.children.indexOf(node); }
    setChildIndex(node, index) {
      const at = this.children.indexOf(node);
      if (at < 0) return;
      this.children.splice(at, 1);
      this.children.splice(Math.max(0, Math.min(index, this.children.length)), 0, node);
    }
    addCloseBtn() {
      if (this.closeBtn) return;
      this.closeBtn = { name: 'closeBtn' };
      this.children.push(this.closeBtn);
    }
    initBg(w, h) { this.width = w; this.height = h; this.backgroundUpdates = (this.backgroundUpdates || 0) + 1; }
    moveCenter() { this.centered = true; }
    updateSkinNum() { this.skinTotal = this.selectView.list.length; }
    // Native chain: calculateSize closes on an almost empty list, Close() removes the window and
    // destroys the view synchronously.
    calculateSize(n) {
      if (n <= 1) { this.Close(); return; }
      this.initBg(n <= 6 ? 540 : 713, 509);
    }
    Close() {
      this.closes++;
      this.closed = true;
      this.destroy();
    }
    destroy() { this.selectView?.destroy(); this.destroyed = true; }
    InitData() {}
    LoadRes() {}
    // Native entry: GetWindow returns the instance, then Show drives its wrapped enterWindow.
    Show(id) { this.args = [id]; if (this.loading) this.isShowWait = true; else this.enterWindow(id); }
    enterWindow() {}
  };
}

// Native view: clicking a skin sets the pending id and emits CLOSE_SKIN_WINDOW, and destroy()
// is what actually sends the SET request. One class per harness, so the tabs module hooks a fresh
// prototype (the real build has nqt.prototype shared by SelectSkinWindow and 皮肤详情).
function makeViewClass(options = {}) {
  class FakeView {
    constructor(manager, generalID) {
      this.manager = manager;
      this.list = [];
      this.itemCtn = 3;
      this.isShareSkin = false;
      this.realGeneralID = generalID;
      this.usingSkinID = 0;
      this.clickCheck = false;
      this.closeSelectSkinId = 0;
      this.closeSelectDynamicState = 0;
      this.sent = [];
      this.events = [];
      this.commits = 0;
      this.itemList = [];
      this.selectTex = { visible: false };
      this.pannelContent = { addDrawChild() {}, setDrawChildIndex() {}, size() {} };
      this.pannel = {
        x: 0, y: 0, width: 0, height: 0,
        vScrollBar: { value: 0 }, refresh() {},
        pos(x, y) { this.x = x; this.y = y; },
        size(w, h) { this.width = w; this.height = h; }
      };
    }
    initSelectListData() {
      this.list = this.manager.GetOnlineSKinList(this.realGeneralID, false, false) || [];
      return this.list.length ? false : true;
    }
    initSkinListData() {
      if (this.initSelectListData()) { this.event('CLOSE_SKIN_WINDOW'); return true; }
      return false;
    }
    RefreshShareSkin() { this.initSelectListData(); this.updateContent(); }
    get rendered() { return this.itemList.filter(item => item.SkinID).map(item => item.SkinID); }
    sortList() {}
    selectItem() {}
    selectOut() {}
    calculateSize() {
      const count = this.list.length || 0;
      if (count <= 1) { this.event('CLOSE_SKIN_WINDOW'); return; }
      this.size(count <= 6 ? 540 : 713, 509);
      this.itemCtn = count <= 6 ? 3 : 4;
      this.pannel.pos(20, 50); this.pannel.size(500, 420);
    }
    size(w, h) { this.width = w; this.height = h; }
    event(type) {
      this.events.push(type);
      if (type === 'CLOSE_SKIN_WINDOW' && this.closeHandler) this.closeHandler();
    }
    closeSelectSure() { this.commits++; this.sent.push(this.closeSelectSkinId); }
    itemClick(ev) {
      const item = ev && ev.currentTarget;
      if (!item || !item.HasSkin) return;
      this.clickCheck = true;
      if (!item.IsUsing) { this.closeSelectSkinId = item.SkinID; this.closeSelectDynamicState = item.DynamicState; }
      this.event('CLOSE_SKIN_WINDOW');
    }
    destroy() { this.destroyed = true; }
  }
  class NativeItem {
    static COMPSE_SKIN_CLICK = 'compose';
    constructor() { this.width = 154; this.height = 182; this.handlers = {}; }
    InitData(data, using) { this.SkinID = data.skinID; this.HasSkin = true; this.IsUsing = using; this.DynamicState = 1; }
    InitBaseData(name, image, level, owned, using, id) {
      this.SkinID = id; this.HasSkin = owned; this.IsUsing = using; this.DynamicState = 0;
    }
    on(type, caller, fn) { this.handlers[type] = fn.bind(caller); }
    click() { this.handlers.click({ currentTarget: this }); }
    pos() {}
    clear() { this.cleared = true; }
  }
  const NativeView = new Function('Base', 'nqt', 'y8t', 'Zni', 'aMt', 'aqt', 'vU', 'POt',
    'return class NativeView extends Base {' + Object.values(native.view).join('\n') + '}')(
      FakeView, { CLOSE_SKIN_WINDOW: 'CLOSE_SKIN_WINDOW' },
      { I() { return nativeManager; } }, { ChecHasShareSkin() { return false; }, CurrentPlayer: { ClientId: 42 } },
      { I() { return { GetGeneralInfo(id) { return { GeneralSeatImg: 'seat:' + id }; } }; } },
      options.itemClass || NativeItem, { SGSFLATCONTAINER_OVER: 'over', SGSFLATCONTAINER_OUT: 'out', SGSFLATCONTAINER_CLICK: 'click' },
      { SELECTSKIN_JINDIAN: '默认' });
  // Managers are per harness; native methods resolve the active view's manager on each call.
  let nativeManager;
  return class extends NativeView {
    constructor(manager, id) { super(manager, id); nativeManager = manager; }
  };
}

function harness(options = {}) {
  const skins = options.skins || {
    389: [vo(38901, 389), vo(38902, 389)],
    528: [vo(52801, 528), vo(52802, 528)],
    1: [vo(101, 1)],
    220: [vo(22001, 220)],
    299: [vo(29901, 299)],
    664: [vo(66401, 664)],
    65534: [vo(6553401, 65534)]
  };
  const manager = makeManager(skins, options.parents || { 1: [299], 299: [1] }, options.nativeBuckets);
  const Laya = makeLaya();
  const timers = [];
  const window = {
    Laya,
    setTimeout(fn) { if (options.noTimers) throw Error('unexpected timeout'); timers.push(fn); return timers.length; },
    clearTimeout() {},
    setInterval() { if (options.noTimers) throw Error('unexpected interval'); return 1; },
    clearInterval() {}
  };
  const data = new Map();
  const storage = { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v) };
  const logs = [];
  const link = createLink({ window, document: {}, storage, groups,
    laya: { class: name => (name === 'GeneralSkinManager' ? manager : null) }, log: text => logs.push(text) });
  let win = null, present = true;
  const opened = new Map();
  const wm = {
    hasWindow: name => !!opened.get(name),
    GetWindowData: name => {
      const found = opened.get(name);
      return present && !found?.destroyed ? found : null;
    },
    gamePopUpWindowDict: { getStringKey: name => wm.GetWindowData(name) },
    addKey(name, item) { opened.set(name, item); }
  };
  const tabs = (options.createTabs || createTabs)({ window, document: {}, groups, labels, link,
    prepareView: options.prepareView,
    laya: name => (name === 'WindowManager' ? wm : null), log: text => logs.push(text) });
  // publish=false mirrors the real reopen: the window exists and builds its list while the window
  // manager still reports it as absent.
  const WindowBase = makeWindowClass();
  wm.GetWindow = new Function('Zi', 'xsi', 'return ({' + native.manager.GetWindow + '}).GetWindow')(
    { GetInstanceByClassName: () => win }, WindowBase);
  const windowClasses = new Map();
  for (const [name, picker] of Object.entries(native.pickers)) {
    const WindowClass = new Function('Base', 'aMt', 'y8t',
      'return class extends Base {' + picker.enterWindow + '}')(
        WindowBase, { I: () => ({ GetGeneralInfo: id => ({ GeneralSeatImg: 'seat:' + id }) }) }, { I: () => manager });
    Object.defineProperties(WindowClass.prototype, Object.getOwnPropertyDescriptors(
      new Function('return ({' + picker.calculateSize + '})')()));
    windowClasses.set(name, WindowClass);
  }
  const ViewClass = makeViewClass(options);
  function open(generalID, publish = true, windowName = options.windowName || 'SelectSkinWindow', loading = false) {
    const view = new ViewClass(manager, generalID);
    const picker = native.pickers[windowName], WindowClass = windowClasses.get(windowName);
    assert(picker && WindowClass, 'the requested picker must be registered by the native client');
    win = new WindowClass(generalID, view);
    win.name = windowName;
    // open() models a new instance; reuse scenarios call enterWindow on the existing instance.
    opened.delete(windowName);
    if (loading) {
      win.loading = true; win.selectView = null;
      win.Init = function () {
        this.selectView = view; this.inited = true;
        if (picker.hasNativeCloseButton) this.addCloseBtn();
      };
      win.loadResComplete = new Function('return ({' + native.baseWindow.loadResComplete + '}).loadResComplete')();
    } else if (picker.hasNativeCloseButton) win.addCloseBtn();
    present = publish;
    // Native GetWindow returns before Show; the entry hook must be in place before UpdateInfo.
    wm.GetWindow(win.name);
    win.Show(generalID);
    return { win, view };
  }
  function publish() { present = true; }
  function close() { win = null; }
  function step() { if (timers.length) timers.shift()(); }
  function flush() { let guard = 0; while (timers.length && guard++ < 200) timers.shift()(); }
  return { tabs, link, manager, wm, window, storage, logs, open, close, publish, step, flush,
    get win() { return win; } };
}
const ids = list => (list || []).map(item => item.skinID);

if (require.main !== module) {
  module.exports = { harness };
  return;
}

// 1. Label table: one entry per grouped general, with the version prefix kept.
assert.equal(Object.keys(labels).length, 427);
assert.equal(labels[389], '吴苋');
assert.equal(labels[528], '族吴苋');
assert.equal(labels[1], '刘备');
assert.equal(labels[299], '界刘备');
assert.equal(labels[220], '神刘备');

// 2. 吴苋 and 族吴苋 get one peer tab each, named after the other version.
{
  const { tabs } = harness();
  assert.deepEqual(tabs.plan(389).map(tab => tab.label), ['默认', '族吴苋']);
  assert.deepEqual(tabs.plan(528).map(tab => tab.label), ['默认', '吴苋']);
}

// 3. 刘备 keeps the official GeneralSkinParent pair on the default page and splits the rest.
{
  const { tabs } = harness();
  assert.deepEqual(tabs.plan(1).map(tab => tab.label), ['默认', '神刘备', '界刘备', 'SP刘备']);
}

// 4. Ids that share a display label fold into one tab (神秘武将 has twelve ids, 左慈 eight).
{
  const { tabs } = harness({ skins: {
    228: [vo(22801, 228)], 530: [vo(53001, 530)], 565: [vo(56501, 565)], 9999: [vo(999901, 9999)]
  } });
  const mystery = tabs.plan(228);
  assert.equal(mystery.length, 2, 'the twelve 神秘武将 ids must not become twelve tabs');
  assert.equal(mystery[1].label, '神秘武将');
  assert.equal(mystery[1].ids.length, 11, 'every other id folds into the one tab');
  assert.ok(mystery[1].ids.includes(530));
}

// 5. attach() mounts the bar, forces the wide layout and leaves the default page native.
{
  const h = harness();
  h.tabs.attach();
  const { view, win } = h.open(389);
  h.flush();
  assert.equal(win.width, 713, 'tab mode widens the window once');
  assert.equal(win.height, 543);
  const bar = win.children.find(node => node.name === 'xcSkinTabs');
  assert.ok(bar, 'tab bar must be added to the window');
  assert.equal(bar.visible, true);
  assert.deepEqual(ids(view.list), [38901, 38902], '默认 page keeps only the own bucket');
  assert.equal(view.pannel.y, 84, 'list is pushed down below the bar');
}

// 6. Selecting a peer tab rebuilds the list from that bucket only.
{
  const { tabs, open, flush } = harness();
  tabs.attach();
  const { view } = open(389);
  flush();
  tabs.selectTab('peer:528');
  assert.deepEqual(ids(view.list), [52801, 52802]);
  assert.deepEqual(view.rendered, [52801, 52802]);
  assert.equal(tabs.status().activeTab, 'peer:528');
  tabs.selectTab('self');
  assert.deepEqual(ids(view.list), [38901, 38902]);
}

// 7. Outside the picker the merge is untouched: other callers still see every version.
{
  const { tabs, manager, open, flush } = harness();
  tabs.attach();
  open(389);
  flush();
  assert.deepEqual(ids(manager.GetOnlineSKinList(389)), [38901, 38902, 52801, 52802]);
}

// 8. Empty peer buckets do not become tabs (4 张 skinless version stays hidden).
{
  const { tabs } = harness({ skins: { 389: [vo(38901, 389)], 528: [] } });
  assert.deepEqual(tabs.plan(389).map(tab => tab.label), ['默认']);
}

// 9. A general without a group keeps the native window: no bar, no relayout.
{
  const { tabs, open, flush } = harness();
  tabs.attach();
  const { win } = open(65534);
  flush();
  assert.equal(win.children.length, 0, 'no bar for ungrouped generals');
  assert.equal(win.width, 540);
  assert.equal(win.height, 509);
}

// 10. detach() removes the bar, restores the geometry and unwraps GetOnlineSKinList.
{
  const h = harness();
  const tabs = h.tabs;
  h.tabs.attach();
  const { win } = h.open(389);
  h.flush();
  h.tabs.detach();
  assert.equal(win.children.length, 0, 'bar must be removed with the module');
  assert.equal(win.width, 540);
  assert.equal(win.height, 509, 'height goes back to the native 509');
  assert.equal(tabs.status().hooked, false);
  assert.deepEqual(ids(h.manager.GetOnlineSKinList(389)), [38901, 38902, 52801, 52802], 'merge survives detach');
}

// 11. Enabling before any picker is open does not create a window.
{
  const { tabs, flush } = harness();
  tabs.attach();
  flush();
  assert.equal(tabs.status().mounted, false);
  assert.equal(tabs.status().active, true);
  assert.ok(labels[389]);
}

// 12. Re-opening the same window instance does not stack a second bar.
{
  const h = harness();
  h.tabs.attach();
  const { view, win } = h.open(389);
  h.flush();
  h.tabs.ensureMounted();
  h.tabs.ensureMounted();
  const bars = win.children.filter(node => node.name === 'xcSkinTabs');
  assert.equal(bars.length, 1);
  assert.deepEqual(ids(view.list), [38901, 38902]);
}

// 13. A rebuilt window (new instance) gets a fresh bar instead of reusing the stale one.
{
  const { tabs, open, flush } = harness();
  tabs.attach();
  open(389);
  flush();
  const second = open(528);
  flush();
  const bars = second.win.children.filter(node => node.name === 'xcSkinTabs');
  assert.equal(bars.length, 1);
  assert.deepEqual(ids(second.view.list), [52801, 52802]);
}

// 14. Clicking a skin applies the pick and closes the picker exactly once (no double SET).
{
  const h = harness();
  h.tabs.attach();
  const { view, win } = h.open(389);
  h.flush();
  view.itemClick({ currentTarget: { HasSkin: true, IsUsing: false, SkinID: 52801, DynamicState: 1 } });
  assert.deepEqual(view.sent, [52801], 'the pick must be applied once');
  assert.equal(view.closeSelectSkinId, 52801, 'the native pending selection is submitted');
  assert.equal(win.closed, true, 'the picker closes after a skin is chosen');
  assert.equal(win.closes, 1);
  assert.equal(view.commits, 1, 'destroy must not repeat the SET request');
  assert.equal(view.destroyed, true);
  assert.equal(h.tabs.status().mounted, false, 'the destroyed window is no longer mounted');
}

// 15. Empty native size branches never close a tabbed window; explicit close stays available.
{
  const h = harness();
  h.tabs.attach();
  const { view, win } = h.open(389);
  h.flush();
  h.tabs.selectTab('peer:528');
  assert.deepEqual(ids(view.list), [52801, 52802]);
  // Native refreshes reach Close() through calculateSize/CLOSE_SKIN_WINDOW while the page is being
  // rebuilt; the guard must treat those as side effects of the switch.
  view.list = [];
  view.calculateSize();
  win.calculateSize(1);
  assert.equal(win.closes, 0, 'the picker must survive the switch');
  assert.equal(win.closed, false);
  // Outside the guard a real close still works (countdown, close button, next pick).
  win.Close();
  assert.equal(win.closes, 1, 'explicit closes are never suppressed, including just after a tab click');
}

// 16. An empty bucket during a rebuild does not close the window (native emits CLOSE there).
{
  const h = harness();
  h.tabs.attach();
  const { view, win } = h.open(389);
  h.flush();
  h.manager.GetGeneralSkinIncludeHide = () => null;
  view.initSkinListData();
  assert.equal(win.closes, 0, 'the empty page must not kill the picker');
  assert.equal(win.closed, false);
}

// 17. The bar always ends up on top, after the close button and any content the window adds.
{
  const h = harness();
  h.tabs.attach();
  const { win } = h.open(389);
  h.flush();
  const bar = win.children.find(node => node.name === 'xcSkinTabs');
  assert.ok(win.closeBtn, 'tab mode needs a close button to leave the window');
  assert.equal(win.children[win.children.length - 1], bar, 'bar must be the top child');
}

// 18. Switching tabs repeatedly keeps working and never stacks bars.
{
  const h = harness();
  h.tabs.attach();
  const { view, win } = h.open(389);
  h.flush();
  h.tabs.selectTab('peer:528');
  h.tabs.selectTab('self');
  h.tabs.selectTab('peer:528');
  h.flush();
  assert.deepEqual(ids(view.list), [52801, 52802]);
  assert.deepEqual(view.rendered, [52801, 52802]);
  assert.equal(win.children.filter(node => node.name === 'xcSkinTabs').length, 1);
  const bar = win.children.find(node => node.name === 'xcSkinTabs');
  assert.equal(win.children[win.children.length - 1], bar);
  // A deferred click rebuild must not leave a stale sprite in the strip.
  assert.equal(bar.children.length, 3, 'clip + two arrows');
}

// 19. Re-opening the same window instance for another general rebuilds the pages and the list.
{
  const h = harness();
  h.tabs.attach();
  const { win, view } = h.open(389);
  h.flush();
  h.tabs.selectTab('peer:528');
  win.enterWindow(528);
  h.flush();
  assert.deepEqual(h.tabs.status().tabs.map(tab => tab.label), ['默认', '吴苋']);
  assert.equal(h.tabs.status().activeTab, 'self', 'every open starts on the 默认 page');
  assert.deepEqual(ids(view.list), [52801, 52802], 'the list follows the general that was opened');
  assert.equal(win.children.filter(node => node.name === 'xcSkinTabs').length, 1);
}

// 20. Opening a general without sibling versions removes the bar built for the previous one.
{
  const h = harness();
  h.tabs.attach();
  const { win } = h.open(389);
  h.flush();
  assert.ok(win.children.some(node => node.name === 'xcSkinTabs'), 'bar exists for the grouped general');
  win.enterWindow(65534);
  h.flush();
  assert.equal(win.children.filter(node => node.name === 'xcSkinTabs').length, 0);
  assert.equal(win.children.length, 0, 'tab mode also removes the extra close button it owned');
}

// 21. Closing and reopening mounts again, even when the window is not yet visible to the manager.
{
  const h = harness();
  h.tabs.attach();
  const first = h.open(389);
  h.flush();
  first.view.itemClick({ currentTarget: { HasSkin: true, IsUsing: false, SkinID: 38902, DynamicState: 0 } });
  assert.equal(first.win.closed, true, 'the pick closes the picker');
  assert.equal(h.tabs.status().mounted, false);
  const second = h.open(389, false);
  assert.ok(second.win.children.some(node => node.name === 'xcSkinTabs'),
    'the prototype hook mounts as soon as enterWindow runs, before the manager reports the window');
  h.publish();
  h.flush();
  const bar = second.win.children.find(node => node.name === 'xcSkinTabs');
  assert.ok(bar, 'the reopened picker must get its bar back');
  assert.equal(bar.visible, true);
  assert.deepEqual(ids(second.view.list), [38901, 38902], 'reopen starts on the 默认 page');
  assert.equal(h.tabs.status().activeTab, 'self');
}

// 22. Closing with the close button and reopening immediately keeps the tab bar as well.
{
  const h = harness();
  h.tabs.attach();
  const first = h.open(389);
  h.flush();
  first.win.Close();
  assert.equal(first.win.closed, true);
  assert.equal(h.tabs.status().mounted, false);
  const second = h.open(389);
  assert.equal(second.win.children.filter(node => node.name === 'xcSkinTabs').length, 1,
    'the bar is attached immediately on the second open');
  h.flush();
  const bars = second.win.children.filter(node => node.name === 'xcSkinTabs');
  assert.equal(bars.length, 1, 'exactly one bar after reopening');
  assert.deepEqual(ids(second.view.list), [38901, 38902]);
}

// 23. An actual tab CLICK is contained; stable tab nodes switch the native panel synchronously.
{
  const h = harness(); h.tabs.attach();
  const { win, view } = h.open(389); h.flush();
  const bar = win.children.find(node => node.name === 'xcSkinTabs');
  const clip = bar.children[0], strip = clip.children[0], peer = strip.children[1];
  assert.equal(peer.dispatch('mousedown').stopped, true);
  assert.equal(peer.dispatch('mouseup').stopped, true);
  assert.equal(peer.click().stopped, true, 'tab input must not escape into native window handlers');
  assert.deepEqual(ids(view.list), [52801, 52802], 'the tab rebuilds the content without destroying itself');
  h.flush();
  assert.deepEqual(view.rendered, [52801, 52802]);
  assert.equal(win.closed, false); assert.equal(view.destroyed, undefined);
  assert.equal(win.skinTotal, 2);
  assert.equal(view.commits, 0, 'tabs must never submit a skin');
}

// 24. A native size callback more than a second after switching still cannot kill the picker.
{
  const h = harness(); h.tabs.attach();
  const { win, view } = h.open(389); h.flush(); h.tabs.selectTab('peer:528');
  const now = Date.now;
  try {
    Date.now = () => now() + 5000;
    win.calculateSize(1); view.list = []; view.calculateSize();
  } finally { Date.now = now; }
  assert.equal(win.closed, false, 'empty refresh protection must not expire');
  view.RefreshShareSkin();
  assert.deepEqual(view.rendered, [52801, 52802]);
}

// 25. A bucket disappearing after the bar was built is empty, not a fallback to the merged list.
{
  const h = harness(); h.tabs.attach();
  const { win, view } = h.open(389); h.flush();
  const get = h.manager.getOnlineSKinListByGeneralId;
  h.manager.getOnlineSKinListByGeneralId = function (id, a, b) {
    return id === 528 ? null : get.call(this, id, a, b);
  };
  h.tabs.selectTab('peer:528');
  assert.deepEqual(view.rendered, []); assert.deepEqual(view.list, []);
  assert.equal(win.closed, false);
  h.tabs.selectTab('self'); assert.deepEqual(view.rendered, [38901, 38902]);
}

// 26. Cards bound by native updateContent use the captured click handler and native destroy sends once.
{
  const h = harness(); h.tabs.attach();
  const { win, view } = h.open(389); h.flush(); h.tabs.selectTab('peer:528');
  const card = view.itemList.find(item => item.SkinID === 52802);
  card.click();
  assert.equal(win.closes, 1); assert.equal(view.destroyed, true);
  assert.deepEqual(view.sent, [52802]); assert.equal(view.commits, 1);
  assert.equal(view.closeSelectDynamicState, 1);
  assert.equal(view.realGeneralID, 389, 'tabs never replace the real general being dressed');
}

// 27. A retained old click callback must not switch a newly opened picker.
{
  const h = harness(); h.tabs.attach();
  const first = h.open(389); h.flush();
  const bar = first.win.children.find(node => node.name === 'xcSkinTabs');
  const retained = bar.children[0].children[0].children[1].handlers.click[0];
  bar.children[0].children[0].children[1].click();
  first.win.Close();
  const second = h.open(389); h.flush();
  retained({ stopPropagation() {} });
  assert.equal(h.tabs.status().activeTab, 'self');
  assert.deepEqual(second.view.rendered, [38901, 38902]);
}

// 28. Switching back to a short page resets scroll without sending a request or losing the bar.
{
  const h = harness(); h.tabs.attach();
  const { win, view } = h.open(389); h.flush();
  view.pannel.vScrollBar.value = 900;
  h.tabs.selectTab('peer:528'); h.tabs.selectTab('self');
  assert.equal(view.pannel.vScrollBar.value, 0); assert.equal(view.commits, 0);
  assert.equal(win.children.filter(node => node.name === 'xcSkinTabs').length, 1);
}

// 29. The full peer bucket, including many rows, renders inside the same picker.
{
  const all = Array.from({ length: 23 }, (_, i) => vo(52801 + i, 528));
  const h = harness({ skins: { 389: [vo(38901, 389)], 528: all } });
  h.tabs.attach(); const { win, view } = h.open(389); h.flush();
  h.tabs.selectTab('peer:528');
  assert.deepEqual(view.rendered, ids(all));
  assert.equal(view.itemCtn, 4); assert.equal(win.closed, false);
  h.tabs.selectTab('self'); view.calculateSize();
  assert.deepEqual(view.rendered, [38901]); assert.equal(win.closed, false);
}

// 30. A native close event from a captured handler, not the public instance method, commits once.
{
  const h = harness(); h.tabs.attach();
  const { win, view } = h.open(389); h.flush();
  const captured = Object.getPrototypeOf(Object.getPrototypeOf(view)).itemClick.bind(view);
  captured({ currentTarget: { HasSkin: true, IsUsing: false, SkinID: 38902, DynamicState: 1 } });
  assert.equal(win.closes, 1); assert.deepEqual(view.sent, [38902]);
}

// 31. Native window-manager/countdown closes remain immediate even just after a tab switch.
{
  const h = harness(); h.tabs.attach();
  const { win, view } = h.open(389); h.flush(); h.tabs.selectTab('peer:528');
  win.Close();
  assert.equal(win.closes, 1); assert.deepEqual(view.sent, []);
  h.tabs.ensureMounted(); assert.equal(h.tabs.status().mounted, false);
}

// 32. Detach preserves later wrappers and reattach rebuilds a working bar on the same live view.
{
  const h = harness(); h.tabs.attach();
  const { win, view } = h.open(389); h.flush();
  const previous = view.updateContent;
  let updates = 0;
  const later = view.updateContent = function () { updates++; return previous.apply(this, arguments); };
  h.tabs.detach();
  assert.equal(view.updateContent, later);
  h.tabs.attach(); h.flush(); h.tabs.selectTab('peer:528');
  assert.ok(updates > 0); assert.deepEqual(view.rendered, [52801, 52802]);
  assert.equal(win.children.filter(node => node.name === 'xcSkinTabs').length, 1);
}

// 33. First open and close/reopen need no watcher or delayed mount.
{
  const h = harness({ noTimers: true }); h.tabs.attach();
  const first = h.open(389);
  assert.deepEqual(first.view.rendered, [38901, 38902], 'the first render is already filtered');
  h.tabs.selectTab('peer:528'); first.win.Close();
  const second = h.open(528);
  assert.deepEqual(second.view.rendered, [52801, 52802]);
  assert.ok(second.win.children.some(node => node.name === 'xcSkinTabs'));
}

// 34. Switching paints the same tab sprites and does not redo native initBg/resize/animation.
{
  const h = harness({ noTimers: true }); h.tabs.attach();
  const { win, view } = h.open(389);
  const bar = win.children.find(node => node.name === 'xcSkinTabs'), strip = bar.children[0].children[0];
  const peer = strip.children[1], own = strip.children[0], backgrounds = win.backgroundUpdates;
  peer.click(); own.click(); peer.click();
  assert.equal(strip.children[1], peer); assert.equal(peer.destroyed, false);
  assert.equal(win.backgroundUpdates, backgrounds, 'switching must not resize the native background');
  assert.deepEqual(view.rendered, [52801, 52802]); assert.equal(win.closed, false);
}

// 35. Two enterWindow calls within 300ms are distinct opens, including the same general.
{
  const h = harness(); h.tabs.attach(); const { win, view } = h.open(389); h.flush();
  h.tabs.selectTab('peer:528'); win.enterWindow(389);
  assert.equal(h.tabs.status().activeTab, 'self');
  assert.deepEqual(view.rendered, [38901, 38902]);
  h.tabs.selectTab('peer:528'); win.enterWindow(528);
  assert.deepEqual(h.tabs.status().tabs.map(tab => tab.label), ['默认', '吴苋']);
  assert.deepEqual(view.rendered, [52801, 52802]);
}

// 36. GetWindow can return a loading window without a selectView; native enterWindow finishes setup.
{
  const h = harness({ noTimers: true }); h.tabs.attach();
  const { win, view } = h.open(528, true, 'SelectSkinWindow', true);
  assert.equal(win.selectView, null); assert.equal(win.isShowWait, true);
  win.loading = false; win.loadResComplete();
  assert.deepEqual(view.rendered, [52801, 52802]);
  assert.equal(win.children.filter(node => node.name === 'xcSkinTabs').length, 1);
}

// 37. Explicit enabling catches up a picker already on screen exactly once.
{
  const h = harness({ noTimers: true }); const { win, view } = h.open(389);
  h.tabs.attach();
  assert.deepEqual(view.rendered, [38901, 38902]);
  h.tabs.ensureMounted(); h.tabs.ensureMounted();
  assert.equal(win.children.filter(node => node.name === 'xcSkinTabs').length, 1);
  h.tabs.selectTab('peer:528'); assert.deepEqual(view.rendered, [52801, 52802]);
}

// 38. Show-skin pickers use the same manager entry and retain the native close submission.
{
  const h = harness({ windowName: 'ModifyShowSkinWindow', noTimers: true }); h.tabs.attach();
  const { win, view } = h.open(389); h.tabs.selectTab('peer:528');
  assert.deepEqual(view.rendered, [52801, 52802]); assert.equal(win.closed, false);
  view.itemList.find(item => item.SkinID === 52801).click();
  assert.equal(win.closes, 1); assert.deepEqual(view.sent, [52801]);
}

// 39. Separate picker instances retain their own page and scope without a shared mounted bag.
{
  const h = harness({ noTimers: true }); h.tabs.attach();
  const first = h.open(389), second = h.open(528, true, 'ModifyShowSkinWindow');
  const peer = first.win.children.find(node => node.name === 'xcSkinTabs').children[0].children[0].children[1];
  peer.click();
  assert.deepEqual(first.view.rendered, [52801, 52802]);
  assert.deepEqual(second.view.rendered, [52801, 52802]);
  second.view.RefreshShareSkin(); assert.deepEqual(second.view.rendered, [52801, 52802]);
  first.win.Close(); assert.equal(second.win.closed, false);
}

// 40. Start from the actual seat skin button, rather than assuming a picker name in the test.
{
  const h = harness({ noTimers: true }); h.tabs.attach();
  let opened;
  const onSKinClick = new Function('Bri', 'Zni', 'Lm', 'dt',
    'return ({' + native.seat.onSKinClick + '}).onSKinClick')(
      { I: () => ({ IsReplaying: false }) }, { IsPvpRoguelike: false }, {},
      { I: () => ({ A(name, id) { opened = h.open(id, true, name); } }) });
  const seatUI = { isZhu: true, seat: { GeneralId: 389, General2Id: 528 } };
  onSKinClick.call(seatUI);
  const { win, view } = opened;
  assert.equal(win.name, 'ChangeSkinWindow', 'the live in-game skin button opens ChangeSkinWindow');
  const bar = win.children.find(node => node.name === 'xcSkinTabs');
  assert.ok(bar, 'the actual in-game picker must have its tabs on the first open');
  bar.children[0].children[0].children[1].click();
  assert.deepEqual(view.rendered, [52801, 52802]);
  assert.equal(win.closed, false); assert.equal(view.commits, 0);
  view.itemList.find(item => item.SkinID === 52802).click();
  assert.equal(win.closes, 1); assert.deepEqual(view.sent, [52802]);
  seatUI.isZhu = false; onSKinClick.call(seatUI);
  assert.equal(opened.win.name, 'ChangeSkinWindow');
  assert.deepEqual(opened.view.rendered, [52801, 52802]);
  assert.deepEqual(h.tabs.status().tabs.map(tab => tab.label), ['默认', '吴苋']);
}

// 41. Enabling on an already-open ChangeSkinWindow uses the same scoped page and native close button.
{
  const h = harness({ noTimers: true });
  const { win, view } = h.open(389, true, 'ChangeSkinWindow');
  const close = win.closeBtn;
  h.tabs.attach();
  assert.ok(win.children.some(node => node.name === 'xcSkinTabs'));
  h.tabs.selectTab('peer:528'); assert.deepEqual(view.rendered, [52801, 52802]);
  h.tabs.detach();
  assert.equal(win.closeBtn, close, 'the existing native close button is retained');
  assert.equal(win.children.filter(node => node.name === 'xcSkinTabs').length, 0);
  assert.equal(win.closed, false);
}

// 42. The actual ChangeSkinWindow registration also works on first asynchronous resource loading.
{
  const h = harness({ noTimers: true }); h.tabs.attach();
  const { win, view } = h.open(389, true, 'ChangeSkinWindow', true);
  assert.equal(win.selectView, null);
  win.loading = false; win.loadResComplete();
  assert.ok(win.children.some(node => node.name === 'xcSkinTabs'));
  assert.deepEqual(view.rendered, [38901, 38902]);
  h.tabs.selectTab('peer:528'); assert.deepEqual(view.rendered, [52801, 52802]);
  assert.equal(win.closed, false); win.Close();
  assert.deepEqual(view.sent, []);
  const again = h.open(389, true, 'ChangeSkinWindow');
  assert.ok(again.win.children.some(node => node.name === 'xcSkinTabs'));
  assert.deepEqual(again.view.rendered, [38901, 38902]);
}

process.stdout.write('native-skin-tabs: 42 groups of assertions passed (native seat button/registered pickers/open/list/render/click/destroy)\n');

// Optional catalog audit. Real local tables are inputs, not prerequisites for the regular suite.
// Enumerate every character and every visible page through all three registered native windows.
if (process.argv.includes('--coverage')) {
  const fs = require('node:fs'), path = require('node:path');
  const offset = process.argv.indexOf('--coverage');
  const characterFile = process.argv[offset + 1], skinFile = process.argv[offset + 2], reportFile = process.argv[offset + 3];
  assert(characterFile && skinFile && reportFile, '--coverage requires character JSON, skin JSON and output JSON');
  const characters = JSON.parse(fs.readFileSync(characterFile, 'utf8')).GameCharacters.character;
  const catalog = JSON.parse(fs.readFileSync(skinFile, 'utf8')).generalskin.items.item;
  const excluded = row => /Poker|New3V3|New1V1|GuoZhan|ShiBing|Race|DDZ|Boss|TEST/.test(row.d || '') ||
    +row.a >= 60000 || (+row.a >= 4000 && +row.a < 5000) || (+row.a >= 8000 && +row.a < 9000);
  const eligible = characters.filter(row => !excluded(row));
  const names = new Map(), byID = new Map(characters.map(row => [+row.a, row]));
  for (const row of eligible) {
    if (!names.has(row.b)) names.set(row.b, []);
    names.get(row.b).push(+row.a);
  }
  const expectedGroups = new Map([...names].filter(([, ids]) => ids.length > 1));
  const actualGroups = new Map(groups.map(row => [row[0], row.slice(1)]));
  assert.equal(actualGroups.size, expectedGroups.size, 'group table covers all eligible repeated names');
  const sorted = values => values.slice().sort((a, b) => a - b);
  for (const [name, group] of expectedGroups) assert.deepEqual(sorted(actualGroups.get(name)), sorted(group), name);
  const grouped = new Set(groups.flatMap(row => row.slice(1)));
  for (const id of grouped) assert.equal(labels[id], (byID.get(id).ai || '') + byID.get(id).b, 'label ' + id);
  const skins = {}, parents = {};
  for (const row of catalog) (skins[+row.b] ||= []).push({ ...vo(+row.a, +row.b), IsSkinShow: row.i !== 1 });
  for (const row of characters) parents[+row.a] = String(row.v || '').split(';').map(Number).filter(id => id > 0);
  const h = harness({ skins, parents, nativeBuckets: true, noTimers: true }); h.tabs.attach();
  const summary = { characterRows: characters.length, skinRows: catalog.length, eligibleCharacters: eligible.length,
    groups: groups.length, groupedIDs: grouped.size, windowNames: Object.keys(native.pickers),
    windowsChecked: 0, tabbedCharacters: 0, tabbedWindows: 0, pagesChecked: 0, picksChecked: 0,
    missingLabels: 0, missingGroups: 0, examples: [], noPeerSkin: [], assumptions: [
      'Local character/skin snapshot; all catalog skins are available in the bucket provider and owned in the test.',
      'Native window/list/render/click methods run; resource downloads, account ownership, time gates and visual game rendering are not verified.'
    ] };
  const exampleNames = new Set(['曹操', '刘备', '赵云', '马超', '周瑜', '荀彧', '荀攸', '关羽', '黄月英']);
  for (const row of characters) {
    const id = +row.a, planned = h.tabs.plan(id);
    if (planned.length > 1) summary.tabbedCharacters++;
    else if (grouped.has(id)) summary.noPeerSkin.push({ id, label: labels[id], nativeSkins: (skins[id] || []).length });
    if (exampleNames.has(row.b) && !row.ai && grouped.has(id)) {
      summary.examples.push({ id, name: row.b, tabs: planned.map(tab => ({ label: tab.label,
        skins: tab.key === 'self' ? [id, ...(parents[id] || [])].reduce((n, key) => n + (skins[key] || []).length, 0)
          : new Set(tab.ids.flatMap(key => ids(skins[key] || []))).size })) });
    }
    for (const name of summary.windowNames) {
      const nativeOutside = ids(h.manager.GetOnlineSKinList(id) || []);
      const { win, view } = h.open(id, true, name);
      summary.windowsChecked++;
      if (planned.length <= 1) {
        assert(!win.children.some(node => node.name === 'xcSkinTabs'), 'no artificial tabs for ' + id);
        if (nativeOutside.length) { assert.deepEqual(sorted(view.rendered), sorted(nativeOutside), 'native list ' + id); win.Close(); }
        else assert.equal(win.closed, true, 'native empty bucket close ' + id);
        continue;
      }
      summary.tabbedWindows++;
      const bar = win.children.find(node => node.name === 'xcSkinTabs');
      assert(bar, name + ' must show tabs for ' + id);
      const strip = bar.children[0].children[0];
      for (const [index, tab] of planned.entries()) {
        strip.children[index].click();
        const sourceIDs = tab.key === 'self' ? [id, ...(parents[id] || [])] : tab.ids;
        const expected = sourceIDs.flatMap(key => ids(skins[key] || []));
        const expectedIDs = tab.key === 'self' ? expected : [...new Set(expected)];
        assert.deepEqual(sorted(view.rendered), sorted(expectedIDs), name + ' ' + id + '/' + tab.label);
        assert.equal(win.closed, false, 'tab keeps picker ' + id);
        assert.equal(view.commits, 0, 'tab must not commit ' + id);
        assert.equal(view.realGeneralID, id, 'target general remains unchanged ' + id);
        summary.pagesChecked++;
      }
      const pickIndex = planned.findIndex(tab => tab.key !== 'self');
      strip.children[pickIndex].click();
      const item = view.itemList.find(item => item.SkinID);
      assert(item, 'nonempty peer skin ' + id); const skinID = item.SkinID;
      item.click();
      assert.equal(win.closes, 1); assert.deepEqual(view.sent, [skinID]);
      summary.picksChecked++;
    }
  }
  h.tabs.detach();
  fs.mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(summary, null, 2) + '\n');
  process.stdout.write('native-skin-coverage: ' + summary.windowsChecked + ' windows, ' + summary.tabbedWindows +
    ' tabbed windows, ' + summary.pagesChecked + ' pages, ' + summary.picksChecked + ' picks passed\n');
}
