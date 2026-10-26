// ---------- article view / editor ----------
let ed, titleEl;
let lastRange = null;
let baseline = '';

function renderAll() { renderTree(); renderArticle(); }

function renderCrumbs() {
  const a = A.get(S.cur);
  const c = $('.crumbs');
  if (!a) { c.innerHTML = ''; return; }
  const parts = ancestors(a.id).map((p) => `<a href="#${p.id}" title="${esc(p.title)}">${esc(p.title || '無題の記事')}</a>${ic('chev', 'xs')}`);
  c.innerHTML = `<a href="#${childrenOf(null)[0]?.id || ''}" title="トップ">${esc(db.meta.name)}</a>${ic('chev', 'xs')}` + parts.join('') + `<span class="here">${esc(a.title || '無題の記事')}</span>`;
}

function renderMeta() {
  const a = A.get(S.cur);
  const m = $('.meta');
  if (!a) { m.innerHTML = ''; return; }
  const who = a.updatedBy || '不明';
  const hue = Array.from(who).reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 360, 7);
  m.innerHTML = `<span class="avatar" style="background:hsl(${hue} 45% 52%)">${esc(Array.from(who)[0] || '?')}</span>` +
    `<span>最終更新：<b>${esc(who)}</b> さん　${esc(fmtDate(a.updatedAt))}</span>` +
    (S.touched.has(a.id) ? '<span class="sep"></span><span class="pending">未保存の変更あり</span>' : '');
}

function renderEditButton() {
  const b = $('.edit-btn');
  if (S.edit) { b.className = 'btn edit edit-btn'; b.innerHTML = ic('check', 'sm') + '編集を終える'; b.title = '閲覧モードに戻る（保存はされません）'; }
  else { b.className = 'btn edit-btn'; b.innerHTML = ic('pencil', 'sm') + '編集'; b.title = 'ファイルの最新版を読み込んで編集を始めます'; }
}

function renderArticle() {
  ed = $('.body'); titleEl = $('.title');
  tableDeactivate();
  hideTableUI();
  hideImgFrame();
  const a = A.get(S.cur);
  const doc = $('.doc');
  doc.classList.toggle('is-empty', !a);
  renderEditButton();
  renderCrumbs();
  renderMeta();
  updateDocTitle();
  $('.brand-name').textContent = db.meta.name;
  if (!a) {
    titleEl.textContent = '';
    titleEl.contentEditable = 'false';
    ed.contentEditable = 'false';
    ed.innerHTML = `<div class="empty-state">${LOGO.replace('class="logo"', 'class="logo-big"')}<h2>${A.size ? '記事を選んでください' : 'まだ記事がありません'}</h2><p>${A.size ? '左のツリーから記事を選ぶと、ここに表示されます。' : '「編集」を押してから「新しい記事」で最初の記事を作りましょう。'}</p></div>`;
    $('.hitbar').classList.remove('on');
    return;
  }
  titleEl.textContent = a.title;
  titleEl.contentEditable = S.edit ? 'plaintext-only' : 'false';
  // 表示する前に必ず無害化する（ファイルに危険なHTMLが紛れ込んでいても動かないように）
  ed.innerHTML = sanitizeHTML(a.body || '') || '<p><br></p>';
  hydrate(ed);
  markBrokenLinks(ed);
  if (S.edit) {
    ed.contentEditable = 'true';
    normalize();
    baseline = serializeBody();
    hReset();
  } else {
    ed.contentEditable = 'false';
    applyHighlights();
  }
}

function markBrokenLinks(root) {
  for (const l of $$('a[href^="#"]', root)) {
    const id = decodeURIComponent(l.getAttribute('href').slice(1));
    l.classList.toggle('broken', !A.has(id));
    if (!A.has(id)) l.title = '削除された記事へのリンク';
    else l.title = A.get(id).title || '';
  }
}

function hydrate(root) {
  for (const img of $$('img[data-img]', root)) img.src = imgURL(img.dataset.img);
}

function serializeBody(root = ed) {
  const c = root.cloneNode(true);
  $$('.qt-ui', c).forEach((n) => n.remove());
  $$('mark.qhit', c).forEach(unwrap);
  $$('img', c).forEach((i) => { i.removeAttribute('src'); i.classList.remove('img-on'); });
  $$('.qtable', c).forEach((w) => { w.removeAttribute('contenteditable'); w.classList.remove('qready'); });
  $$('.qtable td', c).forEach((td) => { td.removeAttribute('contenteditable'); td.classList.remove('qsel', 'qact', 'qedit'); });
  $$('a', c).forEach((a) => { a.classList.remove('broken'); if (a.getAttribute('href')?.startsWith('#')) a.removeAttribute('title'); });
  $$('[class=""]', c).forEach((n) => n.removeAttribute('class'));
  const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
  const zs = [];
  while (tw.nextNode()) if (tw.currentNode.data.includes('​')) zs.push(tw.currentNode);
  zs.forEach((t) => { t.data = t.data.replace(/​/g, ''); });
  return c.innerHTML;
}

function unwrap(el) { const p = el.parentNode; if (!p) return; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); }

