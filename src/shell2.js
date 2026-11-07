/* =========================================================
   ROZŠÍRENIA SIMULÁTORA
   bash skripty, reboot, produkty tretích strán, vlastné služby,
   grubby, ansible, podman/quadlet, tuned, sysctl, leapp
   ========================================================= */
(function(){
'use strict';
const P = window.Machine.prototype;
const D = window.MachineData;
const {PKG_DB, SVC_DEF, PKG_INSTALLED_DEFAULT, pad, permStr} = D;

/* ---------- nové balíky ---------- */
Object.assign(PKG_DB, {
  'postgresql-server':{v:'13.20-1',s:'The programs needed to create and run a PostgreSQL server',repo:'appstream',cmds:['postgresql-setup']},
  'postgresql':{v:'13.20-1',s:'PostgreSQL client programs',repo:'appstream',cmds:['psql']},
  'ansible-core':{v:'2.14.18-1',s:'A radically simple IT automation system',repo:'appstream',cmds:['ansible','ansible-playbook','ansible-doc','ansible-inventory','ansible-galaxy']},
  'rhel-system-roles':{v:'1.95.7-1',s:'Set of interfaces for unified system management',repo:'appstream',cmds:[]},
  'container-tools':{v:'1-14',s:'A meta-package which container tools such as podman, buildah, skopeo, etc.',repo:'appstream',cmds:['buildah','skopeo']},
  'tuned':{v:'2.25.1-1',s:'A dynamic adaptive system tuning daemon',repo:'baseos',cmds:['tuned-adm']},
  'sysstat':{v:'12.5.4-9',s:'Collection of performance monitoring tools for Linux',repo:'appstream',cmds:['iostat','sar','mpstat']},
  'grubby':{v:'8.40-64',s:'Command line tool for updating bootloader configs',repo:'baseos',cmds:['grubby']},
  'dracut':{v:'057-87',s:'Initramfs generator using udev',repo:'baseos',cmds:['dracut']},
  'leapp-upgrade-el9toel10':{v:'0.22.0-2',s:'Leapp repositories for the in-place upgrade to the next major version',repo:'appstream',cmds:['leapp']},
  'dnf-plugins-core':{v:'4.3.0-20',s:'Core Plugins for DNF',repo:'baseos',cmds:[]},
  'pykickstart':{v:'3.32.11-1',s:'Python utilities for manipulating kickstart files',repo:'appstream',cmds:['ksvalidator']}
});
PKG_DB['procps-ng'].cmds.push('sysctl');
PKG_DB['acme-cli'] = {v:'1.8.0-1',s:'ACME command line tools',repo:'acme',cmds:['acme'],vendor:true};
PKG_DB['acme-agent'] = {v:'3.2.1-1',s:'ACME monitoring agent',repo:'@commandline',cmds:['acme-agent'],vendor:true};
['tuned','grubby','dracut','dnf-plugins-core'].forEach(p=>{ if (!PKG_INSTALLED_DEFAULT.includes(p)) PKG_INSTALLED_DEFAULT.push(p); });
Object.assign(SVC_DEF, {
  postgresql:{desc:'PostgreSQL database server', pkg:'postgresql-server', proc:'postmaster', unit:'/usr/lib/systemd/system/postgresql.service'},
  tuned:{desc:'Dynamic System Tuning Daemon', pkg:'tuned', proc:'tuned', unit:'/usr/lib/systemd/system/tuned.service'},
  'acme-agent':{desc:'ACME monitoring agent', pkg:'acme-agent', proc:'acme-agent', unit:'/usr/lib/systemd/system/acme-agent.service'}
});

/* ---------- reset: nové súbory a stav ---------- */
const origReset = P.reset;
P.reset = function(){
  origReset.call(this);
  const v10 = this.ver===10;
  this.svc.tuned = {installed:true, active:true, enabled:true, failed:false, since:new Date(this.now-3600e3*26)};
  this.tuned = 'virtual-guest';
  this.sysctlDef = {'vm.swappiness':'60','net.ipv4.ip_forward':'0','vm.dirty_ratio':'30','vm.dirty_background_ratio':'10','fs.file-max':'9223372036854775807','kernel.pid_max':'4194304','net.core.somaxconn':'4096','net.ipv4.tcp_keepalive_time':'7200','kernel.panic':'0','vm.overcommit_memory':'0','net.ipv4.conf.all.rp_filter':'1'};
  this.sysctl = Object.assign({}, this.sysctlDef);
  this.gpgKeys = new Set(['redhat']);
  this.grub = {args:'ro crashkernel=1G-4G:192M,4G-64G:256M resume=/dev/mapper/rhel-swap rd.lvm.lv=rhel/root rd.lvm.lv=rhel/swap', defaultKernel:this.kernel, kernels:[this.kernel]};
  this.containers = []; this.images = []; this.quadlets = {}; this.lastReload = Date.now();
  this.ansibleDone = {}; this.dynLog = {};
  this.target = 'multi-user.target';
  const F = (p,c,m,u,g)=>{ const n=this._mkPath(p,'f',m||0o644,u||'root',g||u||'root',c); n.ctx=this.defaultCtx(p); n.mt=new Date(this.now-86400e3*2); return n; };
  const Dd = (p,m,u,g)=>{ if (this._lookup(p)) return; const n=this._mkPath(p,'d',m||0o755,u||'root',g||u||'root'); n.ctx=this.defaultCtx(p); };
  Dd('/etc/pki'); Dd('/etc/pki/rpm-gpg');
  F('/etc/pki/rpm-gpg/RPM-GPG-KEY-redhat-release','-----BEGIN PGP PUBLIC KEY BLOCK-----\nmQINBErgSTsBEACh2A4b0O9t+vzC9VrVtL1AKvUWi9OPCjkvR7Xd8DtJxeeMZ5eF\n…\n-----END PGP PUBLIC KEY BLOCK-----\n');
  Dd('/etc/sysctl.d'); F('/etc/sysctl.conf','# sysctl settings are defined through files in\n# /usr/lib/sysctl.d/, /run/sysctl.d/, and /etc/sysctl.d/.\n#\n# Vendors settings live in /usr/lib/sysctl.d/.\n# To override a whole file, create a new file with the same in\n# /etc/sysctl.d/ and put new settings there. To override\n# only specific settings, add a file with a lexically later\n# name in /etc/sysctl.d/ and put new settings there.\n');
  Dd('/etc/tuned'); F('/etc/tuned/active_profile', this.tuned+'\n');
  Dd('/etc/security/limits.d');
  Dd('/etc/containers'); Dd('/etc/containers/systemd');
  F('/etc/containers/registries.conf','unqualified-search-registries = ["registry.access.redhat.com", "registry.redhat.io", "docker.io"]\nshort-name-mode = "enforcing"\n');
  F('/usr/lib/systemd/system/tuned.service', this._unitText('tuned'));
  F('/root/anaconda-ks.cfg',`# Generated by Anaconda 34.25.5.9
# Generated by pykickstart v3.32
#version=RHEL${this.ver}
# Use graphical install
graphical
repo --name="AppStream" --baseurl=file:///run/install/sources/mount-0000-cdrom/AppStream

%addon com_redhat_kdump --enable --reserve-mb='auto'
%end

# Keyboard layouts
keyboard --vckeymap=sk-qwertz --xlayouts='sk (qwerty)'
# System language
lang sk_SK.UTF-8

# Network information
network  --bootproto=static --device=ens192 --ip=10.0.20.31 --netmask=255.255.255.0 --gateway=10.0.20.1 --nameserver=10.0.20.2 --activate
network  --hostname=${this.hostname}

%packages
@^minimal-environment
%end

# Run the Setup Agent on first boot
firstboot --enable

# Generated using Blivet version 3.6.0
ignoredisk --only-use=sda
autopart --type=lvm
# Partition clearing information
clearpart --none --initlabel

# System timezone
timezone Europe/Bratislava --utc

# Root password
rootpw --lock
user --groups=wheel --name=admin --password=$6$hhs3...$Wm1... --iscrypted --gecos="Admin"
`,0o600);
  const H = '/home/admin';
  Dd(H+'/stiahnute',0o755,'admin','admin');
  F(H+'/stiahnute/acme-agent-3.2.1-1.el9.x86_64.rpm','\xedRPM (binárny balík, simulácia)',0o644,'admin','admin').big = 4718592;
  F(H+'/stiahnute/RPM-GPG-KEY-acme','-----BEGIN PGP PUBLIC KEY BLOCK-----\nmQINBGQ7c2kBEAC3vQ…acme…\n-----END PGP PUBLIC KEY BLOCK-----\n',0o644,'admin','admin');
  F(H+'/stiahnute/acme.repo','[acme]\nname=ACME tools for RHEL $releasever\nbaseurl=https://repo.acme.example/rhel/$releasever/x86_64/\nenabled=1\ngpgcheck=1\ngpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-acme\n',0o644,'admin','admin');
  const appka = [
    {p:'appka-2.0/',d:true,m:0o755,u:'1001',g:'1001'},
    {p:'appka-2.0/bin/',d:true,m:0o755,u:'1001',g:'1001'},
    {p:'appka-2.0/bin/appka',m:0o755,c:'#!/bin/bash\n# Appka 2.0 – spúšťací skript\nexec /usr/bin/java -jar /opt/appka/lib/appka.jar --config /opt/appka/conf/appka.conf "$@"\n',u:'1001',g:'1001'},
    {p:'appka-2.0/lib/',d:true,m:0o755,u:'1001',g:'1001'},
    {p:'appka-2.0/lib/appka.jar',m:0o644,c:'PK (java archív)',u:'1001',g:'1001'},
    {p:'appka-2.0/conf/',d:true,m:0o755,u:'1001',g:'1001'},
    {p:'appka-2.0/conf/appka.conf',m:0o640,c:'# Appka 2.0\nport=8080\nlog.dir=/var/log/appka\ndb.url=jdbc:postgresql://db01.firma.local:5432/appka\n',u:'1001',g:'1001'},
    {p:'appka-2.0/contrib/',d:true,m:0o755,u:'1001',g:'1001'},
    {p:'appka-2.0/contrib/appka.service',m:0o644,c:'[Unit]\nDescription=Appka 2.0 application server\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=simple\nUser=appka\nGroup=appka\nExecStart=/opt/appka/bin/appka\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n',u:'1001',g:'1001'},
    {p:'appka-2.0/README',m:0o644,c:'Appka 2.0 – inštalácia na RHEL\n==============================\n1. Rozbaľ do /opt:            tar -xzf appka-2.0.tar.gz -C /opt\n2. Odkaz na aktuálnu verziu:  ln -s /opt/appka-2.0 /opt/appka\n3. Systémový používateľ:      useradd -r -s /sbin/nologin appka\n4. Vlastník a logy:           chown -R appka:appka /opt/appka-2.0\n                              mkdir /var/log/appka; chown appka:appka /var/log/appka\n5. Služba:                    cp /opt/appka/contrib/appka.service /etc/systemd/system/\n                              systemctl daemon-reload; systemctl enable --now appka\n6. Firewall:                  port 8080/tcp\nPožiadavky: java-17-openjdk-headless\n',u:'1001',g:'1001'}];
  F(H+'/stiahnute/appka-2.0.tar.gz','TAR:'+JSON.stringify(appka),0o644,'admin','admin').big = 18874368;
  Dd(H+'/ansible',0o755,'admin','admin');
  F(H+'/ansible/inventory.example','# Inventár: skupiny v [hranatých zátvorkách], pod nimi servery\n[web]\nweb01.firma.local\nweb02.firma.local\n\n[db]\ndb01.firma.local\n\n[all:vars]\nansible_user=admin\n',0o644,'admin','admin');
  F(H+'/ansible/web.yml','---\n- name: Webový server\n  hosts: web\n  become: true\n  tasks:\n    - name: Nainštaluj httpd\n      ansible.builtin.dnf:\n        name: httpd\n        state: present\n\n    - name: Spusti a povoľ httpd\n      ansible.builtin.service:\n        name: httpd\n        state: started\n        enabled: true\n\n    - name: Povoľ http vo firewalle\n      ansible.posix.firewalld:\n        service: http\n        permanent: true\n        immediate: true\n        state: enabled\n',0o644,'admin','admin');
  F(H+'/skripty/kontrola.sh','#!/bin/bash\n# Rýchla kontrola servera\nHOST=$(hostname)\necho "=== Kontrola $HOST ==="\n\nfor SLUZBA in sshd firewalld chronyd; do\n    if systemctl is-active $SLUZBA > /dev/null; then\n        echo "OK    $SLUZBA beží"\n    else\n        echo "CHYBA $SLUZBA nebeží"\n    fi\ndone\n\nOBSADENE=$(df / | tail -n 1 | awk \'{print $5}\' | tr -d %)\nif [ $OBSADENE -gt 80 ]; then\n    echo "POZOR: / je zaplnený na $OBSADENE %"\nelse\n    echo "OK    / je zaplnený na $OBSADENE %"\nfi\n',0o644,'admin','admin');
};

/* ---------- [ / test ---------- */
P._test = function(a){
  a = a.slice();
  if (a[a.length-1]===']' || a[a.length-1]===']]') a.pop();
  const ev = (x)=>{
    if (!x.length) return false;
    if (x[0]==='!') return !ev(x.slice(1));
    const ai = x.indexOf('-a'), oi = x.indexOf('-o'), aa = x.indexOf('&&'), oo = x.indexOf('||');
    if (oo>0 || oi>0){ const k = oo>0?oo:oi; return ev(x.slice(0,k)) || ev(x.slice(k+1)); }
    if (aa>0 || ai>0){ const k = aa>0?aa:ai; return ev(x.slice(0,k)) && ev(x.slice(k+1)); }
    if (x.length===1) return x[0]!=='';
    if (x.length===2){
      const [op, f] = x; const n = this.node(f);
      switch(op){
        case '-e': return !!n; case '-f': return !!n && n.t==='f'; case '-d': return !!n && n.t==='d';
        case '-L': case '-h': return !!this.node(f,false) && this.node(f,false).t==='l';
        case '-r': return !!n && this.can(n,4); case '-w': return !!n && this.can(n,2); case '-x': return !!n && this.can(n,1);
        case '-s': return !!n && n.t==='f' && n.c.length>0;
        case '-z': return f===''; case '-n': return f!=='';
      }
    }
    if (x.length===3){
      const [l, op, r] = x; const ln = parseInt(l,10), rn = parseInt(r,10);
      switch(op){
        case '=': case '==': return l===r; case '!=': return l!==r;
        case '-eq': return ln===rn; case '-ne': return ln!==rn; case '-gt': return ln>rn; case '-lt': return ln<rn; case '-ge': return ln>=rn; case '-le': return ln<=rn;
        case '=~': try { return new RegExp(r).test(l); } catch(e){ return false; }
      }
    }
    return false;
  };
  return {o:'', code: ev(a)?0:1};
};
P['c_['] = function(a){ if (a[a.length-1]!==']') return {e:"-bash: [: missing `]'\n",code:2}; return this._test(a); };
P['c_[['] = function(a){ return this._test(a); };
P.c_test = function(a){ return this._test(a); };
P.c_read = function(a){ (this.env=this.env||{}); a.filter(x=>!x.startsWith('-')).forEach(v=>this.env[v]=''); return {o:'',code:0}; };
P.c_set = function(){ return {o:'',code:0}; };
P.c_local = function(a){ a.forEach(x=>{ const i=x.indexOf('='); (this.env=this.env||{})[i>0?x.slice(0,i):x] = i>0?x.slice(i+1):''; }); return {o:'',code:0}; };
P.c_printf = function(a){ let f = a[0]||''; let i=1; const out = f.replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/%-?(\d*)([sd])/g,(m,w,t)=>{ const v=a[i++]||''; return m.includes('-')?String(v).padEnd(+w||0):String(v).padStart(+w||0); }); return out; };
P.c_seq = function(a){ const n=a.map(Number); let [s,e]= n.length===1?[1,n[0]]:[n[0],n[n.length-1]]; const st = n.length===3?n[1]:1; const o=[]; for (let x=s; st>0?x<=e:x>=e; x+=st){ o.push(x); if (o.length>500) break; } return o.join('\n')+'\n'; };
P.c_basename = function(a){ return (a[0]||'').replace(/\/+$/,'').split('/').pop().replace(a[1]||'\u0000','')+'\n'; };
P.c_dirname = function(a){ const p=(a[0]||'').replace(/\/+$/,''); const i=p.lastIndexOf('/'); return (i<=0?(i===0?'/':'.'):p.slice(0,i))+'\n'; };
P.c_nproc = function(){ return '2\n'; };
P.c_logger = function(a){ const t = a.filter((x,i)=>!x.startsWith('-') && !(a[i-1]||'').startsWith('-t')).join(' '); this._userLog = (this._userLog||[]).concat(t); return ''; };

/* ---------- bash interpret ---------- */
P._runScript = function(text, args, name){
  const saveArgs = this.posArgs, saveName = this.scriptName;
  this.posArgs = args||[]; this.scriptName = name||'bash';
  this.env = this.env||{};
  // 1) rozdeľ na príkazy
  const stmts = [];
  for (let raw of text.split('\n')){
    let line = ''; let q=null;
    for (let i=0;i<raw.length;i++){ const ch=raw[i]; if (q){ line+=ch; if (ch===q) q=null; continue; } if (ch==='"'||ch==="'"){ q=ch; line+=ch; continue; } if (ch==='#' && (i===0 || /\s/.test(raw[i-1]))) break; line+=ch; }
    const parts=[]; let cur=''; q=null; let depth=0;
    for (let i=0;i<line.length;i++){ const ch=line[i]; if (q){ cur+=ch; if (ch===q) q=null; continue; } if (ch==='"'||ch==="'"){ q=ch; cur+=ch; continue; } if (ch==='(') depth++; if (ch===')') depth--; if (ch===';' && line[i+1]!==';' && depth===0){ parts.push(cur); cur=''; continue; } cur+=ch; }
    parts.push(cur);
    for (let p of parts){
      p = p.trim(); if (!p) continue;
      const kw = p.match(/^(then|do|else)\s+(.+)$/);
      if (kw){ stmts.push(kw[1]); stmts.push(kw[2]); continue; }
      stmts.push(p);
    }
  }
  // 2) parser
  let pos = 0;
  const parse = (ends)=>{
    const body = [];
    while (pos < stmts.length){
      const s = stmts[pos];
      const w = s.split(/\s+/)[0];
      if (ends.includes(w) || ends.includes(s)) return body;
      pos++;
      if (w==='if'){
        const node = {t:'if', branches:[], els:null};
        let cond = s.slice(3);
        while (true){
          if (stmts[pos]==='then') pos++;
          const b = parse(['elif','else','fi']);
          node.branches.push({cond, body:b});
          const e = stmts[pos++]||'fi';
          if (e.startsWith('elif')){ cond = e.slice(5); continue; }
          if (e==='else'){ node.els = parse(['fi']); pos++; }
          break;
        }
        body.push(node); continue;
      }
      if (w==='for'){
        const m = s.match(/^for\s+(\w+)(?:\s+in\s+(.*))?$/);
        if (stmts[pos]==='do') pos++;
        const b = parse(['done']); pos++;
        body.push({t:'for', v:m?m[1]:'x', words:m&&m[2]!=null?m[2]:'"$@"', body:b}); continue;
      }
      if (w==='while' || w==='until'){
        if (stmts[pos]==='do') pos++;
        const b = parse(['done']); pos++;
        body.push({t:w, cond:s.slice(w.length+1), body:b}); continue;
      }
      const fm = s.match(/^(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{?$/) || s.match(/^function\s+([A-Za-z_][\w-]*)\s*\{?$/);
      if (fm){ if (stmts[pos]==='{') pos++; const b = parse(['}']); pos++; body.push({t:'fn', name:fm[1], body:b}); continue; }
      if (s==='{'||s==='}') continue;
      body.push({t:'cmd', s});
    }
    return body;
  };
  const ast = parse([]);
  // 3) vykonanie
  let out='', err='', steps=0; const fns = this._fns = this._fns||{};
  const runCmd = (s)=>{
    if (++steps > 4000) throw {limit:true};
    const w = s.split(/\s+/);
    if (w[0]==='exit') throw {exit: w[1]!=null ? parseInt(w[1],10)||0 : this.lastCode};
    if (w[0]==='return') throw {ret: w[1]!=null ? parseInt(w[1],10)||0 : this.lastCode};
    if (w[0]==='break') throw {brk:true};
    if (w[0]==='continue') throw {cont:true};
    if (fns[w[0]]){ const sv = this.posArgs; const toks = this._tokenize(s.slice(w[0].length))||[]; this.posArgs = toks.map(t=>t.v); try { exec(fns[w[0]]); } catch(x){ if (!('ret' in x)) { this.posArgs=sv; throw x; } this.lastCode = x.ret; } this.posArgs = sv; return; }
    if (this.traceOn) err += '+ '+s+'\n';
    const r = this.run(' '+s);
    out += r.o||''; err += r.e||'';
  };
  const exec = (nodes)=>{
    for (const n of nodes){
      if (n.t==='cmd') runCmd(n.s);
      else if (n.t==='fn') fns[n.name] = n.body;
      else if (n.t==='if'){
        let done=false;
        for (const br of n.branches){ runCmd(br.cond); if (this.lastCode===0){ exec(br.body); done=true; break; } }
        if (!done && n.els) exec(n.els);
      }
      else if (n.t==='for'){
        const toks = this._tokenize(n.words)||[];
        const words = []; toks.forEach(t=>{ if (t.op) return; const g = this._glob(t); g.forEach(x=>{ if (!t.q && /\s/.test(x)) words.push(...x.split(/\s+/).filter(Boolean)); else words.push(x); }); });
        for (const wv of words){ this.env[n.v]=wv; try { exec(n.body); } catch(x){ if (x.brk) break; if (x.cont) continue; throw x; } }
      }
      else if (n.t==='while' || n.t==='until'){
        let guard=0;
        while (true){ if (++guard>300) { err+=`${this.scriptName}: cyklus prerušený po 300 opakovaniach (ochrana simulátora)\n`; break; } runCmd(n.cond); const ok = this.lastCode===0; if (n.t==='while' ? !ok : ok) break; try { exec(n.body); } catch(x){ if (x.brk) break; if (x.cont) continue; throw x; } }
      }
    }
  };
  let code = 0;
  try { exec(ast); code = this.lastCode; }
  catch(x){ if (x && 'exit' in x) code = x.exit; else if (x && x.limit) { err += `${this.scriptName}: príliš veľa krokov (ochrana simulátora)\n`; code=1; } else if (x && ('ret' in x)) code = x.ret; else throw x; }
  this.posArgs = saveArgs; this.scriptName = saveName; this.lastCode = code;
  return {o:out, e:err, code};
};

/* ---------- vlastné jednotky, quadlet, porty ---------- */
P._unitFile = function(k){ return this.read('/etc/systemd/system/'+k+'.service'); };
P._dynRegister = function(k){
  if (this.svc[k] && this.svc[k].installed) return true;
  const txt = this._unitFile(k);
  const q = this.quadlets[k];
  if (!txt && !q) return false;
  const desc = txt ? ((txt.match(/^Description=(.*)$/m)||[])[1]||k) : k+' (Podman Quadlet)';
  SVC_DEF[k] = SVC_DEF[k] || {pkg:'__dyn'};
  Object.assign(SVC_DEF[k], {desc, proc:k, unit: txt ? '/etc/systemd/system/'+k+'.service' : '/run/systemd/generator/'+k+'.service', dyn:true});
  this.svc[k] = this.svc[k] || {installed:true, active:false, enabled:false, failed:false, since:new Date()};
  this.svc[k].installed = true;
  return true;
};
P._dynValidate = function(k){
  const q = this.quadlets[k];
  if (q){ return null; }
  const txt = this._unitFile(k); if (!txt) return null;
  const ex = (txt.match(/^ExecStart=(\S+)(.*)$/m)||[]);
  const user = (txt.match(/^User=(\S+)/m)||[])[1];
  if (!ex[1]) return {st:'bad-setting', msg:`${k}.service: Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.`};
  if (user && user!=='root' && !this.users[user] && !this.sysusers.find(x=>x[0]===user)) return {st:'217/USER', msg:`${k}.service: Failed to determine user credentials: No such process\n${k}.service: Failed at step USER spawning ${ex[1]}: No such process`};
  const n = this.node(ex[1]);
  if (!n) return {st:'203/EXEC', msg:`${k}.service: Failed to locate executable ${ex[1]}: No such file or directory\n${k}.service: Failed at step EXEC spawning ${ex[1]}: No such file or directory`};
  if (!(n.m & 0o111)) return {st:'203/EXEC', msg:`${k}.service: Failed to execute ${ex[1]}: Permission denied\n${k}.service: Failed at step EXEC spawning ${ex[1]}: Permission denied`};
  if (k==='appka' || /appka/.test(ex[1])){
    const cfg = this.read('/opt/appka/conf/appka.conf');
    if (cfg==null) return {st:'1/FAILURE', msg:`appka[4120]: ERROR: konfigurácia /opt/appka/conf/appka.conf sa nedá prečítať`};
    const ld = this.node('/var/log/appka');
    const u = user || 'root';
    if (!ld) return {st:'1/FAILURE', msg:`appka[4120]: ERROR: nemôžem otvoriť /var/log/appka/appka.log: No such file or directory`};
    if (u!=='root' && ld.u!==u && !((ld.m & 0o002))) return {st:'1/FAILURE', msg:`appka[4120]: ERROR: nemôžem otvoriť /var/log/appka/appka.log: Permission denied`};
    if (!this.pkgs.has('java-17-openjdk-headless')) return {st:'127', msg:`appka[4120]: /opt/appka/bin/appka: line 3: /usr/bin/java: No such file or directory`};
  }
  if (k==='acme-agent' && !this.read('/etc/acme/agent.yml')) return {st:'1/FAILURE', msg:'acme-agent[4301]: config /etc/acme/agent.yml missing'};
  return null;
};
PKG_DB['java-17-openjdk-headless'] = {v:'17.0.15.0.6-2',s:'OpenJDK 17 Runtime Environment (headless)',repo:'appstream',cmds:['java']};
P._dynPort = function(k){
  if (k==='appka'){ const c=this.read('/opt/appka/conf/appka.conf')||''; return +((c.match(/^port=(\d+)/m)||[])[1]||8080); }
  if (k==='acme-agent') return 9100;
  if (k==='postgresql') return 5432;
  const txt = this._unitFile(k)||''; const m = txt.match(/--port[ =](\d+)/); return m?+m[1]:null;
};
const origSystemctl = P.c_systemctl;
P.c_systemctl = function(a){
  const o = this.opts(a,['type','state']);
  const sub = o.pos[0];
  if (sub==='daemon-reload'){
    if (this.user!=='root') return {e:'Failed to reload daemon: Access denied\n',code:1};
    this.lastReload = Date.now() + 1;
    this.quadlets = {};
    for (const [dir, rootful] of [['/etc/containers/systemd',true], [this.home+'/.config/containers/systemd',false]]){
      const dn = this.node(dir); if (!dn || dn.t!=='d') continue;
      for (const [f, n] of Object.entries(dn.c)){ if (!f.endsWith('.container') || n.t!=='f') continue; const k=f.replace(/\.container$/,''); const img=(n.c.match(/^Image=(\S+)/m)||[])[1]; const ports=[...n.c.matchAll(/^PublishPort=(\S+)/gm)].map(x=>x[1]); this.quadlets[k] = {img, ports, install:/^\[Install\]/m.test(n.c), rootful}; this._dynRegister(k); }
    }
    return '';
  }
  if (sub==='isolate'){ if (this.user!=='root') return {e:'Failed to start rescue.target: Access denied\n',code:1}; return {o:`(simulácia) systemd by teraz zastavil všetko, čo ${o.pos[1]} nepotrebuje. Pri rescue.target by si cez SSH stratil spojenie: robí sa z konzoly.\n`}; }
  if (sub==='reboot' || sub==='poweroff'){ return sub==='reboot' ? this.c_reboot([]) : {o:'(simulácia) poweroff: server by sa vypol. Skús radšej reboot.\n'}; }
  if (sub==='list-timers') return 'NEXT                         LEFT        LAST                         PASSED  UNIT                         ACTIVATES\nMon 2026-11-02 00:00:00 CET  11h left    Sun 2026-11-01 00:00:01 CET  12h ago logrotate.timer              logrotate.service\nMon 2026-11-02 09:12:40 CET  20h left    Sun 2026-11-01 09:12:01 CET  3h ago  dnf-makecache.timer          dnf-makecache.service\n'+(this.svc.zaloha?'Mon 2026-11-02 02:30:00 CET  13h left    -                            -       zaloha.timer                 zaloha.service\n':'')+'\n2 timers listed.\n';
  const units = o.pos.slice(1).map(u=>this._svcName(u));
  units.forEach(k=>this._dynRegister(k));
  let warn = '';
  for (const k of units){
    const f = this.node('/etc/systemd/system/'+k+'.service');
    if (f && f.mt && f.mt.getTime() > (this.lastReload||0) && ['start','restart','enable','status'].includes(sub)) warn += `Warning: The unit file, source configuration file or drop-ins of ${k}.service changed on disk. Run 'systemctl daemon-reload' to reload units.\n`;
  }
  if (sub==='enable' && units.some(k=>this.quadlets[k]) && this.user==='root'){
    const k = units.find(k=>this.quadlets[k]);
    return {e:`Failed to enable unit: Unit /run/systemd/generator/${k}.service is transient or generated.\n(Quadlet služby sa nepovoľujú cez enable. Do .container súboru pridaj sekciu [Install] s WantedBy=multi-user.target default.target a sprav daemon-reload.)\n`,code:1};
  }
  const r = origSystemctl.call(this, a);
  const res = typeof r==='string' ? {o:r} : r;
  // post-validácia spustenia
  if (['start','restart','reload-or-restart','try-restart'].includes(sub) || (sub==='enable' && o.has('now'))){
    for (const k of units){
      const s = this.svc[k]; if (!s || !s.active) continue;
      let bad = null;
      if (k==='postgresql' && !this.exists('/var/lib/pgsql/data/PG_VERSION')) bad = {st:'1/FAILURE', msg:'postgresql-check-db-dir[3501]: Directory "/var/lib/pgsql/data" is missing or empty.\npostgresql-check-db-dir[3501]: Use "/usr/bin/postgresql-setup --initdb"\npostgresql-check-db-dir[3501]: to initialize the database cluster.'};
      else if (SVC_DEF[k] && (SVC_DEF[k].dyn || k==='acme-agent')) bad = this._dynValidate(k);
      if (bad){
        s.active=false; s.failed=true; s.failSt = bad.st; s.failResult = bad.result || 'exit-code';
        this.dynLog[k] = bad.msg.split('\n').concat(bad.full ? [] : [`${k}.service: Main process exited, code=exited, status=${bad.st}`, `${k}.service: Failed with result 'exit-code'.`]);
        res.e = (res.e||'') + `Job for ${k}.service failed because the control process exited with error code.\nSee "systemctl status ${k}.service" and "journalctl -xeu ${k}.service" for details.\n`;
        res.code = 1;
      } else { delete this.dynLog[k]; if (this.quadlets[k]) this._quadletStart(k); }
    }
  }
  if (sub==='stop') units.forEach(k=>{ if (this.quadlets[k]) this.containers = this.containers.filter(c=>c.name!=='systemd-'+k); });
  if (sub==='status'){
    for (const k of units){
      if (this.dynLog[k] && this.svc[k] && this.svc[k].failed){
        res.o = (res.o||'').replace(/\n$/,'') + '\n\n' + this.dynLog[k].map(l=>`Nov 01 12:00:01 ${this.hostname} ${l.includes('[')?l:'systemd[1]: '+l}`).join('\n') + '\n';
        res.o = res.o.replace('Active: failed (Result: exit-code)', `Active: failed (Result: exit-code)`);
      }
      if (this.quadlets[k]) res.o = (res.o||'').replace(/Loaded: loaded \([^)]*\)/, `Loaded: loaded (/etc/containers/systemd/${k}.container; generated)`);
    }
  }
  if (warn) res.e = warn + (res.e||'');
  return res;
};
const origJournal = P.c_journalctl;
P.c_journalctl = function(a){
  const o = this.opts(a,['u','p','n','since','until','b','g','t','o']);
  const k = o.v.u ? this._svcName(o.v.u) : null;
  if (k && (this.dynLog[k] || (SVC_DEF[k] && SVC_DEF[k].dyn))){
    const L = (this.dynLog[k]||[]).map(l=>`Nov 01 12:00:01 ${this.hostname} ${l.includes('[')?l:'systemd[1]: '+l}`);
    const ok = this.svc[k] && this.svc[k].active ? [`Nov 01 12:00:05 ${this.hostname} systemd[1]: Started ${SVC_DEF[k].desc}.`] : [];
    const all = L.concat(ok);
    return (all.length?all.join('\n')+'\n':'-- No entries --\n') + (o.has('x') && L.length ? `░░ Subject: A start job for unit ${k}.service has failed\n░░ The job identifier is 512 and the job result is failed.\n` : '');
  }
  if (k==='postgresql' && this.dynLog.postgresql) return this.dynLog.postgresql.map(l=>`Nov 01 12:00:01 ${this.hostname} ${l}`).join('\n')+'\n';
  return origJournal.call(this, a);
};
const origSockets = P._sockets;
P._sockets = function(){
  const s = origSockets.call(this);
  for (const [k, st] of Object.entries(this.svc)){
    if (!st.active || !SVC_DEF[k]) continue;
    if (k==='postgresql'){ s.push({p:'tcp',st:'LISTEN',l:'127.0.0.1',port:5432,proc:'postmaster',pid:3502}); s.push({p:'tcp',st:'LISTEN',l:'[::1]',port:5432,proc:'postmaster',pid:3502}); continue; }
    if ((SVC_DEF[k].dyn || k==='acme-agent') && !this.quadlets[k]){ const port = this._dynPort(k); if (port) s.push({p:'tcp',st:'LISTEN',l:'*',port,proc:k==='appka'?'java':k,pid:4120+k.length}); }
  }
  for (const c of this.containers){ if (!c.running) continue; for (const p of c.ports){ s.push({p:'tcp',st:'LISTEN',l:'0.0.0.0',port:+p.split(':')[0],proc:c.rootless?'rootlessport':'conmon',pid:5100+c.id.charCodeAt(0)}); } }
  return s;
};
const origCurl = P.c_curl;
P.c_curl = function(a){
  const url = a.filter(x=>!x.startsWith('-'))[0]||'';
  const m = url.match(/^(?:https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.20\.31|rhel(?:9|10)-lab)(?::(\d+))?/);
  if (m){
    const port = +(m[2]||80);
    const c = this.containers.find(c=>c.running && c.ports.some(p=>+p.split(':')[0]===port));
    const head = a.includes('-I');
    if (c){ const ng = /nginx/.test(c.image); return head ? `HTTP/1.1 ${ng?200:403} ${ng?'OK':'Forbidden'}\nServer: ${ng?'nginx/1.24.0':'Apache/2.4.62 (Red Hat Enterprise Linux)'}\n` : ng ? '<!DOCTYPE html>\n<html><head><title>Welcome to nginx!</title></head>…\n' : '<!doctype html><html><head><title>Test Page for the HTTP Server on Red Hat Enterprise Linux</title></head>… (bežím v kontajneri)\n'; }
    if (this.svc.appka && this.svc.appka.active && port===this._dynPort('appka')) return head ? 'HTTP/1.1 200 OK\nServer: Appka/2.0\n' : '{"app":"appka","version":"2.0","status":"OK"}\n';
    if (this.svc['acme-agent'] && this.svc['acme-agent'].active && port===9100) return head ? 'HTTP/1.1 200 OK\n' : '# HELP acme_up Agent is running\n# TYPE acme_up gauge\nacme_up 1\nnode_load1 0.18\n';
    if (port===5432 && this.svc.postgresql && this.svc.postgresql.active) return {e:'curl: (52) Empty reply from server\n(PostgreSQL nehovorí HTTP. Pripoj sa cez psql.)\n',code:52};
  }
  if (/repo\.acme\.example/.test(url)) return '[acme]\nname=ACME tools for RHEL $releasever\nbaseurl=https://repo.acme.example/rhel/$releasever/x86_64/\nenabled=1\ngpgcheck=1\ngpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-acme\n';
  return origCurl.call(this, a);
};

/* ---------- produkty: lokálne RPM, repozitáre, kľúče ---------- */
P._repos = function(){
  const dn = this.node('/etc/yum.repos.d'); const out = [];
  if (!dn) return out;
  for (const [f, n] of Object.entries(dn.c)){
    if (!f.endsWith('.repo') || f==='redhat.repo' || n.t!=='f') continue;
    let cur = null;
    for (const l of n.c.split('\n')){
      const sec = l.match(/^\s*\[(.+)\]\s*$/); if (sec){ cur = {id:sec[1], file:f, enabled:true, gpgcheck:true}; out.push(cur); continue; }
      const kv = l.match(/^\s*([\w.]+)\s*=\s*(.*)$/); if (!kv || !cur) continue;
      const [, k, v] = kv;
      if (k==='name') cur.name=v.replace('$releasever',String(this.ver)); if (k==='baseurl') cur.baseurl=v; if (k==='enabled') cur.enabled = v.trim()!=='0'; if (k==='gpgcheck') cur.gpgcheck = v.trim()!=='0'; if (k==='gpgkey') cur.gpgkey=v.trim();
    }
  }
  return out;
};
const ACME_PKGS = {'acme-cli':{v:'1.8.0-1',s:'ACME command line tools',cmds:['acme']}, 'acme-agent':{v:'3.2.1-1',s:'ACME monitoring agent',cmds:['acme-agent']}};
P._installAcmeAgent = function(){
  PKG_DB['acme-agent'] = {v:'3.2.1-1',s:'ACME monitoring agent',repo:'@commandline',cmds:['acme-agent'],vendor:true};
  this.pkgs.add('acme-agent');
  const mk = (p,c,m)=>{ const [d]=this.parentOf(p); if (!this.exists(d)) { const x=this._mkPath(d,'d',0o755); x.ctx=this.defaultCtx(d);} const n=this._mkPath(p,'f',m||0o644,'root','root',c); n.ctx=this.defaultCtx(p); n.mt=new Date(); return n; };
  if (!this.exists('/opt/acme')) { this._mkPath('/opt/acme','d',0o755).ctx='usr_t'; this._mkPath('/opt/acme/agent','d',0o755).ctx='usr_t'; this._mkPath('/opt/acme/agent/bin','d',0o755).ctx='usr_t'; }
  mk('/opt/acme/agent/bin/acme-agent','\x7fELF acme-agent',0o755);
  mk('/etc/acme/agent.yml','# ACME agent\nserver: mon01.firma.local\nlisten: 0.0.0.0:9100\ninterval: 60s\n',0o640);
  mk('/usr/lib/systemd/system/acme-agent.service','[Unit]\nDescription=ACME monitoring agent\nAfter=network-online.target\n\n[Service]\nExecStart=/opt/acme/agent/bin/acme-agent --config /etc/acme/agent.yml\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n');
  if (!this.exists('/var/log/acme')) this._mkPath('/var/log/acme','d',0o750).ctx='var_log_t';
  this.svc['acme-agent'] = {installed:true, active:false, enabled:false, failed:false, since:new Date()};
};
const origDnf = P.c_dnf;
P.c_dnf = function(a){
  const o = this.opts(a,['enablerepo','disablerepo','setopt']);
  const sub = o.pos[0]; const names = o.pos.slice(1);
  const meta = 'Updating Subscription Management repositories.\nLast metadata expiration check: 0:41:12 ago on '+new Date().toString().slice(0,24)+'.\n';
  if (sub==='config-manager'){
    if (this.user!=='root') return {e:'Error: This command has to be run with superuser privileges (under the root user on most systems).\n',code:1};
    const ar = a.find(x=>x.startsWith('--add-repo')); let url = ar && ar.includes('=') ? ar.split('=')[1] : (ar ? a[a.indexOf(ar)+1] : null);
    if (url){
      if (!/repo\.acme\.example/.test(url)) return {e:`Curl error (6): Couldn't resolve host name for ${url}\nError: Configuration of repo failed\n`,code:1};
      const fn = '/etc/yum.repos.d/'+url.split('/').pop();
      const r = this.c_curl([url]); this._writeFile(fn, typeof r==='string'?r:r.o, false); const n=this.node(fn); if (n) n.ctx='system_conf_t';
      return `Adding repo from: ${url}\n`;
    }
    const en = a.find(x=>x.startsWith('--set-enabled')||x.startsWith('--set-disabled'));
    if (en){ const id = names[0]||a[a.indexOf(en)+1]; const rp = this._repos().find(r=>r.id===id); if (!rp) return {e:`Error: No matching repo to modify: ${id}.\n`,code:1}; const f='/etc/yum.repos.d/'+rp.file; const n=this.node(f); n.c = n.c.replace(/^enabled\s*=\s*\d/m, 'enabled='+(en.includes('enabled')?1:0)); return ''; }
    return {e:'usage: dnf config-manager [--add-repo URL] [--set-enabled REPO] [--set-disabled REPO]\n',code:1};
  }
  if (sub==='repolist'){
    const r = origDnf.call(this, a); let txt = typeof r==='string'?r:r.o;
    for (const rp of this._repos()) if (rp.enabled || a.includes('all')) txt += `${pad(rp.id,48,true)}${rp.name||rp.id}\n`;
    return txt;
  }
  if ((sub==='install' || sub==='localinstall' || sub==='reinstall') && names.length){
    const local = names.filter(n=>n.endsWith('.rpm'));
    if (local.length){
      if (this.user!=='root') return {e:'Error: This command has to be run with superuser privileges (under the root user on most systems).\n',code:1};
      const f = local[0]; const n = this.node(f);
      if (!n) return {o:meta, e:`Can not load RPM file: ${f}.\nCould not open: ${f}\n`,code:1};
      if (!/acme-agent/.test(f)) return {e:'Error: v simulátore je pripravený len balík acme-agent v ~/stiahnute\n',code:1};
      if (this.pkgs.has('acme-agent')) return meta+'Package acme-agent-3.2.1-1.el9.x86_64 is already installed.\nDependencies resolved.\nNothing to do.\nComplete!\n';
      this._installAcmeAgent();
      this.dnfHist.push({id:this.dnfHist.length+1, cmd:'install '+f, date:new Date().toISOString().slice(0,16).replace('T',' '), act:'Install', n:1, pk:['acme-agent']});
      return meta+`Dependencies resolved.\n================================================================================\n Package          Arch        Version            Repository             Size\n================================================================================\nInstalling:\n acme-agent       x86_64      3.2.1-1.el9        @commandline          4.5 M\n\nTransaction Summary\n================================================================================\nInstall  1 Package\n\n${o.has('y')?'':'Is this ok [y/N]: y\n'}Running transaction check\nTransaction check succeeded.\nRunning transaction\n  Preparing        :\n  Installing       : acme-agent-3.2.1-1.el9.x86_64\n  Running scriptlet: acme-agent-3.2.1-1.el9.x86_64\n\nInstalled:\n  acme-agent-3.2.1-1.el9.x86_64\n\nComplete!\n(lokálny súbor: dnf ho nainštaloval bez kontroly podpisu, lebo localpkg_gpgcheck je predvolene vypnutý. Podpis over cez rpm -K)\n`;
    }
    if (names.includes('acme-agent') && !this.pkgs.has('acme-agent')) return {o:meta, e:'No match for argument: acme-agent\nError: Unable to find a match: acme-agent\n(acme-agent nie je v žiadnom repozitári: inštaluje sa zo stiahnutého súboru: sudo dnf install ./stiahnute/acme-agent-….rpm)\n',code:1};
    const want = names.filter(n=>ACME_PKGS[n] && n!=='acme-agent');
    if (want.length){
      if (this.user!=='root') return {e:'Error: This command has to be run with superuser privileges (under the root user on most systems).\n',code:1};
      const rp = this._repos().find(r=>r.id==='acme' && r.enabled);
      if (!rp) return {o:meta, e:`No match for argument: ${want.join(' ')}\nError: Unable to find a match: ${want.join(' ')}\n(balík je v repozitári dodávateľa: najprv ho pridaj do /etc/yum.repos.d/)\n`,code:1};
      let out = `ACME tools for RHEL ${this.ver}                       118 kB/s |  12 kB     00:00\n` + meta + 'Dependencies resolved.\nInstalling:\n'+want.map(n=>` ${n}  x86_64  ${ACME_PKGS[n].v}.el${this.ver}  acme`).join('\n')+'\n\nDownloading Packages:\n';
      if (rp.gpgcheck){
        const kf = (rp.gpgkey||'').replace('file://','');
        if (!this.gpgKeys.has('acme')){
          if (!kf || !this.exists(kf)) return {o:out, e:`Curl error (37): Couldn't read a file:// file for file://${kf} [Couldn't open file ${kf}]\nThe downloaded packages were saved in cache until the next successful transaction.\nError: GPG check FAILED\n(kľúč dodávateľa nie je v ${kf || 'gpgkey'}: skopíruj RPM-GPG-KEY-acme do /etc/pki/rpm-gpg/)\n`,code:1};
          out += `ACME tools for RHEL ${this.ver}                       1.6 MB/s | 1.7 kB     00:00\nImporting GPG key 0x8F3C2A1E:\n Userid     : "ACME Release Signing <release@acme.example>"\n Fingerprint: 4D1E 7A33 8F3C 2A1E 9B07  C2D5 61E8 0F44 8F3C 2A1E\n From       : ${kf}\n${o.has('y')?'':'Is this ok [y/N]: y\n'}Key imported successfully\n`;
          this.gpgKeys.add('acme');
        }
      } else out += '(gpgcheck=0: podpisy sa nekontrolujú. Vo firme to býva zakázané.)\n';
      want.forEach(n=>{ PKG_DB[n] = Object.assign({repo:'acme',vendor:true}, ACME_PKGS[n]); this._installPkg(n); });
      this.dnfHist.push({id:this.dnfHist.length+1, cmd:'install '+want.join(' '), date:new Date().toISOString().slice(0,16).replace('T',' '), act:'Install', n:want.length, pk:want});
      return out + 'Running transaction\n'+want.map(n=>`  Installing       : ${n}-${ACME_PKGS[n].v}.el${this.ver}.x86_64`).join('\n')+'\n\nComplete!\n';
    }
  }
  if ((sub==='update'||sub==='upgrade') && !names.length && this.user==='root'){
    const r = origDnf.call(this, a);
    const nk = this.ver===9 ? '5.14.0-570.18.1.el9_6.x86_64' : '6.12.0-55.20.1.el10_0.x86_64';
    if (!this.grub.kernels.includes(nk)){ this.grub.kernels.unshift(nk); this.grub.defaultKernel = nk; const b=this._mkPath('/boot/vmlinuz-'+nk,'f',0o755,'root','root',''); b.ctx='boot_t'; }
    return r;
  }
  return origDnf.call(this, a);
};
const origRpm = P.c_rpm;
P.c_rpm = function(a){
  if (a.includes('--import')){
    if (this.user!=='root') return {e:'error: /etc/pki/rpm-gpg: key import failed (permission denied)\n',code:1};
    const f = a[a.indexOf('--import')+1]; const n = this.node(f||'');
    if (!n) return {e:`error: ${f}: import read failed(2).\n`,code:1};
    if (/acme/i.test(f)) this.gpgKeys.add('acme');
    return '';
  }
  const o = this.opts(a);
  if (o.has('K') || o.has('checksig')){
    const f = o.pos[0]; if (!this.node(f||'')) return {e:`error: ${f}: open failed: No such file or directory\n`,code:1};
    return this.gpgKeys.has('acme') ? `${f}: digests signatures OK\n` : {o:`${f}: digests SIGNATURES NOT OK\n`, e:'(podpis sa nedá overiť: chýba verejný kľúč dodávateľa. Importuj ho: sudo rpm --import RPM-GPG-KEY-acme)\n', code:1};
  }
  if ((o.has('i') || o.has('U')) && !o.has('q') && o.pos[0] && o.pos[0].endsWith('.rpm')){
    if (this.user!=='root') return {e:`error: can't create transaction lock on /var/lib/rpm/.rpm.lock (Permission denied)\n`,code:1};
    const f = o.pos[0]; if (!this.node(f)) return {e:`error: open of ${f} failed: No such file or directory\n`,code:1};
    let out = this.gpgKeys.has('acme') ? '' : `warning: ${f}: Header V4 RSA/SHA256 Signature, key ID 8f3c2a1e: NOKEY\n`;
    if (this.pkgs.has('acme-agent')) return {o:out, e:`\tpackage acme-agent-3.2.1-1.el9.x86_64 is already installed\n`,code:1};
    this._installAcmeAgent();
    return out + 'Verifying...                          ################################# [100%]\nPreparing...                          ################################# [100%]\nUpdating / installing...\n   1:acme-agent-3.2.1-1.el9           ################################# [100%]\n(tip: dnf install ./súbor.rpm je lepší, lebo dotiahne závislosti a zapíše sa do dnf history)\n';
  }
  if (o.has('q') && o.has('p')){
    const f = o.pos[0]; if (!this.node(f||'')) return {e:`error: open of ${f} failed: No such file or directory\n`,code:1};
    if (!/acme-agent/.test(f)) return {e:'error: v simulátore je pripravený len acme-agent\n',code:1};
    const warn = this.gpgKeys.has('acme') ? '' : `warning: ${f}: Header V4 RSA/SHA256 Signature, key ID 8f3c2a1e: NOKEY\n`;
    if (o.has('l')) return {o:'/etc/acme/agent.yml\n/opt/acme/agent/bin/acme-agent\n/usr/lib/systemd/system/acme-agent.service\n/var/log/acme\n', e:warn};
    if (o.has('i')) return {o:'Name        : acme-agent\nVersion     : 3.2.1\nRelease     : 1.el9\nArchitecture: x86_64\nVendor      : ACME s.r.o.\nSummary     : ACME monitoring agent\nDescription : Agent zbiera metriky servera a vystavuje ich na porte 9100.\n', e:warn};
    if (o.has('R')) return {o:'/bin/sh\nsystemd\nlibc.so.6()(64bit)\n', e:warn};
    return {o:'acme-agent-3.2.1-1.el9.x86_64\n', e:warn};
  }
  if (o.has('q') && o.has('a') && (o.pos[0]||'').startsWith('gpg-pubkey')) return [...this.gpgKeys].map(k=>k==='redhat'?'gpg-pubkey-fd431d51-4ae0493b\ngpg-pubkey-5a6340b3-6229229e':'gpg-pubkey-8f3c2a1e-64a3b1c2').join('\n')+'\n';
  if (o.has('q') && o.pos[0]==='acme-agent' && this.pkgs.has('acme-agent')){
    if (o.has('l')) return '/etc/acme/agent.yml\n/opt/acme/agent/bin/acme-agent\n/usr/lib/systemd/system/acme-agent.service\n/var/log/acme\n';
    if (o.has('c')) return '/etc/acme/agent.yml\n';
    if (o.has('i')) return 'Name        : acme-agent\nVersion     : 3.2.1\nRelease     : 1.el9\nArchitecture: x86_64\nVendor      : ACME s.r.o.\nSignature   : RSA/SHA256, key ID 8f3c2a1e\nSummary     : ACME monitoring agent\n';
  }
  if (o.has('q') && o.has('f')){ const f=this.norm(o.pos[0]||''); if (/^\/(opt\/acme|etc\/acme)/.test(f) && this.pkgs.has('acme-agent')) return 'acme-agent-3.2.1-1.el9.x86_64\n'; if (/^\/opt\/appka/.test(f) && this.exists(f)) return {o:`file ${f} is not owned by any package\n`,code:1}; }
  return origRpm.call(this, a);
};
const origInstallPkg = P._installPkg;
P._installPkg = function(n){
  origInstallPkg.call(this, n);
  if (n==='postgresql-server'){ this.pkgs.add('postgresql'); this.sysusers.push(['postgres',26,26,'/var/lib/pgsql','/bin/bash']); this.groups.postgres={gid:26,mem:[]}; this._refreshAccountFiles(); const x=this._mkPath('/var/lib/pgsql','d',0o700,'postgres','postgres'); x.ctx='postgresql_db_t'; }
  if (n==='container-tools'){ ['podman','buildah','skopeo'].forEach(p=>{ if (!this.pkgs.has(p) && PKG_DB[p]) origInstallPkg.call(this,p); }); }
  if (n==='rhel-system-roles'){ ['/usr/share/ansible','/usr/share/ansible/roles'].forEach(p=>{ if (!this.exists(p)) this._mkPath(p,'d',0o755); }); ['timesync','firewall','selinux','network','storage','sshd','sudo','podman','kdump','logging'].forEach(r=>{ this._mkPath('/usr/share/ansible/roles/rhel-system-roles.'+r,'d',0o755); }); }
  if (n==='ansible-core'){ if (!this.exists('/etc/ansible')) this._mkPath('/etc/ansible','d',0o755); this._mkPath('/etc/ansible/hosts','f',0o644,'root','root','# This is the default ansible \'hosts\' file.\n'); this._mkPath('/etc/ansible/ansible.cfg','f',0o644,'root','root','# Since Ansible 2.12 (core):\n# To generate an example config file (a "disabled" one with all default settings, commented out):\n#               $ ansible-config init --disabled > ansible.cfg\n'); }
  if (n==='leapp-upgrade-el9toel10'){ if (!this.exists('/var/log/leapp')) this._mkPath('/var/log/leapp','d',0o700); }
};
P.c_postgresql_setup = function(a){
  if (this.user!=='root') return {e:'postgresql-setup: Permission denied (spusti cez sudo)\n',code:1};
  if (!a.includes('--initdb')) return {e:'postgresql-setup: Použitie: postgresql-setup --initdb\n',code:1};
  if (this.exists('/var/lib/pgsql/data/PG_VERSION')) return {e:' * Initializing database in \'/var/lib/pgsql/data\'\nERROR: Data directory /var/lib/pgsql/data is not empty!\n',code:1};
  const d = this._mkPath('/var/lib/pgsql/data','d',0o700,'postgres','postgres'); d.ctx='postgresql_db_t';
  [['PG_VERSION','13\n'],['postgresql.conf',"# PostgreSQL configuration file\n#listen_addresses = 'localhost'\t\t# what IP address(es) to listen on;\nport = 5432\nmax_connections = 100\n"],['pg_hba.conf','# TYPE  DATABASE        USER            ADDRESS                 METHOD\nlocal   all             all                                     peer\nhost    all             all             127.0.0.1/32            ident\n']].forEach(([f,c])=>{ const x=this._mkPath('/var/lib/pgsql/data/'+f,'f',0o600,'postgres','postgres',c); x.ctx='postgresql_db_t'; });
  return ' * Initializing database in \'/var/lib/pgsql/data\'\n * Initialized, logs are in /var/lib/pgsql/initdb_postgresql.log\n';
};
P.c_psql = function(a){ return {e:'psql: v simulátore sa do databázy nepripojíš. Reálne: sudo -u postgres psql\n',code:2}; };
P.c_java = function(a){ return 'openjdk version "17.0.15" 2025-04-15 LTS\nOpenJDK Runtime Environment (Red_Hat-17.0.15.0.6-1) (build 17.0.15+6-LTS)\n'; };
P.c_acme = function(a){ return 'acme 1.8.0 (simulácia)\n'; };

/* ---------- reboot ---------- */
P.c_reboot = function(a){
  if (this.user!=='root') return {e:'Call to Reboot failed: Interactive authentication required.\n(tip: sudo reboot)\n',code:1};
  const notes = [];
  // jadro
  if (this.leappStaged){
    this.ver = 10; this.leappStaged = false;
    this.kernel = '6.12.0-55.12.1.el10_0.x86_64'; this.release = 'Red Hat Enterprise Linux release 10.0 (Coughlan)';
    this.grub.kernels = [this.kernel]; this.grub.defaultKernel = this.kernel;
    this._lookup('/etc/redhat-release').c = this.release+'\n';
    const osr = this._lookup('/etc/os-release'); osr.c = osr.c.replace(/9\.6 \(Plow\)/g,'10.0 (Coughlan)').replace(/VERSION_ID="9\.6"/,'VERSION_ID="10.0"').replace(/el9/g,'el10').replace(/enterprise_linux:9/,'enterprise_linux:10');
    const sc = this._lookup('/etc/sysconfig'); if (sc) delete sc.c['network-scripts'];
    Object.keys(PKG_DB).forEach(p=>{ if (PKG_DB[p].v && this.pkgs.has(p)) {} });
    this.pkgs.delete('leapp-upgrade-el9toel10');
    notes.push('Leapp dokončil upgrade počas štartu: systém je teraz RHEL 10.0.');
  } else if (this.grub.defaultKernel !== this.kernel){ this.kernel = this.grub.defaultKernel; notes.push('Naštartovalo nové jadro '+this.kernel+'.'); }
  this._lookup('/proc/cmdline').c = 'BOOT_IMAGE=(hd0,msdos1)/vmlinuz-'+this.kernel+' root=/dev/mapper/rhel-root '+this.grub.args+'\n';
  this._lookup('/proc/version').c = 'Linux version '+this.kernel+' (mockbuild@x86-vm-07.build.eng.bos.redhat.com)\n';
  // hostname
  this.hostname = (this.read('/etc/hostname')||this.hostname).trim();
  // SELinux
  const cfg = (this.read('/etc/selinux/config')||'').match(/^SELINUX=(\w+)/m);
  const newMode = cfg ? (cfg[1]==='permissive'?'Permissive':cfg[1]==='disabled'?'Disabled':'Enforcing') : 'Enforcing';
  if (newMode!==this.se.mode) notes.push(`SELinux: režim z /etc/selinux/config je ${newMode} (setenforce platil len do reštartu).`);
  this.se.mode = newMode;
  if (this.se.boolPerm){ for (const k of Object.keys(this.se.bools)) this.se.bools[k] = !!this.se.boolPerm[k]; } else for (const k of Object.keys(this.se.bools)) this.se.bools[k]=false;
  // firewall
  const rt = JSON.stringify(this.fw.runtime), pm = JSON.stringify(this.fw.perm);
  if (rt!==pm) notes.push('Firewall: pravidlá pridané bez --permanent zmizli, platí len trvalá konfigurácia.');
  this.fw.runtime = JSON.parse(pm);
  // sysctl
  const before = JSON.stringify(this.sysctl);
  this.sysctl = Object.assign({}, this.sysctlDef); if (this.tuned==='throughput-performance') this.sysctl['vm.dirty_ratio']='40'; this._sysctlApplyFiles();
  if (before!==JSON.stringify(this.sysctl)) notes.push('sysctl: hodnoty nastavené len cez sysctl -w sa vrátili, platia súbory v /etc/sysctl.d.');
  // siet
  if (this.net.modified && !this.net.applied){ if (this.net.pendingIp) this.net.ip=this.net.pendingIp; notes.push('Sieť: zmeny z nmcli con mod sa aplikovali pri štarte.'); }
  this.net.applied = false; this.net.modified = false;
  // sluzby
  const daemonStale = Object.keys(this.svc).filter(k=>SVC_DEF[k] && SVC_DEF[k].dyn);
  this.lastReload = Date.now()+1;
  const stopped = [], started = [], failed = [];
  for (const [k, s] of Object.entries(this.svc)){
    if (!s.installed) continue;
    const was = s.active;
    if (this.quadlets[k]) { s.active = !!this.quadlets[k].install; s.failed=false; if (s.active) started.push(k); continue; }
    s.active = s.enabled && !s.masked; s.failed = false;
    if (s.active){
      let bad = null;
      if (k==='postgresql' && !this.exists('/var/lib/pgsql/data/PG_VERSION')) bad = true;
      else if (SVC_DEF[k] && (SVC_DEF[k].dyn || k==='acme-agent')) bad = this._dynValidate(k);
      else if (k==='agent'){ const n=this.node('/opt/monitoring/bin/agent'); bad = !(n && (n.m&0o111)); }
      else if (k==='httpd' && this.httpdPortBad && this.httpdPortBad()) bad = true;
      if (bad){ s.active=false; s.failed=true; failed.push(k); }
    }
    s.since = new Date();
    if (was && !s.active && !s.failed) stopped.push(k);
  }
  if (stopped.length) notes.push('Nespustili sa (nie sú enable): '+stopped.join(', ')+'.');
  if (failed.length) notes.push('Pri štarte zlyhali: '+failed.join(', ')+' (systemctl --failed).');
  // kontajnery
  const before2 = this.containers.filter(c=>c.running).length;
  this.containers.forEach(c=>{ c.running = false; c.status='Exited (0)'; });
  this.containers = this.containers.filter(c=>!c.name.startsWith('systemd-'));
  for (const [k,q] of Object.entries(this.quadlets)) if (q.install) this._quadletStart(k);
  if (before2 && !this.containers.some(c=>c.running && !c.name.startsWith('systemd-'))) notes.push('Kontajnery spustené cez podman run sa po reštarte samé nespustia (na to je Quadlet).');
  // disky
  const base = this.mounts.filter(m=>['/','/boot','/run','/dev'].includes(m.dir));
  const lost = this.mounts.filter(m=>!base.includes(m)).map(m=>m.dir);
  this.mounts = base;
  const prevUser = this.user; this.user='root';
  const mr = this.c_mount(['-a']);
  this.user = prevUser;
  const nowM = this.mounts.map(m=>m.dir);
  const gone = lost.filter(d=>!nowM.includes(d));
  if (gone.length) notes.push('Nepripojené po štarte (chýbajú v /etc/fstab): '+gone.join(', ')+'.');
  // relacia
  this.procs = []; this.user='admin'; this.rootShell=false; this.cwd='/home/admin'; this.prevUser=null;
  if (mr && mr.e){
    this.emergency = true; this.wasEmergency = true;
    return {o:`Connection to ${this.hostname} closed by remote host.\n\n(simulácia reštartu)\n[ TIME ] Timed out waiting for device …\n[DEPEND] Dependency failed for Local File Systems.\nYou are in emergency mode. After logging in, type "journalctl -xb" to view\nsystem logs, "systemctl reboot" to reboot, "systemctl default" or "exit"\nto boot into default mode.\n\n${mr.e}\nServer by NENAŠTARTOVAL do normálneho režimu: chyba v /etc/fstab. Na skutočnom serveri ideš cez konzolu (vSphere/iLO), opravíš fstab a reštartuješ.\nV simulátore pokračuj: oprav /etc/fstab (sudo vim /etc/fstab) a daj sudo reboot.\n`};
  }
  this.emergency = false;
  return {o:`Connection to ${this.hostname} closed by remote host.\n\n(simulácia reštartu … server naštartoval, prihlásil si sa znova)\n\n${this.release}\nKernel ${this.kernel} on x86_64\n\nČo sa pri reštarte stalo:\n`+(notes.length? notes.map(n=>'  • '+n).join('\n') : '  • Nič neočakávané: všetko, čo si nastavil, prežilo reštart.')+'\n'};
};
P.c_shutdown = function(a){ if (a.includes('-r')) return this.c_reboot(a); return {o:'(simulácia) shutdown: server by sa vypol. Na reštart použi sudo reboot.\n'}; };

/* ---------- grubby, dracut ---------- */
P.c_grubby = function(a){
  const g = this.grub;
  const info = (k,i)=>`index=${i}\nkernel="/boot/vmlinuz-${k}"\nargs="${g.args}"\nroot="/dev/mapper/rhel-root"\ninitrd="/boot/initramfs-${k}.img"\ntitle="${this.release.replace(' release','')} (${k})"\nid="${(this.ver===10?'b2f0':'7c1e')}-${k}"\n`;
  if (a.includes('--default-kernel')) return '/boot/vmlinuz-'+g.defaultKernel+'\n';
  if (a.includes('--default-index')) return g.kernels.indexOf(g.defaultKernel)+'\n';
  const inf = a.find(x=>x.startsWith('--info'));
  if (inf){ if (this.user!=='root') return {e:'grubby: Permission denied (/boot/loader/entries, spusti so sudo)\n',code:1}; const w = inf.split('=')[1]||a[a.indexOf(inf)+1]; const ks = w==='ALL' ? g.kernels : [g.defaultKernel]; return ks.map((k)=>info(k, g.kernels.indexOf(k))).join(''); }
  const up = a.find(x=>x.startsWith('--update-kernel'));
  if (up){
    if (this.user!=='root') return {e:'grubby: Permission denied\n',code:1};
    const add = (a.find(x=>x.startsWith('--args='))||'').slice(7).replace(/^"|"$/g,'');
    const rem = (a.find(x=>x.startsWith('--remove-args='))||'').slice(14).replace(/^"|"$/g,'');
    let args = g.args.split(/\s+/);
    if (rem) rem.split(/\s+/).forEach(r=>{ args = args.filter(x=>x!==r && x.split('=')[0]!==r); });
    if (add) add.split(/\s+/).forEach(x=>{ args = args.filter(y=>y.split('=')[0]!==x.split('=')[0]); args.push(x); });
    g.args = args.join(' ');
    return '';
  }
  const sd = a.find(x=>x.startsWith('--set-default'));
  if (sd){ if (this.user!=='root') return {e:'grubby: Permission denied\n',code:1}; const v = sd.split('=')[1]||a[a.indexOf(sd)+1]; let k = sd.startsWith('--set-default-index') ? g.kernels[+v] : (v||'').replace('/boot/vmlinuz-',''); if (!k || !g.kernels.includes(k)) return {e:`grubby: kernel ${v} not found\n`,code:1}; g.defaultKernel = k; return `The default is /boot/loader/entries/${(this.ver===10?'b2f0':'7c1e')}-${k}.conf with index ${g.kernels.indexOf(k)} and kernel /boot/vmlinuz-${k}\n`; }
  return {e:'Usage: grubby [--info=ALL|DEFAULT] [--default-kernel] [--update-kernel=ALL --args="…" | --remove-args="…"] [--set-default=/boot/vmlinuz-…]\n',code:1};
};
P.c_dracut = function(a){ if (this.user!=='root') return {e:'dracut: Cannot write to /boot (spusti so sudo)\n',code:1}; return a.includes('-f') ? '' : {e:`dracut: Will not override existing initramfs (/boot/initramfs-${this.kernel}.img) without --force\n`,code:1}; };
P.c_ksvalidator = function(a){ const f=a[0]; if (!this.node(f||'')) return {e:`ksvalidator: ${f}: No such file\n`,code:1}; return ''; };

/* ---------- tuned, sysctl, sysstat, limits ---------- */
const TUNED = [['accelerator-performance','Throughput performance based tuning with disabled higher latency STOP states'],['balanced','General non-specialized tuned profile'],['desktop','Optimize for the desktop use-case'],['hpc-compute','Optimize for HPC compute workloads'],['latency-performance','Optimize for deterministic performance at the cost of increased power consumption'],['network-latency','Optimize for deterministic performance at the cost of increased power consumption, focused on low latency network performance'],['network-throughput','Optimize for streaming network throughput, generally only necessary on older CPUs or 40G+ networks'],['powersave','Optimize for low power consumption'],['throughput-performance','Broadly applicable tuning that provides excellent performance across a variety of common server workloads'],['virtual-guest','Optimize for running inside a virtual guest'],['virtual-host','Optimize for running KVM guests']];
P.c_tuned_adm = function(a){
  const sub = a[0];
  if (sub==='active') return this.tuned ? `Current active profile: ${this.tuned}\n` : 'No current active profile.\n';
  if (sub==='list') return 'Available profiles:\n'+TUNED.map(([n,d])=>`- ${pad(n,30,true)}- ${d}`).join('\n')+`\nCurrent active profile: ${this.tuned||'none'}\n`;
  if (sub==='recommend') return 'virtual-guest\n';
  if (sub==='verify') return 'Verification succeeded, current system settings match the preset profile.\n';
  if (sub==='profile' || sub==='off'){
    if (this.user!=='root') return {e:'Cannot talk to TuneD daemon via DBus. Is TuneD daemon running? (alebo nemáš práva: sudo)\n',code:1};
    if (sub==='off'){ this.tuned=null; return ''; }
    const p = a[1]; if (!TUNED.find(t=>t[0]===p)) return {e:`Requested profile '${p}' doesn't exist.\n`,code:1};
    this.tuned = p; this._lookup('/etc/tuned/active_profile').c = p+'\n';
    if (p==='throughput-performance' || p==='virtual-guest') this.sysctl['vm.dirty_ratio'] = p==='virtual-guest'?'30':'40';
    return '';
  }
  return {e:'usage: tuned-adm [-h] {list,active,off,profile,recommend,verify} ...\n',code:1};
};
P._sysctlApplyFiles = function(){
  const applied = [];
  const files = [];
  const dn = this.node('/etc/sysctl.d'); if (dn) Object.keys(dn.c).filter(f=>f.endsWith('.conf')).sort().forEach(f=>files.push('/etc/sysctl.d/'+f));
  files.push('/etc/sysctl.conf');
  for (const f of files){
    const t = this.read(f); if (t==null) continue;
    applied.push(f);
    for (const l of t.split('\n')){ const m = l.match(/^\s*([a-z0-9_.]+)\s*=\s*(\S+)\s*$/i); if (m) this.sysctl[m[1].replace(/\//g,'.')] = m[2]; }
  }
  return applied;
};
P.c_sysctl = function(a){
  const o = this.opts(a);
  if (o.has('a')) return Object.keys(this.sysctl).sort().map(k=>`${k} = ${this.sysctl[k]}`).join('\n')+'\n';
  if (o.has('system')){
    if (this.user!=='root') return {e:'sysctl: permission denied on key …\n',code:1};
    const ap = this._sysctlApplyFiles();
    return ['/usr/lib/sysctl.d/10-default-yama-scope.conf','/usr/lib/sysctl.d/50-default.conf'].concat(ap).map(f=>`* Applying ${f} ...`).join('\n')+'\n'+ap.flatMap(f=>(this.read(f)||'').split('\n').filter(l=>/^\s*[a-z]/.test(l)).map(l=>l.replace(/\s*=\s*/,' = '))).join('\n')+'\n';
  }
  if (o.has('p')){
    if (this.user!=='root') return {e:'sysctl: permission denied\n',code:1};
    const f = o.pos[0] || '/etc/sysctl.conf'; const t = this.read(f); if (t==null) return {e:`sysctl: cannot open "${f}": No such file or directory\n`,code:1};
    let out=''; for (const l of t.split('\n')){ const m = l.match(/^\s*([a-z0-9_.]+)\s*=\s*(\S+)/i); if (m){ this.sysctl[m[1]]=m[2]; out+=`${m[1]} = ${m[2]}\n`; } } return out;
  }
  let out='', e='';
  for (const x of o.pos){
    if (x.includes('=')){
      if (!o.has('w') && false) {}
      if (this.user!=='root'){ e+=`sysctl: permission denied on key "${x.split('=')[0]}"\n`; continue; }
      const [k,v] = x.split('='); if (!(k in this.sysctl)){ e+=`sysctl: cannot stat /proc/sys/${k.replace(/\./g,'/')}: No such file or directory\n`; continue; }
      this.sysctl[k]=v; out+=`${k} = ${v}\n`;
    } else { if (!(x in this.sysctl)){ e+=`sysctl: cannot stat /proc/sys/${x.replace(/\./g,'/')}: No such file or directory\n`; continue; } out += o.has('n') ? this.sysctl[x]+'\n' : `${x} = ${this.sysctl[x]}\n`; }
  }
  return {o:out, e, code:e?255:0};
};
P.c_iostat = function(a){ return `Linux ${this.kernel} (${this.hostname}) \t11/01/2026 \t_x86_64_\t(2 CPU)\n\navg-cpu:  %user   %nice %system %iowait  %steal   %idle\n           1.31    0.00    0.72    0.21    0.00   97.76\n\nDevice            r/s     rkB/s   rrqm/s  %rrqm r_await rareq-sz     w/s     wkB/s   wrqm/s  %wrqm w_await wareq-sz  aqu-sz  %util\nsda              0.84     21.30     0.01   1.18    0.52    25.36    3.12     48.11     0.94  23.15    0.81    15.42    0.00   0.31\ndm-0             0.80     20.10     0.00   0.00    0.55    25.13    4.01     47.90     0.00   0.00    0.95    11.95    0.00   0.30\n` + (a.some(x=>x.includes('x'))?'(stĺpce: r/s w/s = operácie za sekundu, r_await w_await = čakanie v ms, %util = vyťaženie disku)\n':''); };
P.c_sar = function(a){ return `Linux ${this.kernel} (${this.hostname}) \t11/01/2026 \t_x86_64_\t(2 CPU)\n\n12:00:01 AM     CPU     %user     %nice   %system   %iowait    %steal     %idle\n12:10:01 AM     all      1.12      0.00      0.65      0.18      0.00     98.05\n12:20:01 AM     all      4.88      0.00      1.73      2.41      0.00     90.98\nAverage:        all      3.00      0.00      1.19      1.30      0.00     94.51\n(sar číta históriu, ktorú zbiera sysstat každých 10 minút: aké vyťaženie bolo v noci, keď si nesledoval)\n`; };
P.c_mpstat = function(){ return this.c_sar([]); };
P.c_ulimit = function(a){ if (a.includes('-a')) return 'core file size              (blocks, -c) 0\nopen files                          (-n) 1024\nmax user processes                  (-u) 14879\nstack size                  (kbytes, -s) 8192\n'; if (a.includes('-n')) return '1024\n'; return 'unlimited\n'; };

/* ---------- leapp ---------- */
P.c_leapp = function(a){
  if (this.user!=='root') return {e:'leapp: musí bežať ako root (sudo leapp …)\n',code:1};
  if (this.ver!==9) return {e:'leapp: tento systém už je RHEL 10.\n',code:1};
  const sub = a[0];
  const inhib = [];
  if (this.grub.defaultKernel !== this.kernel) inhib.push(['Newest installed kernel not in use','To ensure a stable upgrade, the machine needs to be booted into the latest installed kernel.','Reboot the system to boot into the newest installed kernel.']);
  const notes = [];
  if (this.pkgs.has('acme-agent') || this.pkgs.has('acme-cli')) notes.push(['Packages not signed by Red Hat found on the system','The following packages have not been signed by Red Hat and may be removed during the upgrade process in case Red Hat-signed packages to be removed during the upgrade depend on them: acme-agent','Check the vendor provides packages for RHEL 10.']);
  if (this._repos().some(r=>r.enabled)) notes.push(['Third-party repositories enabled','Enabled repositories not provided by Red Hat: '+this._repos().filter(r=>r.enabled).map(r=>r.id).join(', '),'Disable them or make sure they provide RHEL 10 content.']);
  const report = ()=>{
    const lines = [];
    inhib.forEach(([t,s,r])=>lines.push(`Risk Factor: high (inhibitor)\nTitle: ${t}\nSummary: ${s}\nRemediation: [hint] ${r}\n----------------------------------------`));
    notes.forEach(([t,s,r])=>lines.push(`Risk Factor: high\nTitle: ${t}\nSummary: ${s}\nRemediation: [hint] ${r}\n----------------------------------------`));
    lines.push('Risk Factor: info\nTitle: Excluded target system repositories\nSummary: (simulovaný report: skutočné hlásenia závisia od tvojho systému)\n----------------------------------------');
    const p = this._mkPath('/var/log/leapp/leapp-report.txt','f',0o600,'root','root',lines.join('\n')+'\n'); p.ctx='var_log_t';
  };
  if (sub==='preupgrade' || (sub==='upgrade' && inhib.length)){
    report();
    return {o:`==> Processing phase \`configuration_phase\`\n====> * ipu_workflow_config\n==> Processing phase \`FactsCollection\`\n…\n==> Processing phase \`Checks\`\n…\n${'='.repeat(80)}\n                           REPORT OVERVIEW\n${'='.repeat(80)}\n\n`+(inhib.length?`Upgrade has been inhibited due to the following problems:\n${inhib.map((x,i)=>`    ${i+1}. ${x[0]}`).join('\n')}\n\n`:'')+(notes.length?`HIGH and MEDIUM severity reports:\n${notes.map((x,i)=>`    ${i+1}. ${x[0]}`).join('\n')}\n\n`:'')+`Reports summary:\n    Errors:                      0\n    Inhibitors:                  ${inhib.length}\n    HIGH severity reports:       ${notes.length}\n    MEDIUM severity reports:     0\n    LOW severity reports:        0\n    INFO severity reports:       1\n\nBefore continuing, review the full report below for details about discovered problems and possible remediation instructions:\n    A report has been generated at /var/log/leapp/leapp-report.txt\n    A report has been generated at /var/log/leapp/leapp-report.json\n\n${'='.repeat(80)}\n                       END OF REPORT OVERVIEW\n${'='.repeat(80)}\n`, code: inhib.length && sub==='upgrade' ? 1 : 0};
  }
  if (sub==='upgrade'){
    report(); this.leappStaged = true;
    return `==> Processing phase \`Download\`\n…\n==> Processing phase \`InterimPreparation\`\n…\n${'='.repeat(80)}\nA reboot is required to continue. Please reboot your system.\n${'='.repeat(80)}\n(upgrade je pripravený: po sudo reboot systém naštartuje do špeciálneho prostredia, dokončí upgrade a reštartuje sa do RHEL 10)\n`;
  }
  if (sub==='answer') return '';
  return {e:'usage: leapp [preupgrade | upgrade | answer --section …]\n',code:1};
};

/* ---------- ansible ---------- */
const KNOWN_HOSTS = ['web01.firma.local','web02.firma.local','db01.firma.local','mon01.firma.local','web01','web02','db01','mon01','localhost','10.0.20.31','10.0.20.32','10.0.20.40','10.0.20.50'];
P._inventory = function(path){
  const t = path ? this.read(path) : this.read('/etc/ansible/hosts');
  if (t==null) return null;
  const groups = {all:[], ungrouped:[]}; let g = 'ungrouped';
  for (let l of t.split('\n')){
    l = l.replace(/[#;].*$/,'').trim(); if (!l) continue;
    const s = l.match(/^\[([^\]]+)\]$/); if (s){ g = s[1]; if (!g.includes(':')) groups[g] = groups[g]||[]; continue; }
    if (g.includes(':')) continue;
    const h = l.split(/\s+/)[0];
    groups[g].push(h); if (!groups.all.includes(h)) groups.all.push(h);
  }
  return groups;
};
P._ansHosts = function(pattern, inv){
  if (!inv) return [];
  if (pattern==='all' || pattern==='*') return inv.all;
  return pattern.split(/[:,]/).flatMap(p=>inv[p] || (inv.all.includes(p)?[p]:[]));
};
P._ansOpts = function(a){
  const o = {pos:[]};
  for (let i=0;i<a.length;i++){
    const x=a[i];
    if (x==='-i'||x==='--inventory'){ o.i=a[++i]; continue; } if (x.startsWith('--inventory=')){ o.i=x.split('=')[1]; continue; }
    if (x==='-m'||x==='--module-name'){ o.m=a[++i]; continue; }
    if (x==='-a'||x==='--args'){ o.a=a[++i]; continue; }
    if (x==='-b'||x==='--become'){ o.b=true; continue; }
    if (x==='-C'||x==='--check'){ o.check=true; continue; }
    if (x==='--syntax-check'){ o.syntax=true; continue; }
    if (x==='-K'||x==='--ask-become-pass'){ o.K=true; continue; }
    if (x==='--list-hosts'){ o.list=true; continue; }
    if (x==='-v'||x==='-vv'||x==='-vvv'){ o.v=true; continue; }
    if (x==='--version'){ o.version=true; continue; }
    if (x==='-l'||x==='--limit'){ o.limit=a[++i]; continue; }
    o.pos.push(x);
  }
  return o;
};
P._ansVersion = function(){ const v = this.ver===10 ? '2.16.14' : '2.14.18'; return `ansible [core ${v}]\n  config file = /etc/ansible/ansible.cfg\n  configured module search path = ['/home/${this.user}/.ansible/plugins/modules', '/usr/share/ansible/plugins/modules']\n  ansible python module location = /usr/lib/python3.${this.ver===10?12:11}/site-packages/ansible\n  executable location = /usr/bin/ansible\n  python version = 3.${this.ver===10?12:11}.x\n  jinja version = 3.1.2\n  libyaml = True\n`; };
P.c_ansible = function(a){
  const o = this._ansOpts(a);
  if (o.version) return this._ansVersion();
  const inv = this._inventory(o.i);
  if (o.i && !inv) return {e:`[WARNING]: Unable to parse ${o.i} as an inventory source\n[WARNING]: No inventory was parsed, only implicit localhost is available\n`,code:1};
  const pat = o.pos[0]||'';
  let hosts = this._ansHosts(pat, inv);
  if (o.limit) hosts = hosts.filter(h=>h.includes(o.limit));
  if (!hosts.length) return {e:`[WARNING]: provided hosts list is empty, only localhost is available. Note that the implicit localhost does not match 'all'\n[WARNING]: Could not match supplied host pattern, ignoring: ${pat}\n${!o.i?'(chýba -i inventar: ansible číta /etc/ansible/hosts, ktorý je prázdny)\n':''}`,code:0};
  if (o.list) return `  hosts (${hosts.length}):\n`+hosts.map(h=>'    '+h).join('\n')+'\n';
  const mod = (o.m||'command').replace('ansible.builtin.','');
  let out = '';
  for (const h of hosts){
    if (!KNOWN_HOSTS.includes(h)){ out += `${h} | UNREACHABLE! => {\n    "changed": false,\n    "msg": "Failed to connect to the host via ssh: ssh: Could not resolve hostname ${h}: Name or service not known",\n    "unreachable": true\n}\n`; continue; }
    if (mod==='ping') out += `${h} | SUCCESS => {\n    "ansible_facts": {\n        "discovered_interpreter_python": "/usr/bin/python3"\n    },\n    "changed": false,\n    "ping": "pong"\n}\n`;
    else if (mod==='command'||mod==='shell'){ const c=(o.a||'').trim(); out += `${h} | CHANGED | rc=0 >>\n${c.startsWith('uptime')?' 12:00:03 up 12 days,  3:11,  1 user,  load average: 0.08, 0.12, 0.10':c.startsWith('hostname')?h.split('.')[0]:c.startsWith('cat /etc/redhat-release')?'Red Hat Enterprise Linux release 9.6 (Plow)':'(výstup príkazu '+c+')'}\n`; }
    else if (['dnf','package','yum','user','service','systemd','copy','file','lineinfile','firewalld'].includes(mod)){
      if (!o.b && ['dnf','package','yum','user','service','systemd','firewalld'].includes(mod)) out += `${h} | FAILED! => {\n    "changed": false,\n    "msg": "This command has to be run under the root user.",\n    "results": []\n}\n(chýba -b / become: zmena systému potrebuje root)\n`;
      else { const key = h+'|'+mod+'|'+(o.a||''); const ch = !this.ansibleDone[key]; this.ansibleDone[key]=true; out += `${h} | ${ch?'CHANGED':'SUCCESS'} => {\n    "changed": ${ch},\n    "msg": "${ch?'':'Nothing to do'}"\n}\n`; }
    }
    else if (mod==='setup') out += `${h} | SUCCESS => {\n    "ansible_facts": {\n        "ansible_distribution": "RedHat",\n        "ansible_distribution_major_version": "9",\n        "ansible_hostname": "${h.split('.')[0]}",\n        …\n    }\n}\n`;
    else out += `${h} | FAILED! => {\n    "msg": "The module ${o.m} was not found in configured module paths"\n}\n`;
  }
  return out;
};
P._parsePlay = function(t){
  if (/\t/.test(t)){ const ln = t.split('\n').findIndex(l=>l.includes('\t'))+1; return {err:`ERROR! We were unable to read either as JSON nor YAML, these are the errors we got from each:\nJSON: Expecting value: line 1 column 1 (char 0)\n\nSyntax Error while loading YAML.\n  found character '\\t' that cannot start any token\n\nThe error appears to be in '…': line ${ln}, column 1\n(YAML nesmie obsahovať tabulátory: odsadzuj medzerami)\n`}; }
  const plays = []; let cur = null, inTasks = false, task = null;
  const lines = t.split('\n');
  for (let i=0;i<lines.length;i++){
    const l = lines[i]; if (!l.trim() || l.trim().startsWith('#') || l.trim()==='---') continue;
    const ind = l.match(/^ */)[0].length;
    let m;
    if (ind===0 && (m=l.match(/^- (?:name|hosts):\s*(.*)$/))){ cur = {name:'', hosts:'', become:false, tasks:[]}; plays.push(cur); inTasks=false; if (l.includes('hosts:')) cur.hosts=m[1].trim(); else cur.name=m[1].trim(); continue; }
    if (!cur) return {err:`ERROR! A playbook must be a list of plays, got a <class 'ansible.parsing.yaml.objects.AnsibleMapping'> instead\n(play musí začínať pomlčkou: "- name: …")\n`};
    if (ind===2 && (m=l.match(/^  (\w+):\s*(.*)$/))){ const [,k,v]=m; if (k==='hosts') cur.hosts=v.trim(); else if (k==='name') cur.name=v.trim(); else if (k==='become') cur.become=/^(true|yes)$/i.test(v.trim()); inTasks = (k==='tasks'||k==='handlers'); continue; }
    if (inTasks && (m=l.match(/^(\s*)- name:\s*(.*)$/))){ task = {name:m[2].trim(), module:null}; cur.tasks.push(task); continue; }
    if (inTasks && task && !task.module && (m=l.match(/^\s+([\w.]+):\s*$/)) && !['when','notify','register','become','loop','vars','tags'].includes(m[1])){ task.module = m[1]; continue; }
    if (inTasks && (m=l.match(/^(\s*)- ([\w.]+):/)) && !task){ task={name:m[2], module:m[2]}; cur.tasks.push(task); }
    if (inTasks && task && /^\s+become:\s*(true|yes)/i.test(l)) task.become = true;
  }
  if (!plays.length) return {err:'ERROR! Empty playbook, nothing to do\n'};
  for (const p of plays) if (!p.hosts) return {err:`ERROR! the field 'hosts' is required but was not set\n`};
  for (const p of plays) for (const tk of p.tasks) if (!tk.module) return {err:`ERROR! no module/action detected in task.\n\nThe error appears to be in task '${tk.name}'\n(pod "- name:" musí byť modul, napr. ansible.builtin.dnf:, odsadený o 2 medzery viac)\n`};
  return {plays};
};
P.c_ansible_playbook = function(a){
  const o = this._ansOpts(a);
  if (o.version) return this._ansVersion().replace('ansible [','ansible-playbook [');
  const file = o.pos[0];
  if (!file) return {e:'usage: ansible-playbook [-h] [--version] [-v] [-i INVENTORY] [-C] [--syntax-check] playbook [playbook ...]\nansible-playbook: error: the following arguments are required: playbook\n',code:2};
  const txt = this.read(file);
  if (txt==null) return {e:`ERROR! the playbook: ${file} could not be found\n`,code:1};
  const pp = this._parsePlay(txt);
  if (pp.err) return {e:pp.err, code:4};
  if (o.syntax) return `\nplaybook: ${file}\n`;
  const inv = this._inventory(o.i);
  let out = '';
  const recap = {};
  for (const p of pp.plays){
    let hosts = this._ansHosts(p.hosts, inv);
    if (o.limit) hosts = hosts.filter(h=>h.includes(o.limit));
    if (!hosts.length){ out += `[WARNING]: Could not match supplied host pattern, ignoring: ${p.hosts}\n${!o.i?'[WARNING]: provided hosts list is empty, only localhost is available\n(zabudol si -i inventar?)\n':''}\nPLAY [${p.name||p.hosts}] ${'*'.repeat(50)}\nskipping: no hosts matched\n`; continue; }
    out += `\nPLAY [${p.name||p.hosts}] ${'*'.repeat(Math.max(10,60-(p.name||p.hosts).length))}\n\nTASK [Gathering Facts] ${'*'.repeat(42)}\n`;
    const alive = [];
    for (const h of hosts){ recap[h] = recap[h]||{ok:0,changed:0,unreachable:0,failed:0}; if (KNOWN_HOSTS.includes(h)){ out += `ok: [${h}]\n`; recap[h].ok++; alive.push(h); } else { out += `fatal: [${h}]: UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh: ssh: Could not resolve hostname ${h}", "unreachable": true}\n`; recap[h].unreachable++; } }
    let live = alive.slice();
    for (const t of p.tasks){
      out += `\nTASK [${t.name}] ${'*'.repeat(Math.max(10,60-t.name.length))}\n`;
      const priv = /dnf|yum|package|service|systemd|firewalld|user|group|lineinfile|copy|template|file|selinux|timesync|rhel-system-roles/.test(t.module);
      const next = [];
      for (const h of live){
        if (priv && !p.become && !t.become && /dnf|yum|package|service|systemd|firewalld|user/.test(t.module)){ out += `fatal: [${h}]: FAILED! => {"changed": false, "msg": "This command has to be run under the root user.", "results": []}\n`; recap[h].failed++; continue; }
        const key = h+'|'+file+'|'+t.name+'|'+t.module;
        const ch = !this.ansibleDone[key] && !/ping|debug|command|shell|setup|stat/.test(t.module.replace('ansible.builtin.',''));
        if (/command|shell/.test(t.module)) { out += `changed: [${h}]\n`; recap[h].changed++; recap[h].ok++; next.push(h); continue; }
        if (!o.check) this.ansibleDone[key] = true;
        out += `${ch?'changed':'ok'}: [${h}]\n`; recap[h].ok++; if (ch) recap[h].changed++;
        next.push(h);
      }
      live = next;
    }
  }
  out += `\nPLAY RECAP ${'*'.repeat(55)}\n` + Object.entries(recap).map(([h,r])=>`${pad(h,26,true)} : ok=${pad(r.ok,4,true)} changed=${pad(r.changed,4,true)} unreachable=${pad(r.unreachable,4,true)} failed=${pad(r.failed,4,true)} skipped=0    rescued=0    ignored=0`).join('\n')+'\n';
  if (o.check) out += '\n(--check: Ansible len ukázal, čo by zmenil. Na serveroch sa nič nestalo.)\n';
  this.ansibleRuns = this.ansibleRuns||{}; if (!o.check){ const k=file; this.ansibleRuns[k]=(this.ansibleRuns[k]||0)+1; }
  const failed = Object.values(recap).some(r=>r.failed||r.unreachable);
  return {o:out, code: failed?2:0};
};
P.c_ansible_inventory = function(a){
  const o = this._ansOpts(a); const inv = this._inventory(o.i);
  if (!inv) return {e:`[WARNING]: Unable to parse ${o.i||'/etc/ansible/hosts'} as an inventory source\n`,code:1};
  if (a.includes('--graph')){ let s='@all:\n  |--@ungrouped:\n'+inv.ungrouped.map(h=>'  |  |--'+h).join('\n')+(inv.ungrouped.length?'\n':''); for (const [g,h] of Object.entries(inv)){ if (g==='all'||g==='ungrouped') continue; s += `  |--@${g}:\n`+h.map(x=>'  |  |--'+x).join('\n')+'\n'; } return s; }
  return JSON.stringify({_meta:{hostvars:{}}, all:{children:Object.keys(inv).filter(g=>g!=='all')}, ...Object.fromEntries(Object.entries(inv).filter(([g])=>g!=='all').map(([g,h])=>[g,{hosts:h}]))}, null, 4)+'\n';
};
P.c_ansible_doc = function(a){
  if (a.includes('-l')) return 'ansible.builtin.command        Execute commands on targets\nansible.builtin.copy           Copy files to remote locations\nansible.builtin.dnf            Manages packages with the dnf package manager\nansible.builtin.file           Manage files and file properties\nansible.builtin.lineinfile     Manage lines in text files\nansible.builtin.ping           Try to connect to host, verify a usable python and return pong on success\nansible.builtin.service        Manage services\nansible.builtin.template       Template a file out to a target host\nansible.builtin.user           Manage user accounts\nansible.posix.firewalld        Manage arbitrary ports/services with firewalld\nansible.posix.selinux          Change policy and state of SELinux\n';
  const m = (a.find(x=>!x.startsWith('-'))||'').replace('ansible.builtin.','');
  const docs = {dnf:'> ANSIBLE.BUILTIN.DNF\n\n  Installs, upgrade, removes, and lists packages and groups with the dnf package manager.\n\nOPTIONS:\n- name   Package name, or package specifier with version.\n- state  Whether to install (present, latest), or remove (absent) a package.\n\nEXAMPLES:\n- name: Install the latest version of Apache\n  ansible.builtin.dnf:\n    name: httpd\n    state: latest\n', service:'> ANSIBLE.BUILTIN.SERVICE\n\nOPTIONS:\n- name     Name of the service.\n- state    started / stopped / restarted / reloaded\n- enabled  Whether the service should start on boot.\n', user:'> ANSIBLE.BUILTIN.USER\n\nOPTIONS:\n- name    Name of the user\n- groups  List of groups\n- append  If yes, add the user to the groups specified in groups (ako usermod -a)\n- shell   Optionally set the user\'s shell\n', copy:'> ANSIBLE.BUILTIN.COPY\n\nOPTIONS:\n- src / content  Čo skopírovať\n- dest           Kam\n- owner, group, mode\n'};
  return docs[m] || {e:`[WARNING]: module ${m} not found in: /usr/share/ansible/plugins/modules (v simulátore: dnf, service, user, copy)\n`,code:1};
};
P.c_ansible_galaxy = function(a){ return {o:'(simulácia) ansible-galaxy: na RHEL sa namiesto Galaxy často používajú rhel-system-roles alebo Automation Hub.\n'}; };

/* ---------- podman ---------- */
const IMAGES = {
  'registry.access.redhat.com/ubi9/ubi':{size:'217 MB', id:'8d2a1b7c4e3f', os:'Red Hat Enterprise Linux release 9.6 (Plow)'},
  'registry.access.redhat.com/ubi9/ubi-minimal':{size:'101 MB', id:'3c4b5a6d7e8f', os:'Red Hat Enterprise Linux release 9.6 (Plow)'},
  'registry.access.redhat.com/ubi10/ubi':{size:'230 MB', id:'9f1e2d3c4b5a', os:'Red Hat Enterprise Linux release 10.0 (Coughlan)'},
  'registry.access.redhat.com/ubi9/httpd-24':{size:'389 MB', id:'a1b2c3d4e5f6', os:'Red Hat Enterprise Linux release 9.6 (Plow)', port:8080, web:true},
  'registry.access.redhat.com/ubi9/nginx-124':{size:'382 MB', id:'b2c3d4e5f6a1', os:'Red Hat Enterprise Linux release 9.6 (Plow)', port:8080, web:true},
  'registry.access.redhat.com/ubi9/postgresql-16':{size:'412 MB', id:'c3d4e5f6a1b2', os:'Red Hat Enterprise Linux release 9.6 (Plow)', port:5432},
  'docker.io/library/nginx':{size:'197 MB', id:'d4e5f6a1b2c3', os:'Debian GNU/Linux 12', port:80, web:true}
};
P._imgName = function(n){ n = n.replace(/:latest$/,''); if (IMAGES[n]) return n; const full = Object.keys(IMAGES).find(k=>k.endsWith('/'+n)); return n.includes('/') && n.includes('.') ? n : null; };
P._pull = function(ref){
  const r = ref.replace(/:latest$/,'');
  if (!r.includes('/') || !r.split('/')[0].includes('.')){
    const cands = Object.keys(IMAGES).filter(k=>k.endsWith('/'+r) || k.endsWith('/'+r.split('/').pop()));
    return {err:`? Please select an image: \n  ▸ registry.access.redhat.com/${r}:latest\n    registry.redhat.io/${r}:latest\n    docker.io/library/${r}:latest\nError: short-name resolution enforced but cannot prompt without a TTY\n(krátke meno "${r}": na RHEL píš celé meno obrazu s registrom${cands.length?', napr. '+cands[0]:''})\n`};
  }
  if (!IMAGES[r]) return {err:`Trying to pull ${r}:latest...\nError: initializing source docker://${r}:latest: reading manifest latest in ${r}: manifest unknown\n`};
  const store = this.user==='root' ? 'root' : 'user';
  const have = this.images.find(i=>i.name===r && i.store===store);
  if (have) return {out:'', name:r};
  this.images.push({name:r, store, created:'2 weeks ago'});
  return {out:`Trying to pull ${r}:latest...\nGetting image source signatures\nChecking if image destination supports signatures\nCopying blob 5f2e9a1c3d7b done   | \nCopying config ${IMAGES[r].id} done   | \nWriting manifest to image destination\nStoring signatures\n${IMAGES[r].id}${'0'.repeat(52)}\n`, name:r};
};
P._quadletStart = function(k){
  const q = this.quadlets[k]; if (!q || !q.img) return;
  const name = 'systemd-'+k;
  this.containers = this.containers.filter(c=>c.name!==name);
  const img = q.img.replace(/:latest$/,'');
  if (!this.images.find(i=>i.name===img)) this.images.push({name:img, store: q.rootful?'root':'user', created:'2 weeks ago'});
  this.containers.push({id:Math.random().toString(16).slice(2,14), name, image:img, ports:q.ports, running:true, status:'Up 2 seconds', rootless:!q.rootful, store:q.rootful?'root':'user', cmd:''});
};
P.c_podman = function(a){
  const sub = a[0]; const rest = a.slice(1);
  const store = this.user==='root' ? 'root' : 'user';
  const mine = ()=>this.containers.filter(c=>c.store===store);
  const find = n => mine().find(c=>c.name===n || c.id.startsWith(n));
  switch(sub){
    case '--version': case 'version': return `podman version ${this.ver===10?'5.4.0':'5.4.0'}\n`;
    case 'info': return `host:\n  arch: amd64\n  os: linux\n  security:\n    rootless: ${store==='user'}\n    selinuxEnabled: true\nstore:\n  graphRoot: ${store==='user'?this.home+'/.local/share/containers/storage':'/var/lib/containers/storage'}\n`;
    case 'search': return 'NAME                                              DESCRIPTION\nregistry.access.redhat.com/ubi9/ubi               Provides the latest release of the Red Hat Universal Base Image 9.\nregistry.access.redhat.com/ubi9/httpd-24          Apache HTTP 2.4 Server\nregistry.access.redhat.com/ubi9/nginx-124         Nginx 1.24 server and a reverse proxy server\nregistry.access.redhat.com/ubi9/postgresql-16     PostgreSQL is an advanced Object-Relational database\n';
    case 'pull': { const r = this._pull(rest.filter(x=>!x.startsWith('-'))[0]||''); return r.err ? {e:r.err,code:125} : (r.out || ''); }
    case 'images': case 'image': { const L = this.images.filter(i=>i.store===store); return 'REPOSITORY                                 TAG         IMAGE ID      CREATED      SIZE\n'+L.map(i=>`${pad(i.name,42,true)} latest      ${IMAGES[i.name]?IMAGES[i.name].id:'000000000000'}  ${pad(i.created,12,true)} ${IMAGES[i.name]?IMAGES[i.name].size:''}`).join('\n')+(L.length?'\n':''); }
    case 'rmi': { const n = rest.filter(x=>!x.startsWith('-'))[0]; const r=this._imgName(n||'')||n; if (mine().some(c=>c.image===r)) return {e:`Error: image used by ${mine().find(c=>c.image===r).id}: image is in use by a container\n`,code:2}; this.images = this.images.filter(i=>!(i.name===r && i.store===store)); return `Untagged: ${r}:latest\n`; }
    case 'ps': { const all = rest.includes('-a') || rest.includes('--all'); const L = mine().filter(c=>all||c.running); return 'CONTAINER ID  IMAGE                                           COMMAND               CREATED         STATUS          PORTS                   NAMES\n'+L.map(c=>`${c.id}  ${pad(c.image+':latest',46,true)}  ${pad(c.cmd||(IMAGES[c.image]&&IMAGES[c.image].web?'/usr/bin/run-http…':'/bin/bash'),20,true)}  2 minutes ago   ${pad(c.running?c.status:'Exited (0) 1 minute ago',15,true)} ${pad(c.ports.map(p=>'0.0.0.0:'+p.replace(':','->')+'/tcp').join(', '),23,true)} ${c.name}`).join('\n')+(L.length?'\n':''); }
    case 'run': {
      let detach=false, name=null, ports=[], rm=false, it=false, vols=[], i=0;
      for (; i<rest.length; i++){
        const x = rest[i];
        if (x==='-d'||x==='--detach') detach=true;
        else if (x==='--rm') rm=true;
        else if (x==='-it'||x==='-ti'||x==='-i'||x==='-t') it=true;
        else if (x==='--name') name=rest[++i]; else if (x.startsWith('--name=')) name=x.slice(7);
        else if (x==='-p'||x==='--publish') ports.push(rest[++i]); else if (x.startsWith('--publish=')) ports.push(x.split('=')[1]);
        else if (x==='-v'||x==='--volume') vols.push(rest[++i]);
        else if (x==='-e'||x==='--env') i++;
        else if (x==='--restart') i++;
        else if (/^-/.test(x)) { if (/^-\w*d/.test(x)) detach=true; if (/^-\w*[it]/.test(x)) it=true; }
        else break;
      }
      const ref = rest[i]; const cmd = rest.slice(i+1);
      if (!ref) return {e:'Error: requires at least 1 arg(s), only received 0\n',code:125};
      const pr = this._pull(ref); if (pr.err) return {e:pr.err,code:125};
      const img = pr.name; let out = pr.out||'';
      ports = ports.map(p=>p.split(':').length===3 ? p.split(':').slice(1).join(':') : p);
      for (const p of ports){ const hp = +p.split(':')[0]; if (store==='user' && hp<1024) return {o:out, e:`Error: rootlessport cannot expose privileged port ${hp}, you can add 'net.ipv4.ip_unprivileged_port_start=${hp}' to /etc/sysctl.conf (currently 1024), or choose a larger port number (>= 1024): listen tcp 0.0.0.0:${hp}: bind: permission denied\n(bez sudo bežíš rootless: porty pod 1024 sú zakázané. Použi napr. -p 8080:${p.split(':')[1]})\n`,code:126}; if (this._sockets().some(s=>s.p==='tcp' && s.st==='LISTEN' && s.port===hp)) return {o:out, e:`Error: rootlessport listen tcp 0.0.0.0:${hp}: bind: address already in use\n`,code:126}; }
      for (const v of vols){ const src=v.split(':')[0]; if (!this.exists(src)) return {o:out, e:`Error: statfs ${src}: no such file or directory\n`,code:125}; }
      if (name && mine().some(c=>c.name===name)) return {o:out, e:`Error: creating container storage: the container name "${name}" is already in use by ${find(name).id}. You have to remove that container to be able to reuse that name: that name is already in use\n`,code:125};
      const id = Math.random().toString(16).slice(2,14);
      const cname = name || ['zealous_turing','brave_hopper','quirky_lovelace','eager_ritchie'][this.containers.length%4];
      const web = IMAGES[img] && IMAGES[img].web;
      if (!detach && (cmd.length || !web)){
        const c = cmd.join(' ');
        let res = '';
        if (/cat \/etc\/(redhat|os)-release/.test(c)) res = (IMAGES[img]?IMAGES[img].os:'Linux')+'\n';
        else if (/^uname/.test(c)) res = this.kernel+'\n(kontajner zdieľa jadro hostiteľa)\n';
        else if (/^(id|whoami)/.test(c)) res = 'uid=0(root) gid=0(root) groups=0(root)\n(root VNÚTRI kontajnera; pri rootless je to na hostiteľovi tvoj bežný používateľ)\n';
        else if (/^hostname/.test(c)) res = id+'\n';
        else if (/^ls/.test(c)) res = 'afs  bin  boot  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var\n';
        else if (/^dnf|^microdnf/.test(c)) res = '(v kontajneri by sa balík nainštaloval, ale po zmazaní kontajnera zmizne: zmeny patria do Containerfile)\n';
        else if (!c && it) res = `[root@${id} /]# (interaktívny shell kontajnera: v simulátore sa hneď vrátim späť)\nexit\n`;
        else if (c) res = `(spustené v kontajneri: ${c})\n`;
        if (!rm) this.containers.push({id, name:cname, image:img, ports:[], running:false, status:'Exited (0)', rootless:store==='user', store, cmd:c});
        return out + res;
      }
      this.containers.push({id, name:cname, image:img, ports, running:true, status:'Up 1 second', rootless:store==='user', store, cmd:''});
      return out + id+'f3a9c2e1d0b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5\n'.slice(0,52)+'\n';
    }
    case 'stop': case 'start': case 'restart': case 'kill': { let o=''; let e=''; for (const n of rest.filter(x=>!x.startsWith('-'))){ const c=find(n); if (!c){ e+=`Error: no container with name or ID "${n}" found: no such container\n`; continue; } c.running = sub!=='stop' && sub!=='kill'; c.status = c.running?'Up 1 second':'Exited (0) 1 second ago'; o+=n+'\n'; } return {o,e,code:e?125:0}; }
    case 'rm': { const f = rest.includes('-f')||rest.includes('--force'); let o='', e=''; for (const n of rest.filter(x=>!x.startsWith('-'))){ const c=find(n); if (!c){ e+=`Error: no container with ID or name "${n}" found: no such container\n`; continue; } if (c.running && !f){ e+=`Error: cannot remove container ${c.id} as it is running - running or paused containers cannot be removed without force: container state improper\n`; continue; } this.containers = this.containers.filter(x=>x!==c); o+=c.id+'\n'; } return {o,e,code:e?2:0}; }
    case 'logs': { const n=rest.filter(x=>!x.startsWith('-'))[0]; const c=find(n||''); if (!c) return {e:`Error: no container with name or ID "${n}" found: no such container\n`,code:125}; if (IMAGES[c.image]&&IMAGES[c.image].web) return /nginx/.test(c.image) ? `nginx: [notice] start worker processes\n10.88.0.1 - - [01/Nov/2026:12:01:10 +0000] "GET / HTTP/1.1" 200 615 "-" "curl/7.76.1"\n` : `=> sourcing 10-set-mpm.sh ...\nAH00558: httpd: Could not reliably determine the server's fully qualified domain name, using 10.88.0.2. Set the 'ServerName' directive globally to suppress this message\n[Sun Nov 01 12:01:02.112840 2026] [core:notice] [pid 1:tid 1] AH00094: Command line: 'httpd -D FOREGROUND'\n`; return `(kontajner ${c.name} nič nevypísal)\n`; }
    case 'exec': { let i=0; while (rest[i] && rest[i].startsWith('-')) i++; const c=find(rest[i]||''); if (!c) return {e:`Error: no container with name or ID "${rest[i]}" found: no such container\n`,code:125}; if (!c.running) return {e:`Error: can only create exec sessions on running containers: container state improper\n`,code:125}; const cmd=rest.slice(i+1).join(' '); if (/release/.test(cmd)) return (IMAGES[c.image]||{}).os+'\n'; if (/^ps/.test(cmd)) return '    PID TTY          TIME CMD\n      1 ?        00:00:00 httpd\n     23 ?        00:00:00 ps\n'; if (!cmd||/bash|sh/.test(cmd)) return `[default@${c.id} /]$ (shell v kontajneri; v simulátore sa vrátim späť)\n`; return `(spustené v ${c.name}: ${cmd})\n`; }
    case 'inspect': { const c=find(rest.filter(x=>!x.startsWith('-'))[0]||''); if (!c) return {e:'Error: no such object\n',code:125}; return JSON.stringify([{Id:c.id, Name:c.name, ImageName:c.image+':latest', State:{Status:c.running?'running':'exited', Running:c.running}, HostConfig:{PortBindings:Object.fromEntries(c.ports.map(p=>[p.split(':')[1]+'/tcp',[{HostIp:'',HostPort:p.split(':')[0]}]]))}}], null, 4)+'\n'; }
    case 'port': { const c=find(rest[0]||''); if (!c) return {e:'Error: no such container\n',code:125}; return c.ports.map(p=>`${p.split(':')[1]}/tcp -> 0.0.0.0:${p.split(':')[0]}`).join('\n')+'\n'; }
    case 'generate': return {e:'Warning: Command "podman generate systemd" is deprecated. Use Quadlets for running containers and pods under systemd.\n(na RHEL 9.x a 10 používaj Quadlet súbory v /etc/containers/systemd/)\n',code:0};
    case 'login': return 'Username: admin\nPassword: \nLogin Succeeded!\n';
    case 'build': return {o:'STEP 1/3: FROM registry.access.redhat.com/ubi9/ubi\nSTEP 2/3: RUN dnf install -y httpd && dnf clean all\nSTEP 3/3: CMD ["httpd","-DFOREGROUND"]\nCOMMIT moja-appka\nSuccessfully tagged localhost/moja-appka:latest\n(simulácia: Containerfile sa reálne nespracoval)\n'};
    default: return {e:`Error: unrecognized command \`podman ${sub||''}\`\nTry 'podman --help' for more information\n`,code:125};
  }
};
P.c_skopeo = function(a){ if (a[0]==='inspect') return '{\n    "Name": "'+(a[a.length-1]||'').replace('docker://','')+'",\n    "Labels": {"vendor": "Red Hat, Inc."},\n    "Architecture": "amd64"\n}\n'; return {e:'Usage: skopeo inspect docker://IMAGE\n',code:1}; };
P.c_buildah = function(a){ return '(buildah stavia obrazy; v praxi stačí podman build -t meno .)\n'; };

const origBash = P.c_bash;
P.c_bash = function(a){
  if (a[0]==='-n'){ const n=this.node(a[1]||''); if (!n) return {e:`bash: ${a[1]}: No such file or directory\n`,code:127}; const t=n.c; const opens=(t.match(/^\s*(if)\b/gm)||[]).length, fi=(t.match(/^\s*fi\b|;\s*fi\b/gm)||[]).length, dos=(t.match(/\bdo\b/g)||[]).length, dones=(t.match(/\bdone\b/g)||[]).length; if (opens!==fi) return {e:`${a[1]}: line ${t.split('\n').length}: syntax error: unexpected end of file (chýba fi)\n`,code:2}; if (dos!==dones) return {e:`${a[1]}: line ${t.split('\n').length}: syntax error: unexpected end of file (chýba done)\n`,code:2}; return {o:'',code:0}; }
  if (a[0]==='-x'){ this.traceOn = true; try { return origBash.call(this, a.slice(1)); } finally { this.traceOn = false; } }
  return origBash.call(this, a);
};
/* ---------- help text extra ---------- */
window.HELP_EXTRA = `  skripty:    bash skript.sh, ./skript.sh, premenné X=1, $X, $(prikaz), $((1+2)), if/for/while, [ ]
  systém:     sudo reboot (simulovaný reštart: uvidíš, čo prežije), grubby, dracut, tuned-adm, sysctl
  produkty:   dnf install ./balik.rpm, rpm -K, rpm --import, dnf config-manager, postgresql-setup
  ansible:    ansible, ansible-playbook, ansible-inventory, ansible-doc   (po dnf install ansible-core)
  podman:     podman pull/run/ps/logs/stop/rm/images/exec   (po dnf install container-tools)
  upgrade:    leapp preupgrade, leapp upgrade   (po dnf install leapp-upgrade-el9toel10, len na RHEL 9)`;
})();
