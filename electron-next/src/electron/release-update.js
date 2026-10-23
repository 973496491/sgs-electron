// Startup checks, downloads and transactional installation after explicit update choice.
// Compatible with the installed Electron 10 / Node 12 runtime.
const fs = require('fs')
const https = require('https')
const crypto = require('crypto')
const path = require('path')
const pipeline = require('stream').pipeline
const getInstallCoordinator = require('./release-install').getInstallCoordinator

const MANIFEST_URL = 'https://sgsol-1300866055.cos.ap-guangzhou.myqcloud.com/releases/version.json'
// The patched host and the userscript bootstrap load this same installed module.
// Share checks per window and update source so they cannot open duplicate dialogs.
const windowChecks = new WeakMap()

function failure(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function parseVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/.test(value)) {
    throw failure('invalid-version')
  }
  return value.split('.').map(Number)
}

function compareVersions(left, right) {
  const a = parseVersion(left), b = parseVersion(right)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1
  }
  return 0
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
}

function readLocalVersion(options) {
  let recorded = null, embedded = null
  const scriptFile = typeof options.scriptFile === 'function' ? options.scriptFile() : options.scriptFile
  if (fs.existsSync(options.versionFile)) {
    recorded = readJson(options.versionFile).version
    parseVersion(recorded)
  }
  if (fs.existsSync(scriptFile)) {
    const match = fs.readFileSync(scriptFile, 'utf8').match(/^\/\/\s*@version\s+(\S+)/m)
    if (match) {
      embedded = match[1]
      parseVersion(embedded)
    }
  }
  if (!embedded && !recorded) throw failure('local-version-missing')
  // Report the script actually loaded when an interrupted manual install left a stale record.
  return embedded || recorded
}

function readCredentials(file) {
  if (!file || !fs.existsSync(file)) return null
  const config = readJson(file)
  if (typeof config.secret_id !== 'string' || !config.secret_id.trim() ||
      typeof config.secret_key !== 'string' || !config.secret_key.trim()) {
    throw failure('credentials-incomplete')
  }
  return { secretId: config.secret_id.trim(), secretKey: config.secret_key.trim() }
}

function signGet(url, credentials, now) {
  const parsed = new URL(url)
  if (parsed.search || parsed.hash || parsed.username || parsed.password) throw failure('invalid-manifest-url')
  const seconds = now === undefined ? Math.floor(Date.now() / 1000) : now
  const keyTime = (seconds - 60) + ';' + (seconds + 300)
  const host = parsed.host.toLowerCase()
  const hmac = (key, text) => crypto.createHmac('sha1', key).update(text, 'utf8').digest('hex')
  const httpString = 'get\n' + decodeURIComponent(parsed.pathname) + '\n\nhost=' + encodeURIComponent(host) + '\n'
  const hashed = crypto.createHash('sha1').update(httpString, 'utf8').digest('hex')
  const signature = hmac(hmac(credentials.secretKey, keyTime), 'sha1\n' + keyTime + '\n' + hashed + '\n')
  return 'q-sign-algorithm=sha1&q-ak=' + encodeURIComponent(credentials.secretId) +
    '&q-sign-time=' + keyTime + '&q-key-time=' + keyTime +
    '&q-header-list=host&q-url-param-list=&q-signature=' + signature
}

function fetchManifest(url, credentials, transport, timeoutMs) {
  const parsed = new URL(url)
  const headers = { Host: parsed.host, 'Cache-Control': 'no-cache', Accept: 'application/json' }
  if (credentials) headers.Authorization = signGet(url, credentials)
  return new Promise((resolve, reject) => {
    let timer, settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      error ? reject(error) : resolve(value)
    }
    const request = (transport || https).request(url, { method: 'GET', headers }, response => {
      if (response.statusCode !== 200) {
        finish(failure('http-' + response.statusCode))
        response.destroy()
        request.destroy()
        return
      }
      const chunks = []
      let size = 0
      response.on('data', chunk => {
        size += chunk.length
        if (size > 65536) {
          finish(failure('manifest-too-large'))
          response.destroy()
          request.destroy()
        } else chunks.push(chunk)
      })
      response.on('error', () => finish(failure('response-error')))
      response.on('aborted', () => finish(failure('response-aborted')))
      response.on('end', () => {
        if (settled) return
        try {
          const manifest = JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, ''))
          if (!manifest || Array.isArray(manifest)) throw failure('invalid-manifest')
          parseVersion(manifest.version)
          finish(null, manifest)
        } catch (_) { finish(failure('invalid-manifest')) }
      })
    })
    request.on('error', () => finish(failure('network-error')))
    timer = setTimeout(() => {
      finish(failure('timeout'))
      request.destroy()
    }, timeoutMs || 8000)
    request.end()
  })
}

