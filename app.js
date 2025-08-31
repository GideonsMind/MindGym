/* MindGym Final */
const APP_VERSION = "2.0.0-final";
const $ = s => document.querySelector(s);
const on = (el,ev,fn,opts)=> el.addEventListener(ev,fn,opts);
const store = { get:(k,d=null)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}}, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)) };

// Debounce taps
let tapLock=false; function safeTap(fn){ return (...a)=>{ if(tapLock) return; tapLock=true; fn(...a); setTimeout(()=>tapLock=false,200); }; }

// Sounds (WebAudio beeps, no external files)
let audioCtx=null; function beep(freq=600, ms=90, type='sine', gain=0.03){
  if(!settings.sfx) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = type; o.frequency.value=freq; g.gain.value=gain;
    o.connect(g).connect(audioCtx.destination); o.start();
    setTimeout(()=>{o.stop();}, ms);
  }catch{}
}
function haptic(ms=25){ if(settings.haptics && navigator.vibrate) navigator.vibrate(ms); }

// Confetti (simple canvas particles)
const confettiCanvas = $("#confetti"); const cfx = confettiCanvas.getContext("2d");
let confettiActive=false, confettiParts=[];
function launchConfetti(count=80){
  if(!settings.confetti) return;
  resizeCanvas();
  confettiActive = true; confettiParts = [];
  for(let i=0;i<count;i++){
    confettiParts.push({
      x: Math.random()*confettiCanvas.width,
      y: -10 - Math.random()*confettiCanvas.height*0.2,
      r: 4+Math.random()*4,
      c: ["#4bd6b5","#7c5cff","#ffbe3b","#ff6b6b"][Math.floor(Math.random()*4)],
      vx: -1+Math.random()*2, vy: 1+Math.random()*2, rot: Math.random()*Math.PI
    });
  }
  requestAnimationFrame(confettiTick);
}
function confettiTick(){
  if(!confettiActive) return;
  cfx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
  confettiParts.forEach(p=>{
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.02; p.rot+=0.05;
    cfx.save(); cfx.translate(p.x,p.y); cfx.rotate(p.rot);
    cfx.fillStyle=p.c; cfx.fillRect(-p.r,-p.r,p.r*2,p.r*2); cfx.restore();
  });
  confettiParts = confettiParts.filter(p=> p.y < confettiCanvas.height+20);
  if(confettiParts.length) requestAnimationFrame(confettiTick); else confettiActive=false;
}
function resizeCanvas(){ confettiCanvas.width=innerWidth; confettiCanvas.height=innerHeight; }
window.addEventListener("resize", resizeCanvas);

// Settings
const defaultSettings = { sfx:true, haptics:true, confetti:true, reduced:false, theme:{type:"preset", id:"sleek-dark"} };
const settings = Object.assign({}, defaultSettings, store.get("mg_settings", {}));
function saveSettings(){ store.set("mg_settings", settings); }

// Themes
const THEMES=[
 {id:"sleek-dark",name:"Sleek Dark (Quittr-ish)",vars:{bg:"#0e1014",fg:"#e9edf5",card:"#151922",accent:"#4bd6b5",muted:"#8a93a7"}},
 {id:"neon",name:"Neon Glow",vars:{bg:"#06070c",fg:"#f3f6ff",card:"#0f1320",accent:"#7c5cff",muted:"#8a90ad"}},
 {id:"cream",name:"Cream Light",vars:{bg:"#f6f7fb",fg:"#171a22",card:"#ffffff",accent:"#2f80ed",muted:"#6b7280"}},
 {id:"midnight",name:"Midnight Blue",vars:{bg:"#0a0f1c",fg:"#dfe7ff",card:"#11182a",accent:"#4db2ff",muted:"#8aa3c2"}},
 {id:"solar",name:"Soft Solar",vars:{bg:"#fdf6e3",fg:"#073642",card:"#fffaf0",accent:"#cb4b16",muted:"#5b6a70"}},
 {id:"ocean",name:"Ocean Mint",vars:{bg:"#0e1716",fg:"#e8fffb",card:"#11201d",accent:"#36e1b6",muted:"#95a9a6"}}
];
function applyVars(vars){ for(const [k,v] of Object.entries(vars)) document.documentElement.style.setProperty(`--${k}`,v); }
function setThemePreset(id){ const t=THEMES.find(x=>x.id===id)||THEMES[0]; applyVars(t.vars); settings.theme={type:"preset",id:t.id}; saveSettings(); }
function setThemeCustom(vars){ applyVars(vars); settings.theme={type:"custom",vars}; saveSettings(); }
function loadTheme(){
  const t=settings.theme||defaultSettings.theme;
  if(t.type==="custom") applyVars(t.vars); else setThemePreset(t.id);
  updateActiveThemeName();
}
function updateActiveThemeName(){
  const t=settings.theme;
  $("#activeThemeName")?.textContent = t.type==="preset" ? (THEMES.find(x=>x.id===t.id)?.name||"Theme") : "Custom";
}
function buildThemeGrid(){
  const grid=$("#themeGrid"); grid.innerHTML="";
  THEMES.forEach(t=>{
    const b=document.createElement("button"); b.className="swatch";
    b.innerHTML=`<div class="sample" style="background:${t.vars.card}"></div>
                 <div class="sample" style="background:${t.vars.accent}"></div>
                 <div class="name">${t.name}</div>`;
    on(b,"click",safeTap(()=>{ setThemePreset(t.id); updateActiveThemeName(); }));
    grid.appendChild(b);
  });
}
function rgbToHex(v){ if(v.trim().startsWith("#")) return v.trim();
  const m=v.match(/(\d+),\s*(\d+),\s*(\d+)/); if(!m) return "#ffffff";
  const h=n=>Number(n).toString(16).padStart(2,"0"); return `#${h(m[1])}${h(m[2])}${h(m[3])}`; }
