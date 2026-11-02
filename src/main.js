import * as THREE from 'three';
import { createWorld } from './world.js';

const $ = selector => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const places = [
  { name: '世界全景', en: 'THE WHOLE WILD', tag: '湖泊 · 森林 · 旷野', description: '一片被森林轻轻环抱的湖泊。沿着水岸慢慢转一圈，木屋、旧石墙与湖心的松林，都有自己的故事。', position: [113, 92, 156], target: [0, 3, -5], pin: null },
  { name: '湖畔小屋', en: 'THE LAKESIDE CABIN', tag: '木屋 · 码头 · 旧木舟', description: '一缕炊烟，一把木椅，一艘系在岸边的小船。清晨的阳光穿过松针，落在温暖的木头上。这里适合什么都不做。', position: [-8, 28, 77], target: [-46, 6.5, 30], pin: [-49, 12, 31] },
  { name: '湖心小岛', en: 'AN ISLAND OF STILLNESS', tag: '松林 · 浅滩 · 水鸟', description: '湖水中央，几棵松树守着一小片陆地。水鸟绕过浅滩，涟漪缓缓散开。把视角放低，可以看见森林在水中的倒影。', position: [53, 30, 49], target: [9, 4, -5], pin: [9, 15, -5] },
  { name: '林间旧屋', en: 'WHAT THE FOREST KEEPS', tag: '石墙 · 苔藓 · 岁月', description: '屋顶已经残缺，窗边爬满青苔。树木从缝隙中生长，散落的石块慢慢回到土地。森林正用自己的方式，接管这座老房子。', position: [89, 29, 5], target: [47, 8, -36], pin: [47, 12, -36] },
  { name: '森林小径', en: 'FOLLOW THE QUIET PATH', tag: '小径 · 鹿群 · 林间光', description: '小径沿着湖岸延伸，消失在高高的松林后面。转过弯，也许会遇见正在驻足的鹿。请放轻脚步，和它们共享这一刻。', position: [101, 27, 73], target: [59, 6, 30], pin: [60, 10, 32] }
];

let world, currentPlace = 0, flight = null, touring = false, dusk = false, markers = true, elapsed = 0, frameCount = 0;
let audioContext, windGain, birdTimer, toastTimer;
const pins = [];

function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2800);
}

function setTour(on, announce = true) {
  touring = on; world.controls.autoRotate = on; world.controls.autoRotateSpeed = .28;
  $('#tour').setAttribute('aria-pressed', String(on));
  $('#tour .play-symbol').textContent = on ? 'Ⅱ' : '▷';
  $('#tour>span:last-child').textContent = on ? '暂停漫游' : '漫游模式';
  if (announce) toast(on ? '漫游已开启，拖动画面可随时接管' : '已暂停漫游');
}

