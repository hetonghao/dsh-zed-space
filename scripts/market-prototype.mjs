// 可丢弃开发预览：固定本机来源，只读代理，不提供生产入口。
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
const root = fileURLToPath(new URL("../", import.meta.url));
if (process.env.NODE_ENV === "production")
  throw new Error("交互原型禁止在生产环境运行");
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
};
const assets = new Map(
  [
    "app.js",
    "style.css",
    "adapter.js",
    "adapter.css",
    "empty-video.html",
    "empty-surface.html",
  ].map((name) => ["/prototype/" + name, "plugin/prototype-market/" + name]),
);
assets.set("/plugin/client.js", "plugin/client.js");
assets.set(
  "/prototype/gsap.min.js",
  "../zed-space/apps/website/node_modules/gsap/dist/gsap.min.js",
);
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4174");
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405).end();
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    if (url.pathname === "/") {
      let html = await readFile(
        root + "tests/fixtures/desktop/index.html",
        "utf8",
      );
      html = html.replace(
        "</head>",
        '<link rel="stylesheet" href="/prototype/style.css"><script src="/prototype/gsap.min.js" defer></script><script src="/prototype/app.js" defer></script></head>',
      );
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
      return;
    }
    if (url.pathname === "/dsh-zed-space/skin.html")
      url.pathname = "/prototype/empty-surface.html";
    if (url.pathname === "/dsh-zed-space/video.html")
      url.pathname = "/prototype/empty-video.html";
    if (assets.has(url.pathname)) {
      res.setHeader(
        "Content-Type",
        (types[url.pathname.slice(url.pathname.lastIndexOf("."))] ||
          "text/plain") + "; charset=utf-8",
      );
      res.end(await readFile(root + assets.get(url.pathname)));
      return;
    }
    if (
      url.pathname === "/wallpapers" ||
      url.pathname.startsWith("/_next/") ||
      url.pathname.startsWith("/api/market/")
    ) {
      const headers = req.headers.range ? { Range: req.headers.range } : {};
      const controller = new AbortController();
      const headerTimeout = setTimeout(() => controller.abort(), 20000);
      res.once("close", () => controller.abort());
      const response = await fetch(
        "http://127.0.0.1:4173" + url.pathname + url.search,
        {
          method: req.method,
          headers,
          redirect: "error",
          signal: controller.signal,
        },
      ).finally(() => clearTimeout(headerTimeout));
      res.statusCode = response.status;
      for (const name of ["content-type", "content-range", "accept-ranges"])
        if (response.headers.has(name))
          res.setHeader(name, response.headers.get(name));
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      if (
        url.pathname === "/wallpapers" &&
        response.headers.get("content-type")?.includes("text/html")
      ) {
        const html = await response.text();
        res.end(
          html.replace(
            "<head>",
            '<head><script src="/prototype/adapter.js"></script><link rel="stylesheet" href="/prototype/adapter.css">',
          ),
        );
        return;
      }
      if (
        url.pathname === "/api/market/media" &&
        response.headers.has("content-length")
      )
        res.setHeader("Content-Length", response.headers.get("content-length"));
      if (response.body) {
        const stream = Readable.fromWeb(response.body);
        stream.on("error", () => res.destroy());
        stream.pipe(res);
      } else res.end();
      return;
    }
    res.writeHead(404).end("原型未开放此路径");
  } catch {
    if (res.destroyed || res.headersSent) {
      res.destroy();
      return;
    }
    res
      .writeHead(503, { "Content-Type": "text/html; charset=utf-8" })
      .end(
        '<html lang="zh"><body style="background:#171d20;color:#eaf3f2;font:16px system-ui;padding:32px"><h1>市场暂时无法连接</h1><p>请确认本机 4173 市场服务正在运行。</p><button onclick="location.reload()">重新加载市场</button></body></html>',
      );
  }
});
server.listen(4174, "127.0.0.1", () =>
  console.log(`原型预览 http://127.0.0.1:4174/?variant=A · PID ${process.pid}`),
);
