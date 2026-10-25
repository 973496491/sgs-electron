// Real Card/Zone/logic plus the assembled floating overlay; game services/DOM are simulated.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { harness, source, slice } = require("./visible-card-chain.cjs");
const createPanel = require("../src/features/deck-visibility.js");
const { assemble } = require("../scripts/build-userscript-modules.cjs");
let passed = 0;
function check(name, test) { test(); passed++; process.stdout.write("PASS " + name + "\n"); }
const keys = "Zone.obj['1-255'].map(card=>card.key>0?card.id:0)";

function overlayHarness(saved = { visible: true }) {
  const h = harness();
  h.context.storedSettings = saved === null ? null : JSON.stringify(saved);
  h.run(`
    globalThis.localStorage={getItem(){return storedSettings;},setItem(key,value){storedSettings=value;}};
    const elementProto = Object.getPrototypeOf(document.createElement('div'));
    Object.defineProperty(elementProto,'parentNode',{get(){return this.parentElement;}});
    Object.defineProperty(elementProto,'firstChild',{get(){return this.children[0]||null;}});
    elementProto.removeChild=function(child){child.remove();return child;};
    elementProto.setAttribute=function(key,value){this[key]=String(value);};
    elementProto.getAttribute=function(key){return this[key]||null;};
    elementProto.getBoundingClientRect=function(){return {left:parseFloat(this.style.left)||0,top:parseFloat(this.style.top)||0};};
    const oldAppend=elementProto.appendChild;
    elementProto.appendChild=function(child){if(child.fragment){child.children.slice().forEach(node=>oldAppend.call(this,node));return child;}return oldAppend.call(this,child);};
    const oldQuery=elementProto.querySelectorAll;
    elementProto.querySelectorAll=function(selector){return selector===':scope>.xc-deck-slot'?this.children.filter(x=>x.className==='xc-deck-slot'):oldQuery.call(this,selector);};
    document.body=document.createElement('body');
    document.createDocumentFragment=()=>Object.assign(document.createElement('div'),{fragment:true});
    const oldGet=document.getElementById;
    document.getElementById=id=>oldGet(id)||(()=>{const find=node=>node.id===id?node:node.children.map(find).find(Boolean);return find(document.body)||null;})();
    globalThis.listeners=new Map();
    globalThis.innerWidth=1024;globalThis.innerHeight=768;
    globalThis.addEventListener=(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);};
    globalThis.removeEventListener=(name,fn)=>{if(listeners.has(name))listeners.get(name).delete(fn);};
    globalThis.UI={seatUIs:[{}]};
    globalThis.handles=()=>document.getElementById('deckEdgeUI').children[0].children.slice(1).map(section=>section.children[0].children[0].firstChild);

    globalThis.readSlots=id=>document.getElementById(id).children.filter(x=>x.className==='xc-deck-slot').map(x=>({index:Number(x.dataset.index),key:Number(x.dataset.key)}));
  `);
  h.run(slice("  // BEGIN GENERATED MODULE: deck-visibility", "  function _0x226fc5(") +
    slice("  function _0x2f6cfa(", "  function syncZoneMirrors(") +
    slice("  function drawDeckEdgeUI(", "  function debounce("));
  return h;
}

