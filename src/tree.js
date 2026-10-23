// ---------- tree ----------
const EXP_KEY = () => 'expanded:' + db.meta.name;

function loadExpanded() { S.expanded = new Set(store.get(EXP_KEY(), [])); }
function saveExpanded() { store.set(EXP_KEY(), Array.from(S.expanded)); }

function renderTree() {
  const tree = $('.tree');
  const filtering = !!S.search.terms.length;
  tree.classList.toggle('filtering', filtering);
  const kidsMap = new Map();
  for (const a of A.values()) {
    const p = a.parentId && A.has(a.parentId) ? a.parentId : null;
    if (!kidsMap.has(p)) kidsMap.set(p, []);
    kidsMap.get(p).push(a);
  }
  for (const arr of kidsMap.values()) arr.sort((x, y) => (x.order - y.order) || String(x.createdAt).localeCompare(String(y.createdAt)));
  const visible = (a) => !filtering || S.search.hits.has(a.id) || S.search.ctx.has(a.id);

  const frag = document.createDocumentFragment();
  const build = (pid, depth, into) => {
    for (const a of kidsMap.get(pid) || []) {
      if (!visible(a)) continue;
      const kids = (kidsMap.get(a.id) || []).filter(visible);
      const open = filtering || S.expanded.has(a.id);
      const node = document.createElement('div');
      node.className = 'tnode' + (a.id === S.cur ? ' active' : '') +
        (filtering ? (S.search.hits.has(a.id) ? ' hit' : ' ctx') : '');
      node.dataset.id = a.id;
      node.style.paddingLeft = (4 + depth * 16) + 'px';
      node.style.setProperty('--indent', (8 + depth * 16) + 'px');
      node.draggable = S.edit && !filtering;
      const count = (kidsMap.get(a.id) || []).length;
      node.innerHTML = `<button class="twist ${kids.length ? (open ? 'open' : '') : 'none'}" tabindex="-1">${ic('chev', 'xs')}</button>` +
        `<span class="ticon">${ic(count ? 'stack' : 'file', 'sm')}</span><span class="tlabel"></span>` +
        (count && !open ? `<span class="tcount">${count}</span>` : '') +
        `<button class="tmore" tabindex="-1" title="メニュー">${ic('more', 'sm')}</button>`;
      const label = node.querySelector('.tlabel');
      if (filtering) label.innerHTML = highlightText(a.title || '無題の記事', S.search.terms);
      else label.textContent = a.title || '無題の記事';
      label.title = a.title || '';
      into.appendChild(node);
      if (kids.length && open) {
        const box = document.createElement('div');
        box.className = 'tchildren';
        build(a.id, depth + 1, box);
        into.appendChild(box);
      }
    }
  };
  build(null, 0, frag);
  tree.innerHTML = '';
  tree.appendChild(frag);
  if (!tree.children.length) {
    tree.innerHTML = filtering
      ? '<div class="tree-empty">一致する記事はありません</div>'
      : `<div class="tree-empty">記事がありません<br>${S.edit ? '下の「新しい記事」から追加できます' : '「編集」を押すと記事を追加できます'}</div>`;
  }
  const act = tree.querySelector('.tnode.active');
  if (act) {
    const tr = tree.getBoundingClientRect(), ar = act.getBoundingClientRect();
    if (ar.top < tr.top || ar.bottom > tr.bottom) act.scrollIntoView({ block: 'nearest' });
  }
}

function revealInTree(id) {
  for (const a of ancestors(id)) S.expanded.add(a.id);
  saveExpanded();
}

function articleMenuItems(id) {
  const a = A.get(id);
  const n = descendants(id).length;
  const need = S.edit ? '' : '編集モード';
  return [
    { header: true, label: a.title || '無題の記事' },
    { label: '子記事を追加', icon: 'child', disabled: !S.edit, hint: need, onClick: () => addArticle(id, null) },
    { label: '下に記事を追加', icon: 'below', disabled: !S.edit, hint: need, onClick: () => addArticle(a.parentId ?? null, id) },
    '-',
    { label: 'この記事のみエクスポート', icon: 'export', onClick: () => exportArticles(id, false) },
    { label: '子記事も含めてエクスポート', icon: 'export', disabled: !n, hint: n ? `${n + 1}件` : '', onClick: () => exportArticles(id, true) },
    '-',
    { label: '削除', icon: 'trash', danger: true, disabled: !S.edit, hint: need, onClick: () => deleteArticle(id) },
  ];
}

