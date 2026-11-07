/* =========================================================
   SIMULÁTOR: sieť do hĺbky
   druhá sieťovka ens224 (zálohová sieť 10.0.30.0/24),
   profily NetworkManagera, dočasné zmeny cez ip,
   statické trasy, tracepath, nc, tcpdump, ethtool
   ========================================================= */
(function(){
'use strict';
const P = window.Machine.prototype;
const {PKG_DB, pad} = window.MachineData;

PKG_DB['iputils'].cmds = Array.from(new Set(PKG_DB['iputils'].cmds.concat(['tracepath','arping'])));
PKG_DB['nmap-ncat'] = {v:'7.92-3', s:'Nmap\'s Netcat replacement', repo:'appstream', cmds:['nc','ncat']};
PKG_DB['tcpdump'] = {v:'4.99.0-9', s:'A network traffic monitoring tool', repo:'appstream', cmds:['tcpdump']};
PKG_DB['ethtool'] = {v:'6.11-1', s:'Settings tool for Ethernet NICs', repo:'baseos', cmds:['ethtool']};
PKG_DB['traceroute'] = {v:'2.1.1-1', s:'Traces the route taken by packets over an IPv4/IPv6 network', repo:'baseos', cmds:['traceroute']};
PKG_DB['mtr'] = {v:'0.95-1', s:'Network diagnostic tool combining traceroute and ping', repo:'appstream', cmds:['mtr']};

/* ---------- adresy ---------- */
const ip2n = ip => ip.split('.').reduce((a,b)=>(a<<8)+(+b), 0)>>>0;
const n2ip = n => [24,16,8,0].map(s=>(n>>>s)&255).join('.');
const parseCidr = c => { const [ip, pl] = String(c).split('/'); if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip||'')) return null; const p = pl==null ? 32 : +pl; if (!(p>=0 && p<=32)) return null; const mask = p===0 ? 0 : (0xFFFFFFFF << (32-p))>>>0; return {ip, p, net:(ip2n(ip)&mask)>>>0, mask}; };
const netOf = c => { const x = parseCidr(c); return x ? n2ip(x.net)+'/'+x.p : null; };
const inNet = (cidr, ip) => { const x = parseCidr(cidr); return !!x && ((ip2n(ip) & x.mask)>>>0) === x.net; };
const HOSTS = {'10.0.30.1':'router zálohovej siete','10.0.30.60':'backup01 (zálohová sieť)','10.0.40.10':'nas01'};
const PORTS = {'10.0.20.40':[22,3306],'10.0.20.32':[22,80,443],'10.0.20.50':[22,3000,9090],'10.0.20.60':[22],'10.0.20.1':[22,53],'10.0.20.2':[53],'10.0.30.60':[22,873],'10.0.40.10':[22,111,2049],'10.0.30.1':[22],'8.8.8.8':[53,443],'23.42.177.205':[80,443],'142.250.180.206':[80,443]};
const MAC2 = '00:50:56:a1:7d:22';

const origReset = P.reset;
P.reset = function(){
  origReset.call(this);
  this.nx = {linkDown:[], tmpAddrs:[], tmpRoutes:[], mtu:{}, e192:{addrs:[], routes:[], search:null}, e192a:{addrs:[], routes:[], search:null}, prof:{}};
  this.pkgs.add('ethtool');
};
const NX = m => (m.nx = m.nx || {linkDown:[], tmpAddrs:[], tmpRoutes:[], mtu:{}, e192:{addrs:[], routes:[], search:null}, e192a:{addrs:[], routes:[], search:null}, prof:{}});

/* aktívny profil na zariadení */
P._nxActive = function(dev){ const x = NX(this); if (dev===this.net.ifc) return {name:this.net.ifc, primary:true}; return Object.values(x.prof).find(p=>p.dev===dev && p.active) || null; };
/* aktuálny stav (to, čo ukazuje ip) */
P._nxState = function(){
  const x = NX(this), devs = [this.net.ifc, 'ens224'];
  const st = {addrs:[], routes:[]};
  const up = d => !x.linkDown.includes(d);
  if (up(this.net.ifc)){
    st.addrs.push({dev:this.net.ifc, cidr:this.net.ip, src:'prof'});
    x.e192a.addrs.forEach(c=>st.addrs.push({dev:this.net.ifc, cidr:c, src:'prof'}));
  }
  for (const p of Object.values(x.prof)) if (p.active && p.live && up(p.dev)) p.live.addrs.forEach(c=>st.addrs.push({dev:p.dev, cidr:c, src:'prof'}));
  x.tmpAddrs.forEach(a=>{ if (up(a.dev)) st.addrs.push(Object.assign({src:'tmp'}, a)); });
  const seen = new Set();
  for (const a of st.addrs){ const n = netOf(a.cidr); const k = n+'|'+a.dev; if (seen.has(k)) continue; seen.add(k); st.routes.push({dst:n, dev:a.dev, proto:'kernel', src:a.cidr.split('/')[0], metric: a.dev===this.net.ifc?100:101}); }
  if (up(this.net.ifc)){
    st.routes.unshift({dst:'default', via:this.net.gw, dev:this.net.ifc, proto:'static', metric:100});
    x.e192a.routes.forEach(r=>st.routes.push({dst:r.dst, via:r.via, dev:this.net.ifc, proto:'static', metric:100}));
  }
  for (const p of Object.values(x.prof)) if (p.active && p.live && up(p.dev)){
    const L = p.live;
    if (L.gw && !L.neverDefault) st.routes.push({dst:'default', via:L.gw, dev:p.dev, proto:'static', metric:101});
    L.routes.forEach(r=>st.routes.push({dst:r.dst, via:r.via, dev:p.dev, proto:'static', metric:101}));
  }
  x.tmpRoutes.forEach(r=>{ if (up(r.dev)) st.routes.push(Object.assign({proto:'boot', tmp:true}, r)); });
  return st;
};
P._nxRoute = function(ip){
  if (/^127\./.test(ip)) return {dev:'lo', dst:'127.0.0.0/8', local:true};
  const st = this._nxState(); let best = null, bp = -1;
  for (const r of st.routes){ const p = r.dst==='default' ? 0 : (parseCidr(r.dst)||{}).p; const ok = r.dst==='default' || inNet(r.dst, ip); if (ok && (p > bp || (p===bp && best && (r.metric||0) < (best.metric||0)))){ best = r; bp = p; } }
  if (!best) return null;
  const src = (st.addrs.find(a=>a.dev===best.dev && (!best.via || inNet(a.cidr, best.via))) || st.addrs.find(a=>a.dev===best.dev) || {cidr:''}).cidr.split('/')[0];
  return Object.assign({src}, best);
};
/* je cieľ dosiahnuteľný? vráti {ok, hops:[…], why} */
P._nxReach = function(ip){
  if (/^127\./.test(ip) || this._nxState().addrs.some(a=>a.cidr.split('/')[0]===ip)) return {ok:true, hops:[ip], local:true};
  const r = this._nxRoute(ip);
  if (!r) return {ok:false, why:'unreach'};
  const special = inNet('10.0.30.0/24', ip) || inNet('10.0.40.0/24', ip);
  if (!special) return {ok:true, legacy:true, hops: r.via ? [r.via, ip] : [ip]};
  if (inNet('10.0.30.0/24', ip)){
    if (r.dev!=='ens224' || r.via) return {ok:false, why:'timeout', hops: r.via ? [r.via] : []};
    return {ok: !!HOSTS[ip], why: HOSTS[ip] ? '' : 'hostunreach', hops:[ip]};
  }
  // 10.0.40.0/24 len cez 10.0.30.1
  if (r.via==='10.0.30.1' && r.dev==='ens224') return {ok: !!HOSTS[ip], why: HOSTS[ip]?'':'hostunreach', hops:['10.0.30.1', ip]};
  return {ok:false, why:'timeout', hops: r.via ? [r.via] : []};
};

