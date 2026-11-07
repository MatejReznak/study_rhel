/* =========================================================
   INCIDENTY + SKÚŠOBNÝ SERVER
   setup(m) pokazí stroj, check(m) overí opravu
   ========================================================= */
(function(){
const asRoot = (m, cmds)=>{ const prev = m.user; m.user='root'; try { for (const c of cmds) m.run(' '+c); } finally { m.user = prev; } };
const file = (m, p, c, mode, u, g, ctx)=>{ const [d] = m.parentOf(p); if (!m.exists(d)) { const x=m._mkPath(d,'d',0o755,'root','root'); x.ctx=m.defaultCtx(d); } const n = m._mkPath(p,'f',mode||0o644,u||'root',g||u||'root',c); n.ctx = ctx || m.defaultCtx(p); n.mt = new Date(Date.now()-3600e3*5); return n; };

window.INCIDENTS = [
{id:'web', lvl:'ľahký', title:'Intranet nejde', area:'firewall, SELinux',
 ticket:'Od: helpdesk\nPredmet: Intranet web01 nefunguje\n\nPo včerajšej zmene (kolega presúval novú úvodnú stránku) sa intranet z kancelárie vôbec nenačíta, prehliadač hneď hlási, že sa nevie pripojiť. Na samotnom serveri vraj curl vracia 403 Forbidden. Prosím o opravu, aby to fungovalo aj po reštarte.',
 setup:m=>{ asRoot(m,['dnf install -y httpd','systemctl enable --now httpd']); m.fw.runtime.public.services=m.fw.runtime.public.services.filter(s=>s!=='http'); file(m,'/var/www/html/index.html','<h1>Intranet web01</h1>\n<p>Nová úvodná stránka.</p>\n',0o644,'root','root','user_home_t'); },
 check:m=>{ const n=m.node('/var/www/html/index.html'); const fw = z=>z.public.services.includes('http')||z.public.ports.includes('80/tcp'); return m.svc.httpd.active && m.svc.httpd.enabled && n && n.ctx==='httpd_sys_content_t' && fw(m.fw.runtime) && fw(m.fw.perm); },
 hints:['Rozdeľ problém na dva: prečo sa zvonku nič nenačíta (sieť) a prečo lokálne 403 (prístup k súboru).','Zvonku: čo púšťa firewall? firewall-cmd --list-all. Lokálne: ls -Z /var/www/html. Aký typ by mal mať súbor pre apache?','sudo firewall-cmd --permanent --add-service=http && sudo firewall-cmd --reload; sudo restorecon -Rv /var/www/html'],
 sol:["curl localhost","sudo firewall-cmd --permanent --add-service=http","sudo firewall-cmd --reload","ls -Z /var/www/html","sudo restorecon -Rv /var/www/html","curl localhost"],
 why:'<b>Dve príčiny naraz.</b> 1) Vo firewalle chýbala služba http, preto sa zvonku nič nenačítalo (firewalld paket odmietne, klient hneď dostane „No route to host“). 2) Nová stránka bola do /var/www/html <b>presunutá cez mv</b> z domovského adresára a niesla SELinux typ <code>user_home_t</code>. Apache smie čítať len <code>httpd_sys_content_t</code>, preto 403, hoci práva 644 sú v poriadku.<br><b>Ponaučenie:</b> 403 pri správnych právach = skontroluj <code>ls -Z</code>. Firewall vždy s <code>--permanent</code> a <code>--reload</code>.'},

{id:'disk', lvl:'stredný', title:'Plný disk', area:'df, du, lsof',
 ticket:'Od: monitoring (automatický alarm)\nPredmet: CRITICAL web01 / disk usage 97 %\n\nKoreňový súborový systém je takmer plný. Aplikácia „app“ začína hlásiť chyby pri zápise. Uvoľni miesto, ale nič nemaž naslepo a aplikáciu nechaj bežať.',
 setup:m=>{
   file(m,'/opt/app/bin/app','#!/bin/bash\n# app\n',0o755);
   file(m,'/etc/systemd/system/app.service','[Unit]\nDescription=Firemná aplikácia app\n\n[Service]\nExecStart=/opt/app/bin/app\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n');
   m._dynRegister('app'); m.svc.app.active=true; m.svc.app.enabled=true; m.svc.app.since=new Date(Date.now()-86400e3); m.lastReload = Date.now()+1;
   file(m,'/var/log/app/app.log','2026-11-01 12:00:01 INFO app running\n',0o644);
   const h = file(m,'/var/log/app/debug.log','2026-11-01 12:00:01 DEBUG request id=1 …\n',0o644); h.big = 17*1073741824; h.hog = 17;
   file(m,'/var/log/app/app.log-20261025.gz','(gz)',0o644).big = 52428800;
   m.mounts[0].used = 12.1; m.hogs = [{path:'/var/log/app/debug.log', gb:17, svc:'app', t0:new Date()}];
 },
 check:m=>m._hogGB('/')===0 && m.svc.app && m.svc.app.active,
 hints:['Najprv zisti, ktorý súborový systém je plný (df -h) a potom kde v ňom sú veľké veci: sudo du -sh /var/* | sort -h, a ďalej do hĺbky.','Našiel si obrovský debug log? Ak ho zmažeš a df sa nezmení, súbor stále drží otvorený proces: sudo lsof +L1 (lsof je v rovnomennom balíku: sudo dnf install -y lsof).','Miesto uvoľníš vyprázdnením súboru (sudo truncate -s 0 /var/log/app/debug.log, alebo > súbor), alebo ak si ho už zmazal, reštartom služby: sudo systemctl restart app.'],
 sol:["df -h","sudo du -sh /var/* | sort -h","sudo rm /var/log/app/debug.log","df -h","sudo lsof +L1","sudo systemctl restart app","df -h"],
 why:'<b>Príčina:</b> aplikácia mala zapnuté debug logovanie a <code>/var/log/app/debug.log</code> narástol na 17 GB.<br><b>Pasca:</b> ak súbor zmažeš cez <code>rm</code>, kým ho proces má otvorený, miesto sa neuvoľní (df ukazuje stále plno, du nič nenájde). Pomôže <code>lsof +L1</code> a reštart služby, alebo súbor rovno vyprázdniť cez <code>truncate -s 0</code>.<br><b>Ponaučenie:</b> logy, ktoré bežiaci proces zapisuje, vyprázdňuj, nemaž. Dlhodobo: vypnúť debug a nastaviť logrotate.'},

{id:'ssh', lvl:'stredný', title:'Nikto sa nepripojí cez SSH', area:'sshd, SELinux, firewall',
 ticket:'Od: kolega Peter\nPredmet: SSH na web01 nejde\n\nKvôli bezpečnostnému auditu som zmenil port SSH na 2222 (súbor v /etc/ssh/sshd_config.d/) a reštartoval sshd. Odvtedy sa nikto nepripojí ani na 22, ani na 2222. Si na konzole servera (vSphere). Audit chce port 2222, ak sa to dá spraviť správne.',
 setup:m=>{ file(m,'/etc/ssh/sshd_config.d/10-audit.conf','# zmena pre audit 2026-10\nPort 2222\nPermitRootLogin no\n',0o600); asRoot(m,['systemctl restart sshd']); },
 check:m=>m.svc.sshd.active && (m._sshdPort()===22 || (m._sePortAllowed('ssh_port_t', m._sshdPort()) && m.fw.perm.public.ports.includes(m._sshdPort()+'/tcp') && m.fw.runtime.public.ports.includes(m._sshdPort()+'/tcp'))),
 hints:['Beží vôbec sshd? systemctl status sshd a journalctl -u sshd.','„Bind to port 2222 … Permission denied“ pri root procese = SELinux. Ktorý typ portu smie sshd používať? sudo semanage port -l | grep ssh (semanage je v balíku policycoreutils-python-utils).','sudo semanage port -a -t ssh_port_t -p tcp 2222; firewall: --permanent --add-port=2222/tcp a --reload; sudo systemctl restart sshd. (Alternatíva: vrátiť Port 22.)'],
 sol:["systemctl status sshd","sudo dnf install -y policycoreutils-python-utils","sudo semanage port -a -t ssh_port_t -p tcp 2222","sudo firewall-cmd --permanent --add-port=2222/tcp","sudo firewall-cmd --reload","sudo systemctl restart sshd","sudo ss -tlpn"],
 why:'<b>Príčina:</b> SELinux dovoľuje sshd počúvať len na portoch typu <code>ssh_port_t</code> (štandardne len 22). Po zmene na 2222 sa sshd nevedel naviazať na port a spadol, preto nešlo nič.<br><b>Správne riešenie:</b> <code>semanage port -a -t ssh_port_t -p tcp 2222</code>, port otvoriť vo firewalle natrvalo, overiť <code>sshd -t</code>, reštartovať a <b>novú reláciu otestovať, kým máš otvorenú konzolu</b>.<br><b>Ponaučenie:</b> zmena portu služby = vždy tri miesta: konfigurácia, SELinux, firewall.'},

{id:'reboot', lvl:'ľahký', title:'Po reštarte nefunguje monitoring', area:'systemd enable, firewall permanent',
 ticket:'Od: tím monitoringu\nPredmet: web01 nevidíme od nočného patchovania\n\nV noci prebehol plánovaný reštart po aktualizáciách. Odvtedy nevidíme metriky z web01 (agent acme-agent, port 9100). Pred reštartom všetko fungovalo. Treba, aby to prežilo aj ďalší reštart.',
 setup:m=>{ m._installAcmeAgent(); asRoot(m,['systemctl start acme-agent','firewall-cmd --add-port=9100/tcp','reboot']); },
 check:m=>m.svc['acme-agent'].active && m.svc['acme-agent'].enabled && m.fw.perm.public.ports.includes('9100/tcp') && m.fw.runtime.public.ports.includes('9100/tcp'),
 hints:['Beží agent? systemctl status acme-agent. Pozri riadok Loaded: je tam enabled alebo disabled?','A firewall: firewall-cmd --list-ports. Je tam 9100/tcp? Bol niekedy pridaný natrvalo?','sudo systemctl enable --now acme-agent; sudo firewall-cmd --permanent --add-port=9100/tcp && sudo firewall-cmd --reload. Over reštartom: sudo reboot.'],
 sol:["systemctl status acme-agent","sudo systemctl enable --now acme-agent","sudo firewall-cmd --permanent --add-port=9100/tcp","sudo firewall-cmd --reload"],
 why:'<b>Príčina:</b> pri inštalácii niekto agenta len <code>start</code>-ol (nie <code>enable</code>) a port otvoril bez <code>--permanent</code>. Obe zmeny platili len do reštartu.<br><b>Ponaučenie:</b> po každej zmene si polož otázku „prežije to reštart?“. Služba = <code>enable --now</code>, firewall = <code>--permanent</code> + <code>--reload</code>, sysctl = súbor v /etc/sysctl.d. V simulátore si to overíš príkazom <code>sudo reboot</code>.'},

{id:'user', lvl:'ľahký', title:'Kolegyňa sa nevie prihlásiť', area:'používatelia, skupiny',
 ticket:'Od: Jana Kováčová\nPredmet: Nefunguje mi prihlásenie na web01\n\nDnes ráno sa neviem prihlásiť heslom, ktoré mi včera fungovalo. Včera som ešte mohla robiť sudo. Kolega vraj večer „upratoval skupiny“.',
 setup:m=>{ asRoot(m,['groupadd developers','useradd -c "Jana Kovacova" -G wheel jana','passwd jana','usermod -G developers jana','usermod -L jana']); },
 check:m=>m.users.jana && !m.users.jana.locked && m.groups.wheel.mem.includes('jana') && m.groups.developers.mem.includes('jana'),
 hints:['Pozri stav účtu: sudo passwd -S jana a id jana.','LK znamená zamknutý účet. V id chýba wheel. Ktorý prepínač usermod pridáva skupinu bez odobratia ostatných?','sudo usermod -U jana; sudo usermod -aG wheel jana. Skupinu developers jej nechaj.'],
 sol:["sudo passwd -S jana","id jana","sudo usermod -U jana","sudo usermod -aG wheel jana","id jana"],
 why:'<b>Príčina:</b> kolega spustil <code>usermod -G developers jana</code> bez <code>-a</code>, čím jej odobral všetky ostatné doplnkové skupiny vrátane wheel (sudo). Účet bol navyše zamknutý (<code>usermod -L</code>, v /etc/shadow „!“ pred hashom).<br><b>Ponaučenie:</b> vždy <code>usermod -aG</code>. Stav účtu: <code>passwd -S</code>, <code>chage -l</code>, <code>id</code>.'},

{id:'perm', lvl:'stredný', title:'Aplikácia nemôže zapisovať', area:'práva, vlastníctvo',
 ticket:'Od: vývojári\nPredmet: appka padá pri exporte\n\nAplikácia beží pod používateľom appka a pri nočnom exporte hlási:\n  Permission denied: /srv/data/export/report.csv\nAdresár sme včera presunuli zo starého servera. Daj appke práva zapisovať do /srv/data/export, ale nedávaj 777.',
 setup:m=>{ asRoot(m,['useradd -r -s /sbin/nologin appka','mkdir -p /srv/data/export','chmod 750 /srv/data','chmod 755 /srv/data/export']); file(m,'/srv/data/export/report-old.csv','id;suma\n1;100\n',0o644); },
 check:m=>m.canAs('appka','/srv/data/export',2) && m.canAs('appka','/srv/data/export',1) && !((m.node('/srv/data/export').m & 0o002)) && !((m.node('/srv/data').m & 0o002)),
 hints:['Skontroluj práva na celej ceste, nielen na poslednom adresári: ls -ld /srv/data /srv/data/export.','appka nepatrí do skupiny root a /srv/data má pre ostatných 0, takže sa do neho appka nedostane vôbec. A export patrí rootovi.','Napr.: sudo chown -R appka:appka /srv/data/export a sudo chmod 755 /srv/data (alebo setfacl -m u:appka:rx /srv/data). Over: sudo -u appka touch /srv/data/export/test.'],
 sol:["ls -ld /srv/data /srv/data/export","sudo -u appka touch /srv/data/export/x","sudo chown -R appka:appka /srv/data/export","sudo chmod 755 /srv/data","sudo -u appka touch /srv/data/export/x"],
 why:'<b>Príčina:</b> po presune patria adresáre rootovi. appka nemá právo <b>x</b> na <code>/srv/data</code> (750, skupina root), takže sa nedostane ani k podadresáru, a do <code>/srv/data/export</code> nemá <b>w</b>.<br><b>Ponaučenie:</b> pri „Permission denied“ kontroluj celú cestu (<code>namei -l</code> alebo <code>ls -ld</code> každej úrovne). Test pod správnym používateľom: <code>sudo -u appka …</code>. Nikdy 777.'},

{id:'dns', lvl:'stredný', title:'Server nevidí databázu', area:'DNS, nmcli',
 ticket:'Od: vývojári\nPredmet: web01 sa nevie spojiť s db01\n\nAplikácia hlási: could not translate host name "db01.firma.local": Name or service not known. Včera sieťový tím menil DNS servery. Správny DNS server firmy je 10.0.20.2. Oprav to natrvalo (nie ručnou úpravou /etc/resolv.conf).',
 setup:m=>{ m.net.dns='10.0.20.99'; m._writeResolv(); const h=m._lookup('/etc/hosts'); h.c = h.c.split('\n').filter(l=>!/db01/.test(l)).join('\n'); },
 check:m=>m.net.dns==='10.0.20.2' && m._resolve('db01.firma.local')==='10.0.20.40' && /nameserver 10\.0\.20\.2/.test(m.read('/etc/resolv.conf')||''),
 hints:['Preklad mena overíš: getent hosts db01.firma.local, dig db01.firma.local. Aký DNS server sa používa? cat /etc/resolv.conf.','resolv.conf generuje NetworkManager. Pozri, čo má profil: nmcli con show ens192 | grep dns.','sudo nmcli con mod ens192 ipv4.dns 10.0.20.2 a sudo nmcli con up ens192. Over getent hosts db01.firma.local.'],
 sol:["getent hosts db01.firma.local","cat /etc/resolv.conf","sudo nmcli con mod ens192 ipv4.dns 10.0.20.2","sudo nmcli con up ens192","ping -c 1 db01.firma.local"],
 why:'<b>Príčina:</b> v profile NetworkManagera ostal starý DNS server 10.0.20.99, ktorý už neodpovedá. <code>/etc/resolv.conf</code> sa generuje z profilu, takže ručná úprava by sa pri ďalšom reštarte siete prepísala.<br><b>Ponaučenie:</b> DNS meň cez <code>nmcli con mod … ipv4.dns</code> a <code>nmcli con up</code>. Na test prekladu používaj <code>getent hosts</code> (ide cez /etc/hosts aj DNS, ako aplikácia) a <code>dig</code> (len DNS).'},

{id:'cron', lvl:'ľahký', title:'Záloha sa nerobí', area:'cron, PATH, práva',
 ticket:'Od: vedúci tímu\nPredmet: Chýbajú zálohy z web01\n\nUž týždeň nemáme zálohu z web01. Skript /usr/local/bin/zaloha.sh vraj funguje, keď ho niekto spustí ručne cez „bash /usr/local/bin/zaloha.sh“. Má sa spúšťať každú noc o 2:30 z rootovho cronu.',
 setup:m=>{ m.crontabs.root='# záloha\n30 2 * * * zaloha.sh >> /var/log/zaloha.log 2>&1\n'; file(m,'/usr/local/bin/zaloha.sh','#!/bin/bash\n# nočná záloha /etc\ntar -czf /var/tmp/etc-$(date +%F).tar.gz /etc\necho "$(date) záloha OK"\n',0o644); file(m,'/var/log/zaloha.log','/bin/sh: line 1: zaloha.sh: command not found\n/bin/sh: line 1: zaloha.sh: command not found\n/bin/sh: line 1: zaloha.sh: command not found\n',0o644); const c=m._lookup('/var/log/cron'); c.c += 'Nov  1 02:30:01 web01 CROND[3122]: (root) CMD (zaloha.sh >> /var/log/zaloha.log 2>&1)\n'; },
 check:m=>{ const t = m.crontabs.root||''; const n = m.node('/usr/local/bin/zaloha.sh'); const line = t.split('\n').find(l=>/zaloha\.sh/.test(l) && !l.trim().startsWith('#'))||''; const direct = /^\s*30\s+2\s+\*\s+\*\s+\*\s+\/usr\/local\/bin\/zaloha\.sh/.test(line); const viaBash = /^\s*30\s+2\s+\*\s+\*\s+\*\s+\/(usr\/)?bin\/bash\s+\/usr\/local\/bin\/zaloha\.sh/.test(line); return (direct && n && (n.m & 0o100)) || viaBash; },
 hints:['Čo hovorí log? sudo cat /var/log/zaloha.log a sudo grep zaloha /var/log/cron. Pozri aj sudo crontab -l.','„command not found“: cron má minimálny PATH a /usr/local/bin v ňom nie je. A dá sa skript vôbec spustiť? ls -l /usr/local/bin/zaloha.sh.','sudo chmod 755 /usr/local/bin/zaloha.sh a v sudo crontab -e uveď úplnú cestu: 30 2 * * * /usr/local/bin/zaloha.sh >> /var/log/zaloha.log 2>&1'],
 sol:["sudo cat /var/log/zaloha.log","sudo crontab -l","sudo chmod 755 /usr/local/bin/zaloha.sh","echo \"30 2 * * * /usr/local/bin/zaloha.sh >> /var/log/zaloha.log 2>&1\" | sudo crontab -"],
 why:'<b>Dve príčiny.</b> 1) V crone bolo len meno <code>zaloha.sh</code> bez cesty. Cron beží s minimálnym PATH, kde /usr/local/bin nie je. 2) Skript nemal právo <b>x</b>, ručne fungoval len preto, že ho ľudia spúšťali cez <code>bash skript</code>.<br><b>Ponaučenie:</b> v crone vždy úplné cesty a výstup do logu (<code>>> log 2>&1</code>). Keď niečo „ručne ide a v crone nie“, je to takmer vždy PATH, práva alebo prostredie.'}
];

/* ---------------- SKÚŠKA ---------------- */
window.EXAM = [
 {t:'Meno servera je natrvalo <code>web02.firma.local</code>.', check:m=>m.hostname==='web02.firma.local' && (m.read('/etc/hostname')||'').trim()==='web02.firma.local'},
 {t:'Používateľ <code>marek</code> s komentárom <code>Marek Novak</code>, s nastaveným heslom a v skupine <code>wheel</code>.', check:m=>m.users.marek && /Marek Novak/.test(m.users.marek.gecos||'') && m.users.marek.pw && m.groups.wheel.mem.includes('marek')},
 {t:'Skupina <code>web</code> a adresár <code>/srv/web</code> s vlastníkom root, skupinou web a právami <code>2775</code>.', check:m=>{ const n=m.node('/srv/web'); return !!m.groups.web && n && n.t==='d' && n.u==='root' && n.g==='web' && (n.m&0o7777)===0o2775; }},
 {t:'Apache (<code>httpd</code>) je nainštalovaný, beží a spúšťa sa pri štarte.', check:m=>m.pkgs.has('httpd') && m.svc.httpd.active && m.svc.httpd.enabled},
 {t:'Firewall povoľuje služby <code>http</code> a <code>https</code>.', check:m=>['http','https'].every(s=>m.fw.runtime.public.services.includes(s))},
 {t:'Súbor <code>/var/www/html/index.html</code> obsahuje text <code>web02</code> a má SELinux typ <code>httpd_sys_content_t</code>.', check:m=>{ const n=m.node('/var/www/html/index.html'); return n && /web02/.test(n.c) && n.ctx==='httpd_sys_content_t'; }},
 {t:'Na disku <code>/dev/sdb</code> je VG <code>vgdata</code> a v nej LV <code>data</code> s veľkosťou 4G, XFS, pripojený v <code>/data</code>.', check:m=>{ const lv=m.lvm.lvs['vgdata/data']; return lv && Math.abs(lv.size-4)<0.05 && lv.fs==='xfs' && m.mounts.some(x=>x.dir==='/data'); }},
 {t:'Parameter jadra <code>vm.swappiness</code> má hodnotu 10.', check:m=>m.sysctl['vm.swappiness']==='10'},
 {t:'Aktívny tuned profil je <code>throughput-performance</code>.', check:m=>m.tuned==='throughput-performance'},
 {t:'Root má v crone úlohu, ktorá každý deň o 1:00 spúšťa <code>/usr/local/bin/zaloha.sh</code>. Skript existuje a je spustiteľný.', check:m=>{ const t=m.crontabs.root||''; const n=m.node('/usr/local/bin/zaloha.sh'); return /^\s*0\s+1\s+\*\s+\*\s+\*\s+\/usr\/local\/bin\/zaloha\.sh/m.test(t) && n && (n.m&0o100); }},
 {t:'sshd nepovoľuje prihlásenie roota (<code>PermitRootLogin no</code> v súbore v <code>/etc/ssh/sshd_config.d/</code>) a beží.', check:m=>{ const dn=m.node('/etc/ssh/sshd_config.d'); const ok = dn && Object.keys(dn.c).sort().some(f=>/^\s*PermitRootLogin\s+no\b/m.test(m.read('/etc/ssh/sshd_config.d/'+f)||'')); return ok && m.svc.sshd.active; }}
];
window.EXAM_SOL = `sudo hostnamectl set-hostname web02.firma.local
sudo useradd -c "Marek Novak" -G wheel marek
sudo passwd marek
sudo groupadd web
sudo mkdir /srv/web
sudo chown root:web /srv/web
sudo chmod 2775 /srv/web
sudo dnf install -y httpd
sudo systemctl enable --now httpd
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
echo "<h1>web02</h1>" | sudo tee /var/www/html/index.html
sudo pvcreate /dev/sdb
sudo vgcreate vgdata /dev/sdb
sudo lvcreate -n data -L 4G vgdata
sudo mkfs.xfs /dev/vgdata/data
sudo mkdir /data
echo "/dev/mapper/vgdata-data /data xfs defaults 0 0" | sudo tee -a /etc/fstab
sudo mount -a
echo "vm.swappiness = 10" | sudo tee /etc/sysctl.d/90-swappiness.conf
sudo sysctl --system
sudo tuned-adm profile throughput-performance
printf '#!/bin/bash\\ntar -czf /var/tmp/etc.tar.gz /etc\\n' | sudo tee /usr/local/bin/zaloha.sh
sudo chmod 755 /usr/local/bin/zaloha.sh
echo "0 1 * * * /usr/local/bin/zaloha.sh" | sudo crontab -
echo "PermitRootLogin no" | sudo tee /etc/ssh/sshd_config.d/00-firma.conf
sudo sshd -t
sudo systemctl restart sshd`;
})();
