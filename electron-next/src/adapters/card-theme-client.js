// Native card UI / Laya texture boundary. The host supplies its closure-local client.
module.exports = function createCardThemeClient({ window, getLaya, getEngine, getRegisteredUis, log = () => {} }) {
  let normalPrototype = null, enabled = false;
  const hooks = [];
  const pendingLoads = new Set();
  let bridgeBootstrap = null;
  function cardOf(ui) { return ui && (ui.Card || ui.theCard); }
  function listUis() {
    try { return getRegisteredUis().filter(ui => ui && !ui.destroyed); } catch (_) { return []; }
  }
  function resolveNormalPrototype() {
    try {
      const type = getLaya().class('NormalCardUi');
      const candidate = typeof type === 'function' ? type.prototype : type;
      if (candidate && typeof candidate.ChangeFlowerAndNumber === 'function') return candidate;
    } catch (_) {}
    for (const ui of listUis()) {
      for (let proto = Object.getPrototypeOf(ui); proto; proto = Object.getPrototypeOf(proto)) {
        if (Object.prototype.hasOwnProperty.call(proto, 'ChangeFlowerAndNumber') &&
            Object.prototype.hasOwnProperty.call(proto, 'UpdateCardFace')) return proto;
      }
    }
    return null;
  }
  function describe(ui, temporary) {
    const card = cardOf(ui);
    if (!ui || ui.destroyed || !card || !normalPrototype || !normalPrototype.isPrototypeOf(ui) ||
        ui.UpdateCardFace !== normalPrototype.UpdateCardFace || !ui.bmpFace ||
        card.IsEmpty || card.IsYiCard || ui.IsYiCard || ui.isPokerCardFace || ui.IsPokerCardFace ||
        ui.dontUpdateCard || ui.changeSkillTex || card.IsMultiSkillState ||
        (card.IsVirtualCard && !card.VirtualShowOrignColorAndNumber)) return null;
    const flower = temporary && temporary.card === card ? temporary.flower :
      (card.DisplayFlower != null ? card.DisplayFlower : card.IsModyfifyByServer ? card.FlowerOnSeat : card.CardFlower);
    const number = temporary && temporary.card === card ? temporary.number : card.CardNumber;
    const resource = String(card.ResName || '');
    return { card, key: resource.endsWith('_png') ? resource : resource + '_png', flower: Number(flower), number: Number(number) };
  }
  function specialFaceReason(ui, method, args = []) {
    const card = cardOf(ui);
    if (method === 'SwitchToPokerCardFace') return '扑克卡面';
    if (method === 'UpdateMultiSkill') return card && card.IsMultiSkillState ? '多技能状态' : null;
    if (method === 'UpdateSuiJiYingBian') return card && card.AvatarSkill ? '随机应变变牌' : null;
    if (method === 'SetChangeSkill') return args[0] ? '技能变牌标识' : null;
    if (method === 'UpdateCardFaceRes') return '指定牌面资源';
    if (method === 'UpdateCardFaceOrBackRes') return '指定正反面资源';
    return null;
  }
  function getFaceContentLayers(ui) {
    if (!ui || !ui.isNewCardUI || typeof ui.updateNewCardFace !== 'function') return [];
    // Current native normal cards render these above bmpFace; borders, tags and functional overlays stay native.
    return ['bmpFace2', 'bmpNormalName', 'bmpNameBg', 'bmpName', 'bmpCardType', 'bmpSmallDesc']
      .map(key => ({ key, node: ui[key] })).filter(item => item.node && typeof item.node.visible === 'boolean');
  }
  function wrap(target, name, before, after) {
    if (!target || typeof target[name] !== 'function' || hooks.some(h => h.target === target && h.name === name)) return;
    const descriptor = Object.getOwnPropertyDescriptor(target, name), original = target[name];
    const entry = { target, name, descriptor, live: true, wrapper: null };
    function invoke(callback, ui, args) {
      if (!callback || !entry.live || !enabled) return;
      try { callback(ui, args, name); } catch (error) { log('绘制适配失败', error); }
    }
    entry.wrapper = function (...args) {
      invoke(before, this, args);
      const result = original.apply(this, args);
      invoke(after, this, args);
      return result;
    };
    Object.defineProperty(target, name, { configurable: true, writable: true,
      enumerable: descriptor ? descriptor.enumerable : false, value: entry.wrapper });
    hooks.push(entry);
  }
  function install(callbacks) {
    if (enabled && normalPrototype) return true;
    normalPrototype = resolveNormalPrototype();
    if (!normalPrototype) return false;
    enabled = true;
    wrap(normalPrototype, 'UpdateCardFace', callbacks.beforeUpdate, callbacks.afterUpdate);
    wrap(normalPrototype, 'ChangeFlowerAndNumber', callbacks.beforeTemporary, callbacks.afterTemporary);
    // setCardBack installs an own SetCardFace on this prototype and keeps __SetCardFace.
    // Wrap the effective dispatch method, including that wrapper, rather than a bypassed parent method.
    wrap(normalPrototype, 'SetCardFace', callbacks.beforeFace, callbacks.afterFace);
    wrap(normalPrototype, 'updateNewCardFace', callbacks.beforeContentUpdate, callbacks.afterContentUpdate);
    wrap(normalPrototype, 'resetNewCardFace', callbacks.beforeContentReset, null);
    wrap(normalPrototype, 'Draw', null, callbacks.afterDraw);
    for (const name of ['clear', 'Clear', 'destroy']) wrap(normalPrototype, name, callbacks.beforeClear, null);
    for (const name of ['SwitchToPokerCardFace', 'UpdateSuiJiYingBian', 'UpdateMultiSkill', 'SetChangeSkill',
      'UpdateCardFaceRes', 'UpdateCardFaceOrBackRes'])
      wrap(normalPrototype, name, callbacks.beforeSpecial, callbacks.afterSpecial);
    return true;
  }
  function dispose() {
    enabled = false;
    for (const cancel of [...pendingLoads]) cancel();
    for (const hook of hooks.splice(0).reverse()) {
      hook.live = false;
      if (hook.target[hook.name] !== hook.wrapper) continue;
      if (hook.descriptor) Object.defineProperty(hook.target, hook.name, hook.descriptor);
      else delete hook.target[hook.name];
    }
    normalPrototype = null;
  }
  function bootstrapLegacyBridge() {
    if (bridgeBootstrap) return bridgeBootstrap;
    bridgeBootstrap = Promise.resolve().then(() => {
      try {
        const remote = window.electron && window.electron.remote;
        if (!remote || typeof remote.require !== 'function' || !remote.app) return false;
        const path = remote.require('path');
        const file = path.join(remote.app.getPath('userData'), 'modules/runtime/card-theme-assets.js');
        const runtime = remote.require(file);
        const result = runtime && typeof runtime.bootstrapCardThemeAssets === 'function' && runtime.bootstrapCardThemeAssets();
        if (result && result.ok) { log('旧客户端素材接口已自动接通'); return true; }
      } catch (_) {}
      log('旧客户端素材接口初始化失败，保留原生图层');
      return false;
    });
    return bridgeBootstrap;
  }
  async function readAsset(relative) {
    const api = window.daxiaochaoElectron;
    const ipc = window.electron && window.electron.ipcRenderer;
    const invoke = api && typeof api.readCardThemeAsset === 'function' ? value => api.readCardThemeAsset(value) :
      ipc && typeof ipc.invoke === 'function' ? value => ipc.invoke('read-card-theme-asset', value) : null;
    if (!invoke) return { ok: false, code: 'host-unavailable' };
    try { return await invoke(relative); }
    catch (error) {
      // A file failure or installation barrier is not a missing handler and must not trigger another registration.
      if (!/No handler registered for ['"]read-card-theme-asset['"]/.test(String(error && error.message || error))) throw error;
      if (!(await bootstrapLegacyBridge())) return { ok: false, code: 'host-unavailable' };
      return invoke(relative);
    }
  }
  function makeTexture(dataUrl, logicalSize) {
    return new Promise(resolve => {
      const engine = getEngine();
      if (!engine || !engine.loader || !engine.Handler || !engine.Texture) return resolve(null);
      let finished = false;
      const timer = window.setTimeout(() => finish(null), 8000);
      const cancel = () => {
        if (typeof engine.loader.cancelLoadByUrl === 'function') engine.loader.cancelLoadByUrl(dataUrl);
        finish(null);
      };
      pendingLoads.add(cancel);
      function finish(value) {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        pendingLoads.delete(cancel);
        resolve(value);
      }
      try {
        engine.loader.load(dataUrl, engine.Handler.create(null, () => {
          if (finished) return;
          const texture = engine.loader.getRes(dataUrl);
          if (!texture || texture.destroyed) return finish(null);
          const result = engine.Texture.create(texture, 0, 0, texture.width, texture.height,
            texture.offsetX || 0, texture.offsetY || 0, texture.sourceWidth, texture.sourceHeight);
          result.width = logicalSize[0];
          result.height = logicalSize[1];
          // These standalone PNGs are untrimmed 2x artwork. Keep logical trim/source metrics consistent.
          result.sourceWidth = logicalSize[0];
          result.sourceHeight = logicalSize[1];
          result.offsetX = 0;
          result.offsetY = 0;
          finish(result);
        }), null, engine.Loader.IMAGE);
      } catch (_) { finish(null); }
    });
  }
  function releaseTexture(texture, dataUrl) {
    try { if (texture && !texture.destroyed) texture.destroy(false); } catch (_) {}
    try { if (dataUrl) getEngine().loader.clearRes(dataUrl); } catch (_) {}
  }
  return { cardOf, listUis, describe, specialFaceReason, getFaceContentLayers,
    install, dispose, readAsset, makeTexture, releaseTexture };
};
