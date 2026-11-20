// Isolated installed Electron + actual official Laya engine and downloaded SK/PNG assets.
// Usage: node tests/ten-year-dynamic-electron.cjs <engine-directory> <asset-directory> [skin-id]
const fs=require('fs'),path=require('path'),assert=require('assert').strict,{spawn}=require('child_process');
const engine=process.argv[2],assets=path.resolve(process.argv[3]||'');
assert(engine&&fs.existsSync(path.join(engine,'laya.ani.min.js')),'Pass extracted official core/ani engine scripts');
const skinID=Number(process.argv[4]||744001);
const create=require('../src/features/ten-year-dynamic'),spec=require('../src/features/ten-year-dynamic-catalog')().find(r=>r[9].id===skinID)?.[9];
assert(spec,'Skin must be in the dynamic catalog');
assert(spec.layers.every(layer=>fs.existsSync(path.join(assets,spec.resource,layer.file))),'Pass downloaded real SK/PNG asset directory');
const host='F:/Game/SGSOL',probe=fs.mkdtempSync('F:/Game/xc-ten-year-dynamic-'),appDir=path.join(probe,'resources/app');
fs.mkdirSync(appDir,{recursive:true});
for(const entry of fs.readdirSync(host,{withFileTypes:true}))if(entry.isFile()&&(entry.name==='SGSOL.exe'||/\.(dll|pak|dat|bin)$/.test(entry.name)))
 fs.linkSync(path.join(host,entry.name),path.join(probe,entry.name));
