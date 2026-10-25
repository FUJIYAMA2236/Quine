// ---------- link suggestions（ほかの記事のタイトル・見出しと同じ言葉をリンク候補にする） ----------
// 方向は2つ：
//   出ていくリンク … 書いた記事の中の言葉 → その言葉がタイトル・見出しになっている記事へ
//   入ってくるリンク … ほかの記事の中の言葉 → 書いた記事（タイトル・見出し）へ
// 1つの記事につき、同じリンク先へは最初の1か所だけを候補にする（すでにリンクがあれば出さない）。

const LINK_SKIP = 'a,h1,h2,h3,pre,code';
const MIN_TERM = 2;

const headingCache = new Map();
function articleHeadings(a) {
  const c = headingCache.get(a.id);
  if (c && c.body === a.body) return c.list;
  const d = new DOMParser().parseFromString(a.body || '', 'text/html');
  const list = $$('h1,h2,h3', d).map((h) => h.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t.length <= 60);
  headingCache.set(a.id, { body: a.body, list });
  return list;
}

// 記事 a を指す言葉の一覧（タイトル → 見出しの順）
function termsOf(a) {
  const out = [];
  const add = (text, kind) => {
    const t = (text || '').trim();
    const n = norm(t);
    if (n.length < MIN_TERM || out.some((x) => x.n === n)) return;
    out.push({ text: t, n, targetId: a.id, kind, ascii: /^[\x20-\x7e]+$/.test(n) });
  };
  add(a.title, 'title');
  for (const h of articleHeadings(a)) add(h, 'heading');
  return out;
}

// root（記事本文のDOM）の中から terms の出現を探す。リンク先ごとに最初の1か所だけ。
function findLinkSpots(root, terms, selfId) {
  const linked = new Set($$('a[href^="#"]', root).map((x) => decodeURIComponent(x.getAttribute('href').slice(1))));
  const usable = terms.filter((t) => t.targetId !== selfId && !linked.has(t.targetId));
  if (!usable.length) return [];
  const hits = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let order = 0;
  while (tw.nextNode()) {
    const node = tw.currentNode;
    if (!node.data.trim() || (node.parentNode.closest && node.parentNode.closest(LINK_SKIP))) continue;
    const { n, map } = normMap(node.data);
    for (const t of usable) {
      let p = n.indexOf(t.n);
      while (p >= 0) {
        const start = map[p], end = map[p + t.n.length];
        const before = node.data[start - 1] || '', after = node.data[end] || '';
        // 英数字だけの言葉は、単語の途中に当たったものを除く（"IT" が "EDIT" に当たらないように）
        if (!t.ascii || (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after))) {
          hits.push({ node, start, end, term: t, order: order * 100000 + start });
          break;
        }
        p = n.indexOf(t.n, p + 1);
      }
    }
    order++;
  }
  // 重なったら長い言葉を優先、同じリンク先は最初の1か所だけ
  hits.sort((x, y) => (y.end - y.start) - (x.end - x.start) || x.order - y.order);
  const chosen = [], taken = new Set();
  for (const h of hits) {
    if (taken.has(h.term.targetId)) continue;
    if (chosen.some((c) => c.node === h.node && h.start < c.end && c.start < h.end)) continue;
    chosen.push(h);
    taken.add(h.term.targetId);
  }
  return chosen.sort((x, y) => x.order - y.order);
}

function snippetOf(node, start, end) {
  const s = node.data;
  const a = Math.max(0, start - 24), b = Math.min(s.length, end + 24);
  return (a > 0 ? '…' : '') + esc(s.slice(a, start)) + '<mark>' + esc(s.slice(start, end)) + '</mark>' + esc(s.slice(end, b)) + (b < s.length ? '…' : '');
}

// ids の記事について、出ていく・入ってくる両方の候補を集める
function collectLinkCandidates(ids) {
  commitEditor();
  const roots = new Map();
  const rootOf = (id) => {
    if (!roots.has(id)) { const d = document.createElement('div'); d.innerHTML = A.get(id).body || ''; roots.set(id, d); }
    return roots.get(id);
  };
  const allTerms = Array.from(A.values()).flatMap(termsOf);
  const cands = [];
  const seen = new Set();
  const push = (dir, hostId, spot) => {
    const key = hostId + '>' + spot.term.targetId;
    if (seen.has(key)) return;
    seen.add(key);
    cands.push({ dir, hostId, targetId: spot.term.targetId, term: spot.term, node: spot.node, start: spot.start, end: spot.end, snippet: snippetOf(spot.node, spot.start, spot.end), on: spot.term.kind === 'title' });
  };
  for (const id of ids) {
    const a = A.get(id);
    if (!a) continue;
    // 出ていく：この記事の中の言葉 → ほかの記事
    for (const spot of findLinkSpots(rootOf(id), allTerms, id)) push('out', id, spot);
    // 入ってくる：ほかの記事の中の言葉 → この記事
    const mine = termsOf(a);
    if (!mine.length) continue;
    for (const b of A.values()) {
      if (b.id === id) continue;
      for (const spot of findLinkSpots(rootOf(b.id), mine, b.id)) push('in', b.id, spot);
    }
  }
  return { cands, roots };
}

