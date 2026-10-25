// 只读有界容器头；真正的尺寸、时长与可解码性仍交给浏览器验证。
export const MAX_VIDEO_BYTES = 32 * 1024 * 1024;
const fail = code => { throw new Error(code); };
const text = (bytes, start, end) => new TextDecoder().decode(bytes.subarray(start, end));

function containerType(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let budget = 10000;
  const boxes = (start, end) => {
    const out = [];
    while (start < end) {
      if (--budget < 0 || start + 8 > end) fail('format');
      let size = view.getUint32(start), header = 8;
      if (size === 1) {
        if (start + 16 > end) fail('format');
        size = Number(view.getBigUint64(start + 8)); header = 16;
      }
      if (size === 0) size = end - start;
      if (!Number.isSafeInteger(size) || size < header || start + size > end) fail('format');
      out.push({ type: text(bytes, start + 4, start + 8), start: start + header, end: start + size });
      start += size;
    }
    return out;
  };
  if (bytes.length >= 12 && text(bytes, 4, 8) === 'ftyp') {
    const top = boxes(0, bytes.length);
    if (text(bytes, 8, 12) === 'qt  ') fail('format');
    const movie = top.find(box => box.type === 'moov');
    if (!movie) fail('format');
    const codecs = [];
    for (const track of boxes(movie.start, movie.end).filter(box => box.type === 'trak')) {
      const media = boxes(track.start, track.end).find(box => box.type === 'mdia');
      if (!media) continue;
      const children = boxes(media.start, media.end);
      const handler = children.find(box => box.type === 'hdlr');
      if (!handler || handler.start + 12 > handler.end || text(bytes, handler.start + 8, handler.start + 12) !== 'vide') continue;
      let parent = children.find(box => box.type === 'minf');
      for (const type of ['stbl', 'stsd']) {
        if (!parent) fail('format');
        parent = boxes(parent.start, parent.end).find(box => box.type === type);
      }
      if (!parent || parent.start + 8 > parent.end) fail('format');
      const entries = boxes(parent.start + 8, parent.end);
      if (!entries.length || entries.length !== view.getUint32(parent.start + 4)) fail('format');
      codecs.push(...entries.map(entry => entry.type));
    }
    if (!codecs.length) fail('no-video');
    if (codecs.some(codec => !['avc1', 'avc3', 'vp09', 'av01'].includes(codec))) fail('codec');
    return 'video/mp4';
  }
  if (bytes.length < 4 || view.getUint32(0) !== 0x1a45dfa3) fail('format');
  const vint = (offset, keepMarker) => {
    let length = 1;
    while (length <= 8 && !(bytes[offset] & (0x80 >> (length - 1)))) length++;
    if (length > (keepMarker ? 4 : 8) || offset + length > bytes.length) fail('format');
    let value = keepMarker ? bytes[offset] : bytes[offset] & (0xff >> length);
    let unknown = !keepMarker && value === (0xff >> length);
    for (let i = 1; i < length; i++) { value = value * 256 + bytes[offset + i]; unknown = unknown && bytes[offset + i] === 255; }
    if (!unknown && !Number.isSafeInteger(value)) fail('format');
    return { length, value, unknown };
  };
  const elements = (start, end) => {
    const out = [];
    while (start < end) {
      if (--budget < 0) fail('format');
      const id = vint(start, true); start += id.length;
      const size = vint(start, false); start += size.length;
      const next = size.unknown ? end : start + size.value;
      if (next < start || next > end) fail('format');
      out.push({ id: id.value, start, end: next }); start = next;
    }
    return out;
  };
  const top = elements(0, bytes.length);
  const header = top[0];
  const docType = elements(header.start, header.end).find(element => element.id === 0x4282);
  if (!docType || text(bytes, docType.start, docType.end) !== 'webm') fail('format');
  const segment = top.find(element => element.id === 0x18538067);
  if (!segment) fail('format');
  const tracks = elements(segment.start, segment.end).find(element => element.id === 0x1654ae6b);
  if (!tracks) fail('no-video');
  const codecs = [];
  for (const track of elements(tracks.start, tracks.end).filter(element => element.id === 0xae)) {
    const children = elements(track.start, track.end);
    const kind = children.find(element => element.id === 0x83);
    if (!kind || kind.end !== kind.start + 1 || bytes[kind.start] !== 1) continue;
    const codec = children.find(element => element.id === 0x86);
    if (!codec) fail('codec');
    codecs.push(text(bytes, codec.start, codec.end));
  }
  if (!codecs.length) fail('no-video');
  if (codecs.some(codec => !['V_VP9', 'V_AV1'].includes(codec))) fail('codec');
  return 'video/webm';
}

export function mediaReady(video, event) {
  return new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer);
      video.removeEventListener(event, success);
      video.removeEventListener('error', failure);
      error ? reject(new Error(error)) : resolve();
    };
    const success = () => finish();
    const failure = () => finish('decode');
    const timer = setTimeout(() => finish('timeout'), 3000);
    video.addEventListener(event, success, { once: true });
    video.addEventListener('error', failure, { once: true });
  });
}

export async function inspectVideo(file) {
  if (!(file instanceof Blob) || file.size === 0) fail('empty');
  if (file.size > MAX_VIDEO_BYTES) fail('size');
  const mime = containerType(new Uint8Array(await file.arrayBuffer()));
  // 忽略由操作系统提供的 File.type，用实际容器类型加载。
  const blob = new Blob([file], { type: mime });
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true; video.preload = 'auto'; video.playsInline = true;
  try {
    const metadata = mediaReady(video, 'loadedmetadata');
    video.src = url;
    await metadata;
    const { videoWidth: width, videoHeight: height, duration } = video;
    if (!width || !height) fail('no-video');
    if (!Number.isFinite(duration) || duration <= 0 || duration > 30) fail('duration');
    if (Math.max(width, height) > 1920 || Math.min(width, height) > 1080) fail('resolution');
    if (video.readyState < 2) await mediaReady(video, 'loadeddata');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const scale = Math.max(320 / width, 180 / height);
    canvas.getContext('2d').drawImage(video, (320 - width * scale) / 2, (180 - height * scale) / 2, width * scale, height * scale);
    return { blob, size: file.size, width, height, duration, thumbnail: canvas.toDataURL('image/jpeg', .75) };
  } finally {
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}
