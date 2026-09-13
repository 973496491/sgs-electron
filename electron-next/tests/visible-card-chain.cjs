// Run: node electron-next/tests/visible-card-chain.cjs
// --baseline runs the two regression cases against the original Git HEAD source.
// --source <path> verifies the exact userscript file read by an installed client.
// Actual Card/Zone/logic/mirror functions; only game services and DOM are simulated.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const baseline = process.argv.includes("--baseline");
const sourceArg = process.argv.indexOf("--source");
assert(sourceArg === -1 || (!baseline && process.argv[sourceArg + 1]), "--source requires a path and cannot be combined with --baseline");
const sourcePath = sourceArg === -1 ? path.join(__dirname, "../resources/daxiaochao.user.js") : path.resolve(process.argv[sourceArg + 1]);
const source = baseline
  ? execFileSync("git", ["show", "HEAD:electron-next/resources/daxiaochao.user.js"], { cwd: root, encoding: "utf8", maxBuffer: 8e6 })
  : fs.readFileSync(sourcePath, "utf8");
const tables = require(path.join(root, "doc/彩虹表.js")).tables;
function slice(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, "source boundaries: " + start);
  return source.slice(a, b);
}
const modelSource = slice(source.includes("  // 可见牌诊断") ? "  // 可见牌诊断" : "  const _Card = class n {", "  function mergeGoodsList(");
const logicSource = slice("  function logic(n)", "  function _0x1741(");
const gameStartSource = slice("        start() {", "        enter(n, t, e) {");
const mirrorSource = slice("  function _0x226fc5(", "  function _0xe558(") +
  slice("  function _0x2ae8f3(", "  function _0x2f6cfa(") +
  slice("  function syncZoneMirrors(", "  function clearZoneMirrors(");

