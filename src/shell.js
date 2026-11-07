/* =========================================================
   SIMULOVANÝ RHEL STROJ
   VFS + používatelia + služby + firewalld + SELinux + LVM + dnf
   ========================================================= */
(function(){
'use strict';

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad = (s,n,left)=>{ s=String(s); while(s.length<n) s = left ? s+' ' : ' '+s; return s; };
const z2 = n=>String(n).padStart(2,'0');
function lsDate(d){ return MON[d.getMonth()]+' '+pad(d.getDate(),2)+' '+z2(d.getHours())+':'+z2(d.getMinutes()); }
function human(n){
  if (n < 1024) return String(n);
  const u = ['K','M','G','T']; let i=-1;
  do { n/=1024; i++; } while(n>=1024 && i<u.length-1);
  return (n<10 ? (Math.ceil(n*10)/10).toFixed(1) : String(Math.ceil(n)))+u[i];
}
function permStr(t, m){
  const c = t==='d'?'d':t==='l'?'l':'-';
  const b = (v,i)=>{
    let r = (v&4?'r':'-')+(v&2?'w':'-');
    let x = v&1?'x':'-';
    if (i===0 && m&0o4000) x = v&1?'s':'S';
    if (i===1 && m&0o2000) x = v&1?'s':'S';
    if (i===2 && m&0o1000) x = v&1?'t':'T';
    return r+x;
  };
  return c+b((m>>6)&7,0)+b((m>>3)&7,1)+b(m&7,2);
}
function globToRe(g){
  let r='';
  for (const ch of g){
    if (ch==='*') r+='.*'; else if (ch==='?') r+='.';
    else r+=ch.replace(/[.+^${}()|[\]\\]/g,'\\$&');
  }
  return new RegExp('^'+r+'$');
}

/* ---------- default SELinux labels ---------- */
const FCTX_BASE = [
  ['/etc/pki(/.*)?','cert_t'],
  ['/etc/httpd/modules(/.*)?','httpd_modules_t'],
  ['/etc/httpd(/.*)?','httpd_config_t'],
  ['/var/log/journal(/.*)?','var_log_t'],
  ['/var/www(/.*)?','httpd_sys_content_t'],
  ['/home/[^/]+/\\.ssh(/.*)?','ssh_home_t'],
  ['/home(/.*)?','user_home_t'],
  ['/root(/.*)?','admin_home_t'],
  ['/etc/shadow','shadow_t'],
  ['/etc/ssh(/.*)?','etc_t'],
  ['/etc(/.*)?','etc_t'],
  ['/tmp(/.*)?','user_tmp_t'],
  ['/var/log(/.*)?','var_log_t'],
  ['/var/lib/mysql(/.*)?','mysqld_db_t'],
  ['/var(/.*)?','var_t'],
  ['/srv(/.*)?','var_t'],
  ['/opt(/.*)?','usr_t'],
  ['/usr/bin(/.*)?','bin_t'],
  ['/usr/sbin(/.*)?','bin_t'],
  ['/usr/lib/systemd/system(/.*)?','systemd_unit_file_t'],
  ['/usr(/.*)?','usr_t'],
  ['/boot(/.*)?','boot_t'],
  ['/dev(/.*)?','device_t'],
  ['/proc(/.*)?','proc_t'],
  ['/data(/.*)?','default_t'],
  ['/.*','default_t']
];

/* ---------- services ---------- */
const SVC_DEF = {
  sshd:{desc:'OpenSSH server daemon', pkg:'openssh-server', port:[['tcp',22]], proc:'sshd', unit:'/usr/lib/systemd/system/sshd.service'},
  firewalld:{desc:'firewalld - dynamic firewall daemon', pkg:'firewalld', proc:'firewalld', unit:'/usr/lib/systemd/system/firewalld.service'},
  chronyd:{desc:'NTP client/server', pkg:'chrony', port:[['udp',323,'127.0.0.1']], proc:'chronyd', unit:'/usr/lib/systemd/system/chronyd.service'},
  crond:{desc:'Command Scheduler', pkg:'cronie', proc:'crond', unit:'/usr/lib/systemd/system/crond.service'},
  NetworkManager:{desc:'Network Manager', pkg:'NetworkManager', proc:'NetworkManager', unit:'/usr/lib/systemd/system/NetworkManager.service'},
  rsyslog:{desc:'System Logging Service', pkg:'rsyslog', proc:'rsyslogd', unit:'/usr/lib/systemd/system/rsyslog.service'},
  auditd:{desc:'Security Auditing Service', pkg:'audit', proc:'auditd', unit:'/usr/lib/systemd/system/auditd.service'},
  httpd:{desc:'The Apache HTTP Server', pkg:'httpd', port:[['tcp',80]], proc:'httpd', unit:'/usr/lib/systemd/system/httpd.service'},
  nginx:{desc:'The nginx HTTP and reverse proxy server', pkg:'nginx', port:[['tcp',80]], proc:'nginx', unit:'/usr/lib/systemd/system/nginx.service'},
  mariadb:{desc:'MariaDB database server', pkg:'mariadb-server', port:[['tcp',3306]], proc:'mariadbd', unit:'/usr/lib/systemd/system/mariadb.service'},
  cockpit:{desc:'Cockpit Web Service', pkg:'cockpit', port:[['tcp',9090]], proc:'cockpit-ws', unit:'/usr/lib/systemd/system/cockpit.service', socket:true},
  'agent':{desc:'Monitoring agent (lokálna služba v /etc/systemd/system)', pkg:null, proc:'agent', unit:'/etc/systemd/system/agent.service'}
};

/* ---------- packages ---------- */
const PKG_DB = {
  'bash':{v:'5.2.26-6',s:'The GNU Bourne Again shell',repo:'baseos',cmds:['bash']},
  'coreutils':{v:'8.32-39',s:'A set of basic GNU tools commonly used in shell scripts',repo:'baseos',cmds:['ls','cp','mv','rm','cat','mkdir','chmod','chown','head','tail','sort','wc','cut','df','du','touch','ln','id','whoami','date','uname','echo','tee','uniq','pwd']},
  'grep':{v:'3.6-5',s:'Pattern matching utilities',repo:'baseos',cmds:['grep']},
  'findutils':{v:'4.8.0-7',s:'The GNU versions of find utilities (find and xargs)',repo:'baseos',cmds:['find']},
  'sed':{v:'4.8-9',s:'A GNU stream text editor',repo:'baseos',cmds:['sed']},
  'gawk':{v:'5.1.0-6',s:'The GNU version of the AWK text processing utility',repo:'baseos',cmds:['awk']},
  'tar':{v:'1.34-7',s:'GNU file archiving program',repo:'baseos',cmds:['tar']},
  'procps-ng':{v:'3.3.17-14',s:'System and process monitoring utilities',repo:'baseos',cmds:['ps','top','free','uptime','kill']},
  'util-linux':{v:'2.37.4-20',s:'Collection of basic system utilities',repo:'baseos',cmds:['lsblk','blkid','mount','umount','mkswap']},
  'xfsprogs':{v:'6.4.0-5',s:'Utilities for managing the XFS filesystem',repo:'baseos',cmds:['mkfs.xfs','xfs_growfs']},
  'e2fsprogs':{v:'1.46.5-5',s:'Utilities for managing ext2, ext3, and ext4 file systems',repo:'baseos',cmds:['mkfs.ext4','resize2fs']},
  'lvm2':{v:'2.03.24-2',s:'Userland logical volume management tools',repo:'baseos',cmds:['pvcreate','vgcreate','vgextend','lvcreate','lvextend','pvs','vgs','lvs']},
  'iproute':{v:'6.2.0-6',s:'Advanced IP routing and network device configuration tools',repo:'baseos',cmds:['ip','ss']},
  'iputils':{v:'20210202-10',s:'Network monitoring tools including ping',repo:'baseos',cmds:['ping']},
  'NetworkManager':{v:'1.48.10-2',s:'Network connection manager and user applications',repo:'baseos',cmds:['nmcli']},
  'firewalld':{v:'1.3.4-9',s:'A firewall daemon with D-Bus interface providing a dynamic firewall',repo:'baseos',cmds:['firewall-cmd']},
  'nftables':{v:'1.0.9-3',s:'Netfilter Tables userspace utillites',repo:'baseos',cmds:['nft']},
  'openssh-server':{v:'8.7p1-43',s:'An open source SSH server daemon',repo:'baseos',cmds:[]},
  'openssh-clients':{v:'8.7p1-43',s:'An open source SSH client applications',repo:'baseos',cmds:['ssh','scp','ssh-keygen','ssh-copy-id']},
  'chrony':{v:'4.5-3',s:'An NTP client/server',repo:'baseos',cmds:['chronyc']},
  'cronie':{v:'1.5.7-12',s:'Cron daemon for executing programs at set times',repo:'baseos',cmds:['crontab']},
  'rsyslog':{v:'8.2310.0-4',s:'Enhanced system logging and kernel message trapping daemon',repo:'appstream',cmds:[]},
  'audit':{v:'3.1.5-1',s:'User space tools for kernel auditing',repo:'baseos',cmds:['ausearch']},
  'systemd':{v:'252-46',s:'System and Service Manager',repo:'baseos',cmds:['systemctl','journalctl','hostnamectl','timedatectl']},
  'dnf':{v:'4.14.0-17',s:'Package manager',repo:'baseos',cmds:['dnf','yum']},
  'rpm':{v:'4.16.1.3-34',s:'The RPM package management system',repo:'baseos',cmds:['rpm']},
  'shadow-utils':{v:'4.9-10',s:'Utilities for managing accounts and shadow password files',repo:'baseos',cmds:['useradd','usermod','userdel','groupadd','chage']},
  'passwd':{v:'0.80-12',s:'An utility for setting or changing passwords using PAM',repo:'baseos',cmds:['passwd']},
  'sudo':{v:'1.9.5p2-10',s:'Allows restricted root access for specified users',repo:'baseos',cmds:['sudo','visudo']},
  'policycoreutils':{v:'3.6-2',s:'SELinux policy core utilities',repo:'baseos',cmds:['getenforce','setenforce','restorecon','sestatus','getsebool','setsebool']},
  'acl':{v:'2.3.1-4',s:'Access control list utilities',repo:'baseos',cmds:['getfacl','setfacl']},
  'vim-enhanced':{v:'8.2.2637-21',s:'A version of the VIM editor which includes recent enhancements',repo:'appstream',cmds:['vim']},
  'vim-minimal':{v:'8.2.2637-21',s:'A minimal version of the VIM editor',repo:'baseos',cmds:['vi']},
  'nano':{v:'5.6.1-6',s:'A small text editor',repo:'baseos',cmds:['nano']},
  'less':{v:'590-5',s:'A text file browser similar to more, but better',repo:'baseos',cmds:['less']},
  'man-db':{v:'2.9.3-7',s:'Tools for searching and reading man pages',repo:'baseos',cmds:['man']},
  'which':{v:'2.21-29',s:'Displays where a particular program in your path is located',repo:'baseos',cmds:['which']},
  'curl':{v:'7.76.1-31',s:'A utility for getting files from remote servers',repo:'baseos',cmds:['curl']},
  'rsync':{v:'3.2.5-3',s:'A program for synchronizing files over a network',repo:'baseos',cmds:['rsync']},
  'kernel':{v:'5.14.0-570.12.1',s:'The Linux kernel',repo:'baseos',cmds:[]},
  'redhat-release':{v:'9.6-0.1',s:'Red Hat Enterprise Linux release file',repo:'baseos',cmds:[]},
  'subscription-manager':{v:'1.29.42-1',s:'Tools and libraries for subscription and repository management',repo:'baseos',cmds:['subscription-manager']},
  'sos':{v:'4.9.0-1',s:'A set of tools to gather troubleshooting information from a system',repo:'baseos',cmds:['sos']},
  /* nenainštalované */
  'policycoreutils-python-utils':{v:'3.6-2',s:'SELinux policy core python utilities',repo:'appstream',cmds:['semanage','audit2allow']},
  'setroubleshoot-server':{v:'3.3.32-1',s:'SELinux troubleshoot server',repo:'appstream',cmds:['sealert']},
  'httpd':{v:'2.4.62-4',s:'Apache HTTP Server',repo:'appstream',cmds:['httpd','apachectl']},
  'nginx':{v:'1.20.1-22',s:'A high performance web server and reverse proxy server',repo:'appstream',cmds:['nginx']},
  'mariadb-server':{v:'10.5.27-1',s:'The MariaDB server and related files',repo:'appstream',cmds:['mysqld']},
  'tree':{v:'1.8.0-10',s:'File system tree viewer',repo:'baseos',cmds:['tree']},
  'bind-utils':{v:'9.16.23-29',s:'Utilities for querying DNS name servers',repo:'appstream',cmds:['dig','nslookup','host']},
  'net-tools':{v:'2.0-0.64',s:'Basic networking tools',repo:'baseos',cmds:['netstat','ifconfig']},
  'git':{v:'2.47.1-2',s:'Fast Version Control System',repo:'appstream',cmds:['git']},
  'wget':{v:'1.21.1-8',s:'A utility for retrieving files using the HTTP or FTP protocols',repo:'appstream',cmds:['wget']},
  'tmux':{v:'3.2a-5',s:'A terminal multiplexer',repo:'baseos',cmds:['tmux']},
  'cockpit':{v:'323-1',s:'Web Console for Linux servers',repo:'baseos',cmds:[]},
  'podman':{v:'5.4.0-12',s:'Manage Pods, Containers and Container Images',repo:'appstream',cmds:['podman']},
  'lsof':{v:'4.94.0-3',s:'A utility which lists open files on a Linux/UNIX system',repo:'baseos',cmds:['lsof']}
};
const PKG_INSTALLED_DEFAULT = ['bash','coreutils','grep','findutils','sed','gawk','tar','procps-ng','util-linux','xfsprogs','e2fsprogs','lvm2','iproute','iputils','NetworkManager','firewalld','nftables','openssh-server','openssh-clients','chrony','cronie','rsyslog','audit','systemd','dnf','rpm','shadow-utils','passwd','sudo','policycoreutils','acl','vim-enhanced','vim-minimal','nano','less','man-db','which','curl','rsync','kernel','redhat-release','subscription-manager','sos','cockpit'];

const FW_SERVICES = {ssh:'22/tcp',http:'80/tcp',https:'443/tcp',cockpit:'9090/tcp','dhcpv6-client':'546/udp',mysql:'3306/tcp',dns:'53/tcp 53/udp',ftp:'21/tcp',nfs:'2049/tcp',samba:'139/tcp 445/tcp',postgresql:'5432/tcp',ntp:'123/udp','http3':'443/udp',snmp:'161/udp',snmptrap:'162/udp',syslog:'514/udp'};
const FW_ZONES = ['block','dmz','drop','external','home','internal','nm-shared','public','trusted','work'];

/* ===================== MACHINE ===================== */
class Machine {
  constructor(ver){
    this.ver = ver || 9;
    this.reset();
  }
  reset(){
    const v10 = this.ver === 10;
    this.hostname = v10 ? 'rhel10-lab' : 'rhel9-lab';
    this.kernel = v10 ? '6.12.0-55.12.1.el10_0.x86_64' : '5.14.0-570.12.1.el9_6.x86_64';
    this.release = v10 ? 'Red Hat Enterprise Linux release 10.0 (Coughlan)' : 'Red Hat Enterprise Linux release 9.6 (Plow)';
    this.user = 'admin'; this.rootShell = false;
    this.cwd = '/home/admin';
    this.lastCode = 0;
    this.log = [];      // [{name,args,flags,user,line}]
    this.history = [];
    this.now = new Date();
    this.users = {
      root:{uid:0,gid:0,home:'/root',shell:'/bin/bash',gecos:'root',pw:true},
      admin:{uid:1000,gid:1000,home:'/home/admin',shell:'/bin/bash',gecos:'Admin',pw:true},
      apache:null
    };
    delete this.users.apache;
    this.sysusers = [['bin',1,1,'/bin','/sbin/nologin'],['daemon',2,2,'/sbin','/sbin/nologin'],['nobody',65534,65534,'/','/sbin/nologin'],['sshd',74,74,'/usr/share/empty.sshd','/sbin/nologin'],['chrony',992,987,'/var/lib/chrony','/sbin/nologin']];
    this.groups = { root:{gid:0,mem:[]}, wheel:{gid:10,mem:['admin']}, admin:{gid:1000,mem:[]}, adm:{gid:4,mem:[]} };
    this.pkgs = new Set(PKG_INSTALLED_DEFAULT);
    this.dnfHist = [{id:1, cmd:'(anaconda install)', date:'2026-10-02 09:14', act:'Install', n:412}];
    this.svc = {};
    for (const [k,d] of Object.entries(SVC_DEF)){
      const inst = !d.pkg || this.pkgs.has(d.pkg);
      this.svc[k] = {installed:inst, active: inst && ['sshd','firewalld','chronyd','crond','NetworkManager','rsyslog','auditd','agent'].includes(k), enabled: inst && ['sshd','firewalld','chronyd','crond','NetworkManager','rsyslog','auditd'].includes(k), failed:false, since:new Date(this.now - 3600e3*26)};
    }
    this.svc.agent.active = false; this.svc.agent.failed = true;
    const zone = ()=>({services:[],ports:[],rich:[],sources:[],interfaces:[],masq:false});
    this.fw = {def:'public', runtime:{}, perm:{}};
    for (const z of FW_ZONES){ this.fw.runtime[z]=zone(); this.fw.perm[z]=zone(); }
    for (const k of ['runtime','perm']){
      this.fw[k].public.services = ['cockpit','dhcpv6-client','ssh'];
      this.fw[k].public.interfaces = ['ens192'];
      this.fw[k].trusted.services = [];
      this.fw[k].home.services = ['cockpit','dhcpv6-client','mdns','samba-client','ssh'];
      this.fw[k].internal.services = ['cockpit','dhcpv6-client','mdns','samba-client','ssh'];
      this.fw[k].work.services = ['cockpit','dhcpv6-client','ssh'];
      this.fw[k].dmz.services = ['ssh'];
      this.fw[k].external.services = ['ssh']; this.fw[k].external.masq = true;
    }
    this.se = { mode:'Enforcing', cfg:'enforcing', bools:{httpd_can_network_connect:false, httpd_enable_homedirs:false, httpd_can_network_connect_db:false, ftpd_full_access:false, samba_enable_home_dirs:false, ssh_sysadm_login:false}, ports:{http_port_t:['tcp 80, 81, 443, 488, 8008, 8009, 8443, 9000'], ssh_port_t:['tcp 22'], mysqld_port_t:['tcp 1186, 3306, 63132-63164']}, extraPorts:[], fctx:[] };
    this.net = {ip:'10.0.20.31/24', gw:'10.0.20.1', dns:'10.0.20.2', ifc:'ens192', mac:'00:50:56:a1:3c:7e'};
    this.lvm = {
      pvs:{'/dev/sda2':{vg:'rhel',size:49}},
      vgs:{rhel:{size:49}},
      lvs:{'rhel/root':{size:30,fs:'xfs'},'rhel/swap':{size:4,fs:'swap'}},
    };
    this.disks = {'/dev/sda':{size:50,parts:{'/dev/sda1':{size:1,fs:'xfs',uuid:'5f0c2a17-9d1e-4f6b-a7c3-2e8b1d6f9a40'},'/dev/sda2':{size:49,fs:'LVM2_member'}}},'/dev/sdb':{size:10,parts:{},fs:null}};
    this.fsInfo = {'/dev/mapper/rhel-root':{fs:'xfs',uuid:'c3b7e2f1-4a5d-4e8c-9b1f-7d2a6e3c8f51'}, '/dev/mapper/rhel-swap':{fs:'swap',uuid:'91d4a6b2-0c7e-4f3a-8d5b-2e6f1a9c7b03'}};
    this.mounts = [
      {dev:'/dev/mapper/rhel-root',dir:'/',fs:'xfs',size:30,used:6.1},
      {dev:'/dev/sda1',dir:'/boot',fs:'xfs',size:0.96,used:0.29},
      {dev:'tmpfs',dir:'/run',fs:'tmpfs',size:0.76,used:0.01},
      {dev:'devtmpfs',dir:'/dev',fs:'devtmpfs',size:0.004,used:0}
    ];
    this.procs = [];
    this.jobs = [];
    this.crontabs = {};
    this.buildFS();
  }

  /* ---------- filesystem ---------- */
  mk(t, m, u, g, c){ return {t, m, u:u||'root', g:g||(u||'root'), c: t==='d' ? (c||{}) : (c||''), mt:new Date(this.now - Math.random()*86400e3*20), ctx:null}; }
  buildFS(){
    const R = this.root = this.mk('d',0o555);
    const v10 = this.ver===10;
    const D = (p,m,u,g)=>this._mkPath(p,'d',m||0o755,u,g);
    const F = (p,c,m,u,g)=>this._mkPath(p,'f',m||0o644,u,g,c);
    const L = (p,tgt)=>{ const n=this._mkPath(p,'l',0o777,'root','root'); n.tgt=tgt; };
    ['/usr','/usr/bin','/usr/sbin','/usr/lib','/usr/lib64','/usr/lib/systemd','/usr/lib/systemd/system','/usr/share','/usr/share/doc','/usr/local','/usr/local/bin','/etc','/etc/ssh','/etc/sysconfig','/etc/selinux','/etc/firewalld','/etc/firewalld/zones','/etc/firewalld/services','/etc/NetworkManager','/etc/NetworkManager/system-connections','/etc/yum.repos.d','/etc/dnf','/etc/systemd','/etc/systemd/system','/etc/systemd/system/multi-user.target.wants','/etc/sudoers.d','/etc/cron.d','/etc/cron.daily','/etc/logrotate.d','/etc/security','/etc/profile.d','/var','/var/log','/var/log/audit','/var/lib','/var/lib/rpm','/var/cache','/var/cache/dnf','/var/spool','/var/spool/cron','/var/tmp','/opt','/opt/monitoring','/opt/monitoring/bin','/srv','/mnt','/media','/boot','/boot/grub2','/boot/loader','/boot/loader/entries','/dev','/proc','/sys','/run','/home'].forEach(p=>D(p));
    D('/tmp',0o1777); D('/root',0o550); D('/var/log/audit',0o700); D('/etc/sudoers.d',0o750); D('/var/spool/cron',0o700);
    D('/home/admin',0o700,'admin','admin');
    ['skripty','logy','data','.ssh'].forEach(x=>D('/home/admin/'+x, x==='.ssh'?0o700:0o755,'admin','admin'));
    L('/bin','usr/bin'); L('/sbin','usr/sbin'); L('/lib','usr/lib'); L('/lib64','usr/lib64');
    const allCmds = new Set();
    for (const p of Object.values(PKG_DB)) p.cmds.forEach(c=>allCmds.add(c));
    for (const [n,p] of Object.entries(PKG_DB)){
      if (!this.pkgs.has(n)) continue;
      for (const c of p.cmds){
        const sb = ['useradd','usermod','userdel','groupadd','pvcreate','vgcreate','vgextend','lvcreate','lvextend','pvs','vgs','lvs','mkfs.xfs','mkfs.ext4','xfs_growfs','resize2fs','setenforce','getenforce','restorecon','setsebool','getsebool','sestatus','semanage','visudo','blkid','mkswap','nft','ifconfig','sos'].includes(c);
        F((sb?'/usr/sbin/':'/usr/bin/')+c, '\x7fELF binárny súbor', 0o755);
      }
    }
    F('/etc/hostname', this.hostname+'\n');
    F('/etc/redhat-release', this.release+'\n');
    F('/etc/os-release', `NAME="Red Hat Enterprise Linux"\nVERSION="${v10?'10.0 (Coughlan)':'9.6 (Plow)'}"\nID="rhel"\nID_LIKE="centos fedora"\nVERSION_ID="${v10?'10.0':'9.6'}"\nPLATFORM_ID="platform:el${this.ver}"\nPRETTY_NAME="Red Hat Enterprise Linux ${v10?'10.0 (Coughlan)':'9.6 (Plow)'}"\nANSI_COLOR="0;31"\nCPE_NAME="cpe:/o:redhat:enterprise_linux:${this.ver}::baseos"\nHOME_URL="https://www.redhat.com/"\n`);
    F('/etc/hosts','127.0.0.1   localhost localhost.localdomain localhost4 localhost4.localdomain4\n::1         localhost localhost.localdomain localhost6 localhost6.localdomain6\n10.0.20.31  '+this.hostname+'\n10.0.20.40  db01.firma.local db01\n');
    F('/etc/resolv.conf','# Generated by NetworkManager\nsearch firma.local\nnameserver 10.0.20.2\n');
    F('/etc/fstab',
`#
# /etc/fstab
# Created by anaconda
#
# Accessible filesystems, by reference, are maintained under '/dev/disk/'.
# See man pages fstab(5), findfs(8), mount(8) and/or blkid(8) for more info.
#
/dev/mapper/rhel-root   /                       xfs     defaults        0 0
UUID=5f0c2a17-9d1e-4f6b-a7c3-2e8b1d6f9a40 /boot                   xfs     defaults        0 0
/dev/mapper/rhel-swap   none                    swap    defaults        0 0
`);
    F('/etc/sudoers',
`## Sudoers allows particular users to run various commands as
## the root user, without needing the root password.
##
## Uprav VŽDY cez: visudo   (alebo súbor v /etc/sudoers.d/)
Defaults   !visiblepw
Defaults    always_set_home
Defaults    secure_path = /sbin:/bin:/usr/sbin:/usr/bin

## Allow root to run any commands anywhere
root    ALL=(ALL)       ALL

## Allows people in group wheel to run all commands
%wheel  ALL=(ALL)       ALL

## Same thing without a password
# %wheel        ALL=(ALL)       NOPASSWD: ALL

#includedir /etc/sudoers.d
`,0o440);
    F('/etc/login.defs','MAIL_DIR        /var/spool/mail\nPASS_MAX_DAYS   99999\nPASS_MIN_DAYS   0\nPASS_WARN_AGE   7\nUID_MIN                  1000\nUID_MAX                 60000\nGID_MIN                  1000\nCREATE_HOME     yes\nUMASK           022\nUSERGROUPS_ENAB yes\nENCRYPT_METHOD SHA512\n');
    F('/etc/ssh/sshd_config',
`#	$OpenBSD: sshd_config,v 1.104 2021/07/02 05:11:21 dtucker Exp $
# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

# To modify the system-wide sshd configuration, create a  *.conf  file under
#  /etc/ssh/sshd_config.d/  which will be automatically included below
Include /etc/ssh/sshd_config.d/*.conf

#Port 22
#ListenAddress 0.0.0.0
#PermitRootLogin prohibit-password
#PubkeyAuthentication yes
#PasswordAuthentication yes
#MaxAuthTries 6
#X11Forwarding no
Subsystem	sftp	/usr/libexec/openssh/sftp-server
`,0o600);
    D('/etc/ssh/sshd_config.d');
    F('/etc/ssh/sshd_config.d/50-redhat.conf','# Red Hat defaults\nSyslogFacility AUTHPRIV\nChallengeResponseAuthentication no\nGSSAPIAuthentication yes\nUsePAM yes\nX11Forwarding yes\n',0o600);
    F('/etc/selinux/config','# This file controls the state of SELinux on the system.\n# SELINUX= can take one of these three values:\n#     enforcing - SELinux security policy is enforced.\n#     permissive - SELinux prints warnings instead of enforcing.\n#     disabled - No SELinux policy is loaded.\nSELINUX=enforcing\n# SELINUXTYPE= can take one of these values:\n#     targeted - Targeted processes are protected,\n#     mls - Multi Level Security protection.\nSELINUXTYPE=targeted\n');
    F('/etc/firewalld/firewalld.conf','# firewalld config file\nDefaultZone=public\nCleanupOnExit=yes\nFirewallBackend=nftables\nLogDenied=off\n');
    F('/etc/NetworkManager/system-connections/ens192.nmconnection',`[connection]\nid=ens192\nuuid=0b6f2c94-3d1a-4e7c-8f25-a9c1d7e4b308\ntype=ethernet\ninterface-name=ens192\n\n[ipv4]\naddress1=10.0.20.31/24,10.0.20.1\ndns=10.0.20.2;\nmethod=manual\n\n[ipv6]\nmethod=auto\n`,0o600);
    if (!v10){ D('/etc/sysconfig/network-scripts'); F('/etc/sysconfig/network-scripts/readme-ifcfg-rh.txt','NetworkManager stores new network profiles in keyfile format in the\n/etc/NetworkManager/system-connections/ directory.\n\nPreviously, NetworkManager stored network profiles in ifcfg format\nin this directory (/etc/sysconfig/network-scripts/). However, the ifcfg\nformat is deprecated.\n'); }
    F('/etc/yum.repos.d/redhat.repo',`[rhel-${this.ver}-for-x86_64-baseos-rpms]\nname = Red Hat Enterprise Linux ${this.ver} for x86_64 - BaseOS (RPMs)\nbaseurl = https://cdn.redhat.com/content/dist/rhel${this.ver}/$releasever/x86_64/baseos/os\nenabled = 1\ngpgcheck = 1\n\n[rhel-${this.ver}-for-x86_64-appstream-rpms]\nname = Red Hat Enterprise Linux ${this.ver} for x86_64 - AppStream (RPMs)\nbaseurl = https://cdn.redhat.com/content/dist/rhel${this.ver}/$releasever/x86_64/appstream/os\nenabled = 1\ngpgcheck = 1\n`);
    F('/etc/dnf/dnf.conf','[main]\ngpgcheck=1\ninstallonly_limit=3\nclean_requirements_on_remove=True\nbest=True\nskip_if_unavailable=False\n');
    F('/etc/chrony.conf','# Use public servers from the pool.ntp.org project.\npool 2.rhel.pool.ntp.org iburst\nsourcedir /run/chrony-dhcp\ndriftfile /var/lib/chrony/drift\nmakestep 1.0 3\nrtcsync\nkeyfile /etc/chrony.keys\nntsdumpdir /var/lib/chrony\nleapsectz right/UTC\nlogdir /var/log/chrony\n');
    F('/etc/crontab','SHELL=/bin/bash\nPATH=/sbin:/bin:/usr/sbin:/usr/bin\nMAILTO=root\n\n# Example of job definition:\n# .---------------- minute (0 - 59)\n# |  .------------- hour (0 - 23)\n# |  |  .---------- day of month (1 - 31)\n# |  |  |  .------- month (1 - 12) OR jan,feb,mar,apr ...\n# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7) OR sun,mon,tue,wed,thu,fri,sat\n# |  |  |  |  |\n# *  *  *  *  * user-name  command to be executed\n');
    F('/etc/cron.d/0hourly','# Run the hourly jobs\nSHELL=/bin/bash\nPATH=/sbin:/bin:/usr/sbin:/usr/bin\nMAILTO=root\n01 * * * * root run-parts /etc/cron.hourly\n');
    F('/etc/logrotate.conf','# rotate log files weekly\nweekly\n# keep 4 weeks worth of backlogs\nrotate 4\n# create new (empty) log files after rotating old ones\ncreate\n# use date as a suffix of the rotated file\ndateext\ninclude /etc/logrotate.d\n');
    F('/etc/security/limits.conf','# /etc/security/limits.conf\n#<domain>      <type>  <item>         <value>\n#*               soft    core            0\n#@student        hard    nproc           20\n');
    F('/etc/motd','');
    F('/etc/environment','');
    F('/etc/profile','# /etc/profile\n# System wide environment and startup programs, for login setup\n# It\'s NOT a good idea to change this file unless you know what you\n# are doing. It\'s much better to create a custom.sh shell script in\n# /etc/profile.d/ to make custom changes to your environment.\n');
    F('/etc/bashrc','# /etc/bashrc\n# System wide functions and aliases\n');
    F('/etc/systemd/system/agent.service','[Unit]\nDescription=Monitoring agent (lokálna služba v /etc/systemd/system)\nAfter=network-online.target\n\n[Service]\nType=simple\nExecStart=/opt/monitoring/bin/agent --config /opt/monitoring/agent.conf\nRestart=on-failure\nUser=root\n\n[Install]\nWantedBy=multi-user.target\n');
    this._refreshAccountFiles();
    for (const [k,d] of Object.entries(SVC_DEF)){
      if (!d.unit || k==='agent') continue;
      if (this.svc[k].installed) F(d.unit, this._unitText(k));
    }
    F('/opt/monitoring/agent.conf','# Monitoring agent\nserver = mon01.firma.local\nport = 8443\ninterval = 60\nlog = /var/log/agent.log\n');
    F('/opt/monitoring/bin/agent','#!/bin/bash\n# agent binárka (simulácia)\n',0o644);
    F('/opt/monitoring/README','Agent tretej strany. Inštalovaný mimo RPM, preto sedí v /opt.\nKonfigurácia: /opt/monitoring/agent.conf\nSlužba: /etc/systemd/system/agent.service\n');
    const t = this.now;
    const ts = (h,m)=>`${MON[t.getMonth()]} ${pad(t.getDate(),2)} ${z2(h)}:${z2(m)}:${z2((h*7+m)%60)}`;
    F('/var/log/messages',
[ts(8,1)+' '+this.hostname+' systemd[1]: Started Command Scheduler.',
 ts(8,1)+' '+this.hostname+' chronyd[812]: Selected source 185.125.190.56 (2.rhel.pool.ntp.org)',
 ts(8,2)+' '+this.hostname+' NetworkManager[903]: <info>  [1730445722.1205] device (ens192): state change: activated',
 ts(9,12)+' '+this.hostname+' systemd[1]: Starting dnf makecache...',
 ts(9,13)+' '+this.hostname+' systemd[1]: dnf-makecache.service: Deactivated successfully.',
 ts(9,44)+' '+this.hostname+' systemd[1]: agent.service: Main process exited, code=exited, status=203/EXEC',
 ts(9,44)+' '+this.hostname+' systemd[1]: agent.service: Failed with result \'exit-code\'.',
 ts(10,5)+' '+this.hostname+' kernel: XFS (dm-0): Ending clean mount',
 ts(10,30)+' '+this.hostname+' systemd-logind[790]: New session 4 of user admin.'].join('\n')+'\n',0o600);
    F('/var/log/secure',
[ts(7,55)+' '+this.hostname+' sshd[1201]: Failed password for invalid user test from 203.0.113.77 port 51234 ssh2',
 ts(7,55)+' '+this.hostname+' sshd[1203]: Failed password for root from 203.0.113.77 port 51240 ssh2',
 ts(7,56)+' '+this.hostname+' sshd[1205]: Failed password for root from 203.0.113.77 port 51242 ssh2',
 ts(10,29)+' '+this.hostname+' sshd[2210]: Accepted publickey for admin from 10.0.20.15 port 53122 ssh2: ED25519 SHA256:k3J9...',
 ts(10,30)+' '+this.hostname+' sudo[2290]:   admin : TTY=pts/0 ; PWD=/home/admin ; USER=root ; COMMAND=/usr/bin/dnf check-update'].join('\n')+'\n',0o600);
    F('/var/log/audit/audit.log','type=AVC msg=audit(1730451200.120:412): avc:  denied  { read } for  pid=3021 comm="httpd" name="index.html" dev="dm-0" ino=1048601 scontext=system_u:system_r:httpd_t:s0 tcontext=unconfined_u:object_r:user_home_t:s0 tclass=file permissive=0\n',0o600);
    F('/var/log/dnf.log','2026-10-02T09:14:01+0100 INFO --- logging initialized ---\n2026-11-01T10:30:12+0100 DDEBUG Command: dnf check-update\n',0o644);
    F('/var/log/cron',ts(10,1)+' '+this.hostname+' CROND[2101]: (root) CMD (run-parts /etc/cron.hourly)\n',0o600);
    F('/var/log/boot.log','[  OK  ] Started Network Manager.\n[  OK  ] Reached target Network.\n[  OK  ] Started OpenSSH server daemon.\n[FAILED] Failed to start Monitoring agent.\n',0o600);
    F('/var/lib/rpm/rpmdb.sqlite','SQLite format 3',0o644);
    F('/root/anaconda-ks.cfg','#version=RHEL'+this.ver+'\n# Use graphical install\ngraphical\nlang sk_SK.UTF-8\nkeyboard --vckeymap=sk-qwertz\ntimezone Europe/Bratislava --utc\n',0o600);
    F('/home/admin/.bashrc','# .bashrc\n\n# Source global definitions\nif [ -f /etc/bashrc ]; then\n\t. /etc/bashrc\nfi\n\n# User specific aliases and functions\nalias ll=\'ls -l --color=auto\'\n',0o644,'admin','admin');
    F('/home/admin/.bash_profile','# .bash_profile\nif [ -f ~/.bashrc ]; then\n\t. ~/.bashrc\nfi\n',0o644,'admin','admin');
    F('/home/admin/poznamky.txt','Úlohy na tento týždeň:\n- skontrolovať zálohy na db01\n- otvoriť port pre monitoring (8443/tcp)\n- opraviť agent.service\n- pridať používateľa jana do skupiny wheel\n',0o644,'admin','admin');
    F('/home/admin/logy/app.log',
`2026-11-01 08:00:01 INFO  [main] Aplikácia štartuje, verzia 2.4.1
2026-11-01 08:00:02 INFO  [db] Pripojené k db01.firma.local:3306
2026-11-01 08:15:44 WARN  [cache] Cache je zaplnená na 85 %
2026-11-01 08:31:10 ERROR [db] Timeout pri dotaze: SELECT * FROM objednavky
2026-11-01 08:31:11 INFO  [db] Opakujem pripojenie (1/3)
2026-11-01 08:31:12 INFO  [db] Pripojené k db01.firma.local:3306
2026-11-01 09:02:37 WARN  [auth] 5 neúspešných prihlásení pre používateľa jana
2026-11-01 09:40:00 ERROR [api] HTTP 500 na /api/v1/sklad
2026-11-01 09:40:01 error [api] stack trace uložený do /var/log/app/trace-0940.txt
2026-11-01 10:12:19 INFO  [main] Health check OK
2026-11-01 10:45:03 ERROR [disk] Málo miesta na /var (91 %)
`,0o644,'admin','admin');
    F('/home/admin/data/servery.csv','meno,ip,os,rola\nweb01,10.0.20.31,RHEL 9,web\nweb02,10.0.20.32,RHEL 9,web\ndb01,10.0.20.40,RHEL 8,databaza\nmon01,10.0.20.50,RHEL 10,monitoring\nbackup01,10.0.20.60,RHEL 9,zaloha\n',0o644,'admin','admin');
    F('/home/admin/data/prihlasenia.txt','jana\npeter\njana\nadmin\nmarek\njana\npeter\nadmin\njana\n',0o644,'admin','admin');
    F('/home/admin/skripty/zaloha.sh','#!/bin/bash\n# Jednoduchá záloha /etc\nDATUM=$(date +%F)\ntar -czf /tmp/etc-$DATUM.tar.gz /etc\necho "Záloha hotová: /tmp/etc-$DATUM.tar.gz"\n',0o644,'admin','admin');
    F('/home/admin/index.html','<h1>Intranet web01</h1>\n<p>Stránka bežiaca na RHEL.</p>\n',0o644,'admin','admin');
    F('/proc/cpuinfo','processor\t: 0\nvendor_id\t: GenuineIntel\nmodel name\t: Intel(R) Xeon(R) Gold 6338 CPU @ 2.00GHz\ncpu cores\t: 2\n\nprocessor\t: 1\nvendor_id\t: GenuineIntel\nmodel name\t: Intel(R) Xeon(R) Gold 6338 CPU @ 2.00GHz\ncpu cores\t: 2\n',0o444);
    F('/proc/meminfo','MemTotal:        3845120 kB\nMemFree:          612344 kB\nMemAvailable:    2389012 kB\nBuffers:            4120 kB\nCached:          1720404 kB\nSwapTotal:       4194300 kB\nSwapFree:        4194300 kB\n',0o444);
    F('/proc/loadavg','0.18 0.24 0.21 1/312 3388\n',0o444);
    F('/proc/version','Linux version '+this.kernel+' (mockbuild@x86-vm-07.build.eng.bos.redhat.com) (gcc (GCC) '+(v10?'14.2.1':'11.5.0')+')\n',0o444);
    F('/proc/cmdline','BOOT_IMAGE=(hd0,msdos1)/vmlinuz-'+this.kernel+' root=/dev/mapper/rhel-root ro crashkernel=1G-4G:192M,4G-64G:256M resume=/dev/mapper/rhel-swap rd.lvm.lv=rhel/root rd.lvm.lv=rhel/swap\n',0o444);
    F('/dev/null','',0o666); F('/dev/sda','',0o660,'root','disk'); F('/dev/sda1','',0o660,'root','disk'); F('/dev/sda2','',0o660,'root','disk'); F('/dev/sdb','',0o660,'root','disk');
    D('/dev/mapper'); F('/dev/mapper/rhel-root',''); F('/dev/mapper/rhel-swap','');
    F('/boot/vmlinuz-'+this.kernel,'',0o755); F('/boot/initramfs-'+this.kernel+'.img','',0o600);
    F('/boot/grub2/grub.cfg','# DO NOT EDIT THIS FILE\n# It is automatically generated by grub2-mkconfig\n',0o600);
    F('/boot/loader/entries/'+(v10?'b2f0':'7c1e')+'-'+this.kernel+'.conf','title Red Hat Enterprise Linux ('+this.kernel+')\nversion '+this.kernel+'\nlinux /vmlinuz-'+this.kernel+'\ninitrd /initramfs-'+this.kernel+'.img\noptions root=/dev/mapper/rhel-root ro\n');
    F('/run/motd','');
    this._relabelAll(this.root,'');
  }
  _unitText(k){
    const d = SVC_DEF[k];
    const bin = {sshd:'/usr/sbin/sshd -D $OPTIONS',firewalld:'/usr/sbin/firewalld --nofork --nopid $FIREWALLD_ARGS',chronyd:'/usr/sbin/chronyd $OPTIONS',crond:'/usr/sbin/crond -n $CRONDARGS',NetworkManager:'/usr/sbin/NetworkManager --no-daemon',rsyslog:'/usr/sbin/rsyslogd -n $SYSLOGD_OPTIONS',auditd:'/sbin/auditd',httpd:'/usr/sbin/httpd $OPTIONS -DFOREGROUND',nginx:'/usr/sbin/nginx',mariadb:'/usr/libexec/mariadbd --basedir=/usr',cockpit:'/usr/libexec/cockpit-tls'}[k]||'/usr/bin/'+k;
    return `[Unit]\nDescription=${d.desc}\nAfter=network.target\n\n[Service]\nType=notify\nExecStart=${bin}\nExecReload=/bin/kill -HUP $MAINPID\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n`;
  }
  _refreshAccountFiles(){
    const pw = ['root:x:0:0:root:/root:/bin/bash'];
    this.sysusers.forEach(([n,u,g,h,s])=>pw.push(`${n}:x:${u}:${g}:${n}:${h}:${s}`));
    for (const [n,u] of Object.entries(this.users)) if (n!=='root') pw.push(`${n}:x:${u.uid}:${u.gid}:${u.gecos||''}:${u.home}:${u.shell}`);
    const sh = Object.entries(this.users).map(([n,u])=>`${n}:${u.pw?'$6$rounds=100000$Xq3e....$Lk2...':'!!'}:20028:0:${u.maxdays||99999}:7:::`);
    const gr = Object.entries(this.groups).map(([n,g])=>`${n}:x:${g.gid}:${g.mem.join(',')}`);
    const set = (p,c,m)=>{ let n = this._lookup(p); if (!n) n = this._mkPath(p,'f',m,'root','root',c); else n.c = c; n.mt = new Date(); };
    set('/etc/passwd', pw.join('\n')+'\n', 0o644);
    set('/etc/shadow', sh.join('\n')+'\n', 0o000);
    set('/etc/group', gr.join('\n')+'\n', 0o644);
  }
  _mkPath(path, t, m, u, g, c){
    const parts = path.split('/').filter(Boolean);
    let cur = this.root;
    for (let i=0;i<parts.length-1;i++){
      if (!cur.c[parts[i]]) cur.c[parts[i]] = this.mk('d',0o755);
      cur = cur.c[parts[i]];
    }
    const n = this.mk(t,m,u,g,c);
    cur.c[parts[parts.length-1]] = n;
    return n;
  }
  _relabelAll(node, path){
    node.ctx = this.defaultCtx(path||'/');
    if (node.t==='d') for (const [k,ch] of Object.entries(node.c)) this._relabelAll(ch, (path==='/'?'':path)+'/'+k);
  }
  defaultCtx(path){
    for (const [re,t] of this.se.fctx) if (new RegExp('^'+re+'$').test(path)) return t;
    for (const [re,t] of FCTX_BASE) if (new RegExp('^'+re+'$').test(path)) return t;
    return 'default_t';
  }
  ctxFull(n, path){
    const u = (path||'').startsWith('/home') || (path||'').startsWith('/tmp') ? 'unconfined_u' : 'system_u';
    return `${u}:object_r:${n.ctx||'default_t'}:s0`;
  }
  get home(){ return this.user==='root' ? '/root' : (this.users[this.user]||{}).home || '/'; }
  norm(p){
    if (p==null || p==='') return this.cwd;
    if (p==='~' || p.startsWith('~/')) p = this.home + p.slice(1);
    else if (/^~[a-z]/.test(p)){ const nm = p.slice(1).split('/')[0]; const u = this.users[nm]; if (u) p = u.home + p.slice(1+nm.length); }
    if (!p.startsWith('/')) p = this.cwd + '/' + p;
    const out = [];
    for (const s of p.split('/')){
      if (!s || s==='.') continue;
      if (s==='..') out.pop(); else out.push(s);
    }
    return '/' + out.join('/');
  }
  _lookup(abs, follow=true, depth=0){
    if (depth>10) return null;
    const parts = abs.split('/').filter(Boolean);
    let cur = this.root, curPath = '';
    for (let i=0;i<parts.length;i++){
      if (cur.t!=='d') return null;
      let nx = cur.c[parts[i]];
      if (!nx) return null;
      curPath += '/'+parts[i];
      if (nx.t==='l' && (follow || i<parts.length-1)){
        const tgt = nx.tgt.startsWith('/') ? nx.tgt : (curPath.slice(0,curPath.lastIndexOf('/'))||'') + '/' + nx.tgt;
        nx = this._lookup(this.norm(tgt), true, depth+1);
        if (!nx) return null;
      }
      cur = nx;
    }
    return cur;
  }
  node(p, follow=true){ return this._lookup(this.norm(p), follow); }
  parentOf(abs){ const i = abs.lastIndexOf('/'); return [abs.slice(0,i)||'/', abs.slice(i+1)]; }
  inGroup(g){ const gr = this.groups[g]; if (!gr) return false; const u = this.users[this.user]; return (u && Object.entries(this.groups).find(([n,x])=>x.gid===u.gid)?.[0]===g) || gr.mem.includes(this.user); }
  can(n, bit){
    if (this.user==='root') return bit===1 ? (n.t==='d' || (n.m & 0o111)!==0) : true;
    let sh = 0;
    if (n.u===this.user) sh = 6; else if (this.inGroup(n.g)) sh = 3;
    if (n.acl){ const a = n.acl.find(x=>x.k==='u' && x.n===this.user); if (a) return (a.p & bit)!==0; }
    return ((n.m >> sh) & bit) !== 0;
  }
  /* public helpers for task checks */
  exists(p){ return !!this.node(p); }
  isDir(p){ const n=this.node(p); return !!n && n.t==='d'; }
  isFile(p){ const n=this.node(p); return !!n && n.t==='f'; }
  read(p){ const n=this.node(p); return n && n.t==='f' ? n.c : null; }
  ran(name, pred){ return this.log.some(e=>e.name===name && (!pred || pred(e))); }
  ranOk(name, pred){ return this.log.some(e=>e.name===name && e.code===0 && (!pred || pred(e))); }

  /* ===================== PARSER ===================== */
  run(line){
    line = line.replace(/\s+$/,'');
    if (!line.trim()) return {o:'',e:''};
    if (!line.startsWith(' ')) this.history.push(line);
    if (/(^|\s)!!(\s|$)/.test(line) && !line.trim().startsWith('!!')){
      const prev = this.history[this.history.length-2];
      if (!prev) return {o:'',e:'-bash: !!: event not found\n'};
      const ex = line.replace(/(^|\s)!!(?=\s|$)/, '$1'+prev);
      this.history[this.history.length-1] = ex;
      const r = this.run(ex); this.history.pop();
      return {o: ex+'\n'+(r.o||''), e:r.e};
    }
    if (line.trim().startsWith('!')){
      const k = line.trim().slice(1);
      let src = null;
      if (k==='!') src = this.history[this.history.length-2];
      else if (/^\d+$/.test(k)) src = this.history[+k-1];
      else src = [...this.history].slice(0,-1).reverse().find(h=>h.startsWith(k));
      if (!src) return {o:'',e:`-bash: !${k}: event not found`};
      this.history[this.history.length-1] = src;
      const r = this.run(src); this.history.pop();
      return {o: src+'\n'+r.o, e:r.e};
    }
    if (/^\s*(for|if|while|until)\s/.test(line) && this._runScript){ const r = this._runScript(line, this.posArgs||[], '-bash'); return {o:r.o, e:r.e}; }
    let o='', e='';
    const chains = this._splitChain(line);
    let skip = false;
    for (const {cmd, op} of chains){
      if (!skip){
        const r = this._pipeline(cmd);
        o += r.o; e += r.e;
        this.lastCode = r.code||0;
      }
      if (op==='&&') skip = this.lastCode!==0;
      else if (op==='||') skip = this.lastCode===0;
      else skip = false;
    }
    return {o, e};
  }
  _splitChain(line){
    const out = []; let cur=''; let q=null; let dp=0;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (q){ cur+=ch; if (ch===q) q=null; continue; }
      if (ch==='"'||ch==="'"){ q=ch; cur+=ch; continue; }
      if (ch==='$' && line[i+1]==='('){ dp++; cur+=ch; continue; }
      if (ch===')' && dp>0){ dp--; cur+=ch; continue; }
      if (dp>0){ cur+=ch; continue; }
      if (line.startsWith('[[',i) && /(^|\s)$/.test(cur)){ const e = line.indexOf(']]', i+2); if (e>0){ cur+=line.slice(i,e+2); i=e+1; continue; } }
      if (line.startsWith('((',i) && /(^|\s)$/.test(cur)){ const e = line.indexOf('))', i+2); if (e>0){ cur+=line.slice(i,e+2); i=e+1; continue; } }
      if (ch==='\\' && i+1<line.length){ cur+=ch+line[i+1]; i++; continue; }
      if (ch===';'){ out.push({cmd:cur, op:';'}); cur=''; continue; }
      if (ch==='&' && line[i+1]==='&'){ out.push({cmd:cur, op:'&&'}); cur=''; i++; continue; }
      if (ch==='|' && line[i+1]==='|'){ out.push({cmd:cur, op:'||'}); cur=''; i++; continue; }
      cur+=ch;
    }
    if (cur.trim()) out.push({cmd:cur, op:';'});
    return out.filter(x=>x.cmd.trim());
  }
  _splitPipe(s){
    const out=[]; let cur=''; let q=null; let dp=0;
    for (let i=0;i<s.length;i++){
      const ch = s[i];
      if (q){ cur+=ch; if (ch===q) q=null; continue; }
      if (ch==='"'||ch==="'"){ q=ch; cur+=ch; continue; }
      if (ch==='$' && s[i+1]==='('){ dp++; cur+=ch; continue; }
      if (ch===')' && dp>0){ dp--; cur+=ch; continue; }
      if (dp>0){ cur+=ch; continue; }
      if (s.startsWith('[[',i) && /(^|\s)$/.test(cur)){ const e = s.indexOf(']]', i+2); if (e>0){ cur+=s.slice(i,e+2); i=e+1; continue; } }
      if (s.startsWith('((',i) && /(^|\s)$/.test(cur)){ const e = s.indexOf('))', i+2); if (e>0){ cur+=s.slice(i,e+2); i=e+1; continue; } }
      if (ch==='|'){ out.push(cur); cur=''; continue; }
      cur+=ch;
    }
    out.push(cur); return out;
  }
  _tokenize(s){
    const toks=[]; let cur=''; let q=null; let had=false; let quotedAny=false;
    const vars = {HOME:this.home, USER:this.user, PWD:this.cwd, HOSTNAME:this.hostname, SHELL:'/bin/bash', '?':String(this.lastCode), PATH:'/home/'+this.user+'/.local/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin'};
    const pa = this.posArgs || []; vars['#']=String(pa.length); vars['@']=pa.join(' '); vars['*']=pa.join(' '); vars['0']=this.scriptName||'-bash';
    for (let i=1;i<=9;i++) vars[String(i)] = pa[i-1]||'';
    vars['$'] = String(this.pid0||4321); vars['RANDOM'] = String(Math.floor(Math.random()*32768)); vars['!'] = String(this.lastBg||''); vars['LINENO'] = String(this.lineNo||0);
    const VRE = /^\$(?:\{([A-Za-z_][A-Za-z0-9_]*|[0-9#@*?$!])\}|([A-Za-z_][A-Za-z0-9_]*|[0-9#@*?$!]))/;
    const isSet = v => (this.env && v in this.env) || (/^[1-9]$/.test(v) ? pa.length >= +v : v in vars) || (this.arr && v in this.arr);
    const lookupVar = v => { if (this.nounset && !isSet(v) && !/^[@*#?$!0]$/.test(v)) this._unbound = this._unbound || v; return (this.env && v in this.env) ? this.env[v] : (v in vars ? vars[v] : ''); };
    const expandVar = (str)=>{ const m=str.match(VRE); return m ? lookupVar(m[1]||m[2]) : str; };
    const braceExp = (i)=>{ if (s[i+1]!=='{') return null; let d=0; for (let j=i+1;j<s.length;j++){ if (s[j]==='{') d++; else if (s[j]==='}'){ d--; if (!d){ const inner = s.slice(i+2,j); if (/^[A-Za-z_][A-Za-z0-9_]*$|^[0-9#@*?$!]$/.test(inner)) return null; return {v: this._pexp ? this._pexp(inner, lookupVar, isSet) : '', end:j}; } } } return null; };
    const btick = (i)=>{ const e = s.indexOf('`', i+1); if (e<0) return null; const r = this._pipeline(s.slice(i+1,e)); return {v:(r.o||'').replace(/\n+$/,''), end:e}; };
    const arith = (ex)=>{ if (this._arith) return String(this._arith(ex)); const e2 = ex.replace(/\$?([A-Za-z_][A-Za-z0-9_]*)/g,(m,v)=>{ const x=lookupVar(v); return /^-?\d+$/.test(x)?x:'0'; }); if (!/^[0-9+\-*\/%()<>=!&| ]*$/.test(e2)) return '0'; try { return String(Math.trunc(Function('return ('+e2+')')())); } catch(e){ return '0'; } };
    const push = ()=>{ if (had){ let v=cur; if (!quotedAny && (v==='~' || v.startsWith('~/'))) v = this.home + v.slice(1); toks.push({v, q:quotedAny}); } cur=''; had=false; quotedAny=false; };
    for (let i=0;i<s.length;i++){
      const ch = s[i];
      if (q==="'"){ if (ch==="'") q=null; else cur+=ch; continue; }
      if (q==='"'){
        if (ch==='"'){ q=null; continue; }
        if (ch==='`'){ const b = btick(i); if (b){ cur+=b.v; i=b.end; continue; } }
        if (ch==='$'){
          const be = braceExp(i); if (be){ cur+=be.v; i=be.end; continue; }
          const ar = s.slice(i).match(/^\$\(\((.*?)\)\)/); if (ar){ cur+=arith(ar[1]); i+=ar[0].length-1; continue; }
          const sub = this._balanced(s, i); if (sub){ const r = this._pipeline(sub.inner); cur+=(r.o||'').replace(/\n+$/,''); i=sub.end; continue; }
          const m = s.slice(i).match(VRE); if (m){ cur+=expandVar(m[0]); i+=m[0].length-1; continue; } }
        if (ch==='\\' && i+1<s.length && '"$\\`'.includes(s[i+1])){ cur+=s[++i]; continue; }
        cur+=ch; continue;
      }
      if (ch==="'"||ch==='"'){ q=ch; had=true; quotedAny=true; continue; }
      if (ch==='\\' && i+1<s.length){ cur+=s[++i]; had=true; quotedAny=true; continue; }
      if (/\s/.test(ch)){ push(); continue; }
      if (ch==='>' || ch==='<'){
        // redirect operators
        let op = ch;
        if (cur==='2' || cur==='&' || cur==='1'){ op = cur+ch; cur=''; had=false; }
        else push();
        if (s[i+1]==='>'){ op+='>'; i++; }
        if (s[i+1]==='&' && /\d/.test(s[i+2]||'')){ op+='&'+s[i+2]; i+=2; }
        toks.push({op}); continue;
      }
      if (ch==='`'){ const b = btick(i); if (b){ cur+=b.v; i=b.end; had=true; continue; } }
      if (ch==='$' && s[i+1]==='{'){ const be = braceExp(i); if (be){ cur+=be.v; i=be.end; had=true; continue; } }
      if (ch==='$'){ const ar = s.slice(i).match(/^\$\(\((.*?)\)\)/); if (ar){ cur+=arith(ar[1]); i+=ar[0].length-1; had=true; continue; }
        const m = s.slice(i).match(VRE); if (m){ cur+=expandVar(m[0]); i+=m[0].length-1; had=true; continue; }
        const sub = this._balanced(s, i); if (sub){ const r = this._pipeline(sub.inner); cur+=(r.o||'').replace(/\n+$/,'').replace(/\n/g,' '); i=sub.end; had=true; continue; } }
      cur+=ch; had=true;
    }
    if (q) return null;
    push();
    return toks;
  }
  _balanced(s, i){
    if (s[i]!=='$' || s[i+1]!=='(' || s[i+2]==='(') return null;
    let d=0, q=null;
    for (let j=i+1;j<s.length;j++){ const c=s[j]; if (q){ if (c===q) q=null; continue; } if (c==='"'||c==="'"){ q=c; continue; } if (c==='(') d++; else if (c===')'){ d--; if (d===0) return {inner:s.slice(i+2,j), end:j}; } }
    return null;
  }
  _glob(tok){
    if (!tok.q && /\{-?\d+\.\.-?\d+\}/.test(tok.v)){
      const m = tok.v.match(/^(.*?)\{(-?\d+)\.\.(-?\d+)\}(.*)$/); const a=+m[2], b=+m[3]; const st = a<=b?1:-1; const r=[];
      if (Math.abs(b-a) <= 1000) for (let x=a; st>0?x<=b:x>=b; x+=st) r.push(...this._glob({v:m[1]+x+m[4], q:false}));
      return r.length ? r : [tok.v];
    }
    if (!tok.q && /\{[^{}]*,[^{}]*\}/.test(tok.v)){
      const m = tok.v.match(/^(.*?)\{([^{}]*,[^{}]*)\}(.*)$/);
      return m[2].split(',').flatMap(x=>this._glob({v:m[1]+x+m[3], q:false}));
    }
    if (tok.q || !/[*?]/.test(tok.v)) return [tok.v];
    const abs = tok.v.startsWith('/');
    const parts = tok.v.split('/');
    let bases = [abs ? '/' : ''];
    for (let i=0;i<parts.length;i++){
      const p = parts[i];
      if (p===''){ continue; }
      const next = [];
      for (const b of bases){
        if (/[*?]/.test(p)){
          const dn = this.node(b===''?'.':b);
          if (!dn || dn.t!=='d') continue;
          const re = globToRe(p);
          Object.keys(dn.c).sort().forEach(k=>{ if (re.test(k) && (p.startsWith('.') || !k.startsWith('.'))) next.push((b===''?'':(b==='/'?'/':b+'/'))+k); });
        } else next.push((b===''?'':(b==='/'?'/':b+'/'))+p);
      }
      bases = next;
    }
    return bases.length ? bases : [tok.v];
  }
  _pipeline(s){
    const segs = this._splitPipe(s);
    let input = null, e = '', code = 0, o='', pfc = 0;
    for (let i=0;i<segs.length;i++){
      const toks = this._tokenize(segs[i].trim());
      if (toks===null) return {o:'', e:'-bash: syntax error: unexpected end of file (chýba úvodzovka)\n', code:2};
      const args=[]; const redir=[];
      for (let j=0;j<toks.length;j++){
        const t = toks[j];
        if (t.op){
          if (/&\d$/.test(t.op)) redir.push({op:t.op}); else { const nx = toks[++j]; if (!nx || nx.op) return {o:'',e:'-bash: syntax error near unexpected token `newline\'\n',code:2}; redir.push({op:t.op, f:nx.v}); }
        } else args.push(...this._glob(t));
      }
      if (!args.length){ continue; }
      // stdin redirect
      const inR = redir.find(r=>r.op==='<');
      if (inR){ const n = this.node(inR.f); if (!n){ e += `-bash: ${inR.f}: No such file or directory\n`; code=1; input=''; continue; } input = n.c; }
      let r = this.exec(args, input, i<segs.length-1);
      let out = r.o||'', err = r.e||'';
      code = r.code!=null ? r.code : (err && !out ? 1 : 0);
      if (code) pfc = code;
      for (const rd of redir){
        if (rd.op==='2>&1'){ out += err; err=''; }
        if (rd.op==='>&2' || rd.op==='1>&2'){ err += out; out=''; }
      }
      for (const rd of redir){
        if (rd.op==='<' || /&\d$/.test(rd.op)) continue;
        const isErr = rd.op.startsWith('2');
        const both = rd.op.startsWith('&');
        const append = rd.op.endsWith('>>');
        const data = both ? out+err : isErr ? err : out;
        if (rd.f==='/dev/null'){ if (both){ out=''; err=''; } else if (isErr) err=''; else out=''; continue; }
        const wr = this._writeFile(rd.f, data, append);
        if (wr){ err += wr; code = 1; }
        if (both){ out=''; err= wr||''; } else if (isErr) err = wr||''; else out='';
      }
      e += err;
      input = out;
      if (i===segs.length-1) o = out;
    }
    if (this.pipefail && pfc && !code) code = pfc;
    return {o, e, code};
  }
  _writeFile(p, data, append){
    const abs = this.norm(p);
    let n = this._lookup(abs);
    if (n && n.t==='d') return `-bash: ${p}: Is a directory\n`;
    if (n){
      if (!this.can(n,2)) return `-bash: ${p}: Permission denied\n`;
      n.c = append ? n.c + data : data; n.mt = new Date(); return '';
    }
    const [dir, base] = this.parentOf(abs);
    const dn = this._lookup(dir);
    if (!dn || dn.t!=='d') return `-bash: ${p}: No such file or directory\n`;
    if (!this.can(dn,2)) return `-bash: ${p}: Permission denied\n`;
    const nn = this.mk('f', this.user==='root'?0o644:0o664, this.user, this._ugroup());
    nn.c = data; nn.mt = new Date(); nn.ctx = this.defaultCtx(abs);
    dn.c[base] = nn; return '';
  }
  _ugroup(){ if (this.user==='root') return 'root'; const u = this.users[this.user]; const g = Object.entries(this.groups).find(([n,x])=>x.gid===u.gid); return g?g[0]:this.user; }

  /* ---- option parsing ---- */
  opts(args, withVal=[]){
    const f = new Set(), v = {}, pos = [];
    let stop = false;
    for (let i=0;i<args.length;i++){
      const a = args[i];
      if (stop || a==='-' || !a.startsWith('-') || /^-\d/.test(a) && !withVal.includes('NUM')){ pos.push(a); continue; }
      if (a==='--'){ stop=true; continue; }
      if (a.startsWith('--')){
        const eq = a.indexOf('=');
        if (eq>0){ v[a.slice(2,eq)] = a.slice(eq+1); f.add(a.slice(2,eq)); }
        else { const k=a.slice(2); f.add(k); if (withVal.includes(k) && i+1<args.length) v[k]=args[++i]; }
        continue;
      }
      const letters = a.slice(1);
      for (let j=0;j<letters.length;j++){
        const L = letters[j];
        f.add(L);
        if (withVal.includes(L)){
          const rest = letters.slice(j+1);
          v[L] = rest || args[++i]; break;
        }
      }
    }
    return {f, v, pos, has:(...k)=>k.some(x=>f.has(x))};
  }

  /* ===================== EXEC ===================== */
  exec(args, stdin, piped){
    let name = args[0];
    const rest = args.slice(1);
    if (name==='sudo'){
      if (!rest.length) return {e:'usage: sudo -h | -K | -k | -V\nusage: sudo [-u user] command\n',code:1};
      if (this.user!=='root' && !this.groups.wheel.mem.includes(this.user)) { this.log.push({name:'sudo',args:rest,flags:new Set(),user:this.user,code:1}); return {e:`${this.user} is not in the sudoers file.  This incident will be reported.\n`,code:1}; }
      if (rest[0]==='-i' || (rest[0]==='su' && (rest[1]==='-'||!rest[1])) || rest[0]==='-s'){ this.prevUser=this.user; this.prevCwd=this.cwd; this.user='root'; this.rootShell=true; this.cwd='/root'; this.log.push({name:'sudo',args:rest,flags:new Set(['i']),user:'admin',code:0}); return {o:''}; }
      const prev = this.user; this.user = 'root';
      let r;
      try { r = this.exec(rest, stdin, piped); } finally { this.user = prev; }
      return r;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(name)){ this.env = this.env||{}; const k=name.slice(0,name.indexOf('=')); this.env[k]=name.slice(name.indexOf('=')+1); if (rest.length) return this.exec(rest, stdin, piped); return {o:'',code:0}; }
    const fn = this['c_'+name.replace(/[.-]/g,'_')];
    // command availability by package
    const owner = Object.entries(PKG_DB).find(([p,d])=>d.cmds.includes(name));
    if (owner && !this.pkgs.has(owner[0])){
      this.log.push({name,args:rest,flags:new Set(),user:this.user,code:127});
      return {e:`bash: ${name}: command not found\n(simulátor: príkaz je v balíku ${owner[0]}; na serveri to zistíš cez dnf provides ${name})\n`,code:127};
    }
    if (!fn){
      this.log.push({name,args:rest,flags:new Set(),user:this.user,code:127});
      if (name.includes('/')){ const ent = this.log[this.log.length-1]; const r = this.c__runscript(name, rest); ent.code = r.code||0; return r; }
      return {e:`bash: ${name}: command not found\n`, code:127};
    }
    const entry = {name, args:rest, flags:new Set(), user:this.user, code:0};
    rest.forEach(a=>{ if (/^--/.test(a)) entry.flags.add(a.slice(2).split('=')[0]); else if (/^-[A-Za-z]/.test(a)) a.slice(1).split('').forEach(c=>entry.flags.add(c)); });
    let r;
    try { r = fn.call(this, rest, stdin, piped) || {}; }
    catch(err){ r = {e:`${name}: interná chyba simulátora: ${err.message}\n`, code:1}; }
    if (typeof r === 'string') r = {o:r};
    if (r.code==null) r.code = r.e && !r.o ? 1 : 0;
    entry.code = r.code;
    this.log.push(entry);
    return r;
  }
  c__runscript(name, args){
    const n = this.node(name);
    if (!n) return {e:`bash: ${name}: No such file or directory\n`,code:127};
    if (n.t==='d') return {e:`bash: ${name}: Is a directory\n`,code:126};
    if (!this.can(n,1)) return {e:`bash: ${name}: Permission denied\n`,code:126};
    return this._runScript(n.c, args||[], name);
  }

  /* ---------------- basics ---------------- */
  c_pwd(){ return this.cwd+'\n'; }
  c_whoami(){ return this.user+'\n'; }
  c_hostname(a){ if (a[0]==='-I') return this.net.ip.split('/')[0]+' \n'; return this.hostname+'\n'; }
  c_clear(){ return {o:'\x1bCLEAR'}; }
  c_exit(){ if (this.rootShell){ this.user=this.prevUser||'admin'; this.cwd=this.prevCwd||'/home/admin'; this.rootShell=false; return {o:'logout\n'}; } return {o:'logout\n(v simulátore sa neodhlásiš, terminál beží ďalej)\n'}; }
  c_logout(a){ return this.c_exit(a); }
  c_echo(a){ let nl = true; if (a[0]==='-n'){ nl=false; a=a.slice(1); } if (a[0]==='-e') a=a.slice(1); return a.join(' ')+(nl?'\n':''); }
  c_true(){ return {o:'',code:0}; }
  c_false(){ return {o:'',code:1}; }
  c_date(a){ const d=new Date(); if (a[0]==='+%F') return d.toISOString().slice(0,10)+'\n'; if (a[0] && a[0].startsWith('+')) return a[0].slice(1).replace('%F',d.toISOString().slice(0,10)).replace('%H',z2(d.getHours())).replace('%M',z2(d.getMinutes())).replace('%Y',d.getFullYear()).replace('%m',z2(d.getMonth()+1)).replace('%d',z2(d.getDate()))+'\n'; return d.toString().replace(/ GMT.*/,' CET')+'\n'; }
  c_history(a){ if (a[0]==='-c'){ this.history=[]; return ''; } return this.history.map((h,i)=>pad(i+1,5)+'  '+h).join('\n')+'\n'; }
  c_alias(){ return "alias egrep='grep -E --color=auto'\nalias grep='grep --color=auto'\nalias l.='ls -d .* --color=auto'\nalias ll='ls -l --color=auto'\nalias ls='ls --color=auto'\nalias vi='vim'\n"; }
  c_export(a){ this.env = this.env||{}; a.forEach(x=>{ const [k,...v]=x.split('='); this.env[k]=v.join('='); }); return ''; }
  c_env(){ return `HOSTNAME=${this.hostname}\nSHELL=/bin/bash\nUSER=${this.user}\nPWD=${this.cwd}\nHOME=${this.home}\nLANG=sk_SK.UTF-8\nPATH=/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin\n`+Object.entries(this.env||{}).map(([k,v])=>k+'='+v).join('\n')+(this.env&&Object.keys(this.env).length?'\n':''); }
  c_uname(a){ const o=this.opts(a); if (o.has('a')) return `Linux ${this.hostname} ${this.kernel} #1 SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux\n`; if (o.has('r')) return this.kernel+'\n'; if (o.has('n')) return this.hostname+'\n'; if (o.has('m')) return 'x86_64\n'; return 'Linux\n'; }
  c_uptime(a){ if (a[0]==='-p') return 'up 1 day, 2 hours, 14 minutes\n'; const d=new Date(); return ` ${z2(d.getHours())}:${z2(d.getMinutes())}:${z2(d.getSeconds())} up 1 day,  2:14,  1 user,  load average: 0.18, 0.24, 0.21\n`; }
  c_which(a){ let o='',e=''; for (const c of a){ const p = ['/usr/bin/','/usr/sbin/'].map(d=>d+c).find(x=>this.exists(x)); if (p) o+=p+'\n'; else if (['cd','echo','history','alias','export'].includes(c)) o+=`/usr/bin/${c}\n`; else e+=`/usr/bin/which: no ${c} in (/home/${this.user}/.local/bin:/home/${this.user}/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin)\n`; } return {o,e,code:e?1:0}; }
  c_type(a){ return a.map(c=>['cd','echo','history','export','alias','type','pwd'].includes(c)?`${c} is a shell builtin`:(this.exists('/usr/bin/'+c)?`${c} is /usr/bin/${c}`:`-bash: type: ${c}: not found`)).join('\n')+'\n'; }
  c_id(a){
    const nm = a.filter(x=>!x.startsWith('-'))[0] || this.user;
    const u = nm==='root' ? {uid:0,gid:0} : this.users[nm];
    if (!u) return {e:`id: ‘${nm}’: no such user\n`,code:1};
    const prim = Object.entries(this.groups).find(([n,g])=>g.gid===u.gid);
    const gs = [prim].concat(Object.entries(this.groups).filter(([n,g])=>g.mem.includes(nm) && g.gid!==u.gid)).filter(Boolean);
    if (a.includes('-u')) return u.uid+'\n';
    if (a.includes('-Gn')||a.includes('-nG')) return gs.map(g=>g[0]).join(' ')+'\n';
    const ctx = nm===this.user ? ' context=unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023' : '';
    return `uid=${u.uid}(${nm}) gid=${u.gid}(${prim?prim[0]:nm}) groups=${gs.map(([n,g])=>g.gid+'('+n+')').join(',')}${ctx}\n`;
  }
  c_groups(a){ const nm=a[0]||this.user; const u = nm==='root'?{gid:0}:this.users[nm]; if (!u) return {e:`groups: ‘${nm}’: no such user\n`}; const gs = Object.entries(this.groups).filter(([n,g])=>g.gid===u.gid || g.mem.includes(nm)).map(([n])=>n); return (a[0]?nm+' : ':'')+gs.join(' ')+'\n'; }
  c_w(){ const d=new Date(); return ` ${z2(d.getHours())}:${z2(d.getMinutes())}:00 up 1 day,  2:14,  1 user,  load average: 0.18, 0.24, 0.21\nUSER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT\nadmin    pts/0    10.0.20.15       10:29    0.00s  0.05s  0.00s w\n`; }
  c_who(){ return 'admin    pts/0        '+new Date().toISOString().slice(0,10)+' 10:29 (10.0.20.15)\n'; }
  c_last(){ return 'admin    pts/0        10.0.20.15       Sun Nov  1 10:29   still logged in\nadmin    pts/0        10.0.20.15       Sat Oct 31 14:02 - 17:45  (03:43)\nreboot   system boot  '+this.kernel.slice(0,16)+' Sat Oct 31 08:00   still running\n\nwtmp begins Fri Oct  2 09:20:11 2026\n'; }

  /* ---------------- navigation ---------------- */
  c_cd(a){
    let t = a[0];
    if (t==null || t==='~') t = this.home;
    if (t==='-'){ t = this.oldpwd || this.cwd; }
    const abs = this.norm(t);
    const n = this._lookup(abs);
    if (!n) return {e:`-bash: cd: ${a[0]}: No such file or directory\n`,code:1};
    if (n.t!=='d') return {e:`-bash: cd: ${a[0]}: Not a directory\n`,code:1};
    if (!this.can(n,1)) return {e:`-bash: cd: ${a[0]}: Permission denied\n`,code:1};
    this.oldpwd = this.cwd; this.cwd = abs;
    return a[0]==='-' ? abs+'\n' : '';
  }
  c_ls(a){
    const o = this.opts(a, ['color','sort']);
    const targets = o.pos.length ? o.pos : ['.'];
    let out = [], err = '';
    const long = o.has('l','n','g','o'), all = o.has('a'), almost = o.has('A'), hum = o.has('h','human-readable'), dOnly = o.has('d','directory');
    const listOne = (abs, n, name)=>{
      return {name, n, abs};
    };
    const fmt = (items, showTotal)=>{
      let sorted = items.slice();
      if (o.has('t')) sorted.sort((x,y)=>y.n.mt - x.n.mt);
      else if (o.has('S')) sorted.sort((x,y)=>this._size(y.n) - this._size(x.n));
      else sorted.sort((x,y)=>x.name.replace(/^\./,'').localeCompare(y.name.replace(/^\./,''),'en',{sensitivity:'base'}));
      if (o.has('r')) sorted.reverse();
      if (!long){
        return sorted.map(it=>(o.has('i')?this._ino(it.n)+' ':'')+(o.has('Z')?this.ctxFull(it.n,it.abs)+' ':'')+it.name+(o.has('F')&&it.n.t==='d'?'/':'')).join(o.has('1')||o.has('Z')?'\n':'  ')+(sorted.length?'\n':'');
      }
      let lines = [];
      if (showTotal) lines.push('total '+Math.max(0,sorted.reduce((s,it)=>s+Math.ceil(this._size(it.n)/1024),0)));
      const sz = sorted.map(it=> hum ? human(this._size(it.n)) : String(this._size(it.n)));
      const w = Math.max(1,...sz.map(s=>s.length));
      const uw = Math.max(1,...sorted.map(it=>(o.has('n')?String(this._uid(it.n.u)):it.n.u).length));
      const gw = Math.max(1,...sorted.map(it=>(o.has('n')?String(this._gid(it.n.g)):it.n.g).length));
      sorted.forEach((it,i)=>{
        const n = it.n;
        const lk = n.t==='d' ? 2 + Object.values(n.c).filter(x=>x.t==='d').length : 1;
        let s = (o.has('i')?this._ino(n)+' ':'') + permStr(n.t,n.m) + (n.acl&&n.acl.length?'+':'.') + ' ' + pad(lk,2) + ' ';
        if (!o.has('g')) s += pad(o.has('n')?this._uid(n.u):n.u, uw, true)+' ';
        if (!o.has('o')) s += pad(o.has('n')?this._gid(n.g):n.g, gw, true)+' ';
        if (o.has('Z')) s += this.ctxFull(n, it.abs)+' ';
        s += pad(sz[i], w)+' '+lsDate(n.mt)+' '+it.name;
        if (n.t==='l') s += ' -> '+n.tgt;
        else if (o.has('F') && n.t==='d') s+='/';
        lines.push(s);
      });
      return lines.join('\n')+'\n';
    };
    const recurse = (abs, n, label, first)=>{
      let s = '';
      if (o.has('R') || targets.length>1) s += (first?'':'\n')+label+':\n';
      if (!this.can(n,4)) { err += `ls: cannot open directory '${label}': Permission denied\n`; return s; }
      const items = [];
      if (all){ items.push({name:'.', n, abs}); items.push({name:'..', n:this._lookup(this.parentOf(abs)[0])||n, abs}); }
      for (const [k,ch] of Object.entries(n.c)) if (all || almost || !k.startsWith('.')) items.push({name:k,n:ch,abs:(abs==='/'?'':abs)+'/'+k});
      s += fmt(items, true);
      if (o.has('R')) for (const it of items.slice().sort((x,y)=>x.name.localeCompare(y.name))) if (it.n.t==='d' && it.name!=='.' && it.name!=='..') s += recurse(it.abs, it.n, (label==='.'?'.':label)+'/'+it.name, false);
      return s;
    };
    let fileItems = [], first = true;
    for (const t of targets){
      const abs = this.norm(t);
      const nl = this._lookup(abs, false);
      const n = this._lookup(abs, true);
      if (!n && !nl){ err += `ls: cannot access '${t}': No such file or directory\n`; continue; }
      if (dOnly || n.t!=='d' || (long && nl && nl.t==='l' && !t.endsWith('/'))){ fileItems.push({name:t, n: (long&&nl&&nl.t==='l')?nl:n, abs}); continue; }
    }
    if (fileItems.length) { out.push(fmt(fileItems,false)); first=false; }
    for (const t of targets){
      const abs = this.norm(t);
      const nl = this._lookup(abs, false);
      const n = this._lookup(abs, true);
      if (!n || dOnly || n.t!=='d' || (long && nl && nl.t==='l' && !t.endsWith('/'))) continue;
      out.push(recurse(abs, n, t, first && !fileItems.length)); first=false;
    }
    return {o: out.join(''), e: err, code: err?2:0};
  }
  _size(n){ if (n.t==='d') return 4096; if (n.t==='l') return n.tgt.length; if (n.big) return n.big; return new TextEncoder().encode(n.c).length; }
  _ino(n){ if (!n._ino) n._ino = 1048000 + Math.floor(Math.random()*90000); return n._ino; }
  _uid(u){ return u==='root'?0:(this.users[u]?.uid ?? (this.sysusers.find(x=>x[0]===u)||[0,0])[1]); }
  _gid(g){ return this.groups[g]?.gid ?? 0; }
  c_tree(a){
    const start = a.find(x=>!x.startsWith('-')) || '.';
    const n = this.node(start); if (!n) return {e:`${start} [error opening dir]\n`};
    const showAll = a.includes('-a'); const lvl = a.includes('-L') ? +a[a.indexOf('-L')+1] : 99;
    let dirs=0, files=0;
    const walk = (node, prefix, depth)=>{
      if (depth>lvl) return '';
      const ks = Object.keys(node.c).filter(k=>showAll||!k.startsWith('.')).sort();
      let s='';
      ks.forEach((k,i)=>{
        const last = i===ks.length-1; const ch=node.c[k];
        s += prefix+(last?'└── ':'├── ')+k+(ch.t==='l'?' -> '+ch.tgt:'')+'\n';
        if (ch.t==='d'){ dirs++; if (this.can(ch,4)) s += walk(ch, prefix+(last?'    ':'│   '), depth+1); } else files++;
      });
      return s;
    };
    const body = walk(n,'',1);
    return start+'\n'+body+`\n${dirs} directories, ${files} files\n`;
  }
  c_mkdir(a){
    const o = this.opts(a,['m']); let e='', out='';
    if (!o.pos.length) return {e:"mkdir: missing operand\nTry 'mkdir --help' for more information.\n",code:1};
    for (const p of o.pos){
      const abs = this.norm(p);
      if (this._lookup(abs)){ if (!o.has('p')) e += `mkdir: cannot create directory ‘${p}’: File exists\n`; continue; }
      const parts = abs.split('/').filter(Boolean); let cur = this.root, cp='';
      for (let i=0;i<parts.length;i++){
        cp += '/'+parts[i];
        let nx = cur.c[parts[i]];
        if (nx && nx.t==='l') nx = this._lookup(cp);
        if (!nx){
          if (i<parts.length-1 && !o.has('p')){ e += `mkdir: cannot create directory ‘${p}’: No such file or directory\n`; cur=null; break; }
          if (!this.can(cur,2)){ e += `mkdir: cannot create directory ‘${p}’: Permission denied\n`; cur=null; break; }
          nx = this.mk('d', o.v.m ? parseInt(o.v.m,8) : (this.user==='root'?0o755:0o775), this.user, this._ugroup()); nx.mt=new Date(); nx.ctx = this.defaultCtx(cp);
          cur.c[parts[i]] = nx;
          if (o.has('v')) out += `mkdir: created directory '${cp}'\n`;
        }
        cur = nx;
      }
    }
    return {o:out, e, code:e?1:0};
  }
  c_rmdir(a){ let e=''; for (const p of a){ const abs=this.norm(p); const n=this._lookup(abs); if (!n){ e+=`rmdir: failed to remove '${p}': No such file or directory\n`; continue; } if (n.t!=='d'){ e+=`rmdir: failed to remove '${p}': Not a directory\n`; continue; } if (Object.keys(n.c).length){ e+=`rmdir: failed to remove '${p}': Directory not empty\n`; continue; } const [d,b]=this.parentOf(abs); const dn=this._lookup(d); if (!this.can(dn,2)){ e+=`rmdir: failed to remove '${p}': Permission denied\n`; continue; } delete dn.c[b]; } return {e,code:e?1:0}; }
  c_touch(a){
    let e='';
    for (const p of a.filter(x=>!x.startsWith('-'))){
      const n = this.node(p);
      if (n){ n.mt = new Date(); continue; }
      const r = this._writeFile(p,'',false);
      if (r) e += r.replace('-bash: ','touch: cannot touch \'').replace(/: (No such|Permission)/,'\': $1');
    }
    return {e,code:e?1:0};
  }
  c_rm(a){
    const o = this.opts(a); let e='', out='';
    if (!o.pos.length) return {e:"rm: missing operand\nTry 'rm --help' for more information.\n",code:1};
    for (const p of o.pos){
      const abs = this.norm(p);
      if (abs==='/' ) { e += "rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n"; continue; }
      const n = this._lookup(abs,false);
      if (!n){ if (!o.has('f')) e += `rm: cannot remove '${p}': No such file or directory\n`; continue; }
      if (n.t==='d' && !o.has('r','R','recursive')){ e += `rm: cannot remove '${p}': Is a directory\n`; continue; }
      const [d,b] = this.parentOf(abs); const dn = this._lookup(d);
      if (!this.can(dn,2)){ e += `rm: cannot remove '${p}': Permission denied\n`; continue; }
      if (dn.m & 0o1000 && this.user!=='root' && n.u!==this.user){ e += `rm: cannot remove '${p}': Operation not permitted\n`; continue; }
      delete dn.c[b];
      if (o.has('v')) out += n.t==='d' ? `removed directory '${p}'\n` : `removed '${p}'\n`;
    }
    return {o:out,e,code:e?1:0};
  }
  _clone(n){ const c = Object.assign({}, n); if (n.t==='d'){ c.c = {}; for (const [k,v] of Object.entries(n.c)) c.c[k] = this._clone(v); } if (n.acl) c.acl = n.acl.map(x=>Object.assign({},x)); return c; }
  _relabelTree(n, abs){ n.ctx = this.defaultCtx(abs); if (n.t==='d') for (const [k,v] of Object.entries(n.c)) this._relabelTree(v, abs+'/'+k); }
  _cpmv(a, move){
    const o = this.opts(a, ['t']); let e='', out='';
    const cmd = move?'mv':'cp';
    if (o.pos.length<2) return {e:`${cmd}: missing destination file operand after '${o.pos[0]||''}'\n`,code:1};
    const dst = o.pos[o.pos.length-1], srcs = o.pos.slice(0,-1);
    const dabs = this.norm(dst); const dn = this._lookup(dabs);
    if (srcs.length>1 && (!dn || dn.t!=='d')) return {e:`${cmd}: target '${dst}' is not a directory\n`,code:1};
    for (const s of srcs){
      const sabs = this.norm(s); const sn = this._lookup(sabs);
      if (!sn){ e += `${cmd}: cannot stat '${s}': No such file or directory\n`; continue; }
      if (!move && sn.t==='d' && !o.has('r','R','a','recursive')){ e += `cp: -r not specified; omitting directory '${s}'\n`; continue; }
      if (!this.can(sn,4)){ e += `${cmd}: cannot open '${s}' for reading: Permission denied\n`; continue; }
      let tabs = (dn && dn.t==='d') ? (dabs==='/'?'':dabs)+'/'+sabs.split('/').pop() : dabs;
      const [td, tb] = this.parentOf(tabs); const tdn = this._lookup(td);
      if (!tdn || tdn.t!=='d'){ e += `${cmd}: cannot create regular file '${dst}': No such file or directory\n`; continue; }
      if (!this.can(tdn,2)){ e += `${cmd}: cannot create regular file '${tabs}': Permission denied\n`; continue; }
      let nn;
      if (move){
        const [sd,sb] = this.parentOf(sabs); const sdn = this._lookup(sd);
        if (!this.can(sdn,2)){ e += `mv: cannot move '${s}' to '${tabs}': Permission denied\n`; continue; }
        nn = sn; delete sdn.c[sb];  // mv keeps SELinux context!
      } else {
        nn = this._clone(sn);
        const keep = o.has('a','p','preserve');
        if (!keep){ const setOwn = (x)=>{ x.u=this.user; x.g=this._ugroup(); x.mt=new Date(); if (x.t==='d') Object.values(x.c).forEach(setOwn); }; setOwn(nn); }
        if (!o.has('a') && !(o.v.preserve||'').includes('context')) this._relabelTree(nn, tabs);
      }
      tdn.c[tb] = nn;
      if (o.has('v')) out += `'${s}' -> '${tabs}'\n`;
    }
    return {o:out,e,code:e?1:0};
  }
  c_cp(a){ return this._cpmv(a,false); }
  c_mv(a){ return this._cpmv(a,true); }
  c_ln(a){
    const o = this.opts(a);
    const [src, dst] = o.pos;
    if (!src) return {e:'ln: missing file operand\n',code:1};
    let tabs = this.norm(dst || src.split('/').pop());
    const dn = this._lookup(tabs); if (dn && dn.t==='d') tabs = tabs+'/'+src.split('/').pop();
    if (this._lookup(tabs,false)) return {e:`ln: failed to create ${o.has('s')?'symbolic ':''}link '${dst}': File exists\n`,code:1};
    const [d,b] = this.parentOf(tabs); const pd = this._lookup(d);
    if (!pd) return {e:`ln: failed to create link '${dst}': No such file or directory\n`,code:1};
    if (!this.can(pd,2)) return {e:`ln: failed to create symbolic link '${dst}': Permission denied\n`,code:1};
    if (o.has('s')){ const n = this.mk('l',0o777,this.user,this._ugroup()); n.tgt = src; n.mt=new Date(); n.ctx=this.defaultCtx(tabs); pd.c[b]=n; }
    else { const s = this.node(src); if (!s) return {e:`ln: failed to access '${src}': No such file or directory\n`,code:1}; if (s.t==='d') return {e:`ln: ${src}: hard link not allowed for directory\n`,code:1}; pd.c[b]=s; }
    return '';
  }
  c_stat(a){
    const p = a.filter(x=>!x.startsWith('-'))[0]; const n = this.node(p,false);
    if (!n) return {e:`stat: cannot statx '${p}': No such file or directory\n`};
    const t = {d:'directory',f: n.c?'regular file':'regular empty file',l:'symbolic link'}[n.t];
    return `  File: ${p}\n  Size: ${this._size(n)}\t\tBlocks: 8          IO Block: 4096   ${t}\nDevice: fd00h/64768d\tInode: ${this._ino(n)}     Links: 1\nAccess: (0${(n.m&0o7777).toString(8).padStart(3,'0')}/${permStr(n.t,n.m)})  Uid: (${pad(this._uid(n.u),5)}/${pad(n.u,8,true)})   Gid: (${pad(this._gid(n.g),5)}/${pad(n.g,8,true)})\nContext: ${this.ctxFull(n,this.norm(p))}\nModify: ${n.mt.toISOString().replace('T',' ').slice(0,19)} +0100\n`;
  }
  c_file(a){ return a.map(p=>{ const n=this.node(p); if (!n) return `${p}: cannot open \`${p}' (No such file or directory)`; if (n.t==='d') return `${p}: directory`; if (n.c.startsWith('#!/bin/bash')) return `${p}: Bourne-Again shell script, ASCII text executable`; if (n.c.startsWith('\x7fELF')) return `${p}: ELF 64-bit LSB pie executable, x86-64`; return `${p}: ${/[^\x00-\x7f]/.test(n.c)?'UTF-8 Unicode':'ASCII'} text`; }).join('\n')+'\n'; }

  /* ---------------- reading ---------------- */
  _readArg(p){
    const n = this.node(p);
    if (!n) return {err:`${p}: No such file or directory`};
    if (n.t==='d') return {err:`${p}: Is a directory`};
    if (!this.can(n,4)) return {err:`${p}: Permission denied`};
    return {txt:n.c};
  }
  c_cat(a, stdin){
    const o = this.opts(a); let out='', e='';
    const files = o.pos.length ? o.pos : ['-'];
    for (const f of files){
      const r = f==='-' ? {txt:stdin||''} : this._readArg(f);
      if (r.err){ e += 'cat: '+r.err+'\n'; continue; }
      out += r.txt;
    }
    if (o.has('n')){ let i=0; out = out.replace(/\n$/,'').split('\n').map(l=>pad(++i,6)+'\t'+l).join('\n')+'\n'; }
    return {o:out,e,code:e?1:0};
  }
  c_tac(a,stdin){ const r=this.c_cat(a,stdin); r.o = r.o.replace(/\n$/,'').split('\n').reverse().join('\n')+'\n'; return r; }
  c_less(a, stdin){ const r = this.c_cat(a.filter(x=>!x.startsWith('-')), stdin); if (r.o) r.o += '(less: v reálnom termináli listuješ medzerníkom, hľadáš /slovo, končíš q)\n'; return r; }
  c_more(a,stdin){ return this.c_less(a,stdin); }
  _headtail(a, stdin, tail){
    let n = 10; const files=[]; let follow=false;
    for (let i=0;i<a.length;i++){
      if (a[i]==='-n'){ n = a[++i]; }
      else if (/^-n\d+$/.test(a[i])) n = a[i].slice(2);
      else if (/^-\d+$/.test(a[i])) n = a[i].slice(1);
      else if (a[i]==='-f' || a[i]==='-F' || a[i]==='--follow') follow=true;
      else files.push(a[i]);
    }
    const plus = String(n).startsWith('+'); n = parseInt(n,10);
    let out='', e='';
    const src = files.length ? files : ['-'];
    for (const f of src){
      const r = f==='-' ? {txt:stdin||''} : this._readArg(f);
      if (r.err){ e += (tail?'tail':'head')+': cannot open \''+f+'\' for reading: '+r.err.split(': ').pop()+'\n'; continue; }
      const lines = r.txt.replace(/\n$/,'').split('\n');
      if (src.length>1) out += `==> ${f} <==\n`;
      const sel = tail ? (plus ? lines.slice(n-1) : lines.slice(-n)) : lines.slice(0,n);
      out += (r.txt? sel.join('\n')+'\n' : '');
    }
    if (follow) out += '… (tail -f teraz čaká na nové riadky; v reálnom termináli ukončíš Ctrl+C)\n';
    return {o:out,e,code:e?1:0};
  }
  c_head(a,s){ return this._headtail(a,s,false); }
  c_tail(a,s){ return this._headtail(a,s,true); }
  c_wc(a, stdin){
    const o = this.opts(a);
    const files = o.pos.length ? o.pos : ['-'];
    let out='', e='';
    const sel = (o.has('l')||o.has('w')||o.has('c')||o.has('m')) ? o : null;
    for (const f of files){
      const r = f==='-' ? {txt:stdin||''} : this._readArg(f);
      if (r.err){ e += 'wc: '+r.err+'\n'; continue; }
      const L = (r.txt.match(/\n/g)||[]).length, W = (r.txt.trim().match(/\S+/g)||[]).length, C = new TextEncoder().encode(r.txt).length;
      const parts = [];
      if (!sel || o.has('l')) parts.push(L); if (!sel || o.has('w')) parts.push(W); if (!sel || o.has('c','m')) parts.push(C);
      out += (parts.length===1 && f==='-' ? String(parts[0]) : parts.map(x=>pad(x, f==='-'?7:2)).join(' ')) + (f==='-'?'':' '+f) + '\n';
    }
    return {o:out,e};
  }
  c_sort(a, stdin){
    const o = this.opts(a, ['t','k']);
    let txt = '';
    if (o.pos.length) for (const f of o.pos){ const r=this._readArg(f); if (r.err) return {e:'sort: cannot read: '+r.err+'\n'}; txt+=r.txt; } else txt = stdin||'';
    let lines = txt.replace(/\n$/,'').split('\n'); if (!txt) lines=[];
    const key = (l)=>{ if (!o.v.k) return l; const fld = parseInt(o.v.k,10); const parts = o.v.t ? l.split(o.v.t) : l.trim().split(/\s+/); return parts.slice(fld-1).join(o.v.t||' '); };
    if (o.has('n','h')) lines.sort((x,y)=>parseFloat(key(x))-parseFloat(key(y)) || key(x).localeCompare(key(y)));
    else lines.sort((x,y)=>key(x).localeCompare(key(y)));
    if (o.has('r')) lines.reverse();
    if (o.has('u')) lines = lines.filter((l,i)=>i===0||l!==lines[i-1]);
    return lines.length ? lines.join('\n')+'\n' : '';
  }
  c_uniq(a, stdin){
    const o = this.opts(a);
    let txt = o.pos[0] ? (this._readArg(o.pos[0]).txt||'') : (stdin||'');
    const lines = txt.replace(/\n$/,'').split('\n'); if (!txt) return '';
    const groups = [];
    for (const l of lines){ if (groups.length && groups[groups.length-1][0]===l) groups[groups.length-1][1]++; else groups.push([l,1]); }
    let g = groups;
    if (o.has('d')) g = g.filter(x=>x[1]>1);
    if (o.has('u')) g = g.filter(x=>x[1]===1);
    return g.map(([l,c])=>o.has('c') ? pad(c,7)+' '+l : l).join('\n')+'\n';
  }
  c_cut(a, stdin){
    const o = this.opts(a, ['d','f','c']);
    let txt = o.pos.length ? o.pos.map(f=>this._readArg(f).txt||'').join('') : (stdin||'');
    if (!o.v.f && !o.v.c) return {e:'cut: you must specify a list of bytes, characters, or fields\n',code:1};
    const d = o.v.d==null ? '\t' : o.v.d;
    const spec = (s,max)=>{ const set=[]; s.split(',').forEach(p=>{ if (p.includes('-')){ let [x,y]=p.split('-'); x=x?+x:1; y=y?+y:max; for(let i=x;i<=y;i++) set.push(i);} else set.push(+p); }); return set; };
    return txt.replace(/\n$/,'').split('\n').map(l=>{
      if (o.v.c){ return spec(o.v.c,l.length).map(i=>l[i-1]||'').join(''); }
      if (!l.includes(d)) return l;
      const parts = l.split(d); return spec(o.v.f,parts.length).filter(i=>i<=parts.length).map(i=>parts[i-1]).join(d);
    }).join('\n')+'\n';
  }
  c_tr(a, stdin){ const o=this.opts(a); const [x,y]=o.pos; let t=stdin||''; const cls = s=>s.replace('[:lower:]','abcdefghijklmnopqrstuvwxyz').replace('[:upper:]','ABCDEFGHIJKLMNOPQRSTUVWXYZ').replace('a-z','abcdefghijklmnopqrstuvwxyz').replace('A-Z','ABCDEFGHIJKLMNOPQRSTUVWXYZ'); if (o.has('d')){ const s=cls(x); return [...t].filter(c=>!s.includes(c)).join(''); } const s1=cls(x), s2=cls(y||''); return [...t].map(c=>{ const i=s1.indexOf(c); return i>=0 ? (s2[i]||s2[s2.length-1]||'') : c; }).join(''); }
  c_tee(a, stdin){ const o=this.opts(a); let e=''; for (const f of o.pos){ const r=this._writeFile(f, stdin||'', o.has('a')); if (r) e+=r.replace('-bash','tee'); } return {o:stdin||'', e, code:e?1:0}; }
  c_xargs(a, stdin){ const items = (stdin||'').trim().split(/\s+/).filter(Boolean); if (!a.length) a=['echo']; return this.exec(a.concat(items), null, false); }
  _grepRe(pat, o){
    let src = pat;
    if (!o.has('E','P') && !o.has('F')){
      // BRE -> JS: \| \+ \? \( \) are special; bare | + ? ( ) are literal
      src = src.replace(/\\\||\\\+|\\\?|\\\(|\\\)|[|+?(){}]/g, m=> m.length===2 ? m[1] : '\\'+m);
    }
    if (o.has('F')) src = pat.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if (o.has('w')) src = '(?<![\\p{L}\\p{N}_])(?:'+src+')(?![\\p{L}\\p{N}_])';
    if (o.has('x')) src = '^(?:'+src+')$';
    return new RegExp(src, 'u'+(o.has('i','ignore-case')?'i':'')+(o.has('o')?'g':''));
  }
  c_grep(a, stdin){
    const o = this.opts(a, ['e','A','B','C','m','color','include']);
    let pat = o.v.e != null ? o.v.e : o.pos.shift();
    if (pat==null) return {e:"Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n",code:2};
    let re; try { re = this._grepRe(pat,o); } catch(x){ return {e:'grep: Invalid regular expression\n',code:2}; }
    let files = o.pos.slice();
    const rec = o.has('r','R');
    if (rec && !files.length) files=['.'];
    const list = [];
    const walk = (p)=>{ const abs = this.norm(p); const n=this._lookup(abs); if (!n) { list.push({p, err:'No such file or directory'}); return; } if (n.t==='d'){ if (!rec){ list.push({p, err:'Is a directory'}); return; } if (!this.can(n,4)){ list.push({p,err:'Permission denied'}); return; } for (const k of Object.keys(n.c).sort()) walk((p.endsWith('/')?p:p+'/')+k); } else list.push({p, n}); };
    files.forEach(walk);
    const multi = rec || files.length>1;
    let out='', e='', matched=false;
    const doText = (txt, label)=>{
      const lines = txt.replace(/\n$/,'').split('\n'); if (!txt) return;
      let cnt = 0; const hits=[];
      lines.forEach((l,i)=>{ re.lastIndex=0; const m = re.test(l); if (m !== o.has('v')) { hits.push(i); } });
      if (o.v.m) hits.splice(+o.v.m);
      if (hits.length) matched = true;
      if (o.has('l')){ if (hits.length) out += label+'\n'; return; }
      if (o.has('L')){ if (!hits.length) out += label+'\n'; return; }
      if (o.has('c')){ out += (multi?label+':':'')+hits.length+'\n'; return; }
      const A = +(o.v.A||o.v.C||0), B = +(o.v.B||o.v.C||0);
      const show = new Set(); hits.forEach(i=>{ for (let k=i-B;k<=i+A;k++) if (k>=0&&k<lines.length) show.add(k); });
      let prev=-2;
      [...show].sort((x,y)=>x-y).forEach(i=>{
        if ((A||B) && prev>=0 && i>prev+1) out+='--\n';
        prev=i;
        const sep = hits.includes(i)?':':'-';
        let line = lines[i];
        if (o.has('o')){ re.lastIndex=0; const ms = line.match(re)||[]; ms.forEach(m=>{ out += (multi?label+sep:'')+(o.has('n')?(i+1)+sep:'')+m+'\n'; }); return; }
        out += (multi?label+sep:'')+(o.has('n')?(i+1)+sep:'')+line+'\n';
      });
    };
    if (!files.length) doText(stdin||'', '(standard input)');
    for (const it of list){
      if (it.err){ if (!o.has('s')) e += `grep: ${it.p}: ${it.err}\n`; continue; }
      if (!this.can(it.n,4)){ if (!o.has('s')) e += `grep: ${it.p}: Permission denied\n`; continue; }
      if (it.n.c.startsWith('\x7fELF')) continue;
      doText(it.n.c, it.p);
    }
    if (o.has('q') || o.has('quiet') || o.has('silent')) return {o:'', e: o.has('s') ? '' : e, code: matched ? 0 : (e ? 2 : 1)};
    return {o:out, e, code: e && !matched ? 2 : (matched?0:1)};
  }
  c_egrep(a,s){ return this.c_grep(['-E',...a],s); }
  c_sed(a, stdin){
    const o = this.opts(a, ['e']);
    let script = o.v.e || o.pos.shift();
    if (!script) return {e:'Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n',code:1};
    const apply = (txt)=>{
      let lines = txt.replace(/\n$/,'').split('\n');
      const m = script.match(/^(?:(\d+|\$)?|\/(.*?)\/)\s*([sdp])(.*)$/s);
      if (!m) return null;
      const [, lnum, addrRe, cmd, restS] = m;
      const sel = (l,i)=> lnum ? (lnum==='$'? i===lines.length-1 : i===+lnum-1) : addrRe ? new RegExp(addrRe).test(l) : true;
      if (cmd==='d') lines = lines.filter((l,i)=>!sel(l,i));
      else if (cmd==='p'){ const out=[]; lines.forEach((l,i)=>{ if (!o.has('n')) out.push(l); if (sel(l,i)) out.push(l); }); lines = out; }
      else if (cmd==='s'){
        const d = restS[0]; const parts = restS.slice(1).split(d);
        if (parts.length<2) return null;
        let [from, to, fl=''] = parts;
        const fromJs = from.replace(/\\\(|\\\)/g,m=>m[1]);
        const re = new RegExp(fromJs, (fl.includes('g')?'g':'')+(fl.includes('I')||fl.includes('i')?'i':''));
        const toJs = to.replace(/\\(\d)/g,'$$$1').replace(/&/g,'$$&');
        lines = lines.map((l,i)=> sel(l,i) ? l.replace(re, toJs) : l);
        if (o.has('n') && fl.includes('p')) lines = lines.filter((l,i)=>re.test(l));
      }
      return lines.join('\n')+(txt?'\n':'');
    };
    if (o.has('i')){
      let e='';
      for (const f of o.pos){ const n = this.node(f); if (!n){ e+=`sed: can't read ${f}: No such file or directory\n`; continue; } if (!this.can(n,2)){ e+=`sed: couldn't open temporary file ${f}: Permission denied\n`; continue; } const r = apply(n.c); if (r==null) return {e:`sed: -e expression #1, char 1: unknown command\n`,code:1}; n.c = r; n.mt=new Date(); }
      return {e,code:e?1:0};
    }
    let txt = o.pos.length ? o.pos.map(f=>this._readArg(f).txt||'').join('') : (stdin||'');
    const r = apply(txt);
    if (r==null) return {e:`sed: -e expression #1, char ${script.length}: unknown command\n`,code:1};
    return r;
  }
  c_awk(a, stdin){
    const o = this.opts(a, ['F']);
    const prog = o.pos.shift() || '';
    let txt = o.pos.length ? o.pos.map(f=>this._readArg(f).txt||'').join('') : (stdin||'');
    const fs = o.v.F;
    const m = prog.match(/^\s*(?:\/(.*?)\/|(\$\d+\s*[=!~<>]=?\s*"?[^"{]*"?|NR\s*[<>=]=?\s*\d+))?\s*\{\s*print\s*(.*?)\s*;?\s*\}\s*$/);
    const m2 = prog.match(/^\s*\/(.*?)\/\s*$/);
    if (!m && !m2) return {e:'awk: v simulátore funguje len tvar  awk [-F,] \'[/vzor/] {print $1, $3}\'\n',code:2};
    const lines = txt.replace(/\n$/,'').split('\n'); if (!txt) return '';
    let out=[];
    lines.forEach((l,ix)=>{
      const f = fs ? l.split(fs==='\\t'?'\t':fs) : l.trim().split(/\s+/);
      const get = k=> k===0 ? l : (f[k-1]||'');
      if (m2){ if (new RegExp(m2[1]).test(l)) out.push(l); return; }
      if (m[1] && !new RegExp(m[1]).test(l)) return;
      if (m[2]){
        const c = m[2].match(/^(\$(\d+)|NR)\s*([=!~<>]=?)\s*"?([^"]*)"?$/);
        if (c){ const lv = c[1]==='NR' ? ix+1 : get(+c[2]); const rv=c[4]; const op=c[3];
          const num = !isNaN(parseFloat(lv)) && !isNaN(parseFloat(rv));
          const L = num?parseFloat(lv):lv, Rv = num?parseFloat(rv):rv;
          const ok = op==='=='?L==Rv:op==='!='?L!=Rv:op==='~'?new RegExp(rv).test(lv):op==='>'?L>Rv:op==='<'?L<Rv:op==='>='?L>=Rv:op==='<='?L<=Rv:true;
          if (!ok) return; }
      }
      const expr = m[3].trim();
      if (!expr){ out.push(l); return; }
      const parts = expr.split(/\s*,\s*/).map(p=>{
        return p.split(/\s+/).map(tok=>{
          if (tok==='NR') return String(ix+1);
          if (tok==='NF') return String(f.length);
          if (tok==='$NF') return f[f.length-1];
          const mm = tok.match(/^\$(\d+)$/); if (mm) return get(+mm[1]);
          const s = tok.match(/^"(.*)"$/); if (s) return s[1];
          return tok;
        }).join('');
      });
      out.push(parts.join(' '));
    });
    return out.length ? out.join('\n')+'\n' : '';
  }
  c_find(a){
    let i = 0; const paths=[];
    while (i<a.length && !a[i].startsWith('-') && a[i]!=='!' && a[i]!=='(') paths.push(a[i++]);
    if (!paths.length) paths.push('.');
    const tests=[]; let maxd=Infinity, mind=0, exec=null, del=false, neg=false, ls=false, printOnly=false;
    for (; i<a.length; i++){
      const t=a[i], v=a[i+1];
      if (t==='!'||t==='-not'){ neg=true; continue; }
      const N = neg; neg=false;
      const add = f=>tests.push(N?(n,p,nm)=>!f(n,p,nm):f);
      if (t==='-name'){ const re=globToRe(v); add((n,p,nm)=>re.test(nm)); i++; }
      else if (t==='-iname'){ const re=new RegExp(globToRe(v).source,'i'); add((n,p,nm)=>re.test(nm)); i++; }
      else if (t==='-path'){ const re=globToRe(v); add((n,p)=>re.test(p)); i++; }
      else if (t==='-type'){ add(n=>n.t===(v==='f'?'f':v==='d'?'d':v==='l'?'l':'?')); i++; }
      else if (t==='-user'){ add(n=>n.u===v); i++; }
      else if (t==='-group'){ add(n=>n.g===v); i++; }
      else if (t==='-perm'){ const mode=parseInt(v.replace(/^[-/]/,''),8); add(n=> v.startsWith('-') ? (n.m&mode)===mode : v.startsWith('/') ? (n.m&mode)!==0 : (n.m&0o7777)===mode); i++; }
      else if (t==='-size'){ const m=v.match(/^([+-]?)(\d+)([kMGc]?)$/); const mul={k:1024,M:1048576,G:1073741824,c:1,'':512}[m[3]]; const lim=+m[2]*mul; add(n=>{ if (n.t!=='f') return false; const s=this._size(n); return m[1]==='+'?s>lim:m[1]==='-'?s<lim:Math.ceil(s/mul)===+m[2]; }); i++; }
      else if (t==='-mtime'||t==='-mmin'){ const m=v.match(/^([+-]?)(\d+)$/); const unit = t==='-mtime'?86400e3:60e3; add(n=>{ const age=(Date.now()-n.mt)/unit; return m[1]==='-'?age<+m[2]:m[1]==='+'?age>+m[2]+ (t==='-mtime'?1:0):Math.floor(age)===+m[2]; }); i++; }
      else if (t==='-empty'){ add(n=> n.t==='d'?!Object.keys(n.c).length : n.t==='f' && !n.c); }
      else if (t==='-maxdepth'){ maxd=+v; i++; }
      else if (t==='-mindepth'){ mind=+v; i++; }
      else if (t==='-newer'){ const r=this.node(v); add(n=>r && n.mt>r.mt); i++; }
      else if (t==='-context'){ const re=globToRe(v); add((n,p)=>re.test(this.ctxFull(n,p))); i++; }
      else if (t==='-exec'||t==='-ok'){ const end = a.indexOf(';', i); const end2 = a.indexOf('+', i); const e2 = end>=0?end:end2; exec = a.slice(i+1, e2); i = e2; }
      else if (t==='-delete') del=true;
      else if (t==='-print') printOnly=true;
      else if (t==='-ls') ls=true;
      else if (t==='-o'||t==='-or'||t==='-a'||t==='-and') { /* jednoduchý: -o ignorujeme presnú logiku */ if (t==='-o'||t==='-or'){ const prev = tests.pop(); i++; const nt = a[i], nv=a[i+1]; let f2=()=>false; if (nt==='-name'){ const re=globToRe(nv); f2=(n,p,nm)=>re.test(nm); i++; } else if (nt==='-type'){ f2=n=>n.t===nv; i++; } tests.push((n,p,nm)=>prev(n,p,nm)||f2(n,p,nm)); } }
      else return {e:`find: unknown predicate \`${t}'\n`,code:1};
    }
    let out='', e=''; const hits=[];
    const walk = (p, abs, n, depth)=>{
      const nm = depth===0 ? p : abs.split('/').pop();
      if (depth>=mind && tests.every(f=>f(n,abs,nm))) hits.push({p,n,abs});
      if (n.t==='d' && depth<maxd){
        if (!this.can(n,4) || !this.can(n,1)){ e += `find: ‘${p}’: Permission denied\n`; return; }
        for (const k of Object.keys(n.c).sort()) walk((p==='/'?'':p.replace(/\/$/,''))+'/'+k, (abs==='/'?'':abs)+'/'+k, n.c[k], depth+1);
      }
    };
    for (const p of paths){ const abs=this.norm(p); const n=this._lookup(abs,false); if (!n){ e+=`find: ‘${p}’: No such file or directory\n`; continue; } walk(p, abs, n.t==='l'&&p.endsWith('/')?this._lookup(abs):n, 0); }
    for (const h of hits){
      if (del){ const [d,b]=this.parentOf(h.abs); const dn=this._lookup(d); if (this.can(dn,2)) delete dn.c[b]; else e+=`find: cannot delete ‘${h.p}’: Permission denied\n`; continue; }
      if (exec){ const r = this.exec(exec.map(x=>x==='{}'?h.p:x), null, false); out += r.o||''; e += r.e||''; continue; }
      if (ls){ out += `${pad(this._ino(h.n),8)}      4 ${permStr(h.n.t,h.n.m)}   1 ${pad(h.n.u,8,true)} ${pad(h.n.g,8,true)} ${pad(this._size(h.n),8)} ${lsDate(h.n.mt)} ${h.p}\n`; continue; }
      out += h.p+'\n';
    }
    return {o:out, e, code:e?1:0};
  }
  c_locate(a){ return {e:'bash: locate: command not found\n(locate je v balíku mlocate/plocate a potrebuje databázu: sudo updatedb. Na RHEL bežne používaj find.)\n',code:127}; }
  c_diff(a){ const [x,y]=a.filter(v=>!v.startsWith('-')); const A=this._readArg(x), B=this._readArg(y); if (A.err||B.err) return {e:'diff: '+(A.err||B.err)+'\n',code:2}; if (A.txt===B.txt) return {o:'',code:0}; const la=A.txt.split('\n'), lb=B.txt.split('\n'); let o=''; const n=Math.max(la.length,lb.length); for (let i=0;i<n;i++){ if (la[i]!==lb[i]){ o+=`${i+1}c${i+1}\n`+(la[i]!=null?'< '+la[i]+'\n':'')+'---\n'+(lb[i]!=null?'> '+lb[i]+'\n':''); } } return {o,code:1}; }

  /* ---------------- permissions ---------------- */
  c_chmod(a){
    const o = this.opts(a.filter(x=>!/^[-+=]?[rwxXst]+$/.test(x) || x.startsWith('-R')).filter(x=>!/^[ugoa]*[-+=]/.test(x) || x.startsWith('-')));
    const modeArg = a.find(x=>/^[0-7]{3,4}$/.test(x) || /^[ugoa]*[-+=][rwxXst]*(,[ugoa]*[-+=][rwxXst]*)*$/.test(x));
    const files = a.filter(x=>x!==modeArg && !/^-[Rvcf]+$/.test(x));
    if (!modeArg) return {e:"chmod: missing operand\nTry 'chmod --help' for more information.\n",code:1};
    let e='', out='';
    const applyMode = (n)=>{
      if (/^[0-7]+$/.test(modeArg)){ n.m = (n.m & ~0o7777) | parseInt(modeArg,8); return; }
      for (const clause of modeArg.split(',')){
        const m = clause.match(/^([ugoa]*)([-+=])([rwxXst]*)$/);
        let who = m[1] || 'a'; if (who.includes('a')) who='ugo';
        let bits = 0;
        for (const w of who){
          const sh = w==='u'?6:w==='g'?3:0;
          for (const p of m[3]){
            if (p==='r') bits |= 4<<sh; if (p==='w') bits |= 2<<sh; if (p==='x' || (p==='X' && (n.t==='d' || n.m&0o111))) bits |= 1<<sh;
            if (p==='s' && w==='u') bits |= 0o4000; if (p==='s' && w==='g') bits |= 0o2000; if (p==='t') bits |= 0o1000;
          }
        }
        if (m[2]==='+') n.m |= bits;
        else if (m[2]==='-') n.m &= ~bits;
        else { let mask=0; for (const w of who) mask |= 7 << (w==='u'?6:w==='g'?3:0); n.m = (n.m & ~mask) | bits; }
      }
    };
    const rec = a.some(x=>/^-[a-zA-Z]*R/.test(x));
    for (const f of files){
      const n = this.node(f);
      if (!n){ e += `chmod: cannot access '${f}': No such file or directory\n`; continue; }
      if (this.user!=='root' && n.u!==this.user){ e += `chmod: changing permissions of '${f}': Operation not permitted\n`; continue; }
      const go = (x)=>{ applyMode(x); if (rec && x.t==='d') Object.values(x.c).forEach(go); };
      go(n);
      if (a.includes('-v')) out += `mode of '${f}' changed to 0${(n.m&0o7777).toString(8).padStart(3,'0')} (${permStr(n.t,n.m).slice(1)})\n`;
    }
    return {o:out,e,code:e?1:0};
  }
  c_chown(a, stdin, piped, grpOnly){
    const rec = a.some(x=>/^-[a-zA-Z]*R/.test(x));
    const rest = a.filter(x=>!x.startsWith('-'));
    const spec = rest.shift(); let e='';
    if (!spec || !rest.length) return {e:`${grpOnly?'chgrp':'chown'}: missing operand\n`,code:1};
    let u=null, g=null;
    if (grpOnly) g = spec; else { const p = spec.split(/[:.]/); u = p[0]||null; g = p.length>1 ? (p[1]||null) : null; if (spec.endsWith(':') && u){ const uu=this.users[u]; g = Object.entries(this.groups).find(([n,x])=>x.gid===uu?.gid)?.[0]; } }
    if (u && u!=='root' && !this.users[u] && !this.sysusers.find(x=>x[0]===u)) return {e:`chown: invalid user: ‘${spec}’\n`,code:1};
    if (g && !this.groups[g]) return {e:`${grpOnly?'chgrp':'chown'}: invalid group: ‘${spec}’\n`,code:1};
    for (const f of rest){
      const n = this.node(f);
      if (!n){ e+=`chown: cannot access '${f}': No such file or directory\n`; continue; }
      if (this.user!=='root' && (u || n.u!==this.user || !this.inGroup(g))){ e+=`${grpOnly?'chgrp':'chown'}: changing ownership of '${f}': Operation not permitted\n`; continue; }
      const go = x=>{ if (u) x.u=u; if (g) x.g=g; if (rec && x.t==='d') Object.values(x.c).forEach(go); };
      go(n);
    }
    return {e,code:e?1:0};
  }
  c_chgrp(a,s,p){ return this.c_chown(a,s,p,true); }
  c_umask(a){ if (a[0]) { this._umask = a[0]; return ''; } return (this._umask || (this.user==='root'?'0022':'0002'))+'\n'; }
  c_getfacl(a){
    const f = a.filter(x=>!x.startsWith('-'))[0]; const n = this.node(f);
    if (!n) return {e:`getfacl: ${f}: No such file or directory\n`,code:1};
    const p = v=>((v&4?'r':'-')+(v&2?'w':'-')+(v&1?'x':'-'));
    let s = `# file: ${f.replace(/^\//,'')}\n# owner: ${n.u}\n# group: ${n.g}\nuser::${p(n.m>>6&7)}\n`;
    (n.acl||[]).filter(x=>x.k==='u').forEach(x=>s+=`user:${x.n}:${p(x.p)}\n`);
    s += `group::${p(n.m>>3&7)}\n`;
    (n.acl||[]).filter(x=>x.k==='g').forEach(x=>s+=`group:${x.n}:${p(x.p)}\n`);
    if (n.acl && n.acl.length) s += `mask::${p(7)}\n`;
    s += `other::${p(n.m&7)}\n\n`;
    return s;
  }
  c_setfacl(a){
    const o = this.opts(a,['m','x']);
    const f = o.pos[0]; const n = this.node(f);
    if (!n) return {e:`setfacl: ${f}: No such file or directory\n`,code:1};
    if (this.user!=='root' && n.u!==this.user) return {e:`setfacl: ${f}: Operation not permitted\n`,code:1};
    n.acl = n.acl || [];
    if (o.has('b')){ n.acl=[]; return ''; }
    if (o.v.m){ const [k,nm,perm] = o.v.m.split(':'); const kk = k[0]; if (kk==='u' && !this.users[nm]) return {e:`setfacl: Option -m: Invalid argument near character 3\n`,code:1}; const pv = (perm.includes('r')?4:0)|(perm.includes('w')?2:0)|(perm.includes('x')?1:0); n.acl = n.acl.filter(x=>!(x.k===kk&&x.n===nm)); n.acl.push({k:kk,n:nm,p:pv}); }
    if (o.v.x){ const [k,nm] = o.v.x.split(':'); n.acl = n.acl.filter(x=>!(x.k===k[0]&&x.n===nm)); }
    return '';
  }

  /* ---------------- users ---------------- */
  _needRoot(cmd){ return this.user!=='root' ? {e:`${cmd}: Permission denied.\n${cmd}: cannot lock /etc/passwd; try again later.\n(tip: tento príkaz potrebuje root, skús sudo ${cmd} …)\n`,code:1} : null; }
  c_useradd(a){
    const nr = this._needRoot('useradd'); if (nr) return nr;
    const o = this.opts(a,['G','g','s','c','d','u','e']);
    const nm = o.pos[0];
    if (!nm) return {e:'Usage: useradd [options] LOGIN\n',code:2};
    if (this.users[nm] || this.sysusers.find(x=>x[0]===nm)) return {e:`useradd: user '${nm}' already exists\n`,code:9};
    const uid = o.v.u ? +o.v.u : 1000 + Object.keys(this.users).length;
    let gid = uid;
    if (o.v.g){ if (!this.groups[o.v.g]) return {e:`useradd: group '${o.v.g}' does not exist\n`,code:6}; gid = this.groups[o.v.g].gid; }
    else { if (this.groups[nm]) return {e:`useradd: group ${nm} exists - if you want to add this user to that group, use -g.\n`,code:9}; this.groups[nm] = {gid, mem:[]}; }
    if (o.v.G){ for (const g of o.v.G.split(',')) if (!this.groups[g]) return {e:`useradd: group '${g}' does not exist\n`,code:6}; }
    const home = o.v.d || '/home/'+nm;
    this.users[nm] = {uid, gid, home, shell:o.v.s||'/bin/bash', gecos:o.v.c||'', pw:false};
    if (o.v.G) o.v.G.split(',').forEach(g=>this.groups[g].mem.push(nm));
    if (!o.has('M')){ const h = this._mkPath(home,'d',0o700,nm,o.v.g||nm); h.mt=new Date(); h.ctx=this.defaultCtx(home); const b=this._mkPath(home+'/.bashrc','f',0o644,nm,o.v.g||nm,'# .bashrc\n'); b.ctx='user_home_t'; }
    this._refreshAccountFiles();
    return '';
  }
  c_usermod(a){
    const nr = this._needRoot('usermod'); if (nr) return nr;
    const o = this.opts(a,['G','g','s','c','d','e','l']);
    const nm = o.pos[0]; const u = this.users[nm];
    if (!u) return {e:`usermod: user '${nm||''}' does not exist\n`,code:6};
    if (o.v.G){
      for (const g of o.v.G.split(',')) if (!this.groups[g]) return {e:`usermod: group '${g}' does not exist\n`,code:6};
      if (!o.has('a')) Object.values(this.groups).forEach(g=>{ g.mem = g.mem.filter(m=>m!==nm); });
      o.v.G.split(',').forEach(g=>{ if (!this.groups[g].mem.includes(nm)) this.groups[g].mem.push(nm); });
    }
    if (o.v.s) u.shell = o.v.s;
    if (o.v.c) u.gecos = o.v.c;
    if (o.has('L')) u.locked = true;
    if (o.has('U')) u.locked = false;
    this._refreshAccountFiles();
    return '';
  }
  c_userdel(a){
    const nr = this._needRoot('userdel'); if (nr) return nr;
    const o = this.opts(a); const nm = o.pos[0]; const u = this.users[nm];
    if (!u) return {e:`userdel: user '${nm}' does not exist\n`,code:6};
    if (nm===this.prevUser || nm==='admin') return {e:`userdel: user ${nm} is currently used by process 2210\n`,code:8};
    delete this.users[nm];
    Object.values(this.groups).forEach(g=>g.mem=g.mem.filter(m=>m!==nm));
    if (this.groups[nm] && this.groups[nm].gid===u.gid) delete this.groups[nm];
    if (o.has('r')){ const [d,b]=this.parentOf(u.home); const dn=this._lookup(d); if (dn) delete dn.c[b]; }
    this._refreshAccountFiles();
    return '';
  }
  c_groupadd(a){
    const nr = this._needRoot('groupadd'); if (nr) return nr;
    const o=this.opts(a,['g']); const nm=o.pos[0];
    if (this.groups[nm]) return {e:`groupadd: group '${nm}' already exists\n`,code:9};
    this.groups[nm] = {gid: o.v.g ? +o.v.g : 1000 + Object.keys(this.groups).length + 5, mem:[]};
    this._refreshAccountFiles(); return '';
  }
  c_gpasswd(a){ const nr=this._needRoot('gpasswd'); if (nr) return nr; const o=this.opts(a,['a','d']); const g=this.groups[o.pos[0]]; if (!g) return {e:`gpasswd: group '${o.pos[0]}' does not exist in /etc/group\n`,code:3}; if (o.v.a){ if (!g.mem.includes(o.v.a)) g.mem.push(o.v.a); this._refreshAccountFiles(); return `Adding user ${o.v.a} to group ${o.pos[0]}\n`; } if (o.v.d){ g.mem=g.mem.filter(m=>m!==o.v.d); this._refreshAccountFiles(); return `Removing user ${o.v.d} from group ${o.pos[0]}\n`; } return ''; }
  c_passwd(a, stdin){
    const o = this.opts(a); const nm = o.pos[0] || this.user;
    if (nm!==this.user && this.user!=='root') return {e:'passwd: Only root can specify a user name.\n',code:1};
    const u = this.users[nm]; if (!u) return {e:`passwd: Unknown user name '${nm}'.\n`,code:1};
    if (o.has('l')){ u.locked=true; return `Locking password for user ${nm}.\npasswd: Success\n`; }
    if (o.has('u')){ u.locked=false; return `Unlocking password for user ${nm}.\npasswd: Success\n`; }
    if (o.has('S')) return `${nm} ${u.locked?'LK':u.pw?'PS':'NP'} 2026-11-01 0 99999 7 -1 (${u.locked?'Password locked.':u.pw?'Password set, SHA512 crypt.':'Empty password.'})\n`;
    if (o.has('e')){ u.expired=true; return `Expiring password for user ${nm}.\npasswd: Success\n`; }
    u.pw = true; this._refreshAccountFiles();
    return `Changing password for user ${nm}.\nNew password: ********\nRetype new password: ********\npasswd: all authentication tokens updated successfully.\n(v simulátore sa heslo nastaví automaticky)\n`;
  }
  c_chpasswd(a, stdin){ const nr=this._needRoot('chpasswd'); if (nr) return nr; (stdin||'').trim().split('\n').forEach(l=>{ const [u]=l.split(':'); if (this.users[u]) this.users[u].pw=true; }); this._refreshAccountFiles(); return ''; }
  c_chage(a){
    const o = this.opts(a,['M','m','W','E','d']); const nm=o.pos[0]; const u=this.users[nm];
    if (!u) return {e:`chage: user '${nm}' does not exist in /etc/passwd\n`,code:1};
    if (o.has('l')) return `Last password change\t\t\t\t\t: Nov 01, 2026\nPassword expires\t\t\t\t\t: ${u.maxdays&&u.maxdays<99999?'Jan 30, 2027':'never'}\nPassword inactive\t\t\t\t\t: never\nAccount expires\t\t\t\t\t\t: never\nMinimum number of days between password change\t\t: 0\nMaximum number of days between password change\t\t: ${u.maxdays||99999}\nNumber of days of warning before password expires\t: 7\n`;
    const nr=this._needRoot('chage'); if (nr) return nr;
    if (o.v.M) u.maxdays = +o.v.M;
    if (o.v.d==='0') u.expired = true;
    this._refreshAccountFiles(); return '';
  }
  c_su(a){ const t = a.filter(x=>x!=='-')[0] || 'root'; if (t==='root' && this.user!=='root') return {e:'Password: \nsu: Authentication failure\n(tip: na RHEL je root heslo často zamknuté, použi sudo -i)\n',code:1}; if (!this.users[t]) return {e:`su: user ${t} does not exist or the user entry does not contain all the required fields\n`,code:1}; this.prevUser=this.user; this.prevCwd=this.cwd; this.user=t; this.rootShell=true; this.cwd = a.includes('-') ? this.users[t].home : this.cwd; return ''; }
  c_visudo(a){ if (this.user!=='root') return {e:'visudo: /etc/sudoers: Permission denied\n',code:1}; if (a.includes('-c')) return '/etc/sudoers: parsed OK\n'+Object.keys(this._lookup('/etc/sudoers.d').c).map(k=>`/etc/sudoers.d/${k}: parsed OK`).join('\n')+(Object.keys(this._lookup('/etc/sudoers.d').c).length?'\n':''); return {o:'\x1bEDITR /etc/sudoers'}; }

  /* ---------------- processes ---------------- */
  _procList(){
    const base = [
      ['root',1,0.0,0.4,'Ss','/usr/lib/systemd/systemd --switched-root --system --deserialize 31'],
      ['root',2,0.0,0.0,'S','[kthreadd]'],
      ['root',612,0.0,0.6,'Ss','/usr/lib/systemd/systemd-journald'],
      ['root',641,0.0,0.3,'Ss','/usr/lib/systemd/systemd-udevd']];
    const p = [];
    const s = this.svc;
    if (s.auditd.active) p.push(['root',768,0.0,0.1,'S<sl','/sbin/auditd']);
    if (s.NetworkManager.active) p.push(['root',903,0.0,0.5,'Ssl','/usr/sbin/NetworkManager --no-daemon']);
    if (s.firewalld.active) p.push(['root',788,0.1,1.1,'Ssl','/usr/bin/python3 -s /usr/sbin/firewalld --nofork --nopid']);
    if (s.chronyd.active) p.push(['chrony',812,0.0,0.1,'S','/usr/sbin/chronyd -F 2']);
    if (s.sshd.active) p.push(['root',1032,0.0,0.2,'Ss','sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups']);
    if (s.crond.active) p.push(['root',1040,0.0,0.1,'Ss','/usr/sbin/crond -n']);
    if (s.rsyslog.active) p.push(['root',1022,0.0,0.2,'Ssl','/usr/sbin/rsyslogd -n']);
    if (s.httpd.active){ p.push(['root',3010,0.0,0.3,'Ss','/usr/sbin/httpd -DFOREGROUND']); for (let k=0;k<3;k++) p.push(['apache',3011+k,0.0,0.4,'Sl','/usr/sbin/httpd -DFOREGROUND']); }
    if (s.nginx.active) p.push(['root',3110,0.0,0.2,'Ss','nginx: master process /usr/sbin/nginx'],['nginx',3111,0.0,0.3,'S','nginx: worker process']);
    if (s.mariadb.active) p.push(['mysql',3220,0.3,4.2,'Ssl','/usr/libexec/mariadbd --basedir=/usr']);
    p.push(['root',2208,0.0,0.3,'Ss','sshd: admin [priv]'],['admin',2210,0.0,0.2,'S','sshd: admin@pts/0'],['admin',2211,0.0,0.1,'Ss','-bash']);
    p.push(...this.procs.map(x=>[x.u,x.pid,x.cpu,x.mem,x.stat||'S',x.cmd]));
    return base.concat(p);
  }
  c_ps(a){
    const L = this._procList();
    const s = a.join(' ');
    if (/aux|-aux|axu/.test(s)){
      return 'USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n' + L.map(([u,pid,c,m,st,cmd])=>`${pad(u,8,true)} ${pad(pid,7)} ${pad(c.toFixed(1),4)} ${pad(m.toFixed(1),4)} ${pad(Math.round(m*38000+170000),6)} ${pad(Math.round(m*38000),5)} ${pad(cmd.includes('pts')||cmd==='-bash'||u==='admin'?'pts/0':'?',8,true)} ${pad(st,4,true)} 08:00   0:0${pid%6} ${cmd}`).join('\n')+'\n';
    }
    if (/-ef|-e -f/.test(s)){
      return 'UID          PID    PPID  C STIME TTY          TIME CMD\n'+L.map(([u,pid,c,m,st,cmd])=>`${pad(u,8,true)} ${pad(pid,7)} ${pad(pid<3?0:1,7)}  0 08:00 ${pad(u==='admin'?'pts/0':'?',8,true)} 00:00:0${pid%6} ${cmd}`).join('\n')+'\n';
    }
    if (a.includes('-u')){ const u=a[a.indexOf('-u')+1]; return '    PID TTY          TIME CMD\n'+L.filter(x=>x[0]===u).map(x=>`${pad(x[1],7)} ?        00:00:00 ${x[5].split(' ')[0].split('/').pop()}`).join('\n')+'\n'; }
    if (a.includes('-C')){ const c=a[a.indexOf('-C')+1]; const r=L.filter(x=>x[5].split(' ')[0].split('/').pop()===c||x[5].startsWith(c)); return '    PID TTY          TIME CMD\n'+r.map(x=>`${pad(x[1],7)} ?        00:00:00 ${c}`).join('\n')+(r.length?'\n':''); }
    return '    PID TTY          TIME CMD\n   2211 pts/0    00:00:00 bash\n'+this.procs.filter(p=>p.u===this.user).map(p=>`${pad(p.pid,7)} pts/0    00:00:00 ${p.cmd.split(' ')[0]}\n`).join('')+'   3401 pts/0    00:00:00 ps\n';
  }
  c_pgrep(a){ const o=this.opts(a); const pat=o.pos[0]; const r=this._procList().filter(x=>x[5].includes(pat)); return {o: r.map(x=>o.has('l')?x[1]+' '+x[5].split(' ')[0].split('/').pop():String(x[1])).join('\n')+(r.length?'\n':''), code:r.length?0:1}; }
  c_top(a){
    const L = this._procList().slice().sort((x,y)=>y[2]-x[2]||y[3]-x[3]).slice(0,12);
    const d=new Date();
    return `top - ${z2(d.getHours())}:${z2(d.getMinutes())}:${z2(d.getSeconds())} up 1 day,  2:14,  1 user,  load average: 0.18, 0.24, 0.21\nTasks: 214 total,   1 running, 213 sleeping,   0 stopped,   0 zombie\n%Cpu(s):  1.3 us,  0.7 sy,  0.0 ni, 97.8 id,  0.2 wa,  0.0 hi,  0.0 si,  0.0 st\nMiB Mem :   3755.0 total,    598.0 free,   1080.2 used,   2347.5 buff/cache\nMiB Swap:   4096.0 total,   4096.0 free,      0.0 used.   2333.0 avail Mem\n\n    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n`+L.map(([u,pid,c,m,st,cmd])=>`${pad(pid,7)} ${pad(u,8,true)}  20   0 ${pad(Math.round(m*38000+170000),7)} ${pad(Math.round(m*38000),6)} ${pad(Math.round(m*9000),6)} ${st[0]}  ${pad(c.toFixed(1),4)}  ${pad(m.toFixed(1),4)}   0:0${pid%6}.12 ${cmd.split(' ')[0].split('/').pop()}`).join('\n')+'\n(top je interaktívny: q = koniec, P = podľa CPU, M = podľa RAM, k = kill. Tu vidíš jeden snímok.)\n';
  }
  c_htop(){ return {e:'bash: htop: command not found\n(htop nie je v repozitároch RHEL, je v EPEL. Na RHEL použi top.)\n',code:127}; }
  c_kill(a){
    if (a[0]==='-l') return ' 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 9) SIGKILL\t15) SIGTERM\t18) SIGCONT\t19) SIGSTOP\n';
    const pids = a.filter(x=>/^\d+$/.test(x)).map(Number);
    let e='';
    for (const pid of pids){
      const p = this.procs.find(x=>x.pid===pid);
      const sys = this._procList().find(x=>x[1]===pid);
      if (!sys){ e+=`-bash: kill: (${pid}) - No such process\n`; continue; }
      if (sys[0]!==this.user && this.user!=='root'){ e+=`-bash: kill: (${pid}) - Operation not permitted\n`; continue; }
      if (p){ this.procs = this.procs.filter(x=>x.pid!==pid); this.killed=(this.killed||[]).concat({pid, sig: a.find(x=>x.startsWith('-'))||'-15'}); }
      else if (pid===1) e+='(PID 1 je systemd, ten nezabiješ)\n';
    }
    return {e,code:e?1:0};
  }
  c_pkill(a){ const pat=a.filter(x=>!x.startsWith('-'))[0]; const before=this.procs.length; this.procs=this.procs.filter(x=>!x.cmd.includes(pat) || (x.u!==this.user && this.user!=='root')); return {code: before!==this.procs.length?0:1}; }
  c_killall(a){ return this.c_pkill(a); }
  c_sleep(a){ return ''; }
  c_nice(a){ return 'nice: v simulátore len ukážka. Reálne: nice -n 10 prikaz (vyššie číslo = nižšia priorita, -20 až 19)\n'; }
  c_renice(a){ return `${a[a.length-1]} (process ID) old priority 0, new priority ${a[1]||a[0]}\n`; }
  c_jobs(){ return this.jobs.map((j,i)=>`[${i+1}]${i===this.jobs.length-1?'+':'-'}  ${j.st.padEnd(23)}${j.cmd}`).join('\n')+(this.jobs.length?'\n':''); }
  c_free(a){
    const h = a.some(x=>x.includes('h'));
    const r = h ? ['3.7Gi','1.1Gi','598Mi','24Mi','2.3Gi','2.3Gi','4.0Gi','0B','4.0Gi'] : ['3845120','1106164','612344','24576','2403772','2389012','4194300','0','4194300'];
    return `               total        used        free      shared  buff/cache   available\nMem:     ${pad(r[0],11)} ${pad(r[1],11)} ${pad(r[2],11)} ${pad(r[3],11)} ${pad(r[4],11)} ${pad(r[5],11)}\nSwap:    ${pad(r[6],11)} ${pad(r[7],11)} ${pad(r[8],11)}\n`;
  }
  c_df(a){
    const o=this.opts(a); const h = o.has('h'), T = o.has('T');
    const fmt = g=> h ? (g<1? Math.round(g*1024)+'M' : (g<10? g.toFixed(1):Math.round(g))+'G') : String(Math.round(g*1048576));
    let rows = this.mounts.slice();
    if (o.pos.length){ rows = o.pos.map(p=>{ const abs=this.norm(p); return rows.filter(m=>abs===m.dir||abs.startsWith(m.dir==='/'?'/':m.dir+'/')).sort((x,y)=>y.dir.length-x.dir.length)[0]; }).filter(Boolean); }
    let s = `Filesystem             ${T?'Type     ':''}${h?' Size  Used Avail Use%':'1K-blocks    Used Available Use%'} Mounted on\n`;
    for (const m of rows) s += `${pad(m.dev,22,true)} ${T?pad(m.fs,8,true)+' ':''}${pad(fmt(m.size),h?5:9)} ${pad(fmt(m.used),h?5:7)} ${pad(fmt(m.size-m.used),h?5:9)} ${pad(Math.round(m.used/m.size*100)+'%',4)} ${m.dir}\n`;
    return s;
  }
  c_du(a){
    const o=this.opts(a,['d','max-depth']);
    const tg = o.pos.length?o.pos:['.']; let out='', e='';
    const sz = n=> n.t==='d' ? 4096 + Object.values(n.c).reduce((s,x)=>s+sz(x),0) : this._size(n) + (n.big?0:0);
    const fmt = b=> o.has('h') ? human(Math.max(4096,b)).replace(/^(\d+)$/,'$1') : String(Math.ceil(b/1024));
    for (const t of tg){
      const n=this.node(t); if (!n){ e+=`du: cannot access '${t}': No such file or directory\n`; continue; }
      if (!this.can(n,4)){ e+=`du: cannot read directory '${t}': Permission denied\n`; continue; }
      if (o.has('s')) { out += fmt(sz(n))+'\t'+t+'\n'; continue; }
      const depth = o.v.d!=null ? +o.v.d : o.v['max-depth']!=null ? +o.v['max-depth'] : 99;
      if (n.t!=='d'){ out += fmt(sz(n))+'\t'+t+'\n'; continue; }
      const walk=(x,p,d)=>{ if (x.t!=='d') return; for (const [k,ch] of Object.entries(x.c)) if (ch.t==='d' && this.can(ch,4)) walk(ch,p.replace(/\/$/,'')+'/'+k,d+1); if (d<=depth) out+=fmt(sz(x))+'\t'+p+'\n'; };
      walk(n,t,0);
    }
    return {o:out,e};
  }
  c_lscpu(){ return 'Architecture:            x86_64\n  CPU op-mode(s):        32-bit, 64-bit\nCPU(s):                  2\nVendor ID:               GenuineIntel\n  Model name:            Intel(R) Xeon(R) Gold 6338 CPU @ 2.00GHz\nVirtualization features:\n  Hypervisor vendor:     VMware\n'; }
  c_vmstat(){ return 'procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----\n r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st\n 1  0      0 612344   4120 2399652    0    0     3    11   92  150  1  1 98  0  0\n'; }

  /* ---------------- systemd ---------------- */
  _svcName(n){ return (n||'').replace(/\.service$/,'').replace(/\.socket$/,''); }
  c_systemctl(a){
    const o = this.opts(a,['type','state']);
    const sub = o.pos[0]; const units = o.pos.slice(1);
    const st = (k)=>this.svc[k];
    if (!sub || sub==='list-units' || sub==='list-unit-files'){
      const rows = Object.entries(this.svc).filter(([k,s])=>s.installed).filter(([k,s])=> sub==='list-unit-files' ? true : (o.has('all') || s.active || s.failed)).filter(([k,s])=>!o.v.state || (o.v.state==='failed'?s.failed:o.v.state==='running'?s.active:o.v.state==='enabled'?s.enabled:true));
      if (sub==='list-unit-files') return 'UNIT FILE                    STATE    PRESET\n'+rows.map(([k,s])=>`${pad(k+'.service',28,true)} ${pad(s.enabled?'enabled':'disabled',8,true)} ${['sshd','firewalld','chronyd','crond','NetworkManager','rsyslog','auditd'].includes(k)?'enabled':'disabled'}`).join('\n')+`\n\n${rows.length} unit files listed.\n`;
      return '  UNIT                       LOAD   ACTIVE SUB     DESCRIPTION\n'+rows.map(([k,s])=>`${s.failed?'●':' '} ${pad(k+'.service',26,true)} loaded ${pad(s.failed?'failed':s.active?'active':'inactive',6,true)} ${pad(s.failed?'failed':s.active?'running':'dead',7,true)} ${SVC_DEF[k].desc}`).join('\n')+`\n\nLOAD   = Reflects whether the unit definition was properly loaded.\nACTIVE = The high-level unit activation state, i.e. generalization of SUB.\nSUB    = The low-level unit activation state, values depend on unit type.\n${rows.length} loaded units listed.\n`;
    }
    if (sub==='--failed' || o.has('failed')){ return this.c_systemctl(['list-units','--state=failed']); }
    if (sub==='daemon-reload'){ if (this.user!=='root') return {e:'Failed to reload daemon: Access denied\n',code:1}; this.daemonReloaded=true; return ''; }
    if (sub==='get-default') return (this.target||'multi-user.target')+'\n';
    if (sub==='set-default'){ if (this.user!=='root') return {e:'Failed to set default target: Access denied\n',code:1}; this.target=units[0]; return `Removed "/etc/systemd/system/default.target".\nCreated symlink /etc/systemd/system/default.target → /usr/lib/systemd/system/${units[0]}.\n`; }
    if (sub==='reboot'||sub==='poweroff') return {e:'(v simulátore sa reštart nevykoná; na reálnom serveri si najprv over, či sa ti to naozaj hodí)\n',code:0};
    if (!units.length) return {e:`Too few arguments.\n`,code:1};
    let out='', e='', code=0;
    for (const u0 of units){
      const k = this._svcName(u0);
      const s = st(k);
      if (!s || !s.installed){ if (sub==='status') { e += `Unit ${k}.service could not be found.\n`; code=4; } else { e += `Failed to ${sub} ${k}.service: Unit ${k}.service not found.\n`; code=5; } continue; }
      const needRoot = ['start','stop','restart','reload','enable','disable','mask','unmask','try-restart','reload-or-restart'].includes(sub);
      if (needRoot && this.user!=='root'){ e += `Failed to ${sub} ${k}.service: Access denied\nSee system logs and 'systemctl status ${k}.service' for details.\n(tip: sudo systemctl ${sub} ${k})\n`; code=1; continue; }
      if (s.masked && ['start','restart','enable'].includes(sub)){ e += `Failed to ${sub} ${k}.service: Unit ${k}.service is masked.\n`; code=1; continue; }
      switch(sub){
        case 'start': case 'restart': case 'reload-or-restart': case 'try-restart':
          if (k==='agent' && !this.node('/opt/monitoring/bin/agent').m.toString(8).match(/7.$|5.$/) && !(this.node('/opt/monitoring/bin/agent').m & 0o100)){ s.active=false; s.failed=true; e+=`Job for agent.service failed because the control process exited with error code.\nSee "systemctl status agent.service" and "journalctl -xeu agent.service" for details.\n`; code=1; break; }
          if (k==='httpd' && this.httpdPortBad()){ s.active=false; s.failed=true; e+='Job for httpd.service failed because the control process exited with error code.\nSee "systemctl status httpd.service" and "journalctl -xeu httpd.service" for details.\n'; code=1; break; }
          s.active=true; s.failed=false; s.since=new Date(); break;
        case 'stop': s.active=false; s.failed=false; break;
        case 'reload': if (!s.active){ e+=`${k}.service is not active, cannot reload.\n`; code=1; } break;
        case 'enable':
          s.enabled=true; out += `Created symlink /etc/systemd/system/multi-user.target.wants/${k}.service → ${SVC_DEF[k].unit}.\n`;
          if (o.has('now')){ s.active=true; s.failed=false; s.since=new Date(); }
          break;
        case 'disable': s.enabled=false; out += `Removed "/etc/systemd/system/multi-user.target.wants/${k}.service".\n`; if (o.has('now')) s.active=false; break;
        case 'mask': s.masked=true; s.enabled=false; out+=`Created symlink /etc/systemd/system/${k}.service → /dev/null.\n`; break;
        case 'unmask': s.masked=false; out+=`Removed "/etc/systemd/system/${k}.service".\n`; break;
        case 'is-active': out += (s.failed?'failed':s.active?'active':'inactive')+'\n'; if (!s.active) code=3; break;
        case 'is-enabled': out += (s.masked?'masked':s.enabled?'enabled':'disabled')+'\n'; if (!s.enabled) code=1; break;
        case 'is-failed': out += (s.failed?'failed':s.active?'active':'inactive')+'\n'; if (!s.failed) code=1; break;
        case 'cat': out += `# ${SVC_DEF[k].unit}\n`+(this.read(SVC_DEF[k].unit)||'')+'\n'; break;
        case 'status': {
          const d = SVC_DEF[k];
          const dot = s.failed?'×':s.active?'●':'○';
          const since = s.since.toString().slice(0,24);
          out += `${dot} ${k}.service - ${d.desc}\n     Loaded: loaded (${d.unit}; ${s.masked?'masked':s.enabled?'enabled':'disabled'}; preset: ${['sshd','firewalld','chronyd','crond','NetworkManager','rsyslog','auditd'].includes(k)?'enabled':'disabled'})\n     Active: ${s.failed?'failed (Result: exit-code)':s.active?'active (running)':'inactive (dead)'}${s.active||s.failed?' since '+since+' CET':''}\n`;
          if (k==='agent' && s.failed) out += `    Process: 2034 ExecStart=/opt/monitoring/bin/agent --config /opt/monitoring/agent.conf (code=exited, status=203/EXEC)\n   Main PID: 2034 (code=exited, status=203/EXEC)\n\n${lsDate(new Date()).slice(0,6)} 09:44:12 ${this.hostname} systemd[1]: agent.service: Failed at step EXEC spawning /opt/monitoring/bin/agent: Permission denied\n${lsDate(new Date()).slice(0,6)} 09:44:12 ${this.hostname} systemd[1]: agent.service: Main process exited, code=exited, status=203/EXEC\n`;
          else if (k==='httpd' && s.failed) out += `\n${lsDate(new Date()).slice(0,6)} 11:02:10 ${this.hostname} httpd[3301]: (13)Permission denied: AH00072: make_sock: could not bind to address 0.0.0.0:${this.httpdPort}\n${lsDate(new Date()).slice(0,6)} 11:02:10 ${this.hostname} systemd[1]: httpd.service: Failed with result 'exit-code'.\n`;
          else if (s.active) { const pid = (this._procList().find(x=>x[5].includes(d.proc))||[0,1000+k.length*37])[1]; out += `   Main PID: ${pid} (${d.proc})\n      Tasks: ${k==='httpd'?177:3} (limit: 23012)\n     Memory: ${(2+k.length*1.3).toFixed(1)}M\n        CPU: ${k.length*21}ms\n     CGroup: /system.slice/${k}.service\n             └─${pid} ${d.proc}\n`; }
          if (!s.active) code = 3;
          break;
        }
        default: e += `Unknown command verb ${sub}.\n`; code=1;
      }
    }
    return {o:out, e, code};
  }
  httpdPortBad(){ const conf = this.read('/etc/httpd/conf/httpd.conf')||''; const m = conf.match(/^Listen\s+(\d+)/m); this.httpdPort = m?+m[1]:80; return !this._sePortAllowed('http_port_t', this.httpdPort) && this.se.mode==='Enforcing'; }
  _sePortAllowed(type, port){
    const base = (this.se.ports[type]||[]).join(',');
    if (base.split(/[ ,]+/).some(x=>x===String(port))) return true;
    return this.se.extraPorts.some(p=>p.t===type && p.port===port);
  }
  c_journalctl(a){
    const o = this.opts(a,['u','p','n','since','until','b','g','t','o']);
    const now = new Date();
    const T = (h,m,s)=>`${MON[now.getMonth()]} ${z2(now.getDate())} ${z2(h)}:${z2(m)}:${z2(s)}`;
    let lines = [
      [T(8,0,1),'kernel','Linux version '+this.kernel,6],
      [T(8,0,3),'systemd[1]','Started Journal Service.',6],
      [T(8,0,9),'systemd[1]','Started OpenSSH server daemon.',6,'sshd'],
      [T(8,0,9),'sshd[1032]','Server listening on 0.0.0.0 port 22.',6,'sshd'],
      [T(8,0,10),'systemd[1]','Started firewalld - dynamic firewall daemon.',6,'firewalld'],
      [T(8,0,11),'chronyd[812]','chronyd version 4.5 starting',6,'chronyd'],
      [T(7,55,2),'sshd[1203]','Failed password for root from 203.0.113.77 port 51240 ssh2',4,'sshd'],
      [T(7,55,9),'sshd[1205]','error: maximum authentication attempts exceeded for root from 203.0.113.77 port 51242 ssh2 [preauth]',3,'sshd'],
      [T(9,44,12),'systemd[1]','agent.service: Failed at step EXEC spawning /opt/monitoring/bin/agent: Permission denied',3,'agent'],
      [T(9,44,12),'systemd[1]','agent.service: Main process exited, code=exited, status=203/EXEC',4,'agent'],
      [T(9,44,12),'systemd[1]',"agent.service: Failed with result 'exit-code'.",4,'agent'],
      [T(10,29,40),'sshd[2210]','Accepted publickey for admin from 10.0.20.15 port 53122 ssh2',6,'sshd'],
      [T(10,30,12),'sudo[2290]','admin : TTY=pts/0 ; PWD=/home/admin ; USER=root ; COMMAND=/usr/bin/dnf check-update',5],
    ];
    if (this.svc.httpd.installed) lines.push([T(11,1,0),'systemd[1]','Starting The Apache HTTP Server...',6,'httpd']);
    if (this.svc.httpd.failed) lines.push([T(11,2,10),'httpd[3301]',`(13)Permission denied: AH00072: make_sock: could not bind to address 0.0.0.0:${this.httpdPort}`,3,'httpd'],[T(11,2,10),'setroubleshoot[3310]',`SELinux is preventing /usr/sbin/httpd from name_bind access on the tcp_socket port ${this.httpdPort}.`,3,'httpd']);
    if (this.svc.httpd.active) lines.push([T(11,3,0),'systemd[1]','Started The Apache HTTP Server.',6,'httpd'],[T(11,3,0),'httpd[3010]','Server configured, listening on: port '+(this.httpdPort||80),6,'httpd']);
    if (this.user!=='root' && !this.inGroup('wheel') && !this.inGroup('adm')) return {o:'Hint: You are currently not seeing messages from other users and the system.\n      Users in groups \'adm\', \'systemd-journal\', \'wheel\' can see all messages.\n'};
    const U = o.v.u ? this._svcName(o.v.u) : null;
    if (U) lines = lines.filter(l=>l[4]===U);
    if (o.v.p){ const map={emerg:0,alert:1,crit:2,err:3,warning:4,notice:5,info:6,debug:7}; const lv = isNaN(+o.v.p) ? map[o.v.p] : +o.v.p; lines = lines.filter(l=>l[3]<=lv); }
    if (o.v.g){ const re=new RegExp(o.v.g,'i'); lines = lines.filter(l=>re.test(l[2])); }
    lines.sort((x,y)=>x[0].localeCompare(y[0]));
    if (o.v.n) lines = lines.slice(-(+o.v.n));
    if (o.has('r')) lines.reverse();
    let out = lines.length ? lines.map(l=>`${l[0]} ${this.hostname} ${l[1]}: ${l[2]}`).join('\n')+'\n' : '-- No entries --\n';
    if (o.has('x') && U) out += '░░ Subject: A start job for unit '+U+'.service has failed\n░░ Defined-By: systemd\n░░ The job identifier is 412 and the job result is failed.\n';
    if (o.has('f')) out += '… (journalctl -f sleduje nové záznamy naživo, ukončíš Ctrl+C)\n';
    if (o.has('list-boots')) out = 'IDX BOOT ID                          FIRST ENTRY                 LAST ENTRY\n  0 9b1c7e3a2d5f4e6b8c0a1d3f5e7b9c2d Sun 2026-11-01 08:00:01 CET Sun 2026-11-01 11:59:00 CET\n(len aktuálny štart: journal nie je trvalý, kým nevytvoríš /var/log/journal)\n';
    if (o.has('disk-usage')) out = 'Archived and active journals take up 56.0M in the file system.\n';
    return out;
  }
  c_hostnamectl(a){
    if (a[0]==='set-hostname'){ if (this.user!=='root') return {e:'Could not set static hostname: Access denied\n',code:1}; this.hostname = a[1]; this._lookup('/etc/hostname').c = a[1]+'\n'; return ''; }
    return ` Static hostname: ${this.hostname}\n       Icon name: computer-vm\n         Chassis: vm 🖴\n      Machine ID: 4f9d2a7c1e3b4d5f8a6c0b2e9d7f1a3c\n         Boot ID: 9b1c7e3a2d5f4e6b8c0a1d3f5e7b9c2d\n  Virtualization: vmware\nOperating System: ${this.release.replace(' release','')}\n     CPE OS Name: cpe:/o:redhat:enterprise_linux:${this.ver}::baseos\n          Kernel: Linux ${this.kernel}\n    Architecture: x86-64\n Hardware Vendor: VMware, Inc.\n  Hardware Model: VMware Virtual Platform\n`;
  }
  c_timedatectl(a){
    if (a[0]==='set-timezone'){ if (this.user!=='root') return {e:'Failed to set time zone: Access denied\n',code:1}; this.tz=a[1]; return ''; }
    if (a[0]==='list-timezones') return 'Europe/Berlin\nEurope/Bratislava\nEurope/Budapest\nEurope/Prague\nEurope/Vienna\nUTC\n';
    const d=new Date();
    return `               Local time: ${d.toString().slice(0,24)} CET\n           Universal time: ${d.toUTCString().replace('GMT','UTC')}\n                 RTC time: ${d.toUTCString().slice(0,25)}\n                Time zone: ${this.tz||'Europe/Bratislava'} (CET, +0100)\nSystem clock synchronized: yes\n              NTP service: ${this.svc.chronyd.active?'active':'inactive'}\n          RTC in local TZ: no\n`;
  }
  c_chronyc(a){ if (a[0]==='sources') return 'MS Name/IP address         Stratum Poll Reach LastRx Last sample\n===============================================================================\n^* 185.125.190.56                2   10   377   612   +215us[ +301us] +/-   18ms\n^- ntp.cesnet.cz                 1   10   377   590  -1102us[-1102us] +/-   12ms\n'; if (a[0]==='tracking') return 'Reference ID    : B97DBE38 (185.125.190.56)\nStratum         : 3\nSystem time     : 0.000012303 seconds fast of NTP time\nLeap status     : Normal\n'; return {e:'chronyc: v simulátore skús: chronyc sources  alebo  chronyc tracking\n'}; }

  /* ---------------- packages ---------------- */
  c_yum(a){ return this.c_dnf(a); }
  c_dnf(a){
    const o = this.opts(a,['enablerepo','disablerepo','setopt']);
    const sub = o.pos[0]; const names = o.pos.slice(1);
    const meta = 'Updating Subscription Management repositories.\nLast metadata expiration check: 0:41:12 ago on '+new Date().toString().slice(0,24)+'.\n';
    const needRoot = ['install','remove','erase','update','upgrade','reinstall','downgrade','autoremove','clean','makecache'].includes(sub) || (sub==='history' && ['undo','rollback'].includes(names[0]));
    if (needRoot && this.user!=='root') return {e:'Error: This command has to be run with superuser privileges (under the root user on most systems).\n',code:1};
    const repoTag = r=> r==='baseos'?`rhel-${this.ver}-for-x86_64-baseos-rpms`:`rhel-${this.ver}-for-x86_64-appstream-rpms`;
    const vr = (n)=>PKG_DB[n].v+'.el'+this.ver+(this.ver===9?'_6':'_0');
    switch(sub){
      case 'install': {
        if (!names.length) return {e:'Error: Need to pass a list of pkgs to install\n',code:1};
        const miss = names.filter(n=>!PKG_DB[n]);
        if (miss.length) return {o:meta, e:miss.map(n=>`No match for argument: ${n}`).join('\n')+'\nError: Unable to find a match: '+miss.join(' ')+'\n'+(miss.some(n=>['htop','epel-release','ncdu','neofetch'].includes(n))?'(tento balík nie je v RHEL repozitároch; býva v EPEL, ktorý je v práci zvyčajne zakázaný alebo spravovaný centrálne)\n':''), code:1};
        const todo = names.filter(n=>!this.pkgs.has(n));
        let out = meta;
        names.filter(n=>this.pkgs.has(n)).forEach(n=>out+=`Package ${n}-${vr(n)}.x86_64 is already installed.\n`);
        if (!todo.length) return out+'Dependencies resolved.\nNothing to do.\nComplete!\n';
        out += 'Dependencies resolved.\n================================================================================\n Package            Arch      Version              Repository                  Size\n================================================================================\nInstalling:\n';
        todo.forEach(n=>out+=` ${pad(n,18,true)} x86_64    ${pad(vr(n),20,true)} ${pad(repoTag(PKG_DB[n].repo),27,true)} ${(n.length*37%900+50)} k\n`);
        out += `\nTransaction Summary\n================================================================================\nInstall  ${todo.length} Package${todo.length>1?'s':''}\n\n`;
        if (!o.has('y','assumeyes')) out += 'Is this ok [y/N]: y   (v simulátore odpovedám y za teba; v skriptoch používaj -y)\n';
        out += 'Downloading Packages:\nRunning transaction\n'+todo.map(n=>`  Installing       : ${n}-${vr(n)}.x86_64`).join('\n')+'\n\nInstalled:\n  '+todo.map(n=>n+'-'+vr(n)+'.x86_64').join('  ')+'\n\nComplete!\n';
        todo.forEach(n=>this._installPkg(n));
        this.dnfHist.push({id:this.dnfHist.length+1, cmd:'install '+todo.join(' '), date:new Date().toISOString().slice(0,16).replace('T',' '), act:'Install', n:todo.length, pk:todo});
        return out;
      }
      case 'remove': case 'erase': {
        const todo = names.filter(n=>this.pkgs.has(n));
        if (!todo.length) return {o:'No match for argument: '+names.join(' ')+'\nNo packages marked for removal.\nDependencies resolved.\nNothing to do.\nComplete!\n'};
        if (todo.some(n=>['systemd','dnf','rpm','bash','kernel','sudo'].includes(n))) return {e:'Error: \n Problem: The operation would result in removing the following protected packages: '+todo.join(', ')+'\n',code:1};
        todo.forEach(n=>{ this.pkgs.delete(n); for (const [k,d] of Object.entries(SVC_DEF)) if (d.pkg===n){ this.svc[k].installed=false; this.svc[k].active=false; this.svc[k].enabled=false; } PKG_DB[n].cmds.forEach(c=>{ ['/usr/bin/','/usr/sbin/'].forEach(dir=>{ const dn=this._lookup(dir); if (dn) delete dn.c[c]; }); }); });
        this.dnfHist.push({id:this.dnfHist.length+1, cmd:'remove '+todo.join(' '), date:new Date().toISOString().slice(0,16).replace('T',' '), act:'Removed', n:todo.length, pk:todo});
        return meta+'Dependencies resolved.\nRemoving:\n'+todo.map(n=>` ${n}  x86_64  ${vr(n)}  @${repoTag(PKG_DB[n].repo)}`).join('\n')+'\n\nRemoved:\n  '+todo.join('  ')+'\n\nComplete!\n';
      }
      case 'search': {
        const q = names.join(' ').toLowerCase();
        const r = Object.entries(PKG_DB).filter(([n,d])=>n.includes(q)||d.s.toLowerCase().includes(q));
        if (!r.length) return {o:meta, e:'No matches found.\n',code:1};
        return meta+`================== Name & Summary Matched: ${q} ==================\n`+r.map(([n,d])=>`${n}.x86_64 : ${d.s}`).join('\n')+'\n';
      }
      case 'info': {
        const n = names[0]; const d = PKG_DB[n];
        if (!d) return {o:meta,e:'Error: No matching Packages to list\n',code:1};
        return meta+`${this.pkgs.has(n)?'Installed':'Available'} Packages\nName         : ${n}\nVersion      : ${d.v.split('-')[0]}\nRelease      : ${d.v.split('-').slice(1).join('-')}.el${this.ver}\nArchitecture : x86_64\nSize         : ${(n.length*137)%4000+120} k\nSource       : ${n}-${d.v}.el${this.ver}.src.rpm\nRepository   : ${this.pkgs.has(n)?'@System':repoTag(d.repo)}\nSummary      : ${d.s}\nLicense      : GPLv2+\n`;
      }
      case 'list': {
        const which = names[0];
        let r = Object.keys(PKG_DB);
        if (which==='installed') r = r.filter(n=>this.pkgs.has(n));
        else if (which==='available') r = r.filter(n=>!this.pkgs.has(n));
        else if (which) r = r.filter(n=>globToRe(which).test(n));
        return meta+(which==='available'?'Available Packages\n':'Installed Packages\n')+r.sort().map(n=>`${pad(n+'.x86_64',40,true)} ${pad(vr(n),22,true)} ${this.pkgs.has(n)?'@'+repoTag(PKG_DB[n].repo).replace(/-x86_64.*/,''):repoTag(PKG_DB[n].repo)}`).join('\n')+'\n';
      }
      case 'provides': case 'whatprovides': {
        const q = (names[0]||'').split('/').pop().replace(/^\*/,'');
        const r = Object.entries(PKG_DB).filter(([n,d])=>d.cmds.includes(q));
        if (!r.length) return {o:meta,e:'Error: No matches found. If searching for a file, try specifying the full path or using a wildcard prefix ("*/") at the beginning.\n',code:1};
        return meta+r.map(([n,d])=>`${n}-${vr(n)}.x86_64 : ${d.s}\nRepo        : ${repoTag(d.repo)}\nMatched from:\nFilename    : /usr/${['semanage','useradd','restorecon'].includes(q)?'sbin':'bin'}/${q}\n`).join('\n');
      }
      case 'check-update': return {o:meta+'\nkernel.x86_64                 '+(this.ver===9?'5.14.0-570.18.1.el9_6':'6.12.0-55.20.1.el10_0')+'      '+repoTag('baseos')+'\nopenssl.x86_64                1:3.2.2-6.el'+this.ver+'_6         '+repoTag('baseos')+'\nsudo.x86_64                   1.9.5p2-11.el'+this.ver+'          '+repoTag('baseos')+'\n', code:100};
      case 'update': case 'upgrade': {
        if (names.length && names.every(n=>this.pkgs.has(n))) return meta+'Dependencies resolved.\nNothing to do.\nComplete!\n';
        this.dnfHist.push({id:this.dnfHist.length+1, cmd:'update'+(names.length?' '+names.join(' '):''), date:new Date().toISOString().slice(0,16).replace('T',' '), act:'Upgrade', n:3});
        return meta+'Dependencies resolved.\nUpgrading:\n kernel   openssl   sudo\n\nTransaction Summary\nUpgrade  3 Packages\n\nComplete!\n(nové jadro sa použije až po reštarte: needs-restarting -r ti povie, či treba)\n';
      }
      case 'repolist': return meta.split('\n')[0]+'\nrepo id                                         repo name\n'+repoTag('appstream')+'      Red Hat Enterprise Linux '+this.ver+' for x86_64 - AppStream (RPMs)\n'+repoTag('baseos')+'         Red Hat Enterprise Linux '+this.ver+' for x86_64 - BaseOS (RPMs)\n';
      case 'history': {
        if (names[0]==='undo'){ const h = names[1]==='last' ? this.dnfHist[this.dnfHist.length-1] : this.dnfHist.find(x=>x.id===+names[1]); if (!h||!h.pk) return {e:`Error: Transaction ${names[1]||'?'} cannot be undone (v simulátore len inštalácie/odinštalácie)\n`,code:1}; if (h.act==='Install') return this.c_dnf(['remove','-y',...h.pk]); return this.c_dnf(['install','-y',...h.pk]); }
        if (names[0]==='info'){ const h=this.dnfHist.find(x=>x.id===+names[1])||this.dnfHist[this.dnfHist.length-1]; return `Transaction ID : ${h.id}\nBegin time     : ${h.date}\nUser           : admin <admin>\nReturn-Code    : Success\nCommand Line   : ${h.cmd}\n`; }
        return 'ID     | Command line              | Date and time    | Action(s)      | Altered\n-------------------------------------------------------------------------------\n'+this.dnfHist.slice().reverse().map(h=>`${pad(h.id,6,true)} | ${pad(h.cmd.slice(0,25),25,true)} | ${h.date} | ${pad(h.act,14,true)} | ${pad(h.n,7)}`).join('\n')+'\n';
      }
      case 'clean': return names[0]==='all' ? '44 files removed\n' : '';
      case 'makecache': return meta+'Metadata cache created.\n';
      case 'module': return {o:(this.ver===10?'Warning: modularity is deprecated (DNF moduly sú v RHEL 10 zastarané).\n':'')+meta+'Red Hat Enterprise Linux '+this.ver+' for x86_64 - AppStream (RPMs)\nName        Stream     Profiles                         Summary\nnginx       1.22       common [d]                       nginx webserver\nnodejs      18         common [d], development, minimal  Javascript runtime\nphp         8.1        common [d], devel, minimal       PHP scripting language\n\nHint: [d]efault, [e]nabled, [x]disabled, [i]nstalled\n'};
      case 'group': return meta+'Available Environment Groups:\n   Server with GUI\n   Server\n   Minimal Install\nInstalled Environment Groups:\n   Server\nAvailable Groups:\n   Development Tools\n   System Tools\n   Security Tools\n';
      default:
        return {e:`No such command: ${sub||''}. Please use /usr/bin/dnf --help\nIt could be a DNF plugin command, try: "dnf install 'dnf-command(${sub})'"\n`,code:1};
    }
  }
  _installPkg(n){
    this.pkgs.add(n);
    const d = PKG_DB[n];
    d.cmds.forEach(c=>{ const sb=['semanage','audit2allow','sealert'].includes(c)||c==='httpd'; const p=(sb?'/usr/sbin/':'/usr/bin/')+c; if (!this.exists(p)){ const x=this._mkPath(p,'f',0o755,'root','root','\x7fELF binárny súbor'); x.ctx='bin_t'; } });
    for (const [k,sd] of Object.entries(SVC_DEF)) if (sd.pkg===n){ this.svc[k].installed=true; this.svc[k].active=false; this.svc[k].enabled=false; const u=this._mkPath(sd.unit,'f',0o644,'root','root',this._unitText(k)); u.ctx='systemd_unit_file_t'; }
    if (n==='httpd'){
      ['/etc/httpd','/etc/httpd/conf','/etc/httpd/conf.d','/var/www','/var/www/html','/var/www/cgi-bin','/var/log/httpd'].forEach(p=>{ if (!this.exists(p)){ const x=this._mkPath(p,'d',p==='/var/log/httpd'?0o700:0o755); x.ctx=this.defaultCtx(p); x.mt=new Date(); } });
      const c = this._mkPath('/etc/httpd/conf/httpd.conf','f',0o644,'root','root','#\n# This is the main Apache HTTP server configuration file.\n#\nServerRoot "/etc/httpd"\n\n# Listen: Allows you to bind Apache to specific IP addresses and/or ports\nListen 80\n\nInclude conf.modules.d/*.conf\nUser apache\nGroup apache\nServerAdmin root@localhost\nDocumentRoot "/var/www/html"\n\n<Directory "/var/www/html">\n    Options Indexes FollowSymLinks\n    AllowOverride None\n    Require all granted\n</Directory>\n\nErrorLog "logs/error_log"\nIncludeOptional conf.d/*.conf\n'); c.ctx='etc_t';
      this.sysusers.push(['apache',48,48,'/usr/share/httpd','/sbin/nologin']); this.groups.apache={gid:48,mem:[]}; this._refreshAccountFiles();
    }
    if (n==='nginx'){ ['/etc/nginx','/usr/share/nginx/html','/var/log/nginx'].forEach(p=>{ if (!this.exists(p)){ this._mkPath(p,'d',0o755).ctx=this.defaultCtx(p);} }); this._mkPath('/etc/nginx/nginx.conf','f',0o644,'root','root','user nginx;\nworker_processes auto;\nerror_log /var/log/nginx/error.log;\nhttp {\n    server {\n        listen       80;\n        root         /usr/share/nginx/html;\n    }\n}\n').ctx='etc_t'; }
    if (n==='mariadb-server'){ const x=this._mkPath('/var/lib/mysql','d',0o755,'root','root'); x.ctx='mysqld_db_t'; this._mkPath('/etc/my.cnf.d/mariadb-server.cnf','f',0o644,'root','root','[mysqld]\ndatadir=/var/lib/mysql\nsocket=/var/lib/mysql/mysql.sock\nlog-error=/var/log/mariadb/mariadb.log\n').ctx='etc_t'; }
  }
  c_rpm(a){
    const o = this.opts(a,['f']);
    const vr = n=>PKG_DB[n].v+'.el'+this.ver+(this.ver===9?'_6':'_0');
    const q = o.has('q','query');
    if (!q) return {e:'rpm: v simulátore podporujem dopytovanie: -qa, -qi BALÍK, -ql BALÍK, -qf SÚBOR, -qc BALÍK, -q BALÍK\n',code:1};
    if (o.has('a')){ let list=[...this.pkgs].sort(); if (o.pos[0]) { const re=globToRe(o.pos[0]); list=list.filter(n=>re.test(n)); } return list.map(n=>`${n}-${vr(n)}.x86_64`).join('\n')+'\n'; }
    if (o.has('f')||o.v.f){
      const f = o.v.f || o.pos[0]; const abs = this.norm(f);
      if (!this.exists(abs)) return {e:`error: file ${abs}: No such file or directory\n`,code:1};
      const base = abs.split('/').pop();
      let own = Object.entries(PKG_DB).find(([n,d])=>this.pkgs.has(n) && d.cmds.includes(base) && /^\/usr\/s?bin\//.test(abs));
      const map = {'/etc/passwd':'setup','/etc/group':'setup','/etc/hosts':'setup','/etc/fstab':'setup','/etc/sudoers':'sudo','/etc/ssh/sshd_config':'openssh-server','/etc/chrony.conf':'chrony','/etc/selinux/config':'selinux-policy','/etc/dnf/dnf.conf':'dnf','/etc/crontab':'crontabs','/etc/httpd/conf/httpd.conf':'httpd','/etc/firewalld/firewalld.conf':'firewalld','/etc/redhat-release':'redhat-release','/etc/os-release':'redhat-release','/etc/login.defs':'shadow-utils'};
      if (!own && map[abs]) return `${map[abs]}-${PKG_DB[map[abs]]?vr(map[abs]):'2.13.7-10.el'+this.ver}.noarch\n`;
      if (!own && /^\/usr\/lib\/systemd\/system\/(.+)\.service$/.test(abs)){ const k=abs.match(/system\/(.+)\.service$/)[1]; const p=SVC_DEF[k]?.pkg; if (p) return `${p}-${vr(p)}.x86_64\n`; }
      if (own) return `${own[0]}-${vr(own[0])}.x86_64\n`;
      return {o:`file ${abs} is not owned by any package\n`, code:1};
    }
    const n = o.pos[0];
    if (!n) return {e:'rpm: no arguments given for query\n',code:1};
    if (!this.pkgs.has(n)) return {o:`package ${n} is not installed\n`,code:1};
    if (o.has('i')) return `Name        : ${n}\nVersion     : ${PKG_DB[n].v.split('-')[0]}\nRelease     : ${PKG_DB[n].v.split('-').slice(1).join('-')}.el${this.ver}\nArchitecture: x86_64\nInstall Date: Fri 02 Oct 2026 09:14:33 AM CEST\nGroup       : Unspecified\nSize        : ${(n.length*1371)%400000+12000}\nLicense     : GPLv2+\nSignature   : RSA/SHA256, Red Hat, Inc. release key 2\nSummary     : ${PKG_DB[n].s}\n`;
    if (o.has('l')){ const fl = PKG_DB[n].cmds.map(c=>'/usr/bin/'+c); const svc = Object.values(SVC_DEF).filter(d=>d.pkg===n).map(d=>d.unit); const extra = n==='httpd'?['/etc/httpd/conf/httpd.conf','/var/www/html','/var/log/httpd']:n==='openssh-server'?['/etc/ssh/sshd_config','/usr/sbin/sshd']:n==='firewalld'?['/etc/firewalld/firewalld.conf','/usr/lib/firewalld/services/ssh.xml','/usr/sbin/firewalld']:[]; return fl.concat(svc,extra,['/usr/share/doc/'+n,'/usr/share/man/man1/'+(PKG_DB[n].cmds[0]||n)+'.1.gz']).join('\n')+'\n'; }
    if (o.has('c')){ const m={httpd:'/etc/httpd/conf/httpd.conf\n/etc/httpd/conf.d/welcome.conf\n','openssh-server':'/etc/ssh/sshd_config\n/etc/sysconfig/sshd\n',chrony:'/etc/chrony.conf\n/etc/chrony.keys\n',firewalld:'/etc/firewalld/firewalld.conf\n/etc/sysconfig/firewalld\n',sudo:'/etc/sudoers\n',dnf:'/etc/dnf/dnf.conf\n'}; return m[n]||'(balík nemá konfiguračné súbory)\n'; }
    return `${n}-${vr(n)}.x86_64\n`;
  }
  c_subscription_manager(a){
    if (a[0]==='status') return '+-------------------------------------------+\n   System Status Details\n+-------------------------------------------+\nOverall Status: Registered\n\nSystem Purpose Status: Disabled\n\nContent Access Mode is set to Simple Content Access. This host has access to content, regardless of subscription status.\n';
    if (a[0]==='repos' && a.includes('--list-enabled')) return '+----------------------------------------------------------+\n    Available Repositories in /etc/yum.repos.d/redhat.repo\n+----------------------------------------------------------+\nRepo ID:   rhel-'+this.ver+'-for-x86_64-appstream-rpms\nRepo Name: Red Hat Enterprise Linux '+this.ver+' for x86_64 - AppStream (RPMs)\nEnabled:   1\n\nRepo ID:   rhel-'+this.ver+'-for-x86_64-baseos-rpms\nRepo Name: Red Hat Enterprise Linux '+this.ver+' for x86_64 - BaseOS (RPMs)\nEnabled:   1\n';
    if (a[0]==='identity') return 'system identity: 6c2e9a41-7f3b-4d8e-a1c5-0b9d2f7e4a63\nname: '+this.hostname+'\norg name: 11223344\norg ID: 11223344\n';
    if (a[0]==='register') return {e:'(v simulátore je systém už zaregistrovaný; reálne: sudo subscription-manager register --username MENO alebo --org ORG --activationkey KĽÚČ)\n'};
    return {e:'Usage: subscription-manager MODULE-NAME [MODULE-OPTIONS] [--help]\nSkús: status, repos --list-enabled, identity\n',code:1};
  }

  /* ---------------- network ---------------- */
  c_ip(a){
    const sub = a[0]||''; const obj = sub.replace(/^-\w+$/,'');
    const brief = a.includes('-br') || a.includes('-brief');
    const which = a.filter(x=>!x.startsWith('-'));
    const w = which[0]||'';
    const m = this.net;
    if (/^a(ddr|ddress)?$/.test(w)){
      if (brief || a[0]==='-br') return `lo               UNKNOWN        127.0.0.1/8 ::1/128 \n${m.ifc}           UP             ${m.ip} fe80::250:56ff:fea1:3c7e/64 \n`;
      if (which[1]==='add'||which[1]==='del') return {e:'(dočasná zmena IP cez ip addr zmizne po reštarte. Trvalo nastav cez nmcli con mod …)\n'};
      return `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet 127.0.0.1/8 scope host lo\n       valid_lft forever preferred_lft forever\n    inet6 ::1/128 scope host noprefixroute \n       valid_lft forever preferred_lft forever\n2: ${m.ifc}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000\n    link/ether ${m.mac} brd ff:ff:ff:ff:ff:ff\n    altname enp11s0\n    inet ${m.ip} brd 10.0.20.255 scope global noprefixroute ${m.ifc}\n       valid_lft forever preferred_lft forever\n    inet6 fe80::250:56ff:fea1:3c7e/64 scope link noprefixroute \n       valid_lft forever preferred_lft forever\n`;
    }
    if (/^r(oute|o)?$/.test(w)) return `default via ${m.gw} dev ${m.ifc} proto static metric 100 \n10.0.20.0/24 dev ${m.ifc} proto kernel scope link src ${m.ip.split('/')[0]} metric 100 \n`;
    if (/^l(ink)?$/.test(w)) return brief ? `lo               UNKNOWN        00:00:00:00:00:00 <LOOPBACK,UP,LOWER_UP> \n${m.ifc}           UP             ${m.mac} <BROADCAST,MULTICAST,UP,LOWER_UP> \n` : `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n2: ${m.ifc}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP mode DEFAULT group default qlen 1000\n    link/ether ${m.mac} brd ff:ff:ff:ff:ff:ff\n`;
    if (/^n(eigh)?$/.test(w)) return `${m.gw} dev ${m.ifc} lladdr 00:50:56:a1:00:01 REACHABLE\n10.0.20.15 dev ${m.ifc} lladdr 3c:52:82:4b:9e:11 STALE\n`;
    return {e:'Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | route | link | neigh | ... }\nSkús: ip a, ip r, ip link, ip -br a\n',code:255};
  }
  c_ifconfig(){ return `${this.net.ifc}: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet ${this.net.ip.split('/')[0]}  netmask 255.255.255.0  broadcast 10.0.20.255\n        ether ${this.net.mac}  txqueuelen 1000  (Ethernet)\n\n(ifconfig je zastaraný nástroj z balíka net-tools. Na RHEL používaj ip a)\n`; }
  c_nmcli(a){
    const w = a.filter(x=>!x.startsWith('-'));
    const obj = w[0]||'', act = w[1]||'';
    if (/^d(ev(ice)?)?$/.test(obj)){
      if (act==='show') return `GENERAL.DEVICE:                         ${this.net.ifc}\nGENERAL.TYPE:                           ethernet\nGENERAL.HWADDR:                         ${this.net.mac.toUpperCase()}\nGENERAL.STATE:                          100 (connected)\nGENERAL.CONNECTION:                     ${this.net.ifc}\nIP4.ADDRESS[1]:                         ${this.net.ip}\nIP4.GATEWAY:                            ${this.net.gw}\nIP4.DNS[1]:                             ${this.net.dns}\n`;
      return `DEVICE  TYPE      STATE                   CONNECTION \n${this.net.ifc}  ethernet  connected               ${this.net.ifc}     \nlo      loopback  connected (externally)  lo         \n`;
    }
    if (/^c(on(nection)?)?$/.test(obj)){
      if (act==='mod'||act==='modify'){
        if (this.user!=='root') return {e:'Error: Failed to modify connection \''+w[2]+'\': Insufficient privileges\n',code:1};
        for (let i=3;i<w.length;i+=2){ const k=w[i], v=w[i+1]; if (/ipv4.addresses|ipv4.address/.test(k)) this.net.pendingIp=v; if (/ipv4.gateway/.test(k)) this.net.pendingGw=v; if (/ipv4.dns/.test(k)) this.net.pendingDns=v; if (/ipv4.method/.test(k)) this.net.method=v; }
        this.net.modified = true;
        return '';
      }
      if (act==='up'){ if (this.user!=='root') return {e:'Error: Connection activation failed: Not authorized to control networking.\n',code:1}; if (this.net.pendingIp){ this.net.ip=this.net.pendingIp; } if (this.net.pendingGw) this.net.gw=this.net.pendingGw; if (this.net.pendingDns) this.net.dns=this.net.pendingDns; this.net.applied=true; return 'Connection successfully activated (D-Bus active path: /org/freedesktop/NetworkManager/ActiveConnection/3)\n'; }
      if (act==='reload') return '';
      if (act==='show' && w[2]) return `connection.id:                          ${w[2]}\nconnection.uuid:                        0b6f2c94-3d1a-4e7c-8f25-a9c1d7e4b308\nconnection.type:                        802-3-ethernet\nconnection.interface-name:              ${this.net.ifc}\nconnection.autoconnect:                 yes\nipv4.method:                            ${this.net.method||'manual'}\nipv4.dns:                               ${this.net.pendingDns||this.net.dns}\nipv4.addresses:                         ${this.net.pendingIp||this.net.ip}\nipv4.gateway:                           ${this.net.pendingGw||this.net.gw}\n`;
      return `NAME    UUID                                  TYPE      DEVICE \n${this.net.ifc}  0b6f2c94-3d1a-4e7c-8f25-a9c1d7e4b308  ethernet  ${this.net.ifc} \nlo      9a3e1f2c-6b7d-4a8e-b5c1-2d0f9e8a7b63  loopback  lo     \n`;
    }
    if (/^g(en(eral)?)?$/.test(obj)) return 'STATE      CONNECTIVITY  WIFI-HW  WIFI     WWAN-HW  WWAN    \nconnected  full          missing  enabled  missing  enabled \n';
    return `${this.net.ifc}: connected to ${this.net.ifc}\n        "VMware VMXNET3"\n        ethernet (vmxnet3), ${this.net.mac.toUpperCase()}, hw, mtu 1500\n        ip4 default\n        inet4 ${this.net.ip}\n        route4 default via ${this.net.gw} metric 100\n\nDNS configuration:\n        servers: ${this.net.dns}\n        domains: firma.local\n        interface: ${this.net.ifc}\n`;
  }
  c_nmtui(){ return {e:'(nmtui je textové menu na nastavenie siete. V simulátore použi nmcli.)\n'}; }
  _sockets(){
    const s = [];
    const sv = this.svc;
    if (sv.sshd.active){ s.push({p:'tcp',st:'LISTEN',l:'0.0.0.0',port:22,proc:'sshd',pid:1032}); s.push({p:'tcp',st:'LISTEN',l:'[::]',port:22,proc:'sshd',pid:1032}); }
    if (sv.chronyd.active){ s.push({p:'udp',st:'UNCONN',l:'127.0.0.1',port:323,proc:'chronyd',pid:812}); s.push({p:'udp',st:'UNCONN',l:'[::1]',port:323,proc:'chronyd',pid:812}); }
    if (sv.cockpit.installed && sv.cockpit.active) s.push({p:'tcp',st:'LISTEN',l:'*',port:9090,proc:'systemd',pid:1});
    if (sv.httpd.active) s.push({p:'tcp',st:'LISTEN',l:'*',port:this.httpdPort||80,proc:'httpd',pid:3010});
    if (sv.nginx.active) s.push({p:'tcp',st:'LISTEN',l:'0.0.0.0',port:80,proc:'nginx',pid:3110});
    if (sv.mariadb.active) s.push({p:'tcp',st:'LISTEN',l:'*',port:3306,proc:'mariadbd',pid:3220});
    s.push({p:'udp',st:'UNCONN',l:'0.0.0.0',port:68,proc:'NetworkManager',pid:903,dhcp:true});
    if (sv.sshd.active) s.push({p:'tcp',st:'ESTAB',l:this.net.ip.split('/')[0],port:22,proc:'sshd',pid:2208,peer:'10.0.20.15:53122'});
    return s;
  }
  c_ss(a){
    const o = this.opts(a);
    const t = o.has('t','tcp'), u = o.has('u','udp'), l = o.has('l','listening'), p = o.has('p','processes'), n = o.has('n','numeric'), all = o.has('a','all');
    let socks = this._sockets();
    if (this.net.method==='manual' || true) socks = socks.filter(x=>!x.dhcp);
    if (t && !u) socks = socks.filter(x=>x.p==='tcp'); else if (u && !t) socks = socks.filter(x=>x.p==='udp');
    if (l) socks = socks.filter(x=>x.st!=='ESTAB'); else if (!all) socks = socks.filter(x=>x.st==='ESTAB' || (x.p==='udp' && false));
    const name = port => n ? String(port) : ({22:'ssh',80:'http',443:'https',323:'323',3306:'mysql',9090:'websm',68:'bootpc'}[port]||String(port));
    const showNet = (t||u) && !(t&&!u&&false);
    let s = (showNet?'Netid ':'')+'State  Recv-Q Send-Q   Local Address:Port    Peer Address:Port'+(p?' Process':'')+'\n';
    for (const x of socks){
      const peer = x.peer ? x.peer.replace(':53122', n?':53122':':53122') : (x.l.includes('[')||x.l==='*' ? (x.l==='*'?'*':'[::]')+':*' : '0.0.0.0:*');
      const proc = p ? (this.user==='root' ? ` users:(("${x.proc}",pid=${x.pid},fd=${x.proc==='sshd'?3:6}))` : '') : '';
      s += (showNet?pad(x.p,5,true)+' ':'')+`${pad(x.st,6,true)} 0      ${pad(x.p==='tcp'&&x.st==='LISTEN'?128:0,3,true)}    ${pad(x.l+':'+name(x.port),16)}  ${pad(peer,18)}${proc}\n`;
    }
    if (p && this.user!=='root') s += '(stĺpec Process je prázdny: procesy iných používateľov uvidíš len so sudo)\n';
    return s;
  }
  c_netstat(a){ const r = this.c_ss(a); return {o:r.o||r, e:'(netstat je zastaraný; na RHEL používaj ss s rovnakými prepínačmi: ss -tulpn)\n'}; }
  c_ping(a){
    const o=this.opts(a,['c','i','W']); const h=o.pos[0];
    if (!h) return {e:'ping: usage error: Destination address required\n',code:1};
    const known = {'localhost':'127.0.0.1','db01':'10.0.20.40','db01.firma.local':'10.0.20.40','10.0.20.1':'10.0.20.1','10.0.20.40':'10.0.20.40','8.8.8.8':'8.8.8.8','google.com':'142.250.180.206','redhat.com':'23.42.177.205','127.0.0.1':'127.0.0.1','10.0.20.2':'10.0.20.2','mon01':'10.0.20.50','10.0.20.50':'10.0.20.50'};
    const ip = known[h];
    if (!ip) return {e:`ping: ${h}: Name or service not known\n`,code:2};
    const c = +(o.v.c||4);
    let s = `PING ${h} (${ip}) 56(84) bytes of data.\n`;
    for (let i=1;i<=Math.min(c,10);i++) s += `64 bytes from ${ip}: icmp_seq=${i} ttl=${ip.startsWith('10.')?64:117} time=${(ip.startsWith('10.')?0.3+i*0.07:12.1+i*0.4).toFixed(2)} ms\n`;
    s += `\n--- ${h} ping statistics ---\n${c} packets transmitted, ${c} received, 0% packet loss, time ${c*1000-1}ms\n`;
    if (!o.v.c) s += '(bez -c beží ping donekonečna, ukončíš Ctrl+C. V simulátore som spravil 4 pokusy.)\n';
    return s;
  }
  c_curl(a){
    const o = this.opts(a,['o','X','H','d','w']);
    const url = o.pos[0]||'';
    const m = url.match(/^(?:https?:\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/);
    if (!m) return {e:'curl: (3) URL using bad/illegal format or missing URL\n',code:3};
    const host = m[1], port = +(m[2]|| (url.startsWith('https')?443:80));
    const local = ['localhost','127.0.0.1',this.hostname,this.net.ip.split('/')[0]].includes(host);
    if (local){
      const listen = this._sockets().find(s=>s.p==='tcp' && s.st==='LISTEN' && s.port===port);
      if (!listen) return {e:`curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server\n`,code:7};
      if (listen.proc==='httpd'){
        const path = (m[3]||'/').replace(/\/$/,'/index.html');
        const n = this._lookup('/var/www/html'+path);
        const head = o.has('I','head');
        if (!n){ return head ? 'HTTP/1.1 403 Forbidden\nServer: Apache/2.4.62 (Red Hat Enterprise Linux)\n' : '<!doctype html><html><head><title>Test Page for the HTTP Server on Red Hat Enterprise Linux</title></head>…</html>\n'; }
        if (n.ctx!=='httpd_sys_content_t' && this.se.mode==='Enforcing'){ this._avc=true; return head ? 'HTTP/1.1 403 Forbidden\nServer: Apache/2.4.62 (Red Hat Enterprise Linux)\n' : '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>403 Forbidden</title>\n</head><body>\n<h1>Forbidden</h1>\n<p>You don\'t have permission to access this resource.</p>\n</body></html>\n'; }
        if (!(n.m & 0o004)) return head ? 'HTTP/1.1 403 Forbidden\n' : '<h1>Forbidden</h1>\n';
        return head ? 'HTTP/1.1 200 OK\nServer: Apache/2.4.62 (Red Hat Enterprise Linux)\nContent-Type: text/html; charset=UTF-8\n' : n.c;
      }
      return 'OK\n';
    }
    if (host==='10.0.20.31' || host==='web01') return this.c_curl([url.replace(host,'localhost')]);
    if (['redhat.com','www.redhat.com','example.com','access.redhat.com'].includes(host)) return o.has('I') ? 'HTTP/2 200\ncontent-type: text/html\n' : '<!doctype html>… (HTML stránka) …\n';
    return {e:`curl: (6) Could not resolve host: ${host}\n`,code:6};
  }
  c_wget(a){ return {o:'',e:'(wget funguje podobne ako curl -O. V simulátore použi curl.)\n'}; }
  c_dig(a){ const h=a.filter(x=>!x.startsWith('-')&&!x.startsWith('+')&&!x.startsWith('@'))[0]||'.'; const ip={'db01.firma.local':'10.0.20.40','mon01.firma.local':'10.0.20.50','redhat.com':'23.42.177.205','google.com':'142.250.180.206'}[h]; if (a.includes('+short')) return ip?ip+'\n':''; return `; <<>> DiG 9.16.23-RH <<>> ${h}\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ${ip?'NOERROR':'NXDOMAIN'}, id: 41822\n\n;; QUESTION SECTION:\n;${h}.\t\t\tIN\tA\n\n`+(ip?`;; ANSWER SECTION:\n${h}.\t300\tIN\tA\t${ip}\n\n`:'')+`;; SERVER: ${this.net.dns}#53(${this.net.dns}) (UDP)\n;; Query time: 2 msec\n`; }
  c_host(a){ const r=this.c_dig([a[0],'+short']); return r ? `${a[0]} has address ${r}` : {e:`Host ${a[0]} not found: 3(NXDOMAIN)\n`,code:1}; }
  c_nslookup(a){ const r=this.c_dig([a[0],'+short']); return `Server:\t\t${this.net.dns}\nAddress:\t${this.net.dns}#53\n\n`+(r?`Name:\t${a[0]}\nAddress: ${r}`:`** server can't find ${a[0]}: NXDOMAIN\n`); }
  c_getent(a){ if (a[0]==='hosts'){ const h=this.read('/etc/hosts').split('\n').find(l=>l.split(/\s+/).slice(1).includes(a[1])); return h? h.replace(/\s+/g,'       ')+'\n' : {code:2}; } if (a[0]==='passwd'){ return (this.read('/etc/passwd').split('\n').filter(l=>!a[1]||l.startsWith(a[1]+':')).join('\n'))+'\n'; } if (a[0]==='group') return (this.read('/etc/group').split('\n').filter(l=>!a[1]||l.startsWith(a[1]+':')).join('\n'))+'\n'; return {e:'getent: v simulátore: getent passwd|group|hosts [meno]\n'}; }

  /* ---------------- firewall ---------------- */
  c_firewall_cmd(a){
    { const VAL = /^--(zone|add-service|remove-service|add-port|remove-port|add-source|remove-source|add-interface|remove-interface|change-interface|add-rich-rule|remove-rich-rule|set-default-zone|query-service|query-port|info-service|list-all|new-zone|delete-zone)$/;
      const b=[]; for (let i=0;i<a.length;i++){ if (VAL.test(a[i]) && !/^--list-all$/.test(a[i]) && a[i+1]!=null && !a[i+1].startsWith('--')){ b.push(a[i]+'='+a[i+1]); i++; } else b.push(a[i]); } a = b; }
    if (!this.svc.firewalld.active) return {o:'FirewallD is not running\n',code:252};
    const read = /--(state|get-|list-|query-|info-)/.test(a.join(' '));
    if (!read && this.user!=='root' && a.length) return {e:'Authorization failed.\n    Make sure polkit agent is running or run the application as superuser.\n(tip: sudo firewall-cmd …)\n',code:252};
    if (!read && this.user!=='root') return {e:'Authorization failed.\n',code:252};
    const perm = a.includes('--permanent');
    const zoneArg = (a.find(x=>x.startsWith('--zone='))||'').slice(7) || this.fw.def;
    if (!this.fw.runtime[zoneArg]) return {e:`Error: INVALID_ZONE: ${zoneArg}\n`,code:112};
    const Z = perm ? this.fw.perm[zoneArg] : this.fw.runtime[zoneArg];
    let out = '', code = 0, e='';
    const ok = ()=>{ out += 'success\n'; };
    for (const x of a){
      const [k, ...vv] = x.split('='); const v = vv.join('=');
      switch(k){
        case '--state': out += 'running\n'; break;
        case '--reload': this.fw.runtime = JSON.parse(JSON.stringify(this.fw.perm)); this.fw.reloaded=true; ok(); break;
        case '--complete-reload': this.fw.runtime = JSON.parse(JSON.stringify(this.fw.perm)); ok(); break;
        case '--runtime-to-permanent': this.fw.perm = JSON.parse(JSON.stringify(this.fw.runtime)); ok(); break;
        case '--get-default-zone': out += this.fw.def+'\n'; break;
        case '--set-default-zone': this.fw.def = v; for (const kk of ['runtime','perm']){ const old = Object.values(this.fw[kk]).find(z=>z.interfaces.includes('ens192')); if (old) old.interfaces = old.interfaces.filter(i=>i!=='ens192'); this.fw[kk][v].interfaces.push('ens192'); } ok(); break;
        case '--get-zones': out += FW_ZONES.join(' ')+'\n'; break;
        case '--get-active-zones': { const zs = Object.entries(this.fw.runtime).filter(([n,z])=>z.interfaces.length||z.sources.length); out += zs.map(([n,z])=>n+(n===this.fw.def?' (default)':'')+(z.interfaces.length?'\n  interfaces: '+z.interfaces.join(' '):'')+(z.sources.length?'\n  sources: '+z.sources.join(' '):'')).join('\n')+'\n'; break; }
        case '--get-services': out += Object.keys(FW_SERVICES).concat(['amanda-client','bacula','ceph','freeipa-ldap','imaps','kerberos','ldap','mdns','pop3s','samba-client','smtp','tftp','vnc-server']).sort().join(' ')+'\n'; break;
        case '--info-service': out += `${v}\n  ports: ${FW_SERVICES[v]||''}\n  protocols: \n  source-ports: \n  modules: \n  destination: \n`; break;
        case '--list-all': case '--list-all-zones': {
          const zs = k==='--list-all-zones' ? FW_ZONES : [zoneArg];
          for (const zn of zs){ const z = (perm?this.fw.perm:this.fw.runtime)[zn];
            out += `${zn}${(zn===this.fw.def)?' (default, active)':z.interfaces.length?' (active)':''}\n  target: ${zn==='drop'?'DROP':zn==='block'?'%%REJECT%%':zn==='trusted'?'ACCEPT':'default'}\n  ingress-priority: 0\n  egress-priority: 0\n  icmp-block-inversion: no\n  interfaces: ${z.interfaces.join(' ')}\n  sources: ${z.sources.join(' ')}\n  services: ${z.services.slice().sort().join(' ')}\n  ports: ${z.ports.join(' ')}\n  protocols: \n  forward: yes\n  masquerade: ${z.masq?'yes':'no'}\n  forward-ports: \n  source-ports: \n  icmp-blocks: \n  rich rules: \n${z.rich.map(r=>'\t'+r).join('\n')}${z.rich.length?'\n':''}${zs.length>1?'\n':''}`; }
          break; }
        case '--list-services': out += Z.services.slice().sort().join(' ')+'\n'; break;
        case '--list-ports': out += Z.ports.join(' ')+'\n'; break;
        case '--list-rich-rules': out += Z.rich.join('\n')+(Z.rich.length?'\n':''); break;
        case '--list-sources': out += Z.sources.join(' ')+'\n'; break;
        case '--add-service': if (!FW_SERVICES[v] && !['mdns','samba-client','http3'].includes(v)){ e+=`Error: INVALID_SERVICE: '${v}' not among existing services\n`; code=101; break; } if (Z.services.includes(v)) { out += `Warning: ALREADY_ENABLED: ${v}\nsuccess\n`; break; } Z.services.push(v); ok(); break;
        case '--remove-service': if (!Z.services.includes(v)) { out += `Warning: NOT_ENABLED: ${v}\nsuccess\n`; break; } Z.services = Z.services.filter(s=>s!==v); ok(); break;
        case '--query-service': out += (Z.services.includes(v)?'yes':'no')+'\n'; if (!Z.services.includes(v)) code=1; break;
        case '--add-port': if (!/^\d+(-\d+)?\/(tcp|udp|sctp)$/.test(v)){ e+=`Error: INVALID_PORT: ${v}\n(formát je ČÍSLO/protokol, napr. 8443/tcp)\n`; code=102; break; } if (Z.ports.includes(v)){ out+=`Warning: ALREADY_ENABLED: ${v}\nsuccess\n`; break;} Z.ports.push(v); ok(); break;
        case '--remove-port': Z.ports = Z.ports.filter(p=>p!==v); ok(); break;
        case '--query-port': out += (Z.ports.includes(v)?'yes':'no')+'\n'; break;
        case '--add-source': Z.sources.push(v); ok(); break;
        case '--remove-source': Z.sources = Z.sources.filter(s=>s!==v); ok(); break;
        case '--add-interface': case '--change-interface': for (const z of Object.values(perm?this.fw.perm:this.fw.runtime)) z.interfaces = z.interfaces.filter(i=>i!==v); Z.interfaces.push(v); ok(); break;
        case '--add-masquerade': Z.masq = true; ok(); break;
        case '--remove-masquerade': Z.masq = false; ok(); break;
        case '--add-rich-rule': Z.rich.push(v); ok(); break;
        case '--remove-rich-rule': Z.rich = Z.rich.filter(r=>r!==v); ok(); break;
        case '--panic-on': e += '(panic režim zahodí VŠETKU prevádzku vrátane tvojho SSH. V simulátore ho nezapnem.)\n'; break;
        case '--permanent': case '--zone': break;
        default: if (k.startsWith('--')){ e += `usage: see firewall-cmd man page\nfirewall-cmd: error: unrecognized arguments: ${x}\n`; code=2; }
      }
    }
    if (!a.length) return {e:'usage: see firewall-cmd man page\nNo option specified.\n',code:2};
    return {o:out, e, code};
  }
  c_nft(a){ if (this.user!=='root') return {e:'Operation not permitted (you must be root)\nnetlink: Error: cache initialization failed: Operation not permitted\n',code:1}; if (a.join(' ').startsWith('list ruleset')||a.join(' ').startsWith('list tables')){ const z = this.fw.runtime[this.fw.def]; return `table inet firewalld {\n\tchain filter_IN_${this.fw.def}_allow {\n${z.services.map(s=>(FW_SERVICES[s]||'').split(' ').filter(Boolean).map(p=>`\t\t${p.split('/')[1]} dport ${p.split('/')[0]} accept`).join('\n')).filter(Boolean).join('\n')}\n${z.ports.map(p=>`\t\t${p.split('/')[1]} dport ${p.split('/')[0]} accept`).join('\n')}\n\t}\n}\n(skrátené: firewalld generuje pravidlá do nftables. Neupravuj ich ručne, mení ich firewall-cmd)\n`; } return {e:'nft: v simulátore: sudo nft list ruleset\n'}; }
  c_iptables(a){ return {o:'# Warning: iptables-legacy tables present, use iptables-legacy to see them\n',e:'(iptables je na RHEL 9/10 len prekladač do nftables a je zastaraný. Firewall spravuj cez firewall-cmd.)\n'}; }

  /* ---------------- SELinux ---------------- */
  c_getenforce(){ return this.se.mode+'\n'; }
  c_setenforce(a){ if (this.user!=='root') return {e:'setenforce:  setenforce() failed\n',code:1}; const v=a[0]; if (v==='0'||/^permissive$/i.test(v)) this.se.mode='Permissive'; else if (v==='1'||/^enforcing$/i.test(v)) this.se.mode='Enforcing'; else return {e:'usage:  setenforce [ Enforcing | Permissive | 1 | 0 ]\n',code:1}; return ''; }
  c_sestatus(){ return `SELinux status:                 enabled\nSELinuxfs mount:                /sys/fs/selinux\nSELinux root directory:         /etc/selinux\nLoaded policy name:             targeted\nCurrent mode:                   ${this.se.mode.toLowerCase()}\nMode from config file:          ${(this.read('/etc/selinux/config').match(/^SELINUX=(\w+)/m)||[])[1]||'enforcing'}\nPolicy MLS status:              enabled\nPolicy deny_unknown status:     allowed\nMemory protection checking:     actual (secure)\nMax kernel policy version:      33\n`; }
  c_getsebool(a){ if (a[0]==='-a') return Object.entries(this.se.bools).map(([k,v])=>`${k} --> ${v?'on':'off'}`).join('\n')+'\n'; return a.map(b=> b in this.se.bools ? `${b} --> ${this.se.bools[b]?'on':'off'}` : `Error getting active value for ${b}`).join('\n')+'\n'; }
  c_setsebool(a){ if (this.user!=='root') return {e:'Could not change active booleans: Permission denied\n',code:1}; const P=a.includes('-P'); const w=a.filter(x=>x!=='-P'); const [b,v]=w; if (!(b in this.se.bools)) return {e:`Boolean ${b} is not defined\n`,code:1}; this.se.bools[b] = /^(on|1|true)$/.test(v); if (P) this.se.boolPerm = Object.assign(this.se.boolPerm||{},{[b]:this.se.bools[b]}); return ''; }
  c_restorecon(a){
    if (this.user!=='root') return {e:`restorecon: Could not set context for ${a[a.length-1]}:  Operation not permitted\n`,code:1};
    const R = a.some(x=>/^-\w*R/.test(x)), v = a.some(x=>/^-\w*v/.test(x));
    let out='';
    for (const p of a.filter(x=>!x.startsWith('-'))){
      const abs = this.norm(p); const n = this._lookup(abs);
      if (!n) return {e:`restorecon: lstat(${p}) failed: No such file or directory\n`,code:1};
      const go = (x, path)=>{ const nw = this.defaultCtx(path); if (x.ctx!==nw){ if (v) out += `Relabeled ${path} from ${this.ctxFull(x,path)} to ${this.ctxFull({ctx:nw},path)}\n`; x.ctx = nw; } if (R && x.t==='d') for (const [k,ch] of Object.entries(x.c)) go(ch, path+'/'+k); };
      go(n, abs);
    }
    return out;
  }
  c_chcon(a){ if (this.user!=='root') return {e:'chcon: Operation not permitted\n',code:1}; const t=(a.find(x=>x.startsWith('--type='))||'').slice(7) || (a.includes('-t')?a[a.indexOf('-t')+1]:null); const R=a.includes('-R'); const files=a.filter((x,i)=>!x.startsWith('-') && a[i-1]!=='-t'); for (const f of files){ const n=this.node(f); if (!n) return {e:`chcon: cannot access '${f}': No such file or directory\n`,code:1}; const go=x=>{ x.ctx=t; if (R&&x.t==='d') Object.values(x.c).forEach(go); }; go(n); } return {o:'',e:'(chcon zmení kontext len dočasne: najbližší restorecon alebo relabel ho vráti. Trvalo: semanage fcontext + restorecon)\n'}; }
  c_semanage(a){
    const sub = a[0];
    if (sub==='port'){
      if (a.includes('-l')){ let s='SELinux Port Type              Proto    Port Number\n\n'; const rows = {http_port_t:'tcp      80, 81, 443, 488, 8008, 8009, 8443, 9000', ssh_port_t:'tcp      22', mysqld_port_t:'tcp      1186, 3306, 63132-63164', http_cache_port_t:'tcp      8080, 8118, 8123, 10001-10010'}; for (const [k,v] of Object.entries(rows)){ const extra = this.se.extraPorts.filter(p=>p.t===k).map(p=>p.port); s += `${pad(k,30,true)} ${v.replace(/^tcp\s+/, 'tcp      '+(extra.length?extra.join(', ')+', ':''))}\n`; } return s; }
      if (this.user!=='root') return {e:'ValueError: SELinux policy is not managed or store cannot be accessed.\n',code:1};
      if (a.includes('-a')||a.includes('-m')){ const t=a[a.indexOf('-t')+1]; const port=+a[a.length-1]; if (!this.se.ports[t] && t!=='http_cache_port_t') return {e:`ValueError: Type ${t} is invalid, must be a port type\n`,code:1}; if (this._sePortAllowed(t,port)) return {e:`ValueError: Port tcp/${port} already defined\n`,code:1}; this.se.extraPorts.push({t,port}); return ''; }
      if (a.includes('-d')){ const port=+a[a.length-1]; this.se.extraPorts = this.se.extraPorts.filter(p=>p.port!==port); return ''; }
    }
    if (sub==='fcontext'){
      if (a.includes('-l')) return 'SELinux fcontext                                   type               Context\n\n/var/www(/.*)?                                     all files          system_u:object_r:httpd_sys_content_t:s0\n/srv/([^/]*/)?www(/.*)?                            all files          system_u:object_r:httpd_sys_content_t:s0\n/home/[^/]+/\\.ssh(/.*)?                            all files          unconfined_u:object_r:ssh_home_t:s0\n'+this.se.fctx.map(([r,t])=>`${pad(r,50,true)} all files          system_u:object_r:${t}:s0`).join('\n')+(this.se.fctx.length?'\n':'');
      if (this.user!=='root') return {e:'ValueError: SELinux policy is not managed or store cannot be accessed.\n',code:1};
      if (a.includes('-a')){ const t=a[a.indexOf('-t')+1]; const re=a[a.length-1]; this.se.fctx.unshift([re,t]); return ''; }
      if (a.includes('-d')){ const re=a[a.length-1]; this.se.fctx = this.se.fctx.filter(x=>x[0]!==re); return ''; }
    }
    if (sub==='boolean' && a.includes('-l')) return 'SELinux boolean                State  Default Description\n\n'+Object.entries(this.se.bools).map(([k,v])=>`${pad(k,30,true)} (${v?'on ':'off'}  ,  off)  Allow ${k.replace(/_/g,' ')}`).join('\n')+'\n';
    return {e:'usage: semanage [-h] {import,export,login,user,port,ibpkey,ibendport,interface,module,node,fcontext,boolean,permissive,dontaudit} ...\n',code:2};
  }
  c_ausearch(a){ if (this.user!=='root') return {e:'Error opening config file (Permission denied)\n',code:1}; const avcs = (this.read('/var/log/audit/audit.log')||'').split('\n').filter(l=>l.includes('AVC')); if (this.svc.httpd.failed) avcs.push(`type=AVC msg=audit(1730455330.511:520): avc:  denied  { name_bind } for  pid=3301 comm="httpd" src=${this.httpdPort} scontext=system_u:system_r:httpd_t:s0 tcontext=system_u:object_r:unreserved_port_t:s0 tclass=tcp_socket permissive=0`); if (this._avc) avcs.push('type=AVC msg=audit(1730455400.122:533): avc:  denied  { read } for  pid=3012 comm="httpd" name="index.html" dev="dm-0" ino=1048611 scontext=system_u:system_r:httpd_t:s0 tcontext=unconfined_u:object_r:user_home_t:s0 tclass=file permissive=0'); return avcs.length ? '----\ntime->'+new Date().toString().slice(0,24)+'\n'+avcs.join('\n----\n')+'\n' : '<no matches>\n'; }
  c_sealert(a){ return 'SELinux is preventing /usr/sbin/httpd from read access on the file index.html.\n\n*****  Plugin restorecon (99.5 confidence) suggests   ************************\n\nIf you want to fix the label.\nindex.html default label should be httpd_sys_content_t.\nThen you can run restorecon. The access attempt may have been stopped due to insufficient permissions to access a parent directory in which case try to change the following command accordingly.\nDo\n# /sbin/restorecon -v /var/www/html/index.html\n'; }
  c_audit2why(a,stdin){ return 'type=AVC msg=audit(...): avc:  denied  { read } for comm="httpd" ...\n\n\tWas caused by:\n\t\tMissing type enforcement (TE) allow rule.\n\n\t\tYou can use audit2allow to generate a loadable module to allow this access.\n(Najprv skontroluj kontext súboru: v 9 z 10 prípadov stačí restorecon, nie nové pravidlo.)\n'; }

  /* ---------------- disks & LVM ---------------- */
  c_lsblk(a){
    const f = a.includes('-f');
    const mnt = d => (this.mounts.find(m=>m.dev===d)||{}).dir || '';
    let s = f ? 'NAME          FSTYPE      FSVER    LABEL UUID                                   FSAVAIL FSUSE% MOUNTPOINTS\n' : 'NAME          MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS\n';
    const row = (name, maj, size, type, mp, fs, uuid)=> f ? `${pad(name,13,true)} ${pad(fs||'',11,true)} ${pad(fs==='xfs'?'':fs==='LVM2_member'?'LVM2 001':'',8,true)}       ${pad(uuid||'',38,true)} ${pad(mp?'':'',7)}        ${mp}\n` : `${pad(name,13,true)} ${pad(maj,7,true)}  0 ${pad(size>=1?size+'G':Math.round(size*1024)+'M',4)}  0 ${pad(type,4,true)} ${mp}\n`;
    s += row('sda','8:0',50,'disk','');
    s += row('├─sda1','8:1',1,'part',mnt('/dev/sda1'),'xfs',this.disks['/dev/sda'].parts['/dev/sda1'].uuid);
    s += row('└─sda2','8:2',49,'part','','LVM2_member','Xb3k1d-9fQe-...');
    const lvsOf = vg => Object.entries(this.lvm.lvs).filter(([k])=>k.startsWith(vg+'/'));
    const pvLvs = (pv)=>{ const vg = this.lvm.pvs[pv]?.vg; return vg ? lvsOf(vg) : []; };
    pvLvs('/dev/sda2').forEach(([k,lv],i,arr)=>{ const dev='/dev/mapper/'+k.replace('/','-'); s += row((i===arr.length-1?'  └─':'  ├─')+k.replace('/','-'),'253:'+i,lv.size,'lvm', lv.fs==='swap'?'[SWAP]':mnt(dev), lv.fs, (this.fsInfo[dev]||{}).uuid); });
    const sdb = this.disks['/dev/sdb'];
    s += row('sdb','8:16',10,'disk', mnt('/dev/sdb'), this.lvm.pvs['/dev/sdb']?'LVM2_member':sdb.fs, (this.fsInfo['/dev/sdb']||{}).uuid);
    if (this.lvm.pvs['/dev/sdb']){ const vg=this.lvm.pvs['/dev/sdb'].vg; if (vg!=='rhel') lvsOf(vg).forEach(([k,lv],i,arr)=>{ const dev='/dev/mapper/'+k.replace('/','-'); s += row((i===arr.length-1?'└─':'├─')+k.replace('/','-'),'253:'+(5+i),lv.size,'lvm', mnt(dev), lv.fs, (this.fsInfo[dev]||{}).uuid); }); }
    s += row('sr0','11:0',1,'rom','');
    return s;
  }
  c_blkid(a){
    let s = `/dev/sda1: UUID="${this.disks['/dev/sda'].parts['/dev/sda1'].uuid}" BLOCK_SIZE="512" TYPE="xfs" PARTUUID="7a1e8c02-01"\n/dev/sda2: UUID="Xb3k1d-9fQe-2kLm-Pq7r-Ts4u-Vw5x-Yz6a7b" TYPE="LVM2_member" PARTUUID="7a1e8c02-02"\n`;
    for (const [d,i] of Object.entries(this.fsInfo)) s += `${d}: UUID="${i.uuid}" ${i.fs==='swap'?'':'BLOCK_SIZE="512" '}TYPE="${i.fs}"\n`;
    if (this.lvm.pvs['/dev/sdb']) s += '/dev/sdb: UUID="pV9c2d-1aBc-3dEf-4gHi-5jKl-6mNo-7pQr8s" TYPE="LVM2_member"\n';
    if (a[0]) s = s.split('\n').filter(l=>l.startsWith(a[0]+':')).join('\n')+'\n';
    return s;
  }
  _rootOnly(c){ return this.user!=='root' ? {e:`  WARNING: Running as a non-root user. Functionality may be unavailable.\n  /run/lock/lvm/P_global:aux: open failed: Permission denied\n(tip: sudo ${c} …)\n`,code:5} : null; }
  c_pvs(){ const r=this._rootOnly('pvs'); if (r) return r; return '  PV         VG    Fmt  Attr PSize   PFree  \n'+Object.entries(this.lvm.pvs).map(([d,p])=>{ const used = Object.entries(this.lvm.lvs).filter(([k])=>k.startsWith(p.vg+'/')).reduce((s,[k,l])=>s+l.size,0); const vgPvs = Object.values(this.lvm.pvs).filter(x=>x.vg===p.vg); const free = p.vg? Math.max(0,(p.size - (vgPvs.length>1 ? Math.max(0, used - vgPvs.filter(x=>x!==p).reduce((s,x)=>s+x.size,0)) : used))) : p.size; return `  ${pad(d,10,true)} ${pad(p.vg||'',5,true)} lvm2 a--  <${pad(p.size.toFixed(2)+'g',7)} ${pad(free.toFixed(2)+'g',7)}`; }).join('\n')+'\n'; }
  c_vgs(){ const r=this._rootOnly('vgs'); if (r) return r; return '  VG   #PV #LV #SN Attr   VSize   VFree  \n'+Object.entries(this.lvm.vgs).map(([n,v])=>{ const pvs=Object.values(this.lvm.pvs).filter(p=>p.vg===n); const size=pvs.reduce((s,p)=>s+p.size,0); const used=Object.entries(this.lvm.lvs).filter(([k])=>k.startsWith(n+'/')).reduce((s,[k,l])=>s+l.size,0); return `  ${pad(n,4,true)} ${pad(pvs.length,3)} ${pad(Object.keys(this.lvm.lvs).filter(k=>k.startsWith(n+'/')).length,3)}   0 wz--n- <${pad(size.toFixed(2)+'g',6)} ${pad((size-used).toFixed(2)+'g',6)}`; }).join('\n')+'\n'; }
  c_lvs(){ const r=this._rootOnly('lvs'); if (r) return r; return '  LV   VG   Attr       LSize   Pool Origin Data%  Meta%  Move Log Cpy%Sync Convert\n'+Object.entries(this.lvm.lvs).map(([k,l])=>{ const [vg,lv]=k.split('/'); return `  ${pad(lv,4,true)} ${pad(vg,4,true)} -wi-ao---- ${pad(l.size.toFixed(2)+'g',6)}`; }).join('\n')+'\n'; }
  c_pvcreate(a){ const r=this._rootOnly('pvcreate'); if (r) return r; const d=a.filter(x=>!x.startsWith('-'))[0]; if (!this.disks[d]) return {e:`  No device found for ${d}.\n`,code:5}; if (this.lvm.pvs[d]) return {e:`  Can't initialize physical volume "${d}" of volume group "${this.lvm.pvs[d].vg}" without -ff\n`,code:5}; this.lvm.pvs[d]={vg:null,size:this.disks[d].size-0.01}; return `  Physical volume "${d}" successfully created.\n`; }
  c_vgcreate(a){ const r=this._rootOnly('vgcreate'); if (r) return r; const w=a.filter(x=>!x.startsWith('-')); const [name,...devs]=w; if (this.lvm.vgs[name]) return {e:`  A volume group called ${name} already exists.\n`,code:5}; for (const d of devs){ if (!this.lvm.pvs[d]) { if (this.disks[d]) this.lvm.pvs[d]={vg:null,size:this.disks[d].size-0.01}; else return {e:`  No device found for ${d}.\n`,code:5}; } if (this.lvm.pvs[d].vg) return {e:`  Physical volume '${d}' is already in volume group '${this.lvm.pvs[d].vg}'\n`,code:5}; } devs.forEach(d=>this.lvm.pvs[d].vg=name); this.lvm.vgs[name]={}; return `  Volume group "${name}" successfully created\n`; }
  c_vgextend(a){ const r=this._rootOnly('vgextend'); if (r) return r; const [name,...devs]=a.filter(x=>!x.startsWith('-')); if (!this.lvm.vgs[name]) return {e:`  Volume group "${name}" not found\n`,code:5}; for (const d of devs){ if (!this.lvm.pvs[d]){ if (this.disks[d]) this.lvm.pvs[d]={vg:null,size:this.disks[d].size-0.01}; else return {e:`  No device found for ${d}.\n`,code:5}; } this.lvm.pvs[d].vg=name; } return `  Volume group "${name}" successfully extended\n`; }
  _vgFree(vg){ const size=Object.values(this.lvm.pvs).filter(p=>p.vg===vg).reduce((s,p)=>s+p.size,0); const used=Object.entries(this.lvm.lvs).filter(([k])=>k.startsWith(vg+'/')).reduce((s,[k,l])=>s+l.size,0); return size-used; }
  _parseSize(s, vg, cur){ if (!s) return null; let plus=false; if (s.startsWith('+')){ plus=true; s=s.slice(1); } const m = String(s).match(/^(\d+(?:\.\d+)?)([kKmMgGtT]?)$/); if (m){ let g=+m[1]; const u=m[2].toLowerCase(); if (u==='m') g/=1024; if (u==='k') g/=1048576; if (u==='t') g*=1024; if (u==='') g/=1024; return plus? (cur||0)+g : g; } const p = String(s).match(/^(\d+)%FREE$/i); if (p) return (plus?(cur||0):0)+this._vgFree(vg)*(+p[1]/100); return null; }
  c_lvcreate(a){
    const r=this._rootOnly('lvcreate'); if (r) return r;
    const o=this.opts(a,['n','L','l','name','size']);
    const name = o.v.n||o.v.name; const vg = o.pos[0];
    if (!name || !vg) return {e:'  Please specify a logical volume name (-n) and a volume group.\n  Príklad: lvcreate -n data -L 5G vgdata\n',code:3};
    if (!this.lvm.vgs[vg]) return {e:`  Volume group "${vg}" not found\n  Cannot process volume group ${vg}\n`,code:5};
    const size = this._parseSize(o.v.L||o.v.size||o.v.l, vg);
    if (size==null) return {e:'  Please specify either size or extents\n',code:3};
    if (size > this._vgFree(vg)+0.001) return {e:`  Volume group "${vg}" has insufficient free space (${Math.floor(this._vgFree(vg)*256)} extents): ${Math.ceil(size*256)} required.\n`,code:5};
    this.lvm.lvs[vg+'/'+name] = {size:+size.toFixed(2), fs:null};
    const p='/dev/mapper/'+vg+'-'+name; if (!this.exists(p)) this._mkPath(p,'f',0o660,'root','disk','');
    if (!this.exists('/dev/'+vg)) this._mkPath('/dev/'+vg,'d',0o755);
    const ln=this._mkPath('/dev/'+vg+'/'+name,'l',0o777); ln.tgt='../mapper/'+vg+'-'+name;
    return `  Logical volume "${name}" created.\n`;
  }
  _lvByDev(d){ d = d.replace(/^\/dev\/mapper\//,'').replace(/^\/dev\//,''); let k = d.includes('/') ? d : d.replace(/-(?=[^-]+$)/,'/'); return this.lvm.lvs[k] ? k : null; }
  c_lvextend(a){
    const r=this._rootOnly('lvextend'); if (r) return r;
    const o=this.opts(a,['L','l','size']);
    const dev=o.pos[0]; const k=this._lvByDev(dev||'');
    if (!k) return {e:`  Failed to find logical volume "${dev}"\n`,code:5};
    const vg=k.split('/')[0]; const lv=this.lvm.lvs[k];
    const raw = o.v.L||o.v.size||o.v.l;
    let ns = this._parseSize(raw, vg, lv.size);
    if (ns==null) return {e:'  Please specify either size or extents\n',code:3};
    if (!String(raw).startsWith('+') && /%FREE/i.test(raw)) ns = lv.size + this._vgFree(vg)*(parseInt(raw)/100);
    if (ns <= lv.size) return {e:`  New size given (${ns}g) not larger than existing size (${lv.size}g)\n`,code:5};
    if (ns - lv.size > this._vgFree(vg)+0.001) return {e:`  Insufficient free space: ${Math.ceil((ns-lv.size)*256)} extents needed, but only ${Math.floor(this._vgFree(vg)*256)} available\n`,code:5};
    const old = lv.size; lv.size = +ns.toFixed(2);
    let out = `  Size of logical volume ${k} changed from ${old.toFixed(2)} GiB to ${lv.size.toFixed(2)} GiB.\n  Logical volume ${k} successfully resized.\n`;
    if (o.has('r','resizefs')){ lv.grown = true; const m = this.mounts.find(x=>x.dev==='/dev/mapper/'+k.replace('/','-')); if (m) m.size = lv.size; out += `meta-data=/dev/mapper/${k.replace('/','-')} isize=512    agcount=4\ndata blocks changed from ${Math.round(old*262144)} to ${Math.round(lv.size*262144)}\n`; }
    else out += '  (súborový systém zatiaľ nevie, že zväčšil disk: spusti xfs_growfs /prípojný/bod alebo nabudúce lvextend -r)\n';
    return out;
  }
  c_xfs_growfs(a){ if (this.user!=='root') return {e:'xfs_growfs: Permission denied\n',code:1}; const dir=a.filter(x=>!x.startsWith('-'))[0]; const m=this.mounts.find(x=>x.dir===dir||x.dev===dir); if (!m) return {e:`xfs_growfs: ${dir} is not a mounted XFS filesystem\n`,code:1}; const k=this._lvByDev(m.dev); if (k){ m.size=this.lvm.lvs[k].size; this.lvm.lvs[k].grown=true; } return `meta-data=${m.dev}       isize=512    agcount=4\ndata blocks changed\n`; }
  _mkfs(a, fs){
    if (this.user!=='root') return {e:`mkfs.${fs}: cannot open ${a[a.length-1]}: Permission denied\n`,code:1};
    const d = a.filter(x=>!x.startsWith('-'))[0];
    const k = this._lvByDev(d||'');
    const disk = this.disks[d];
    if (!k && !disk) return {e:`mkfs.${fs}: cannot open ${d}: No such file or directory\n`,code:1};
    if (this.mounts.find(m=>m.dev===d || (k && m.dev==='/dev/mapper/'+k.replace('/','-')))) return {e:`mkfs.${fs}: ${d} contains a mounted filesystem\n`,code:1};
    const uuid = 'e'+Math.random().toString(16).slice(2,9)+'-1c2d-4e5f-8a9b-'+Math.random().toString(16).slice(2,14);
    const dev = k ? '/dev/mapper/'+k.replace('/','-') : d;
    if (k) this.lvm.lvs[k].fs = fs; else disk.fs = fs;
    this.fsInfo[dev] = {fs, uuid};
    return fs==='xfs' ? `meta-data=${d}             isize=512    agcount=4, agsize=327680 blks\n         =                       sectsz=512   attr=2, projid32bit=1\ndata     =                       bsize=4096   blocks=1310720, imaxpct=25\nlog      =internal log           bsize=4096   blocks=16384, version=2\nDiscarding blocks...Done.\n` : `mke2fs 1.46.5 (30-Dec-2021)\nCreating filesystem with 1310720 4k blocks and 327680 inodes\nFilesystem UUID: ${uuid}\nWriting superblocks and filesystem accounting information: done\n`;
  }
  c_mkfs_xfs(a){ return this._mkfs(a,'xfs'); }
  c_mkfs_ext4(a){ return this._mkfs(a,'ext4'); }
  c_mkfs(a){ const t = a.includes('-t') ? a[a.indexOf('-t')+1] : 'ext2'; return this._mkfs(a.filter((x,i)=>x!=='-t'&&a[i-1]!=='-t'), t); }
  c_mkswap(a){ return this._mkfs(a,'swap'); }
  c_swapon(a){ if (a.includes('--show')||!a.length) return 'NAME      TYPE      SIZE USED PRIO\n/dev/dm-1 partition   4G   0B   -2\n'; return ''; }
  _resolveDevSpec(spec){
    if (spec.startsWith('UUID=')){ const u=spec.slice(5).replace(/"/g,''); const e=Object.entries(this.fsInfo).find(([d,i])=>i.uuid===u); if (e) return e[0]; if (u===this.disks['/dev/sda'].parts['/dev/sda1'].uuid) return '/dev/sda1'; return null; }
    const k = this._lvByDev(spec); if (k) return '/dev/mapper/'+k.replace('/','-');
    return spec;
  }
  c_mount(a){
    if (!a.length || a[0]==='-l') return this.mounts.map(m=>`${m.dev} on ${m.dir} type ${m.fs} (rw,relatime,seclabel)`).join('\n')+'\n';
    if (this.user!=='root') return {e:'mount: only root can do that\n',code:1};
    if (a.includes('-a')){
      const fst = (this.read('/etc/fstab')||'').split('\n').filter(l=>l.trim() && !l.trim().startsWith('#'));
      let e='';
      for (const l of fst){
        const [spec, dir, fs] = l.trim().split(/\s+/);
        if (fs==='swap' || this.mounts.find(m=>m.dir===dir)) continue;
        const dev = this._resolveDevSpec(spec);
        if (!dev || !this.fsInfo[dev]){ e += `mount: ${dir}: special device ${spec} does not exist.\n`; continue; }
        if (!this.isDir(dir)){ e += `mount: ${dir}: mount point does not exist.\n`; continue; }
        if (this.fsInfo[dev].fs !== fs){ e += `mount: ${dir}: wrong fs type, bad option, bad superblock on ${dev}, missing codepage or helper program, or other error.\n`; continue; }
        const k=this._lvByDev(dev); this.mounts.push({dev, dir, fs, size: k?this.lvm.lvs[k].size:10, used:0.07});
      }
      this.mountA = !e;
      return {e, code:e?32:0};
    }
    const w = a.filter(x=>!x.startsWith('-') && !['-t','-o'].includes(x));
    const [d0, dir] = w;
    const dev = this._resolveDevSpec(d0||'');
    if (!dir) return {e:'mount: v simulátore: mount ZARIADENIE ADRESÁR  alebo  mount -a\n',code:1};
    if (!this.fsInfo[dev]) return {e:`mount: ${dir}: wrong fs type, bad option, bad superblock on ${d0}, missing codepage or helper program, or other error.\n(zariadenie nemá súborový systém: najprv mkfs.xfs ${d0})\n`,code:32};
    if (!this.isDir(dir)) return {e:`mount: ${dir}: mount point does not exist.\n`,code:32};
    if (this.mounts.find(m=>m.dir===this.norm(dir))) return {e:`mount: ${dir}: ${dev} already mounted on ${dir}.\n`,code:32};
    const k=this._lvByDev(dev); this.mounts.push({dev, dir:this.norm(dir), fs:this.fsInfo[dev].fs, size: k?this.lvm.lvs[k].size:this.disks[dev]?.size||10, used:0.07});
    return '';
  }
  c_umount(a){ if (this.user!=='root') return {e:'umount: only root can unmount\n',code:1}; const t=a[0]; const abs=this.norm(t); const i=this.mounts.findIndex(m=>m.dir===abs||m.dev===t); if (i<0) return {e:`umount: ${t}: not mounted.\n`,code:32}; if (['/','/boot','/run','/dev'].includes(this.mounts[i].dir)) return {e:`umount: ${t}: target is busy.\n`,code:32}; if (this.cwd.startsWith(this.mounts[i].dir+'/')||this.cwd===this.mounts[i].dir) return {e:`umount: ${t}: target is busy.\n(si v tom adresári: najprv cd /)\n`,code:32}; this.mounts.splice(i,1); return ''; }
  c_findmnt(a){ if (a.includes('--verify')){ const r = this.c_mount.call(Object.assign(Object.create(this),{mounts:this.mounts.slice()}),['-a']); return r.e ? {o:r.e+'1 parse errors, 0 errors, 0 warnings\n',code:1} : 'Success, no errors or warnings detected\n'; } return 'TARGET  SOURCE                FSTYPE OPTIONS\n'+this.mounts.map(m=>`${pad(m.dir,7,true)} ${pad(m.dev,21,true)} ${pad(m.fs,6,true)} rw,relatime,seclabel`).join('\n')+'\n'; }
  c_fdisk(a){ if (this.user!=='root') return {e:'fdisk: cannot open /dev/sda: Permission denied\n',code:1}; if (a.includes('-l')) return 'Disk /dev/sda: 50 GiB, 53687091200 bytes, 104857600 sectors\nDisk model: Virtual disk\nDisklabel type: dos\n\nDevice     Boot   Start       End   Sectors Size Id Type\n/dev/sda1  *       2048   2099199   2097152   1G 83 Linux\n/dev/sda2       2099200 104857599 102758400  49G 8e Linux LVM\n\n\nDisk /dev/sdb: 10 GiB, 10737418240 bytes, 20971520 sectors\nDisk model: Virtual disk\n'; return {e:'(fdisk/parted sú interaktívne. V simulátore ukážem len fdisk -l. Celý disk sdb môžeš priamo dať do LVM: pvcreate /dev/sdb)\n'}; }
  c_parted(a){ return this.c_fdisk(['-l']); }

  /* ---------------- ssh / archives / misc ---------------- */
  c_ssh(a){ const t=a.filter(x=>!x.startsWith('-'))[0]||''; if (!t) return {e:'usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-p port] destination [command]\n',code:255}; const host=t.split('@').pop(); const known={db01:1,'db01.firma.local':1,'10.0.20.40':1,mon01:1}; if (!known[host]) return {e:`ssh: Could not resolve hostname ${host}: Name or service not known\n`,code:255}; return {o:`(simulácia) Pripojil by si sa na ${host}. Prvé pripojenie sa pýta na odtlačok kľúča (yes), potom ho uloží do ~/.ssh/known_hosts.\n`}; }
  c_ssh_keygen(a){ const o=this.opts(a,['t','f','C','b','N']); const t=o.v.t||'ed25519'; const f=o.v.f||`${this.home}/.ssh/id_${t}`; if (!this.isDir(this.home+'/.ssh')) this._mkPath(this.home+'/.ssh','d',0o700,this.user,this._ugroup()); const priv=this._mkPath(this.norm(f),'f',0o600,this.user,this._ugroup(),'-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQ...\n-----END OPENSSH PRIVATE KEY-----\n'); priv.ctx='ssh_home_t'; const pub=this._mkPath(this.norm(f)+'.pub','f',0o644,this.user,this._ugroup(),`ssh-${t} AAAAC3NzaC1lZDI1NTE5AAAAIJm8x4o1c2Y8lQk3vT9aZ ${o.v.C||this.user+'@'+this.hostname}\n`); pub.ctx='ssh_home_t'; return `Generating public/private ${t} key pair.\nEnter passphrase (empty for no passphrase): \nYour identification has been saved in ${f}\nYour public key has been saved in ${f}.pub\nThe key fingerprint is:\nSHA256:k3J9vX2mQ8a1L0pZ7cR4tY6uW5eS ${this.user}@${this.hostname}\n`; }
  c_ssh_copy_id(a){ const t=a.filter(x=>!x.startsWith('-'))[0]; if (!this.exists(this.home+'/.ssh/id_ed25519.pub') && !this.exists(this.home+'/.ssh/id_rsa.pub')) return {e:'/usr/bin/ssh-copy-id: ERROR: No identities found\n(najprv si vygeneruj kľúč: ssh-keygen -t ed25519)\n',code:1}; this.copiedKey = t; return `/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s)\n${t}'s password: \n\nNumber of key(s) added: 1\n\nNow try logging into the machine, with:   "ssh '${t}'"\nand check to make sure that only the key(s) you wanted were added.\n`; }
  c_scp(a){ return a.length<2 ? {e:'usage: scp [-346ABCOpqRrsTv] source ... target\n',code:1} : `(simulácia) ${a[a.length-2]} → ${a[a.length-1]}  100%   12KB   1.2MB/s   00:00\n(na RHEL 9+ scp interne používa protokol SFTP)\n`; }
  c_rsync(a){ return '(simulácia) sending incremental file list\n…\nsent 12,480 bytes  received 412 bytes  25,784.00 bytes/sec\ntotal size is 51,200  speedup is 3.97\n'; }
  c_tar(a){
    const o = this.opts(a.map((x,i)=>i===0&&!x.startsWith('-')?'-'+x:x), ['f','C']);
    const f = o.v.f;
    if (!f) return {e:"tar: Refusing to write archive contents to terminal (missing -f option?)\ntar: Error is not recoverable: exiting now\n",code:2};
    if (o.has('c')){
      const files = o.pos; const list = [];
      const walk=(p,n)=>{ list.push({p:p+(n.t==='d'?'/':''), d:n.t==='d', m:n.m&0o7777, c:n.t==='f'?n.c:'', u:n.u, g:n.g}); if (n.t==='d' && this.can(n,4)) for (const k of Object.keys(n.c).sort()) walk(p.replace(/\/$/,'')+'/'+k, n.c[k]); };
      for (const x of files){ const n=this.node(x); if (!n) return {e:`tar: ${x}: Cannot stat: No such file or directory\n`,code:2}; walk(x.replace(/^\//,'').replace(/\/$/,''),n); }
      const r = this._writeFile(f, 'TAR:'+JSON.stringify(list), false); if (r) return {e:r.replace('-bash','tar'),code:2};
      const node = this.node(f); node.big = 2048*list.length + (o.has('z','j','J')?0:10240);
      return {o: o.has('v') ? list.map(x=>x.p).join('\n')+'\n' : '', e: files.some(x=>x.startsWith('/')) ? "tar: Removing leading `/' from member names\n" : '', code:0};
    }
    if (o.has('t')||o.has('x')){
      const n = this.node(f); if (!n) return {e:`tar: ${f}: Cannot open: No such file or directory\n`,code:2};
      if (!this.can(n,4)) return {e:`tar: ${f}: Cannot open: Permission denied\n`,code:2};
      let list=[]; try { list = JSON.parse(n.c.slice(4)); } catch(e){ return {e:'tar: This does not look like a tar archive\n',code:2}; }
      list = list.map(x=>typeof x==='string'?{p:x,d:x.endsWith('/'),m:x.endsWith('/')?0o755:0o644,c:'(obnovené z archívu)\n',u:this.user,g:this._ugroup()}:x);
      if (o.has('x')){
        const base = o.v.C ? this.norm(o.v.C) : this.cwd;
        const bn = this._lookup(base); if (!bn || bn.t!=='d') return {e:`tar: ${o.v.C}: Cannot open: No such file or directory\n`,code:2};
        if (!this.can(bn,2)) return {e:`tar: ${list[0]?list[0].p:''}: Cannot mkdir: Permission denied\ntar: Exiting with failure status due to previous errors\n`,code:2};
        for (const it of list){
          const p = (base==='/'?'':base)+'/'+it.p.replace(/\/$/,'');
          const own = this.user==='root' ? (it.u||'root') : this.user, grp = this.user==='root' ? (it.g||'root') : this._ugroup();
          if (it.d){ let x=this._lookup(p); if (!x){ x=this._mkPath(p,'d',it.m||0o755,own,grp); } x.ctx=this.defaultCtx(p); x.mt=new Date(); }
          else { const [d]=this.parentOf(p); if (!this.exists(d)) { const dd=this._mkPath(d,'d',0o755,own,grp); dd.ctx=this.defaultCtx(d);} const x=this._mkPath(p,'f',it.m||0o644,own,grp,it.c||''); x.ctx=this.defaultCtx(p); x.mt=new Date(); }
        }
      }
      return (o.has('t')||o.has('v')) ? list.map(x=>o.has('v')&&o.has('t')?`${permStr(x.d?'d':'f',x.m||0o644)} ${x.u||'root'}/${x.g||'root'} ${pad((x.c||'').length,6)} 2026-10-20 09:00 ${x.p}`:x.p).join('\n')+'\n' : '';
    }
    return {e:"tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\n",code:2};
  }
  c_gzip(a){ const f=a.filter(x=>!x.startsWith('-'))[0]; const n=this.node(f); if (!n) return {e:`gzip: ${f}: No such file or directory\n`,code:1}; const [d,b]=this.parentOf(this.norm(f)); const dn=this._lookup(d); delete dn.c[b]; dn.c[b+'.gz']=n; return ''; }
  c_gunzip(a){ const f=a[0]; const n=this.node(f); if (!n) return {e:`gzip: ${f}: No such file or directory\n`,code:1}; const [d,b]=this.parentOf(this.norm(f)); const dn=this._lookup(d); delete dn.c[b]; dn.c[b.replace(/\.gz$/,'')]=n; return ''; }
  c_crontab(a){
    const o=this.opts(a,['u']); const u=o.v.u||this.user;
    if (o.v.u && this.user!=='root') return {e:'must be privileged to use -u\n',code:1};
    if (o.has('l')) return this.crontabs[u] ? this.crontabs[u] : {e:`no crontab for ${u}\n`,code:1};
    if (o.has('r')){ delete this.crontabs[u]; return ''; }
    if (o.has('e')) return {o:'\x1bEDITCRON '+u};
    return {e:'usage:\tcrontab [-u user] file\n\tcrontab [ -u user ] [ -i ] { -e | -l | -r }\n',code:1};
  }
  c_at(){ return {e:'bash: at: command not found\n(at nie je v minimálnej inštalácii. Na jednorazové úlohy: systemd-run --on-active=1h prikaz)\n',code:127}; }
  c_systemd_run(a){ if (this.user!=='root') return {e:'Failed to start transient timer unit: Access denied\n',code:1}; return 'Running timer as unit: run-u412.timer\nWill run service as unit: run-u412.service\n'; }
  c_needs_restarting(a){ return a.includes('-r') ? {o:'Core libraries or services have been updated since boot-up:\n  * kernel\n\nReboot is required to fully utilize these updates.\nMore information: https://access.redhat.com/solutions/27943\n',code:1} : '2211 : -bash\n'; }
  c_sos(a){ if (this.user!=='root') return {e:'You must run sos as root\n',code:1}; return '\nsos report (version 4.9.0)\n\nThis command will collect diagnostic and configuration information from\nthis Red Hat Enterprise Linux system and installed applications.\n…\nYour sos report has been generated and saved in:\n\t/var/tmp/sosreport-'+this.hostname+'-2026-11-01-xkqpfe.tar.xz\n\n(Tento súbor pošleš Red Hat podpore k tiketu.)\n'; }
  c_dmesg(a){ if (this.user!=='root') return {e:'dmesg: read kernel buffer failed: Operation not permitted\n',code:1}; return '[    0.000000] Linux version '+this.kernel+'\n[    0.000000] Command line: BOOT_IMAGE=(hd0,msdos1)/vmlinuz-'+this.kernel+' root=/dev/mapper/rhel-root ro\n[    1.204411] sd 0:0:0:0: [sda] 104857600 512-byte logical blocks: (53.7 GB/50.0 GiB)\n[    1.204998] sd 0:0:1:0: [sdb] 20971520 512-byte logical blocks: (10.7 GB/10.0 GiB)\n[    3.881020] XFS (dm-0): Mounting V5 Filesystem\n[    4.112308] vmxnet3 0000:0b:00.0 ens192: renamed from eth0\n'; }
  c_lsof(a){ return 'COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nsshd    1032 root    3u  IPv4  21841      0t0  TCP *:ssh (LISTEN)\n'; }
  c_man(a){ const c=a.filter(x=>!x.startsWith('-'))[0]; if (!c) return {e:'What manual page do you want?\nFor example, try \'man man\'.\n',code:1}; return {o:'\x1bMAN '+c}; }
  c_help(){ return {o:'\x1bHELP'}; }
  c_vim(a){ return {o:'\x1b'+(this.user==='root'?'EDITR ':'EDIT ')+(a.filter(x=>!x.startsWith('-')&&!x.startsWith('+'))[0]||'')}; }
  c_vi(a){ return this.c_vim(a); }
  c_nano(a){ return this.c_vim(a); }
  c_bash(a){ if (a[0]) { const n=this.node(a[0]); if (!n) return {e:`bash: ${a[0]}: No such file or directory\n`,code:127}; if (!this.can(n,4)) return {e:`bash: ${a[0]}: Permission denied\n`,code:126}; const save=n.m; n.m|=0o111; const r=this.c__runscript(a[0], a.slice(1)); n.m=save; return r; } return ''; }
  c_sh(a){ return this.c_bash(a); }
  c_source(){ return ''; }
  c_c(a){ return {o:'\x1bASK '+a.join(' ')}; }
  c_bootc(a){ if (this.ver!==10) return {e:'bash: bootc: command not found\n(image mode s bootc je v RHEL 10 a od RHEL 9.6; tento simulovaný server beží v package mode)\n',code:127}; return 'No staged image present\nCurrent booted image: (systém beží v package mode, nie image mode)\n'; }
}

window.Machine = Machine;
window.MachineData = {PKG_DB, SVC_DEF, FW_SERVICES, PKG_INSTALLED_DEFAULT, FW_ZONES, human, permStr, lsDate, globToRe, pad, MON, z2};
})();
