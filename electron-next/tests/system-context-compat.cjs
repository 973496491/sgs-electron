// Offline startup/lifecycle checks and differential checks against a native snapshot.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.env.XC_SYSTEM_CONTEXT_SCRIPT || path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8');
const factory = source.slice(source.indexOf('  function createSystemContextCompatibility()'), source.indexOf('  const systemContextCompatibility ='));
const fixture = require('./fixtures/system-context-native-20261118.json');
const rainbow = {};
vm.createContext(rainbow);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../doc/彩虹表.js'), 'utf8') + ';globalThis.table=DAXIAOCHAO_RAINBOW_TABLE', rainbow);
const decode = i => rainbow.table.tables._0x871b.all[i];
let passed = 0;
function check(name, action) { action(); passed++; console.log('PASS ' + name); }
function setup(native) {
  const timers = new Map(), listeners = new Set(), logs = [], events = [];
  let next = 0, frames = 0;
  const c = {
    SystemContext: native, Event: function(type) { this.type = type; },
    setTimeout(fn, ms) { const id = ++next; timers.set(id, {fn, ms}); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, fn) { if (type === 'resize') listeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'resize') listeners.delete(fn); },
    dispatchEvent(event) { events.push(event.type); },
    appendLocalSkinDebugLine(text) { logs.push(text); },
    console: { log() {} }, dt: { I: () => ({event() {}}) },
    _0x41a3d0: decode, _0x871b: decode, globalConfig: {}, _0x3e479a() {},
    JSZipUtils: {}, CtrUtil: {Ctr: {Ofb_Dec() {}}},
    document: {getElementById: id => id === 'bgDiv' ? {} : null},
    initFrame() { frames++; return Promise.resolve(true); },
    PclobbyEnlargeNumber: 1,
  };
  c.window = c;
  c.Laya = { Browser: {clientWidth: 1600, clientHeight: 920, pixelRatio: 1, window: c, document: {body: {style: {}}}}, LocalStorage: {getItem: () => 2}, stage: {width: 1600, height: 920, setScreenSize() {}}, Event: {RESIZE: 'resize'}};
  vm.createContext(c);
  vm.runInContext(factory + ';globalThis.owner=createSystemContextCompatibility()', c);
  function tick() { const [id, task] = timers.entries().next().value; timers.delete(id); task.fn(); }
  return {c, timers, listeners, logs, events, tick, frames: () => frames};
}
check('preserves native object without installing tasks', () => {
  const native = {gameWidth: 777}, a = setup(native); a.c.owner.start();
  assert.equal(a.c.SystemContext, native); assert.equal(a.timers.size, 0); assert.equal(a.listeners.size, 0);
});
check('start is idempotent and logs through the debug bridge', () => {
  const a = setup(); a.c.owner.start(); const sc = a.c.SystemContext; a.c.owner.start();
  assert.equal(a.c.SystemContext, sc); assert.equal(a.timers.size, 1); assert.equal(a.listeners.size, 1); assert.equal(a.logs.length, 1);
});
check('stop clears tasks; stale callbacks cannot change a restarted owner', () => {
  const a = setup(); a.c.owner.start(); const old = [...a.timers.values()][0].fn;
  a.c.owner.stop(); assert.equal(a.timers.size, 0); assert.equal(a.listeners.size, 0);
  a.c.owner.start(); old(); assert.equal(a.timers.size, 1); assert.equal(a.listeners.size, 1);
});
check('late native export stops fallback tasks without modifying native state', () => {
  const a = setup(); a.c.owner.start(); const native = {gameWidth: 777}; a.c.SystemContext = native; a.tick();
  assert.equal(a.c.SystemContext, native); assert.equal(native.gameWidth, 777); assert.equal(a.timers.size, 0); assert.equal(a.listeners.size, 0);
});
check('waits for Laya and valid metrics, then recovers', () => {
  const a = setup(), laya = a.c.Laya; delete a.c.Laya; a.c.owner.start();
  assert.equal(a.c.SystemContext.gameWidth, 1220); a.c.Laya = laya; laya.Browser.clientWidth = 0; a.tick();
  assert.equal(a.c.SystemContext.gameWidth, 1220); laya.Browser.clientWidth = 1600; a.tick(); assert.equal(a.c.SystemContext.gameWidth, 1600);
});
check('polling slows after 30 seconds', () => {
  const a = setup(); a.c.owner.start(); for (let i = 0; i < 300; i++) a.tick();
  assert.equal([...a.timers.values()][0].ms, 1000);
});
check('dimension changes with unchanged scale/mode notify existing layout listener', () => {
  const a = setup(); a.c.owner.start(); a.events.length = 0; a.c.Laya.Browser.clientWidth = 1500;
  for (const listener of a.listeners) listener();
  assert.equal(a.c.SystemContext.gameWidth, 1500); assert.deepEqual(a.events, ['SGSresize']);
  a.events.length = 0; a.tick(); assert.equal(a.events.length, 0);
});
check('existing initFrame property hooks are retained across synchronization', () => {
  const a = setup(); a.c.owner.start(); const sc = a.c.SystemContext;
  sc._gameScale = sc.gameScale; let changes = 0;
  Object.defineProperty(sc, 'gameScale', {get() {return this._gameScale;}, set(value) {this._gameScale = value; changes++;}});
  a.c.Laya.Browser.clientWidth = 800; a.tick(); assert.equal(changes, 1); assert(sc.gameScale < 1);
});
check('720 native viewport/DPI/mode/enlargement combinations match', () => {
  const a = setup(); a.c.owner.start(); vm.runInContext(fixture.classSource + ';globalThis.NativeSC=_kt', a.c);
  let cases = 0;
  for (const w of [800, 1220, 1600, 1920, 2560]) for (const h of [600, 732, 920, 1440])
    for (const pr of [1, 1.25, 1.5, 2]) for (const mode of [1, 2, 3]) for (const pcl of [1, 1.2, 1.5]) {
      Object.assign(a.c.Laya.Browser, {clientWidth: w, clientHeight: h, pixelRatio: pr});
      a.c.PclobbyEnlargeNumber = pcl; a.c.Laya.LocalStorage.getItem = () => mode;
      a.c.NativeSC.gameScreenType = mode; a.c.NativeSC.UpdateGameSize(w, h); a.tick();
      for (const key of ['gameWidth', 'gameHeight', 'gameScale', 'gameScreenType'])
        assert.equal(a.c.SystemContext[key], a.c.NativeSC[key], JSON.stringify({w, h, pr, mode, pcl, key}));
      cases++;
    }
  assert.equal(cases, 720);
});
check('actual Init starts compatibility and reaches initFrame', () => {
  const a = setup(); a.c.systemContextCompatibility = a.c.owner;
  const init = source.slice(source.indexOf('  function Init() {'), source.indexOf('  function Exit() {'));
  vm.runInContext(init + ';Init()', a.c); assert.equal(a.frames(), 1);
  a.c.owner.stop(); delete a.c.CtrUtil; vm.runInContext('Init()', a.c); assert.equal(a.frames(), 1);
});
check('actual Exit stops compatibility before business teardown', () => {
  const a = setup(); a.c.systemContextCompatibility = a.c.owner; a.c.owner.start();
  const exit = source.slice(source.indexOf('  function Exit() {'), source.indexOf('  function _0x3e479a()'));
  // Existing teardown dependencies are intentionally absent; stopping must happen first.
  assert.throws(() => vm.runInContext(exit + ';Exit()', a.c));
  assert.equal(a.timers.size, 0); assert.equal(a.listeners.size, 0);
});
console.log(passed + ' checks passed');
