import base64, os
F='/tmp/claude-0/-home-claude/63e7dcd6-74dc-503e-9ce8-a6321eecbf52/scratchpad/fonts'
R={'latin':'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
   'latin-ext':'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'}
faces=[('Red Hat Display','red-hat-display',[(500,'normal'),(700,'normal'),(900,'normal')]),
       ('Red Hat Text','red-hat-text',[(400,'normal'),(500,'normal'),(700,'normal'),(400,'italic')]),
       ('Red Hat Mono','red-hat-mono',[(400,'normal'),(500,'normal'),(700,'normal')])]
css=''
for fam,slug,ws in faces:
  for w,st in ws:
    for sub,rng in R.items():
      p=f'{F}/fontsource-{slug}-5.1.0/package/files/{slug}-{sub}-{w}-{st}.woff2'
      b=base64.b64encode(open(p,'rb').read()).decode()
      css+=f"@font-face{{font-family:'{fam}';font-style:{st};font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{b}) format('woff2');unicode-range:{rng}}}\n"
body=open('/home/claude/rhel/rhel.html').read()
import re
body=re.sub(r'<link rel="(preconnect|stylesheet)"[^>]*>\n?','',body)
body=body.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
title='<title>RHEL v praxi</title>\n'
body=body.replace(title,'',1)
head=('<!doctype html>\n<html lang="sk">\n<head>\n<meta charset="utf-8">\n'
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
 '<meta name="theme-color" content="#14171C">\n'
 '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
 '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
 '<meta name="apple-mobile-web-app-title" content="RHEL">\n<link rel="apple-touch-icon" href="icon.png">\n<link rel="icon" href="icon.png">\n'+title+
 '<style>\n:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}\nbody{margin:0}\nimg{max-width:100%}\n[hidden]{display:none!important}\n'+css+'</style>\n</head>\n<body>\n')
out=head+body+'\n</body>\n</html>\n'
open('/home/claude/rhel/RHEL-v-praxi.html','w').write(out)
print(len(out)//1024,'kB')
