(function (global) {
  'use strict';
  const limits = Object.freeze({ maxBytes: 33554432, maxDurationMs: 30000, maxWidth: 1920, maxHeight: 1080 });
  const fail = (message) => { throw new Error(message); };
  const positive = value => Number.isSafeInteger(value) && value > 0;
  async function download({ assetUrl, assetId, sha256, signal, onProgress = () => {}, onPhase = () => {} }) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const timer = setTimeout(cancel, 180000);
    let reader;
    try {
      const options = { signal: controller.signal, redirect: 'error', credentials: 'same-origin', cache: 'no-store' };
      const response = await fetch(assetUrl('market/catalog'), options);
      if (!response.ok || !response.body) fail('视频目录暂时不可用，请稍后重试。');
      reader = response.body.getReader();
      const catalogChunks = []; let catalogBytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        catalogBytes += value.length;
        if (catalogBytes > 8388608) fail('视频目录响应异常，请稍后重试。');
        catalogChunks.push(value);
      }
      reader.releaseLock(); reader = null;
      const catalog = JSON.parse(await new Blob(catalogChunks).text());
      const matches = Array.isArray(catalog?.wallpapers) ? catalog.wallpapers.filter(row => row?.assetId === assetId) : [];
      const files = matches.length === 1 && Array.isArray(matches[0].files) ? matches[0].files.filter(file => file?.sha256 === sha256) : [];
      if (files.length !== 1 || !/^[a-f0-9]{64}$/.test(sha256)) fail('这个视频已更新，请刷新画廊后重试。');
      const file = files[0]; const media = file.media;
      if (!positive(file.bytes) || !media || ![media.width, media.height, media.durationMs].every(positive)) fail('视频规格不完整，暂时无法添加。');
      if (!['video/mp4', 'video/webm'].includes(file.mime) || file.bytes > limits.maxBytes || media.durationMs > limits.maxDurationMs
        || Math.max(media.width, media.height) > limits.maxWidth || Math.min(media.width, media.height) > limits.maxHeight) fail('此规格仅供预览。请选择 32 MiB、30 秒、1920 × 1080 以内的 MP4 或 WebM 视频。');
      controller.signal.throwIfAborted();
      onProgress(0, file.bytes);
      const mediaResponse = await fetch(assetUrl('market/media') + '?asset=' + encodeURIComponent(assetId) + '&file=' + sha256, options);
      if (!mediaResponse.ok || !mediaResponse.body) fail('视频下载失败，请稍后重试。');
      const length = mediaResponse.headers.get('content-length');
      if ((length !== null && length !== String(file.bytes)) || mediaResponse.headers.get('content-type')?.split(';')[0].trim() !== file.mime) {
        await mediaResponse.body.cancel(); fail('视频响应与目录不一致，请重新下载。');
      }
      reader = mediaResponse.body.getReader();
      const chunks = []; let received = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        received += value.length;
        if (received > file.bytes || received > limits.maxBytes) fail('视频大小超出声明，已停止下载。');
        chunks.push(value); onProgress(received, file.bytes);
      }
      if (received !== file.bytes) fail('视频下载不完整，请重新下载。');
      reader.releaseLock(); reader = null;
      controller.signal.throwIfAborted(); onPhase('verifying');
      const blob = new Blob(chunks, { type: file.mime });
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      controller.signal.throwIfAborted();
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== sha256) fail('视频校验未通过，请重新下载。');
      const title = typeof matches[0].title === 'string' ? matches[0].title.replace(/[\\/\u0000-\u001f]/g, '').trim().slice(0, 100) : '';
      return new File([blob], (title || '视频皮肤') + (file.mime === 'video/webm' ? '.webm' : '.mp4'), { type: file.mime });
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      controller.abort();
    }
  }
  global.ZedSpaceMarketDownload = Object.freeze({ limits, download });
})(globalThis);
