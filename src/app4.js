/* =========================================================
   APP 4: príkazový dril + študijný plán
   (načíta sa pred app3, ktorý spúšťa stránku)
   ========================================================= */
S.drill = S.drill || {}; S.drillLog = S.drillLog || {}; S.plan = S.plan || {}; S.seen = S.seen || {}; S.reviewDone = S.reviewDone || 0;
const DRILL = window.DRILL;
const INTERVALS = [0, 1, 3, 7, 14, 30];
const todayStr = ()=>{ const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const addDays = (s, n)=>{ const [y,m,d] = s.split('-').map(Number); const t = new Date(y, m-1, d+n); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); };
const dayDiff = (a, b)=>{ const p = s=>{ const [y,m,d]=s.split('-').map(Number); return Date.UTC(y,m-1,d); }; return Math.round((p(b)-p(a))/86400000); };
const drillTotal = ()=>Object.values(S.drillLog).reduce((s,x)=>s+x,0);
function drillDue(){ const t = todayStr(); return DRILL.filter(d=>S.drill[d.id] && S.drill[d.id].due<=t); }
function drillNew(){ return DRILL.filter(d=>!S.drill[d.id]); }

TOOLS.splice(0, 0,
  {k:'plan', ic:'☰', t:'Plán do decembra', d:'30 dní po 30–60 minút. Čo robiť dnes, sa ukáže na úvode.'},
  {k:'dril', ic:'>_', t:'Príkazový dril', d:'Otázka, ty napíšeš príkaz, simulátor ho overí. Vracia sa, kým ho nevieš naspamäť.'});

