/* =========================================================
   APP: jadro, stav, renderovanie blokov, terminál
   ========================================================= */
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const KEY = 'rhel-v-praxi-1';
let S = {read:{}, quiz:{}, ex:{}, vim:{}, last:null, ver:9};
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch(e){}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }
/* nastavenia vzhľadu len pre toto zariadenie (nesynchronizujú sa) */
const UIKEY = 'rhel-v-praxi-ui';
let UI = {tt:'dark', fs:13, h:{}, w:0, theme:'auto'};
try { UI = Object.assign(UI, JSON.parse(localStorage.getItem(UIKEY)||'{}')); } catch(e){}
function saveUI(){ try { localStorage.setItem(UIKEY, JSON.stringify(UI)); } catch(e){} }
function applyTheme(){ const r = document.documentElement; if (UI.theme==='auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', UI.theme); }
function applySideW(){ if (UI.w) document.documentElement.style.setProperty('--side-w', UI.w+'px'); else document.documentElement.style.removeProperty('--side-w'); }
applyTheme(); applySideW();
const CHAPTERS = window.CHAPTERS.sort((a,b)=>a.n-b.n);
if (!S.v2){ for (const k of ['read','quiz','ex']){ if (S[k] && S[k][18]!=null){ S[k][24]=S[k][18]; delete S[k][18]; } } S.v2=1; save(); }
const CMDREF = window.CMDREF;

/* ---------- AI (sample) ---------- */
let SAMPLE = null;
(async ()=>{
  try {
    if (!window.claude || !window.claude.use) return;
    SAMPLE = await window.claude.use('sample');
    if (SAMPLE) document.body.classList.add('ai');
  } catch(e){ SAMPLE = null; }
})();
async function askClaude(prompt, onText){
  if (!SAMPLE) throw {code:'unavailable', message:'Claude tu nie je dostupný.'};
  const res = await SAMPLE(prompt, {onText: ({text})=>onText && onText(text), modelTier:'default'});
  return res.text;
}
const AI_FRAME = 'Si skúsený Linux administrátor a lektor. Odpovedáš po slovensky, stručne a vecne (max. 12 riadkov), pre začínajúceho systémového inžiniera, ktorý pracuje na serveroch Red Hat Enterprise Linux 9 a 10. Príkazy píš v samostatných riadkoch. Nepoužívaj markdown nadpisy ani tabuľky.';

