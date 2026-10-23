// ---------- table block（Excel風のグリッド） ----------
// 本文中では <div class="qtable"><table><colgroup>…</colgroup><tbody>…</tbody></table></div> として保存する。
const T = { wrap: null, r: 0, c: 0, ar: 0, ac: 0, mode: '', kind: '', orig: '' };
const DEF_COL_W = 140;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function tbl(w = T.wrap) { return w && w.querySelector('table'); }
function dims(w = T.wrap) { const t = tbl(w); return t ? [t.rows.length, t.rows[0] ? t.rows[0].cells.length : 0] : [0, 0]; }
function cellAt(w, r, c) { const t = tbl(w); const row = t && t.rows[r]; return row ? row.cells[c] : null; }
function curCell() { return T.wrap ? cellAt(T.wrap, T.r, T.c) : null; }
function rangeBox() { return { r0: Math.min(T.ar, T.r), r1: Math.max(T.ar, T.r), c0: Math.min(T.ac, T.c), c1: Math.max(T.ac, T.c) }; }
function rangeCells() {
  const b = rangeBox(), out = [];
  for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) { const td = cellAt(T.wrap, r, c); if (td) out.push(td); }
  return out;
}
function tableReadyActive() { return !!(T.wrap && T.mode === 'ready'); }

function textToCellHTML(s) { return esc(s).replace(/\n/g, '<br>'); }

