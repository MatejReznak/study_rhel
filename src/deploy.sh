#!/bin/bash
# zostaví kurz a nahrá ho do repozitára matejreznak/study_rhel
set -e
cd /home/claude/rhel
python3 build.py >/dev/null && python3 build_local.py >/dev/null
cp RHEL-v-praxi.html web/index.html && cp web/index.html out/study_rhel.html
cd /home/claude/study_rhel
git fetch -q origin main && git reset -q --soft origin/main 2>/dev/null || true
cp /home/claude/rhel/out/study_rhel.html study_rhel.html
mkdir -p src
cp /home/claude/rhel/*.js /home/claude/rhel/head.html /home/claude/rhel/build.py /home/claude/rhel/build_local.py /home/claude/rhel/deploy.sh src/
cat > src/README.md <<'MDEOF'
# Zdrojové súbory kurzu RHEL v praxi

`study_rhel.html` v koreni repozitára sa skladá z týchto súborov.

- `python3 build.py` zostaví `rhel.html`; `python3 build_local.py` zostaví samostatný `RHEL-v-praxi.html` (z neho je `study_rhel.html`).
- `shell*.js` simulátor RHEL (príkazy, služby, bash), `bashfiles.js` ukážkové skripty
- `chapters*.js`, `net.js`, `iptables.js`, `bash2.js`, `diag.js` kapitoly, kvízy, úlohy, dril
- `incidents*.js` incidenty, `runbooks.js` postupy, `exam2.js` skúška, `lab.js` skutočný server
- `app*.js`, `explain*.js` rozhranie stránky, `sync.js` synchronizácia cez Gist (token sa do kódu nikdy neukladá)

Pokračovanie v novom chate: „pokračuj na study_rhel, zdroje sú v src/“.
MDEOF
git add study_rhel.html src
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -q -m "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PPrJMtSuiMaKhNn69XCAYK"
git push -q origin main
git log --oneline -1
