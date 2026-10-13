// Source-level Electron wiring checks with isolated Electron/DOM stubs.
// Optional argument: installed resources/app, or the flat staged source folder.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')

async function main() {
  const calls = [], subscriptions = new Map(), menus = []
  let attached
  const webview = {
    addEventListener() {}, setAttribute() {}, getWebContentsId: () => 1,
    loadURL(url) { this.src = url; return Promise.resolve() },
    executeJavaScript(code) { calls.push(['execute', code]); return Promise.resolve() }
  }
  const nodes = { wb: webview, WDVerSion: { addEventListener() {} }, cmenu: { addEventListener() {} } }
  const document = { getElementById: key => nodes[key] || null }
  const pickerApi = { attach(target, options) {
    assert.equal(target, webview)
    assert.equal(options.document, document)
    attached = options
    return { open() { calls.push(['open']) } }
  } }
  const window = {
    addEventListener() {},
    electronAPI: {
      onMessage(callback) { subscriptions.set('rendererMsg', callback); return () => {} },
      loadElectronFrame: () => Promise.resolve({ partition: 1, packageId: 1 }),
      sendMsg() {}
    }
  }
  const quiet = { log() {}, warn() {}, info() {}, error() {} }
  const repoContext = { window, document, console: quiet, SGSAccountPicker: pickerApi,
    cMenu: class { constructor(menu) { menus.push(menu) } }, cxDialog() {} }
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8')
  vm.runInNewContext(renderer, repoContext)
  await Promise.resolve()
  assert.equal(attached.getPackageId(), 1)
  menus[0].find(item => item.text === '账号选择（OL）').events.click()
  subscriptions.get('rendererMsg')('openAccountPicker')
  assert.equal(calls.filter(item => item[0] === 'open').length, 2)
  assert.equal(webview.partition, 'persist:sgs1')
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8')
  assert(html.indexOf('./account-picker.js') < html.indexOf('./renderer.js'))
  const preload = fs.readFileSync(path.join(__dirname, '../src/renderer/preload.js'), 'utf8')
  assert(!/managerData|rememberCurrentAccount|manager_add|password\.value/.test(preload))
  process.stdout.write('PASS repository menu, renderer IPC, script loading and legacy removal\n')

  if (!process.argv[2]) return
  const dir = process.argv[2]
  const framePath = [path.join(dir, 'script/electron_frame.js'), path.join(dir, 'electron_frame.js')].find(file => fs.existsSync(file))
  const frame = fs.readFileSync(framePath, 'utf8')
  const runtimeMain = fs.readFileSync(path.join(dir, 'main.js'), 'utf8')
  assert(!/managerData|rememberCurrentAccount|manager_add|password\.value/.test(frame))
  const events = new Map()
  const electron = {
    ipcRenderer: { on(key, fn) { events.set(key, fn) }, send() {}, invoke() { return Promise.resolve({ success: false }) } },
    remote: { getGlobal(key) { return ({ PackageId: 1, ChannelId: 0, LoginURL: ['https://web.sanguosha.com/login/air/client/h5/index'], IsTest: false, IsDebug: false })[key] } }
  }
  const startupTasks = []
  const runtimeWindow = { SGSAccountPicker: pickerApi, setTimeout(task) { startupTasks.push(task) } }
  const runtimeContext = { window: runtimeWindow, document, console: quiet,
    require(name) { if (name === 'electron') return electron; throw Error('Sandboxed preload cannot require local files') } }
  vm.runInNewContext(frame, runtimeContext)
  runtimeWindow.loadElectronFrame()
  assert.equal(webview.src, 'https://web.sanguosha.com/login/air/client/h5/index')
  startupTasks.forEach(task => task())
  const before = calls.filter(item => item[0] === 'open').length
  events.get('rendererMsg')({}, 'openAccountPicker')
  assert.equal(calls.filter(item => item[0] === 'open').length, before + 1)
  runtimeWindow.msgList.channel(3)
  assert.equal(attached.getPackageId(), 3)
  const start = runtimeMain.indexOf('function createContextMenu(window) {')
  const end = runtimeMain.indexOf("ipcMain.handle('pc_2_flashWindow'", start)
  assert(start >= 0 && end > start)
  const delivered = []
  const menuContext = { config: { get: () => false }, Menu: { buildFromTemplate: value => value }, testWindow: { webContents: { send: (...args) => delivered.push(args) } } }
  const runtimeMenu = vm.runInNewContext(runtimeMain.slice(start, end) + '\ncreateContextMenu(testWindow)', menuContext)
  runtimeMenu.find(item => item.label === '账号选择（OL）').click()
  assert.deepEqual(delivered, [['rendererMsg', 'openAccountPicker']])
  assert(runtimeMenu.some(item => item.label === '切换账号（OL）'))
  process.stdout.write('PASS installed menu -> rendererMsg -> independent picker, plus current-platform tracking\n')

  await runtimeContext.execute(webview)
  const injection = calls.filter(item => item[0] === 'execute').at(-1)[1]
  new vm.Script(injection)
  let queries = 0, rememberClicks = 0
  const reads = []
  const remember = { addEventListener() {}, click() { rememberClicks++ } }
  const proto = { parentNode: { classList: { add() {} } } }
  const login = { removeAttribute() {}, classList: { remove() {} } }
  const guestContext = {
    window: { location: { origin: 'https://web.sanguosha.com', pathname: '/login/air/client/h5/index' } },
    document: { querySelector(key) { queries++; return ({ '#SGS_login-remember': remember, '#SGS_userProto': proto, '#SGS_login-btn': login })[key] || null } },
    localStorage: { getItem(key) { reads.push(key); return 'true' } },
    fetch() { throw Error('Unexpected network request') }
  }
  vm.runInNewContext(injection, guestContext)
  assert.equal(rememberClicks, 1)
  assert.equal(proto.checked, true)
  assert.deepEqual(reads, ['SGS_login-remember_checked'])
  const previousQueries = queries
  guestContext.window.location.pathname = '/220/h5_2/'
  vm.runInNewContext(injection, guestContext)
  assert.equal(queries, previousQueries)
  process.stdout.write('PASS native remember initialization retained, no legacy account storage, non-login scenes skipped\n')
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1 })
