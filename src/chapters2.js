/* =========================================================
   KAPITOLY 10–18
   ========================================================= */
(function(){
const CH = c => window.CHAPTERS.push(c);

/* ---------------- 10 ---------------- */
CH({n:10, title:'systemd: služby a journalctl', short:'systemd a služby',
goal:'Spustiť, povoliť a diagnostikovať službu, prečítať jej log a napísať vlastný jednoduchý unit súbor.',
body:[
['p','systemd je prvý proces (PID 1). Spúšťa a stráži služby, pripája disky, spravuje logy. Všetko, čo riadi, sú <b>jednotky</b> (units): <code>.service</code>, <code>.socket</code>, <code>.timer</code>, <code>.mount</code>, <code>.target</code>.'],
['h','Dve otázky, dva príkazy'],
['table',['Otázka','Príkaz','Kde sa to prejaví'],[['Beží to TERAZ?','<code>start</code> / <code>stop</code> / <code>restart</code>','okamžite, do reštartu'],['Spustí sa to PRI ŠTARTE?','<code>enable</code> / <code>disable</code>','symlink v /etc/systemd/system/…wants/']]],
['p','Najčastejšia chyba nováčika: službu spustí (<code>start</code>) a po reštarte servera nebeží, lebo ju nepovolil (<code>enable</code>). Riešenie: <code>systemctl enable --now služba</code>.'],
['flags','systemctl'],
['out','systemctl status sshd','● sshd.service - OpenSSH server daemon\n     Loaded: loaded (/usr/lib/systemd/system/sshd.service; enabled; preset: enabled)\n     Active: active (running) since Sat 2026-10-31 08:00:09 CET\n   Main PID: 1032 (sshd)'],
['table',['Riadok','Čo z neho vyčítaš'],[['Loaded','kde je unit súbor; <b>enabled</b> = štartuje pri boote'],['Active','active (running) / inactive (dead) / failed'],['Main PID','PID hlavného procesu'],['posledné riadky','posledné logy služby: tu býva príčina chyby']]],
['cmd','systemctl status agent','zlyhaná služba'],
['h','journalctl'],
['flags','journalctl'],
['cmd','journalctl -u agent','log jednej služby'],
['cmd','journalctl -p err -b','chyby od štartu'],
['cmd','journalctl -xeu agent','klasická kombinácia po zlyhaní'],
['explain','journalctl -xeu agent'],
['p','Logy sú aj v klasických súboroch: <code>/var/log/messages</code> (všeobecné), <code>/var/log/secure</code> (prihlásenia, sudo), <code>/var/log/cron</code>. Zapisuje ich rsyslog, ktorý dostáva správy z journalu.'],
['tip','Ak chceš, aby journal prežil reštart aj na systéme, kde to nie je zapnuté, vytvor <code>/var/log/journal</code> a reštartuj systemd-journald. Na RHEL 9/10 to predvolene nastavené nie je: journal je v <code>/run/log/journal</code> a po reštarte zmizne, trvalé logy drží rsyslog v <code>/var/log</code>.'],
['h','Kde sú unit súbory'],
['table',['Cesta','Kto ich tam dal','Priorita'],[['<code>/usr/lib/systemd/system/</code>','balíky RPM. Nemeniť!','najnižšia'],['<code>/etc/systemd/system/</code>','ty: vlastné služby a úpravy','najvyššia'],['<code>/run/systemd/system/</code>','runtime, dočasné','stredná']]],
['p','Úpravu existujúcej služby sprav cez <code>sudo systemctl edit httpd</code>. Otvorí prázdny „drop-in“ súbor <code>/etc/systemd/system/httpd.service.d/override.conf</code>, kam napíšeš len to, čo meníš. Celú kópiu dostaneš cez <code>systemctl edit --full</code>.'],
['h','Vlastná služba'],
['pre','# /etc/systemd/system/agent.service\n[Unit]\nDescription=Monitoring agent\nAfter=network-online.target\n\n[Service]\nType=simple\nExecStart=/opt/monitoring/bin/agent --config /opt/monitoring/agent.conf\nRestart=on-failure\nUser=root\n\n[Install]\nWantedBy=multi-user.target'],
['p','Po vytvorení alebo úprave súboru: <code>sudo systemctl daemon-reload</code>, potom <code>sudo systemctl enable --now agent</code>.'],
['h','Targets: režimy systému'],
['table',['Target','Význam'],[['<code>multi-user.target</code>','server bez GUI (bežné)'],['<code>graphical.target</code>','s grafickým prostredím'],['<code>rescue.target</code>','záchranný režim, jeden používateľ'],['<code>emergency.target</code>','minimum, keď ani rescue nenaštartuje (napr. chybný fstab)']]],
['cmd','systemctl get-default',''],
['h','Prípad: agent nebeží'],
['p','V termináli dole je služba <code>agent</code> zlyhaná. Postup ako v práci: <code>systemctl status agent</code> → status=203/EXEC a „Permission denied“ znamená, že sa súbor v ExecStart nedá spustiť → <code>ls -l /opt/monitoring/bin/agent</code> → chýba x → oprav → spusti → povoľ.']
],
quiz:[
 {q:'Služba po reštarte servera nebeží, hoci si ju včera spustil. Prečo?',o:['Bola zamaskovaná','Spustil si ju (start), ale nepovolil (enable)','journal ju zmazal','Treba daemon-reload'],a:1,w:'start = teraz, enable = pri štarte.'},
 {q:'Upravil si súbor v /etc/systemd/system. Čo musíš spraviť, aby si ho systemd všimol?',o:['reboot','systemctl daemon-reload','systemctl reload-all','nič'],a:1,w:'daemon-reload načíta definície jednotiek znova.'},
 {q:'Čo spraví <code>journalctl -p err -b</code>?',o:['Zmaže chyby','Chyby od posledného štartu','Logy procesu err','Logy z /boot'],a:1,w:'-p priorita, -b boot.'},
 {q:'Kam patrí upravená verzia služby z balíka?',o:['/usr/lib/systemd/system','/etc/systemd/system','/opt','/var/lib/systemd'],a:1,w:'/etc má prednosť a dnf ju neprepíše.'},
 {q:'Čo je status=203/EXEC?',o:['Chyba siete','systemd nemohol spustiť súbor z ExecStart','Služba bola zabitá','Chybná konfigurácia'],a:1,w:'Súbor neexistuje, nie je spustiteľný, alebo ho blokuje SELinux.'}
],
ex:[
 {t:'Zisti, prečo zlyháva služba <code>agent</code>, oprav príčinu (súbor v ExecStart nie je spustiteľný), spusti ju a povoľ pri štarte.',h:'systemctl status agent; sudo chmod +x /opt/monitoring/bin/agent; sudo systemctl enable --now agent',sol:'systemctl status agent\nls -l /opt/monitoring/bin/agent\nsudo chmod 755 /opt/monitoring/bin/agent\nsudo systemctl enable --now agent',check:m=>m.svc.agent.active && m.svc.agent.enabled},
 {t:'Zobraz posledných 5 riadkov logu služby sshd.',h:'journalctl -u sshd -n 5',sol:'journalctl -u sshd -n 5',check:m=>m.ran('journalctl',e=>e.args.includes('-u')||e.args.some(a=>a.startsWith('-u'))) && m.ran('journalctl',e=>e.flags.has('n'))},
 {t:'Over, či je služba <code>chronyd</code> povolená pri štarte, jedným krátkym príkazom.',h:'systemctl is-enabled …',sol:'systemctl is-enabled chronyd',check:m=>m.ran('systemctl',e=>e.args[0]==='is-enabled')},
 {t:'Vypíš všetky jednotky, ktoré zlyhali.',h:'systemctl --failed',sol:'systemctl --failed',check:m=>m.ran('systemctl',e=>e.flags.has('failed')||e.args.some(a=>a.includes('failed')))}
]});

/* ---------------- 11 ---------------- */
CH({n:11, title:'Balíky: dnf, rpm a repozitáre', short:'dnf a rpm',
goal:'Nainštalovať a aktualizovať softvér, nájsť balík podľa príkazu, vrátiť zmenu a rozumieť, odkiaľ RHEL berie balíky.',
body:[
['p','RHEL dostáva balíky z repozitárov Red Hat. Systém musí byť <b>zaregistrovaný</b> (<code>subscription-manager</code>), inak dnf nič nestiahne. Repozitáre sú dva hlavné:'],
['table',['Repozitár','Obsah'],[['<b>BaseOS</b>','jadro OS: kernel, systemd, coreutils, ssh. Podpora celý život verzie'],['<b>AppStream</b>','aplikácie a nástroje: httpd, nginx, databázy, jazyky. Niektoré majú kratší životný cyklus'],['CodeReady Builder','balíky pre vývojárov, bez podpory, treba povoliť'],['EPEL','komunitný (htop, ncdu…), NIE je od Red Hatu. Vo firmách často zakázaný']]],
['cmd','sudo subscription-manager status',''],
['cmd','dnf repolist',''],
['flags','dnf'],
['cmd','dnf search apache',''],
['cmd','dnf info httpd',''],
['cmd','sudo dnf install -y httpd',''],
['cmd','dnf provides semanage','neviem, v ktorom balíku je príkaz'],
['cmd','dnf history','čo sa kedy inštalovalo'],
['tip','Na serveri pri neznámom príkaze uvidíš len „command not found“. Ktorý balík ho obsahuje, zistíš cez <code>dnf provides príkaz</code>. (Ak je nainštalovaný PackageKit-command-not-found, bežne pri inštalácii s GUI, shell ti balík ponúkne sám.)'],
['h','rpm: databáza nainštalovaného'],
['flags','rpm'],
['cmd','rpm -qa | grep -i ssh',''],
['cmd','rpm -qi openssh-server',''],
['h','Aktualizácie v praxi'],
['list',['<code>sudo dnf check-update</code>: čo je nové (bez zmeny)','<code>sudo dnf update</code>: aktualizuj všetko. Na produkcii v servisnom okne, po snapshote VM','<code>sudo dnf update --security</code>: len bezpečnostné opravy','<code>needs-restarting -r</code>: treba reštart? (nové jadro, glibc, systemd)','<code>sudo dnf history undo N</code>: vráť transakciu N']],
['p','Nové jadro sa nainštaluje <b>vedľa</b> starého (<code>installonly_limit=3</code> v dnf.conf drží 3 verzie). Ak nové nenaštartuje, v GRUB menu vyberieš predošlé.'],
['new','RHEL 10 ruší modularitu: <code>dnf module</code> vypíše varovanie o zastaraní a rôzne verzie aplikácií prichádzajú ako bežné balíky. Na RHEL 9 sa moduly (napr. <code>dnf module list nginx</code>) ešte používajú.']
],
quiz:[
 {q:'Ako zistíš, ktorý balík obsahuje príkaz semanage?',o:['rpm -qf semanage','dnf provides semanage','dnf search -f semanage','which semanage'],a:1,w:'rpm -qf funguje len pre už nainštalované súbory.'},
 {q:'Ktorý repozitár obsahuje httpd?',o:['BaseOS','AppStream','EPEL','CRB'],a:1,w:'Aplikácie sú v AppStream.'},
 {q:'Ako vrátiš poslednú inštaláciu balíka?',o:['dnf remove last','dnf history undo ID','rpm --rollback','dnf downgrade all'],a:1,w:'dnf history ti ukáže ID transakcie.'},
 {q:'dnf install htop hlási „No match for argument“. Prečo?',o:['Preklep','htop je v EPEL, nie v RHEL repozitároch','Treba sudo','Chýba internet'],a:1,w:'Na RHEL použi top.'}
],
ex:[
 {t:'Nainštaluj webový server <code>httpd</code> bez potvrdzovania otázky.',h:'sudo dnf install -y httpd',sol:'sudo dnf install -y httpd',check:m=>m.pkgs.has('httpd')},
 {t:'Zisti, ktorý balík obsahuje príkaz <code>semanage</code>, a nainštaluj ho.',h:'dnf provides semanage → policycoreutils-python-utils',sol:'dnf provides semanage\nsudo dnf install -y policycoreutils-python-utils',check:m=>m.pkgs.has('policycoreutils-python-utils')},
 {t:'Nainštaluj balík <code>tree</code>, vyskúšaj ho na svojom domovskom adresári a potom ho cez <code>dnf history undo</code> odinštaluj.',h:'sudo dnf install -y tree; tree; dnf history (zisti ID transakcie); sudo dnf history undo ID (alebo undo last)',sol:'sudo dnf install -y tree\ntree ~\ndnf history\nsudo dnf history undo last',check:m=>m.ran('tree') && !m.pkgs.has('tree') && m.ran('dnf',e=>e.args[0]==='history'&&e.args[1]==='undo')}
]});

/* ---------------- 12 ---------------- */
CH({n:12, title:'Sieť: ip, nmcli, ss -tulpn', short:'Sieť a porty',
goal:'Zistiť IP, bránu a DNS, nastaviť statickú adresu cez nmcli a overiť, ktorá služba počúva na ktorom porte.',
body:[
['h','Kde som v sieti'],
['flags','ip'],
['cmd','ip a',''],
['cmd','ip -br a','stručne'],
['cmd','ip r','default via = brána'],
['cmd','cat /etc/resolv.conf','DNS servery'],
['p','<code>ifconfig</code>, <code>route</code> a <code>netstat</code> sú zastarané (balík net-tools) a na čistom RHEL nie sú. Ich náhrady: <code>ip a</code>, <code>ip r</code>, <code>ss</code>.'],
['h','ss -tulpn: kto počúva na akom porte'],
['p','Toto je jeden z najpoužívanejších príkazov admina. Ľudia si ho pamätajú ako „tulpn“ alebo „tulip“. Každé písmeno je samostatný prepínač:'],
['explain','ss -tulpn'],
['flags','ss'],
['cmd','ss -tulpn','bez sudo uvidíš porty, ale nie procesy'],
['cmd','sudo ss -tulpn','teraz aj program a PID'],
['cmd','ss -tln','len TCP, bez procesov'],
['cmd','ss -tn','nadviazané TCP spojenia (bez -l)'],
['out','sudo ss -tulpn','Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process\ntcp   LISTEN 0      128          0.0.0.0:22         0.0.0.0:*    users:(("sshd",pid=1032,fd=3))\nudp   UNCONN 0      0          127.0.0.1:323        0.0.0.0:*    users:(("chronyd",pid=812,fd=6))'],
['table',['Lokálna adresa','Znamená'],[['<code>0.0.0.0:22</code> alebo <code>*:22</code>','počúva na všetkých IPv4 adresách: dostupné zo siete'],['<code>[::]:22</code>','všetky IPv6 adresy'],['<code>127.0.0.1:323</code>','len lokálne. Zvonku sa tam nikto nedostane, firewall nehrá rolu']]],
['tip','Postup „služba nie je dostupná zvonku“: 1) beží? <code>systemctl status</code> 2) počúva? <code>sudo ss -tlpn | grep :PORT</code> 3) na správnej adrese (nie 127.0.0.1)? 4) pustí ju firewall? <code>firewall-cmd --list-all</code> 5) SELinux? 6) až potom sieťový tím.'],
['h','NetworkManager a nmcli'],
['p','Na RHEL sieť spravuje NetworkManager. Nastavenia sú v <b>profiloch</b> (connections) uložených v <code>/etc/NetworkManager/system-connections/*.nmconnection</code>. Zmeny cez nmcli sú trvalé.'],
['flags','nmcli'],
['cmd','nmcli dev status',''],
['cmd','nmcli con show',''],
['cmd','nmcli con show ens192',''],
['pre','# statická IP\nsudo nmcli con mod ens192 ipv4.addresses 10.0.20.35/24\nsudo nmcli con mod ens192 ipv4.gateway 10.0.20.1\nsudo nmcli con mod ens192 ipv4.dns "10.0.20.2"\nsudo nmcli con mod ens192 ipv4.method manual\nsudo nmcli con up ens192'],
['warn','Zmena IP cez SSH ťa odpojí. Na vzdialenom serveri maj po ruke konzolu (vSphere, iLO/iDRAC) alebo si naplánuj návrat zmeny.'],
['p','<code>nmtui</code> je textové menu, ak si nepamätáš názvy nastavení. <code>ip addr add</code> zmení IP len dočasne, do reštartu.'],
['h','Mená a DNS'],
['cmd','hostnamectl set-hostname web01.firma.local','(so sudo)'],
['cmd','getent hosts db01','čo vráti systém: /etc/hosts aj DNS'],
['cmd','ping -c 3 db01',''],
['cmd','curl -I http://localhost','test HTTP'],
['new','RHEL 10 úplne odstránil starý formát ifcfg v <code>/etc/sysconfig/network-scripts/</code> a nástroj <code>dhclient</code> (DHCP rieši interný klient NetworkManagera). Odstránený je aj teaming (<code>teamd</code>), namiesto neho sa používa bonding. Na RHEL 9 staré ifcfg súbory ešte fungujú, nové profily sú už v keyfile formáte.']
],
quiz:[
 {q:'Čo znamená <code>-p</code> v <code>ss -tulpn</code>?',o:['port','process: program a PID','protocol','permanent'],a:1,w:'Pre procesy iných používateľov treba sudo.'},
 {q:'Čo znamená <code>-n</code> v <code>ss -tulpn</code>?',o:['new','numeric: porty ako čísla','network','no-resolve hostname len'],a:1,w:'Bez -n uvidíš ssh namiesto 22.'},
 {q:'Služba počúva na <code>127.0.0.1:8080</code>. Dostane sa na ňu kolega zo siete?',o:['Áno, ak to pustí firewall','Nie, počúva len lokálne','Áno, vždy','Len cez IPv6'],a:1,w:'Treba zmeniť konfiguráciu služby, aby počúvala na 0.0.0.0 alebo konkrétnej IP.'},
 {q:'Kde sú na RHEL 9/10 uložené sieťové profily?',o:['/etc/sysconfig/network-scripts','/etc/NetworkManager/system-connections','/etc/network/interfaces','/var/lib/network'],a:1,w:'Keyfile formát; ifcfg je na 10 odstránený.'},
 {q:'Čím nahradíš <code>netstat -tulpn</code>?',o:['ip -tulpn','ss -tulpn','nmcli -tulpn','lsof -tulpn'],a:1,w:'ss má rovnaké písmená.'}
],
ex:[
 {t:'Zisti, ktoré programy počúvajú na TCP a UDP portoch, aj s menom procesu a číslami portov.',h:'sudo ss -tulpn',sol:'sudo ss -tulpn',check:m=>m.log.some(e=>e.name==='ss' && e.user==='root' && ['t','u','l','p','n'].every(f=>e.flags.has(f)))},
 {t:'Zisti IP adresu servera v stručnom formáte a predvolenú bránu.',h:'ip -br a; ip r',sol:'ip -br a\nip r',check:m=>m.ran('ip',e=>e.args.some(a=>/^r(oute)?$/.test(a))) && m.ran('ip',e=>e.args.some(a=>/^a(ddr)?$/.test(a)))},
 {t:'Zmeň statickú IP profilu <code>ens192</code> na <code>10.0.20.35/24</code> a aktivuj ho.',h:'sudo nmcli con mod ens192 ipv4.addresses 10.0.20.35/24; sudo nmcli con up ens192',sol:'sudo nmcli con mod ens192 ipv4.addresses 10.0.20.35/24\nsudo nmcli con up ens192',check:m=>m.net.ip==='10.0.20.35/24'},
 {t:'Nainštaluj a spusti httpd a over cez ss, že počúva na porte 80.',h:'sudo dnf install -y httpd; sudo systemctl enable --now httpd; sudo ss -tlpn',sol:'sudo dnf install -y httpd\nsudo systemctl enable --now httpd\nsudo ss -tlpn | grep :80',check:m=>m.svc.httpd.active && m.log.some(e=>e.name==='ss' && e.flags.has('l') && e.flags.has('t'))}
]});

/* ---------------- 13 ---------------- */
CH({n:13, title:'Firewall: firewalld a firewall-cmd', short:'Firewall',
goal:'Otvoriť službu alebo port natrvalo, obmedziť prístup na konkrétnu sieť a rozumieť zónam a rozdielu runtime vs permanent.',
body:[
['p','Na RHEL 9 aj 10 je firewall <b>firewalld</b>. Pod ním pracuje jadro cez <b>nftables</b>. Ty s ním hovoríš príkazom <code>firewall-cmd</code> (alebo cez webovú konzolu Cockpit). Predvolene je povolené len SSH, Cockpit a DHCPv6 klient, všetko ostatné prichádzajúce je odmietnuté.'],
['h','Dve konfigurácie: runtime a permanent'],
['table',['','runtime','permanent'],[['kde žije','v pamäti, aktívna teraz','/etc/firewalld/zones/*.xml'],['zmena bez --permanent','áno, hneď','nie'],['zmena s --permanent','nie (kým nedáš --reload)','áno'],['po reštarte / --reload','zabudne sa','načíta sa']]],
['p','Bezpečný postup: <b>pridaj s --permanent, potom --reload</b>. Alternatíva: skús bez --permanent, otestuj, a keď to funguje, <code>--runtime-to-permanent</code>.'],
['warn','Najčastejšia chyba: pravidlo s <code>--permanent</code> a bez <code>--reload</code>. V <code>--list-all</code> ho nevidíš (ukazuje runtime) a služba stále nie je dostupná. Opačná chyba: bez --permanent všetko funguje, po reštarte servera nie.'],
['h','Zóny'],
['p','Zóna je sada pravidiel. Každé rozhranie (alebo zdrojová sieť) patrí práve do jednej zóny. Na serveroch zvyčajne vystačíš s <code>public</code>.'],
['table',['Zóna','Správanie'],[['<code>public</code>','predvolená: povolené len vybrané služby'],['<code>internal</code>, <code>work</code>, <code>home</code>','dôveryhodnejšie, viac služieb'],['<code>trusted</code>','všetko povolené'],['<code>drop</code>','všetko zahodí bez odpovede'],['<code>block</code>','všetko odmietne (ICMP prohibited)'],['<code>dmz</code>','len SSH']]],
['flags','firewall-cmd'],
['h','Základy'],
['cmd','firewall-cmd --state',''],
['cmd','firewall-cmd --get-active-zones',''],
['cmd','firewall-cmd --list-all',''],
['cmd','firewall-cmd --get-services','mená služieb, ktoré pozná'],
['cmd','firewall-cmd --info-service=https','aké porty služba otvára'],
['h','Otvorenie služby a portu'],
['pre','sudo firewall-cmd --permanent --add-service=http\nsudo firewall-cmd --permanent --add-service=https\nsudo firewall-cmd --permanent --add-port=8443/tcp\nsudo firewall-cmd --reload\nsudo firewall-cmd --list-all'],
['explain','firewall-cmd --permanent --zone=public --add-port=8443/tcp'],
['tip','Ak služba existuje v <code>--get-services</code>, používaj meno služby, nie port. Pravidlá sú čitateľnejšie a služba môže otvárať viac portov naraz (dns = 53/tcp aj 53/udp).'],
['h','Prístup len z určitej siete'],
['p','Monitoring smie na port 9100 len zo siete 10.0.30.0/24. Dve cesty:'],
['pre','# 1) rich rule v zóne public\nsudo firewall-cmd --permanent --add-rich-rule=\'rule family="ipv4" source address="10.0.30.0/24" port port="9100" protocol="tcp" accept\'\n\n# 2) zdrojová sieť do vlastnej zóny\nsudo firewall-cmd --permanent --zone=internal --add-source=10.0.30.0/24\nsudo firewall-cmd --permanent --zone=internal --add-port=9100/tcp\n\nsudo firewall-cmd --reload'],
['h','Odstránenie'],
['cmd','sudo firewall-cmd --permanent --remove-service=cockpit',''],
['h','Čo sa deje pod kapotou'],
['cmd','sudo nft list ruleset','pravidlá, ktoré firewalld vygeneroval'],
['p','<code>iptables</code> na RHEL 9 a 10 je len prekladač do nftables a je zastaraný. Nemiešaj ručné pravidlá iptables/nft s firewalld, prepíšu sa navzájom. Ak by firma chcela čisté nftables, firewalld sa vypne a zamaskuje.'],
['h','Kontrolný zoznam pri „port je zavretý“'],
['list',['<code>sudo ss -tlpn | grep :PORT</code>: počúva služba vôbec a na akej adrese?','<code>firewall-cmd --get-active-zones</code>: v ktorej zóne je rozhranie?','<code>firewall-cmd --zone=TÁ_ZÓNA --list-all</code>: je tam služba/port v RUNTIME?','<code>firewall-cmd --permanent --list-all</code>: je to aj v permanent?','Je port aj v SELinux type (<code>semanage port -l</code>)?','Až potom: sieťový firewall medzi tebou a serverom.']],
['new','RHEL 10 odstránil funkciu „lockdown“ vo firewalld. ipset je na RHEL 10 neudržiavaný a jadrové moduly iptables sa presunuli do balíka kernel-modules-extra.']
],
quiz:[
 {q:'Spravil si <code>firewall-cmd --permanent --add-service=http</code>, ale web stále nejde. Čo chýba?',o:['Reštart servera','firewall-cmd --reload','systemctl restart httpd','Nič, trvá to minútu'],a:1,w:'--permanent zapíše len do trvalej konfigurácie.'},
 {q:'Čo spraví <code>--runtime-to-permanent</code>?',o:['Zahodí runtime','Uloží aktuálne bežiace pravidlá ako trvalé','Reštartuje firewalld','Prepne zónu'],a:1,w:'Hodí sa po otestovaní zmien bez --permanent.'},
 {q:'Aký je správny zápis portu?',o:['--add-port=8443','--add-port=tcp/8443','--add-port=8443/tcp','--add-port 8443 tcp'],a:2,w:'Vždy ČÍSLO/protokol.'},
 {q:'Ktorá zóna zahodí všetko bez odpovede?',o:['block','drop','public','dmz'],a:1,w:'block odpovie „prohibited“, drop mlčí.'},
 {q:'Čo používa firewalld na RHEL 9/10 pod sebou?',o:['iptables','nftables','ipfw','ufw'],a:1,w:'FirewallBackend=nftables v /etc/firewalld/firewalld.conf.'}
],
ex:[
 {t:'Povoľ natrvalo službu <code>http</code> a <code>https</code> v predvolenej zóne a aplikuj zmeny.',h:'sudo firewall-cmd --permanent --add-service=http (a https); sudo firewall-cmd --reload',sol:'sudo firewall-cmd --permanent --add-service=http\nsudo firewall-cmd --permanent --add-service=https\nsudo firewall-cmd --reload',check:m=>['http','https'].every(s=>m.fw.runtime.public.services.includes(s) && m.fw.perm.public.services.includes(s))},
 {t:'Otvor natrvalo port pre monitoring <code>8443/tcp</code> (je v poznámkach) a over, že je v runtime.',h:'--permanent --add-port=8443/tcp, --reload, --list-ports',sol:'sudo firewall-cmd --permanent --add-port=8443/tcp\nsudo firewall-cmd --reload\nsudo firewall-cmd --list-ports',check:m=>m.fw.runtime.public.ports.includes('8443/tcp') && m.fw.perm.public.ports.includes('8443/tcp')},
 {t:'Odober natrvalo službu <code>cockpit</code> z verejnej zóny (na serveri ju nepoužívate).',h:'--permanent --remove-service=cockpit, potom --reload',sol:'sudo firewall-cmd --permanent --remove-service=cockpit\nsudo firewall-cmd --reload',check:m=>!m.fw.runtime.public.services.includes('cockpit') && !m.fw.perm.public.services.includes('cockpit')},
 {t:'Povoľ port <code>9100/tcp</code> len zo siete <code>10.0.30.0/24</code> pomocou rich rule, natrvalo.',h:'--permanent --add-rich-rule=\'rule family="ipv4" source address="10.0.30.0/24" port port="9100" protocol="tcp" accept\'',sol:'sudo firewall-cmd --permanent --add-rich-rule=\'rule family="ipv4" source address="10.0.30.0/24" port port="9100" protocol="tcp" accept\'\nsudo firewall-cmd --reload',check:m=>m.fw.perm.public.rich.some(r=>r.includes('10.0.30.0/24') && r.includes('9100')) && m.fw.runtime.public.rich.some(r=>r.includes('9100'))}
]});

/* ---------------- 14 ---------------- */
CH({n:14, title:'SELinux bez strachu', short:'SELinux',
goal:'Pochopiť, prečo SELinux niečo zablokoval, a opraviť to správne (kontext, port, boolean), nie vypnutím.',
body:[
['p','Klasické práva (rwx) hovoria, čo smie <b>používateľ</b>. SELinux navyše hovorí, čo smie <b>proces</b>, aj keď beží ako root. Apache (proces s typom <code>httpd_t</code>) smie čítať súbory s typom <code>httpd_sys_content_t</code>, počúvať na portoch typu <code>http_port_t</code> a nič iné. Ak útočník apache ovládne, nedostane sa k /etc/shadow ani do domovských adresárov.'],
['warn','„Vypni SELinux“ je najhoršia rada z internetu. Vo firmách to zvyčajne porušuje bezpečnostné pravidlá a audit. Skoro každý problém je jeden z troch prípadov nižšie a má jednoriadkové riešenie.'],
['h','Režimy'],
['table',['Režim','Čo robí'],[['<b>Enforcing</b>','blokuje a loguje (predvolené, správne)'],['<b>Permissive</b>','nič neblokuje, len loguje. Na diagnostiku na pár minút'],['<b>Disabled</b>','vypnutý. Na RHEL 9/10 sa robí cez parameter jadra, nie v /etc/selinux/config']]],
['cmd','getenforce',''],
['cmd','sestatus',''],
['p','Test „je to SELinux?“: <code>sudo setenforce 0</code>, skús znova, <code>sudo setenforce 1</code>. Ak v Permissive vec funguje, je to SELinux. Hneď ho vráť.'],
['h','Kontext: štítok na súbore aj procese'],
['cmd','ls -Z /var/www',''],
['cmd','ls -Zd /home/admin',''],
['cmd','ps -eZ | grep httpd','(v simulátore nie je)'],
['p','Kontext má tvar <code>používateľ:rola:<b>typ</b>:úroveň</code>. V praxi ťa zaujíma len <b>typ</b> (končí na <code>_t</code>).'],
['h','Prípad 1: zlý kontext súboru (najčastejšie)'],
['p','Vytvoríš stránku v domove a presunieš ju cez <code>mv</code> do /var/www/html. Súbor si nesie <code>user_home_t</code>. Apache dostane 403 Forbidden, hoci práva sú 644.'],
['pre','ls -Z /var/www/html/index.html\n#   unconfined_u:object_r:user_home_t:s0   ← zlý typ\nsudo restorecon -Rv /var/www/html\n#   Relabeled … to httpd_sys_content_t'],
['flags','restorecon'],
['p','Ak má web ležať inde (napr. <code>/srv/web</code>), najprv povedz politike, aký typ tam patrí, a potom restorecon:'],
['pre','sudo semanage fcontext -a -t httpd_sys_content_t "/srv/web(/.*)?"\nsudo restorecon -Rv /srv/web'],
['warn','<code>chcon</code> zmení kontext len dočasne. Pri ďalšom restorecon alebo relabeli sa vráti. Trvalo = semanage fcontext + restorecon.'],
['h','Prípad 2: neštandardný port'],
['p','Apache má počúvať na 8081. Po reštarte padne: <i>Permission denied: AH00072: make_sock: could not bind to address 0.0.0.0:8081</i>. Port 8081 nie je typu <code>http_port_t</code>. Navyše už v politike má iný typ (<code>transproxy_port_t</code>), preto sa nepridáva cez <code>-a</code>, ale mení cez <code>-m</code>.'],
['pre','sudo semanage port -l | grep -w 8081         # má už nejaký typ?\nsudo semanage port -m -t http_port_t -p tcp 8081   # -m zmení existujúci, -a pridá voľný port\nsudo systemctl restart httpd\n# a nezabudni firewall:\nsudo firewall-cmd --permanent --add-port=8081/tcp && sudo firewall-cmd --reload'],
['p','To isté pre SSH na inom porte: <code>semanage port -a -t ssh_port_t -p tcp 2222</code>.'],
['h','Prípad 3: vypnutý boolean'],
['p','Booleany sú vypínače pripravené v politike. Napríklad apache predvolene nesmie robiť sieťové spojenia (reverzná proxy na backend) ani čítať domovské adresáre.'],
['cmd','getsebool -a | grep httpd',''],
['cmd','sudo setsebool -P httpd_can_network_connect on','-P = natrvalo'],
['flags','setsebool'],
['h','Kde nájdeš dôvod'],
['list',['<code>sudo ausearch -m AVC -ts recent</code>: posledné zamietnutia (AVC = Access Vector Cache)','<code>sudo journalctl -t setroubleshoot</code> alebo <code>sudo sealert -a /var/log/audit/audit.log</code>: ľudsky čitateľné vysvetlenie s návrhom príkazu (balík setroubleshoot-server)','V AVC zázname hľadaj <code>scontext</code> (kto, napr. httpd_t), <code>tcontext</code> (na čo, napr. user_home_t) a <code>tclass</code> (súbor, port)']],
['cmd','sudo ausearch -m AVC',''],
['tip','<code>audit2allow</code> vie z AVC vyrobiť nové pravidlo politiky. Je to posledná možnosť, nie prvá. Takmer vždy stačí restorecon, semanage port alebo boolean.']
],
quiz:[
 {q:'Apache vracia 403, práva súboru sú 644. Čo skontroluješ?',o:['chmod 777','ls -Z na súbore','vypneš SELinux','reštartuješ server'],a:1,w:'Zlý kontext (user_home_t) je najčastejšia príčina.'},
 {q:'Ako natrvalo povolíš apache port 8081?',o:['setsebool httpd_8081 on','semanage port -m -t http_port_t -p tcp 8081','chcon -t http_port_t 8081','firewall-cmd --add-port=8081/tcp'],a:1,w:'8081 už má typ transproxy_port_t, preto -m. Firewall je samostatný krok, SELinux potrebuje semanage port.'},
 {q:'Čo spraví <code>setsebool</code> bez <code>-P</code>?',o:['Nič','Zmenu do reštartu','Trvalú zmenu','Zmaže boolean'],a:1,w:'-P = persistent.'},
 {q:'Prečo je mv do /var/www/html problém a cp nie?',o:['mv mení práva','mv zachová pôvodný SELinux kontext','cp je rýchlejší','mv nefunguje medzi diskami'],a:1,w:'cp vytvorí nový súbor s kontextom cieľového adresára.'},
 {q:'V AVC zázname je <code>tcontext=…user_home_t</code>. Čo to je?',o:['typ procesu','typ cieľového objektu (súboru)','používateľ','port'],a:1,w:'s = source (proces), t = target.'}
],
ex:[
 {t:'Nainštaluj a spusti <code>httpd</code>, presuň <code>~/index.html</code> cez <code>mv</code> do <code>/var/www/html/</code> a over <code>curl localhost</code> (uvidíš 403). Potom oprav SELinux kontext tak, aby curl vrátil stránku.',h:'ls -Z /var/www/html; sudo restorecon -Rv /var/www/html',sol:'sudo dnf install -y httpd\nsudo systemctl enable --now httpd\nsudo mv ~/index.html /var/www/html/\ncurl localhost\nls -Z /var/www/html\nsudo restorecon -Rv /var/www/html\ncurl localhost',check:m=>{const n=m.node('/var/www/html/index.html'); return n && n.ctx==='httpd_sys_content_t' && m.svc.httpd.active && m.ran('curl');}},
 {t:'Nastav apache na port <code>8081</code>: v <code>/etc/httpd/conf/httpd.conf</code> zmeň <code>Listen 80</code> na <code>Listen 8081</code> (vim alebo sed), povoľ port v SELinuxe a reštartuj httpd tak, aby bežal. (httpd a semanage musia byť nainštalované.)',h:'sudo sed -i \'s/^Listen 80$/Listen 8081/\' /etc/httpd/conf/httpd.conf; sudo dnf install -y policycoreutils-python-utils; sudo semanage port -m -t http_port_t -p tcp 8081 (8081 už má typ, preto -m); sudo systemctl restart httpd',sol:'sudo dnf install -y httpd policycoreutils-python-utils\nsudo sed -i \'s/^Listen 80$/Listen 8081/\' /etc/httpd/conf/httpd.conf\nsudo semanage port -m -t http_port_t -p tcp 8081\nsudo systemctl restart httpd',check:m=>m.svc.httpd.active && /^Listen 8081/m.test(m.read('/etc/httpd/conf/httpd.conf')||'') && m.se.extraPorts.some(p=>p.port===8081)},
 {t:'Povoľ apache natrvalo sieťové spojenia (boolean <code>httpd_can_network_connect</code>).',h:'sudo setsebool -P … on',sol:'sudo setsebool -P httpd_can_network_connect on',check:m=>m.se.bools.httpd_can_network_connect && m.se.boolPerm && m.se.boolPerm.httpd_can_network_connect}
]});

/* ---------------- 15 ---------------- */
CH({n:15, title:'Disky, LVM a /etc/fstab', short:'Disky a LVM',
goal:'Pridať nový disk, vytvoriť na ňom LVM a XFS, pripojiť ho natrvalo a zväčšiť existujúci zväzok bez výpadku.',
body:[
['h','Čo je kde'],
['flags','lsblk'],
['cmd','lsblk',''],
['cmd','lsblk -f','so súborovými systémami a UUID'],
['cmd','df -hT',''],
['h','LVM v troch vrstvách'],
['table',['Vrstva','Čo to je','Príkazy'],[['<b>PV</b> physical volume','disk alebo partícia pripravená pre LVM','pvcreate, pvs'],['<b>VG</b> volume group','spoločný „bazén“ miesta z jedného či viacerých PV','vgcreate, vgextend, vgs'],['<b>LV</b> logical volume','„virtuálna partícia“ z bazénu, na nej je súborový systém','lvcreate, lvextend, lvs']]],
['p','Výhoda: keď dôjde miesto, pridáš disk do VG a zväčšíš LV za behu. Na RHEL je systém predvolene na LVM (VG <code>rhel</code>, LV <code>root</code> a <code>swap</code>).'],
['cmd','sudo pvs; sudo vgs; sudo lvs',''],
['h','Nový disk od nuly'],
['pre','lsblk                                   # nový disk: sdb, 10G, bez partícií\nsudo pvcreate /dev/sdb\nsudo vgcreate vgdata /dev/sdb\nsudo lvcreate -n data -L 5G vgdata\nsudo mkfs.xfs /dev/vgdata/data\nsudo mkdir /data\nsudo mount /dev/vgdata/data /data       # dočasne, na test\ndf -h /data'],
['flags','lvcreate'],
['h','/etc/fstab: pripojenie pri štarte'],
['pre','# zariadenie                               bod     typ  možnosti  dump fsck\nUUID=c3b7e2f1-4a5d-4e8c-9b1f-7d2a6e3c8f51 /       xfs  defaults  0 0\n/dev/mapper/vgdata-data                   /data   xfs  defaults  0 0'],
['p','Pri LVM môžeš použiť cestu <code>/dev/mapper/vg-lv</code> (je stabilná). Pri obyčajných diskoch a partíciách vždy <b>UUID</b> z <code>blkid</code>, lebo /dev/sdb sa po pridaní disku môže zmeniť na /dev/sdc.'],
['warn','Chyba vo fstab = server nenaštartuje a skončí v emergency režime. Po každej úprave: <code>sudo mount -a</code> (pripojí, čo chýba, a ohlási chyby) a <code>sudo findmnt --verify</code>. Až keď prejdú, môžeš reštartovať. Pri sieťových diskoch pridaj možnosť <code>nofail</code>.'],
['cmd','sudo blkid',''],
['flags','mount'],
['h','Zväčšenie bez výpadku'],
['flags','lvextend'],
['pre','sudo vgs                                  # je vo VG voľné miesto?\nsudo lvextend -r -L +5G /dev/rhel/root    # -r zväčší rovno aj XFS\ndf -h /'],
['p','Ak vo VG nie je miesto: pridaj disk (<code>pvcreate /dev/sdc</code>, <code>vgextend rhel /dev/sdc</code>) a potom lvextend.'],
['warn','XFS sa nedá zmenšiť, len zväčšiť. Pri plánovaní radšej začni menším LV a zväčšuj podľa potreby.'],
['h','Swap'],
['cmd','swapon --show',''],
['p','Nový swap: <code>lvcreate -n swap2 -L 2G rhel</code>, <code>mkswap /dev/rhel/swap2</code>, do fstab <code>/dev/rhel/swap2 none swap defaults 0 0</code>, <code>swapon -a</code>.'],
['tip','Stratis (<code>stratis-cli</code>) a VDO sú v RHEL tiež, ale bežná prax v podnikoch je stále LVM + XFS.']
],
quiz:[
 {q:'V akom poradí vytvoríš LVM na novom disku?',o:['LV → VG → PV','PV → VG → LV','VG → PV → LV','mkfs → PV → LV'],a:1,w:'Najprv pripravíš disk (PV), dáš ho do bazénu (VG), z neho vyrežeš LV.'},
 {q:'Čo spraví <code>-r</code> v <code>lvextend -r -L +5G</code>?',o:['read-only','zväčší aj súborový systém','rekurzívne','reštartuje'],a:1,w:'Inak treba xfs_growfs.'},
 {q:'Čo spravíš hneď po úprave /etc/fstab?',o:['reboot','mount -a (a findmnt --verify)','systemctl restart fstab','nič'],a:1,w:'Chyba vo fstab = server nenaštartuje.'},
 {q:'Prečo v fstab pri obyčajných diskoch používať UUID?',o:['Je kratší','Meno /dev/sdX sa môže zmeniť','UUID je rýchlejší','XFS to vyžaduje'],a:1,w:'Poradie diskov pri štarte nie je zaručené.'},
 {q:'Dá sa XFS zmenšiť?',o:['Áno, xfs_shrink','Áno, lvreduce -r','Nie','Len offline'],a:2,w:'XFS sa dá len zväčšiť.'}
],
ex:[
 {t:'Na disku <code>/dev/sdb</code> vytvor PV, VG <code>vgdata</code> a LV <code>data</code> s veľkosťou 5G.',h:'pvcreate, vgcreate vgdata /dev/sdb, lvcreate -n data -L 5G vgdata',sol:'sudo pvcreate /dev/sdb\nsudo vgcreate vgdata /dev/sdb\nsudo lvcreate -n data -L 5G vgdata',check:m=>!!m.lvm.lvs['vgdata/data']},
 {t:'Na LV vytvor XFS, vytvor adresár <code>/data</code> a pripoj ho natrvalo cez <code>/etc/fstab</code>. Over to cez <code>mount -a</code>.',h:'mkfs.xfs /dev/vgdata/data; mkdir /data; echo "/dev/mapper/vgdata-data /data xfs defaults 0 0" | sudo tee -a /etc/fstab; sudo mount -a',sol:'sudo mkfs.xfs /dev/vgdata/data\nsudo mkdir /data\necho "/dev/mapper/vgdata-data /data xfs defaults 0 0" | sudo tee -a /etc/fstab\nsudo mount -a\ndf -h /data',check:m=>m.mounts.some(x=>x.dir==='/data') && /\s\/data\s+xfs/.test(m.read('/etc/fstab')||'') && m.ran('mount',e=>e.flags.has('a'))},
 {t:'Zväčši koreňový zväzok <code>/dev/rhel/root</code> o 5G vrátane súborového systému.',h:'sudo lvextend -r -L +5G /dev/rhel/root',sol:'sudo lvextend -r -L +5G /dev/rhel/root\ndf -h /',check:m=>m.lvm.lvs['rhel/root'].size>=35 && m.lvm.lvs['rhel/root'].grown}
]});

/* ---------------- 16 ---------------- */
CH({n:16, title:'SSH, kľúče a prenos súborov', short:'SSH a archívy',
goal:'Prihlasovať sa kľúčom, zabezpečiť sshd, kopírovať súbory medzi servermi a robiť zálohy cez tar.',
body:[
['h','Kľúče namiesto hesiel'],
['flags','ssh-keygen'],
['pre','ssh-keygen -t ed25519 -C "admin@firma.sk"   # na TVOJOM počítači\nssh-copy-id admin@db01                    # verejný kľúč na server\nssh admin@db01                            # už bez hesla'],
['p','Súkromný kľúč (<code>~/.ssh/id_ed25519</code>) nikdy neopúšťa tvoj počítač a musí mať práva 600. Verejný (<code>.pub</code>) sa pridáva na servery do <code>~/.ssh/authorized_keys</code> (práva 600, adresár .ssh 700).'],
['flags','ssh'],
['h','Zabezpečenie sshd'],
['p','Na RHEL 9/10 sa hlavný <code>/etc/ssh/sshd_config</code> nemení. Vlastné nastavenia daj do súboru v <code>/etc/ssh/sshd_config.d/</code>. Súbory sa načítajú podľa abecedy a <b>platí prvý výskyt</b>, preto sa im dávajú nízke čísla:'],
['pre','# /etc/ssh/sshd_config.d/00-firma.conf\nPermitRootLogin no\nPasswordAuthentication no\nMaxAuthTries 3\nAllowGroups wheel sshusers'],
['pre','sudo sshd -t                           # test syntaxe\nsudo sshd -T | grep -i permitroot      # čo naozaj platí po zlúčení všetkých súborov\nsudo systemctl reload sshd             # reload nezhodí existujúce spojenia'],
['warn','Ak bolo pri inštalácii zaškrtnuté „Allow root SSH login with password“, inštalátor vytvorí <code>/etc/ssh/sshd_config.d/01-permitrootlogin.conf</code> s <code>PermitRootLogin yes</code>. Ten má prednosť pred súborom 10-…, preto vlastný súbor pomenuj <code>00-…</code> a výsledok over cez <code>sshd -T</code>.'],
['warn','Pred <code>PasswordAuthentication no</code> si over, že sa kľúčom naozaj prihlásiš, v NOVOM okne. Staré okno nechaj otvorené, kým to nemáš overené.'],
['h','Kopírovanie'],
['flags','scp'],
['flags','rsync'],
['cmd','rsync -avzn /etc/ admin@backup01:/zaloha/web01/etc/','-n = len ukáž, čo by spravil'],
['h','tar: zálohy a archívy'],
['flags','tar'],
['explain','tar -czvf /tmp/etc-zaloha.tar.gz /etc'],
['cmd','tar -czvf /tmp/skripty.tar.gz skripty',''],
['cmd','tar -tzvf /tmp/skripty.tar.gz','čo je vo vnútri'],
['cmd','mkdir /tmp/obnova && tar -xzvf /tmp/skripty.tar.gz -C /tmp/obnova',''],
['tip','Pomôcka na písmená: <b>c</b>reate, e<b>x</b>tract, lis<b>t</b>; <b>z</b> = gzip; <b>v</b>erbose; <b>f</b> = file, vždy posledné.'],
['new','RHEL 10 obsahuje OpenSSH 9.9 (RHEL 9 má 8.7). Klientsky aj serverovo to v bežnej praxi vyzerá rovnako, ale zmenili sa niektoré predvolené algoritmy a prísnejšie sa kontrolujú práva súborov s kľúčmi. Na RHEL 9 aj 10 <code>scp</code> interne používa protokol SFTP.']
],
quiz:[
 {q:'Aké práva musí mať súkromný SSH kľúč?',o:['644','600','755','777'],a:1,w:'ssh odmietne kľúč, ktorý môžu čítať iní.'},
 {q:'Kam na RHEL 9/10 dáš vlastné nastavenie sshd?',o:['priamo do sshd_config','/etc/ssh/sshd_config.d/10-meno.conf','/opt/ssh','~/.ssh/config'],a:1,w:'Platí prvý výskyt, preto nízke číslo.'},
 {q:'Čo znamená <code>x</code> v <code>tar -xzvf</code>?',o:['extract','exclude','xz kompresia','execute'],a:0,w:'xz je veľké J.'},
 {q:'Ktorý príkaz skopíruje verejný kľúč na server?',o:['scp ~/.ssh/id_ed25519 server:','ssh-copy-id user@server','ssh-keygen -c server','ssh --key server'],a:1,w:'ssh-copy-id ho pridá do authorized_keys so správnymi právami.'}
],
ex:[
 {t:'Vygeneruj si SSH kľúč typu ed25519.',h:'ssh-keygen -t ed25519',sol:'ssh-keygen -t ed25519',check:m=>m.exists('/home/admin/.ssh/id_ed25519.pub')},
 {t:'Skopíruj verejný kľúč na server <code>admin@db01</code>.',h:'ssh-copy-id admin@db01',sol:'ssh-copy-id admin@db01',check:m=>!!m.copiedKey},
 {t:'Zbal adresár <code>~/skripty</code> do archívu <code>/tmp/skripty.tar.gz</code> (gzip) a potom vypíš jeho obsah.',h:'tar -czvf … ; tar -tzvf …',sol:'tar -czvf /tmp/skripty.tar.gz skripty\ntar -tzvf /tmp/skripty.tar.gz',check:m=>m.exists('/tmp/skripty.tar.gz') && m.ran('tar',e=>e.flags.has('t'))}
]});

/* ---------------- 17 ---------------- */
CH({n:17, title:'Logy, plánovanie a riešenie problémov', short:'Logy a cron',
goal:'Nastaviť pravidelnú úlohu, vedieť kde hľadať logy a mať postup, ako riešiť incident krok za krokom.',
body:[
['h','Kde sú logy'],
['table',['Súbor / príkaz','Čo tam je'],[['<code>journalctl</code>','všetko zo systemd: služby, jadro, boot'],['<code>/var/log/messages</code>','všeobecné systémové správy'],['<code>/var/log/secure</code>','SSH, sudo, su, PAM'],['<code>/var/log/audit/audit.log</code>','audit, SELinux AVC'],['<code>/var/log/cron</code>','spustenia cron úloh'],['<code>/var/log/dnf.log</code>','inštalácie balíkov'],['<code>/var/log/httpd/</code>, <code>/var/log/nginx/</code>','webové servery: access_log, error_log'],['<code>/var/log/boot.log</code>','výstup pri štarte'],['<code>/opt/*/log</code>','aplikácie tretích strán (zistí sa z ich konfigurácie)']]],
['p','Rotáciu (aby logy nezaplnili disk) robí <code>logrotate</code> podľa <code>/etc/logrotate.conf</code> a <code>/etc/logrotate.d/</code>.'],
['cmd','sudo grep "Failed password" /var/log/secure',''],
['h','cron'],
['pre','┌───────── minúta (0–59)\n│ ┌─────── hodina (0–23)\n│ │ ┌───── deň v mesiaci (1–31)\n│ │ │ ┌─── mesiac (1–12)\n│ │ │ │ ┌─ deň v týždni (0–7, 0 aj 7 = nedeľa)\n│ │ │ │ │\n30 2 * * * /home/admin/skripty/zaloha.sh'],
['table',['Zápis','Kedy'],[['<code>30 2 * * *</code>','každý deň o 2:30'],['<code>*/15 * * * *</code>','každých 15 minút'],['<code>0 6 * * 1-5</code>','pracovné dni o 6:00'],['<code>0 0 1 * *</code>','prvý deň v mesiaci o polnoci'],['<code>@reboot</code>','po štarte']]],
['flags','crontab'],
['p','Úlohy používateľov: <code>crontab -e</code>. Systémové úlohy: súbor v <code>/etc/cron.d/</code> (tam je navyše stĺpec s používateľom). Hotové adresáre: <code>/etc/cron.daily/</code>, <code>cron.weekly</code>… stačí tam dať spustiteľný skript.'],
['tip','V crone nie je tvoje prostredie: používaj úplné cesty a výstup presmeruj, napr. <code>… >> /var/log/zaloha.log 2>&1</code>.'],
['h','systemd timery'],
['p','Modernejšia alternatíva cronu: logy idú do journalu a <code>systemctl list-timers</code> ukáže, kedy úloha bežala a kedy pobeží.'],
['pre','# /etc/systemd/system/zaloha.service\n[Service]\nType=oneshot\nExecStart=/usr/local/bin/zaloha.sh\n\n# /etc/systemd/system/zaloha.timer\n[Timer]\nOnCalendar=*-*-* 02:30:00\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n\n# sudo systemctl daemon-reload && sudo systemctl enable --now zaloha.timer'],
['h','Čas'],
['cmd','timedatectl',''],
['cmd','chronyc sources','s ktorými NTP servermi sa synchronizuje'],
['p','Nesprávny čas rozbije Kerberos/AD prihlásenie, TLS certifikáty a poradie logov. Na RHEL ho rieši <code>chronyd</code> s konfiguráciou v <code>/etc/chrony.conf</code>.'],
['h','Postup pri incidente'],
['list',['<b>Čo presne nefunguje a odkedy?</b> Zmenilo sa niečo? (<code>dnf history</code>, <code>last</code>, <code>journalctl --since</code>)','<b>Zdroje:</b> <code>uptime</code>, <code>free -h</code>, <code>df -h</code>, <code>top</code>','<b>Služba:</b> <code>systemctl status</code>, <code>journalctl -xeu</code>','<b>Sieť:</b> <code>ss -tulpn</code>, <code>ping</code>, <code>curl</code>, <code>firewall-cmd --list-all</code>','<b>Práva a SELinux:</b> <code>ls -lZ</code>, <code>ausearch -m AVC -ts recent</code>','<b>Zapíš si</b>, čo si zistil a zmenil. Do tiketu, nie do hlavy.','Ak treba Red Hat podporu: <code>sudo sos report</code> a súbor priložíš k prípadu.']]
],
quiz:[
 {q:'Čo znamená <code>*/10 * * * *</code>?',o:['o 10:00','každých 10 minút','10. deň','10× za hodinu presne o :10'],a:1,w:'*/N = každých N jednotiek.'},
 {q:'Kde nájdeš pokusy o prihlásenie cez SSH?',o:['/var/log/messages','/var/log/secure','/var/log/sshd','/etc/ssh/log'],a:1,w:'Aj journalctl -u sshd.'},
 {q:'Prečo v crone používať úplné cesty?',o:['Cron nemá rovnaké prostredie (PATH) ako tvoj shell','Je to rýchlejšie','Cron nepozná ~','Kvôli SELinuxu'],a:0,w:'PATH v crone je minimálny.'},
 {q:'Čo pošleš podpore Red Hat k tiketu?',o:['/var/log/messages','sos report','dmesg','celý /etc'],a:1,w:'sos zozbiera konfiguráciu a logy naraz.'}
],
ex:[
 {t:'Nájdi v <code>/var/log/secure</code> neúspešné pokusy o prihlásenie a spočítaj ich.',h:'sudo grep "Failed password" /var/log/secure | wc -l',sol:'sudo grep "Failed password" /var/log/secure | wc -l',check:m=>m.ran('wc',e=>e.flags.has('l')) && m.ran('grep',e=>e.args.some(a=>/Failed/.test(a)))},
 {t:'Over synchronizáciu času: zobraz stav cez timedatectl a zdroje NTP cez chronyc.',h:'timedatectl; chronyc sources',sol:'timedatectl\nchronyc sources',check:m=>m.ran('timedatectl') && m.ran('chronyc')},
 {t:'Zobraz všetky chyby (priorita err a horšia) zo systémového žurnálu od posledného štartu.',h:'journalctl -p err -b',sol:'journalctl -p err -b',check:m=>m.ran('journalctl',e=>e.flags.has('p')&&e.flags.has('b'))}
]});

/* ---------------- 24 ---------------- */
CH({n:24, title:'RHEL 9 a RHEL 10: čo sa zmenilo', short:'RHEL 9 vs 10',
goal:'Vedieť, na čo si dať pozor, keď prechádzaš medzi RHEL 9 a 10, a čo je na desiatke nové.',
body:[
['p','Vo firmách budeš mať nejaký čas oba systémy naraz. Väčšina príkazov z tejto stránky funguje rovnako. Rozdiely sú hlavne pod povrchom a pri veciach, ktoré boli dlho označené ako zastarané. V termináli kapitol si môžeš prepnúť verziu (RHEL 9 / RHEL 10) a porovnať napríklad <code>uname -r</code>, <code>cat /etc/os-release</code> alebo <code>ls /etc/sysconfig</code>.'],
['table',['Oblasť','RHEL 9','RHEL 10'],[
 ['jadro','5.14','6.12'],
 ['kódové meno (10.0 / 9.6)','Plow','Coughlan'],
 ['grafika','GNOME, Wayland predvolene, Xorg server ešte k dispozícii','len Wayland, Xorg server odstránený'],
 ['vzdialená plocha','VNC (TigerVNC)','RDP (GNOME Remote Desktop), VNC server odstránený'],
 ['sieťové profily','keyfile predvolene, staré ifcfg ešte fungujú','len keyfile, podpora ifcfg odstránená'],
 ['DHCP klient','interný NetworkManager, dhclient ešte dostupný','dhclient odstránený'],
 ['spájanie liniek','team aj bond','teamd odstránený, používa sa bond'],
 ['DHCP server','ISC DHCP (dhcpd)','Kea'],
 ['firewall','firewalld + nftables','firewalld + nftables, funkcia lockdown odstránená'],
 ['moduly dnf','používajú sa (dnf module)','zastarané, verzie ako bežné balíky'],
 ['OpenSSH','8.7','9.9'],
 ['AI asistent v termináli','na novších 9.x ako doplnok','RHEL Lightspeed: balík command-line-assistant, príkaz <code>c</code>'],
 ['image mode','od 9.6 (predtým technology preview)','áno: OS ako bootc kontajnerový obraz'],
 ['nový používateľ v inštalátore','admin práva predvolene vypnuté','admin (wheel) predvolene zapnuté'],
 ['FTP (vsftpd, ftp, lftp)','podporované','zastarané']]],
['h','Čo to znamená pre teba v praxi'],
['list',[
 'Ak máš skripty, ktoré zapisujú do <code>/etc/sysconfig/network-scripts/ifcfg-*</code>, na RHEL 10 prestanú fungovať. Prepíš ich na <code>nmcli</code> alebo Ansible rolu network.',
 'Ak niekde voláš <code>dhclient</code> alebo konfiguruješ teaming, na 10 treba bond a NetworkManager.',
 'Xorg server a VNC server na RHEL 10 nie sú: GUI beží na Waylande a vzdialená plocha cez RDP. Servery aj tak spravuješ cez SSH a Cockpit.',
 '<code>dnf module …</code> v skriptoch na 10 vypíše varovanie o zastaraní.',
 'Firewall, SELinux, systemd, LVM, dnf, používatelia: rovnaké príkazy.']],
['h','Image mode (RHEL 10 a 9.6+)'],
['p','Systém sa dá zostaviť ako kontajnerový obraz (Containerfile) a nasadiť cez <code>bootc</code>. Systémové súbory sú za behu len na čítanie, zmena = nový obraz + reštart. Cieľ: všetky servery rovnaké, bez „konfiguračného driftu“. Klasická inštalácia (package mode) zostáva a je bežnejšia.'],
['h','Lightspeed: AI asistent v termináli'],
['pre','sudo dnf install command-line-assistant\nc "ako otvorím port 8443 vo firewalld natrvalo"'],
['p','Odpovede over rovnako, ako by si overil radu kolegu: prečítaj si príkaz, pochop prepínače (na to máš túto stránku) a až potom ho spusti.'],
['h','Životný cyklus'],
['p','RHEL 9 je vo fáze plnej podpory do 31. mája 2027, potom prechádza do údržbovej fázy (len bezpečnostné a kritické opravy) do roku 2032. RHEL 10 je aktuálna hlavná verzia. Prechod 9 → 10 sa robí nástrojom <b>Leapp</b> (in-place upgrade) alebo novou inštaláciou.'],
['h','Kde si to overíš'],
['src',[
 ['Considerations in adopting RHEL 10 (Red Hat dokumentácia)','https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html-single/considerations_in_adopting_rhel_10'],
 ['RHEL 10: zmeny v sieťovaní','https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/considerations_in_adopting_rhel_10/networking'],
 ['RHEL 10.2 release notes: deprecated features','https://docs.redhat.com/en/documentation/Red_Hat_Enterprise_Linux/10/html/10.2_release_notes/deprecated-features'],
 ['Red Hat Enterprise Linux 10 released (linuxiac)','https://linuxiac.com/red-hat-enterprise-linux-10-released/'],
 ['RHEL 10 new features (computingforgeeks)','https://computingforgeeks.com/rhel-10-new-features-ai-powered-enterprise-os/']]]
],
quiz:[
 {q:'Ktoré jadro má RHEL 10?',o:['5.14','6.1','6.12','7.0'],a:2,w:'RHEL 9 zostáva na 5.14.'},
 {q:'Skript zapisuje do /etc/sysconfig/network-scripts/ifcfg-ens192. Čo sa stane na RHEL 10?',o:['Funguje','Formát ifcfg už nie je podporovaný','Prevedie sa automaticky','Funguje len s dhclient'],a:1,w:'Treba nmcli alebo keyfile.'},
 {q:'Čím je na RHEL 10 nahradené VNC pre vzdialenú plochu?',o:['X2Go','RDP','SPICE','TeamViewer'],a:1,w:'Súvisí s odstránením Xorg servera.'},
 {q:'Čo je image mode?',o:['Režim bez GUI','OS dodávaný a aktualizovaný ako bootc kontajnerový obraz','Záloha disku','Obraz pre Docker Hub'],a:1,w:'Systém je za behu nemenný, zmena = nový obraz.'},
 {q:'Platia príkazy firewall-cmd a semanage z tejto stránky aj na RHEL 10?',o:['Nie, všetko sa zmenilo','Áno','Len firewall-cmd','Len so setenforce 0'],a:1,w:'Administrácia firewallu, SELinuxu, systemd a LVM je rovnaká.'}
],
ex:[
 {t:'Prepni terminál na <b>RHEL 10</b> (prepínač nad terminálom) a zisti verziu jadra a obsah <code>/etc/os-release</code>.',h:'Po prepnutí: uname -r; cat /etc/os-release',sol:'uname -r\ncat /etc/os-release',check:m=>m.ver===10 && m.ran('uname',e=>e.flags.has('r')) && m.ran('cat',e=>e.args.some(a=>a.includes('os-release')))},
 {t:'Na RHEL 10 over, že adresár <code>/etc/sysconfig/network-scripts</code> neexistuje a sieťové profily sú v NetworkManageri.',h:'ls /etc/sysconfig/network-scripts; ls /etc/NetworkManager/system-connections',sol:'ls /etc/sysconfig/network-scripts\nsudo ls /etc/NetworkManager/system-connections',check:m=>m.ver===10 && m.ran('ls',e=>e.args.some(a=>a.includes('network-scripts'))) && m.ran('ls',e=>e.args.some(a=>a.includes('system-connections')))}
]});
})();