function parseTSV(text) {
  text = text.replace(/\r\n?/g, '\n');
  if (text.endsWith('\n')) text = text.slice(0, -1);
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows;
}
function cellText(td) {
  const c = td.cloneNode(true);
  $$('br', c).forEach((b) => b.replaceWith('\n'));
  return c.textContent;
}
function toTSV(cells2d) {
  return cells2d.map((row) => row.map((td) => {
    const t = cellText(td);
    return /[\t\n"]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }).join('\t')).join('\r\n');
}

function makeTable(grid, widths, header) {
  const nc = Math.max(1, ...grid.map((r) => r.length));
  const w = document.createElement('div');
  w.className = 'qtable';
  if (header) w.dataset.header = '1';
  const t = document.createElement('table');
  const cg = document.createElement('colgroup');
  for (let c = 0; c < nc; c++) { const col = document.createElement('col'); col.style.width = (widths[c] || DEF_COL_W) + 'px'; cg.appendChild(col); }
  t.appendChild(cg);
  const tb = document.createElement('tbody');
  for (const row of grid.length ? grid : [['']]) {
    const tr = tb.insertRow();
    for (let c = 0; c < nc; c++) tr.insertCell().innerHTML = row[c] || '';
  }
  t.appendChild(tb);
  w.appendChild(t);
  fixTableWidth(w);
  return w;
}

function tableFromElement(src) {
  const grid = [];
  let header = false;
  Array.from(src.rows || []).forEach((tr, i) => {
    const row = [];
    for (const td of tr.cells) row.push(sanitizeHTML(td.innerHTML, { cell: true }).trim());
    if (i === 0 && tr.cells.length && Array.from(tr.cells).every((c) => c.tagName === 'TH')) header = true;
    grid.push(row);
  });
  const widths = [];
  const cols = src.querySelectorAll('col');
  cols.forEach((col, i) => { const v = parseInt(col.style.width || col.getAttribute('width'), 10); if (v) widths[i] = clamp(v, 40, 800); });
  return makeTable(grid, widths, header);
}

function fixTableWidth(w) {
  const t = tbl(w);
  if (!t) return;
  let nc = 0;
  for (const r of t.rows) nc = Math.max(nc, r.cells.length);
  for (const r of t.rows) while (r.cells.length < nc) r.insertCell(-1);
  let cg = t.querySelector('colgroup');
  if (!cg) { cg = document.createElement('colgroup'); t.prepend(cg); }
  while (cg.children.length < nc) { const col = document.createElement('col'); col.style.width = DEF_COL_W + 'px'; cg.appendChild(col); }
  while (cg.children.length > nc) cg.lastElementChild.remove();
  let sum = 0;
  for (const col of cg.children) { const v = parseInt(col.style.width, 10) || DEF_COL_W; col.style.width = v + 'px'; sum += v; }
  t.style.width = sum + 'px';
}

function insertTableBlock(grid, opts = {}) {
  if (!grid.length) return;
  const nc = Math.max(...grid.map((r) => r.length));
  const avail = Math.max(300, ed.clientWidth - 24);
  const cw = clamp(Math.floor(avail / nc), 80, 220);
  const el = makeTable(grid.map((r) => r.map(textToCellHTML)), Array(nc).fill(cw), opts.header);
  ed.focus();
  if (!selRange()) restoreRange();
  edit(() => insertBlock(el));
  tableActivate(el, 0, 0);
}

// ---------- activation / editing ----------
function tableActivate(w, r, c, { extend = false } = {}) {
  if (T.wrap && T.wrap !== w) tableDeactivate();
  tableCommit();
  const [nr, nc] = dims(w);
  if (!nr || !nc) return;
  r = clamp(r, 0, nr - 1); c = clamp(c, 0, nc - 1);
  const old = curCell();
  if (old) { old.removeAttribute('contenteditable'); old.classList.remove('qact', 'qedit'); }
  T.wrap = w; T.r = r; T.c = c;
  if (!extend) { T.ar = r; T.ac = c; }
  T.mode = 'ready';
  w.classList.add('qready');
  const cell = curCell();
  cell.contentEditable = 'true';
  cell.classList.add('qact');
  cell.focus({ preventScroll: true });
  // 待機中はセルの中身を（見えない形で）選択しておく。
  // こうしておけば、最初のキー入力や日本語入力が始まった瞬間に選択範囲をいじらずに済み、
  // そのまま中身が置き換わる（入力の途中で選択を動かすとIMEの変換が切れてしまう）。
  const rg = document.createRange(); rg.selectNodeContents(cell);
  const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
  cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  paintSel();
  showTableUI(w);
  updateToolbar();
}
function paintSel() {
  if (!T.wrap) return;
  $$('td.qsel', T.wrap).forEach((td) => td.classList.remove('qsel'));
  if (T.ar === T.r && T.ac === T.c) return;
  rangeCells().forEach((td) => td.classList.add('qsel'));
}
function tableDeactivate() {
  if (!T.wrap) return;
  tableCommit();
  const w = T.wrap;
  const cell = curCell();
  if (cell) { cell.removeAttribute('contenteditable'); cell.classList.remove('qact', 'qedit'); }
  $$('td.qsel', w).forEach((td) => td.classList.remove('qsel'));
  w.classList.remove('qready');
  T.wrap = null; T.mode = '';
  hideTableUI(w);
}
function tableStartEdit(kind, selectAll, caret) {
  const cell = curCell();
  if (!cell) return;
  hSnapshot();
  T.mode = 'edit'; T.kind = kind; T.orig = cell.innerHTML;
  T.ar = T.r; T.ac = T.c; paintSel();
  cell.classList.add('qedit');
  T.wrap.classList.remove('qready');
  const s = getSelection();
  if (caret) { s.removeAllRanges(); s.addRange(caret); return; }
  if (selectAll && cellFullySelected(cell)) return; // すでに全選択済みなら触らない
  const rg = document.createRange(); rg.selectNodeContents(cell);
  if (!selectAll) rg.collapse(false);
  s.removeAllRanges(); s.addRange(rg);
}
function cellFullySelected(cell) {
  const s = getSelection();
  if (!s.rangeCount) return false;
  const r = s.getRangeAt(0);
  const all = document.createRange(); all.selectNodeContents(cell);
  return cell.contains(r.commonAncestorContainer) || r.commonAncestorContainer === cell
    ? r.compareBoundaryPoints(Range.START_TO_START, all) <= 0 && r.compareBoundaryPoints(Range.END_TO_END, all) >= 0
    : false;
}
function tableCommit() {
  if (!T.wrap || T.mode !== 'edit') return;
  const cell = curCell();
  T.mode = 'ready';
  if (!cell) return;
  cell.classList.remove('qedit');
  T.wrap.classList.add('qready');
  if (/<(?!\/?(strong|b|span|a|br)\b)[a-z]/i.test(cell.innerHTML)) cell.innerHTML = sanitizeHTML(cell.innerHTML, { cell: true });
  if (cell.innerHTML === '<br>') cell.innerHTML = '';
  if (cell.innerHTML !== T.orig) { touch(S.cur); hSnapshot(); }
  showTableUI(T.wrap);
}
function tableCancelEdit() {
  const cell = curCell();
  if (!cell) return;
  cell.innerHTML = T.orig;
  T.mode = 'ready';
  cell.classList.remove('qedit');
  T.wrap.classList.add('qready');
  tableActivate(T.wrap, T.r, T.c);
}
function exitTable(dir) {
  const w = T.wrap;
  tableDeactivate();
  normalize();
  const p = dir === 'before' ? w.previousElementSibling : w.nextElementSibling;
  if (!p) return;
  ed.focus();
  if (dir === 'before') { const rg = document.createRange(); rg.selectNodeContents(p); rg.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); }
  else setCaret(p, 0);
}
function tableMove(r, c, extend) { tableActivate(T.wrap, r, c, { extend }); }
function tableTab(back) {
  const [nr, nc] = dims();
  let r = T.r, c = T.c + (back ? -1 : 1);
  if (c >= nc) { c = 0; r++; }
  if (c < 0) { c = nc - 1; r--; }
  if (r < 0) { r = 0; c = 0; }
  if (r >= nr) { tableOp('insertRow', nr); r = nr; c = 0; }
  tableMove(r, c, false);
}

function tableKey(e) {
  if (!T.wrap) {
    const td = e.target.closest && e.target.closest('td');
    if (!td) return;
    tableActivate(td.closest('.qtable'), td.parentNode.rowIndex, td.cellIndex);
  }
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key;
  const [nr, nc] = dims();
  if (T.mode === 'edit') {
    if (e.isComposing || e.keyCode === 229) return;
    if (k === 'Enter' && e.altKey) { e.preventDefault(); document.execCommand('insertLineBreak'); return; }
    if (k === 'Enter') { e.preventDefault(); tableCommit(); tableMove(T.r + (e.shiftKey ? -1 : 1), T.c, false); return; }
    if (k === 'Tab') { e.preventDefault(); tableCommit(); tableTab(e.shiftKey); return; }
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); tableCancelEdit(); return; }
    if (T.kind === 'type' && /^Arrow/.test(k) && !e.shiftKey && !mod) {
      e.preventDefault(); tableCommit();
      const dr = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0, dc = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
      tableMove(T.r + dr, T.c + dc, false); return;
    }
    if (mod && /^[iu]$/i.test(k)) { e.preventDefault(); return; }
    return;
  }
  // ready
  if (e.isComposing || e.keyCode === 229) { tableStartEdit('type', true); return; }
  if (/^Arrow/.test(k)) {
    e.preventDefault();
    const dr = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0, dc = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
    if (!e.shiftKey && !mod) {
      if (dr === -1 && T.r === 0) { exitTable('before'); return; }
      if (dr === 1 && T.r === nr - 1) { exitTable('after'); return; }
    }
    let r = T.r + dr, c = T.c + dc;
    if (mod) { r = dr < 0 ? 0 : dr > 0 ? nr - 1 : T.r; c = dc < 0 ? 0 : dc > 0 ? nc - 1 : T.c; }
    tableMove(r, c, e.shiftKey);
    return;
  }
  if (k === 'Tab') { e.preventDefault(); tableTab(e.shiftKey); return; }
  if (k === 'Enter') { e.preventDefault(); tableMove(T.r + (e.shiftKey ? -1 : 1), T.c, false); return; }
  if (k === 'F2') { e.preventDefault(); tableStartEdit('f2', false); return; }
  if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); exitTable('after'); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); edit(() => rangeCells().forEach((td) => { td.innerHTML = ''; })); showTableUI(T.wrap); return; }
  if (mod) {
    const kk = k.toLowerCase();
    if (kk === 'a') { e.preventDefault(); T.ar = 0; T.ac = 0; tableMove(nr - 1, nc - 1, true); return; }
    if (kk === 'b') { e.preventDefault(); tableFormat('bold'); return; }
    if (kk === 'c' || kk === 'x' || kk === 'v') return;
    e.preventDefault();
    return;
  }
  if (k.length === 1 && !e.altKey) { tableStartEdit('type', true); return; }
  if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(k)) e.preventDefault();
}