// 編集中の本文の構造を整える（表の前後に必ず段落を置く、など）
function normalize() {
  if (!S.edit || !ed) return;
  const isBlank = (n) => n.nodeType === 3 && !n.data.trim();
  // 直下の裸のテキスト・インライン要素を段落で包む
  const INLINE = /^(#text|A|B|STRONG|I|EM|U|S|STRIKE|SPAN|FONT|CODE|BR|IMG)$/;
  let run = [];
  const flush = () => {
    if (!run.length) return;
    if (run.every(isBlank)) { run.forEach((n) => n.remove()); run = []; return; }
    const p = document.createElement('p');
    run[0].parentNode.insertBefore(p, run[0]);
    run.forEach((n) => p.appendChild(n));
    run = [];
  };
  for (const n of Array.from(ed.childNodes)) {
    if (INLINE.test(n.nodeName)) run.push(n); else flush();
  }
  flush();
  // 入れ子になった表ブロックは最上位へ
  for (const t of $$('.qtable', ed)) {
    if (t.parentNode !== ed) {
      let top = t;
      while (top.parentNode && top.parentNode !== ed) top = top.parentNode;
      ed.insertBefore(t, top.nextSibling);
    }
    t.contentEditable = 'false';
    const prev = t.previousElementSibling, next = t.nextElementSibling;
    if (!prev || prev.tagName !== 'P') t.before(emptyP());
    if (!next || next.tagName !== 'P') t.after(emptyP());
    fixTableWidth(t);
  }
  const last = ed.lastElementChild;
  if (!last || last.tagName !== 'P') ed.appendChild(emptyP());
  for (const p of $$(':scope > p', ed)) if (!p.firstChild) p.appendChild(document.createElement('br'));
}
function emptyP() { const p = document.createElement('p'); p.appendChild(document.createElement('br')); return p; }

function commitEditor() {
  if (!S.edit || !ed || !A.get(S.cur)) return;
  tableCommit();
  const html = serializeBody();
  if (html !== baseline) {
    const a = A.get(S.cur);
    a.body = html;
    baseline = html;
    touch(a.id);
  }
}

// ---------- selection helpers ----------
function selRange() {
  const s = getSelection();
  if (!s.rangeCount) return null;
  const r = s.getRangeAt(0);
  return ed && ed.contains(r.commonAncestorContainer) ? r : null;
}
function setCaret(node, offset) {
  const r = document.createRange();
  r.setStart(node, offset); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function restoreRange() {
  if (!lastRange) return false;
  if (!ed.contains(lastRange.startContainer)) return false;
  const s = getSelection(); s.removeAllRanges(); s.addRange(lastRange);
  return true;
}
function caretOffset() {
  const r = selRange();
  if (!r) return null;
  const pre = document.createRange();
  pre.setStart(ed, 0);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}
function setCaretOffset(off) {
  if (off == null) return;
  const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
  let acc = 0, last = null;
  while (tw.nextNode()) {
    const t = tw.currentNode;
    if (t.parentNode.closest && t.parentNode.closest('.qtable')) { acc += t.data.length; continue; }
    last = t;
    if (acc + t.data.length >= off) { setCaret(t, off - acc); return; }
    acc += t.data.length;
  }
  if (last) setCaret(last, last.data.length);
}
function blockOf(node) {
  let n = node && node.nodeType === 3 ? node.parentNode : node;
  while (n && n !== ed) {
    if (/^(P|H1|H2|H3|LI|PRE|BLOCKQUOTE|DIV)$/.test(n.nodeName) && !n.classList.contains('qtable')) return n;
    n = n.parentNode;
  }
  return null;
}
function topBlock(node) {
  let n = node && node.nodeType === 3 ? node.parentNode : node;
  while (n && n.parentNode !== ed) { if (n === ed) return null; n = n.parentNode; }
  return n;
}
function inTable(node) { const n = node && node.nodeType === 3 ? node.parentNode : node; return n && n.closest ? n.closest('.qtable') : null; }

// ---------- undo history (自前で管理：表や画像、記法変換も1手ずつ戻せるように) ----------
const HIST = { stack: [], i: -1, timer: 0 };
function hReset() { HIST.stack = [{ html: serializeBody(), off: null }]; HIST.i = 0; clearTimeout(HIST.timer); }
function hSnapshot() {
  clearTimeout(HIST.timer);
  if (!S.edit || HIST.i < 0) return;
  const html = serializeBody();
  if (html === HIST.stack[HIST.i].html) { HIST.stack[HIST.i].off = caretOffset(); return; }
  HIST.stack.length = HIST.i + 1;
  HIST.stack.push({ html, off: caretOffset() });
  if (HIST.stack.length > 300) HIST.stack.shift();
  HIST.i = HIST.stack.length - 1;
}
function hSchedule() { clearTimeout(HIST.timer); HIST.timer = setTimeout(() => (S.composing ? hSchedule() : hSnapshot()), 450); }
function hRestore(st) {
  tableDeactivate();
  hideTableUI();
  hideImgFrame();
  ed.innerHTML = st.html;
  hydrate(ed);
  normalize();
  ed.focus();
  setCaretOffset(st.off);
  touch(S.cur);
  updateToolbar();
}
function undo() { tableCommit(); hSnapshot(); if (HIST.i <= 0) return; HIST.i--; hRestore(HIST.stack[HIST.i]); }
function redo() { tableCommit(); hSnapshot(); if (HIST.i >= HIST.stack.length - 1) return; HIST.i++; hRestore(HIST.stack[HIST.i]); }
// 1つの操作を履歴の1手にまとめる
function edit(fn) {
  hSnapshot();
  fn();
  cleanupStyles();
  normalize();
  touch(S.cur);
  hSnapshot();
  updateToolbar();
}
function exec(cmd, val) {
  if (!selRange()) { ed.focus(); restoreRange(); }
  edit(() => document.execCommand(cmd, false, val));
}

// execCommand が付ける余計な装飾を、ツールバーで表現できるものだけに戻す
function cleanupStyles() {
  for (const f of $$('font', ed)) {
    const c = f.getAttribute('color');
    const sp = document.createElement('span');
    if (c) sp.style.color = c;
    f.replaceWith(sp);
    while (f.firstChild) sp.appendChild(f.firstChild);
  }
  for (const el of $$('[style]', ed)) {
    const tag = el.tagName;
    if (tag === 'IMG' || tag === 'COL' || tag === 'TABLE') continue;
    if (tag === 'SPAN') {
      const c = el.style.color;
      el.removeAttribute('style');
      if (c && c !== 'rgb(1, 2, 3)' && keepColor(c)) el.style.color = c;
      else if (!el.attributes.length) unwrap(el);
      continue;
    }
    el.removeAttribute('style');
  }
  for (const sp of $$('span:not([style]):not([class])', ed)) if (!sp.attributes.length) unwrap(sp);
}

// ---------- toolbar ----------
const TB_ITEMS = [
  ['undo', '元に戻す (Ctrl+Z)'], ['redo', 'やり直す (Ctrl+Y)'], '|',
  ['style', '段落の種類'], '|',
  ['bold', '太字 (Ctrl+B)'], ['italic', '斜体 (Ctrl+I)'], ['underline', '下線 (Ctrl+U)'], ['strike', '取り消し線'], ['color', '文字色'], '|',
  ['list', '箇条書き'], ['olist', '番号付きリスト'], ['checklist', 'チェックリスト'], '|',
  ['link', 'リンク (Ctrl+K)'], ['suggest', 'リンク候補を探す（ほかの記事のタイトル・見出しと同じ言葉）'], ['quote', '引用'], ['code', 'コードブロック'], ['hr', '区切り線'], '|',
  ['table', '表を挿入'], ['image', '画像を挿入'],
];
const BLOCK_TOOLS = ['style', 'italic', 'underline', 'strike', 'list', 'olist', 'checklist', 'quote', 'code', 'hr', 'table', 'image'];
const COLORS = [['#d1342b', '赤'], ['#d9730d', 'オレンジ'], ['#b38600', '黄土'], ['#2f8a57', '緑'], ['#2a7f8f', '青緑'], ['#2f62d6', '青'], ['#7c4dcc', '紫'], ['#c4407a', 'ピンク'], ['#8a8f98', 'グレー']];

function buildToolbar() {
  const tb = $('.toolbar');
  tb.innerHTML = TB_ITEMS.map((it) => {
    if (it === '|') return '<span class="tsep"></span>';
    const [k, t] = it;
    if (k === 'style') return `<button class="tb style" data-tb="style" title="${t}"><span class="lbl">本文</span>${ic('chevd', 'caret')}</button>`;
    if (k === 'color') return `<button class="tb color" data-tb="color" title="${t}">${ic('color')}<span class="swatch"></span></button>`;
    return `<button class="tb" data-tb="${k}" title="${t}">${ic(k)}</button>`;
  }).join('');
  tb.addEventListener('mousedown', (e) => { if (e.target.closest('.tb')) e.preventDefault(); });
  tb.addEventListener('click', (e) => {
    const b = e.target.closest('.tb');
    if (b) tbAction(b.dataset.tb, b);
  });
}

function tbAction(k, btn) {
  if (!S.edit) return;
  const tActive = tableReadyActive();
  switch (k) {
    case 'undo': return undo();
    case 'redo': return redo();
    case 'bold': return tActive ? tableFormat('bold') : exec('bold');
    case 'italic': return exec('italic');
    case 'underline': return exec('underline');
    case 'strike': return exec('strikeThrough');
    case 'color': return openColorPop(btn);
    case 'style': return openMenu([
      { label: '本文', onClick: () => setBlock('p') },
      { label: '見出し 1', hint: '# ', onClick: () => setBlock('h1') },
      { label: '見出し 2', hint: '## ', onClick: () => setBlock('h2') },
      { label: '見出し 3', hint: '### ', onClick: () => setBlock('h3') },
      { html: '<div class="mfoot" style="font-size:11.5px">行頭で <b>#</b> <b>-</b> <b>1.</b> <b>[ ]</b> <b>&gt;</b> と入力しても書式になります</div>' },
    ], btn);
    case 'list': return toggleList('ul');
    case 'olist': return toggleList('ol');
    case 'checklist': return toggleList('check');
    case 'link': return openLinkPop(btn);
    case 'suggest': return showLinkSuggestions([S.cur], { emptyToast: true });
    case 'quote': return toggleQuote();
    case 'code': return toggleCode();
    case 'hr': return exec('insertHorizontalRule');
    case 'table': return openTablePicker(btn);
    case 'image': return pickImages();
  }
}

function setBlock(tag) {
  ed.focus(); restoreRange();
  const r = selRange();
  const pre = r && r.startContainer && (r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer).closest('pre');
  if (pre) { edit(() => preToParagraphs(pre)); }
  exec('formatBlock', '<' + tag + '>');
}

function toggleList(kind) {
  ed.focus(); if (!selRange()) restoreRange();
  const r = selRange(); if (!r) return;
  const n = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer;
  const list = n.closest('ul,ol');
  edit(() => {
    if (kind === 'check') {
      if (list && list.tagName === 'UL') {
        if (list.classList.contains('checklist')) document.execCommand('insertUnorderedList');
        else { list.classList.add('checklist'); $$(':scope > li', list).forEach((li) => li.dataset.checked = 'false'); }
        return;
      }
      if (list) document.execCommand('insertOrderedList');
      document.execCommand('insertUnorderedList');
      const s = selRange();
      const ul = s && (s.startContainer.nodeType === 3 ? s.startContainer.parentNode : s.startContainer).closest('ul');
      if (ul) { ul.classList.add('checklist'); $$(':scope > li', ul).forEach((li) => { if (!li.dataset.checked) li.dataset.checked = 'false'; }); }
      return;
    }
    if (kind === 'ul' && list && list.classList.contains('checklist')) {
      list.classList.remove('checklist');
      $$(':scope > li', list).forEach((li) => li.removeAttribute('data-checked'));
      return;
    }
    document.execCommand(kind === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
  });
}

function toggleQuote() {
  ed.focus(); if (!selRange()) restoreRange();
  const r = selRange(); if (!r) return;
  const n = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer;
  const bq = n.closest('blockquote');
  if (bq && ed.contains(bq)) {
    const off = caretOffset();
    edit(() => {
      for (const c of Array.from(bq.childNodes)) {
        if (c.nodeType === 3 || !/^(P|H1|H2|H3|UL|OL|PRE)$/.test(c.nodeName)) {
          const p = document.createElement('p'); bq.insertBefore(p, c); p.appendChild(c);
        }
      }
      unwrap(bq);
      setCaretOffset(off);
    });
  } else exec('formatBlock', '<blockquote>');
}

function preToParagraphs(pre) {
  const lines = pre.innerText.replace(/\n$/, '').split('\n');
  const frag = document.createDocumentFragment();
  for (const l of lines) { const p = document.createElement('p'); p.textContent = l; if (!l) p.appendChild(document.createElement('br')); frag.appendChild(p); }
  const first = frag.firstChild;
  pre.replaceWith(frag);
  return first;
}
function toggleCode() {
  ed.focus(); if (!selRange()) restoreRange();
  const r = selRange(); if (!r) return;
  const n = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer;
  const pre = n.closest('pre');
  if (pre && ed.contains(pre)) {
    edit(() => { const p = preToParagraphs(pre); setCaret(p, 0); });
  } else exec('formatBlock', '<pre>');
}

function updateToolbar() {
  if (!S.edit) return;
  const tb = $('.toolbar');
  const r = selRange();
  const node = r && (r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer);
  const inT = !!(node && node.closest('.qtable')) || tableReadyActive();
  for (const k of BLOCK_TOOLS) { const b = tb.querySelector(`[data-tb="${k}"]`); if (b) b.disabled = inT; }
  const q = (c) => { try { return document.queryCommandState(c); } catch (e) { return false; } };
  const set = (k, on) => { const b = tb.querySelector(`[data-tb="${k}"]`); b && b.classList.toggle('on', !!on); };
  if (!node) return;
  set('bold', tableReadyActive() ? tableCellsAre('bold') : q('bold'));
  set('italic', q('italic')); set('underline', q('underline')); set('strike', q('strikeThrough'));
  const list = node.closest('ul,ol');
  set('list', list && list.tagName === 'UL' && !list.classList.contains('checklist'));
  set('olist', list && list.tagName === 'OL');
  set('checklist', list && list.classList.contains('checklist'));
  set('quote', node.closest('blockquote'));
  set('code', node.closest('pre'));
  set('link', node.closest('a'));
  const hx = node.closest('h1,h2,h3');
  tb.querySelector('.style .lbl').textContent = hx ? '見出し ' + hx.tagName[1] : node.closest('pre') ? 'コード' : '本文';
  const color = node.closest('span[style*="color"]');
  tb.querySelector('.swatch').style.background = color ? color.style.color : '';
}

// ---------- color ----------
function openColorPop(btn) {
  const el = h(`<div class="pop"><div class="pop-label">文字色</div><div class="colors"><button class="auto" title="自動（標準の色）" data-c=""></button>${COLORS.map(([c, n]) => `<button style="background:${c}" title="${n}" data-c="${c}"></button>`).join('')}</div></div>`);
  el.addEventListener('mousedown', (e) => e.preventDefault());
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-c]');
    if (!b) return;
    closeFloating();
    applyColor(b.dataset.c);
  });
  openFloating(el, btn);
}
function applyColor(c) {
  if (tableReadyActive()) { tableColor(c); return; }
  ed.focus(); if (!selRange()) restoreRange();
  edit(() => {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('foreColor', false, c || 'rgb(1, 2, 3)');
    document.execCommand('styleWithCSS', false, false);
  });
}
const colorProbe = {};
function keepColor(c) {
  if (colorProbe[c] != null) return colorProbe[c];
  const p = document.createElement('span');
  p.style.color = c; document.body.appendChild(p);
  const m = getComputedStyle(p).color.match(/\d+(\.\d+)?/g); p.remove();
  if (!m) return (colorProbe[c] = false);
  const [r, g, b] = m.map(Number);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  // ほぼ黒・ほぼ白（Wordや他サイトの既定色）は持ち込まない
  const keep = !((mx < 95 && mx - mn < 32) || (mn > 205 && mx - mn < 32));
  return (colorProbe[c] = keep);
}

