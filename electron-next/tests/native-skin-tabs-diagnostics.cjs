const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { harness } = require('./native-skin-tabs.cjs');
const createTabs = require(process.argv[2] || '../src/features/native-skin-tabs');
const skins = { 6: [{ skinID: 601, generalID: 6 }], 107: [{ skinID: 10701, generalID: 107 }] };
function create(options = {}) { return harness({ createTabs, skins, noTimers: true, ...options }); }
function logEvent(h, name) { return h.logs.find(line => line.includes(' ' + name + ' ')); }
let count = 0;

// A real open produces correlated stages and a read-only report of the attached bar.
{
  const h = create({ prepareView: () => true }); h.tabs.attach();
  const { win } = h.open(6, true, 'ChangeSkinWindow');
  const report = h.tabs.diagnose(), page = report.windows[0];
  assert(logEvent(h, '取得选肤窗口')); assert(logEvent(h, '原生开窗进入'));
  assert(logEvent(h, '视图登记完成').includes('"registered":true'));
  assert(logEvent(h, '分页生成').includes('"count":1'));
  assert.equal(page.generalID, 6); assert.equal(page.bar.attached, true);
  assert.equal(page.bar.x, 20); assert.equal(page.bar.y, 46);
  assert.equal(page.bar.visible, true); assert.equal(page.bar.destroyed, false);
  assert(logEvent(h, '原生开窗完成').includes('"windowID":' + page.windowID));
  assert.equal(win.children.filter(node => node.name === 'xcSkinTabs').length, 1); count++;
}

// The actual empty-peer case explains why the bar is absent without turning it into a retry.
{
  const h = create({ skins: { 6: skins[6] } }); h.tabs.attach(); h.open(6, true, 'ChangeSkinWindow');
  assert(logEvent(h, '分页生成').includes('"reason":"peer-empty"'));
  assert.equal(h.tabs.diagnose().windows[0].bar, null); count++;
}

// Record the failing dependency and stack while preserving the native open's behavior.
{
  const h = create({ prepareView() { throw Error('view registration failed'); } }); h.tabs.attach();
  const { win } = h.open(6, true, 'ChangeSkinWindow');
  assert.equal(win.closed, false);
  assert(logEvent(h, '视图登记失败').includes('view registration failed'));
  assert(h.tabs.status().lastError.includes('view registration failed'));
  assert.equal(h.tabs.diagnose().windows[0].bar, null); count++;
}

// A bar removed by another path is reported as detached; diagnostics do not repair or recreate it.
{
  const h = create(); h.tabs.attach(); const { win } = h.open(6, true, 'ChangeSkinWindow');
  const bar = win.children.find(node => node.name === 'xcSkinTabs');
  win.removeChild(bar);
  const before = win.children.length, report = h.tabs.diagnose();
  assert.equal(report.windows[0].bar.attached, false);
  assert.equal(win.children.length, before); count++;
}

// One debug-only animation-frame read catches deferred removal; no interval/mount timer is used.
{
  const h = create(), pending = new Map(); let next = 0;
  h.window.XC = { isDebug: true };
  h.window.requestAnimationFrame = fn => { pending.set(++next, fn); return next; };
  h.window.cancelAnimationFrame = id => pending.delete(id);
  h.tabs.attach(); const { win } = h.open(6, true, 'ChangeSkinWindow');
  const callback = pending.values().next().value; pending.clear();
  win.removeChild(win.children.find(node => node.name === 'xcSkinTabs'));
  callback();
  assert(logEvent(h, '下一帧状态').includes('"attached":false'));
  assert.equal(pending.size, 0);
  win.Close(); assert(logEvent(h, '释放分页').includes('"reason":"view-destroy"')); count++;
}

// Closing cancels the diagnostic callback; a late old callback cannot log a reopened instance.
{
  const h = create(), pending = new Map(); let next = 0;
  h.window.XC = { isDebug: true };
  h.window.requestAnimationFrame = fn => { pending.set(++next, fn); return next; };
  h.window.cancelAnimationFrame = id => pending.delete(id);
  h.tabs.attach(); const first = h.open(6, true, 'ChangeSkinWindow');
  const old = pending.values().next().value;
  first.win.Close(); assert.equal(pending.size, 0);
  h.open(6, true, 'ChangeSkinWindow');
  const before = h.logs.length; old(); assert.equal(h.logs.length, before);
  assert.equal(pending.size, 1); count++;
}

// Missing drawing support is distinguished from missing skin groups and empty peer buckets.
{
  const h = create(); h.window.Laya.Sprite = null; h.tabs.attach(); h.open(6, true, 'ChangeSkinWindow');
  assert(logEvent(h, '分页依赖未满足').includes('"sprite":"object"'));
  assert(!logEvent(h, '分页生成')); count++;
}

// Every new line passes through the real adapter as a typed feature diagnostic.
{
  const source = fs.readFileSync(process.argv[3] || path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8');
  const begin = source.indexOf('  function appendLocalSkinTabDebugLine('), end = source.indexOf('\n  }', begin) + 4;
  const calls = [], adapter = new Function('appendLocalSkinDebugLine',
    source.slice(begin, end) + '; return appendLocalSkinTabDebugLine;')((...args) => calls.push(args));
  const h = create(); h.tabs.attach(); h.open(6, true, 'ChangeSkinWindow');
  h.logs.forEach(adapter);
  assert(calls.length > 0);
  assert(calls.every(([line, force, channel]) => line.startsWith('[皮肤Tab] ') && force === false && channel === 'debug'));
  count++;
}

process.stdout.write('native-skin-tabs-diagnostics: ' + count + ' diagnostic/lifecycle cases passed\n');
