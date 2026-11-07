/* =========================================================
   iptables: čítanie cudzích príkazov, LOG pravidlá, firewalld ekvivalent
   + Rozlúštiť (hodnoty a porty), dril, úloha, postup
   ========================================================= */
(function(){
const R = window.CMDREF;
const ran = (m,n,pred)=>m.log.filter(e=>e.name===n).some(e=>e.code===0 && (!pred||pred(e)));
const arg = (e,re)=>e.args.some(a=>re.test(a));
const asRoot = (m,cmds)=>{ const p=m.user; m.user='root'; try { cmds.forEach(c=>m.run(' '+c)); } finally { m.user=p; } };

/* ---------- známe porty (Rozlúštiť ich ukáže pri --dport, --add-port, ss…) ---------- */
window.PORT_NAMES = {
 20:'FTP dáta', 21:'FTP', 22:'SSH', 23:'Telnet (nešifrovaný, nepoužívať)', 25:'SMTP (pošta medzi servermi)', 53:'DNS', 67:'DHCP server', 68:'DHCP klient', 69:'TFTP (PXE boot)',
 80:'HTTP', 88:'Kerberos', 110:'POP3', 111:'rpcbind (NFSv3)', 123:'NTP (chrony)', 137:'NetBIOS', 138:'NetBIOS', 139:'NetBIOS/SMB', 143:'IMAP',
 161:'SNMP: dotazy monitoringu na agenta (snmpd)', 162:'SNMP trap: upozornenia zo zariadení', 389:'LDAP', 443:'HTTPS', 445:'SMB (Samba, zdieľanie Windows)', 465:'SMTPS', 514:'syslog (vzdialené logy, rsyslog)', 546:'DHCPv6 klient',
 587:'SMTP submission', 623:'IPMI (iDRAC/iLO)', 636:'LDAPS', 873:'rsync', 993:'IMAPS', 995:'POP3S', 1194:'OpenVPN', 1433:'MS SQL', 1521:'Oracle DB', 2049:'NFS',
 2379:'etcd', 3260:'iSCSI', 3306:'MySQL/MariaDB', 3389:'RDP (Windows vzdialená plocha)', 5000:'registry/aplikácie', 5432:'PostgreSQL', 5666:'NRPE (Nagios agent)', 5900:'VNC', 6379:'Redis',
 6443:'Kubernetes API', 8080:'HTTP alternatívny (aplikácie, proxy)', 8443:'HTTPS alternatívny', 9090:'Cockpit (webová správa RHEL)', 9100:'Prometheus node_exporter', 9200:'Elasticsearch', 10050:'Zabbix agent', 10051:'Zabbix server'
};
window.portDesc = function(v){
  const s = String(v).replace(/^["']|["']$/g,'');
  const m = s.match(/^(\d+)(?:[-:](\d+))?(?:\/(tcp|udp|sctp))?$/);
  if (!m) return '';
  const pr = m[3] ? ` (${m[3].toUpperCase()})` : '';
  if (m[2]) return `rozsah portov ${m[1]} až ${m[2]}${pr}`;
  const n = window.PORT_NAMES[+m[1]];
  return n ? `port ${m[1]}${pr} = ${n}` : `port ${m[1]}${pr}` + (+m[1] >= 32768 ? ' (vysoký, zvyčajne náhodný klientsky port)' : '');
};

/* ---------- Rozlúštiť: iptables ---------- */
const CHAINS = {INPUT:'reťazec INPUT: pakety, ktoré idú NA tento server', OUTPUT:'reťazec OUTPUT: pakety, ktoré server sám posiela von', FORWARD:'reťazec FORWARD: pakety, ktoré server len preposiela ďalej (router, kontajnery)', PREROUTING:'reťazec PREROUTING (tabuľka nat/mangle): hneď po príchode, pred smerovaním (DNAT, presmerovanie portu)', POSTROUTING:'reťazec POSTROUTING (tabuľka nat): tesne pred odchodom (SNAT, maškaráda)'};
const TGT = {ACCEPT:'cieľ ACCEPT: paket pusti a ďalšie pravidlá už nerieš', DROP:'cieľ DROP: paket potichu zahoď (odosielateľ čaká do timeoutu)', REJECT:'cieľ REJECT: paket odmietni a pošli odpoveď (klient hneď vidí chybu)', LOG:'cieľ LOG: zapíš paket do logu jadra a pokračuj ďalším pravidlom (paket NEZASTAVÍ)', RETURN:'cieľ RETURN: vráť sa z tohto reťazca', MASQUERADE:'cieľ MASQUERADE: zdrojová adresa sa nahradí adresou výstupného rozhrania (NAT von)', DNAT:'cieľ DNAT: zmeň cieľovú adresu/port (presmerovanie)', SNAT:'cieľ SNAT: zmeň zdrojovú adresu na pevnú'};
R.iptables = {d:'Starý nástroj na pravidlá firewallu v jadre. Na RHEL 9/10 je to iptables-nft: prekladá do nftables. Pravidlá nie sú trvalé a firewalld ich nevidí. Nauč sa ho ČÍTAŤ (návody, staré servery), nastavuj cez firewall-cmd.',
 s:'iptables [-t TABUĽKA] -I|-A|-D REŤAZEC [PODMIENKY] -j CIEĽ',
 f:[['-t TABUĽKA','tabuľka: filter (predvolená, povoľ/zakáž), nat (preklad adries), mangle, raw'],
  ['-A REŤAZEC','append: pridaj pravidlo na KONIEC reťazca'],
  ['-I REŤAZEC [N]','insert: vlož pravidlo na ZAČIATOK reťazca (alebo na pozíciu N). Pravidlá sa čítajú zhora, prvé zhodné rozhoduje'],
  ['-D REŤAZEC N|PRAVIDLO','delete: zmaž pravidlo podľa čísla alebo zopakovaním celého pravidla'],
  ['-R REŤAZEC N','replace: nahraď pravidlo na pozícii N'],
  ['-L [REŤAZEC]','list: vypíš pravidlá (čitateľne)'],
  ['-S [REŤAZEC]','vypíš pravidlá ako príkazy (dá sa skopírovať, ľahko nájdeš, čo zmazať)'],
  ['-F [REŤAZEC]','flush: zmaž všetky pravidlá v reťazci (opatrne)'],
  ['-P REŤAZEC CIEĽ','policy: čo sa stane s paketom, ktorý nezachytilo žiadne pravidlo (ACCEPT/DROP)'],
  ['-Z','vynuluj počítadlá paketov'],
  ['-N MENO','vytvor vlastný reťazec'],
  ['-n','čísla namiesto mien (rýchlejšie, bez DNS)'],
  ['-v','podrobne: počítadlá pkts/bytes a rozhrania. Rastúce pkts = pravidlo zachytáva prevádzku'],
  ['--line-numbers','čísla pravidiel (na mazanie cez -D REŤAZEC N)'],
  ['-p PROTOKOL','protokol: tcp, udp, icmp, all'],
  ['-s ADRESA','source: odkiaľ paket prišiel (IP alebo sieť 10.0.30.0/24)'],
  ['-d ADRESA','destination: kam paket ide'],
  ['-i ROZHRANIE','vstupné rozhranie (ens192)'],
  ['-o ROZHRANIE','výstupné rozhranie'],
  ['--dport PORT','destination port: cieľový port. Funguje len s -p tcp alebo -p udp'],
  ['--sport PORT','source port: zdrojový port'],
  ['-m MODUL','match: načítaj rozšírenie podmienok (conntrack, multiport, comment, limit)'],
  ['--ctstate STAVY','stav spojenia (s -m conntrack): NEW, ESTABLISHED, RELATED, INVALID'],
  ['--state STAVY','staršia forma --ctstate (s -m state)'],
  ['--dports ZOZNAM','viac portov naraz (s -m multiport): 80,443'],
  ['--comment TEXT','komentár k pravidlu (s -m comment)'],
  ['--limit RÝCHLOSŤ','obmedzenie (s -m limit), napr. 5/min: aby LOG nezahltil disk'],
  ['-j CIEĽ','jump: čo sa s paketom stane (ACCEPT, DROP, REJECT, LOG)'],
  ['--log-prefix TEXT','(s -j LOG) text na začiatku každého riadku v logu, max. 29 znakov. Podľa neho riadky nájdeš'],
  ['--log-level ÚROVEŇ','(s -j LOG) priorita v logu: 0–7 alebo emerg…debug, predvolená 4 (warning)'],
  ['--reject-with TYP','(s -j REJECT) akú odpoveď poslať: icmp-port-unreachable, tcp-reset, icmp-admin-prohibited'],
  ['!','negácia nasledujúcej podmienky: ! -s 10.0.20.0/24 = odkiaľkoľvek OKREM tejto siete']],
 v:{'-t':{filter:'tabuľka filter: povoľ/zakáž (predvolená)', nat:'tabuľka nat: preklad adries a portov', mangle:'tabuľka mangle: úprava hlavičiek paketov', raw:'tabuľka raw: výnimky zo sledovania spojení'},
  '-A':CHAINS, '-I':CHAINS, '-D':CHAINS, '-R':CHAINS, '-P':CHAINS, '-N':{'*':'meno nového reťazca'},
  '-p':{tcp:'protokol TCP (spojenia: SSH, HTTP, databázy)', udp:'protokol UDP (bez spojenia: DNS, SNMP, NTP, syslog)', icmp:'ICMP (ping)', all:'všetky protokoly'},
  '-j':TGT,
  '-m':{conntrack:'modul conntrack: podmienka podľa stavu spojenia (--ctstate)', state:'modul state: starší conntrack (--state)', multiport:'modul multiport: viac portov v jednom pravidle (--dports)', comment:'modul comment: komentár (--comment)', limit:'modul limit: obmedzenie počtu (--limit)', udp:'modul udp (pridá sa sám s -p udp)', tcp:'modul tcp (pridá sa sám s -p tcp)', icmp:'modul icmp'},
  '--ctstate':{NEW:'NEW: nové spojenie (prvý paket)', ESTABLISHED:'ESTABLISHED: odpoveď v už nadviazanom spojení', RELATED:'RELATED: súvisiace spojenie (napr. ICMP chyba, FTP dáta)', INVALID:'INVALID: nezmyselný paket'},
  '--dport':'port', '--sport':'port', '--dports':'port',
  '-s':{'*':'IP adresa alebo sieť (CIDR), odkiaľ paket prišiel'}, '-d':{'*':'IP adresa alebo sieť, kam paket ide'},
  '-i':{'*':'meno vstupného rozhrania'}, '-o':{'*':'meno výstupného rozhrania'},
  '--log-prefix':{'*':'tento text bude na začiatku každého LOG riadku. Hľadáš ho: sudo journalctl -k --grep "TEXT"'},
  '--log-level':{0:'0 emerg',1:'1 alert',2:'2 crit',3:'3 err',4:'4 warning (predvolená)',5:'5 notice',6:'6 info',7:'7 debug',info:'info (6)',warning:'warning (4)',debug:'debug (7)'},
  '--limit':{'*':'max. počet zápisov za čas (5/min, 1/s)'},
  '--reject-with':{'icmp-port-unreachable':'odpoveď „port unreachable“ (predvolená)','tcp-reset':'TCP RST: klient hneď vidí „Connection refused“','icmp-admin-prohibited':'„administratively prohibited“: ako firewalld','icmp-host-prohibited':'„host prohibited“ (staré RHEL 6/7 pravidlá)'},
  _pos:Object.assign({'!':'negácia: nasledujúca podmienka platí naopak'}, CHAINS, TGT),
  _num:'číslo pravidla v reťazci (1 = úplne hore)'}
};
R['iptables-save'] = {d:'Vypíše všetky pravidlá iptables ako príkazy (formát na zálohu a obnovu cez iptables-restore).', s:'sudo iptables-save', f:[['*filter','začiatok tabuľky filter'],[':INPUT ACCEPT [0:0]','reťazec, jeho politika a počítadlá'],['COMMIT','koniec tabuľky, pravidlá sa aplikujú naraz']]};
R.ip6tables = {d:'To isté ako iptables, ale pre IPv6. Pravidlá iptables sa na IPv6 nevzťahujú!', s:'sudo ip6tables -L -n', f:R.iptables.f, v:R.iptables.v};
R.nft = R.nft || {f:[]};
R.nft.s = 'sudo nft list ruleset';
R.nft.f = (R.nft.f||[]).concat([['list ruleset','vypíš všetky tabuľky a pravidlá (firewalld aj iptables)'],['list tables','len zoznam tabuliek'],['table inet firewalld','pravidlá, ktoré vytvoril firewalld'],['table ip filter','pravidlá, ktoré niekto pridal cez iptables'],['counter packets N','koľko paketov pravidlo zachytilo'],['log prefix','LOG pravidlo (zápis do logu jadra)']]);
R.nft.v = {_pos:{list:'podpríkaz list: vypíš', ruleset:'celá sada pravidiel', tables:'zoznam tabuliek'}};

/* ---------- kapitola 13: čítanie iptables ---------- */
const c13 = window.CHAPTERS.find(c=>c.n===13);
if (c13 && !c13.body.some(b=>b[0]==='explain' && /iptables/.test(b[1]))){
  const at = c13.body.findIndex(b=>b[0]==='h' && /Kontrolný zoznam/.test(b[1]));
  const blocks = [
  ['h','iptables: ako prečítať príkaz z návodu alebo od kolegu'],
  ['p','Na RHEL nastavuješ firewall cez <code>firewall-cmd</code>. V návodoch, tiketoch a na starších serveroch však uvidíš <code>iptables</code>. Treba ho vedieť <b>prečítať</b>: čo robí, kde je výsledok a ako to spraviť správne. Príklad: kolega chce zistiť, či na server chodia dotazy SNMP z monitoringu:'],
  ['explain','iptables -I INPUT -p udp --dport 161 -j LOG --log-prefix "SNMP-IN: "'],
  ['table',['Časť','Význam'],[
   ['<code>-I INPUT</code>','vlož pravidlo <b>na začiatok</b> reťazca INPUT (prevádzka, ktorá ide na tento server). <code>-A</code> by pridalo na koniec'],
   ['<code>-p udp</code>','len protokol UDP. SNMP beží na UDP'],
   ['<code>--dport 161</code>','cieľový port 161 = SNMP agent (<code>snmpd</code>). Bez <code>-p udp/tcp</code> iptables <code>--dport</code> nepozná'],
   ['<code>-j LOG</code>','paket zapíš do logu jadra. LOG paket <b>nezastaví</b>, pokračuje ďalšími pravidlami (o povolení/zákaze rozhodne niečo iné)'],
   ['<code>--log-prefix "SNMP-IN: "</code>','text na začiatku každého riadku v logu, aby si ich ľahko našiel. Max. 29 znakov, medzera na konci oddelí prefix od zvyšku']]],
  ['p','Pravidlá sa čítajú <b>zhora nadol</b> a prvé zhodné ACCEPT/DROP/REJECT rozhodne. Preto sa LOG dáva cez <code>-I</code> na začiatok: zaloguje paket skôr, než ho iné pravidlo prijme alebo zahodí.'],
  ['h','Kde je výsledok a ako ho čítať'],
  ['pre','sudo journalctl -k --grep "SNMP-IN"      # -k = len správy jadra\nsudo dmesg | grep SNMP-IN\nsudo grep SNMP-IN /var/log/messages\n\nkernel: SNMP-IN: IN=ens192 OUT= MAC=… SRC=10.0.20.50 DST=10.0.20.31 LEN=78 TTL=64 ID=4512 PROTO=UDP SPT=51234 DPT=161 LEN=58'],
  ['table',['Pole','Čo hovorí'],[
   ['<code>IN=ens192</code>','prišlo na rozhranie ens192 (<code>OUT=</code> prázdne = paket je pre tento server)'],
   ['<code>SRC=10.0.20.50</code>','kto sa pýta (monitorovací server)'],
   ['<code>DST=10.0.20.31</code>','na ktorú adresu servera'],
   ['<code>PROTO=UDP SPT=51234 DPT=161</code>','protokol, zdrojový (náhodný) a cieľový port'],
   ['<code>TTL=64</code>','koľko skokov ešte paket vydrží: 64 = prišiel z tej istej siete'],
   ['<code>SYN</code> (pri TCP)','začiatok nového spojenia']]],
  ['tip','Žiadne riadky = pakety na server <b>neprichádzajú</b> (problém je pred serverom: sieť, firewall po ceste, zlá IP v monitoringu). Riadky sú, ale monitoring hlási timeout = pakety prichádzajú, problém je na serveri: beží <code>snmpd</code> (<code>ss -ulpn | grep :161</code>)? Je port otvorený vo firewalld? Rovnakú otázku zodpovie aj <code>sudo tcpdump -i ens192 -nn udp port 161</code>, bez zásahu do pravidiel.'],
  ['h','Prehľad, mazanie a prečo nie natrvalo'],
  ['pre','sudo iptables -L INPUT -n -v --line-numbers   # čísla pravidiel a počítadlá pkts\nsudo iptables -S INPUT                        # pravidlá ako príkazy\nsudo iptables -D INPUT 1                      # zmaž pravidlo č. 1\n# alebo zopakuj celé pravidlo s -D namiesto -I:\nsudo iptables -D INPUT -p udp --dport 161 -j LOG --log-prefix "SNMP-IN: "'],
  ['warn','Pravidlo cez <code>iptables</code> <b>zmizne po reštarte</b>, <code>firewall-cmd --list-all</code> ho neukáže a firewalld ho môže pri reloade prepísať. Na diagnostiku na pár minút OK, potom ho zmaž. LOG bez obmedzenia môže pri veľkej prevádzke zahltiť log: pridaj <code>-m limit --limit 5/min</code>.'],
  ['h','To isté správne: firewalld rich rule'],
  ['pre',"# zaloguj a zároveň povoľ SNMP, natrvalo\nsudo firewall-cmd --permanent --add-rich-rule='rule family=\"ipv4\" port port=\"161\" protocol=\"udp\" log prefix=\"SNMP-IN: \" level=\"info\" limit value=\"5/m\" accept'\nsudo firewall-cmd --reload\nsudo firewall-cmd --list-rich-rules\n\n# len z monitorovacieho servera\nsudo firewall-cmd --permanent --add-rich-rule='rule family=\"ipv4\" source address=\"10.0.20.50/32\" port port=\"161\" protocol=\"udp\" accept'\n\n# odstránenie: rovnaký text s --remove-rich-rule\nsudo firewall-cmd --permanent --remove-rich-rule='rule family=\"ipv4\" port port=\"161\" protocol=\"udp\" log prefix=\"SNMP-IN: \" level=\"info\" limit value=\"5/m\" accept'"],
  ['table',['iptables','firewalld (rich rule)'],[
   ['<code>-p udp --dport 161</code>','<code>port port="161" protocol="udp"</code>'],
   ['<code>-s 10.0.20.50</code>','<code>source address="10.0.20.50"</code>'],
   ['<code>-j LOG --log-prefix "X: "</code>','<code>log prefix="X: " level="info"</code>'],
   ['<code>-m limit --limit 5/min</code>','<code>limit value="5/m"</code>'],
   ['<code>-j ACCEPT</code> / <code>DROP</code> / <code>REJECT</code>','<code>accept</code> / <code>drop</code> / <code>reject</code>'],
   ['<code>-j ACCEPT</code> pre port 161/udp, bez logu','<code>--add-port=161/udp</code> alebo <code>--add-service=snmp</code>']]],
  ['p','SNMP v skratke: monitoring (Zabbix, PRTG, LibreNMS) sa pýta agenta <code>snmpd</code> (balík <code>net-snmp</code>) na <b>UDP 161</b>. Zariadenia samy posielajú upozornenia (trapy) na <b>UDP 162</b> monitorovaciemu serveru. Vo firewalld existujú služby <code>snmp</code> a <code>snmptrap</code>.'],
  ['flags','iptables']];
  c13.body.splice(at<0 ? c13.body.length : at, 0, ...blocks);
  const p26 = c13.body.find(b=>b[0]==='p' && /^<code>iptables<\/code> na RHEL/.test(b[1]));
  if (p26) p26[1] += ' Ako iptables príkaz čítať a prepísať pre firewalld, je nižšie.';
  c13.quiz.push({q:'Kolega pridal <code>iptables -I INPUT -p udp --dport 161 -j LOG --log-prefix "SNMP-IN: "</code>. Čo sa stane s paketmi SNMP?',o:['Zahodia sa a zapíšu do logu','Zapíšu sa do logu a pokračujú ďalšími pravidlami','Povolia sa a zapíšu do logu','Nič, pravidlo sa uplatní až po reštarte'],a:1,w:'LOG paket nezastaví, len ho zapíše. O prijatí rozhodne ďalšie pravidlo. A po reštarte pravidlo naopak zmizne.'});
  c13.ex.push({t:'Monitoring hlási timeout na SNMP. Pridaj <b>natrvalo</b> cez firewalld rich rule, ktoré pre <code>udp/161</code> zapíše pakety do logu s prefixom <code>SNMP-IN: </code> a povolí ich. Aplikuj a nájdi záznamy v logu jadra.',h:"rule family=\"ipv4\" port port=\"161\" protocol=\"udp\" log prefix=\"SNMP-IN: \" level=\"info\" accept; potom --reload a journalctl -k --grep",sol:"sudo firewall-cmd --permanent --add-rich-rule='rule family=\"ipv4\" port port=\"161\" protocol=\"udp\" log prefix=\"SNMP-IN: \" level=\"info\" accept'\nsudo firewall-cmd --reload\nsudo journalctl -k --grep SNMP-IN",
   check:m=>['perm','runtime'].every(k=>m.fw[k].public.rich.some(r=>/161/.test(r) && /udp/.test(r) && /log/.test(r) && /SNMP-IN/.test(r) && /accept/.test(r)))});
}

/* ---------- dril ---------- */
window.DRILL.push(
 {id:'ip_log', ch:13, q:'Dočasne (na diagnostiku) zaloguj všetky prichádzajúce pakety na <code>UDP 161</code> s prefixom <code>SNMP-IN: </code>, pravidlo daj na začiatok reťazca INPUT.', a:'sudo iptables -I INPUT -p udp --dport 161 -j LOG --log-prefix "SNMP-IN: "', w:'-I = na začiatok, -p udp pred --dport, -j LOG, --log-prefix.', check:m=>(m.ipt||{INPUT:[]}).INPUT.some(r=>r.j==='LOG' && r.p==='udp' && r.dport==='161' && /SNMP-IN/.test(r.prefix||''))},
 {id:'ip_list', ch:13, q:'Vypíš pravidlá reťazca INPUT s číslami riadkov, počítadlami a bez prekladu mien.', a:'sudo iptables -L INPUT -n -v --line-numbers', w:'-n čísla, -v počítadlá pkts, --line-numbers na mazanie podľa čísla.', check:m=>ran(m,'iptables',e=>e.args.some(a=>/^-[nv]*L[nv]*$/.test(a)) && e.args.includes('--line-numbers') && e.flags.has('n') && e.flags.has('v'))},
 {id:'ip_S', ch:13, q:'Vypíš pravidlá iptables v tvare príkazov (dajú sa skopírovať).', a:'sudo iptables -S', w:'-S = list-rules. Alternatíva: iptables-save.', check:m=>ran(m,'iptables',e=>e.args.includes('-S'))||ran(m,'iptables-save')},
 {id:'ip_del', ch:13, q:'V reťazci INPUT je jediné pravidlo (LOG pre SNMP). Zmaž ho podľa čísla.', a:'sudo iptables -D INPUT 1', w:'Číslo zistíš cez -L --line-numbers.', setup:m=>asRoot(m,['iptables -I INPUT -p udp --dport 161 -j LOG --log-prefix "SNMP-IN: "']), check:m=>m.ipt && !m.ipt.INPUT.length},
 {id:'ip_klog', ch:13, q:'LOG pravidlo s prefixom <code>SNMP-IN</code> už beží. Nájdi jeho záznamy len medzi správami jadra v journale.', a:'sudo journalctl -k --grep SNMP-IN', w:'-k = kernel, --grep filtruje. Ide aj dmesg | grep alebo /var/log/messages.', setup:m=>asRoot(m,['iptables -I INPUT -p udp --dport 161 -j LOG --log-prefix "SNMP-IN: "']), check:m=>ran(m,'journalctl',e=>e.flags.has('k') && arg(e,/SNMP-IN/))||ran(m,'dmesg')&&ran(m,'grep',e=>arg(e,/SNMP-IN/))},
 {id:'ip_rich', ch:13, q:'Natrvalo cez firewalld: pre <code>udp/161</code> zapisuj do logu s prefixom <code>SNMP-IN: </code> a povoľ (rich rule). Zatiaľ bez reloadu.', a:"sudo firewall-cmd --permanent --add-rich-rule='rule family=\"ipv4\" port port=\"161\" protocol=\"udp\" log prefix=\"SNMP-IN: \" level=\"info\" accept'", w:'iptables -j LOG --log-prefix = rich rule log prefix=. Potom --reload.', check:m=>m.fw.perm.public.rich.some(r=>/161/.test(r) && /udp/.test(r) && /log/.test(r) && /SNMP-IN/.test(r) && /accept/.test(r))},
 {id:'ip_snmp', ch:13, q:'Povoľ natrvalo službu SNMP (dotazy monitoringu na agenta) vo firewalld. Zatiaľ bez reloadu.', a:'sudo firewall-cmd --permanent --add-service=snmp', w:'Služba snmp = 161/udp, snmptrap = 162/udp.', check:m=>m.fw.perm.public.services.includes('snmp')||m.fw.perm.public.ports.includes('161/udp')},
 {id:'ip_dump', ch:13, q:'Bez zásahu do firewallu over, či na <code>ens192</code> chodia pakety na <code>UDP 161</code> (zachyť 5, bez prekladu mien; tcpdump je nainštalovaný).', a:'sudo tcpdump -i ens192 -nn -c 5 udp port 161', w:'tcpdump je najbezpečnejší dôkaz: nič nemení.', setup:m=>asRoot(m,['dnf install -y tcpdump']), check:m=>ran(m,'tcpdump',e=>arg(e,/^ens192$/) && arg(e,/^161$/))}
);

/* ---------- úloha na skutočnom serveri ---------- */
window.LAB_TASKS[13] = (window.LAB_TASKS[13]||[]).concat([
 {t:'Pridaj <code>sudo iptables -I INPUT -p icmp -j LOG --log-prefix "PING-IN: "</code>, z Macu pinguj server a sleduj <code>sudo journalctl -k -f --grep PING-IN</code>. Potom <code>sudo iptables -S INPUT</code>, pravidlo zmaž cez <code>-D</code> a over, že <code>firewall-cmd --list-all</code> ho nikdy neukazoval.', ok:'Vidíš riadky PING-IN so SRC = IP tvojho Macu a vieš pravidlo odstrániť.'},
 {t:'To isté natrvalo cez firewalld: <code>sudo firewall-cmd --permanent --add-rich-rule=\'rule family="ipv4" protocol value="icmp" log prefix="PING-IN: " level="info" accept\'</code>, <code>--reload</code>, pinguj, potom pravidlo odober cez <code>--remove-rich-rule</code>.', ok:'Logovanie prežije reload aj reštart, kým ho neodoberieš.'}
]);

/* ---------- postup ---------- */
window.RUNBOOKS.push({id:'prichadza', t:'Chodí na server prevádzka na port? (SNMP, syslog, aplikácia)', sym:'monitoring hlási timeout, SNMP nefunguje, logy z iného servera neprichádzajú, „z našej strany to posielame“', ch:[13,25], inc:[],
 first:[['ss -ulpn | grep :PORT  (TCP: ss -tlpn)','počúva služba na porte a na ktorej adrese?'],['sudo firewall-cmd --list-all','je port/služba povolená?'],['sudo tcpdump -i ROZHRANIE -nn -c 5 udp port PORT','chodia pakety naozaj na server?'],['sudo iptables -S; sudo nft list ruleset','nie sú tam ručné pravidlá mimo firewalld?'],['sudo journalctl -k --grep PREFIX','ak niekto pridal LOG pravidlo: čo zachytilo']],
 causes:[['Pakety neprichádzajú (tcpdump nič)',['problém pred serverom: firewall v sieti, zlá IP/port v monitoringu, routing','ip route get IP_MONITORINGU (odpoveď musí ísť späť správnou cestou)']],['Prichádzajú, ale firewalld ich odmieta',['sudo firewall-cmd --permanent --add-service=snmp   # alebo --add-port=PORT/udp','sudo firewall-cmd --reload']],['Prichádzajú, ale služba nepočúva',['sudo systemctl enable --now snmpd','ss -ulpn | grep :161']],['Služba počúva len na 127.0.0.1',['uprav konfiguráciu služby (napr. agentAddress v /etc/snmp/snmpd.conf), reštartuj ju']],['Potrebujem dôkaz v logu, natrvalo',["sudo firewall-cmd --permanent --add-rich-rule='rule family=\"ipv4\" port port=\"161\" protocol=\"udp\" log prefix=\"SNMP-IN: \" level=\"info\" limit value=\"5/m\" accept'",'sudo firewall-cmd --reload']]],
 verify:['sudo tcpdump -i ROZHRANIE -nn -c 5 udp port PORT','sudo journalctl -k --grep PREFIX','z monitoringu: snmpwalk -v2c -c KOMUNITA IP_SERVERA']});
})();
