/* =========================================================
   APP: stránky, dáta mapy, ťahák, vim lekcie, router
   ========================================================= */
const view = $('#view');
const TOOLS = [
  {k:'terminal', ic:'$_', t:'Terminál', d:'Voľný simulovaný RHEL 9/10: skúšaj čokoľvek bez rizika.'},
  {k:'vim', ic:':wq', t:'Vim trenažér', d:'13 lekcií od „ako odísť“ po úpravu sshd_config.'},
  {k:'mapa', ic:'/', t:'Mapa súborov', d:'Čo nájdeš v /etc, /var, /opt, /usr… a čo tam hľadať.'},
  {k:'rozlustit', ic:'-tulpn', t:'Rozlúštiť príkaz', d:'Vlož príkaz, stránka vysvetlí každý prepínač.'},
  {k:'tahak', ic:'≡', t:'Ťahák + RHEL 9 vs 10', d:'Príkazy podľa tém na jednom mieste, s vyhľadávaním.'},
  {k:'incidenty', ic:'!', t:'Incidenty', d:'Tikety z praxe: server je pokazený, nájdi príčinu a oprav ju.'},
  {k:'skuska', ic:'✓', t:'Skúšobný server', d:'Priprav server podľa zadania. Vyhodnotí sa teraz aj po reštarte.'},
  {k:'opakovanie', ic:'?', t:'Opakovanie', d:'Tvoje chyby sa vracajú, kým ich nevieš. Plus náhodné otázky.'}
];

/* ---------- progress ---------- */
const quizCount = c => Object.entries(S.quiz[c.n]||{}).filter(([i,a])=>c.quiz[i] && c.quiz[i].a===a).length;
const exCount = c => Object.keys(S.ex[c.n]||{}).length;
function chapState(c){
  const parts = (S.read[c.n]?1:0) + (quizCount(c)===c.quiz.length?1:0) + (exCount(c)>=c.ex.length?1:0);
  return parts===3 ? 'done' : (S.read[c.n] || quizCount(c) || exCount(c)) ? 'part' : '';
}
function refreshProgress(){
  let done=0;
  CHAPTERS.forEach(c=>{ const st=chapState(c); if (st==='done') done++; document.querySelectorAll(`[data-dot="${c.n}"]`).forEach(d=>d.className='dot '+st); });
  $('#ovText').textContent = done+' / '+CHAPTERS.length;
  $('#ovFill').style.width = (100*done/CHAPTERS.length)+'%';
}
function buildRail(){
  $('#toc').innerHTML = CHAPTERS.map(c=>`<li><a href="#kapitola-${c.n}" data-k="kapitola-${c.n}"><span class="num">${String(c.n).padStart(2,'0')}</span><span>${esc(c.short)}</span><span class="dot" data-dot="${c.n}"></span></a></li>`).join('');
  $('#tools').innerHTML = TOOLS.map(t=>`<li><a href="#${t.k}" data-k="${t.k}"><span class="num">${esc(t.ic.slice(0,3))}</span><span>${esc(t.t)}</span><span></span></a></li>`).join('');
}

/* ---------- quiz box ---------- */
function quizBox(q, qi, prev, onAnswer){
  const box = document.createElement('div'); box.className='q';
  box.innerHTML = `<p class="qt"><span class="qn">${qi+1}.</span><span>${q.q}</span></p><div class="opts">${q.o.map((o,oi)=>`<button class="opt" type="button" data-oi="${oi}"><span class="l">${'ABCD'[oi]}</span><span>${o}</span></button>`).join('')}</div><div class="wslot"></div>`;
  const show = oi=>{ box.querySelectorAll('.opt').forEach(b=>b.classList.remove('right','wrong')); const right = oi===q.a; box.querySelector(`[data-oi="${oi}"]`).classList.add(right?'right':'wrong'); $('.wslot',box).innerHTML = `<p class="w ${right?'ok':'no'}"><b>${right?'Správne.':'Nie celkom.'}</b> ${right?q.w:'Skús inú možnosť.'}</p>`; };
  box.querySelectorAll('.opt').forEach(b=>b.addEventListener('click', ()=>{ const oi=+b.dataset.oi; show(oi); onAnswer(oi, oi===q.a); }));
  if (prev!=null) show(prev);
  return box;
}

