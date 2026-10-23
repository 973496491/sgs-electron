// Native settings template, real marquee alignment, deck master toggle and anchored settings.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const createDeck=require('../src/features/deck-visibility.js');
const createMarquee=require('../src/features/top-marquee.js');
const source=fs.readFileSync(path.join(__dirname,'../resources/daxiaochao.user.js'),'utf8');
function slice(a,b){const i=source.indexOf(a),j=source.indexOf(b,i);assert(i>=0&&j>i,a);return source.slice(i,j);}
const start=source.indexOf('  function D() {'),end=source.indexOf('    ];',start);
const data=vm.runInNewContext(source.slice(source.indexOf('[',start),end+5));
function decode(text){const alphabet='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';let value=0,count=0,bytes='';
  for(const char of text){const n=alphabet.indexOf(char);if(n<0)continue;value=count%4?64*value+n:n;if(count++%4)bytes+=String.fromCharCode(255&(value>>((-2*count)&6)));}
  return decodeURIComponent(Array.from(bytes,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));}
const template=data.filter(x=>x.length>3000).map(decode).find(x=>x.includes('id="wallpaperContainer"'));
assert(template);
const htmlTemplate=template.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/url\([^)]*\)/g,'none').replace(/\bsrc="https?:[^\"]*"/g,'');
const helpers=slice('  function findSwitchContainer(','  function setLocalSkinSwitchState(')+
  slice('  function getHandSortSwitchAnchor(','  // Hand-card main-panel host.');
