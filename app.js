
// MindGym App Logic
const VERSION = 4;
const KEY = 'mindgym-state-v' + VERSION;
const defaultState = {
  xp:0, lvl:1, streak:0, lastOpen: new Date().toISOString(),
  best: {focus:0, span:0, hunt:0, nback:0, matrix:0, noticing:0},
  settings: { theme:'system', haptics:true, sounds:true, fps:60 },
  journalDraft: ''
};

function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw){
      // migrate older
      const olderKey = Object.keys(localStorage).find(k=>k.startsWith('mindgym-state-v'));
      if(olderKey){ return JSON.parse(localStorage.getItem(olderKey)); }
      return {...defaultState};
    }
    const s = JSON.parse(raw);
    return {...defaultState, ...s, best:{...defaultState.best, ...(s.best||{})}, settings:{...defaultState.settings, ...(s.settings||{})} };
  }catch(e){ console.warn('state load',e); return {...defaultState}; }
}
function saveState(){ localStorage.setItem(KEY, JSON.stringify(state)); refreshHeader(); }
let state = loadState();

// streak daily bump
(function bumpStreak(){
  const last = new Date(state.lastOpen).toDateString();
  const now = new Date().toDateString();
  if(last !== now){
    const diff = (new Date(now) - new Date(last)) / (1000*3600*24);
    state.streak = (diff<=2) ? (state.streak + 1) : 0;
    state.lastOpen = new Date().toISOString();
    saveState();
  }
})();

function addXP(amount=10){
  state.xp += amount;
  const needed = 100 + (state.lvl-1)*25;
  if(state.xp >= needed){ state.xp -= needed; state.lvl++; toast(`Level Up! Lvl ${state.lvl}`); ping('level'); }
  saveState();
}

function refreshHeader(){
  document.getElementById('lvl').textContent = `Lvl ${state.lvl}`;
  document.getElementById('xp').textContent = `XP ${state.xp}`;
  document.getElementById('streak').textContent = `Streak ${state.streak}`;
}
refreshHeader();

// settings
const settingsDialog = document.getElementById('settings');
document.getElementById('btnSettings').addEventListener('click', ()=>settingsDialog.showModal());
['theme','haptics','sounds','fps'].forEach(id=>{
  const el = document.getElementById(id);
  if(!el) return;
  if(id==='theme') el.value = state.settings.theme;
  if(id==='haptics') el.checked = state.settings.haptics;
  if(id==='sounds') el.checked = state.settings.sounds;
  if(id==='fps') el.value = state.settings.fps;
});
document.getElementById('theme').addEventListener('change', e => { state.settings.theme = e.target.value; applyTheme(e.target.value); saveState(); });
document.getElementById('haptics').addEventListener('change', e => { state.settings.haptics = e.target.checked; saveState(); });
document.getElementById('sounds').addEventListener('change', e => { state.settings.sounds = e.target.checked; saveState(); });
document.getElementById('fps').addEventListener('change', e => { state.settings.fps = parseInt(e.target.value,10); saveState(); });
document.getElementById('btnReset').addEventListener('click', ()=>{
  if(confirm('Reset all progress?')){ state = {...defaultState}; saveState(); location.reload(); }
});
applyTheme(state.settings.theme);

function applyTheme(t){
  let target = 'dark';
  if(t==='light') target='light';
  else if(t==='system'){
    target = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }else if(t==='neon') target='neon';
  else if(t==='pastel') target='pastel';
  else if(t==='quittr') target='quittr';
  document.documentElement.setAttribute('data-theme', target);
}

function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 1500);
}

function ping(type='beep'){
  if(state.settings.haptics && 'vibrate' in navigator){ navigator.vibrate(type==='level' ? 60 : 20); }
  if(state.settings.sounds){ tone(type==='level'? 880: 440, 0.08); }
}
function tone(freq=440, duration=0.05){
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return;
  if(!window._ctx) window._ctx = new AC();
  const o = _ctx.createOscillator();
  const g = _ctx.createGain();
  o.type='sine'; o.frequency.value=freq;
  o.connect(g); g.connect(_ctx.destination);
  g.gain.setValueAtTime(0.0001, _ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.25, _ctx.currentTime + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, _ctx.currentTime + duration);
  o.start(); o.stop(_ctx.currentTime + duration + 0.01);
}

// UI
const moduleSec = document.getElementById('module');
const titleEl = document.getElementById('moduleTitle');
const stage = document.getElementById('stage');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnExit = document.getElementById('btnExit');
const btnHow = document.getElementById('btnHow');
const btnTutClose = document.getElementById('btnTutClose');
const tutCard = document.getElementById('tutorial');
const tTitle = document.getElementById('tTitle');
const tBody = document.getElementById('tBody');

