/* =========================================================
   KAPITOLY 1–9
   ========================================================= */
window.CHAPTERS = [];
const CH = c => window.CHAPTERS.push(c);

/* ---------------- 1 ---------------- */
CH({n:1, title:'Terminál, shell a pomoc', short:'Terminál a pomoc',
goal:'Rozumieť promptu, stavbe príkazu (príkaz, prepínače, argumenty) a vedieť si nájsť pomoc bez Googlu.',
body:[
['p','Na serveroch RHEL v práci väčšinou nemáš grafické rozhranie. Prihlásiš sa cez SSH a pracuješ v <b>shelli</b>. Na RHEL je to <code>bash</code>. Shell prečíta riadok, ktorý napíšeš, rozdelí ho na slová a spustí program.'],
['h','Prompt: kto som, kde som, na akom stroji'],
['out','','[admin@rhel9-lab ~]$'],
['table',['Časť','Význam'],[
 ['<code>admin</code>','prihlásený používateľ'],
 ['<code>rhel9-lab</code>','meno stroja (hostname). Pri desiatich otvorených SSH oknách ťa to zachráni pred príkazom na zlom serveri'],
 ['<code>~</code>','aktuálny adresár, <code>~</code> = tvoj domovský (/home/admin)'],
 ['<code>$</code>','bežný používateľ. <code>#</code> znamená <b>root</b>: všetko, čo napíšeš, sa vykoná bez obmedzení']]],
['h','Stavba príkazu'],
['p','Skoro každý príkaz má tvar <code>príkaz -prepínače argumenty</code>. Prepínače (options, flags) menia, <i>ako</i> sa príkaz správa, argumenty hovoria, <i>s čím</i> má pracovať.'],
['explain','ls -l -a -h /var/log'],
['p','Krátke prepínače s jednou pomlčkou sa dajú <b>spájať</b>. Tieto tri zápisy sú rovnaké:'],
['pre','ls -l -a -h /var/log\nls -lah /var/log\nls -hal /var/log'],
['p','Preto vidíš „čudné slová“ ako <code>ss -tulpn</code> alebo <code>tar -xzvf</code>. Nie sú to slová, sú to <b>písmená poskladané za sebou</b>, každé je samostatný prepínač. Rozlúštiť si ich môžeš v nástroji <a href="#rozlustit">Rozlúštiť príkaz</a>.'],
['explain','ss -tulpn'],
['p','Dlhé prepínače majú dve pomlčky a celé slovo: <code>--human-readable</code>, <code>--permanent</code>. Nespájajú sa. Niektoré berú hodnotu cez <code>=</code> alebo medzeru: <code>--zone=public</code>, <code>-n 20</code>.'],
['warn','Pozor na prepínače s hodnotou v zhluku: v <code>tar -czvf zaloha.tar.gz</code> musí byť <code>f</code> posledné, lebo hneď za ním nasleduje meno súboru. <code>tar -cfzv zaloha.tar.gz</code> by vytvorilo archív s menom <code>zv</code>.'],
['h','Pomoc priamo v systéme'],
['table',['Kde','Kedy'],[
 ['<code>prikaz --help</code>','rýchly prehľad prepínačov, vypíše sa do terminálu'],
 ['<code>man prikaz</code>','úplný manuál. Hľadáš v ňom <code>/slovo</code>, koniec <code>q</code>'],
 ['<code>man -k slovo</code>','neviem ako sa príkaz volá: hľadaj v popisoch všetkých manuálov'],
 ['<code>man 5 fstab</code>','sekcia 5 = formát konfiguračného súboru, nie príkaz'],
 ['<code>/usr/share/doc/balík</code>','dokumentácia a príklady konfigurácie']]],
['cmd','man ls','V simulátore uvidíš skrátený manuál z referencie prepínačov.'],
['h','Klávesy, ktoré šetria čas'],
['table',['Kláves','Čo spraví'],[
 ['<kbd>Tab</kbd>','doplní príkaz, cestu alebo meno služby. 2× Tab = ukáže možnosti'],
 ['<kbd>↑</kbd> / <kbd>↓</kbd>','predošlé príkazy'],
 ['<kbd>Ctrl</kbd>+<kbd>R</kbd>','hľadanie v histórii: napíš kúsok príkazu'],
 ['<kbd>Ctrl</kbd>+<kbd>C</kbd>','preruší bežiaci príkaz'],
 ['<kbd>Ctrl</kbd>+<kbd>L</kbd>','vyčistí obrazovku (ako <code>clear</code>)'],
 ['<kbd>Ctrl</kbd>+<kbd>A</kbd> / <kbd>E</kbd>','na začiatok / koniec riadku'],
 ['<kbd>Ctrl</kbd>+<kbd>D</kbd>','koniec vstupu, v prázdnom shelli odhlásenie']]],
['h','sudo: práca ako root'],
['p','Na RHEL sa ako root priamo neprihlasuješ. Svoj účet máš v skupine <code>wheel</code> a príkazy, ktoré menia systém, spúšťaš cez <code>sudo</code>. Každé sudo sa zapíše do <code>/var/log/secure</code>, takže je jasné, kto čo spravil.'],
['cmd','sudo dnf check-update',''],
['tip','Zabudol si sudo? Napíš <code>sudo !!</code>. <code>!!</code> je posledný príkaz z histórie.'],
['h','Prvé príkazy na novom serveri'],
['cmd','hostnamectl','meno, OS, jadro, virtualizácia'],
['cmd','cat /etc/redhat-release','presná verzia RHEL'],
['cmd','uname -r','verzia jadra'],
['cmd','whoami; id','kto som a v akých skupinách'],
['cmd','uptime','ako dlho beží a aká je záťaž'],
['flags','history']
],
quiz:[
 {q:'Čo znamená <code>#</code> na konci promptu?',o:['Komentár','Si prihlásený ako root','Príkaz čaká na vstup','Si v adresári /'],a:1,w:'<code>#</code> je root, <code>$</code> bežný používateľ. Pri # buď dvakrát opatrnejší.'},
 {q:'Ktorý zápis je rovnaký ako <code>ls -l -a -h</code>?',o:['ls --lah','ls -lah','ls -l-a-h','ls lah'],a:1,w:'Krátke prepínače sa spájajú za jednu pomlčku. <code>--lah</code> by bol jeden dlhý prepínač s menom „lah“.'},
 {q:'Čo spraví <code>sudo !!</code>?',o:['Spustí posledný príkaz znova so sudo','Prepne na roota natrvalo','Zobrazí históriu sudo','Nič, je to chyba'],a:0,w:'<code>!!</code> sa rozbalí na posledný príkaz z histórie.'},
 {q:'Nevieš, ako sa volá príkaz na prácu s časovými pásmami. Čo použiješ?',o:['man timezone','man -k timezone','help timezone','info --all'],a:1,w:'<code>man -k</code> (apropos) hľadá slovo v popisoch všetkých manuálov.'}
],
ex:[
 {t:'Zisti, akú verziu jadra má tento server. Použi <code>uname</code> so správnym prepínačom.',h:'Prepínač pre „release“ jadra je -r.',sol:'uname -r',check:m=>m.ran('uname',e=>e.flags.has('r')||e.flags.has('a'))},
 {t:'Zobraz si informácie o stroji: hostname, OS, jadro a virtualizáciu jedným príkazom.',h:'Príkaz začína na hostname…',sol:'hostnamectl',check:m=>m.ran('hostnamectl')},
 {t:'Spusti príkaz <code>dnf check-update</code> bez sudo, a potom ho zopakuj so sudo cez <code>!!</code>.',h:'Najprv dnf check-update, potom sudo !!',sol:'dnf check-update\nsudo !!',check:m=>m.log.some(e=>e.name==='dnf' && e.user==='root' && e.args[0]==='check-update')}
]});