function loadPickers(){
  const s=getComputedStyle(document.documentElement);
  $("#cBg").value=rgbToHex(s.getPropertyValue("--bg"));
  $("#cCard").value=rgbToHex(s.getPropertyValue("--card"));
  $("#cFg").value=rgbToHex(s.getPropertyValue("--fg"));
  $("#cAccent").value=rgbToHex(s.getPropertyValue("--accent"));
  $("#cMuted").value=rgbToHex(s.getPropertyValue("--muted"));
}
const currentVars=()=>({bg:$("#cBg").value,card:$("#cCard").value,fg:$("#cFg").value,accent:$("#cAccent").value,muted:$("#cMuted").value});

// Settings UI
const drawer=$("#drawer"), backdrop=$("#backdrop");
function openSettings(){ backdrop.hidden=false; drawer.hidden=false; requestAnimationFrame(()=>drawer.classList.add("open")); document.body.style.overflow="hidden"; loadPickers(); syncToggles(); }
function closeSettings(){ drawer.classList.remove("open"); setTimeout(()=>{backdrop.hidden=true;drawer.hidden=true;},180); document.body.style.overflow=""; }
function syncToggles(){ $("#sfxToggle").checked=settings.sfx; $("#hapticsToggle").checked=settings.haptics; $("#confettiToggle").checked=settings.confetti; $("#reducedMotion").checked=settings.reduced; }
on($("#openSettings"),"click",safeTap(openSettings));
on($("#closeSettings"),"click",safeTap(closeSettings));
on(backdrop,"click",safeTap(closeSettings));
on(document,"keydown",e=>{ if(e.key==="Escape"&&!drawer.hidden) closeSettings(); });
on($("#saveCustom"),"click",safeTap(()=>{ setThemeCustom(currentVars()); updateActiveThemeName(); }));
on($("#resetCustom"),"click",safeTap(()=>{ setThemePreset("sleek-dark"); loadPickers(); }));
on($("#sfxToggle"),"change",e=>{ settings.sfx=e.target.checked; saveSettings(); beep(700,70); });
on($("#hapticsToggle"),"change",e=>{ settings.haptics=e.target.checked; saveSettings(); haptic(15); });
on($("#confettiToggle"),"change",e=>{ settings.confetti=e.target.checked; saveSettings(); if(e.target.checked) launchConfetti(40); });
on($("#reducedMotion"),"change",e=>{ settings.reduced=e.target.checked; saveSettings(); });

// Progress / leveling
const prog = Object.assign({ level:1, xp:0, bestScores:{}, streak:0, lastDay:null }, store.get("mg_prog",{}));
function saveProg(){ store.set("mg_prog", prog); updateHUD(); }
function addXP(n){ prog.xp += n; let need = 100 + (prog.level-1)*50; while(prog.xp>=need){ prog.xp-=need; prog.level++; need = 100 + (prog.level-1)*50; celebrate(); } saveProg(); }
function celebrate(){ beep(880,120,'triangle',0.04); haptic(40); launchConfetti(90); }
function updateHUD(){ $("#levelVal").textContent=prog.level; $("#xpVal").textContent=prog.xp; $("#streakVal").textContent=prog.streak; }
function bumpStreak(){ const today=new Date().toDateString(); if(prog.lastDay!==today){ prog.lastDay=today; prog.streak++; saveProg(); } }

