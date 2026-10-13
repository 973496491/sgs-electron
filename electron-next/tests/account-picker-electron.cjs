// Real installed Electron startup regression, isolated from the user's app.
// Engine assets are hard-linked into a new sibling directory; source files,
// userData and the local HTTPS protocol fixture are independent copies.
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const runtime = process.argv[2] || 'F:/Game/SGSOL/resources/app'
const withoutPicker = process.argv.includes('--without-picker')
const engine = path.resolve(runtime, '../..')
const probe = fs.mkdtempSync(path.join(path.dirname(engine), 'sgs-account-picker-probe-'))
const appDir = path.join(probe, 'resources/app')
fs.mkdirSync(path.join(appDir, 'script'), { recursive: true })
for (const file of fs.readdirSync(engine, { withFileTypes: true })) {
  if (file.isFile() && (file.name === 'SGSOL.exe' || /\.(dll|pak|dat|bin)$/.test(file.name))) {
    fs.linkSync(path.join(engine, file.name), path.join(probe, file.name))
  }
}
fs.mkdirSync(path.join(probe, 'locales'))
fs.linkSync(path.join(engine, 'locales/en-US.pak'), path.join(probe, 'locales/en-US.pak'))
for (const file of ['electron_frame.js', 'electron_renderer.js', 'account-picker.js']) {
  const override = file === 'account-picker.js' && process.argv[3] && !process.argv[3].startsWith('--') && process.argv[3]
  fs.copyFileSync(override || path.join(runtime, 'script', file), path.join(appDir, 'script', file))
}
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: 'account-picker-probe', version: '1.0.0', main: 'main.js' }))
let html = fs.readFileSync(path.join(runtime, 'index_wd.html'), 'utf8')
if (!html.includes('<script src="./script/account-picker.js"></script>')) throw Error('Runtime host is missing the account picker script tag')
html = html.replace(/<script\b[^>]*\bsrc=["']https?:[^>]*><\/script>/g, '')
if (withoutPicker) html = html.replace('<script src="./script/account-picker.js"></script>', '')
html = html.replace('window.loadElectronFrame();', `window.__probeErrors=[];
window.addEventListener('error',event=>window.__probeErrors.push(String(event.error && event.error.stack || event.message)));
window.loadElectronFrame();`)
fs.writeFileSync(path.join(appDir, 'index.html'), html)
fs.symlinkSync(path.join(runtime, 'res'), path.join(appDir, 'res'), 'junction')

function mainProcess() {
  const { app, BrowserWindow, ipcMain, session } = require('electron')
  const fs = require('fs'), path = require('path')
  const withoutPicker = fs.existsSync(path.join(__dirname, 'without-picker'))
  const result = { electron: process.versions.electron, withoutPicker, errors: [] }
  app.setPath('userData', path.join(__dirname, 'isolated-profile'))
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-background-networking')
  global.PackageId = 1
  global.ChannelId = 0
  global.LoginURL = ['https://web.sanguosha.com/login/air/client/h5/index']
  global.IsTest = false
  global.IsDebug = false
  // Keep unrelated user-script injection pending; this regression only covers
  // actual shell startup, login navigation and the account picker UI.
  ipcMain.handle('read-local-script', () => new Promise(() => {}))
  const finish = () => {
    fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify(result, null, 2))
    app.exit(result.passed ? 0 : 1)
  }
  setTimeout(() => { result.errors.push('Startup timed out'); finish() }, 18000)
  app.whenReady().then(async () => {
    const login = '<!doctype html><meta charset="utf-8"><form id="SGS_login-form"><input id="SGS_login-account"><input id="SGS_login-password" type="password"><label><input id="SGS_login-remember" type="checkbox"></label><label><input id="SGS_userProto" type="checkbox"></label><button id="SGS_login-btn">登录</button></form>'
    await new Promise(resolve => session.defaultSession.protocol.interceptStringProtocol('https', (request, reply) => {
      reply({ mimeType: request.url.startsWith(global.LoginURL[0]) ? 'text/html' : 'application/json', data: request.url.startsWith(global.LoginURL[0]) ? login : '{}' })
    }, resolve))
    const win = new BrowserWindow({ show: false, width: 1100, height: 800, webPreferences: {
      webviewTag: true, nodeIntegration: true, webSecurity: false, contextIsolation: false,
      enableRemoteModule: true, nativeWindowOpen: true, sandbox: true,
      preload: path.join(__dirname, 'script/electron_frame.js')
    } })
    win.webContents.on('preload-error', (_, file, error) => result.errors.push(error.stack || error.message))
    win.webContents.on('console-message', (_, level, message) => { if (level >= 3) result.errors.push(message) })
    await win.loadFile(path.join(__dirname, 'index.html'))
    setTimeout(async () => {
      try {
        result.state = await win.webContents.executeJavaScript(`(async () => {
          const view=document.getElementById('wb'), launcher=document.getElementById('sgsAccountPickerLauncher');
          const state={errors:window.__probeErrors,src:view.getAttribute('src'),messageHandler:!!window.msgList,launcher:!!launcher,launcherHidden:launcher&&launcher.hidden,notice:!!document.getElementById('sgsAccountPickerLoadError')};
          try { state.guest=await view.executeJavaScript('({url:location.href,login:!!document.getElementById("SGS_login-form")})') }
          catch(error) { state.guestError=String(error.message) }
          if(launcher) {
            launcher.click();
            state.pickerOpened=!!document.getElementById('sgsAccountPicker');
            const confirm=document.querySelector('#sgsAccountPicker [data-action="confirm"]');
            if(confirm) confirm.click();
            state.emptyConfirmClosed=!document.getElementById('sgsAccountPicker');
          }
          return state;
        })()`)
        if (!withoutPicker && result.state.launcher && result.state.guest && result.state.guest.login) {
          await win.webContents.executeJavaScript(`window.__probeDragEvents=[];
            for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','click']) document.addEventListener(type,e=>{
              if(window.__probeDragEvents.length<60) window.__probeDragEvents.push({type,id:e.pointerId,detail:e.detail,buttons:e.buttons,x:e.clientX,y:e.clientY,target:e.target.id||e.target.className});
            },true);void 0`)
          const pause = () => new Promise(resolve => setTimeout(resolve, 50))
          async function rect(selector) {
            return win.webContents.executeJavaScript('(() => { const r=document.querySelector(' + JSON.stringify(selector) + ').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height} })()')
          }
          async function drag(selector, dx, dy) {
            const before = await rect(selector)
            const x = Math.round(before.left + before.width / 2), y = Math.round(before.top + before.height / 2)
            win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1, modifiers: ['leftButtonDown'] })
            await pause()
            win.webContents.sendInputEvent({ type: 'mouseMove', x: x + dx, y: y + dy, button: 'left', modifiers: ['leftButtonDown'] })
            await pause()
            win.webContents.sendInputEvent({ type: 'mouseUp', x: x + dx, y: y + dy, button: 'left', clickCount: 1 })
            await pause()
            return before
          }
          const before = await drag('#sgsAccountPickerLauncher', -90, -70)
          const after = await rect('#sgsAccountPickerLauncher')
          result.drag = { launcherMoved: Math.abs(after.left - before.left + 90) < 1 && Math.abs(after.top - before.top + 70) < 1 }
          result.drag.launcherRects = { before, after }
          result.drag.noAccidentalOpen = await win.webContents.executeJavaScript('!document.getElementById("sgsAccountPicker") && !document.querySelector(".sap-drag-shield")')
          result.drag.afterLauncher = await win.webContents.executeJavaScript('({dialog:!!document.getElementById("sgsAccountPicker"),shield:!!document.querySelector(".sap-drag-shield")})')
          const x = Math.round(after.left + after.width / 2), y = Math.round(after.top + after.height / 2)
          win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1, modifiers: ['leftButtonDown'] })
          win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
          await pause()
          result.drag.normalClickOpens = await win.webContents.executeJavaScript('!!document.getElementById("sgsAccountPicker")')
          if (result.drag.normalClickOpens) {
            const dialogBefore = await rect('.sap-dialog')
            await drag('.sap-header', -40, -55)
            const dialogAfter = await rect('.sap-dialog')
            result.drag.dialogMoved = Math.abs(dialogAfter.left - dialogBefore.left + 40) < 1 && Math.abs(dialogAfter.top - dialogBefore.top + 55) < 1
            result.drag.dialogRects = { before: dialogBefore, after: dialogAfter }
            await win.webContents.executeJavaScript('document.querySelector(".sap-close").click();void 0')
          }
          result.drag.events = await win.webContents.executeJavaScript('window.__probeDragEvents')
        }
        result.passed = result.errors.length === 0 && result.state.errors.length === 0 &&
          result.state.messageHandler && result.state.guest && result.state.guest.login &&
          (withoutPicker ? result.state.notice && !result.state.launcher : result.state.launcher && !result.state.launcherHidden && result.state.pickerOpened && result.state.emptyConfirmClosed &&
            result.drag && result.drag.launcherMoved && result.drag.noAccidentalOpen && result.drag.normalClickOpens && result.drag.dialogMoved)
        if (result.passed && result.drag) delete result.drag.events
      } catch (error) { result.errors.push(error.stack || error.message) }
      finish()
    }, 1800)
  }).catch(error => { result.errors.push(error.stack || error.message); finish() })
}
fs.writeFileSync(path.join(appDir, 'main.js'), '(' + mainProcess.toString() + ')()')
if (withoutPicker) fs.writeFileSync(path.join(appDir, 'without-picker'), '')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(path.join(probe, 'SGSOL.exe'), [], { cwd: probe, env, windowsHide: true, stdio: 'ignore' })
const timeout = setTimeout(() => child.kill(), 25000)
child.on('error', error => { process.stderr.write(error.message + '\n'); process.exitCode = 1 })
child.on('close', () => {
  clearTimeout(timeout)
  const report = path.join(appDir, 'result.json')
  const result = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) : { errors: ['No probe result'] }
  process.stdout.write(JSON.stringify(result, null, 2) + '\nProbe: ' + probe + '\n')
  process.exitCode = result.passed ? 0 : 1
})