/* ---------- ip ---------- */
const flagsLine = up => up ? '<BROADCAST,MULTICAST,UP,LOWER_UP>' : '<BROADCAST,MULTICAST>';
P.c_ip = function(a){
  const x = NX(this);
  const opts = a.filter(s=>/^-/.test(s)); const w = a.filter(s=>!/^-/.test(s));
  const brief = opts.some(o=>/^-br(ief)?$/.test(o)), stats = opts.some(o=>/^-s(tat(istics)?)?$/.test(o)), only4 = opts.includes('-4');
  const obj = w[0]||'', act = w[1]||'';
  const need = ()=> this.user!=='root' ? {e:'RTNETLINK answers: Operation not permitted\n', code:2} : null;
  const devs = ['lo', this.net.ifc, 'ens224'];
  const st = this._nxState();
  const up = d => d==='lo' || !x.linkDown.includes(d);
  const mac = d => d==='lo' ? '00:00:00:00:00:00' : d==='ens224' ? MAC2 : this.net.mac;
  const mtu = d => d==='lo' ? 65536 : (x.mtu[d]||1500);
  const devAddrs = d => d==='lo' ? ['127.0.0.1/8'] : st.addrs.filter(y=>y.dev===d).map(y=>y.cidr);
  const devArg = () => { const i = w.indexOf('dev'); return i>=0 ? w[i+1] : null; };
  const exists = d => devs.includes(d);
  /* address */
  if (/^a(d(dr?|dress)?)?$/.test(obj)){
    if (act==='add' || act==='del' || act==='delete'){
      const n = need(); if (n) return n;
      const cidr = w[2]; const d = devArg();
      if (!parseCidr(cidr||'') || !d) return {e:'Usage: ip address {add|del} IFADDR dev IFNAME\n(príklad: sudo ip addr add 10.0.20.99/24 dev ens192)\n', code:255};
      if (!exists(d)) return {e:`Cannot find device "${d}"\n`, code:1};
      const c2 = cidr.includes('/') ? cidr : cidr+'/32';
      if (act==='add'){ if (devAddrs(d).includes(c2)) return {e:'RTNETLINK answers: File exists\n', code:2}; x.tmpAddrs.push({dev:d, cidr:c2}); return ''; }
      const i = x.tmpAddrs.findIndex(t=>t.dev===d && t.cidr===c2);
      if (i>=0){ x.tmpAddrs.splice(i,1); return ''; }
      if (d===this.net.ifc && this.net.ip===c2) return {e:'(simulátor: hlavnú IP neodoberám, odpojil by si sa zo SSH. Skús to s adresou, ktorú si pridal.)\n', code:1};
      return {e:'RTNETLINK answers: Cannot assign requested address\n', code:2};
    }
    const showDev = (act==='show' && w[2]) ? w[2] : (w[1] && w[1]!=='show' && exists(w[1]) ? w[1] : null);
    if (showDev && !exists(showDev)) return {e:`Device "${showDev}" does not exist.\n`, code:1};
    const list = showDev ? [showDev] : devs;
    if (brief) return list.map(d=>`${pad(d,16,true)} ${pad(d==='lo'?'UNKNOWN':up(d)&&(d!=='ens224'||this._nxActive('ens224')||x.tmpAddrs.some(t=>t.dev==='ens224'))?'UP':'DOWN',14,true)} ${devAddrs(d).join(' ')}${d===this.net.ifc&&up(d)?' fe80::250:56ff:fea1:3c7e/64':''}${d==='lo'?' ::1/128':''} `).join('\n')+'\n';
    return list.map((d,i)=>{ const idx = devs.indexOf(d)+1; if (d==='lo') return `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet 127.0.0.1/8 scope host lo\n       valid_lft forever preferred_lft forever\n` + (only4?'':`    inet6 ::1/128 scope host noprefixroute \n       valid_lft forever preferred_lft forever\n`);
      const u = up(d) && (d!=='ens224' || !!this._nxActive('ens224') || x.tmpAddrs.some(t=>t.dev==='ens224'));
      let s = `${idx}: ${d}: ${flagsLine(up(d))} mtu ${mtu(d)} qdisc mq state ${u?'UP':'DOWN'} group default qlen 1000\n    link/ether ${mac(d)} brd ff:ff:ff:ff:ff:ff\n    altname enp${d==='ens224'?'19':'11'}s0\n`;
      for (const y of st.addrs.filter(y=>y.dev===d)){ const p = parseCidr(y.cidr); const brd = n2ip((p.net | (~p.mask>>>0))>>>0); s += `    inet ${y.cidr} brd ${brd} scope global ${y.cidr===this.net.ip?'noprefixroute ':y.src==='prof'?'secondary noprefixroute ':'secondary '}${d}\n       valid_lft forever preferred_lft forever\n`; }
      if (d===this.net.ifc && up(d) && !only4) s += `    inet6 fe80::250:56ff:fea1:3c7e/64 scope link noprefixroute \n       valid_lft forever preferred_lft forever\n`;
      return s; }).join('');
  }
  /* link */
  if (/^l(i(nk?)?)?$/.test(obj)){
    if (act==='set'){
      const n = need(); if (n) return n;
      const d = w[2]==='dev' ? w[3] : w[2]; if (!exists(d)) return {e:`Cannot find device "${d}"\n`, code:1};
      if (w.includes('down')){ if (d===this.net.ifc) return {e:'(simulátor: ip link set ens192 down by ťa odpojilo zo SSH a server by bol nedostupný. Skús to s ens224.)\n', code:1}; if (!x.linkDown.includes(d)) x.linkDown.push(d); }
      if (w.includes('up')) x.linkDown = x.linkDown.filter(y=>y!==d);
      const mi = w.indexOf('mtu'); if (mi>=0){ const v = +w[mi+1]; if (!(v>=68 && v<=9000)) return {e:'Error: argument "'+w[mi+1]+'" is wrong: Invalid "mtu" value\n', code:255}; x.mtu[d] = v; }
      return '';
    }
    const list = (act==='show' && w[2]) ? [w[2]] : devs;
    if (brief) return list.map(d=>`${pad(d,16,true)} ${pad(d==='lo'?'UNKNOWN':up(d)?'UP':'DOWN',14,true)} ${mac(d)} ${d==='lo'?'<LOOPBACK,UP,LOWER_UP>':flagsLine(up(d))} `).join('\n')+'\n';
    return list.map(d=>{ const idx = devs.indexOf(d)+1; let s = d==='lo' ? `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n` : `${idx}: ${d}: ${flagsLine(up(d))} mtu ${mtu(d)} qdisc mq state ${up(d)?'UP':'DOWN'} mode DEFAULT group default qlen 1000\n    link/ether ${mac(d)} brd ff:ff:ff:ff:ff:ff\n    altname enp${d==='ens224'?'19':'11'}s0\n`;
      if (stats){ const big = d===this.net.ifc; s += `    RX:  bytes packets errors dropped  missed   mcast\n    ${pad(big?'918273645':d==='lo'?'48211':'1024',13)} ${pad(big?'1204411':d==='lo'?'612':'8',7)}      0       ${big?'12':'0'}       0       ${big?'211':'0'}\n    TX:  bytes packets errors dropped carrier collsns\n    ${pad(big?'312004118':d==='lo'?'48211':'1504',13)} ${pad(big?'822104':d==='lo'?'612':'12',7)}      0       0       0       0\n`; }
      return s; }).join('');
  }
  /* route */
  if (/^r(o(u(te?)?)?)?$/.test(obj)){
    if (act==='get'){
      const ip = w[2]; if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip||'')) return {e:'Error: an inet prefix is expected rather than "'+(ip||'')+'".\n', code:1};
      const r = this._nxRoute(ip);
      if (!r) return {e:'RTNETLINK answers: Network is unreachable\n', code:2};
      if (r.local) return `local ${ip} dev lo src 127.0.0.1 uid ${this.user==='root'?0:1000} \n    cache <local> \n`;
      return `${ip} ${r.via?'via '+r.via+' ':''}dev ${r.dev} src ${r.src} uid ${this.user==='root'?0:1000} \n    cache \n`;
    }
    if (act==='add' || act==='del' || act==='delete' || act==='replace'){
      const n = need(); if (n) return n;
      let dst = w[2]; const vi = w.indexOf('via'); const via = vi>=0 ? w[vi+1] : null; let d = devArg();
      if (!dst) return {e:'Usage: ip route { add | del } PREFIX [ via ADDRESS ] [ dev IFNAME ]\n(príklad: sudo ip route add 10.0.40.0/24 via 10.0.30.1)\n', code:255};
      if (dst!=='default' && !parseCidr(dst)) return {e:`Error: inet prefix is expected rather than "${dst}".\n`, code:1};
      if (dst!=='default') dst = netOf(dst);
      if (act==='del' || act==='delete'){
        const i = x.tmpRoutes.findIndex(r=>r.dst===dst && (!via || r.via===via));
        if (i>=0){ x.tmpRoutes.splice(i,1); return ''; }
        return {e:'RTNETLINK answers: No such process\n', code:2};
      }
      if (via){
        const conn = this._nxState().routes.find(r=>r.proto==='kernel' && inNet(r.dst, via));
        if (!conn) return {e:'Error: Nexthop has invalid gateway.\n', code:2};
        d = d || conn.dev;
      }
      if (!d) return {e:'Error: Device for nexthop is not up.\n', code:2};
      if (act==='add' && (this._nxState().routes.some(r=>r.dst===dst && (r.dst!=='default' || r.dev===d)))) return {e:'RTNETLINK answers: File exists\n', code:2};
      x.tmpRoutes = x.tmpRoutes.filter(r=>!(act==='replace' && r.dst===dst));
      x.tmpRoutes.push({dst, via, dev:d, metric: dst==='default'?50:0});
      return '';
    }
    return st.routes.map(r=>`${r.dst}${r.via?' via '+r.via:''} dev ${r.dev} proto ${r.proto}${r.proto==='kernel'?' scope link src '+r.src:''}${r.metric?' metric '+r.metric:''} `).join('\n')+'\n';
  }
  /* neigh */
  if (/^n(e(i(gh?)?)?)?$/.test(obj)){
    if (act==='flush'){ const n = need(); if (n) return n; return ''; }
    let s = `${this.net.gw} dev ${this.net.ifc} lladdr 00:50:56:a1:00:01 REACHABLE\n10.0.20.15 dev ${this.net.ifc} lladdr 3c:52:82:4b:9e:11 STALE\n`;
    if (this._nxActive('ens224')) s += `10.0.30.1 dev ens224 lladdr 00:50:56:a1:00:31 ${x.pinged30?'REACHABLE':'STALE'}\n`;
    return s;
  }
  return {e:'Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | route | neigh | ... }\nSkús: ip -br a, ip r, ip -br link, ip route get 8.8.8.8\n', code:255};
};