let active = null;
function setScore(n){ scoreEl.textContent = n; }
function setBest(key, n){ state.best[key] = Math.max(state.best[key]||0, n); bestEl.textContent = state.best[key]; saveState(); }

// open module
document.querySelectorAll('.tile').forEach(b=>{
  b.addEventListener('click', ()=>{
    const mod = b.getAttribute('data-module');
    openModule(mod);
  });
});

function openModule(id){
  moduleSec.classList.remove('hidden');
  stage.innerHTML = '';
  setScore(0);
  bestEl.textContent = state.best[id]||0;
  let init = modules[id];
  titleEl.textContent = moduleNames[id] || 'Module';
  active = init ? init() : null;
}

btnExit.addEventListener('click', ()=>{
  if(active && active.stop) active.stop();
  moduleSec.classList.add('hidden');
  stage.innerHTML='';
});

btnStart.addEventListener('click', ()=>{ if(active && active.start) active.start(); });
btnStop .addEventListener('click', ()=>{ if(active && active.stop) active.stop(); });
btnHow  .addEventListener('click', ()=>{
  tTitle.textContent = 'How to Play';
  tBody.innerHTML = active && active.how ? active.how : 'Tap Start to begin.';
  tutCard.classList.remove('hidden');
});
btnTutClose.addEventListener('click', ()=>tutCard.classList.add('hidden'));

// modules
const moduleNames = {
  focus: 'Focus Tap',
  hunt: 'Circle Hunt',
  span: 'Visual Span',
  nback: 'N-Back (beta)',
  matrix: 'Matrix Mini (IQ)',
  noticing: 'Noticing 60s',
  metacheck: 'Meta-Check',
  journal: 'Micro-Journal'
};
const modules = {};

// Focus Tap
modules.focus = function(){
  let running=false, score=0, timer=null, target=null, timeWindow=1200, grid=16;
  function draw(){
    stage.innerHTML='';
    const wrap = document.createElement('div');
    wrap.style.display='grid';
    wrap.style.gridTemplateColumns='repeat(4,1fr)';
    wrap.style.gap='10px';
    for(let i=0;i<grid;i++){
      const d=document.createElement('div');
      d.className='cell';
      d.style.borderRadius='50%';
      d.textContent='';
      d.addEventListener('click', ()=>{
        if(!running) return;
        if(i===target){ score++; setScore(score); addXP(3); ping(); next(); }
        else { d.classList.add('bad'); setTimeout(()=>d.classList.remove('bad'), 250); score=Math.max(0,score-1); setScore(score); ping(); }
      });
      wrap.appendChild(d);
    }
    stage.appendChild(wrap);
  }
  function next(){
    const cells = [...stage.querySelectorAll('.cell')];
    cells.forEach(c=>c.classList.remove('highlight'));
    target = Math.floor(Math.random()*cells.length);
    cells[target].classList.add('highlight');
    clearTimeout(timer);
    timer = setTimeout(()=>{ // miss
      if(!running) return;
      score = Math.max(0, score-1);
      setScore(score);
      next();
    }, timeWindow);
    timeWindow = Math.max(500, timeWindow - 10); // harder
    setBest('focus', score);
  }
  function start(){ if(running) return; running=true; score=0; setScore(0); timeWindow=1200; draw(); next(); }
  function stop(){ running=false; clearTimeout(timer); setBest('focus', score); }
  return {start, stop, how:`Tap the highlighted circle before time runs out. It speeds up as you score.`};
};

// Circle Hunt
modules.hunt = function(){
  let running=false, score=0, n=12;
  function drawRound(){
    stage.innerHTML='';
    const wrap = document.createElement('div');
    wrap.style.display='grid';
    wrap.style.gridTemplateColumns='repeat(6,1fr)';
    wrap.style.gap='10px';
    const oddIndex = Math.floor(Math.random()*n);
    const base = Math.floor(Math.random()*180)+40;
    for(let i=0;i<n;i++){
      const d = document.createElement('div');
      d.className='cell';
      d.style.borderRadius='50%';
      const size = i===oddIndex ? base+6 : base;
      d.style.width = d.style.height = size+'px';
      d.style.margin='0 auto';
      d.addEventListener('click', ()=>{
        if(!running) return;
        if(i===oddIndex){ score++; setScore(score); addXP(4); n = Math.min(36, n+1); ping(); drawRound(); }
        else { score=Math.max(0,score-1); setScore(score); ping(); }
        setBest('hunt', score);
      });
      wrap.appendChild(d);
    }
    stage.appendChild(wrap);
  }
  function start(){ running=true; score=0; n=12; setScore(0); drawRound(); }
  function stop(){ running=false; setBest('hunt', score); }
  return {start, stop, how:`Find the one circle that looks slightly different (size). It gets trickier each round.`};
};

