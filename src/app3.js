/* =========================================================
   APP 3: incidenty, skúška, opakovanie chýb, záloha pokroku,
   vyhľadávanie, plávajúce tlačidlo terminálu, štart
   ========================================================= */
S.wrong = S.wrong || {}; S.inc = S.inc || {}; S.exam = S.exam || {};
const INC = window.INCIDENTS, EXAM = window.EXAM;

/* ---------- chyby na zopakovanie ---------- */
function markWrong(n, qi){ S.wrong[n+':'+qi] = {box:0, t:Date.now()}; save(); }
function wrongCount(){ return Object.keys(S.wrong).filter(k=>{ const [n,qi]=k.split(':'); const c=CHAPTERS.find(x=>x.n===+n); return c && c.quiz[+qi]; }).length; }

function reviewView(){
  const v = document.createElement('div'); v.className='col';
  const wc = wrongCount();
  v.innerHTML = `<div class="eyebrow">Opakovanie</div><h1>Opakovanie</h1>
  <p class="lead" style="font-size:16px">Každú otázku, na ktorú odpovieš zle (v kapitole alebo tu), si stránka zapamätá. V režime <b>Moje chyby</b> sa vracia, kým ju dvakrát po sebe nezodpovieš správne.</p>
  <div class="seg2" role="tablist"><button type="button" data-m="chyby" class="${wc?'on':''}">Moje chyby <span class="chip" id="wc">${wc}</span></button><button type="button" data-m="nahodne" class="${wc?'':'on'}">10 náhodných</button></div>
  <div class="parts" style="margin-top:12px"><span class="chip" id="score"></span><button class="btn sm" type="button" id="again">Nové otázky</button></div><div id="qq"></div>`;
  let mode = wc ? 'chyby' : 'nahodne';
  const draw = ()=>{
    v.querySelectorAll('.seg2 button').forEach(b=>b.classList.toggle('on', b.dataset.m===mode));
    const box = $('#qq',v); box.innerHTML='';
    let pick = [];
    if (mode==='chyby'){
      pick = Object.entries(S.wrong).map(([k,w])=>{ const [n,qi]=k.split(':'); const c=CHAPTERS.find(x=>x.n===+n); return c && c.quiz[+qi] ? {q:c.quiz[+qi], c, qi:+qi, k, box:w.box} : null; }).filter(Boolean).sort((a,b)=>a.box-b.box || Math.random()-.5).slice(0,10);
      if (!pick.length){ box.innerHTML = '<div class="okbar">Nemáš žiadne chyby na zopakovanie. Odpovedaj na kvízy v kapitolách alebo skús náhodné otázky.</div>'; $('#score',v).textContent='0 chýb'; return; }
    } else {
      const all = []; CHAPTERS.forEach(c=>c.quiz.forEach((q,qi)=>all.push({q,c,qi,k:c.n+':'+qi})));
      for (let i=all.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [all[i],all[j]]=[all[j],all[i]]; }
      pick = all.slice(0,10);
    }
    let score=0, answered=0; const N = pick.length;
    let counted = false;
    const upd = ()=>{ if (answered===N && N && !counted){ counted=true; S.reviewDone=(S.reviewDone||0)+1; save(); } $('#score',v).textContent = `${score} / ${N}`+(answered===N?' · hotovo':''); $('#score',v).className='chip'+(answered===N&&score>=Math.ceil(N*0.8)?' ok':''); $('#wc',v).textContent = wrongCount(); };
    pick.forEach(({q,c,qi,k,box:bx},i)=>{
      let first=true;
      const el = quizBox(q,i,null,(oi,ok)=>{
        if (!first) return; first=false; answered++; if (ok) score++;
        if (mode==='chyby'){ if (ok){ const w=S.wrong[k]; if (w){ w.box++; if (w.box>=2) delete S.wrong[k]; } } else { S.wrong[k]={box:0,t:Date.now()}; } save(); }
        else if (!ok) markWrong(c.n, qi);
        upd();
      });
      el.insertAdjacentHTML('beforeend', `<p class="w" style="color:var(--muted);font-size:12.5px">Kapitola <a href="#kapitola-${c.n}">${c.n}. ${esc(c.short)}</a>${mode==='chyby'?` · ${bx?'ešte 1 správna odpoveď a je naučená':'potrebuje 2 správne odpovede po sebe'}`:''}</p>`);
      box.appendChild(el);
    });
    upd();
  };
  v.querySelectorAll('.seg2 button').forEach(b=>b.addEventListener('click', ()=>{ mode=b.dataset.m; draw(); }));
  $('#again',v).addEventListener('click', draw);
  draw();
  return v;
}