/* ---------------- 2 ---------------- */
CH({n:2, title:'Súbory a adresáre: ls, cd, cp, mv, rm', short:'Súbory a adresáre',
goal:'Pohybovať sa v strome adresárov, rozumieť výpisu ls -l a bezpečne kopírovať, presúvať a mazať.',
body:[
['h','Absolútna a relatívna cesta'],
['p','<b>Absolútna</b> cesta začína lomkou <code>/</code> a platí odkiaľkoľvek: <code>/etc/ssh/sshd_config</code>. <b>Relatívna</b> sa počíta od aktuálneho adresára: ak si v <code>/etc</code>, tak <code>ssh/sshd_config</code> je ten istý súbor.'],
['table',['Zápis','Znamená'],[['<code>.</code>','tento adresár'],['<code>..</code>','nadradený adresár'],['<code>~</code>','tvoj domovský adresár'],['<code>-</code>','pri cd: predošlý adresár']]],
['cmd','pwd',''],['cmd','cd /var/log',''],['cmd','cd -','vráti ťa späť'],['cmd','cd',' bez argumentu = domov'],
['h','ls a jeho prepínače'],
['flags','ls'],
['out','ls -l','-rw-r--r--.  1 admin admin  173 Nov  1 10:12 poznamky.txt\ndrwxr-xr-x.  2 admin admin 4096 Nov  1 09:01 logy'],
['table',['Stĺpec','Príklad','Význam'],[
 ['typ + práva','<code>-rw-r--r--</code>','<code>-</code> súbor, <code>d</code> adresár, <code>l</code> odkaz; potom rwx pre vlastníka, skupinu, ostatných'],
 ['bodka','<code>.</code>','súbor má SELinux kontext (na RHEL vždy). <code>+</code> by znamenalo ACL'],
 ['odkazy','<code>1</code>','počet pevných odkazov; pri adresári 2 + počet podadresárov'],
 ['vlastník','<code>admin</code>',''],['skupina','<code>admin</code>',''],
 ['veľkosť','<code>173</code>','v bajtoch, s -h čitateľne'],
 ['dátum','<code>Nov  1 10:12</code>','posledná úprava obsahu (mtime)'],
 ['meno','<code>poznamky.txt</code>','']]],
['explain','ls -lhtr /var/log'],
['p','Toto je jeden z najčastejších príkazov pri riešení problémov: posledný upravený log je na konci výpisu, hneď nad promptom.'],
['h','Vytváranie'],
['flags','mkdir'],
['cmd','mkdir -p projekt/logy/2026','-p vytvorí aj projekt aj logy'],
['cmd','touch projekt/README','prázdny súbor'],
['h','Kopírovanie a presun'],
['flags','cp',['-r','-a','-p','-i','-v']],
['cmd','cp poznamky.txt poznamky.bak',''],
['cmd','cp -rv skripty /tmp/','kópia adresára'],
['tip','Pred úpravou konfigurácie si sprav zálohu: <code>sudo cp /etc/ssh/sshd_config{,.bak}</code>. Bash rozbalí <code>{,.bak}</code> na <code>sshd_config sshd_config.bak</code>.'],
['flags','mv'],
['warn','<code>mv</code> zachováva SELinux kontext pôvodného miesta, <code>cp</code> dostane kontext nového miesta. Keď presunieš stránku z domova do <code>/var/www/html</code> cez <code>mv</code>, apache ju nebude smieť čítať. Viac v kapitole 14.'],
['h','Mazanie'],
['flags','rm'],
['warn','Linux nemá kôš. <code>rm -rf</code> s preklepom v ceste (napríklad medzera: <code>rm -rf ~/ projekt/stare</code> zmaže celý domovský adresár) zmaže iné veci, než chceš. Pred Enterom si cestu prečítaj. Pri zástupných znakoch si najprv spusti <code>ls</code> s rovnakým vzorom.'],
['h','Zástupné znaky (globy)'],
['table',['Vzor','Zodpovedá'],[['<code>*</code>','ľubovoľný počet znakov: <code>*.log</code>'],['<code>?</code>','práve jeden znak: <code>app?.log</code>'],['<code>[0-9]</code>','jeden znak z rozsahu'],['<code>{a,b}</code>','rozbalí sa na viac slov (nie je to vzor, vždy sa vytvorí)']]],
['p','Globy rozbaľuje <b>shell</b> skôr, ako sa príkaz spustí. <code>ls *.txt</code> dostane už hotový zoznam súborov.'],
['h','Odkazy'],
['flags','ln'],
['cmd','ls -l /bin','na RHEL je /bin len odkaz na /usr/bin']
],
quiz:[
 {q:'Si v <code>/var/log</code>. Kam ťa dostane <code>cd ../../etc</code>?',o:['/var/etc','/etc','/var/log/etc','Chyba'],a:1,w:'.. z /var/log je /var, ďalšie .. je /, potom etc.'},
 {q:'Čo spraví <code>ls -lhtr</code>?',o:['Rekurzívny výpis','Dlhý výpis, čitateľné veľkosti, podľa času, najnovšie dole','Len skryté súbory','Podľa veľkosti od najmenšieho'],a:1,w:'l = dlhý, h = human, t = čas, r = reverse.'},
 {q:'Prečo <code>cp -r</code> a nie len <code>cp</code> pri adresári?',o:['Bez -r je pomalší','Bez -r adresár preskočí','-r znamená read-only','Bez -r skopíruje len práva'],a:1,w:'cp bez -r hlási „omitting directory“.'},
 {q:'Ktorý príkaz zachová SELinux kontext pôvodného miesta?',o:['cp','mv','cp -r','touch'],a:1,w:'mv len premenuje položku, kontext zostane. cp vytvára nový súbor s kontextom cieľa.'},
 {q:'Čo znamená bodka v <code>-rw-r--r--.</code>?',o:['Skrytý súbor','Súbor má SELinux kontext','Súbor je prázdny','Chyba výpisu'],a:1,w:'Bodka = SELinux kontext, plus = ACL.'}
],
ex:[
 {t:'Vytvor v domovskom adresári štruktúru <code>projekt/logy</code>, <code>projekt/data</code> a <code>projekt/skripty</code>.',h:'mkdir -p a buď tri cesty, alebo projekt/{logy,data,skripty}',sol:'mkdir -p ~/projekt/{logy,data,skripty}',check:m=>['logy','data','skripty'].every(x=>m.isDir('/home/admin/projekt/'+x))},
 {t:'Skopíruj súbor <code>poznamky.txt</code> do <code>projekt/data/</code>.',h:'cp zdroj cieľ/',sol:'cp ~/poznamky.txt ~/projekt/data/',check:m=>m.isFile('/home/admin/projekt/data/poznamky.txt')},
 {t:'Premenuj <code>index.html</code> v domovskom adresári na <code>stara-stranka.html</code>.',h:'Premenovanie robí mv.',sol:'mv ~/index.html ~/stara-stranka.html',check:m=>m.isFile('/home/admin/stara-stranka.html') && !m.exists('/home/admin/index.html')},
 {t:'Vypíš obsah <code>/var/log</code> v dlhom formáte, čitateľné veľkosti, zoradené podľa času s najnovším súborom dole.',h:'Štyri písmená: l, h, t, r.',sol:'ls -lhtr /var/log',check:m=>m.ran('ls',e=>['l','h','t','r'].every(f=>e.flags.has(f)) && e.args.some(a=>a.startsWith('/var/log')))}
]});

