// Read only the installed card-theme package. Shared by the packaged and development hosts.
const fs = require('fs');
const path = require('path');
const CHANNEL = 'read-card-theme-asset';
const registrations = new WeakMap();

function createCardThemeAssetReader({ roots, whenIdle = () => Promise.resolve() }) {
  const directories = roots.map(root => path.resolve(root));
  return async function readCardThemeAsset(relative) {
    if (typeof relative !== 'string' ||
        !/^(?:manifest\.json|(?:faces|ranks|suits)\/[A-Za-z0-9_-]+\.png)$/.test(relative))
      return { ok: false, code: 'invalid-asset' };
    await whenIdle();
    for (const root of directories) {
      const file = path.resolve(root, relative);
      try {
        const realRoot = await fs.promises.realpath(root);
        const realFile = await fs.promises.realpath(file);
        const inside = path.relative(realRoot, realFile);
        if (!inside || inside.startsWith('..') || path.isAbsolute(inside))
          return { ok: false, code: 'invalid-asset' };
        const stat = await fs.promises.stat(realFile);
        if (!stat.isFile() || stat.size > 8 * 1024 * 1024)
          return { ok: false, code: 'invalid-asset' };
        const data = await fs.promises.readFile(realFile);
        if (relative === 'manifest.json') return { ok: true, manifest: JSON.parse(data.toString('utf8')) };
        if (data.length < 24 || data.readUInt32BE(0) !== 0x89504e47 || data.readUInt32BE(4) !== 0x0d0a1a0a)
          return { ok: false, code: 'invalid-png' };
        return { ok: true, dataUrl: 'data:image/png;base64,' + data.toString('base64') };
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        return { ok: false, code: 'read-failed' };
      }
    }
    return { ok: false, code: 'missing' };
  };
}

function registerCardThemeAssets({ ipcMain, ...options }) {
  if (registrations.has(ipcMain)) return registrations.get(ipcMain);
  const read = createCardThemeAssetReader(options);
  ipcMain.handle(CHANNEL, (_event, relative) => read(relative));
  registrations.set(ipcMain, read);
  return read;
}

module.exports = { CHANNEL, createCardThemeAssetReader, registerCardThemeAssets };
