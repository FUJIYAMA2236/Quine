// ---------- export / import ----------
function exportArticles(id, withChildren) {
  commitEditor();
  const root = A.get(id);
  if (!root) return;
  const list = [root, ...(withChildren ? descendants(id) : [])];
  const t = nowISO(), me = userName() || '名前未設定';
  const articles = list.map((a) => {
    const c = cleanArticle(a);
    if (S.touched.has(a.id)) { c.updatedAt = t; c.updatedBy = me; c.rev = (c.rev || 0) + 1; }
    return c;
  });
  const images = {};
  for (const k of referencedImages(list)) if (IMG[k]) images[k] = IMG[k];
  const data = { format: 'quine-articles', version: 1, exportedAt: t, from: db.meta.name, rootId: id, articles, images };
  download(JSON.stringify(data, null, 1), safeFileName(root.title || '記事') + '.json', 'application/json');
  if (CRYPT) toast(`${list.length}件の記事をエクスポートしました。書き出したファイルは暗号化されていないので、取り扱いに注意してください`, 'warn', 7000);
  else toast(`${list.length}件の記事をエクスポートしました`, 'ok');
}

function needEditForImport() {
  openModal({
    title: 'インポートは編集モードで行います', icon: 'import', tone: 'edit',
    body: '<p>取り込みの前に、ファイルの最新版を読み込み直して編集モードに入ります。<br>編集モードになったら、もう一度インポートしてください。</p>',
    actions: [{ label: 'キャンセル' }, { label: '編集モードに入る', primary: true, tone: 'edit', onClick: () => { requestEdit(); } }],
  });
}

function startImport() {
  if (!S.edit) { needEditForImport(); return; }
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => inp.files[0] && importFile(inp.files[0]);
  inp.click();
}

function importRejected(fname, errors) {
  openModal({
    title: 'このファイルは取り込めません', icon: 'warn', tone: 'warn',
    body: `<p>「${esc(fname)}」の中身に、正しくないところがありました。Wikiには何も取り込んでいません。</p><ul class="gate-list">${errors.slice(0, 20).map((m) => `<li>${esc(m)}</li>`).join('')}${errors.length > 20 ? `<li>ほか${errors.length - 20}件</li>` : ''}</ul>`,
    actions: [{ label: '閉じる', primary: true }],
  });
}

async function importFile(file) {
  if (!S.edit) { needEditForImport(); return; }
  if (file.size > MAX_IMPORT_BYTES) { importRejected(file.name, [`ファイルが大きすぎます（${fmtSize(file.size)}）`]); return; }
  let d;
  try { d = JSON.parse(await file.text()); } catch (e) { importRejected(file.name, ['JSON ファイルとして読み取れません（形が壊れています）']); return; }
  // 形・ID・画像の種類などを確かめ、ひとつでもおかしければ全体を取り込まない
  const v = validateImport(d);
  if (!v.ok) { importRejected(file.name, v.errors); return; }
  for (const w of v.warnings) toast(w, 'warn', 6000);
  commitEditor();
  showImport(v, file.name);
}

