/* =========================================================
   APP 6: Detektív (poruchy naslepo), Čítanie logov, Diagnostika
   ========================================================= */
S.det = S.det || {runs:[]};
S.logt = S.logt || {};
const INC_BY = id => window.INCIDENTS.find(x=>x.id===id);
const LAYER = k => window.LAYERS.find(l=>l.k===k) || {t:k, sym:'', cmd:'', log:''};
const fmtSec = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const pick = a => a[Math.floor(Math.random()*a.length)];

TOOLS.splice(TOOLS.findIndex(t=>t.k==='incidenty')+1, 0,
  {k:'detektiv', ic:'?!', t:'Detektív: porucha naslepo', d:'Len tiket od používateľa, náhodná porucha (aj dve naraz). Nájdi dôkaz v logoch a oprav.'},
  {k:'citanie-logov', ic:'log', t:'Čítanie logov', d:'Skutočné výpisy logov: klikni na riadok, ktorý prezrádza príčinu.'},
  {k:'diagnostika', ic:'⌕', t:'Diagnostika a mapa logov', d:'Prvých 60 sekúnd, „kde je problém?“ krok za krokom a kde je log ku ktorej službe.'});

/* ---------- DETEKTÍV ---------- */
function detView(){
  const v = document.createElement('div'); v.className='page';
  v.innerHTML = `<div class="chap"><div class="txt">
    <div class="eyebrow">Nástroj · hľadanie chýb</div><h1>Detektív: porucha naslepo</h1>
    <p class="lead" style="font-size:16px">Dostaneš len to, čo by ti napísal kolega alebo používateľ. Server je pokazený náhodnou poruchou, bez názvu a bez nápovedy. Postupuj metódou: <b>prvých 60 sekúnd → vrstva → dôkaz v logu → oprava → overenie</b>. Nápovedy si môžeš odomknúť, stoja body.</p>
    <div class="parts" id="dmode"></div>
    <div id="dcase"></div>
    <div id="dstats"></div>
  </div><aside id="side"></aside></div>`;
  const side = $('#side',v);
  let mode = S.det.mode || 'one';
  let cur = null, term = null, timer = null;
  const drawMode = ()=>{
    $('#dmode',v).innerHTML = [['one','Jedna porucha'],['two','Dve poruchy naraz'],['mix','Náhodne']].map(([k,l])=>`<button class="btn sm${mode===k?' pri':''}" type="button" data-m="${k}">${l}</button>`).join('') + `<button class="btn pri" type="button" id="dnew" style="margin-left:auto">Nový tiket ▸</button>`;
  };
  const apply = m => { for (const id of cur.ids){ INC_BY(id).setup(m); } m.log = []; cur.h0 = m.history.length; };
  const hintsFor = id => { const x = INC_BY(id), b = window.BLIND[id], L = LAYER(b.L); return [`Vrstva: <b>${esc(L.t)}</b>. Typický príznak: ${esc(L.sym)}.`, `Kde hľadať dôkaz: ${b.ev.map(e=>'<b>'+esc(e[1])+'</b>').join(', ')}. Prvé príkazy pre túto vrstvu: <code>${esc(L.cmd)}</code>`, esc(x.hints[1]||x.hints[0]), esc(x.hints[2]||'')]; };
  function newCase(){
    const two = mode==='two' || (mode==='mix' && Math.random()<0.4);
    let ids;
    if (two){ const p = pick(window.BLIND_PAIRS).split('+'); ids = Math.random()<0.5 ? p : [p[0], p[1]]; }
    else { const all = Object.keys(window.BLIND).filter(id=>INC_BY(id)); const last = (S.det.runs[0]||{}).ids||[]; const pool = all.filter(id=>!last.includes(id)); ids = [pick(pool.length?pool:all)]; }
    cur = {ids, t:ids.map(id=>pick(window.BLIND[id].t)), hints:0, t0:Date.now(), fixed:{}, done:false, gave:false};
    side.innerHTML = '';
    term = new Term(side, {title:'ssh admin@web01 · tiket', onRun:m=>check(m), onReset:t=>{ apply(t.m); motd(t); }});
    apply(term.m); motd(term); term.prompt();
    addTermFab(v, side);
    drawCase();
    clearInterval(timer); timer = setInterval(()=>{ const e = $('#dtime',v); if (!e || !document.body.contains(e)){ clearInterval(timer); return; } if (!cur.done) e.textContent = fmtSec(Math.round((Date.now()-cur.t0)/1000)); }, 1000);
  }
  function motd(t){ const fs = cur.ids.map(INC_BY).find(x=>x.motd); if (fs){ t.out.innerHTML=''; t.print(fs.motd); } }
  const cmdsOf = m => m.history.slice(cur.h0||0);
  function drawCase(){
    const c = $('#dcase',v);
    if (!cur){ c.innerHTML = `<div class="reveal" style="display:block;margin-top:14px">Vyber režim a daj <b>Nový tiket</b>. Pri „Dve poruchy naraz“ sú na serveri dva nezávislé problémy a dva tikety: ako v pondelok ráno.</div>`; return; }
    const n = cur.ids.length, fixedN = Object.keys(cur.fixed).length;
    const allH = cur.ids.flatMap(id=>hintsFor(id).map(h=>({id, h})));
    const order = []; for (let k=0;k<4;k++) cur.ids.forEach(id=>order.push({id, h:hintsFor(id)[k], k}));
    const shown = order.slice(0, cur.hints);
    c.innerHTML = `${cur.t.map((t,i)=>`<div class="ticket"><div class="tk-h">${n>1?`Tiket ${i+1}`:'Tiket'}${n>1 && cur.fixed[cur.ids[i]]?' · <span style="color:var(--ok)">vyriešený</span>':''}</div><pre>${esc(t)}</pre></div>`).join('')}
      <div class="parts"><span class="chip">čas <b id="dtime">${fmtSec(Math.round((Date.now()-cur.t0)/1000))}</b></span><span class="chip">príkazy ${cmdsOf(term.m).length}</span><span class="chip">nápovedy ${cur.hints}</span>${n>1?`<span class="chip ${fixedN===n?'ok':''}">opravené ${fixedN}/${n}</span>`:''}</div>
      <details class="ctx-det" style="margin:10px 0"><summary>Prvých 60 sekúnd (ťahák)</summary><div class="ctx-cmds" style="margin-top:6px">${window.TRIAGE60.map(([k,d])=>`<div><code>${esc(k)}</code><span>${esc(d)}</span></div>`).join('')}</div></details>
      <div id="dh">${shown.map((s,i)=>`<div class="reveal"><b>Nápoveda ${i+1}${n>1?` (tiket ${cur.ids.indexOf(s.id)+1})`:''}:</b> ${s.h}</div>`).join('')}</div>
      ${cur.done ? '' : `<div class="parts" style="margin-top:8px"><button class="btn sm" type="button" id="dhint"${cur.hints>=order.length?' disabled':''}>Nápoveda (−15 bodov)</button><button class="btn sm" type="button" id="dgive">Vzdávam, ukáž riešenie</button></div>`}
      <div id="dres"></div>`;
    const hb = $('#dhint',v); if (hb) hb.addEventListener('click', ()=>{ cur.hints++; drawCase(); });
    const gb = $('#dgive',v); if (gb) gb.addEventListener('click', ()=>{ cur.gave = true; finish(false); });
    if (cur.done) debrief();
  }
  function check(m){
    if (!cur || cur.done) { if (cur) drawCaseChipsOnly(); return; }
    let changed = false;
    for (const id of cur.ids){ let ok=false; try { ok = !!INC_BY(id).check(m); } catch(e){} if (ok && !cur.fixed[id]){ cur.fixed[id] = true; changed = true; if (cur.ids.length>1) toast(term, `Jedna porucha opravená (${Object.keys(cur.fixed).length}/${cur.ids.length}) ✓`); } }
    if (cur.ids.every(id=>cur.fixed[id])) finish(true); else if (changed) drawCase(); else drawCaseChipsOnly();
  }
  function drawCaseChipsOnly(){ const ch = $('#dcase .parts',v); if (!ch || !cur) return; const sp = ch.querySelectorAll('.chip'); if (sp[1]) sp[1].textContent = 'príkazy '+cmdsOf(term.m).length; }
  function evHit(id, cmds){ return window.BLIND[id].ev.map(([re, label])=>({label, hit: cmds.some(c=>re.test(c.replace(/^sudo\s+/,'')) || re.test(c))})); }
  function score(cmds){
    if (cur.gave) return 0;
    const opt = cur.ids.reduce((s,id)=>{ const x = INC_BY(id); const sol = typeof x.sol==='function' ? x.sol(term.m) : x.sol; return s + (sol||[]).length; }, 0);
    const extra = Math.max(0, cmds.length - Math.ceil(opt*2));
    const evAll = cur.ids.flatMap(id=>evHit(id, cmds)); const evOk = evAll.filter(e=>e.hit).length;
    let p = 100 - cur.hints*15 - extra*2 + (evOk===evAll.length ? 0 : -10);
    return Math.max(5, Math.min(100, p));
  }
  function finish(ok){
    cur.done = true; cur.ok = ok; cur.sec = Math.round((Date.now()-cur.t0)/1000);
    const cmds = cmdsOf(term.m); cur.pts = ok ? score(cmds) : 0;
    S.det.runs.unshift({d:(d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`)(new Date()), ids:cur.ids, ok, pts:cur.pts, sec:cur.sec, cmds:cmds.length, hints:cur.hints});
    S.det.runs = S.det.runs.slice(0, 40); save();
    if (ok) toast(term, `Vyriešené ✓ ${cur.pts} bodov`);
    drawCase(); drawStats();
  }
  function debrief(){
    const cmds = cmdsOf(term.m);
    const blocks = cur.ids.map(id=>{
      const x = INC_BY(id); const ev = evHit(id, cmds); const sol = typeof x.sol==='function' ? x.sol(term.m) : x.sol;
      return `<div class="reveal" style="display:block;margin-top:12px"><b>${cur.ids.length>1?'Porucha: ':''}${esc(x.title)}</b> <span class="sub2">(${esc(LAYER(window.BLIND[id].L).t)})</span>
        <p style="margin:8px 0">Dôkazy, ktoré si mal nájsť: ${ev.map(e=>`<span class="chip ${e.hit?'ok':''}" style="margin:2px">${e.hit?'✓':'✗'} ${esc(e.label)}</span>`).join(' ')}</p>
        <div>${x.why}</div>
        ${sol && sol.length ? `<p style="margin:10px 0 4px"><b>Ukážkový postup</b> (${sol.length} príkazov):</p><pre>${esc(sol.join('\n'))}</pre>` : ''}</div>`;
    }).join('');
    const mine = cmds.length ? `<details class="ctx-det" style="margin-top:12px"><summary>Tvoj postup (${cmds.length} príkazov)</summary><pre>${esc(cmds.join('\n'))}</pre></details>` : '';
    $('#dres',v).innerHTML = `<div class="${cur.ok?'okbar':'reveal'}" style="display:block;margin-top:16px">${cur.ok ? `<b>✓ Vyriešené za ${fmtSec(cur.sec)}, ${cmds.length} príkazov, ${cur.hints} nápoved: ${cur.pts} bodov.</b>` : '<b>Riešenie</b> (bez bodov). Skús ho teraz spraviť v termináli a daj si potom nový tiket.'}</div>${blocks}${mine}
      <div class="parts" style="margin-top:12px"><button class="btn pri" type="button" id="dnext">Ďalší tiket ▸</button></div>`;
    $('#dnext',v).addEventListener('click', newCase);
  }
  function drawStats(){
    const R = S.det.runs; const el = $('#dstats',v);
    if (!R.length){ el.innerHTML=''; return; }
    const solved = R.filter(r=>r.ok).length; const avg = Math.round(R.filter(r=>r.ok).reduce((s,r)=>s+r.pts,0)/Math.max(1,solved));
    const by = {}; R.forEach(r=>r.ids.forEach(id=>{ const L = window.BLIND[id] ? window.BLIND[id].L : '?'; by[L] = by[L] || {n:0, pts:0}; by[L].n++; by[L].pts += r.ok ? r.pts : 0; }));
    const weak = Object.entries(by).map(([k,o])=>[k, Math.round(o.pts/o.n), o.n]).sort((a,b)=>a[1]-b[1]);
    el.innerHTML = `<div class="sect"><h2>Tvoje výsledky</h2>
      <div class="parts"><span class="chip">pokusov ${R.length}</span><span class="chip ok">vyriešených ${solved}</span><span class="chip">priemer ${avg} b.</span></div>
      <p class="sub" style="margin-top:10px">Vrstvy od najslabšej (priemerné body): ${weak.map(([k,p,n])=>`<span class="chip" style="margin:2px">${esc(LAYER(k).t)} ${p} b. (${n}×)</span>`).join(' ')}</p>
      <div class="tbl" style="margin-top:8px"><table><thead><tr><th>Kedy</th><th>Poruchy</th><th>Výsledok</th><th>Čas</th><th>Príkazy</th></tr></thead><tbody>${R.slice(0,10).map(r=>`<tr><td>${esc(r.d.replace('T',' '))}</td><td>${r.ids.map(id=>esc((INC_BY(id)||{title:id}).title)).join(' + ')}</td><td>${r.ok?r.pts+' b.':'vzdané'}</td><td>${fmtSec(r.sec)}</td><td>${r.cmds}</td></tr>`).join('')}</tbody></table></div>
      <button class="btn sm" type="button" id="dclr" style="margin-top:8px">Vymazať výsledky</button></div>`;
    $('#dclr',v).addEventListener('click', ()=>{ if (confirm('Vymazať všetky výsledky Detektíva?')){ S.det.runs = []; save(); drawStats(); } });
  }
  drawMode();
  $('#dmode',v).addEventListener('click', e=>{ const b = e.target.closest('[data-m]'); if (b){ mode = b.dataset.m; S.det.mode = mode; save(); drawMode(); } if (e.target.closest('#dnew')) newCase(); });
  term = new Term(side, {title:'ssh admin@web01'}); term.print('(daj Nový tiket: server sa pokazí podľa náhodnej poruchy)\n','hint'); term.prompt();
  addTermFab(v, side);
  drawCase(); drawStats();
  return v;
}

/* ---------- ČÍTANIE LOGOV ---------- */
function logTrainView(){
  const v = document.createElement('div'); v.className='page';
  const L = window.LOG_TRAIN;
  let i = Math.max(0, L.findIndex(x=>!S.logt[x.id])); if (i<0) i = 0;
  v.innerHTML = `<div class="eyebrow">Nástroj · hľadanie chýb</div><h1>Čítanie logov</h1>
    <p class="lead" style="font-size:16px">V praxi má výpis desiatky riadkov a dôležitý je jeden. Klikni na riadok, ktorý odpovedá na otázku. Šum (varovania, ktoré sú tam vždy) a dôsledky (riadky, ktoré vznikli kvôli príčine) sú chyták.</p>
    <div class="parts" id="lprog"></div><div id="lbox"></div>`;
  const prog = ()=>{ $('#lprog',v).innerHTML = L.map((x,k)=>`<button class="btn sm${k===i?' pri':''}" type="button" data-i="${k}" title="${esc(x.t)}">${S.logt[x.id]==='ok'?'✓':S.logt[x.id]?'·':''}${k+1}</button>`).join('') + `<span class="chip" style="margin-left:auto">na prvý pokus ${L.filter(x=>S.logt[x.id]==='ok').length}/${L.length}</span>`; };
  function draw(){
    const x = L[i]; let tries = 0, done = false;
    $('#lbox',v).innerHTML = `<div class="sect"><h2>${i+1}. ${esc(x.t)}</h2><p class="sub">${esc(x.ask)}</p>
      <div class="logbox"><div class="lb-cmd">$ ${esc(x.src)}</div>${x.lines.map((l,k)=>`<button class="lb-l" type="button" data-k="${k}">${esc(l)}</button>`).join('')}</div>
      <div id="lres"></div>
      <div class="parts" style="margin-top:12px"><button class="btn sm" type="button" id="lshow">Ukáž odpoveď</button><button class="btn pri" type="button" id="lnext" style="margin-left:auto">Ďalší ▸</button></div></div>`;
    const reveal = (good)=>{ done = true; v.querySelectorAll('.lb-l').forEach(b=>{ if (x.key.includes(+b.dataset.k)) b.classList.add('ok'); }); $('#lres',v).innerHTML = `<div class="${good?'okbar':'reveal'}" style="display:block;margin-top:12px">${good?'<b>✓ Správne.</b> ':''}${x.why}${x.next?`<div style="margin-top:8px">Ďalší krok: <code>${esc(x.next)}</code></div>`:''}</div>`; };
    $('#lbox',v).addEventListener('click', e=>{
      const b = e.target.closest('.lb-l'); if (!b || done) return;
      const k = +b.dataset.k;
      if (x.key.includes(k)){ if (!S.logt[x.id] || S.logt[x.id]!=='ok') S.logt[x.id] = tries===0 ? 'ok' : 'ok2'; save(); prog(); reveal(true); }
      else { tries++; b.classList.add('no'); if (!S.logt[x.id]) { S.logt[x.id] = 'try'; save(); prog(); } }
    });
    $('#lshow',v).addEventListener('click', ()=>{ if (!done){ if (!S.logt[x.id]){ S.logt[x.id]='try'; save(); prog(); } reveal(false); } });
    $('#lnext',v).addEventListener('click', ()=>{ i = (i+1) % L.length; prog(); draw(); window.scrollTo(0, v.offsetTop); });
  }
  $('#lprog',v).addEventListener('click', e=>{ const b = e.target.closest('[data-i]'); if (b){ i = +b.dataset.i; prog(); draw(); } });
  prog(); draw();
  return v;
}

/* ---------- DIAGNOSTIKA ---------- */
function diagView(){
  const v = document.createElement('div'); v.className='page';
  const T = window.TRIAGE_TREE;
  v.innerHTML = `<div class="eyebrow">Nástroj · hľadanie chýb</div><h1>Diagnostika a mapa logov</h1>
    <p class="lead" style="font-size:16px">Keď nevieš, kde začať. Metóda a journalctl do hĺbky sú v <a href="#kapitola-27">kapitole 27</a>, precvičíš ich v <a href="#detektiv">Detektívovi</a>.</p>
    <div class="sect"><h2>1. Prvých 60 sekúnd</h2><p class="sub">Vždy, na každom serveri, skôr než začneš opravovať.</p>
      <div class="ctx-sec"><div class="ctx-cmds">${window.TRIAGE60.map(([c,d])=>`<div><code>${esc(c)}</code><span>${esc(d)}</span></div>`).join('')}</div></div>
      <div class="cmd" style="margin-top:8px"><div class="c">uptime; df -h; free -h; systemctl --failed; sudo journalctl -p err -b | tail -20</div></div></div>
    <div class="sect"><h2>2. Kde je problém? (krok za krokom)</h2><div id="tree"></div></div>
    <div class="sect"><h2>3. Vrstvy</h2><div class="tbl"><table><thead><tr><th>Vrstva</th><th>Príznak</th><th>Prvé príkazy</th><th>Log</th></tr></thead><tbody>${window.LAYERS.map(l=>`<tr><td><b>${esc(l.t)}</b></td><td>${esc(l.sym)}</td><td><code>${esc(l.cmd)}</code></td><td><code>${esc(l.log)}</code></td></tr>`).join('')}</tbody></table></div></div>
    <div class="sect"><h2>4. Mapa logov</h2><input class="search" id="lmq" type="search" placeholder="Hľadaj službu alebo hlášku (sshd, 403, denied, cron…)" style="margin-bottom:12px"><div id="lmap"></div></div>`;
  const path = ['start'];
  const drawTree = ()=>{
    const node = T[path[path.length-1]];
    const crumbs = path.slice(1).map((k,i)=>{ const par = T[path[i]]; const o = (par.o||[]).find(x=>x[1]===k); return o ? o[0] : k; });
    $('#tree',v).innerHTML = `<div class="ctx-sec">${crumbs.length?`<p class="sub2" style="margin:0 0 8px">${crumbs.map(esc).join(' → ')}</p>`:''}
      ${node.q ? `<p style="margin:0 0 10px;font-weight:600">${node.q}</p><div class="parts">${node.o.map(([l,k])=>`<button class="btn sm" type="button" data-go="${k}">${esc(l)}</button>`).join('')}</div>`
      : `<p style="margin:0 0 10px">${node.r}</p><div class="ctx-cmds">${node.c.map(c=>`<div><code>${esc(c)}</code></div>`).join('')}</div>${node.rb?`<p style="margin:10px 0 0">Podrobne: <a href="#postup-${node.rb}">postup „${esc((window.RUNBOOKS.find(r=>r.id===node.rb)||{t:node.rb}).t)}“</a></p>`:''}`}
      ${path.length>1?`<div class="parts" style="margin-top:12px"><button class="btn sm" type="button" data-back="1">← Späť</button><button class="btn sm" type="button" data-back="all">Od začiatku</button></div>`:''}</div>`;
  };
  $('#tree',v).addEventListener('click', e=>{ const g = e.target.closest('[data-go]'), b = e.target.closest('[data-back]'); if (g){ path.push(g.dataset.go); drawTree(); } else if (b){ if (b.dataset.back==='all') path.length = 1; else path.pop(); drawTree(); } });
  const drawMap = q=>{
    const n = norm(q||'');
    const M = window.LOG_MAP.filter(s=>!n || norm(JSON.stringify(s)).includes(n));
    $('#lmap',v).innerHTML = M.length ? M.map(s=>`<div class="ctx-sec" style="margin-bottom:10px"><h3 style="text-transform:none;letter-spacing:0;font-size:16px;color:var(--text)">${esc(s.sv)} ${s.unit && s.unit!=='—'?`<span class="sub2">(${esc(s.unit)})</span>`:''}</h3>
      <div class="ctx-cmds"><div><span>Log</span><code>${esc(s.log)}</code></div><div><span>Journal</span><code>${esc(s.j)}</code></div><div><span>Konfigurácia</span><code>${esc(s.cfg)}</code></div><div><span>Overenie</span><code>${esc(s.check)}</code></div></div>
      ${s.errs.length?`<div class="tbl" style="margin-top:8px"><table><tbody>${s.errs.map(([e,d])=>`<tr><td><code>${esc(e)}</code></td><td>${esc(d)}</td></tr>`).join('')}</tbody></table></div>`:''}</div>`).join('') : '<p class="sub">Nič sa nenašlo.</p>';
  };
  $('#lmq',v).addEventListener('input', e=>drawMap(e.target.value));
  drawTree(); drawMap('');
  return v;
}

/* ---------- plán, vyhľadávanie, smerovanie ---------- */
const _pti6 = planTaskInfo;
planTaskInfo = function(t, i){
  if (t.k==='det') return {href:'#detektiv', label:`Detektív: vyrieš ${t.n} ${plural(t.n,'poruchu','poruchy','porúch')} naslepo`, sub:'len tiket, bez nápovedy ak to ide', done: S.det.runs.filter(r=>r.ok).length >= t.need, min:20};
  if (t.k==='logt') return {href:'#citanie-logov', label:'Čítanie logov: prejdi všetky výpisy', sub:'klikni na riadok s príčinou', done: window.LOG_TRAIN.every(x=>S.logt[x.id] && S.logt[x.id]!=='try'), min:20};
  return _pti6(t, i);
};
(()=>{ const add = (d, ...t)=>{ if (PLAN[d-1] && !PLAN[d-1].some(x=>t.some(y=>JSON.stringify(x)===JSON.stringify(y)))) PLAN[d-1].push(...t); };
  add(13, {k:'tool', t:'diagnostika', l:'Diagnostika: nauč sa prvých 60 sekúnd a prejdi rozhodovací strom'});
  add(18, {k:'ch', n:27}); add(18, {k:'logt'});
  add(23, {k:'det', n:2, need:2}); add(25, {k:'det', n:2, need:4}); add(28, {k:'det', n:3, need:7}); add(30, {k:'det', n:2, need:9}); })();
const _buildIndex6 = buildIndex;
buildIndex = function(){
  const ix = _buildIndex6();
  const add = e => { e.n = norm(e.text); e.nt = norm(e.title); ix.push(e); };
  for (const s of window.LOG_MAP) add({kind:'Mapa logov', title:s.sv, sub:s.log+' · '+s.j, href:'diagnostika', text:[s.sv,s.unit,s.log,s.j,s.cfg,s.check].concat(s.errs.flat()).join(' ')});
  for (const x of window.LOG_TRAIN) add({kind:'Čítanie logov', title:x.t, sub:x.ask, href:'citanie-logov', text:x.t+' '+x.ask+' '+x.lines.join(' ')+' '+strip(x.why)});
  add({kind:'Nástroj', title:'Detektív: porucha naslepo', sub:'náhodné poruchy bez nápovedy', href:'detektiv', text:'detektiv porucha naslepo incident tiket hladanie chyb logy'});
  return ix;
};
SEARCH_IX = null;
const _route6 = route;
route = function(){
  const h = (location.hash||'#uvod').slice(1);
  let node = null;
  if (h==='detektiv') node = detView();
  else if (h==='citanie-logov') node = logTrainView();
  else if (h==='diagnostika') node = diagView();
  if (!node) return _route6();
  S.seen = S.seen||{}; if (!S.seen[h]){ S.seen[h]=true; save(); }
  view.innerHTML=''; view.appendChild(node);
  document.querySelectorAll('.rail a').forEach(a=>a.classList.toggle('on', a.dataset.k===h));
  $('#rail').classList.remove('open'); refreshProgress(); window.scrollTo(0,0);
};
buildRail();
route();
