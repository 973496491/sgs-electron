// Exercise the shipped countdown hook, text layout and debug-open event.
// Run: node electron-next/tests/play-countdown-diagnostics.cjs [--source <userscript>]
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const sourceArg = process.argv.indexOf('--source');
const source = fs.readFileSync(sourceArg < 0 ? path.join(__dirname, '../resources/daxiaochao.user.js') : process.argv[sourceArg + 1], 'utf8').replace(/\r\n/g, '\n');
const map = require('../../doc/彩虹表.js').tables._0x3812.all;
function slice(a, b) {
  const start = source.indexOf(a), end = source.indexOf(b, start);
  assert(start >= 0 && end > start, a); return source.slice(start, end);
}
const diagnostics = slice('  const playCountdownDiagnostics = (() => {', '  async function setProto()');
const hookStart = source.indexOf('      // 出牌读秒：保留原计时与诊断链，数字显示在条尾右侧。');
const hookEnd = source.indexOf('      })(),', hookStart) + 10;
assert(hookStart >= 0 && hookEnd > hookStart);
const hook = source.slice(source.indexOf('(async function', hookStart), hookEnd).trim();
const redefine = slice('  function redefine(', '  const skins =');
const debugOpen = slice('      const countdownRequest =', '      // 用于区分“日志还没生效”');
assert(source.includes('async function setProto() {\n    playCountdownDiagnostics.start();'));
assert(source.includes('systemContextCompatibility.stop();\n    playCountdownDiagnostics.dispose();'));
function harness(options = {}) {
  const ctx = vm.createContext({ map, options });
  vm.runInContext(`
    const listeners = new Map(), logs = [], getCalls = [];
    const window = {XC:{isDebug:options.debug!==false},
      addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
      removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
      dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);}
    };
    class CustomEvent {constructor(type,init){this.type=type;this.detail=init.detail;}}
    const Laya={stage:{constructor:{name:'Stage'},visible:true,alpha:1}};
    const globalConfig={countDownSwitch:options.enabled!==false};
    const _0x47c207=key=>map[key];
    const originalError = new Error('original failure'), textError = new Error('label failure');
    class Countdown {
      constructor(){this.tweenPos=.25;this.maxValue=20;this.passedTime=0;this.width=390;this.height=12;
        this.visible=true;this.alpha=1;this.parent=Laya.stage;this.nativeCalls=0;this.children=[];}
      onUpdate(...args){this.nativeCalls++;this.args=args;if(options.nativeError)throw originalError;
        this.RemainValue=(this.maxValue-this.passedTime)*(1-this.tweenPos);return 321;}
      addChild(node){if(node){this.children.push(node);node.parent=this;}return node;}
    }
    class SelfCountdown extends Countdown {}
    class Text {
      constructor(){this.visible=true;this.alpha=1;this.textField={text:'',fontSize:12,color:'#ffffff'};}
      set label(value){if(options.textError)throw textError;this.value=value;this.textField.text=value;}
      get label(){return this.value;}
      set labelColors(value){this.colors=value;}
      set labelBold(value){this.textField.bold=value;}
      set labelAlign(value){this.textField.align=value;}
      set labelValign(value){this.textField.valign=value;}
      size(width,height){this.width=width;this.height=height;return this;}
      pos(x,y){this.x=x;this.y=y;return this;}
    }
    const win={countdownTimer:options.noTimer?null:new SelfCountdown(),ShowCountdownTimer(value){this.shown=value;}};
    const timers=[], scene={SceneName:'TableScene',topMenu:{backBtn:new Text()},SelfSeatUi:{},seatContainer:{seatUIs:[]}};
    const laya={classes:{},scene,gamescene:scene,get(name,a,b,callback){getCalls.push(name);
      if(name==='SgsSpriteFilterBtn')return options.noText?undefined:new Text();
      const value=options.noWindow?undefined:win;if(callback)callback(value);return value;}};
    function appendLocalSkinDebugLine(line,force,channel){if(options.logError)throw Error('logger failure');logs.push({line,force,channel});}
    ${redefine}
    ${diagnostics}
    globalThis.api={window,Laya,laya,scene,globalConfig,logs,getCalls,win,Countdown,SelfCountdown,listeners,
      originalError,textError,diagnostics:playCountdownDiagnostics,
      make(){const t=new SelfCountdown();timers.push(t);return t;},
      inspect(){${debugOpen}},
      events(name){return logs.filter(x=>x.line.startsWith('[出牌读秒] '+name+' '));},
      config(value){globalConfig.countDownSwitch=value;window.dispatchEvent(new CustomEvent('xc:config-change',{detail:{property:'countDownSwitch'}}));},
      report(name){return JSON.parse(this.events(name).at(-1).line.split(' ').slice(2).join(' '));}}
  `, ctx);
  const h = ctx.api;
  h.install = () => { h.diagnostics.start(); return vm.runInContext(hook, ctx); };
  return h;
}
let passed = 0;
async function test(name, run) {
  await run(); passed++; process.stdout.write('PASS ' + name + '\n');
}
(async () => {
  await test('install reports the actual target and result using typed debug logs', async () => {
    const h=harness();await h.install();assert.equal(h.win.shown,1);
    assert.equal(h.report('install:result').installed,true);
    for(const x of h.logs){assert.equal(x.force,false);assert.equal(x.channel,'debug');}
  });
  await test('debug closed discards logs; opening reads current installation without replay', async () => {
    const h=harness({debug:false});await h.install();h.make().onUpdate();assert.equal(h.logs.length,0);
    h.window.XC.isDebug=true;h.inspect();assert.equal(h.report('inspect').phase,'installed');
    assert.equal(h.events('install:start').length,0);assert.equal(h.events('text:updated').length,0);
  });
  await test('normal update forwards this/arguments, remains undefined, and bounds first logs', async () => {
    const h=harness();await h.install();const t=h.make();
    for(let i=0;i<100;i++)assert.equal(t.onUpdate('x',i),undefined);
    assert.equal(t.nativeCalls,100);assert.deepEqual(Array.from(t.args),['x',99]);
    assert.equal(t.RemainValue,15);assert.equal(t.text.label,'15');assert.equal(t.text.labelSize,17);
    assert.equal(t.width,390);assert.equal(t.height,12);
    assert.equal(t.text.x,396);assert.equal(t.text.y,-6);assert.equal(t.text.height,24);
    assert.equal(t.text.textField.color,'#ff4d4f');assert.equal(t.text.textField.align,'left');
    assert.equal(t.text.textField.valign,'middle');assert.equal(t.text.mouseEnabled,false);
    assert.equal(t.text.textField.bold,true);
    assert(t.text.colors.split(',').every(color=>color==='#ff4d4f'));
    t.width=154;t.height=9;t.maxValue=200;t.tweenPos=.1;t.onUpdate();
    assert.equal(t.text.label,'180');assert.equal(t.text.x,160);assert.equal(t.text.width,33);
    assert.equal(t.text.y,Math.round((9-24)/2));assert.equal(t.width,154);
    for(const event of ['update:first','text:create','text:updated'])assert.equal(h.events(event).length,1);
  });
  await test('missing window still rejects and does not retry or silently repair', async () => {
    const h=harness({noWindow:true});await assert.rejects(h.install(),/ShowCountdownTimer/);
    h.inspect();assert.equal(h.report('inspect').phase,'failed');assert.match(h.report('inspect').failure.message,/ShowCountdownTimer/);
    const n=h.getCalls.length;h.config(false);h.config(true);assert.equal(h.getCalls.length,n);
    const t=h.make();t.onUpdate();assert.equal(t.text,undefined);
  });
  await test('missing timer identifies a skipped target without installing another hook', async () => {
    const h=harness({noTimer:true});await h.install();assert.equal(h.report('install:result').reason,'target-missing');
    assert.equal(h.Countdown.prototype.__onUpdate,undefined);
  });
  await test('missing onUpdate and an existing saved original report distinct skip reasons', async () => {
    const h=harness();delete h.Countdown.prototype.onUpdate;await h.install();
    assert.equal(h.report('install:result').reason,'onUpdate-missing');
    const k=harness();k.Countdown.prototype.__onUpdate=k.Countdown.prototype.onUpdate;await k.install();
    assert.equal(k.report('install:result').reason,'saved-original-exists');
  });
  await test('failed text creation retains original failure and only logs once per timer', async () => {
    const h=harness({noText:true});await h.install();const t=h.make();
    for(let i=0;i<50;i++)assert.throws(()=>t.onUpdate(),/labelSize/);
    assert.equal(t.nativeCalls,50);assert.equal(t.RemainValue,15);
    assert.equal(h.events('text:create').length,1);assert.equal(h.events('text:error').length,1);
    assert.equal(h.report('text:error').text,null);
  });
  await test('native exception identity is preserved and text creation is not reached', async () => {
    const h=harness({nativeError:true});await h.install();const t=h.make();
    assert.throws(()=>t.onUpdate(),e=>e===h.originalError);assert.equal(h.events('native:error').length,1);
    assert.equal(h.getCalls.filter(x=>x==='SgsSpriteFilterBtn').length,0);
  });
  await test('label setter failure is logged and rethrows the identical exception', async () => {
    const h=harness({textError:true});await h.install();const t=h.make();
    assert.throws(()=>t.onUpdate(),e=>e===h.textError);assert.equal(t.nativeCalls,1);
    assert.equal(h.report('text:error').message,'label failure');
  });
  await test('switch off keeps native timing and the pre-existing stale label behavior', async () => {
    const h=harness();await h.install();const t=h.make();t.onUpdate();h.config(false);t.tweenPos=.5;t.onUpdate();
    assert.equal(t.RemainValue,10);assert.equal(t.text.label,'15');assert.equal(t.text.parent,t);
    assert.equal(h.report('inspect').enabled,false);
    const k=harness({enabled:false});await k.install();const other=k.make();other.onUpdate();assert.equal(other.text,undefined);
  });
  await test('debug-open snapshot reads self/other timers and text layout without constructing instances', async () => {
    const h=harness();await h.install();const t=h.make();t.onUpdate();
    h.scene.SelfSeatUi.countdownTimer=t;h.scene.seatContainer.seatUIs.push({otherTopManager:{countdownTimer:h.make()}});
    const n=h.getCalls.length;h.inspect();assert.equal(h.getCalls.length,n);assert.equal(h.report('inspect').timerCount,2);
    const data=JSON.parse(h.events('inspect:timer')[0].line.split(' ').slice(2).join(' '));
    assert.equal(data.text.attached,true);assert.equal(data.attachedToStage,true);assert.equal(data.text.field.text,'15');
  });
  await test('snapshot distinguishes a cached old native callback from the installed prototype', async () => {
    const h=harness();const t=h.make();t.updateHandler={method:t.onUpdate};h.scene.SelfSeatUi.countdownTimer=t;
    await h.install();h.inspect();const data=h.report('inspect:timer');
    assert.equal(data.currentIsOurHook,true);assert.equal(data.capturedMatchesCurrent,false);assert.equal(data.capturedIsOurHook,false);
  });
  await test('a captured new callback and a later-created instance remain covered', async () => {
    const h=harness();await h.install();const t=h.make();t.updateHandler={method:t.onUpdate};h.scene.SelfSeatUi.countdownTimer=t;
    t.updateHandler.method.call(t);h.inspect();assert.equal(h.report('inspect:timer').capturedIsOurHook,true);
  });
  await test('repeated start is idempotent; dispose removes both diagnostic listeners only', async () => {
    const h=harness();await h.install();h.diagnostics.start();
    assert.equal(h.listeners.get('xc:play-countdown-diagnose').size,1);assert.equal(h.listeners.get('xc:config-change').size,1);
    const wrapper=h.Countdown.prototype.onUpdate;h.diagnostics.dispose();assert.equal(h.Countdown.prototype.onUpdate,wrapper);
    assert.equal(h.listeners.get('xc:play-countdown-diagnose').size,0);assert.equal(h.listeners.get('xc:config-change').size,0);
    const n=h.logs.length;h.make().onUpdate();assert.equal(h.logs.length,n);
  });
  await test('logger failure does not change original calls or text updates', async () => {
    const h=harness({logError:true});await h.install();const t=h.make();t.onUpdate();assert.equal(t.text.label,'15');
    assert.equal(t.nativeCalls,1);
  });
  await test('per-session first-frame logs are bounded across many timer instances', async () => {
    const h=harness();await h.install();for(let i=0;i<40;i++)h.make().onUpdate();
    assert.equal(h.events('update:first').length,16);assert.equal(h.events('text:updated').length,16);
  });
  await test('debug-open reports an unavailable core listener without installing it', async () => {
    const h=harness();h.inspect();assert.equal(h.events('inspect:unavailable').length,1);assert.equal(h.getCalls.length,0);
  });
  process.stdout.write(passed+' passed\n');
})().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
