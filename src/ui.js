// ---------- icons ----------
// Lucide（ISC。一部は Feather 由来で MIT）の形を参考に描き直したもの。ライセンス表示は shell.html 先頭
// と THIRD_PARTY_NOTICES.md を参照。
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-7H7v7M7 3v4h8"/>',
  more: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  chevd: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  stack: '<path d="M15 3H9a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z"/><path d="M15 3v5h5"/><path d="M4 8v11a2 2 0 0 0 2 2h9"/>',
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  bold: '<path d="M7 5h5.5a3.5 3.5 0 0 1 0 7H7zM7 12h6.5a3.5 3.5 0 0 1 0 7H7z" stroke-width="2.3"/>',
  italic: '<path d="M14 5h5M5 19h5M15 5 9 19"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  strike: '<path d="M4 12h16"/><path d="M16.5 7.5C16 5.8 14.3 5 12 5 9.5 5 7.7 6.3 7.7 8.2c0 1.4.9 2.4 2.5 3M7.5 16.3C8 18.1 9.8 19 12.2 19c2.6 0 4.3-1.3 4.3-3.2 0-.9-.3-1.6-.9-2.1"/>',
  color: '<path d="m6.5 16 5.5-12 5.5 12M8.6 11.5h6.8"/>',
  list: '<path d="M10 6h10M10 12h10M10 18h10"/><circle cx="5" cy="6" r="1.1" fill="currentColor"/><circle cx="5" cy="12" r="1.1" fill="currentColor"/><circle cx="5" cy="18" r="1.1" fill="currentColor"/>',
  olist: '<path d="M11 6h9M11 12h9M11 18h9"/><path d="M4.5 4.5h1.3V9M4.3 9h3M4.3 14.6c.4-.8 2.8-1 2.8.6 0 1.2-2.8 1.9-2.8 3.3h3"/>',
  checklist: '<rect x="3.5" y="4" width="6" height="6" rx="1.5"/><path d="m4.8 16.8 1.6 1.6 3-3.2M13 7h8M13 17h8"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  suggest: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l2-2a4.5 4.5 0 0 0-6.4-6.4l-.6.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-2 2a4.5 4.5 0 0 0 6.4 6.4l.6-.6"/><path d="M19 2.5v4M17 4.5h4"/>',
  unlink: '<path d="m18.8 13.7 1-1a4.5 4.5 0 0 0-6.4-6.4l-1 1M5.2 10.3l-1 1a4.5 4.5 0 0 0 6.4 6.4l1-1M8 2v3M2 8h3M16 22v-3M22 16h-3"/>',
  quote: '<path d="M4 11h5v6H4zM4 11c0-3 1.5-5 4-6M14 11h5v6h-5zM14 11c0-3 1.5-5 4-6"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  hr: '<path d="M3 12h18"/><path d="M7 6h10M7 18h10" opacity=".35"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M3 15h18M9 9.5V20M15 9.5V20"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  import: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3"/>',
  export: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.1"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13"/><path d="M11.5 7v6M8.5 10h6"/>',
  child: '<path d="M6 4v7a3 3 0 0 0 3 3h10"/><path d="m15 10 4 4-4 4"/>',
  below: '<path d="M12 5v11M7 12l5 5 5-5M5 20h14"/>',
  db: '<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5v13c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8v-13M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8"/>',
  warn: '<path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17.2v.1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  collapse: '<path d="m7 15 5-5 5 5M7 20l5-5 5 5" transform="rotate(180 12 12)"/>',
  rows: '<path d="M4 9h16M4 15h16M12 3v6M12 15v6"/>',
  eraser: '<path d="m7 21-4-4L14 6l6 6-9 9zM9 9l6 6M7 21h13"/>',
};
function ic(name, cls = '') { return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`; }
const LOGO = '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5268ea"/><stop offset="1" stop-color="#2f45c4"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="8" fill="url(#lg)"/><rect x="9" y="9" width="17" height="17" rx="5" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><rect x="14" y="14" width="10" height="10" rx="3" fill="#fff"/></svg>';

// ---------- toast ----------
function toast(msg, kind = 'info', ms = 3200) {
  let box = $('.toasts');
  if (!box) { box = h('<div class="toasts"></div>'); document.body.appendChild(box); }
  const el = h(`<div class="toast ${kind}">${ic(kind === 'ok' ? 'check' : kind === 'warn' ? 'warn' : 'info')}<span></span></div>`);
  el.querySelector('span').textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, ms);
}

// ---------- floating layers (menu / popover) ----------
let floating = null;
function closeFloating() {
  if (floating) { const f = floating; floating = null; f.el.remove(); f.onClose && f.onClose(); }
}
function placeFloating(el, anchor) {
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
  const w = el.offsetWidth, hh = el.offsetHeight;
  let x = r.left;
  let y = r.bottom + 6;
  if (x + w > innerWidth - 8) x = innerWidth - w - 8;
  if (x < 8) x = 8;
  if (y + hh > innerHeight - 8) y = Math.max(8, r.top - hh - 6);
  el.style.left = x + 'px'; el.style.top = y + 'px';
}
function openFloating(el, anchor, onClose) {
  closeFloating();
  placeFloating(el, anchor);
  floating = { el, onClose };
  return el;
}
document.addEventListener('mousedown', (e) => {
  if (floating && !floating.el.contains(e.target) && !(floating.anchorEl && floating.anchorEl.contains(e.target))) closeFloating();
}, true);

// items: {label, icon, onClick, disabled, danger, hint, check} | '-' | {label, header:true} | {html}
function openMenu(items, anchor, opts = {}) {
  const el = h('<div class="menu" role="menu"></div>');
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { el.appendChild(h('<div class="msep"></div>')); continue; }
    if (it.header) { el.appendChild(h(`<div class="mlabel">${esc(it.label)}</div>`)); continue; }
    if (it.html) { el.appendChild(h(it.html)); continue; }
    const b = h(`<button class="mi ${it.danger ? 'danger' : ''}" role="menuitem">${it.icon ? ic(it.icon) : ''}<span>${esc(it.label)}</span>${it.hint ? `<span class="mhint">${esc(it.hint)}</span>` : ''}${it.check ? `<span class="mcheck">${ic('check', 'sm')}</span>` : ''}</button>`);
    if (it.disabled) b.disabled = true;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => { closeFloating(); it.onClick && it.onClick(); });
    el.appendChild(b);
  }
  openFloating(el, anchor, opts.onClose);
  if (anchor instanceof Element) floating.anchorEl = anchor;
  return el;
}

// ---------- modal ----------
function openModal({ title, icon = 'info', tone = '', body = '', actions = [], wide = false, onOpen, dismissable = true }) {
  closeFloating();
  const bd = h(`<div class="backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><div class="modal-icon ${tone}">${ic(icon)}</div><h2 class="modal-title"></h2></div>
    <div class="modal-body"></div><div class="modal-foot"></div></div></div>`);
  bd.querySelector('.modal-title').textContent = title;
  const bodyEl = bd.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  const foot = bd.querySelector('.modal-foot');
  const close = () => { bd.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable) { e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key === 'Enter' && !e.isComposing && e.target.tagName === 'INPUT') {
      const p = actions.find((a) => a.primary);
      if (p) { e.preventDefault(); run(p); }
    }
  };
  const run = (a) => { if (a.onClick && a.onClick(close, bodyEl) === false) return; close(); };
  for (const a of actions) {
    const b = h(`<button class="btn ${a.primary ? (a.danger ? 'danger' : a.tone || 'primary') : ''}">${a.icon ? ic(a.icon, 'sm') : ''}${esc(a.label)}</button>`);
    b.addEventListener('click', () => run(a));
    a.el = b;
    foot.appendChild(b);
  }
  if (dismissable) bd.addEventListener('mousedown', (e) => { if (e.target === bd) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(bd);
  const f = bodyEl.querySelector('input, textarea');
  if (f) setTimeout(() => { f.focus(); f.select && f.select(); }, 30);
  else { const p = foot.querySelector('.primary, .danger, .edit'); p && p.focus(); }
  onOpen && onOpen(bodyEl, close);
  return { close, body: bodyEl, actions };
}

function confirmModal({ title, message, ok = 'OK', danger = false, icon = 'warn', tone = 'warn' }) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title, icon, tone, body: `<p>${message}</p>`,
      actions: [
        { label: 'キャンセル', onClick: () => { done = true; resolve(false); } },
        { label: ok, primary: true, danger, onClick: () => { done = true; resolve(true); } },
      ],
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.body)) { obs.disconnect(); if (!done) resolve(false); } });
    obs.observe(document.body, { childList: true });
  });
}

function askName(then, { force = false } = {}) {
  if (userName() && !force) { then(); return; }
  openModal({
    title: force ? 'お名前の変更' : 'はじめに、お名前を教えてください', icon: 'user', tone: 'edit',
    body: `<p>記事の「最終更新者」として記録されます。この端末に一度だけ覚えておき、設定から変更できます。</p>
      <div class="form-row"><input class="field" id="nm" maxlength="40" placeholder="例：山田" value="${esc(userName())}"></div>`,
    actions: [
      { label: 'キャンセル' },
      {
        label: 'OK', primary: true, tone: 'edit', onClick: (close, b) => {
          const v = $('#nm', b).value.trim();
          if (!v) { $('#nm', b).focus(); return false; }
          setUserName(v); close(); then(); return false;
        },
      },
    ],
  });
}

// ---------- shell ----------
function buildShell() {
  $('#app').innerHTML = `
  <header class="topbar">
    <div class="brand" title="トップへ">${LOGO}<div class="brand-text"><span class="brand-kicker">QUINE</span><span class="brand-name"></span></div></div>
    <div class="search">
      <label class="search-box">${ic('search', 'sm')}<input id="q" type="text" placeholder="記事を検索" autocomplete="off" spellcheck="false"><kbd>Ctrl F</kbd><button class="search-clear" title="検索をやめる (Esc)">${ic('x', 'sm')}</button></label>
      <div class="search-pop"></div>
    </div>
    <div class="spacer"></div>
    <span class="edit-chip">${ic('pencil', 'sm')}編集モード</span>
    <span class="unsaved" title="保存ボタンでファイルに書き出すまで、変更は残りません"><i></i>未保存</span>
    <button class="btn primary save-btn" title="保存 (Ctrl+S)">${ic('save', 'sm')}保存</button>
    <button class="icon-btn" id="mainMenu" title="メニュー">${ic('menu')}</button>
  </header>
  <div class="layout">
    <aside class="sidebar">
      <div class="side-head"><span class="side-title">記事</span><button class="icon-btn" id="collapseAll" title="すべて折りたたむ">${ic('collapse', 'sm')}</button></div>
      <nav class="tree" aria-label="記事ツリー"></nav>
      <div class="side-foot"><button class="new-article">${ic('plus', 'sm')}新しい記事</button></div>
      <div class="resizer" title="ドラッグで幅を変更"></div>
    </aside>
    <main class="content">
      <div class="doc">
        <div class="hitbar"><span class="hb-text"></span><button class="icon-btn" data-hb="prev" title="前へ (Shift+Enter)">${ic('up', 'sm')}</button><button class="icon-btn" data-hb="next" title="次へ (Enter)">${ic('down', 'sm')}</button><button class="icon-btn" data-hb="close" title="ハイライトを消す">${ic('x', 'sm')}</button></div>
        <nav class="crumbs"></nav>
        <div class="doc-head">
          <h1 class="title" spellcheck="false"></h1>
          <div class="doc-actions">
            <button class="btn edit-btn"></button>
            <button class="icon-btn" id="docMenu" title="記事のメニュー">${ic('more')}</button>
          </div>
        </div>
        <div class="meta"></div>
        <div class="toolbar"></div>
        <article class="prose body" spellcheck="false"></article>
      </div>
    </main>
  </div>
  <div class="dropzone"><div>${ic('import')}JSONファイルをドロップしてインポート</div></div>`;
  const w = store.get('sideW');
  if (w) document.documentElement.style.setProperty('--side-w', w + 'px');
}
