// Exclusive face-theme selection, per-card overlays and the existing settings dialog.
// Asset ownership stays here; native discovery/loading is delegated to the client adapter.
module.exports = function createCardThemeFeature({ window, document, storage, client,
  getConfig, setMiaoEnabled, log = () => {} }) {
  const preferenceKey = 'xcCardFaceTheme';
  const modes = ['original', 'miao', 'tarot'];
  let selected = null, active = false, rendering = false, lifetime = 0, transition = 0;
  let manifest = null, manifestJob = null, retryTimer = null, mounted = null;
  const assets = new Map(), owned = new Map();
  let temporary = new WeakMap();
  let specialTrace = new WeakMap();
  let nativeFaceOverride = new WeakMap(), contentTrace = new WeakMap();
  const timers = { set: window.setTimeout.bind(window), clear: window.clearTimeout.bind(window) };
  let writingConfig = false;
  function report(message, error) {
    try { log(message, error); } catch (_) {}
  }
  function readSelection() {
    if (selected) return selected;
    try { selected = storage.getItem(preferenceKey); } catch (_) {}
    if (!modes.includes(selected)) {
      const config = getConfig();
      if (!config) { selected = null; return 'original'; }
      selected = config.miaoCardSwitch ? 'miao' : 'original';
    }
    return selected;
  }
  function getMode() {
    const config = getConfig();
    return config && config.cardBackSwitch ? readSelection() : 'original';
  }
  function restoreContentLayer(ui, layer) {
    if (ui[layer.key] === layer.node && !layer.node.destroyed && layer.node.visible === false)
      layer.node.visible = layer.original;
  }
  function restoreContent(ui) {
    const entry = owned.get(ui);
    if (!entry || !entry.content) return;
    for (const layer of entry.content) restoreContentLayer(ui, layer);
    entry.content = [];
  }
  function restoreUi(ui) {
    const entry = owned.get(ui);
    if (!entry) return;
    for (const layer of entry.layers) {
      if (layer.node.texture === layer.applied) layer.node.texture = layer.original;
    }
    restoreContent(ui);
    owned.delete(ui);
  }
  function restoreAll() { for (const ui of [...owned.keys()]) restoreUi(ui); }
  function cached(path) {
    const entry = path && assets.get(path);
    return entry && entry.texture && !entry.texture.destroyed ? entry.texture : null;
  }
  function apply(ui) {
    if (!active || !rendering || getMode() !== 'tarot' || !manifest) return restoreUi(ui);
    if (nativeFaceOverride.has(ui) && nativeFaceOverride.get(ui) === client.cardOf(ui)) return restoreUi(ui);
    const state = client.describe(ui, temporary.get(ui));
    if (!state) return restoreUi(ui);
    const variants = manifest.faces[state.key];
    const facePath = variants && variants[String(state.flower)];
    // Phase one only themes the three declared resource/suit pairs. Each layer falls back independently.
    if (!facePath) return restoreUi(ui);
    const previous = owned.get(ui);
    const layers = [];
    const replace = (node, path) => {
      if (!node) return;
      const prior = previous && previous.layers.find(layer => layer.node === node);
      const stillOwned = prior && node.texture === prior.applied;
      const texture = cached(path);
      if (!texture) {
        if (stillOwned) node.texture = prior.original;
        return;
      }
      layers.push({ node, original: stillOwned ? prior.original : node.texture, applied: texture });
      if (node.texture !== texture) node.texture = texture;
    };
    replace(ui.bmpFace, facePath);
    replace(ui.bmpNumber, state.number >= 1 && state.number <= 13 ? manifest.ranks[String(state.number)] : null);
    replace(ui.bmpFlower, state.flower >= 1 && state.flower <= 4 ? manifest.suits[String(state.flower)] : null);
    const targets = cached(facePath) ? client.getFaceContentLayers(ui) : [];
    const content = [], priorContent = previous && previous.content || [];
    for (const prior of priorContent) {
      if (!targets.some(item => item.node === prior.node && item.key === prior.key)) restoreContentLayer(ui, prior);
    }
    for (const { key, node } of targets) {
      const prior = priorContent.find(layer => layer.node === node && layer.key === key);
      content.push({ key, node, original: prior && node.visible === false ? prior.original : node.visible });
      if (node.visible !== false) node.visible = false;
    }
    if (content.length && contentTrace.get(ui) !== state.card) {
      contentTrace.set(ui, state.card);
      report('接管分层卡面 res=' + state.key + ' hidden=' + content.map(item => item.key).join(','));
    }
    if (layers.length || content.length) owned.set(ui, { card: state.card, layers, content });
    else owned.delete(ui);
  }
  function refresh() {
    const uis = new Set([...client.listUis(), ...owned.keys()]);
    for (const ui of uis) {
      if (!ui || ui.destroyed) { owned.delete(ui); continue; }
      try { apply(ui); } catch (error) { report('刷新失败', error); }
    }
  }
  const callbacks = {
    beforeUpdate(ui) { restoreContent(ui); temporary.delete(ui); nativeFaceOverride.delete(ui); },
    afterUpdate: apply,
    beforeFace(ui) { restoreContent(ui); nativeFaceOverride.delete(ui); },
    afterFace: apply,
    beforeContentUpdate(ui, args) {
      restoreContent(ui);
      const card = client.cardOf(ui);
      if (args[0] && card && args[0] !== card.ResName) nativeFaceOverride.set(ui, card);
    },
    afterContentUpdate: apply,
    beforeContentReset: restoreContent,
    beforeTemporary(ui, args) {
      temporary.set(ui, { card: client.cardOf(ui), flower: args[0], number: args[1] });
    },
    afterTemporary: apply,
    afterDraw: apply,
    beforeClear(ui) {
      restoreUi(ui); temporary.delete(ui); specialTrace.delete(ui);
      nativeFaceOverride.delete(ui); contentTrace.delete(ui);
    },
    beforeSpecial(ui, args, method) {
      const reason = client.specialFaceReason(ui, method, args);
      if (method === 'UpdateCardFaceRes' || method === 'UpdateCardFaceOrBackRes')
        nativeFaceOverride.set(ui, client.cardOf(ui));
      if (owned.has(ui)) {
        const card = client.cardOf(ui), signature = reason || '普通检查';
        let previous = specialTrace.get(ui);
        if (!previous || previous.card !== card) {
          previous = { card, methods: new Map() }; specialTrace.set(ui, previous);
        }
        if (previous.methods.get(method) !== signature) {
          previous.methods.set(method, signature);
          report((reason ? '进入原生特殊显示：' + reason : '普通技能检查保留塔罗') +
            ' method=' + method + ' card=' + String(card && card.CardId || '') +
            ' res=' + String(card && card.ResName || ''));
        }
      }
      if (reason) { restoreUi(ui); temporary.delete(ui); }
    },
    afterSpecial: apply,
  };
  function install(attempt = 0) {
    if (!active) return;
    if (retryTimer != null) { timers.clear(retryTimer); retryTimer = null; }
    if (client.install(callbacks)) { refresh(); return; }
    if (attempt >= 60) { report('等待卡牌UI，重新打开卡牌设置后重试'); return; }
    const epoch = lifetime;
    retryTimer = timers.set(() => {
      retryTimer = null;
      if (active && epoch === lifetime) install(attempt + 1);
    }, 500);
  }
  async function ensureManifest() {
    if (manifest) return manifest;
    if (manifestJob) return manifestJob;
    const epoch = lifetime;
    const job = (async () => {
      try {
        const result = await client.readAsset('manifest.json');
        const value = result && result.manifest;
        if (!result || !result.ok || !value || value.schemaVersion !== 1 || !value.faces || !value.ranks || !value.suits) {
          report('本地素材清单不可用，保留原生图层'); return null;
        }
        if (!active || epoch !== lifetime) return null;
        manifest = value;
        return value;
      } catch (error) { report('本地素材读取失败，保留原生图层', error); return null; }
    })();
    manifestJob = job;
    try { return await job; } finally { if (manifestJob === job) manifestJob = null; }
  }
  function ensureAsset(path, size) {
    if (!path) return Promise.resolve(null);
    if (assets.has(path)) return assets.get(path).job;
    const epoch = lifetime, entry = { texture: null, dataUrl: null, job: null };
    assets.set(path, entry);
    entry.job = (async () => {
      try {
        const result = await client.readAsset(path);
        if (!result || !result.ok || !result.dataUrl) { report('缺少素材 ' + path + '，沿用原生图层'); return null; }
        if (!active || epoch !== lifetime) return null;
        entry.dataUrl = result.dataUrl;
        const texture = await client.makeTexture(result.dataUrl, size);
        if (!active || epoch !== lifetime) { client.releaseTexture(texture, result.dataUrl); return null; }
        if (!texture) { report('素材加载失败 ' + path + '，沿用原生图层'); return null; }
        entry.texture = texture;
        refresh();
        updateUI();
        return texture;
      } catch (error) { report('素材加载失败 ' + path, error); return null; }
    })();
    return entry.job;
  }
  async function ensureAssets() {
    const value = await ensureManifest();
    if (!value || !active) return;
    const requests = [];
    for (const variants of Object.values(value.faces))
      for (const path of Object.values(variants)) requests.push(ensureAsset(path, [93, 130]));
    for (const path of [...Object.values(value.ranks), ...Object.values(value.suits)])
      requests.push(ensureAsset(path, [19, 17]));
    await Promise.all(requests);
  }
  async function sync() {
    if (!active) return false;
    const operation = ++transition, epoch = lifetime, mode = getMode();
    rendering = false;
    restoreAll();
    updateUI();
    try { await setMiaoEnabled(mode === 'miao'); } catch (error) { report('切换原有卡面失败', error); }
    if (!active || operation !== transition || epoch !== lifetime) return false;
    rendering = mode === 'tarot';
    if (rendering) await ensureAssets();
    if (!active || operation !== transition || epoch !== lifetime) return false;
    refresh(); updateUI();
    return true;
  }
  async function setMode(mode) {
    if (!active || !modes.includes(mode)) return false;
    readSelection();
    selected = mode;
    try { storage.setItem(preferenceKey, mode); } catch (_) {}
    writingConfig = true;
    try {
      const config = getConfig();
      if (config) {
        config.miaoCardSwitch = mode === 'miao';
        if (mode !== 'original') config.cardBackSwitch = true;
      }
    } finally { writingConfig = false; }
    install();
    report('选择 ' + ({ original: '原始', miao: '猫猫', tarot: '塔罗' })[mode]);
    return sync();
  }
  function onConfigChange(event) {
    if (!active || writingConfig) return;
    const property = event.detail && event.detail.property;
    if (property !== 'cardBackSwitch' && property !== 'miaoCardSwitch') return;
    if (property === 'miaoCardSwitch') {
      const config = getConfig();
      if (config && config.miaoCardSwitch) selected = 'miao';
      else if (readSelection() === 'miao') selected = 'original';
      try { storage.setItem(preferenceKey, selected); } catch (_) {}
    }
    sync();
  }
  function updateUI() {
    if (!mounted) return;
    const mode = getMode();
    for (const [value, cellId, buttonId, label] of [
      ['original', 'originCardCell', 'originCardUseBtn', '原始'],
      ['miao', 'miaoCardCell', 'miaoCardUseBtn', '猫猫'],
      ['tarot', 'tarotCardCell', 'tarotCardUseBtn', '塔罗'],
    ]) {
      const cell = mounted.querySelector('#' + cellId), button = mounted.querySelector('#' + buttonId);
      if (cell) {
        cell.classList.toggle('is-active', mode === value);
        const title = cell.querySelector('.cardback-preview-label');
        if (title) title.textContent = label;
      }
      if (button) {
        button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(mode === value));
        button.disabled = mode === value;
        button.textContent = mode === value ? '使用中' : '使用' + label;
      }
    }
    const preview = mounted.querySelector('#tarotCardPreview');
    const source = assets.get('faces/Shan_heart.png');
    if (preview && source && source.dataUrl) preview.style.backgroundImage = 'url("' + source.dataUrl + '")';
  }
  function unmount() {
    if (!mounted) return;
    const cell = mounted.querySelector('#tarotCardCell');
    if (cell) cell.remove();
    const grid = mounted.querySelector('#originCardCell');
    if (grid && grid.parentElement) {
      grid.parentElement.style.gridTemplateColumns = '';
      grid.parentElement.removeAttribute('role');
      grid.parentElement.removeAttribute('aria-label');
    }
    mounted = null;
  }
  function mount(dialog) {
    if (!active || !dialog) return;
    if (mounted !== dialog) { unmount(); mounted = dialog; }
    const origin = dialog.querySelector('#originCardCell');
    if (!origin || !origin.parentElement) return;
    const grid = origin.parentElement;
    grid.style.gridTemplateColumns = 'repeat(auto-fit,minmax(140px,1fr))';
    grid.setAttribute('role', 'radiogroup'); grid.setAttribute('aria-label', '卡面主题');
    if (!dialog.querySelector('#tarotCardCell')) {
      const cell = document.createElement('div');
      cell.id = 'tarotCardCell'; cell.className = 'cardback-preview-cell';
      const label = document.createElement('div'); label.className = 'cardback-preview-label'; label.textContent = '塔罗';
      const preview = document.createElement('div'); preview.id = 'tarotCardPreview'; preview.className = 'cardback-preview-img';
      const button = document.createElement('button'); button.id = 'tarotCardUseBtn'; button.type = 'button';
      button.className = 'cardback-action-btn'; button.textContent = '使用塔罗';
      button.addEventListener('click', () => {
        if (active && mounted === dialog && dialog.isConnected) setMode('tarot');
      });
      cell.appendChild(label); cell.appendChild(preview); cell.appendChild(button); grid.appendChild(cell);
    }
    updateUI(); install();
    ensureAssets().then(updateUI);
  }
  function start() {
    if (active) { install(); return; }
    active = true; lifetime++;
    readSelection();
    window.addEventListener('xc:config-change', onConfigChange);
    install(); sync();
  }
  function dispose() {
    if (!active) return;
    active = false; rendering = false; lifetime++; transition++;
    if (retryTimer != null) timers.clear(retryTimer);
    retryTimer = null;
    window.removeEventListener('xc:config-change', onConfigChange);
    restoreAll(); client.dispose(); unmount();
    temporary = new WeakMap();
    specialTrace = new WeakMap();
    nativeFaceOverride = new WeakMap(); contentTrace = new WeakMap();
    for (const entry of assets.values()) client.releaseTexture(entry.texture, entry.dataUrl);
    assets.clear(); manifest = null; manifestJob = null;
  }
  return { start, dispose, getMode, setMode, sync, mount, updateUI, refresh };
};
