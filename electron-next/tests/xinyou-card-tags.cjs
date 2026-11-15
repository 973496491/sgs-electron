// Real logic/mark/controller, with native deletion and display methods from the OL fixture.
const assert = require('node:assert/strict');
const { harness, source, slice } = require('./visible-card-chain.cjs');
const native = require('./fixtures/card-marks-native-20261110.json');
let passed = 0;
function test(name, run) {
  const h = harness();
  h.run(`
    const nativeTags = {${native.methods.DelCardTag}, ${native.methods.drawTempCardTag}};
    const originalAddHandUI = addHandUI;
    addHandUI = id => Object.assign(originalAddHandUI(id), nativeTags, {
      layoutTagUI(){ this.redraws = (this.redraws || 0) + 1; },
      getCardTagBtn(){return {};}, addDrawChild(){}, resetTagSize(){}
    });
    globalConfig.cardLabelSwitch = true;
    Zone.init([7,14,22,91], '1-255');
    globalThis.phase = (Round, SeatID = room.myID, isSend = false) =>
      logic({ClassName:'GsCGamephaseNtf',Round,SeatID,isSend});
    globalThis.drawXinYou = (id = 7, spell = 4016) => {
      move({FromID:255,FromZone:1,FromPosition:DING,ToID:room.myID,ToZone:5,CardIDs:[id],SpellID:spell});
      return addHandUI(id);
    };
  `);
  run(h);
  assert(!h.context.logs.some(line => line.includes('event:error')), 'no swallowed logic errors');
  passed++;
  console.log('PASS ' + name);
}
test('retains XinYou through discard and end phase; cleanup only removes the exact owned tag', h => {
  h.run(`drawXinYou(); flushMarks();
    handContainer.cardUis[0].AddCardTag('\u200b[元嫡]');
    handContainer.cardUis[0].AddCardTag('\u200b[其他]张三');
    handContainer.cardUis[0].AddCardTag('[心幽]张三');
    phase(5); phase(6);`);
  assert(h.value('handContainer.cardUis[0].tempCardTag').includes('\u200b[心幽]'));
  h.run('phase(7); phase(7);');
  assert.deepEqual(h.value('handContainer.cardUis[0].tempCardTag'), ['\u200b[元嫡]','\u200b[其他]张三','[心幽]张三']);
  assert.deepEqual(h.value('handContainer.cardUis[0].Card.TagArr1'), ['原生技能']);
  assert.equal(h.value('handContainer.cardUis[0].cardTagBtn3.label'), '\u200b[元嫡]');
});
test('cleanup invalidates pending XinYou while YuanDi and other queued origins still apply', h => {
  h.run(`drawXinYou(); drawXinYou(14,4015); addHandUI(22);
    laya.mark([22],'\u200b[其他]张三'); phase(7); flushMarks();`);
  assert.deepEqual(h.value('handContainer.cardUis.map(ui=>ui.tempCardTag)'), [[],['\u200b[元嫡]'],['\u200b[其他]张三']]);
});
test('post-cleanup XinYou is blocked; consecutive same-seat extra round reopens tagging', h => {
  h.run('phase(7); drawXinYou(); flushMarks();');
  assert.deepEqual(h.value('handContainer.cardUis[0].tempCardTag'), []);
  h.run('phase(0); phase(1); drawXinYou(14); flushMarks();');
  assert.deepEqual(h.value('handContainer.cardUis[1].tempCardTag'), ['\u200b[心幽]']);
});
for (const scenario of ['phase(8)', 'phase(255)', 'phase(0,2)', 'phase(1)', 'phase(4,2)']) {
  test('fallback expires old tags and pending writes: ' + scenario, h => {
    h.run(`drawXinYou(); flushMarks(); drawXinYou(14); ${scenario}; flushMarks();`);
    assert.deepEqual(h.value('handContainer.cardUis.map(ui=>ui.tempCardTag)'), [[],[]]);
  });
}
test('sent and malformed phase notifications do not delete current tags', h => {
  h.run(`drawXinYou(); flushMarks(); phase(7,1,true); phase('7'); phase(7,255); phase(99);`);
  assert.deepEqual(h.value('handContainer.cardUis[0].tempCardTag'), ['\u200b[心幽]']);
});
test('cleanup still works with the master switch off, hidden hand UI and seat zero', h => {
  h.run(`room.myID=game.currentID=0; drawXinYou(); flushMarks(); globalConfig.cardLabelSwitch=false;
    handContainer.tempHandCardUis=handContainer.cardUis; handContainer.cardUis=[]; phase(7);`);
  assert.deepEqual(h.value('handContainer.tempHandCardUis[0].tempCardTag'), []);
});
test('scene replacement and seat changes reject stale callbacks without touching other origins', h => {
  h.run(`drawXinYou(); laya.gamescene.SelfSeatUi.cardContainer={cardUis:[]}; flushMarks();`);
  assert.deepEqual(h.value('handContainer.cardUis[0].tempCardTag'), []);
  h.run(`laya.gamescene.SelfSeatUi.cardContainer=handContainer; drawXinYou(14); room.myID=2; flushMarks();`);
  assert.deepEqual(h.value('handContainer.cardUis[1].tempCardTag'), []);
});
test('reconnect resets tags and pending writes through the real message branch', h => {
  h.run(`globalThis._0xbbb545=()=>{}; drawXinYou(); flushMarks(); drawXinYou(14);
    logic({ClassName:'MsgReconnectGame'}); flushMarks();`);
  assert.deepEqual(h.value('handContainer.cardUis.map(ui=>ui.tempCardTag)'), [[],[]]);
});
test('real game.end and Exit invalidate jobs before other lifecycle teardown', h => {
  const end = slice('        end(n) {','        ready(n) {');
  const exitStart = source.indexOf('  function Exit() {');
  const exit = source.slice(exitStart, source.indexOf('    autoTasks.dispose();', exitStart)) + 'throw Error("teardown");}';
  for (const code of ['({' + end + '}).end(false)', '(' + exit + ')()']) {
    h.run(`xinYouCardTags.reset(); handContainer.cardUis=[]; Zone.init([7,14,91],'1-255');
      drawXinYou(); flushMarks(); drawXinYou(14);
      globalThis._0x41a3d0=()=>{};
      aliveCountrySummary.stop=()=>{throw Error('teardown')};`);
    assert.throws(() => h.run(code), /teardown/);
    h.run('flushMarks();');
    assert.deepEqual(h.value('handContainer.cardUis.map(ui=>ui.tempCardTag)'), [[],[]]);
  }
});
console.log(passed + ' passed');
