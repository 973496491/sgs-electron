// Real userscript controller/caller/UI and archived native manager; simulated server/time.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const arg = process.argv.indexOf('--source');
const source = fs.readFileSync(arg < 0 ? path.join(__dirname, '../resources/daxiaochao.user.js') : process.argv[arg + 1], 'utf8').replace(/\r\n/g, '\n');
const tables = require('../../doc/彩虹表.js').tables;
const native = require('./fixtures/new-month-cards-20261110.json');
function slice(a, b) { const i = source.indexOf(a), j = source.indexOf(b, i); assert(i >= 0 && j > i, a); return source.slice(i, j); }
class Emitter {
  constructor() { this._events = {}; }
  on(name, caller, method) { (this._events[name] ??= []).push({ caller, method }); }
  off(name, caller, method) { this._events[name] = (this._events[name] || []).filter(h => h.caller !== caller || h.method !== method); }
  event(name, data) { for (const h of [...(this._events[name] || [])]) h.method.apply(h.caller, Array.isArray(data) ? data : [data]); }
  ClearData() {}
}
function fixture(options = {}) {
  let now = 0, sequence = 0, self = {}, available = true;
  const jobs = new Map(), events = new Map(), calls = [], logs = [], server = new Map();
  const controls = new Map([['autoYueKaSwitch', { checked: true }]]);
  const timer = { get LocalStaticServerTime() { return 1900000000 + Math.floor(now / 1000); } };
  const proxy = new Emitter();
  const emit = (name, data) => proxy.event(name, { Protocol: { Data: { ProtoObj: data } } });
  const later = (fn, delay = 1) => { const id = ++sequence; jobs.set(id, { fn, at: now + delay }); return id; };
  const tasks = { CanAward: true, baseVo: { TaskRewardItem: [] }, CanRewardCount: 1 };
  const taskManager = {
    getTaskListFromServer() { calls.push(['tasks-query']); },
    GetAllTaskDataByTaskID(id) { assert.equal(id, 58538); return tasks; },
    RequestTaskAward(...args) { calls.push(['task', ...args]); tasks.CanAward = false; },
  };
  const context = {
    Promise, Set, Map, JSON, Number, Math,
    lmt: Emitter, HNt: { I: () => timer },
    kNt: { IsStaticSameDay: (a, b) => Math.floor((a + 28800) / 86400) === Math.floor((b + 28800) / 86400) },
    Laya: { Browser: { window: {} } },
    vU: { I: () => ({ GetNewCardByType: type => ({ ID: type, QuestId: 58538, CanOpen: options.open !== false }) }) },
    JH: { I: () => ({ GetBarDataById: () => ({ IsOpen: options.open !== false }) }) },
    vCt: { NEW_PRIVILEGE: 79 }, Y$t: { I: () => ({ D: () => tasks }) },
    oY: { New_Privilege_Type_Weekly: 2, New_Privilege_Type_Monthly: 1 },
    eNt: { CLIENT_NEW_PRIVILEGE_CARD_DATA_REQ: 160118, CLIENT_NEW_PRIVILEGE_CARD_DAILY_REWARD_REQ: 160120 },
    setTimeout: later, clearTimeout: id => jobs.delete(id),
    window: {
      addEventListener(name, fn) { (events.get(name) || (events.set(name, new Set()), events.get(name))).add(fn); },
      removeEventListener(name, fn) { events.get(name)?.delete(fn); },
    },
    document: { getElementById: id => controls.get(id) },
    appendLocalSkinDebugLine: line => logs.push(line),
    globalConfig: { autoYueKaSwitch: true }, _0x46e1d4: { v: true },
  };
  context._0x47c207 = index => tables._0x3812.all[index];
  context._0x41a3d0 = index => tables._0x871b.all[index];
  vm.createContext(context);
  vm.runInContext(native.manager + ';globalThis.NativeManager=N0t;', context);
  const manager = new context.NativeManager();
  Object.defineProperty(manager, 'proxy', { get: () => proxy });
  manager.Ged = { ShowProtocolError: (...args) => calls.push(['native-error', ...args]) };
  for (const [name, method] of [['decodeServerNewPrivilegeCardDataResp', 'onServerNewPrivilegeCardDataResp'], ['decodeServerNewPrivilegeCardDailyRewardResp', 'onServerNewPrivilegeCardDailyRewardResp']]) proxy.on(name, manager, manager[method]);
  // Use actual caller mapping/resolver. No global N0t or class-name shortcut.
  context.laya = {
    class(name) {
      if (name === 'ServerProxy') return available ? proxy : null;
      if (name === 'Self') return self;
      if (name === 'TimerManager') return timer;
      if (name === 'TaskManager') return taskManager;
      return this.caller(name);
    },
  };
  vm.runInContext('laya.caller = ({' + slice('    caller: (() => {', '    class(n, t, e) {') + '}).caller;', context);
  vm.runInContext(slice('  const newMonthCardClient = {', '  async function dummy()') + ';globalThis.api=autoMonthCards;globalThis.client=newMonthCardClient;', context);
  proxy.N = (id, data) => {
    calls.push([id, data]);
    if (id === 160118) {
      if (!options.queryTimeout) later(() => emit('decodeServerNewPrivilegeCardDataResp', { result: options.queryError ? 3 : 1, cards: [...server.values()].map(x => ({ ...x })) }));
    } else {
      assert.equal(id, 160120);
      if (!options.claimTimeout) later(() => {
        if (!options.claimError && !options.stale) server.get(data.card_id).last_daily_reward_time = timer.LocalStaticServerTime;
        emit('decodeServerNewPrivilegeCardDailyRewardResp', { result: options.claimError ? 3 : 1, card_id: data.card_id, rewards: [] });
      });
    }
  };
  for (const id of [1, 2]) server.set(id, { card_id: id, start_time: timer.LocalStaticServerTime - 100, expire_time: timer.LocalStaticServerTime + 1000000, last_daily_reward_time: 0 });
  async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
  async function advance(ms) {
    await flush(); const end = now + ms;
    for (;;) {
      const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at; jobs.delete(next[0]); next[1].fn(); await flush();
    }
    now = end; await flush();
  }
  function off() {
    context.globalConfig.autoYueKaSwitch = false;
    for (const fn of events.get('xc:config-change') || []) fn({ detail: { property: 'autoYueKaSwitch', value: false } });
  }
  function newSession() { self = {}; }
  return { context, manager, proxy, server, calls, logs, jobs, events, timer, tasks, controls, advance, off, newSession,
    api: context.api, setAvailable: value => { available = value; } };
}
let passed = 0;
async function test(name, fn) { await fn(); process.stdout.write('ok ' + (++passed) + ' - ' + name + '\n'); }
(async () => {
  await test('真实协议caller解析原生管理器、保留原开关及退出链', async () => {
    const f = fixture(); assert.equal(f.context.client.manager(), f.manager);
    assert.match(slice('  const _0x408e48 = {', '  function _0x13a41d'), /action: yueka/);
    assert.match(slice('  function Exit()', '    secKillPanel.dispose();'), /autoMonthCards.dispose/);
    assert(!slice('  const newMonthCardClient = {', '  async function dummy()').includes('WelfareManger'));
  });
  await test('先查询再领取1和2，成功回查后确认，不使用商品ID', async () => {
    const f = fixture(), p = f.api.request(); await f.advance(2000); assert.equal(await p, true);
    assert.deepEqual(f.calls.filter(c => typeof c[0] === 'number').map(c => c[0]), [160118, 160120, 160118, 160120, 160118]);
    assert.deepEqual(f.calls.filter(c => c[0] === 160120).map(c => c[1].card_id), [1, 2]);
    assert.equal(f.logs.filter(x => x.includes(' confirmed ')).length, 2);
    assert.equal(f.calls.filter(c => c[0] === 'task').length, 1);
  });
  await test('未激活、过期、已领和未开放均不发卡奖励请求', async () => {
    for (const mode of ['inactive', 'expired', 'claimed', 'closed']) {
      const f = fixture({ open: mode !== 'closed' });
      for (const state of f.server.values()) {
        if (mode === 'inactive') state.start_time = 0;
        if (mode === 'expired') state.expire_time = f.timer.LocalStaticServerTime;
        if (mode === 'claimed') state.last_daily_reward_time = f.timer.LocalStaticServerTime;
      }
      const p = f.api.request(); await f.advance(2000); await p;
      assert.equal(f.calls.filter(c => c[0] === 160120).length, 0, mode);
    }
  });
  await test('多入口与原生数据回调合并；重复当日触发不重复领取', async () => {
    const f = fixture(), p = f.api.request(); assert.equal(f.api.request('card-data'), p);
    await f.advance(2000); await p; const second = f.api.request(); await f.advance(2000); await second;
    assert.equal(f.calls.filter(c => c[0] === 160120).length, 2);
    assert.equal(f.events.get('xc:config-change').size, 1);
    assert.equal(f.manager._events.UPDATE_NEW_PRIVILEGE_CARD_DATA.length, 1);
  });
  await test('管理器晚到恢复；缺失有界停止', async () => {
    const f = fixture(); f.setAvailable(false); const p = f.api.request(); await f.advance(1000);
    assert.equal(f.calls.length, 0); f.setAvailable(true); await f.advance(2000); assert.equal(await p, true);
    const g = fixture(); g.setAvailable(false); const q = g.api.request(); await g.advance(5000); assert.equal(await q, false); assert.equal(g.jobs.size, 0);
  });
  await test('关闭开关取消查询等待和后续领取', async () => {
    const f = fixture({ queryTimeout: true }), p = f.api.request(); await f.advance(0); f.off(); await f.advance(10000);
    assert.equal(await p, false); assert.equal(f.calls.filter(c => c[0] === 160120).length, 0); assert.equal(f.jobs.size, 0);
    assert.equal(f.proxy._events.decodeServerNewPrivilegeCardDataResp.length, 1);
  });
  await test('退出清理自身订阅，保留原生监听；旧回包不继续提交', async () => {
    const f = fixture(), p = f.api.request(); await f.advance(0); f.api.dispose(); await f.advance(2000);
    assert.equal(await p, false); assert.equal(f.calls.filter(c => c[0] === 160120).length, 0);
    assert.equal(f.events.get('xc:config-change').size, 0); assert.equal(f.manager._events.UPDATE_NEW_PRIVILEGE_CARD_DATA.length, 0);
    assert.equal(f.proxy._events.decodeServerNewPrivilegeCardDataResp.length, 1);
  });
  await test('领取超时不重放同日请求，能继续独立卡检查', async () => {
    const f = fixture({ claimTimeout: true }), p = f.api.request(); await f.advance(18000); assert.equal(await p, true);
    const q = f.api.request(); await f.advance(2000); await q;
    assert.equal(f.calls.filter(c => c[0] === 160120).length, 2); assert(f.logs.some(x => x.includes('claim-error')));
  });
  await test('服务端拒绝记录失败，回查后处理下一卡', async () => {
    const f = fixture({ claimError: true }), p = f.api.request(); await f.advance(2000); await p;
    assert.equal(f.calls.filter(c => c[0] === 'native-error').length, 2); assert(!f.logs.some(x => x.includes(' confirmed ')));
  });
  await test('成功回包但状态未更新只记unconfirmed，当日不重复提交', async () => {
    const f = fixture({ stale: true }), p = f.api.request(); await f.advance(2000); await p;
    assert.equal(f.logs.filter(x => x.includes('unconfirmed')).length, 2);
    const q = f.api.request(); await f.advance(2000); await q; assert.equal(f.calls.filter(c => c[0] === 160120).length, 2);
  });
  await test('查询失败或超时不领取', async () => {
    for (const options of [{ queryError: true }, { queryTimeout: true }]) {
      const f = fixture(options), p = f.api.request(); await f.advance(9000); assert.equal(await p, false);
      assert.equal(f.calls.filter(c => c[0] === 160120).length, 0);
    }
  });
  await test('次日原生数据通知重新领取；新账号不继承提交记录', async () => {
    const f = fixture(), p = f.api.request(); await f.advance(2000); await p;
    await f.advance(86400000); f.manager.event('UPDATE_NEW_PRIVILEGE_CARD_DATA'); await f.advance(2000);
    assert.equal(f.calls.filter(c => c[0] === 160120).length, 4);
    f.newSession(); for (const state of f.server.values()) state.last_daily_reward_time = 0;
    const q = f.api.request(); await f.advance(2000); await q; assert.equal(f.calls.filter(c => c[0] === 160120).length, 6);
  });
  await test('等待中更换账号，旧任务不发奖励', async () => {
    const f = fixture(), p = f.api.request(); await f.advance(0); f.newSession(); await f.advance(10000);
    assert.equal(await p, false); assert.equal(f.calls.filter(c => c[0] === 160120).length, 0);
  });
  await test('开关配置写回晚于onchange仍能启动；无权限不执行', async () => {
    const f = fixture(); f.context.globalConfig.autoYueKaSwitch = false;
    const p = f.context.yueka(); f.context.globalConfig.autoYueKaSwitch = true;
    await f.advance(2000); assert.equal(await p, true);
    const g = fixture(); g.context._0x46e1d4.v = false; assert.equal(await g.api.request(), false); assert.equal(g.calls.length, 0);
  });
  await test('未满足周卡任务不提交；任务查询等待中关闭也不提交', async () => {
    const f = fixture(); f.tasks.CanAward = false; const p = f.api.request(); await f.advance(2000); await p;
    assert.equal(f.calls.filter(c => c[0] === 'task').length, 0);
    const g = fixture(), q = g.api.request(); await g.advance(20); g.off(); await g.advance(2000); await q;
    assert.equal(g.calls.filter(c => c[0] === 'task').length, 0);
  });
  process.stdout.write(passed + ' auto-month-card checks passed\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
