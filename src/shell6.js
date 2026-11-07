/* =========================================================
   SIMULÁTOR: iptables (iptables-nft) a LOG pravidlá
   pravidlá žijú len do reštartu, LOG zapisuje do kernel logu
   ========================================================= */
(function(){
'use strict';
const P = window.Machine.prototype;
const {pad} = window.MachineData;
const CHAINS = ['INPUT','FORWARD','OUTPUT'];
const TARGETS = ['ACCEPT','DROP','REJECT','LOG','RETURN'];
const VER = 'iptables v1.8.10 (nf_tables)';
const st = m => (m.ipt = m.ipt || {INPUT:[], FORWARD:[], OUTPUT:[], pol:{INPUT:'ACCEPT', FORWARD:'ACCEPT', OUTPUT:'ACCEPT'}, cnt:0});

/* rozparsuj podmienky a cieľ pravidla */
function parseRule(t){
  const r = {};
  for (let i=0;i<t.length;i++){
    const k = t[i], v = t[i+1];
    const take = ()=>{ i++; return (v||'').replace(/^["']|["']$/g,''); };
    if (k==='-p' || k==='--protocol') r.p = take();
    else if (k==='-s' || k==='--source') r.s = take();
    else if (k==='-d' || k==='--destination') r.d = take();
    else if (k==='-i' || k==='--in-interface') r.i = take();
    else if (k==='-o' || k==='--out-interface') r.o = take();
    else if (k==='--dport' || k==='--destination-port'){ if (!r.p || !/^(tcp|udp)$/.test(r.p)) return {err:`${VER}: unknown option "${k}"\nTry \`iptables -h' or 'iptables --help' for more information.\n(--dport funguje len spolu s -p tcp alebo -p udp)`}; r.dport = take(); }
    else if (k==='--sport' || k==='--source-port'){ if (!r.p) return {err:`${VER}: unknown option "${k}"`}; r.sport = take(); }
    else if (k==='-m' || k==='--match'){ const mm = take(); if (!['state','conntrack','udp','tcp','comment','multiport','limit','icmp'].includes(mm)) return {err:`${VER}: Couldn't load match \`${mm}':No such file or directory`}; (r.m = r.m||[]).push(mm); }
    else if (k==='--state' || k==='--ctstate') r.state = take();
    else if (k==='--dports') r.dports = take();
    else if (k==='--limit') r.limit = take();
    else if (k==='--comment') r.comment = take();
    else if (k==='-j' || k==='--jump'){ r.j = take(); if (!TARGETS.includes(r.j)) return {err:`${VER}: Couldn't load target \`${r.j}':No such file or directory`}; }
    else if (k==='--log-prefix'){ if (r.j!=='LOG') return {err:`${VER}: unknown option "--log-prefix"\n(--log-prefix patrí za -j LOG)`}; r.prefix = take(); if (r.prefix.length>29) return {err:`${VER}: Maximum prefix length 29 for --log-prefix`}; }
    else if (k==='--log-level'){ r.level = take(); }
    else if (k==='--reject-with'){ r.rejw = take(); }
    else if (k==='!'){ r.neg = true; }
    else return {err:`Bad argument \`${k}'\nTry \`iptables -h' or 'iptables --help' for more information.`};
  }
  if (!r.j) r.j = '';
  return r;
}
const same = (a,b)=>JSON.stringify(Object.assign({},a,{hits:0,id:0})) === JSON.stringify(Object.assign({},b,{hits:0,id:0}));
function ruleS(chain, r){
  let s = `-A ${chain}`;
  if (r.s) s += ` -s ${r.s}`; if (r.d) s += ` -d ${r.d}`; if (r.i) s += ` -i ${r.i}`; if (r.o) s += ` -o ${r.o}`;
  if (r.p) s += ` -p ${r.p}`;
  if (r.state) s += ` -m conntrack --ctstate ${r.state}`;
  if (r.p && (r.dport || r.sport)) s += ` -m ${r.p}`;
  if (r.sport) s += ` --sport ${r.sport}`; if (r.dport) s += ` --dport ${r.dport}`;
  if (r.dports) s += ` -m multiport --dports ${r.dports}`;
  if (r.comment) s += ` -m comment --comment "${r.comment}"`;
  if (r.j) s += ` -j ${r.j}`;
  if (r.prefix) s += ` --log-prefix "${r.prefix}"`; if (r.level) s += ` --log-level ${r.level}`;
  if (r.rejw) s += ` --reject-with ${r.rejw}`;
  return s;
}
function ruleExtra(r){
  const x = [];
  if (r.state) x.push(`ctstate ${r.state}`);
  if (r.p && r.sport) x.push(`${r.p} spt:${r.sport}`);
  if (r.p && r.dport) x.push(`${r.p} dpt:${r.dport}`);
  if (r.dports) x.push(`multiport dports ${r.dports}`);
  if (r.comment) x.push(`/* ${r.comment} */`);
  if (r.j==='LOG') x.push(`LOG flags 0 level ${r.level||4}${r.prefix?` prefix "${r.prefix}"`:''}`);
  if (r.j==='REJECT') x.push(`reject-with ${r.rejw||'icmp-port-unreachable'}`);
  return x.join(' ');
}

/* simulované pakety pre LOG pravidlá */
const SRC = {161:['10.0.20.50',51234], 162:['10.0.20.50',41022], 22:['10.0.20.15',53122], 80:['10.0.20.15',53200], 443:['10.0.20.15',53210], 123:['10.0.20.2',123], 53:['10.0.20.2',53]};
P._iptLogLines = function(r, n){
  const me = this.net.ip.split('/')[0];
  const port = +(r.dport||'') || (r.p==='udp'?161:22);
  const [src, sp] = SRC[port] || ['10.0.20.15', 50000];
  const L = [];
  for (let k=0;k<n;k++){
    const ts = (84300.1 + (this.ipt.cnt+k)*7.31).toFixed(6);
    const proto = (r.p||'tcp').toUpperCase();
    if (proto==='ICMP'){ L.push({ts, txt:`${r.prefix||''}IN=${r.i||this.net.ifc} OUT= MAC=00:50:56:a1:3c:7e:00:50:56:a1:00:50:08:00 SRC=${r.s?r.s.split('/')[0]:'10.0.20.15'} DST=${me} LEN=84 TOS=0x00 PREC=0x00 TTL=64 ID=${4512+(this.ipt.cnt+k)*173%30000} PROTO=ICMP TYPE=8 CODE=0 ID=${3021} SEQ=${this.ipt.cnt+k+1}`}); continue; }
    L.push({ts, txt:`${r.prefix||''}IN=${r.i||this.net.ifc} OUT= MAC=00:50:56:a1:3c:7e:00:50:56:a1:00:50:08:00 SRC=${r.s?r.s.split('/')[0]:src} DST=${me} LEN=${proto==='UDP'?78:60} TOS=0x00 PREC=0x00 TTL=64 ID=${4512+(this.ipt.cnt+k)*173%30000} ${proto==='UDP'?'':'DF '}PROTO=${proto} SPT=${port===123||port===53?sp:sp+(this.ipt.cnt+k)*7%900} DPT=${port} LEN=${proto==='UDP'?58:'0 WINDOW=64240 RES=0x00 SYN URGP=0'}`});
  }
  return L;
};
/* po každom príkaze „prídu“ pakety a LOG pravidlá zapíšu riadky */
P._iptTick = function(){
  const fz0 = this.fw && this.fw.runtime && this.fw.runtime[this.fw.def];
  if (!this.ipt && !(fz0 && (fz0.rich||[]).some(r=>/log\s+prefix/.test(r)))) return;
  const S = st(this);
  const toMsg = L=>{ const msg = this._lookup('/var/log/messages'); if (msg) msg.c += L.map(l=>`Nov  3 ${new Date().toTimeString().slice(0,8)} ${this.hostname} kernel: ${l.txt}`).join('\n')+'\n'; };
  for (const r of S.INPUT){
    if (r.j!=='LOG') continue;
    const L = this._iptLogLines(r, 1); r.hits = (r.hits||0)+1;
    S.cnt++; (S.log = S.log || []).push(...L); toMsg(L);
  }
  /* firewalld rich rule s log prefix */
  const fz = this.fw && this.fw.runtime && this.fw.runtime[this.fw.def];
  for (const rr of (fz && fz.rich) || []){
    const lp = rr.match(/log\s+prefix="([^"]*)"/); if (!lp) continue;
    const pt = rr.match(/port\s+port="?(\d+)"?\s+protocol="?(\w+)"?/);
    const src = rr.match(/source\s+address="?([\d.]+)/);
    const L = this._iptLogLines({prefix:lp[1], p:pt?pt[2]:(/icmp/.test(rr)?'icmp':'tcp'), dport:pt?pt[1]:'', s:src?src[1]:''}, 1);
    S.cnt++; (S.log = S.log || []).push(...L); toMsg(L);
  }
  if (S.log && S.log.length > 60) S.log = S.log.slice(-60);
};
const origRun = P.run;
P.run = function(line){ const r = origRun.call(this, line); try { this._iptTick(); } catch(e){} return r; };

P.c_iptables = function(a){
  if (a.includes('-h') || a.includes('--help')) return `${VER}\n\nUsage: iptables -[ACD] chain rule-specification [options]\n       iptables -I chain [rulenum] rule-specification [options]\n       iptables -D chain rulenum [options]\n       iptables -[LS] [chain [rulenum]] [options]\n       iptables -[FZ] [chain] [options]\n       iptables -P chain target [options]\n(Rozlúštiť v kurze vysvetlí každý prepínač.)\n`;
  if (a.includes('-V') || a.includes('--version')) return VER+'\n';
  if (this.user!=='root') return {e:`${VER}: Could not fetch rule set generation id: Permission denied (you must be root)\n`, code:4};
  const S = st(this);
  let table = 'filter'; const ti = a.indexOf('-t'); if (ti>=0){ table = a[ti+1]; a = a.slice(0,ti).concat(a.slice(ti+2)); }
  if (!['filter','nat','mangle','raw'].includes(table)) return {e:`iptables v1.8.10 (nf_tables): table '${table}' does not exist\n`, code:1};
  if (table!=='filter'){ if (a.some(x=>/^-(L|S)$|^--list/.test(x))) return `Chain PREROUTING (policy ACCEPT)\ntarget     prot opt source               destination\n\nChain POSTROUTING (policy ACCEPT)\ntarget     prot opt source               destination\n`; return {e:`(simulátor: tabuľka ${table} je len na čítanie, cvič s tabuľkou filter)\n`, code:1}; }
  const opt = new Set(); let cmd = null, chain = null, num = null, target = null, rest = [];
  for (let i=0;i<a.length;i++){
    const x = a[i];
    const isCmd = /^-[AIDRLSFPZN]$|^--(append|insert|delete|replace|list|list-rules|flush|policy|zero)$/.test(x) || /^-[LS][nv]+$|^-[nv]+L$/.test(x);
    if (isCmd && !cmd){
      if (/^-[nv]+L$|^-L[nv]+$/.test(x)){ cmd = '-L'; x.replace(/[-L]/g,'').split('').forEach(c=>opt.add('-'+c)); }
      else cmd = {'--append':'-A','--insert':'-I','--delete':'-D','--replace':'-R','--list':'-L','--list-rules':'-S','--flush':'-F','--policy':'-P','--zero':'-Z'}[x] || x;
      if (a[i+1] && !a[i+1].startsWith('-')) chain = a[++i];
      if (['-I','-D','-R','-L','-S'].includes(cmd) && a[i+1] && /^\d+$/.test(a[i+1])) num = +a[++i];
      if (cmd==='-P' && a[i+1]) target = a[++i];
      continue;
    }
    if (['-n','-v','-x','--line-numbers','--numeric','--verbose'].includes(x)){ opt.add(x==='--numeric'?'-n':x==='--verbose'?'-v':x); continue; }
    if (/^-[nvx]+$/.test(x)){ x.slice(1).split('').forEach(c=>opt.add('-'+c)); continue; }
    rest.push(x);
  }
  if (!cmd) return {e:`${VER}: no command specified\nTry \`iptables -h' or 'iptables --help' for more information.\n`, code:2};
  if (chain && !CHAINS.includes(chain)) return {e:`iptables: No chain/target/match by that name.\n(reťazce v tabuľke filter: INPUT, FORWARD, OUTPUT; veľké písmená)\n`, code:1};
  const need = ()=>{ if (!chain) return {e:`${VER}: option "${cmd}" requires an argument\n`, code:2}; return null; };
  if (cmd==='-A' || cmd==='-I' || cmd==='-R'){
    const n = need(); if (n) return n;
    const r = parseRule(rest); if (r.err) return {e:r.err+'\n', code:2};
    if (!r.j) return {e:'(pravidlo bez -j nič nerobí, len počíta pakety. Pridaj napr. -j ACCEPT alebo -j LOG)\n', code:0, o:''};
    r.hits = 0;
    const L = S[chain];
    if (cmd==='-A') L.push(r);
    else if (cmd==='-I'){ const pos = num ? num-1 : 0; if (pos > L.length) return {e:'iptables: Index of insertion too big.\n', code:1}; L.splice(pos, 0, r); }
    else { if (!num || num > L.length) return {e:'iptables: Index of replacement too big.\n', code:1}; L[num-1] = r; }
    let warn = '';
    if (this.svc.firewalld && this.svc.firewalld.active) warn += '';
    if (r.j==='DROP' && chain==='INPUT' && !r.dport && !r.s && !r.p) warn = '(pozor: toto zahodí všetku prichádzajúcu prevádzku, na vzdialenom serveri by si stratil SSH)\n';
    return warn ? {o:'', e:warn, code:0} : '';
  }
  if (cmd==='-D'){
    const n = need(); if (n) return n;
    const L = S[chain];
    if (num){ if (num > L.length) return {e:'iptables: Index of deletion too big.\n', code:1}; L.splice(num-1,1); return ''; }
    const r = parseRule(rest); if (r.err) return {e:r.err+'\n', code:2};
    const i = L.findIndex(x=>same(x, r));
    if (i<0) return {e:'iptables: Bad rule (does a matching rule exist in that chain?).\n', code:1};
    L.splice(i,1); return '';
  }
  if (cmd==='-F'){ (chain?[chain]:CHAINS).forEach(c=>S[c]=[]); return ''; }
  if (cmd==='-Z'){ (chain?[chain]:CHAINS).forEach(c=>S[c].forEach(r=>r.hits=0)); return ''; }
  if (cmd==='-P'){
    const n = need(); if (n) return n;
    if (!['ACCEPT','DROP'].includes(target||'')) return {e:`iptables: Bad policy name. Run \`dmesg' for more information.\n`, code:1};
    S.pol[chain] = target;
    return target==='DROP' && chain==='INPUT' && !S.INPUT.some(r=>r.j==='ACCEPT' && (r.dport==='22' || /ESTABLISHED/.test(r.state||''))) ? {o:'', e:'(pozor: politika DROP bez pravidla pre SSH. Na skutočnom serveri by sa ti práve zamrzla relácia.)\n', code:0} : '';
  }
  if (cmd==='-S'){
    const cs = chain ? [chain] : CHAINS;
    let o = cs.map(c=>`-P ${c} ${S.pol[c]}`).join('\n')+'\n';
    for (const c of cs) S[c].forEach((r,i)=>{ if (!num || num===i+1) o += ruleS(c, r)+'\n'; });
    return o;
  }
  if (cmd==='-L'){
    const cs = chain ? [chain] : CHAINS; const v = opt.has('-v'), ln = opt.has('--line-numbers'), nn = opt.has('-n');
    const host = x => !x ? (nn?'0.0.0.0/0':'anywhere') : x;
    let o = '';
    cs.forEach((c,ci)=>{
      const L = S[c];
      const tp = L.reduce((s,r)=>s+(r.hits||0),0);
      o += `Chain ${c} (policy ${S.pol[c]}${v?` ${12034+tp} packets, ${(918+tp)}K bytes`:''})\n`;
      o += (ln?'num  ':'') + (v?' pkts bytes ':'') + `target     prot opt ${v?'in     out    ':''}source               destination         \n`;
      L.forEach((r,i)=>{ if (num && num!==i+1) return; o += (ln?pad(i+1,4,true)+' ':'') + (v?`${pad(r.hits||0,5)} ${pad((r.hits||0)*78,5)} `:'') + `${pad(r.j||'',10,true)} ${pad(r.p||(nn?'0':'all'),4,true)} --  ${v?pad(r.i||'*',6,true)+' '+pad(r.o||'*',6,true)+' ':''}${pad(host(r.s),20,true)} ${pad(host(r.d),20,true)}${ruleExtra(r)}\n`; });
      if (ci < cs.length-1) o += '\n';
    });
    if (!S.INPUT.length && !S.FORWARD.length && !S.OUTPUT.length && !chain) o += '\n(prázdne: na RHEL je hlavný firewall firewalld a jeho pravidlá iptables neukazuje. Pozri sudo firewall-cmd --list-all alebo sudo nft list ruleset)\n';
    return o;
  }
  return {e:`${VER}: unknown command\n`, code:2};
};
P.c_iptables_save = function(){ if (this.user!=='root') return {e:`${VER}: Could not fetch rule set generation id: Permission denied (you must be root)\n`, code:4}; const S = st(this); return `# Generated by iptables-nft-save v1.8.10 (nf_tables)\n*filter\n:INPUT ${S.pol.INPUT} [0:0]\n:FORWARD ${S.pol.FORWARD} [0:0]\n:OUTPUT ${S.pol.OUTPUT} [0:0]\n` + CHAINS.map(c=>S[c].map(r=>ruleS(c,r)).join('\n')).filter(Boolean).join('\n') + `${CHAINS.some(c=>S[c].length)?'\n':''}COMMIT\n`; };
P.c_ip6tables = function(a){ if (this.user!=='root') return {e:'ip6tables v1.8.10 (nf_tables): Could not fetch rule set generation id: Permission denied (you must be root)\n', code:4}; return 'Chain INPUT (policy ACCEPT)\ntarget     prot opt source               destination         \n\nChain FORWARD (policy ACCEPT)\ntarget     prot opt source               destination         \n\nChain OUTPUT (policy ACCEPT)\ntarget     prot opt source               destination         \n'; };

/* nft list ruleset ukáže aj tabuľku ip filter, keď sú v nej pravidlá */
const origNft = P.c_nft;
P.c_nft = function(a){
  const r = origNft.call(this, a);
  const S = this.ipt; if (!S || this.user!=='root' || !CHAINS.some(c=>S[c].length) || !/^list (ruleset|tables)/.test(a.join(' '))) return r;
  const t = typeof r==='string' ? r : (r.o||'');
  const nf = rr => `${rr.s?`ip saddr ${rr.s} `:''}${rr.p && rr.dport?`${rr.p} dport ${rr.dport} `:rr.p?`ip protocol ${rr.p} `:''}counter packets ${rr.hits||0} bytes ${(rr.hits||0)*78} ${rr.j==='LOG'?`log prefix "${rr.prefix||''}"`:(rr.j||'').toLowerCase()}`;
  return t + `table ip filter {\n` + CHAINS.filter(c=>S[c].length).map(c=>`\tchain ${c} {\n\t\ttype filter hook ${c.toLowerCase()} priority filter; policy ${S.pol[c].toLowerCase()};\n${S[c].map(rr=>'\t\t'+nf(rr)).join('\n')}\n\t}`).join('\n') + `\n}\n(táto tabuľka „ip filter“ je od iptables; firewalld má vlastnú „inet firewalld“)\n`;
};
/* LOG riadky v jadre */
const kLines = m => ((m.ipt||{}).log||[]);
const origJ = P.c_journalctl;
P.c_journalctl = function(a){
  const L = kLines(this);
  if (!L.length) return origJ.call(this, a);
  const o = this.opts(a,['u','p','n','since','until','b','g','t','o','grep']);
  if (o.v.u || o.v.t) return origJ.call(this, a);
  const kern = o.has('k') || o.has('dmesg');
  const r = kern ? '' : origJ.call(this, a);
  if (r && typeof r==='object' && r.code) return r;
  const g = (o.v.g || o.v.grep || '').replace(/^["']|["']$/g,'');
  const t = typeof r==='string' ? r : (r.o||'');
  let lines = (g||kern ? [] : t.split('\n').filter(Boolean)).concat(L.filter(l=>!g || l.txt.includes(g)).map(l=>`Nov 03 ${new Date().toTimeString().slice(0,8)} ${this.hostname} kernel: ${l.txt}`));
  const n = +o.v.n; if (n) lines = lines.slice(-n);
  if (!lines.length) return '-- No entries --\n';
  return lines.join('\n') + '\n';
};
const origD = P.c_dmesg;
P.c_dmesg = function(a){
  const r = origD.call(this, a);
  const L = kLines(this); if (!L.length || this.user!=='root') return r;
  const t = typeof r==='string' ? r : (r.o||'');
  return t.replace(/\n*$/,'\n') + L.map(l=>`[${l.ts}] ${l.txt}`).join('\n') + '\n';
};
/* reštart: pravidlá iptables nie sú trvalé */
const origReboot = P.c_reboot;
P.c_reboot = function(a){
  const had = this.user==='root' && this.ipt && CHAINS.some(c=>this.ipt[c].length);
  const r = origReboot.call(this, a);
  if (had && r && r.o && r.code!==1){
    CHAINS.forEach(c=>this.ipt[c]=[]); this.ipt.log=[];
    const note = '  • iptables: ručne pridané pravidlá zmizli (nie sú trvalé). Natrvalo použi firewalld rich rule.';
    r.o = /Nič neočakávané/.test(r.o) ? r.o.replace(/  • Nič neočakávané[^\n]*/, note) : r.o.replace(/\n$/, '\n'+note+'\n');
  }
  return r;
};
})();