// Visual Span (3x3)
modules.span = function(){
  let running=false, score=0, seq=[], input=[], len=3, flashTimer=null;
  const grid = document.createElement('div');
  grid.className = 'grid9';
  for(let i=0;i<9;i++){
    const c = document.createElement('button');
    c.className='cell';
    c.addEventListener('click', ()=>{
      if(!running) return;
      input.push(i);
      c.classList.add('highlight');
      setTimeout(()=>c.classList.remove('highlight'),150);
      if(input.length===seq.length){
        // check
        const ok = input.every((v,idx)=>v===seq[idx]);
        if(ok){ score++; setScore(score); addXP(5); len++; next(); ping(); }
        else { score=0; setScore(score); len=3; next(); ping(); }
        setBest('span', score);
      }
    });
    grid.appendChild(c);
  }
  function showSeq(){
    const cells = [...grid.children];
    let k=0;
    function flash(){
      if(k>=seq.length){ return; }
      const idx = seq[k++];
      cells[idx].classList.add('highlight');
      setTimeout(()=>cells[idx].classList.remove('highlight'), 350);
      flashTimer = setTimeout(flash, 420);
    }
    flash();
  }
  function next(){
    input=[]; seq=[];
    while(seq.length<len){
      const r = Math.floor(Math.random()*9);
      if(seq[seq.length-1]!==r) seq.push(r);
    }
    stage.innerHTML='';
    stage.appendChild(grid);
    showSeq();
  }
  function start(){ running=true; score=0; len=3; setScore(0); next(); }
  function stop(){ running=false; clearTimeout(flashTimer); setBest('span', score); }
  return {start, stop, how:`Watch the cells flash in sequence, then tap them in the same order.`};
};

// N-Back (letters)
modules.nback = function(){
  let running=false, score=0, N=1, streamTimer=null, hist=[];
  const wrap = document.createElement('div');
  wrap.style.display='grid'; wrap.style.placeItems='center'; wrap.style.gap='10px';
  const big = document.createElement('div'); big.style.fontSize='72px'; big.style.fontWeight='800';
  const controls = document.createElement('div');
  const matchBtn = document.createElement('button'); matchBtn.className='btn primary'; matchBtn.textContent='Match';
  const nsel = document.createElement('select');
  [1,2,3].forEach(v=>{ const o=document.createElement('option'); o.value=v; o.text=v+'-back'; if(v===1) o.selected=true; nsel.appendChild(o); });
  controls.appendChild(matchBtn); controls.appendChild(nsel);
  wrap.appendChild(big); wrap.appendChild(controls);
  stage.innerHTML=''; stage.appendChild(wrap);

  function nextLetter(){
    const letters = "BCDFGHJKLMNPQRSTVWXYZ";
    const ch = letters[Math.floor(Math.random()*letters.length)];
    big.textContent = ch;
    hist.push(ch);
    if(hist.length>10) hist.shift();
  }
  function tick(){
    nextLetter();
    streamTimer = setTimeout(tick, 1200);
  }
  matchBtn.addEventListener('click', ()=>{
    if(!running) return;
    const ok = hist.length> N && hist[hist.length-1] === hist[hist.length-1-N];
    if(ok){ score++; setScore(score); addXP(6); ping(); }
    else { score=Math.max(0,score-1); setScore(score); ping(); }
    setBest('nback', score);
  });
  nsel.addEventListener('change', ()=>{ N=parseInt(nsel.value,10); score=0; setScore(0); });
  function start(){ running=true; score=0; setScore(0); N=parseInt(nsel.value,10); tick(); }
  function stop(){ running=false; clearTimeout(streamTimer); setBest('nback', score); }
  return {start, stop, how:`Watch the letters. Tap "Match" when the current letter is the same as the one from N steps earlier.`};
};

// Matrix Mini (3 puzzles)
modules.matrix = function(){
  let running=false, score=0, idx=0;
  const puzzles = [
    { q:'Complete the 2×2: pattern increases by one dot each cell.', opts:['1','2','3','4'], correct: '3' },
    { q:'Arrow rotates 90° each step. Pick the missing orientation.', opts:['↑','→','↓','←'], correct: '↓' },
    { q:'Shade alternates like a checker. Choose the right shade.', opts:['▢','■','▢','■'], correct: '▢' }
  ];
  const qEl = document.createElement('div'); qEl.style.margin='12px 0';
  const optsEl = document.createElement('div'); optsEl.style.display='flex'; optsEl.style.gap='8px'; optsEl.style.flexWrap='wrap';
  stage.innerHTML=''; stage.appendChild(qEl); stage.appendChild(optsEl);
  function render(){
    const p = puzzles[idx];
    qEl.textContent = `Puzzle ${idx+1}/${puzzles.length}: ${p.q}`;
    optsEl.innerHTML='';
    p.opts.forEach(o=>{
      const b=document.createElement('button'); b.className='btn'; b.textContent=o;
      b.addEventListener('click', ()=>{
        if(!running) return;
        if(o===p.correct){ score++; setScore(score); addXP(8); ping(); }
        else { score=Math.max(0,score-1); setScore(score); ping(); }
        setBest('matrix', score);
        idx = (idx+1)%puzzles.length;
        render();
      });
      optsEl.appendChild(b);
    });
  }
  function start(){ running=true; score=0; setScore(0); idx=0; render(); }
  function stop(){ running=false; setBest('matrix', score); }
  return {start, stop, how:`Raven-style mini puzzles: infer the missing piece using simple rules (rotation, progression, shading).`};
};

