// Real installed Electron 10 remote bridge + Chromium image decoding, isolated userData.
const fs = require('fs'), path = require('path'), assert = require('assert').strict;
const { spawn } = require('child_process');
const engineScripts = process.argv[2] || process.env.XC_WALLPAPER_ENGINE;
assert(engineScripts && fs.existsSync(path.join(engineScripts, 'laya.core.min.js')), 'Pass the extracted official Laya engine directory');
const native = require('./fixtures/wallpaper-native-20261110.json');
const engine = 'F:/Game/SGSOL';
const probe = fs.mkdtempSync(path.join(path.dirname(engine), 'xc-wallpaper-probe-'));
const appDir = path.join(probe, 'resources/app');
fs.mkdirSync(appDir, { recursive: true });
const customImage = process.argv[3];
if (customImage) fs.copyFileSync(customImage, path.join(appDir, 'fixture.jpg'));
for (const file of fs.readdirSync(engine, { withFileTypes: true })) {
  if (file.isFile() && (file.name === 'SGSOL.exe' || /\.(dll|pak|dat|bin)$/.test(file.name)))
    fs.linkSync(path.join(engine, file.name), path.join(probe, file.name));
}
fs.mkdirSync(path.join(probe, 'locales'));
fs.mkdirSync(path.join(probe, 'swiftshader'));
for (const file of ['libEGL.dll', 'libGLESv2.dll'])
  fs.linkSync(path.join(engine, 'swiftshader', file), path.join(probe, 'swiftshader', file));
