const assert = require('node:assert/strict');
const create = require('../src/features/native-skin-link');
const groups = require('../src/features/native-skin-groups')();

// Same shape as OL GeneralSkinManager: per-general buckets returning fresh arrays of
// shared skin VO objects, null when the general has no skins.
function makeManager(skins) {
  const manager = {
    GetGeneralSkinIncludeHide(generalID, a, b, c) {
      const bucket = skins[Number(generalID)];
      return bucket ? bucket.slice() : null;
    }
  };
  return manager;
}
function vo(skinID, generalID) { return { skinID, generalID }; }
function harness(options = {}) {
  const data = new Map();
  const storage = { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v) };
  const manager = options.manager || makeManager({
    389: [vo(38901, 389), vo(38902, 389)],
    528: [vo(52801, 528), vo(52802, 528)],
    1: [vo(101, 1)],
    65534: [vo(6553401, 65534)]
  });
  const timers = [];
  const window = {
    laya: options.laya || (options.noLaya ? undefined : { class: name => (name === 'GeneralSkinManager' ? (options.asClass ? managerClass(manager) : manager) : null) }),
    setTimeout(fn, ms) { timers.push(fn); return timers.length; },
    clearTimeout() {}
  };
  const logs = [];
  const feature = create({ window, document: {}, storage, groups: options.groups || groups,
    log: text => logs.push(text) });
  return { feature, manager, storage, data, logs, timers, window };
}
function managerClass(instance) {
  function Cls() {}
  Cls.I = () => instance;
  return Cls;
}
const ids = list => (list || []).map(item => item.skinID);

// 1. Group table: 吴苋 389 <-> 族吴苋 528, no duplicated general ids.
assert.equal(groups.length, 151);
const wuxian = groups.find(row => row[0] === '吴苋');
assert.deepEqual(wuxian, ['吴苋', 389, 528]);
const seen = new Set();
let duplicates = 0;
for (const row of groups) for (let i = 1; i < row.length; i++) {
  if (seen.has(row[i])) duplicates++;
  seen.add(row[i]);
}
assert.equal(duplicates, 0, 'a general id must belong to a single group');
assert.ok(seen.has(389) && seen.has(528));
assert.ok(seen.has(35) && seen.has(712), '族荀彧 joins 荀彧');

// 2. Wrapping merges the peer buckets and keeps the native VO references.
{
  const { feature, manager } = harness();
  assert.equal(feature.install(), true);
  const merged = manager.GetGeneralSkinIncludeHide(389);
  assert.deepEqual(ids(merged), [38901, 38902, 52801, 52802]);
  // Peer direction is symmetric.
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(528)), [52801, 52802, 38901, 38902]);
  // Ungrouped generals keep the native result untouched.
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(65534)), [6553401]);
  assert.equal(manager.GetGeneralSkinIncludeHide(999999), null);
  assert.deepEqual(feature.status(), { enabled: true, hooked: true, shared: false, groups: 151, generals: seen.size, off: [] });
}

// 3. Native arguments (hide / collect / preset flags) are forwarded to every peer lookup.
{
  const calls = [];
  const manager = { GetGeneralSkinIncludeHide(generalID, a, b, c) { calls.push([generalID, a, b, c]); return [vo(generalID * 10, generalID)]; } };
  const { feature } = harness({ manager });
  feature.install();
  manager.GetGeneralSkinIncludeHide(389, true, false, true);
  assert.deepEqual(calls, [[389, true, false, true], [528, true, false, true]]);
}

// 4. Switching off restores byte-for-byte native behaviour without unwrapping.
{
  const { feature, manager } = harness();
  feature.install();
  assert.equal(feature.setEnabled(false), false);
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(389)), [38901, 38902]);
  assert.equal(feature.setEnabled(true), true);
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(389)), [38901, 38902, 52801, 52802]);
}

// 5. Per-group opt-out by 武将名.
{
  const { feature, manager } = harness();
  feature.install();
  assert.equal(feature.setGroupEnabled('吴苋', false), false);
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(389)), [38901, 38902]);
  assert.equal(feature.setGroupEnabled('吴苋', true), true);
  assert.equal(manager.GetGeneralSkinIncludeHide(389).length, 4);
  assert.equal(feature.diagnose(389).name, '吴苋');
  assert.equal(feature.diagnose(65534), null);
}

