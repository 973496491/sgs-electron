// Real settings markup/layout and module in Chromium; native cards are isolated fixtures.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const vm = require('node:vm'), http = require('node:http'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const script = process.argv[2] || path.join(__dirname, '../resources/daxiaochao.user.js');
const source = fs.readFileSync(script, 'utf8');
const createClient = require(process.argv[2] ? path.join(path.dirname(script), 'modules/adapters/selection-ratings-client.js') : '../src/adapters/selection-ratings-client.js');
const createFeature = require(process.argv[2] ? path.join(path.dirname(script), 'modules/features/selection-ratings.js') : '../src/features/selection-ratings.js');
function slice(a, b) { const start = source.indexOf(a), end = source.indexOf(b, start); assert(start > 0 && end > start); return source.slice(start, end); }
const strings = slice('  function D() {', '    ];');
const encoded = vm.runInNewContext(strings.slice(strings.indexOf('[')) + ']');
function decode(value) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';
  let bytes = '', data = 0, count = 0;
  for (const c of value) { const n = chars.indexOf(c); if (n < 0) continue; data = count % 4 ? data * 64 + n : n;
    if (count++ % 4) bytes += String.fromCharCode(255 & (data >> ((-2 * count) & 6))); }
  return decodeURIComponent([...bytes].map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
}
const markup = encoded.filter(t => t.length > 3000).map(decode).find(t => t.includes('id="seatUISwitch"'));
assert(markup); const layout = slice('  const settingsLayout = (() => {', '  window.__xcPlaceSettingsControl = settingsLayout.place;');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-rating-settings-'));
const description = '显示当前模式下, 所属身份和座次所在的武将评分, 当前服务器返回的评分中: 谋周瑜和曹金玉缺失信息';
const html = `<!DOCTYPE html><meta charset="utf-8"><style>body{background:#202020;margin:0}#createIframe{width:380px;margin:20px}#iframe-source{position:relative;display:flow-root}#result{color:#eee;white-space:pre-wrap}</style><body><div id="createIframe"><div id="iframe-source"></div></div><pre id="result">PENDING</pre><script>
window.onerror=message=>document.getElementById('result').textContent='FAIL '+message;
const temp=document.createElement('div');temp.innerHTML=${JSON.stringify(markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''))};
for(const style of temp.querySelectorAll('style'))document.head.appendChild(style);
const panel=temp.querySelector('.setting.panel-content');document.getElementById('iframe-source').appendChild(panel);
panel.style.display='block';panel.style.maxHeight='none';panel.style.height='auto';
${layout}
settingsLayout.mount();
const createClient=${createClient.toString()},createFeature=${createFeature.toString()};
const checks=[];function check(value,label){if(!value)throw Error(label);checks.push(label);}
class Node{constructor(){this.children=[];this.width=94;this.height=131;this.x=0;this.y=40;this.visible=true;this.parent={};}addChild(n){n.parent=this;this.children.push(n);}destroy(){this.destroyed=true;if(this.parent.children)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}}
const card=new Node();card.Card={CardId:716};const win=new Node();win.name='SelectGeneralWindow';win.generalUis=[card];win.enterWindow=function(){};win.Close=function(){this.visible=false;};
const manager={GetWindow:()=>win,GetWindowData:name=>name===win.name?win:null};
const client=createClient({getLaya:()=>({class:n=>n==='WindowManager'?manager:{IsFigureMode:true,SelfFigure:2}}),getEngine:()=>({Text:Node}),getGrades:()=>[{id:716,Grade_4:7}]});
const make=()=>createFeature({window,document,storage:localStorage,client,placeControl:c=>settingsLayout.place(c),refreshLayout:()=>{}});
const wait=()=>new Promise(resolve=>setTimeout(resolve,300));
(async()=>{
 localStorage.removeItem('xcGeneralRatingsEnabled');let feature=make();feature.start();await wait();
 let input=document.getElementById('xcGeneralRatingsToggle'),control=document.getElementById('xcGeneralRatingsControl');
 check(!!input&&input.checked,'default enabled and mounted');
 check(control.querySelector('.explanation').textContent==='武将评分','caption exact');
 check(control.dataset.tooltip===${JSON.stringify(description)},'description exact');
 check(control.parentNode.id==='xcSettingsGeneral','normal settings group');
 check([...panel.querySelectorAll(':scope > h4[data-xc-settings-heading]')].map(n=>n.textContent).join(',')==='常用设置,屏蔽设置,普通设置,调试','four section headings exact and ordered');
 for(const id of ['skipProbWindowSwitch','countDownSwitch','seatUISwitch','autoSignSwitch'])check(document.getElementById(id).closest('.xc-settings-grid').id==='xcSettingsDaily','normal group '+id);
 const sqk=document.getElementById('autoSQKSwitch');check(sqk.closest('.xc-settings-grid').id==='xcSettingsGeneral'&&sqk.closest('.xc-settings-flow-item').querySelector('.explanation').textContent==='定向刷牌'&&sqk.closest('.xc-settings-flow-item').getAttribute('data-tooltip')==='斗地主使用, 自动使用手气卡定向刷到选中的牌','directed reroll caption and description in common group');
 check(card.children.some(c=>c.name==='xcSelectionRating'&&c.text==='7/10'),'enabled reaches score labels');
 const debug=document.createElement('label');debug.className='switch';const caption=document.createElement('span');caption.className='explanation';caption.textContent='打开调试';
 const debugInput=document.createElement('input');debugInput.type='checkbox';debugInput.id='localSkinDebugSwitch';
 const debugSlider=document.createElement('span'),debugStatus=document.createElement('span');debugSlider.className='slider';debugStatus.className='status';
 debug.append(caption,debugInput,debugSlider,debugStatus);panel.querySelector('#xcSettingsGeneral').appendChild(debug);
 check(settingsLayout.place(debug,caption),'late debug control placed');
 check(document.getElementById('xcSettingsTrailing').querySelectorAll('input').length===1,'debug section contains only its live debug control');
 check(panel.lastElementChild.id==='xcSettingsTrailing','debug group last overall');
 const others=[...panel.querySelectorAll('input')].filter(n=>n!==debugInput&&n.getBoundingClientRect().height>0);
 check(debugInput.getBoundingClientRect().top>=Math.max(...others.map(n=>n.getBoundingClientRect().top)),'debug visually after all controls');
 feature.mount();feature.start();check(document.querySelectorAll('#xcGeneralRatingsToggle').length===1,'repeated mount idempotent');
 let generic=0;input.addEventListener('change',()=>generic++);input.click();
 check(generic===0,'own handler prevents generic config writes');check(localStorage.getItem('xcGeneralRatingsEnabled')==='false','false persisted');
 check(document.getElementById('xcGeneralRatingsControl')===control&&!input.checked,'disabled control stays mounted');
 check(!card.children.some(c=>c.name==='xcSelectionRating'),'off removes current labels');
 feature.dispose();check(!document.getElementById('xcGeneralRatingsToggle'),'dispose removes control');
 feature=make();feature.start();await wait();input=document.getElementById('xcGeneralRatingsToggle');
 check(!input.checked&&!feature.isEnabled(),'new instance restores saved false');
 input.click();await wait();
 check(localStorage.getItem('xcGeneralRatingsEnabled')==='true'&&card.children.some(c=>c.name==='xcSelectionRating'),'UI enable restores live labels and saves true');
 const stale=input,oldGrid=panel.querySelector('#xcSettingsGeneral'),newGrid=oldGrid.cloneNode(true);
 newGrid.querySelector('#xcGeneralRatingsControl').remove();oldGrid.replaceWith(newGrid);feature.mount();
 check(document.querySelectorAll('#xcGeneralRatingsToggle').length===1&&document.getElementById('xcGeneralRatingsToggle').checked,'panel rebuild restores one control and current state');
 stale.checked=false;stale.dispatchEvent(new Event('change',{bubbles:true}));check(feature.isEnabled(),'old detached handler cannot change new control');
 const extra=document.createElement('div');panel.appendChild(extra);settingsLayout.mount();
 check(panel.lastElementChild.id==='xcSettingsTrailing'&&panel.querySelectorAll(':scope > h4[data-xc-settings-heading]').length===4,'layout rebuild preserves four sections and debug at end');
 check(document.getElementById('xcGeneralRatingsControl').getBoundingClientRect().width>0,'actual CSS control visible');
 document.getElementById('result').textContent='PASS '+checks.length+' '+JSON.stringify(checks);
})().catch(e=>document.getElementById('result').textContent='FAIL '+e.stack);
</script>`;
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
server.listen(0, '127.0.0.1', () => {
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--window-size=900,1100','--dump-dom','--virtual-time-budget=3500','--user-data-dir='+profile,
    '--screenshot='+path.join(profile,'settings.png'),'http://127.0.0.1:'+server.address().port], { windowsHide:true });
  let output='', errors=''; chrome.stdout.on('data',b=>output+=b);chrome.stderr.on('data',b=>errors+=b);
  const timeout=setTimeout(()=>chrome.kill(),30000);
  chrome.on('close',()=>{clearTimeout(timeout);server.close();fs.writeFileSync(path.join(profile,'result.html'),output);
    const result=output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];process.stdout.write((result||errors.slice(-1000))+'\nArtifacts: '+profile+'\n');
    process.exitCode=result?.startsWith('PASS ')?0:1;});
});