check("independent module is assembled and included in the release mapping", () => {
  if (!process.argv.includes('--source')) assert.equal(assemble(source), source);
  const moduleText = slice("  // BEGIN GENERATED MODULE: deck-visibility", "  // END GENERATED MODULE: deck-visibility");
  assert(moduleText.replace(/\r\n/g,'\n').includes(createPanel.toString().replace(/\r\n/g,'\n').replace(/\n(?=.)/g,'\n  ')), "exact deck factory is embedded in the loaded script");
  const mapping = JSON.parse(fs.readFileSync(path.join(__dirname,"../release-files.json"),"utf8"));
  assert(mapping.files.some(x=>x.source==='electron-next/src/features/deck-visibility.js'&&x.target==='modules/features/deck-visibility.js'));
  assert(source.includes("deckVisibilityPanel.dispose();") && source.includes("deckVisibilityPanel.start();") &&
    source.includes("deckVisibilityPanel.mountControls();"));
  assert(!slice("  function _0x188d85(", "  function resetOrderContainer(").includes("n(111)"), "legacy seat-attached deck root removed");
});
check("ranges preserve every unknown index and include all known cards in either direction", () => {
  const cards = [0,7,0,14,0].map((key,index)=>({key,id:key||100+index}));
  const view = createPanel({}).getRanges(cards);
  assert.deepEqual(view.top.map(x=>[x.index,x.known?x.card.id:0]),[[0,0],[1,7],[2,0],[3,14]]);
  assert.deepEqual(view.bottom.map(x=>[x.index,x.known?x.card.id:0]),[[4,0],[3,14],[2,0],[1,7]]);
  assert.deepEqual(createPanel({}).getRanges([{id:7,key:-1},{id:14,key:0}]),{top:[],bottom:[]});
});
check("top partial disclosure preserves the received identities without mutating payload", () => {
  const h=harness();h.run(`Zone.init([7,14,22,48,93],'1-255');globalThis.ids=[7,0,22];
    move({FromID:255,FromZone:1,FromPosition:DING,ToID:255,ToZone:1,ToPosition:DING,CardIDs:ids,CardCount:3,MoveType:21});flush();`);
  assert.deepEqual(h.value(keys),[7,0,22,0,0]);assert.deepEqual(h.value("ids"),[7,0,22]);
});
check("bottom partial skill disclosure reverses slots, never identifies the hidden ID", () => {
  const h=harness();h.run(`Zone.init([7,14,22,48,93],'1-255');
    logic({ClassName:'CGsRoleSpellOptRep',SpellID:3336,Type:50,Datas:[93,0,22]});flush();`);
  assert.deepEqual(h.value(keys),[0,0,22,0,93]);
});
check("offset disclosure uses position plus length and skips unknown slots", () => {
  const h=harness();h.run(`Zone.init([7,14,22,48,93],'1-255');new Zone(255,1,2).show([22,0,93]);flush();`);
  assert.deepEqual(h.value(keys),[0,0,22,0,93]);
});
check("partial top draw consumes every slot and retains its visible hand card", () => {
  const h=harness();h.run(`Zone.init([7,14,22,48,93],'1-255');
    move({FromID:255,FromZone:1,FromPosition:DING,ToID:2,ToZone:5,CardIDs:[0,14,0],CardCount:3});flush();`);
  assert.equal(h.run("Zone.obj['1-255'].length"),2);assert.equal(h.run("Zone.obj['5-2'].length"),3);
  assert.deepEqual(h.value("Zone.shoupai(2)"),[14]);
});
check("partial return from an unordered hand preserves known positions at top and bottom", () => {
  for(const [toPosition,expected] of [[65280,[22,0,7]],[0,[7,0,22]]]){
    const h=harness();h.run(`setHiddenHand(2,[7,14,22]);
      move({FromID:2,FromZone:5,ToID:255,ToZone:1,ToPosition:${toPosition},CardIDs:[7,0,22],CardCount:3,MoveType:21});flush();`);
    assert.deepEqual(h.value(toPosition===65280?keys+".slice(0,3)":keys+".slice(-3)"),expected);
    assert.equal(h.run("Zone.obj['5-2'].length"),0);
    assert.deepEqual(h.value("logs.filter(x=>x.includes('event:error'))"),[]);
  }
});
check("one body-level float directly shows three regions with compact origin handles", () => {
  const h=overlayHarness();h.run(`elements.delete('paiduiCards');Zone.init([7,14,22,48,93],'1-255');
    new Zone(255,1).show([0,14,0,48]);flush();`);
  assert.equal(h.run("document.getElementById('deckEdgeUI').parentNode===document.body"),true);
  assert.equal(h.run("handles().length"),3);
  assert.equal(h.run("document.getElementById('deckBottomEdge').hidden"),false);
  assert.equal(h.run("document.getElementById('discardPileEdge').hidden"),false);
  assert.deepEqual(h.value("handles().map(x=>x.textContent)"),['顶','底','弃']);
  assert.equal(h.run("handles().every(x=>!x.onclick&&!x.getAttribute('aria-expanded'))"),true);
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[0,14,0,48]);
  assert.deepEqual(h.value("readSlots('deckBottomEdge').map(x=>x.key)"),[0,48,0,14]);
  assert.deepEqual(h.value("readSlots('deckBottomEdge').map(x=>x.index)"),[4,3,2,1]);
});
check("both edges consume their first slots and closed views reopen with current state", () => {
  const h=overlayHarness();h.run(`Zone.init([7,14,22,48,93],'1-255');new Zone(255,1).show([7,0,22,0,93]);flush();
    move({FromID:255,FromZone:1,FromPosition:DING,ToID:2,ToZone:5,CardIDs:[],CardCount:1});flush();`);
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[0,22,0,93]);
  h.run(`deckVisibilityPanel.setRegionVisible('bottom',false);move({FromID:255,FromZone:1,FromPosition:DI,ToID:2,ToZone:5,CardIDs:[],CardCount:1});flush();deckVisibilityPanel.setRegionVisible('bottom',true);`);
  assert.deepEqual(h.value("readSlots('deckBottomEdge').map(x=>x.key)"),[0,22]);
  assert.deepEqual(h.value("Zone.shoupai(2)"),[7,93]);
});
check("every one of 150 slots renders without grouping or count truncation", () => {
  const h=overlayHarness();h.run(`deckVisibilityPanel.setLimits(150,150);Zone.init(Array.from({length:150},(_,i)=>i+1),'1-255');
    new Zone(255,1).show([1]);new Zone(255,1,DI).show([150]);flush();`);
  assert.equal(h.run("readSlots('deckTopEdge').length"),150);assert.equal(h.run("readSlots('deckBottomEdge').length"),150);
  assert.equal(h.run("document.getElementById('deckTopEdge').querySelectorAll(':scope>.xc-deck-slot')[77].children[0].textContent"),'？');
});
check("scene reset, DOM replacement and stale buttons cannot restore old cards", () => {
  const h=overlayHarness();h.run(`Zone.init([7,14],'1-255');new Zone(255,1).show([7]);flush();
    globalThis.staleHandle=handles()[0].onpointerdown;Zone.init([22,48],'1-255');flush();staleHandle({button:0,pointerId:9,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}});`);
  assert.deepEqual(h.value("readSlots('deckTopEdge')"),[]);
  assert.equal(h.run("document.getElementById('deckTopEdge').hidden"),false);
  assert.equal(h.run("listeners.get('pointermove')?.size||0"),0);
  h.run(`document.getElementById('deckEdgeUI').remove();drawDeckEdgeUI();drawDeckEdgeUI();`);
  assert.equal(h.run("document.body.children.length"),1);
  assert.equal(h.run("listeners.get('resize').size"),1);
  h.run(`UI.seatUIs=[];drawDeckEdgeUI();`);
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  assert.equal(h.run("listeners.get('resize').size"),0);
});
check("origin drag moves the independent float without collapsing and cleans global listeners", () => {
  const h=overlayHarness();h.run(`Zone.init([7,14],'1-255');flush();
    globalThis.startLeft=parseFloat(document.getElementById('deckEdgeUI').style.left);
    globalThis.dragHandle=handles()[0];
    handles()[0].onpointerdown({button:0,pointerId:1,clientX:800,clientY:100,stopPropagation(){}});
    [...listeners.get('pointermove')][0]({pointerId:1,clientX:700,clientY:170,preventDefault(){}});
    new Zone(255,1).show([7]);flush();
    [...listeners.get('pointerup')][0]({pointerId:1});`);
  assert.equal(h.run("parseFloat(document.getElementById('deckEdgeUI').style.left)"),h.run("startLeft-100"));
  assert.equal(h.run("document.getElementById('deckTopEdge').hidden"),false);
  assert.equal(h.run("handles()[0]===dragHandle"),true);
  assert.equal(h.run("listeners.get('pointermove').size"),0);
  h.run(`deckVisibilityPanel.dispose();drawDeckEdgeUI();`);
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  h.run(`deckVisibilityPanel.start();drawDeckEdgeUI();`);
  assert.equal(h.run("document.body.children.length"),1);
});
check("one resize grip sizes the whole float through model updates and cancels stale drag listeners", () => {
  const h=overlayHarness();h.run(`Zone.init([7,14,22],'1-255');new Zone(255,1).show([7,0,22]);flush();
    globalThis.topViewport=document.getElementById('deckTopEdge').parentNode;
    globalThis.bottomViewport=document.getElementById('deckBottomEdge').parentNode;
    globalThis.floatRoot=document.getElementById('deckEdgeUI');
    globalThis.staleGrip=floatRoot.children[1].onpointerdown;
    staleGrip({button:0,pointerId:4,clientX:100,clientY:100,preventDefault(){},stopPropagation(){}});
    [...listeners.get('pointermove')][0]({pointerId:4,clientX:200,clientY:180,preventDefault(){}});
    [...listeners.get('pointerup')][0]({pointerId:4});`);
  assert.equal(h.run("floatRoot.style.width"),'380px');
  assert.equal(h.run("floatRoot.style.height"),'200px');
  assert.equal(h.run("topViewport.style.width"),'100%');
  assert.equal(h.run("bottomViewport.style.width"),'100%');
  assert.equal(h.run("topViewport.children.length"),1);
  assert.equal(h.run("bottomViewport.children.length"),1);
  h.run(`move({FromID:255,FromZone:1,FromPosition:DING,ToID:2,ToZone:5,CardIDs:[],CardCount:1});flush();`);
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[0,22]);
  assert.equal(h.run("floatRoot.style.width"),'380px');
  h.run(`Zone.init([48,93],'1-255');flush();staleGrip({button:0,pointerId:4,clientX:100,clientY:100});`);
  assert.equal(h.run("document.getElementById('deckEdgeUI').style.width"),'380px');
  assert.equal(h.run("listeners.get('pointermove').size"),0);
  h.run(`document.getElementById('deckEdgeUI').children[1].onpointerdown({button:0,pointerId:5,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}});deckVisibilityPanel.dispose();`);
  assert.equal(h.run("listeners.get('pointermove').size"),0);
  assert.equal(h.run("listeners.get('resize').size"),0);
});
check("origin tiles stay first through consumption and empty decks without counting as cards or showing indexes", () => {
  const h=overlayHarness({visible:true,topLimit:2,bottomLimit:2});
  h.run(`Zone.init([7,14,22],'1-255');new Zone(255,1).show([7,14,22]);flush();`);
  for (const [id,text] of [['deckTopEdge','顶'],['deckBottomEdge','底']]) {
    assert.equal(h.run(`document.getElementById('${id}').firstChild.textContent`),text);
    assert.equal(h.run(`document.getElementById('${id}').firstChild.className`),'xc-deck-origin');
    assert.equal(h.run(`document.getElementById('${id}').firstChild.dataset.key`),undefined);
    assert.equal(h.run(`document.getElementById('${id}').querySelectorAll(':scope>.xc-deck-slot').every(x=>x.children.length===1&&!x.title)`),true);
    assert.equal(h.run(`readSlots('${id}').length`),2);
  }
  h.run(`move({FromID:255,FromZone:1,FromPosition:DING,ToID:2,ToZone:5,CardIDs:[],CardCount:1});flush();`);
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[14,22]);
  assert.equal(h.run("document.getElementById('deckTopEdge').firstChild.textContent"),'顶');
  h.run("new Zone(255,1).set([]);flush();");
  assert.equal(h.run("document.getElementById('deckBottomEdge').firstChild.textContent"),'底');
  assert.deepEqual(h.value("readSlots('deckBottomEdge')"),[]);
});
check("new default is off with two 20-position windows, including unknown slots", () => {
  const h=overlayHarness(null);h.run(`Zone.init(Array.from({length:50},(_,i)=>i+1),'1-255');
    new Zone(255,1).show(Array.from({length:50},(_,i)=>i+1));flush();`);
  assert.deepEqual(h.value("deckVisibilityPanel.getSettings()"),{visible:false,topLimit:20,bottomLimit:20,discardLimit:20,regions:{top:true,bottom:true,discard:true}});
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  h.run("deckVisibilityPanel.setVisible(true);");
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.index)"),Array.from({length:20},(_,i)=>i));
  assert.deepEqual(h.value("readSlots('deckBottomEdge').map(x=>x.index)"),Array.from({length:20},(_,i)=>49-i));
  h.run("Zone.init(Array.from({length:25},(_,i)=>i+1),'1-255');new Zone(255,1,20).show([21]);flush();");
  assert.deepEqual(h.value("readSlots('deckTopEdge')"),[]);
  assert.deepEqual(h.value("readSlots('deckBottomEdge').map(x=>x.key)"),[0,0,0,0,21]);
});
check("saved enable and asymmetric limits apply immediately and invalid limits cannot replace them", () => {
  const h=overlayHarness({visible:true,topLimit:3,bottomLimit:5});
  h.run("Zone.init([1,2,3,4,5,6,7,8],'1-255');new Zone(255,1).show([1,2,3,4,5,6,7,8]);flush();");
  assert.equal(h.run("readSlots('deckTopEdge').length"),3);assert.equal(h.run("readSlots('deckBottomEdge').length"),5);
  assert.equal(h.run("deckVisibilityPanel.setLimits(2,4)"),true);
  assert.equal(h.run("readSlots('deckTopEdge').length"),2);assert.equal(h.run("readSlots('deckBottomEdge').length"),4);
  for(const expression of ['setLimits(0,2)','setLimits(-1,2)','setLimits(1.5,2)','setLimits(NaN,2)','setLimits(Infinity,2)'])
    assert.equal(h.run('deckVisibilityPanel.'+expression),false);
  h.run("deckVisibilityPanel.setVisible(false);drawDeckEdgeUI();");
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  assert.deepEqual(h.value("JSON.parse(storedSettings)"),{visible:false,topLimit:2,bottomLimit:4,discardLimit:20,regions:{top:true,bottom:true,discard:true}});
  h.run("deckVisibilityPanel.setVisible(true);");
  assert.equal(h.run("readSlots('deckTopEdge').length"),2);
});
check("storage errors and malformed settings keep safe defaults without blocking the view", () => {
  const h=overlayHarness({visible:'true',topLimit:-4,bottomLimit:2.5});
  assert.deepEqual(h.value("deckVisibilityPanel.getSettings()"),{visible:false,topLimit:20,bottomLimit:20,discardLimit:20,regions:{top:true,bottom:true,discard:true}});
  h.run("localStorage.setItem=()=>{throw Error('denied')};deckVisibilityPanel.setVisible(true);Zone.init([7],'1-255');new Zone(255,1).show([7]);flush();");
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[7]);
  h.run("deckVisibilityPanel.dispose();");
  assert.equal(h.run("deckVisibilityPanel.setVisible(true)"),false);
  assert.equal(h.run("deckVisibilityPanel.setLimits(1,1)"),false);
});
check("discard reverses a view copy with candidate placeholders and independent limits", () => {
  const h=overlayHarness({visible:true,topLimit:1,bottomLimit:1});
  h.run(`Zone.init([],'1-255');Zone.obj['2-255']=[
    new Card(48,48,'2-255'),new Card(0,999,'2-255'),new Card(7,7,'2-255'),
    new Card(-1,14,'2-255'),new Card(0,0,'2-255')];
    Zone.draw('2-255');flush();`);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[0,0,7,0,48]);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.index)"),[0,1,2,3,4]);
  assert.deepEqual(h.value("Zone.obj['2-255'].map(c=>c.id)"),[48,999,7,14,0]);
  assert.equal(h.run("document.getElementById('discardPileEdge').firstChild.textContent"),'弃');
  assert.equal(h.run("document.getElementById('discardPileEdge').firstChild.dataset.key"),undefined);
  assert.equal(h.run("document.getElementById('deckTopEdge').hidden"),false);
  h.run(`deckVisibilityPanel.setLimits(1,1,150);Zone.obj['2-255']=Array.from({length:150},(_,i)=>new Card(0,1000+i,'2-255'));Zone.draw('2-255');flush();`);
  assert.equal(h.run("readSlots('discardPileEdge').length"),150);
  assert(h.value("readSlots('discardPileEdge').map(x=>x.key)").every(x=>x===0));
});
check("discard-only messages refresh across turns and a missing or broken main recorder", () => {
  const h=overlayHarness();
  h.run(`setHand(1,[48,7,22,14]);flush();
    move({ToZone:2,MoveType:4,CardIDs:[22,7],CardCount:2});flush();
    game.turn++;move({ToZone:2,MoveType:4,CardIDs:[48]});flush();`);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[48,7,22]);
  assert.deepEqual(h.value("readKeys('qipaiCards')"),[48]);
  assert.deepEqual(h.value("Zone.obj['1-255']||[]"),[]);
  h.run(`elements.get('qipaiCards').querySelectorAll=()=>{throw Error('recorder rebuilding')};
    move({ToZone:2,MoveType:4,CardIDs:[14]});flush();`);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[14,48,7,22]);
  h.run(`elements.delete('qipaiCards');move({FromID:255,FromZone:2,ToID:2,ToZone:5,MoveType:8,CardIDs:[7]});flush();`);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[14,48,22]);
  assert.deepEqual(h.value("Zone.obj['2-255'].map(c=>c.id)"),[22,48,14]);
  h.run("move({FromID:255,FromZone:2,ToID:2,ToZone:5,MoveType:8,CardIDs:[14]});flush();");
  assert.deepEqual(h.value("readSlots('discardPileEdge')"),[{index:0,key:48},{index:1,key:22}]);
  assert.deepEqual(h.value("Zone.obj['2-255'].map(c=>c.id)"),[22,48]);
  assert.deepEqual(h.value("frameErrors"),[]);
  assert.deepEqual(h.value("logs.filter(x=>x.includes('event:error'))"),[]);
});
check("processing cards enter discard only on resolution and closed discard reopens after returns", () => {
  const h=overlayHarness();h.run(`setHand(1,[48,7,22]);flush();
    move({MoveType:2,CardIDs:[48,7],CardCount:2});flush();`);
  assert.deepEqual(h.value("readSlots('discardPileEdge')"),[]);
  h.run(`move({FromID:255,FromZone:3,ToZone:2,MoveType:9,CardIDs:[48,7],CardCount:2});flush();`);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[7,48]);
  h.run(`deckVisibilityPanel.setRegionVisible('discard',false);move({FromID:255,FromZone:2,ToZone:1,ToPosition:DING,MoveType:15,CardIDs:[48]});flush();`);
  assert.equal(h.run("document.getElementById('discardPileEdge')"),null);
  h.run("deckVisibilityPanel.setRegionVisible('discard',true);");
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[7]);
  assert.deepEqual(h.value(keys),[48]);
  assert.deepEqual(h.value("logs.filter(x=>x.includes('event:error'))"),[]);
});
check("partial discard disclosure can remain hidden without collapsing any card slots", () => {
  const h=overlayHarness();h.run(`setHiddenHand(2,[7,14,22]);globalThis.ids=[7,0];
    move({FromID:2,FromZone:5,ToZone:2,MoveType:4,CardIDs:ids,CardCount:2});flush();`);
  assert.deepEqual(h.value("ids"),[7,0]);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[0,0]);
  assert.equal(h.run("Zone.obj['5-2'].length"),1);
  assert.equal(h.run("Zone.obj['2-255'].length"),2);
  h.run(`move({FromID:2,FromZone:5,ToZone:2,MoveType:4,CardIDs:[22]});flush();`);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[22,0,0]);
  assert.deepEqual(h.value("logs.filter(x=>x.includes('event:error'))"),[]);
});
check("undisclosed pickup renders the remaining candidate as one unknown slot", () => {
  const h=overlayHarness();h.run(`setHand(1,[7,14]);flush();
    move({ToZone:2,MoveType:4,CardIDs:[7,14],CardCount:2});flush();
    move({FromID:255,FromZone:2,ToID:2,ToZone:5,MoveType:8,CardIDs:[],CardCount:1});flush();`);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[0]);
  assert.deepEqual(h.value("Zone.qipai"),[]);
  assert.deepEqual(h.value("logs.filter(x=>x.includes('event:error'))"),[]);
});
check("shuffle clears the discard overlay and leaves recycled deck slots unknown", () => {
  for (const isPassed of [false,true]) {
    const h=overlayHarness();h.run(`game.isPassed=${isPassed};Zone.init([7,14],'1-255');flush();
      move({FromID:255,FromZone:1,FromPosition:DING,ToZone:2,MoveType:4,CardIDs:[7,14],CardCount:2});flush();`);
    assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[14,7]);
    h.run(`move({FromID:255,FromZone:2,ToZone:9,MoveType:255,CardIDs:[],CardCount:2});flush();`);
    assert.deepEqual(h.value("readSlots('discardPileEdge')"),[]);
    assert.equal(h.run("document.getElementById('discardPileEdge').firstChild.textContent"),'弃');
    assert.deepEqual(h.value(keys),[0,0]);
    assert.deepEqual(h.value("logs.filter(x=>x.includes('event:error'))"),[]);
  }
});
check("discard switch, scene reset, stale handlers and dispose share the floating lifecycle", () => {
  const h=overlayHarness();h.run(`setHand(1,[7]);flush();
    move({ToZone:2,MoveType:4});flush();globalThis.staleDiscard=handles()[2].onpointerdown;
    deckVisibilityPanel.setVisible(false);Zone.draw('2-255');flush();`);
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  h.run("deckVisibilityPanel.setVisible(true);");
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[7]);
  h.run("Zone.init([22,48],'1-255');flush();staleDiscard({button:0,pointerId:9,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}});");
  assert.equal(h.run("document.getElementById('discardPileEdge').hidden"),false);
  assert.deepEqual(h.value("readSlots('discardPileEdge')"),[]);
  h.run("deckVisibilityPanel.dispose();Zone.draw('2-255');flush();");
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  assert.equal(h.run("listeners.get('resize').size"),0);
  h.run("deckVisibilityPanel.start();drawDeckEdgeUI();drawDeckEdgeUI();");
  assert.equal(h.run("document.body.children.length"),1);
  assert.deepEqual(h.value("readSlots('discardPileEdge')"),[]);
});
check("region preferences migrate old settings, reject invalid setters and expose only copies", () => {
  const h=overlayHarness({visible:true,topLimit:3,bottomLimit:5,regions:{top:false,bottom:'false',discard:null}});
  h.run("Zone.init([7,14],'1-255');flush();");
  assert.deepEqual(h.value("deckVisibilityPanel.getRegionVisibility()"),{top:false,bottom:true,discard:true});
  assert.deepEqual(h.value("handles().map(x=>x.dataset.side)"),['bottom','discard']);
  h.run("deckVisibilityPanel.getRegionVisibility().bottom=false;deckVisibilityPanel.getSettings().regions.discard=false;");
  assert.deepEqual(h.value("deckVisibilityPanel.getRegionVisibility()"),{top:false,bottom:true,discard:true});
  for(const expression of ["setRegionVisible('constructor',false)","setRegionVisible('__proto__',false)","setRegionVisible('top','true')"])
    assert.equal(h.run('deckVisibilityPanel.'+expression),false);
  h.run("deckVisibilityPanel.setRegionVisible('discard',false);deckVisibilityPanel.setLimits(2,4);");
  assert.deepEqual(h.value("JSON.parse(storedSettings).regions"),{top:false,bottom:true,discard:false});
  assert.deepEqual(createPanel({storage:{getItem:()=>h.run('storedSettings')}}).getRegionVisibility(),{top:false,bottom:true,discard:false});
});
check("hidden regions keep recording and all-off removes the float until an independent region is enabled", () => {
  const h=overlayHarness();h.run(`Zone.init([7,14,22],'1-255');new Zone(255,1).show([7,14,22]);flush();
    globalThis.oldTop=handles()[0].onpointerdown;
    deckVisibilityPanel.setRegionVisible('top',false);deckVisibilityPanel.setRegionVisible('bottom',false);
    deckVisibilityPanel.setRegionVisible('discard',false);`);
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  assert.equal(h.run("deckVisibilityPanel.getSettings().visible"),true);
  h.run(`move({FromID:255,FromZone:1,FromPosition:DING,ToZone:2,MoveType:4,CardIDs:[7]});flush();`);
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  assert.deepEqual(h.value("Zone.qipai"),[7]);
  h.run("deckVisibilityPanel.setRegionVisible('discard',true);");
  assert.deepEqual(h.value("handles().map(x=>x.dataset.side)"),['discard']);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),[7]);
  assert.equal(h.run("document.getElementById('deckTopEdge')"),null);
  h.run("oldTop({button:0,pointerId:9,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}});deckVisibilityPanel.setRegionVisible('top',true);");
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[14,22]);
  h.run("deckVisibilityPanel.setVisible(false);deckVisibilityPanel.setRegionVisible('bottom',true);");
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  h.run("deckVisibilityPanel.setVisible(true);Zone.init([48,93],'1-255');flush();");
  assert.deepEqual(h.value("readSlots('discardPileEdge')"),[]);
  h.run("deckVisibilityPanel.dispose();");
  assert.equal(h.run("deckVisibilityPanel.setRegionVisible('top',false)"),false);
  assert.equal(h.run("listeners.get('resize').size"),0);
});
check("region changes cancel an active drag and retain current effects when storage is unavailable", () => {
  const h=overlayHarness();h.run(`Zone.init([7],'1-255');flush();
    handles()[0].onpointerdown({button:0,pointerId:1,clientX:20,clientY:20,stopPropagation(){}});
    globalThis.lateMove=[...listeners.get('pointermove')][0];
    localStorage.setItem=()=>{throw Error('denied')};deckVisibilityPanel.setRegionVisible('top',false);
    lateMove({pointerId:1,clientX:200,clientY:200,preventDefault(){}});`);
  assert.equal(h.run("document.getElementById('deckTopEdge')"),null);
  assert.deepEqual(h.value("handles().map(x=>x.dataset.side)"),['bottom','discard']);
  assert.equal(h.run("listeners.get('pointermove').size"),0);
  assert.equal(h.run("listeners.get('resize').size"),1);
});
check("discard defaults to newest-first twenty slots with zero-based display indexes and intact history", () => {
  const h=overlayHarness();h.run(`Zone.init([],'1-255');Zone.obj['2-255']=Array.from({length:30},(_,i)=>new Card(i%3===0?i+1:0,i+1,'2-255'));
    Zone.draw('2-255');flush();`);
  assert.equal(h.run("deckVisibilityPanel.getSettings().discardLimit"),20);
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.index)"),Array.from({length:20},(_,i)=>i));
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.key)"),Array.from({length:20},(_,i)=>(29-i)%3===0?30-i:0));
  assert.deepEqual(h.value("document.getElementById('discardPileEdge').querySelectorAll(':scope>.xc-deck-slot').map(x=>Number(x.dataset.sourceIndex))"),Array.from({length:20},(_,i)=>29-i));
  assert.equal(h.run("Zone.obj['2-255'].length"),30);
  h.run("deckVisibilityPanel.setLimits(2,3,5);");
  assert.deepEqual(h.value("readSlots('discardPileEdge').map(x=>x.index)"),[0,1,2,3,4]);
  h.run("deckVisibilityPanel.setLimits(2,3,40);");
  assert.equal(h.run("readSlots('discardPileEdge').length"),30);
  for(const expression of ['setLimits(7,8,0)','setLimits(7,8,-1)','setLimits(7,8,1.5)','setLimits(7,8,NaN)','setLimits(7,8,Infinity)'])
    assert.equal(h.run('deckVisibilityPanel.'+expression),false);
  assert.deepEqual(h.value("[deckVisibilityPanel.getSettings().topLimit,deckVisibilityPanel.getSettings().bottomLimit,deckVisibilityPanel.getSettings().discardLimit]"),[2,3,40]);
  h.run("deckVisibilityPanel.setLimits(4,6);");
  assert.equal(h.run("deckVisibilityPanel.getSettings().discardLimit"),40);
  assert.equal(createPanel({storage:{getItem:()=>h.run('storedSettings')}}).getSettings().discardLimit,40);
});
check("latest unknown windows update their positions while hidden and invalid saved discard limits default safely", () => {
  const h=overlayHarness({visible:true,discardLimit:0});h.run(`Zone.init([],'1-255');
    Zone.obj['2-255']=Array.from({length:25},(_,i)=>new Card(0,1000+i,'2-255'));Zone.draw('2-255');flush();`);
  assert.equal(h.run("deckVisibilityPanel.getSettings().discardLimit"),20);
  assert.equal(h.run("readSlots('discardPileEdge')[0].index"),0);
  assert.equal(h.run("document.getElementById('discardPileEdge').children[1].dataset.sourceIndex"),'24');
  h.run("Zone.obj['2-255'].push(new Card(0,1025,'2-255'));Zone.draw('2-255');flush();");
  assert.equal(h.run("readSlots('discardPileEdge')[0].index"),0);
  assert.equal(h.run("document.getElementById('discardPileEdge').children[1].dataset.sourceIndex"),'25');
  assert(h.value("readSlots('discardPileEdge').map(x=>x.key)").every(key=>key===0));
  h.run(`deckVisibilityPanel.setRegionVisible('discard',false);Zone.obj['2-255'].push(new Card(7,7,'2-255'));
    Zone.draw('2-255');flush();deckVisibilityPanel.setRegionVisible('discard',true);`);
  assert.equal(h.run("readSlots('discardPileEdge')[0].index"),0);
  assert.equal(h.run("readSlots('discardPileEdge')[0].key"),7);
  assert.equal(h.run("Zone.obj['2-255'].length"),27);
});
check("pending deck history keeps faces in order with red-frame metadata and updates on hand disclosure alone", () => {
  const h=overlayHarness();h.run(`Zone.init([7,14,22,48,93],'1-255');new Zone(255,1).show([7,14,22]);flush();
    move({FromID:255,FromZone:1,FromPosition:65281,ToID:2,ToZone:5,CardIDs:[],CardCount:1,MoveType:8});flush();`);
  assert.equal(h.run("Zone.obj['1-255'].length"),4);
  assert(h.value(keys).every(key=>key===0));
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[7,14,22]);
  assert.deepEqual(h.value("document.getElementById('deckTopEdge').querySelectorAll(':scope>.xc-deck-slot').map(x=>x.dataset.uncertain)"),['true','true','true']);
  assert.deepEqual(h.value("document.getElementById('deckTopEdge').querySelectorAll(':scope>.xc-deck-slot').map(x=>x.children[0].innerHTML)"),['7','14','22']);
  h.run("new Zone(2).show([7]);flush();");
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[14,22]);
  assert.equal(h.run("Zone.obj['1-255'].length"),4,'disclosure is not another deck removal');
  h.run("new Zone(255,1).show([14]);flush();");
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[14]);
  assert.equal(h.run("document.getElementById('deckTopEdge').children[1].dataset.uncertain"),undefined);
  assert.deepEqual(h.value("logs.filter(x=>x.includes('event:error')||x.includes('render:error'))"),[]);
});
process.stdout.write(passed + " deck checks passed\n");
