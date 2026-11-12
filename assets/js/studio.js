/* 明医格物 / offline exhibition. No network, no runtime dependencies. */
(() => {
  'use strict';
  const D = window.TCM_DATA;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const pad = n => String(n).padStart(2, '0');
  const icon = id => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const ids = ['prologue', ...D.nav.slice(1).map(n => n.id), 'epilogue'];
  const labels = ['杏林千古','四气五味','九蒸九晒','水汽蒸馏','时辰食养','传统剂型','杏林试炼','策展说明'];
  const subtitles = ['','识性味 · 观图谱','观火候 · 辨转化','循水汽 · 留芳香','转时辰 · 识草木','辨形态 · 看释放','答六题 · 领文牒'];
  const S = {scene:0, doctor:0, flipped:false, herb:0, stage:3, temp:100, hours:6, power:60, cooling:75, running:true, material:0, time:4, tea:[], form:0, releaseTime:3, answers:[], question:0, earned:[], visited:[0]};
  window.__APP_ERRORS__ = [];
  window.addEventListener('error', e => window.__APP_ERRORS__.push(e.message));
  window.addEventListener('unhandledrejection', e => window.__APP_ERRORS__.push(String(e.reason)));
  try {
    const p = JSON.parse(localStorage.getItem('mingyi-exhibition-v2') || '{}');
    if (Array.isArray(p.earned)) S.earned = [...new Set(p.earned.filter(x => Number.isInteger(x) && x >= 1 && x <= 6))];
    if (Array.isArray(p.visited)) S.visited = [...new Set([0, ...p.visited.filter(x => Number.isInteger(x) && x >= 0 && x <= 7)])];
    if (Array.isArray(p.answers) && p.answers.length <= D.quiz.length && p.answers.every((v,i) => Number.isInteger(v) && v >= 0 && v < D.quiz[i].options.length)) {
      S.answers = p.answers; S.question = Math.min(p.answers.length, D.quiz.length - 1);
    }
  } catch (_) { /* Private browsing and file:// may deny storage. */ }
  const save = () => { try { localStorage.setItem('mingyi-exhibition-v2', JSON.stringify({earned:S.earned, visited:S.visited, answers:S.answers})); } catch (_) {} };
  function earn(n) { if (!S.earned.includes(n)) { S.earned.push(n); save(); refreshSeals(); } }
  let toastTimer;
  function toast(msg) { $('#toast').textContent = msg; $('#toast').classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('is-visible'), 2600); }
  const header = (n, en, title, description) => `<header class="chapter-header"><div><p class="eyebrow"><span class="chapter-id">卷 ${['','壹','贰','叁','肆','伍','陆'][n]} / ${pad(n)}</span>${en}</p><h2>${title}</h2></div><p>${description}</p></header>`;
  const note = (title, text) => `<div class="science-note"><span>${title}</span><p>${text}</p></div>`;
  const range = (id, text, value, min, max, unit='', step=1) => `<label class="range-control" for="${id}"><span class="range-label">${text}<output id="${id}Value">${value}<small>${unit}</small></output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><span class="range-ends"><span>${min}${unit}</span><span>${max}${unit}</span></span></label>`;
  function rangeFill(el) { el.style.setProperty('--fill', `${(el.value-el.min)/(el.max-el.min)*100}%`); }
  function bindRange(id, handler) { const el=$('#'+id); rangeFill(el); el.addEventListener('input', () => {rangeFill(el); handler(Number(el.value));}); }
  function guide() {
    $('#guideChapters').innerHTML = ids.slice(1,7).map((id,i)=>`<a href="#${id}" class="${S.earned.includes(i+1)?'is-visited':''}"><b>${pad(i+1)}</b><strong>${labels[i+1]}</strong><small>${S.earned.includes(i+1)?'已留印记':subtitles[i+1]}</small><span>↗</span></a>`).join('');
    $('#guideDialog').showModal();
  }
  const built = new Set(['prologue']);
  const constructors = [null, buildHerbs, buildProcessing, buildDistillation, buildRhythm, buildForms, buildTrial, buildSources];
  function goScene(target, {silent=false, instant=false}={}) {
    const index = typeof target==='string' ? ids.indexOf(target) : clamp(target,0,7);
    if (index < 0) return;
    const scene = $('#'+ids[index]);
    if (!built.has(ids[index])) { constructors[index](scene); built.add(ids[index]); }
    const old=$('#'+ids[S.scene]);
    if (index!==S.scene) {
      old.classList.remove('is-active'); old.classList.add('is-leaving'); old.inert=true; old.setAttribute('aria-hidden','true');
      setTimeout(()=> {if (!old.classList.contains('is-active')) {old.hidden=true; old.classList.remove('is-leaving');}},instant?0:360);
    }
    S.scene=index; scene.hidden=false; scene.inert=false; scene.setAttribute('aria-hidden','false'); scene.classList.remove('is-leaving');
    // A single style read starts the compositor transition, including rapid reversals.
    void scene.offsetWidth; scene.classList.add('is-active');
    if (!S.visited.includes(index)) S.visited.push(index);
    save();
    if ($('#guideDialog').open) $('#guideDialog').close();
    $$('#mainNav a').forEach(a => { if(a.hash==='#'+ids[index])a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    $('#deckCurrent').textContent=pad(index+1); $('#deckPrev').disabled=index===0; $('#deckNext').disabled=index===7;
    $('#deckNext').innerHTML=index===6?'策展说明 <span>→</span>':index===7?'展览终章 <span>✓</span>':'下一章 <span>→</span>';
    $('#readProgress').style.width=`${(index+1)*12.5}%`;
    $('#footerNote').textContent=index===0?'守千年本草 · 创智慧新生':`${pad(index)} / ${labels[index]} · 亲手探索本草之理`;
    document.title=`${labels[index]} · 明医格物`;
    if (!silent) { try { history.pushState(null,'','#'+ids[index]); } catch (_) {} }
    // Transfer focus out of the outgoing inert scene without scrolling the viewport.
    if (old!==scene && old.contains(document.activeElement)) $('#main').focus({preventScroll:true});
    syncMotion();
  }
  function syncMotion() {
    document.getAnimations?.().forEach(animation => {
      if (animation.effect?.getTiming().iterations !== Infinity) return;
      const scene=animation.effect.target?.closest?.('.scene');
      if (scene) (scene.id!==ids[S.scene] || document.hidden) ? animation.pause() : animation.play();
    });
    const panel=$('#apparatusPanel'); if(panel)panel.classList.toggle('is-paused',!S.running || S.scene!==3 || document.hidden);
  }

  function buildDoctors() {
    $('#scrollTrack').innerHTML=D.doctors.map((d,i)=>`<article class="doctor-scroll" data-doctor="${i}" role="group" tabindex="0" aria-label="${esc(d.name)}名医卷，按 Enter 翻阅" aria-expanded="false"><div class="scroll-flipper"><div class="scroll-rod top"></div><div class="scroll-face"><img data-src="assets/images/archive/doctor_${d.id}-lite.webp" alt="${esc(d.name)}历史画像" width="260" height="410" decoding="async"><span class="scroll-name">${esc(d.name)}</span><span class="scroll-era">${esc(d.era)} · ${esc(d.date)}</span></div><div class="scroll-back" inert aria-hidden="true"><span class="back-seal">${esc(d.seal)}</span><h3>${esc(d.name)}</h3><p class="back-quote">“${esc(d.quote)}”</p><p class="back-summary">${esc(d.summary)}<br><br>${esc(d.scienceTitle)}</p><p class="back-source">${esc(d.quoteSource)}</p><button class="back-close" type="button">合卷，回到画像 ↶</button></div><div class="scroll-rod bottom"></div></div></article>`).join('');
    $('#scrollTrack').addEventListener('click', e=> {
      if (suppressClick) return;
      const card=e.target.closest('[data-doctor]'); if(!card)return;
      const n=Number(card.dataset.doctor);
      if(e.target.closest('.back-close')) {flipDoctor(false);card.focus({preventScroll:true});return;}
      if(n!==S.doctor) changeDoctor(n); else if(!e.target.closest('.scroll-back')) flipDoctor(!S.flipped);
    });
    $('#scrollTrack').addEventListener('keydown',e=>{if(e.target.matches('.doctor-scroll') && ['Enter',' '].includes(e.key)){e.preventDefault();e.target.click();}});
    $('#prevDoctor').addEventListener('click',()=>changeDoctor(S.doctor-1));
    $('#nextDoctor').addEventListener('click',()=>changeDoctor(S.doctor+1));
    $('#heroOpenDoctor').addEventListener('click',()=>{flipDoctor(true);$('.doctor-scroll.is-active .back-close').focus({preventScroll:true});});
    let start=null;
    $('#scrollStage').addEventListener('pointerdown',e=>{if(e.button!==0 || e.target.closest('.scroll-back'))return;start={x:e.clientX,y:e.clientY};});
    $('#scrollStage').addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>38&&Math.abs(dx)>Math.abs(dy)*1.3){suppressClick=true;changeDoctor(S.doctor+(dx<0?1:-1));setTimeout(()=>suppressClick=false,160);}});
    $('#scrollStage').addEventListener('pointercancel',()=>start=null);
    updateGallery();
  }
  let suppressClick=false;
  function changeDoctor(n) { flipDoctor(false); S.doctor=(n+5)%5; updateGallery(); }
  function flipDoctor(value) {
    S.flipped=value;
    $$('.doctor-scroll').forEach((card,i)=>{
      const flip=i===S.doctor&&value;
      card.classList.toggle('is-flipped',flip); card.setAttribute('aria-expanded',String(flip));
      $('.scroll-face',card).setAttribute('aria-hidden',String(flip));
      $('.scroll-back',card).setAttribute('aria-hidden',String(!flip)); $('.scroll-back',card).inert=!flip;
    });
  }
  function updateGallery() {
    const w=$('#scrollStage').clientWidth, gap=Math.min(150,w*.25);
    $$('.doctor-scroll').forEach((card,i)=>{
      let d=i-S.doctor;if(d>2)d-=5;if(d< -2)d+=5;
      card.style.transform=`translate3d(calc(-50% + ${d*gap}px),calc(-50% + ${Math.abs(d)*13}px),${d===0?45:-35}px) rotateY(${-d*15}deg) scale(${d===0?1:.85})`;
      card.style.zIndex=10-Math.abs(d); card.style.opacity=Math.abs(d)>1?'0':d===0?'1':'.55';
      card.style.pointerEvents=Math.abs(d)>1?'none':'auto'; card.inert=Math.abs(d)>1; card.classList.toggle('is-active',d===0);
      if(Math.abs(d)<=1){const img=$('img',card);if(!img.src)img.src=img.dataset.src;}
    });
    const d=D.doctors[S.doctor];$('#galleryIndex').textContent=pad(S.doctor+1);$('#galleryName').textContent=d.name;$('#galleryEra').textContent=d.era+' · '+d.alias;
  }

  function buildHerbs(el) {
    el.innerHTML=header(1,'A CABINET OF BOTANICAL CURIOSITIES','草木有性，<em>一味一世界。</em>','打开一只药斗，从原植物到化学成分，观察传统性味与现代研究如何相遇。')+`<div class="herb-layout"><aside><div class="section-caption"><span>本草药斗</span><small>SELECT A SPECIMEN</small></div><div class="herb-cabinet" id="herbCabinet">${D.herbs.map((h,i)=>`<button class="herb-drawer" data-herb="${i}" aria-pressed="false"><img src="${esc(h.photo)}" alt="" width="65" height="56" loading="lazy"><strong>${esc(h.name)}</strong><small>${esc(h.part)} / ${esc(h.nature)}</small></button>`).join('')}</div><p class="micro-note cabinet-note">皖药四味 · 常用四味<br>植物影像用于物种观察，不作为自行采药的鉴定依据。</p></aside><div class="herb-display" id="herbDisplay"></div></div>`+note('性味之辨','性味与归经属于传统理论的描述体系，不能直接等同于化学含量或现代药效。条形图沿用原作品的相对指纹教学数据，不是检测结果，也不比较不同药材的疗效。');
    $('#herbCabinet').addEventListener('click',e=>{const b=e.target.closest('[data-herb]');if(b){selectHerb(+b.dataset.herb);earn(1);}});
    selectHerb(S.herb);
  }
  function selectHerb(index) {
    S.herb=index; const h=D.herbs[index];
    $$('#herbCabinet button').forEach((b,i)=>b.setAttribute('aria-pressed',String(index===i)));
    $('#herbDisplay').innerHTML=`<figure class="herb-specimen"><img id="herbPhoto" src="${esc(h.photo)}" alt="${esc(h.name)}原植物或药用部位参考影像" decoding="async"><figcaption><small>FIELD NOTES / ${pad(index+1)} · ${esc(h.origin)}</small><h3>${esc(h.name)}</h3><small>${esc(h.latin)}</small><div class="tags" style="margin-top:12px"><span class="tag">${esc(h.part)}</span><span class="tag">${esc(h.nature)}</span></div></figcaption></figure><div class="herb-detail"><p class="eyebrow">一味本草 · 两种阅读方式</p><p class="herb-quote">“${esc(h.quote)}”</p><p class="herb-quote-source">${esc(h.quoteSource)}</p><div class="tags">${h.flavor.map(x=>`<span class="tag">${esc(x)}味</span>`).join('')}<span class="tag">${esc(h.nature)}</span></div><p class="herb-physical">${esc(h.physical)}</p><div class="section-caption"><span>成分指纹 / 教学示意</span><small>RELATIVE PROFILE</small></div><div class="chemical-bars">${['多糖','生物碱','黄酮','萜类','酚酸','含氮组分'].map((x,i)=>`<div class="chemical-row"><span>${x}</span><i role="img" aria-label="${x}相对指纹 ${h.chem[i]}，教学示意"><b style="width:${h.chem[i]}%"></b></i></div>`).join('')}</div><p class="micro-note" style="margin-top:13px">影像：${esc(h.photoSource)} · ${esc(h.photoLicense)}<br>摄影署名与原图链接见素材许可表。</p></div><div class="herb-lower"><div class="compound-list">${h.compounds.map(c=>`<div class="compound-item"><b>${esc(c.name)}</b><p>${esc(c.class)}<br>${esc(c.note)}</p></div>`).join('')}</div><div class="relation-map"><b>传统归经</b><i>—</i>${h.meridians.map(m=>`<span>${esc(m)}经</span>`).join('')}<p class="micro-note" style="width:100%">${esc(h.note)}</p></div></div>`;
  }

  // Original vector specimens: illustrative morphology, never passed off as photographs.
  function specimen(t, suffix) {
    const colors=['#d9cda8','#caba90','#c49b5e','#b4874e','#a77a43','#946638','#805530','#6d462b','#5b3926','#493023'];
    const c=colors[t], rings=t>5?'#bb965a':'#f0d9a1';
    const slices=[[240,165,87,56,-24],[360,224,92,60,13],[205,285,78,48,-12],[450,122,60,43,25]];
    return `<svg class="specimen-art" viewBox="0 0 640 390" role="img" aria-label="${t===0?'生黄精':t+'次蒸晒后黄精'}形态与颜色的原创示意"><defs><linearGradient id="slice-${suffix}" x2="0.3" y2="1"><stop stop-color="${c}"/><stop offset="1" stop-color="${t>5?'#35271e':'#ae824a'}"/></linearGradient><radialGradient id="flesh-${suffix}"><stop stop-color="${rings}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs><rect width="640" height="390" fill="#e9e7d7"/><circle cx="320" cy="205" r="145" fill="none" stroke="#d1d4bd"/><circle cx="320" cy="205" r="161" fill="none" stroke="#d5d9c4" stroke-dasharray="2 6"/><ellipse cx="321" cy="322" rx="204" ry="17" fill="#687458" opacity=".09"/>${slices.map(([x,y,rx,ry,r],i)=>`<g transform="translate(${x} ${y}) rotate(${r})"><path d="M${-rx} 0c0 ${ry*1.6} ${rx*2} ${ry*1.6} ${rx*2} 0v18c-8 ${ry*1.6} ${-rx*2+8} ${ry*1.6} ${-rx*2} 0Z" fill="url(#slice-${suffix})"/><ellipse rx="${rx}" ry="${ry}" fill="url(#flesh-${suffix})" stroke="${t>4?'#775335':'#c5a26b'}" stroke-width="3"/><ellipse rx="${rx*.78}" ry="${ry*.72}" fill="none" stroke="${rings}" stroke-width="1" opacity=".5"/>${Array.from({length:28},(_,k)=>{const a=k*2.39996,r=.22+((k*7)%13)/24;return `<ellipse cx="${Math.cos(a)*rx*r}" cy="${Math.sin(a)*ry*r}" rx="${1.6+(k%3)*.5}" ry="${1+(k%3)*.3}" fill="${t>5?'#b59358':'#b3a076'}" opacity=".55"/>`;}).join('')}<ellipse rx="${rx*.11}" ry="${ry*.16}" fill="${t>4?'#3c291c':'#bb9458'}"/></g>`).join('')}<text x="34" y="354" fill="#8c967b" font-size="9" font-family="sans-serif" letter-spacing="2">POLYGONATUM / MORPHOLOGY STUDY</text><path d="M570 35v35m-17-17h34M40 40h28v1H41v27h-1" fill="none" stroke="#9ba98c"/></svg>`;
  }
  function buildProcessing(el) {
    el.classList.add('processing-scene');
    el.innerHTML=header(2,'THE ART OF HEAT & TIME','一蒸一晒，<em>时间入味。</em>','拖动分界线，对照黄精蒸晒前后的颜色与形态。再改变火候，看看一段传统工艺背后的转化趋势。')+`<div class="processing-layout"><div><div class="processing-specimen" id="processingSpecimen"><div class="comparison-image">${specimen(0,'raw')}</div><div class="comparison-image comparison-after" id="cookedSpecimen">${specimen(S.stage,'cooked')}</div><span class="sample-label">黄精 / 颜色与形态示意</span><div class="comparison-line"><span>↔</span></div><div class="comparison-caption"><span>生品示意</span><span id="stageCaption">三蒸示意</span></div><input id="comparison" class="comparison-slider" type="range" min="5" max="95" value="50" aria-label="拖动对照生品与炮制后示意"></div><div class="stage-timeline" id="stageTimeline">${Array.from({length:10},(_,i)=>`<button data-stage="${i}" aria-pressed="false">${pad(i)}<small>${i===0?'生品':i+'蒸'}</small></button>`).join('')}</div><div class="stage-description"><h3 id="stageName"></h3><p id="stageDescription"></p></div><p class="process-photo-note">原创矢量示意，不是实物照片；阶段外观不随参数预测，不据此判断炮制是否合格。</p></div><aside class="processing-controls"><div class="split-heading"><h3>亲手调一炉火候</h3><span class="pill">教学模拟</span></div>${range('procTemp','蒸制温度',S.temp,85,100,'℃')}${range('procHours','每轮受热时长',S.hours,1,8,'h',.5)}<button id="advanceStage" class="primary-button">推进一蒸一晒 <span>→</span></button><button id="resetProcessing" class="reset-button">重置至生品</button><div class="process-chart-wrap"><div class="section-caption"><span>成分转化 · 相对趋势</span><small>MODEL / NOT MEASURED</small></div><div class="legend"><span><i style="--c:#60886b"></i>原多糖</span><span><i style="--c:#b99a54"></i>还原糖</span><span><i style="--c:#ad6f51"></i>褐变</span></div><div class="chart" id="processingChart"></div><p class="micro-note">悬停或触摸曲线查看轮次。指数归一化至 0—100，不代表含量、功效或安全性。</p></div></aside></div>`+note('为什么会变？','受热可引起多糖水解，还原糖再参与美拉德反应等转化。图中的简化衰减与生成函数只解释变化方向；九次蒸晒不是所有品种与生产条件通用的最佳工艺。参考 Hodge（1953），DOI: 10.1021/jf60015a004。');
    bindRange('comparison',v=>{$('#processingSpecimen').style.setProperty('--split',v+'%');earn(2);});
    bindRange('procTemp',v=>{S.temp=v;$('#procTempValue').innerHTML=v+'<small>℃</small>';updateProcessingChart();earn(2);});
    bindRange('procHours',v=>{S.hours=v;$('#procHoursValue').innerHTML=v+'<small>h</small>';updateProcessingChart();earn(2);});
    $('#stageTimeline').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b){setStage(+b.dataset.stage);earn(2);}});
    $('#advanceStage').addEventListener('click',()=>{if(S.stage<9)setStage(S.stage+1);earn(2);});
    $('#resetProcessing').addEventListener('click',()=>setStage(0));setStage(S.stage);
  }
  function setStage(n) {
    S.stage=n;$('#cookedSpecimen').innerHTML=specimen(n,'cooked');
    $$('#stageTimeline button').forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===n));b.classList.toggle('is-done',i<n);});
    $('#stageName').textContent=n===0?'未经蒸晒':D.processing.stages[n-1].phase+' · 晒后';
    $('#stageDescription').textContent=n===0?'浅色切面与原始组织形态，是观察变化的起点。':D.processing.stages[n-1].desc+'（过程示意）';
    $('#stageCaption').textContent=n===0?'生品示意':n+'蒸示意';
    $('#advanceStage').disabled=n===9;$('#advanceStage').innerHTML=n===9?'九次循环已完成 ✓':'推进一蒸一晒 <span>→</span>';updateProcessingChart();
  }
  function processValues(n) {const dose=n*Math.exp((S.temp-100)/25)*S.hours/6;return [100*Math.exp(-.065*dose),85*(1-Math.exp(-.2*dose))*Math.exp(-.028*dose),100*(1-Math.exp(-.14*dose))];}
  function updateProcessingChart() {
    const points=Array.from({length:10},(_,i)=>processValues(i));
    plot($('#processingChart'),['原多糖','还原糖','褐变'].map((name,j)=>({name,color:['#60886b','#b99a54','#ad6f51'][j],values:points.map(p=>p[j])})),{xLabel:'蒸晒轮次',selected:S.stage,format:i=>`第 ${i} 轮`});
  }
  // Small, responsive SVG charts replace the 1 MB chart runtime; same renderer at all sizes.
  function plot(root,series,{xLabel='时间 / h',selected=0,format=i=>`${i} h`,maxX=null}={}) {
    const W=520,H=215,L=32,R=10,T=24,B=32,N=series[0].values.length,dx=(W-L-R)/(N-1),height=H-T-B;
    const x=i=>L+i*dx,y=v=>T+height*(1-v/100);
    root.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${series.map(s=>s.name).join('、')}相对趋势教学曲线"><text x="0" y="8" font-size="8">相对指数</text>${[0,50,100].map(v=>`<line class="grid-line" x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}"/><text x="${L-8}" y="${y(v)+3}" text-anchor="end">${v}</text>`).join('')}${Array.from({length:N},(_,i)=>i).filter(i=>i%Math.max(1,Math.floor((N-1)/6))===0||i===N-1).map(i=>`<text x="${x(i)}" y="${H-13}" text-anchor="middle">${maxX===null?i:(i/(N-1)*maxX).toFixed(0)}</text>`).join('')}${series.map((s,j)=>`<polyline class="plot-line" data-series="${j}" style="--c:${s.color}" points="${s.values.map((v,i)=>x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ')}"/>`).join('')}<line class="chart-marker" x1="${x(selected)}" x2="${x(selected)}" y1="${T}" y2="${H-B}"/><text x="${W-R}" y="${H}" text-anchor="end" font-size="8">${xLabel}</text><rect class="chart-interaction" x="${L}" y="${T}" width="${W-L-R}" height="${height}"/></svg><div class="chart-tooltip" hidden></div>`;
    const hit=$('.chart-interaction',root),tip=$('.chart-tooltip',root),marker=$('.chart-marker',root);
    function inspect(e) {const b=$('svg',root).getBoundingClientRect();const i=clamp(Math.round(((e.clientX-b.left)/b.width*W-L)/dx),0,N-1);marker.setAttribute('x1',x(i));marker.setAttribute('x2',x(i));tip.hidden=false;tip.style.left=clamp(x(i)/W*100,20,80)+'%';tip.style.top='30%';tip.innerHTML=esc(format(i))+'<br>'+series.map(s=>`${esc(s.name)} ${Math.round(s.values[i])}`).join(' · ');}
    hit.addEventListener('pointermove',inspect);hit.addEventListener('pointerdown',inspect);hit.addEventListener('pointerleave',()=>tip.hidden=true);
  }

  function apparatus() {
    return `<svg class="apparatus-svg" viewBox="0 0 720 385" role="img" aria-label="水蒸气蒸馏示意：左侧加热烧瓶，经导管进入中间斜置冷凝管，右侧收集器内油水分层。冷却水下进上出。"><defs><linearGradient id="waterFill" x2="0" y2="1"><stop stop-color="#aebf85"/><stop offset="1" stop-color="#789d71"/></linearGradient><linearGradient id="glassShine"><stop stop-color="#fff" stop-opacity=".65"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".6"/></linearGradient></defs><path d="M55 342h610" stroke="#bdcbb3"/><g stroke="#b6c1ae" fill="none"><path d="M243 337V88m-25 249h51M483 337V133m-24 204h49" stroke-width="4"/><path d="M228 153h39m200 31h33" stroke-width="3"/></g><path class="glass" d="M144 78h28v96a76 76 0 1 1-28 0Z"/><path d="M96 235a65 65 0 0 0 124 0Z" fill="url(#waterFill)"/><ellipse cx="158" cy="235" rx="62" ry="12" fill="#c3d3a0"/><path d="M123 253q25 15 63 0m-53 15q30 12 47 0" fill="none" stroke="#7d9e73" opacity=".7"/><circle class="bubble" cx="143" cy="258" r="4"/><circle class="bubble" cx="175" cy="268" r="3" style="animation-delay:-.8s"/><g><path class="steam-line" d="M148 220q-8-13 0-24t0-22"/><path class="steam-line" d="M166 219q8-13 0-24t0-21" style="animation-delay:-1s"/></g><path class="glass" d="M150 80V55h106l294 164v49h-11v-41L252 65h-90v15Z"/><g transform="translate(298 75) rotate(29)"><rect width="236" height="56" rx="12" fill="#bbd9cb66" stroke="#6d9b8d" stroke-width="2"/><path d="M4 18h228M4 38h228" stroke="#fff" stroke-opacity=".6" stroke-width="2"/><path d="M30 0v-28M204 56v28" stroke="#82a5a0" stroke-width="9"/><path class="cool-path" d="M204 83V44H30V-28"/></g><path class="flow-path" id="vaporFlow" d="M157 169V61h98l290 162v51"/><path class="glass" d="M519 274h51v65h-51z"/><path d="M521 310h47v27h-47Z" fill="#bfdbce"/><path id="oilLayer" d="M521 304h47v6h-47Z" fill="#c5ad62"/><path d="M551 280v18" stroke="#b9a15f" stroke-width="2" stroke-dasharray="3 5"/><g id="heatFlames" fill="#c78f58"><path d="M133 321c-13-14 8-17 4-31 16 14 4 21 12 30Z"/><path d="M158 324c-12-16 10-18 5-36 19 16 0 25 8 35Z"/><path d="M180 321c-10-12 9-15 5-26 14 14 3 17 8 25Z"/></g><path d="M109 331h100v8H109z" fill="#769078"/><text x="124" y="367">加热与汽化</text><text x="356" y="104" transform="rotate(29 356 104)">冷凝水套</text><text x="359" y="66" font-size="9">冷却水出 ↗</text><text x="458" y="268" font-size="9">↖ 冷却水入</text><text x="590" y="310">油相</text><text x="590" y="333">水相</text><path d="M570 306h13m-13 22h13" stroke="#9bab8e"/><text x="295" y="324" font-size="9">蒸汽携香 → 冷凝 → 油水分离</text></svg>`;
  }
  const apparatusNotes=['水蒸气与挥发油共同贡献蒸气压，达到外界压力时沸腾。这里的箭头只表现输运方向。','冷却水从冷凝管较低端进入、较高端流出，充满水套；热蒸汽在内管中冷凝。','馏出液中的油水因不相溶而分层。这里以轻油为例，油层在上，密度不同的油分层方向会不同。'];
  function buildDistillation(el) {
    el.innerHTML=header(3,'FOLLOW A DROP OF AROMA','借一缕水汽，<em>留一味草木香。</em>','从薄荷叶中的挥发性成分，到收集器里的一滴芳香。调节热输入与冷却能力，观察它们如何协作。')+`<div class="distillation-layout"><div><div class="apparatus-panel" id="apparatusPanel"><div class="section-caption"><span>水蒸气蒸馏 / 可交互装置</span><small>AN AROMATIC JOURNEY</small></div>${apparatus()}<div class="apparatus-hotspots">${['汽化携香','冷却成滴','油水分层'].map((s,i)=>`<button data-hotspot="${i}" aria-pressed="${i===0}"><small>${pad(i+1)}</small>${s} <span>+</span></button>`).join('')}</div><p class="apparatus-explanation" id="apparatusExplanation">${apparatusNotes[0]}</p></div><div class="distill-bottom"><div class="metric"><small>蒸汽输运 / 示意指数</small><strong id="vaporMetric"></strong><p>热输入改变输运节奏</p></div><div class="metric"><small>冷凝能力 / 示意指数</small><strong id="coolMetric"></strong><p>冷却条件影响冷凝过程</p></div><div class="metric"><small>捕集趋势 / 示意指数</small><strong id="captureMetric"></strong><p>热量与冷却需要匹配</p></div></div></div><aside class="distill-controls"><div class="split-heading"><h3>香气实验室</h3><span class="pill">非实测模型</span></div><div class="segmented" id="distillMaterials">${D.distillation.materials.map((m,i)=>`<button data-material="${i}" aria-pressed="${i===0}">${esc(m.name)}</button>`).join('')}</div><p class="micro-note" id="materialComponents" style="margin-top:10px"></p>${range('distillPower','热输入强度',S.power,0,100,'%')}${range('distillCooling','冷却能力',S.cooling,0,100,'%')}<div class="status" id="distillWarning" aria-live="polite"><i></i><span></span></div><button id="distillToggle" class="outline-button">暂停观察 <span>Ⅱ</span></button><div class="archive-mini"><img src="assets/images/scenes/distill_room.webp" alt="历史蒸馏室馆藏图式" loading="lazy" width="95" height="65"><div><strong>古老工艺，现代解读</strong><p>历史蒸馏室 / Wellcome Collection<br>Public Domain Mark</p></div></div></aside></div>`+note('一滴香的原理','对互不相溶液体，总蒸气压可近似写为 P总 = P水 + P油。合适条件下，混合体系能在低于单独组分沸点的温度下沸腾。图中指数为归一化函数示意，不能预测真实产率、压力或设备安全性。');
    $('#distillMaterials').addEventListener('click',e=>{const b=e.target.closest('[data-material]');if(b){S.material=+b.dataset.material;updateDistillation();earn(3);}});
    bindRange('distillPower',v=>{S.power=v;updateDistillation();earn(3);});bindRange('distillCooling',v=>{S.cooling=v;updateDistillation();earn(3);});
    $('#distillToggle').addEventListener('click',()=>{S.running=!S.running;updateDistillation();earn(3);});
    $$('.apparatus-hotspots button').forEach((b,i)=>b.addEventListener('click',()=>{$$('.apparatus-hotspots button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#apparatusExplanation').textContent=apparatusNotes[i];earn(3);}));updateDistillation();
  }
  function updateDistillation() {
    const m=D.distillation.materials[S.material],hot=S.power>S.cooling+20;
    $$('#distillMaterials button').forEach((b,i)=>b.setAttribute('aria-pressed',String(S.material===i)));
    $('#materialComponents').textContent=m.name+' · 典型成分：'+m.components;
    $('#distillPowerValue').innerHTML=S.power+'<small>%</small>';$('#distillCoolingValue').innerHTML=S.cooling+'<small>%</small>';
    $('#vaporMetric').innerHTML=(S.running?S.power:0)+'<span>/ 100</span>';$('#coolMetric').innerHTML=S.cooling+'<span>/ 100</span>';$('#captureMetric').innerHTML=(S.running?Math.round(Math.min(S.power,S.cooling)*Math.min(1,(S.cooling+10)/(S.power||1))):0)+'<span>/ 100</span>';
    $('#distillWarning').classList.toggle('is-warning',hot&&S.running);
    $('#distillWarning span').textContent=!S.running?'已暂停：静看汽化、冷凝与分层。':S.power===0?'尚未加热：提高热输入，观察输运。':hot?'模型提示：冷凝能力不足，增加冷却或降低热输入。':'模型状态：热输入与冷凝能力处于匹配区间。';
    $('#distillToggle').innerHTML=S.running?'暂停观察 <span>Ⅱ</span>':'继续实验 <span>▷</span>';
    $('#vaporFlow').style.animationDuration=(3-S.power/50)+'s';$('#vaporFlow').style.opacity=S.running&&S.power>0?'1':'0';$('#heatFlames').style.opacity=S.running?S.power/100:0;
    $('#oilLayer').setAttribute('fill',S.material?'#b9a15f':'#c5bb7e');syncMotion();
  }

  function ingredientArt(h,i) {
    // Native SVG botanical miniatures keep the tea tray original and free of unlicensed search images.
    const colors=['#b6a986','#b2543e','#c58b43','#d0b57f','#9c4d38','#789264','#ded5b4','#a16a4d','#bcb69b','#c6ac5c'];
    const c=colors[i],leaves=h.part==='叶',flower=h.part==='花';
    return `<svg viewBox="0 0 64 48" role="img" aria-label="${esc(h.name)}材料示意" style="width:48px;height:35px;margin:0 auto 5px">${flower?Array.from({length:12},(_,j)=>`<ellipse cx="32" cy="24" rx="5" ry="15" transform="rotate(${j*30} 32 24)" fill="#ddd0a0" stroke="#bca96b" stroke-width=".6"/>`).join('')+'<circle cx="32" cy="24" r="7" fill="#bea05a"/>':leaves?`<path d="M10 36Q12 5 33 9 39 30 10 36M31 35Q35 9 55 5 62 31 31 35" fill="${c}"/><path d="M11 35 29 14m4 18L52 10" stroke="#c2d1a8" fill="none"/>`:Array.from({length:5},(_,j)=>`<ellipse cx="${16+(j%3)*14}" cy="${16+Math.floor(j/3)*16}" rx="${h.part==='果皮'?12:8}" ry="${h.part==='根'?5:10}" transform="rotate(${j*28-25} ${16+(j%3)*14} ${16+Math.floor(j/3)*16})" fill="${c}" stroke="#8a805b" stroke-width=".6"/><path d="m${15+(j%3)*14} ${13+Math.floor(j/3)*16} 2 8" stroke="#faf0cf" opacity=".35"/>`).join('')}</svg>`;
  }
  const timeNotes=[['夜深，宜安静','减少强光，给夜晚留出安静的空间。'],['夜静，万物息','规律的休息，是一天节律的一部分。'],['将晓，露未晞','清晨到来之前，夜色仍然深沉。'],['晨光，入新日','让自然光与晨间活动，成为一天的起点。'],['朝食，慢慢来','留一点时间吃早餐，感受食物本来的味道。'],['日升，心神定','在专注之间，记得起身、远眺与短暂休息。'],['日中，稍作歇','午间给自己一段短休，让节奏慢下来。'],['午后，步履轻','轻度活动与适时饮水，延续日间的节奏。'],['向晚，草木明','在傍晚前走一走，感受一天光线的变化。'],['日落，归于家','从忙碌走向舒缓，为晚间留一点余地。'],['入夜，灯渐暖','调暗环境灯光，慢慢从白昼过渡到夜晚。'],['夜宁，收心神','让睡前的活动趋于平静，建立自己的休息习惯。']];
  function buildRhythm(el) {
    el.classList.add('rhythm-scene');
    el.innerHTML=header(4,'A DAY IN THE RHYTHM OF NATURE','顺时而养，<em>与草木共一日。</em>','转动十二时辰，感受古人记录时间的方式。再到草木茶席，观察材料形态与香气浸出的关系。')+`<div class="rhythm-layout"><div><div class="time-exhibit"><div class="time-dial" id="timeDial"><div class="dial-landscape" id="dialLandscape"><svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="164" cy="58" r="16" id="dialSun" fill="#e0c585"/><path d="M0 154 63 97l69 70 35-33 73 56v50H0Z" fill="#a9bc95"/><path d="M0 185 43 148l57 49 62-33 78 41v35H0Z" fill="#85a17d"/><path d="M0 212q100-25 240 1v27H0Z" fill="#5b836d"/><path d="M51 212q104-15 138 28" fill="none" stroke="#c0d0ae" stroke-width="2"/></svg><div class="dial-center"><strong id="shichenName"></strong><small id="shichenTime"></small></div></div>${D.shichen.map((s,i)=>{const a=i*Math.PI/6-Math.PI/2;return `<button class="dial-node" data-time="${i}" style="--x:${Math.cos(a)*43}%;--y:${Math.sin(a)*43}%" aria-pressed="false" aria-label="${s.name}时 ${s.time}点">${s.name}<small>${String((23+i*2)%24).padStart(2,'0')}</small></button>`;}).join('')}</div><p class="day-night-label">点击时辰 · 也可在圆盘上拖动</p></div><div class="tea-pour"><div class="teacup" id="teaCup"><i class="cup-steam"></i><i class="cup-steam"></i></div><p>一盏草木<br>半日清闲</p></div></div><div class="rhythm-copy"><p class="eyebrow" id="timePeriod">MORNING / 晨光</p><h3 id="rhythmTitle"></h3><p class="rhythm-modern" id="rhythmModern"></p><p class="modern-boundary">十二时辰是传统计时方式，不等于人体器官按固定时段“排毒”的科学证据。</p><div class="tea-workshop"><div class="split-heading"><h3>一席草木，试着调配</h3><span class="pill" id="teaCount">已选 0 / 3</span></div><p class="micro-note">选择至多三味，观察香气与材料形态。材料均为原创示意。</p><div class="tea-tray" id="teaTray">${D.teaHerbs.map((h,i)=>`<button class="tea-ingredient" data-tea="${h.id}" aria-pressed="false" aria-label="选择${esc(h.name)}">${ingredientArt(h,i)}<strong>${esc(h.name)}</strong><small>${esc(h.part)} · ${esc(h.flavor)}味</small></button>`).join('')}</div><div class="tea-bottom"><p id="teaSelected">从草木中选一味，开启一次香气观察。</p><button class="outline-button" id="brewTea" disabled>注水，观香 <span>↗</span></button></div><div class="tea-result" id="teaResult" hidden aria-live="polite"></div></div></div></div>`+note('一盏茶的边界','这里讨论的是材料形态与浸出方式，不评价配伍功效，不提供个体饮用建议。药用材料不当然适合日常食用；模拟茶席仅供观察与认识本草。');
    $('#timeDial').addEventListener('click',e=>{const b=e.target.closest('[data-time]');if(b){setTime(+b.dataset.time);earn(4);}});
    let drag=false;
    const setPointer=e=>{const b=$('#timeDial').getBoundingClientRect();let a=Math.atan2(e.clientY-b.top-b.height/2,e.clientX-b.left-b.width/2)*180/Math.PI+90;setTime((Math.round((a+360)%360/30))%12);};
    $('#timeDial').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;drag=true;$('#timeDial').setPointerCapture(e.pointerId);setPointer(e);});
    $('#timeDial').addEventListener('pointermove',e=>{if(drag){setPointer(e);earn(4);}});['pointerup','pointercancel'].forEach(n=>$('#timeDial').addEventListener(n,()=>drag=false));
    $('#teaTray').addEventListener('click',e=>{const b=e.target.closest('[data-tea]');if(!b)return;const id=b.dataset.tea;if(S.tea.includes(id))S.tea=S.tea.filter(x=>x!==id);else if(S.tea.length<3)S.tea.push(id);else return toast('茶席最多三味，请先点选移除一味。');updateTea();earn(4);});
    $('#brewTea').addEventListener('click',brewTea);setTime(S.time);updateTea();
  }
  function setTime(n) {
    S.time=n;const t=D.shichen[n],night=n<3||n>9;
    $$('.dial-node').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===n)));
    $('#shichenName').textContent=t.name+'时';$('#shichenTime').textContent=t.time+' 时';
    $('#timePeriod').textContent=night?'NIGHT / 月色入林':n<6?'MORNING / 晨光入林':n<9?'AFTERNOON / 日光有序':'EVENING / 暮色渐起';
    $('#rhythmTitle').textContent=timeNotes[n][0];$('#rhythmModern').textContent=timeNotes[n][1];
    $('#dialLandscape').style.background=night?'#bacbbc':'#d6dfc0';$('#dialSun').setAttribute('fill',night?'#eff0d8':'#e0c585');$('#dialSun').setAttribute('cx',String(60+(n*13)%120));
  }
  function updateTea() {
    $$('#teaTray button').forEach(b=>b.setAttribute('aria-pressed',String(S.tea.includes(b.dataset.tea))));
    $('#teaCount').textContent=`已选 ${S.tea.length} / 3`;$('#teaSelected').textContent=S.tea.length?S.tea.map(id=>D.teaHerbs.find(h=>h.id===id).name).join(' · '):'从草木中选一味，开启一次香气观察。';$('#brewTea').disabled=!S.tea.length;$('#teaResult').hidden=true;$('#teaCup').classList.remove('is-brewed');
  }
  function brewTea() {
    const hs=S.tea.map(id=>D.teaHerbs.find(h=>h.id===id));const light=hs.filter(h=>['叶','花','果皮'].includes(h.part));const dense=hs.filter(h=>['根','根茎','鳞茎','菌核'].includes(h.part));
    const text=light.length&&dense.length?'薄叶、花与厚实材料同席：挥发与浸出速度不同，观察时需要分别理解它们的变化。':light.length?'花、叶与果皮的香气容易随热气逸散。短时、加盖的浸润与长时间沸煮，会带来不同的香气体验。':'较厚实的材料，内部成分迁移往往需要更长时间；不能用出汤颜色推断成分已经充分释放。';
    $('#teaResult').hidden=false;$('#teaResult').innerHTML='<strong>草木入水，香气有别。</strong><p style="margin-top:7px">'+text+'</p><p style="margin-top:6px;font-size:9px">'+hs.map(h=>esc(h.name)+'：'+esc(h.note)).join('<br>')+'</p>';$('#teaCup').classList.add('is-brewed');earn(4);
  }

  function vessel(i) {
    const svg=[`<path d="M42 62q8 75 78 75t78-75Z" fill="currentColor"/><ellipse cx="120" cy="62" rx="78" ry="21" fill="#bbc6a4" stroke="currentColor" stroke-width="3"/><ellipse cx="120" cy="63" rx="68" ry="15" fill="#a29258"/><path d="M78 138h84" stroke="currentColor" stroke-width="5"/><path d="M94 35q-14-15 0-29m25 25q-14-15 0-29m24 33q-14-15 0-29" stroke="currentColor" stroke-width="1.5" fill="none" opacity=".5"/>`, `<path d="M43 124h154l-47 16H84Z" fill="currentColor" opacity=".65"/><path d="m65 123 48-71 54 71Z" fill="#ccb08a"/><path d="m86 123 28-70 24 70" fill="#e2c9a4"/><g fill="currentColor">${Array.from({length:12},(_,j)=>`<circle cx="${74+(j*29)%92}" cy="${96+(j*13)%29}" r="1.5"/>`).join('')}</g><path d="m157 69 34-42 10 9-34 40Z" fill="currentColor"/>`, `<ellipse cx="120" cy="128" rx="85" ry="19" fill="#cdd1bc"/>${[[69,101,18],[111,109,21],[151,100,19],[91,72,20],[135,67,18],[120,37,17]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor"/><path d="M${x-r*.5} ${y-r*.2}q-3-${r*.4} ${r*.5}-${r*.5}" stroke="#d3d9b5" fill="none" stroke-width="2" opacity=".6"/>`).join('')}`, `<path d="M71 44h98l10 18v67q-59 21-118 0V62Z" fill="currentColor"/><ellipse cx="120" cy="130" rx="59" ry="15" fill="currentColor"/><path d="M75 40v-8h90v8" fill="#6c634c"/><ellipse cx="120" cy="34" rx="45" ry="10" fill="#aa8b69"/><rect x="88" y="68" width="64" height="48" fill="#e4d6b9"/><path d="M112 83h17m-17 9h17m-17 9h17" stroke="#9c7152" stroke-width="1.5"/>`];
    return `<svg class="vessel-svg" viewBox="0 0 240 155" aria-hidden="true">${svg[i]}</svg>`;
  }
  const formColors=['#587d68','#b69b6a','#8c6f58','#a1ae85'];
  function buildForms(el) {
    el.classList.add('forms-scene');
    el.innerHTML=header(5,'SAME BOTANICALS, DIFFERENT FORMS','本草有方，<em>成形有理。</em>','汤、散、丸、膏，改变的不只是样子。点击一种剂型，看看分散、溶胀与扩散，如何改变释放过程。')+`<div class="form-selector" id="formSelector">${D.forms.map((f,i)=>`<button class="form-card" data-form="${i}" aria-pressed="false"><span class="form-number">FORM / ${pad(i+1)}</span><span class="card-arrow">↗</span>${vessel(i)}<h3>${esc(f.name)}</h3><p>${esc(f.sub)}</p></button>`).join('')}</div><div class="forms-detail"><div class="forms-description" id="formDescription"></div><div class="forms-chart-panel"><div class="section-caption"><span>四种剂型的释放过程</span><small>SCHEMATIC COMPARISON</small></div><div class="legend">${D.forms.map((f,i)=>`<span><i style="--c:${formColors[i]}"></i>${esc(f.name)}</span>`).join('')}</div><div class="chart" id="doseChart"></div>${range('releaseTime','沿时间，追踪释放',S.releaseTime,0,7,'h',.1)}<p class="micro-note">当前选中剂型：<span id="releaseName"></span> · 示意释放 <b id="releaseValue" class="release-value"></b><br>曲线来自原作品的教学数据，不是体内药代动力学，也不等同于真实起效时间。</p></div></div>`+note('剂型与科学','粉碎改变比表面积，丸体基质影响水分进入和成分扩散，黏稠基质可改变溶蚀过程。具体释放受处方、工艺与测定条件影响，不能把传统剂型名称直接等同于现代缓控释质量标准。');
    $('#formSelector').addEventListener('click',e=>{const b=e.target.closest('[data-form]');if(b){selectForm(+b.dataset.form);earn(5);}});
    bindRange('releaseTime',v=>{S.releaseTime=v;updateRelease();earn(5);});
    plot($('#doseChart'),D.forms.map((f,i)=>({name:f.name,color:formColors[i],values:f.curve})),{selected:3});selectForm(S.form);
  }
  function selectForm(n) {
    S.form=n;const f=D.forms[n];$$('#formSelector button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===n)));
    const descriptions=['药材加水煎煮后，成分以溶液、胶体与混悬等形式进入汤液。这里重点观察液态剂型无需经过完整丸体的崩解过程。',D.forms[1].desc,D.forms[2].desc,'煎液浓缩后以糖、蜜等收膏，形成半固体。黏度与基质溶蚀会影响成分释放；本图只演示这一物理过程。'];
    $('#formDescription').innerHTML=`<p class="eyebrow">${esc(f.motto)} / FORM ${pad(n+1)}</p><h3>${['以水为媒，先见分散。','化整为细，表面有文章。','基质成丸，徐徐释放。','收浓成膏，缓慢溶蚀。'][n]}</h3><p>${esc(descriptions[n])}</p><div class="tags"><span class="tag">${['液态分散','颗粒分散','吸水与溶胀','基质溶蚀'][n]}</span><span class="tag">${['水为介质','比表面积','扩散路径','黏度变化'][n]}</span></div><p class="form-caution">${esc(f.detail)}</p>`;
    $$('#doseChart .plot-line').forEach((line,i)=>line.classList.toggle('is-muted',i!==n));updateRelease();
  }
  function updateRelease() {
    const t=S.releaseTime,k=Math.floor(t),f=D.forms[S.form],v=f.curve[k]+(f.curve[Math.min(k+1,7)]-f.curve[k])*(t-k);
    $('#releaseTimeValue').innerHTML=t.toFixed(1)+'<small>h</small>';$('#releaseName').textContent=f.name;$('#releaseValue').textContent=Math.round(v)+'%';
    const marker=$('#doseChart .chart-marker'),x=32+t/7*(520-42);marker.setAttribute('x1',x);marker.setAttribute('x2',x);
  }

  function refreshSeals() {
    if(!$('#passportSeals'))return;
    $('#passportSeals').innerHTML=['识草','观火','留香','顺时','辨形','格物'].map((s,i)=>`<span class="${S.earned.includes(i+1)?'is-earned':''}" aria-label="${s}${S.earned.includes(i+1)?'已获得':'未获得'}">${s[0]}<br>${s[1]}</span>`).join('');
  }
  function buildTrial(el) {
    el.classList.add('trial-scene');
    el.innerHTML=`<div class="trial-layout"><aside class="trial-intro"><p class="eyebrow"><span class="chapter-id">卷 陆 / 06</span>THE BOTANICAL CHALLENGE</p><h2>行过本草，<em>知其所以。</em></h2><p>六道小题，把刚刚的观察变成自己的理解。答错也没关系，答案背后的“为什么”，才是本次格物的收获。</p><div class="trial-art"><img src="assets/images/archive/juhua-lite.webp" alt="本草原始菊花古籍图，Wellcome Collection" loading="lazy"><blockquote>格物而后知至<br>草木皆有回响</blockquote></div><div class="passport-seals" id="passportSeals" aria-label="本草观展印记"></div><p class="micro-note">亲手体验各章，留下六枚观展印记。<br>完成试炼后，可领取专属的格物文牒。</p></aside><div class="quiz-panel" id="quizPanel" aria-live="polite"></div></div>`;
    refreshSeals();if(S.answers.length===D.quiz.length)finishQuiz();else renderQuestion();
  }
  function renderQuestion() {
    const n=S.question,q=D.quiz[n],answered=S.answers.length>n;
    $('#quizPanel').innerHTML=`<div class="quiz-topline"><span>杏林试炼 / 六问本草</span><span class="quiz-counter">${pad(n+1)} <small>/ 06</small></span></div><div class="quiz-progress">${D.quiz.map((_,i)=>`<i class="${i<n?'is-done':i===n?'is-current':''}"></i>`).join('')}</div><span class="quiz-tag">${esc(q.tag)} / QUESTION ${pad(n+1)}</span><p class="quiz-scene">${esc(q.scene)}</p><h3 class="quiz-question">${esc(q.q)}</h3><div class="quiz-options">${q.options.map((o,i)=>`<button class="quiz-option" data-answer="${i}"><span>${'ABC'[i]}</span><strong>${esc(o)}</strong></button>`).join('')}</div><div id="quizFeedback" class="quiz-feedback" hidden></div><button id="quizNext" class="primary-button quiz-next" hidden>${n===5?'完成试炼，领取文牒':'明白了，下一问'} <span>→</span></button>`;
    $$('.quiz-option').forEach(b=>b.addEventListener('click',()=>answerQuestion(+b.dataset.answer)));
    $('#quizNext').addEventListener('click',()=>{if(n===5)finishQuiz();else {S.question++;renderQuestion();$('#quizPanel').scrollIntoView({block:'nearest'});}});
    if(answered)showAnswer(S.answers[n]);
  }
  function answerQuestion(n) {if(S.answers.length>S.question)return;S.answers.push(n);save();showAnswer(n);}
  function showAnswer(n) {
    const q=D.quiz[S.question],right=n===q.answer;
    $$('.quiz-option').forEach((b,i)=>{b.disabled=true;b.classList.toggle('is-correct',i===q.answer);b.classList.toggle('is-wrong',i===n&&!right);});
    $('#quizFeedback').hidden=false;$('#quizFeedback').innerHTML=`<strong>${right?'答对了，知其所以。':'这次观察，再近一步。正确答案：'+ 'ABC'[q.answer]}</strong>${esc(q.explain)}`;$('#quizNext').hidden=false;
  }
  function finishQuiz() {
    const correct=S.answers.filter((x,i)=>x===D.quiz[i].answer).length;earn(6);
    const wrong=D.quiz.map((q,i)=>({q,i})).filter(({q,i})=>S.answers[i]!==q.answer);
    $('#quizPanel').innerHTML=`<div class="quiz-result"><p class="eyebrow">A LITTLE KNOWLEDGE, A NEW PERSPECTIVE</p><h3>${correct>=5?'杏林格物，学有所获。':'一路探索，每步有所得。'}</h3><div class="result-score">${correct}<small> / 6 题答对</small></div><p>你已完成本次本草试炼。愿你带走的，不只是答案，<br>还有面对一草一木时，多问一句“为什么”的好奇心。</p>${wrong.length?`<details class="result-review"><summary>回看 ${wrong.length} 道题的解析</summary>${wrong.map(({q,i})=>`<p><b>${pad(i+1)} / ${esc(q.tag)}</b><br>${esc(q.q)}<br>正确答案：${esc(q.options[q.answer])}<br>${esc(q.explain)}</p>`).join('')}</details>`:''}<label class="certificate-name" for="certificateName">文牒上的称呼（选填）<input id="certificateName" maxlength="12" placeholder="本草探索者" autocomplete="off"></label><div class="certificate-actions"><button class="primary-button" id="downloadCertificate">生成并下载格物文牒 ${icon('arrow')}</button><button class="retry-button" id="retryQuiz">再试一次</button></div><img id="certificatePreview" class="certificate-preview" hidden alt="专属本草格物文牒预览"></div>`;
    $('#downloadCertificate').addEventListener('click',downloadCertificate);$('#retryQuiz').addEventListener('click',()=>{S.answers=[];S.question=0;save();renderQuestion();});
  }
  async function downloadCertificate() {
    const button=$('#downloadCertificate');if(button.disabled)return;button.disabled=true;
    try {
      await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1500))]);
      const c=document.createElement('canvas');c.width=1600;c.height=1000;const ctx=c.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
      const serif='ExhibitionSerif, SimSun, serif';ctx.fillStyle='#f4f1e3';ctx.fillRect(0,0,1600,1000);ctx.strokeStyle='#8b9c7b';ctx.lineWidth=2;ctx.strokeRect(42,42,1516,916);ctx.strokeStyle='#c2cbb4';ctx.strokeRect(54,54,1492,892);
      ctx.fillStyle='#1e493d';ctx.fillRect(80,80,1440,130);ctx.fillStyle='#f4f0dc';ctx.textAlign='center';ctx.font='42px '+serif;ctx.fillText('明医格物 · 本草探索文牒',800,161);ctx.fillStyle='#8b997d';ctx.font='16px sans-serif';ctx.fillText('MATERIA MEDICA / CERTIFICATE OF EXPLORATION',800,263);
      const name=($('#certificateName').value.trim()||'本草探索者').slice(0,12);const correct=S.answers.filter((x,i)=>x===D.quiz[i].answer).length;
      ctx.fillStyle='#214b3f';ctx.font='64px '+serif;ctx.fillText(name,800,383);ctx.font='28px '+serif;ctx.fillText('行过本草，知其所以。',800,465);ctx.fillStyle='#7c8a70';ctx.font='22px '+serif;ctx.fillText(`完成六问本草试炼 · 答对 ${correct} / 6 题`,800,526);
      ['识草','观火','留香','顺时','辨形','格物'].forEach((v,i)=>{const x=375+i*150,yes=S.earned.includes(i+1);ctx.save();ctx.translate(x,650);ctx.rotate((i%2?3:-3)*Math.PI/180);ctx.strokeStyle=yes?'#ac543d':'#bcc5af';ctx.lineWidth=2;ctx.strokeRect(-39,-47,78,94);ctx.strokeRect(-34,-42,68,84);ctx.fillStyle=yes?'#ac543d':'#bcc5af';ctx.font='29px '+serif;ctx.fillText(v[0],0,-7);ctx.fillText(v[1],0,28);ctx.restore();});
      ctx.fillStyle='#859275';ctx.font='18px '+serif;ctx.fillText('循古籍之文，问草木之性。保持好奇，让本草的故事继续。',800,805);ctx.font='14px sans-serif';ctx.fillText('2026“守创杯”中医药科普创新创意大赛参赛作品 · 守千年本草 创智慧新生',800,887);ctx.font='11px sans-serif';ctx.fillText('互动科普纪念文牒 / 不属于职业、医疗或学历资格证明',800,919);
      const url=c.toDataURL('image/png');$('#certificatePreview').src=url;$('#certificatePreview').hidden=false;const a=document.createElement('a');a.href=url;a.download='明医格物-本草探索文牒.png';a.click();toast('格物文牒已生成，可在下方预览与保存。');
    } catch(error) {toast('文牒生成失败，请用较新版本的 Chrome 或 Edge 重试。');window.__APP_ERRORS__.push(String(error));} finally {button.disabled=false;}
  }

  function buildSources(el) {
    el.innerHTML=`<div class="epilogue-layout"><div class="epilogue-title"><p class="eyebrow">THE EXHIBITION, AND ITS ROOTS</p><h2>本草有据，<em>格物有源。</em></h2><p>以古籍为起点，以观察为方法。<br>让传统知识与现代科学，在可操作的展览里相遇。</p><div class="source-thumbs"><figure><img src="assets/images/archive/shanjiang.webp" alt="山姜古籍图" loading="lazy"><figcaption>山姜 / 本草品汇精要</figcaption></figure><figure><img src="assets/images/archive/juhua-lite.webp" alt="菊花古籍图" loading="lazy"><figcaption>菊花 / 本草原始</figcaption></figure></div><div class="competition-credit">2026“守创杯”中医药科普创新创意大赛参赛作品<br>守千年本草 · 创智慧新生</div><a href="#prologue" class="text-button" style="margin-top:20px">再入本草 <span>↗</span></a></div><div class="source-list"><section><h3>古籍与科学参考</h3><p>医家故事与引文沿用原作品所引《史记》《后汉书》《伤寒杂病论》《备急千金要方》《本草纲目》。植物性味等内容沿用原项目数据；古籍引文未在本次界面改版中重新逐字校勘。</p><ul><li>美拉德反应：Hodge, J. E. (1953), Chemistry of Browning Reactions in Model Systems. <a href="https://doi.org/10.1021/jf60015a004" target="_blank" rel="noopener noreferrer">DOI: 10.1021/jf60015a004</a></li><li>水蒸气蒸馏：<a href="https://chem.libretexts.org/Courses/Sewanee%3A_The_University_of_the_South/Organic_Chemistry_Lab_Textbook/11%3A_Distillation/11.03%3A_Steam_Distillation/11.3C%3A_Separation_Theory" target="_blank" rel="noopener noreferrer">Chemistry LibreTexts · Steam Distillation</a></li></ul><p>本草指纹与剂型曲线均为原项目教学示意数据；炮制、蒸馏指数为简化数学函数，不是实测数据。不据此判断疗效、安全性或工艺合格。</p></section><section><h3>馆藏素材与署名</h3><ul><li>山姜：Wang Shichang et al., Chinese Materia Medica illustration, Ming. Wellcome Collection, L0039307. <a href="https://commons.wikimedia.org/wiki/File:Chinese_Materia_Medica_illustration,_Ming;_Alpinia_japonica_Wellcome_L0039307.jpg" target="_blank" rel="noopener noreferrer">原始条目</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>。首页使用裁切、缩放后的局部。</li><li>菊花：Chinese Materia medica, C17; Plant drugs, Chrysanthemum. Wellcome Collection, L0039340. <a href="https://commons.wikimedia.org/wiki/File:Chinese_Materia_medica,_C17;_Plant_drugs,_Chrysanthemum_Wellcome_L0039340.jpg" target="_blank" rel="noopener noreferrer">原始条目</a> · CC BY 4.0。使用缩放版本。</li><li>医家画像、蒸馏室与八味本草影像沿用原项目；植物摄影保留原 CC BY / CC BY-NC 限制。逐图作者、原图链接见 <a href="assets/素材来源与许可.md" target="_blank" rel="noopener noreferrer">本地素材许可表</a>。</li></ul><p>炮制切片、蒸馏装置、茶席材料、山水与剂型器物为本次原创 SVG / CSS 图形。新版不再使用旧版来源不清的炮制、茶席网络实拍图。字体：Noto Serif SC / SIL OFL 1.1。</p></section><section><h3>策展参考与使用说明</h3><p>展陈叙事参考 <a href="https://howdy-creative.co/cases/lifu-museum-traditional-chinese-medicine-beauty-exhibition/" target="_blank" rel="noopener noreferrer">立夫中医药博物馆展览设计案例 / 好心地文创</a> 的主题分区与互动阅读方式，未使用其设计图或现场摄影。</p><p>本作品用于中医药文化科普与教学仿真，不构成诊疗、用药或炮制生产建议。所有运行素材均已本地化；以上外部链接仅供查阅出处，打开链接时需要联网。</p></section></div></div>`;
  }

  function initSound() {
    let ctx,master,timer,on=false;
    const tones=[146.83,164.81,196,220,261.63];
    function play() {if(!on||document.hidden)return;const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;osc.type='sine';osc.frequency.value=tones[Math.floor(Math.random()*tones.length)];gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.08,now+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+2.8);osc.connect(gain);gain.connect(master);osc.start(now);osc.stop(now+3);timer=setTimeout(play,3600);}
    $('#soundToggle').addEventListener('click',async()=>{try{if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return toast('当前浏览器暂不支持环境音。');ctx=new AC();master=ctx.createGain();master.gain.value=.2;master.connect(ctx.destination);}on=!on;clearTimeout(timer);if(on){await ctx.resume();play();}else await ctx.suspend();$('#soundToggle').setAttribute('aria-pressed',String(on));$('#soundToggle').setAttribute('aria-label',on?'关闭环境音':'开启环境音');}catch(_){on=false;toast('环境音未能开启，请再次点击重试。');}});
    document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!ctx||!on)return;if(document.hidden)ctx.suspend();else ctx.resume().then(play).catch(()=>{});});
  }
  function init() {
    $('#chapterDirectory').innerHTML=ids.slice(1,7).map((id,i)=>`<a href="#${id}"><small>${pad(i+1)}</small><span>${labels[i+1]}</span></a>`).join('');
    document.addEventListener('click',e=>{
      const close=e.target.closest('[data-close]');if(close){$('#'+close.dataset.close).close();return;}
      const a=e.target.closest('a[href^="#"]');if(a&&ids.includes(a.hash.slice(1))){e.preventDefault();goScene(a.hash.slice(1));}
    });
    $('#guideOpen').addEventListener('click',guide);$('#sourceOpen').addEventListener('click',()=>goScene(7));
    $('#guideDialog').addEventListener('click',e=>{if(e.target===$('#guideDialog')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close();}});
    $('#deckPrev').addEventListener('click',()=>goScene(S.scene-1));$('#deckNext').addEventListener('click',()=>goScene(S.scene+1));
    document.addEventListener('keydown',e=>{
      if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||$('#guideDialog').open)return;
      if(e.key==='Escape'&&S.scene===0){flipDoctor(false);return;}
      if(e.target.closest('input,textarea,select'))return;
      if(e.target.closest('button,[role="button"],.doctor-scroll')&& !['PageDown','PageUp'].includes(e.key))return;
      if(e.key==='PageDown'){e.preventDefault();goScene(S.scene+1);}else if(e.key==='PageUp'){e.preventDefault();goScene(S.scene-1);}
      else if(S.scene===0&&e.key==='ArrowRight'){e.preventDefault();changeDoctor(S.doctor+1);}else if(S.scene===0&&e.key==='ArrowLeft'){e.preventDefault();changeDoctor(S.doctor-1);}
      else if(e.key==='Home'){e.preventDefault();goScene(0);}
    });
    let touch;
    $('#main').addEventListener('touchstart',e=>{if(e.touches.length!==1||e.target.closest('button,input,.scroll-gallery,.time-dial,.chart')){touch=null;return;}touch={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};},{passive:true});
    $('#main').addEventListener('touchend',e=>{if(!touch||!e.changedTouches.length)return;const d=e.changedTouches[0],dx=d.clientX-touch.x,dy=d.clientY-touch.y;if(Math.abs(dx)>80&&Math.abs(dx)>Math.abs(dy)*1.5&&Date.now()-touch.t<700)goScene(S.scene+(dx<0?1:-1));touch=null;},{passive:true});
    window.addEventListener('popstate',()=>goScene(location.hash.slice(1)||0,{silent:true}));
    let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(updateGallery,100);});document.addEventListener('visibilitychange',syncMotion);
    buildDoctors();initSound();
    const hash=location.hash.slice(1);if(ids.includes(hash))goScene(hash,{silent:true,instant:true});
    window.__APP_READY__=true;
    window.__TCM_DEMO__={goScene,currentScene:()=>ids[S.scene],selectHerb:n=>{goScene(1,{silent:true});selectHerb(n);},setProcessing:(temp,hours,stage)=>{goScene(2,{silent:true});S.temp=clamp(temp,85,100);S.hours=clamp(hours,1,8);$('#procTemp').value=S.temp;$('#procTemp').dispatchEvent(new Event('input'));$('#procHours').value=S.hours;$('#procHours').dispatchEvent(new Event('input'));setStage(stage);},state:()=>structuredClone(S)};
  }
  init();
})();