/* ---------- DRIL ---------- */
S.drillCfg = S.drillCfg || {mode:'plan', n:10, off:[], all:false};
const isUnlocked = c => !!S.read[c.n] || chapState(c)==='done';
const unlockedChs = ()=>CHAPTERS.filter(c=>S.drillCfg.all || isUnlocked(c)).map(c=>c.n);
const activeChs = ()=>{ const off = new Set(S.drillCfg.off||[]); return unlockedChs().filter(n=>!off.has(n)); };
const shuffle = a=>{ for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const plural = (n, one, few, many)=> n===1?one : (n>=2&&n<=4)?few : many;

function drillView(){
  const v = document.createElement('div'); v.className='col';
  const cfg = S.drillCfg;
  v.innerHTML = `<div class="eyebrow">Tréning</div><h1>Príkazový dril</h1>
  <p class="lead" style="font-size:16px">Dostaneš úlohu a napíšeš príkaz, ktorým by si ju vyriešil na serveri. Príkaz sa naozaj spustí v simulátore, takže prejde každý správny zápis. Otázky z tém sa odomykajú, keď kapitolu označíš ako prečítanú.</p>
  <div class="dr-stats" id="drs"></div>
  <div class="dr-set">
    <div class="seg2" role="tablist" aria-label="Režim drilu" id="drMode">
      <button type="button" data-m="plan">Plán opakovania</button><button type="button" data-m="mix">Náhodný mix</button><button type="button" data-m="chyby">Moje chyby</button>
    </div>
    <p class="sub2" id="drModeTxt"></p>
    <div class="dr-row"><span class="dr-lbl">Počet otázok</span><div class="dr-n" id="drN"></div></div>
    <div class="dr-row"><span class="dr-lbl">Témy</span><details class="dr-tdet" id="drTdet"><summary id="drTsum"></summary><div class="dr-chs" id="drChs"></div>
      <label class="dr-opt" style="margin:8px 0 0"><input type="checkbox" id="drAll" ${cfg.all?'checked':''}> Odomknúť všetky témy (aj neprečítané kapitoly)</label></details></div>
  </div>
  <div id="drbox"></div>
  <details class="dr-more"><summary>Viac možností</summary><p class="sub2">Vymaže, ktoré otázky vieš a kedy sa majú vrátiť. Počet zodpovedaných otázok v pláne ostane.</p><button class="btn sm" type="button" id="drWipe">Začať dril odznova</button> <span id="drWipeC" hidden><button class="btn sm danger" type="button" id="drWipeY">Áno, vymazať</button> <button class="btn sm" type="button" id="drWipeN">Nie</button></span></details>`;

  const pool = ()=>{ const ch = new Set(activeChs()); return DRILL.filter(d=>ch.has(d.ch)); };
  const wrongs = ()=>DRILL.filter(d=>S.drill[d.id] && S.drill[d.id].box===0 && S.drill[d.id].seen);
  const stats = ()=>{
    const due = drillDue().length, ul = pool(), nw = ul.filter(d=>!S.drill[d.id]).length, known = DRILL.filter(d=>S.drill[d.id] && S.drill[d.id].box>=3).length;
    $('#drs',v).innerHTML = `<div class="stat"><b>${due}</b><span>na zopakovanie dnes</span></div><div class="stat"><b>${ul.length}</b><span>otázok v zvolených témach</span></div><div class="stat"><b>${nw}</b><span>z nich ešte nevidených</span></div><div class="stat"><b>${known}/${DRILL.length}</b><span>viem spoľahlivo</span></div>`;
  };
  const MODE_TXT = {
    plan:'Najprv otázky, ktoré sa dnes majú vrátiť, potom nové zo zvolených tém. Čo vieš, sa vráti o 1, 3, 7, 14 a 30 dní.',
    mix:'Náhodné otázky zo všetkých zvolených tém, toľko, koľko chceš. Chyby sa pridajú do dnešného opakovania, plán správnych odpovedí sa neposúva.',
    chyby:'Len otázky, na ktoré si naposledy odpovedal zle alebo dal Neviem.'
  };
  const drawSet = ()=>{
    v.querySelectorAll('#drMode button').forEach(b=>{ b.classList.toggle('on', b.dataset.m===cfg.mode); b.setAttribute('aria-selected', b.dataset.m===cfg.mode); });
    $('#drModeTxt',v).textContent = MODE_TXT[cfg.mode];
    const ns = cfg.mode==='mix' ? [5,10,20,30,50,0] : [5,10,20,30,50];
    if (cfg.mode!=='mix' && !cfg.n) cfg.n = 10;
    $('#drN',v).innerHTML = ns.map(n=>`<button type="button" class="dchip ${cfg.n===n?'on':''}" data-n="${n}">${n||'∞ kým neprestanem'}</button>`).join('');
    const ul = new Set(unlockedChs()), off = new Set(cfg.off||[]);
    const act = activeChs().length;
    $('#drTsum',v).innerHTML = `<b>${act}</b> z ${CHAPTERS.length} tém zapnutých${cfg.all?' (všetky odomknuté)':` · odomknuté ${ul.size}`} <span class="dr-edit">Upraviť</span>`;
    $('#drChs',v).innerHTML = CHAPTERS.map(c=>{ const cnt = DRILL.filter(d=>d.ch===c.n).length; const u = ul.has(c.n); const on = u && !off.has(c.n);
      return `<button type="button" class="dchip ${on?'on':''} ${u?'':'lock'}" data-c="${c.n}" ${u?'':'disabled'} title="${u?(on?'Klikni pre vypnutie témy':'Klikni pre zapnutie témy'):'Odomkne sa po prečítaní kapitoly '+c.n}">${u?'':'🔒 '}${c.n}. ${esc(c.short)} <span class="cnt">${cnt}</span></button>`; }).join('')
      + `<div class="dr-chq"><button type="button" class="btn sm" id="drChAll">Zapnúť všetky odomknuté</button><button type="button" class="btn sm" id="drChNone">Vypnúť všetky</button></div>`;
    $('#drChAll',v).addEventListener('click', ()=>{ cfg.off=[]; save(); drawSet(); restart(); });
    $('#drChNone',v).addEventListener('click', ()=>{ cfg.off = CHAPTERS.map(c=>c.n); save(); drawSet(); restart(); });
  };
  v.querySelector('#drMode').addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; cfg.mode=b.dataset.m; if (cfg.mode!=='mix' && cfg.n===0) cfg.n=10; save(); drawSet(); restart(); });
  v.querySelector('#drN').addEventListener('click', e=>{ const b=e.target.closest('[data-n]'); if (!b) return; cfg.n=+b.dataset.n; save(); drawSet(); restart(); });
  v.querySelector('#drChs').addEventListener('click', e=>{ const b=e.target.closest('[data-c]'); if (!b || b.disabled) return; const n=+b.dataset.c; const off=new Set(cfg.off||[]); if (off.has(n)) off.delete(n); else off.add(n); cfg.off=[...off]; save(); drawSet(); restart(); });
  $('#drAll',v).addEventListener('change', e=>{ cfg.all = e.target.checked; save(); drawSet(); restart(); });
  $('#drWipe',v).addEventListener('click', ()=>{ $('#drWipeC',v).hidden=false; });
  $('#drWipeN',v).addEventListener('click', ()=>{ $('#drWipeC',v).hidden=true; });
  $('#drWipeY',v).addEventListener('click', ()=>{ S.drill = {}; save(); $('#drWipeC',v).hidden=true; restart(); });

  let queue = [], idx = 0, firstOk = 0, done = 0, infinite = false;
  const build = ()=>{
    const n = cfg.n || 0; infinite = cfg.mode==='mix' && !n;
    const P = pool();
    if (cfg.mode==='plan'){
      const due = drillDue().sort((a,b)=>S.drill[a.id].box - S.drill[b.id].box || Math.random()-.5);
      const fresh = P.filter(d=>!S.drill[d.id]).sort((a,b)=>a.ch-b.ch);
      queue = due.concat(fresh).slice(0, n||10);
    } else if (cfg.mode==='mix'){
      queue = shuffle(P.slice()); if (!infinite) queue = queue.slice(0, n);
    } else {
      queue = shuffle(wrongs()).slice(0, n||10);
    }
    idx=0; firstOk=0; done=0;
  };
  const emptyMsg = ()=>{
    if (cfg.mode==='chyby') return 'Nemáš žiadne chybné otázky. Výborne! Prepni na Plán opakovania alebo Náhodný mix.';
    if (!unlockedChs().length) return 'Zatiaľ nemáš odomknutú žiadnu tému. Prečítaj kapitolu 1 a dole ju označ ako prečítanú, alebo zapni „Odomknúť všetky témy“.';
    if (!activeChs().length) return 'Máš vypnuté všetky témy. Zapni aspoň jednu vyššie.';
    if (cfg.mode==='plan') return 'Na dnes máš všetko zopakované a v zvolených témach nie sú nové otázky. Skús Náhodný mix, alebo prečítaj ďalšiu kapitolu.';
    return 'V zvolených témach nie sú otázky.';
  };
  const card = ()=>{
    stats();
    const box = $('#drbox',v);
    if (!queue.length){ box.innerHTML = `<div class="okbar" style="display:block">${emptyMsg()}</div>`; return; }
    if (idx>=queue.length && infinite){ queue = queue.concat(shuffle(pool().slice())); }
    if (idx>=queue.length){
      const tom = DRILL.filter(d=>S.drill[d.id] && S.drill[d.id].due<=addDays(todayStr(),1)).length;
      box.innerHTML = `<div class="okbar" style="display:block"><b>Hotovo: ${firstOk} z ${done} na prvý pokus.</b><br>Na zajtra čaká ${tom} ${plural(tom,'otázka','otázky','otázok')}.</div><div class="acts" style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn pri" type="button" id="more">Ďalšie kolo</button>${wrongs().length?`<button class="btn" type="button" id="toW">Zopakovať chyby (${wrongs().length})</button>`:''}</div>`;
      $('#more',box).addEventListener('click', ()=>{ build(); card(); });
      const tw = $('#toW',box); if (tw) tw.addEventListener('click', ()=>{ cfg.mode='chyby'; save(); drawSet(); restart(); });
      return;
    }
    const d = queue[idx]; const st = S.drill[d.id];
    const ch = CHAPTERS.find(c=>c.n===d.ch);
    let attempts = 0, finished = false;
    const isVim = !!d.match;
    const ps = isVim ? 'vim (NORMAL)' : `[admin@rhel${d.ver||9}-lab ~]$`;
    const counter = infinite ? `${idx+1} · ${firstOk}/${done} správne` : `${idx+1} / ${queue.length}`;
    box.innerHTML = `<div class="drcard">
      <div class="dr-top"><span class="chip">${counter}</span><a class="chip" href="#kapitola-${d.ch}">${d.ch}. ${esc(ch?ch.short:'')}</a>${st?`<span class="chip">${st.box>0?'opakovanie':'zopakuj'}</span>`:'<span class="chip ok">nová</span>'}${d.ver===10?'<span class="chip">RHEL 10</span>':''}${infinite?'<button class="btn sm" type="button" id="drStop" style="margin-left:auto">Ukončiť</button>':''}</div>
      <p class="dr-q">${d.q}</p>
      <form class="dr-in" id="drf"><span class="ps">${esc(ps)}</span><input id="dri" type="text" placeholder="${isVim?'napíš klávesy alebo príkaz vimu':'napíš príkaz a stlač Enter'}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Tvoja odpoveď"></form>
      <div class="keybar dr-kb">${(isVim?[':','/','%','!','$','^']:['-','|','/','~','"','$','>','*']).map(k=>`<button type="button" data-key="${esc(k)}">${esc(k)}</button>`).join('')}</div>
      <div class="acts" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn pri" type="submit" form="drf">Overiť</button><button class="btn" type="button" id="dk">Neviem</button></div>
      <pre class="dr-out" id="dro" hidden></pre><div id="drr"></div></div>`;
    const inp = $('#dri',box);
    const stop = $('#drStop',box); if (stop) stop.addEventListener('click', ()=>{ queue = queue.slice(0, idx); infinite=false; card(); });
    box.querySelectorAll('.dr-kb button').forEach(b=>{ b.addEventListener('mousedown', e=>e.preventDefault()); b.addEventListener('click', ()=>{ const k=b.dataset.key; const a=inp.selectionStart??inp.value.length, z=inp.selectionEnd??a; inp.value=inp.value.slice(0,a)+k+inp.value.slice(z); try{inp.setSelectionRange(a+k.length,a+k.length);}catch(_){} inp.focus({preventScroll:true}); }); });
    const finish = (ok)=>{
      if (finished) return; finished = true; done++;
      const s = S.drill[d.id] || {box:0};
      const first = ok && attempts===1;
      if (cfg.mode==='mix' && S.drill[d.id]){
        /* náhodný mix: neposúvaj plán, len chyby pošli do dnešného opakovania */
        if (first) firstOk++; else { s.box = 0; s.due = todayStr(); }
      } else {
        if (first){ s.box = Math.min(INTERVALS.length-1, (s.box||0)+1); firstOk++; s.due = addDays(todayStr(), INTERVALS[s.box]); }
        else { s.box = 0; s.due = todayStr(); if (!infinite && !queue.slice(idx+1).includes(d)) queue.push(d); }
      }
      s.seen = (s.seen||0)+1; S.drill[d.id] = s;
      const t = todayStr(); S.drillLog[t] = (S.drillLog[t]||0)+1; save();
      const nextTxt = (cfg.mode==='mix' && s.seen>1) ? '' : (first ? `<br><span class="sub2">Znova o ${INTERVALS[s.box]} ${INTERVALS[s.box]===1?'deň':INTERVALS[s.box]<5?'dni':'dní'}.</span>` : '');
      $('#drr',box).innerHTML = `<div class="${ok?'okbar':'reveal'}" style="display:block;margin-top:10px">${ok?(attempts===1?'<b>✓ Správne.</b> ':'<b>✓ Správne, na druhý pokus.</b> Otázka sa ešte dnes vráti. '):'<b>Vzorová odpoveď:</b> '}<code>${esc(d.a)}</code><br>${esc(d.w)}${nextTxt}</div><button class="btn pri" type="button" id="nx" style="margin-top:10px">Ďalej →</button>`;
      $('#nx',box).addEventListener('click', ()=>{ idx++; card(); });
      $('#nx',box).focus();
      stats();
    };
    $('#drf',box).addEventListener('submit', e=>{
      e.preventDefault(); if (finished) return;
      const line = inp.value.trim(); if (!line) return;
      attempts++;
      let ok = false;
      const out = $('#dro',box);
      if (isVim){
        ok = d.match.test(line);
        out.hidden = true;
      } else {
        const m = new Machine(d.ver||9); if (d.setup) d.setup(m); m.log = [];
        let r; try { r = m.run(line); } catch(err){ r = {o:'', e:String(err.message)}; }
        let o = (r.o||'') + (r.e||''); o = o.replace(/\x1b[^\n]*/,'(otvoril by sa editor)').split('\n').slice(0,14).join('\n');
        out.hidden=false; out.textContent = '$ '+line+'\n'+o;
        try { ok = !!d.check(m); } catch(_){}
      }
      if (ok) finish(true);
      else { $('#drr',box).innerHTML = `<div class="reveal" style="display:block;margin-top:10px"><b>Ešte nie.</b> ${attempts===1?(isVim?'Skús to napísať presne tak, ako by si to stlačil vo vime.':'Pozri výstup, oprav príkaz a skús znova.'):'Skús ešte raz, alebo daj Neviem.'}</div>`; inp.select(); }
    });
    $('#dk',box).addEventListener('click', ()=>{ attempts = Math.max(attempts,1)+1; finish(false); });
    setTimeout(()=>inp.focus({preventScroll:true}), 30);
  };
  function restart(){ build(); card(); }
  drawSet(); restart();
  return v;
}

