(function () {
  function setConfig(key, value) {
    if (window.globalConfig) {
      window.globalConfig[key] = value
    }

    if (window.XC && typeof window.XC.localSet === 'function') {
      window.XC.localSet(key, value)
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }

    window.dispatchEvent(
      new CustomEvent('xc:config-change', {
        detail: {
          key,
          value
        }
      })
    )
  }

  function enableCardBack() {
    setConfig('cardBackSwitch', true)
    setConfig('CARD_BACK_MODE', 'gold')

    const switchEl = document.getElementById('cardBackThemeSwitch')
    if (switchEl) {
      switchEl.checked = true
      switchEl.dispatchEvent(new Event('change', { bubbles: true }))
    }

    if (window.XC && typeof window.XC.addTooltip === 'function') {
      window.XC.addTooltip('本地卡牌背景已开启', 'acTooltip', 2000, 'green')
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableCardBack, { once: true })
  } else {
    enableCardBack()
  }

  setTimeout(enableCardBack, 1500)
})()