function showImport(v, fname) {
  const images = v.images;
  const items = v.articles.map((a) => ({
    id: a.id, parentId: a.parentId, title: a.title,
    body: sanitizeHTML(a.body, { images }),
    createdAt: a.createdAt || nowISO(), updatedAt: a.updatedAt || nowISO(), updatedBy: a.updatedBy || '不明', rev: a.rev,
  }));
  const dups = items.filter((it) => A.has(it.id));
  const choice = new Map();
  const box = document.createElement('div');
  const parentLabel = (it) => {
    if (it.parentId && items.some((x) => x.id === it.parentId)) return '取り込む記事の下';
    if (it.parentId && A.has(it.parentId)) return '「' + (A.get(it.parentId).title || '無題') + '」の下';
    return 'ルート直下';
  };
  box.innerHTML = `<div class="imp-summary"><span class="chip">${ic('file', 'xs')}${esc(fname)}</span><span class="chip new">新規 ${items.length - dups.length}件</span>${dups.length ? `<span class="chip dup">同じ記事あり ${dups.length}件</span>` : ''}</div>
    ${dups.length ? '<p>すでにこのWikiにある記事は、<b>左右を見比べて</b>どうするかを選んでください。</p>' : '<p>次の記事を取り込みます。</p>'}
    ${dups.length > 1 ? `<div class="imp-choice" style="border:0;background:none;padding:0 0 12px"><span class="q">まとめて：</span><button class="opt" data-all="replace">すべて置き換える</button><button class="opt" data-all="copy">すべて別記事として追加</button><button class="opt skip" data-all="skip">すべてやめる</button></div>` : ''}
    <div class="imp-list"></div>`;
  const list = box.querySelector('.imp-list');
  for (const it of items) {
    const ex = A.get(it.id);
    if (!ex) {
      list.insertAdjacentHTML('beforeend', `<div class="imp-item"><div class="imp-row"><span class="chip new">新規</span><span class="t">${esc(it.title || '無題の記事')}</span><span class="d">追加先：${esc(parentLabel(it))}</span></div></div>`);
      continue;
    }
    const newer = (a, b) => String(a) > String(b);
    const el = h(`<div class="imp-item dup" data-id="${esc(it.id)}">
      <div class="imp-row"><span class="chip dup">同じ記事あり</span><span class="t">${esc(it.title || '無題の記事')}</span></div>
      <div class="imp-cmp">
        <div class="imp-side"><h4>いまのWiki</h4><div class="who">最終更新：<b>${esc(ex.updatedBy || '不明')}</b> さん　${esc(fmtDate(ex.updatedAt, true))}${newer(ex.updatedAt, it.updatedAt) ? '<span class="newer">こちらが新しい</span>' : ''}</div>
          <div class="prose imp-prev cur"><div class="qtitle"></div><div class="b"></div></div></div>
        <div class="imp-side"><h4>取り込むファイル</h4><div class="who">最終更新：<b>${esc(it.updatedBy)}</b> さん　${esc(fmtDate(it.updatedAt, true))}${newer(it.updatedAt, ex.updatedAt) ? '<span class="newer">こちらが新しい</span>' : ''}</div>
          <div class="prose imp-prev inc"><div class="qtitle"></div><div class="b"></div></div></div>
      </div>
      <div class="imp-choice"><span class="q">どうしますか？</span>
        <button class="opt" data-c="replace">${ic('check', 'xs')}置き換える</button>
        <button class="opt" data-c="copy">${ic('plus', 'xs')}別記事として追加</button>
        <button class="opt skip" data-c="skip">${ic('x', 'xs')}やめる</button>
      </div></div>`);
    el.querySelector('.cur .qtitle').textContent = ex.title || '無題の記事';
    el.querySelector('.cur .b').innerHTML = sanitizeHTML(ex.body || '');
    el.querySelector('.inc .qtitle').textContent = it.title || '無題の記事';
    el.querySelector('.inc .b').innerHTML = it.body;
    for (const img of $$('.cur img[data-img]', el)) img.src = imgURL(img.dataset.img, IMG);
    for (const img of $$('.inc img[data-img]', el)) img.src = imgURL(img.dataset.img, IMG[img.dataset.img] ? IMG : images);
    list.appendChild(el);
  }
  let modal;
  const refresh = () => {
    $$('.imp-item.dup', box).forEach((el) => $$('.opt', el).forEach((b) => b.classList.toggle('on', choice.get(el.dataset.id) === b.dataset.c)));
    const undecided = dups.filter((it) => !choice.has(it.id)).length;
    const n = items.length - dups.length + dups.filter((it) => ['replace', 'copy'].includes(choice.get(it.id))).length;
    const btn = modal.actions[1].el;
    btn.disabled = undecided > 0 || n === 0;
    btn.textContent = undecided ? `あと${undecided}件を選んでください` : `${n}件を取り込む`;
  };
  box.addEventListener('click', (e) => {
    const all = e.target.closest('[data-all]');
    if (all) { dups.forEach((it) => choice.set(it.id, all.dataset.all)); refresh(); return; }
    const b = e.target.closest('.opt[data-c]');
    if (!b) return;
    choice.set(b.closest('.imp-item').dataset.id, b.dataset.c);
    refresh();
  });
  modal = openModal({
    title: '記事のインポート', icon: 'import', wide: dups.length > 0, body: box,
    actions: [
      { label: 'キャンセル' },
      { label: '取り込む', primary: true, onClick: () => { applyImport(items, choice, images); } },
    ],
  });
  refresh();
}

