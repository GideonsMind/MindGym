/* ========================
   MindGym – app.js
   ======================== */

/** ---------- Helpers ---------- **/
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const choice = arr => arr[Math.floor(Math.random() * arr.length)];
const now = () => performance.now();

const store = {
  get(k, v) { try { return JSON.parse(localStorage.getItem(k)) ?? v; } catch { return v; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

/** ---------- Elements (with fallbacks) ---------- **/
const els = {
  level:   $('#level') || $('[data-stat="level"]'),
  xp:      $('#xp')    || $('[data-stat="xp"]'),
  streak:  $('#streak')|| $('[data-stat="streak"]'),
  settingsBtn: $('#settingsBtn') || $$('button, .btn').find(b => /settings/i.test(b?.textContent||'')),
  settingsDlg: $('#settingsDialog') || document.createElement('dialog'),
  themeSel:  $('#themeSelect'),
  hapticsChk: $('#hapticsToggle'),
  soundsChk:  $('#soundsToggle'),
  fpsSel:     $('#fpsSelect'),
  resetBtn:   $('#resetBtn'),

  modulesGrid: $('#modules') || $('.grid'),
  // cards must have data-module="focus|hunt|span|nback"
  modCards: $$('[data-module]'),

  // Active panel
  panel: $('.module-panel') || $('.card.module-panel'),
  howBtn: $('#howBtn') || $$('button').find(b => /how\?/i.test(b.textContent||'')),
  exitBtn: $('#exitBtn') || $$('button').find(b => /exit/i.test(b.textContent||'')),
  startBtn: $('#startBtn') || $$('button').find(b => /^start$/i.test(b.textContent||'')),
  stopBtn:  $('#stopBtn')  || $$('button').find(b => /^stop$/i.test(b.textContent||'')),
  scoreLbl: $('#score')    || $('[data-score]'),
  bestLbl:  $('#best')     || $('[data-best]'),

  canvas:  $('#gameCanvas') || (()=>{ const c=document.createElement('canvas'); c.id='gameCanvas'; ($('.stage-wrap')||document.body).appendChild(c); return c; })(),
  stageWrap: $('.stage-wrap') || document.body,
  howDetails: $('#howDetails') || $('.how')
};

// Ensure a settings dialog exists if HTML didn’t provide one
if (!document.querySelector('dialog')) {
  const dlg = els.settingsDlg;
  dlg.innerHTML = `
    <form method="dialog" class="settings card">
      <h3>Settings</h3>
      <div class="row"><div>Theme</div>
        <select id="themeSelect">
          <option>light</option><option>dark</option><option>oled</option>
          <option>mint</option><option>sunset</option><option>quittr</option>
        </select>
      </div>
      <div class="row"><div>Haptics</div><input id="hapticsToggle" type="checkbox" checked></div>
      <div class="row"><div>Sounds</div><input id="soundsToggle" type="checkbox" checked></div>
      <div class="row"><div>FPS Cap</div>
        <select id="fpsSelect"><option>30</option><option selected>60</option></select>
      </div>
      <div class="actions">
        <button class="btn subtle" value="cancel" id="closeDlg">Close</button>
        <button class="btn danger" id="resetBtn" type="button">Reset Progress</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  // refresh element refs inside dialog
  els.themeSel = $('#themeSelect', dlg);
  els.hapticsChk = $('#hapticsToggle', dlg);
  els.soundsChk = $('#soundsToggle', dlg);
  els.fpsSel    = $('#fpsSelect', dlg);
  els.resetBtn  = $('#resetBtn', dlg);
}

/** ---------- Preferences & Profile ---------- **/
const prefs = store.get('mg_prefs', {
  theme: document.documentElement.dataset.theme || 'dark',
  haptics: true,
  sounds: true,
  fps: 60
});
document.documentElement.setAttribute('data-theme', prefs.theme);

const profile = store.get('mg_profile', {
  level: 1, xp: 0, streak: 0, lastPlay: null, best: {}
});
function saveAll(){ store.set('mg_prefs', prefs); store.set('mg_profile', profile); }

/** ---------- Stats UI ---------- **/
function renderStats() {
  if (els.level) els.level.textContent = profile.level;
  if (els.xp) els.xp.textContent = profile.xp;
  if (els.streak) els.streak.textContent = profile.streak;
}
renderStats();

/** ---------- Haptics / Sounds ---------- **/
const Haptics = {
  tap()  { if (prefs.haptics && navigator.vibrate) navigator.vibrate(10); },
  good() { if (prefs.haptics && navigator.vibrate) navigator.vibrate([12, 6, 18]); },
  bad()  { if (prefs.haptics && navigator.vibrate) navigator.vibrate([20, 30, 20]); }
};

let audioCtx, masterGain;
function initAudio() {
  if (!prefs.sounds) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain(); masterGain.gain.value = 0.08;
      masterGain.connect(audioCtx.destination);
    }
  } catch { /* ignore */ }
}
function beep(freq=440, dur=0.08, type='sine') {
  if (!prefs.sounds) return;
  try {
    initAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(masterGain);
    o.start();
    const t = audioCtx.currentTime;
    g.gain.exponentialRampToValueAtTime(1.0, t+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.stop(t+dur+0.01);
  } catch { /* autoplay blocked or no ctx */ }
}

/** ---------- XP / Level ---------- **/
function giveXP(n=10){
  profile.xp += n;
  const need = 100 + (profile.level-1)*50;
  if (profile.xp >= need) {
    profile.xp -= need; profile.level++;
    confetti();
    Haptics.good(); beep(880, .12, 'triangle');
  }
  renderStats(); saveAll();
}

/** ---------- Confetti (tiny DOM sprinkles) ---------- **/
function confetti() {
  let host = $('#confettiHost');
  if (!host){ host=document.createElement('div'); host.id='confettiHost'; document.body.appendChild(host); }
  for (let i=0;i<80;i++){
    const s = document.createElement('i');
    const size = 6+Math.random()*8;
    s.style.cssText = `
      position: fixed; left:${Math.random()*100}vw; top:-10px; width:${size}px; height:${size}px;
      background:hsl(${Math.random()*360}deg 90% 60%); border-radius:2px;
      transform:rotate(${Math.random()*360}deg);
      transition: transform 1.2s linear, top 1.2s linear, opacity 1.2s ease;
      opacity:1;`;
    host.appendChild(s);
    requestAnimationFrame(()=>{
      s.style.top='100vh';
      s.style.transform=`translateY(0) rotate(${Math.random()*720}deg)`;
      s.style.opacity='0';
    });
    setTimeout(()=>s.remove(), 1300);
  }
}

/** ---------- Canvas & Game Loop ---------- **/
const ctx = els.canvas.getContext('2d', { alpha:false });
let W = 600, H = 600;
function resizeCanvas() {
  const r = Math.min(els.canvas.clientWidth || 600, 800);
  W = H = r;
  els.canvas.width = W * devicePixelRatio;
  els.canvas.height = H * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
resizeCanvas();
on(window, 'resize', resizeCanvas);

let currentModule = null;
let running = false;
let lastTime = 0;
let acc = 0;
function loop(t){
  if (!running) return;
  const fps = Number(prefs.fps)||60;
  const step = 1000/fps;
  if (!lastTime) lastTime = t;
  const dt = t - lastTime;
  lastTime = t;
  acc += dt;
  while (acc >= step) {
    currentModule?.update(step/1000);
    acc -= step;
  }
  currentModule?.draw(ctx);
  requestAnimationFrame(loop);
}

/** ---------- UI wiring ---------- **/
function openPanel(title, howHTML=''){
  const head = $('.panel-head h2') || $('.panel-head')?.querySelector('h2');
  if (head) head.textContent = title || 'Module';
  if (els.howDetails) {
    els.howDetails.innerHTML = `<summary>How?</summary><div class="how-inner">${howHTML}</div>`;
  }
  els.panel?.classList.remove('hidden');
  // reset score
  if (els.scoreLbl) els.scoreLbl.textContent = '0';
  if (els.bestLbl)  els.bestLbl.textContent = String(profile.best[currentModule?.id]||0);
}
function closePanel(){
  stopGame();
  els.panel?.classList.add('hidden');
}

on(els.exitBtn, 'click', closePanel);
on(els.howBtn, 'click', ()=> els.howDetails?.setAttribute('open',''));
on(els.startBtn,'click', ()=> startGame());
on(els.stopBtn, 'click', ()=> stopGame());

on(els.settingsBtn, 'click', ()=>{
  els.themeSel.value = prefs.theme;
  els.hapticsChk.checked = !!prefs.haptics;
  els.soundsChk.checked = !!prefs.sounds;
  els.fpsSel.value = String(prefs.fps);
  els.settingsDlg.showModal();
});
on($('#closeDlg', els.settingsDlg), 'click', ()=> els.settingsDlg.close());

on(els.themeSel, 'change', e=>{
  prefs.theme = e.target.value; document.documentElement.setAttribute('data-theme', prefs.theme); saveAll();
});
on(els.hapticsChk, 'change', e=>{ prefs.haptics = e.target.checked; saveAll(); });
on(els.soundsChk, 'change', e=>{ prefs.sounds = e.target.checked; if (prefs.sounds) initAudio(); saveAll(); });
on(els.fpsSel, 'change', e=>{ prefs.fps = Number(e.target.value)||60; saveAll(); });

on(els.resetBtn,'click', ()=>{
  if (confirm('Reset level, XP, streak, and best scores?')) {
    localStorage.removeItem('mg_profile');
    Object.assign(profile, { level:1, xp:0, streak:0, lastPlay:null, best:{} });
    renderStats(); if (els.bestLbl) els.bestLbl.textContent = '0';
    confetti();
  }
});

function startGame(){
  if (!currentModule) return;
  running = true; lastTime = 0; acc=0;
  currentModule.start();
  requestAnimationFrame(loop);
}
function stopGame(){
  running = false;
  currentModule?.stop?.();
}

/** ---------- Modules ---------- **/
const modules = {};

/* Focus Tap: Tap the highlighted circle quickly. */
modules.focus = {
  id: 'focus',
  title: 'Focus Tap',
  how: 'A ring flashes somewhere on the board. Tap it before it disappears. Gets faster over time.',
  cells: [], target: -1, timer: 0, speed: 1.2, score: 0,
  grid: 4,

  start() {
    this.grid = 4; this.speed = 1.2; this.score = 0;
    this.newRound();
    Haptics.tap(); initAudio();
  },
  stop(){},
  newRound(){
    const n = this.grid * this.grid;
    this.target = Math.floor(Math.random()*n);
    this.timer = Math.max(0.5, 1.2/this.speed);
  },
  update(dt){
    this.timer -= dt;
    if (this.timer <= 0){
      // missed
      Haptics.bad(); beep(220,.07,'sawtooth');
      this.speed = Math.max(1.1, this.speed*0.98);
      this.newRound();
      this.score = Math.max(0, this.score-1);
      if (els.scoreLbl) els.scoreLbl.textContent = String(this.score);
    }
  },
  draw(ctx){
    const margin = 18, g=this.grid;
    const w = (W - margin*2)/g, r = Math.min(w, (H-margin*2)/g);
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card-2').trim() || '#0f141d';
    ctx.fillRect(0,0,W,H);
    ctx.lineWidth = 2;

    for (let i=0;i<g*g;i++){
      const x = margin + (i%g)*r + r/2;
      const y = margin + Math.floor(i/g)*r + r/2;
      ctx.beginPath();
      ctx.arc(x,y,r*0.38,0,Math.PI*2);
      if (i === this.target){
        ctx.strokeStyle = 'rgba(39,211,161,.9)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x,y, r*0.22, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(39,211,161,.25)';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,.08)';
        ctx.stroke();
      }
    }
  },
  click(x,y){
    const margin = 18, g=this.grid;
    const w = (W - margin*2)/g, r = Math.min(w, (H-margin*2)/g);
    const cx = Math.floor((x - margin)/r), cy = Math.floor((y - margin)/r);
    if (cx<0||cy<0||cx>=g||cy>=g) return;
    const idx = cy*g + cx;
    if (idx === this.target){
      this.score++;
      if (els.scoreLbl) els.scoreLbl.textContent = String(this.score);
      profile.best[this.id] = Math.max(profile.best[this.id]||0, this.score);
      if (els.bestLbl) els.bestLbl.textContent = String(profile.best[this.id]);
      giveXP(5);
      Haptics.good(); beep(660,.07,'triangle');
      this.speed *= 1.03;
      if (this.score % 6 === 0 && this.grid < 6) this.grid++; // ramp difficulty
    } else {
      Haptics.bad(); beep(200,.06,'sawtooth');
      this.score = Math.max(0, this.score-1);
      if (els.scoreLbl) els.scoreLbl.textContent = String(this.score);
    }
    this.newRound();
  }
};

/* Circle Hunt: many circles; one is odd (slightly smaller). */
modules.hunt = {
  id: 'hunt',
  title: 'Circle Hunt',
  how: 'One circle is slightly different. Find & tap it. More circles appear as you score.',
  n: 6, odd: 0, score: 0,
  start(){ this.n=6; this.score=0; this.newRound(); Haptics.tap(); initAudio(); },
  stop(){},
  newRound(){
    this.odd = Math.floor(Math.random()*this.n);
    // jitter positions precomputed
    this.pos = [];
    const cols = Math.ceil(Math.sqrt(this.n));
    const rows = Math.ceil(this.n/cols);
    const margin = 20;
    const cw = (W - margin*2)/cols;
    const ch = (H - margin*2)/rows;
    for (let i=0;i<this.n;i++){
      const c = i%cols, r = Math.floor(i/cols);
      const x = margin + c*cw + cw/2 + (Math.random()-.5)*cw*0.15;
      const y = margin + r*ch + ch/2 + (Math.random()-.5)*ch*0.15;
      this.pos.push([x,y]);
    }
  },
  update(){},
  draw(ctx){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card-2').trim() || '#0f141d';
    ctx.fillRect(0,0,W,H);
    for (let i=0;i<this.n;i++){
      const [x,y] = this.pos[i];
      const base = Math.min(W,H)/Math.sqrt(this.n)/3;
      const r = i===this.odd ? base*0.78 : base;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle = i===this.odd ? 'rgba(39,211,161,.75)' : 'rgba(255,255,255,.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth=2; ctx.stroke();
    }
  },
  click(x,y){
    const base = Math.min(W,H)/Math.sqrt(this.n)/3;
    for (let i=0;i<this.n;i++){
      const [cx,cy] = this.pos[i];
      const r = i===this.odd ? base*0.78 : base;
      const hit = (x-cx)*(x-cx) + (y-cy)*(y-cy) <= (r*r);
      if (hit){
        if (i===this.odd){
          this.score++; giveXP(6); Haptics.good(); beep(750,.08,'square');
          if (els.scoreLbl) els.scoreLbl.textContent = String(this.score);
          profile.best[this.id] = Math.max(profile.best[this.id]||0, this.score);
          if (els.bestLbl) els.bestLbl.textContent = String(profile.best[this.id]);
          if (this.n < 40) this.n += (this.n<20?1:2);
        } else {
          this.score = Math.max(0, this.score-1);
          if (els.scoreLbl) els.scoreLbl.textContent = String(this.score);
          Haptics.bad(); beep(180,.07,'sawtooth');
        }
        this.newRound();
        break;
      }
    }
  }
};

/* Visual Span: watch sequence then repeat. */
modules.span = {
  id: 'span',
  title: 'Visual Span',
  how: 'Squares flash in sequence. Wait until playback ends, then tap them back in the same order.',
  grid: 3, seq: [], input: [], phase: 'show', t: 0, stepIdx: 0, score: 0,

  start(){
    this.grid = 3; this.seq=[]; this.input=[]; this.score=0;
    this.addStep(); this.phase='show'; this.stepIdx=0; this.t=0;
    Haptics.tap(); initAudio();
  },
  stop(){},
  addStep(){
    const n = this.grid*this.grid;
    this.seq.push(Math.floor(Math.random()*n));
  },
  update(dt){
    this.t += dt;
    if (this.phase==='show'){
      if (this.t > 0.7){ this.t=0; this.stepIdx++; if (this.stepIdx>=this.seq.length){ this.phase='wait'; } }
    }
  },
  draw(ctx){
    ctx.clearRect(0,0,W,H);
    const margin=16,g=this.grid; const cell = Math.min((W-margin*2)/g, (H-margin*2)/g);
    for (let i=0;i<g*g;i++){
      const x = margin + (i%g)*cell, y = margin + Math.floor(i/g)*cell;
      ctx.beginPath(); ctx.rect(x+6,y+6,cell-12,cell-12);
      let on=false;
      if (this.phase==='show' && i===this.seq[Math.min(this.stepIdx,this.seq.length-1)] && this.t<0.35) on=true;
      if (this.phase==='input' && i===this.input[this.input.length-1]) on=true;
      ctx.fillStyle = on ? 'rgba(39,211,161,.85)' : 'rgba(255,255,255,.10)';
      ctx.fill();
      ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.stroke();
    }
    // overlay state
    ctx.fillStyle='rgba(255,255,255,.4)'; ctx.font='14px ui-sans-serif';
    ctx.fillText(this.phase==='show'?'Watch…':(this.phase==='wait'?'Ready':'Your turn'), 12, 20);
  },
  click(x,y){
    const margin=16,g=this.grid; const cell = Math.min((W-margin*2)/g, (H-margin*2)/g);
    const cx = Math.floor((x - margin)/cell), cy = Math.floor((y - margin)/cell);
    if (cx<0||cy<0||cx>=g||cy>=g) return;
    const id = cy*g + cx;

    if (this.phase==='wait'){ this.phase='input'; this.input=[]; }
    if (this.phase!=='input') return;

    this.input.push(id); Haptics.tap(); beep(550,.05,'triangle');
    if (this.input[this.input.length-1] !== this.seq[this.input.length-1]) {
      // wrong
      Haptics.bad(); beep(180,.12,'sawtooth');
      this.seq = []; this.input=[]; this.grid=3; this.score=0;
      if (els.scoreLbl) els.scoreLbl.textContent='0';
      this.addStep(); this.phase='show'; this.stepIdx=0; this.t=0;
      return;
    }
    if (this.input.length === this.seq.length){
      // correct round
      this.score++;
      profile.best[this.id] = Math.max(profile.best[this.id]||0, this.score);
      if (els.scoreLbl) els.scoreLbl.textContent = String(this.score);
      if (els.bestLbl) els.bestLbl.textContent = String(profile.best[this.id]);
      giveXP(8);
      Haptics.good(); beep(820,.09,'sine');
      // next round
      if (this.score % 3 === 0 && this.grid < 5) this.grid++;
      this.addStep(); this.phase='show'; this.stepIdx=0; this.t=0;
    }
  }
};

/* N-Back (beta): Position 1-back by default; tap screen when current matches N steps back. */
modules.nback = {
  id: 'nback',
  title: 'N-Back (beta)',
  how: 'A square lights up each second. Tap anywhere if it matches the position N steps back (start with N=1; increases as you get streaks).',
  n: 1, hist: [], t: 0, interval: 1.0, cur: 0, score: 0, ready: false,

  start(){ this.n=1; this.hist=[]; this.t=0; this.cur = Math.floor(Math.random()*9); this.score=0; this.ready=false; initAudio(); },
  stop(){},
  update(dt){
    this.t += dt;
    if (this.t >= this.interval){
      this.t = 0;
      this.hist.push(this.cur);
      this.cur = Math.floor(Math.random()*9);
      if (this.hist.length>this.n) this.ready = true;
    }
  },
  draw(ctx){
    ctx.clearRect(0,0,W,H);
    const g=3, margin=24; const cell = Math.min((W-margin*2)/g, (H-margin*2)/g);
    for (let i=0;i<9;i++){
      const x=margin+(i%g)*cell, y=margin+Math.floor(i/g)*cell;
      ctx.beginPath(); ctx.rect(x+6,y+6,cell-12,cell-12);
      const on = i===this.cur && this.t< this.interval*0.4;
      ctx.fillStyle = on ? 'rgba(39,211,161,.85)' : 'rgba(255,255,255,.10)';
      ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.stroke();
    }
    ctx.fillStyle='rgba(255,255,255,.45)'; ctx.font='14px ui-sans-serif';
    ctx.fillText(`N=${this.n}`, 12, 20);
  },
  click(){
    if (!this.ready) return;
    const idx = this.hist.length-1;
    const match = this.hist[idx] === this.hist[idx-this.n];
    if (match){
      this.score++; giveXP(7); Haptics.good(); beep(720,.07,'triangle');
      if (els.scoreLbl) els.scoreLbl.textContent = String(this.score);
      profile.best[this.id] = Math.max(profile.best[this.id]||0, this.score);
      if (els.bestLbl) els.bestLbl.textContent = String(profile.best[this.id]);
      if (this.score % 5 === 0) this.n = Math.min(3, this.n+1);
    } else {
      this.score = Math.max(0, this.score-1);
      if (els.scoreLbl) els.scoreLbl.textContent = String(this.score);
      Haptics.bad(); beep(200,.08,'sawtooth');
      this.n = 1;
    }
  }
};

/** ---------- Module selection wiring ---------- **/
function attachModuleCard(card){
  const id = card.dataset.module;
  const mod = modules[id];
  if (!mod) return;
  on(card, 'click', ()=>{
    currentModule = mod;
    openPanel(mod.title, mod.how);
    // populate best
    if (els.bestLbl) els.bestLbl.textContent = String(profile.best[mod.id]||0);
  });
}
els.modCards.forEach(attachModuleCard);

/* Fallback: build cards if HTML didn’t include them */
if (!els.modCards.length && els.modulesGrid){
  const defs = [
    ['focus','Focus Tap','Tap the highlighted circle quickly.'],
    ['hunt','Circle Hunt','Find the odd circle among many.'],
    ['span','Visual Span','Repeat the flashing sequence.'],
    ['nback','N-Back (beta)','Match current to N steps back.']
  ];
  els.modulesGrid.classList.add('grid');
  defs.forEach(([id,title,desc])=>{
    const card = document.createElement('button');
    card.className = 'card module'; card.setAttribute('data-module', id);
    card.innerHTML = `<h3>${title}</h3><p>${desc}</p>`;
    els.modulesGrid.appendChild(card);
    attachModuleCard(card);
  });
}

/** ---------- Pointer events on canvas ---------- **/
function canvasPos(ev){
  const rect = els.canvas.getBoundingClientRect();
  const x = (ev.touches?.[0]?.clientX ?? ev.clientX) - rect.left;
  const y = (ev.touches?.[0]?.clientY ?? ev.clientY) - rect.top;
  return {x, y};
}
['click','touchstart'].forEach(evt=>{
  on(els.canvas, evt, e=>{
    if (!currentModule) return;
    const {x,y} = canvasPos(e);
    currentModule.click?.(x,y);
  }, {passive:true});
});

/** ---------- Daily streak handling ---------- **/
(function streak(){
  const today = new Date().toDateString();
  if (profile.lastPlay !== today) {
    const yesterday = new Date(Date.now()-86400000).toDateString();
    profile.streak = profile.lastPlay===yesterday ? (profile.streak+1) : 0;
    profile.lastPlay = today;
    saveAll(); renderStats();
  }
})();

/** ---------- Service Worker (optional) ---------- **/
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

/** ---------- Safety: ensure Start/Stop not broken ---------- **/
if (!els.startBtn || !els.stopBtn) {
  // create minimal controls under canvas if missing
  const bar = document.createElement('div');
  bar.className = 'controls';
  bar.innerHTML = `
    <div class="left">
      <button class="btn primary pill" id="startBtn">Start</button>
      <button class="btn pill" id="stopBtn">Stop</button>
    </div>
    <div class="right">
      <span class="score">Score: <b data-score>0</b></span>
      <span class="score">Best: <b data-best>0</b></span>
    </div>`;
  els.stageWrap.appendChild(bar);
  els.startBtn = $('#startBtn'); els.stopBtn = $('#stopBtn');
  els.scoreLbl = $('[data-score]'); els.bestLbl = $('[data-best]');
  on(els.startBtn, 'click', ()=> startGame());
  on(els.stopBtn, 'click', ()=> stopGame());
}

/** ---------- Default theme values into dialog ---------- **/
if (els.themeSel) els.themeSel.value = prefs.theme;
if (els.hapticsChk) els.hapticsChk.checked = !!prefs.haptics;
if (els.soundsChk) els.soundsChk.checked = !!prefs.sounds;
if (els.fpsSel) els.fpsSel.value = String(prefs.fps);

/** ---------- Open first module automatically if none selected ---------- **/
if (!els.panel?.classList.contains('hidden')) {
  // panel visible from HTML; keep as-is
} else {
  // just idle on home
}

// Expose modules for debugging in console
window.MindGym = { modules, prefs, profile, startGame, stopGame };