function packageInfo(manifest, manifestUrl) {
  const base = new URL(manifestUrl)
  const key = manifest.packageKey
  const prefix = decodeURIComponent(base.pathname.slice(1, base.pathname.lastIndexOf('/') + 1))
  if (typeof key !== 'string' || !key.startsWith(prefix) ||
      /[\\:%?#*"<>|\x00-\x1f]/.test(key) || !/\.zip$/i.test(key)) throw failure('invalid-package-key')
  const parts = key.split('/')
  if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) throw failure('invalid-package-key')
  const filename = parts[parts.length - 1]
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(filename)) throw failure('invalid-package-key')
  const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return { filename, url: base.origin + '/' + parts.map(encode).join('/') }
}

async function copyDownloadExclusive(partial, directory, filename) {
  const name = path.parse(filename)
  for (let index = 0; index < 1000; index++) {
    const target = path.join(directory, index ? name.name + ' (' + index + ')' + name.ext : filename)
    try {
      await new Promise((resolve, reject) => fs.copyFile(partial, target, fs.constants.COPYFILE_EXCL,
        error => error ? reject(error) : resolve()))
      return target
    } catch (error) {
      if (error.code !== 'EEXIST') throw failure('disk-error')
    }
  }
  throw failure('too-many-copies')
}

function downloadPackage(info, credentials, directory, options) {
  options = options || {}
  let cancel = () => {}
  const promise = new Promise((resolve, reject) => {
    let request, response, output, partial, timer
    let settled = false, opened = false, closed = false, received = 0, expected = null
    let signature = Buffer.alloc(0)
    const maxBytes = options.maxBytes || 5 * 1024 * 1024 * 1024
    const progress = () => {
      try { if (options.onProgress) options.onProgress(received, expected) } catch (_) {}
    }
    async function finish(error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (request) request.destroy()
      if (response) response.destroy()
      if (output && !closed) {
        const closing = new Promise(done => output.once('close', done))
        output.destroy()
        await closing
      }
      if (!error && (received < 22 || (expected !== null && received !== expected))) error = failure('incomplete-download')
      if (!error && !['504b0304', '504b0506'].includes(signature.toString('hex'))) error = failure('invalid-zip')
      let filePath
      if (!error) {
        try { filePath = await copyDownloadExclusive(partial, directory, info.filename) }
        catch (copyError) { error = copyError }
      }
      if (opened) {
        try { fs.unlinkSync(partial) } catch (_) {}
      }
      error ? reject(error) : resolve({ filePath, bytes: received })
    }
    cancel = () => { void finish(failure('cancelled')) }
    try {
      fs.mkdirSync(directory, { recursive: true })
      partial = path.join(directory, '.' + info.filename + '.' + crypto.randomBytes(8).toString('hex') + '.part')
      output = fs.createWriteStream(partial, { flags: 'wx' })
      output.on('close', () => { closed = true })
      output.on('error', () => { void finish(failure('disk-error')) })
      output.once('open', () => {
        opened = true
        if (settled) return
        try {
          const parsed = new URL(info.url)
          const headers = { Host: parsed.host, 'Cache-Control': 'no-cache', Accept: 'application/zip' }
          if (credentials) headers.Authorization = signGet(info.url, credentials)
          request = (options.transport || https).request(info.url, { method: 'GET', headers }, incoming => {
            response = incoming
            if (response.statusCode !== 200) { void finish(failure('http-' + response.statusCode)); return }
            if (response.headers['content-length'] !== undefined) {
              expected = Number(response.headers['content-length'])
              if (!Number.isSafeInteger(expected) || expected < 0 || expected > maxBytes) {
                void finish(failure('download-too-large')); return
              }
            }
            response.on('data', chunk => {
              received += chunk.length
              if (signature.length < 4) signature = Buffer.concat([signature, chunk.slice(0, 4 - signature.length)])
              if (received > maxBytes) { void finish(failure('download-too-large')); return }
              progress()
            })
            response.on('aborted', () => { void finish(failure('incomplete-download')) })
            pipeline(response, output, error => { void finish(error ? failure('incomplete-download') : null) })
          })
          request.on('error', () => { void finish(failure('network-error')) })
          request.setTimeout(options.idleTimeoutMs || 30000, () => { void finish(failure('timeout')) })
          timer = setTimeout(() => { void finish(failure('timeout')) }, options.timeoutMs || 300000)
          request.end()
          progress()
        } catch (_) { void finish(failure('request-error')) }
      })
    } catch (_) { void finish(failure('disk-error')) }
  })
  return { promise, cancel: () => cancel() }
}