/* ---------- nmcli ---------- */
const uuid = name => { let h = 0; for (const c of name) h = (h*31 + c.charCodeAt(0))>>>0; const x = (h.toString(16)+'7c3e9a1f4b2d8e60').slice(0,16); return `${x.slice(0,8)}-${x.slice(8,12)}-4${x.slice(13,16)}-9a3e-${(h*7>>>0).toString(16).padStart(12,'0').slice(0,12)}`; };
const yes = v => /^(yes|true|1|on)$/i.test(String(v));
P._nxWriteFile = function(p){
  const path = '/etc/NetworkManager/system-connections/'+p.name+'.nmconnection';
  const c = `[connection]\nid=${p.name}\nuuid=${p.uuid}\ntype=ethernet\ninterface-name=${p.dev}\n${p.autoconnect?'':'autoconnect=false\n'}\n[ipv4]\n${p.addrs.map((a,i)=>`address${i+1}=${a}${i===0&&p.gw?','+p.gw:''}`).join('\n')}${p.addrs.length?'\n':''}${p.dns.length?'dns='+p.dns.join(';')+';\n':''}${p.search.length?'dns-search='+p.search.join(';')+';\n':''}method=${p.method}\n${p.neverDefault?'never-default=true\n':''}${p.routes.map((r,i)=>`route${i+1}=${r.dst},${r.via}`).join('\n')}${p.routes.length?'\n':''}\n[ipv6]\nmethod=disabled\n`;
  let n = this._lookup(path); if (!n) n = this._mkPath(path,'f',0o600,'root','root',c); else n.c = c; n.ctx = 'NetworkManager_etc_rw_t'; n.mt = new Date();
};
P._nxApply192 = function(){ const x = NX(this); x.e192a = JSON.parse(JSON.stringify(x.e192)); x.tmpAddrs = x.tmpAddrs.filter(t=>t.dev!==this.net.ifc); x.tmpRoutes = x.tmpRoutes.filter(t=>t.dev!==this.net.ifc); };
P._nxSet = function(target, kvs, isAdd){
  /* target: profil (objekt) alebo 'primary'; vráti chybu alebo null */
  const x = NX(this);
  for (let i=0;i<kvs.length;i+=2){
    let k = kvs[i], v = kvs[i+1]; if (v===undefined) return `Error: value for '${k}' is missing.`;
    v = String(v).replace(/^["']|["']$/g,'');
    const mod = k[0]==='+' ? '+' : k[0]==='-' ? '-' : ''; const key = k.replace(/^[+-]/,'').replace(/^ip4$/,'ipv4.addresses').replace(/^gw4$/,'ipv4.gateway').replace(/^autoconnect$/,'connection.autoconnect').replace(/^ifname$/,'connection.interface-name').replace(/^con-name$/,'connection.id').replace(/^type$/,'connection.type');
    const list = (cur, vals) => mod==='+' ? cur.concat(vals.filter(y=>!cur.includes(y))) : mod==='-' ? cur.filter(y=>!vals.includes(y)) : vals;
    const vals = v.split(/[ ,;]+/).filter(Boolean);
    if (target==='primary'){
      const e = x.e192;
      if (key==='ipv4.addresses'){ if (!mod){ this.net.pendingIp = vals[0]; e.addrs = vals.slice(1); } else e.addrs = list(e.addrs, vals); }
      else if (key==='ipv4.gateway') this.net.pendingGw = v;
      else if (key==='ipv4.dns'){ if (!mod) this.net.pendingDns = v; else this.net.pendingDns = list((this.net.pendingDns||this.net.dns).split(/[ ,]+/), vals).join(' '); }
      else if (key==='ipv4.dns-search') e.search = list(e.search || ['firma.local'], vals);
      else if (key==='ipv4.method') this.net.method = v;
      else if (key==='ipv4.routes'){ const rs = []; for (const part of v.split(/\s*,\s*/)){ const [dst, via] = part.split(/\s+/); if (!parseCidr(dst||'')) return `Error: failed to modify ipv4.routes: invalid route '${part}'.`; rs.push({dst:netOf(dst), via}); } e.routes = mod==='+' ? e.routes.concat(rs) : mod==='-' ? e.routes.filter(r=>!rs.some(z=>z.dst===r.dst)) : rs; }
      else if (/^(ipv4\.never-default|connection\.autoconnect|ipv4\.ignore-auto-dns|ipv6\.method|connection\.id)$/.test(key)) {}
      else return `Error: invalid <setting>.<property> '${key}'.`;
      this.net.modified = true;
      continue;
    }
    const p = target;
    if (key==='ipv4.addresses'){ for (const c of vals) if (!parseCidr(c)) return `Error: failed to modify ipv4.addresses: invalid IP address: '${c}'.`; p.addrs = list(p.addrs, vals.map(c=>c.includes('/')?c:c+'/32')); }
    else if (key==='ipv4.gateway') p.gw = v || null;
    else if (key==='ipv4.dns') p.dns = list(p.dns, vals);
    else if (key==='ipv4.dns-search') p.search = list(p.search, vals);
    else if (key==='ipv4.method'){ if (!/^(manual|auto|disabled|link-local|shared)$/.test(v)) return `Error: failed to modify ipv4.method: '${v}' not among [auto, link-local, manual, shared, disabled].`; p.method = v; }
    else if (key==='ipv4.never-default') p.neverDefault = yes(v);
    else if (key==='connection.autoconnect') p.autoconnect = yes(v);
    else if (key==='ipv4.routes'){ const rs = []; for (const part of v.split(/\s*,\s*/)){ const [dst, via] = part.split(/\s+/); if (!parseCidr(dst||'') || (via && !/^\d+\.\d+\.\d+\.\d+$/.test(via))) return `Error: failed to modify ipv4.routes: invalid route '${part}'.`; rs.push({dst:netOf(dst), via:via||null}); } p.routes = mod==='+' ? p.routes.concat(rs.filter(r=>!p.routes.some(z=>z.dst===r.dst))) : mod==='-' ? p.routes.filter(r=>!rs.some(z=>z.dst===r.dst)) : rs; }
    else if (key==='connection.interface-name'){ if (!isAdd) return `Error: 'connection.interface-name' sa v simulátore nemení, vytvor nový profil.`; p.dev = v; }
    else if (key==='connection.id') p.name = v;
    else if (key==='connection.type'){ if (!/^(ethernet|802-3-ethernet)$/.test(v)) return `(simulátor: typ ${v} si vyskúšaj na skutočnom serveri; tu je len ethernet)`; }
    else if (/^(ipv6\.method|ipv4\.ignore-auto-dns|ipv6\.addresses)$/.test(key)) {}
    else return `Error: invalid <setting>.<property> '${key}'.`;
  }
  return null;
};
P._nxActivate = function(p){
  const x = NX(this);
  if (x.linkDown.includes(p.dev)) x.linkDown = x.linkDown.filter(d=>d!==p.dev);
  for (const o of Object.values(x.prof)) if (o.dev===p.dev) o.active = false;
  x.tmpAddrs = x.tmpAddrs.filter(t=>t.dev!==p.dev); x.tmpRoutes = x.tmpRoutes.filter(t=>t.dev!==p.dev);
  if (p.method==='manual' && !p.addrs.length) return `Error: Connection activation failed: ipv4.method: method 'manual' requires at least an address or a route`;
  if (p.method==='auto'){ p.active = true; p.dhcpFail = true; return null; }
  p.live = {addrs:p.addrs.slice(), routes:JSON.parse(JSON.stringify(p.routes)), gw:p.gw, neverDefault:p.neverDefault};
  p.active = true; return null;
};
const origNmcli = P.c_nmcli;
P.c_nmcli = function(a){
  const x = NX(this);
  const args = a.filter((s,i)=>!/^-{1,2}[a-z][a-z-]*$/i.test(s) && !/^-(f|fields|g|get-values|c|colors)$/.test(a[i-1]||''));
  const obj = args[0]||'', act = args[1]||'';
  const isCon = /^c(on(n(e(c(t(i(on?)?)?)?)?)?)?)?$/.test(obj), isDev = /^d(ev(i(ce?)?)?)?$/.test(obj);
  const root = ()=> this.user==='root';
  const resolveP = n => x.prof[n] || Object.values(x.prof).find(p=>p.uuid===n || p.dev===n && n!==this.net.ifc);
  if (isCon && act==='add'){
    if (!root()) return {e:"Error: Failed to add connection: Insufficient privileges\n(tip: sudo nmcli con add …)\n", code:1};
    const p = {name:null, dev:null, method:'auto', addrs:[], gw:null, dns:[], search:[], routes:[], autoconnect:true, neverDefault:false, active:false};
    const err = this._nxSet(p, args.slice(2), true);
    if (err) return {e:err+'\n', code:2};
    if (!p.dev) return {e:"Error: 'ifname': property is missing (napr. ifname ens224).\n", code:2};
    if (!['ens224', this.net.ifc].includes(p.dev)) return {e:`Error: device '${p.dev}' not found (v simulátore je voľná druhá sieťovka ens224).\n`, code:10};
    if (p.dev===this.net.ifc) return {e:'(simulátor: na ens192 už je hlavný profil. Nový profil vytvor na ens224.)\n', code:1};
    p.name = p.name || ('ethernet-'+p.dev);
    if (p.method==='auto' && p.addrs.length) p.method = 'manual';
    if (p.method==='manual' && !p.addrs.length) return {e:"Error: Failed to add '"+p.name+"' connection: ipv4.addresses: this property cannot be empty for 'method=manual'\n", code:2};
    p.uuid = uuid(p.name);
    x.prof[p.name] = p; this._nxWriteFile(p);
    let out = `Connection '${p.name}' (${p.uuid}) successfully added.\n`;
    if (p.autoconnect && !Object.values(x.prof).some(o=>o!==p && o.dev===p.dev && o.active)){ const e = this._nxActivate(p); if (e) out += '(profil sa neaktivoval: '+e+')\n'; }
    if (p.gw && !p.neverDefault) out += '(pozor: profil má bránu, server bude mať dve predvolené trasy. Pre druhú sieťovku sa brána zvyčajne nenastavuje.)\n';
    return out;
  }
  if (isCon && /^(mod|modify)$/.test(act)){
    if (!root()) return {e:`Error: Failed to modify connection '${args[2]}': Insufficient privileges\n`, code:1};
    const name = args[2];
    if (name===this.net.ifc || name==='System '+this.net.ifc){
      const err = this._nxSet('primary', args.slice(3)); if (err) return {e:err+'\n', code:2};
      const k = this._lookup('/etc/NetworkManager/system-connections/ens192.nmconnection'); if (k && this.net.pendingDns) k.c = k.c.replace(/^dns=.*$/m, 'dns='+this.net.pendingDns.replace(/"/g,'').split(/[ ,]+/).join(';')+';');
      return '';
    }
    const p = resolveP(name); if (!p) return {e:`Error: unknown connection '${name}'.\n`, code:10};
    const err = this._nxSet(p, args.slice(3)); if (err) return {e:err+'\n', code:2};
    this._nxWriteFile(p); return '';
  }
  if (isCon && act==='up'){
    const name = args[2];
    if (name===this.net.ifc){ const r = origNmcli.call(this, a); if (root()) this._nxApply192(); return r; }
    if (!root()) return {e:'Error: Connection activation failed: Not authorized to control networking.\n', code:1};
    const p = resolveP(name); if (!p) return {e:`Error: unknown connection '${name}'.\n`, code:10};
    const e = this._nxActivate(p); if (e) return {e:e+'\n', code:4};
    if (p.method==='auto') return {o:`(simulátor: v zálohovej sieti nie je DHCP server)\n`, e:`Error: Connection activation failed: IP configuration could not be reserved (no available address, timeout, etc.).\nHint: use 'journalctl -xe NM_CONNECTION=${p.uuid} + NM_DEVICE=${p.dev}' to get more details.\n`, code:4};
    return `Connection successfully activated (D-Bus active path: /org/freedesktop/NetworkManager/ActiveConnection/${3+Object.keys(x.prof).indexOf(p.name)})\n`;
  }
  if (isCon && act==='down'){
    const name = args[2];
    if (name===this.net.ifc) return {e:'(simulátor: nmcli con down ens192 by ťa odpojilo zo SSH a server by bol nedostupný. Skús to s profilom na ens224.)\n', code:1};
    if (!root()) return {e:'Error: Connection deactivation failed: Not authorized.\n', code:1};
    const p = resolveP(name); if (!p || !p.active) return {e:`Error: '${name}' is not an active connection.\nError: no active connection provided.\n`, code:10};
    p.active = false; return `Connection '${p.name}' successfully deactivated (D-Bus active path: /org/freedesktop/NetworkManager/ActiveConnection/4)\n`;
  }
  if (isCon && /^(del|delete)$/.test(act)){
    if (!root()) return {e:'Error: Insufficient privileges\n', code:1};
    const name = args[2]; if (name===this.net.ifc) return {e:'(simulátor: hlavný profil ens192 nemaž, prišiel by si o sieť.)\n', code:1};
    const p = resolveP(name); if (!p) return {e:`Error: unknown connection '${name}'.\nError: cannot delete unknown connection(s): '${name}'.\n`, code:10};
    delete x.prof[p.name]; const f = '/etc/NetworkManager/system-connections/'+p.name+'.nmconnection'; const dn = this._lookup('/etc/NetworkManager/system-connections'); if (dn && dn.c[p.name+'.nmconnection']) delete dn.c[p.name+'.nmconnection'];
    return `Connection '${p.name}' (${p.uuid}) successfully deleted.\n`;
  }
  if (isCon && act==='reload'){ if (!root()) return {e:'Error: failed to reload connections: Insufficient privileges.\n', code:1}; return ''; }
  if (isCon && (act==='' || act==='show') && !args[2]){
    const activeOnly = a.includes('--active');
    const rows = [[this.net.ifc, '0b6f2c94-3d1a-4e7c-8f25-a9c1d7e4b308', 'ethernet', this.net.ifc]].concat(Object.values(x.prof).map(p=>[p.name, p.uuid, 'ethernet', p.active?p.dev:'--'])).concat([['lo','9a3e1f2c-6b7d-4a8e-b5c1-2d0f9e8a7b63','loopback','lo']]);
    const W = Math.max(6, ...rows.map(r=>r[0].length))+2;
    return pad('NAME',W,true)+'UUID                                  TYPE      DEVICE \n' + rows.filter(r=>!activeOnly || r[3]!=='--').map(r=>pad(r[0],W,true)+pad(r[1],38,true)+pad(r[2],10,true)+r[3]+' ').join('\n')+'\n';
  }
  if (isCon && act==='show' && args[2]){
    const name = args[2];
    if (name===this.net.ifc){ const e = x.e192; const r = origNmcli.call(this, a); const t = typeof r==='string'?r:(r.o||''); return t.replace(/\n*$/,'\n') + `ipv4.dns-search:                        ${(e.search||['firma.local']).join(',')}\nipv4.routes:                            ${e.routes.length? e.routes.map(r=>`{ ip = ${r.dst}, nh = ${r.via} }`).join('; ') : '--'}\n` + (e.addrs.length?`(ďalšie adresy v profile: ${e.addrs.join(', ')})\n`:''); }
    const p = resolveP(name); if (!p) return {e:`Error: ${name} - no such connection profile.\n`, code:10};
    const st = this._nxState();
    return `connection.id:                          ${p.name}\nconnection.uuid:                        ${p.uuid}\nconnection.type:                        802-3-ethernet\nconnection.interface-name:              ${p.dev}\nconnection.autoconnect:                 ${p.autoconnect?'yes':'no'}\nipv4.method:                            ${p.method}\nipv4.dns:                               ${p.dns.join(',')||'--'}\nipv4.dns-search:                        ${p.search.join(',')||'--'}\nipv4.addresses:                         ${p.addrs.join(', ')||'--'}\nipv4.gateway:                           ${p.gw||'--'}\nipv4.routes:                            ${p.routes.length? p.routes.map(r=>`{ ip = ${r.dst}${r.via?', nh = '+r.via:''} }`).join('; ') : '--'}\nipv4.never-default:                     ${p.neverDefault?'yes':'no'}\n` + (p.active ? `GENERAL.STATE:                          activated\n${st.addrs.filter(y=>y.dev===p.dev).map((y,i)=>`IP4.ADDRESS[${i+1}]:                         ${y.cidr}`).join('\n')}\n${st.routes.filter(r=>r.dev===p.dev).map((r,i)=>`IP4.ROUTE[${i+1}]:                           dst = ${r.dst==='default'?'0.0.0.0/0':r.dst}, nh = ${r.via||'0.0.0.0'}, mt = ${r.metric||101}`).join('\n')}\n` : '');
  }
  if (isDev && (act==='' || act==='status')){
    const p2 = this._nxActive('ens224');
    return `DEVICE  TYPE      STATE                   CONNECTION \n${pad(this.net.ifc,8,true)}ethernet  connected               ${this.net.ifc}     \n${pad('ens224',8,true)}ethernet  ${p2 ? 'connected               '+p2.name : x.linkDown.includes('ens224') ? 'unavailable             --' : 'disconnected            --'}     \nlo      loopback  connected (externally)  lo         \n`;
  }
  if (isDev && act==='show' && args[2]==='ens224'){
    const p2 = this._nxActive('ens224'); const st = this._nxState();
    return `GENERAL.DEVICE:                         ens224\nGENERAL.TYPE:                           ethernet\nGENERAL.HWADDR:                         ${MAC2.toUpperCase()}\nGENERAL.MTU:                            ${x.mtu.ens224||1500}\nGENERAL.STATE:                          ${p2?'100 (connected)':'30 (disconnected)'}\nGENERAL.CONNECTION:                     ${p2?p2.name:'--'}\nWIRED-PROPERTIES.CARRIER:               ${x.linkDown.includes('ens224')?'off':'on'}\n${st.addrs.filter(y=>y.dev==='ens224').map((y,i)=>`IP4.ADDRESS[${i+1}]:                         ${y.cidr}`).join('\n')}\n`;
  }
  if (isDev && (act==='connect' || act==='reapply')){
    if (!root()) return {e:'Error: Not authorized.\n', code:1};
    const d = args[2]; if (d===this.net.ifc){ this._nxApply192(); return `Device '${d}' successfully activated with '0b6f2c94-3d1a-4e7c-8f25-a9c1d7e4b308'.\n`; }
    const p = Object.values(x.prof).find(o=>o.dev===d); if (!p) return {e:`Error: Connection activation failed: No suitable connection found.\n(najprv vytvor profil: nmcli con add type ethernet con-name … ifname ${d} …)\n`, code:4};
    const e = this._nxActivate(p); if (e) return {e:e+'\n', code:4};
    return `Device '${d}' successfully activated with '${p.uuid}'.\n`;
  }
  if (isDev && act==='disconnect'){
    if (!root()) return {e:'Error: Not authorized.\n', code:1};
    const d = args[2]; if (d===this.net.ifc) return {e:'(simulátor: odpojenie ens192 by ťa odpojilo zo SSH.)\n', code:1};
    const p = this._nxActive(d); if (p) p.active = false; return `Device '${d}' successfully disconnected.\n`;
  }
  if (/^g(en(e(r(al?)?)?)?)?$/.test(obj) && act==='hostname'){
    if (!args[2]) return this.hostname+'\n';
    if (!root()) return {e:'Error: failed to set hostname: Insufficient privileges\n', code:1};
    this.hostname = args[2]; const n = this._lookup('/etc/hostname'); if (n) n.c = args[2]+'\n'; return '';
  }
  const r = origNmcli.call(this, a);
  if (isCon && act==='up' && root()) this._nxApply192();
  return r;
};

/* ---------- reboot: dočasné zmeny zmiznú, profily sa aktivujú ---------- */
const origReboot = P.c_reboot;
P.c_reboot = function(a){
  const r = origReboot.call(this, a);
  if (this.user!=='root' && r && r.code===1) return r;
  const x = NX(this);
  const lost = x.tmpAddrs.length + x.tmpRoutes.length + x.linkDown.length;
  x.tmpAddrs = []; x.tmpRoutes = []; x.linkDown = []; x.mtu = {};
  x.e192a = JSON.parse(JSON.stringify(x.e192));
  for (const p of Object.values(x.prof)){ p.active = p.autoconnect && !(p.method==='manual' && !p.addrs.length) && p.method!=='auto'; if (p.active) p.live = {addrs:p.addrs.slice(), routes:JSON.parse(JSON.stringify(p.routes)), gw:p.gw, neverDefault:p.neverDefault}; }
  if (lost && r && r.o && r.o.includes('Čo sa pri reštarte stalo:')) r.o = r.o.replace('Čo sa pri reštarte stalo:\n', 'Čo sa pri reštarte stalo:\n  • Sieť: zmeny cez ip (addr add, route add, link set) zmizli, platí len to, čo je v profiloch nmcli.\n').replace(/\n[^\n]*Nič neočakávané[^\n]*/,'');
  return r;
};

/* ---------- mená v zálohovej sieti ---------- */
const EXTRA_DNS = {'backup01-bk.firma.local':'10.0.30.60','nas01.firma.local':'10.0.40.10'};
const origResolve = P._resolve;
P._resolve = function(name){
  const r = origResolve.call(this, name);
  if (r===undefined){ const k = EXTRA_DNS[name] ? name : EXTRA_DNS[name+'.firma.local'] ? name+'.firma.local' : null; if (k) return EXTRA_DNS[k]; }
  return r;
};

/* ---------- ping cez model smerovania ---------- */
const origPing = P.c_ping;
P.c_ping = function(a){
  const o = this.opts(a,['c','i','W','I','s']); const h = o.pos[0];
  if (!h) return origPing.call(this, a);
  const ip = this._resolve(h);
  if (!ip || /^127\./.test(ip)) return origPing.call(this, a);
  const x = NX(this);
  if (x.linkDown.includes(this.net.ifc) && !inNet('10.0.30.0/24', ip) && !inNet('10.0.40.0/24', ip)) return {e:'ping: connect: Network is unreachable\n', code:2};
  const special = inNet('10.0.30.0/24', ip) || inNet('10.0.40.0/24', ip);
  if (!special) return origPing.call(this, a);
  const c = +(o.v.c||4);
  const rt = this._nxRoute(ip);
  if (!rt) return {e:'ping: connect: Network is unreachable\n', code:2};
  const R = this._nxReach(ip);
  let s = `PING ${h} (${ip}) 56(84) bytes of data.\n`;
  if (!R.ok){
    if (R.why==='hostunreach') s += `From ${rt.src} icmp_seq=1 Destination Host Unreachable\nFrom ${rt.src} icmp_seq=2 Destination Host Unreachable\n`;
    s += `\n--- ${h} ping statistics ---\n${c} packets transmitted, 0 received${R.why==='hostunreach'?`, +${c} errors`:''}, 100% packet loss, time ${c*1000-1}ms\n`;
    if (R.why==='timeout') s += `(bez odpovede: paket odišiel cez ${rt.dev}${rt.via?' na bránu '+rt.via:''}, ale tam táto sieť nie je. Pozri ip route get ${ip})\n`;
    return {o:s, code:1};
  }
  if (inNet('10.0.30.0/24', ip)) x.pinged30 = true;
  for (let i=1;i<=Math.min(c,10);i++) s += `64 bytes from ${ip}: icmp_seq=${i} ttl=${R.hops.length>1?63:64} time=${(0.4+i*0.05+(R.hops.length-1)*0.3).toFixed(2)} ms\n`;
  s += `\n--- ${h} ping statistics ---\n${c} packets transmitted, ${c} received, 0% packet loss, time ${c*1000-1}ms\n`;
  return s;
};

/* ---------- tracepath / traceroute / mtr ---------- */
P._nxPath = function(ip){
  const R = this._nxReach(ip);
  if (R.local) return {hops:[ip], ok:true};
  if (R.legacy){ const external = !/^10\./.test(ip); return {ok:true, hops: external ? [this.net.gw, '185.19.12.1', '62.168.99.129', ip] : (this._nxRoute(ip)||{}).via ? [this._nxRoute(ip).via, ip] : [ip]}; }
  return {ok:R.ok, hops:R.hops||[]};
};
P.c_tracepath = function(a){
  const h = a.filter(x=>!x.startsWith('-'))[0]; if (!h) return {e:'Usage\n  tracepath [options] <destination>\n', code:2};
  const ip = this._resolve(h); if (!ip) return {e:`tracepath: ${h}: Name or service not known\n`, code:2};
  if (!this._nxRoute(ip)) return {e:'tracepath: connect: Network is unreachable\n', code:2};
  const p = this._nxPath(ip);
  let s = ` 1?: [LOCALHOST]                      pmtu 1500\n`;
  p.hops.forEach((x,i)=>{ const last = i===p.hops.length-1 && p.ok; s += ` ${i+1}:  ${pad(x,40,true)} ${(0.4+i*0.7).toFixed(3)}ms${last?' reached':''}\n`; });
  if (!p.ok){ for (let i=p.hops.length+1;i<=p.hops.length+3;i++) s += ` ${i}:  no reply\n`; s += '(ďalej už nikto neodpovedá: cieľ je mimo dosahu tejto trasy)\n'; return {o:s, code:1}; }
  s += `     Resume: pmtu 1500 hops ${p.hops.length} back ${p.hops.length}\n`;
  return s;
};
P.c_traceroute = function(a){
  const h = a.filter(x=>!x.startsWith('-'))[0]; const ip = this._resolve(h||''); if (!ip) return {e:`${h}: Name or service not known\nCannot handle "host" cmdline arg \`${h}' on position 1 (argc 1)\n`, code:2};
  const p = this._nxPath(ip);
  let s = `traceroute to ${h} (${ip}), 30 hops max, 60 byte packets\n`;
  p.hops.forEach((x,i)=>{ const t = (0.4+i*0.7); s += ` ${i+1}  ${x} (${x})  ${t.toFixed(3)} ms  ${(t+0.05).toFixed(3)} ms  ${(t+0.09).toFixed(3)} ms\n`; });
  if (!p.ok) for (let i=p.hops.length+1;i<=p.hops.length+3;i++) s += ` ${i}  * * *\n`;
  return {o:s, code: p.ok?0:1};
};
P.c_mtr = function(a){ const r = this.c_traceroute(a.filter(x=>!x.startsWith('-'))); return {o:(r.o||'')+'(mtr je interaktívny: ukazuje traceroute a straty paketov naživo. Skús mtr -r -c 10 HOST pre report.)\n', e:r.e, code:r.code}; };

/* ---------- nc: je port dostupný? ---------- */
P.c_nc = function(a){
  const z = a.some(x=>/^-[a-zA-Z]*z/.test(x)); const words = a.filter((x,i)=>!x.startsWith('-') && !(/^-w$/.test(a[i-1]||'')));
  const [h, port] = words; if (!h || !port) return {e:'Ncat: You must specify a host to connect to. QUITTING.\n(príklad: nc -zv db01.firma.local 3306)\n', code:2};
  const ip = this._resolve(h); const head = 'Ncat: Version 7.92 ( https://nmap.org/ncat )\n';
  if (!ip) return {e:head+`Ncat: Could not resolve hostname "${h}": Name or service not known. QUITTING.\n`, code:2};
  let open;
  if (/^127\./.test(ip) || ip===this.net.ip.split('/')[0]) open = this._sockets().some(s=>s.p==='tcp' && s.st==='LISTEN' && s.port===+port);
  else {
    const R = this._nxReach(ip);
    if (!R.ok || (R.legacy && /^10\.0\.20\./.test(ip) && !PORTS[ip])) return {e:head+'Ncat: TIMEOUT.\n(žiadna odpoveď: cieľ je nedostupný alebo paket zahadzuje firewall)\n', code:1};
    open = (PORTS[ip]||[]).includes(+port);
  }
  if (!open) return {e:head+'Ncat: Connection refused.\n(server odpovedal, ale na tomto porte nič nepočúva alebo ho firewall odmieta)\n', code:1};
  return {o:head+`Ncat: Connected to ${ip}:${port}.\nNcat: 0 bytes sent, 0 bytes received in 0.02 seconds.\n`, code:0};
};
P.c_ncat = P.c_nc;

/* ---------- tcpdump ---------- */
P.c_tcpdump = function(a){
  if (this.user!=='root') return {e:'tcpdump: ens192: You don\'t have permission to perform this capture on that device\n(socket: Operation not permitted)\n', code:1};
  const o = this.opts(a,['i','c','w','s']);
  const ifc = o.v.i || this.net.ifc; const n = a.some(x=>/^-[a-zA-Z]*n/.test(x));
  if (!['any','lo',this.net.ifc,'ens224'].includes(ifc)) return {e:`tcpdump: ${ifc}: No such device exists\n(No such device exists)\n`, code:1};
  const expr = o.pos.join(' ');
  const cnt = +(o.v.c||6);
  const t = i => `12:00:0${Math.min(9,i)}.${String(100000+i*137).slice(1)}`;
  const me = this.net.ip.split('/')[0], cli = '10.0.20.15';
  const host = x => n ? x : (x===me ? this.hostname : x===cli ? 'admin-pc.firma.local' : x);
  const sp = (p, name) => n ? p : name;
  let lines = [];
  const pm = expr.match(/port\s+(\d+)/); const port = pm ? +pm[1] : null;
  if (/icmp/.test(expr)) for (let i=0;i<cnt;i++) lines.push(i%2===0 ? `IP ${host(cli)} > ${host(me)}: ICMP echo request, id 7, seq ${i/2+1}, length 64` : `IP ${host(me)} > ${host(cli)}: ICMP echo reply, id 7, seq ${(i+1)/2}, length 64`);
  else if (port && port!==22){
    const svc = this._sockets().some(s=>s.p==='tcp' && s.st==='LISTEN' && s.port===port);
    const fwOpen = (()=>{ const z = this.fw.runtime[this.fw.def]||{services:[],ports:[]}; const map = {80:'http',443:'https',3306:'mysql',9090:'cockpit'}; return z.ports.includes(port+'/tcp') || (map[port] && z.services.includes(map[port])); })();
    for (let i=0;i<Math.min(cnt,6);i+=2){
      lines.push(`IP ${host(cli)}.${53200+i} > ${host(me)}.${sp(port, {80:'http',443:'https'}[port]||port)}: Flags [S], seq 1938${i}2, win 64240, options [mss 1460], length 0`);
      if (!fwOpen) lines.push(`IP ${host(me)} > ${host(cli)}: ICMP host ${me} unreachable - admin prohibited filter, length 68`);
      else if (!svc) lines.push(`IP ${host(me)}.${sp(port, port)} > ${host(cli)}.${53200+i}: Flags [R.], seq 0, ack 1, win 0, length 0`);
      else lines.push(`IP ${host(me)}.${sp(port, {80:'http',443:'https'}[port]||port)} > ${host(cli)}.${53200+i}: Flags [S.], seq 4021${i}9, ack 1, win 65160, options [mss 1460], length 0`);
    }
  } else {
    for (let i=0;i<cnt;i++) lines.push(i%2===0 ? `IP ${host(me)}.${sp(22,'ssh')} > ${host(cli)}.53122: Flags [P.], seq ${i*52}:${i*52+52}, ack 1, win 501, length 52` : `IP ${host(cli)}.53122 > ${host(me)}.${sp(22,'ssh')}: Flags [.], ack ${i*52}, win 2048, length 0`);
  }
  lines = lines.slice(0, cnt);
  let s = `dropped privs to tcpdump\ntcpdump: verbose output suppressed, use -v[v]... for full protocol decode\nlistening on ${ifc}, link-type EN10MB (Ethernet), snapshot length 262144 bytes\n` + lines.map((l,i)=>t(i)+' '+l).join('\n') + `\n${lines.length} packets captured\n${lines.length+2} packets received by filter\n0 packets dropped by kernel\n`;
  if (!o.v.c) s += '(bez -c beží tcpdump, kým nestlačíš Ctrl+C. V simulátore som zachytil pár paketov.)\n';
  if (port && port!==22 && /admin prohibited/.test(s)) s += '(pakety prichádzajú, ale server ich odmieta: blokuje firewall)\n';
  return s;
};

/* ---------- ethtool ---------- */
P.c_ethtool = function(a){
  const d = a.filter(x=>!x.startsWith('-'))[0]; const x = NX(this);
  if (![this.net.ifc,'ens224','lo'].includes(d)) return {e:`netlink error: no device matches name (offset 24)\nnetlink error: No such device\n`, code:1};
  if (a.includes('-i')) return `driver: vmxnet3\nversion: 1.7.0.0-k-NAPI\nfirmware-version: \nbus-info: 0000:${d==='ens224'?'13':'0b'}:00.0\n`;
  if (a.includes('-S')) return `NIC statistics:\n     Tx Queue#: 0\n       TSO pkts tx: 1023\n       ucast pkts tx: 822104\n     Rx Queue#: 0\n       ucast pkts rx: 1204411\n       drv dropped rx total: 12\n`;
  const link = !x.linkDown.includes(d);
  return `Settings for ${d}:\n\tSupported ports: [ TP ]\n\tSupported link modes:   1000baseT/Full\n\t                        10000baseT/Full\n\tSpeed: ${link?'10000Mb/s':'Unknown!'}\n\tDuplex: ${link?'Full':'Unknown! (255)'}\n\tAuto-negotiation: off\n\tPort: Twisted Pair\n${this.user==='root'?'\tWake-on: d\n':'netlink error: Operation not permitted\n'}\tLink detected: ${link?'yes':'no'}\n`;
};
P.c_arping = function(a){ if (this.user!=='root') return {e:'arping: socket: Operation not permitted\n', code:2}; const o = this.opts(a,['I','c']); const h = o.pos[0]; return `ARPING ${h} from ${this.net.ip.split('/')[0]} ${o.v.I||this.net.ifc}\nUnicast reply from ${h} [00:50:56:A1:00:01]  0.712ms\nSent 1 probes (1 broadcast(s))\nReceived 1 response(s)\n`; };
})();