function bindTree() {
  const tree = $('.tree');
  tree.addEventListener('click', (e) => {
    const node = e.target.closest('.tnode');
    if (!node) return;
    const id = node.dataset.id;
    if (e.target.closest('.twist')) {
      if (S.search.terms.length) return;
      S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id);
      saveExpanded(); renderTree();
      return;
    }
    if (e.target.closest('.tmore')) {
      const btn = e.target.closest('.tmore');
      btn.classList.add('open');
      openMenu(articleMenuItems(id), btn, { onClose: () => btn.classList.remove('open') });
      return;
    }
    go(id);
  });
  tree.addEventListener('dblclick', (e) => {
    const node = e.target.closest('.tnode');
    if (!node || e.target.closest('button') || S.search.terms.length) return;
    const id = node.dataset.id;
    if (!childrenOf(id).length) return;
    S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id);
    saveExpanded(); renderTree();
  });
  tree.addEventListener('contextmenu', (e) => {
    const node = e.target.closest('.tnode');
    if (!node) return;
    e.preventDefault();
    openMenu(articleMenuItems(node.dataset.id), { x: e.clientX, y: e.clientY });
  });

  // ---- drag & drop (編集モードのみ) ----
  let dragId = null;
  const clear = () => { $$('.drop-before,.drop-after,.drop-inside', tree).forEach((n) => n.classList.remove('drop-before', 'drop-after', 'drop-inside')); tree.classList.remove('drop-root'); };
  const zoneOf = (node, e) => {
    const r = node.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    return y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
  };
  tree.addEventListener('dragstart', (e) => {
    const node = e.target.closest('.tnode');
    if (!node || !S.edit) { e.preventDefault(); return; }
    dragId = node.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-quine-article', dragId);
    setTimeout(() => node.classList.add('dragging'), 0);
  });
  tree.addEventListener('dragend', () => { dragId = null; clear(); $$('.dragging', tree).forEach((n) => n.classList.remove('dragging')); });
  tree.addEventListener('dragover', (e) => {
    if (!dragId) return;
    const node = e.target.closest('.tnode');
    clear();
    if (!node) { e.preventDefault(); tree.classList.add('drop-root'); return; }
    const tid = node.dataset.id;
    if (tid === dragId || isDescendant(tid, dragId)) { e.dataTransfer.dropEffect = 'none'; return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    node.classList.add('drop-' + zoneOf(node, e));
  });
  tree.addEventListener('dragleave', (e) => { if (!tree.contains(e.relatedTarget)) clear(); });
  tree.addEventListener('drop', (e) => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    const node = e.target.closest('.tnode');
    const id = dragId;
    clear();
    if (!node) { moveArticle(id, null, 'root'); return; }
    const tid = node.dataset.id;
    if (tid === id || isDescendant(tid, id)) return;
    moveArticle(id, tid, zoneOf(node, e));
  });

  $('.new-article').addEventListener('click', () => {
    if (!S.edit) { toast('記事の追加は編集モードで行えます。「編集」を押してください'); return; }
    addArticle(null, null);
  });
  $('#collapseAll').addEventListener('click', () => { S.expanded.clear(); if (S.cur) revealInTree(S.cur); saveExpanded(); renderTree(); });

  // サイドバー幅
  const rz = $('.resizer');
  rz.addEventListener('mousedown', (e) => {
    e.preventDefault();
    rz.classList.add('drag');
    const move = (ev) => {
      const w = Math.max(200, Math.min(520, ev.clientX));
      document.documentElement.style.setProperty('--side-w', w + 'px');
    };
    const up = (ev) => {
      rz.classList.remove('drag');
      removeEventListener('mousemove', move); removeEventListener('mouseup', up);
      store.set('sideW', Math.max(200, Math.min(520, ev.clientX)));
    };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
  });
}

function reorder(pid, list) { list.forEach((a, i) => { if (a.order !== i || (a.parentId ?? null) !== pid) { a.order = i; a.parentId = pid; } }); }

function moveArticle(id, targetId, zone) {
  const a = A.get(id);
  if (!a) return;
  commitEditor();
  let pid, idx;
  if (zone === 'root') { pid = null; idx = Infinity; }
  else if (zone === 'inside') { pid = targetId; idx = Infinity; S.expanded.add(targetId); saveExpanded(); }
  else {
    const t = A.get(targetId);
    pid = t.parentId ?? null;
    const sib = childrenOf(pid).filter((x) => x.id !== id);
    idx = sib.findIndex((x) => x.id === targetId) + (zone === 'after' ? 1 : 0);
  }
  const sib = childrenOf(pid).filter((x) => x.id !== id);
  sib.splice(Math.min(idx, sib.length), 0, a);
  a.parentId = pid;
  reorder(pid, sib);
  touch(id);
  renderTree();
  renderCrumbs();
}

function addArticle(pid, afterId) {
  if (!S.edit) return;
  commitEditor();
  const t = nowISO();
  const a = { id: uuid(), parentId: pid, order: 0, title: '', body: '<p><br></p>', createdAt: t, updatedAt: t, updatedBy: userName(), rev: 0 };
  const sib = childrenOf(pid);
  const idx = afterId ? sib.findIndex((x) => x.id === afterId) + 1 : sib.length;
  sib.splice(idx, 0, a);
  A.set(a.id, a);
  reorder(pid, sib);
  if (pid) S.expanded.add(pid);
  saveExpanded();
  touch(a.id);
  go(a.id);
  setTimeout(() => { const t = $('.title'); t.focus(); }, 30);
}

async function deleteArticle(id) {
  if (!S.edit) return;
  const a = A.get(id);
  const ds = descendants(id);
  const ok = await confirmModal({
    title: `「${a.title || '無題の記事'}」を削除しますか？`,
    message: ds.length
      ? `<b>子記事${ds.length}件も削除されます。</b><br>保存するまではファイルに反映されません。保存前なら、ページを再読み込みすれば元に戻せます。`
      : '保存するまではファイルに反映されません。保存前なら、ページを再読み込みすれば元に戻せます。',
    ok: ds.length ? `${ds.length + 1}件を削除` : '削除', danger: true, icon: 'trash',
  });
  if (!ok) return;
  commitEditor();
  const parent = a.parentId;
  const sib = childrenOf(parent ?? null);
  const pos = sib.findIndex((x) => x.id === id);
  for (const d of ds) { A.delete(d.id); S.touched.delete(d.id); }
  A.delete(id); S.touched.delete(id);
  reorder(parent ?? null, childrenOf(parent ?? null));
  setDirty(true);
  const deletedCur = S.cur === id || ds.some((d) => d.id === S.cur);
  if (deletedCur) {
    const rest = childrenOf(parent ?? null);
    const next = rest[Math.min(pos, rest.length - 1)] || (parent && A.get(parent)) || childrenOf(null)[0];
    S.cur = null;
    if (next) go(next.id); else { history.replaceState(null, '', location.pathname + location.search); renderAll(); }
  } else renderTree();
  toast(`${ds.length + 1}件の記事を削除しました（未保存）`);
}
