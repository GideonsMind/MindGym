// MindGym – stable build v4
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const state = {
    version: 4,
    xp: 0, level: 1, streak: 0,
    theme: 'dark', haptics: true, sounds: true, fps: 60,
    best: {focus:0, circle:0, span:0, nback:0, matrix:0},
    lastPlayed: null
  };

  const storageKey = 'mindgym:v4';
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      Object.assign(state, saved);
    } catch(e){ console.warn(e); }
  }
  function save() { localStorage.setItem(storageKey, JSON.stringify(state)); }
  load();

  const panel = $('#panel'), stage = $('#stage'), controls = $('#controls');
  const scoreEl = $('#score'), bestEl = $('#best');
  const levelEl = $('#level'), xpEl = $('#xp'), streakEl = $('#streak');

  function applyTheme() {
    document.documentElement.classList.toggle('theme-light', state.theme==='light');
    document.documentElement.classList.toggle('theme-amoled', state.theme==='amoled');
  }
  function renderStats(){
    levelEl.textContent = `Lvl ${state.level}`;
    xpEl.textContent = `XP ${state.xp}`;
    streakEl.textContent = `Streak ${state.streak}`;
  }
  applyTheme(); renderStats();

  const dlg = $('#dlgSettings');
  $('#btnSettings').addEventListener('click', () => {
    $('#theme').value = state.theme;
    $('#haptics').checked = state.haptics;
    $('#sounds').checked = state.sounds;
    $('#fps').value = String(state.fps);
    dlg.showModal();
  });
  $('#btnCloseSettings').addEventListener('click', () => dlg.close());
  $('#btnReset').addEventListener('click', () => {
    localStorage.removeItem(storageKey);
    location.reload();
  });
  $('#theme').addEventListener('change', e => { state.theme = e.target.value; applyTheme(); save(); });
  $('#haptics').addEventListener('change', e => { state.haptics = e.target.checked; save(); });
  $('#sounds').addEventListener('change', e => { state.sounds = e.target.checked; save(); });
  $('#fps').addEventListener('change', e => { state.fps = +e.target.value; save(); });

  // Audio
  let ctx;
  function beep(ms=80, freq=880){
    if(!state.sounds) return;
    try{
      ctx = ctx || new (window.AudioContext||window.webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); }, ms);
    }catch(e){}
  }
  function haptic() { if(state.haptics && 'vibrate' in navigator) navigator.vibrate(18); }

  function showPanel(title) { $('#panelTitle').textContent = title; panel.style.display = 'block'; }
  function hidePanel() { panel.style.display = 'none'; }
  $('#btnExit').addEventListener('click', hidePanel);
  $('#btnHow').addEventListener('click', () => alert($('#panelTitle').textContent + ' – quick instructions are shown inside the module.'));

  function updateScore(score, key) {
    scoreEl.textContent = score;
    if(score > (state.best[key]||0)) { state.best[key]=score; bestEl.textContent = score; save(); }
    else bestEl.textContent = state.best[key]||0;
  }

  $('#modules').addEventListener('click', e => {
    const btn = e.target.closest('[data-module]');
    if(!btn) return;
    const mod = btn.dataset.module;
    ({
      focus:modFocus, circle:modCircle, span:modSpan, nback:modNBack,
      matrix:modMatrix, notice60:modNotice, metacheck:modCheck, microjournal:modJournal
    }[mod])?.();
  });

  // Focus Tap
  function modFocus(){
    showPanel('Focus Tap'); stage.innerHTML=''; controls.innerHTML='';
    const grid = document.createElement('div'); grid.className='grid-3';
    const cells = Array.from({length:12}, ()=>{ const c=document.createElement('div'); c.className='cell'; grid.appendChild(c); return c; });
    stage.appendChild(grid);
    const start = button('Start'), stop = button('Stop'); controls.append(start, stop);
    let alive=false, score=0, hot=-1, timer;
    function tick(){
      cells.forEach(c=>c.className='cell');
      hot = Math.floor(Math.random()*cells.length);
      cells[hot].classList.add('hot'); beep(60,900);
      timer = setTimeout(tick, 1000/(state.fps/60));
    }
    cells.forEach((c,i)=>c.addEventListener('click', ()=>{
      if(!alive) return;
      if(i===hot){ score++; haptic(); beep(40,1200); updateScore(score,'focus'); }
      else { c.classList.add('bad'); score=Math.max(0,score-1); beep(90,330); updateScore(score,'focus'); }
    }));
    start.addEventListener('click', ()=>{ if(alive) return; alive=true; score=0; updateScore(0,'focus'); tick(); });
    stop.addEventListener('click', ()=>{ alive=false; clearTimeout(timer); cells.forEach(c=>c.className='cell'); });
    updateScore(0,'focus');
  }

  // Circle Hunt
  function modCircle(){
    showPanel('Circle Hunt'); stage.innerHTML=''; controls.innerHTML='';
    const grid = document.createElement('div'); grid.className='grid-3';
    stage.appendChild(grid);
    const start = button('Start'), stop = button('Stop'); controls.append(start, stop);
    let score=0, alive=false;
    function round(){
      grid.innerHTML='';
      const base = Math.floor(Math.random()*200)+30;
      const odd = (base+30)%360;
      const oddIndex = Math.floor(Math.random()*9);
      for(let i=0;i<9;i++){
        const cell = document.createElement('div'); cell.className='cell'; 
        const hue = i===oddIndex? odd: base;
        cell.style.background = `hsl(${hue} 80% 45% / .85)`;
        cell.addEventListener('click',()=>{
          if(!alive) return;
          if(i===oddIndex){ score++; haptic(); beep(60,1100); updateScore(score,'circle'); round(); }
          else { score=Math.max(0,score-1); beep(100,330); updateScore(score,'circle'); }
        });
        grid.appendChild(cell);
      }
    }
    start.addEventListener('click', ()=>{ alive=true; score=0; updateScore(0,'circle'); round(); });
    stop.addEventListener('click', ()=>{ alive=false; grid.innerHTML=''; });
    updateScore(0,'circle');
  }

  // Visual Span
  function modSpan(){
    showPanel('Visual Span'); stage.innerHTML=''; controls.innerHTML='';
    const grid = document.createElement('div'); grid.className='grid-3'; stage.appendChild(grid);
    const start = button('Start'), stop = button('Stop'); controls.append(start, stop);
    let seq=[], user=[], score=0, alive=false;
    const cells = Array.from({length:9}, (_,i)=>{
      const c = document.createElement('div'); c.className='cell'; c.addEventListener('click', ()=> pick(i)); grid.appendChild(c); return c;
    });
    function flash(i){ cells[i].classList.add('hot'); beep(70,950); setTimeout(()=>cells[i].classList.remove('hot'), 260); }
    function showSeq(n=0){ if(n>=seq.length){ return; } flash(seq[n]); setTimeout(()=>showSeq(n+1), 380); }
    function next(){ user=[]; seq.push(Math.floor(Math.random()*9)); setTimeout(()=>showSeq(), 420); }
    function pick(i){
      if(!alive) return;
      user.push(i);
      if(user[user.length-1]!==seq[user.length-1]){ score=Math.max(0,score-1); updateScore(score,'span'); beep(120,300); seq=[]; next(); }
      else { beep(50,1200); if(user.length===seq.length){ score++; haptic(); updateScore(score,'span'); next(); } }
    }
    start.addEventListener('click', ()=>{ alive=true; score=0; seq=[]; updateScore(0,'span'); next(); });
    stop.addEventListener('click', ()=>{ alive=false; seq=[]; user=[]; });
    updateScore(0,'span');
  }

  // N-Back (beta)
  function modNBack(){
    showPanel('N-Back (beta)'); stage.innerHTML=''; controls.innerHTML='';
    const grid = document.createElement('div'); grid.className='grid-3'; stage.appendChild(grid);
    const start = button('Start'), stop = button('Stop'); controls.append(start, stop);
    let n=2, seq=[], i=-1, score=0, alive=false, ticker;
    const cells = Array.from({length:9}, (_,j)=>{ const c=document.createElement('div'); c.className='cell'; grid.appendChild(c); return c; });
    function step(){ cells.forEach(c=>c.className='cell'); i = Math.floor(Math.random()*9); cells[i].classList.add('hot'); seq.push(i); beep(60,980); }
    function loop(){ step(); ticker = setTimeout(loop, 1200); }
    function answer(match){
      if(!alive) return;
      const ok = (seq.length>n) && (i===seq[seq.length-1-n]);
      const yes = match===true;
      if( (ok && yes) || (!ok && !yes) ){ score++; haptic(); beep(60,1180); }
      else { score=Math.max(0,score-1); beep(120,300); }
      updateScore(score,'nback');
    }
    const btnYes=button('Match'), btnNo=button('No Match'); controls.append(btnYes, btnNo);
    btnYes.addEventListener('click',()=>answer(true));
    btnNo.addEventListener('click',()=>answer(false));
    start.addEventListener('click', ()=>{ if(alive) return; alive=true; score=0; seq=[]; updateScore(0,'nback'); loop(); });
    stop.addEventListener('click', ()=>{ alive=false; clearTimeout(ticker); });
    updateScore(0,'nback');
  }

  // Matrix Mini
  function modMatrix(){
    showPanel('Matrix Mini (IQ)'); stage.innerHTML=''; controls.innerHTML='';
    const wrap = document.createElement('div'); wrap.style.textAlign='center'; stage.appendChild(wrap);
    let q=0, score=0;
    const puzzles = [
      {img:'🟦 🟦   🟦 ⬜   ⬜ ⬜', ans:'A', options:{A:'🟦',B:'⬜',C:'🟩'}},
      {img:'▲ ▲   ■ ■   ? ?', ans:'B', options:{A:'●',B:'■',C:'▲'}},
      {img:'● ▲ ■   ● ▲ ?  ', ans:'C', options:{A:'●',B:'▲',C:'■'}}
    ];
    const prompt = document.createElement('pre'); prompt.style.fontSize='28px'; prompt.textContent=''; wrap.appendChild(prompt);
    const opt = document.createElement('div'); opt.style.display='flex'; opt.style.gap='10px'; opt.style.justifyContent='center'; wrap.appendChild(opt);
    function show(){
      const p = puzzles[q%puzzles.length];
      prompt.textContent = p.img;
      opt.innerHTML='';
      for(const [k,v] of Object.entries(p.options)){
        const b = button(`${k}: ${v}`); b.addEventListener('click',()=>{
          if(k===p.ans){ score++; beep(60,1180); haptic(); } else { score=Math.max(0,score-1); beep(120,300); }
          updateScore(score,'matrix'); q++; show();
        });
        opt.appendChild(b);
      }
    }
    show(); updateScore(0,'matrix');
  }

  // Noticing 60s
  function modNotice(){
    showPanel('Noticing 60s'); stage.innerHTML=''; controls.innerHTML='';
    const ta = document.createElement('textarea'); ta.placeholder='Notice: thoughts, sensations, environment...'; ta.style.width='100%'; ta.style.minHeight='200px'; stage.appendChild(ta);
    const start = button('Start 60s'), saveBtn = button('Save note'); controls.append(start, saveBtn);
    let t; start.addEventListener('click', ()=>{ clearTimeout(t); beep(60,900); haptic(); t=setTimeout(()=>{ beep(180,600); alert('60 seconds!'); }, 60000); });
    saveBtn.addEventListener('click', ()=>{
      const log = JSON.parse(localStorage.getItem('mg:notice')||'[]'); log.push({t:Date.now(), text:ta.value}); localStorage.setItem('mg:notice', JSON.stringify(log)); ta.value=''; alert('Saved.');
    });
  }

  // Meta-Check
  function modCheck(){
    showPanel('Meta-Check'); stage.innerHTML=''; controls.innerHTML='';
    const form = document.createElement('div'); form.style.display='grid'; form.style.gap='10px';
    form.innerHTML = `
      <label>Focus (0-10): <input id="m-focus" type="range" min="0" max="10" value="6"></label>
      <label>Energy (0-10): <input id="m-energy" type="range" min="0" max="10" value="6"></label>
      <label>Calm (0-10): <input id="m-calm" type="range" min="0" max="10" value="6"></label>
    `;
    stage.appendChild(form);
    const saveBtn = button('Save snapshot'); controls.append(saveBtn);
    saveBtn.addEventListener('click', ()=>{
      const snap = {t:Date.now(), f:+$('#m-focus').value, e:+$('#m-energy').value, c:+$('#m-calm').value};
      const arr = JSON.parse(localStorage.getItem('mg:meta')||'[]'); arr.push(snap); localStorage.setItem('mg:meta', JSON.stringify(arr));
      beep(60,1000); haptic();
      alert('Saved.');
    });
  }

  // Micro-Journal
  function modJournal(){
    showPanel('Micro-Journal'); stage.innerHTML=''; controls.innerHTML='';
    const ta = document.createElement('textarea'); ta.placeholder='2-minute free write...'; ta.style.width='100%'; ta.style.minHeight='220px'; stage.appendChild(ta);
    let autosave = setInterval(()=>{
      const log = JSON.parse(localStorage.getItem('mg:journal')||'[]');
      log.push({t:Date.now(), text:ta.value.slice(0,800)});
      localStorage.setItem('mg:journal', JSON.stringify(log));
    }, 20000);
    controls.append(button('Stop'), button('Clear'));
    controls.firstChild.addEventListener('click',()=>{ clearInterval(autosave); });
    controls.lastChild.addEventListener('click',()=>{ ta.value=''; });
  }

  function button(label){ const b=document.createElement('button'); b.className='btn'; b.textContent=label; return b; }

  function init(){
    hidePanel();
    updateScore(0,'focus');
  }
  init();
})();