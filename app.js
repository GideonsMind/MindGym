/* ===== storage & settings ===== */
const store = {
  get() {
    try { return JSON.parse(localStorage.getItem('mindgym')||'{}'); }
    catch { return {}; }
  },
  set(data) { localStorage.setItem('mindgym', JSON.stringify(data)); }
};
const state = Object.assign({
  level:1, xp:0, best:{}, streak:0,
  settings:{ theme:'dark', haptics:true, sounds:true, fps:60 }
}, store.get());

function save(){ store.set(state); syncHeader(); }
function syncHeader(){
  byId('level').textContent = state.level;
  byId('xp').textContent = state.xp;
  byId('streak').textContent = state.streak;
}

/* ===== dom helpers ===== */
const byId = id => document.getElementById(id);
const $home = byId('home');
const $gameScreen = byId('gameScreen');
const $gameArea = byId('gameArea');
const $score = byId('score'); const $best = byId('best');
const $title = byId('gameTitle');

function setTheme(name){
  document.documentElement.classList.remove('light','dark','oled');
  if(['light','oled'].includes(name)) document.documentElement.classList.add(name);
  else document.documentElement.classList.add('dark');
}

/* ===== audio (simple beep) ===== */
let audioCtx = null;
function beep(freq=880, ms=80){
  if(!state.settings.sounds) return;
  try{
    audioCtx ??= new (window.AudioContext||window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = 0.05;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); setTimeout(()=>{o.stop();}, ms);
  }catch{}
}
/* ===== haptics ===== */
function buzz(ms=20){ if(state.settings.haptics && navigator.vibrate) navigator.vibrate(ms); }

/* ===== game loop util (fps cap) ===== */
function loop(fn, fps=60){
  let id=0, running=false, last=0, step=1000/Math.max(1,fps);
  function frame(t){
    if(!running) return;
    if(t-last>=step){ last=t; fn(); }
    id = requestAnimationFrame(frame);
  }
  return {
    start(){ if(!running){ running=true; id=requestAnimationFrame(frame); } },
    stop(){ running=false; cancelAnimationFrame(id); }
  };
}

/* ===== modules ===== */
const Modules = {
  /* Focus Tap: tap highlighted circle quickly */
  focusTap:{
    name:'Focus Tap',
    how:'Tap the circle that lights up. Gets faster over time.',
    start(ctx){
      const size = 3; // 3x3 grid
      let score=0, speed=900;
      $gameArea.innerHTML = '';
      const board = document.createElement('div');
      board.className='board'; board.style.gridTemplateColumns=`repeat(${size},56px)`;
      const cells=[];
      for(let i=0;i<size*size;i++){
        const c=document.createElement('button');
        c.className='circle'; board.appendChild(c); cells.push(c);
      }
      $gameArea.appendChild(board);
      let idx=-1;
      function light(){
        cells.forEach(c=>c.classList.remove('highlight'));
        idx = Math.floor(Math.random()*cells.length);
        cells[idx].classList.add('highlight');
        beep(900,60);
      }
      cells.forEach((c,i)=>{
        c.onclick=()=>{
          if(i===idx){
            score++; addXP(2);
            $score.textContent=score; buzz(10); beep(1200,60);
            speed = Math.max(300, speed-20);
            schedule();
          }else{
            miss();
          }
        };
      });
      function miss(){ stop(); finalize(score); }
      let timer;
      function schedule(){ clearTimeout(timer); light(); timer=setTimeout(miss, speed+400); }
      function stop(){ clearTimeout(timer); }
      ctx.onStop = ()=> stop();
      $score.textContent='0'; $best.textContent=(state.best.focusTap||0);
      schedule();
    }
  },

  /* Circle Hunt: find odd circle among many */
  circleHunt:{
    name:'Circle Hunt',
    how:'One circle is slightly different. Find it!',
    start(ctx){
      $score.textContent='0'; $best.textContent=(state.best.circleHunt||0);
      let round=0, score=0;
      function roundPlay(){
        round++;
        const n = Math.min(6, 3+Math.floor(round/2));
        const total = n*n;
        const odd = Math.floor(Math.random()*total);
        const hue = Math.floor(Math.random()*360);
        const delta = Math.max(3, 12-Math.floor(round/2)); // difference shrinks
        $gameArea.innerHTML='';
        const board=document.createElement('div');
        board.className='board'; board.style.gridTemplateColumns=`repeat(${n},56px)`;
        for(let i=0;i<total;i++){
          const c=document.createElement('button');
          c.className='circle';
          c.style.background = `hsl(${hue}, 55%, 22%)`;
          c.style.borderColor = `hsl(${hue}, 55%, 28%)`;
          if(i===odd){
            c.classList.add('odd');
            c.style.filter=`brightness(${1+delta/40})`;
            c.onclick=()=>{
              score++; addXP(3); $score.textContent=score; buzz(10); beep(1100,60);
              roundPlay();
            };
          }else{
            c.onclick=()=>{ finalize(score); };
          }
          board.appendChild(c);
        }
        $gameArea.appendChild(board);
      }
      ctx.onStop = ()=> finalize(score);
      roundPlay();
    }
  },

  /* Visual Span: remember sequence of cells */
  visualSpan:{
    name:'Visual Span',
    how:'Watch the flash sequence, then tap the circles in the same order.',
    start(ctx){
      const size=3;
      const board=document.createElement('div');
      board.className='board'; board.style.gridTemplateColumns=`repeat(${size},56px)`;
      const cells=[];
      for(let i=0;i<size*size;i++){
        const c=document.createElement('button'); c.className='circle'; board.appendChild(c); cells.push(c);
      }
      $gameArea.innerHTML=''; $gameArea.appendChild(board);
      $score.textContent='0'; $best.textContent=(state.best.visualSpan||0);

      let level=3, seq=[], pos=0, score=0, playing=false;

      function flashSequence(){
        seq = Array.from({length:level}, () => Math.floor(Math.random()*cells.length));
        let i=0; playing=true; pos=0;
        const iv = setInterval(()=>{
          cells.forEach(c=>c.classList.remove('highlight'));
          const j=seq[i]; cells[j].classList.add('highlight'); beep(900,80);
          setTimeout(()=>cells[j].classList.remove('highlight'), 250);
          i++; if(i>=seq.length){ clearInterval(iv); playing=false; }
        }, 400);
      }

      cells.forEach((c,idx)=>{
        c.onclick=()=>{
          if(playing) return;
          c.classList.add('highlight'); setTimeout(()=>c.classList.remove('highlight'),120);
          if(seq[pos]===idx){
            pos++; buzz(8); beep(1200,40);
            if(pos===seq.length){
              score++; addXP(4); $score.textContent=score; level=Math.min(8, level+1); flashSequence();
            }
          }else{
            finalize(score);
          }
        };
      });

      ctx.onStop = ()=> finalize(score);
      flashSequence();
    }
  },

  /* N-back (1-back quick demo) */
  nBack:{
    name:'N-Back (beta)',
    how:'Press “Start” then tap when the current letter matches the one just before it.',
    start(ctx){
      $gameArea.innerHTML = '<div class="letter" style="font-size:72px;font-weight:800">–</div>';
      const el = $gameArea.firstChild;
      $score.textContent='0'; $best.textContent=(state.best.nBack||0);
      let sequence='ABCDEFGHIKLMNOPQRST'; // no J to avoid confusion
      let prev='', score=0;
      function next(){
        const ch = sequence[Math.floor(Math.random()*sequence.length)];
        el.textContent = ch;
        if(ch===prev){ el.style.color='var(--accent)'; } else { el.style.color='var(--text)'; }
        prev = ch;
      }
      const runner = loop(()=>{
        next();
      }, Math.min(60, state.settings.fps));
      $gameArea.onclick=()=>{
        if(el.textContent===prev){ // user clicked AFTER update; make it fair:
          // treat match as previous equals current -> slightly adjust:
          addXP(2); score++; $score.textContent=score; buzz(10); beep(1000,60);
        }
      };
      runner.start();
      ctx.onStop = ()=>{ runner.stop(); finalize(score); };
    }
  },

  /* Placeholder (to avoid broken screen) */
  matrixMini:{
    name:'Matrix Mini (IQ)',
    how:'Coming soon. Practice simple 2×2 Raven-style pattern picks.',
    start(ctx){
      $gameArea.innerHTML = '<p style="color:var(--muted);text-align:center">This module will arrive in an upcoming update.</p>';
      ctx.onStop = ()=>{};
    }
  }
};

