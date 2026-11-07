/* =========================================================
   SIMULÁTOR: scenáre pre ďalšie incidenty
   plný /var (žurnál), čas a chrony, nefunkčný repozitár,
   OOM, pokazená aktualizácia, TLS certifikát (openssl),
   EnvironmentFile, emergency mode, CPU a cron, faillock
   Stav scenára je v this.scn (čisté dáta, dá sa klonovať).
   ========================================================= */
(function(){
'use strict';
const P = window.Machine.prototype;
const {PKG_DB, SVC_DEF, pad} = window.MachineData;
const S_ = m => (m.scn = m.scn || {});
const b64e = s => (typeof btoa==='function' ? btoa(s) : Buffer.from(s,'binary').toString('base64'));
const b64d = s => (typeof atob==='function' ? atob(s) : Buffer.from(s,'base64').toString('binary'));
const MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const z2 = n => String(n).padStart(2,'0');
const sslDate = d => { const t = new Date(d); return `${MONS[t.getUTCMonth()]} ${String(t.getUTCDate()).padStart(2,' ')} ${z2(t.getUTCHours())}:${z2(t.getUTCMinutes())}:${z2(t.getUTCSeconds())} ${t.getUTCFullYear()} GMT`; };
const hash = s => { let h1 = 0x811c9dc5, h2 = 0x1234567; for (let i=0;i<s.length;i++){ h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619)>>>0; h2 = Math.imul(h2 + s.charCodeAt(i), 2654435761)>>>0; } return (h1.toString(16).padStart(8,'0')+h2.toString(16).padStart(8,'0')).repeat(2); };

/* ---------- certifikáty: obsah súboru nesie metadáta ---------- */
const chunk = s => s.match(/.{1,64}/g).join('\n');
P._mkCertPem = function(o){ return '-----BEGIN CERTIFICATE-----\n'+chunk('MIIF'+b64e(JSON.stringify(o)))+'\n-----END CERTIFICATE-----\n'; };
P._mkKeyPem = function(kid){ return '-----BEGIN PRIVATE KEY-----\n'+chunk('MIIE'+b64e(JSON.stringify({kid})))+'\n-----END PRIVATE KEY-----\n'; };
P._pem = function(txt, kind){
  if (!txt) return null;
  const re = kind==='key' ? /-----BEGIN (?:RSA )?PRIVATE KEY-----([\s\S]*?)-----END/ : /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END/;
  const m = txt.match(re); if (!m) return null;
  try { return JSON.parse(b64d(m[1].replace(/\s+/g,'').slice(4))); } catch(e){ return null; }
};
P._sslConf = function(){
  const t = this.read('/etc/httpd/conf.d/ssl.conf'); if (t==null) return null;
  const g = k => ((t.match(new RegExp('^\\s*'+k+'\\s+(\\S+)','m'))||[])[1]||null);
  return {cert:g('SSLCertificateFile'), key:g('SSLCertificateKeyFile')};
};
const okCtx = ctx => !ctx || /cert_t|etc_t|httpd_config_t/.test(ctx);

/* httpd: kontrola modulov a TLS pred štartom */
P._httpdScnBad = function(){
  const s = this.scn; if (!s) return null;
  const L = [];
  if (s.upd){
    const dir = this.node('/etc/httpd/conf.modules.d');
    for (const [f,n] of Object.entries((dir&&dir.c)||{})){
      if (!f.endsWith('.conf') || n.t!=='f') continue;
      (n.c||'').split('\n').forEach((l,i)=>{ const m = l.match(/^\s*LoadModule\s+(\S+)\s+(\S+)/); if (!m || !/acme/.test(m[2])) return;
        const p = '/etc/httpd/'+m[2].replace(/^\//,''); if (!this.exists(p)) L.push(`httpd[3301]: httpd: Syntax error on line ${i+1} of /etc/httpd/conf.modules.d/${f}: Cannot load ${m[2]} into server: ${p}: cannot open shared object file: No such file or directory`); });
    }
  }
  if (s.cert){
    const c = this._sslConf();
    if (c){
      const cn = this._lookup(c.cert||''), kn = this._lookup(c.key||'');
      if (!cn || !cn.c) L.push(`httpd[3301]: AH00526: Syntax error on line 6 of /etc/httpd/conf.d/ssl.conf:\nhttpd[3301]: SSLCertificateFile: file '${c.cert}' does not exist or is empty`);
      else if (!kn || !kn.c) L.push(`httpd[3301]: AH00526: Syntax error on line 7 of /etc/httpd/conf.d/ssl.conf:\nhttpd[3301]: SSLCertificateKeyFile: file '${c.key}' does not exist or is empty`);
      else if (this.se.mode==='Enforcing' && (!okCtx(cn.ctx) || !okCtx(kn.ctx))){
        const bad = !okCtx(kn.ctx) ? [c.key, kn] : [c.cert, cn];
        L.push(`httpd[3301]: [ssl:emerg] AH02312: Fatal error initialising mod_ssl, exiting.\nhttpd[3301]: [ssl:emerg] AH02564: Failed to configure encrypted (?) private key intranet.firma.local:443:0, check ${c.key}\nhttpd[3301]: (13)Permission denied`);
        s.avc = `type=AVC msg=audit(1793530010.211:812): avc:  denied  { read } for  pid=3301 comm="httpd" name="${bad[0].split('/').pop()}" dev="dm-0" ino=1048771 scontext=system_u:system_r:httpd_t:s0 tcontext=unconfined_u:object_r:${(bad[1].ctx||'user_home_t').replace(/^.*:/,'')}:s0 tclass=file permissive=0`;
      } else {
        const ce = this._pem(cn.c,'cert'), ke = this._pem(kn.c,'key');
        if (!ce) L.push(`httpd[3301]: [ssl:emerg] AH02562: Failed to configure certificate intranet.firma.local:443:0 (with chain), check ${c.cert}`);
        else if (!ke) L.push(`httpd[3301]: [ssl:emerg] AH02564: Failed to configure encrypted (?) private key intranet.firma.local:443:0, check ${c.key}`);
        else if (ce.kid!==ke.kid) L.push(`httpd[3301]: [ssl:emerg] AH02565: Certificate and private key intranet.firma.local:443:0 from ${c.cert} and ${c.key} do not match`);
      }
    }
  }
  return L.length ? L.flatMap(l=>l.split('\n')) : null;
};
const origPortBad = P.httpdPortBad;
P.httpdPortBad = function(){
  if (origPortBad.call(this)) return true;
  const bad = this._httpdScnBad();
  if (bad){ S_(this).httpdLog = bad.concat([`systemd[1]: httpd.service: Main process exited, code=exited, status=1/FAILURE`, `systemd[1]: httpd.service: Failed with result 'exit-code'.`, `systemd[1]: Failed to start The Apache HTTP Server.`]); if (this.svc.httpd) this.svc.httpd.scnFail = true; return true; }
  if (this.scn) delete this.scn.httpdLog;
  if (this.svc.httpd) this.svc.httpd.scnFail = false;
  return false;
};
P._servedCertUpdate = function(){
  const s = this.scn; if (!s || !s.cert) return;
  const c = this._sslConf(); if (!c) return;
  if (this.svc.httpd && this.svc.httpd.active) s.served = this._pem(this.read(c.cert)||'','cert');
};

/* ---------- openssl ---------- */
P.c_openssl = function(a, stdin){
  const sub = a[0]; const rest = a.slice(1);
  const val = k => { const i = rest.indexOf(k); return i>=0 ? rest[i+1] : null; };
  const readIn = ()=>{ const f = val('-in'); if (!f) return {txt: stdin||''}; const n = this.node(f); if (!n) return {err:`Could not open file or uri for loading certificate from ${f}\n${'4027EAF6B87F0000'}:error:16000069:STORE routines:ossl_store_get0_loader_int:unregistered scheme\n`}; if (!this.can(n,4)) return {err:`Could not open file or uri for loading from ${f}: Permission denied\n`}; return {txt:n.c||''}; };
  if (sub==='x509'){
    const r = readIn(); if (r.err) return {e:r.err, code:1};
    const c = this._pem(r.txt,'cert'); if (!c) return {e:'Could not read certificate from <stdin>\nUnable to load certificate\n', code:1};
    let o = '';
    if (rest.includes('-subject')) o += `subject=CN = ${c.cn}${c.o?', O = '+c.o:''}\n`;
    if (rest.includes('-issuer')) o += `issuer=CN = ${c.iss}\n`;
    if (rest.includes('-dates') || rest.includes('-startdate')) o += `notBefore=${sslDate(c.nb)}\n`;
    if (rest.includes('-dates') || rest.includes('-enddate')) o += `notAfter=${sslDate(c.na)}\n`;
    if (rest.includes('-serial')) o += `serial=${hash(c.cn+c.na).slice(0,16).toUpperCase()}\n`;
    if (rest.includes('-modulus')) o += `Modulus=${hash('k'+c.kid).toUpperCase()}\n`;
    if (rest.includes('-ext')) o += `X509v3 Subject Alternative Name: \n    ${(c.san||[c.cn]).map(x=>'DNS:'+x).join(', ')}\n`;
    if (rest.includes('-fingerprint')) o += `SHA1 Fingerprint=${hash(c.cn+c.na+c.kid).slice(0,40).toUpperCase().match(/../g).join(':')}\n`;
    const ce = val('-checkend');
    if (ce!=null){ const exp = Date.now() + (+ce)*1000 > c.na; return {o: o + (exp ? 'Certificate will expire\n' : 'Certificate will not expire\n'), code: exp?1:0}; }
    if (rest.includes('-text')) o += `Certificate:\n    Data:\n        Version: 3 (0x2)\n        Issuer: CN = ${c.iss}\n        Validity\n            Not Before: ${sslDate(c.nb)}\n            Not After : ${sslDate(c.na)}\n        Subject: CN = ${c.cn}\n        Subject Public Key Info:\n            Public Key Algorithm: rsaEncryption\n                Public-Key: (2048 bit)\n        X509v3 extensions:\n            X509v3 Subject Alternative Name: \n                ${(c.san||[c.cn]).map(x=>'DNS:'+x).join(', ')}\n`;
    if (!o && !rest.includes('-noout')) o = r.txt;
    return o;
  }
  if (sub==='rsa' || sub==='pkey'){
    const r = readIn(); if (r.err) return {e:r.err, code:1};
    const k = this._pem(r.txt,'key'); if (!k) return {e:'Could not read private key from <stdin>\n', code:1};
    if (rest.includes('-modulus')) return `Modulus=${hash('k'+k.kid).toUpperCase()}\n`;
    if (rest.includes('-check')) return 'RSA key ok\n';
    if (rest.includes('-pubout')) return '-----BEGIN PUBLIC KEY-----\n'+chunk('MIIB'+b64e('pub'+k.kid))+'\n-----END PUBLIC KEY-----\n';
    return rest.includes('-noout') ? '' : r.txt;
  }
  if (sub==='md5' || sub==='sha256' || sub==='dgst'){ const h = hash(stdin||''); return `MD5(stdin)= ${h.slice(0,32)}\n`.replace('MD5', sub==='sha256'?'SHA2-256':'MD5'); }
  if (sub==='s_client'){
    const t = val('-connect')||''; const port = +(t.split(':')[1]||443);
    const sv = this.svc.httpd;
    if (port!==443 || !sv || !sv.active || !this.scn || !this.scn.cert) return {o:'', e:`40B7A1F2AB7F0000:error:8000006F:system library:BIO_connect:Connection refused:crypto/bio/bio_sock2.c:114:calling connect()\nconnect:errno=111\n`, code:1};
    const c = this.scn.served; const exp = c && Date.now() > c.na;
    return `CONNECTED(00000003)\ndepth=0 CN = ${c.cn}\n${exp?'verify error:num=10:certificate has expired\nnotAfter='+sslDate(c.na)+'\n':'verify return:1\n'}---\nCertificate chain\n 0 s:CN = ${c.cn}\n   i:CN = ${c.iss}\n   a:PKEY: rsaEncryption, 2048 (bit); sigalg: RSA-SHA256\n   v:NotBefore: ${sslDate(c.nb)}; NotAfter: ${sslDate(c.na)}\n---\nServer certificate\nsubject=CN = ${c.cn}\nissuer=CN = ${c.iss}\n---\nVerify return code: ${exp?'10 (certificate has expired)':'0 (ok)'}\n---\n(Ctrl+C na ukončenie; v simulátore sa spojenie hneď zavrie)\n`;
  }
  if (sub==='version') return 'OpenSSL 3.2.2 4 Jun 2024 (Library: OpenSSL 3.2.2 4 Jun 2024)\n';
  return {e:`(simulácia) openssl: podporované sú x509, rsa/pkey, s_client, md5, version\n`, code:1};
};

/* ---------- curl na https ---------- */
const origCurl = P.c_curl;
P.c_curl = function(a, stdin){
  const url = a.filter(x=>!x.startsWith('-'))[0]||'';
  const s = this.scn;
  if (s && s.cert && /^https:\/\/(localhost|127\.0\.0\.1|intranet\.firma\.local|web01\.firma\.local|rhel9-lab)(:443)?(\/|$)/.test(url)){
    const k = a.includes('-k') || a.includes('--insecure');
    const v = a.includes('-v') || a.includes('-vI') || a.includes('-Iv') || a.includes('--verbose');
    const head = a.includes('-I') || a.includes('--head') || a.includes('-vI') || a.includes('-Iv');
    if (!this.svc.httpd || !this.svc.httpd.active) return {e:`curl: (7) Failed to connect to ${url.split('/')[2]} port 443 after 0 ms: Couldn't connect to server\n`, code:7};
    const c = s.served; const exp = c && Date.now() > c.na;
    let pre = v ? `*   Trying 127.0.0.1:443...\n* Connected\n* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n* Server certificate:\n*  subject: CN=${c.cn}\n*  start date: ${sslDate(c.nb)}\n*  expire date: ${sslDate(c.na)}\n*  issuer: CN=${c.iss}\n` : '';
    if (exp && !k) return {o:pre, e:`curl: (60) SSL certificate problem: certificate has expired\nMore details here: https://curl.se/docs/sslcerts.html\n\ncurl failed to verify the legitimacy of the server and therefore could not\nestablish a secure connection to it.\n`, code:60};
    return pre + (head ? 'HTTP/1.1 200 OK\nServer: Apache/2.4.62 (Red Hat Enterprise Linux) OpenSSL/3.2.2\nContent-Type: text/html; charset=UTF-8\n\n' : '<h1>Intranet</h1>\n');
  }
  return origCurl.call(this, a, stdin);
};

/* ---------- httpd -t / apachectl ---------- */
P.c_httpd = function(a){
  if (a.includes('-t') || a.includes('-S')){ if (this.user!=='root') return {e:'(13)Permission denied: AH00091: httpd: could not open error log file /etc/httpd/logs/error_log.\n(tip: sudo httpd -t)\n', code:1}; const b = this._httpdScnBad(); if (b && b.some(l=>/Syntax error|does not exist/.test(l))) return {e: b.filter(l=>/Syntax error|does not exist/.test(l)).map(l=>l.replace(/^httpd\[\d+\]: /,'').replace(/\nhttpd\[\d+\]: /g,'\n')).join('\n')+'\n', code:1}; return {e:'Syntax OK\n', code:0}; }
  if (a.includes('-v')) return 'Server version: Apache/2.4.62 (Red Hat Enterprise Linux)\nServer built:   Oct 30 2026 00:00:00\n';
  return {e:'(simulácia) httpd: použi httpd -t na kontrolu konfigurácie, službu ovládaj cez systemctl\n', code:1};
};
P.c_apachectl = function(a){ if (a[0]==='configtest' || a[0]==='-t') return this.c_httpd(['-t']); if (['start','stop','restart','graceful'].includes(a[0])) return this.c_systemctl([a[0]==='graceful'?'reload':a[0],'httpd']); return this.c_httpd(a); };

/* ---------- systemctl: scenáre ---------- */
const origSys = P.c_systemctl;
P.c_systemctl = function(a){
  const o = this.opts(a,['type','state']);
  const sub = o.pos[0]; const units = o.pos.slice(1).map(u=>this._svcName(u));
  const s = this.scn || {};
  // núdzový režim
  if (this.emergency && (sub==='default' || (sub==='isolate' && /multi-user|default/.test(units[0]||'')))){
    if (this.user!=='root') return {e:'Access denied\n',code:1};
    const r = this.c_mount(['-a']);
    if (r && r.e) return {e:`A dependency job for ${sub==='default'?'default.target':'multi-user.target'} failed. See 'journalctl -xe' for details.\n${r.e}`, code:1};
    this.emergency = false;
    for (const [k, st] of Object.entries(this.svc)){ if (st.installed && st.enabled && !st.masked){ st.active = true; st.failed = false; } }
    return {o:'(systém pokračuje v štarte do multi-user.target: služby sa spúšťajú, prihlásenie cez SSH už funguje)\n'};
  }
  if (units.includes('systemd-journald') || units.includes('systemd-journald.service')){
    if (this.user!=='root' && ['restart','start','stop','reload'].includes(sub)) return {e:'Failed to restart systemd-journald.service: Access denied\n',code:1};
    if (sub==='status') return '● systemd-journald.service - Journal Service\n     Loaded: loaded (/usr/lib/systemd/system/systemd-journald.service; static)\n     Active: active (running)\n';
    if (['restart','start','reload'].includes(sub)){ s.journaldRestarted = true; return ''; }
  }
  // reload httpd = rovnaká kontrola ako štart
  if (sub==='reload' && units.includes('httpd') && this.svc.httpd && this.svc.httpd.active && this.user==='root' && (s.cert || s.upd)){
    if (this.httpdPortBad()){ const sv=this.svc.httpd; sv.active=false; sv.failed=true; return {e:'Job for httpd.service failed.\nSee "systemctl status httpd.service" and "journalctl -xeu httpd.service" for details.\n', code:1}; }
    this._servedCertUpdate(); return '';
  }
  const r = origSys.call(this, a);
  const res = typeof r==='string' ? {o:r} : (r||{});
  if (['start','restart','reload-or-restart','try-restart','enable'].includes(sub)){
    if (units.includes('httpd')) this._servedCertUpdate();
    if (units.includes('chronyd') && this.svc.chronyd && this.svc.chronyd.active) this._chronyStart();
  }
  if (sub==='status' && units.includes('httpd') && this.svc.httpd && this.svc.httpd.failed && this.svc.httpd.scnFail && s.httpdLog){
    res.o = (res.o||'').split('\n').filter(l=>!/make_sock|could not bind|Failed with result/.test(l)).join('\n').replace(/\n*$/,'\n') + s.httpdLog.map(l=>`Nov 01 12:00:01 ${this.hostname} ${l}`).join('\n') + '\n';
  }
  if (sub==='status'){ for (const k of units){ const sv = this.svc[k]; if (sv && sv.failed && sv.failResult && sv.failResult!=='exit-code') res.o = (res.o||'').replace('failed (Result: exit-code)', `failed (Result: ${sv.failResult})`); } }
  if (['start','restart','reload-or-restart','try-restart'].includes(sub)){ for (const k of units){ const sv = this.svc[k]; if (sv && sv.active) sv.failResult = null; } }
  if (sub==='status' && units.includes('chronyd') && s.clock){
    res.o = (res.o||'').replace(/\n*$/,'\n') + (this._chronyBadSource() ? `Nov 01 07:58:02 ${this.hostname} chronyd[811]: Could not resolve address of ntp.stara-firma.local: Name or service not known\n` : '');
  }
  return res;
};

/* ---------- journalctl: scenáre ---------- */
const origJ = P.c_journalctl;
P.c_journalctl = function(a){
  const s = this.scn || {};
  const vac = a.find(x=>/^--vacuum-(size|time|files)/.test(x));
  if (a.includes('--disk-usage')){ const gb = this._journalGB(); return `Archived and active journals take up ${gb>=1?gb.toFixed(1)+'G':Math.round(gb*1024)+'M'} in the file system.\n`; }
  if (vac){
    if (this.user!=='root') return {e:'Failed to open journal directory: Permission denied\n',code:1};
    return this._vacuum(vac, a);
  }
  const o = this.opts(a,['u','p','n','since','until','b','g','t','o']);
  const k = o.v.u ? this._svcName(o.v.u) : null;
  const H = l => `Nov 01 12:00:01 ${this.hostname} ${l}`;
  if (k==='httpd' && s.httpdLog && this.svc.httpd && this.svc.httpd.failed) return s.httpdLog.map(H).join('\n')+'\n';
  if (k==='chronyd' && s.clock){
    const L = ['chronyd[811]: chronyd version 4.6.1 starting (+CMDMON +NTP +REFCLOCK +RTC +PRIVDROP +SCFILTER +SIGND +ASYNCDNS +NTS +SECHASH +IPV6 +DEBUG)'];
    if (this._chronyBadSource()) L.push('chronyd[811]: Could not resolve address of ntp.stara-firma.local: Name or service not known', 'chronyd[811]: No suitable source for synchronisation');
    if (!this.svc.chronyd.active) L.push('systemd[1]: Stopping NTP client/server...', 'systemd[1]: chronyd.service: Deactivated successfully.', 'systemd[1]: Stopped NTP client/server.');
    else if (!this._chronyBadSource()) L.push('chronyd[811]: Selected source 10.0.20.2', s.clockOff ? '' : 'chronyd[811]: System clock wrong by 7954.120533 seconds', s.clockOff ? '' : 'chronyd[811]: System clock was stepped by 7954.120533 seconds');
    return L.filter(Boolean).map(H).join('\n')+'\n';
  }
  if (o.has('k') || (o.has('b') && s.dmesg && (o.has('p') || o.has('x') || o.has('k')))){
    if (s.dmesg && s.dmesg.length){ const base = origJ.call(this, a); const txt = typeof base==='string'?base:((base&&base.o)||''); return txt.replace(/\n*$/,'\n') + s.dmesg.map(l=>H('kernel: '+l)).join('\n')+'\n'; }
  }
  if (this.emergency && (o.has('b') || o.has('x') || o.has('p'))){
    const bad = (s.fstabBad||'');
    const unit = 'dev-disk-by\\x2duuid-'+bad.replace(/-/g,'\\x2d')+'.device';
    return [`systemd[1]: ${unit}: Job ${unit}/start timed out.`, `systemd[1]: Timed out waiting for device /dev/disk/by-uuid/${bad}.`, `systemd[1]: Dependency failed for /data.`, `systemd[1]: Dependency failed for Local File Systems.`, `systemd[1]: local-fs.target: Job local-fs.target/start failed with result 'dependency'.`, `systemd[1]: data.mount: Job data.mount/start failed with result 'dependency'.`, `systemd[1]: Started Emergency Shell.`, `systemd[1]: Reached target Emergency Mode.`].map(l=>'Nov 01 06:02:11 '+this.hostname+' '+l).join('\n') + '\n';
  }
  return origJ.call(this, a);
};
const origDmesg = P.c_dmesg;
P.c_dmesg = function(a){
  const r = origDmesg.call(this, a);
  const s = this.scn; if (!s || !s.dmesg || this.user!=='root') return r;
  const txt = typeof r==='string'?r:((r&&r.o)||'');
  return txt.replace(/\n*$/,'\n') + s.dmesg.map((l,i)=>`[${(84211.5+i*0.0013).toFixed(6)}] ${l}`).join('\n') + '\n';
};

/* ---------- plný /var: žurnál ---------- */
P._journalGB = function(){
  const d = this._lookup('/var/log/journal'); let gb = 0;
  const walk = n => { if (!n) return; if (n.t==='d') Object.values(n.c).forEach(walk); else if (n.hog) gb += n.hog; };
  walk(d); return gb || 0.05;
};
P._vacuum = function(flag, a){
  const id = this.scn && this.scn.jid; const dirp = '/var/log/journal/'+(id||'');
  const dir = this._lookup(dirp);
  if (!dir || dir.t!=='d') return `Vacuuming done, freed 0B of archived journals from /var/log/journal.\n`;
  const v = (flag.split('=')[1] || a[a.indexOf(flag)+1] || '').trim();
  let limit = Infinity;
  if (/size/.test(flag)){ const m = v.match(/^(\d+(?:\.\d+)?)([KMG]?)/i); if (!m) return {e:`Failed to parse size value: ${v}\n`,code:1}; limit = +m[1] / ({K:1048576,M:1024,G:1,'':1073741824})[(m[2]||'').toUpperCase()]; }
  const files = Object.entries(dir.c).filter(([f])=>f.includes('@')).sort((x,y)=>x[0]<y[0]?-1:1);
  let total = this._journalGB(), freed = 0; const out = [];
  for (const [f,n] of files){
    if (/size/.test(flag) && total <= limit) break;
    if (/files/.test(flag) && files.length - out.length <= (+v||0)) break;
    delete dir.c[f]; total -= (n.hog||0); freed += (n.hog||0); out.push(`Deleted archived journal ${dirp}/${f} (${(n.hog||0).toFixed(1)}G).`);
  }
  return out.join('\n') + (out.length?'\n':'') + `Vacuuming done, freed ${freed.toFixed(1)}G of archived journals from ${dirp}.\n`;
};

/* ---------- čas a chrony ---------- */
P._chronyBadSource = function(){
  const c = this.read('/etc/chrony.conf')||'';
  const src = c.split('\n').filter(l=>/^\s*(server|pool)\s+\S+/.test(l));
  if (!src.length) return true;
  return src.every(l=>/stara-firma/.test(l));
};
P._chronyStart = function(){
  const s = this.scn; if (!s || !s.clock) return;
  const c = this.read('/etc/chrony.conf')||'';
  if (!this._chronyBadSource() && /^\s*makestep\s+/m.test(c)) s.clockOff = 0;
};
const fmtDate = (d, f)=> f.replace(/%([YmdHMSFTsaAbBeZz%])/g, (_, k)=>({Y:d.getFullYear(), m:z2(d.getMonth()+1), d:z2(d.getDate()), H:z2(d.getHours()), M:z2(d.getMinutes()), S:z2(d.getSeconds()), F:`${d.getFullYear()}-${z2(d.getMonth()+1)}-${z2(d.getDate())}`, T:`${z2(d.getHours())}:${z2(d.getMinutes())}:${z2(d.getSeconds())}`, s:Math.floor(d.getTime()/1000), a:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()], A:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()], b:MONS[d.getMonth()], B:MONS[d.getMonth()], e:String(d.getDate()).padStart(2,' '), Z:'CET', z:'+0100', '%':'%'})[k]);
const origDate = P.c_date;
P.c_date = function(a){
  const off = this.scn && this.scn.clockOff;
  if (!off) return origDate.call(this, a);
  const d = new Date(Date.now() + off*1000);
  if (a[0] && a[0].startsWith('+')) return fmtDate(d, a[0].slice(1).replace(/^["']|["']$/g,''))+'\n';
  return fmtDate(d, '%a %b %e %H:%M:%S CET %Y')+'\n';
};
const origTdc = P.c_timedatectl;
P.c_timedatectl = function(a){
  const s = this.scn;
  if (!s || !s.clock || a.length) {
    if (s && s.clock && a[0]==='set-ntp' && this.user==='root'){ const on = /^(true|yes|1|on)$/.test(a[1]||''); if (on){ this.svc.chronyd.enabled = true; this.svc.chronyd.active = true; this._chronyStart(); } else { this.svc.chronyd.active=false; this.svc.chronyd.enabled=false; } return ''; }
    return origTdc.call(this, a);
  }
  const d = new Date(Date.now() + (s.clockOff||0)*1000);
  const sync = this.svc.chronyd.active && !this._chronyBadSource() && !s.clockOff;
  return `               Local time: ${fmtDate(d,'%a %Y-%m-%d %H:%M:%S')} CET\n           Universal time: ${fmtDate(new Date(d.getTime()-3600e3),'%a %Y-%m-%d %H:%M:%S')} UTC\n                 RTC time: ${fmtDate(new Date(d.getTime()-3600e3),'%a %Y-%m-%d %H:%M:%S')}\n                Time zone: Europe/Bratislava (CET, +0100)\nSystem clock synchronized: ${sync?'yes':'no'}\n              NTP service: ${this.svc.chronyd.active?'active':'inactive'}\n          RTC in local TZ: no\n`;
};
const origChrony = P.c_chronyc;
P.c_chronyc = function(a){
  const s = this.scn;
  if (!s || !s.clock) return origChrony.call(this, a);
  if (!this.svc.chronyd.active) return {e:'506 Cannot talk to daemon\n', code:1};
  const bad = this._chronyBadSource();
  if (a[0]==='sources') return 'MS Name/IP address         Stratum Poll Reach LastRx Last sample\n===============================================================================\n' + (bad ? '^? ntp.stara-firma.local        0   6     0     -     +0ns[   +0ns] +/-    0ns\n' : `^* 10.0.20.2                    2   6   377    21   ${s.clockOff?'-7954s[ -7954s]':'+112us[ +140us]'} +/-   14ms\n`);
  if (a[0]==='tracking') return bad ? 'Reference ID    : 00000000 ()\nStratum         : 0\nSystem time     : 0.000000000 seconds fast of NTP time\nLeap status     : Not synchronised\n' : `Reference ID    : 0A001402 (10.0.20.2)\nStratum         : 3\nSystem time     : ${s.clockOff ? (-s.clockOff).toFixed(6)+' seconds slow of NTP time' : '0.000021 seconds fast of NTP time'}\nLeap status     : Normal\n`;
  if (a[0]==='makestep'){ if (this.user!=='root') return {e:'501 Not authorised\n', code:1}; if (!bad) s.clockOff = 0; return '200 OK\n'; }
  return origChrony.call(this, a);
};

/* ---------- dnf: nefunkčný repozitár, plný /var, rollback ---------- */
P._badRepo = function(a){
  const dn = this.node('/etc/yum.repos.d'); if (!dn) return null;
  const dis = a.filter(x=>x.startsWith('--disablerepo')).map(x=>x.includes('=')?x.split('=')[1]:a[a.indexOf(x)+1]).join(',');
  for (const [f,n] of Object.entries(dn.c)){
    if (!f.endsWith('.repo') || n.t!=='f') continue;
    let cur = null; const reps = [];
    for (const l of (n.c||'').split('\n')){
      const sec = l.match(/^\s*\[(.+)\]\s*$/); if (sec){ cur = {id:sec[1], en:true, skip:false}; reps.push(cur); continue; }
      const kv = l.match(/^\s*([\w.]+)\s*=\s*(.*)$/); if (!kv || !cur) continue;
      if (kv[1]==='enabled') cur.en = !/^(0|false|no)$/i.test(kv[2].trim());
      if (kv[1]==='skip_if_unavailable') cur.skip = /^(1|true|yes)$/i.test(kv[2].trim());
      if (kv[1]==='baseurl') cur.url = kv[2].trim();
    }
    for (const r of reps) if (r.en && !r.skip && /repo\.firma\.local/.test(r.url||'') && !dis.split(',').some(d=>d==='*' || d===r.id)) return r;
  }
  return null;
};
const origDnf = P.c_dnf;
P.c_dnf = function(a){
  const o = this.opts(a,['enablerepo','disablerepo','setopt']);
  const sub = o.pos[0]; const s = this.scn || {};
  const net = ['install','update','upgrade','makecache','search','info','list','check-update','provides','whatprovides','reinstall','downgrade','updateinfo'];
  if (s.repo && net.includes(sub)){
    const r = this._badRepo(a);
    if (r) return {o:`Updating Subscription Management repositories.\nFiremné nástroje (staré)                        0.0  B/s |   0  B     00:00\n`, e:`Errors during downloading metadata for repository '${r.id}':\n  - Curl error (6): Couldn't resolve host name for ${r.url.replace(/\/$/,'')}/repodata/repomd.xml [Could not resolve host: repo.firma.local]\nError: Failed to download metadata for repo '${r.id}': Cannot download repomd.xml: Cannot download repodata/repomd.xml: All mirrors were tried\n`, code:1};
  }
  if (s.varfull && ['install','update','upgrade','reinstall'].includes(sub) && this.user==='root'){
    const m = this.mounts.find(x=>x.dir==='/var');
    if (m && (m.used + this._hogGB('/var'))/m.size > 0.95) return {o:'Updating Subscription Management repositories.\nDependencies resolved.\n', e:`Error: Transaction test error:\n  installing package ${o.pos[1]||'kernel-core'} needs 64MB more space on the /var filesystem\n\nError Summary\n-------------\nDisk Requirements:\n   At least 64MB more space needed on the /var filesystem.\n`, code:1};
  }
  if (s.upd && sub==='history'){
    const act = o.pos[1]; let id = o.pos[2];
    if (id==='last') id = String(this.dnfHist.length);
    if (act==='info' && +id===s.updTx) return `Transaction ID : ${s.updTx}\nBegin time     : ${s.updDate||'Sat Oct 31 2026'} 22:14:05 CET\nUser           : admin <admin>\nReturn-Code    : Success\nCommand Line   : update -y\nPackages Altered:\n    Upgrade  acme-webplugin-2.0-1.el9.x86_64        @acme\n    Upgraded acme-webplugin-1.4-2.el9.x86_64        @@System\nScriptlet output:\n   1 warning: /etc/httpd/conf.modules.d/20-acme.conf created as /etc/httpd/conf.modules.d/20-acme.conf.rpmnew\n`;
    if ((act==='undo' || act==='rollback') && (+id===s.updTx || (act==='rollback' && +id===s.updTx-1))){
      if (this.user!=='root') return {e:'Error: This command has to be run with superuser privileges (under the root user on most systems).\n', code:1};
      if (s.updUndone) return 'Nothing to do.\nComplete!\n';
      s.updUndone = true;
      const n = this._mkPath('/etc/httpd/modules/mod_acme.so','f',0o755,'root','root','ELF'); n.ctx='httpd_modules_t';
      this.dnfHist.push({id:this.dnfHist.length+1, cmd:'history '+act+' '+id, date:new Date().toISOString().slice(0,16).replace('T',' '), act:'Downgrade', n:1, pk:['acme-webplugin']});
      return `Updating Subscription Management repositories.\nUndoing transaction ${s.updTx}, from ${s.updDate||'Sat Oct 31 2026'} 22:14:05 CET\n    Upgrade  acme-webplugin-2.0-1.el9.x86_64 @acme\n    Upgraded acme-webplugin-1.4-2.el9.x86_64 @@System\nDependencies resolved.\n================================================================================\n Package              Arch       Version          Repository     Size\n================================================================================\nDowngrading:\n acme-webplugin       x86_64     1.4-2.el9        acme           48 k\n\nTransaction Summary\n================================================================================\nDowngrade  1 Package\n\nRunning transaction\n  Downgrading      : acme-webplugin-1.4-2.el9.x86_64                       1/2\n  Cleanup          : acme-webplugin-2.0-1.el9.x86_64                       2/2\n\nDowngraded:\n  acme-webplugin-1.4-2.el9.x86_64\n\nComplete!\n`;
    }
  }
  return origDnf.call(this, a);
};
const origRpm = P.c_rpm;
P.c_rpm = function(a){
  const s = this.scn;
  if (s && s.upd && a.some(x=>/^-q/.test(x)) && a.includes('acme-webplugin')) return `acme-webplugin-${s.updUndone?'1.4-2':'2.0-1'}.el9.x86_64\n`;
  return origRpm.call(this, a);
};

/* ---------- vlastné služby: EnvironmentFile, OOM, DB_HOST ---------- */
const origVal = P._dynValidate;
P._dynValidate = function(k){
  const txt = this._unitFile(k);
  if (txt){
    for (const m of txt.matchAll(/^EnvironmentFile=(-?)(\S+)/gm)){
      if (!m[1] && !this.exists(m[2])) return {st:'resources', result:'resources', full:true, msg:`${k}.service: Failed to load environment files: No such file or directory\n${k}.service: Failed to spawn 'start' task: No such file or directory\n${k}.service: Failed with result 'resources'.\nFailed to start ${k}.service.`};
    }
  }
  const r = origVal.call(this, k); if (r) return r;
  const s = this.scn || {};
  const env = p => { const t = this.read(p)||''; const o = {}; t.split('\n').forEach(l=>{ const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/); if (m) o[m[1]] = m[2]; }); return o; };
  if (s.oom && k==='reporting'){
    const e = env('/etc/sysconfig/reporting'); const x = ((e.JAVA_OPTS||'').match(/-Xmx(\d+)([mMgG])/)||[]);
    const mb = x[1] ? (+x[1]) * (/g/i.test(x[2])?1024:1) : 0;
    if (!mb || mb > 2560){
      s.dmesg = (s.dmesg||[]).concat([`java invoked oom-killer: gfp_mask=0x140cca(GFP_HIGHUSER_MOVABLE|__GFP_COMP), order=0, oom_score_adj=0`, `Out of memory: Killed process 4120 (java) total-vm:${(mb||6144)*1024+412000}kB, anon-rss:3654104kB, file-rss:0kB, shmem-rss:0kB, UID:991 pgtables:7720kB oom_score_adj:0`]);
      return {st:'9/KILL', result:'oom-kill', full:true, msg:`reporting[4120]: Spúšťam reporting s JAVA_OPTS=${e.JAVA_OPTS||'(nenastavené)'}\nreporting.service: A process of this unit has been killed by the OOM killer.\nreporting.service: Main process exited, code=killed, status=9/KILL\nreporting.service: Failed with result 'oom-kill'.`};
    }
  }
  if (s.envf && k==='report'){
    const e = env('/etc/sysconfig/report');
    if (!e.DB_HOST) return {st:'1/FAILURE', msg:`report[4410]: CHYBA: premenná DB_HOST nie je nastavená (očakáva sa v /etc/sysconfig/report)`};
    if (this._resolve && !this._resolve(e.DB_HOST)) return {st:'1/FAILURE', msg:`report[4410]: CHYBA: nedá sa pripojiť k ${e.DB_HOST}: Name or service not known`};
  }
  return null;
};

/* ---------- CPU: bežiaci skript z cronu ---------- */
P._cronEveryMinute = function(){
  const t = this.read('/etc/cron.d/reports');
  if (t==null) return false;
  return t.split('\n').some(l=>/sync-reports/.test(l) && !/^\s*#/.test(l) && /^\s*(\*|\*\/1)\s/.test(l));
};
P._cpuHogs = function(){ return (this.procs||[]).filter(p=>+p.cpu>=50).length; };
const loadStr = m => { const h = m._cpuHogs(); if (!h) return null; const l1 = (h*1.0+0.08).toFixed(2), l5 = (h*0.94+0.05).toFixed(2), l15 = (h*0.71+0.04).toFixed(2); return `${l1}, ${l5}, ${l15}`; };
for (const nm of ['c_uptime','c_w','c_top']){
  const orig = P[nm];
  P[nm] = function(a){ const r = orig.call(this, a); const ls = loadStr(this); if (!ls) return r; const fix = t => t.replace(/load average: [\d., ]+?(?=\n|$)/, 'load average: '+ls).replace(/%Cpu\(s\):[^\n]*/, '%Cpu(s): 97.9 us,  1.6 sy,  0.0 ni,  0.3 id,  0.0 wa,  0.2 hi,  0.0 si,  0.0 st'); if (typeof r==='string') return fix(r); if (r && r.o) r.o = fix(r.o); return r; };
}
const origRun = P.run;
P.run = function(line){
  const s = this.scn;
  if (s && s.cpu && this._cronEveryMinute()){
    s.tick = (s.tick||0) + 1;
    if (s.tick % 4 === 0){ const pid = 5101 + (s.nextPid = (s.nextPid||4)+1); this.procs.push({u:'root', pid, cpu:98.7, mem:0.1, stat:'R', cmd:'/bin/bash /usr/local/bin/sync-reports.sh'}); const cl = this._lookup('/var/log/cron'); if (cl) cl.c += `Nov  1 ${new Date().toTimeString().slice(0,8)} ${this.hostname} CROND[${pid}]: (root) CMD (/usr/local/bin/sync-reports.sh)\n`; }
  }
  return origRun.call(this, line);
};

/* ---------- faillock, heslá ---------- */
P.c_faillock = function(a){
  if (this.user!=='root') return {e:'faillock: Error opening /var/run/faillock: Permission denied\n(tip: sudo faillock --user MENO)\n', code:1};
  const fl = this.faillock = this.faillock || {};
  const ui = a.indexOf('--user'); const u = ui>=0 ? a[ui+1] : null;
  if (a.includes('--reset')){ if (u) delete fl[u]; else for (const k of Object.keys(fl)) delete fl[k]; return ''; }
  const show = u ? [u] : Object.keys(fl);
  return show.map(n=>`${n}:\nWhen                Type  Source                                           Valid\n` + (fl[n]||[]).map(t=>`${t}  RHOST 10.0.20.77                                           V`).join('\n') + ((fl[n]||[]).length?'\n':'')).join('');
};
const origPw = P.c_passwd;
P.c_passwd = function(a, stdin){
  const r = origPw.call(this, a, stdin);
  const o = this.opts(a); const nm = o.pos[0] || this.user; const u = this.users[nm];
  if (u && !o.has('l') && !o.has('u') && !o.has('S') && !o.has('e') && (nm===this.user || this.user==='root')){ this.pwSeq = (this.pwSeq||0)+1; u.pwAt = this.pwSeq; u.expired = false; }
  return r;
};
const origChage = P.c_chage;
P.c_chage = function(a){
  const r = origChage.call(this, a);
  const o = this.opts(a,['M','m','W','E','d']); const u = this.users[o.pos[0]];
  if (u && o.has('l') && u.expired && typeof r==='string') return r.replace(/^Last password change[^\n]*/, 'Last password change\t\t\t\t\t: password must be changed').replace(/^Password expires[^\n]*/m, 'Password expires\t\t\t\t\t: password must be changed');
  return r;
};

/* ---------- reboot: certifikát, čas ---------- */
const origReboot = P.c_reboot;
P.c_reboot = function(a){
  const r = origReboot.call(this, a);
  const s = this.scn;
  if (s){
    if (s.cert) this._servedCertUpdate();
    if (s.clock && this.svc.chronyd && this.svc.chronyd.active) this._chronyStart();
  }
  return r;
};

/* ---------- ausearch/sealert pri TLS scenári ---------- */
const origAus = P.c_ausearch;
P.c_ausearch = function(a){
  const h = this.svc.httpd; const sf = !!(h && h.scnFail && h.failed);
  if (sf) h.failed = false;
  let r; try { r = origAus.call(this, a); } finally { if (sf) h.failed = true; }
  const av = this.scn && this.scn.avc;
  if (av && sf && this.user==='root'){ const t = typeof r==='string' ? r : ''; return (/no matches/.test(t) ? '' : t) + '----\ntime->'+new Date().toString().slice(0,24)+'\n'+av+'\n'; }
  return r;
};
const origSeal = P.c_sealert;
P.c_sealert = function(a){
  const av = this.scn && this.scn.avc; const h = this.svc.httpd;
  if (av && h && h.scnFail && h.failed){ const nm = (av.match(/name="([^"]+)"/)||[])[1]; const c = this._sslConf()||{}; const full = [c.key, c.cert].find(x=>x && x.endsWith('/'+nm)) || nm; return `SELinux is preventing /usr/sbin/httpd from read access on the file ${nm}.\n\n*****  Plugin restorecon (99.5 confidence) suggests   ************************\n\nIf you want to fix the label.\n${nm} default label should be cert_t.\nThen you can run restorecon.\nDo\n# /sbin/restorecon -v ${full}\n`; }
  return origSeal.call(this, a);
};
})();
