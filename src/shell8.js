/* =========================================================
   SIMULÁTOR: journalctl do hĺbky
   --since/--until (čas, today, yesterday, -1h, "10 min ago"), -b -1,
   --list-boots, -o short-iso|cat|verbose|json, _PID= _COMM= _SYSTEMD_UNIT=,
   -n po filtrovaní, -e, -r, --no-pager
   ========================================================= */
(function(){
'use strict';
const P = window.Machine.prototype;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const z = x=>String(x).padStart(2,'0');
const tsOf = line => { const m = line.match(/^([A-Z][a-z]{2}) +(\d{1,2}) (\d\d):(\d\d):(\d\d) /); if (!m) return null; const d = new Date(); d.setMonth(MON.indexOf(m[1]), +m[2]); d.setHours(+m[3], +m[4], +m[5], 0); return d; };
P._jTime = function(s){
  if (s==null) return null;
  s = String(s).trim().replace(/^["']|["']$/g,'');
  const now = new Date(); const d = new Date(now);
  if (s==='now') return now;
  if (s==='today'){ d.setHours(0,0,0,0); return d; }
  if (s==='yesterday'){ d.setDate(d.getDate()-1); d.setHours(0,0,0,0); return d; }
  if (s==='tomorrow'){ d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d; }
  let m;
  if ((m = s.match(/^-?(\d+)\s*(s|sec|m|min|h|hour|hours|d|day|days|w|week|weeks)?(?:\s+ago)?$/)) && (s.startsWith('-') || /ago$/.test(s))){ const mult = {s:1,sec:1,m:60,min:60,h:3600,hour:3600,hours:3600,d:86400,day:86400,days:86400,w:604800,week:604800,weeks:604800}[m[2]||'s']; return new Date(now - (+m[1])*mult*1000); }
  if ((m = s.match(/^(\d+)\s*(minutes?|mins?|hours?|days?|seconds?|secs?)\s+ago$/))){ const u = m[2][0]; const mult = u==='m'?60:u==='h'?3600:u==='d'?86400:1; return new Date(now - (+m[1])*mult*1000); }
  if ((m = s.match(/^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?$/))) return new Date(+m[1], +m[2]-1, +m[3], +(m[4]||0), +(m[5]||0), +(m[6]||0));
  if ((m = s.match(/^(\d{1,2}):(\d\d)(?::(\d\d))?$/))){ d.setHours(+m[1], +m[2], +(m[3]||0), 0); return d; }
  return undefined;
};
/* predchádzajúci beh servera (včera) */
P._prevBoot = function(){
  if (this.prevBootLines) return this.prevBootLines;
  const y = new Date(); y.setDate(y.getDate()-1);
  const T = (h,mi,s)=>`${MON[y.getMonth()]} ${z(y.getDate())} ${z(h)}:${z(mi)}:${z(s)}`;
  const H = this.hostname;
  return [
    `${T(7,58,2)} ${H} kernel: Linux version ${this.kernel}`,
    `${T(7,58,9)} ${H} systemd[1]: Started OpenSSH server daemon.`,
    `${T(7,58,10)} ${H} systemd[1]: Started firewalld - dynamic firewall daemon.`,
    `${T(13,12,44)} ${H} sshd[18211]: Accepted publickey for admin from 10.0.20.15 port 50211 ssh2`,
    `${T(13,14,2)} ${H} sudo[18290]: admin : TTY=pts/0 ; PWD=/home/admin ; USER=root ; COMMAND=/usr/bin/dnf -y update`,
    `${T(13,21,37)} ${H} dnf[18291]: Upgraded: kernel-${this.kernel.replace(/\.x86_64$/,'')}.x86_64`,
    `${T(22,0,1)} ${H} CROND[30112]: (root) CMD (/usr/local/sbin/zaloha.sh /etc 14)`,
    `${T(23,59,50)} ${H} sudo[31877]: admin : TTY=pts/1 ; PWD=/home/admin ; USER=root ; COMMAND=/usr/sbin/reboot`,
    `${T(23,59,51)} ${H} systemd[1]: Stopping OpenSSH server daemon...`,
    `${T(23,59,52)} ${H} systemd-logind[801]: System is rebooting.`,
    `${T(23,59,58)} ${H} systemd[1]: Reached target System Reboot.`
  ];
};
const origJ = P.c_journalctl;
P.c_journalctl = function(a){
  let since=null, until=null, fmt=null, pid=null, comm=null, boot=0, n=null, rev=false, grepJ=null, bad=null;
  const args = [];
  for (let i=0;i<a.length;i++){
    const x = a[i]; let m;
    if (x==='--since' || x==='-S'){ since = a[++i]; continue; }
    if ((m = x.match(/^--since=(.*)$/))){ since = m[1]; continue; }
    if (x==='--until' || x==='-U'){ until = a[++i]; continue; }
    if ((m = x.match(/^--until=(.*)$/))){ until = m[1]; continue; }
    if (x==='-o' || x==='--output'){ fmt = a[++i]; continue; }
    if ((m = x.match(/^--output=(.*)$/))){ fmt = m[1]; continue; }
    if ((m = x.match(/^_PID=(\d+)$/))){ pid = m[1]; continue; }
    if ((m = x.match(/^_COMM=(.+)$/))){ comm = m[1]; continue; }
    if ((m = x.match(/^_SYSTEMD_UNIT=(.+)$/))){ args.push('-u', m[1]); continue; }
    if (x==='-b' || x==='--boot'){ if (a[i+1] && /^-?\d+$/.test(a[i+1])){ boot = +a[++i]; } continue; }
    if ((m = x.match(/^(?:-b|--boot=)(-?\d+)$/))){ boot = +m[1]; continue; }
    if (x==='-n' || x==='--lines'){ if (a[i+1] && /^\d+$/.test(a[i+1])) n = +a[++i]; else n = 10; continue; }
    if ((m = x.match(/^(?:-n|--lines=)(\d+)$/))){ n = +m[1]; continue; }
    if (x==='-e' || x==='--pager-end'){ n = n || 1000; continue; }
    if (x==='-r' || x==='--reverse'){ rev = true; continue; }
    if (x==='--no-pager' || x==='-q' || x==='--quiet' || x==='--no-hostname'){ continue; }
    args.push(x);
  }
  // -xe, -xeu: -e znamená koniec
  for (let i=0;i<args.length;i++){ if (/^-[a-z]*e[a-z]*$/.test(args[i]) && args[i]!=='-e'){ n = n || 1000; const rest = args[i].replace('e',''); if (rest==='-') args.splice(i--,1); else args[i] = rest; } }
  if (args.includes('--list-boots')){
    const y = new Date(); y.setDate(y.getDate()-1); const t = new Date();
    const f = d => `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]} ${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
    return `IDX BOOT ID                          FIRST ENTRY                 LAST ENTRY\n -1 4e7a19c2b85d4f0e9a3c1b6d2f8e0a57 ${f(y)} 07:58:02 CET ${f(y)} 23:59:58 CET\n  0 9b1c7e3a2d5f4e6b8c0a1d3f5e7b9c2d ${f(t)} 08:00:01 CET ${f(t)} ${z(t.getHours())}:${z(t.getMinutes())}:${z(t.getSeconds())} CET\n`;
  }
  const sT = this._jTime(since), uT = this._jTime(until);
  if (sT===undefined) return {e:`Failed to parse timestamp: ${since}\n(skús napr. --since "10:00", --since today, --since "1 hour ago", --since "2026-11-07 09:30")\n`, code:1};
  if (uT===undefined) return {e:`Failed to parse timestamp: ${until}\n`, code:1};
  let r;
  if (boot < -1) return {e:'Data from the specified boot (-' + Math.abs(boot) + ') is not available: No such boot ID in journal\n', code:1};
  if (boot === -1){
    if (this.user!=='root' && !this.inGroup('wheel') && !this.inGroup('adm')) return origJ.call(this, args);
    let L = this._prevBoot();
    const ui = args.indexOf('-u'); if (ui>=0){ const u = this._svcName(args[ui+1]); L = L.filter(l=>l.includes(' '+u+'[') || (u==='sshd' && /OpenSSH|sshd\[/.test(l))); }
    const gi = args.findIndex(x=>x==='-g'||x==='--grep'); if (gi>=0){ const re = new RegExp(args[gi+1],'i'); L = L.filter(l=>re.test(l)); }
    if (args.includes('-k') || args.includes('--dmesg')) L = L.filter(l=>/ kernel: /.test(l));
    if (args.some(x=>/^-p/.test(x))) L = L.filter(l=>/error|fail|Out of memory|denied/i.test(l));
    r = L.join('\n') + (L.length ? '\n' : '');
  } else r = origJ.call(this, args);
  if (r && typeof r==='object' && r.code && !r.o) return r;
  let text = typeof r==='string' ? r : (r.o||'');
  const kern = args.includes('-k') || args.includes('--dmesg');
  if (!(sT || uT || pid || comm || n!=null || rev || fmt || kern) ) return r;
  let lines = text.split('\n').filter(l=>l!=='');
  const isEntry = l => !!tsOf(l);
  let entries = lines.filter(isEntry); const extra = lines.filter(l=>!isEntry(l) && !/^-- No entries --$/.test(l));
  if (kern) entries = entries.filter(l=>/ kernel: /.test(l));
  if (sT) entries = entries.filter(l=>tsOf(l) >= sT);
  if (uT) entries = entries.filter(l=>tsOf(l) <= uT);
  if (pid) entries = entries.filter(l=>new RegExp('\\['+pid+'\\]:').test(l));
  if (comm) entries = entries.filter(l=>new RegExp(' '+comm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\[\\d+\\])?: ').test(l));
  entries.sort((x,y)=>tsOf(x)-tsOf(y));
  if (n!=null) entries = entries.slice(-n);
  if (rev) entries.reverse();
  if (fmt){
    const parse = l => { const m = l.match(/^(\S+ +\d+ \S+) (\S+) ([^:\[]+)(?:\[(\d+)\])?: (.*)$/); return m ? {ts:tsOf(l), host:m[2], comm:m[3], pid:m[4]||'', msg:m[5]} : null; };
    const iso = d => `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}+0100`;
    if (fmt==='short-iso') entries = entries.map(l=>{ const p = parse(l); return p ? `${iso(p.ts)} ${p.host} ${p.comm}${p.pid?'['+p.pid+']':''}: ${p.msg}` : l; });
    else if (fmt==='short-precise') entries = entries.map(l=>l.replace(/^(\S+ +\d+ \d\d:\d\d:\d\d)/, (x)=>x+'.'+String(Math.abs((l.length*7919)%1000000)).padStart(6,'0')));
    else if (fmt==='cat') entries = entries.map(l=>{ const p = parse(l); return p ? p.msg : l; });
    else if (fmt==='json') entries = entries.map(l=>{ const p = parse(l); return p ? JSON.stringify({__REALTIME_TIMESTAMP:String(p.ts.getTime()*1000), _HOSTNAME:p.host, SYSLOG_IDENTIFIER:p.comm, _PID:p.pid||undefined, MESSAGE:p.msg, PRIORITY:/error|fail|denied/i.test(p.msg)?'3':'6'}) : l; });
    else if (fmt==='json-pretty' || fmt==='verbose') entries = entries.map(l=>{ const p = parse(l); if (!p) return l; const unit = p.comm==='systemd' ? ((p.msg.match(/^(\S+\.service)/)||[])[1]||'init.scope') : (p.comm.replace(/^\(|\)$/g,'')+'.service'); return `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][p.ts.getDay()]} ${iso(p.ts).replace('T',' ').replace('+0100',' CET')} [s=4c1e…;i=${(p.ts.getTime()/1000|0).toString(16)}]\n    PRIORITY=${/error|fail|denied/i.test(p.msg)?3:6}\n    _HOSTNAME=${p.host}\n    SYSLOG_IDENTIFIER=${p.comm}\n${p.pid?`    _PID=${p.pid}\n    _COMM=${p.comm}\n`:''}    _SYSTEMD_UNIT=${unit}\n    _BOOT_ID=9b1c7e3a2d5f4e6b8c0a1d3f5e7b9c2d\n    MESSAGE=${p.msg}`; });
    else if (!/^short/.test(fmt)) return {e:`Unknown output format '${fmt}'.\n(formáty: short, short-iso, short-precise, cat, verbose, json, json-pretty)\n`, code:1};
  }
  const out = entries.length ? entries.join('\n')+'\n' + extra.filter(l=>/^░░|^…/.test(l)).join('\n') + (extra.some(l=>/^░░|^…/.test(l))?'\n':'') : '-- No entries --\n';
  return typeof r==='string' ? out : Object.assign({}, r, {o:out});
};
})();