function fixture() {
  globalThis.window = globalThis;
  globalThis.logs = [];
  globalThis.oldErrors = [];
  globalThis.XC = { isDebug: true, RAND: 65282 };
  globalThis.__xcAppendLocalSkinDebugLine = (line, force) => {
    if (force !== false) throw Error("diagnostics must respect debug switch");
    logs.push(line);
  };
  globalThis.console = { error: error => oldErrors.push(String(error)), warn() {}, info() {} };
  class Element {
    constructor() {
      this.children = []; this.dataset = {}; this.style = {}; this.className = ""; this.innerHTML = "";
      this.classList = {
        contains: value => this.className.split(/\s+/).includes(value),
        add: value => { if (!this.classList.contains(value)) this.className += " " + value; },
        remove: value => { this.className = this.className.split(/\s+/).filter(x => x !== value).join(" "); },
      };
    }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(x => x !== this);
      this.parentElement = null;
    }
    querySelectorAll(selector) {
      if (selector === ":scope>.shoupai") return this.children.filter(x => x.classList.contains("shoupai"));
      if (selector === "[id]") return this.children.filter(x => x.id);
      throw Error("unexpected DOM selector: " + selector);
    }
    appendChild(child) { child.remove(); child.parentElement = this; this.children.push(child); return child; }
    insertAdjacentElement(where, child) {
      if (where !== "afterbegin") throw Error("unexpected insertion: " + where);
      child.remove(); child.parentElement = this; this.children.unshift(child);
    }
    removeAttribute(name) { delete this[name]; }
    cloneNode() {
      const copy = new Element();
      for (const key of ["id", "className", "innerHTML", "title", "disabled"]) copy[key] = this[key];
      copy.dataset = { ...this.dataset }; copy.style = { ...this.style };
      this.children.forEach(child => copy.appendChild(child.cloneNode(true)));
      return copy;
    }
    get outerHTML() { return this.innerHTML; }
  }
  const elements = new Map();
  for (const id of ["knownCards", "paiduiCards", "qipaiCards", "2", "3", "s2", "s3", "result", "lastUseCard"])
    elements.set(id, Object.assign(new Element(), { id }));
  globalThis.document = { getElementById: id => elements.get(id) || null, createElement: () => new Element() };
  globalThis.elements = elements;
  globalThis.frames = [];
  globalThis.frameErrors = [];
  globalThis.requestAnimationFrame = callback => frames.push(callback);
  globalThis.flush = () => {
    let count = 0;
    while (frames.length) {
      if (++count > 20) throw Error("unbounded animation frame loop");
      const callbacks = frames.splice(0);
      callbacks.forEach(callback => { try { callback(); } catch (error) { frameErrors.push(String(error)); } });
    }
  };
  const allCard = new Proxy({}, { get: (_, id) => ({ id: Number(id), name: id == 7 ? "杀" : "连弩", number: 7, color: 1, type: 1, ncn: String(id) }) });
  globalThis._0x5984e1 = globalThis._0x50e4e7 = allCard;
  globalThis._0x4b1bae = card => String(card.id);
  globalThis._0x20d6a4 = { markSpell: {} };
  globalThis._0x47b943 = { spellDict: {}, cardDict: {} };
  globalThis._0x58eae0 = { userID: 123, v: true };
  globalThis.Qcard = { query: new Set(), name: {}, counter() {}, draw() {} };
  globalThis.room = { myID: 1, mySeats: [1], size: 3, getOrder: seat => seat, getSeatUI: () => null, name: seat => String(seat), dealCard() {} };
  globalThis.game = { turn: 1, round: 1, phase: 4, currentID: 1, isGameStart: true, isPassed: false, spellSpace: {}, record() {} };
  globalThis.globalConfig = { cardLabelSwitch: false };
  globalThis.globalState = { configHandCards: [], configHandCardsRejected: false, autoBotSwitch: 0 };
  globalThis.laya = { mark() {}, init() {} };
  globalThis.timer = { delay() {} };
  globalThis.AddShunJiCardTags = () => {};
  globalThis.logLightRoomDispatch = globalThis.logLightRoomDispatchProbe = () => {};
  globalThis.logEightIdentity = globalThis.scheduleEightPveFigureOut = globalThis.scheduleAutoShouQiFallback = () => {};
  globalThis.resetOrderContainer = globalThis.hideOrderContainer = globalThis.setCardBack = () => {};
  globalThis.drawCard = () => {};
  globalThis._0x537542 = () => {};
  globalThis.drawDeckEdgeUI = () => {};
  globalThis._0x3e4c06 = nodes => nodes.map(node => node.dataset.key).join(",");
  globalThis.DI = 0; globalThis.DING = 65280; globalThis.RAND = 65282;
  globalThis.__publicField = (object, key, value) => { object[key] = value; };
}