// Noticing 60s
modules.noticing = function(){
  let running=false, score=0, t=60, timer=null;
  const txt = document.createElement('div'); txt.className='notice'; txt.textContent='For 60 seconds, notice details around you. Tap "Log" each time you notice something specific.';
  const cnt = document.createElement('div'); cnt.style.fontSize='28px'; cnt.style.margin='10px 0'; cnt.textContent='60';
  const logBtn = document.createElement('button'); logBtn.className='btn primary'; logBtn.textContent='Log';
  const list = document.createElement('div'); list.className='list';
  logBtn.addEventListener('click', ()=>{ if(!running) return; score++; setScore(score); addXP(2); ping(); const tag=document.createElement('span'); tag.className='tag'; tag.textContent='noticed'; list.appendChild(tag); });
  stage.innerHTML=''; stage.appendChild(txt); stage.appendChild(cnt); stage.appendChild(logBtn); stage.appendChild(list);
  function tick(){
    if(!running) return;
    t--; cnt.textContent = String(t);
    if(t<=0){ stop(); toast(`Noticing done: ${score}`); return; }
    timer = setTimeout(tick, 1000);
  }
  function start(){ running=true; score=0; setScore(0); t=60; cnt.textContent='60'; list.innerHTML=''; tick(); }
  function stop(){ running=false; clearTimeout(timer); setBest('noticing', score); }
  return {start, stop, how:`For one minute, rapidly notice concrete details (colors, shapes, sounds). Tap "Log" each time.`};
};

// Meta-Check (every 30s prompts for 2 minutes)
modules.metacheck = function(){
  let running=false, score=0, prompts=['What am I focusing on right now?','Is this helpful for my goal?','What will I do next?'], t=120, timer=null;
  const q = document.createElement('div'); q.className='notice'; q.textContent='Press Start to begin 2-minute meta-check. Prompts appear every 30 seconds.';
  const cnt = document.createElement('div'); cnt.style.fontSize='28px'; cnt.style.margin='10px 0'; cnt.textContent='120';
  stage.innerHTML=''; stage.appendChild(q); stage.appendChild(cnt);
  function tick(){
    if(!running) return;
    t--; cnt.textContent = String(t);
    if(t%30===0){ q.textContent = prompts[(t/30)%prompts.length]; ping(); }
    if(t<=0){ stop(); toast('Meta-Check complete'); }
    timer = setTimeout(tick, 1000);
  }
  function start(){ running=true; score=0; setScore(0); t=120; q.textContent='Starting…'; tick(); }
  function stop(){ running=false; clearTimeout(timer); }
  return {start, stop, how:`Every 30s for 2 minutes, you’ll get a quick self-monitoring prompt. Answer silently; the point is noticing.`};
};

// Micro-Journal
modules.journal = function(){
  let running=false, timer=null, t=120;
  stage.innerHTML='';
  const tip = document.createElement('div'); tip.className='notice'; tip.textContent='2-minute micro-journal. Write anything you notice about your thoughts/feelings. Autosaves.';
  const ta = document.createElement('textarea'); ta.className='journal'; ta.placeholder='Start typing…';
  ta.value = state.journalDraft || '';
  ta.addEventListener('input', ()=>{ state.journalDraft = ta.value; saveState(); });
  const cnt = document.createElement('div'); cnt.className='counter'; cnt.textContent='120s';
  stage.appendChild(tip); stage.appendChild(ta); stage.appendChild(cnt);
  function tick(){
    if(!running) return;
    t--; cnt.textContent = t + 's';
    if(t<=0){ stop(); toast('Saved'); addXP(10); }
    timer = setTimeout(tick, 1000);
  }
  function start(){ running=true; t=120; cnt.textContent='120s'; tick(); }
  function stop(){ running=false; clearTimeout(timer); }
  return {start, stop, how:`Write continuously for 2 minutes. Don’t overthink grammar or spelling. Autosaves as you type.`};
};
