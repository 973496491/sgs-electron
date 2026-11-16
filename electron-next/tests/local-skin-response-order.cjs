// Actual SGSMODULE listener + native scene response consumer, with ordered protocol fixtures.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2] || path.join(__dirname,'../resources/daxiaochao.user.js'),'utf8');
const native = require('./fixtures/local-skin-native-20261110.json');
const a = source.indexOf('  function getLocalSkinDebugSkinList(');
const b = source.indexOf('  function notifyLocalSkinError(', a);
assert(a >= 0 && b > a);
const c = vm.createContext({});
vm.runInContext(`
  window=globalThis; SGSMODULE=[]; __localSkinDebug={printResp:false};
  function getLocalSkinDebugState(){return __localSkinDebug}
  function appendLocalSkinDebugLine(){} function logEightIdentityInterfaceProbe(){}
  function getLocalSkinDebugResponseName(x){return x.className || ''}
  function isLocalSkinDebugResponsePrintIgnored(){return true}
  function queueLocalSkinDebugResponseDump(){throw Error('debug filter bypassed')}
  const V2t={IsPveRoguelike:false, CanOperationInGame(){return false}};
  const iA={emrequ_game:5}, ZJt={I(){return {GetGeneralSkinBySkinID(){return null}}}}, zf={DATA_XINMO:1};
  seat={PlayerInfo:{ClientId:42},Index:0,IsSelf:true, IsSkinGeneralId(id){return id===7},GetStateValue(){return 0},
    SetGeneralSkin(g,s,d){this.skin=s;this.dynamic=d}};
  class Scene {constructor(){this.seats=[seat]} ${native.generalSkinUpdateRep} }
  scene=new Scene(); __xcGetLocalSkinScene=()=>({scene,selfClientID:42,selfSeatIndex:0});
` + source.slice(a,b) + `
  installLocalSkinDebugResponseHook();
  function select(s,d=0,g=7){const view={clientID:42,realGeneralID:g,closeSelectSkinId:s,closeSelectDynamicState:d};
    localSkinSelections.attach(view);localSkinSelections.record(view);
    __localSkinDebug.pendingSkin=s?{skinID:s,generalID:g}:null}
  function receive(s,client=42,g=7,type=0,extra=[]){
    const e={GeneralID:g,SkinID:s,state:1,get IsDynamic(){return this.state===1}};
    const msg={Protocol:{ClientID:client,Type:type,Count:1+extra.length,GeneralSkinList:[...extra,e]}};
    __localSkinDebug.respHook(msg); scene.generalSkinUpdateRep(msg);return e;
  }
`,c);
let n=0;
function check(code){vm.runInContext(code,c);n++}
check(`select(101); receive(0); if(seat.skin!==101 || seat.dynamic!==false || __localSkinDebug.pendingSkin!==null) throw Error('first ack/static')`);
check(`receive(999); if(seat.skin!==101) throw Error('late real skin overwrote selection')`);
check(`receive(0); if(seat.skin!==101) throw Error('second default notification')`);
check(`select(202,1); receive(101); if(seat.skin!==202 || !seat.dynamic) throw Error('newest choice lost')`);
check(`const other=receive(0,99); if(other.SkinID!==0) throw Error('other player changed')`);
check(`const unrelated=receive(0,42,8); if(unrelated.SkinID!==0) throw Error('other general changed')`);
check(`receive(0,42,7,0,[{GeneralID:8,SkinID:12}]); if(seat.skin!==202) throw Error('non-first list item missed')`);
check(`receive(0,0,7,5); if(seat.skin!==202) throw Error('seat-index query missed')`);
check(`select(0); receive(202); if(seat.skin!==0 || __localSkinDebug.pendingSkin!==null) throw Error('explicit default lost')`);
check(`select(303); __xcResetLocalSkinSelections(); receive(999); if(seat.skin!==999) throw Error('end/reset leaked choice')`);
check(`select(404); scene=new Scene(); receive(999); if(seat.skin!==999) throw Error('new scene leaked choice')`);
check(`select(505); const bare={GeneralSkinList:[{GeneralID:7,SkinID:0}]}; __localSkinDebug.respHook(bare); if(bare.GeneralSkinList[0].SkinID!==0) throw Error('identityless changed')`);
check(`for(const key of ['protoObj','Data','data','protoObjData']){
  const p={ClientID:42,GeneralSkinList:[{GeneralID:7,SkinID:0}]};__localSkinDebug.respHook({[key]:p});if(p.GeneralSkinList[0].SkinID!==505)throw Error(key);
}`);
check(`select(606,1,8); const msg={Protocol:{ProtoObj:{ClientID:42,GeneralSkinList:[{GeneralID:8,SkinID:0},{GeneralID:7,SkinID:0}]}}};
  __localSkinDebug.respHook(msg); if(msg.Protocol.ProtoObj.GeneralSkinList[0].SkinID!==606||msg.Protocol.ProtoObj.GeneralSkinList[1].SkinID!==505) throw Error('independent general choices')`);
check(`const stale={clientID:42,realGeneralID:7,closeSelectSkinId:888};localSkinSelections.attach(stale);
  __xcResetLocalSkinSelections();localSkinSelections.record(stale);if(receive(999).SkinID!==999)throw Error('stale view after reset')`);
check(`const sendView={clientID:42,realGeneralID:7,closeSelectSkinId:707,closeSelectDynamicState:0};
  localSkinSelections.attach(sendView);localSkinSelections.record(sendView);
  const wire=localSkinSelections.send.call(sendView,function(){return {id:this.closeSelectSkinId,d:this.closeSelectDynamicState}},[]);
  if(wire.id!==999||wire.d!==1||sendView.closeSelectSkinId!==707)throw Error('server default not preserved across reset')`);
check(`const raw={Protocol:{ClientID:42,GeneralSkinList:[{GeneralID:7,SkinID:88,state:0}]}};
  __localSkinDebug.respHook(raw);__localSkinDebug.respHook(raw);
  const wire2=localSkinSelections.send.call(sendView,function(){return this.closeSelectSkinId},[]);
  if(wire2!==88||raw.Protocol.GeneralSkinList[0].SkinID!==707)throw Error('rewritten response polluted server default')`);
check(`const unknown={clientID:42,realGeneralID:9,closeSelectSkinId:909,closeSelectDynamicState:1};
  localSkinSelections.attach(unknown);localSkinSelections.record(unknown);
  const wire3=localSkinSelections.send.call(unknown,function(){return this.closeSelectSkinId},[]);
  if(wire3!==0||unknown.closeSelectSkinId!==909)throw Error('no default must send zero')`);
check(`__xcGetLocalSkinScene=()=>null;const e=receive(999);if(e.SkinID!==999)throw Error('unavailable scope changed response')`);
assert(source.includes('localSkinSelections.record(this)'));
assert(source.includes('localSkinSelections.reset();'));
assert.equal((source.match(/window\.__xcResetLocalSkinSelections\?\.\(\);/g)||[]).length,2);
process.stdout.write('local-skin-response-order: '+n+' ordered behavior scenarios passed\n');
