// Exercise the shipped import/render chain against a temporary filesystem and UI stubs.
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const assert = require('assert').strict;
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8');
const native = require('./fixtures/wallpaper-native-20261110.json');
const inferredClass = vm.runInNewContext(`class uO{};class E$t{};
  const kCt={ResType_Spine:3,ResType_Spine_AllBig:4};
  const seat={${native.getEffectType}};seat.getEffectType(4).constructor.name;`);
assert.equal(inferredClass,'uO','the old SgsFlatImage inference actually constructs a Spine animation');
const d = key => require('../../doc/彩虹表.js').tables._0x3812.all[key];
const start = source.indexOf('  const localWallpaper = (() => {');
const end = source.indexOf('  function _0x4a3f54(', start);
assert(start > 0 && end > start);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-wallpaper-'));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const data = 'data:image/png;base64,' + png.toString('base64');
const saved = new Map();
function harness() {
  const textures = new Map();
  const layer = { width:1280,height:720,children:[], addChild(node) {
    node.removeSelf(); this.children.push(node); node.parent = this;
  } };
  class Sprite {
    constructor(){this.scaleX=this.scaleY=1;this.visible=true;this.graphics={
      clear(){this.texture=null;this.cmds=[]},drawTexture(texture){this.texture=texture;this.cmds=[texture];return texture},drawRect(){},cmds:[]}}
    removeSelf(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;return this}
    destroy(){this.removeSelf();this.destroyed=true}
    size(w,h){this.width=w;this.height=h}
    pivot(x,y){this.pivotX=x;this.pivotY=y}
    pos(x,y){this.x=x;this.y=y}
    scale(x,y){this.scaleX=x;this.scaleY=y}
  }
  const listeners = new Set();
  const engine = { Sprite,stage:{width:1280,height:720,on(e,owner,fn){listeners.add(fn)},off(e,owner,fn){listeners.delete(fn)}},
    Loader: { IMAGE: 'image' }, Event: { COMPLETE:'complete', ERROR:'error',RESIZE:'resize' },
    Handler: { create: (_, callback) => callback },
    loader: { load(url, callback) { queueMicrotask(() => {
      textures.set(url, { url, width:1, height:1, destroyed:false }); callback();
    }); }, getRes: key => textures.get(key), clearRes(key) {
      const texture = textures.get(key); if (texture) texture.destroyed = true; textures.delete(key);
    } } };
  const nodes = new Map();
  function element() {
    return { style: {}, children: [], isConnected: true, append(...items) { this.children.push(...items); },
      appendChild(item) { this.children.push(item); if (item.id) nodes.set(item.id, item); },
      querySelector(selector) { return nodes.get(selector.slice(1)) || null; }, click() {} };
  }
  const logs = [], account = { userID: 123 }, config = { skinPaperSwitch: false, allPaperSwitch: true };
  const ctx = vm.createContext({ window: { electron: { remote: { app: { getPath: () => root,
    getAppPath:()=>path.join(root,'app') }, require } } },
    document: { createElement: element, querySelectorAll: () => [] },
    _0x47c207: d, _0x11ab4e: account, globalConfig: config,
    _0x5ad56d: () => false, appendLocalSkinDebugLine: line => logs.push(line),
    _0x40868d: (key, value) => saved.set(key, JSON.parse(JSON.stringify(value))),
    _0x32d055: key => saved.get(key) || {}, _0x5a31d6: key => saved.delete(key),
    wait: async fn => fn(), laya: { gamescene: true, scene:{SceneName:'TableScene'},find:()=>layer,
      get(){throw Error('local wallpaper must not infer SgsFlatImage via getEffectType')} }, Laya: engine,
    setTimeout, clearTimeout, console,
    Image: class { set src(value) { this.naturalWidth = 1; this.naturalHeight = 1;
      queueMicrotask(() => value.startsWith('data:image/') || (value.startsWith('myprotocol:/local-wallpapers/') &&
        fs.existsSync(path.join(root,'app/local-wallpapers',value.split('/').pop()))) ? this.onload() : this.onerror()); } },
    FileReader: class { readAsDataURL(file) { this.result = file.data; queueMicrotask(() => this.onload()); } }
  });
  vm.runInContext(`const aO = null;
    class fO {constructor(t){this.texture=t}clear(){} event(){}}
    const mNt = class { ${native.getResByUrl} };
    mNt.resConfig = {resourceRoot:'res/',keyMap:{},${native.getResourceUrl}};
    mNt.resourceRoot='res/';
    mNt.resLoader={loadItem(url,type,group,callback,owner){callback.call(owner,null,url)}};
    mNt.CancelGetResByUrl=mNt.ClearRuntimeImageRes=mNt.AddRuntimeImageRes=()=>{};
    ${native.flatImage}
    globalThis.makeNativeImage=()=>new p$t();`, ctx);
  vm.runInContext(source.slice(start, end) + '\nglobalThis.api={localWallpaper,paper};', ctx);
  const { paper, localWallpaper } = ctx.api;
  function sprite() {
    const bg = ctx.makeNativeImage(); bg.pos = () => {};
    paper.sprite = { _parent: {}, bg, numChildren: 0, OnStageResize() {}, removeSelf() {} };
  }
  sprite();
  const dialog = element();
  localWallpaper.mount(dialog);
  const row = nodes.get('xcLocalWallpaperRow'), [button, input, status] = row.children;
  async function select(file = { size: png.length, type: 'image/png', data }) {
    input.files = [file]; await input.onchange(); return status.textContent;
  }
  return { ctx, paper, localWallpaper, dialog, row, input, status, account, config, logs, select, sprite,
    layer,listeners,root:()=>layer.children.find(n=>n.name==='xcLocalWallpaper') };
}
(async () => {
  const h = harness();
  h.localWallpaper.mount(h.dialog);
  assert.equal(h.dialog.children.length, 1, 'mount is idempotent');
  assert.match(await h.select(), /设置成功/);
  const descriptor = JSON.parse(JSON.stringify(h.paper.res));
  assert.match(descriptor.url, /^xc-local-wallpaper:[a-f0-9]{64}\.png$/);
  const cacheFile = path.join(root, 'app/local-wallpapers', descriptor.url.split(':')[1]);
  const nativeUrl='myprotocol:/local-wallpapers/'+descriptor.url.split(':')[1];
  assert.deepEqual(fs.readFileSync(cacheFile), png, 'cached bytes match original');
  assert(h.root() && h.root().graphics.texture, 'wallpaper must have an attached drawing command');
  assert.equal(h.root().texture,null,'avoid the sprite texture shortcut');
  assert.equal(h.root().filters,null,'avoid a filter render target');
  assert.equal(h.root().graphics.texture.url, nativeUrl);
  assert.equal(h.root().zOrder,0.5,'above backgrounds, below native masks');
  assert.equal(h.root().scaleX,1280,'cover sizing uses the real layer dimensions');
  assert.equal(saved.get('123::paperRes').url, descriptor.url, 'preference stores only stable cache key');
  assert.equal(h.config.skinPaperSwitch, true);
  const previous=path.join(root,'User/wallpapers',descriptor.url.split(':')[1]);
  fs.mkdirSync(path.dirname(previous),{recursive:true});
  fs.renameSync(cacheFile,previous);
  const fresh = harness();
  fresh.paper.res = { ...descriptor };
  await fresh.paper.switch(true);
  assert.equal(fresh.root().graphics.texture.url, nativeUrl, 'new runtime migrates and restores from native resource cache');
  assert.deepEqual(fs.readFileSync(cacheFile),png);
  assert(fs.existsSync(previous),'migration keeps the original User copy');
  const restored = fresh.root().graphics.texture;
  await fresh.paper.switch(false);
  assert(!fresh.root(),'disabled wallpaper detaches the render node');
  assert.equal(fresh.listeners.size,0,'hide removes resize listener');
  await fresh.paper.switch(true);
  assert.equal(fresh.root().graphics.texture, restored, 'hide/show retains live texture');
  assert.equal(fresh.listeners.size,1,'show installs one resize listener');
  fresh.layer.width=1920;
  for(const fn of fresh.listeners)fn();
  assert.equal(fresh.root().scaleX,1920,'viewport resize updates cover scale');
  await fresh.paper.clear(false);
  assert(restored.destroyed, 'explicit clear releases local texture');
  assert.match(await h.select(), /设置成功/, 'reimport same image works');
  const before = h.paper.res.url;
  assert.match(await h.select({ size: 31 * 1024 * 1024, type: 'image/png', data }), /30MB/);
  assert.equal(h.paper.res.url, before, 'invalid selection preserves wallpaper');
  assert.match(await h.select({ size: 20, type: 'text/plain', data }), /请选择图片/);
  await assert.rejects(h.localWallpaper.resolve('xc-local-wallpaper:../bad.png'), /名称无效/);
  fs.writeFileSync(cacheFile, 'corrupt');
  const broken = harness();
  assert.equal(await broken.paper.setBg(descriptor), false, 'corrupt cache fails without replacing image');
  assert(!broken.paper.sprite.bg.texture);
  assert(broken.logs.some(line => /缓存校验失败/.test(line)));
  fs.unlinkSync(cacheFile);
  fs.unlinkSync(previous);
  assert.equal(await broken.paper.setBg(descriptor), false, 'missing cache is reported');
  const stale = harness();
  stale.input.files = [{ size: png.length, type: 'image/png', data }];
  const pending = stale.input.onchange();
  stale.account.userID = 456;
  await pending;
  assert.match(stale.status.textContent, /账号已切换/);
  assert.equal(stale.paper.res.url, undefined);
  const oldTexture = h.root().graphics.texture;
  await h.paper.setBg({ url: 'https://example.invalid/skin.png', type: 0, width: 100, height: 100 });
  assert(oldTexture.destroyed, 'switch to native skin releases local texture');
  assert.equal(h.paper.sprite.bg.skin, 'https://example.invalid/skin.png', 'existing skin wallpaper still uses native URL');
  process.stdout.write('Local wallpaper import/cache/restore/validation/lifecycle regressions passed.\n');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(root, { recursive: true, force: true }));
