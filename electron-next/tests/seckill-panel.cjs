// Real template/controller in Chromium; no game services or purchase requests.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const source = fs.readFileSync(path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('  function D() {'), end = source.indexOf('    ];', start);
const strings = vm.runInNewContext(source.slice(source.indexOf('[', start), end + 5));
const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/';
const standard = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const decode = text => Buffer.from([...text].map(c => alphabet.includes(c) ? standard[alphabet.indexOf(c)] : c).join(''), 'base64').toString('utf8');
const template = strings.filter(x => x.length > 3000).map(decode).find(x => x.includes('id="wallpaperContainer"'));
function slice(a, b) { const i = source.indexOf(a), j = source.indexOf(b, i); assert(i >= 0 && j > i); return source.slice(i, j); }
const controller = slice('  const secKillPanel = (() => {', '  function addFrame() {');
const layout = slice('  function _0x3f649d(', '  const _0x1b7acc =');
assert(slice('  function addFrame() {', '  function _0x4484c9() {').includes('secKillPanel.mount();'));
assert(slice('  function Exit() {', '  function _0x3e479a() {').includes('secKillPanel.dispose();'));
function browserChecks() {
  const results = [];
  const check = (name, fn) => { fn(); results.push(name); };
  const assert = (v, message) => { if (!v) throw Error(message || 'assertion failed'); };
  const toggle = () => document.getElementById('xcSecKillPanelToggle');
  const panel = () => document.getElementById('xcSecKillPanel');
  const change = value => { toggle().checked = value; toggle().dispatchEvent(new Event('change', { bubbles: true })); };
  let genericChanges = 0, stopped = 0;
  document.addEventListener('change', () => genericChanges++);
  const setting = toggle().closest('.setting');
  setting.previousElementSibling.classList.add('active');
  setting.style.maxHeight = setting.scrollHeight + 'px';
  const oldInput = toggle();
  const nativeAdd = oldInput.addEventListener.bind(oldInput), handlers = [];
  oldInput.addEventListener = (type, fn, ...args) => { if (type === 'change') handlers.push(fn); nativeAdd(type, fn, ...args); };
  check('template hides list before initialization', () => assert(panel().hidden && panel().getBoundingClientRect().height === 0));
  secKillPanel.mount(); secKillPanel.mount();
  check('mount is default off and idempotent', () => assert(!toggle().checked && handlers.length === 1));
  check('switch is directly below card beautification', () => {
    const row = document.getElementById('xcSecKillControlRow');
    assert(row.previousElementSibling.contains(document.getElementById('cardThemeContainer')));
    assert(row.getBoundingClientRect().top >= row.previousElementSibling.getBoundingClientRect().bottom);
  });
  const list = document.getElementById('secKillList');
  list.innerHTML = '<label><input type="checkbox" data-seckill="true" checked>active item</label><label><input type="checkbox" data-seckill="true" disabled>locked item</label>';
  list.addEventListener('change', () => stopped++);
  const item = list.querySelector('input');
  check('opening displays original title/list and updates accessibility', () => {
    change(true); assert(!panel().hidden && panel().offsetHeight > 0 && toggle().getAttribute('aria-expanded') === 'true' && panel().getAttribute('aria-hidden') === 'false');
    assert(panel().querySelector('.jie-group-title').textContent === '秒杀连点器');
  });
  check('expanded settings height includes visible list', () => assert(parseFloat(setting.style.maxHeight) >= setting.scrollHeight));
  check('display toggle bypasses generic config and item handlers', () => assert(genericChanges === 0 && stopped === 0));
  check('closing preserves list nodes, checked item and disabled permissions', () => {
    change(false); assert(panel().hidden && panel().offsetHeight === 0 && list.querySelector('input') === item && item.checked && list.querySelector('input[disabled]').disabled);
  });
  check('item changes still bubble through original delegation', () => {
    item.dispatchEvent(new Event('change', { bubbles: true })); assert(stopped === 1 && genericChanges === 1);
  });
  const oldPanel = panel(), stale = handlers[0];
  let rebuiltHandler;
  check('rebuilding controls preserves session visibility and detaches old handler', () => {
    change(true);
    oldInput.replaceWith(oldInput.cloneNode(true)); oldPanel.replaceWith(oldPanel.cloneNode(true));
    const rebuilt = toggle(), add = rebuilt.addEventListener.bind(rebuilt);
    rebuilt.addEventListener = (type, fn, ...args) => { if (type === 'change') rebuiltHandler = fn; add(type, fn, ...args); };
    secKillPanel.mount(); assert(toggle().checked && !panel().hidden);
    oldInput.checked = false; stale({ stopPropagation() {} }); assert(toggle().checked && !panel().hidden);
  });
  check('closing parent stays collapsed during subsequent display updates', () => {
    setting.previousElementSibling.classList.remove('active'); setting.style.maxHeight = '';
    change(false); assert(setting.style.maxHeight === '');
  });
  check('dispose hides region and resets session default', () => { secKillPanel.dispose(); assert(!toggle().checked && panel().hidden); });
  check('late callback stays inert after dispose and remount of same nodes', () => {
    const retired = rebuiltHandler;
    secKillPanel.mount(); toggle().checked = true; retired({ stopPropagation() {} }); assert(panel().hidden);
    change(true); assert(!panel().hidden); secKillPanel.dispose(); secKillPanel.dispose();
  });
  document.getElementById('xcSecKillTestResult').textContent = JSON.stringify(results);
}
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert(browser, 'Chromium browser required');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-seckill-panel-test-'));
const file = path.join(dir, 'test.html');
const html = template.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/url\([^)]*\)/g, 'none').replace(/\bsrc="https?:[^"]*"/g, '');
fs.writeFileSync(file, html + '<pre id="xcSecKillTestResult">PENDING</pre><script>' + controller + layout + 'try{(' + browserChecks.toString() + ')();}catch(e){document.getElementById("xcSecKillTestResult").textContent=JSON.stringify({error:e.stack});}</script>');
const output = execFileSync(browser, ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-background-networking', '--user-data-dir=' + path.join(dir, 'profile'), '--dump-dom', 'file:///' + file.replace(/\\/g, '/')], { encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
fs.writeFileSync(path.join(dir, 'dom.html'), output);
const match = output.match(/<pre id="xcSecKillTestResult">([^<]+)<\/pre>/);
assert(match && match[1] !== 'PENDING', 'Browser verification failed; artifacts: ' + dir);
const results = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
assert(Array.isArray(results), JSON.stringify(results));
for (const name of results) process.stdout.write('PASS ' + name + '\n');
process.stdout.write('Browser artifacts: ' + dir + '\n');