// ---------- clipboard ----------
function tableCopy(e, cut) {
  if (!tableReadyActive()) return;
  e.preventDefault();
  const b = rangeBox(), rows = [];
  for (let r = b.r0; r <= b.r1; r++) { const row = []; for (let c = b.c0; c <= b.c1; c++) row.push(cellAt(T.wrap, r, c)); rows.push(row); }
  e.clipboardData.setData('text/plain', toTSV(rows));
  e.clipboardData.setData('text/html', '<table>' + rows.map((r) => '<tr>' + r.map((td) => `<td>${td.innerHTML}</td>`).join('') + '</tr>').join('') + '</table>');
  if (cut) { edit(() => rangeCells().forEach((td) => { td.innerHTML = ''; })); showTableUI(T.wrap); }
}
function tablePaste(e) {
  if (!T.wrap) return;
  const cd = e.clipboardData;
  const text = cd.getData('text/plain') || '', html = cd.getData('text/html') || '';
  e.preventDefault();
  let grid = null;
  const trimmed = text.replace(/\r?\n$/, '');
  if (trimmed.includes('\t') || trimmed.includes('\n')) grid = parseTSV(text).map((r) => r.map(textToCellHTML));
  else if (/<table/i.test(html)) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const t = doc.querySelector('table');
    grid = Array.from(t.rows).map((tr) => Array.from(tr.cells).map((td) => sanitizeHTML(td.innerHTML, { cell: true }).trim()));
  }
  if (T.mode === 'edit' && (!grid || (grid.length === 1 && grid[0].length === 1))) {
    const clean = html && !grid ? sanitizeHTML(html, { cell: true }) : textToCellHTML(trimmed);
    document.execCommand('insertHTML', false, clean);
    return;
  }
  if (!grid) grid = [[html ? sanitizeHTML(html, { cell: true }).trim() : textToCellHTML(trimmed)]];
  tableCommit();
  const w = T.wrap, b = rangeBox();
  const r0 = b.r0, c0 = b.c0;
  const gw = Math.max(...grid.map((r) => r.length));
  edit(() => {
    let [nr, nc] = dims(w);
    while (nr < r0 + grid.length) { addRow(w, nr); nr++; }
    while (nc < c0 + gw) { addCol(w, nc); nc++; }
    grid.forEach((row, i) => row.forEach((v, j) => { cellAt(w, r0 + i, c0 + j).innerHTML = v; }));
    fixTableWidth(w);
  });
  T.ar = r0; T.ac = c0;
  tableActivate(w, r0 + grid.length - 1, c0 + gw - 1, { extend: true });
}

