// ---------- security ----------
// ・データの検証（埋め込みデータ／インポート）：形のおかしいデータは開かない・取り込まない
// ・パスワードによる暗号化（AES-GCM、鍵は PBKDF2-SHA256 でパスワードから作る）
// ・外部リンク／ファイルリンクを開く前の確認
// ・アプリの指紋（記事データを除くプログラム部分の SHA-256）

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_RE = /^[0-9a-f]{26}$/;
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$/;
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_ARTICLES = 20000;
const MAX_IMPORT_BYTES = 200 * 1024 * 1024;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isoOr = (v) => (typeof v === 'string' && v.length <= 40 && !isNaN(Date.parse(v)) ? v : null);

// ---------- validation ----------
function checkArticles(list, errors, warnings) {
  if (!Array.isArray(list)) { errors.push('記事の一覧が見つかりません'); return []; }
  if (list.length > MAX_ARTICLES) { errors.push(`記事の数が多すぎます（${list.length}件）`); return []; }
  const ids = new Set(), out = [];
  list.forEach((a, i) => {
    const where = `${i + 1}件目の記事`;
    if (!isObj(a)) { errors.push(`${where}の形が正しくありません`); return; }
    if (typeof a.id !== 'string' || !UUID_RE.test(a.id)) { errors.push(`${where}のIDが正しくありません`); return; }
    if (ids.has(a.id)) { errors.push(`${where}のIDが、ほかの記事と重複しています`); return; }
    ids.add(a.id);
    if (a.title != null && (typeof a.title !== 'string' || a.title.length > 500)) errors.push(`${where}のタイトルが正しくありません`);
    if (a.body != null && typeof a.body !== 'string') errors.push(`${where}の本文が正しくありません`);
    if (a.parentId != null && (typeof a.parentId !== 'string' || !UUID_RE.test(a.parentId))) errors.push(`${where}の親記事の指定が正しくありません`);
    out.push({
      id: a.id.toLowerCase(), parentId: a.parentId ? String(a.parentId).toLowerCase() : null,
      order: Number.isFinite(a.order) ? a.order : i,
      title: typeof a.title === 'string' ? a.title : '', body: typeof a.body === 'string' ? a.body : '',
      createdAt: isoOr(a.createdAt), updatedAt: isoOr(a.updatedAt),
      updatedBy: typeof a.updatedBy === 'string' ? a.updatedBy.slice(0, 100) : '',
      rev: Number.isInteger(a.rev) && a.rev >= 0 ? a.rev : 0,
    });
  });
  return out;
}
// 親が見つからない・親子が輪になっている記事は、いちばん上の階層へ移す
function repairTree(arts, known, warnings) {
  const byId = new Map(arts.map((a) => [a.id, a]));
  let lost = 0, loops = 0;
  for (const a of arts) if (a.parentId && !byId.has(a.parentId) && !(known && known.has(a.parentId))) { a.parentId = null; lost++; }
  for (const a of arts) {
    const seen = new Set([a.id]);
    let p = a.parentId ? byId.get(a.parentId) : null;
    while (p) {
      if (seen.has(p.id)) { a.parentId = null; loops++; break; }
      seen.add(p.id);
      p = p.parentId ? byId.get(p.parentId) : null;
    }
  }
  if (lost) warnings.push(`親記事が見つからない記事が${lost}件あったため、いちばん上の階層に移しました`);
  if (loops) warnings.push(`親子関係が輪になっていた記事が${loops}件あったため、いちばん上の階層に移しました`);
}
function checkImages(obj, errors, warnings) {
  const out = Object.create(null);
  if (obj == null) return out;
  if (!isObj(obj)) { errors.push('画像の一覧の形が正しくありません'); return out; }
  let bad = 0;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (!HASH_RE.test(k) || !isObj(v) || !IMAGE_MIMES.includes(v.mime) || typeof v.data !== 'string' || v.data.length > 40e6 || !B64_RE.test(v.data)) { bad++; continue; }
    out[k] = { mime: v.mime, data: v.data, w: Number(v.w) || 0, h: Number(v.h) || 0 };
  }
  if (bad) warnings.push(`形の正しくない画像が${bad}件あったため、読み込みませんでした`);
  return out;
}