// 6. Preferences persist and restore across a reload.
{
  const { feature, storage } = harness();
  feature.install();
  feature.setEnabled(false);
  feature.setGroupEnabled('吴苋', false);
  const saved = JSON.parse(storage.getItem('xcNativeSkinLink.v1'));
  assert.deepEqual(saved, { enabled: false, off: ['吴苋'] });
  const data = new Map([['xcNativeSkinLink.v1', JSON.stringify(saved)]]);
  const reloaded = create({ window: { laya: { class: () => makeManager({ 389: [vo(38901, 389)], 528: [vo(52801, 528)] }) } },
    document: {}, storage: { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v) },
    groups, log: () => {} });
  assert.equal(reloaded.status().enabled, false);
  assert.deepEqual(reloaded.status().off, ['吴苋']);
}

// 7. install() is idempotent, including a second feature instance on the same manager.
{
  const { feature, manager, window } = harness();
  feature.install();
  const once = manager.GetGeneralSkinIncludeHide;
  feature.install();
  assert.equal(manager.GetGeneralSkinIncludeHide, once);
  const second = create({ window, document: {}, storage: { getItem: () => null, setItem: () => {} }, groups, log: () => {} });
  second.install();
  assert.equal(manager.GetGeneralSkinIncludeHide, once, 'second instance reuses the mounted hook');
  assert.equal(second.status().shared, true);
  second.dispose();
  assert.equal(manager.GetGeneralSkinIncludeHide, once, 'shared owner must not unwrap');
}

// 8. dispose() restores the original descriptor and releases the shared slot.
{
  const { feature, manager, window } = harness();
  const original = manager.GetGeneralSkinIncludeHide;
  feature.install();
  assert.notEqual(manager.GetGeneralSkinIncludeHide, original);
  feature.dispose();
  assert.equal(manager.GetGeneralSkinIncludeHide, original);
  assert.equal(window.__xcNativeSkinLinkHook, null);
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(389)), [38901, 38902]);
  feature.dispose(); // double dispose is a no-op
}

// 9. laya.class may return the class; the singleton comes from I().
{
  const { feature, manager } = harness({ asClass: true });
  assert.equal(feature.install(), true);
  assert.equal(manager.GetGeneralSkinIncludeHide(389).length, 4);
}

// 10. Missing laya / manager schedules a bounded retry instead of throwing.
{
  const { feature, timers, window } = harness({ noLaya: true });
  assert.equal(feature.install(), false);
  assert.equal(feature.status().hooked, false);
  assert.ok(timers.length >= 1);
  window.laya = { class: () => makeManager({ 389: [vo(38901, 389)], 528: [vo(52801, 528)] }) };
  timers[0]();
  assert.equal(feature.status().hooked, true);
}

// 11. The panel button is gone: attach() drives the merge, detach() restores native.
{
  const { feature, manager } = harness();
  assert.equal(typeof feature.mount, 'undefined', 'panel button must not exist any more');
  assert.equal(feature.attach(), true);
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(389)), [38901, 38902, 52801, 52802]);
  assert.equal(feature.status().enabled, true);
  feature.detach();
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(389)), [38901, 38902]);
  assert.equal(feature.status().enabled, false);
  assert.equal(feature.status().hooked, false);
}

// 11b. withBucket() keeps per-general buckets separate while the merge stays installed.
{
  const { feature, manager } = harness();
  feature.install();
  assert.deepEqual(ids(feature.withBucket(() => manager.GetGeneralSkinIncludeHide(389))), [38901, 38902]);
  assert.equal(feature.withBucket(() => manager.GetGeneralSkinIncludeHide(528)).length, 2);
  // Nesting restores the merged view afterwards.
  feature.withBucket(() => feature.withBucket(() => null));
  assert.equal(manager.GetGeneralSkinIncludeHide(389).length, 4);
}

// 11c. wrap() patches a sibling method and undo() restores the exact original.
{
  const { feature, manager } = harness();
  const original = manager.GetGeneralSkinIncludeHide;
  manager.GetOnlineSKinList = function (id) { return [vo(Number(id) * 10, Number(id))]; };
  feature.install();
  const seen = [];
  const undo = feature.wrap('GetOnlineSKinList', base => function (id) {
    seen.push(Number(id));
    return base.apply(this, arguments);
  });
  assert.equal(typeof undo, 'function');
  assert.deepEqual(ids(manager.GetOnlineSKinList(389)), [3890]);
  assert.deepEqual(seen, [389]);
  // Wrapping twice is idempotent.
  assert.equal(feature.wrap('GetOnlineSKinList', base => base), undo);
  undo();
  assert.equal(seen.length, 1, 'undo must remove the wrapper');
  assert.equal(manager.GetOnlineSKinList(389)[0].skinID, 3890);
  assert.equal(typeof feature.getHolder, 'function');
  assert.ok(feature.getHolder());
}

