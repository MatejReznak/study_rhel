/* =========================================================
   APP 5: náhodná skúška, skutočný server, postupy,
   moje poznámky, denná pripomienka
   (načíta sa po app3, pred sync.js)
   ========================================================= */
S.notes = S.notes || {}; S.lab = S.lab || {};

/* ---------- SKÚŠKA: náhodné aj pevné zadanie ---------- */
examView = function(){
  const v = document.createElement('div'); v.className='page';
  S.exam.mode = S.exam.mode || 'rnd';
  if (!S.exam.rseed) { S.exam.rseed = 1 + Math.floor(Math.random()*99999); save(); }
  let mode = S.exam.mode;
  const list = ()=> mode==='rnd' ? window.makeExam(S.exam.rseed, 10) : EXAM.map(r=>Object.assign({}, r));
  let REQ = list();
  v.innerHTML = `<div class="chap"><div class="txt">
    <div class="eyebrow">Záverečná skúška</div><h1>Skúšobný server</h1>
    <p class="lead" style="font-size:16px">Dostal si čistý server. Priprav ho podľa zadania. Stav „teraz“ sa kontroluje priebežne. <b>Vyhodnotiť</b> navyše reštartuje kópiu servera a ukáže, čo by po reštarte ostalo. Splnené je len to, čo platí v oboch stĺpcoch.</p>
    <div class="seg2" role="tablist" id="exMode" style="margin:4px 0 12px"><button type="button" data-m="rnd">Náhodné zadanie</button><button type="button" data-m="fix">Pevné zadanie</button></div>
    <div class="parts" id="exHead"></div>
    <div class="exam"><div class="ex-h"><span>Zadanie</span><span>teraz</span><span>po reštarte</span></div><ol id="req"></ol></div>
    <div class="parts" style="margin-top:12px"><button class="btn pri" type="button" id="evalBtn">Vyhodnotiť</button><span class="chip" id="exScore"></span><button class="btn sm" type="button" id="solBtn">Ukázať riešenie</button></div>
    <div class="parts" id="exBest" style="margin-top:6px"></div>
    <div id="exOut"></div><div class="reveal" id="exSol" hidden></div>
  </div><aside id="side"></aside></div>`;
  const side = $('#side',v);
  let after = null;
  const term = new Term(side, {title:'ssh admin@novy-server', onRun:m=>live(m), onReset:t=>{ after=null; live(t.m); }});
  const pill = (ok, na)=> na ? '<span class="pill na">–</span>' : `<span class="pill ${ok?'ok':'no'}">${ok?'✓':'✗'}</span>`;
  const evalOn = m => REQ.map(r=>{ try { return !!r.check(m); } catch(e){ return false; } });
  function draw(nowRes){ $('#req',v).innerHTML = REQ.map((r,i)=>`<li><span class="rt">${r.t}</span>${pill(nowRes[i])}${pill(after?after[i]:false, !after)}</li>`).join(''); }
  function live(m){ draw(evalOn(m)); }
  const bestKey = ()=> mode==='rnd' ? 'rbest' : 'best';
  const drawHead = ()=>{
    v.querySelectorAll('#exMode button').forEach(b=>b.classList.toggle('on', b.dataset.m===mode));
    $('#exHead',v).innerHTML = mode==='rnd'
      ? `<span class="chip">zadanie č. ${S.exam.rseed}</span><span class="chip">${REQ.length} úloh z ${window.EXAM_POOL.length} oblastí</span><button class="btn sm" type="button" id="exNew">Nové zadanie</button>`
      : `<span class="chip">rovnaké zadanie pri každom pokuse</span>`;
    const nb = $('#exNew',v); if (nb) nb.addEventListener('click', ()=>{ S.exam.rseed = 1 + Math.floor(Math.random()*99999); save(); REQ = list(); after=null; $('#exSol',v).hidden=true; $('#exOut',v).innerHTML=''; $('#exScore',v).textContent=''; term.reset(true); drawHead(); });
  };
  const drawBest = ()=>{ const b = $('#exBest',v); const k = bestKey(); const done = S.exam.rdone||0;
    if (S.exam[k]==null && !done){ b.innerHTML=''; return; }
    b.innerHTML = `${S.exam[k]!=null?`<span class="chip">najlepší výsledok ${S.exam[k]}/${REQ.length}</span>`:''}${mode==='rnd' && done?`<span class="chip ok">náhodných zadaní na 10/10: ${done}</span>`:''}<button class="btn sm" type="button" id="exReset">Vymazať výsledky skúšky</button>`;
    $('#exReset',b).addEventListener('click', ()=>{ const keep = {mode:S.exam.mode, rseed:S.exam.rseed}; S.exam = keep; save(); after=null; $('#exScore',v).textContent=''; $('#exScore',v).className='chip'; $('#exOut',v).innerHTML=''; drawBest(); live(term.m); }); };
  v.querySelector('#exMode').addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b || b.dataset.m===mode) return; mode = S.exam.mode = b.dataset.m; save(); REQ = list(); after=null; $('#exSol',v).hidden=true; $('#exOut',v).innerHTML=''; $('#exScore',v).textContent=''; term.reset(true); drawHead(); drawBest(); });
  $('#evalBtn',v).addEventListener('click', ()=>{
    const now = evalOn(term.m);
    let c2, msg='';
    try { c2 = term.m.clone(); c2.user='root'; const r = c2.c_reboot([]); c2.user='admin'; msg = (r && r.o) ? r.o.split('Čo sa pri reštarte stalo:')[1] || r.o : ''; }
    catch(e){ msg = 'Reštart sa nepodarilo nasimulovať: '+e.message; }
    after = c2 ? evalOn(c2) : REQ.map(()=>false);
    draw(now);
    const score = REQ.filter((r,i)=>now[i] && after[i]).length; const k = bestKey();
    S.exam[k] = Math.max(S.exam[k]||0, score); S.exam.last = score;
    if (mode==='rnd' && score===REQ.length){ S.exam.rok = S.exam.rok||{}; if (!S.exam.rok[S.exam.rseed]){ S.exam.rok[S.exam.rseed]=1; S.exam.rdone = (S.exam.rdone||0)+1; } }
    if (mode==='fix') S.exam.best = Math.max(S.exam.best||0, score);
    save();
    $('#exScore',v).textContent = `${score} / ${REQ.length}`; $('#exScore',v).className = 'chip'+(score===REQ.length?' ok':'');
    $('#exOut',v).innerHTML = `<div class="${score===REQ.length?'okbar':'reveal'}" style="display:block;margin-top:12px">${score===REQ.length?'<b>✓ Všetko splnené, aj po reštarte.</b>'+(mode==='rnd'?' Skús ďalšie zadanie: tlačidlo Nové zadanie.':''):`<b>Splnené ${score} z ${REQ.length}.</b> Červené v stĺpci „po reštarte“ znamená, že zmena nie je trvalá.`}${msg?`<pre style="white-space:pre-wrap;margin:8px 0 0">${esc(msg.trim())}</pre>`:''}</div>`;
    drawBest();
  });
  $('#solBtn',v).addEventListener('click', ()=>{ const s=$('#exSol',v); s.hidden=!s.hidden; if (s.hidden) return;
    const txt = mode==='rnd' ? REQ.map((r,i)=>`# ${i+1}. ${r.t.replace(/<[^>]+>/g,'')}\n${r.sol.join('\n')}`).join('\n\n') : window.EXAM_SOL;
    s.innerHTML = '<b>Jedno možné riešenie</b> (skús najprv bez neho):<pre>'+esc(txt)+'</pre><p class="sub2">Súbory môžeš upravovať aj vo vime (sudo vim …). Heslá v simulátore nastaví passwd automaticky.</p>'; });
  drawHead(); drawBest(); live(term.m);
  addTermFab(v, side);
  return v;
};