// ---------- cell formatting ----------
function cellIsBold(td) {
  const t = td.textContent.replace(/\s/g, '');
  if (!t) return true;
  return $$('strong,b', td).map((x) => x.textContent).join('').replace(/\s/g, '') === t;
}
function tableCellsAre(kind) { return kind === 'bold' && rangeCells().every(cellIsBold) && rangeCells().some((td) => td.textContent.trim()); }
function tableFormat(kind) {
  if (kind !== 'bold' || !T.wrap) return;
  const cells = rangeCells();
  const allBold = tableCellsAre('bold');
  edit(() => {
    for (const td of cells) {
      $$('strong,b', td).forEach(unwrap);
      if (!allBold && td.textContent.trim()) {
        const s = document.createElement('strong');
        while (td.firstChild) s.appendChild(td.firstChild);
        td.appendChild(s);
      }
    }
  });
  tableActivate(T.wrap, T.r, T.c, { extend: true });
}
function tableColor(c) {
  if (!T.wrap) return;
  edit(() => {
    for (const td of rangeCells()) {
      $$('span', td).forEach((sp) => { sp.style.color = ''; if (!sp.getAttribute('style')) unwrap(sp); });
      if (c && td.textContent.trim()) {
        const sp = document.createElement('span'); sp.style.color = c;
        while (td.firstChild) sp.appendChild(td.firstChild);
        td.appendChild(sp);
      }
    }
  });
  tableActivate(T.wrap, T.r, T.c, { extend: true });
}

