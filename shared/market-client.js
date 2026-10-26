(function (global) {
  'use strict';
  const origin = 'http://127.0.0.1:4173';
  const channel = 'zed-space-market';
  const busy = phase => ['downloading', 'verifying', 'importing', 'applying'].includes(phase);
  const validText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
  function createSession({ session, frameWindow, send, onState = () => {}, onClose = () => {}, onReady = () => {}, onNavigate = () => {}, videoLibrary, assetUrl, download = global.ZedSpaceMarketDownload.download }) {
    let closed = false; let connected = false; let current; let closeRequested = false;
    const operations = new Map();
    const post = (type, data = {}) => { if (!closed) send({ channel, version: 1, session, type, ...data }, origin); };
    function publish(op, patch) {
      if (closed || current !== op) return;
      op.state = { ...op.state, ...patch }; onState(op.state); post('state', op.state);
    }
    function cancel() {
      if (!current || !busy(current.state.phase) || current.state.phase === 'applying') return;
      current.abort.abort();
      publish(current, { phase: 'cancelled', message: '已取消。若视频已完成保存，副本会保留在“我的视频”。' });
    }
    function dispose() { closed = true; current?.abort.abort(); }
    function requestClose() {
      if (closed) return;
      if (current?.state.phase === 'applying') {
        closeRequested = true;
        publish(current, { message: '正在应用，完成后返回…' });
        return;
      }
      dispose(); onClose();
    }
    async function start(data) {
      if (!validText(data.requestId) || !validText(data.assetId) || !/^[a-f0-9]{64}$/.test(data.sha256)) return;
      const known = operations.get(data.requestId);
      if (known) { if (known.state.assetId === data.assetId && known.state.sha256 === data.sha256) post('state', known.state); return; }
      if (current && busy(current.state.phase)) return;
      if (operations.size >= 100) { post('state', { requestId: data.requestId, assetId: data.assetId, sha256: data.sha256, phase: 'error', message: '请返回本地视频后重新打开画廊。' }); return; }
      const op = { abort: new AbortController(), state: { requestId: data.requestId, assetId: data.assetId, sha256: data.sha256, phase: 'downloading', received: 0 } };
      current = op; operations.set(data.requestId, op);
      const active = () => !closed && current === op && !op.abort.signal.aborted;
      publish(op, {});
      try {
        const source = { provider: 'zed-space', assetId: data.assetId, sha256: data.sha256 };
        const snapshot = await videoLibrary.list();
        if (!active()) return;
        const existing = snapshot.items.find(item => item.source?.provider === source.provider && item.source.assetId === source.assetId && item.source.sha256 === source.sha256);
        if (existing) { op.localId = existing.id; publish(op, { phase: 'ready', message: '已在“我的视频”，可以直接应用。' }); return; }
        const file = await download({ assetUrl, assetId: data.assetId, sha256: data.sha256, signal: op.abort.signal,
          onProgress: (received, total) => { if (active()) publish(op, { phase: 'downloading', received, total }); },
          onPhase: phase => { if (active()) publish(op, { phase }); },
        });
        if (!active()) return;
        publish(op, { phase: 'importing', message: '正在保存到“我的视频”…关闭后，已保存的副本仍会保留。' });
        const result = await videoLibrary.import(file, source);
        if (!active()) return;
        op.localId = result.id;
        publish(op, { phase: 'ready', message: '已添加到“我的视频”，应用后将返回 DSH。' });
      } catch (error) {
        if (!active()) return;
        publish(op, { phase: 'error', message: error?.name === 'AbortError' ? '下载超时，请重试。' : error instanceof Error && /[\u3400-\u9fff]/.test(error.message) ? error.message.slice(0, 500) : '视频添加失败，请重试；也可以返回本地视频重新打开画廊。' });
      }
    }
    async function apply(requestId) {
      const op = current;
      if (closed || !op || op.state.requestId !== requestId || op.state.phase !== 'ready' || !op.localId) return;
      publish(op, { phase: 'applying', message: '正在应用视频…' });
      try {
        await videoLibrary.apply(op.localId);
        if (closed || current !== op) return;
        publish(op, { phase: 'applied', message: '已应用视频。' }); requestClose();
      } catch {
        if (!closed && current === op) {
          publish(op, { phase: 'ready', message: '暂时无法应用，请重试；也可以返回“我的视频”选择。' });
          if (closeRequested) requestClose();
        }
      }
    }
    function receive(event) {
      if (closed || event.origin !== origin || event.source !== frameWindow()) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || Array.isArray(data) || data.channel !== channel || data.version !== 1 || data.session !== session) return;
      if (data.type === 'ready') { connected = true; post('welcome', { limits: global.ZedSpaceMarketDownload.limits }); onReady(); if (current) post('state', current.state); return; }
      if (!connected) return;
      if (data.type === 'download') void start(data);
      if (data.type === 'cancel' && data.requestId === current?.state.requestId) cancel();
      if (data.type === 'apply') void apply(data.requestId);
      if (data.type === 'close') requestClose();
      if (data.type === 'navigate' && typeof data.query === 'string' && data.query.length <= 4096) {
        const input = new URLSearchParams(data.query); const output = new URLSearchParams();
        for (const key of ['q', 'category', 'feature', 'sort', 'wallpaper']) { const value = input.get(key); if (value && value.length <= 500) output.set(key, value); }
        onNavigate(output.toString());
      }
    }
    return { receive, cancel, apply, requestClose, dispose };
  }

  function create({ assetUrl, videoLibrary, onClose = () => {} }) {
    let disposed = false; let view; let query = '';
    function close() { view?.session.requestClose(); }
    function cleanup() {
      if (!view) return;
      const old = view; view = null;
      old.session?.dispose(); clearTimeout(old.timer);
      window.removeEventListener('message', old.listener);
      old.frame.remove(); old.dialog.close(); old.dialog.remove();
      document.body.style.overflow = old.overflow;
      onClose();
    }
    function open() {
      if (disposed || view) return;
      const dialog = document.createElement('dialog'); dialog.className = 'zs-market';
      dialog.setAttribute('aria-label', 'Zed Space 视频皮肤画廊');
      dialog.innerHTML = `<style>
.zs-market{--zs-bg:#101719;--zs-surface:#1b272b;--zs-line:#35474c;--zs-text:#edf3f2;--zs-muted:#b5c8c7;--zs-accent:#b4eee1;position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:var(--zs-bg);color:var(--zs-text);font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;color-scheme:dark}
.zs-market[open]{display:flex;flex-direction:column;animation:zs-market-in 200ms cubic-bezier(.16,1,.3,1)}.zs-market::backdrop{background:#101719}.zs-market *{box-sizing:border-box}.zs-market [hidden]{display:none!important}.zs-market ::selection{background:#326b60;color:#fff}
.zs-market-header{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px;padding:12px 24px;border-bottom:1px solid var(--zs-line);background:var(--zs-surface)}.zs-market-heading{margin:0;font-size:16px;font-weight:650}.zs-market-heading span{font-weight:400;color:var(--zs-muted);margin-left:12px}
.zs-market button{min-height:44px;padding:9px 16px;border:1px solid var(--zs-line);border-radius:7px;background:#25363b;color:var(--zs-text);font:inherit;font-weight:600;cursor:pointer;transition:background 180ms}.zs-market button:hover{background:#31494f}.zs-market button:focus-visible{outline:2px solid var(--zs-accent);outline-offset:3px}.zs-market button:disabled{opacity:.5;cursor:default}.zs-market button.zs-primary{background:var(--zs-accent);border-color:var(--zs-accent);color:#15392f}.zs-market button.zs-primary:hover{background:#d4f7ee}
.zs-market-stage{position:relative;flex:1;min-height:0;display:flex}.zs-market iframe{width:100%;height:100%;border:0;display:block;background:#111}.zs-market-connection{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px;text-align:center;background:var(--zs-bg)}.zs-market-connection p{margin:0;max-width:38ch;color:var(--zs-muted)}.zs-market-connection strong{font-size:18px}.zs-market-footer{padding:12px 24px;border-top:1px solid var(--zs-line);background:var(--zs-surface);display:flex;align-items:center;gap:20px}.zs-market-status{flex:1;min-width:0}.zs-market-status p{margin:0;overflow-wrap:anywhere}.zs-market-status small{display:block;color:var(--zs-muted);font-variant-numeric:tabular-nums}.zs-market progress{display:block;width:min(420px,100%);height:4px;margin-top:8px;accent-color:var(--zs-accent)}.zs-market-actions{display:flex;gap:8px;flex-shrink:0}
@keyframes zs-market-in{from{opacity:.7;clip-path:inset(1% 0 0)}to{opacity:1;clip-path:inset(0)}}@media(prefers-reduced-motion:reduce){.zs-market[open]{animation:none}.zs-market button{transition:none}}@media(max-width:600px){.zs-market-header{padding:10px 14px;gap:10px;min-height:64px}.zs-market-heading{font-size:14px}.zs-market-heading span{display:block;font-size:12px;margin-left:0}.zs-market-header button{padding:8px 12px}.zs-market-footer{padding:12px 14px;align-items:stretch;gap:12px;flex-direction:column}.zs-market-actions{justify-content:flex-end}}
</style><header class="zs-market-header"><h1 class="zs-market-heading">Zed Space <span>/ 视频皮肤</span></h1><button type="button" data-close>返回本地视频</button></header><div class="zs-market-stage"><iframe title="官方视频皮肤画廊" sandbox="allow-scripts allow-same-origin allow-forms" referrerpolicy="no-referrer"></iframe><div class="zs-market-connection" role="status"><strong>正在打开视频画廊</strong><p>连接后即可浏览和添加视频皮肤。</p><button type="button" data-retry hidden>重新连接</button></div></div><footer class="zs-market-footer" hidden><div class="zs-market-status"><p role="status" aria-live="polite"></p><small></small><progress hidden aria-label="视频下载进度"></progress></div><div class="zs-market-actions"><button type="button" data-cancel>取消下载</button><button type="button" class="zs-primary" data-apply hidden>应用视频并返回</button></div></footer>`;
      const frame = dialog.querySelector('iframe'); const connection = dialog.querySelector('.zs-market-connection');
      const footer = dialog.querySelector('footer'); const status = footer.querySelector('p'); const detail = footer.querySelector('small'); const progress = footer.querySelector('progress');
      const cancel = dialog.querySelector('[data-cancel]'); const apply = dialog.querySelector('[data-apply]'); const retry = dialog.querySelector('[data-retry]');
      const current = { dialog, frame, overflow: document.body.style.overflow, state: null }; view = current;
      function render(state) {
        current.state = state; footer.hidden = state.phase === 'cancelled';
        const labels = { downloading: '正在下载视频', verifying: '正在校验视频', importing: '正在保存视频', ready: '视频已准备好', applying: '正在应用视频', applied: '视频已应用', error: '暂时无法添加视频' };
        status.textContent = state.message || labels[state.phase] || '';
        detail.textContent = state.phase === 'downloading' && state.total ? `${((state.received || 0) / 1048576).toFixed(1)} / ${(state.total / 1048576).toFixed(1)} MiB` : '';
        progress.hidden = state.phase !== 'downloading' || !state.total; progress.max = state.total || 1; progress.value = state.received || 0;
        cancel.hidden = !['downloading', 'verifying', 'importing'].includes(state.phase); cancel.textContent = state.phase === 'importing' ? '停止等待' : '取消下载';
        apply.hidden = state.phase !== 'ready';
      }
      dialog.querySelector('[data-close]').onclick = event => { event.preventDefault(); event.stopPropagation(); close(); };
      dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); close(); });
      cancel.onclick = () => current.session.cancel(); apply.onclick = () => current.session.apply(current.state?.requestId);
      retry.onclick = () => { close(); open(); };
      const parentOrigin = location.origin === 'null' && location.protocol === 'dsh-app:' && location.hostname === 'app' ? 'dsh-app://app' : location.origin;
      const originAllowed = parentOrigin === 'dsh-app://app' || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):[1-9]\d{0,4}$/.test(parentOrigin);
      const id = crypto.randomUUID();
      current.session = createSession({ session: id, frameWindow: () => frame.contentWindow, assetUrl, videoLibrary, onState: render, onClose: cleanup,
        send: (data, target) => frame.contentWindow?.postMessage(data, target),
        onNavigate: value => { query = value; },
        onReady: () => { clearTimeout(current.timer); connection.hidden = true; frame.removeAttribute('aria-hidden'); frame.inert = false; },
      });
      current.listener = event => current.session.receive(event); window.addEventListener('message', current.listener);
      document.body.append(dialog); document.body.style.overflow = 'hidden'; dialog.showModal();
      dialog.querySelector('[data-close]').focus();
      frame.setAttribute('aria-hidden', 'true'); frame.inert = true;
      if (!originAllowed) {
        connection.querySelector('strong').textContent = '此页面无法连接视频画廊';
        connection.querySelector('p').textContent = '请从本地 DSH 窗口打开视频皮肤。';
        return;
      }
      const url = new URL('/wallpapers', origin); url.search = query;
      url.searchParams.set('embed', 'dsh'); url.searchParams.set('parentOrigin', parentOrigin); url.searchParams.set('session', id);
      current.timer = setTimeout(() => {
        if (view !== current) return;
        connection.querySelector('strong').textContent = '暂时无法连接视频画廊';
        connection.querySelector('p').textContent = '请确认本地视频市场已启动，然后重新连接。'; retry.hidden = false;
      }, 8000);
      frame.src = url.href;
    }
    return { open, close, dispose() { disposed = true; cleanup(); } };
  }
  global.ZedSpaceMarket = Object.freeze({ create, createSession });
})(globalThis);
