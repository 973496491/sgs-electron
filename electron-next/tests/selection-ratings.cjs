const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/selection-ratings-native-20261118.json');
const target = process.argv[2] || path.join(__dirname, '../resources/daxiaochao.user.js');
const createClient = require(process.argv[2] ? path.join(path.dirname(target), 'modules/adapters/selection-ratings-client.js') : '../src/adapters/selection-ratings-client.js');
const createFeature = require(process.argv[2] ? path.join(path.dirname(target), 'modules/features/selection-ratings.js') : '../src/features/selection-ratings.js');
const source = fs.readFileSync(target, 'utf8');
let passed = 0;
function test(name, run) { run(); passed++; process.stdout.write('PASS ' + name + '\n'); }
class Node {
  constructor(width = 94, height = 131) {
    Object.assign(this, { width, height, x: 0, y: 0, visible: true, destroyed: false, children: [], parent: null });
  }
  addChild(node) { node.removeSelf(); node.parent = this; this.children.push(node); return node; }
  removeSelf() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); this.parent = null; return this; }
  destroy() { this.destroyed = true; for (const child of [...this.children]) child.destroy(); this.removeSelf(); }
}
function harness({ pending = false, debug = true, missingContext = false, store = new Map(), storageFailure = false } = {}) {
  const intervals = new Map(), timeouts = new Map(), logs = [], wins = new Map(); let seq = 0, getCalls = 0;
  const events = new Map(); let debugEnabled = debug;
  const host = { setInterval(fn) { intervals.set(++seq, fn); return seq; }, clearInterval(id) { intervals.delete(id); },
    setTimeout(fn) { timeouts.set(++seq, fn); return seq; }, clearTimeout(id) { timeouts.delete(id); },
    addEventListener(type, fn) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(fn); },
    removeEventListener(type, fn) { events.get(type)?.delete(fn); },
    dispatchEvent(event) { for (const fn of events.get(event.type) || []) fn(event); } };
  const stage = new Node(1220, 732);
  const game = { IsFigureMode: true, SelfFigure: 2, SelfSeat: { Figure: 2, FixedViewId: 1 }, Seats: [] };
  const manager = { GetWindow(name) { getCalls++; return wins.get(name); }, GetWindowData(name) { return wins.get(name); } };
  const originalGet = manager.GetWindow;
  const decoded = { character: { WuJiangs: { CharGrade: fixture.ratings } } };
  const data = { current: pending ? undefined : decoded.character.WuJiangs.CharGrade, load: { phase: pending ? 'idle' : 'published' } };
  let managerReady = true, contextReady = !missingContext;
  const engine = { Text: Node, Browser: { window: {} } }, room = { isDouDiZhu: false, isGuoZhan: false, isSWJG: false, isRoguelike1v1: false };
  const facade = { class(name) { return name === 'WindowManager' ? managerReady && manager : name === 'GameContext' ? contextReady && game || undefined : null; } };
  const client = createClient({ getLaya: () => facade, getEngine: () => engine, getGrades: () => data.current,
    getLoadState: () => data.load });
  const feature = createFeature({ window: host, client, isDebug: () => debugEnabled,
    storage: { getItem: key => store.get(key) ?? null, setItem(key, value) { if (storageFailure) throw Error('storage-denied'); store.set(key, value); } },
    log: line => { if (debugEnabled) logs.push(line); } });
  const sandbox = { Zni: game, Lm: { ZhuGong: 1 }, Laya: { Tween: { to(node, values) { Object.assign(node, values); } } } };
  vm.createContext(sandbox);
  const setter = vm.runInContext('Object.getOwnPropertyDescriptor(({' + fixture.cardSetter + '}),"Card").set', sandbox);
  const nativeLayout = vm.runInContext('({' + fixture.layout + '}).resetGeneralCardUiPos', sandbox);
  const firstHand = vm.runInContext('Object.getOwnPropertyDescriptor(({' + fixture.firstHand + '}),"FirstHand").get', sandbox);
  const nativeManager = { selfSeatIndex: 0, GetSeat() { return game.SelfSeat; }, get seats() { return game.Seats; } };
  for (const [name, getter] of [['SelfSeat', 'selfSeatGetter'], ['Seats', 'seatsGetter']])
    Object.defineProperty(nativeManager, name, { get: vm.runInContext('Object.getOwnPropertyDescriptor(({' + fixture.fallbackEvidence[getter] + '}),"' + name + '").get', sandbox) });
  function card(id, y = 49) {
    const item = new Node(); item.y = y; item.draws = 0;
    Object.assign(item, { clearSpGeneral() {}, creatSpIds() {}, showGeneralTipHandler() {},
      UpdateCardFace() { this.draws++; }, ClearMateShare() {}, measure() {} });
    Object.defineProperty(item, 'Card', { configurable: true, get() { return this.theCard; }, set: setter });
    item.Card = { CardId: id }; return item;
  }
  function win(name = 'SelectGeneralWindow', ids = [716, 757, 1]) {
    const view = new Node(688, 394); view.name = name; view.visible = false; view.generalUis = [];
    for (const id of ids) { const c = card(id); view.addChild(c); view.generalUis.push(c); }
    Object.assign(view, { maxCol: 4, startX: 20, startSecondX: 20, resetGeneralCardUiPos: nativeLayout,
      selfFigure: game.SelfFigure, manager: nativeManager,
      enterWindow() { this.entered = (this.entered || 0) + 1; },
      Show() { this.visible = true; stage.addChild(this); this.enterWindow(); return 'shown'; },
      Close() { this.visible = false; this.removeSelf(); return 'closed'; },
      ShowGenerals() {}, onTabClick() {} });
    wins.set(name, view); return view;
  }
  function show(view) { feature.start(); assert.equal(manager.GetWindow(view.name), view); assert.equal(view.Show(), 'shown'); tick(); }
  function tick() { for (const fn of [...intervals.values()]) fn(); }
  function label(c) { return c.children.find(n => n.name === 'xcSelectionRating'); }
  return { host, game, stage, wins, manager, originalGet, client, feature, data, intervals, timeouts, logs, card, win, show, tick, label,
    nativeLayout, firstHand, nativeManager, facade, engine, room, store, events, getCalls: () => getCalls, setManagerReady(value) { managerReady = value; },
    setContextReady(value) { contextReady = value; },
    setDebug(value) { debugEnabled = value; } };
}
test('实际配置加载导出语句保留CharGrade引用，无额外网络请求', () => {
  const begin = source.indexOf('(Object[l(177)](w, {');
  const end = source.indexOf('              }),', begin);
  assert(begin > 0 && end > begin);
  const expression = source.slice(begin, end + '              })'.length).slice(1);
  const context = { Object, l: id => id === 177 ? 'assign' : '', w: {}, c: { 'character.sgs': { WuJiangs: { CharGrade: fixture.ratings } } } };
  for (const name of ['L$1','D$1','x$1','M$1','I$1','A$1','h$1','p','j$1','U$1','S$1','b$1','Z$1','N$1','H$1','K','J$1','O','V$1']) context[name] = {};
  vm.createContext(context); vm.runInContext(expression, context);
  assert.equal(context.w.generalGrades, fixture.ratings);
  assert(source.includes('getGrades: () => window.XC?.initMap?.generalGrades'));
  assert(source.includes('selectionRatings.start();') && source.includes('selectionRatings.dispose();'));
  assert(source.includes('"[选将评分] " + message, false, "debug"'));
});
test('首开真实Card setter候选显示当前身份7/10，缺评分0/10', () => {
  const h = harness(), w = h.win(); h.show(w);
  assert.deepEqual(w.generalUis.map(c => h.label(c).text), ['7/10', '0/10', '5/10']);
  assert(w.generalUis.every(c => c.draws === 1));
  assert.equal(h.label(w.generalUis[0]).mouseEnabled, false);
  assert(h.label(w.generalUis[0]).y >= w.generalUis[0].height);
});
test('live配置晚到：原标签0/10更新为7/10，不创建第二个标签', () => {
  const h = harness({ pending: true }), w = h.win(); h.show(w); const first = h.label(w.generalUis[0]);
  assert.equal(first.text, '0/10'); h.data.current = fixture.ratings; h.tick();
  assert.equal(first.text, '7/10'); assert.equal(w.generalUis[0].children.length, 1);
});
test('原生setter换将和SP替换后，按实际ID改分并保留原生绘制', () => {
  const h = harness(), w = h.win(); h.show(w); const c = w.generalUis[0];
  c.Card = { CardId: 1 }; h.tick(); assert.equal(h.label(c).text, '5/10');
  c.Card = { CardId: 299 }; h.tick(); assert.equal(h.label(c).text, '6/10'); assert.equal(c.draws, 3);
});
test('主公/地主同为1时先按玩法区分，农民3不误取反贼分', () => {
  const h = harness(), w = h.win(); h.game.SelfFigure = 1; h.show(w);
  assert.equal(h.label(w.generalUis[2]).text, '3/10'); h.game.IsDouDuZhu2023 = true; h.tick();
  assert.equal(h.label(w.generalUis[2]).text, '2/10'); h.game.SelfFigure = 3; h.tick();
  assert.equal(h.label(w.generalUis[2]).text, '4/10');
});
test('原生FirstHand判定先后手；空座位默认true时仍显示0/10', () => {
  const h = harness(), w = h.win('SelectNewPaiWeiGeneralWindow', [1]);
  h.game.IsPaiwei = true; h.game.IsFigureMode = false;
  Object.defineProperty(h.game, 'FirstHand', { get: h.firstHand }); h.show(w);
  assert.equal(h.game.FirstHand, true); assert.equal(h.label(w.generalUis[0]).text, '0/10');
  h.game.Seats = [h.game.SelfSeat, { FixedViewId: 2, IsLegalOperable: true }]; h.tick();
  assert.equal(h.label(w.generalUis[0]).text, '4/10');
  h.game.SelfSeat.FixedViewId = 3; h.tick(); assert.equal(h.label(w.generalUis[0]).text, '5/10');
});
test('未知身份/不支持模式/原生零分不借用最高分', () => {
  const h = harness(), w = h.win('SelectGeneralWindow', [6, 205]); h.game.SelfFigure = 0;
  h.game.SelfSeat.Figure = 0; h.show(w); assert.equal(h.label(w.generalUis[0]).text, '0/10');
  h.game.SelfFigure = 1; h.tick(); assert.equal(h.label(w.generalUis[0]).text, '0/10');
  h.game.IsFigureMode = false; h.tick(); assert.equal(h.label(w.generalUis[1]).text, '0/10');
});
test('不显示队友页、主公展示和未显示的候选', () => {
  const h = harness(), w = h.win(); w.generalUis[1].TeamMateCard = true; w.generalUis[2].visible = false;
  const lord = h.card(1); w.addChild(lord); w.zhugongCard = lord; h.show(w);
  assert(h.label(w.generalUis[0])); assert(!h.label(w.generalUis[1])); assert(!h.label(w.generalUis[2])); assert(!h.label(lord));
});
test('真实原生双排布局留评分行，重复刷新不累加，重排/关闭恢复', () => {
  const h = harness(), w = h.win('SelectGeneralWindow', [1,1,1,1,1,1,1,1]);
  for (const key of ['lessHuanJiangLabel','countdownTimer']) { w[key] = new Node(); w.addChild(w[key]); }
  w.lessHuanJiangLabel.y = 328; w.countdownTimer.y = 345; w.resetGeneralCardUiPos(false); h.show(w);
  const bottom = w.generalUis[0].y + 131 + 1 + 16;
  assert(w.generalUis[4].y > bottom); const applied = w.generalUis[4].y;
  for (let i = 0; i < 100; i++) h.tick(); assert.equal(w.generalUis[4].y, applied);
  w.resetGeneralCardUiPos(false); assert.equal(w.generalUis[4].y, applied);
  assert(w.lessHuanJiangLabel.y > w.generalUis[4].y + 131 + 17);
  w.Close(); assert.equal(w.generalUis[4].y, 187); assert.equal(w.lessHuanJiangLabel.y, 328);
  assert.equal(h.intervals.size, 0); assert(w.generalUis.every(c => !h.label(c)));
});
test('重复start/开窗不重复标签；源替换和新候选可更新', () => {
  const h = harness(), w = h.win(); h.show(w); h.feature.start(); w.enterWindow(); h.tick();
  assert.equal(w.generalUis[0].children.length, 1); assert.equal(h.intervals.size, 1);
  h.data.current = [{ id: 716, Grade_4: 6.1 }]; h.tick(); assert.equal(h.label(w.generalUis[0]).text, '7/10');
  const next = h.card(716); w.addChild(next); w.generalUis.push(next); h.tick(); assert.equal(h.label(next).text, '7/10');
});
test('控制接口停用/重启、Exit后调用不重装', () => {
  const h = harness(), w = h.win(); h.show(w); h.feature.setEnabled(false);
  assert(!h.label(w.generalUis[0])); assert.equal(h.intervals.size, 0);
  h.feature.setEnabled(true); h.tick(); assert.equal(h.label(w.generalUis[0]).text, '7/10');
  h.feature.dispose(); h.feature.setEnabled(false); h.feature.setEnabled(true); assert.equal(h.manager.GetWindow, h.originalGet);
});
test('武将评分首次默认开启，关闭持久化并在新实例保持关闭', () => {
  const h = harness(), w = h.win(); h.show(w); assert.equal(h.feature.isEnabled(), true);
  assert.equal(h.feature.setEnabled(false), true); assert.equal(h.store.get('xcGeneralRatingsEnabled'), 'false');
  const next = harness({ store: h.store }), w2 = next.win(); next.show(w2);
  assert.equal(next.feature.isEnabled(), false); assert(!next.label(w2.generalUis[0])); assert.equal(next.intervals.size, 0);
  assert.equal(next.feature.setEnabled(true), true); next.tick(); assert.equal(next.label(w2.generalUis[0]).text, '7/10');
  assert.equal(next.store.get('xcGeneralRatingsEnabled'), 'true');
});
test('偏好保存失败不改变启用状态，非法存储值沿用默认且不擅自写入', () => {
  const h = harness({ storageFailure: true }), w = h.win(); h.show(w);
  assert.equal(h.feature.setEnabled(false), false); assert.equal(h.feature.isEnabled(), true);
  assert.equal(h.label(w.generalUis[0]).text, '7/10');
  const store = new Map([['xcGeneralRatingsEnabled','broken']]), broken = harness({ store }); broken.feature.start();
  assert.equal(broken.feature.isEnabled(), true); assert.equal(store.get('xcGeneralRatingsEnabled'), 'broken');
});
test('保存关闭状态时仍能处理诊断请求，停用不被误报核心未启动', () => {
  const h = harness({ store: new Map([['xcGeneralRatingsEnabled','false']]) }); h.feature.start();
  const detail = { source: 'debug-open', handled: false }; h.host.dispatchEvent({ type: 'xc:selection-ratings-diagnose', detail });
  assert.equal(detail.handled, true); const line = h.logs.find(line => line.startsWith('诊断 '));
  assert.equal(JSON.parse(line.slice(3)).enabled, false); assert.equal(h.intervals.size, 0); h.feature.dispose();
});
test('晚窗口管理器重试有界，Exit后旧回调不能重启', () => {
  const h = harness(); h.setManagerReady(false); h.feature.start(); assert.equal(h.timeouts.size, 1);
  const old = [...h.timeouts.values()][0]; h.feature.dispose(); old();
  assert.equal(h.timeouts.size, 0); assert.equal(h.manager.GetWindow, h.originalGet);
});
test('卸载不覆盖后装包装器；旧包装层失活后不再建立评分', () => {
  const h = harness(), w = h.win(); h.show(w);
  const previous = h.manager.GetWindow; function later() { return previous.apply(this, arguments); }
  h.manager.GetWindow = later; h.feature.dispose(); assert.equal(h.manager.GetWindow, later);
  const next = h.win('SelectGeneralWindow', [716]); h.manager.GetWindow(next.name); next.Show(); h.tick();
  assert(!h.label(next.generalUis[0])); assert.equal(h.intervals.size, 0);
});
test('异常不吞原生异常，销毁窗口清理标签与计时器', () => {
  const h = harness(), w = h.win(); h.show(w); w.destroy();
  assert.equal(h.intervals.size, 0); h.feature.dispose(); assert.equal(h.manager.GetWindow, h.originalGet);
  const b = harness(); b.manager.GetWindow = () => { throw new Error('native-error'); }; b.feature.start();
  assert.throws(() => b.manager.GetWindow('SelectGeneralWindow'), /native-error/); b.feature.dispose();
});
test('调试晚打开：实际debug-open派发即时快照，不依赖丢弃的首帧日志', () => {
  const h = harness({ debug: false, pending: true }), w = h.win(); h.show(w); h.tick();
  assert.equal(h.logs.length, 0); h.setDebug(true);
  const a = source.indexOf('      const ratingRequest = { source: "debug-open", handled: false };');
  const b = source.indexOf('      // 用于区分', a); assert(a > 0 && b > a);
  const fallback = [];
  vm.runInNewContext(source.slice(a, b), { window: h.host,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    appendLocalSkinDebugLine: (...args) => fallback.push(args) });
  assert.equal(fallback.length, 0);
  const line = h.logs.find(line => line.startsWith('诊断 ')); assert(line);
  const report = JSON.parse(line.slice(3)); assert.equal(report.current.source.type, 'undefined');
  assert.equal(report.windows[0].cards[0].reason, 'source-missing'); assert.equal(report.current.source.load.phase, 'idle');
});
test('数据缺失、空表、ID映射失效、武将缺项有不同诊断', () => {
  const h = harness({ pending: true }), w = h.win(); h.show(w);
  assert.equal(h.client.read(w).entries[0].reason, 'source-missing');
  h.data.current = []; assert.equal(h.client.read(w).entries[0].reason, 'source-empty');
  h.data.current = [{ a: 716, Grade_4: 7 }]; const mismatched = h.client.diagnose(w);
  assert.equal(mismatched.source.rows, 1); assert.equal(mismatched.source.indexedRows, 0); assert(mismatched.source.firstRowKeys.includes('a'));
  h.data.current = fixture.ratings; assert.equal(h.client.read(w).entries[1].reason, 'general-missing');
});
test('身份/玩法快照与零分原因，原始九维只取当前候选', () => {
  const h = harness(), w = h.win('SelectGeneralWindow', [6]); h.game.SelfFigure = 1; h.show(w);
  let report = h.client.diagnose(w); assert.equal(report.cards[0].reason, 'grade-zero');
  assert.equal(report.game.selfFigure, 1); assert.equal(report.game.figureMode, true); assert.equal(report.dimension, 3);
  assert.equal(report.cards[0].grades.length, 9);
  h.game.IsDouDuZhu2023 = true; h.game.SelfFigure = 3; report = h.client.diagnose(w);
  assert.equal(report.dimension, 9); assert.equal(report.game.ddz2023, true); assert.equal(report.cards[0].raw, 4);
});
test('配置解出却未导出和解析失败阶段可见，未变状态不刷屏', () => {
  const h = harness({ pending: true }), w = h.win(); h.show(w); const before = h.logs.length;
  for (let i = 0; i < 20; i++) h.tick(); assert.equal(h.logs.length, before);
  h.data.load = { phase: 'failed', characterRows: 565, characterHasGrades: true, failedAt: 'character-decoded', error: 'probe-error' };
  h.tick(); const line = h.logs.filter(line => line.startsWith('链路 ')).at(-1);
  assert(line.includes('probe-error') && line.includes('character-decoded') && line.includes('565'));
  const after = h.logs.length; for (let i = 0; i < 20; i++) h.tick(); assert.equal(h.logs.length, after);
});
test('调试关闭不采样，Exit撤销诊断监听且不创建窗口/发游戏操作', () => {
  const h = harness({ debug: false }), w = h.win(); h.show(w);
  const count = h.getCalls(); assert.equal(h.feature.diagnose(), null);
  assert.equal(h.getCalls(), count); assert.equal(h.logs.length, 0);
  h.feature.dispose(); const detail = { source: 'debug-open', handled: false }; h.setDebug(true);
  h.host.dispatchEvent({ type: 'xc:selection-ratings-diagnose', detail }); assert.equal(detail.handled, false);
  assert.equal(h.events.get('xc:selection-ratings-diagnose').size, 0);
});