/* ---------- záloha pokroku ---------- */
function encodeProgress(){ const json = JSON.stringify(S); return 'RHEL1:' + btoa(unescape(encodeURIComponent(json))); }
function decodeProgress(code){
  code = (code||'').trim();
  let json;
  if (code.startsWith('RHEL1:')) json = decodeURIComponent(escape(atob(code.slice(6).replace(/\s+/g,''))));
  else if (code.startsWith('{')) json = code;
  else throw new Error('Kód musí začínať RHEL1:');
  const o = JSON.parse(json);
  if (typeof o!=='object' || !o.read || !o.quiz || !o.ex) throw new Error('V kóde chýbajú údaje o pokroku.');
  return o;
}
function backupBox(){
  const s = document.createElement('section'); s.className='backup';
  const local = location.protocol==='file:' || !window.claude;
  s.innerHTML = `<div class="sect-h"><h2>Záloha pokroku</h2><p>Pokrok je uložený len v tomto prehliadači. Prenes ho kódom.</p></div>
  <div class="bk">
    <div class="box"><h3>Uložiť</h3><p class="sub2">Vytvor kód a ulož si ho (poznámky, e-mail sebe).</p><div class="acts"><button class="btn pri sm" type="button" id="bkMake">Vytvoriť kód</button>${local?'<button class="btn sm" type="button" id="bkFile">Stiahnuť súbor</button>':''}</div><textarea id="bkOut" rows="3" readonly hidden aria-label="Kód pokroku"></textarea><div class="acts" id="bkCopyRow" hidden><button class="btn sm" type="button" id="bkCopy">Kopírovať</button><span class="sub2" id="bkMsg"></span></div></div>
    <div class="box"><h3>Načítať</h3><p class="sub2">Vlož kód z iného zariadenia. Nahradí tunajší pokrok.</p><textarea id="bkIn" rows="3" placeholder="RHEL1:…" aria-label="Kód na načítanie"></textarea><div class="acts"><button class="btn sm" type="button" id="bkLoad">Načítať</button><span class="sub2" id="bkErr"></span></div></div>
    <div class="box"><h3>Začať odznova</h3><p class="sub2">Vymaže všetok pokrok na tomto zariadení.</p><div class="acts"><button class="btn sm" type="button" id="bkReset">Vymazať pokrok</button><span id="bkConfirm" hidden><button class="btn sm danger" type="button" id="bkYes">Áno, vymazať</button> <button class="btn sm" type="button" id="bkNo">Nie</button></span></div></div>
  </div>`;
  const out = $('#bkOut',s);
  $('#bkMake',s).addEventListener('click', ()=>{ out.value = encodeProgress(); out.hidden=false; $('#bkCopyRow',s).hidden=false; out.select(); });
  $('#bkCopy',s).addEventListener('click', async ()=>{ try { await navigator.clipboard.writeText(out.value); $('#bkMsg',s).textContent='Skopírované.'; } catch(e){ out.select(); $('#bkMsg',s).textContent='Označené, skopíruj ručne.'; } });
  const f = $('#bkFile',s); if (f) f.addEventListener('click', ()=>{ const blob = new Blob([JSON.stringify(S,null,1)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='rhel-v-praxi-pokrok-'+new Date().toISOString().slice(0,10)+'.json'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); });
  $('#bkLoad',s).addEventListener('click', ()=>{ try { const o = decodeProgress($('#bkIn',s).value); for (const k of Object.keys(S)) delete S[k]; Object.assign(S, {read:{},quiz:{},ex:{},vim:{},wrong:{},inc:{},exam:{}}, o); save(); $('#bkErr',s).textContent=''; route(); } catch(e){ $('#bkErr',s).textContent = 'Kód sa nedá načítať: '+e.message; } });
  $('#bkReset',s).addEventListener('click', ()=>{ $('#bkConfirm',s).hidden=false; });
  $('#bkNo',s).addEventListener('click', ()=>{ $('#bkConfirm',s).hidden=true; });
  $('#bkYes',s).addEventListener('click', ()=>{ for (const k of Object.keys(S)) delete S[k]; Object.assign(S,{read:{},quiz:{},ex:{},vim:{},wrong:{},inc:{},exam:{},last:null,ver:9,v2:1}); save(); route(); });
  return s;
}
const _homeView = homeView;
homeView = function(){
  const v = _homeView();
  const st = v.querySelector('.stats');
  if (st){ const incOk = Object.keys(S.inc).length; st.insertAdjacentHTML('beforeend', `<div class="stat"><b>${incOk}/${INC.length}</b><span>vyriešené incidenty</span></div><div class="stat"><b>${S.exam.rdone||0}</b><span>skúšok na 10/10</span></div>`); }
  const wc = wrongCount();
  if (wc){ const h = v.querySelector('.cta'); if (h) h.insertAdjacentHTML('beforeend', `<a class="btn" href="#opakovanie">Zopakovať chyby (${wc})</a>`); }
  v.appendChild(backupBox());
  return v;
};

/* ---------- plávajúce tlačidlo terminálu (mobil) ---------- */
function addTermFab(v, side){
  const b = document.createElement('button'); b.type='button'; b.className='fab'; b.innerHTML='<span>$_</span> Terminál'; b.setAttribute('aria-label','Prejsť na terminál');
  b.addEventListener('click', ()=>{ side.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth', block:'center'}); const i = side.querySelector('.term-in input'); if (i) setTimeout(()=>i.focus({preventScroll:true}), 400); });
  v.appendChild(b);
  try { const io = new IntersectionObserver(es=>{ es.forEach(e=>b.classList.toggle('hide', e.isIntersecting)); }, {threshold:0.15}); io.observe(side); } catch(e){}
}

/* ---------- incidenty ---------- */
function incidentsView(){
  const v = document.createElement('div'); v.className='col';
  v.innerHTML = `<div class="eyebrow">Prax</div><h1>Incidenty</h1><p class="lead" style="font-size:16px">Každý incident je pokazený server a tiket, aký by si dostal v práci. Nájdi príčinu, oprav ju tak, aby vydržala aj reštart, a stránka ti potvrdí, že je to vyriešené. Nápovedy sa odkrývajú postupne.</p>
  <div class="incs">${INC.map(x=>`<a class="inc ${S.inc[x.id]?'done':''}" href="#incident-${x.id}"><span class="lvl">${esc(x.lvl)}</span><b>${esc(x.title)}</b><span class="ar">${esc(x.area)}</span><span class="st">${S.inc[x.id]?'✓ vyriešené':'otvorený'}</span></a>`).join('')}</div>
  <div class="callout tip"><b class="k">Postup</b><div>1) Prečítaj tiket a zopakuj si, čo presne nefunguje. 2) Over to príkazom (curl, ping, systemctl status, df). 3) Hľadaj príčinu v logoch (journalctl, /var/log). 4) Oprav natrvalo. 5) Over opravu, ideálne aj cez <code>sudo reboot</code>.</div></div>`;
  return v;
}
function incidentView(x){
  const v = document.createElement('div'); v.className='page';
  v.innerHTML = `<div class="chap"><div class="txt">
    <div class="eyebrow"><a href="#incidenty">Incidenty</a> · ${esc(x.lvl)}</div><h1>${esc(x.title)}</h1>
    <div class="ticket"><div class="tk-h">Tiket</div><pre>${esc(x.ticket)}</pre></div>
    <div class="parts" id="ist"></div>
    <div class="sect"><h2>Nápovedy</h2><p class="sub">Skús najprv sám. Každá nápoveda prezradí viac.</p><div id="hints"></div>
      <div class="acts" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" type="button" id="hintBtn"></button><button class="btn sm ai-only" type="button" id="aiBtn">Poraď mi (Claude)</button><button class="btn sm" type="button" id="giveUp">Ukázať príčinu</button></div><div class="reveal" id="aiOut" hidden></div></div>
    <div id="solved"></div>
    <nav class="pager">${(()=>{ const i=INC.indexOf(x); const p=INC[i-1], n=INC[i+1]; return (p?`<a href="#incident-${p.id}"><span>← Predošlý</span><b>${esc(p.title)}</b></a>`:'<span></span>')+(n?`<a class="next" href="#incident-${n.id}"><span>Ďalší →</span><b>${esc(n.title)}</b></a>`:`<a class="next" href="#skuska"><span>Ďalej →</span><b>Skúšobný server</b></a>`); })()}</nav>
  </div><aside id="side"></aside></div>`;
  const side = $('#side',v);
  let shown = 0;
  const term = new Term(side, {title:'konzola web01 · incident', onReset:t=>{ v._done=false; x.setup(t.m); t.m.log=[]; if (x.motd) t.out.innerHTML=''; t.print(x.motd || '(server je v stave z tiketu; Reset ho vráti do pokazeného stavu)\n', x.motd?'':'hint'); }, onRun:m=>check(m)});
  x.setup(term.m); term.m.log=[]; if (x.motd) term.out.innerHTML=''; term.print(x.motd || '(server je v stave z tiketu; Reset ho vráti do pokazeného stavu)\n', x.motd?'':'hint'); term.prompt();
  const drawHints = ()=>{ $('#hints',v).innerHTML = x.hints.slice(0,shown).map((h,i)=>`<div class="reveal"><b>Nápoveda ${i+1}:</b> ${esc(h)}</div>`).join(''); const hb=$('#hintBtn',v); hb.textContent = shown<x.hints.length ? `Nápoveda ${shown+1}/${x.hints.length}` : 'Všetky nápovedy zobrazené'; hb.disabled = shown>=x.hints.length; };
  const status = ()=>{ $('#ist',v).innerHTML = `<span class="chip">${esc(x.area)}</span><span class="chip ${S.inc[x.id]?'ok':''}">${S.inc[x.id]?'✓ vyriešené':'otvorený'}</span>${S.inc[x.id]?'<button class="btn sm" type="button" id="incUndo">Označiť ako nevyriešený</button>':''}`;
    const u = $('#incUndo',v); if (u) u.addEventListener('click', ()=>{ delete S.inc[x.id]; save(); let still=false; try { still = !!x.check(term.m); } catch(e){} v._done = still; status(); $('#solved',v).innerHTML=''; toast(term, still ? 'Vrátené. Server je stále opravený: daj Reset a vyrieš ho znova.' : 'Incident vrátený ako nevyriešený.'); }); };
  const showWhy = (solved)=>{ let sol=''; try { const a = typeof x.sol==='function' ? x.sol(term.m) : x.sol; if (a) sol = `<div class="reveal" style="display:block;margin-top:10px"><b>Ukážkový postup</b> (príkazy v poradí, ako by ich spravil skúsený admin):<pre>${esc(a.join('\n'))}</pre></div>`; } catch(e){}
    $('#solved',v).innerHTML = `<div class="${solved?'okbar':'reveal'}" style="display:block;margin-top:18px">${solved?'<b>✓ Incident vyriešený.</b><br>':''}${x.why}</div>${sol}`; };
  function check(m){ let ok=false; try { ok = !!x.check(m); } catch(e){} if (ok && !v._done){ v._done=true; S.inc[x.id]=true; save(); status(); showWhy(true); toast(term,'Incident vyriešený ✓'); } }
  $('#hintBtn',v).addEventListener('click', ()=>{ shown=Math.min(x.hints.length, shown+1); drawHints(); });
  $('#giveUp',v).addEventListener('click', ()=>{ showWhy(false); });
  $('#aiBtn',v).addEventListener('click', async ()=>{ const o=$('#aiOut',v); o.hidden=false; o.textContent='Claude sa pozerá na tvoje príkazy…'; try { await askClaude(`${AI_FRAME}\n\nŠtudent rieši incident na simulovanom RHEL serveri. NEPROZRÁĎ riešenie ani príčinu priamo. Na základe jeho príkazov mu povedz, ktorým smerom sa pozrieť ďalej (jeden konkrétny príkaz alebo miesto).\n\nTiket:\n${x.ticket}\n\nJeho posledné príkazy:\n${term.recent(12)||'(žiadne)'}\n\nPosledný výstup:\n${term.lastOut||'(nič)'}`, t=>{ o.textContent=t; }); } catch(e){ o.textContent='Claude teraz neodpovedá. Skús nápovedu.'; } });
  drawHints(); status();
  if (S.inc[x.id]) $('#solved',v).innerHTML = '<p class="sub" style="margin-top:14px">Tento incident si už vyriešil. Môžeš si ho zopakovať.</p>';
  addTermFab(v, side);
  return v;
}

/* ---------- skúšobný server ---------- */
function examView(){
  const v = document.createElement('div'); v.className='page';
  v.innerHTML = `<div class="chap"><div class="txt">
    <div class="eyebrow">Záverečná skúška</div><h1>Skúšobný server</h1>
    <p class="lead" style="font-size:16px">Dostal si čistý server. Priprav ho podľa zadania nižšie. Stav „teraz“ sa kontroluje priebežne. <b>Vyhodnotiť</b> navyše spraví reštart na kópii servera a ukáže, čo by po ňom ostalo. Splnené je len to, čo platí v oboch stĺpcoch.</p>
    <div class="exam"><div class="ex-h"><span>Zadanie</span><span>teraz</span><span>po reštarte</span></div><ol id="req"></ol></div>
    <div class="parts" style="margin-top:12px"><button class="btn pri" type="button" id="evalBtn">Vyhodnotiť</button><span class="chip" id="exScore"></span><button class="btn sm" type="button" id="solBtn">Ukázať riešenie</button></div>
    <div class="parts" id="exBest" style="margin-top:6px"></div>
    <div id="exOut"></div><div class="reveal" id="exSol" hidden></div>
  </div><aside id="side"></aside></div>`;
  const side = $('#side',v);
  const term = new Term(side, {title:'ssh admin@novy-server', onRun:m=>live(m), onReset:t=>{ after=null; live(t.m); }});
  let after = null;
  const pill = (ok, na)=> na ? '<span class="pill na">–</span>' : `<span class="pill ${ok?'ok':'no'}">${ok?'✓':'✗'}</span>`;
  function draw(nowRes){
    $('#req',v).innerHTML = EXAM.map((r,i)=>`<li><span class="rt">${r.t}</span>${pill(nowRes[i])}${pill(after?after[i]:false, !after)}</li>`).join('');
  }
  function evalNow(m){ return EXAM.map(r=>{ try { return !!r.check(m); } catch(e){ return false; } }); }
  function live(m){ draw(evalNow(m)); }
  $('#evalBtn',v).addEventListener('click', ()=>{
    const now = evalNow(term.m);
    let c2, msg='';
    try { c2 = term.m.clone(); c2.user='root'; const r = c2.c_reboot([]); c2.user='admin'; msg = (r && r.o) ? r.o.split('Čo sa pri reštarte stalo:')[1] || r.o : ''; }
    catch(e){ msg = 'Reštart sa nepodarilo nasimulovať: '+e.message; }
    after = c2 ? evalNow(c2) : EXAM.map(()=>false);
    draw(now);
    const score = EXAM.filter((r,i)=>now[i] && after[i]).length;
    S.exam.best = Math.max(S.exam.best||0, score); S.exam.last = score; save();
    $('#exScore',v).textContent = `${score} / ${EXAM.length}`; $('#exScore',v).className = 'chip'+(score===EXAM.length?' ok':'');
    $('#exOut',v).innerHTML = `<div class="${score===EXAM.length?'okbar':'reveal'}" style="display:block;margin-top:12px">${score===EXAM.length?'<b>✓ Všetko splnené, aj po reštarte. Tento server by si mohol odovzdať.</b>':`<b>Splnené ${score} z ${EXAM.length}.</b> Červené v stĺpci „po reštarte“ znamená, že zmena nie je trvalá.`}${msg?`<pre style="white-space:pre-wrap;margin:8px 0 0;font:13px/1.5 var(--f-mono)">Simulovaný reštart:${esc(msg)}</pre>`:''}</div>`;
  });
  $('#solBtn',v).addEventListener('click', ()=>{ const s=$('#exSol',v); s.hidden=!s.hidden; s.innerHTML = '<b>Jedno možné riešenie</b> (skús najprv bez neho):<pre>'+esc(window.EXAM_SOL)+'</pre><p class="sub2">Súbory môžeš upravovať aj vo vime (sudo vim …) a crontab cez sudo crontab -e.</p>'; });
  const drawBest = ()=>{ const b = $('#exBest',v); if (S.exam.best==null){ b.innerHTML=''; return; } b.innerHTML = `<span class="chip">najlepší výsledok ${S.exam.best}/${EXAM.length}</span><button class="btn sm" type="button" id="exReset">Vymazať výsledky skúšky</button>`; $('#exReset',b).addEventListener('click', ()=>{ S.exam = {}; save(); after=null; $('#exScore',v).textContent=''; $('#exScore',v).className='chip'; $('#exOut',v).innerHTML=''; drawBest(); live(term.m); }); };
  $('#evalBtn',v).addEventListener('click', ()=>setTimeout(drawBest,0));
  drawBest();
  live(term.m);
  addTermFab(v, side);
  return v;
}

/* ---------- vyhľadávanie ---------- */
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const strip = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim();
let SEARCH_IX = null;
function buildIndex(){
  const ix = [];
  for (const c of CHAPTERS){
    let hi = 0, cur = {title:c.title, sec:'Úvod', href:'kapitola-'+c.n, id:null, text:c.goal+' '};
    const flush = ()=>{ if (cur.text.trim()) ix.push({kind:'Kapitola '+c.n, title:cur.sec===('Úvod')?c.title:cur.sec, sub:c.title, href:cur.href, id:cur.id, text:cur.text}); };
    for (const b of c.body){
      const [t,a,cc] = b;
      if (t==='h'){ flush(); hi++; cur = {sec:a, href:'kapitola-'+c.n, id:'s'+hi, text:a+' '}; continue; }
      if (t==='p'||t==='tip'||t==='warn'||t==='new') cur.text += strip(a)+' ';
      else if (t==='cmd') cur.text += a+' '+(cc||'')+' ';
      else if (t==='pre'||t==='explain') cur.text += a+' ';
      else if (t==='annot') cur.text += (a||'')+' '+cc.map(r=>r[0]+' '+strip(r[1]||'')).join(' ')+' ';
      else if (t==='out') cur.text += (a||'')+' ';
      else if (t==='list') cur.text += a.map(strip).join(' ')+' ';
      else if (t==='table') cur.text += cc.map(r=>r.map(strip).join(' ')).join(' ')+' ';
      else if (t==='flags'){ const r=CMDREF[a]; if (r) cur.text += a+' '+r.d+' '+r.f.map(x=>x.join(' ')).join(' ')+' '; }
    }
    flush();
    c.quiz.forEach(q=>ix.push({kind:'Kvíz '+c.n, title:strip(q.q), sub:c.title, href:'kapitola-'+c.n, id:'kviz', text:strip(q.q)+' '+strip(q.w)}));
  }
  for (const [k,r] of Object.entries(CMDREF)) ix.push({kind:'Príkaz', title:k, sub:r.d, href:'rozlustit', cmd:k, text:k+' '+r.d+' '+(r.s||'')+' '+r.f.map(x=>x.join(' ')).join(' ')});
  for (const x of INC) ix.push({kind:'Incident', title:x.title, sub:x.area, href:'incident-'+x.id, text:x.title+' '+x.area+' '+x.ticket});
  ix.forEach(e=>{ e.n = norm(e.text); e.nt = norm(e.title); });
  return ix;
}
function doSearch(q){
  SEARCH_IX = SEARCH_IX || buildIndex();
  const words = norm(q).split(/\s+/).filter(w=>w.length>0);
  if (!words.length) return [];
  const res = [];
  for (const e of SEARCH_IX){
    if (!words.every(w=>e.n.includes(w) || e.nt.includes(w))) continue;
    let score = 0; for (const w of words){ if (e.nt.includes(w)) score += 10; if (e.nt===w) score += 30; score += Math.min(5, e.n.split(w).length-1); }
    if (e.kind==='Príkaz' && e.nt===words[0]) score += 40;
    res.push({e, score});
  }
  return res.sort((a,b)=>b.score-a.score).slice(0,40);
}
function snippet(e, q){
  const words = norm(q).split(/\s+/).filter(Boolean); const t = e.text; const n = norm(t);
  let i = n.indexOf(words[0]); if (i<0) i=0;
  const s = Math.max(0, i-50), en = Math.min(t.length, i+110);
  let out = esc((s?'…':'')+t.slice(s,en)+(en<t.length?'…':''));
  for (const w of words){ out = out.replace(new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'), '<mark>$1</mark>'); }
  return out;
}
function openSearch(){
  if (document.querySelector('.search-ov')) return;
  const ov = document.createElement('div'); ov.className='search-ov'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Hľadať');
  ov.innerHTML = `<div class="search-box"><div class="sb-top"><input id="sq" type="search" placeholder="Hľadaj: firewall permanent, ss, fstab, heslo root…" autocomplete="off" spellcheck="false" aria-label="Hľadaný výraz"><button class="btn sm" type="button" id="sx">Zavrieť</button></div><div class="sb-res" id="sr"><p class="sub2">Hľadá v kapitolách, kvízoch, príkazoch a incidentoch. Diakritiku písať netreba.</p></div></div>`;
  document.body.appendChild(ov);
  const inp = $('#sq',ov), res = $('#sr',ov);
  const close = ()=>{ ov.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = e=>{ if (e.key==='Escape') close(); };
  document.addEventListener('keydown', esc_);
  ov.addEventListener('click', e=>{ if (e.target===ov) close(); });
  $('#sx',ov).addEventListener('click', close);
  let tm;
  inp.addEventListener('input', ()=>{ clearTimeout(tm); tm = setTimeout(()=>{
    const q = inp.value.trim(); if (!q){ res.innerHTML=''; return; }
    const r = doSearch(q);
    res.innerHTML = r.length ? r.map(({e},i)=>`<button type="button" class="sres" data-i="${i}"><span class="sk">${esc(e.kind)}</span><b>${esc(e.title)}</b><span class="ss">${esc(e.sub||'')}</span><span class="sn">${snippet(e,q)}</span></button>`).join('') : '<p class="sub2">Nič som nenašiel. Skús iné slovo.</p>';
    res.querySelectorAll('.sres').forEach(b=>b.addEventListener('click', ()=>{ const e = r[+b.dataset.i].e; close(); if (e.cmd) window.__explainPreset = e.cmd; window.__scrollTo = e.id || null; if (location.hash==='#'+e.href) route(); else location.hash = e.href; }));
  }, 120); });
  setTimeout(()=>inp.focus(), 30);
}

/* ---------- štart ---------- */
(function boot(){
  const nav = document.querySelector('.bar nav');
  if (nav && !document.getElementById('srchBtn')){ const b = document.createElement('button'); b.type='button'; b.id='srchBtn'; b.className='srch'; b.innerHTML='<span aria-hidden="true">⌕</span><span class="lbl">Hľadať</span>'; b.setAttribute('aria-label','Hľadať'); b.addEventListener('click', openSearch); nav.insertBefore(b, nav.querySelector('a')); }
  if (nav && !document.getElementById('thmBtn')){
    const t = document.createElement('button'); t.type='button'; t.id='thmBtn'; t.className='thm';
    const sv = d=>`<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">${d}</svg>`;
    const ICON = {auto: sv('<circle cx="8" cy="8" r="6"/><path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor"/>'), light: sv('<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/>'), dark: sv('<path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/>')}, LBL = {auto:'Téma: podľa systému', light:'Téma: svetlá', dark:'Téma: tmavá'};
    const paint = ()=>{ t.innerHTML = ICON[UI.theme||'auto']; t.title = LBL[UI.theme||'auto']+' (klikni pre zmenu)'; t.setAttribute('aria-label', LBL[UI.theme||'auto']); };
    t.addEventListener('click', ()=>{ const order=['auto','light','dark']; UI.theme = order[(order.indexOf(UI.theme||'auto')+1)%3]; saveUI(); applyTheme(); paint(); });
    paint(); nav.insertBefore(t, document.getElementById('srchBtn') || nav.querySelector('a'));
  }
  document.addEventListener('keydown', e=>{ if (e.key==='/' && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.activeElement.closest('.vimbox')){ e.preventDefault(); openSearch(); } });
  buildRail();
  $('#menuBtn').addEventListener('click', ()=>$('#rail').classList.toggle('open'));
  window.addEventListener('hashchange', route);
  route();
})();
