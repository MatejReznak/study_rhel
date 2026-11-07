/* =========================================================
   SKUTOČNÝ SERVER: návod (Mac s Apple čipom + UTM + RHEL)
   a úlohy „na skutočnom serveri“ ku každej kapitole
   ========================================================= */
(function(){
window.LAB_GUIDE = [
 {id:'g0', t:'Čo budeš potrebovať', b:[
  ['list',['Mac s Apple čipom (M1 a novší), ideálne 16 GB RAM (s 8 GB to ide, daj VM 3 GB).','Asi 60 GB voľného miesta (ISO + 1 až 2 virtuálky).','Bezplatný účet Red Hat Developer.','Aplikáciu UTM (zadarmo) na virtuálne počítače.','1 až 2 hodiny na prvú inštaláciu.']],
  ['tip','Na Macu s Apple čipom musíš použiť RHEL pre architektúru <b>aarch64 (ARM)</b>. Verzia x86_64 by bežala len v emulácii, veľmi pomaly.']
 ]},
 {id:'g1', t:'1. Účet Red Hat Developer (zadarmo)', b:[
  ['list',['Otvor <a href="https://developers.redhat.com/register" target="_blank" rel="noopener">developers.redhat.com/register</a> a zaregistruj sa (stačí e-mail).','Účet obsahuje <b>Red Hat Developer Subscription for Individuals</b>: plnohodnotný RHEL zadarmo, až 16 systémov, pre jednotlivca (nie pre firemnú produkciu).','Predplatné platí rok. Keď vyprší, obnovíš ho prihlásením a obnovou na stránke Red Hat Developer.']],
  ['warn','Tento účet je tvoj súkromný na učenie. Firemné servery majú firemné predplatné, tam ho nepoužívaj.']
 ]},
 {id:'g2', t:'2. Stiahni RHEL pre ARM', b:[
  ['list',['Choď na <a href="https://developers.redhat.com/products/rhel/download" target="_blank" rel="noopener">developers.redhat.com/products/rhel/download</a> a prihlás sa.','Vyber najnovšiu verziu RHEL 9 a pri nej <b>aarch64</b> → <b>DVD ISO</b> (približne 8 až 10 GB, obsahuje všetky balíky).','Neskôr si rovnako stiahni aj najnovší RHEL 10 aarch64 (na porovnávanie v kapitole 24).']],
  ['tip','Boot ISO je menšie, ale balíky sťahuje z internetu až po registrácii. Na začiatok je jednoduchšie DVD ISO.']
 ]},
 {id:'g3', t:'3. Nainštaluj UTM', b:[
  ['list',['Stiahni UTM z <a href="https://getutm.app" target="_blank" rel="noopener">getutm.app</a> (zadarmo, súbor .dmg). Verzia v App Store je platená, ale funkčne rovnaká (podporuješ ňou autorov).','Otvor .dmg a presuň UTM do priečinka Aplikácie.']]
 ]},
 {id:'g4', t:'4. Vytvor virtuálny počítač', b:[
  ['list',['V UTM klikni <b>Create a New Virtual Machine</b> → <b>Virtualize</b> → <b>Linux</b>.','<b>Hardware:</b> Memory <code>4096</code> MB, CPU Cores <code>2</code>. Nenechávaj 0 (Default), to by VM dostala všetky jadrá a Mac by sa spomalil.','<b>Boot ISO Image:</b> Browse → vyber stiahnuté RHEL aarch64 DVD ISO.','<b>Storage:</b> <code>40</code> GB (miesto sa zaberá postupne, nie hneď).','<b>Shared Directory:</b> preskoč (Continue).','<b>Summary:</b> meno <code>rhel9-lab</code> → <b>Save</b>.']],
  ['tip','Sieť nechaj na predvolenom <b>Shared Network</b>. Režim Bridged na Macu s RHEL často nefunguje.']
 ]},
 {id:'g5', t:'5. Inštalácia RHEL (Anaconda)', b:[
  ['list',['Spusti VM (▶). V menu vyber <b>Install Red Hat Enterprise Linux</b>.','Jazyk: odporúčam <b>English</b>. Chybové hlášky potom presne vyhľadáš na internete a zhodujú sa s kurzom. V <b>Keyboard</b> pridaj aj Slovak.','<b>Installation Destination:</b> klikni na disk, nechaj Automatic → Done. Vznikne LVM ako v kurze (rhel-root, rhel-swap).','<b>Network &amp; Host Name:</b> prepni Ethernet na <b>ON</b>, hostname napr. <code>rhel9-lab.local</code> → Apply → Done.','<b>Software Selection:</b> <b>Server</b> (bez grafiky) alebo <b>Minimal Install</b>.','<b>Connect to Red Hat:</b> zadaj meno a heslo Red Hat účtu → Register. Ak to nejde, zaregistruješ server neskôr príkazom.','<b>Root Password:</b> nastav silné heslo (zapíš si ho).','<b>User Creation:</b> používateľ <code>admin</code>, zaškrtni <b>Make this user administrator</b> (= skupina wheel, smie sudo).','<b>Begin Installation</b> → po skončení <b>Reboot System</b>.']]
 ]},
 {id:'g6', t:'6. Vyber ISO a prvé spustenie', b:[
  ['list',['Ak sa po reštarte znova spustí inštalátor, VM vypni. V hlavnom okne UTM pri položke <b>CD/DVD</b> daj <b>Clear</b> (vysunie ISO) a spusti VM znova.','Prihlás sa ako <code>admin</code>.']],
  ['cmd','ip -br a','zistí IP adresu (pri Shared Network typicky 192.168.64.x)'],
  ['cmd','sudo rhc connect','registrácia, ak si ju nespravil pri inštalácii (alebo sudo subscription-manager register)'],
  ['cmd','sudo dnf update -y && sudo reboot','aktualizácia a reštart']
 ]},
 {id:'g7', t:'7. Pracuj cez SSH z Macu', b:[
  ['p','Konzola v okne UTM je nepohodlná (kopírovanie, malé písmo). Pracuj z aplikácie <b>Terminál</b> na Macu:'],
  ['pre','# na Macu\nssh admin@192.168.64.5          # tvoja IP z ip -br a\nssh-keygen -t ed25519            # kľúč na Macu (raz)\nssh-copy-id admin@192.168.64.5   # skopíruje kľúč na server\n\n# ~/.ssh/config na Macu\nHost rhel9\n    HostName 192.168.64.5\n    User admin\n\n# potom stačí\nssh rhel9'],
  ['cmd','sudo systemctl enable --now cockpit.socket','webová konzola: na Macu otvor https://IP:9090']
 ]},
 {id:'g8', t:'8. Záloha pred pokusmi', b:[
  ['p','UTM nemá v GUI snapshoty. Pred riskantnou kapitolou (boot, fstab, upgrade) <b>VM vypni</b>, v UTM na ňu klikni pravým tlačidlom → <b>Clone</b>. Ak niečo pokazíš, zmažeš pokazenú a pokračuješ s klonom.'],
  ['tip','Klon zaberá miesto. Staré klony priebežne mažeš.']
 ]},
 {id:'g9', t:'9. Druhý disk (kapitola 15)', b:[
  ['list',['VM vypni → Edit (ikona posuvníkov) → <b>Drives</b> → <b>New…</b> → Interface <b>VirtIO</b>, Size <code>10</code> GB → Save.','Na serveri ho uvidíš ako <code>/dev/vdb</code> (v simulátore je to <code>/dev/sdb</code>).']],
  ['cmd','lsblk','over, že vidíš vda (systém) a vdb (nový disk)']
 ]},
 {id:'g10', t:'10. Rozdiely oproti simulátoru', b:[
  ['table',['Vec','Simulátor','Tvoja VM v UTM'],[['Sieťové rozhranie','ens192','napr. enp0s1 (zisti: ip -br a)'],['Disky','sda, sdb','vda, vdb (VirtIO)'],['IP adresa','10.0.20.31','napr. 192.168.64.x'],['Iné servery (db01, web02)','existujú','neexistujú: použi druhú VM (rhel10-lab) alebo Mac'],['Architektúra','x86_64','aarch64 (balíky majú .aarch64)']]]
 ]},
 {id:'g11', t:'Keď niečo nejde', b:[
  ['table',['Problém','Čo skúsiť'],[['VM nemá sieť / nevidím IP','UTM → Edit → Network: Shared Network. Na serveri: nmcli con show a sudo nmcli con up NÁZOV.'],['Inštalátor sa nespustí, čierna obrazovka','Máš aarch64 ISO? x86_64 na Apple čipe nepôjde.'],['„This system is not registered“, dnf nemá repozitáre','sudo rhc connect (prihlásenie Red Hat účtom), potom sudo dnf repolist.'],['Po reštarte zase inštalátor','UTM: CD/DVD → Clear.'],['Mac je pomalý','Daj VM menej RAM/CPU, vypni nepoužívané VM.'],['Zabudnuté heslo','Výborné cvičenie: reset cez rd.break (kapitola 20).'],['Pokazil som všetko','Zmaž VM a použi klon, alebo nainštaluj znova (10 minút).']]]
 ]}
];

/* úlohy na skutočnom serveri ku kapitolám: t = čo urobiť, ok = čo uvidíš, w = upozornenie */
window.LAB_TASKS = {
 1:[{t:'Pripoj sa z Macu cez SSH a zisti verziu systému a architektúru: <code>cat /etc/redhat-release</code>, <code>uname -r</code>, <code>uname -m</code>.', ok:'Vidíš presnú verziu RHEL a <code>aarch64</code>.'},
    {t:'Otvor <code>man ls</code>, vyhľadaj <code>/sort</code>, skáč <code>n</code> a ukonči <code>q</code>.', ok:'Vieš sa v man stránke pohybovať bez myši.'},
    {t:'Skús Tab dopĺňanie: napíš <code>systemctl sta</code> a stlač dvakrát Tab. Potom Ctrl+R a hľadaj v histórii.', ok:'Bash ti ponúkne podpríkazy (start, status…) a nájde staršie príkazy.'}],
 2:[{t:'Vytvor štruktúru <code>mkdir -p ~/lab/{a,b,c}/x</code>, nainštaluj <code>tree</code> a pozri ju. Kopíruj, presúvaj a maž v nej.', ok:'<code>tree ~/lab</code> ukáže, čo si spravil.'},
    {t:'Porovnaj <code>cp</code> a <code>cp -a</code> na tom istom súbore a pozri <code>stat</code> oboch kópií.', ok:'Pri <code>-a</code> ostal pôvodný čas zmeny.'},
    {t:'Zisti 5 najväčších súborov v <code>/var/log</code>: <code>sudo ls -lhS /var/log | head -6</code>.', ok:'Vieš, ktoré logy rastú najviac.'}],
 3:[{t:'Pozri <code>ls -l /</code>: ktoré položky sú odkazy (bin, sbin, lib)? Kam ukazujú?', ok:'Na RHEL sú to odkazy do <code>/usr</code>.'},
    {t:'Nainštaluj <code>httpd</code> a zisti, kam dal súbory: <code>rpm -ql httpd | less</code> a <code>rpm -qc httpd</code>.', ok:'Konfigurácia je v <code>/etc/httpd</code>, obsah webu v <code>/var/www</code>, logy v <code>/var/log/httpd</code>.'},
    {t:'Porovnaj <code>df -h</code> a <code>lsblk</code> s Mapou súborov v kurze. Kde je <code>/boot</code>, kde koreň a swap?', ok:'Vidíš LVM zväzky rhel-root a rhel-swap.'}],
 4:[{t:'Otvor dva terminály. V prvom <code>sudo tail -f /var/log/secure</code>, v druhom sa z Macu prihlás so zlým heslom.', ok:'Naživo vidíš „Failed password for …“.'},
    {t:'<code>sudo grep -rn PermitRootLogin /etc/ssh/</code> a <code>sudo find /etc -mmin -60</code> po tom, ako niečo zmeníš.', ok:'Vieš nájsť nastavenie aj čerstvo zmenené súbory.'},
    {t:'<code>sudo find / -xdev -size +100M -type f 2&gt;/dev/null</code>', ok:'Zoznam veľkých súborov bez chýb Permission denied.'}],
 5:[{t:'Nainštaluj <code>vim-enhanced</code> a prejdi <code>vimtutor</code> (lekcie 1 až 4, asi 30 minút).', ok:'Pohyb, mazanie, undo a ukladanie ti idú bez rozmýšľania.'},
    {t:'Skopíruj <code>/etc/ssh/sshd_config</code> do <code>~/sshd.test</code> a vo vime: <code>/Port</code>, <code>dd</code>, <code>u</code>, <code>:%s/yes/no/gc</code>, <code>:wq</code>.', ok:'Vieš hľadať, mazať, vracať a hromadne nahrádzať.'},
    {t:'Vytvor <code>~/.vimrc</code> s riadkom <code>set number</code> a otvor ľubovoľný súbor.', ok:'Vim ukazuje čísla riadkov vždy.'}],
 6:[{t:'Koľko neúspešných SSH prihlásení bolo dnes? <code>sudo journalctl -u sshd --since today | grep -c Failed</code>', ok:'Číslo (napr. z úlohy v kapitole 4).'},
    {t:'Top 5 procesov podľa pamäte: <code>ps aux --sort=-%mem | head -6</code>', ok:'Vidíš, čo zaberá RAM.'},
    {t:'Odkiaľ sú TCP spojenia? <code>ss -tn | awk \'NR&gt;1{print $5}\' | cut -d: -f1 | sort | uniq -c | sort -rn</code>', ok:'IP tvojho Macu s počtom spojení.'}],
 7:[{t:'Vytvor používateľa <code>test</code>, nastav heslo a prihlás sa ním z Macu. Skús <code>sudo -i</code>.', ok:'„test is not in the sudoers file“.'},
    {t:'Pridaj ho do wheel (<code>usermod -aG wheel test</code>) a over <code>id</code> v starej aj novej relácii.', ok:'Skupina sa prejaví až po novom prihlásení.'},
    {t:'Cez <code>sudo visudo -f /etc/sudoers.d/test</code> mu povoľ len <code>/usr/bin/systemctl restart httpd</code> a otestuj.', ok:'Reštart httpd ide, iné sudo príkazy nie.'},
    {t:'Skús sa 6-krát prihlásiť so zlým heslom, potom <code>sudo faillock --user test</code> a <code>--reset</code>.', ok:'Vidíš zamknutie a vieš ho zrušiť.'}],
 8:[{t:'Sprav adresár <code>/srv/projekt</code> so skupinou <code>tim</code> a právami <code>2770</code>. Dvaja používatelia v skupine v ňom vytvoria súbory.', ok:'Všetky nové súbory majú skupinu tim.'},
    {t:'V shelli nastav <code>umask 077</code>, vytvor súbor a porovnaj práva so súborom vytvoreným s predvolenou umask.', ok:'600 namiesto 644.'},
    {t:'<code>setfacl -m u:test:r ~/subor</code>, potom <code>getfacl</code> a <code>ls -l</code>.', ok:'V <code>ls -l</code> je za právami znak +.'}],
 9:[{t:'Spusti <code>yes &gt; /dev/null &amp;</code>, nájdi ho v <code>top</code> (klávesa P) a ukonči ho (<code>kill</code> s PID).', ok:'Load stúpne a po zabití klesne.'},
    {t:'<code>sleep 1000</code>, potom Ctrl+Z, <code>bg</code>, <code>jobs</code>, <code>fg</code>, Ctrl+C.', ok:'Vieš ovládať úlohy na pozadí.'},
    {t:'<code>uptime</code> a <code>nproc</code>: aký load je pri tvojom počte CPU ešte v poriadku?', ok:'Load do počtu CPU je OK.'}],
 10:[{t:'Vytvor <code>/etc/systemd/system/hello.service</code> s <code>ExecStart=/usr/bin/sleep infinity</code> a <code>[Install] WantedBy=multi-user.target</code>. <code>daemon-reload</code>, <code>enable --now</code>, reštart servera.', ok:'Po reštarte <code>systemctl status hello</code> = active (running).'},
     {t:'Zámerne pokaz cestu v ExecStart a sprav <code>restart</code>. Prečítaj <code>systemctl status</code> a <code>journalctl -xeu hello</code>, oprav.', ok:'„203/EXEC“ a vieš, ako ho opraviť.'},
     {t:'<code>systemd-analyze blame | head</code> a <code>systemctl list-timers</code>.', ok:'Vidíš, čo spomaľuje štart a čo sa plánovane spúšťa.'}],
 11:[{t:'<code>sudo dnf install -y tree</code>, <code>dnf history</code>, <code>sudo dnf history undo last</code>.', ok:'tree je preč a v histórii je záznam undo.'},
     {t:'<code>dnf provides \'*/semanage\'</code> a <code>dnf info nginx</code>.', ok:'Vieš zistiť balík podľa súboru aj bez inštalácie.'},
     {t:'Na RHEL 9: <code>dnf module list</code>. Na RHEL 10 ten istý príkaz.', ok:'Na 10 moduly nie sú.'},
     {t:'<code>sudo dnf check-update</code>, <code>sudo dnf update -y</code>, <code>sudo dnf needs-restarting -r</code>.', ok:'Vieš, či po aktualizácii treba reštart.'}],
 12:[{t:'<code>ip -br a</code>, <code>ip r</code>, <code>nmcli con show</code>, <code>nmcli dev show</code>.', ok:'Poznáš meno rozhrania, IP, bránu a DNS.'},
     {t:'Nainštaluj a spusti httpd a nájdi ho v <code>sudo ss -tulpn</code>.', ok:'Riadok s portom 80 a procesom httpd.'},
     {t:'Pridaj do <code>/etc/hosts</code> meno <code>mac</code> s IP tvojho Macu (z <code>who</code> alebo <code>ss -tn</code>) a <code>ping -c 2 mac</code>.', ok:'Meno sa preloží bez DNS.'}],
 13:[{t:'S bežiacim httpd skús z Macu <code>curl http://IP</code>. Potom <code>sudo firewall-cmd --add-service=http</code> (bez --permanent) a znova.', ok:'Najprv „No route to host“, potom stránka.'},
     {t:'<code>sudo firewall-cmd --reload</code> a znova curl z Macu. Potom to sprav správne s <code>--permanent</code>.', ok:'Pochopíš rozdiel runtime a permanent.'},
     {t:'Rich rule: povoľ SSH len z IP Macu. Najprv nechaj otvorenú konzolu UTM.', ok:'Z Macu SSH ide, z inej IP nie.', w:'Ak sa zamkneš, oprav to z konzoly UTM.'}],
 14:[{t:'Vytvor <code>~/index.html</code>, presuň ho cez <code>mv</code> do <code>/var/www/html</code> a skús <code>curl localhost</code>.', ok:'403 Forbidden.'},
     {t:'<code>ls -Z</code>, <code>sudo ausearch -m avc -ts recent</code>, <code>sudo restorecon -v /var/www/html/index.html</code>.', ok:'Po restorecon stránka ide.'},
     {t:'Zmeň v httpd.conf <code>Listen 8081</code>, reštartuj a oprav cez <code>semanage port -m -t http_port_t -p tcp 8081</code>.', ok:'httpd beží na 8081.'},
     {t:'<code>sudo dnf install -y setroubleshoot-server</code> a <code>sudo sealert -a /var/log/audit/audit.log</code>.', ok:'Čitateľné vysvetlenie zamietnutí.'}],
 15:[{t:'Pridaj v UTM druhý disk 10 GB (návod: krok 9) a over <code>lsblk</code>.', ok:'Vidíš <code>vdb</code>.'},
     {t:'<code>pvcreate /dev/vdb</code> → <code>vgcreate vgdata</code> → <code>lvcreate -L 3G -n data vgdata</code> → <code>mkfs.xfs</code> → <code>/data</code> do fstab cez UUID → <code>mount -a</code> → <code>findmnt --verify</code> → reštart.', ok:'Po reštarte je <code>/data</code> pripojený.', w:'Pred reštartom vždy mount -a. Chyba vo fstab = emergency mode.'},
     {t:'<code>sudo lvextend -r -L +1G /dev/vgdata/data</code> a <code>df -h /data</code>.', ok:'Súborový systém je väčší bez odpojenia.'}],
 16:[{t:'Na Macu vytvor kľúč, <code>ssh-copy-id</code> a záznam v <code>~/.ssh/config</code> (návod: krok 7).', ok:'<code>ssh rhel9</code> bez hesla.'},
     {t:'Drop-in <code>/etc/ssh/sshd_config.d/00-lab.conf</code> s <code>PasswordAuthentication no</code>, <code>sshd -t</code>, <code>reload</code>. Over v <b>novom</b> okne.', ok:'Kľúčom to ide, heslom nie.', w:'Starú reláciu nechaj otvorenú, kým neoveríš novú.'},
     {t:'<code>scp</code> súbor z Macu na server a späť, <code>rsync -av</code> priečinok, <code>tar -czf</code> a <code>tar -tzf</code>.', ok:'Vieš prenášať a baliť súbory.'}],
 17:[{t:'<code>logger "test z labu"</code> a nájdi ho: <code>journalctl -t admin</code> alebo <code>sudo grep "test z labu" /var/log/messages</code>.', ok:'Tvoja správa je v logu.'},
     {t:'Zapni trvalý žurnál (<code>sudo mkdir -p /var/log/journal</code>), reštartuj server, potom <code>journalctl --list-boots</code> a <code>journalctl -b -1</code>.', ok:'Vidíš logy aj z predošlého štartu.'},
     {t:'<code>crontab -e</code>: <code>*/5 * * * * date &gt;&gt; ~/cron.log</code>. Po 10 minútach skontroluj súbor a <code>sudo tail /var/log/cron</code>.', ok:'Dva riadky s časom.'},
     {t:'<code>chronyc sources -v</code> a <code>timedatectl</code>.', ok:'Hviezdička pri používanom zdroji, „synchronized: yes“.'}],
 18:[{t:'Zapni EPEL (balíky komunity pre RHEL): <code>sudo subscription-manager repos --enable codeready-builder-for-rhel-9-$(arch)-rpms</code> a <code>sudo dnf install https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm</code>. Potom <code>sudo dnf install -y htop</code>.', ok:'Funguje <code>htop</code> a <code>dnf repolist</code> ukazuje epel.', w:'Vo firme sa EPEL používa len so súhlasom. Na RHEL 10 je to epel-release-latest-10.'},
     {t:'<code>dnf download tree</code>, potom <code>rpm -qpi</code>, <code>rpm -K</code> a <code>sudo dnf install ./tree-*.rpm</code>.', ok:'Vieš overiť a nainštalovať lokálny balík.'},
     {t:'PostgreSQL: <code>dnf install -y postgresql-server</code>, <code>postgresql-setup --initdb</code>, <code>enable --now</code>, <code>sudo -u postgres psql -c "select version()"</code>.', ok:'Databáza beží a odpovedá.'}],
 19:[{t:'Napíš <code>~/bin/kontrola.sh</code>: hostname, uptime, <code>df -h /</code> a stav sshd, firewalld (cyklus for). <code>chmod +x</code>, spusti.', ok:'Prehľad servera jedným príkazom.'},
     {t:'Over syntax <code>bash -n</code> a beh <code>bash -x</code>. Pridaj parameter <code>$1</code> (názov služby) a <code>exit 1</code>, keď služba nebeží.', ok:'<code>echo $?</code> vráti 1 pri chybe.'},
     {t:'Spúšťaj skript z cronu každú hodinu a výstup pripisuj do <code>~/kontrola.log</code>.', ok:'Log rastie každú hodinu.'}],
 20:[{t:'Pred touto kapitolou sprav v UTM <b>Clone</b> VM.', ok:'Máš záložnú kópiu.'},
     {t:'Reset root hesla: v menu GRUB stlač <code>e</code>, na koniec riadku <code>linux</code> pridaj <code>rd.break</code>, Ctrl+X. Potom <code>mount -o remount,rw /sysroot</code>, <code>chroot /sysroot</code>, <code>passwd</code>, <code>touch /.autorelabel</code>, dvakrát <code>exit</code>.', ok:'Prihlásiš sa novým heslom roota (prvý štart trvá dlhšie kvôli relabel).', w:'Menu GRUB je na obrazovke len chvíľu: hneď po štarte VM stlač šípku.'},
     {t:'Zámerne pokaz UUID v <code>/etc/fstab</code> pre <code>/data</code>, reštartuj a oprav v emergency mode (ako incident v kurze).', ok:'Server po oprave a <code>systemctl default</code> nabehne.'},
     {t:'<code>sudo grubby --info=ALL</code>, pridaj <code>--args="audit=1"</code>, reštart, <code>cat /proc/cmdline</code>.', ok:'Parameter je v cmdline.'}],
 21:[{t:'Na rhel9-lab <code>sudo dnf install -y ansible-core</code>. Inventár so serverom <code>rhel10-lab</code> (druhá VM) alebo s <code>localhost ansible_connection=local</code>.', ok:'<code>ansible all -i inventory -m ping</code> vráti pong.'},
     {t:'Spusti playbook z kapitoly 21 (najprv <code>ansible-galaxy collection install ansible.posix</code>) dvakrát po sebe.', ok:'Druhý beh: changed=0.'},
     {t:'<code>sudo dnf install -y rhel-system-roles</code> a nastav čas rolou <code>timesync</code>.', ok:'Rovnaký výsledok ako ručne, ale opakovateľne.'}],
 22:[{t:'<code>podman run -d --name web -p 8080:8080 registry.access.redhat.com/ubi9/httpd-24</code>, potom <code>curl localhost:8080</code>. Otvor 8080 vo firewalle a skús z Macu.', ok:'Stránka Apache z kontajnera.'},
     {t:'Pripoj <code>~/web</code> do <code>/var/www/html</code> s <code>:Z</code> a skús aj bez <code>:Z</code>.', ok:'Bez :Z Permission denied (SELinux).'},
     {t:'Quadlet: <code>~/.config/containers/systemd/web.container</code>, <code>systemctl --user daemon-reload</code>, <code>start</code>, <code>loginctl enable-linger admin</code>, reštart servera.', ok:'Kontajner po reštarte beží sám.'}],
 23:[{t:'<code>tuned-adm recommend</code>, <code>tuned-adm active</code>, prepni profil a sleduj <code>sysctl vm.swappiness</code>.', ok:'Profil mení parametre jadra.'},
     {t:'<code>sudo dnf install -y sysstat</code>, <code>sudo systemctl enable --now sysstat</code>, po hodine <code>sar -u</code>.', ok:'História vyťaženia CPU.'},
     {t:'Len na <b>klone</b> VM: <code>sudo dnf install -y leapp-upgrade-el9toel10</code>, <code>sudo leapp preupgrade</code>, prečítaj <code>/var/log/leapp/leapp-report.txt</code>.', ok:'Zoznam inhibítorov a odporúčaní.', w:'Podporované sú len niektoré zdrojové verzie RHEL 9. Over ich v dokumentácii Red Hat pre upgrade.'}],
 24:[{t:'Porovnaj na rhel9-lab a rhel10-lab: <code>cat /etc/os-release</code>, <code>uname -r</code>, <code>python3 --version</code>.', ok:'Rozdielne jadro aj verzie nástrojov.'},
     {t:'<code>dnf module list</code> a <code>ls /etc/sysconfig/network-scripts</code> na oboch.', ok:'Na RHEL 10 moduly nie sú a ani starý adresár network-scripts.'},
     {t:'Na RHEL 10 skús <code>sudo bootc status</code>.', ok:'Pri inštalácii z ISO (package mode) ti povie, že to nie je bootc systém.'}]
};
})();
