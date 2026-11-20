const assert=require('node:assert/strict');
const path=require('node:path');
const feature=name=>require(process.env.XC_TEN_YEAR_ROOT ? path.join(process.env.XC_TEN_YEAR_ROOT,'modules/features',name) : '../src/features/'+name);
const create=feature('ten-year-dynamic'), catalog=feature('ten-year-dynamic-catalog')();
const spec=catalog.find(row=>row[9].id===744001)[9];
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
let count=0;const check=(v,msg)=>{assert(v,msg);count++;};
function setup(){
 const timers=new Map(),listeners=new Map(),instances=[],logs=[];let id=0,blocked=false;
 class Sprite{
  constructor(){this.children=[];this.destroyed=false;this.visible=true;}
  addChild(child){this.children.push(child);child.parent=this;return child;}
  scale(x,y){this.scaleX=x;this.scaleY=y;}
  pos(x,y){this.x=x;this.y=y;}
  destroy(){this.destroyed=true;for(const c of this.children)c.destroy();if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
 }
 class Templet{
  constructor(){this.events=new Map();instances.push(this);this.names=['play'];}
  once(name,owner,fn){this.events.set(name,{owner,fn});}
  off(name,owner,fn){if(this.events.get(name)?.fn===fn)this.events.delete(name);}
  emit(name){const e=this.events.get(name);e?.fn.call(e.owner);}
  loadAni(url){this.url=url;}
  getAnimationCount(){return this.names.length;}
  getAniNameByIndex(i){return this.names[i];}
  buildArmature(mode){assert.equal(mode,1);const s=new Sprite();s.play=(name,loop)=>{s.name=name;s.loop=loop;};s.getBounds=()=>({x:-500,y:-350,width:1000,height:700});return s;}
  destroy(){this.destroyed=true;}
 }
 const window={Laya:{Sprite,Templet,Event:{COMPLETE:'complete',ERROR:'error'}},
  setTimeout:fn=>{const key=++id;timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key),
  addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:(key,fn)=>{if(listeners.get(key)===fn)listeners.delete(key);},
  __xcIsSkinEffectsBlocked:()=>blocked};
 const owner=create({window,log:s=>logs.push(s)});
 const avatar=new Sprite();avatar.width=146;avatar.height=172;avatar.seat={};avatar.skinTex={visible:true};avatar.scrollRect={x:36,y:0,width:73,height:172};
 return {owner,window,avatar,timers,listeners,instances,logs,load:()=>instances.filter(t=>!t.destroyed).forEach(t=>t.emit('complete')),
  block(value){blocked=value;listeners.get('xc-skin-effects-change')?.();}};
}
(async()=>{
 const relations=require('./fixtures/ten-year-dynamic-relations-20261121.json');
 check(catalog.length===relations.relations.length&&relations.legacyDynamicIDs.every(id=>catalog.some(r=>r[9].id===id&&r[9].mode==='big')),
  'all official same-name dynamic pairs are candidates and original 103 big-SK routes remain intact');
 const statics=feature('ten-year-static-catalog')().skins;
 const official=relations.relations;
 check(catalog.every(r=>r[0]==='dynamic:'+r[9].id && statics.some(s=>s[0]===r[9].staticId&&s[1]===r[1]) &&
  (r[9].mode==='seat'?r[9].layers.some(l=>l.file==='daiji2.sk'&&l.animationIndex===0):r[9].layers.some(l=>l.file==='daiji.sk')) &&
  official.some(pair=>pair[0]===r[9].staticId&&pair[3]===r[9].id)),'every dynamic has a verified official item relation, explicit static fallback, and required SK role');
 const h=setup();h.owner.attach(()=>h.owner.show(h.avatar,spec,()=>true));
 h.owner.show(h.avatar,spec,()=>true);h.owner.show(h.avatar,spec,()=>true);
 check(h.instances.length===2&&h.timers.size===2,'duplicate show joins background and role loading');
 h.load();await flush();
 check(h.owner.status().players===1&&h.avatar.children.length===1&&h.timers.size===0,'both templates mount a single live player and clear timers');
 const root=h.avatar.children[0];
 check(root.children.length===2&&root.children.every(s=>s.name==='play'&&s.loop),'background and role each play real loop action');
 check(root.mouseEnabled===false&&root.mouseThrough===true,'animation layer does not intercept game clicks');
 check(Math.abs(root.scaleX-172/700)<1e-9&&root.x===72.5,'one coordinate transform respects native half-card clipping');
 check(h.avatar.skinTex.visible===false,'mounted animation hides the static fallback to prevent duplicate figures at smaller scales');
 h.owner.setScale(80);
 check(Math.abs(root.scaleX-172/700*0.8)<1e-9 && root.x===72.5 && h.avatar.children[0]===root && h.instances.length===2,
  'dynamic overall zoom transforms the existing background and role root without replaying or downloading');
 h.owner.setScale(150);h.owner.setScale(80);
 check(Math.abs(root.scaleX-172/700*0.8)<1e-9,'dynamic repeated adjustments use the saved unscaled bounds');
 const beforePan={x:root.x,y:root.y,scale:root.scaleX};h.owner.setTransform({x:17,y:-12});
 check(root.x===beforePan.x+17 && root.y===beforePan.y-12 && root.scaleX===beforePan.scale && h.avatar.children[0]===root,
  'dynamic pan translates the combined role/background root in logical pixels without changing scale or player');
 h.owner.setTransform({x:-4,y:9});h.owner.setTransform({x:17,y:-12});
 check(root.x===beforePan.x+17 && root.y===beforePan.y-12,'dynamic repeated pan starts from reference bounds and never accumulates');
 check(!h.owner.setTransform({x:NaN}) && !h.owner.setTransform({z:1}),'invalid transform updates leave current display unchanged');
 h.owner.setTransform({x:0,y:0});
 h.owner.setScale(100);
 h.owner.visible(h.avatar,false);check(root.visible===false,'native ShowSkeleton visibility can hide the layer');
 check(h.avatar.skinTex.visible===true,'native animation hide restores static fallback visibility');
 h.block(true);check(!root.destroyed&&h.owner.status().players===1&&root.visible===false,'attack-effects blocking preserves idle player and native visibility');
 h.owner.visible(h.avatar,true);
 check(h.avatar.skinTex.visible===false,'showing animation again owns only fallback visibility');
 h.block(false);await flush();check(h.avatar.children[0]===root&&h.instances.length===2,'toggling attack-effects block never rebuilds or interrupts idle');
 h.owner.detach();check(h.listeners.size===0&&h.timers.size===0&&h.instances.every(t=>t.destroyed),'detach releases players, templates, listener, and timers');
 check(h.avatar.skinTex.visible===true,'detach restores the original static fallback');

 const initiallyBlocked=setup();initiallyBlocked.block(true);initiallyBlocked.owner.attach();initiallyBlocked.owner.show(initiallyBlocked.avatar,spec,()=>true);initiallyBlocked.load();await flush();
 check(initiallyBlocked.avatar.children.length===1&&initiallyBlocked.owner.status().players===1,'saved skin-effects blocking=true still permits ten-year idle, matching native policy');initiallyBlocked.owner.detach();
 const loadingBlocked=setup();loadingBlocked.owner.attach();loadingBlocked.owner.show(loadingBlocked.avatar,spec,()=>true);loadingBlocked.block(true);loadingBlocked.load();await flush();
 check(loadingBlocked.avatar.children.length===1,'enabling attack-effects blocking while loading cannot discard idle completion');loadingBlocked.owner.detach();

 const stale=setup();stale.owner.attach(()=>{});let current=true;stale.owner.show(stale.avatar,spec,()=>current);current=false;stale.load();await flush();
 check(stale.avatar.children.length===0&&stale.owner.status().players===0,'late completion cannot attach after a selection/scene/account change');stale.owner.detach();
 const cancelled=setup();cancelled.owner.attach(()=>{});cancelled.owner.show(cancelled.avatar,spec,()=>true);cancelled.owner.detach();await flush();
 check(cancelled.avatar.children.length===0&&cancelled.timers.size===0&&cancelled.instances.every(t=>t.destroyed),'detach while loading cancels all outstanding template jobs');
 const completed=setup();completed.owner.attach(()=>{});completed.owner.show(completed.avatar,spec,()=>true);completed.load();completed.owner.detach();await flush();
 check(completed.instances.every(t=>t.destroyed)&&completed.avatar.children.length===0,'detach between load completion and Promise continuation releases ready-but-uncommitted templates');
 const invisible=setup();invisible.owner.attach(()=>{});invisible.owner.show(invisible.avatar,spec,()=>true);invisible.owner.visible(invisible.avatar,false);invisible.load();await flush();
 check(invisible.avatar.children[0].visible===false,'native hide before loading remains effective after asynchronous mounting');invisible.owner.detach();
 const earlyScale=setup();earlyScale.owner.attach();earlyScale.owner.show(earlyScale.avatar,spec,()=>true);earlyScale.owner.setTransform({scale:75,x:-8,y:10});earlyScale.load();await flush();
 check(Math.abs(earlyScale.avatar.children[0].scaleX-172/700*0.75)<1e-9 && earlyScale.avatar.children[0].x===64.5 && earlyScale.avatar.children[0].y===96,
  'zoom and pan changed during loading apply together when the asynchronous animation mounts');earlyScale.owner.detach();
 const originallyHidden=setup();originallyHidden.avatar.skinTex.visible=false;originallyHidden.owner.attach();originallyHidden.owner.show(originallyHidden.avatar,spec,()=>true);originallyHidden.load();await flush();originallyHidden.owner.detach();
 check(originallyHidden.avatar.skinTex.visible===false,'cleanup preserves a static fallback that was originally hidden');
 const bad=setup();const failed=bad.owner.prepare(spec);bad.instances[0].names=['attack'];bad.load();await assert.rejects(failed,/缺少待机/);await flush();
 check(bad.instances.every(t=>t.destroyed)&&bad.timers.size===0&&bad.owner.status().templates===0,'incompatible action fails preparation and releases partial resources');
 const timeout=setup();const pending=timeout.owner.prepare(spec);[...timeout.timers.values()][0]();await assert.rejects(pending,/超时/);await flush();
 check(timeout.timers.size===0&&timeout.instances.every(t=>t.destroyed),'timeout cancels other layers rather than leaving a partial player');
 const reuse=setup();reuse.owner.attach(()=>{});reuse.owner.show(reuse.avatar,spec,()=>true);reuse.owner.reset();reuse.owner.show(reuse.avatar,spec,()=>true);reuse.load();await flush();
 check(reuse.owner.status().players===1&&reuse.avatar.children.length===1,'old cancelled loader cannot erase a newer same-skin request');reuse.owner.detach();
 const aliases=setup();const a=aliases.owner.prepare(spec),b=aliases.owner.prepare({...spec,id:999999});aliases.load();await Promise.all([a,b]);
 check(aliases.instances.length===2&&aliases.owner.status().templates===1,'source aliases share a single template owner for the same physical textures');aliases.owner.detach();
 const bounded=setup();for(let i=0;i<6;i++){const next=bounded.owner.prepare({...spec,id:900000+i,resource:String(900000+i)});bounded.load();await next;}
 check(bounded.owner.status().templates===3&&bounded.instances.filter(t=>!t.destroyed).length===6,'idle template cache remains bounded while browsing many skins');bounded.owner.detach();
 const native=require('./fixtures/ten-year-seat-idle-native-20261118.json');
 const SmallStandByVO=new Function('Laya',native.smallStandByVO+';return SkinSmallStandByAnimateInfoVO;')({Utils:{getFileExtension:name=>name.split('.').length>1?name.split('.').at(-1):''}});
 for(const skinID of [7133801,8133801]){
  const skin=native.skins.find(r=>r.SkinID===skinID),conf=native.spineConfs.find(r=>r.SkinID===skinID),plays=[];
  const context={width:191,height:269,showType:1,skinBaseVO:{SkinID:skinID,GetAwakeInfo:()=>skin},daiJiCarousels:[],
   contentSp:{addChild(){}},removeSkeleton(){},removeSkeletonBg(){},onSpineResComplete(){}};
  const effect={GetEffect:()=>({pos(){},on(){},playEffect(url,action,loop){this.AnimateUrl=url;plays.push({url,action,loop});}})};
  const small=conf?{SmallStandByAnimateInfos:conf.SmallStandByAnimateInfos.map(r=>new SmallStandByVO(r))}:null;
  context.createDaiJiCarousel=new Function('EffectUtils','SgsSkeletonEffect','return ({'+native.createDaiJiCarousel+'}).createDaiJiCarousel;')(effect,{LOAD_COMPLETE:'loaded'});
  const loadNative=new Function('GeneralSkinInfoConfiger','EffectUtils','SgsSkeletonEffect','return ({'+native.loadSkeleton+'}).loadSkeleton;')(
   {GetInstance:()=>({GetSkinSpineById:()=>small})},effect,{LOAD_COMPLETE:'loaded'});
  loadNative.call(context);
  if(conf)new Function('Laya','SgsSkeletonEffect','return ({'+native.updateDaiJiCarousel+'}).updateDaiJiCarousel;')(
    {Event:{LABEL:'label'}},{PLAY_COMPLETE:'played',LOAD_COMPLETE:'loaded'}).call(context,0);
  check(plays.at(-1)?.url.endsWith('/'+skinID+'/daiji2.sk')&&plays.at(-1).action===0,
   'actual ten-year native default/carousel first seat idle matches generated route for '+skinID);
 }
 const seatSpec=catalog.find(r=>r[9].id===8133801)[9];
 const seat=setup();seat.owner.attach();seat.owner.show(seat.avatar,seatSpec,()=>true);seat.instances[0].names=['native-idle'];seat.load();await flush();
 check(seat.avatar.children[0]?.children[0].name===0&&seat.avatar.children[0].children[0].loop,
  'native seat route plays action index zero without inventing or requiring big-SK play name');seat.owner.detach();
 const noAction=setup(),invalid=noAction.owner.prepare(seatSpec);noAction.instances[0].names=[];noAction.load();await assert.rejects(invalid,/缺少座位待机/);await flush();
 check(noAction.owner.status().templates===0&&noAction.instances.every(t=>t.destroyed),'empty seat action list rejects selection and releases templates');
 process.stdout.write('ten-year-dynamic: '+count+' resource/render/lifecycle checks passed\n');
})().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