function applyImport(items, choice, images) {
  const idMap = new Map();
  for (const it of items) {
    const c = A.has(it.id) ? choice.get(it.id) : 'new';
    if (c === 'skip') continue;
    idMap.set(it.id, c === 'copy' ? uuid() : it.id);
  }
  let added = 0, replaced = 0;
  for (const it of items) {
    const c = A.has(it.id) && !idMap.has(it.id) ? 'skip' : (A.has(it.id) ? choice.get(it.id) : 'new');
    if (c === 'skip') continue;
    if (c === 'replace') {
      const ex = A.get(it.id);
      Object.assign(ex, { title: it.title, body: it.body, updatedAt: it.updatedAt, updatedBy: it.updatedBy, rev: Math.max(ex.rev || 0, it.rev || 0) });
      replaced++;
      continue;
    }
    const nid = idMap.get(it.id);
    let pid = null;
    if (it.parentId && idMap.has(it.parentId)) pid = idMap.get(it.parentId);
    else if (it.parentId && A.has(it.parentId)) pid = it.parentId;
    const order = childrenOf(pid).length;
    A.set(nid, { ...it, id: nid, parentId: pid, order, title: c === 'copy' ? (it.title || '無題の記事') + '（インポート）' : it.title });
    if (pid) S.expanded.add(pid);
    added++;
  }
  for (const k of referencedImages(items)) if (!IMG[k] && images[k]) IMG[k] = images[k];
  saveExpanded();
  setDirty(true);
  const first = items.find((it) => idMap.has(it.id));
  if (first && A.has(idMap.get(first.id))) { S.cur = null; go(idMap.get(first.id)); } else renderAll();
  toast(`${added ? `${added}件を追加` : ''}${added && replaced ? '、' : ''}${replaced ? `${replaced}件を置き換え` : ''}しました。保存するとファイルに反映されます`, 'ok', 5500);
}

// ---------- new wiki / settings / about ----------
function newWikiDialog() {
  openModal({
    title: '新規Wiki開設', icon: 'book',
    body: `<p>このアプリをそのまま複製して、記事が空の新しいWikiファイルを作ります。いま開いているWikiには影響しません。</p>
      <div class="form-row"><label for="wn">Wiki名</label><input class="field" id="wn" maxlength="60" placeholder="例：総務課ナレッジ"><div class="help">ファイル名にも使われます。保存先を選んで保存してください。</div></div>`,
    actions: [
      { label: 'キャンセル' },
      {
        label: '作成してダウンロード', primary: true, icon: 'import', onClick: (close, b) => {
          const v = $('#wn', b).value.trim();
          if (!v) { $('#wn', b).focus(); return false; }
          download(buildHTML(starterData(v)), safeFileName(v) + '.html');
          toast(`「${safeFileName(v)}.html」を作成しました。開くと新しいWikiが使えます`, 'ok', 5000);
        },
      },
    ],
  });
}

function settingsDialog() {
  const dis = S.edit ? '' : 'disabled';
  openModal({
    title: '設定', icon: 'settings',
    body: `<div class="form-row"><label for="st-name">あなたの名前</label><input class="field" id="st-name" maxlength="40" value="${esc(userName())}" placeholder="例：山田"><div class="help">記事の「最終更新者」として記録されます。この端末（ブラウザ）にだけ保存されます。</div></div>
      <div class="form-row"><label for="st-wiki">Wiki名</label><input class="field" id="st-wiki" maxlength="60" value="${esc(db.meta.name)}" ${dis}><div class="help">${S.edit ? '変更すると未保存の状態になります。' : '編集モードで変更できます。'}</div></div>
      <div class="set-sec">${ic('lock', 'sm')}セキュリティ${S.edit ? '' : '<span>（編集モードで変更できます）</span>'}</div>
      <div class="form-row"><label for="st-hosts">信頼する社内サーバ（ファイルリンク用）</label>
        <textarea class="field area" id="st-hosts" rows="3" placeholder="例：fileserver01" ${dis}>${esc((db.meta.trustedHosts || []).join('\n'))}</textarea>
        <div class="help">「\\\\サーバ名\\…」のリンクを開くとき、ここにないサーバには強い警告を出します。1行に1つずつ、サーバ名だけを書いてください。</div></div>
      <div class="form-row"><label>パスワード保護</label>
        <div class="pw-state ${CRYPT ? 'on' : ''}">${ic('lock', 'sm')}<span>${CRYPT ? '保護されています（保存したファイルは暗号化されます）' : '保護されていません'}</span></div>
        <div class="pw-btns"><button class="btn" data-pw="set" ${dis}>${CRYPT ? 'パスワードを変更する' : 'パスワードで保護する'}</button>${CRYPT ? `<button class="btn ghost" data-pw="off" ${dis}>保護を外す</button>` : ''}</div></div>
      <div class="form-err" role="alert"></div>`,
    onOpen: (b, close) => {
      b.addEventListener('click', (e) => {
        const p = e.target.closest('[data-pw]');
        if (!p) return;
        close();
        if (p.dataset.pw === 'set') passwordDialog(); else removeProtection();
      });
    },
    actions: [
      { label: 'キャンセル' },
      {
        label: '保存', primary: true, onClick: (close, b) => {
          const hosts = $('#st-hosts', b).value.split(/\r?\n/).map((s) => s.trim().replace(/^\\\\/, '').replace(/[\\/].*$/, '')).filter(Boolean);
          const bad = hosts.filter((h) => !HOST_RE.test(h));
          if (S.edit && bad.length) { $('.form-err', b).textContent = `サーバ名として正しくないものがあります：${bad.join('、')}`; return false; }
          const n = $('#st-name', b).value.trim();
          if (n) setUserName(n);
          const w = $('#st-wiki', b).value.trim();
          if (S.edit && w && w !== db.meta.name) { db.meta.name = w; setDirty(true); renderAll(); }
          const hs = [...new Set(hosts.map((h) => h.toLowerCase()))];
          if (S.edit && hs.join('\n') !== (db.meta.trustedHosts || []).join('\n')) { db.meta.trustedHosts = hs; setDirty(true); }
          toast('設定を保存しました', 'ok');
        },
      },
    ],
  });
}

