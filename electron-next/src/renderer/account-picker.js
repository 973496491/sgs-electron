// Independent account picker. No legacy managerData or automatic login hooks.
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && root.document) root.SGSAccountPicker = api
})(typeof window === 'object' ? window : globalThis, function () {
  const STORAGE_KEY = 'sgsAccountPicker.v1'

  // Pointer capture plus a temporary shield keeps drags over the game webview
  // in the shell. Positions live only in memory, separate from credentials.
  function makeDraggable(target, handle, options = {}) {
    const doc = target.ownerDocument
    const win = doc.defaultView
    let position = options.position || null
    let active = null, shield = null, suppressClick = false
    const originalCursor = handle.style.cursor
    handle.style.touchAction = 'none'
    handle.style.userSelect = 'none'

    function place(left, top) {
      const rect = target.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const maxLeft = Math.max(8, win.innerWidth - rect.width - 8)
      const maxTop = Math.max(8, win.innerHeight - rect.height - 8)
      position = { left: Math.max(8, Math.min(left, maxLeft)), top: Math.max(8, Math.min(top, maxTop)) }
      target.style.position = 'fixed'
      target.style.transform = 'none'
      target.style.left = position.left + 'px'
      target.style.top = position.top + 'px'
      if (options.onPosition) options.onPosition(position)
    }
    function clamp() { if (position) place(position.left, position.top) }
    function finish(event) {
      if (!active || (event && event.pointerId !== undefined && event.pointerId !== active.id)) return
      const previous = active
      active = null
      suppressClick = previous.moved
      handle.style.cursor = originalCursor
      if (shield) { shield.remove(); shield = null }
      try { if (handle.hasPointerCapture(previous.id)) handle.releasePointerCapture(previous.id) } catch (_) {}
    }
    function down(event) {
      if (active || event.button !== 0 || event.isPrimary === false) return
      suppressClick = false
      const control = event.target.closest && event.target.closest('button,input,textarea,select,a,[contenteditable]')
      if (control && control !== handle) return
      const rect = target.getBoundingClientRect()
      active = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false }
      try { handle.setPointerCapture(event.pointerId) } catch (_) {}
    }
    function move(event) {
      if (!active || event.pointerId !== active.id) return
      const dx = event.clientX - active.x, dy = event.clientY - active.y
      if (!active.moved && Math.hypot(dx, dy) < 5) return
      if (!active.moved) {
        active.moved = true
        handle.style.cursor = 'grabbing'
        shield = doc.createElement('div')
        shield.className = 'sap-drag-shield'
        shield.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147482999;cursor:grabbing;touch-action:none;background:transparent;-webkit-app-region:no-drag'
        doc.body.appendChild(shield)
      }
      event.preventDefault()
      place(active.left + dx, active.top + dy)
    }
    function click(event) {
      if (!suppressClick || event.detail === 0 || !handle.contains(event.target)) return
      suppressClick = false
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    handle.addEventListener('pointerdown', down)
    // Older Chromium invokes onclick before capture listeners on the target.
    // Catch the trailing click on an ancestor before it reaches the launcher.
    doc.addEventListener('click', click, true)
    handle.addEventListener('lostpointercapture', finish)
    doc.addEventListener('pointermove', move, true)
    doc.addEventListener('pointerup', finish, true)
    doc.addEventListener('pointercancel', finish, true)
    win.addEventListener('blur', finish)
    win.addEventListener('resize', clamp)
    const observer = win.ResizeObserver ? new win.ResizeObserver(clamp) : null
    if (observer) observer.observe(target)
    clamp()
    return {
      clamp,
      cancel: () => finish(),
      destroy() {
        finish()
        handle.removeEventListener('pointerdown', down)
        doc.removeEventListener('click', click, true)
        handle.removeEventListener('lostpointercapture', finish)
        doc.removeEventListener('pointermove', move, true)
        doc.removeEventListener('pointerup', finish, true)
        doc.removeEventListener('pointercancel', finish, true)
        win.removeEventListener('blur', finish)
        win.removeEventListener('resize', clamp)
        if (observer) observer.disconnect()
      }
    }
  }

  function validate(accounts) {
    if (!Array.isArray(accounts)) throw new Error('账号数据格式异常，未覆盖原数据。')
    const ids = new Set()
    const names = new Set()
    for (const item of accounts) {
      if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || typeof item.alias !== 'string' ||
          typeof item.account !== 'string' || !item.account.trim() || typeof item.password !== 'string' || !item.password ||
          ids.has(item.id) || names.has(item.account.trim())) {
        throw new Error('账号数据格式异常或存在重复账号，未覆盖原数据。')
      }
      ids.add(item.id)
      names.add(item.account.trim())
    }
    return accounts
  }

  function createStore(getStorage) {
    function raw() {
      try { return getStorage().getItem(STORAGE_KEY) } catch (_) { throw new Error('无法读取账号数据，请关闭后重试。') }
    }
    function check(expected) {
      if (raw() !== expected) throw new Error('账号列表已在其他窗口更新，请关闭后重新打开。')
    }
    return {
      read() {
        const value = raw()
        if (value === null) return { raw: value, accounts: [] }
        let data
        try { data = JSON.parse(value) } catch (_) { throw new Error('账号数据无法解析，未覆盖原数据。') }
        if (!data || data.version !== 1) throw new Error('账号数据版本异常，未覆盖原数据。')
        return { raw: value, accounts: validate(data.accounts) }
      },
      check,
      save(accounts, expected) {
        validate(accounts)
        check(expected)
        const value = JSON.stringify({ version: 1, accounts })
        try { getStorage().setItem(STORAGE_KEY, value) } catch (_) { throw new Error('保存失败，原账号数据未更改，请重试。') }
        return value
      }
    }
  }

  // Serialized into the current webview; keep this function self-contained.
  function fillLogin(record) {
    if (window.location.origin !== 'https://web.sanguosha.com' ||
        window.location.pathname !== '/login/air/client/h5/index') {
      return { ok: false, message: '请先返回 OL 登录界面，再选择账号。' }
    }
    const account = document.getElementById('SGS_login-account')
    const password = document.getElementById('SGS_login-password')
    const login = document.getElementById('SGS_login-btn')
    if (!account || !password || !login) return { ok: false, message: '登录框尚未就绪，请稍后重试。' }
    if (!record || typeof record.account !== 'string' || !record.account.trim() ||
        typeof record.password !== 'string' || !record.password) {
      return { ok: false, message: '账号或密码为空，请先编辑账号。' }
    }
    account.value = record.account
    password.value = record.password
    for (const input of [account, password]) {
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const proto = document.getElementById('SGS_userProto')
    if (proto) {
      proto.checked = true
      if (proto.parentNode) proto.parentNode.classList.add('on')
    }
    login.removeAttribute('disabled')
    login.classList.remove('SGS_loginbtn-disable')
    // Only fill; do not click, submit, navigate, or access the login protocol.
    return { ok: true }
  }

  const css = `
    #sgsAccountPicker{position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.65);color:#efe8d5;font:14px/1.5 "Microsoft YaHei",sans-serif;-webkit-app-region:no-drag}
    #sgsAccountPicker *{box-sizing:border-box;-webkit-app-region:no-drag}
    #sgsAccountPicker [hidden]{display:none!important}
    #sgsAccountPicker .sap-dialog{width:790px;max-width:calc(100vw - 40px);max-height:calc(100vh - 40px);display:flex;flex-direction:column;background:#242321;border:1px solid #8a7954;border-radius:12px;box-shadow:0 18px 70px #0009;overflow:hidden}
    #sgsAccountPicker .sap-header,#sgsAccountPicker .sap-footer{display:flex;align-items:center;gap:12px;padding:16px 20px;flex-shrink:0}
    #sgsAccountPicker .sap-header{border-bottom:1px solid #494337;cursor:grab;user-select:none;touch-action:none}
    #sgsAccountPicker h2{font-size:19px;font-weight:600;margin:0;flex:1}
    #sgsAccountPicker button{font:inherit;cursor:pointer;border:1px solid #6a5e47;border-radius:6px;background:#35312b;color:#f4e8c9;padding:7px 17px;position:static}
    #sgsAccountPicker button:hover{background:#484033}
    #sgsAccountPicker button:disabled{opacity:.4;cursor:default}
    #sgsAccountPicker button:focus-visible,#sgsAccountPicker input:focus-visible{outline:2px solid #e3bc69;outline-offset:2px}
    #sgsAccountPicker .sap-close{padding:2px 10px;font-size:23px;border:0;background:transparent}
    #sgsAccountPicker .sap-body{padding:16px 20px;overflow:auto;min-height:0}
    #sgsAccountPicker .sap-list{display:flex;flex-direction:column;gap:9px;max-height:44vh;overflow:auto;padding:2px}
    #sgsAccountPicker .sap-choice{width:100%;text-align:left;display:flex;align-items:center;gap:12px;padding:12px 14px;background:#2e2c29;border-color:#4a463d}
    #sgsAccountPicker .sap-choice[aria-checked=true]{border-color:#e0b563;background:#51452c;box-shadow:inset 3px 0 #e0b563}
    #sgsAccountPicker .sap-radio{width:16px;height:16px;border:1px solid #a99c7d;border-radius:50%;flex-shrink:0}
    #sgsAccountPicker .sap-choice[aria-checked=true] .sap-radio{border:4px solid #e0b563;background:#242321}
    #sgsAccountPicker .sap-info{min-width:0;flex:1;overflow-wrap:anywhere}
    #sgsAccountPicker .sap-name{font-size:15px;font-weight:600}
    #sgsAccountPicker .sap-account{color:#b9b1a0;font-size:13px}
    #sgsAccountPicker .sap-empty{padding:32px 12px;text-align:center;color:#b9b1a0}
    #sgsAccountPicker .sap-add{padding:13px;background:#302d26;border:1px solid #60543d;border-radius:8px;margin-bottom:16px}
    #sgsAccountPicker .sap-add-title{font-weight:600;margin-bottom:10px}
    #sgsAccountPicker .sap-fields{display:grid;grid-template-columns:1fr 1.2fr 1.2fr;gap:9px;flex:1;min-width:0}
    #sgsAccountPicker label{display:block;min-width:0;color:#c8bfa9;font-size:12px}
    #sgsAccountPicker input{position:static;display:block;width:100%;min-width:0;margin:4px 0 0;padding:8px;border:1px solid #625a4a;border-radius:5px;background:#1c1c1b;color:#f4e8c9;font:14px "Microsoft YaHei",sans-serif;user-select:text}
    #sgsAccountPicker .sap-add-actions{display:flex;justify-content:flex-end;margin-top:10px}
    #sgsAccountPicker .sap-edit-row{display:flex;align-items:center;gap:10px;border:1px solid #4a463d;border-radius:7px;padding:10px}
    #sgsAccountPicker .sap-order{display:flex;flex-direction:column;gap:4px;flex-shrink:0}
    #sgsAccountPicker .sap-order button{padding:0 7px;line-height:22px}
    #sgsAccountPicker .sap-row-actions{display:flex;gap:6px;flex-shrink:0}
    #sgsAccountPicker .sap-row-actions button{padding:5px 10px}
    #sgsAccountPicker .sap-delete{color:#f0aaaa;border-color:#865252}
    #sgsAccountPicker .sap-primary{background:#c6a15b;color:#201d17;border-color:#c6a15b}
    #sgsAccountPicker .sap-primary:hover{background:#dfba74}
    #sgsAccountPicker .sap-footer{justify-content:flex-end;border-top:1px solid #494337}
    #sgsAccountPicker .sap-status{flex:1;min-height:21px;color:#c7bea9;font-size:12px;overflow-wrap:anywhere}
    #sgsAccountPicker .sap-status[data-error=true]{color:#ffb1a8}
    @media(max-width:650px){#sgsAccountPicker .sap-edit-row{flex-wrap:wrap}#sgsAccountPicker .sap-edit-row .sap-fields{min-width:75%}#sgsAccountPicker .sap-row-actions{margin-left:auto}#sgsAccountPicker .sap-header,#sgsAccountPicker .sap-footer,#sgsAccountPicker .sap-body{padding:12px}}
  `

  function createPicker(options) {
    const doc = options.document
    const store = options.store || createStore(() => doc.defaultView.localStorage)
    let overlay, list, addArea, footerEdit, footerConfirm, status, title, lastFocus
    let accounts = [], revision = null, selected = null, editing = null, draft = null
    let addDraft = emptyDraft(), mode = 'select', busy = false, loadFailed = false
    let sequence = 0
    let dialogDrag = null, dialogPosition = null

    function emptyDraft() { return { alias: '', account: '', password: '' } }
    function el(tag, className, text) {
      const node = doc.createElement(tag)
      if (className) node.className = className
      if (text !== undefined) node.textContent = text
      return node
    }
    function button(text, action, className) {
      const node = el('button', className, text)
      node.type = 'button'
      node.addEventListener('click', () => { if (!busy) action() })
      return node
    }
    function message(text, error = false) {
      if (!status) return
      status.textContent = text
      status.dataset.error = String(error)
    }
    function attempt(action) {
      try { action() } catch (error) { message(error.message, true) }
    }
    function save(next) {
      revision = store.save(next, revision)
      accounts = next
      if (!accounts.some(item => item.id === selected)) selected = accounts.length ? accounts[0].id : null
      message('已保存')
    }
    function values(data, excluding) {
      const value = { alias: data.alias.trim(), account: data.account.trim(), password: data.password }
      if (!value.account || !value.password) throw new Error('请填写账号和密码。')
      if (accounts.some(item => item.id !== excluding && item.account === value.account)) throw new Error('该账号已存在，请修改已有记录。')
      return value
    }
    function fields(data, prefix) {
      const group = el('div', 'sap-fields')
      for (const [key, label] of [['alias', '别名'], ['account', '账号'], ['password', '密码']]) {
        const wrapper = el('label', '', label)
        const input = el('input')
        input.type = 'text'
        input.value = data[key]
        input.autocomplete = key === 'password' ? 'new-password' : 'off'
        input.spellcheck = false
        input.dataset.field = prefix + '-' + key
        input.addEventListener('input', () => { data[key] = input.value })
        wrapper.appendChild(input)
        group.appendChild(wrapper)
      }
      return group
    }
    function info(item) {
      const block = el('div', 'sap-info')
      block.appendChild(el('div', 'sap-name', item.alias || item.account))
      block.appendChild(el('div', 'sap-account', item.account))
      return block
    }
    function focus(selector) {
      const node = overlay && overlay.querySelector(selector)
      if (node) node.focus()
    }
    function move(id, delta) {
      attempt(() => {
        const index = accounts.findIndex(item => item.id === id)
        const target = index + delta
        if (index < 0 || target < 0 || target >= accounts.length) return
        const next = accounts.slice()
        const item = next.splice(index, 1)[0]
        next.splice(target, 0, item)
        save(next)
        renderList()
        focus('[data-id="' + id + '"] [data-action="' + (delta < 0 ? 'up' : 'down') + '"]')
      })
    }
    function renderList() {
      list.textContent = ''
      list.setAttribute('role', mode === 'select' ? 'radiogroup' : 'list')
      list.setAttribute('aria-label', '账号列表')
      if (!accounts.length) list.appendChild(el('div', 'sap-empty', mode === 'select' ? '暂无账号，点击“编辑”添加。' : '暂无账号，请在上方添加。'))
      accounts.forEach((item, index) => {
        if (mode === 'select') {
          const row = button('', () => {
            selected = item.id
            for (const node of list.querySelectorAll('.sap-choice')) node.setAttribute('aria-checked', String(node.dataset.id === selected))
          }, 'sap-choice')
          row.dataset.id = item.id
          row.setAttribute('role', 'radio')
          row.setAttribute('aria-checked', String(item.id === selected))
          row.appendChild(el('span', 'sap-radio'))
          row.appendChild(info(item))
          list.appendChild(row)
          return
        }
        const row = el('div', 'sap-edit-row')
        row.dataset.id = item.id
        row.setAttribute('role', 'listitem')
        const order = el('div', 'sap-order')
        for (const [text, delta, action, label] of [['↑', -1, 'up', '上移'], ['↓', 1, 'down', '下移']]) {
          const arrow = button(text, () => move(item.id, delta))
          arrow.dataset.action = action
          arrow.setAttribute('aria-label', label)
          arrow.disabled = index + delta < 0 || index + delta >= accounts.length
          order.appendChild(arrow)
        }
        row.appendChild(order)
        row.appendChild(item.id === editing ? fields(draft, 'edit') : info(item))
        const actions = el('div', 'sap-row-actions')
        const edit = button(item.id === editing ? '确定' : '修改', () => attempt(() => {
          if (editing === item.id) {
            const updated = Object.assign({ id: item.id }, values(draft, item.id))
            save(accounts.map(value => value.id === item.id ? updated : value))
            editing = null
            draft = null
          } else {
            if (editing) throw new Error('请先确定当前正在修改的账号。')
            editing = item.id
            draft = { alias: item.alias, account: item.account, password: item.password }
            message('修改后点击该行“确定”保存。')
          }
          renderList()
          focus(editing ? '[data-field="edit-alias"]' : '[data-id="' + item.id + '"] [data-action="edit"]')
        }), item.id === editing ? 'sap-primary' : '')
        edit.dataset.action = 'edit'
        edit.disabled = !!editing && editing !== item.id
        const remove = button('删除', () => attempt(() => {
          save(accounts.filter(value => value.id !== item.id))
          if (editing === item.id) { editing = null; draft = null }
          renderList()
        }), 'sap-delete')
        remove.dataset.action = 'delete'
        actions.appendChild(edit)
        actions.appendChild(remove)
        row.appendChild(actions)
        list.appendChild(row)
      })
    }
    function render() {
      title.textContent = mode === 'select' ? '账号选择' : '编辑账号'
      addArea.hidden = mode !== 'edit'
      footerEdit.textContent = mode === 'select' ? '编辑' : '返回'
      footerConfirm.hidden = mode !== 'select'
      renderList()
    }
    function close() {
      if (busy || !overlay) return
      if (dialogDrag) { dialogDrag.destroy(); dialogDrag = null }
      overlay.remove()
      overlay = null
      status = null
      accounts = []
      draft = null
      addDraft = emptyDraft()
      if (lastFocus && lastFocus.isConnected) lastFocus.focus()
    }
    async function confirm() {
      if (busy || loadFailed) return
      if (!accounts.length) { close(); return }
      const item = accounts.find(value => value.id === selected)
      if (!item) { message('请选择一个账号。', true); return }
      try {
        store.check(revision)
        busy = true
        for (const control of overlay.querySelectorAll('button')) control.disabled = true
        message('正在填充…')
        await options.fill({ account: item.account, password: item.password })
        busy = false
        close()
      } catch (error) {
        busy = false
        for (const control of overlay.querySelectorAll('button')) control.disabled = false
        message(error.message || '填充失败，请返回登录界面后重试。', true)
      }
    }
    function open() {
      if (overlay) { focus('.sap-close'); return }
      lastFocus = doc.activeElement
      mode = 'select'; editing = null; draft = null; addDraft = emptyDraft(); loadFailed = false
      overlay = el('div')
      overlay.id = 'sgsAccountPicker'
      const style = el('style')
      style.textContent = css
      overlay.appendChild(style)
      const dialog = el('section', 'sap-dialog')
      dialog.setAttribute('role', 'dialog')
      dialog.setAttribute('aria-modal', 'true')
      dialog.setAttribute('aria-labelledby', 'sgsAccountPickerTitle')
      const header = el('div', 'sap-header')
      header.title = '按住标题栏拖动'
      title = el('h2', '', '账号选择')
      title.id = 'sgsAccountPickerTitle'
      const x = button('×', close, 'sap-close')
      x.setAttribute('aria-label', '关闭')
      header.appendChild(title); header.appendChild(x)
      const body = el('div', 'sap-body')
      addArea = el('div', 'sap-add')
      addArea.appendChild(el('div', 'sap-add-title', '添加账号'))
      let addFields = fields(addDraft, 'add')
      addArea.appendChild(addFields)
      const addActions = el('div', 'sap-add-actions')
      const add = button('添加', () => attempt(() => {
        const value = values(addDraft)
        const id = 'a' + Date.now().toString(36) + (++sequence).toString(36) + Math.random().toString(36).slice(2)
        save([Object.assign({ id }, value)].concat(accounts))
        addDraft = emptyDraft()
        const next = fields(addDraft, 'add')
        addArea.replaceChild(next, addFields)
        addFields = next
        renderList()
        focus('[data-field="add-alias"]')
      }), 'sap-primary')
      add.dataset.action = 'add'
      addActions.appendChild(add); addArea.appendChild(addActions)
      list = el('div', 'sap-list')
      body.appendChild(addArea); body.appendChild(list)
      const footer = el('div', 'sap-footer')
      status = el('div', 'sap-status')
      status.setAttribute('role', 'status')
      footerEdit = button('编辑', () => {
        if (mode === 'edit' && editing) { message('请先点击该行“确定”保存修改。', true); return }
        mode = mode === 'select' ? 'edit' : 'select'
        if (mode === 'select') selected = accounts.length ? accounts[0].id : null
        render()
        message(mode === 'edit' ? '使用上下箭头调整顺序；修改后点击该行“确定”保存。' : '确定后填入登录框，再手动登录。')
        focus(mode === 'edit' ? '[data-field="add-alias"]' : '.sap-choice')
      })
      footerEdit.dataset.action = 'mode'
      footerConfirm = button('确定', confirm, 'sap-primary')
      footerConfirm.dataset.action = 'confirm'
      footer.appendChild(status); footer.appendChild(footerEdit); footer.appendChild(footerConfirm)
      dialog.appendChild(header); dialog.appendChild(body); dialog.appendChild(footer)
      overlay.appendChild(dialog)
      overlay.addEventListener('keydown', event => {
        event.stopPropagation()
        if (event.key === 'Escape') { event.preventDefault(); close() }
        if (event.key === 'Tab') {
          const nodes = Array.from(overlay.querySelectorAll('button:not(:disabled),input:not(:disabled)')).filter(node => node.getClientRects().length)
          const index = nodes.indexOf(doc.activeElement)
          const next = event.shiftKey ? index - 1 : index + 1
          if (nodes.length && (next < 0 || next >= nodes.length)) {
            event.preventDefault()
            nodes[next < 0 ? nodes.length - 1 : 0].focus()
          }
        }
      })
      doc.body.appendChild(overlay)
      try {
        const data = store.read()
        accounts = data.accounts; revision = data.raw
        selected = accounts.length ? accounts[0].id : null
        render()
        message('确定后填入登录框，再手动登录。')
      } catch (error) {
        accounts = []; selected = null; loadFailed = true
        render()
        footerEdit.disabled = true; footerConfirm.disabled = true
        message(error.message, true)
      }
      focus(accounts.length ? '.sap-choice' : '.sap-close')
      dialogDrag = makeDraggable(dialog, header, {
        position: dialogPosition,
        onPosition: position => { dialogPosition = position }
      })
    }
    return { open, close }
  }

  function attach(webview, options) {
    const picker = createPicker({
      document: options.document,
      fill: async record => {
        if (options.getPackageId() !== 1 && options.getPackageId() !== 2) throw new Error('填充仅支持 OL 登录界面。')
        let url
        try { url = new URL(webview.getURL()) } catch (_) { throw new Error('请先打开 OL 登录界面。') }
        if (url.origin !== 'https://web.sanguosha.com' || url.pathname !== '/login/air/client/h5/index') throw new Error('请先返回 OL 登录界面，再选择账号。')
        const value = JSON.stringify(record).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
        let result
        try { result = await webview.executeJavaScript('(' + fillLogin.toString() + ')(' + value + ')') }
        catch (_) { throw new Error('填充失败，请确认登录界面已加载后重试。') }
        if (!result || !result.ok) throw new Error(result && result.message || '填充失败，请重试。')
      }
    })

    const doc = options.document
    let launcher = doc.getElementById('sgsAccountPickerLauncher')
    if (!launcher) {
      launcher = doc.createElement('button')
      launcher.id = 'sgsAccountPickerLauncher'
      launcher.type = 'button'
      launcher.textContent = '账号选择'
      launcher.setAttribute('aria-haspopup', 'dialog')
      launcher.title = '点击选择账号，按住拖动位置'
      launcher.style.cssText = 'position:fixed;left:50%;top:66.6667%;transform:translate(-50%,-50%);z-index:2147482000;min-width:148px;padding:11px 25px;border:1px solid #dfbd7c;border-radius:8px;background:#c6a15b;color:#201d17;box-shadow:0 4px 18px #0007;font:16px "Microsoft YaHei",sans-serif;cursor:grab;-webkit-app-region:no-drag'
      doc.body.appendChild(launcher)
    }
    launcher.onclick = () => picker.open()
    if (!launcher.__sgsAccountDrag) launcher.__sgsAccountDrag = makeDraggable(launcher, launcher)
    function updateLauncher() {
      let visible = false
      try {
        const url = new URL(webview.getURL())
        const packageId = options.getPackageId()
        visible = (packageId === 1 || packageId === 2) && url.origin === 'https://web.sanguosha.com' &&
          url.pathname === '/login/air/client/h5/index'
      } catch (_) {}
      launcher.hidden = !visible
      if (visible) launcher.__sgsAccountDrag.clamp()
      else launcher.__sgsAccountDrag.cancel()
    }
    webview.addEventListener('dom-ready', updateLauncher)
    webview.addEventListener('did-navigate', updateLauncher)
    webview.addEventListener('did-navigate-in-page', updateLauncher)
    webview.addEventListener('did-start-navigation', event => {
      if (event.isMainFrame !== false && !event.isInPlace) {
        launcher.hidden = true
        launcher.__sgsAccountDrag.cancel()
      }
    })
    updateLauncher()
    return picker
  }

  return { STORAGE_KEY, createStore, createPicker, fillLogin, attach }
})
