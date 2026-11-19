// Cross-version native skin sharing.
// The client already merges skins for generals linked by character.json GeneralSkinParent
// (e.g. 刘备 1 <-> 界刘备 299). Versions the config leaves apart (吴苋 389 / 族吴苋 528) get
// separate buckets in GeneralSkinManager.GeneralSkinDict, so their selection windows never
// list each other's skins. This module extends the same merge at the single read gate
// GetGeneralSkinIncludeHide, which feeds both skin-selection windows, the online skin list
// and the skin voice list. Ownership checks (GetSkinListBySkinID) stay untouched, and the
// select request still travels the native skinID path.
module.exports = function createNativeSkinLink({ window, document, storage, laya: injectedLaya, groups = [], log = () => {} }) {
  const key = 'xcNativeSkinLink.v1', HOOK_KEY = '__xcNativeSkinLinkHook';
  // The host script ships its own laya facade whose class(name) resolves game managers through a
  // name table (GeneralSkinManager is registered there). window.laya is the engine namespace, whose
  // class() only registers classes and returns nothing useful when asked for a manager, so the
  // injected facade must win. Hosts that cannot hand the facade over expose it as __xcLayaFacade.
  function runtime() {
    if (injectedLaya && typeof injectedLaya.class === 'function') return injectedLaya;
    const relay = window.__xcLayaFacade;
    if (typeof relay === 'function') return { class: relay };
    return window.laya || window.Laya || null;
  }
  const byId = new Map();
  for (const row of groups) {
    if (!Array.isArray(row) || row.length < 3) continue;
    for (let i = 1; i < row.length; i++) {
      const id = Number(row[i]);
      if (id > 0) byId.set(id, row);
    }
  }
  let enabled = true, hook = null, shared = false, timer = null, attempts = 0, reported = false, deepTries = 0, lastFail = '';
  // >0 while a caller wants the untouched per-general bucket (skin tabs render one general per
  // page). The merge wrapper passes straight through so buckets stay separated.
  let singleDepth = 0;
  const extraHooks = [];
  const offSet = new Set();
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (saved && typeof saved === 'object') {
      if (saved.enabled === false) enabled = false;
      if (Array.isArray(saved.off)) for (const name of saved.off) if (typeof name === 'string') offSet.add(name);
    }
  } catch (_) {}
  function save() {
    try { storage.setItem(key, JSON.stringify({ enabled, off: [...offSet] })); } catch (_) {}
  }
  function groupOf(generalID) {
    const row = byId.get(Number(generalID));
    return row && !offSet.has(row[0]) ? row : null;
  }
  // laya.class may hand back the singleton, the class, or a fresh instance depending on build.
  function pickManager() {
    const laya = runtime();
    if (!laya || typeof laya.class !== 'function') return null;
    let target = null;
    try { target = laya.class('GeneralSkinManager'); } catch (_) { target = null; }
    if (!target) return null;
    if (typeof target !== 'function') {
      let node = target;
      while (node) {
        if (Object.getOwnPropertyDescriptor(node, 'GetGeneralSkinIncludeHide')) return target;
        node = Object.getPrototypeOf(node);
      }
    }
    if (typeof target.I === 'function') {
      let instance = null;
      try { instance = target.I(); } catch (_) { instance = null; }
      if (instance && typeof instance.GetGeneralSkinIncludeHide === 'function') return instance;
    }
    return null;
  }
  // What a candidate is, for the diagnostic report only.
  function shapeOf(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'function') return 'class';
    return typeof value;
  }
  // The object that actually owns GetGeneralSkinIncludeHide: the prototype when the method is a
  // class method, the instance when it is an own property. Patching a prototype takes effect for
  // every instance and works even before the singleton exists, which removes the mount-time race.
  function holderOf(value) {
    if (!value) return null;
    try {
      // The host facade resolves names through its own table and sometimes wraps the result.
      if (Array.isArray(value)) {
        for (const item of value) {
          const holder = holderOf(item);
          if (holder) return holder;
        }
        return null;
      }
      if (typeof value === 'function') {
        const proto = value.prototype;
        if (proto && typeof proto.GetGeneralSkinIncludeHide === 'function') return proto;
        if (typeof value.I === 'function') {
          let instance = null;
          try { instance = value.I(); } catch (_) { instance = null; }
          if (instance && typeof instance.GetGeneralSkinIncludeHide === 'function') {
            const node = ownerAbove(instance);
            if (node) return node;
          }
        }
        return null;
      }
      if (typeof value !== 'object') return null;
      return ownerAbove(value);
    } catch (_) { return null; }
  }
  // Walk the prototype chain and return the first object that defines the method itself.
  function ownerAbove(value) {
    let node = value;
    for (let depth = 0; depth < 8 && node; depth++) {
      const desc = Object.getOwnPropertyDescriptor(node, 'GetGeneralSkinIncludeHide');
      if (desc && typeof desc.value === 'function') return node;
      node = Object.getPrototypeOf(node);
    }
    return null;
  }
  // The registered class name and the laya.class contract both differ between OL builds, so scan
  // Laya's class registry for whatever prototype owns the method. Read-only.
  function reflectHolder() {
    const maps = [];
    for (const root of [window.Laya, window.laya, injectedLaya]) {
      if (!root || typeof root !== 'object') continue;
      const utils = root.ClassUtils;
      for (const map of [
        utils && utils._classMap, utils && utils.__classMap, utils && utils.classMap,
        root.__classmap, root._classMap, root.classMap
      ]) if (map && typeof map === 'object') maps.push(map);
    }
    for (const map of maps) {
      let keys = [];
      try { keys = Object.keys(map); } catch (_) { continue; }
      for (const key of keys) {
        const holder = holderOf(map[key]);
        if (holder) return holder;
      }
    }
    return null;
  }
  // Nothing registers the manager under a stable name in this build: the singleton is only
  // reachable from live engine / game objects. These are the entry points that exist regardless
  // of the class registry, so the walk still has somewhere to start.
  function hostStarts() {
    const out = [];
    const push = value => { if (value) out.push(value); };
    for (const ns of [window.Laya, window.laya, injectedLaya]) {
      if (!ns || typeof ns !== 'object') continue;
      push(ns.gamescene); push(ns.stage); push(ns.scene); push(ns.timer);
      push(ns.loader); push(ns.ResourceManager); push(ns.LocalStorage);
    }
    const laya = runtime();
    if (laya && typeof laya.class === 'function') {
      for (const name of ['GameContext', 'GameGeneralManager', 'TaskManager', 'RoomControler',
        'Self', 'TimerManager', 'PromptLayer', 'NewPrivilegeCardManager']) {
        for (const extra of [[name], [name, true]]) {
          let value = null;
          try { value = laya.class.apply(laya, extra); } catch (_) { value = null; }
          push(value);
        }
      }
    }
    return out;
  }
  const SKIP_KEY = /^(__proto__|constructor|prototype|parent|owner|_owner)$/;
  function scanHosts() {
    const queue = hostStarts().map(node => ({ node, depth: 0, path: 'root' }));
    const seen = new Set();
    let visited = 0;
    while (queue.length && visited < 2500) {
      const current = queue.shift();
      const node = current.node;
      if (!node || seen.has(node)) continue;
      if (typeof node !== 'object' && typeof node !== 'function') continue;
      seen.add(node);
      visited++;
      const holder = holderOf(node);
      if (holder) return { holder, via: current.path };
      if (current.depth >= 4) continue;
      let keys = [];
      try { keys = Object.getOwnPropertyNames(node); } catch (_) { continue; }
      let queued = 0;
      for (const key of keys) {
        if (queued >= 60) break;
        if (SKIP_KEY.test(key)) continue;
        let value = null;
        try { value = node[key]; } catch (_) { continue; }
        if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue;
        if (value === window || value.nodeType) continue;
        queue.push({ node: value, depth: current.depth + 1, path: current.path + '.' + key });
        queued++;
      }
    }
    return null;
  }
  // Name lookup first (cheap), then the registry, then the bounded graph walk.
  function pickHolder() {
    const laya = runtime();
    const notes = [];
    if (laya && typeof laya.class === 'function') {
      for (const call of [['GeneralSkinManager'], ['GeneralSkinManager', true]]) {
        let target = null;
        try { target = laya.class.apply(laya, call); } catch (error) {
          notes.push('laya.class(' + call.join(',') + ') threw');
          continue;
        }
        const holder = holderOf(target);
        if (holder) return holder;
        notes.push('laya.class(' + call.join(',') + ')=' + shapeOf(target));
      }
    } else {
      notes.push('laya=' + shapeOf(laya));
    }
    const reflected = reflectHolder();
    if (reflected) return reflected;
    notes.push('registry=miss');
    if (deepTries < 4) {
      deepTries++;
      const scanned = scanHosts();
      if (scanned) {
        log('皮肤互通：通过 ' + scanned.via + ' 找到皮肤管理器');
        return scanned.holder;
      }
      notes.push('scan=miss');
    }
    lastFail = notes.join(' / ');
    return null;
  }
  function install() {
    if (hook) return true;
    const holder = pickHolder();
    if (!holder) { retry(); return false; }
    const existing = window[HOOK_KEY];
    if (existing && existing.holder === holder && typeof existing.wrapper === 'function') {
      hook = existing; shared = true; return true;
    }
    const original = holder.GetGeneralSkinIncludeHide;
    if (typeof original !== 'function') return false;
    const own = Object.getOwnPropertyDescriptor(holder, 'GetGeneralSkinIncludeHide');
    const wrapper = function (generalID, a, b, c) {
      const base = original.call(this, generalID, a, b, c);
      if (!enabled || singleDepth > 0) return base;
      const row = groupOf(generalID);
      if (!row) return base;
      const self = Number(generalID), out = Array.isArray(base) ? base.slice() : [];
      for (let i = 1; i < row.length; i++) {
        const peer = Number(row[i]);
        if (!(peer > 0) || peer === self) continue;
        let extra = null;
        try { extra = original.call(this, peer, a, b, c); } catch (_) { extra = null; }
        if (!Array.isArray(extra)) continue;
        for (const vo of extra) if (vo && out.indexOf(vo) < 0) out.push(vo);
      }
      return out.length ? out : base;
    };
    // Bundlers sometimes ship prototype methods as non-writable; a plain assignment would be
    // dropped in strict mode and the switch would read 已接管 while nothing changed.
    let patched = false;
    try {
      if (own && own.writable === false) {
        if (own.configurable === false) patched = false;
        else {
          Object.defineProperty(holder, 'GetGeneralSkinIncludeHide',
            { value: wrapper, writable: true, enumerable: own.enumerable, configurable: true });
          patched = true;
        }
      } else {
        holder.GetGeneralSkinIncludeHide = wrapper;
        patched = holder.GetGeneralSkinIncludeHide === wrapper;
      }
    } catch (_) { patched = false; }
    if (!patched) {
      lastFail = 'GetGeneralSkinIncludeHide 不可写（' + shapeOf(holder) + '）';
      return false;
    }
    hook = { holder, original, wrapper, own };
    shared = false; attempts = 0; reported = false; deepTries = 0; lastFail = '';
    window[HOOK_KEY] = hook;
    log('皮肤互通已挂接：' + groups.length + '组 / ' + byId.size + '个武将ID' +
      (ownsPrototype(hook) ? '（类原型）' : '（实例）'));
    return true;
  }
  function ownsPrototype(record) {
    try {
      const instance = pickManager();
      return !!instance && Object.getPrototypeOf(instance) === record.holder;
    } catch (_) { return false; }
  }
  function uninstall() {
    if (!hook) return;
    const record = hook;
    hook = null;
    if (!shared && record.holder.GetGeneralSkinIncludeHide === record.wrapper) {
      try {
        if (record.own) Object.defineProperty(record.holder, 'GetGeneralSkinIncludeHide', record.own);
        else delete record.holder.GetGeneralSkinIncludeHide;
      } catch (_) {}
    }
    if (window[HOOK_KEY] === record) window[HOOK_KEY] = null;
    shared = false;
  }
  function retry() {
    if (timer) return;
    if (attempts >= 240) {
      if (!reported) { reported = true; log('未找到 GeneralSkinManager，皮肤互通未生效'); }
      return;
    }
    attempts++;
    timer = window.setTimeout(function () { timer = null; install(); }, 500);
  }
  // Called by the local-skin switch when it unlocks: the panel button is gone, so the state is
  // driven directly instead of through a control.
  function attach() {
    enabled = true;
    save();
    attempts = 0;
    const ok = install();
    log('皮肤互通' + (ok ? '随本地皮肤启用' : '启用中（等待皮肤管理器）'));
    return ok;
  }
  function detach() {
    enabled = false;
    save();
    uninstall();
    if (timer) { window.clearTimeout(timer); timer = null; }
    log('皮肤互通已停止');
  }
  function setEnabled(next) {
    return next ? attach() : (detach(), false);
  }
  // Lets callers keep buckets separated while the merge hook stays installed (used by the skin
  // tabs, which must show exactly one general per page).
  function withBucket(fn) {
    singleDepth++;
    try { return fn(); } finally { singleDepth--; }
  }
  // Shared holder so other features can wrap sibling methods on the same prototype instead of
  // resolving the manager a second time.
  function getHolder() {
    return hook ? hook.holder : pickHolder();
  }
  function manager() {
    try { return pickManager() || (hook ? hook.holder : null); } catch (_) { return hook ? hook.holder : null; }
  }
  // Idempotent wrapper for another manager method; restores the exact descriptor on undo().
  function wrap(name, build) {
    const holder = getHolder();
    if (!holder || typeof holder[name] !== 'function') return null;
    for (const item of extraHooks) if (item.name === name) return item.undo;
    const original = holder[name];
    const own = Object.getOwnPropertyDescriptor(holder, name);
    const wrapper = build(original);
    let patched = false;
    try {
      if (own && own.writable === false && own.configurable !== false) {
        Object.defineProperty(holder, name, { value: wrapper, writable: true, enumerable: own.enumerable, configurable: true });
        patched = holder[name] === wrapper;
      } else {
        holder[name] = wrapper;
        patched = holder[name] === wrapper;
      }
    } catch (_) { patched = false; }
    if (!patched) return null;
    const undo = function () {
      const at = extraHooks.findIndex(item => item.name === name && item.wrapper === wrapper);
      if (at < 0) return;
      extraHooks.splice(at, 1);
      try {
        if (own) Object.defineProperty(holder, name, own);
        else delete holder[name];
      } catch (_) {}
    };
    extraHooks.push({ name, wrapper, undo });
    return undo;
  }
  function unwrapAll() {
    for (const item of extraHooks.slice()) item.undo();
  }
  function dispose() {
    if (timer) { window.clearTimeout(timer); timer = null; }
    unwrapAll();
    uninstall();
  }
  function status() {
    return { enabled, hooked: !!hook, shared, groups: groups.length, generals: byId.size, off: [...offSet] };
  }
  function setGroupEnabled(name, on) {
    if (typeof name !== 'string') return false;
    if (on) offSet.delete(name); else offSet.add(name);
    save();
    return !offSet.has(name);
  }
  // Read-only probe used by the in-game debug panel.
  function diagnose(generalID) {
    const row = groupOf(generalID);
    return row ? { name: row[0], ids: row.slice(1) } : null;
  }
  // Answers "did the server accept a cross-version pick?" without touching anything.
  // using  = GetSelfUsingSkinID(id), i.e. what the local UsedGeneralSkinID map holds now.
  // owner  = the general the equipped skin belongs to; != id means a cross-version pick stuck.
  function probe(generalID) {
    const id = Number(generalID);
    const manager = pickManager() || (hook ? hook.holder : null);
    if (!manager || !(id > 0)) return null;
    let using = 0, owner = null, owned = 0, name = null;
    try { using = Number(manager.GetSelfUsingSkinID(id)) || 0; } catch (_) {}
    if (using > 0) {
      try {
        const vo = manager.GetGeneralSkinBySkinID(using);
        if (vo) { owner = Number(vo.GeneralID) || null; name = vo.SkinName || vo.Name || null; }
      } catch (_) {}
      try { const list = manager.GetSkinListBySkinID(using); owned = Array.isArray(list) ? list.length : 0; } catch (_) {}
    }
    const row = groupOf(id);
    return {
      generalID: id,
      group: row ? row[0] : null,
      using,
      skinOwner: owner,
      skinName: name,
      owned,
      crossVersion: owner != null && owner !== id,
      verdict: using > 0 && owner != null && owner !== id
        ? '已生效：跨版本皮肤留在本地（服务端接受或本地写入成功）'
        : using > 0 ? '使用中为同版本皮肤' : '未记录皮肤（服务端可能已拒绝并回写默认）'
    };
  }
  window.__xcNativeSkinLinkProbe = probe;
  // One-shot diagnostic: why is / isn't the merge visible? Safe to run any time.
  function selfTest(generalID) {
    const id = Number(generalID) || 389;
    const row = groupOf(id);
    const manager = pickManager() || (hook ? hook.holder : null);
    let classShape = 'missing';
    try {
      const facade = runtime();
      const raw = facade && typeof facade.class === 'function'
        ? facade.class('GeneralSkinManager') : null;
      classShape = raw == null ? 'undefined' : typeof raw === 'function' ? 'class' : 'instance';
    } catch (error) { classShape = 'error:' + (error && error.message); }
    let nativeCount = null, mergedCount = null, sampleIDs = null;
    if (manager) {
      try {
        const base = hook ? hook.original.call(manager, id) : manager.GetGeneralSkinIncludeHide(id);
        nativeCount = Array.isArray(base) ? base.length : base;
      } catch (error) { nativeCount = 'error:' + (error && error.message); }
      try {
        const merged = manager.GetGeneralSkinIncludeHide(id);
        mergedCount = Array.isArray(merged) ? merged.length : merged;
        if (Array.isArray(merged)) sampleIDs = merged.slice(0, 20).map(vo => vo && (vo.skinID || vo.SkinID));
      } catch (error) { mergedCount = 'error:' + (error && error.message); }
    }
    const report = {
      facade: !!injectedLaya,
      laya: !!window.laya,
      layaUpper: !!window.Laya,
      classShape,
      hooked: !!hook,
      viaPrototype: hook ? ownsPrototype(hook) : null,
      enabled,
      group: row ? row[0] : null,
      groupIDs: row ? row.slice(1) : null,
      nativeCount, mergedCount, sampleIDs,
      lastFail: lastFail || null,
      verdict: !hook ? '未接管：皮肤管理器取不到（lastFail 说明每一步的结果）'
        : !enabled ? '已关闭开关'
        : mergedCount > nativeCount ? '合并生效'
        : '已接管但数量未增加'
    };
    try { log(JSON.stringify(report)); } catch (error) {}
    return report;
  }
  window.__xcNativeSkinLinkSelfTest = selfTest;
  // Exhaustive, read-only report of what the runtime actually exposes. Run this when the button
  // reads 未接管 and paste the JSON back: it shows which lookup step fails.
  function diagnoseRuntime() {
    const facade = runtime();
    const calls = {};
    for (const name of ['GeneralSkinManager', 'GameContext', 'GameGeneralManager', 'TaskManager',
      'Self', 'RoomControler']) {
      const row = {};
      for (const extra of [[name], [name, true]]) {
        const slot = extra.length > 1 ? 'instance' : 'plain';
        try {
          const value = facade && typeof facade.class === 'function'
            ? facade.class.apply(facade, extra) : undefined;
          row[slot] = shapeOf(value);
        } catch (error) { row[slot] = 'throw'; }
      }
      calls[name] = row;
    }
    const registry = {};
    for (const label of ['Laya', 'laya']) {
      const root = window[label];
      if (!root || typeof root !== 'object') continue;
      const keys = [];
      for (const map of [root.ClassUtils && root.ClassUtils._classMap,
        root.ClassUtils && root.ClassUtils.__classMap, root.__classmap, root._classMap]) {
        if (!map || typeof map !== 'object') continue;
        try {
          for (const key of Object.keys(map)) {
            if (keys.length >= 40) break;
            if (/skin|general/i.test(key)) keys.push(key);
          }
        } catch (_) {}
      }
      if (keys.length) registry[label] = keys;
      if (root.ClassUtils) {
        try { registry[label + 'ClassUtils'] = Object.keys(root.ClassUtils).slice(0, 20); } catch (_) {}
      }
    }
    let scanned = null;
    try {
      const hit = scanHosts();
      scanned = hit ? hit.via : null;
    } catch (error) { scanned = 'throw'; }
    const report = {
      facade: shapeOf(facade),
      facadeClass: facade ? typeof facade.class : 'none',
      laya: shapeOf(window.laya),
      layaClass: window.laya ? typeof window.laya.class : 'none',
      Laya: shapeOf(window.Laya),
      stage: !!((window.Laya && window.Laya.stage) || (window.laya && window.laya.stage)),
      gamescene: !!(window.laya && window.laya.gamescene),
      calls, registry, scanned,
      hooked: !!hook,
      lastFail: lastFail || null
    };
    try { log(JSON.stringify(report)); } catch (error) {}
    return report;
  }
  window.__xcNativeSkinLinkDiagnose = diagnoseRuntime;
  return { install, uninstall, attach, detach, dispose, setEnabled, setGroupEnabled, status, diagnose,
    groupOf, probe, selfTest, wrap, unwrapAll, withBucket, getHolder, manager };
};