function validateData(raw) {
  const errors = [], warnings = [];
  if (!isObj(raw)) return { ok: false, errors: ['Wikiのデータの形が正しくありません'], warnings };
  if (!isObj(raw.meta)) errors.push('Wikiの基本情報（meta）が見つかりません');
  const m = isObj(raw.meta) ? raw.meta : {};
  if (m.version != null && !(Number.isInteger(m.version) && m.version >= 1)) errors.push('データ形式の版（version）が正しくありません');
  const articles = checkArticles(raw.articles, errors, warnings);
  const images = checkImages(raw.images, errors, warnings);
  if (!errors.length) repairTree(articles, null, warnings);
  const hosts = Array.isArray(m.trustedHosts) ? m.trustedHosts.filter((h) => typeof h === 'string' && HOST_RE.test(h)).map((h) => h.toLowerCase()) : [];
  return {
    ok: !errors.length, errors, warnings,
    data: {
      meta: { name: typeof m.name === 'string' && m.name.trim() ? m.name.slice(0, 200) : '新しいWiki', version: m.version || 1, savedAt: isoOr(m.savedAt), trustedHosts: hosts },
      articles, images,
    },
  };
}

function validateImport(d) {
  const errors = [], warnings = [];
  if (!isObj(d) || d.format !== 'quine-articles') return { ok: false, errors: ['QUINEでエクスポートした記事ファイルではありません'], warnings };
  if (d.version != null && !(Number.isInteger(d.version) && d.version >= 1)) errors.push('ファイルの版（version）が正しくありません');
  const articles = checkArticles(d.articles, errors, warnings);
  if (!errors.length && !articles.length) errors.push('記事が1件も入っていません');
  const images = checkImages(d.images, errors, warnings);
  if (!errors.length) repairTree(articles, new Set(A.keys()), warnings);
  return { ok: !errors.length, errors, warnings, articles, images };
}

// 埋め込みデータを読む。空なら empty、JSON として読めなければ error
function readEmbedded() {
  const text = ($('#wiki-data').textContent || '').trim();
  if (!text || text === '{}') return { empty: true };
  try { return { value: JSON.parse(text) }; } catch (e) { return { error: 'データ部分を読み取れません（JSON の形が壊れています）' }; }
}

// ---------- encryption ----------
const KDF_ITER = 600000;
let CRYPT = null; // { key, salt, iter } — パスワード保護中だけ
const b64 = (buf) => {
  const u = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
function cryptoReady() { return !!(window.crypto && crypto.subtle); }
function isEnvelope(v) { return isObj(v) && isObj(v.quineEncrypted); }
function envelopeOk(e) {
  return e.v === 1 && e.kdf === 'PBKDF2-SHA256' && Number.isInteger(e.iter) && e.iter >= 100000 && e.iter <= 10000000 &&
    [e.salt, e.iv, e.ct].every((s) => typeof s === 'string' && s.length > 0 && B64_RE.test(s));
}
async function deriveKey(password, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
async function encryptPayload(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, CRYPT.key, new TextEncoder().encode(JSON.stringify(obj)));
  return { quineEncrypted: { v: 1, kdf: 'PBKDF2-SHA256', iter: CRYPT.iter, salt: b64(CRYPT.salt), iv: b64(iv), ct: b64(ct) }, name: db.meta.name };
}
async function decryptEnvelope(e, key) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, key, unb64(e.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
// 「編集」で再読み込みするときだけ、同じタブの中で鍵を一時的に引き継ぐ（パスワードを再入力させないため）
const KEY_STASH = 'quine-key';
async function stashKeyForReload() {
  if (!CRYPT) return;
  try { sessionStorage.setItem(KEY_STASH, JSON.stringify({ k: b64(await crypto.subtle.exportKey('raw', CRYPT.key)), t: Date.now() })); } catch (e) { /* 入れ直してもらう */ }
}
async function takeStashedKey() {
  let s = null;
  try { s = sessionStorage.getItem(KEY_STASH); sessionStorage.removeItem(KEY_STASH); } catch (e) { return null; }
  try {
    const v = JSON.parse(s);
    if (!v || Date.now() - v.t > 60000) return null;
    return await crypto.subtle.importKey('raw', unb64(v.k), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  } catch (e) { return null; }
}

function gateHTML(inner, cls = '') {
  return `<div class="gate ${cls}"><div class="gate-card">${LOGO}${inner}</div></div>`;
}
// パスワードを聞いて復号する。成功したらデータを返す
async function unlockData(env) {
  const e = env.quineEncrypted;
  if (!envelopeOk(e)) throw new Error('暗号化されたデータの形が正しくありません');
  if (!cryptoReady()) throw new Error('このブラウザでは暗号化の機能が使えないため、開けません（Microsoft Edge で開いてください）');
  const salt = unb64(e.salt);
  const stashed = await takeStashedKey();
  if (stashed) {
    try { const data = await decryptEnvelope(e, stashed); CRYPT = { key: stashed, salt, iter: e.iter }; return data; } catch (er) { /* パスワードを聞く */ }
  }
  const name = typeof env.name === 'string' ? env.name.slice(0, 200) : '';
  document.title = '🔒 ' + (name || 'QUINE');
  return new Promise((resolve) => {
    $('#app').innerHTML = gateHTML(`<h1>パスワードで保護されたWikiです</h1><div class="gate-sub"></div>
      <form><input class="field" type="password" autocomplete="current-password" placeholder="パスワード"><button class="btn primary" type="submit">開く</button><div class="gate-err" role="alert"></div></form>
      <div class="gate-note">パスワードを忘れた場合、記事を開く方法はありません。</div>`);
    $('.gate-sub').textContent = name;
    const form = $('.gate form'), inp = $('.gate input'), err = $('.gate-err'), btn = $('.gate button');
    setTimeout(() => inp.focus(), 30);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!inp.value) { inp.focus(); return; }
      btn.disabled = true; err.textContent = ''; btn.textContent = '確認しています…';
      try {
        const key = await deriveKey(inp.value, salt, e.iter);
        const data = await decryptEnvelope(e, key);
        CRYPT = { key, salt, iter: e.iter };
        $('#app').innerHTML = '';
        resolve(data);
      } catch (er) {
        err.textContent = 'パスワードが違います（またはファイルが壊れています）';
        btn.disabled = false; btn.textContent = '開く';
        inp.select();
      }
    });
  });
}

