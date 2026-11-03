// Actual userscript controller, simulated native seat models, DOM and message timing.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../resources/daxiaochao.user.js'), 'utf8');
const begin = source.indexOf('  const aliveCountrySummary = (() => {');
const end = source.indexOf('  const game = new Proxy(', begin);
assert(begin >= 0 && end > begin);
function fixture() {
  const nodes = new Map(), tasks = new Map(), logs = [];
  let serial = 0;
  function node() {
    return { style: {}, children: [], textContent: '',
      get lastElementChild() { return this.children.at(-1); },
      appendChild(child) {
        if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(n => n !== child);
        this.children.push(child); child.parentElement = this; nodes.set(child.id, child);
      }
    };
  }
  const host = node(), result = node(); result.id = 'result'; result.textContent = '原严教/糜竺结果'; host.appendChild(result);
  function seat(Index, Country) {
    return { Index, Country, IsFull: true, IsDead: false, IsHide: false,
      get IsLegalOperable() { return this.IsFull && !this.IsDead && !this.IsHide; }
    };
  }
  const seats = [seat(0, 1), seat(1, 2), seat(2, 2)];
  const context = { Seats: seats, IsCountryWar: false };
  const scene = { seatContainer: { seatUIs: seats.map(seat => ({ seat })) } };
  const env = {
    room: { size: 3, isGuoZhan: false },
    laya: { gamescene: scene, class: name => { assert.equal(name, 'GameContext'); return context; } },
    document: { getElementById: id => nodes.get(id), createElement: node },
    appendLocalSkinDebugLine: (s, force) => { assert.equal(force, false); logs.push(s); },
    setTimeout: (fn, ms) => { const id = ++serial; tasks.set(id, { fn, ms }); return id; },
    clearTimeout: id => tasks.delete(id)
  };
  vm.createContext(env);
  vm.runInContext(source.slice(begin, end) + '\nglobalThis.feature = aliveCountrySummary;', env);
  function tick() { const batch = [...tasks.values()]; tasks.clear(); batch.forEach(t => t.fn()); }
  return { ...env, context, scene, seats, host, result, nodes, tasks, logs, tick, seat,
    text: () => nodes.get('xcAliveCountrySummary')?.textContent };
}
let passed = 0;
function test(name, run) { run(fixture()); process.stdout.write('PASS ' + name + '\n'); passed++; }
test('panel appends once below result without changing existing output', h => {
  h.feature.mount(); h.feature.mount();
  assert.equal(h.host.children.length, 2);
  assert.equal(h.host.lastElementChild.id, 'xcAliveCountrySummary');
  assert.equal(h.result.textContent, '原严教/糜竺结果');
});
test('start waits for callback and counts distinct countries', h => {
  h.feature.start(); assert.equal(h.text(), '场上势力数：—'); h.tick();
  assert.equal(h.text(), '场上势力数：2'); assert.equal(h.tasks.size, 0);
});
test('non-self death waits until model updates and retains surviving faction', h => {
  h.feature.start(); h.tick(); h.feature.onMessage('SmsgGamePlayerDead', 1); h.tick();
  assert.equal(h.text(), '场上势力数：等待数据');
  h.seats[1].IsDead = true; h.tick(); assert.equal(h.text(), '场上势力数：2');
});
test('last member death reduces count', h => {
  h.feature.start(); h.tick(); h.feature.onMessage('SmsgGamePlayerDead', 0);
  h.seats[0].IsDead = true; h.tick(); assert.equal(h.text(), '场上势力数：1');
});
test('multiple pending deaths are coalesced and both must finish', h => {
  h.feature.start(); h.tick();
  h.feature.onMessage('SmsgGamePlayerDead', 1); h.feature.onMessage('SmsgGamePlayerDead', 2);
  assert.equal(h.tasks.size, 1); h.seats[1].IsDead = true; h.tick();
  assert.equal(h.text(), '场上势力数：等待数据');
  h.seats[2].IsDead = true; h.tick(); assert.equal(h.text(), '场上势力数：1');
});
test('unknown country is not counted as a faction and can become ready', h => {
  h.seats[0].Country = 0; h.feature.start(); h.tick(); assert.equal(h.text(), '场上势力数：等待数据');
  h.seats[0].Country = 6; h.tick(); assert.equal(h.text(), '场上势力数：2');
});
test('missing seat delays initial count', h => {
  h.seats[2].IsFull = false; h.feature.start(); h.tick();
  assert.equal(h.text(), '场上势力数：等待数据');
  h.seats[2].IsFull = true; h.tick(); assert.equal(h.text(), '场上势力数：2');
});
test('current changed faction and hidden/dead seats use native model', h => {
  h.feature.start(); h.tick(); h.seats[0].Country = 6;
  h.seats[1].IsHide = true; h.seats[2].IsDead = true;
  h.feature.onMessage('SmsgSetCharacterCountry'); h.tick(); assert.equal(h.text(), '场上势力数：1');
});
test('all dead yields zero', h => {
  h.seats.forEach(s => s.IsDead = true); h.feature.start(); h.tick(); assert.equal(h.text(), '场上势力数：0');
});
test('seat UI fallback deduplicates models', h => {
  delete h.context.Seats; h.scene.seatContainer.seatUIs.push({ seat: h.seats[0] });
  h.feature.start(); h.tick(); assert.equal(h.text(), '场上势力数：2');
});
test('national war is excluded', h => {
  h.context.IsCountryWar = true; h.feature.start(); h.tick();
  assert.equal(h.nodes.get('xcAliveCountrySummary').hidden, true); assert.equal(h.tasks.size, 0);
});
test('stop cancels callbacks including an already queued stale callback', h => {
  h.feature.start(); const old = [...h.tasks.values()][0].fn;
  h.feature.stop(); h.feature.start(); old(); assert.equal(h.tasks.size, 1);
  h.tick(); assert.equal(h.text(), '场上势力数：2');
  h.feature.stop(); assert.equal(h.tasks.size, 0); assert.equal(h.text(), '场上势力数：—');
});
test('scene replacement stops old work', h => {
  h.feature.start(); h.tick(); h.feature.onMessage('SmsgGamePlayerDead', 0);
  h.laya.gamescene = {}; h.tick(); assert.equal(h.text(), '场上势力数：—'); assert.equal(h.tasks.size, 0);
});
test('retry budget is bounded and later model event can recover', h => {
  h.seats[0].Country = 0; h.feature.start();
  for (let i = 0; i < 40; i++) { h.feature.start(); h.tick(); }
  assert.equal(h.tasks.size, 0); assert(h.logs.some(s => s.includes('数据未就绪')));
  h.seats[0].Country = 1; h.feature.onMessage('SmsgGameSetCharacter'); h.tick();
  assert.equal(h.text(), '场上势力数：2');
});
test('panel reconstruction restores last result in new host', h => {
  h.feature.start(); h.tick(); h.nodes.delete('xcAliveCountrySummary'); h.feature.mount();
  assert.equal(h.host.lastElementChild.id, 'xcAliveCountrySummary'); assert.equal(h.text(), '场上势力数：2');
});
// Reachability at the actual lifecycle and message entry points.
assert(source.slice(source.indexOf('        start() {'), source.indexOf('        enter(n, t, e) {')).includes('aliveCountrySummary.start()'));
assert(source.slice(source.indexOf('        end(n) {'), source.indexOf('        ready(n) {')).includes('aliveCountrySummary.stop()'));
assert(source.slice(source.indexOf('  function Exit()'), source.indexOf('  function _0x3e479a()')).includes('aliveCountrySummary.stop()'));
assert(source.slice(source.indexOf('  function addFrame()'), source.indexOf('  function _0x4484c9()')).includes('aliveCountrySummary.mount()'));
assert(source.slice(source.indexOf('  function logic(n)'), source.indexOf('  function _0x1741(')).includes('aliveCountrySummary.onMessage(rn, ln)'));
process.stdout.write(passed + ' controller checks and lifecycle wiring checks passed.\n');
