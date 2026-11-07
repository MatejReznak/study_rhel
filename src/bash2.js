/* =========================================================
   KAPITOLA 26: Bash skripty do hĺbky – čítanie a písanie
   + Rozlúštiť (vstavané príkazy), dril, úlohy, postup
   ========================================================= */
(function(){
const S = window.BASH_SAMPLES;
const CH = c => window.CHAPTERS.push(c);
const ran = (m,n,pred)=>m.log.some(e=>e.name===n && (pred ? pred(e) : e.code===0));
const H = '/home/admin';
/* spusti skript izolovane (kontrola úlohy nesmie meniť stav terminálu) */
const runIso = (m, path, args)=>{
  const n = m.node(path); if (!n || n.t!=='f') return null;
  const sv = {env:JSON.stringify(m.env||{}), arr:JSON.stringify(m.arr||{}), fns:m._fns, log:m.log.length, lc:m.lastCode, pa:m.posArgs, cwd:m.cwd, hist:m.history.length, ul:(m._ulog||[]).length, user:m.user, x:m.traceOn, e:m.errexit, u:m.nounset};
  let r;
  try { m.traceOn=false; m.errexit=false; m.nounset=false; r = /\r/.test(n.c) ? {o:'',e:'CRLF',code:126} : m._runScript(n.c, args, path); }
  catch(e){ r = {o:'', e:String(e), code:1}; }
  finally { m.env = JSON.parse(sv.env); m.arr = JSON.parse(sv.arr); m._fns = sv.fns; m.log.length = sv.log; m.lastCode = sv.lc; m.posArgs = sv.pa; m.cwd = sv.cwd; m.history.length = sv.hist; if (m._ulog) m._ulog.length = sv.ul; m.user = sv.user; m.traceOn = sv.x; m.errexit = sv.e; m.nounset = sv.u; }
  return r;
};
window.runIso = runIso;
/* anotovaný výpis: poznámky sa priradia k riadkom podľa textu */
const ann = (text, notes)=>{
  const used = new Set();
  return text.replace(/\n$/,'').split('\n').map(line=>{
    const k = notes.findIndex((n,i)=>!used.has(i) && line.includes(n[0]));
    if (k<0) return [line, ''];
    used.add(k); return [line, notes[k][1]];
  });
};

CH({n:26, title:'Bash skripty do hĺbky: čítanie a písanie', short:'Skripty do hĺbky',
goal:'Prečítať cudzí skript a za pár minút vedieť, čo robí, čo mení a či je bezpečné ho spustiť. Napísať vlastný skript, ktorý kontroluje argumenty, číta súbory, loguje, vracia správny kód a dá sa spustiť z cronu.',
body:[
['p','Kapitola 19 ti dala základy (premenné, if, for). V práci však častejšie <b>čítaš</b> skripty, ktoré napísal niekto iný: zálohy, kontroly, inštalačné skripty od dodávateľov, skripty v cron. Táto kapitola je o tom, ako ich rýchlo pochopiť, bezpečne vyskúšať a ako písať vlastné tak, aby ich po tebe niekto vedel prečítať. V termináli tejto stránky bežia aj zložitejšie veci: <code>case</code>, <code>while read</code>, funkcie, polia, <code>${X:-…}</code>, <code>set -euo pipefail</code>, <code>getopts</code>, <code>trap</code>.'],
['h','Ako čítať cudzí skript (postup na 2 minúty)'],
['table',['Krok','Čo hľadáš','Prečo'],[
 ['1. Prvý riadok','<code>#!/bin/bash</code> alebo <code>#!/bin/sh</code>','akým programom beží. <code>sh</code> nepozná <code>[[ ]]</code> ani polia'],
 ['2. Hlavička','komentár s „Použitie:“, autor, dátum','aké argumenty skript čaká'],
 ['3. <code>set …</code>','<code>set -euo pipefail</code>','či skript skončí pri prvej chybe, alebo ide ďalej aj po chybe'],
 ['4. Premenné hore','<code>CIEL=</code>, <code>DNI=</code>, <code>${1:-…}</code>','cesty a nastavenia: <b>kde</b> skript pracuje'],
 ['5. Funkcie','<code>meno() { … }</code>','zatiaľ len prelistuj, čítaj ich, keď sa zavolajú'],
 ['6. Hlavná časť','príkazy pod funkciami','čo skript robí v poradí'],
 ['7. Čo MENÍ','<code>rm</code>, <code>mv</code>, <code>&gt;</code>, <code>sed -i</code>, <code>useradd</code>, <code>systemctl</code>, <code>dnf</code>, <code>curl … | bash</code>','toto sú miesta, kde môže niečo pokaziť'],
 ['8. Ako končí','<code>exit 0</code>, <code>exit 1</code>, <code>exit 2</code>','čo uvidí cron alebo monitoring'],
 ['9. Kam píše','<code>logger</code>, <code>&gt;&gt; /var/log/…</code>, <code>echo</code>','kde potom hľadáš, čo sa stalo']]],
['warn','Neznámy skript nikdy nespúšťaj hneď cez <code>sudo</code> a nikdy nespúšťaj <code>curl … | bash</code> bez toho, aby si si ho najprv stiahol a prečítal. Najprv <code>bash -n</code> (len kontrola syntaxe), potom spusti ako bežný používateľ alebo na testovacom serveri. Pri nebezpečných riadkoch si pred príkaz daj <code>echo</code>: skript vypíše, čo by spravil, a nič nezmení.'],
['cmd','bash -n skripty/zly.sh','skontroluje syntax, nič nespustí'],
['cmd','bash -x skripty/citaj/disk.sh 10','pred každým príkazom vypíše + príkaz: vidíš, kade skript ide'],
['h','Slovník znakov: čo je čo'],
['p','Toto je ťahák na čítanie. Keď v skripte uvidíš niečo nejasné, nájdeš to tu (alebo to vlož do Rozlúštiť príkaz, ktorý vie vysvetliť aj celý skript po riadkoch).'],
['table',['Zápis','Význam','Príklad'],[
 ['<code>$0</code>','meno skriptu, ako bol spustený','<code>echo "Použitie: $0 SUBOR"</code>'],
 ['<code>$1</code> … <code>$9</code>, <code>${10}</code>','argumenty skriptu alebo funkcie','<code>./zaloha.sh /etc 14</code>: $1=/etc, $2=14'],
 ['<code>$#</code>','počet argumentov','<code>[ $# -lt 1 ] && exit 2</code>'],
 ['<code>"$@"</code>','všetky argumenty, každý zvlášť (aj s medzerami)','<code>for f in "$@"; do …</code>'],
 ['<code>$*</code>','všetky argumenty ako jeden text','do správ: <code>echo "Argumenty: $*"</code>'],
 ['<code>$?</code>','návratový kód posledného príkazu (0 = OK)','<code>grep -q x f; echo $?</code>'],
 ['<code>$$</code>','PID tohto skriptu','<code>/tmp/zaloha.$$</code>'],
 ['<code>$!</code>','PID posledného procesu spusteného na pozadí (<code>&amp;</code>)','<code>sleep 60 &amp; echo $!</code>'],
 ['<code>${X}</code>','hodnota premennej (zátvorky oddelia meno od textu)','<code>"${MENO}_old"</code>'],
 ['<code>${X:-def}</code>','ak je X prázdne, použi def (X sa nezmení)','<code>DNI=${2:-7}</code>'],
 ['<code>${X:=def}</code>','ak je X prázdne, nastav ho na def',''],
 ['<code>${X:?správa}</code>','ak je X prázdne, vypíš správu a skonči','<code>rm -rf "${ADR:?}/"*</code> chráni pred <code>rm -rf /*</code>'],
 ['<code>${#X}</code>','dĺžka textu','<code>${#HESLO}</code>'],
 ['<code>${X#vzor}</code>, <code>${X##vzor}</code>','odstráň zo začiatku najkratšiu / najdlhšiu zhodu','<code>${F##*/}</code> = meno bez cesty'],
 ['<code>${X%vzor}</code>, <code>${X%%vzor}</code>','odstráň z konca najkratšiu / najdlhšiu zhodu','<code>${F%.gz}</code>, <code>${F%/*}</code> = adresár'],
 ['<code>${X/a/b}</code>, <code>${X//a/b}</code>','nahraď prvý / všetky výskyty','<code>${D//-/_}</code>'],
 ['<code>${X^^}</code>, <code>${X,,}</code>','na VEĽKÉ / malé písmená',''],
 ['<code>${X:0:3}</code>','podreťazec: od 0, 3 znaky','<code>${meno:0:1}</code> = prvé písmeno'],
 ['<code>$(príkaz)</code>, <code>`príkaz`</code>','výstup príkazu (spätné apostrofy sú stará forma)','<code>DATUM=$(date +%F)</code>'],
 ['<code>$((výraz))</code>','celočíselná aritmetika','<code>$((DNI * 24))</code>'],
 ['<code>(( výraz ))</code>','aritmetická podmienka alebo zmena premennej','<code>(( P &gt;= 80 ))</code>, <code>((N++))</code>'],
 ['<code>[ … ]</code> = <code>test</code>','podmienka (súbory, texty, čísla)','<code>[ -f "$F" ]</code>'],
 ['<code>[[ … ]]</code>','bash podmienka: vie <code>&amp;&amp;</code>, <code>||</code>, vzory <code>==</code> a regex <code>=~</code>','<code>[[ $F == *.log ]]</code>'],
 ['<code>a &amp;&amp; b</code>','b spusti len ak a uspel','<code>cd /data &amp;&amp; rm -f *.tmp</code>'],
 ['<code>a || b</code>','b spusti len ak a zlyhal','<code>cd /data || exit 1</code>'],
 ['<code>a | b</code>','výstup a ide na vstup b',''],
 ['<code>a &amp;</code>','spusti na pozadí',''],
 ['<code>&gt;</code> / <code>&gt;&gt;</code>','výstup do súboru: prepíš / pripoj',''],
 ['<code>2&gt;&amp;1</code>','chyby tam, kam ide výstup (poradie: <code>&gt; log 2&gt;&amp;1</code>)','<code>prikaz &gt;&gt; /var/log/x.log 2&gt;&amp;1</code>'],
 ['<code>&amp;&gt;/dev/null</code>','zahoď výstup aj chyby',''],
 ['<code>&gt;&amp;2</code>','vypíš na chybový výstup (chybové hlášky)','<code>echo "CHYBA" &gt;&amp;2</code>'],
 ['<code>&lt; súbor</code>','vstup zo súboru','<code>done &lt; servery.txt</code>'],
 ['<code>&lt;&lt;EOF … EOF</code>','heredoc: viac riadkov textu na vstup (<code>&lt;&lt;\'EOF\'</code> = bez rozbalenia premenných)','zápis konfigurácie'],
 ['<code>&lt;&lt;&lt; "$X"</code>','here-string: text premennej na vstup','<code>grep -q x &lt;&lt;&lt; "$X"</code>'],
 ['<code>&lt;(príkaz)</code>','výstup príkazu ako „súbor“','<code>done &lt; &lt;(df -hP)</code>'],
 ['<code>{ a; b; }</code>','skupina príkazov (napr. za <code>||</code>)','<code>[ -d x ] || { echo chyba; exit 1; }</code>'],
 ['<code>( a; b )</code>','podshell: zmeny premenných a <code>cd</code> sa nevrátia',''],
 ['<code>\\</code> na konci riadku','príkaz pokračuje na ďalšom riadku',''],
 ['<code>#</code>','komentár do konca riadku','']]],
['h','Čítanie v praxi 1: záloha'],
['p','Skript, aký nájdeš na mnohých serveroch. Prečítaj si ho po riadkoch a potom ho spusti.'],
['annot','~/skripty/citaj/zaloha.sh', ann(S.zaloha, [
 ['#!/bin/bash','beží v bashi'],
 ['# Použitie','<b>vždy</b> si prečítaj: skript čaká adresár a voliteľne počet dní'],
 ['set -euo pipefail','<b>-e</b> skonči pri prvej chybe, <b>-u</b> chyba pri nedefinovanej premennej, <b>pipefail</b> rúra zlyhá, ak zlyhá ktorýkoľvek príkaz v nej'],
 ['ZDROJ=','$1 je povinný: bez neho <code>${1:?…}</code> vypíše použitie a skončí'],
 ['DNI=','$2 je voliteľný, predvolene 7'],
 ['CIEL=','<b>kam</b> sa zálohuje: prvé, čo ťa zaujíma'],
 ['DATUM=','dnešný dátum, napr. 2026-11-06'],
 ['MENO=','meno adresára bez cesty: /etc → etc'],
 ['SUBOR=','výsledný súbor, napr. /home/admin/zalohy/etc-2026-11-06.tar.gz'],
 ['log() {','funkcia: vypíše správu s časom a zapíše ju aj do journalu so značkou zaloha'],
 ['$(date','$* = všetky argumenty funkcie ako text'],
 ['logger -t','v journale ju nájdeš: <code>journalctl -t zaloha</code>'],
 ['[ -d "$ZDROJ" ] ||','ak adresár neexistuje, zaloguj chybu a skonči s kódom 1'],
 ['mkdir -p','vytvor cieľ, ak chýba (-p: nevadí, ak existuje)'],
 ['if tar','podmienkou je priamo príkaz: rozhoduje jeho návratový kód'],
 ['du -h','veľkosť vytvoreného archívu'],
 ['exit 2','iný kód pre inú chybu: z kódu vieš, čo sa pokazilo'],
 ['find "$CIEL"','<b>MAŽE</b>: staré zálohy tohto adresára staršie ako DNI dní. Pred prvým spustením si nechaj vypísať bez <code>-delete</code>'],
 ['log "Hotovo"','koniec, kód 0']]), 'cat skripty/citaj/zaloha.sh'],
['cmd','./skripty/citaj/zaloha.sh','bez argumentu: vypíše použitie'],
['cmd','./skripty/citaj/zaloha.sh skripty 14; echo "kód: $?"',''],
['cmd','journalctl -t zaloha','čo skript zapísal do logu'],
['h','Čítanie v praxi 2: kontrola disku a čítanie výstupu po riadkoch'],
['annot','~/skripty/citaj/disk.sh', ann(S.disk, [
 ['# Použitie','kód 0/1: monitoring alebo cron podľa neho vie, či je problém'],
 ['PRAH=','prvý argument alebo 80'],
 ['while read -r','číta riadky a rozdelí ich podľa medzier do premenných: 6 stĺpcov df'],
 ['P=${pct','z „85%“ odstráni znak % na konci (<code>%</code> v <code>${ }</code> = odstráň z konca)'],
 ['if (( P >= PRAH ))','aritmetické porovnanie, premenné bez $'],
 ['STAV=1','zapamätaj si, že niečo je plné'],
 ['done < <(','vstup cyklu je výstup df (bez tmpfs) bez hlavičky. Prečo nie <code>df | while</code>? Pozri nižšie'],
 ['exit "$STAV"','skript vráti 0 alebo 1']])],
['cmd','./skripty/citaj/disk.sh 10; echo "kód: $?"','prah 10 %: uvidíš varovania'],
['warn','<b>Rúra do while stratí premenné.</b> <code>df | while read …; do STAV=1; done</code> beží v podshelli, takže po cykle je <code>STAV</code> stále 0. Preto <code>done &lt; súbor</code> alebo <code>done &lt; &lt;(príkaz)</code>. Je to jedna z najčastejších chýb v skriptoch a v tomto termináli si ju vieš vyskúšať.'],
['pre','N=0; cat data/servery.txt | while read -r l; do N=$((N+1)); done; echo $N     # 0\nN=0; while read -r l; do N=$((N+1)); done < data/servery.txt; echo $N     # 3'],
['h','Čítanie v praxi 3: polia a služby'],
['annot','~/skripty/citaj/sluzby.sh', ann(S.sluzby, [
 ['SLUZBY=(','pole: zoznam hodnôt v zátvorkách'],
 ['ZLE=()','prázdne pole na zlyhané služby'],
 ['for s in','<code>"${POLE[@]}"</code> = každý prvok zvlášť'],
 ['is-active --quiet','nič nevypíše, len vráti 0 (beží) alebo nenulový kód'],
 ['printf \'%-10s','zarovnaný výpis: text doľava na 10 znakov'],
 ['sudo systemctl start','ak spustenie zlyhá, pridaj službu do poľa ZLE (<code>+=</code>)'],
 ['${#ZLE[@]}','počet prvkov poľa'],
 ['>&2','chybová hláška na chybový výstup'],
 ['exit 1','aspoň jedna služba sa nespustila']])],
['h','Čítanie v praxi 4: argumenty, CSV a suchý beh'],
['annot','~/skripty/citaj/pouzivatelia.sh', ann(S.pouzivatelia, [
 ['# Použitie','<code>-n</code> = „dry run“: dobrý zvyk pri skriptoch, ktoré menia systém'],
 ['while getopts "n"','spracuje prepínače: "n" = prepínač -n bez hodnoty ("d:" by bol -d s hodnotou v $OPTARG)'],
 ['n) SUCHO=1','case: pri -n zapni suchý beh'],
 ['*) echo','neznámy prepínač: použitie a kód 2'],
 ['shift $((OPTIND','odstráň spracované prepínače, v $1 ostane súbor'],
 ['CSV=','povinný argument'],
 ['while IFS=, read -r','IFS=, : rozdeľ riadok podľa čiarok (len pre tento read). -r: neinterpretuj \\'],
 ['[[ -z $meno','preskoč prázdne riadky a komentáre (prvý znak #)'],
 ['if id "$meno"','existuje už účet? <code>&amp;&gt;/dev/null</code> zahodí výpis, zaujíma nás len kód'],
 ['if (( SUCHO ))','pri -n len vypíš príkaz'],
 ['sudo useradd','inak naozaj založ účet'],
 ['done < "$CSV"','vstup cyklu je súbor CSV']])],
['cmd','cat data/pouzivatelia.csv',''],
['cmd','./skripty/citaj/pouzivatelia.sh -n data/pouzivatelia.csv','najprv nasucho'],
['h','Písanie: šablóna, z ktorej začni'],
['pre',`#!/bin/bash
# meno.sh – jedna veta, čo skript robí
# Použitie: meno.sh [-n] ARGUMENT
# Autor, dátum, kde beží (cron? ručne?)
set -euo pipefail

readonly LOG_TAG=$(basename "$0" .sh)

log()  { echo "$(date '+%F %T') $*"; logger -t "$LOG_TAG" "$*"; }
chyba(){ echo "CHYBA: $*" >&2; logger -t "$LOG_TAG" -p user.err "$*"; exit 1; }
pouzitie(){ echo "Použitie: $0 [-n] ARGUMENT" >&2; exit 2; }

[ $# -ge 1 ] || pouzitie
[ "$(id -u)" -eq 0 ] || chyba "spusti cez sudo"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT        # dočasné súbory sa zmažú aj pri chybe

log "Začínam s $1"
# ... samotná práca ...
log "Hotovo"`],
['table',['Pravidlo','Prečo'],[
 ['Premenné vždy v úvodzovkách: <code>"$F"</code>','súbor s medzerou v mene by sa inak rozpadol na dva argumenty'],
 ['<code>set -euo pipefail</code> na začiatok','skript nepokračuje po chybe a nepoužije prázdnu premennú (preklep v mene)'],
 ['Pri mazaní <code>"${ADR:?}"</code>','ak je ADR prázdne, <code>rm -rf "$ADR/"*</code> by zmazal <code>/*</code>'],
 ['<code>cd /niekam || exit 1</code>','ak cd zlyhá, ďalšie príkazy by bežali v nesprávnom adresári'],
 ['Rôzne <code>exit</code> kódy','0 OK, 1 chyba, 2 zlé použitie. Cron a monitoring čítajú kód, nie text'],
 ['Chyby na <code>&gt;&amp;2</code>, záznamy do <code>logger</code>','chyby sa nepomiešajú s výstupom, záznamy nájdeš v journale'],
 ['Plné cesty k súborom (<code>/var/log/…</code>)','cron spúšťa skript z domovského adresára a s krátkym PATH'],
 ['Dočasné súbory cez <code>mktemp</code> + <code>trap … EXIT</code>','žiadne pevné /tmp/subor, ktorý si dva behy prepíšu'],
 ['Heslá nie v skripte','skript býva čitateľný pre viacerých. Súbor s heslom s právami 600, alebo trezor'],
 ['Komentár hore: čo, použitie, kto','o pol roka to budeš čítať ty alebo kolega']]],
['h','Argumenty a case'],
['pre',`case "$1" in
    start|zacni)  systemctl start appka ;;
    stop)         systemctl stop appka ;;
    status)       systemctl status appka --no-pager ;;
    *)            echo "Použitie: $0 start|stop|status" >&2; exit 2 ;;
esac`],
['list',['<code>case</code> porovnáva text so vzormi zhora nadol, prvý zhodný vyhrá','<code>|</code> = viac vzorov naraz, <code>*</code> = čokoľvek (predvolená vetva)','každá vetva končí <code>;;</code>, celé končí <code>esac</code> (case odzadu)','<code>shift</code> posunie argumenty: $2 sa stane $1. Pri prepínačoch <code>getopts</code> (pozri pouzivatelia.sh)']],
['h','Čítanie súboru po riadkoch'],
['pre',`# správne: každý riadok celý, aj s medzerami
while IFS= read -r riadok; do
    echo "riadok: $riadok"
done < /etc/hosts

# stĺpce oddelené čiarkou
while IFS=, read -r meno skupina; do
    echo "$meno je v $skupina"
done < data/pouzivatelia.csv

# zle: for rozdelí text podľa medzier, nie po riadkoch
for riadok in $(cat /etc/hosts); do echo "$riadok"; done`],
['h','Heredoc: viac riadkov naraz'],
['pre',`cat > /etc/motd <<EOF
Server: $(hostname)
Spravuje: tím Linux, kontakt linux@firma.sk
EOF

cat <<'EOF' > ~/skripty/pomoc.txt
Text sa zapíše presne, $PREMENNE sa nerozbalia
EOF`],
['h','Návratové kódy a podmienky z príkazov'],
['table',['Zápis','Kedy pravda (kód 0)'],[
 ['<code>if grep -q "chyba" log; then</code>','text sa v súbore našiel (-q = nič nevypisuj)'],
 ['<code>if systemctl is-active --quiet httpd; then</code>','služba beží'],
 ['<code>if id jana &amp;&gt;/dev/null; then</code>','používateľ existuje'],
 ['<code>if ping -c1 -W1 db01 &amp;&gt;/dev/null; then</code>','server odpovedá'],
 ['<code>if [ -s "$F" ]; then</code>','súbor existuje a nie je prázdny'],
 ['<code>if ! command -v jq &amp;&gt;/dev/null; then</code>','príkaz NIE je nainštalovaný'],
 ['<code>if (( $(wc -l &lt; f) &gt; 100 )); then</code>','súbor má viac ako 100 riadkov']]],
['h','Ladenie: keď skript nefunguje'],
['table',['Nástroj','Čo ukáže'],[
 ['<code>bash -n skript.sh</code>','chyby syntaxe (chýbajúce then, fi, done, úvodzovka). Nič nespustí'],
 ['<code>bash -x skript.sh</code>','každý príkaz pred spustením s „+“. Vidíš hodnoty premenných'],
 ['<code>set -x</code> … <code>set +x</code> v skripte','trasovanie len pre podozrivú časť'],
 ['<code>echo "DEBUG: X=$X" &gt;&amp;2</code>','rýchly výpis hodnoty'],
 ['<code>echo $?</code> hneď po príkaze','návratový kód'],
 ['<code>cat -A skript.sh</code>','skryté znaky: <code>^M</code> na konci riadkov = súbor z Windows, <code>^I</code> = tabulátor'],
 ['<code>shellcheck skript.sh</code>','najlepšia automatická kontrola chýb (balík z EPEL, na firemných serveroch nemusí byť)']]],
['table',['Chyba','Príčina','Oprava'],[
 ['<code>X: command not found</code> pri <code>X = 5</code>','medzery okolo =','<code>X=5</code>'],
 ['<code>[5: command not found</code>','chýba medzera v <code>[ ]</code>','<code>[ 5 -gt 3 ]</code>'],
 ['<code>syntax error near unexpected token `fi\'</code>','chýba <code>then</code> (alebo <code>do</code> pri <code>done</code>)','<code>if …; then</code>'],
 ['<code>unexpected end of file</code>','chýba <code>fi</code>, <code>done</code>, <code>esac</code>, <code>}</code> alebo úvodzovka','dopíš koniec bloku'],
 ['<code>/bin/bash^M: bad interpreter</code>','súbor z Windows (CRLF)','<code>sed -i \'s/\\r$//\' skript.sh</code>'],
 ['<code>Permission denied</code>','chýba právo x, alebo /tmp je noexec','<code>chmod +x</code> alebo <code>bash skript.sh</code>'],
 ['<code>unary operator expected</code>','prázdna premenná v <code>[ $X = a ]</code>','úvodzovky: <code>[ "$X" = a ]</code>'],
 ['<code>X: unbound variable</code>','set -u a premenná nie je nastavená (preklep?)','nastav ju alebo <code>${X:-}</code>'],
 ['Ručne ide, v cron nie','iný PATH, iný adresár, žiadny terminál','plné cesty, <code>&gt;&gt; /var/log/x.log 2&gt;&amp;1</code>']]],
['h','Kde skripty bývajú a ako ich spúšťať'],
['table',['Kde','Pre koho'],[
 ['<code>/usr/local/bin</code>','skripty pre všetkých (je v PATH). Vlastník root, práva 755'],
 ['<code>/usr/local/sbin</code>','správcovské skripty (root). Práva 750 alebo 700'],
 ['<code>~/bin</code>, <code>~/.local/bin</code>','tvoje osobné skripty'],
 ['<code>/etc/cron.d/meno</code>','plánované spúšťanie (kapitola 17)'],
 ['systemd timer','moderná náhrada cronu s logom v journale (kapitola 17)']]],
['pre',`# /etc/cron.d/zaloha – každú noc o 2:15 ako root, výstup do logu,
# flock zabráni dvom behom naraz
15 2 * * * root flock -n /run/zaloha.lock /usr/local/sbin/zaloha.sh /etc 14 >> /var/log/zaloha.log 2>&1`],
['tip','Skript vložený do <a href="#rozlustit">Rozlúštiť príkaz</a> sa vysvetlí po riadkoch: čo je premenná, podmienka, cyklus, čo ktorý príkaz robí a ktoré riadky niečo menia.']
],
quiz:[
 {q:'Čo vypíše <code>F=/var/log/httpd/access_log.1; echo ${F##*/}</code>?',o:['/var/log/httpd','access_log.1','access_log','.1'],a:1,w:'## zo začiatku odstráni najdlhšiu zhodu so vzorom */ , teda celú cestu. Ostane meno súboru (ako basename).'},
 {q:'Skript má <code>PRAH=${1:-80}</code>. Spustíš ho bez argumentu. Akú hodnotu má PRAH?',o:['prázdnu','1','80','skript skončí chybou'],a:2,w:':- dosadí predvolenú hodnotu, keď je $1 prázdne. Chybu by spravil zápis ${1:?…}.'},
 {q:'<code>N=0; cat f | while read l; do ((N++)); done; echo $N</code> vypíše 0, hoci f má 5 riadkov. Prečo?',o:['read nečíta zo rúry','cyklus za rúrou beží v podshelli a zmeny N sa stratia','((N++)) nefunguje v cykle','echo sa vykoná skôr ako cyklus'],a:1,w:'Riešenie: while … done < f (alebo < <(príkaz)).'},
 {q:'Čo spraví <code>set -euo pipefail</code>?',o:['Zapne farebný výstup','Skript skončí pri chybe príkazu, pri nedefinovanej premennej a pri zlyhaní ktoréhokoľvek príkazu v rúre','Vypisuje príkazy pred spustením','Spustí skript ako root'],a:1,w:'Vypisovanie príkazov je set -x.'},
 {q:'Ktorý zápis pošle do súboru log aj výstup, aj chyby?',o:['prikaz 2>&1 > log','prikaz > log 2>&1','prikaz > log 2> /dev/null','prikaz | log'],a:1,w:'Poradie sa číta zľava: najprv výstup do log, potom chyby tam, kam ide výstup. Pri 2>&1 > log idú chyby ešte na obrazovku.'},
 {q:'<code>./zaloha.sh</code> hlási <code>/bin/bash^M: bad interpreter: No such file or directory</code>. Príčina?',o:['bash nie je nainštalovaný','súbor má konce riadkov z Windows','chýba chmod +x','zlá cesta v PATH'],a:1,w:'^M je znak \\r. Over cat -A, oprav sed -i \'s/\\r$//\' zaloha.sh.'},
 {q:'Čo je v skripte rozdiel medzi <code>"$@"</code> a <code>$*</code>?',o:['Žiadny','"$@" zachová každý argument zvlášť (aj s medzerami), $* ich spojí do jedného textu','$* obsahuje aj meno skriptu','"$@" funguje len vo funkcii'],a:1,w:'Na odovzdanie argumentov ďalej používaj vždy "$@".'},
 {q:'Riadok <code>[ -d "$CIEL" ] || { echo "chýba $CIEL" >&2; exit 1; }</code> znamená:',o:['Ak CIEL existuje, skonči','Ak CIEL nie je adresár, vypíš chybu a skonči s kódom 1','Vytvor adresár CIEL','Vypíš chybu vždy'],a:1,w:'|| spustí skupinu { } len vtedy, keď test zlyhá.'},
 {q:'Cron spúšťa skript, ktorý ručne funguje, ale v crone hlási <code>command not found</code>. Najpravdepodobnejšia príčina?',o:['Cron nemá práva','Cron má krátky PATH','Skript má zlé konce riadkov','Cron nepozná bash'],a:1,w:'Plné cesty (/usr/sbin/…) alebo PATH=… na začiatok skriptu či do crontabu.'}
],
ex:[
 {t:'Prečítaj <code>~/skripty/citaj/zaloha.sh</code> a spusti ho tak, aby zbalil adresár <code>skripty</code> a staré zálohy držal <b>14 dní</b>.',h:'cat skripty/citaj/zaloha.sh; potom ./skripty/citaj/zaloha.sh ADRESAR DNI',sol:'cat skripty/citaj/zaloha.sh\n./skripty/citaj/zaloha.sh skripty 14\necho $?\nls zalohy',check:m=>m.log.some(e=>/zaloha\.sh$/.test(e.name) && e.args.includes('14') && /skripty\/?$/.test(e.args[0]||'') && e.code===0) && Object.keys((m.node(H+'/zalohy')||{c:{}}).c||{}).some(k=>/^skripty-.*\.tar\.gz$/.test(k))},
 {t:'Skript <code>~/skripty/zly.sh</code> má 3 chyby. Nájdi ich (<code>bash -n</code>, potom spúšťaj) a oprav ho vo <code>vim</code>, aby vypísal <code>Účtov: …</code> aj <code>admin existuje</code> bez chybových hlášok.',h:'SUBOR = → SUBOR= ; [$POCET -gt 10] → [ "$POCET" -gt 10 ] ; chýba then za if grep …',sol:'bash -n skripty/zly.sh\nvim skripty/zly.sh\n# SUBOR=/etc/passwd\n# if [ "$POCET" -gt 10 ]; then\n# if grep -q "^admin:" "$SUBOR"; then\n./skripty/zly.sh',tsol:m=>{ m.node(H+'/skripty/zly.sh').c = S.zly.replace('SUBOR = ','SUBOR=').replace('[$POCET -gt 10]','[ "$POCET" -gt 10 ]').replace('if grep -q "^admin:" $SUBOR\n','if grep -q "^admin:" "$SUBOR"; then\n'); m.run('bash -n skripty/zly.sh'); m.run('./skripty/zly.sh'); },check:m=>{ const r = runIso(m, H+'/skripty/zly.sh', []); return !!r && /Účtov: *\d+/.test(r.o) && /admin existuje/.test(r.o) && !r.e; }},
 {t:'<code>~/skripty/windows.sh</code> niekto skopíroval z Windows a nedá sa spustiť. Zisti prečo, oprav ho a spusti.',h:'./skripty/windows.sh; cat -A skripty/windows.sh; sed -i \'s/\\r$//\' …',sol:"./skripty/windows.sh\ncat -A skripty/windows.sh\nsed -i 's/\\r$//' skripty/windows.sh\n./skripty/windows.sh",check:m=>{ const n = m.node(H+'/skripty/windows.sh'); return !!n && !/\r/.test(n.c) && m.log.some(e=>/windows\.sh$/.test(e.name) && e.code===0); }},
 {t:'Napíš <code>~/skripty/port.sh</code>: dostane číslo portu. Ak na ňom niečo počúva (TCP), vypíše <code>PORT otvorený</code> a skončí s kódom 0, inak <code>PORT zatvorený</code> a kód 1. Bez argumentu vypíše použitie na chybový výstup a skončí s kódom 2. Sprav ho spustiteľným.',h:'[ $# -eq 1 ] || { echo "Použitie: $0 PORT" >&2; exit 2; } ; if ss -tln | grep -q ":$1 "; then …',sol:"cat > skripty/port.sh <<'EOF'\n#!/bin/bash\n[ $# -eq 1 ] || { echo \"Použitie: $0 PORT\" >&2; exit 2; }\nif ss -tln | grep -q \":$1 \"; then\n    echo \"$1 otvorený\"\nelse\n    echo \"$1 zatvorený\"\n    exit 1\nfi\nEOF\nchmod +x skripty/port.sh\n./skripty/port.sh 22; ./skripty/port.sh 8080; ./skripty/port.sh",tsol:m=>{ const sol = window.CHAPTERS.find(c=>c.n===26).ex[3].sol; const r = m._runScript(sol.split('\n').slice(0,10).join('\n'), [], '-bash'); m.run('chmod +x skripty/port.sh'); },check:m=>{ const n = m.node(H+'/skripty/port.sh'); if (!n || !(n.m & 0o100)) return false; const a = runIso(m, H+'/skripty/port.sh', ['22']), b = runIso(m, H+'/skripty/port.sh', ['9999']), c = runIso(m, H+'/skripty/port.sh', []); return a.code===0 && /otvoren/.test(a.o) && b.code===1 && /zatvoren/.test(b.o) && c.code===2 && !/otvoren|zatvoren/.test(c.o); }},
 {t:'Cyklom <code>while read</code> vytvor zo súboru <code>~/data/servery.txt</code> (meno a port oddelené medzerou) súbor <code>~/data/ciele.txt</code> s riadkami v tvare <code>meno:port</code>.',h:'while read -r meno port; do echo "$meno:$port"; done < data/servery.txt > data/ciele.txt',sol:'while read -r meno port; do echo "$meno:$port"; done < data/servery.txt > data/ciele.txt\ncat data/ciele.txt',check:m=>{ const t = (m.read(H+'/data/ciele.txt')||'').trim(); return t === S.servery.trim().split('\n').map(l=>l.split(' ').join(':')).join('\n'); }},
 {t:'Spusti <code>~/skripty/citaj/pouzivatelia.sh</code> najprv <b>nasucho</b> (prepínač <code>-n</code>) na <code>~/data/pouzivatelia.csv</code>, skontroluj výpis a potom ho spusti naozaj.',h:'./skripty/citaj/pouzivatelia.sh -n data/pouzivatelia.csv, potom bez -n',sol:'./skripty/citaj/pouzivatelia.sh -n data/pouzivatelia.csv\n./skripty/citaj/pouzivatelia.sh data/pouzivatelia.csv\nid jana; id peter',check:m=>m.log.some(e=>/pouzivatelia\.sh$/.test(e.name) && e.args.includes('-n')) && /^jana:/m.test(m.read('/etc/passwd')||'') && /^peter:/m.test(m.read('/etc/passwd')||'')}
]});

/* odkaz z kapitoly 19 */
{ const c19 = window.CHAPTERS.find(c=>c.n===19); if (c19 && !c19.body.some(b=>/kapitol[ae] 26/.test(String(b[1])))) c19.body.push(['tip','Čítanie cudzích skriptov, case, while read, funkcie, polia, getopts, ladenie a typické chyby sú v <a href="#kapitola-26">kapitole 26</a>.']); }

/* ---------- Rozlúštiť: vstavané príkazy a nástroje skriptov ---------- */
const R = window.CMDREF;
R.bash = {d:'Shell. Spustí skript alebo príkaz.', s:'bash [-n|-x] skript.sh [argumenty]', f:[['-n','len skontroluj syntax, nič nespúšťaj'],['-x','vypisuj každý príkaz pred spustením (+ príkaz)'],['-c "príkazy"','spusti text ako príkazy'],['-e','skonči pri prvej chybe (ako set -e)'],['-u','chyba pri nedefinovanej premennej (ako set -u)']]};
R.set = {d:'Nastaví správanie shellu (v skripte zvyčajne na začiatku).', s:'set -euo pipefail', f:[['-e','skonči skript, keď príkaz zlyhá (okrem podmienok a && ||)'],['-u','nedefinovaná premenná je chyba'],['-o pipefail','rúra zlyhá, keď zlyhá ktorýkoľvek príkaz v nej, nielen posledný'],['-x','vypisuj príkazy pred spustením'],['+x','vypni vypisovanie'],['-o OPCIA','zapni voľbu podľa mena (errexit, nounset, xtrace, pipefail)']]};
R.read = {d:'Načíta riadok zo vstupu do premenných.', s:'read [-r] [-p TEXT] PREMENNÁ…', f:[['-r','neinterpretuj \\ (používaj vždy)'],['-p TEXT','vypíš výzvu (otázku)'],['-s','nezobrazuj písané znaky (heslo)'],['-t N','čakaj najviac N sekúnd'],['-a POLE','ulož slová do poľa'],['IFS=,','(pred read) oddeľovač stĺpcov len pre tento read']]};
R.case = {d:'Porovná text so vzormi a vykoná zhodnú vetvu.', s:'case "$X" in vzor1|vzor2) … ;; *) … ;; esac', f:[['vzor)','vetva pre vzor (* ? [abc] ako pri súboroch)'],['a|b)','viac vzorov'],['*)','všetko ostatné'],[';;','koniec vetvy'],['esac','koniec case']]};
R.getopts = {d:'Spracuje prepínače skriptu (-v, -d hodnota).', s:'while getopts "vd:" opt; do case $opt in …; esac; done', f:[['"vd:"','povolené prepínače; dvojbodka = prepínač má hodnotu'],['$opt','aktuálny prepínač'],['$OPTARG','hodnota prepínača s :'],['$OPTIND','index ďalšieho argumentu; potom shift $((OPTIND-1))']]};
R.shift = {d:'Posunie argumenty: $2 sa stane $1.', s:'shift [N]', f:[['N','posuň o N']]};
R.trap = {d:'Príkaz, ktorý sa vykoná pri ukončení alebo signáli.', s:"trap 'príkazy' EXIT INT TERM", f:[['EXIT','pri akomkoľvek skončení skriptu (upratovanie)'],['INT','Ctrl+C'],['TERM','kill'],['ERR','pri chybe príkazu']]};
R.local = {d:'Premenná platná len vo funkcii.', s:'local X=hodnota', f:[]};
R.exit = {d:'Ukončí skript s návratovým kódom.', s:'exit [KÓD]', f:[['0','úspech'],['1','všeobecná chyba'],['2','zlé použitie (argumenty)'],['126','nedá sa spustiť (práva)'],['127','príkaz nenájdený']]};
R.source = {d:'Načíta súbor do aktuálneho shellu (premenné, funkcie). Skrátene: . súbor', s:'source súbor', f:[]};
R.test = {d:'Podmienka (to isté ako [ ]).', s:'test -f súbor', f:[['-f','existuje súbor'],['-d','existuje adresár'],['-e','existuje čokoľvek'],['-s','existuje a nie je prázdny'],['-r / -w / -x','dá sa čítať / zapisovať / spustiť'],['-z / -n','text je prázdny / nie je prázdny'],['= / !=','texty sa rovnajú / nerovnajú'],['-eq -ne -gt -lt -ge -le','porovnanie čísel'],['!','negácia']]};
R['['] = R.test;
R['[['] = {d:'Podmienka bashu: ako [ ], navyše &&, ||, vzory a regex.', s:'[[ $F == *.log && -s $F ]]', f:[['==','vzor (*.log), ak pravá strana nie je v úvodzovkách'],['=~','regulárny výraz'],['&& ||','a / alebo vnútri podmienky']].concat(R.test.f)};
R.mktemp = {d:'Vytvorí dočasný súbor s jedinečným menom a vypíše jeho cestu.', s:'TMP=$(mktemp) | mktemp -d', f:[['-d','vytvor adresár']]};
R.flock = {d:'Zámok: zabráni dvom behom naraz (typicky v cron).', s:'flock -n /run/meno.lock príkaz', f:[['-n','ak je zamknuté, hneď skonči (nečakaj)'],['-w N','čakaj najviac N sekúnd']]};
R.logger = R.logger || {d:'Zapíše správu do systémového logu (journal).', s:'logger -t ZNAČKA "správa"', f:[['-t ZNAČKA','značka; hľadáš: journalctl -t ZNAČKA'],['-p PRIORITA','napr. user.err, user.warning']]};
R.printf = R.printf || {d:'Formátovaný výpis.', s:"printf '%-10s %s\\n' a b", f:[['%s','text'],['%d','číslo'],['%-10s','text zarovnaný doľava na 10 znakov'],['\\n','nový riadok (printf ho nepridá sám)']]};
R.declare = {d:'Deklarácia premennej s vlastnosťou.', s:'declare -a POLE | declare -r KONST=1', f:[['-a','pole'],['-A','asociatívne pole (kľúč → hodnota)'],['-r','len na čítanie'],['-i','celé číslo'],['-x','export']]};
R.readonly = {d:'Premenná, ktorú nemožno zmeniť.', s:'readonly X=1', f:[]};
R.dos2unix = {d:'Prevedie konce riadkov z Windows (CRLF) na Linux. Balík dos2unix; bez neho: sed -i \'s/\\r$//\' súbor', s:'dos2unix súbor', f:[]};

/* ---------- dril ---------- */
window.DRILL.push(
 {id:'b_n', ch:26, q:'Skontroluj syntax skriptu <code>skripty/zly.sh</code> bez jeho spustenia.', a:'bash -n skripty/zly.sh', w:'-n = noexec, len parsovanie.', check:m=>m.log.some(e=>e.name==='bash' && e.args[0]==='-n' && /zly\.sh/.test(e.args[1]||''))},
 {id:'b_x', ch:26, q:'Spusti <code>skripty/citaj/disk.sh</code> s prahom 10 tak, aby sa pred každým príkazom vypísal (trasovanie).', a:'bash -x skripty/citaj/disk.sh 10', w:'-x vypisuje „+ príkaz“.', check:m=>m.log.some(e=>e.name==='bash' && e.args[0]==='-x' && /disk\.sh/.test(e.args[1]||''))},
 {id:'b_cata', ch:26, q:'Zobraz <code>skripty/windows.sh</code> so skrytými znakmi (koniec riadku, \\r).', a:'cat -A skripty/windows.sh', w:'^M$ na konci = CRLF z Windows.', check:m=>ran(m,'cat',e=>e.flags.has('A') && e.args.some(a=>/windows\.sh/.test(a)))},
 {id:'b_crlf', ch:26, q:'Odstráň zo <code>skripty/windows.sh</code> windowsové konce riadkov (\\r) príkazom <code>sed</code>.', a:"sed -i 's/\\r$//' skripty/windows.sh", w:'\\r$ = znak \\r na konci riadku.', check:m=>{ const n = m.node(H+'/skripty/windows.sh'); return !!n && !/\r/.test(n.c); }},
 {id:'b_rc', ch:26, q:'Spusti <code>./skripty/citaj/disk.sh 10</code> a hneď potom vypíš jeho návratový kód.', a:'./skripty/citaj/disk.sh 10; echo $?', w:'$? = kód posledného príkazu, musí byť hneď za ním.', check:m=>{ const i = m.log.findIndex(e=>/disk\.sh$/.test(e.name)); return i>=0 && m.log.slice(i+1).some(e=>e.name==='echo' && e.args.some(a=>/^\d+$/.test(a))); }},
 {id:'b_chmod', ch:26, q:'Skript <code>skripty/novy.sh</code> sa nedá spustiť (Permission denied). Pridaj vlastníkovi právo spúšťať.', a:'chmod u+x skripty/novy.sh', w:'Alebo chmod +x. Bez práva x funguje len bash skripty/novy.sh.', setup:m=>{ m._mkPath(H+'/skripty/novy.sh','f',0o644,'admin','admin','#!/bin/bash\necho "nový skript"\n'); }, check:m=>!!((m.node(H+'/skripty/novy.sh')||{}).m & 0o100)},
 {id:'b_param', ch:26, q:'Do premennej <code>F</code> ulož <code>/var/log/messages.1</code> a vypíš len meno súboru bez cesty pomocou <code>${…}</code> (nie basename).', a:'F=/var/log/messages.1; echo ${F##*/}', w:'## odstráni najdlhší začiatok zhodný s */', check:m=>(m.env||{}).F==='/var/log/messages.1' && m.history.some(h=>/\$\{F##\*\/\}/.test(h))},
 {id:'b_def', ch:26, q:'Vypíš hodnotu premennej <code>PRAH</code>, a ak je prázdna, vypíš <code>80</code> (jedným <code>${…}</code> zápisom).', a:'echo ${PRAH:-80}', w:':- = predvolená hodnota, premenná sa nezmení.', check:m=>m.history.some(h=>/\$\{PRAH:-80\}/.test(h))},
 {id:'b_while', ch:26, q:'Cyklom <code>while read</code> zapíš do <code>data/mena.txt</code> len prvý stĺpec (mená) zo <code>data/servery.txt</code>.', a:'while read -r meno port; do echo "$meno"; done < data/servery.txt > data/mena.txt', w:'read rozdelí riadok do premenných, posledná dostane zvyšok.', check:m=>(m.read(H+'/data/mena.txt')||'').trim()===S.servery.trim().split('\n').map(l=>l.split(' ')[0]).join('\n')},
 {id:'b_for', ch:26, q:'Cyklom <code>for</code> zbaľ gzipom každý súbor <code>*.log</code> v adresári <code>logy</code>.', a:'for f in logy/*.log; do gzip "$f"; done', w:'Premennú v úvodzovkách, glob vyrieši shell.', setup:m=>{ ['a','b','c'].forEach(x=>m._mkPath(H+'/logy/'+x+'.log','f',0o644,'admin','admin','riadok\n')); }, check:m=>['a','b','c'].every(x=>m.node(H+'/logy/'+x+'.log.gz') && !m.node(H+'/logy/'+x+'.log'))},
 {id:'b_logger', ch:26, q:'Zapíš do systémového logu správu <code>test zálohy</code> so značkou <code>zaloha</code>.', a:'logger -t zaloha "test zálohy"', w:'Nájdeš ju: journalctl -t zaloha.', check:m=>(m._ulog||[]).some(x=>x.tag==='zaloha' && /test zálohy/.test(x.line))},
 {id:'b_jt', ch:26, q:'Zobraz v journale len správy so značkou <code>zaloha</code>.', a:'journalctl -t zaloha', w:'-t = identifier (značka z logger -t).', setup:m=>{ m.run(' logger -t zaloha "Záloha OK"'); }, check:m=>ran(m,'journalctl',e=>e.args.includes('-t') && e.args.includes('zaloha'))},
 {id:'b_case', ch:26, q:'Napíš do terminálu <code>case</code> pre premennú <code>A=stop</code>: pri <code>start</code> vypíše <code>štart</code>, pri <code>stop</code> vypíše <code>stop</code>, inak <code>?</code>.', a:'A=stop; case "$A" in start) echo štart ;; stop) echo stop ;; *) echo "?" ;; esac', w:'Vetvy končia ;; a celé esac.', check:m=>m.history.some(h=>/case\s+"?\$A"?\s+in/.test(h) && /esac/.test(h))},
 {id:'b_trace', ch:26, q:'Zapni v aktuálnom shelli vypisovanie príkazov pred ich spustením.', a:'set -x', w:'Vypneš set +x.', check:m=>!!m.traceOn}
);

/* ---------- úlohy na skutočnom serveri ---------- */
window.LAB_TASKS[26] = [
 {t:'Vytvor <code>~/bin/kontrola.sh</code> zo šablóny v kapitole (set -euo pipefail, log, kontrola argumentu), <code>chmod +x</code> a spusti ho bez argumentu aj s argumentom. Potom <code>journalctl -t kontrola</code>.', ok:'Bez argumentu kód 2 a použitie, s argumentom záznamy v journale.'},
 {t:'Stiahni si ľubovoľný skript (napr. <code>/usr/bin/needs-restarting</code> je Python, ale <code>/usr/bin/zless</code> alebo <code>/usr/sbin/weak-modules</code> sú shell). Prečítaj prvých 40 riadkov podľa postupu na 2 minúty: shebang, set, premenné, funkcie, čo mení.', ok:'Vieš povedať, čo skript robí, bez spustenia.', w:'Konkrétne cesty sa môžu medzi verziami líšiť; shellové skripty nájdeš cez file /usr/bin/* | grep "shell script".'},
 {t:'Vyrob si CRLF súbor: <code>printf \'#!/bin/bash\\r\\necho ok\\r\\n\' &gt; crlf.sh; chmod +x crlf.sh; ./crlf.sh</code>. Prezri <code>cat -A crlf.sh</code> a oprav cez <code>sed -i \'s/\\r$//\'</code>.', ok:'Videl si „bad interpreter“ a ^M, po oprave skript beží.'},
 {t:'Pridaj do <code>crontab -e</code> riadok <code>*/5 * * * * flock -n /tmp/k.lock $HOME/bin/kontrola.sh test &gt;&gt; $HOME/kontrola.log 2&gt;&amp;1</code>, počkaj 5 minút a pozri <code>~/kontrola.log</code> a <code>journalctl -t kontrola</code>. Potom riadok zmaž.', ok:'Skript bežal z cronu a výstup je v logu.'}
];

/* ---------- postup ---------- */
window.RUNBOOKS.push({id:'skript', t:'Skript nefunguje (ručne alebo v cron)', sym:'Permission denied, bad interpreter, command not found, syntax error, beží ručne ale nie v cron, skript skončí potichu', ch:[26,19,17], inc:['cron'],
 first:[['ls -l SKRIPT','má právo x? kto je vlastník?'],['head -1 SKRIPT','shebang: #!/bin/bash?'],['cat -A SKRIPT | head','^M na konci riadkov = Windows'],['bash -n SKRIPT','syntax bez spustenia'],['bash -x SKRIPT ARG','kde presne sa to pokazí'],['echo $?','návratový kód po behu']],
 causes:[['Permission denied',['chmod +x SKRIPT','findmnt -no OPTIONS /tmp   # noexec? spusti cez bash SKRIPT']],['bad interpreter ^M',["sed -i 's/\\r$//' SKRIPT"]],['syntax error / unexpected end of file',['bash -n SKRIPT   # chýba then/do/fi/done/esac alebo úvodzovka']],['[: … unary operator expected',['premenné v [ ] do úvodzoviek: [ "$X" = a ]']],['V cron: command not found',['plné cesty (/usr/sbin/…) alebo PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin na začiatok skriptu']],['V cron nič nevidno',['>> /var/log/SKRIPT.log 2>&1 na koniec riadku v crontabe','journalctl -u crond --since today']],['Skript skončí potichu (set -e)',['bash -x SKRIPT   # posledný príkaz pred koncom zlyhal']],['Beží dvakrát naraz',['flock -n /run/SKRIPT.lock SKRIPT']]],
 verify:['bash -n SKRIPT','./SKRIPT ARG; echo $?','journalctl -t ZNAČKA --since today']});
})();