function harness() {
  const context = vm.createContext({});
  context._0x4efae6 = key => tables._0x3911.all[key];
  context._0x576026 = key => tables._0x497b.all[key];
  context._0xcbf83c = context._0xe558 = key => tables._0xe558.all[key];
  vm.runInContext("(" + fixture.toString() + ")()", context);
  vm.runInContext("let _c,_d,_e,_f,_g,_h,_i,_0x380c88=[],_0x140c16='';\n" + modelSource + mirrorSource + logicSource +
    "\ngame.start=({" + gameStartSource + "}).start;\n" + `
    globalThis.Card = Card; globalThis.Zone = Zone;
    globalThis.setHand = (seat, ids) => {
      Zone.init([], "2-255");
      Zone.obj["5-" + seat] = ids.map(id => new Card(id, id, "5-" + seat));
      Zone._renderZone("5-" + seat);
    };
    globalThis.move = changes => logic(Object.assign({
      ClassName: "PubGsCMoveCard", CardIDs: [7], CardCount: 1,
      FromID: 1, FromZone: 5, FromPosition: RAND, ToID: 255,
      ToZone: 3, ToPosition: RAND, MoveType: 1, SpellID: 0, isSend: false,
    }, changes));
    globalThis.readKeys = id => document.getElementById(id).querySelectorAll(":scope>.shoupai").map(node => Number(node.dataset.key));
  `, context);
  return {
    context,
    run: code => vm.runInContext(code, context),
    value: code => JSON.parse(vm.runInContext("JSON.stringify(" + code + ")", context)),
  };
}
let failed = 0, passed = 0;
function test(name, run) {
  try { run(harness()); passed++; process.stdout.write("PASS " + name + "\n"); }
  catch (error) { failed++; process.stdout.write("FAIL " + name + ": " + error.message + "\n"); }
}
test("a failed query zone does not drop the later hand/mirror removal", h => {
  h.run('setHand(1,[7]); Qcard.draw=()=>{throw Error("missing query control")}; Zone.draw("unknown"); move(); flush();');
  assert.deepEqual(h.value("Zone.shoupai(1)"), [], "model must remove used card");
  assert.deepEqual(h.value('readKeys("2")'), [], "main panel must remove used card");
  assert.deepEqual(h.value('readKeys("s2")'), [], "seat mirror must remove used card");
  assert.deepEqual(h.value("frameErrors"), [], "other zones must continue after render error");
});
test("missing auxiliary result control does not prevent actual movement", h => {
  h.run('setHand(1,[7,14]); elements.delete("result"); move(); flush();');
  assert.deepEqual(h.value("Zone.shoupai(1)"), [14], "used card must leave hand even without result DOM");
  assert.deepEqual(h.value('readKeys("s2")'), [14]);
  assert.deepEqual(h.value('Zone.obj["3-255"].map(card=>card.id)'), [7]);
});
if (!baseline) {
  test("real game.start reaches its state transition through the debug-panel bridge", h => {
    h.run('Zone.init([],"1-255"); game.isGameStart=false; game.start(); flush();');
    assert.equal(h.run("game.isGameStart"), true);
    assert(h.context.logs.some(line => line.startsWith("[房间上下文] game-start")));
  });
  test("own draw no longer aborts at the deal-entry-marker from log seq678", h => {
    h.run(`
      room.myID=0; room.mySeats=[0]; game.isGameStart=false; game.turn=20;
      Zone.init([48,93,26,91],"1-255"); new Zone(255,1).show([48,93,26]);
      move({FromID:255,FromZone:1,FromPosition:DING,ToID:0,ToZone:5,CardIDs:[48],CardCount:1});
      globalThis.afterOwnDraw=Zone.obj["1-255"].slice(0,2).map(card=>card.id);
      move({FromID:255,FromZone:1,FromPosition:DING,ToID:2,ToZone:5,CardIDs:[],CardCount:2});
      flush();
    `);
    assert.deepEqual(h.value("Zone.shoupai(0)"), [48]);
    assert.deepEqual(h.value("afterOwnDraw"), [93,26]);
    assert.deepEqual(h.value("Zone.shoupai(2)"), [93,26]);
    assert(!h.context.logs.some(line => line.includes("event:error")));
  });
  for (const mode of ["missing", "throwing", "debug-off"]) {
    test("game start and own initial draw tolerate debug bridge " + mode, h => {
      if (mode === "missing") h.run('delete __xcAppendLocalSkinDebugLine;');
      if (mode === "throwing") h.run('__xcAppendLocalSkinDebugLine=()=>{throw Error("panel unavailable")};');
      if (mode === "debug-off") h.run('XC.isDebug=false;');
      h.run(`
        Zone.init([48,93,26],"1-255"); new Zone(255,1).show([48,93,26]);
        game.isGameStart=false; game.start();
        globalThis.started=game.isGameStart;
        game.isGameStart=false;
        move({FromID:255,FromZone:1,FromPosition:DING,ToID:1,ToZone:5,CardIDs:[48],CardCount:1});
        flush();
      `);
      assert.equal(h.run("started"),true);
      assert.deepEqual(h.value("Zone.shoupai(1)"),[48]);
      assert.deepEqual(h.value('Zone.obj["1-255"].slice(0,2).map(card=>card.id)'),[93,26]);
      assert.deepEqual(h.value("logs"),[]);
    });
  }
  test("peek ABCD, take AB, then the next player draws CD from the top", h => {
    h.run(`
      Zone.init([22,131,72,52,88,153,92], "1-255");
      new Zone(255,1).show([22,131,72,52]);
      move({FromID:255,FromZone:1,FromPosition:DING,ToID:1,ToZone:5,
        CardIDs:[22,131],CardCount:2});
      globalThis.remainingTop = Zone.obj["1-255"].slice(0,2).map(card=>card.id);
      move({FromID:255,FromZone:1,FromPosition:DING,ToID:2,ToZone:5,
        CardIDs:[],CardCount:2});
      flush();
    `);
    assert.deepEqual(h.value("Zone.shoupai(1)"), [22,131]);
    assert.deepEqual(h.value("remainingTop"), [72,52]);
    assert.deepEqual(h.value("Zone.shoupai(2)"), [72,52]);
    assert.deepEqual(h.value('readKeys("s3")'), [72,52]);
  });
  test("skill peek replies record Datas and actual deck positions", h => {
    h.run(`
      Zone.init([22,131,72,52,88], "1-255");
      _0x47b943.spellDict[3868]={name:"测试看顶技能"};
      logic({ClassName:"CGsRoleSpellOptRep",SpellID:3868,Type:50,
        SeatID:1,Datas:[22,131,72,52]});
      flush();
    `);
    assert(h.context.logs.some(line => line.includes("event:in") && line.includes("CGsRoleSpellOptRep") &&
      line.includes('"Datas":[22,131,72,52]') && line.includes('"spellName":"测试看顶技能"')));
    const done = JSON.parse(h.context.logs.find(line => line.startsWith("[可见牌] event:done ")).split("event:done ")[1]);
    assert.equal(done.stage, "show:after");
    assert.equal(done.steps[0].pos, 0);
    assert.deepEqual(done.after[0].head.slice(0,4), [22,131,72,52].map(id=>({id,key:id})));
  });
  test("target-selection peek notifications preserve Params and source seat", h => {
    h.run(`
      Zone.init([22,131,72,52,88], "1-255");
      logic({ClassName:"GsCRoleOptTargetNtf",SpellID:3903,Param:0,
        SrcSeatID:1,targetSeatID:255,Params:[4,0,22,131,72,52]});
      flush();
    `);
    assert.deepEqual(h.value('Zone.obj["1-255"].slice(0,4).map(card=>card.key)'), [22,131,72,52]);
    assert(h.context.logs.some(line => line.includes("event:in") && line.includes("GsCRoleOptTargetNtf") &&
      line.includes('"Params":[4,0,22,131,72,52]') && line.includes('"SrcSeatID":1')));
  });
  test("deck snapshots retain unknown slots and skipped draws retain the before/after evidence", h => {
    h.run(`
      Zone.init([22,131,72,52,88], "1-255");
      new Zone(255,1).show([22]);
      globalThis.snapshot=snapshotVisibleCardZone("1-255");
      move({FromID:255,FromZone:1,FromPosition:DING,ToID:1,ToZone:5,
        CardIDs:[22],CardCount:1,isSend:true});
    `);
    assert.deepEqual(h.value("snapshot.known"), [22]);
    assert.deepEqual(h.value("snapshot.head.slice(0,2)"), [{id:22,key:22},{id:131,key:0}]);
    const incoming = JSON.parse(h.context.logs.find(line => line.startsWith("[可见牌] event:in ")).split("event:in ")[1]);
    assert.equal(incoming.deckBefore.count,5);
    assert.equal(incoming.context.myID,1);
    const done = JSON.parse(h.context.logs.find(line => line.startsWith("[可见牌] event:done ")).split("event:done ")[1]);
    assert.equal(done.after[0].count,5);
    assert.equal(done.steps.at(-1).reason,"isSend");
  });
  test("normal opponent use updates model, main panel and mirror", h => {
    h.run('setHand(2,[7,14]); move({FromID:2}); flush();');
    assert.deepEqual(h.value("Zone.shoupai(2)"), [14]);
    assert.deepEqual(h.value('readKeys("3")'), [14]);
    assert.deepEqual(h.value('readKeys("s3")'), [14]);
    assert(h.context.logs.some(line => line.includes('"stage":"remove:after"')));
    assert(h.context.logs.some(line => line.includes("render:after") && line.includes('"seq":1')));
  });
  test("same-zone disclosure preserves the card instead of deleting it", h => {
    h.run('setHand(1,[7]); move({ToID:1,ToZone:5}); flush();');
    assert.deepEqual(h.value("Zone.shoupai(1)"), [7]);
    assert(h.context.logs.some(line => line.includes('"stage":"show:after"')));
  });
  test("sent messages stay ignored and report the skip reason", h => {
    h.run('setHand(1,[7]); move({isSend:true}); flush();');
    assert.deepEqual(h.value("Zone.shoupai(1)"), [7]);
    assert(h.context.logs.some(line => line.includes('"reason":"isSend"')));
  });
  test("mixed visibility records the original IDs without mutating the message", h => {
    h.run('setHand(2,[7,14]); globalThis.input=[7,0]; move({FromID:2,CardIDs:input,CardCount:2}); flush();');
    assert.deepEqual(h.value("input"), [7, 0]);
    assert(h.context.logs.some(line => line.includes('"stage":"move:mixed"') && line.includes('"cards":[7,0]')));
  });
  test("malformed message logs the failure and the next message still works", h => {
    h.run('setHand(1,[7]); move({CardIDs:null}); move(); flush();');
    assert(h.context.logs.some(line => line.includes("event:error") && line.includes('"seq":1')));
    assert(h.context.logs.some(line => line.includes("event:done") && line.includes('"seq":2')));
    assert.deepEqual(h.value("Zone.shoupai(1)"), []);
    assert.equal(h.run("visibleCardActiveTrace"), null);
  });
  test("debug off produces no diagnostics and still fixes stale rendering", h => {
    h.run('XC.isDebug=false; setHand(1,[7]); Qcard.draw=()=>{throw Error("query failure")}; Zone.draw("unknown"); elements.delete("result"); move(); flush();');
    assert.deepEqual(h.value("logs"), []);
    assert.deepEqual(h.value('readKeys("s2")'), []);
  });
  test("a broken debug-panel writer cannot interrupt card movement", h => {
    h.run('__xcAppendLocalSkinDebugLine=()=>{throw Error("panel rebuild")}; setHand(1,[7]); move(); flush();');
    assert.deepEqual(h.value('readKeys("s2")'), []);
  });
  test("render failure details reach the debug panel", h => {
    h.run('setHand(1,[7]); Qcard.draw=()=>{throw Error("query-node-failure")}; Zone.draw("unknown"); move(); flush();');
    assert(h.context.logs.some(line => line.includes("render:error") && line.includes("query-node-failure")));
    assert.deepEqual(h.value("oldErrors"), [], "new errors should not go only to console");
  });
  test("use notification is observed without premature hand deletion", h => {
    h.run('setHand(2,[7]); logic({ClassName:"PubGsCUseCard",SeatID:2,CardID:7,useType:1,isSend:false}); flush();');
    assert.deepEqual(h.value("Zone.shoupai(2)"), [7]);
    assert(h.context.logs.some(line => line.includes("event:in") && line.includes("PubGsCUseCard")));
  });
}
process.stdout.write(`${passed} passed, ${failed} failed${baseline ? " (original HEAD baseline)" : ""}\n`);
process.exitCode = failed ? 1 : 0;
