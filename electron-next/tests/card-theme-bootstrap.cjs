// Run with Node; --native additionally exercises real remote.require + IPC in an isolated Electron 10 copy.
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { spawnSync } = require('child_process');
const createClient = require('../src/adapters/card-theme-client');
const project = path.resolve(__dirname, '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-card-bootstrap-'));
const userData = path.join(root, 'userdata');
const backendSource = fs.readFileSync(path.join(project, 'src/electron/card-theme-assets.js'), 'utf8');
const manifest = require('../resources/card-themes/tarot/manifest.json');
const images = [].concat(...Object.values(manifest.faces).map(Object.values), Object.values(manifest.ranks), Object.values(manifest.suits)).filter(Boolean);
let passed = 0;
function copy(relative, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(project, relative), target);
}
for (const relative of ['manifest.json'].concat(images))
  copy('resources/card-themes/tarot/' + relative, path.join(userData, 'card-themes/tarot', relative));
for (const name of ['card-theme-assets.js', 'release-install.js'])
  copy('src/electron/' + name, path.join(userData, 'modules/runtime', name));
async function check(name, run) { await run(); passed++; process.stdout.write('PASS ' + name + '\n'); }
function host({ alreadyRegistered = false, withRemote = true, bootFails = false, requestError = null, modern = false } = {}) {
  const handlers = new Map(), logs = [];
  let registrations = 0, remoteLoads = 0, bootstrapCalls = 0, idleCalls = 0;
  const electron = { app: { getPath: name => { assert.equal(name, 'userData'); return userData; } },
    ipcMain: { handle(name, handler) { assert(!handlers.has(name)); registrations++; handlers.set(name, handler); } } };
  const context = vm.createContext({ module: { exports: {} }, Buffer,
    require(name) {
      if (name === 'electron') return electron;
      if (name === path.join(userData, 'modules/runtime/release-install.js'))
        return { getInstallCoordinator(options) { assert.equal(options.targetDirectory, userData); return { whenIdle: async () => { idleCalls++; } }; } };
      return require(name);
    },
  });
  vm.runInContext(backendSource, context);
  const runtime = context.module.exports;
  if (alreadyRegistered) runtime.registerCardThemeAssets({ ipcMain: electron.ipcMain, roots: [path.join(userData, 'card-themes/tarot')] });
  const bridge = { ipcRenderer: { async invoke(name, relative) {
    if (requestError) throw Error(requestError);
    if (!handlers.has(name)) throw Error("Error invoking remote method '" + name + "': Error: No handler registered for '" + name + "'");
    return handlers.get(name)({}, relative);
  } } };
  if (withRemote) bridge.remote = { app: electron.app, require(name) {
    if (name === 'path') return path;
    assert.equal(name, path.join(userData, 'modules/runtime/card-theme-assets.js')); remoteLoads++;
    return { bootstrapCardThemeAssets() { bootstrapCalls++; return bootFails ? { ok: false } : runtime.bootstrapCardThemeAssets(); } };
  } };
  const window = { electron: bridge };
  if (modern) window.daxiaochaoElectron = { readCardThemeAsset: relative => bridge.ipcRenderer.invoke('read-card-theme-asset', relative) };
  const client = createClient({ window, getLaya: () => null, getEngine: () => null, getRegisteredUis: () => [], log: line => logs.push(line) });
  return { client, runtime, logs, counts: () => ({ registrations, remoteLoads, bootstrapCalls, idleCalls }) };
}