// Navigation between Home and Module
const screenHome=$("#screenHome"), screenModule=$("#screenModule"), moduleRoot=$("#moduleRoot");
let currentModule=null, playing=false, score=0, best=0;
const MODULES = {
  focusTap: {
    title:"Focus Tap",
    desc:"One circle lights up at a time. Tap it quickly. Speed increases.",
    init(root){ root.innerHTML=''; const circle=document.createElement('div'); circle.className='circle'; root.appendChild(circle); this.circle=circle; this.ms=900; this.timer=null; },
    start(){ score=0; updateScore(); this.ms=900; this.tick(); },
    stop(){ clearTimeout(this.timer); },
    tick(){ const c=this.circle; c.classList.remove('active'); void c.offsetWidth; c.classList.add('active'); const handler = safeTap(()=>{ score++; addXP(5); beep(620,60); haptic(12); updateScore(); c.removeEventListener('click', handler); this.ms=Math.max(280,this.ms-20); this.timer=setTimeout(()=>this.tick(), settings.reduced? this.ms: this.ms); }); c.addEventListener('click', handler, {once:true}); this.timer=setTimeout(()=>{ // missed
        c.classList.remove('active'); beep(220,80,'sawtooth',0.02); updateScore();
        if(score<=0) return; // end if no score yet
        this.ms = Math.min(this.ms+40, 1100);
        this.timer=setTimeout(()=>this.tick(), this.ms);
      }, this.ms+600);
    }
  },
  circleHunt: {
    title:"Circle Hunt",
    desc:"Find the odd circle among similar ones. Grids get denser.",
    init(root){ root.innerHTML=''; this.size=3; this.render(root); },
    start(){ score=0; updateScore(); this.size=3; this.render(moduleRoot); },
    stop(){ /* static */ },
    render(root){
      root.innerHTML='';
      const grid=document.createElement('div'); grid.className='grid-board';
      const n=this.size; grid.style.gridTemplateColumns=`repeat(${n}, 40px)`;
      const odd = Math.floor(Math.random()*(n*n)); const oddHue = Math.random()*360;
      for(let i=0;i<n*n;i++){
        const cell=document.createElement('div'); cell.className='cell';
        const base=`hsl(${oddHue}, 60%, 55%)`; const off=`hsl(${oddHue}, 60%, 65%)`;
        cell.style.background = i===odd ? off : base;
        if(i===odd){ on(cell,'click',safeTap(()=>{ score++; addXP(8); beep(700,70); haptic(15); updateScore(); if(score%3===0 && this.size<10) this.size++; this.render(root);})); }
        grid.appendChild(cell);
      }
      root.appendChild(grid);
    }
  },
  visualSpan: {
    title:"Visual Span",
    desc:"A sequence of squares flashes. Repeat the order by tapping.",
    init(root){ this.level=3; this.seq=[]; this.user=[]; root.innerHTML='<div class="sequence" id="vsSeq"></div>'; const seqEl=$("#vsSeq"); for(let i=0;i<10;i++){ const d=document.createElement('div'); d.className='seq-cell'; seqEl.appendChild(d); } this.cells=[...seqEl.children]; },
    async start(){ score=0; updateScore(); this.level=3; await this.playRound(); },
    stop(){ /* noop */ },
    async playRound(){
      this.seq = Array.from({length:this.level},()=> Math.floor(Math.random()*this.cells.length));
      await this.flashSeq();
      this.user=[];
      this.enableInput();
    },
    async flashSeq(){
      for(const idx of this.seq){
        await new Promise(r=>setTimeout(r, 350));
        this.cells[idx].classList.add('flash'); beep(660,80); haptic(10);
        await new Promise(r=>setTimeout(r, 300));
        this.cells[idx].classList.remove('flash');
      }
    },
    enableInput(){
      this.cells.forEach((c,i)=>{
        c.onclick = safeTap(()=>{
          this.user.push(i); beep(520,50);
          if(this.user[this.user.length-1]!==this.seq[this.user.length-1]){
            // wrong
            this.cells.forEach(x=>x.onclick=null); beep(220,160,'square',0.03);
            if(score>best) best=score; updateBest();
          }else if(this.user.length===this.seq.length){
            score++; addXP(12); updateScore(); this.level=Math.min(10,this.level+1); this.cells.forEach(x=>x.onclick=null); this.playRound();
          }
        });
      });
    }
  },
  nback: {
    title:"N‑Back (beta)",
    desc:"3×3 grid. Tap when the current square matches the one N steps back.",
    init(root){ root.innerHTML='<div class="nback-board"><div class="nback-grid" id="nbGrid"></div><div class="row gap"><label>N: <input id="nbN" type="number" min="1" max="4" value="2" style="width:56px"></label><button id="nbGo" class="pill">Go</button></div></div>'; const g=$("#nbGrid"); for(let i=0;i<9;i++){ const d=document.createElement('div'); d.className='nb-cell'; g.appendChild(d); } this.cells=[...g.children]; this.stream=[]; on($("#nbGo"),'click',safeTap(()=>this.start())); },
    async start(){ score=0; updateScore(); const N = Math.max(1, Math.min(4, parseInt($("#nbN").value)||2)); this.stream=[]; for(let i=0;i<25;i++){ const idx=Math.floor(Math.random()*9); this.stream.push(idx); } for(let i=0;i<this.stream.length;i++){ const idx=this.stream[i]; this.cells.forEach(c=>c.classList.remove('on')); this.cells[idx].classList.add('on'); beep(600,45); haptic(8); let clicked=false; const handler=safeTap(()=>{ clicked=true; const ok = i>=N && this.stream[i-N]===idx; if(ok){ score++; addXP(6); } else { score=Math.max(0,score-1); } updateScore(); }); this.cells[idx].onclick=handler; await new Promise(r=>setTimeout(r, settings.reduced? 550: 700)); this.cells[idx].onclick=null; } if(score>best) best=score; updateBest(); }
  }
};