/* ===== score / xp ===== */
function addXP(amount){
  state.xp += amount;
  const need = 100 + (state.level-1)*50;
  if(state.xp >= need){ state.xp -= need; state.level++; }
  save();
}
function finalize(score){
  const key = currentModuleKey;
  state.best[key] = Math.max(state.best[key]||0, score);
  $best.textContent = state.best[key];
  save();
}

/* ===== UI wiring ===== */
let currentModuleKey=null;
const ctx = { onStop:()=>{} };

document.querySelectorAll('.module').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    currentModuleKey = btn.dataset.module;
    const mod = Modules[currentModuleKey];
    if(!mod) return;
    $title.textContent = mod.name;
    $home.classList.add('hidden');
    $gameScreen.classList.remove('hidden');
    $score.textContent = '0';
    $best.textContent = state.best[currentModuleKey] || 0;
    byId('btnHow').onclick = ()=> alert(mod.how);
    startModule();
  });
});

function startModule(){
  const mod = Modules[currentModuleKey];
  if(!mod) return;
  ctx.onStop(); // stop previous if any
  mod.start(ctx);
}

byId('btnStart').onclick = ()=> startModule();
byId('btnStop').onclick  = ()=> ctx.onStop();
byId('btnExit').onclick  = ()=>{
  ctx.onStop();
  $gameScreen.classList.add('hidden');
  $home.classList.remove('hidden');
};

/* settings modal */
const dlg = byId('dlgSettings');
byId('btnSettings').onclick = ()=> {
  setTheme(state.settings.theme);
  byId('themeSelect').value = state.settings.theme;
  byId('toggleHaptics').checked = state.settings.haptics;
  byId('toggleSounds').checked = state.settings.sounds;
  byId('fpsSelect').value = state.settings.fps;
  dlg.showModal();
};
byId('btnClose').onclick = ()=> dlg.close();
byId('btnReset').onclick = ()=>{
  if(confirm('Reset all local progress?')){
    localStorage.removeItem('mindgym'); location.reload();
  }
};
byId('themeSelect').onchange = e => {
  state.settings.theme = e.target.value; setTheme(state.settings.theme); save();
};
byId('toggleHaptics').onchange = e => { state.settings.haptics = e.target.checked; save(); };
byId('toggleSounds').onchange = e => { state.settings.sounds = e.target.checked; save(); };
byId('fpsSelect').onchange     = e => { state.settings.fps = parseInt(e.target.value,10)||60; save(); };

/* initial paint */
setTheme(state.settings.theme);
syncHeader();
