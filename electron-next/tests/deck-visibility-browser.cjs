// Real Chromium DOM, CSS, clicks and pointer dragging. No game/network needed.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const createPanel = require("../src/features/deck-visibility.js");
const source = fs.readFileSync(path.join(__dirname,"../resources/daxiaochao.user.js"),"utf8");
const markStart=source.indexOf('  function markRecordedCardUncertain('),markEnd=source.indexOf('  const _Card = class n {',markStart);
assert(markStart>=0&&markEnd>markStart);
const markSource=source.slice(markStart,markEnd);
const start = source.indexOf("  function D() {"), end = source.indexOf("    ];",start);
const strings = vm.runInNewContext(source.slice(source.indexOf("[",start),end+5));
function decode(text) {
  const alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
  let value=0,count=0,bytes="";
  for(const char of text){const n=alphabet.indexOf(char);if(n<0)continue;value=count%4?64*value+n:n;
    if(count++%4)bytes+=String.fromCharCode(255&(value>>((-2*count)&6)));}
  return decodeURIComponent(Array.from(bytes,c=>"%"+c.charCodeAt(0).toString(16).padStart(2,"0")).join(""));
}
const template=strings.filter(x=>x.length>3000).map(decode).find(x=>x.includes('id="paiduiCards"'));
assert(template);
const css=[...template.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(x=>x[1]).join("\n")
  .replace(/url\([^)]*\)/g,"none");
