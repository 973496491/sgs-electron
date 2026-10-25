// Real model/logic; the existing harness supplies simulated services and DOM.
// --source <installed userscript> is handled by visible-card-chain.cjs.
const assert = require('node:assert/strict');
const { harness } = require('./visible-card-chain.cjs');
let passed = 0, failed = 0;
const deckKeys = 'Zone.obj["1-255"].map(c=>c.key>0?c.id:0)';
function seed(h, visible = [7,14,22,48,93]) {
  h.run(`Zone.init([7,14,22,48,93],"1-255");new Zone(255,1).show(${JSON.stringify(visible)});flush();`);
}
function retrieve(h, ids, position = 65281, count = 1, spell = 0) {
  h.run(`globalThis.incomingIDs=${JSON.stringify(ids)};move({FromID:255,FromZone:1,FromPosition:${position},ToID:2,ToZone:5,CardIDs:incomingIDs,CardCount:${count},MoveType:8,SpellID:${spell}});flush();`);
  assert.deepEqual(h.value('incomingIDs'), ids, 'do not rewrite the received IDs');
}
function check(name, action) {
  const h = harness();
  try {
    action(h);
    assert.deepEqual(h.value('logs.filter(x=>x.includes("event:error"))'), []);
    assert.deepEqual(h.value('frameErrors'), []);
    passed++; process.stdout.write('PASS '+name+'\n');
  } catch (error) { failed++; process.stdout.write('FAIL '+name+': '+error.message+'\n'); }
}