// ---------- link ----------
function openLinkPop(btn) {
  if (!S.edit) return;
  if (!selRange()) { ed.focus(); restoreRange(); }
  const range = selRange() ? selRange().cloneRange() : null;
  if (!range) return;
  const node = range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;
  const existing = node.closest('a');
  const curHref = existing ? existing.getAttribute('href') : '';
  let tab = curHref.startsWith('#') ? 'wiki' : 'url';
  const el = h(`<div class="pop linkpop"><div class="seg"><button data-tab="url">URL・ファイル</button><button data-tab="wiki">Wiki内の記事</button></div><div class="lp-body"></div>
    <div class="pop-actions">${existing ? `<button class="btn ghost lp-unlink">${ic('unlink', 'sm')}リンクを解除</button>` : ''}<span class="spacer"></span></div></div>`);
  const body = el.querySelector('.lp-body');
  const apply = (href, label) => {
    closeFloating();
    ed.focus();
    const s = getSelection(); s.removeAllRanges(); s.addRange(range);
    edit(() => {
      if (existing) { existing.setAttribute('href', href); return; }
      if (range.collapsed) document.execCommand('insertHTML', false, `<a href="${esc(href)}">${esc(label || href)}</a>&#8203;`);
      else document.execCommand('createLink', false, href);
    });
  };
  const render = () => {
    $$('.seg button', el).forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'url') {
      body.innerHTML = `<input class="field" placeholder="https://…  または  \\\\server\\share\\…" value="${esc(curHref.startsWith('#') ? '' : curHref)}"><div class="pop-actions"><button class="btn primary">適用</button></div>`;
      const inp = body.querySelector('input');
      const go2 = () => {
        let v = inp.value.trim(); if (!v) return;
        if (/^\\\\/.test(v)) v = 'file:' + v.replace(/\\/g, '/');
        else if (/^[a-z]:\\/i.test(v)) v = 'file:///' + v.replace(/\\/g, '/');
        else if (!/^(https?:|mailto:|file:|#)/i.test(v)) v = 'https://' + v;
        apply(v, inp.value.trim());
      };
      body.querySelector('.btn').addEventListener('click', go2);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); go2(); } if (e.key === 'Escape') closeFloating(); });
      setTimeout(() => inp.focus(), 10);
    } else {
      body.innerHTML = `<input class="field" placeholder="記事のタイトルで絞り込み"><div class="link-list"></div>`;
      const inp = body.querySelector('input'), list = body.querySelector('.link-list');
      const fill = () => {
        const q = norm(inp.value.trim());
        const items = Array.from(A.values()).filter((a) => a.id !== S.cur && (!q || norm(a.title).includes(q))).slice(0, 60);
        list.innerHTML = items.map((a) => `<button class="mi" data-id="${a.id}">${ic('doc', 'sm')}<span>${esc(a.title || '無題の記事')}</span><small>${esc(crumbText(a.id))}</small></button>`).join('') || '<div class="sr-empty">見つかりません</div>';
      };
      list.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) apply('#' + b.dataset.id, A.get(b.dataset.id).title); });
      inp.addEventListener('input', fill);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const f = list.querySelector('[data-id]'); f && f.click(); }
        if (e.key === 'Escape') closeFloating();
      });
      fill();
      setTimeout(() => inp.focus(), 10);
    }
  };
  el.querySelector('.seg').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); } });
  const un = el.querySelector('.lp-unlink');
  if (un) un.addEventListener('click', () => { closeFloating(); edit(() => unwrap(existing)); });
  render();
  openFloating(el, btn || { x: range.getBoundingClientRect().left, y: range.getBoundingClientRect().bottom });
}

