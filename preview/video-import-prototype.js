// 临时原型：比较三种入口；多视频、缩略图与显示名称仅在内存中演示，不写用户存储。
const names = { A: '独立模式', B: '视频列表 · 已选', C: '展开式导入区' };
let variant = new URL(location.href).searchParams.get('variant') || 'B';
if (!names[variant]) variant = 'B';
let mode = 'video';
let status = 'empty';
let clips = [];
let selectedId = null;
let failure = '';
const controller = BackspaceSkinCore.createController({
  assetUrl: () => '/preview/prototype-surface.html',
  storage: { get: async defaults => defaults, set: async () => {} },
});
await controller.start();
document.querySelector('#__dsh-backspace-btn__').click();
const panel = document.querySelector('#__dsh-backspace-panel__');
panel.addEventListener('click', event => event.stopPropagation());
const tabs = panel.querySelector('.bs-tabs');
const region = panel.querySelector('.bs-skin-region');
const video = document.createElement('section');video.className = 'proto-video';region.after(video);
const modes = document.createElement('div');modes.className = 'proto-modes';tabs.before(modes);
const disclosure = document.createElement('button');disclosure.className = 'proto-disclosure';disclosure.textContent = '使用自己的视频';
disclosure.onclick = () => { mode = mode === 'video' ? 'builtin' : 'video'; render(); };tabs.after(disclosure);
const fourth = document.createElement('button');fourth.className = 'bs-tab';fourth.textContent = '本地视频';fourth.type = 'button';
fourth.onclick = () => { mode = 'video'; render(); };tabs.append(fourth);
for (const tab of tabs.querySelectorAll('[data-skin]')) tab.addEventListener('click', () => { mode = 'builtin'; render(); });
const details = document.querySelector('.details');
details.innerHTML = '<h2>视频列表 · 界面原型</h2><p>可多选本地视频、勾选启用、重命名或移除。视频和名称仅存于本页内存，刷新清空。</p><p id="rationale"></p><pre id="state"></pre>';
const bar = document.createElement('nav');bar.className = 'proto-switcher';bar.setAttribute('aria-label','原型方案切换');
bar.innerHTML = '<button aria-label="上一方案">←</button><strong></strong><button aria-label="下一方案">→</button><button class="proto-simulate">模拟错误</button><button class="theme-label">深浅色</button>';
document.body.append(bar);bar.addEventListener('click', event => event.stopPropagation());
const swap = offset => { variant = Object.keys(names)[(Object.keys(names).indexOf(variant)+offset+3)%3];const url = new URL(location.href);url.searchParams.set('variant',variant);history.replaceState(null,'',url);render(); };
bar.querySelectorAll('button')[0].onclick = () => swap(-1);bar.querySelectorAll('button')[1].onclick = () => swap(1);
bar.querySelector('.theme-label').onclick = () => document.body.toggleAttribute('data-ds-dark-theme');
bar.querySelector('.proto-simulate').onclick = () => { failure = failure ? '' : '「旅行片段.mp4」超过 32 MB，请压缩后再导入。已有视频已保留。';render(); };
addEventListener('keydown',event=>{if(event.defaultPrevented||event.target.closest('input,textarea,select,[contenteditable]'))return;if(event.key==='ArrowLeft')swap(-1);if(event.key==='ArrowRight')swap(1);});
const icon = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.4"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor"/></svg>';
const pencil = '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m3 13 9-9 4 4-9 9H3v-4Z" stroke="currentColor" stroke-width="1.4"/><path d="m10.5 5.5 4 4" stroke="currentColor" stroke-width="1.4"/></svg>';
const fileInput = document.createElement('input');fileInput.type='file';fileInput.accept='.mp4,.webm';fileInput.multiple=true;fileInput.hidden=true;fileInput.id='prototype-video-files';document.body.append(fileInput);
fileInput.addEventListener('click', event => event.stopPropagation());
function thumb(file) {
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);const probe=document.createElement('video');probe.muted=true;probe.preload='auto';
    const timer=setTimeout(()=>finish(new Error('无法读取，请换一个 MP4 / WebM 视频。')),3000);
    const finish=error=>{clearTimeout(timer);probe.onloadeddata=probe.onerror=null;probe.removeAttribute('src');probe.load();if(error){URL.revokeObjectURL(url);reject(error);}};
    probe.onerror=()=>finish(new Error('无法读取，请换一个 MP4 / WebM 视频。'));
    probe.onloadeddata=()=>{
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
      const scale=Math.max(320/probe.videoWidth,180/probe.videoHeight);
      canvas.getContext('2d').drawImage(probe,(320-probe.videoWidth*scale)/2,(180-probe.videoHeight*scale)/2,probe.videoWidth*scale,probe.videoHeight*scale);
      const result={id:crypto.randomUUID(),name:file.name.replace(/\.[^.]+$/,''),original:file.name,url,thumbnail:canvas.toDataURL('image/jpeg',.8),size:file.size,duration:probe.duration,width:probe.videoWidth,height:probe.videoHeight};
      finish();resolve(result);
    };probe.src=url;
  });
}
fileInput.onchange=async()=>{
  const files=[...fileInput.files];if(!files.length)return;
  status='loading';failure='';render();
  for(const file of files){
    try{if(file.size>32*1024*1024)throw new Error('超过 32 MB，请压缩后再导入。');clips.push(await thumb(file));}
    catch(error){failure=`「${file.name}」${error.message}`;}
    render();
  }
  status=clips.length?'ready':'empty';fileInput.value='';render();
};
const duration = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
function syncPreview() {
  const surface=document.getElementById('__dsh-backspace__');
  const doc=surface?.contentDocument;if(!doc?.body)return;
  const selected=mode==='video'&&clips.find(item=>item.id===selectedId);
  let player=doc.querySelector('video');
  if(!selected){player?.remove();return;}
  if(player?.dataset.id===selected.id)return;
  player?.remove();player=doc.createElement('video');player.dataset.id=selected.id;player.src=selected.url;player.muted=true;player.loop=true;player.playsInline=true;
  player.style.cssText='position:fixed;inset:0;width:100%;height:100%;object-fit:cover';doc.body.append(player);void player.play().catch(()=>{});
}
function rename(clip, container) {
  const editor=document.createElement('input');editor.className='proto-rename-input';editor.value=clip.name;editor.maxLength=80;editor.setAttribute('aria-label',`重命名 ${clip.name}`);
  container.replaceChildren(editor);editor.focus();editor.select();let finished=false;
  const save=cancel=>{if(finished)return;finished=true;if(!cancel&&editor.value.trim())clip.name=editor.value.trim();render();};
  editor.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();save(false);}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();save(true);}});
  editor.addEventListener('blur',()=>save(false));
}
function render() {
  modes.hidden=variant!=='A';disclosure.hidden=variant!=='C';fourth.hidden=variant!=='B';
  tabs.hidden=variant==='A'&&mode==='video';tabs.style.gridTemplateColumns=variant==='B'?'repeat(4,minmax(0,1fr))':'';tabs.dataset.prototypeFour=String(variant==='B');
  fourth.setAttribute('aria-selected',String(mode==='video'));
  if(mode==='video')for(const tab of tabs.querySelectorAll('[data-skin]'))tab.setAttribute('aria-selected','false');
  region.hidden=mode==='video';video.hidden=mode!=='video';
  modes.innerHTML=`<button aria-pressed="${mode==='builtin'}">内置皮肤</button><button aria-pressed="${mode==='video'}">本地视频</button>`;
  modes.children[0].onclick=()=>{mode='builtin';render();};modes.children[1].onclick=()=>{mode='video';render();};
  video.innerHTML='<div class="proto-library-head"><h3>我的视频 <span class="proto-count"></span></h3><button class="proto-action">导入视频</button></div><p class="proto-library-help">可多选导入，每次勾选启用一个。</p><div class="proto-grid"></div><p class="proto-import-state" role="status"></p><p class="proto-error" role="alert" hidden></p>';
  video.querySelector('.proto-count').textContent=clips.length?String(clips.length):'';
  const grid=video.querySelector('.proto-grid');
  if(!clips.length){grid.className='proto-upload';grid.innerHTML=`${icon}<h3>${status==='loading'?'正在生成缩略图…':'把喜欢的片刻，留作背景'}</h3><p>MP4 / WebM · 每个最长 30 秒<br>最高 1080p · 每个最大 32 MB</p>`;}
  for(const clip of clips){
    const tile=document.createElement('article');tile.className='proto-tile';tile.dataset.selected=String(clip.id===selectedId);
    tile.innerHTML='<label class="proto-thumb"><img alt=""><input type="checkbox"><span class="proto-playing">启用中</span><span class="proto-duration"></span></label><div class="proto-caption"><strong></strong><button type="button" class="proto-rename"></button></div><div class="proto-item-meta"><span></span><button type="button" class="proto-remove">移除</button></div>';
    tile.querySelector('img').src=clip.thumbnail;
    const check=tile.querySelector('input');check.checked=clip.id===selectedId;check.setAttribute('aria-label',`启用 ${clip.name}`);
    check.onchange=()=>{selectedId=check.checked?clip.id:null;render();};
    tile.querySelector('.proto-playing').hidden=!check.checked;
    tile.querySelector('.proto-duration').textContent=duration(clip.duration);
    const caption=tile.querySelector('.proto-caption');caption.querySelector('strong').textContent=clip.name;caption.querySelector('strong').title=`原文件：${clip.original}`;
    const edit=tile.querySelector('.proto-rename');edit.innerHTML=pencil;edit.setAttribute('aria-label',`重命名 ${clip.name}`);edit.title='重命名';edit.onclick=()=>rename(clip,caption);
    tile.querySelector('.proto-item-meta span').textContent=`${(clip.size/1024/1024).toFixed(1)} MB`;
    const remove=tile.querySelector('.proto-remove');remove.setAttribute('aria-label',`移除 ${clip.name}`);remove.onclick=()=>{if(selectedId===clip.id)selectedId=null;URL.revokeObjectURL(clip.url);clips=clips.filter(item=>item.id!==clip.id);status=clips.length?'ready':'empty';render();};
    grid.append(tile);
  }
  const selected=clips.find(item=>item.id===selectedId);
  video.querySelector('.proto-import-state').textContent=status==='loading'?'正在读取视频并生成缩略图…':selected?`正在使用：${selected.name}`:clips.length?'尚未启用，勾选缩略图即可预览。':'视频仅在本机保存，不上传。';
  if(failure){const error=video.querySelector('.proto-error');error.hidden=false;error.textContent=failure;}
  video.querySelector('.proto-action').disabled=status==='loading';video.querySelector('.proto-action').onclick=()=>fileInput.click();
  bar.querySelector('strong').textContent=`${variant} · ${names[variant]}`;
  document.querySelector('#rationale').textContent='已选择 B：三个内置皮肤之后增加本地视频。缩略图用于勾选，名称旁的编辑按钮可重命名；移除当前视频后回退背景。';
  document.querySelector('#state').textContent=JSON.stringify({prototype:true,variant,mode,status,selectedId,clips:clips.map(({id,name,original})=>({id,name,original})),persisted:false},null,2);
  syncPreview();
}
render();
