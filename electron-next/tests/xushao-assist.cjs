// Browser DOM + actual archived OL methods; all game sends are intercepted.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
const assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const source = fs.readFileSync(path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8').replace(/\r\n/g, '\n');
const fixture = require('./fixtures/xushao-native-20261110.json');
const start = source.indexOf('  function D() {'), end = source.indexOf('    ];', start);
const strings = vm.runInNewContext(source.slice(source.indexOf('[', start), end + 5));
const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/', standard = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const decode = text => Buffer.from([...text].map(c => alphabet.includes(c) ? standard[alphabet.indexOf(c)] : c).join(''), 'base64').toString('utf8');
const template = strings.filter(text => text.length > 3000).map(decode).find(text => text.includes('id="wallpaperContainer"'));
const layout = source.slice(source.indexOf('  const settingsLayout = (() => {'), source.indexOf('  // 仅拥有秒杀区域'));
assert(source.includes('xuShaoAssist.start();\n    xuShaoAssist.mount();'));
assert(source.includes('xuShaoAssist.dispose();'));
const manifest = require('../release-files.json');
for (const file of ['src/adapters/xushao-client.js', 'src/features/xushao-assist.js']) assert(manifest.files.some(row => row.source === 'electron-next/' + file));
function browserTest() {
  let count = 0;
  const check = (name, fn) => { fn(); count++; results.push(name); };
  const assert = (value, message) => { if (!value) throw Error(message || 'assertion failed'); };
  const equal = (a, b) => assert(JSON.stringify(a) === JSON.stringify(b), JSON.stringify([a, b]));
  const results = [], sends = [], logs = [], intervals = new Map(), timeouts = new Map(), callbacks = [];
  let now = 0, nextId = 0, board = null, scene = {}, operation = true;
  Date.now = () => now;
  const clock = { innerWidth: window.innerWidth, innerHeight: window.innerHeight,
    setTimeout(fn, ms) { const id = ++nextId; timeouts.set(id, { fn, at: now + ms }); callbacks.push(fn); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval(fn, ms) { const id = ++nextId; intervals.set(id, { fn, ms, at: now + ms }); return id; },
    clearInterval(id) { intervals.delete(id); } };
  function advance(ms) {
    const end = now + ms;
    for (;;) {
      const tasks = [...timeouts].map(([id, task]) => ({ id, task, kind: 'timeout' }))
        .concat([...intervals].map(([id, task]) => ({ id, task, kind: 'interval' }))).filter(entry => entry.task.at <= end)
        .sort((a, b) => a.task.at - b.task.at || a.id - b.id);
      if (!tasks.length) break;
      const { id, task, kind } = tasks[0]; now = task.at;
      if (kind === 'timeout') timeouts.delete(id); else task.at += task.ms;
      task.fn();
    }
    now = end;
  }
  const entries = fixture.entries;
  const AW = { I: () => ({ GetGameSpellsExtendsVoByIdDif: () => ({ Str: fixture.background }),
    GetPingJianDataById: id => entries.find(row => row.id === id),
    GetPingJianDatas: () => ({ breakForEach(fn) { for (const row of entries) if (fn(0, row)) break; } }) }) };
  const nativeSource = fixture.random + ';' + fixture.match + ';' + fixture.result + ';' + fixture.board + ';return Zds;';
  const context = { SelfSeatIndex: 0, IsViewer: false, CanOperationInGame: () => operation, IsViewerOrReplay: () => false };
  const nativeTweens = [], nativeTimers = [];
  class EggNode {
    constructor() { this.alpha = 1; this.visible = true; }
    pos(x, y) { this.x = x; this.y = y; }
    InitEffect() { this.alpha = 1; }
    playEffect() {}
  }
  const nativeLaya = { Tween: { to(node, pos, ms, ease, done) { nativeTweens.push(done); } },
    Handler: { create(owner, fn, args) { return () => fn.apply(owner, args); } },
    timer: { once(ms, owner, fn) { nativeTimers.push(() => fn.call(owner)); } } };
  const Native = Function('l_s', 'AW', 'V2t', 'Xmt', 'y1t', 'console', 'gO', 'E$t', 'mNt', 'Laya', nativeSource)(class {}, AW, context,
    { SHILUN: 3911 }, { SendRoleSpellOptRep: (...args) => sends.push(args) }, { log() {} }, EggNode, EggNode, { GetRes: name => name }, nativeLaya);
  const Cell = Function('$jt', 'Laya', fixture.cell + ';return P3t;')(class {}, { Event: { STOPPED: 'stopped' } });
  function cell(index) {
    const ui = Object.create(Cell.prototype);
    Object.assign(ui, { idx: index, width: 40, height: 40, selectBg: {}, textField: {}, topTxt: { visible: true }, hideTex: { visible: false, alpha: 1 },
      plays: 0, playInEff() { this.plays++; }, playGrayEff() { this.grayPlays = (this.grayPlays || 0) + 1; }, playSelectInEff() {}, playMulSlcEff() {}, InitSkin(name) { this.skin = name; } });
    ui.UpdateUI(5); return ui;
  }
  function makeBoard() {
    const w = Object.create(Native.prototype);
    Object.assign(w, { row: 6, seat: { IsSelf: true, Index: 0 }, currentSkill: { ID: 3911 }, Skill: { ID: 3911 },
      inited: true, visible: true, parent: {}, width: 795, height: 420, confirm_btn: { visible: true, enabled: true },
      firstIds: [], selectIds: [], preSelectIds: [], matchedIds: [], matchedDatas: [], helpDatas: [], helpIds: [],
      hideIds: [], preHideIds: [], hasThroughIdxs: [], items: [], updateData: [],
      contentSprite: { width: 795, height: 420, addChild() {} }, playSound() {},
      updateItemUI() {}, updateSkillList() {}, localToGlobal(point) { return { x: point.x + 40, y: point.y + 60 }; } });
    w.initDatas(123, [2, 0, 4, 190, 0, 5, 23, 497, 0, 0]);
    w.items = Array.from({ length: 36 }, (_, index) => cell(index));
    w.items[0].UpdateUI(4); return w;
  }
  const manager = { WindowInstanceDict: { get: () => board } };
  const laya = { get gamescene() { return scene; }, class: name => ({ WindowManager: manager, GameContext: context })[name], win: () => board };
  const client = createClient({ getLaya: () => laya, getEngine: () => ({ Point: class { constructor(x, y) { this.x = x; this.y = y; } }, stage: { width: 1000, height: 700 } }), document });
  const saved = new Map(), storage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
  const dragListeners = new Set();
  clock.addEventListener = (type, fn, options) => { dragListeners.add(fn); window.addEventListener(type, fn, options); };
  clock.removeEventListener = (type, fn, options) => { dragListeners.delete(fn); window.removeEventListener(type, fn, options); };
  function create() { return createFeature({ window: clock, document, storage, client, placeControl: settingsLayout.place, refreshLayout() {}, log: (...args) => logs.push(args) }); }
  let feature = create();
  const toggle = () => document.getElementById('xcXuShaoToggle');
  const panel = () => document.getElementById('xcXuShaoCombinations');
  const handle = () => document.getElementById('xcXuShaoDragHandle');
  const setToggle = enabled => { toggle().checked = enabled; toggle().dispatchEvent(new Event('change', { bubbles: true })); };
  function pointer(target, type, x, y, id = 1, button = 0) { target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, button, bubbles: true, cancelable: true })); }
  settingsLayout.mount(); board = makeBoard(); feature.start();
  const originalSelection = board.selectIds;
  for (const method of ['onItemDragStart','onItemMouseIn','onItemDragEnd','checkSelectIds']) board[method] = () => { throw Error('native mutation attempted'); };
  check('default off has no polling or UI', () => { assert(!toggle().checked); equal(intervals.size, 0); assert(!panel()); });
  check('single switch remains immediately before automatic sign-in without a settings gear', () => {
    feature.mount(); feature.start(); const row = document.getElementById('xcXuShaoControl');
    assert(+row.style.order + 1 === +document.getElementById('autoSignSwitch').closest('.xc-settings-flow-item').style.order);
    equal(document.querySelectorAll('#xcXuShaoToggle').length, 1); assert(!row.querySelector('.xc-settings-gear'));
  });
  setToggle(true);
  check('enabling displays all horizontal and vertical hints without a dialog', () => {
    assert(panel().textContent.includes('乱击') && panel().textContent.includes('散谣'));
    assert(panel().textContent.includes('横向：1行1列 → 1行5列') && panel().textContent.includes('纵向：1行6列 → 4行6列'));
    assert(!document.getElementById('xcXuShaoSettings')); assert(!feature.openSettings); assert(!client.connect);
  });
  check('long-running hints never call native selection or submission', () => { advance(30000); equal(sends.length, 0); assert(board.selectIds === originalSelection); equal(timeouts.size, 0); });
  check('different merits use distinct colors consistently across their cells and legend', () => {
    const rows = client.combinations(client.read()); equal(rows.map(row => row.arcId), [190, 497]);
    assert(rows[0].color !== rows[1].color);
    for (const row of rows) for (const index of row.indices) {
      equal(board.items[index].type, index === 0 ? 4 : 5); equal(board.items[index].topTxt.color, row.color);
      equal(board.items[index].labelColors, Array(5).fill(row.color).join(','));
    }
    const words = panel().querySelectorAll('strong');
    for (const [i, row] of rows.entries()) { const probe = document.createElement('span'); probe.style.color = row.color;
      equal(words[i].style.color, probe.style.color); equal(words[i].nextElementSibling.style.color, probe.style.color); }
    equal(board.items[6].type, 5);
    const plays = board.items[2].plays; advance(600); equal(board.items[2].plays, plays);
  });
  check('native refresh is followed by hint repaint without overwriting selection', () => {
    board.items[0].UpdateUI(5); board.items[2].UpdateUI(5); board.selectIds = [1]; board.items[1].UpdateUI(2); advance(200);
    equal(board.items[0].type, 5); board.items[0].UpdateUI(4);
    equal(board.items[2].type, 5); equal(board.items[1].type, 2); equal(board.items[1].topTxt.color, '#8B701D');
    board.selectIds = []; board.items[1].UpdateUI(5); advance(200); equal(board.items[1].type, 5);
  });
  check('native completed state takes priority over hint blue', () => {
    board.matchedIds = [2]; board.items[2].UpdateUI(1); advance(200);
    equal(board.items[2].type, 1); equal(board.items[2].topTxt.color, '#8B701D');
    board.matchedIds = []; board.items[2].UpdateUI(5); advance(200); equal(board.items[2].type, 5);
  });
  check('native selection remains intact while hints refresh', () => { board.selectIds.push(1); board.items[1].UpdateUI(2); advance(400); equal(board.selectIds, [1]); equal(sends.length, 0); });
  let initial;
  check('dragging header moves and saves hint panel', () => {
    initial = panel().getBoundingClientRect(); pointer(handle(), 'pointerdown', initial.left + 20, initial.top + 10);
    pointer(handle(), 'pointermove', initial.left + 140, initial.top + 90);
    equal(parseFloat(panel().style.left), initial.left + 120); equal(parseFloat(panel().style.top), initial.top + 80);
    pointer(window, 'pointerup', initial.left + 140, initial.top + 90);
    equal(dragListeners.size, 0); assert(feature.getOptions().position); assert(JSON.parse(saved.get('xcXuShaoAssist')).position);
  });
  check('refreshing results keeps moved position and header identity', () => {
    const pos = [panel().style.left, panel().style.top], old = handle(); board.matchedIds = [0]; advance(400);
    equal([panel().style.left, panel().style.top], pos); assert(handle() === old); assert(!panel().textContent.includes('乱击')); assert(panel().textContent.includes('散谣'));
  });
  check('text body does not start a drag', () => {
    const pos = panel().style.left; pointer(panel().lastChild, 'pointerdown', 10, 10); pointer(window, 'pointermove', 90, 90); pointer(window, 'pointerup', 90, 90);
    equal(panel().style.left, pos); equal(dragListeners.size, 0);
  });
  check('drag is clamped to the viewport and pointer cancellation removes listeners', () => {
    pointer(handle(), 'pointerdown', 100, 100); pointer(window, 'pointermove', -5000, -5000); pointer(window, 'pointercancel', -5000, -5000);
    equal(panel().style.left, '8px'); equal(panel().style.top, '8px'); equal(dragListeners.size, 0);
  });
  check('right-click does not start dragging', () => { pointer(handle(), 'pointerdown', 100, 100, 1, 2); equal(dragListeners.size, 0); });
  check('turning off during drag removes DOM, polling and listeners', () => {
    pointer(handle(), 'pointerdown', 20, 20); const oldMove = [...dragListeners][0]; setToggle(false);
    assert(!panel()); equal(intervals.size, 0); equal(dragListeners.size, 0);
    oldMove(new PointerEvent('pointermove', { clientX: 900, clientY: 500, pointerId: 1 })); assert(!panel());
  });
  check('saved position is restored when re-enabled', () => { setToggle(true); equal(panel().style.left, '8px'); equal(panel().style.top, '8px'); });
  check('native hidden and help states display without mutating board', () => {
    board.hideIds = [5]; board.helpIds = [5]; board.items[5].UpdateUI(3); board.items[5].Hide = true;
    advance(200); assert(panel().textContent.includes('含遮挡格') && panel().textContent.includes('已获帮助'));
    equal(board.hideIds, [5]); equal(board.helpIds, [5]);
    equal(board.items[5].type, 3); equal(board.items[5].skin, 'pingjian_item_bg_help');
    equal(board.items[5].topTxt.color, client.combinations(client.read()).find(row => row.arcId === 497).color); equal(board.items[5].topTxt.visible, true);
  });
  check('disabling restores native help and normal colors but preserves native first highlight', () => {
    const ui = board.items[5]; setToggle(false); equal(ui.topTxt.color, '#5D5B60'); equal(ui.type, 3);
    equal(board.items[2].type, 5); equal(board.items[1].type, 2);
    equal(board.items[0].type, 4); equal(ui.topTxt.visible, false); setToggle(true);
  });
  check('overwritten words disappear and stop highlighting', () => {
    board.gridSkillIdArr[11] = 102; advance(200); assert(panel().textContent.includes('（0）'));
    equal(board.items[11].type, 5); equal(board.items[5].topTxt.color, '#5D5B60');
  });
  check('diagonal words are never displayed', () => {
    board = makeBoard(); board.WordsStr.fill('囧'); board.gridSkillIdArr.fill(0);
    for (const [i, text] of [...'街亭之殇'].entries()) { board.WordsStr[i * 7] = text; board.gridSkillIdArr[i * 7] = 236; }
    advance(200); equal(client.combinations(client.read()).length, 0);
  });
  check('closing board during drag removes owned listeners and panel', () => {
    pointer(handle(), 'pointerdown', 20, 20); board.parent = null; advance(200); assert(!panel()); equal(dragListeners.size, 0);
  });
  check('new scene re-reads current window and ignores detached header events', () => {
    board = makeBoard(); advance(200); const old = handle(); scene = {}; board = makeBoard(); advance(200);
    pointer(old, 'pointerdown', 20, 20); equal(dragListeners.size, 0); assert(panel());
  });
  check('externally removed hint panel rebuilds and releases active drag listeners', () => {
    const old = panel(); pointer(handle(), 'pointerdown', 20, 20); old.remove(); advance(200);
    assert(panel() && panel() !== old); equal(dragListeners.size, 0);
  });
  check('viewer and help windows do not display hints', () => {
    context.IsViewer = true; advance(200); assert(!panel()); context.IsViewer = false;
    board.seat.IsSelf = false; advance(200); assert(!panel()); board.seat.IsSelf = true; advance(200); assert(panel());
  });
  check('rebuild replaces control without allowing old checkbox to act', () => {
    const old = toggle(); document.getElementById('xcXuShaoControl').remove(); feature.mount();
    old.checked = false; old.dispatchEvent(new Event('change', { bubbles: true })); assert(feature.getOptions().enabled);
    equal(document.querySelectorAll('#xcXuShaoToggle').length, 1);
  });
  check('dispose makes old poll callbacks inert across restart', () => {
    const oldPoll = [...intervals.values()][0].fn; feature.dispose(); feature.start(); const oldPanel = panel(); oldPoll(); assert(panel() === oldPanel);
    feature.dispose(); equal(intervals.size, 0); equal(dragListeners.size, 0); assert(!panel());
  });
  check('legacy auto preference can only enable read-only hints', () => {
    saved.set('xcXuShaoAssist', JSON.stringify({ enabled: true, mode: 'auto', delay: 1 })); feature = create(); feature.start(); advance(30000);
    assert(panel()); equal(sends.length, 0); equal(timeouts.size, 0); equal(feature.getOptions(), { enabled: true, position: null });
    setToggle(false); equal(JSON.parse(saved.get('xcXuShaoAssist')), { enabled: false, position: null }); feature.dispose();
  });
  board = makeBoard(); board.updateItemUI = Native.prototype.updateItemUI;
  feature = create(); feature.start(); setToggle(true);
  check('interference branch does not create nodes, Tween or delayed callbacks', () => {
    board.hideIds = [5]; board.updateItemUI();
    equal(board.eggHideSps[5], null); equal(board.eggHideEffs[5], null);
    equal(board.items[5].hideTex.alpha, 0); equal(board.items[5].topTxt.visible, true);
    equal(board.hideIds, [5]); equal(nativeTweens.length, 0); equal(nativeTimers.length, 0); equal(sends.length, 0);
  });
  check('late egg callbacks and direct animation entries cannot enqueue new work', () => {
    const effect = new EggNode(); board.eggHideEffs[5] = effect;
    board.playEggEff(5, effect); board.onEggEffStoped(5, effect);
    equal(effect.alpha, 0); equal(nativeTweens.length, 0); equal(nativeTimers.length, 0);
    equal(board.items[5].topTxt.visible, true);
  });
  check('repeated help and interference updates do not restart cell entrance animations', () => {
    board.helpIds = [11]; const cell = board.items[11], normal = board.items[2];
    const entrance = normal.plays, gray = cell.grayPlays || 0;
    for (let i = 0; i < 100; i++) { board.updateItemUI(); advance(200); }
    equal(normal.plays, entrance); equal(normal.type, 5); equal(normal.topTxt.color, '#60C5FF');
    equal(cell.type, 3); equal(cell.grayPlays || 0, gray); equal(cell.topTxt.color, client.combinations(client.read()).find(row => row.arcId === 497).color);
    equal(nativeTweens.length, 0); equal(nativeTimers.length, 0);
  });
  check('help flights are blocked while real completed-skill animation remains native', () => {
    const original = board.playMultiGridEff; setToggle(false);
    let completed = 0; board.playMultiGridEff = () => { completed++; return 73; }; setToggle(true);
    board.helpDatas = [{ SpellId: 236 }]; board.matchedDatas = [];
    board.playMultiGridEff(236); equal(completed, 0);
    board.matchedDatas = [{ SpellId: 236 }]; equal(board.playMultiGridEff(236), 73); equal(completed, 1);
    setToggle(false); board.playMultiGridEff = original; setToggle(true);
  });
  check('selection and completed states still update immediately under the effect gates', () => {
    board.selectIds = [11]; board.updateItemUI(); equal(board.items[11].type, 2);
    board.selectIds = []; board.matchedIds = [11]; board.updateItemUI(); equal(board.items[11].type, 1);
    assert(board.items[11].grayPlays > 0); equal(sends.length, 0);
    board.matchedIds = []; board.helpIds = []; board.updateItemUI();
  });
  check('disabling restores alpha, render cache and native window methods', () => {
    setToggle(false); equal(board.items[5].hideTex.alpha, 1); equal(board.eggHideEffs[5].alpha, 1);
    equal(board.preHideIds, []); assert(board.updateItemUI === Native.prototype.updateItemUI);
    assert(!Object.prototype.hasOwnProperty.call(board, 'playEggEff'));
  });
  check('uninstall preserves a later native wrapper and old callbacks remain native', () => {
    setToggle(true); const ours = board.onEggEffStoped;
    function later(...args) { return ours.apply(this, args); }
    board.onEggEffStoped = later; setToggle(false); assert(board.onEggEffStoped === later);
    board.eggHideSps[5] = new EggNode(); const effect = board.eggHideEffs[5];
    ours.call(board, 5, effect); equal(effect.alpha, 1); equal(nativeTimers.length, 1);
    while (nativeTimers.length) nativeTimers.shift()(); equal(board.eggHideSps[5].alpha, 1);
  });
  feature.dispose();
  // Run the actual archived playGrayEff, including its native effect name.
  function helpBoard() {
    board = makeBoard(); board.updateItemUI = Native.prototype.updateItemUI;
    const ui = board.items[11], effect = { alpha: 1, plays: 0, offAll() {},
      InitEffect(path, name) { this.animation = name; }, playEffect() { this.plays++; } };
    ui.spEff = effect; ui.playGrayEff = Cell.prototype.playGrayEff;
    const frame = client.read(); client.hideEggs(frame);
    board.helpIds = [11]; board.updateItemUI();
    equal(ui.type, 3); equal(effect.plays, 0); equal(effect.alpha, 0);
    return { owner: board, ui, effect, frame };
  }
  check('closing assistance restores the skipped native help loop exactly once', () => {
    const { ui, effect } = helpBoard();
    client.clearEggs(); client.clearHighlights();
    equal(effect.animation, 'gezi_hui_loop'); equal(effect.plays, 1); equal(effect.alpha, 1);
    equal(ui.type, 3); equal(ui.topTxt.color, '#5D5B60');
    client.clearEggs(); ui.UpdateUI(3); equal(effect.plays, 1);
  });
  check('restoring help uses and retains a later installed wrapper', () => {
    const { ui, effect } = helpBoard(); const ours = ui.playGrayEff; let laterCalls = 0;
    const later = function (...args) { laterCalls++; return ours.apply(this, args); };
    ui.playGrayEff = later; client.clearEggs(); client.clearHighlights();
    assert(ui.playGrayEff === later); equal(laterCalls, 1); equal(effect.animation, 'gezi_hui_loop');
  });
  check('cleanup does not replace selected or completed animations with help', () => {
    for (const type of [2, 1]) {
      const { ui, effect } = helpBoard();
      board[type === 2 ? 'selectIds' : 'matchedIds'] = [11]; board.updateItemUI();
      const plays = effect.plays; client.clearEggs(); client.clearHighlights();
      equal(ui.type, type); equal(effect.plays, plays); equal(effect.alpha, 1);
    }
  });
  check('cleanup skips detached, destroyed, replaced cells and changed board generations', () => {
    for (const reason of ['window', 'scene', 'words', 'detached', 'destroyed', 'cell', 'effect']) {
      const { ui, effect } = helpBoard();
      if (reason === 'window') board = makeBoard();
      if (reason === 'scene') scene = {};
      if (reason === 'words') board.WordsStr = board.WordsStr.slice();
      if (reason === 'detached') board.parent = null;
      if (reason === 'destroyed') ui.destroyed = true;
      if (reason === 'cell') board.items[11] = cell(11);
      if (reason === 'effect') ui.spEff = { ...effect };
      client.clearEggs(); client.clearHighlights(); equal(effect.plays, 0);
    }
  });
  check('enabling on existing native help loops only restores alpha without replaying', () => {
    board = makeBoard(); board.updateItemUI = Native.prototype.updateItemUI;
    board.helpIds = [11]; board.updateItemUI();
    const ui = board.items[11], effect = ui.spEff = { alpha: 0.7 };
    const plays = ui.grayPlays; client.hideEggs(client.read()); equal(effect.alpha, 0);
    client.clearEggs(); equal(effect.alpha, 0.7); equal(ui.grayPlays, plays);
  });
  function colorBoard() {
    board = makeBoard(); board.updateItemUI = Native.prototype.updateItemUI;
    const frame = client.read(), rows = client.combinations(frame);
    client.hideEggs(frame); client.highlight(frame, rows);
    return { frame, rows };
  }
  check('remaining merit keeps its color through completion, toggles and candidate return', () => {
    const { rows } = colorBoard(), color = rows[1].color;
    board.matchedIds = [0]; board.updateItemUI();
    equal(client.combinations(client.read()).length, 1); equal(board.items[11].topTxt.color, color);
    client.clearEggs(); client.clearHighlights();
    let frame = client.read(); client.hideEggs(frame); client.highlight(frame, client.combinations(frame));
    equal(board.items[11].topTxt.color, color);
    board.matchedIds = []; board.updateItemUI();
    equal(client.combinations(client.read()).map(row => row.color), rows.map(row => row.color));
    client.clearEggs(); client.clearHighlights();
  });
  check('changing applied colors never records an old helper color as the native snapshot', () => {
    const { frame, rows } = colorBoard(); const ui = board.items[11];
    for (const color of ['#258A61', '#E47735', '#7860C7']) {
      client.highlight(frame, rows.map(row => ({ ...row, color })));
      equal(ui.topTxt.color, color);
    }
    client.clearEggs(); client.clearHighlights();
    equal(ui.topTxt.color, '#665973'); equal(ui.labelColors, Array(5).fill('#665973').join(','));
    equal(board.items[0].topTxt.color, '#60C5FF');
  });
  check('multi-color repaint survives native updates without animation restarts and preserves gold', () => {
    const { rows } = colorBoard(); const ui = board.items[11], plays = ui.plays;
    for (let i = 0; i < 100; i++) board.updateItemUI();
    equal(ui.plays, plays); equal(ui.topTxt.color, rows[1].color);
    board.selectIds = [11]; board.updateItemUI(); equal(ui.topTxt.color, '#8B701D');
    board.selectIds = []; board.matchedIds = [11]; board.updateItemUI(); equal(ui.topTxt.color, '#8B701D');
    client.clearEggs(); client.clearHighlights(); equal(ui.topTxt.color, '#8B701D');
  });
  check('releasing colors preserves a later independent color owner', () => {
    colorBoard(); const ui = board.items[11]; ui.topTxt.color = '#123456'; ui.labelColors = 'external-colors';
    client.clearEggs(); client.clearHighlights(); equal(ui.topTxt.color, '#123456'); equal(ui.labelColors, 'external-colors');
  });
  check('a reused window resets merit assignments when its word generation changes', () => {
    const { rows } = colorBoard(); client.clearEggs(); client.clearHighlights();
    board.WordsStr = board.WordsStr.slice(); board.matchedIds = [0];
    const next = client.combinations(client.read()); equal(next.length, 1); equal(next[0].color, rows[0].color);
    assert(next[0].color !== rows[1].color);
  });
  check('egg text hiding is native while off, revealed on enabling, and restored on closing', () => {
    board = makeBoard(); const ui = board.items[5]; board.hideIds = [5]; ui.Hide = true;
    equal(ui.topTxt.visible, false); assert(!Object.hasOwn(ui, 'Hide'));
    client.hideEggs(client.read()); equal(ui.topTxt.visible, true); equal(ui.textField.visible, false);
    ui.Hide = true; equal(ui.topTxt.visible, true); equal(board.hideIds, [5]);
    client.clearEggs(); equal(ui.topTxt.visible, false); assert(!Object.hasOwn(ui, 'Hide'));
    ui.Hide = false; ui.Hide = true; equal(ui.topTxt.visible, false);
  });
  check('native egg timer queued before enabling cannot hide text after taking over', () => {
    board = makeBoard(); board.hideIds = [5]; const ui = board.items[5], effect = new EggNode();
    board.eggHideSps[5] = new EggNode(); board.eggHideEffs[5] = effect;
    board.onEggEffStoped(5, effect); equal(nativeTimers.length, 1);
    client.hideEggs(client.read()); nativeTimers.shift()();
    equal(ui.topTxt.visible, true); equal(ui.textField.visible, false); equal(board.eggHideSps[5].alpha, 0);
    client.clearEggs(); equal(ui.topTxt.visible, false);
  });
  check('egg cleanup preserves completed visibility and a cleared interference result', () => {
    for (const reason of ['matched', 'cleared']) {
      board = makeBoard(); board.updateItemUI = Native.prototype.updateItemUI; board.hideIds = [5];
      client.hideEggs(client.read()); const ui = board.items[5];
      if (reason === 'matched') board.matchedIds = [5]; else board.hideIds = [];
      board.updateItemUI(); client.clearEggs(); client.clearHighlights(); equal(ui.topTxt.visible, true);
    }
  });
  check('egg Hide accessor cleanup preserves later wrappers and leaves them native while off', () => {
    board = makeBoard(); board.hideIds = [5]; client.hideEggs(client.read()); const ui = board.items[5];
    const ours = Object.getOwnPropertyDescriptor(ui, 'Hide').set; let calls = 0;
    const later = function (value) { calls++; ours.call(this, value); };
    Object.defineProperty(ui, 'Hide', { configurable: true, set: later });
    client.clearEggs(); assert(Object.getOwnPropertyDescriptor(ui, 'Hide').set === later);
    equal(ui.topTxt.visible, false); ui.Hide = true; equal(ui.topTxt.visible, false); equal(calls, 2);
  });
  check('stale egg setters cannot reveal text in a new board generation or replacement cell', () => {
    board = makeBoard(); board.hideIds = [5]; client.hideEggs(client.read()); const ui = board.items[5];
    board.WordsStr = board.WordsStr.slice(); ui.Hide = true; equal(ui.topTxt.visible, false);
    client.clearEggs();
    board = makeBoard(); board.hideIds = [5]; client.hideEggs(client.read()); const old = board.items[5];
    board.items[5] = cell(5); old.Hide = true; equal(old.topTxt.visible, false);
    client.clearEggs(); equal(board.items[5].topTxt.visible, true);
  });
  board = makeBoard();
  check('failed storage write still permits disabling and cleanup', () => {
    feature.start(); setToggle(true); storage.setItem = () => { throw Error('disk full'); }; setToggle(false);
    assert(!panel()); assert(!toggle().checked); equal(intervals.size, 0); feature.dispose();
  });
  document.getElementById('xcXuShaoTestResult').textContent = JSON.stringify({ passed: count, results });
  if (preview) { storage.setItem = (k, v) => saved.set(k, v); feature.start(); setToggle(true); }
}

