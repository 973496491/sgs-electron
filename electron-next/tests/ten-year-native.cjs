const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const liveRoot = process.env.XC_TEN_YEAR_ROOT;
const featurePath = name => liveRoot ? path.join(liveRoot, 'modules/features', name) : path.join(__dirname, '../src/features', name);
const create = require(featurePath('ten-year-native'));
const createTabs = require(featurePath('native-skin-tabs'));
const catalog = require(featurePath('ten-year-static-catalog'))();
const { harness } = require('./native-skin-tabs.cjs');
const native = require('./fixtures/ten-year-picker-native-20261118.json');
const localNative = require('./fixtures/local-skin-native-20261110.json');
const pickerNative = require('./fixtures/native-skin-tabs-20261118.json');
const zhuge = require('./fixtures/zhuge-skin-family-20261121.json');
const caiwenji = require('./fixtures/caiwenji-skin-family-20261121.json');
const nameCoverage = require('./fixtures/same-name-skin-coverage-20261121.json');
const source = fs.readFileSync(liveRoot ? path.join(liveRoot, '三国杀打小抄.js') : path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8');
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
let assertions = 0;
function check(value, message) { assert(value, message); assertions++; }

function setup(options = {}) {
  const data = options.data || new Map(), logs = [], requests = [], storageReads = [];
  const storage = { getItem: key => { storageReads.push(key); return data.get(key); }, setItem: (key, value) => {
    if (options.failStorage) throw Error('quota'); data.set(key, value);
  } };
  const ctx = { account: 123, selfClientID: 42, selfSeatIndex: 0 };
  const node = () => ({ visible: false, mouseEnabled: false, texture: {}, width: 154, height: 182,
    posInteger() {}, size(w,h) { this.width=w;this.height=h; }, pos() {}, textWidth: 10, textHeight: 10 });
  let h;
  class Item {
    constructor() {
      this.width = 154; this.height = 182; this.handlers = {}; this.flagList = ['a','b','c','d','e'];
      for (const k of ['bg','skinImg','skinName','flagTet','exTypeTet','blackbg','useTex','composeBg','composeIcon',
        'composeTxt1','composeTxt2','composeTxt','timeBg','timeLimiteTxt']) this[k] = node();
      this.dynamicState = 0;
    }
    get SkinID() { return this.skinId; } get IsUsing() { return this.isUsing; }
    get HasSkin() { return this.hasSkin; } get DynamicState() { return this.dynamicState; }
    RefreshSkinDate() {} on(type, caller, fn) { this.handlers[type] = fn.bind(caller); }
    click() { return this.handlers.click({ currentTarget: this }); } pos() {} clear() {}
  }
  const manager = () => h.manager;
  const init = new Function('y8t','Zni','ZOt','jOt','F9t','L8t','POt','oMt','iMt','console',
    'return ({' + native.itemInitData + '}).InitData')(
      { I: manager }, { ChecHasShareSkin: () => false, GetModeType: () => 1 },
      { GetRes: () => ({}) }, { I: () => ({ IsModeSkinFree: () => false }) }, {}, {}, {}, {}, {}, { log() {} });
  Item.prototype.InitData = init;
  Item.prototype.InitBaseData = new Function('mNt', 'return ({' + localNative.InitBaseData + '}).InitBaseData')({ GetRes: () => ({}) });
  class Avatar {
    constructor(seat, gid) {
      this.seat = seat; this.generalCard = { CardId: gid }; this.width = 146; this.height = 172;
      this.skinTex = { texture: null, size(w,h) { this.width=w;this.height=h; }, pos(x,y) { this.x=x;this.y=y; } };
      this.scrollRect = options.nativeClip === false ? null : { x: 0, y: 0, width: 146, height: 172 };
      this.needShowChangeAni = false;
    }
    addRuntimeResRecord() {} removeSkeleton() { this.removed = true; }
    getXline() { return 0; } SetSkin(id) { this.skinItemID=id;this.loadSkin('OL/' + id); }
    loadDefaultSkin() { this.loadSkin('OL/default'); }
  }
  Avatar.prototype.loadSkin = new Function('ZOt','pei','Zsi', 'return ({' + native.avatarLoadSkin + '}).loadSkin')(
    { GetResByUrl(url, receiver, callback) { requests.push({ url, resolve(dimensions = {}) { callback.call(receiver, { url, width: 876, height: 632, ...dimensions }); } }); } },
    class { pos() {} }, { I: () => ({ ShowLoadingTips() {}, CloseTips() {} }) });
  Avatar.prototype.addChild = function () {};
  Avatar.prototype.loadSkinComplete = new Function('Zsi', 'return ({' + native.avatarLoadSkinComplete + '}).loadSkinComplete')(
    { I: () => ({ CloseTips() {} }) });
  Avatar.prototype.ShowType = new Function('yP','Laya','return ({'+native.avatarShowType+'}).ShowType')(
    {AVATAR_MAX_WIDTH:146},{Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}});
  const seat = { Index: 0, IsSelf: true, GeneralId: 8, PlayerInfo: { ClientId: 42 },
    SetGeneralSkin(gid, id, dynamic) { this.skin=id;this.dynamic=dynamic;avatar.generalCard.CardId=gid;avatar.SetSkin(id); },
    GetStateValue: () => 0, IsSkinGeneralId: () => true };
  const avatar = new Avatar(seat, 8), other = new Avatar({ IsSelf: false }, 8);
  ctx.selfSeat=seat;
  let avatars = options.noAvatar ? [] : [avatar];
  const extensionWindow = {};
  const extension = create({ window: extensionWindow, storage, catalog: options.catalog || catalog,
    dynamicCatalog: options.dynamicCatalog || [], dynamic: options.dynamic || null,
    getContext: () => ctx, getAvatars: () => avatars,
    loadImage: options.loadImage || (async () => ({ width: 876, height: 632 })), log: text => logs.push(text) });
  const ol = (skinID, generalID) => ({ skinID, generalID, skinname: 'OL ' + skinID, canUpdateDynamic: () => false,
    BaseInfo: null, skinlevel1: () => 1, SkinSeatUrl: 'OL/' + skinID });
  const bridge = source.match(/prepareView:\s*([^\r\n]+),/)[1];
  h = harness({ itemClass: Item, createTabs: args => createTabs({ ...args, extension }),
    prepareView: view => new Function('window','view','return ('+bridge+')(view)')(h.window,view),
    skins: { 8: [ol(801, 8)], 226: [ol(22601,226)], 442: [ol(44201,442)], 711: [ol(71101,711)],
      ...Object.fromEntries(Object.entries(options.buckets || {}).map(([id, ids]) => [id, ids.map(sid => ol(sid, Number(id)))])) } });
  extensionWindow.Laya = h.window.Laya;
  h.manager.GetSkinListBySkinID = id => id ? [{ IsUseStatic: 1 }] : [];
  h.manager.GetForeverSkinBySkinID = id => id ? {} : null;
  h.manager.HaveOnlineByGeneralId = new Function('return ({'+native.haveOnline+'}).HaveOnlineByGeneralId')();
  h.window.XC = { isDebug: false, addTooltip() {} }; h.window.SGSMODULE=[]; h.window.Laya.stage={ _children: [] };
  const state = h.window.__localSkinDebug = { hookedMethods: new WeakSet(), timers: [], printResp: false };
  const Scene = new Function('V2t','iA','ZJt','zf', 'return class {constructor(seat){this.seats=[seat]}' + localNative.generalSkinUpdateRep + '}')(
    { IsPveRoguelike: false, CanOperationInGame: () => false }, { emrequ_game: 5 },
    { I: () => ({ GetGeneralSkinBySkinID: () => null }) }, { DATA_XINMO: 1 });
  ctx.scene = new Scene(seat);
  h.window.__xcGetLocalSkinScene = () => ctx;
  h.window.__xcGetServerSkinDefault = () => ({ skinID: 88, isDynamic: 0 });
  const a=source.indexOf('  function getLocalSkinDebugSkinList('), b=source.indexOf('  function notifyLocalSkinError(',a);
  const c=source.indexOf('  function runLocalSkinEnableInline()'), d=source.indexOf('  function requestEightIdentityRecordProbe(',c);
  let legacyAccesses = 0;
  Object.defineProperty(h.window, '__xcTenYearSkins', { get() { legacyAccesses++; } });
  const boot = new Function('window','Laya','document','getLocalSkinDebugState','appendLocalSkinDebugLine',
    'ensureLocalSkinDebugPanel','getLocalSkinDebugResponseName','logEightIdentityInterfaceProbe',
    'isLocalSkinDebugResponsePrintIgnored','queueLocalSkinDebugResponseDump','setTimeout','clearTimeout',
    'setInterval','clearInterval','nativeSkinTabs',source.slice(a,b)+source.slice(c,d)+'return {runLocalSkinEnableInline};')(
      h.window,h.window.Laya,{},()=>state,text=>logs.push(text),()=>{},o=>o.className||'',()=>{},()=>true,()=>{},
      h.window.setTimeout,h.window.clearTimeout,()=>0,()=>{},h.tabs);
  boot.runLocalSkinEnableInline();
  function receive(gid, sid=88, clientID=42) {
    const entry={ GeneralID:gid,SkinID:sid,state:0,get IsDynamic(){return this.state===1;} };
    const response={ Protocol:{ ClientID:clientID,Type:0,Count:1,GeneralSkinList:[entry] } };
    state.respHook(response); ctx.scene.generalSkinUpdateRep(response); return entry;
  }
  return { h, state, avatar, other, extension, ctx, seat, requests, data, logs, receive, storageReads,
    legacyAccesses: () => legacyAccesses,
    setAvatars(value) { avatars=value; },
    open(id=8, name='ChangeSkinWindow', loading=false) { seat.GeneralId=id;avatar.generalCard.CardId=id;return h.open(id,true,name,loading); } };
}

