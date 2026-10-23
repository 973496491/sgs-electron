// Real Chromium DOM, CSS, clicks and pointer dragging. No game/network needed.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const createPanel = require("../src/features/deck-visibility.js");
const source = fs.readFileSync(path.join(__dirname,"../resources/daxiaochao.user.js"),"utf8");
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
  const api=createDeckVisibilityPanel({document,window,readCards:()=>cards,renderKnownCard:card=>{
    const face=document.createElement('button');face.className='shoupai'+(card.id%2?' R':'');
    face.textContent=({7:'♦7杀',48:'♥9桃',91:'♠A闪'})[card.id]||String(card.id);return face;
  }});
  api.setVisible(true);
  api.refresh(true);
  const buttons=()=>document.querySelectorAll('#deckEdgeUI .xc-deck-toggle');
  const slots=id=>document.querySelectorAll('#'+id+' .xc-deck-slot');
  check('independent fixed body overlay with vertically stacked controls',()=>{
    const root=document.getElementById('deckEdgeUI');
    assert(root.parentNode===document.body);
    assert(getComputedStyle(root).position==='fixed');
    assert(buttons().length===2);
    assert(buttons()[1].getBoundingClientRect().top>=buttons()[0].getBoundingClientRect().bottom);
    assert(document.getElementById('deckTopEdge').hidden&&document.getElementById('deckBottomEdge').hidden);
  });
  check('click expands cards and unknowns with a leftmost origin tile and no displayed indexes',()=>{
    buttons()[0].click();buttons()[1].click();
    assert(slots('deckTopEdge').length===6&&slots('deckBottomEdge').length===6);
    assert([...slots('deckTopEdge')].map(x=>x.dataset.key).join(',')==='7,0,0,48,0,91');
    assert([...slots('deckBottomEdge')].map(x=>x.dataset.key).join(',')==='91,0,48,0,0,7');
    assert(document.querySelectorAll('#deckTopEdge .xc-deck-unknown').length===3);
    assert(buttons()[0].getAttribute('aria-expanded')==='true');
    assert(buttons()[0].textContent.includes('▾'));
    assert(buttons()[0].getBoundingClientRect().width<150,'title should fit text, not the viewport width');
    assert(buttons()[1].getBoundingClientRect().width<150);
    assert(document.querySelectorAll('.xc-deck-index').length===0);
    for(const [id,text] of [['deckTopEdge','顶'],['deckBottomEdge','底']]){
      const list=document.getElementById(id),origin=list.firstElementChild;
      assert(origin.className==='xc-deck-origin'&&origin.textContent===text);
      assert(!origin.hasAttribute('data-key'));
      assert(origin.getBoundingClientRect().left<slots(id)[0].getBoundingClientRect().left);
      assert([...slots(id)].every(x=>x.children.length===1&&!x.title));
      assert(getComputedStyle(list).direction==='ltr'&&getComputedStyle(list).flexDirection==='row');
    }
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
  check('closed direction stays closed during consumption and reopens with current cards',()=>{
    buttons()[1].click();cards.shift();cards.pop();api.refresh(true);
    assert(document.getElementById('deckBottomEdge').hidden);
    buttons()[1].click();
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
  check('one outer resize grip sizes both views and survives close, refresh and remount',()=>{
    const view=side=>document.querySelector('.xc-deck-viewport[data-side="'+side+'"]');
    const top=view('top'),bottom=view('bottom');
    const root=document.getElementById('deckEdgeUI'),grip=root.querySelector('.xc-deck-resize');
    const topBefore=top.getBoundingClientRect(),bottomBefore=bottom.getBoundingClientRect(),before=root.getBoundingClientRect();
    assert(document.querySelectorAll('.xc-deck-resize').length===1&&grip.parentNode===root);
    assert(!top.querySelector('.xc-deck-resize')&&!bottom.querySelector('.xc-deck-resize'));
    grip.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
    grip.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
    assert(top.getBoundingClientRect().width>topBefore.width);
    assert(bottom.getBoundingClientRect().width>bottomBefore.width);
    assert(top.getBoundingClientRect().width===bottom.getBoundingClientRect().width);
    assert(root.getBoundingClientRect().height<before.height);
    const width=root.style.width,height=root.style.height;
    buttons()[0].click();assert(top.hidden);buttons()[0].click();
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
  check('dragging a button moves the float without toggling and stays within viewport',()=>{
    const root=document.getElementById('deckEdgeUI'),before=root.getBoundingClientRect();
    const btn=buttons()[0],open=btn.getAttribute('aria-expanded');
    btn.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1,clientX:before.left+20,clientY:before.top+20}));
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:before.left-80,clientY:before.top+50,cancelable:true}));
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1}));btn.click();
    assert(root.getBoundingClientRect().left<before.left);
    assert(btn.getAttribute('aria-expanded')===open);
    assert(root.getBoundingClientRect().top>=0&&root.getBoundingClientRect().right<=window.innerWidth);
  });
  check('dispose invalidates stale handlers and pending refresh; start can recreate',()=>{
    const stale=buttons()[0].onclick;
    api.dispose();api.refresh(true);assert(!document.getElementById('deckEdgeUI'));
    api.start();cards=[{key:7,id:7},{key:0,id:14},{key:48,id:48},{key:91,id:91}];api.refresh(true);
    const open=buttons()[0].getAttribute('aria-expanded');
    stale({preventDefault(){},stopPropagation(){}});
    assert(buttons()[0].getAttribute('aria-expanded')===open);
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
    assert(buttons()[1].getBoundingClientRect().width<150);
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
  document.getElementById('result').textContent=JSON.stringify(results);
}
fs.writeFileSync(htmlPath,'<!doctype html><meta charset="utf-8"><style>'+css+
  '\nbody{background:#202125!important}#result{display:none}</style><div id="seatUI"></div><div id="createIframe"></div><pre id="result">PENDING</pre><script>const createDeckVisibilityPanel='+
  createPanel.toString()+';('+browserChecks.toString()+')();</script>');
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
