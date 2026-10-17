// Run with Node or ELECTRON_RUN_AS_NODE using the installed Electron 10 executable.
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const vm = require('vm')
const assert = require('assert').strict
const update = require('../src/electron/release-update')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-version-check-'))
const versionFile = path.join(root, 'version.json')
const scriptFile = path.join(root, 'script.js')
let passed = 0
let liveResult = null

function writeVersion(version) {
  fs.writeFileSync(versionFile, JSON.stringify({ version }))
  fs.writeFileSync(scriptFile, '// @version ' + version + '\n')
}
function windowStub() {
  return { closed: false, isDestroyed() { return this.closed } }
}
function checker(fetch) {
  const messages = [], logs = []
  const service = update.createUpdateChecker({ versionFile, scriptFile, autoInstall: false, fetchManifest: fetch,
    log: text => logs.push(text), dialog: { showMessageBox: async (window, options) => { messages.push(options); return { response: 1 } } } })
  return { service, messages, logs }
}
async function check(name, action) {
  await action()
  passed++
  process.stdout.write('PASS ' + name + '\n')
}
async function main() {
  writeVersion('0.0.9')
  await check('numeric comparison, including 0.0.9 -> 1.0.0 and 3.9 -> 3.10', async () => {
    assert.equal(update.compareVersions('1.0.0', '0.0.9'), 1)
    assert.equal(update.compareVersions('3.10.0', '3.9.0'), 1)
    assert.equal(update.compareVersions('1.0.0', '1.0.0'), 0)
    for (const v of ['1', '1.0', '1.0.0-beta', '01.0.0', '<script>', null]) assert.throws(() => update.parseVersion(v))
  })
  await check('newer remote version opens one notification with both versions', async () => {
    const c = checker(async () => ({ version: '1.0.0', packageKey: 'unused.zip' }))
    const window = windowStub()
    const results = await Promise.all([c.service.check(window), c.service.check(window)])
    assert.equal(results[0].status, 'update-available')
    assert.equal(c.messages.length, 1)
    assert.equal(c.messages[0].detail, '当前版本：0.0.9\n最新版本：1.0.0')
    assert.deepEqual(c.messages[0].buttons, ['下载更新', '稍后'])
    await c.service.check(window)
    assert.equal(c.messages.length, 1)
  })
  await check('same and older versions do not show an update', async () => {
    for (const version of ['0.0.9', '0.0.8']) {
      const c = checker(async () => ({ version }))
      assert.equal((await c.service.check(windowStub())).status, 'current')
      assert.equal(c.messages.length, 0)
    }
  })
  await check('closed windows ignore late asynchronous results', async () => {
    let finish
    const c = checker(() => new Promise(resolve => { finish = resolve }))
    const window = windowStub(), task = c.service.check(window)
    await Promise.resolve()
    window.closed = true
    finish({ version: '1.0.0' })
    assert.equal((await task).status, 'cancelled')
    assert.equal(c.messages.length, 0)
  })
  await check('network or malformed version errors resolve without stopping startup', async () => {
    for (const fetch of [async () => { throw new Error('secret-in-error') }, async () => ({ version: 'broken' })]) {
      const c = checker(fetch)
      assert.equal((await c.service.check(windowStub())).status, 'failed')
      assert.equal(c.messages.length, 0)
      assert(!c.logs.join('\n').includes('secret-in-error'))
    }
  })
  await check('missing record falls back to script metadata; loaded script wins stale record', async () => {
    fs.unlinkSync(versionFile)
    assert.equal(update.readLocalVersion({ versionFile, scriptFile }), '0.0.9')
    fs.writeFileSync(versionFile, '{"version":"1.0.0"}')
    assert.equal(update.readLocalVersion({ versionFile, scriptFile }), '0.0.9')
    writeVersion('0.0.9')
  })
  const requests = []
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, headers: req.headers })
    if (req.url === '/timeout') return
    if (req.url === '/forbidden') { res.writeHead(403); res.end(); return }
    if (req.url === '/large') { res.end('x'.repeat(65537)); return }
    if (req.url === '/invalid') { res.end('{bad'); return }
    res.setHeader('Content-Type', 'application/json')
    res.end('{"version":"1.0.0"}')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const base = 'http://127.0.0.1:' + server.address().port
    await check('HTTP reader sends signed GET and accepts the version JSON', async () => {
      const manifest = await update.fetchManifest(base + '/version.json', { secretId: 'fixture-id', secretKey: 'fixture-secret' }, http, 1000)
      assert.equal(manifest.version, '1.0.0')
      assert(requests[0].headers.authorization.includes('q-signature='))
      assert.equal(requests[0].headers['cache-control'], 'no-cache')
      assert.equal(requests.length, 1)
    })
    await check('403, invalid JSON, oversized response and timeout fail cleanly', async () => {
      for (const suffix of ['/forbidden', '/invalid', '/large', '/timeout']) {
        await assert.rejects(update.fetchManifest(base + suffix, null, http, 100))
      }
    })
  } finally { await new Promise(resolve => server.close(resolve)) }
  await check('title writes use the local version in both creation and expansion', async () => {
    const script = fs.readFileSync(path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8')
    const expected = JSON.parse(fs.readFileSync(path.join(__dirname, '../version.json'), 'utf8')).version
    assert.equal((script.match(/"小抄月见版 " \+ XIAOCHAO_VERSION/g) || []).length, 2)
    assert.equal(script.match(/const XIAOCHAO_VERSION = "([^"]+)";/)[1], expected)
    assert.equal(script.match(/^\/\/\s*@version\s+(\S+)/m)[1], expected)
    assert(!/_0x43f342|_0x38a6c4/.test(script))
  })
  if (process.env.XC_UPDATE_LIVE_DIR) {
    await check('installed runtime reads COS and requests the 0.0.9 -> 1.0.0 dialog', async () => {
      const dir = process.env.XC_UPDATE_LIVE_DIR
      const messages = []
      const service = update.createUpdateChecker({
        versionFile: path.join(dir, 'version.json'), scriptFile: path.join(dir, '三国杀打小抄.js'),
        credentialsFile: path.join(dir, 'cos-update.local.json'),
        dialog: { showMessageBox: async (window, options) => { messages.push(options); return { response: 1 } } }
      })
      liveResult = await service.check(windowStub())
      assert.equal(liveResult.status, 'update-available', JSON.stringify(liveResult))
      assert.equal(liveResult.localVersion, '0.0.9')
      assert.equal(liveResult.remoteVersion, '1.0.0')
      assert.equal(messages.length, 1)
    })
  }
  if (process.env.XC_UPDATE_HOST_MAIN) {
    await check('the real installed checkAndUpdateScript entry reaches the reader and notification', async () => {
      const source = fs.readFileSync(process.env.XC_UPDATE_HOST_MAIN, 'utf8')
      assert(source.includes('void checkAndUpdateScript();'))
      const start = source.indexOf('let xiaochaoReleaseChecker = null;')
      const end = source.indexOf('\nasync function initConfig()', start)
      assert(start > 0 && end > start)
      const messages = [], dir = process.env.XC_UPDATE_LIVE_DIR
      const result = await vm.runInNewContext(source.slice(start, end) + '\ncheckAndUpdateScript()', {
        require, path, app: { getPath: () => dir, on: () => {}, relaunch: () => {}, quit: () => {} }, scriptPath: path.join(dir, '三国杀打小抄.js'),
        mainWindow: windowStub(), logMessage: () => {}, shell: { showItemInFolder: () => {} },
        dialog: { showMessageBox: async (window, options) => { messages.push(options); return { response: 1 } } }
      })
      assert.equal(result.status, 'update-available')
      assert.equal(messages.length, 1)
      assert.equal(messages[0].detail, '当前版本：0.0.9\n最新版本：1.0.0')
    })
  }
  process.stdout.write(passed + ' version checks passed; Node ' + process.versions.node + '\n')
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1 }).finally(() => {
  // This directory contains only the two files created by this test.
  for (const file of [versionFile, scriptFile]) if (fs.existsSync(file)) fs.unlinkSync(file)
  fs.rmdirSync(root)
  if (process.env.XC_UPDATE_TEST_REPORT) {
    fs.writeFileSync(process.env.XC_UPDATE_TEST_REPORT, JSON.stringify({ passed, node: process.versions.node,
      electron: process.versions.electron, exitCode: process.exitCode || 0, liveResult }, null, 2))
  }
})
