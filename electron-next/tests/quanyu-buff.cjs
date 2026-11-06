// Run: node electron-next/tests/quanyu-buff.cjs
// Execute actual renderer and hook bodies; Laya rendering and seat model are mocked.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const tables = require("../../doc/彩虹表.js").tables;
const source = fs.readFileSync(path.join(__dirname, "../resources/daxiaochao.user.js"), "utf8");
function slice(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, start);
  return source.slice(a, b);
}
class Text {
  constructor() { this.text = ""; this.children = []; this.width = 130; }
  addChild(child) { this.children.push(child); }
  pos(x, y) { this.x = x; this.y = y; }
}
class Seat {
  constructor() { this.current = 0; this.mask = 0; this.calls = []; }
  GetStateValue(id) { assert.equal(id, 3793); return this.current; }
  GetSkillBuffInfo(id) { assert.equal(id, 3793); return [this.mask]; }
  SetSkillBuffInfo(id, values, extra) {
    this.calls.push([id, values, extra]);
    if (id === 3793) this.mask = values[0];
    return "native-buff";
  }
}
class Avatar extends Text {
  constructor(seat) { super(); this.seat = seat; }
  SetGeneralCard(value) { this.general = value; return "native-avatar"; }
}
let enabled = true, notifications = 0;
const decode = (name) => (i) => {
  assert(tables[name].all[i] !== undefined, `${name}:${i}`);
  return tables[name].all[i];
};
const seats = [new Seat(), new Seat()];
const uis = seats.map((seat) => ({ seat, seatAvatar: new Avatar(seat) }));
const saved = new Map();
const ctx = vm.createContext({
  localStorage: { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
  appendLocalSkinDebugLine() {},
  Laya: { Text },
  _0x4eef: decode("_0x4eef"), _0x47c207: decode("_0x3812"),
  hasAdvancedFeature: () => enabled,
  notifyAdvancedFeatureTrial: () => notifications++,
  laya: { gamescene: { seatContainer: { seatUIs: uis } } },
  y: uis[1], w: decode("_0x3812"), s: null, z: null,
  redefine(proto, key, descriptor) {
    proto["__" + key] = proto[key];
    Object.defineProperty(proto, key, descriptor);
  },
});
vm.runInContext(slice("  function setGeneralTip({", "  _0x3fc3ca();") +
  slice("  const _0x287c73 = 3793,", "  const _0x1a2190 ="), ctx);
const hooks = slice('        redefine(null == (s = y[w(447)])',
  '        redefine(null == (d =');
vm.runInContext(hooks.trim().replace(/,$/, ";"), ctx);
const draw = (avatar = uis[0].seatAvatar) => ctx._0x43fd79({ avatar });
const root = () => uis[0].seatAvatar.__xcGeneralTip_quanyu;
const visibleRows = () => Array.from(root().__xcGeneralTipLines).filter((row) => row.visible);
const colors = () => visibleRows().map((row) => row.color);
draw();
assert.equal(root(), undefined, "unaffected seat has no overlay");
for (let current = 1; current <= 6; current++) {
  seats[0].current = current;
  const mask = (1 << (current + 1)) - 2;
  assert.equal(seats[0].SetSkillBuffInfo(3793, [mask], "extra"), "native-buff");
  assert.equal(seats[0].calls.at(-1)[2], "extra", "native arguments retained");
  const rows = visibleRows();
  assert.equal(rows.length, current, "unselected effects omitted");
  assert.deepEqual(Array.from(rows, (r) => r.text), ["伤害+1", "目标+1", "无视防具", "不可响应", "额外结算", "无次数"].slice(0, current));
  assert.deepEqual(colors(), Array.from({ length: current }, (_, i) =>
    i + 1 === current ? "#FFFFFF" : "#00FF00"));
  assert.equal(uis[0].seatAvatar.children.length, 1, "root reused");
  assert.equal(root().children.length, current, "rows allocated only as needed");
}
assert.equal(uis[1].seatAvatar.__xcGeneralTip_quanyu, undefined, "other seats untouched");
seats[0].current = 0;
seats[0].SetSkillBuffInfo(3793, [126]);
assert(colors().every((color) => color === "#00FF00"), "history without current effect");
seats[0].current = 3;
seats[0].SetSkillBuffInfo(3793, [0]);
assert.deepEqual(colors(), ["#FFFFFF"], "current independent of mask; old row slots hidden");
assert.equal(root().children.length, 6, "reduced selection reuses existing nodes");
vm.runInContext("quanYuDisplay.setAllSelected(false)", ctx);
assert.equal(saved.get("xcQuanYuAllSelected"), "false");
assert.equal(root().visible, false, "original path follows mask without inventing current entries");
seats[0].SetSkillBuffInfo(3793, [8]);
assert.equal(root().text, "无视防具", "original single selection");
assert(visibleRows().length === 0, "switching to original text hides colored rows");
seats[0].SetSkillBuffInfo(3793, [126]);
assert.equal(root().text.split("\n").length, 6, "original multiple-selection/rumo mask retained");
vm.runInContext("quanYuDisplay.setAllSelected(true)", ctx);
assert.equal(saved.get("xcQuanYuAllSelected"), "true");
assert.equal(root().text, "", "switch back removes old plain text");
assert.equal(colors().length, 6);
seats[0].SetSkillBuffInfo(3793, [0]);
enabled = false;
draw();
assert.equal(root().visible, false);
assert(root().__xcGeneralTipLines.every((r) => !r.visible && !r.text));
enabled = true;
draw();
assert.equal(root().visible, true);
seats[0].current = 0;
seats[0].SetSkillBuffInfo(3793, [0]);
assert.equal(root().visible, false, "effect removal clears overlay");
seats[0].current = 2;
seats[0].mask = 6;
const avatar = new Avatar(seats[0]);
assert.equal(avatar.SetGeneralCard(123), "native-avatar");
assert.equal(avatar.general, 123);
assert.equal(avatar.__xcGeneralTip_quanyu.__xcGeneralTipLines[1].color, "#FFFFFF", "avatar rebuild reads live model");
const nextGame = new Avatar(new Seat());
nextGame.SetGeneralCard(456);
assert.equal(nextGame.__xcGeneralTip_quanyu, undefined, "new seat has no history cache");
ctx.setGeneralTip({ key: "hpColor", avatar, text: "灼魂\n测试" });
assert.equal(avatar.__xcGeneralTip_hpColor.text, "灼魂\n测试", "existing plain text caller retained");
assert.equal(avatar.__xcGeneralTip_hpColor.__xcGeneralTipLines, undefined);
assert(notifications > 0);
for (const [raw, expected] of [[null,true],["false",false],["true",true],["broken",true]]) {
  const preference = vm.createContext({ localStorage: { getItem: () => raw } });
  vm.runInContext(slice("  const quanYuDisplay =", "  function _0x43fd79({") +
    "globalThis.value = quanYuDisplay.allSelected", preference);
  assert.equal(preference.value, expected, "saved mode: " + raw);
}
assert(source.includes("    quanYuDisplay.mountControls();"), "real panel entry");
assert(source.includes("    quanYuDisplay.cleanupControls();"), "Exit cleanup");
process.stdout.write("quanyu buff: selected-only colors, both modes, persistence, removal, permissions, avatar rebuild, seat isolation, native calls and plain-text regression passed\n");