// ---------- structure ----------
function addRow(w, idx) {
  const t = tbl(w), nc = dims(w)[1];
  const tr = t.tBodies[0].insertRow(idx);
  for (let c = 0; c < nc; c++) tr.insertCell();
}
function addCol(w, idx) {
  const t = tbl(w);
  const cg = t.querySelector('colgroup');
  const ref = cg.children[Math.min(idx, cg.children.length - 1)];
  const col = document.createElement('col');
  col.style.width = (ref ? parseInt(ref.style.width, 10) || DEF_COL_W : DEF_COL_W) + 'px';
  cg.insertBefore(col, cg.children[idx] || null);
  for (const tr of t.rows) tr.insertCell(idx);
  fixTableWidth(w);
}
function moveChild(parent, list, from, to) {
  const [el] = list.splice(from, 1);
  list.splice(to, 0, el);
  list.forEach((n) => parent.appendChild(n));
}
function tableOp(op, a, b, w = T.wrap) {
  if (!w) return;
  const [nr, nc] = dims(w);
  const t = tbl(w);
  if ((op === 'deleteRow' && nr <= 1) || (op === 'deleteCol' && nc <= 1)) {
    toast('最後の1行・1列は削除できません。表ごと消すときは表メニューから削除してください', 'warn', 4500);
    return;
  }
  const active = T.wrap === w;
  edit(() => {
    if (op === 'insertRow') addRow(w, a);
    else if (op === 'insertCol') addCol(w, a);
    else if (op === 'deleteRow') t.rows[a].remove();
    else if (op === 'deleteCol') { t.querySelector('colgroup').children[a].remove(); for (const tr of t.rows) tr.cells[a].remove(); }
    else if (op === 'moveRow') moveChild(t.tBodies[0], Array.from(t.rows), a, b);
    else if (op === 'moveCol') {
      const cg = t.querySelector('colgroup');
      moveChild(cg, Array.from(cg.children), a, b);
      for (const tr of t.rows) moveChild(tr, Array.from(tr.cells), a, b);
    }
    fixTableWidth(w);
  });
  if (active) {
    T.wrap = w;
    const [r2, c2] = dims(w);
    let r = T.r, c = T.c;
    if (op === 'insertRow' && a <= r) r++;
    if (op === 'insertCol' && a <= c) c++;
    if (op === 'moveRow') r = b; if (op === 'moveCol') c = b;
    $$('td[contenteditable]', w).forEach((td) => { td.removeAttribute('contenteditable'); td.classList.remove('qact', 'qedit'); });
    tableActivate(w, clamp(r, 0, r2 - 1), clamp(c, 0, c2 - 1));
  } else showTableUI(w);
}
function tableToggleHeader(w) {
  edit(() => { if (w.dataset.header === '1') delete w.dataset.header; else w.dataset.header = '1'; });
  showTableUI(w);
}
function tableDelete(w) {
  if (T.wrap === w) tableDeactivate();
  edit(() => {
    const next = w.nextElementSibling;
    w.remove();
    if (next) setCaret(next, 0);
  });
  toast('表を削除しました（Ctrl+Z で元に戻せます）');
}

