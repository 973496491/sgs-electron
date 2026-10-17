// Top system marquee blocking: controller, preference, settings UI and owned lifecycle.
// Native game dependencies and shared DOM helpers are provided by the userscript host.
module.exports = function createTopMarqueeModule({ window, document, getLaya, getTimer, storage, log = () => {} }) {
  const setTimeout = window.setTimeout.bind(window), clearTimeout = window.clearTimeout.bind(window);
  const requestAnimationFrame = window.requestAnimationFrame.bind(window), cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const getComputedStyle = window.getComputedStyle.bind(window);
  const { ResizeObserver, MutationObserver, CustomEvent } = window;
  let active = false, generation = 0, controllerEpoch = 0, buttonEpoch = 0, mainHost = null;
  function lookup(name) {
    const client = getLaya();
    return client && typeof client.class === "function" ? client.class(name, true) : null;
  }
  const TOP_MARQUEE_STORAGE_KEY = "xcTopMarqueeBlocked";
  const topMarqueeState = {
    enabled: false,
    layer: null,
    hooks: [],
    retryTimer: null,
  };
  try {
    topMarqueeState.enabled = storage.getItem(TOP_MARQUEE_STORAGE_KEY) === "true";
  } catch (_) {}

  function logTopMarqueeBlock(event, error) {
    try { log(event, error); } catch (_) {}
  }

  function getTopMarqueeManager() {
    return lookup("ChatSysNewsManager");
  }

  function finishBlockedTopMarquee(message) {
    const manager = getTopMarqueeManager();
    // 重叠显示的上一条不能结束已经开始的下一条。
    if (!manager || !message || manager.nowPlayeNoticeId !== message.ID) return;
    if (typeof manager.OnTimeOut === "function")
      getTimer().clear(manager, manager.OnTimeOut);
    if (typeof manager.OnNoticPlayEnd === "function") manager.OnNoticPlayEnd();
  }

  function clearOldTopMarqueeQueue() {
    const chat = lookup("ChatManager");
    const queue = chat && chat.BannerSystemNoticeList;
    if (Array.isArray(queue)) queue.length = 0;
  }

  function clearVisibleTopMarquees(layer) {
    if (!layer) return;
    const entries = [];
    if (layer.marqueeUIList && typeof layer.marqueeUIList.forEach === "function")
      layer.marqueeUIList.forEach((id, ui) => { if (ui) entries.push([id, ui]); });
    for (const [id, ui] of entries) {
      if (ui.posId != null && ui.posId !== 0) continue;
      const isNew = ui.isNew;
      getTimer().clearAll(ui);
      if (typeof layer.HideMarquee === "function") layer.HideMarquee(id);
      else {
        if (typeof ui.destroy === "function" && !ui.destroyed) ui.destroy();
        layer.marqueeUIList.del(id);
      }
      if (isNew) finishBlockedTopMarquee({ ID: id });
    }
    if (layer.marqueeUI && typeof layer.RemoveMarquee === "function") {
      getTimer().clearAll(layer.marqueeUI);
      layer.RemoveMarquee();
    }
    clearOldTopMarqueeQueue();
  }

  function installTopMarqueeBlocker(attempt = 0) {
    if (!active) return false;
    try {
      const layer = lookup("PromptLayer");
      const manager = getTopMarqueeManager();
      // 兼容当前页面曾安装的旧空函数；只恢复已知空实现，不覆盖其它挂钩。
      if (manager && typeof manager.__AddNotice === "function" &&
          typeof manager.AddNotice === "function" &&
          /^function\s*\([^)]*\)\s*\{\s*\}$/.test(Function.prototype.toString.call(manager.AddNotice))) {
        Object.defineProperty(manager, "AddNotice", {
          value: manager.__AddNotice, writable: true, configurable: true,
        });
        delete manager.__AddNotice;
      }
      if (layer && !layer.destroyed && typeof layer.ShowMarquee === "function" &&
          manager && typeof manager.OnNoticPlayEnd === "function") {
        cancelControllerRetry();
        topMarqueeState.layer = layer;
        // 原生事件可能保存旧入口引用，挂共同的动态调用方法；原型挂钩覆盖新实例。
        let target = layer;
        while (!Object.prototype.hasOwnProperty.call(target, "ShowMarquee"))
          target = Object.getPrototypeOf(target);
        const installed = topMarqueeState.hooks.find((hook) => hook.target === target);
        if (installed) {
          // A later wrapper may still call ours. Reuse that layer without wrapping it again.
          installed.enabled = true;
          if (target.ShowMarquee === installed.descriptor.value)
            Object.defineProperty(target, "ShowMarquee", { ...installed.descriptor, value: installed.wrapper });
        } else {
          const descriptor = Object.getOwnPropertyDescriptor(target, "ShowMarquee");
          const original = target.ShowMarquee;
          const hook = { target, descriptor, wrapper: null, enabled: true };
          const wrapper = function (message, isNew = false) {
            if (!active || !hook.enabled || !topMarqueeState.enabled)
              return original.apply(this, arguments);
            topMarqueeState.layer = this;
            if (isNew) finishBlockedTopMarquee(message);
            else clearOldTopMarqueeQueue();
          };
          Object.defineProperty(target, "ShowMarquee", { ...descriptor, value: wrapper });
          hook.wrapper = wrapper;
          topMarqueeState.hooks.push(hook);
          logTopMarqueeBlock("install");
        }
        if (topMarqueeState.enabled) clearVisibleTopMarquees(layer);
        return true;
      }
    } catch (error) {
      if (attempt === 0) logTopMarqueeBlock("install:error", error);
    }
    if (attempt < 60 && topMarqueeState.retryTimer === null) {
      const token = generation, epoch = controllerEpoch;
      const timer = setTimeout(() => {
        if (!active || token !== generation || epoch !== controllerEpoch || topMarqueeState.retryTimer !== timer) return;
        topMarqueeState.retryTimer = null;
        installTopMarqueeBlocker(attempt + 1);
      }, 500);
      topMarqueeState.retryTimer = timer;
    }
    return false;
  }

  function setTopMarqueeBlocked(enabled) {
    if (!active) return false;
    topMarqueeState.enabled = !!enabled;
    try {
      storage.setItem(TOP_MARQUEE_STORAGE_KEY, String(topMarqueeState.enabled));
    } catch (error) { logTopMarqueeBlock("save:error", error); }
    if (installTopMarqueeBlocker()) {
      const manager = getTopMarqueeManager();
      if (typeof manager.playNotice === "function") {
        getTimer().clear(manager, manager.playNotice);
        manager.playNotice();
      }
    }
    window.dispatchEvent(new CustomEvent("xc-top-marquee-change"));
    logTopMarqueeBlock(topMarqueeState.enabled ? "toggle:on" : "toggle:off");
    return topMarqueeState.enabled;
  }

  function cancelControllerRetry() {
    controllerEpoch++;
    if (topMarqueeState.retryTimer !== null) clearTimeout(topMarqueeState.retryTimer);
    topMarqueeState.retryTimer = null;
  }
  function cleanupTopMarqueeBlocker() {
    cancelControllerRetry();
    topMarqueeState.hooks = topMarqueeState.hooks.filter(hook => {
      hook.enabled = false;
      if (hook.target.ShowMarquee !== hook.wrapper) return true;
      Object.defineProperty(hook.target, "ShowMarquee", hook.descriptor);
      return false;
    });
    topMarqueeState.layer = null;
  }

  var topMarqueeSwitchLayout = null;
  var topMarqueeButtonTimer = null;

  function syncTopMarqueeButton() {
    var input = document.getElementById("xcTopMarqueeToggle");
    if (!active || !input) return;
    input.disabled = false;
    input.checked = topMarqueeState.enabled;
    input.title = input.checked ? "关闭后恢复顶部滚动广播" : "开启后屏蔽顶部滚动广播";
  }

  function layoutTopMarqueeButton() {
    var state = topMarqueeSwitchLayout;
    if (!active || !state || !state.row.isConnected) return;
    var anchor = mainHost.getAnchor(state.seat);
    var wallpaper = mainHost.getAnchor(state.wallpaper);
    var own = state.row.querySelector(".slider");
    if (!anchor || !wallpaper || !own) return;
    var nativeContainer = state.seat.closest(".switch-container");
    if (nativeContainer) {
      var width = nativeContainer.offsetWidth + "px";
      if (state.row.style.width !== width) state.row.style.width = width;
    }
    var parent = state.parent;
    var parentRect = parent.getBoundingClientRect();
    var wallpaperRect = wallpaper.getBoundingClientRect();
    if (!parentRect.width || !wallpaperRect.height) return;
    var x = anchor.getBoundingClientRect();
    var ownRect = own.getBoundingClientRect();
    var rowRect = state.row.getBoundingClientRect();
    var scaleX = parentRect.width / parent.offsetWidth || 1;
    var scaleY = parentRect.height / parent.offsetHeight || scaleX;
    var left = (x.left + x.width / 2 - parentRect.left -
      (ownRect.left + ownRect.width / 2 - rowRect.left)) / scaleX +
      parent.scrollLeft - parent.clientLeft;
    var top = (wallpaperRect.top + wallpaperRect.height / 2 - parentRect.top -
      (ownRect.top + ownRect.height / 2 - rowRect.top)) / scaleY +
      parent.scrollTop - parent.clientTop;
    var styles = { left: left + "px", top: top + "px", visibility: "visible" };
    for (var key in styles)
      if (state.row.style[key] !== styles[key]) state.row.style[key] = styles[key];
  }

  function cleanupTopMarqueeButton() {
    buttonEpoch++;
    if (topMarqueeButtonTimer !== null) clearTimeout(topMarqueeButtonTimer);
    topMarqueeButtonTimer = null;
    if (topMarqueeSwitchLayout) topMarqueeSwitchLayout.cleanup();
    topMarqueeSwitchLayout = null;
  }

  function installTopMarqueeButton(attempt) {
    if (!active || !mainHost) return false;
    attempt = attempt || 0;
    var seat = document.getElementById("seatUISwitch");
    var panel = seat && seat.closest(".setting.panel-content");
    var header = panel && panel.previousElementSibling;
    var wallpaper = panel && panel.querySelector("#skinPaperSwitch");
    if (!header || !header.matches("button.panel-header") || !wallpaper) {
      if (topMarqueeSwitchLayout) cleanupTopMarqueeButton();
      if (attempt < 240 && topMarqueeButtonTimer === null) {
        const token = generation, epoch = buttonEpoch;
        const timer = setTimeout(function () {
          if (!active || token !== generation || epoch !== buttonEpoch || topMarqueeButtonTimer !== timer) return;
          topMarqueeButtonTimer = null;
          installTopMarqueeButton(attempt + 1);
        }, 250);
        topMarqueeButtonTimer = timer;
      }
      return false;
    }
    if (topMarqueeSwitchLayout && topMarqueeSwitchLayout.row.isConnected &&
        topMarqueeSwitchLayout.seat === seat && topMarqueeSwitchLayout.header === header &&
        topMarqueeSwitchLayout.wallpaper === wallpaper) {
      syncTopMarqueeButton();
      layoutTopMarqueeButton();
      return true;
    }
    cleanupTopMarqueeButton();
    var parent = panel;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    var toggle = mainHost.findSwitchContainer(seat).cloneNode(true);
    mainHost.clearDuplicateIds(toggle);
    for (var node of [toggle].concat(Array.from(toggle.querySelectorAll("*"))))
      for (var attribute of Array.from(node.attributes))
        if (/^on/i.test(attribute.name) || /^data-/.test(attribute.name))
          node.removeAttribute(attribute.name);
    var input = toggle.querySelector("input");
    if (!input) return false;
    // 避开旧的 input[id$="Switch"] 配置绑定，状态由独立本地开关维护。
    input.id = "xcTopMarqueeToggle";
    input.name = "";
    input.type = "checkbox";
    input.removeAttribute("checked");
    input.setAttribute("aria-label", "屏蔽弹幕");
    toggle.style.cssText = "position:relative;display:block;width:56px;height:26px;margin:0 0 0 10px";
    var caption = document.createElement("label");
    caption.htmlFor = input.id;
    caption.className = "explanation";
    caption.textContent = "屏蔽弹幕";
    caption.style.cssText = "white-space:nowrap;cursor:pointer";
    var row = document.createElement("div");
    row.id = "xcTopMarqueeSwitchRow";
    row.className = "switch-container";
    row.style.cssText = "position:absolute;display:block;left:0;top:0;margin:0;height:auto;z-index:2;visibility:hidden";
    row.appendChild(caption);
    row.appendChild(toggle);
    // 放在设置内容内，随该分区一起折叠，保留标题 nextElementSibling 折叠链。
    parent.appendChild(row);
    const token = generation, epoch = buttonEpoch, removers = [];
    const isCurrent = () => active && token === generation && epoch === buttonEpoch &&
      topMarqueeSwitchLayout && topMarqueeSwitchLayout.row === row;
    function listen(target, type, handler, options) {
      const guarded = function (...args) { if (isCurrent()) return handler.apply(this, args); };
      target.addEventListener(type, guarded, options);
      removers.push(() => target.removeEventListener(type, guarded, options));
    }
    listen(input, "change", function (event) {
      event.stopPropagation();
      setTopMarqueeBlocked(input.checked);
      syncTopMarqueeButton();
    });
    listen(row, "click", function (event) { event.stopPropagation(); });
    var frame = null;
    function scheduleLayout() {
      if (!isCurrent() || frame !== null) return;
      frame = requestAnimationFrame(function () {
        if (!isCurrent()) return;
        frame = null;
        layoutTopMarqueeButton();
      });
    }
    var resize = new ResizeObserver(scheduleLayout);
    [parent, header, mainHost.findSwitchContainer(seat), mainHost.findSwitchContainer(wallpaper)]
      .forEach(function (node) { resize.observe(node); });
    var observer = new MutationObserver(scheduleLayout);
    [parent, header, document.getElementById("wallpaperContainer")].filter(Boolean).forEach(function (node) {
      observer.observe(node, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    });
    listen(window, "resize", scheduleLayout);
    listen(parent, "scroll", scheduleLayout, true);
    listen(window, "xc-top-marquee-change", syncTopMarqueeButton);
    topMarqueeSwitchLayout = {
      row: row, parent: parent, seat: seat, header: header, wallpaper: wallpaper,
      cleanup: function () {
        resize.disconnect();
        observer.disconnect();
        if (frame !== null) cancelAnimationFrame(frame);
        removers.splice(0).forEach(remove => remove());
        row.remove();
      },
    };
    syncTopMarqueeButton();
    layoutTopMarqueeButton();
    return true;
  }

  function start() {
    if (!active) { active = true; generation++; }
    return true;
  }
  function attachMainPanel(host) {
    if (mainHost !== host) cleanupTopMarqueeButton();
    mainHost = host;
    return installTopMarqueeButton();
  }
  function dispose() {
    active = false;
    generation++;
    cleanupTopMarqueeBlocker();
    cleanupTopMarqueeButton();
  }
  return Object.freeze({
    start, dispose, attachMainPanel,
    install: () => installTopMarqueeBlocker(),
    requestMainPanel: () => installTopMarqueeButton(),
    detachMainPanel: cleanupTopMarqueeButton,
    setBlocked: setTopMarqueeBlocked,
    isBlocked: () => topMarqueeState.enabled,
  });
};
