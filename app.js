/* MindGym - single-file JS engine (no frameworks) */
(() => {
  'use strict';

  // ---------- Utilities ----------
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const lerp = (a,b,t)=>a+(b-a)*t;
  const now = ()=>performance.now();

  const storage = {
    load() {
      try { return JSON.parse(localStorage.getItem('mg-state')||'{}'); } catch { return {}; }
    },
    save(s) { localStorage.setItem('mg-state', JSON.stringify(s)); }
  };

  const defaultState = {
    level:1, xp:0, streak:0,
    best:{ focusTap:0, circleHunt:0, visualSpan:0 },
    theme:'dark', haptics:true, sounds:true, fps:60
  };
  const state = Object.assign({}, defaultState, storage.load());
  storage.save(state);

  // Theme apply
  const applyTheme = () => {
    document.documentElement.classList.remove('light','amoled');
    if(state.theme!=='dark') document.documentElement.classList.add(state.theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  };
  applyTheme();

  // Stats UI
  const statLevel = $('#stat-level'), statXP = $('#stat-xp'), statStreak = $('#stat-streak');
  const refreshStats = () => {
    statLevel.textContent = state.level;
    statXP.textContent = state.xp;
    statStreak.textContent = state.streak;
  };
  refreshStats();

  // ---------- Simple Audio (beep) ----------
  let actx;
  function ensureAudio() {
    if(!state.sounds) return;
    if(!actx){ try{ actx = new (window.AudioContext||window.webkitAudioContext)(); }catch{} }
  }
  function beep(freq=880, dur=0.07, vol=0.04) {
    if(!state.sounds || !actx) return;
    const t = actx.currentTime;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.frequency.value = freq;
    g.gain.value = vol;
    g.gain.setTargetAtTime(0.0001, t+dur*0.6, 0.03);
    osc.connect(g).connect(actx.destination);
    osc.start(t); osc.stop(t+dur);
  }
  function vibrate(ms=30) {
    if(state.haptics && navigator.vibrate) navigator.vibrate(ms);
  }

  // ---------- Canvas Setup ----------
  const canvas = $('#stage');
  const ctx = canvas.getContext('2d');
  let DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  function resizeCanvas(){
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * DPR);
    canvas.height = Math.round(rect.width * DPR); // square
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ---------- Engine ----------
  let rafId = 0, lastTime = 0, fpsInterval = 1000/state.fps;
  let running = false, currentModule = null;

  function loop(ts){
    if(!running){ rafId = 0; return; }
    if(!lastTime) lastTime = ts;
    const elapsed = ts - lastTime;
    if(elapsed >= fpsInterval){
      lastTime = ts - (elapsed % fpsInterval);
      currentModule?.update(elapsed/1000);
      currentModule?.render(ctx);
    }
    rafId = requestAnimationFrame(loop);
  }
  function startLoop(){
    if(running) return;
    running = true; lastTime = 0;
    ensureAudio();
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop(){
    running = false;
    if(rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ---------- Pointer handling (debounced) ----------
  const pointer = { x:0, y:0, down:false };
  let tapLock = false;
  function canvasPos(ev){
    const rect = canvas.getBoundingClientRect();
    const x = (('touches' in ev)? ev.touches[0].clientX : ev.clientX) - rect.left;
    const y = (('touches' in ev)? ev.touches[0].clientY : ev.clientY) - rect.top;
    return { x: x*DPR, y: y*DPR };
  }
  canvas.addEventListener('pointerdown', e => {
    if(tapLock) return;
    tapLock = true; setTimeout(()=>tapLock=false, 120); // debounce
    const p = canvasPos(e);
    currentModule?.tap(p.x, p.y);
  }, {passive:true});
  canvas.addEventListener('touchstart', e => {
    if(tapLock) return;
    tapLock = true; setTimeout(()=>tapLock=false, 120);
    const p = canvasPos(e);
    currentModule?.tap(p.x, p.y);
  }, {passive:true});

  // ---------- Modules ----------
  class BaseModule {
    constructor(){ this.score=0; this.best=0; this.over=true; }
    start(){ this.score=0; this.over=false; startLoop(); }
    stop(){ this.over=true; stopLoop(); }
    end(){ this.over=true; stopLoop(); awardXP(this.score); }
    update() {}
    render() {}
    tap() {}
  }

  function awardXP(s){
    const xpGain = Math.round(s);
    state.xp += xpGain;
    if(state.xp >= state.level*100){ state.level++; }
    storage.save(state);
    refreshStats();
  }

  // Focus Tap: one highlighted circle to hit fast
  class FocusTap extends BaseModule {
    constructor(){ super(); this.name='focusTap'; this.title='Focus Tap'; this.howText='Tap the single highlighted (bright) circle as soon as it appears. Speed increases on streaks.'; }
    start(){ super.start(); this.resetLayout(); this.nextTarget(); }
    resetLayout(){
      const n = 3 + Math.min(2, Math.floor(this.score/8)); // grid grows up to 5x5
      this.grid = n;
      this.cells = [];
      const pad = 20*DPR;
      const size = Math.min(canvas.width, canvas.height) - pad*2;
      const step = size / n;
      this.origin = {x:(canvas.width-size)/2, y:(canvas.height-size)/2};
      for(let gy=0; gy<n; gy++){
        for(let gx=0; gx<n; gx++){
          const cx = this.origin.x + gx*step + step/2;
          const cy = this.origin.y + gy*step + step/2;
          const r = step*0.32;
          this.cells.push({cx,cy,r});
        }
      }
    }
    nextTarget(){
      this.target = Math.floor(Math.random()*this.cells.length);
      this.time = 0;
      this.timeout = Math.max(0.7, 1.6 - this.score*0.03); // gets faster
    }
    update(dt){
      if(this.over) return;
      this.time += dt;
      if(this.time>this.timeout){ // missed
        this.end();
      }
    }
    tap(x,y){
      if(this.over) return;
      const c = this.cells[this.target];
      const dx=x-c.cx, dy=y-c.cy;
      if(dx*dx+dy*dy <= c.r*c.r){
        this.score++;
        beep(880); vibrate(25);
        if(this.score%6===0) this.resetLayout();
        this.nextTarget();
        updateHUD(this);
      } else {
        beep(200,0.08,0.02); this.end();
      }
    }
    render(g){
      g.clearRect(0,0,canvas.width,canvas.height);
      // draw cells
      g.lineWidth = 2*DPR;
      for(let i=0;i<this.cells.length;i++){
        const c = this.cells[i];
        g.beginPath(); g.arc(c.cx,c.cy,c.r,0,Math.PI*2);
        g.strokeStyle = '#2b3640'; g.stroke();
      }
      // target
      const t = this.cells[this.target];
      const pul = 0.06*Math.sin(performance.now()/160)+1;
      g.beginPath(); g.arc(t.cx,t.cy,t.r*pul,0,Math.PI*2);
      g.fillStyle = '#3ae5a4'; g.fill();
    }
  }

  // Circle Hunt: many circles, one is slightly different radius
  class CircleHunt extends BaseModule {
    constructor(){ super(); this.name='circleHunt'; this.title='Circle Hunt'; this.howText='Among many circles, one is slightly different. Find and tap it.'; }
    start(){ super.start(); this.level=0; this.buildRound(); }
    buildRound(){
      const n = 3 + Math.min(5, Math.floor(this.score/3)); // up to 8x8
      this.grid=n;
      this.cells=[];
      const pad=20*DPR; const size=Math.min(canvas.width,canvas.height)-pad*2; const step=size/n;
      this.origin={x:(canvas.width-size)/2, y:(canvas.height-size)/2};
      for(let gy=0; gy<n; gy++){
        for(let gx=0; gx<n; gx++){
          const cx=this.origin.x+gx*step+step/2, cy=this.origin.y+gy*step+step/2, r=step*0.32;
          this.cells.push({cx,cy,r});
        }
      }
      this.odd = Math.floor(Math.random()*this.cells.length);
      this.delta = clamp(0.12 - this.score*0.004, 0.02, 0.12); // difference shrinks
    }
    tap(x,y){
      if(this.over) return;
      const c=this.cells[this.odd]; const dx=x-c.cx, dy=y-c.cy;
      const rr = c.r*(1+this.delta);
      if(dx*dx+dy*dy<=rr*rr){
        this.score++; beep(740); vibrate(20); updateHUD(this); this.buildRound();
      } else { beep(220,0.08,0.02); this.end(); }
    }
    render(g){
      g.clearRect(0,0,canvas.width,canvas.height);
      g.lineWidth=2*DPR;
      for(let i=0;i<this.cells.length;i++){
        const c=this.cells[i];
        const r = i===this.odd ? c.r*(1+this.delta) : c.r;
        g.beginPath(); g.arc(c.cx,c.cy,r,0,Math.PI*2);
        g.strokeStyle = i===this.odd ? '#3ae5a4' : '#2b3640';
        g.stroke();
      }
    }
  }

  // Visual Span: flash positions then user repeats order
  class VisualSpan extends BaseModule {
    constructor(){ super(); this.name='visualSpan'; this.title='Visual Span'; this.howText='Watch tiles flash in sequence. Then tap them in the same order.'; }
    start(){ super.start(); this.span=3; this.phase='show'; this.seq=[]; this.progress=0; this.buildGrid(); this.newSequence(); }
    buildGrid(){
      const n=3; this.grid=n; this.cells=[];
      const pad=30*DPR; const size=Math.min(canvas.width,canvas.height)-pad*2; const step=size/n;
      this.origin={x:(canvas.width-size)/2, y:(canvas.height-size)/2, step};
      for(let gy=0; gy<n; gy++){
        for(let gx=0; gx<n; gx++){
          const x=this.origin.x+gx*step, y=this.origin.y+gy*step, w=step-6*DPR;
          this.cells.push({x:x+3*DPR, y:y+3*DPR, w});
        }
      }
    }
    newSequence(){
      this.seq=[]; for(let i=0;i<this.span;i++){ this.seq.push(Math.floor(Math.random()*this.cells.length)); }
      this.progress=0; this.flashIndex=0; this.phase='show'; this.timer=0;
    }
    update(dt){
      if(this.over) return;
      if(this.phase==='show'){
        this.timer+=dt;
        if(this.timer>0.75){ this.timer=0; this.flashIndex++; if(this.flashIndex>=this.seq.length){ this.phase='input'; } }
      }
    }
    tap(x,y){
      if(this.over || this.phase!=='input') return;
      // find cell
      let hit=-1;
      for(let i=0;i<this.cells.length;i++){
        const c=this.cells[i];
        if(x>=c.x && x<=c.x+c.w && y>=c.y && y<=c.y+c.w){ hit=i; break; }
      }
      if(hit<0) return;
      const exp = this.seq[this.progress];
      if(hit===exp){
        this.progress++; beep(660); vibrate(20);
        if(this.progress>=this.seq.length){
          this.score++; updateHUD(this);
          if(this.score%2===0) this.span++;
          this.newSequence();
        }
      } else { beep(180,0.08,0.02); this.end(); }
    }
    render(g){
      g.clearRect(0,0,canvas.width,canvas.height);
      for(let i=0;i<this.cells.length;i++){
        const c=this.cells[i];
        let bright=false;
        if(this.phase==='show' && i===this.seq[this.flashIndex]) bright=true;
        g.fillStyle = bright ? '#3ae5a4' : '#1f262d';
        g.strokeStyle = '#2b3640';
        g.lineWidth=2*DPR;
        g.beginPath(); g.rect(c.x,c.y,c.w,c.w); g.fill(); g.stroke();
      }
    }
  }

  const modules = {
    focusTap: new FocusTap(),
    circleHunt: new CircleHunt(),
    visualSpan: new VisualSpan(),
  };

  // ---------- UI Wiring ----------
  const screenHome = $('#screen-home'), screenModule = $('#screen-module');
  const btnSettings = $('#btn-settings'), dlgSettings = $('#dlg-settings');
  const btnStats = $('#btn-stats'), dlgStats = $('#dlg-stats'), statRows = $('#stat-rows');
  const btnStart = $('#btn-start'), btnStop = $('#btn-stop'), btnExit = $('#btn-exit'), btnHow = $('#btn-how');
  const scoreEl = $('#score'), bestEl = $('#best'), titleEl = $('#module-title'), howEl = $('#module-how');
  const themeSel = $('#theme'), hapticsChk = $('#haptics'), soundsChk = $('#sounds'), fpsSel = $('#fps');

  function updateHUD(mod){
    scoreEl.textContent = mod.score;
    const prevBest = state.best[mod.name]||0;
    if(mod.score>prevBest){ state.best[mod.name]=mod.score; storage.save(state); }
    bestEl.textContent = state.best[mod.name]||0;
  }

  function openModule(id){
    currentModule = modules[id];
    if(!currentModule) return;
    titleEl.textContent = currentModule.title;
    howEl.textContent = currentModule.howText;
    howEl.classList.add('hidden');
    updateHUD(currentModule);
    screenHome.classList.add('hidden');
    screenModule.classList.remove('hidden');
    stopLoop();
  }
  function closeModule(){
    currentModule?.stop();
    screenModule.classList.add('hidden');
    screenHome.classList.remove('hidden');
    refreshStats();
  }

  // Cards
  $$('.card[data-module]').forEach(btn=>btn.addEventListener('click', e=>{
    openModule(btn.dataset.module);
  }));

  btnStart.addEventListener('click', ()=>{
    ensureAudio(); // unlock
    currentModule?.start();
  });
  btnStop.addEventListener('click', ()=>currentModule?.stop());
  btnExit.addEventListener('click', closeModule);
  btnHow.addEventListener('click', ()=> howEl.classList.toggle('hidden'));

  // Settings
  btnSettings.addEventListener('click', ()=>{
    themeSel.value = state.theme; hapticsChk.checked = state.haptics; soundsChk.checked = state.sounds; fpsSel.value = String(state.fps||60);
    dlgSettings.showModal();
  });
  dlgSettings.addEventListener('close', ()=>{
    state.theme = themeSel.value;
    state.haptics = hapticsChk.checked;
    state.sounds = soundsChk.checked;
    state.fps = parseInt(fpsSel.value,10)||60;
    fpsInterval = 1000/state.fps;
    applyTheme(); storage.save(state);
  });
  $('#btn-reset').addEventListener('click', (e)=>{
    e.preventDefault();
    Object.assign(state, defaultState);
    storage.save(state); applyTheme(); refreshStats();
    state.best = { focusTap:0, circleHunt:0, visualSpan:0 };
    dlgSettings.close();
  });

  // Stats dialog
  btnStats.addEventListener('click', ()=>{
    statRows.innerHTML = `
      <div class="row"><span>Focus Tap best</span><b>${state.best.focusTap||0}</b></div>
      <div class="row"><span>Circle Hunt best</span><b>${state.best.circleHunt||0}</b></div>
      <div class="row"><span>Visual Span best</span><b>${state.best.visualSpan||0}</b></div>
    `;
    dlgStats.showModal();
  });

  // Expose for debugging
  window.__mg = {state, modules};
})();