function selectPlace(index, animate = true) {
  currentPlace = index;
  const place = places[index];
  document.body.classList.toggle('exploring', index !== 0);
  $('.intro').inert = index !== 0;
  $('.intro').setAttribute('aria-hidden', String(index !== 0));
  $('#place-card').hidden = index === 0;
  $('#place-title').textContent = place.name;
  $('#place-kicker').textContent = `FIELD NOTE / 0${index + 1} · ${place.en}`;
  $('#place-description').textContent = place.description;
  $('#place-tag').textContent = place.tag;
  $('#place-count').innerHTML = `0${index + 1} <i>/ 05</i>`;
  document.querySelectorAll('.destination').forEach((button, i) => {button.classList.toggle('active', i === index);button.setAttribute('aria-pressed',String(i === index));});
  document.querySelectorAll('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.nav === (index === 0 ? 'overview' : 'places')));
  const to = new THREE.Vector3(...place.position), target = new THREE.Vector3(...place.target);
  if (animate && !reducedMotion) flight = { start: performance.now(), duration: 1700, from: world.camera.position.clone(), to, targetFrom: world.controls.target.clone(), target };
  else {world.camera.position.copy(to);world.controls.target.copy(target);world.controls.update();flight = null;}
}

function buildPins() {
  for (let i = 1; i < places.length; i++) {
    const button = document.createElement('button');button.className='hotspot';button.setAttribute('aria-label',`探索${places[i].name}`);
    button.innerHTML=`<span class="pin"></span><span class="label">${places[i].name}</span>`;
    button.addEventListener('click',()=>selectPlace(i));$('#hotspots').appendChild(button);
    pins.push({button,point:new THREE.Vector3(...places[i].pin),index:i});
  }
}

function updatePins() {
  const width=innerWidth, height=innerHeight;
  for(const pin of pins){
    const point=pin.point.clone().project(world.camera),x=(point.x*.5+.5)*width,y=(-point.y*.5+.5)*height;
    const valid=markers && point.z<1 && point.z>-1 && x>(width<761?width*.18:width*.34) && x<width-65 && y>135 && y<height-(width<761?183:221);
    pin.button.style.visibility=valid?'visible':'hidden';pin.button.style.left=`${x}px`;pin.button.style.top=`${y}px`;
    pin.button.style.opacity=pin.index===currentPlace?'.65':'1';
  }
  const angle=world.controls.getAzimuthalAngle()*180/Math.PI;
  $('#compass-needle').style.transform=`rotate(${-angle}deg)`;
}

function zoom(factor) {
  flight=null;
  const offset=world.camera.position.clone().sub(world.controls.target),distance=THREE.MathUtils.clamp(offset.length()*factor,world.controls.minDistance,world.controls.maxDistance);
  offset.setLength(distance);world.camera.position.copy(world.controls.target).add(offset);world.controls.update();
}

async function toggleAudio() {
  if (!audioContext) {
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext){toast('此浏览器暂不支持环境音');return;}
    audioContext=new AudioContext();
    const buffer=audioContext.createBuffer(1,audioContext.sampleRate*4,audioContext.sampleRate),data=buffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+.025*(Math.random()*2-1))/1.025;data[i]=last*5;}
    const source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;
    const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=780;windGain=audioContext.createGain();windGain.gain.value=.25;
    source.connect(filter).connect(windGain).connect(audioContext.destination);source.start();
    birdTimer=setInterval(()=>{
      if(audioContext.state!=='running'||document.hidden)return;
      const now=audioContext.currentTime;
      for(let i=0;i<2;i++){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(2200+Math.random()*600,now+i*.18);oscillator.frequency.exponentialRampToValueAtTime(3500+Math.random()*300,now+i*.18+.09);gain.gain.setValueAtTime(0,now+i*.18);gain.gain.linearRampToValueAtTime(.018,now+i*.18+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.18+.14);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(now+i*.18);oscillator.stop(now+i*.18+.15);}
    },4700);
  }
  const on=$('#sound-toggle').getAttribute('aria-pressed')!=='true';
  try { if(on)await audioContext.resume();else await audioContext.suspend(); }
  catch {toast('环境音暂时无法播放，请再次点击');return;}
  $('#sound-toggle').setAttribute('aria-pressed',String(on));$('#sound-toggle').setAttribute('aria-label',on?'关闭自然环境音':'开启自然环境音');$('#sound-toggle').classList.toggle('sound-active',on);
  toast(on?'环境音已开启 · 风声与远处的鸟鸣':'环境音已关闭');
}