/* ---------- block rendering ---------- */
function flagsHTML(cmd, subset){
  const r = CMDREF[cmd]; if (!r) return '';
  let f = r.f; if (subset) f = f.filter(x=>subset.some(s=>x[0].split(/ \/ |\s+/).includes(s) || x[0]===s));
  return `<div class="flags"><header><b>${esc(cmd)}</b><span>${esc(r.d)}</span>${r.s?`<code>${esc(r.s)}</code>`:''}</header>`+
    (f.length?`<dl>${f.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`:'')+
    (r.x && !subset?`<div class="ex">${r.x.map(([c,d])=>`<div><code>${esc(c)}</code><span>${esc(d)}</span></div>`).join('')}</div>`:'')+`</div>`;
}
function splitTokens(s){
  const out=[]; let cur=''; let q=null;
  for (const ch of s){
    if (q){ cur+=ch; if (ch===q) q=null; continue; }
    if (ch==='"'||ch==="'"){ q=ch; cur+=ch; continue; }
    if (/\s/.test(ch)){ if (cur) out.push(cur); cur=''; continue; }
    if (ch==='|'){ if (cur) out.push(cur); out.push('|'); cur=''; continue; }
    cur+=ch;
  }
  if (cur) out.push(cur);
  return out;
}
const SUBCMDS = {systemctl:1, dnf:1, nmcli:1, ip:1, semanage:1, 'subscription-manager':1, hostnamectl:1, timedatectl:1, journalctl:0, podman:1, 'tuned-adm':1, leapp:1};
function lookupFlag(cmd, key){
  const r = CMDREF[cmd]; if (!r) return null;
  for (const [k,v] of r.f){
    const keys = k.split(/ \/ |, /).map(x=>x.trim().split(/\s+/)[0]);
    if (keys.includes(key)) return [k,v];
  }
  for (const [k,v] of r.f){
    const keys = k.split(/ \/ |, /).map(x=>x.trim());
    if (keys.some(x=>x.startsWith(key+' ') || x.startsWith(key+'=') || x===key)) return [k,v];
  }
  return null;
}
function valDesc(cmd, flag, val){
  const r = CMDREF[cmd]; const raw = String(val).replace(/^["']|["']$/g,'');
  const V = r && r.v && r.v[flag];
  if (V==='port' || (!V && /port/.test(flag))){ const d = raw.split(',').map(x=>window.portDesc ? window.portDesc(x) : '').filter(Boolean); if (d.length) return d.join('; '); }
  if (V && typeof V==='object'){
    if (V[raw]) return V[raw];
    const parts = raw.split(','); if (parts.length>1 && parts.every(x=>V[x])) return parts.map(x=>V[x]).join('; ');
    if (V['*']) return V['*'];
  }
  return '';
}
function explainData(line){
  const toks = splitTokens(line.trim());
  const rows = []; const chips = [];
  let cmd = null, afterCmd = 0, expectVal = null;
  for (let i=0;i<toks.length;i++){
    const t = toks[i];
    if (t==='|'){ chips.push({t,c:'pipe'}); rows.push({k:'|',c:'pipe',v:'rúra: výstup predošlého príkazu ide na vstup ďalšieho'}); cmd=null; continue; }
    if (/^\d?>>?/.test(t) || t==='2>&1' || t.startsWith('&>')){ chips.push({t,c:'pipe'}); rows.push({k:t,c:'pipe',v: t.startsWith('2>/dev/null')?'chybové hlásenia zahoď':t==='2>&1'?'chyby pošli tam, kam ide normálny výstup':t.startsWith('>>')?'pripoj výstup na koniec súboru':t.startsWith('2>')?'chyby do súboru':'výstup do súboru (prepíše ho)'}); continue; }
    if (!cmd){
      if (t==='sudo'){ chips.push({t,c:'cmd'}); rows.push({k:'sudo',c:'cmd',v:'spusti nasledujúci príkaz ako root'}); continue; }
      cmd = t; afterCmd=0;
      const r = CMDREF[t];
      chips.push({t,c:'cmd'}); rows.push({k:t,c:'cmd',v: r ? r.d : 'príkaz (v referencii stránky nie je popísaný)'});
      continue;
    }
    afterCmd++;
    if (expectVal){ chips.push({t,c:'arg'}); rows.push({k:t,c:'arg',v:valDesc(cmd, expectVal, t) || 'hodnota pre '+expectVal}); expectVal=null; continue; }
    // special forms
    if (cmd==='ps' && /^[a-z]+$/.test(t) && afterCmd===1){
      chips.push({t,c:'flag'});
      const m = {a:'a: procesy všetkých používateľov', u:'u: formát so stĺpcom USER, %CPU, %MEM', x:'x: aj procesy bez terminálu (služby)', e:'e: všetky procesy', f:'f: plný formát'};
      t.split('').forEach(L=>rows.push({k:L,c:'flag',v:(m[L]||'BSD voľba '+L).replace(/^\w: /,'')}));
      continue;
    }
    if (cmd==='tar' && afterCmd===1 && /^[a-zA-Z]+$/.test(t)) { toks[i]='-'+t; i--; afterCmd--; continue; }
    if (t.startsWith('--')){
      const key = t.split('=')[0];
      const f = lookupFlag(cmd, key) || lookupFlag(cmd, t);
      chips.push({t,c:'flag'});
      const val = t.includes('=') ? t.slice(t.indexOf('=')+1) : '';
      const vd = val ? valDesc(cmd, key, val) : '';
      rows.push({k:t,c:'flag',v: f ? f[1] + (val && !f[0].includes(val)?` (hodnota: ${val}${vd?' → '+vd:''})`:'') : '', unk:!f});
      if (f && !val && f[0].split(' / ').some(x=>x.startsWith(key+' ') && /^[A-ZÁ-Ž]/.test(x.slice(key.length+1)))) expectVal = key;
      continue;
    }
    if (/^-[A-Za-z]/.test(t)){
      chips.push({t,c:'flag'});
      // whole word options like -name, -type for find
      const whole = lookupFlag(cmd, t);
      if (whole && (t.length>2 || cmd==='find')){ rows.push({k:t,c:'flag',v:whole[1]}); if (/\s\S/.test(whole[0].split(' / ')[0]) && !whole[0].startsWith(t+' /')) expectVal = t; continue; }
      const letters = t.slice(1).split('');
      for (let j=0;j<letters.length;j++){
        const L = letters[j];
        const f = lookupFlag(cmd, '-'+L);
        rows.push({k:'-'+L, c:'flag', v: f ? f[1] : 'prepínač -'+L+' (v referencii nie je)', unk:!f});
        if (f && /^-\w\s+[A-ZÁ-Ž0-9N]/.test(f[0].split(' / ').find(x=>x.startsWith('-'+L))||'')){
          const rest = letters.slice(j+1).join('');
          if (rest){ rows.push({k:rest,c:'arg',v:'hodnota pre -'+L}); } else expectVal='-'+L;
          break;
        }
      }
      continue;
    }
    if (SUBCMDS[cmd] && afterCmd<=2){
      const f = lookupFlag(cmd, t);
      if (f){ chips.push({t,c:'sub'}); rows.push({k:t,c:'flag',v:f[1]}); continue; }
    }
    chips.push({t,c:'arg'});
    const RV = CMDREF[cmd] && CMDREF[cmd].v;
    if (RV && RV._pos && RV._pos[t]){ rows.push({k:t,c:'arg',v:RV._pos[t]}); continue; }
    if (RV && RV._num && /^\d+$/.test(t)){ rows.push({k:t,c:'arg',v:RV._num}); continue; }
    let v = 'argument';
    if (/^https?:\/\//.test(t)) v = 'URL adresa';
    else if (/^[\w.-]+\.[a-z]{2,}(:\d+)?\/[\w./-]+/.test(t) && !t.startsWith('/')) v = 'obraz kontajnera (register/meno)';
    else if (/^[\w.-]+@[\w.-]+(:.*)?$/.test(t)) v = t.includes(':') ? 'vzdialená cesta (používateľ@server:cesta)' : 'cieľový server (používateľ@server)';
    else if (/^\//.test(t) || /^~/.test(t) || /\//.test(t)) v = 'cesta k súboru alebo adresáru';
    else if (/[*?]/.test(t)) v = 'vzor (glob)';
    else if (/^["']/.test(t)) v = 'text v úvodzovkách (shell ho neroztrhá na slová)';
    else if (t==='{}') v='sem find dosadí meno nájdeného súboru';
    else if (t==='\\;' || t===';') v='koniec príkazu pre -exec';
    else if (/^\d+\/(tcp|udp)$/.test(t) && window.portDesc) v = window.portDesc(t);
    else if (/^\d+$/.test(t)) v = 'číslo';
    rows.push({k:t,c:'arg',v});
  }
  return {chips, rows};
}
function explainHTML(line){
  const {chips, rows} = explainData(line);
  return `<div class="explain"><div class="ex-line">${chips.map(c=>`<span class="tok t-${c.c}">${esc(c.t)}</span>`).join('')}</div><div class="ex-rows">${rows.map(r=>`<span class="k k-${r.c}">${esc(r.k)}</span><span class="v${r.unk?' unk':''}">${esc(r.v||'neznámy prepínač')}</span>`).join('')}</div></div>`;
}
function renderBody(blocks){
  const box = document.createElement('div'); box.className='body';
  let hi = 0;
  for (const b of blocks){
    const [t, a, c, d] = b;
    let html = '';
    switch(t){
      case 'h': html = `<h3 id="s${++hi}">${esc(a)}</h3>`; break;
      case 'p': html = `<p>${a}</p>`; break;
      case 'cmd': html = `<div class="cmd"><div class="c">${esc(a)}${c?`<span class="note">${esc(c)}</span>`:''}</div><button class="run" type="button" data-run="${esc(a)}">Skúsiť ▸</button></div>`; break;
      case 'out': html = `<div class="out">${a?`<span class="p">$ </span>${esc(a)}\n`:''}${esc(c)}</div>`; break;
      case 'pre': html = `<pre class="pre">${esc(a)}</pre>`; break;
      case 'flags': html = flagsHTML(a, c); break;
      case 'explain': html = explainHTML(a); break;
      case 'tip': html = `<div class="callout tip"><b class="k">Tip</b><div>${a}</div></div>`; break;
      case 'warn': html = `<div class="callout warn"><b class="k">Pozor</b><div>${a}</div></div>`; break;
      case 'new': html = `<div class="callout new"><b class="k">RHEL 10</b><div>${a}</div></div>`; break;
      case 'table': html = `<div class="tbl"><table><thead><tr>${a.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${c.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; break;
      case 'annot': html = `<div class="annot">${a?`<div class="an-h">${esc(a)}</div>`:''}<div class="an-rows">${c.map(([code,note])=>`<code class="an-c">${esc(code)||'&nbsp;'}</code><span class="an-n">${note||''}</span>`).join('')}</div>${b[3]?`<div class="cmd an-run"><div class="c">${esc(b[3])}</div><button class="run" type="button" data-run="${esc(b[3])}">Skúsiť ▸</button></div>`:''}</div>`; break;
      case 'list': html = `<ul class="ls">${a.map(x=>`<li>${x}</li>`).join('')}</ul>`; break;
      case 'src': html = `<ul class="src">${a.map(([n,u])=>`<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('')}</ul>`; break;
    }
    box.insertAdjacentHTML('beforeend', html);
  }
  return box;
}

/* ---------- man page ---------- */
function manText(cmd){
  const r = CMDREF[cmd];
  if (!r) return `No manual entry for ${cmd}\n(stránka má popísané: ${Object.keys(CMDREF).slice(0,40).join(', ')} …)`;
  let s = `${cmd.toUpperCase()}(1)                     Príručka (skrátená)\n\nMENO\n       ${cmd} - ${r.d}\n\nPOUŽITIE\n       ${r.s}\n`;
  if (r.f.length) s += `\nPREPÍNAČE\n` + r.f.map(([k,v])=>`       ${k}\n              ${v}`).join('\n') + '\n';
  if (r.x) s += `\nPRÍKLADY\n` + r.x.map(([k,v])=>`       ${k}\n              ${v}`).join('\n') + '\n';
  s += `\n(skutočný man má viac; v ňom hľadáš /slovo a končíš q)`;
  return s;
}
const HELP_TEXT = `Simulovaný RHEL. Funguje väčšina bežných príkazov s prepínačmi:
  súbory:     ls cd pwd mkdir touch cp mv rm ln cat less head tail tree stat file
  hľadanie:   grep find wc sort uniq cut awk sed tee xargs diff
  práva:      chmod chown chgrp umask getfacl setfacl
  ľudia:      id whoami useradd usermod userdel passwd chage groupadd su sudo
  procesy:    ps top kill pkill pgrep free uptime df du lscpu vmstat
  služby:     systemctl journalctl hostnamectl timedatectl chronyc
  balíky:     dnf (yum) rpm subscription-manager
  sieť:       ip nmcli ss ping curl dig getent hostname
  firewall:   firewall-cmd nft
  SELinux:    getenforce setenforce sestatus restorecon semanage getsebool setsebool chcon ausearch sealert
  disky:      lsblk blkid mount umount pvcreate vgcreate vgextend lvcreate lvextend pvs vgs lvs mkfs.xfs xfs_growfs findmnt
  ostatné:    tar ssh ssh-keygen ssh-copy-id scp rsync crontab history man vim sos
Rúry |, presmerovanie > >> 2> 2>&1, && ; || a !! fungujú. vim súbor otvorí editor.
Tab doplní cestu alebo príkaz, ↑ ↓ história, Ctrl+L vyčistí.
` + (window.HELP_EXTRA||'');

/* ---------- Terminal ---------- */
class Term {
  constructor(host, opts={}){
    this.opts = opts;
    this.ver = opts.ver || S.ver || 9;
    this.m = new Machine(this.ver);
    this.hist = []; this.hi = 0; this.lastOut = ''; this.lastCmd = '';
    this.el = document.createElement('div'); this.el.className = 'term-wrap';
    this.el.innerHTML = `<div class="term${opts.tall?' tall':''}">
      <div class="term-top"><span class="ttl">${esc(opts.title||'ssh admin@lab')}</span><span class="sp"></span>
        <span class="seg" role="group" aria-label="Verzia RHEL"><button type="button" data-v="9">RHEL 9</button><button type="button" data-v="10">RHEL 10</button></span>
        <button class="tbtn ai-only" type="button" data-act="explain" title="Claude vysvetlí posledný príkaz a výstup">Vysvetli výstup</button>
        <span class="tsz" role="group" aria-label="Veľkosť písma"><button class="tbtn" type="button" data-act="fs-" title="Menšie písmo" aria-label="Menšie písmo">A−</button><button class="tbtn" type="button" data-act="fs+" title="Väčšie písmo" aria-label="Väčšie písmo">A+</button></span>
        <button class="tbtn" type="button" data-act="theme" title="Svetlé / tmavé pozadie terminálu" aria-label="Prepnúť svetlé alebo tmavé pozadie terminálu"></button>
        <button class="tbtn" type="button" data-act="reset" title="Nový čistý stroj">Reset</button></div>
      <div class="term-out" aria-live="polite"></div>
      <label class="term-in"><span class="ps"></span><input type="text" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Príkaz"></label>
      <div class="keybar" aria-label="Klávesy pre mobil">${[['Tab','Tab'],['↑','Up'],['↓','Down'],['Ctrl+C','CtrlC'],['-','-'],['|','|'],['/','/'],['~','~'],['>','>'],['$','$'],['*','*'],['"','"']].map(([l,k])=>`<button type="button" data-key="${esc(k)}">${esc(l)}</button>`).join('')}</div>
      <div class="term-grip" role="separator" aria-orientation="horizontal" aria-label="Zmeniť výšku terminálu" title="Potiahni: výška terminálu · dvojklik: pôvodná" tabindex="0"><span></span></div>
      ${opts.tasks?'<div class="term-tasks"></div>':''}
    </div>`;
    host.appendChild(this.el);
    this.out = $('.term-out', this.el); this.inp = $('input', this.el); this.ps = $('.ps', this.el);
    this.el.querySelectorAll('.seg button').forEach(b=>b.addEventListener('click', ()=>this.setVer(+b.dataset.v)));
    $('[data-act=reset]', this.el).addEventListener('click', ()=>this.reset());
    $('[data-act=theme]', this.el).addEventListener('click', ()=>{ UI.tt = UI.tt==='light'?'dark':'light'; saveUI(); Term.applyLook(); });
    $('[data-act="fs-"]', this.el).addEventListener('click', ()=>{ UI.fs = Math.max(10, (UI.fs||13)-1); saveUI(); Term.applyLook(); });
    $('[data-act="fs+"]', this.el).addEventListener('click', ()=>{ UI.fs = Math.min(22, (UI.fs||13)+1); saveUI(); Term.applyLook(); });
    this.hk = opts.tall ? 'T' : 'N';
    this.bindGrips();
    $('[data-act=explain]', this.el).addEventListener('click', ()=>this.explainLast());
    $('.term', this.el).addEventListener('click', e=>{ if (e.target.closest('button,a,.overlay')) return; if (!window.getSelection().toString()) this.inp.focus({preventScroll:true}); });
    this.inp.addEventListener('keydown', e=>this.onKey(e));
    this.inp.addEventListener('paste', e=>{ const t = (e.clipboardData||{getData:()=>''}).getData('text'); if (!/\n/.test(t.replace(/\s+$/,''))) return; e.preventDefault(); const pre = this.inp.value; this.inp.value=''; this.exec((pre+t).replace(/\r/g,'').replace(/\s+$/,'')); });
    this.el.querySelectorAll('.keybar button').forEach(b=>{
      b.addEventListener('mousedown', e=>e.preventDefault());
      b.addEventListener('touchstart', e=>{}, {passive:true});
      b.addEventListener('click', e=>{
        e.preventDefault();
        const k = b.dataset.key, inp = this.inp;
        if (k==='Tab') this.complete();
        else if (k==='Up'){ if (this.hi>0){ this.hi--; inp.value=this.hist[this.hi]||''; } }
        else if (k==='Down'){ if (this.hi<this.hist.length){ this.hi++; inp.value=this.hist[this.hi]||''; } }
        else if (k==='CtrlC'){ this.printHTML(this.promptStr()+esc(inp.value)+'^C\n'); inp.value=''; }
        else { const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a; inp.value = inp.value.slice(0,a)+k+inp.value.slice(z); try { inp.setSelectionRange(a+k.length, a+k.length); } catch(_){} }
        inp.focus({preventScroll:true});
      });
    });
    this.markSeg(); this.banner(); this.prompt(); this.applyOwnLook();
  }
  applyOwnLook(){
    const t = $('.term', this.el); t.classList.toggle('tlight', UI.tt==='light'); t.style.setProperty('--tfs', (UI.fs||13)+'px');
    $('[data-act=theme]', this.el).textContent = UI.tt==='light' ? '☾ Tmavé' : '☀ Svetlé';
    this.applyHeight();
  }
  static applyLook(){ document.querySelectorAll('.term-wrap').forEach(w=>{ if (w._term) w._term.applyOwnLook(); }); }
  applyHeight(){ const h = (UI.h||{})[this.hk]; const o = this.out.style; if (h){ o.height = h+'px'; o.maxHeight='none'; o.minHeight='0'; o.flex='none'; } else { o.height=''; o.maxHeight=''; o.minHeight=''; o.flex=''; } }
  bindGrips(){
    this.el._term = this;
    const g = $('.term-grip', this.el);
    if (!Term._rz){ Term._rz = true; let t; window.addEventListener('resize', ()=>{ clearTimeout(t); t = setTimeout(()=>Term.applyLook(), 120); }); }
    const drag = (el, onMove, onEnd)=>{
      el.addEventListener('pointerdown', e=>{
        if (e.button!==0 && e.pointerType==='mouse') return;
        e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('on'); document.body.classList.add('dragging');
        const sx = e.clientX, sy = e.clientY, st = onMove(null);
        const mv = ev=>onMove({dx: ev.clientX-sx, dy: ev.clientY-sy, st});
        const up = ()=>{ el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('on'); document.body.classList.remove('dragging'); onEnd(); };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
    };
    drag(g, d=>{
      if (!d) return this.out.getBoundingClientRect().height;
      const h = Math.round(Math.max(120, Math.min(innerHeight*0.92, d.st + d.dy)));
      UI.h = UI.h||{}; UI.h[this.hk] = h; this.applyHeight();
    }, ()=>{ saveUI(); Term.applyLook(); });
    g.addEventListener('dblclick', ()=>{ if (UI.h) delete UI.h[this.hk]; saveUI(); Term.applyLook(); });
    g.addEventListener('keydown', e=>{ if (e.key!=='ArrowUp' && e.key!=='ArrowDown') return; e.preventDefault(); const cur = this.out.getBoundingClientRect().height; UI.h = UI.h||{}; UI.h[this.hk] = Math.round(Math.max(120, Math.min(innerHeight*0.92, cur + (e.key==='ArrowDown'?40:-40)))); saveUI(); Term.applyLook(); });
  }
  markSeg(){ this.el.querySelectorAll('.seg button').forEach(b=>b.classList.toggle('on', +b.dataset.v===this.ver)); }
  setVer(v){ if (v===this.ver) return; this.ver=v; S.ver=v; save(); this.markSeg(); this.reset(true); }
  reset(silent){ this.markSeg(); this.m = new Machine(this.ver); this.out.innerHTML=''; this.closeEditor(); this.banner(); this.prompt(); if (this.opts.onReset) this.opts.onReset(this); if (!silent) this.inp.focus({preventScroll:true}); if (this.opts.onRun) this.opts.onRun(this.m, ''); }
  banner(){
    const v10 = this.ver===10;
    this.print(`${this.m.release}\nKernel ${this.m.kernel} on x86_64\n\nWeb console: https://${this.m.hostname}:9090/ or https://10.0.20.31:9090/\n\nLast login: Sun Nov  1 10:29:40 2026 from 10.0.20.15\n`, 'hint');
    this.print(`Simulácia ${v10?'RHEL 10':'RHEL 9'}. Napíš help pre zoznam príkazov. Si admin, root práva cez sudo.\n`, 'hint');
  }
  promptStr(){
    const m=this.m; let d = m.cwd===m.home ? '~' : (m.cwd==='/'?'/':m.cwd.split('/').pop());
    const root = m.user==='root';
    return `<span class="${root?'pr':'pu'}">[${m.user}@${m.hostname}</span> <span class="pp">${esc(d)}</span><span class="${root?'pr':'pu'}">]${root?'#':'$'}</span> `;
  }
  prompt(){ this.ps.innerHTML = this.buf!=null ? '<span class="pu">&gt;</span> ' : this.promptStr(); }
  print(t, cls){ if (!t) return; const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = t; this.out.appendChild(s); this.out.scrollTop = this.out.scrollHeight; }
  printHTML(h){ const s=document.createElement('span'); s.innerHTML=h; this.out.appendChild(s); this.out.scrollTop=this.out.scrollHeight; }
  type(cmd){ this.inp.value = cmd; this.exec(); this.inp.focus({preventScroll:true}); }
  onKey(e){
    if (e.key==='Enter'){ e.preventDefault(); this.exec(); return; }
    if (e.key==='ArrowUp'){ e.preventDefault(); if (this.hi>0){ this.hi--; this.inp.value=this.hist[this.hi]||''; } return; }
    if (e.key==='ArrowDown'){ e.preventDefault(); if (this.hi<this.hist.length){ this.hi++; this.inp.value=this.hist[this.hi]||''; } return; }
    if (e.key==='Tab'){ e.preventDefault(); this.complete(); return; }
    if (e.ctrlKey && (e.key==='l'||e.key==='L')){ e.preventDefault(); this.out.innerHTML=''; return; }
    if (e.ctrlKey && (e.key==='c'||e.key==='C') && !window.getSelection().toString()){ e.preventDefault(); this.printHTML((this.buf!=null?'<span class="pu">&gt;</span> ':this.promptStr())+esc(this.inp.value)+'^C\n'); this.inp.value=''; this.buf=null; this.prompt(); return; }
  }
  complete(){
    const v = this.inp.value; const parts = v.split(/(\s+)/); const last = parts[parts.length-1]; const first = v.trim().indexOf(' ')<0;
    let cands = [];
    if (first){ const all = new Set([...Object.keys(CMDREF), 'help','clear','history','sudo','systemctl','journalctl','firewall-cmd','hostnamectl','getenforce','sestatus','restorecon','semanage','lsblk','blkid','pvs','vgs','lvs','uptime','free','whoami','nmcli','vim']); cands = [...all].filter(c=>c.startsWith(last)); }
    else {
      const prevWord = v.trim().split(/\s+/).slice(-2)[0];
      if (['systemctl'].includes(v.trim().split(/\s+/)[0]) && !last.includes('/')) { const svcs = Object.keys(this.m.svc).filter(k=>this.m.svc[k].installed); const subs=['status','start','stop','restart','reload','enable','disable','is-active','is-enabled','cat','daemon-reload','list-units']; cands = (v.trim().split(/\s+/).length<=1 || (v.trim().split(/\s+/).length===2 && !v.endsWith(' ')) ? subs : svcs).filter(c=>c.startsWith(last)); }
      if (!cands.length){
        const dir = last.includes('/') ? last.slice(0,last.lastIndexOf('/')+1) : '';
        const base = last.slice(dir.length);
        const dn = this.m.node(dir||'.');
        if (dn && dn.t==='d' && this.m.can(dn,4)) cands = Object.keys(dn.c).filter(k=>k.startsWith(base) && (base.startsWith('.')||!k.startsWith('.'))).map(k=>dir+k+(dn.c[k].t==='d'||(dn.c[k].t==='l'&&this.m.isDir((dir||'.')+'/'+k))?'/':''));
      }
    }
    if (cands.length===1){ parts[parts.length-1] = cands[0] + (cands[0].endsWith('/')?'':' '); this.inp.value = parts.join(''); }
    else if (cands.length>1){
      let pre = cands[0]; for (const c of cands) while (!c.startsWith(pre)) pre = pre.slice(0,-1);
      if (pre.length>last.length){ parts[parts.length-1]=pre; this.inp.value=parts.join(''); }
      else { this.printHTML(this.promptStr()+esc(v)+'\n'); this.print(cands.map(c=>c.split('/').filter(Boolean).pop()+(c.endsWith('/')?'/':'')).join('  ')+'\n'); }
    }
  }
  exec(block){
    let line = block!=null ? block : this.inp.value; if (block==null) this.inp.value='';
    if (block!=null){ const L = line.replace(/\n+$/,'').split('\n'); this.printHTML(this.promptStr()+esc(L[0])+'\n'+L.slice(1).map(x=>'<span class="pu">&gt;</span> '+esc(x)+'\n').join('')); }
    else this.printHTML((this.buf!=null ? '<span class="pu">&gt;</span> ' : this.promptStr())+esc(line)+'\n');
    if (block==null && this.m._incomplete){
      const full = this.buf!=null ? this.buf+'\n'+line : line;
      if (this.m._incomplete(full)){ this.buf = full; this.prompt(); return; }
      if (this.buf!=null){ line = full; this.buf = null; }
    }
    if (line.trim()){ this.hist.push(line.includes('\n') ? line.replace(/\n+$/,'') : line); }
    this.hi = this.hist.length;
    if (line.includes('\n') && this.m._runScript){ let r; try { if (!line.startsWith(' ')) this.m.history.push(line); r = this.m._runScript(line, this.m.posArgs||[], '-bash'); } catch(err){ r = {o:'', e:'interná chyba simulátora: '+err.message+'\n'}; } this.print(r.o); this.print(r.e,'e'); this.lastCmd = line; this.lastOut = ((r.o||'')+(r.e||'')).slice(0,3000); this.prompt(); if (this.opts.onRun) this.opts.onRun(this.m, line); return; }
    if (line.trim()==='exit' && !this.m.rootShell){ this.print('logout\n(v simulátore sa neodhlásiš, pokračuj ďalej)\n','hint'); this.prompt(); return; }
    if (line.trim()==='help'){ this.print(HELP_TEXT+'\n','hint'); this.prompt(); return; }
    let r;
    try { r = this.m.run(line); } catch(err){ r = {o:'', e:'interná chyba simulátora: '+err.message+'\n'}; }
    let o = r.o || '';
    const k = o.indexOf('\x1b');
    let special = null;
    if (k>=0){ special = o.slice(k+1); o = o.slice(0,k); }
    this.print(o); this.print(r.e,'e');
    this.lastCmd = line; this.lastOut = (o + (r.e||'')).slice(0,3000);
    if (special){
      const [kind, ...rest] = special.split(' '); const arg = rest.join(' ');
      if (kind==='CLEAR') this.out.innerHTML='';
      else if (kind==='MAN') this.print(manText(arg)+'\n');
      else if (kind==='HELP') this.print(HELP_TEXT+'\n','hint');
      else if (kind==='EDIT') this.openEditor(arg);
      else if (kind==='EDITR') this.openEditor(arg, null, true);
      else if (kind==='EDITCRON') this.openEditor(null, arg);
      else if (kind==='ASK') this.askInline(arg);
    }
    this.prompt();
    if (this.opts.onRun) this.opts.onRun(this.m, line);
  }
  async askInline(q){
    q = q.replace(/^["']|["']$/g,'');
    if (!q){ this.print('Použitie: c "otázka"   (RHEL Lightspeed asistent v RHEL 10; tu odpovedá Claude)\n','hint'); return; }
    if (!SAMPLE){ this.print('Asistent tu nie je dostupný. Na skutočnom RHEL 10: sudo dnf install command-line-assistant\n','hint'); return; }
    const span = document.createElement('span'); span.className='ai'; span.textContent='Premýšľam…'; this.out.appendChild(span);
    try { await askClaude(`${AI_FRAME}\n\nOtázka z terminálu RHEL ${this.ver}: ${q}`, t=>{ span.textContent=t; this.out.scrollTop=this.out.scrollHeight; }); }
    catch(e){ span.textContent = e && e.code==='not_granted' ? 'Bez povolenia sa Claude nespýtam.' : 'Claude teraz neodpovedá, skús neskôr.'; }
    this.out.appendChild(document.createTextNode('\n'));
  }
  async explainLast(){
    if (!this.lastCmd){ this.print('Najprv spusti nejaký príkaz.\n','hint'); return; }
    const span = document.createElement('span'); span.className='ai'; span.textContent='Claude číta výstup…'; this.out.appendChild(span); this.out.scrollTop=this.out.scrollHeight;
    try { await askClaude(`${AI_FRAME}\n\nVysvetli tento príkaz (každý prepínač) a čo znamená jeho výstup. Ak je vo výstupe chyba, povedz príčinu a ako ju opraviť.\n\nPríkaz: ${this.lastCmd}\nVýstup:\n${this.lastOut}`, t=>{ span.textContent=t; this.out.scrollTop=this.out.scrollHeight; }); }
    catch(e){ span.textContent = e && e.code==='not_granted' ? 'Bez povolenia sa Claude nespýtam.' : 'Claude teraz neodpovedá, skús neskôr.'; }
    this.out.appendChild(document.createTextNode('\n'));
  }
  recent(n=8){ return this.hist.slice(-n).join('\n'); }

  /* ----- vim overlay ----- */
  openEditor(path, cronUser, asRoot){
    const m = this.m;
    const realUser = m.user; if (asRoot) m.user = 'root';
    let text = '', name = path, readonly = false, isNew = false;
    if (cronUser!=null){ text = m.crontabs[cronUser]||''; name = '/tmp/crontab.'+cronUser; }
    else {
      if (!path){ path = ''; name = '[No Name]'; }
      const abs = path ? m.norm(path) : '';
      const n = abs ? m.node(abs) : null;
      if (n && n.t==='d'){ m.user = realUser; this.print(`"${path}" is a directory\n`,'e'); return; }
      if (n && !m.can(n,4)){ m.user = realUser; this.print(`"${path}" [Permission Denied]\n(skús sudo vim ${path})\n`,'e'); return; }
      if (n) { text = n.c; readonly = !m.can(n,2); }
      else { isNew = true; const [d] = m.parentOf(abs||'/x'); const dn = m.node(d); readonly = !!abs && (!dn || !m.can(dn,2)); }
      this.editPath = abs;
    }
    m.user = realUser;
    const ov = document.createElement('div'); ov.className='overlay';
    ov.innerHTML = `<div class="otop"><span>${asRoot?'sudo ':''}vim ${esc(name)}${readonly?' [readonly]':''}</span><span>Esc · :wq uložiť a odísť · :q! bez uloženia</span></div><div class="vimbox" tabindex="0"></div><div class="otop"><span class="seg"><button type="button" data-k="Escape">Esc</button><button type="button" data-k=":wq">:wq</button><button type="button" data-k=":q!">:q!</button></span></div>`;
    $('.term', this.el).appendChild(ov);
    const box = $('.vimbox', ov);
    const v = new Vim(text, {name, readonly, onWrite:(t, sudo)=>{
      if (cronUser!=null){ m.crontabs[cronUser] = t.trim()?t:''; return {}; }
      if (!this.editPath) return {error:'E32: No file name'};
      const prev = m.user; if (sudo || asRoot) m.user='root';
      const err = m._writeFile(this.editPath, t, false);
      m.user = prev;
      if (err) return {error:`E212: Can't open file for writing`+(sudo?'':' (otvor súbor cez sudo vim)')};
      return {};
    }, onQuit:()=>{ setTimeout(()=>{ this.closeEditor(); if (cronUser!=null && v.everSaved) this.print('crontab: installing new crontab\n'); if (this.opts.onRun) this.opts.onRun(m, 'vim'); this.prompt(); }, 0); }});
    this.vim = v; this.ov = ov;
    bindVim(box, v, ()=>{});
    ov.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click', ()=>{ const k=b.dataset.k; if (k==='Escape') v.key('Escape'); else { v.key('Escape'); for (const ch of k) v.key(ch); v.key('Enter'); } box.dispatchEvent(new Event('rerender')); box.focus(); }));
    setTimeout(()=>box.focus(), 0);
  }
  closeEditor(){ if (this.ov){ this.ov.remove(); this.ov=null; this.vim=null; this.inp.focus({preventScroll:true}); } }
}

/* bind keyboard (desktop + mobile) to a Vim instance and render into box */
function bindVim(box, v, after, rows){
  const ta = document.createElement('textarea'); ta.setAttribute('aria-label','Vstup editora'); ta.autocapitalize='off'; ta.spellcheck=false;
  ta.style.cssText = 'position:absolute;opacity:0;left:0;top:0;width:1px;height:1px;border:0;padding:0;resize:none';
  box.innerHTML = '';
  const vin = document.createElement('div'); vin.className='vin';
  const hint = document.createElement('div'); hint.className='vim-hint'; hint.textContent='Klikni sem a píš';
  box.append(vin, hint, ta);
  const draw = ()=>{ vin.innerHTML = v.render(rows||16); };
  draw();
  box.addEventListener('rerender', ()=>{ draw(); after && after(); });
  box.addEventListener('mousedown', e=>{ e.preventDefault(); ta.focus({preventScroll:true}); });
  box.addEventListener('focus', ()=>ta.focus({preventScroll:true}));
  ta.addEventListener('focus', ()=>box.classList.add('focus'));
  const SPECIAL = ['Escape','Enter','Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab'];
  ta.addEventListener('keydown', e=>{
    if (e.metaKey || e.altKey) return;
    if (e.ctrlKey && ['c','v','x','a'].includes(e.key) && v.mode==='i' && e.key!=='c') return;
    if (SPECIAL.includes(e.key) || (e.key.length===1 && !e.isComposing) || (e.ctrlKey && e.key.length===1)){
      e.preventDefault(); v.key(e.key, e.ctrlKey); log(e.ctrlKey?'Ctrl+'+e.key:e.key); draw(); after && after();
    }
  });
  ta.addEventListener('input', ()=>{ const d = ta.value; ta.value=''; for (const ch of d){ v.key(ch); log(ch); } draw(); after && after(); });
  ta.addEventListener('paste', e=>{ e.preventDefault(); const t=(e.clipboardData||{getData:()=>''}).getData('text'); for (const ch of t) v.key(ch==='\n'?'Enter':ch); draw(); after && after(); });
  function log(k){ if (box._log) box._log(k); }
  box.style.position='relative';
  return {draw, focus:()=>ta.focus({preventScroll:true})};
}
