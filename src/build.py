parts=['shell.js','shell2.js','shell3.js','shell4.js','shell5.js','shell6.js','shell7.js','shell8.js','bashfiles.js','cmdref.js','chapters1.js','chapters2.js','chapters3.js','incidents.js','incidents2.js','exam2.js','lab.js','runbooks.js','net.js','iptables.js','bash2.js','diag.js','drill.js','drill2.js','vim.js','app1.js','app2.js','app4.js','app3.js','app5.js','explainctx.js','explainsh.js','app6.js','sync.js']
import datetime, zoneinfo
VER=datetime.datetime.now(zoneinfo.ZoneInfo('Europe/Bratislava')).strftime('%-d.%-m. %H:%M')
out=open('head.html').read().replace('{{VER}}', VER)
out+='\n<script>window.APP_VER='+repr(VER)+';</script>\n'
for p in parts: out+='\n<script>\n'+open(p).read()+'\n</script>\n'
open('rhel.html','w').write(out)
print(len(out))
