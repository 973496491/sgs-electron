const { contextBridge, ipcRenderer } = require('electron')

const daxiaochaoElectronApi = {
  openConfigFile: () => ipcRenderer.invoke('open-config-file'),
  readCardThemeAsset: relative => ipcRenderer.invoke('read-card-theme-asset', relative)
}

try {
  contextBridge.exposeInMainWorld('daxiaochaoElectron', daxiaochaoElectronApi)
} catch (error) {
  window.daxiaochaoElectron = daxiaochaoElectronApi
}

function installLocalLoadBypass() {
  const failPatterns = [/下载失败/, /更新失败/, /检查更新失败/, /加载失败/, /获取更新失败/, /重试/]
  const localPatterns = [/本地加载/, /进入游戏/, /启动游戏/, /确定/]
  const closePatterns = [/关闭/, /取消/, /知道了/, /确定/]

  function matches(text, patterns) {
    if (!text) return false
    return patterns.some((pattern) => pattern.test(text))
  }

  function clickFirst(nodes, patterns) {
    for (const node of nodes) {
      const text = (node.innerText || node.textContent || '').trim()
      if (!matches(text, patterns)) continue
      node.click()
      return true
    }

    return false
  }

  function handleDialogs(root = document) {
    const candidates = Array.from(
      root.querySelectorAll('div, section, article, dialog, .dialog, .modal, .popup, .layui-layer, .el-message-box')
    )

    for (const candidate of candidates) {
      const text = (candidate.innerText || candidate.textContent || '').trim()
      if (!matches(text, failPatterns)) continue

      const actions = Array.from(candidate.querySelectorAll('button, a, span, div'))
      if (clickFirst(actions, localPatterns)) return true
      if (clickFirst(actions, closePatterns)) return true
    }

    return false
  }

  handleDialogs()

  const observer = new MutationObserver(() => {
    handleDialogs()
  })

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  })
}

window.addEventListener('load', () => {
  window.WDVerSion = '1.0.0'
  console.info('--wd-- ', window.location)
  installLocalLoadBypass()

  fetch('https://cas.dobest.cn/cas/logout?url=https%3A%2F%2Fweb.sanguosha.com%2Findex.html', {
    referrer: 'https://web.sanguosha.com/',
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: null,
    method: 'GET',
    mode: 'no-cors',
    credentials: 'include'
  })
    .then((response) => response.json())
    .catch((err) => console.log('退出登录'))

  // Account selection/editing lives in the client shell, outside this login page.
  if (window.location.origin === 'https://web.sanguosha.com' &&
      window.location.pathname === '/login/air/client/h5/index') {
    const userProto = document.querySelector('#SGS_userProto')
    if (userProto) {
      if (userProto.parentNode) userProto.parentNode.classList.add('on')
      userProto.checked = true
    }
    const loginbtn = document.querySelector('#SGS_login-btn')
    if (loginbtn) {
      loginbtn.removeAttribute('disabled')
      loginbtn.classList.remove('SGS_loginbtn-disable')
    }
  }

  const script = document.createElement('script')
  script.src = 'atom://base.js'
  document.body.appendChild(script)
})
