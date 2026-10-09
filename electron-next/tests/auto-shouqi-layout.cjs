// Run: node electron-next/tests/auto-shouqi-layout.cjs
// Exercise the actual userscript hooks with native window geometry/draw lists.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "../resources/daxiaochao.user.js"), "utf8");
const tables = require("../../doc/彩虹表.js").tables._0x3812;
const strings = { ...tables.all, ...tables.used };
const anchor = source.indexOf("function layoutAutoShouQiConfigWindow(win)");
const start = source.lastIndexOf("(async function () {", anchor);
const end = source.indexOf("\n      })(),", anchor);
assert(anchor > 0 && start > 0 && end > anchor, "window hook boundaries exist");
const hooks = source.slice(start, end + "\n      })()".length);

const rect = (name, x, y, width, height) => ({ name, x, y, width, height });
const prototype = {
  btnOkHandler() {},
  Close() { this.closed = true; },
  UpdateInfo() {},
  pushHandCardUis() {},
  SendClientChr1v1CardReq() {},
  initBg(width, height) { this.width = width; this.height = height; },
  updateCardUIs(parent, ids, uis, x, y, width, gap) {
    this.calls.push({ ids: Array.from(ids), uis, x, y, width, gap });
    for (let i = 0; i < ids.length; i++) {
      if (!uis[i]) {
        uis[i] = rect("card", 0, 0, 88, 122);
        parent._children.push(uis[i]);
      }
      uis[i].Card = { CardId: ids[i] };
    }
    // CardConfigWindow.layoutCardUis uses bF.NORMAL_SIZE.width=93, including
    // integer truncation and negative spacing when a row is overcrowded.
    const space = Math.min(Math.max(((width - 93 * ids.length) / (ids.length - 1)) | 0, -93), gap);
    uis.forEach((ui, index) => { ui.x = x + index * (93 + space); ui.y = y; });
    return uis.length;
  },
};

function windowFixture() {
  const win = Object.create(prototype);
  win.calls = [];
  for (const field of ["equipCardUIs", "jinNangCardUIs", "basicCardUIs", "handCardUIs", "otherCardUIs", "cardUIPool"])
    win[field] = [];
  win.handCardIDs = [];
  win.genItem = { handCardIDs: [52, 83] };
  win.handCardContainer = rect("hand", 71, 343, 460, 130);
  win.btnRefresh = rect("refresh", 566, 344, 126, 29);
  win.btnRecommond = rect("any", 566, 376, 126, 41);
  win.Nt = rect("all", 566, 421, 126, 41);
  win.equipCardBg = rect("equip-bg", 17, 34, 348, 145);
  win.jinNangCardBg = rect("trick-bg", 381, 34, 348, 145);
  win.basicCardBg = rect("basic-bg", 17, 183, 712, 145);
  win.footer = rect("footer-bg", 17, 332, 712, 145);
  win.labels = [rect("equip-label", 39, 78, 14, 56), rect("trick-label", 403, 78, 14, 56), rect("basic-label", 39, 227, 14, 56)];
  win.slots = Array.from({ length: 4 }, (_, i) => rect("slot", 71 + 120 * i, 343, 93, 130));
  win.help = rect("help", 418, 6, 20, 20);
  win.contentSprite = {
    _children: [win.handCardContainer, win.btnRefresh, win.help],
    textureList: [win.equipCardBg, win.jinNangCardBg, win.basicCardBg, win.footer, ...win.labels, ...win.slots],
    drawContaniers: [win.btnRecommond, win.Nt],
  };
  return win;
}

const logs = [], state = {}, pending = [];
const context = vm.createContext({
  n: id => strings[id],
  laya: { get: () => Object.create(prototype), win: () => null },
  redefine(target, key, descriptor) {
    target["__" + key] = target[key];
    Object.defineProperty(target, key, { ...descriptor, configurable: true });
  },
  window: { __xcAutoSQKDebugLog: (event, data) => logs.push({ event, data }) },
  globalState: state,
  checkHandCards: () => true,
  scheduleAutoShouQiFallback: (...args) => pending.push(args),
});

async function main() {
  await vm.runInContext(hooks, context);
  const win = windowFixture();
  win.SendClientChr1v1CardReq();
  assert.deepEqual([win.width, win.height], [845, 636]);
  assert.deepEqual(win.equipCardUIs.map(ui => ui.Card.CardId), [14, 135, 103, 52, 70, 1010, 134, 108]);
  assert.deepEqual(win.basicCardUIs.map(ui => ui.Card.CardId), [25, 130, 2, 6, 7, 138, 112]);
  const rows = [win.equipCardUIs, win.jinNangCardUIs, win.basicCardUIs];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    assert.ok(row.every((ui, i) => !i || ui.x >= row[i - 1].x + row[i - 1].width), "every candidate is fully exposed");
    assert.ok(row.every(ui => ui.y === [46, 194, 342][r] && ui.x + ui.width <= 829));
    if (r) assert.ok(row[0].y >= rows[r - 1][0].y + rows[r - 1][0].height);
  }
  assert.deepEqual([win.jinNangCardBg.x, win.jinNangCardBg.y, win.jinNangCardBg.width], [17, 182, 812]);
  assert.deepEqual(win.labels.map(ui => [ui.x, ui.y]), [[39, 78], [39, 226], [39, 375]]);
  assert.ok(win.slots.every(ui => ui.y === 491), "drawn selection slots follow the hand container");
  assert.equal(win.handCardContainer.y, 491);
  assert.deepEqual([win.btnRecommond.y, win.Nt.y], [524, 569]);
  assert.ok(win.Nt.y + win.Nt.height < win.height && win.footer.y + win.footer.height < win.height);
  assert.deepEqual([win.help.x, win.help.y], [418, 6], "help stays on the title row");

  const geometry = () => JSON.stringify([...win.contentSprite._children, ...win.contentSprite.textureList, ...win.contentSprite.drawContaniers].map(ui => [ui.x, ui.y, ui.width]));
  const first = geometry();
  win.SendClientChr1v1CardReq();
  assert.equal(geometry(), first, "reopening neither shifts controls again nor grows backgrounds");
  const newSlot = rect("new-slot", 71, 343, 93, 130);
  win.contentSprite.textureList.push(newSlot);
  win.SendClientChr1v1CardReq();
  assert.equal(newSlot.y, 491, "new native InitDatas slots are laid out on reuse");
  assert.equal(win.Nt.y, 569);

  win.updateCardUIs(win.contentSprite, [1], [], 10, 20, 100, 3);
  const other = win.calls.at(-1);
  assert.deepEqual([other.x, other.y, other.width, other.gap], [10, 20, 100, 3], "unrelated layouts pass through");
  win.handCardIDs = [52, 1010];
  win.sqkHandCardMode = "any";
  win.btnOkHandler();
  assert.deepEqual(state.configHandCards, [52, 1010]);
  assert.equal(state.configHandCardsMode, "any");
  assert.ok(win.closed && pending.length === 1, "original save/close/fallback chain remains connected");
  assert.equal(logs.find(log => log.event === "config:layout").data.equipment, 8);
  process.stdout.write("PASS: all 22 candidates exposed; decorations/footer aligned; repeat-open stable; save chain preserved.\n");
}
main().catch(error => { process.stderr.write(error.stack + "\n"); process.exitCode = 1; });
