import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import data from './landmarks.json';
import { calculate, ORIGIN, type Landmark, type Mode } from './geometry';
import { triangle } from './triangle';
import { CityMap } from './map';
import { pairCalculation, type ScenePair } from './scene-geometry';
import type { CityScene } from './scene';

const items: Landmark[] = data.filter(item => item.id === 'sun-yat-sen');
const app = document.querySelector<HTMLDivElement>('#app')!;
let mode: Mode = 'down';
let selected: Landmark | undefined;
let lastSelected: string | undefined;
let reveal = false;
let cityMap: CityMap | CityScene | undefined;
let scenePair: ScenePair | undefined;
let sceneGeneration=0;
let fallbackActive=false;
let sceneHost:HTMLElement|undefined;
let preparedScene:CityScene|undefined;
let preparePromise:Promise<void>|undefined;
let preparedPair:ScenePair|undefined;
function stashScene(){if(sceneHost){sceneHost.classList.add('scene-preload');sceneHost.setAttribute('aria-hidden','true');document.body.append(sceneHost);}}
function prepareScene(){
  if(preparePromise)return preparePromise;
  sceneHost?.remove();sceneHost=document.createElement('section');sceneHost.className='map-panel scene-preload';sceneHost.setAttribute('aria-hidden','true');sceneHost.setAttribute('aria-label','台北實景3D場景');document.body.append(sceneHost);
  preparePromise=import('./scene').then(({CityScene})=>{
    preparedScene=new CityScene(sceneHost!,items[0],mode,pair=>{
      preparedPair=pair;scenePair=pair;
      const status=app.querySelector('.home-readiness');if(status)status.textContent='視點已校準 · 模型細節載入中…';
      if(app.querySelector('.detail-panel'))detail();
    },()=>{preparedScene?.destroy();preparedScene=undefined;preparedPair=undefined;preparePromise=undefined;fallbackActive=true;scenePair=undefined;cityMap=new CityMap(sceneHost!,items,select);cityMap.update(selected,mode);detail();});
    const observer=new MutationObserver(()=>{const status=app.querySelector('.home-readiness');const sceneStatus=sceneHost?.querySelector('.scene-status')?.textContent;if(status&&sceneStatus){const text=sceneStatus==='實景模型已載入'?'實景已準備好 · 可開始60秒探索':sceneStatus; if(status.textContent!==text)status.textContent=text;}});
    observer.observe(sceneHost!,{subtree:true,childList:true,characterData:true});
  });return preparePromise;
}
let transitioning = false;
const fmtDistance = (meters: number) => (meters / 1000).toFixed(2);
const modeTitle = () => mode === 'down' ? '俯瞰台北' : '仰望101';
const modeEn = () => mode === 'down' ? 'LOOK DOWN' : 'LOOK UP';
const footer = () => `<footer><span>用三角看見台北</span><button class="text-button" data-sources>資料與模型</button><span>BUILD FOR TAIPEI × MAKE LEARNING PERSONAL</span></footer>`;
function sources() {
  const dialog = document.createElement('dialog');
  dialog.className='sources-dialog';
  dialog.innerHTML=`<button class="close-dialog" autofocus>關閉</button><p class="eyebrow">SOURCES & MODEL</p><h2>關於這個三角形</h2><p>景點代表座標取自交通部觀光署<a href="https://data.gov.tw/dataset/7777" target="_blank" rel="noopener">景點－觀光資訊資料庫</a>，依<a href="https://data.gov.tw/license" target="_blank" rel="noopener">政府資料開放授權條款第1版</a>使用，可能代表入口或廣場，並非測量點。目前先開放國父紀念館這一組雙視角。</p><p><strong>實景3D</strong>：ArcGIS Maps SDK for JavaScript 讀取<a href="https://uddtp.gitbook.io/tpgis/ch6/6.2" target="_blank" rel="noopener">臺北市都發局公開 I3S 服務</a>，使用信義計畫區2022影像紋理模型。只介接官方服務，不另行重製發佈模型。涵蓋範圍以外是<a href="https://maps.nlsc.gov.tw" target="_blank" rel="noopener">國土測繪中心 PHOTO2</a>影像底圖。地面附近的紋理可能模糊、變形或缺漏，並非即時街景。</p><p><strong>模擬觀察位置</strong>：101代表座標為25.033976° N、121.564530° E。高處視點朝國父紀念館偏移70公尺，高度設為101西南側附近模型表面取樣加382公尺；地面起點從紀念館代表座標朝101偏移120公尺，眼高為該處模型表面加1.6公尺。這些位置用來減少相機落在建物內的機會，不是實際室內拍攝位置。</p><p><strong>同一組端點、同一高程基準</strong>：兩個模式交換相同高低端點。兩處高程都從同一份模型表面取樣，沿用服務標示的EGM96基準；模型表面可能包含植栽或構造物，不當作實測裸地。距離以Turf球面距離近似局部水平距離；方位角由正北順時針計算。<code>θ = atan2(高處端點高程 − 低處端點高程, 水平距離)</code>俯角由觀察者水平線向下量，仰角由水平線向上量。在局部平面、平行水平線的假設下，兩角為內錯角而相等；忽略地球曲率與折射。<strong>未驗證實際可視性</strong>，畫面標記與教學連線不代表視線沒有遮擋。</p><p><strong>2D備援</strong>另採101底部與地標地面同高的簡化模型，不代表完成實景3D。街道資料為<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap 貢獻者</a>；服務失敗時顯示內建座標示意圖。</p><p>封面攝影：<a href="https://commons.wikimedia.org/wiki/File:Taipei101-Night_view.jpg" target="_blank" rel="noopener">Zion C／Wikimedia Commons</a>，<a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0</a>，是實際台北夜景。</p>`;
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('button')!.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>dialog.remove());
}
function bindSources() { app.querySelectorAll('[data-sources]').forEach(button=>button.addEventListener('click',sources)); }
function header(explore = false) {
  return `<header class="site-header"><button class="brand" data-home aria-label="△101，回到首頁"><span>△</span>101</button><div class="brand-line">SEE TAIPEI<br>THROUGH MATHEMATICS</div><div class="header-right">${explore ? '<button class="home-link" data-home>回到兩種視角</button>' : '<span class="edition">TAIPEI FIELD NOTES <b>001</b></span>'}</div></header>`;
}
function home() {
  sceneGeneration++; if(!fallbackActive)stashScene();else cityMap?.destroy(); cityMap=undefined; selected=undefined; transitioning=false;scenePair=preparedPair;
  app.innerHTML=`${header()}<main class="landing"><img class="city-photo" src="/taipei-night.jpg" alt="從象山望向台北101與信義區的夜景"/><div class="photo-shade"></div><div class="landing-intro"><p class="eyebrow"><span class="mini-line"></span> 一座城市，兩種視角</p><h1>用三角<br>看見台北<span>。</span></h1><p class="intro-copy">從101俯瞰城市，<br>或從城市仰望101。<br>換個角度，看見彼此的距離。</p><p class="home-readiness" role="status">${preparedPair?"視點已校準 · 可進入探索":"首次實景準備中，模型細節需稍候…"}</p><div class="landing-coordinate"><span>25°02′ N</span><span>121°34′ E</span></div></div><div class="perspective-stage" aria-label="選擇探索視角"><svg class="landing-geometry" viewBox="0 0 560 530" aria-hidden="true"><path d="M340 85V415H105Z"/><path class="landing-dash" d="M340 85H520M105 415H430"/><circle cx="340" cy="85" r="5"/><circle cx="105" cy="415" r="5"/></svg><button class="perspective-choice choose-101" data-mode="down"><span class="choice-kicker">01 / 從高處出發</span><strong>台北<span>101</span></strong><span class="choice-en">TAIPEI 101</span><span class="choice-action">俯瞰台北 · LOOK DOWN <i>↘</i></span></button><div class="between-mark" aria-hidden="true">△<span>ONE TRIANGLE.<br>TWO PERSPECTIVES.</span></div><button class="perspective-choice choose-taipei" data-mode="up"><span class="choice-kicker">02 / 從城市出發</span><strong>台北市</strong><span class="choice-en">TAIPEI</span><span class="choice-action">仰望101 · LOOK UP <i>↖</i></span></button></div><span class="photo-credit">TAIPEI AFTER DARK / ZION C · CC0</span></main>${footer()}`;
  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
    if(transitioning)return; transitioning=true; mode=button.dataset.mode as Mode;
    app.querySelector('.landing')!.classList.add(`enter-${mode}`);
    window.setTimeout(()=>enter(mode),matchMedia('(prefers-reduced-motion: reduce)').matches?0:560);
  }));
  app.querySelectorAll('[data-home]').forEach(button=>button.addEventListener('click',()=>{if(!transitioning)home();}));
  bindSources();
  if(fallbackActive)void prepareScene().catch(()=>{});
}
function enter(nextMode: Mode, preserve = false) {
  mode=nextMode; transitioning=false; reveal=false;
  if(preserve && cityMap){
    app.querySelector('.explore-heading h1')!.textContent=modeTitle();
    app.querySelector('.explore-heading .eyebrow')!.innerHTML=`${mode==='down'?'101 VIEW':'TAIPEI VIEW'} <span>/ ${modeEn()}</span>`;
    app.querySelectorAll<HTMLButtonElement>('[data-switch]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.switch===mode)));
    app.querySelector('.list-heading .eyebrow')!.textContent=mode==='down'?'選擇一個目的地':'選擇你的起點';
    app.querySelector('.list-subtitle')!.textContent=mode==='down'?'從台北101，看向哪裡？':'CHOOSE YOUR VIEWPOINT';
    cityMap.update(selected,mode);detail();return;
  }
  if(!preserve) selected=undefined;
  if(!fallbackActive)stashScene();else cityMap?.destroy();
  app.innerHTML=`${header(true)}<main class="explore"><section class="explore-heading"><div><p class="eyebrow">${mode==='down'?'101 VIEW':'TAIPEI VIEW'} <span>/ ${modeEn()}</span></p><h1 tabindex="-1">${modeTitle()}</h1></div><div class="perspective-tabs" role="group" aria-label="切換觀測視角"><button data-switch="down" aria-pressed="${mode==='down'}">俯瞰 <span>LOOK DOWN</span></button><button data-switch="up" aria-pressed="${mode==='up'}">仰望 <span>LOOK UP</span></button></div></section><div class="workspace"><aside class="landmark-panel"><div class="list-heading"><span class="eyebrow">${mode==='down'?'選擇一個目的地':'選擇你的起點'}</span><span class="count">01</span></div><p class="list-subtitle">${mode==='down'?'從台北101，看向哪裡？':'CHOOSE YOUR VIEWPOINT'}</p><div class="landmark-list">${items.map((item,index)=>`<button class="landmark-button" data-landmark="${item.id}" aria-pressed="${item.id===selected?.id}"><span class="landmark-number">${String(index+1).padStart(2,'0')}</span><span class="landmark-names"><strong>${item.name}</strong><small>${item.nameEn}</small>${item.id===lastSelected?'<em>上次探索</em>':''}</span><span class="landmark-distance" title="景點原始代表座標距離，模擬視點有偏移">${fmtDistance(calculate(item,mode).horizontalMeters)}<small>km · 原座標</small></span></button>`).join('')}</div><div class="origin-note"><span class="origin-symbol">△</span><div>台北101 · 89F 高度參考<small>模擬觀景高度 ${ORIGIN.height} m</small></div></div></aside><section class="map-panel" aria-label="台北地標地圖"></section><aside class="detail-panel" aria-live="polite" aria-atomic="true"></aside></div></main>${footer()}`;
  app.querySelectorAll('[data-home]').forEach(button=>button.addEventListener('click',home));
  app.querySelectorAll<HTMLButtonElement>('[data-switch]').forEach(button=>button.addEventListener('click',()=>enter(button.dataset.switch as Mode,true)));
  app.querySelectorAll<HTMLButtonElement>('[data-landmark]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.landmark!)));
  scenePair=preparedPair;fallbackActive=false;
  const generation=++sceneGeneration;
  const panel=app.querySelector<HTMLElement>('.map-panel')!;
  panel.innerHTML='<div class="scene-loading">正在準備台北實景3D…</div>';
  void prepareScene().then(()=>{
    if(generation!==sceneGeneration||!sceneHost||!preparedScene)return;
    sceneHost.classList.remove('scene-preload');sceneHost.removeAttribute('aria-hidden');panel.replaceWith(sceneHost);
    cityMap=preparedScene;cityMap.update(selected,mode);
  }).catch(()=>{if(generation!==sceneGeneration)return;panel.innerHTML='<div class="scene-loading">3D引擎載入失敗 <button id="fallback-init">使用2D備援</button></div>';panel.querySelector('#fallback-init')!.addEventListener('click',()=>{fallbackActive=true;cityMap=new CityMap(panel,items,select);cityMap.update(selected,mode);detail();});});
  detail();bindSources(); app.querySelector<HTMLElement>('h1')!.focus({preventScroll:true});
}
function select(id: string) {
  const item=items.find(i=>i.id===id); if(!item)throw new Error('Unknown landmark');
  selected=item;lastSelected=id;reveal=false;
  app.querySelectorAll<HTMLButtonElement>('[data-landmark]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.landmark===id)));
  cityMap?.update(selected,mode); detail();
}
function detail() {
  const panel=app.querySelector<HTMLElement>('.detail-panel')!;
  if(!selected){panel.innerHTML=`<div class="empty-detail"><span class="empty-triangle">△</span><p class="eyebrow">YOUR NEXT PERSPECTIVE</p><h2>${mode==='down'?'城市，從一個點展開。':'選擇你的起點。'}</h2><p>選擇國父紀念館，<br>連起高處與城市中的視線。</p><div class="empty-equation"><span>距離</span><i>×</i><span>方位</span><i>×</i><span>角度</span></div></div>`;return;}
  if(!scenePair&&!fallbackActive){panel.innerHTML='<div class="empty-detail"><span class="empty-triangle">△</span><h2>正在對齊觀察位置</h2><p>準備實景與同一組端點。<br>高度載入後顯示角度。</p></div>';return;}
  const value=scenePair?pairCalculation(scenePair,mode):calculate(selected,mode); const angleLabel=mode==='down'?'俯角':'仰角';
  panel.innerHTML=`<div class="detail-top"><span class="eyebrow">${mode==='down'?'YOUR DESTINATION':'YOUR VIEWPOINT'}</span><span class="detail-index">${String(items.indexOf(selected)+1).padStart(2,'0')} / 01</span></div><h2>${selected.name}</h2><p class="detail-english">${selected.nameEn}</p><p class="route-label">${mode==='down'?`台北101 <span>↘</span> ${selected.name}`:`${selected.name} <span>↖</span> 台北101`}</p><div class="angle-hero"><div><span>${angleLabel}</span><small>ANGLE OF ${mode==='down'?'DEPRESSION':'ELEVATION'}</small></div><strong>${value.angle.toFixed(1)}<sup>°</sup></strong></div><dl class="metric-grid"><div><dt>水平距離 <small>DISTANCE</small></dt><dd>${fmtDistance(value.horizontalMeters)} <span>km</span></dd></div><div><dt>方位角 <small>BEARING</small></dt><dd>${Math.round(value.bearing)}<span>°</span></dd></div><div><dt>方向 <small>DIRECTION</small></dt><dd>${value.direction.zh} <span>${value.direction.en}</span></dd></div><div><dt>模擬觀景高度 <small>HEIGHT</small></dt><dd>382 <span>m</span></dd></div></dl>${triangle(selected,mode,reveal,value)}<button class="reveal-button" id="reveal" aria-expanded="${reveal}">${reveal?'收起角度關係':'看見俯角與仰角的關係'} <span>${reveal?'−':'+'}</span></button><div class="model-note"><span class="model-tag">${scenePair?"實景模型＋局部平面幾何近似":"2D備援 · 簡化地形模型"}</span><p>${scenePair?`101視點朝地標偏移 ${scenePair.highOffset} m；地標起點朝101偏移 ${scenePair.lowOffset} m。兩模式交換相同端點；未驗證實際可視性。高程來自同一份EGM96模型表面取樣，非實測地面。`:"地標與101底部設為同高；忽略地形與遮蔽。"}${selected.id==='grand-hotel'?'圓山飯店位於山坡，本角度不代表現地實際視線。':''}${selected.id==='cks'?'此座標為園區西側廣場／入口代表點。':''}</p></div>`;
  panel.querySelector('#reveal')!.addEventListener('click',()=>{reveal=!reveal;detail();panel.querySelector<HTMLButtonElement>('#reveal')!.focus({preventScroll:true});});
}
home();
window.setTimeout(()=>{void prepareScene().catch(()=>{const status=app.querySelector('.home-readiness');if(status)status.textContent='實景引擎暫時無法預載，仍可開啟2D備援';});},500);

type ModelTool = { name:string; description:string; inputSchema:object; annotations:object; execute:(input:unknown)=>unknown };
const context=(document as Document & {modelContext?:{registerTool:(tool:ModelTool,options:{signal:AbortSignal})=>unknown}}).modelContext;
if(context?.registerTool){
  const lifecycle=new AbortController();
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  try { Promise.resolve(context.registerTool({name:'explore_taipei_landmark',description:'Choose a listed Taipei landmark and Look Down or Look Up perspective; updates the visible map and triangle.',inputSchema:{type:'object',properties:{landmarkId:{type:'string',enum:items.map(i=>i.id)},mode:{type:'string',enum:['down','up']}},required:['landmarkId','mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input:unknown){const value=input as {landmarkId?:unknown;mode?:unknown};if(!value||!items.some(i=>i.id===value.landmarkId)||(value.mode!=='down'&&value.mode!=='up'))throw new Error('A known landmarkId and down/up mode are required.');if(!preparedPair)throw new Error('The 3D observation points are still being prepared.');enter(value.mode);await prepareScene();select(value.landmarkId as string);return {landmark:selected!.name,mode,model:'same-endpoint local-plane approximation',...pairCalculation(preparedPair,mode)};}},{signal:lifecycle.signal})).catch(()=>{}); } catch { /* Optional browser capability; normal UI remains available. */ }
}


