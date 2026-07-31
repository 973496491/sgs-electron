const { app, session, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')
const { openConfigFile } = require('./configFile')

const programDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()
const packagedResourceDir = path.join(programDir, 'resources')
const bundledResourceDir = path.join(app.getAppPath(), 'resources')
const maxSgsPartitions = 10

const filter = {
  urls: ['*://web.sanguosha.com/*', '*://sdk.rum.aliyuncs.com/*', '*://www.desuwa.link/*']
}

const localResourceMap = {
  'web.sanguosha.com/220/h5_2/libs/after.js': 'after.js',
  'www.desuwa.link/sgs/base.js': 'base.js',
  'www.desuwa.link/sgs/daxiaochao.user.js': 'daxiaochao.user.js',
  'www.desuwa.link/sgs/local-card-back-enable.js': 'local-card-back-enable.js',
  'www.desuwa.link/sgs/local-skin-enable.js': 'local-skin-enable.js',
  'www.desuwa.link/sgs/workerloader.js': 'workerloader.js'
}

function normalizeLocalResource(localFile) {
  const decoded = decodeURIComponent(String(localFile || '')).replace(/\\/g, '/')
  const parts = decoded.split('/').filter(Boolean)

  if (!parts.length || parts.includes('..')) {
    throw new Error(`Invalid local resource: ${localFile}`)
  }

  return parts.join(path.sep)
}

function resolveAtomResource(requestUrl) {
  try {
    const url = new URL(requestUrl)
    return normalizeLocalResource([url.hostname, url.pathname].filter(Boolean).join('/'))
  } catch (error) {
    return normalizeLocalResource(String(requestUrl).replace(/^atom:\/+/, ''))
  }
}

function isOpenConfigFileRequest(requestUrl) {
  try {
    const url = new URL(requestUrl)
    return url.protocol === 'atom:' && url.hostname === 'open-config-file'
  } catch (error) {
    return false
  }
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*'
    }
  })
}

function isInside(candidate, root) {
  const relativePath = path.relative(root, candidate)
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function resolveResourcePath(localFile) {
  const relativePath = normalizeLocalResource(localFile)
  const roots = [packagedResourceDir, bundledResourceDir]
  const candidates = roots.map((root) => path.resolve(root, relativePath))
  return candidates.find((filePath) => roots.some((root) => isInside(filePath, root)) && fs.existsSync(filePath))
}

module.exports = function () {
  for (let i = 1; i <= maxSgsPartitions; i++) {
    const ses = session.fromPartition(`persist:sgs${i}`)

    ses.protocol.handle('atom', async (request) => {
      if (isOpenConfigFileRequest(request.url)) {
        const result = await openConfigFile()
        return jsonResponse(result, result.ok ? 200 : 500)
      }

      const relativePath = resolveAtomResource(request.url)
      const safePath = resolveResourcePath(relativePath)
      if (!safePath) {
        throw new Error(`Missing local resource: ${relativePath}`)
      }

      return net.fetch(pathToFileURL(safePath).toString())
    })

    ses.webRequest.onBeforeRequest(filter, (details, callback) => {
      const { url } = details

      for (const [remotePath, localFile] of Object.entries(localResourceMap)) {
        if (url.includes(remotePath) && resolveResourcePath(localFile)) {
          return callback({ redirectURL: `atom://${localFile}` })
        }
      }

      if (url.includes('sdk.rum.aliyuncs.com/v2/browser-sdk.js')) {
        return callback({ cancel: true })
      }

      callback({})
    })
  }
}