/* ---------- PLÁN ---------- */
const P_ = {
  ch:n=>({k:'ch', n}), inc:id=>({k:'inc', id}), vim:(a,b)=>({k:'vim', a, b}), dr:()=>({k:'dr'}), rv:()=>({k:'rv'}), tool:(t,l)=>({k:'tool', t, l}), exam:full=>({k:'exam', full})
};
const PLAN = [
 [P_.ch(1), P_.vim(0,1), P_.dr()],
 [P_.ch(2), P_.dr()],
 [P_.ch(3), P_.tool('mapa','Prejdi si Mapu súborov: /etc, /var, /opt'), P_.dr()],
 [P_.ch(4), P_.dr()],
 [P_.ch(5), P_.vim(2,6)],
 [P_.ch(6), P_.dr()],
 [P_.vim(7,12), P_.rv(), P_.dr()],
 [P_.ch(7), P_.dr()],
 [P_.ch(8), P_.inc('user'), P_.dr()],
 [P_.ch(9), P_.inc('perm'), P_.dr()],
 [P_.ch(10), P_.dr()],
 [P_.ch(11), P_.dr()],
 [P_.ch(12), P_.inc('dns'), P_.dr()],
 [P_.rv(), P_.inc('reboot'), P_.dr()],
 [P_.ch(13), P_.inc('web'), P_.dr()],
 [P_.ch(14), P_.dr()],
 [P_.ch(15), P_.dr()],
 [P_.ch(16), P_.inc('ssh'), P_.dr()],
 [P_.ch(17), P_.inc('cron'), P_.dr()],
 [P_.inc('disk'), P_.rv(), P_.dr()],
 [P_.ch(18), P_.dr()],
 [P_.ch(19), P_.dr()],
 [P_.ch(20), P_.dr()],
 [P_.ch(21), P_.dr()],
 [P_.ch(22), P_.dr()],
 [P_.ch(23), P_.dr()],
 [P_.ch(24), P_.rv(), P_.dr()],
 [P_.exam(false), P_.dr()],
 [P_.rv(), P_.dr(), P_.tool('incidenty','Zopakuj incident, ktorý ti šiel najťažšie')],
 [P_.exam(true), P_.rv()]
];
function planTaskInfo(t, dayIdx){
  const cum = k=>PLAN.slice(0, dayIdx+1).flat().filter(x=>x.k===k).length;
  switch(t.k){
    case 'ch': { const c = CHAPTERS.find(x=>x.n===t.n); return {href:'#kapitola-'+t.n, label:`Kapitola ${t.n}: ${c.short}`, sub:'prečítať, kvíz, úlohy', done: chapState(c)==='done', min:30}; }
    case 'inc': { const x = INC.find(i=>i.id===t.id); return {href:'#incident-'+t.id, label:`Incident: ${x.title}`, sub:x.area, done: !!S.inc[t.id], min:15}; }
    case 'vim': { const ok = VIM_LESSONS.slice(t.a, t.b+1).every((l,i)=>S.vim[t.a+i]); return {href:'#vim', label:`Vim lekcie ${t.a+1}–${t.b+1}`, sub:VIM_LESSONS[t.a].t+' …', done: ok, min:15}; }
    case 'dr': return {href:'#dril', label:'Príkazový dril (10 otázok)', sub:'opakovanie príkazov naspamäť', done: drillTotal() >= cum('dr')*10, min:10};
    case 'rv': return {href:'#opakovanie', label:'Opakovanie chýb z kvízov', sub:'jedna séria', done: (S.reviewDone||0) >= cum('rv'), min:10};
    case 'tool': return {href:'#'+t.t, label:t.l, sub:'', done: !!S.seen[t.t], min:10};
    case 'exam': return {href:'#skuska', label: t.full ? 'Skúšobný server bez riešenia: náhodné zadanie na 10/10' : 'Skúšobný server: prvý pokus', sub:'vyhodnotenie aj po reštarte', done: t.full ? ((S.exam.rdone||0)>0 || S.exam.best===EXAM.length) : S.exam.last!=null, min:45};
  }
}
function planDay(){ if (!S.plan.start) return null; return dayDiff(S.plan.start, todayStr()) + 1; }
function dayHTML(i, compact){
  const tasks = PLAN[i].map(t=>planTaskInfo(t, i));
  const min = tasks.reduce((s,t)=>s+t.min,0);
  return `<ul class="ptasks">${tasks.map(t=>`<li class="${t.done?'done':''}"><span class="ck">${t.done?'✓':''}</span><a href="${t.href}">${esc(t.label)}</a>${!compact&&t.sub?`<span class="ps2">${esc(t.sub)}</span>`:''}</li>`).join('')}</ul><span class="pmin">~${min} min</span>`;
}
function planCard(){
  const s = document.createElement('section'); s.className='today';
  const day = planDay();
  if (!day){ s.innerHTML = `<div><div class="eyebrow">Plán do decembra</div><h2>30 dní, 30–60 minút denne</h2><p class="sub2">Každý deň dostaneš konkrétne úlohy: kapitolu, dril, incidenty. Odškrtávajú sa samy podľa tvojho pokroku.</p></div><div class="acts"><button class="btn pri" type="button" id="pstart">Začať plán od dnes</button><a class="btn" href="#plan">Pozrieť plán</a></div>`; $('#pstart',s).addEventListener('click', ()=>{ S.plan.start = todayStr(); save(); route(); }); return s; }
  if (day>PLAN.length){ s.innerHTML = `<div><div class="eyebrow">Plán do decembra</div><h2>Plán je za tebou</h2><p class="sub2">Pokračuj denne drilom a incidentmi, nech príkazy nezabudneš.</p></div><div class="acts"><a class="btn pri" href="#dril">Dril</a><a class="btn" href="#plan">Prehľad plánu</a></div>`; return s; }
  const i = Math.max(0, day-1);
  const late = PLAN.slice(0, i).map((_,j)=>j).filter(j=>PLAN[j].some(t=>!planTaskInfo(t,j).done)).length;
  s.innerHTML = `<div class="th"><div class="eyebrow">Dnes · deň ${day} z ${PLAN.length}</div><a class="sub2" href="#plan">celý plán →</a></div>${dayHTML(i)}${late?`<p class="sub2 lateinfo">Z predošlých dní máš nedokončené: ${late} ${late===1?'deň':late<5?'dni':'dní'}. <a href="#plan">Pozri ktoré</a>.</p>`:''}`;
  return s;
}
function planView(){
  const v = document.createElement('div'); v.className='col';
  const day = planDay();
  const doneDays = PLAN.filter((d,i)=>d.every(t=>planTaskInfo(t,i).done)).length;
  v.innerHTML = `<div class="eyebrow">Plán do decembra</div><h1>30 dní do nástupu</h1>
  <p class="lead" style="font-size:16px">Každý deň 30–60 minút. Úlohy sa odškrtnú samy, keď ich splníš (kapitola = prečítaná + kvíz + úlohy). Keď deň nestihneš, nič sa nedeje: pokračuj tam, kde si skončil.</p>
  <div class="parts">${S.plan.start?`<span class="chip">začiatok ${esc(S.plan.start.split('-').reverse().join('. '))}</span><span class="chip">${day<=PLAN.length?'dnes deň '+day:'po pláne'}</span>`:''}<span class="chip ${doneDays===PLAN.length?'ok':''}">hotové dni ${doneDays}/${PLAN.length}</span><button class="btn sm" type="button" id="prestart">${S.plan.start?'Začať plán znova od dnes':'Začať plán od dnes'}</button></div>
  <div class="track big"><div class="fill" style="width:${100*doneDays/PLAN.length}%"></div></div>
  <ol class="pdays">${PLAN.map((d,i)=>{ const all = d.every(t=>planTaskInfo(t,i).done); const cur = day===i+1; const past = day && i+1<day; return `<li class="${all?'done':''} ${cur?'cur':''} ${past&&!all?'late':''}"><div class="pd-h"><b>Deň ${i+1}</b>${S.plan.start?`<span>${esc(addDays(S.plan.start,i).split('-').reverse().slice(0,2).join('. '))}.</span>`:''}${cur?'<span class="chip">dnes</span>':''}${past&&!all?'<span class="chip warnc">dobehni</span>':''}${all?'<span class="chip ok">✓</span>':''}</div>${dayHTML(i,true)}</li>`; }).join('')}</ol>`;
  $('#prestart',v).addEventListener('click', ()=>{ S.plan.start = todayStr(); save(); route(); });
  return v;
}
const _homeView2 = homeView;
homeView = function(){ const v = _homeView2(); const hero = v.querySelector('.hero'); if (hero) hero.after(planCard()); return v; };
