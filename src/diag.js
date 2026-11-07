/* =========================================================
   DIAGNOSTIKA: kapitola 27, mapa logov, tréning čítania logov,
   rozhodovací strom „kde je problém“, incidenty naslepo (dáta)
   ========================================================= */
(function(){
const H = '/home/admin';
const ran = (m,n,pred)=>m.log.some(e=>e.name===n && (pred ? pred(e) : e.code===0));
const has = (e, re)=>e.args.some(a=>re.test(a));
const fileHas = (m, p, re)=>re.test((m.read(p)||'').trim());

/* ---------- prvých 60 sekúnd ---------- */
window.TRIAGE60 = [
 ['uptime','ako dlho beží (nedávny reštart?) a záťaž (load vyšší ako počet CPU = preťaženie)'],
 ['df -h','plný disk (100 %) rozbije takmer všetko: logy, dnf, databázy, prihlásenie'],
 ['free -h','pamäť: málo „available“ a plný swap = OOM a pomalosť'],
 ['systemctl --failed','ktoré služby spadli'],
 ['sudo journalctl -p err -b','všetky chyby od posledného štartu'],
 ['sudo journalctl --since "-15min"','čo sa dialo práve teraz (všetky služby)'],
 ['ss -tulpn','čo počúva na ktorom porte'],
 ['sudo dmesg -T | tail -20','jadro: disky, OOM killer, sieťová karta'],
 ['last -n 5; sudo dnf history | head -5','kto sa naposledy prihlásil a čo sa naposledy inštalovalo (čo sa zmenilo?)']
];

/* ---------- vrstvy ---------- */
window.LAYERS = [
 {k:'siet', t:'Sieť a DNS', sym:'nedá sa pripojiť na iný server, „Name or service not known“, timeout', cmd:'ip -br a; ip route; ping -c2 BRÁNA; getent hosts MENO; nc -zv SERVER PORT', log:'journalctl -u NetworkManager'},
 {k:'fw', t:'Firewall', sym:'lokálne (curl localhost) funguje, zvonku nie; „No route to host“', cmd:'sudo firewall-cmd --list-all; ss -tulpn', log:'journalctl -u firewalld; (logovanie zahodených: firewall-cmd --set-log-denied=all)'},
 {k:'sluzba', t:'Služba', sym:'„Connection refused“, služba nebeží alebo padá', cmd:'systemctl status SLUŽBA; systemctl --failed', log:'journalctl -xeu SLUŽBA'},
 {k:'konf', t:'Konfigurácia', sym:'služba po zmene/aktualizácii nenaštartuje', cmd:'httpd -t / sshd -t / nginx -t; rpm -V BALÍK; ls /etc/…/*.rpmnew', log:'journalctl -u SLUŽBA; dnf history'},
 {k:'prava', t:'Práva a vlastníctvo', sym:'„Permission denied“ pri správnej ceste', cmd:'ls -l SÚBOR; namei -l CESTA; sudo -u POUŽÍVATEĽ test', log:'log aplikácie, journalctl -u SLUŽBA'},
 {k:'selinux', t:'SELinux', sym:'„Permission denied“ hoci práva sú OK, 403, služba sa nenaviaže na port', cmd:'getenforce; ls -Z; sudo ausearch -m AVC -ts recent', log:'/var/log/audit/audit.log, sealert'},
 {k:'disk', t:'Disk', sym:'„No space left on device“, „Read-only file system“, dnf padá', cmd:'df -h; df -i; sudo du -xsh /var/* | sort -h; sudo lsof +L1', log:'dmesg -T (chyby disku)'},
 {k:'zdroje', t:'Pamäť a CPU', sym:'pomalosť, proces padá bez chyby, „Killed“', cmd:'top; free -h; ps aux --sort=-%mem | head', log:'dmesg -T | grep -i "out of memory"; journalctl -k'},
 {k:'cas', t:'Čas', sym:'certifikát „not yet valid“, Kerberos/AD prihlásenie, zlé časy v logoch', cmd:'timedatectl; chronyc sources', log:'journalctl -u chronyd'},
 {k:'ucet', t:'Účty a prihlásenie', sym:'„nepustí ma“, sudo nefunguje', cmd:'id MENO; sudo passwd -S MENO; sudo chage -l MENO; sudo faillock --user MENO', log:'/var/log/secure, journalctl -u sshd'},
 {k:'balik', t:'Balíky a repozitáre', sym:'dnf chyba, chýba príkaz, po aktualizácii niečo nejde', cmd:'dnf repolist; dnf history; rpm -qf SÚBOR', log:'/var/log/dnf.log, dnf history info ID'},
 {k:'boot', t:'Štart servera', sym:'emergency mode, server nenaštartuje, po reštarte niečo chýba', cmd:'systemctl --failed; findmnt --verify; systemctl is-enabled SLUŽBA', log:'journalctl -b -1 (predchádzajúci štart), journalctl -b -p err'}
];

/* ---------- mapa logov ---------- */
window.LOG_MAP = [
 {sv:'Systém celkovo', unit:'—', log:'/var/log/messages', j:'journalctl -b -p warning', cfg:'/etc/rsyslog.conf, /etc/systemd/journald.conf', check:'systemctl --failed', errs:[['Out of memory: Killed process','jadro zabilo proces pre nedostatok pamäte'],['No space left on device','plný disk (df -h, df -i)']]},
 {sv:'Jadro (disky, sieťovka, OOM)', unit:'—', log:'dmesg', j:'journalctl -k', cfg:'/etc/sysctl.d/', check:'dmesg -T | tail', errs:[['I/O error, dev sda','chyba disku: hneď riešiť, zálohy'],['EXT4-fs / XFS ... remount read-only','súborový systém prepnutý len na čítanie po chybe'],['link is not ready / Link is Down','kábel/virtuálna sieťovka odpojená']]},
 {sv:'Prihlásenia, sudo', unit:'sshd, sudo', log:'/var/log/secure', j:'journalctl -u sshd; journalctl _COMM=sudo', cfg:'/etc/ssh/sshd_config, /etc/sudoers.d/', check:'sudo sshd -t; last; lastb', errs:[['Failed password for','zlé heslo (veľa z jednej IP = útok)'],['Permission denied (publickey)','kľúč nesedí alebo práva ~/.ssh nie sú 700/600'],['user NOT in sudoers','používateľ nie je vo wheel ani v sudoers.d'],['pam_faillock: Consecutive login failures','účet zamknutý po zlých heslách']]},
 {sv:'SELinux', unit:'auditd', log:'/var/log/audit/audit.log', j:'ausearch -m AVC -ts recent', cfg:'/etc/selinux/config', check:'getenforce; ls -Z; sealert -a /var/log/audit/audit.log', errs:[['avc: denied { read } … tcontext=…user_home_t','súbor má zlý kontext (presunutý cez mv): restorecon -Rv'],['avc: denied { name_bind } … src=8081','port nie je povolený pre službu: semanage port -a'],['avc: denied { name_connect }','služba sa nesmie pripájať von: setsebool -P httpd_can_network_connect on']]},
 {sv:'Webový server Apache', unit:'httpd', log:'/var/log/httpd/error_log, access_log', j:'journalctl -u httpd', cfg:'/etc/httpd/conf/httpd.conf, conf.d/', check:'sudo httpd -t; curl -I localhost', errs:[['AH00072: make_sock: could not bind to address','port obsadený alebo zakázaný SELinuxom'],['AH01630: client denied by server configuration','Require all denied v konfigurácii'],['AH00035: access … denied (filesystem path …)','práva alebo SELinux na súbore'],['AH02565: Certificate and private key … do not match','kľúč nepatrí k certifikátu']]},
 {sv:'nginx', unit:'nginx', log:'/var/log/nginx/error.log', j:'journalctl -u nginx', cfg:'/etc/nginx/nginx.conf, conf.d/', check:'sudo nginx -t', errs:[['bind() to 0.0.0.0:80 failed (98: Address already in use)','port drží iný proces (ss -tulpn)'],['connect() failed (13: Permission denied) while connecting to upstream','SELinux: setsebool -P httpd_can_network_connect on']]},
 {sv:'Plánované úlohy', unit:'crond', log:'/var/log/cron', j:'journalctl -u crond', cfg:'/etc/crontab, /etc/cron.d/, crontab -l', check:'sudo crontab -l -u MENO', errs:[['(CRON) ERROR (getpwnam() failed)','používateľ v /etc/cron.d riadku neexistuje'],['CMD (...) a nič viac','úloha sa spustila: výstup hľadaj tam, kam ho presmeruje (>> log 2>&1)']]},
 {sv:'Balíky dnf', unit:'—', log:'/var/log/dnf.log, dnf.rpm.log', j:'dnf history; dnf history info ID', cfg:'/etc/dnf/dnf.conf, /etc/yum.repos.d/', check:'dnf repolist; dnf check', errs:[['Cannot download repomd.xml','repozitár nedostupný (sieť, DNS, proxy, zrušený server)'],['Error: GPG check FAILED','chýba alebo nesedí GPG kľúč repozitára'],['No space left on device','plný /var (cache dnf)']]},
 {sv:'Sieť', unit:'NetworkManager', log:'—', j:'journalctl -u NetworkManager', cfg:'/etc/NetworkManager/system-connections/', check:'nmcli dev status; ip -br a; ip route', errs:[['device (ens192): state change: … -> unavailable','linka dole (kábel, vSwitch)'],['dhcp4 (ens192): request timed out','DHCP server neodpovedá']]},
 {sv:'Firewall', unit:'firewalld', log:'—', j:'journalctl -u firewalld; journalctl -k --grep REJECT', cfg:'/etc/firewalld/zones/', check:'firewall-cmd --list-all; firewall-cmd --get-active-zones', errs:[['ERROR: INVALID_SERVICE','preklep v mene služby'],['FINAL_REJECT / filter_IN_public_REJECT (po --set-log-denied=all)','paket zahodil firewall: na ktorý port a odkiaľ']]},
 {sv:'Čas', unit:'chronyd', log:'—', j:'journalctl -u chronyd', cfg:'/etc/chrony.conf', check:'timedatectl; chronyc sources; chronyc tracking', errs:[['Can\'t synchronise: no selectable sources','žiadny NTP server nedostupný'],['System clock wrong by … seconds','hodiny boli posunuté']]},
 {sv:'systemd a štart', unit:'systemd', log:'—', j:'journalctl -b; journalctl -b -1; systemctl status JEDNOTKA', cfg:'/etc/systemd/system/, /etc/fstab', check:'systemctl --failed; findmnt --verify; systemd-analyze blame', errs:[['status=203/EXEC','ExecStart neexistuje alebo nemá právo x'],['status=217/USER','User= v jednotke neexistuje'],['Result: oom-kill','proces zabil OOM killer'],['Failed to load environment files','chýba EnvironmentFile'],['Dependency failed for Local File Systems','zlý riadok v /etc/fstab → emergency mode']]},
 {sv:'Databáza MariaDB/MySQL', unit:'mariadb', log:'/var/log/mariadb/mariadb.log', j:'journalctl -u mariadb', cfg:'/etc/my.cnf.d/', check:'systemctl status mariadb; ss -tlpn | grep 3306', errs:[['Can\'t create/write to file … (Errcode: 28 "No space left on device")','plný disk'],['Access denied for user','zlé meno/heslo alebo host']]},
 {sv:'PostgreSQL', unit:'postgresql', log:'/var/lib/pgsql/data/log/', j:'journalctl -u postgresql', cfg:'/var/lib/pgsql/data/postgresql.conf, pg_hba.conf', check:'sudo -u postgres psql -c "select 1"', errs:[['no pg_hba.conf entry for host','klient nemá povolenie v pg_hba.conf'],['Directory … is missing or empty','databáza nebola inicializovaná: postgresql-setup --initdb']]},
 {sv:'Kontajnery Podman', unit:'(meno).service pri Quadlete', log:'—', j:'podman logs KONTAJNER; journalctl -u MENO', cfg:'/etc/containers/systemd/, ~/.config/containers/systemd/', check:'podman ps -a; podman inspect', errs:[['Error: … port is already allocated','port na hostiteľovi už používa iný kontajner/proces'],['Permission denied pri bind mount','pridaj :Z k -v ceste (SELinux)']]},
 {sv:'Pošta Postfix', unit:'postfix', log:'/var/log/maillog', j:'journalctl -u postfix', cfg:'/etc/postfix/main.cf', check:'postqueue -p; postfix check', errs:[['status=deferred (connect to … Connection timed out)','cieľový mail server nedostupný (firewall, port 25)']]},
 {sv:'Audit (kto čo zmenil)', unit:'auditd', log:'/var/log/audit/audit.log', j:'ausearch -m USER_CMD; aureport -l', cfg:'/etc/audit/rules.d/', check:'auditctl -l', errs:[['type=USER_AUTH … res=failed','neúspešné overenie']]}
];

/* ---------- tréning čítania logov ---------- */
window.LOG_TRAIN = [
 {id:'l1', t:'Apache nenaštartuje', src:'sudo journalctl -u httpd -n 8', ask:'Ktorý riadok hovorí PRÍČINU?', lines:[
  'Nov 07 09:12:01 web01 systemd[1]: Starting The Apache HTTP Server...',
  'Nov 07 09:12:01 web01 httpd[4410]: AH00558: httpd: Could not reliably determine the server\'s fully qualified domain name, using 10.0.20.31. Set the \'ServerName\' directive globally to suppress this message',
  'Nov 07 09:12:01 web01 httpd[4410]: (98)Address already in use: AH00072: make_sock: could not bind to address [::]:80',
  'Nov 07 09:12:01 web01 httpd[4410]: (98)Address already in use: AH00072: make_sock: could not bind to address 0.0.0.0:80',
  'Nov 07 09:12:01 web01 httpd[4410]: no listening sockets available, shutting down',
  'Nov 07 09:12:01 web01 httpd[4410]: AH00015: Unable to open logs',
  'Nov 07 09:12:01 web01 systemd[1]: httpd.service: Main process exited, code=exited, status=1/FAILURE',
  'Nov 07 09:12:01 web01 systemd[1]: httpd.service: Failed with result \'exit-code\'.'], key:[2,3],
  why:'AH00558 (ServerName) je len varovanie, je tam skoro vždy: <b>šum</b>. Príčina je „Address already in use“ na porte 80: port drží iný proces (často nginx alebo druhá inštancia). Riadky pod tým sú už len dôsledky.', next:'sudo ss -tlpn | grep :80'},
 {id:'l2', t:'Web vracia 403', src:'sudo tail /var/log/httpd/error_log', ask:'Prečo dostáva klient 403?', lines:[
  '[Sat Nov 07 10:01:22.114 2026] [core:notice] [pid 3010] SELinux policy enabled; httpd running as context system_u:system_r:httpd_t:s0',
  '[Sat Nov 07 10:01:22.118 2026] [mpm_event:notice] [pid 3010] AH00489: Apache/2.4.62 (Red Hat Enterprise Linux) configured -- resuming normal operations',
  '[Sat Nov 07 10:03:40.552 2026] [core:error] [pid 3015] (13)Permission denied: [client 10.0.20.15:53311] AH00035: access to /index.html denied (filesystem path \'/var/www/html/index.html\') because search permissions are missing on a component of the path',
  '[Sat Nov 07 10:03:41.003 2026] [core:info] [pid 3015] [client 10.0.20.15:53311] AH01797: client denied by server configuration: /var/www/html/favicon.ico'], key:[2],
  why:'„(13)Permission denied … filesystem path“ znamená, že Apache sa nedostal k súboru. Pri RHEL to býva SELinux kontext (súbor presunutý cez mv). Práva over cez <code>ls -l</code>, kontext cez <code>ls -Z</code>, dôkaz v <code>ausearch -m AVC -ts recent</code>. favicon riadok je druhoradý.', next:'ls -Z /var/www/html; sudo ausearch -m AVC -ts recent'},
 {id:'l3', t:'SELinux zamietnutie', src:'sudo ausearch -m AVC -ts recent', ask:'Čo presne SELinux zakázal a komu?', lines:[
  '----',
  'time->Sat Nov  7 10:03:40 2026',
  'type=PROCTITLE msg=audit(1794049420.552:812): proctitle=2F7573722F7362696E2F6874747064002D44464F524547524F554E44',
  'type=SYSCALL msg=audit(1794049420.552:812): arch=c000003e syscall=262 success=no exit=-13 a0=ffffff9c items=0 ppid=3010 pid=3015 auid=4294967295 uid=48 gid=48 comm="httpd" exe="/usr/sbin/httpd" subj=system_u:system_r:httpd_t:s0 key=(null)',
  'type=AVC msg=audit(1794049420.552:812): avc:  denied  { getattr } for  pid=3015 comm="httpd" path="/var/www/html/index.html" dev="dm-0" ino=1847213 scontext=system_u:system_r:httpd_t:s0 tcontext=unconfined_u:object_r:user_home_t:s0 tclass=file permissive=0'], key:[4],
  why:'Riadok type=AVC: <b>kto</b> (comm="httpd", scontext …httpd_t), <b>čo</b> ({ getattr } na tclass=file), <b>na čom</b> (path=…/index.html) a <b>prečo</b> (tcontext …<b>user_home_t</b>, súbor z domovského adresára). Oprava: <code>restorecon -v /var/www/html/index.html</code>. SYSCALL a PROCTITLE sú pomocné.', next:'sudo restorecon -Rv /var/www/html'},
 {id:'l4', t:'Prihlásenie cez SSH', src:'sudo journalctl -u sshd --since "08:00"', ask:'Prečo sa Jana nevie prihlásiť? (Útoky zvonku ignoruj.)', lines:[
  'Nov 07 08:01:12 web01 sshd[2101]: Invalid user oracle from 45.155.205.233 port 41022',
  'Nov 07 08:01:14 web01 sshd[2101]: Failed password for invalid user oracle from 45.155.205.233 port 41022 ssh2',
  'Nov 07 08:15:30 web01 sshd[2210]: Accepted publickey for admin from 10.0.20.15 port 53122 ssh2: RSA SHA256:3kQ…',
  'Nov 07 08:40:02 web01 sshd[2388]: pam_faillock(sshd:auth): Consecutive login failures for user jana account temporarily locked',
  'Nov 07 08:40:02 web01 sshd[2388]: Failed password for jana from 10.0.20.44 port 50112 ssh2',
  'Nov 07 08:41:07 web01 sshd[2392]: Connection closed by authenticating user jana 10.0.20.44 port 50120 [preauth]'], key:[3],
  why:'pam_faillock: účet <b>jana</b> je dočasne zamknutý po opakovaných zlých heslách. Ďalšie „Failed password“ sú už dôsledok (aj správne heslo by teraz zlyhalo). Pokusy o „oracle“ z internetu sú bežný šum.', next:'sudo faillock --user jana; sudo faillock --user jana --reset'},
 {id:'l5', t:'Aplikácia zmizla', src:'sudo dmesg -T | tail -6', ask:'Čo sa stalo s aplikáciou?', lines:[
  '[Sat Nov  7 11:20:01 2026] java invoked oom-killer: gfp_mask=0x140cca(GFP_HIGHUSER_MOVABLE|__GFP_COMP), order=0, oom_score_adj=0',
  '[Sat Nov  7 11:20:01 2026] Mem-Info:',
  '[Sat Nov  7 11:20:01 2026] active_anon:912833 inactive_anon:24110 isolated_anon:0',
  '[Sat Nov  7 11:20:01 2026] Out of memory: Killed process 5120 (java) total-vm:7340032kB, anon-rss:3612544kB, file-rss:0kB, shmem-rss:0kB, UID:991 pgtables:7400kB oom_score_adj:0',
  '[Sat Nov  7 11:20:01 2026] oom_reaper: reaped process 5120 (java), now anon-rss:0kB, file-rss:0kB, shmem-rss:0kB'], key:[3],
  why:'„Out of memory: Killed process 5120 (java)“: jadro minulo pamäť a zabilo najväčší proces. anon-rss 3,6 GB = koľko proces naozaj zaberal. V <code>systemctl status</code> uvidíš <b>Result: oom-kill</b>. Rieši sa limitom aplikácie (napr. -Xmx), nie reštartom.', next:'free -h; systemctl status reporting'},
 {id:'l6', t:'Služba nenaštartuje', src:'systemctl status appka', ask:'Ktorý riadok hovorí, čo treba opraviť?', lines:[
  '× appka.service - Interná aplikácia',
  '     Loaded: loaded (/etc/systemd/system/appka.service; enabled; preset: disabled)',
  '     Active: failed (Result: exit-code) since Sat 2026-11-07 09:30:12 CET; 3min ago',
  '    Process: 4120 ExecStart=/opt/appka/bin/appka (code=exited, status=203/EXEC)',
  '   Main PID: 4120 (code=exited, status=203/EXEC)',
  'Nov 07 09:30:12 web01 systemd[1]: appka.service: Failed to execute /opt/appka/bin/appka: Permission denied',
  'Nov 07 09:30:12 web01 systemd[1]: appka.service: Failed at step EXEC spawning /opt/appka/bin/appka: Permission denied'], key:[5,6],
  why:'status=203/EXEC znamená, že systemd nevedel spustiť program z ExecStart. Riadok „Failed to execute … Permission denied“ hovorí prečo: súbor nemá právo x (alebo je na noexec oddiele / má zlý SELinux typ). Oprava: <code>chmod +x</code>.', next:'ls -l /opt/appka/bin/appka'},
 {id:'l7', t:'Plný disk?', src:'df -h; df -i', ask:'Prečo hlási aplikácia „No space left on device“, hoci miesta je dosť?', lines:[
  'Filesystem             Size  Used Avail Use% Mounted on',
  '/dev/mapper/rhel-root   30G   12G   18G  40% /',
  '/dev/mapper/rhel-var    10G  4.1G  5.9G  41% /var',
  'Filesystem              Inodes   IUsed  IFree IUse% Mounted on',
  '/dev/mapper/rhel-root  15728640 201113 15527527   2% /',
  '/dev/mapper/rhel-var    5242880 5242880       0  100% /var'], key:[5],
  why:'Miesta (df -h) je dosť, ale na /var došli <b>inody</b> (df -i 100 %). Každý súbor potrebuje inode: milióny malých súborov (session súbory, mailové fronty, cache) ich minú. Hľadaj adresár s najviac súbormi.', next:'sudo find /var -xdev -type f | cut -d/ -f2-4 | sort | uniq -c | sort -n | tail'},
 {id:'l8', t:'Cron úloha', src:'sudo grep zaloha /var/log/cron', ask:'Prečo záloha nebeží?', lines:[
  'Nov 07 02:30:01 web01 CROND[8812]: (root) CMD (zaloha.sh >> /var/log/zaloha.log 2>&1)',
  'Nov 06 02:30:01 web01 CROND[7710]: (root) CMD (zaloha.sh >> /var/log/zaloha.log 2>&1)',
  '--- sudo cat /var/log/zaloha.log ---',
  '/bin/sh: line 1: zaloha.sh: command not found',
  '/bin/sh: line 1: zaloha.sh: command not found'], key:[3,4],
  why:'Cron úlohu spúšťa (CMD), takže cron funguje. Chyba je až vo výstupe: <b>command not found</b>, lebo cron má krátky PATH bez /usr/local/bin. Riešenie: plná cesta /usr/local/bin/zaloha.sh. Bez presmerovania výstupu do logu by si chybu nevidel.', next:'sudo crontab -l'},
 {id:'l9', t:'Server po reštarte nenaštartoval', src:'journalctl -b -p err (v emergency mode)', ask:'Ktorý riadok je príčina (nie dôsledok)?', lines:[
  'Nov 07 06:01:31 web01 systemd[1]: dev-disk-by\\x2duuid-7e2a1c94\\x2d3b5f.device: Job dev-disk-by\\x2duuid-7e2a1c94\\x2d3b5f.device/start timed out.',
  'Nov 07 06:01:31 web01 systemd[1]: Timed out waiting for device /dev/disk/by-uuid/7e2a1c94-3b5f-4d8e-a1c2-9f0b6e7d3a15.',
  'Nov 07 06:01:31 web01 systemd[1]: Dependency failed for /data.',
  'Nov 07 06:01:31 web01 systemd[1]: Dependency failed for Local File Systems.',
  'Nov 07 06:01:31 web01 systemd[1]: local-fs.target: Job local-fs.target/start failed with result \'dependency\'.'], key:[1],
  why:'Pôvod je „Timed out waiting for device /dev/disk/by-uuid/7e2a…“: v /etc/fstab je UUID, ktorý neexistuje (preklep alebo vymenený disk). Všetko pod tým („Dependency failed…“) sú dôsledky. Porovnaj s <code>blkid</code>, oprav fstab, <code>mount -a</code>, <code>systemctl default</code>.', next:'blkid; grep -v "^#" /etc/fstab'},
 {id:'l10', t:'dnf nejde', src:'sudo dnf install -y tree', ask:'Ktorý repozitár je problém?', lines:[
  'Updating Subscription Management repositories.',
  'Red Hat Enterprise Linux 9 for x86_64 - BaseOS (RPMs)       41 kB/s | 4.1 kB     00:00',
  'Red Hat Enterprise Linux 9 for x86_64 - AppStream (RPMs)    45 kB/s | 4.5 kB     00:00',
  'Firma nástroje                                              0.0  B/s |   0  B     00:30',
  'Errors during downloading metadata for repository \'firma-tools\':',
  '  - Curl error (6): Couldn\'t resolve host name for http://repo.stara-firma.local/tools/repodata/repomd.xml [Could not resolve host: repo.stara-firma.local]',
  'Error: Failed to download metadata for repo \'firma-tools\': Cannot download repomd.xml: Cannot download repodata/repomd.xml: All mirrors were tried'], key:[5],
  why:'BaseOS a AppStream sú v poriadku. Repo <b>firma-tools</b> ukazuje na server, ktorého meno sa nedá preložiť (DNS): zrušený server. Ak ho netreba, vypni ho (<code>dnf config-manager --set-disabled firma-tools</code>), inak oprav adresu.', next:'dnf repolist; cat /etc/yum.repos.d/firma-tools.repo'},
 {id:'l11', t:'Pripojenie na databázu', src:'curl / aplikácia / nc', ask:'Ktorá hláška znamená, že server odpovedá, ale na porte nič nepočúva?', lines:[
  'nc: connect to db01.firma.local port 5432 (tcp) failed: Connection refused',
  'curl: (7) Failed to connect to 10.0.40.10 port 445 after 3001 ms: Connection timed out',
  'ping: db02.firma.local: Name or service not known',
  'ssh: connect to host 10.0.20.50 port 22: No route to host'], key:[0],
  why:'<b>Connection refused</b> = server žije a odpovedal, ale na porte nič nepočúva (služba nebeží / iný port). <b>Timed out</b> = odpoveď neprišla (firewall zahodil, zlá trasa, server vypnutý). <b>Name or service not known</b> = DNS. <b>No route to host</b> = často firewall s REJECT alebo nedostupná sieť.', next:'ss -tlpn na cieľovom serveri'},
 {id:'l12', t:'Čo sa zmenilo?', src:'sudo journalctl --since "09:40" --until "09:50"', ask:'Ktorý riadok vysvetľuje, prečo web od 9:45 nejde?', lines:[
  'Nov 07 09:41:02 web01 sshd[3301]: Accepted publickey for peter from 10.0.20.17 port 51122 ssh2',
  'Nov 07 09:42:18 web01 sudo[3330]:    peter : TTY=pts/1 ; PWD=/home/peter ; USER=root ; COMMAND=/usr/bin/vim /etc/httpd/conf.d/intranet.conf',
  'Nov 07 09:44:51 web01 sudo[3361]:    peter : TTY=pts/1 ; PWD=/home/peter ; USER=root ; COMMAND=/usr/bin/systemctl restart httpd',
  'Nov 07 09:44:51 web01 httpd[3370]: AH00526: Syntax error on line 12 of /etc/httpd/conf.d/intranet.conf:',
  'Nov 07 09:44:51 web01 httpd[3370]: Invalid command \'Requre\', perhaps misspelled or defined by a module not included in the server configuration',
  'Nov 07 09:44:51 web01 systemd[1]: httpd.service: Failed with result \'exit-code\'.',
  'Nov 07 09:46:30 web01 chronyd[812]: Selected source 10.0.20.2'], key:[4],
  why:'Časové okno okolo výpadku ukáže príbeh: Peter upravil intranet.conf, reštartoval httpd a ten padol na <b>preklep „Requre“</b> (má byť Require) na riadku 12. Takto (--since/--until, bez -u) zistíš, čo sa zmenilo, aj keď nevieš, ktorej službe sa to týka. Pred reštartom vždy <code>httpd -t</code>.', next:'sudo httpd -t'}
];

/* ---------- rozhodovací strom ---------- */
window.TRIAGE_TREE = {
 start:{q:'Čo je príznak?', o:[['Web alebo aplikácia nejde','web'],['Nedá sa prihlásiť (SSH, sudo)','login'],['Služba nenaštartuje / padá','svc'],['Server je pomalý','slow'],['Nedostanem sa na iný server','net'],['dnf / aktualizácia nejde','dnf'],['Po reštarte niečo nefunguje','boot']]},
 web:{q:'Funguje <code>curl -I localhost</code> priamo na serveri?', o:[['Áno, lokálne ide, zvonku nie','web_fw'],['Nie, „Connection refused“','svc'],['Vracia 403','web_403'],['Vracia 500 / 502 / 503','web_5xx']]},
 web_fw:{r:'Problém je medzi klientom a službou: <b>firewall</b> na serveri alebo v sieti, prípadne služba počúva len na 127.0.0.1.', c:['sudo firewall-cmd --list-all','ss -tlpn | grep -E ":80|:443"','z klienta: nc -zv SERVER 80'], rb:'web'},
 web_403:{r:'Server odpovedá, ale nesmie čítať súbor: <b>práva</b>, <b>SELinux kontext</b> alebo <code>Require</code> v konfigurácii.', c:['ls -lZ /var/www/html','sudo ausearch -m AVC -ts recent','sudo tail /var/log/httpd/error_log'], rb:'prava'},
 web_5xx:{r:'Web server beží, ale <b>aplikácia za ním</b> (PHP, proxy na backend, databáza) zlyháva.', c:['sudo tail -30 /var/log/httpd/error_log','systemctl status php-fpm','sudo ausearch -m AVC -ts recent   # httpd_can_network_connect?'], rb:'web'},
 login:{q:'Kde to zlyháva?', o:[['Hneď „Connection refused / timed out“','net'],['Pýta heslo, ale nepustí','login_acc'],['Prihlási sa, ale sudo nejde','login_sudo']]},
 login_acc:{r:'Sieť a sshd fungujú. Problém je <b>účet</b>: zamknutý, expirované heslo, faillock, alebo kľúč/práva ~/.ssh.', c:['sudo journalctl -u sshd --since "-30min"','sudo passwd -S MENO; sudo chage -l MENO','sudo faillock --user MENO'], rb:'login'},
 login_sudo:{r:'Používateľ nie je v skupine <b>wheel</b> alebo v sudoers.d (často usermod -G bez -a).', c:['id MENO','sudo grep MENO /var/log/secure | tail'], rb:'login'},
 svc:{r:'<b>Služba</b>: zisti presnú hlášku. systemd povie výsledok (exit-code, 203/EXEC, oom-kill…), journal povie prečo.', c:['systemctl status SLUŽBA','sudo journalctl -xeu SLUŽBA','sudo httpd -t / sshd -t (test konfigurácie)','sudo ausearch -m AVC -ts recent'], rb:'sluzba'},
 slow:{q:'Čo ukáže <code>uptime</code> a <code>top</code>?', o:[['Vysoký load, proces na 100 % CPU','slow_cpu'],['Málo pamäte, swap plný','slow_mem'],['Load vysoký, CPU nie (vysoké wa)','slow_io']]},
 slow_cpu:{r:'Jeden alebo viac procesov žerie CPU. Zisti, čo ich spúšťa (cron? služba?), oprav <b>príčinu</b> a až potom zabíjaj.', c:['top (P = podľa CPU)','ps -eo pid,ppid,user,%cpu,etime,cmd --sort=-%cpu | head','grep -r MENO /etc/cron* /var/spool/cron'], rb:'pomaly'},
 slow_mem:{r:'Pamäť: zisti, kto ju má, a či už zasahoval OOM killer.', c:['free -h','ps aux --sort=-%mem | head','sudo dmesg -T | grep -i "out of memory"'], rb:'pamat'},
 slow_io:{r:'Čaká sa na disk (wa v top). Plný alebo pomalý disk, chyby v dmesg.', c:['df -h; df -i','sudo dmesg -T | grep -iE "error|i/o"','iostat -x 2 (balík sysstat)'], rb:'disk'},
 net:{q:'Čo hovorí chyba?', o:[['Name or service not known','net_dns'],['Connection refused','net_ref'],['Timed out / No route to host','net_route']]},
 net_dns:{r:'<b>DNS</b>: meno sa nedá preložiť.', c:['getent hosts MENO','cat /etc/resolv.conf','nmcli dev show ens192 | grep DNS'], rb:'dns'},
 net_ref:{r:'Cieľ žije, ale na porte nič nepočúva: rieš <b>službu na cieľovom</b> serveri.', c:['na cieli: ss -tlpn; systemctl status SLUŽBA'], rb:'sluzba'},
 net_route:{r:'Pakety sa nedostanú: <b>trasa</b>, <b>firewall</b> (u teba, po ceste, na cieli) alebo cieľ nebeží.', c:['ip route get IP','ping -c2 BRÁNA','tracepath IP','sudo firewall-cmd --list-all (na cieli)'], rb:'siet'},
 dnf:{r:'Prečítaj, ktorý <b>repozitár</b> zlyháva, a skontroluj miesto vo /var.', c:['sudo dnf install -y BALÍK (prečítaj chybu)','dnf repolist','df -h /var','cat /etc/yum.repos.d/*.repo'], rb:'dnf'},
 boot:{rb2:1, r:'Niečo platilo len do reštartu (start bez enable, firewall bez --permanent, ip bez nmcli), alebo štart zlyhal. Porovnaj predchádzajúci a aktuálny štart.', c:['systemctl --failed','systemctl is-enabled SLUŽBA','sudo firewall-cmd --list-all --permanent','sudo journalctl -b -1 -p err; sudo journalctl -b -p err'], rb:'restart'}
};

/* ---------- incidenty naslepo: vágne tikety a dôkazy ---------- */
window.BLIND = {
 web:{L:'fw', t:['Ahoj, intranet od rána nejde. Píše, že sa nevie pripojiť. Kolega včera niečo menil na úvodnej stránke.','Používatelia hlásia, že intranet (web01) sa nenačíta. Dá sa s tým niečo urobiť?'], ev:[[/firewall-cmd/,'firewall'],[/ls .*-\w*Z|ausearch|sealert|audit\.log/,'SELinux kontext'],[/curl/,'test webu']]},
 disk:{L:'disk', t:['Monitoring svieti načerveno pri web01, nejaký disk. Aplikácia hlási chyby pri zápise.','Na web01 nejde nič uložiť, aplikácia píše „No space left“.'], ev:[[/^(sudo )?df/,'df'],[/du /,'du (čo zaberá)'],[/lsof/,'otvorené zmazané súbory']]},
 ssh:{L:'sluzba', t:['Nikto z nás sa od rána nevie dostať na server cez SSH. Konzola cez VMware ide.','SSH na server nefunguje, ani mne, ani kolegom. Včera sa vraj niečo menilo kvôli bezpečnosti.'], ev:[[/systemctl status sshd|journalctl .*sshd/,'stav sshd'],[/semanage port|ausearch|sealert/,'SELinux port'],[/firewall-cmd|ss -/,'port a firewall']]},
 reboot:{L:'boot', t:['Po víkendovej údržbe (reštart) nám monitoring ukazuje server ako nedostupný.','Od reštartu nevidíme z web01 metriky v Grafane.'], ev:[[/systemctl (status|is-enabled) .*agent|--failed/,'stav agenta'],[/firewall-cmd/,'firewall']]},
 user:{L:'ucet', t:['Jana sa nevie prihlásiť na server a vraj nemôže ani robiť správcovské veci.','Ahoj, Jane nejde prihlásenie na web01. Včera ju pridávali do nejakej novej skupiny.'], ev:[[/passwd -S|chage -l/,'stav účtu'],[/^(sudo )?id /,'skupiny']]},
 perm:{L:'prava', t:['Aplikácia od presunu dát nevie ukladať exporty. V logu má niečo s prístupom.','Export z appky nefunguje od včera, keď sme sťahovali dáta na nový disk.'], ev:[[/ls -\w*l\w* .*\/srv|namei/,'práva cesty'],[/sudo -u appka/,'test ako appka']]},
 dns:{L:'siet', t:['Aplikácia sa nevie pripojiť na databázu db01. Databáza beží, iné servery k nej idú.','Web01 nevidí db01, z mojho PC ju vidím.'], ev:[[/getent|nslookup|dig|host /,'preklad mena'],[/resolv\.conf|nmcli .*dns|nmcli dev show/,'DNS nastavenie']]},
 cron:{L:'sluzba', t:['Všimli sme si, že nočné zálohy sa už nejaký čas nerobia. Ručne skript ide.','V adresári záloh nič nové od minulého týždňa.'], ev:[[/crontab -l|\/etc\/cron/,'crontab'],[/zaloha\.log|\/var\/log\/cron/,'log úlohy']]},
 varfull:{L:'disk', t:['Aktualizácia na web01 padá s chybou, neviem čo s tým.','dnf update nejde dokončiť.'], ev:[[/^(sudo )?df/,'df'],[/du /,'du'],[/journalctl .*disk-usage/,'veľkosť journalu']]},
 cas:{L:'cas', t:['Kolegom nejde prihlásenie doménovými účtami na tento server, inde ide.','Časy v logoch nesedia s ostatnými servermi a prihlásenie cez AD padá.'], ev:[[/timedatectl|^date|chronyc/,'čas a synchronizácia'],[/chrony\.conf/,'konfigurácia chrony']]},
 repo:{L:'balik', t:['Nedá sa nič nainštalovať, dnf vypíše chybu.','Chcel som doinštalovať tree a nejde to.'], ev:[[/dnf (install|repolist)/,'chyba dnf'],[/yum\.repos\.d/,'súbory repozitárov']]},
 oom:{L:'zdroje', t:['Reporting aplikácia každú chvíľu sama spadne. Hovoria, že „málo pamäte“.','Reporty sa negenerujú, služba je vždy po chvíli mŕtva.'], ev:[[/systemctl status reporting|journalctl .*reporting/,'stav služby'],[/dmesg|journalctl .*-k|free/,'pamäť / OOM']]},
 update:{L:'konf', t:['Po včerajšej aktualizácii nejde web.','Od patchovania v noci je intranet dole.'], ev:[[/systemctl status httpd|journalctl .*httpd/,'stav httpd'],[/httpd -t|apachectl/,'test konfigurácie'],[/dnf history/,'čo sa zmenilo']]},
 cert:{L:'konf', t:['Prehliadač hlási, že intranet nie je bezpečný.','Používatelia dostávajú varovanie o certifikáte na https://intranet.'], ev:[[/openssl|curl .*https/,'certifikát'],[/ssl\.conf|SSLCertificate/,'konfigurácia SSL']]},
 envf:{L:'sluzba', t:['Po reštarte servera nebeží reportovacia služba.','Služba report je mŕtva, od upratovania servera.'], ev:[[/systemctl (status|cat) report|journalctl .*report/,'stav a definícia služby']]},
 fstab:{L:'boot', t:['Server po reštarte nenabehol, na konzole niečo o emergency mode.'], ev:[[/journalctl .*-b|journalctl -xb/,'log štartu'],[/blkid|fstab|findmnt/,'fstab a disky']]},
 cpu:{L:'zdroje', t:['Server je strašne pomalý, všetko trvá večnosť.','Web01 ledva reaguje, aj SSH sa pripája pomaly.'], ev:[[/^(top|ps|uptime)/,'procesy a záťaž'],[/cron/,'čo ich spúšťa']]},
 lock:{L:'ucet', t:['Jana sa nevie prihlásiť, vraj zadáva správne heslo.','Ahoj, Jana ma nepustí na server, hovorí že heslo má dobre.'], ev:[[/faillock|journalctl .*sshd|\/var\/log\/secure/,'dôvod odmietnutia'],[/passwd -S|chage -l/,'stav účtu']]},
 nas:{L:'siet', t:['Zálohy na NAS od reštartu nefungujú, NAS je v poriadku.','Server sa nevie dostať na NAS (10.0.40.10).'], ev:[[/ip route|ip r\b|route get/,'smerovanie'],[/ping|tracepath|nc /,'test dostupnosti']]}
};
window.BLIND_PAIRS = ["web+disk","web+ssh","web+reboot","web+user","web+perm","web+dns","web+cron","web+varfull","web+cas","web+repo","web+oom","web+envf","web+cpu","web+lock","web+nas","disk+repo","disk+update","disk+cert","disk+envf","disk+cpu","ssh+reboot","ssh+user","ssh+perm","ssh+dns","ssh+cron","ssh+cas","ssh+oom","ssh+update","ssh+cert","ssh+envf","ssh+cpu","ssh+lock","ssh+nas","reboot+user","reboot+perm","reboot+dns","reboot+cron","reboot+varfull","reboot+cas","reboot+repo","reboot+oom","reboot+update","reboot+cert","reboot+envf","reboot+cpu","reboot+lock","reboot+nas","user+perm","user+dns","user+cron","user+varfull","user+cas","user+repo","user+oom","user+update","user+cert","user+envf","user+cpu","user+nas","perm+dns","perm+cron","perm+varfull","perm+cas","perm+repo","perm+oom","perm+update","perm+cert","perm+envf","perm+cpu","perm+lock","perm+nas","dns+cron","dns+varfull","dns+cas","dns+repo","dns+oom","dns+update","dns+cert","dns+envf","dns+cpu","dns+lock","dns+nas","cron+varfull","cron+cas","cron+repo","cron+oom","cron+update","cron+cert","cron+envf","cron+cpu","cron+lock","cron+nas","varfull+nas","cas+repo","cas+oom","cas+update","cas+cert","cas+envf","cas+cpu","cas+lock","cas+nas","repo+oom","repo+update","repo+cert","repo+envf","repo+cpu","repo+lock","repo+nas","oom+update","oom+cert","oom+envf","oom+cpu","oom+lock","oom+nas","update+envf","update+cpu","update+lock","update+nas","cert+nas","envf+cpu","envf+lock","envf+nas","cpu+lock","cpu+nas","lock+nas"];

/* ---------- kapitola 27 ---------- */
window.CHAPTERS.push({n:27, title:'Hľadanie chýb: metóda, logy a journalctl', short:'Hľadanie chýb',
goal:'Pri akomkoľvek probléme vedieť, kde začať, ktorý log otvoriť, ako v ňom nájsť jeden dôležitý riadok a ako zistiť, čo sa zmenilo. Bez návodu, len podľa príznaku.',
body:[
['p','Skúsený správca nevie naspamäť všetky chyby. Má <b>metódu</b>: vždy rovnaké prvé kroky, rozdelí problém na vrstvy a hľadá <b>dôkaz</b>, konkrétny riadok v logu, ktorý vysvetľuje príznak. Až potom opravuje. Táto kapitola je o tejto metóde a o logoch. Precvičíš ju v nástrojoch <a href="#detektiv">Detektív</a> (náhodné poruchy naslepo), <a href="#citanie-logov">Čítanie logov</a> a <a href="#diagnostika">Diagnostika</a> (mapa logov a rozhodovací strom).'],
['h','Metóda v 6 krokoch'],
['table',['Krok','Čo robíš','Otázky'],[
 ['1. Príznak','zisti presne, čo nejde','Čo presne? Odkedy? Komu (všetkým, jednému)? Odkiaľ? Aká je presná chybová hláška?'],
 ['2. Prvých 60 sekúnd','spusti pevný zoznam kontrol','Nie je plný disk, pamäť, spadnutá služba, chyby v journale?'],
 ['3. Čo sa zmenilo','nájdi poslednú zmenu','Reštart? Aktualizácia (dnf history)? Kto bol prihlásený (last, sudo v journale)? Úprava konfigurácie?'],
 ['4. Vrstva','zúž problém','Sieť, firewall, služba, konfigurácia, práva, SELinux, disk, pamäť, čas, účet?'],
 ['5. Dôkaz','nájdi riadok v logu','Ktorý riadok vysvetľuje príznak? Je to príčina, alebo len dôsledok?'],
 ['6. Oprava a overenie','oprav príčinu, nie príznak','Funguje to? Prežije to reštart? Zapísal som, čo som spravil?']]],
['warn','Najčastejšia chyba: opravovať naslepo (reštart, chmod 777, setenforce 0) skôr, než nájdeš dôkaz. Problém sa vráti a nevieš prečo. A <code>setenforce 0</code> či <code>systemctl stop firewalld</code> na produkcii nie sú oprava.'],
['h','Prvých 60 sekúnd na serveri'],
['p','Tento zoznam spusti <b>vždy</b>, keď nevieš, čo sa deje. Za minútu vylúčiš polovicu príčin.'],
['table',['Príkaz','Čo hľadáš'], window.TRIAGE60.map(([c,d])=>['<code>'+c+'</code>', d])],
['cmd','uptime; df -h; free -h; systemctl --failed','prvé štyri naraz'],
['h','Vrstvy: kde môže byť problém'],
['table',['Vrstva','Typický príznak','Prvé príkazy','Log'], window.LAYERS.map(l=>[l.t, l.sym, '<code>'+l.cmd+'</code>', '<code>'+l.log+'</code>'])],
['tip','Rýchle rozdelenie: funguje to <b>lokálne</b> na serveri (<code>curl localhost</code>, <code>ss -tlpn</code>)? Áno → problém je medzi (firewall, sieť, DNS). Nie → problém je na serveri (služba, konfigurácia, práva, SELinux).'],
['h','Kde sú logy'],
['p','RHEL má dva systémy, ktoré bežia vedľa seba: <b>journal</b> (systemd-journald, binárny, čítaš ho cez <code>journalctl</code>) a <b>textové súbory</b> v <code>/var/log</code> (rsyslog ich zapisuje z journalu). Veľa služieb navyše píše vlastné súbory.'],
['table',['Súbor','Čo v ňom je'],[
 ['<code>/var/log/messages</code>','všeobecné správy systému a služieb (okrem prihlásení)'],
 ['<code>/var/log/secure</code>','prihlásenia, sshd, sudo, zmeny hesiel'],
 ['<code>/var/log/audit/audit.log</code>','audit: SELinux zamietnutia (AVC), prihlásenia, príkazy cez sudo'],
 ['<code>/var/log/cron</code>','kedy cron čo spustil (nie výstup úlohy)'],
 ['<code>/var/log/dnf.log</code>, <code>dnf.rpm.log</code>','inštalácie a aktualizácie'],
 ['<code>/var/log/boot.log</code>','výpis zo štartu'],
 ['<code>/var/log/maillog</code>','pošta (postfix)'],
 ['<code>/var/log/httpd/</code>, <code>/var/log/nginx/</code>','webový server: error_log/error.log a access_log'],
 ['<code>/var/log/journal/</code>','trvalý journal (ak existuje, prežije reštart)']]],
['p','Úplný zoznam podľa služieb s typickými hláškami nájdeš v <a href="#diagnostika">mape logov</a>.'],
['h','Anatómia riadku v logu'],
['pre','Nov 07 09:44:12 web01 systemd[1]: agent.service: Failed at step EXEC spawning /opt/monitoring/bin/agent: Permission denied\n└──── čas ─────┘ └host┘ └proces[PID]┘ └──────────────────────── správa ────────────────────────┘'],
['list',['<b>Čas</b>: porovnaj s časom, keď problém začal (od kedy?)','<b>Proces[PID]</b>: kto správu napísal. systemd[1] hovorí o službe, httpd[3370] je samotná služba','<b>Správa</b>: hľadaj slová error, failed, denied, refused, timeout, cannot, unable, invalid','Prvá chyba v čase je zvyčajne <b>príčina</b>, ďalšie sú <b>dôsledky</b> (Dependency failed, Failed with result…)']],
['h','journalctl do hĺbky'],
['table',['Príkaz','Čo spraví'],[
 ['<code>journalctl -u httpd</code>','len jedna služba'],
 ['<code>journalctl -xeu httpd</code>','koniec logu služby s vysvetlivkami (-x), skočí na koniec (-e)'],
 ['<code>journalctl -f</code>, <code>-fu httpd</code>','sleduj naživo (Ctrl+C koniec): spusti v druhom okne a v prvom skúšaj'],
 ['<code>journalctl -p err</code>','priorita err a horšia (crit, alert, emerg). <code>-p warning</code> pridá varovania'],
 ['<code>journalctl -b</code>','od posledného štartu. <code>-b -1</code> predchádzajúci štart (čo sa stalo pred reštartom/pádom)'],
 ['<code>journalctl --list-boots</code>','zoznam štartov, ktoré journal pozná'],
 ['<code>journalctl --since "09:40" --until "09:50"</code>','časové okno: všetko, čo sa dialo okolo výpadku'],
 ['<code>--since today</code>, <code>yesterday</code>, <code>"-1h"</code>, <code>"30 min ago"</code>, <code>"2026-11-07 09:30"</code>','formáty času'],
 ['<code>journalctl -n 50</code>','posledných 50 riadkov'],
 ['<code>journalctl -r</code>','od najnovšieho'],
 ['<code>journalctl -g "Failed|denied"</code>','filtrovanie správ regulárnym výrazom (--grep)'],
 ['<code>journalctl -k</code>','len správy jadra (ako dmesg, ale aj z minulých štartov s -b -1)'],
 ['<code>journalctl _PID=1203</code>, <code>_COMM=sudo</code>','podľa procesu alebo programu'],
 ['<code>journalctl -t zaloha</code>','podľa značky (logger -t)'],
 ['<code>journalctl -o short-iso</code>, <code>-o verbose</code>, <code>-o cat</code>, <code>-o json</code>','iný formát: presný dátum / všetky polia / len správa / pre skripty'],
 ['<code>journalctl --disk-usage</code>, <code>--vacuum-size=500M</code>','koľko miesta zaberá, zmazanie starých záznamov']]],
['tip','Najsilnejšia otázka pri výpadku: <b>čo sa dialo práve vtedy?</b> <code>sudo journalctl --since "09:40" --until "09:50"</code> bez <code>-u</code> ukáže všetky služby a prihlásenia naraz. Často uvidíš, že niekto tesne pred výpadkom niečo upravil (sudo riadky).'],
['warn','Ak <code>journalctl -b -1</code> hlási, že predchádzajúci štart nepozná, journal nie je trvalý (beží len v pamäti). Zapneš ho: <code>sudo mkdir -p /var/log/journal; sudo systemctl restart systemd-journald</code> (alebo <code>Storage=persistent</code> v /etc/systemd/journald.conf). Na RHEL 9 a 10 je trvalý zvyčajne už od inštalácie.'],
['h','Výsledky systemd: čo znamená status'],
['table',['V systemctl status','Význam','Ďalší krok'],[
 ['<code>status=203/EXEC</code>','program z ExecStart neexistuje alebo sa nedá spustiť','<code>ls -l</code> cesty, chmod +x, SELinux'],
 ['<code>status=217/USER</code>','používateľ z User= neexistuje','<code>id MENO</code>'],
 ['<code>status=200/CHDIR</code>','WorkingDirectory neexistuje',''],
 ['<code>Result: resources</code>','chýba EnvironmentFile, nedá sa vytvoriť adresár…','journalctl -u'],
 ['<code>Result: oom-kill</code>','proces zabil OOM killer','free -h, dmesg'],
 ['<code>Result: timeout</code>','služba nenaštartovala v časovom limite','log služby: na čo čakala?'],
 ['<code>Result: signal</code>, <code>core-dump</code>','proces spadol (segfault) alebo ho niekto zabil','coredumpctl, journalctl'],
 ['<code>status=1/FAILURE</code>','program sám skončil chybou: dôvod je v jeho riadkoch nad tým','journalctl -u SLUŽBA'],
 ['<code>start-limit-hit</code>','služba padala príliš často, systemd ju prestal skúšať','oprav príčinu, potom <code>systemctl reset-failed SLUŽBA</code>']]],
['h','Slovník chybových hlášok'],
['table',['Hláška','Čo znamená','Kam ďalej'],[
 ['Permission denied','práva, vlastník alebo SELinux','ls -l, namei -l, ls -Z, ausearch -m AVC'],
 ['No such file or directory','zlá cesta, chýba súbor, preklep','ls, which, rpm -qf'],
 ['Connection refused','cieľ žije, port je zatvorený (služba nebeží)','ss -tlpn na cieli'],
 ['Connection timed out','odpoveď neprišla: firewall zahodil, zlá trasa, cieľ vypnutý','ping, ip route get, tracepath'],
 ['No route to host','sieť nedostupná alebo firewall s REJECT','firewall-cmd --list-all, ip route'],
 ['Name or service not known / Could not resolve host','DNS','getent hosts, resolv.conf'],
 ['Address already in use','port obsadil iný proces','ss -tlpn | grep :PORT'],
 ['No space left on device','plný disk alebo inody','df -h, df -i'],
 ['Read-only file system','súborový systém prepnutý len na čítanie (chyba disku)','dmesg -T, mount'],
 ['Too many open files','limit otvorených súborov (LimitNOFILE)','ulimit -n, systemctl show -p LimitNOFILE'],
 ['avc: denied','SELinux zakázal operáciu','ausearch -m AVC, sealert, restorecon, semanage, setsebool'],
 ['Out of memory: Killed process','OOM killer','free -h, limity aplikácie'],
 ['certificate has expired / not yet valid','certifikát vypršal alebo zlý čas','openssl x509 -dates, timedatectl'],
 ['Authentication failure / Account locked','heslo, zámok faillock, expirácia','faillock, passwd -S, chage -l'],
 ['segfault','program spadol','journalctl, coredumpctl, aktualizácia balíka']]],
['h','Hľadanie v súboroch logov'],
['pre',`sudo grep -i "error\\|fail\\|denied" /var/log/messages | tail -20
sudo grep -h "Nov  7 09:4" /var/log/messages /var/log/secure   # všetko o 9:40-9:49
sudo tail -f /var/log/httpd/error_log                          # naživo
sudo grep -c "Failed password" /var/log/secure                 # koľko zlých hesiel
sudo zgrep "kernel" /var/log/messages-*.gz 2>/dev/null         # aj v starých (rotovaných) logoch
sudo ausearch -m AVC -ts today                                 # SELinux dnes
sudo ausearch -m USER_CMD -ts recent                           # kto čo spustil cez sudo`],
['tip','Logy sa rotujú (logrotate): staré sú v <code>/var/log/messages-20261101</code> a podobne. Keď hľadáš staršiu udalosť, pozri aj tie.']
],
quiz:[
 {q:'Web nejde zvonku, ale <code>curl localhost</code> na serveri vráti stránku. Kde je problém najpravdepodobnejšie?',o:['Apache nebeží','Konfigurácia Apache','Firewall alebo sieť medzi klientom a serverom','SELinux kontext súborov'],a:2,w:'Lokálne funguje = služba, konfigurácia, práva aj SELinux sú v poriadku. Zostáva cesta medzi: firewall, sieť, DNS.'},
 {q:'V logu je 5 riadkov chýb. Ktorý je zvyčajne príčina?',o:['Posledný','Prvý v čase','Ten najdlhší','Ten s „Failed with result“'],a:1,w:'Prvá chyba spôsobí ďalšie. „Dependency failed“ a „Failed with result“ sú dôsledky.'},
 {q:'Server sa v noci sám reštartoval. Ako zistíš, čo sa dialo tesne pred tým?',o:['journalctl -b','journalctl -b -1 -n 50','dmesg','systemctl --failed'],a:1,w:'-b -1 = predchádzajúci štart, -n 50 jeho posledných 50 riadkov. -b a dmesg ukazujú len aktuálny štart.'},
 {q:'Čo znamená <code>Connection refused</code>?',o:['Firewall paket zahodil','DNS nepozná meno','Cieľový server odpovedal, ale na porte nič nepočúva','Zlé heslo'],a:2,w:'Pri zahodení firewallom by bol timeout, pri REJECT zvyčajne „No route to host“.'},
 {q:'<code>systemctl status</code> ukazuje <code>status=203/EXEC</code>. Čo skontroluješ?',o:['Pamäť servera','Či program z ExecStart existuje a má právo x','Firewall','Či beží databáza'],a:1,w:'203/EXEC = systemd nevedel spustiť program. Častá príčina: chýba chmod +x, zlá cesta, noexec, SELinux typ.'},
 {q:'Ako zobrazíš všetko, čo sa na serveri dialo medzi 9:40 a 9:50, bez ohľadu na službu?',o:['journalctl -u all --time 9:40-9:50','journalctl --since "09:40" --until "09:50"','grep 9:4 /var/log/*','dmesg --since 09:40'],a:1,w:'Bez -u ukáže journal všetky služby aj sudo riadky: vidíš, kto čo menil.'},
 {q:'Aplikácia hlási „No space left on device“, ale <code>df -h</code> ukazuje 40 %. Čo ďalej?',o:['df -i (inody)','Reštart servera','free -h','Zväčšiť disk'],a:0,w:'Došli inody: priveľa malých súborov. df -i to ukáže.'},
 {q:'Ktorý zásah je pri hľadaní príčiny 403 na RHEL v poriadku?',o:['setenforce 0 a nechať tak','chmod -R 777 /var/www','ls -Z a ausearch -m AVC, potom restorecon','vypnúť firewalld'],a:2,w:'Najprv dôkaz (AVC), potom cielená oprava. Vypínanie ochrán problém skryje a otvorí bezpečnostnú dieru.'}
],
ex:[
 {t:'Služba <code>agent</code> nebeží. Nájdi v journale, s akým kódom (status=…) zlyhala, a zapíš len ten kód (napr. <code>1/FAILURE</code>) do súboru <code>~/agent.txt</code>.',h:'sudo journalctl -u agent alebo systemctl status agent; hľadaj status=',sol:'sudo journalctl -u agent\necho "203/EXEC" > ~/agent.txt',check:m=>fileHas(m, H+'/agent.txt', /^203\/EXEC$/)},
 {t:'Niekto sa ráno pokúšal prihlásiť ako root. Nájdi v journale sshd jeho IP adresu a zapíš ju do <code>~/utocnik.txt</code>.',h:'sudo journalctl -u sshd; hľadaj Failed password for root from …',sol:'sudo journalctl -u sshd -g "Failed password"\necho 203.0.113.77 > ~/utocnik.txt',check:m=>fileHas(m, H+'/utocnik.txt', /^203\.0\.113\.77$/)},
 {t:'Zobraz len chyby (priorita <b>err</b> a horšia) z času medzi <b>7:00</b> a <b>8:00</b>.',h:'journalctl -p err --since "07:00" --until "08:00"',sol:'sudo journalctl -p err --since "07:00" --until "08:00"',check:m=>ran(m,'journalctl',e=>e.args.includes('-p') && e.args.some(a=>/^0?7:00/.test(a)) && e.args.some(a=>/^0?8:00/.test(a)))},
 {t:'Server bol v noci reštartovaný. Zisti z <b>predchádzajúceho štartu</b>, ktorý používateľ dal príkaz na reštart, a zapíš jeho meno do <code>~/kto.txt</code>.',h:'sudo journalctl -b -1; hľadaj sudo … COMMAND=/usr/sbin/reboot',sol:'sudo journalctl --list-boots\nsudo journalctl -b -1 -n 5\necho admin > ~/kto.txt',check:m=>ran(m,'journalctl',e=>e.args.includes('-1') || e.args.includes('-b-1') || e.args.some(a=>/--boot=-1/.test(a))) && fileHas(m, H+'/kto.txt', /^admin$/)},
 {t:'Vypíš posledné 3 záznamy služby <code>sshd</code> s presným dátumom (formát ISO).',h:'-o short-iso a -n 3',sol:'sudo journalctl -u sshd -o short-iso -n 3',check:m=>ran(m,'journalctl',e=>e.args.includes('short-iso') && e.args.some(a=>/^(-n)?3$/.test(a)) && e.args.includes('sshd'))},
 {t:'Zapíš do journalu správu <code>údržba začala</code> so značkou <code>udrzba</code> a potom zobraz len správy s touto značkou.',h:'logger -t …; journalctl -t …',sol:'logger -t udrzba "údržba začala"\njournalctl -t udrzba',check:m=>(m._ulog||[]).some(x=>x.tag==='udrzba') && ran(m,'journalctl',e=>e.args.includes('-t') && e.args.includes('udrzba'))}
]});

/* ---------- dril ---------- */
window.DRILL.push(
 {id:'d_failed', ch:27, q:'Vypíš služby, ktoré zlyhali.', a:'systemctl --failed', w:'Prvý krok pri každom probléme.', check:m=>ran(m,'systemctl',e=>e.args.includes('--failed') || (e.args.includes('list-units') && e.args.some(a=>/--state=failed/.test(a))))},
 {id:'d_err', ch:27, q:'Zobraz všetky chyby (priorita err a horšia) od posledného štartu.', a:'sudo journalctl -p err -b', w:'-p err = err, crit, alert, emerg.', check:m=>ran(m,'journalctl',e=>e.args.includes('-p') && e.args.includes('err') && e.args.includes('-b'))},
 {id:'d_win', ch:27, q:'Zobraz všetko z journalu medzi <b>9:40</b> a <b>9:50</b> (všetky služby).', a:'sudo journalctl --since "09:40" --until "09:50"', w:'Časové okno okolo výpadku: kto čo menil.', check:m=>ran(m,'journalctl',e=>e.args.some(a=>/^0?9:40/.test(a)) && e.args.some(a=>/^0?9:50/.test(a)))},
 {id:'d_prev', ch:27, q:'Zobraz posledných 20 riadkov z <b>predchádzajúceho</b> štartu servera.', a:'sudo journalctl -b -1 -n 20', w:'-b -1 = jeden štart dozadu.', check:m=>ran(m,'journalctl',e=>e.args.includes('-1') && e.args.includes('20'))},
 {id:'d_boots', ch:27, q:'Vypíš zoznam štartov, ktoré pozná journal.', a:'journalctl --list-boots', w:'Ak je len jeden, journal nemusí byť trvalý.', check:m=>ran(m,'journalctl',e=>e.args.includes('--list-boots'))},
 {id:'d_xeu', ch:27, q:'Zobraz koniec logu služby <code>agent</code> s vysvetlivkami systemd.', a:'sudo journalctl -xeu agent', w:'-x vysvetlivky, -e koniec, -u služba.', check:m=>ran(m,'journalctl',e=>e.args.some(a=>/^-[a-z]*x[a-z]*$/.test(a)) && e.args.includes('agent'))},
 {id:'d_since1h', ch:27, q:'Zobraz z journalu všetko za poslednú hodinu.', a:'sudo journalctl --since "1 hour ago"', w:'Ide aj --since "-1h" alebo "-60min".', check:m=>ran(m,'journalctl',e=>e.args.some(a=>/^(-1h|-60min|-60m|1 hour ago|60 min ago|60 minutes ago)$/.test(a)))},
 {id:'d_pid', ch:27, q:'Zobraz z journalu len záznamy procesu s PID <code>1203</code>.', a:'sudo journalctl _PID=1203', w:'Polia journalu: _PID, _COMM, _SYSTEMD_UNIT, _UID.', check:m=>ran(m,'journalctl',e=>e.args.includes('_PID=1203'))},
 {id:'d_grep', ch:27, q:'Nájdi v journale služby <code>sshd</code> len riadky so slovom <code>Failed</code>.', a:'sudo journalctl -u sshd -g Failed', w:'-g (--grep) filtruje správy.', check:m=>ran(m,'journalctl',e=>e.args.includes('sshd') && (e.args.includes('-g')||e.args.includes('--grep')||e.args.some(a=>/^--grep=/.test(a))))},
 {id:'d_avc', ch:27, q:'Zobraz nedávne SELinux zamietnutia z auditu.', a:'sudo ausearch -m AVC -ts recent', w:'recent = posledných 10 minút, today = dnes.', check:m=>ran(m,'ausearch',e=>e.args.includes('AVC'))},
 {id:'d_dmesgT', ch:27, q:'Zobraz posledné správy jadra s čitateľným časom.', a:'sudo dmesg -T | tail', w:'-T prevedie čas od štartu na dátum.', check:m=>ran(m,'dmesg',e=>e.flags.has('T'))},
 {id:'d_inodes', ch:27, q:'Zisti obsadenosť <b>inodov</b> na súborových systémoch.', a:'df -i', w:'Keď df -h ukazuje miesto, ale „No space left“.', check:m=>ran(m,'df',e=>e.flags.has('i'))},
 {id:'d_secure', ch:27, q:'Spočítaj riadky so slovami <code>Failed password</code> v <code>/var/log/secure</code>.', a:'sudo grep -c "Failed password" /var/log/secure', w:'-c = počet riadkov.', check:m=>ran(m,'grep',e=>e.flags.has('c') && has(e,/Failed password/) && has(e,/\/var\/log\/secure/))},
 {id:'d_tailf', ch:27, q:'Sleduj naživo nové záznamy služby <code>httpd</code> v journale.', a:'sudo journalctl -fu httpd', w:'-f follow. V praxi v druhom okne, kým v prvom skúšaš.', check:m=>ran(m,'journalctl',e=>e.args.some(a=>/^-[a-z]*f[a-z]*$/.test(a)) && e.args.includes('httpd'))}
);

/* ---------- úlohy na skutočnom serveri ---------- */
window.LAB_TASKS[27] = [
 {t:'Spusti „prvých 60 sekúnd“ (zoznam v kapitole) na svojom serveri a ku každému riadku si povedz, či je v norme.', ok:'Vieš, ako vyzerá zdravý server: aký load, koľko pamäte, ktoré služby.'},
 {t:'V jednom okne <code>sudo journalctl -f</code>, v druhom sa skús prihlásiť cez SSH so zlým heslom a spusti <code>sudo -l</code>. Sleduj, čo pribudne. Potom <code>sudo grep -i failed /var/log/secure</code>.', ok:'Vidíš, ako sa udalosti zapisujú do journalu aj do /var/log/secure.'},
 {t:'Reštartuj server a po štarte porovnaj <code>journalctl --list-boots</code>, <code>journalctl -b -1 -n 20</code> a <code>last -x | head</code>.', ok:'Vieš sa pozrieť do predchádzajúceho štartu.'},
 {t:'Pokaz si web: <code>sudo mv ~/index.html /var/www/html/</code> (súbor vytvorený v domovskom adresári). Bez nápovedy nájdi dôkaz (error_log, ausearch) a oprav to.', ok:'Našiel si AVC s tcontext=user_home_t a opravil cez restorecon.'}
];

/* ---------- postup ---------- */
window.RUNBOOKS.unshift({id:'neviem', t:'Neviem, čo sa deje (všeobecný postup)', sym:'čokoľvek: „nejde to“, „je to pomalé“, „od rána problém“', ch:[27], inc:[],
 first: window.TRIAGE60.slice(0,7),
 causes:[['Disk 100 %',['sudo du -xsh /var/* | sort -h','pozri postup Plný disk']],['Služba v --failed',['sudo journalctl -xeu SLUŽBA','systemctl status SLUŽBA']],['Chyby v journale',['prvá chyba v čase je príčina, ďalšie dôsledky']],['Nič zjavné',['sudo journalctl --since "ČAS_ZAČIATKU" --until "+10min"','sudo dnf history | head; last | head   # čo sa zmenilo?']]],
 verify:['zopakuj príznak (curl, prihlásenie, …)','prežije to reštart?','zapíš, čo si zistil a spravil']});
})();
