/* =========================================================
   SIMULÁTOR: bash interpret v2
   case, while read (< súbor, <<<, < <(…), rúra), C-for, (( )), let,
   ${X:-…} ${X%…} ${#X} ${X/…}, polia, set -euxo pipefail, trap EXIT,
   getopts, shift, source, heredoc, here-string, { …; } skupiny,
   bash -n kontrola syntaxe, CRLF (^M) chyba
   ========================================================= */
(function(){
'use strict';
const P = window.Machine.prototype;

/* ---------- aritmetika ---------- */
P._arith = function(ex){
  const env = this.env = this.env || {};
  const pa = this.posArgs || [];
  const val = n => { const x = /^\d$/.test(n) ? (pa[+n-1]||'') : (env[n]!=null ? env[n] : ''); return /^-?\d+$/.test(String(x).trim()) ? String(x).trim() : '0'; };
  const evalE = e => {
    let e2 = e.replace(/\$\{?(\w+)\}?/g, (m,v)=>val(v)).replace(/\b([A-Za-z_]\w*)\b/g, (m,v)=>val(v));
    if (!/^[0-9+\-*\/%()<>=!&|?: ]*$/.test(e2)) return 0;
    e2 = e2.replace(/(\d+)\s*\/\s*(\d+)/g, 'Math.trunc($1/$2)');
    try { const r = Function('return ('+(e2.trim()||'0')+')')(); return typeof r==='boolean' ? (r?1:0) : Math.trunc(Number(r)||0); } catch(x){ return 0; }
  };
  let last = 0;
  for (const part of String(ex).split(',')){
    let m;
    if ((m = part.match(/^\s*([A-Za-z_]\w*)\s*(\+\+|--)\s*$/))){ last = +val(m[1]); env[m[1]] = String(last + (m[2]==='++'?1:-1)); continue; }
    if ((m = part.match(/^\s*(\+\+|--)\s*([A-Za-z_]\w*)\s*$/))){ last = +val(m[2]) + (m[1]==='++'?1:-1); env[m[2]] = String(last); continue; }
    if ((m = part.match(/^\s*([A-Za-z_]\w*)\s*([+\-*\/%]?)=(?!=)\s*(.+)$/))){ const r = evalE(m[3]); const c = +val(m[1]); last = m[2]==='+'?c+r:m[2]==='-'?c-r:m[2]==='*'?c*r:m[2]==='/'?Math.trunc(c/(r||1)):m[2]==='%'?c%(r||1):r; env[m[1]] = String(last); continue; }
    last = evalE(part);
  }
  return last;
};

/* ---------- ${…} rozšírenia ---------- */
const g2re = (p, anchorEnd, greedy) => {
  let r = '';
  for (let i=0;i<p.length;i++){ const c=p[i]; if (c==='*') r += greedy?'.*':'.*?'; else if (c==='?') r+='.'; else if (c==='['){ const e=p.indexOf(']',i); if (e>i){ r += '['+p.slice(i+1,e).replace(/^!/,'^')+']'; i=e; } else r+='\\['; } else r += c.replace(/[.+^${}()|\\/]/g,'\\$&'); }
  return r;
};
P._pexp = function(inner, look, isSet){
  const arr = this.arr = this.arr || {};
  const word = w => String(w||'').replace(/\$\{?([A-Za-z_]\w*|\d)\}?/g, (m,v)=>look(v)).replace(/^["']|["']$/g,'').replace(/\\(.)/g,'$1');
  let m;
  if ((m = inner.match(/^#([A-Za-z_]\w*)\[[@*]\]$/))) return String((arr[m[1]]||[]).length || ((this.env||{})[m[1]]?1:0));
  if ((m = inner.match(/^#([A-Za-z_]\w*|\d|[@*])$/))) return m[1]==='@'||m[1]==='*' ? String((this.posArgs||[]).length) : String(look(m[1]).length);
  if ((m = inner.match(/^([A-Za-z_]\w*)\[([@*])\]$/))) return (arr[m[1]] || (look(m[1])?[look(m[1])]:[])).join(' ');
  if ((m = inner.match(/^([A-Za-z_]\w*)\[([^\]]+)\]$/))){ const i = this._arith(m[2]); return (arr[m[1]]||[])[i] != null ? arr[m[1]][i] : (i===0 ? look(m[1]) : ''); }
  if ((m = inner.match(/^!([A-Za-z_]\w*)$/))) return look(look(m[1]));
  m = inner.match(/^([A-Za-z_]\w*|\d|[@*#?$])(.*)$/s); if (!m) return '';
  const name = m[1], op = m[2];
  const set = isSet ? isSet(name) : look(name)!=='';
  const v = (()=>{ const sv = this._unbound; const x = look(name); if (/^(:?[-=?+])/.test(op)) this._unbound = sv; return x; })();
  let o;
  if ((o = op.match(/^(:?)([-=?+])(.*)$/s))){
    const empty = o[1] ? v==='' : !set;
    const w = word(o[3]);
    if (o[2]==='-') return empty ? w : v;
    if (o[2]==='=') { if (empty){ (this.env=this.env||{})[name] = w; return w; } return v; }
    if (o[2]==='+') return empty ? '' : w;
    if (o[2]==='?') { if (empty){ this._paramErr = `${name}: ${w || 'parameter null or not set'}`; } return v; }
  }
  if ((o = op.match(/^(##?)(.*)$/s))){ const p = word(o[2]); const re = new RegExp('^'+g2re(p,false,o[1]==='##')); return v.replace(re,''); }
  if ((o = op.match(/^(%%?)(.*)$/s))){ const p = word(o[2]); const greedy = o[1]==='%%'; for (let i = greedy?0:v.length; greedy?i<=v.length:i>=0; greedy?i++:i--){ if (new RegExp('^'+g2re(p,true,true)+'$').test(v.slice(i))) return v.slice(0,i); } return v; }
  if ((o = op.match(/^(\/\/?)([^/]*)\/?(.*)$/s))){ const p = word(o[2]); const rep = word(o[3]); const re = new RegExp(g2re(p,false,true), o[1]==='//'?'g':''); return v.replace(re, rep); }
  if (op==='^^') return v.toUpperCase(); if (op===',,') return v.toLowerCase(); if (op==='^') return v.charAt(0).toUpperCase()+v.slice(1);
  if ((o = op.match(/^:\s*(-?\d+)(?::(\d+))?$/))){ let s = +o[1]; if (s<0) s = Math.max(0, v.length+s); return o[2]!=null ? v.substr(s, +o[2]) : v.slice(s); }
  return v;
};

/* ---------- rozdelenie skriptu na príkazy ---------- */
P._scriptStmts = function(text){
  const stmts = []; this._hd = this._hd || {}; let hdN = Object.keys(this._hd).length;
  const lines = String(text).split('\n');
  for (let li=0; li<lines.length; li++){
    let raw = lines[li]; const ln = li+1;
    while (/\\$/.test(raw) && !/\\\\$/.test(raw) && li+1<lines.length){ raw = raw.slice(0,-1) + ' ' + lines[++li].trim(); }
    // komentár
    let line=''; let q=null;
    for (let i=0;i<raw.length;i++){ const ch=raw[i]; if (q){ line+=ch; if (ch===q) q=null; continue; } if (ch==='"'||ch==="'"){ q=ch; line+=ch; continue; } if (ch==='\\'){ line+=ch+(raw[i+1]||''); i++; continue; } if (ch==='#' && (i===0 || /[\s;]/.test(raw[i-1]))) break; line+=ch; }
    // heredoc
    const hm = line.match(/<<(-?)\s*(['"]?)([A-Za-z_]\w*)\2/);
    if (hm && !/<<</.test(line)){
      const body = []; li++;
      while (li < lines.length){ const L = hm[1] ? lines[li].replace(/^\t+/,'') : lines[li]; if (L.trim()===hm[3]) break; body.push(L); li++; }
      const id = 'h'+(hdN++); this._hd[id] = {body: body.join('\n')+'\n', expand: !hm[2]};
      line = line.replace(hm[0], '<<HD:'+id);
    }
    // rozdelenie podľa ; (;; samostatne), rešpektuj úvodzovky, $( ), [[ ]], (( )), { …; }
    const parts=[]; let cur=''; q=null; let par=0, br=0;
    for (let i=0;i<line.length;i++){
      const ch=line[i];
      if (q){ cur+=ch; if (ch===q) q=null; continue; }
      if (ch==='"'||ch==="'"){ q=ch; cur+=ch; continue; }
      if (ch==='\\'){ cur+=ch+(line[i+1]||''); i++; continue; }
      if ((line.startsWith('[[',i) || line.startsWith('((',i)) && /(^|[\s;(])$/.test(cur.slice(-1)||' ')){ const e = line.indexOf(line[i]==='['?']]':'))', i+2); if (e>0){ cur += line.slice(i,e+2); i = e+1; continue; } }
      if (ch==='('){ par++; cur+=ch; continue; }
      if (ch===')'){ if (par>0) par--; cur+=ch; continue; }
      if (ch==='{' && /(^|\s)$/.test(cur.slice(-1)||' ') && /\s/.test(line[i+1]||'') && (/(&&|\|\||\(\))\s*$/.test(cur) || cur.trim()==='' || /^function\s+\S+\s*$/.test(cur.trim()))){ br++; cur+=ch; continue; }
      if (ch==='}' && br>0){ br--; cur+=ch; continue; }
      if (ch===';' && par===0 && br===0){ if (line[i+1]===';'){ parts.push(cur); parts.push(';;'); cur=''; i++; continue; } parts.push(cur); cur=''; continue; }
      cur+=ch;
    }
    parts.push(cur);
    for (let p of parts){
      p = p.trim(); if (!p) continue;
      const kw = p.match(/^(then|do|else)\s+(.+)$/);
      if (kw){ stmts.push({s:kw[1], ln}); p = kw[2].trim(); }
      const tail = p.match(/^(.*\S)\s+(;;)$/); if (tail){ stmts.push({s:tail[1], ln}); stmts.push({s:';;', ln}); continue; }
      stmts.push({s:p, ln});
    }
  }
  return stmts;
};

/* ---------- parser ---------- */
const doneTail = s=>{
  let r = String(s||'').replace(/^done\b/,'').trim(); const o = {input:null, out:null, pipe:null};
  let m;
  if ((m = r.match(/\|\s*(.+)$/)) && !/^\|\|/.test(m[0])){ o.pipe = m[1]; r = r.slice(0, m.index).trim(); }
  if ((m = r.match(/<\s*<\((.*)\)/))){ o.input = {k:'<<(', v:m[1]}; r = r.replace(m[0],''); }
  else if ((m = r.match(/<<<\s*("(?:[^"\\]|\\.)*"|'[^']*'|\S+)/))){ o.input = {k:'<<<', v:m[1]}; r = r.replace(m[0],''); }
  else if ((m = r.match(/(^|\s)<\s*("[^"]*"|\S+)/))){ o.input = {k:'<', v:m[2]}; r = r.replace(m[0],''); }
  if ((m = r.match(/(^|\s)(>>?)\s*("[^"]*"|[^\s&]\S*)/))){ o.out = {app: m[2]==='>>', f:m[3]}; }
  return o;
};
P._parseScript = function(stmts){
  let pos = 0; const errs = [];
  const W = s => s.split(/\s+/)[0];
  const parse = (ends)=>{
    const body = [];
    while (pos < stmts.length){
      const st = stmts[pos]; const s = st.s; const w = W(s);
      if (ends.includes(w) || ends.includes(s)) return body;
      pos++;
      if (w==='if'){
        const node = {t:'if', branches:[], els:null, ln:st.ln};
        let cond = s.slice(3).replace(/;\s*then$/,'').replace(/\s+then$/,'');
        while (true){
          if (stmts[pos] && stmts[pos].s==='then') pos++;
          else { const k = stmts.slice(pos).find(x=>x.s==='then' || /^(fi|else|elif)\b/.test(x.s)); if (k && k.s!=='then') errs.push({ln:k.ln, m:`syntax error near unexpected token \`${W(k.s)}'`}); }
          const b = parse(['elif','else','fi']);
          node.branches.push({cond, body:b});
          const e = stmts[pos++];
          if (!e){ errs.push({ln:st.ln, m:'syntax error: unexpected end of file (chýba fi)'}); break; }
          if (e.s.startsWith('elif')){ cond = e.s.slice(5).replace(/\s+then$/,''); continue; }
          if (e.s==='else'){ node.els = parse(['fi']); if (!stmts[pos]) errs.push({ln:st.ln, m:'syntax error: unexpected end of file (chýba fi)'}); pos++; }
          break;
        }
        body.push(node); continue;
      }
      if (w==='for' || w==='select'){
        const cm = s.match(/^for\s*\(\((.*)\)\)\s*$/);
        const m = s.match(/^(?:for|select)\s+(\w+)(?:\s+in\s+(.*))?$/);
        if (stmts[pos] && stmts[pos].s==='do') pos++; else if (stmts[pos] && W(stmts[pos].s)!=='do'){ const k = stmts.slice(pos).find(x=>/^(do|done)\b/.test(x.s)); if (k && W(k.s)==='done') errs.push({ln:k.ln, m:"syntax error near unexpected token `done'"}); }
        const b = parse(['done']); const endF = stmts[pos]; if (!endF) errs.push({ln:st.ln, m:'syntax error: unexpected end of file (chýba done)'}); pos++;
        const tl = doneTail(endF && endF.s);
        if (cm){ const [i1,c1,s1] = cm[1].split(';'); body.push({t:'cfor', init:i1||'', cond:c1||'1', step:s1||'', body:b, ln:st.ln, out:tl.out, pipe:tl.pipe}); }
        else body.push({t:'for', v:m?m[1]:'x', words:m&&m[2]!=null?m[2]:'"$@"', body:b, ln:st.ln, out:tl.out, pipe:tl.pipe});
        continue;
      }
      const pw = s.match(/^(.+?)\s*\|\s*(while|until)\s+(.+)$/);
      if (w==='while' || w==='until' || pw){
        const kind = pw ? pw[2] : w; const cond = pw ? pw[3] : s.slice(w.length+1);
        if (stmts[pos] && stmts[pos].s==='do') pos++;
        const b = parse(['done']); const end = stmts[pos]; if (!end) errs.push({ln:st.ln, m:'syntax error: unexpected end of file (chýba done)'}); pos++;
        const tl = doneTail(end && end.s); let input = tl.input;
        if (pw) input = {k:'pipe', v: pw[1]};
        body.push({t:kind, cond, body:b, input, ln:st.ln, out:tl.out, pipe:tl.pipe}); continue;
      }
      if (w==='case'){
        const m0 = s.match(/^case\s+(.+?)\s+in\s+(.+)$/);
        if (m0) stmts.splice(pos, 0, {s:m0[2], ln:st.ln});
        const m = m0 || s.match(/^case\s+(.+?)\s+in$/);
        const node = {t:'case', word: m ? m[1] : '', arms:[], ln:st.ln};
        while (pos < stmts.length && stmts[pos].s!=='esac'){
          const ps = stmts[pos].s;
          if (ps===';;'){ pos++; continue; }
          const pm = ps.match(/^\(?\s*([^)]*?)\s*\)\s*(.*)$/);
          if (!pm){ pos++; continue; }
          pos++;
          const arm = {pats: pm[1].split('|').map(x=>x.trim()), body:[]};
          if (pm[2] && pm[2]!==';;'){ stmts.splice(pos, 0, {s:pm[2], ln:stmts[pos-1].ln}); }
          arm.body = parse([';;','esac']);
          node.arms.push(arm);
        }
        if (!stmts[pos]) errs.push({ln:st.ln, m:'syntax error: unexpected end of file (chýba esac)'});
        pos++; body.push(node); continue;
      }
      const f1 = s.match(/^(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{\s*(.+?);?\s*\}$/) || s.match(/^function\s+([A-Za-z_][\w-]*)\s*\{\s*(.+?);?\s*\}$/);
      if (f1){ const sub = this._parseScript(this._scriptStmts(f1[2].replace(/;\s*$/,''))); body.push({t:'fn', name:f1[1], body:sub.ast}); continue; }
      const fm = s.match(/^(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{?$/) || s.match(/^function\s+([A-Za-z_][\w-]*)\s*\{?$/);
      if (fm){ if (stmts[pos] && stmts[pos].s==='{') pos++; const b = parse(['}']); if (!stmts[pos]) errs.push({ln:st.ln, m:'syntax error: unexpected end of file (chýba })'}); pos++; body.push({t:'fn', name:fm[1], body:b}); continue; }
      if (s==='{') { const b = parse(['}']); pos++; body.push({t:'grp', body:b}); continue; }
      if (['fi','done','esac','then','do','else','elif','}',';;'].includes(w)){ errs.push({ln:st.ln, m:`syntax error near unexpected token \`${w}'`}); continue; }
      body.push({t:'cmd', s, ln:st.ln});
    }
    return body;
  };
  const ast = parse([]);
  return {ast, errs};
};

/* ---------- [[ ]] ---------- */
P._dbl = function(inner){
  const toks = (this._tokenize(inner)||[]).map(t=>t.op ? {v:t.op, q:false} : t);
  const or = []; let cur = [];
  toks.forEach(t=>{ if (!t.q && t.v==='||'){ or.push(cur); cur=[]; } else cur.push(t); }); or.push(cur);
  const one = x => {
    if (!x.length) return false;
    if (!x[0].q && x[0].v==='!') return !one(x.slice(1));
    if (x.length===3){ const [l,op,r] = x; if (!op.q){
      if (op.v==='==' || op.v==='=') return r.q ? l.v===r.v : this._globMatch(r.v, l.v);
      if (op.v==='!=') return r.q ? l.v!==r.v : !this._globMatch(r.v, l.v);
      if (op.v==='=~'){ try { return new RegExp(r.v).test(l.v); } catch(e){ return false; } }
      if (op.v==='<') return l.v < r.v; if (op.v==='>') return l.v > r.v;
    } }
    return this._test(x.map(t=>t.v)).code===0;
  };
  return or.some(grp=>{ const and = []; let c = []; grp.forEach(t=>{ if (!t.q && t.v==='&&'){ and.push(c); c=[]; } else c.push(t); }); and.push(c); return and.every(one); });
};

/* ---------- vykonanie ---------- */
P._globMatch = function(pat, s){ try { return new RegExp('^'+g2re(pat,true,true)+'$').test(s); } catch(e){ return pat===s; } };
P._words = function(str){
  const am = str.trim().match(/^"?\$\{(\w+)\[[@*]\]\}"?$/);
  if (am) return ((this.arr||{})[am[1]] || []).slice();
  if (str.trim()==='"$@"' || str.trim()==='$@') return (this.posArgs||[]).slice();
  const toks = this._tokenize(str) || []; const words = [];
  toks.forEach(t=>{ if (t.op) return; const g = this._glob(t); g.forEach(x=>{ if (!t.q && /\s/.test(x)) words.push(...x.split(/\s+/).filter(Boolean)); else words.push(x); }); });
  return words;
};
P._readLine = function(s, ctx){
  const toks = (this._tokenize(s)||[]).map(t=>t.v);
  let pre = {}; while (toks[0] && /^\w+=/.test(toks[0]) ){ const t = toks.shift(); pre[t.slice(0,t.indexOf('='))] = t.slice(t.indexOf('=')+1); }
  toks.shift(); // read
  const vars = []; let prompt = '', arrName = null;
  for (let i=0;i<toks.length;i++){ const t = toks[i]; if (t==='-p'){ prompt = toks[++i]||''; continue; } if (t==='-a'){ arrName = toks[++i]; continue; } if (t==='-t'||t==='-n'||t==='-d'||t==='-u'){ i++; continue; } if (/^-[rse]+$/.test(t)) continue; vars.push(t); }
  const src = ctx.inputs[ctx.inputs.length-1];
  if (prompt) ctx.err += prompt;
  if (!src || !src.length){ vars.forEach(v=>this.env[v]=''); if (prompt) ctx.err += '\n(simulátor: read čaká na vstup z klávesnice; v skripte tu vstup nie je, premenná ostala prázdna)\n'; this.lastCode = 1; return; }
  const line = src.shift();
  const IFS = pre.IFS!=null ? pre.IFS : (this.env.IFS!=null ? this.env.IFS : ' \t\n');
  const ws = /^[\s]*$/.test(IFS);
  const reS = new RegExp('['+IFS.replace(/[\]\\^-]/g,'\\$&').replace(/\n/g,'\\n').replace(/\t/g,'\\t')+']');
  const parts = ws ? line.trim().split(/\s+/) : line.split(reS);
  if (arrName){ (this.arr=this.arr||{})[arrName] = parts.filter(x=>!ws||x!==''); this.env[arrName] = this.arr[arrName][0]||''; }
  if (!vars.length && !arrName) vars.push('REPLY');
  vars.forEach((v,i)=>{ this.env[v] = i===vars.length-1 ? (ws ? parts.slice(i).join(' ') : parts.slice(i).join(IFS[0])) : (parts[i]||''); });
  this.lastCode = 0;
};
P._inputFor = function(inp){
  if (!inp) return null;
  if (inp.k==='<'){ const f = (this._tokenize(inp.v)||[])[0]; const n = f && this.node(f.v); if (!n) throw {redirErr: `${f?f.v:'?'}: No such file or directory`}; if (n.t==='d') throw {redirErr: `${f.v}: Is a directory`}; const txt = typeof n.c==='string' ? n.c : (typeof this.read==='function' ? (this.read(f.v)||'') : ''); return txt.replace(/\n$/,'').split('\n'); }
  if (inp.k==='<<<'){ const t = (this._tokenize(inp.v)||[]).map(x=>x.v).join(' '); return t.split('\n'); }
  if (inp.k==='<<(' || inp.k==='pipe'){ const r = this._runRaw.call(this, ' '+inp.v); return (r.o||'').replace(/\n$/,'').split('\n').filter((x,i,a)=>!(a.length===1 && x==='')); }
  return null;
};
P._runCmd = function(s, ctx, cond){
  if (++ctx.steps > 6000) throw {limit:true};
  this._unbound = null; this._paramErr = null;
  let m;
  const w = s.split(/\s+/);
  // skupina za && / ||
  if ((m = s.match(/^(.*?)\s*(&&|\|\|)\s*\{\s*(.*?);?\s*\}\s*$/))){
    this._runCmd(m[1], ctx, true);
    if ((m[2]==='&&') === (this.lastCode===0)){ const sub = this._parseScript(this._scriptStmts(m[3])); this._exAst(sub.ast, ctx); }
    return;
  }
  // zoznam a && b || c: každú časť zvlášť (aby fungovalo exit, return, polia, funkcie…)
  if (/&&|\|\||;/.test(s) && !/<<HD:/.test(s)){
    const ch = this._splitChain(s);
    if (ch.length>1){ let skip = false; for (let k=0;k<ch.length;k++){ const {cmd, op} = ch[k]; if (!skip) this._runCmd(cmd.trim(), ctx, op!==';' || cond); if (op==='&&') skip = this.lastCode!==0; else if (op==='||') skip = this.lastCode===0; else skip = false; } return; }
  }
  if (this.traceOn) ctx.out += '+ '+s+'\n';
  // vstavané príkazy riadenia
  if (w[0]==='exit'){ const v = w[1]!=null ? ((this._tokenize(s.slice(4))||[])[0]||{v:'0'}).v : this.lastCode; throw {exit: parseInt(v,10)||0}; }
  if (w[0]==='return') throw {ret: w[1]!=null ? parseInt(((this._tokenize(s.slice(6))||[])[0]||{v:'0'}).v,10)||0 : this.lastCode};
  if (w[0]==='break') throw {brk:true};
  if (w[0]==='continue') throw {cont:true};
  if (s===':' ) { this.lastCode = 0; return; }
  if (w[0]==='shift'){ const n = w[1] ? (parseInt(((this._tokenize(s.slice(5))||[])[0]||{v:'1'}).v,10)||0) : 1; this.posArgs = (this.posArgs||[]).slice(n); this.lastCode = 0; return; }
  if (w[0]==='set' && w.length>1){
    const t = w.slice(1); for (let i=0;i<t.length;i++){ const a=t[i]; if (a==='-o'||a==='+o'){ const o=t[++i]; if (o==='pipefail') this.pipefail = a[0]==='-'; if (o==='errexit') this.errexit = a[0]==='-'; if (o==='nounset') this.nounset = a[0]==='-'; if (o==='xtrace') this.traceOn = a[0]==='-'; continue; } if (/^[-+][euxo]+$/.test(a)){ const on = a[0]==='-'; for (const L of a.slice(1)){ if (L==='e') this.errexit=on; if (L==='u') this.nounset=on; if (L==='x') this.traceOn=on; if (L==='o'){ const o=t[++i]; if (o==='pipefail') this.pipefail=on; } } } }
    this.lastCode = 0; return;
  }
  if (w[0]==='trap'){ const toks = (this._tokenize(s.slice(4))||[]).map(x=>x.v); const cmd = toks.shift(); toks.forEach(sig=>ctx.traps[sig.replace(/^SIG/,'')] = cmd); this.lastCode = 0; return; }
  if (/^(\[\[|\(\()/.test(s)){
    const close = s.startsWith('[[') ? ']]' : '))'; const e = s.indexOf(close, 2);
    if (e>0){
      const inner = s.slice(2, e); const rest = s.slice(e+2).trim();
      this.lastCode = s.startsWith('[[') ? (this._dbl(inner) ? 0 : 1) : (this._arith(inner) ? 0 : 1);
      if (this._unbound){ this._afterCmd(s, ctx, true); }
      const cm = rest.match(/^(&&|\|\|)\s*(.+)$/);
      if (cm){ if ((cm[1]==='&&') === (this.lastCode===0)) this._runCmd(cm[2], ctx, cond); return; }
      if (!rest) return;
    }
  }
  if (w[0]==='let'){ (this._tokenize(s.slice(3))||[]).forEach(t=>{ const r = this._arith(t.v); this.lastCode = r ? 0 : 1; }); return; }
  if ((m = s.match(/^(?:declare\s+-a\s+|local\s+)?([A-Za-z_]\w*)(\+?)=\((.*)\)$/))){ const list = this._words(m[3]); this.arr = this.arr||{}; this.arr[m[1]] = m[2] ? (this.arr[m[1]]||[]).concat(list) : list; this.env[m[1]] = this.arr[m[1]][0]||''; this.lastCode = 0; return; }
  if ((m = s.match(/^([A-Za-z_]\w*)\[([^\]]+)\]=(.*)$/))){ this.arr = this.arr||{}; const a = this.arr[m[1]] = this.arr[m[1]]||[]; a[this._arith(m[2])] = ((this._tokenize(m[3])||[])[0]||{v:''}).v; this.lastCode = 0; return; }
  if ((m = s.match(/^(?:declare|typeset|readonly)\s+(?:-[a-zA-Z]+\s+)*(.*)$/))){ return this._runCmd(m[1] ? m[1] : ':', ctx, cond); }
  if (w[0]==='source' || w[0]==='.'){ const f = (this._tokenize(w.slice(1).join(' '))||[])[0]; const n = f && this.node(f.v); if (!n || n.t!=='f'){ ctx.err += `${this.scriptName}: line ${this.lineNo}: ${f?f.v:''}: No such file or directory\n`; this.lastCode = 1; return; } const sub = this._parseScript(this._scriptStmts(n.c)); this._exAst(sub.ast, ctx); return; }
  if (w[0]==='getopts'){
    const toks = (this._tokenize(s.slice(7))||[]).map(x=>x.v); const spec = toks[0]||'', vn = toks[1]||'opt';
    let idx = +(this.env.OPTIND||1); const pa = this.posArgs||[]; const a = pa[idx-1];
    if (!a || !/^-./.test(a) || a==='--'){ if (a==='--') this.env.OPTIND = String(idx+1); this.env[vn] = '?'; this.lastCode = 1; return; }
    const L = a[1]; const k = spec.indexOf(L);
    if (k<0){ ctx.err += `${this.scriptName}: illegal option -- ${L}\n`; this.env[vn] = '?'; this.env.OPTIND = String(idx+1); this.lastCode = 0; return; }
    this.env[vn] = L;
    if (spec[k+1]===':'){ if (a.length>2){ this.env.OPTARG = a.slice(2); idx++; } else { this.env.OPTARG = pa[idx]||''; idx+=2; } } else idx++;
    this.env.OPTIND = String(idx); this.lastCode = 0; return;
  }
  if (/^(\w+=\S*\s+)*read(\s|$)/.test(s) && ctx.inputs.length){ this._readLine(s, ctx); return; }
  if ((m = s.match(/^\{\s*(.*?);?\s*\}\s*$/))){ const sub = this._parseScript(this._scriptStmts(m[1])); this._exAst(sub.ast, ctx); return; }
  // ! príkaz
  if ((m = s.match(/^!\s+(.*)$/))){ this._runCmd(m[1], ctx, true); this.lastCode = this.lastCode ? 0 : 1; return; }
  // volanie funkcie
  const fns = this._fns = this._fns || {};
  if (fns[w[0]] && !/[|><&;]/.test(s.replace(/"[^"]*"|'[^']*'/g,''))){ this._callFn(w[0], this._words(s.slice(w[0].length)), ctx); this._afterCmd(s, ctx, cond); return; }
  // set -u: nedefinovaná premenná zastaví skript ešte pred príkazom
  if (this.nounset){
    const bare = s.replace(/'[^']*'/g,'');
    const re = /\$\{?([A-Za-z_]\w*)(\}|(?![\w]))/g; let mm;
    while ((mm = re.exec(bare))){ const v = mm[1]; const after = bare.slice(mm.index+mm[0].length-1); if (/^\{/.test(bare.slice(mm.index+1)) && /^[^}]*:?[-=+?]/.test(bare.slice(mm.index+2+v.length))) continue; if (!(this.env && v in this.env) && !(this.arr && v in this.arr) && !['HOME','USER','PWD','HOSTNAME','SHELL','PATH','RANDOM','LINENO','OPTIND','OPTARG','IFS'].includes(v)){ ctx.err += `${this.scriptName}: line ${this.lineNo}: ${v}: unbound variable\n`; throw {exit:1}; } }
  }
  // heredoc / here-string -> dočasný súbor
  let line = s; const tmp = [];
  if (ctx.stdin != null && !/[<|]/.test(s.replace(/"[^"]*"|'[^']*'/g,''))){ const p = '/tmp/.stdin-'+ctx.steps; this._mkPath(p,'f',0o600,this.user,this.user,ctx.stdin); tmp.push(p); line = s + ' < ' + p; ctx.stdin = null; }
  line = line.replace(/<<HD:(h\d+)/g, (x,id)=>{ const h = this._hd[id]; let c = h.body; if (h.expand){ const t = this._tokenize('"'+c.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\\\\\$/g,'\\$')+'"'); c = t && t[0] ? t[0].v : c; } const p = '/tmp/.heredoc-'+id; this._mkPath ? (this.node(p) ? (this.node(p).c=c) : this._mkPath(p,'f',0o600,this.user,this.user,c)) : null; tmp.push(p); return '< '+p; });
  line = line.replace(/<<<\s*("(?:[^"\\]|\\.)*"|'[^']*'|\S+)/g, (x,v)=>{ const t = (this._tokenize(v)||[]).map(y=>y.v).join(' ')+'\n'; const p = '/tmp/.herestr-'+(ctx.steps); if (this.node(p)) this.node(p).c = t; else this._mkPath(p,'f',0o600,this.user,this.user,t); tmp.push(p); return '< '+p; });
  const r = (this._runRaw || this.run).call(this, ' '+line);
  tmp.forEach(p=>{ try { this._rmPath ? this._rmPath(p) : (()=>{ const d = this.node('/tmp'); if (d && d.c) delete d.c[p.split('/').pop()]; })(); } catch(e){} });
  ctx.out += r.o||''; ctx.err += r.e||'';
  if (this._paramErr){ ctx.err += `${this.scriptName}: line ${this.lineNo}: ${this._paramErr}\n`; throw {exit:1}; }
  this._afterCmd(s, ctx, cond);
};
P._afterCmd = function(s, ctx, cond){
  if (this._unbound){ ctx.err += `${this.scriptName}: line ${this.lineNo}: ${this._unbound}: unbound variable\n`; this._unbound = null; throw {exit:1}; }
  if (this.errexit && !cond && this.scriptName!=='-bash' && this.lastCode!==0 && !/(&&|\|\|)/.test(s.replace(/\[\[.*?\]\]/g,'')) && !ctx.noErrexit) throw {exit:this.lastCode, errexit:true};
};
P._callFn = function(name, args, ctx){
  const sv = this.posArgs; this.posArgs = args;
  ctx.depth = (ctx.depth||0)+1; if (ctx.depth > 50){ ctx.err += `${this.scriptName}: ${name}: príliš hlboká rekurzia\n`; throw {exit:1}; }
  try { this._exAst(this._fns[name], ctx); }
  catch(x){ if (!x || !('ret' in x)){ this.posArgs = sv; ctx.depth--; throw x; } this.lastCode = x.ret; }
  this.posArgs = sv; ctx.depth--;
};
P._loopOut = function(n, ctx, fn){
  if (!n.out && !n.pipe) return fn();
  const start = ctx.out.length;
  try { fn(); }
  finally {
    const cap = ctx.out.slice(start); ctx.out = ctx.out.slice(0, start);
    if (n.out){ const f = ((this._tokenize(n.out.f)||[])[0]||{v:n.out.f}).v; const w = this._writeFile(f, cap, n.out.app); if (w) ctx.err += w; }
    else if (n.pipe){ const p = '/tmp/.loop-'+ctx.steps; this._mkPath(p,'f',0o600,this.user,this.user,cap); const r = this._runRaw.call(this, ' cat '+p+' | '+n.pipe); ctx.out += r.o||''; ctx.err += r.e||''; const d = this.node('/tmp'); if (d && d.c) delete d.c[p.split('/').pop()]; }
  }
};
P._exAst = function(nodes, ctx){
  for (const n of nodes){
    if (n.ln) this.lineNo = n.ln;
    if ((n.t==='for'||n.t==='cfor'||n.t==='while'||n.t==='until') && (n.out||n.pipe) && !n._inner){ const inner = Object.assign({}, n, {_inner:true}); this._loopOut(n, ctx, ()=>this._exAst([inner], ctx)); continue; }
    if (n.t==='cmd') this._runCmd(n.s, ctx, false);
    else if (n.t==='fn'){ (this._fns = this._fns||{})[n.name] = n.body; this.lastCode = 0; }
    else if (n.t==='grp') this._exAst(n.body, ctx);
    else if (n.t==='if'){
      let done=false;
      for (const br of n.branches){ this._runCmd(br.cond, ctx, true); if (this.lastCode===0){ this._exAst(br.body, ctx); done=true; break; } }
      if (!done){ if (n.els) this._exAst(n.els, ctx); else this.lastCode = 0; }
    }
    else if (n.t==='for'){
      const words = this._words(n.words);
      for (const wv of words){ this.env[n.v]=wv; try { this._exAst(n.body, ctx); } catch(x){ if (x.brk) break; if (x.cont) continue; throw x; } }
    }
    else if (n.t==='cfor'){
      let guard = 0; this._arith(n.init);
      while (this._arith(n.cond)){ if (++guard>500){ ctx.err += `${this.scriptName}: cyklus prerušený po 500 opakovaniach (ochrana simulátora)\n`; break; } try { this._exAst(n.body, ctx); } catch(x){ if (x.brk) break; if (!x.cont) throw x; } this._arith(n.step); }
    }
    else if (n.t==='while' || n.t==='until'){
      let lines = null;
      try { lines = this._inputFor(n.input); } catch(x){ if (x.redirErr){ ctx.err += `${this.scriptName}: line ${n.ln}: ${x.redirErr}\n`; this.lastCode = 1; continue; } throw x; }
      const snap = n.input && n.input.k==='pipe' ? JSON.stringify(this.env) : null;
      if (lines) ctx.inputs.push(lines);
      let guard=0;
      try {
        while (true){
          if (++guard>500){ ctx.err+=`${this.scriptName}: cyklus prerušený po 500 opakovaniach (ochrana simulátora)\n`; break; }
          this._runCmd(n.cond, ctx, true); const ok = this.lastCode===0;
          if (n.t==='while' ? !ok : ok) break;
          try { this._exAst(n.body, ctx); } catch(x){ if (x.brk) break; if (x.cont) continue; throw x; }
        }
      } finally { if (lines) ctx.inputs.pop(); }
      if (snap) this.env = JSON.parse(snap);   // rúra = podshell: zmeny premenných sa stratia
      this.lastCode = 0;
    }
    else if (n.t==='case'){
      const word = this._words(n.word).join(' ');
      for (const arm of n.arms){
        if (arm.pats.some(p=>{ const pv = ((this._tokenize(p)||[])[0]||{v:p}).v; return this._globMatch(pv, word); })){ this._exAst(arm.body, ctx); break; }
      }
    }
  }
};

P._runScript = function(text, args, name){
  const save = {args:this.posArgs, name:this.scriptName, e:this.errexit, u:this.nounset, x:this.traceOn, pf:this.pipefail, optind:(this.env||{}).OPTIND};
  this.posArgs = args||[]; this.scriptName = name||'bash'; this.env = this.env||{};
  if (name && name!=='-bash'){ this.env.OPTIND = '1'; }
  const ctx = {out:'', err:'', steps:0, traps:{}, inputs:[]};
  const {ast, errs} = this._parseScript(this._scriptStmts(text));
  let code = 0;
  if (errs.length){
    const e = errs[0];
    code = 2; ctx.err += `${this.scriptName==='-bash'?'-bash':this.scriptName}: line ${e.ln}: ${e.m}\n`;
  } else {
    try { this._exAst(ast, ctx); code = this.lastCode; }
    catch(x){ if (x && 'exit' in x) code = x.exit; else if (x && x.limit){ ctx.err += `${this.scriptName}: príliš veľa krokov (ochrana simulátora)\n`; code=1; } else if (x && ('ret' in x)) code = x.ret; else if (x && (x.brk||x.cont)) code = 0; else if (x instanceof Error){ ctx.err += `${this.scriptName}: interná chyba simulátora: ${x.message}\n`; code = 1; } else throw x; }
    if (ctx.traps.EXIT && name!=='-bash'){ this.lastCode = code; try { const sub = this._parseScript(this._scriptStmts(ctx.traps.EXIT)); const keep = code; this._exAst(sub.ast, ctx); code = keep; } catch(x){ if (x && 'exit' in x) code = x.exit; } }
  }
  this.posArgs = save.args; this.scriptName = save.name; this.lastCode = code;
  if (name && name!=='-bash'){ this.errexit = save.e; this.nounset = save.u; this.traceOn = save.x; this.pipefail = save.pf; if (save.optind!=null) this.env.OPTIND = save.optind; }
  return {o:ctx.out, e:ctx.err, code};
};

/* funkcia volaná v rúre, $( ) alebo s presmerovaním */
const origExec = P.exec;
P.exec = function(args, stdin, piped){
  if (this._fns && args[0] && this._fns[args[0]] && !this['c_'+args[0].replace(/[.-]/g,'_')]){
    const ctx = {out:'', err:'', steps:0, traps:{}, inputs: stdin ? [String(stdin).replace(/\n$/,'').split('\n')] : [], stdin: stdin!=null ? String(stdin) : null};
    try { this._callFn(args[0], args.slice(1), ctx); } catch(x){ if (x && 'exit' in x) this.lastCode = x.exit; else if (!(x && (x.brk||x.cont))) throw x; }
    return {o:ctx.out, e:ctx.err, code:this.lastCode};
  }
  return origExec.call(this, args, stdin, piped);
};
/* je príkaz v termináli nedokončený? (bash by ukázal > ) */
P._incomplete = function(text){
  if (/(\\|\||&&)\s*$/.test(text) && !/\|\|\s*$/.test(text.replace(/\|\|\s*$/,'')+'x')) return true;
  if (/(^|[^\\])\\$/.test(text)) return true;
  let q = null; for (let i=0;i<text.length;i++){ const c = text[i]; if (q){ if (c===q) q=null; else if (c==='\\' && q==='"') i++; continue; } if (c==='\\'){ i++; continue; } if (c==='"' || c==="'") q = c; else if (c==='#' && (i===0 || /\s/.test(text[i-1]))){ const e = text.indexOf('\n', i); if (e<0) break; i = e; } }
  if (q) return true;
  const hd = text.match(/<<-?\s*['"]?([A-Za-z_]\w*)['"]?/); if (hd && !/<<</.test(hd[0]) && !new RegExp('\\n\\t*'+hd[1]+'\\s*$','m').test(text)) return true;
  const {errs} = this._parseScript(this._scriptStmts(text));
  if (errs.some(e=>/unexpected end of file/.test(e.m))) return true;
  if (/(^|\s)\{\s*$/.test(text) || (/\(\)\s*\{/.test(text) && (text.match(/\{/g)||[]).length > (text.match(/\}/g)||[]).length)) return true;
  return false;
};
/* príkazy zadané priamo v termináli: case, funkcie, (( )), polia, heredoc… */
const origRun = P.run;
P._runRaw = origRun;
P.run = function(line){
  const t = line.trim();
  if (/^(case|select)\s|^[A-Za-z_][\w-]*\s*\(\)\s*\{|^function\s|^\(\(|^[A-Za-z_]\w*\+?=\(|^[A-Za-z_]\w*\[[^\]]+\]=|^(shift|getopts|trap|let|source|declare|readonly)\b|^\.\s|<<-?\s*['"]?\w|<<<|^\[\[|^\{\s|\|\s*while\s|^set\s+[-+]/.test(t) || (this._fns && this._fns[t.split(/\s+/)[0]])){
    if (!line.startsWith(' ')) this.history.push(line.replace(/\s+$/,''));
    const r = this._runScript(t, this.posArgs||[], '-bash'); return {o:r.o, e:r.e};
  }
  if (this.traceOn && t && !line.startsWith(' ')){ const r = origRun.call(this, line); return {o:'+ '+t+'\n'+(r.o||''), e:r.e}; }
  return origRun.call(this, line);
};
/* ./skript: CRLF z Windows */
const origScript = P.c__runscript;
P.c__runscript = function(name, args){
  const n = this.node(name);
  if (n && n.t==='f' && this.can(n,1) && /^#![^\n]*\r/.test(n.c)){ const sh = n.c.split('\n')[0].slice(2).replace(/\r$/,''); return {e:`-bash: ${name}: ${sh}^M: bad interpreter: No such file or directory\n(súbor má konce riadkov z Windows \\r\\n; oprava: sed -i 's/\\r$//' ${name})\n`, code:126}; }
  if (n && n.t==='f' && this.can(n,1) && /\r/.test(n.c)) return origScript.call(this, name, args);
  return origScript.call(this, name, args);
};
const origBash = P.c_bash;
P.c_bash = function(a){
  if (a[0]==='-n'){
    const n = this.node(a[1]||''); if (!n) return {e:`bash: ${a[1]}: No such file or directory\n`, code:127};
    const {errs} = this._parseScript(this._scriptStmts(n.c));
    const q = (n.c.split('\n').findIndex(l=>((l.replace(/\\./g,'').match(/"/g)||[]).length % 2)===1 && !/^\s*#/.test(l)));
    if (errs.length) return {e:`${a[1]}: line ${errs[0].ln}: ${errs[0].m}\n`, code:2};
    if (q>=0 && !/<</.test(n.c)) return {e:`${a[1]}: line ${q+1}: unexpected EOF while looking for matching \`"'\n`, code:2};
    return {o:'', code:0};
  }
  if (a[0] && /\r/.test((this.node(a[0])||{}).c||'')){
    return {e:`(simulátor: ${a[0]} má konce riadkov z Windows \\r\\n. Bash berie \\r ako súčasť príkazu. Typické chyby: $'\\r': command not found, cd: $'/tmp\\r': No such file or directory, /bin/bash^M: bad interpreter.\n Over: cat -A ${a[0]}  (na konci riadkov uvidíš ^M$)\n Oprava: sed -i 's/\\r$//' ${a[0]})\n`, code:127};
  }
  return origBash.call(this, a);
};
/* echo -e */
const origEcho = P.c_echo;
P.c_echo = function(a){
  if (a[0]==='-e' || (a[0]==='-ne'||a[0]==='-en')){ const nl = !/n/.test(a[0].slice(1).replace('e','')); const t = a.slice(1).join(' ').replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/\\e\[[0-9;]*m|\\033\[[0-9;]*m/g,''); return t + (nl?'\n':''); }
  return origEcho.call(this, a);
};
const origCat = P.c_cat;
P.c_cat = function(a, stdin){
  const fl = a.filter(x=>/^-[AETvn]+$/.test(x)).join('');
  if (!/[AETv]/.test(fl)) return origCat.call(this, a, stdin);
  const r = origCat.call(this, a.filter(x=>!/^-[AETvn]+$/.test(x)), stdin);
  const t = typeof r==='string' ? r : (r.o||'');
  const A = /A/.test(fl);
  let o = t.split('\n').map((l,i,arr)=>{ if (i===arr.length-1 && l==='') return l; let x = l.replace(/\r/g,'^M'); if (A || /T/.test(fl)) x = x.replace(/\t/g,'^I'); if (A || /E/.test(fl)) x += '$'; return x; }).join('\n');
  return typeof r==='string' ? o : Object.assign({}, r, {o});
};
const origDf = P.c_df;
P.c_df = function(a){ const out = []; const ex = []; for (let i=0;i<a.length;i++){ if (a[i]==='-x' || a[i]==='-t'){ ex.push([a[i], a[++i]]); continue; } if (/^--exclude-type=/.test(a[i])){ ex.push(['-x', a[i].split('=')[1]]); continue; } out.push(a[i]==='-hP'||a[i]==='-Ph' ? '-h' : a[i]); } const r = origDf.call(this, out.filter(x=>x!=='-P')); if (!ex.length) return r; const t = typeof r==='string'?r:r.o; const lines = t.split('\n'); const fsOf = l => { const mm = this.mounts.find(m=>l.startsWith(m.dev) && l.trim().endsWith(' '+m.dir)); return mm ? mm.fs : ''; }; return [lines[0]].concat(lines.slice(1).filter(l=>!l || ex.every(([k,v])=> k==='-x' ? fsOf(l)!==v : fsOf(l)===v))).join('\n'); };
const origTail = P.c_tail;
P.c_tail = function(a, stdin){ const i = a.findIndex((x,k)=>/^\+\d+$/.test(x) && a[k-1]==='-n' || /^-n\+\d+$/.test(x)); if (i<0) return origTail.call(this, a, stdin); const n = +a[i].replace(/^-n/,'').replace('+',''); const rest = a.filter((x,k)=>k!==i && !(k===i-1 && x==='-n')); const files = rest.filter(x=>!x.startsWith('-')); let txt = stdin||''; if (files.length){ const nd = this.node(files[0]); if (!nd) return {e:`tail: cannot open '${files[0]}' for reading: No such file or directory\n`, code:1}; txt = nd.c; } const L = txt.replace(/\n$/,'').split('\n'); return L.slice(n-1).join('\n') + (L.length>=n ? '\n' : ''); };
const origSc = P.c_systemctl;
P.c_systemctl = function(a){ const q = a.includes('--quiet') || a.includes('-q'); const r = origSc.call(this, a.filter(x=>x!=='--quiet' && x!=='-q')); if (!q || !/^is-(active|enabled|failed)$/.test(a.find(x=>!x.startsWith('-'))||'')) return r; const o = typeof r==='string' ? {o:r} : r; return {o:'', e:'', code: o.code!=null ? o.code : 0}; };
const origDate = P.c_date;
P.c_date = function(a){ if (a[0] && a[0].startsWith('+') && /%[TSs]/.test(a[0])){ const d = new Date(); const z = x=>String(x).padStart(2,'0'); a = [a[0].replace(/%T/g, `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`).replace(/%S/g, z(d.getSeconds())).replace(/%s/g, String(Math.floor(d/1000)))].concat(a.slice(1)); } return origDate.call(this, a); };
const origLogger = P.c_logger;
P.c_logger = function(a){
  let tag = this.user, pri = 'user.notice'; const msg = [];
  for (let i=0;i<a.length;i++){ if (a[i]==='-t'){ tag = a[++i]; continue; } if (a[i]==='-p'){ pri = a[++i]; continue; } if (/^-/.test(a[i])) continue; msg.push(a[i]); }
  const d = new Date(); const z = x=>String(x).padStart(2,'0');
  const line = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())} ${this.hostname} ${tag}[${3000+(this._ulog||[]).length}]: ${msg.join(' ')}`;
  (this._ulog = this._ulog || []).push({tag, pri, line});
  const mf = this._lookup('/var/log/messages'); if (mf) mf.c += line.replace(/^(\w+) 0?(\d+)/, (x,mo,dd)=>`${mo} ${String(dd).padStart(2,' ')}`) + '\n';
  return origLogger.call(this, a);
};
const origJ7 = P.c_journalctl;
P.c_journalctl = function(a){
  const ti = a.findIndex(x=>x==='-t' || x==='--identifier' || /^--identifier=/.test(x));
  if (ti>=0){
    const tag = /=/.test(a[ti]) ? a[ti].split('=')[1] : a[ti+1];
    const L = (this._ulog||[]).filter(x=>x.tag===tag).map(x=>x.line);
    const base = origJ7.call(this, a.filter((x,k)=>k!==ti && !(k===ti+1 && !/=/.test(a[ti])) && x!=='-n' && a[k-1]!=='-n')); const bt = typeof base==='string' ? base : (base.o||'');
    const all = bt.split('\n').filter(x=>x && !/^-- No entries/.test(x) && x.includes(' '+tag+'[')).concat(L);
    const ni = a.indexOf('-n'); const n = ni>=0 ? +a[ni+1] : 0;
    const out = n ? all.slice(-n) : all;
    return out.length ? out.join('\n')+'\n' : '-- No entries --\n';
  }
  return origJ7.call(this, a);
};
P.c_mktemp = function(a){ const d = a.includes('-d'); const p = '/tmp/tmp.'+Math.random().toString(36).slice(2,12); if (d) this._mkPath(p,'d',0o700,this.user,this.user); else this._mkPath(p,'f',0o600,this.user,this.user,''); return p+'\n'; };
P.c_flock = function(a){ const i = a.findIndex(x=>!x.startsWith('-') && !/^\d+$/.test(x)); const rest = a.slice(i+1); if (!rest.length) return {o:'',code:0}; return this.exec(rest.filter(x=>x!=='-c'), null, false); };
P.c_timeout = function(a){ return this.exec(a.slice(1), null, false); };
P.c_wait = function(){ return {o:'',code:0}; };
P.c_dos2unix = function(a){ for (const f of a.filter(x=>!x.startsWith('-'))){ const n = this.node(f); if (!n) return {e:`dos2unix: ${f}: No such file or directory\n`, code:2}; n.c = n.c.replace(/\r\n/g,'\n'); } return {e:a.filter(x=>!x.startsWith('-')).map(f=>`dos2unix: converting file ${f} to Unix format...`).join('\n')+'\n', code:0}; };
P.c_shellcheck = function(a){ return {e:'bash: shellcheck: command not found\n(shellcheck nie je v repozitároch RHEL; je v EPEL. V simulátore použi bash -n a bash -x)\n', code:127}; };
})();
