// Uses a fresh headless Chromium profile, synthetic credentials and a fake
// webview backed by a real iframe DOM. Never touches the running game or login.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const sourcePath = process.argv.includes('--source') ? process.argv[process.argv.indexOf('--source') + 1] : path.join(__dirname, '../src/renderer/account-picker.js')
const api = require(path.resolve(sourcePath))
const values = new Map([['managerData', 'legacy-untouched']])
let denyWrite = false
const store = api.createStore(() => ({
  getItem: key => values.get(key) ?? null,
  setItem(key, value) { if (denyWrite) throw Error('quota'); values.set(key, value) }
}))
const fixture = [{ id: 'first', alias: 'A', account: 'a', password: ' dummy ' }]
assert.deepEqual(store.read(), { raw: null, accounts: [] })
const revision = store.save(fixture, null)
assert.deepEqual(store.read().accounts, fixture)
assert.throws(() => store.save([], null), /其他窗口/)
denyWrite = true
assert.throws(() => store.save([], revision), /保存失败/)
assert.equal(values.get(api.STORAGE_KEY), revision)
denyWrite = false
assert.throws(() => store.save([...fixture, { ...fixture[0], id: 'second' }], revision), /重复账号/)
assert.throws(() => store.save([{ ...fixture[0], password: '' }], revision), /格式异常/)
assert.throws(() => store.save([{ ...fixture[0], id: '"unsafe' }], revision), /格式异常/)
values.set(api.STORAGE_KEY, '{bad-json')
assert.throws(() => store.read(), /无法解析/)
assert.equal(values.get(api.STORAGE_KEY), '{bad-json')
values.set(api.STORAGE_KEY, '{"version":2,"accounts":[]}')
assert.throws(() => store.read(), /版本异常/)
assert.equal(values.get('managerData'), 'legacy-untouched')
process.stdout.write('PASS storage integrity, conflict, quota, schema and legacy isolation checks\n')