// ---------- markdown shortcuts ----------
function mdBlockShortcut() {
  const r = selRange();
  if (!r || !r.collapsed) return false;
  const blk = blockOf(r.startContainer);
  if (!blk || !/^(P|DIV)$/.test(blk.nodeName) || inTable(blk) || blk.closest('pre,li')) return false;
  const pre = document.createRange();
  pre.setStart(blk, 0); pre.setEnd(r.startContainer, r.startOffset);
  const txt = pre.toString().replace(/ /g, ' ').normalize('NFKC').replace(/^[ー－]/, '-');
  const m = txt.match(/^(#{1,3}|[-*・]|1[.)]|\[ ?\]|>) $/);
  if (!m) return false;
  const k = m[1];
  hSnapshot(); // 変換前（「# 」が入った状態）を1手として残す → Ctrl+Z で文字に戻る
  pre.deleteContents();
  // execCommand だと段落の中に入れ子のリストができることがあるため、DOMを直接組み替える
  let outer, inner;
  if (k[0] === '#') outer = inner = document.createElement('h' + k.length);
  else if (k === '>') { outer = document.createElement('blockquote'); inner = outer.appendChild(document.createElement('p')); }
  else {
    outer = document.createElement(k.startsWith('1') ? 'ol' : 'ul');
    inner = outer.appendChild(document.createElement('li'));
    if (k.startsWith('[')) { outer.className = 'checklist'; inner.dataset.checked = 'false'; }
  }
  while (blk.firstChild) inner.appendChild(blk.firstChild);
  if (!inner.textContent && !inner.querySelector('br,img')) inner.appendChild(document.createElement('br'));
  blk.replaceWith(outer);
  setCaret(inner, 0);
  normalize(); touch(S.cur); hSnapshot(); updateToolbar();
  return true;
}
function mdEnterShortcut() {
  const r = selRange();
  if (!r || !r.collapsed) return false;
  const blk = blockOf(r.startContainer);
  if (!blk || !/^(P|DIV)$/.test(blk.nodeName) || inTable(blk) || blk.closest('pre,li')) return false;
  const t = blk.textContent.normalize('NFKC').trim();
  if (t !== '---' && t !== '```' && t !== '***') return false;
  hSnapshot();
  if (t === '```') {
    const p = document.createElement('pre'); p.appendChild(document.createElement('br'));
    blk.replaceWith(p); setCaret(p, 0);
  } else {
    const hr = document.createElement('hr'); const p = emptyP();
    blk.replaceWith(hr); hr.after(p); setCaret(p, 0);
  }
  normalize(); touch(S.cur); hSnapshot(); updateToolbar();
  return true;
}
function mdInlineShortcut(ch) {
  const r = selRange();
  if (!r || !r.collapsed || r.startContainer.nodeType !== 3 || inTable(r.startContainer)) return false;
  const tn = r.startContainer, off = r.startOffset;
  if (tn.parentNode.closest('pre,code')) return false;
  const before = tn.data.slice(0, off);
  const m = ch === '*' ? before.match(/\*\*([^*\s][^*]*?)\*\*$/) : before.match(/`([^`]+)`$/);
  if (!m) return false;
  hSnapshot();
  const start = off - m[0].length;
  const tail = tn.splitText(off);
  tn.data = tn.data.slice(0, start);
  const el = document.createElement(ch === '*' ? 'strong' : 'code');
  el.textContent = m[1];
  tn.after(el);
  let after = tail;
  if (!after.data) after.data = '​';
  setCaret(after, after.data === '​' ? 1 : 0);
  touch(S.cur); hSnapshot();
  return true;
}

// ---------- sanitize (貼り付け・インポート) ----------
const DROP_TAGS = /^(SCRIPT|STYLE|META|LINK|TITLE|HEAD|NOSCRIPT|IFRAME|OBJECT|EMBED|SVG|CANVAS|VIDEO|AUDIO|INPUT|BUTTON|SELECT|TEXTAREA|TEMPLATE|MAP|AREA|COLGROUP|XML)$/;
const BLOCK_TAGS = { P: 'p', H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3', BLOCKQUOTE: 'blockquote', PRE: 'pre', UL: 'ul', OL: 'ol', LI: 'li' };
const INLINE_TAGS = { B: 'strong', STRONG: 'strong', I: 'em', EM: 'em', U: 'u', INS: 'u', S: 's', STRIKE: 's', DEL: 's', CODE: 'code', KBD: 'code', TT: 'code' };
const CONTAINER = /^(DIV|SECTION|ARTICLE|MAIN|HEADER|FOOTER|NAV|ASIDE|FIGURE|FIGCAPTION|CENTER|DL|DT|DD|ADDRESS|FORM|DETAILS|SUMMARY|BODY|HTML|TBODY|THEAD|TFOOT)$/;
const isBlockEl = (n) => n.nodeType === 1 && (BLOCK_TAGS[n.nodeName] || CONTAINER.test(n.nodeName) || n.nodeName === 'TABLE' || n.nodeName === 'HR');

function safeHref(href) {
  if (!href) return null;
  href = href.trim();
  if (/^(https?:|mailto:|file:)/i.test(href)) return href;
  if (/^#[0-9a-f-]{36}$/i.test(href)) return href;
  return null;
}

function sanitizeHTML(html, opts = {}) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = document.createElement('div');
  out.appendChild(cleanNode(doc.body, opts));
  return out.innerHTML;
}
function cleanNode(node, opts, inPre = false) {
  const frag = document.createDocumentFragment();
  for (const n of Array.from(node.childNodes)) {
    if (n.nodeType === 3) {
      let t = n.data;
      if (!inPre) t = t.replace(/[\r\n\t ]+/g, ' ');
      if (t) frag.appendChild(document.createTextNode(t));
      continue;
    }
    if (n.nodeType !== 1) continue;
    const tag = n.nodeName.toUpperCase();
    if (DROP_TAGS.test(tag) || /^V:/.test(tag)) continue;
    const st = (n.getAttribute('style') || '').toLowerCase();
    if (/mso-list:\s*ignore|display:\s*none/.test(st)) continue;
    const kids = () => cleanNode(n, opts, inPre || tag === 'PRE');
    if (tag.includes(':')) { frag.appendChild(kids()); continue; }

    if (tag === 'BR') { frag.appendChild(document.createElement('br')); continue; }
    if (tag === 'TABLE') {
      if (opts.cell) { frag.appendChild(document.createTextNode(n.textContent.replace(/\s+/g, ' '))); continue; }
      frag.appendChild(tableFromElement(n));
      continue;
    }
    if (tag === 'IMG') {
      const id = n.getAttribute('data-img');
      if (!opts.cell && id && (IMG[id] || (opts.images && opts.images[id]))) {
        const img = document.createElement('img'); img.dataset.img = id; img.alt = '';
        const w = parseInt(n.style.width, 10); if (w) img.style.width = w + 'px';
        frag.appendChild(img);
      }
      continue;
    }
    if (tag === 'HR') { if (!opts.cell) frag.appendChild(document.createElement('hr')); continue; }
    if (tag === 'A') {
      const href = safeHref(n.getAttribute('href'));
      if (!href) { frag.appendChild(kids()); continue; }
      const a = document.createElement('a'); a.setAttribute('href', href); a.appendChild(kids());
      frag.appendChild(a); continue;
    }
    if (n.classList && n.classList.contains('qtable') && !opts.cell) {
      const t = n.querySelector('table');
      if (t) { const b = tableFromElement(t); if (n.dataset.header === '1') b.dataset.header = '1'; frag.appendChild(b); }
      continue;
    }
    // 色・太字のスタイル
    let wrap = null, inner = null;
    const color = n.style && n.style.color || (tag === 'FONT' && n.getAttribute('color'));
    const wantColor = color && keepColor(color);
    const fw = n.style && n.style.fontWeight;
    const boldStyle = fw === 'bold' || parseInt(fw, 10) >= 600;
    const notBold = fw === 'normal' || (fw && parseInt(fw, 10) < 600);
    if (opts.cell) {
      if (tag === 'B' || tag === 'STRONG') { if (notBold) { frag.appendChild(kids()); continue; } wrap = document.createElement('strong'); }
      else if (boldStyle) wrap = document.createElement('strong');
      if (wantColor) { const sp = document.createElement('span'); sp.style.color = color; if (wrap) { wrap.appendChild(sp); inner = sp; } else wrap = sp; }
      if (!wrap) {
        if (isBlockEl(n) && frag.childNodes.length) frag.appendChild(document.createElement('br'));
        frag.appendChild(kids()); continue;
      }
      (inner || wrap).appendChild(kids()); frag.appendChild(wrap); continue;
    }
    if (BLOCK_TAGS[tag]) {
      const el = document.createElement(BLOCK_TAGS[tag]);
      if ((tag === 'UL') && n.classList.contains('checklist')) el.className = 'checklist';
      if (tag === 'LI' && n.dataset.checked) el.dataset.checked = n.dataset.checked === 'true' ? 'true' : 'false';
      let target = el;
      if (wantColor && tag !== 'UL' && tag !== 'OL') { const sp = document.createElement('span'); sp.style.color = color; el.appendChild(sp); target = sp; }
      target.appendChild(kids());
      frag.appendChild(el); continue;
    }
    if (INLINE_TAGS[tag]) {
      if ((tag === 'B' || tag === 'STRONG') && notBold) { frag.appendChild(kids()); continue; }
      wrap = document.createElement(INLINE_TAGS[tag]);
    } else if (boldStyle && !isBlockEl(n)) wrap = document.createElement('strong');
    if (wantColor && !isBlockEl(n)) { const sp = document.createElement('span'); sp.style.color = color; if (wrap) { wrap.appendChild(sp); inner = sp; } else wrap = sp; }
    if (wrap) { (inner || wrap).appendChild(kids()); frag.appendChild(wrap); continue; }
    if (CONTAINER.test(tag)) {
      const hasBlock = Array.from(n.childNodes).some(isBlockEl);
      if (hasBlock || tag === 'BODY' || tag === 'HTML' || tag === 'TBODY') { frag.appendChild(kids()); continue; }
      const p = document.createElement('p'); p.appendChild(kids());
      if (p.textContent.trim() || p.querySelector('img,br')) frag.appendChild(p);
      continue;
    }
    frag.appendChild(kids()); // 不明なインライン要素は中身だけ
  }
  return frag;
}

function insertPlainText(text) {
  text = text.replace(/\r\n?/g, '\n');
  edit(() => {
    const r = selRange();
    const inPre = r && (r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer).closest('pre');
    if (!text.includes('\n') || inPre) { document.execCommand('insertText', false, text); return; }
    const html = text.split('\n').map((l) => `<p>${esc(l) || '<br>'}</p>`).join('');
    document.execCommand('insertHTML', false, html);
  });
}
function insertCleanHTML(html) {
  if (!html.trim()) return;
  edit(() => document.execCommand('insertHTML', false, html));
}

// 最上位のブロックとして挿入（表など）
function insertBlock(el) {
  const r = selRange() || (restoreRange() && selRange());
  let top = r ? topBlock(r.startContainer) : null;
  if (top && top.classList && top.classList.contains('qtable')) top = top.nextElementSibling;
  if (!top) ed.appendChild(el);
  else if (top.tagName === 'P' && !top.textContent.trim() && !top.querySelector('img')) top.replaceWith(el);
  else {
    const pre = document.createRange();
    pre.setStart(top, 0); pre.setEnd(r.startContainer, r.startOffset);
    if (!pre.toString().trim()) top.before(el); else top.after(el);
  }
}

// ---------- editor events ----------
let plainPasteFlag = 0;
function bindEditor() {
  ed = $('.body'); titleEl = $('.title');
  document.execCommand('defaultParagraphSeparator', false, 'p');

  document.addEventListener('selectionchange', () => {
    if (!S.edit || S.composing) return;
    const r = selRange();
    if (r) { lastRange = r.cloneRange(); updateToolbar(); }
  });

  titleEl.addEventListener('input', () => {
    const a = A.get(S.cur); if (!a || !S.edit) return;
    a.title = titleEl.textContent.replace(/[\r\n]+/g, ' ').trim();
    touch(a.id);
    renderCrumbs(); renderMeta(); updateDocTitle();
    const lab = $(`.tnode[data-id="${a.id}"] .tlabel`);
    if (lab) lab.textContent = a.title || '無題の記事';
  });
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      ed.focus();
      const f = ed.firstElementChild;
      if (f && !f.classList.contains('qtable')) setCaret(f, 0);
    }
  });
  titleEl.addEventListener('paste', (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/[\r\n]+/g, ' '));
  });

  ed.addEventListener('beforeinput', (e) => {
    if (!S.edit) return;
    const t = e.inputType;
    if (t === 'historyUndo') { e.preventDefault(); undo(); return; }
    if (t === 'historyRedo') { e.preventDefault(); redo(); return; }
    if (inTable(e.target) && e.target.closest && e.target.closest('td')) {
      // キー入力を経ずに文字が入る場合（入力支援ソフト等）も、Excelと同じくセルの中身を置き換える
      if (T.mode === 'ready' && t === 'insertText' && e.data) {
        e.preventDefault();
        tableStartEdit('type', true);
        document.execCommand('insertText', false, e.data);
      }
      return;
    }
    // 表ブロックを巻き込む削除・上書きは止める
    const r = selRange();
    if (r && !r.collapsed && (t.startsWith('delete') || t.startsWith('insert'))) {
      for (const tb of $$('.qtable', ed)) {
        if (r.intersectsNode(tb)) { e.preventDefault(); toast('表を含む範囲はまとめて消せません。表は表のメニュー（左上の■）から削除できます', 'warn', 5000); return; }
      }
    }
    if (!t.startsWith('insertText') && !t.startsWith('insertComposition') && !t.startsWith('delete')) hSnapshot();
  });

  ed.addEventListener('input', (e) => {
    if (!S.edit) return;
    touch(S.cur);
    const t = e.inputType;
    const last = t === 'insertText' && e.data ? normChar(e.data.slice(-1)) : '';
    if (last === ' ' && mdBlockShortcut()) return;
    if ((last === '*' || last === '`') && mdInlineShortcut(last)) return;
    if (t === 'insertParagraph') {
      const r = selRange();
      const li = r && (r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer).closest('ul.checklist > li');
      if (li && !li.textContent.trim()) li.dataset.checked = 'false';
    }
    if (inTable(e.target)) { hSchedule(); return; }
    if (t === 'insertText' || t === 'insertCompositionText' || t.startsWith('delete')) {
      if (t.startsWith('delete')) cleanupStyles();
      hSchedule();
    } else { cleanupStyles(); normalize(); hSnapshot(); }
    if (!ed.firstChild) normalize();
  });

  ed.addEventListener('keydown', (e) => {
    if (!S.edit) return;
    const ime = e.isComposing || e.keyCode === 229;
    if (ime && (inTable(e.target) || tableReadyActive())) { tableKey(e); return; }
    if (ime) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && !e.altKey) {
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
      if (k === 'k') { e.preventDefault(); openLinkPop(); return; }
      if (k === 'v' && e.shiftKey) { plainPasteFlag = Date.now(); }
    }
    if (inTable(e.target) || tableReadyActive()) { tableKey(e); return; }
    if (imgSelected() && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); removeSelectedImage(); return; }
    if (mod && !e.altKey && (k === 'b' || k === 'i' || k === 'u')) {
      e.preventDefault(); exec(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline'); return;
    }
    const r = selRange();
    if (!r) return;
    const node = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer;
    if (e.key === 'Enter' && !e.shiftKey && !mod) {
      if (mdEnterShortcut()) { e.preventDefault(); return; }
      const pre = node.closest('pre');
      if (pre) { e.preventDefault(); preEnter(pre, r); return; }
    }
    if (e.key === 'Enter' && mod) {
      const pre = node.closest('pre');
      if (pre) { e.preventDefault(); exitBlockAfter(pre); return; }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (node.closest('li')) exec(e.shiftKey ? 'outdent' : 'indent');
      else if (node.closest('pre')) edit(() => document.execCommand('insertText', false, '    '));
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (r.collapsed) {
        const top = topBlock(r.startContainer);
        if (!top) return;
        const pre = document.createRange();
        if (e.key === 'Backspace') {
          pre.setStart(top, 0); pre.setEnd(r.startContainer, r.startOffset);
          const prev = top.previousElementSibling;
          if (!pre.toString() && !pre.cloneContents().querySelector('img') && prev && prev.classList.contains('qtable')) { e.preventDefault(); return; }
        } else {
          pre.setStart(r.endContainer, r.endOffset); pre.setEndAfter(top.lastChild || top);
          const next = top.nextElementSibling;
          if (!pre.toString() && !pre.cloneContents().querySelector('img') && next && next.classList.contains('qtable')) { e.preventDefault(); return; }
        }
      }
    }
  });

  ed.addEventListener('paste', (e) => {
    if (!S.edit) return;
    if (inTable(e.target) || tableReadyActive()) { tablePaste(e); return; }
    e.preventDefault();
    const cd = e.clipboardData;
    const html = cd.getData('text/html'), text = cd.getData('text/plain');
    const plain = Date.now() - plainPasteFlag < 1500;
    plainPasteFlag = 0;
    const isExcel = /urn:schemas-microsoft-com:office:excel|ProgId content=Excel/i.test(html);
    if (!plain && isExcel && text) { insertTableBlock(parseTSV(text)); return; }
    const files = Array.from(cd.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length && !(html && /<table/i.test(html))) { insertImages(files); return; }
    if (plain || !html) {
      if (!plain && text.includes('\t') && text.trim().includes('\n')) { insertTableBlock(parseTSV(text)); return; }
      insertPlainText(text); return;
    }
    insertCleanHTML(sanitizeHTML(html));
  });

  ed.addEventListener('mousedown', (e) => {
    if (!S.edit) return;
    const li = e.target.closest && e.target.closest('ul.checklist > li');
    if (li) {
      const rr = li.getBoundingClientRect();
      if (e.clientX - rr.left < 24 && e.clientY - rr.top < 34) {
        e.preventDefault();
        edit(() => { li.dataset.checked = li.dataset.checked === 'true' ? 'false' : 'true'; });
      }
    }
  });

  ed.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a) {
      const href = a.getAttribute('href');
      if (S.edit && !(e.ctrlKey || e.metaKey)) { e.preventDefault(); return; }
      e.preventDefault();
      if (href.startsWith('#')) {
        const id = decodeURIComponent(href.slice(1));
        if (A.has(id)) go(id); else toast('リンク先の記事は削除されています', 'warn');
      } else openExternalLink(href);
      return;
    }
    const img = e.target.closest('img[data-img]');
    if (img && !S.edit) openLightbox(img);
  });
}

