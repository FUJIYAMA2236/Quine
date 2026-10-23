// QUINE build: src/ 以下を1枚のHTMLにまとめる
// 使い方: node src/build.js  →  quine.html を出力
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

const css = read('style.css');
const js = ['core.js', 'ui.js', 'tree.js', 'editor.js', 'table.js', 'image.js', 'search.js', 'io.js', 'main.js']
  .map((f) => `// ---- ${f} ----\n` + read(f)).join('\n');

if (/<\/script/i.test(js)) throw new Error('JS内に </script が含まれています');

const html = read('shell.html')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => `(() => {\n'use strict';\n${js}\n})();`);

const out = path.join(dir, '..', 'quine.html');
fs.writeFileSync(out, html);
console.log('built', out, (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
