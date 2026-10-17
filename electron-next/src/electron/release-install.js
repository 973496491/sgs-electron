// Owns installer processes and the read barrier shared by the loader and updater.
const fs = require('fs')
const path = require('path')
const spawn = require('child_process').spawn
const coordinators = new Map()

function installError(code, restored) {
  const error = new Error(code)
  error.code = code
  error.restored = restored === true
  return error
}

function getInstallCoordinator(options) {
  const directory = path.resolve(options.targetDirectory)
  const key = directory.toLowerCase()
  if (coordinators.has(key)) return coordinators.get(key)
  const localScript = path.join(__dirname, 'install.ps1')
  const script = options.installerScript || (fs.existsSync(localScript) ? localScript : path.resolve(__dirname, '../../scripts/install.ps1'))
  const executable = options.powershell || path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
  const journal = path.join(directory, '.xiaochao-install-state.json')
  const lock = path.join(directory, '.xiaochao-install.lock')
  let active = null, activeVersion = null, recovering = null
  function log(text) { try { if (options.log) options.log('[自动安装] ' + text) } catch (_) {} }
  function invoke(args) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(script)) { reject(installError('installer-missing', true)); return }
      const child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', script, '-TargetDirectory', directory].concat(args), { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      let output = '', errorOutput = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', data => { output = (output + data).slice(-65536) })
      child.stderr.on('data', data => { errorOutput = (errorOutput + data).slice(-8192) })
      child.on('error', () => reject(installError('installer-start-failed', true)))
      child.on('close', code => {
        const line = output.split(/\r?\n/).find(text => text.startsWith('XC_INSTALL_RESULT:'))
        let result
        try { result = JSON.parse(line.slice('XC_INSTALL_RESULT:'.length)) } catch (_) {}
        if (code === 0 && result && result.ok) { resolve(result); return }
        const safeCode = result && /^[a-z0-9-]+$/.test(result.code) ? result.code : 'installer-failed'
        log('失败：' + safeCode + (errorOutput ? '（安装器返回错误）' : ''))
        reject(installError(safeCode, result && result.restored))
      })
    })
  }
  async function waitOtherProcess() {
    const until = Date.now() + 60000
    while (fs.existsSync(lock)) {
      try { const fd = fs.openSync(lock, 'r+'); fs.closeSync(fd); return }
      catch (error) { if (error.code === 'ENOENT') return }
      if (Date.now() >= until) throw installError('install-busy', true)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  async function whenIdle() {
    if (active) { try { await active } catch (_) {} }
    await waitOtherProcess()
    if (fs.existsSync(journal)) {
      if (!recovering) recovering = invoke(['-RecoverOnly']).finally(() => { recovering = null })
      await recovering
    }
  }
  const api = Object.freeze({
    isInstalling: () => !!(active || recovering),
    whenIdle,
    install(archive, expectedVersion) {
      if (active) return activeVersion === expectedVersion ? active : Promise.reject(installError('install-busy', true))
      activeVersion = expectedVersion
      active = (async () => {
        if (recovering) await recovering
        await waitOtherProcess()
        log('开始安装 ' + expectedVersion)
        const result = await invoke(['-ArchivePath', path.resolve(archive), '-ExpectedVersion', expectedVersion])
        log('安装完成 ' + result.version)
        return result
      })().finally(() => { active = null; activeVersion = null })
      return active
    }
  })
  coordinators.set(key, api)
  return api
}

module.exports = { getInstallCoordinator }
