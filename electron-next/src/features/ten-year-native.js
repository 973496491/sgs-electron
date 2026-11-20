// Ten-year entries in native OL picker pages. Source IDs never become protocol skin IDs.
module.exports = function createTenYearNative({ window, storage, catalog, getContext, getAvatars,
  loadImage, dynamicCatalog = [], dynamic = null, notify = () => {}, log = () => {} }) {
  const STORAGE = 'xcTenYearMergedSkins.v1', BASE = 'https://web.sanguosha.com/10/pc/res/assets/runtime/general/';
  const generals = new Map(catalog.generals.map(row => [row[0], { family: row[1], label: row[2] }]));
  const rows = new Map([...catalog.skins, ...dynamicCatalog].map(row => [String(row[0]), row]));
  const artKey = row => row[9] ? 'dynamic:' + row[9].resource : 'static:' + row[1];
  const views = new WeakMap(), boundViews = new Set(), avatarHooks = new Map(), checked = new Map(), renderedAvatars = new Set();
  const pendingImages = new Set();
  const fitMasks = new Map();
  let active = false, saved = {}, avatarScene, avatarAccount;
  try { saved = JSON.parse(storage.getItem(STORAGE)) || {}; } catch (_) {}
  function context() { try { return getContext() || {}; } catch (_) { return {}; } }
  function account(c = context()) { return String(c.account || c.selfClientID || ''); }
  function choice(gid, c = context()) {
    const id = saved[account(c)]?.[String(gid)];
    return active && id != null ? rows.get(String(id)) || null : null;
  }
  function setChoice(gid, row) {
    const owner = account();
    if (!owner) throw Error('当前账号身份未就绪');
    const next = { ...saved, [owner]: { ...saved[owner] } };
    if (row) next[owner][gid] = String(row[0]); else delete next[owner][gid];
    storage.setItem(STORAGE, JSON.stringify(next)); saved = next;
  }
  function urls(row) {
    const version = (path, value) => BASE + path + row[1] + '.png' + (value ? '?v=' + value : '');
    return { big: version('big/static/', row[6]), seat: version('seat/static/', row[7]) };
  }
  const imageLoader = loadImage || (url => new Promise((resolve, reject) => {
    const image = new window.Image();
    const timer = window.setTimeout(() => done(false), 15000);
    let settled = false;
    const cancel = () => done(false);
    function done(ok) {
      if (settled) return;
      settled = true; pendingImages.delete(cancel);
      window.clearTimeout(timer); image.onload = image.onerror = null;
      if (!ok) image.src = '';
      ok ? resolve({ width: image.naturalWidth, height: image.naturalHeight }) : reject(Error('静态图片加载失败'));
    }
    pendingImages.add(cancel);
    image.onload = () => done(image.naturalWidth > 0); image.onerror = () => done(false); image.src = url;
  }));
  async function validate(row) {
    const key = String(row[0]);
    let pending = checked.get(key);
    if (!pending) {
      const pair = urls(row);
      pending = Promise.all([imageLoader(pair.big), imageLoader(pair.seat)]).then(([info]) => {
        if (!(info?.width > 0 && info?.height > 0)) throw Error('无法读取静态图尺寸');
        return info;
      });
      checked.set(key, pending);
    }
    // Image results may survive a scene change; SK templates are released by their
    // owner and must be prepared again before committing a new dynamic selection.
    try { return (await Promise.all([pending, row[9] ?
      dynamic?.prepare(row[9]) || Promise.reject(Error('动态播放器不可用')) : null]))[0]; }
    catch (error) { if (checked.get(key) === pending) checked.delete(key); throw error; }
  }
  function pages(gid) {
    const general = generals.get(Number(gid));
    if (!general) return [];
    const labels = new Set((catalog.versions || []).filter(p => p[0] === general.family).map(p => p[1]));
    for (const row of rows.values()) for (const [family, label] of row[8]) if (family === general.family) labels.add(label);
    // Same-name OL members are also candidates when this family has no ten-year art.
    // The picker checks actual entries; names alone do not claim an image is available.
    for (const g of generals.values()) if (g.family === general.family) labels.add(g.label);
    return [...labels].map(label => ({ label, ids: [...generals].filter(([, g]) => g.family === general.family && g.label === label).map(([id]) => id) }));
  }
  function entries(gid, label) {
    const general = generals.get(Number(gid));
    if (!active || !general) return [];
    const seen = new Set();
    const candidates = [...rows.values()].filter(row => row[8].some(p => p[0] === general.family && p[1] === label) &&
      (!row[9] || typeof dynamic?.prepare === 'function'));
    // Dynamic catalog rows carry the officially paired static resource in row[1].
    // Filter this page before deduplication so static aliases cannot reappear;
    // keep all source rows for saved choices and the player's static fallback.
    const dynamicStatics = new Set(candidates.filter(row => row[9]).map(row => String(row[1])));
    return candidates.filter(row => row[9] || !dynamicStatics.has(String(row[1])))
      .sort((a, b) => Number(!!a[9]) - Number(!!b[9]) || Number(a[0] !== Number(a[1])) - Number(b[0] !== Number(b[1])) || Number(a[0]) - Number(b[0]))
      .filter(row => { const key = artKey(row); if (seen.has(key)) return false; seen.add(key); return true; }).map(row => {
      const pair = urls(row);
      // Native item.InitData consumes these static display fields. 0 is a real OL default,
      // while the separate entry key distinguishes every source row and its using marker.
      return { skinID: 0, generalID: Number(gid), skinname: row[2], __xcTenYearEntry: String(row[0]),
        __xcSkinKey: 'ten:' + row[0], SkinSeatUrl: pair.seat, SkinUrlInWindow: pair.seat,
        SkinUrlInTip: pair.seat, SkinBigUrl: () => pair.big, SkinMaxUrl: () => pair.big,
        BaseInfo: null, CanUpdate: false, CanCompose: false, IsManyStateDyskin: false, IsSkillEffect: false,
        canUpdateDynamic: () => false, skinlevel1: () => Math.min(4, Math.max(0, row[3] - 1)),
        IsBanner: !!row[5], SkinsizeType: row[5] ? 1 : 2 };
    });
  }
  function wrap(object, name, handler, keepCallbackGuard = false) {
    if (!object || typeof object[name] !== 'function') return null;
    const own = Object.getOwnPropertyDescriptor(object, name), original = object[name];
    let enabled = true;
    const replacement = function (...args) { return enabled || keepCallbackGuard ? handler.call(this, original, args) : original.apply(this, args); };
    try {
      Object.defineProperty(object, name, own && !own.configurable ? { value: replacement } :
        { value: replacement, configurable: true, writable: true, enumerable: own?.enumerable || false });
    } catch (error) { log('挂钩不可用：' + name + ' ' + error.message); return null; }
    return () => {
      enabled = false;
      if (object[name] !== replacement) return;
      if (own) Object.defineProperty(object, name, own); else delete object[name];
    };
  }
  function fixItems(view) {
    if (!active) return;
    const selected = choice(view.realGeneralID), id = selected && String(selected[0]);
    for (const item of view.itemList || []) {
      const entry = item.skinData?.__xcTenYearEntry;
      if (!entry && !id) continue;
      // Alternate IDs can reference identical artwork. Retain old preferences while
      // showing just one card for that resource in a merged page.
      const using = entry ? !!selected && rows.has(entry) && artKey(rows.get(entry)) === artKey(selected) : false;
      item.isUsing = using;
      // Some host test/adaptation builds expose writable public state instead of native getters.
      const publicUsing = Object.getOwnPropertyDescriptor(item, 'IsUsing');
      if (publicUsing?.writable) item.IsUsing = using;
      if (item.useTex) item.useTex.visible = using;
      if (!entry) continue;
      // Native KU/z_ adopts the PNG's physical size unless explicitly sized. Ten-year
      // seat images are commonly 229x270; fit the native 146x172 card slot before load completes.
      item.skinImg?.size?.(146, 172);
      item.dynamicState = 0;
      const publicDynamic = Object.getOwnPropertyDescriptor(item, 'DynamicState');
      if (publicDynamic?.writable) item.DynamicState = 0;
      item.hasSkin = true; item.isForver = true; item.skinStatus = 0;
      if (item.bg) item.bg.mouseEnabled = true;
      if (item.blackbg) item.blackbg.visible = false;
      for (const key of ['composeBg', 'composeIcon', 'composeTxt1', 'composeTxt2', 'composeTxt', 'timeBg', 'timeLimiteTxt'])
        if (item[key]) item[key].visible = false;
    }
  }
  function refresh(gid, skinID = 0, dynamic = 0) {
    sync();
    const c = context(), seat = c.selfSeat;
    if (seat && typeof seat.SetGeneralSkin === 'function' && [Number(seat.GeneralId), Number(seat.General2Id)].includes(Number(gid)))
      seat.SetGeneralSkin(Number(gid), skinID, !!dynamic);
  }
  function bindView(view) {
    if (!view || views.has(view)) return;
    const state = { token: 0, disposed: false, scene: context().scene, account: account(), undo: [] };
    views.set(view, state); boundViews.add(view);
    for (const name of ['updateContent', 'RefreshShareSkin']) {
      const undo = wrap(view, name, function (original, args) {
        const result = original.apply(this, args); fixItems(this); return result;
      });
      if (undo) state.undo.push(undo);
    }
    const clickUndo = wrap(view, 'itemClick', function (original, args) {
      const item = args[0]?.currentTarget, source = item?.skinData?.__xcTenYearEntry;
      const gid = Number(this.realGeneralID), c = { ...context() }, token = ++state.token;
      if (!active || !item) return original.apply(this, args);
      if (state.scene !== c.scene || state.account !== account(c)) { log('跳过旧场景选肤窗口'); return; }
      if (!source) {
        if (choice(gid)) {
          try { setChoice(gid, null); } catch (error) { log('切回OL失败：' + error.message); return; }
          item.isUsing = false;
          if (Object.getOwnPropertyDescriptor(item, 'IsUsing')?.writable) item.IsUsing = false;
        }
        const result = original.apply(this, args);
        refresh(gid, Number(this.closeSelectSkinId) || 0, this.closeSelectDynamicState);
        return result;
      }
      const row = rows.get(source);
      if (!row) return;
      log('检查' + (row[9] ? '动态与静态回退' : '静态图片') + '：' + row[2]);
      return validate(row).then(() => {
        const now = context();
        if (!active || state.disposed || state.token !== token || now.scene !== c.scene || account(now) !== account(c)) return;
        setChoice(gid, row);
        // The native close/destroy/send chain receives only the OL default ID and static state.
        this.closeSelectSkinId = 0; this.closeSelectDynamicState = 0;
        item.isUsing = false; item.dynamicState = 0;
        if (Object.getOwnPropertyDescriptor(item, 'IsUsing')?.writable) item.IsUsing = false;
        if (Object.getOwnPropertyDescriptor(item, 'DynamicState')?.writable) item.DynamicState = 0;
        log('选择' + (row[9] ? '动态' : '静态') + '皮肤：gid=' + gid + ' ' + row[2] + '（十周年' + row[0] + '）');
        const alternate = !row[9] && dynamicCatalog.find(candidate => candidate[9].staticId === row[0]);
        if (alternate) log('同页动态项：' + alternate[2] + '（需单独选择）');
        const result = original.apply(this, args); refresh(gid); return result;
      }).catch(error => {
        log('选择失败：' + row[2] + ' ' + error.message);
        if (active && !state.disposed && state.token === token && state.scene === context().scene && state.account === account()) {
          try { notify('十周年皮肤加载失败：' + row[2] + '，保留原选择，请重新选择'); } catch (_) {}
        }
      });
    });
    if (clickUndo) state.undo.push(clickUndo);
    const destroyUndo = wrap(view, 'destroy', function (original, args) {
      state.disposed = true; state.token++;
      try { return original.apply(this, args); }
      finally { for (const undo of state.undo.reverse()) undo(); views.delete(this); boundViews.delete(this); }
    });
    if (destroyUndo) state.undo.push(destroyUndo);
  }
  function avatarChoice(avatar) {
    const c = context();
    if (!active || !c.scene || !c.selfSeat || avatar.seat !== c.selfSeat) return null;
    return choice(Number(avatar.generalCard?.CardId), c);
  }
  function showDynamic(avatar, row) {
    if (!row?.[9]) { dynamic?.stop(avatar); return; }
    const c = context(), scene = c.scene, owner = account(c);
    dynamic?.show(avatar, row[9], () => avatarChoice(avatar) === row &&
      context().scene === scene && account() === owner);
  }
  function fit(avatar) {
    const texture = avatar.skinTex, image = texture?.texture || texture?.source;
    if (!texture || !(image?.width > 0 && image?.height > 0)) return;
    const width = avatar.width || 146, height = avatar.height || 172;
    // Native yP.ShowType owns the visible rectangle (including the half-card viewport).
    // Cover that rectangle symmetrically; keep source proportions and add no skin-specific offset.
    const owned = fitMasks.get(avatar);
    if (owned && avatar.scrollRect === owned.rect) { owned.rect.width = width; owned.rect.height = height; }
    let clip = avatar.scrollRect;
    if (!(clip?.width > 0 && clip?.height > 0)) {
      const Rectangle = (window.Laya || window.laya)?.Rectangle;
      if (typeof Rectangle === 'function') {
        const rect = new Rectangle(0, 0, width, height);
        fitMasks.set(avatar, { original: clip, rect }); avatar.scrollRect = clip = rect;
      }
    }
    const clipped = clip?.width > 0 && clip?.height > 0;
    const wBox = clipped ? clip.width : width, hBox = clipped ? clip.height : height;
    const scale = clipped ? Math.max(wBox / image.width, hBox / image.height) : Math.min(width / image.width, height / image.height);
    const w = image.width * scale, h = image.height * scale;
    texture.size?.(w, h);
    texture.pos?.((clipped ? clip.x || 0 : 0) + (wBox - w) / 2, (clipped ? clip.y || 0 : 0) + (hBox - h) / 2);
    texture.scaleX = texture.scaleY = 1;
    if (!clipped && !avatar.__xcTenYearFitWarned) {
      avatar.__xcTenYearFitWarned = true; log('裁切区域不可用，暂按完整图显示');
    }
  }
  function releaseFitMask(avatar) {
    const record = fitMasks.get(avatar);
    if (!record) return;
    if (!avatar.destroyed && avatar.scrollRect === record.rect) avatar.scrollRect = record.original;
    fitMasks.delete(avatar);
  }
  function ownerOf(object, name) {
    for (let p = object; p; p = Object.getPrototypeOf(p)) if (Object.prototype.hasOwnProperty.call(p, name)) return p;
  }
  function sync() {
    if (!active) return;
    const current = context();
    if (avatarScene !== current.scene || avatarAccount !== account(current)) {
      dynamic?.reset();
      for (const records of avatarHooks.values()) for (const release of [...records.values()].reverse()) release();
      avatarHooks.clear(); avatarScene = current.scene; avatarAccount = account(current);
      for (const avatar of renderedAvatars) if (avatar.destroyed || avatar.seat !== current.selfSeat) {
        releaseFitMask(avatar); renderedAvatars.delete(avatar);
      }
    }
    for (const avatar of getAvatars() || []) {
      // The class prototype also covers avatars created later in this scene. Each call checks
      // the exact current self seat/CardId; other players never receive this resource override.
      const add = (name, handler, guard = false) => {
        const holder = ownerOf(avatar, name);
        if (!holder) return;
        const records = avatarHooks.get(holder) || new Map();
        if (records.has(name)) return;
        const release = wrap(holder, name, handler, guard);
        if (release) { records.set(name, release); avatarHooks.set(holder, records); }
      };
      add('loadSkin', function (original, args) {
        const row = avatarChoice(this);
        dynamic?.stop(this);
        if (row) renderedAvatars.add(this);
        if (row) {
          this.__xcTenYearIssuedURLs ||= new Set(); this.__xcTenYearIssuedURLs.add(urls(row).big);
          this.__xcTenYearRequestScene = context().scene;
          this.__xcTenYearRequestAccount = account();
        }
        this.__xcTenYearLastRequest = row ? urls(row).big : null;
        if (row) args[0] = urls(row).big;
        else if (this.__xcTenYearFitted) {
          releaseFitMask(this);
          this.skinTex?.size?.(this.width || 146, this.height || 172);
          this.skinTex?.pos?.(0, 0); this.__xcTenYearFitted = false;
        }
        if (this.__xcTenYearIssuedURLs) this.__xcTenYearExpectedURL = args[0];
        return original.apply(this, args);
      });
      add('SetSkin', function (original, args) {
        const row = avatarChoice(this);
        if (!row) return original.apply(this, args);
        this.skinItemID = Number(args[0]) || 0; this.skinBaseVO = null; this.skinVO = null;
        for (const name of ['clearMaskTween', 'clearTempStaticSkin', 'clearEffect', 'removeSkeleton']) this[name]?.();
        return this.loadSkin(urls(row).big);
      });
      add('loadSkinComplete', function (original, args) {
        const row = avatarChoice(this), url = typeof args[1] === 'string' ? args[1] : args[0]?.url;
        if (url && this.__xcTenYearIssuedURLs?.has(url) && (this.destroyed ||
          this.__xcTenYearRequestScene !== context().scene || this.__xcTenYearRequestAccount !== account())) return;
        // Native resource callbacks can arrive after a different selection/scene. Ignore stale
        // ten-year textures, and ignore old OL textures while a ten-year choice is active.
        if (url && ((row && url !== urls(row).big) ||
          (!row && this.__xcTenYearIssuedURLs?.has(url) && url !== this.__xcTenYearExpectedURL))) return;
        if (row && !args[0]) {
          try { setChoice(Number(this.generalCard?.CardId), null); } catch (_) {}
          log('原生纹理加载失败，恢复OL默认图：' + row[2]);
        }
        const result = original.apply(this, args);
        if (row) { this.removeSkeleton?.(); fit(this); this.__xcTenYearFitted = true; showDynamic(this, row); }
        return result;
      }, true);
      for (const name of ['removeSkeleton', 'clearSkin', 'Reset', 'destroy', 'SetGray']) add(name, function (original, args) {
        dynamic?.stop(this); return original.apply(this, args);
      });
      add('ShowSkeleton', function (original, args) {
        const result = original.apply(this, args); dynamic?.visible(this, args[0]); return result;
      });
      for (const name of ['ShowType', 'ClearFilter']) add(name, function (original, args) {
        const result = original.apply(this, args); showDynamic(this, avatarChoice(this)); return result;
      });
    }
  }
  function attach() {
    active = true; dynamic?.attach(); onSeatReady();
    log('已启用全表同名合页：' + catalog.skins.length + '条静态/' + dynamicCatalog.length + '条SK动态候选，选择时验证');
  }
  function onSeatReady() {
    sync();
    for (const avatar of getAvatars() || []) {
      const row = avatarChoice(avatar);
      if (row && avatar.__xcTenYearLastRequest !== urls(row).big) {
        avatar.removeSkeleton?.(); avatar.loadSkin(urls(row).big);
      } else if (row) showDynamic(avatar, row);
      else dynamic?.stop(avatar);
    }
  }
  function detach() {
    active = false;
    dynamic?.detach();
    for (const cancel of [...pendingImages]) cancel();
    checked.clear();
    for (const view of boundViews) {
      const state = views.get(view); state.disposed = true; state.token++;
      for (const release of state.undo.reverse()) release();
      views.delete(view);
    }
    boundViews.clear();
    for (const records of avatarHooks.values()) for (const release of [...records.values()].reverse()) release();
    avatarHooks.clear();
    avatarScene = null; avatarAccount = null;
    for (const avatar of renderedAvatars) {
      releaseFitMask(avatar);
      if (avatar.destroyed || avatar.seat !== context().selfSeat) continue;
      avatar.skinTex?.size?.(avatar.width || 146, avatar.height || 172); avatar.skinTex?.pos?.(0, 0);
      avatar.__xcTenYearFitted = false; avatar.__xcTenYearLastRequest = null;
      avatar.__xcTenYearExpectedURL = null;
      const reload = avatar.QuickSetSkin || avatar.SetSkin;
      reload?.call(avatar, Number(avatar.skinItemID) || 0);
    }
    renderedAvatars.clear();
  }
  return { attach, detach, sync, onSeatReady, bindView, fixItems, entries, pages, urls, validate,
    label: gid => generals.get(Number(gid))?.label,
    choice: gid => choice(gid), status: () => ({ active, staticRecords: catalog.skins.length,
      dynamicRecords: dynamicCatalog.length, dynamic: dynamic?.status(), avatarOwners: avatarHooks.size }) };
};