// 12. A group whose peer has no skins keeps the native array (no empty merge).
{
  const manager = makeManager({ 389: [vo(38901, 389)], 528: [] });
  const { feature } = harness({ manager });
  feature.install();
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(389)), [38901]);
  // The empty side still borrows the peer's skins; only a fully ungrouped id stays null.
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(528)), [38901]);
  assert.equal(manager.GetGeneralSkinIncludeHide(65534), null);
}

// 13. probe reports a cross-version pick that stuck (389 wearing a 528 skin).
{
  const worn = { SkinID: 52801, GeneralID: 528, SkinName: '锦虎骧乐*族吴苋' };
  const manager = Object.assign(makeManager({ 389: [vo(38901, 389)], 528: [vo(52801, 528)] }), {
    GetSelfUsingSkinID: id => (Number(id) === 389 ? 52801 : 0),
    GetGeneralSkinBySkinID: skinID => (Number(skinID) === 52801 ? worn : null),
    GetSkinListBySkinID: skinID => (Number(skinID) === 52801 ? [worn] : [])
  });
  const { feature, window: win } = harness({ manager });
  feature.install();
  const info = feature.probe(389);
  assert.equal(info.generalID, 389);
  assert.equal(info.group, '吴苋');
  assert.equal(info.using, 52801);
  assert.equal(info.skinOwner, 528);
  assert.equal(info.skinName, '锦虎骧乐*族吴苋');
  assert.equal(info.owned, 1);
  assert.equal(info.crossVersion, true);
  assert.match(info.verdict, /已生效/);
  // The console helper must be reachable from the page scope.
  assert.equal(win.__xcNativeSkinLinkProbe, feature.probe);
}

// 14. probe flags the rollback case: server rewrote the slot back to a native skin.
{
  const manager = Object.assign(makeManager({ 389: [vo(38901, 389)] }), {
    GetSelfUsingSkinID: () => 38901,
    GetGeneralSkinBySkinID: skinID => (Number(skinID) === 38901 ? { SkinID: 38901, GeneralID: 389 } : null),
    GetSkinListBySkinID: () => [{ SkinID: 38901, GeneralID: 389 }]
  });
  const { feature } = harness({ manager });
  feature.install();
  const info = feature.probe(389);
  assert.equal(info.using, 38901);
  assert.equal(info.crossVersion, false);
  assert.match(info.verdict, /同版本/);

  // Never-used slot: nothing recorded at all.
  const empty = Object.assign(makeManager({}), {
    GetSelfUsingSkinID: () => 0,
    GetGeneralSkinBySkinID: () => null,
    GetSkinListBySkinID: () => null
  });
  const second = harness({ manager: empty });
  assert.deepEqual(second.feature.probe(389), {
    generalID: 389, group: '吴苋', using: 0, skinOwner: null, skinName: null,
    owned: 0, crossVersion: false, verdict: '未记录皮肤（服务端可能已拒绝并回写默认）'
  });
  assert.equal(second.feature.probe(0), null);
}

// 15. laya.class returns the class itself: the hook must land on the prototype so that
//     instances created later (and the singleton) are covered too.
{
  class FakeManager {
    constructor(buckets) { this.buckets = buckets; }
    GetGeneralSkinIncludeHide(generalID) {
      const bucket = this.buckets[Number(generalID)];
      return bucket ? bucket.slice() : null;
    }
  }
  const protoBefore = FakeManager.prototype.GetGeneralSkinIncludeHide;
  const buckets = { 389: [vo(38901, 389)], 528: [vo(52801, 528)] };
  const { feature } = harness({ laya: { class: () => FakeManager } });
  assert.equal(feature.install(), true);

  const first = new FakeManager(buckets);
  assert.deepEqual(ids(first.GetGeneralSkinIncludeHide(389)), [38901, 52801]);
  // A brand-new instance shares the prototype, so it is linked without another install().
  const second = new FakeManager(buckets);
  assert.deepEqual(ids(second.GetGeneralSkinIncludeHide(528)), [52801, 38901]);
  assert.equal(feature.status().hooked, true);

  feature.dispose();
  assert.equal(FakeManager.prototype.GetGeneralSkinIncludeHide, protoBefore, 'prototype restored');
  assert.deepEqual(ids(new FakeManager(buckets).GetGeneralSkinIncludeHide(389)), [38901]);
}

