/* =========================================================
   PRÍKAZOVÝ DRIL
   q: zadanie, a: vzorová odpoveď, w: vysvetlenie,
   setup(m): príprava stroja, check(m): overenie po spustení
   ========================================================= */
(function(){
const L = (m,n)=>m.log.filter(e=>e.name===n);
const ran = (m,n,flags=[],pred)=>L(m,n).some(e=>e.code===0 && flags.every(f=>e.flags.has(f)) && (!pred||pred(e)));
const arg = (e,re)=>e.args.some(a=>re.test(a));
const root = e=>e.user==='root';
const asRoot = (m,cmds)=>{ const p=m.user; m.user='root'; try { cmds.forEach(c=>m.run(' '+c)); } finally { m.user=p; } };

window.DRILL = [
/* --- súbory --- */
{id:'ls1', ch:2, q:'Vypíš obsah <code>/var/log</code> v dlhom formáte s čitateľnými veľkosťami.', a:'ls -lh /var/log', w:'-l dlhý formát, -h veľkosti ako 4.0K/12M.', check:m=>ran(m,'ls',['l','h'],e=>arg(e,/^\/var\/log\/?$/))},
{id:'ls2', ch:2, q:'Vypíš svoj domovský adresár aj so skrytými súbormi.', a:'ls -la ~', w:'-a zobrazí súbory začínajúce bodkou (-A bez . a ..).', check:m=>L(m,'ls').some(e=>e.code===0 && (e.flags.has('a')||e.flags.has('A')))},
{id:'ls3', ch:2, q:'Vypíš <code>/var/log</code> zoradené podľa času tak, aby bol najnovší súbor posledný (na konci výpisu).', a:'ls -ltr /var/log', w:'-t podľa času (najnovší hore), -r otočí poradie.', check:m=>ran(m,'ls',['t','r'],e=>arg(e,/var\/log/))},
{id:'mk1', ch:2, q:'Jedným príkazom vytvor adresár <code>~/a/b/c</code> (aj s a a b).', a:'mkdir -p ~/a/b/c', w:'-p vytvorí aj chýbajúce nadradené adresáre.', check:m=>m.isDir('/home/admin/a/b/c')},
{id:'cp1', ch:2, q:'Skopíruj adresár <code>~/skripty</code> aj s obsahom do <code>/tmp/</code>.', a:'cp -r ~/skripty /tmp/', w:'Bez -r (alebo -a) cp adresár preskočí.', check:m=>m.isFile('/tmp/skripty/zaloha.sh')},
{id:'ln1', ch:2, q:'Vytvor symbolický odkaz <code>~/logy-sys</code>, ktorý ukazuje na <code>/var/log</code>.', a:'ln -s /var/log ~/logy-sys', w:'ln -s CIEĽ MENO_ODKAZU. Najprv to, na čo ukazuje.', check:m=>{ const n=m.node('/home/admin/logy-sys',false); return n && n.t==='l' && /\/var\/log\/?$/.test(n.tgt); }},
{id:'pwd', ch:2, q:'Zisti, v ktorom adresári sa práve nachádzaš.', a:'pwd', w:'print working directory.', check:m=>ran(m,'pwd')},
/* --- čítanie a hľadanie --- */
{id:'tail', ch:4, q:'Zobraz posledných 20 riadkov súboru <code>~/logy/app.log</code>.', a:'tail -n 20 ~/logy/app.log', w:'tail -n N (alebo tail -20).', check:m=>L(m,'tail').some(e=>e.code===0 && (e.args.includes('20') || e.args.includes('-20') || e.args.includes('-n20')) && arg(e,/app\.log/))},
{id:'gi', ch:4, q:'Nájdi v <code>~/logy/app.log</code> všetky riadky so slovom error bez ohľadu na veľkosť písmen.', a:'grep -i error ~/logy/app.log', w:'-i ignoruje veľkosť písmen, nájde ERROR aj error.', check:m=>ran(m,'grep',['i'],e=>arg(e,/^error$/i))},
{id:'gc', ch:4, q:'Spočítaj, koľko riadkov v <code>~/logy/app.log</code> obsahuje <code>ERROR</code>.', a:'grep -c ERROR ~/logy/app.log', w:'-c vypíše len počet. Ide aj grep ERROR … | wc -l.', check:m=>ran(m,'grep',['c'],e=>arg(e,/ERROR/)) || (ran(m,'grep',[],e=>arg(e,/ERROR/)) && ran(m,'wc',['l']))},
{id:'gv', ch:4, q:'Vypíš <code>/etc/selinux/config</code> bez riadkov, ktoré začínajú znakom <code>#</code>.', a:'grep -v "^#" /etc/selinux/config', w:'-v invertuje výber, ^ znamená začiatok riadku.', check:m=>ran(m,'grep',['v'],e=>arg(e,/^\^#/) && arg(e,/selinux\/config/))},
{id:'grn', ch:4, q:'Rekurzívne nájdi v <code>/etc/ssh</code> text <code>PermitRootLogin</code> a zobraz čísla riadkov.', a:'sudo grep -rn PermitRootLogin /etc/ssh', w:'-r rekurzívne, -n čísla riadkov. Súbory sú čitateľné len pre roota.', check:m=>ran(m,'grep',['r','n'],e=>arg(e,/PermitRootLogin/) && root(e)) || ran(m,'grep',['R','n'],e=>arg(e,/PermitRootLogin/) && root(e))},
{id:'fn', ch:4, q:'Nájdi v <code>/etc</code> všetky súbory s príponou <code>.conf</code>.', a:'find /etc -name "*.conf" 2>/dev/null', w:'Vzor daj do úvodzoviek, inak ho rozbalí shell.', check:m=>L(m,'find').some(e=>arg(e,/^\/etc\/?$/) && e.args.includes('-name') && arg(e,/^\*\.conf$/))},
{id:'fs', ch:4, q:'Nájdi v <code>/var</code> súbory väčšie ako 100 MB.', a:'sudo find /var -size +100M', w:'+ väčšie, - menšie, M = MiB.', check:m=>L(m,'find').some(e=>arg(e,/^\/var\/?$/) && e.args.includes('-size') && arg(e,/^\+100M$/))},
{id:'fm', ch:4, q:'Nájdi v <code>/etc</code> súbory zmenené za poslednú hodinu.', a:'sudo find /etc -mmin -60', w:'-mmin v minútach, -mtime v dňoch. Mínus = menej ako.', check:m=>L(m,'find').some(e=>arg(e,/^\/etc\/?$/) && ((e.args.includes('-mmin') && arg(e,/^-60$/)) || (e.args.includes('-mtime') && false)))},
/* --- rúry --- */
{id:'uniq', ch:6, q:'Z <code>~/data/prihlasenia.txt</code> zisti, koľkokrát sa vyskytuje každé meno.', a:'sort ~/data/prihlasenia.txt | uniq -c', w:'uniq zlučuje len susedné riadky, preto najprv sort.', check:m=>ran(m,'sort') && ran(m,'uniq',['c'])},
{id:'cut', ch:6, q:'Vypíš z <code>/etc/passwd</code> len mená používateľov (prvý stĺpec).', a:'cut -d: -f1 /etc/passwd', w:'-d oddeľovač, -f stĺpec. Ide aj awk -F: \'{print $1}\'.', check:m=>ran(m,'cut',[],e=>arg(e,/passwd/) && e.args.some(a=>/^-d:?$|^-d:/.test(a)) && e.args.some(a=>/^-?f?1$|^-f1$/.test(a))) || ran(m,'awk',[],e=>arg(e,/passwd/) && arg(e,/\$1/))},
{id:'tee', ch:6, q:'Pridaj na koniec <code>/etc/hosts</code> riadok <code>10.0.20.50 mon01</code>.', a:'echo "10.0.20.50 mon01" | sudo tee -a /etc/hosts', w:'sudo echo … >> súbor nefunguje, presmerovanie robí shell bez rootu.', check:m=>/10\.0\.20\.50\s+mon01\s*$/m.test(m.read('/etc/hosts')||'') && /localhost/.test(m.read('/etc/hosts')||'')},
/* --- používatelia --- */
{id:'ua', ch:7, q:'Vytvor používateľa <code>peter</code>.', a:'sudo useradd peter', w:'Na RHEL sa domovský adresár vytvorí automaticky.', check:m=>!!m.users.peter},
{id:'um', ch:7, q:'Pridaj používateľa <code>admin</code> do skupiny <code>adm</code> tak, aby mu ostali ostatné skupiny.', a:'sudo usermod -aG adm admin', w:'Bez -a by usermod -G odobral ostatné skupiny vrátane wheel.', check:m=>m.groups.adm.mem.includes('admin') && m.groups.wheel.mem.includes('admin')},
{id:'idu', ch:7, q:'Zisti UID a skupiny používateľa <code>admin</code>.', a:'id admin', w:'id ukáže uid, gid a všetky skupiny.', check:m=>ran(m,'id')},
{id:'lock', ch:7, q:'Zamkni účet používateľa <code>jana</code> (heslo prestane fungovať).', a:'sudo usermod -L jana', w:'Alebo passwd -l jana. Odomknutie: usermod -U.', setup:m=>asRoot(m,['useradd jana','passwd jana']), check:m=>m.users.jana && m.users.jana.locked},
{id:'chg', ch:7, q:'Zobraz nastavenie platnosti hesla používateľa <code>admin</code>.', a:'sudo chage -l admin', w:'chage -l ukáže expiráciu a max. počet dní.', check:m=>ran(m,'chage',['l'])},
/* --- práva --- */
{id:'p640', ch:8, q:'Nastav súboru <code>~/poznamky.txt</code> práva <code>rw-r-----</code>.', a:'chmod 640 ~/poznamky.txt', w:'rw- = 6, r-- = 4, --- = 0.', check:m=>(m.node('/home/admin/poznamky.txt').m&0o777)===0o640},
{id:'px', ch:8, q:'Sprav skript <code>~/skripty/zaloha.sh</code> spustiteľným pre vlastníka.', a:'chmod u+x ~/skripty/zaloha.sh', w:'u = vlastník, +x = pridaj spúšťanie.', check:m=>!!(m.node('/home/admin/skripty/zaloha.sh').m & 0o100)},
{id:'own', ch:8, q:'Nastav vlastníka adresára <code>/srv/data</code> na <code>admin</code> a skupinu na <code>wheel</code>.', a:'sudo chown admin:wheel /srv/data', w:'chown POUŽÍVATEĽ:SKUPINA, mení len root.', setup:m=>asRoot(m,['mkdir /srv/data']), check:m=>{ const n=m.node('/srv/data'); return n.u==='admin' && n.g==='wheel'; }},
{id:'acl', ch:8, q:'Daj používateľovi <code>jana</code> právo čítať <code>~/poznamky.txt</code> pomocou ACL.', a:'setfacl -m u:jana:r ~/poznamky.txt', w:'setfacl -m u:MENO:práva. Súbor potom má v ls -l znak +.', setup:m=>asRoot(m,['useradd jana']), check:m=>{ const n=m.node('/home/admin/poznamky.txt'); return (n.acl||[]).some(x=>x.k==='u' && x.n==='jana' && (x.p&4)); }},
/* --- procesy --- */
{id:'psa', ch:9, q:'Zobraz všetky procesy všetkých používateľov aj so stĺpcami %CPU a %MEM.', a:'ps aux', w:'BSD štýl bez pomlčky: a všetci, u formát s používateľom, x aj bez terminálu.', check:m=>L(m,'ps').some(e=>/aux|axu/.test(e.args.join(' ')))},
{id:'free', ch:9, q:'Zisti voľnú pamäť v čitateľnom tvare.', a:'free -h', w:'Dôležitý je stĺpec available.', check:m=>ran(m,'free',['h'])},
{id:'dft', ch:9, q:'Zisti obsadenosť diskov v čitateľnom tvare aj s typom súborového systému.', a:'df -hT', w:'-h čitateľne, -T typ (xfs, tmpfs).', check:m=>ran(m,'df',['h','T'])},
{id:'dus', ch:9, q:'Zisti, koľko miesta celkom zaberá <code>/var/log</code> (jeden súčet).', a:'sudo du -sh /var/log', w:'-s súčet, -h čitateľne.', check:m=>ran(m,'du',['s','h'],e=>arg(e,/\/var\/log/))},
/* --- systemd --- */
{id:'sst', ch:10, q:'Zobraz stav služby <code>sshd</code>.', a:'systemctl status sshd', w:'Ukáže Loaded (enabled?), Active a posledné logy.', check:m=>ran(m,'systemctl',[],e=>e.args[0]==='status' && arg(e,/^sshd(\.service)?$/))},
{id:'sen', ch:10, q:'Jedným príkazom spusti <code>httpd</code> a nastav, aby štartoval pri boote.', a:'sudo systemctl enable --now httpd', w:'enable = pri štarte, --now = aj hneď.', setup:m=>asRoot(m,['dnf install -y httpd']), check:m=>m.svc.httpd.active && m.svc.httpd.enabled && m.log.filter(e=>e.name==='systemctl').length===1},
{id:'jub', ch:10, q:'Zobraz log služby <code>sshd</code> len od posledného štartu systému.', a:'journalctl -u sshd -b', w:'-u jednotka, -b od bootu.', check:m=>ran(m,'journalctl',['u','b'])},
{id:'jerr', ch:10, q:'Zobraz všetky chyby (priorita err a horšia) zo žurnálu od posledného štartu.', a:'journalctl -p err -b', w:'-p priorita, -b boot.', check:m=>ran(m,'journalctl',['p','b'],e=>arg(e,/^(err|3)$/) || arg(e,/^-p(err|3)$/))},
{id:'sfail', ch:10, q:'Vypíš jednotky systemd, ktoré zlyhali.', a:'systemctl --failed', w:'Prvý príkaz po reštarte servera.', check:m=>L(m,'systemctl').some(e=>e.flags.has('failed') || e.args.some(a=>/state=failed/.test(a)))},
{id:'dr', ch:10, q:'Upravil si súbor v <code>/etc/systemd/system/</code>. Povedz systemd, aby definície načítal znova.', a:'sudo systemctl daemon-reload', w:'Bez toho systemd používa starú verziu súboru.', check:m=>ran(m,'systemctl',[],e=>e.args[0]==='daemon-reload' && root(e))},
/* --- balíky --- */
{id:'prov', ch:11, q:'Zisti, ktorý balík obsahuje príkaz <code>semanage</code>.', a:'dnf provides semanage', w:'provides funguje aj pre nenainštalované balíky.', check:m=>ran(m,'dnf',[],e=>/^(provides|whatprovides)$/.test(e.args[0]))},
{id:'inst', ch:11, q:'Nainštaluj balík <code>tree</code> bez potvrdzovacej otázky.', a:'sudo dnf install -y tree', w:'-y odpovie áno automaticky.', check:m=>m.pkgs.has('tree') && ran(m,'dnf',['y'])},
{id:'rqf', ch:11, q:'Zisti, ktorému balíku patrí súbor <code>/etc/chrony.conf</code>.', a:'rpm -qf /etc/chrony.conf', w:'-q dopyt, -f súbor.', check:m=>ran(m,'rpm',['q','f'])},
{id:'dhist', ch:11, q:'Zobraz históriu transakcií dnf.', a:'dnf history', w:'Odtiaľ vieš vrátiť zmenu: dnf history undo ID.', check:m=>ran(m,'dnf',[],e=>e.args[0]==='history')},
{id:'rqc', ch:11, q:'Vypíš konfiguračné súbory balíka <code>openssh-server</code>.', a:'rpm -qc openssh-server', w:'-q dopyt, -c config súbory.', check:m=>ran(m,'rpm',['q','c'],e=>arg(e,/openssh-server/))},
/* --- sieť --- */
{id:'ss', ch:12, q:'Zisti, ktoré programy počúvajú na TCP aj UDP portoch, s menami procesov a číslami portov.', a:'sudo ss -tulpn', w:'t TCP, u UDP, l počúvajúce, p procesy, n čísla. Procesy vidíš len so sudo.', check:m=>L(m,'ss').some(e=>['t','u','l','p','n'].every(f=>e.flags.has(f)) && root(e))},
{id:'ipbr', ch:12, q:'Zobraz IP adresy rozhraní v stručnom formáte.', a:'ip -br a', w:'-br brief, a = addr.', check:m=>L(m,'ip').some(e=>e.args.includes('-br') && e.args.some(a=>/^a(ddr(ess)?)?$/.test(a)))},
{id:'ipr', ch:12, q:'Zobraz smerovaciu tabuľku a predvolenú bránu.', a:'ip r', w:'Riadok default via … je brána.', check:m=>L(m,'ip').some(e=>e.args.some(a=>/^r(o(ute)?)?$/.test(a)))},
{id:'gent', ch:12, q:'Over, na akú IP sa preloží meno <code>db01.firma.local</code> (rovnakým spôsobom ako pre aplikácie).', a:'getent hosts db01.firma.local', w:'getent používa /etc/hosts aj DNS, presne ako aplikácie. dig ide len do DNS.', check:m=>ran(m,'getent',[],e=>e.args[0]==='hosts' && arg(e,/db01/)) || ran(m,'host') || ran(m,'dig') || ran(m,'ping',[],e=>arg(e,/db01/))},
{id:'ping', ch:12, q:'Pošli presne 3 pingy na bránu <code>10.0.20.1</code>.', a:'ping -c 3 10.0.20.1', w:'Bez -c beží ping, kým ho nezastavíš.', check:m=>L(m,'ping').some(e=>e.code===0 && (e.args.includes('3') || e.args.includes('-c3')) && arg(e,/10\.0\.20\.1$/))},
{id:'dns', ch:12, q:'Nastav v profile <code>ens192</code> DNS server <code>10.0.20.2</code> (natrvalo, cez NetworkManager).', a:'sudo nmcli con mod ens192 ipv4.dns 10.0.20.2', w:'Potom nmcli con up ens192. resolv.conf sa generuje z profilu.', check:m=>(m.net.pendingDns||'').replace(/"/g,'')==='10.0.20.2' || (m.net.dns==='10.0.20.2' && m.ran('nmcli'))},
/* --- firewall --- */
{id:'fla', ch:13, q:'Zobraz všetko, čo firewall povoľuje v predvolenej zóne.', a:'firewall-cmd --list-all', w:'Služby, porty, rich rules, rozhrania.', check:m=>ran(m,'firewall-cmd',['list-all'])},
{id:'fhttps', ch:13, q:'Povoľ službu <code>https</code> natrvalo (aby prežila reštart).', a:'sudo firewall-cmd --permanent --add-service=https', w:'Bez --permanent zmena zmizne. Potom --reload, aby platila aj hneď.', check:m=>m.fw.perm.public.services.includes('https')},
{id:'f8443', ch:13, q:'Otvor port <code>8443/tcp</code> natrvalo a zároveň tak, aby platil hneď.', a:'sudo firewall-cmd --permanent --add-port=8443/tcp && sudo firewall-cmd --reload', w:'--permanent zapíše, --reload načíta. Alebo príkaz dvakrát: s --permanent aj bez.', check:m=>m.fw.perm.public.ports.includes('8443/tcp') && m.fw.runtime.public.ports.includes('8443/tcp')},
{id:'fcock', ch:13, q:'Odober natrvalo službu <code>cockpit</code> z predvolenej zóny.', a:'sudo firewall-cmd --permanent --remove-service=cockpit', w:'Rovnaký princíp: --permanent a potom --reload.', check:m=>!m.fw.perm.public.services.includes('cockpit')},
/* --- SELinux --- */
{id:'genf', ch:14, q:'Zisti aktuálny režim SELinuxu.', a:'getenforce', w:'Enforcing / Permissive / Disabled. Podrobne: sestatus.', check:m=>ran(m,'getenforce') || ran(m,'sestatus')},
{id:'lsz', ch:14, q:'Zobraz SELinux kontext súborov v <code>/var/www/html</code>.', a:'ls -Z /var/www/html', w:'-Z ukáže kontext. Zaujíma ťa typ (…_t).', setup:m=>asRoot(m,['dnf install -y httpd']), check:m=>ran(m,'ls',['Z'],e=>arg(e,/var\/www/))},
{id:'rcon', ch:14, q:'Súbory v <code>/var/www/html</code> majú zlý SELinux kontext. Oprav ich rekurzívne.', a:'sudo restorecon -Rv /var/www/html', w:'restorecon vráti predvolený kontext podľa politiky.', setup:m=>{ asRoot(m,['dnf install -y httpd']); const n=m._mkPath('/var/www/html/index.html','f',0o644,'root','root','<h1>x</h1>\n'); n.ctx='user_home_t'; }, check:m=>m.node('/var/www/html/index.html').ctx==='httpd_sys_content_t'},
{id:'sbool', ch:14, q:'Natrvalo povoľ apache sieťové spojenia (SELinux boolean <code>httpd_can_network_connect</code>).', a:'sudo setsebool -P httpd_can_network_connect on', w:'-P = prežije reštart.', check:m=>m.se.boolPerm && m.se.boolPerm.httpd_can_network_connect},
{id:'sport', ch:14, q:'Povoľ v SELinuxe apache port <code>8081/tcp</code>.', a:'sudo semanage port -m -t http_port_t -p tcp 8081', w:'8081 už má v politike typ transproxy_port_t, preto -m (modify). Voľný port by si pridal cez -a. Potom ešte firewall. semanage je v policycoreutils-python-utils.', setup:m=>asRoot(m,['dnf install -y policycoreutils-python-utils']), check:m=>m.se.extraPorts.some(p=>p.t==='http_port_t' && p.port===8081)},
/* --- disky --- */
{id:'lsblk', ch:15, q:'Zobraz disky a partície aj so súborovými systémami a UUID.', a:'lsblk -f', w:'-f pridá FSTYPE a UUID.', check:m=>ran(m,'lsblk',['f'])},
{id:'lvx', ch:15, q:'Zväčši <code>/dev/rhel/root</code> o 2G spolu so súborovým systémom.', a:'sudo lvextend -r -L +2G /dev/rhel/root', w:'-r zväčší aj XFS, + znamená „o koľko“.', check:m=>m.lvm.lvs['rhel/root'].size>=31.99 && m.lvm.lvs['rhel/root'].grown},
{id:'mnta', ch:15, q:'Upravil si <code>/etc/fstab</code>. Otestuj ho bez reštartu servera.', a:'sudo mount -a', w:'Alebo sudo findmnt --verify. Chyba vo fstab = server nenaštartuje.', check:m=>ran(m,'mount',['a'],root) || ran(m,'findmnt',['verify'])},
/* --- ssh, tar --- */
{id:'tarc', ch:16, q:'Vytvor gzip archív <code>/tmp/skripty.tar.gz</code> z adresára <code>~/skripty</code>.', a:'tar -czf /tmp/skripty.tar.gz ~/skripty', w:'c vytvor, z gzip, f súbor (posledné).', check:m=>m.exists('/tmp/skripty.tar.gz') && ran(m,'tar',['c','z'])},
{id:'tart', ch:16, q:'Vypíš obsah archívu <code>~/stiahnute/appka-2.0.tar.gz</code> bez rozbalenia.', a:'tar -tzf ~/stiahnute/appka-2.0.tar.gz', w:'t = list.', check:m=>ran(m,'tar',['t'])},
{id:'kg', ch:16, q:'Vygeneruj SSH kľúč typu ed25519.', a:'ssh-keygen -t ed25519', w:'Verejný kľúč je .pub, súkromný nikdy nedávaj preč.', check:m=>m.exists('/home/admin/.ssh/id_ed25519.pub')},
{id:'sshdt', ch:16, q:'Otestuj konfiguráciu sshd pred reštartom služby.', a:'sudo sshd -t', w:'Bez výstupu = v poriadku.', check:m=>ran(m,'sshd',['t'],root)},
/* --- cron, čas --- */
{id:'crl', ch:17, q:'Vypíš svoj crontab.', a:'crontab -l', w:'Úprava: crontab -e.', check:m=>L(m,'crontab').some(e=>e.flags.has('l'))},
{id:'tdc', ch:17, q:'Zobraz čas, časové pásmo a či je zapnutá synchronizácia (NTP).', a:'timedatectl', w:'Zdroje NTP: chronyc sources.', check:m=>ran(m,'timedatectl')},
/* --- produkty, skripty, boot, výkon --- */
{id:'rpmk', ch:18, q:'Over podpis súboru <code>~/stiahnute/acme-agent-3.2.1-1.el9.x86_64.rpm</code>.', a:'rpm -K ~/stiahnute/acme-agent-3.2.1-1.el9.x86_64.rpm', w:'Bez importovaného kľúča hlási SIGNATURES NOT OK.', check:m=>L(m,'rpm').some(e=>e.flags.has('K')||e.flags.has('checksig'))},
{id:'loc', ch:18, q:'Nainštaluj lokálny súbor <code>~/stiahnute/acme-agent-3.2.1-1.el9.x86_64.rpm</code> aj so závislosťami.', a:'sudo dnf install ./stiahnute/acme-agent-3.2.1-1.el9.x86_64.rpm', w:'dnf install s cestou k súboru, nie rpm -ivh.', check:m=>m.pkgs.has('acme-agent') && ran(m,'dnf')},
{id:'bsh', ch:19, q:'Spusti skript <code>~/skripty/kontrola.sh</code> bez toho, aby si mu menil práva.', a:'bash ~/skripty/kontrola.sh', w:'bash súbor funguje aj bez práva x.', check:m=>ran(m,'bash',[],e=>arg(e,/kontrola\.sh/)) || ran(m,'sh',[],e=>arg(e,/kontrola\.sh/))},
{id:'for', ch:19, q:'Jedným riadkom s cyklom <code>for</code> over stav služieb sshd, firewalld a chronyd (<code>systemctl is-active</code>).', a:'for s in sshd firewalld chronyd; do systemctl is-active $s; done', w:'for PREMENNÁ in zoznam; do …; done', check:m=>L(m,'systemctl').filter(e=>e.args[0]==='is-active').length>=3},
{id:'grb', ch:20, q:'Pridaj všetkým jadrám parameter <code>audit=1</code> (prejaví sa po reštarte).', a:'sudo grubby --update-kernel=ALL --args="audit=1"', w:'grubby upravuje BLS záznamy v /boot/loader/entries.', check:m=>/(^| )audit=1( |$)/.test(m.grub.args)},
{id:'tad', ch:23, q:'Zisti aktívny tuned profil.', a:'tuned-adm active', w:'Odporúčaný: tuned-adm recommend.', check:m=>ran(m,'tuned-adm',[],e=>e.args[0]==='active')},
{id:'scw', ch:23, q:'Nastav <code>vm.swappiness</code> na 10 len dočasne (do reštartu).', a:'sudo sysctl -w vm.swappiness=10', w:'Natrvalo: súbor v /etc/sysctl.d/ a sysctl --system.', check:m=>m.sysctl['vm.swappiness']==='10'},
{id:'podr', ch:22, q:'Spusti na pozadí kontajner s menom <code>web</code> z <code>registry.access.redhat.com/ubi9/httpd-24</code> s portom 8080 na 8080.', a:'podman run -d --name web -p 8080:8080 registry.access.redhat.com/ubi9/httpd-24', w:'-d na pozadí, -p HOSTITEĽ:KONTAJNER.', setup:m=>asRoot(m,['dnf install -y container-tools']), check:m=>(m.containers||[]).some(c=>c.name==='web' && c.running && c.ports.some(p=>p.startsWith('8080:')))},
{id:'ansp', ch:21, q:'Over cez Ansible modul <code>ping</code>, že odpovedajú všetky servery z inventára <code>~/ansible/inventory.example</code>.', a:'ansible all -i ~/ansible/inventory.example -m ping', w:'-i inventár, -m modul.', setup:m=>asRoot(m,['dnf install -y ansible-core']), check:m=>ran(m,'ansible',[],e=>e.args.includes('-i') && e.args.includes('ping'))},
{id:'ansc', ch:21, q:'Spusti playbook <code>~/ansible/web.yml</code> s inventárom <code>~/ansible/inventory.example</code> len nanečisto.', a:'ansible-playbook -i ~/ansible/inventory.example ~/ansible/web.yml --check', w:'--check (-C) nič nemení.', setup:m=>{ asRoot(m,['dnf install -y ansible-core']); m.run(' ansible-galaxy collection install ansible.posix'); m.log=[]; }, check:m=>ran(m,'ansible-playbook',[],e=>e.args.includes('-i') && (e.args.includes('--check')||e.args.includes('-C')))},
{id:'galx', ch:21, q:'Playbook končí chybou <code>couldn\'t resolve module/action \'ansible.posix.firewalld\'</code>. Doinštaluj chýbajúcu kolekciu.', a:'ansible-galaxy collection install ansible.posix', w:'ansible-core má len ansible.builtin. Kolekcia ide do ~/.ansible/collections.', setup:m=>asRoot(m,['dnf install -y ansible-core']), check:m=>m._hasColl('ansible.posix')}
];
})();