/* ---------- ask box ---------- */
function askBox(context, placeholder){
  const s = document.createElement('section'); s.className='askbox ai-only';
  const id = 'ask-'+Math.random().toString(36).slice(2,7);
  s.innerHTML = `<div class="askh"><span class="aitag">Claude</span><b>Niečomu nerozumieš?</b><span>Opýtaj sa na čokoľvek k tejto téme.</span></div><div class="askrow"><textarea id="${id}" rows="2" placeholder="${esc(placeholder)}"></textarea><button class="btn pri" type="button">Opýtať sa</button></div><div class="answer" hidden></div>`;
  const ta = $('textarea',s), btn = $('button',s), ans = $('.answer',s);
  const go = async ()=>{
    const q = ta.value.trim(); if (!q) { ta.focus(); return; }
    ans.hidden=false; ans.className='answer wait'; ans.textContent='Premýšľam…'; btn.disabled=true;
    try { await askClaude(`${AI_FRAME}\n\nKontext: ${context}\n\nOtázka: ${q}`, t=>{ ans.className='answer'; ans.textContent=t; }); }
    catch(e){ ans.className='answer wait'; ans.textContent = e && e.code==='not_granted' ? 'Bez povolenia sa Claude nespýtam.' : e && e.code==='rate_limited' ? 'Príliš veľa otázok naraz, skús o chvíľu.' : 'Claude teraz neodpovedá, skús neskôr.'; }
    btn.disabled=false;
  };
  btn.addEventListener('click', go);
  ta.addEventListener('keydown', e=>{ if (e.key==='Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); go(); } });
  return s;
}

/* ---------- HOME ---------- */
function homeView(){
  const v = document.createElement('div'); v.className='col';
  const lastC = CHAPTERS.find(c=>c.n===S.last);
  const next = (lastC && chapState(lastC)!=='done') ? lastC : (CHAPTERS.find(c=>chapState(c)!=='done') || CHAPTERS[0]);
  const started = CHAPTERS.some(c=>chapState(c));
  const doneCh = CHAPTERS.filter(c=>chapState(c)==='done').length;
  const quizOk = CHAPTERS.reduce((s,c)=>s+quizCount(c),0), quizAll = CHAPTERS.reduce((s,c)=>s+c.quiz.length,0);
  const exOk = CHAPTERS.reduce((s,c)=>s+Math.min(exCount(c),c.ex.length),0), exAll = CHAPTERS.reduce((s,c)=>s+c.ex.length,0);
  const vimOk = Object.keys(S.vim).length;
  v.innerHTML = `
  <div class="hero">
    <div class="eyebrow">Red Hat Enterprise Linux 9 a 10 · samoštúdium</div>
    <h1>Linux na serveroch, tak ako ho budeš robiť v práci</h1>
    <p class="lead">${CHAPTERS.length} kapitol od prvého príkazu po firewall, SELinux, LVM, inštaláciu produktov, Ansible a kontajnery. Každý prepínač je vysvetlený, príklady spúšťaš v simulovanom termináli a úlohy sa kontrolujú samy.</p>
    <div class="cta"><a class="btn pri" href="#kapitola-${next.n}">${started?'Pokračovať':'Začať'}: ${next.n}. ${esc(next.short)}</a><a class="btn" href="#rozlustit">Rozlúštiť príkaz</a><a class="btn" href="#tahak">Ťahák</a></div>
    <div class="hero-term"><span class="pu">[admin@rhel9-lab</span> <span class="pp">~</span><span class="pu">]$</span> sudo ss -<span class="k">tulpn</span>
<span class="d">#  t = TCP   u = UDP   l = počúva   p = proces   n = čísla portov</span>
Netid State  Local Address:Port  Process
tcp   LISTEN       0.0.0.0:22    users:(("sshd",pid=1032,fd=3))
<span class="pu">[admin@rhel9-lab</span> <span class="pp">~</span><span class="pu">]$</span> sudo firewall-cmd --permanent --add-service=https && sudo firewall-cmd --reload
success
success</div>
  </div>
  <div class="stats">
    <div class="stat"><b>${doneCh}/${CHAPTERS.length}</b><span>hotové kapitoly</span></div>
    <div class="stat"><b>${quizOk}/${quizAll}</b><span>správne v kvízoch</span></div>
    <div class="stat"><b>${exOk}/${exAll}</b><span>splnené úlohy</span></div>
    <div class="stat"><b>${vimOk}/${VIM_LESSONS.length}</b><span>vim lekcie</span></div>
  </div>
  <div class="sect-h"><h2>Kapitoly</h2><p>Kapitola je hotová, keď ju označíš ako prečítanú a splníš kvíz aj úlohy.</p></div>
  <div class="grid">${CHAPTERS.map(c=>`<a class="card" href="#kapitola-${c.n}"><span class="num">${String(c.n).padStart(2,'0')}</span><b>${esc(c.short)}</b><span class="dot" data-dot="${c.n}"></span></a>`).join('')}</div>
  <div class="sect-h"><h2>Nástroje</h2></div>
  <div class="tools">${TOOLS.map(t=>`<a class="tool" href="#${t.k}"><span class="ic">${esc(t.ic)}</span><b>${esc(t.t)}</b><span>${esc(t.d)}</span></a>`).join('')}</div>`;
  return v;
}

/* ---------- CHAPTER ---------- */
function chapterView(c){
  S.last = c.n; save();
  const idx = CHAPTERS.indexOf(c), prev = CHAPTERS[idx-1], next = CHAPTERS[idx+1];
  const v = document.createElement('div'); v.className='page';
  v.innerHTML = `<div class="chap"><div class="txt">
    <div class="eyebrow">Kapitola ${c.n} z ${CHAPTERS.length}</div>
    <h1>${esc(c.title)}</h1>
    <div class="goal"><b>Cieľ</b><span>${esc(c.goal)}</span></div>
    <div class="parts" id="parts"></div>
    <nav class="mini" id="mini" aria-label="Obsah kapitoly"></nav>
  </div><aside id="side"></aside></div>`;
  const txt = $('.txt', v), side = $('#side', v);
  const body = renderBody(c.body); txt.appendChild(body);
  const heads = [...body.querySelectorAll('h3')];
  $('#mini',v).innerHTML = heads.map(h=>`<button type="button" data-t="${h.id}">${esc(h.textContent)}</button>`).join('') + '<button type="button" class="em" data-t="kviz">Kvíz</button><button type="button" class="em" data-t="ulohy">Úlohy</button>';
  $('#mini',v).addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; const t=v.querySelector('#'+b.dataset.t); if (t) t.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); });

  /* terminal */
  const tasksWrap = document.createElement('div');
  const term = new Term(side, {title:'ssh admin@lab · kapitola '+c.n, tasks:true, onRun:(m)=>checkTasks(m), onReset:()=>{ for (const k in blocked) delete blocked[k]; }});
  const chips = $('.term-tasks', term.el);
  const blocked = {};
  const drawChips = ()=>{ chips.innerHTML = '<span>Úlohy:</span>' + c.ex.map((x,i)=>{ const ok = S.ex[c.n]&&S.ex[c.n][i]; return ok ? `<button type="button" class="tchip ok" data-un="${i}" title="Klikni, ak úloha nemá byť označená ako splnená">${i+1} ✓</button>` : `<span class="tchip">${i+1}</span>`; }).join('') + '<span style="flex:1"></span><span>Reset vráti stroj do pôvodného stavu</span>'; };
  const unmark = (i)=>{
    if (S.ex[c.n]) delete S.ex[c.n][i];
    let still = false; try { still = !!c.ex[i].check(term.m); } catch(e){}
    if (still) blocked[i] = true;
    save(); paint(); refreshParts(); refreshProgress();
    toast(term, still ? `Úloha ${i+1} vrátená. Stroj ju ešte spĺňa: daj Reset a sprav ju znova.` : `Úloha ${i+1} vrátená ako nesplnená.`);
  };
  chips.addEventListener('click', e=>{ const b = e.target.closest('[data-un]'); if (b) unmark(+b.dataset.un); });
  drawChips();
  body.addEventListener('click', e=>{ const b=e.target.closest('[data-run]'); if (!b) return; if (innerWidth<=1240) side.scrollIntoView({behavior:'smooth', block:'center'}); term.type(b.dataset.run); });

  /* quiz */
  const qs = document.createElement('section'); qs.className='sect';
  qs.innerHTML = `<h2 id="kviz">Kvíz</h2><p class="sub">${c.quiz.length} otázky. Pri zlej odpovedi skús inú možnosť.</p>`;
  c.quiz.forEach((q,qi)=>qs.appendChild(quizBox(q, qi, (S.quiz[c.n]||{})[qi], (oi,ok)=>{ (S.quiz[c.n]=S.quiz[c.n]||{})[qi]=oi; if (!ok) markWrong(c.n,qi); save(); refreshParts(); refreshProgress(); })));
  const qr = document.createElement('div'); qr.className='acts'; qr.style.marginTop='10px';
  qr.innerHTML = '<button class="btn sm" type="button">Vymazať odpovede a skúsiť kvíz znova</button>';
  qr.querySelector('button').addEventListener('click', ()=>{ delete S.quiz[c.n]; save(); window.__scrollTo='kviz'; route(); });
  qs.appendChild(qr);
  txt.appendChild(qs);

  /* exercises */
  const es = document.createElement('section'); es.className='sect';
  es.innerHTML = `<h2 id="ulohy">Úlohy v termináli</h2><p class="sub">Píš príkazy do terminálu ${innerWidth>1240?'vpravo':'nižšie'}. Úloha sa odškrtne sama, keď je stroj v správnom stave.</p>`;
  const taskEls = c.ex.map((x,i)=>{
    const d = document.createElement('div'); d.className='task';
    d.innerHTML = `<span class="st">${i+1}</span><div><p>${x.t}</p><div class="acts"><button class="btn sm" type="button" data-a="hint">Nápoveda</button><button class="btn sm" type="button" data-a="sol">Riešenie</button><button class="btn sm ai-only" type="button" data-a="ai">Poraď mi (Claude)</button><button class="btn sm" type="button" data-a="undo" hidden>Zrušiť splnenie</button></div><div class="reveal" hidden></div></div>`;
    const rv = $('.reveal', d);
    d.querySelector('[data-a=undo]').addEventListener('click', ()=>unmark(i));
    d.querySelector('[data-a=hint]').addEventListener('click', ()=>{ rv.hidden=false; rv.innerHTML = `<b>Nápoveda:</b> ${esc(x.h)}`; });
    d.querySelector('[data-a=sol]').addEventListener('click', ()=>{ rv.hidden=false; rv.innerHTML = `<b>Jedno možné riešenie:</b><pre>${esc(x.sol)}</pre>`; });
    d.querySelector('[data-a=ai]').addEventListener('click', async ()=>{
      rv.hidden=false; rv.textContent='Claude sa pozerá na tvoje príkazy…';
      try { await askClaude(`${AI_FRAME}\n\nŠtudent rieši úlohu v simulovanom termináli RHEL ${term.ver}. NEPROZRÁĎ celé riešenie, daj jednu konkrétnu radu, čo skúsiť ďalej, a ak má v príkazoch chybu, ukáž kde.\n\nÚloha: ${x.t.replace(/<[^>]+>/g,'')}\n\nPosledné príkazy študenta:\n${term.recent(10)||'(zatiaľ žiadne)'}\n\nPosledný výstup:\n${term.lastOut||'(nič)'}`, t=>{ rv.textContent=t; }); }
      catch(e){ rv.textContent = 'Claude teraz neodpovedá. Skús Nápovedu.'; }
    });
    es.appendChild(d); return d;
  });
  txt.appendChild(es);
  const paint = ()=>{ taskEls.forEach((d,i)=>{ const ok = S.ex[c.n] && S.ex[c.n][i]; d.classList.toggle('done', !!ok); $('.st',d).textContent = ok?'✓':String(i+1); $('[data-a=undo]',d).hidden = !ok; }); drawChips(); };
  paint();
  function checkTasks(m){
    let newly = [];
    c.ex.forEach((x,i)=>{ if (S.ex[c.n] && S.ex[c.n][i]) return; let ok=false; try { ok = !!x.check(m); } catch(e){} if (blocked[i]){ if (!ok) delete blocked[i]; return; } if (ok){ (S.ex[c.n]=S.ex[c.n]||{})[i]=true; newly.push(i+1); } });
    if (newly.length){ save(); paint(); refreshParts(); refreshProgress(); toast(term, `Úloha ${newly.join(', ')} splnená ✓`); }
  }

  /* finish row */
  const fin = document.createElement('div'); fin.className='sect';
  fin.innerHTML = `<button class="btn" type="button" id="readBtn"></button>`;
  txt.appendChild(fin);
  txt.appendChild(askBox(`Kapitola ${c.n}: ${c.title}. Cieľ: ${c.goal}`, 'Napr. Aký je rozdiel medzi --permanent a --reload?'));
  const pg = document.createElement('nav'); pg.className='pager';
  pg.innerHTML = (prev?`<a href="#kapitola-${prev.n}"><span>← Predošlá</span><b>${esc(prev.short)}</b></a>`:'<span></span>') + (next?`<a class="next" href="#kapitola-${next.n}"><span>Ďalšia →</span><b>${esc(next.short)}</b></a>`:`<a class="next" href="#opakovanie"><span>Hotovo →</span><b>Opakovanie</b></a>`);
  txt.appendChild(pg);

  function refreshParts(){
    const r = !!S.read[c.n], qc = quizCount(c), ec = Math.min(exCount(c), c.ex.length);
    $('#parts',v).innerHTML = `<span class="chip ${r?'ok':''}">${r?'✓ ':''}prečítané</span><span class="chip ${qc===c.quiz.length?'ok':''}">kvíz ${qc}/${c.quiz.length}</span><span class="chip ${ec===c.ex.length?'ok':''}">úlohy ${ec}/${c.ex.length}</span>`;
    const rb = $('#readBtn',v); rb.textContent = r ? '✓ Prečítané (zrušiť)' : 'Označiť kapitolu ako prečítanú'; rb.className = r ? 'btn' : 'btn pri';
  }
  $('#readBtn',v).addEventListener('click', ()=>{ S.read[c.n] = !S.read[c.n]; save(); refreshParts(); refreshProgress(); });
  refreshParts();
  addTermFab(v, side);
  return v;
}
function toast(term, msg){ const t = document.createElement('div'); t.className='toast'; t.textContent=msg; term.el.appendChild(t); setTimeout(()=>t.remove(), 2600); }

