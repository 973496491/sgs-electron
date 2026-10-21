// Extracted current native card-face methods. Checks visual layer ownership rather than only texture fields.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const createClient = require('../src/adapters/card-theme-client');
const createFeature = require('../src/features/card-theme');
const snapshot = require('./fixtures/card-face-layers-20261021.json');
const manifest = require('../resources/card-themes/tarot/manifest.json');
const contentNames = ['bmpFace2', 'bmpNormalName', 'bmpNameBg', 'bmpName', 'bmpCardType', 'bmpSmallDesc'];
let passed = 0;
async function check(name, run) { await run(); passed++; process.stdout.write('PASS ' + name + '\n'); }

function fixture({ missingFace = false, delayedFace = null } = {}) {
  const originals = new Map();
  function original(key) {
    if (!originals.has(key)) originals.set(key, { id: key, width: 93, height: 130 });
    return originals.get(key);
  }
  class Base {
    UpdateCardFace() { this.SetCardFace(this.Card && this.Card.Seat); }
    layout() { this.bmpFace.width = this.width; this.bmpFace.height = this.height; }
    Draw() {} clear() { this.Clear(); }
    Clear() { this.resetNewCardFace(); this.theCard = null; this.bmpFace.texture = original('EMPTY'); }
    destroy() { this.destroyed = true; }
  }
  const context = vm.createContext({ Base, uNt: { GetRes: original }, hKi: { GetEmptyTextrue: () => original('EMPTY') },
    $H: { I: () => ({ GetBarDataById: () => ({ IsOpen: true }) }) }, ICt: { Bottom_CardFace: 1 },
    Rmt: { BASIC: 1, JINNANG: 2, EQUIP: 3 }, Jk: { NORMAL_SIZE: { width: 93, height: 130 }, MAX_SIZE: { width: 93 } },
    CO: class {}, oj: { GetFlowerResName: flower => ['', 'heart', 'diamond', 'spade', 'club'][flower],
      GetNumberResName: (number, flower) => (flower < 3 ? 'red_' : 'black_') + number },
  });
  vm.runInContext('class Gqi extends Base { static SMALL_DESC_PREFIX="small_desc"; static SMALL_DESC_RIGHT=8;' +
    'static SMALL_DESC_GAP=-6; static NAME_OFFSET_X=4; static LONG_NAME_OFFSET_X=2;' +
    'get Card(){return this.theCard} isLongEquipName(){return false} measure(){}' +
    Object.values(snapshot.methods).map(method => method.source).join('\n') +
    '} globalThis.Ui=Gqi;', context);
  const Ui = context.Ui, views = [], logs = [], config = { cardBackSwitch: true, miaoCardSwitch: false };
  const window = { setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} };
  const storage = new Map([['xcCardFaceTheme', 'original']]);
  const client = createClient({ window, getLaya: () => ({ class: () => Ui }), getEngine: () => null,
    getRegisteredUis: () => views, log: (...args) => logs.push(args) });
  client.readAsset = async relative => relative === 'manifest.json' ? { ok: true, manifest } :
    missingFace && relative.startsWith('faces/') ? { ok: false, code: 'missing' } : { ok: true, dataUrl: relative };
  client.makeTexture = async (relative, size) => {
    if (delayedFace && relative.startsWith('faces/')) await delayedFace.promise;
    return { id: relative, width: size[0], height: size[1] };
  };
  client.releaseTexture = () => {};
  const feature = createFeature({ window, document: {}, client, getConfig: () => config,
    storage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    setMiaoEnabled: async () => views.forEach(ui => { if (ui.Card) ui.UpdateCardFace(); }), log: (...args) => logs.push(args) });
  function node() { return { visible: false, width: 93, height: 130, texture: original('EMPTY'),
    pos(x, y) { this.x = x; this.y = y; }, posInteger(x, y) { this.pos(x, y); } }; }
  function view(resource = 'Shan', flower = 1, type = 1) {
    const ui = Object.assign(Object.create(Ui.prototype), { isNewCardUI: true, width: 93, height: 130,
      theCard: { ResName: resource, CardFlower: flower, CardNumber: 2, CardBaseType: type },
      bmpFace: node(), bmpNumber: node(), bmpFlower: node(), bmpRange: node(), bmpPokerFace: node() });
    for (const name of contentNames) ui[name] = node();
    ui.bmpRange.visible = true; ui.selectedBorder = { visible: true }; ui.tempCardTag = { visible: true };
    views.push(ui); ui.UpdateCardFace(); return ui;
  }
  return { feature, client, view, Ui, views, logs, original };
}
function assertContentHidden(ui) {
  for (const name of contentNames) assert.equal(ui[name].visible, false, name + ' must not cover the tarot PNG');
}