// データが壊れているときの画面。編集画面は出さない（上書き保存で傷を広げないため）
function showBroken(errors) {
  document.title = '開けませんでした — QUINE';
  $('#app').innerHTML = gateHTML(`<h1>このWikiファイルを開けませんでした</h1>
    <p class="gate-text">ファイルの中のデータが壊れているか、正しくないデータが入っています。</p>
    <ul class="gate-list"></ul>
    <div class="gate-note"><b>このファイルに上書き保存はしないでください。</b><br>ファイルサーバの「以前のバージョン」やバックアップから、壊れる前のファイルに戻してください。</div>`, 'broken');
  const ul = $('.gate-list');
  for (const m of errors.slice(0, 30)) { const li = document.createElement('li'); li.textContent = m; ul.appendChild(li); }
  if (errors.length > 30) { const li = document.createElement('li'); li.textContent = `ほか${errors.length - 30}件`; ul.appendChild(li); }
}

// ---------- password settings ----------
function passwordDialog() {
  if (!S.edit) { toast('パスワードの設定は編集モードで行えます', 'warn'); return; }
  if (!cryptoReady()) { toast('このブラウザでは暗号化の機能が使えません', 'warn'); return; }
  const changing = !!CRYPT;
  openModal({
    title: changing ? 'パスワードを変更する' : 'パスワードで保護する', icon: 'lock', tone: 'warn',
    body: `<p>保護すると、保存したファイルの中身（記事・画像）が暗号化され、開くときにパスワードが必要になります。</p>
      <div class="pw-warn"><b>パスワードを忘れると、だれも記事を開けなくなります。</b><br>作った人にも管理者にも、取り戻す方法はありません。パスワードは安全な場所に控えてください。</div>
      <div class="form-row"><label for="pw1">新しいパスワード（8文字以上）</label><input class="field" id="pw1" type="password" autocomplete="new-password"></div>
      <div class="form-row"><label for="pw2">もう一度</label><input class="field" id="pw2" type="password" autocomplete="new-password"></div>
      <label class="pw-check"><input type="checkbox" id="pwok"> パスワードを忘れると開けなくなることを理解しました</label>
      <div class="form-err" role="alert"></div>`,
    actions: [
      { label: 'キャンセル' },
      {
        label: changing ? '変更する' : '保護する', primary: true, onClick: (close, b) => {
          const p1 = $('#pw1', b).value, p2 = $('#pw2', b).value, err = $('.form-err', b);
          if (p1.length < 8) { err.textContent = 'パスワードは8文字以上にしてください'; return false; }
          if (p1 !== p2) { err.textContent = '2つのパスワードが一致しません'; return false; }
          if (!$('#pwok', b).checked) { err.textContent = '注意事項を確認して、チェックを入れてください'; return false; }
          err.textContent = '設定しています…';
          const salt = crypto.getRandomValues(new Uint8Array(16));
          deriveKey(p1, salt, KDF_ITER).then((key) => {
            CRYPT = { key, salt, iter: KDF_ITER };
            setDirty(true);
            close();
            toast('パスワードを設定しました。保存すると、保護されたファイルになります', 'ok', 6000);
          }, () => { err.textContent = '設定できませんでした'; });
          return false;
        },
      },
    ],
  });
}
function removeProtection() {
  if (!S.edit || !CRYPT) return;
  confirmModal({
    title: 'パスワードの保護を外しますか？',
    message: '保存すると、ファイルの中身が暗号化されずに保存されます。ファイルを開ける人は、だれでも記事を読めるようになります。',
    ok: '保護を外す', danger: true, icon: 'lock',
  }).then((ok) => {
    if (!ok) return;
    CRYPT = null;
    setDirty(true);
    toast('保護を外しました。保存すると反映されます', 'ok');
  });
}