/* ---------- TERMINAL PAGE ---------- */
function terminalView(){
  const v = document.createElement('div'); v.className='page';
  v.innerHTML = `<div class="col" style="max-width:1000px"><div class="eyebrow">Pieskovisko</div><h1>Terminál</h1><p class="lead" style="font-size:16px">Simulovaný server <code>rhel9-lab</code> alebo <code>rhel10-lab</code>. Nič tu nepokazíš a Reset vráti všetko späť. Funguje Tab, šípky, rúry, presmerovanie aj <code>vim súbor</code>. Napíš <code>help</code>.</p></div><div id="t" class="tfull"></div><div class="col" style="max-width:1000px">
  <div class="sect-h"><h2>Čo skúsiť</h2><p>Klikni a príkaz sa spustí.</p></div><div class="cs" id="try"></div></div>`;
  const term = new Term($('#t',v), {tall:true, title:'ssh admin@lab'});
  const tries = [
    ['Spoznaj server',[['hostnamectl',''],['cat /etc/os-release',''],['uptime',''],['df -hT','']]],
    ['Nefunkčná služba',[['systemctl --failed',''],['systemctl status agent',''],['journalctl -xeu agent',''],['ls -l /opt/monitoring/bin/agent','']]],
    ['Web za 4 príkazy',[['sudo dnf install -y httpd',''],['sudo systemctl enable --now httpd',''],['sudo firewall-cmd --permanent --add-service=http',''],['sudo firewall-cmd --reload',''],['curl -I localhost','']]],
    ['Bezpečnosť',[['sudo grep "Failed password" /var/log/secure',''],['sudo ss -tulpn',''],['getenforce',''],['sudo find /usr/bin -perm -4000','']]],
    ['Disky',[['lsblk',''],['sudo vgs',''],['sudo lvs',''],['cat /etc/fstab','']]],
    ['Text a rúry',[['sort data/prihlasenia.txt | uniq -c | sort -rn',''],["awk -F, '{print $1, $2}' data/servery.csv",''],['grep -c ERROR logy/app.log','']]],
    ['Čo prežije reštart?',[['sudo firewall-cmd --add-service=https',''],['sudo sysctl -w vm.swappiness=10',''],['sudo setenforce 0',''],['sudo reboot',''],['firewall-cmd --list-services',''],['getenforce','']]],
    ['Skript',[['cat skripty/kontrola.sh',''],['bash skripty/kontrola.sh',''],['for S in sshd chronyd; do systemctl is-active $S; done','']]],
    ['Kontajner',[['sudo dnf install -y container-tools',''],['podman run -d --name web -p 8080:8080 registry.access.redhat.com/ubi9/httpd-24',''],['podman ps',''],['curl -I localhost:8080','']]]
  ];
  $('#try',v).innerHTML = tries.map(([h,rows])=>`<section><h3>${esc(h)}</h3>${rows.map(([c])=>`<div class="row"><code data-run="${esc(c)}">${esc(c)}</code></div>`).join('')}</section>`).join('');
  $('#try',v).addEventListener('click', e=>{ const c=e.target.closest('[data-run]'); if (c){ term.el.scrollIntoView({behavior:'smooth',block:'start'}); term.type(c.dataset.run); } });
  setTimeout(()=>term.inp.focus({preventScroll:true}),50);
  return v;
}

/* ---------- EXPLAIN PAGE ---------- */
function explainView(){
  const v = document.createElement('div'); v.className='col';
  const ex = ['ss -tulpn','ls -lhtr /var/log','ps aux --sort=-%mem','tar -czvf zaloha.tar.gz /etc','grep -rniw error /var/log','find / -name "*.conf" -mmin -60 2>/dev/null','sudo firewall-cmd --permanent --zone=public --add-port=8443/tcp','journalctl -xeu httpd','lvextend -r -L +5G /dev/rhel/root','rsync -avzP /data/ backup01:/zaloha/','semanage port -m -t http_port_t -p tcp 8081','useradd -m -G wheel -s /bin/bash jana','sudo iptables -I INPUT -p udp --dport 161 -j LOG --log-prefix "SNMP-IN: "','sudo iptables -L INPUT -n -v --line-numbers','sudo iptables -A INPUT -s 10.0.30.0/24 -p tcp --dport 22 -j ACCEPT','sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT','sudo iptables -P INPUT DROP',"sudo firewall-cmd --permanent --add-rich-rule='rule family=\"ipv4\" source address=\"10.0.20.50\" port port=\"161\" protocol=\"udp\" accept'",'kernel: SNMP-IN: IN=ens192 OUT= MAC=00:50:56:a1:3c:7e:00:50:56:a1:00:50:08:00 SRC=10.0.20.50 DST=10.0.20.31 LEN=78 TOS=0x00 PREC=0x00 TTL=64 ID=4512 PROTO=UDP SPT=51234 DPT=161 LEN=58'];
  v.innerHTML = `<div class="eyebrow">Nástroj</div><h1>Rozlúštiť príkaz</h1><p class="lead" style="font-size:16px">Vlož príkaz alebo celý skript (aj viac riadkov), príkaz aj s poskladanými prepínačmi (<code>-tulpn</code>, <code>-xzvf</code>, <code>-lhtr</code>). Každé písmeno sa rozpíše zvlášť. Pri <code>iptables</code> a rich rule pribudne, čo to celé robí, kde je výsledok, ako to vrátiť a ako to spraviť natrvalo cez firewalld. Rozlúšti aj riadok z logu jadra (<code>SRC= DST= DPT=</code>). Vysvetlenia pochádzajú z referencie na tejto stránke.</p>
  <textarea class="search exin" id="exin" rows="1" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Príkaz alebo skript na rozlúštenie">${esc(window.__explainPreset||ex[0])}</textarea>
  <div class="parts" id="exsh" style="margin:-8px 0 14px"><span class="sub" style="align-self:center">Celý skript po riadkoch:</span>${Object.entries({'zaloha.sh':'zaloha','disk.sh':'disk','sluzby.sh':'sluzby','pouzivatelia.sh':'pouzivatelia'}).filter(([n,k])=>window.BASH_SAMPLES&&BASH_SAMPLES[k]).map(([n,k])=>`<button class="btn sm" type="button" data-sh="${k}" style="font-family:var(--f-mono)">${n}</button>`).join('')}</div>
  <div id="exout"></div>
  <div class="sect-h"><h2>Príklady</h2></div><div class="parts" id="exs">${ex.map(x=>`<button class="btn sm" type="button" data-x="${esc(x)}" style="font-family:var(--f-mono)">${esc(x)}</button>`).join('')}</div>
  <div class="sect-h"><h2>Všetky popísané príkazy</h2><p>Klikni pre plnú referenciu.</p></div><div class="parts" id="allc">${Object.keys(CMDREF).sort().map(k=>`<button class="btn sm" type="button" data-c="${esc(k)}" style="font-family:var(--f-mono)">${esc(k)}</button>`).join('')}</div><div id="ref"></div>`;
  window.__explainPreset = null;
  const inp = $('#exin',v), out = $('#exout',v);
  const grow = ()=>{ inp.style.height='auto'; inp.style.height = Math.min(inp.scrollHeight+2, innerHeight*0.6)+'px'; };
  const draw = ()=>{ grow(); const val = inp.value.trim(); if (val && window.isScriptText && isScriptText(inp.value)){ out.innerHTML = explainScript(inp.value); return; } const cx = val && window.explainCtx ? window.explainCtx(val) : null; out.innerHTML = !val ? '' : cx && cx.replace ? cx.replace : explainHTML(val) + (cx && cx.after || ''); if (cx && cx.replace) return; const first = splitTokens(val).find(t=>t!=='sudo'); const ai = document.createElement('div'); if (val && first && !CMDREF[first]) out.insertAdjacentHTML('beforeend', `<p class="sub" style="color:var(--muted)">Príkaz <code>${esc(first)}</code> v referencii nie je.</p>`); };
  inp.addEventListener('input', draw); draw();
  $('#exsh',v).addEventListener('click', e=>{ const b=e.target.closest('[data-sh]'); if (b){ inp.value = BASH_SAMPLES[b.dataset.sh].replace(/\n$/,''); draw(); } });
  $('#exs',v).addEventListener('click', e=>{ const b=e.target.closest('[data-x]'); if (b){ inp.value=b.dataset.x; draw(); } });
  $('#allc',v).addEventListener('click', e=>{ const b=e.target.closest('[data-c]'); if (b){ $('#ref',v).innerHTML = flagsHTML(b.dataset.c); $('#ref',v).scrollIntoView({behavior:'smooth',block:'nearest'}); } });
  const ab = askBox('Študent si nechal rozlúštiť príkaz na stránke. Ak sa pýta na príkaz, vysvetli každý prepínač.', 'Napr. Čo presne robí rsync -avzP a prečo lomka na konci?');
  v.appendChild(ab);
  return v;
}

