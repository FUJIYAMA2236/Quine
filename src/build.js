// QUINE build: src/ 以下を1枚のHTMLにまとめる
// 使い方: node src/build.js  →  quine.html と FINGERPRINT.txt を出力
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n?/g, '\n');

const css = read('style.css');
const js = ['core.js', 'ui.js', 'tree.js', 'editor.js', 'table.js', 'image.js', 'search.js', 'linker.js', 'security.js', 'io.js', 'main.js']
  .map((f) => `// ---- ${f} ----\n` + read(f)).join('\n');

if (/<\/script/i.test(js)) throw new Error('JS内に </script が含まれています');
if (/<\/style/i.test(css)) throw new Error('CSS内に </style が含まれています');

let html = read('shell.html')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => `(() => {\n'use strict';\n${js}\n})();`);

// アプリの <script> と <style> の中身（ブラウザの textContent と同じ文字列）
const styleText = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const scriptText = html.match(/<script id="quine-app">([\s\S]*?)<\/script>/)[1];

// CSP: このアプリの <script> だけを実行してよい、と指紋（ハッシュ）で指定する
const scriptHash = crypto.createHash('sha256').update(scriptText, 'utf8').digest('base64');
html = html.replace('__SCRIPT_HASH__', 'sha256-' + scriptHash);

// アプリの指紋：記事データを除くプログラム部分（style + script）の SHA-256。アプリ内の「このツールについて」と同じ計算
const fingerprint = crypto.createHash('sha256').update(styleText + '\n' + scriptText, 'utf8').digest('hex');
const version = (js.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '?';

const out = path.join(dir, '..', 'quine.html');
fs.writeFileSync(out, html);
const fileHash = crypto.createHash('sha256').update(html, 'utf8').digest('hex');

fs.writeFileSync(path.join(dir, '..', 'FINGERPRINT.txt'), [
  `QUINE v${version}`,
  '',
  'アプリの指紋（記事データを除くプログラム部分の SHA-256）',
  'アプリの「このツールについて」に出る値と比べます。記事を保存しても変わりません。',
  fingerprint,
  '',
  '配布用 quine.html ファイル全体の SHA-256（まだ記事を書いていない状態のファイル）',
  'ダウンロードした quine.html を、そのまま Get-FileHash で調べたときの値です。',
  fileHash,
  '',
].join('\n'));

console.log('built', out, (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
console.log('fingerprint', fingerprint);
