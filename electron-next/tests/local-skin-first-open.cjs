// Real native ownership gate + actual userscript bootstrap. No client/network required.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8');
const native = require('./fixtures/local-skin-native-20261110.json');
const start = source.indexOf('  function runLocalSkinEnableInline()');
const end = source.indexOf('  function requestEightIdentityRecordProbe(', start);
assert(start >= 0 && end > start);
const code = source.slice(start, end);

async function fixture(visible = true) {
  const tasks = new Map(); let id = 0;
  const context = vm.createContext({
    setTimeout(fn) { tasks.set(++id, fn); return id; }, clearTimeout(i) { tasks.delete(i); },
    setInterval() { return ++id; }, clearInterval() {},
    appendLocalSkinDebugLine() {}, appendLocalSkinTabDebugLine() {}, ensureLocalSkinDebugPanel() {},
    nativeSkinTabs: { attach() { return true; } },
    installLocalSkinDebugResponseHook() {},
  });
  vm.runInContext(`
    window = globalThis; XC = {isDebug:false, addTooltip(){}}; SGSMODULE = [];
    sent=[];shouldThrow=false;
    const V2t={ChecHasShareSkin(){return false}}, Us={IsGuildMatch(){return false},IsTZGJ(){return false},IsLuanDou(){return false}};
    V2t.GetModeType=()=>1;
    class iA {static SET=1;static JINLAN=4;static MULTI_AREA=3;SkinItem={}}
    const eNt={CLIENT_GENERAL_SKIN_REQ:1};const ks={ORIGINAL_SERVER:1};
    class Manager {constructor(){this.proxy={L(x){if(shouldThrow)throw Error('send failure');sent.push(x)}}} ${native.SendClientGeneralSkinReq} }
    const JJt={I(){return manager}};const manager=new Manager();
    class NativeView {${native.closeSelectSure}}
    __xcGetServerSkinDefault=()=>({skinID:88,isDynamic:1});
    __xcIsLocalSkinUnowned=id=>id!==102;
    class SkinInfo {${native.canUpdateDynamic}}
    dynamicInfo=new SkinInfo();dynamicInfo.skinlevel='1,5';
    staticInfo=new SkinInfo();staticInfo.skinlevel='0,2';
    const mNt = {GetRes(){return {}}}; const XPt = {CLOSE_SKIN_WINDOW:'close'};
    class Item {
      constructor(){
        this.bg={}; this.blackbg={}; this.useTex={}; this.skinImg={}; this.skinName={}; this.flagList=[];
        for (const k of ['timeBg','composeBg','composeIcon','composeTxt1','composeTxt2','composeTxt','timeLimiteTxt']) this[k]={};
      }
      ${native.InitBaseData}
      ${native.getters}
      get SkinID(){return this.skinId}
      InitData(){this.InitBaseData('skin','url',0,false,false,101)}
      RefreshSkinDate(){this.hasSkin=false;this.blackbg.visible=true;this.bg.mouseEnabled=false}
    }
    class View {
      constructor(){this.itemList=[];this.clientID=42;this.realGeneralID=7;this.closeSelectSkinId=0;this.events=[]}
      updateContent(){this.itemList=[makeItem()]}
      RefreshShareSkin(){this.updateContent()}
      event(name){this.events.push(name)}
      ${native.itemClick}
      closeSelectSure(){NativeView.prototype.closeSelectSure.call(this);return 'native-send'}
    }
    function makeItem(){const i=new Item();i.InitData();return i}
    class Win { constructor(){this.resName='selectSkin';this.selectView=new View()} Show(){return 'shown'} }
    win = new Win(); win.selectView.updateContent();
    // Native event dispatch retains the handler bound before the prototype is patched.
    boundClick = win.selectView.itemClick.bind(win.selectView);
    Laya={stage:{_children:[]}};
    function getLocalSkinDebugState(){return window.__localSkinDebug ||= {hookedMethods:new WeakSet(),timers:[]}}
    __xcGetLocalSkinScene=()=>({scene:win});
  ` + source.slice(source.indexOf('  const localSkinSelections ='), source.indexOf('  function installLocalSkinDebugResponseHook(')) + code, context);
  if (visible) context.Laya.stage._children.push(context.win);
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const drain = async () => { await flush(); for (let i = 0; i < 10 && tasks.size; i++) { const batch = [...tasks.values()]; tasks.clear(); batch.forEach(fn => fn()); await flush(); } };
  return {c:context, tasks, drain, flush};
}