for(const sub of ['locales','swiftshader']){
 fs.mkdirSync(path.join(probe,sub));
 for(const name of fs.readdirSync(path.join(host,sub)))fs.linkSync(path.join(host,sub,name),path.join(probe,sub,name));
}
for(const file of ['laya.core.min.js','laya.ani.min.js'])fs.copyFileSync(path.join(engine,file),path.join(appDir,file));
fs.writeFileSync(path.join(appDir,'package.json'),JSON.stringify({name:'xc-ten-year-dynamic-test',version:'1.0.0',main:'main.js'}));
fs.writeFileSync(path.join(appDir,'index.html'),'<meta charset="utf-8"><body><script>window.errors=[];window.onerror=(m,u,l,c,e)=>errors.push(String(e&&e.stack||m));</script><script src="laya.core.min.js"></script><script src="laya.ani.min.js"></script><script src="renderer.js"></script>');
fs.writeFileSync(path.join(appDir,'renderer.js'),`
Laya.init(600,450,Laya.WebGL);Laya.stage.bgColor='#253045';
const create=${create.toString()},spec=${JSON.stringify(spec)},logs=[];
const player=create({window,log:s=>logs.push(s)}),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const avatar=new Laya.Sprite();avatar.size(146,172);avatar.pos(200,100);avatar.scale(2,2);avatar.scrollRect=new Laya.Rectangle(0,0,146,172);avatar.seat={};
avatar.graphics.drawRect(0,0,146,172,'#884422');Laya.stage.addChild(avatar);
let blocked=true;window.__xcIsSkinEffectsBlocked=()=>blocked;
const capture=name=>{const bytes=Buffer.from(Laya.stage.drawToCanvas(600,450,0,0).toBase64('image/png').split(',')[1],'base64');
 require('fs').writeFileSync(require('path').join(${JSON.stringify(appDir)},name+'.png'),bytes);return require('crypto').createHash('sha256').update(bytes).digest('hex');};
window.run=async()=>{
 const before=capture('before');player.attach(()=>player.show(avatar,spec,()=>true));
 await player.prepare(spec);player.show(avatar,spec,()=>true);await sleep(350);
 const mounted=player.status(),first=capture('frame1');await sleep(650);const second=capture('frame2');
 const layer=avatar.getChildByName('xcTenYearDynamic');
 const transform=layer&&{scale:layer.scaleX,x:layer.x,y:layer.y,layers:layer.numChildren};
 window.dispatchEvent(new Event('xc-skin-effects-change'));await sleep(100);const withBlock=capture('attack-blocked');
 const sameLayerWhileBlocked=avatar.getChildByName('xcTenYearDynamic')===layer;
 player.visible(avatar,false);await sleep(100);const hidden=capture('native-hidden');
 player.visible(avatar,true);await sleep(250);const restored=capture('restored');
 blocked=false;window.dispatchEvent(new Event('xc-skin-effects-change'));await sleep(100);
 const sameLayerAfterUnblock=avatar.getChildByName('xcTenYearDynamic')===layer;
 player.detach();await sleep(100);const disposed=capture('disposed');
 return {before,first,second,withBlock,hidden,restored,disposed,sameLayerWhileBlocked,sameLayerAfterUnblock,mounted,after:player.status(),transform,logs,errors:window.errors};
};`);
fs.writeFileSync(path.join(appDir,'main.js'),`
const {app,BrowserWindow,protocol}=require('electron'),fs=require('fs'),path=require('path');
app.setPath('userData',path.join(__dirname,'isolated-profile'));app.commandLine.appendSwitch('use-gl','swiftshader');
app.whenReady().then(async()=>{
 const requests=[];
 protocol.interceptBufferProtocol('https',(request,callback)=>{
  const url=new URL(request.url);requests.push(url.pathname);
  const prefix='/10/pc/res/assets/runtime/general/big/dynamic/';let file;
  if(url.pathname.startsWith(prefix))file=path.join(${JSON.stringify(assets)},url.pathname.slice(prefix.length));
  else if(url.pathname.startsWith('/220/h5_2/xc-dynamic-probe/'))file=path.join(__dirname,path.basename(url.pathname));
  if(!file||!fs.existsSync(file))return callback({error:-6});
  callback({data:fs.readFileSync(file),mimeType:file.endsWith('.png')?'image/png':file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'application/octet-stream'});
 });
 const win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:true,contextIsolation:false,enableRemoteModule:true}});
 try{await win.loadURL('https://web.sanguosha.com/220/h5_2/xc-dynamic-probe/index.html');
 const result=await win.webContents.executeJavaScript('(async()=>{try{return await run()}catch(e){return {error:String(e.stack||e),errors:window.errors}}})()');
 fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify({electron:process.versions.electron,requests,...result},null,2));
 }catch(e){fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify({error:String(e.stack||e)}))}app.quit();
});`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(path.join(probe,'SGSOL.exe'),[],{env,windowsHide:true,stdio:'ignore'}),timer=setTimeout(()=>child.kill(),45000);
child.on('exit',()=>{
 clearTimeout(timer);const r=JSON.parse(fs.readFileSync(path.join(appDir,'result.json'),'utf8'));
 process.stdout.write(JSON.stringify({probe,...r})+'\n');
 assert(!r.error,r.error);assert.deepEqual(r.errors,[]);
 assert.equal(r.mounted.players,1);assert.equal(r.transform.layers,spec.layers.length);
 assert.notEqual(r.before,r.first);assert.notEqual(r.first,r.second,'real rendered animation pixels must change');
 assert.notEqual(r.withBlock,r.before,'saved attack-effects blocking must preserve actual idle pixels');
 assert(r.sameLayerWhileBlocked&&r.sameLayerAfterUnblock,'effects toggles must not rebuild the idle layer');
 assert.equal(r.hidden,r.before,'native visibility still restores exactly the static fallback pixels');
 assert.notEqual(r.restored,r.before);assert.equal(r.disposed,r.before);
 assert.equal(r.after.players,0);assert.equal(r.after.templates,0);
 assert(spec.layers.every(layer=>r.requests.some(s=>s.endsWith('/'+spec.resource+'/'+layer.file.replace(/\.sk$/,'.png')))));
});
