const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const createClient = require('../src/adapters/card-theme-client');
const createFeature = require('../src/features/card-theme');
const { createCardThemeAssetReader, registerCardThemeAssets } = require('../src/electron/card-theme-assets');
const project = path.resolve(__dirname, '..');
const assetRoot = path.join(project, 'resources/card-themes/tarot');
const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8'));
const nativeSource = fs.readFileSync(process.env.XC_OL_MAIN ||
  'C:/Users/97349/AppData/Local/Temp/codex-ol-zuifeng-qJebR9/sgsGame.main.js', 'utf8');
let passed = 0;
async function check(name, action) { await action(); passed++; process.stdout.write('PASS ' + name + '\n'); }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function section(start, end) {
  const a = nativeSource.indexOf(start), b = nativeSource.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, start); return nativeSource.slice(a, b);
}
async function installLegacyCardBack(ui) {
  const script = fs.readFileSync(path.join(project, 'resources/daxiaochao.user.js'), 'utf8');
  const a = script.indexOf('  async function setCardBack()'), b = script.indexOf('  function _0x52c243()', a);
  assert(a >= 0 && b > a);
  const decoder = require('../../doc/彩虹表.js').tables._0x262d;
  const mappings = { ...decoder.all, ...decoder.used };
  const context = vm.createContext({
    _0x43fec8: key => mappings[key], _0x293ce3: () => ({}),
    _0x2beec1: () => true, _0x19e0b1: () => true, _0x1dffb0: () => true,
    _0x10ff56: {
      laya: { gamescene: { seatContainer: { seatUIs: [{ cardContainer: { cardUis: [ui] } }] } } },
      redefine(target, name, descriptor) {
        if (typeof target[name] === 'function' && typeof target['__' + name] !== 'function') {
          target['__' + name] = target[name]; Object.defineProperty(target, name, { ...descriptor, configurable: true });
        }
      },
    },
  });
  await vm.runInContext(script.slice(a, b) + '\nsetCardBack();', context);
}
function fixture({ saved = 'original', miao = false, reader, loader } = {}) {
  const originals = new Map();
  const nativeTexture = key => {
    if (!originals.has(key)) originals.set(key, { id: key });
    return originals.get(key);
  };
  const Base = class {
    UpdateCardFace() { this.SetCardFace(); }
    SetCardFace() { this.bmpFace.texture = nativeTexture(this.theCard ? this.theCard.ResName + '_png' : 'EMPTY'); }
    clear() { this.Clear(); }
    destroy() { this.destroyed = true; }
    Draw() { return 27; }
  };
  Base.prototype.RefreshCardFace = vm.runInNewContext(
    '({' + section('RefreshCardFace(t){let i=c1t.GetSeat(t)', 'ClearAiHelp(){') + '}).RefreshCardFace',
    { c1t: { GetSeat: () => ({}) } });
  const context = vm.createContext({
    zzt: Base, UF: { GetInstance: () => ({}) }, vF: { GetInstance: () => ({}) },
    c1t: { IsPokerDDZ: false }, FCt: { SKILL_YINGBIAN_SUI_JI_YING_BIAN: 9999 },
    fwt: { GetRes: nativeTexture }, YBi: { GetEmptyTextrue: () => nativeTexture('EMPTY') },
    bF: { MAX_SIZE: { width: 93 }, NORMAL_SIZE: { width: 93 } },
  });
  vm.runInContext(section('class _q{', '!function(t){t[t.mark=0]') +
    section('class iVi extends zzt{', 'class sVi extends iVi{') + '\nglobalThis.Ui = iVi;', context);
  const Ui = context.Ui;
  Ui.prototype.Clear = function () { this.theCard = null; this.bmpFace.texture = nativeTexture('EMPTY'); };
  const views = new Set(), events = new Map(), logs = [], released = [];
  const window = { setTimeout, clearTimeout,
    addEventListener(name, callback) { events.set(name, callback); },
    removeEventListener(name, callback) { if (events.get(name) === callback) events.delete(name); } };
  const backing = { cardBackSwitch: true, miaoCardSwitch: miao };
  const config = new Proxy(backing, { set(target, key, value) {
    const changed = target[key] !== value; target[key] = value;
    if (changed && events.has('xc:config-change')) events.get('xc:config-change')({ detail: { property: key } });
    return true;
  } });
  const storage = new Map(saved == null ? [] : [['xcCardFaceTheme', saved]]);
  const client = createClient({ window, getLaya: () => ({ class: () => Ui }), getEngine: () => null,
    getRegisteredUis: () => [...views], log: (...args) => logs.push(args) });
  const realReader = createCardThemeAssetReader({ roots: [assetRoot] });
  const urls = new Map();
  client.readAsset = async relative => {
    const result = reader ? await reader(relative, realReader) : await realReader(relative);
    if (result && result.dataUrl) urls.set(result.dataUrl, relative);
    return result;
  };
  client.makeTexture = async (dataUrl, size) => loader ? loader(urls.get(dataUrl), size) :
    { id: urls.get(dataUrl), width: size[0], height: size[1] };
  client.releaseTexture = (texture, dataUrl) => { if (texture) texture.destroyed = true; released.push({ texture, dataUrl }); };
  const miaoCalls = [];
  const feature = createFeature({ window, document: {}, client, getConfig: () => config,
    storage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    setMiaoEnabled: async value => { miaoCalls.push(value); for (const ui of views) ui.UpdateCardFace(); },
    log: (...args) => logs.push(args),
  });
  function view(resource = 'Shan', flower = 1, number = 2) {
    const card = { ResName: resource, CardFlower: flower, CardNumber: number };
    const ui = Object.assign(Object.create(Ui.prototype), { theCard: card, bmpFace: {}, bmpNumber: { visible: true },
      bmpFlower: { visible: true }, bmpRange: {}, changeFlower: {}, layout() {}, emptyRes: 'empty',
      UpdatePokerCardFace() { this.bmpFace.texture = nativeTexture('POKER'); } });
    views.add(ui); ui.UpdateCardFace(); return ui;
  }
  return { feature, client, view, Ui, Base, views, config, storage, logs, released, miaoCalls, nativeTexture };
}