async function browserChecks(){
  const results=[];
  function check(name,fn){try{fn();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:String(error)});}}
  const assert=(v,m)=>{if(!v)throw Error(m||'assertion failed');};
  const next=()=>new Promise(resolve=>setTimeout(resolve,50));
  const saved=new Map(),storage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
  const settings=document.getElementById('generalSwitch').closest('.setting.panel-content');
  settings.style.maxHeight='5000px';
  settings.previousElementSibling.classList.add('active');
  const marquee=createTopMarqueeModule({window,document,storage,getLaya:()=>null,getTimer:()=>null});
  marquee.start();marquee.attachMainPanel({findSwitchContainer,clearDuplicateIds,getAnchor:getHandSortSwitchAnchor});
  let cards=Array.from({length:50},(_,i)=>({id:i+1,key:i+1}));
  const options={document,window,storage,readCards:()=>cards,renderKnownCard:card=>{
    const node=document.createElement('button');node.className='shoupai';node.textContent=String(card.id);return node;
  }};
  const api=createDeckVisibilityPanel(options);
  api.mountControls();api.refresh(true);
  const control=()=>document.getElementById('xcDeckVisibilityControl');
  const input=()=>document.getElementById('xcDeckVisibilityToggle');
  const caption=()=>control().querySelector('.explanation');
  const popup=()=>document.getElementById('xcDeckVisibilitySettings');
  const center=node=>{const r=node.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
  function submit(top,bottom){popup().querySelector('[name="topLimit"]').value=top;popup().querySelector('[name="bottomLimit"]').value=bottom;
    popup().querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
  function alignment(){
    const own=center(control().querySelector('.slider')),general=center(getHandSortSwitchAnchor(document.getElementById('generalSwitch')));
    const top=center(document.querySelector('#xcTopMarqueeSwitchRow .slider'));
    assert(Math.abs(own.x-top.x)<1,'deck column '+JSON.stringify({own,top,general}));
    assert(Math.abs(own.y-general.y)<1&&own.x>general.x&&own.y>top.y,'general row and below marquee');
  }
  check('new master switch is default off and matches exact requested native grid position',()=>{
    assert(!input().checked&&!document.getElementById('deckEdgeUI'));alignment();
    assert(caption().textContent==='牌堆记录');
    assert(getComputedStyle(caption(),'::after').content!=='none','native gear icon present');
    assert(!input().id.endsWith('Switch'),'avoid native config binding');
  });
  check('gear opens nearby settings while off with default 20 and valid viewport bounds',()=>{
    caption().click();assert(popup());
    assert(popup().querySelector('[name="topLimit"]').value==='20');
    assert(popup().querySelector('[name="bottomLimit"]').value==='20');
    const box=popup().getBoundingClientRect(),anchor=caption().getBoundingClientRect();
    assert(Math.abs(box.left-anchor.left)<20,'popup anchored to caption');
    assert(box.top>=0&&box.bottom<=innerHeight&&box.right<=innerWidth);
    assert(!document.getElementById('deckEdgeUI'));
  });
  check('invalid limits do not save; positive limits persist without enabling the float',()=>{
    submit('0','2.5');assert(api.getSettings().topLimit===20&&api.getSettings().bottomLimit===20);
    assert(popup().querySelector('[data-feedback]').textContent.includes('整数'));
    submit('7','11');assert(api.getSettings().topLimit===7&&api.getSettings().bottomLimit===11);
    assert(!api.getSettings().visible&&!document.getElementById('deckEdgeUI'));
    popup().querySelector('[data-close]').click();assert(!popup());
  });
  check('only enabling master reveals both buttons and saved limits bound the live views',()=>{
    input().checked=true;input().dispatchEvent(new Event('change',{bubbles:true}));
    const buttons=document.querySelectorAll('#deckEdgeUI .xc-deck-toggle');assert(buttons.length===2);
    buttons.forEach(button=>button.click());
    assert(document.querySelectorAll('#deckTopEdge .xc-deck-slot').length===7);
    assert(document.querySelectorAll('#deckBottomEdge .xc-deck-slot').length===11);
    caption().click();submit('4','6');
    assert(document.querySelectorAll('#deckTopEdge .xc-deck-slot').length===4);
    assert(document.querySelectorAll('#deckBottomEdge .xc-deck-slot').length===6);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!popup());
  });
  check('master off removes the float during later refresh and next instance restores settings',()=>{
    input().checked=false;input().dispatchEvent(new Event('change',{bubbles:true}));api.refresh(true);
    assert(!document.getElementById('deckEdgeUI'));
    const fresh=createDeckVisibilityPanel(options);
    assert(JSON.stringify(fresh.getSettings())===JSON.stringify({visible:false,topLimit:4,bottomLimit:6}));fresh.dispose();
  });
  check('native layout and anchored popup also work with a scaled main panel',()=>{
    document.getElementById('createIframe').style.transform='scale(.8)';marquee.requestMainPanel();alignment();caption().click();
    const box=popup().getBoundingClientRect(),anchor=caption().getBoundingClientRect();
    assert(Math.abs(box.left-anchor.left)<20&&box.bottom<=innerHeight);
    document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));assert(!popup());
  });
  caption().click();settings.style.display='none';await next();
  check('collapsing the parent closes its anchored settings',()=>assert(!popup()));
  settings.style.display='';document.getElementById('createIframe').style.transform='';marquee.requestMainPanel();
  check('repeated mounting and native DOM replacement keep one control and invalidate stale settings handlers',()=>{
    api.mountControls();api.mountControls();assert(document.querySelectorAll('#xcDeckVisibilityControl').length===1);
    caption().click();const stale=caption().onclick;
    const oldRow=control().parentNode;
    oldRow.parentNode.replaceChild(oldRow.cloneNode(true),oldRow);
    // Simulate addFrame replacing the whole settings template, without keeping the injected clone.
    document.querySelectorAll('#xcDeckVisibilityControl').forEach(node=>node.remove());
    api.mountControls();assert(!popup());
    stale({preventDefault(){},stopPropagation(){}});assert(!popup());
    assert(document.querySelectorAll('#xcDeckVisibilityControl').length===1);
    assert(!input().checked);
  });
  check('dispose removes controls, settings and float; late setters cannot restore them',()=>{
    caption().click();api.dispose();assert(!popup()&&!control()&&!document.getElementById('deckEdgeUI'));
    assert(api.setVisible(true)===false&&api.mountControls()===false);
    api.start();api.mountControls();assert(control());
  });
  // Leave a representative screenshot of the actual control and settings.
  caption().click();
  document.getElementById('deckControlsResult').textContent=JSON.stringify(results);
}
const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert(browser);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xc-deck-controls-')),file=path.join(dir,'controls.html');
fs.writeFileSync(file,'<!doctype html><meta charset="utf-8"><style>body{background:#202125}*{transition:none!important;animation:none!important}#createIframe{position:absolute;left:30px;top:20px;width:380px;transform-origin:top left}#iframe-source{position:relative;display:flow-root}#deckControlsResult{display:none}</style><div id="createIframe"><div id="iframe-source">'+htmlTemplate+
  '</div></div><pre id="deckControlsResult">PENDING</pre><script>const createDeckVisibilityPanel='+createDeck.toString()+';const createTopMarqueeModule='+createMarquee.toString()+';'+helpers+
  '('+browserChecks.toString()+')().catch(error=>document.getElementById("deckControlsResult").textContent=JSON.stringify([{name:"uncaught",pass:false,error:String(error.stack)}]));</script>');
const screenshot=path.join(dir,'controls.png');const output=execFileSync(browser,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--no-sandbox','--disable-background-networking','--virtual-time-budget=1500','--window-size=1100,900','--user-data-dir='+path.join(dir,'profile'),'--screenshot='+screenshot,'--dump-dom',new URL('file:///'+file.replace(/\\/g,'/')).href],{encoding:'utf8',timeout:60000,maxBuffer:6e6,stdio:['ignore','pipe','pipe']});
fs.writeFileSync(path.join(dir,'dom.html'),output);process.stdout.write('Browser artifacts: '+dir+'\n');
const match=output.match(/<pre id="deckControlsResult">([^<]+)<\/pre>/);assert(match&&match[1]!=='PENDING');
const results=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
for(const item of results)process.stdout.write((item.pass?'PASS ':'FAIL ')+item.name+(item.error?' '+item.error:'')+'\n');
process.stdout.write('Screenshot: '+screenshot+'\n');assert(results.every(x=>x.pass),'controls browser verification failed');
