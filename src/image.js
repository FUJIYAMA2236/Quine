// ---------- images ----------
const MAX_SIDE = 1280;
const JPEG_Q = 0.85;
const imgUrlCache = new Map();
const BROKEN_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" rx="10" fill="#f1eee8"/><text x="120" y="66" font-family="sans-serif" font-size="13" fill="#9a9da4" text-anchor="middle">画像が見つかりません</text></svg>');

function imgURL(hash, map = IMG) {
  if (imgUrlCache.has(hash)) return imgUrlCache.get(hash);
  const im = map && map[hash];
  if (!im) return BROKEN_IMG;
  try {
    const bin = atob(im.data);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: im.mime }));
    imgUrlCache.set(hash, url);
    return url;
  } catch (e) { return BROKEN_IMG; }
}

function storeImage(dataURL, w, h) {
  const i = dataURL.indexOf(',');
  const mime = dataURL.slice(5, dataURL.indexOf(';'));
  const data = dataURL.slice(i + 1);
  const hash = hashStr(data);
  if (!IMG[hash]) IMG[hash] = { mime, data, w, h };
  return hash;
}

function hasAlpha(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 16) if (d[i] < 250) return true;
  return false;
}

async function processImageFile(file) {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    let w = img.naturalWidth, h = img.naturalHeight;
    const s = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const isJpeg = /jpe?g/i.test(file.type);
    if (isJpeg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    let url;
    if (isJpeg) url = cv.toDataURL('image/jpeg', JPEG_Q);
    else {
      const png = cv.toDataURL('image/png');
      if (hasAlpha(ctx, w, h)) url = png;
      else {
        const jpg = cv.toDataURL('image/jpeg', JPEG_Q);
        url = jpg.length < png.length * 0.9 ? jpg : png; // スクリーンショットはPNGの方が小さいことが多い
      }
    }
    return storeImage(url, w, h);
  } finally { URL.revokeObjectURL(src); }
}

async function insertImages(files, range) {
  if (!S.edit || !files.length) return;
  const many = files.length > 1 || files[0].size > 1.5e6;
  if (many) toast('画像を縮小しています…');
  const hashes = [];
  for (const f of files) {
    try { hashes.push(await processImageFile(f)); } catch (e) { toast(`「${f.name || '画像'}」を読み込めませんでした`, 'warn'); }
  }
  if (!hashes.length) return;
  ed.focus();
  if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); }
  else if (!selRange()) restoreRange();
  if (!selRange()) { const last = ed.lastElementChild; setCaret(last, last.childNodes.length); }
  edit(() => document.execCommand('insertHTML', false, hashes.map((x) => `<img data-img="${x}" alt="">`).join('')));
  hydrate(ed);
}

function pickImages() {
  const r = selRange() ? selRange().cloneRange() : lastRange;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = () => insertImages(Array.from(inp.files), r);
  inp.click();
}

// ---- 選択・サイズ変更（編集モード） ----
let selImg = null, frame = null;
function imgSelected() { return selImg && selImg.isConnected ? selImg : null; }
function hideImgFrame() {
  if (selImg) selImg.classList.remove('img-on');
  selImg = null;
  if (frame) { frame.remove(); frame = null; }
}
function placeFrame() {
  if (!selImg || !frame) return;
  const d = $('.doc').getBoundingClientRect(), r = selImg.getBoundingClientRect();
  Object.assign(frame.style, { left: r.left - d.left + 'px', top: r.top - d.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  frame.querySelector('.sz').textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
}
function selectImage(img) {
  hideImgFrame();
  selImg = img;
  img.classList.add('img-on');
  frame = h('<div class="img-frame"><span class="sz"></span><span class="h" title="ドラッグでサイズ変更／ダブルクリックで元の大きさ"></span></div>');
  $('.doc').appendChild(frame);
  placeFrame();
  const hd = frame.querySelector('.h');
  hd.addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    hSnapshot();
    const sx = e.clientX, sw = img.getBoundingClientRect().width;
    const max = ed.clientWidth;
    const move = (ev) => { img.style.width = clamp(Math.round(sw + ev.clientX - sx), 40, max) + 'px'; placeFrame(); };
    const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); touch(S.cur); hSnapshot(); };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
  });
  hd.addEventListener('dblclick', (e) => { e.preventDefault(); edit(() => img.style.removeProperty('width')); if (!img.getAttribute('style')) img.removeAttribute('style'); setTimeout(placeFrame, 0); });
  const s = getSelection(); const rg = document.createRange(); rg.selectNode(img); s.removeAllRanges(); s.addRange(rg);
}
function removeSelectedImage() {
  const img = imgSelected();
  if (!img) return;
  hideImgFrame();
  edit(() => img.remove());
}

function openLightbox(img) {
  const lb = h('<div class="lightbox" title="クリックで閉じる"><img alt=""></div>');
  lb.querySelector('img').src = img.src;
  const close = () => { lb.remove(); removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  lb.addEventListener('click', close);
  addEventListener('keydown', onKey, true);
  document.body.appendChild(lb);
}

function bindImages() {
  ed.addEventListener('mousedown', (e) => {
    if (!S.edit) return;
    const img = e.target.closest && e.target.closest('img[data-img]');
    if (img) { e.preventDefault(); selectImage(img); return; }
    if (selImg) hideImgFrame();
  });
  ed.addEventListener('input', () => { if (selImg) hideImgFrame(); });
  $('.content').addEventListener('scroll', () => { if (selImg) placeFrame(); }, { passive: true });
  addEventListener('resize', () => { if (selImg) placeFrame(); if (T.wrap) showTableUI(T.wrap); });
  const isImgDrag = (e) => e.dataTransfer && Array.from(e.dataTransfer.items || []).some((i) => i.kind === 'file' && i.type.startsWith('image/'));
  ed.addEventListener('dragover', (e) => {
    if (!S.edit || !isImgDrag(e)) return;
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  });
  ed.addEventListener('drop', (e) => {
    if (!S.edit) return;
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault(); e.stopPropagation();
    let r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (r && (!ed.contains(r.startContainer) || inTable(r.startContainer))) r = null;
    insertImages(files, r);
  });
}