(async () => {
  await check('manifest retains starter faces and provides all 13 shared ranks and four suits', () => {
    assert(manifest.faces.Shan_png['1'] && manifest.faces.Shan_png['2'] && manifest.faces.HanBingJian_png['3']);
    assert.deepEqual(Object.keys(manifest.ranks), Array.from({ length: 13 }, (_, i) => String(i + 1)));
    assert(Object.values(manifest.ranks).every(Boolean));
    assert.deepEqual(Object.keys(manifest.suits), ['1', '2', '3', '4']); assert(Object.values(manifest.suits).every(Boolean));
    assert.equal(manifest.ranks['1'], 'ranks/A.png'); assert.equal(manifest.ranks['11'], 'ranks/J.png');
    assert.equal(manifest.ranks['12'], 'ranks/Q.png'); assert.equal(manifest.ranks['13'], 'ranks/K.png');
    assert(!JSON.stringify(manifest.ranks).includes('red_'));
  });
  await check('installed asset reader rejects traversal and handles missing PNGs', async () => {
    const read = createCardThemeAssetReader({ roots: [assetRoot] });
    assert((await read('manifest.json')).ok);
    assert((await read('faces/Shan_heart.png')).dataUrl.startsWith('data:image/png;base64,'));
    for (const name of ['../version.json', 'faces/../../config.json', 'C:/config.json', 'faces/x.png?x', 'ranks\\2.png'])
      assert.equal((await read(name)).code, 'invalid-asset');
    assert.equal((await read('ranks/unavailable.png')).code, 'missing');
  });
  await check('IPC registration is idempotent and reads wait for installation', async () => {
    const handlers = new Map(), gate = deferred();
    const ipcMain = { handle(name, handler) { assert(!handlers.has(name)); handlers.set(name, handler); } };
    const options = { ipcMain, roots: [assetRoot], whenIdle: () => gate.promise };
    assert.equal(registerCardThemeAssets(options), registerCardThemeAssets(options));
    let complete = false;
    const request = handlers.get('read-card-theme-asset')({}, 'manifest.json').then(x => { complete = true; return x; });
    await Promise.resolve(); assert.equal(complete, false); gate.resolve(); assert((await request).ok);
  });
  const h = fixture(); h.feature.start(); await h.feature.sync();
  await check('real native UpdateCardFace renders simultaneous heart and diamond variants', async () => {
    h.heart = h.view(); h.diamond = h.view('Shan', 2, 2); h.weapon = h.view('HanBingJian', 3, 2);
    h.uncovered = h.view('WuXieKeJi', 1, 2);
    await h.feature.setMode('tarot');
    assert.equal(h.heart.bmpFace.texture.id, 'faces/Shan_heart.png');
    assert.equal(h.diamond.bmpFace.texture.id, 'faces/Shan_diamond.png');
    assert.equal(h.weapon.bmpFace.texture.id, 'faces/HanBingJian_spade.png');
    assert.equal(h.uncovered.bmpFace.texture.id, 'WuXieKeJi_png');
    assert.equal(h.uncovered.bmpNumber.texture.id, 'red_2');
  });
  await check('ordinary native multi-skill checks leave all three tarot faces and layers unchanged', () => {
    for (const ui of [h.heart, h.diamond, h.weapon]) {
      const face = ui.bmpFace.texture, rank = ui.bmpNumber.texture, suit = ui.bmpFlower.texture;
      // HandCardContainer.skillCardLabelChange calls this even when the ordinary card has no multi-skill state.
      for (let i = 0; i < 5; i++) ui.UpdateMultiSkill();
      assert.equal(ui.bmpFace.texture, face, 'ordinary UpdateMultiSkill must not restore the original face');
      assert.equal(ui.bmpNumber.texture, rank); assert.equal(ui.bmpFlower.texture, suit);
    }
  });
  await check('legacy card-back wrapper installed first cannot leave native face under tarot glyphs', async () => {
    const x = fixture(), ui = x.view();
    await installLegacyCardBack(ui);
    x.feature.start(); await x.feature.setMode('tarot');
    const face = ui.bmpFace.texture, number = ui.bmpNumber.texture, suit = ui.bmpFlower.texture;
    ui.RefreshCardFace(0);
    assert.equal(ui.bmpFace.texture, face, 'RefreshCardFace via __SetCardFace must retain tarot base');
    assert.equal(ui.bmpNumber.texture, number); assert.equal(ui.bmpFlower.texture, suit);
    x.feature.dispose();
  });
  await check('legacy card-back wrapper installed later preserves tarot and survives disposal', async () => {
    const x = fixture(), ui = x.view(); x.feature.start(); await x.feature.setMode('tarot');
    await installLegacyCardBack(ui);
    const legacy = x.Ui.prototype.SetCardFace;
    for (let i = 0; i < 5; i++) ui.RefreshCardFace(0);
    assert.equal(ui.bmpFace.texture.id, 'faces/Shan_heart.png');
    x.feature.dispose(); assert.equal(x.Ui.prototype.SetCardFace, legacy);
    ui.RefreshCardFace(0); assert.equal(ui.bmpFace.texture.id, 'Shan_png');
  });
  await check('routine checks, Draw and theme refresh perform no restore/reapply texture writes', () => {
    const ui = h.heart; let writes = 0;
    for (const node of [ui.bmpFace, ui.bmpNumber, ui.bmpFlower]) {
      let value = node.texture;
      Object.defineProperty(node, 'texture', { configurable: true, get: () => value,
        set(next) { writes++; value = next; } });
    }
    for (let i = 0; i < 40; i++) {
      ui.UpdateMultiSkill(); ui.SetChangeSkill(''); ui.Draw(); h.feature.refresh();
    }
    assert.equal(writes, 0);
    const ordinaryLogs = h.logs.filter(line => String(line[0]).includes('普通技能检查保留塔罗'));
    assert(ordinaryLogs.length <= 6, 'ordinary checks log transitions, not every alternating method');
  });
  await check('actual multi-skill state falls back and ending it restores tarot immediately', () => {
    const ui = h.view(); ui.removeDrawChild = () => {};
    let cleared = 0; ui.multiSkillAnimate = { clear() { cleared++; } };
    ui.theCard.IsMultiSkillState = true; ui.UpdateMultiSkill();
    assert.equal(ui.bmpFace.texture.id, 'Shan_png'); assert.equal(ui.bmpNumber.texture.id, 'red_2');
    ui.theCard.IsMultiSkillState = false; ui.UpdateMultiSkill();
    assert.equal(ui.bmpFace.texture.id, 'faces/Shan_heart.png'); assert.equal(cleared, 1);
    assert.equal(ui.multiSkillAnimate, null);
  });
  await check('adding then removing native skill-face overlay restores the tarot base', () => {
    const ui = h.view(); ui.removeDrawChild = () => {};
    ui.changeSkillTex = {}; ui.SetChangeSkill('TEST');
    assert.equal(ui.bmpFace.texture.id, 'Shan_png');
    assert.equal(ui.changeSkillTex.texture.id, 'C_TEST_Nor');
    ui.SetChangeSkill(''); assert.equal(ui.bmpFace.texture.id, 'faces/Shan_heart.png');
    assert.equal(ui.bmpFlower.texture.id, 'suits/heart.png');
  });
  await check('red and black share rank textures and all declared suit glyphs load', () => {
    assert.equal(h.heart.bmpNumber.texture, h.weapon.bmpNumber.texture);
    assert.equal(h.heart.bmpFlower.texture.id, 'suits/heart.png');
    assert.equal(h.diamond.bmpFlower.texture.id, 'suits/diamond.png');
    assert.equal(h.weapon.bmpFlower.texture.id, 'suits/spade.png');
    h.heart.theCard.CardNumber = 12; h.heart.UpdateCardFace();
    assert.equal(h.heart.bmpNumber.texture.id, 'ranks/Q.png');
    assert.equal(h.heart.bmpFace.texture.id, 'faces/Shan_heart.png');
  });
  await check('UI-only change uses its arguments, keeps the model intact and refresh resets it', () => {
    h.heart.ChangeFlowerAndNumber(2, 2);
    assert.equal(h.heart.bmpFace.texture.id, 'faces/Shan_diamond.png');
    assert.equal(h.heart.bmpFlower.texture.id, 'suits/diamond.png');
    assert.equal(h.heart.theCard.CardFlower, 1); assert.equal(h.heart.theCard.CardNumber, 12);
    h.feature.refresh(); assert.equal(h.heart.bmpFace.texture.id, 'faces/Shan_diamond.png');
    h.heart.UpdateCardFace(); assert.equal(h.heart.bmpFace.texture.id, 'faces/Shan_heart.png');
    assert.equal(h.heart.bmpNumber.texture.id, 'ranks/Q.png');
  });
  await check('temporary change to an unsupported suit restores the original face', () => {
    h.heart.ChangeFlowerAndNumber(3, 5);
    assert.equal(h.heart.bmpFace.texture.id, 'Shan_png');
    assert.equal(h.heart.bmpFlower.texture.id, 'spade');
    assert.equal(h.heart.bmpNumber.texture.id, 'black_5');
  });
  await check('current display suit follows the server flag, not unconditional effective suit', () => {
    Object.assign(h.heart.theCard, { FlowerOnSeat: 2, IsModyfifyByServer: false });
    h.heart.UpdateCardFace(); assert.equal(h.heart.bmpFace.texture.id, 'faces/Shan_heart.png');
    h.heart.theCard.IsModyfifyByServer = true; h.heart.UpdateCardFace();
    assert.equal(h.heart.bmpFace.texture.id, 'faces/Shan_diamond.png');
  });
  await check('static weapon badge is used regardless of special attack range', () => {
    h.weapon.theCard.AttackRangeOrigin = 1; h.weapon.UpdateCardFace();
    assert.equal(h.weapon.bmpFace.texture.id, 'faces/HanBingJian_spade.png');
    assert.equal(h.weapon.theCard.AttackRangeOrigin, 1);
  });
  await check('hidden glyphs stay hidden and zero values never get a default glyph', () => {
    h.diamond.HideFlowerAndNumber(); h.diamond.UpdateCardFace();
    assert.equal(h.diamond.bmpNumber.visible, false); assert.equal(h.diamond.bmpFlower.visible, false);
    h.diamond.theCard.CardNumber = 0; h.diamond.UpdateCardFace(); assert.equal(h.diamond.bmpNumber.texture.id, 'EMPTY');
    h.diamond.theCard.CardFlower = 0; h.diamond.UpdateCardFace(); assert.equal(h.diamond.bmpFace.texture.id, 'Shan_png');
  });
  await check('empty, virtual and poker cards keep the native branch', () => {
    const ui = h.view(); ui.theCard.IsEmpty = true; ui.UpdateCardFace(); assert.equal(ui.bmpNumber.texture.id, 'EMPTY');
    ui.theCard.IsEmpty = false; ui.theCard.IsVirtualCard = true; ui.theCard.VirtualColor = 1;
    ui.UpdateCardFace(); assert.equal(ui.bmpFlower.texture.id, 'virtural_card_1');
    ui.isPokerCardFace = true; ui.UpdateCardFace(); assert.equal(ui.bmpFace.texture.id, 'POKER');
  });
  await check('equipment subclass with its own renderer is not replaced', () => {
    const ui = h.view('HanBingJian', 3, 2);
    ui.UpdateCardFace = function () { this.bmpFace.texture = h.nativeTexture('Equip_HanBingJian_S'); };
    ui.UpdateCardFace(); h.feature.refresh(); assert.equal(ui.bmpFace.texture.id, 'Equip_HanBingJian_S');
  });
  await check('special skill-face branches keep their face during later theme refreshes', () => {
    for (const property of ['changeSkillTex', 'IsMultiSkillState']) {
      const ui = h.view();
      if (property === 'changeSkillTex') ui[property] = {};
      else ui.theCard[property] = true;
      ui.bmpFace.texture = h.nativeTexture('SPECIAL');
      h.feature.refresh(); assert.equal(ui.bmpFace.texture.id, 'SPECIAL');
    }
  });
  await check('clear and object reuse do not retain another card or temporary display', () => {
    h.weapon.ChangeFlowerAndNumber(1, 2); h.weapon.clear();
    h.weapon.theCard = { ResName: 'WuXieKeJi', CardFlower: 2, CardNumber: 7 };
    h.weapon.UpdateCardFace(); assert.equal(h.weapon.bmpFace.texture.id, 'WuXieKeJi_png');
    assert.equal(h.weapon.bmpNumber.texture.id, 'red_7');
  });
  await check('original/miao/tarot selection is exclusive and original restores each layer', async () => {
    await h.feature.setMode('original');
    assert.equal(h.heart.bmpFace.texture.id, 'Shan_png'); assert.equal(h.config.miaoCardSwitch, false);
    await h.feature.setMode('miao'); assert.equal(h.feature.getMode(), 'miao'); assert.equal(h.config.miaoCardSwitch, true);
    await h.feature.setMode('tarot'); assert.equal(h.feature.getMode(), 'tarot'); assert.equal(h.config.miaoCardSwitch, false);
    assert.equal(h.storage.get('xcCardFaceTheme'), 'tarot');
  });
  await check('master switch restores native display and keeps the selected preference', async () => {
    h.config.cardBackSwitch = false; await h.feature.sync();
    assert.equal(h.feature.getMode(), 'original'); assert.equal(h.heart.bmpFace.texture.id, 'Shan_png');
    h.config.cardBackSwitch = true; await h.feature.sync(); assert.equal(h.feature.getMode(), 'tarot');
  });
  await check('dispose preserves a later wrapper and repeated initialization does not duplicate hooks', async () => {
    const wrapped = h.Ui.prototype.UpdateCardFace;
    h.feature.start(); assert.equal(h.Ui.prototype.UpdateCardFace, wrapped);
    let calls = 0;
    const later = function (...args) { calls++; return wrapped.apply(this, args); };
    h.Ui.prototype.UpdateCardFace = later; h.feature.dispose();
    assert.equal(h.Ui.prototype.UpdateCardFace, later);
    h.heart.UpdateCardFace(); assert.equal(calls, 1); assert.equal(h.heart.bmpFace.texture.id, 'Shan_png');
    h.feature.start(); await h.feature.sync(); h.feature.dispose();
  });
  await check('missing face file falls back independently while the shared number still loads', async () => {
    const x = fixture({ reader: (file, read) => file === 'faces/Shan_heart.png' ? { ok: false, code: 'missing' } : read(file) });
    const ui = x.view(); x.feature.start(); await x.feature.setMode('tarot');
    assert.equal(ui.bmpFace.texture.id, 'Shan_png'); assert.equal(ui.bmpNumber.texture.id, 'ranks/2.png');
    x.feature.dispose();
  });
  await check('every declared face variant renders all 13 ranks without changing the model', async () => {
    const x = fixture(); x.feature.start(); await x.feature.setMode('tarot');
    for (const [key, variants] of Object.entries(manifest.faces)) for (const [flower, face] of Object.entries(variants)) {
      for (let number = 1; number <= 13; number++) {
        const ui = x.view(key.replace(/_png$/, ''), Number(flower), number);
        assert.equal(ui.bmpFace.texture.id, face); assert.equal(ui.bmpNumber.texture.id, manifest.ranks[number]);
        assert.equal(ui.bmpFlower.texture.id, manifest.suits[flower]);
        assert.equal(ui.Card.CardNumber, number); assert.equal(ui.Card.CardFlower, Number(flower));
      }
    }
    x.feature.dispose();
  });
  await check('missing rank or suit files still fall back independently after the palette is complete', async () => {
    const x = fixture({ reader: (file, read) => ['ranks/Q.png', 'suits/diamond.png'].includes(file) ? { ok: false, code: 'missing' } : read(file) });
    const ui = x.view('Shan', 2, 12); x.feature.start(); await x.feature.setMode('tarot');
    assert.equal(ui.bmpFace.texture.id, 'faces/Shan_diamond.png');
    assert.equal(ui.bmpNumber.texture.id, 'red_Q'); assert.equal(ui.bmpFlower.texture.id, 'diamond');
    x.feature.dispose();
  });
  await check('late PNG completion after selection change never repaints the new mode', async () => {
    const gate = deferred(), entered = deferred();
    const x = fixture({ loader: async (file, size) => { entered.resolve(); await gate.promise; return { id: file, width: size[0] }; } });
    const ui = x.view(); x.feature.start(); const pending = x.feature.setMode('tarot');
    await entered.promise; await x.feature.setMode('original');
    gate.resolve(); await pending; assert.equal(ui.bmpFace.texture.id, 'Shan_png'); x.feature.dispose();
  });
  await check('late PNG completion after disposal releases its texture', async () => {
    const gate = deferred(), entered = deferred();
    const x = fixture({ loader: async file => { entered.resolve(); await gate.promise; return { id: file }; } });
    x.view(); x.feature.start(); const pending = x.feature.setMode('tarot');
    await entered.promise; x.feature.dispose(); gate.resolve(); await pending;
    assert(x.released.some(entry => entry.texture && entry.texture.destroyed));
  });
  await check('existing miao preference migrates when no new preference exists', async () => {
    const x = fixture({ saved: null, miao: true }); x.feature.start(); await x.feature.sync();
    assert.equal(x.feature.getMode(), 'miao'); x.feature.dispose();
  });
  const userscript = fs.readFileSync(path.join(project, 'resources/daxiaochao.user.js'), 'utf8');
  const rainbow = require('../../doc/彩虹表.js').tables._0x262d;
  const mappings = { ...rainbow.all, ...rainbow.used };
  const a = userscript.indexOf('  function _0x52c243()'), b = userscript.indexOf('  function installCardThemeRuntime()', a);
  await check('real miao runtime remains singleton and ignores a stale enable completion', async () => {
    let wanted = true;
    const context = vm.createContext({ window: {}, _0x43fec8: key => mappings[key], _0x10ff56: { laya: {} },
      _0x5db4b9: () => wanted, _0x293ce3: () => ({ miaoCardSwitch: wanted }), appendLocalSkinDebugLine() {} });
    vm.runInContext(userscript.slice(a, b) + '\nglobalThis.runtime = _0x52c243();', context);
    const runtime = context.runtime, gate = deferred();
    runtime.baseCardTexMap.set('sample', 'original');
    assert.equal(vm.runInContext('_0x52c243()', context), runtime);
    assert.equal(runtime.baseCardTexMap.get('sample'), 'original');
    runtime.ensureAtlas = () => gate.promise; runtime.syncTextureMap = () => {}; runtime.refresh = () => {};
    const pending = runtime.setEnabled(true, false); wanted = false; await runtime.setEnabled(false, false);
    gate.resolve(true); await pending; assert.equal(runtime.enabled, false);
  });
  await check('assembled host wires both modules, lifecycle, IPC and release assets', () => {
    const { assemble } = require('../scripts/build-userscript-modules.cjs'); assert.equal(assemble(userscript), userscript);
    assert(userscript.includes('cardThemeFeature.dispose();'));
    assert(userscript.includes('cardThemeFeature.mount(document.getElementById("cardThemeDialog"));'));
    const mapping = JSON.parse(fs.readFileSync(path.join(project, 'release-files.json'), 'utf8'));
    for (const relative of ['manifest.json', ...Object.values(manifest.faces).flatMap(Object.values),
      ...Object.values(manifest.ranks), ...Object.values(manifest.suits)].filter(Boolean)) {
      assert(mapping.files.some(file => file.target === 'card-themes/tarot/' + relative));
      assert(fs.existsSync(path.join(assetRoot, relative)));
    }
  });
  process.stdout.write('PASS ' + passed + ' card-theme checks (native snapshot methods + simulated engine)\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
