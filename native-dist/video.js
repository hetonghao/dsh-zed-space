import { inspectVideo, mediaReady } from './video-media.js';

const query = new URLSearchParams(location.search);
const parentOrigin = query.get('parentOrigin');
const token = query.get('token');
let owner;
let database;
let activeId = null;
let hostPaused = true;
let player;
let objectUrl;
let playbackGeneration = 0;
let queue = Promise.resolve();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const shouldPause = () => hostPaused || document.hidden || reducedMotion.matches;
const send = data => parent.postMessage({ type: 'bs-video', token, ...data }, parentOrigin);

function openDatabase() {
  if (database) return Promise.resolve(database);
  return new Promise((resolve, reject) => {
    let expired = false;
    const request = indexedDB.open('backspace-videos', 1);
    const timer = setTimeout(() => { expired = true; reject(new Error('storage')); }, 3000);
    request.onupgradeneeded = () => {
      const clips = request.result.createObjectStore('clips', { keyPath: ['owner', 'id'] });
      clips.createIndex('owner', 'owner');
      request.result.createObjectStore('selection');
    };
    request.onerror = () => { clearTimeout(timer); reject(new Error('storage')); };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (expired) { request.result.close(); return; }
      database = request.result;
      database.onversionchange = () => { database.close(); database = null; };
      resolve(database);
    };
  });
}

async function transaction(mode, work) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['clips', 'selection'], mode);
    let result;
    tx.oncomplete = () => resolve(typeof result === 'function' ? result() : result);
    tx.onabort = tx.onerror = () => reject(new Error('storage'));
    try { result = work(tx.objectStore('clips'), tx.objectStore('selection')); }
    catch { tx.abort(); }
  });
}

const readClip = id => transaction('readonly', clips => { const request = clips.get([owner, id]); return () => request.result; });
const saveSelection = id => transaction('readwrite', (_clips, selection) => { id ? selection.put(id, owner) : selection.delete(owner); });
async function snapshot() {
  const items = await transaction('readonly', clips => {
    const request = clips.index('owner').getAll(owner);
    return () => request.result.map(({ blob, owner: _owner, ...metadata }) => metadata).sort((a, b) => a.createdAt - b.createdAt);
  });
  return { items, activeId };
}
function stopPlayer() {
  playbackGeneration++;
  if (player) { player.onerror = null; player.pause(); player.removeAttribute('src'); player.load(); player.remove(); player = null; }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
}
async function showClip(clip) {
  if (!clip?.blob || !(clip.blob instanceof Blob)) throw new Error('missing');
  stopPlayer();
  player = document.createElement('video');
  player.muted = true; player.loop = true; player.playsInline = true; player.preload = 'auto';
  objectUrl = URL.createObjectURL(clip.blob);
  const loaded = mediaReady(player, 'loadeddata');
  player.src = objectUrl;
  document.body.append(player);
  await loaded;
  const current = player;
  const generation = ++playbackGeneration;
  if (!shouldPause()) {
    try { await current.play(); }
    catch {
      if (current === player && generation === playbackGeneration && !shouldPause()) throw new Error('playback');
    }
  }
  current.onerror = () => playbackFailure('decode', current, playbackGeneration);
}
function playbackFailure(code, failedPlayer, generation) {
  // 与选择/移除串行，旧播放器或旧播放尝试的取消不能清除新选择。
  queue = queue.then(async () => {
    if (failedPlayer !== player || generation !== playbackGeneration) return;
    activeId = null; stopPlayer();
    try { await saveSelection(null); } catch { /* 保留可见错误，宿主页仍回退海面。 */ }
    send({ event: 'failure', code });
  });
}
async function handle(data) {
  switch (data.action) {
    case 'list': {
      const saved = await transaction('readonly', (_clips, selection) => { const request = selection.get(owner); return () => request.result; });
      activeId = saved || null;
      if (activeId) await showClip(await readClip(activeId));
      break;
    }
    case 'import': {
      const media = await inspectVideo(data.file);
      const original = typeof data.name === 'string' ? data.name.slice(0, 255) : 'video';
      const name = original.replace(/\.[^.]+$/, '').trim().slice(0, 80) || 'Video';
      await transaction('readwrite', clips => { clips.put({ ...media, owner, id: crypto.randomUUID(), name, original, createdAt: Date.now() }); });
      break;
    }
    case 'select': {
      if (data.id === null) { activeId = null; stopPlayer(); }
      else { await showClip(await readClip(data.id)); activeId = data.id; }
      await saveSelection(activeId);
      break;
    }
    case 'rename': {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name || name.length > 80) throw new Error('name');
      const clip = await readClip(data.id);
      if (!clip) throw new Error('missing');
      await transaction('readwrite', clips => { clips.put({ ...clip, name }); });
      break;
    }
    case 'remove': {
      await transaction('readwrite', (clips, selection) => {
        clips.delete([owner, data.id]);
        if (activeId === data.id) selection.delete(owner);
      });
      if (activeId === data.id) { activeId = null; stopPlayer(); }
      break;
    }
    default: throw new Error('request');
  }
  return snapshot();
}

addEventListener('message', event => {
  const data = event.data;
  if (event.source !== parent || event.origin !== parentOrigin || !data || data.type !== 'bs-video' || data.token !== token) return;
  if (data.action === 'visibility' && typeof data.paused === 'boolean') {
    hostPaused = data.paused; updatePlayback(); return;
  }
  if (!Number.isSafeInteger(data.requestId) || data.requestId <= 0 || typeof data.paused !== 'boolean') return;
  hostPaused = data.paused;
  // 素材按浏览器认证的父页 origin 隔离，不能用 URL 参数冒充另一宿主的素材库。
  owner = event.origin;
  queue = queue.then(async () => {
    try { send({ requestId: data.requestId, ok: true, ...await handle(data) }); }
    catch (error) {
      if (['select', 'list'].includes(data.action) || error.message === 'storage') {
        activeId = null; stopPlayer();
        try { await saveSelection(null); } catch { /* 原错误通过响应反馈。 */ }
      }
      const library = await snapshot().catch(() => ({ items: [], activeId: null }));
      send({ requestId: data.requestId, ok: false, code: error.message, ...library });
    }
  });
});
const updatePlayback = () => {
  if (!player) return;
  const current = player;
  const generation = ++playbackGeneration;
  if (shouldPause()) current.pause();
  else void current.play().catch(() => playbackFailure('playback', current, generation));
};
document.addEventListener('visibilitychange', updatePlayback);
reducedMotion.addEventListener('change', updatePlayback);
addEventListener('pagehide', () => { stopPlayer(); database?.close(); });
if (parent !== window && (/^https?:\/\//.test(parentOrigin || '') || parentOrigin === 'dsh-app://app') && /^[a-f\d-]{36}$/i.test(token || '')) send({ event: 'ready' });