/* ---------------- 3 ---------------- */
CH({n:3, title:'Kde čo je: štruktúra súborového systému', short:'Kde čo je (FHS)',
goal:'Vedieť, v ktorom adresári hľadať konfiguráciu, logy, dáta aplikácií či softvér tretích strán, a ako to rýchlo overiť.',
body:[
['p','Linux nemá disky C: a D:. Všetko visí z jedného koreňa <code>/</code> a ďalšie disky sa <b>pripájajú</b> do adresárov. Rozloženie popisuje štandard FHS (Filesystem Hierarchy Standard). Celý interaktívny strom s tým, čo kde hľadať, je v <a href="#mapa">Mape súborov</a>.'],
['table',['Adresár','Čo tam je','Kedy tam ideš'],[
 ['<code>/etc</code>','<b>konfigurácia</b> systému a služieb, textové súbory','meníš nastavenie: sieť, SSH, používatelia, firewall, sudo'],
 ['<code>/var</code>','<b>premenlivé dáta</b>: logy, databázy, cache, fronty, web','hľadáš logy (/var/log), dáta DB (/var/lib), web (/var/www)'],
 ['<code>/var/log</code>','logy: messages, secure, audit/audit.log, dnf.log','čokoľvek nefunguje'],
 ['<code>/opt</code>','<b>softvér tretích strán</b>, ktorý nie je z RPM repozitárov RHEL','inštaluješ agenta, Oracle, vlastnú aplikáciu dodanú ako tar'],
 ['<code>/usr</code>','programy a knižnice z balíkov (read-only charakter)','hľadáš binárku (/usr/bin), unit súbory (/usr/lib/systemd/system)'],
 ['<code>/usr/local</code>','softvér, ktorý si skompiloval alebo pridal ručne','skripty pre všetkých: /usr/local/bin'],
 ['<code>/home</code>','domovské adresáre používateľov',''],
 ['<code>/root</code>','domov roota (nie /home/root!)',''],
 ['<code>/tmp</code>','dočasné súbory, systemd-tmpfiles ich časom maže (staršie ako 10 dní)','nikdy tam nedávaj nič dôležité'],
 ['<code>/boot</code>','jadro, initramfs, GRUB','aktualizácia jadra, problémy so štartom'],
 ['<code>/dev</code>','zariadenia: disky /dev/sda, /dev/null',''],
 ['<code>/proc</code>, <code>/sys</code>','virtuálne: pohľad do jadra a procesov','info o CPU, pamäti, parametre jadra'],
 ['<code>/run</code>','runtime dáta od štartu (PID súbory, sockety)',''],
 ['<code>/srv</code>','dáta služieb, ktoré server poskytuje (FTP, web)','niektoré firmy dávajú web sem'],
 ['<code>/mnt</code>, <code>/media</code>','dočasné pripojenie diskov / USB','']]],
['h','/etc vs /opt vs /usr: rozhodovacie pravidlo'],
['list',[
 'Prišlo to cez <code>dnf install</code>? Binárky sú v <code>/usr/bin</code> alebo <code>/usr/sbin</code>, konfigurácia v <code>/etc</code>, dáta v <code>/var/lib</code>, logy v <code>/var/log</code>.',
 'Dodal to dodávateľ ako balík mimo RHEL (agent, monitorovanie, databáza)? Pravdepodobne <code>/opt/meno</code> s vlastným <code>bin</code>, <code>etc</code>, <code>log</code>.',
 'Upravuješ systémovú službu? Nemeníš súbor v <code>/usr/lib/systemd/system</code>, ale vytvoríš kópiu alebo doplnok v <code>/etc/systemd/system</code>. <code>/etc</code> má vždy prednosť a aktualizácia balíka ho neprepíše.']],
['h','Dôležité súbory v /etc, ktoré budeš otvárať'],
['table',['Súbor','Na čo'],[
 ['<code>/etc/passwd</code>, <code>/etc/shadow</code>, <code>/etc/group</code>','používatelia, heslá (hash), skupiny'],
 ['<code>/etc/sudoers</code>, <code>/etc/sudoers.d/</code>','kto smie sudo (upravuj cez visudo)'],
 ['<code>/etc/hosts</code>, <code>/etc/resolv.conf</code>','lokálne mená, DNS servery'],
 ['<code>/etc/hostname</code>','meno stroja'],
 ['<code>/etc/fstab</code>','čo sa pripojí pri štarte. Chyba tu = server nenaštartuje'],
 ['<code>/etc/ssh/sshd_config</code>, <code>sshd_config.d/</code>','nastavenie SSH servera'],
 ['<code>/etc/NetworkManager/system-connections/</code>','sieťové profily (keyfile)'],
 ['<code>/etc/firewalld/</code>','trvalá konfigurácia firewallu'],
 ['<code>/etc/selinux/config</code>','režim SELinuxu po štarte'],
 ['<code>/etc/yum.repos.d/</code>, <code>/etc/dnf/dnf.conf</code>','repozitáre a nastavenie dnf'],
 ['<code>/etc/systemd/system/</code>','tvoje a upravené služby, timery'],
 ['<code>/etc/crontab</code>, <code>/etc/cron.d/</code>','plánované úlohy'],
 ['<code>/etc/chrony.conf</code>','synchronizácia času'],
 ['<code>/etc/os-release</code>, <code>/etc/redhat-release</code>','verzia OS']]],
['h','Ako to zistíš sám'],
['p','Nemusíš si všetko pamätať. RPM databáza vie, ktorý súbor patrí ktorému balíku a kam balík čo nainštaloval:'],
['cmd','rpm -qc openssh-server','konfiguračné súbory balíka'],
['cmd','rpm -ql chrony','všetky súbory balíka'],
['cmd','rpm -qf /etc/chrony.conf','komu patrí súbor'],
['cmd','which sshd firewall-cmd','kde leží príkaz'],
['cmd','systemctl cat sshd','kde je unit súbor služby a čo spúšťa'],
['tip','Súbor v /etc, ktorý nepatrí žiadnemu balíku (<code>rpm -qf</code> hlási „not owned“), vytvoril niekto ručne. To je často prvá stopa pri hľadaní, kto čo menil.'],
['new','Na RHEL 9 aj 10 sú <code>/bin</code>, <code>/sbin</code>, <code>/lib</code> len symbolické odkazy na <code>/usr/…</code>. Na RHEL 10 už neexistuje adresár <code>/etc/sysconfig/network-scripts</code> so súbormi ifcfg, sieť je len v <code>/etc/NetworkManager/system-connections</code>.']
],
quiz:[
 {q:'Kde hľadáš konfiguráciu SSH servera?',o:['/opt/ssh','/var/ssh','/etc/ssh/sshd_config','/usr/ssh.conf'],a:2,w:'Konfigurácia je v /etc. Na RHEL 9+ sú doplnky aj v /etc/ssh/sshd_config.d/.'},
 {q:'Dodávateľ ti dal monitorovacieho agenta ako .tar.gz mimo RHEL repozitárov. Kam ho rozbalíš?',o:['/usr/bin','/opt/agent','/etc/agent','/tmp'],a:1,w:'/opt je pre softvér tretích strán. /usr patrí balíkom RPM.'},
 {q:'Chceš upraviť systemd službu z balíka. Kam dáš upravenú verziu?',o:['/usr/lib/systemd/system','/etc/systemd/system','/var/lib/systemd','/opt/systemd'],a:1,w:'/etc/systemd/system má prednosť a aktualizácia balíka ju neprepíše.'},
 {q:'Ktorý príkaz povie, ktorému balíku patrí súbor?',o:['rpm -ql','rpm -qf','dnf info','which'],a:1,w:'-q query, -f file.'},
 {q:'Kde sú logy prihlásení a sudo?',o:['/var/log/messages','/var/log/secure','/etc/secure','/root/log'],a:1,w:'secure obsahuje autentifikáciu: SSH, sudo, su.'}
],
ex:[
 {t:'Zisti, ktoré konfiguračné súbory nainštaloval balík <code>chrony</code>.',h:'rpm, query, config: -qc',sol:'rpm -qc chrony',check:m=>m.ran('rpm',e=>e.flags.has('q')&&e.flags.has('c'))},
 {t:'Zisti, ktorému balíku patrí súbor <code>/etc/ssh/sshd_config</code>.',h:'rpm -qf CESTA',sol:'rpm -qf /etc/ssh/sshd_config',check:m=>m.ran('rpm',e=>e.flags.has('f'))},
 {t:'Pozri sa, kde leží konfigurácia monitorovacieho agenta v <code>/opt</code> (vypíš obsah <code>/opt/monitoring</code>) a prečítaj si súbor <code>README</code>.',h:'ls /opt/monitoring a cat /opt/monitoring/README',sol:'ls /opt/monitoring\ncat /opt/monitoring/README',check:m=>m.ran('cat',e=>e.args.some(a=>a.includes('README')))},
 {t:'Zobraz unit súbor služby <code>sshd</code> cez systemctl.',h:'systemctl cat …',sol:'systemctl cat sshd',check:m=>m.ran('systemctl',e=>e.args[0]==='cat')}
]});