/* ---------- MAP ---------- */
const FSMAP = {p:'/', what:'Koreň celého systému. Všetko, aj ďalšie disky, visí odtiaľto.', look:['Tu nič nevytváraj. Nové dáta patria do /srv, /opt, /data (vlastný pripojený disk) alebo /var.'], kids:[
 {p:'/etc', what:'Konfigurácia systému a služieb. Textové súbory, ktoré upravuješ.', look:['Meníš správanie služby? Hľadaj tu.','Pred úpravou si sprav zálohu: cp súbor{,.bak}','Komu súbor patrí: rpm -qf /etc/…'], cmds:['ls /etc','rpm -qc openssh-server','grep -rl "Listen" /etc/httpd'], ch:3, kids:[
   {p:'/etc/passwd', f:1, what:'Zoznam účtov: login, UID, GID, domov, shell.', look:['Kto má /bin/bash a kto /sbin/nologin','UID 0 má len root!'], cmds:['getent passwd admin','awk -F: \'$3>=1000\' /etc/passwd'], ch:7},
   {p:'/etc/shadow', f:1, what:'Hashe hesiel a ich platnosť. Číta len root.', look:['!! alebo ! = heslo nenastavené / účet zamknutý'], cmds:['sudo chage -l admin'], ch:7},
   {p:'/etc/group', f:1, what:'Skupiny a ich doplnkoví členovia.', look:['Kto je vo wheel = kto má sudo'], cmds:['getent group wheel'], ch:7},
   {p:'/etc/sudoers', f:1, what:'Pravidlá pre sudo. Uprav VÝHRADNE cez visudo.', look:['%wheel ALL=(ALL) ALL','vlastné pravidlá do /etc/sudoers.d/'], cmds:['sudo visudo -c'], ch:7},
   {p:'/etc/sudoers.d', what:'Doplnkové sudo pravidlá, jeden súbor na tému.', cmds:['sudo visudo -f /etc/sudoers.d/monitoring'], ch:7},
   {p:'/etc/hosts', f:1, what:'Lokálne preklady mien na IP, majú prednosť pred DNS.', cmds:['getent hosts db01'], ch:12},
   {p:'/etc/resolv.conf', f:1, what:'DNS servery a doména. Generuje ho NetworkManager, ručné zmeny prepíše.', look:['DNS meň cez nmcli con mod … ipv4.dns'], ch:12},
   {p:'/etc/hostname', f:1, what:'Meno stroja. Meň cez hostnamectl set-hostname.', ch:12},
   {p:'/etc/fstab', f:1, what:'Čo sa pripojí pri štarte. Chyba = server skončí v emergency režime.', look:['Po úprave vždy: sudo mount -a a findmnt --verify','Pri diskoch používaj UUID z blkid'], cmds:['cat /etc/fstab','sudo findmnt --verify'], ch:15},
   {p:'/etc/ssh', what:'Konfigurácia SSH klienta a servera, kľúče hostiteľa.', look:['sshd_config: hlavný súbor (nemeň)','sshd_config.d/: tvoje úpravy, platí prvý výskyt','ssh_host_*_key: identita servera'], cmds:['sudo sshd -t','ls /etc/ssh/sshd_config.d'], ch:16},
   {p:'/etc/NetworkManager/system-connections', what:'Sieťové profily (.nmconnection, keyfile formát). Práva 600.', look:['Neupravuj ručne, používaj nmcli','Na RHEL 10 jediné miesto sieťovej konfigurácie'], cmds:['nmcli con show','sudo ls /etc/NetworkManager/system-connections'], ch:12},
   {p:'/etc/sysconfig', what:'Parametre služieb vo forme PREMENNÁ=hodnota (napr. sshd, firewalld).', look:['RHEL 9: network-scripts/ so starými ifcfg súbormi','RHEL 10: network-scripts už nie je'], ch:12},
   {p:'/etc/firewalld', what:'Trvalá (permanent) konfigurácia firewallu.', look:['firewalld.conf: predvolená zóna, backend nftables','zones/*.xml: tvoje zmeny zón (vznikajú cez --permanent)'], cmds:['sudo firewall-cmd --permanent --list-all'], ch:13},
   {p:'/etc/selinux/config', f:1, what:'Režim SELinuxu po štarte (enforcing/permissive).', look:['Má byť SELINUX=enforcing'], cmds:['sestatus'], ch:14},
   {p:'/etc/yum.repos.d', what:'Definície repozitárov (.repo). redhat.repo spravuje subscription-manager.', cmds:['dnf repolist'], ch:11},
   {p:'/etc/dnf/dnf.conf', f:1, what:'Nastavenia dnf: gpgcheck, installonly_limit (počet jadier), proxy.', ch:11},
   {p:'/etc/systemd/system', what:'Tvoje služby, timery a úpravy (drop-in). Majú prednosť pred /usr/lib/systemd/system.', look:['*.service, *.timer, *.service.d/override.conf','multi-user.target.wants/ = povolené služby (enable)'], cmds:['systemctl cat sshd','sudo systemctl edit httpd'], ch:10},
   {p:'/etc/crontab', f:1, what:'Systémový crontab so stĺpcom používateľa. Lepšie je pridať súbor do /etc/cron.d/.', cmds:['crontab -l'], ch:17},
   {p:'/etc/chrony.conf', f:1, what:'NTP servery pre synchronizáciu času.', cmds:['chronyc sources'], ch:17},
   {p:'/etc/logrotate.d', what:'Pravidlá rotácie logov jednotlivých aplikácií.', ch:17},
   {p:'/etc/os-release', f:1, what:'Verzia distribúcie (strojovo čitateľná).', cmds:['cat /etc/os-release'], ch:3},
   {p:'/etc/pki/rpm-gpg', what:'GPG kľúče, ktorými dnf overuje podpisy balíkov (Red Hat aj dodávatelia).', look:['Sem dáš kľúč dodávateľa, na ktorý ukazuje gpgkey= v .repo súbore'], cmds:['rpm -qa gpg-pubkey'], ch:18},
   {p:'/etc/sysctl.d', what:'Trvalé parametre jadra (*.conf). Načítajú sa pri štarte alebo cez sysctl --system.', cmds:['sudo sysctl --system'], ch:23},
   {p:'/etc/tuned', what:'Nastavenia tuned, aktívny profil (active_profile).', cmds:['tuned-adm active'], ch:23},
   {p:'/etc/containers/systemd', what:'Quadlet súbory (*.container): kontajnery ako systemd služby.', look:['Po zmene: systemctl daemon-reload','Rootless verzia: ~/.config/containers/systemd/'], ch:22},
   {p:'/etc/ansible', what:'Predvolená konfigurácia Ansible (ansible.cfg, hosts). V praxi má každý projekt vlastný inventár.', ch:21},
   {p:'/etc/httpd', what:'Apache (po dnf install httpd): conf/httpd.conf, conf.d/*.conf.', cmds:['sudo apachectl configtest'], ch:14},
   {p:'/etc/profile.d', what:'Skripty načítané pri prihlásení každého používateľa (premenné, aliasy).', ch:3}
 ]},
 {p:'/var', what:'Premenlivé dáta: logy, databázy, cache, fronty, web. Rastie a zapĺňa disk.', look:['Plný disk? Najprv sudo du -sh /var/* | sort -h'], cmds:['sudo du -sh /var/*'], ch:3, kids:[
   {p:'/var/log', what:'Logy. Prvé miesto pri akomkoľvek probléme.', look:['messages: všeobecné','secure: prihlásenia, sudo','audit/audit.log: audit + SELinux AVC','cron, dnf.log, boot.log','httpd/, nginx/, mariadb/: aplikácie'], cmds:['ls -lhtr /var/log','sudo tail -f /var/log/messages'], ch:17},
   {p:'/var/log/audit/audit.log', f:1, what:'Auditný log a SELinux zamietnutia (AVC).', cmds:['sudo ausearch -m AVC -ts recent'], ch:14},
   {p:'/var/lib', what:'Stavové dáta aplikácií: databázy, kontajnery, RPM databáza.', look:['mysql/: dáta MariaDB','containers/: obrazy podman','rpm/: databáza balíkov'], ch:3},
   {p:'/var/www', what:'Web root apache (html/). SELinux typ httpd_sys_content_t.', look:['Nové súbory kopíruj (cp), nepresúvaj (mv), alebo potom restorecon -Rv'], cmds:['ls -Z /var/www/html'], ch:14},
   {p:'/var/spool', what:'Fronty: cron (crontaby používateľov), mail, tlač.', ch:17},
   {p:'/var/cache/dnf', what:'Cache metadát a balíkov dnf.', cmds:['sudo dnf clean all'], ch:11},
   {p:'/var/lib/pgsql', what:'Dáta PostgreSQL (po dnf install postgresql-server a postgresql-setup --initdb).', ch:18},
   {p:'/var/lib/containers', what:'Obrazy a kontajnery rootful podmana (rootless: ~/.local/share/containers).', ch:22},
   {p:'/var/log/leapp', what:'Report a logy upgradu cez Leapp (leapp-report.txt).', ch:23},
   {p:'/var/tmp', what:'Dočasné súbory, ktoré prežijú reštart (sos report sa ukladá sem).', ch:17}
 ]},
 {p:'/opt', what:'Softvér tretích strán mimo repozitárov RHEL, každý vo vlastnom podadresári.', look:['/opt/<produkt>/bin, etc, log','Služba ku nemu býva v /etc/systemd/system','Nepatrí žiadnemu RPM (rpm -qf hlási „not owned“), ak ho nedodávateľ zabalil'], cmds:['ls /opt','cat /opt/monitoring/README'], ch:3},
 {p:'/usr', what:'Programy, knižnice a dáta z balíkov. Ručne tu nič nemeň (okrem /usr/local).', ch:3, kids:[
   {p:'/usr/bin', what:'Bežné príkazy (/bin je naň odkaz).', cmds:['which ls','rpm -qf /usr/bin/ls'], ch:3},
   {p:'/usr/sbin', what:'Administrátorské príkazy (useradd, lvcreate, sshd).', ch:3},
   {p:'/usr/lib/systemd/system', what:'Unit súbory služieb z balíkov. Nemeň! Úpravy patria do /etc/systemd/system.', cmds:['systemctl cat chronyd'], ch:10},
   {p:'/usr/local', what:'Tvoje lokálne programy a skripty (bin/, sbin/), aktualizácie ich neprepíšu.', ch:3},
   {p:'/usr/share/doc', what:'Dokumentácia a ukážkové konfigurácie balíkov.', ch:1}
 ]},
 {p:'/home', what:'Domovské adresáre používateľov (/home/meno).', look:['~/.ssh/authorized_keys: kľúče, ktorými sa smie prihlásiť','~/.bashrc: aliasy a premenné'], cmds:['ls -la ~'], ch:7},
 {p:'/root', what:'Domov roota. Nie je v /home, aby bol dostupný aj bez pripojeného /home.', look:['anaconda-ks.cfg: ako bol systém nainštalovaný'], ch:3},
 {p:'/tmp', what:'Dočasné súbory pre všetkých, sticky bit (drwxrwxrwt). Maže sa časom/pri štarte.', look:['Nič dôležité sem neukladaj'], cmds:['ls -ld /tmp'], ch:8},
 {p:'/boot', what:'Jadro (vmlinuz), initramfs a GRUB. Malá samostatná partícia.', look:['loader/entries/: položky menu (BLS)','Plný /boot = nová verzia jadra sa nenainštaluje'], cmds:['ls /boot','uname -r'], ch:11},
 {p:'/dev', what:'Súbory zariadení: disky (sda, nvme0n1), mapper/ (LVM), null, zero.', cmds:['lsblk','ls -l /dev/mapper'], ch:15},
 {p:'/proc', what:'Virtuálny pohľad do jadra a procesov. Neexistuje na disku.', look:['cpuinfo, meminfo, loadavg','/proc/PID/: info o procese','/proc/sys/: parametre jadra (sysctl)'], cmds:['cat /proc/meminfo','cat /proc/cmdline'], ch:9},
 {p:'/sys', what:'Virtuálny pohľad na zariadenia a ovládače jadra.', ch:9},
 {p:'/run', what:'Runtime dáta od štartu (PID súbory, sockety). V pamäti, po reštarte prázdne.', ch:10},
 {p:'/srv', what:'Dáta služieb, ktoré server ponúka (web, FTP), ak firma nepoužíva /var/www.', look:['Pri webe nezabudni na SELinux: semanage fcontext + restorecon'], ch:14},
 {p:'/mnt', what:'Dočasné ručné pripojenie disku alebo NFS.', ch:15},
 {p:'/media', what:'Automatické pripojenie vymeniteľných médií (USB, DVD).', ch:15}
]};
function mapView(){
  const v = document.createElement('div'); v.className='page';
  v.innerHTML = `<div class="col" style="max-width:1100px"><div class="eyebrow">Nástroj</div><h1>Mapa súborov</h1><p class="lead" style="font-size:16px">Klikni na adresár alebo súbor. Uvidíš, čo tam je, kedy tam ideš a akými príkazmi to overíš.</p>
  <div class="mapgrid"><div class="tree" id="tree" role="tree"></div><div class="detail" id="det"></div></div></div>`;
  const flat = [];
  const walk = (n, depth, last, prefix)=>{ flat.push({n, depth, prefix: depth? prefix + (last?'└─ ':'├─ ') : ''}); (n.kids||[]).forEach((k,i,a)=>walk(k, depth+1, i===a.length-1, depth? prefix + (last?'   ':'│  ') : '')); };
  walk(FSMAP, 0, true, '');
  const tree = $('#tree',v);
  tree.innerHTML = flat.map((x,i)=>`<button type="button" role="treeitem" data-i="${i}"><span class="g">${x.prefix}</span><span class="${x.n.f?'fn':'dn'}">${esc(x.depth? x.n.p.replace(/^.*\/(?=[^/]+$)/, x.n.p.split('/').length>3?'':'') : '/')}${x.n.f?'':''}</span></button>`).join('');
  // show full relative names under parent
  tree.querySelectorAll('button').forEach((b,i)=>{ const x=flat[i]; const parent = flat.slice(0,i).reverse().find(y=>y.depth===x.depth-1); let nm = x.depth ? x.n.p.slice(parent && parent.n.p!=='/' ? parent.n.p.length+1 : 1) : '/'; $('span:last-child',b).textContent = nm + (x.n.f?'':'/').replace('//','/'); if (x.depth===0) $('span:last-child',b).textContent='/'; });
  const show = i=>{
    const n = flat[i].n;
    tree.querySelectorAll('button').forEach(b=>b.classList.toggle('on', +b.dataset.i===i));
    $('#det',v).innerHTML = `<h2>${esc(n.p)}</h2><p class="what">${esc(n.what)}</p><div class="kv">
      ${n.look?`<div class="box"><h3>Čo tu hľadať</h3><ul>${n.look.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
      ${n.cmds?`<div class="box"><h3>Príkazy</h3>${n.cmds.map(c=>`<div class="cmd"><div class="c">${esc(c)}</div></div>`).join('')}</div>`:''}
      ${n.kids?`<div class="box"><h3>Vnútri</h3><ul>${n.kids.map(k=>`<li><code>${esc(k.p)}</code> ${esc(k.what)}</li>`).join('')}</ul></div>`:''}
      ${n.ch?`<div class="box"><h3>Viac v kapitole</h3><a href="#kapitola-${n.ch}">${n.ch}. ${esc(CHAPTERS[n.ch-1].title)}</a></div>`:''}
    </div>`;
  };
  tree.addEventListener('click', e=>{ const b=e.target.closest('button'); if (b){ show(+b.dataset.i); if (innerWidth<=820) $('#det',v).scrollIntoView({behavior:'smooth'}); } });
  show(1);
  return v;
}

/* ---------- CHEAT SHEET ---------- */
const CHEAT = [
 ['Navigácia a súbory',[['pwd','kde som'],['ls -lah','všetko, dlhý výpis, čitateľné veľkosti'],['ls -lhtr','podľa času, najnovšie dole'],['cd -','späť do predošlého adresára'],['mkdir -p a/b/c','celá cesta naraz'],['cp -a zdroj ciel','kópia so všetkými atribútmi'],['cp subor{,.bak}','rýchla záloha'],['mv stary novy','presun / premenovanie'],['rm -rf adresar','zmazanie bez otázok (pozor!)'],['ln -s ciel odkaz','symbolický odkaz']]],
 ['Čítanie a hľadanie',[['less subor','listovanie, /hľadaj, q koniec'],['tail -f /var/log/messages','log naživo'],['grep -rni "text" /etc','rekurzívne, s číslom riadku, bez ohľadu na veľkosť'],['grep -Ev "^\\s*(#|$)" subor','bez komentárov a prázdnych riadkov'],['find / -name "*.conf" 2>/dev/null','podľa mena, bez chýb'],['find /var -size +100M','veľké súbory'],['find /etc -mmin -60','zmenené za hodinu']]],
 ['Rúry a text',[['cmd | wc -l','počet riadkov'],['sort | uniq -c | sort -rn','rebríček výskytov'],['cut -d: -f1,7 /etc/passwd','stĺpce podľa oddeľovača'],["awk '{print $1}'",'prvý stĺpec'],["sed -i 's/a/b/g' subor",'nahradenie v súbore'],['cmd > f 2>&1','všetko do súboru'],['echo x | sudo tee -a /etc/subor','pripísať do súboru roota']]],
 ['Používatelia a sudo',[['id meno','UID, skupiny'],['sudo useradd -m -c "Meno" jana','nový účet'],['sudo passwd jana','heslo'],['sudo usermod -aG wheel jana','pridať do wheel (sudo)'],['sudo chage -M 90 jana','heslo max 90 dní'],['sudo userdel -r jana','zmazať aj s domovom'],['sudo visudo -f /etc/sudoers.d/x','sudo pravidlo'],['sudo -i','root shell']]],
 ['Práva',[['chmod 640 subor','rw- r-- ---'],['chmod u+x skript.sh','pridať spúšťanie'],['chmod -R g+rwX adresar','skupine čítanie/zápis, x len adresárom'],['sudo chown -R user:skupina adr','vlastník rekurzívne'],['chmod 2770 /srv/tim','zdieľaný adresár so SGID'],['setfacl -m u:jana:rx subor','ACL pre jedného človeka'],['namei -l /cesta/k/suboru','práva na celej ceste']]],
 ['Procesy a výkon',[['uptime','záťaž 1/5/15 min'],['top','živý prehľad (P, M, q)'],['ps aux --sort=-%mem | head','žrúti pamäte'],['pgrep -l httpd','PID podľa mena'],['kill PID / kill -9 PID','ukončiť / zabiť'],['free -h','pamäť, pozri available'],['df -hT','disky'],['sudo du -sh /var/* | sort -h','čo zaberá miesto']]],
 ['Služby a logy',[['systemctl status sluzba','stav + posledné logy'],['sudo systemctl enable --now sluzba','povoliť a spustiť'],['sudo systemctl restart sluzba','reštart'],['systemctl --failed','zlyhané jednotky'],['sudo systemctl daemon-reload','po úprave unit súboru'],['journalctl -xeu sluzba','log služby s vysvetlením'],['journalctl -p err -b','chyby od štartu'],['journalctl -f','naživo']]],
 ['Balíky',[['dnf search slovo','hľadať'],['sudo dnf install -y balik','inštalovať'],['dnf provides prikaz','ktorý balík má príkaz'],['sudo dnf update','aktualizovať všetko'],['dnf history','história'],['sudo dnf history undo N','vrátiť'],['rpm -qf /cesta','komu patrí súbor'],['rpm -qc balik','konfigurácia balíka'],['needs-restarting -r','treba reštart?']]],
 ['Sieť',[['ip -br a','IP adresy stručne'],['ip r','smerovanie, brána'],['sudo ss -tulpn','kto počúva na portoch'],['nmcli con show','sieťové profily'],['sudo nmcli con mod ens192 ipv4.addresses 10.0.20.35/24','statická IP'],['sudo nmcli con up ens192','aplikovať'],['ping -c 3 host','dostupnosť'],['curl -I http://host','test webu'],['getent hosts meno','preklad mena']]],
 ['Firewall',[['firewall-cmd --list-all','čo je povolené'],['firewall-cmd --get-active-zones','zóny a rozhrania'],['sudo firewall-cmd --permanent --add-service=https','povoliť službu natrvalo'],['sudo firewall-cmd --permanent --add-port=8443/tcp','povoliť port natrvalo'],['sudo firewall-cmd --reload','načítať permanent'],['sudo firewall-cmd --permanent --remove-service=cockpit','odobrať'],['sudo firewall-cmd --runtime-to-permanent','uložiť bežiace pravidlá'],['sudo nft list ruleset','čo je reálne v jadre']]],
 ['SELinux',[['getenforce','režim'],['ls -Z subor','kontext súboru'],['sudo restorecon -Rv /var/www','opraviť kontexty'],['sudo semanage fcontext -a -t httpd_sys_content_t "/srv/web(/.*)?"','nové pravidlo kontextu'],['sudo semanage port -l | grep -w 8081','má port už typ?'],['sudo semanage port -m -t http_port_t -p tcp 8081','zmeniť typ portu (-a pre voľný port)'],['getsebool -a | grep httpd','booleany'],['sudo setsebool -P httpd_can_network_connect on','zapnúť natrvalo'],['sudo ausearch -m AVC -ts recent','posledné zamietnutia']]],
 ['Disky a LVM',[['lsblk -f','disky, FS, UUID'],['sudo blkid','UUID'],['sudo pvcreate /dev/sdb','PV'],['sudo vgcreate vgdata /dev/sdb','VG'],['sudo lvcreate -n data -L 5G vgdata','LV'],['sudo mkfs.xfs /dev/vgdata/data','súborový systém'],['sudo lvextend -r -L +5G /dev/rhel/root','zväčšiť aj s FS'],['sudo mount -a','test /etc/fstab'],['sudo findmnt --verify','kontrola fstab']]],
 ['SSH a archívy',[['ssh-keygen -t ed25519','nový kľúč'],['ssh-copy-id admin@server','kľúč na server'],['sudo sshd -t','test konfigurácie sshd'],['scp subor admin@server:/tmp/','kopírovanie'],['rsync -avzP zdroj/ server:/ciel/','synchronizácia'],['tar -czvf zaloha.tar.gz adresar','zbaliť'],['tar -tzvf zaloha.tar.gz','obsah'],['tar -xzvf zaloha.tar.gz -C /ciel','rozbaliť']]],
 ['Plánovanie a čas',[['crontab -e','upraviť cron'],['crontab -l','vypísať cron'],['*/15 * * * * prikaz','každých 15 min'],['systemctl list-timers','systemd timery'],['timedatectl','čas a pásmo'],['chronyc sources','NTP zdroje']]],
 ['vim',[['i  a  o  A','do Insert režimu'],['Esc','späť do Normal'],[':wq   :q!','ulož a koniec / bez uloženia'],['dd  yy  p','zmaž / kopíruj riadok / vlož'],['u   Ctrl+r','undo / redo'],['/slovo  n','hľadaj / ďalší'],[':%s/a/b/g','nahraď všade'],[':set nu',' čísla riadkov'],['gg  G  :42','začiatok / koniec / riadok 42']]],
 ['Inštalácia produktov',[['rpm -qpl subor.rpm','čo balík nainštaluje (pred inštaláciou)'],['rpm -K subor.rpm','over podpis'],['sudo rpm --import RPM-GPG-KEY-x','kľúč dodávateľa'],['sudo dnf install ./subor.rpm','lokálny RPM so závislosťami'],['sudo dnf config-manager --add-repo URL','repozitár dodávateľa'],['sudo tar -xzf app.tar.gz -C /opt','archív do /opt'],['sudo useradd -r -s /sbin/nologin app','systémový účet pre aplikáciu'],['sudo systemctl daemon-reload','po pridaní unit súboru']]],
 ['Bash skripty',[['#!/bin/bash','prvý riadok skriptu'],['chmod +x s.sh && ./s.sh','spustenie'],['X=$(prikaz)','výstup do premennej'],['if [ -f subor ]; then …; fi','podmienka'],['for x in a b c; do …; done','cyklus'],['$1 $# $? $((a+b))','argument, počet, kód, aritmetika'],['bash -n s.sh / bash -x s.sh','syntax / ladenie'],['set -euo pipefail','prísny režim']]],
 ['Boot a záchrana',[['sudo grubby --info=ALL','jadrá a parametre'],['sudo grubby --update-kernel=ALL --args="x=1"','pridaj parameter jadra'],['sudo grubby --set-default=/boot/vmlinuz-…','predvolené jadro'],['cat /proc/cmdline','parametre aktuálneho štartu'],['systemctl get-default','predvolený cieľ'],['rd.break','v GRUB: reset root hesla'],['touch /.autorelabel','po zmene hesla cez rd.break'],['sudo dracut -f','pregeneruj initramfs']]],
 ['Ansible',[['sudo dnf install -y ansible-core','inštalácia'],['ansible all -i inv -m ping','dostupnosť serverov'],['ansible web -i inv -m command -a "uptime"','ad-hoc príkaz'],['ansible-playbook -i inv pb.yml --check','nanečisto'],['ansible-playbook -i inv pb.yml','naostro'],['ansible-playbook … --limit web01','len jeden server'],['ansible-doc ansible.builtin.dnf','dokumentácia modulu'],['sudo dnf install rhel-system-roles','podporované roly']]],
 ['Podman',[['sudo dnf install -y container-tools','inštalácia'],['podman pull registry.access.redhat.com/ubi9/ubi','obraz'],['podman run -d --name web -p 8080:8080 OBRAZ','kontajner na pozadí'],['podman ps -a','kontajnery'],['podman logs web','logy'],['podman exec -it web bash','shell vnútri'],['podman stop web && podman rm web','zastaviť a zmazať'],['/etc/containers/systemd/x.container','Quadlet: štart so systémom']]],
 ['Výkon a upgrade',[['tuned-adm active / recommend','profil'],['sudo tuned-adm profile throughput-performance','zmena profilu'],['sysctl vm.swappiness','parameter jadra'],['echo "x = y" | sudo tee /etc/sysctl.d/90-x.conf','trvalo'],['sudo sysctl --system','načítať'],['iostat -xz 1 3','disky'],['sudo leapp preupgrade','kontrola pred upgradom 9 → 10'],['sudo leapp upgrade && sudo reboot','upgrade']]],
 ['Info o systéme',[['hostnamectl','meno, OS, jadro'],['cat /etc/redhat-release','verzia RHEL'],['uname -r','jadro'],['sudo subscription-manager status','registrácia'],['lscpu','CPU'],['sudo dmesg -T | tail','správy jadra'],['last','posledné prihlásenia'],['sudo sos report','balík pre Red Hat podporu']]]
];
function cheatView(){
  const v = document.createElement('div'); v.className='col'; v.style.maxWidth='1100px';
  const t18 = CHAPTERS.find(c=>c.n===24).body.find(b=>b[0]==='table');
  v.innerHTML = `<div class="eyebrow">Nástroj</div><h1>Ťahák</h1><p class="lead" style="font-size:16px">Najpoužívanejšie príkazy podľa tém. Klikni na príkaz a skopíruje sa.</p>
  <input class="search" id="cf" type="search" placeholder="Hľadaj: firewall, lvm, port, heslo…" aria-label="Hľadať v ťaháku">
  <div class="cs" id="csb">${CHEAT.map(([h,rows])=>`<section data-h="${esc(h.toLowerCase())}"><h3>${esc(h)}</h3>${rows.map(([c,d])=>`<div class="row" data-s="${esc((c+' '+d+' '+h).toLowerCase())}"><code title="Kopírovať">${esc(c)}</code><span>${esc(d)}</span></div>`).join('')}</section>`).join('')}</div>
  <div class="sect-h" id="v9v10"><h2>RHEL 9 vs RHEL 10</h2><p><a href="#kapitola-24">Kapitola 24</a> so zdrojmi</p></div>`;
  v.appendChild(renderBody([t18]));
  const f = $('#cf',v);
  f.addEventListener('input', ()=>{ const q=f.value.trim().toLowerCase(); v.querySelectorAll('#csb section').forEach(s=>{ let any=false; s.querySelectorAll('.row').forEach(r=>{ const ok=!q||r.dataset.s.includes(q); r.hidden=!ok; any=any||ok; }); s.hidden=!any; }); });
  $('#csb',v).addEventListener('click', async e=>{ const c=e.target.closest('code'); if (!c) return; const t=c.textContent; try { await navigator.clipboard.writeText(t); const o=c.textContent; c.textContent='skopírované ✓'; setTimeout(()=>c.textContent=o,900); } catch(err){ const r=document.createRange(); r.selectNodeContents(c); const s=getSelection(); s.removeAllRanges(); s.addRange(r); } });
  return v;
}

/* ---------- REVIEW ---------- */
function reviewView(){
  const v = document.createElement('div'); v.className='col';
  v.innerHTML = `<div class="eyebrow">Opakovanie</div><h1>10 náhodných otázok</h1><p class="lead" style="font-size:16px">Mix zo všetkých kapitol. Skóre počíta len prvú odpoveď.</p><div class="parts"><span class="chip" id="score">0 / 10</span><button class="btn sm" type="button" id="again">Nové otázky</button></div><div id="qq"></div>`;
  const draw = ()=>{
    const all = []; CHAPTERS.forEach(c=>c.quiz.forEach(q=>all.push({q,c})));
    for (let i=all.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [all[i],all[j]]=[all[j],all[i]]; }
    const pick = all.slice(0,10); let score=0, answered=0;
    const box = $('#qq',v); box.innerHTML='';
    pick.forEach(({q,c},i)=>{ let first=true; const el = quizBox(q,i,null,(oi,ok)=>{ if (first){ first=false; answered++; if (ok) score++; $('#score',v).textContent = `${score} / 10`+(answered===10?' · hotovo':''); $('#score',v).className = 'chip'+(answered===10&&score>=8?' ok':''); } }); el.insertAdjacentHTML('beforeend', `<p class="w" style="color:var(--muted);font-size:12.5px">Kapitola <a href="#kapitola-${c.n}">${c.n}. ${esc(c.short)}</a></p>`); box.appendChild(el); });
    $('#score',v).textContent='0 / 10'; $('#score',v).className='chip';
  };
  $('#again',v).addEventListener('click', draw); draw();
  return v;
}

/* ---------- VIM TRAINER ---------- */
const VIM_LESSONS = [
 {t:'Ako odísť z vimu', d:'Najčastejší problém začiatočníka. Zmaž jeden riadok (<kbd>d</kbd><kbd>d</kbd>), skús <code>:q</code> (uvidíš chybu E37), a potom odíď <b>bez uloženia</b>.', text:'# sshd_config\nPort 22\nPermitRootLogin no', check:v=>v.quit && !v.everSaved, h:'dd, potom :q Enter (chyba), potom :q! Enter'},
 {t:'Písanie a uloženie', d:'Na koniec prvého riadku dopíš <code>enforcing</code> (kláves <kbd>A</kbd> skočí na koniec riadku a prepne do Insert), stlač <kbd>Esc</kbd> a ulož s odchodom <code>:wq</code>.', text:'SELINUX=\nSELINUXTYPE=targeted', check:v=>v.lines[0]==='SELINUX=enforcing' && v.everSaved && v.quit, h:'A, napíš enforcing, Esc, :wq Enter'},
 {t:'Pohyb bez myši', d:'Dostaň kurzor na písmeno <b>C</b> v slove <code>CIEĽ</code>. Používaj <kbd>h</kbd> <kbd>j</kbd> <kbd>k</kbd> <kbd>l</kbd>, <kbd>w</kbd> (ďalšie slovo), <kbd>$</kbd> (koniec riadku), <kbd>G</kbd> (posledný riadok).', text:'tu začínaš\n\n  [Unit]\n  Description=Server\n\n  [Service]\n  ExecStart=/opt/app/bin/start\n  Restart=on-failure CIEĽ', check:v=>v.r===7 && v.c===21, h:'G skočí na posledný riadok, $ na koniec, potom h niekoľkokrát. Alebo G a 5w.'},
 {t:'Mazanie: x a dd', d:'Oprav súbor do tvaru: <code>Port 22</code>, <code>PermitRootLogin no</code>, <code>MaxAuthTries 3</code>. Zmaž duplicitný riadok cez <kbd>d</kbd><kbd>d</kbd> a prebytočné písmeno cez <kbd>x</kbd>.', text:'Port 22\nPort 22\nPermitRootLogin noo\nMaxAuthTries 3', check:v=>v.text==='Port 22\nPermitRootLogin no\nMaxAuthTries 3', h:'dd na 2. riadku, potom $ a x na konci tretieho'},
 {t:'Odkomentovanie a zmena', d:'Odstráň <code>#</code> na začiatku oboch riadkov a nastav oba na <code>no</code>. Výsledok: <code>PermitRootLogin no</code> a <code>PasswordAuthentication no</code>. Skús <kbd>x</kbd>, <kbd>w</kbd> a <kbd>C</kbd> (zmeň do konca riadku) alebo <kbd>c</kbd><kbd>w</kbd>.', text:'#PermitRootLogin prohibit-password\n#PasswordAuthentication yes', check:v=>v.text==='PermitRootLogin no\nPasswordAuthentication no', h:'x, w, C no Esc, j 0 x, w, cw no Esc'},
 {t:'Nové riadky: o a O', d:'Pridaj <b>pod</b> riadok s db01 riadok <code>10.0.20.50 mon01</code> (kláves <kbd>o</kbd>) a <b>nad</b> neho komentár <code># servery</code> (kláves <kbd>O</kbd>).', text:'127.0.0.1 localhost\n10.0.20.40 db01', check:v=>v.text.trim()==='127.0.0.1 localhost\n# servery\n10.0.20.40 db01\n10.0.20.50 mon01', h:'j, o 10.0.20.50 mon01 Esc, k, O # servery Esc'},
 {t:'Kopírovanie: yy a p', d:'Z jedného riadku sprav tri: <code>web01 10.0.20.31</code>, <code>web02 10.0.20.32</code>, <code>web03 10.0.20.33</code>. Skopíruj riadok <kbd>y</kbd><kbd>y</kbd>, vlož <kbd>p</kbd> a čísla oprav cez <kbd>r</kbd> (prepíše jeden znak).', text:'web01 10.0.20.31', check:v=>v.text.trim()==='web01 10.0.20.31\nweb02 10.0.20.32\nweb03 10.0.20.33', h:'yy 2p, potom na 2. riadku: 4l r2, $ r2; na 3. riadku podobne r3'},
 {t:'Undo', d:'Zmaž všetky štyri riadky naraz (<kbd>4</kbd><kbd>d</kbd><kbd>d</kbd> alebo <kbd>d</kbd><kbd>G</kbd>) a potom ich vráť klávesom <kbd>u</kbd>.', text:'[main]\ngpgcheck=1\ninstallonly_limit=3\nbest=True', check:v=>v.text==='[main]\ngpgcheck=1\ninstallonly_limit=3\nbest=True' && v.stats.undo>0, h:'4dd, potom u'},
 {t:'Hľadanie', d:'Nájdi tretí výskyt slova <code>Listen</code>: napíš <code>/Listen</code>, <kbd>Enter</kbd> a potom <kbd>n</kbd> na ďalší výskyt. Kurzor musí stáť na treťom.', text:'# httpd.conf\nServerRoot "/etc/httpd"\nListen 80\nInclude conf.modules.d/*.conf\n# Listen 8080\nUser apache\nGroup apache\nListen 443\nDocumentRoot "/var/www/html"', check:v=>v.r===7 && v.lines[7].slice(v.c).startsWith('Listen'), h:'/Listen Enter, n, n'},
 {t:'Nahradenie v celom súbore', d:'Prepíš všetky <code>8080</code> na <code>8443</code> jedným príkazom: <code>:%s/8080/8443/g</code>.', text:'Listen 8080\nProxyPass / http://localhost:8080/\nProxyPassReverse / http://localhost:8080/\n# port 8080 povolený vo firewalle', check:v=>!v.text.includes('8080') && (v.text.match(/8443/g)||[]).length===4, h:':%s/8080/8443/g Enter'},
 {t:'Čísla riadkov a skok', d:'Zapni čísla riadkov <code>:set nu</code>, skoč na riadok 14 (<code>:14</code>) a zmaž ho (<kbd>d</kbd><kbd>d</kbd>). Chybová hláška ti v praxi povie práve číslo riadku.', text:Array.from({length:20},(_,i)=>i===13?'ChybnaDirektiva yes   # riadok 14':`Nastavenie${i+1} = hodnota`).join('\n'), check:v=>v.number && v.lines.length===19 && !v.text.includes('ChybnaDirektiva'), h:':set nu Enter, :14 Enter, dd'},
 {t:'Počty a operátory', d:'Zmaž tri slová <code>bbb ccc ddd</code> jedným príkazom: presuň sa na <code>bbb</code> (<kbd>w</kbd>) a stlač <kbd>3</kbd><kbd>d</kbd><kbd>w</kbd> (alebo <kbd>d</kbd><kbd>3</kbd><kbd>w</kbd>).', text:'aaa bbb ccc ddd eee', check:v=>v.text.replace(/\s+/g,' ').trim()==='aaa eee', h:'w 3dw'},
 {t:'Finále: zabezpeč sshd', d:'Uprav súbor tak, aby obsahoval (bez #) riadky <code>PermitRootLogin no</code>, <code>PasswordAuthentication no</code> a <code>MaxAuthTries 3</code>. Ulož a odíď.', text:'# /etc/ssh/sshd_config.d/10-firma.conf\n#PermitRootLogin prohibit-password\n#PasswordAuthentication yes\n#MaxAuthTries 6\nX11Forwarding no', check:v=>{ const L=v.lines.map(l=>l.trim()); return L.includes('PermitRootLogin no') && L.includes('PasswordAuthentication no') && L.includes('MaxAuthTries 3') && v.everSaved && v.quit; }, h:'Na každom riadku: 0 x, w, C nová hodnota Esc. Na konci :wq'}
];
function vimView(){
  const v = document.createElement('div'); v.className='page';
  let cur = Math.max(0, VIM_LESSONS.findIndex((l,i)=>!S.vim[i])); if (cur<0) cur=0;
  v.innerHTML = `<div class="col" style="max-width:1100px"><div class="eyebrow">Nástroj</div><h1>Vim trenažér</h1><p class="lead" style="font-size:16px">Skutočné režimy ako vo vime na serveri. Klikni do editora a píš. Na mobile použi tlačidlá Esc, :wq a :q! pod editorom.</p>
  <div class="vt-grid"><ol class="lessons" id="ls"></ol><div id="lw"></div></div>
  <div class="sect-h"><h2>Rýchla referencia</h2><p><a href="#kapitola-5">Kapitola 5</a> má všetko podrobne</p></div>
  <div class="vref">${[['i a o','Insert'],['A I','koniec / začiatok riadku'],['Esc','Normal'],[':w',' uložiť'],[':q!','bez uloženia'],[':wq',' uložiť a odísť'],['h j k l','pohyb'],['w b e','slová'],['0 $','začiatok / koniec'],['gg G','súbor'],['x','zmaž znak'],['dd','zmaž riadok'],['dw d$','zmaž slovo / do konca'],['cw C','zmeň slovo / do konca'],['yy p P','kopíruj / vlož'],['r','prepíš znak'],['u Ctrl+r','undo / redo'],['.','zopakuj zmenu'],['/x n N','hľadaj'],[':%s/a/b/g','nahraď'],[':set nu','čísla riadkov'],['J','spoj riadky']].map(([k,d])=>`<div><code>${esc(k)}</code><span>${esc(d)}</span></div>`).join('')}</div></div>`;
  const drawList = ()=>{ $('#ls',v).innerHTML = VIM_LESSONS.map((l,i)=>`<li><button type="button" data-i="${i}" class="${i===cur?'on':''}"><span class="num">${String(i+1).padStart(2,'0')}</span><span>${esc(l.t)}</span><span class="dot ${S.vim[i]?'done':''}"></span></button></li>`).join(''); };
  const open = i=>{
    cur = i; drawList();
    const L = VIM_LESSONS[i];
    const w = $('#lw',v);
    w.innerHTML = `<div class="vt-task"><div class="eyebrow">Lekcia ${i+1} z ${VIM_LESSONS.length}</div><h2>${esc(L.t)}</h2><p>${L.d}</p><div class="acts" style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" type="button" data-a="reset">Začať znova</button><button class="btn sm" type="button" data-a="hint">Nápoveda</button></div><div class="reveal" hidden></div></div>
      <div class="vimbox" id="vb" tabindex="0"></div>
      <div class="parts" style="margin-top:8px"><span class="seg" style="border-color:var(--line)"><button class="btn sm" type="button" data-k="Escape">Esc</button></span><button class="btn sm" type="button" data-k=":wq">:wq</button><button class="btn sm" type="button" data-k=":q!">:q!</button></div>
      <div class="keys" id="keys" aria-label="Stlačené klávesy"></div><div id="okslot"></div>`;
    let vim, keyLog=[];
    const start = ()=>{
      vim = new Vim(L.text, {name: i===12?'10-firma.conf':'cvicenie.conf', onQuit:()=>{}});
      const box = $('#vb',w); box.innerHTML='';
      const keysEl = $('#keys',w); keyLog=[]; keysEl.innerHTML='<span>tu uvidíš stlačené klávesy</span>';
      box._log = k=>{ keyLog.push(k==='Escape'?'Esc':k==='Enter'?'↵':k===' '?'␣':k==='Backspace'?'⌫':k); if (keyLog.length>40) keyLog.shift(); keysEl.innerHTML = keyLog.map(x=>`<span>${esc(x)}</span>`).join(''); };
      const after = ()=>{
        if (vim.quit){ $('.vin',box).innerHTML = `<div class="vbuf"><div class="vl"><span class="vt">[vim zatvorený]</span></div></div><div class="vstat"><span class="vmsg">${vim.everSaved?'súbor uložený':'zmeny zahodené'}</span><span class="vpos"></span></div>`; }
        let ok=false; try { ok = L.check(vim); } catch(e){}
        if (ok && !$('#okslot',w).innerHTML){ S.vim[i]=true; save(); drawList(); $('#okslot',w).innerHTML = `<div class="okbar">✓ Hotovo. ${i<VIM_LESSONS.length-1?`<button class="btn sm pri" type="button" id="nx">Ďalšia lekcia →</button>`:'Prešiel si všetky lekcie.'}</div>`; const nx=$('#nx',w); if (nx) nx.addEventListener('click', ()=>open(i+1)); }
      };
      const b = bindVim(box, vim, after, 12);
      $('#okslot',w).innerHTML='';
      setTimeout(()=>b.focus(),30);
      w._b = b; w._vim = vim; w._after = after;
    };
    start();
    w.querySelector('[data-a=reset]').addEventListener('click', start);
    w.querySelector('[data-a=hint]').addEventListener('click', ()=>{ const r=$('.reveal',w); r.hidden=false; r.innerHTML='<b>Nápoveda:</b> '+esc(L.h); });
    w.querySelectorAll('[data-k]').forEach(btn=>btn.addEventListener('click', ()=>{ const k=btn.dataset.k, vm=w._vim; if (k==='Escape'){ vm.key('Escape'); $('#vb',w)._log('Escape'); } else { vm.key('Escape'); for (const ch of k){ vm.key(ch); } vm.key('Enter'); $('#vb',w)._log(k); } $('#vb',w).dispatchEvent(new Event('rerender')); w._b.focus(); }));
  };
  $('#ls',v).addEventListener('click', e=>{ const b=e.target.closest('button'); if (b) open(+b.dataset.i); });
  open(cur);
  return v;
}

/* ---------- ROUTER ---------- */
function route(){
  const h = (location.hash||'#uvod').slice(1);
  let node, key = h;
  const m = h.match(/^kapitola-(\d+)$/);
  if (m && CHAPTERS[+m[1]-1]) node = chapterView(CHAPTERS[+m[1]-1]);
  else if (h==='terminal') node = terminalView();
  else if (h==='vim') node = vimView();
  else if (h==='mapa') node = mapView();
  else if (h==='tahak') node = cheatView();
  else if (h==='rozlustit') node = explainView();
  else if (h==='opakovanie') node = reviewView();
  else if (h==='incidenty') node = incidentsView();
  else if (/^incident-/.test(h) && window.INCIDENTS.find(x=>'incident-'+x.id===h)) { node = incidentView(window.INCIDENTS.find(x=>'incident-'+x.id===h)); key='incidenty'; }
  else if (h==='skuska') node = examView();
  else if (h==='dril') node = drillView();
  else if (h==='plan') node = planView();
  else { node = homeView(); key='uvod'; }
  S.seen = S.seen||{}; if (!S.seen[key]){ S.seen[key]=true; save(); }
  view.innerHTML=''; view.appendChild(node);
  document.querySelectorAll('.rail a').forEach(a=>a.classList.toggle('on', a.dataset.k===key));
  document.querySelectorAll('.bar nav a').forEach(a=>a.classList.toggle('on', a.dataset.nav===key));
  $('#rail').classList.remove('open');
  refreshProgress();
  window.scrollTo(0,0);
  if (window.__scrollTo){ const t = document.getElementById(window.__scrollTo); window.__scrollTo=null; if (t) setTimeout(()=>{ t.scrollIntoView({block:'start'}); t.classList.add('flash'); setTimeout(()=>t.classList.remove('flash'),1600); }, 30); }
}