fs.linkSync(path.join(engine, 'locales/en-US.pak'), path.join(probe, 'locales/en-US.pak'));
const source = fs.readFileSync(path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8');
const start = source.indexOf('  const localWallpaper = (() => {'), end = source.indexOf('  function _0x4a3f54(', start);
const renderer = `
Laya.init(3492,2043,Laya.WebGL);
window.electron = {remote: require('electron').remote};
const table = ${JSON.stringify(require('../../doc/彩虹表.js').tables._0x3812.all)};
const _0x47c207 = key => table[key], _0x11ab4e = {userID:123};
const dispatcher=new Laya.EventDispatcher();
const ue={I:()=>dispatcher,GAME_ADAPTATION:'game-adaptation'};
const cAt={gameWidth:1333.3333333333335,gameHeight:766.6666666666667,gameScale:2.618556701030928,GamePaddingLeft:0,GamePaddingTop:11};
window.SystemContext=cAt;
const ti={backgroundLayer:1},hi={Lv1:10};
class gO extends Laya.Sprite{};class kD extends Laya.Sprite{};class TO extends Laya.Sprite{};
${native.nativeBackgroundLayer}
const layer = new _qt();
const globalConfig = {allPaperSwitch:true}, laya = {gamescene:true,scene:{SceneName:'TableScene'},find:()=>layer};
const probeLogs=[];
const _0x5ad56d = () => false, appendLocalSkinDebugLine = line => probeLogs.push(line);
const wait = async fn => fn();
const _0x40868d = (key,value) => localStorage.setItem(key, JSON.stringify(value));
const _0x32d055 = key => JSON.parse(localStorage.getItem(key) || '{}');
const aO = null;
class fO {constructor(t){this.texture=t}clear(){}event(){}}
const mNt = class { ${native.getResByUrl} };
mNt.resConfig = {resourceRoot:'res/',keyMap:{},${native.getResourceUrl}};
mNt.resourceRoot='res/';
mNt.resLoader={loadItem(url,type,group,callback,owner){callback.call(owner,null,url)}};
mNt.CancelGetResByUrl=mNt.ClearRuntimeImageRes=mNt.AddRuntimeImageRes=()=>{};
${native.flatImage}
${source.slice(start, end)}
window.runProbe = async () => {
  const bg = new p$t(); bg.pos = () => {};
  paper.sprite = {_parent:{},bg,numChildren:0,OnStageResize(){},removeSelf(){}};
  localWallpaper.mount(document.getElementById('wallpaperDialog'));
  const row = document.getElementById('xcLocalWallpaperRow');
  const [button,input,status] = row.children;
  const bytes = ${customImage ? "require('fs').readFileSync(require('path').join(window.electron.remote.app.getAppPath(),'fixture.jpg'))" : "Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')"};
  const transfer = new DataTransfer();
  transfer.items.add(new File([bytes], ${JSON.stringify(customImage ? '测试图片.jpg' : '测试图片.png')}, {type:${JSON.stringify(customImage ? 'image/jpeg' : 'image/png')}}));
  input.files = transfer.files;
  await input.onchange();
  const settingStatus=status.textContent;
  const url = paper.res.url;
  if (!url) throw Error(status.textContent);
  const decoded = await localWallpaper.resolve(url);
  const image = new Image();
  await new Promise((resolve,reject) => {image.onload=resolve;image.onerror=reject;image.src=decoded});
  const cache = require('path').join(window.electron.remote.app.getAppPath(),'local-wallpapers',url.split(':')[1]);
  if (!decoded.startsWith('myprotocol:/local-wallpapers/')) throw Error('Native protocol was not used');
  let root=layer.getChildByName('xcLocalWallpaper');
  const texture=Laya.loader.getRes(decoded);
  if (!root || !texture || texture.destroyed || root.texture || root.filters) throw Error('Background must use unfiltered drawing commands');
  const lateBg=new Laya.Sprite();lateBg.graphics.drawRect(0,0,1280,720,'#0000ff');layer.addChild(lateBg);
  layer.updateZOrder();
  const pixels=()=>Array.from(layer.drawToCanvas(32,32,0,0).getContext('2d').getImageData(16,16,1,1).data);
  const pixel=pixels();
  await paper.switch(false);
  const hidden=pixels();
  await paper.switch(true);
  layer.updateZOrder();
  const restored=pixels();
  root=layer.getChildByName('xcLocalWallpaper');
  row.children[3].onclick();
  return {status:settingStatus,width:image.naturalWidth,alpha:pixel[3],pixel,hidden,restored,attached:root.parent===layer,
    textureWidth:texture.width,resourceUrl:decoded,pixelProbe:probeLogs.filter(line=>line.includes('背景与舞台像素')),
    bytesMatch:require('fs').readFileSync(cache).equals(bytes),key:_0x32d055('123::paperRes').url};
};`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), renderer);
fs.copyFileSync(path.join(engineScripts, 'laya.core.min.js'), path.join(appDir, 'laya.core.min.js'));
fs.writeFileSync(path.join(appDir, 'index.html'), '<!doctype html><meta charset="utf-8"><dialog id="wallpaperDialog" open></dialog><script>window.__errors=[];window.onerror=(m,u,l,c,e)=>__errors.push(String(e&&e.stack||m));</script><script src="laya.core.min.js"></script><script src="renderer.js"></script>');
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({name:'xc-wallpaper-probe',version:'1.0.0',main:'main.js'}));
fs.writeFileSync(path.join(appDir, 'main.js'), `
const {app,BrowserWindow,protocol}=require('electron'),fs=require('fs'),path=require('path');
app.setPath('userData',path.join(__dirname,'isolated-profile'));
app.commandLine.appendSwitch('use-gl','swiftshader');
app.whenReady().then(async()=>{
  // Match the installed host's existing myprotocol handler and app-root mapping.
  protocol.registerFileProtocol('myprotocol',(request,callback)=>callback({path:path.join(__dirname,request.url.substr(12)),headers:{'Access-Control-Allow-Origin':'*'}}));
  protocol.interceptBufferProtocol('https',(request,callback)=>{
    const name=path.basename(new URL(request.url).pathname);
    if (!['index.html','renderer.js','laya.core.min.js'].includes(name)) return callback({error:-6});
    callback({data:fs.readFileSync(path.join(__dirname,name)),mimeType:name.endsWith('.html')?'text/html':'application/javascript'});
  });
  const win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:true,contextIsolation:false,enableRemoteModule:true}});
  try {await win.loadURL('https://web.sanguosha.com/220/h5_2/xc-wallpaper-test/index.html');
    const result=await win.webContents.executeJavaScript('(async()=>{try{return await runProbe()}catch(e){return {error:String(e.stack||e),errors:window.__errors}}})()');
    fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify({electron:process.versions.electron,...result}));
  } catch(error){fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify({error:String(error.stack||error)}));}
  app.quit();
});`);
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(path.join(probe, 'SGSOL.exe'), [], { env, windowsHide:true, stdio:'ignore' });
const timer = setTimeout(() => child.kill(), 45000);
child.on('exit', () => {
  clearTimeout(timer);
  const result = JSON.parse(fs.readFileSync(path.join(appDir, 'result.json'), 'utf8'));
  process.stdout.write(JSON.stringify({probe,...result}) + '\n');
  assert(!result.error, result.error);
  assert.match(result.status, /设置成功/);
  assert(result.width > 0);
  assert.equal(result.bytesMatch, true);
  assert.equal(result.textureWidth, result.width);
  assert(result.alpha > 0, 'Laya must actually draw an opaque pixel');
  assert.deepEqual(result.hidden,[0,0,255,255],'hide restores native background');
  assert.deepEqual(result.restored,result.pixel,'show restores wallpaper pixels after scene reattachment');
  assert.notDeepEqual(result.pixel,result.hidden,'wallpaper must cover later native background');
  assert(result.attached);
  assert.equal(result.pixelProbe.length,1,'diagnostic must read actual background and stage pixels');
});