/* ---------------- 4 ---------------- */
CH({n:4, title:'Čítanie a hľadanie: cat, less, tail, grep, find', short:'Čítanie a hľadanie',
goal:'Rýchlo nájsť súbor podľa mena, veku či veľkosti a vytiahnuť z logu presne tie riadky, ktoré potrebuješ.',
body:[
['h','Čítanie súborov'],
['table',['Príkaz','Kedy'],[['<code>cat</code>','krátky súbor, vypíše celý'],['<code>less</code>','dlhý súbor, listuješ, hľadáš'],['<code>head</code>','prvých 10 riadkov'],['<code>tail</code>','posledných 10 riadkov'],['<code>tail -f</code>','log naživo počas reštartu služby']]],
['flags','less'],
['flags','tail'],
['cmd','tail -n 3 logy/app.log',''],
['cmd','sudo tail -f /var/log/secure','v realite beží, kým nestlačíš Ctrl+C'],
['h','grep: hľadanie v obsahu'],
['flags','grep'],
['cmd','grep ERROR logy/app.log',''],
['cmd','grep -i error logy/app.log','nájde aj „error“ malými'],
['cmd','grep -c ERROR logy/app.log','len počet'],
['cmd','grep -n -A1 Timeout logy/app.log','s číslom riadku a jedným riadkom po'],
['cmd','grep -v "^#" /etc/selinux/config','bez komentárov'],
['explain','grep -rnw /etc -e Listen'],
['tip','Kombinácia na čítanie konfigurácie bez balastu: <code>grep -Ev "^\\s*(#|$)" súbor</code>. Vyhodí komentáre aj prázdne riadky.'],
['h','Regulárne výrazy, ktoré stačia v praxi'],
['table',['Výraz','Znamená'],[['<code>^text</code>','riadok začína „text“'],['<code>text$</code>','riadok končí'],['<code>.</code>','ľubovoľný jeden znak'],['<code>.*</code>','čokoľvek'],['<code>[0-9]+</code>','jedna a viac číslic (s -E)'],['<code>a|b</code>','a alebo b (s -E)'],['<code>\\.</code>','skutočná bodka']]],
['h','find: hľadanie súborov'],
['flags','find'],
['cmd','find /etc -name "*.repo"',''],
['cmd','find / -name sshd_config 2>/dev/null','chyby „Permission denied“ zahodí'],
['cmd','find /var/log -type f -mmin -60','čo sa zmenilo za hodinu'],
['cmd','find /home -type f -size +1k','súbory nad 1 KiB'],
['cmd','find /usr/bin -perm -4000','SUID programy (bezpečnostný audit)'],
['explain','find /var/log -name "*.log" -mtime +30 -exec ls -lh {} \\;'],
['warn','Vzor v <code>-name</code> daj do úvodzoviek. Bez nich <code>find . -name *.log</code> rozbalí shell skôr, ako ho find uvidí, a ak v aktuálnom adresári nejaký .log je, hľadáš potom len ten jeden.'],
['warn','Pred <code>-delete</code> alebo <code>-exec rm</code> spusti ten istý find bez akcie a pozri, čo našiel.'],
['h','locate'],
['p','<code>locate</code> hľadá v databáze mien a je bleskový, ale na RHEL zvyčajne nie je nainštalovaný (balík <code>mlocate</code> na RHEL 9, <code>plocate</code> na RHEL 10) a databáza sa aktualizuje raz denne. Na serveroch sa spoľahni na <code>find</code>.']
],
quiz:[
 {q:'Ktorý prepínač grep vypíše riadky, ktoré vzor NEobsahujú?',o:['-n','-v','-x','-l'],a:1,w:'-v = invert match.'},
 {q:'Čo spraví <code>2>/dev/null</code> za príkazom find?',o:['Zahodí výsledky','Zahodí chybové hlásenia','Uloží výsledky','Zrýchli hľadanie'],a:1,w:'2 je chybový výstup (stderr), /dev/null je čierna diera.'},
 {q:'Ako nájdeš súbory väčšie ako 100 MiB v /var?',o:['find /var -size 100M','find /var -size +100M','find /var -big 100','grep -size +100M /var'],a:1,w:'+ znamená viac ako, - menej ako.'},
 {q:'Sleduješ log počas reštartu služby. Čo použiješ?',o:['cat -f','less -n','tail -f','head -f'],a:2,w:'tail -f vypisuje nové riadky, ako pribúdajú.'},
 {q:'Čo nájde <code>grep -w error</code>?',o:['error aj errors','len samostatné slovo error','Error aj ERROR','riadky bez error'],a:1,w:'-w = celé slovo.'}
],
ex:[
 {t:'Spočítaj, koľko riadkov v <code>~/logy/app.log</code> obsahuje <code>ERROR</code> alebo <code>error</code> (bez ohľadu na veľkosť písmen).',h:'grep -i a -c spolu: grep -ic',sol:'grep -ic error ~/logy/app.log',check:m=>m.ran('grep',e=>e.flags.has('i')&&e.flags.has('c'))},
 {t:'Vypíš z <code>/etc/selinux/config</code> len riadky, ktoré NIE sú komentáre (nezačínajú <code>#</code>).',h:'grep -v "^#"',sol:'grep -v "^#" /etc/selinux/config',check:m=>m.ran('grep',e=>e.flags.has('v') && e.args.some(a=>a.includes('#')))},
 {t:'Nájdi v celom <code>/etc</code> všetky súbory s príponou <code>.conf</code>. Chybové hlásenia zahoď.',h:'find /etc -name "*.conf" 2>/dev/null',sol:'find /etc -name "*.conf" 2>/dev/null',check:m=>m.ran('find',e=>e.args.includes('-name') && e.args.some(a=>a.includes('.conf')))},
 {t:'Nájdi v <code>/var/log</code> súbory (nie adresáre) a pre každý spusti <code>ls -l</code> cez <code>-exec</code>. Použi sudo.',h:'sudo find /var/log -type f -exec ls -l {} \\;',sol:'sudo find /var/log -type f -exec ls -l {} \\;',check:m=>m.ran('find',e=>e.args.includes('-exec') && e.args.includes('-type'))}
]});

