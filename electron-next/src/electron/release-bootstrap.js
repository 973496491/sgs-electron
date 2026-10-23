// The installed userscript calls this in the main process through legacy remote.require.
// No renderer callbacks, credentials or arbitrary filesystem paths are accepted.
const fs = require('fs')
const path = require('path')
const { createUpdateChecker } = require('./release-update')
const { getInstallCoordinator } = require('./release-install')
let runtime = null

function createReleaseBootstrap(electron, services) {
  services = services || {}
  const { app, BrowserWindow, ipcMain, dialog, shell } = electron
  const directory = app.getPath('userData')
  const log = message => {
    try { fs.appendFileSync(path.join(directory, 'app-log.txt'), '[' + new Date().toISOString() + '] ' + message + '\n') } catch (_) {}
  }
  const installer = (services.getInstallCoordinator || getInstallCoordinator)({ targetDirectory: directory, log })
  const checker = (services.createUpdateChecker || createUpdateChecker)({
    versionFile: path.join(directory, 'version.json'),
    scriptFile: path.join(directory, '三国杀打小抄.js'),
    credentialsFile: path.join(directory, 'cos-update.local.json'),
    downloadDirectory: path.join(app.getPath('downloads'), '小抄更新'),
    dialog, shell, installer, log,
    restart: () => { app.relaunch(); app.quit() }
  })
  const readers = new WeakSet()
  const started = new WeakSet()
  let quitHookInstalled = false, quitPending = false

  function protectScriptReader() {
    // Verified on the legacy Electron 10 host: preserve its existing handler and response format.
    const handlers = ipcMain && ipcMain._invokeHandlers
    if (!handlers || typeof handlers.get !== 'function') return false
    const original = handlers.get('read-local-script')
    if (typeof original !== 'function') return false
    if (readers.has(original)) return true
    const wrapped = async function () {
      try { await installer.whenIdle() }
      catch (_) {
        log('[更新引导] 安装恢复未完成，本次停止注入')
        // Older frame loaders ignore suppressRemoteFallback, but understand success/data.
        return { success: true, data: '', suppressRemoteFallback: true, error: 'Local update recovery is incomplete' }
      }
      return original.apply(this, arguments)
    }
    ipcMain.removeHandler('read-local-script')
    try { ipcMain.handle('read-local-script', wrapped) }
    catch (error) {
      if (!handlers.has('read-local-script')) ipcMain.handle('read-local-script', original)
      throw error
    }
    readers.add(wrapped)
    return true
  }
  function protectQuit() {
    if (quitHookInstalled) return
    quitHookInstalled = true
    app.on('before-quit', event => {
      if (!installer.isInstalling()) return
      event.preventDefault()
      if (quitPending) return
      quitPending = true
      Promise.resolve().then(() => installer.whenIdle()).catch(() => {}).then(() => app.quit())
    })
  }
  function start(windowId) {
    if (!Number.isInteger(windowId) || windowId <= 0) return { ok: false, code: 'invalid-window' }
    const window = BrowserWindow.fromId(windowId)
    if (!window || window.isDestroyed()) return { ok: false, code: 'window-closed' }
    if (started.has(window)) return { ok: true }
    if (!protectScriptReader()) {
      log('[更新引导] 旧客户端脚本读取入口不可用，未启动自动安装')
      return { ok: false, code: 'script-reader-unavailable' }
    }
    protectQuit()
    started.add(window)
    log('[更新引导] 已从小抄接通本机更新模块')
    Promise.resolve().then(() => checker.check(window)).catch(() => log('[更新引导] 检查启动失败'))
    return { ok: true }
  }
  return Object.freeze({ start })
}

function bootstrapReleaseUpdates(windowId) {
  try {
    if (!runtime) runtime = createReleaseBootstrap(require('electron'))
    return runtime.start(windowId)
  } catch (_) { return { ok: false, code: 'bootstrap-failed' } }
}

module.exports = { createReleaseBootstrap, bootstrapReleaseUpdates }
