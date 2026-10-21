// Actual settings binder, module and PNG decoding in Chromium. Native drawing is represented by DOM layers.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const project = path.resolve(__dirname, '..'), repo = path.dirname(project);
const source = fs.readFileSync(path.join(project, 'resources/daxiaochao.user.js'), 'utf8');
const clientFactory = require('../src/adapters/card-theme-client').toString();
const featureFactory = require('../src/features/card-theme').toString();
const nativeContentMethod = require('./fixtures/card-face-layers-20261021.json').methods.updateNewCardFace.source;
const table = require('../../doc/彩虹表.js').tables._0x262d;
const mappings = { ...table.all, ...table.used };
const assetRoot = path.join(project, 'resources/card-themes/tarot');
const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8'));
const assets = { 'manifest.json': { ok: true, manifest } };
for (const name of [...Object.values(manifest.faces).flatMap(Object.values), ...Object.values(manifest.ranks),
  ...Object.values(manifest.suits)].filter(Boolean))
  assets[name] = { ok: true, dataUrl: 'data:image/png;base64,' + fs.readFileSync(path.join(assetRoot, name)).toString('base64') };
const originals = {};
for (const key of ['Shan', 'HanBingJian', 'Sha']) originals[key + '_png'] =
  'data:image/png;base64,' + fs.readFileSync(path.join(repo, '卡牌归档/卡牌拆分/cards', key + '_png.png')).toString('base64');
