// Actual identity scheduler/figureOut/lifecycle methods with a deterministic clock.
// Run: node electron-next/tests/eight-pve-figure-retry.cjs [--source <userscript>]
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const native = require("./fixtures/eight-pve-native-figure.cjs");
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
    clearSWJGSeatOrder() {}, resetAdvancedFeatureTrial() {}, closeAutoShouQiDialog() {},
    logLightRoomContext() {}, domInit() {}, patchSkinBtn() {},
    recGameRecord() {}, scheduleAutoShouQiFallback() {},
    laya: { gamescene: {}, [d(648)]() {}, [g(559)]: { [g(290)]() {} } },
    c1t: { IsFigureMode: true, IsViewer: false },
    sJt: { I: () => ({ SystemSets: { DefaultOpenFigure: true } }) },
    XBi: { I: () => ({ RemoveUserOptFigure() {} }) },
  });
  context.window = context;
  context.laya.figureOut = (source, attempt) => {
    calls.push({ at: now, source, attempt });
    return behavior(source, attempt);
  };
  vm.runInContext(schedulerSource +
    "\nlaya.reset=({" + resetSource + "}).reset;" +
    "\ngame.ready=({" + readySource + "}).ready;" +
    "\nglobalThis.realFigureOut=({" + figureSource + "}).figureOut;" +
    "\nglobalThis.NativeFigure=class {" + native.managerMethods + "};" +
    "\nglobalThis.nativeUpdateFigure=({" + native.seatUpdateFigure + "}).updateFigure;", context);
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
        figureManager: Object.assign(new context.NativeFigure(), {
          figureValue: 0, currentFigure: { texture: "figure_0", visible: false },
          getFigureSource: figure => "figure_" + figure,
          setCurrentFigure(texture) { this.currentFigure.texture = texture; },
          layout() {}, repaint() {},
        }), repaint() {},
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
  seats[0].figureManager.SetFigure(3);
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
test("native getter-only managers change the actual icon, not just the backing value", h => {
  const { seats } = h.useRealFigureOut();
  assert.equal(h.schedule("game.start").reason, "complete");
  assert.deepEqual(seats.map(ui => ui.figureManager.currentFigure.texture),
    [1, 2, 2, 4, 3, 3, 3, 3].map(figure => "figure_" + figure));
  assert(seats.every(ui => ui.figureManager.currentFigure.visible));
  assert(seats.every(ui => !Object.hasOwn(ui.figureManager, "Figure")));
});
test("an already readable identity with a stale icon is still rendered", h => {
  const { seats } = h.useRealFigureOut();
  seats[0].figureManager.figureValue = 3;
  assert.equal(h.schedule("game.start").reason, "complete");
  assert.equal(seats[0].figureManager.currentFigure.texture, "figure_3");
  assert.equal(seats[0].seat.figure, 3);
});
test("a disclosed model identity wins over the inferred seat order", h => {
  const { seats } = h.useRealFigureOut();
  seats[0].seat.figure = 3;
  h.schedule("game.start");
  assert.equal(seats[0].figureManager.Figure, 3);
  assert.equal(seats[0].seat.figure, 3);
});
test("native seat updateFigure also refreshes the bottom manager and layout", h => {
  const { seats } = h.useRealFigureOut(), bottom = [], positions = [];
  seats.forEach(ui => Object.assign(ui, {
    updateFigure: h.context.nativeUpdateFigure,
    isShowDDZZgIcon: () => false,
    otherTopManager: { x: 3, y: 6 },
    spPosLayout: (...args) => positions.push(args),
    bottomManager: { SetFigure: figure => bottom.push(figure) },
  }));
  assert.equal(h.schedule("game.start").reason, "complete");
  assert.deepEqual(bottom, [1, 2, 2, 4, 3, 3, 3, 3]);
  assert.deepEqual(positions, seats.map(() => [3, 6]));
});
test("native rendering preserves SubFigure and the self identity preference", h => {
  const { seats } = h.useRealFigureOut();
  seats[0].seat.SubFigure = 9;
  seats[0].figureManager.seat = { IsSelf: true };
  h.context.sJt.I = () => ({ SystemSets: { DefaultOpenFigure: false } });
  h.schedule("game.start");
  assert.equal(seats[0].figureManager.subFigureValue, 9);
  assert.equal(seats[0].figureManager.Figure, 1);
  assert.equal(seats[0].figureManager.currentFigure.texture, "figure_0");
  assert.equal(seats[1].figureManager.currentFigure.texture, "figure_2");
});
test("late data after timeout wakes once without resetting the ten-retry budget", h => {
  const { controller, seats } = h.useRealFigureOut();
  h.context.controller = null;
  h.schedule("room.ready"); h.advance(11000);
  assert.equal(h.calls.length, 11);
  h.context.controller = controller;
  assert.equal(h.schedule("seatUIs").reason, "complete");
  assert.equal(h.calls.at(-1).attempt, 10);
  assert(seats.every(ui => ui.figureManager.currentFigure.visible));
  h.advance(10000); h.schedule("skills");
  assert.equal(h.calls.length, 12);
  assert.equal(h.jobs.size, 0);
});
test("chooseFigure becoming true in the same scene invalidates an early skip", h => {
  const { controller, seats } = h.useRealFigureOut();
  controller.TableSetting.IsChooseFigure = false;
  assert.equal(h.schedule("room.ready").reason, "choose-figure-off");
  h.advance(1500); controller.TableSetting.IsChooseFigure = true;
  assert.equal(h.schedule("game.start").reason, "complete");
  assert(seats.every(ui => ui.figureManager.currentFigure.visible));
});
test("native identity clearing after success is repaired by the next lifecycle event", h => {
  const { seats } = h.useRealFigureOut();
  h.schedule("game.start"); h.advance(1500);
  seats.forEach(ui => { ui.seat.figure = 0; ui.figureManager.SetFigure(0); });
  assert.equal(h.schedule("skills").reason, "complete");
  assert.deepEqual(seats.map(ui => ui.figureManager.Figure), [1, 2, 2, 4, 3, 3, 3, 3]);
  assert.equal(h.calls.length, 2);
  h.advance(10000);
  assert.equal(h.calls.length, 2);
});
test("icon clearing alone invalidates success and repeated hooks share a 1s deadline", h => {
  const { seats } = h.useRealFigureOut();
  h.schedule("game.start"); h.advance(100);
  seats[1].figureManager.currentFigure.visible = false;
  for (let i = 0; i < 8; i++) { h.schedule("skills"); h.advance(100); }
  assert.equal(h.calls.length, 1);
  assert.equal(h.jobs.size, 1);
  h.advance(100);
  assert.deepEqual(h.calls.map(call => call.at), [0, 1000]);
  assert.equal(seats[1].figureManager.currentFigure.visible, true);
  assert.equal(h.jobs.size, 0);
});
test("UI replacement within the same scene invalidates success", h => {
  const original = h.useRealFigureOut();
  h.schedule("game.start"); h.advance(1500);
  const replacement = h.useRealFigureOut();
  original.scene.seatContainer.seatUIs = replacement.seats;
  h.context.controller = original.controller;
  h.context.laya.gamescene = original.scene;
  h.schedule("seatUIs");
  assert(replacement.seats.every(ui => ui.figureManager.currentFigure.visible));
  assert.equal(h.calls.length, 2);
});
test("a native refresh exception retries even if it already wrote Figure", h => {
  const { seats } = h.useRealFigureOut(), manager = seats[1].figureManager;
  manager.SetFigure = function (figure) { this.figureValue = figure; throw Error("texture pending"); };
  assert.equal(h.schedule("game.start").reason, "figure-ui-refresh-failed");
  assert.equal(manager.Figure, 2);
  assert.equal(manager.currentFigure.texture, "figure_0");
  delete manager.SetFigure;
  h.advance(1000);
  assert.equal(manager.currentFigure.texture, "figure_2");
  assert.equal(h.jobs.size, 0);
  assert(h.logs.some(line => line.includes("texture pending")));
});
test("legacy backing writes use UpdateFigureTex and cannot report missing UI as complete", h => {
  const { seats } = h.useRealFigureOut();
  seats.forEach(ui => { ui.figureManager.SetFigure = undefined; });
  seats[1].figureManager.UpdateFigureTex = undefined;
  assert.equal(h.schedule("game.start").reason, "figure-ui-refresh-unavailable");
  assert.equal(seats[0].figureManager.currentFigure.texture, "figure_1");
  delete seats[1].figureManager.UpdateFigureTex;
  h.advance(1000);
  assert.equal(seats[1].figureManager.currentFigure.texture, "figure_2");
  assert.equal(h.jobs.size, 0);
});
test("changed data after timeout gets one attempt, not another timer cycle", h => {
  const { controller } = h.useRealFigureOut();
  h.context.controller = null;
  h.schedule("game.start"); h.advance(11000);
  controller.TabbleSeatInfos.datum.length = 0;
  h.context.controller = controller;
  assert.equal(h.schedule("skills").reason, "seat-info-not-ready");
  assert.equal(h.calls.length, 12);
  h.advance(10000); h.schedule("skills");
  assert.equal(h.calls.length, 12);
  assert.equal(h.jobs.size, 0);
});
test("a skipped task without a scene can recover when a scene arrives", h => {
  const { scene } = h.useRealFigureOut();
  h.context.laya.gamescene = null;
  h.schedule("script.bootstrap"); h.advance(11000);
  h.context.laya.gamescene = scene;
  assert.equal(h.schedule("seatUIs").reason, "complete");
  assert.equal(h.calls.at(-1).attempt, 10);
});
test("disabling debug does not disable the retry fallback", h => {
  h.context.XC.isDebug = false;
  h.schedule("game.start"); h.advance(10000);
  assert.equal(h.calls.length, 11);
  assert.deepEqual(h.logs, []);
});

process.stdout.write(`${passed} passed, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
