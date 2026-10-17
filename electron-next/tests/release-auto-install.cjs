const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')
const assert = require('assert').strict
const EventEmitter = require('events')
const spawnSync = require('child_process').spawnSync
const update = require('../src/electron/release-update')
const getInstallCoordinator = require('../src/electron/release-install').getInstallCoordinator
const project = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-auto-install-tests-'))
const mapping = JSON.parse(fs.readFileSync(path.join(project, 'release-files.json'), 'utf8'))
const python = fs.existsSync(path.join(project, '.venv-release/Scripts/python.exe')) ? path.join(project, '.venv-release/Scripts/python.exe') : 'python'
const packageRoot = path.join(root, '发布 包')
let passed = 0, liveResult = null
class Window extends EventEmitter {
  constructor() { super(); this.closed = false }
  isDestroyed() { return this.closed }
  setProgressBar() {}
  close() { this.closed = true; this.emit('closed') }
}
function fixture(name) {
  const target = path.join(root, name)
  for (const entry of mapping.files) {
    const file = path.join(target, entry.target)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.copyFileSync(path.join(path.dirname(project), entry.source), file)
  }
  fs.writeFileSync(path.join(target, 'config.json'), '{"keep":"account and preferences"}')
  return target
}
function coordinator(target) {
  return getInstallCoordinator({ targetDirectory: target, installerScript: path.join(project, 'scripts/install.ps1') })
}
function controller(target, answers, installer) {
  const messages = [], window = new Window()
  let downloads = 0, restarts = 0
  const service = update.createUpdateChecker({ versionFile: path.join(target, 'version.json'),
    scriptFile: path.join(target, '三国杀打小抄.js'), installer: installer || coordinator(target),
    fetchManifest: async () => ({ version: '1.0.0', packageKey: 'releases/test.zip' }),
    downloadPackage: () => { downloads++; return { promise: Promise.resolve({ filePath: packageRoot + '.zip', bytes: 1 }), cancel() {} } },
    dialog: { showMessageBox: async (parent, options) => { messages.push(options); return { response: answers.shift() } } },
    restart: () => { restarts++ }
  })
  return { service, window, messages, downloads: () => downloads, restarts: () => restarts }
}
async function check(name, action) { await action(); passed++; process.stdout.write('PASS ' + name + '\n') }
async function main() {
  const built = spawnSync(python, [path.join(project, 'scripts/package_release.py'), '--version', '1.0.0',
    '--output-directory', packageRoot, '--compression-tool', 'python', '--no-upload', '--no-open'], { encoding: 'utf8', windowsHide: true })
  assert.equal(built.status, 0, built.stdout + built.stderr)
  await check('download flows into real installation and preserves local settings', async () => {
    const target = fixture('success'), c = controller(target, [0, 1])
    const results = await Promise.all([c.service.check(c.window), c.service.check(c.window)])
    assert.equal(results[0].status, 'installed', JSON.stringify(results[0]))
    assert.equal(results[0].installedVersion, '1.0.0')
    assert.equal(c.downloads(), 1)
    assert.equal(c.restarts(), 0)
    assert.deepEqual(c.messages[0].buttons, ['下载并安装', '稍后'])
    assert.deepEqual(c.messages[1].buttons, ['重启客户端', '稍后'])
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'version.json'))).version, '1.0.0')
    assert(fs.readFileSync(path.join(target, '三国杀打小抄.js'), 'utf8').includes('// @version      1.0.0'))
    assert.equal(fs.readFileSync(path.join(target, 'config.json'), 'utf8'), '{"keep":"account and preferences"}')
    assert.equal((await c.service.check(new Window())).status, 'current')
    assert.equal(c.messages.length, 2)
  })
  await check('installation retry reuses the downloaded ZIP and restarts only on explicit choice', async () => {
    const target = fixture('retry'), real = coordinator(target)
    let attempts = 0
    const c = controller(target, [0, 0, 0], { whenIdle: () => real.whenIdle(), install: (archive, version) => {
      attempts++
      if (attempts === 1) { const error = new Error('test failure'); error.code = 'test-failure'; error.restored = true; return Promise.reject(error) }
      return real.install(archive, version)
    } })
    assert.equal((await c.service.check(c.window)).status, 'installed')
    assert.equal(c.downloads(), 1); assert.equal(attempts, 2); assert.equal(c.restarts(), 1)
    assert.deepEqual(c.messages[1].buttons, ['重试安装', '关闭'])
  })
  await check('closing the parent during installation does not interrupt commit', async () => {
    const target = fixture('closed'), real = coordinator(target)
    let c
    c = controller(target, [0], { whenIdle: () => real.whenIdle(), install: (archive, version) => {
      const task = real.install(archive, version); c.window.close(); return task
    } })
    assert.equal((await c.service.check(c.window)).status, 'installed')
    assert.equal(c.messages.length, 1)
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'version.json'))).version, '1.0.0')
  })
  await check('read barrier waits for commit and another version cannot overlap', async () => {
    const target = fixture('barrier'), installer = coordinator(target)
    const task = installer.install(packageRoot + '.zip', '1.0.0')
    assert(installer.isInstalling())
    await assert.rejects(installer.install(packageRoot + '.zip', '2.0.0'), /install-busy/)
    let read = false
    const reader = installer.whenIdle().then(() => { read = true; return JSON.parse(fs.readFileSync(path.join(target, 'version.json'))).version })
    assert.equal(read, false)
    assert.equal((await task).version, '1.0.0')
    assert.equal(await reader, '1.0.0')
    assert.equal(installer.isInstalling(), false)
  })
  if (process.env.XC_INSTALL_LIVE_HOST && process.env.XC_INSTALL_LIVE_USERDATA) {
    await check('real host downloads from COS and installs with its runtime helper into a clone', async () => {
      const target = fixture('live-clone'), real = process.env.XC_INSTALL_LIVE_USERDATA
      fs.copyFileSync(path.join(real, 'cos-update.local.json'), path.join(target, 'cos-update.local.json'))
      const before = ['version.json', '三国杀打小抄.js'].map(name => fs.readFileSync(path.join(real, name)))
      const source = fs.readFileSync(process.env.XC_INSTALL_LIVE_HOST, 'utf8')
      const start = source.indexOf('let xiaochaoReleaseChecker = null;'), end = source.indexOf('\nasync function initConfig()', start)
      assert(start > 0 && end > start)
      const messages = [], window = new Window(), events = {}
      let restarts = 0, quits = 0, quitVersion = null
      const context = { require, path, app: {
        getPath: name => name === 'downloads' ? path.join(root, 'live-download') : target,
        on: (name, action) => { events[name] = action }, relaunch: () => { restarts++ },
        quit: () => { quits++; quitVersion = JSON.parse(fs.readFileSync(path.join(target, 'version.json'))).version }
      }, scriptPath: path.join(target, '三国杀打小抄.js'), mainWindow: window, logMessage: () => {},
        shell: { showItemInFolder: () => {} },
        dialog: { showMessageBox: async (parent, options) => { messages.push(options); return { response: messages.length === 1 ? 0 : 1 } } }
      }
      const task = vm.runInNewContext(source.slice(start, end) + '\ncheckAndUpdateScript()', context)
      let done = false
      task.then(() => { done = true }, () => { done = true })
      const deadline = Date.now() + 20000
      while (!done && !context.getXiaochaoInstallCoordinator().isInstalling() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      assert(context.getXiaochaoInstallCoordinator().isInstalling(), 'Expected an active real installer process.')
      let prevented = false
      events['before-quit']({ preventDefault: () => { prevented = true } })
      assert(prevented); assert.equal(quits, 0)
      const result = await task
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(result.status, 'installed', JSON.stringify(result))
      assert.equal(result.installedVersion, '1.0.0'); assert.equal(restarts, 0)
      assert.equal(quits, 1); assert.equal(quitVersion, '1.0.0')
      assert.equal(messages.length, 2)
      assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'version.json'))).version, '1.0.0')
      assert.deepEqual(['version.json', '三国杀打小抄.js'].map(name => fs.readFileSync(path.join(real, name))), before)
      assert.equal(fs.readFileSync(path.join(target, 'config.json'), 'utf8'), '{"keep":"account and preferences"}')
      assert(!fs.existsSync(path.join(target, '.xiaochao-install-state.json')))
      liveResult = { status: result.status, version: result.installedVersion, actualUserDataUnchanged: true,
        installedRuntimeHelper: fs.existsSync(path.join(target, 'modules/runtime/install.ps1')), quitDeferredUntilCommit: true }
    })
  }
  process.stdout.write(passed + ' automatic installation checks passed; Node ' + process.versions.node + '\n')
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1 }).finally(() => {
  const real = fs.realpathSync(root), parent = fs.realpathSync(os.tmpdir())
  assert.equal(path.dirname(real).toLowerCase(), parent.toLowerCase())
  assert(path.basename(real).startsWith('xc-auto-install-tests-'))
  if (fs.rmSync) fs.rmSync(real, { recursive: true, force: true }); else fs.rmdirSync(real, { recursive: true })
  if (process.env.XC_UPDATE_TEST_REPORT) fs.writeFileSync(process.env.XC_UPDATE_TEST_REPORT,
    JSON.stringify({ passed, node: process.versions.node, electron: process.versions.electron, exitCode: process.exitCode || 0, liveResult }, null, 2))
})
