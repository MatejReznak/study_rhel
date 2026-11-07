/* =========================================================
   Rozlúštiť: celý skript po riadkoch
   (zhrnutie: argumenty, premenné, funkcie, čo mení, kam loguje, exit kódy)
   ========================================================= */
(function(){
const E = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const C = s => `<code>${E(s)}</code>`;
const short = (t, n=90) => { t = String(t||'').replace(/<[^>]+>/g,''); return t.length > n ? t.slice(0, n-1)+'…' : t; };

/* rozdelenie riadku na príkazy (rovnaké pravidlá ako simulátor) */
const stmtsOf = line => {
  try { return window.Machine.prototype._scriptStmts.call({_hd:{}}, line).map(x=>x.s); }
  catch(e){ return [line.trim()]; }
};
const words = s => { try { return (typeof splitTokens==='function' ? splitTokens(s) : s.split(/\s+/)).filter(Boolean); } catch(e){ return s.split(/\s+/); } };
const oneWord = v => { let d=0, q=null; for (let i=0;i<v.length;i++){ const c=v[i]; if (q){ if (c===q) q=null; else if (c==='\\') i++; continue; } if (c==='\\'){ i++; continue; } if (c==='"'||c==="'"){ q=c; continue; } if (c==='$' && (v[i+1]==='{'||v[i+1]==='(')){ d++; i++; continue; } if ((c==='}'||c===')') && d>0){ d--; continue; } if (/\s/.test(c) && d===0) return false; } return true; };
const mask = s => s.replace(/\[\[.*?\]\]|\(\(.*?\)\)|\$\(.*?\)|<\(.*?\)|"[^"]*"|'[^']*'/g, x=>x.replace(/[|&<>;]/g,'_'));
const unq = s => String(s||'').replace(/^["']|["']$/g,'');

/* podmienky [ ] / [[ ]] / príkaz */
const TESTS = {'-f':'súbor %s existuje','-d':'adresár %s existuje','-e':'%s existuje','-s':'súbor %s existuje a nie je prázdny','-r':'%s sa dá čítať','-w':'do %s sa dá zapisovať','-x':'%s sa dá spustiť','-L':'%s je symbolický odkaz','-z':'%s je prázdne','-n':'%s nie je prázdne'};
const NUM = {'-eq':'=','-ne':'≠','-gt':'>','-lt':'<','-ge':'≥','-le':'≤'};
function condText(c){
  c = c.trim().replace(/;\s*then$/,'').replace(/\s+then$/,'');
  let neg = false;
  if (/^!\s+/.test(c)){ neg = true; c = c.replace(/^!\s+/,''); }
  const m = c.match(/^\[\[?\s*(.*?)\s*\]?\]$/);
  if (m){
    const parts = m[1].split(/\s+(&&|\|\||-a|-o)\s+/);
    const out = [];
    for (let i=0;i<parts.length;i++){
      const p = parts[i];
      if (p==='&&' || p==='-a'){ out.push('a zároveň'); continue; }
      if (p==='||' || p==='-o'){ out.push('alebo'); continue; }
      const w = words(p); let n = false; if (w[0]==='!'){ n = true; w.shift(); }
      let t = '';
      if (w.length===2 && TESTS[w[0]]) t = TESTS[w[0]].replace('%s', C(unq(w[1])));
      else if (w.length===3 && NUM[w[1]]) t = `${C(unq(w[0]))} ${NUM[w[1]]} ${C(unq(w[2]))} (čísla)`;
      else if (w.length===3 && (w[1]==='=' || w[1]==='==')) t = /[*?]/.test(w[2]) && !/^["']/.test(w[2]) ? `${C(unq(w[0]))} zodpovedá vzoru ${C(w[2])}` : `${C(unq(w[0]))} sa rovná ${C(unq(w[2]))}`;
      else if (w.length===3 && w[1]==='!=') t = `${C(unq(w[0]))} sa nerovná ${C(unq(w[2]))}`;
      else if (w.length===3 && w[1]==='=~') t = `${C(unq(w[0]))} zodpovedá regulárnemu výrazu ${C(w[2])}`;
      else t = C(p);
      out.push((n?'NEPLATÍ: ':'') + t);
    }
    return (neg?'NEPLATÍ: ':'') + out.join(' ');
  }
  const a = c.match(/^\(\((.*)\)\)$/); if (a) return `aritmetická podmienka ${C(a[1].trim())} platí`;
  const cmd = words(c).filter(x=>x!=='sudo')[0] || '';
  const r = window.CMDREF && CMDREF[cmd];
  return `${neg?'príkaz NEuspeje':'príkaz uspeje (kód 0)'}: ${C(c)}${r ? ' ('+E(short(r.d,70))+')' : ''}`;
}

/* nebezpečné / meniace príkazy */
const CHANGE = [
 [/(^|\s)rm\s/, 'maže súbory'], [/(^|\s)mv\s/, 'presúva/premenúva'], [/(^|\s)sed\s+(-\w*i|-i)/, 'mení súbor na mieste (sed -i)'],
 [/(^|\s)(useradd|userdel|usermod|groupadd|passwd|chpasswd)\b/, 'mení používateľov'], [/(^|\s)systemctl\s+(start|stop|restart|reload|enable|disable|mask|kill)\b/, 'mení služby'],
 [/(^|\s)(dnf|yum|rpm)\s+(install|remove|erase|update|upgrade|-i|-e|-U)/, 'inštaluje/odstraňuje balíky'], [/(^|\s)(chmod|chown|chgrp|setfacl|chcon|restorecon)\b/, 'mení práva/vlastníka/kontext'],
 [/(^|\s)(reboot|shutdown|poweroff)\b/, 'reštartuje/vypína server'], [/(^|\s)(kill|pkill|killall)\b/, 'ukončuje procesy'], [/(^|\s)find\b.*-(delete|exec\s+rm)/, 'maže nájdené súbory'],
 [/(^|\s)(mkfs|fdisk|parted|lvremove|lvextend|lvcreate|vgextend|pvcreate|wipefs|dd)\b/, 'mení disky'], [/(^|\s)(firewall-cmd|iptables|nft)\b.*(--add|--remove|-I|-A|-D|-F|add|delete)/, 'mení firewall'],
 [/(^|\s)(setenforce|setsebool|semanage)\b/, 'mení SELinux'], [/(^|\s)(crontab)\s+(-r|-e|\S+$)/, 'mení cron'], [/curl[^|]*\|\s*(sudo\s+)?(ba)?sh/, 'SŤAHUJE A SPÚŠŤA kód z internetu'],
 [/(^|[^0-9&])>\s*(?!\/dev\/null|&)\S/, 'prepíše súbor (>)'], [/>>\s*(?!\/dev\/null)\S/, 'pripíše do súboru (>>)'], [/(^|\s)(tee)\s/, 'zapisuje do súboru (tee)'], [/(^|\s)mkdir\b/, 'vytvára adresár'], [/(^|\s)(cp|rsync|tar\s+-?\w*[cx])\b/, 'kopíruje/zapisuje súbory']
];
const changes = s => { const t = s.replace(/'[^']*'/g,"''").replace(/\(\(.*?\)\)|\[\[.*?\]\]|\[\s.*?\s\]/g,'(( ))').replace(/"[^"]*"/g, x=>x.replace(/[>|]/g,'_')); return CHANGE.filter(([re])=>re.test(t)).map(x=>x[1]); };

/* vysvetlenie jedného príkazu (nie riadiacej štruktúry) */
function cmdText(s, fns){
  let w = words(s); const pre = [];
  if (w[0]==='sudo'){ pre.push('ako root:'); w = w.slice(1); }
  while (w[0] && /^[A-Za-z_]\w*=/.test(w[0]) && w.length>1){ pre.push(`s ${C(w[0])}`); w = w.slice(1); }
  const cmd = w[0] || '';
  if (fns.has(cmd)) return `${pre.join(' ')} zavolá funkciu ${C(cmd)}${w.length>1?' s argumentmi '+C(w.slice(1).join(' ')):''}`;
  const r = window.CMDREF && CMDREF[cmd];
  let t = r ? `${C(cmd)}: ${E(short(r.d, 80))}` : `príkaz ${C(cmd)}`;
  try {
    if (r && typeof explainData==='function'){
      const rows = explainData(s.replace(/^sudo\s+/,'')).rows.filter(x=>x.c==='flag' && !x.unk && x.k!=='|');
      if (rows.length) t += ' — ' + rows.slice(0,4).map(x=>`${C(x.k)} ${E(short(x.v, 50))}`).join('; ');
    }
  } catch(e){}
  if (/\|/.test(s.replace(/\|\||'[^']*'|"[^"]*"/g,''))){ const segs = s.split(/\s\|\s/).slice(1).map(x=>words(x)[0]).filter(Boolean); if (segs.length) t += `; výstup ide ďalej do ${segs.map(C).join(', ')}`; }
  if (/2>&1/.test(s)) t += '; chyby idú tam, kam výstup';
  if (/&>\s*\/dev\/null|>\s*\/dev\/null\s+2>&1/.test(s)) t += '; výstup aj chyby zahodí';
  else if (/2>\s*\/dev\/null/.test(s)) t += '; chyby zahodí';
  else if (/(^|\s)>\s*\/dev\/null/.test(s)) t += '; výstup zahodí';
  if (/>&2\b/.test(s)) t += '; vypíše na chybový výstup';
  const mo = s.match(/(^|[^0-9&>])>>?\s*("[^"]*"|[^\s&]\S*)/); if (mo && !/\/dev\/null/.test(mo[2])) t += `; výstup ${/>>/.test(mo[0])?'pripíše do':'zapíše (prepíše) do'} ${C(mo[2])}`;
  return (pre.length ? pre.join(' ')+' ' : '') + t;
}

/* jeden príkaz (aj riadiaci) → text */
function stmtText(s, st, fns){
  let m;
  if (/^#!/.test(s)) return `shebang: skript spustí ${C(s.slice(2).trim())}${/\/sh$/.test(s)?' (POSIX sh: bez [[ ]], polí a ďalších vecí z bashu)':''}`;
  if (s==='then') return null; if (s==='do') return null;
  if ((m = s.match(/^(if|elif)\s+(.+)$/))) return `${m[1]==='if'?'<b>ak</b>':'<b>inak, ak</b>'} ${condText(m[2])}`;
  if (s==='else') return '<b>inak</b> (keď žiadna podmienka neplatila)';
  if (s==='fi') return 'koniec podmienky if';
  if ((m = s.match(/^for\s*\(\((.*)\)\)$/))) return `cyklus v štýle C: ${C(m[1])}`;
  if ((m = s.match(/^for\s+(\w+)\s+in\s+(.+)$/))) return `<b>cyklus</b>: pre každú položku z ${C(m[2])} ulož ju do ${C('$'+m[1])} a vykonaj telo`;
  if ((m = s.match(/^for\s+(\w+)$/))) return `<b>cyklus</b> cez všetky argumenty skriptu, každý do ${C('$'+m[1])}`;
  if ((m = s.match(/^(?:(.+?)\s*\|\s*)?while\s+(.+)$/))){
    const c = m[2];
    const rd = c.match(/^(?:IFS=(\S*)\s+)?read\s+(.*)$/);
    if (rd){ const vars = words(rd[2]).filter(x=>!x.startsWith('-')); st.readLoop = true; return `<b>cyklus po riadkoch</b>${m[1]?` výstupu ${C(m[1])} (pozor: za rúrou sa zmeny premenných po cykle stratia)`:''}: každý riadok rozdeľ${rd[1]!=null?` podľa ${C(unq(rd[1])||'(nič)')}`:' podľa medzier'} do ${vars.map(v=>C('$'+v)).join(', ')||C('$REPLY')}${/-r/.test(rd[2])?' (-r: \\ ber doslova)':''}`; }
    return `<b>opakuj, kým</b> ${condText(c)}`;
  }
  if ((m = s.match(/^until\s+(.+)$/))) return `<b>opakuj, kým NEplatí</b>: ${condText(m[1])}`;
  if ((m = s.match(/^done\b(.*)$/))){ const t = m[1].trim(); let x = 'koniec cyklu'; const i = t.match(/<\s*<\((.*)\)/) || t.match(/<\s*(\S+)/); if (i) x += `; vstup cyklu: ${/<\s*</.test(t)?'výstup príkazu '+C(i[1]):'súbor '+C(i[1])}`; const o = t.match(/(>>?)\s*(\S+)/); if (o && !/^</.test(o[0])) x += `; výstup celého cyklu ${o[1]==='>>'?'pripíše do':'zapíše do'} ${C(o[2])}`; const p = t.replace(/<\(.*\)/,'').match(/\|\s*(.+)$/); if (p) x += `; výstup celého cyklu ide do ${C(p[1])}`; return x; }
  if ((m = s.match(/^case\s+(.+?)\s+in$/))) return `<b>podľa hodnoty</b> ${C(m[1])} vyber vetvu:`;
  if ((m = s.match(/^\(?\s*([^()$]+?)\s*\)\s*(.*)$/)) && st.inCase){ const p = m[1].split('|').map(x=>x.trim()); const lead = p.includes('*') ? 'inak (čokoľvek iné)' : `ak je ${p.map(x=>C(x)).join(' alebo ')}`; return `vetva: ${lead}${m[2] ? ' → '+stmtText(m[2].replace(/\s*;;$/,''), st, fns) : ''}`; }
  if (s===';;') return 'koniec vetvy';
  if (s==='esac') return 'koniec case';
  if ((m = s.match(/^(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{?\s*(.*?)\s*\}?$/)) && /\(\)|^function/.test(s)){ fns.add(m[1]); return `<b>funkcia ${C(m[1])}</b>${m[2]?': '+E(short(m[2],60)):''}. Spustí sa až pri zavolaní ${C(m[1])}; argumenty v nej sú $1, $2…`; }
  if (s==='{') return 'začiatok bloku';
  if (s==='}') return 'koniec funkcie / bloku';
  if ((m = s.match(/^set\s+(.+)$/))){ const f = []; const a = m[1]; if (/-\w*e/.test(a)) f.push('skonči pri chybe (-e)'); if (/-\w*u/.test(a)) f.push('nedefinovaná premenná = chyba (-u)'); if (/pipefail/.test(a)) f.push('rúra zlyhá, ak zlyhá ktorýkoľvek jej príkaz'); if (/-\w*x/.test(a)) f.push('vypisuj príkazy (-x)'); if (/\+x/.test(a)) f.push('vypni vypisovanie'); return '<b>nastavenie shellu</b>: '+(f.join(', ')||C(a)); }
  if ((m = s.match(/^exit\s*(\S*)/))) return `<b>koniec skriptu</b> s kódom ${C(m[1]||'$?')}${m[1]==='0'?' (úspech)':m[1]==='2'?' (zvyčajne zlé použitie)':/^\d+$/.test(m[1])?' (chyba)':m[1]?' (hodnota premennej)':' (kód posledného príkazu)'}`;
  if ((m = s.match(/^return\s*(\S*)/))) return `návrat z funkcie s kódom ${C(m[1]||'$?')}`;
  if (s==='continue') return 'preskoč na ďalšie opakovanie cyklu';
  if (s==='break') return 'ukonči cyklus';
  if ((m = s.match(/^shift\s*(.*)$/))) return `posuň argumenty${m[1]?' o '+C(m[1]):''}: $2 sa stane $1`;
  if ((m = s.match(/^getopts\s+(\S+)\s+(\w+)/))) return `spracuj ďalší prepínač (povolené ${C(unq(m[1]))}; dvojbodka = s hodnotou v $OPTARG) do ${C('$'+m[2])}`;
  if ((m = s.match(/^trap\s+(.+?)\s+(\S+(?:\s+\S+)*)$/))) return `pri ${C(m[2])} vykonaj ${C(unq(m[1]))}${/EXIT/.test(m[2])?' (aj keď skript skončí chybou: upratovanie)':''}`;
  if ((m = s.match(/^local\s+(.+)$/))) return `premenná ${C(m[1].split('=')[0])} platí len v tejto funkcii${/=/.test(m[1])?', hodnota '+C(m[1].split('=').slice(1).join('=')):''}`;
  if ((m = s.match(/^(?:source|\.)\s+(\S+)/))) return `načítaj premenné a funkcie zo súboru ${C(m[1])}`;
  if ((m = s.match(/^(?:IFS=\S*\s+)?read\s+(.*)$/))){ const p = s.match(/-p\s+("[^"]*"|'[^']*'|\S+)/); const vars = words(m[1].replace(/-p\s+("[^"]*"|'[^']*'|\S+)/,'')).filter(x=>!x.startsWith('-')); return `načítaj vstup${p?' (otázka '+C(unq(p[1]))+')':''} do ${vars.map(v=>C('$'+v)).join(', ')||C('$REPLY')}`; }
  if ((m = s.match(/^\(\((.+)\)\)$/))) return `aritmetika: ${C(m[1].trim())}`;
  if ((m = s.match(/^(?:readonly\s+|declare\s+-\w+\s+)?([A-Za-z_]\w*)(\+?)=\((.*)\)$/))) return `pole ${C(m[1])}${m[2]?' rozšír o':' ='} ${C('('+m[3]+')')}`;
  if ((m = s.match(/^(?:readonly\s+|export\s+|declare\s+-\w+\s+)?([A-Za-z_]\w*)=(.*)$/)) && !/\s(&&|\|\|)\s/.test(mask(s)) && oneWord(m[2])){
    const n = m[1], v = m[2]; st.vars.push([n, v]);
    let d = `premenná ${C(n)} = ${C(v||'(prázdna)')}`;
    let k;
    if ((k = v.match(/^"?\$\{(\d)(:?[-=])([^}]*)\}"?$/))) d = `premenná ${C(n)} = ${k[1]}. argument, ak chýba tak ${C(k[3])}`;
    else if ((k = v.match(/^"?\$\{(\d):?\?([^}]*)\}"?$/))) d = `premenná ${C(n)} = ${k[1]}. argument, <b>povinný</b>: ak chýba, vypíše ${C(k[2]||'chybu')} a skript skončí`;
    else if ((k = v.match(/^"?\$\{(\w+)##\*\/\}"?$/))) d = `premenná ${C(n)} = meno súboru z ${C('$'+k[1])} bez cesty`;
    else if ((k = v.match(/^"?\$\{(\w+)%\/\*\}"?$/))) d = `premenná ${C(n)} = adresár z ${C('$'+k[1])} (bez mena súboru)`;
    else if ((k = v.match(/^"?\$\{(\w+)%([^}]*)\}"?$/))) d = `premenná ${C(n)} = ${C('$'+k[1])} bez ${C(k[2])} na konci`;
    else if ((k = v.match(/^"?\$\{(\w+)#([^}]*)\}"?$/))) d = `premenná ${C(n)} = ${C('$'+k[1])} bez ${C(k[2])} na začiatku`;
    else if ((k = v.match(/^"?\$\((.*)\)"?$/))) d = `premenná ${C(n)} = výstup príkazu ${C(k[1])}`+(window.CMDREF && CMDREF[words(k[1])[0]] ? ' ('+E(short(CMDREF[words(k[1])[0]].d,60))+')':'');
    else if ((k = v.match(/^"?\$\(\((.*)\)\)"?$/))) d = `premenná ${C(n)} = výsledok výpočtu ${C(k[1])}`;
    if (/^readonly/.test(s)) d += ' (nemenná)'; if (/^export/.test(s)) d += ' (exportovaná aj pre spustené programy)';
    return d;
  }
  // a && b / a || b / [ ] && …
  const ms = mask(s); const mi = ms.search(/\s(&&|\|\|)\s/);
  const ch = mi>0 ? [null, s.slice(0, mi).trim(), ms.slice(mi+1, mi+3), s.slice(mi+4).trim()] : null;
  if (ch){
    const g = ch[3].match(/^\{\s*(.*?);?\s*\}$/);
    const right = g ? g[1].split(/;\s*/).map(x=>stmtText(x.trim(), st, fns)).filter(Boolean).join(', potom ') : stmtText(ch[3], st, fns);
    const left = /^\[|^\(\(/.test(ch[1]) ? condText(ch[1]) : cmdText(ch[1], fns);
    return ch[2]==='&&' ? `ak ${left} → ${right}` : `${left}; ak to <b>neplatí / zlyhá</b> → ${right}`;
  }
  if (/^\[\[?\s/.test(s)) return 'test: '+condText(s);
  return cmdText(s, fns);
}

window.explainScript = function(text){
  const lines = text.replace(/\r/g,'').replace(/\n+$/,'').split('\n');
  const st = {vars:[], inCase:false, readLoop:false};
  const fns = new Set();
  const rows = []; let hd = null;
  const sum = {args:new Set(), mods:[], logs:new Set(), exits:new Set(), fns:[], set:'', reads:new Set(), shebang:''};
  lines.forEach((line, i)=>{
    const ln = i+1; const t = line.trim();
    if (hd){ if (t===hd){ rows.push([ln, line, 'koniec textu heredocu', '']); hd = null; } else rows.push([ln, line, 'text, ktorý ide na vstup príkazu (heredoc)', '']); return; }
    if (!t){ rows.push([ln, line, '', '']); return; }
    if (/^#!/.test(t)){ sum.shebang = t; rows.push([ln, line, stmtText(t, st, fns), '']); return; }
    if (/^#/.test(t)){ rows.push([ln, line, '<span class="sh-com">komentár</span>'+(/použitie|usage/i.test(t)?': <b>ako skript spustiť</b>':''), '']); return; }
    const h = t.match(/<<-?\s*['"]?(\w+)['"]?/); if (h && !/<<</.test(t)) hd = h[1];
    // argumenty
    (t.match(/\$\{?([1-9])\b|\$\{([1-9])[:}]/g)||[]).forEach(x=>sum.args.add(x.replace(/\D/g,'')));
    if (/getopts/.test(t)) sum.args.add('prepínače');
    if (/"\$@"|\$\*/.test(t)) sum.args.add('všetky');
    // časti riadku
    const parts = stmtsOf(t.replace(/\s+#\s.*$/,''));
    const out = [];
    for (const p of parts){
      if (/^case\s/.test(p)) st.inCase = true;
      if (p==='esac') st.inCase = false;
      const x = stmtText(p, st, fns); if (x) out.push(x);
    }
    const ch = changes(t);
    if (ch.length && !/^\s*(if|while|elif)\s.*-q/.test(t)) sum.mods.push([ln, ch.join(', '), t]);
    const lg = t.match(/logger\s+(?:-\w+\s+\S+\s+)*-t\s+("?)([\w.-]+)\1/); if (lg) sum.logs.add(`journalctl -t ${lg[2]}`);
    const lf = t.match(/>>?\s*("?)(\/var\/log\/\S+?)\1(\s|$)/); if (lf) sum.logs.add(lf[2]);
    const ex = t.match(/\bexit\s+(\d+)/); if (ex) sum.exits.add(ex[1]);
    const sm = t.match(/^set\s+(.+)$/); if (sm) sum.set = sm[1];
    const rd = t.match(/done\s*<\s*("?)([^\s<(][^\s"]*)\1/); if (rd) sum.reads.add(rd[2]);
    rows.push([ln, line, out.join('<br>'), ch.length ? ch.join(', ') : '']);
  });
  sum.fns = [...fns];
  const vars = st.vars.filter((v,i,a)=>a.findIndex(x=>x[0]===v[0])===i).slice(0,12);
  const li = [];
  if (sum.shebang) li.push(`Beží v ${C(sum.shebang.slice(2).trim())}.`);
  li.push(sum.set ? `Nastavenie ${C('set '+sum.set)}: ${/e/.test(sum.set)?'pri chybe skončí':'pri chybe pokračuje'}${/u/.test(sum.set)?', nedefinovaná premenná je chyba':''}.` : 'Nemá <code>set -e</code>: pri chybe príkazu <b>pokračuje ďalej</b>.');
  if (sum.args.size) li.push(`Argumenty: ${[...sum.args].map(a=>/^\d$/.test(a)?C('$'+a):a).join(', ')}.`);
  if (vars.length) li.push(`Premenné: ${vars.map(([n,v])=>`${C(n)}=${C(short(v,40))}`).join(', ')}.`);
  if (sum.fns.length) li.push(`Funkcie: ${sum.fns.map(C).join(', ')}.`);
  if (sum.reads.size) li.push(`Číta súbory: ${[...sum.reads].map(C).join(', ')}.`);
  li.push(sum.mods.length ? `<b>Mení systém</b> na riadkoch ${sum.mods.map(x=>x[0]).join(', ')} (${[...new Set(sum.mods.flatMap(x=>x[1].split(', ')))].join(', ')}). Tieto riadky si prečítaj pred spustením.` : 'Nenašiel som príkazy, ktoré by menili systém (len číta a vypisuje).');
  if (sum.logs.size) li.push(`Záznamy nájdeš: ${[...sum.logs].map(C).join(', ')}.`);
  if (sum.exits.size) li.push(`Návratové kódy: ${[...sum.exits].sort().map(C).join(', ')} (po spustení ${C('echo $?')}).`);
  li.push(`Bezpečne vyskúšaj: ${C('bash -n skript.sh')} (syntax), potom ${C('bash -x skript.sh …')} ako bežný používateľ alebo na testovacom serveri.`);
  const tbl = `<div class="sh-rows">${rows.map(([ln, code, txt, mod])=>`<span class="sh-ln">${ln}</span><code class="sh-c${mod?' sh-mod':''}">${E(code)||'&nbsp;'}</code><span class="sh-t">${txt||''}${mod?`<span class="sh-warn">mení: ${E(mod)}</span>`:''}</span>`).join('')}</div>`;
  return `<div class="ctx"><div class="ctx-sec"><h3>Čo skript robí (zhrnutie)</h3><ul class="ls">${li.map(x=>`<li>${x}</li>`).join('')}</ul></div><div class="ctx-sec sh-box"><h3>Po riadkoch</h3>${tbl}</div><p class="ctx-more">Viac: <a href="#kapitola-26">kapitola 26 (čítanie a písanie skriptov)</a> · <a href="#postupy">postup „Skript nefunguje“</a></p></div>`;
};
window.isScriptText = t => /\n/.test(t.trim()) || /^#!/.test(t.trim()) || /^\s*(for|while|until|if|case)\s.*\b(done|fi|esac)\s*$/.test(t.trim()) || /^\s*[A-Za-z_][\w-]*\s*\(\)\s*\{/.test(t);
})();
