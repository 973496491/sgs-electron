// Actual userscript controller, decoded UI handlers and daily/game-end entry points.
// Game managers and time are simulated; no account requests are sent.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sourceArg = process.argv.indexOf('--source');
const source = fs.readFileSync(sourceArg < 0 ? path.join(__dirname, '../resources/daxiaochao.user.js') : process.argv[sourceArg + 1], 'utf8').replace(/\r\n/g, '\n');
const tables = require('../../doc/彩虹表.js').tables;
function slice(from, to) {
  const a = source.indexOf(from), b = source.indexOf(to, a);
  assert(a >= 0 && b > a, 'source boundary: ' + from);
  return source.slice(a, b);
}
function emitter() {
  const handlers = [];
  return {
    handlers,
    on(name, caller, fn) { handlers.push({ name, caller, fn }); },
    off(name, caller, fn) {
      for (let i = handlers.length - 1; i >= 0; i--)
        if (handlers[i].name === name && handlers[i].caller === caller && handlers[i].fn === fn) handlers.splice(i, 1);
    },
    event(name, value) { return handlers.filter(h => h.name === name).map(h => h.fn.call(h.caller, value)); },
  };
}
function fixture() {
  let now = 0, sequence = 0;
  const jobs = new Map(), events = new Map(), calls = [], logs = [], controls = new Map();
  const taskData = new Map();
  const record = name => (...args) => { calls.push([name, ...args]); };
  const managers = {
    TaskManager: {
      getTaskListFromServer: record('refresh'), GetAllTaskDataByTaskID: id => taskData.get(id),
      RequestTaskAward: record('award'), JdTaskRewardNum: 9,
      HasRewardQuest: level => level === 2, SendGetJdCalcQuestRewardReq: record('jd-task'),
    },
    ActivityManager: {
      GetTaskItemType: () => 1, SendDDZTLLInfoReq: record('ddz-info'),
      GetNewFestivalSignData: id => id === 71 ? { id, awards: [{ date: 20261021 }, { date: 20261020 }] } : null,
      GetFesSignAwdState: award => award.date === 20261021 ? 2 : 0,
      SendNewClientFestivalSignGetRewardReq: record('sign'),
      HasDDZTLLRewardRed: true, SendDDZTLLAwardReq: record('ddz-award'),
      HasJDRewardRed: true, ReqDrawAllJDRwd: record('jd-award'),
    },
    WelfareManger: { GetCardDataByType: () => ({ bActive: false }) },
    NewFuLiManager: { GetPassData: () => ({ HasCanGetReward: () => true }), SendSetOutRewardAllReq: record('welfare') },
    GameGeneralManager: {
      LampRewardCanAward: () => true, LampHasReward: () => false, LampRewardReq: record('lamp'),
      atlasGeneralDict: { _maps: { 11: true, 12: false } }, GeneralAtlasRewardReq: record('atlas'),
    },
  };
  const context = {
    Promise, Set, Map,
    window: {
      addEventListener(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); },
      removeEventListener(name, fn) { if (events.has(name)) events.get(name).delete(fn); },
    },
    document: { getElementById: id => controls.get(id) || null },
    setTimeout(fn, delay) { const id = ++sequence; jobs.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    appendLocalSkinDebugLine: text => logs.push(text),
    globalState: { autoTaskRunning: false }, globalConfig: { autoTaskSwitch: true, yuekaRemindSwitch: true },
    timer: { clear() {} },
    laya: { ged: emitter(), class: name => managers[name], goods: id => ({ CheckHasPropItem: id === 99 }) },
    _0x1e5192: { taskIds: new Set(), seriesList: [1], goodsID: id => ({ name: id === 98 ? '抵价券' : '普通道具' }) },
    _0x46e1d4: { v: true }, _0x1804b1() {},
    drum() {}, wujiang() {}, kanshu() {}, yueka() {}, dummy() {}, openAutoShouQiConfig() {},
    autoSign() {}, closeBaiShengGenerals() {}, reorderCard() {},
  };
  for (const [name, table] of [['_0x41a3d0', '_0x871b'], ['_0x47c207', '_0x3812'], ['_0x4efae6', '_0x3911'], ['J', '_0x497b']]) {
    const values = { ...tables[table].all, ...tables[table].used };
    context[name] = index => { assert(index in values, name + ':' + index); return values[index]; };
  }
  vm.createContext(context);
  if (source.includes('  const autoTasks = (() => {')) {
    vm.runInContext(slice('  const autoTasks = (() => {', '  window.__xcRunEightPveFigureOut') + '\nglobalThis.api = autoTasks;', context);
    vm.runInContext('Object.assign(laya, {' + slice('    task(enabled, source = "TASK_VIP") {', '  };\n  // 自动任务') + '});', context);
  } else {
    // Baseline: real initAllButtons dispatches to an event without a registered receiver.
    context.api = { start() {}, request() { return Promise.resolve(false); } };
  }
  vm.runInContext(slice('  const _0x408e48 = {', '  function _0x1804b1()') + '\nglobalThis.initButtons = initAllButtons;', context);
  for (const id of ['autoTaskSwitch', 'task']) controls.set(id, { id, checked: true, disabled: false, type: 'checkbox' });
  function addTask(id, changes = {}) {
    const task = { id, CanAward: true, CanRewardCount: 2, baseVo: { TaskRewardItem: [] }, ...changes };
    taskData.set(id, task); context._0x1e5192.taskIds.add(id); return task;
  }
  addTask(1);
  async function microtasks() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
  async function advance(ms) {
    const end = now + ms;
    await microtasks();
    for (;;) {
      const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at; jobs.delete(next[0]); next[1].fn(); await microtasks();
    }
    now = end; await microtasks();
  }
  function setEnabled(value) {
    context.globalConfig.autoTaskSwitch = value;
    for (const fn of events.get('xc:config-change') || []) fn({ detail: { property: 'autoTaskSwitch', value } });
  }
  function daily(day) {
    context.day = day;
    // Evaluate the actual conditional block from the secret-info response branch.
    const begin = source.includes('        if (timer[J(420)] !== t)') ? '        if (timer[J(420)] !== t)' : '        timer[J(420)] != t &&';
    const body = slice(begin, '\n      } else if');
    vm.runInContext('{ const t = day; ' + body + ' }', context);
  }
  return { ...context, context, managers, calls, logs, controls, taskData, addTask, advance, setEnabled, daily, jobs, events };
}
let passed = 0;
async function test(name, fn) { await fn(); process.stdout.write('ok ' + (++passed) + ' - ' + name + '\n'); }
(async () => {
  await test('真实面板初始化接通 TASK_VIP，重复初始化只保留一份监听', async () => {
    const f = fixture(); f.initButtons(); f.initButtons();
    assert.equal(f.laya.ged.handlers.filter(h => h.name === 'TASK_VIP').length, 1);
    assert.equal(f.events.get('xc:config-change').size, 1);
    const pending = f.laya.ged.event('TASK_VIP', true)[0]; await f.advance(6000);
    assert.equal(await pending, true); assert.equal(f.calls.filter(c => c[0] === 'refresh').length, 1);
    assert.equal(f.globalState.autoTaskRunning, false);
  });
  await test('真实手动按钮在自动开关关闭时仍可领取；开关动作也能启动', async () => {
    const f = fixture(); f.initButtons(); f.setEnabled(false);
    const pending = f.controls.get('task').onmousedown(); await f.advance(6000); assert.equal(await pending, true);
    f.controls.get('autoTaskSwitch').onchange(); f.setEnabled(true); await f.advance(6000);
    assert.equal(f.calls.filter(c => c[0] === 'refresh').length, 2);
  });
  await test('laya.task 兼容入口和多入口合并，不重复发请求', async () => {
    const f = fixture(); f.initButtons();
    const first = f.laya.task(true); const second = f.api.request(true, 'game.end');
    assert.equal(first, second); await f.advance(6000); assert.equal(await first, true);
    assert.equal(f.calls.filter(c => c[0] === 'award').length, 1);
    assert.equal(await f.laya.task(false), false);
  });
  await test('奖励筛选保留自选、抵价券、道具弹窗、月卡、84800排除', async () => {
    const f = fixture();
    f.addTask(2, { CanAward: false }); f.addTask(3, { baseVo: { HaveSelectReward: true } });
    f.addTask(4, { baseVo: { TaskRewardItem: [{ ItemID: 99 }] } });
    f.addTask(5, { baseVo: { TaskRewardItem: [{ ItemID: 98 }] } });
    f.addTask(6); f.addTask(7); f.addTask(84800); f.addTask(58530); f.addTask(58531);
    f.managers.ActivityManager.GetTaskItemType = id => id === 6 ? 2 : id === 7 ? undefined : 1;
    f.initButtons(); f.api.request(true); await f.advance(6000);
    assert.deepEqual(f.calls.filter(c => c[0] === 'award'), [['award', 1, 0, 2]]);
    assert.deepEqual(f.calls.filter(c => c[0] === 'jd-task'), [['jd-task', 1], ['jd-task', 3]]);
    assert.deepEqual(f.calls.filter(c => c[0] === 'sign'), [['sign', 71, 20261021]]);
  });
  await test('管理器晚到在有界等待内恢复，等待阶段不发奖励', async () => {
    const f = fixture(), tasks = f.managers.TaskManager; delete f.managers.TaskManager;
    f.initButtons(); const pending = f.api.request(true); await f.advance(1500); assert.equal(f.calls.length, 0);
    f.managers.TaskManager = tasks; await f.advance(6500); assert.equal(await pending, true);
  });
  await test('缺失管理器等待耗尽后释放状态、记录原因，不记每日完成', async () => {
    const f = fixture(); delete f.managers.ActivityManager; f.daily(100); await f.advance(10000);
    assert.equal(f.timer.lastTaskDate, undefined); assert.equal(f.jobs.size, 0);
    assert(f.logs.some(l => l.includes('not-ready'))); assert.equal(f.globalState.autoTaskRunning, false);
  });
  await test('单项领取异常不阻断后续任务；可选福利缺失不阻断主链', async () => {
    const f = fixture(); delete f.managers.NewFuLiManager;
    f.addTask(2); f.managers.TaskManager.RequestTaskAward = id => { if (id === 1) throw Error('fixture failure'); f.calls.push(['award', id]); };
    f.initButtons(); const pending = f.api.request(true); await f.advance(6000);
    assert.equal(await pending, false); assert(f.calls.some(c => c[0] === 'award' && c[1] === 2));
    assert(f.calls.some(c => c[0] === 'jd-award')); assert(f.logs.some(l => l.includes('NewFuLiManager')));
  });
  await test('关闭开关取消延迟领取、释放标志、不写每日完成', async () => {
    const f = fixture(); f.daily(100); await f.advance(1000); const count = f.calls.length;
    f.setEnabled(false); await f.advance(10000);
    assert.equal(f.calls.length, count); assert.equal(f.jobs.size, 0); assert.equal(f.globalState.autoTaskRunning, false);
    assert.equal(f.timer.lastTaskDate, undefined);
  });
  await test('退出卸载只移除自身监听，旧回调不能清理新任务', async () => {
    const f = fixture(); const foreign = () => {};
    f.laya.ged.on('TASK_VIP', null, foreign); f.initButtons(); f.api.request(true); await f.advance(0);
    const stale = [...f.jobs.values()][0].fn; f.api.dispose();
    assert.equal(f.laya.ged.handlers.length, 1); assert.equal(f.events.get('xc:config-change').size, 0);
    f.api.start(); const fresh = f.api.request(true); await f.advance(0); stale(); await f.advance(0);
    assert.equal(f.globalState.autoTaskRunning, true); await f.advance(6000); assert.equal(await fresh, true);
  });
  await test('事件总线更换后重新挂载；停止后事件和直接入口不发请求', async () => {
    const f = fixture(); f.initButtons(); const old = f.laya.ged; f.laya.ged = emitter(); f.initButtons();
    assert.equal(old.handlers.length, 0); assert.equal(f.laya.ged.handlers.length, 1);
    f.api.dispose(); assert.equal(await f.api.request(true), false); await f.advance(10000); assert.equal(f.calls.length, 0);
  });
  await test('真实每日入口完成后才记日期，同日合并/去重，次日可再运行', async () => {
    const f = fixture(); f.daily(100); f.daily(100); await f.advance(0); assert.equal(f.timer.lastTaskDate, undefined);
    await f.advance(6000); assert.equal(f.timer.lastTaskDate, 100); f.daily(100); await f.advance(6000);
    assert.equal(f.calls.filter(c => c[0] === 'refresh').length, 1);
    f.daily(101); await f.advance(6000); assert.equal(f.timer.lastTaskDate, 101);
    assert.equal(f.calls.filter(c => c[0] === 'refresh').length, 2);
  });
  await test('刷新异常被记录，任务释放，下一次手动调用可以重试', async () => {
    const f = fixture(), refresh = f.managers.TaskManager.getTaskListFromServer;
    f.managers.TaskManager.getTaskListFromServer = () => { throw Error('refresh failure'); };
    f.initButtons(); const failed = f.api.request(true); await f.advance(0); assert.equal(await failed, false);
    assert.equal(f.globalState.autoTaskRunning, false); assert(f.logs.some(l => l.includes('refresh failure')));
    f.managers.TaskManager.getTaskListFromServer = refresh; const retried = f.api.request(true); await f.advance(6000);
    assert.equal(await retried, true);
  });
  await test('真实对局结束和 Exit 接线均可达', async () => {
    const end = slice('        end(n) {', '        ready(n) {');
    assert(end.includes('autoTasks.request(true, "game.end")'));
    const exit = slice('  function Exit()', '  function _0x3e479a()');
    assert(exit.includes('autoTasks.dispose()'));
  });
  process.stdout.write(passed + ' auto-task checks passed\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
