/* =========================================================
   INCIDENTY – druhá sada (10 typických problémov z praxe)
   sol: ukážkové riešenie (pole príkazov alebo funkcia m=>pole)
   motd: text na konzole na začiatku, root: začína sa ako root
   ========================================================= */
(function(){
const {PKG_DB} = window.MachineData;
const asRoot = (m, cmds)=>{ const prev = m.user; m.user='root'; try { for (const c of cmds) m.run(' '+c); } finally { m.user = prev; } };
const file = (m, p, c, mode, u, g, ctx)=>{ const parts = p.split('/').filter(Boolean); let cur=''; for (let i=0;i<parts.length-1;i++){ cur += '/'+parts[i]; if (!m.exists(cur)){ const x=m._mkPath(cur,'d',0o755,'root','root'); x.ctx=m.defaultCtx(cur); } } const n = m._mkPath(p,'f',mode||0o644,u||'root',g||u||'root',c); n.ctx = ctx || m.defaultCtx(p); n.mt = new Date(Date.now()-3600e3*5); return n; };
const append = (m, p, txt)=>{ const n = m._lookup(p); if (n) n.c = (n.c||'') + txt; };
const DAY = 86400e3;
PKG_DB['mod_ssl'] = PKG_DB['mod_ssl'] || {v:'2.4.62-4', s:'SSL/TLS module for the Apache HTTP Server', repo:'appstream', cmds:[]};
PKG_DB['acme-webplugin'] = PKG_DB['acme-webplugin'] || {v:'2.0-1', s:'ACME web plugin for Apache httpd', repo:'acme', cmds:[]};

const certFor = (m, kid, nb, na)=> m._mkCertPem({cn:'intranet.firma.local', o:'Firma s.r.o.', iss:'Firma Issuing CA', nb, na, kid, san:['intranet.firma.local','web01.firma.local','localhost']});

window.INCIDENTS.push(
/* ---------- 1. plný /var ---------- */
{id:'varfull', lvl:'stredný', title:'Plný /var, aktualizácia padá', area:'df, du, journalctl',
 ticket:'Od: monitoring + nočné patchovanie\nPredmet: web02 /var 97 %, dnf update zlyhal\n\nNočné patchovanie na web02 skončilo chybou: dnf hlási, že na /var chýba miesto. Monitoring ukazuje /var na 97 %. Uvoľni miesto bezpečne (nič dôležité nemaž) a zariaď, aby sa to nezopakovalo.',
 setup:m=>{
   const s = m.scn = {varfull:true, jid:'8f3a1c2e9b7d4e6f9a0b1c2d3e4f5a6b'};
   m.lvm.lvs['rhel/var'] = {size:10, fs:'xfs'}; m.fsInfo['/dev/mapper/rhel-var'] = {fs:'xfs', uuid:'3c9d2f1e-7a44-4b0e-9d1f-5e2a8c7b6d10'};
   append(m,'/etc/fstab','/dev/mapper/rhel-var   /var                    xfs     defaults        0 0\n');
   m.mounts.push({dev:'/dev/mapper/rhel-var', dir:'/var', fs:'xfs', size:10, used:1.1});
   const d = '/var/log/journal/'+s.jid;
   const J = [['system@7f3e1d2c0a8b4c5d9e6f-0000000000000001-0005f8a1b2c3d4e5.journal',1.9],['system@7f3e1d2c0a8b4c5d9e6f-00000000004a7c11-0005f9c2d3e4f5a6.journal',1.9],['system@7f3e1d2c0a8b4c5d9e6f-000000000093b2a0-0005fb01e2f3a4b5.journal',1.8],['system@7f3e1d2c0a8b4c5d9e6f-0000000000d1e4f3-0005fc77a1b2c3d4.journal',1.7],['system.journal',0.9],['user-1000.journal',0.3]];
   m.hogs = m.hogs || [];
   for (const [f, gb] of J){ const n = file(m, d+'/'+f, '(binárny žurnál)', 0o640, 'root', 'systemd-journal', 'var_log_t'); n.big = gb*1073741824; n.hog = gb; m.hogs.push({path:d+'/'+f, gb, svc:null, t0:new Date()}); }
   file(m,'/etc/systemd/journald.conf','#  Tento súbor je súčasťou systemd.\n#  Predvolené hodnoty sú v komentároch.\n\n[Journal]\n#Storage=auto\n#Compress=yes\n#SystemMaxUse=\n#SystemKeepFree=\n#SystemMaxFileSize=\n#MaxRetentionSec=\n#ForwardToSyslog=no\n',0o644);
 },
 check:m=>{ const v = m.mounts.find(x=>x.dir==='/var'); if (!v) return false; const pct = (v.used + m._hogGB('/var'))/v.size; return pct < 0.8 && /^\s*SystemMaxUse\s*=\s*\d+(\.\d+)?\s*[KMG]?\s*$/mi.test(m.read('/etc/systemd/journald.conf')||''); },
 hints:['Najprv zisti, ktorý súborový systém je plný (df -h) a čo v ňom zaberá miesto: sudo du -xsh /var/* | sort -h a potom hlbšie, napr. sudo du -sh /var/log/*.','Najväčší je /var/log/journal. Žurnál sa nemaže ručne cez rm. Koľko zaberá, ukáže sudo journalctl --disk-usage.','sudo journalctl --vacuum-size=500M uvoľní archívne súbory. Aby to bolo natrvalo, v /etc/systemd/journald.conf nastav SystemMaxUse=500M a sudo systemctl restart systemd-journald.'],
 sol:['df -h','sudo du -xsh /var/* | sort -h','sudo journalctl --disk-usage','sudo journalctl --vacuum-size=500M','sudo sed -i "s/^#SystemMaxUse=/SystemMaxUse=500M/" /etc/systemd/journald.conf','sudo systemctl restart systemd-journald','df -h /var'],
 why:'<b>Príčina:</b> trvalý žurnál v <code>/var/log/journal</code> nemal limit a narástol na 8,5 GB na 10 GB oddiele <code>/var</code>. dnf potrebuje miesto v <code>/var/cache/dnf</code>, preto aktualizácia padla.<br><b>Správne riešenie:</b> <code>journalctl --vacuum-size=500M</code> (alebo <code>--vacuum-time=14d</code>) zmaže staré archívne súbory bezpečne. Trvalo: <code>SystemMaxUse=</code> v <code>/etc/systemd/journald.conf</code> a reštart <code>systemd-journald</code>.<br><b>Ponaučenie:</b> pri plnom disku vždy postupuj <code>df -h</code> → <code>du -xsh /cesta/* | sort -h</code> → do hĺbky. Logy nemaž naslepo, použi nástroj, ktorý ich spravuje (journalctl, logrotate).'},

/* ---------- 2. zlý čas ---------- */
{id:'cas', lvl:'ľahký', title:'Server má zlý čas', area:'chrony, timedatectl',
 ticket:'Od: tím AD\nPredmet: web02 – „Clock skew too great“\n\nPrihlasovanie cez doménu na web02 padá s chybou „Clock skew too great“ a časy v logoch nesedia s ostatnými servermi (rozdiel približne 2 hodiny). Firemný NTP server je 10.0.20.2 (ntp.firma.local). Oprav čas tak, aby sa držal aj po reštarte.',
 setup:m=>{
   m.scn = {clock:true, clockOff:-7954};
   file(m,'/etc/chrony.conf','# Use public servers from the pool.ntp.org project.\n# Please consider joining the pool (https://www.pool.ntp.org/join.html).\n#pool 2.rhel.pool.ntp.org iburst\n\n# Firemný NTP (zmena 2024-03, P. Novák)\nserver ntp.stara-firma.local iburst\n\n# Use NTP servers from DHCP.\nsourcedir /run/chrony-dhcp\n\n# Record the rate at which the system clock gains/losses time.\ndriftfile /var/lib/chrony/drift\n\n# Allow the system clock to be stepped in the first three updates\n# if its offset is larger than 1 second.\nmakestep 1.0 3\n\n# Enable kernel synchronization of the real-time clock (RTC).\nrtcsync\n\n# Specify directory for log files.\nlogdir /var/log/chrony\n',0o644);
   m.svc.chronyd.active = false; m.svc.chronyd.enabled = false;
 },
 check:m=>m.svc.chronyd.active && m.svc.chronyd.enabled && !m._chronyBadSource() && !m.scn.clockOff,
 hints:['Porovnaj čas: date a timedatectl. Čo hovorí „System clock synchronized“ a „NTP service“?','Čas na RHEL drží služba chronyd. Beží? systemctl status chronyd. Aký server má v /etc/chrony.conf a dá sa preložiť (journalctl -u chronyd)?','V /etc/chrony.conf nastav server 10.0.20.2 iburst (starý zakomentuj), potom sudo systemctl enable --now chronyd a over chronyc sources a timedatectl. Ak čas stále nesedí: sudo chronyc makestep.'],
 sol:['date','timedatectl','systemctl status chronyd','sudo sed -i "s/^server ntp.stara-firma.local iburst/server 10.0.20.2 iburst/" /etc/chrony.conf','sudo systemctl enable --now chronyd','chronyc sources','timedatectl'],
 why:'<b>Príčina:</b> v <code>/etc/chrony.conf</code> ostal zrušený NTP server <code>ntp.stara-firma.local</code> a niekto služba chronyd vypol. Hodiny sa bez synchronizácie rozišli o vyše 2 hodiny. Kerberos (AD) toleruje rozdiel len 5 minút, preto prihlasovanie padalo.<br><b>Riešenie:</b> správny <code>server 10.0.20.2 iburst</code>, <code>systemctl enable --now chronyd</code>. Vďaka <code>makestep 1.0 3</code> chrony pri štarte posunie hodiny skokom, inak <code>chronyc makestep</code>.<br><b>Ponaučenie:</b> zlý čas spôsobuje zvláštne chyby (Kerberos, TLS certifikáty „ešte neplatné“, zlé poradie v logoch). Prvé príkazy: <code>timedatectl</code> a <code>chronyc sources</code> (hviezdička * = používaný zdroj).'},

/* ---------- 3. nefunkčný repozitár ---------- */
{id:'repo', lvl:'ľahký', title:'dnf nefunguje', area:'dnf, repozitáre',
 ticket:'Od: Marek (vývoj)\nPredmet: web02 – dnf nefunguje\n\nPotrebujem na web02 nástroj tree, ale dnf install vždy skončí chybou o nejakom repozitári. Mimochodom, starý interný repozitár repo.firma.local sme minulý mesiac vypli (všetko ide cez Red Hat). Prosím oprav dnf natrvalo a nainštaluj tree.',
 setup:m=>{ m.scn = {repo:true}; file(m,'/etc/yum.repos.d/firma-tools.repo','[firma-tools]\nname=Firemné nástroje (staré)\nbaseurl=http://repo.firma.local/rhel9/tools/\nenabled=1\ngpgcheck=0\n',0o644,'root','root','system_conf_t'); },
 check:m=>!m._badRepo([]) && m.pkgs.has('tree'),
 hints:['Prečítaj chybu dnf celú. Ktorý repozitár zlyháva a prečo (Could not resolve host)? dnf repolist ukáže všetky povolené repozitáre.','Repozitáre sú v /etc/yum.repos.d/*.repo. Server repo.firma.local už neexistuje, takže tento repozitár treba vypnúť.','sudo dnf config-manager --set-disabled firma-tools (alebo v súbore enabled=0), potom sudo dnf install -y tree. --disablerepo=firma-tools pomôže len pre jeden príkaz.'],
 sol:['sudo dnf install -y tree','dnf repolist','cat /etc/yum.repos.d/firma-tools.repo','sudo dnf config-manager --set-disabled firma-tools','sudo dnf install -y tree'],
 why:'<b>Príčina:</b> v <code>/etc/yum.repos.d/</code> ostal povolený repozitár na zrušený server. dnf pri každej inštalácii sťahuje metadáta zo <b>všetkých</b> povolených repozitárov a keď jeden nejde, skončí chybou.<br><b>Riešenie:</b> <code>dnf config-manager --set-disabled firma-tools</code> (súbor ostane, len <code>enabled=0</code>). Súbor nemaž, kým nevieš, či ho nespravuje Ansible alebo Satellite.<br><b>Ponaučenie:</b> chyba „Failed to download metadata for repo X“ = problém repozitára X, nie balíka. <code>--disablerepo=X</code> je len dočasné obídenie.'},

/* ---------- 4. OOM ---------- */
{id:'oom', lvl:'stredný', title:'Aplikácia padá, „málo pamäte“', area:'OOM killer, systemd, Java',
 ticket:'Od: monitoring\nPredmet: web02 – reporting DOWN\n\nSlužba reporting (Java) od piatku padá a nedá sa spustiť. Kolega v piatok reporting „zrýchľoval“ a pridal Jave pamäť. Server má 4 GB RAM. Nech reporting beží stabilne, aj po reštarte.',
 setup:m=>{
   m.scn = {oom:true, dmesg:[]};
   file(m,'/opt/reporting/bin/start.sh','#!/bin/bash\nexec /usr/bin/java $JAVA_OPTS -jar /opt/reporting/reporting.jar\n',0o755);
   file(m,'/opt/reporting/reporting.jar','(jar)',0o644);
   file(m,'/etc/systemd/system/reporting.service','[Unit]\nDescription=Reporting server (Java)\nAfter=network-online.target\n\n[Service]\nUser=root\nEnvironmentFile=/etc/sysconfig/reporting\nExecStart=/opt/reporting/bin/start.sh\nRestart=on-failure\nRestartSec=10\n\n[Install]\nWantedBy=multi-user.target\n');
   file(m,'/etc/sysconfig/reporting','# Nastavenia JVM pre reporting\n# 30.10. zvýšené kvôli výkonu (P. N.)\nJAVA_OPTS="-Xms6g -Xmx6g"\nREPORT_PORT=8085\n');
   m._dynRegister('reporting'); m.svc.reporting.enabled = true; m.lastReload = Date.now()+1;
   asRoot(m,['systemctl start reporting']);
 },
 check:m=>{ const t = m.read('/etc/sysconfig/reporting')||''; const x = (t.match(/^\s*JAVA_OPTS="?[^\n"]*-Xmx(\d+)([mMgG])/m)||[]); const mb = x[1] ? (+x[1])*(/g/i.test(x[2])?1024:1) : 0; return !!m.svc.reporting && m.svc.reporting.active && m.svc.reporting.enabled && mb>0 && mb<=2560; },
 hints:['systemctl status reporting: aký je „Result“? Potom sudo dmesg | tail alebo journalctl -k: koho zabil OOM killer a koľko pamäte mal?','free -h: koľko RAM má server? Kde má služba nastavenú pamäť Javy? systemctl cat reporting → EnvironmentFile.','V /etc/sysconfig/reporting nastav napr. JAVA_OPTS="-Xms1g -Xmx2g" (Java + OS sa musia zmestiť do RAM) a sudo systemctl restart reporting.'],
 sol:['systemctl status reporting','sudo dmesg | tail -3','free -h','systemctl cat reporting','sudo sed -i "s/-Xms6g -Xmx6g/-Xms1g -Xmx2g/" /etc/sysconfig/reporting','sudo systemctl restart reporting','systemctl status reporting'],
 why:'<b>Príčina:</b> Java dostala <code>-Xmx6g</code> na serveri so 4 GB RAM. Keď pamäť minula, jadro spustilo <b>OOM killer</b> a proces zabilo (<code>Result: oom-kill</code>, v <code>dmesg</code> „Out of memory: Killed process … (java)“).<br><b>Riešenie:</b> heap Javy menší ako RAM servera s rezervou pre OS (tu <code>-Xmx2g</code>), reštart služby.<br><b>Ponaučenie:</b> služba, ktorá „sama padá“, môže byť obeťou OOM. Over <code>systemctl status</code> (Result), <code>dmesg</code> / <code>journalctl -k</code> a <code>free -h</code>. Nastavenia aplikácie často sú v <code>EnvironmentFile</code> (<code>/etc/sysconfig/…</code>), nie v unite.'},

/* ---------- 5. pokazená aktualizácia ---------- */
{id:'update', lvl:'stredný', title:'Po aktualizácii nejde web', area:'dnf history, httpd, .rpmnew',
 ticket:'Od: helpdesk\nPredmet: Intranet nejde od soboty\n\nV sobotu večer prebehla na web03 plánovaná aktualizácia (dnf update). Od nedele ráno intranet vôbec nejde. Treba ho čo najskôr rozbehnúť, aj po reštarte.',
 setup:m=>{
   m.scn = {upd:true};
   asRoot(m,['dnf install -y httpd','systemctl enable httpd']);
   file(m,'/etc/httpd/conf.modules.d/20-acme.conf','# ACME web plugin 1.x\nLoadModule acme_module modules/mod_acme.so\n',0o644,'root','root','httpd_config_t');
   file(m,'/etc/httpd/conf.modules.d/20-acme.conf.rpmnew','# ACME web plugin 2.x\n# Modul bol premenovaný na mod_acme2.so\nLoadModule acme_module modules/mod_acme2.so\n',0o644,'root','root','httpd_config_t');
   file(m,'/etc/httpd/modules/mod_acme2.so','ELF',0o755,'root','root','httpd_modules_t');
   file(m,'/var/www/html/index.html','<h1>Intranet</h1>\n',0o644,'root','root','httpd_sys_content_t');
   m.pkgs.add('acme-webplugin');
   const yd = new Date(Date.now()-DAY), ds = `${yd.getFullYear()}-${String(yd.getMonth()+1).padStart(2,'0')}-${String(yd.getDate()).padStart(2,'0')}`;
   m.dnfHist.forEach(h=>{ if (/httpd/.test(h.cmd)) h.date = '2026-09-14 10:02'; });
   m.dnfHist.push({id:m.dnfHist.length+1, cmd:'update -y', date:ds+' 22:14', act:'Upgrade', n:1, pk:['acme-webplugin']});
   m.scn.updDate = yd.toString().slice(0,15);
   m.scn.updTx = m.dnfHist.length;
   append(m,'/var/log/dnf.log','2026-10-31T22:14:07+0100 INFO Upgraded: acme-webplugin-2.0-1.el9.x86_64\n2026-10-31T22:14:07+0100 WARNING warning: /etc/httpd/conf.modules.d/20-acme.conf created as /etc/httpd/conf.modules.d/20-acme.conf.rpmnew\n');
   asRoot(m,['systemctl start httpd']);
 },
 check:m=>m.svc.httpd.active && m.svc.httpd.enabled && !m._httpdScnBad(),
 hints:['systemctl status httpd a sudo journalctl -xeu httpd: čo presne hlási? Konfiguráciu overíš bez štartu cez sudo httpd -t.','Čo sa v sobotu zmenilo? dnf history a dnf history info ID. Všimni si súbor .rpmnew (novú konfiguráciu z balíka, ktorú dnf neprepísal).','Dve správne cesty: rýchly návrat sudo dnf history undo ID, alebo prijať novú konfiguráciu: sudo mv /etc/httpd/conf.modules.d/20-acme.conf.rpmnew /etc/httpd/conf.modules.d/20-acme.conf. Potom sudo httpd -t a sudo systemctl start httpd.'],
 sol:['systemctl status httpd','sudo httpd -t','dnf history','dnf history info last','sudo mv /etc/httpd/conf.modules.d/20-acme.conf.rpmnew /etc/httpd/conf.modules.d/20-acme.conf','sudo httpd -t','sudo systemctl start httpd'],
 why:'<b>Príčina:</b> aktualizácia balíka <code>acme-webplugin</code> na 2.0 premenovala modul na <code>mod_acme2.so</code>. Upravenú konfiguráciu dnf neprepísal a novú uložil vedľa ako <code>20-acme.conf.rpmnew</code>. httpd sa pokúsil načítať neexistujúci <code>mod_acme.so</code> a nenaštartoval.<br><b>Riešenia:</b> 1) <code>dnf history undo ID</code> vráti starú verziu (rýchle, ale problém len odkladáš). 2) Zapracovať <code>.rpmnew</code> a overiť <code>httpd -t</code>.<br><b>Ponaučenie:</b> po aktualizácii hľadaj <code>.rpmnew</code> / <code>.rpmsave</code> (<code>find /etc -name "*.rpmnew"</code>). Pred reštartom služby vždy otestuj konfiguráciu (<code>httpd -t</code>, <code>sshd -t</code>, <code>nginx -t</code>).'},

/* ---------- 6. expirovaný certifikát ---------- */
{id:'cert', lvl:'ťažký', title:'Expirovaný certifikát', area:'openssl, httpd, SELinux',
 ticket:'Od: helpdesk\nPredmet: Intranet hlási „Vaše pripojenie nie je súkromné“\n\nOd včera prehliadače pri https://intranet.firma.local hlásia neplatný certifikát (NET::ERR_CERT_DATE_INVALID). Bezpečnostný tím minulý týždeň poslal nový certifikát a kľúč, sú na serveri v ~/certifikaty. Vymeň ich prosím tak, aby to fungovalo aj po reštarte.',
 setup:m=>{
   m.scn = {cert:true};
   const now = Date.now();
   asRoot(m,['dnf install -y httpd mod_ssl','firewall-cmd --permanent --add-service=https','firewall-cmd --reload']);
   file(m,'/etc/httpd/conf.d/ssl.conf','Listen 443 https\n\n<VirtualHost _default_:443>\nServerName intranet.firma.local\nSSLEngine on\nSSLCertificateFile /etc/pki/tls/certs/intranet.crt\nSSLCertificateKeyFile /etc/pki/tls/private/intranet.key\n</VirtualHost>\n',0o644,'root','root','httpd_config_t');
   file(m,'/etc/pki/tls/certs/intranet.crt', certFor(m,'k-old', now-367*DAY, now-2*DAY), 0o644,'root','root','cert_t');
   file(m,'/etc/pki/tls/private/intranet.key', m._mkKeyPem('k-old'), 0o600,'root','root','cert_t');
   file(m,'/var/www/html/index.html','<h1>Intranet</h1>\n',0o644,'root','root','httpd_sys_content_t');
   file(m,'/home/admin/certifikaty/intranet-2027.crt', certFor(m,'k-new', now-7*DAY, now+390*DAY), 0o644,'admin','admin','user_home_t');
   file(m,'/home/admin/certifikaty/intranet-2027.key', m._mkKeyPem('k-new'), 0o644,'admin','admin','user_home_t');
   file(m,'/home/admin/certifikaty/intranet-2027-skuska.key', m._mkKeyPem('k-test'), 0o644,'admin','admin','user_home_t');
   file(m,'/home/admin/certifikaty/README.txt','Nový certifikát pre intranet.firma.local (platnosť 13 mesiacov).\nKľúč je jeden z dvoch .key súborov, ktoré ste generovali s CSR (jeden bol len skúšobný).\nPred nasadením over, že kľúč patrí k certifikátu.\n— Bezpečnostný tím\n',0o644,'admin','admin','user_home_t');
   asRoot(m,['systemctl enable --now httpd']);
 },
 check:m=>{ const c = m._sslConf(); if (!c) return false; const k = m.node(c.key||''); const s = m.scn.served; return m.svc.httpd.active && m.svc.httpd.enabled && !!s && s.na > Date.now() && !m._httpdScnBad() && !!k && (k.m & 0o077)===0 && k.u==='root'; },
 hints:['Over, čo server naozaj posiela: curl -v https://localhost alebo openssl s_client -connect localhost:443. Ktoré súbory používa? sudo grep SSLCertificate /etc/httpd/conf.d/ssl.conf.','Pozri nový certifikát: openssl x509 -in ~/certifikaty/intranet-2027.crt -noout -subject -dates. Ktorý kľúč k nemu patrí? Porovnaj odtlačok: openssl x509 -in CRT -noout -modulus | openssl md5 a openssl rsa -in KEY -noout -modulus | openssl md5.','Skopíruj (cp, nie mv) certifikát do /etc/pki/tls/certs/intranet.crt a správny kľúč do /etc/pki/tls/private/intranet.key, kľúč chmod 600, sudo restorecon -Rv /etc/pki/tls, sudo httpd -t a sudo systemctl reload httpd. Potom znova curl.'],
 sol:['curl https://localhost','sudo grep SSLCertificate /etc/httpd/conf.d/ssl.conf','openssl x509 -in ~/certifikaty/intranet-2027.crt -noout -subject -dates','openssl x509 -in ~/certifikaty/intranet-2027.crt -noout -modulus | openssl md5','openssl rsa -in ~/certifikaty/intranet-2027.key -noout -modulus | openssl md5','sudo cp ~/certifikaty/intranet-2027.crt /etc/pki/tls/certs/intranet.crt','sudo cp ~/certifikaty/intranet-2027.key /etc/pki/tls/private/intranet.key','sudo chown root:root /etc/pki/tls/private/intranet.key','sudo chmod 600 /etc/pki/tls/private/intranet.key','sudo restorecon -Rv /etc/pki/tls','sudo httpd -t','sudo systemctl reload httpd','curl https://localhost'],
 why:'<b>Príčina:</b> certifikát v <code>/etc/pki/tls/certs/intranet.crt</code> expiroval. Nový bol pripravený, ale nikto ho nenasadil.<br><b>Pasce:</b> 1) Kľúč musí patriť k certifikátu (rovnaký modulus), inak httpd nenaštartuje (AH02565). 2) Súbory presunuté cez <code>mv</code> z domovského adresára majú SELinux typ <code>user_home_t</code> a httpd ich nesmie čítať: <code>cp</code> + <code>restorecon</code>. 3) Kľúč nesmie byť čitateľný pre všetkých: <code>chmod 600</code>, vlastník root. 4) Kým nespravíš <code>reload</code>, httpd posiela starý certifikát.<br><b>Ponaučenie:</b> platnosť over <code>openssl x509 -noout -dates</code>, to, čo server naozaj posiela, cez <code>openssl s_client</code> alebo <code>curl -v</code>. Expirácie certifikátov sleduj v monitoringu dopredu (<code>openssl x509 -checkend 2592000</code> = 30 dní).'},

/* ---------- 7. služba po reštarte nebeží ---------- */
{id:'envf', lvl:'stredný', title:'Služba po reštarte nebeží', area:'systemd, EnvironmentFile',
 ticket:'Od: monitoring\nPredmet: web02 – služba report po reštarte nebeží\n\nPo nočnom reštarte nebeží služba report (generuje ranné zostavy). Včera kolega Peter „upratoval“ staré súbory v /etc/sysconfig a vraj ich presunul do /root/upratane. Rozbehni službu natrvalo.',
 setup:m=>{
   m.scn = {envf:true};
   file(m,'/opt/report/bin/report','#!/bin/bash\n# report\n',0o755);
   file(m,'/opt/report/README','Služba report\nKonfigurácia: /etc/sysconfig/report (DB_HOST, DB_PORT)\n',0o644);
   file(m,'/etc/systemd/system/report.service','[Unit]\nDescription=Ranné zostavy (report)\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nEnvironmentFile=/etc/sysconfig/report\nExecStart=/opt/report/bin/report --db ${DB_HOST}:${DB_PORT}\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n');
   file(m,'/root/upratane/report','# report – pripojenie k databáze\nDB_HOST=db01.firma.local\nDB_PORT=5432\n',0o644,'root','root','admin_home_t');
   file(m,'/root/upratane/network','# stary subor z RHEL 7\nNETWORKING=yes\n',0o644,'root','root','admin_home_t');
   file(m,'/root/upratane/agent-old.conf','# nepoužíva sa\n',0o644,'root','root','admin_home_t');
   m._dynRegister('report'); m.svc.report.enabled = true; m.lastReload = Date.now()+1;
   asRoot(m,['systemctl start report']);
 },
 check:m=>!!m.svc.report && m.svc.report.active && m.svc.report.enabled && !m._dynValidate('report'),
 hints:['systemctl status report a journalctl -u report: aký je „Result“ a čo presne chýba?','systemctl cat report: aký súbor služba načítava (EnvironmentFile)? Existuje? Čo je v /root/upratane (sudo ls)?','Vráť súbor: sudo cp /root/upratane/report /etc/sysconfig/report a sudo restorecon -v /etc/sysconfig/report. Potom sudo systemctl restart report a over is-enabled.'],
 sol:['systemctl status report','systemctl cat report','sudo ls /root/upratane','sudo cp /root/upratane/report /etc/sysconfig/report','sudo restorecon -v /etc/sysconfig/report','sudo systemctl restart report','systemctl status report'],
 why:'<b>Príčina:</b> služba načítava premenné z <code>EnvironmentFile=/etc/sysconfig/report</code>. Súbor bol presunutý preč, takže systemd službu ani nespustil (<code>Result: resources</code>, „Failed to load environment files“).<br><b>Riešenie:</b> vrátiť súbor (cp + restorecon), reštart, overiť <code>is-enabled</code>.<br><b>Ponaučenie:</b> <code>systemctl cat SLUŽBA</code> ukáže všetko, od čoho služba závisí (súbory, používateľ, cesty). Pomlčka <code>EnvironmentFile=-/cesta</code> znamená „nepovinný súbor“. V <code>/etc</code> nič „neupratuj“ bez overenia, čo to používa (<code>grep -r NÁZOV /etc/systemd /usr/lib/systemd</code>).'},

/* ---------- 8. emergency mode po fstab ---------- */
{id:'fstab', lvl:'ťažký', title:'Server nenaštartoval (emergency mode)', area:'fstab, blkid, boot',
 root:true,
 motd:'[ TIME ] Timed out waiting for device /dev/disk/by-uuid/…\n[DEPEND] Dependency failed for /data.\n[DEPEND] Dependency failed for Local File Systems.\n\nYou are in emergency mode. After logging in, type "journalctl -xb" to view\nsystem logs, "systemctl reboot" to reboot, "systemctl default" or "exit"\nto boot into default mode.\nGive root password for maintenance\n(or press Control-D to continue): ********\n\n(simulácia: si prihlásený ako root na konzole servera, SSH nefunguje)\n',
 ticket:'Od: Peter (kolega)\nPredmet: SÚRNE web02 nenaštartoval\n\nVčera som na web02 pridal nový disk pre aplikáciu (/data) a zapísal ho do /etc/fstab. Po dnešnom reštarte server nenabehol, na konzole je nejaký emergency mode. Aplikácia /data potrebuje. Si na konzole servera (vSphere).',
 setup:m=>{
   m.scn = {fstab:true};
   asRoot(m,['mkfs.xfs /dev/sdb','mkdir /data']);
   const real = m.fsInfo['/dev/sdb'].uuid;
   const bad = real.slice(0,9) + real[10] + real[9] + real.slice(11);
   m.scn.fstabBad = bad; m.scn.fstabReal = real;
   append(m,'/etc/fstab',`# nový disk pre aplikáciu (Peter)\nUUID=${bad} /data                   xfs     defaults        0 0\n`);
   asRoot(m,['reboot']);
   m.user = 'root'; m.rootShell = true; m.cwd = '/root';
 },
 check:m=>!m.emergency && m.mounts.some(x=>x.dir==='/data'),
 hints:['Prečítaj, čo zlyhalo: journalctl -xb (hľadaj „Timed out waiting for device“ a „Dependency failed“). Pozri cat /etc/fstab.','Porovnaj UUID vo /etc/fstab s tým, ktoré disk naozaj má: blkid alebo lsblk -f.','Oprav UUID v /etc/fstab (vim /etc/fstab), otestuj mount -a a findmnt --verify, potom systemctl daemon-reload a systemctl default (alebo reboot).'],
 sol:m=>['journalctl -xb','cat /etc/fstab','blkid',`sed -i "s/${m.scn.fstabBad}/${m.scn.fstabReal}/" /etc/fstab`,'mount -a','findmnt --verify','systemctl daemon-reload','systemctl default'],
 why:'<b>Príčina:</b> v <code>/etc/fstab</code> bol UUID s prehodenými dvoma znakmi. systemd čakal 90 s na zariadenie, ktoré neexistuje, potom zlyhal <code>local-fs.target</code> a server skončil v <b>emergency mode</b> (len root na konzole, bez siete a SSH).<br><b>Riešenie:</b> správny UUID z <code>blkid</code>, test <code>mount -a</code> a <code>findmnt --verify</code>, potom <code>systemctl default</code>.<br><b>Ponaučenie:</b> po každej úprave fstab <b>pred reštartom</b> spusti <code>mount -a</code> a <code>findmnt --verify</code>. UUID kopíruj, nepíš ručne. Pre disky, bez ktorých má server nabehnúť aj tak, pridaj voľbu <code>nofail</code>.'},

/* ---------- 9. CPU 100 % ---------- */
{id:'cpu', lvl:'stredný', title:'Server je extrémne pomalý', area:'top, ps, kill, cron',
 ticket:'Od: používatelia + monitoring\nPredmet: web02 je extrémne pomalý\n\nOd rána je web02 strašne pomalý, monitoring hlási load nad 4 a CPU 100 %. Vraj nikto nič nemenil… okrem toho, že Peter včera pridal synchronizáciu zostáv na zálohovací server. Zisti, čo žerie CPU, a oprav to natrvalo (synchronizácia má bežať raz denne o 2:00).',
 setup:m=>{
   m.scn = {cpu:true};
   file(m,'/usr/local/bin/sync-reports.sh','#!/bin/bash\n# Synchronizácia zostáv na zálohovací server (Peter)\nwhile true; do\n  rsync -a /srv/reports/ backup01:/zaloha/reports/ && break\ndone\n',0o755);
   file(m,'/etc/cron.d/reports','# Synchronizácia zostáv: má bežať raz denne o 2:00\n* * * * * root /usr/local/bin/sync-reports.sh\n',0o644,'root','root','system_cron_spool_t');
   for (let i=0;i<4;i++) m.procs.push({u:'root', pid:5101+i, cpu:+(99.2-i*0.3).toFixed(1), mem:0.1, stat:'R', cmd:'/bin/bash /usr/local/bin/sync-reports.sh'});
   append(m,'/var/log/cron', ['07:56:01','07:57:01','07:58:01','07:59:01'].map((t,i)=>`Nov  1 ${t} ${m.hostname} CROND[${5101+i}]: (root) CMD (/usr/local/bin/sync-reports.sh)\n`).join(''));
 },
 check:m=>!m.procs.some(p=>/sync-reports/.test(p.cmd)) && !m._cronEveryMinute(),
 hints:['uptime a top (v top klávesa P zoradí podľa CPU). Ktorý proces to je a kto ho spustil? ps aux | grep sync.','Ak proces zabiješ, o chvíľu je tu znova. Kto ho spúšťa? Pozri /etc/cron.d a /var/log/cron. Ako často sa spúšťa?','Oprav plán v /etc/cron.d/reports na 0 2 * * * (minúta 0, hodina 2) a potom sudo pkill -f sync-reports.sh. Over uptime a top.'],
 sol:['uptime','top -b -n 1','ps aux | grep sync','sudo cat /etc/cron.d/reports','echo "0 2 * * * root /usr/local/bin/sync-reports.sh" | sudo tee /etc/cron.d/reports','sudo pkill -f sync-reports.sh','uptime'],
 why:'<b>Príčina:</b> v <code>/etc/cron.d/reports</code> bolo <code>* * * * *</code> (každú minútu) namiesto <code>0 2 * * *</code>. Skript navyše pri nedostupnom serveri točí slučku bez pauzy, takže každá inštancia zaberie celé CPU a každú minútu pribudne ďalšia.<br><b>Riešenie:</b> najprv oprav príčinu (cron), potom zabi bežiace procesy (<code>pkill -f</code>). Opačne by sa procesy hneď vrátili.<br><b>Ponaučenie:</b> <code>top</code> / <code>ps aux --sort=-%cpu</code> ukážu, čo žerie CPU, <code>ps -ef --forest</code> kto to spustil. Load average porovnávaj s počtom CPU (<code>nproc</code>). Cron: 5 polí = minúta hodina deň mesiac deň_týždňa.'},

/* ---------- 10. zamknutý účet ---------- */
{id:'lock', lvl:'ľahký', title:'Kolegyňa sa nevie prihlásiť', area:'faillock, passwd, chage',
 ticket:'Od: Jana Kováčová\nPredmet: Neviem sa prihlásiť na web02\n\nAhoj, po dovolenke som zabudla heslo na web02. Skúšala som rôzne heslá a teraz ma to nepustí ani s tým, o ktorom si myslím, že je správne. Môžeš mi odomknúť účet a nastaviť dočasné heslo? Zmením si ho hneď po prihlásení (nech ma k tomu systém prinúti).',
 setup:m=>{
   asRoot(m,['useradd jana','passwd jana']);
   m.scn = {lock:true, pwT0: m.pwSeq||0};
   m.faillock = {jana: ['2026-11-01 08:12:01','2026-11-01 08:12:19','2026-11-01 08:12:44','2026-11-01 08:13:02','2026-11-01 08:13:30','2026-11-01 08:14:05']};
   file(m,'/etc/security/faillock.conf','# Konfigurácia pam_faillock\n# Po 5 neúspešných pokusoch sa účet zamkne.\ndeny = 5\n# unlock_time = 0: odomkne len administrátor\nunlock_time = 0\n',0o644);
   append(m,'/var/log/secure',['08:12:01','08:12:19','08:12:44','08:13:02','08:13:30'].map(t=>`Nov  1 ${t} ${m.hostname} sshd[4410]: Failed password for jana from 10.0.20.77 port 51122 ssh2\n`).join('') + `Nov  1 08:13:30 ${m.hostname} sshd[4410]: pam_faillock(sshd:auth): Consecutive login failures for user jana account temporarily locked\nNov  1 08:14:05 ${m.hostname} sshd[4418]: pam_faillock(sshd:auth): Consecutive login failures for user jana account temporarily locked\n`);
 },
 check:m=>{ const u = m.users.jana; return !!u && !((m.faillock||{}).jana||[]).length && (u.pwAt||0) > m.scn.pwT0 && !!u.expired; },
 hints:['Prečo sa nevie prihlásiť? sudo tail /var/log/secure. Je účet zamknutý cez passwd (sudo passwd -S jana: LK?) alebo inak?','RHEL zamyká účty po neúspešných pokusoch modulom pam_faillock: sudo faillock --user jana. usermod -U ani passwd -u to neodomknú.','sudo faillock --user jana --reset, sudo passwd jana (dočasné heslo) a sudo chage -d 0 jana (pri prihlásení si ho musí zmeniť). Over sudo chage -l jana.'],
 sol:['sudo tail /var/log/secure','sudo passwd -S jana','sudo faillock --user jana','sudo faillock --user jana --reset','sudo passwd jana','sudo chage -d 0 jana','sudo chage -l jana'],
 why:'<b>Príčina:</b> po 5 zlých heslách <code>pam_faillock</code> účet zamkol (<code>/etc/security/faillock.conf</code>, <code>deny = 5</code>). <code>passwd -S</code> pritom ukazuje PS (heslo nastavené), preto sa to ľahko prehliadne.<br><b>Riešenie:</b> <code>faillock --user jana --reset</code>, nové dočasné heslo cez <code>passwd jana</code> a <code>chage -d 0 jana</code>, aby si ho musela pri prihlásení zmeniť.<br><b>Ponaučenie:</b> „nepustí ma ani so správnym heslom“ = najprv <code>/var/log/secure</code> a <code>faillock</code>. Dočasné heslo nikdy neposielaj tým istým kanálom ako meno používateľa.'}
);
})();
