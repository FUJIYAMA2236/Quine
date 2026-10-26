// 起動直後、画面を組み立てる前の自分自身を「アプリ部分」として控えておく。
// 保存・新規Wiki開設はこのテンプレートのデータ部分だけを差し替えて生成する。
const DATA_MARK = '%%QUINE' + '_DATA%%';
const TEMPLATE = (() => {
  const root = document.documentElement.cloneNode(true);
  root.querySelector('#wiki-data').textContent = DATA_MARK;
  const app = root.querySelector('#app');
  if (app) app.innerHTML = '';
  return '<!DOCTYPE html>\n' + root.outerHTML;
})();

const APP_VERSION = '1.1';
const DATA_VERSION = 1;

// ---------- small helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowISO = () => new Date().toISOString();
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

function uuid() {
  if (crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) { /* insecure context */ } }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const x = Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

// 画像の重複判定用ハッシュ（cyrb53 を2系統つないで約106bit）
// cyrb53 (c) 2018 bryc (github.com/bryc) — Public domain (or MIT if needed).
function hashStr(str) {
  const run = (seed) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  };
  return run(1) + run(7).slice(0, 10);
}

function fmtDate(iso, withYear) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  const md = `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  return (withYear || d.getFullYear() !== new Date().getFullYear()) ? `${d.getFullYear()}/${md}` : md;
}
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
function safeFileName(s) { return String(s).replace(/[\\/:*?"<>|\r\n\t]+/g, '_').trim().slice(0, 80) || 'wiki'; }

// localStorage / sessionStorage は file:// で使えない環境もあるので必ず包む
const store = {
  get(k, d = null) { try { const v = localStorage.getItem('quine:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('quine:' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};
const memName = { v: null };
function userName() { return store.get('userName') || memName.v || ''; }
function setUserName(n) { memName.v = n; store.set('userName', n); }

// ---------- data ----------
let db;            // { meta, images }
const A = new Map(); // id -> article
let IMG = {};      // hash -> { mime, data, w, h }

const S = {
  cur: null,
  edit: false,
  dirty: false,
  touched: new Set(),
  sessionEdits: new Set(),
  linking: false,
  expanded: new Set(),
  search: { q: '', terms: [], hits: new Set(), ctx: new Set(), marks: [], idx: 0 },
};

// fixedId: データが空のファイルを開いたとき、再読み込みしても同じ記事IDになるように
function starterData(name, fixedId) {
  const t = fixedId ? '2026-10-23T00:00:00.000Z' : nowISO();
  const id = fixedId || uuid();
  return {
    meta: { name, version: DATA_VERSION, savedAt: null },
    articles: [{ id, parentId: null, order: 0, title: 'はじめに', body: WELCOME_BODY, createdAt: t, updatedAt: t, updatedBy: 'QUINE', rev: 0 }],
    images: {},
  };
}

const WELCOME_BODY = [
  '<p>ようこそ。これは <strong>QUINE</strong> で作られたWikiです。HTMLファイル1枚の中に、アプリと記事のすべてが入っています。</p>',
  '<h2>読む</h2>',
  '<p>左のツリーから記事を選ぶと、ここに表示されます。上の検索欄に言葉を入れると、タイトルと本文から記事を探せます。</p>',
  '<h2>書く</h2>',
  '<ul><li>記事の右上にある <strong>「編集」</strong> を押すと編集モードになります（画面上部がオレンジ色になります）。</li>',
  '<li>編集を始めるとき、ファイルの最新版を自動で読み込み直します。他の人の変更を消さないための仕組みです。</li>',
  '<li>文字の装飾や表・画像は、本文の上に出るツールバーから入れられます。画像は貼り付け（Ctrl+V）やドラッグでも入ります。</li>',
  '<li>記事の追加・削除・並べ替えは、ツリーの「…」メニューやドラッグで行えます。</li></ul>',
  '<h2>保存する（いちばん大事）</h2>',
  '<p>このファイルは、記事を<strong>自分自身の中に</strong>しまっています。「保存」を押すと、新しい記事を詰め込んだ<strong>このファイルの新しい版がまるごとダウンロード</strong>されます。それで元のファイルを上書きして、はじめて保存が終わります。</p>',
  '<ol><li>右上の <strong>「保存」</strong>（または Ctrl+S）を押します。</li>',
  '<li>保存の画面が開いたら、<strong>いま開いているこのファイル</strong>（同じ場所・同じ名前）を選んで上書きします。</li>',
  '<li>「置き換えますか？」と聞かれたら「はい」を押します。</li></ol>',
  '<ul><li>ダウンロードフォルダなど<strong>別の場所や別の名前で保存すると、別のWikiになってしまいます</strong>。ほかの人には届きません。</li>',
  '<li>保存の画面で「キャンセル」すると、何も保存されません。「未保存」の表示が消えても、もう一度「保存」を押してください。</li>',
  '<li>画面上部に「未保存」と出ている間は、まだ保存されていません。</li></ul>',
  '<blockquote><p>同じファイルを2人が同時に編集すると、後から保存した方で上書きされます。編集は短い時間で区切り、こまめに保存しましょう。</p></blockquote>',
  '<h2>はじめの一歩</h2>',
  '<ul class="checklist"><li data-checked="true">この記事を読む</li><li data-checked="false">「編集」を押して、この記事を書き換えてみる</li><li data-checked="false">保存して、ファイルを上書きする</li></ul>',
  '<p>この記事は不要になったら削除してかまいません。</p>',
].join('');

// data は validateData() で検証・整形ずみのもの
function loadData(data) {
  db = { meta: data.meta };
  IMG = data.images;
  A.clear();
  for (const a of data.articles) A.set(a.id, a);
}

function dataObject() {
  return {
    meta: { name: db.meta.name, version: DATA_VERSION, savedAt: db.meta.savedAt, app: APP_VERSION, trustedHosts: db.meta.trustedHosts || [] },
    articles: Array.from(A.values()).map(cleanArticle),
    images: IMG,
  };
}
function cleanArticle(a) {
  const { id, parentId, order, title, body, createdAt, updatedAt, updatedBy, rev } = a;
  return { id, parentId: parentId ?? null, order: order ?? 0, title, body, createdAt, updatedAt, updatedBy, rev: rev || 0 };
}

function buildHTML(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const i = TEMPLATE.indexOf(DATA_MARK);
  return TEMPLATE.slice(0, i) + json + TEMPLATE.slice(i + DATA_MARK.length);
}

function download(content, name, type = 'text/html') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: type + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function currentFileName() {
  let n = '';
  try { n = decodeURIComponent(location.pathname.split('/').pop() || ''); } catch (e) { n = ''; }
  if (!/\.html?$/i.test(n)) n = safeFileName(db.meta.name) + '.html';
  return n;
}

// ---------- tree helpers ----------
function childrenOf(pid) {
  const out = [];
  for (const a of A.values()) if ((a.parentId ?? null) === pid) out.push(a);
  return out.sort((x, y) => (x.order - y.order) || String(x.createdAt).localeCompare(String(y.createdAt)));
}
function ancestors(id) {
  const out = [];
  let a = A.get(id);
  const seen = new Set();
  while (a && a.parentId && A.has(a.parentId) && !seen.has(a.parentId)) {
    seen.add(a.parentId);
    a = A.get(a.parentId);
    out.unshift(a);
  }
  return out;
}
function descendants(id) {
  const out = [];
  const walk = (pid) => { for (const c of childrenOf(pid)) { out.push(c); walk(c.id); } };
  walk(id);
  return out;
}
function isDescendant(id, maybeAncestor) {
  return ancestors(id).some((a) => a.id === maybeAncestor);
}
function crumbText(id) { return ancestors(id).map((a) => a.title || '無題').join(' › '); }

// ---------- dirty state ----------
function touch(id) {
  if (id) S.touched.add(id);
  // 今回の編集で書き換えた記事（「編集を終える」でリンク候補を探す対象）。リンク付けによる変更は数えない
  if (id && S.edit && !S.linking) S.sessionEdits.add(id);
  setDirty(true);
}
function setDirty(v) {
  S.dirty = v;
  document.body.classList.toggle('dirty', v);
  updateDocTitle();
}
function updateDocTitle() {
  const a = A.get(S.cur);
  document.title = (S.dirty ? '● ' : '') + (a ? (a.title || '無題の記事') + ' — ' : '') + db.meta.name;
}

function referencedImages(articles) {
  const used = new Set();
  const re = /data-img="([0-9a-f]+)"/g;
  for (const a of articles) { let m; while ((m = re.exec(a.body || ''))) used.add(m[1]); }
  return used;
}
function gcImages() {
  const used = referencedImages(A.values());
  for (const k of Object.keys(IMG)) if (!used.has(k)) delete IMG[k];
}

async function save() {
  commitEditor();
  const name = userName() || '名前未設定';
  const t = nowISO();
  for (const id of S.touched) {
    const a = A.get(id);
    if (!a) continue;
    a.updatedAt = t; a.updatedBy = name; a.rev = (a.rev || 0) + 1;
  }
  gcImages();
  db.meta.savedAt = t;
  let payload = dataObject();
  if (CRYPT) {
    try { payload = await encryptPayload(payload); } catch (e) { toast('暗号化できなかったため、保存を中止しました', 'warn', 6000); return; }
  }
  const html = buildHTML(payload);
  download(html, currentFileName());
  S.touched.clear();
  setDirty(false);
  renderMeta();
  toast(`保存ダイアログで「${currentFileName()}」を選んで上書きしてください`, 'ok', 6000);
}
