// Owns SK templates, per-avatar players, and their cancellation/cleanup.
module.exports = function createTenYearDynamic({ window, log = () => {} }) {
  const BASE = 'https://web.sanguosha.com/10/pc/res/assets/runtime/general/big/dynamic/';
  const templates = new Map(), players = new Map();
  let attached = false;
  const engine = () => window.Laya || window.laya;
  const templateKey = spec => spec.resource + ':' + spec.layers.map(layer => layer.file + '@' + (layer.version || '')).join(',');
  function trim(protectedKey) {
    for (const [key, record] of templates) {
      if (templates.size <= 3) break;
      if (key === protectedKey || !record.ready || [...players.values()].some(player => player.templateKey === key)) continue;
      for (const template of record.templates) template.destroy();
      templates.delete(key);
    }
  }
  function prepare(spec) {
    const key = templateKey(spec);
    if (templates.has(key)) return templates.get(key).promise;
    const Laya = engine();
    if (!Laya?.Templet || !Laya?.Sprite) return Promise.reject(Error('当前引擎未提供SK播放器'));
    const record = { templates: [], cancel: [], ready: false };
    templates.set(key, record);
    record.promise = Promise.all(spec.layers.map(layer => new Promise((resolve, reject) => {
      const template = new Laya.Templet(); record.templates.push(template);
      let settled = false, animation = 'play';
      const timer = window.setTimeout(() => finish(Error('骨骼加载超时：' + layer.file)), 15000);
      function finish(error) {
        if (settled) return;
        settled = true; window.clearTimeout(timer);
        template.off(Laya.Event.COMPLETE, record, complete);
        template.off(Laya.Event.ERROR, record, fail);
        error ? reject(error) : resolve({ template, file: layer.file, animation });
      }
      function complete() {
        try {
          const names = Array.from({ length: template.getAnimationCount() }, (_, i) => template.getAniNameByIndex(i));
          if (layer.animationIndex != null) {
            animation = layer.animationIndex;
            finish(Number.isInteger(animation) && animation >= 0 && animation < names.length ? null :
              Error('缺少座位待机动作：' + layer.file + ' index=' + animation));
          } else finish(names.includes('play') ? null : Error('缺少待机动作play：' + layer.file));
        } catch (error) { finish(error); }
      }
      function fail() { finish(Error('骨骼或纹理加载失败：' + layer.file)); }
      record.cancel.push(() => finish(Error('动态加载已取消')));
      template.once(Laya.Event.COMPLETE, record, complete); template.once(Laya.Event.ERROR, record, fail);
      try { template.loadAni(BASE + spec.resource + '/' + layer.file + (layer.version ? '?v=' + layer.version : '')); }
      catch (error) { finish(error); }
    }))).then(layers => {
      if (record.cancelled || templates.get(key) !== record) throw Error('动态加载已失效');
      record.ready = true; record.layers = layers; trim(key); return layers;
    }).catch(error => {
      for (const cancel of record.cancel) cancel();
      for (const template of record.templates) template.destroy();
      if (templates.get(key) === record) templates.delete(key);
      throw error;
    });
    return record.promise;
  }
  function stop(avatar) {
    const player = players.get(avatar);
    if (!player) return;
    players.delete(avatar);
    player.root?.destroy(true);
  }
  function resize(avatar) {
    const p = players.get(avatar);
    if (!p?.root || !p.bounds) return;
    const box = avatar.scrollRect || { x: 0, y: 0, width: avatar.width || 146, height: avatar.height || 172 };
    const scale = Math.max(box.width / p.bounds.width, box.height / p.bounds.height);
    p.root.scale(scale, scale);
    p.root.pos((box.x || 0) + box.width / 2 - (p.bounds.x + p.bounds.width / 2) * scale,
      (box.y || 0) + box.height / 2 - (p.bounds.y + p.bounds.height / 2) * scale);
  }
  function show(avatar, spec, isCurrent) {
    // This module only plays portrait idle. The existing skin-effects blocker
    // suppresses attack/skill effects and deliberately preserves native idle.
    if (!attached || avatar.destroyed || avatar.seat?.IsDead) { stop(avatar); return; }
    const old = players.get(avatar);
    if (old?.id === spec.id && old.isCurrent()) { resize(avatar); return; }
    stop(avatar);
    const player = { id: spec.id, templateKey: templateKey(spec), isCurrent }; players.set(avatar, player);
    prepare(spec).then(layers => {
      if (players.get(avatar) !== player || !attached || avatar.destroyed || !isCurrent()) {
        if (players.get(avatar) === player) stop(avatar); return;
      }
      const Laya = engine(), root = player.root = new Laya.Sprite();
      root.name = 'xcTenYearDynamic'; root.mouseEnabled = false; root.mouseThrough = true;
      root.visible = player.visible !== false;
      let reference;
      for (const layer of layers) {
        const skeleton = layer.template.buildArmature(1);
        root.addChild(skeleton); skeleton.play(layer.animation, true);
        if (!reference || layer.file === 'beijing.sk') reference = skeleton;
      }
      const bounds = reference.getBounds();
      if (!(bounds.width > 0 && bounds.height > 0)) throw Error('动态可视区域为空');
      player.bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      avatar.addChild(root); resize(avatar);
      log('待机已挂载：' + spec.id + '，' + layers.map(layer => layer.file).join('+'));
    }).catch(error => {
      if (players.get(avatar) !== player) return;
      stop(avatar); log('动态回退静态：' + spec.id + ' ' + error.message);
    });
  }
  function visible(avatar, value) {
    const player = players.get(avatar);
    if (player) player.visible = !!value;
    if (player?.root) player.root.visible = player.visible;
  }
  function attach() { attached = true; }
  function reset() {
    for (const avatar of [...players.keys()]) stop(avatar);
    for (const record of templates.values()) {
      record.cancelled = true;
      for (const cancel of record.cancel) cancel();
      if (record.ready) for (const template of record.templates) template.destroy();
    }
    templates.clear();
  }
  function detach() {
    attached = false; reset();
  }
  return { attach, detach, reset, prepare, show, stop, resize, visible,
    status: () => ({ players: players.size, templates: templates.size }) };
};
