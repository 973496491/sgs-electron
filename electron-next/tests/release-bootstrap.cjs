// --native verifies the actual legacy webview/remote bridge with no credentials or patched host.
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')
const assert = require('assert').strict
const EventEmitter = require('events')
const { spawnSync } = require('child_process')
const { createReleaseBootstrap } = require('../src/electron/release-bootstrap')
const update = require('../src/electron/release-update')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-release-bootstrap-'))
const project = path.resolve(__dirname, '..')
const script = fs.readFileSync(path.join(project, 'resources/daxiaochao.user.js'), 'utf8')
const start = script.indexOf('  // Hand off once to the installed main-process module;')
const finish = script.indexOf('  const n$1 = c;', start)
assert(start > 0 && finish > start)
const entry = script.slice(start, finish)
let passed = 0, serial = 0
const tick = () => new Promise(resolve => setImmediate(resolve))
async function check(name, fn) { await fn(); passed++; process.stdout.write('PASS ' + name + '\n') }
function fixture(useRealChecker = false) {
  const directory = path.join(root, 'user-' + (++serial))
  fs.mkdirSync(directory)
  fs.writeFileSync(path.join(directory, 'version.json'), '{"version":"1.0.0"}')
  fs.writeFileSync(path.join(directory, '三国杀打小抄.js'), '// @version 1.0.0\n')
  const app = new EventEmitter(), window = { id: 7, isDestroyed: () => false }
  let checks = 0, quits = 0, reads = 0, fetches = 0, installing = false, wait = async () => {}
  app.getPath = name => name === 'userData' ? directory : root
  app.quit = () => { quits++ }
  app.relaunch = () => { throw Error('Unexpected restart') }
  const ipcMain = { _invokeHandlers: new Map(),
    handle(name, handler) { assert(!this._invokeHandlers.has(name)); this._invokeHandlers.set(name, handler) },
    removeHandler(name) { this._invokeHandlers.delete(name) }
  }
  const original = function (event, value) { reads++; return { success: true, data: value, receiver: this } }
  ipcMain.handle('read-local-script', original)
  const dialogs = []
  const installer = { whenIdle: () => wait(), isInstalling: () => installing }
  const electron = { app, BrowserWindow: { fromId: id => id === 7 ? window : null }, ipcMain,
    dialog: { showMessageBox: async (_, options) => { dialogs.push(options); return { response: 1 } } }, shell: {} }
  const buildChecker = options => update.createUpdateChecker(Object.assign({}, options, {
    fetchManifest: async () => { fetches++; return { version: '1.0.1', packageKey: 'releases/test.zip' } }
  }))
  const runtime = createReleaseBootstrap(electron, {
    getInstallCoordinator: options => { assert.equal(options.targetDirectory, directory); return installer },
    createUpdateChecker: options => {
      assert.equal(options.scriptFile, path.join(directory, '三国杀打小抄.js'))
      assert.equal(options.installer, installer)
      if (useRealChecker) return buildChecker(options)
      return { check: async value => { assert.equal(value, window); checks++; return { status: 'current' } } }
    }
  })
  const hostChecker = () => buildChecker({ versionFile: path.join(directory, 'version.json'),
    scriptFile: path.join(directory, '三国杀打小抄.js'), installer, dialog: electron.dialog })
  return { directory, electron, app, window, ipcMain, installer, runtime, dialogs, original, hostChecker,
    setWait: value => { wait = value }, setInstalling: value => { installing = value },
    counts: () => ({ checks, quits, reads, fetches }) }
}
async function runEntry(f, remoteOverride) {
  const logs = []
  const remote = remoteOverride === undefined ? {
    app: f.app, getCurrentWindow: () => ({ id: 7 }),
    require(name) {
      if (name === 'path') return path
      assert.equal(name, path.join(f.directory, 'modules/runtime/release-bootstrap.js'))
      return { bootstrapReleaseUpdates: id => f.runtime.start(id) }
    }
  } : remoteOverride
  vm.runInNewContext(entry, { window: { electron: remote ? { remote } : undefined },
    appendLocalSkinDebugLine: line => logs.push(line) })
  await tick()
  return logs
}
async function nativeProbe() {
  const executable = process.env.XC_RELEASE_ELECTRON || 'F:/Game/SGSOL/SGSOL.exe'
  assert(fs.existsSync(executable))
  const runtimeDir = path.join(root, 'electron'), appDir = path.join(runtimeDir, 'resources/app')
  const userData = path.join(root, 'native-user'), modules = path.join(userData, 'modules/runtime')
  fs.mkdirSync(appDir, { recursive: true }); fs.mkdirSync(modules, { recursive: true })
  fs.mkdirSync(path.join(runtimeDir, 'locales'), { recursive: true })
  fs.copyFileSync(executable, path.join(runtimeDir, 'electron.exe'))
  for (const name of ['chrome_100_percent.pak', 'chrome_200_percent.pak', 'd3dcompiler_47.dll', 'ffmpeg.dll',
    'icudtl.dat', 'libEGL.dll', 'libGLESv2.dll', 'resources.pak', 'snapshot_blob.bin', 'v8_context_snapshot.bin',
    'vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'vulkan-1.dll', 'locales/en-US.pak']) {
    const source = path.join(path.dirname(executable), name)
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(runtimeDir, name))
  }
  for (const name of ['release-bootstrap.js', 'release-update.js', 'release-install.js'])
    fs.copyFileSync(path.join(project, 'src/electron', name), path.join(modules, name))
  fs.writeFileSync(path.join(userData, 'version.json'), '{"version":"1.0.0"}')
  fs.writeFileSync(path.join(userData, '三国杀打小抄.js'), '// @version 1.0.0\n')
  fs.writeFileSync(path.join(appDir, 'package.json'), '{"name":"xc-update-bootstrap-probe","main":"main.js"}')
  fs.writeFileSync(path.join(appDir, 'preload.js'), "window.electron=require('electron');")
  fs.writeFileSync(path.join(appDir, 'guest.html'), '<!doctype html><meta charset="utf-8">legacy guest')
  const renderer = entry + `
    const appendLocalSkinDebugLine=()=>{};
    setTimeout(async()=>{
      const value=await window.electron.ipcRenderer.invoke('read-local-script','probe');
      window.electron.ipcRenderer.send('probe-ready',{ok:value.success&&value.data==='probe'});
    },25);`
  fs.writeFileSync(path.join(appDir, 'index.html'), `<!doctype html><webview id="game" style="width:640px;height:480px"></webview><script>
    const path=require('path'),url=require('url'),view=document.getElementById('game');
    view.setAttribute('preload',url.pathToFileURL(path.join(__dirname,'preload.js')).href);
    view.addEventListener('dom-ready',()=>view.executeJavaScript(${JSON.stringify(renderer)}));
    view.src=url.pathToFileURL(path.join(__dirname,'guest.html')).href;
  </script>`)
  const report = path.join(root, 'native-result.json')
  fs.writeFileSync(path.join(appDir, 'main.js'), `
    const {app,BrowserWindow,ipcMain,dialog}=require('electron'),fs=require('fs'),path=require('path');
    app.setPath('userData',${JSON.stringify(userData)});app.disableHardwareAcceleration();
    const dialogs=[];let turns=0,sender=null,finished=false;
    function done(error){if(finished)return;finished=true;fs.writeFileSync(${JSON.stringify(report)},JSON.stringify({ok:!error,error,dialogs,turns,node:process.versions.node,electron:process.versions.electron,hasCredentials:fs.existsSync(path.join(app.getPath('userData'),'cos-update.local.json'))}));app.exit(error?1:0);}
    dialog.showMessageBox=async(parent,options)=>{dialogs.push({title:options.title,detail:options.detail,buttons:options.buttons});return {response:1};};
    ipcMain.handle('read-local-script',(event,value)=>({success:true,data:value}));
    ipcMain.on('probe-ready',(event,result)=>{if(!result.ok)return done('reader failed');turns++;sender=event.sender;});
    let reloaded=false;
    setInterval(()=>{if(turns===1&&dialogs.length===1&&!reloaded){reloaded=true;sender.reload();}else if(turns===2){setTimeout(()=>done(dialogs.length===1?'':'duplicate dialog'),300);}},50);
    setTimeout(()=>done('timeout'),20000);
    app.whenReady().then(()=>{const w=new BrowserWindow({show:false,webPreferences:{webviewTag:true,nodeIntegration:true,contextIsolation:false,enableRemoteModule:true}});w.loadFile(path.join(__dirname,'index.html'));});`)
  const env = Object.assign({}, process.env); delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(path.join(runtimeDir, 'electron.exe'), ['--no-sandbox'], { encoding: 'utf8', windowsHide: true, timeout: 30000, env })
  const data = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) : null
  assert.equal(result.status, 0, JSON.stringify(data) || result.stderr || String(result.error))
  assert(data && data.ok && !data.hasCredentials && data.turns === 2)
  assert.equal(data.dialogs[0].buttons[0], '下载并安装')
  assert(data.dialogs[0].detail.includes('当前版本：1.0.0'))
  process.stdout.write('PASS native unpatched host + webview + anonymous COS + reload dedupe: ' + JSON.stringify(data) + '\n')
}
(async () => {
  await check('real userscript entry boots an unpatched host, once across reinjection', async () => {
    const f = fixture(); await runEntry(f); await runEntry(f)
    assert.equal(f.counts().checks, 1); assert.equal(f.app.listenerCount('before-quit'), 1)
    assert(!fs.existsSync(path.join(f.directory, 'cos-update.local.json')))
  })
  await check('ordinary browsers skip bootstrap and missing runtime produces in-app diagnostics', async () => {
    const f = fixture(); assert.equal((await runEntry(f, null)).length, 0)
    const logs = await runEntry(f, { app: f.app, getCurrentWindow() {}, require() { throw Error('missing') } })
    assert.equal(logs.length, 1); assert(logs[0].includes('完整更新包')); assert.equal(f.counts().checks, 0)
  })
  await check('invalid or closed windows do not install hooks', () => {
    const f = fixture()
    for (const id of [null, 0, -1, '7', 8]) assert.equal(f.runtime.start(id).ok, false)
    assert.equal(f.ipcMain._invokeHandlers.get('read-local-script'), f.original)
  })
  await check('unsupported legacy reader fails explicitly instead of unsafe installation', () => {
    const f = fixture(); f.ipcMain._invokeHandlers.delete('read-local-script')
    assert.equal(f.runtime.start(7).code, 'script-reader-unavailable'); assert.equal(f.counts().checks, 0)
  })
  await check('script reading waits for installation and preserves receiver, arguments and response', async () => {
    const f = fixture(); f.runtime.start(7)
    let release; f.setWait(() => new Promise(resolve => { release = resolve }))
    const receiver = {}, task = f.ipcMain._invokeHandlers.get('read-local-script').call(receiver, {}, 'saved')
    await tick(); assert.equal(f.counts().reads, 0); release(); const result = await task
    assert.equal(result.data, 'saved'); assert.equal(result.receiver, receiver)
  })
  await check('failed recovery suppresses old loader remote fallback without reading partial data', async () => {
    const f = fixture(); f.runtime.start(7); f.setWait(async () => { throw Error('fixture') })
    const result = await f.ipcMain._invokeHandlers.get('read-local-script')({}, 'bad')
    assert.equal(result.success, true); assert.equal(result.data, ''); assert.equal(result.suppressRemoteFallback, true)
    assert.equal(f.counts().reads, 0)
  })
  await check('quit waits for active installation and merges repeated exit requests', async () => {
    const f = fixture(); f.runtime.start(7); f.setInstalling(true)
    let release, prevented = 0; f.setWait(() => new Promise(resolve => { release = resolve }))
    const event = { preventDefault() { prevented++ } }
    f.app.emit('before-quit', event); f.app.emit('before-quit', event); await tick()
    assert.equal(prevented, 2); assert.equal(f.counts().quits, 0)
    f.setInstalling(false); release(); await tick(); assert.equal(f.counts().quits, 1)
  })
  await check('native host and bootstrap share one network check and dialog, either start order', async () => {
    for (const hostFirst of [true, false]) {
      const f = fixture(true), host = f.hostChecker()
      if (hostFirst) host.check(f.window)
      f.runtime.start(7)
      const pending = host.check(f.window); await pending; await tick()
      assert.equal(f.counts().fetches, 1); assert.equal(f.dialogs.length, 1)
    }
  })
  await check('a later reader wrapper is preserved on reinjection', async () => {
    const f = fixture(); f.runtime.start(7)
    const protectedReader = f.ipcMain._invokeHandlers.get('read-local-script')
    const later = function () { return protectedReader.apply(this, arguments) }
    f.ipcMain.removeHandler('read-local-script'); f.ipcMain.handle('read-local-script', later)
    f.runtime.start(7); assert.equal(f.ipcMain._invokeHandlers.get('read-local-script'), later)
  })
  await check('release mapping ships the startup module and contains no local credentials', () => {
    const mapping = require('../release-files.json')
    assert(mapping.files.some(e => e.source === 'electron-next/src/electron/release-bootstrap.js' && e.target === 'modules/runtime/release-bootstrap.js'))
    assert(!mapping.files.some(e => /cos-(?:update|upload).*json/.test(e.target)))
  })
  process.stdout.write(passed + ' release bootstrap checks passed\n')
  if (process.argv.includes('--native')) await nativeProbe()
  process.stdout.write('Artifacts: ' + root + '\n')
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1 })
