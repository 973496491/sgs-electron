// Actual userscript controller, decoded UI handlers and daily/game-end entry points.
// Game managers and time are simulated; no account requests are sent.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sourceArg = process.argv.indexOf('--source');
const source = fs.readFileSync(sourceArg < 0 ? path.join(__dirname, '../resources/daxiaochao.user.js') : process.argv[sourceArg + 1], 'utf8').replace(/\r\n/g, '\n');
const tables = require('../../doc/彩虹表.js').tables;
const native = require('./fixtures/auto-task-native-20261121.json');
const jieYueNative = require('./fixtures/jieyue-native-20261121.json');
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
  const jobs = new Map(), events = new Map(), calls = [], logs = [], logCalls = [], controls = new Map();
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
    appendLocalSkinDebugLine: (...args) => { logs.push(args[0]); logCalls.push(args); },
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
  vm.runInContext('laya.caller = ({' + slice('    caller: (() => {', '    class(n, t, e) {') + '}).caller;', context);
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
  return { ...context, context, managers, calls, logs, logCalls, controls, taskData, addTask, advance, setEnabled, daily, jobs, events };
}
function nativeManager(f, lookup = native.methods.lookup) {
  for (const task of f.taskData.values()) task.baseVo.CheckVersionFiltrate = () => false;
  Object.assign(f.context, {
    ori: class {}, Zni: {}, zhi: { I: () => ({
      Z: id => f.taskData.get(id), st: (...args) => f.calls.push(['new-award', ...args]),
    }) },
    e0t: { I: () => ({ D: id => f.taskData.get(id) }) },
    ELt: { I: () => ({ GetTaskById: () => null }) },
    gB: class {}, _B: class {},
  });
  const methods = [lookup, native.methods.serverLookup, native.methods.award, native.methods.refresh];
  if (lookup === native.oldLookup) methods.push(native.oldCacheFallback);
  // Real class constructor.toString() contains all methods; it must not count as a second lookup.
  const proto = vm.runInContext('(class NativeTaskManager { ' + methods.join('\n') + ' }).prototype', f.context);
  const manager = Object.assign(Object.create(proto), f.managers.TaskManager);
  delete manager.GetAllTaskDataByTaskID; delete manager.RequestTaskAward;
  delete manager.getTaskListFromServer;
  manager.allTasks = new Map();
  manager.ct = () => null;
  manager.proxy = { G(message) {
    if ('taskID' in message) f.calls.push(['award', message.taskID, message.selectRewardId, message.count]);
    else f.calls.push(['refresh']);
  } };
  f.managers.TaskManager = manager;
  f.laya.caller.method(manager, 'TaskManager');
  return manager;
}
function jieYueFixture(options = {}) {
  const f = fixture(), proxy = emitter(), tasks = f.managers.TaskManager;
  Object.assign(tasks, emitter());
  const state = {
    open: true, season: { Rewards: 1 }, score: 0, level: 0,
    baseAwards: [], paidAwards: [], rewards: [{ Id: 1, ItemId: 90, FfItemId: 91, Point: 10 }],
    ...options.state,
  };
  const activity = f.managers.ActivityManager;
  Object.assign(f.context, {
    jF: { I: () => ({ GetBarDataById: () => ({ IsOpen: state.open }) }) },
    Nbt: { NEW_JD_JIEYUE: 1 }, hK: { I: () => ({
      CurrentNewSeasonMainVo: state.season, GetNewRewardGroupById: () => state.rewards,
    }) },
    F9t: { I: () => ({ GetGoodsNumByBaseID: () => state.score }) },
    L8t: { NewJunDianScoreId: 11987201 }, aq: { Normal: 1 },
    LOt: { ...jieYueNative.protocols, GetProtocolNameById: id => jieYueNative.protocolNames[id] },
    $ei: { I: () => tasks, REWARD_REP: 'REWARD_REP' }, s0: { HASAWARD: 3, HASTAKE: 2 },
    H2: {}, U2: { CheckIsMentorTask: () => false }, C1: { I: () => ({ GetTaskByTaskId: () => null }) },
  });
  const keys = ['query', 'claimAll', 'claim', 'canAward', 'baseInfo', 'paidInfo', 'baseList', 'paidList', 'level', 'paid'];
  const NativeActivity = vm.runInContext('(class { static NEW_JD_INFO_TAIL=0; static NEW_JD_INFO_SUC="NEW_JD_INFO_SUC";\n' +
    keys.map(key => jieYueNative.methods[key]).join('\n') + '\n})', f.context);
  f.context.chi = NativeActivity; NativeActivity.I = () => activity;
  Object.setPrototypeOf(activity, NativeActivity.prototype);
  Object.assign(activity, emitter(), {
    proxy, newJDLevel: state.level, newJDHaveRewardList: [], newJDHaveRewardList_bp: [],
    newJDTempHaveRewardList: [], newJDTempHaveRewardList_bp: [],
  });
  const deliver = (name, data) => proxy.event(name, { Protocol: { Data: { ProtoObj: data } } });
  proxy.AddEventListener = vm.runInContext('({' + jieYueNative.methods.proxyAddEventListener + '}).AddEventListener', f.context);
  proxy.AddEventListener(170299, activity, activity.clientNewJDInfoNtf);
  proxy.AddEventListener(170306, activity, activity.clientNewJDBpAwardNtf);
  const baseReply = () => deliver('decodeClientNewJDInfoNtf', { jd_level: state.level, awards: state.baseAwards, type: 0 });
  const paidReply = () => deliver('decodeClientNewJDBpAwardNtf', { bp_awards: state.paidAwards, type: 0 });
  proxy.M = (id, data) => {
    f.calls.push([id, data]);
    if (id === 170298) {
      if (options.queryThrows) throw Error('jieyue query failure');
      if (!options.queryTimeout) {
        if (options.syncInfo) { baseReply(); if (!options.noPaid) paidReply(); }
        else {
          f.setTimeout(baseReply, options.baseDelay ?? 20);
          if (!options.noPaid) f.setTimeout(paidReply, options.paidDelay ?? 40);
        }
      }
    } else if (id === 170296) {
      if (options.claimThrows) throw Error('jieyue claim failure');
      state.baseAwards = [1]; if (state.level) state.paidAwards = [1];
    } else assert.fail('unexpected protocol: ' + id);
  };
  const newTaskReceiver = vm.runInContext('({' + jieYueNative.methods.newTaskAwardResult + '})', f.context);
  const oldTaskReceiver = vm.runInContext('({' + jieYueNative.methods.oldTaskAwardResult + '})', f.context);
  const receiver = {
    getOrUpdateOrAddTask: id => f.taskData.get(id), UpTaskState() {}, onUpActivityTitleEvent() {},
    sortTaskVector() {}, nowTakedCount: 1, event: (...args) => tasks.event(...args),
  };
  function deliverTask(id = 1) {
    state.score += 10; f.calls.push(['task-confirmed', id]);
    const task = f.taskData.get(id); task.CanAward = false;
    task.completeTimes = 0; task.baseVo.maxComplete = 1;
    if (options.legacyTask) oldTaskReceiver.TaskAward_Response.call(receiver, { Protocol: { TaskID: id, CompleteTimes: 1 } });
    else newTaskReceiver.onOpCompleteTask.call(receiver, id);
  }
  const award = tasks.RequestTaskAward;
  tasks.RequestTaskAward = (...args) => {
    award(...args);
    if (options.syncTask) deliverTask(args[0]);
    else if (!options.taskTimeout) f.setTimeout(() => deliverTask(args[0]), options.taskDelay ?? 200);
  };
  return Object.assign(f, { proxy, activity, state, deliver, deliverTask, baseReply, paidReply });
}
let passed = 0;
async function test(name, fn) { await fn(); process.stdout.write('ok ' + (++passed) + ' - ' + name + '\n'); }
(async () => {
  await test('节钺令等待真实任务领奖回包，再查询状态并提交一键领奖', async () => {
    const f = jieYueFixture({ taskDelay: 3500 }); f.initButtons();
    const p = f.controls.get('task').onmousedown(); await f.advance(2000);
    f.managers.TaskManager.event('REWARD_REP', 999);
    assert.equal(f.calls.filter(c => c[0] === 170298).length, 0);
    await f.advance(8000); assert.equal(await p, true, f.logs.join('\n'));
    const completed = f.calls.findIndex(c => c[0] === 'task-confirmed');
    const query = f.calls.findIndex(c => c[0] === 170298), claim = f.calls.findIndex(c => c[0] === 170296);
    assert(completed >= 0 && query > completed && claim > query);
    assert.equal(JSON.stringify(f.calls[claim][1]), JSON.stringify({ id: 0, is_bp: false, is_all: true }));
    assert.equal(f.managers.TaskManager.handlers.length, 0);
    assert(f.proxy.handlers.every(h => h.caller === f.activity));
  });
  await test('原生节钺令红点门槛覆盖免费/付费、已领、等级不足、关闭及缺赛季', async () => {
    for (const [state, count] of [
      [{}, 1], [{ baseAwards: [1] }, 0], [{ baseAwards: [1], level: 1 }, 1],
      [{ baseAwards: [1], paidAwards: [1], level: 1 }, 0],
      [{ open: false }, 0], [{ season: null }, 0], [{ rewards: [] }, 0],
      [{ rewards: [{ Id: 1, ItemId: 90, FfItemId: 91, Point: 30 }] }, 0],
    ]) {
      const f = jieYueFixture({ state }); f.initButtons(); const p = f.api.request(true, 'button');
      await f.advance(10000); assert.equal(await p, true, f.logs.join('\n'));
      assert.equal(f.calls.filter(c => c[0] === 170296).length, count, JSON.stringify(state));
    }
  });
  await test('旧原生任务领奖回包同样接通节钺令后续领取', async () => {
    const f = jieYueFixture({ legacyTask: true }); f.initButtons();
    const p = f.api.request(true, 'button'); await f.advance(10000);
    assert.equal(await p, true, f.logs.join('\n'));
    assert.equal(f.calls.filter(c => c[0] === 170296).length, 1);
  });
  await test('付费节钺令等待两类尾包，免费账号允许没有付费包', async () => {
    const f = jieYueFixture({ state: { level: 1 }, paidDelay: 3000 }); f.initButtons();
    const p = f.api.request(true, 'button'); await f.advance(3000);
    assert.equal(f.calls.filter(c => c[0] === 170296).length, 0);
    await f.advance(7000); assert.equal(await p, true);
    assert.equal(f.calls.filter(c => c[0] === 170296).length, 1);
    const free = jieYueFixture({ noPaid: true }); free.initButtons();
    const q = free.api.request(true, 'button'); await free.advance(10000); assert.equal(await q, true);
    assert.equal(free.calls.filter(c => c[0] === 170296).length, 1);
  });
  await test('无普通任务可领及同步回包也能检查节钺令，重复入口合并且已领不重领', async () => {
    const f = jieYueFixture({ syncTask: true, syncInfo: true }); f.initButtons();
    const first = f.api.request(true, 'button'), merged = f.api.request(true, 'game.end');
    assert.equal(first, merged); await f.advance(10000); assert.equal(await first, true);
    const second = f.api.request(true, 'button'); await f.advance(10000); assert.equal(await second, true);
    assert.equal(f.calls.filter(c => c[0] === 'award').length, 1);
    assert.equal(f.calls.filter(c => c[0] === 170298).length, 2);
    assert.equal(f.calls.filter(c => c[0] === 170296).length, 1);
  });
  await test('任务或节钺令状态回包超时不越序领奖，不记每日完成、不自动重放', async () => {
    for (const options of [{ taskTimeout: true }, { queryTimeout: true }, { state: { level: 1 }, noPaid: true }]) {
      const f = jieYueFixture(options); f.initButtons(); f.daily(100); await f.advance(20000);
      assert.equal(f.calls.filter(c => c[0] === 170296).length, 0);
      assert.equal(f.calls.filter(c => c[0] === 170298).length, options.taskTimeout ? 0 : 1);
      assert.equal(f.timer.lastTaskDate, undefined); assert.equal(f.jobs.size, 0);
      assert.equal(f.globalState.autoTaskRunning, false);
      assert.equal(f.managers.TaskManager.handlers.length, 0);
      assert(f.proxy.handlers.every(h => h.caller === f.activity));
    }
  });
  await test('关闭/退出能清理任务及节钺令回包监听，保留原生和其它功能监听', async () => {
    for (const stage of ['tasks', 'info']) for (const exit of [false, true]) {
      const f = jieYueFixture(stage === 'tasks' ? { taskTimeout: true } : { queryTimeout: true });
      const foreign = () => {}; f.managers.TaskManager.on('REWARD_REP', null, foreign);
      f.proxy.on('decodeClientNewJDInfoNtf', null, foreign);
      f.initButtons(); const p = f.api.request(true, 'button'); await f.advance(2500);
      if (exit) f.api.dispose(); else f.setEnabled(false);
      f.baseReply(); f.paidReply(); await f.advance(20000); assert.equal(await p, false);
      assert.equal(f.calls.filter(c => c[0] === 170296).length, 0);
      assert.equal(f.managers.TaskManager.handlers.length, 1);
      assert.equal(f.proxy.handlers.length, 3); assert.equal(f.jobs.size, 0);
    }
  });
  await test('换账号或原生管理器时，旧轮次不领取新上下文的节钺令', async () => {
    for (const change of ['Self', 'ActivityManager']) {
      const f = jieYueFixture({ queryTimeout: true }); f.initButtons();
      const p = f.api.request(true, 'button'); await f.advance(2500);
      f.managers[change] = {}; f.baseReply(); f.paidReply(); await f.advance(10000);
      assert.equal(await p, false); assert.equal(f.calls.filter(c => c[0] === 170296).length, 0);
    }
  });
  await test('节钺令查询/领奖异常隔离，旧军典及任务照常执行，诊断归debug', async () => {
    for (const options of [{ queryThrows: true }, { claimThrows: true }]) {
      const f = jieYueFixture(options); f.initButtons(); const p = f.api.request(true, 'button');
      await f.advance(15000); assert.equal(await p, false);
      assert(f.calls.some(c => c[0] === 'award')); assert(f.calls.some(c => c[0] === 'jd-award'));
      assert(f.logs.some(l => l.includes('step-error') && l.includes('节钺令奖励')));
      assert(f.logCalls.every(args => args[1] === false && args[2] === 'debug'));
      assert(f.proxy.handlers.every(h => h.caller === f.activity));
    }
  });
  await test('节钺令非尾包和无数据通知不能提前领奖', async () => {
    const f = jieYueFixture({ queryTimeout: true, state: { level: 1 } }); f.initButtons();
    const p = f.api.request(true, 'button'); await f.advance(2500);
    f.proxy.event('decodeClientNewJDInfoNtf', { Protocol: {} });
    f.deliver('decodeClientNewJDInfoNtf', { type: 1, jd_level: 1, awards: [] });
    f.deliver('decodeClientNewJDBpAwardNtf', { type: 1, bp_awards: [] });
    await f.advance(1000); assert.equal(f.calls.filter(c => c[0] === 170296).length, 0);
    f.baseReply(); f.paidReply(); await f.advance(6000); assert.equal(await p, true);
    assert.equal(f.calls.filter(c => c[0] === 170296).length, 1);
  });
  await test('已取消轮次的迟到回调不能完成重启后的节钺令等待', async () => {
    const f = jieYueFixture({ queryTimeout: true, state: { level: 1 } }); f.initButtons();
    const old = f.api.request(true, 'button'); await f.advance(2500);
    const stale = f.proxy.handlers.filter(h => h.caller !== f.activity);
    assert.equal(stale.length, 2); f.api.dispose(); assert.equal(await old, false);
    f.api.start(); const fresh = f.api.request(true, 'button'); await f.advance(2500);
    for (const h of stale) h.fn.call(h.caller, { Protocol: { Data: { ProtoObj: { type: 0 } } } });
    await f.advance(1000); assert.equal(f.calls.filter(c => c[0] === 170296).length, 0);
    f.baseReply(); f.paidReply(); await f.advance(6000); assert.equal(await fresh, true);
    assert.equal(f.calls.filter(c => c[0] === 170296).length, 1);
  });
  await test('今天的原生查询改名后，真实caller及按钮仍能领取新任务', async () => {
    const f = fixture(), manager = nativeManager(f);
    f.taskData.get(1).IsNewQusetType = true;
    assert.equal(typeof manager.RequestTaskAward, 'function');
    assert.equal(typeof manager.GetAllTaskDataByTaskID, 'function');
    // allTasks is empty: the task exists only in the native new-quest fallback.
    assert.equal(manager.GetServerTaskDataByTaskID(1), undefined);
    assert.equal(manager.GetAllTaskDataByTaskID(1), f.taskData.get(1));
    assert.equal(f.laya.caller.method(manager, 'TaskManager', 'GetAllTaskDataByTaskID'), 'Z');
    f.initButtons(); const p = f.controls.get('task').onmousedown(); await f.advance(6000);
    assert.equal(await p, true, f.logs.join('\n'));
    assert.deepEqual(f.calls.filter(c => c[0] === 'new-award'), [['new-award', 1, 0, 2]]);
    assert.equal(f.calls.filter(c => c[0] === 'award').length, 0);
  });
  await test('当前原生领奖方法保留旧任务分支和请求参数', async () => {
    const f = fixture(), manager = nativeManager(f);
    manager.allTasks.set(1, f.taskData.get(1));
    f.initButtons(); const p = f.controls.get('task').onmousedown(); await f.advance(6000);
    assert.equal(await p, true, f.logs.join('\n'));
    assert.deepEqual(f.calls.filter(c => c[0] === 'award'), [['award', 1, 0, 2]]);
  });
  await test('旧版查询特征兼容，普通服务端查询不会误当全任务查询', async () => {
    const f = fixture(), manager = nativeManager(f, native.oldLookup);
    assert.equal(typeof manager.GetAllTaskDataByTaskID, 'function');
    assert.equal(manager.GetAllTaskDataByTaskID(1), f.taskData.get(1));
    const incomplete = Object.create({ GetServerTaskDataByTaskID: manager.GetServerTaskDataByTaskID });
    f.laya.caller.method(incomplete, 'TaskManager');
    assert.equal(incomplete.GetAllTaskDataByTaskID, undefined);
  });
  await test('任务查询结构匹配不唯一时拒绝绑定', async () => {
    const f = fixture();
    const proto = vm.runInContext('({' + native.methods.lookup + ',' + native.methods.lookup.replace(/^Z\(/, 'Other(') + '})', f.context);
    const ambiguous = Object.create(proto);
    f.laya.caller.method(ambiguous, 'TaskManager');
    assert.equal(ambiguous.GetAllTaskDataByTaskID, undefined);
  });
  await test('真实自动任务诊断显式归debug，关闭接口打印仍能看见断点', async () => {
    const f = fixture(); delete f.managers.TaskManager.GetAllTaskDataByTaskID;
    f.initButtons(); const p = f.controls.get('task').onmousedown(); await f.advance(6000);
    assert.equal(await p, false);
    const failure = f.logCalls.find(args => args[0].includes('not-ready'));
    assert(failure); assert.match(failure[0], /GetAllTaskDataByTaskID/);
    const channelCode = slice('  function getLocalSkinDebugLogChannel(', '  function getLocalSkinDebugStamp(');
    vm.runInContext(channelCode + '\nglobalThis.channelFor=getLocalSkinDebugLogChannel;', f.context);
    for (const args of f.logCalls) {
      assert.equal(args[1], false); assert.equal(args[2], 'debug');
      assert.equal(f.context.channelFor(args[0], args[2]), 'debug');
    }
  });
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
  await test('废弃月周卡任务永久跳过；新周卡任务在自动月卡开启时让渡', async () => {
    for (const enabled of [true, false]) {
      const f = fixture(); f.globalConfig.autoYueKaSwitch = enabled; f.globalConfig.yuekaRemindSwitch = false;
      for (const id of [58530, 58531, 58538]) f.addTask(id);
      f.initButtons();
      const p = f.api.request(true, 'button'); await f.advance(6000); await p;
      const ids = f.calls.filter(c => c[0] === 'award').map(c => c[1]);
      assert(!ids.includes(58530)); assert(!ids.includes(58531)); assert.equal(ids.includes(58538), !enabled);
    }
  });
  process.stdout.write(passed + ' auto-task checks passed\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
