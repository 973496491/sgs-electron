// Run: node electron-next/tests/skin-effect-block.cjs [--source <userscript>]
// Real panel/tooltip and controller + saved official seat methods. Rendering and game services are mocked.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const http = require("node:http");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const native = require("./fixtures/skin-effect-native.cjs");
const rainbow = require("../../doc/彩虹表.js").tables._0x871b;
const sourceArg = process.argv.indexOf("--source");
const source = fs.readFileSync(sourceArg < 0 ? path.join(__dirname, "../resources/daxiaochao.user.js") : process.argv[sourceArg + 1], "utf8");
function slice(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, "source boundaries: " + start);
  return source.slice(a, b);
}
const controller = slice("  // 局内皮肤攻击动效：", "  // 顶部跑马灯：");
const skinButton = slice("  // 皮肤屏蔽按钮：", "  // 顶部广播按钮：");
const marqueeButton = slice("  // 顶部广播按钮：", "  function waitForCardBackSwitch(");
const helpers = slice("  function findSwitchContainer(", "  function setLocalSkinSwitchState(") +
  slice("  function getHandSortSwitchAnchor(", "  // Hand-card main-panel host.");
const tooltip = slice("  let _0x5ee876 =", "  function _0x208a6c()");
assert(source.includes("      installSkinEffectBlocker(),"), "login installs controller");
assert(source.includes("      window.__xcInstallSkinEffectButton();"), "panel rebuild installs button");
assert(source.includes("    cleanupSkinEffectBlocker();"), "exit restores hooks");
for (const [value, expected] of [[null, false], ["true", true], ["false", false], ["broken", false]]) {
  const ctx = { window: {}, localStorage: { getItem: () => value } };
  vm.runInNewContext(controller, ctx);
  assert.equal(ctx.window.__xcIsSkinEffectsBlocked(), expected, "saved preference: " + value);
}
const deniedStorage = { window: {}, localStorage: { getItem() { throw Error("storage disabled"); } } };
vm.runInNewContext(controller, deniedStorage);
assert.equal(deniedStorage.window.__xcIsSkinEffectsBlocked(), false);