// ---------- overlay UI (handles, +, resize grips) ----------
// 取っ手類は本文（編集領域）の外にある重ね合わせ層に描く。
// 編集領域の中をいじると日本語入力（IME）の変換やカーソル位置が乱れるため。
let layer = null;
let layerObs = null;
function tableLayer() {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement('div');
  layer.className = 'qt-layer';
  $('.doc').appendChild(layer);
  layer.addEventListener('mousedown', tableUIDown);
  layer.addEventListener('mouseleave', (e) => {
    if (layer._w && layer._w !== T.wrap && !(e.relatedTarget && layer._w.contains(e.relatedTarget))) hideTableUI(layer._w);
  });
  layerObs = new ResizeObserver(() => {
    if (!layer || !layer._w) return;
    if (S.composing) { layer._pending = true; return; } // 変換中は描き直さない（終わってからまとめて）
    showTableUI(layer._w);
  });
  return layer;
}
function hideTableUI(w) {
  if (!layer || (w && layer._w !== w)) return;
  layer._w = null;
  layer.innerHTML = '';
  layer.style.display = 'none';
  if (layerObs) layerObs.disconnect();
}
function showTableUI(w) {
  if (!S.edit || !w || !w.isConnected) return;
  const t = tbl(w);
  if (!t || !t.rows[0]) return;
  const ui = tableLayer();
  if (ui._w !== w) {
    layerObs.disconnect();
    layerObs.observe(w); layerObs.observe(t);
  }
  ui._w = w;
  const dr = $('.doc').getBoundingClientRect(), wr = w.getBoundingClientRect(), tr = t.getBoundingClientRect();
  Object.assign(ui.style, { display: 'block', left: wr.left - dr.left + 'px', top: wr.top - dr.top + 'px', width: wr.width + 'px', height: wr.height + 'px' });
  // 座標はすべて「表ブロックの左上」からの見た目の位置（横スクロールも反映される）
  const ox = tr.left - wr.left, oy = tr.top - wr.top, tw = tr.width, th = tr.height;
  const first = t.rows[0];
  let s = '<div class="qt-corner" data-ui="corner" title="表のメニュー"></div>';
  const xs = [];
  for (let c = 0; c < first.cells.length; c++) xs.push(first.cells[c].getBoundingClientRect().left - wr.left);
  xs.push(ox + tw);
  for (let c = 0; c < first.cells.length; c++) {
    const on = T.wrap === w && c >= rangeBox().c0 && c <= rangeBox().c1 && rangeBox().r0 === 0 && rangeBox().r1 === t.rows.length - 1;
    s += `<div class="qt-colh ${on ? 'on' : ''}" data-ui="col" data-i="${c}" style="left:${xs[c] + 3}px;width:${xs[c + 1] - xs[c] - 6}px" title="クリック：列のメニュー／ドラッグ：列の移動"></div>`;
    s += `<div class="qt-grip" data-ui="grip" data-i="${c}" style="left:${xs[c + 1]}px;top:${oy}px;height:${th}px" title="ドラッグで列幅を変更"></div>`;
  }
  for (let c = 0; c <= first.cells.length; c++) {
    s += `<div class="qt-addzone" data-ui="addcol" data-i="${c}" style="left:${xs[c] - 8}px;top:0;width:16px;height:${oy}px" title="列を挿入"><div class="qt-line" style="left:7px;top:${oy}px;width:2px;height:${th}px"></div><div class="qt-add" style="left:8px;top:10px"></div></div>`;
  }
  const ys = [];
  for (let r = 0; r < t.rows.length; r++) ys.push(t.rows[r].getBoundingClientRect().top - wr.top);
  ys.push(oy + th);
  for (let r = 0; r < t.rows.length; r++) {
    s += `<div class="qt-rowh" data-ui="row" data-i="${r}" style="top:${ys[r] + 3}px;height:${ys[r + 1] - ys[r] - 6}px" title="クリック：行のメニュー／ドラッグ：行の移動"></div>`;
  }
  for (let r = 0; r <= t.rows.length; r++) {
    s += `<div class="qt-addzone" data-ui="addrow" data-i="${r}" style="top:${ys[r] - 8}px;left:0;height:16px;width:${ox}px" title="行を挿入"><div class="qt-line" style="top:7px;left:${ox}px;height:2px;width:${tw}px"></div><div class="qt-add" style="top:8px;left:10px"></div></div>`;
  }
  ui.innerHTML = s;
  ui._xs = xs; ui._ys = ys;
}

function selectLine(w, kind, i) {
  const [nr, nc] = dims(w);
  if (T.wrap !== w) tableActivate(w, 0, 0);
  if (kind === 'col') { T.ar = 0; T.ac = i; tableActivate(w, nr - 1, i, { extend: true }); }
  else { T.ar = i; T.ac = 0; tableActivate(w, i, nc - 1, { extend: true }); }
}

function lineMenu(w, kind, i) {
  return kind === 'col' ? [
    { label: '左に列を挿入', icon: 'plus', onClick: () => tableOp('insertCol', i, 0, w) },
    { label: '右に列を挿入', icon: 'plus', onClick: () => tableOp('insertCol', i + 1, 0, w) },
    '-',
    { label: 'この列を削除', icon: 'trash', danger: true, onClick: () => tableOp('deleteCol', i, 0, w) },
  ] : [
    { label: '上に行を挿入', icon: 'plus', onClick: () => tableOp('insertRow', i, 0, w) },
    { label: '下に行を挿入', icon: 'plus', onClick: () => tableOp('insertRow', i + 1, 0, w) },
    '-',
    { label: 'この行を削除', icon: 'trash', danger: true, onClick: () => tableOp('deleteRow', i, 0, w) },
  ];
}

