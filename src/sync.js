/* =========================================================
   SYNCHRONIZÁCIA POKROKU cez súkromný GitHub Gist
   - token a id gistu sú len v tomto prehliadači (nie v exporte)
   - pri otvorení a návrate do okna: stiahne; po zmene: odošle
   - konflikt (zmeny na oboch zariadeniach): zlúči
   ========================================================= */
(function(){
'use strict';
const SKEY = 'rhel-v-praxi-sync';
const FILE = 'rhel-v-praxi-pokrok.json';
const API = 'https://api.github.com';
const canSync = location.protocol==='file:' || !window.claude;
let cfg = {};
try { cfg = JSON.parse(localStorage.getItem(SKEY)||'{}') || {}; } catch(e){ cfg = {}; }
const saveCfg = ()=>{ try { localStorage.setItem(SKEY, JSON.stringify(cfg)); } catch(e){} };
let status = cfg.token ? 'Pripravené' : '';
let busy = false, again = false, timer = null;
const listeners = new Set();
const setStatus = (t, err)=>{ status = t; listeners.forEach(f=>f(t, err)); };

/* každá zmena pokroku dostane čas a príznak „neodoslané“ */
const localSave = save;
save = function(){
  S._t = Date.now();
  localSave();
  if (cfg.token && cfg.gist){ cfg.dirty = true; saveCfg(); schedule(2500); }
};

function hdr(){ return {'Authorization':'Bearer '+cfg.token, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'}; }
async function gh(path, opt){
  const r = await fetch(API+path, Object.assign({headers: hdr(), cache:'no-store'}, opt||{}));
  if (r.status===401) throw new Error('Token je neplatný alebo vypršal. Vytvor nový a pripoj ho znova.');
  if (r.status===403 || r.status===404) throw new Error('Token nemá právo na Gisty (pri tvorbe tokenu zaškrtni „gist“).');
  if (!r.ok) throw new Error('GitHub odpovedal chybou '+r.status+'.');
  return r.json();
}
const snapshot = ()=>JSON.stringify(S);
async function readRemote(){
  const g = await gh('/gists/'+cfg.gist);
  const f = g.files && g.files[FILE];
  if (!f) return null;
  let txt = f.content;
  if (f.truncated && f.raw_url){ txt = await (await fetch(f.raw_url, {cache:'no-store'})).text(); }
  try { return JSON.parse(txt); } catch(e){ return null; }
}
const newRev = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
let verifyT = null;
async function writeRemote(){
  S._rev = newRev(); localSave();
  const body = JSON.stringify({files:{[FILE]:{content: snapshot()}}});
  await gh('/gists/'+cfg.gist, {method:'PATCH', body, headers: Object.assign(hdr(), {'Content-Type':'application/json'})});
  cfg.lastRev = S._rev; cfg.dirty = false; cfg.when = Date.now(); saveCfg();
  /* kontrola: neprepísalo nás o chvíľu iné zariadenie? ak áno, zlúčime */
  const mine = S._rev; clearTimeout(verifyT);
  verifyT = setTimeout(async ()=>{ try { const R = await readRemote(); if (R && R._rev!==mine && cfg.lastRev===mine){ cfg.dirty = true; saveCfg(); sync(); } } catch(e){} }, 2500);
}

/* zlúčenie: true vyhráva, čísla max, objekty rekurzívne, inak novšia strana */
function merge(a, b, bNewer){
  if (a===undefined) return b; if (b===undefined) return a;
  if (Array.isArray(a) && Array.isArray(b)){ const seen = new Set(), out = []; for (const x of a.concat(b)){ const k = JSON.stringify(x); if (!seen.has(k)){ seen.add(k); out.push(x); } } return out; }
  if (a && b && typeof a==='object' && typeof b==='object'){ const o = {}; for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) o[k] = merge(a[k], b[k], bNewer); return o; }
  if (typeof a==='boolean' && typeof b==='boolean') return a||b;
  if (typeof a==='number' && typeof b==='number') return Math.max(a,b);
  return bNewer ? b : a;
}
function applyState(o){
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, {read:{},quiz:{},ex:{},vim:{},wrong:{},inc:{},exam:{}}, o);
  localSave();
}
function refreshView(){
  const a = document.activeElement;
  if (a && (/INPUT|TEXTAREA/.test(a.tagName)) && !a.closest('.sync')) { setStatus('Pokrok z iného zariadenia načítaný (zobrazí sa po prechode na inú stránku).'); return; }
  try { buildRail(); } catch(e){}
  route();
}

async function sync(){
  if (!cfg.token || !cfg.gist) return;
  if (busy){ again = true; return; }
  busy = true; setStatus('Synchronizujem…');
  try {
    const R = await readRemote();
    const rt = R && R._t || 0;
    if (R && R._rev !== cfg.lastRev){
      if (cfg.dirty){
        const merged = merge(S, R, rt > (S._t||0));
        merged._t = Date.now();
        applyState(merged); await writeRemote(); refreshView();
        setStatus('Zlúčené so zmenami z iného zariadenia ✓');
      } else {
        applyState(R); cfg.lastRev = R._rev; cfg.when = Date.now(); saveCfg(); refreshView();
        setStatus('Načítané z iného zariadenia ✓');
      }
    } else if (cfg.dirty || !R){
      await writeRemote(); setStatus('Uložené ✓');
    } else { cfg.when = Date.now(); saveCfg(); setStatus('Aktuálne ✓'); }
  } catch(e){
    setStatus(navigator.onLine===false ? 'Offline – odošle sa, keď budeš online.' : e.message, true);
  } finally {
    busy = false;
    if (again){ again = false; schedule(500); }
  }
}
function schedule(ms){ clearTimeout(timer); timer = setTimeout(sync, ms); }

async function connect(token){
  cfg = {token: token.trim()}; saveCfg();
  setStatus('Pripájam…');
  const me = await gh('/user');
  let gist = null;
  for (let page=1; page<=5 && !gist; page++){
    const list = await gh('/gists?per_page=100&page='+page);
    gist = list.find(g=>g.files && g.files[FILE]);
    if (list.length<100) break;
  }
  if (gist){
    cfg.gist = gist.id; cfg.login = me.login; cfg.lastRev = null;
    cfg.dirty = !!(S._t || Object.keys(S.read||{}).length); saveCfg();
    await sync();
  } else {
    S._t = S._t || Date.now(); S._rev = newRev(); localSave();
    const g = await gh('/gists', {method:'POST', headers: Object.assign(hdr(), {'Content-Type':'application/json'}), body: JSON.stringify({description:'RHEL v praxi – pokrok (synchronizácia)', public:false, files:{[FILE]:{content: snapshot()}}})});
    cfg.gist = g.id; cfg.login = me.login; cfg.lastRev = S._rev; cfg.dirty = false; cfg.when = Date.now(); saveCfg();
    setStatus('Pripojené, pokrok uložený ✓');
  }
}
function disconnect(){ cfg = {}; try { localStorage.removeItem(SKEY); } catch(e){} setStatus(''); }

/* rýchle odoslanie pri zatvorení / prepnutí aplikácie */
document.addEventListener('visibilitychange', ()=>{
  if (!cfg.token || !cfg.gist) return;
  if (document.visibilityState==='hidden' && cfg.dirty){
    const rev = newRev(); S._rev = rev; localSave();
    const body = JSON.stringify({files:{[FILE]:{content: snapshot()}}});
    if (body.length < 60000){
      try { fetch(API+'/gists/'+cfg.gist, {method:'PATCH', keepalive:true, body, headers: Object.assign(hdr(), {'Content-Type':'application/json'})}).then(r=>{ if (r.ok){ cfg.lastRev = rev; cfg.dirty=false; cfg.when=Date.now(); saveCfg(); } }).catch(()=>{}); } catch(e){}
    }
  } else if (document.visibilityState==='visible') schedule(300);
});
window.addEventListener('online', ()=>schedule(300));
window.addEventListener('focus', ()=>{ if (cfg.when && Date.now()-cfg.when > 20000) schedule(300); });

/* ---------- karta na úvodnej stránke ---------- */
const ago = t=>{ if (!t) return 'ešte nie'; const s = Math.round((Date.now()-t)/1000); if (s<60) return 'pred chvíľou'; if (s<3600) return 'pred '+Math.round(s/60)+' min'; if (s<86400) return 'pred '+Math.round(s/3600)+' h'; return new Date(t).toLocaleDateString('sk-SK'); };
function syncBox(){
  const s = document.createElement('section'); s.className = 'sync backup';
  const draw = ()=>{
    if (cfg.token && cfg.gist){
      s.innerHTML = `<div class="sect-h"><h2>Synchronizácia pokroku</h2><p>Pokrok sa ukladá do tvojho súkromného GitHub Gistu a zdieľa medzi zariadeniami.</p></div>
      <div class="box"><p><span class="sdot ok" aria-hidden="true"></span> Pripojené ako <b>${esc(cfg.login||'?')}</b> · posledná synchronizácia ${ago(cfg.when)}</p>
      <p class="sub2" id="syStat" role="status">${esc(status)}</p>
      <div class="acts"><button class="btn pri sm" type="button" id="syNow">Synchronizovať teraz</button><button class="btn sm" type="button" id="syOff">Odpojiť toto zariadenie</button></div></div>`;
      s.querySelector('#syNow').addEventListener('click', ()=>sync().then(draw));
      s.querySelector('#syOff').addEventListener('click', ()=>{ disconnect(); draw(); });
    } else {
      s.innerHTML = `<div class="sect-h"><h2>Synchronizácia pokroku</h2><p>Chceš rovnaký pokrok na Macu aj na iPhone? Pripoj GitHub token (stačí raz na každom zariadení).</p></div>
      <div class="box">
        <ol class="sub2 syl"><li>Otvor <a href="https://github.com/settings/tokens/new?scopes=gist&amp;description=RHEL%20v%20praxi" target="_blank" rel="noopener">vytvorenie tokenu na GitHube</a> (právo <b>gist</b> je už zaškrtnuté).</li><li>Expiration: zvoľ <b>No expiration</b> alebo 1 rok, dole klikni <b>Generate token</b>.</li><li>Skopíruj token (začína <code>ghp_</code>) a vlož ho sem. Na druhom zariadení vlož ten istý token.</li></ol>
        <div class="acts"><input id="syTok" type="password" autocomplete="off" spellcheck="false" placeholder="ghp_…" aria-label="GitHub token" style="flex:1;min-width:180px"><button class="btn pri sm" type="button" id="syGo">Pripojiť</button></div>
        <p class="sub2" id="syStat" role="status">${esc(status)}</p>
      </div>`;
      s.querySelector('#syGo').addEventListener('click', async ()=>{
        const t = s.querySelector('#syTok').value.trim();
        if (!/^(ghp_|github_pat_)\w+/.test(t)){ setStatus('Toto nevyzerá ako GitHub token (začína ghp_).', true); return; }
        try { await connect(t); } catch(e){ cfg = {}; saveCfg(); setStatus(e.message, true); }
        draw();
      });
    }
  };
  const on = (t, err)=>{ const el = s.querySelector('#syStat'); if (el){ el.textContent = t; el.classList.toggle('err', !!err); } };
  listeners.add(on);
  draw();
  return s;
}
if (canSync){
  const _hv = homeView;
  homeView = function(){ const v = _hv(); const bk = v.querySelector('section.backup'); const sb = syncBox(); if (bk) v.insertBefore(sb, bk); else v.appendChild(sb); return v; };
  if (cfg.token && cfg.gist) schedule(200);
  if (location.hash==='' || location.hash==='#uvod') route();
}
window.__rhelSync = {merge, sync, cfg:()=>cfg};
})();
