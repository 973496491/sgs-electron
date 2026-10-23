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
    globalThis.buttons=()=>document.getElementById('deckEdgeUI').children[0].children.slice(1).map(section=>section.children[0]);
    globalThis.clickSide=side=>buttons()[side==='top'?0:1].onclick({preventDefault(){},stopPropagation(){}});
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
check("one body-level float has two independent vertical toggles and no recorder dependency", () => {
  const h=overlayHarness();h.run(`elements.delete('paiduiCards');Zone.init([7,14,22,48,93],'1-255');
    new Zone(255,1).show([0,14,0,48]);flush();clickSide('top');`);
  assert.equal(h.run("document.getElementById('deckEdgeUI').parentNode===document.body"),true);
  assert.equal(h.run("buttons().length"),2);
  assert.equal(h.run("document.getElementById('deckBottomEdge').hidden"),true);
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[0,14,0,48]);
  h.run("clickSide('bottom');");
  assert.deepEqual(h.value("readSlots('deckBottomEdge').map(x=>x.key)"),[0,48,0,14]);
  assert.deepEqual(h.value("readSlots('deckBottomEdge').map(x=>x.index)"),[4,3,2,1]);
});
check("both edges consume their first slots and closed views reopen with current state", () => {
  const h=overlayHarness();h.run(`Zone.init([7,14,22,48,93],'1-255');new Zone(255,1).show([7,0,22,0,93]);flush();
    clickSide('top');clickSide('bottom');
    move({FromID:255,FromZone:1,FromPosition:DING,ToID:2,ToZone:5,CardIDs:[],CardCount:1});flush();`);
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[0,22,0,93]);
  h.run(`clickSide('bottom');move({FromID:255,FromZone:1,FromPosition:DI,ToID:2,ToZone:5,CardIDs:[],CardCount:1});flush();clickSide('bottom');`);
  assert.deepEqual(h.value("readSlots('deckBottomEdge').map(x=>x.key)"),[0,22]);
  assert.deepEqual(h.value("Zone.shoupai(2)"),[7,93]);
});
check("every one of 150 slots renders without grouping or count truncation", () => {
  const h=overlayHarness();h.run(`deckVisibilityPanel.setLimits(150,150);Zone.init(Array.from({length:150},(_,i)=>i+1),'1-255');
    new Zone(255,1).show([1]);new Zone(255,1,DI).show([150]);flush();clickSide('top');clickSide('bottom');`);
  assert.equal(h.run("readSlots('deckTopEdge').length"),150);assert.equal(h.run("readSlots('deckBottomEdge').length"),150);
  assert.equal(h.run("document.getElementById('deckTopEdge').querySelectorAll(':scope>.xc-deck-slot')[77].children[0].textContent"),'？');
});
check("scene reset, DOM replacement and stale buttons cannot restore old cards", () => {
  const h=overlayHarness();h.run(`Zone.init([7,14],'1-255');new Zone(255,1).show([7]);flush();clickSide('top');
    globalThis.staleClick=buttons()[0].onclick;Zone.init([22,48],'1-255');flush();staleClick({preventDefault(){},stopPropagation(){}});`);
  assert.deepEqual(h.value("readSlots('deckTopEdge')"),[]);
  assert.equal(h.run("document.getElementById('deckTopEdge').hidden"),false);
  h.run(`document.getElementById('deckEdgeUI').remove();drawDeckEdgeUI();drawDeckEdgeUI();`);
  assert.equal(h.run("document.body.children.length"),1);
  assert.equal(h.run("listeners.get('resize').size"),1);
  h.run(`UI.seatUIs=[];drawDeckEdgeUI();`);
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  assert.equal(h.run("listeners.get('resize').size"),0);
});
check("drag moves the independent float, suppresses accidental toggle and cleans global listeners", () => {
  const h=overlayHarness();h.run(`Zone.init([7,14],'1-255');flush();
    globalThis.startLeft=parseFloat(document.getElementById('deckEdgeUI').style.left);
    buttons()[0].onpointerdown({button:0,pointerId:1,clientX:800,clientY:100,stopPropagation(){}});
    [...listeners.get('pointermove')][0]({pointerId:1,clientX:700,clientY:170,preventDefault(){}});
    [...listeners.get('pointerup')][0]({pointerId:1});clickSide('top');`);
  assert.equal(h.run("parseFloat(document.getElementById('deckEdgeUI').style.left)"),h.run("startLeft-100"));
  assert.equal(h.run("document.getElementById('deckTopEdge').hidden"),true);
  assert.equal(h.run("listeners.get('pointermove').size"),0);
  h.run(`deckVisibilityPanel.dispose();drawDeckEdgeUI();`);
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  h.run(`deckVisibilityPanel.start();drawDeckEdgeUI();`);
  assert.equal(h.run("document.body.children.length"),1);
});
check("one resize grip sizes the whole float through model updates and cancels stale drag listeners", () => {
  const h=overlayHarness();h.run(`Zone.init([7,14,22],'1-255');new Zone(255,1).show([7,0,22]);flush();clickSide('top');clickSide('bottom');
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
  h.run(`Zone.init([7,14,22],'1-255');new Zone(255,1).show([7,14,22]);flush();clickSide('top');clickSide('bottom');`);
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
  assert.deepEqual(h.value("deckVisibilityPanel.getSettings()"),{visible:false,topLimit:20,bottomLimit:20});
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  h.run("deckVisibilityPanel.setVisible(true);clickSide('top');clickSide('bottom');");
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.index)"),Array.from({length:20},(_,i)=>i));
  assert.deepEqual(h.value("readSlots('deckBottomEdge').map(x=>x.index)"),Array.from({length:20},(_,i)=>49-i));
  h.run("Zone.init(Array.from({length:25},(_,i)=>i+1),'1-255');new Zone(255,1,20).show([21]);flush();");
  assert.deepEqual(h.value("readSlots('deckTopEdge')"),[]);
  assert.deepEqual(h.value("readSlots('deckBottomEdge').map(x=>x.key)"),[0,0,0,0,21]);
});
check("saved enable and asymmetric limits apply immediately and invalid limits cannot replace them", () => {
  const h=overlayHarness({visible:true,topLimit:3,bottomLimit:5});
  h.run("Zone.init([1,2,3,4,5,6,7,8],'1-255');new Zone(255,1).show([1,2,3,4,5,6,7,8]);flush();clickSide('top');clickSide('bottom');");
  assert.equal(h.run("readSlots('deckTopEdge').length"),3);assert.equal(h.run("readSlots('deckBottomEdge').length"),5);
  assert.equal(h.run("deckVisibilityPanel.setLimits(2,4)"),true);
  assert.equal(h.run("readSlots('deckTopEdge').length"),2);assert.equal(h.run("readSlots('deckBottomEdge').length"),4);
  for(const expression of ['setLimits(0,2)','setLimits(-1,2)','setLimits(1.5,2)','setLimits(NaN,2)','setLimits(Infinity,2)'])
    assert.equal(h.run('deckVisibilityPanel.'+expression),false);
  h.run("deckVisibilityPanel.setVisible(false);drawDeckEdgeUI();");
  assert.equal(h.run("document.getElementById('deckEdgeUI')"),null);
  assert.deepEqual(h.value("JSON.parse(storedSettings)"),{visible:false,topLimit:2,bottomLimit:4});
  h.run("deckVisibilityPanel.setVisible(true);");
  assert.equal(h.run("readSlots('deckTopEdge').length"),2);
});
check("storage errors and malformed settings keep safe defaults without blocking the view", () => {
  const h=overlayHarness({visible:'true',topLimit:-4,bottomLimit:2.5});
  assert.deepEqual(h.value("deckVisibilityPanel.getSettings()"),{visible:false,topLimit:20,bottomLimit:20});
  h.run("localStorage.setItem=()=>{throw Error('denied')};deckVisibilityPanel.setVisible(true);Zone.init([7],'1-255');new Zone(255,1).show([7]);flush();clickSide('top');");
  assert.deepEqual(h.value("readSlots('deckTopEdge').map(x=>x.key)"),[7]);
  h.run("deckVisibilityPanel.dispose();");
  assert.equal(h.run("deckVisibilityPanel.setVisible(true)"),false);
  assert.equal(h.run("deckVisibilityPanel.setLimits(1,1)"),false);
});
process.stdout.write(passed + " deck checks passed\n");