function tableUIDown(e) {
  const el = e.target.closest('[data-ui]');
  if (!el) return;
  e.preventDefault();
  e.stopPropagation();
  const ui = layer;
  const w = ui._w;
  if (!w) return;
  const kind = el.dataset.ui, i = +el.dataset.i;
  if (kind === 'addcol') { tableOp('insertCol', i, 0, w); return; }
  if (kind === 'addrow') { tableOp('insertRow', i, 0, w); return; }
  if (kind === 'corner') {
    openMenu([
      { header: true, label: '表' },
      { label: '1行目を見出しにする', icon: 'rows', check: w.dataset.header === '1', onClick: () => tableToggleHeader(w) },
      { label: 'すべてのセルを選択', icon: 'table', onClick: () => { const [nr, nc] = dims(w); tableActivate(w, 0, 0); T.ar = 0; T.ac = 0; tableActivate(w, nr - 1, nc - 1, { extend: true }); } },
      '-',
      { label: '表を削除', icon: 'trash', danger: true, onClick: () => tableDelete(w) },
    ], el);
    return;
  }
  if (kind === 'grip') {
    const col = tbl(w).querySelector('colgroup').children[i];
    const startX = e.clientX, startW = parseInt(col.style.width, 10) || DEF_COL_W;
    hSnapshot();
    el.classList.add('drag');
    const move = (ev) => { col.style.width = clamp(startW + ev.clientX - startX, 40, 1200) + 'px'; fixTableWidth(w); showTableUI(w); };
    const up = () => {
      removeEventListener('mousemove', move); removeEventListener('mouseup', up);
      touch(S.cur); hSnapshot(); showTableUI(w);
    };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
    return;
  }
  if (kind === 'col' || kind === 'row') {
    const startX = e.clientX, startY = e.clientY;
    let dragging = false, target = i, ind = null;
    const marks = kind === 'col' ? ui._xs : ui._ys;
    const t = tbl(w);
    const move = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
      dragging = true;
      const wr = w.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      const pos = kind === 'col' ? ev.clientX - wr.left : ev.clientY - wr.top;
      let best = 0;
      for (let k = 0; k < marks.length; k++) if (Math.abs(marks[k] - pos) < Math.abs(marks[best] - pos)) best = k;
      target = best;
      if (!ind) { ind = document.createElement('div'); ind.className = 'qt-drop'; ui.appendChild(ind); }
      if (kind === 'col') Object.assign(ind.style, { left: marks[best] - 1.5 + 'px', top: tr.top - wr.top + 'px', width: '3px', height: tr.height + 'px' });
      else Object.assign(ind.style, { top: marks[best] - 1.5 + 'px', left: tr.left - wr.left + 'px', height: '3px', width: tr.width + 'px' });
    };
    const up = () => {
      removeEventListener('mousemove', move); removeEventListener('mouseup', up);
      if (ind) ind.remove();
      if (!dragging) {
        selectLine(w, kind, i);
        const anchor = layer.querySelector(`.qt-${kind}h[data-i="${i}"]`) || el;
        openMenu(lineMenu(w, kind, i), anchor);
        return;
      }
      let to = target > i ? target - 1 : target;
      if (to !== i) tableOp(kind === 'col' ? 'moveCol' : 'moveRow', i, to, w);
    };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
  }
}