function downloadErrorText(code) {
  if (code === 'http-403') return '没有读取更新包的权限，请检查本机 COS 配置。'
  if (code === 'http-404') return '云端更新包不存在，请稍后重试。'
  if (code === 'invalid-package-key') return '版本文件中的下载地址无效。'
  if (code === 'disk-error') return '无法保存文件，请检查下载目录权限和剩余空间。'
  if (code === 'invalid-zip' || code === 'incomplete-download') return '下载文件不完整或不是有效的 ZIP，请重试。'
  if (code === 'timeout') return '下载超时，请检查网络后重试。'
  return '下载失败，请检查网络和本机配置后重试。'
}

function createUpdateChecker(options) {
  const url = options.manifestUrl || MANIFEST_URL
  const checkKey = path.resolve(options.versionFile).toLowerCase() + '\n' + url
  if (new URL(url).protocol !== 'https:') throw failure('https-required')
  const log = message => {
    try { if (options.log) options.log('[版本检查] ' + message) } catch (_) {}
  }
  const isClosed = window => !window || window.isDestroyed()
  const installer = options.autoInstall === false ? null : (options.installer || getInstallCoordinator({
    targetDirectory: path.dirname(options.versionFile), installerScript: options.installerScript, log
  }))
  const setProgress = (window, value) => {
    try { if (!isClosed(window) && typeof window.setProgressBar === 'function') window.setProgressBar(value) } catch (_) {}
  }
  async function installDownloaded(window, saved, manifest, localVersion) {
    while (!isClosed(window)) {
      setProgress(window, 2)
      try {
        const installed = await installer.install(saved.filePath, manifest.version)
        const result = { status: 'installed', previousVersion: localVersion, installedVersion: installed.version,
          filePath: saved.filePath, restartRequired: true }
        setProgress(window, -1)
        if (isClosed(window)) return result
        const canRestart = typeof options.restart === 'function'
        const answer = await options.dialog.showMessageBox(window, {
          type: 'info', title: '小抄月见版', message: '更新已安装',
          detail: '已安装版本：' + installed.version + '\n重启客户端后生效。当前对局可以继续。',
          buttons: canRestart ? ['重启客户端', '稍后'] : ['知道了'],
          defaultId: canRestart ? 1 : 0, cancelId: canRestart ? 1 : 0, noLink: true
        })
        if (canRestart && answer.response === 0 && !isClosed(window)) options.restart()
        return result
      } catch (error) {
        const code = /^[a-z0-9-]+$/.test(error.code || '') ? error.code : 'install-failed'
        log('安装失败：' + code)
        if (isClosed(window)) return { status: 'install-failed', code }
        const detail = error.restored ? '原有文件已保留或恢复，下载包仍保留，可以重试。' :
          '安装未完成，已保留恢复文件和下载包。重新打开客户端时会尝试恢复。'
        const answer = await options.dialog.showMessageBox(window, {
          type: 'error', title: '小抄月见版', message: '更新安装失败', detail: detail + '\n错误：' + code,
          buttons: ['重试安装', '关闭'], defaultId: 1, cancelId: 1, noLink: true
        })
        if (answer.response !== 0) return { status: 'install-failed', code, filePath: saved.filePath }
      } finally { setProgress(window, -1) }
    }
    return { status: 'cancelled' }
  }
  async function download(window, manifest, localVersion) {
    const remoteVersion = manifest.version
    const directory = options.downloadDirectory || path.join(path.dirname(options.versionFile), 'downloads')
    while (!isClosed(window)) {
      let job, onClosed
      try {
        const info = packageInfo(manifest, url)
        log('开始下载 ' + remoteVersion + '，文件 ' + info.filename)
        job = (options.downloadPackage || downloadPackage)(info, readCredentials(options.credentialsFile), directory, {
          onProgress: (bytes, total) => setProgress(window, total ? Math.min(bytes / total, 1) : 2)
        })
        onClosed = () => job.cancel()
        if (typeof window.once === 'function') window.once('closed', onClosed)
        const saved = await job.promise
        log('下载完成 ' + saved.filePath + '，' + saved.bytes + ' 字节')
        const result = { status: 'downloaded', localVersion, remoteVersion, filePath: saved.filePath, bytes: saved.bytes }
        if (isClosed(window)) return result
        if (installer) return await installDownloaded(window, saved, manifest, localVersion)
        setProgress(window, -1)
        const canLocate = options.shell && typeof options.shell.showItemInFolder === 'function'
        const answer = await options.dialog.showMessageBox(window, {
          type: 'info', title: '小抄月见版', message: '更新包下载完成',
          detail: '已保存到：\n' + saved.filePath + '\n\n尚未安装，当前仍使用 ' + localVersion + '。',
          buttons: canLocate ? ['打开文件夹', '关闭'] : ['关闭'],
          defaultId: canLocate ? 1 : 0, cancelId: canLocate ? 1 : 0, noLink: true
        })
        if (canLocate && answer.response === 0 && !isClosed(window)) {
          try { options.shell.showItemInFolder(saved.filePath) } catch (_) { log('下载成功，但无法打开文件夹') }
        }
        return result
      } catch (error) {
        const code = /^[a-z0-9-]+$/.test(error.code || '') ? error.code : 'download-failed'
        if (isClosed(window) || code === 'cancelled') return { status: 'cancelled', localVersion, remoteVersion }
        log('下载失败：' + code)
        setProgress(window, -1)
        const answer = await options.dialog.showMessageBox(window, {
          type: 'error', title: '小抄月见版', message: '更新包下载失败', detail: downloadErrorText(code),
          buttons: ['重试下载', '关闭'], defaultId: 1, cancelId: 1, noLink: true
        })
        if (answer.response !== 0) return { status: 'download-failed', code, localVersion, remoteVersion }
      } finally {
        if (onClosed && typeof window.removeListener === 'function') window.removeListener('closed', onClosed)
        setProgress(window, -1)
      }
    }
    return { status: 'cancelled', localVersion, remoteVersion }
  }
  async function run(window) {
    try {
      if (installer) await installer.whenIdle()
      if (isClosed(window)) return { status: 'cancelled' }
      const localVersion = readLocalVersion(options)
      log('开始，本地版本 ' + localVersion)
      const credentials = readCredentials(options.credentialsFile)
      const manifest = await (options.fetchManifest || fetchManifest)(url, credentials)
      const remoteVersion = manifest.version
      const newer = compareVersions(remoteVersion, localVersion) > 0
      if (isClosed(window)) return { status: 'cancelled', localVersion, remoteVersion }
      if (!newer) {
        log('无需更新，本地 ' + localVersion + '，云端 ' + remoteVersion)
        return { status: 'current', localVersion, remoteVersion }
      }
      log('发现新版本，本地 ' + localVersion + '，云端 ' + remoteVersion)
      const answer = await options.dialog.showMessageBox(window, {
        type: 'info', title: '小抄月见版更新提示', message: '发现小抄月见版新版本',
        detail: '当前版本：' + localVersion + '\n最新版本：' + remoteVersion,
        buttons: [installer ? '下载并安装' : '下载更新', '稍后'], defaultId: 0, cancelId: 1, noLink: true
      })
      if (answer.response === 0 && !isClosed(window)) return await download(window, manifest, localVersion)
      return { status: 'update-available', localVersion, remoteVersion }
    } catch (error) {
      const code = /^[a-z0-9-]+$/.test(error.code || '') ? error.code : 'check-failed'
      log('检查失败：' + code + '，继续使用本地脚本')
      return { status: 'failed', code }
    }
  }
  return Object.freeze({
    check(window) {
      if (isClosed(window)) return Promise.resolve({ status: 'cancelled' })
      let checks = windowChecks.get(window)
      if (!checks) { checks = new Map(); windowChecks.set(window, checks) }
      if (!checks.has(checkKey)) checks.set(checkKey, Promise.resolve().then(() => run(window)))
      return checks.get(checkKey)
    }
  })
}

module.exports = { MANIFEST_URL, parseVersion, compareVersions, readLocalVersion, signGet, fetchManifest,
  packageInfo, downloadPackage, createUpdateChecker }