(async () => {
  let checks = 0;
  function unlocked(i) {
    assert.equal(i.HasSkin, true); assert.equal(i.bg.mouseEnabled, true);
    assert.equal(i.blackbg.visible, false); assert.equal(i.IsUsing, false);
    assert.equal(i.useTex.visible, false); checks++;
  }
  const {c, drain, flush} = await fixture();
  assert.equal(c.win.selectView.itemList[0].HasSkin, false);
  c.runLocalSkinEnableInline(); await drain();
  unlocked(c.win.selectView.itemList[0]); // Fails on old source: first initialization was missed.
  c.boundClick({currentTarget:c.win.selectView.itemList[0]});
  assert.equal(c.win.selectView.closeSelectSkinId, 101); checks++;
  assert.equal(c.win.selectView.events.length, 1); checks++;
  assert.equal(c.win.selectView.closeSelectSure(), 'native-send');
  assert.equal(c.__localSkinDebug.pendingSkin.skinID, 101); checks++;
  assert.equal(c.sent[0].SkinItem.SkinID, 88); assert.equal(c.sent[0].SkinItem.State,1); checks++;
  assert.equal(c.win.selectView.closeSelectSkinId,101); checks++;
  c.win.selectView.closeSelectSkinId=202;c.win.selectView.closeSelectSure();
  assert.equal(c.sent[1].SkinItem.SkinID,88);assert.equal(c.win.selectView.closeSelectSkinId,202);checks++;
  c.shouldThrow=true;
  assert.throws(()=>c.win.selectView.closeSelectSure(),/send failure/);
  assert.equal(c.win.selectView.closeSelectSkinId,202);c.shouldThrow=false;checks++;
  const hooked = Object.getPrototypeOf(c.win.selectView.itemList[0]).InitData;
  c.runLocalSkinEnableInline(); c.__localSkinDebug.patch(c.win); await drain();
  assert.equal(Object.getPrototypeOf(c.win.selectView.itemList[0]).InitData, hooked); checks++;
  c.win.selectView.updateContent(); unlocked(c.win.selectView.itemList[0]);
  c.win.selectView.itemList[0].RefreshSkinDate(); unlocked(c.win.selectView.itemList[0]);
  c.win.selectView.RefreshShareSkin(); unlocked(c.win.selectView.itemList[0]);
  const i = c.win.selectView.itemList[0];
  i.InitBaseData('owned','url',0,true,true,102);
  assert.equal(i.HasSkin, true); assert.equal(i.IsUsing, true); assert.equal(i.useTex.visible, true); checks++;
  i.InitBaseData('default','url',0,true,false,0); assert.equal(i.SkinID,0); unlocked(i);
  c.win.Show(); await drain(); unlocked(i);
  // Enabled before the first window is constructed/attached: actual SGSMODULE signal path.
  const late = await fixture(false);
  late.c.runLocalSkinEnableInline(); await late.flush();
  late.c.Laya.stage._children.push(late.c.win);
  late.c.SGSMODULE[0]({WindowName:'ChangeSkinWindow', window:late.c.win});
  await late.drain(); unlocked(late.c.win.selectView.itemList[0]);
  // Item list arrives after the view hook is installed.
  c.win.selectView.itemList=[]; c.__localSkinDebug.patch(c.win); await flush();
  c.win.selectView.updateContent(); await drain(); unlocked(c.win.selectView.itemList[0]);
  const animated=c.win.selectView.itemList[0];
  animated.skinData=c.dynamicInfo;animated.dynamicState=0;animated.RefreshSkinDate();
  assert.equal(animated.DynamicState,1,'unowned dynamic-capable skin must animate');checks++;
  c.boundClick({currentTarget:animated});c.win.selectView.closeSelectSure();
  assert.equal(c.__localSkinDebug.pendingSkin.isDynamic,1,'local choice retains animation');
  assert.equal(c.sent[c.sent.length-1].SkinItem.SkinID,88,'server still receives default');checks++;
  animated.dynamicState=0;animated.InitBaseData('owned static preference','url',0,true,false,102);
  assert.equal(animated.DynamicState,0,'owned static preference remains');checks++;
  animated.skinData=c.staticInfo;animated.dynamicState=0;
  animated.InitBaseData('static only','url',0,false,false,101);
  assert.equal(animated.DynamicState,0,'static-only skin stays static');checks++;
  animated.skinData=c.dynamicInfo;animated.dynamicState=0;
  animated.InitBaseData('default','url',0,true,false,0);
  assert.equal(animated.DynamicState,0,'default ID is not upgraded');checks++;
  animated.isShare=true;animated.dynamicState=0;
  animated.InitBaseData('shared static preference','url',0,true,false,101);
  assert.equal(animated.DynamicState,0,'shared static preference remains');checks++;
  process.stdout.write(`local-skin-first-open: ${checks} behavior checks passed\n`);
})().catch(e => { process.stderr.write(e.stack+'\n'); process.exitCode=1; });