function preEnter(pre, r) {
  // 末尾の空行でもう一度 Enter → コードブロックを抜ける
  const after = document.createRange();
  after.setStart(r.endContainer, r.endOffset); after.setEndAfter(pre.lastChild || pre);
  const before = document.createRange();
  before.setStart(pre, 0); before.setEnd(r.startContainer, r.startOffset);
  const bt = before.cloneContents();
  const lastNode = bt.lastChild;
  const atEnd = !after.toString() && !after.cloneContents().querySelector('img');
  const endsWithBreak = (lastNode && lastNode.nodeName === 'BR') || /\n$/.test(before.toString());
  if (atEnd && endsWithBreak && before.toString().trim()) {
    edit(() => {
      while (pre.lastChild && (pre.lastChild.nodeName === 'BR' || (pre.lastChild.nodeType === 3 && !pre.lastChild.data.replace(/\n/g, '')))) pre.lastChild.remove();
      if (pre.lastChild && pre.lastChild.nodeType === 3) pre.lastChild.data = pre.lastChild.data.replace(/\n+$/, '');
      const p = emptyP(); pre.after(p); setCaret(p, 0);
    });
    return;
  }
  edit(() => document.execCommand('insertLineBreak'));
}
function exitBlockAfter(blk) {
  edit(() => {
    let n = blk.nextElementSibling;
    if (!n || n.tagName !== 'P') { n = emptyP(); blk.after(n); }
    setCaret(n, 0);
  });
}

