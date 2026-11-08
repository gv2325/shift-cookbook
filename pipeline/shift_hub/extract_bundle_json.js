// Extract every JSON.parse('...') literal from the given bundle files.
const fs = require('fs'), path = require('path');
const out = process.argv[2]; const files = process.argv.slice(3);
let n = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /JSON\.parse\('((?:[^'\\]|\\.)*)'\)/g; let m;
  while ((m = re.exec(src))) {
    const lit = m[1].replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|.)/g, (_, e) =>
      e[0]==='x'||(e[0]==='u'&&e.length===5) ? String.fromCharCode(parseInt(e.slice(1),16))
      : ({n:'\n',t:'\t',r:'\r',b:'\b',f:'\f',v:'\v','0':'\0'})[e] ?? e);
    try {
      const v = JSON.parse(lit);
      const keys = Array.isArray(v) ? `array[${v.length}] keys=${Object.keys(v[0]||{}).join(',')}` : Object.keys(v).slice(0, 12).join(',');
      const name = `blob${n++}_${path.basename(f, '.js').slice(0, 6)}.json`;
      fs.writeFileSync(path.join(out, name), JSON.stringify(v, null, 1));
      console.log(name, (lit.length/1024).toFixed(1)+'KB', '->', keys);
    } catch (e) { console.log('skip', f, e.message.slice(0, 60)); }
  }
}
