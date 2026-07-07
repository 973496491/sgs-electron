(function () {
  var state = (window.__localSkinDebug = window.__localSkinDebug || {
    hookedMethods: new WeakSet(),
    timers: [],
    moduleHook: null,
    showHooked: false,
    bootstrapTimer: null,
    pendingSkin: null
  })

  if (state.started) {
    return
  }

  state.started = true
  state.loadedAt = Date.now()
  state.loadCount = (state.loadCount || 0) + 1

  function log() {
    try {
      var args = ['[local-skin-debug]']
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i])
      ;(console._log || console.log).apply(console, args)
    } catch (error) {
    }
  }

  function notifyLoaded(attempt) {
    attempt = attempt || 0
    try {
      var text = '\u672c\u5730\u76ae\u80a4\u529f\u80fd\u5df2\u89e3\u9501'
      if (window.XC && typeof window.XC.addTooltip === 'function') {
        window.XC.addTooltip(text, 'acTooltip', 3000, 'green')
        return
      }

      if (attempt < 30) {
        setTimeout(function () {
          notifyLoaded(attempt + 1)
        }, 200)
        return
      }

      var tip = document.createElement('div')
      tip.textContent = text
      tip.style.cssText =
        'position:fixed;left:12px;top:48px;z-index:2147483647;padding:8px 12px;background:#1b7f4c;color:#fff;font-size:14px;border-radius:4px;pointer-events:none'
      document.body.appendChild(tip)
      setTimeout(function () {
        if (tip.parentNode) tip.parentNode.removeChild(tip)
      }, 2000)
    } catch (error) {
    }
  }

  notifyLoaded()

  window.XC = window.XC || {}
  if (typeof window.XC.isOpenCopy === 'undefined') window.XC.isOpenCopy = true

  function ensureDebugPanel() {
    if (state.panelEl) return state.panelEl
    var panel = document.createElement('div')
    panel.id = 'xcDebugPanel'
    panel.style.cssText =
      'position:fixed;left:12px;top:80px;width:440px;max-height:60vh;z-index:2147483647;background:#1f1f2e;color:#eee;font-family:Consolas,monospace;font-size:12px;border:1px solid #4a4a6a;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden;resize:both'
    var header = document.createElement('div')
    header.style.cssText =
      'padding:6px 10px;background:#2a2a40;cursor:move;user-select:none;font-weight:bold;display:flex;justify-content:space-between;align-items:center'
    var title = document.createElement('span')
    title.textContent = '\u76ae\u80a4\u8c03\u8bd5\u65e5\u5fd7'
    var btns = document.createElement('span')
    var copyBtn = document.createElement('span')
    copyBtn.textContent = '\u590d\u5236'
    copyBtn.style.cssText = 'margin-left:8px;cursor:pointer;color:#8ab4f8'
    var clearBtn = document.createElement('span')
    clearBtn.textContent = '\u6e05\u7a7a'
    clearBtn.style.cssText = 'margin-left:8px;cursor:pointer;color:#f88'
    var minBtn = document.createElement('span')
    minBtn.textContent = '\u2014'
    minBtn.style.cssText = 'margin-left:8px;cursor:pointer;color:#ccc'
    btns.appendChild(copyBtn); btns.appendChild(clearBtn); btns.appendChild(minBtn)
    header.appendChild(title); header.appendChild(btns)
    var body = document.createElement('div')
    body.style.cssText =
      'padding:8px 10px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;flex:1;max-height:50vh;min-height:60px'
    panel.appendChild(header); panel.appendChild(body)
    document.body.appendChild(panel)
    state.panelEl = panel; state.panelBody = body; state.panelMinimized = false

    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0
    header.addEventListener('mousedown', function (e) {
      if (e.target === copyBtn || e.target === clearBtn || e.target === minBtn) return
      dragging = true; sx = e.clientX; sy = e.clientY
      var rect = panel.getBoundingClientRect(); ox = rect.left; oy = rect.top
      panel.style.right = 'auto'; panel.style.bottom = 'auto'
      e.preventDefault()
    })
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return
      panel.style.left = (ox + e.clientX - sx) + 'px'
      panel.style.top = (oy + e.clientY - sy) + 'px'
    })
    document.addEventListener('mouseup', function () { dragging = false })

    copyBtn.addEventListener('click', function () {
      var txt = body.textContent || ''
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt)
        } else {
          var ta = document.createElement('textarea'); ta.value = txt
          ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
        }
      } catch (e) {}
      copyBtn.textContent = '\u5df2\u590d\u5236'
      setTimeout(function () { copyBtn.textContent = '\u590d\u5236' }, 800)
    })
    clearBtn.addEventListener('click', function () { body.textContent = '' })
    minBtn.addEventListener('click', function () {
      state.panelMinimized = !state.panelMinimized
      body.style.display = state.panelMinimized ? 'none' : ''
      minBtn.textContent = state.panelMinimized ? '+' : '\u2014'
    })
    return panel
  }

  function appendDebugLine(text) {
    try {
      if (!(window.XC && window.XC.isOpenCopy)) return
      ensureDebugPanel()
      var body = state.panelBody
      if (!body) return
      var d = new Date()
      var pad = function (n) { return (n < 10 ? '0' : '') + n }
      var stamp = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
      var line = document.createElement('div')
      line.textContent = '[' + stamp + '] ' + String(text)
      line.style.cssText = 'border-bottom:1px solid #2a2a40;padding:3px 0'
      body.appendChild(line)
      body.scrollTop = body.scrollHeight
    } catch (e) {}
  }

  if (window.XC && window.XC.isOpenCopy) ensureDebugPanel()

  function toast(text, id, duration, cls) {
    try {
      var toastId = id || 'skinToast'
      var dur = duration || 4000

      if (window.XC && typeof window.XC.addTooltip === 'function') {
        window.XC.addTooltip(text, toastId, dur, cls)
      } else {
        var old = document.getElementById(toastId)
        if (old) old.remove()
        var tip = document.createElement('div')
        tip.id = toastId
        tip.textContent = String(text)
        tip.style.cssText =
          'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:2147483647;padding:8px 16px;min-width:360px;max-width:90vw;background-color:#fdf6ec;border-left:5px solid #F44336;color:#F44336;font-size:14px;border-radius:4px;box-shadow:0 2px 12px 0 #0000001a;white-space:pre-wrap;word-break:break-all'
        document.body.appendChild(tip)
        setTimeout(function () {
          if (tip.parentNode) tip.parentNode.removeChild(tip)
        }, dur)
      }

      if (window.XC && window.XC.isOpenCopy) {
        try {
          appendDebugLine(String(text))
        } catch (e) {}
      }
    } catch (e) {}
  }

  function shallowDump(obj) {
    try {
      var parts = []
      for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue
        var v = obj[k]
        var tv = typeof v
        if (tv === 'function' || tv === 'undefined') continue
        if (v === null) { parts.push(k + '=null'); continue }
        if (tv === 'object') {
          var inner = {}
          for (var k2 in v) {
            if (Object.prototype.hasOwnProperty.call(v, k2)) {
              var v2 = v[k2]
              var tv2 = typeof v2
              if (tv2 === 'string' || tv2 === 'number' || tv2 === 'boolean') inner[k2] = v2
            }
          }
          parts.push(k + '=' + JSON.stringify(inner))
        } else {
          parts.push(k + '=' + JSON.stringify(v))
        }
      }
      var s = parts.join(' ')
      return s.length > 400 ? s.slice(0, 400) + '…' : s
    } catch (e) {
      try { return String(obj).slice(0, 400) } catch (e2) { return '' }
    }
  }

  function deepDump(obj) {
    try {
      var seen = []
      var s = JSON.stringify(obj, function (k, v) {
        if (typeof v === 'object' && v !== null) {
          if (seen.indexOf(v) >= 0) return '[Circular]'
          seen.push(v)
        }
        if (typeof v === 'function') return '[Function]'
        return v
      }, 2)
      return s
    } catch (e) {
      try { return shallowDump(obj) } catch (e2) { return String(obj) }
    }
  }

  function hookMethod(target, name, before, after) {
    if (!target || typeof target[name] !== 'function') return false

    var original = target[name]
    if (state.hookedMethods.has(original) || original.__localSkinDebugHooked) return true

    function hookedMethod() {
      var beforeData

      try {
        if (before) beforeData = before.apply(this, arguments)
      } catch (error) {
      }

      var result = original.apply(this, arguments)

      try {
        if (after) {
          var afterResult = after.call(this, result, arguments, beforeData)
          if (afterResult !== undefined) result = afterResult
        }
      } catch (error) {
      }

      return result
    }

    hookedMethod.__localSkinDebugHooked = true
    hookedMethod.__localSkinDebugOriginal = original
    state.hookedMethods.add(original)
    state.hookedMethods.add(hookedMethod)
    target[name] = hookedMethod
    return true
  }

  function applyHasSkin(item) {
    if (!item) return

    item.hasSkin = true
    if (item.bg) item.bg.mouseEnabled = true
    if (item.blackbg) item.blackbg.visible = false
    if (item.useTex) item.useTex.visible = item.isUsing
  }

  function hookItem(item) {
    if (!item) return

    var proto = Object.getPrototypeOf(item)

    hookMethod(
      proto,
      'InitData',
      null,
      function () {
        applyHasSkin(this)
      }
    )

    hookMethod(
      proto,
      'InitBaseData',
      null,
      function (result) {
        applyHasSkin(this)
        if (result && typeof result === 'object') {
          result.hasSkin = true
          result.isUsing = true
        }
        return result
      }
    )

    hookMethod(
      proto,
      'RefreshSkinDate',
      null,
      function (result) {
        applyHasSkin(this)
        if (result && typeof result === 'object') {
          result.hasSkin = true
          result.isUsing = true
        }
        return result
      }
    )
  }

  function hookSelectView(view) {
    if (!view) return

    var proto = Object.getPrototypeOf(view)

    hookMethod(
      proto,
      'updateContent',
      null,
      function () {
        hookItems(this)
      }
    )

    hookMethod(
      proto,
      'itemClick',
      function (event) {
        var item = event && event.currentTarget
        if (item) {
          applyHasSkin(item)
          appendDebugLine(
            '点击 id=' + item.SkinID + ' hasSkin=' + !!item.HasSkin +
            ' 动态=' + item.DynamicState + ' 使用中=' + !!item.IsUsing
          )
        }
      },
      null
    )

    hookMethod(
      proto,
      'closeSelectSure',
      function () {
        var skinID = this.closeSelectSkinId
        var generalID = this.realGeneralID
        var dynamic = this.closeSelectDynamicState
        appendDebugLine(
          'closeSelectSure触发: skinId=' + skinID +
          ' 动态=' + dynamic +
          ' generalID=' + generalID +
          ' clientID=' + this.clientID
        )
        if (!skinID) {
          appendDebugLine('closeSelectSure: skinID为空, 跳过本地替换')
          return
        }
        if (!generalID) {
          appendDebugLine('closeSelectSure: generalID为空, 跳过本地替换')
          return
        }
        state.pendingSkin = {
          generalID: generalID,
          skinID: skinID,
          isDynamic: dynamic,
          ts: Date.now()
        }
        appendDebugLine('closeSelectSure: 已记录pendingSkin gid=' + generalID + ' sid=' + skinID + ' dyn=' + dynamic)
      },
      null
    )

    hookMethod(
      proto,
      'RefreshShareSkin',
      null,
      function () {
        hookItems(this)
      }
    )

    hookItems(view)
  }

  function hookItems(view) {
    if (!view || !view.itemList || !view.itemList.length) return

    view.itemList.forEach(hookItem)
  }

  function childList(node) {
    if (!node) return []

    if (Array.isArray(node._children)) return node._children
    if (Array.isArray(node._childs)) return node._childs
    if (Array.isArray(node.children)) return node.children

    if (typeof node.numChildren === 'number' && typeof node.GetChildAt === 'function') {
      var children = []
      for (var index = 0; index < node.numChildren; index++) {
        children.push(node.GetChildAt(index))
      }
      return children
    }

    return []
  }

  function walkDisplayTree(root, visit) {
    if (!root) return

    var seen = new WeakSet()
    var stack = [root]
    var limit = 5000

    while (stack.length && limit-- > 0) {
      var node = stack.pop()
      if (!node || typeof node !== 'object' || seen.has(node)) continue

      seen.add(node)
      visit(node)

      var children = childList(node)
      for (var index = children.length - 1; index >= 0; index--) {
        stack.push(children[index])
      }
    }
  }

  function looksLikeChangeSkinWindow(node) {
    return !!(
      node &&
      node.selectView &&
      typeof node.selectView.itemClick === 'function' &&
      (node.resName === 'selectSkin' || typeof node.selectView.updateContent === 'function')
    )
  }

  function wait(condition, interval, timeout) {
    interval = interval || 50
    timeout = timeout || 2000
    return new Promise(function (resolve) {
      var elapsed = 0

      function tick() {
        var value = null
        try {
          value = condition()
        } catch (error) {
          value = null
        }
        if (value) return resolve(value)
        elapsed += interval
        if (elapsed >= timeout) return resolve(null)
        setTimeout(tick, interval)
      }

      tick()
    })
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms)
    })
  }

  function patchChangeSkinWindow(win) {
    if (!win) return
    log('patch: start, resName =', win.resName)

    wait(
      function () {
        return win && win.selectView ? win.selectView : null
      },
      50,
      2000
    ).then(function (selectView) {
      if (!selectView) {
        log('patch: wait timed out, no selectView')
        return
      }
      log('patch: selectView ready, items =', selectView.itemList ? selectView.itemList.length : 0)
      hookSelectView(selectView)

      wait(
        function () {
          return selectView.itemList && selectView.itemList.length ? selectView : null
        },
        50,
        4000
      ).then(function (readyView) {
        if (!readyView) {
          log('patch: wait timed out, no selectView.itemList')
          return
        }
        sleep(50).then(function () {
          hookItems(readyView)
        })
      })
    })
  }

  function installShowHook(proto) {
    if (!proto) return false
    return hookMethod(proto, 'Show', null, function () {
      patchChangeSkinWindow(this)
    })
  }

  function resolveWindowFromEvent(first) {
    if (!first || typeof first !== 'object') return null
    var candidates = [
      first,
      first.window,
      first.target,
      first.instance,
      first.data,
      first.protoObj,
      first.ProtoObj
    ]
    for (var i = 0; i < candidates.length; i++) {
      if (looksLikeChangeSkinWindow(candidates[i])) return candidates[i]
    }
    return null
  }

  function findChangeSkinWindow() {
    var found = null
    var roots = []

    if (window.Laya && Laya.stage) roots.push(Laya.stage)
    if (window.stage) roots.push(window.stage)

    roots.forEach(function (root) {
      if (found) return
      walkDisplayTree(root, function (node) {
        if (!found && looksLikeChangeSkinWindow(node)) found = node
      })
    })
    return found
  }

  function bootstrapWindow(first) {
    if (state.showHooked) return true

    var win = resolveWindowFromEvent(first) || findChangeSkinWindow()
    if (!win) {
      return false
    }

    log('bootstrap: found ChangeSkinWindow', win.resName)
    var hooked = installShowHook(Object.getPrototypeOf(win))
    log('bootstrap: installShowHook(Show) =', hooked)
    if (hooked) {
      state.showHooked = true
    }
    patchChangeSkinWindow(win)
    return true
  }

  function installSgsModuleHook() {
    if (!Array.isArray(window.SGSMODULE)) return

    state.moduleHook = function () {
      var first = arguments[0]
      if (
        first === '\u8d44\u6e90\u7ec4\u52a0\u8f7d\u5b8c\u6bd5\uff1aselectSkin' ||
        (first && first.WindowName === 'ChangeSkinWindow') ||
        (first && first.className === 'ChangeSkinWindow')
      ) {
        log('sgs signal: ChangeSkinWindow open event')
        if (state.showHooked) return
        if (!bootstrapWindow(first)) {
          setTimeout(function () { bootstrapWindow(first) }, 0)
          setTimeout(function () { bootstrapWindow(first) }, 100)
          setTimeout(function () { bootstrapWindow(first) }, 300)
          setTimeout(function () { bootstrapWindow(first) }, 700)
        }
      }
    }

    window.SGSMODULE.push(state.moduleHook)

    if (!state.respListenerPushed) {
      state.respListenerPushed = true
      state.respHook = function () {
        var first = arguments[0]
        if (!first || typeof first !== 'object') return
        var cn = first.className || ''
        if (!cn || cn === 'ChangeSkinWindow') return
        if (cn.toLowerCase().indexOf('skin') === -1) return
        if (state.pendingSkin && state.pendingSkin.skinID) {
          var age = Date.now() - (state.pendingSkin.ts || 0)
          appendDebugLine('respHook: 检测到pendingSkin gid=' + state.pendingSkin.generalID + ' sid=' + state.pendingSkin.skinID + ' age=' + age + 'ms')
          var skinList = first.GeneralSkinList
          if (!skinList && first.Protocol) skinList = first.Protocol.GeneralSkinList
          if (skinList && skinList.length > 0) {
            var entry = skinList[0]
            appendDebugLine('respHook: 响应数据 GeneralID=' + entry.GeneralID + ' SkinID=' + entry.SkinID + ' state=' + entry.state)
            if (entry.SkinID === 0 && entry.GeneralID === state.pendingSkin.generalID) {
              entry.SkinID = state.pendingSkin.skinID
              entry.state = 1
              appendDebugLine('respHook: 已修改响应 SkinID 0→' + state.pendingSkin.skinID + ' state→1')
              appendDebugLine('respHook: 验证修改后 GeneralID=' + entry.GeneralID + ' SkinID=' + entry.SkinID + ' state=' + entry.state)
            } else {
              appendDebugLine('respHook: SkinID非0或GeneralID不匹配, 不修改响应')
            }
          } else {
            appendDebugLine('respHook: 响应无GeneralSkinList, first keys=[' + Object.keys(first).slice(0, 15).join(',') + ']')
          }
        }
        if (window.XC && window.XC.debugSkinResp) debugger
        appendDebugLine('服务端响应 ' + cn + ' ' + deepDump(first))
      }
      window.SGSMODULE.push(state.respHook)
    }
  }

  state.scan = findChangeSkinWindow
  state.patch = patchChangeSkinWindow
  state.diag = function () {
    var info = {
      started: state.started,
      showHooked: state.showHooked,
      pendingSkin: state.pendingSkin
    }
    console.log('[local-skin-debug] diag:', info)
    if (window.XC && window.XC.isOpenCopy) {
      appendDebugLine('diag: ' + JSON.stringify(info, null, 2))
    }
    return info
  }
  state.stop = function () {
    state.timers.forEach(function (timer) {
      clearTimeout(timer)
      clearInterval(timer)
    })
    state.timers.length = 0

    if (state.moduleHook && Array.isArray(window.SGSMODULE)) {
      var index = window.SGSMODULE.indexOf(state.moduleHook)
      if (index >= 0) window.SGSMODULE.splice(index, 1)
    }
    if (state.respHook && Array.isArray(window.SGSMODULE)) {
      var rIndex = window.SGSMODULE.indexOf(state.respHook)
      if (rIndex >= 0) window.SGSMODULE.splice(rIndex, 1)
    }

    state.showHooked = false
    state.bootstrapTimer = null
    state.started = false
  }

  installSgsModuleHook()
  bootstrapWindow(null)
  log('started; bootstrap polling until Show hook installed')

  state.bootstrapTimer = setInterval(function () {
    if (state.showHooked) {
      clearInterval(state.bootstrapTimer)
      var index = state.timers.indexOf(state.bootstrapTimer)
      if (index >= 0) state.timers.splice(index, 1)
      state.bootstrapTimer = null
      log('bootstrap: Show hook installed, polling stopped')
      return
    }
    bootstrapWindow(null)
  }, 500)
  state.timers.push(state.bootstrapTimer)
})()