// ---------- modes ----------
const INTENT_KEY = 'quine-edit-intent';
function setIntent(v) {
  const s = JSON.stringify(v);
  try { sessionStorage.setItem(INTENT_KEY, s); } catch (e) { /* ignore */ }
  try { window.name = 'quine-edit:' + s; } catch (e) { /* ignore */ }
}
function takeIntent() {
  let s = null;
  try { s = sessionStorage.getItem(INTENT_KEY); sessionStorage.removeItem(INTENT_KEY); } catch (e) { /* ignore */ }
  if (String(window.name).startsWith('quine-edit:')) { if (!s) s = window.name.slice(11); window.name = ''; }
  try { const v = JSON.parse(s); if (v && Date.now() - v.t < 60000) return v; } catch (e) { /* ignore */ }
  return null;
}

function requestEdit(after) {
  if (S.edit) { after && after(); return; }
  askName(() => {
    if (S.dirty) {
      enterEdit();
      toast('未保存の変更があるため、再読み込みせずにそのまま編集を続けます', 'warn', 5000);
      after && after();
      return;
    }
    setIntent({ id: S.cur, t: Date.now(), top: $('.content').scrollTop, after: after ? after.name || '' : '' });
    stashKeyForReload().finally(() => location.reload());
  });
}
function enterEdit() {
  S.edit = true;
  S.sessionEdits.clear();
  document.body.classList.add('editing');
  renderAll();
}
function exitEdit() {
  commitEditor();
  const finish = () => {
    S.edit = false;
    document.body.classList.remove('editing');
    closeFloating();
    renderAll();
    if (S.dirty) toast('閲覧モードに戻りました。変更はまだ保存されていません', 'warn', 4500);
  };
  // 今回書いた記事について、ほかの記事とつながる言葉があればリンク候補を出す
  const ids = Array.from(S.sessionEdits).filter((id) => A.has(id));
  S.sessionEdits.clear();
  if (ids.length) showLinkSuggestions(ids, { done: finish });
  else finish();
}
