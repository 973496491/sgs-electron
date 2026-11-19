// Combine the real local-skin bootstrap/selection/response bridge with native picker methods.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { harness } = require('./native-skin-tabs.cjs');
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8');
const createTabs = require(process.argv[3] || '../src/features/native-skin-tabs');
const native = require('./fixtures/local-skin-native-20261110.json');
const a = source.indexOf('  function getLocalSkinDebugSkinList('), b = source.indexOf('  function notifyLocalSkinError(', a);
const c = source.indexOf('  function runLocalSkinEnableInline()'), d = source.indexOf('  function requestEightIdentityRecordProbe(', c);
assert(a >= 0 && b > a && c >= 0 && d > c);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const allSkins = { 6: [601, 602], 107: [10701, 10702], 303: [30301, 30302], 6027: [602701],
  65534: [6553401, 6553402] };

function setup() {
  // Execute the actual main-script callback rather than duplicating its cross-IIFE bridge.
  const bridge = source.match(/prepareView:\s*([^\r\n]+),/);
  const h = harness({ createTabs, skins: Object.fromEntries(Object.entries(allSkins).map(([id, list]) =>
    [id, list.map(skinID => ({ skinID, generalID: +id }))])),
    prepareView: bridge ? view => new Function('window', 'view', 'return (' + bridge[1] + ')(view)')(h.window, view) : undefined });
  h.window.XC = { isDebug: false, addTooltip() {} };
  h.window.SGSMODULE = []; h.window.Laya.stage = { _children: [] };
  const state = h.window.__localSkinDebug = { hookedMethods: new WeakSet(), timers: [], printResp: false };
  const seat = { Index: 0, IsSelf: true, PlayerInfo: { ClientId: 42 }, skin: 88, dynamic: false,
    general: 6, IsSkinGeneralId(id) { return id === this.general; }, GetStateValue() { return 0; },
    SetGeneralSkin(gid, skinID, dynamic) { this.skin = skinID; this.dynamic = dynamic; } };
  const Scene = new Function('V2t', 'iA', 'ZJt', 'zf',
    'return class Scene {constructor(seat){this.seats=[seat]} ' + native.generalSkinUpdateRep + '}')(
      { IsPveRoguelike: false, CanOperationInGame: () => false }, { emrequ_game: 5 },
      { I: () => ({ GetGeneralSkinBySkinID: () => null }) }, { DATA_XINMO: 1 });
  const scene = new Scene(seat);
  h.window.__xcGetLocalSkinScene = () => ({ scene, selfClientID: 42, selfSeatIndex: 0 });
  h.window.__xcGetServerSkinDefault = () => ({ skinID: 88, isDynamic: 0 });
  const boot = new Function('window', 'Laya', 'document', 'getLocalSkinDebugState', 'appendLocalSkinDebugLine',
    'ensureLocalSkinDebugPanel', 'getLocalSkinDebugResponseName', 'logEightIdentityInterfaceProbe',
    'isLocalSkinDebugResponsePrintIgnored', 'queueLocalSkinDebugResponseDump', 'setTimeout', 'clearTimeout',
    'setInterval', 'clearInterval', 'nativeSkinTabs', source.slice(a, b) + source.slice(c, d) +
    'return {runLocalSkinEnableInline,localSkinSelections};')(
      h.window, h.window.Laya, {}, () => state, text => h.logs.push(text), () => {},
      o => o.className || '', () => {}, () => true, () => {}, h.window.setTimeout,
      h.window.clearTimeout, () => 0, () => {}, h.tabs);
  let wireDefault = 88;
  function receive(gid, skinID = 88) {
    wireDefault = skinID;
    const entry = { GeneralID: gid, SkinID: skinID, state: 0, get IsDynamic() { return this.state === 1; } };
    const response = { Protocol: { ClientID: 42, Type: 0, Count: 1, GeneralSkinList: [entry] } };
    state.respHook(response); scene.generalSkinUpdateRep(response);
    return entry;
  }
  return { h, state, boot, seat, receive, get wireDefault() { return wireDefault; } };
}

async function initialize(firstName) {
  const env = setup(), first = env.h.open(6, true, firstName);
  env.h.window.Laya.stage._children = [first.win];
  env.boot.runLocalSkinEnableInline(); await flush();
  assert.equal(env.state.showHooked, true, 'the original local bootstrap has finished');
  first.win.Close();
  return env;
}

function choose(env, windowName, gid = 6, tabKey = 'peer:107', skinID = 10702, loading = false) {
  const { win, view } = env.h.open(gid, true, windowName, loading);
  env.seat.general = gid;
  if (loading) { win.loading = false; win.loadResComplete(); }
  // Click immediately: correctness must not depend on the old async patch/scan being scheduled.
  if (tabKey) {
    const bar = win.children.find(node => node.name === 'xcSkinTabs');
    assert(bar && bar.parent === win && bar.visible, 'the picker must retain its visible tab bar');
    const index = env.h.tabs.status().tabs.findIndex(tab => tab.key === tabKey);
    assert(index >= 0);
    bar.children[0].children[0].children[index].click();
  }
  view.itemList.find(item => item.SkinID === skinID).click();
  assert.equal(win.closes, 1, 'picking closes once');
  assert.equal(view.closeSelectSkinId, skinID, 'the native handler chose the requested skin');
  assert.deepEqual(view.sent, [env.wireDefault], 'only the authoritative default is sent to the server');
  assert.equal(env.receive(gid).SkinID, skinID, 'the new view must register its local choice');
  assert.equal(env.seat.skin, skinID, 'the native response consumer updates the seat skin');
  assert.equal(env.receive(gid, 999).SkinID, skinID, 'late server skins cannot overwrite the choice');
  return { win, view };
}

(async () => {
  let count = 0;
  for (const [first, second] of [['SelectSkinWindow', 'ChangeSkinWindow'], ['ChangeSkinWindow', 'SelectSkinWindow'],
    ['ModifyShowSkinWindow', 'ChangeSkinWindow'], ['SelectSkinWindow', 'ModifyShowSkinWindow']]) {
    const env = await initialize(first); choose(env, second); count++;
  }
  const late = await initialize('SelectSkinWindow'); choose(late, 'ChangeSkinWindow', 6, 'peer:107', 10702, true); count++;
  const twice = await initialize('SelectSkinWindow');
  choose(twice, 'ChangeSkinWindow'); choose(twice, 'ChangeSkinWindow', 6, 'peer:303', 30301); count++;
  const single = await initialize('SelectSkinWindow'); choose(single, 'ChangeSkinWindow', 65534, null, 6553402); count++;
  assert.equal(typeof single.state.bindSelectView, 'function');
  single.state.stop(); assert.equal(single.state.bindSelectView, null); count++;
  process.stdout.write('native-skin-local-tabs: ' + count + ' combined lifecycle/response scenarios passed\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