test('复现现场：评分表已读但GameContext缺失，军八用原生窗口身份恢复主公分', () => {
  const h = harness({ missingContext: true }); h.game.SelfFigure = h.game.SelfSeat.Figure = 1;
  const w = h.win('SelectGeneralWindow', [15, 1, 475, 740]); w.figurePart = new Node(); h.show(w);
  assert.deepEqual(w.generalUis.map(c => h.label(c).text), ['4/10', '3/10', '10/10', '0/10']);
  const report = h.client.diagnose(w); assert.equal(report.game.contextSource, 'selection-window');
  assert.equal(report.game.nativeAvailable, false); assert.equal(report.dimension, 3);
});
test('上下文出口独立校验：真实门面首个错误候选不能挡住引擎原生出口', () => {
  const h = harness(); h.game.GetModeType = () => 1; h.game.GetGroupID = () => 1;
  const box = {}; vm.createContext(box); vm.runInContext(fs.readFileSync(path.join(__dirname, '../../doc/彩虹表.js'), 'utf8') + ';globalThis.d=DAXIAOCHAO_RAINBOW_TABLE.tables._0x3812.all;', box);
  const a = source.indexOf('    class(n, t, e) {'), b = source.indexOf('    get(n, t, e = !1, i) {', a);
  const scope = { _0x47c207: n => box.d[n], unsafeWindow: { GameContext: {} }, window: {}, Laya: h.engine };
  h.engine.Browser.window.GameContext = h.game; vm.createContext(scope);
  const realClass = vm.runInContext('({' + source.slice(a, b) + '}).class', scope);
  const receiver = { classes: {}, caller: Object.assign(() => null, { has: () => false, method() {} }) };
  assert.equal(realClass.call(receiver, 'GameContext'), undefined);
  const original = h.facade.class; h.facade.class = function(name) { return name === 'GameContext' ? realClass.call(receiver, name) : original(name); };
  const w = h.win(); h.show(w); assert.equal(h.label(w.generalUis[0]).text, '7/10');
  assert.equal(h.client.diagnose(w).game.contextSource, 'engine-export');
});
test('没有全局上下文：斗地主按专属窗口区分地主/农民，不混成主公/反贼', () => {
  const h = harness({ missingContext: true }); h.game.SelfFigure = h.game.SelfSeat.Figure = 1;
  const w = h.win('SelectGeneralDdz2023Win', [1, 15]); h.show(w);
  assert.deepEqual(w.generalUis.map(c => h.label(c).text), ['2/10', '4/10']);
  w.selfFigure = h.game.SelfSeat.Figure = 3; h.tick();
  assert.deepEqual(w.generalUis.map(c => h.label(c).text), ['4/10', '3/10']);
  w.generalUis[0].Card = { CardId: 716 }; h.tick(); assert.equal(h.label(w.generalUis[0]).text, '9/10');
});
test('没有全局上下文：军八四种身份逐项取分，未知身份不当主公', () => {
  const h = harness({ missingContext: true }), w = h.win('SelectGeneralWindow', [15]); w.figurePart = new Node(); h.show(w);
  for (const [role, score] of [[1,4],[2,4],[3,5],[4,6],[0,0]]) {
    w.selfFigure = h.game.SelfSeat.Figure = role; h.tick(); assert.equal(h.label(w.generalUis[0]).text, score + '/10');
  }
});
test('共享斗地主2023窗口的主公杀保留原生身份面板优先，不误当地主', () => {
  const h = harness({ missingContext: true }); h.game.SelfFigure = h.game.SelfSeat.Figure = 1;
  const w = h.win('SelectGeneralDdz2023Win', [1]); w.figurePart = new Node(); h.show(w);
  assert.equal(h.label(w.generalUis[0]).text, '3/10');
});
test('缺上下文且无可靠模式证据仍为0，非本人座位不套本人评分', () => {
  const h = harness({ missingContext: true }), w = h.win(); h.show(w);
  assert.equal(h.label(w.generalUis[0]).text, '0/10');
  w.figurePart = new Node(); h.game.SelfSeat.IsSelf = false; h.tick(); assert.equal(h.label(w.generalUis[0]).text, '0/10');
});
test('晚到原生上下文接管回退，身份切换/重开不缓存旧窗口身份', () => {
  const h = harness({ missingContext: true }), w = h.win(); w.figurePart = new Node(); h.show(w);
  assert.equal(h.label(w.generalUis[0]).text, '7/10');
  h.setContextReady(true); h.game.SelfFigure = 3; h.tick(); assert.equal(h.label(w.generalUis[0]).text, '9/10');
  h.setContextReady(false); w.Close(); h.game.SelfFigure = h.game.SelfSeat.Figure = 4;
  w.selfFigure = 4; w.Show(); h.tick(); assert.equal(h.label(w.generalUis[0]).text, '9/10');
});

