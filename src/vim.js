/* =========================================================
   MINI VIM
   ========================================================= */
(function(){
'use strict';
const isWordCh = ch => /[\p{L}\p{N}_]/u.test(ch||'');
const cls = ch => ch==null||ch===''||/\s/.test(ch) ? 0 : isWordCh(ch) ? 1 : 2;

class Vim {
  constructor(text, opts={}){
    this.lines = (text==null?'':String(text)).replace(/\n$/,'').split('\n');
    if (!this.lines.length) this.lines=[''];
    this.r=0; this.c=0; this.mode='n';
    this.cmd=''; this.count=''; this.op=null; this.opCount=''; this.pendingG=false; this.pendingR=false; this.pendingZ=false;
    this.reg={text:'',line:false};
    this.undo=[]; this.redo=[];
    this.msg=''; this.err=false;
    this.number=false; this.modified=false; this.saved=false; this.quit=false; this.forceQuit=false;
    this.search=null; this.searchDir=1;
    this.name = opts.name || '';
    this.readonly = !!opts.readonly;
    this.onWrite = opts.onWrite || null;
    this.onQuit = opts.onQuit || null;
    this.stats = {undo:0, keys:0, cmds:[]};
    this.lastChange = null; this.rec = null; this.replaying=false;
    this.wantCol = 0;
    this.msg = opts.name ? `"${opts.name}" ${this.lines.length}L` : '';
  }
  get text(){ return this.lines.join('\n'); }
  snap(){ this.undo.push({l:this.lines.slice(), r:this.r, c:this.c}); if (this.undo.length>200) this.undo.shift(); this.redo=[]; }
  clampC(ins){ const L=this.lines[this.r].length; const max = ins ? L : Math.max(0,L-1); if (this.c>max) this.c=max; if (this.c<0) this.c=0; }
  clampR(){ if (this.r<0) this.r=0; if (this.r>=this.lines.length) this.r=this.lines.length-1; }
  setMsg(m,err){ this.msg=m; this.err=!!err; }
  changed(){ this.modified=true; this.saved=false; }

  /* -------- motions: return {r,c,linewise,inclusive} -------- */
  motion(k, n){
    let r=this.r, c=this.c; const L=()=>this.lines[r];
    switch(k){
      case 'h': case 'ArrowLeft': case 'Backspace': return {r, c:Math.max(0,c-n)};
      case 'l': case 'ArrowRight': case ' ': return {r, c:Math.min(Math.max(0,L().length-(this.op?0:1)), c+n)};
      case 'j': case 'ArrowDown': case 'Enter': case '+': return {r:Math.min(this.lines.length-1,r+n), c:this.wantCol, linewise:true, vert:true};
      case 'k': case 'ArrowUp': case '-': return {r:Math.max(0,r-n), c:this.wantCol, linewise:true, vert:true};
      case '0': case 'Home': return {r, c:0};
      case '^': return {r, c:Math.max(0,L().search(/\S/))};
      case '$': case 'End': return {r: Math.min(this.lines.length-1, r+n-1), c:Math.max(0,this.lines[Math.min(this.lines.length-1,r+n-1)].length-1), inclusive:true, eol:true};
      case 'w': case 'W': {
        for (let i=0;i<n;i++){
          const line=L(); const k0=cls(line[c]);
          if (c>=line.length){ if (r<this.lines.length-1){ r++; c=0; if (this.op && i===n-1) return {r:r-1, c:this.lines[r-1].length, excl:true}; } continue; }
          while (c<line.length && (k==='W'? cls(line[c])!==0 : cls(line[c])===k0) && k0!==0) c++;
          while (c<line.length && cls(line[c])===0) c++;
          if (c>=line.length && r<this.lines.length-1 && !(this.op && i===n-1)){ r++; c=0; const nl=L(); while (c<nl.length && cls(nl[c])===0) c++; }
        }
        return {r,c};
      }
      case 'e': case 'E': {
        for (let i=0;i<n;i++){
          let line=L(); c++;
          while (true){ if (c>=line.length){ if (r>=this.lines.length-1){ c=Math.max(0,line.length-1); break; } r++; c=0; line=L(); continue; } if (cls(line[c])===0){ c++; continue; } break; }
          const k0=cls(line[c]); while (c+1<line.length && cls(line[c+1])===k0) c++;
        }
        return {r,c,inclusive:true};
      }
      case 'b': case 'B': {
        for (let i=0;i<n;i++){
          let line=L(); c--;
          while (true){ if (c<0){ if (r===0){ c=0; break; } r--; line=L(); c=line.length-1; continue; } if (cls(line[c])===0){ c--; continue; } break; }
          const k0=cls(line[c]); while (c>0 && cls(line[c-1])===k0) c--;
        }
        return {r,c:Math.max(0,c)};
      }
      case 'G': return {r: this.count||this.opCount ? Math.min(this.lines.length-1, n-1) : this.lines.length-1, c:0, linewise:true, first:true};
      case 'gg': return {r: this.count||this.opCount ? Math.min(this.lines.length-1,n-1) : 0, c:0, linewise:true, first:true};
      case 'n': case 'N': {
        if (!this.search) { this.setMsg('E35: No previous regular expression',true); return null; }
        const dir = (k==='n'?1:-1)*this.searchDir;
        return this.findNext(this.search, dir, n);
      }
    }
    return null;
  }
  findNext(pat, dir, n){
    let re; try { re = new RegExp(pat.replace(/\\</g,'\\b').replace(/\\>/g,'\\b')); } catch(e){ re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')); }
    let r=this.r, c=this.c;
    for (let k=0;k<n;k++){
      let found=null;
      const total=this.lines.length;
      for (let step=0; step<=total; step++){
        const rr = ((r + dir*step) % total + total) % total;
        const line = this.lines[rr];
        if (dir>0){
          const from = step===0 ? c+1 : 0;
          const sub = line.slice(from); const m = sub.search(re);
          if (m>=0){ found={r:rr,c:from+m}; if (step>0 && rr<=r && step!==0) this.setMsg('search hit BOTTOM, continuing at TOP'); break; }
        } else {
          const lim = step===0 ? c : line.length;
          let last=-1; for (let i=0;i<lim;i++){ if (re.test(line.slice(i)) && line.slice(i).search(re)===0) last=i; }
          if (last>=0){ found={r:rr,c:last}; break; }
        }
      }
      if (!found){ this.setMsg('E486: Pattern not found: '+pat,true); return null; }
      r=found.r; c=found.c;
    }
    return {r,c};
  }

  /* -------- edits -------- */
  deleteRange(m, op){
    // returns deleted text; handles linewise / charwise
    if (m.linewise){
      let a=Math.min(this.r,m.r), b=Math.max(this.r,m.r);
      const txt = this.lines.slice(a,b+1);
      this.reg={text:txt.join('\n'), line:true};
      if (op==='y') { this.setMsg(txt.length>2?`${txt.length} lines yanked`:''); this.r=a; return; }
      if (op==='c'){ this.lines.splice(a,b-a+1,''); this.r=a; this.c=0; return; }
      this.lines.splice(a,b-a+1);
      if (!this.lines.length) this.lines=[''];
      this.r=Math.min(a,this.lines.length-1); this.c=Math.max(0,this.lines[this.r].search(/\S/));
      if (txt.length>2) this.setMsg(`${txt.length} fewer lines`);
      return;
    }
    let r1=this.r,c1=this.c,r2=m.r,c2=m.c;
    if (r2<r1 || (r2===r1 && c2<c1)){ [r1,c1,r2,c2]=[r2,c2,r1,c1]; }
    if (m.inclusive) c2++;
    if (r1!==r2){
      if (m.excl){ c2=this.lines[r2].length; }
      const first=this.lines[r1], last=this.lines[r2];
      const text = [first.slice(c1)].concat(this.lines.slice(r1+1,r2), [last.slice(0,c2)]).join('\n');
      this.reg={text,line:false};
      if (op==='y'){ this.r=r1; this.c=c1; return; }
      this.lines.splice(r1, r2-r1+1, first.slice(0,c1)+last.slice(c2));
    } else {
      const line=this.lines[r1];
      this.reg={text:line.slice(c1,c2), line:false};
      if (op==='y'){ this.r=r1; this.c=c1; return; }
      this.lines[r1] = line.slice(0,c1)+line.slice(c2);
    }
    this.r=r1; this.c=c1;
  }
  put(after, n){
    if (!this.reg.text && !this.reg.line) return;
    this.snap(); this.changed();
    for (let k=0;k<n;k++){
      if (this.reg.line){
        const ls=this.reg.text.split('\n');
        const at = after ? this.r+1 : this.r;
        this.lines.splice(at,0,...ls);
        this.r=at; this.c=Math.max(0,this.lines[at].search(/\S/));
      } else {
        const line=this.lines[this.r]; const at = after ? Math.min(line.length,this.c+1) : this.c;
        const parts=this.reg.text.split('\n');
        if (parts.length===1){ this.lines[this.r]=line.slice(0,at)+this.reg.text+line.slice(at); this.c=at+this.reg.text.length-1; }
        else { const tail=line.slice(at); this.lines[this.r]=line.slice(0,at)+parts[0]; this.lines.splice(this.r+1,0,...parts.slice(1)); this.r+=parts.length-1; this.lines[this.r]+=tail; this.c=parts[parts.length-1].length-1; }
      }
    }
  }

  /* -------- key handling -------- */
  key(k, ctrl){
    this.stats.keys++;
    if (this.quit) return;
    if (this.rec && !this.replaying) this.rec.push([k,ctrl]);
    if (this.mode==='i') return this.keyInsert(k, ctrl);
    if (this.mode==='c' || this.mode==='/' || this.mode==='?') return this.keyCmdline(k);
    return this.keyNormal(k, ctrl);
  }
  startRec(firstKeys){ if (!this.replaying){ this.rec = firstKeys.slice(); } }
  endRec(){ if (this.rec && !this.replaying){ this.lastChange=this.rec; } this.rec=null; }
  keyInsert(k, ctrl){
    const line=this.lines[this.r];
    if (k==='Escape' || (ctrl && k==='[') || (ctrl && k==='c')){ this.mode='n'; this.c=Math.max(0,this.c-1); this.clampC(); this.setMsg(''); this.endRec(); return; }
    if (k==='Backspace'){ if (this.c>0){ this.lines[this.r]=line.slice(0,this.c-1)+line.slice(this.c); this.c--; } else if (this.r>0){ const pl=this.lines[this.r-1]; this.lines[this.r-1]=pl+line; this.lines.splice(this.r,1); this.r--; this.c=pl.length; } this.changed(); return; }
    if (k==='Delete'){ if (this.c<line.length) this.lines[this.r]=line.slice(0,this.c)+line.slice(this.c+1); else if (this.r<this.lines.length-1){ this.lines[this.r]+=this.lines[this.r+1]; this.lines.splice(this.r+1,1); } this.changed(); return; }
    if (k==='Enter'){ const ind=(line.match(/^\s*/)||[''])[0]; this.lines[this.r]=line.slice(0,this.c); this.lines.splice(this.r+1,0,ind+line.slice(this.c).replace(/^\s+/, m=>this.c>=ind.length?'':m)); this.r++; this.c=ind.length; this.changed(); return; }
    if (k==='ArrowLeft'){ this.c=Math.max(0,this.c-1); return; }
    if (k==='ArrowRight'){ this.c=Math.min(line.length,this.c+1); return; }
    if (k==='ArrowUp'){ if (this.r>0){ this.r--; this.clampC(true);} return; }
    if (k==='ArrowDown'){ if (this.r<this.lines.length-1){ this.r++; this.clampC(true);} return; }
    if (k==='Home'){ this.c=0; return; } if (k==='End'){ this.c=line.length; return; }
    if (k==='Tab'){ k='\t'; }
    if (ctrl) return;
    if (k.length===1){ this.lines[this.r]=line.slice(0,this.c)+k+line.slice(this.c); this.c++; this.changed(); }
  }
  keyCmdline(k){
    if (k==='Escape'){ this.mode='n'; this.cmd=''; return; }
    if (k==='Backspace'){ if (!this.cmd){ this.mode='n'; return; } this.cmd=this.cmd.slice(0,-1); return; }
    if (k==='Enter'){
      const m=this.mode, c=this.cmd; this.mode='n'; this.cmd='';
      if (m==='/'||m==='?'){ if (c) this.search=c; this.searchDir = m==='/'?1:-1; const t=this.findNext(this.search||'', this.searchDir, 1); if (t){ this.r=t.r; this.c=t.c; this.setMsg((m)+this.search); } this.stats.cmds.push(m+c); return; }
      this.stats.cmds.push(':'+c);
      return this.ex(c.trim());
    }
    if (k.length===1) this.cmd+=k;
  }
  ex(c){
    if (!c) return;
    if (/^\d+$/.test(c)){ this.r=Math.min(this.lines.length-1,Math.max(0,+c-1)); this.c=Math.max(0,this.lines[this.r].search(/\S/)); return; }
    if (c==='$'){ this.r=this.lines.length-1; return; }
    let m;
    if ((m=c.match(/^set\s+(\S+)/))){
      const o=m[1];
      if (o==='nu'||o==='number') this.number=true;
      else if (o==='nonu'||o==='nonumber') this.number=false;
      else if (o==='nu!'||o==='number!') this.number=!this.number;
      else if (['paste','nopaste','hlsearch','nohlsearch','hls','nohls','ic','ignorecase','list','nolist','ai','autoindent'].includes(o)) this.setMsg('');
      else this.setMsg('E518: Unknown option: '+o,true);
      return;
    }
    if (/^(syntax|syn)\s+(on|off)$/.test(c) || c==='noh' || c==='nohlsearch') return;
    if ((m=c.match(/^(%|\d+,\d+|\d+|\.|\.,\$|1,\$)?s(.)(.*?)\2(.*?)(?:\2([gciI]*))?$/))){
      let a=this.r, b=this.r;
      if (m[1]==='%'||m[1]==='1,$') { a=0; b=this.lines.length-1; }
      else if (m[1]==='.,$'){ b=this.lines.length-1; }
      else if (m[1] && m[1].includes(',')){ const [x,y]=m[1].split(','); a=+x-1; b=+y-1; }
      else if (m[1] && /^\d+$/.test(m[1])){ a=b=+m[1]-1; }
      const pat=m[3]||this.search||''; const rep=(m[4]||'').replace(/\\\//g,'/').replace(/&/g,'$$&').replace(/\\(\d)/g,'$$$1'); const fl=m[5]||'';
      let re; try { re=new RegExp(pat.replace(/\\\(/g,'(').replace(/\\\)/g,')'), (fl.includes('g')?'g':'')+(fl.match(/[iI]/)?'i':'')); } catch(e){ this.setMsg('E486: Pattern not found: '+pat,true); return; }
      let cnt=0, lcnt=0; this.snap();
      for (let i=Math.max(0,a);i<=Math.min(b,this.lines.length-1);i++){
        const before=this.lines[i]; const after=before.replace(re,(...x)=>{ cnt++; return rep.replace(/\$&/g,x[0]).replace(/\$(\d)/g,(q,d)=>x[+d]||''); });
        if (after!==before){ this.lines[i]=after; lcnt++; this.r=i; }
      }
      if (!cnt){ this.undo.pop(); this.setMsg('E486: Pattern not found: '+pat,true); return; }
      this.changed(); this.c=0; this.search=pat;
      this.setMsg(cnt>1||lcnt>1 ? `${cnt} substitution${cnt>1?'s':''} on ${lcnt} line${lcnt>1?'s':''}` : '');
      if (fl.includes('c')) this.setMsg(this.msg+' (v trenažéri sa potvrdenie /c preskakuje)');
      return;
    }
    if ((m=c.match(/^(\d+),(\d+)d$/))){ this.snap(); const a=+m[1]-1,b=+m[2]-1; this.reg={text:this.lines.slice(a,b+1).join('\n'),line:true}; this.lines.splice(a,b-a+1); if(!this.lines.length) this.lines=['']; this.r=Math.min(a,this.lines.length-1); this.changed(); return; }
    if ((m=c.match(/^g\/(.+)\/d$/))){ this.snap(); const re=new RegExp(m[1]); this.lines=this.lines.filter(l=>!re.test(l)); if(!this.lines.length) this.lines=['']; this.r=Math.min(this.r,this.lines.length-1); this.changed(); return; }
    if (c==='w !sudo tee %' || c==='w !sudo tee % >/dev/null'){ return this.write(true); }
    const w = c.match(/^(w|wq|x|wq!|w!|x!|up|update|q|q!|qa|qa!|wqa|xa)(?:\s+(\S+))?$/);
    if (!w){ this.setMsg('E492: Not an editor command: '+c,true); return; }
    const cmd=w[1];
    if (/^(w|w!|wq|wq!|x|x!|up|update|wqa|xa)$/.test(cmd)){
      if (cmd.startsWith('x')||cmd==='up'||cmd==='update'){ if (this.modified) { if (!this.write()) return; } }
      else if (!this.write(false, w[2])) return;
    }
    if (/^(q|qa)$/.test(cmd)){ if (this.modified){ this.setMsg('E37: No write since last change (add ! to override)',true); return; } }
    if (/q|x/.test(cmd)){ this.quit=true; this.forceQuit = cmd.includes('!') && !cmd.startsWith('w'); if (this.onQuit) this.onQuit(this); }
  }
  write(sudo, name){
    if (this.readonly && !sudo){ this.setMsg('E45: \'readonly\' option is set (add ! to override)',true); return false; }
    if (this.onWrite){ const r=this.onWrite(this.text+'\n', sudo, name); if (r && r.error){ this.setMsg(r.error,true); return false; } }
    this.modified=false; this.saved=true; this.everSaved=true;
    this.setMsg(`"${name||this.name||'[No Name]'}" ${this.lines.length}L, ${this.text.length+1}B written`);
    return true;
  }
  doUndo(redo){
    const from = redo?this.redo:this.undo, to = redo?this.undo:this.redo;
    if (!from.length){ this.setMsg(redo?'Already at newest change':'Already at oldest change'); return; }
    to.push({l:this.lines.slice(), r:this.r, c:this.c});
    const s=from.pop(); this.lines=s.l; this.r=Math.min(s.r,this.lines.length-1); this.c=s.c; this.clampC();
    this.modified=true; if (!redo) this.stats.undo++;
    this.setMsg(redo?'1 change; after #'+this.undo.length:'1 change; before #'+(this.undo.length+1));
  }
  keyNormal(k, ctrl){
    if (ctrl){
      if (k==='r'){ this.doUndo(true); return; }
      if (k==='f' || k==='d'){ this.r=Math.min(this.lines.length-1,this.r+(k==='f'?20:10)); this.clampC(); return; }
      if (k==='b' || k==='u'){ this.r=Math.max(0,this.r-(k==='b'?20:10)); this.clampC(); return; }
      if (k==='g'){ this.setMsg(`"${this.name||'[No Name]'}"${this.modified?' [Modified]':''} ${this.lines.length} lines --${Math.round((this.r+1)/this.lines.length*100)}%--`); return; }
      return;
    }
    if (k==='Escape'){ this.count=''; this.op=null; this.opCount=''; this.pendingG=false; this.pendingR=false; this.pendingZ=false; this.rec=null; return; }
    if (this.pendingR){ this.pendingR=false; if (k.length!==1 && k!=='Enter') return; const n=+(this.count||1); this.count=''; const line=this.lines[this.r]; if (this.c+n>line.length) return; this.snap(); this.changed(); this.lines[this.r]=line.slice(0,this.c)+(k==='Enter'?'':k.repeat(n))+line.slice(this.c+n); this.c+=n-1; this.endRec(); return; }
    if (this.pendingZ){ this.pendingZ=false; if (k==='Z') return this.ex('x'); if (k==='Q') return this.ex('q!'); return; }
    if (/^[1-9]$/.test(k) || (k==='0' && (this.count||(this.op&&this.opCount)))){ if (this.op) this.opCount+=k; else this.count+=k; return; }
    // g prefix
    if (this.pendingG){ this.pendingG=false; if (k==='g') return this.applyMotion('gg'); if (k==='J'){ return; } return; }
    if (k==='g'){ this.pendingG=true; return; }
    const n = +(this.count||1) * +(this.opCount||1);
    // operator pending
    if (this.op){
      const op=this.op;
      if (k===op){ // dd yy cc
        const m={r:Math.min(this.lines.length-1,this.r+n-1), c:0, linewise:true};
        if (op!=='y'){ this.snap(); this.changed(); }
        this.deleteRange(m, op);
        if (op==='c'){ this.mode='i'; this.c=0; }
        else this.endRec();
        this.op=null; this.count=''; this.opCount=''; return;
      }
      let mk=k; if (op==='c' && (k==='w'||k==='W')) mk = k==='w'?'e':'E';
      let m=this.motion(mk, n);
      if (op==='c' && (k==='w'||k==='W') && cls(this.lines[this.r][this.c])===0) m={r:this.r,c:this.c,inclusive:true};
      this.op=null; this.count=''; this.opCount='';
      if (!m){ this.rec=null; return; }
      if (op!=='y'){ this.snap(); this.changed(); }
      if (m.vert) m.linewise=true;
      this.deleteRange(m, op);
      if (op==='c'){ this.mode='i'; }
      else { this.clampC(); this.endRec(); }
      return;
    }
    const motionKeys = ['h','j','k','l','w','W','b','B','e','E','0','^','$','G','n','N','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End',' ','Backspace','Enter','+','-'];
    if (motionKeys.includes(k)) return this.applyMotion(k, n);
    const begin = (keys)=>{ this.startRec(keys); };
    this.count='';
    switch(k){
      case 'i': begin([['i']]); this.snap(); this.mode='i'; return;
      case 'a': begin([['a']]); this.snap(); this.mode='i'; this.c=Math.min(this.lines[this.r].length, this.c+1); return;
      case 'I': begin([['I']]); this.snap(); this.mode='i'; this.c=Math.max(0,this.lines[this.r].search(/\S/)); if (this.c<0) this.c=0; return;
      case 'A': begin([['A']]); this.snap(); this.mode='i'; this.c=this.lines[this.r].length; return;
      case 'o': case 'O': { begin([[k]]); this.snap(); this.changed(); const ind=(this.lines[this.r].match(/^\s*/)||[''])[0]; const at=k==='o'?this.r+1:this.r; this.lines.splice(at,0,ind); this.r=at; this.c=ind.length; this.mode='i'; return; }
      case 'x': case 'Delete': { const line=this.lines[this.r]; if (!line.length) return; begin([['x']]); this.snap(); this.changed(); this.reg={text:line.slice(this.c,this.c+n),line:false}; this.lines[this.r]=line.slice(0,this.c)+line.slice(this.c+n); this.clampC(); this.endRec(); return; }
      case 'X': { if (this.c===0) return; this.snap(); this.changed(); const line=this.lines[this.r]; const s=Math.max(0,this.c-n); this.reg={text:line.slice(s,this.c),line:false}; this.lines[this.r]=line.slice(0,s)+line.slice(this.c); this.c=s; return; }
      case 'D': case 'C': { begin([[k]]); this.snap(); this.changed(); const line=this.lines[this.r]; this.reg={text:line.slice(this.c),line:false}; this.lines[this.r]=line.slice(0,this.c); if (k==='C') this.mode='i'; else { this.clampC(); this.endRec(); } return; }
      case 's': { begin([['s']]); this.snap(); this.changed(); const line=this.lines[this.r]; this.lines[this.r]=line.slice(0,this.c)+line.slice(this.c+n); this.mode='i'; return; }
      case 'S': { begin([['S']]); this.snap(); this.changed(); this.lines[this.r]=''; this.c=0; this.mode='i'; return; }
      case 'd': case 'y': case 'c': this.op=k; this.opCount=''; this.count=String(n>1?n:''); if (k!=='y') begin([[k]]); return;
      case 'Y': this.op='y'; return this.keyNormal('y');
      case 'p': case 'P': this.put(k==='p', n); return;
      case 'u': this.doUndo(false); return;
      case 'r': this.pendingR=true; this.count=String(n>1?n:''); begin([['r']]); return;
      case 'J': { if (this.r>=this.lines.length-1) return; this.snap(); this.changed(); const a=this.lines[this.r], b=this.lines[this.r+1].replace(/^\s+/,''); this.c=a.length; this.lines[this.r]=a.replace(/\s+$/,'')+(b?' ':'')+b; this.lines.splice(this.r+1,1); return; }
      case '~': { const line=this.lines[this.r]; if (!line.length) return; this.snap(); this.changed(); let s=''; for (let i=this.c;i<Math.min(line.length,this.c+n);i++){ const ch=line[i]; s+= ch===ch.toUpperCase()?ch.toLowerCase():ch.toUpperCase(); } this.lines[this.r]=line.slice(0,this.c)+s+line.slice(this.c+s.length); this.c=Math.min(line.length-1,this.c+s.length); return; }
      case '.': { if (!this.lastChange) return; this.replaying=true; const seq=this.lastChange.slice(); for (let t=0;t<n;t++) for (const [kk,cc] of seq) this.key(kk,cc); if (this.mode==='i') this.key('Escape'); this.replaying=false; return; }
      case ':': this.mode='c'; this.cmd=''; return;
      case '/': this.mode='/'; this.cmd=''; return;
      case '?': this.mode='?'; this.cmd=''; return;
      case 'Z': this.pendingZ=true; return;
      case 'v': case 'V': this.setMsg('Vizuálny režim tento trenažér nemá. Skús operátor + pohyb (d3j, y$).'); return;
    }
  }
  applyMotion(k, n){
    const m=this.motion(k, n||+(this.count||1)); this.count='';
    if (!m) return;
    this.r=m.r;
    if (m.vert){ this.c=this.wantCol; this.clampC(); }
    else if (m.first){ this.c=Math.max(0,this.lines[this.r].search(/\S/)); }
    else { this.c=m.c; this.clampC(); this.wantCol = m.eol ? 9999 : this.c; }
  }

  /* -------- render -------- */
  render(rows){
    rows = rows || 16;
    const esc = s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const top = Math.max(0, Math.min(this.r - Math.floor(rows/2), this.lines.length - rows));
    let html='';
    const w = String(this.lines.length).length;
    for (let i=top;i<top+rows;i++){
      if (i>=this.lines.length){ html += '<div class="vl"><span class="vt">~</span></div>'; continue; }
      let line=this.lines[i].replace(/\t/g,'    ');
      let content;
      if (i===this.r){
        const cc = Math.min(this.c, this.lines[i].length);
        const before=this.lines[i].slice(0,cc).replace(/\t/g,'    '), ch=this.lines[i][cc]||' ', after=this.lines[i].slice(cc+1).replace(/\t/g,'    ');
        const cur = this.mode==='i' ? 'vc vi' : (this.mode==='n'?'vc':'vc vo');
        content = esc(before)+`<span class="${cur}">${esc(ch==='\t'?' ':ch)}</span>`+esc(after);
      } else content = esc(line);
      html += `<div class="vl">${this.number?`<span class="vn">${String(i+1).padStart(w+1)} </span>`:''}${content||''}</div>`;
    }
    let status='';
    if (this.mode==='c'||this.mode==='/'||this.mode==='?') status = `<span>${esc((this.mode==='c'?':':this.mode)+this.cmd)}<span class="vc vi"> </span></span>`;
    else if (this.mode==='i') status = '<b>-- INSERT --</b>';
    else if (this.msg) status = `<span class="${this.err?'verr':''}">${esc(this.msg)}</span>`;
    const pend = (this.count||'')+(this.op||'')+(this.opCount||'')+(this.pendingG?'g':'')+(this.pendingR?'r':'')+(this.pendingZ?'Z':'');
    return `<div class="vbuf">${html}</div><div class="vstat"><span class="vmsg">${status}</span><span class="vpos">${esc(pend)}&nbsp;&nbsp;${this.r+1},${this.c+1}</span></div>`;
  }
}
window.Vim = Vim;
})();
