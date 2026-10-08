// Actual identity scheduler/figureOut/lifecycle methods with a deterministic clock.
// Run: node electron-next/tests/eight-pve-figure-retry.cjs [--source <userscript>]
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const sourceArg = process.argv.indexOf("--source");
assert(sourceArg < 0 || process.argv[sourceArg + 1], "--source requires a path");
const source = fs.readFileSync(sourceArg < 0
  ? path.join(__dirname, "../resources/daxiaochao.user.js") : process.argv[sourceArg + 1], "utf8").replace(/\r\n/g, "\n");
const tables = require("../../doc/彩虹表.js").tables;
const d = key => tables._0x3812.all[key];
const g = key => tables._0x3911.all[key];
function slice(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, "source boundaries: " + start);
  return source.slice(a, b);
}
const schedulerSource = slice("  let eightPveFigureRetryTimer = null;", "  setTimeout(function () {\n    scheduleEightPveFigureOut");
const figureSource = slice('    figureOut(source = "direct", attempt = 0) {', '\n    },\n') + "\n    }";
const resetSource = slice("    reset() {\n      const n = _0x47c207;", "    updateGuoZhanCountrySummary(");
const readySource = slice("        ready(n) {", "        start() {");

function harness() {
  let now = 0, nextId = 0;
  const jobs = new Map(), calls = [], logs = [];
  let behavior = () => ({ retry: true, reason: "seat-ui-not-ready" });
  const context = vm.createContext({
    Date: { now: () => now },
    setTimeout(callback, delay) {
      const id = ++nextId;
      jobs.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout: id => jobs.delete(id),
    XC: { isDebug: true },
    __xcAppendLocalSkinDebugLine: line => logs.push(line),
    _0x47c207: d,
    _0x4efae6: g,
    _0x16b1bc: new Map(),
    _0x20d6a4: { [g(471)]: [] },
    timer: { tasks: {}, clear() {} },
    room: { isDuanXian: false },
    globalState: {},
    Qcard: { init() {} }, Zone: { init() {} },
    game: { end() {}, spellSpace: {} },
    clearSWJGSeatOrder() {}, resetAdvancedFeatureTrial() {},
    logLightRoomContext() {}, domInit() {}, patchSkinBtn() {},
    recGameRecord() {}, scheduleAutoShouQiFallback() {},
    laya: { gamescene: {}, [d(648)]() {}, [g(559)]: { [g(290)]() {} } },
  });
  context.window = context;
  context.laya.figureOut = (source, attempt) => {
    calls.push({ at: now, source, attempt });
    return behavior(source, attempt);
  };
  vm.runInContext(schedulerSource +
    "\nlaya.reset=({" + resetSource + "}).reset;" +
    "\ngame.ready=({" + readySource + "}).ready;" +
    "\nglobalThis.realFigureOut=({" + figureSource + "}).figureOut;", context);
  const run = code => vm.runInContext(code, context);
  return {
    calls, logs, jobs, context, run,
    schedule: name => context.__xcScheduleEightPveFigureOut(name),
    behave: fn => { behavior = fn; },
    advance(ms) {
      const end = now + ms;
      let count = 0;
      while (true) {
        const next = [...jobs].filter(([, job]) => job.at <= end)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        assert(++count < 200, "unbounded timer loop");
        const [id, job] = next;
        jobs.delete(id); now = job.at; job.callback();
      }
      now = end;
    },
    useRealFigureOut() {
      const seats = Array.from({ length: 8 }, (_, i) => ({
        seat: { figure: 0, playerInfo: { ClientId: i + 100 } },
        figureManager: { Figure: 0, repaint() {} }, repaint() {},
      }));
      const controller = {
        TableSetting: { IsChooseFigure: true },
        TabbleSeatInfos: { datum: seats.map(ui => ({ SeatPlayerInfo: { ClientId: String(ui.seat.playerInfo.ClientId) } })) },
      };
      const scene = { seatContainer: { seatUIs: seats }, rightView: { UpdateFigureList() {} } };
      context.controller = controller;
      context.laya.class = () => context.controller;
      context.laya.gamescene = scene;
      behavior = (source, attempt) => context.realFigureOut.call(context.laya, source, attempt);
      return { controller, scene, seats };
    },
  };
}
let passed = 0, failed = 0;
function test(name, callback) {
  try { callback(harness()); passed++; process.stdout.write("PASS " + name + "\n"); }
  catch (error) { failed++; process.stdout.write("FAIL " + name + ": " + error.message + "\n"); }
}

test("one initial attempt plus ten retries at 1s intervals stops at 10s", h => {
  h.schedule("game.start");
  h.advance(999);
  assert.deepEqual(h.calls.map(call => call.at), [0]);
  h.advance(9001);
  assert.deepEqual(h.calls.map(call => call.at), Array.from({ length: 11 }, (_, i) => i * 1000));
  assert.deepEqual(h.calls.map(call => call.attempt), Array.from({ length: 11 }, (_, i) => i));
  assert.equal(h.jobs.size, 0);
  h.advance(10000);
  assert.equal(h.calls.length, 11);
  assert.equal(h.logs.filter(line => line.includes("figure-out:timeout")).length, 1);
});
test("duplicate entry points share the deadline and the exhausted retry budget", h => {
  h.schedule("game.start");
  for (let i = 0; i < 100; i++) {
    h.advance(100);
    h.schedule(i % 2 ? "skills" : "seatUIs");
    assert(h.jobs.size <= 1);
  }
  h.schedule("deal:start"); h.schedule("debug.open.v5"); h.advance(10000);
  assert.deepEqual(h.calls.map(call => call.at), Array.from({ length: 11 }, (_, i) => i * 1000));
});
test("a pending task survives an externally cleared timeout without restarting its count", h => {
  h.schedule("room.ready"); h.advance(400); h.jobs.clear();
  h.schedule("skills"); h.advance(600);
  assert.deepEqual(h.calls.map(call => call.at), [0, 1000]);
  assert.equal(h.calls[1].attempt, 1);
});
test("successful acquisition stops and later hooks do not start another cycle", h => {
  h.behave((source, attempt) => ({ retry: attempt < 2, reason: attempt < 2 ? "seat-ui-not-ready" : "complete" }));
  h.schedule("game.start"); h.advance(2000); h.schedule("skills"); h.advance(12000);
  assert.deepEqual(h.calls.map(call => call.at), [0, 1000, 2000]);
  assert.equal(h.jobs.size, 0);
});
test("explicit skips and deterministic failures stop without being reported as success", h => {
  for (const reason of ["choose-figure-off", "reconnect-game", "figure-write-failed"]) {
    h.run('cancelEightPveFigureOut("test-reset")');
    h.behave(() => ({ retry: false, reason }));
    const result = h.schedule("game.start"); h.advance(11000);
    assert.equal(result.reason, reason);
    assert.equal(h.jobs.size, 0);
  }
  assert.equal(h.calls.length, 3);
});
test("executor exceptions use the same finite retry budget and debug panel", h => {
  h.behave(() => { throw Error("temporarily unavailable"); });
  h.schedule("game.start"); h.advance(20000);
  assert.equal(h.calls.length, 11);
  assert.equal(h.jobs.size, 0);
  assert(h.logs.some(line => line.includes("figureOut-error") && line.includes("temporarily unavailable")));
});
test("laya.reset cancels old callbacks and room.ready grants a fresh game its budget", h => {
  h.schedule("game.start"); h.advance(1000);
  const staleCallback = [...h.jobs.values()][0].callback;
  h.run("laya.reset()"); h.advance(5000);
  assert.equal(h.calls.length, 2);
  assert.equal(h.jobs.size, 0);
  h.run("game.ready([])");
  assert.equal(h.calls.at(-1).attempt, 0);
  const beforeStale = h.calls.length;
  staleCallback();
  assert.equal(h.calls.length, beforeStale);
  assert.equal(h.jobs.size, 1, "stale callback must not clear the new timer");
  h.advance(10000);
  assert.equal(h.calls.length, beforeStale + 10);
});
test("room.ready resets the cycle even when the previous game end does nothing", h => {
  h.schedule("script.bootstrap"); h.advance(10000);
  h.run("game.ready([])"); h.advance(10000);
  assert.equal(h.calls.length, 22);
  assert.equal(h.calls[11].attempt, 0);
});
test("a scene change stops the old timer before it touches the new scene", h => {
  h.schedule("game.start"); h.advance(400); h.context.laya.gamescene = {};
  h.advance(600);
  assert.equal(h.calls.length, 1);
  assert.equal(h.jobs.size, 0);
  h.schedule("seatUIs");
  assert.equal(h.calls.at(-1).attempt, 0);
});
test("a reentrant hook cannot start an extra immediate timer", h => {
  h.behave(() => { h.schedule("skills"); return { retry: true, reason: "seat-ui-not-ready" }; });
  h.schedule("game.start"); h.advance(10000);
  assert.equal(h.calls.length, 11);
  assert.equal(h.jobs.size, 0);
});
test("real figureOut reads late data on retry and preserves already disclosed identity", h => {
  const { controller, seats } = h.useRealFigureOut();
  seats[0].figureManager.Figure = 3;
  h.context.controller = null;
  h.schedule("game.start"); h.advance(1500); h.context.controller = controller;
  h.advance(10500);
  assert.deepEqual(h.calls.map(call => call.at), [0, 1000, 2000]);
  assert.deepEqual(seats.map(ui => ui.figureManager.Figure), [3, 2, 2, 4, 3, 3, 3, 3]);
  assert.equal(h.jobs.size, 0);
});
test("real figureOut retains the PVE and reconnect restrictions", h => {
  const { controller, seats } = h.useRealFigureOut();
  controller.TableSetting.IsChooseFigure = false;
  assert.equal(h.schedule("game.start").reason, "choose-figure-off");
  h.advance(10000); h.run('cancelEightPveFigureOut("new-test-game")');
  controller.TableSetting.IsChooseFigure = true; h.context.room.isDuanXian = true;
  assert.equal(h.schedule("game.start").reason, "reconnect-game");
  h.advance(10000);
  assert(seats.every(ui => ui.figureManager.Figure === 0));
  assert.equal(h.calls.length, 2);
});
test("disabling debug does not disable the retry fallback", h => {
  h.context.XC.isDebug = false;
  h.schedule("game.start"); h.advance(10000);
  assert.equal(h.calls.length, 11);
  assert.deepEqual(h.logs, []);
});

process.stdout.write(`${passed} passed, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