function applyLinkCandidates(chosen, roots) {
  S.linking = true;
  try { return applyLinks(chosen, roots); } finally { S.linking = false; }
}
function applyLinks(chosen, roots) {
  const byNode = new Map();
  for (const c of chosen) { if (!byNode.has(c.node)) byNode.set(c.node, []); byNode.get(c.node).push(c); }
  const hosts = new Set();
  for (const [node, list] of byNode) {
    list.sort((x, y) => y.start - x.start); // 後ろから包むと前の位置がずれない
    for (const c of list) {
      const mid = node.splitText(c.start);
      mid.splitText(c.end - c.start);
      const a = document.createElement('a');
      a.setAttribute('href', '#' + c.targetId);
      mid.replaceWith(a);
      a.appendChild(mid);
      hosts.add(c.hostId);
    }
  }
  for (const id of hosts) {
    const art = A.get(id);
    const html = roots.get(id).innerHTML;
    art.body = html;
    touch(id);
    if (S.edit && id === S.cur) {
      // 編集中の記事は、元に戻す（Ctrl+Z）で取り消せるように履歴に積んで差し替える
      edit(() => { ed.innerHTML = html; hydrate(ed); markBrokenLinks(ed); });
      baseline = serializeBody();
    }
  }
  if (!S.edit && hosts.has(S.cur)) renderArticle();
  renderMeta();
  return hosts.size;
}

// 候補を選ぶ画面。done(added) は閉じたあとに呼ばれる
function showLinkSuggestions(ids, { done, emptyToast = false } = {}) {
  const { cands, roots } = collectLinkCandidates(ids);
  if (!cands.length) {
    if (emptyToast) toast('リンクできそうな言葉は見つかりませんでした');
    done && done(0);
    return;
  }
  const box = document.createElement('div');
  const titleOf = (id) => esc(A.get(id).title || '無題の記事');
  const row = (c, i) => `<label class="lk-row ${c.on ? 'on' : ''}" data-i="${i}">
      <input type="checkbox" ${c.on ? 'checked' : ''}>
      <div class="lk-main">
        <div class="lk-snip">${c.snippet}</div>
        <div class="lk-to">${c.dir === 'in' ? `記事「${titleOf(c.hostId)}」の中 ・ ` : ''}${ic('link', 'xs')}<b>${titleOf(c.targetId)}</b> へリンク
          <span class="lk-kind">${c.term.kind === 'title' ? 'タイトルと一致' : '見出し「' + esc(c.term.text) + '」と一致'}</span></div>
      </div></label>`;
  const outs = cands.map((c, i) => [c, i]).filter(([c]) => c.dir === 'out');
  const ins = cands.map((c, i) => [c, i]).filter(([c]) => c.dir === 'in');
  const one = ids.length === 1 ? `「${titleOf(ids[0])}」` : '書いた記事';
  box.innerHTML = `<p>ほかの記事のタイトルや見出しと同じ言葉が見つかりました。リンクにしたいものにチェックを入れてください。リンクにすると、クリックでその記事へ移動できます。</p>
    <div class="lk-tools"><button class="btn ghost" data-all="1">${ic('check', 'sm')}すべて選ぶ</button><button class="btn ghost" data-all="0">${ic('x', 'sm')}すべて外す</button></div>
    ${outs.length ? `<h4 class="lk-h">${one}の中の言葉 → ほかの記事へ <span>${outs.length}件</span></h4>${outs.map(([c, i]) => row(c, i)).join('')}` : ''}
    ${ins.length ? `<h4 class="lk-h">ほかの記事の中の言葉 → ${one}へ <span>${ins.length}件</span></h4>${ins.map(([c, i]) => row(c, i)).join('')}` : ''}`;
  let modal;
  const refresh = () => {
    $$('.lk-row', box).forEach((el) => { const c = cands[+el.dataset.i]; c.on = el.querySelector('input').checked; el.classList.toggle('on', c.on); });
    const n = cands.filter((c) => c.on).length;
    const b = modal.actions[1].el;
    b.disabled = !n;
    b.textContent = n ? `選んだ${n}件をリンクする` : 'リンクする候補を選んでください';
  };
  box.addEventListener('change', refresh);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-all]');
    if (!b) return;
    $$('.lk-row input', box).forEach((x) => { x.checked = b.dataset.all === '1'; });
    refresh();
  });
  let finished = false;
  const finish = (n) => { if (finished) return; finished = true; done && done(n); };
  modal = openModal({
    title: 'リンクの候補', icon: 'link', wide: true, body: box,
    actions: [
      { label: 'リンクしない', onClick: () => finish(0) },
      {
        label: 'リンクする', primary: true, onClick: () => {
          const chosen = cands.filter((c) => c.on);
          const n = applyLinkCandidates(chosen, roots);
          toast(`${chosen.length}件のリンクを追加しました（${n}記事・未保存）`, 'ok');
          finish(chosen.length);
        },
      },
    ],
  });
  // Esc や背景クリックで閉じたときも続きの処理を進める
  const obs = new MutationObserver(() => { if (!document.body.contains(box)) { obs.disconnect(); finish(0); } });
  obs.observe(document.body, { childList: true });
  refresh();
}