async function browserChecks() {
  const api = window.SGSAccountPicker
  const checks = []
  const check = (value, label) => { if (!value) throw Error(label); checks.push(label) }
  const tick = () => new Promise(resolve => setTimeout(resolve, 0))
  const key = api.STORAGE_KEY
  const data = () => JSON.parse(localStorage.getItem(key)).accounts
  const q = selector => document.querySelector('#sgsAccountPicker ' + selector)
  const all = selector => Array.from(document.querySelectorAll('#sgsAccountPicker ' + selector))
  const click = action => q('[data-action="' + action + '"]').click()
  function input(field, value) {
    const node = q('[data-field="' + field + '"]')
    node.value = value
    node.dispatchEvent(new Event('input', { bubbles: true }))
  }
  function add(alias, account, password) {
    input('add-alias', alias); input('add-account', account); input('add-password', password)
    click('add')
  }
  const frame = document.createElement('iframe')
  frame.hidden = true
  document.body.appendChild(frame)
  const loginDoc = frame.contentDocument
  loginDoc.body.innerHTML = '<form id="SGS_login-form"><input id="SGS_login-account"><input id="SGS_login-password" type="password"><label><input id="SGS_userProto" type="checkbox"></label><button id="SGS_login-btn" disabled class="SGS_loginbtn-disable">登录</button></form>'
  const loginAccount = loginDoc.getElementById('SGS_login-account')
  const loginPassword = loginDoc.getElementById('SGS_login-password')
  let loginClicks = 0, submissions = 0, injected = 0, events = 0, packageId = 1
  let page = { origin: 'https://web.sanguosha.com', pathname: '/login/air/client/h5/index' }
  let reportedURL = page.origin + page.pathname
  loginDoc.getElementById('SGS_login-btn').addEventListener('click', event => { event.preventDefault(); loginClicks++ })
  loginDoc.getElementById('SGS_login-form').addEventListener('submit', event => { event.preventDefault(); submissions++ })
  for (const element of [loginAccount, loginPassword]) for (const type of ['input', 'change']) element.addEventListener(type, () => { events++ })
  const webview = {
    addEventListener() {},
    getURL: () => reportedURL,
    async executeJavaScript(code) {
      injected++
      return new Function('window', 'document', 'Event', 'return ' + code)({ location: page }, loginDoc, frame.contentWindow.Event)
    }
  }
  const picker = api.attach(webview, { document, getPackageId: () => packageId })
  let extraPicker
  function drag(handle, dx, dy, end = 'pointerup') {
    const rect = handle.getBoundingClientRect()
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
    const event = (type, px, py) => new PointerEvent(type, { pointerId: 71, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: px, clientY: py, bubbles: true, cancelable: true })
    handle.dispatchEvent(event('pointerdown', x, y))
    document.dispatchEvent(event('pointermove', x + dx, y + dy))
    document.dispatchEvent(event(end, x + dx, y + dy))
    if (end === 'pointerup') handle.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true, cancelable: true }))
  }
  try {
    localStorage.clear()
    localStorage.setItem('managerData', 'legacy-untouched')
    const launcher = document.getElementById('sgsAccountPickerLauncher')
    const launcherBefore = launcher.getBoundingClientRect()
    drag(launcher, -90, -65)
    const launcherAfter = launcher.getBoundingClientRect()
    check(Math.abs(launcherAfter.left - launcherBefore.left + 90) < 1 && Math.abs(launcherAfter.top - launcherBefore.top + 65) < 1, 'launcher freely follows pointer movement')
    check(!document.getElementById('sgsAccountPicker') && !document.querySelector('.sap-drag-shield'), 'launcher drag suppresses the trailing click and removes the shield')
    launcher.click()
    check(!!q('.sap-dialog'), 'ordinary click still opens the dialog after dragging')
    const dialogBefore = q('.sap-dialog').getBoundingClientRect()
    drag(q('.sap-header'), -40, -60)
    const dialogAfter = q('.sap-dialog').getBoundingClientRect()
    check(Math.abs(dialogAfter.left - dialogBefore.left + 40) < 1 && Math.abs(dialogAfter.top - dialogBefore.top + 60) < 1, 'dialog moves from its title bar')
    check(localStorage.getItem(key) === null, 'dragging never writes account data')
    picker.close(); picker.open()
    check(Math.abs(q('.sap-dialog').getBoundingClientRect().left - dialogAfter.left) < 1, 'dialog position is retained when reopening in the same window')
    drag(q('.sap-header'), 10000, 10000)
    const clamped = q('.sap-dialog').getBoundingClientRect()
    check(clamped.right <= innerWidth && clamped.bottom <= innerHeight, 'dragging cannot lose the dialog outside the viewport')
    click('mode'); await tick()
    check(q('.sap-dialog').getBoundingClientRect().bottom <= innerHeight, 'switching to the taller editor keeps it on screen')
    const editingRect = q('.sap-dialog').getBoundingClientRect()
    drag(q('[data-field="add-account"]'), 45, 35)
    check(Math.abs(q('.sap-dialog').getBoundingClientRect().left - editingRect.left) < 1, 'interacting with editor inputs never drags the dialog')
    drag(q('.sap-header'), -15, -15, 'pointercancel')
    check(!document.querySelector('.sap-drag-shield'), 'pointer cancellation clears the drag shield')
    picker.close()
    check(!document.querySelector('.sap-drag-shield') && !document.getElementById('sgsAccountPicker'), 'closing a dragged dialog cleans up its drag state')
    picker.open()
    check(q('.sap-dialog').parentNode.parentNode === document.body, 'dialog is independent of the login form')
    check(all('.sap-choice').length === 0 && all('.sap-footer button').map(node => node.textContent).join(',') === '编辑,确定', 'empty selection has only Edit and Confirm actions')
    click('confirm'); await tick()
    check(!document.getElementById('sgsAccountPicker') && injected === 0 && loginAccount.value === '', 'empty Confirm closes without filling or submitting')

    picker.open(); picker.open()
    check(document.querySelectorAll('#sgsAccountPicker').length === 1, 'repeated open never duplicates the dialog')
    click('mode')
    check(!q('.sap-add').hidden && q('.sap-footer [data-action="confirm"]').hidden, 'editing has a separate add area and Return action')
    add('主号', 'fixture-a', 'dummy-a')
    add('<img src=x onerror=alert(1)>', 'fixture-b', ' dummy-`-$-"-\\-密 ')
    add('备用', 'fixture-c', 'dummy-c')
    check(data().map(item => item.account).join(',') === 'fixture-c,fixture-b,fixture-a', 'new accounts are prepended and persisted immediately')
    check(q('[data-field="add-account"]').value === '' && all('.sap-edit-row').length === 3, 'successful add clears inputs and refreshes the full list')
    check(all('img').length === 0 && all('.sap-name')[1].textContent.startsWith('<img'), 'alias is text, never HTML')
    check(!q('.sap-list').textContent.includes('dummy-') && q('[data-field="add-password"]').type === 'text', 'add password is plain text while list rows show account labels')
    const firstId = data()[0].id
    q('[data-id="' + firstId + '"] [data-action="down"]').click()
    check(data()[1].id === firstId, 'down arrow persists order')
    q('[data-id="' + firstId + '"] [data-action="up"]').click()
    check(data()[0].id === firstId && q('[data-id="' + firstId + '"] [data-action="up"]').disabled, 'up arrow restores order and boundary is disabled')

    q('[data-id="' + firstId + '"] [data-action="edit"]').click()
    check(q('[data-id="' + firstId + '"] [data-action="edit"]').textContent === '确定' && q('[data-field="edit-password"]').type === 'text', 'Modify becomes Confirm with plain-text password editing')
    input('edit-alias', '已修改')
    q('[data-id="' + firstId + '"] [data-action="down"]').click()
    check(q('[data-field="edit-alias"]').value === '已修改', 'reordering preserves the correct inline draft')
    click('mode')
    check(q('h2').textContent === '编辑账号' && q('.sap-status').dataset.error === 'true', 'Return cannot silently discard an active inline edit')
    input('edit-password', '')
    q('[data-id="' + firstId + '"] [data-action="edit"]').click()
    check(data().find(item => item.id === firstId).password === 'dummy-c' && !!q('[data-field="edit-password"]'), 'empty password cannot overwrite saved credentials')
    input('edit-password', ' changed-pass ')
    input('edit-account', 'fixture-a')
    q('[data-id="' + firstId + '"] [data-action="edit"]').click()
    check(data().find(item => item.id === firstId).account === 'fixture-c', 'editing into a duplicate account is rejected')
    input('edit-account', ' fixture-renamed ')
    q('[data-id="' + firstId + '"] [data-action="edit"]').click()
    check(data().find(item => item.id === firstId).account === 'fixture-renamed' && data().find(item => item.id === firstId).password === ' changed-pass ', 'row Confirm persists changes and preserves password whitespace')
    check(q('[data-id="' + firstId + '"] [data-action="edit"]').textContent === '修改' && !q('[data-field="edit-account"]'), 'row returns from editing to Modify state')
    const lastId = data()[2].id
    q('[data-id="' + lastId + '"] [data-action="delete"]').click()
    check(data().length === 2 && all('.sap-edit-row').length === 2, 'Delete removes exactly that record and refreshes')
    add('重复', 'fixture-b', 'dummy')
    check(data().length === 2 && q('.sap-status').dataset.error === 'true', 'duplicate add does not overwrite or duplicate an account')
    input('add-alias', ''); input('add-account', ''); input('add-password', '')
    click('mode')
    check(all('.sap-choice[aria-checked=true]').length === 1 && q('.sap-choice').getAttribute('aria-checked') === 'true', 'selection defaults to the current first record')
    check(all('input').filter(node => node.getClientRects().length).length === 0 && all('.sap-row-actions,.sap-order').length === 0, 'selection list offers no editing, deleting, sorting or search')
    all('.sap-choice')[1].click()
    check(all('.sap-choice[aria-checked=true]').length === 1 && all('.sap-choice')[1].getAttribute('aria-checked') === 'true', 'clicking a row highlights exactly one selection')
    check(injected === 0 && loginPassword.value === '', 'selecting a row never fills before Confirm')
    click('confirm'); await tick()
    check(!document.getElementById('sgsAccountPicker') && loginAccount.value === 'fixture-renamed' && loginPassword.value === ' changed-pass ', 'Confirm fills the selected reordered record and closes')
    check(events === 4 && loginClicks === 0 && submissions === 0, 'fill dispatches input/change without clicking or submitting login')
    picker.open()
    check(q('.sap-choice').getAttribute('aria-checked') === 'true', 'reopening resets selection to the first account')
    click('confirm'); await tick()
    check(loginPassword.value === ' dummy-`-$-"-\\-密 ', 'quotes, slashes, backticks, Unicode and whitespace survive the injection bridge')

    picker.open()
    const before = injected
    reportedURL = 'https://example.invalid/login/air/client/h5/index'
    click('confirm'); await tick()
    check(injected === before && !!q('.sap-dialog') && q('.sap-status').dataset.error === 'true', 'foreign page blocks fill before any credentials are injected')
    reportedURL = 'https://web.sanguosha.com/login/air/client/h5/index'
    packageId = 3
    click('confirm'); await tick()
    check(injected === before, 'other game platforms cannot receive credentials')
    packageId = 1
    page = { origin: 'https://web.sanguosha.com', pathname: '/220/h5_2/' }
    loginAccount.value = 'unchanged'
    click('confirm'); await tick()
    check(loginAccount.value === 'unchanged' && !!q('.sap-dialog'), 'page-side gate also rejects navigation races')
    page.pathname = '/login/air/client/h5/index'
    loginPassword.id = 'missing-password'
    click('confirm'); await tick()
    check(loginAccount.value === 'unchanged', 'missing login controls cause no partial fill')
    loginPassword.id = 'SGS_login-password'
    picker.close()

    picker.open()
    const stale = injected
    const changed = data().slice().reverse()
    localStorage.setItem(key, JSON.stringify({ version: 1, accounts: changed }))
    click('confirm'); await tick()
    check(injected === stale && q('.sap-status').textContent.includes('其他窗口'), 'stale selection never fills after another window changes the list')
    picker.close()
    localStorage.setItem(key, '{broken')
    picker.open()
    check(q('[data-action="mode"]').disabled && q('[data-action="confirm"]').disabled && localStorage.getItem(key) === '{broken', 'corrupt data disables mutations without resetting stored data')
    picker.close()
    localStorage.setItem(key, JSON.stringify({ version: 1, accounts: changed }))

    const failingStore = api.createStore(() => ({ getItem: k => localStorage.getItem(k), setItem() { throw Error('quota') } }))
    extraPicker = api.createPicker({ document, store: failingStore, fill: async () => {} })
    extraPicker.open(); click('mode')
    const snapshot = localStorage.getItem(key)
    add('失败', 'fixture-failed', 'dummy-failed')
    check(localStorage.getItem(key) === snapshot && all('.sap-edit-row').length === 2 && q('[data-field="add-account"]').value === 'fixture-failed', 'failed save keeps existing data and the unsaved add inputs')
    q('[data-action="delete"]').click()
    check(all('.sap-edit-row').length === 2 && localStorage.getItem(key) === snapshot, 'failed delete keeps the visible record and storage intact')
    extraPicker.close()
    check(localStorage.getItem('managerData') === 'legacy-untouched', 'new feature never reads, imports or overwrites legacy managerData')

    picker.open(); click('mode')
    const deleteId = data()[0].id
    q('[data-id="' + deleteId + '"] [data-action="edit"]').click()
    q('[data-id="' + deleteId + '"] [data-action="delete"]').click()
    check(!q('[data-field="edit-account"]') && all('[data-action="edit"]').every(node => !node.disabled), 'deleting an edited row clears the draft and restores other edit buttons')
    q('[data-action="delete"]').click()
    click('mode')
    const emptyBefore = injected
    click('confirm'); await tick()
    check(!document.getElementById('sgsAccountPicker') && injected === emptyBefore, 'Confirm after deleting the final account only closes')

    // Leave a safe sample of the actual edit UI for the optional screenshot.
    picker.open(); click('mode')
    add('主账号', 'demo-main', 'demo-password')
    add('备用账号', 'demo-backup', 'demo-password')
    q('[data-action="edit"]').click()
    document.getElementById('result').textContent = 'PASS ' + checks.length + ' browser checks: ' + checks.join('; ')
  } catch (error) {
    document.getElementById('result').textContent = 'FAIL ' + error.stack
  }
}

