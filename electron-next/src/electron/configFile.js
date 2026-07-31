const { app, shell } = require('electron')
const fs = require('fs')
const path = require('path')

const configFilePath = path.join(app.getPath('userData'), 'config.json')

async function openConfigFile() {
  try {
    fs.mkdirSync(path.dirname(configFilePath), { recursive: true })
    if (!fs.existsSync(configFilePath)) fs.writeFileSync(configFilePath, '{}\n', 'utf8')

    const errorMessage = await shell.openPath(configFilePath)
    if (errorMessage) {
      shell.showItemInFolder(configFilePath)
      return { ok: false, path: configFilePath, error: errorMessage }
    }

    return { ok: true, path: configFilePath }
  } catch (error) {
    return {
      ok: false,
      path: configFilePath,
      error: error && error.message ? error.message : String(error)
    }
  }
}

module.exports = {
  configFilePath,
  openConfigFile
}
