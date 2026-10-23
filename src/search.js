// ---------- search ----------
// 大文字小文字・全角半角（NFKC）を区別せず、カタカナはひらがなとして比べる
function normChar(ch) {
  return ch.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60));
}
function norm(s) { let o = ''; for (const ch of String(s || '')) o += normChar(ch); return o; }
function normMap(s) {
  let n = ''; const map = []; let i = 0;
  for (const ch of s) { const x = normChar(ch); for (let k = 0; k < x.length; k++) map.push(i); n += x; i += ch.length; }
  map.push(i);
  return { n, map };
}
function findRanges(str, terms) {
  const { n, map } = normMap(str);
  const out = [];
  for (const t of terms) {
    let p = n.indexOf(t);
    while (p >= 0) { out.push([map[p], map[p + t.length]]); p = n.indexOf(t, p + t.length); }
  }
  out.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of out) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r.slice()); }
  return merged;
}
function highlightText(str, terms) {
  const rs = findRanges(str, terms);
  let o = '', last = 0;
  for (const [a, b] of rs) { o += esc(str.slice(last, a)) + '<mark>' + esc(str.slice(a, b)) + '</mark>'; last = b; }
  return o + esc(str.slice(last));
}

const textCache = new Map();
function plainText(a) {
  const c = textCache.get(a.id);
  if (c && c.body === a.body) return c;
  const html = (a.body || '').replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|h[1-6]|li|td|pre|blockquote|div|tr)>/gi, ' $&');
  const d = new DOMParser().parseFromString(html, 'text/html');
  const text = d.body.textContent.replace(/​/g, '').replace(/\s+/g, ' ').trim();
  const v = { body: a.body, text, n: norm(text) };
  textCache.set(a.id, v);
  return v;
}

let results = [];
let kbIndex = -1;
function runSearch(q) {
  commitEditor();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  S.search.q = q; S.search.terms = terms;
  S.search.hits = new Set(); S.search.ctx = new Set();
  $('.search').classList.toggle('has-q', !!q);
  results = [];
  if (!terms.length) { closeResults(); renderTree(); applyHighlights(); return; }
  for (const a of A.values()) {
    const nt = norm(a.title);
    const pt = plainText(a);
    if (terms.every((t) => nt.includes(t) || pt.n.includes(t))) {
      S.search.hits.add(a.id);
      results.push({ a, inTitle: terms.some((t) => nt.includes(t)), text: pt.text });
    }
  }
  for (const id of S.search.hits) for (const p of ancestors(id)) if (!S.search.hits.has(p.id)) S.search.ctx.add(p.id);
  results.sort((x, y) => (y.inTitle - x.inTitle) || String(y.a.updatedAt).localeCompare(String(x.a.updatedAt)));
  renderTree();
  renderResults();
  applyHighlights();
}

function snippet(text, terms) {
  const rs = findRanges(text, terms);
  if (!rs.length) return esc(text.slice(0, 90));
  const [a] = rs[0];
  const s = Math.max(0, a - 32);
  const e = Math.min(text.length, a + 70);
  return (s > 0 ? '…' : '') + highlightText(text.slice(s, e), terms) + (e < text.length ? '…' : '');
}

function renderResults() {
  const pop = $('.search-pop');
  const terms = S.search.terms;
  kbIndex = -1;
  if (!results.length) {
    pop.innerHTML = `<div class="sr-empty"><b>見つかりませんでした</b>言葉を減らすか、別の言い方で試してください</div>`;
  } else {
    pop.innerHTML = `<div class="sr-head"><span>${results.length}件の記事</span><span>スペース区切りで絞り込み</span></div>` +
      results.slice(0, 80).map((r) => `<button class="sr-item" data-id="${r.a.id}">
        <div class="sr-title">${ic('doc', 'sm')}<span>${highlightText(r.a.title || '無題の記事', terms)}</span></div>
        ${r.a.parentId ? `<div class="sr-crumb">${esc(crumbText(r.a.id))}</div>` : ''}
        <div class="sr-snip">${snippet(r.text, terms)}</div></button>`).join('');
  }
  pop.classList.add('open');
}
function closeResults() { $('.search-pop').classList.remove('open'); }

function clearSearch() {
  $('#q').value = '';
  runSearch('');
}

// ---- 本文のハイライト（表示上のみ。保存データには入らない） ----
function applyHighlights() {
  const bar = $('.hitbar');
  S.search.marks = [];
  if (!ed) return;
  $$('mark.qhit', ed).forEach(unwrap);
  ed.normalize();
  const terms = S.search.terms;
  if (S.edit || !terms.length || !S.search.hits.has(S.cur)) { bar.classList.remove('on'); return; }
  const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (tw.nextNode()) nodes.push(tw.currentNode);
  for (const t of nodes) {
    const rs = findRanges(t.data, terms);
    for (let i = rs.length - 1; i >= 0; i--) {
      const [a, b] = rs[i];
      const mid = t.splitText(a);
      mid.splitText(b - a);
      const m = document.createElement('mark');
      m.className = 'qhit';
      mid.replaceWith(m);
      m.appendChild(mid);
    }
  }
  S.search.marks = $$('mark.qhit', ed);
  S.search.idx = 0;
  bar.classList.add('on');
  updateHitbar(true);
}
function updateHitbar(scroll) {
  const n = S.search.marks.length;
  const txt = $('.hb-text');
  S.search.marks.forEach((m, i) => m.classList.toggle('cur', i === S.search.idx));
  if (!n) { txt.innerHTML = '本文には一致なし（タイトルに一致）'; return; }
  txt.innerHTML = `<b>${esc(S.search.q)}</b>${S.search.idx + 1} / ${n}`;
  if (scroll) {
    const m = S.search.marks[S.search.idx];
    const c = $('.content');
    const r = m.getBoundingClientRect(), cr = c.getBoundingClientRect();
    if (r.top < cr.top + 80 || r.bottom > cr.bottom - 40) c.scrollTop += r.top - cr.top - cr.height / 3;
  }
}
function hitStep(d) {
  const n = S.search.marks.length;
  if (!n) return;
  S.search.idx = (S.search.idx + d + n) % n;
  updateHitbar(true);
}

function bindSearch() {
  const q = $('#q');
  const run = debounce(() => runSearch(q.value), 220);
  q.addEventListener('input', run);
  q.addEventListener('focus', () => { if (S.search.terms.length) renderResults(); });
  q.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    const items = $$('.sr-item');
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (q.value) clearSearch(); else q.blur(); closeResults(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!$('.search-pop').classList.contains('open')) renderResults();
      kbIndex = clamp(kbIndex + (e.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1);
      items.forEach((it, i) => it.classList.toggle('kb', i === kbIndex));
      items[kbIndex] && items[kbIndex].scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch(q.value);
      const it = $$('.sr-item')[Math.max(0, kbIndex)];
      if (it) { go(it.dataset.id); closeResults(); q.blur(); }
    }
  });
  $('.search-pop').addEventListener('mousedown', (e) => e.preventDefault());
  $('.search-pop').addEventListener('click', (e) => {
    const it = e.target.closest('.sr-item');
    if (!it) return;
    go(it.dataset.id);
    closeResults();
    q.blur();
  });
  q.addEventListener('blur', () => setTimeout(closeResults, 120));
  $('.search-clear').addEventListener('click', (e) => { e.preventDefault(); clearSearch(); q.focus(); });
  $('.hitbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hb]');
    if (!b) return;
    if (b.dataset.hb === 'next') hitStep(1);
    else if (b.dataset.hb === 'prev') hitStep(-1);
    else clearSearch();
  });
}