function aboutDialog() {
  const used = referencedImages(A.values()).size;
  openModal({
    title: 'このツールについて', icon: 'info',
    body: `<div class="about">${LOGO}<h3>QUINE</h3>
      <div class="acr"><b>Q</b>UINE <b>U</b>nfolds <b>I</b>ts <b>N</b>ested <b>E</b>ntries — 自分自身を複製する「クワイン」と、入れ子の記事にちなむ名前です。</div>
      <div class="desc">HTMLファイル1枚に、アプリと記事のすべてが入っています。サーバもインターネット接続も使いません。<br>
      記事 <b>${A.size}</b> 件 ・ 画像 <b>${used}</b> 枚 ・ アプリ v${APP_VERSION}（データ形式 v${DATA_VERSION}）${db.meta.savedAt ? `<br>最終保存：${esc(fmtDate(db.meta.savedAt, true))}` : ''}</div>
      <div class="fp"><div class="fp-h">${ic('check', 'sm')}アプリの指紋（SHA-256）</div><code class="fp-val">計算しています…</code>
        <div class="fp-help">記事を除いたプログラム部分から計算した値です。GitHub の FINGERPRINT.txt に載っている値と同じなら、プログラムは配布されたものから書き換えられていません。より確実に調べるときは、README の手順でファイルを外から確かめてください。</div></div>
      <p style="font-size:11.5px;color:var(--faint);margin:12px 0 0;text-align:left">アイコンは Lucide（ISC License, © Lucide Icons and Contributors。一部は Feather 由来で MIT License, © Cole Bemis）を参考にしています。画像の重複判定は cyrb53（© bryc, Public domain）を元にしています。ライセンス文の全文はこのファイルの先頭に記載しています。</p></div>`,
    actions: [{ label: '閉じる', primary: true }],
    onOpen: (b) => {
      appFingerprint().then((fp) => { $('.fp-val', b).textContent = fp || 'このブラウザでは計算できません'; }, () => { $('.fp-val', b).textContent = '計算できませんでした'; });
    },
  });
}

function openMainMenu(btn) {
  let size = 0;
  try {
    size = new Blob([buildHTML(dataObject())]).size;
    if (CRYPT) size = Math.round(TEMPLATE.length + (size - TEMPLATE.length) * 1.34); // 暗号化すると約1.3倍になる（目安）
  } catch (e) { size = 0; }
  openMenu([
    { label: 'インポート…', icon: 'import', hint: S.edit ? '' : '編集モード', onClick: startImport },
    { label: '新規Wiki開設…', icon: 'book', onClick: newWikiDialog },
    '-',
    { label: '設定…', icon: 'settings', onClick: settingsDialog },
    { label: 'このツールについて', icon: 'info', onClick: aboutDialog },
    '-',
    { html: `<div class="mfoot">${ic('db', 'sm')}<span>ファイルサイズ</span><b style="margin-left:auto">${CRYPT ? '約 ' : ''}${fmtSize(size)}</b></div>` },
    CRYPT ? { html: `<div class="mfoot">${ic('lock', 'sm')}<span>パスワードで保護されています</span></div>` } : null,
  ], btn);
}