/* ---------------- 5 ---------------- */
CH({n:5, title:'vim a vi', short:'vim a vi',
goal:'Otvoriť konfiguráciu na serveri, upraviť ju, uložiť a odísť. Potom zrýchliť: mazať, kopírovať, hľadať a nahrádzať bez myši.',
body:[
['p','Na každom RHEL serveri je <code>vi</code> (balík vim-minimal), na väčšine aj plný <code>vim</code> (vim-enhanced). <code>nano</code> je jednoduchší, ale nie je všade a v práci ťa vim skôr či neskôr dobehne: v <code>visudo</code>, <code>crontab -e</code>, <code>git commit</code>.'],
['p','Všetko si vyskúšaj v <a href="#vim">Vim trenažéri</a>: má lekcie s kontrolou a skutočný režim Normal/Insert. V termináli kapitol sa vim otvorí aj príkazom <code>vim súbor</code>.'],
['h','Režimy: celé tajomstvo vimu'],
['table',['Režim','Ako sa doň dostaneš','Čo robí'],[
 ['<b>Normal</b>','<kbd>Esc</kbd> (vždy funguje, stlač aj 2×)','klávesy sú príkazy: pohyb, mazanie, kopírovanie'],
 ['<b>Insert</b>','<kbd>i</kbd>, <kbd>a</kbd>, <kbd>o</kbd>…','píšeš text ako v Notepade. Dole je „-- INSERT --“'],
 ['<b>Command</b>','<kbd>:</kbd> v Normal režime','uloženie, koniec, nahrádzanie, nastavenia'],
 ['<b>Visual</b>','<kbd>v</kbd>, <kbd>V</kbd>','výber textu']]],
['h','Prežitie: uložiť a odísť'],
['table',['Príkaz','Čo spraví'],[['<code>:w</code>','ulož'],['<code>:q</code>','koniec (ak nie sú neuložené zmeny)'],['<code>:wq</code> alebo <code>:x</code> alebo <code>ZZ</code>','ulož a skonči'],['<code>:q!</code>','skonči a zahoď zmeny'],['<code>:w !sudo tee %</code>','otvoril si súbor bez sudo a nemôžeš uložiť: toto ho uloží cez sudo']]],
['warn','„E37: No write since last change“ = máš neuložené zmeny. Buď <code>:wq</code>, alebo <code>:q!</code>. „E45: readonly option is set“ = súbor nesmieš meniť, otvor ho so sudo.'],
['h','Ako sa dostať do Insert režimu'],
['table',['Kláves','Kam začneš písať'],[['<kbd>i</kbd>','pred kurzor'],['<kbd>a</kbd>','za kurzor (append)'],['<kbd>I</kbd>','na začiatok riadku'],['<kbd>A</kbd>','na koniec riadku'],['<kbd>o</kbd>','nový riadok pod'],['<kbd>O</kbd>','nový riadok nad']]],
['h','Pohyb v Normal režime'],
['table',['Kláves','Pohyb'],[['<kbd>h</kbd> <kbd>j</kbd> <kbd>k</kbd> <kbd>l</kbd>','vľavo, dole, hore, vpravo (šípky fungujú tiež)'],['<kbd>w</kbd> / <kbd>b</kbd>','na začiatok ďalšieho / predošlého slova'],['<kbd>0</kbd> / <kbd>$</kbd>','začiatok / koniec riadku'],['<kbd>gg</kbd> / <kbd>G</kbd>','začiatok / koniec súboru'],['<kbd>:42</kbd> alebo <kbd>42G</kbd>','na riadok 42 (keď ti chybová hláška povie číslo riadku)']]],
['h','Úpravy v Normal režime'],
['table',['Kláves','Čo spraví'],[['<kbd>x</kbd>','zmaže znak pod kurzorom'],['<kbd>dd</kbd>','zmaže (vystrihne) riadok'],['<kbd>3dd</kbd>','zmaže 3 riadky. Číslo pred príkazom = opakovanie'],['<kbd>dw</kbd>','zmaže slovo'],['<kbd>D</kbd>','zmaže do konca riadku'],['<kbd>yy</kbd>','skopíruje (yank) riadok'],['<kbd>p</kbd> / <kbd>P</kbd>','vloží pod / nad'],['<kbd>u</kbd>','späť (undo)'],['<kbd>Ctrl</kbd>+<kbd>r</kbd>','znova (redo)'],['<kbd>r</kbd>+znak','prepíše jeden znak'],['<kbd>cw</kbd>','zmaže slovo a prepne do Insert'],['<kbd>.</kbd>','zopakuje poslednú zmenu']]],
['p','Príkazy sú gramatika: <b>operátor + pohyb</b>. <code>d</code> (delete) + <code>w</code> (word) = zmaž slovo. <code>d$</code> = zmaž do konca riadku. <code>y</code> + <code>G</code> = skopíruj až po koniec súboru.'],
['h','Hľadanie a nahrádzanie'],
['table',['Príkaz','Čo spraví'],[['<code>/PermitRoot</code>','hľadá dopredu; <kbd>n</kbd> ďalší, <kbd>N</kbd> predošlý'],['<code>?slovo</code>','hľadá dozadu'],['<code>:%s/stare/nove/g</code>','nahradí v celom súbore (% = všetky riadky, g = všetky výskyty v riadku)'],['<code>:%s/stare/nove/gc</code>','to isté, ale pri každom sa spýta (c = confirm)'],['<code>:5,10s/^/#/</code>','zakomentuje riadky 5 až 10']]],
['h','Užitočné nastavenia'],
['table',['Príkaz','Čo spraví'],[['<code>:set number</code>','čísla riadkov (<code>:set nu</code>)'],['<code>:set nonumber</code>','vypne čísla'],['<code>:set paste</code>','pred vložením textu zo schránky, aby sa nerozbilo odsadenie'],['<code>:syntax on</code>','zvýraznenie syntaxe']]],
['h','Typický postup úpravy konfigurácie'],
['pre','sudo cp /etc/ssh/sshd_config{,.bak}   # záloha\nsudo vim /etc/ssh/sshd_config           # otvor\n/PermitRootLogin                        # nájdi\n0  x                                     # odkomentuj (zmaž #)\n:wq                                     # ulož\nsudo sshd -t                            # over syntax PRED reštartom\nsudo systemctl reload sshd'],
['tip','Väčšina služieb má príkaz na test konfigurácie: <code>sshd -t</code>, <code>apachectl configtest</code>, <code>nginx -t</code>, <code>visudo -c</code>, <code>findmnt --verify</code> pre fstab. Spusti ho vždy pred reštartom.']
],
quiz:[
 {q:'Si v Insert režime a chceš uložiť a odísť. Čo stlačíš?',o:[':wq','Esc a potom :wq','Ctrl+S','q'],a:1,w:'Príkazy s : fungujú len z Normal režimu, do neho sa dostaneš cez Esc.'},
 {q:'Čo spraví <code>5dd</code>?',o:['Zmaže 5. riadok','Zmaže 5 riadkov od kurzora','Skočí na riadok 5','Zmaže 5 znakov'],a:1,w:'Číslo pred príkazom ho opakuje.'},
 {q:'Ako nahradíš všetky „8080“ za „8443“ v celom súbore?',o:[':s/8080/8443/',':%s/8080/8443/g','/8080/8443',':replace 8080 8443'],a:1,w:'% = celý súbor, g = všetky výskyty v riadku.'},
 {q:'Upravil si súbor a chceš odísť BEZ uloženia.',o:[':q',':wq',':q!','ZZ'],a:2,w:'! vynúti akciu. ZZ ukladá.'},
 {q:'Kurzor je uprostred riadku, chceš písať na jeho koniec.',o:['a','A','o','$i'],a:1,w:'A = append na koniec riadku. o by vytvoril nový riadok.'}
],
ex:[
 {t:'Otvor v termináli <code>vim poznamky.txt</code>, pridaj na koniec nový riadok <code>- nainstalovat httpd</code> a ulož cez <code>:wq</code>.',h:'G (na koniec), o (nový riadok), napíš text, Esc, :wq',sol:'vim poznamky.txt\nG o - nainstalovat httpd  Esc  :wq',check:m=>(m.read('/home/admin/poznamky.txt')||'').includes('nainstalovat httpd')},
 {t:'Otvor <code>vim skripty/zaloha.sh</code> a zmeň <code>/tmp</code> na <code>/var/tmp</code> na všetkých miestach jedným príkazom. Ulož.',h:':%s#/tmp#/var/tmp#g   (namiesto / môžeš použiť # ako oddeľovač)',sol:':%s#/tmp#/var/tmp#g\n:wq',check:m=>{const t=m.read('/home/admin/skripty/zaloha.sh')||''; return t.includes('/var/tmp/etc-') && !/[^r]\/tmp\/etc/.test(t);}}
]});