const dataStart = source.indexOf("  function D() {"), dataEnd = source.indexOf("    ];", dataStart);
const strings = vm.runInNewContext(source.slice(source.indexOf("[", dataStart), dataEnd + 5));
function decode(text) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
  let bytes = "", value = 0, count = 0;
  for (const char of text) {
    const n = alphabet.indexOf(char);
    if (n < 0) continue;
    value = count % 4 ? 64 * value + n : n;
    if (count++ % 4) bytes += String.fromCharCode(255 & (value >> ((-2 * count) & 6)));
  }
  return decodeURIComponent(Array.from(bytes, c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
}
const markup = strings.filter(s => s.length > 3000).map(decode).find(s => s.includes('id="cardLabelSwitch"'));
assert(markup, "actual panel template found");

function fixture(methods) {
  window.logs = [];
  window.appendLocalSkinDebugLine = (line, force) => {
    if (force !== false) throw Error("debug window visibility must be respected");
    logs.push(line);
  };
  class Emitter {
    constructor() { this.listeners = []; }
    on(type, caller, method, args = []) { this.listeners.push({ type, caller, method, args }); return this; }
    off(type, caller, method) { this.listeners = this.listeners.filter(x => x.type !== type || x.caller !== caller || x.method !== method); }
    offAll() { this.listeners = []; }
    event(type, args = []) {
      if (!Array.isArray(args)) args = [args];
      for (const x of this.listeners.filter(x => x.type === type)) x.method.apply(x.caller, x.args.concat(args));
    }
  }
  window.pendingLoads = [];
  window.createdEffects = [];
  class Effect extends Emitter {
    static SPINE_EFFECT_LOAD_COMPLETE = "SPINE_EFFECT_LOAD_COMPLETE";
    static PLAY_NAME_SUC = "PLAY_NAME_SUC";
    static PLAY_NAME_LOSE = "PLAY_NAME_LOSE";
    constructor() { super(); createdEffects.push(this); }
    InitEffect(url, name) { this.EffectUrl = url; this.name = name; }
    getCrtNameOrIndex() { return this.name; }
    pos(x, y) { this.x = x; this.y = y; }
    scale() {}
    playEffect() { pendingLoads.push(this); }
    stop() { this.event("stopped"); }
    destroy() { this.destroyed = true; this.offAll(); }
    complete() { this.stop(); this.destroy(); }
  }
  window.flushLoads = () => {
    for (const effect of pendingLoads.splice(0)) if (!effect.destroyed) {
      effect.event(Effect.PLAY_NAME_SUC, [effect.EffectUrl, effect.name]);
      effect.event(Effect.SPINE_EFFECT_LOAD_COMPLETE);
    }
  };
  window.Laya = { Event: { LABEL: "label", STOPPED: "stopped" }, Point: class { constructor(x, y) { this.x = x; this.y = y; } } };
  Laya.Tween = { clearAll() {} };
  Laya.timer = { clear() {} };
  window.mgt = { ResType_Bone: 1, ResType_Spine: 3, ResType_Spine_AllBig: 4 };
  window.HKt = { GetUrlLastName: url => url.slice(url.lastIndexOf(".")) };
  window.ljt = Effect;
  window.Xv = { SELF: 1, EAST: 2, WEST: 3, NORTH: 4, NORTH_EAST: 5, NORTH_WEST: 6 };
  window.FCt = { NIANSHOU_BUZHUO: -1 };
  window.vv = { SKILL_EFFECT: "SKILL_EFFECT", USE_SKILL: "USE_SKILL" };
  window.fallbackCount = 0;
  window.Ens = class { pos() {} playEffect() { fallbackCount++; } };
  window.c1t = { ShowGameSkinEffects: true, SceneRightWidth: 0 };
  window.sTt = { gameWidth: 1600, gameHeight: 960 };
  window.XBi = { I: () => ({ globalToLocal: p => p }) };
  window.skin = { NewSkinJudge: 1, skinID: 35701, NewJudgeSkinID: state => "35701_" + state,
    DynamicSkinBigSkeletonUrlNew: () => "res/runtime/pc/animate/skinEffectNew/35701" };
  window.KKt = { I: () => ({ GetGeneralSkinBySkinID: () => skin,
    GetSpecialSkinById: () => ({ OutPlace: [20, 30], OtherOutPlace: [20, 30], Zoom: 1 }) }) };
  window.WP = { NEW_SKIN_PLAY_TYPE_hudong: 1, NEW_SKIN_PLAY_TYPE_skill: 2, NEW_SKIN_PLAY_TYPE_sha: 3,
    NEW_SKIN_PLAY_TYPE_zhuanchang: 4, NEW_SKIN_PLAY_TYPE_skill_2: 5 };
  window.$F = Effect;
  window.fF = { PlaySkinSoundByLabel() {} };
  window.makeRoot = () => ({ _children: [], get numChildren() { return this._children.length; },
    getChildAt(i) { return this._children[i]; }, addChild(node) { this._children.push(node); return node; } });
  window.dispatcher = new Emitter();
  window.Ms = { I: () => dispatcher, SHOW_NEW_BIGSKIN_EFFECT: "SHOW_NEW_BIGSKIN_EFFECT" };
  window.restores = [];
  dispatcher.on(Ms.SHOW_NEW_BIGSKIN_EFFECT, null, (visible, key) => restores.push({ visible, key }));
  // Compile the exact saved official methods, including reentrant shape-change cleanup.
  const NativeSeat = new Function("return class NativeSeat {" + methods + "}")();
  window.makeSeat = (Ctor = NativeSeat) => {
    const ui = new Ctor();
    Object.assign(ui, { seat: { General: { IsDynamic: true }, SkinItemID: 35701, DySkinType: 1, IsSelf: true },
      seatScale: 1, seatX: 100, unscaledWidth: 100, unscaledHeight: 100,
      effectSprite: Object.assign(makeRoot(), { localToGlobal: p => p }),
      seatAvatar: { canShowDyNamic: () => true, ShowSkeleton(visible) { this.visible = visible; } },
      addGameSceneEffect(effect) { scene.addChild?.(effect); }, getAnimationName: () => "play",
      aniEventNew() {}, needPlayChange: false });
    return ui;
  };
  window.NativeSeat = NativeSeat;
  window.own = makeSeat();
  window.other = makeSeat();
  other.seat.IsSelf = false;
  window.scene = Object.assign(makeRoot(), { SelfSeatUi: own, seatContainer: { seatUIs: [own, other] } });
  c1t.GetSeat = () => ({ PlaySkillHurtAnim(skill, animUrl, aniName, isFlipX) { other.skill_Hurt({ skill, animUrl, aniName, isFlipX }); } });
  window.servicesReady = true;
  window.laya = { get ged() { return servicesReady ? dispatcher : null; }, get gamescene() { return scene; } };
  window.nativePlay = NativeSeat.prototype.onPlayNewSpEffect;
  window.__xcSetTopMarqueeBlocked = () => {};
  window.__xcIsTopMarqueeBlocked = () => false;
  localStorage.removeItem("xcSkinEffectsBlocked");
}

async function checks() {
  const passed = [];
  const check = (condition, label) => { if (!condition) throw Error(label); passed.push(label); };
  const frame = () => new Promise(resolve => setTimeout(resolve, 80));
  const center = node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const settings = document.getElementById("cardLabelSwitch").closest(".setting.panel-content");
  const header = settings.previousElementSibling;
  settings.style.maxHeight = "5000px";
  header.classList.add("active");
  let headerClicks = 0;
  header.addEventListener("click", () => headerClicks++);
  function alignment(label) {
    layoutTopMarqueeButton();
    layoutSkinEffectButton();
    const a = center(document.querySelector("#xcSkinEffectSwitchRow .slider"));
    const x = center(getHandSortSwitchAnchor(document.getElementById("cardLabelSwitch")));
    const y = center(getHandSortSwitchAnchor(document.getElementById("xcTopMarqueeToggle")));
    check(Math.abs(a.x - x.x) < 1 && Math.abs(a.y - y.y) < 1 && a.x > y.x,
      label + " beside marquee, aligned with card-label column " + JSON.stringify({ a, x, y }));
    const caption = document.querySelector("#xcSkinEffectSwitchRow > label");
    const reference = document.querySelector("#xcTopMarqueeSwitchRow > label");
    check(caption.getBoundingClientRect().bottom <= document.querySelector("#xcSkinEffectSwitchRow .slider").getBoundingClientRect().top + 1 &&
      ["fontSize", "fontFamily", "color", "lineHeight"].every(k => getComputedStyle(caption)[k] === getComputedStyle(reference)[k]), label + " native caption styling");
  }
  try {
    _0x47344d();
    check(installSkinEffectBlocker(), "controller installs against native seat prototype");
    const hooked = NativeSeat.prototype.onPlayNewSpEffect;
    check(installSkinEffectBlocker() && NativeSeat.prototype.onPlayNewSpEffect === hooked, "installation is idempotent");
    check(!__xcIsSkinEffectsBlocked(), "first launch defaults off");
    own.onPlayNewSpEffect(3);
    const attack = own.playingNewSpEffect, full = own.newFullScreenEffect;
    check(attack?.name === "GongJi" && attack.EffectUrl.endsWith("/xingxiang.json"), "off executes real native attack path");
    flushLoads();
    check(restores.at(-1).visible === false, "native loaded attack hides the original portrait");
    installTopMarqueeButton();
    check(installSkinEffectButton(), "button installs into actual panel");
    await frame();
    alignment("normal panel");
    const input = document.getElementById("xcSkinEffectToggle");
    const row = document.getElementById("xcSkinEffectSwitchRow");
    check(row.querySelector(".explanation").textContent === "皮肤屏蔽" && row.dataset.tooltip === "屏蔽局内皮肤特效", "exact requested name and tooltip");
    row.querySelector(".slider").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    check(document.querySelector(".tooltip.visible")?.textContent === "屏蔽局内皮肤特效", "native hover delegation shows tooltip");
    row.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    check(!document.querySelector(".tooltip.visible"), "native hover tooltip closes");
    input.click();
    check(input.checked && __xcIsSkinEffectsBlocked() && localStorage.getItem("xcSkinEffectsBlocked") === "true", "on persists preference");
    check(attack.destroyed && full.destroyed && !own.playingNewSpEffect && !own.newFullScreenEffect && restores.at(-1).visible,
      "on disposes running native attack and restores portrait");
    const created = createdEffects.length;
    own.onPlayNewSpEffect(3);
    other.onPlayNewSpEffect(3);
    check(createdEffects.length === created, "on blocks own and other attacks before any player or full-screen allocation");
    for (const [type, name] of [[1, "HuDong"], [2, "JiNeng"], [5, "JiNeng02"]]) {
      other.onPlayNewSpEffect(type);
      check(!other.playingNewSpEffect, "blocks additional skin action " + name);
    }
    other.onPlayNewSpEffect(4);
    check(other.playingNewSpEffect?.name === "ZhuanChang", "preserves shape transition state chain");
    other.playingNewSpEffect.complete();
    input.click();
    own.onPlayNewSpEffect(3);
    const loading = own.playingNewSpEffect;
    input.click();
    const beforeLoad = restores.length;
    flushLoads();
    check(loading.destroyed && restores.slice(beforeLoad).every(e => e.visible), "late load cannot re-hide portrait after on");
    input.click();
    own.onPlayNewSpEffect(3);
    const previousAttack = own.playingNewSpEffect, previousFull = own.newFullScreenEffect;
    own.needPlayChange = true;
    input.click();
    check(previousAttack.destroyed && previousFull.destroyed && own.playingNewSpEffect?.name === "ZhuanChang" &&
      !own.playingNewSpEffect.destroyed && !own.newFullScreenEffect.destroyed, "native cleanup may start shape transition without destroying new players");
    own.playingNewSpEffect.complete();
    setSkinEffectsBlocked(false);
    own.onPlayNewSpEffect(3);
    const lingering = own.newFullScreenEffect;
    own.playingNewSpEffect.complete();
    setSkinEffectsBlocked(true);
    check(lingering.destroyed && !own.newFullScreenEffect, "clears attack full-screen layer after main action already ended");
    setSkinEffectsBlocked(false);
    own.onPlayNewSpEffect(2);
    const skill = own.playingNewSpEffect, skillFull = own.newFullScreenEffect;
    setSkinEffectsBlocked(true);
    check(skill.destroyed && skillFull.destroyed && !own.playingNewSpEffect, "on also clears current skill skin animation and layer");
    const modernSkin = window.skin;
    window.skin = { NewSkinJudge: 0, ResType: 1, SpellEffectData: [{ id: 700, type: 0 }],
      spellEffectAnimUrl: (id, second) => "res/runtime/pc/animate/skillEffect/10001/700/jineng0" + (second ? 2 : 1) + ".sk" };
    const legacySkill = { ID: 700, Name: "legacy", isPlayEffectInUseSkill: true,
      DealSkinSkillEffectShowAndLayer: () => null, DealSkinSkillEffect: () => null };
    const legacyEvent = { DestSeatIDs: [1] };
    check(own.playGeneralSpEffect(legacyEvent, legacySkill) === false && !own.outAvatarEffect, "legacy skin branch suppressed with normal fallback result");
    const fallbackBefore = fallbackCount;
    own.playGeneralSkillEffect(legacySkill, true, legacyEvent);
    check(fallbackCount === fallbackBefore + 1 && !own.outAvatarEffect, "ordinary skill-name fallback remains available");
    setSkinEffectsBlocked(false);
    check(own.playGeneralSpEffect(legacyEvent, legacySkill) === true && own.outAvatarEffect?.EffectUrl.endsWith("jineng01.sk"), "off restores native old-format first stage");
    const legacyFirst = own.outAvatarEffect;
    setSkinEffectsBlocked(true);
    check(legacyFirst.destroyed && !own.outAvatarEffect && own.seatAvatar.visible, "on clears old-format out-avatar player and restores skeleton");
    const legacyCount = createdEffects.length;
    own.generalSpEffectStop1(legacyEvent, legacySkill, skin.spellEffectAnimUrl(700, true));
    own.generalSpEffectStop2(legacyEvent, legacySkill, skin.spellEffectAnimUrl(700, true));
    other.skill_Hurt({ skill: legacySkill, animUrl: skin.spellEffectAnimUrl(700, true) });
    check(createdEffects.length === legacyCount, "old-format second-stage and target callbacks cannot recreate effects while on");
    setSkinEffectsBlocked(false);
    own.generalSpEffectStop2(legacyEvent, legacySkill, skin.spellEffectAnimUrl(700, true));
    const oldFull = createdEffects.at(-1);
    other.skill_Hurt({ skill: legacySkill, animUrl: skin.spellEffectAnimUrl(700, true) });
    const oldTarget = createdEffects.at(-1);
    setSkinEffectsBlocked(true);
    check(oldFull.destroyed && oldTarget.destroyed, "on cleans already-playing old-format fullscreen and target second stages");
    setSkinEffectsBlocked(false);
    skin.ResType = 3;
    skin.spellEffectAnimUrl = (id, second) => "res/runtime/pc/animate/skillEffect/10002/700/jineng0" + (second ? 2 : 1) + ".json";
    check(own.playGeneralSpEffect(legacyEvent, legacySkill) === true && own.outAvatarEffect?.EffectUrl.endsWith("jineng01.json"), "off also restores old-style Spine JSON skin");
    own.generalSpEffectStop2(legacyEvent, legacySkill, skin.spellEffectAnimUrl(700, true));
    const oldJson = createdEffects.at(-1);
    setSkinEffectsBlocked(true);
    check(oldJson.destroyed && !own.outAvatarEffect && own.playGeneralSpEffect(legacyEvent, legacySkill) === false, "old-style Spine JSON and Bone SK branches are both blocked");
    other.skill_Hurt({ skill: legacySkill, animUrl: "res/assets/animate/game/effect/hit.sk" });
    check(!createdEffects.at(-1).destroyed, "non-skin hit resource remains unaffected");
    window.skin = modernSkin;
    setSkinEffectsBlocked(false);
    c1t.ShowGameSkinEffects = false;
    own.onPlayNewSpEffect(3);
    check(!own.playingNewSpEffect, "off respects existing native effect setting");
    c1t.ShowGameSkinEffects = true;
    own.onPlayNewSpEffect(3);
    check(own.playingNewSpEffect?.name === "GongJi", "off resumes future native attacks");
    own.playingNewSpEffect.complete();
    class AnotherSeat extends NativeSeat {
      onPlayNewSpEffect(...args) { this.received = args; return 73; }
    }
    const replacement = makeSeat(AnotherSeat);
    window.scene = { SelfSeatUi: replacement, seatContainer: { seatUIs: [replacement] } };
    dispatcher.event("EXECUTE_SWITCH_SCENE", "GameScene");
    const token = {};
    check(replacement.onPlayNewSpEffect(3, token) === 73 && replacement.received[1] === token, "new scene installs subclass hook preserving this arguments and result");
    setSkinEffectsBlocked(true);
    replacement.received = null;
    replacement.onPlayNewSpEffect(3, token);
    check(replacement.received === null, "new scene remains blocked when enabled");
    const later = makeSeat();
    later.onPlayNewSpEffect(3);
    check(!later.playingNewSpEffect, "later instances inherit shared native hook");
    window.scene = null;
    dispatcher.event("EXECUTE_SWITCH_SCENE", "HallScene");
    check(skinEffectBlockState.retryTimer === null, "out of game uses scene event without ongoing polling");
    window.scene = { SelfSeatUi: own, seatContainer: { seatUIs: [own, other] } };
    cleanupSkinEffectBlocker();
    check(NativeSeat.prototype.onPlayNewSpEffect === nativePlay && !dispatcher.listeners.some(x => x.type === "EXECUTE_SWITCH_SCENE"), "cleanup restores original descriptor and removes scene listener");
    window.scene = { seatContainer: { seatUIs: [] } };
    check(!installSkinEffectBlocker() && skinEffectBlockState.retryTimer !== null, "empty game scene retries late seats");
    const retry = skinEffectBlockState.retryTimer;
    installSkinEffectBlocker();
    check(retry === skinEffectBlockState.retryTimer, "late-seat retry is deduplicated");
    window.scene = { SelfSeatUi: own, seatContainer: { seatUIs: [own, other] } };
    await new Promise(resolve => setTimeout(resolve, 550));
    check(NativeSeat.prototype.onPlayNewSpEffect !== nativePlay && skinEffectBlockState.retryTimer === null, "late seats are hooked");
    check(headerClicks === 0 && header.nextElementSibling === settings && settings.contains(input), "button leaves settings collapse chain intact");
    document.getElementById("createIframe").style.transform = "scale(.75)";
    await frame();
    alignment("scaled panel");
    settings.style.maxHeight = "0px";
    await frame();
    settings.style.maxHeight = "5000px";
    document.getElementById("createIframe").style.transform = "";
    await frame();
    alignment("reopened settings");
    row.querySelector(".explanation").click();
    check(!input.checked && !__xcIsSkinEffectsBlocked(), "caption toggles back off");
    installSkinEffectButton();
    check(document.querySelectorAll("#xcSkinEffectToggle").length === 1, "reinstall has no duplicate controls");
    const parent = settings.parentElement, clone = parent.cloneNode(true);
    clone.querySelector("#xcTopMarqueeSwitchRow").remove();
    clone.querySelector("#xcSkinEffectSwitchRow").remove();
    parent.replaceWith(clone);
    installTopMarqueeButton();
    installSkinEffectButton();
    await frame();
    check(document.querySelectorAll("#xcSkinEffectToggle").length === 1 && !document.getElementById("xcSkinEffectToggle").checked,
      "rebuilt panel preserves state and clears old UI handlers");
    alignment("rebuilt panel");
    check(logs.some(x => x.includes("toggle:on")) && logs.some(x => x.includes("toggle:off")), "diagnostics use debug-window bridge");
    document.getElementById("xcSkinEffectTestResult").textContent = "PASS " + passed.length + " checks: " + passed.join("; ");
  } catch (error) {
    document.getElementById("xcSkinEffectTestResult").textContent = "FAIL after " + passed.length + " checks: " + error.stack;
  } finally {
    cleanupSkinEffectBlocker();
    cleanupSkinEffectButton();
    cleanupTopMarqueeButton();
  }
}

const html = '<!doctype html><meta charset="utf-8"><style>body{background:#202020}#createIframe{position:relative;margin:30px;width:380px;transform-origin:top left}#iframe-source{position:relative;display:flow-root}</style>' +
  '<div id="createIframe"><div id="iframe-source">' + markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "") + '</div></div><pre id="xcSkinEffectTestResult">PENDING</pre>' +
  '<script>window.onerror=function(message,url,line){document.getElementById("xcSkinEffectTestResult").textContent="FAIL script: "+message+" line "+line;};</script>' +
  '<script>(' + fixture + ')(' + JSON.stringify(native.seatMethods + native.legacySeatMethods) + ');</script><script>const tooltipStrings=' + JSON.stringify({ ...rainbow.all, ...rainbow.used }) +
  ';const _0x41a3d0=n=>tooltipStrings[n];' + controller + helpers + tooltip + marqueeButton + skinButton + '</script><script>window.addEventListener("load",' + checks + ');</script>';
