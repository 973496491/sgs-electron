// Exercise the actual panel, SGSMODULE hook and asynchronous dump code.
// Run: node electron-next/tests/debug-log-channels.cjs [--source <userscript>]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const arg = process.argv.indexOf('--source');
const source = fs.readFileSync(arg < 0 ? path.join(__dirname, '../resources/daxiaochao.user.js') : process.argv[arg + 1], 'utf8');
function slice(a, b) {
  const start = source.indexOf(a), end = source.indexOf(b, start);
  assert(start >= 0 && end > start, a);
  return source.slice(start, end);
}
const code = slice('  function getLocalSkinDebugState()', '  function normalizeLocalSkinDebugIgnoreRules(') +
  slice('  function ensureLocalSkinDebugPanel()', '  function shallowDumpLocalSkinDebug(') +
  slice('  function beginLocalSkinDebugBlock(', '  function getLocalSkinDebugResponseName(') +
  slice('  function getLocalSkinDebugResponseName(', '  const eightIdentitySettlementProbeSeen') +
  slice('  function isLocalSkinDebugResponsePrintIgnored(', '  function getLocalSkinDebugSkinList(') +
  slice('  function installLocalSkinDebugResponseHook(', '  function notifyLocalSkinError(');
function fixture() {
  globalThis.window = globalThis;
  globalThis.XC = { isDebug: true };
  class Element {
    constructor() { this.children = []; this.style = {}; this.handlers = {}; this.text = ''; }
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
    removeChild(child) { this.children = this.children.filter(x => x !== child); child.parentNode = null; }
    contains(child) { return this === child || this.children.some(x => x.contains(child)); }
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter(x => x !== fn); }
    fire(type) { (this.handlers[type] || []).forEach(fn => fn({ target: this })); }
    get textContent() { return this.text + this.children.map(x => x.textContent).join(''); }
    set textContent(text) { this.children.forEach(x => { x.parentNode = null; }); this.children = []; this.text = String(text); }
  }
  const root = new Element(), body = root.appendChild(new Element());
  globalThis.document = {
    documentElement: root, body, createElement: () => new Element(),
    createTextNode: text => Object.assign(new Element(), { text: String(text) }),
    addEventListener() {}, removeEventListener() {},
  };
  const timers = new Map(); let seq = 0;
  globalThis.setTimeout = globalThis.requestAnimationFrame = fn => { timers.set(++seq, fn); return seq; };
  globalThis.clearTimeout = globalThis.cancelAnimationFrame = id => timers.delete(id);
  globalThis.drain = () => {
    let n = 0;
    while (timers.size) {
      if (++n > 100) throw Error('timer loop');
      const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn());
    }
  };
  globalThis.URL = { createObjectURL: () => 'blob:dump', revokeObjectURL() {} };
  globalThis.Blob = class {};
  globalThis.workers = [];
  globalThis.Worker = class {
    constructor() { workers.push(this); }
    postMessage(job) { this.job = job; }
    terminate() { this.terminated = true; }
    emit(type, chunk) { this.onmessage({ data: { id: this.job.id, type, chunk } }); }
  };
  globalThis.SGSMODULE = [];
  globalThis.getLocalSkinDebugSkinList = first => first.GeneralSkinList || null;
  globalThis.localSkinSelections = { apply(first) { first.applied = (first.applied || 0) + 1; return true; } };
  globalThis.logEightIdentity = () => {};
  globalThis.getLocalSkinDebugIgnoreRules = () => getLocalSkinDebugState().responseIgnoreRules;
  globalThis.loadLocalSkinDebugIgnoreRules = () => ['decodeSSCChatmsgNtf'];
  globalThis.toggleLocalSkinDebugConfigPanel = () => {};
  globalThis.navigator = { clipboard: { writeText(text) { globalThis.copied = text; return Promise.resolve(); } } };
  globalThis.allNodes = () => {
    const found = [];
    function walk(node) { found.push(node); node.children.forEach(walk); }
    walk(body); return found;
  };
  globalThis.button = text => allNodes().find(x => x.textContent === text && x.handlers.click);
  globalThis.apiSwitch = () => allNodes().find(x => x.type === 'checkbox');
  globalThis.setApi = enabled => { apiSwitch().checked = enabled; apiSwitch().fire('change'); };
}
function harness() {
  const context = vm.createContext({});
  vm.runInContext('(' + fixture.toString() + ')();\n' + code + '\nensureLocalSkinDebugPanel();', context);
  // Use the real first-IIFE proxy: its local append function must forward the channel.
  vm.runInContext(`(function () {
    const room = {};
    const storage = new Map();
    globalThis.localStorage = {getItem: key => storage.get(key) || null, setItem: (key,value) => storage.set(key,value)};
    const _0x1ca036 = i => ({427:'all_record',573:'query_uid'}[i]);
    ${slice('  function appendLocalSkinDebugLine(text, force, channel, responseName)', '  let visibleCardTraceSequence')}
    ${slice('  function logEightIdentity(label, data, force)', '  function logLightDealStart(')}
    // Verified _0x3812 / _0x47c207 aliases from manualLookupNotes.eightPlayerIdentityRecord.
    const _0x47c207 = i => ({158:'sendReq',530:'req',743:'del',868:'get',1626:'uuid',1634:'SevenDayResultWindow',1643:'from'}[i]);
    const gameRecord = {};
    globalThis.sentModes = [];
    globalThis.recordWindow = {sendReq(mode) { sentModes.push(mode); }};
    const laya = {
      get(name) { if (name !== 'SevenDayResultWindow') throw Error('unexpected window'); return globalThis.recordWindow; },
      del(name, delay) { globalThis.recordWindowCleanup = {name, delay}; },
    };
    ${slice('  async function getseven(', '  async function kanshu(')}
    globalThis.coreProbe = {dispatch: logLightRoomDispatch, shape: logLightRoomDispatchProbe, record: logEightIdentityMessageProbe, identity: logEightIdentity};
    coreProbe.getseven = getseven;
  })();`, context);
  vm.runInContext('globalThis.skinTabLog = appendLocalSkinTabDebugLine;', context);
  return { run: text => vm.runInContext(text, context) };
}
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(harness()); passed++; process.stdout.write('PASS ' + name + '\n'); }
  catch (e) { failed++; process.stdout.write('FAIL ' + name + ': ' + e.message.split('\n')[0] + '\n'); }
}
test('normal debug opens with API logging disabled', h => {
  assert.equal(h.run('apiSwitch().checked'), false);
  assert.equal(h.run('getLocalSkinDebugState().responseBody.style.display'), 'none');
});
test('API and heartbeat lines have their own DOM and never scroll normal logs', h => {
  h.run(`setApi(true); appendLocalSkinDebugLine('[测试] normal',false,'debug');
    getLocalSkinDebugState().panelBody.scrollTop=123;
    appendLocalSkinDebugLine('heartbeat',true,'api');`);
  assert(!h.run(`getLocalSkinDebugState().panelBody.textContent.includes('heartbeat')`));
  assert(h.run(`getLocalSkinDebugState().responseBody.textContent.includes('heartbeat')`));
  assert.equal(h.run('getLocalSkinDebugState().panelBody.scrollTop'), 123);
});
test('API off rejects forced lines and raw blocks while normal logging continues', h => {
  h.run(`setApi(false); appendLocalSkinDebugLine('heartbeat',true,'api');
    appendLocalSkinDebugBlockAsync('raw','secret',true,'api'); appendLocalSkinDebugLine('[测试] normal',false,'debug'); drain();`);
  assert(!h.run(`getLocalSkinDebugState().panelEl.textContent.includes('secret')`));
  assert(!h.run(`getLocalSkinDebugState().panelBody.textContent.includes('heartbeat')`));
  assert(h.run(`getLocalSkinDebugState().panelBody.textContent.includes('normal')`));
});
test('switching off terminates the active worker and rejects late chunks after reenable', h => {
  h.run(`setApi(true); queueLocalSkinDebugResponseDump('HeartBeatRep',{a:1}); drain();
    const oldWorker=workers[0]; oldWorker.emit('start'); oldWorker.emit('chunk','queued secret');
    setApi(false); setApi(true); oldWorker.emit('chunk','late secret'); drain();`);
  assert(h.run('workers[0].terminated'));
  assert(!h.run(`getLocalSkinDebugState().panelEl.textContent.includes('secret')`));
});
test('late worker error cannot affect a replacement worker', h => {
  h.run(`setApi(true); queueLocalSkinDebugResponseDump('A',{a:1}); drain();
    const old=workers[0]; setApi(false); setApi(true); queueLocalSkinDebugResponseDump('B',{b:2}); drain();
    old.onerror({message:'stale'});`);
  assert(!h.run('workers[1].terminated'));
});
test('API off clears fallback work immediately', h => {
  h.run(`setApi(true); globalThis.Worker=undefined;
    queueLocalSkinDebugResponseDump('Fallback',{a:Array(3000).fill('secret')});
    processLocalSkinDebugDumpPostQueue(); startNextLocalSkinDebugFallbackDump();
    setApi(false); drain();`);
  assert.equal(h.run('getLocalSkinDebugState().fallbackDumpActive'), null);
  assert.equal(h.run('getLocalSkinDebugState().fallbackDumpQueue.length'), 0);
});
test('tab copy and clear affect only the selected channel', h => {
  h.run(`setApi(true); appendLocalSkinDebugLine('[测试] normal payload',false,'debug');
    appendLocalSkinDebugLine('api payload',false,'api');
    button('接口/心跳').fire('click'); button('复制').fire('click');`);
  assert(h.run(`copied.includes('api payload') && !copied.includes('normal payload')`));
  h.run(`button('清空').fire('click');`);
  assert.equal(h.run('getLocalSkinDebugState().responseBody.textContent'), '');
  assert(h.run(`getLocalSkinDebugState().panelBody.textContent.includes('normal payload')`));
});
test('clearing normal logs preserves ongoing API capture', h => {
  h.run(`setApi(true); queueLocalSkinDebugResponseDump('A',{a:1}); drain(); button('清空').fire('click');
    workers[0].emit('chunk','api secret'); drain();`);
  assert(!h.run('workers[0].terminated'));
  assert(h.run(`getLocalSkinDebugState().responseBody.textContent.includes('api secret')`));
});
test('minimize and restore respect the selected tab', h => {
  h.run(`button('接口/心跳').fire('click'); button('—').fire('click'); button('+').fire('click');`);
  assert.equal(h.run('getLocalSkinDebugState().panelBody.style.display'), 'none');
  assert.equal(h.run('getLocalSkinDebugState().responseBody.style.display'), '');
});
test('detached panel discards old async work before rebuilding', h => {
  h.run(`setApi(true); queueLocalSkinDebugResponseDump('A',{a:1}); drain();
    document.body.removeChild(getLocalSkinDebugState().panelEl);
    appendLocalSkinDebugLine('[测试] rebuilt',false,'debug'); workers[0].emit('chunk','old payload'); drain();`);
  assert(!h.run(`getLocalSkinDebugState().panelEl.textContent.includes('old payload')`));
  assert(h.run('workers[0].terminated'));
});
test('API capture works without pending skins; install is idempotent', h => {
  h.run(`setApi(true); installLocalSkinDebugResponseHook(); installLocalSkinDebugResponseHook();
    SGSMODULE[0]({ClassName:'HeartBeatRep',ok:true}); drain(); workers[0].emit('chunk','heartbeat payload'); drain();`);
  assert.equal(h.run('SGSMODULE.length'), 1);
  assert(h.run(`getLocalSkinDebugState().responseBody.textContent.includes('heartbeat payload')`));
  assert(!h.run(`getLocalSkinDebugState().panelBody.textContent.includes('heartbeat payload')`));
});
test('response prefix filtering also covers direct probe lines', h => {
  h.run(`setApi(true); appendLocalSkinDebugLine('chat probe',true,'api','decodeSSCChatmsgNtf');
    queueLocalSkinDebugResponseDump('decodeSSCChatmsgNtf',{}); drain();`);
  assert.equal(h.run('workers.length'), 0);
  assert(!h.run(`getLocalSkinDebugState().responseBody.textContent.includes('chat probe')`));
});
test('printing off still applies local skin responses', h => {
  h.run(`setApi(false); installLocalSkinDebugResponseHook();
    getLocalSkinDebugState().pendingSkin={skinID:123};
    globalThis.response={ClassName:'SkinRep',GeneralSkinList:[{SkinID:0}]}; SGSMODULE[0](response); drain();`);
  assert.equal(h.run('response.applied'), 1);
  assert.equal(h.run('getLocalSkinDebugState().pendingSkin'), null);
  assert.equal(h.run('workers.length'), 0);
});
test('core dispatch and record probes forward their channel across IIFEs', h => {
  h.run(`setApi(true);
    coreProbe.dispatch({roomId:1},{tableId:2},'EnterRoomRep');
    coreProbe.shape({}, {}, 'HeartBeatRep');
    coreProbe.record({query_uid:42,all_record:[]}, 'ClientGameRecordInfoRep');`);
  assert(!h.run(`/dispatch|message:game-record/.test(getLocalSkinDebugState().panelBody.textContent)`));
  assert(h.run(`/dispatch-probe/.test(getLocalSkinDebugState().responseBody.textContent)`));
  assert(h.run(`/message:game-record/.test(getLocalSkinDebugState().responseBody.textContent)`));
});
test('API off suppresses legacy identity probes and results, retaining new typed diagnostics', h => {
  h.run(`setApi(false); coreProbe.identity('interface-probe',{className:'ClientGameRecordInfoRep'},true);
    coreProbe.record({all_record:[]},'ClientGameRecordInfoRep');
    coreProbe.identity('record:accepted',{count:1},true);
    appendLocalSkinDebugLine('[测试] action:done count=1',false,'debug');`);
  assert(!h.run(`/interface-probe|message:game-record|record:accepted/.test(getLocalSkinDebugState().panelEl.textContent)`));
  assert(h.run(`/action:done/.test(getLocalSkinDebugState().panelBody.textContent)`));
});
test('all legacy identity labels fail closed, including unknown or misspelled request names', h => {
  h.run(`setApi(false);
    for (const label of ['request:prepare','request:send','requese:send','request:blocked','request:send-error',
        'record:accepted','record:item','room-context','room-enter-request','game-start','deal-start',
        'bootstrap:request','future-legacy-label']) coreProbe.identity(label,{legacyMarker:'identity-payload'},true);
    coreProbe.identity('request:send',{legacyMarker:'non-forced-payload'},false);`);
  assert(!h.run(`/identity-payload|non-forced-payload/.test(getLocalSkinDebugState().panelEl.textContent)`));
  assert(h.run(`JSON.parse(localStorage.getItem('xcEightIdentityTrace')).some(x=>x.label==='request:send')`));
});
test('legacy identity request and result logs appear only in API tab when enabled', h => {
  h.run(`setApi(true); coreProbe.identity('request:send',{uid:42,modeId:1},true);
    coreProbe.identity('record:accepted',{mode:1,count:2},true);
    button('接口/心跳').fire('click'); button('复制').fire('click');`);
  assert(!h.run(`/request:send|record:accepted/.test(getLocalSkinDebugState().panelBody.textContent)`));
  assert(h.run(`/request:send/.test(copied) && /record:accepted/.test(copied)`));
  h.run(`setApi(false); coreProbe.identity('request:send',{uid:'after-disabled'},true);`);
  assert(!h.run(`/after-disabled/.test(getLocalSkinDebugState().panelEl.textContent)`));
});
test('real getseven sends every mode with API printing off without polluting either log page', h => {
  h.run(`setApi(false); coreProbe.getseven(42); drain();`);
  assert.equal(h.run('JSON.stringify(sentModes)'), '[26,35,44,5,7,1]');
  assert.equal(h.run('recordWindow.uuid'), 42);
  assert.equal(h.run('recordWindowCleanup.name'), 'SevenDayResultWindow');
  assert(!h.run(`/request:send|request:prepare/.test(getLocalSkinDebugState().panelEl.textContent)`));
});
test('real getseven sends and logs only in API tab when API printing is on', h => {
  h.run(`setApi(true); coreProbe.getseven(42,[26,1]); drain();`);
  assert.equal(h.run('JSON.stringify(sentModes)'), '[26,1]');
  assert(!h.run(`/request:send|request:prepare/.test(getLocalSkinDebugState().panelBody.textContent)`));
  assert(h.run(`/request:prepare/.test(getLocalSkinDebugState().responseBody.textContent)`));
  assert.equal(h.run(`getLocalSkinDebugState().responseBody.children.filter(x=>x.textContent.includes('request:send')).length`), 2);
});
test('real getseven blocked diagnostics obey API switch without changing request gating', h => {
  h.run(`setApi(false); recordWindow=null; coreProbe.getseven(42,[1]); drain();`);
  assert.equal(h.run('sentModes.length'), 0);
  assert(!h.run(`/request:blocked|request:prepare/.test(getLocalSkinDebugState().panelEl.textContent)`));
  h.run(`setApi(true); coreProbe.getseven(42,[1]); drain();`);
  assert.equal(h.run('sentModes.length'), 0);
  assert(h.run(`/request:blocked/.test(getLocalSkinDebugState().responseBody.textContent)`));
  assert(!h.run(`/request:blocked/.test(getLocalSkinDebugState().panelBody.textContent)`));
});
test('skin picker live and buffered heartbeats are isolated and obey API switch', h => {
  h.run(`setApi(false); skinTabLog('巡检心跳：disabled');
    setApi(true); skinTabLog('巡检心跳：live'); skinTabLog('[缓存] 巡检心跳：buffered');
    skinTabLog('挂载完成：ok');`);
  assert(!h.run(`/巡检心跳/.test(getLocalSkinDebugState().panelBody.textContent)`));
  assert(h.run(`/挂载完成/.test(getLocalSkinDebugState().panelBody.textContent)`));
  assert(h.run(`/live/.test(getLocalSkinDebugState().responseBody.textContent)`));
  assert(h.run(`/buffered/.test(getLocalSkinDebugState().responseBody.textContent)`));
  assert(!h.run(`/disabled/.test(getLocalSkinDebugState().responseBody.textContent)`));
});
test('fallback preserves a complete payload in the API channel', h => {
  h.run(`setApi(true); globalThis.Worker=undefined;
    queueLocalSkinDebugResponseDump('Fallback',{tail:'fallback-complete',data:Array(600).fill('a')}); drain();`);
  assert(h.run(`/fallback-complete/.test(getLocalSkinDebugState().responseBody.textContent)`));
  assert(!h.run(`/fallback-complete/.test(getLocalSkinDebugState().panelBody.textContent)`));
});
test('API off leaves normal asynchronous blocks queued for rendering', h => {
  h.run(`setApi(true); appendLocalSkinDebugBlockAsync('[测试] normal block','normal chunk',false,'debug');
    appendLocalSkinDebugBlockAsync('api block','api chunk',false,'api'); setApi(false); drain();`);
  assert(h.run(`/normal chunk/.test(getLocalSkinDebugState().panelBody.textContent)`));
  assert(!h.run(`/api chunk/.test(getLocalSkinDebugState().responseBody.textContent)`));
});
test('untyped legacy logs and malformed debug records fail closed', h => {
  h.run(`setApi(false);
    appendLocalSkinDebugLine('[旧模块] legacy',true);
    appendLocalSkinDebugLine('unqualified',true,'debug');
    appendLocalSkinDebugLine('[空消息] ',true,'debug');
    appendLocalSkinDebugLine('[模块] typo',true,'deubg');
    appendLocalSkinDebugBlockAsync('[旧模块] block','legacy payload',true); drain();`);
  assert(!h.run(`/legacy|unqualified|空消息|typo/.test(getLocalSkinDebugState().panelEl.textContent)`));
});
test('real countdown diagnostics remain in the normal log with API printing off', h => {
  h.run(`setApi(false);
    globalThis.laya={scene:null,classes:{}};
    globalThis.globalConfig={countDownSwitch:true};
    globalThis.addEventListener=globalThis.removeEventListener=()=>{};
    ${slice('  const playCountdownDiagnostics = (() => {', '  async function setProto()')}
    playCountdownDiagnostics.start();playCountdownDiagnostics.begin();
    playCountdownDiagnostics.installError(new Error('countdown-install-marker'));`);
  assert(h.run(`/出牌读秒.*install:start/.test(getLocalSkinDebugState().panelBody.textContent)`));
  assert(h.run(`/countdown-install-marker/.test(getLocalSkinDebugState().panelBody.textContent)`));
  assert(!h.run(`/出牌读秒|countdown-install-marker/.test(getLocalSkinDebugState().responseBody.textContent)`));
  h.run(`XC.isDebug=false;playCountdownDiagnostics.installError(new Error('countdown-closed-marker'));`);
  assert(!h.run(`/countdown-closed-marker/.test(getLocalSkinDebugState().panelEl.textContent)`));
});
test('untyped logs appear only in API tab when API printing is enabled', h => {
  h.run(`setApi(true); appendLocalSkinDebugLine('[旧模块] legacy');
    appendLocalSkinDebugLine('unqualified',true,'debug');`);
  assert(!h.run(`/legacy|unqualified/.test(getLocalSkinDebugState().panelBody.textContent)`));
  assert(h.run(`/legacy/.test(getLocalSkinDebugState().responseBody.textContent)`));
  assert(h.run(`/unqualified/.test(getLocalSkinDebugState().responseBody.textContent)`));
});
process.stdout.write(`${passed} passed, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
