// OL PingJianWindow adapter. Reads the live window; never constructs a game window.
module.exports = function createXuShaoClient({ getLaya, getEngine, document }) {
  // Verified ordinary Config.sgs, 2026-11-13. Each tuple: XSPJ.id, name, spell, skill name.
  const lexicon = [[110,"年轻的贤君",872,"制衡"],[760,"江表之力牧",921,"魄袭"],[190,"高贵的名门",102,"乱击"],[497,"街亭之殇",236,"散谣"],[284,"曹魏的谋主",423,"奇策"],[1023,"慨然永怀",3266,"观骨"],[720,"虎豹骑首",3691,"缮甲"],[682,"北地枪王",830,"雄乱"],[1014,"双剑化龙",3253,"剑合"],[1205,"乱世谋焚",3510,"焚城"],[862,"洞悉先机者",3190,"乱武"],[1192,"瀚海鲸波",3503,"平端"],[931,"勒格诗惹",3107,"蛮王"],[1382,"坚朴的忠相",3672,"募讨"],[1457,"火神的祝佑",4009,"刃掣"],[592,"螳臂当车",280,"鼓舌"],[1392,"利刃风骑",3804,"整兵"],[1375,"以时进讨",3772,"平讨"],[1364,"帷幄擎炬",3750,"迁附"],[1245,"一战天下定",3564,"西向"],[1098,"社稷之器",3352,"蓄发"],[961,"朗朗日月",3157,"清议"],[940,"鬼斧神工",11003,"神工"],[1149,"相机而动",3408,"离论"],[851,"花俏蛮娇",9010,"蛮嗣"],[1398,"天阶登志",3822,"移势"],[1468,"雅量之魁英",4025,"醉锋"],[1046,"中才之相",3328,"晏如"],[1246,"踌躇的孤雁",3566,"逐北"],[1229,"地载十六州",4023,"采风"],[1288,"万夫之勇",3622,"轮战"],[1252,"良平之奇",3574,"完策"],[1416,"伊侍佐佑",3854,"择行"],[1344,"狂才傲世",3707,"狂狷"],[620,"社稷的先驱",377,"筹策"],[90,"早终的先知",52,"遗计"],[412,"治世之能臣",717,"奸雄"],[235,"天下归心",310,"归心"],[354,"法不容情",445,"御策"],[1059,"机捷谈笑",3321,"惶汗"],[1225,"委蛇两端",3539,"恇守"],[204,"霸业继承者",106,"放逐"],[1256,"无愆垣下",3581,"临节"],[181,"驱虎吞狼",93,"节命"],[923,"慧眼识君",3098,"烈节"],[1177,"神通妙算",3492,"称象"],[557,"天资的明君",730,"恢拓"],[1378,"垂宪后叶",763,"殚心"],[1032,"魁立倾厦",3273,"谏旋"],[1233,"尔卜尔筮",3547,"蓍算"],[1156,"才惠双绝",3845,"理贤"],[783,"省身明德",946,"省身"],[1230,"红烛垂泪",3543,"思泣"],[841,"仰观太虚",988,"雅士"],[435,"恃才放旷",206,"鸡肋"],[420,"心吞三国",718,"反馈"],[1394,"环佩解君",3810,"妙心"],[120,"绝世的舞姬",67,"闭月"],[133,"固若金汤",370,"据守"],[298,"归汉的才女",265,"默识"],[296,"鬼神之勇",373,"励战"],[361,"狂直之士",453,"直言"],[674,"临难死义",818,"罪论"],[1181,"意前笔启",3483,"诫厉"],[1102,"炎志灼心",3395,"燃己"],[1332,"歧路也汤汤",3693,"苦渡"],[401,"大义不惜",472,"秘计"],[1363,"烛照官渡",3752,"焚巢"],[1477,"后后嘉荣",4039,"追忆"],[678,"扣弦的豪将",826,"镇骨"],[1325,"坚争抗壮",3684,"义叱"],[765,"小家碧玉",958,"飘零"],[1090,"遐雁归迩",3511,"联句"],[1011,"详阴阳之妙",3903,"天候"],[893,"制霸南中",3066,"再起"],[884,"武侯长史",3053,"狷狭"],[1003,"天行有常",3233,"星卜"],[965,"冠宇啸北",3165,"襄戍"],[539,"雄长百越",262,"避乱"]];
  // Adapter owns only its visual leases, never the board selection or result arrays.
  const highlights = new Map();
  // Weak keys retain stable assignments across toggles without retaining old windows.
  const boardColors = new WeakMap();
  const meritPalette = ["#60C5FF", "#D95AC7", "#258A61", "#E47735", "#7860C7", "#C44356", "#158EAD", "#7A8E29", "#925B37"];
  function meritColor(frame, arcId) {
    let scope = boardColors.get(frame.board);
    if (!scope || scope.words !== frame.wordsIdentity || scope.scene !== frame.scene) {
      scope = { words: frame.wordsIdentity, scene: frame.scene, colors: new Map() };
      boardColors.set(frame.board, scope);
    }
    if (!scope.colors.has(arcId)) {
      const index = scope.colors.size;
      // Current four/five-character merits fit nine disjoint groups in 36 cells.
      // Expand in hex (also supported by native Laya text) if future data exceeds that.
      let color = meritPalette[index];
      if (!color) {
        const hue = ((index - meritPalette.length) * 137.508) % 360;
        const channel = n => {
          const k = (n + hue / 30) % 12;
          return Math.round(255 * (0.48 - 0.32 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
        };
        color = "#" + channel(0) + channel(8) + channel(4);
      }
      scope.colors.set(arcId, color);
    }
    return scope.colors.get(arcId);
  }
  let eggScope = null;
  function liveScope(scope) {
    return scope.live && !scope.board.destroyed && scope.board.WordsStr === scope.words;
  }
  function suppressEggNodes(scope) {
    if (!liveScope(scope)) return;
    const board = scope.board;
    for (const index of board.hideIds || []) revealEggText(scope, index);
    const nodes = new Set((board.items || []).map(ui => ui?.hideTex).concat(board.eggHideSps || [], board.eggHideEffs || []));
    for (const index of board.helpIds || []) if (nativeType(board, index) === 3) nodes.add(board.items?.[index]?.spEff);
    for (const [node, alpha] of Array.from(scope.nodes)) if (!nodes.has(node)) {
      if (!node.destroyed && node.alpha === 0) node.alpha = alpha;
      scope.nodes.delete(node);
    }
    for (const node of nodes) {
      if (!node || node.destroyed) continue;
      if (!scope.nodes.has(node)) scope.nodes.set(node, node.alpha);
      node.alpha = 0;
    }
  }
  function clearEggs() {
    const scope = eggScope; eggScope = null;
    if (!scope) return;
    scope.live = false;
    for (const hook of scope.hooks) {
      if (hook.target[hook.name] !== hook.wrapper) continue;
      if (hook.descriptor) Object.defineProperty(hook.target, hook.name, hook.descriptor);
      else delete hook.target[hook.name];
    }
    for (const [ui, hook] of scope.hideHooks) {
      const current = Object.getOwnPropertyDescriptor(ui, "Hide");
      if (current?.set !== hook.setter || current?.get !== hook.getter) continue;
      if (hook.original) Object.defineProperty(ui, "Hide", hook.original);
      else delete ui.Hide;
    }
    if (!scope.board.destroyed && scope.board.WordsStr === scope.words) {
      for (const [ui, entry] of scope.revealed) {
        if (!ui.destroyed && scope.board.items?.[entry.index] === ui && ui.topTxt === entry.text &&
            ui.topTxt.visible === true && scope.board.hideIds?.includes(entry.index) &&
            nativeType(scope.board, entry.index) !== 1) ui.Hide = true;
      }
    }
    scope.hideHooks.clear(); scope.revealed.clear();
    if (!scope.board.destroyed && scope.board.WordsStr === scope.words && scope.board.preHideIds === scope.maskedPreHide) scope.board.preHideIds = scope.originalPreHide;
    for (const [node, alpha] of scope.nodes) if (!node.destroyed && node.alpha === 0) node.alpha = alpha;
    scope.nodes.clear();
    // UpdateUI(3) now returns early, so replay only gray loops we actually skipped.
    // Resolve the current method after uninstall so later wrappers remain in control.
    const current = read();
    if (current?.board === scope.board && current.scene === scope.scene && current.wordsIdentity === scope.words) {
      for (const [ui, entry] of scope.skippedHelp) {
        if (!ui.destroyed && scope.board.items?.[entry.index] === ui &&
            ui.spEff === entry.effect && !ui.spEff?.destroyed && ui.type === 3 &&
            nativeType(scope.board, entry.index) === 3) ui.playGrayEff();
      }
    }
    scope.skippedHelp.clear();
  }
  function installVisualHook(scope, target, name, intercept) {
    if (scope.hooks.some(hook => hook.target === target && hook.name === name)) return;
    const original = target[name];
    if (typeof original !== "function") return;
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    const wrapper = function (...args) {
      if (this !== target || !liveScope(scope)) return original.apply(this, args);
      return intercept(original, this, args);
    };
    Object.defineProperty(target, name, { configurable: true, writable: true, enumerable: descriptor?.enumerable || false, value: wrapper });
    scope.hooks.push({ target, name, descriptor, wrapper });
  }
  function installHelpHooks(scope) {
    for (const [index, ui] of (scope.board.items || []).entries()) if (ui) {
      installEggHideHook(scope, ui, index);
      installVisualHook(scope, ui, "playGrayEff", (original, target, args) => {
        if (scope.board.items[index] === target && nativeType(scope.board, index) === 3) {
          scope.skippedHelp.set(target, { index, effect: target.spEff });
          return;
        }
        scope.skippedHelp.delete(target);
        return original.apply(target, args);
      });
    }
  }
  function revealEggText(scope, index) {
    const board = scope.board, ui = board.items?.[index];
    if (!liveScope(scope) || currentWindow() !== board || getLaya()?.gamescene !== scope.scene ||
        !board.hideIds?.includes(index) || nativeType(board, index) === 1 ||
        !ui || ui.destroyed || !ui.topTxt || ui.topTxt.destroyed) return;
    scope.revealed.set(ui, { index, text: ui.topTxt });
    // Keep the real board text, not the underlying duplicate button label.
    ui.topTxt.visible = true;
    if (ui.textField) ui.textField.visible = false;
  }
  function installEggHideHook(scope, ui, index) {
    if (scope.hideHooks.has(ui)) return;
    const original = Object.getOwnPropertyDescriptor(ui, "Hide");
    let owner = ui, descriptor = original;
    while (!descriptor && (owner = Object.getPrototypeOf(owner))) descriptor = Object.getOwnPropertyDescriptor(owner, "Hide");
    if (typeof descriptor?.set !== "function" || original?.configurable === false) return;
    const nativeSet = descriptor.set, getter = descriptor.get;
    const setter = function (hidden) {
      nativeSet.call(this, hidden);
      if (this === ui && hidden && scope.board.items?.[index] === ui) revealEggText(scope, index);
    };
    Object.defineProperty(ui, "Hide", { configurable: true, enumerable: descriptor.enumerable, get: getter, set: setter });
    scope.hideHooks.set(ui, { original, setter, getter });
  }
  function finalizeHidden(scope, index) {
    if (Number.isInteger(index)) revealEggText(scope, index);
    suppressEggNodes(scope);
  }
  function hideEggs(frame) {
    if (currentWindow() !== frame.board || frame.board.destroyed || frame.board.WordsStr !== frame.wordsIdentity) { clearEggs(); return; }
    if (!eggScope || eggScope.board !== frame.board || eggScope.words !== frame.wordsIdentity) {
      clearEggs();
      const scope = eggScope = { board: frame.board, scene: frame.scene, words: frame.wordsIdentity,
        nodes: new Map(), skippedHelp: new Map(), hideHooks: new Map(), revealed: new Map(), hooks: [], live: true,
        originalPreHide: frame.board.preHideIds, maskedPreHide: null };
      const board = frame.board;
      // These are display-only, void native methods. Do not enqueue egg Tween/timers.
      for (const name of ["playEggEff", "onEggEffStoped"]) installVisualHook(scope, board, name, (original, target, args) => finalizeHidden(scope, args[0]));
      installVisualHook(scope, board, "playMultiGridEff", (original, target, args) => {
        const id = args[0], helped = board.helpDatas?.some(row => row.SpellId === id);
        if (helped && !board.matchedDatas?.some(row => row.SpellId === id)) return;
        return original.apply(target, args);
      });
      installVisualHook(scope, board, "updateItemUI", (original, target, args) => {
        installHelpHooks(scope);
        // preHideIds is the native rendering cache, not the received result/hideIds.
        // Mark eggs as already rendered to skip allocating/playing the interference branch.
        scope.maskedPreHide = (board.hideIds || []).slice(); board.preHideIds = scope.maskedPreHide;
        for (const index of board.hideIds || []) finalizeHidden(scope, index);
        try { return original.apply(target, args); }
        finally {
          suppressEggNodes(scope);
          const current = read();
          if (current?.board === board && current.wordsIdentity === scope.words) highlight(current, combinations(current));
        }
      });
    }
    installHelpHooks(eggScope);
    suppressEggNodes(eggScope);
  }
  const nativeFirstColor = "#60C5FF";
  function nativeType(board, index) {
    if (board.matchedIds?.includes(index)) return 1;
    if (board.selectIds?.includes(index)) return 2;
    if (board.helpIds?.includes(index)) return 3;
    return board.firstIds?.includes(index) ? 4 : 5;
  }
  function release(ui, entry) {
    highlights.delete(ui);
    const board = entry.board;
    if (board.destroyed || ui.destroyed || board.WordsStr !== entry.words || board.items?.[entry.index] !== ui) return;
    const type = nativeType(board, entry.index);
    const color = type === entry.type ? entry.color : ({ 1: "#8B701D", 2: "#8B701D", 3: "#5D5B60", 4: nativeFirstColor, 5: "#665973" })[type];
    if (ui.topTxt?.color === entry.appliedColor) ui.topTxt.color = color;
    if (ui.labelColors === entry.appliedLabels) ui.labelColors = type === entry.type ? entry.labels : new Array(5).fill(color).join(",");
  }
  function clearHighlights() {
    for (const [ui, entry] of Array.from(highlights)) release(ui, entry);
  }
  function highlight(frame, rows) {
    const board = frame.board;
    if (currentWindow() !== board || board.destroyed || board.WordsStr !== frame.wordsIdentity) { clearHighlights(); return; }
    const wanted = new Map();
    for (const row of rows) for (const index of row.indices) wanted.set(index, row.color);
    for (const [ui, entry] of Array.from(highlights)) {
      const type = nativeType(entry.board, entry.index);
      if (entry.board !== board || entry.words !== frame.wordsIdentity || board.items?.[entry.index] !== ui || !wanted.has(entry.index) || type === 1 || type === 2) release(ui, entry);
    }
    for (const [index, color] of wanted) {
      const ui = board.items?.[index], type = nativeType(board, index);
      if (!ui || ui.destroyed || !ui.topTxt || type === 1 || type === 2) continue;
      let entry = highlights.get(ui);
      if (!entry) { entry = { board, words: frame.wordsIdentity, index, type, color: ui.topTxt.color, labels: ui.labelColors }; highlights.set(ui, entry); }
      else {
        if (ui.topTxt.color !== entry.appliedColor) { entry.type = type; entry.color = ui.topTxt.color; }
        if (ui.labelColors !== entry.appliedLabels) entry.labels = ui.labelColors;
      }
      // Keep native ui.type/background/selection unchanged. UpdateUI(4) would restart effects.
      const labels = new Array(5).fill(color).join(",");
      if (ui.topTxt.color !== color) ui.topTxt.color = color;
      if (ui.labelColors !== labels) ui.labelColors = labels;
      entry.appliedColor = color; entry.appliedLabels = labels;
    }
  }
  function currentWindow() {
    const laya = getLaya();
    const manager = laya?.class?.("WindowManager");
    // GetWindowByName may create windows. The existing dictionary is read-only here.
    return manager?.WindowInstanceDict?.get?.("PingJianWindow") || laya?.win?.("PingJianWindow") || null;
  }
  function read() {
    const board = currentWindow(), scene = getLaya()?.gamescene;
    if (!scene || !board || board.destroyed || !board.parent || board.visible === false ||
        !board.inited || Number(board.Skill?.ID) !== 3911 || !board.seat?.IsSelf ||
        !Array.isArray(board.WordsStr) || board.WordsStr.length !== 36 ||
        !Array.isArray(board.gridSkillIdArr) || board.gridSkillIdArr.length !== 36) return null;
    const context = getLaya()?.class?.("GameContext");
    if (context?.IsViewer || context?.IsMatchOB || context?.IsViewerOrReplay?.()) return null;
    return {
      board, scene, context, wordsIdentity: board.WordsStr, seat: board.seat, skill: board.Skill,
      words: board.WordsStr.slice(), skills: board.gridSkillIdArr.slice(),
      matched: (board.matchedIds || []).slice(), helped: (board.helpIds || []).slice(),
      hidden: (board.hideIds || []).slice(),
    };
  }
  function charKey(text) { return Array.from(text).sort().join(""); }
  function combinations(frame) {
    const output = [], seen = new Set(), matched = new Set(frame.matched);
    for (let begin = 0; begin < 36; begin++) for (const step of [1, 6]) {
      for (let length = 2; length <= 6; length++) {
        const end = begin + (length - 1) * step;
        if (end >= 36 || (step === 1 && Math.floor(begin / 6) !== Math.floor(end / 6))) break;
        const indices = Array.from({ length }, (_, index) => begin + index * step);
        if (indices.some(index => matched.has(index))) continue;
        const spell = Number(frame.skills[begin]);
        if (!spell || indices.some(index => Number(frame.skills[index]) !== spell)) continue;
        const text = indices.map(index => frame.words[index]).join("");
        const entry = lexicon.find(row => row[2] === spell && charKey(row[1]) === charKey(text));
        if (!entry) continue;
        const key = spell + ":" + begin + ":" + end;
        if (seen.has(key)) continue;
        seen.add(key);
        output.push({ key, arcId: entry[0], color: meritColor(frame, entry[0]), spell, name: entry[3], text: entry[1], begin, end, indices,
          direction: step === 1 ? "横向" : "纵向",
          hidden: indices.some(index => frame.hidden.includes(index)),
          helped: indices.some(index => frame.helped.includes(index)) });
      }
    }
    return output;
  }
  function bounds(frame) {
    const engine = getEngine(), board = frame.board, canvas = document.querySelector("canvas");
    if (!engine?.Point || !engine.stage?.width || !canvas || typeof board.localToGlobal !== "function") return null;
    const rect = canvas.getBoundingClientRect(), stage = engine.stage;
    const first = board.localToGlobal(new engine.Point(0, 0));
    const last = board.localToGlobal(new engine.Point(board.width, board.height));
    return { left: rect.left + first.x * rect.width / stage.width,
      right: rect.left + last.x * rect.width / stage.width,
      top: rect.top + first.y * rect.height / stage.height,
      bottom: rect.top + last.y * rect.height / stage.height };
  }
  return Object.freeze({ read, combinations, bounds, highlight, clearHighlights, hideEggs, clearEggs });
};