const browserPath = [process.env.SKIN_EFFECT_TEST_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p => p && fs.existsSync(p));
assert(browserPath, "an installed Chromium browser is required");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "xc-skin-effect-test-"));
const server = http.createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:" });
  response.end(html);
});
server.listen(0, "127.0.0.1", () => {
  const browser = spawn(browserPath, ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--window-size=1000,900", "--dump-dom", "--virtual-time-budget=5000", "--user-data-dir=" + profile, "http://127.0.0.1:" + server.address().port], { windowsHide: true });
  let output = "", diagnostics = "";
  browser.stdout.on("data", chunk => { output += chunk; });
  browser.stderr.on("data", chunk => { diagnostics += chunk; });
  const timeout = setTimeout(() => browser.kill(), 30000);
  browser.on("error", error => { diagnostics += error.stack; });
  browser.on("close", () => {
    clearTimeout(timeout);
    server.close();
    const result = output.match(/<pre id="xcSkinEffectTestResult">([\s\S]*?)<\/pre>/)?.[1];
    process.stdout.write((result || diagnostics || "No browser result") + "\n");
    fs.writeFileSync(path.join(profile, "result.html"), output);
    process.stdout.write("Test artifacts: " + profile + "\n");
    process.exitCode = result?.startsWith("PASS ") ? 0 : 1;
  });
});
