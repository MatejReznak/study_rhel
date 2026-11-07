/* =========================================================
   KAPITOLA 25: Sieť do hĺbky (iproute2, nmcli, trasy, diagnostika)
   + príkazy do Rozlúštiť, dril, úlohy na serveri, postup
   ========================================================= */
(function(){
window.CHAPTERS = window.CHAPTERS || []; window.DRILL = window.DRILL || []; window.LAB_TASKS = window.LAB_TASKS || {}; window.RUNBOOKS = window.RUNBOOKS || []; window.CMDREF = window.CMDREF || {ip:{f:[]}, nmcli:{f:[]}};
const CH = c => window.CHAPTERS.push(c);
const L = (m,n)=>m.log.filter(e=>e.name===n);
const ran = (m,n,pred)=>L(m,n).some(e=>e.code===0 && (!pred||pred(e)));
const arg = (e,re)=>e.args.some(a=>re.test(a));
const prof = (m, dev)=>Object.values((m.nx||{}).prof||{}).find(p=>p.dev===dev);
const hasRt = (m, dst, via)=>m._nxState().routes.some(r=>r.dst===dst && (!via || r.via===via));
const rtAddr = (m, dev, cidr)=>m._nxState().addrs.some(a=>a.dev===dev && a.cidr===cidr);
const asRoot = (m,cmds)=>{ const p=m.user; m.user='root'; try { cmds.forEach(c=>m.run(' '+c)); } finally { m.user=p; } };
const BK = 'sudo nmcli con add type ethernet con-name backup ifname ens224 ipv4.method manual ipv4.addresses 10.0.30.31/24';

CH({n:25, title:'Sieť do hĺbky: ip, nmcli, trasy a diagnostika', short:'Sieť do hĺbky',
goal:'Rozumieť rozdielu medzi dočasnou zmenou (ip) a trvalou (nmcli) rovnako ako pri firewalle, nastaviť druhú sieťovku, statickú trasu, viac IP adries a sieťový problém nájsť postupom zdola nahor.',
body:[
['p','Kapitola 12 ti ukázala, kde v sieti si (<code>ip a</code>, <code>ip r</code>, <code>ss -tulpn</code>). Táto kapitola je o <b>nastavovaní</b> siete na serveri tak, ako to v práci reálne robíš: druhá sieťová karta do zálohovej siete, statická trasa, ďalšia IP adresa a hľadanie, prečo „to nejde“.'],
['h','Dve vrstvy ako pri firewalle'],
['p','Sieť má rovnaký princíp ako firewall: <b>aktuálny stav</b> (čo jadro práve používa) a <b>trvalú konfiguráciu</b> (čo sa nastaví pri štarte). Kto toto pochopí, nerobí najčastejšiu chybu: „fungovalo to, po reštarte nie“.'],
['table',['','Firewall','Sieť'],[
 ['Aktuálne, len do reštartu','<code>firewall-cmd --add-…</code>','<code>ip addr add</code>, <code>ip route add</code>, <code>ip link set</code>'],
 ['Trvalo (súbor na disku)','<code>firewall-cmd --permanent …</code>','<code>nmcli con mod PROFIL …</code> (súbor v <code>/etc/NetworkManager/system-connections/</code>)'],
 ['Načítaj trvalé do aktuálneho','<code>firewall-cmd --reload</code>','<code>nmcli con up PROFIL</code>'],
 ['Pozri aktuálny stav','<code>firewall-cmd --list-all</code>','<code>ip -br a</code>, <code>ip r</code>'],
 ['Pozri trvalú konfiguráciu','<code>--permanent --list-all</code>','<code>nmcli con show PROFIL</code>']]],
['warn','<code>nmcli con up</code> zahodí zmeny, ktoré si na tom rozhraní spravil cez <code>ip</code>. Rovnako ako <code>firewall-cmd --reload</code> zahodí pravidlá bez <code>--permanent</code>.'],

['h','ip (balík iproute): čítanie'],
['p','Príkaz <code>ip</code> má objekty (address, link, route, neigh) a každý sa dá skrátiť: <code>ip a</code>, <code>ip l</code>, <code>ip r</code>, <code>ip n</code>. Prepínače idú <b>pred</b> objekt.'],
['flags','ip'],
['cmd','ip -br a','stručne: rozhranie, stav, adresy'],
['cmd','ip -br link','stav linky (UP/DOWN) a MAC adresy'],
['cmd','ip -4 a show ens192','len IPv4 jedného rozhrania'],
['cmd','ip -s link show ens192','štatistiky: chyby (errors) a zahodené pakety (dropped)'],
['cmd','ip r','smerovacia tabuľka'],
['cmd','ip route get 10.0.40.10','ktorou cestou (rozhranie, brána, zdrojová IP) by išiel paket na túto adresu'],
['cmd','ip neigh','ARP: MAC adresy susedov (brána musí byť REACHABLE alebo STALE, nie FAILED)'],
['out','ip r','default via 10.0.20.1 dev ens192 proto static metric 100\n10.0.20.0/24 dev ens192 proto kernel scope link src 10.0.20.31 metric 100'],
['table',['Riadok','Znamená'],[['<code>default via 10.0.20.1</code>','všetko, čo nepozná inak, pošle na bránu 10.0.20.1'],['<code>10.0.20.0/24 dev ens192 … kernel</code>','sieť je priamo pripojená (jadro ju pridalo samo z IP adresy)'],['<code>10.0.40.0/24 via 10.0.30.1</code>','statická trasa: do siete 10.0.40.x cez router 10.0.30.1'],['<code>metric</code>','pri dvoch rovnakých trasách vyhrá nižšia'],['<code>proto static / kernel / boot</code>','kto trasu pridal: NetworkManager / jadro / ručne cez ip']]],
['tip','<code>ip route get IP</code> je najrýchlejšia odpoveď na otázku „prečo to ide cez zlé rozhranie?“. Ukáže presne trasu, ktorú by jadro použilo.'],

['h','ip: dočasné zmeny (na skúšku)'],
['p','Hodia sa na rýchly test bez zásahu do konfigurácie. Po reštarte (a po <code>nmcli con up</code>) zmiznú.'],
['cmd','sudo ip addr add 10.0.20.99/24 dev ens192','pridaj ďalšiu IP dočasne'],
['cmd','sudo ip addr del 10.0.20.99/24 dev ens192','odober ju'],
['cmd','sudo ip route add 10.0.40.0/24 via 10.0.30.1','dočasná trasa (brána musí byť v pripojenej sieti)'],
['cmd','sudo ip route del 10.0.40.0/24','odober trasu'],
['cmd','sudo ip link set ens224 down','vypni rozhranie (na ens192 cez SSH nikdy!)'],
['out','sudo ip route add 10.0.60.0/24 via 10.0.99.1','Error: Nexthop has invalid gateway.'],
['p','Táto chyba znamená, že brána nie je v žiadnej sieti, ktorú server priamo vidí. Najprv musí mať IP v sieti brány.'],

['h','NetworkManager: profily a súbory'],
['p','Trvalá konfigurácia je v <b>profiloch</b> (connections). Profil patrí k rozhraniu, môže byť aktívny alebo nie. Na RHEL 9 a 10 sú uložené ako súbory <code>/etc/NetworkManager/system-connections/MENO.nmconnection</code> (formát keyfile, práva 600). Na RHEL 10 je to jediný podporovaný formát.'],
['flags','nmcli'],
['cmd','nmcli dev status','rozhrania a profil, ktorý na nich beží (disconnected = bez profilu)'],
['cmd','nmcli con show','všetky profily; --active len aktívne'],
['cmd','nmcli con show ens192 | grep ipv4','nastavenia profilu (trvalé)'],
['cmd','sudo cat /etc/NetworkManager/system-connections/ens192.nmconnection','ten istý profil ako súbor'],
['p','Ak súbor upravíš ručne vo vime, NetworkManager ho nevidí, kým nespravíš <code>sudo nmcli con reload</code> a potom <code>nmcli con up</code>. Bezpečnejšie je meniť profily cez <code>nmcli con mod</code>.'],

['h','Druhá sieťovka: nový profil'],
['p','Typická úloha: server dostal druhú sieťovú kartu <code>ens224</code> do zálohovej siete <code>10.0.30.0/24</code>. Dostaneš IP <code>10.0.30.31/24</code>. <b>Bránu nenastavuješ</b>: predvolená brána má byť len jedna (na hlavnej sieti).'],
['pre','# 1. nájdi novú sieťovku\nnmcli dev status                 # ens224  disconnected\nip -br link\n\n# 2. vytvor profil (bez brány)\nsudo nmcli con add type ethernet con-name backup ifname ens224 \\\n     ipv4.method manual ipv4.addresses 10.0.30.31/24\n\n# 3. over\nnmcli con show --active\nip -br a\nping -c 2 10.0.30.60              # zálohový server'],
['warn','Ak druhému profilu dáš aj <code>ipv4.gateway</code>, server bude mať dve predvolené trasy a časť prevádzky odíde zlou sieťovkou. Keď brána nevyhnutne treba, pridaj <code>ipv4.never-default yes</code>.'],

['h','Statická trasa'],
['p','Do siete úložiska <code>10.0.40.0/24</code> (NAS) sa dostaneš len cez router zálohovej siete <code>10.0.30.1</code>. Bez trasy idú pakety na predvolenú bránu a tá túto sieť nepozná: ping hlási 100 % stratu bez odpovede.'],
['pre','ip route get 10.0.40.10             # zlé: via 10.0.20.1 dev ens192\n\n# trvalo do profilu backup\nsudo nmcli con mod backup +ipv4.routes "10.0.40.0/24 10.0.30.1"\nsudo nmcli con up backup             # aplikuj\n\nip route get 10.0.40.10             # dobre: via 10.0.30.1 dev ens224\nping -c 2 10.0.40.10\ntracepath 10.0.40.10'],
['p','Znamienko <code>+</code> pridáva do zoznamu, <code>-</code> odoberá, bez znamienka nahradíš celý zoznam. Platí pre <code>ipv4.addresses</code>, <code>ipv4.routes</code>, <code>ipv4.dns</code> a <code>ipv4.dns-search</code>.'],

['h','Viac IP adries na jednom rozhraní'],
['pre','sudo nmcli con mod ens192 +ipv4.addresses 10.0.20.36/24\nsudo nmcli con up ens192           # cez SSH: krátke preblikanie\nip -br a\n\n# odobratie\nsudo nmcli con mod ens192 -ipv4.addresses 10.0.20.36/24\nsudo nmcli con up ens192'],
['p','Používa sa napríklad pre ďalšiu webovú stránku s vlastnou IP alebo pri presune služby z iného servera.'],

['h','DNS v profile'],
['cmd','sudo nmcli con mod ens192 ipv4.dns "10.0.20.2 10.0.20.3"','dva DNS servery (záložný)'],
['cmd','sudo nmcli con mod ens192 ipv4.dns-search firma.local','krátke mená (db01) sa doplnia na db01.firma.local'],
['cmd','sudo nmcli con mod ens192 ipv4.ignore-auto-dns yes','pri DHCP ignoruj DNS z DHCP servera'],
['p','<code>/etc/resolv.conf</code> generuje NetworkManager. Ručná úprava sa pri ďalšom <code>con up</code> alebo reštarte prepíše.'],

['h','Bonding a VLAN (prehľad)'],
['p','Na fyzických serveroch sa dve sieťovky často spájajú do <b>bondu</b> (výpadok kábla nevadí) a na jednej linke beží viac <b>VLAN</b>. V simulátore to nie je, vyskúšaš to na skutočnom serveri:'],
['pre','# bond v režime active-backup z ens224 a ens256\nsudo nmcli con add type bond con-name bond0 ifname bond0 bond.options "mode=active-backup,miimon=100" \\\n     ipv4.method manual ipv4.addresses 10.0.30.31/24\nsudo nmcli con add type ethernet con-name bond0-p1 ifname ens224 master bond0\nsudo nmcli con add type ethernet con-name bond0-p2 ifname ens256 master bond0\ncat /proc/net/bonding/bond0\n\n# VLAN 100 na ens192\nsudo nmcli con add type vlan con-name vlan100 dev ens192 id 100 \\\n     ipv4.method manual ipv4.addresses 192.168.100.31/24'],

['h','Diagnostika zdola nahor'],
['p','Keď „sieť nejde“, nehádaj. Choď po vrstvách zdola a pri prvom zlyhaní sa zastav: tam je problém.'],
['table',['#','Otázka','Príkaz','Zlé znamená'],[
 ['1','Je linka hore?','<code>ip -br link</code>, <code>ethtool ens192</code>','DOWN, Link detected: no (kábel, vSphere, switch)'],
 ['2','Má rozhranie IP?','<code>ip -br a</code>','chýba IP: profil nie je aktívny (<code>nmcli con up</code>)'],
 ['3','Kadiaľ pôjde paket?','<code>ip route get CIEĽ</code>','zlé rozhranie alebo brána: chýba trasa'],
 ['4','Odpovedá brána?','<code>ping -c 2 BRÁNA</code>, <code>ip neigh</code>','FAILED v ip neigh: L2 problém, zlá VLAN'],
 ['5','Kde sa cesta končí?','<code>tracepath CIEĽ</code>','posledný odpovedajúci skok = miesto problému'],
 ['6','Funguje meno?','<code>getent hosts MENO</code>','prázdne: DNS (kapitola 12)'],
 ['7','Je otvorený port?','<code>nc -zv CIEĽ PORT</code>','refused: služba nepočúva; TIMEOUT: firewall po ceste'],
 ['8','Dôjdu pakety k serveru?','<code>sudo tcpdump -i ens192 -nn port 80</code>','nič nepríde: problém pred serverom; prídu a odmietne ich: firewall na serveri']]],
['cmd','sudo dnf install -y nmap-ncat tcpdump','nc a tcpdump nie sú v minimálnej inštalácii'],
['cmd','nc -zv db01.firma.local 3306','je port na inom serveri dostupný?'],
['cmd','sudo tcpdump -i ens192 -nn port 80 -c 10','zachyť 10 paketov na port 80'],
['out','sudo tcpdump -i ens192 -nn port 80 -c 2','IP 10.0.20.15.53200 > 10.0.20.31.80: Flags [S], seq 193802, win 64240, length 0\nIP 10.0.20.31 > 10.0.20.15: ICMP host 10.0.20.31 unreachable - admin prohibited filter, length 68'],
['p','Výstup hore znamená: požiadavka (Flags [S] = SYN) na server prišla, ale server ju odmietol správou „admin prohibited“. To robí firewalld. Problém je teda na serveri, nie v sieti.'],
['tip','<code>traceroute</code> a <code>mtr</code> nie sú v predvolenej inštalácii. <code>tracepath</code> (balík iputils) tam je vždy a stačí na väčšinu prípadov.'],
['new','RHEL 10 už nemá formát <code>ifcfg</code> ani adresár <code>network-scripts</code>. Profily sú len keyfile v <code>/etc/NetworkManager/system-connections/</code>. Príkazy nmcli sú rovnaké.'],
['src',[['RHEL 9: Configuring and managing networking','https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_networking/index'],['nmcli(1) manuál','https://networkmanager.dev/docs/api/latest/nmcli.html'],['ip(8) manuál','https://man7.org/linux/man-pages/man8/ip.8.html']]]
],
quiz:[
 {q:'Pridal si IP cez <code>sudo ip addr add 10.0.20.99/24 dev ens192</code>. Čo sa stane po reštarte?',o:['Ostane, ip zapisuje do profilu','Zmizne, ip mení len aktuálny stav','Zmizne len, ak nie je SELinux','Prenesie sa do /etc/hosts'],a:1,w:'ip je ako firewall-cmd bez --permanent. Trvalo: nmcli con mod.'},
 {q:'Zmenil si profil cez <code>nmcli con mod</code>, ale <code>ip a</code> ukazuje stále starú IP. Čo chýba?',o:['systemctl restart network','nmcli con up PROFIL','ip link set up','reboot je jediná možnosť'],a:1,w:'con mod mení konfiguráciu, con up ju aplikuje (ako firewall-cmd --reload).'},
 {q:'Ktorý príkaz ukáže, cez ktoré rozhranie a bránu pôjde paket na 10.0.40.10?',o:['ip neigh','ip route get 10.0.40.10','ss -tn','nmcli dev status'],a:1,w:'ip route get vyhodnotí smerovaciu tabuľku presne ako jadro.'},
 {q:'Druhá sieťovka do zálohovej siete. Čo do jej profilu zvyčajne <b>nedávaš</b>?',o:['IP adresu','ipv4.method manual','ipv4.gateway','meno profilu'],a:2,w:'Predvolená brána má byť len jedna. Iné siete cez statické trasy.'},
 {q:'<code>ip route add 10.0.60.0/24 via 10.0.99.1</code> hlási „Nexthop has invalid gateway“. Prečo?',o:['Zlý formát siete','Brána 10.0.99.1 nie je v žiadnej pripojenej sieti','Chýba sudo','Trasa už existuje'],a:1,w:'Bránu musí server vedieť dosiahnuť priamo cez niektoré svoje rozhranie.'},
 {q:'tcpdump na serveri ukazuje prichádzajúce SYN na port 80 a odpoveď „admin prohibited filter“. Kde je problém?',o:['V DNS','Na switchi','Vo firewalle servera','Apache nebeží'],a:2,w:'Pakety prišli, server ich odmietol: firewalld. Ak by Apache nebežal, odpoveď by bola RST.'}
],
ex:[
 {t:'Pridaj na <code>ens192</code> <b>dočasne</b> (len do reštartu) adresu <code>10.0.20.99/24</code> príkazom <code>ip</code>.',h:'sudo ip addr add ADRESA/MASKA dev ROZHRANIE',sol:'sudo ip addr add 10.0.20.99/24 dev ens192\nip -br a',check:m=>m.nx.tmpAddrs.some(a=>a.dev==='ens192' && a.cidr==='10.0.20.99/24')},
 {t:'Server dostal druhú sieťovku <code>ens224</code>. Vytvor pre ňu profil <code>backup</code> so statickou IP <code>10.0.30.31/24</code> <b>bez brány</b> a over, že je aktívny.',h:'nmcli dev status; sudo nmcli con add type ethernet con-name backup ifname ens224 ipv4.method manual ipv4.addresses …',sol:BK+'\nnmcli con show --active\nip -br a\nping -c 2 10.0.30.60',check:m=>{ const p = prof(m,'ens224'); return !!p && p.name==='backup' && p.active && p.addrs.includes('10.0.30.31/24') && !p.gw && rtAddr(m,'ens224','10.0.30.31/24'); }},
 {t:'NAS <code>10.0.40.10</code> je dostupný len cez router <code>10.0.30.1</code>. Pridaj do profilu <code>backup</code> <b>trvalú</b> trasu do siete <code>10.0.40.0/24</code>, aplikuj ju a over pingom.',h:'sudo nmcli con mod backup +ipv4.routes "SIEŤ BRÁNA"; sudo nmcli con up backup; ip route get 10.0.40.10',sol:BK+'\nsudo nmcli con mod backup +ipv4.routes "10.0.40.0/24 10.0.30.1"\nsudo nmcli con up backup\nip route get 10.0.40.10\nping -c 2 10.0.40.10',check:m=>{ const p = prof(m,'ens224'); return !!p && p.routes.some(r=>r.dst==='10.0.40.0/24' && r.via==='10.0.30.1') && hasRt(m,'10.0.40.0/24','10.0.30.1') && ran(m,'ping',e=>arg(e,/10\.0\.40\.10|nas01/)); }},
 {t:'Pridaj natrvalo na <code>ens192</code> druhú IP <code>10.0.20.36/24</code> (pôvodná musí ostať) a aplikuj zmenu.',h:'+ipv4.addresses pridá do zoznamu; potom nmcli con up ens192',sol:'sudo nmcli con mod ens192 +ipv4.addresses 10.0.20.36/24\nsudo nmcli con up ens192\nip -br a',check:m=>m.net.ip==='10.0.20.31/24' && m.nx.e192.addrs.includes('10.0.20.36/24') && rtAddr(m,'ens192','10.0.20.36/24')},
 {t:'Over, či je na databázovom serveri <code>db01.firma.local</code> dostupný port MySQL <code>3306</code> (nástroj nc nie je nainštalovaný).',h:'dnf provides nc; sudo dnf install -y nmap-ncat; nc -zv HOST PORT',sol:'sudo dnf install -y nmap-ncat\nnc -zv db01.firma.local 3306',check:m=>ran(m,'nc',e=>arg(e,/^3306$/))||ran(m,'ncat',e=>arg(e,/^3306$/))}
]});

/* odkaz z kapitoly 12 */
{ const c12 = window.CHAPTERS.find(c=>c.n===12); if (c12 && !c12.body.some(b=>/kapitol[ae] 25/.test(String(b[1])))) c12.body.push(['tip','Nastavovanie siete do hĺbky (dočasné vs. trvalé zmeny, druhá sieťovka, statické trasy, tcpdump, nc) je v <a href="#kapitola-25">kapitole 25</a>.']); }

/* ---------- Rozlúštiť: nové a rozšírené príkazy ---------- */
const R = window.CMDREF;
R.ip.f = R.ip.f.concat([['-s','štatistiky: bajty, pakety, chyby, zahodené'],['-c','farebný výstup'],['route get IP','ktorou trasou by išiel paket na IP'],['addr add/del IP/MASKA dev X','dočasne pridaj/odober adresu (do reštartu)'],['route add/del SIEŤ via BRÁNA','dočasná statická trasa'],['link set X up/down','zapni/vypni rozhranie'],['dev','na ktorom rozhraní (dev ens192)'],['via','cez ktorú bránu']]);
R.nmcli.f = R.nmcli.f.concat([['con add type ethernet con-name MENO ifname X …','nový profil pre rozhranie'],['con down MENO','deaktivuj profil'],['con del MENO','zmaž profil (aj súbor)'],['con reload','načítaj ručne upravené súbory'],['+ipv4.addresses / -ipv4.addresses','pridaj/odober adresu v zozname'],['+ipv4.routes "SIEŤ BRÁNA"','pridaj trvalú statickú trasu'],['ipv4.never-default yes','tento profil nikdy nedá predvolenú trasu'],['ipv4.dns-search','vyhľadávacie domény (db01 → db01.firma.local)'],['--active','len aktívne profily'],['dev connect/disconnect X','aktivuj/deaktivuj rozhranie']]);
R.tracepath = {d:'Ukáže cestu (skoky/routery) k cieľu a MTU. Je v predvolenej inštalácii (iputils).', s:'tracepath [-n] CIEĽ', f:[['-n','nepreklada IP na mená (rýchlejšie)'],['no reply','ďalej už nikto neodpovedá: tam sa cesta končí']]};
R.traceroute = {d:'Klasický traceroute (balík traceroute, nie je predvolene).', s:'traceroute [-n] CIEĽ', f:[['-n','bez prekladu mien'],['-T -p PORT','TCP traceroute na port (prejde cez firewally, ktoré blokujú UDP/ICMP)'],['* * *','skok neodpovedal']]};
R.mtr = {d:'Traceroute a ping v jednom, naživo (balík mtr).', s:'mtr [-r -c N] CIEĽ', f:[['-r','report: vypíše výsledok a skončí'],['-c N','počet meraní'],['Loss%','strata paketov na skoku']]};
R.nc = {d:'Netcat (balík nmap-ncat): otestuje TCP spojenie na port.', s:'nc -zv HOST PORT', f:[['-z','len otestuj spojenie, nič neposielaj'],['-v','vypíš výsledok (Connected / refused / TIMEOUT)'],['-w N','čakaj najviac N sekúnd'],['-u','UDP namiesto TCP'],['Connection refused','server odpovedal, port je zatvorený'],['TIMEOUT','bez odpovede: firewall po ceste alebo nedostupný server']]};
R.ncat = R.nc;
R.tcpdump = {d:'Zachytáva pakety na rozhraní. Najlepší dôkaz, čo naozaj prichádza (balík tcpdump).', s:'sudo tcpdump -i ROZHRANIE [-nn] [-c N] [FILTER]', f:[['-i X','rozhranie (any = všetky)'],['-nn','neprekladať IP ani porty na mená'],['-c N','zachyť N paketov a skonči'],['-w súbor.pcap','ulož do súboru (pre Wireshark)'],['port 80','filter: len port 80'],['host 10.0.20.15','filter: len komunikácia s touto IP'],['icmp','filter: len ping'],['Flags [S]','SYN: začiatok TCP spojenia'],['Flags [R.]','RST: port je zatvorený'],['admin prohibited filter','odmietol firewall']]};
R.ethtool = {d:'Stav fyzickej linky sieťovky: rýchlosť, duplex, či je kábel pripojený.', s:'ethtool ROZHRANIE', f:[['Link detected','yes = linka je hore'],['Speed','rýchlosť linky'],['-i','ovládač a firmvér'],['-S','štatistiky ovládača (chyby, zahodené)']]};
R.arping = {d:'ARP ping: odpovedá zariadenie na L2 (aj keď blokuje ICMP)?', s:'sudo arping -I ROZHRANIE -c N IP', f:[['-I','rozhranie'],['-c','počet pokusov']]};

/* ---------- dril ---------- */
window.DRILL.push(
 {id:'n_get', ch:25, q:'Zisti, cez ktoré rozhranie a bránu by išiel paket na <code>10.0.40.10</code>.', a:'ip route get 10.0.40.10', w:'ip route get vyhodnotí smerovaciu tabuľku ako jadro.', check:m=>ran(m,'ip',e=>arg(e,/^get$/) && arg(e,/10\.0\.40\.10/))},
 {id:'n_tmpip', ch:25, q:'Pridaj dočasne na <code>ens192</code> adresu <code>10.0.20.99/24</code>.', a:'sudo ip addr add 10.0.20.99/24 dev ens192', w:'Zmizne po reštarte aj po nmcli con up.', check:m=>m.nx.tmpAddrs.some(a=>a.cidr==='10.0.20.99/24' && a.dev==='ens192')},
 {id:'n_tmprt', ch:25, q:'Profil <code>backup</code> (10.0.30.31/24 na ens224) už beží. Pridaj <b>dočasnú</b> trasu do <code>10.0.40.0/24</code> cez <code>10.0.30.1</code>.', a:'sudo ip route add 10.0.40.0/24 via 10.0.30.1', w:'Trvalo by to bolo cez nmcli con mod backup +ipv4.routes.', setup:m=>asRoot(m,[BK.replace(/^sudo /,'')]), check:m=>m.nx.tmpRoutes.some(r=>r.dst==='10.0.40.0/24' && r.via==='10.0.30.1')},
 {id:'n_add', ch:25, q:'Vytvor profil <code>backup</code> pre rozhranie <code>ens224</code> so statickou IP <code>10.0.30.31/24</code> (bez brány).', a:BK, w:'type ethernet, con-name, ifname, ipv4.method manual, ipv4.addresses.', check:m=>{ const p = prof(m,'ens224'); return !!p && p.name==='backup' && p.addrs.includes('10.0.30.31/24') && !p.gw; }},
 {id:'n_route', ch:25, q:'Pridaj do profilu <code>backup</code> <b>trvalú</b> trasu do <code>10.0.40.0/24</code> cez <code>10.0.30.1</code> (zatiaľ len do profilu).', a:'sudo nmcli con mod backup +ipv4.routes "10.0.40.0/24 10.0.30.1"', w:'Potom nmcli con up backup. + pridáva, bez + nahrádza.', setup:m=>asRoot(m,[BK.replace(/^sudo /,'')]), check:m=>{ const p = prof(m,'ens224'); return !!p && p.routes.some(r=>r.dst==='10.0.40.0/24' && r.via==='10.0.30.1'); }},
 {id:'n_up', ch:25, q:'Zmenil si profil <code>backup</code>. Aplikuj zmeny.', a:'sudo nmcli con up backup', w:'con up načíta profil do aktuálneho stavu (ako firewall-cmd --reload).', setup:m=>{ asRoot(m,[BK.replace(/^sudo /,''),'nmcli con mod backup +ipv4.routes "10.0.40.0/24 10.0.30.1"']); }, check:m=>m._nxState().routes.some(r=>r.dst==='10.0.40.0/24')},
 {id:'n_2ip', ch:25, q:'Pridaj natrvalo do profilu <code>ens192</code> druhú adresu <code>10.0.20.36/24</code> (pôvodná ostane).', a:'sudo nmcli con mod ens192 +ipv4.addresses 10.0.20.36/24', w:'Bez + by si pôvodnú adresu nahradil. Potom nmcli con up ens192.', check:m=>m.nx.e192.addrs.includes('10.0.20.36/24') && m.net.ip==='10.0.20.31/24' && !m.net.pendingIp},
 {id:'n_search', ch:25, q:'Nastav v profile <code>ens192</code> vyhľadávaciu doménu <code>firma.local</code>.', a:'sudo nmcli con mod ens192 ipv4.dns-search firma.local', w:'Krátke meno db01 sa potom doplní na db01.firma.local.', check:m=>(m.nx.e192.search||[]).includes('firma.local')},
 {id:'n_act', ch:25, q:'Vypíš len aktívne profily NetworkManagera.', a:'nmcli con show --active', w:'Bez --active ukáže aj neaktívne.', check:m=>ran(m,'nmcli',e=>e.args.includes('--active'))},
 {id:'n_del', ch:25, q:'Zmaž profil <code>backup</code> (aj jeho súbor).', a:'sudo nmcli con del backup', w:'con del = delete. Rozhranie ostane bez konfigurácie.', setup:m=>asRoot(m,[BK.replace(/^sudo /,'')]), check:m=>!prof(m,'ens224')},
 {id:'n_stat', ch:25, q:'Zobraz štatistiky (chyby, zahodené pakety) rozhrania <code>ens192</code>.', a:'ip -s link show ens192', w:'-s pred objektom. Rastúce errors/dropped = problém s linkou alebo ovládačom.', check:m=>ran(m,'ip',e=>e.args.includes('-s') && arg(e,/^l(ink)?$/))},
 {id:'n_eth', ch:25, q:'Zisti, či má rozhranie <code>ens192</code> pripojenú linku a akou rýchlosťou.', a:'ethtool ens192', w:'Link detected: yes, Speed: …', check:m=>ran(m,'ethtool',e=>arg(e,/ens192/))},
 {id:'n_trace', ch:25, q:'Zisti, cez ktoré routery vedie cesta k <code>redhat.com</code> (nástroj, ktorý je v predvolenej inštalácii).', a:'tracepath redhat.com', w:'traceroute a mtr treba doinštalovať, tracepath je v iputils.', check:m=>ran(m,'tracepath',e=>arg(e,/redhat/))},
 {id:'n_nc', ch:25, q:'Over, či je port <code>3306</code> na <code>db01.firma.local</code> otvorený (nmap-ncat je nainštalovaný).', a:'nc -zv db01.firma.local 3306', w:'-z len test, -v výsledok. refused = zatvorený, TIMEOUT = firewall/nedostupné.', setup:m=>asRoot(m,['dnf install -y nmap-ncat']), check:m=>ran(m,'nc',e=>arg(e,/^3306$/))||ran(m,'ncat',e=>arg(e,/^3306$/))},
 {id:'n_dump', ch:25, q:'Zachyť 5 paketov na porte 80 na rozhraní <code>ens192</code> bez prekladu mien (tcpdump je nainštalovaný).', a:'sudo tcpdump -i ens192 -nn -c 5 port 80', w:'-i rozhranie, -nn čísla, -c počet, na konci filter.', setup:m=>asRoot(m,['dnf install -y tcpdump']), check:m=>ran(m,'tcpdump',e=>arg(e,/^ens192$/) && arg(e,/^80$/) && (e.args.includes('-c')||arg(e,/^-[a-z]*c\d*$/)))}
);

/* ---------- úlohy na skutočnom serveri ---------- */
window.LAB_TASKS[25] = [
 {t:'<code>ip -br a</code>, <code>ip -br link</code>, <code>ip r</code>, <code>ip route get 8.8.8.8</code>. Nájdi meno svojho rozhrania (napr. <code>enp0s1</code>) a bránu.', ok:'Vieš, cez čo a kam ide prevádzka von.'},
 {t:'Pridaj dočasnú IP cez <code>sudo ip addr add</code> (voľná adresa v tvojej sieti), pozri <code>ip -br a</code>, potom <code>sudo nmcli con up NÁZOV_PROFILU</code> a znova.', ok:'Po con up dočasná adresa zmizne.'},
 {t:'V UTM pridaj VM druhú sieťovú kartu (VM vypni → Edit → Network → New, režim <b>Host Only</b>). Na serveri <code>nmcli dev status</code> a vytvor pre ňu profil so statickou IP bez brány.', ok:'Druhé rozhranie je „connected“ s tvojím profilom.', w:'Presné názvy volieb v UTM sa môžu medzi verziami líšiť.'},
 {t:'<code>sudo dnf install -y tcpdump</code> a spusti <code>sudo tcpdump -i NÁZOV -nn icmp</code>. Z Macu pinguj server.', ok:'Vidíš echo request a echo reply.'},
 {t:'S bežiacim httpd a <b>zatvoreným</b> portom 80 vo firewalle spusti <code>sudo tcpdump -i NÁZOV -nn port 80</code> a z Macu <code>curl http://IP</code>. Potom port otvor a zopakuj.', ok:'Najprv „admin prohibited filter“, potom normálne spojenie.'},
 {t:'<code>tracepath redhat.com</code> a <code>nc -zv redhat.com 443</code> (po <code>dnf install -y nmap-ncat</code>).', ok:'Vidíš cestu von a dostupný port 443.'}
];

/* ---------- postup ---------- */
window.RUNBOOKS.push({id:'siet', t:'Server nekomunikuje alebo nedosiahne inú sieť', sym:'ping nejde, Network is unreachable, 100 % packet loss, iná sieť nedostupná, po zmene IP ticho', ch:[25,12], inc:['nas','dns'],
 first:[['ip -br link','je linka hore (UP)?'],['ip -br a','má rozhranie správnu IP?'],['ip route get CIEĽ','ktorou cestou by paket išiel (rozhranie, brána)'],['ping -c 2 BRÁNA; ip neigh','odpovedá brána? FAILED = L2/VLAN problém'],['tracepath CIEĽ','kde sa cesta končí'],['nmcli con show --active','beží správny profil?']],
 causes:[['Profil nie je aktívny / IP chýba',['sudo nmcli con up PROFIL']],['Zmena len cez ip, po reštarte zmizla',['sudo nmcli con mod PROFIL … ; sudo nmcli con up PROFIL']],['Chýba statická trasa do inej siete',['sudo nmcli con mod PROFIL +ipv4.routes "SIEŤ BRÁNA"','sudo nmcli con up PROFIL']],['Dve predvolené trasy (brána aj na druhej sieťovke)',['sudo nmcli con mod PROFIL ipv4.gateway "" ipv4.never-default yes','sudo nmcli con up PROFIL']],['Linka dole (kábel, vSphere, switch)',['ethtool ROZHRANIE','vo vSphere: Connected / Connect at power on']],['Firewall po ceste',['nc -zv CIEĽ PORT (TIMEOUT)','tcpdump na cieľovom serveri']]],
 verify:['ip route get CIEĽ','ping -c 3 CIEĽ','po reštarte znova ip r']});

/* ---------- incident: NAS po reštarte nedostupný ---------- */
if (window.INCIDENTS) window.INCIDENTS.push({id:'nas', lvl:'stredný', title:'Záloha na NAS po reštarte nejde', area:'ip vs nmcli, statické trasy',
 ticket:'Od: monitoring zálohovania\nPredmet: web01 – záloha na nas01 zlyhala\n\nOd nočného reštartu (patchovanie) zlyháva záloha z web01 na nas01 (10.0.40.10). Peter to vraj minulý týždeň „opravil“ a fungovalo to. Zálohová sieťovka je ens224 (profil backup, 10.0.30.31/24), NAS je za routerom 10.0.30.1. Oprav to tak, aby to prežilo aj ďalší reštart.',
 setup:m=>{ asRoot(m,['nmcli con add type ethernet con-name backup ifname ens224 ipv4.method manual ipv4.addresses 10.0.30.31/24']);
   const n = m._mkPath('/root/poznamky-peter.txt','f',0o600,'root','root','Záloha na NAS nešla (No route?)\nOpravené:\n  ip route add 10.0.40.0/24 via 10.0.30.1\nUž to ide :)\n'); n.ctx='admin_home_t';
   const prev = m.user; m.user='root'; m.c_reboot([]); m.user = prev; },
 check:m=>{ const p = prof(m,'ens224'); return !!p && p.active && p.autoconnect && p.routes.some(r=>r.dst==='10.0.40.0/24' && r.via==='10.0.30.1') && m._nxReach('10.0.40.10').ok; },
 hints:['Funguje vôbec zálohová sieť? ping -c 2 10.0.30.1 a ping -c 2 10.0.40.10. Ktorou cestou by išiel paket na NAS: ip route get 10.0.40.10.','Čo presne Peter spravil? sudo cat /root/poznamky-peter.txt. Prežije zmena cez ip reštart?','Trasu daj do profilu: sudo nmcli con mod backup +ipv4.routes "10.0.40.0/24 10.0.30.1" a sudo nmcli con up backup. Over ip route get a ping.'],
 sol:['ping -c 2 10.0.40.10','ip route get 10.0.40.10','nmcli con show backup | grep ipv4','sudo cat /root/poznamky-peter.txt','sudo nmcli con mod backup +ipv4.routes "10.0.40.0/24 10.0.30.1"','sudo nmcli con up backup','ip route get 10.0.40.10','ping -c 2 10.0.40.10'],
 why:'<b>Príčina:</b> trasa do siete NAS bola pridaná len príkazom <code>ip route add</code>. Ten mení iba aktuálny stav jadra, takže po reštarte trasa zmizla a pakety na 10.0.40.10 išli na predvolenú bránu, ktorá túto sieť nepozná.<br><b>Riešenie:</b> trasa patrí do profilu NetworkManagera: <code>nmcli con mod backup +ipv4.routes "10.0.40.0/24 10.0.30.1"</code> a <code>nmcli con up backup</code>.<br><b>Ponaučenie:</b> rovnaký princíp ako firewall bez <code>--permanent</code>. Čo nastavíš cez <code>ip</code>, je len test. Trvalé zmeny siete vždy cez <code>nmcli con mod</code>.'});
})();
