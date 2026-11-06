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
const quanyu=slice('  const quanYuDisplay =','  function _0x43fd79({');
const skinButton=slice('  // 皮肤屏蔽按钮：','  // 顶部广播按钮：');
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
  let discardCards=[];
  const options={document,window,storage,readCards:()=>cards,readDiscardCards:()=>discardCards,renderKnownCard:card=>{
    const node=document.createElement('button');node.className='shoupai';node.textContent=String(card.id);return node;
  }};
  const api=createDeckVisibilityPanel(options);
  api.mountControls();api.refresh(true);
  installSkinEffectButton();quanYuDisplay.mountControls();
  const control=()=>document.getElementById('xcDeckVisibilityControl');
  const input=()=>document.getElementById('xcDeckVisibilityToggle');
  const caption=()=>control().querySelector('.explanation');
  const popup=()=>document.getElementById('xcDeckVisibilitySettings');
  const region=side=>popup().querySelector('[data-region="'+side+'"]');
  const center=node=>{const r=node.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
  function submit(top,bottom,discard){popup().querySelector('[name="topLimit"]').value=top;popup().querySelector('[name="bottomLimit"]').value=bottom;
    if(discard!==undefined)popup().querySelector('[name="discardLimit"]').value=discard;
    popup().querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
  function alignment(){
    const own=center(control().querySelector('.slider')),general=center(getHandSortSwitchAnchor(document.getElementById('generalSwitch')));
    const top=center(document.querySelector('#xcTopMarqueeSwitchRow .slider'));
    assert(Math.abs(own.x-top.x)<1,'deck column '+JSON.stringify({own,top,general}));
    assert(Math.abs(own.y-general.y)<1&&own.x>general.x&&own.y>top.y,'general row and below marquee');
  }
  function quanyuAlignment(){
    const own=center(document.querySelector('#xcQuanYuDisplayControl .slider'));
    const skin=center(document.querySelector('#xcSkinEffectSwitchRow .slider'));
    const deck=center(control().querySelector('.slider'));
    assert(Math.abs(own.x-skin.x)<1&&Math.abs(own.y-deck.y)<1&&own.x>deck.x&&own.y>skin.y,
      'quanyu after deck, below skin '+JSON.stringify({own,skin,deck}));
  }
  check('quanyu toggle mounts after deck below skin with native layout and no gear',()=>{
    quanyuAlignment();
    const node=document.getElementById('xcQuanYuDisplayControl');
    assert(node.previousElementSibling===control());
    assert(node.querySelector('input').checked&&node.querySelector('.explanation').textContent==='权御全显');
    assert(getComputedStyle(node.querySelector('.explanation'),'::after').content==='none');
    quanYuDisplay.mountControls();assert(document.querySelectorAll('#xcQuanYuDisplayControl').length===1);
  });
  check('quanyu toggle persists and refreshes immediately, including label clicks',()=>{
    const input=document.getElementById('xcQuanYuDisplayToggle');
    document.querySelector('#xcQuanYuDisplayControl .explanation').click();
    assert(!input.checked&&!quanYuDisplay.allSelected&&localStorage.getItem('xcQuanYuAllSelected')==='false');
    input.click();assert(input.checked&&quanYuDisplay.allSelected&&window.quanYuRefreshes===2);
  });
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
    assert(popup().querySelector('[name="discardLimit"]').value==='20');
    assert(popup().querySelectorAll('input[data-region]').length===3&&['top','bottom','discard'].every(side=>region(side).checked));
    const box=popup().getBoundingClientRect(),anchor=caption().getBoundingClientRect();
    assert(Math.abs(box.left-anchor.left)<20,'popup anchored to caption');
    assert(box.top>=0&&box.bottom<=innerHeight&&box.right<=innerWidth);
    assert(!document.getElementById('deckEdgeUI'));
  });
  check('three switches have full tracks aligned with their text and no extra visible heading',()=>{
    assert(!popup().querySelector('legend')&&!popup().textContent.includes('区域显示'));
    assert(popup().querySelectorAll('input[data-region]').length===3);
    const rows=['top','bottom','discard'].map(side=>{
      const input=region(side),label=input.closest('label'),box=input.parentNode.getBoundingClientRect();
      const slider=input.parentNode.querySelector('.xc-deck-slider').getBoundingClientRect();
      const range=document.createRange();range.selectNode(label.firstChild);const text=range.getBoundingClientRect();
      assert(Math.abs(slider.width-56)<1&&Math.abs(slider.height-26)<1,'full 56x26 track for '+side);
      assert(Math.abs(slider.left-box.left)<1&&Math.abs(slider.top-box.top)<1,'track fills switch bounds for '+side);
      assert(Math.abs(text.top+text.height/2-slider.top-slider.height/2)<1,'text vertically centered for '+side);
      return {text,slider};
    });
    assert(rows.every(row=>Math.abs(row.text.left-rows[0].text.left)<1&&Math.abs(row.slider.left-rows[0].slider.left)<1),'shared text and switch columns');
  });
  check('invalid limits do not save; positive limits persist without enabling the float',()=>{
    submit('0','2.5');assert(api.getSettings().topLimit===20&&api.getSettings().bottomLimit===20);
    assert(popup().querySelector('[data-feedback]').textContent.includes('整数'));
    submit('7','11');assert(api.getSettings().topLimit===7&&api.getSettings().bottomLimit===11);
    assert(!api.getSettings().visible&&!document.getElementById('deckEdgeUI'));
    popup().querySelector('[data-close]').click();assert(!popup());
  });
  check('enabling master directly shows three regions and saved limits bound the views',()=>{
    input().checked=true;input().dispatchEvent(new Event('change',{bubbles:true}));
    const handles=document.querySelectorAll('#deckEdgeUI .xc-deck-origin');assert(handles.length===3);
    assert(!document.querySelector('#deckEdgeUI .xc-deck-toggle'));
    handles.forEach(button=>button.click());
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
    assert(JSON.stringify(fresh.getSettings())===JSON.stringify({visible:false,topLimit:4,bottomLimit:6,discardLimit:20,regions:{top:true,bottom:true,discard:true}}));fresh.dispose();
  });
  check('deck gear owns immediate independent switches and preserves choices with the master off',()=>{
    caption().click();region('top').click();region('bottom').click();
    assert(!api.getRegionVisibility().top&&!api.getRegionVisibility().bottom&&api.getRegionVisibility().discard);
    assert(!document.getElementById('deckEdgeUI')&&!input().checked);
    assert(JSON.stringify(JSON.parse(saved.get('xcDeckVisibilitySettings')).regions)===JSON.stringify({top:false,bottom:false,discard:true}));
    const fresh=createDeckVisibilityPanel(options);assert(!fresh.getRegionVisibility().top&&fresh.getRegionVisibility().discard);fresh.dispose();
    api.setRegionVisible('top',true);api.setRegionVisible('bottom',true);
    assert(region('top').checked&&region('bottom').checked,'open switches follow explicit setters');
    popup().querySelector('[data-close]').click();
  });
  check('all regions off removes the frame and reenabled discard immediately shows newest first',()=>{
    api.setVisible(true);caption().click();['top','bottom','discard'].forEach(side=>region(side).click());
    assert(!document.getElementById('deckEdgeUI')&&api.getSettings().visible);
    discardCards=Array.from({length:25},(_,i)=>({id:100+i,key:i===23?0:100+i}));api.refresh(true);
    assert(!document.getElementById('deckEdgeUI'));region('discard').click();
    assert([...document.querySelectorAll('#deckEdgeUI .xc-deck-origin')].map(x=>x.dataset.side).join(',')==='discard');
    const slots=[...document.querySelectorAll('#discardPileEdge .xc-deck-slot')];
    assert(slots.length===20&&slots[0].dataset.index==='0'&&slots[0].dataset.key==='124'&&slots[19].dataset.key==='105');
    assert(slots[1].dataset.key==='0','unknown slot counts toward newest window');
    assert(discardCards.length===25&&discardCards[0].id===100,'view must not cut history');
  });
  check('discard limit saves independently, rejects invalid submissions and preserves switch state',()=>{
    submit('4','6','5');assert(api.getSettings().discardLimit===5);
    assert([...document.querySelectorAll('#discardPileEdge .xc-deck-slot')].map(x=>x.dataset.key).join(',')==='124,0,122,121,120');
    submit('2','3','0');assert(api.getSettings().topLimit===4&&api.getSettings().bottomLimit===6&&api.getSettings().discardLimit===5);
    assert(popup().querySelector('[data-feedback]').textContent.includes('整数'));
    region('top').click();assert(api.getSettings().discardLimit===5,'visibility must not submit invalid draft limits');
    const fresh=createDeckVisibilityPanel(options);assert(fresh.getSettings().discardLimit===5&&fresh.getRegionVisibility().top);fresh.dispose();
    submit('4','6','20');api.setRegionVisible('bottom',true);api.setVisible(false);
    popup().querySelector('[data-close]').click();
  });
  check('closed switch callbacks cannot write and storage failures report only temporary effects',()=>{
    caption().click();const stale=region('top');popup().querySelector('[data-close]').click();
    const before=saved.get('xcDeckVisibilitySettings');stale.click();assert(saved.get('xcDeckVisibilitySettings')===before);
    caption().click();const setter=storage.setItem;storage.setItem=()=>{throw Error('denied');};region('top').click();
    assert(!api.getRegionVisibility().top&&popup().querySelector('[data-feedback]').textContent.includes('未能保存'));
    storage.setItem=setter;region('top').click();assert(api.getRegionVisibility().top);
    popup().querySelector('[data-close]').click();
  });
  check('native layout and anchored popup also work with a scaled main panel',()=>{
    document.getElementById('createIframe').style.transform='scale(.8)';marquee.requestMainPanel();alignment();caption().click();
    layoutSkinEffectButton();quanyuAlignment();
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
    quanYuDisplay.mountControls();assert(document.querySelectorAll('#xcQuanYuDisplayControl').length===1);
    stale({preventDefault(){},stopPropagation(){}});assert(!popup());
    assert(document.querySelectorAll('#xcDeckVisibilityControl').length===1);
    assert(!input().checked);
  });
  check('dispose removes controls, settings and float; late setters cannot restore them',()=>{
    caption().click();const stale=region('top'),before=saved.get('xcDeckVisibilitySettings');api.dispose();assert(!popup()&&!control()&&!document.getElementById('deckEdgeUI'));
    stale.click();assert(saved.get('xcDeckVisibilitySettings')===before);
    assert(api.setVisible(true)===false&&api.mountControls()===false);
    api.start();api.mountControls();assert(control());
  });
  check('quanyu cleanup removes its control and stale handler cannot save preferences',()=>{
    const input=document.getElementById('xcQuanYuDisplayToggle'),stale=input.onchange;
    const before=localStorage.getItem('xcQuanYuAllSelected');quanYuDisplay.cleanupControls();
    input.checked=!input.checked;stale({stopPropagation(){}});
    assert(!document.getElementById('xcQuanYuDisplayControl')&&localStorage.getItem('xcQuanYuAllSelected')===before);
    quanYuDisplay.mountControls();assert(document.getElementById('xcQuanYuDisplayControl'));
  });
  // Leave a representative screenshot of the actual control and settings.
  caption().click();
  document.getElementById('deckControlsResult').textContent=JSON.stringify(results);
}
const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert(browser);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xc-deck-controls-')),file=path.join(dir,'controls.html');
fs.writeFileSync(file,'<!doctype html><meta charset="utf-8"><style>body{background:#202125}*{transition:none!important;animation:none!important}#createIframe{position:absolute;left:30px;top:20px;width:380px;transform-origin:top left}#iframe-source{position:relative;display:flow-root}#deckControlsResult{display:none}</style><div id="createIframe"><div id="iframe-source">'+htmlTemplate+
  '</div></div><pre id="deckControlsResult">PENDING</pre><script>const createDeckVisibilityPanel='+createDeck.toString()+';const createTopMarqueeModule='+createMarquee.toString()+';'+helpers+
  'const laya={gamescene:null};window.quanYuRefreshes=0;function _0x43fd79(){window.quanYuRefreshes++}function appendLocalSkinDebugLine(){}'+quanyu+skinButton+
  '('+browserChecks.toString()+')().catch(error=>document.getElementById("deckControlsResult").textContent=JSON.stringify([{name:"uncaught",pass:false,error:String(error.stack)}]));</script>');
const screenshot=path.join(dir,'controls.png');const output=execFileSync(browser,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--no-sandbox','--disable-background-networking','--virtual-time-budget=1500','--window-size=1100,900','--user-data-dir='+path.join(dir,'profile'),'--screenshot='+screenshot,'--dump-dom',new URL('file:///'+file.replace(/\\/g,'/')).href],{encoding:'utf8',timeout:60000,maxBuffer:6e6,stdio:['ignore','pipe','pipe']});
fs.writeFileSync(path.join(dir,'dom.html'),output);process.stdout.write('Browser artifacts: '+dir+'\n');
const match=output.match(/<pre id="deckControlsResult">([^<]+)<\/pre>/);assert(match&&match[1]!=='PENDING');
const results=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
for(const item of results)process.stdout.write((item.pass?'PASS ':'FAIL ')+item.name+(item.error?' '+item.error:'')+'\n');
process.stdout.write('Screenshot: '+screenshot+'\n');assert(results.every(x=>x.pass),'controls browser verification failed');
