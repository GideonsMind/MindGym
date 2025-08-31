// MindGym - compact, mobile-safe engine
(()=>{
  const qs=s=>document.querySelector(s), $=id=>document.getElementById(id);
  const canvas=$('gameCanvas'), ctx=canvas.getContext('2d');
  const scoreEl=$('score'), bestEl=$('best'), lvlEl=$('level'), xpEl=$('xp'), streakEl=$('streak');
  const screenHome=$('#screen-home'), screenModule=$('#screen-module');
  const startBtn=$('startBtn'), stopBtn=$('stopBtn'), exitBtn=$('exitBtn'), howBtn=$('howBtn');
  const howBox=$('#module-how'), titleEl=$('#module-title');
  const themeSel=$('theme'), hapticsChk=$('haptics'), soundsChk=$('sounds'), fpsSel=$('fps');
  const btnSettings=$('btn-settings'); const dlgSettings=$('dlg-settings');

  // ---------- State
  const SKEY='mg_v2_state';
  const state=Object.assign({
    level:1,xp:0,streak:0,best:{focus:0,hunt:0,span:0},
    haptics:true,sounds:true,theme:'dark',fps:60
  }, JSON.parse(localStorage.getItem(SKEY)||'{}'));
  function save(){ localStorage.setItem(SKEY, JSON.stringify(state)); }

  function applyTheme(){
    document.documentElement.classList.remove('light','amoled');
    if(state.theme!=='dark') document.documentElement.classList.add(state.theme);
  }
  applyTheme();

  function syncStats(){
    lvlEl.textContent=state.level; xpEl.textContent=state.xp; streakEl.textContent=state.streak;
  } syncStats();

  // ---------- Canvas sizing
  let DPR=Math.max(1,Math.min(3,window.devicePixelRatio||1));
  function sizeCanvas(){
    const rect=canvas.getBoundingClientRect();
    const W=Math.max(300, Math.floor(rect.width||360));
    const H=W; // square
    canvas.width=Math.floor(W*DPR); canvas.height=Math.floor(H*DPR);
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  sizeCanvas(); addEventListener('resize', ()=>{ sizeCanvas(); current?.draw?.(); });

  // ---------- Input (debounced)
  function onTap(el,fn){
    if(!el) return;
    let lock=false, last=0;
    const h=e=>{ const t=performance.now(); if(lock || t-last<120) return; last=t; lock=true; try{ fn(e); }finally{ setTimeout(()=>lock=false,120);} e.preventDefault?.(); };
    el.addEventListener('touchstart', h, {passive:false}); el.addEventListener('click', h);
  }
  function pointerXY(e){
    const r=canvas.getBoundingClientRect();
    const x=(e.touches?.[0]?.clientX ?? e.clientX) - r.left;
    const y=(e.touches?.[0]?.clientY ?? e.clientY) - r.top;
    return {x,y};
  }
  function vibrate(ms=20){ if(state.haptics && navigator.vibrate) navigator.vibrate(ms); }

  // ---------- Audio (unlocked on first Start)
  let AC, audioReady=false;
  function ensureAudio(){ if(audioReady) return;
    try{ AC=AC||new (window.AudioContext||window.webkitAudioContext)(); audioReady=true; }catch{}
  }
  function beep(f=700,d=0.06){
    if(!state.sounds || !AC) return;
    const o=AC.createOscillator(), g=AC.createGain(); o.type='sine'; o.frequency.value=f; g.gain.value=.0001;
    o.connect(g).connect(AC.destination); const t=AC.currentTime;
    g.gain.exponentialRampToValueAtTime(.12, t+.01); g.gain.exponentialRampToValueAtTime(.0001, t+d);
    o.start(t); o.stop(t+d+.02);
  }

  // ---------- Engine
  let running=false, raf=0, last=0, acc=0, target=1000/(state.fps||60);
  function loop(ts){
    if(!running) return;
    if(!last) last=ts; let dt=ts-last; last=ts; acc+=dt;
    while(acc>=target){ current?.update?.(target/1000); acc-=target; }
    current?.draw?.(); raf=requestAnimationFrame(loop);
  }
  function start(){ if(running) return; running=true; last=0; acc=0; raf=requestAnimationFrame(loop); }
  function stop(){ running=false; if(raf) cancelAnimationFrame(raf); raf=0; }

  // ---------- Modules
  const Modules={};
  Modules.focus=()=>{
    const dots=6, r=16; let target=0,score=0,lock=false;
    const layout=i=>{ const pad=28, W=canvas.clientWidth, y=canvas.clientHeight/2;
      const step=(W-pad*2)/(dots-1); return {x:pad+i*step,y};
    };
    function draw(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for(let i=0;i<dots;i++){ const {x,y}=layout(i); ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fillStyle=i===target?'#3ae5a4':'#2f3747'; ctx.fill(); }
      scoreEl.textContent=score; bestEl.textContent=Math.max(state.best.focus,score);
    }
    function tap(e){
      if(lock) return; lock=true; setTimeout(()=>lock=false,90);
      const {x,y}=pointerXY(e); const t=layout(target); const dx=x-t.x, dy=y-t.y;
      if(dx*dx+dy*dy <= r*r*2){ score++; state.xp+=2; state.best.focus=Math.max(state.best.focus,score);
        target=Math.floor(Math.random()*dots); vibrate(15); ensureAudio(); beep(720);
        if(state.xp>=state.level*100){ state.level++; } save(); syncStats();
      } else { state.streak=0; ensureAudio(); beep(220); save(); syncStats(); }
    }
    onTap(canvas,tap);
    return {update:()=>{}, draw};
  };

  Modules.hunt=()=>{
    let N=12, idx=0, score=0;
    function grid(){ const cols=Math.ceil(Math.sqrt(N)); const rows=Math.ceil(N/cols); return {cols,rows}; }
    function next(){ idx=Math.floor(Math.random()*N); }
    next();
    function draw(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      const pad=12; const {cols,rows}=grid();
      const cw=(canvas.clientWidth-pad*2)/cols, ch=(canvas.clientHeight-pad*2)/rows;
      const base=100, delta=Math.max(6, 20-Math.floor(score/3));
      for(let i=0;i<N;i++){ const c=i===idx?base+delta:base; const x=pad+(i%cols)*cw+cw/2, y=pad+Math.floor(i/cols)*ch+ch/2;
        ctx.beginPath(); ctx.arc(x,y,Math.min(cw,ch)/3,0,Math.PI*2); ctx.fillStyle=`rgb(${c},${c+40},${c+80})`; ctx.fill(); }
      scoreEl.textContent=score; bestEl.textContent=Math.max(state.best.hunt,score);
    }
    function tap(e){
      const {x,y}=pointerXY(e); const pad=12; const {cols,rows}=grid();
      const cw=(canvas.clientWidth-pad*2)/cols, ch=(canvas.clientHeight-pad*2)/rows;
      const col=Math.floor((x-pad)/cw), row=Math.floor((y-pad)/ch); const i=row*cols+col;
      if(i===idx){ score++; state.xp+=3; state.best.hunt=Math.max(state.best.hunt,score); N=Math.min(100,N+1);
        vibrate(12); ensureAudio(); beep(800); next(); if(state.xp>=state.level*100){state.level++;} save(); syncStats();
      } else { state.streak=0; ensureAudio(); beep(200); save(); syncStats(); }
    }
    onTap(canvas,tap);
    return {update:()=>{}, draw};
  };

  Modules.span=()=>{
    const grid=3, seq=[], input=[]; let stage='show', idx=0, t=0, score=0;
    function cell(i){ const r=Math.floor(i/grid), c=i%grid; const pad=18, cw=(canvas.clientWidth-pad*2)/grid, ch=(canvas.clientHeight-pad*2)/grid;
      const x=pad+c*cw+cw/2, y=pad+r*ch+ch/2, rad=Math.min(cw,ch)/3; return {x,y,rad}; }
    function newRound(){ input.length=0; seq.push(Math.floor(Math.random()*grid*grid)); stage='show'; idx=0; t=0; }
    newRound();
    function update(dt){ if(stage==='show'){ t+=dt; if(t>0.55){ t=0; idx++; if(idx>=seq.length){ stage='input'; } } } }
    function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height);
      for(let i=0;i<grid*grid;i++){ const {x,y,rad}=cell(i); ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2);
        const on = (stage==='show'&&i===seq[idx]) || (stage==='input'&&input.includes(i));
        ctx.fillStyle=on?'#3ae5a4':'#2f3747'; ctx.fill(); }
      scoreEl.textContent=score; bestEl.textContent=Math.max(state.best.span,score);
    }
    function tap(e){
      if(stage!=='input') return;
      const {x,y}=pointerXY(e); const pad=18, cw=(canvas.clientWidth-pad*2)/grid, ch=(canvas.clientHeight-pad*2)/grid;
      const c=Math.floor((x-pad)/cw), r=Math.floor((y-pad)/ch); const i=r*grid+c; if(i<0||i>=grid*grid) return;
      input.push(i); vibrate(10); ensureAudio(); beep(620);
      if(i!==seq[input.length-1]){ // fail
        state.streak=0; ensureAudio(); beep(180);
        seq.length=0; score=0; newRound(); save(); syncStats(); return;
      }
      if(input.length===seq.length){ score++; state.xp+=4; state.best.span=Math.max(state.best.span,score);
        stage='show'; idx=0; t=0; input.length=0; seq.push(Math.floor(Math.random()*grid*grid));
        if(state.xp>=state.level*100){ state.level++; } save(); syncStats();
      }
    }
    onTap(canvas,tap);
    return {update, draw};
  };

  // ---------- UI wiring
  let current=null;
  function openModule(kind){
    screenHome.classList.add('hidden'); screenModule.classList.remove('hidden');
    if(kind==='focus'){ current=Modules.focus(); titleEl.textContent='Focus Tap'; howBox.textContent='Tap the highlighted circle quickly.'; }
    if(kind==='hunt'){ current=Modules.hunt(); titleEl.textContent='Circle Hunt'; howBox.textContent='Find and tap the odd circle among many.'; }
    if(kind==='span'){ current=Modules.span(); titleEl.textContent='Visual Span'; howBox.textContent='Watch the sequence, then repeat it.'; }
    howBox.classList.add('hidden'); sizeCanvas(); drawOnce();
  }
  function closeModule(){ stop(); current=null; screenModule.classList.add('hidden'); screenHome.classList.remove('hidden'); }
  function drawOnce(){ current?.draw?.(); }
  onTap($('tileFocus'), ()=>openModule('focus'));
  onTap($('tileHunt'),  ()=>openModule('hunt'));
  onTap($('tileSpan'),  ()=>openModule('span'));

  onTap(startBtn, ()=>{ ensureAudio(); start(); });
  onTap(stopBtn,  ()=>{ stop(); });
  onTap(exitBtn,  ()=>{ closeModule(); });
  onTap(howBtn,   ()=> howBox.classList.toggle('hidden'));

  // Settings
  onTap(btnSettings, ()=>{
    themeSel.value=state.theme; hapticsChk.checked=state.haptics; soundsChk.checked=state.sounds; fpsSel.value=String(state.fps||60);
    $('dlg-settings').showModal();
  });
  $('dlg-settings').addEventListener('close', ()=>{
    state.theme=themeSel.value; state.haptics=hapticsChk.checked; state.sounds=soundsChk.checked; state.fps=parseInt(fpsSel.value,10)||60;
    applyTheme(); save();
  });
  onTap($('btn-reset'), ()=>{ localStorage.removeItem(SKEY); location.reload(); });

  // Start/Stop
  function start(){ if(running) return; running=true; last=0; acc=0; requestAnimationFrame(loop); }
  function stop(){ running=false; }

  // First paint
  current=null; drawOnce();
})();