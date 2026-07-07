(function () {
  const UPDATE_TEXT_PATTERNS = [
    /更新失败/,
    /检查更新失败/,
    /加载失败/,
    /获取更新失败/,
    /下载失败/,
    /重试/
  ]

  const LOCAL_TEXT_PATTERNS = [/本地加载/, /进入游戏/, /确定/]

  function matches(text, patterns) {
    if (!text) return false
    return patterns.some((pattern) => pattern.test(text))
  }

  function clickFirst(candidates, patterns) {
    for (const element of candidates) {
      const text = (element.innerText || element.textContent || '').trim()
      if (matches(text, patterns)) {
        element.click()
        return true
      }
    }

    return false
  }

  function handleUpdateDialog(root = document) {
    const dialogCandidates = Array.from(
      root.querySelectorAll('div, section, article, dialog, .dialog, .modal, .popup, .layui-layer, .el-message-box')
    )

    for (const dialog of dialogCandidates) {
      const text = (dialog.innerText || dialog.textContent || '').trim()
      if (!matches(text, UPDATE_TEXT_PATTERNS)) continue

      const buttons = Array.from(dialog.querySelectorAll('button, a, span'))
      if (clickFirst(buttons, LOCAL_TEXT_PATTERNS)) return true
      if (clickFirst(buttons, [/关闭/, /取消/, /知道了/, /确定/])) return true
    }

    return false
  }

  function boot() {
    handleUpdateDialog()

    const observer = new MutationObserver(() => {
      handleUpdateDialog()
    })

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true })
  } else {
    boot()
  }
})()