const browserPath = [process.env.ACCOUNT_PICKER_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(candidate => candidate && fs.existsSync(candidate))
assert(browserPath, 'Set ACCOUNT_PICKER_TEST_BROWSER to a Chromium executable')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sgs-account-picker-test-'))
const html = '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#151515;color:#aaa}#result{font-size:10px;white-space:pre-wrap}</style><pre id="result">PENDING</pre><script src="/account-picker.js"></script><script>(' + browserChecks.toString() + ')()</script>'
const server = http.createServer((request, response) => {
  const script = request.url === '/account-picker.js'
  response.writeHead(200, { 'Content-Type': script ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8' })
  response.end(script ? fs.readFileSync(sourcePath, 'utf8') : html)
})
server.listen(0, '127.0.0.1', () => {
  const screenshot = path.join(profile, 'account-picker.png')
  const browser = spawn(browserPath, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--window-size=1100,800', '--dump-dom', '--virtual-time-budget=4000', '--screenshot=' + screenshot, '--user-data-dir=' + profile, 'http://127.0.0.1:' + server.address().port], { windowsHide: true })
  let output = '', diagnostics = ''
  browser.stdout.on('data', data => { output += data })
  browser.stderr.on('data', data => { diagnostics += data })
  const timeout = setTimeout(() => browser.kill(), 30000)
  browser.on('error', error => { diagnostics += error.message })
  browser.on('close', () => {
    clearTimeout(timeout); server.close()
    const result = output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1]
    process.stdout.write((result || diagnostics || 'No browser result') + '\nScreenshot: ' + screenshot + '\n')
    process.exitCode = result?.startsWith('PASS ') ? 0 : 1
  })
})