/* ---------- spoločné ---------- */
const copyText = async (t, btn)=>{ try { await navigator.clipboard.writeText(t); if (btn){ const o=btn.textContent; btn.textContent='Skopírované ✓'; setTimeout(()=>btn.textContent=o,1400); } } catch(e){ if (btn) btn.textContent='Označ a skopíruj ručne'; } };
const canDownload = location.protocol==='file:' || !window.claude;
const downloadFile = (name, text, type)=>{ const blob = new Blob([text], {type: type||'text/plain'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 800); };
const explainCmd = c => { window.__explainPreset = c; if (location.hash==='#rozlustit') route(); else location.hash = 'rozlustit'; };
function fixRunButtons(root){ root.querySelectorAll('.cmd .run').forEach(b=>{ b.textContent='Kopírovať'; b.removeAttribute('data-run'); const c = b.parentElement.querySelector('.c'); const t = c ? c.childNodes[0].textContent : ''; b.addEventListener('click', ()=>copyText(t, b)); }); }

/* ---------- MOJE POZNÁMKY ---------- */
const NOTE_TITLES = ()=>Object.assign({free:'Všeobecné poznámky', tahak:'Ťahák', lab:'Skutočný server', postupy:'Postupy pri problémoch'}, Object.fromEntries(CHAPTERS.map(c=>['ch-'+c.n, `Kapitola ${c.n}: ${c.short}`])));
function noteBox(key, title, ph){
  const s = document.createElement('section'); s.className = 'note-box';
  s.innerHTML = `<div class="nb-h"><h3>${esc(title||'Moje poznámky')}</h3><span class="sub2 nb-st" aria-live="polite"></span></div>
    <textarea rows="4" spellcheck="true" placeholder="${esc(ph||'Napr. ako to robíme u nás vo firme, mená serverov, vlastné príkazy… (heslá sem nepíš)')}" aria-label="${esc(title||'Moje poznámky')}"></textarea>
    <p class="sub2">Ukladá sa samo${(()=>{ try { return JSON.parse(localStorage.getItem('rhel-v-praxi-sync')||'{}').gist ? ' a synchronizuje sa medzi zariadeniami' : ' v tomto prehliadači (synchronizáciu zapneš na úvodnej stránke)'; } catch(e){ return ''; } })()}. Heslá a tajomstvá sem nepíš.</p>`;
  const ta = $('textarea', s), st = $('.nb-st', s);
  ta.value = S.notes[key] || '';
  const grow = ()=>{ ta.style.height='auto'; ta.style.height = Math.min(600, Math.max(96, ta.scrollHeight+2))+'px'; };
  let tm;
  ta.addEventListener('input', ()=>{ grow(); st.textContent='Ukladám…'; clearTimeout(tm); tm = setTimeout(()=>{ const v = ta.value; if (v.trim()) S.notes[key] = v; else delete S.notes[key]; save(); SEARCH_IX = null; st.textContent = 'Uložené ✓'; }, 500); });
  setTimeout(grow, 0);
  return s;
}
function notesMarkdown(){
  const T = NOTE_TITLES(); const keys = Object.keys(S.notes).filter(k=>(S.notes[k]||'').trim());
  const order = k => k==='free'?0 : k.startsWith('ch-')? +k.slice(3) : 100;
  return '# Moje poznámky – RHEL v praxi\n\n' + keys.sort((a,b)=>order(a)-order(b)).map(k=>`## ${T[k]||k}\n\n${S.notes[k].trim()}\n`).join('\n');
}
function notesView(){
  const v = document.createElement('div'); v.className='col';
  const T = NOTE_TITLES();
  v.innerHTML = `<div class="eyebrow">Tvoja príručka</div><h1>Moje poznámky</h1>
  <p class="lead" style="font-size:16px">Sem si zapisuj, ako sa veci robia u vás vo firme: mená serverov, postupy, vlastné príkazy, čo ťa prekvapilo. Poznámky ku kapitolám píšeš priamo na konci kapitoly, tu sú všetky pokope a dajú sa hľadať (klávesa /).</p>
  <div class="acts" style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px"><button class="btn" type="button" id="nCopy">Kopírovať všetko</button>${canDownload?'<button class="btn" type="button" id="nDl">Stiahnuť ako .md</button>':''}
  <label class="nadd">Pridať ku kapitole <select id="nAdd"><option value="">vyber…</option>${CHAPTERS.map(c=>`<option value="ch-${c.n}">${c.n}. ${esc(c.short)}</option>`).join('')}</select></label></div>
  <div id="nList"></div>`;
  const list = $('#nList', v);
  const keys = ['free'].concat(Object.keys(S.notes).filter(k=>k!=='free' && (S.notes[k]||'').trim()).sort((a,b)=>(a.startsWith('ch-')?+a.slice(3):100)-(b.startsWith('ch-')?+b.slice(3):100)));
  for (const k of keys){ const nb = noteBox(k, T[k]||k); if (k.startsWith('ch-')) nb.querySelector('.nb-h').insertAdjacentHTML('beforeend', `<a class="sub2" href="#kapitola-${k.slice(3)}">otvoriť kapitolu →</a>`); list.appendChild(nb); }
  $('#nCopy',v).addEventListener('click', e=>copyText(notesMarkdown(), e.target));
  const dl = $('#nDl',v); if (dl) dl.addEventListener('click', ()=>downloadFile('moje-poznamky-rhel.md', notesMarkdown(), 'text/markdown'));
  $('#nAdd',v).addEventListener('change', e=>{ const k = e.target.value; if (!k) return; if (list.querySelector(`[data-k="${k}"]`)) return; const nb = noteBox(k, T[k]); nb.dataset.k = k; list.appendChild(nb); nb.querySelector('textarea').focus(); e.target.value=''; });
  return v;
}

/* ---------- SKUTOČNÝ SERVER ---------- */
const labKey = (n,i)=>`${n}-${i}`;
const labCount = ()=>{ let d=0, t=0; for (const [n, arr] of Object.entries(window.LAB_TASKS)) arr.forEach((x,i)=>{ t++; if (S.lab[labKey(n,i)]) d++; }); return {d, t}; };
function labTaskList(n, compact){
  const arr = window.LAB_TASKS[n] || []; const box = document.createElement('div'); box.className='labl';
  box.innerHTML = arr.map((x,i)=>`<label class="labt ${S.lab[labKey(n,i)]?'done':''}"><input type="checkbox" data-i="${i}" ${S.lab[labKey(n,i)]?'checked':''}><div><p>${x.t}</p><p class="lok"><b>Uvidíš:</b> ${x.ok}</p>${x.w?`<p class="lw"><b>Pozor:</b> ${x.w}</p>`:''}</div></label>`).join('');
  box.addEventListener('change', e=>{ const cb = e.target.closest('input[data-i]'); if (!cb) return; const k = labKey(n, cb.dataset.i); if (cb.checked) S.lab[k] = true; else delete S.lab[k]; cb.closest('.labt').classList.toggle('done', cb.checked); save(); const c = box.closest('[data-labn]'); if (c){ const done = arr.filter((x,i)=>S.lab[labKey(n,i)]).length; const ch = c.querySelector('.labc'); if (ch) ch.textContent = `${done}/${arr.length}`; } });
  return box;
}
function labView(){
  const v = document.createElement('div'); v.className='col';
  const {d, t} = labCount();
  v.innerHTML = `<div class="eyebrow">Prax</div><h1>Skutočný server</h1>
  <p class="lead" style="font-size:16px">Simulátor ťa naučí príkazy, ale až na skutočnom serveri uvidíš skutočné chybové hlášky, reštarty a rýchlosť. Tu je návod, ako si RHEL nainštaluješ zadarmo na Mac s Apple čipom, a úlohy ku každej kapitole.</p>
  <div class="parts"><span class="chip ${S.lab['g-ready']?'ok':''}">${S.lab['g-ready']?'✓ server pripravený':'server ešte nemáš'}</span><span class="chip">úlohy na serveri ${d}/${t}</span></div>
  <h2 class="lab-h">Návod krok za krokom</h2><div id="lg"></div>
  <h2 class="lab-h" id="lab-ulohy">Úlohy podľa kapitol</h2><p class="sub">Rob ich po prečítaní kapitoly. Odškrtni, čo si urobil. Ak sa niečo pokazí, pozri <a href="#postupy">Postupy pri problémoch</a>.</p><div id="lt"></div>`;
  const lg = $('#lg', v);
  window.LAB_GUIDE.forEach((g, gi)=>{
    const det = document.createElement('details'); det.className='lab-g'; if (!S.lab['g-'+g.id] && !Object.keys(S.lab).some(k=>k.startsWith('g-')&&k!=='g-ready') ? gi<2 : false) det.open = true;
    det.innerHTML = `<summary><span class="lgc ${S.lab['g-'+g.id]?'ok':''}">${S.lab['g-'+g.id]?'✓':gi}</span><b>${esc(g.t)}</b></summary>`;
    const body = renderBody(g.b); fixRunButtons(body); det.appendChild(body);
    if (g.id!=='g0' && g.id!=='g10' && g.id!=='g11'){
      const row = document.createElement('label'); row.className='lab-done'; row.innerHTML = `<input type="checkbox" ${S.lab['g-'+g.id]?'checked':''}> Tento krok mám hotový`;
      row.querySelector('input').addEventListener('change', e=>{ if (e.target.checked) S.lab['g-'+g.id]=true; else delete S.lab['g-'+g.id]; if (g.id==='g7'){ if (e.target.checked) S.lab['g-ready']=true; else delete S.lab['g-ready']; } save(); const c = det.querySelector('.lgc'); c.classList.toggle('ok', e.target.checked); c.textContent = e.target.checked ? '✓' : gi; });
      det.appendChild(row);
    }
    lg.appendChild(det);
  });
  const lt = $('#lt', v);
  for (const c of CHAPTERS){
    const arr = window.LAB_TASKS[c.n] || []; if (!arr.length) continue;
    const done = arr.filter((x,i)=>S.lab[labKey(c.n,i)]).length;
    const det = document.createElement('details'); det.className='lab-g'; det.dataset.labn = c.n;
    det.innerHTML = `<summary><span class="lgc">${c.n}</span><b>${esc(c.short)}</b><span class="chip labc" style="margin-left:auto">${done}/${arr.length}</span></summary>`;
    det.appendChild(labTaskList(c.n));
    det.insertAdjacentHTML('beforeend', `<p class="sub2" style="margin:6px 0 4px"><a href="#kapitola-${c.n}">Otvoriť kapitolu ${c.n} →</a></p>`);
    lt.appendChild(det);
  }
  v.appendChild(noteBox('lab', 'Poznámky k môjmu serveru', 'Napr. IP adresa VM, čo som inštaloval, čo sa pokazilo a ako som to opravil (heslá sem nepíš)'));
  return v;
}

/* ---------- POSTUPY PRI PROBLÉMOCH ---------- */
function runbookView(openId){
  const v = document.createElement('div'); v.className='col'; v.style.maxWidth='1000px';
  v.innerHTML = `<div class="eyebrow">Keď niečo nejde</div><h1>Postupy pri problémoch</h1>
  <p class="lead" style="font-size:16px">Nájdi príznak, spusti prvé príkazy zhora nadol a podľa výsledku vyber príčinu. Klikni na príkaz a uvidíš, čo znamená každý prepínač.</p>
  <div class="rb-uni"><b>Univerzálny postup pri každom probléme</b><ol><li><b>Čo presne</b> nefunguje, pre koho a od kedy? Zapíš si presnú chybovú hlášku.</li><li><b>Logy:</b> <code>systemctl status SLUŽBA</code>, <code>journalctl -xeu SLUŽBA</code>, <code>/var/log/…</code></li><li><b>Čo sa zmenilo?</b> <code>dnf history</code>, <code>last</code>, <code>ls -lt /etc | head</code>, kolegovia, tikety.</li><li><b>Jedna zmena naraz</b>, pred zmenou záloha (<code>cp subor subor.bak-$(date +%F)</code>).</li><li><b>Over</b> (aj po reštarte, ak to ide) a <b>zapíš</b>, čo si spravil.</li></ol></div>
  <input class="search" id="rbq" type="search" placeholder="Hľadaj príznak: disk, ssh, 403, pomalý, heslo, certifikát…" aria-label="Hľadať postup">
  <div id="rbl"></div>`;
  const L = $('#rbl', v);
  const cmdRow = ([c, why])=>`<div class="rb-c"><button type="button" class="rb-cmd" data-c="${esc(c)}" title="Vysvetliť príkaz">${esc(c)}</button><span>${esc(why)}</span></div>`;
  for (const r of window.RUNBOOKS){
    const det = document.createElement('details'); det.className='rb'; det.id = 'postup-'+r.id; det.dataset.s = norm(r.t+' '+r.sym+' '+r.first.map(x=>x.join(' ')).join(' ')+' '+r.causes.map(x=>x[0]+' '+x[1].join(' ')).join(' '));
    det.innerHTML = `<summary><b>${esc(r.t)}</b><span class="sub2">${esc(r.sym)}</span></summary>
      <div class="rb-b">
        <h4>1. Prvé príkazy</h4>${r.first.map(cmdRow).join('')}
        <h4>2. Časté príčiny a oprava</h4><div class="rb-causes">${r.causes.map(([c,fix])=>`<div class="rb-cause"><b>${esc(c)}</b>${fix.map(f=>`<code>${esc(f)}</code>`).join('')}</div>`).join('')}</div>
        <h4>3. Over</h4><div class="rb-ver">${r.verify.map(x=>`<code>${esc(x)}</code>`).join('')}</div>
        <p class="sub2 rb-rel">Súvisí: ${r.ch.map(n=>`<a href="#kapitola-${n}">kapitola ${n}</a>`).join(', ')}${r.inc.length?' · nacvič si: '+r.inc.map(id=>{ const x = window.INCIDENTS.find(i=>i.id===id); return x?`<a href="#incident-${id}">${esc(x.title)}</a>`:''; }).filter(Boolean).join(', '):''}</p>
      </div>`;
    L.appendChild(det);
  }
  L.addEventListener('click', e=>{ const b = e.target.closest('.rb-cmd'); if (b) explainCmd(b.dataset.c.split(';')[0].replace(/\s*\|.*$/,'').trim()); });
  $('#rbq', v).addEventListener('input', e=>{ const w = norm(e.target.value).split(/\s+/).filter(Boolean); L.querySelectorAll('.rb').forEach(d=>{ const ok = w.every(x=>d.dataset.s.includes(x)); d.hidden = !ok; if (w.length && ok) d.open = true; if (!w.length) d.open = false; }); });
  v.appendChild(noteBox('postupy', 'Moje postupy', 'Postupy z vašej firmy: koho volať, kde je monitoring, ako sa hlási výpadok…'));
  if (openId) setTimeout(()=>{ const d = document.getElementById('postup-'+openId); if (d){ d.open = true; d.scrollIntoView({block:'start'}); } }, 30);
  return v;
}

/* ---------- kapitola: úlohy na serveri + poznámky ---------- */
const _chapterView5 = chapterView;
chapterView = function(c){
  const v = _chapterView5(c);
  const fin = v.querySelector('#readBtn'); const anchor = fin ? fin.closest('.sect') : null;
  const txt = v.querySelector('.txt');
  if (window.LAB_TASKS[c.n]){
    const s = document.createElement('section'); s.className='sect'; s.dataset.labn = c.n;
    const arr = window.LAB_TASKS[c.n]; const done = arr.filter((x,i)=>S.lab[labKey(c.n,i)]).length;
    s.innerHTML = `<h2 id="na-serveri">Na skutočnom serveri <span class="chip labc" style="vertical-align:middle">${done}/${arr.length}</span></h2><p class="sub">${S.lab['g-ready']?'Zopakuj kapitolu na svojej VM a odškrtni, čo máš.':'Keď budeš mať vlastný RHEL (<a href="#server">návod pre Mac</a>), sprav tieto úlohy naozaj. Uvidíš skutočné hlášky.'}</p>`;
    s.appendChild(labTaskList(c.n));
    if (anchor) txt.insertBefore(s, anchor); else txt.appendChild(s);
  }
  const nb = noteBox('ch-'+c.n, 'Moje poznámky ku kapitole'); nb.id = 'poznamky-kap'; nb.classList.add('sect');
  if (anchor) txt.insertBefore(nb, anchor); else txt.appendChild(nb);
  const mini = v.querySelector('#mini');
  if (mini){ mini.insertAdjacentHTML('beforeend', `${window.LAB_TASKS[c.n]?'<button type="button" class="em" data-t="na-serveri">Na serveri</button>':''}<button type="button" class="em" data-t="poznamky-kap">Poznámky</button>`); }
  return v;
};
const _cheatView5 = cheatView;
cheatView = function(){ const v = _cheatView5(); v.appendChild(noteBox('tahak', 'Môj ťahák', 'Príkazy, ktoré používam najčastejšie, firemné skratky…')); return v; };

/* ---------- DENNÁ PRIPOMIENKA (.ics) ---------- */
const icsEsc = s => String(s).replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
const icsFold = line => { const out = []; let l = line; while (l.length > 72){ out.push(l.slice(0,72)); l = ' ' + l.slice(72); } out.push(l); return out.join('\r\n'); };
const ymd = d => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
function buildIcs(opts){
  const [hh, mm] = (opts.time||'18:00').split(':').map(Number);
  const url = /^https?:/.test(location.protocol) ? location.href.split('#')[0] : '';
  const L = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RHEL v praxi//SK','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
  const ev = (d, uid, sum, desc, rrule)=>{ const st = `${ymd(d)}T${String(hh).padStart(2,'0')}${String(mm).padStart(2,'0')}00`; const endM = hh*60+mm+(opts.dur||45); const en = `${ymd(d)}T${String(Math.floor(endM/60)%24).padStart(2,'0')}${String(endM%60).padStart(2,'0')}00`;
    L.push('BEGIN:VEVENT', 'UID:'+uid, 'DTSTAMP:'+stamp, 'DTSTART:'+st, 'DTEND:'+en, icsFold('SUMMARY:'+icsEsc(sum)), icsFold('DESCRIPTION:'+icsEsc(desc + (url?'\n\nOtvor kurz: '+url:''))), ...(url?[icsFold('URL:'+url)]:[]), ...(rrule?[rrule]:[]), 'BEGIN:VALARM','ACTION:DISPLAY',icsFold('DESCRIPTION:'+icsEsc(sum)),'TRIGGER:PT0S','END:VALARM','END:VEVENT'); };
  if (opts.kind==='plan'){
    if (!S.plan.start){ S.plan.start = todayStr(); save(); }
    const day = Math.max(1, planDay()||1);
    for (let i = day-1; i < PLAN.length; i++){
      const tasks = PLAN[i].map(t=>planTaskInfo(t, i));
      const d = new Date(); d.setDate(d.getDate() + (i - (day-1)));
      const first = tasks.find(t=>/Kapitola|Incident|Skúšobný/.test(t.label)) || tasks[0];
      ev(d, `rhel-plan-${S.plan.start}-${i+1}@rhel-v-praxi`, `RHEL deň ${i+1}: ${first.label.replace(/<[^>]+>/g,'')}`, tasks.map(t=>`• ${t.label.replace(/<[^>]+>/g,'')}${t.min?` (${t.min} min)`:''}`).join('\n'));
    }
  } else {
    ev(new Date(), `rhel-denne-${stamp}@rhel-v-praxi`, 'RHEL: denný tréning', '• Príkazový dril (10 otázok)\n• Otázky na zopakovanie\n• Ak máš čas: ďalšia kapitola alebo incident', 'RRULE:FREQ=DAILY');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}
function reminderBox(){
  const s = document.createElement('section'); s.className='sect rem';
  s.innerHTML = `<h2 id="pripomienka">Denná pripomienka</h2>
  <p class="sub">Pridaj si do kalendára (iPhone, Mac) udalosť s upozornením na každý deň plánu. V každej je napísané, čo máš v ten deň robiť.</p>
  ${canDownload ? `<div class="rem-f"><label>Čas <input type="time" id="remT" value="${esc(UI.remT||'18:00')}"></label><label>Dĺžka <select id="remD"><option value="30">30 min</option><option value="45" selected>45 min</option><option value="60">60 min</option></select></label></div>
  <div class="acts" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button class="btn pri" type="button" id="remPlan">Pridať plán do kalendára (.ics)</button><button class="btn" type="button" id="remDaily">Len opakovaná denná pripomienka</button></div>
  <p class="sub2" style="margin-top:8px">iPhone: súbor sa otvorí v Kalendári (Pridať všetko). Ak sa uloží do Súborov, otvor ho tam. Mac: dvojklik otvorí Kalendár. Ak plán posunieš, starý import v Kalendári zmaž a pridaj nový.</p>`
  : `<div class="reveal" style="display:block">V aplikácii Claude sa súbory nesťahujú. Pripomienku si pridaj z verzie otvorenej v Safari (GitHub Pages) alebo zo súboru na Macu.</div>`}`;
  if (canDownload){
    const t = $('#remT', s); t.addEventListener('change', ()=>{ UI.remT = t.value; saveUI(); });
    $('#remPlan', s).addEventListener('click', ()=>downloadFile('rhel-plan.ics', buildIcs({kind:'plan', time:t.value, dur:+$('#remD',s).value}), 'text/calendar'));
    $('#remDaily', s).addEventListener('click', ()=>downloadFile('rhel-denne.ics', buildIcs({kind:'daily', time:t.value, dur:+$('#remD',s).value}), 'text/calendar'));
  }
  return s;
}
const _planView5 = planView;
planView = function(){ const v = _planView5(); v.appendChild(reminderBox()); return v; };

/* ---------- plán: skutočný server a nové incidenty ---------- */
const _pti5 = planTaskInfo;
planTaskInfo = function(t, i){ if (t.k==='lab') return {href:'#server', label:'Skutočný server: nainštaluj RHEL na Mac (UTM)', sub:'návod krok za krokom, raz za celý kurz', done: !!S.lab['g-ready'], min:60}; return _pti5(t, i); };
(()=>{ const I = id=>({k:'inc', id}); const add = (d, ...t)=>{ if (PLAN[d-1] && !PLAN[d-1].some(x=>t.some(y=>JSON.stringify(x)===JSON.stringify(y)))) PLAN[d-1].push(...t); };
  add(7, {k:'lab'}); add(14, {k:'ch', n:25}); add(24, {k:'ch', n:26}); add(16, I('nas')); add(8, I('lock')); add(11, I('envf')); add(12, I('repo')); add(17, I('fstab')); add(19, I('cas'));
  add(20, I('varfull'), {k:'tool', t:'postupy', l:'Prejdi Postupy pri problémoch (disk, služba, web)'}); add(21, I('cert')); add(22, I('cpu')); add(26, I('oom')); add(27, I('update')); })();

/* ---------- nástroje, vyhľadávanie, smerovanie ---------- */
TOOLS.splice(2, 0,
  {k:'server', ic:'VM', t:'Skutočný server', d:'Návod: RHEL zadarmo na tvojom Macu (UTM) a úlohy ku každej kapitole.'},
  {k:'postupy', ic:'SOS', t:'Postupy pri problémoch', d:'Príznak → prvé príkazy → príčina → oprava. Na rýchle použitie v práci.'},
  {k:'poznamky', ic:'✎', t:'Moje poznámky', d:'Tvoje poznámky ku kapitolám a firemné postupy, synchronizované.'});
const _buildIndex5 = buildIndex;
buildIndex = function(){
  const ix = _buildIndex5();
  const add = e => { e.n = norm(e.text); e.nt = norm(e.title); ix.push(e); };
  for (const r of window.RUNBOOKS) add({kind:'Postup', title:r.t, sub:r.sym, href:'postup-'+r.id, text:r.t+' '+r.sym+' '+r.first.map(x=>x.join(' ')).join(' ')+' '+r.causes.map(x=>x[0]+' '+x[1].join(' ')).join(' ')});
  for (const g of window.LAB_GUIDE) add({kind:'Skutočný server', title:g.t, sub:'návod pre Mac', href:'server', text:g.t+' '+JSON.stringify(g.b).replace(/<[^>]+>/g,' ')});
  for (const [n, arr] of Object.entries(window.LAB_TASKS)) arr.forEach(x=>add({kind:'Na serveri '+n, title:strip(x.t).slice(0,90), sub:'úloha na skutočnom serveri', href:'kapitola-'+n, id:'na-serveri', text:strip(x.t)+' '+strip(x.ok)}));
  const T = NOTE_TITLES();
  for (const [k, t] of Object.entries(S.notes)) if ((t||'').trim()) add({kind:'Moja poznámka', title:T[k]||k, sub:t.slice(0,80), href: k.startsWith('ch-') ? 'kapitola-'+k.slice(3) : (k==='tahak'?'tahak':k==='lab'?'server':k==='postupy'?'postupy':'poznamky'), id: k.startsWith('ch-') ? 'poznamky-kap' : null, text:t});
  return ix;
};
SEARCH_IX = null;
const _route5 = route;
route = function(){
  const h = (location.hash||'#uvod').slice(1);
  let node = null, key = h;
  const pm = h.match(/^postup-(.+)$/);
  if (h==='server') node = labView();
  else if (h==='postupy') node = runbookView();
  else if (pm && window.RUNBOOKS.find(r=>r.id===pm[1])) { node = runbookView(pm[1]); key = 'postupy'; }
  else if (h==='poznamky') node = notesView();
  if (!node) return _route5();
  S.seen = S.seen||{}; if (!S.seen[key]){ S.seen[key]=true; save(); }
  view.innerHTML=''; view.appendChild(node);
  document.querySelectorAll('.rail a').forEach(a=>a.classList.toggle('on', a.dataset.k===key));
  document.querySelectorAll('.bar nav a').forEach(a=>a.classList.toggle('on', a.dataset.nav===key));
  $('#rail').classList.remove('open'); refreshProgress(); window.scrollTo(0,0);
  if (window.__scrollTo){ const t = document.getElementById(window.__scrollTo); window.__scrollTo=null; if (t) setTimeout(()=>{ t.scrollIntoView({block:'start'}); }, 30); }
};
window.removeEventListener('hashchange', _route5);
window.addEventListener('hashchange', ()=>route());
buildRail();

/* ---------- verzia kurzu na úvode ---------- */
const _homeView5 = homeView;
homeView = function(){ const v = _homeView5(); v.insertAdjacentHTML('beforeend', `<p class="sub2" style="margin:28px 0 0;text-align:center">Verzia kurzu: ${esc(window.APP_VER||'?')}. Ak tu nevidíš najnovšiu, obnov stránku (Mac: Command + Shift + R).</p>`); return v; };

/* ---------- prekreslenie po načítaní rozšírení ---------- */
route();