async function nativeProbe() {
  const executable = process.env.XC_CARD_THEME_ELECTRON || 'F:/Game/SGSOL/SGSOL.exe';
  assert(fs.existsSync(executable), 'Set XC_CARD_THEME_ELECTRON to the legacy Electron executable');
  const runtimeDir = path.join(root, 'electron'), appDir = path.join(runtimeDir, 'resources/app');
  fs.mkdirSync(appDir, { recursive: true }); fs.mkdirSync(path.join(runtimeDir, 'locales'), { recursive: true });
  const binaries = ['chrome_100_percent.pak', 'chrome_200_percent.pak', 'd3dcompiler_47.dll', 'ffmpeg.dll',
    'icudtl.dat', 'libEGL.dll', 'libGLESv2.dll', 'resources.pak', 'snapshot_blob.bin', 'v8_context_snapshot.bin',
    'vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'vulkan-1.dll'];
  fs.copyFileSync(executable, path.join(runtimeDir, 'electron.exe'));
  for (const name of binaries) {
    const source = path.join(path.dirname(executable), name);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(runtimeDir, name));
  }
  fs.copyFileSync(path.join(path.dirname(executable), 'locales/en-US.pak'), path.join(runtimeDir, 'locales/en-US.pak'));
  const report = path.join(root, 'native-result.json');
  fs.writeFileSync(path.join(appDir, 'package.json'), '{"name":"xc-card-bootstrap-test","version":"1.0.0","main":"main.js"}');
  fs.writeFileSync(path.join(appDir, 'preload.js'), "window.electron = require('electron');\n");
  const renderer = `
    const client=(${createClient.toString()})({window,getLaya:()=>null,getEngine:()=>null,getRegisteredUis:()=>[],log:()=>{}});
    (async()=>{
      const first=await Promise.all([client.readAsset('manifest.json'),client.readAsset('manifest.json')]);
      if(first.some(x=>!x.ok))throw Error('manifest bootstrap failed');
      const data=first[0].manifest;
      const paths=[].concat(...Object.values(data.faces).map(Object.values),Object.values(data.ranks),Object.values(data.suits)).filter(Boolean);
      for(const name of paths){const r=await client.readAsset(name);if(!r.ok||!r.dataUrl.startsWith('data:image/png;base64,'))throw Error('asset failed: '+name);}
      if((await client.readAsset('../config.json')).code!=='invalid-asset')throw Error('invalid path accepted');
      window.electron.ipcRenderer.send('bootstrap-test-result',{ok:true,assets:paths.length+1});
    })().catch(e=>window.electron.ipcRenderer.send('bootstrap-test-result',{ok:false,error:e.message}));`;
  fs.writeFileSync(path.join(appDir, 'index.html'), '<!doctype html><meta charset="utf-8"><script>' + renderer + '</script>');
  fs.writeFileSync(path.join(appDir, 'main.js'), `
    const {app,BrowserWindow,ipcMain}=require('electron'),fs=require('fs'),path=require('path');
    app.setPath('userData',${JSON.stringify(userData)});app.disableHardwareAcceleration();
    let registrations=0;const handle=ipcMain.handle.bind(ipcMain);
    ipcMain.handle=(name,...args)=>{if(name==='read-card-theme-asset')registrations++;return handle(name,...args)};
    function finish(result){fs.writeFileSync(${JSON.stringify(report)},JSON.stringify({...result,registrations,electron:process.versions.electron,node:process.versions.node}));app.exit(result.ok&&registrations===1?0:1)}
    ipcMain.on('bootstrap-test-result',(_event,result)=>finish(result));
    const timeout=setTimeout(()=>finish({ok:false,error:'timeout'}),20000);
    app.whenReady().then(()=>{
      const window=new BrowserWindow({show:false,webPreferences:{nodeIntegration:true,contextIsolation:false,enableRemoteModule:true,sandbox:false,preload:path.join(__dirname,'preload.js')}});
      window.loadFile(path.join(__dirname,'index.html')).catch(e=>finish({ok:false,error:e.message}));
    });`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(path.join(runtimeDir, 'electron.exe'), [], { env, cwd: runtimeDir, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const data = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) : null;
  assert.equal(result.status, 0, JSON.stringify(data) || result.stderr || result.error && result.error.message);
  assert(data && data.ok && data.assets === images.length + 1 && data.registrations === 1);
  process.stdout.write('PASS real legacy remote.require + IPC without pre-registration: ' + JSON.stringify(data) + '\n');
  process.stdout.write('Native test artifacts: ' + root + '\n');
}

(async () => {
  await check('legacy missing handler bootstraps once for concurrent requests and reads all assets', async () => {
    const h = host(); const results = await Promise.all([h.client.readAsset('manifest.json'), h.client.readAsset('manifest.json')]);
    assert(results.every(x => x.ok));
    for (const image of images) assert((await h.client.readAsset(image)).ok);
    assert.deepEqual(h.counts(), { registrations: 1, remoteLoads: 1, bootstrapCalls: 1, idleCalls: images.length + 2 });
  });
  await check('modern and already registered legacy hosts do not access remote', async () => {
    for (const modern of [true, false]) {
      const h = host({ alreadyRegistered: true, modern }); assert((await h.client.readAsset('manifest.json')).ok);
      assert.equal(h.counts().remoteLoads, 0); assert.equal(h.counts().bootstrapCalls, 0);
    }
  });
  await check('missing PNG and invalid paths remain normal responses, not registration triggers', async () => {
    const h = host({ alreadyRegistered: true });
    assert.equal((await h.client.readAsset('ranks/unavailable.png')).code, 'missing');
    assert.equal((await h.client.readAsset('../config.json')).code, 'invalid-asset'); assert.equal(h.counts().remoteLoads, 0);
  });
  await check('installation and unrelated IPC errors retain their failure semantics', async () => {
    const h = host({ requestError: 'install-busy' });
    await assert.rejects(h.client.readAsset('manifest.json'), /install-busy/); assert.equal(h.counts().remoteLoads, 0);
  });
  await check('unavailable legacy bridge returns native fallback without a retry loop', async () => {
    const h = host({ withRemote: false });
    for (let i = 0; i < 3; i++) assert.equal((await h.client.readAsset('manifest.json')).code, 'host-unavailable');
    assert.equal(h.counts().registrations, 0);
  });
  await check('failed initialization has one bounded attempt per adapter instance', async () => {
    const h = host({ bootFails: true });
    for (let i = 0; i < 3; i++) assert.equal((await h.client.readAsset('manifest.json')).code, 'host-unavailable');
    assert.equal(h.counts().bootstrapCalls, 1);
  });
  await check('main-process bootstrap remains idempotent when called independently', () => {
    const h = host(); assert(h.runtime.bootstrapCardThemeAssets().ok); assert(h.runtime.bootstrapCardThemeAssets().ok);
    assert.equal(h.counts().registrations, 1);
  });
  process.stdout.write('PASS ' + passed + ' bootstrap checks\n');
  if (process.argv.includes('--native')) await nativeProbe();
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
