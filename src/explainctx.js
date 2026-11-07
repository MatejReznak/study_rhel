/* =========================================================
   Rozlúštiť: súvislosti k príkazu
   (čo to celé robí, kde je výsledok, ako späť, natrvalo cez firewalld)
   + rozbor riadku z logu (SRC= DST= DPT=…) a firewalld rich rule
   ========================================================= */
(function(){
const E = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const unq = s => String(s||'').replace(/^["']|["']$/g,'');
const pd = p => (window.portDesc ? window.portDesc(p) : 'port '+p);

function toks(line){
  const out=[]; let cur='', q=null, has=false;
  for (const ch of line){
    if (q){ if (ch===q) q=null; else cur+=ch; continue; }
    if (ch==='"'||ch==="'"){ q=ch; has=true; continue; }
    if (/\s/.test(ch)){ if (cur||has) out.push(cur); cur=''; has=false; continue; }
    cur+=ch;
  }
  if (cur||has) out.push(cur);
  return out;
}

/* ---------- iptables: rozparsovanie ---------- */
function parseIpt(line){
  let t = toks(line.trim()); if (t[0]==='sudo') t = t.slice(1);
  const cmd = t.shift(); if (!/^ip6?tables$/.test(cmd||'')) return null;
  const r = {cmd, v6:cmd==='ip6tables', table:'filter', op:null, chain:null, num:null, pol:null, neg:{}, opts:new Set()};
  const OPS = {'-A':'A','--append':'A','-I':'I','--insert':'I','-D':'D','--delete':'D','-R':'R','--replace':'R','-L':'L','--list':'L','-S':'S','--list-rules':'S','-F':'F','--flush':'F','-P':'P','--policy':'P','-Z':'Z','--zero':'Z','-N':'N','-X':'X'};
  let neg = false;
  for (let i=0;i<t.length;i++){
    const k = t[i], v = t[i+1];
    if (k==='!'){ neg = true; continue; }
    const comb = k.match(/^-([nvx]*)([LS])([nvx]*)$/);
    if (OPS[k] || comb){
      r.op = comb ? comb[2] : OPS[k]; if (comb) (comb[1]+comb[3]).split('').forEach(c=>r.opts.add('-'+c));
      if (v && !v.startsWith('-')){ r.chain = v; i++; }
      if (t[i+1] && /^\d+$/.test(t[i+1]) && 'IDRLS'.includes(r.op)){ r.num = +t[++i]; }
      if (r.op==='P' && t[i+1]){ r.pol = t[++i]; }
      continue;
    }
    const map = {'-t':'table','--table':'table','-p':'p','--protocol':'p','-s':'s','--source':'s','-d':'d','--destination':'d','-i':'i','--in-interface':'i','-o':'o','--out-interface':'o','--dport':'dport','--destination-port':'dport','--sport':'sport','--source-port':'sport','--dports':'dports','--sports':'sports','--ctstate':'state','--state':'state','-j':'j','--jump':'j','--log-prefix':'prefix','--log-level':'level','--limit':'limit','--comment':'comment','--reject-with':'rejw','--to-destination':'todst','--to-source':'tosrc','--to-ports':'toports','--icmp-type':'icmpt'};
    if (k==='-m' || k==='--match'){ (r.m = r.m||[]).push(v); i++; continue; }
    if (map[k]){ r[map[k]] = v; if (neg) r.neg[map[k]] = true; neg = false; i++; continue; }
    if (/^-[nvx]+$/.test(k) || k==='--line-numbers'){ k==='--line-numbers' ? r.opts.add(k) : k.slice(1).split('').forEach(c=>r.opts.add('-'+c)); continue; }
    (r.unknown = r.unknown||[]).push(k);
  }
  return r;
}
const CHN = {INPUT:'prichádzajúca prevádzka (pakety pre tento server)', OUTPUT:'odchádzajúca prevádzka (pakety, ktoré server posiela)', FORWARD:'preposielaná prevádzka (server ako router)', PREROUTING:'hneď po príchode paketu, pred smerovaním', POSTROUTING:'tesne pred odchodom paketu'};
const ACT = {ACCEPT:'povolí ich (ďalšie pravidlá sa už nečítajú)', DROP:'potichu ich zahodí (klient čaká do timeoutu)', REJECT:'odmietne ich a pošle odpoveď (klient hneď vidí chybu)', LOG:'zapíše ich do logu jadra a nechá ich pokračovať ďalšími pravidlami (LOG nič nepovoľuje ani nezakazuje)', RETURN:'vráti sa z reťazca', MASQUERADE:'nahradí zdrojovú adresu adresou výstupného rozhrania (NAT)', DNAT:'zmení cieľovú adresu (presmerovanie)', SNAT:'zmení zdrojovú adresu'};
function matchText(r){
  const w = [];
  const proto = r.p ? (r.p==='all'?'všetky pakety':`pakety ${r.p.toUpperCase()}`) : 'všetky pakety';
  w.push((r.neg.p?'všetky pakety okrem '+r.p.toUpperCase():proto));
  if (r.s) w.push(`od ${r.neg.s?"všetkých okrem ":""}${r.s}`);
  if (r.d) w.push(`${r.neg.d?'NIE ':''}na ${r.d}`);
  if (r.i) w.push(`prichádzajúce cez ${r.i}`);
  if (r.o) w.push(`odchádzajúce cez ${r.o}`);
  if (r.dport) w.push(`na port ${r.dport}${window.PORT_NAMES&&window.PORT_NAMES[+r.dport]?` (${window.PORT_NAMES[+r.dport].split(':')[0]})`:''}`);
  if (r.dports) w.push(`na porty ${r.dports}`);
  if (r.sport) w.push(`zo zdrojového portu ${r.sport}`);
  if (r.state) w.push(`v stave spojenia ${r.state}`);
  if (r.icmpt) w.push(`typu ${r.icmpt}`);
  return w.join(' ');
}
function ruleSpec(r){
  const p = [];
  if (r.s) p.push((r.neg.s?'! ':'')+'-s '+r.s); if (r.d) p.push((r.neg.d?'! ':'')+'-d '+r.d); if (r.i) p.push('-i '+r.i); if (r.o) p.push('-o '+r.o);
  if (r.p) p.push('-p '+r.p);
  (r.m||[]).forEach(m=>{ if (!['tcp','udp'].includes(m)) p.push('-m '+m); });
  if (r.state) p.push('--ctstate '+r.state);
  if (r.dport) p.push('--dport '+r.dport); if (r.sport) p.push('--sport '+r.sport); if (r.dports) p.push('--dports '+r.dports);
  if (r.limit) p.push('--limit '+r.limit); if (r.comment) p.push(`--comment "${r.comment}"`);
  if (r.j) p.push('-j '+r.j); if (r.prefix!=null) p.push(`--log-prefix "${r.prefix}"`); if (r.level) p.push('--log-level '+r.level); if (r.rejw) p.push('--reject-with '+r.rejw);
  return p.join(' ');
}
const LVL = {0:'emerg',1:'alert',2:'crit',3:'err',4:'warning',5:'notice',6:'info',7:'debug'};
function richFor(r){
  if (r.table!=='filter') return {note:'Tabuľka nat: vo firewalld sa to robí cez <code>--add-forward-port</code> (presmerovanie portu) alebo <code>--add-masquerade</code> (NAT von), nie rich rule.'};
  if (r.chain && r.chain!=='INPUT') return {note:`Reťazec ${E(r.chain)}: firewalld na to nemá rich rule v zóne. Na odchádzajúcu a preposielanú prevádzku sú <b>policies</b> (<code>firewall-cmd --permanent --new-policy …</code>, RHEL 9+).`};
  if (r.state && /ESTABLISHED|RELATED/.test(r.state) && r.j==='ACCEPT') return {note:'Toto firewalld robí sám: odpovede v nadviazaných spojeniach (ESTABLISHED, RELATED) púšťa automaticky. Netreba nič pridávať.'};
  if (r.j==='LOG' && r.prefix==null && !r.dport && !r.p) return null;
  const fam = r.v6 ? 'ipv6' : 'ipv4';
  const ports = r.dports ? r.dports.split(',') : r.dport ? [r.dport] : [null];
  const rules = ports.map(pt=>{
    let s = `rule family="${fam}"`;
    if (r.s) s += ` source${r.neg.s?' NOT':''} address="${r.s}"`;
    if (r.d) s += ` destination${r.neg.d?' NOT':''} address="${r.d}"`;
    if (pt) s += ` port port="${pt.replace(':','-')}" protocol="${r.p||'tcp'}"`;
    else if (r.p==='icmp') s += ` protocol value="icmp"`;
    else if (r.p && r.p!=='all') s += ` protocol value="${r.p}"`;
    if (r.j==='LOG' || r.prefix!=null){ s += ` log${r.prefix!=null?` prefix="${r.prefix}"`:''} level="${LVL[r.level]||r.level||'warning'}"`; if (r.limit) s += ` limit value="${r.limit.replace(/\/(sec|second|s)$/,'/s').replace(/\/(min|minute|m)$/,'/m').replace(/\/(hour|h)$/,'/h').replace(/\/(day|d)$/,'/d')}"`; }
    if (r.j==='ACCEPT') s += ' accept';
    else if (r.j==='DROP') s += ' drop';
    else if (r.j==='REJECT') s += r.rejw ? ` reject type="${r.rejw}"` : ' reject';
    return s;
  });
  const extra = [];
  if (r.i) extra.push(`<code>-i ${E(r.i)}</code> vo firewalld nahrádza zóna: rozhranie daj do zóny (<code>--zone=ZÓNA --change-interface=${E(r.i)}</code>) a pravidlo pridaj do nej cez <code>--zone=ZÓNA</code>.`);
  if (r.j==='LOG') extra.push('Rich rule iba s <code>log</code> (bez accept/drop) paket len zaloguje, o povolení rozhodnú ostatné pravidlá zóny, presne ako <code>-j LOG</code>. Ak ho chceš aj povoliť, pridaj na koniec <code>accept</code>.');
  const simple = (!r.s && !r.d && r.j==='ACCEPT' && r.dport && !r.dports) ? `sudo firewall-cmd --permanent --add-port=${r.dport}/${r.p||'tcp'}` : null;
  return {rules, extra, simple};
}

/* ---------- výstupy ---------- */
const sec = (h, body) => `<div class="ctx-sec"><h3>${h}</h3>${body}</div>`;
const cmds = list => `<div class="ctx-cmds">${list.map(([c,d])=>`<div><code>${E(c)}</code>${d?`<span>${d}</span>`:''}</div>`).join('')}</div>`;
const LOGF = [['IN=','rozhranie, na ktoré paket prišiel (prázdne = paket odchádza)'],['OUT=','rozhranie, ktorým odchádza (prázdne = paket je pre tento server)'],['MAC=','cieľová MAC, zdrojová MAC, typ (08:00 = IPv4)'],['SRC=','zdrojová IP: kto posiela'],['DST=','cieľová IP: komu'],['LEN=','dĺžka paketu v bajtoch'],['TTL=','koľko skokov paket ešte vydrží (64 alebo 128 = prišiel z blízka)'],['ID=','identifikátor IP paketu'],['DF','„nefragmentovať“'],['PROTO=','protokol TCP/UDP/ICMP'],['SPT=','zdrojový port (u klienta zvyčajne náhodný vysoký)'],['DPT=','cieľový port: na akú službu sa ide'],['SYN','začiatok TCP spojenia (nový pokus o pripojenie)'],['ACK / FIN / RST','potvrdenie / ukončenie / zrušenie spojenia'],['TYPE=8','ICMP echo request (ping)'],['TYPE=0','ICMP echo reply (odpoveď na ping)']];

function iptCtx(line){
  const r = parseIpt(line); if (!r) return '';
  let h = '';
  const ch = r.chain || 'všetky reťazce';
  // 1. čo to celé robí
  let what = '';
  const pos = r.op==='I' ? (r.num?`na pozíciu ${r.num} v reťazci`:'na <b>začiatok</b> reťazca') : r.op==='A' ? 'na <b>koniec</b> reťazca' : '';
  if ('AIR'.includes(r.op||'-') && r.op){
    what = `${r.op==='R'?`Nahradí pravidlo č. ${r.num} v reťazci`:'Pridá pravidlo '+pos} <b>${E(r.chain)}</b> – ${CHN[r.chain]||'vlastný reťazec'}${r.table!=='filter'?`, tabuľka ${E(r.table)}`:''}.<br><b>Čo zachytí:</b> ${E(matchText(r))}.<br><b>Čo s nimi spraví:</b> ${r.j?ACT[r.j]||('pošle ich do '+E(r.j)):'nič, len ich spočíta (chýba -j)'}${r.j==='LOG'&&r.prefix!=null?`. Každý riadok v logu začne textom „${E(r.prefix)}“`:''}.`;
    if (r.dport && /^\d+$/.test(r.dport)) what += `<br><span class="ctx-port">${E(pd(r.dport+'/'+(r.p||'tcp')))}</span>`;
  } else if (r.op==='D') what = r.num ? `Zmaže pravidlo č. ${r.num} z reťazca <b>${E(r.chain)}</b>.` : `Zmaže z reťazca <b>${E(r.chain)}</b> pravidlo, ktoré sa presne zhoduje so zvyškom príkazu.`;
  else if (r.op==='L') what = `Vypíše pravidlá (${E(ch)})${r.opts.has('-n')?', čísla namiesto mien':''}${r.opts.has('-v')?', s počítadlami pkts/bytes (rastú = pravidlo zachytáva prevádzku)':''}${r.opts.has('--line-numbers')?', s číslami riadkov na mazanie':''}. Pravidlá firewalld tu neuvidíš, tie ukáže <code>firewall-cmd --list-all</code> a <code>nft list ruleset</code>.`;
  else if (r.op==='S') what = `Vypíše pravidlá (${E(ch)}) ako príkazy. Riadok skopíruješ, <code>-A</code> zmeníš na <code>-D</code> a pravidlo zmažeš.`;
  else if (r.op==='F') what = `Zmaže <b>všetky</b> pravidlá (${E(ch)}). Politika (-P) ostane. Ak je politika DROP, môžeš sa takto odstrihnúť.`;
  else if (r.op==='P') what = `Nastaví politiku reťazca <b>${E(r.chain)}</b> na <b>${E(r.pol)}</b>: čo sa stane s paketom, ktorý nezachytí žiadne pravidlo.${r.pol==='DROP'&&r.chain==='INPUT'?' Bez pravidla pre SSH a nadviazané spojenia sa na vzdialenom serveri odstrihneš.':''}`;
  else if (r.op==='Z') what = 'Vynuluje počítadlá paketov.';
  else if (r.op==='N') what = `Vytvorí vlastný reťazec ${E(r.chain)}.`;
  if (r.dport && !r.p) what += '<br><b>Chyba:</b> <code>--dport</code> bez <code>-p tcp</code> alebo <code>-p udp</code> iptables odmietne („unknown option --dport“).';
  if (r.prefix && r.prefix.length>29) what += '<br><b>Chyba:</b> --log-prefix môže mať najviac 29 znakov.';
  if (r.prefix!=null && r.j!=='LOG') what += '<br><b>Chyba:</b> --log-prefix patrí za <code>-j LOG</code>.';
  if (what) h += sec('Čo to celé robí', `<p>${what}</p>`);

  // 2. kde je výsledok
  if (r.j==='LOG' && 'AIR'.includes(r.op||'-') && r.op){
    const g = r.prefix ? r.prefix.trim() : 'kernel:';
    h += sec('Kde uvidíš výsledok', cmds([[`sudo journalctl -k --grep "${g}"`,'-k = len správy jadra'],[`sudo journalctl -k -f --grep "${g}"`,'naživo (Ctrl+C koniec)'],[`sudo dmesg | grep "${g}"`,''],[`sudo grep "${g}" /var/log/messages`,'']]) +
      `<pre class="ctx-pre">kernel: ${E(r.prefix||'')}IN=ens192 OUT= MAC=… SRC=10.0.20.50 DST=10.0.20.31 LEN=78 TTL=64 PROTO=${E((r.p||'TCP').toUpperCase())}${r.p==='icmp'?' TYPE=8 CODE=0':` SPT=51234 DPT=${E(r.dport||'…')}`}</pre>` +
      `<details class="ctx-det"><summary>Čo znamenajú polia v riadku</summary><div class="ex-rows">${LOGF.map(([k,v])=>`<span class="k k-flag">${E(k)}</span><span class="v">${E(v)}</span>`).join('')}</div></details>` +
      `<p class="ctx-tip">Žiadne riadky = pakety na server <b>neprichádzajú</b> (problém je pred serverom). Riadky sú, ale služba neodpovedá = problém je na serveri: počúva služba (<code>ss -${r.p==='udp'?'u':'t'}lpn${r.dport?' | grep :'+E(r.dport):''}</code>)? Povolil ju firewalld?</p>`);
  } else if (r.op && 'AI'.includes(r.op)){
    h += sec('Ako overiť', cmds([[`sudo iptables -L ${r.chain||''} -n -v --line-numbers`.replace('  ',' '),'pravidlo je v zozname, stĺpec pkts ukáže, či niečo zachytáva']]));
  }

  // 3. ako späť
  if (r.op && 'AI'.includes(r.op)) h += sec('Ako to vrátiť', cmds([[`sudo ${r.cmd} ${r.table!=='filter'?'-t '+r.table+' ':''}-D ${r.chain} ${ruleSpec(r)}`,'rovnaké pravidlo, len -D namiesto '+(r.op==='I'?'-I':'-A')],[`sudo ${r.cmd} -L ${r.chain} -n --line-numbers  →  sudo ${r.cmd} -D ${r.chain} ČÍSLO`,'alebo podľa čísla riadku'],['sudo reboot','ručné pravidlá iptables reštart aj tak zmaže']]));
  else if (r.op==='P' && r.pol==='DROP') h += sec('Ako to vrátiť', cmds([[`sudo ${r.cmd} -P ${r.chain} ACCEPT`,'z konzoly (VMware/iDRAC), ak si sa odstrihol cez SSH']]));

  // 4. natrvalo cez firewalld
  if (r.op && 'AIR'.includes(r.op)){
    const f = richFor(r);
    if (f){
      let b = '';
      if (f.note) b += `<p>${f.note}</p>`;
      if (f.rules){
        if (f.simple) b += cmds([[f.simple,'jednoduchšie: obyčajné otvorenie portu'],['sudo firewall-cmd --reload','']]) + '<p class="ctx-tip">Alebo ako rich rule:</p>';
        b += cmds(f.rules.map(x=>[`sudo firewall-cmd --permanent --add-rich-rule='${x}'`,''])) + cmds([['sudo firewall-cmd --reload','aplikuj'],['sudo firewall-cmd --list-rich-rules','over']]);
        b += `<p class="ctx-tip">Odstránenie: ten istý text s <code>--remove-rich-rule</code>, potom <code>--reload</code>.</p>`;
        f.extra.forEach(x=>b += `<p class="ctx-tip">${x}</p>`);
      }
      h += sec('Správne a natrvalo: firewalld', b);
    }
  }

  // 5. pozor
  const warn = [];
  if (r.op && 'AIRPDF'.includes(r.op)) warn.push('Zmena cez iptables <b>zmizne po reštarte</b> a <code>firewall-cmd --list-all</code> ju neukáže. Na RHEL 9/10 je iptables len prekladač do nftables (iptables-nft). Na diagnostiku na pár minút OK, potom pravidlo zmaž.');
  if (r.j==='LOG' && !r.limit) warn.push('LOG bez obmedzenia môže pri veľkej prevádzke zahltiť log. Pridaj <code>-m limit --limit 5/min</code>.');
  if (r.v6===false && 'AI'.includes(r.op||'-') && r.op) warn.push('Platí len pre IPv4. Pre IPv6 je samostatný <code>ip6tables</code>.');
  if (warn.length) h += sec('Pozor', warn.map(x=>`<p>${x}</p>`).join(''));

  // 6. kontext portu
  if (['161','162'].includes(r.dport)) h += sec('SNMP v skratke', '<p>Monitoring (Zabbix, PRTG, LibreNMS) sa pýta agenta <code>snmpd</code> (balík <code>net-snmp</code>) na <b>UDP 161</b>. Zariadenia samy posielajú upozornenia (trapy) na <b>UDP 162</b> monitorovaciemu serveru. Vo firewalld sú na to služby <code>snmp</code> a <code>snmptrap</code>. Bez zásahu do pravidiel overíš prevádzku aj cez <code>sudo tcpdump -i ens192 -nn udp port 161</code>.</p>');

  h += `<p class="ctx-more">Viac: <a href="#kapitola-13">kapitola 13 (Firewall)</a> · <a href="#postupy">postup „Chodí na server prevádzka na port?“</a></p>`;
  return h;
}

/* rozbor firewalld rich rule */
function richCtx(line){
  const m = line.match(/--(add|remove)-rich-rule=(['"])(.*)\2/); if (!m) return '';
  const s = m[3];
  const parts = [];
  const re = /(rule|family|source(?: NOT)?|destination(?: NOT)?|address|port|protocol|value|log|prefix|level|limit|accept|drop|reject|type|service|name|masquerade|forward-port|to-port|to-addr|priority|audit)(?:="([^"]*)")?/g;
  const D = {rule:'začiatok pravidla', family:'ipv4 alebo ipv6', source:'podmienka na odosielateľa', 'source NOT':'odosielateľ NIE je', destination:'podmienka na cieľ', 'destination NOT':'cieľ NIE je', address:'IP alebo sieť', port:'podmienka na port (s protocol)', protocol:'tcp/udp, alebo protocol value="icmp"', value:'hodnota protokolu', log:'zapíš do logu jadra (paket nezastaví)', prefix:'text na začiatku riadku v logu', level:'priorita v logu (info, warning…)', limit:'obmedzenie zápisov (value="5/m")', accept:'povoľ', drop:'potichu zahoď', reject:'odmietni s odpoveďou', type:'typ odpovede pri reject', service:'služba podľa mena (name="https")', name:'meno služby', masquerade:'NAT von', 'forward-port':'presmerovanie portu', 'to-port':'cieľový port presmerovania', 'to-addr':'cieľová adresa presmerovania', priority:'poradie (nižšie = skôr)', audit:'zapíš do auditu'};
  let x; while ((x = re.exec(s))){ const k = x[1]; const v = x[2]; if (k==='port' && v) parts.push([`port="${v}"`, pd(v)]); else parts.push([v!=null?`${k}="${v}"`:k, D[k]||'']); }
  const nm = s.match(/port port="?(\d+)"?\s+protocol="?(\w+)/);
  let ipt = '';
  if (nm){ const src = s.match(/source address="([^"]+)"/); const lp = s.match(/log prefix="([^"]*)"/); const act = /\baccept\b/.test(s)?'ACCEPT':/\bdrop\b/.test(s)?'DROP':/\breject\b/.test(s)?'REJECT':'';
    const base = `iptables -A INPUT ${src?'-s '+src[1]+' ':''}-p ${nm[2]} --dport ${nm[1]}`;
    const L = []; if (lp) L.push(`${base} -j LOG --log-prefix "${lp[1]}"`); if (act) L.push(`${base} -j ${act}`); ipt = L.length ? sec('To isté v reči iptables (len na porovnanie)', cmds(L.map(c=>[c,'']))) : ''; }
  return sec('Rozbor rich rule', `<div class="ex-rows">${parts.map(([k,v])=>`<span class="k k-arg">${E(k)}</span><span class="v">${E(v)}</span>`).join('')}</div>`) + ipt +
    sec('Ďalej', cmds([['sudo firewall-cmd --reload','ak bolo s --permanent'],['sudo firewall-cmd --list-rich-rules','over'], /log/.test(s) ? [`sudo journalctl -k --grep "${(s.match(/prefix="([^"]*)"/)||['',''])[1].trim()}"`,'záznamy v logu jadra'] : ['sudo firewall-cmd --list-all','celá zóna']]));
}

/* rozbor riadku z logu jadra */
function logCtx(line){
  if (!/\bSRC=\d/.test(line) || !/\b(PROTO|DST)=/.test(line)) return null;
  const f = {}; line.replace(/\b([A-Z]+)=(\S*)/g, (_,k,v)=>{ if (!(k in f)) f[k]=v; });
  const pre = (line.match(/kernel:\s*(.*?)IN=/)||line.match(/^(.*?)IN=/)||[,''])[1].trim();
  const flags = ['SYN','ACK','FIN','RST','PSH','DF'].filter(x=>new RegExp('\\b'+x+'\\b').test(line));
  const rows = [];
  if (pre) rows.push([pre,'prefix z LOG pravidla (--log-prefix alebo log prefix= v rich rule): podľa neho vieš, ktoré pravidlo riadok zapísalo']);
  const D = Object.fromEntries(LOGF.map(([k,v])=>[k.replace('=',''),v]));
  for (const [k,v] of Object.entries(f)){ let d = D[k]||''; if (k==='DPT'||k==='SPT') d += ' → '+pd(v+'/'+(f.PROTO||'').toLowerCase()); if (k==='OUT' && !v) d = 'prázdne: paket je určený pre tento server'; if (k==='TTL'){ const t=+v; d = 'zostávajúci počet skokov: '+(t>64?`odosielateľ je zrejme Windows (štartuje na 128), prešiel ${128-t} router(mi)`:t===64?'prišiel z tej istej siete (Linux štartuje na 64)':`ak je odosielateľ Linux (štart 64), prešiel ${64-t} router(mi)`); } rows.push([`${k}=${v}`, d]); }
  flags.forEach(x=>rows.push([x, (LOGF.find(l=>l[0].startsWith(x))||[,''])[1] || (x==='DF'?'nefragmentovať':'')]));
  const sum = `${f.SRC} → ${f.DST}${f.DPT?':'+f.DPT:''} ${f.PROTO||''}${f.IN?`, prišlo na ${f.IN}`:''}${f.DPT?'. '+pd(f.DPT+'/'+(f.PROTO||'').toLowerCase()):''}${flags.includes('SYN')&&!flags.includes('ACK')?'. Nový pokus o spojenie.':''}`;
  return `<div class="explain"><div class="ex-line"><span class="tok t-cmd">riadok z logu jadra (iptables/firewalld LOG)</span></div><div class="ex-rows">${rows.map(([k,v])=>`<span class="k k-flag">${E(k)}</span><span class="v">${E(v)}</span>`).join('')}</div></div>` + sec('Zhrnutie', `<p>${E(sum)}</p>`) + sec('Čo ďalej', cmds([[`sudo journalctl -k --grep "${pre||f.SRC}"`, 'všetky takéto riadky'],[`sudo journalctl -k --grep "SRC=${f.SRC}"`,'všetko od tohto odosielateľa'],[f.DPT?`ss -${(f.PROTO||'').toUpperCase()==='UDP'?'u':'t'}lpn | grep :${f.DPT}`:'ss -tulpn','počúva na serveri služba?']]));
}

window.explainCtx = function(line){
  const l = line.trim();
  const lg = logCtx(l); if (lg) return {replace:lg};
  const first = toks(l).find(t=>t!=='sudo') || '';
  let h = '';
  if (/^ip6?tables$/.test(first)) h = iptCtx(l);
  else if (first==='firewall-cmd' && /rich-rule=/.test(l)) h = richCtx(l);
  return h ? {after:`<div class="ctx">${h}</div>`} : null;
};
})();
