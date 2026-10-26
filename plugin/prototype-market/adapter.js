// 仅注入本机市场预览；捕获阶段阻止真实下载处理器。
(() => {
  let catalog;
  fetch("/api/market/catalog")
    .then((r) => r.json())
    .then((c) => (catalog = c))
    .catch(() => {});
  const send = (data) =>
    parent.postMessage({ type: "market-prototype", ...data }, location.origin);
  addEventListener(
    "click",
    (event) => {
      const download = event.target.closest(
        '.market-download .market-primary,a[download],a[href^="blob:"]',
      );
      if (!download) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = new URLSearchParams(location.search).get("wallpaper");
      const item = catalog?.wallpapers.find((w) => w.asset_id === id);
      const sha =
        document.querySelector("#market-variant")?.value ||
        item?.files.find((f) => f.role === "video")?.sha256;
      if (item && sha) send({ action: "download", id, sha });
    },
    true,
  );
  addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        send({ action: "close" });
        return;
      }
      if (
        event.target.closest(
          'input,textarea,select,video,[contenteditable],[role="slider"]',
        )
      )
        return;
      if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        send({
          action: "variant",
          direction: event.key === "ArrowRight" ? 1 : -1,
        });
      }
    },
    true,
  );
  const update = () => {
    document
      .querySelectorAll(".market-download .market-primary")
      .forEach((el) => {
        if (el.textContent !== "模拟下载") el.textContent = "模拟下载";
      });
    document.querySelectorAll(".market-download p").forEach((el) => {
      if (el.textContent !== "仅演示进度，不保存文件。")
        el.textContent = "仅演示进度，不保存文件。";
    });
  };
  addEventListener("DOMContentLoaded", () => {
    update();
    new MutationObserver(update).observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
})();
