// 临时原型：在现有 Harness 测试外壳与真实设置面板上比较三种视频入口；仅内存状态。
const names = { A: '独立模式 · 推荐', B: '第四个皮肤入口', C: '展开式导入区' };
let variant = new URL(location.href).searchParams.get('variant') || 'A';
if (!names[variant]) variant = 'A';
let imported = false;
let mode = 'video';
let status = 'empty';
let filename = '我的风景.mp4';
const controller = BackspaceSkinCore.createController({
  assetUrl: () => '/preview/prototype-surface.html',
  storage: { get: async defaults => defaults, set: async () => {} },
});
await controller.start();
document.querySelector('#__dsh-backspace-btn__').click();
const panel = document.querySelector('#__dsh-backspace-panel__');
const tabs = panel.querySelector('.bs-tabs');
const region = panel.querySelector('.bs-skin-region');
const video = document.createElement('section');
video.className = 'proto-video';
region.after(video);
const modes = document.createElement('div');
modes.className = 'proto-modes';
tabs.before(modes);
const disclosure = document.createElement('button');
disclosure.className = 'proto-disclosure';
disclosure.textContent = '使用自己的视频';
disclosure.onclick = () => { mode = mode === 'video' ? 'builtin' : 'video'; render(); };
tabs.after(disclosure);
const fourth = document.createElement('button');
fourth.className = 'bs-tab';fourth.textContent = '本地视频';fourth.type = 'button';
fourth.onclick = () => { mode = 'video'; render(); };
tabs.append(fourth);
for (const tab of tabs.querySelectorAll('[data-skin]')) tab.addEventListener('click', () => { mode = 'builtin'; render(); });
const details = document.querySelector('.details');
details.innerHTML = '<h2>视频导入 · 界面原型</h2><p>比较入口结构与操作步骤。这里不读取或保存视频；文件名只用于展示。</p><p id="rationale"></p><pre id="state"></pre>';
const bar = document.createElement('nav');bar.className = 'proto-switcher';bar.setAttribute('aria-label','原型方案切换');
bar.innerHTML = '<button aria-label="上一方案">←</button><strong></strong><button aria-label="下一方案">→</button><label>状态 <select><option value="empty">未导入</option><option value="loading">检查中</option><option value="ready">已导入</option><option value="error">格式错误</option></select></label><button class="theme-label">深浅色</button>';
document.body.append(bar);
bar.addEventListener('click', event => event.stopPropagation());
const swap = offset => { variant = Object.keys(names)[(Object.keys(names).indexOf(variant)+offset+3)%3];const url = new URL(location.href);url.searchParams.set('variant',variant);history.replaceState(null,'',url);render(); };
bar.querySelectorAll('button')[0].onclick = () => swap(-1);
bar.querySelectorAll('button')[1].onclick = () => swap(1);
bar.querySelector('.theme-label').onclick = () => document.body.toggleAttribute('data-ds-dark-theme');
bar.querySelector('select').onchange = e => { status=e.target.value;imported=status==='ready';render(); };
addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select,[contenteditable]'))return;if(event.key==='ArrowLeft')swap(-1);if(event.key==='ArrowRight')swap(1);});
document.addEventListener('click', event => { if (bar.contains(event.target) && !panel.classList.contains('open')) document.querySelector('#__dsh-backspace-btn__').click(); });
const icon = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.4"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor"/></svg>';
function render() {
  modes.hidden=variant!=='A';disclosure.hidden=variant!=='C';fourth.hidden=variant!=='B';
  tabs.hidden=variant==='A'&&mode==='video';tabs.style.gridTemplateColumns=variant==='B'?'repeat(4,minmax(0,1fr))':'';
  tabs.dataset.prototypeFour=String(variant==='B');
  fourth.setAttribute('aria-selected',String(mode==='video'));
  if(mode==='video')for(const tab of tabs.querySelectorAll('[data-skin]'))tab.setAttribute('aria-selected','false');
  region.hidden=mode==='video';video.hidden=mode!=='video';
  modes.innerHTML=`<button aria-pressed="${mode==='builtin'}">内置皮肤</button><button aria-pressed="${mode==='video'}">本地视频</button>`;
  modes.children[0].onclick=()=>{mode='builtin';render();};modes.children[1].onclick=()=>{mode='video';render();};
  video.innerHTML = status==='ready'
    ? '<div class="proto-preview">静音循环播放 · 等比铺满背景</div><h3 class="proto-name"></h3><p>1920 × 1080 · 15 秒 · 4.9 MB<br>仅保存在此设备，不上传。</p><button class="proto-action">更换视频</button><button class="proto-link">移除视频</button>'
    : `<div class="proto-upload">${icon}<h3>${status==='loading'?'正在检查视频…':'把喜欢的片刻，留作背景'}</h3><p>MP4 / WebM · 最长 30 秒<br>最高 1080p · 最大 32 MB</p><button class="proto-action" ${status==='loading'?'disabled':''}>选择本地视频</button></div><p ${status==='error'?'class="proto-error" role="alert"':''}>${status==='error'?'无法读取这个视频。请导出为 H.264 MP4 后重试。':'只在本机保存。重开后恢复，随时可以移除。'}</p>`;
  if(status==='ready')video.querySelector('h3').textContent=filename;
  video.querySelector('.proto-action').onclick=()=>{const input=document.createElement('input');input.type='file';input.accept='.mp4,.webm';input.onchange=()=>{filename=input.files[0]?.name||filename;status='loading';render();setTimeout(()=>{status='ready';imported=true;render();},900);};input.click();};
  const remove=video.querySelector('.proto-link');if(remove)remove.onclick=()=>{imported=false;status='empty';render();};
  bar.querySelector('strong').textContent=`${variant} · ${names[variant]}`;bar.querySelector('select').value=status;
  document.querySelector('#rationale').textContent={A:'推荐 A：先选择背景类型，再完成导入。保留三个内置皮肤的空间，也让视频的独立状态更清晰。',B:'方案 B：视频与三个皮肤直接并列，入口最短，但窄面板中四项略拥挤。',C:'方案 C：保留原面板结构，把视频作为展开操作；改动最小，但当前背景类型不够醒目。'}[variant];
  document.querySelector('#state').textContent=JSON.stringify({prototype:true,variant,mode,status,imported,filename:imported?filename:null,persisted:false},null,2);
}
render();