// UI wiring for modules
const modButtons = [...document.querySelectorAll(".mod")];
modButtons.forEach(b=> on(b,'click',safeTap(()=> openModule(b.dataset.target))));

function openModule(key){
  currentModule = MODULES[key]; if(!currentModule) return;
  $("#moduleTitle").textContent = currentModule.title;
  $("#moduleDesc").textContent = currentModule.desc;
  screenHome.hidden = true; screenModule.hidden = false;
  moduleRoot.innerHTML=""; currentModule.init(moduleRoot);
  best = (prog.bestScores[key]||0); updateBest(); score=0; updateScore();
}
function exitModule(){
  try{ currentModule?.stop?.(); }catch{}
  screenModule.hidden = true; screenHome.hidden = false;
  bumpStreak();
}
on($("#btnBackHome"),"click",safeTap(exitModule));
on($("#btnStart"),"click",safeTap(()=> currentModule?.start?.()));
on($("#btnStop"),"click",safeTap(()=> currentModule?.stop?.()));

function updateScore(){ $("#scoreVal").textContent=score; if(score>best){ best=score; updateBest(); } }
function updateBest(){ $("#bestVal").textContent=best; if(currentModule){ prog.bestScores[currentModule.title||'module']=best; saveProg(); } }

// Update system + countdown
const CHECK_MS = 6*60*60*1000; let nextAt = Date.now()+CHECK_MS;
async function checkUpdate(){
  try{
    const res = await fetch(`version.json?t=${Date.now()}`, {cache:"no-store"});
    const data = await res.json();
    if(data.version && data.version !== APP_VERSION) $("#updateBanner").hidden = false;
  }catch(e){}
  nextAt = Date.now()+CHECK_MS;
}
function startCountdown(){
  const top=$("#updateCountdown"), inSet=$("#countdownSettings");
  function tick(){
    const left=Math.max(0,nextAt-Date.now());
    const h=String(Math.floor(left/3600000)).padStart(2,"0");
    const m=String(Math.floor((left%3600000)/60000)).padStart(2,"0");
    const s=String(Math.floor((left%60000)/1000)).padStart(2,"0");
    const txt=`${h}:${m}:${s}`; top.textContent=txt; inSet.textContent=txt;
    if(left<=0) checkUpdate();
    requestAnimationFrame(tick);
  }
  tick();
}
on($("#refreshApp"),"click",safeTap(()=>{
  if('serviceWorker' in navigator){
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).finally(()=>location.reload());
  } else location.reload();
}));

// PWA
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

// Boot
buildThemeGrid(); loadTheme(); updateHUD(); checkUpdate(); startCountdown();