/* ---------------- 6 ---------------- */
CH({n:6, title:'Rúry, presmerovanie a textové nástroje', short:'Rúry a presmerovanie',
goal:'Spájať malé príkazy do jedného riadku, ktorý z logu alebo výpisu vytiahne presne odpoveď na otázku.',
body:[
['p','Každý program má tri prúdy: <b>stdin</b> (0, vstup), <b>stdout</b> (1, normálny výstup) a <b>stderr</b> (2, chyby). Shell ich vie presmerovať do súborov alebo poslať ďalšiemu programu.'],
['table',['Zápis','Čo spraví'],[
 ['<code>prikaz > subor</code>','stdout do súboru, <b>prepíše</b> ho'],
 ['<code>prikaz >> subor</code>','stdout na koniec súboru'],
 ['<code>prikaz 2> chyby.txt</code>','len chyby do súboru'],
 ['<code>prikaz 2>/dev/null</code>','chyby zahoď'],
 ['<code>prikaz > vsetko.txt 2>&1</code>','stdout aj stderr do jedného súboru (poradie je dôležité!)'],
 ['<code>prikaz &> vsetko.txt</code>','to isté, kratšie (bash)'],
 ['<code>prikaz < subor</code>','súbor ako vstup'],
 ['<code>a | b</code>','<b>rúra</b>: stdout príkazu a ide na stdin príkazu b']]],
['warn','<code>></code> súbor bez varovania prepíše. <code>sort subor > subor</code> ti súbor vymaže: shell ho otvorí na zápis (vyprázdni) skôr, ako ho sort prečíta.'],
['h','Spájanie príkazov'],
['table',['Zápis','Kedy sa spustí druhý'],[['<code>a ; b</code>','vždy'],['<code>a && b</code>','len ak a uspel (návratový kód 0)'],['<code>a || b</code>','len ak a zlyhal']]],
['cmd','sudo sshd -t && sudo systemctl reload sshd','reload len ak je konfigurácia v poriadku'],
['p','Návratový kód posledného príkazu je v <code>$?</code>. 0 = úspech, čokoľvek iné = chyba.'],
['h','Nástroje, ktoré sa skladajú'],
['flags','wc'],['flags','sort'],['flags','uniq'],['flags','cut'],
['h','Príklady z praxe'],
['cmd','sort data/prihlasenia.txt | uniq -c | sort -rn','kto sa prihlasoval najčastejšie'],
['explain','sort data/prihlasenia.txt | uniq -c | sort -rn'],
['cmd','cut -d: -f1,7 /etc/passwd','používateľ a jeho shell'],
['cmd','grep -c "" /etc/passwd','koľko riadkov (účtov)'],
['cmd','sudo grep "Failed password" /var/log/secure | wc -l','koľko neúspešných SSH prihlásení'],
['cmd','ps aux | grep sshd','procesy sshd'],
['h','awk a sed v jednom riadku'],
['flags','awk'],
['cmd',"awk -F, '{print $1, $2}' data/servery.csv",'meno a IP zo CSV'],
['cmd',"df -h | awk '{print $5, $6}'",'obsadenosť a kam je disk pripojený'],
['flags','sed'],
['cmd',"sed 's/RHEL 8/RHEL 9/' data/servery.csv",'len ukáže výsledok, súbor sa nemení'],
['h','tee a sudo'],
['flags','tee'],
['warn','<code>sudo echo "x" >> /etc/hosts</code> skončí „Permission denied“. sudo platí pre echo, ale presmerovanie >> robí tvoj neprivilegovaný shell. Správne: <code>echo "x" | sudo tee -a /etc/hosts</code>.'],
['cmd','echo "10.0.20.50  mon01.firma.local mon01" | sudo tee -a /etc/hosts','']
],
quiz:[
 {q:'Prečo <code>uniq -c</code> nespočíta správne bez <code>sort</code>?',o:['uniq číta len prvý riadok','uniq zlučuje len susedné rovnaké riadky','uniq nevie čísla','Spočíta správne'],a:1,w:'jana, peter, jana by uniq bral ako tri rôzne skupiny.'},
 {q:'Čo spraví <code>prikaz > log.txt 2>&1</code>?',o:['Len chyby do log.txt','Stdout aj stderr do log.txt','Stdout do súboru 2','Chyby na obrazovku'],a:1,w:'2>&1 = stderr pošli tam, kam práve ide stdout.'},
 {q:'Prečo nefunguje <code>sudo echo x >> /etc/hosts</code>?',o:['echo nevie písať do súborov','Presmerovanie robí shell bez rootu','/etc/hosts je len na čítanie pre všetkých','Treba -a'],a:1,w:'Riešenie: echo x | sudo tee -a /etc/hosts.'},
 {q:'Kedy sa spustí <code>b</code> v <code>a && b</code>?',o:['Vždy','Len ak a uspel','Len ak a zlyhal','Súčasne s a'],a:1,w:'&& = a zároveň; || = inak.'}
],
ex:[
 {t:'Zo súboru <code>~/data/prihlasenia.txt</code> sprav rebríček: koľkokrát sa kto prihlásil, zoradené od najčastejšieho.',h:'sort | uniq -c | sort -rn',sol:'sort ~/data/prihlasenia.txt | uniq -c | sort -rn',check:m=>m.ran('uniq',e=>e.flags.has('c')) && m.ran('sort',e=>e.flags.has('n')&&e.flags.has('r'))},
 {t:'Ulož všetky riadky s <code>ERROR</code> z <code>~/logy/app.log</code> do súboru <code>~/chyby.txt</code>.',h:'grep ERROR … > ~/chyby.txt',sol:'grep ERROR ~/logy/app.log > ~/chyby.txt',check:m=>{const t=m.read('/home/admin/chyby.txt')||''; return (t.match(/ERROR/g)||[]).length===3;}},
 {t:'Vypíš z <code>~/data/servery.csv</code> len stĺpec <code>meno</code> a <code>os</code> (1. a 3.). Použi cut alebo awk.',h:'cut -d, -f1,3 alebo awk -F, \'{print $1, $3}\'',sol:'cut -d, -f1,3 ~/data/servery.csv',check:m=>m.ran('cut',e=>e.args.some(a=>/1,3/.test(a))) || m.ran('awk',e=>e.args.some(a=>a.includes('$1')&&a.includes('$3')))},
 {t:'Pridaj do <code>/etc/hosts</code> riadok <code>10.0.20.50 mon01</code>. Použi tee so sudo.',h:'echo "…" | sudo tee -a /etc/hosts',sol:'echo "10.0.20.50 mon01" | sudo tee -a /etc/hosts',check:m=>/10\.0\.20\.50\s+mon01/.test(m.read('/etc/hosts')||'')}
]});

