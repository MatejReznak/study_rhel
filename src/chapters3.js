/* =========================================================
   KAPITOLY 18–23 (pokročilé)
   ========================================================= */
(function(){
const CH = c => window.CHAPTERS.push(c);

/* ---------------- 18 ---------------- */
CH({n:18, title:'Inštalácia softvéru a produktov tretích strán', short:'Inštalácia produktov',
goal:'Nainštalovať produkt štyrmi spôsobmi, ktoré v praxi stretneš, a po inštalácii vedieť, kde čo je, ako beží a ako ho odinštalovať.',
body:[
['p','Keď ti v práci povedia „nainštaluj na server XY“, produkt príde jedným zo štyroch spôsobov. Postup sa líši, ale kontrolný zoznam na konci je vždy rovnaký.'],
['table',['Spôsob','Príklad','Príkaz','Aktualizácie'],[
 ['1. Z repozitára RHEL','PostgreSQL, httpd, nginx, Java','<code>dnf install balik</code>','automaticky s <code>dnf update</code>'],
 ['2. RPM súbor od dodávateľa','agent monitoringu, zálohy, antivírus','<code>dnf install ./subor.rpm</code>','ručne, nový .rpm'],
 ['3. Repozitár dodávateľa','nástroje, ktoré dodávateľ často aktualizuje','.repo súbor + <code>dnf install</code>','automaticky s <code>dnf update</code>'],
 ['4. Archív tar.gz / inštalátor','Java aplikácia, Oracle, interný softvér','rozbaliť do <code>/opt</code> + vlastná služba','ručne, nová verzia vedľa starej']]],
['tip','Ak existuje balík v repozitári RHEL alebo RPM od dodávateľa, uprednostni ho pred archívom. RPM databáza potom vie, ktoré súbory k produktu patria, a odinštalovanie je jeden príkaz.'],
['h','1. Z repozitára RHEL: PostgreSQL'],
['pre','dnf info postgresql-server              # čo to je, verzia, repozitár\nsudo dnf install -y postgresql-server\nsudo postgresql-setup --initdb          # niektoré služby treba pred štartom pripraviť\nsudo systemctl enable --now postgresql\nsudo ss -tlpn | grep 5432               # počúva len na 127.0.0.1!'],
['cmd','sudo dnf install -y postgresql-server',''],
['cmd','sudo systemctl start postgresql','bez initdb zlyhá: prečítaj si prečo'],
['cmd','journalctl -u postgresql',''],
['p','Veľa služieb z RHEL po inštalácii <b>počúva len lokálne</b> a <b>nie je spustených</b>. Je to zámer: bezpečné predvolené nastavenie. Prístup zo siete povolíš vedome: konfigurácia služby (<code>listen_addresses</code> v <code>/var/lib/pgsql/data/postgresql.conf</code>), firewall a prípadne SELinux.'],
['new','Na RHEL 9 je predvolený PostgreSQL 13 (bežný balík) a novšie verzie 15 a 16 sú moduly, ktoré vyberieš cez <code>dnf module</code>. RHEL 10 moduly nepoužíva a ďalšie verzie dodáva ako bežné balíky. Ktorú verziu firma používa, ti povie dokumentácia projektu.'],
['h','2. RPM súbor od dodávateľa'],
['p','Dostaneš súbor <code>acme-agent-3.2.1-1.el9.x86_64.rpm</code>. Z mena vidíš: produkt, verzia, release, <b>el9</b> = pre RHEL 9, architektúra. Na RHEL 10 potrebuješ verziu el10.'],
['pre','rpm -qpi acme-agent-3.2.1-1.el9.x86_64.rpm     # info o balíku PRED inštaláciou\nrpm -qpl acme-agent-3.2.1-1.el9.x86_64.rpm     # aké súbory nainštaluje\nrpm -K acme-agent-3.2.1-1.el9.x86_64.rpm       # je podpísaný? (potrebuje kľúč)\nsudo rpm --import RPM-GPG-KEY-acme             # verejný kľúč od dodávateľa\nsudo dnf install ./acme-agent-3.2.1-1.el9.x86_64.rpm'],
['explain','rpm -qpl acme-agent-3.2.1-1.el9.x86_64.rpm'],
['warn','<code>./</code> pred menom je dôležité: <code>dnf install ./subor.rpm</code> nainštaluje súbor, <code>dnf install subor</code> hľadá v repozitároch. <code>dnf</code> uprednostni pred <code>rpm -ivh</code>: dotiahne závislosti a zapíše sa do <code>dnf history</code>.'],
['p','Podpis: dnf pri lokálnom súbore predvolene podpis nekontroluje (<code>localpkg_gpgcheck</code> je vypnutý). Pri súbore z internetu ho preto over sám cez <code>rpm -K</code>. Kľúč daj od dodávateľa z jeho oficiálnej stránky, nie z rovnakého miesta ako balík.'],
['h','3. Repozitár dodávateľa'],
['pre','# /etc/yum.repos.d/acme.repo\n[acme]\nname=ACME tools for RHEL $releasever\nbaseurl=https://repo.acme.example/rhel/$releasever/x86_64/\nenabled=1\ngpgcheck=1\ngpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-acme'],
['table',['Kľúč','Význam'],[['<code>[acme]</code>','ID repozitára (vidíš ho v dnf repolist)'],['<code>baseurl</code>','odkiaľ sa sťahuje; <code>$releasever</code> = 9 alebo 10'],['<code>enabled</code>','1 = používať'],['<code>gpgcheck</code>','1 = overovať podpisy. 0 nikdy na produkcii'],['<code>gpgkey</code>','cesta ku kľúču, typicky v <code>/etc/pki/rpm-gpg/</code>']]],
['p','Súbor vytvoríš ručne (vim), skopíruješ od dodávateľa, alebo ho stiahne <code>dnf config-manager --add-repo URL</code>. Potom <code>dnf repolist</code> a <code>dnf install</code>. Pri prvej inštalácii sa dnf spýta na import kľúča.'],
['tip','Vo firmách s Red Hat Satellite sa repozitáre tretích strán nepridávajú na servery ručne. Spravujú sa centrálne a server ich dostane cez subscription-manager. Spýtaj sa tímu, ako to máte.'],
['h','4. Archív do /opt a vlastná služba'],
['p','Najviac ručnej práce, ale bežné pri Java aplikáciách a internom softvéri. Vždy si najprv prečítaj README od dodávateľa.'],
['pre','tar -tzf appka-2.0.tar.gz | head                     # čo je vnútri (nikdy nerozbaľuj naslepo)\nsudo tar -xzf appka-2.0.tar.gz -C /opt\nsudo ln -s /opt/appka-2.0 /opt/appka                 # odkaz: ďalšia verzia = prepnutie odkazu\nsudo useradd -r -s /sbin/nologin appka               # systémový účet, bez prihlásenia\nsudo chown -R appka:appka /opt/appka-2.0\nsudo mkdir /var/log/appka && sudo chown appka:appka /var/log/appka\nsudo cp /opt/appka/contrib/appka.service /etc/systemd/system/\nsudo systemctl daemon-reload\nsudo systemctl enable --now appka\nsystemctl status appka                               # beží? ak nie: journalctl -xeu appka'],
['list',['<b>Prečo vlastný používateľ:</b> aplikácia nemá bežať ako root. Ak ju niekto napadne, dostane len práva účtu appka.','<b>Prečo odkaz /opt/appka:</b> služba a skripty ukazujú na /opt/appka. Pri upgrade rozbalíš appka-2.1 vedľa a prepneš odkaz. Návrat = prepnúť späť.','<b>Prečo /etc/systemd/system:</b> tam patria tvoje služby, balíky ich neprepíšu.','<b>Závislosti</b> (napr. Java) archív nedotiahne. README alebo chyba v journale ti povie, čo chýba.']],
['h','Po každej inštalácii: kontrolný zoznam'],
['table',['Otázka','Ako zistíš'],[
 ['Kde sú súbory?','<code>rpm -ql balik</code>, pri /opt <code>ls -l /opt/produkt</code>'],
 ['Kde je konfigurácia?','<code>rpm -qc balik</code>, README'],
 ['Aká služba a beží?','<code>systemctl list-unit-files | grep meno</code>, <code>systemctl status</code>'],
 ['Spustí sa po reštarte?','<code>systemctl is-enabled</code>'],
 ['Pod akým používateľom?','<code>ps aux | grep meno</code>, <code>User=</code> v unite'],
 ['Na akom porte a adrese?','<code>sudo ss -tlpn</code>'],
 ['Pustí ho firewall?','<code>firewall-cmd --list-all</code>'],
 ['Blokuje ho SELinux?','<code>sudo ausearch -m AVC -ts recent</code>'],
 ['Kde sú logy?','<code>journalctl -u</code>, <code>/var/log/…</code>'],
 ['Ako sa aktualizuje?','repozitár = dnf update, inak ručne'],
 ['Zapísané?','verzia, cesty, porty a kroky do tiketu alebo wiki tímu']]],
['h','Odinštalovanie'],
['pre','# RPM\nsudo systemctl disable --now acme-agent\nsudo dnf remove acme-agent\n\n# ručná inštalácia v /opt\nsudo systemctl disable --now appka\nsudo rm /etc/systemd/system/appka.service && sudo systemctl daemon-reload\nsudo rm -rf /opt/appka /opt/appka-2.0 /var/log/appka   # najprv over zálohy dát!\nsudo userdel appka']
],
quiz:[
 {q:'Čo znamená <code>el9</code> v mene <code>acme-agent-3.2.1-1.el9.x86_64.rpm</code>?',o:['Elektronická verzia 9','Balík je zostavený pre RHEL 9','9. vydanie produktu','Úroveň zabezpečenia'],a:1,w:'Na RHEL 10 hľadaj el10.'},
 {q:'Prečo <code>dnf install ./subor.rpm</code> a nie <code>rpm -ivh</code>?',o:['rpm nefunguje na RHEL 9','dnf dotiahne závislosti a zapíše sa do histórie','rpm neoveruje meno','Je to jedno'],a:1,w:'rpm -ivh pri chýbajúcej závislosti len skončí chybou.'},
 {q:'Na čo je v .repo súbore <code>gpgcheck=1</code>?',o:['Rýchlejšie sťahovanie','Overovanie podpisov balíkov kľúčom dodávateľa','Šifrovanie spojenia','Kontrola licencie'],a:1,w:'Bez neho by si nainštaloval aj podvrhnutý balík.'},
 {q:'Prečo aplikácia v /opt beží pod účtom <code>appka</code> s <code>/sbin/nologin</code>?',o:['Kvôli licencii','Aby pri napadnutí nemala práva roota a nedalo sa pod ňou prihlásiť','systemd to vyžaduje','Kvôli firewallu'],a:1,w:'Princíp najmenších práv.'},
 {q:'PostgreSQL po inštalácii beží, ale kolega sa zo siete nepripojí. Prvá kontrola?',o:['reštart servera','sudo ss -tlpn: počúva len na 127.0.0.1?','vypnúť SELinux','dnf reinstall'],a:1,w:'Predvolene počúva len lokálne. Potom firewall.'}
],
ex:[
 {t:'Nainštaluj <code>postgresql-server</code>, inicializuj databázu, spusti službu a povoľ ju pri štarte.',h:'dnf install, postgresql-setup --initdb, systemctl enable --now',sol:'sudo dnf install -y postgresql-server\nsudo postgresql-setup --initdb\nsudo systemctl enable --now postgresql',check:m=>m.svc.postgresql && m.svc.postgresql.active && m.svc.postgresql.enabled && m.exists('/var/lib/pgsql/data/PG_VERSION')},
 {t:'Z <code>~/stiahnute</code> nainštaluj agenta <code>acme-agent</code> (RPM súbor), naimportuj kľúč <code>RPM-GPG-KEY-acme</code>, over podpis cez <code>rpm -K</code> a službu <code>acme-agent</code> spusti a povoľ.',h:'sudo rpm --import ~/stiahnute/RPM-GPG-KEY-acme; rpm -K …rpm; sudo dnf install ./stiahnute/acme-agent-…rpm; sudo systemctl enable --now acme-agent',sol:'sudo rpm --import ~/stiahnute/RPM-GPG-KEY-acme\nrpm -K ~/stiahnute/acme-agent-3.2.1-1.el9.x86_64.rpm\nsudo dnf install -y ./stiahnute/acme-agent-3.2.1-1.el9.x86_64.rpm\nsudo systemctl enable --now acme-agent',check:m=>m.pkgs.has('acme-agent') && m.gpgKeys.has('acme') && m.ranOk('rpm',e=>e.flags.has('K')) && m.svc['acme-agent'] && m.svc['acme-agent'].active && m.svc['acme-agent'].enabled},
 {t:'Pridaj repozitár dodávateľa (súbor <code>~/stiahnute/acme.repo</code> patrí do <code>/etc/yum.repos.d/</code>, kľúč do <code>/etc/pki/rpm-gpg/</code>) a nainštaluj z neho <code>acme-cli</code>.',h:'sudo cp stiahnute/acme.repo /etc/yum.repos.d/; sudo cp stiahnute/RPM-GPG-KEY-acme /etc/pki/rpm-gpg/; dnf repolist; sudo dnf install -y acme-cli',sol:'sudo cp ~/stiahnute/acme.repo /etc/yum.repos.d/\nsudo cp ~/stiahnute/RPM-GPG-KEY-acme /etc/pki/rpm-gpg/\ndnf repolist\nsudo dnf install -y acme-cli',check:m=>m.pkgs.has('acme-cli')},
 {t:'Nainštaluj aplikáciu z <code>~/stiahnute/appka-2.0.tar.gz</code> podľa jej README (je v archíve): musí bežať ako služba <code>appka</code>, štartovať pri boote, odpovedať na <code>curl localhost:8080</code> a port 8080/tcp musí byť natrvalo otvorený vo firewalle.',h:'tar -xzf … -C /opt, cat /opt/appka-2.0/README a postupuj; pri chybe systemctl status appka a journalctl -xeu appka',sol:'sudo tar -xzf ~/stiahnute/appka-2.0.tar.gz -C /opt\ncat /opt/appka-2.0/README\nsudo ln -s /opt/appka-2.0 /opt/appka\nsudo useradd -r -s /sbin/nologin appka\nsudo chown -R appka:appka /opt/appka-2.0\nsudo mkdir /var/log/appka\nsudo chown appka:appka /var/log/appka\nsudo dnf install -y java-17-openjdk-headless\nsudo cp /opt/appka/contrib/appka.service /etc/systemd/system/\nsudo systemctl daemon-reload\nsudo systemctl enable --now appka\ncurl localhost:8080\nsudo firewall-cmd --permanent --add-port=8080/tcp\nsudo firewall-cmd --reload',check:m=>m.svc.appka && m.svc.appka.active && m.svc.appka.enabled && m.fw.perm.public.ports.includes('8080/tcp') && m.fw.runtime.public.ports.includes('8080/tcp') && m.ranOk('curl',e=>e.args.some(x=>x.includes('8080')))}
]});

/* ---------------- 19 ---------------- */
CH({n:19, title:'Bash skripty', short:'Bash skripty',
goal:'Napísať a spustiť skript s premennými, podmienkami a cyklami, ktorý zautomatizuje opakovanú kontrolu alebo úlohu.',
body:[
['p','Skript je textový súbor s príkazmi, ktoré by si inak písal ručne. Všetko, čo vieš z predošlých kapitol, môžeš dať do skriptu. V termináli tejto stránky skripty naozaj bežia.'],
['h','Prvý skript'],
['pre','#!/bin/bash\n# ~/skripty/ahoj.sh: pozdraví\necho "Ahoj, $1"\necho "Dnes je $(date +%F) a som na $(hostname)"'],
['list',['<code>#!/bin/bash</code> (shebang) na prvom riadku: akým programom sa súbor spustí','<code>chmod +x ahoj.sh</code>: bez práva x sa nedá spustiť ako <code>./ahoj.sh</code>','<code>./ahoj.sh Jana</code>: <code>./</code> je nutné, aktuálny adresár nie je v PATH','<code>bash ahoj.sh Jana</code> funguje aj bez x','skripty pre všetkých patria do <code>/usr/local/bin</code> (potom stačí napísať meno)']],
['cmd','cat skripty/kontrola.sh','hotový skript v tvojom domove'],
['cmd','chmod +x skripty/kontrola.sh && ./skripty/kontrola.sh',''],
['h','Premenné a úvodzovky'],
['table',['Zápis','Čo spraví'],[
 ['<code>MENO=jana</code>','priradenie. <b>Bez medzier</b> okolo =, inak bash hľadá príkaz MENO'],
 ['<code>echo $MENO</code> / <code>${MENO}</code>','hodnota premennej'],
 ['<code>"text $MENO"</code>','dvojité úvodzovky: premenné a $( ) sa rozbalia'],
 ['<code>\'text $MENO\'</code>','jednoduché: nič sa nerozbalí, presne ako napísané'],
 ['<code>DATUM=$(date +%F)</code>','výstup príkazu do premennej'],
 ['<code>$((5 * 60))</code>','celočíselná aritmetika'],
 ['<code>$1 $2 …</code>','argumenty skriptu; <code>$#</code> počet, <code>$@</code> všetky'],
 ['<code>$?</code>','návratový kód posledného príkazu (0 = úspech)']]],
['cmd','X=5; echo "päťkrát dva je $((X*2))"',''],
['tip','Premenné s cestami alebo menami daj vždy do úvodzoviek: <code>rm "$SUBOR"</code>. Ak by obsahovala medzeru, bez úvodzoviek by sa rozdelila na dve slová a <code>rm</code> by mazal dve rôzne veci.'],
['h','Podmienky'],
['pre','if [ -f /etc/fstab ]; then\n    echo "fstab existuje"\nelif [ -d /data ]; then\n    echo "aspoň /data je"\nelse\n    echo "nič"\nfi'],
['table',['Test','Pravda, keď'],[['<code>-f súbor</code>','existuje a je to súbor'],['<code>-d adr</code>','existuje adresár'],['<code>-e cesta</code>','existuje čokoľvek'],['<code>-x súbor</code>','je spustiteľný'],['<code>-z "$X"</code> / <code>-n "$X"</code>','reťazec je prázdny / nie je prázdny'],['<code>"$A" = "$B"</code>','reťazce sa rovnajú'],['<code>$N -eq 5</code>','čísla sa rovnajú (-ne, -gt, -lt, -ge, -le)'],['<code>! test</code>','negácia']]],
['warn','V <code>[ ]</code> sú medzery povinné: <code>[ -f x ]</code>. Zápis <code>[-f x]</code> skončí „command not found“. <code>[</code> je totiž príkaz.'],
['p','Podmienka môže byť aj obyčajný príkaz: <code>if systemctl is-active sshd >/dev/null; then …</code>. Rozhoduje jeho návratový kód.'],
['h','Cykly'],
['pre','for SLUZBA in sshd firewalld chronyd; do\n    systemctl is-active $SLUZBA\ndone\n\nfor SUBOR in /var/log/*.log; do\n    echo "$SUBOR má $(wc -l < "$SUBOR") riadkov"\ndone\n\nfor i in $(seq 1 5); do\n    echo "pokus $i"\ndone'],
['cmd','for S in sshd firewalld chronyd; do systemctl is-active $S; done',''],
['h','Funkcie a skončenie'],
['pre','zaloguj() {\n    echo "$(date +%T) $1"\n    logger -t zaloha "$1"        # zapíše aj do systémového logu\n}\n\nif [ "$(id -u)" -ne 0 ]; then\n    echo "Spusti ma cez sudo" >&2\n    exit 1\nfi\nzaloguj "Záloha začína"'],
['h','Ladenie a dobré návyky'],
['table',['Čo','Prečo'],[['<code>bash -n skript.sh</code>','skontroluje syntax bez spustenia'],['<code>bash -x skript.sh</code>','pred každým príkazom vypíše „+ príkaz“: vidíš, kde to padá'],['<code>set -euo pipefail</code>','na začiatok skriptu: skonči pri prvej chybe a pri nedefinovanej premennej'],['úplné cesty v cron','cron má minimálne PATH'],['komentáre','o pol roka nebudeš vedieť, prečo si to tak napísal']]],
['cmd','bash -x skripty/kontrola.sh',''],
['tip','Keď skript potrebuješ spustiť na desiatkach serverov, nie je to už úloha pre bash, ale pre Ansible (kapitola 21).']
],
quiz:[
 {q:'Prečo nefunguje <code>MENO = jana</code>?',o:['Meno musí byť malými','Okolo = nesmú byť medzery','Chýba export','Treba úvodzovky'],a:1,w:'S medzerami bash hľadá príkaz MENO s argumentmi = a jana.'},
 {q:'Čo vypíše <code>echo \'$HOME\'</code>?',o:['/home/admin','$HOME','prázdny riadok','chybu'],a:1,w:'Jednoduché úvodzovky nič nerozbaľujú.'},
 {q:'Čo je v <code>$1</code>?',o:['Meno skriptu','Prvý argument skriptu','Návratový kód','PID'],a:1,w:'Meno skriptu je v $0, návratový kód v $?.'},
 {q:'Ktorá podmienka je pravda, keď existuje adresár /data?',o:['[ -f /data ]','[ -d /data ]','[-d /data]','[ /data -d ]'],a:1,w:'-d = adresár, medzery sú povinné.'},
 {q:'Ako zistíš, na ktorom riadku skript robí niečo zlé?',o:['bash -n','bash -x','chmod +x','set +e'],a:1,w:'-x vypisuje príkazy počas behu, -n len skontroluje syntax.'}
],
ex:[
 {t:'Sprav <code>~/skripty/kontrola.sh</code> spustiteľným a spusti ho.',h:'chmod +x, potom ./skripty/kontrola.sh',sol:'chmod +x ~/skripty/kontrola.sh\n~/skripty/kontrola.sh',check:m=>{const n=m.node('/home/admin/skripty/kontrola.sh'); return n && (n.m&0o100) && m.log.some(e=>e.name.includes('kontrola.sh'));}},
 {t:'Vytvor skript <code>~/skripty/ahoj.sh</code>, ktorý vypíše <code>Ahoj, </code> a prvý argument (<code>$1</code>). Sprav ho spustiteľným a spusti s argumentom, napr. <code>./skripty/ahoj.sh Jana</code>.',h:'vim ~/skripty/ahoj.sh (riadky: #!/bin/bash a echo "Ahoj, $1"), chmod +x, spusti s menom',sol:"printf '#!/bin/bash\\necho \"Ahoj, $1\"\\n' > ~/skripty/ahoj.sh\nchmod +x ~/skripty/ahoj.sh\n~/skripty/ahoj.sh Jana",check:m=>{const t=m.read('/home/admin/skripty/ahoj.sh')||''; return t.includes('$1') && m.log.some(e=>e.name.includes('ahoj.sh') && e.args.length>0);}},
 {t:'Jedným riadkom s cyklom <code>for</code> vytvor v <code>~/test</code> súbory <code>den1.txt</code>, <code>den2.txt</code> a <code>den3.txt</code> (adresár najprv vytvor).',h:'mkdir ~/test; for i in 1 2 3; do touch ~/test/den$i.txt; done',sol:'mkdir -p ~/test\nfor i in 1 2 3; do touch ~/test/den$i.txt; done',check:m=>[1,2,3].every(i=>m.isFile('/home/admin/test/den'+i+'.txt'))},
 {t:'Napíš do terminálu podmienku, ktorá vypíše <code>existuje</code>, ak je <code>/etc/fstab</code> súbor, inak <code>chyba</code>.',h:'if [ -f /etc/fstab ]; then echo existuje; else echo chyba; fi',sol:'if [ -f /etc/fstab ]; then echo existuje; else echo chyba; fi',check:m=>m.ran('[',e=>e.args.includes('-f'))}
]});

/* ---------------- 20 ---------------- */
CH({n:20, title:'Inštalácia RHEL, boot a záchrana', short:'Boot a záchrana',
goal:'Rozumieť, ako RHEL naštartuje, meniť parametre jadra, vedieť zachrániť server, ktorý nenaštartuje, a poznať inštaláciu cez kickstart.',
body:[
['h','Inštalácia RHEL'],
['p','RHEL sa inštaluje inštalátorom <b>Anaconda</b> z ISO (DVD alebo Boot ISO), cez sieť (PXE) alebo sa nasadí hotový obraz VM. Vo firmách sa servery nikdy neinštalujú „klikaním“ jeden po druhom, ale automaticky súborom <b>kickstart</b>.'],
['table',['Voľba pri inštalácii','Na serveri zvyčajne'],[['Base Environment','Minimal Install alebo Server (bez GUI)'],['Rozdelenie disku','automaticky s LVM (VG rhel, LV root, swap), prípadne samostatné /var, /home podľa štandardu firmy'],['Sieť a hostname','statická IP, plné meno (web01.firma.local)'],['Root','heslo zamknuté, admin účet v skupine wheel'],['Registrácia','Red Hat účet, aktivačný kľúč alebo Satellite'],['Bezpečnostný profil','ak to firma vyžaduje (CIS, DISA STIG): OpenSCAP']]],
['p','Po každej inštalácii vznikne <code>/root/anaconda-ks.cfg</code>: kickstart presne tejto inštalácie. Je to ideálna predloha na ďalšie servery.'],
['cmd','sudo cat /root/anaconda-ks.cfg',''],
['p','Kickstart sa inštalátoru odovzdá parametrom pri štarte, napr. <code>inst.ks=http://server/web.ks</code>. Syntax overí <code>ksvalidator</code> (balík pykickstart).'],
['h','Ako RHEL štartuje'],
['table',['Krok','Čo sa deje','Kde to nastavuješ'],[
 ['1. Firmvér','UEFI/BIOS nájde zavádzač','konzola servera / VM'],
 ['2. GRUB2','menu, vyberie jadro a parametre','<code>grubby</code>, <code>/boot/loader/entries/</code>, <code>/etc/default/grub</code>'],
 ['3. Jadro + initramfs','ovládače, nájde a pripojí koreňový disk (/)','parametre jadra, <code>dracut</code>'],
 ['4. systemd','spustí jednotky podľa cieľa (target)','<code>systemctl set-default</code>'],
 ['5. fstab, služby, prihlásenie','pripojí disky, spustí povolené služby','<code>/etc/fstab</code>, <code>systemctl enable</code>']]],
['h','Parametre jadra a predvolené jadro: grubby'],
['p','RHEL 9 a 10 používajú BLS (Boot Loader Specification): každé jadro má vlastný súbor v <code>/boot/loader/entries/</code>. Neupravuj ich ručne, použi <code>grubby</code>.'],
['pre','sudo grubby --info=ALL                                  # všetky jadrá a ich parametre\nsudo grubby --default-kernel                            # ktoré sa spustí\nsudo grubby --update-kernel=ALL --args="audit=1"        # pridaj parameter\nsudo grubby --update-kernel=ALL --remove-args="rhgb quiet"\nsudo grubby --set-default=/boot/vmlinuz-5.14.0-570.12.1.el9_6.x86_64   # návrat na staršie jadro\ncat /proc/cmdline                                       # s čím naštartovalo TERAZ'],
['p','Zmena parametrov sa prejaví až po reštarte. Simulátor reštart vie: <code>sudo reboot</code> a potom ti vypíše, čo sa zmenilo a čo neprežilo.'],
['cmd','sudo reboot',''],
['h','Ciele (targets) a záchranné režimy'],
['table',['Režim','Kedy','Ako'],[
 ['<code>multi-user.target</code>','bežný server','<code>systemctl set-default multi-user.target</code>'],
 ['<code>rescue.target</code>','jeden používateľ, pripojené disky, sieť nie','v GRUB pridaj <code>systemd.unit=rescue.target</code>'],
 ['<code>emergency.target</code>','len koreňový disk, len na čítanie; sem skončíš pri chybe vo fstab','<code>systemd.unit=emergency.target</code>'],
 ['<code>rd.break</code>','zastaví sa ešte v initramfs, pred pripojením systému; na reset hesla','parameter v GRUB']]],
['p','Do GRUB menu sa dostaneš z konzoly servera (vSphere, iLO, iDRAC), nie cez SSH. Pri štarte stlač šípku, na položke <kbd>e</kbd>, na koniec riadku <code>linux</code> dopíš parameter a spusti <kbd>Ctrl</kbd>+<kbd>X</kbd>.'],
['h','Reset zabudnutého root hesla'],
['pre','# v GRUB: e, na koniec riadku "linux …" dopíš:  rd.break     → Ctrl+X\nswitch_root:/# mount -o remount,rw /sysroot\nswitch_root:/# chroot /sysroot\nsh-5.1# passwd root\nsh-5.1# touch /.autorelabel        # SELinux pri štarte preznačí súbory (inak sa neprihlásiš!)\nsh-5.1# exit\nswitch_root:/# exit                # štart pokračuje, relabel chvíľu trvá'],
['warn','Zabudnutý <code>touch /.autorelabel</code> = /etc/shadow má po zmene zlý SELinux kontext a prihlásenie zlyhá. Na serveroch so šifrovaným diskom (LUKS) potrebuješ ešte heslo k disku.'],
['h','Server nenaštartuje kvôli fstab'],
['p','Najčastejšia samospôsobená havária: preklep v <code>/etc/fstab</code> alebo disk, ktorý tam už nie je. Server skončí v emergency režime.'],
['pre','# v emergency shelli (heslo roota):\nmount -o remount,rw /\n# cez rd.break je systém v /sysroot, najprv:\n#   mount -o remount,rw /sysroot && chroot /sysroot\nvim /etc/fstab                     # oprav alebo zakomentuj chybný riadok\nsystemctl daemon-reload\nmount -a                           # už bez chyby?\nsystemctl reboot'],
['tip','Prevencia: po každej zmene <code>sudo mount -a</code> a <code>sudo findmnt --verify</code>. Pri diskoch, ktoré nemusia byť vždy dostupné (sieťové, USB), pridaj do možností <code>nofail</code>.'],
['h','initramfs a kdump'],
['p','<code>sudo dracut -f</code> pregeneruje initramfs aktuálneho jadra (napr. po zmene ovládačov alebo multipath). <b>kdump</b> pri páde jadra uloží výpis pamäte do <code>/var/crash</code> pre Red Hat podporu; rezervuje si na to pamäť parametrom <code>crashkernel=</code>.']
],
quiz:[
 {q:'Kde vznikne kickstart súbor po ručnej inštalácii?',o:['/etc/kickstart','/root/anaconda-ks.cfg','/boot/ks.cfg','/var/log/anaconda'],a:1,w:'Dobrá predloha pre ďalšie servery.'},
 {q:'Ako natrvalo pridáš parameter jadra na RHEL 9/10?',o:['vim /proc/cmdline','grubby --update-kernel=ALL --args="…"','dracut --args','sysctl -w'],a:1,w:'/proc/cmdline ukazuje len aktuálny štart.'},
 {q:'Prečo pri resete hesla <code>touch /.autorelabel</code>?',o:['Aby sa zmenilo heslo','Aby SELinux opravil kontexty súborov','Kvôli GRUB','Zrýchli štart'],a:1,w:'Inak má /etc/shadow zlý kontext.'},
 {q:'Server po reštarte skončil v emergency mode. Čo je najčastejšia príčina?',o:['Plný /tmp','Chyba v /etc/fstab','Vypnutý firewall','Zlé heslo'],a:1,w:'Preto mount -a pred reštartom.'},
 {q:'Kde vidíš parametre, s ktorými jadro práve naštartovalo?',o:['/etc/default/grub','/proc/cmdline','/boot/grub2/grub.cfg','grubby --info'],a:1,w:'grubby ukazuje, s čím naštartuje NABUDÚCE.'}
],
ex:[
 {t:'Zisti, ktoré jadro sa spustí ako predvolené a s akými parametrami.',h:'sudo grubby --info=DEFAULT',sol:'sudo grubby --info=DEFAULT',check:m=>m.ranOk('grubby',e=>e.args.some(a=>a.startsWith('--info')))},
 {t:'Pridaj všetkým jadrám parameter <code>audit=1</code>, reštartuj server a over v <code>/proc/cmdline</code>, že platí.',h:'sudo grubby --update-kernel=ALL --args="audit=1"; sudo reboot; cat /proc/cmdline',sol:'sudo grubby --update-kernel=ALL --args="audit=1"\nsudo reboot\ncat /proc/cmdline',check:m=>/audit=1/.test(m.read('/proc/cmdline')||'')},
 {t:'Nacvič haváriu: pridaj do <code>/etc/fstab</code> riadok <code>/dev/sdc1 /data xfs defaults 0 0</code> (disk sdc neexistuje), reštartuj, potom chybný riadok odstráň a reštartuj znova tak, aby server naštartoval normálne.',h:'echo "…" | sudo tee -a /etc/fstab; sudo reboot; sudo sed -i \'/sdc1/d\' /etc/fstab; sudo mount -a; sudo reboot',sol:'echo "/dev/sdc1 /data xfs defaults 0 0" | sudo tee -a /etc/fstab\nsudo reboot\nsudo sed -i \'/sdc1/d\' /etc/fstab\nsudo mount -a\nsudo reboot',check:m=>m.wasEmergency && !m.emergency && !/sdc1/.test(m.read('/etc/fstab')||'')},
 {t:'Zisti z kickstart súboru <code>/root/anaconda-ks.cfg</code>, aké časové pásmo sa nastavilo pri inštalácii.',h:'sudo grep timezone /root/anaconda-ks.cfg',sol:'sudo grep timezone /root/anaconda-ks.cfg',check:m=>m.ranOk('grep',e=>e.args.some(a=>/timezone/i.test(a)) && e.args.some(a=>a.includes('anaconda')))}
]});

/* ---------------- 21 ---------------- */
CH({n:21, title:'Ansible: jeden príkaz pre všetky servery', short:'Ansible',
goal:'Spravovať viac serverov naraz: inventár, ad-hoc príkazy, prvý playbook, kontrola --check a idempotencia.',
body:[
['p','Keď máš 3 servery, nastavíš ich ručne. Keď ich máš 300, potrebuješ <b>Ansible</b>: popíšeš, ako má server vyzerať, a Ansible to zariadi cez SSH na všetkých naraz. Na serveroch netreba žiadneho agenta, stačí SSH a Python (na RHEL je vždy).'],
['table',['Pojem','Význam'],[['<b>control node</b>','stroj, odkiaľ Ansible spúšťaš (tvoj admin server)'],['<b>managed node</b>','server, ktorý Ansible spravuje'],['<b>inventár</b>','zoznam serverov rozdelený do skupín'],['<b>modul</b>','jedna akcia: dnf, service, user, copy, firewalld…'],['<b>playbook</b>','YAML súbor: na ktoré servery a aké úlohy'],['<b>idempotencia</b>','druhé spustenie nič nezmení, ak je už všetko v poriadku']]],
['h','Inštalácia'],
['cmd','sudo dnf install -y ansible-core',''],
['cmd','ansible --version',''],
['p','<code>ansible-core</code> je v AppStream (RHEL ho podporuje najmä pre <code>rhel-system-roles</code>). Plnú podporu pre vlastné playbooky a ďalšie kolekcie dáva predplatné <b>Ansible Automation Platform</b>. Predpoklad: z control node sa vieš na servery prihlásiť SSH kľúčom a máš tam sudo.'],
['h','Inventár'],
['pre','# ~/ansible/inventory\n[web]\nweb01.firma.local\nweb02.firma.local\n\n[db]\ndb01.firma.local\n\n[all:vars]\nansible_user=admin'],
['cmd','cp ansible/inventory.example ansible/inventory',''],
['cmd','ansible-inventory -i ansible/inventory --graph',''],
['h','Ad-hoc príkazy'],
['pre','ansible all -i inventory -m ping                               # odpovedajú všetky?\nansible web -i inventory -m command -a "uptime"               # príkaz na skupine web\nansible all -i inventory -m ansible.builtin.dnf -a "name=tree state=present" -b'],
['explain','ansible web -i inventory -m ansible.builtin.dnf -a "name=tree state=present" -b'],
['p','<code>-b</code> (become) = sudo na cieľovom serveri. Bez neho inštalácia balíka zlyhá.'],
['h','Playbook'],
['pre','---\n- name: Webový server\n  hosts: web\n  become: true\n  tasks:\n    - name: Nainštaluj httpd\n      ansible.builtin.dnf:\n        name: httpd\n        state: present\n\n    - name: Spusti a povoľ httpd\n      ansible.builtin.service:\n        name: httpd\n        state: started\n        enabled: true\n\n    - name: Povoľ http vo firewalle\n      ansible.posix.firewalld:\n        service: http\n        permanent: true\n        immediate: true\n        state: enabled'],
['warn','<b>Pozor na moduly mimo <code>ansible.builtin</code>.</b> Balík <code>ansible-core</code> z RHEL obsahuje len moduly <code>ansible.builtin.*</code>. Modul <code>ansible.posix.firewalld</code> je v kolekcii <code>ansible.posix</code>, ktorú treba doinštalovať. Bez nej playbook hneď skončí chybou <code>couldn\'t resolve module/action \'ansible.posix.firewalld\'</code>.'],
['pre','ansible-galaxy collection install ansible.posix   # do ~/.ansible/collections\nansible-galaxy collection list                     # čo je nainštalované'],
['p','Vo firmách bez prístupu na internet sa kolekcie berú z interného Automation Hubu, alebo sa namiesto vlastných úloh použije podporovaná rola <code>firewall</code> z balíka <code>rhel-system-roles</code> (viď nižšie).'],
['p','Porovnaj s kapitolami 11–13: robí presne to isté ako <code>dnf install</code>, <code>systemctl enable --now</code> a <code>firewall-cmd --permanent … && --reload</code>, ale na všetkých serveroch skupiny naraz a opakovateľne.'],
['warn','YAML je citlivý na odsadenie a <b>nepovoľuje tabulátory</b>. Odsadzuj vždy 2 medzerami. Najčastejšia chyba začiatočníka je zlé odsadenie pod <code>- name:</code>.'],
['h','Spúšťanie'],
['table',['Príkaz','Na čo'],[['<code>ansible-playbook -i inventory web.yml --syntax-check</code>','len kontrola syntaxe'],['<code>ansible-playbook -i inventory web.yml --check</code>','„nanečisto“: ukáže, čo by zmenil, nič nezmení'],['<code>ansible-playbook -i inventory web.yml</code>','naostro'],['<code>… --limit web01.firma.local</code>','len na jednom serveri'],['<code>… -v</code>','podrobnejší výstup pri chybe']]],
['p','V <b>PLAY RECAP</b> sleduj <code>changed</code> a <code>failed</code>. Ak playbook spustíš druhýkrát a nič sa medzitým nezmenilo, musí byť <code>changed=0</code>. Tomu sa hovorí idempotencia a je to hlavný rozdiel oproti bash skriptu.'],
['h','RHEL System Roles'],
['p','Red Hat dodáva hotové a podporované roly na bežné úlohy: <code>timesync</code>, <code>firewall</code>, <code>selinux</code>, <code>network</code>, <code>storage</code>, <code>sshd</code>, <code>sudo</code>, <code>podman</code>. Nainštaluješ ich balíkom <code>rhel-system-roles</code> a nájdeš v <code>/usr/share/ansible/roles</code>. Namiesto vlastných úloh potom v playbooku len zavoláš rolu s premennými.'],
['tip','Najlepší dokumentácia modulov je priamo v systéme: <code>ansible-doc -l</code> a <code>ansible-doc ansible.builtin.dnf</code> (s príkladmi na konci).']
],
quiz:[
 {q:'Čo musí byť na spravovanom serveri, aby ho Ansible ovládal?',o:['Ansible agent','SSH prístup a Python','Docker','Ansible Tower'],a:1,w:'Ansible je bez agenta.'},
 {q:'Čo spraví <code>--check</code>?',o:['Overí SSH','Ukáže, čo by sa zmenilo, bez zmien','Skontroluje len syntax','Spustí len na jednom serveri'],a:1,w:'Samotnú syntax overí --syntax-check.'},
 {q:'Playbook spustíš dvakrát po sebe. Čo má byť pri druhom behu?',o:['changed=0','failed=1','Rovnaké ako prvýkrát','unreachable'],a:0,w:'Idempotencia: všetko už je v požadovanom stave.'},
 {q:'Na čo je <code>-b</code> / <code>become: true</code>?',o:['beží na pozadí','sudo na cieľovom serveri','zálohovanie','batch režim'],a:1,w:'Inštalácia a služby potrebujú root.'},
 {q:'Playbook hlási <code>couldn\'t resolve module/action \'ansible.posix.firewalld\'</code>. Čo chýba?',o:['root práva (-b)','kolekcia ansible.posix','inventár','balík firewalld na riadiacom stroji'],a:1,w:'ansible-core obsahuje len ansible.builtin; ansible.posix doinštaluješ cez ansible-galaxy collection install.'},
 {q:'YAML playbook hlási „found character \'\\t\'“. Čo je zle?',o:['chýba hosts','v súbore je tabulátor namiesto medzier','zlý modul','zlý inventár'],a:1,w:'Odsadzuj len medzerami.'}
],
ex:[
 {t:'Nainštaluj <code>ansible-core</code> a zobraz jeho verziu.',h:'sudo dnf install -y ansible-core; ansible --version',sol:'sudo dnf install -y ansible-core\nansible --version',check:m=>m.pkgs.has('ansible-core') && m.ran('ansible',e=>e.args.includes('--version'))},
 {t:'Vytvor inventár <code>~/ansible/inventory</code> z predlohy <code>inventory.example</code> a over modulom <code>ping</code>, že odpovedajú všetky servery.',h:'cp ansible/inventory.example ansible/inventory; ansible all -i ansible/inventory -m ping',sol:'cp ~/ansible/inventory.example ~/ansible/inventory\nansible all -i ~/ansible/inventory -m ping',check:m=>m.exists('/home/admin/ansible/inventory') && m.ranOk('ansible',e=>e.args.includes('ping') && e.args.includes('-i'))},
 {t:'Spusti playbook <code>~/ansible/web.yml</code> najprv nanečisto (<code>--check</code>). Ak skončí chybou <code>couldn\'t resolve module/action</code>, doinštaluj chýbajúcu kolekciu a spusti ho znova.',h:'ansible-playbook -i ansible/inventory ansible/web.yml --check; chýba kolekcia: ansible-galaxy collection install ansible.posix',sol:'ansible-playbook -i ~/ansible/inventory ~/ansible/web.yml --check\nansible-galaxy collection install ansible.posix\nansible-playbook -i ~/ansible/inventory ~/ansible/web.yml --check',check:m=>m.ranOk('ansible-playbook',e=>e.args.some(a=>a==='--check'||a==='-C'))},
 {t:'Spusti playbook naostro dvakrát po sebe a v PLAY RECAP druhého behu skontroluj, že je <code>changed=0</code>.',h:'ten istý príkaz bez --check, dvakrát',sol:'ansible-playbook -i ~/ansible/inventory ~/ansible/web.yml\nansible-playbook -i ~/ansible/inventory ~/ansible/web.yml',check:m=>Object.values(m.ansibleRuns||{}).some(n=>n>=2)}
]});

/* ---------------- 22 ---------------- */
CH({n:22, title:'Podman a kontajnery', short:'Podman',
goal:'Spustiť aplikáciu v kontajneri, sprístupniť ju na porte, čítať jej logy a nechať ju štartovať so systémom cez Quadlet.',
body:[
['p','Kontajner je aplikácia zabalená so všetkým, čo potrebuje (knižnice, konfigurácia), ktorá beží izolovane, ale <b>zdieľa jadro</b> hostiteľa. Je ľahší ako virtuálny stroj a štartuje za sekundu. Na RHEL sa kontajnery spúšťajú nástrojom <b>podman</b> (Docker na RHEL nie je, príkazy sú takmer rovnaké).'],
['cmd','sudo dnf install -y container-tools','podman, buildah, skopeo'],
['h','Obrazy a registre'],
['table',['Register','Čo tam je'],[['<code>registry.access.redhat.com</code>','UBI (Universal Base Image) a ďalšie obrazy od Red Hatu, bez prihlásenia'],['<code>registry.redhat.io</code>','podporované obrazy, treba <code>podman login</code> s Red Hat účtom'],['<code>docker.io</code>','komunitné obrazy, vo firmách často zakázané alebo cez interný register'],['interný register','Quay, Harbor, Artifactory vo firme']]],
['warn','Na RHEL je zapnutá ochrana krátkych mien: <code>podman pull nginx</code> sa spýta, z ktorého registra. V skriptoch a službách píš vždy <b>celé meno</b>: <code>registry.access.redhat.com/ubi9/nginx-124</code>.'],
['cmd','podman pull registry.access.redhat.com/ubi9/ubi',''],
['cmd','podman images',''],
['h','Spúšťanie'],
['cmd','podman run registry.access.redhat.com/ubi9/ubi cat /etc/redhat-release','kontajner spraví príkaz a skončí'],
['cmd','podman run -d --name web -p 8080:8080 registry.access.redhat.com/ubi9/httpd-24','beží na pozadí'],
['explain','podman run -d --name web -p 8080:8080 -v /srv/web:/var/www/html:Z registry.access.redhat.com/ubi9/httpd-24'],
['table',['Prepínač','Význam'],[['<code>-d</code>','detach: beží na pozadí'],['<code>--name web</code>','meno, inak dostane náhodné'],['<code>-p 8080:8080</code>','port HOSTITEĽA : port v KONTAJNERI'],['<code>-v /srv/web:/var/www/html:Z</code>','adresár hostiteľa do kontajnera; <code>:Z</code> nastaví SELinux kontext, inak kontajner nesmie čítať'],['<code>-e PREMENNA=hodnota</code>','premenná prostredia (heslá, nastavenia)'],['<code>--rm</code>','po skončení kontajner zmaž'],['<code>-it</code>','interaktívne s terminálom (shell v kontajneri)']]],
['h','Správa'],
['table',['Príkaz','Na čo'],[['<code>podman ps</code> / <code>ps -a</code>','bežiace / všetky kontajnery'],['<code>podman logs web</code>','výstup aplikácie (prvé miesto pri chybe)'],['<code>podman exec -it web bash</code>','shell vnútri bežiaceho kontajnera'],['<code>podman stop web</code> / <code>start</code>','zastav / spusti'],['<code>podman rm web</code>','zmaž (zastavený; -f aj bežiaci)'],['<code>podman images</code> / <code>rmi</code>','obrazy'],['<code>podman inspect web</code>','všetky detaily v JSON']]],
['h','Rootless vs. root'],
['p','Bez sudo beží podman <b>rootless</b>: kontajnery sú tvoje, v tvojom domove, a nesmú používať porty pod 1024. So sudo beží ako root a vidí iné kontajnery a obrazy. <code>podman ps</code> a <code>sudo podman ps</code> ukazujú dva rôzne svety. Rootless je bezpečnejší a preferovaný.'],
['h','Štart so systémom: Quadlet'],
['p','Kontajner spustený cez <code>podman run</code> sa po reštarte servera sám nespustí. Na RHEL 9 a 10 sa na to používa <b>Quadlet</b>: popíšeš kontajner v súbore a systemd z neho vyrobí službu.'],
['pre','# /etc/containers/systemd/web.container   (rootless: ~/.config/containers/systemd/)\n[Container]\nImage=registry.access.redhat.com/ubi9/httpd-24\nPublishPort=8081:8080\nVolume=/srv/web:/var/www/html:Z\n\n[Install]\nWantedBy=multi-user.target default.target'],
['pre','sudo systemctl daemon-reload        # Quadlet vygeneruje web.service\nsudo systemctl start web\nsystemctl status web\nsudo podman ps                      # kontajner systemd-web'],
['warn','Quadlet službu <b>nepovoľuješ</b> cez <code>systemctl enable</code> (zlyhá: „transient or generated“). Štart pri boote zariadi sekcia <code>[Install]</code> v .container súbore. Starší spôsob <code>podman generate systemd</code> je zastaraný.'],
['h','Vlastný obraz'],
['pre','# Containerfile\nFROM registry.access.redhat.com/ubi9/ubi\nRUN dnf install -y httpd && dnf clean all\nCOPY index.html /var/www/html/\nCMD ["httpd", "-DFOREGROUND"]\n\n# podman build -t moja-appka .'],
['tip','Do bežiaceho kontajnera nič neinštaluj ručne (<code>podman exec … dnf install</code>). Po jeho zmazaní je zmena preč. Zmeny patria do Containerfile.'],
['new','Image mode v RHEL 10 používa rovnaký princíp aj pre celý operačný systém: OS sa zostaví z Containerfile ako obraz a nasadí cez <code>bootc</code>.']
],
quiz:[
 {q:'Čo znamená <code>-p 8080:80</code>?',o:['port 8080 v kontajneri na 80 hostiteľa','port 8080 hostiteľa vedie na port 80 v kontajneri','dva porty 8080 a 80','protokol 8080'],a:1,w:'Vľavo hostiteľ, vpravo kontajner.'},
 {q:'Rootless kontajner nevie použiť <code>-p 80:8080</code>. Prečo?',o:['Port 80 je obsadený','Bez roota nemožno počúvať na portoch pod 1024','SELinux','Chýba firewall'],a:1,w:'Použi napr. 8080, alebo rootful, alebo reverse proxy.'},
 {q:'Na čo je <code>:Z</code> pri <code>-v</code>?',o:['Komprimácia','Nastaví SELinux kontext, aby kontajner smel adresár čítať','Iba na čítanie','Zero copy'],a:1,w:'Bez neho dostaneš Permission denied vnútri kontajnera.'},
 {q:'Ako zabezpečíš, aby kontajner bežal aj po reštarte servera?',o:['podman run --restart','Quadlet súbor so sekciou [Install] a daemon-reload','systemctl enable podman','crontab @reboot'],a:1,w:'Quadlet je odporúčaný spôsob na RHEL 9 a 10.'},
 {q:'Kde zistíš, prečo aplikácia v kontajneri nefunguje?',o:['journalctl -u podman','podman logs MENO','/var/log/containers','dmesg'],a:1,w:'logs ukáže výstup aplikácie.'}
],
ex:[
 {t:'Nainštaluj <code>container-tools</code> a spusti kontajner z obrazu <code>registry.access.redhat.com/ubi9/ubi</code>, ktorý vypíše obsah <code>/etc/redhat-release</code>.',h:'sudo dnf install -y container-tools; podman run registry.access.redhat.com/ubi9/ubi cat /etc/redhat-release',sol:'sudo dnf install -y container-tools\npodman run registry.access.redhat.com/ubi9/ubi cat /etc/redhat-release',check:m=>m.ranOk('podman',e=>e.args[0]==='run' && e.args.some(a=>a.includes('ubi9/ubi')) && e.args.some(a=>a.includes('release')))},
 {t:'Spusti na pozadí kontajner <code>web</code> z obrazu <code>registry.access.redhat.com/ubi9/httpd-24</code> s portom <code>8080:8080</code> a over ho cez <code>curl localhost:8080</code>.',h:'podman run -d --name web -p 8080:8080 …; curl localhost:8080',sol:'podman run -d --name web -p 8080:8080 registry.access.redhat.com/ubi9/httpd-24\npodman ps\ncurl localhost:8080',check:m=>(m.containers||[]).some(c=>c.name==='web' && c.running && c.ports.some(p=>p.startsWith('8080:'))) && m.ranOk('curl',e=>e.args.some(a=>a.includes('8080')))},
 {t:'Pozri sa do logov kontajnera <code>web</code>, potom ho zastav a zmaž.',h:'podman logs web; podman stop web; podman rm web',sol:'podman logs web\npodman stop web\npodman rm web',check:m=>m.ranOk('podman',e=>e.args[0]==='logs') && m.ranOk('podman',e=>e.args[0]==='rm') && !(m.containers||[]).some(c=>c.name==='web')},
 {t:'Vytvor Quadlet <code>/etc/containers/systemd/web.container</code> s obrazom <code>registry.access.redhat.com/ubi9/httpd-24</code>, portom <code>8081:8080</code> a sekciou <code>[Install]</code>. Načítaj ho a spusti službu <code>web</code>.',h:'sudo vim /etc/containers/systemd/web.container; sudo systemctl daemon-reload; sudo systemctl start web',sol:'printf "[Container]\\nImage=registry.access.redhat.com/ubi9/httpd-24\\nPublishPort=8081:8080\\n\\n[Install]\\nWantedBy=multi-user.target default.target\\n" | sudo tee /etc/containers/systemd/web.container\nsudo systemctl daemon-reload\nsudo systemctl start web\nsudo podman ps',check:m=>m.quadlets && m.quadlets.web && m.quadlets.web.install && (m.containers||[]).some(c=>c.name==='systemd-web' && c.running)}
]});

/* ---------------- 23 ---------------- */
CH({n:23, title:'Výkon, ladenie a upgrade na RHEL 10', short:'Výkon a upgrade',
goal:'Nastaviť výkonnostný profil a parametre jadra natrvalo, zmerať disk a CPU a prejsť upgrade z RHEL 9 na RHEL 10 cez Leapp.',
body:[
['h','tuned: výkonnostné profily'],
['p','Služba <b>tuned</b> nastaví desiatky parametrov jadra (plánovač, správa napájania, disky, sieť) podľa profilu. Na VM je predvolený <code>virtual-guest</code>. Pred ručným ladením vyskúšaj správny profil.'],
['table',['Profil','Kedy'],[['<code>virtual-guest</code>','server vo VM (predvolené)'],['<code>throughput-performance</code>','fyzický server, databázy, výpočty'],['<code>latency-performance</code>','nízka odozva (obchodovanie, real-time)'],['<code>balanced</code>','všeobecné, šetrí energiu'],['<code>powersave</code>','minimálna spotreba']]],
['cmd','tuned-adm active',''],
['cmd','tuned-adm recommend',''],
['cmd','sudo tuned-adm profile throughput-performance',''],
['h','sysctl: parametre jadra'],
['flags','sysctl'],
['pre','sysctl vm.swappiness                         # aktuálna hodnota\nsudo sysctl -w vm.swappiness=10              # zmena TERAZ (do reštartu)\necho "vm.swappiness = 10" | sudo tee /etc/sysctl.d/90-swappiness.conf\nsudo sysctl --system                         # načítaj všetky súbory'],
['p','Rovnaký princíp ako pri firewalle: <code>-w</code> je runtime, súbor v <code>/etc/sysctl.d/</code> je trvalý. Simulátor ti po <code>sudo reboot</code> ukáže, čo sa vrátilo.'],
['table',['Parameter','Na čo'],[['<code>vm.swappiness</code>','ako ochotne jadro swapuje (DB servery často 1–10)'],['<code>net.ipv4.ip_forward</code>','1 = server smeruje pakety (router, kontajnery)'],['<code>net.core.somaxconn</code>','dĺžka fronty čakajúcich spojení'],['<code>vm.dirty_ratio</code>','koľko RAM môžu zaberať neuložené zápisy'],['<code>fs.file-max</code>','max. otvorených súborov v celom systéme']]],
['warn','Parametre neladí podľa náhodného návodu z internetu. Väčšinou nastavíš len to, čo predpisuje dodávateľ aplikácie (Oracle, SAP, databáza), a zapíšeš prečo.'],
['h','Limity procesov'],
['p','Počet otvorených súborov pre jeden proces (<code>ulimit -n</code>, predvolene 1024) sa pre služby systemd nastavuje v unite: <code>LimitNOFILE=65536</code>. Pre prihlásených používateľov v <code>/etc/security/limits.d/*.conf</code>.'],
['h','Meranie: sysstat'],
['cmd','sudo dnf install -y sysstat',''],
['cmd','iostat -xz 1 3','disky: r/s, w/s, await, %util'],
['cmd','sar -u','CPU v histórii (napr. čo sa dialo v noci)'],
['table',['Príznak','Kde pozrieť'],[['vysoký load, CPU nevyťažené','<code>top</code>: %wa (čakanie na disk) → <code>iostat -x</code>'],['pomalé odozvy, disk %util blízko 100','disk je úzke hrdlo'],['available pamäť klesá, swap rastie','málo RAM, <code>ps aux --sort=-%mem</code>'],['proces padá na „Too many open files“','<code>LimitNOFILE</code>']]],
['h','Aktualizácie a reštart'],
['pre','sudo dnf update                  # v servisnom okne, po snapshote\nsudo needs-restarting -r         # treba reštart? (nové jadro, glibc, systemd)\nsudo reboot\nuname -r                         # beží nové jadro?'],
['h','Upgrade RHEL 9 → RHEL 10 (Leapp)'],
['p','In-place upgrade mení hlavnú verziu na mieste, so všetkými dátami a nastaveniami. Robí ho nástroj <b>Leapp</b>. Alternatíva je nová inštalácia RHEL 10 a presun aplikácie, čo je často čistejšie.'],
['list',['<b>Príprava:</b> záloha alebo snapshot VM, systém zaregistrovaný, posledná podporovaná verzia RHEL 9 (aktualizovaná cez <code>dnf update</code>) a naštartované najnovšie jadro.','<b>Nástroj:</b> <code>sudo dnf install leapp-upgrade-el9toel10</code>','<b>Kontrola:</b> <code>sudo leapp preupgrade</code> nič nemení, len vytvorí report <code>/var/log/leapp/leapp-report.txt</code>.','<b>Inhibítory</b> (inhibitor) upgrade zablokujú, kým ich neopravíš. HIGH riziká si prečítaj a rozhodni.','<b>Upgrade:</b> <code>sudo leapp upgrade</code>, potom <code>sudo reboot</code>. Upgrade dobehne pri štarte (desiatky minút, bez SSH).','<b>Po upgrade:</b> <code>cat /etc/redhat-release</code>, <code>uname -r</code>, <code>systemctl --failed</code>, aplikácie, balíky tretích strán (el9 → el10).']],
['pre','sudo dnf update -y && sudo reboot\nsudo dnf install -y leapp-upgrade-el9toel10\nsudo leapp preupgrade\nsudo cat /var/log/leapp/leapp-report.txt\nsudo leapp upgrade\nsudo reboot'],
['warn','Report v simulátore je zjednodušený príklad. Na skutočnom serveri sú hlásenia podľa toho, čo máš nainštalované, a riešenie inhibítorov je opísané priamo v reporte (Remediation).'],
['tip','Pred upgradom produkčného servera ho vyskúšaj na klone. Balíky tretích strán (agenti, databázy od dodávateľa) musia mať verziu pre RHEL 10, inak ich Leapp môže odstrániť.']
],
quiz:[
 {q:'Ako nastavíš <code>vm.swappiness</code> tak, aby prežilo reštart?',o:['sysctl -w vm.swappiness=10','súbor v /etc/sysctl.d/ + sysctl --system','echo 10 > /proc/sys/vm/swappiness','tuned-adm swappiness 10'],a:1,w:'-w a zápis do /proc platia len do reštartu.'},
 {q:'Ktorý tuned profil je predvolený na virtuálnom serveri?',o:['balanced','virtual-guest','throughput-performance','powersave'],a:1,w:'tuned-adm recommend ti ho odporučí.'},
 {q:'Čo spraví <code>leapp preupgrade</code>?',o:['Spustí upgrade','Len skontroluje systém a vytvorí report','Stiahne RHEL 10 ISO','Aktualizuje RHEL 9'],a:1,w:'Nič nemení. Upgrade robí leapp upgrade.'},
 {q:'Čo je inhibítor v reporte Leapp?',o:['Varovanie, ktoré môžeš ignorovať','Problém, ktorý upgrade zablokuje, kým ho neopravíš','Chyba siete','Odinštalovaný balík'],a:1,w:'Napr. nenaštartované najnovšie jadro.'},
 {q:'Load je vysoký, ale CPU v top je takmer nevyťažené a %wa je vysoké. Kde hľadáš?',o:['sieť','disky (iostat -x)','pamäť','firewall'],a:1,w:'%wa = procesy čakajú na disk.'}
],
ex:[
 {t:'Zisti aktívny a odporúčaný tuned profil a nastav profil <code>throughput-performance</code>.',h:'tuned-adm active; tuned-adm recommend; sudo tuned-adm profile throughput-performance',sol:'tuned-adm active\ntuned-adm recommend\nsudo tuned-adm profile throughput-performance',check:m=>m.tuned==='throughput-performance' && m.ran('tuned-adm',e=>e.args[0]==='recommend')},
 {t:'Nastav <code>vm.swappiness</code> na 10 natrvalo (súbor v <code>/etc/sysctl.d/</code>), načítaj ho a over reštartom, že hodnota platí aj potom.',h:'echo "vm.swappiness = 10" | sudo tee /etc/sysctl.d/90-swappiness.conf; sudo sysctl --system; sudo reboot; sysctl vm.swappiness',sol:'echo "vm.swappiness = 10" | sudo tee /etc/sysctl.d/90-swappiness.conf\nsudo sysctl --system\nsudo reboot\nsysctl vm.swappiness',check:m=>m.sysctl['vm.swappiness']==='10' && m.ran('reboot') && Object.keys((m.node('/etc/sysctl.d')||{c:{}}).c).some(f=>/vm\.swappiness\s*=\s*10/.test(m.read('/etc/sysctl.d/'+f)||''))},
 {t:'Nainštaluj <code>sysstat</code> a zmeraj disky cez <code>iostat -xz</code>.',h:'sudo dnf install -y sysstat; iostat -xz 1 3',sol:'sudo dnf install -y sysstat\niostat -xz 1 3',check:m=>m.ranOk('iostat')},
 {t:'Na <b>RHEL 9</b> sprav celý upgrade na RHEL 10: aktualizuj systém, nainštaluj Leapp, spusti preupgrade, vyrieš inhibítor, upgraduj a reštartuj. Na konci <code>cat /etc/redhat-release</code> musí ukázať RHEL 10.',h:'sudo dnf update -y; sudo reboot; sudo dnf install -y leapp-upgrade-el9toel10; sudo leapp preupgrade; sudo leapp upgrade; sudo reboot',sol:'sudo dnf update -y\nsudo reboot\nsudo dnf install -y leapp-upgrade-el9toel10\nsudo leapp preupgrade\nsudo leapp upgrade\nsudo reboot\ncat /etc/redhat-release',check:m=>m.ver===10 && m.ranOk('leapp',e=>e.args[0]==='upgrade')}
]});
})();
