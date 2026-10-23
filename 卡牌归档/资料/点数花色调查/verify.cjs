const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const sourcePath = 'C:/Users/97349/AppData/Local/Temp/codex-ol-zuifeng-qJebR9/sgsGame.main.js';
const source = fs.readFileSync(sourcePath, 'utf8');
const sections = {};
function section(label, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert.ok(start >= 0 && end > start, label);
  sections[label] = { start, end };
  return source.slice(start, end);
}
const flowersCode = section('flowers', 'class _q{', '!function(t){t[t.mark=0]');
const uiCode = section('normalUi', 'class iVi extends zzt{', 'class sVi extends iVi{');
const modelStart = source.indexOf('class L$t extends dq{');
const modelEnd = source.indexOf('class ', modelStart + 10);
assert.ok(modelStart >= 0 && modelEnd > modelStart);
sections.normalModel = { start: modelStart, end: modelEnd };
class CardChange {
  static CARD_CHANGE = 'CARD_CHANGE';
  constructor(type, card) { this.type = type; this.card = card; }
}
const context = vm.createContext({
  c1t: { IsPokerDDZ: false },
  UF: { GetInstance: () => ({}) }, vF: { GetInstance: () => ({}) },
  zzt: class { UpdateCardFace() { this.baseRefreshes++; } layout() {} onCardChange() {} },
  dq: class {}, nwt: class {}, Eq: CardChange,
  fwt: { GetRes: key => key }, YBi: { GetEmptyTextrue: () => 'EMPTY' },
  FCt: { SKILL_YINGBIAN_SUI_JI_YING_BIAN: 9999 },
  bF: { MAX_SIZE: { width: 93 }, NORMAL_SIZE: { width: 93 } },
  gf: { I: () => ({ TransFromFlower: card => card.testEffectiveFlower }) },
  Laya: { superSetter: (type, instance, key, value) => { instance.cardInfo = value; } },
});
vm.runInContext(flowersCode + '\n' + uiCode + '\n' + source.slice(modelStart, modelEnd) +
  '\nglobalThis.exports = { Flower: _q, Ui: iVi, Model: L$t };', context, { timeout: 2000 });