// 16. laya.class returns an instance whose method lives on the prototype: patch the prototype,
//     not the instance, and selfTest must report the merge.
{
  class FakeManager {
    constructor() { this.buckets = { 389: [vo(38901, 389)], 528: [vo(52801, 528)] }; }
    GetGeneralSkinIncludeHide(generalID) {
      const bucket = this.buckets[Number(generalID)];
      return bucket ? bucket.slice() : null;
    }
  }
  const singleton = new FakeManager();
  const { feature } = harness({ laya: { class: () => singleton } });
  feature.install();
  assert.deepEqual(ids(singleton.GetGeneralSkinIncludeHide(389)), [38901, 52801]);
  assert.equal(Object.prototype.hasOwnProperty.call(singleton, 'GetGeneralSkinIncludeHide'), false,
    'instance itself must not be shadowed when the method is inherited');
  const report = feature.selfTest(389);
  assert.equal(report.classShape, 'instance');
  assert.equal(report.hooked, true);
  assert.equal(report.viaPrototype, true);
  assert.equal(report.group, '吴苋');
  assert.equal(report.nativeCount, 1);
  assert.equal(report.mergedCount, 2);
  assert.deepEqual(report.sampleIDs, [38901, 52801]);
  assert.equal(report.verdict, '合并生效');
}

// 17. Registered name unknown: fall back to scanning Laya's class registry.
{
  class HiddenManager {
    constructor() { this.buckets = { 389: [vo(38901, 389)], 528: [vo(52801, 528)] }; }
    GetGeneralSkinIncludeHide(generalID) {
      const bucket = this.buckets[Number(generalID)];
      return bucket ? bucket.slice() : null;
    }
  }
  const laya = { class: () => null };
  const window = { laya, Laya: { ClassUtils: { _classMap: { Something: class {}, Hidden: HiddenManager } } },
    setTimeout: () => 0, clearTimeout: () => {} };
  const feature = create({ window, document: {}, storage: { getItem: () => null, setItem: () => {} },
    groups, log: () => {} });
  assert.equal(feature.install(), true);
  assert.deepEqual(ids(new HiddenManager().GetGeneralSkinIncludeHide(389)), [38901, 52801]);
}

// 18. Name lookup fails but the singleton is reachable from GameGeneralManager.
{
  class GeneralSkinBase {
    GetGeneralSkinIncludeHide(generalID) {
      const bucket = this.buckets[Number(generalID)];
      return bucket ? bucket.slice() : null;
    }
  }
  class SkinManager extends GeneralSkinBase {
    constructor() { super(); this.buckets = { 389: [vo(38901, 389)], 528: [vo(52801, 528)] }; }
  }
  const generalManager = { skinManager: new SkinManager() };
  const laya = { class: name => (name === 'GameGeneralManager' ? generalManager : null) };
  const window = { laya, setTimeout: () => 0, clearTimeout: () => {} };
  const feature = create({ window, document: {}, storage: { getItem: () => null, setItem: () => {} },
    groups, log: () => {} });
  assert.equal(feature.install(), true);
  // The patch must land on the inherited prototype so every instance sees it.
  assert.deepEqual(ids(new SkinManager().GetGeneralSkinIncludeHide(389)), [38901, 52801]);
  assert.equal(Object.prototype.hasOwnProperty.call(generalManager.skinManager, 'GetGeneralSkinIncludeHide'), false);
}

// 19. laya.class hands back the class while the method lives on the parent prototype.
{
  class Base2 { GetGeneralSkinIncludeHide(generalID) { return (this.b && this.b[Number(generalID)]) || null; } }
  class Child2 extends Base2 {
    constructor() { super(); this.b = { 389: [vo(38901, 389)], 528: [vo(52801, 528)] }; }
  }
  const laya = { class: () => Child2 };
  const window = { laya, setTimeout: () => 0, clearTimeout: () => {} };
  const feature = create({ window, document: {}, storage: { getItem: () => null, setItem: () => {} },
    groups, log: () => {} });
  assert.equal(feature.install(), true);
  assert.deepEqual(ids(new Child2().GetGeneralSkinIncludeHide(389)), [38901, 52801]);
  assert.equal(Object.prototype.hasOwnProperty.call(Base2.prototype, 'GetGeneralSkinIncludeHide'), true,
    'the parent prototype must keep the untouched original');
}