const browser=[process.env.DECK_TEST_BROWSER,"C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(x=>x&&fs.existsSync(x));
assert(browser,"No Chromium executable found");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"xc-deck-browser-"));
const htmlPath=path.join(dir,"deck.html");
function browserChecks() {
  const results=[];
  function check(name,fn){try{fn();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:String(error)});}}
  function assert(value,message){if(!value)throw Error(message||"assertion failed");}
  let cards=[{key:7,id:7},{key:0,id:14},{key:0,id:22},{key:48,id:48},{key:0,id:93},{key:91,id:91}];
  let discardCards=[{key:48,id:48},{key:0,id:999},{key:7,id:7},{key:-1,id:14},{key:0,id:998}];
  const api=createDeckVisibilityPanel({document,window,readCards:()=>cards,readDiscardCards:()=>discardCards,renderKnownCard:card=>{
    const face=document.createElement('button');face.className='shoupai'+(card.id%2?' R':'');
    face.textContent=({7:'♦7杀',48:'♥9桃',91:'♠A闪'})[card.id]||String(card.id);return face;
  }});
  api.setVisible(true);
  api.refresh(true);
  const handles=()=>document.querySelectorAll('#deckEdgeUI .xc-deck-origin');
  const slots=id=>document.querySelectorAll('#'+id+' .xc-deck-slot');
  check('independent fixed overlay immediately displays three regions without title toggles',()=>{
    const root=document.getElementById('deckEdgeUI');
    assert(root.parentNode===document.body);
    assert(getComputedStyle(root).position==='fixed');
    assert(handles().length===3);
    assert(handles()[1].getBoundingClientRect().top>=handles()[0].getBoundingClientRect().bottom);
    assert(handles()[2].getBoundingClientRect().top>=handles()[1].getBoundingClientRect().bottom);
    assert(!document.querySelector('.xc-deck-toggle'));
    assert(!document.getElementById('deckTopEdge').hidden&&!document.getElementById('deckBottomEdge').hidden&&!document.getElementById('discardPileEdge').hidden);
  });
  check('origin buttons do not collapse cards and stay leftmost without visible indexes',()=>{
    const preferences=JSON.stringify(api.getSettings());handles().forEach(button=>button.click());
    assert(JSON.stringify(api.getSettings())===preferences);
    assert(slots('deckTopEdge').length===6&&slots('deckBottomEdge').length===6);
    assert([...slots('deckTopEdge')].map(x=>x.dataset.key).join(',')==='7,0,0,48,0,91');
    assert([...slots('deckBottomEdge')].map(x=>x.dataset.key).join(',')==='91,0,48,0,0,7');
    assert(document.querySelectorAll('#deckTopEdge .xc-deck-unknown').length===3);
    assert([...handles()].every(button=>button.tagName==='BUTTON'&&!button.hasAttribute('aria-expanded')&&button.onclick===null));
    assert([...handles()].map(button=>button.textContent).join(',')==='顶,底,弃');
    assert([...handles()].every(button=>button.getBoundingClientRect().width<50),'origin handles stay compact');
    assert(document.querySelectorAll('.xc-deck-index').length===0);
    for(const [id,text] of [['deckTopEdge','顶'],['deckBottomEdge','底'],['discardPileEdge','弃']]){
      const list=document.getElementById(id),origin=list.firstElementChild;
      assert(origin.className==='xc-deck-origin'&&origin.textContent===text);
      assert(!origin.hasAttribute('data-key'));
      assert(origin.getBoundingClientRect().left<slots(id)[0].getBoundingClientRect().left);
      assert([...slots(id)].every(x=>x.children.length===1&&!x.title));
      assert(getComputedStyle(list).direction==='ltr'&&getComputedStyle(list).flexDirection==='row');
    }
  });
  check('discard renders newest first at index zero without mutating model order',()=>{
    const original=JSON.stringify(discardCards),deckBefore=[...slots('deckTopEdge')].map(x=>x.dataset.key).join(',');
    assert([...slots('discardPileEdge')].map(x=>x.dataset.key).join(',')==='0,0,7,0,48');
    assert([...slots('discardPileEdge')].map(x=>x.dataset.index).join(',')==='0,1,2,3,4');
    assert(document.querySelectorAll('#discardPileEdge .xc-deck-unknown').length===3);
    api.refresh(true);assert(JSON.stringify(discardCards)===original,'view must not mutate discard order');
    discardCards.push({key:91,id:91},{key:0,id:997});api.refresh(true);
    assert([...slots('discardPileEdge')].map(x=>x.dataset.key).join(',')==='0,91,0,0,7,0,48');
    assert([...slots('deckTopEdge')].map(x=>x.dataset.key).join(',')===deckBefore);
    api.setRegionVisible('discard',false);discardCards.splice(2,1);api.refresh(true);
    assert(!document.getElementById('discardPileEdge'));
    api.setRegionVisible('discard',true);assert([...slots('discardPileEdge')].map(x=>x.dataset.key).join(',')==='0,91,0,0,0,48');
    discardCards=Array.from({length:30},(_,i)=>({key:0,id:900+i}));api.refresh(true);
    assert(slots('discardPileEdge').length===20,'discard defaults to the latest twenty positions even when all unknown');
    assert(slots('discardPileEdge')[0].dataset.index==='0'&&slots('discardPileEdge')[0].dataset.sourceIndex==='29');
    api.setLimits(20,20,30);assert(slots('discardPileEdge').length===30,'discard has its own adjustable limit');
    discardCards=[];api.refresh(true);assert(slots('discardPileEdge').length===0);
    assert(document.getElementById('discardPileEdge').firstElementChild.textContent==='弃');
    discardCards=[{key:48,id:48},{key:0,id:999},{key:7,id:7},{key:0,id:998}];api.refresh(true);
  });
  check('pending deck faces keep order and get red frames without extra question marks',()=>{
    const original=cards,ids=[...slots('deckTopEdge')].map(node=>node.dataset.key).join(',');
    cards=cards.map(card=>({...card,uncertain:card.key>0}));api.refresh(true);
    assert([...slots('deckTopEdge')].map(node=>node.dataset.key).join(',')===ids);
    for(const slot of slots('deckTopEdge')){
      if(slot.dataset.key==='0')continue;
      const style=getComputedStyle(slot.firstElementChild);
      assert(slot.dataset.uncertain==='true'&&slot.title.includes('待确认'));
      assert(style.borderColor==='rgb(255, 77, 79)'&&style.borderWidth==='1px'&&style.borderStyle==='solid');
      assert(style.outlineStyle==='none','pending frame stays inside the card box');
      assert(slot.children.length===1,'red frame only, no extra question-mark badge');
    }
    cards=original;api.refresh(true);
    assert([...slots('deckTopEdge')].every(slot=>!slot.dataset.uncertain),'same IDs must repaint when certainty changes');
  });
  check('pending ownership has a constant 1px border inside clipped seat rows and clears on confirmation',()=>{
    const record=document.createElement('button');record.className='shoupai G';record.title='两张候选';record.innerHTML='<span class="shoupai">7</span><span class="shoupai">14</span>';
    const row=document.createElement('div');row.className='sorder-body';row.style.cssText='position:fixed;left:20px;top:300px;width:140px';row.append(record);document.body.append(row);
    const before=record.getBoundingClientRect(),childBefore=record.firstElementChild.getBoundingClientRect();
    markRecordedCardUncertain(record,true);const mirror=record.cloneNode(true);row.append(mirror);
    assert(getComputedStyle(row).overflow==='hidden'&&!row.matches(':hover'),'exercise the collapsed seat style');
    const after=record.getBoundingClientRect(),childAfter=record.firstElementChild.getBoundingClientRect();
    assert(before.width===after.width&&before.height===after.height&&childBefore.width===childAfter.width&&childBefore.height===childAfter.height,'marking preserves card sizes');
    for(const node of [record,mirror]){
      assert(node.dataset.uncertain==='true'&&node.title.includes('归属待确认'));
      assert(node.firstElementChild.dataset.uncertain==='true'&&node.firstElementChild.title.includes('归属待确认'));
      for(const face of [node,...node.children]){
        const style=getComputedStyle(face);
        assert(style.borderColor==='rgb(255, 77, 79)'&&style.borderWidth==='1px'&&style.borderStyle==='solid');
        assert(style.outlineStyle==='none','no external outline for overflow:hidden to clip');
      }
    }
    markRecordedCardUncertain(record,false);markRecordedCardUncertain(mirror,false);
    assert(!record.dataset.uncertain&&!mirror.dataset.uncertain&&!record.firstElementChild.dataset.uncertain&&record.title==='两张候选');
    assert(getComputedStyle(record).borderColor==='rgb(0, 0, 0)'&&getComputedStyle(record.firstElementChild).borderColor==='rgb(0, 0, 0)');row.remove();
  });
  check('legacy 48px and disabled-card CSS cannot clip the expanded lists',()=>{
    const list=document.getElementById('deckTopEdge');
    assert(getComputedStyle(list).maxHeight!=='48px');
    assert(getComputedStyle(list).overflow==='visible');
    for(const slot of slots('deckTopEdge'))assert(slot.getBoundingClientRect().height>0);
    assert(!list.classList.contains('sorder-body'));
  });
  check('hidden recorder and seat panels do not hide the independent overlay',()=>{
    document.getElementById('seatUI').style.display='none';
    document.getElementById('createIframe').style.display='none';
    assert(document.getElementById('deckEdgeUI').getBoundingClientRect().height>0);
  });
  check('settings-hidden direction stays absent during consumption and returns directly with current cards',()=>{
    api.setRegionVisible('bottom',false);cards.shift();cards.pop();api.refresh(true);
    assert(!document.getElementById('deckBottomEdge'));
    api.setRegionVisible('bottom',true);
    assert([...slots('deckTopEdge')].map(x=>x.dataset.key).join(',')==='0,0,48');
    assert([...slots('deckBottomEdge')].map(x=>x.dataset.key).join(',')==='0,48');
  });
  check('all 150 slots are reachable by scrolling, with no list truncation',()=>{
    api.setLimits(150,150);
    cards=Array.from({length:150},(_,i)=>({key:i===0||i===149?i+1:0,id:i+1}));api.refresh(true);
    assert(slots('deckTopEdge').length===150&&slots('deckBottomEdge').length===150);
    const panel=document.querySelector('.xc-deck-panel');
    assert(panel.scrollHeight>panel.clientHeight);
    panel.scrollTop=panel.scrollHeight;
    assert(panel.scrollTop>0);
  });
  check('one outer resize grip sizes all three views and survives close, refresh and remount',()=>{
    const view=side=>document.querySelector('.xc-deck-viewport[data-side="'+side+'"]');
    const top=view('top'),bottom=view('bottom');
    let root=document.getElementById('deckEdgeUI'),grip=root.querySelector('.xc-deck-resize');
    const topBefore=top.getBoundingClientRect(),bottomBefore=bottom.getBoundingClientRect(),before=root.getBoundingClientRect();
    assert(document.querySelectorAll('.xc-deck-resize').length===1&&grip.parentNode===root);
    assert(!top.querySelector('.xc-deck-resize')&&!bottom.querySelector('.xc-deck-resize'));
    grip.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
    grip.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
    assert(top.getBoundingClientRect().width>topBefore.width);
    assert(bottom.getBoundingClientRect().width>bottomBefore.width);
    assert(top.getBoundingClientRect().width===bottom.getBoundingClientRect().width);
    assert(top.getBoundingClientRect().width===view('discard').getBoundingClientRect().width);
    assert(root.getBoundingClientRect().height<before.height);
    const width=root.style.width,height=root.style.height;
    api.setRegionVisible('top',false);assert(!view('top'));api.setRegionVisible('top',true);
    root=document.getElementById('deckEdgeUI');grip=root.querySelector('.xc-deck-resize');
    cards.shift();api.refresh(true);
    assert(root.style.width===width&&root.style.height===height);
    assert(slots('deckTopEdge').length===149);
    const stale=grip.onpointerdown;
    api.reset();api.refresh(true);
    assert(document.getElementById('deckEdgeUI').style.width===width&&document.getElementById('deckEdgeUI').style.height===height);
    stale({button:0,pointerId:3,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}});
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:3,clientX:300,clientY:300}));
    assert(document.getElementById('deckEdgeUI').style.width===width,'stale resize handle must be inert');
  });
  check('dragging an origin moves the float, survives refresh and never collapses its region',()=>{
    const root=document.getElementById('deckEdgeUI'),before=root.getBoundingClientRect();
    const btn=handles()[0],count=slots('deckTopEdge').length;
    btn.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1,clientX:before.left+20,clientY:before.top+20}));
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:before.left-80,clientY:before.top+50,cancelable:true}));
    cards[1].key=cards[1].id;api.refresh(true);assert(handles()[0]===btn,'card refresh retains the active handle');
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1}));btn.click();
    assert(root.getBoundingClientRect().left<before.left);
    assert(slots('deckTopEdge').length===count&&!document.getElementById('deckTopEdge').hidden);
    assert(root.getBoundingClientRect().top>=0&&root.getBoundingClientRect().right<=window.innerWidth);
  });
  check('dispose invalidates stale handlers and pending refresh; start can recreate',()=>{
    const stale=handles()[0].onpointerdown;
    api.dispose();api.refresh(true);assert(!document.getElementById('deckEdgeUI'));
    api.start();cards=[{key:7,id:7},{key:0,id:14},{key:48,id:48},{key:91,id:91}];api.refresh(true);
    const left=document.getElementById('deckEdgeUI').style.left;
    stale({button:0,pointerId:7,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}});
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:7,clientX:300,clientY:200}));
    assert(document.getElementById('deckEdgeUI').style.left===left);
    api.refresh(true);assert(document.querySelectorAll('#deckEdgeUI').length===1);
  });
  check('outer corner resizes the whole float, stays reachable while scrolling, and clamps extreme sizes',()=>{
    const top=document.querySelector('.xc-deck-viewport[data-side="top"]');
    const bottom=document.querySelector('.xc-deck-viewport[data-side="bottom"]');
    const root=document.getElementById('deckEdgeUI'),panel=root.querySelector('.xc-deck-panel');
    const grip=root.querySelector('.xc-deck-resize');
    const move=(dx,dy)=>{
      grip.dispatchEvent(new PointerEvent('pointerdown',{button:0,pointerId:4,clientX:200,clientY:200,bubbles:true,cancelable:true}));
      window.dispatchEvent(new PointerEvent('pointermove',{pointerId:4,clientX:200+dx,clientY:200+dy,cancelable:true}));
      window.dispatchEvent(new PointerEvent('pointerup',{pointerId:4}));
    };
    move(90,100);
    assert(bottom.getBoundingClientRect().width>=350);
    assert(top.getBoundingClientRect().width===bottom.getBoundingClientRect().width);
    assert(handles()[1].getBoundingClientRect().width<50);
    assert(!document.getElementById('deckBottomEdge').hidden);
    move(-10000,-10000);
    assert(root.getBoundingClientRect().width===160&&root.getBoundingClientRect().height===100);
    const before=grip.getBoundingClientRect();panel.scrollTop=panel.scrollHeight;
    assert(grip.getBoundingClientRect().top===before.top,'resize grip must not scroll with cards');
    move(10000,10000);
    assert(root.getBoundingClientRect().width<=window.innerWidth-16);
    assert(root.getBoundingClientRect().height<=Math.floor(window.innerHeight*.7));
    const box=root.getBoundingClientRect();move(340-box.width,240-box.height);panel.scrollTop=0;
  });
  cards=cards.map((card,index)=>({...card,uncertain:index===0||index===2}));api.refresh(true);
  document.getElementById('result').textContent=JSON.stringify(results);
}
fs.writeFileSync(htmlPath,'<!doctype html><meta charset="utf-8"><style>'+css+
  '\nbody{background:#202125!important}#result{display:none}</style><div id="seatUI"></div><div id="createIframe"></div><pre id="result">PENDING</pre><script>const createDeckVisibilityPanel='+
  createPanel.toString()+';'+markSource+'('+browserChecks.toString()+')();</script>');
const screenshot=path.join(dir,"deck.png");
const output=execFileSync(browser,["--headless","--disable-gpu","--no-first-run","--no-default-browser-check",
  "--no-sandbox","--disable-background-networking","--allow-file-access-from-files","--window-size=1100,800",
  "--user-data-dir="+path.join(dir,"profile"),"--screenshot="+screenshot,"--dump-dom",new URL('file:///'+htmlPath.replace(/\\/g,'/')).href],
  {encoding:"utf8",maxBuffer:5e6,timeout:60000,stdio:["ignore","pipe","pipe"]});
const match=output.match(/<pre id="result">([^<]+)<\/pre>/);
fs.writeFileSync(path.join(dir,"dom.html"),output);
process.stdout.write('Browser artifacts: '+dir+'\n');
assert(match&&match[1]!=="PENDING","browser did not finish");
const results=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&gt;/g,'>').replace(/&lt;/g,'<'));
for(const result of results)process.stdout.write((result.pass?'PASS ':'FAIL ')+result.name+(result.error?' '+result.error:'')+'\n');
process.stdout.write('Screenshot: '+screenshot+'\n');
assert(results.every(x=>x.pass),'browser checks failed');
