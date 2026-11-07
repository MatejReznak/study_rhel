/* =========================================================
   Ukážkové skripty a dáta pre kapitolu 26 (čítanie a písanie skriptov)
   zdieľané: simulátor (súbory v ~/skripty/citaj) aj text kapitoly
   ========================================================= */
(function(){
const S = window.BASH_SAMPLES = {};

S.zaloha = `#!/bin/bash
# zaloha.sh – zbalí adresár do .tar.gz a zmaže zálohy staršie ako N dní
# Použitie: zaloha.sh ADRESAR [DNI]
set -euo pipefail

ZDROJ=\${1:?Použitie: $0 ADRESAR [DNI]}
DNI=\${2:-7}
CIEL=/home/admin/zalohy
DATUM=$(date +%F)
MENO=$(basename "$ZDROJ")
SUBOR="$CIEL/$MENO-$DATUM.tar.gz"

log() {
    echo "$(date '+%F %T') $*"
    logger -t zaloha "$*"
}

[ -d "$ZDROJ" ] || { log "CHYBA: $ZDROJ neexistuje"; exit 1; }
mkdir -p "$CIEL"

log "Balím $ZDROJ do $SUBOR"
if tar -czf "$SUBOR" "$ZDROJ" 2>/dev/null; then
    log "OK, veľkosť $(du -h "$SUBOR" | cut -f1)"
else
    log "CHYBA: tar zlyhal"
    exit 2
fi

find "$CIEL" -name "$MENO-*.tar.gz" -mtime +"$DNI" -print -delete
log "Hotovo"
`;

S.disk = `#!/bin/bash
# disk.sh – upozorní, keď je súborový systém plnší ako PRAH percent
# Použitie: disk.sh [PRAH]      návratový kód: 0 = OK, 1 = niečo je plné
PRAH=\${1:-80}
STAV=0

while read -r fs velkost obsadene volne pct kam; do
    P=\${pct%\\%}
    if (( P >= PRAH )); then
        echo "VAROVANIE: $kam je na $P % ($obsadene z $velkost)"
        STAV=1
    fi
done < <(df -hP -x tmpfs -x devtmpfs | tail -n +2)

if [ "$STAV" -eq 0 ]; then
    echo "OK: všetko je pod $PRAH %"
fi
exit "$STAV"
`;

S.sluzby = `#!/bin/bash
# sluzby.sh – skontroluje služby, nebežiace skúsi spustiť
SLUZBY=(sshd firewalld chronyd crond)
ZLE=()

for s in "\${SLUZBY[@]}"; do
    if systemctl is-active --quiet "$s"; then
        printf '%-10s %s\\n' "$s" "beží"
    else
        printf '%-10s %s\\n' "$s" "NEBEŽÍ, skúšam spustiť"
        sudo systemctl start "$s" || ZLE+=("$s")
    fi
done

if [ \${#ZLE[@]} -gt 0 ]; then
    echo "Nepodarilo sa spustiť: \${ZLE[*]}" >&2
    exit 1
fi
`;

S.pouzivatelia = `#!/bin/bash
# pouzivatelia.sh – založí účty zo súboru CSV (meno,skupina,komentár)
# Použitie: pouzivatelia.sh [-n] SUBOR.csv     -n = len vypíš, nič nemeň
SUCHO=0
while getopts "n" opt; do
    case $opt in
        n) SUCHO=1 ;;
        *) echo "Použitie: $0 [-n] SUBOR.csv" >&2; exit 2 ;;
    esac
done
shift $((OPTIND - 1))
CSV=\${1:?Chýba súbor CSV}

while IFS=, read -r meno skupina komentar; do
    [[ -z $meno || \${meno:0:1} == "#" ]] && continue
    if id "$meno" &>/dev/null; then
        echo "preskakujem $meno (už existuje)"
        continue
    fi
    if (( SUCHO )); then
        echo "useradd -m -G $skupina -c \\"$komentar\\" $meno"
    else
        sudo useradd -m -G "$skupina" -c "$komentar" "$meno" && echo "založený $meno"
    fi
done < "$CSV"
`;

S.zly = `#!/bin/bash
# zly.sh – má vypísať počet účtov a či existuje používateľ admin
SUBOR = /etc/passwd
POCET=$(wc -l < $SUBOR)
echo "Účtov: $POCET"
if [$POCET -gt 10]; then
    echo "Veľa účtov"
fi
if grep -q "^admin:" $SUBOR
    echo "admin existuje"
fi
`;

S.servery = `web01.firma.local 80
web02.firma.local 443
db01.firma.local 5432
`;
S.csv = `# meno,skupina,komentar
jana,wheel,Jana Nová - admin
peter,wheel,Peter Malý
admin,wheel,tento už existuje
`;

/* ---------- vloženie do simulátora ---------- */
if (window.Machine){
  const P = window.Machine.prototype;
  const origReset = P.reset;
  P.reset = function(){
    origReset.apply(this, arguments);
    const H = '/home/admin';
    const F = (p, c, m)=>this._mkPath(p,'f',m||0o644,'admin','admin',c);
    const D = p=>{ if (!this.node(p)) this._mkPath(p,'d',0o755,'admin','admin'); };
    D(H+'/skripty/citaj'); D(H+'/data');
    F(H+'/skripty/citaj/zaloha.sh', S.zaloha, 0o755);
    F(H+'/skripty/citaj/disk.sh', S.disk, 0o755);
    F(H+'/skripty/citaj/sluzby.sh', S.sluzby, 0o755);
    F(H+'/skripty/citaj/pouzivatelia.sh', S.pouzivatelia, 0o755);
    F(H+'/skripty/zly.sh', S.zly, 0o755);
    F(H+'/skripty/windows.sh', '#!/bin/bash\r\n# skopírované z Windows\r\necho "Záloha prebehla OK"\r\n', 0o755);
    F(H+'/data/servery.txt', S.servery);
    F(H+'/data/pouzivatelia.csv', S.csv);
    this.errexit = false; this.nounset = false; this.pipefail = false; this.traceOn = false;
    this.arr = {}; this._fns = {};
  };
}
})();
