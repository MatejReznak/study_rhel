/* =========================================================
   POSTUPY PRI PROBLÉMOCH: príznak → prvé príkazy → príčiny → over
   first: [príkaz, na čo], causes: [príčina, [oprava…]], verify: [príkazy]
   ========================================================= */
(function(){
window.RUNBOOKS = [
{id:'sluzba', t:'Služba nenaštartuje alebo padá', sym:'Job for X.service failed, služba je „failed“, po reštarte nebeží', ch:[10,17], inc:['envf','oom','reboot'],
 first:[['systemctl status SLUŽBA','Active, Result (exit-code, oom-kill, resources) a posledné riadky logu'],['journalctl -xeu SLUŽBA','celý log služby s vysvetlením chyby'],['systemctl cat SLUŽBA','odkiaľ sa unit načítal: ExecStart, User, EnvironmentFile'],['systemctl is-enabled SLUŽBA','spustí sa pri štarte?'],['SLUŽBA -t / sshd -t / httpd -t / nginx -t','test konfigurácie, ak ho služba má']],
 causes:[['203/EXEC: program neexistuje alebo nie je spustiteľný',['ls -l CESTA','sudo chmod 755 CESTA']],['Result: resources, „Failed to load environment files“',['systemctl cat SLUŽBA','obnov súbor z EnvironmentFile=']],['Chyba v konfigurácii (Syntax error)',['sudo SLUŽBA -t','oprav riadok z chyby, potom znova test']],['Port obsadený / Permission denied pri bind',['sudo ss -tulpn | grep PORT','sudo semanage port -l | grep TYP']],['Unit zmenený na disku',['sudo systemctl daemon-reload']],['Result: oom-kill',['free -h','sudo dmesg | grep -i "out of memory"']]],
 verify:['sudo systemctl restart SLUŽBA','systemctl is-active SLUŽBA','systemctl is-enabled SLUŽBA']},

{id:'web', t:'Web alebo aplikácia nie je dostupná zvonku', sym:'prehliadač: nedá sa pripojiť, timeout, 403, „No route to host“', ch:[12,13,14], inc:['web','cert','update'],
 first:[['systemctl status httpd','beží vôbec služba?'],['sudo ss -tulpn | grep -E ":80|:443"','počúva na správnom porte a adrese (0.0.0.0, nie 127.0.0.1)?'],['curl -I http://localhost','funguje lokálne? (ak áno, problém je medzi)'],['sudo firewall-cmd --list-all','je povolená služba alebo port?'],['sudo ausearch -m avc -ts recent','blokuje SELinux?']],
 causes:[['Lokálne ide, zvonku nie = firewall',['sudo firewall-cmd --permanent --add-service=http','sudo firewall-cmd --reload']],['403 pri správnych právach = SELinux kontext',['ls -Z /var/www/html','sudo restorecon -Rv /var/www/html']],['Neštandardný port = SELinux port',['sudo semanage port -a -t http_port_t -p tcp PORT']],['Služba nebeží',['pozri postup Služba nenaštartuje']],['Počúva len na 127.0.0.1',['oprav Listen/bind v konfigurácii aplikácie']]],
 verify:['curl -I http://localhost','z iného stroja: curl -I http://SERVER']},

{id:'disk', t:'Disk je plný', sym:'No space left on device, monitoring 95 %+, dnf padá na mieste', ch:[9,15], inc:['disk','varfull'],
 first:[['df -h','ktorý súborový systém je plný?'],['df -i','alebo došli inody (veľa malých súborov)?'],['sudo du -xsh /CESTA/* | sort -h','čo zaberá miesto (-x = len tento súborový systém)'],['sudo journalctl --disk-usage','koľko zaberá žurnál'],['sudo lsof +L1','zmazané, ale stále otvorené súbory']],
 causes:[['Veľký log, ktorý proces stále zapisuje',['sudo truncate -s 0 /var/log/…/subor.log','nastav logrotate']],['Žurnál bez limitu',['sudo journalctl --vacuum-size=500M','SystemMaxUse=500M v /etc/systemd/journald.conf']],['Súbor zmazaný cez rm, miesto sa neuvoľnilo',['sudo lsof +L1','sudo systemctl restart SLUŽBA']],['Cache dnf',['sudo dnf clean all']],['Disk je naozaj malý (LVM)',['sudo vgs','sudo lvextend -r -L +5G /dev/VG/LV']]],
 verify:['df -h']},

{id:'pomaly', t:'Server je pomalý, vysoký load', sym:'load average vysoko nad počtom CPU, všetko reaguje pomaly', ch:[9,23], inc:['cpu'],
 first:[['uptime','load average za 1, 5 a 15 minút'],['nproc','počet CPU: load do tohto čísla je OK'],['top','klávesa P = podľa CPU, M = podľa pamäte, 1 = jednotlivé CPU'],['ps aux --sort=-%cpu | head','najnáročnejšie procesy'],['vmstat 1 5','wa = čakanie na disk, si/so = swapovanie']],
 causes:[['Jeden proces žerie CPU',['ps -ef --forest | less (kto ho spustil)','sudo kill PID (najprv bez -9)']],['Proces sa vracia (cron, timer, Restart=)',['ls /etc/cron.d; sudo crontab -l','systemctl list-timers']],['Vysoké wa = disk',['iostat -x 2 (balík sysstat)']],['Swapovanie = málo RAM',['free -h','pozri postup Málo pamäte']]],
 verify:['uptime','top']},

{id:'pamat', t:'Málo pamäte, OOM killer', sym:'proces „sám“ zmizol, Result: oom-kill, Out of memory v dmesg', ch:[9,10], inc:['oom'],
 first:[['free -h','stĺpec available je dôležitý, nie free'],['sudo dmesg -T | grep -i -A2 "out of memory"','koho jadro zabilo a koľko mal pamäte'],['journalctl -k --since today | grep -i oom','to isté zo žurnálu'],['ps aux --sort=-%mem | head','kto má najviac pamäte teraz'],['systemctl status SLUŽBA','Result: oom-kill?']],
 causes:[['Aplikácia má nastavených viac pamäte, ako má server (Java -Xmx)',['systemctl cat SLUŽBA → EnvironmentFile','zníž -Xmx, reštart']],['Únik pamäte v aplikácii',['reštart ako dočasné riešenie, nahlás dodávateľovi']],['Server má jednoducho málo RAM',['pridaj RAM (VM) alebo obmedz službu: MemoryMax= v drop-in']]],
 verify:['free -h','systemctl is-active SLUŽBA']},

{id:'ssh', t:'Neviem sa pripojiť cez SSH', sym:'Connection refused, timeout, Permission denied (publickey), Host key verification failed', ch:[16,13,14], inc:['ssh'],
 first:[['ssh -v user@server','na Macu/klientovi: kde presne to končí'],['systemctl status sshd','na serveri (cez konzolu): beží sshd?'],['sudo sshd -t','chyba v konfigurácii?'],['sudo ss -tlnp | grep sshd','na akom porte počúva'],['sudo tail -50 /var/log/secure','dôvod odmietnutia']],
 causes:[['Connection refused: sshd nebeží alebo iný port',['sudo systemctl start sshd','ssh -p PORT']],['Timeout: firewall',['sudo firewall-cmd --list-all']],['Iný port nejde ani po reštarte: SELinux',['sudo semanage port -a -t ssh_port_t -p tcp PORT']],['Permission denied (publickey): kľúč, práva ~/.ssh',['chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys','restorecon -Rv ~/.ssh']],['Host key verification failed (server preinštalovaný)',['na klientovi: ssh-keygen -R server']],['Zamknutý účet',['pozri postup Používateľ sa nevie prihlásiť']]],
 verify:['ssh user@server (v novom okne, staré nezatváraj)']},

{id:'login', t:'Používateľ sa nevie prihlásiť', sym:'správne heslo nefunguje, „account locked“, vypršané heslo', ch:[7], inc:['lock','user'],
 first:[['sudo tail /var/log/secure','presný dôvod'],['sudo passwd -S MENO','LK = zamknuté heslo, PS = nastavené'],['sudo faillock --user MENO','zamknutie po neúspešných pokusoch'],['sudo chage -l MENO','vypršalo heslo alebo účet?'],['getent passwd MENO','existuje? aký má shell (nologin?)']],
 causes:[['faillock po zlých heslách',['sudo faillock --user MENO --reset']],['Heslo zamknuté (passwd -l / usermod -L)',['sudo usermod -U MENO']],['Zabudnuté heslo',['sudo passwd MENO','sudo chage -d 0 MENO (musí si ho zmeniť)']],['Vypršaný účet',['sudo chage -E -1 MENO']],['Shell /sbin/nologin',['sudo usermod -s /bin/bash MENO (len ak je to človek, nie služba)']]],
 verify:['sudo passwd -S MENO','sudo faillock --user MENO']},

{id:'prava', t:'Permission denied', sym:'aplikácia alebo používateľ nemôže čítať/zapisovať, hoci „práva sú OK“', ch:[8,14], inc:['perm','web'],
 first:[['ls -l SÚBOR; ls -ld ADRESÁR','práva aj na nadradených adresároch (x na adresári!)'],['namei -l /cela/cesta/k/suboru','práva každej časti cesty naraz'],['id POUŽÍVATEĽ','pod kým beží proces a v akých skupinách je'],['getfacl SÚBOR','ACL'],['ls -Z SÚBOR; sudo ausearch -m avc -ts recent','SELinux']],
 causes:[['Chýba x na niektorom adresári v ceste',['sudo chmod o+x ADRESÁR (alebo g+x)']],['Zlý vlastník / skupina',['sudo chown -R USER:GROUP CESTA']],['SELinux kontext (súbor presunutý cez mv)',['sudo restorecon -Rv CESTA']],['Neštandardná cesta pre službu',['sudo semanage fcontext -a -t TYP "/cesta(/.*)?"','sudo restorecon -Rv /cesta']]],
 verify:['sudo -u USER cat SÚBOR (otestuj ako ten používateľ)']},

{id:'dns', t:'Meno sa nepreloží (DNS)', sym:'Could not resolve host, Name or service not known, ping na IP ide, na meno nie', ch:[12], inc:['dns'],
 first:[['getent hosts MENO','preklad tak, ako ho robia aplikácie (hosts + DNS)'],['cat /etc/resolv.conf','aký DNS server sa používa'],['dig MENO','pýta sa priamo DNS (bind-utils)'],['grep MENO /etc/hosts','nemá tam niekto starý záznam?'],['nmcli con show PROFIL | grep -i dns','DNS v NetworkManageri']],
 causes:[['Zlý DNS server v profile',['sudo nmcli con mod PROFIL ipv4.dns IP','sudo nmcli con up PROFIL']],['Starý záznam v /etc/hosts',['sudo vim /etc/hosts']],['resolv.conf prepísaný ručne',['nastav DNS cez nmcli, nie ručne v resolv.conf']],['DNS server nedostupný (firewall, sieť)',['ping IP_DNS; dig @IP_DNS MENO']]],
 verify:['getent hosts MENO','ping -c 2 MENO']},

{id:'dnf', t:'dnf nefunguje', sym:'Failed to download metadata for repo, Unable to find a match, GPG check failed', ch:[11,18], inc:['repo','varfull'],
 first:[['dnf repolist','povolené repozitáre'],['sudo subscription-manager status','je server zaregistrovaný?'],['ls /etc/yum.repos.d/','súbory repozitárov'],['sudo dnf clean all','vymaže cache'],['df -h /var','miesto pre cache']],
 causes:[['Nedostupný repozitár (zrušený server, proxy)',['sudo dnf config-manager --set-disabled ID']],['Server nie je registrovaný',['sudo rhc connect (alebo subscription-manager register)']],['Balík je v inom repozitári (CRB, dodávateľ)',['dnf provides PRÍKAZ','pridaj .repo dodávateľa']],['Chýba GPG kľúč',['sudo rpm --import KĽÚČ']],['Plný /var',['pozri postup Disk je plný']]],
 verify:['sudo dnf makecache','sudo dnf install -y BALÍK']},

{id:'cas', t:'Zlý čas na serveri', sym:'Clock skew too great (AD/Kerberos), certifikát „ešte neplatný“, logy s iným časom', ch:[17], inc:['cas'],
 first:[['timedatectl','synchronized? NTP service active?'],['chronyc sources','zdroje času (* = používaný, ? = nedostupný)'],['chronyc tracking','o koľko sa hodiny líšia'],['systemctl status chronyd','beží?'],['grep -E "^(server|pool)" /etc/chrony.conf','aké servery sú nastavené']],
 causes:[['chronyd nebeží',['sudo systemctl enable --now chronyd']],['Zlý / nedostupný NTP server',['oprav server v /etc/chrony.conf','sudo systemctl restart chronyd']],['Veľký rozdiel sa nevyrovná',['sudo chronyc makestep']],['Zlé časové pásmo',['sudo timedatectl set-timezone Europe/Bratislava']]],
 verify:['timedatectl','chronyc sources']},

{id:'boot', t:'Server nenaštartuje (emergency / rescue)', sym:'„You are in emergency mode“, Give root password for maintenance, kernel panic', ch:[20,15], inc:['fstab'],
 first:[['journalctl -xb','čo zlyhalo pri štarte (hľadaj Failed, Timed out, Dependency)'],['cat /etc/fstab','najčastejšia príčina'],['blkid; lsblk -f','skutočné UUID diskov'],['mount -a','test fstab'],['systemctl --failed','zlyhané jednotky']],
 causes:[['Chyba v /etc/fstab (UUID, preklep, chýbajúci disk)',['oprav riadok alebo pridaj nofail','mount -a; findmnt --verify','systemctl daemon-reload; systemctl default']],['Koreňový systém len na čítanie',['mount -o remount,rw /']],['Zabudnuté heslo roota',['rd.break → mount -o remount,rw /sysroot → chroot /sysroot → passwd → touch /.autorelabel']],['Nové jadro nefunguje',['v GRUB vyber staršie jadro','sudo grubby --set-default=/boot/vmlinuz-STARŠIE']]],
 verify:['systemctl get-default','reboot a sleduj konzolu']},

{id:'restart', t:'Po reštarte niečo nefunguje', sym:'pred reštartom išlo, po ňom nie', ch:[10,13,15,23], inc:['reboot','envf'],
 first:[['systemctl --failed','čo zlyhalo pri štarte'],['systemctl is-enabled SLUŽBA','je služba enable?'],['sudo firewall-cmd --list-all','pravidlá bez --permanent zmizli'],['findmnt; cat /etc/fstab','pripojilo sa všetko?'],['journalctl -b -1 -p err','chyby z predošlého štartu (trvalý žurnál)']],
 causes:[['Služba nebola enable',['sudo systemctl enable --now SLUŽBA']],['Firewall len runtime',['sudo firewall-cmd --runtime-to-permanent']],['sysctl len cez -w',['súbor v /etc/sysctl.d/ a sysctl --system']],['setenforce len dočasne',['/etc/selinux/config']],['Mount nie je vo fstab',['pridaj do /etc/fstab, mount -a']],['Kontajner cez podman run',['Quadlet .container s [Install]']]],
 verify:['po oprave naozaj reštartuj a over (najlepšie v okne údržby)']},

{id:'cron', t:'Cron úloha nebeží', sym:'skript sa nespustil, nič v logu, ručne funguje', ch:[17,19], inc:['cron','cpu'],
 first:[['sudo crontab -l; crontab -l','v ktorom crontabe je (root vs používateľ)'],['ls /etc/cron.d; cat /etc/crontab','systémové úlohy'],['sudo tail /var/log/cron','spustil ho cron vôbec?'],['ls -l SKRIPT','existuje, je spustiteľný?'],['systemctl status crond','beží crond?']],
 causes:[['Zlý čas v pätici polí',['minúta hodina deň mesiac deň_týždňa (0 2 * * * = 2:00)']],['Skript nie je spustiteľný',['sudo chmod 755 SKRIPT']],['Iné prostredie (PATH) ako v shelli',['v skripte plné cesty k príkazom, alebo PATH= na začiatku crontabu']],['Výstup ide „nikam“',['… >> /var/log/uloha.log 2>&1']],['V /etc/cron.d chýba meno používateľa',['riadok: 0 2 * * * root /cesta/skript']]],
 verify:['sudo tail -f /var/log/cron (počkaj na čas spustenia)']},

{id:'tls', t:'Certifikát / HTTPS problém', sym:'NET::ERR_CERT_DATE_INVALID, certificate has expired, kľúč nesedí', ch:[18,14], inc:['cert'],
 first:[['curl -vI https://SERVER','čo server naozaj posiela (dátumy, CN)'],['openssl s_client -connect SERVER:443','detail certifikátu a chyba overenia'],['sudo grep -ri SSLCertificate /etc/httpd/conf.d/','ktoré súbory server používa'],['openssl x509 -in CERT -noout -subject -dates','platnosť súboru'],['openssl x509 -in CERT -noout -modulus | openssl md5; sudo openssl rsa -in KEY -noout -modulus | openssl md5','patrí kľúč k certifikátu?']],
 causes:[['Expirovaný certifikát',['nasaď nový (cp), chmod 600 kľúč, restorecon, httpd -t, systemctl reload httpd']],['Kľúč nepatrí k certifikátu',['porovnaj modulus, použi správny kľúč']],['Súbory presunuté cez mv (SELinux)',['sudo restorecon -Rv /etc/pki/tls']],['Nový súbor nasadený, ale bez reload',['sudo systemctl reload httpd']],['Chýba medziľahlý certifikát (chain)',['SSLCertificateChainFile alebo spojený súbor cert + chain']]],
 verify:['curl -vI https://SERVER','openssl x509 -in CERT -noout -checkend 2592000 (30 dní)']},

{id:'port', t:'Port je obsadený alebo služba nepočúva', sym:'Address already in use, aplikácia beží, ale port je zatvorený', ch:[12,14], inc:[],
 first:[['sudo ss -tulpn','kto počúva na akom porte (proces aj PID)'],['sudo ss -tulpn | grep :PORT','konkrétny port'],['systemctl status SLUŽBA','chyby pri bind'],['sudo semanage port -l | grep PORT','povoľuje SELinux tento port danému typu?']],
 causes:[['Iný proces má port',['zastav ho, alebo zmeň port aplikácie']],['SELinux nepovoľuje port',['sudo semanage port -a (alebo -m) -t TYP -p tcp PORT']],['Počúva len na 127.0.0.1',['zmeň bind adresu v konfigurácii']]],
 verify:['sudo ss -tulpn | grep :PORT']},

{id:'aktualizacia', t:'Po aktualizácii niečo nefunguje', sym:'po dnf update padá služba, iné správanie, chyba modulu', ch:[11,18], inc:['update'],
 first:[['dnf history','čo sa kedy aktualizovalo'],['dnf history info ID','presné balíky a varovania (.rpmnew)'],['sudo find /etc -name "*.rpmnew" -o -name "*.rpmsave"','nové konfigurácie, ktoré dnf neprepísal'],['systemctl --failed','čo prestalo bežať'],['sudo dnf needs-restarting -r','treba reštart?']],
 causes:[['Nová verzia potrebuje novú konfiguráciu (.rpmnew)',['porovnaj diff STARÝ STARÝ.rpmnew, zapracuj zmeny']],['Rýchly návrat',['sudo dnf history undo ID']],['Nové jadro',['v GRUB vyber staršie, sudo grubby --set-default']],['Služba beží so starými knižnicami',['sudo systemctl restart SLUŽBA alebo reboot']]],
 verify:['systemctl --failed','test aplikácie']},

{id:'kontajner', t:'Kontajner nebeží alebo je nedostupný', sym:'podman ps nič neukazuje, port zvonku nejde, Permission denied vo volume', ch:[22], inc:[],
 first:[['podman ps -a','beží? s akým stavom skončil?'],['podman logs NÁZOV','výstup aplikácie v kontajneri'],['podman inspect NÁZOV | less','porty, volume, príkaz'],['sudo ss -tulpn | grep PORT','je port publikovaný?'],['systemctl --user status NÁZOV','ak beží cez Quadlet']],
 causes:[['Permission denied vo volume',['pridaj :Z (podman run -v cesta:/v/kontajneri:Z)']],['Zvonku nejde',['firewall-cmd pre publikovaný port hostiteľa']],['Po reštarte nebeží',['Quadlet + loginctl enable-linger POUŽÍVATEĽ']],['Rootless a port pod 1024',['použi vyšší port, alebo rootful kontajner']]],
 verify:['podman ps','curl localhost:PORT']}
];
})();