/* ---------------- 7 ---------------- */
CH({n:7, title:'Používatelia, skupiny a sudo', short:'Používatelia a sudo',
goal:'Vytvoriť účet kolegovi, dať mu sudo, nastaviť platnosť hesla a vedieť, čo je v /etc/passwd a /etc/shadow.',
body:[
['h','/etc/passwd: zoznam účtov'],
['out','grep admin /etc/passwd','admin:x:1000:1000:Admin:/home/admin:/bin/bash'],
['table',['Pole','Hodnota','Význam'],[['1','admin','login'],['2','x','heslo je v /etc/shadow'],['3','1000','UID. 0 = root, 1–999 systémové účty, od 1000 ľudia'],['4','1000','GID primárnej skupiny'],['5','Admin','komentár (celé meno)'],['6','/home/admin','domovský adresár'],['7','/bin/bash','shell. /sbin/nologin = prihlásiť sa nedá (servisné účty)']]],
['p','<code>/etc/shadow</code> obsahuje hash hesla a údaje o jeho platnosti. Čítať ho smie len root. <code>!!</code> alebo <code>!</code> v poli hesla = heslo nenastavené alebo účet zamknutý.'],
['p','<code>/etc/group</code>: <code>wheel:x:10:admin,jana</code> = skupina wheel, GID 10, doplnkoví členovia admin a jana.'],
['h','Správa účtov'],
['flags','useradd'],
['flags','usermod'],
['warn','<code>usermod -G wheel jana</code> bez <code>-a</code> vyhodí janu zo VŠETKÝCH ostatných doplnkových skupín. Vždy píš <code>-aG</code>.'],
['flags','passwd'],
['flags','chage'],
['cmd','sudo useradd -c "Jana Kováčová" jana',''],
['cmd','sudo passwd jana','v simulátore sa heslo nastaví samo'],
['cmd','sudo usermod -aG wheel jana',''],
['cmd','id jana',''],
['tip','Nové členstvo v skupine platí až po novom prihlásení. Používateľ musí odísť a znova sa pripojiť (alebo <code>newgrp</code>).'],
['h','sudo a wheel'],
['p','Na RHEL je v <code>/etc/sudoers</code> riadok <code>%wheel ALL=(ALL) ALL</code>: kto je v skupine wheel, smie cez sudo všetko (po zadaní <b>svojho</b> hesla). To je štandardný spôsob, ako dať adminovi práva.'],
['p','Jemnejšie pravidlá patria do vlastného súboru v <code>/etc/sudoers.d/</code>, nie do hlavného súboru:'],
['pre','# /etc/sudoers.d/monitoring\n# skupina monitoring smie len reštartovať agenta, bez hesla\n%monitoring ALL=(root) NOPASSWD: /usr/bin/systemctl restart agent'],
['warn','sudoers upravuj vždy cez <code>sudo visudo</code> (alebo <code>sudo visudo -f /etc/sudoers.d/meno</code>). visudo pred uložením skontroluje syntax. Preklep v sudoers bez visudo = nikto už nemá sudo a na server sa dostaneš len cez konzolu.'],
['flags','sudo'],
['h','Rýchly prehľad'],
['table',['Úloha','Príkaz'],[['kto som, aké skupiny','<code>id</code>'],['kto je prihlásený','<code>w</code>, <code>who</code>'],['posledné prihlásenia','<code>last</code>'],['zamkni účet','<code>sudo usermod -L jana</code> alebo <code>passwd -l</code>'],['vynúť zmenu hesla','<code>sudo chage -d 0 jana</code>'],['zmaž s domovom','<code>sudo userdel -r jana</code>']]],
['new','Na RHEL 10 inštalátor Anaconda pri vytváraní používateľa predvolene zaškrtne „pridať administrátorské práva“ (skupina wheel). Na RHEL 9 bolo predvolene vypnuté.']
],
quiz:[
 {q:'Čo znamená 7. pole <code>/sbin/nologin</code> v /etc/passwd?',o:['Účet je zmazaný','Účet sa nemôže interaktívne prihlásiť','Účet nemá heslo','Účet je root'],a:1,w:'Typické pre servisné účty ako apache, chrony.'},
 {q:'Ako pridáš janu do wheel a ponecháš jej ostatné skupiny?',o:['usermod -G wheel jana','usermod -aG wheel jana','useradd -G wheel jana','groupadd wheel jana'],a:1,w:'-a = append.'},
 {q:'Prečo sudoers upravuješ cez visudo?',o:['Je rýchlejší','Kontroluje syntax pred uložením','Inak sa súbor nedá otvoriť','Zálohuje heslá'],a:1,w:'Chybný sudoers ti zoberie sudo.'},
 {q:'Aké UID majú bežní používatelia na RHEL?',o:['0','1–99','od 1000','od 65534'],a:2,w:'UID_MIN 1000 v /etc/login.defs.'}
],
ex:[
 {t:'Vytvor používateľa <code>jana</code> s komentárom <code>Jana Kovacova</code>.',h:'sudo useradd -c "…" jana',sol:'sudo useradd -c "Jana Kovacova" jana',check:m=>!!m.users.jana && /Jana/.test(m.users.jana.gecos)},
 {t:'Nastav jane heslo a pridaj ju do skupiny <code>wheel</code>, aby smela používať sudo.',h:'sudo passwd jana; sudo usermod -aG wheel jana',sol:'sudo passwd jana\nsudo usermod -aG wheel jana',check:m=>m.users.jana && m.users.jana.pw && m.groups.wheel.mem.includes('jana')},
 {t:'Nastav, aby jane heslo platilo najviac 90 dní, a over si to.',h:'sudo chage -M 90 jana; chage -l jana',sol:'sudo chage -M 90 jana\nsudo chage -l jana',check:m=>m.users.jana && m.users.jana.maxdays===90},
 {t:'Vytvor skupinu <code>monitoring</code> a používateľa <code>agent</code> bez možnosti prihlásenia (shell <code>/sbin/nologin</code>) s doplnkovou skupinou monitoring.',h:'sudo groupadd monitoring; sudo useradd -s /sbin/nologin -G monitoring agent',sol:'sudo groupadd monitoring\nsudo useradd -s /sbin/nologin -G monitoring agent',check:m=>m.users.agent && m.users.agent.shell==='/sbin/nologin' && m.groups.monitoring && m.groups.monitoring.mem.includes('agent')}
]});

/* ---------------- 8 ---------------- */
CH({n:8, title:'Práva: chmod, chown, umask, ACL', short:'Práva súborov',
goal:'Čítať a nastavovať práva číselne aj symbolicky a vyriešiť „Permission denied“.',
body:[
['h','rwx pre troch'],
['out','ls -l skripty/zaloha.sh','-rw-r--r--. 1 admin admin 142 Nov  1 09:00 zaloha.sh'],
['table',['Znak','Pre súbor','Pre adresár','Číslo'],[['<code>r</code>','čítať obsah','vypísať zoznam súborov (ls)','4'],['<code>w</code>','meniť obsah','vytvárať, mazať, premenovať súbory v ňom','2'],['<code>x</code>','spustiť ako program','vstúpiť (cd) a pristupovať k súborom','1']]],
['p','Tri trojice: <b>u</b> (user, vlastník) · <b>g</b> (group, skupina) · <b>o</b> (others, ostatní). Číslo trojice je súčet: rwx = 4+2+1 = 7, r-x = 5, rw- = 6, r-- = 4.'],
['table',['Číselne','Symbolicky','Typické použitie'],[['<code>644</code>','rw-r--r--','bežný súbor, konfigurácia'],['<code>600</code>','rw-------','súkromný kľúč, heslá'],['<code>755</code>','rwxr-xr-x','adresár, skript pre všetkých'],['<code>700</code>','rwx------','~/.ssh, súkromný adresár'],['<code>775</code>','rwxrwxr-x','zdieľaný adresár skupiny'],['<code>440</code>','r--r-----','/etc/sudoers']]],
['flags','chmod'],
['cmd','chmod u+x skripty/zaloha.sh','pridá vlastníkovi spúšťanie'],
['cmd','chmod 750 skripty','číselne'],
['cmd','ls -l skripty/zaloha.sh',''],
['cmd','./skripty/zaloha.sh','teraz sa dá spustiť'],
['flags','chown'],
['h','umask'],
['p','Nový súbor by mal 666, adresár 777. umask z toho odoberie bity. Root má umask 022 (súbor 644), bežný používateľ na RHEL 002 (súbor 664), lebo každý má vlastnú primárnu skupinu.'],
['h','Špeciálne bity'],
['table',['Bit','Zobrazí sa','Význam'],[['SUID (4000)','<code>rwsr-xr-x</code>','program beží s právami vlastníka. Napr. /usr/bin/passwd (vlastník root)'],['SGID (2000)','<code>rwxr-sr-x</code>','na adresári: nové súbory dostanú skupinu adresára. Ideálne na zdieľané adresáre tímu'],['sticky (1000)','<code>rwxrwxrwt</code>','na adresári: mazať smie len vlastník súboru. Preto /tmp']]],
['cmd','ls -ld /tmp',''],
['h','ACL: práva pre konkrétneho človeka'],
['p','Keď nestačí vlastník/skupina/ostatní (napríklad „jana má čítať tento log, ale nie je v skupine“), použiješ ACL. Súbor s ACL má v ls -l znak <code>+</code>.'],
['flags','setfacl'],
['cmd','setfacl -m u:jana:r poznamky.txt','(v simulátore musí jana existovať)'],
['cmd','getfacl poznamky.txt',''],
['h','Postup pri „Permission denied“'],
['list',['Kto som? <code>id</code>','Aké práva má súbor A KAŽDÝ adresár na ceste? <code>namei -l /cesta/k/suboru</code> alebo <code>ls -ld</code> postupne. Chýbajúce <code>x</code> na adresári zablokuje všetko pod ním.','Je tam ACL? (<code>+</code> v ls -l, potom getfacl)','Ak práva sedia a stále to nejde, je to takmer vždy <b>SELinux</b> (kapitola 14).']]
],
quiz:[
 {q:'Aké práva znamená 640?',o:['rw-r-----','rwxr-----','rw-rw----','r--r-----'],a:0,w:'6 = rw-, 4 = r--, 0 = ---.'},
 {q:'Čo potrebuješ na adresári, aby si doň mohol vojsť cez cd?',o:['r','w','x','s'],a:2,w:'x na adresári = prístup.'},
 {q:'Prečo má /tmp práva <code>drwxrwxrwt</code>?',o:['Aby ho mohol každý zmazať','Sticky bit: súbor maže len vlastník','Je to chyba','Aby sa spúšťali programy'],a:1,w:'Všetci tam píšu, ale nikto nezmaže cudzí súbor.'},
 {q:'Ktorý príkaz pridá skupine zápis a ostatným nič nemení?',o:['chmod 020 f','chmod g+w f','chmod g=w f','chown g+w f'],a:1,w:'g=w by skupine nastavilo LEN zápis (zobralo r a x).'}
],
ex:[
 {t:'Sprav skript <code>~/skripty/zaloha.sh</code> spustiteľným pre vlastníka a spusti ho.',h:'chmod u+x …, potom ./skripty/zaloha.sh',sol:'chmod u+x ~/skripty/zaloha.sh\n~/skripty/zaloha.sh',check:m=>{const n=m.node('/home/admin/skripty/zaloha.sh'); return n && (n.m&0o100) && m.log.some(e=>e.name.includes('zaloha.sh') || (e.name==='bash'&&e.args.some(a=>a.includes('zaloha'))));}},
 {t:'Nastav súboru <code>~/poznamky.txt</code> práva tak, aby ho čítal a menil len vlastník (nikto iný nič).',h:'chmod 600',sol:'chmod 600 ~/poznamky.txt',check:m=>(m.node('/home/admin/poznamky.txt').m&0o777)===0o600},
 {t:'Vytvor zdieľaný adresár <code>/srv/tim</code> s vlastníkom root, skupinou <code>wheel</code>, prístupom rwx pre vlastníka a skupinu, nič pre ostatných, a so SGID bitom.',h:'sudo mkdir /srv/tim; sudo chown root:wheel /srv/tim; sudo chmod 2770 /srv/tim',sol:'sudo mkdir /srv/tim\nsudo chown root:wheel /srv/tim\nsudo chmod 2770 /srv/tim',check:m=>{const n=m.node('/srv/tim'); return n && n.g==='wheel' && (n.m&0o7777)===0o2770;}}
]});