async function loaderProbe({ requestError = false, characterError = false, deferCharacter = false } = {}) {
  const table = {}; vm.createContext(table);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../doc/彩虹表.js'), 'utf8') + ';globalThis.decoder=DAXIAOCHAO_RAINBOW_TABLE.tables.B.all;', table);
  const decode = id => table.decoder[id], tasks = [];
  let releaseCharacter;
  const scope = { w: { generalGradeLoadState: { phase: 'idle' } }, generalGradeLoadSequence: 0, Date, Promise,
    window: { location: { host: 'web.sanguosha.com' } }, C$1: decode, B: decode,
    TextDecoder: class { decode(value) { return value; } },
    CtrUtil: { Ctr: { Ofb_Dec(value) { if (characterError && value.includes('CharGrade')) throw Error('probe-crypto-error'); return value; } } },
    Zlib: { Gunzip: class { constructor(value) { this.value = value; } decompress() { return this.value; } } },
    JSZipUtils: { getBinaryContent(url, callback) { callback(requestError ? Error('probe-network-error') : null, new Uint8Array()); } },
    JSZip: { loadAsync() {
      const zip = { file(name) { return { async() {
        if (name === 'character.sgs') return deferCharacter ? new Promise(resolve => {
          releaseCharacter = () => resolve(JSON.stringify({ WuJiangs: { CharGrade: fixture.ratings } }));
        }) : Promise.resolve(JSON.stringify({ WuJiangs: { CharGrade: fixture.ratings } }));
        return characterError ? Promise.resolve('{}') : Promise.reject(Error('probe-other-config-error'));
      } }; } };
      return { then(fn) { const task = requestError ? Promise.reject(Error('probe-zip-error')) : Promise.resolve().then(() => fn(zip));
        return { catch(handler) { const observed = task.catch(handler); tasks.push(observed); return observed; } }; } };
    } } };
  vm.createContext(scope);
  const helper = source.slice(source.indexOf('  function updateGeneralGradeLoadState('), source.indexOf('  var L$1 ='));
  const loader = source.slice(source.indexOf('  async function k(n) {'), source.indexOf('  function X(...n) {'));
  vm.runInContext(helper + loader + ';k(true)', scope);
  // The old outer promise is intentionally still not resolved on failure; observe the original chain's rejection.
  await Promise.allSettled(tasks); await new Promise(resolve => setImmediate(resolve));
  if (releaseCharacter) { releaseCharacter(); await new Promise(resolve => setImmediate(resolve)); }
  return scope.w;
}
(async () => {
  const partial = await loaderProbe();
  test('实际loadConfig_w：其他配置失败时记录已解出评分但尚未发布', () => {
    assert.equal(partial.generalGradeLoadState.phase, 'failed'); assert.equal(partial.generalGradeLoadState.characterRows, fixture.ratings.length);
    assert.equal(partial.generalGrades, undefined); assert(partial.generalGradeLoadState.error.includes('probe-other-config-error'));
  });
  const request = await loaderProbe({ requestError: true });
  test('实际loadConfig_w：下载错误保留原始原因及失败阶段', () => {
    assert.equal(request.generalGradeLoadState.phase, 'failed'); assert.equal(request.generalGradeLoadState.failedAt, 'request-error');
    assert(request.generalGradeLoadState.error.includes('probe-network-error'));
  });
  const crypto = await loaderProbe({ characterError: true });
  test('实际loadConfig_w：解密错误可辨认且未改变评分导出', () => {
    assert.equal(crypto.generalGradeLoadState.phase, 'failed'); assert(crypto.generalGradeLoadState.error.includes('probe-crypto-error'));
  });
  const late = await loaderProbe({ deferCharacter: true });
  test('其他配置先失败，晚到的character诊断不能覆盖失败状态', () => {
    assert.equal(late.generalGradeLoadState.phase, 'failed'); assert.equal(late.generalGradeLoadState.characterRows, fixture.ratings.length);
  });
  process.stdout.write(passed + ' selection rating checks passed (isolated native excerpts; no in-game claim).\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