function bindTable() {
  ed.addEventListener('mousedown', (e) => {
    if (!S.edit) return;
    const td = e.target.closest('.qtable td');
    if (!td) { if (T.wrap) tableDeactivate(); return; }
    const w = td.closest('.qtable');
    const r = td.parentNode.rowIndex, c = td.cellIndex;
    if (T.wrap === w && T.mode === 'edit' && T.r === r && T.c === c) return;
    if (e.button !== 0) return;
    e.preventDefault();
    if (e.detail >= 2 && T.wrap === w && T.r === r && T.c === c) {
      const cr = document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY);
      tableStartEdit('f2', false, cr && td.contains(cr.startContainer) ? cr : null);
      return;
    }
    tableActivate(w, r, c, { extend: e.shiftKey && T.wrap === w });
    const move = (ev) => {
      const t2 = document.elementFromPoint(ev.clientX, ev.clientY);
      const td2 = t2 && t2.closest && t2.closest('td');
      if (td2 && td2.closest('.qtable') === w) {
        const r2 = td2.parentNode.rowIndex, c2 = td2.cellIndex;
        if (r2 !== T.r || c2 !== T.c) tableActivate(w, r2, c2, { extend: true });
      }
    };
    const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
  });
  // 取っ手は「マウスが乗っている表」か「操作中の表」に1つだけ出す
  ed.addEventListener('mouseover', (e) => {
    if (!S.edit) return;
    const w = e.target.closest && e.target.closest('.qtable');
    const cur = layer && layer._w;
    if (w && w !== cur && !T.wrap) showTableUI(w);
    else if (!w && cur && cur !== T.wrap) hideTableUI(cur);
  });
  ed.addEventListener('mouseleave', (e) => {
    if (layer && e.relatedTarget && layer.contains(e.relatedTarget)) return;
    if (layer && layer._w && layer._w !== T.wrap) hideTableUI(layer._w);
  });
  // 表ブロックの横スクロールに取っ手を追従させる
  ed.addEventListener('scroll', (e) => { if (layer && e.target === layer._w) showTableUI(layer._w); }, true);
  ed.addEventListener('contextmenu', (e) => {
    if (!S.edit) return;
    const td = e.target.closest('.qtable td');
    if (!td) return;
    e.preventDefault();
    const w = td.closest('.qtable');
    const r = td.parentNode.rowIndex, c = td.cellIndex;
    const inRange = T.wrap === w && T.mode === 'ready' && (() => { const b = rangeBox(); return r >= b.r0 && r <= b.r1 && c >= b.c0 && c <= b.c1; })();
    if (!inRange) tableActivate(w, r, c);
    openMenu([
      { header: true, label: '行' }, ...lineMenu(w, 'row', r),
      { header: true, label: '列' }, ...lineMenu(w, 'col', c),
    ], { x: e.clientX, y: e.clientY });
  });
  ed.addEventListener('compositionstart', () => { S.composing = true; });
  ed.addEventListener('compositionend', () => {
    S.composing = false;
    if (layer && layer._pending) { layer._pending = false; if (layer._w) showTableUI(layer._w); }
  });
  ed.addEventListener('copy', (e) => tableCopy(e, false));
  ed.addEventListener('cut', (e) => tableCopy(e, true));
  document.addEventListener('mousedown', (e) => {
    if (!T.wrap) return;
    if (ed.contains(e.target) || e.target.closest('.toolbar,.pop,.menu,.backdrop,.qt-layer')) return;
    tableDeactivate();
  });
}

// ---------- picker ----------
function openTablePicker(btn) {
  let R = 8, C = 8, hr = -1, hc = -1;
  const el = h('<div class="pop"><div class="pop-label">表を挿入</div><div class="picker"></div><div class="picker-label">マスをなぞって大きさを選ぶ</div></div>');
  const grid = el.querySelector('.picker'), lab = el.querySelector('.picker-label');
  const draw = () => {
    grid.style.gridTemplateColumns = `repeat(${C}, 18px)`;
    let s = '';
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) s += `<i data-r="${r}" data-c="${c}"${r <= hr && c <= hc ? ' class="on"' : ''}></i>`;
    grid.innerHTML = s;
  };
  const paint = () => {
    for (const i of grid.children) i.classList.toggle('on', +i.dataset.r <= hr && +i.dataset.c <= hc);
    lab.textContent = hr >= 0 ? `${hr + 1} 行 × ${hc + 1} 列` : 'マスをなぞって大きさを選ぶ';
  };
  grid.addEventListener('mouseover', (e) => {
    const i = e.target.closest('i'); if (!i) return;
    hr = +i.dataset.r; hc = +i.dataset.c;
    let grow = false;
    if (hr >= R - 1 && R < 24) { R++; grow = true; }
    if (hc >= C - 1 && C < 16) { C++; grow = true; }
    if (grow) draw();
    paint();
  });
  el.addEventListener('mousedown', (e) => e.preventDefault());
  grid.addEventListener('click', () => {
    if (hr < 0) return;
    const rows = hr + 1, cols = hc + 1;
    closeFloating();
    insertTableBlock(Array.from({ length: rows }, () => Array(cols).fill('')), { header: rows > 1 });
  });
  draw(); paint();
  openFloating(el, btn);
}