(async () => {
  const bridgeStart=source.indexOf('  window.__xcGetLocalSkinScene = () => {');
  const bridgeEnd=source.indexOf('  window.__xcGetServerSkinDefault',bridgeStart);
  const fallbackSeat={Index:2,PlayerInfo:{ClientId:42}};
  const relayWindow={XC:{userID:123}};
  new Function('window','laya',source.slice(bridgeStart,bridgeEnd))(relayWindow,
    {class:()=>undefined,gamescene:{SelfSeatUi:{seatAvatar:{seat:fallbackSeat}}}});
  check(relayWindow.__xcGetLocalSkinScene().selfSeat===fallbackSeat && relayWindow.__xcGetLocalSkinScene().account===123,
    'actual runtime bridge supports missing GameContext through native self avatar');
  check(catalog.skins.length > 3000 && catalog.generals.length > 1500, 'all-name static candidates and named OL identities');
  const lvEntry=catalog.skins.find(row=>row[8].some(p=>p[1]==='吕玲绮'));
  const legacySaved=new Map([
    ['xcTenYearStaticSkins.v1',JSON.stringify({71601:'543501'})],
    ['xcTenYearSkinSize.v1',JSON.stringify({71601:1})],
    ['xcTenYearMergedSkins.v1',JSON.stringify({123:{716:String(lvEntry[0])}})]
  ]);
  const legacyValues=[...legacySaved].slice(0,2);
  const retired=setup({data:legacySaved,buckets:{716:[71601]}}), retiredView=retired.open(716).view;
  check(retired.extension.choice(716)?.[0]===lvEntry[0], 'merged Lv Lingqi choice restores independently of retired manual preferences');
  retiredView.itemList.find(i=>i.SkinID===71601).click();
  check(!retired.extension.choice(716)&&retired.receive(716).SkinID===71601&&retired.legacyAccesses()===0,
    'returning to native OL skin uses the live chain without legacy mapper callbacks');
  check(legacyValues.every(([k,v])=>legacySaved.get(k)===v&&!retired.storageReads.includes(k)),
    'retired mapping keys are inert and preserved without reads or writes');
  const compiledIDs = new Set(catalog.generals.map(row=>row[0]));
  check(nameCoverage.namedOLIDs.every(id=>compiledIDs.has(id)), 'every named OL identity from the actual source snapshot is retained');
  const associations = new Set(catalog.skins.flatMap(row=>row[8].map(page=>JSON.stringify([row[0],...page]))));
  check(nameCoverage.expectedExactAssociations.every(a=>associations.has(JSON.stringify(a))), 'independent full-table exact-name static/page coverage has no omissions');
  const indexEnv=setup(), familyID=new Map(catalog.generals.map(row=>[row[1],row[0]])), rowByID=new Map(catalog.skins.map(row=>[String(row[0]),row]));
  const expectedPages=new Map();
  for(const row of catalog.skins)for(const page of row[8]) {
    const key=JSON.stringify(page);if(!expectedPages.has(key))expectedPages.set(key,new Set());expectedPages.get(key).add(row[1]);
  }
  let pageCoverageOK=true;
  for(const [key,resources] of expectedPages) {
    const [family,label]=JSON.parse(key), items=indexEnv.extension.entries(familyID.get(family),label);
    const shown=items.map(item=>rowByID.get(item.__xcTenYearEntry));
    const pageRows=catalog.skins.filter(row=>row[8].some(p=>p[0]===family&&p[1]===label));
    if(shown.some(row=>!resources.has(row[1])) || new Set(shown.map(row=>row[1])).size!==shown.length ||
      new Set(shown.map(row=>row[2])).size!==shown.length ||
      pageRows.some(row=>!shown.some(item=>item[1]===row[1]||item[2]===row[2])))pageCoverageOK=false;
  }
  check(pageCoverageOK, 'all '+expectedPages.size+' static pages cover every candidate by resource or exact title with no duplicate names or artwork');
  check([2053,2018,8002].every(id=>catalog.generals.some(r=>r[0]===id)), 'same-name OL mode/alternate IDs are not excluded from display candidates');
  const cai=setup({buckets:caiwenji.olSkinIDs});let caiWindow=cai.open(57);
  const caiLabels=cai.h.tabs.status().tabs.map(t=>t.label);
  check(['蔡文姬','SP蔡文姬','界蔡文姬','乐蔡文姬'].every(label=>caiLabels.includes(label)),
    'Cai Wenji must include Yue variant; actual='+caiLabels.join(','));
  check(new Set(caiLabels).size===caiLabels.length && !caiLabels.some(label=>/周妃|诸葛果|蔡邕/.test(label)), 'Yue prefix preserves exact family/version labels');
  cai.h.tabs.selectTab(cai.h.tabs.status().tabs.find(t=>t.label==='乐蔡文姬').key);
  const caiSources=caiWindow.view.list.filter(r=>r.__xcTenYearEntry);
  check(caiwenji.staticSkins.every(r=>catalog.skins.some(row=>row[0]===r.SkinID) &&
    caiSources.some(x=>x.skinname===rowByID.get(String(r.SkinID))[2])),
    'all original eight verified Yue Cai records remain in source catalog and are covered by a same-name display card');
  check(caiSources.filter(r=>r.skinname==='菲菲公主').length===1,
    'same-title static cards with different image resources are shown once');
  check(caiSources.every(r=>!r.canUpdateDynamic() && !caiwenji.dynamicSkinIDs.includes(Number(r.__xcTenYearEntry))), 'dynamic counterparts are not duplicated as static entries');
  check(catalog.skins.some(r=>r[8].some(p=>p[0]==='曹仁' && p[1]==='星曹仁')) &&
    catalog.skins.some(r=>r[8].some(p=>p[0]==='太史慈' && p[1]==='界SP太史慈')),
    'official base-name mapping covers unlisted and compound version prefixes');
  check([1201691,1201761].every(id=>catalog.skins.some(r=>r[0]===id)), 'same-name alternate references are retained in the full candidate index');
  cai.h.tabs.selectTab(cai.h.tabs.status().tabs.find(t=>t.label==='SP蔡文姬').key);
  const spSources=caiWindow.view.list.filter(r=>r.__xcTenYearEntry);
  check(new Set(spSources.map(r=>catalog.skins.find(x=>String(x[0])===r.__xcTenYearEntry)[1])).size===spSources.length &&
    spSources.some(r=>r.__xcTenYearEntry==='542801') && !spSources.some(r=>r.__xcTenYearEntry==='1201691'),
    'one shared resource appears once in a page while the original artwork record takes priority');
  cai.h.tabs.selectTab(cai.h.tabs.status().tabs.find(t=>t.label==='乐蔡文姬').key);
  await caiWindow.view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='5133001').click();
  check(caiWindow.view.sent[0]===88 && cai.extension.choice(57)?.[0]===5133001 && cai.receive(57).SkinID===0,
    'ordinary Cai can select Yue art without sending the external ID');
  cai.requests.at(-1).resolve();
  check(cai.avatar.skinTex.texture.url.includes('/big/static/5133001.png') && cai.avatar.skinTex.height===172,
    'Yue art uses the existing centered static renderer');
  caiWindow=cai.open(57);cai.h.tabs.selectTab(cai.h.tabs.status().tabs.find(t=>t.label==='乐蔡文姬').key);
  check(caiWindow.view.itemList.filter(i=>i.IsUsing).length===1 && caiWindow.view.itemList.find(i=>i.IsUsing).skinData.__xcTenYearEntry==='5133001', 'Yue choice has one exact using marker after reopening');
  cai.h.tabs.selectTab('self');caiWindow.view.itemList.find(i=>i.SkinID===caiwenji.olSkinIDs['57'][0]).click();
  check(!cai.extension.choice(57) && cai.receive(57).SkinID===caiwenji.olSkinIDs['57'][0], 'returning to native Cai clears only the Yue choice');
  for(const [gid,name] of [[57,'ChangeSkinWindow'],[112,'SelectSkinWindow'],[505,'ModifyShowSkinWindow']]) {
    const e=setup({buckets:caiwenji.olSkinIDs}), opened=e.open(gid,name,true);
    opened.win.loading=false;opened.win.loadResComplete();
    e.h.tabs.selectTab(e.h.tabs.status().tabs.find(t=>t.label==='乐蔡文姬').key);
    await opened.view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='6133002').click();
    check(opened.win.closes===1 && opened.view.sent[0]===88 && e.extension.choice(gid)?.[0]===6133002,
      'Cai/SP/Jie native delayed entry reaches Yue selection '+gid);
  }
  const aliasSaved=new Map([['xcTenYearMergedSkins.v1',JSON.stringify({123:{112:'1201691'}})]]);
  const alias=setup({buckets:caiwenji.olSkinIDs,data:aliasSaved});const aliasView=alias.open(112).view;
  alias.h.tabs.selectTab('self');
  check(aliasView.itemList.filter(i=>i.IsUsing).length===1 && aliasView.itemList.find(i=>i.IsUsing).skinData.__xcTenYearEntry==='542801',
    'saved alternate source IDs map to the single shared-artwork using marker');
  const candidatesFail=setup({buckets:caiwenji.olSkinIDs,loadImage:async()=>{throw Error('unavailable');}});
  const unavailable=candidatesFail.open(57);await unavailable.view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='105801').click();
  check(!unavailable.win.closed && !unavailable.view.sent.length && !candidatesFail.extension.choice(57),
    'unlisted static candidates are visible but failed image checks never submit or change selection');
  const empty=setup({catalog:{generals:[[99999,'无图角色','无图角色']],skins:[],familyAliases:{}}});
  check(empty.extension.pages(99999).length===1 && !empty.h.manager.HaveOnlineByGeneralId(99999),
    'name-only membership does not claim an empty skin bucket is usable');
  const olNamesOnly=setup({catalog:{generals:[[57,'蔡文姬','蔡文姬'],[2053,'蔡文姬','蔡文姬']],skins:[],familyAliases:{}},
    buckets:{57:[],2053:[5703]}});
  const olNamesWindow=olNamesOnly.open(57);
  check(olNamesOnly.h.manager.HaveOnlineByGeneralId(57) && !olNamesWindow.win.closed && olNamesWindow.view.list.some(r=>r.skinID===5703),
    'same-name OL-only peer buckets remain available without any ten-year image entries');
  const z=setup({buckets:zhuge.olSkinIDs}); let zWindow=z.open(717);
  const zLabels=z.h.tabs.status().tabs.map(t=>t.label);
  check(['谋诸葛亮','诸葛亮','界诸葛亮','神诸葛亮','武诸葛亮','卧龙诸葛亮','界卧龙诸葛亮'].every(label=>zLabels.includes(label)),
    'Mou Zhuge must include Wu/Wolong/Jie Wolong pages; actual='+zLabels.join(','));
  check(new Set(zLabels).size===zLabels.length && !zLabels.some(label=>/诸葛瑾|诸葛果|诸葛恪/.test(label)),
    'verified family alias keeps full version labels without unrelated people');
  check(!z.h.manager.GetOnlineSKinList(717).some(row=>row.skinID===3701), 'family alias does not change native manager queries outside picker scope');
  z.h.tabs.selectTab(z.h.tabs.status().tabs.find(t=>t.label==='武诸葛亮').key);
  check(zhuge.tenWu.skinIDs.every(id=>zWindow.view.list.some(r=>r.__xcTenYearEntry===String(id))),
    'Wu Zhuge keeps both original static records while accepting all same-name variants');
  await zWindow.view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='523001').click();
  check(zWindow.view.sent[0]===88 && z.extension.choice(717)?.[0]===523001 && z.receive(717).SkinID===0,
    'Mou identity selects Wu artwork using only valid OL wire/default state');
  zWindow=z.open(717);z.h.tabs.selectTab(z.h.tabs.status().tabs.find(t=>t.label==='卧龙诸葛亮').key);
  check(zhuge.olSkinIDs['37'].every(id=>zWindow.view.list.some(r=>r.skinID===id)), 'Wolong page includes all 9 actual OL skins');
  check(zhuge.tenWolong.skinIDs.every(id=>zWindow.view.list.some(r=>r.__xcTenYearEntry===String(id))), 'Wolong page also includes the verified ten-year static rows');
  zWindow.view.itemList.find(i=>i.SkinID===3701).click();
  check(!z.extension.choice(717) && z.receive(717).SkinID===3701, 'switching from Wu to OL Wolong restores native OL selection');
  zWindow=z.open(717);z.h.tabs.selectTab(z.h.tabs.status().tabs.find(t=>t.label==='界卧龙诸葛亮').key);
  check(zhuge.olSkinIDs['454'].every(id=>zWindow.view.list.some(r=>r.skinID===id)), 'Jie Wolong page includes all 5 actual OL skins');
  zWindow=z.open(717);z.h.tabs.selectTab(z.h.tabs.status().tabs.find(t=>t.label==='卧龙诸葛亮').key);
  await zWindow.view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='503801').click();
  check(z.extension.choice(717)?.[0]===503801 && z.requests.at(-1).url.includes('/big/static/503801.png'), 'ten-year Wolong artwork loads on current Mou identity');
  zWindow=z.open(37);
  check(z.h.tabs.status().tabs.some(t=>t.label==='谋诸葛亮') && z.h.tabs.status().tabs.some(t=>t.label==='武诸葛亮'), 'Wolong to Mou/Wu family access is symmetric');
  z.h.tabs.selectTab(z.h.tabs.status().tabs.find(t=>t.label==='谋诸葛亮').key);
  zWindow.view.itemList.find(i=>i.SkinID===71701).click();
  check(zWindow.view.sent[0]===88 && z.receive(37).SkinID===71701 && !z.extension.choice(37), 'Wolong can select Mou OL skin through the same isolated native chain');
  const olOnly=setup({buckets:zhuge.olSkinIDs,catalog:{...catalog,skins:catalog.skins.filter(row=>!row[8].some(p=>p[0]==='诸葛亮'))}});
  olOnly.open(717);
  check(olOnly.h.tabs.status().tabs.some(t=>t.label==='卧龙诸葛亮'), 'OL Wolong page does not depend on having ten-year image entries');
  for (const name of ['SelectSkinWindow','ChangeSkinWindow','ModifyShowSkinWindow']) {
    const e=setup({buckets:zhuge.olSkinIDs}), result=e.open(717,name,true);
    result.win.loading=false;result.win.loadResComplete();
    e.h.tabs.selectTab(e.h.tabs.status().tabs.find(t=>t.label==='武诸葛亮').key);
    await result.view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='523001').click();
    check(result.win.closes===1 && result.view.sent[0]===88 && e.extension.choice(717)?.[0]===523001,
      'Zhuge family selection across delayed native window '+name);
  }
  const env=setup(); await flush();
  check(env.extension.getScales().static===100 && env.extension.getScales().dynamic===100, 'display scales default independently to 100 percent');
  const nativeClip=env.avatar.scrollRect;
  let {win,view}=env.open();
  check(env.legacyAccesses()===0, 'native picker initialization never accesses retired manual mapper');
  const tabs=env.h.tabs.status().tabs;
  check(tabs.filter(t=>t.label==='神孙权').length===1, 'one merged Shen Sunquan page');
  check(tabs[0].label==='孙权' && tabs.every(t=>!/OL-|十周年-/.test(t.label)), 'full names without source prefixes');
  env.h.tabs.selectTab('peer:226');
  check(view.list.some(r=>r.skinID===22601) && view.list.filter(r=>r.__xcTenYearEntry).length===2, 'native OL + both ten-year rows');
  const shareIDs=[];
  view.manager.SendReqShareItem=ids=>shareIDs.push(...ids);
  view.isShareSkin=true;view.initSkinListData();view.isShareSkin=false;
  check(!shareIDs.includes(0), 'real native share probing inside active page never sends local entries');
  const item=view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='522401');
  check(item && item.HasSkin && !item.IsUsing && item.DynamicState===0, 'real item.InitData adapter, ownership and static state');
  check(item.skinImg.skin.includes('/seat/static/522401.png') && item.skinName.text==='碧海潮生', 'real native thumbnail/name fields');
  check(item.skinImg.width===146 && item.skinImg.height===172, 'native thumbnail slot explicitly sized before asynchronous PNG completion');
  const old=env.avatar.loadSkin('OL/old'); const stale=env.requests.at(-1);
  await item.click(); await flush();
  check(win.closes===1 && view.sent.length===1 && view.sent[0]===88, 'native close/destroy/send uses authoritative OL default once '+JSON.stringify({closes:win.closes,sent:view.sent,logs:env.logs.slice(-7)}));
  check(env.extension.choice(8)?.[0]===522401 && env.seat.skin===0, 'source choice separate from OL default carrier');
  check(env.requests.at(-1).url.includes('/big/static/522401.png'), 'real native loadSkin receives full-body source');
  env.requests.at(-1).resolve();
  check(env.avatar.skinTex.texture.url.includes('522401') && Math.abs(env.avatar.skinTex.width-876*172/632)<0.001 &&
    env.avatar.skinTex.height===172 && Math.abs(env.avatar.skinTex.x-(146-env.avatar.skinTex.width)/2)<0.001 && env.avatar.skinTex.y===0,
    'landscape full-body image covers the native slot with symmetric center scaling');
  check(env.avatar.scrollRect===nativeClip && nativeClip.width===146 && nativeClip.height===172, 'existing native clip rectangle preserved');
  const beforeScaleRequests=env.requests.length,baseWidth=env.avatar.skinTex.width;
  check(env.extension.setScales({static:150,dynamic:80}) && Math.abs(env.avatar.skinTex.width-baseWidth*1.5)<0.001 &&
    env.avatar.skinTex.height===258 && Math.abs(env.avatar.skinTex.y+43)<0.001 && env.avatar.scrollRect===nativeClip,
    'static zoom updates the current full image around its center without changing the viewport');
  env.extension.setScales({static:125});env.extension.setScales({static:150});
  check(Math.abs(env.avatar.skinTex.width-baseWidth*1.5)<0.001 && env.requests.length===beforeScaleRequests && view.sent.length===1,
    'successive adjustments recompute from source dimensions without reload or protocol changes');
  check(env.extension.getScales().dynamic===80 && setup({data:env.data}).extension.getScales().static===150,
    'independent dynamic preference survives static changes and a newly constructed owner restores saved scales');
  env.extension.setDisplaySettings({staticX:18,staticY:-11,dynamicX:-9,dynamicY:6});
  check(Math.abs(env.avatar.skinTex.x-((146-env.avatar.skinTex.width)/2+18))<0.001 && env.avatar.skinTex.y===-54 &&
    env.avatar.scrollRect===nativeClip && env.requests.length===beforeScaleRequests && view.sent.length===1,
    'static horizontal and vertical pan act after zoom without moving the viewport or issuing skin changes');
  const restoredDisplay=setup({data:env.data});
  check(restoredDisplay.extension.getDisplaySettings().staticX===18 && restoredDisplay.extension.getDisplaySettings().dynamicX===-9 &&
    restoredDisplay.extension.getDisplaySettings().dynamicY===6,'static and dynamic offsets persist independently with legacy zoom preferences');
  restoredDisplay.extension.detach();
  env.extension.setDisplaySettings({staticX:0,staticY:0,dynamicX:0,dynamicY:0});
  const failingScale=setup({failStorage:true});
  check(!failingScale.extension.setScales({static:160}) && failingScale.extension.getScales().static===100,
    'failed scale persistence leaves the current preference unchanged');failingScale.extension.detach();
  check(!failingScale.extension.setDisplaySettings({staticX:25}) && failingScale.extension.getDisplaySettings().staticX===0,
    'failed pan persistence preserves the prior offset');
  const legacyDisplay=setup({data:new Map([['xcTenYearDisplayScale.v1',JSON.stringify({static:140,dynamic:75})]])});
  check(legacyDisplay.extension.getScales().static===140 && legacyDisplay.extension.getDisplaySettings().dynamicX===0 && legacyDisplay.extension.getDisplaySettings().staticY===0,
    'old scale-only preferences restore without changing zoom and default new pan fields to zero');legacyDisplay.extension.detach();
  check(!env.extension.setScales({static:NaN}) && !env.extension.setScales({dynamic:'80'}), 'invalid numeric preferences are rejected');
  env.extension.setScales({static:100,dynamic:100});
  stale.resolve(); check(env.avatar.skinTex.texture.url.includes('522401'), 'late OL image cannot overwrite selection');
  check(env.receive(8,777).SkinID===0 && env.seat.skin===0, 'real response consumer restores OL 0, never ten-year ID');
  check(env.receive(8,999,99).SkinID===999, 'another player response remains unchanged');
  env.avatar.ShowType(2);env.avatar.loadSkin('OL/half');env.requests.at(-1).resolve();
  check(env.avatar.scrollRect===env.avatar.showRect && env.avatar.scrollRect.x===36 && env.avatar.scrollRect.width===73 &&
    Math.abs(env.avatar.skinTex.x-(36+(73-env.avatar.skinTex.width)/2))<0.001 && env.avatar.skinTex.height===172,
    'actual native half-card viewport keeps its center without custom image offsets');
  env.extension.setScales({static:150});
  check(env.avatar.skinTex.height===258 && Math.abs(env.avatar.skinTex.x-(36+(73-env.avatar.skinTex.width)/2))<0.001,
    'manual zoom respects native half-card center');
  env.extension.setDisplaySettings({staticX:-13,staticY:7});
  check(Math.abs(env.avatar.skinTex.x-(36+(73-env.avatar.skinTex.width)/2-13))<0.001 && env.avatar.skinTex.y===-36,
    'half-card pan preserves the native offset and uses logical pixels after zoom');
  env.extension.setDisplaySettings({staticX:0,staticY:0});
  env.extension.setScales({static:100});
  env.avatar.ShowType(1);env.avatar.loadSkin('OL/full');env.requests.at(-1).resolve();
  env.other.loadSkin('OL/other');check(env.requests.at(-1).url==='OL/other', 'another avatar is untouched');
  env.other.loadSkin('https://web.sanguosha.com/10/pc/legacy.png');env.requests.at(-1).resolve();
  check(env.other.skinTex.texture.url.endsWith('/legacy.png'), 'legacy external resources on other avatars remain valid');
  ({win,view}=env.open()); env.h.tabs.selectTab('peer:226');
  check(view.itemList.filter(i=>i.IsUsing).length===1 && view.itemList.find(i=>i.IsUsing).skinData.__xcTenYearEntry==='522401', 'only the exact source entry marked using after reopen');
  view.itemList.find(i=>i.SkinID===22601).click();
  check(!env.extension.choice(8) && view.sent[0]===777, 'OL choice clears source override and preserves latest wire default '+JSON.stringify({sent:view.sent,choice:env.extension.choice(8)}));
  env.requests.at(-1).resolve(); check(env.avatar.skinTex.texture.url==='OL/22601', 'OL texture restored');
  ({win,view}=env.open(226));
  check(env.h.tabs.status().tabs.filter(t=>t.label==='神孙权').length===1 && env.h.tabs.status().tabs[0].label==='神孙权', 'current general page not duplicated');
  await view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='122401').click();
  const late=env.requests.at(-1); env.extension.detach(); late.resolve();
  check(!env.avatar.skinTex.texture?.url.includes('122401'), 'captured callback blocked after detach');

  const single=setup(); ({win,view}=single.open(716));
  check(single.h.manager.HaveOnlineByGeneralId(716) && !single.h.manager.GetOnlineSKinList(716), 'skin button eligibility supports empty OL bucket without polluting global list');
  check(!win.closed && single.h.tabs.status().tabs.some(t=>t.label==='吕玲绮'), 'single general without OL group/skin bucket opens');
  check(view.list.some(r=>r.__xcTenYearEntry), 'single page gets external entries');
  await view.itemList.find(i=>i.skinData?.__xcTenYearEntry).click();
  check(view.sent[0]===88 && single.extension.choice(716), 'default-0 path supports general without OL skins');

  const portrait=setup({buckets:zhuge.olSkinIDs});let portraitView=portrait.open(717).view;
  portrait.h.tabs.selectTab(portrait.h.tabs.status().tabs.find(t=>t.label==='卧龙诸葛亮').key);
  await portraitView.itemList.find(i=>i.skinData?.__xcTenYearEntry==='103801').click();
  portrait.requests.at(-1).resolve({width:574,height:761});
  check(portrait.avatar.skinTex.width===146 && Math.abs(portrait.avatar.skinTex.height-761*146/574)<0.001 &&
    portrait.avatar.skinTex.x===0 && Math.abs(portrait.avatar.skinTex.y-(172-portrait.avatar.skinTex.height)/2)<0.001,
    'portrait artwork also uses symmetric cover scaling with preserved aspect ratio');
  const noClip=setup({nativeClip:false});let noClipView=noClip.open().view;noClip.h.tabs.selectTab('peer:226');
  await noClipView.itemList.find(i=>i.skinData?.__xcTenYearEntry==='522401').click();noClip.requests.at(-1).resolve();
  check(noClip.avatar.scrollRect?.width===146 && noClip.avatar.scrollRect.height===172, 'missing native clip receives an owned bounded rectangle');
  noClipView=noClip.open().view;noClip.h.tabs.selectTab('peer:226');noClipView.itemList.find(i=>i.SkinID===22601).click();
  check(noClip.avatar.scrollRect===null && noClip.avatar.skinTex.width===146 && noClip.avatar.skinTex.x===0, 'OL switch restores only the clip installed by this feature');
  noClipView=noClip.open().view;noClip.h.tabs.selectTab('peer:226');
  await noClipView.itemList.find(i=>i.skinData?.__xcTenYearEntry==='522401').click();noClip.requests.at(-1).resolve();
  const laterClip={x:1,y:2,width:140,height:168};noClip.avatar.scrollRect=laterClip;noClip.extension.detach();
  check(noClip.avatar.scrollRect===laterClip, 'detach preserves a later native/feature clipping owner');

  const imageResolvers=[];
  const delayed=setup({loadImage:()=>new Promise(r=>{imageResolvers.push(r);})});
  ({win,view}=delayed.open()); delayed.h.tabs.selectTab('peer:226');
  const p=view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='122401').click();
  view.itemList.find(i=>i.SkinID===22601).click();
  for (const resolve of imageResolvers) resolve({width:876,height:632}); await p;
  check(!delayed.extension.choice(8), 'late image validation cannot commit after OL selection');

  const sceneResolvers=[];
  const changed=setup({loadImage:()=>new Promise(resolve=>sceneResolvers.push(resolve))});
  ({win,view}=changed.open());changed.h.tabs.selectTab('peer:226');
  const scenePending=view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='522401').click();
  changed.ctx.scene={};for(const resolve of sceneResolvers)resolve({width:876,height:632});await scenePending;
  check(!changed.extension.choice(8) && !win.closed, 'old validation cannot commit after scene changes');
  view.itemList.find(i=>i.SkinID===22601).click();
  check(!win.closed && !view.sent.length, 'old scene window cannot submit OL choices either');

  const raceResolvers=[];
  const race=setup({loadImage:()=>new Promise(resolve=>raceResolvers.push(resolve))});
  ({win,view}=race.open());race.h.tabs.selectTab('peer:226');
  const first=view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='122401').click();
  const latest=view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='522401').click();
  for(const resolve of raceResolvers.slice(2))resolve({width:876,height:632});await latest;
  for(const resolve of raceResolvers.slice(0,2))resolve({width:876,height:632});await first;
  check(race.extension.choice(8)?.[0]===522401 && win.closes===1, 'newest click wins reverse image completion');

  const failed=setup({loadImage:async()=>{throw Error('offline');}});
  ({win,view}=failed.open());failed.h.tabs.selectTab('peer:226');
  await view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='522401').click();
  check(!win.closed && !failed.extension.choice(8) && !view.sent.length, 'image failure keeps picker and prior selection');

  const quota=setup({failStorage:true});({win,view}=quota.open());quota.h.tabs.selectTab('peer:226');
  await view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='522401').click();
  check(!win.closed && !quota.extension.choice(8) && !view.sent.length, 'storage failure does not submit or mutate current selection');

  const early=setup({noAvatar:true}); ({view}=early.open(716));
  await view.itemList.find(i=>i.skinData?.__xcTenYearEntry).click();
  early.setAvatars([early.avatar]);early.extension.onSeatReady();
  check(early.requests.at(-1).url.includes('/10/pc/'), 'avatar created after choosing receives persisted preference');
  const second=new (early.avatar.constructor)(early.seat,716);second.loadSkin('OL/second');
  check(early.requests.at(-1).url.includes('/10/pc/'), 'new avatar of same native class covered by prototype hook');
  early.seat.GeneralId=8;early.seat.General2Id=716;early.avatar.generalCard.CardId=8;
  early.avatar.loadSkin('OL/primary');check(early.requests.at(-1).url==='OL/primary', 'other general on same self seat keeps its own choice');
  second.loadSkin('OL/secondary');check(early.requests.at(-1).url.includes('/10/pc/'), 'secondary general resolves its own CardId preference');
  const replay=setup({data:early.data});replay.open(716);replay.extension.onSeatReady();
  check(replay.requests.at(-1).url.includes('/10/pc/'), 'same account preference restored');
  replay.ctx.account=999;replay.avatar.loadSkin('OL/account');
  check(replay.requests.at(-1).url==='OL/account', 'preferences isolated by account');

  for (const name of ['SelectSkinWindow','ChangeSkinWindow','ModifyShowSkinWindow']) {
    const e=setup();const result=e.open(8,name,true);
    result.win.loading=false;result.win.loadResComplete();
    e.h.tabs.selectTab('peer:226');
    await result.view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='522401').click();
    check(result.win.closes===1 && result.view.sent[0]===88, 'delayed native resource/window lifecycle '+name);
  }

  const imageTimers=new Set();let timerID=0;
  const owned=create({window:{Image:class{},setTimeout:fn=>{const id=++timerID;imageTimers.add(id);return id;},
    clearTimeout:id=>imageTimers.delete(id)},storage:{getItem:()=>null,setItem(){}},catalog,
    getContext:()=>({account:1}),getAvatars:()=>[]});
  owned.attach();const validation=owned.validate(catalog.skins.find(row=>row[0]===522401));
  check(imageTimers.size===2, 'default image loader owns both timeout handles');
  owned.detach();await assert.rejects(validation);
  check(imageTimers.size===0, 'detach cancels owned image jobs and timeout handles');

  const dynamics = require(featurePath('ten-year-dynamic-catalog'))();
  const horse = catalog.generals.find(r=>r[2]==='马云騄')[0];
  const calls=[];
  const player={attach(){},detach(){calls.push('detach');},reset(){},stop(){},status(){return {};},
    prepare:async spec=>{calls.push(['prepare',spec.id]);},show:(avatar,spec,current)=>{calls.push(['show',spec.id,current()]);}};
  const listEnv=setup({dynamicCatalog:dynamics,dynamic:player});
  const fullRows=new Map([...catalog.skins,...dynamics].map(row=>[String(row[0]),row]));
  let filteredPagesOK=true, hiddenStaticResources=0;
  for(const [key,resources] of expectedPages) {
    const [family,label]=JSON.parse(key);
    const paired=dynamics.filter(row=>row[8].some(p=>p[0]===family&&p[1]===label));
    const hidden=new Set(paired.map(row=>String(row[1])));
    const title=row=>row[2].replace(/^动态·/,'');
    const shown=listEnv.extension.entries(familyID.get(family),label).map(item=>fullRows.get(item.__xcTenYearEntry));
    const pageRows=catalog.skins.filter(row=>row[8].some(p=>p[0]===family&&p[1]===label));
    const art=row=>row[9]?'dynamic:'+row[9].resource:'static:'+row[1];
    if(new Set(shown.map(title)).size!==shown.length || new Set(shown.map(art)).size!==shown.length ||
      shown.some(row=>!row[9]&&(hidden.has(String(row[1]))||paired.some(d=>title(d)===title(row)))) ||
      paired.some(row=>!shown.some(item=>item[9]&&(art(item)===art(row)||title(item)===title(row)))) ||
      pageRows.some(row=>!hidden.has(String(row[1]))&&!shown.some(item=>title(item)===title(row)||!item[9]&&item[1]===row[1])))filteredPagesOK=false;
    hiddenStaticResources+=hidden.size;
  }
  check(filteredPagesOK && hiddenStaticResources>0,
    'all '+expectedPages.size+' pages have unique names/art, dynamic priority, official static pairing, and coverage of remaining candidates');
  listEnv.extension.detach();

  const sample=dynamics.find(row=>row[0]==='dynamic:744001');
  const sampleStatic=catalog.skins.find(row=>row[0]===544001);
  const unpaired=catalog.skins.find(row=>row[0]===244001);
  const pairedAlias=[...sampleStatic];pairedAlias[0]=9900001;
  const sameName=[...unpaired];sameName[2]=sampleStatic[2];
  const smallCatalog={...catalog,skins:[sampleStatic,pairedAlias,sameName]};
  const duplicates=setup({catalog:smallCatalog,dynamicCatalog:[sample],dynamic:player,buckets:{[horse]:[34601]}});
  const nativeWinner=duplicates.h.manager.GetGeneralSkinIncludeHide(horse)[0];
  nativeWinner.skinname=sampleStatic[2];
  const duplicateView=duplicates.open(horse).view;
  check(duplicateView.list.includes(nativeWinner) && !duplicateView.list.some(row=>row.__xcTenYearEntry),
    'native OL static takes precedence over same-name ten-year static, different-art static, and dynamic');
  duplicates.extension.detach();
  for(const name of ['ChangeSkinWindow','SelectSkinWindow','ModifyShowSkinWindow'])for(const nativeDynamic of [false,true]) {
    const saved=new Map([['xcTenYearMergedSkins.v1',JSON.stringify({123:{[horse]:String(sample[0])}})]]);
    const e=setup({catalog:smallCatalog,dynamicCatalog:[sample],dynamic:player,data:saved,buckets:{[horse]:[34601]}});
    const winner=e.h.manager.GetGeneralSkinIncludeHide(horse)[0];
    winner.skinname=nativeDynamic?' 动态·'+sampleStatic[2]+' ':sampleStatic[2];
    winner.canUpdateDynamic=()=>nativeDynamic;
    const opened=e.open(horse,name), shown=opened.view.list;
    check(shown.includes(winner)&&!shown.some(row=>row.__xcTenYearEntry),
      name+' gives OL '+(nativeDynamic?'dynamic':'static')+' priority over both ten-year types, ignoring only the dynamic display marker');
    check(e.extension.choice(horse)===sample&&saved.get('xcTenYearMergedSkins.v1')===JSON.stringify({123:{[horse]:String(sample[0])}}),
      name+' hiding duplicate ten-year entries leaves old selection and stored preferences intact');
    opened.view.itemList.find(item=>item.skinData===winner).click();
    check(!e.extension.choice(horse)&&opened.view.sent[0]===88&&e.receive(horse).SkinID===34601,
      name+' native winner follows the real selection/response chain and clears the ten-year override');
    e.extension.detach();
  }
  const repeatedDynamic=[...sample];repeatedDynamic[0]='dynamic:9999991';
  repeatedDynamic[9]={...sample[9],id:9999991,resource:'9999991'};
  const repeated=setup({catalog:smallCatalog,dynamicCatalog:[sample,repeatedDynamic],dynamic:player});
  check(repeated.extension.entries(horse,'马云騄').length===1&&
    repeated.extension.entries(horse,'马云騄')[0].__xcTenYearEntry===sample[0],
    'same-name dynamic entries with different animation resources collapse to one stable dynamic card');
  repeated.extension.detach();
  const distinct=[...sameName];distinct[2]=sampleStatic[2]+'·珍藏';
  const exact=setup({catalog:{...smallCatalog,skins:[sampleStatic,distinct]},dynamicCatalog:[sample],dynamic:player,buckets:{[horse]:[34601]}});
  check(exact.extension.entries(horse,'马云騄',[{skinname:'舐伤'}]).length===2,
    'prefixes and suffixes do not count as the same complete skin name');
  check(exact.h.manager.GetOnlineSKinList(horse,true,false).every(row=>!row.__xcTenYearEntry),
    'native share-skin probe outside picker scope never receives ten-year display entries');
  exact.extension.detach();
  const emptyName=[...sampleStatic],anotherEmpty=[...unpaired];emptyName[2]=anotherEmpty[2]='';
  const unnamed=setup({catalog:{...smallCatalog,skins:[emptyName,anotherEmpty]}});
  check(unnamed.extension.entries(horse,'马云騄',[{skinname:''}]).length===2,
    'missing skin names never collapse unrelated artwork or match an unnamed OL row');
  unnamed.extension.detach();
  const peerID=990001;
  const peerCatalog={...smallCatalog,generals:[...smallCatalog.generals,[peerID,'马云騄','测试马云騄']]};
  const peer=setup({catalog:peerCatalog,dynamicCatalog:[sample],dynamic:player,buckets:{[horse]:[34601],[peerID]:[99000101]}});
  const peerWinner=peer.h.manager.GetGeneralSkinIncludeHide(horse)[0];peerWinner.skinname=sampleStatic[2];
  const peerView=peer.open(peerID).view;
  peer.h.tabs.selectTab(peer.h.tabs.status().tabs.find(tab=>tab.label==='马云騄').key);
  check(peerView.list.includes(peerWinner)&&!peerView.list.some(row=>row.__xcTenYearEntry),
    'peer version tabs pass their own OL bucket into the same name-priority filter');
  peer.h.tabs.selectTab('self');
  check(peerView.list.some(row=>row.skinID===99000101), 'switching back restores the current version native list');
  peer.extension.detach();
  const partial=setup({catalog:smallCatalog,dynamicCatalog:[sample],dynamic:player});
  const partialEntries=partial.extension.entries(horse,'马云騄');
  check(partialEntries.length===1 && partialEntries[0].__xcTenYearEntry==='dynamic:744001',
    'partial dynamic catalog hides paired aliases and same-title static cards with different art');
  partial.extension.detach();
  const absent=setup({catalog:smallCatalog,dynamicCatalog:[sample]});
  const absentEntries=absent.extension.entries(horse,'马云騄');
  check(absentEntries.length===1 && absentEntries.every(item=>!item.__xcTenYearEntry.startsWith('dynamic:')),
    'without a loaded dynamic player one same-name static card remains and no unusable dynamic card is shown');
  absent.extension.detach();
  const otherPage=[...sample];otherPage[8]=[['马云騄','界马云騄']];
  const scoped=setup({catalog:smallCatalog,dynamicCatalog:[otherPage],dynamic:player});
  check(scoped.extension.entries(horse,'马云騄').some(item=>!item.__xcTenYearEntry.startsWith('dynamic:')&&item.skinname===sampleStatic[2]) &&
    scoped.extension.entries(horse,'界马云騄').some(item=>item.__xcTenYearEntry==='dynamic:744001'),
    'a dynamic entry on another version page does not hide this page\'s static card');
  scoped.extension.detach();

  const oldStaticData=new Map([['xcTenYearMergedSkins.v1',JSON.stringify({123:{[horse]:'544001'}})]]);
  const dyn=setup({dynamicCatalog:dynamics,dynamic:player,data:oldStaticData,buckets:{[horse]:[34601,34602]}});
  const olPair=dyn.h.manager.GetGeneralSkinIncludeHide(horse);
  olPair[0].skinname='OL静态';olPair[1].skinname='OL动态';olPair[1].canUpdateDynamic=()=>true;
  let dynView=dyn.open(horse).view;
  const sourceID='dynamic:744001';
  let dynamicItem=dynView.itemList.find(i=>i.skinData?.__xcTenYearEntry===sourceID);
  check(dynamicItem && !dynView.itemList.some(i=>i.skinData?.__xcTenYearEntry==='544001'),
    'loaded ten-year dynamic candidate hides its paired static card before selection');
  check(dynamicItem.skinName.text.startsWith('动态·') && dynView.itemList.some(i=>i.skinData?.__xcTenYearEntry==='244001'&&i.skinName.text==='随兄入蜀'),
    'dynamic marker and unpaired ten-year static title remain visible');
  check(dyn.extension.choice(horse)[0]===544001 && !dynamicItem.IsUsing && oldStaticData.get('xcTenYearMergedSkins.v1')===JSON.stringify({123:{[horse]:'544001'}}),
    'hiding a previously selected static entry preserves its preference without selecting the dynamic counterpart');
  check(olPair.every(row=>dynView.itemList.some(i=>i.skinData===row&&i.skinName.text===row.skinname)) &&
    dynView.itemList.find(i=>i.SkinID===34602).exTypeTet.visible,
    'distinct native OL static and dynamic cards preserve native display fields and dynamic badge');
  await dynamicItem.click();
  check(calls.some(c=>c[0]==='prepare'&&c[1]===744001),'dynamic templates validate before committing the preference');
  check(dynView.sent.length===1 && dynView.sent[0]===88 && dynView.closeSelectDynamicState===0 && dyn.seat.skin===0 && dyn.seat.dynamic===false, 'dynamic source IDs/state never enter native OL protocol or seat state');
  check(dyn.extension.choice(horse)[0]===sourceID,'dynamic source stored only in account-local preference');
  dyn.requests.at(-1).resolve();
  check(calls.some(c=>c[0]==='show'&&c[1]===744001&&c[2]),'actual native texture completion mounts the selected dynamic');
  dynView=dyn.open(horse).view;
  dynamicItem=dynView.itemList.find(i=>i.skinData?.__xcTenYearEntry===sourceID);
  const staticItem=dynView.itemList.find(i=>i.skinData?.__xcTenYearEntry==='244001');
  check(dynamicItem.IsUsing && !staticItem.IsUsing,'shared fallback image does not merge static and dynamic using markers');
  await staticItem.click();
  check(dyn.extension.choice(horse)[0]===244001,'switching to an unpaired static card retains an explicit static choice');
  player.prepare=async()=>{throw Error('invalid SK texture');};
  dynView=dyn.open(horse).view;
  await dynView.itemList.find(i=>i.skinData?.__xcTenYearEntry===sourceID).click();
  check(dyn.extension.choice(horse)[0]===244001 && dyn.logs.some(s=>s.includes('invalid SK texture')), 'cached static images never bypass dynamic revalidation; failure retains previous skin and logs');
  dyn.extension.detach();check(calls.includes('detach'),'local skin detach releases dynamic owner');

  const yueRows=dynamics.filter(row=>row[8].some(p=>p[1]==='乐貂蝉'));
  check([7133801,8133801].every(id=>yueRows.some(row=>row[9].id===id&&row[9].mode==='seat')),
    'Yue Diao Chan native seat-idle candidates are retained even when big daiji.sk is absent from snapshot');
  let yueMatrix=true;
  for(const gid of [24,445,715])for(const name of ['ChangeSkinWindow','SelectSkinWindow','ModifyShowSkinWindow']) {
    const shown=[];
    const p={attach(){},detach(){},reset(){},stop(){},status(){return {};},prepare:async()=>{},
      show:(avatar,spec,current)=>shown.push({spec,current:current()})};
    const e=setup({dynamicCatalog:dynamics,dynamic:p});let opened=e.open(gid,name);
    const tab=e.h.tabs.status().tabs.find(t=>t.label==='乐貂蝉');if(!tab){yueMatrix=false;continue;}
    e.h.tabs.selectTab(tab.key);
    const item=opened.view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='dynamic:7133801');
    if(!item){yueMatrix=false;continue;}
    await item.click();e.requests.at(-1).resolve();
    if(e.extension.choice(gid)?.[0]!=='dynamic:7133801'||opened.view.sent[0]!==88||e.seat.skin!==0||e.seat.dynamic!==false||
      !shown.some(s=>s.current&&s.spec.layers[0].file==='daiji2.sk'&&s.spec.layers[0].animationIndex===0))yueMatrix=false;
    opened=e.open(gid,name);e.h.tabs.selectTab(e.h.tabs.status().tabs.find(t=>t.label==='乐貂蝉').key);
    const use=opened.view.itemList.filter(i=>i.IsUsing);
    if(use.length!==1||use[0].skinData?.__xcTenYearEntry!=='dynamic:7133801')yueMatrix=false;
    if(opened.view.itemList.some(i=>['5133801','6133801'].includes(i.skinData?.__xcTenYearEntry)))yueMatrix=false;
    await opened.view.itemList.find(i=>i.skinData?.__xcTenYearEntry==='4133801').click();
    if(e.extension.choice(gid)?.[0]!==4133801)yueMatrix=false;
    e.extension.detach();
  }
  check(yueMatrix,'all three native windows and ordinary/Jie/Mo identities hide paired statics, choose Yue seat idle, keep exact using marker, and return to unpaired static');

  process.stdout.write('ten-year-native: '+assertions+' native item/picker/response/render/lifecycle checks passed\n');
})().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