const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert(browser);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-xushao-test-')), file = path.join(dir, 'test.html');
const html = template.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/url\([^)]*\)/g, 'none').replace(/\bsrc="https?:[^"]*"/g, '');
const preview = process.argv.includes('--preview');
const js = 'const preview=' + preview + ';const fixture=' + JSON.stringify(fixture) + ';const createClient=' + require('../src/adapters/xushao-client').toString() + ';const createFeature=' + require('../src/features/xushao-assist').toString() + ';' + layout + '(' + browserTest.toString() + ')();';
fs.writeFileSync(file, '<!doctype html><meta charset="utf-8"><canvas width="1000" height="700" style="position:fixed;inset:0;width:1000px;height:700px;pointer-events:none"></canvas><div id="iframe-source">' + html + '</div><pre id="xcXuShaoTestResult">PENDING</pre><script>try{' + js.replace(/<\/script/gi, '<\\/script') + '}catch(e){document.getElementById("xcXuShaoTestResult").textContent=JSON.stringify({error:e.stack})}</script>');
const output = execFileSync(browser, ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-background-networking', '--virtual-time-budget=1000', '--window-size=1100,900', '--user-data-dir=' + path.join(dir, 'profile'), ...(preview ? ['--screenshot=' + path.join(dir, 'preview.png')] : []), '--dump-dom', 'file:///' + file.replace(/\\/g, '/')], { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 8e6, stdio: ['ignore', 'pipe', 'pipe'] });
fs.writeFileSync(path.join(dir, 'dom.html'), output);
const match = output.match(/<pre id="xcXuShaoTestResult">([^<]+)<\/pre>/); assert(match, 'result missing: ' + dir);
const result = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
assert(result.passed, JSON.stringify(result) + ' artifacts: ' + dir);
process.stdout.write('PASS ' + result.passed + ' Xu Shao native/browser checks\nArtifacts: ' + dir + '\n');
