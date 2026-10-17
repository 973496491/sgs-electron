const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const vm = require('vm')
const EventEmitter = require('events')
const assert = require('assert').strict
const update = require('../src/electron/release-update')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-download-tests-'))
const payload = Buffer.from('504b05060000000000000000000000000000000000000000', 'hex')
const requests = []
const versionFile = path.join(root, 'version.json'), scriptFile = path.join(root, 'script.js')
fs.writeFileSync(versionFile, '{"version":"0.0.9"}')
fs.writeFileSync(scriptFile, '// @version 0.0.9\n')
let passed = 0, base, retryRequests = 0, liveResult = null
class Window extends EventEmitter {
  constructor() { super(); this.closed = false; this.progress = [] }
  isDestroyed() { return this.closed }
  setProgressBar(value) { this.progress.push(value) }
  close() { this.closed = true; this.emit('closed') }
}
const server = http.createServer((req, res) => {
  requests.push({ path: req.url, headers: req.headers })
  const key = decodeURIComponent(req.url)
  if (key.endsWith('/forbidden.zip')) { res.writeHead(403); res.end(); return }
  if (key.endsWith('/redirect.zip')) { res.writeHead(302, { Location: 'http://127.0.0.1:1/no-follow' }); res.end(); return }
  if (key.endsWith('/retry.zip') && retryRequests++ === 0) { res.writeHead(503); res.end(); return }
  if (key.endsWith('/invalid.zip')) { res.end('This is not a ZIP archive, even though the HTTP status is 200.'); return }
  if (key.endsWith('/large.zip')) { res.setHeader('Content-Length', 999999999999); res.end(); return }
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Length', payload.length)
  if (key.endsWith('/partial.zip')) {
    res.write(payload.slice(0, 4))
    setTimeout(() => res.destroy(), 30)
    return
  }
  if (key.endsWith('/stall.zip')) { res.write(payload.slice(0, 4)); return }
  res.write(payload.slice(0, 2))
  setTimeout(() => { if (!res.destroyed) res.end(payload.slice(2)) }, 10)
})
async function check(name, action) {
  await action(); passed++; process.stdout.write('PASS ' + name + '\n')
}
function job(name, directory, options) {
  return update.downloadPackage({ filename: name, url: base + '/releases/' + encodeURIComponent(name) },
    { secretId: 'fixture-id', secretKey: 'fixture-secret' }, directory,
    Object.assign({ transport: http, timeoutMs: 1000, idleTimeoutMs: 500 }, options))
}
function controller(name, answers, extra) {
  const messages = [], located = [], window = new Window()
  const service = update.createUpdateChecker(Object.assign({ versionFile, scriptFile, autoInstall: false,
    downloadDirectory: path.join(root, 'flow-' + name),
    fetchManifest: async () => ({ version: '1.0.0', packageKey: 'releases/' + name }),
    downloadPackage: (info, credentials, directory, options) => job(info.filename, directory, options),
    dialog: { showMessageBox: async (parent, options) => { messages.push(options); return { response: answers.shift() } } },
    shell: { showItemInFolder: file => located.push(file) }
  }, extra))
  return { service, window, messages, located }
}
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = 'http://127.0.0.1:' + server.address().port
  await check('package key is limited to the manifest origin and release prefix', async () => {
    for (const key of ['https://example.org/a.zip', '../x.zip', 'elsewhere/x.zip', 'releases/../x.zip',
      'releases/%2e%2e/x.zip', 'releases/a.zip?x=1', 'releases/a\\x.zip', 'releases/CON.zip', 'releases/a.exe']) {
      assert.throws(() => update.packageInfo({ packageKey: key }, update.MANIFEST_URL))
    }
    const info = update.packageInfo({ packageKey: 'releases/中文 包.zip' }, update.MANIFEST_URL)
    assert.equal(info.filename, '中文 包.zip')
    assert.equal(new URL(info.url).origin, new URL(update.MANIFEST_URL).origin)
    assert(info.url.includes('%E4%B8%AD%E6%96%87%20%E5%8C%85.zip'))
  })
  await check('Unicode object signature matches the official COS SDK fixture', async () => {
    const url = 'https://example-1250000000.cos.ap-guangzhou.myqcloud.com/releases/%E4%B8%AD%E6%96%87%20%E5%8C%85.zip'
    const signature = update.signGet(url, { secretId: 'fixture-id', secretKey: 'fixture-secret' }, 1700000000)
    assert(signature.endsWith('q-signature=76fc96c917b98b704cc29a760dd6eb6a6eafd78f'))
  })
  await check('streamed signed ZIP download preserves bytes and removes its partial file', async () => {
    const directory = path.join(root, 'success'), progress = []
    const result = await job('中文 包.zip', directory, { onProgress: (bytes, total) => progress.push([bytes, total]) }).promise
    assert.deepEqual(fs.readFileSync(result.filePath), payload)
    assert.equal(result.bytes, payload.length)
    assert.deepEqual(fs.readdirSync(directory), ['中文 包.zip'])
    assert(requests[0].headers.authorization.includes('q-signature='))
    assert(progress.some(item => item[0] === payload.length && item[1] === payload.length))
  })
  await check('existing downloads and simultaneous downloads are never overwritten', async () => {
    const directory = path.join(root, 'collision'); fs.mkdirSync(directory)
    fs.writeFileSync(path.join(directory, 'same.zip'), 'existing user file')
    const results = await Promise.all([job('same.zip', directory).promise, job('same.zip', directory).promise])
    assert.notEqual(results[0].filePath, results[1].filePath)
    assert.equal(fs.readFileSync(path.join(directory, 'same.zip'), 'utf8'), 'existing user file')
    for (const result of results) assert.deepEqual(fs.readFileSync(result.filePath), payload)
    assert.equal(fs.readdirSync(directory).length, 3)
  })
  for (const name of ['forbidden.zip', 'redirect.zip', 'invalid.zip', 'large.zip', 'partial.zip', 'stall.zip']) {
    await check(name + ' fails without leaving a ZIP or partial file', async () => {
      const directory = path.join(root, name + '-folder'), before = requests.length
      await assert.rejects(job(name, directory, { timeoutMs: 150, idleTimeoutMs: 100 }).promise)
      assert.deepEqual(fs.readdirSync(directory), [])
      assert.equal(requests.length, before + 1)
    })
  }
  await check('disk errors do not issue a network request or overwrite the obstruction', async () => {
    const file = path.join(root, 'not-a-directory'); fs.writeFileSync(file, 'keep')
    const before = requests.length
    await assert.rejects(job('test.zip', file).promise)
    assert.equal(requests.length, before)
    assert.equal(fs.readFileSync(file, 'utf8'), 'keep')
  })
  await check('choosing later does not download', async () => {
    const c = controller('later.zip', [1]), before = requests.length
    assert.equal((await c.service.check(c.window)).status, 'update-available')
    assert.equal(requests.length, before)
    assert.equal(c.messages.length, 1)
  })
  await check('download button reaches completion and locates only the saved ZIP', async () => {
    const c = controller('clicked.zip', [0, 0])
    const before = [fs.readFileSync(versionFile), fs.readFileSync(scriptFile)]
    const result = await c.service.check(c.window)
    assert.equal(result.status, 'downloaded')
    assert.deepEqual(fs.readFileSync(result.filePath), payload)
    assert.deepEqual(c.located, [result.filePath])
    assert.deepEqual(c.messages[0].buttons, ['下载更新', '稍后'])
    assert.deepEqual(c.messages[1].buttons, ['打开文件夹', '关闭'])
    assert(c.messages[1].detail.includes('尚未安装'))
    assert.deepEqual([fs.readFileSync(versionFile), fs.readFileSync(scriptFile)], before)
    assert.equal(c.window.progress[c.window.progress.length - 1], -1)
    assert.equal(c.window.listenerCount('closed'), 0)
    assert.equal((await c.service.check(c.window)).filePath, result.filePath)
    assert.equal(c.messages.length, 2)
  })
  await check('retry is user initiated and restarts with a clean file', async () => {
    const c = controller('retry.zip', [0, 0, 1])
    assert.equal((await c.service.check(c.window)).status, 'downloaded')
    assert.equal(retryRequests, 2)
    assert.deepEqual(c.messages[1].buttons, ['重试下载', '关闭'])
    assert.equal(c.messages.length, 3)
    assert.equal(c.window.listenerCount('closed'), 0)
  })
  await check('closing the window cancels transfer and suppresses late dialogs', async () => {
    const c = controller('stall.zip', [0])
    c.window.setProgressBar = value => { if (value > 0 && value <= 1) c.window.close() }
    assert.equal((await c.service.check(c.window)).status, 'cancelled')
    assert.equal(c.messages.length, 1)
    assert.equal(c.window.listenerCount('closed'), 0)
    assert.deepEqual(fs.readdirSync(path.join(root, 'flow-stall.zip')), [])
  })
  if (process.env.XC_UPDATE_HOST_MAIN && process.env.XC_UPDATE_LIVE_DIR) {
    await check('actual installed entry downloads the real private COS ZIP without installing', async () => {
      const source = fs.readFileSync(process.env.XC_UPDATE_HOST_MAIN, 'utf8')
      const start = source.indexOf('let xiaochaoReleaseChecker = null;')
      const end = source.indexOf('\nasync function initConfig()', start)
      assert(start > 0 && end > start)
      const dir = process.env.XC_UPDATE_LIVE_DIR, messages = [], window = new Window()
      const localFiles = [path.join(dir, 'version.json'), path.join(dir, '三国杀打小抄.js')]
      const before = localFiles.map(file => fs.readFileSync(file))
      const result = await vm.runInNewContext(source.slice(start, end) + '\ncheckAndUpdateScript()', {
        require: name => {
          const loaded = require(name)
          if (name.replace(/\\/g, '/').endsWith('/release-update.js')) {
            return Object.assign({}, loaded, { createUpdateChecker: options => loaded.createUpdateChecker(Object.assign({}, options, { autoInstall: false })) })
          }
          return loaded
        }, path, app: { getPath: name => name === 'downloads' ? path.join(root, 'live-download') : dir,
          on: () => {}, relaunch: () => {}, quit: () => {} },
        scriptPath: localFiles[1], mainWindow: window, logMessage: () => {}, shell: { showItemInFolder: () => { throw Error('must not open') } },
        dialog: { showMessageBox: async (parent, options) => { messages.push(options); return { response: messages.length === 1 ? 0 : 1 } } }
      })
      assert.equal(result.status, 'downloaded', JSON.stringify(result))
      assert.equal(result.localVersion, '0.0.9'); assert.equal(result.remoteVersion, '1.0.0')
      assert.equal(messages.length, 2)
      assert.deepEqual(localFiles.map(file => fs.readFileSync(file)), before)
      const published = path.join(__dirname, '../release', path.basename(result.filePath))
      assert(fs.existsSync(published), 'Published fixture ZIP must exist for byte verification.')
      assert.deepEqual(fs.readFileSync(result.filePath), fs.readFileSync(published))
      liveResult = { status: result.status, localVersion: result.localVersion, remoteVersion: result.remoteVersion,
        bytes: result.bytes, package: path.basename(result.filePath), matchesPublishedZip: true }
    })
  }
  process.stdout.write(passed + ' download checks passed; Node ' + process.versions.node + '\n')
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1 }).finally(async () => {
  await new Promise(resolve => server.close(resolve))
  const real = fs.realpathSync(root), tempRoot = fs.realpathSync(os.tmpdir())
  assert.equal(path.dirname(real).toLowerCase(), tempRoot.toLowerCase())
  assert(path.basename(real).startsWith('xc-download-tests-'))
  if (fs.rmSync) fs.rmSync(real, { recursive: true, force: true })
  else fs.rmdirSync(real, { recursive: true })
  if (process.env.XC_UPDATE_TEST_REPORT) fs.writeFileSync(process.env.XC_UPDATE_TEST_REPORT,
    JSON.stringify({ passed, node: process.versions.node, electron: process.versions.electron, exitCode: process.exitCode || 0, liveResult }, null, 2))
})