check('random and needless positions retrieve disclosed IDs from their actual slots', h => {
  for (const position of [65281,65282]) for (const id of [7,22,93]) {
    seed(h); retrieve(h,[id],position);
    assert.deepEqual(h.value(deckKeys),[7,14,22,48,93].filter(x=>x!==id));
    assert.deepEqual(h.value('Zone.shoupai(2)'),[id]);
    assert.equal(h.run('Zone.obj["1-255"].length'),4);
    assert.equal(h.run('new Zone(255,1,65281).pos'),65281,'retain protocol semantics outside removal');
  }
});
check('a retrieved top card cannot be assigned again by the next hidden draw', h => {
  seed(h,[7,14,22]); retrieve(h,[7]);
  h.run('move({FromID:255,FromZone:1,FromPosition:DING,ToID:3,ToZone:5,CardIDs:[],CardCount:1,MoveType:1});flush();');
  assert.deepEqual(h.value('Zone.shoupai(2)'),[7]);
  assert.deepEqual(h.value('Zone.shoupai(3)'),[14]);
  assert.deepEqual(h.value(deckKeys),[22,0,0]);
});
check('cards with identical names, suits and numbers remain distinct by ID', h => {
  h.run(`_0x5984e1=_0x50e4e7=new Proxy({}, {get:(_,id)=>({id:Number(id),name:'闪',color:2,number:2,type:1,ncn:'方块2闪'})});
    Zone.init([2,15],"1-255");new Zone(255,1).show([2,15]);flush();`);
  retrieve(h,[2]);
  assert.deepEqual(h.value(deckKeys),[15]);
  assert.deepEqual(h.value('Zone.shoupai(2)'),[2]);
});
check('top, bottom, numeric offsets and existing forced-edge skills retain their semantics', h => {
  for (const [position,id] of [[65280,7],[0,93],[2,22]]) {
    seed(h); retrieve(h,[id],position);
    assert.deepEqual(h.value(deckKeys),[7,14,22,48,93].filter(x=>x!==id));
  }
  seed(h); retrieve(h,[],65282,1,987); assert.deepEqual(h.value('Zone.shoupai(2)'),[7]);
  seed(h); retrieve(h,[],65282,1,3101); assert.deepEqual(h.value('Zone.shoupai(2)'),[93]);
});
check('hidden retrieval preserves known display order as pending while preventing stale draw inference', h => {
  seed(h,[7,14,22]); retrieve(h,[]);
  assert.equal(h.run('Zone.obj["1-255"].length'),4);
  assert(h.value(deckKeys).every(x=>x===0),'model must not claim old absolute positions');
  assert.deepEqual(h.value('Zone.readDeckView().filter(c=>c.key>0).map(c=>[c.id,c.uncertain])'),[[7,true],[14,true],[22,true]]);
  h.run('move({FromID:255,FromZone:1,FromPosition:DING,ToID:3,ToZone:5,CardIDs:[],CardCount:1,MoveType:1});flush();');
  assert.deepEqual(h.value('Zone.shoupai(3)'),[],'pending faces must never feed hidden draws');
});
check('disclosed possession removes only that exact ID from pending deck history', h => {
  for(const visible of [[7,14,22,48,93],[7,14,22]]) {
    seed(h,visible); retrieve(h,[]);
    h.run('new Zone(2).show([7]);flush();');
    assert.deepEqual(h.value('Zone.shoupai(2)'),[7]);
    assert.deepEqual(h.value('Zone.readDeckView().filter(c=>c.key>0).map(c=>c.id)'),visible.filter(id=>id!==7));
  }
});
check('type-filtered hidden retrieval cannot leave an unsupported certain top', h => {
  for (const spell of [11104,3488,862]) {
    seed(h);
    h.run('Qcard.type={3:new Set([7,22])};Qcard.name={雷杀:new Set([7,22])};Qcard.number={6:new Set([7,22])};');
    retrieve(h,[],65282,1,spell);
    assert(h.value(deckKeys).every(x=>x===0));
    assert.deepEqual(h.value('Zone.readDeckView().filter(c=>c.key>0).map(c=>c.id)'),[7,14,22,48,93]);
  }
});
check('mixed random retrieval retains disclosed cards and keeps the unresolved history marked', h => {
  seed(h); retrieve(h,[7,0],65281,2);
  assert.equal(h.run('Zone.obj["1-255"].length'),3);
  assert.deepEqual(h.value('Zone.shoupai(2)'),[7]);
  assert.deepEqual(h.value('Zone.readDeckView().filter(c=>c.key>0).map(c=>[c.id,c.uncertain])'),[[14,true],[22,true],[48,true],[93,true]]);
});
check('new ordered reveals supersede pending history with current confirmed positions', h => {
  seed(h); retrieve(h,[]);
  h.run('new Zone(255,1).show([14]);flush();');
  assert.equal(h.run('Zone.readDeckView()[0].id'),14);
  assert.equal(h.run('!!Zone.readDeckView()[0].uncertain'),false);
});
check('deck insertions and new games reset pending history instead of resurrecting stale positions', h => {
  seed(h); retrieve(h,[]);
  h.run('move({FromID:2,FromZone:5,ToID:255,ToZone:1,ToPosition:DING,CardIDs:[7],CardCount:1,MoveType:15});flush();');
  assert.equal(h.run('Zone.readDeckView()[0].id'),7);
  assert.equal(h.run('!!Zone.readDeckView()[0].uncertain'),false);
  h.run('Zone.init([2,15],"1-255");flush();');
  assert.deepEqual(h.value('Zone.readDeckView().filter(c=>c.key>0)'),[]);
});
check('ambiguous hand ownership is marked in both main and mirrored records, then resolves', h => {
  h.run('setHand(1,[7,14]);move({FromID:1,FromZone:5,ToID:2,ToZone:5,CardIDs:[],CardCount:1,MoveType:8});flush();');
  for (const id of ['2','3','s2','s3'])
    assert(h.run(`elements.get('${id}').children.some(node=>node.dataset.uncertain==='true')`),'pending owner in '+id);
  h.run('new Zone(2).show([7]);flush();');
  assert.deepEqual(h.value('Zone.shoupai(1)'),[14]);
  assert.deepEqual(h.value('Zone.shoupai(2)'),[7]);
  for (const id of ['2','3','s2','s3'])
    assert(!h.run(`elements.get('${id}').children.some(node=>node.dataset.uncertain==='true')`),'resolved owner in '+id);
});
check('a previously disclosed outside card cannot reappear in pending deck history after a hidden hand transfer', h => {
  seed(h); retrieve(h,[]);h.run('new Zone(2).show([7]);flush();');
  retrieve(h,[48]);
  h.run('move({FromID:2,FromZone:5,ToID:3,ToZone:5,CardIDs:[],CardCount:1,MoveType:8});flush();');
  assert.deepEqual(h.value('Zone.readDeckView().filter(c=>c.key>0).map(c=>c.id)'),[14,22,93]);
});
check('history contains only previously known IDs and clears when no deck cards remain', h => {
  seed(h,[7]);retrieve(h,[]);
  assert.deepEqual(h.value('Zone.readDeckView().filter(c=>c.key>0).map(c=>c.id)'),[7]);
  h.run('move({FromID:255,FromZone:1,FromPosition:DING,ToID:3,ToZone:5,CardIDs:[],CardCount:4,MoveType:1});flush();');
  assert.deepEqual(h.value('Zone.readDeckView()'),[]);
  seed(h);retrieve(h,[]);h.run('Zone.resetDeckOrder();');
  assert(h.value('Zone.readDeckView().map(c=>c.key)').every(key=>key<=0));
});
check('uniquely determined remaining cards do not retain a stale pending frame', h => {
  h.run('Qcard.type={3:new Set([7])};Zone.init([7,14],"1-255");new Zone(255,1).show([7,14]);flush();');
  retrieve(h,[],65282,1,11104);
  assert.deepEqual(h.value('Zone.shoupai(2)'),[7]);
  assert.deepEqual(h.value(deckKeys),[14]);
  assert.equal(h.run('!!Zone.readDeckView()[0].uncertain'),false);
});
process.stdout.write(`${passed} passed, ${failed} failed\n`);
process.exitCode=failed?1:0;
