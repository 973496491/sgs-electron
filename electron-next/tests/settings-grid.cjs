// Real settings template and dynamic control owners; game actions are mocked.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const source = fs.readFileSync(path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8').replace(/\r\n/g, '\n');
function slice(a,b) { const i=source.indexOf(a),j=source.indexOf(b,i);assert(i>=0&&j>i,a);return source.slice(i,j); }
const p=source.indexOf('  function D() {'),e=source.indexOf('    ];',p);
const strings=vm.runInNewContext(source.slice(source.indexOf('[',p),e+5));
const a='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/',b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const decode=t=>Buffer.from([...t].map(c=>a.includes(c)?b[a.indexOf(c)]:c).join(''),'base64').toString('utf8');
const template=strings.filter(t=>t.length>3000).map(decode).find(t=>t.includes('id="wallpaperContainer"'));
const factories=['hand-cards','top-marquee','deck-visibility'].map((name,i)=>'const '+['createHand','createMarquee','createDeck'][i]+'='+require('../src/features/'+name+'.js').toString()+';').join('\n');
const helpers=slice('  function findSwitchContainer(', '  function setLocalSkinSwitchState(')+slice('  function layoutClonedSwitchButton(', '  function setDebugSwitchState(')+slice('  function insertDebugButton(', '  // Hand-card main-panel host.');
const layout=slice('  const settingsLayout = (() => {','  // 仅拥有秒杀区域')+slice('  const secKillPanel = (() => {','  function addFrame() {')+slice('  function _0x3f649d(', '  const _0x1b7acc =');
const owners=slice('  const quanYuDisplay =','  function _0x43fd79({')+slice('  // 皮肤屏蔽按钮：','  window.__xcInstallSkinEffectButton =');
function originalFunction(name){const i=source.indexOf('  function '+name+'('),j=source.indexOf('\n  }\n',i);assert(i>=0&&j>i);return source.slice(i,j+5);}
const popups=['initCardThemePopup','_0x208a6c','_0x310ee8','_0x5fdac7'].map(originalFunction).join('\n');
async function browserChecks() {
  const results=[],check=(name,fn)=>{fn();results.push(name);};
  const assert=(v,m)=>{if(!v)throw Error(m||'assertion failed');};
  const next=()=>new Promise(r=>setTimeout(r,80));
  const originalIds=Array.from(document.querySelectorAll('[id]'),n=>n.id);
  const saved=new Map(),storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
  const general=()=>document.getElementById('xcSettingsGeneral'), blocking=()=>document.getElementById('xcSettingsBlocking');
  const setting=()=>general().closest('.setting');
  const openParent=()=>{setting().previousElementSibling.classList.add('active');setting().style.maxHeight='5000px';};
  const host={findSwitchContainer,clearDuplicateIds,clearText:setLocalSkinLabel,getAnchor:getHandSortSwitchAnchor,
    placeControl:settingsLayout.place,getControls:()=>({exchange:document.getElementById('CDKNotificationSwitch'),debug:document.getElementById('localSkinDebugSwitch'),settings:document.getElementById('wallpaperContainer')})};
  const hand=createHand({window,document,storage,client:{getContainer:()=>null,getScene:()=>null,getSelectionContext:()=>null,isEnabled:()=>true,sort:()=>true}});
  const marquee=createMarquee({window,document,storage,getLaya:()=>null,getTimer:()=>null});
  const deck=createDeck({window,document,storage,placeControl:settingsLayout.place,readCards:()=>[],readDiscardCards:()=>[],renderKnownCard:()=>document.createElement('span')});
  function mount(){
    openParent();settingsLayout.mount();secKillPanel.mount();
    insertLocalSkinButton(document.getElementById('cardBackThemeSwitch'));
    insertDebugButton(document.getElementById('cardBackThemeSwitch'));
    hand.start();hand.attachMainPanel(host);hand.mount();
    marquee.start();marquee.attachMainPanel(host);installSkinEffectButton();
    deck.start();deck.mountControls();quanYuDisplay.mountControls();_0x3f649d();
  }
  function cleanup(){hand.dispose();marquee.dispose();deck.dispose();quanYuDisplay.cleanupControls();cleanupSkinEffectButton();secKillPanel.dispose();}
  const ordered=grid=>Array.from(grid.children).filter(n=>n.querySelector('input')&&getComputedStyle(n).display!=='none').sort((x,y)=>+getComputedStyle(x).order-+getComputedStyle(y).order);
  function assertGrid(grid){
    assert(getComputedStyle(grid).display==='grid','grid display');
    const items=ordered(grid);assert(items.length>0);
    for(let i=0;i<items.length;i++){
      const rect=items[i].getBoundingClientRect();assert(rect.width>50&&rect.height>30,'visible cell '+items[i].textContent);
      assert(getComputedStyle(items[i]).position==='static','normal flow');
      if(i%3)assert(Math.abs(rect.top-items[i-1].getBoundingClientRect().top)<1,'same row');
      else if(i)assert(rect.top>=items[i-3].getBoundingClientRect().bottom,'next row');
      if(i%3)assert(rect.left>=items[i-1].getBoundingClientRect().right-1,'no overlap');
    }
  }
  mount();await next();
  check('all three sections use three-column automatic lists',()=>{assertGrid(general());assertGrid(blocking());assertGrid(document.getElementById('xcSettingsDaily'));});
  check('all three lists use the reduced eight-pixel row gap',()=>{
    for(const id of ['xcSettingsGeneral','xcSettingsBlocking','xcSettingsDaily'])assert(getComputedStyle(document.getElementById(id)).rowGap==='8px',id);
  });
  const gearIds=['skinPaperSwitch','cardBackThemeSwitch','effectBlockSwitch','handSortPanelSwitch','xcDeckVisibilityToggle'];
  function assertGears(hitTest=false){
    for(const id of gearIds){
      const item=document.getElementById(id).closest('.xc-settings-flow-item'),caption=item.querySelector('.explanation');
      const icons=caption.querySelectorAll('.xc-settings-gear svg');
      assert(icons.length===1,'one explicit gear for '+id);
      const rect=icons[0].getBoundingClientRect();assert(rect.width>=11&&rect.height>=11,'visible vector gear for '+id);
      assert(getComputedStyle(caption,'::after').content==='none','no duplicate pseudo gear for '+id);
      if(hitTest){
        caption.scrollIntoView({block:'center'});
        const hit=icons[0].getBoundingClientRect(),target=document.elementFromPoint(hit.left+hit.width/2,hit.top+hit.height/2);
        assert(target&&caption.contains(target),'gear hit reaches original caption for '+id);
      }
    }
  }
  check('all five original settings captions have visible vector gears',()=>assertGears(true));
  check('wallpaper, card theme and effect-block gear clicks use original popup handlers',()=>{
    initCardThemePopup();_0x310ee8();_0x5fdac7();
    for(const [id,dialogId] of [['skinPaperSwitch','wallpaperDialog'],['cardBackThemeSwitch','cardThemeDialog'],['effectBlockSwitch','blockEffectDialog']]){
      const input=document.getElementById(id),before=input.checked;
      input.closest('.xc-settings-flow-item').querySelector('.xc-settings-gear').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      const dialog=document.getElementById(dialogId);assert(dialog.open,'original dialog '+dialogId);assert(input.checked===before,'gear does not toggle '+id);dialog.close();
    }
  });
  check('effect-block popup stays centered in the game viewport with bounded scrolling',()=>{
    const input=document.getElementById('effectBlockSwitch'),dialog=document.getElementById('blockEffectDialog');
    const gear=input.closest('.xc-settings-flow-item').querySelector('.xc-settings-gear');
    const open=()=>gear.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    function centered(){
      const rect=dialog.getBoundingClientRect();
      const width=document.documentElement.clientWidth,height=document.documentElement.clientHeight;
      assert(Math.abs(rect.left+rect.width/2-width/2)<1,'horizontal viewport center');
      assert(Math.abs(rect.top+rect.height/2-height/2)<1,'vertical viewport center');
      assert(rect.left>=15&&rect.top>=15&&rect.right<=width-15&&rect.bottom<=height-15,'visible viewport bounds');
    }
    open();assert(dialog.open);centered();dialog.querySelector('.dialog-close-btn').click();assert(!dialog.open,'original close button');
    const shell=document.getElementById('createIframe'),transform=shell.style.transform;
    shell.style.transform='scale(0.7)';open();centered();
    window.dispatchEvent(new Event('resize'));centered();
    assert(getComputedStyle(dialog).overflowY==='auto','overflow scroll policy');
    dialog.close();shell.style.transform=transform;
    open();centered();dialog.dispatchEvent(new MouseEvent('click',{bubbles:true}));assert(!dialog.open,'original backdrop close');
  });
  check('blocking heading matches daily style and precedes daily section',()=>{
    const heading=document.getElementById('xcSettingsBlockingHeading'),daily=document.getElementById('xcSettingsDaily').previousElementSibling;
    assert(heading.textContent==='屏蔽设置'&&heading.className===daily.className);
    for(const k of ['fontSize','color','fontWeight','paddingTop'])assert(getComputedStyle(heading)[k]===getComputedStyle(daily)[k]);
    assert(heading.compareDocumentPosition(daily)&Node.DOCUMENT_POSITION_FOLLOWING);
  });
  check('blocking list has exact requested order and 3+2 rows',()=>{
    assert(ordered(blocking()).map(n=>n.querySelector('input').id).join(',')==='xcTopMarqueeToggle,xcSkinEffectToggle,generalSwitch,xcQuanYuDisplayToggle,effectBlockSwitch');
  });
  check('general settings and daily controls fill removed positions without empty cells',()=>{assert(ordered(general()).length===17);assert(ordered(document.getElementById('xcSettingsDaily')).length===8);});
  check('original IDs and hidden activation/seckill defaults remain',()=>{
    for(const id of originalIds)assert(document.querySelectorAll('[id="'+id+'"]').length===1,'ID '+id);
    assert(document.getElementById('xcSecKillPanel').hidden&&!document.getElementById('xcSecKillPanelToggle').checked);
    assert(document.getElementById('ACSubmit').closest('.ACContainer').style.display==='none');
  });
  check('dynamic controls keep their original change handlers',()=>{
    const toggle=document.getElementById('xcTopMarqueeToggle');toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));assert(marquee.isBlocked());
    const skin=document.getElementById('xcSkinEffectToggle');skin.checked=true;skin.dispatchEvent(new Event('change',{bubbles:true}));assert(window.__xcIsSkinEffectsBlocked());
    const q=document.getElementById('xcQuanYuDisplayToggle');q.checked=false;q.dispatchEvent(new Event('change',{bubbles:true}));assert(!quanYuDisplay.allSelected);
    const show=document.getElementById('handSortPanelSwitch');show.checked=true;show.dispatchEvent(new Event('change',{bubbles:true}));assert(hand.isVisible());
  });
  check('hand and deck settings gears still open their original panels',()=>{
    document.getElementById('xcHandSortSettingsButton').querySelector('.xc-settings-gear').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));assert(document.getElementById('xcHandSortSettingsDialog').open);hand.closeSettings();
    document.getElementById('xcDeckVisibilityControl').querySelector('.xc-settings-gear').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));assert(document.getElementById('xcDeckVisibilitySettings'));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  });
  check('removing an item automatically fills its cell',()=>{
    const item=ordered(blocking())[1],following=ordered(blocking())[2],old=item.getBoundingClientRect();item.remove();
    assert(Math.abs(following.getBoundingClientRect().left-old.left)<1,'gap filled');blocking().appendChild(item);assertGrid(blocking());
  });
  const styles=ordered(general()).concat(ordered(blocking())).map(n=>n.getAttribute('style')).join('|');
  for(let i=0;i<5;i++)mount();await next();
  check('repeated installs keep unique controls and stable normal-flow styles',()=>{
    assert(ordered(general()).length===17&&ordered(blocking()).length===5);assert(styles===ordered(general()).concat(ordered(blocking())).map(n=>n.getAttribute('style')).join('|'));
    assertGears();
  });
  const shell=document.getElementById('createIframe');shell.style.transform='scale(0.8)';await next();
  check('scaled panel still has three aligned columns',()=>{assertGrid(general());assertGrid(blocking());});shell.style.transform='';
  setting().previousElementSibling.classList.remove('active');setting().style.maxHeight='';await next();
  check('layout notifications do not reopen collapsed settings',()=>assert(setting().style.maxHeight===''));
  openParent();_0x3f649d();
  check('expanded settings height includes new groups',()=>assert(parseFloat(setting().style.maxHeight)>=setting().scrollHeight));
  const markup=document.getElementById('iframe-source').innerHTML;
  const oldLocal=document.getElementById('localSkinThemeSwitch').closest('label.switch');
  const oldSource=document.getElementById('cardBackThemeSwitch');
  cleanup();document.getElementById('iframe-source').innerHTML=markup;
  // Remove copied dynamic DOM; each owner recreates its own handlers.
  for(const id of ['localSkinThemeSwitch','localSkinDebugSwitch']){const input=document.getElementById(id);input?.closest('.xc-settings-flow-item')?.remove();}
  for(const id of ['xcHandSortSwitchRow','xcTopMarqueeSwitchRow','xcSkinEffectSwitchRow','xcDeckVisibilityControl','xcQuanYuDisplayControl'])document.getElementById(id)?.remove();
  document.getElementById('handSortPanelLabel')?.remove();mount();await next();
  check('DOM rebuild restores list layout and dynamic owners without duplicate inputs',()=>{
    assertGrid(general());assertGrid(blocking());assert(ordered(general()).length===17&&ordered(blocking()).length===5);
    const ids=Array.from(setting().querySelectorAll('input[id]'),n=>n.id);assert(ids.length===new Set(ids).size);
    assertGears();
  });
  check('old local skin layout callbacks cannot steal rebuilt captions',()=>{
    const caption=document.getElementById('localSkinThemeLabel'),parent=caption.parentNode;
    layoutLocalSkinButton(oldLocal,oldSource);
    assert(caption.isConnected&&caption.parentNode===parent);
  });
  cleanup();await next();
  check('dispose removes owned dynamic controls and no callbacks recreate them',()=>{
    for(const id of ['handSortPanelSwitch','xcTopMarqueeToggle','xcSkinEffectToggle','xcDeckVisibilityToggle','xcQuanYuDisplayToggle'])assert(!document.getElementById(id),id);
  });
  mount();setting().scrollIntoView();
  document.getElementById('xcSettingsGridTestResult').textContent=JSON.stringify(results);
}
const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);assert(browser);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xc-settings-grid-test-')),file=path.join(dir,'test.html');
const html=template.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/url\([^)]*\)/g,'none').replace(/\bsrc="https?:[^"]*"/g,'');
const stubs='const LOCAL_SKIN_SWITCH_ID="localSkinThemeSwitch",LOCAL_SKIN_LABEL_ID="localSkinThemeLabel",LOCAL_SKIN_TEXT="本地皮肤",DEBUG_SWITCH_ID="localSkinDebugSwitch",DEBUG_LABEL_ID="localSkinDebugLabel",DEBUG_TEXT="打开调试",DEBUG_BUTTON_X_OFFSET=0;function isLocalSkinLocked(){return false}function setLocalSkinSwitchState(i,v){i.checked=v;i.disabled=v}function enableLocalSkinFromButton(){}function setDebugSwitchState(i){i.checked=false}function openDebugFromButton(){}const laya={gamescene:null};function _0x43fd79(){}function appendLocalSkinDebugLine(){}let blocked=false;window.__xcSetSkinEffectsBlocked=v=>blocked=v;window.__xcIsSkinEffectsBlocked=()=>blocked;';
const tables=require('../../doc/彩虹表.js').tables;
const popupStubs='const globalConfig={},popupTable='+JSON.stringify(tables._0x871b.all)+',themeTable='+JSON.stringify(tables._0x262d.all)+';const _0x41a3d0=i=>popupTable[i],_0x43fec8=i=>themeTable[i];function _0x126168(){return ()=>{}}function _0x327542(){throw Error("unexpected popup fallback")}';
fs.writeFileSync(file,'<!doctype html><meta charset="utf-8"><style>#createIframe{width:380px;transform-origin:top left}*{transition:none!important;animation:none!important}</style><div id="createIframe"><div id="iframe-source">'+html+'</div></div><pre id="xcSettingsGridTestResult">PENDING</pre><script>'+stubs+popupStubs+factories+helpers+layout+owners+popups+'('+browserChecks.toString()+')().catch(e=>document.getElementById("xcSettingsGridTestResult").textContent=JSON.stringify({error:e.stack}));</script>');
const output=execFileSync(browser,['--headless','--disable-gpu','--no-sandbox','--no-first-run','--disable-background-networking','--virtual-time-budget=2500','--window-size='+(process.env.SETTINGS_GRID_TEST_WINDOW||'1100,1200'),'--user-data-dir='+path.join(dir,'profile'),'--screenshot='+path.join(dir,'layout.png'),'--dump-dom','file:///'+file.replace(/\\/g,'/')],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:8e6,stdio:['ignore','pipe','pipe']});
fs.writeFileSync(path.join(dir,'dom.html'),output);process.stdout.write('Artifacts: '+dir+'\n');
const match=output.match(/<pre id="xcSettingsGridTestResult">([^<]+)<\/pre>/);assert(match&&match[1]!=='PENDING');
const result=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));assert(Array.isArray(result),JSON.stringify(result));
for(const name of result)process.stdout.write('PASS '+name+'\n');
