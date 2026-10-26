// 三种插件内市场构图；只在隔离预览 origin 中模拟下载和应用。
(() => {
  const memory = new Map([
    ["bsSkin", "video"],
    ["bsChatOpacity", "55"],
    ["bsGlass", "45"],
  ]);
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: (k) => memory.delete(k),
      clear: () => memory.clear(),
      get length() {
        return memory.size;
      },
      key: (i) => [...memory.keys()][i] ?? null,
    },
  });
  window.__ModuleLoader__ = {
    load: ({ factory }) => factory(() => {}).apply({ effect: () => {} }),
  };
  const $ = (s) => document.querySelector(s);
  document.title = "Zed Space Skin · 市场交互原型";
  $(".history").innerHTML =
    "<strong>新会话</strong><span>我的创作空间</span><span>视频背景探索</span>";
  $(".settings button").textContent = "设置";
  $(".welcome h1").textContent = "探索未至之境";
  $(".badge").textContent = "HARNESS";
  const names = { A: "扩展工作台", B: "专注画廊", C: "边选边看" };
  let variant = new URLSearchParams(location.search).get("variant");
  if (!names[variant]) variant = "A";
  let catalog,
    frame,
    selected,
    timer,
    progress = 0,
    status = "未选择",
    marketURL = "/wallpapers",
    applied = null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  document.body.insertAdjacentHTML(
    "beforeend",
    `<video id="prototype-background" muted loop playsinline></video><div id="prototype-label">交互原型 · 隔离 DSH 预览 · 下载与应用均为模拟</div><section id="market-workbench" aria-label="官方视频皮肤市场" hidden><header><div><h1>官方视频皮肤</h1><p id="layout-hint"></p></div><button id="market-close">返回本地视频</button></header><div id="market-frame-slot"></div></section><section id="simulation" aria-label="模拟状态"><div><strong id="simulation-title">挑选一段喜欢的风景</strong><p id="simulation-state" role="status"></p><progress id="simulation-progress" aria-label="模拟下载进度" max="100" value="0" hidden></progress></div><div class="simulation-actions"><button id="simulate-cancel" hidden>取消模拟</button><button id="simulate-retry" hidden>重新模拟下载</button><button id="simulate-apply" hidden>模拟应用</button><button id="restore" hidden>恢复原背景</button></div></section><nav id="prototype-switcher" aria-label="原型方案切换"><button id="previous" aria-label="上一方案">←</button><span id="variant-label"></span><button id="next" aria-label="下一方案">→</button></nav>`,
  );
  const video = $("#prototype-background");
  function render() {
    $("#simulation-title").textContent = selected
      ? selected.item.localization["zh-Hans"].title
      : "挑选一段喜欢的风景";
    $("#simulation-state").textContent =
      `方案 ${variant} · ${status}${applied ? " · 正在预览 " + applied + "（未保存）" : ""}`;
    $("#simulation-progress").hidden = !timer;
    $("#simulation-progress").value = progress;
    $("#simulate-cancel").hidden = !timer;
    $("#simulate-retry").hidden = status !== "已取消";
    $("#simulate-apply").hidden = status !== "模拟下载完成";
    $("#restore").hidden = !applied;
  }
  function cancel() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      status = "已取消";
    }
    render();
  }
  function switchVariant(direction = 0) {
    cancel();
    variant =
      Object.keys(names)[
        (Object.keys(names).indexOf(variant) + direction + 3) % 3
      ];
    document.body.dataset.variant = variant;
    history.replaceState(null, "", "?variant=" + variant);
    $("#variant-label").textContent = variant + " · " + names[variant];
    $("#layout-hint").textContent = {
      A: "保留会话上下文，在扩展面板中浏览。",
      B: "展开整个窗口，专心寻找下一个背景。",
      C: "左侧选片，右侧查看 DSH 预览背景效果。",
    }[variant];
    render();
  }
  function closeMarket(event) {
    event?.stopPropagation();
    cancel();
    window.gsap?.killTweensOf($("#market-workbench"));
    if (frame) {
      marketURL =
        frame.contentWindow.location.pathname +
        frame.contentWindow.location.search;
      frame.remove();
      frame = null;
    }
    $("#market-workbench").hidden = true;
    document.body.classList.remove("market-open");
    const launcher = $("#__dsh-backspace-btn__");
    if (launcher?.getAttribute("aria-expanded") !== "true") launcher?.click();
    $("#discover-market")?.focus();
  }
  function openMarket() {
    if (frame) return;
    $("#market-workbench").hidden = false;
    document.body.classList.add("market-open");
    frame = document.createElement("iframe");
    frame.title = "真实官方市场：搜索、筛选与视频预览";
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms",
    );
    frame.setAttribute("allow", "autoplay");
    frame.src = marketURL;
    $("#market-frame-slot").append(frame);
    $("#market-close").focus();
    if (!reduced.matches && window.gsap)
      window.gsap.fromTo(
        $("#market-workbench"),
        { clipPath: "inset(0 0 5% 0 round 12px)" },
        {
          clipPath: "inset(0 round 12px)",
          duration: 0.3,
          ease: "expo.out",
          clearProps: "clipPath",
        },
      );
  }
  function download() {
    cancel();
    progress = 0;
    status = "模拟下载中";
    timer = setInterval(() => {
      progress += 10;
      if (progress >= 100) {
        clearInterval(timer);
        timer = null;
        status = "模拟下载完成";
      }
      render();
    }, 150);
    render();
  }
  $("#market-close").onclick = closeMarket;
  $("#previous").onclick = () => switchVariant(-1);
  $("#next").onclick = () => switchVariant(1);
  $("#simulate-cancel").onclick = cancel;
  $("#simulate-retry").onclick = download;
  $("#simulate-apply").onclick = async (event) => {
    event.stopPropagation();
    if (!selected || status !== "模拟下载完成") return;
    const poster = selected.item.files.find((f) => f.role === "poster");
    video.poster = poster?.url || "";
    video.src = selected.file.url;
    applied = selected.item.localization["zh-Hans"].title;
    status = "已模拟应用";
    document.body.classList.add("background-applied");
    if (!reduced.matches) {
      try {
        await video.play();
      } catch {
        status = "视频无法播放，可恢复后重试";
        render();
        $("#restore").focus();
        return;
      }
    }
    render();
    if (variant === "C") $("#restore").focus();
    else closeMarket();
  };
  $("#restore").onclick = () => {
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.load();
    applied = null;
    document.body.classList.remove("background-applied");
    status = "已恢复原背景";
    render();
  };
  reduced.addEventListener("change", () => {
    if (reduced.matches) video.pause();
    else if (applied) video.play().catch(() => {});
  });
  addEventListener("message", (e) => {
    if (
      !frame ||
      e.source !== frame.contentWindow ||
      e.origin !== location.origin ||
      e.data?.type !== "market-prototype"
    )
      return;
    const data = e.data;
    if (data.action === "close") {
      closeMarket();
      return;
    }
    if (data.action === "variant") {
      if (data.direction === 1 || data.direction === -1)
        switchVariant(data.direction);
      return;
    }
    if (data.action !== "download") return;
    const item = catalog?.wallpapers.find((w) => w.asset_id === data.id);
    const file = item?.files.find(
      (f) =>
        f.role === "video" &&
        f.sha256 === data.sha &&
        f.url.startsWith("/api/market/media?"),
    );
    if (!item || !file) return;
    selected = { item, file };
    download();
  });
  addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && frame) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeMarket();
        return;
      }
      if (
        e.target.closest(
          'input,textarea,select,video,[contenteditable],[role="slider"]',
        )
      )
        return;
      if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        switchVariant(e.key === "ArrowRight" ? 1 : -1);
      }
    },
    true,
  );
  fetch("/api/market/catalog")
    .then((r) => r.json())
    .then((c) => (catalog = c))
    .catch(() => {
      status = "市场不可用，请确认 4173 服务后刷新";
      render();
    });
  const plugin = document.createElement("script");
  plugin.src = "/plugin/client.js";
  document.head.append(plugin);
  const observer = new MutationObserver(() => {
    const panel = $("#__dsh-backspace-panel__"),
      group = $(".bs-video-group");
    if (!group || $("#discover-market")) return;
    const entry = document.createElement("button");
    entry.id = "discover-market";
    entry.textContent = "发现官方精美视频皮肤";
    entry.onclick = openMarket;
    group.querySelector(".bs-video-help").after(entry);
    panel.addEventListener(
      "click",
      (e) => {
        if (
          e.target.closest(
            '.bs-video-import,.bs-reset,[data-skin]:not([data-skin="video"])',
          )
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          status = "原型只演示官方视频流程";
          render();
        }
      },
      true,
    );
    $(".bs-save-hint").textContent = "原型设置仅保存在内存";
    $("#__dsh-backspace-btn__").click();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  switchVariant();
})();