// ---------- links ----------
function trustedHosts() { return (db.meta.trustedHosts || []).map((h) => h.toLowerCase()); }
function linkRisk(href) {
  let u;
  try { u = new URL(href); } catch (e) { return { level: 'block', msg: '正しいリンクではありません' }; }
  if (u.protocol === 'https:') return { level: 'ok', kind: 'Webページ' };
  if (u.protocol === 'mailto:') return { level: 'ok', kind: 'メールの宛先' };
  if (u.protocol === 'http:') return { level: 'warn', kind: 'Webページ', msg: '暗号化されていない接続（http）です。送った内容が途中で読まれる可能性があります。' };
  if (u.protocol === 'file:') {
    const host = u.hostname.toLowerCase();
    if (!host) return { level: 'warn', kind: 'このパソコンの中のファイル', msg: 'このパソコンの中のファイルを開きます。見覚えのないファイルは開かないでください。' };
    if (trustedHosts().includes(host)) return { level: 'ok', kind: '社内サーバ「' + host + '」のファイル' };
    return { level: 'danger', kind: 'サーバ「' + host + '」のファイル', msg: `「${host}」は、このWikiの「信頼する社内サーバ」に登録されていません。Windows では、開くだけでこのパソコンのログイン情報（認証情報）が相手のサーバに送られることがあります。心当たりがなければ開かないでください。` };
  }
  return { level: 'block', msg: 'この種類のリンクは開けません' };
}
function openExternalLink(href) {
  const r = linkRisk(href);
  if (r.level === 'block') { toast(r.msg, 'warn'); return; }
  const body = `<p>${esc(r.kind)}を開きます。</p><div class="url-box"></div>${r.msg ? `<div class="risk ${r.level}">${esc(r.msg)}</div>` : ''}`;
  const open = () => { window.open(href, '_blank', 'noopener,noreferrer'); };
  const m = openModal({
    title: 'リンクを開きますか？', icon: r.level === 'ok' ? 'ext' : 'warn', tone: r.level === 'ok' ? '' : 'warn', body,
    actions: r.level === 'ok'
      ? [{ label: 'キャンセル' }, { label: '開く', primary: true, icon: 'ext', onClick: open }]
      : [{ label: '開く', danger: true, onClick: open }, { label: '開かない', primary: true }],
  });
  $('.url-box', m.body).textContent = href;
}

// ---------- fingerprint ----------
// 記事データを除いた「プログラム部分」（<style> と アプリの <script> の中身）の SHA-256。
// 記事を保存しても変わらない。build.js が同じ計算で FINGERPRINT.txt を書き出す。
async function appFingerprint() {
  if (!cryptoReady()) return null;
  const css = (document.querySelector('head > style') || {}).textContent || '';
  const js = ($('#quine-app') || {}).textContent || '';
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(css + '\n' + js)));
}