/* ---------------- 9 ---------------- */
CH({n:9, title:'Procesy, pamäť a disky na prvý pohľad', short:'Procesy a výkon',
goal:'Zistiť, čo server spomaľuje, kto žerie pamäť alebo disk, a korektne ukončiť proces.',
body:[
['h','Rýchla diagnostika za 30 sekúnd'],
['table',['Otázka','Príkaz'],[['aká je záťaž?','<code>uptime</code> (load average 1, 5, 15 min)'],['čo žerie CPU/RAM?','<code>top</code>, potom <kbd>P</kbd> / <kbd>M</kbd>'],['je dosť pamäte?','<code>free -h</code>, pozri stĺpec <b>available</b>'],['je plný disk?','<code>df -h</code>'],['čo zaberá miesto?','<code>sudo du -sh /var/* | sort -h</code>'],['čo hovorí jadro?','<code>sudo dmesg -T | tail</code>']]],
['p','<b>Load average</b> je priemerný počet procesov, ktoré chcú CPU alebo čakajú na disk. Porovnávaj ho s počtom jadier (<code>nproc</code>): load 2 na 2-jadrovom stroji = plne vyťažený, load 8 = procesy čakajú.'],
['h','ps'],
['flags','ps'],
['cmd','ps aux | head -n 5',''],
['explain','ps aux'],
['p','<code>ps aux</code> je výnimka: BSD štýl bez pomlčky. <code>ps -aux</code> síce tiež funguje, ale formálne je to niečo iné. Zapamätaj si dve podoby: <code>ps aux</code> a <code>ps -ef</code>.'],
['cmd','ps -ef | grep sshd',''],
['cmd','pgrep -l sshd','čistejšie: len PID a meno'],
['h','top'],
['flags','top'],
['cmd','top',''],
['h','Signály a kill'],
['flags','kill'],
['p','Postup: najprv <code>kill PID</code> (TERM), počkaj pár sekúnd, až potom <code>kill -9 PID</code>. Služby spravované systemd neukončuj killom, ale <code>systemctl stop</code>, inak ich systemd môže hneď znova spustiť.'],
['h','Pamäť'],
['flags','free'],
['cmd','free -h',''],
['p','Linux využíva voľnú RAM ako cache disku, preto je „free“ malé. Dôležité je <b>available</b>. Ak swap rastie a available klesá, server má naozaj málo pamäte.'],
['h','Disky'],
['flags','df'],
['flags','du'],
['cmd','df -hT',''],
['cmd','sudo du -sh /var/*',''],
['tip','„Disk je plný“ v 80 % prípadov znamená /var/log alebo /var/lib (databáza, kontajnery). Ak df ukazuje plný disk, ale du nenájde veľké súbory, nejaký proces drží otvorený zmazaný súbor: <code>sudo lsof +L1</code>, potom reštart tej služby.']
],
quiz:[
 {q:'Server má 4 jadrá, load average 0.5 1.2 3.8. Čo to znamená?',o:['Záťaž rastie','Záťaž klesá, pred 15 min bola vyššia','Server je preťažený','Údaje sú chybné'],a:1,w:'Poradie je 1, 5, 15 minút. 3.8 pred štvrťhodinou, teraz 0.5.'},
 {q:'Ktorý stĺpec free -h povie, koľko pamäte reálne dostanú nové programy?',o:['free','used','available','buff/cache'],a:2,w:'available započítava aj cache, ktorú jadro uvoľní.'},
 {q:'Proces neodpovedá na kill PID. Čo ďalej?',o:['reboot','kill -9 PID','kill -1 PID','rm /proc/PID'],a:1,w:'SIGKILL ukončí proces bez možnosti odporu.'},
 {q:'Čo znamená a, u, x v <code>ps aux</code>?',o:['all, user formát, aj bez terminálu','auto, update, exit','admin, users, extra','nič, je to jedno slovo'],a:0,w:'Tri samostatné BSD voľby.'}
],
ex:[
 {t:'Zobraz všetky procesy v plnom formáte so stĺpcom PPID (System V štýl).',h:'ps -ef',sol:'ps -ef',check:m=>m.ran('ps',e=>e.args.join(' ').includes('-ef'))},
 {t:'Zisti obsadenosť diskov v čitateľnom formáte aj s typom súborového systému.',h:'df -hT',sol:'df -hT',check:m=>m.ran('df',e=>e.flags.has('h')&&e.flags.has('T'))},
 {t:'Zisti, koľko miesta zaberá adresár <code>/var/log</code> (jeden súčet, čitateľne).',h:'sudo du -sh /var/log',sol:'sudo du -sh /var/log',check:m=>m.ran('du',e=>e.flags.has('s')&&e.flags.has('h'))},
 {t:'Zisti dostupnú pamäť v čitateľnom formáte.',h:'free -h',sol:'free -h',check:m=>m.ran('free',e=>e.flags.has('h'))}
]});
