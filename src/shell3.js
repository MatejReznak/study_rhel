/* =========================================================
   SIMULÁTOR: podpora pre incidenty a skúšku
   DNS, sshd port, plný disk + lsof, sudo -u, zamknuté účty,
   klonovanie stroja
   ========================================================= */
(function(){
'use strict';
const P = window.Machine.prototype;
const {pad} = window.MachineData;

/* ---------- sudo -u ---------- */
const origExec = P.exec;
P.exec = function(args, stdin, piped){
  if (args[0]==='sudo' && (args[1]==='-u' || /^-u\w/.test(args[1]||''))){
    const target = args[1]==='-u' ? args[2] : args[1].slice(2);
    const rest = args.slice(args[1]==='-u'?3:2);
    if (this.user!=='root' && !this.groups.wheel.mem.includes(this.user)) return {e:`${this.user} is not in the sudoers file.  This incident will be reported.\n`,code:1};
    if (target!=='root' && !this.users[target] && !this.sysusers.find(x=>x[0]===target)) return {e:`sudo: unknown user ${target}\nsudo: error initializing audit plugin sudoers_audit\n`,code:1};
    const prev = this.user; this.user = target;
    try { return origExec.call(this, rest, stdin, piped); } finally { this.user = prev; }
  }
  return origExec.call(this, args, stdin, piped);
};
/* sysusers need a group lookup for can() */
const origInGroup = P.inGroup;
P.inGroup = function(g){
  if (!this.users[this.user]){ const su = this.sysusers.find(x=>x[0]===this.user); if (su){ const gr = this.groups[g]; return !!gr && (gr.gid===su[2] || gr.mem.includes(this.user)); } }
  return origInGroup.call(this, g);
};
P.canAs = function(user, path, bit){
  const prev = this.user; this.user = user;
  try {
    const abs = this.norm(path); const parts = abs.split('/').filter(Boolean);
    let cur = '';
    for (let i=0;i<parts.length;i++){ const n = this._lookup(cur||'/'); if (!n || !this.can(n,1)) return false; cur += '/'+parts[i]; }
    const n = this._lookup(abs); return !!n && this.can(n, bit);
  } finally { this.user = prev; }
};

/* ---------- zamknuté účty v /etc/shadow ---------- */
const origRefresh = P._refreshAccountFiles;
P._refreshAccountFiles = function(){
  origRefresh.call(this);
  const sh = this._lookup('/etc/shadow'); if (!sh) return;
  sh.c = sh.c.split('\n').map(l=>{ const n = l.split(':')[0]; return (this.users[n] && this.users[n].locked && !l.startsWith(n+':!')) ? l.replace(n+':', n+':!') : l; }).join('\n');
};
const origUsermod = P.c_usermod;
P.c_usermod = function(a){ const r = origUsermod.call(this, a); this._refreshAccountFiles(); return r; };
const origPasswd = P.c_passwd;
P.c_passwd = function(a, s){ const r = origPasswd.call(this, a, s); this._refreshAccountFiles(); return r; };

/* ---------- DNS a mená ---------- */
const DNS = {'db01.firma.local':'10.0.20.40','web01.firma.local':'10.0.20.31','web02.firma.local':'10.0.20.32','mon01.firma.local':'10.0.20.50','backup01.firma.local':'10.0.20.60','redhat.com':'23.42.177.205','www.redhat.com':'23.42.177.205','google.com':'142.250.180.206','access.redhat.com':'23.42.177.206'};
P._resolve = function(name){
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return name;
  if (name==='localhost' || name===this.hostname || name===this.hostname.split('.')[0]) return name==='localhost'?'127.0.0.1':this.net.ip.split('/')[0];
  const hosts = (this.read('/etc/hosts')||'').split('\n');
  for (const l of hosts){ const t = l.replace(/#.*/,'').trim().split(/\s+/); if (t.length>1 && t.slice(1).includes(name)) return t[0]; }
  const rc = this.read('/etc/resolv.conf')||'';
  const ns = (rc.match(/^nameserver\s+(\S+)/m)||[])[1];
  if (!['10.0.20.2','8.8.8.8','1.1.1.1'].includes(ns)) return null;
  const search = (rc.match(/^search\s+(.+)$/m)||[])[1];
  if (DNS[name]) return DNS[name];
  if (search && !name.includes('.')) for (const d of search.split(/\s+/)) if (DNS[name+'.'+d]) return DNS[name+'.'+d];
  return undefined;
};
P.c_ping = function(a){
  const o=this.opts(a,['c','i','W']); const h=o.pos[0];
  if (!h) return {e:'ping: usage error: Destination address required\n',code:1};
  const ip = this._resolve(h);
  if (ip===null) return {e:`ping: ${h}: Temporary failure in name resolution\n`,code:2};
  if (ip===undefined) return {e:`ping: ${h}: Name or service not known\n`,code:2};
  const c = +(o.v.c||4);
  const reach = /^(127\.|10\.0\.20\.)/.test(ip) ? ['10.0.20.1','10.0.20.2','10.0.20.31','10.0.20.32','10.0.20.40','10.0.20.50','10.0.20.60','10.0.20.15'].includes(ip) || ip.startsWith('127.') || ip===this.net.ip.split('/')[0] : true;
  let s = `PING ${h} (${ip}) 56(84) bytes of data.\n`;
  if (!reach){ s += `From ${this.net.ip.split('/')[0]} icmp_seq=1 Destination Host Unreachable\n\n--- ${h} ping statistics ---\n${c} packets transmitted, 0 received, +${c} errors, 100% packet loss, time ${c*1000-1}ms\n`; return {o:s,code:1}; }
  for (let i=1;i<=Math.min(c,10);i++) s += `64 bytes from ${ip}: icmp_seq=${i} ttl=${ip.startsWith('10.')||ip.startsWith('127.')?64:117} time=${(ip.startsWith('10.')?0.3+i*0.07:12.1+i*0.4).toFixed(2)} ms\n`;
  s += `\n--- ${h} ping statistics ---\n${c} packets transmitted, ${c} received, 0% packet loss, time ${c*1000-1}ms\n`;
  if (!o.v.c) s += '(bez -c beží ping donekonečna, ukončíš Ctrl+C. V simulátore som spravil 4 pokusy.)\n';
  return s;
};
const origGetent = P.c_getent;
P.c_getent = function(a){ if (a[0]==='hosts'){ const ip = this._resolve(a[1]||''); return ip ? `${ip}       ${a[1]}\n` : {o:'',code:2}; } return origGetent.call(this, a); };
P.c_dig = function(a){
  const h=a.filter(x=>!x.startsWith('-')&&!x.startsWith('+')&&!x.startsWith('@'))[0]||'.';
  const at = (a.find(x=>x.startsWith('@'))||'').slice(1);
  const rc = this.read('/etc/resolv.conf')||''; const ns = at || (rc.match(/^nameserver\s+(\S+)/m)||[])[1] || '';
  if (!['10.0.20.2','8.8.8.8','1.1.1.1'].includes(ns)) return {o:`;; communications error to ${ns}#53: timed out\n;; communications error to ${ns}#53: timed out\n\n; <<>> DiG 9.16.23-RH <<>> ${h}\n;; global options: +cmd\n;; no servers could be reached\n`,code:9};
  const ip = DNS[h] || DNS[h+'.firma.local'];
  if (a.includes('+short')) return ip?ip+'\n':'';
  return `; <<>> DiG 9.16.23-RH <<>> ${h}\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ${ip?'NOERROR':'NXDOMAIN'}, id: 41822\n\n;; QUESTION SECTION:\n;${h}.\t\t\tIN\tA\n\n`+(ip?`;; ANSWER SECTION:\n${h}.\t300\tIN\tA\t${ip}\n\n`:'')+`;; SERVER: ${ns}#53(${ns}) (UDP)\n;; Query time: 2 msec\n`;
};
P.c_host = function(a){ const ip = this._resolve(a[0]||''); if (ip===null) return {e:`;; connection timed out; no servers could be reached\n`,code:1}; return ip ? `${a[0]} has address ${ip}\n` : {e:`Host ${a[0]} not found: 3(NXDOMAIN)\n`,code:1}; };
P.c_nslookup = function(a){ const ip = this._resolve(a[0]||''); const ns = ((this.read('/etc/resolv.conf')||'').match(/^nameserver\s+(\S+)/m)||[])[1]; if (ip===null) return {o:`;; connection timed out; no servers could be reached\n`,code:1}; return `Server:\t\t${ns}\nAddress:\t${ns}#53\n\n`+(ip?`Name:\t${a[0]}\nAddress: ${ip}\n`:`** server can't find ${a[0]}: NXDOMAIN\n`); };
P._writeResolv = function(){ const n = this._lookup('/etc/resolv.conf'); const c = `# Generated by NetworkManager\nsearch firma.local\nnameserver ${this.net.dns}\n`; if (n) n.c = c; else this._mkPath('/etc/resolv.conf','f',0o644,'root','root',c); const k = this._lookup('/etc/NetworkManager/system-connections/ens192.nmconnection'); if (k) k.c = k.c.replace(/^dns=.*$/m, 'dns='+this.net.dns+';'); };
const origNmcli = P.c_nmcli;
P.c_nmcli = function(a){
  const r = origNmcli.call(this, a);
  const w = a.filter(x=>!x.startsWith('-'));
  if (/^c(on(nection)?)?$/.test(w[0]||'') && w[1]==='up' && this.user==='root') this._writeResolv();
  if (/^c(on(nection)?)?$/.test(w[0]||'') && /^mod/.test(w[1]||'') && this.user==='root'){ const k = this._lookup('/etc/NetworkManager/system-connections/ens192.nmconnection'); if (k && this.net.pendingDns) k.c = k.c.replace(/^dns=.*$/m, 'dns='+this.net.pendingDns.replace(/"/g,'')+';'); }
  return r;
};
const origSystemctl = P.c_systemctl;

/* ---------- sshd port ---------- */
P._sshdPort = function(){
  const files = [];
  const dn = this._lookup('/etc/ssh/sshd_config.d'); if (dn) Object.keys(dn.c).filter(f=>f.endsWith('.conf')).sort().forEach(f=>files.push('/etc/ssh/sshd_config.d/'+f));
  files.push('/etc/ssh/sshd_config');
  for (const f of files){ const m = (this.read(f)||'').match(/^\s*Port\s+(\d+)/m); if (m) return +m[1]; }
  return 22;
};
P._sshdCheck = function(){
  const KW = /^(Port|ListenAddress|PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|MaxAuthTries|X11Forwarding|AllowUsers|AllowGroups|DenyUsers|DenyGroups|Include|Subsystem|SyslogFacility|ChallengeResponseAuthentication|KbdInteractiveAuthentication|GSSAPIAuthentication|UsePAM|ClientAliveInterval|ClientAliveCountMax|LoginGraceTime|PermitEmptyPasswords|Banner|AuthorizedKeysFile|HostKey|LogLevel|MaxSessions|Match|UseDNS|PrintMotd|AcceptEnv)$/;
  const files = ['/etc/ssh/sshd_config'];
  const dn = this._lookup('/etc/ssh/sshd_config.d'); if (dn) Object.keys(dn.c).filter(f=>f.endsWith('.conf')).sort().forEach(f=>files.push('/etc/ssh/sshd_config.d/'+f));
  for (const f of files){
    const L = (this.read(f)||'').split('\n');
    for (let i=0;i<L.length;i++){ const l = L[i].trim(); if (!l || l.startsWith('#')) continue; const k = l.split(/\s+/)[0]; if (!KW.test(k)) return `${f}: line ${i+1}: Bad configuration option: ${k}\n${f}: terminating, 1 bad configuration options`; const v = l.split(/\s+/)[1]||''; if (/^(PermitRootLogin)$/.test(k) && !/^(yes|no|prohibit-password|without-password|forced-commands-only)$/.test(v)) return `${f} line ${i+1}: unsupported option "${v}".`; if (/^(PasswordAuthentication|PubkeyAuthentication|X11Forwarding|UsePAM)$/.test(k) && !/^(yes|no)$/.test(v)) return `${f} line ${i+1}: unsupported option "${v}".`; }
  }
  return null;
};
P.c_sshd = function(a){ if (a.includes('-t') || a.includes('-T')){ if (this.user!=='root') return {e:'sshd: no hostkeys available -- exiting. (spusti cez sudo)\n',code:1}; const e = this._sshdCheck(); if (e) return {e:e+'\n',code:255}; if (a.includes('-T')) return `port ${this._sshdPort()}\npermitrootlogin ${((this.read('/etc/ssh/sshd_config.d/10-firma.conf')||'').match(/PermitRootLogin\s+(\S+)/)||[])[1]||'prohibit-password'}\n`; return ''; } return {e:'(sshd sa spúšťa cez systemctl; na test konfigurácie: sudo sshd -t)\n',code:1}; };
P._sshdBad = function(){
  const e = this._sshdCheck(); if (e) return {st:'255/EXCEPTION', msg:'sshd[3301]: '+e.split('\n')[0]};
  const port = this._sshdPort();
  if (port!==22 && this.se.mode==='Enforcing' && !this._sePortAllowed('ssh_port_t', port)) return {st:'255/EXCEPTION', msg:`sshd[3301]: error: Bind to port ${port} on 0.0.0.0 failed: Permission denied.\nsshd[3301]: error: Bind to port ${port} on :: failed: Permission denied.\nsshd[3301]: fatal: Cannot bind any address.\nsetroubleshoot[3310]: SELinux is preventing /usr/sbin/sshd from name_bind access on the tcp_socket port ${port}.`};
  return null;
};
P.c_systemctl = function(a){
  const r = origSystemctl.call(this, a);
  const res = typeof r==='string' ? {o:r} : r;
  const o = this.opts(a,['type','state']); const sub = o.pos[0]; const units = o.pos.slice(1).map(u=>this._svcName(u));
  if (units.includes('sshd') && (['start','restart','reload','reload-or-restart','try-restart'].includes(sub) || (sub==='enable' && o.has('now'))) && this.svc.sshd.active){
    const bad = this._sshdBad();
    if (bad){ this.svc.sshd.active=false; this.svc.sshd.failed=true; this.dynLog.sshd = bad.msg.split('\n').concat([`sshd.service: Main process exited, code=exited, status=${bad.st}`,`sshd.service: Failed with result 'exit-code'.`]); res.e = (res.e||'') + `Job for sshd.service failed because the control process exited with error code.\nSee "systemctl status sshd.service" and "journalctl -xeu sshd.service" for details.\n`; res.code=1; }
    else delete this.dynLog.sshd;
  }
  if (sub==='status' && units.includes('sshd') && this.svc.sshd.failed && this.dynLog.sshd){ res.o = (res.o||'').replace(/\n$/,'') + '\n\n' + this.dynLog.sshd.map(l=>`Nov 01 12:00:01 ${this.hostname} ${l.includes('[')?l:'systemd[1]: '+l}`).join('\n') + '\n'; }
  if (sub==='status' && units.includes('sshd') && this.svc.sshd.active) res.o = (res.o||'').replace('sshd: /usr/sbin/sshd -D', 'sshd: /usr/sbin/sshd -D');
  return res;
};
const origJournal = P.c_journalctl;
P.c_journalctl = function(a){
  const o = this.opts(a,['u','p','n','since','until','b','g','t','o']);
  const k = o.v.u ? this._svcName(o.v.u) : null;
  if (k==='sshd' && this.dynLog.sshd) return this.dynLog.sshd.map(l=>`Nov 01 12:00:01 ${this.hostname} ${l.includes('[')?l:'systemd[1]: '+l}`).join('\n')+'\n';
  return origJournal.call(this, a);
};
const origSockets = P._sockets;
P._sockets = function(){
  const s = origSockets.call(this); const port = this._sshdPort();
  s.forEach(x=>{ if (x.proc==='sshd' && x.st==='LISTEN') x.port = port; });
  return s;
};

/* ---------- plný disk ---------- */
P._hogGB = function(mountDir){
  let gb = 0;
  for (const h of (this.hogs||[])){
    const n = this._lookup(h.path);
    const under = mountDir==='/' ? !this.mounts.some(m=>m.dir!=='/' && h.path.startsWith(m.dir+'/')) : h.path.startsWith(mountDir+'/');
    if (!under) continue;
    if (n && n.hog) gb += n.hog;
    else if (!n || !n.hog){ const s = h.svc && this.svc[h.svc]; if (!n && s && s.active && s.since <= h.t0) gb += h.gb; }
  }
  return gb;
};
P._heldFiles = function(){ return (this.hogs||[]).filter(h=>{ const n=this._lookup(h.path); const s=h.svc&&this.svc[h.svc]; return !n && s && s.active && s.since<=h.t0; }); };
const origDf = P.c_df;
P.c_df = function(a){
  const saved = this.mounts;
  this.mounts = saved.map(m=>Object.assign({}, m, {used: Math.min(m.size*0.999, m.used + this._hogGB(m.dir))}));
  try { return origDf.call(this, a); } finally { this.mounts = saved; }
};
const origWrite = P._writeFile;
P._writeFile = function(p, data, append){
  const n = this._lookup(this.norm(p));
  const r = origWrite.call(this, p, data, append);
  if (n && !r && !append){ n.big = 0; n.hog = 0; }
  return r;
};
P.c_truncate = function(a){
  const o = this.opts(a,['s']); let e='';
  for (const f of o.pos){ const n = this.node(f); if (!n){ const r=this._writeFile(f,'',false); if (r) e+=r.replace('-bash','truncate'); continue; } if (!this.can(n,2)){ e+=`truncate: cannot open '${f}' for writing: Permission denied\n`; continue; } if (o.v.s==='0'){ n.c=''; n.big=0; n.hog=0; } }
  return {e, code:e?1:0};
};
P.c_lsof = function(a){
  if (a.includes('+L1')){
    if (this.user!=='root') return {e:'(bez sudo uvidíš len svoje procesy)\n', o:'', code:1};
    const H = this._heldFiles();
    return 'COMMAND  PID USER   FD   TYPE DEVICE    SIZE/OFF NLINK    NODE NAME\n' + H.map(h=>`${pad(h.svc,7,true)} ${pad(4321,4)} root    3w   REG  253,0 ${pad(Math.round(h.gb*1073741824),11)}     0 1048601 ${h.path} (deleted)`).join('\n') + (H.length?'\n':'');
  }
  return 'COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nsshd    1032 root    3u  IPv4  21841      0t0  TCP *:ssh (LISTEN)\n';
};

/* ---------- reboot: sshd ---------- */
const origReboot = P.c_reboot;
P.c_reboot = function(a){
  const r = origReboot.call(this, a);
  if (this.user==='admin' && this.svc.sshd.active && this._sshdBad()){ this.svc.sshd.active=false; this.svc.sshd.failed=true; this.dynLog.sshd = this._sshdBad().msg.split('\n'); if (r && r.o) r.o += '  • sshd pri štarte zlyhal: na server sa teraz nedá pripojiť cez SSH (si na konzole).\n'; }
  return r;
};

/* ---------- crontab zo súboru / stdin ---------- */
const origCrontab = P.c_crontab;
P.c_crontab = function(a, stdin){
  const o = this.opts(a,['u']); const u = o.v.u||this.user;
  if (o.pos.length && !o.has('l') && !o.has('e') && !o.has('r')){
    if (o.v.u && this.user!=='root') return {e:'must be privileged to use -u\n',code:1};
    const src = o.pos[0]==='-' ? (stdin||'') : this.read(o.pos[0]);
    if (src==null) return {e:`${o.pos[0]}: No such file or directory\n`,code:1};
    const bad = src.split('\n').find(l=>l.trim() && !l.trim().startsWith('#') && !/^\s*\w+=/.test(l) && !/^\s*(@\w+|(\S+\s+){4}\S+)\s+\S/.test(l));
    if (bad) return {e:`"-":1: bad minute\nerrors in crontab file, can't install.\n`,code:1};
    this.crontabs[u] = src; return '';
  }
  return origCrontab.call(this, a, stdin);
};
/* ---------- semanage: porty, ktoré už majú typ ---------- */
const PREDEF_PORTS = {8081:'transproxy_port_t', 8080:'http_cache_port_t', 8443:'http_port_t', 3128:'squid_port_t', 9090:'websm_port_t'};
const origSemanage = P.c_semanage;
P.c_semanage = function(a){
  if (a[0]==='port' && a.includes('-l')){
    const r = origSemanage.call(this, a); const txt = typeof r==='string' ? r : r.o;
    return txt + (this.se.extraPorts.some(x=>x.port===8081) ? '' : 'transproxy_port_t              tcp      8081\n') + 'squid_port_t                   tcp      3128, 3401, 4827\nwebsm_port_t                   tcp      9090\n';
  }
  if (a[0]==='port' && (a.includes('-a') || a.includes('-m')) && this.user==='root'){
    const t = a[a.indexOf('-t')+1]; const port = +a[a.length-1]; const pre = PREDEF_PORTS[port];
    const mine = this.se.extraPorts.find(p=>p.port===port);
    if (a.includes('-a') && (pre || mine) && !(pre===t)) return {e:`ValueError: Port tcp/${port} already defined\n(port už má typ ${mine?mine.t:pre}; zmeň ho cez semanage port -m -t ${t} -p tcp ${port})\n`,code:1};
    if (a.includes('-m')){
      if (!pre && !mine) return {e:`ValueError: Port tcp/${port} is not defined\n(port ešte nemá typ: pridaj ho cez semanage port -a)\n`,code:1};
      this.se.extraPorts = this.se.extraPorts.filter(p=>p.port!==port); this.se.extraPorts.push({t, port}); return '';
    }
  }
  return origSemanage.call(this, a);
};
/* ---------- klon (na test „po reštarte") ---------- */
P.clone = function(){
  const data = {};
  for (const k of Object.keys(this)) data[k] = this[k];
  const copy = structuredClone(data);
  const m = Object.create(window.Machine.prototype);
  Object.assign(m, copy);
  return m;
};

/* ---------- Ansible kolekcie (ansible-core má len ansible.builtin) ---------- */
const COLL_VER = {'ansible.posix':'1.6.2','community.general':'9.5.0','containers.podman':'1.16.2'};
P._collDirs = function(){ return [this.home+'/.ansible/collections/ansible_collections','/usr/share/ansible/collections/ansible_collections']; };
P._hasColl = function(ns){ const [a,b]=ns.split('.'); return this._collDirs().some(d=>this.exists(d+'/'+a+'/'+b)); };
P._missingColl = function(mod){
  const p = (mod||'').split('.'); if (p.length<3) return null;
  const ns = p[0]+'.'+p[1]; if (ns==='ansible.builtin' || ns==='ansible.legacy') return null;
  return this._hasColl(ns) ? null : ns;
};
const resolveErr = (mod)=>`ERROR! couldn't resolve module/action '${mod}'. This often indicates a misspelling, missing collection, or incorrect module path.\n`;
const collHint = (mod)=>{ const ns = mod.split('.').slice(0,2).join('.'); return `\n(Modul ${mod} nie je súčasťou ansible-core – ten obsahuje len ansible.builtin.\n Doinštaluj kolekciu: ansible-galaxy collection install ${ns}\n alebo použi RHEL System Roles: sudo dnf install rhel-system-roles)\n`; };

P.c_ansible_galaxy = function(a){
  const args = a.filter(x=>x!=='-v');
  if (args[0]==='role') return {o:'(simulácia) Na RHEL sa namiesto rolí z Galaxy zvyčajne používajú rhel-system-roles: sudo dnf install rhel-system-roles\n'};
  if (args[0]!=='collection') return {e:'usage: ansible-galaxy [-h] [--version] [-v] TYPE ...\n\npositional arguments:\n  TYPE\n    collection   Manage an Ansible Galaxy collection.\n    role         Manage an Ansible Galaxy role.\n',code:2};
  const sub = args[1]; const base = this.home+'/.ansible/collections/ansible_collections';
  if (sub==='list'){
    let out = '';
    for (const d of this._collDirs()){
      const rows = Object.keys(COLL_VER).filter(ns=>{ const [x,y]=ns.split('.'); return this.exists(d+'/'+x+'/'+y); });
      if (!rows.length) continue;
      out += `\n# ${d}\nCollection        Version\n----------------- -------\n` + rows.map(ns=>pad(ns,17,true)+' '+COLL_VER[ns]).join('\n') + '\n';
    }
    return out || {e:'[WARNING]: No collections found\n(ansible-core má zabudované len ansible.builtin; ďalšie moduly sú v kolekciách)\n',code:0};
  }
  if (sub==='install'){
    const names = args.slice(2).filter(x=>!x.startsWith('-'));
    if (!names.length) return {e:'ERROR! You must specify a collection name or a requirements file.\n',code:1};
    const force = a.includes('--force')||a.includes('-f');
    let out = 'Starting galaxy collection install process\nProcess install dependency map\n';
    const todo = [];
    for (const n of names){
      const ns = n.split(':')[0];
      if (!COLL_VER[ns]) return {e:out+`ERROR! Failed to resolve the requested dependencies map. Could not satisfy the following requirements:\n* ${ns}:* (direct request)\n(v simulátore sú dostupné: ${Object.keys(COLL_VER).join(', ')})\n`,code:1};
      if (this._hasColl(ns) && !force) continue;
      todo.push(ns);
    }
    if (!todo.length) return out+'Nothing to do. All requested collections are already installed. If you want to reinstall them, consider using `--force`.\n';
    out += 'Starting collection install process\n';
    const u = this.user, g = u;
    for (const ns of todo){
      const [x,y] = ns.split('.'); const v = COLL_VER[ns];
      let p = '';
      for (const seg of (base+'/'+x+'/'+y).split('/').filter(Boolean)){ p += '/'+seg; if (!this.exists(p)) this._mkPath(p,'d',0o755,u,g); }
      out += `Downloading https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/artifacts/${x}-${y}-${v}.tar.gz to ${this.home}/.ansible/tmp/ansible-local-4121/tmp/${x}-${y}-${v}\nInstalling '${ns}:${v}' to '${base}/${x}/${y}'\n${ns}:${v} was installed successfully\n`;
    }
    return out;
  }
  return {e:`ERROR! (simulácia) podporované: ansible-galaxy collection install|list\n`,code:1};
};

const origPlaybook = P.c_ansible_playbook;
P.c_ansible_playbook = function(a){
  const o = this._ansOpts(a);
  if (!o.version && o.pos[0]){
    const txt = this.read(o.pos[0]);
    if (txt!=null){
      const pp = this._parsePlay(txt);
      if (!pp.err) for (const pl of pp.plays) for (const t of pl.tasks){
        if (!this._missingColl(t.module)) continue;
        const lines = txt.split('\n');
        const mi = lines.findIndex(l=>l.trim()===t.module+':');
        let ti = mi; while (ti>0 && !/^\s*- /.test(lines[ti])) ti--;
        const ind = lines[ti].match(/^ */)[0].length;
        const file = this.norm(o.pos[0]);
        return {e: resolveErr(t.module) + `\nThe error appears to be in '${file}': line ${ti+1}, column ${ind+3}, but may\nbe elsewhere in the file depending on the exact syntax problem.\n\nThe offending line appears to be:\n\n\n${lines[ti]}\n${' '.repeat(ind+2)}^ here\n` + collHint(t.module), code:4};
      }
    }
  }
  return origPlaybook.call(this,a);
};

const origAdhoc = P.c_ansible;
P.c_ansible = function(a){
  const o = this._ansOpts(a);
  if (o.m && this._missingColl(o.m)) return {e: resolveErr(o.m) + collHint(o.m), code:1};
  if (o.m && /^ansible\.posix\.firewalld$/.test(o.m)){ a = a.slice(); a[a.indexOf(o.m)] = 'firewalld'; }
  return origAdhoc.call(this,a);
};

const origDoc = P.c_ansible_doc;
P.c_ansible_doc = function(a){
  const r = origDoc.call(this,a);
  if (a.includes('-l') && typeof r==='string' && !this._hasColl('ansible.posix')) return r.split('\n').filter(l=>!l.startsWith('ansible.posix.')).join('\n');
  return r;
};

})();
