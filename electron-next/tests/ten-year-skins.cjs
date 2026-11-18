const assert = require('node:assert/strict');
const vm = require('node:vm');
const create = require('../src/features/ten-year-skins');
const catalog = require('../src/features/ten-year-skin-catalog')();
const native = require('./fixtures/ten-year-native-static.json');
const NativeSkin = vm.runInNewContext(`class Skin {
  constructor(id, general=716) { this.skinID=id;this.generalID=general;this.miniGamePath='';this.skinname='测试'; }
  ${native.methods.join('\n')}
  canUpdateDynamic(){return true} get ShowDynamic(){return true}
  get SkinsizeType(){return 2} get IsBanner(){return false} get Is169(){return false}
}; Skin`, { P: { I: () => ({ makeUpRootResouceToUrl: (a,b) => 'OL/' + a + b }) }, Zni: { SeatImgUrl: 'general/seat/static/' } });
// 543501 is a landscape ten-year image (876x632 -> BANNER box); seat 229x270.
const LANDSCAPE = { width: 876, height: 632 };
const PORTRAIT = { width: 574, height: 761 };
function fixture(loadImage = async () => LANDSCAPE, seatAvatars = []) {
  const data = new Map();
  const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) };
  return { data, storage, feature: create({window:{},document:{},storage,catalog,loadImage,getSeatAvatars:()=>seatAvatars}) };
}
// Mock in-game seat avatar: loadSkinComplete sets a texture, skinTex records size/pos.
function makeSeatAvatar(skinItemID) {
  const skinTex = { source: { width: 574, height: 761 }, w: 0, h: 0, x: 0, y: 0,
    size(w,h){this.w=w;this.h=h;}, pos(x,y){this.x=x;this.y=y;} };
  const calls = [];
  const avatar = { skinItemID, skinBaseVO: { skinID: skinItemID }, skinTex,
    loadSkinComplete(){ calls.push('native'); return 'native-result'; } };
  avatar.__calls = calls;
  return avatar;
}
const observe = (f, vo) => f.observe({SkinID:vo.skinID,skinData:vo});
(async () => {
  assert(catalog.length === 955 && new Set(catalog.map(r=>r[0])).size === 955);
  const {feature:f, storage} = fixture(), skin = new NativeSkin(71601), other = new NativeSkin(20101,201);
  const original = skin.SkinBigUrl(2);
  observe(f,skin);observe(f,other);observe(f,skin);
  await assert.rejects(f.apply(other.skinID,'543501'),/先打开/);
  assert.equal(skin.SkinBigUrl(2),original);
  assert.equal(skin.SkinsizeType,2); // native before mapping
  await f.apply(skin.skinID,'543501');
  assert.match(skin.SkinBigUrl(2),/\/10\/pc\/res\/assets\/runtime\/general\/big\/static\/543501.png/);
  // seat card now shows the full-body big image, not the half-body seat crop
  assert.match(skin.SkinSeatUrl,/general\/big\/static\/543501.png/);
  assert.equal(skin.SkinMaxUrl(),skin.SkinBigUrl());
  // landscape ten-year image must switch OL native display box to BANNER (1)
  assert.equal(skin.SkinsizeType,1,'landscape image must use BANNER box');
  assert.equal(skin.IsBanner,true); assert.equal(skin.Is169,false);
  const existingItem={skinData:skin,dynamicState:1};f.observe(existingItem);assert.equal(existingItem.dynamicState,0);
  assert.equal(skin.canUpdateDynamic(),false); assert.equal(skin.ShowDynamic,false);
  assert.match(other.SkinBigUrl(),/^OL\//);
  assert.equal(other.SkinsizeType,2); // other general untouched
  const restart = create({window:{},document:{},storage,catalog,loadImage:async()=>LANDSCAPE});
  const next = new NativeSkin(71601);observe(restart,next);
  assert.equal(next.SkinBigUrl(),skin.SkinBigUrl());
  assert.equal(next.SkinsizeType,1,'persisted size type must survive restart'); // persisted size
  restart.dispose();
  await assert.rejects(f.apply(skin.skinID,'../../bad'),/列表/);
  f.remove(skin.skinID);assert.equal(skin.SkinBigUrl(2),original);assert.equal(skin.ShowDynamic,true);
  assert.equal(skin.SkinsizeType,2,'restore must bring back native size type');
  f.dispose();assert.equal(Object.hasOwn(skin,'SkinBigUrl'),false);assert.equal(Object.hasOwn(skin,'SkinsizeType'),false);

  // portrait image -> VERTICAL box (2); no-size loader cannot commit a mapping
  const portrait = fixture(async()=>PORTRAIT);const pSkin = new NativeSkin(71606);observe(portrait.feature,pSkin);
  await portrait.feature.apply(pSkin.skinID,'151101');
  assert.equal(pSkin.SkinsizeType,2,'portrait image must use VERTICAL box');
  assert.equal(pSkin.IsBanner,false);
  const noSize = fixture(async()=>{});const nSkin = new NativeSkin(71607);observe(noSize.feature,nSkin);
  await assert.rejects(noSize.feature.apply(nSkin.skinID,'543501'),/尺寸/);
  assert.equal(noSize.data.size,0);assert.match(nSkin.SkinBigUrl(),/^OL\//);

  const failed = fixture(async()=>{throw Error('offline')});const a=new NativeSkin(71602);observe(failed.feature,a);
  await assert.rejects(failed.feature.apply(a.skinID,'543501'),/offline/);assert.equal(failed.data.size,0);assert.match(a.SkinBigUrl(),/^OL\//);
  const wait=[];const pending=fixture(()=>new Promise(resolve=>wait.push(resolve)));const b=new NativeSkin(71603);observe(pending.feature,b);
  const first=pending.feature.apply(b.skinID,catalog[0][0]);const second=pending.feature.apply(b.skinID,catalog[1][0]);
  wait[2](LANDSCAPE);wait[3](LANDSCAPE);assert.equal(await second,true);wait[0](LANDSCAPE);wait[1](LANDSCAPE);assert.equal(await first,false);assert.equal(pending.feature.getMappings()[b.skinID],catalog[1][0]);
  const third=pending.feature.apply(b.skinID,catalog[0][0]);pending.feature.remove(b.skinID);wait[4](LANDSCAPE);wait[5](LANDSCAPE);assert.equal(await third,false);assert.match(b.SkinBigUrl(),/^OL\//);
  const fourth=pending.feature.apply(b.skinID,catalog[0][0]);pending.feature.dispose();wait[6](LANDSCAPE);wait[7](LANDSCAPE);assert.equal(await fourth,false);assert.equal(Object.hasOwn(b,'SkinBigUrl'),false);
  const cooperation=fixture();const c=new NativeSkin(71604);observe(cooperation.feature,c);const wrapper=c.SkinBigUrl;c.SkinBigUrl=function(...args){return wrapper.apply(this,args)+'?later'};cooperation.feature.dispose();assert.match(c.SkinBigUrl(),/later$/);
  const quota=fixture();const d=new NativeSkin(71605);observe(quota.feature,d);quota.storage.setItem=()=>{throw Error('quota')};await assert.rejects(quota.feature.apply(d.skinID,'543501'),/quota/);assert.match(d.SkinBigUrl(),/^OL\//);

  // Seat card: mapped skin's seat slot serves the full-body big image, and its texture is fitted to 146x172.
  const seatAvatar = makeSeatAvatar(71620);
  const seatOriginal = seatAvatar.loadSkinComplete;
  const seatFx = fixture(async()=>PORTRAIT,[seatAvatar]).feature;
  observe(seatFx, new NativeSkin(71620));
  await seatFx.apply(71620,'151101');
  const fitScale = Math.min(146/574,172/761);
  assert.equal(seatAvatar.skinTex.w, Math.round(574*fitScale));
  assert.equal(seatAvatar.skinTex.h, Math.round(761*fitScale));
  assert.equal(seatAvatar.skinTex.x, Math.round((146-seatAvatar.skinTex.w)/2));
  assert.equal(seatAvatar.loadSkinComplete(),'native-result','wrapped loadSkinComplete must return native result');
  assert(seatAvatar.__calls.includes('native'),'native loadSkinComplete must still run');
  // unmapped avatar is not resized
  const otherAvatar = makeSeatAvatar(99999);
  seatFx.syncSeatHooks();
  otherAvatar.loadSkinComplete();
  assert.equal(otherAvatar.skinTex.w,0,'unmapped seat avatar must not be resized');
  seatFx.dispose();
  assert.equal(seatAvatar.loadSkinComplete,seatOriginal,'dispose must restore seat hook');

  console.log('PASS: native image getters, 955 catalog pairs, LLQ-only scope, static selection, display-box size adaptation, full-body seat image + 146x172 fit, persistence, restore, failed preload/save, async races, dispose and wrapper cooperation.');
})().catch(e=>{console.error(e);process.exitCode=1});
