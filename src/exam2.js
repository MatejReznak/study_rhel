/* =========================================================
   NÁHODNÁ SKÚŠKA: pri každom spustení iné zadanie
   EXAM_POOL: kategórie → generátor požiadavky (t, check, sol)
   ========================================================= */
(function(){
const rng = seed => { let a = seed>>>0; return ()=>{ a = (a + 0x6D2B79F5)>>>0; let t = a; t = Math.imul(t ^ t>>>15, t | 1); t ^= t + Math.imul(t ^ t>>>7, t | 61); return ((t ^ t>>>14)>>>0) / 4294967296; }; };
const mk = R => ({ pick: arr => arr[Math.floor(R()*arr.length)], int:(a,b)=>a+Math.floor(R()*(b-a+1)) });
const sshdHas = (m, re)=>{ const dn = m.node('/etc/ssh/sshd_config.d'); return !!dn && Object.keys(dn.c).some(f=>f.endsWith('.conf') && re.test(m.read('/etc/ssh/sshd_config.d/'+f)||'')); };
const fwHas = (m, kind, val)=>['runtime','perm'].every(z=>m.fw[z].public[kind].includes(val));

const POOL = [
 {cat:'host', gen:r=>{ const h = r.pick(['app01','db02','mon03','web07','backup02','log04'])+'.firma.local';
   return {t:`Meno servera je natrvalo <code>${h}</code>.`, check:m=>m.hostname===h && (m.read('/etc/hostname')||'').trim()===h, sol:[`sudo hostnamectl set-hostname ${h}`]}; }},
 {cat:'user', gen:r=>{ const v = r.int(0,2);
   const [u, full] = r.pick([['marek','Marek Novak'],['lucia','Lucia Hrubá'],['tomas','Tomas Kral'],['eva','Eva Mala'],['roman','Roman Biely'],['zuzana','Zuzana Vysoka']]);
   if (v===0) return {t:`Používateľ <code>${u}</code> s komentárom <code>${full}</code>, s nastaveným heslom, ktorý smie používať sudo (skupina <code>wheel</code>).`, check:m=>!!m.users[u] && (m.users[u].gecos||'').includes(full) && m.users[u].pw && m.groups.wheel.mem.includes(u), sol:[`sudo useradd -c "${full}" -G wheel ${u}`,`sudo passwd ${u}`]};
   if (v===1){ const uid = r.pick([1500,2001,3010]); const svc = 'svc-'+r.pick(['backup','report','monitor']); return {t:`Servisný účet <code>${svc}</code> s UID <code>${uid}</code>, ktorý sa nemôže interaktívne prihlásiť (shell <code>/sbin/nologin</code>).`, check:m=>!!m.users[svc] && m.users[svc].uid===uid && /nologin/.test(m.users[svc].shell||''), sol:[`sudo useradd -u ${uid} -s /sbin/nologin ${svc}`]}; }
   const d = r.pick([60,90,180]); return {t:`Používateľ <code>${u}</code> s nastaveným heslom, ktoré musí meniť najneskôr každých <code>${d}</code> dní.`, check:m=>!!m.users[u] && m.users[u].pw && m.users[u].maxdays===d, sol:[`sudo useradd ${u}`,`sudo passwd ${u}`,`sudo chage -M ${d} ${u}`]}; }},
 {cat:'dir', gen:r=>{ const g = r.pick(['web','dev','ops','data','tim']); const mode = r.pick(['2770','2775']); const d = '/srv/'+g;
   return {t:`Skupina <code>${g}</code> a adresár <code>${d}</code> s vlastníkom root, skupinou ${g} a právami <code>${mode}</code> (nové súbory dedia skupinu).`, check:m=>{ const n=m.node(d); return !!m.groups[g] && !!n && n.t==='d' && n.u==='root' && n.g===g && (n.m&0o7777)===parseInt(mode,8); }, sol:[`sudo groupadd ${g}`,`sudo mkdir ${d}`,`sudo chown root:${g} ${d}`,`sudo chmod ${mode} ${d}`]}; }},
 {cat:'svc', gen:r=>{ const [p, s] = r.pick([['httpd','httpd'],['nginx','nginx'],['mariadb-server','mariadb']]);
   return {t:`Balík <code>${p}</code> je nainštalovaný a služba <code>${s}</code> beží a spúšťa sa pri štarte.`, check:m=>m.pkgs.has(p) && m.svc[s] && m.svc[s].active && m.svc[s].enabled, sol:[`sudo dnf install -y ${p}`,`sudo systemctl enable --now ${s}`]}; }},
 {cat:'fw', gen:r=>{ const v = r.int(0,2);
   if (v===0){ const sv = r.pick([['http','https'],['https'],['http','mysql']]); return {t:`Firewall natrvalo povoľuje ${sv.map(x=>'<code>'+x+'</code>').join(' a ')} (aj hneď, aj po reštarte).`, check:m=>sv.every(x=>fwHas(m,'services',x)), sol:[...sv.map(x=>`sudo firewall-cmd --permanent --add-service=${x}`),'sudo firewall-cmd --reload']}; }
   if (v===1){ const p = r.pick(['8080/tcp','8443/tcp','9100/tcp','5432/tcp','3000/tcp']); return {t:`Firewall natrvalo otvára port <code>${p}</code>.`, check:m=>fwHas(m,'ports',p), sol:[`sudo firewall-cmd --permanent --add-port=${p}`,'sudo firewall-cmd --reload']}; }
   return {t:`Služba <code>cockpit</code> nie je povolená vo firewalle (natrvalo), <code>ssh</code> áno.`, check:m=>['runtime','perm'].every(z=>!m.fw[z].public.services.includes('cockpit') && m.fw[z].public.services.includes('ssh')), sol:['sudo firewall-cmd --permanent --remove-service=cockpit','sudo firewall-cmd --reload']}; }},
 {cat:'seport', gen:r=>{ const p = r.pick([8090, 8888, 9080, 8181]);
   return {t:`SELinux dovoľuje webovému serveru počúvať na porte <code>${p}/tcp</code> (typ <code>http_port_t</code>).`, check:m=>m._sePortAllowed('http_port_t', p), sol:['sudo dnf install -y policycoreutils-python-utils',`sudo semanage port -a -t http_port_t -p tcp ${p}`]}; }},
 {cat:'sebool', gen:r=>{ const b = r.pick(['httpd_can_network_connect','httpd_can_network_connect_db','httpd_enable_homedirs']);
   return {t:`SELinux boolean <code>${b}</code> je zapnutý natrvalo.`, check:m=>!!m.se.bools[b] && !!(m.se.boolPerm||{})[b], sol:[`sudo setsebool -P ${b} on`]}; }},
 {cat:'fctx', gen:r=>{ const d = r.pick(['/srv/www','/web/html','/data/site']);
   return {t:`Adresár <code>${d}</code> existuje a jeho obsah má natrvalo (aj po relabel) SELinux typ <code>httpd_sys_content_t</code>.`, check:m=>{ const n = m.node(d); const rule = (m.se.fctx||[]).some(([re,t])=>t==='httpd_sys_content_t' && new RegExp('^'+re+'$').test(d)); return !!n && n.ctx==='httpd_sys_content_t' && rule; }, sol:['sudo dnf install -y policycoreutils-python-utils',`sudo mkdir -p ${d}`,`sudo semanage fcontext -a -t httpd_sys_content_t "${d}(/.*)?"`,`sudo restorecon -Rv ${d}`]}; }},
 {cat:'lvm', gen:r=>{ const vg = r.pick(['vgdata','vgapp','vgdb']); const lv = r.pick(['data','app','logs']); const sz = r.int(2,5); const fs = r.pick(['xfs','xfs','ext4']); const dir = r.pick(['/data','/app','/srv/logs']);
   return {t:`Na disku <code>/dev/sdb</code> je VG <code>${vg}</code> a v nej LV <code>${lv}</code> s veľkosťou ${sz}G a súborovým systémom ${fs.toUpperCase()}, pripojený natrvalo v <code>${dir}</code>.`, check:m=>{ const l = m.lvm.lvs[vg+'/'+lv]; return !!l && Math.abs(l.size-sz)<0.05 && l.fs===fs && m.mounts.some(x=>x.dir===dir); }, sol:['sudo pvcreate /dev/sdb',`sudo vgcreate ${vg} /dev/sdb`,`sudo lvcreate -n ${lv} -L ${sz}G ${vg}`,`sudo mkfs.${fs} /dev/${vg}/${lv}`,`sudo mkdir -p ${dir}`,`echo "/dev/${vg}/${lv} ${dir} ${fs} defaults 0 0" | sudo tee -a /etc/fstab`,'sudo mount -a']}; }},
 {cat:'sysctl', gen:r=>{ const [k, v] = r.pick([['vm.swappiness','10'],['vm.swappiness','20'],['net.ipv4.ip_forward','1'],['kernel.pid_max','131072']]);
   return {t:`Parameter jadra <code>${k}</code> má natrvalo hodnotu ${v}.`, check:m=>m.sysctl[k]===v, sol:[`echo "${k} = ${v}" | sudo tee /etc/sysctl.d/90-skuska.conf`,'sudo sysctl --system']}; }},
 {cat:'tuned', gen:r=>{ const p = r.pick(['throughput-performance','latency-performance','balanced','network-latency']);
   return {t:`Aktívny tuned profil je <code>${p}</code>.`, check:m=>m.tuned===p, sol:[`sudo tuned-adm profile ${p}`]}; }},
 {cat:'cron', gen:r=>{ const nm = r.pick(['zaloha','cistenie','report','kontrola']); const [cr, txt] = r.pick([['30 2 * * *','každý deň o 2:30'],['0 3 * * 0','každú nedeľu o 3:00'],['*/15 * * * *','každých 15 minút'],['0 1 * * 1-5','v pracovné dni o 1:00']]); const p = `/usr/local/bin/${nm}.sh`;
   const re = new RegExp('^\\s*'+cr.replace(/\*/g,'\\*').replace(/\s+/g,'\\s+')+'\\s+'+p.replace(/\./g,'\\.')+'\\b','m');
   return {t:`Root má v crone úlohu, ktorá ${txt} spúšťa <code>${p}</code>. Skript existuje a je spustiteľný.`, check:m=>{ const n = m.node(p); return re.test((m.crontabs||{}).root||'') && !!n && !!(n.m & 0o100); }, sol:[`echo '#!/bin/bash' | sudo tee ${p}`,`sudo chmod 755 ${p}`,`echo "${cr} ${p}" | sudo crontab -`]}; }},
 {cat:'ssh', gen:r=>{ const [d, v, re] = r.pick([['PermitRootLogin','no',/^\s*PermitRootLogin\s+no\b/m],['MaxAuthTries','3',/^\s*MaxAuthTries\s+3\b/m],['ClientAliveInterval','300',/^\s*ClientAliveInterval\s+300\b/m]]);
   return {t:`sshd má nastavené <code>${d} ${v}</code> v súbore v <code>/etc/ssh/sshd_config.d/</code> a beží.`, check:m=>sshdHas(m, re) && m.svc.sshd.active, sol:[`echo "${d} ${v}" | sudo tee /etc/ssh/sshd_config.d/00-skuska.conf`,'sudo sshd -t','sudo systemctl reload sshd']}; }},
 {cat:'chrony', gen:r=>{ const sv = r.pick(['10.0.20.2','ntp.firma.local']);
   return {t:`Čas sa synchronizuje s firemným NTP serverom <code>${sv}</code> (riadok <code>server ${sv} iburst</code> v chrony) a chronyd sa spúšťa pri štarte.`, check:m=>new RegExp('^\\s*server\\s+'+sv.replace(/\./g,'\\.')+'\\b','m').test(m.read('/etc/chrony.conf')||'') && m.svc.chronyd.active && m.svc.chronyd.enabled, sol:[`echo "server ${sv} iburst" | sudo tee -a /etc/chrony.conf`,'sudo systemctl restart chronyd','sudo systemctl enable chronyd']}; }},
 {cat:'journal', gen:r=>({t:'Systémový žurnál sa ukladá trvalo (prežije reštart).', check:m=>m.isDir('/var/log/journal') || /^\s*Storage\s*=\s*persistent/m.test(m.read('/etc/systemd/journald.conf')||''), sol:['sudo mkdir -p /var/log/journal','sudo systemctl restart systemd-journald']})},
 {cat:'sudo', gen:r=>{ const g = r.pick(['admins','ops','spravcovia']);
   return {t:`Skupina <code>${g}</code> existuje a jej členovia smú cez sudo spúšťať všetko (súbor v <code>/etc/sudoers.d/</code>).`, check:m=>{ const dn = m.node('/etc/sudoers.d'); return !!m.groups[g] && !!dn && Object.keys(dn.c).some(f=>new RegExp('^\\s*%'+g+'\\s+ALL\\s*=\\s*\\(ALL(:ALL)?\\)\\s+ALL','m').test(m.read('/etc/sudoers.d/'+f)||'')); }, sol:[`sudo groupadd ${g}`,`echo "%${g} ALL=(ALL) ALL" | sudo tee /etc/sudoers.d/${g}`,'sudo visudo -c']}; }}
];

window.EXAM_POOL = POOL;
window.makeExam = function(seed, n){
  const R = rng(seed); const r = mk(R);
  const cats = POOL.slice(); for (let i=cats.length-1;i>0;i--){ const j = Math.floor(R()*(i+1)); [cats[i],cats[j]] = [cats[j],cats[i]]; }
  return cats.slice(0, n||10).map(p=>Object.assign({cat:p.cat}, p.gen(r)));
};
})();
