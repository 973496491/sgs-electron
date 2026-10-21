// Execute the installed host's actual registration block and legacy preload bridge without starting the game.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const host = process.env.XC_CARD_THEME_HOST || 'F:/Game/SGSOL/resources/app';
const userData = path.join(process.env.APPDATA, 'SGSOL');
const main = fs.readFileSync(path.join(host, 'main.js'), 'utf8');
const start = main.indexOf('// Local card-face PNGs'), end = main.indexOf('global.scriptPath', start);
assert(start >= 0 && end > start);
const handlers = new Map(), logs = [];
const ipcMain = { handle(name, handler) { assert(!handlers.has(name)); handlers.set(name, handler); } };
vm.runInNewContext(main.slice(start, end), {
  require, path, ipcMain, app: { getPath(name) { assert.equal(name, 'userData'); return userData; } },
  getXiaochaoInstallCoordinator: () => ({ whenIdle: () => Promise.resolve() }), logMessage: message => logs.push(message),
});
assert.deepEqual(logs, ['[card-theme] local asset bridge ready']);
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(host, 'script/electron_renderer.js'), 'utf8'), {
  window, require(name) { assert.equal(name, 'electron'); return { ipcRenderer: { invoke: (name, relative) => handlers.get(name)({}, relative) } }; },
});
(async () => {
  const api = window.electron.ipcRenderer;
  const manifestResult = await api.invoke('read-card-theme-asset', 'manifest.json');
  assert(manifestResult.ok);
  const data = manifestResult.manifest;
  const files = [].concat(...Object.values(data.faces).map(Object.values), Object.values(data.ranks), Object.values(data.suits)).filter(Boolean);
  for (const file of files) {
    const result = await api.invoke('read-card-theme-asset', file);
    assert(result.ok && result.dataUrl.startsWith('data:image/png;base64,'), file);
  }
  assert.equal((await api.invoke('read-card-theme-asset', '../config.json')).code, 'invalid-asset');
  const expected = fs.readFileSync(path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8').replace(/\r\n/g, '\n');
  const installed = fs.readFileSync(path.join(userData, '三国杀打小抄.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(installed, expected);
  process.stdout.write('PASS installed main registration + legacy preload + 6 assets + script match on ' + process.version + '\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