const { Flower, Ui, Model } = context.exports;
let checks = 0;
const results = [];
function check(label, run) { run(); checks++; results.push(label); }
function ui(card) {
  return Object.assign(Object.create(Ui.prototype), {
    theCard: card, bmpNumber: { visible: true }, bmpFlower: { visible: true },
    bmpRange: {}, bmpFace: {}, baseRefreshes: 0, layouts: 0,
    layout() { this.layouts++; },
    changeFlower: {},
  });
}
for (let flower = 1; flower <= 4; flower++) {
  for (let number = 1; number <= 13; number++) {
    check(`normal ${flower}/${number}`, () => {
      const card = { CardNumber: number, CardFlower: flower, FlowerOnSeat: 1 };
      const view = ui(card);
      view.UpdateCardFace();
      assert.equal(view.bmpFlower.texture, ['', 'heart', 'diamond', 'spade', 'club'][flower]);
      const rank = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][number];
      assert.equal(view.bmpNumber.texture, (flower <= 2 ? 'red_' : 'black_') + rank);
    });
  }
}
check('server suit override uses FlowerOnSeat', () => {
  const view = ui({ CardNumber: 12, CardFlower: 3, FlowerOnSeat: 1, IsModyfifyByServer: true });
  view.UpdateCardFace();
  assert.equal(view.bmpFlower.texture, 'heart'); assert.equal(view.bmpNumber.texture, 'red_Q');
});
check('empty/null/zero suppress glyphs', () => {
  for (const card of [null, { IsEmpty: true }, { CardFlower: 0, CardNumber: 0 }]) {
    const view = ui(card); view.UpdateCardFace();
    assert.equal(view.bmpNumber.texture, 'EMPTY'); assert.equal(view.bmpFlower.texture, 'EMPTY');
  }
});
check('virtual card branch and original-rank exception', () => {
  const card = { IsVirtualCard: true, VirtualColor: 1, CardFlower: 2, CardNumber: 8 };
  const view = ui(card); view.UpdateCardFace();
  assert.equal(view.bmpFlower.texture, 'virtural_card_1'); assert.equal(view.bmpNumber.texture, 'EMPTY');
  card.VirtualShowOrignColorAndNumber = true; view.UpdateCardFace();
  assert.equal(view.bmpNumber.texture, 'red_8');
});
check('UI-only override does not mutate card; normal refresh replaces override', () => {
  const card = { CardFlower: 3, CardNumber: 7 };
  const view = ui(card); view.ChangeFlowerAndNumber(1, 5);
  assert.equal(view.bmpFlower.texture, 'heart'); assert.equal(view.bmpNumber.texture, 'red_5');
  assert.deepEqual(card, { CardFlower: 3, CardNumber: 7 });
  view.UpdateCardFace(); assert.equal(view.bmpNumber.texture, 'black_7');
});
check('poker and dontUpdateCard route separately', () => {
  const view = ui({ CardNumber: 7, CardFlower: 3 }); let pokerCalls = 0;
  view.UpdatePokerCardFace = () => pokerCalls++; view.isPokerCardFace = true;
  view.UpdateCardFace(); assert.equal(pokerCalls, 1); assert.equal(view.baseRefreshes, 0);
  view.isPokerCardFace = false;
  view.theCard.FirstIndexSkillID = 9999; view.theCard.AvatarSkill = {};
  view.bmpNumber.texture = 'KEEP'; view.UpdateCardFace(); assert.equal(view.bmpNumber.texture, 'KEEP');
});
check('hide remains hidden across native face refresh', () => {
  const view = ui({ CardNumber: 4, CardFlower: 2 });
  view.HideFlowerAndNumber(); view.UpdateCardFace();
  assert.equal(view.bmpNumber.visible, false); assert.equal(view.bmpFlower.visible, false);
});
check('layout controls glyph size and placement', () => {
  const view = ui({ CardNumber: 1, CardFlower: 1 });
  view.width = 93; Ui.prototype.layout.call(view);
  assert.equal(view.bmpNumber.width, 19); assert.equal(view.bmpNumber.height, 17);
  assert.equal(view.bmpNumber.x, 4); assert.equal(view.bmpNumber.y, 4);
  assert.equal(view.bmpFlower.y, 19);
  view.width = 74; Ui.prototype.layout.call(view);
  assert.equal(view.bmpNumber.width, 16); assert.equal(view.bmpNumber.height, 14);
  assert.equal(view.bmpNumber.x, 3); assert.equal(view.bmpFlower.y, 15);
});
check('CardInfo initializes current/original number; CardNumber setter emits once', () => {
  const card = Object.create(Model.prototype); const events = [];
  card.event = (type, event) => events.push({ type, event });
  card.CardInfo = { Number: '7', Color: '2', index: 1, spellId: 1, res: 'Sha' };
  assert.equal(card.CardNumber, 7); assert.equal(card.CardNumberOri, 7);
  card.CardNumber = 13; card.CardNumber = 13;
  assert.equal(card.CardNumber, 13); assert.equal(card.CardNumberOri, 7);
  assert.equal(events.length, 1); assert.equal(events[0].type, 'CARD_CHANGE');
});
check('DisplayFlower matches normal UI branch, not unconditional effective suit', () => {
  const card = Object.create(Model.prototype);
  Object.defineProperty(card, 'CardFlower', { value: 3 });
  card.testEffectiveFlower = 1;
  assert.equal(card.FlowerOnSeat, 1); assert.equal(card.DisplayFlower, 3);
  Object.defineProperty(card, 'SuitChange', { value: 2 });
  assert.equal(card.DisplayFlower, 2);
});
check('onCardChange invokes face refresh', () => {
  const view = ui({ CardNumber: 13, CardFlower: 3 });
  view.onCardChange({}); assert.equal(view.bmpNumber.texture, 'black_K');
});
const atlas = JSON.parse(fs.readFileSync(path.join(__dirname, '../../卡牌拆分/source/cards.atlas'), 'utf8'));
check('normal cards atlas has none of the 30 standard glyph keys', () => {
  const keys = ['heart', 'diamond', 'spade', 'club'];
  for (const color of ['red', 'black']) for (const rank of Flower.CardNumberName.slice(1)) keys.push(color + '_' + rank);
  for (const key of keys) assert.equal(Object.hasOwn(atlas.frames, key + '.png'), false);
});
const report = {
  verifiedAt: '2026-10-21', sourcePath,
  sha256: crypto.createHash('sha256').update(source).digest('hex'),
  sections, checks, results,
  scope: 'Extracted native methods with stub resource loader/base classes; no client injection, no in-game validation.',
};
fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({ checks, sha256: report.sha256, sections, status: 'passed' }, null, 2) + '\n');