(async () => {
  const h = fixture(), heart = h.view(), diamond = h.view('Shan', 2), weapon = h.view('HanBingJian', 3, 3);
  await check('current native ordinary card splits background, face illustration and name', () => {
    assert.equal(heart.bmpFace.texture.id, 'cardFace_0');
    assert.equal(heart.bmpFace2.texture.id, 'face_Shan'); assert.equal(heart.bmpFace2.visible, true);
    assert.equal(heart.bmpNormalName.texture.id, 'name_Shan'); assert.equal(heart.bmpNormalName.visible, true);
    assert.equal(weapon.bmpName.visible, true); assert.equal(weapon.bmpCardType.visible, true);
  });
  h.feature.start(); await h.feature.setMode('tarot');
  await check('loaded tarot face suppresses exactly the six original face-content layers', () => {
    assert.equal(heart.bmpFace.texture.id, 'faces/Shan_heart.png');
    assert.equal(diamond.bmpFace.texture.id, 'faces/Shan_diamond.png');
    for (const ui of [heart, diamond, weapon]) assertContentHidden(ui);
  });
  await check('selection, skill tags and functional range layers remain visible', () => {
    for (const ui of [heart, weapon]) {
      assert.equal(ui.selectedBorder.visible, true); assert.equal(ui.tempCardTag.visible, true);
      assert.equal(ui.bmpRange.visible, true);
    }
  });
  await check('direct content update and full native redraw cannot reshow original art', () => {
    for (let i = 0; i < 20; i++) {
      heart.updateNewCardFace(); heart.UpdateCardFace(); weapon.updateNewCardFace(); weapon.Draw();
      assertContentHidden(heart); assertContentHidden(weapon);
    }
  });
  await check('switching to original restores each native layer with its own visibility', async () => {
    await h.feature.setMode('original');
    assert.equal(heart.bmpFace2.visible, true); assert.equal(heart.bmpNormalName.visible, true);
    assert.equal(heart.bmpName.visible, false); assert.equal(heart.bmpNameBg.visible, false);
    assert.equal(weapon.bmpName.visible, true); assert.equal(weapon.bmpCardType.visible, true);
    assert.equal(weapon.bmpNormalName.visible, false); assert.equal(weapon.bmpNameBg.visible, false);
    await h.feature.setMode('tarot'); assertContentHidden(heart);
  });
  await check('unlisted cards keep their complete native illustration and title', () => {
    const sha = h.view('Sha', 1); h.feature.refresh();
    assert.equal(sha.bmpFace.texture.id, 'cardFace_0'); assert.equal(sha.bmpFace2.visible, true);
    assert.equal(sha.bmpNormalName.visible, true); assert.equal(sha.bmpNumber.texture.id, 'red_2');
  });
  await check('reusing a themed UI for another native card restores the original composition', () => {
    diamond.clear(); diamond.theCard = { ResName: 'Sha', CardFlower: 1, CardNumber: 7, CardBaseType: 1 };
    diamond.UpdateCardFace(); assert.equal(diamond.bmpFace2.visible, true);
    assert.equal(diamond.bmpFace2.texture.id, 'face_Sha'); assert.equal(diamond.bmpNormalName.texture.id, 'name_Sha');
  });
  await check('explicit native face override survives theme refresh until normal redraw', () => {
    heart.UpdateCardFaceRes('face_JunZi_1', 'name_JunZi'); h.feature.refresh();
    assert.equal(heart.bmpFace2.visible, true); assert.equal(heart.bmpFace2.texture.id, 'face_JunZi_1');
    heart.UpdateCardFace(); assertContentHidden(heart);
    heart.UpdateCardFaceOrBackRes('cardBack_0', false); h.feature.refresh();
    assert.equal(heart.bmpFace.texture.id, 'cardBack_0'); assert.equal(heart.bmpFace2.visible, false);
    heart.UpdateCardFace(); assertContentHidden(heart);
  });
  await check('reset and disposal do not resurrect cleared native layers', () => {
    heart.resetNewCardFace(); h.feature.dispose();
    for (const name of contentNames) assert.equal(heart[name].visible, false);
  });
  await check('missing tarot face retains native art while available number glyph can load', async () => {
    const x = fixture({ missingFace: true }), ui = x.view(); x.feature.start(); await x.feature.setMode('tarot');
    assert.equal(ui.bmpFace.texture.id, 'cardFace_0'); assert.equal(ui.bmpFace2.visible, true);
    assert.equal(ui.bmpNormalName.visible, true); assert.equal(ui.bmpNumber.texture.id, 'ranks/2.png');
    x.feature.dispose();
  });
  await check('late face loading hides native content only after the replacement is ready', async () => {
    let release; const gate = { promise: new Promise(resolve => { release = resolve; }) };
    const x = fixture({ delayedFace: gate }), ui = x.view(); x.feature.start();
    const pending = x.feature.setMode('tarot');
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(ui.bmpFace.texture.id, 'cardFace_0'); assert.equal(ui.bmpFace2.visible, true);
    assert.equal(ui.bmpNormalName.visible, true);
    release(); await pending; assertContentHidden(ui); x.feature.dispose();
  });
  await check('restoration uses the latest native layer choices after a card-type change', async () => {
    const x = fixture(), ui = x.view(); x.feature.start(); await x.feature.setMode('tarot');
    ui.Card.CardBaseType = 2; ui.updateNewCardFace(); assertContentHidden(ui);
    x.feature.dispose();
    assert.equal(ui.bmpNormalName.visible, false); assert.equal(ui.bmpName.visible, true);
    assert.equal(ui.bmpNameBg.visible, true); assert.equal(ui.bmpCardType.visible, true);
    assert.equal(ui.bmpSmallDesc.visible, true);
  });
  process.stdout.write('PASS ' + passed + ' native split-card layer checks\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