function bindUI() {
  const updateInputHint=()=>{
    $('.gesture-hint').innerHTML=innerWidth<761?'单指旋转<span>·</span>双指缩放与平移':'<svg viewBox="0 0 16 20" fill="none" aria-hidden="true"><rect x="3" y="1" width="10" height="16" rx="5"/><path d="M8 4v4"/></svg>拖动旋转<span>·</span>滚轮缩放<span>·</span>右键平移';
  };
  updateInputHint();
  document.querySelectorAll('.destination').forEach(button=>button.addEventListener('click',()=>selectPlace(Number(button.dataset.place))));
  $('.brand').addEventListener('click',event=>{event.preventDefault();selectPlace(0);});
  document.querySelectorAll('.nav-link').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.nav==='journal')$('#journal').showModal();else selectPlace(button.dataset.nav==='overview'?0:1);
  }));
  $('#explore').addEventListener('click',()=>selectPlace(1));$('#tour').addEventListener('click',()=>setTour(!touring));
  $('#close-place').addEventListener('click',()=>selectPlace(0));$('#reset-view').addEventListener('click',()=>{setTour(false,false);selectPlace(0);toast('已返回世界全景');});
  $('#close-journal').addEventListener('click',()=>$('#journal').close());$('#journal').addEventListener('click',event=>{if(event.target===$('#journal'))$('#journal').close();});
  $('#zoom-in').addEventListener('click',()=>zoom(.83));$('#zoom-out').addEventListener('click',()=>zoom(1.2));$('#sound-toggle').addEventListener('click',toggleAudio);
  $('#light-toggle').addEventListener('click',()=>{dusk=!dusk;world.setMood(dusk);$('#light-toggle').setAttribute('aria-label',dusk?'切换至清晨光照':'切换至黄昏光照');$('#clock-label').textContent=dusk?'05:28 PM':'06:42 AM';$('#temp-label').textContent=dusk?'16°':'12°';toast(dusk?'日落时分 · 让余晖慢慢落下':'清晨时分 · 第一束光穿过森林');});
  $('#markers-toggle').addEventListener('click',()=>{markers=!markers;$('#markers-toggle').setAttribute('aria-pressed',String(markers));$('#markers-toggle').setAttribute('aria-label',markers?'隐藏地点标记':'显示地点标记');$('#markers-toggle').classList.toggle('selected',markers);updatePins();});
  $('#fullscreen-toggle').addEventListener('click',async()=>{
    try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}
    catch{toast('可以使用浏览器全屏快捷键获得更大的视野');}
  });
  document.addEventListener('fullscreenchange',()=>{$('#fullscreen-toggle').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'进入全屏');world.resize();});
  world.controls.addEventListener('start',()=>{flight=null;if(touring)setTour(false,false);});
  window.addEventListener('resize',()=>{world.resize();updatePins();updateInputHint();});
  window.addEventListener('keydown',event=>{
    if($('#journal').open||['INPUT','TEXTAREA','BUTTON'].includes(event.target.tagName))return;
    if(event.key==='+'||event.key==='='){zoom(.9);event.preventDefault();}
    if(event.key==='-'){zoom(1.1);event.preventDefault();}
    if(event.key==='0'){selectPlace(0);event.preventDefault();}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      flight=null;const offset=world.camera.position.clone().sub(world.controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
      spherical.theta+=event.key==='ArrowLeft'?.08:event.key==='ArrowRight'?-.08:0;spherical.phi+=event.key==='ArrowUp'?-.06:event.key==='ArrowDown'?.06:0;spherical.phi=THREE.MathUtils.clamp(spherical.phi,.12,Math.PI*.475);
      world.camera.position.copy(world.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));world.controls.update();event.preventDefault();
    }
  });
}

let last=performance.now(),framesSinceUpdate=0,lastMetrics=last;
function render(now) {
  requestAnimationFrame(render);
  if(document.hidden){last=now;return;}
  const delta=Math.min((now-last)/1000,.05);last=now;elapsed+=delta;frameCount++;framesSinceUpdate++;
  if(flight){const progress=THREE.MathUtils.clamp((now-flight.start)/flight.duration,0,1),eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
    world.camera.position.lerpVectors(flight.from,flight.to,eased);world.controls.target.lerpVectors(flight.targetFrom,flight.target,eased);if(progress===1)flight=null;}
  world.update(reducedMotion?0:elapsed,delta);if(frameCount%2===0)updatePins();
  if(now-lastMetrics>1500){
    const fps=Math.round(framesSinceUpdate*1000/(now-lastMetrics));world.renderer.domElement.dataset.fps=String(fps);world.renderer.domElement.dataset.frames=String(frameCount);world.renderer.domElement.dataset.view=places[currentPlace].en;
    if(fps<23 && frameCount>55 && world.renderer.getPixelRatio()>1.05){world.renderer.setPixelRatio(1);world.resize();}
    framesSinceUpdate=0;lastMetrics=now;
  }
}

async function start() {
  try {
    world=createWorld($('#world'));world.renderer.domElement.tabIndex=0;world.renderer.domElement.setAttribute('aria-label','拖动环绕探索；方向键旋转；加减键缩放；0 返回全景');
    buildPins();bindUI();selectPlace(0,false);world.update(0,0);
    for(let i=0;i<places.length;i++){
      const img=$(`#thumb-${i}`);img.src=world.capture(places[i].position,places[i].target);img.classList.add('loaded');
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    world.resize();world.renderer.domElement.dataset.ready='true';world.renderer.domElement.dataset.trees=String(world.stats.trees);world.update(0,0);updatePins();
    $('#loading').classList.add('finished');setTimeout(()=>$('#loading').remove(),900);last=performance.now();requestAnimationFrame(render);
  } catch(error) {
    console.error('Willow Lake could not start:',error);
    $('#loading').innerHTML='<div class="loading-mark">W</div><span>场景暂时无法加载</span><p style="font-size:12px">请使用支持 WebGL 的现代浏览器，并开启硬件加速。</p><button class="primary-button" id="retry-load">重新加载</button>';
    $('#loading').style.pointerEvents='auto';$('#retry-load').addEventListener('click',()=>location.reload());
  }
}
start();
