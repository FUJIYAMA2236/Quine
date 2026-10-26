// ---------- navigation ----------
function go(id) {
  if (!A.has(id)) return;
  const cur = decodeURIComponent(location.hash.slice(1));
  if (cur !== id) { location.hash = id; return; } // hashchange → show
  show(id);
}
function show(id) {
  commitEditor();
  S.cur = id;
  revealInTree(id);
  renderTree();
  renderArticle();
  $('.content').scrollTop = 0;
}

function bindGlobal() {
  addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (A.has(id) && id !== S.cur) show(id);
  });

  addEventListener('beforeunload', (e) => {
    if (S.edit) commitEditor();
    if (!S.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); save(); return; }
    if (mod && k === 'f' && !e.shiftKey) { e.preventDefault(); const q = $('#q'); q.focus(); q.select(); return; }
    if (e.key === 'F3') { e.preventDefault(); hitStep(e.shiftKey ? -1 : 1); return; }
    if (e.key === 'Escape') {
      if (floating) { closeFloating(); return; }
      if (S.search.terms.length && !S.edit && document.activeElement === document.body) clearSearch();
    }
  });

  $('.save-btn').addEventListener('click', save);
  $('#mainMenu').addEventListener('click', (e) => openMainMenu(e.currentTarget));
  $('#docMenu').addEventListener('click', (e) => { if (S.cur) openMenu(articleMenuItems(S.cur), e.currentTarget); });
  $('.edit-btn').addEventListener('click', () => (S.edit ? exitEdit() : requestEdit()));
  $('.brand').addEventListener('click', () => { const f = childrenOf(null)[0]; if (f) go(f.id); });
  $('.content').addEventListener('scroll', () => { if (floating && !floating.el.classList.contains('pop')) closeFloating(); }, { passive: true });

  // JSONファイルのドラッグ＆ドロップでインポート
  const dz = $('.dropzone');
  const jsonDrag = (e) => {
    const it = Array.from((e.dataTransfer && e.dataTransfer.items) || []);
    return it.length > 0 && it.some((i) => i.kind === 'file' && !i.type.startsWith('image/'));
  };
  addEventListener('dragover', (e) => {
    if (!jsonDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dz.classList.add('on');
  });
  addEventListener('dragleave', (e) => { if (!e.relatedTarget || e.clientX <= 0 || e.clientY <= 0) dz.classList.remove('on'); });
  addEventListener('drop', (e) => {
    dz.classList.remove('on');
    const f = Array.from((e.dataTransfer && e.dataTransfer.files) || []).find((x) => /\.json$/i.test(x.name) || x.type === 'application/json');
    if (!f) { if (e.dataTransfer && e.dataTransfer.files.length) e.preventDefault(); return; }
    e.preventDefault();
    importFile(f);
  });
}

// ---------- boot ----------
async function boot() {
  // 埋め込みデータを読み、検証してから画面を作る。壊れていたら編集画面は出さない
  const raw = readEmbedded();
  if (raw.error) { showBroken([raw.error]); return; }
  let data = raw.empty ? starterData('新しいWiki', '00000000-0000-4000-8000-000000000001') : raw.value;
  if (isEnvelope(data)) {
    try { data = await unlockData(data); } catch (e) { showBroken([e.message]); return; }
  }
  const v = validateData(data);
  if (!v.ok) { showBroken(v.errors); return; }
  loadData(v.data);
  buildShell();
  buildToolbar();
  bindEditor();
  bindTable();
  bindImages();
  bindSearch();
  bindTree();
  bindGlobal();
  loadExpanded();

  const intent = takeIntent();
  let id = decodeURIComponent(location.hash.slice(1));
  if (intent && intent.id) id = intent.id;
  if (!A.has(id)) id = childrenOf(null)[0] ? childrenOf(null)[0].id : null;
  S.cur = id;
  if (id) {
    revealInTree(id);
    if (decodeURIComponent(location.hash.slice(1)) !== id) history.replaceState(null, '', '#' + id);
  }
  if (intent) { S.edit = true; document.body.classList.add('editing'); }
  renderAll();
  if (intent) {
    if (intent.top) $('.content').scrollTop = intent.top;
    if (intent.id && !A.has(intent.id)) toast('編集しようとした記事は、最新版のファイルでは削除されていました', 'warn', 6000);
    else toast('ファイルの最新版を読み込みました。編集できます', 'ok');
  }
  if ((db.meta.version || 1) > DATA_VERSION) toast('このファイルは新しい版のQUINEで作られています。一部が正しく表示されない可能性があります', 'warn', 8000);
  for (const w of v.warnings) toast(w + '（保存すると直ります）', 'warn', 8000);
}

boot();