function sourceSlice(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a); return source.slice(a, b);
}
const a = source.indexOf('  function D() {'), b = source.indexOf('    ];', a);
const strings = vm.runInNewContext(source.slice(source.indexOf('[', a), b + 5));
function decode(text) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';
  let bytes = '', value = 0, count = 0;
  for (const char of text) {
    const n = alphabet.indexOf(char); if (n < 0) continue;
    value = count % 4 ? 64 * value + n : n;
    if (count++ % 4) bytes += String.fromCharCode(255 & (value >> ((-2 * count) & 6)));
  }
  return decodeURIComponent(Array.from(bytes, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
}
const markup = strings.filter(s => s.length > 3000).map(decode).find(s => s.includes('id="cardThemeDialog"'));
assert(markup);
const dialogStart = markup.indexOf('<dialog id="cardThemeDialog"'), dialogEnd = markup.indexOf('</dialog>', dialogStart) + 9;
const style = markup.match(/<style>([\s\S]*?)<\/style>/)[1];
const binder = sourceSlice('  function _0x126168(n)', '  function initCardThemePopup()');
function fixture() {
  window.logs = [];
  window.assertCheck = (condition, name) => { if (!condition) throw Error(name); window.passed++; };
  window.passed = 0;
  window.config = { cardBackSwitch: true, miaoCardSwitch: false };
  window._0x43fec8 = key => decoded[key];
  window._0x293ce3 = () => config;
  window._0x187a8e = () => '';
  window._0xd4d8c6 = () => 'origin';
  window._0x41f89e = 'origin'; window._0x47b923 = 'gold';
  window._0x19e0b1 = () => config.cardBackSwitch;
  window._0x5db4b9 = () => cardThemeFeature.getMode() === 'miao';
  window._0x2932db = node => {
    if (node.id === 'miaoCardPreview') { node.textContent = '沿用现有猫猫素材'; node.style.cssText = 'display:grid;place-items:center;font-size:12px'; return; }
    node.style.backgroundImage = 'url("' + originalPngs.Shan_png + '")'; node.style.backgroundSize = 'cover';
  };
  window._0x210585 = () => {};
  for (const name of ['_0x3b9f65', '_0x59bbcf', '_0x2a4c5d', '_0x2386b0', '_0x44cb2b', '_0x3d67d7',
    '_0x347abb', '_0xa2ecb', '_0xd3dd1f', '_0x5bbef8', '_0xeccfff', '_0xbae931']) window[name] = null;
  const textures = new Map();
  window.daxiaochaoElectron = { readCardThemeAsset: async name => assetData[name] || { ok: false, code: 'missing' } };
  window.engine = {
    Handler: { create: (_owner, callback) => callback }, Loader: { IMAGE: 'image' },
    Texture: { create: texture => ({ ...texture, destroy() { this.destroyed = true; } }) },
    loader: {
      load(url, callback) {
        const image = new Image();
        image.onload = () => { textures.set(url, { image, width: image.width, height: image.height,
          sourceWidth: image.width, sourceHeight: image.height }); callback(); };
        image.onerror = callback; image.src = url;
      },
      getRes: url => textures.get(url), clearRes: url => textures.delete(url),
    },
  };
  const views = [];
  class Base {
    SetCardFace() { this.bmpFace.texture = { image: { src: originalPngs[this.Card.ResName + '_png'] } }; }
    UpdateCardFace() { this.SetCardFace(); }
    clear() {} destroy() { this.destroyed = true; } Draw() {}
  }
  class Normal extends Base {
    get Card() { return this.theCard; }
    SetCardFace() { super.SetCardFace(); this.updateNewCardFace(); }
    layout() {}
    UpdateCardFace() { super.UpdateCardFace(); this.ChangeFlowerAndNumber(this.Card.CardFlower, this.Card.CardNumber); }
    ChangeFlowerAndNumber(flower, rank) {
      this.bmpNumber.texture = { text: ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rank], flower };
      this.bmpFlower.texture = { text: ['', '♥', '♦', '♠', '♣'][flower], flower };
    }
  }
  Normal.prototype.updateNewCardFace = new Function('uNt', 'Rmt', 'Gqi', 'return ({' + nativeContentSource + '}).updateNewCardFace')({
    GetRes(key) {
      if (key.startsWith('face_') || key.startsWith('name_'))
        return { image: { src: originalPngs[key.slice(5) + '_png'] } };
      return { text: key.startsWith('card_type') ? '装备' : '' };
    },
  }, { BASIC: 1, JINNANG: 2, EQUIP: 3 }, { SMALL_DESC_PREFIX: 'small_desc' });
  function layer(parent, className) {
    const node = document.createElement('div'); node.className = className; parent.appendChild(node);
    let visible = true;
    return {
      get visible() { return visible; },
      set visible(value) { visible = value; node.style.display = value ? '' : 'none'; },
      get texture() { return this.value; },
      set texture(value) {
        this.value = value; node.replaceChildren();
        if (value && value.image) { const image = document.createElement('img'); image.src = value.image.src; node.appendChild(image); }
        else if (value && value.text) { node.textContent = value.text; node.style.color = value.flower <= 2 ? '#b60b16' : '#161616'; }
      },
    };
  }
  for (const [resource, flower, number, title] of [
    ['Shan', 1, 2, '红桃闪 · 三层'], ['Shan', 2, 2, '方块闪 · 共用点数2'],
    ['HanBingJian', 3, 2, '寒冰剑 · 原花色图层'], ['Sha', 1, 7, '杀 · 原始图层'],
  ]) {
    const card = document.createElement('div'); card.className = 'sample';
    const front = document.createElement('div'); front.className = 'front'; card.appendChild(front);
    const label = document.createElement('div'); label.className = 'sample-label'; label.textContent = title; card.appendChild(label);
    document.getElementById('cards').appendChild(card);
    const ui = Object.assign(Object.create(Normal.prototype), { isNewCardUI: true,
      theCard: { ResName: resource, CardFlower: flower, CardNumber: number, CardBaseType: resource === 'HanBingJian' ? 3 : 1 },
      bmpFace: layer(front, 'xc-test-face'), bmpFace2: layer(front, 'xc-test-native-art'),
      bmpNormalName: layer(front, 'xc-test-native-name'), bmpNameBg: layer(front, 'xc-test-native-bg'),
      bmpName: layer(front, 'xc-test-native-name'), bmpCardType: layer(front, 'xc-test-native-type'),
      bmpSmallDesc: layer(front, 'xc-test-native-desc'),
      bmpNumber: layer(front, 'xc-test-rank'), bmpFlower: layer(front, 'xc-test-suit') });
    views.push(ui); ui.UpdateCardFace();
  }
  window.views = views;
  const client = makeClient({ window, getLaya: () => ({ class: () => Normal }), getEngine: () => engine,
    getRegisteredUis: () => views, log: (...args) => logs.push(args) });
  window.cardThemeFeature = makeFeature({ window, document, storage: localStorage, client, getConfig: () => config,
    setMiaoEnabled: async () => views.forEach(ui => ui.UpdateCardFace()), log: (...args) => logs.push(args) });
}
async function runChecks() {
  try {
    cardThemeFeature.start();
    const dialog = document.getElementById('cardThemeDialog'); dialog.show();
    _0x126168(dialog); _0x126168(dialog);
    assertCheck(document.querySelectorAll('#tarotCardCell').length === 1, 'idempotent dialog mount');
    assertCheck(dialog.querySelectorAll('[role=radio]').length === 3, 'three real exclusive choices');
    document.getElementById('tarotCardUseBtn').click(); await cardThemeFeature.sync();
    assertCheck(cardThemeFeature.getMode() === 'tarot', 'tarot button selects theme');
    assertCheck(dialog.querySelectorAll('[role=radio][aria-checked=true]').length === 1, 'single selected option');
    assertCheck(views[0].bmpFace.texture.image.src === assetData['faces/Shan_heart.png'].dataUrl, 'real heart PNG decoded');
    assertCheck(views[1].bmpFace.texture.image.src === assetData['faces/Shan_diamond.png'].dataUrl, 'real diamond PNG decoded');
    assertCheck(views[2].bmpFace.texture.image.src === assetData['faces/HanBingJian_spade.png'].dataUrl, 'real weapon PNG decoded');
    assertCheck(views[0].bmpFace.texture.width === 93 && views[0].bmpFace.texture.sourceWidth === 93 &&
      views[0].bmpFace.texture.height === 130 && views[0].bmpFace.texture.sourceHeight === 130,
      '2x PNG retains full UVs with consistent logical source and display sizes');
    assertCheck(views[0].bmpNumber.texture === views[2].bmpNumber.texture, 'shared red/black number texture');
    assertCheck(views[3].bmpFace.texture.image.src === originalPngs.Sha_png, 'unlisted face stays original');
    const contentKeys = ['bmpFace2', 'bmpNormalName', 'bmpNameBg', 'bmpName', 'bmpCardType', 'bmpSmallDesc'];
    assertCheck(views.slice(0, 3).every(ui => contentKeys.every(key => !ui[key].visible)), 'native illustration/title layers hidden above tarot');
    assertCheck(views[3].bmpFace2.visible && views[3].bmpNormalName.visible, 'unlisted card keeps native split layers');
    views[0].updateNewCardFace();
    assertCheck(contentKeys.every(key => !views[0][key].visible), 'native content-only refresh cannot restore overlay art');
    document.getElementById('originCardUseBtn').click(); await cardThemeFeature.sync();
    assertCheck(cardThemeFeature.getMode() === 'original' && views[0].bmpFace.texture.image.src === originalPngs.Shan_png,
      'actual original button restores original');
    assertCheck(views[0].bmpFace2.visible && views[0].bmpNormalName.visible && !views[0].bmpName.visible,
      'original theme restores native illustration and the correct title variant');
    document.getElementById('miaoCardUseBtn').click(); await cardThemeFeature.sync();
    assertCheck(cardThemeFeature.getMode() === 'miao' && config.miaoCardSwitch, 'actual miao button is exclusive');
    document.getElementById('tarotCardUseBtn').click(); await cardThemeFeature.sync();
    const bounds = [...dialog.querySelectorAll('[role=radio]')].map(node => node.getBoundingClientRect());
    assertCheck(bounds.every(rect => rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth), 'all three controls fit');
    assertCheck(document.getElementById('cardBackUseGoldBtn') != null, 'card back controls preserved');
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    document.getElementById('result').textContent = 'PASS ' + passed + ' real DOM / PNG checks';
  } catch (error) { document.getElementById('result').textContent = 'FAIL ' + error.stack; }
}
const html = '<!doctype html><meta charset="utf-8"><style>' + style +
  'html,body{margin:0;background:#171922;color:#f2de9c;font:14px Arial;overflow:auto}h1{font:22px Arial;text-align:center;margin:24px}' +
  '#cardThemeDialog{position:relative!important;left:auto!important;top:auto!important;transform:none!important;margin:16px auto;width:620px;max-height:none}' +
  '#cardThemeDialog .cardback-config>.cardback-title:nth-of-type(3),#cardThemeDialog .cardback-config>.cardback-preview-grid:nth-of-type(4){display:none}' +
  '#cards{display:flex;gap:18px;justify-content:center;margin:26px auto}.sample{width:186px}.front{position:relative;width:186px;height:260px}' +
  '.xc-test-face{position:absolute;inset:0}.xc-test-face img{width:100%;height:100%}.xc-test-rank,.xc-test-suit{position:absolute;width:38px;height:34px;left:8px;font:32px/34px Georgia;text-align:center}' +
  '.xc-test-rank{top:8px}.xc-test-suit{top:38px}.xc-test-rank img,.xc-test-suit img{width:100%;height:100%}.sample-label{text-align:center;margin-top:12px;font-size:12px}' +
  '.xc-test-native-art{position:absolute;left:0;top:100px;width:186px;height:160px;overflow:hidden}.xc-test-native-art img{position:absolute;left:0;top:-100px;width:186px;height:260px}' +
  '.xc-test-native-name{position:absolute;left:45px;top:0;width:141px;height:100px;overflow:hidden}.xc-test-native-name img{position:absolute;left:-45px;top:0;width:186px;height:260px}' +
  '.xc-test-native-bg,.xc-test-native-type,.xc-test-native-desc{position:absolute;bottom:4px;left:4px}' +
  '#result{text-align:center;font-size:13px;color:#b4c6a8}.note{text-align:center;color:#a9a4a0;font-size:13px}</style>' +
  '<h1>塔罗第一阶段 · 本地分层预览</h1><p class="note">设置面板与PNG加载实测；下方为模拟牌UI，非游戏截图。</p>' +
  '<input id="cardBackThemeSwitch" type="checkbox" hidden>' + markup.slice(dialogStart, dialogEnd) +
  '<div id="cards"></div><pre id="result">PENDING</pre><script>const decoded=' + JSON.stringify(mappings) +
  ';const nativeContentSource=' + JSON.stringify(nativeContentMethod) +
  ';const assetData=' + JSON.stringify(assets) + ';const originalPngs=' + JSON.stringify(originals) +
  ';const makeClient=' + clientFactory + ';const makeFeature=' + featureFactory + ';(' + fixture + ')();' + binder +
  'window.addEventListener("load",' + runChecks + ');</script>';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-tarot-preview-'));
const screenshot = path.join(profile, 'tarot-phase1.png');
fs.writeFileSync(path.join(profile, 'preview.html'), html);
const browserPath = [process.env.CARD_THEME_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => file && fs.existsSync(file));
assert(browserPath);
const server = http.createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(html);
});
server.listen(0, '127.0.0.1', () => {
  const browser = spawn(browserPath, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--window-size=1050,1000', '--dump-dom', '--virtual-time-budget=5000',
    '--screenshot=' + screenshot, '--user-data-dir=' + profile, 'http://127.0.0.1:' + server.address().port], { windowsHide: true });
  let output = '', diagnostics = '';
  browser.stdout.on('data', data => { output += data; }); browser.stderr.on('data', data => { diagnostics += data; });
  const timeout = setTimeout(() => browser.kill(), 30000);
  browser.on('error', error => { diagnostics += error.message; });
  browser.on('close', () => {
    clearTimeout(timeout); server.close();
    const result = output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    process.stdout.write((result || diagnostics || 'No browser output') + '\nPreview: ' + path.join(profile, 'preview.html') +
      '\nScreenshot: ' + screenshot + '\n');
    process.exitCode = result && result.startsWith('PASS ') ? 0 : 1;
  });
});