// 20. When nothing can be found the report explains every step instead of failing silently.
{
  const laya = { class: () => null };
  const window = { laya, setTimeout: () => 0, clearTimeout: () => {} };
  const feature = create({ window, document: {}, storage: { getItem: () => null, setItem: () => {} },
    groups, log: () => {} });
  assert.equal(feature.install(), false);
  const report = feature.selfTest(389);
  assert.equal(report.hooked, false);
  assert.match(report.lastFail, /laya\.class\(GeneralSkinManager\)=null/);
  assert.match(report.lastFail, /registry=miss/);
  assert.equal(report.verdict.indexOf('未接管'), 0);
  assert.equal(Object.prototype.hasOwnProperty.call(window, '__xcNativeSkinLinkHook'), false);
}

// 21. A read-only prototype method is replaced through defineProperty instead of silently dropped.
{
  class Locked {
    constructor() { this.b = { 389: [vo(38901, 389)], 528: [vo(52801, 528)] }; }
    GetGeneralSkinIncludeHide(generalID) { return this.b[Number(generalID)] || null; }
  }
  Object.defineProperty(Locked.prototype, 'GetGeneralSkinIncludeHide', {
    value: Locked.prototype.GetGeneralSkinIncludeHide,
    writable: false, configurable: true, enumerable: false
  });
  const laya = { class: () => Locked };
  const window = { laya, setTimeout: () => 0, clearTimeout: () => {} };
  const feature = create({ window, document: {}, storage: { getItem: () => null, setItem: () => {} },
    groups, log: () => {} });
  assert.equal(feature.install(), true);
  assert.deepEqual(ids(new Locked().GetGeneralSkinIncludeHide(389)), [38901, 52801]);
}

// 22. Fully locked down: the switch must stay 未接管 and say why rather than pretend to work.
{
  class Sealed {
    constructor() { this.b = { 389: [vo(38901, 389)] }; }
    GetGeneralSkinIncludeHide(generalID) { return this.b[Number(generalID)] || null; }
  }
  Object.defineProperty(Sealed.prototype, 'GetGeneralSkinIncludeHide', {
    value: Sealed.prototype.GetGeneralSkinIncludeHide,
    writable: false, configurable: false, enumerable: false
  });
  const laya = { class: () => Sealed };
  const window = { laya, setTimeout: () => 0, clearTimeout: () => {} };
  const feature = create({ window, document: {}, storage: { getItem: () => null, setItem: () => {} },
    groups, log: () => {} });
  assert.equal(feature.install(), false);
  assert.equal(feature.status().hooked, false);
  assert.match(feature.selfTest(389).lastFail, /不可写/);
}

// 23. The host facade passed in by the script wins over window.laya, which is the engine
// namespace: its class() only registers classes and hands back nothing for a manager name.
{
  const manager = makeManager({ 389: [vo(38901, 389)], 528: [vo(52801, 528)] });
  const facade = { class: name => (name === 'GeneralSkinManager' ? manager : undefined) };
  const window = { laya: { class: () => undefined }, setTimeout: () => 0, clearTimeout: () => {} };
  const feature = create({ window, document: {}, storage: { getItem: () => null, setItem: () => {} },
    laya: facade, groups, log: () => {} });
  assert.equal(feature.install(), true);
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(389)), [38901, 52801]);
  assert.equal(feature.selfTest(389).facade, true);
}

// 24. Hosts that cannot hand the facade object over expose it as __xcLayaFacade.
{
  const manager = makeManager({ 389: [vo(38901, 389)], 528: [vo(52801, 528)] });
  const window = { laya: { class: () => undefined }, setTimeout: () => 0, clearTimeout: () => {},
    __xcLayaFacade: name => (name === 'GeneralSkinManager' ? manager : undefined) };
  const feature = create({ window, document: {}, storage: { getItem: () => null, setItem: () => {} },
    groups, log: () => {} });
  assert.equal(feature.install(), true);
  assert.deepEqual(ids(manager.GetGeneralSkinIncludeHide(389)), [38901, 52801]);
}

console.log('native-skin-link: 24 groups of assertions passed');
