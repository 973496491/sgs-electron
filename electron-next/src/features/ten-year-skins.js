// Static resource overrides only; native ownership, requests and selection remain separate.
module.exports = function createTenYearSkins({ window, document, storage, catalog, log = () => {}, loadImage, placeControl = () => {}, getSeatAvatars = () => [] }) {
  const key = 'xcTenYearStaticSkins.v1', sizeKey = 'xcTenYearSkinSize.v1', base = 'https://web.sanguosha.com/10/pc/';
  // OL native box ratios: VERTICAL 350x464 (0.754), BANNER 536x380 (1.41), SKIN_169 335x594 (0.564).
  const RBT = { BANNER: 1, VERTICAL: 2, SKIN_169: 3 };
  const sources = new Map(catalog.map(row => [String(row[0]), row]));
  const targets = new Map(), patches = new Map();
  // In-game seat cards are 146x172 (ratio 0.849). Showing the ten-year BIG image there
  // needs explicit aspect-preserving fit; the native code assigns the texture without sizing.
  const SEAT_BOX = { w: 146, h: 172 };
  const seatHooks = new Map(); // seatAvatar instance -> records
  let mappings = {}, sizeTypes = {}, active = true, epoch = 0, panel = null, button = null, control = null;
  let targetSelect, sourceInput, preview, status, page = 0, grid, chosen;
  let selectedSource = sources.has('543501') ? '543501' : sources.keys().next().value;
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (saved && typeof saved === 'object') for (const [id, source] of Object.entries(saved))
      if (/^[1-9]\d*$/.test(id) && sources.has(String(source))) mappings[id] = String(source);
  } catch (_) {}
  try {
    const saved = JSON.parse(storage.getItem(sizeKey));
    if (saved && typeof saved === 'object') for (const [id, type] of Object.entries(saved))
      if (/^[1-9]\d*$/.test(id) && Object.values(RBT).includes(type)) sizeTypes[id] = type;
  } catch (_) {}
  const imageLoader = loadImage || (url => new Promise((resolve, reject) => {
    const image = new window.Image();
    const timer = window.setTimeout(() => finish(false), 15000);
    function finish(ok) {
      window.clearTimeout(timer); image.onload = image.onerror = null;
      ok ? resolve({ width: image.naturalWidth, height: image.naturalHeight }) : reject(Error('图片无法加载'));
    }
    image.onload = () => finish(image.naturalWidth > 0); image.onerror = () => finish(false); image.src = url;
  }));
  // Choose the native display box that best fits the ten-year big image's real aspect ratio.
  function sizeTypeOf(info) {
    if (!info || !(info.width > 0) || !(info.height > 0)) return null;
    const ratio = info.width / info.height;
    if (ratio >= 1.15) return RBT.BANNER;
    if (ratio <= 0.9) return RBT.VERTICAL;
    return RBT.SKIN_169;
  }
  function saveSizeTypes(next) { storage.setItem(sizeKey, JSON.stringify(next)); sizeTypes = next; }
  async function ensureSizeType(id) {
    if (!active || sizeTypes[id] || !mappings[id]) return;
    const token = epoch;
    try {
      const info = await imageLoader(urls(mappings[id]).big);
      const type = sizeTypeOf(info);
      if (!active || epoch !== token || mappings[id] !== id || !type || sizeTypes[id]) return;
      saveSizeTypes({ ...sizeTypes, [id]: type });
      renderTargets();
    } catch (_) {}
  }
  function urls(source) {
    const row = sources.get(String(source));
    if (!row) throw Error('请选择列表中的十周年皮肤');
    return { big: base + 'res/assets/runtime/general/big/static/' + row[0] + '.png?v=' + row[1],
      seat: base + 'res/assets/runtime/general/seat/static/' + row[0] + '.png?v=' + row[2] };
  }
  function resolve(id, kind) {
    if (!active || !mappings[id]) return null;
    const pair = urls(mappings[id]);
    // Seat cards always use the full-body big image; the seat image is a half-body crop.
    return kind === 'seat' ? pair.big : pair[kind];
  }
  function descriptor(object, name) {
    for (let p = object; p; p = Object.getPrototypeOf(p)) {
      const d = Object.getOwnPropertyDescriptor(p, name); if (d) return d;
    }
  }
  function isMappedSeat(avatar) {
    if (!active) return false;
    const vo = avatar?.skinBaseVO;
    const id = Number(avatar?.skinItemID || vo?.skinID);
    return !!(id > 0 && mappings[id]);
  }
  function fitSeatTexture(avatar) {
    const tex = avatar?.skinTex;
    if (!tex || !isMappedSeat(avatar)) return;
    const source = tex.source || tex.texture;
    const sw = source?.width, sh = source?.height;
    if (!(sw > 0) || !(sh > 0)) return;
    const scale = Math.min(SEAT_BOX.w / sw, SEAT_BOX.h / sh);
    const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
    try {
      if (typeof tex.size === 'function') tex.size(w, h);
      if (typeof tex.pos === 'function') tex.pos(Math.round((SEAT_BOX.w - w) / 2), Math.round((SEAT_BOX.h - h) / 2));
      tex.scaleX = tex.scaleY = 1;
    } catch (_) {}
  }
  // Wrap seat avatars' loadSkinComplete so the full-body big image fits the card after each load.
  function syncSeatHooks() {
    if (!active) return;
    let avatars = [];
    try { avatars = getSeatAvatars() || []; } catch (_) { return; }
    for (const avatar of avatars) {
      if (!avatar || seatHooks.has(avatar)) continue;
      const original = descriptor(avatar, 'loadSkinComplete');
      if (!original || typeof original.value !== 'function') continue;
      const own = Object.getOwnPropertyDescriptor(avatar, 'loadSkinComplete');
      if (own && !own.configurable) continue;
      const replacement = { configurable: true, writable: true, enumerable: original.enumerable,
        value: function (...args) {
          const result = original.value.apply(this, args);
          fitSeatTexture(this);
          return result;
        } };
      try { Object.defineProperty(avatar, 'loadSkinComplete', replacement); seatHooks.set(avatar, { own, replacement }); }
      catch (error) { log('座位图缩放挂钩失败：' + String(error && error.message || error)); }
      fitSeatTexture(avatar);
    }
  }
  function releaseSeatHooks() {
    for (const [avatar, record] of seatHooks) {
      const current = Object.getOwnPropertyDescriptor(avatar, 'loadSkinComplete');
      if (current?.value !== record.replacement.value) continue;
      if (record.own) Object.defineProperty(avatar, 'loadSkinComplete', record.own);
      else delete avatar.loadSkinComplete;
    }
    seatHooks.clear();
  }
  function observe(item) {
    if (!active) return;
    const vo = item?.skinData?.skinBaseVo || item?.skinData;
    const id = Number(vo?.skinID || item?.SkinID);
    if (!vo || Number(vo.generalID) !== 716 || !Number.isSafeInteger(id) || id <= 0 || typeof vo.SkinBigUrl !== 'function') return;
    // Native InitData can retain the owned dynamic preference even for a static override.
    if (mappings[id]) item.dynamicState = 0;
    targets.set(String(id), { id, name: vo.skinname || 'OL皮肤 ' + id });
    if (patches.has(vo)) { renderTargets(); return; }
    const records = [];
    const routes = { SkinBigUrl: 'big', SkinBigUrlApp: 'big', SkinMaxUrl: 'big', SkinMaxUrlApp: 'big',
      SkinSeatUrl: 'seat', SkinSeatUrlApp: 'seat', SkinSeatUrlAppNew: 'seat', SkinSeatUrlApp2: 'seat',
      SkinSeatUrlJueXing: 'seat', SkinSeatUrlAppJueXing: 'seat', SkinSeatUrlAppJueXingOut: 'seat',
      SkinSeatUrlClientNew: 'seat', SkinUrlInTip: 'seat', SkinUrlInTipApp: 'seat',
      SkinUrlInWindow: 'seat', SkinUrlInWindowApp: 'seat' };
    // Display-box fields are derived from sizeTypes[id]; fall back to native when no size is known yet.
    const sizeFields = { SkinsizeType: t => t, IsBanner: t => t === RBT.BANNER, Is169: t => t === RBT.SKIN_169 };
    const sizeActive = id => active && mappings[id] && sizeTypes[id];
    for (const name of [...Object.keys(routes), ...Object.keys(sizeFields), 'canUpdateDynamic', 'ShowDynamic', 'ShowFormDynamic']) {
      const original = descriptor(vo, name);
      if (!original || (!original.get && typeof original.value !== 'function')) continue;
      const own = Object.getOwnPropertyDescriptor(vo, name);
      if (own && !own.configurable) continue;
      const replacement = original.get ? { configurable: true, enumerable: original.enumerable,
        get() { const t = sizeActive(id); const url = resolve(id, routes[name]);
          if (routes[name]) return url || original.get.call(this);
          if (sizeFields[name]) return t ? sizeFields[name](t) : original.get.call(this);
          return active && mappings[id] ? false : original.get.call(this); } }
        : { configurable: true, writable: true, enumerable: original.enumerable,
          value: function (...args) { const t = sizeActive(id); const url = resolve(id, routes[name]);
            if (routes[name]) return url || original.value.apply(this, args);
            if (sizeFields[name]) return t ? sizeFields[name](t) : original.value.apply(this, args);
            return active && mappings[id] ? false : original.value.apply(this, args); } };
      try { Object.defineProperty(vo, name, replacement); records.push({ name, own, replacement }); }
      catch (error) { log('资源入口不可替换：' + name); }
    }
    patches.set(vo, records);
    if (mappings[id] && !sizeTypes[id]) ensureSizeType(id);
    if (mappings[id]) syncSeatHooks();
    renderTargets();
  }
  async function apply(id, source) {
    id = String(id); source = String(source);
    if (!active || !targets.has(id)) throw Error('请先打开 OL 选肤窗口，读取目标皮肤');
    const token = ++epoch, pair = urls(source);
    const [bigInfo] = await Promise.all([imageLoader(pair.big), imageLoader(pair.seat)]);
    if (!active || epoch !== token) return false;
    const type = sizeTypeOf(bigInfo);
    if (!type) throw Error('无法读取十周年图片尺寸');
    const next = { ...mappings, [id]: source };
    storage.setItem(key, JSON.stringify(next)); mappings = next;
    saveSizeTypes({ ...sizeTypes, [id]: type });
    syncSeatHooks();
    log('已映射 OL ' + id + ' → 十周年 ' + source + '（全身大图，按座位框自适应），请重新打开选肤并选择静态');
    return true;
  }
  function remove(id) {
    ++epoch; const next = { ...mappings }, nextSizes = { ...sizeTypes }; delete next[String(id)]; delete nextSizes[String(id)];
    storage.setItem(key, JSON.stringify(next)); mappings = next; saveSizeTypes(nextSizes);
    syncSeatHooks();
    log('已恢复 OL ' + id + ' 原始资源，请重新选择皮肤');
  }
  function renderTargets() {
    if (!targetSelect) return;
    const previous = targetSelect.value; targetSelect.textContent = '';
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = '请选择已读取的 OL 皮肤'; targetSelect.appendChild(placeholder);
    for (const t of targets.values()) { const o = document.createElement('option'); o.value = String(t.id);
      o.textContent = t.name + (mappings[t.id] ? '（已替换）' : ''); targetSelect.appendChild(o); }
    targetSelect.value = previous;
  }
  function selectSource(id) { selectedSource = id; preview.src = urls(id).big; chosen.textContent = '当前十周年素材：' + id; }
  function renderPage() {
    if (!grid) return;
    grid.textContent = '';
    const ids = [...sources.keys()].filter(id => !sourceInput.value || id.includes(sourceInput.value.trim()));
    const pages = Math.max(1, Math.ceil(ids.length / 8)); page = Math.min(page, pages - 1);
    for (const id of ids.slice(page * 8, page * 8 + 8)) {
      const b = document.createElement('button'); b.type = 'button'; b.title = '选择十周年素材 ' + id;
      b.style.cssText = 'width:88px;background:#292439;color:white;border:1px solid #62546d;cursor:pointer';
      const img = document.createElement('img'); img.src = urls(id).seat; img.alt = id;
      img.style.cssText = 'width:76px;height:76px;object-fit:contain;display:block';
      const label = document.createElement('span'); label.textContent = id;
      b.append(img, label); b.onclick = () => selectSource(id); grid.appendChild(b);
    }
    grid.dataset.page = (page + 1) + '/' + pages;
  }
  function close() { ++epoch; panel?.remove(); panel = null; targetSelect = sourceInput = preview = status = grid = chosen = null; }
  function open() {
    if (panel?.isConnected) { close(); return; } close();
    panel = document.createElement('div'); panel.id = 'xcTenYearSkinPanel';
    panel.style.cssText = 'position:fixed;top:8vh;left:50%;transform:translateX(-50%);width:420px;max-width:94vw;max-height:84vh;overflow:auto;z-index:2147483646;background:#211d2a;color:#eee;padding:16px;border:1px solid #af9760;border-radius:8px;font:14px sans-serif;box-sizing:border-box';
    const title = document.createElement('strong'); title.textContent = '十周年静态皮肤';
    const hint = document.createElement('p'); hint.textContent = '先开启“本地皮肤”，打开一次吕玲绮的 OL 选肤窗口，再选择她的目标皮肤。本机使用该皮肤的显示会一起替换。';
    targetSelect = document.createElement('select'); targetSelect.style.cssText = 'width:100%;margin:8px 0';
    targetSelect.onchange = () => { const source = mappings[targetSelect.value]; if (source) selectSource(source); };
    const label = document.createElement('p'); label.textContent = '选择十周年图片（暂以素材编号显示，可输入编号筛选）';
    sourceInput = document.createElement('input'); sourceInput.placeholder = '筛选素材编号'; sourceInput.style.cssText = 'width:95%';
    sourceInput.oninput = () => { page = 0; renderPage(); if (sources.has(sourceInput.value.trim())) selectSource(sourceInput.value.trim()); };
    grid = document.createElement('div'); grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0';
    preview = document.createElement('img'); preview.alt = '十周年立绘预览'; preview.style.cssText = 'width:100%;max-height:180px;object-fit:contain';
    chosen = document.createElement('p');
    status = document.createElement('p'); status.textContent = '应用后，重新打开 OL 选肤并选中目标皮肤的静态模式。';
    function action(text, handler) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.style.cssText = 'margin:5px;padding:6px;cursor:pointer'; b.onclick = handler; return b; }
    const nav = document.createElement('div'); nav.append(action('上一页', () => { page = Math.max(0, page - 1); renderPage(); }), action('下一页', () => { page++; renderPage(); }));
    const save = action('应用静态皮肤', async () => {
      const owner = panel, message = status; save.disabled = true; message.textContent = '正在检查图片…';
      try { if (await apply(targetSelect.value, selectedSource)) if (panel === owner) { renderTargets(); message.textContent = '已保存。请重新打开 OL 选肤，选择目标皮肤的静态模式并确认。'; } }
      catch (error) { if (panel === owner) message.textContent = error.message || '保存失败'; log(String(error)); }
      finally { save.disabled = false; }
    });
    const restore = action('恢复 OL 原图', () => { try { if (!targetSelect.value) throw Error('请选择目标皮肤'); remove(targetSelect.value); renderTargets(); status.textContent = '已恢复，请在 OL 中重新选择皮肤。'; } catch (e) { status.textContent = e.message; } });
    panel.append(title, action('关闭', close), hint, targetSelect, label, sourceInput, grid, nav, chosen, preview, status, save, restore);
    document.body.appendChild(panel); renderTargets(); renderPage(); selectSource(selectedSource);
  }
  function mount(anchor) {
    active = true;
    syncSeatHooks();
    if (button?.isConnected || !anchor?.parentNode) return;
    button = document.createElement('button'); button.id = 'xcTenYearSkinsButton'; button.type = 'button';
    button.textContent = '十周年皮肤'; button.style.cssText = 'margin:5px;padding:5px;cursor:pointer;color:#a67518'; button.onclick = open;
    const row = anchor.closest?.('.xc-settings-flow-item') || anchor.closest?.('.expandable-switch') || anchor.parentNode;
    control = document.createElement('div'); control.className = 'switch-container';
    const marker = document.createElement('input'); marker.id = 'xcTenYearSkinsToggle'; marker.type = 'hidden';
    control.append(marker, button); row.parentNode.insertBefore(control, row.nextSibling); placeControl(control);
  }
  function dispose() {
    active = false; close(); control?.remove(); control = null; button = null;
    releaseSeatHooks();
    for (const [vo, records] of patches) for (const r of records) {
      const current = Object.getOwnPropertyDescriptor(vo, r.name);
      if (current?.get !== r.replacement.get || current?.value !== r.replacement.value) continue;
      if (r.own) Object.defineProperty(vo, r.name, r.own); else delete vo[r.name];
    }
    patches.clear(); targets.clear();
  }
  return { observe, mount, dispose, apply, remove, urls, resolve, syncSeatHooks, getMappings: () => ({ ...mappings }) };
};
