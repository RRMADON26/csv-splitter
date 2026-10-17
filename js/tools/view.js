/* View tool: open a CSV and read all of it, with search, sort, jump to row and row details.
   Rows are kept as raw text and parsed only when they scroll into view, so a 200k-row file
   stays light; the table renders just the visible rows (virtual scrolling). */
(function () {
  'use strict';
  const { $, $$, h, fmt, icon, toast, esc, debounce } = App;
  const store = App.file;
  const MAX_ROWS = 1000000, MAX_CHARS = 400e6;
  const MAX_H = 8e6;              // browsers cap element height, so very tall tables are scaled
  const RE_NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
  const narrow = matchMedia('(max-width: 1000px)'), coarse = matchMedia('(pointer: coarse)');

  App.register({
    id: 'view', label: 'View', icon: 'table',
    short: 'Open a CSV file', blurb: 'Read the whole file: search, sort and jump to any row', steps: false,
    hero: {
      points: [
        'Scroll through every row, even in files with hundreds of thousands of them.',
        'Search all columns or one, sort by any column and jump straight to a row number.',
        'Select a row to read every value in full and copy it.',
      ],
    },

    mount(root) {
      const dz = App.dropzoneTile({ onPick: () => store.pick(), onFiles: f => f[0] && store.set(f[0]) });
      root.appendChild(App.heroHTML(this, dz));
      const { side, main } = App.workspace(root);
      const fc = App.fileCard(store);

      const card = h(`
<section class="card vw">
  <div class="vw-bar">
    <label class="vw-search">${icon('search')}<input type="search" placeholder="Search rows" aria-label="Search rows" data-q autocomplete="off" spellcheck="false"></label>
    <select class="vw-qcol" aria-label="Search in" data-qcol><option value="-1">All columns</option></select>
    <label class="vw-jump"><span>Go to row</span><input type="number" min="1" inputmode="numeric" aria-label="Go to row number" placeholder="Go to row" data-jump></label>
    <span class="vw-count" data-count aria-live="polite"></span>
    <button type="button" class="btn sm" data-dl hidden>Download These Rows</button>
  </div>
  <div class="empty" data-empty>Choose a file to read it here.</div>
  <div class="vw-scroll" tabindex="0" role="grid" aria-label="Rows of the CSV file" data-sc hidden>
    <div class="vw-head" role="row" data-head></div>
    <div class="vw-body" data-body><div class="vw-rows" data-rows></div></div>
  </div>
  <p class="hint" data-note hidden></p>
</section>`);
      const detail = h(`
<section class="card vw-detail" aria-labelledby="vw-dt">
  <div class="card-h"><h2 id="vw-dt" data-dt>Row Details</h2><span class="card-acts"><button type="button" class="btn sm" data-copy disabled>Copy Row</button><button type="button" class="btn sm vw-close" data-close>Close</button></span></div>
  <div class="empty" data-dempty>Select a row to see every value in full.</div>
  <dl class="vw-kv" data-kv hidden></dl>
</section>`);
      const backdrop = h('<div class="vw-backdrop" hidden></div>');
      side.appendChild(fc); side.appendChild(detail);
      main.appendChild(card);
      document.body.appendChild(backdrop);

      const sc = $('[data-sc]', card), head = $('[data-head]', card), body = $('[data-body]', card), rowsEl = $('[data-rows]', card);
      const qIn = $('[data-q]', card), qCol = $('[data-qcol]', card), jump = $('[data-jump]', card), countEl = $('[data-count]', card), dlBtn = $('[data-dl]', card), note = $('[data-note]', card);

      // ------------------------------------------------------------ state
      let raws = [], headerRaw = '', key = '', busy = false, truncated = false;
      let widths = [], numeric = [], base = null, view = null, sortCol = -1, sortDir = 0, query = '', qc = -1, sel = -1;
      const colCache = new Map(), pcache = new Map();
      const RH = () => (coarse.matches ? 40 : 32);
      const curKey = () => store.ready ? [store.file.name, store.file.size, store.file.lastModified, store.encoding, store.delimiter, store.hasHeader].join('|') : '';
      const count = () => (view ? view.length : raws.length);
      const at = p => (view ? view[p] : p);

      function fields(ri) {
        let f = pcache.get(ri);
        if (!f) { f = CSV.parseRecord(raws[ri], store.delimiter); pcache.set(ri, f); if (pcache.size > 600) pcache.delete(pcache.keys().next().value); }
        return f;
      }
      function column(c) {
        let a = colCache.get(c);
        if (a) return a;
        const d = store.delimiter; a = new Array(raws.length);
        for (let i = 0; i < raws.length; i++) { const f = CSV.parseRecord(raws[i], d); a[i] = f[c] == null ? '' : f[c]; }
        colCache.set(c, a); if (colCache.size > 3) colCache.delete(colCache.keys().next().value);
        return a;
      }

      // ------------------------------------------------------------ loading
      async function load() {
        if (busy || !store.ready || !App.active || App.active.id !== 'view' || key === curKey()) return;
        busy = true;
        const myKey = curKey(), out = [];
        let chars = 0, stop = false, first = store.hasHeader, hdr = '';
        await App.task('Opening your file…', 'Reading every row so you can scroll through all of it.', async setLd => {
          await App.scanRecords(store.file, store.encoding, rec => {
            if (first) { first = false; hdr = rec; return; }
            if (out.length >= MAX_ROWS || chars > MAX_CHARS) { stop = true; return; }
            out.push(rec); chars += rec.length;
          }, { onProgress: setLd, isCancelled: () => stop });
        });
        busy = false;
        if (myKey !== curKey()) { load(); return; }
        raws = out; headerRaw = hdr; truncated = stop; key = myKey;
        colCache.clear(); pcache.clear();
        base = view = null; sortCol = -1; sortDir = 0; sel = -1; query = ''; qc = -1; qIn.value = ''; jump.value = '';
        setupColumns(); applyFilter(); showDetail();
      }

      function setupColumns() {
        const cols = store.columns, sample = store.sample.slice(0, 120);
        widths = cols.map((c, i) => {
          let m = c.length + 3;
          for (const r of sample) { const v = r[i]; if (v && v.length > m) m = v.length; }
          return Math.round(Math.min(320, Math.max(76, m * 7.6 + 30)));
        });
        numeric = cols.map((_, i) => { let n = 0; for (const r of sample) { const v = (r[i] || '').trim(); if (!v) continue; if (!RE_NUM.test(v)) return false; n++; } return n > 0; });
        qCol.innerHTML = '<option value="-1">All columns</option>' + cols.map((c, i) => `<option value="${i}">${esc(c)}</option>`).join('');
        renderHead(); applyWidths();
      }
      function rnWidth() { return Math.max(52, String(raws.length).length * 8.5 + 26); }
      function applyWidths() { sc.style.setProperty('--cols', [rnWidth() + 'px'].concat(widths.map(w => w + 'px')).join(' ')); }

      function renderHead() {
        head.innerHTML = `<div class="vw-rn vw-th" role="columnheader">#</div>` + store.columns.map((c, i) => {
          const s = sortCol === i ? (sortDir > 0 ? 'ascending' : 'descending') : 'none';
          return `<div class="vw-th${numeric[i] ? ' num' : ''}" role="columnheader" aria-sort="${s}"><button type="button" data-sort="${i}" title="Sort by ${esc(c)}"><span>${esc(c)}</span>${sortCol === i ? icon(sortDir > 0 ? 'up' : 'down', 'vw-arrow') : ''}</button><i class="vw-rs" data-rs="${i}" aria-hidden="true"></i></div>`;
        }).join('');
      }

      // ------------------------------------------------------------ filter + sort
      function applyFilter() {
        const q = query.trim().toLowerCase();
        if (!q) base = null;
        else {
          const hit = [];
          if (qc < 0) { for (let i = 0; i < raws.length; i++) if (raws[i].toLowerCase().includes(q)) hit.push(i); }
          else { const vals = column(qc); for (let i = 0; i < vals.length; i++) if (vals[i].toLowerCase().includes(q)) hit.push(i); }
          base = Uint32Array.from(hit);
        }
        applySort();
      }
      function applySort() {
        if (sortCol < 0) view = base;
        else {
          const vals = column(sortCol);
          const ids = base ? Uint32Array.from(base) : Uint32Array.from({ length: raws.length }, (_, i) => i);
          let isNum = true;
          for (let k = 0; k < ids.length; k++) { const v = vals[ids[k]].trim(); if (v && !RE_NUM.test(v)) { isNum = false; break; } }
          const dir = sortDir;
          if (isNum) {
            const key = new Float64Array(raws.length).fill(NaN);
            for (let k = 0; k < ids.length; k++) { const v = vals[ids[k]].trim(); if (v) key[ids[k]] = +v; }
            ids.sort((a, b) => { const x = key[a], y = key[b], ex = x !== x, ey = y !== y; if (ex || ey) return ex === ey ? a - b : ex ? 1 : -1; return x === y ? a - b : (x < y ? -dir : dir); });
          } else {
            const low = new Array(raws.length);
            for (let k = 0; k < ids.length; k++) low[ids[k]] = vals[ids[k]].toLowerCase();
            ids.sort((a, b) => { const x = low[a], y = low[b]; if (!x || !y) return !x && !y ? a - b : !x ? 1 : -1; return x === y ? a - b : (x < y ? -dir : dir); });
          }
          view = ids;
        }
        sc.scrollTop = 0; lastRange = '';
        renderHead(); render(); updateCount();
      }
      function updateCount() {
        const n = count(), total = raws.length;
        countEl.textContent = !store.ready ? '' : view && base ? `${fmt(n)} of ${fmt(total)} rows` : `${fmt(total)} rows`;
        dlBtn.hidden = !(base || sortCol >= 0);
        note.hidden = !truncated;
        if (truncated) note.textContent = `Showing the first ${fmt(raws.length)} of ${fmt(store.dataRows)} rows. Use Split to break the file into parts you can read in full.`;
        sc.setAttribute('aria-rowcount', String(n + 1));
      }

      // ------------------------------------------------------------ virtual rendering
      let lastRange = '';
      function geometry() {
        const n = count(), rh = RH(), total = n * rh, H = Math.min(total, MAX_H);
        const headH = head.offsetHeight || 36, vis = Math.max(rh, sc.clientHeight - headH);
        return { n, rh, total, H, vis, maxScroll: Math.max(1, H - vis) };
      }
      function render() {
        if (!store.ready || !raws.length && !store.dataRows) return;
        const g = geometry();
        body.style.height = g.H + 'px';
        const st = Math.min(sc.scrollTop, g.maxScroll);
        let first, top;
        if (g.total <= MAX_H) { first = Math.max(0, Math.floor(st / g.rh) - 6); top = first * g.rh; }
        else { const exact = (st / g.maxScroll) * Math.max(0, g.n - g.vis / g.rh); first = Math.floor(exact); top = st - (exact - first) * g.rh; }
        const last = Math.min(g.n, first + Math.ceil(g.vis / g.rh) + 12);
        const range = `${first}:${last}:${sel}:${query}:${qc}`;
        rowsEl.style.transform = `translateY(${top}px)`;
        if (range === lastRange) return;
        lastRange = range;
        const q = query.trim().toLowerCase(), cols = store.columns.length;
        let html = '';
        for (let p = first; p < last; p++) {
          const ri = at(p), f = fields(ri);
          html += `<div class="vw-tr${ri === sel ? ' on' : ''}" role="row" aria-rowindex="${p + 2}" aria-selected="${ri === sel}" data-ri="${ri}"><div class="vw-rn" role="rowheader">${fmt(ri + 1)}</div>`;
          for (let c = 0; c < cols; c++) html += `<div class="vw-td${numeric[c] ? ' num' : ''}" role="gridcell">${cell(f[c], q && (qc < 0 || qc === c) ? q : '')}</div>`;
          html += '</div>';
        }
        rowsEl.innerHTML = html;
      }
      function cell(v, q) {
        if (v == null || v === '') return '';
        let s = v.length > 240 ? v.slice(0, 240) + '…' : v;
        s = s.replace(/\r?\n/g, ' ↵ ');
        if (!q) return esc(s);
        const low = s.toLowerCase(); let out = '', i = 0, j;
        while ((j = low.indexOf(q, i)) !== -1) { out += esc(s.slice(i, j)) + '<mark>' + esc(s.slice(j, j + q.length)) + '</mark>'; i = j + q.length; }
        return out + esc(s.slice(i));
      }
      let raf = 0;
      sc.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }, { passive: true });
      new ResizeObserver(() => { lastRange = ''; render(); }).observe(sc);
      coarse.addEventListener('change', () => { lastRange = ''; render(); });

      // ------------------------------------------------------------ positions + selection
      const posOf = ri => { if (ri < 0) return -1; if (!view) return ri < raws.length ? ri : -1; return view.indexOf(ri); };
      function scrollToPos(p) {
        const g = geometry();
        if (g.total <= MAX_H) {
          const y = p * g.rh;
          if (y < sc.scrollTop) sc.scrollTop = y;
          else if (y + g.rh > sc.scrollTop + g.vis) sc.scrollTop = y + g.rh - g.vis;
        } else sc.scrollTop = (p / Math.max(1, g.n - g.vis / g.rh)) * g.maxScroll;
      }
      function select(ri, opts = {}) {
        sel = ri; lastRange = ''; render(); showDetail(opts.open);
      }

      // ------------------------------------------------------------ row details
      function showDetail(open) {
        const kv = $('[data-kv]', detail), empty = $('[data-dempty]', detail), copy = $('[data-copy]', detail);
        if (sel < 0 || !raws[sel]) {
          kv.hidden = true; empty.hidden = false; copy.disabled = true; $('[data-dt]', detail).textContent = 'Row Details';
          closeSheet(); return;
        }
        const f = fields(sel);
        $('[data-dt]', detail).textContent = `Row ${fmt(sel + 1)}`;
        kv.innerHTML = store.columns.map((c, i) => { const v = f[i] == null ? '' : f[i]; return `<div><dt>${esc(c)}</dt><dd${v === '' ? ' class="nul"' : ''}>${v === '' ? 'empty' : esc(v)}</dd></div>`; }).join('');
        kv.hidden = false; empty.hidden = true; copy.disabled = false;
        if (open && narrow.matches) openSheet();
      }
      function openSheet() { detail.classList.add('open'); backdrop.hidden = false; document.body.classList.add('sheet-open'); $('[data-close]', detail).focus({ preventScroll: true }); }
      function closeSheet() { if (!detail.classList.contains('open')) return; detail.classList.remove('open'); backdrop.hidden = true; document.body.classList.remove('sheet-open'); }
      backdrop.onclick = closeSheet;
      $('[data-close]', detail).onclick = () => { closeSheet(); sc.focus({ preventScroll: true }); };
      narrow.addEventListener('change', () => { if (!narrow.matches) closeSheet(); });
      $('[data-copy]', detail).onclick = async () => {
        if (sel < 0) return;
        // tab-separated, with spreadsheet-style quotes so line breaks inside a cell survive the paste
        const text = fields(sel).map(v => { v = v || ''; return /[\t\r\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join('\t');
        try { await navigator.clipboard.writeText(text); toast(`Row ${fmt(sel + 1)} copied. Paste it into a spreadsheet.`, 'ok', 2500); }
        catch (e) { toast('Copying isn’t allowed here. Select the values in Row Details instead.', 'error', 4000); }
      };

      // ------------------------------------------------------------ events
      rowsEl.addEventListener('click', e => { const r = e.target.closest('.vw-tr'); if (r) select(+r.dataset.ri, { open: true }); });
      sc.addEventListener('keydown', e => {
        const n = count(); if (!n) return;
        const g = geometry(), page = Math.max(1, Math.floor(g.vis / g.rh) - 1);
        let p = posOf(sel);
        const moves = { ArrowDown: 1, ArrowUp: -1, PageDown: page, PageUp: -page };
        if (e.key in moves) p = p < 0 ? 0 : p + moves[e.key];
        else if (e.key === 'Home') p = 0;
        else if (e.key === 'End') p = n - 1;
        else if (e.key === 'Enter' && sel >= 0) { showDetail(true); e.preventDefault(); return; }
        else if (e.key === 'Escape') { closeSheet(); return; }
        else return;
        e.preventDefault();
        p = Math.max(0, Math.min(n - 1, p));
        scrollToPos(p); select(at(p));
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && detail.classList.contains('open')) closeSheet(); });

      head.addEventListener('click', e => {
        const b = e.target.closest('[data-sort]'); if (!b || resizing) return;
        const c = +b.dataset.sort;
        if (sortCol !== c) { sortCol = c; sortDir = 1; } else if (sortDir > 0) sortDir = -1; else { sortCol = -1; sortDir = 0; }
        if (raws.length > 50000) App.task('Sorting…', `By ${store.columns[c]}.`, async () => { await App.nextTick(); applySort(); });
        else applySort();
      });
      // drag a header edge to resize its column
      let resizing = false;
      head.addEventListener('pointerdown', e => {
        const rs = e.target.closest('[data-rs]'); if (!rs) return;
        e.preventDefault(); resizing = true;
        const c = +rs.dataset.rs, x0 = e.clientX, w0 = widths[c];
        rs.setPointerCapture(e.pointerId);
        const move = ev => { widths[c] = Math.max(56, Math.min(900, w0 + ev.clientX - x0)); applyWidths(); };
        const up = () => { rs.removeEventListener('pointermove', move); rs.removeEventListener('pointerup', up); setTimeout(() => { resizing = false; }, 0); };
        rs.addEventListener('pointermove', move); rs.addEventListener('pointerup', up);
      });
      head.addEventListener('dblclick', e => { const rs = e.target.closest('[data-rs]'); if (rs) { widths[+rs.dataset.rs] = 160; applyWidths(); } });

      const runSearch = debounce(() => { query = qIn.value; applyFilter(); }, 200);
      qIn.addEventListener('input', runSearch);
      qIn.addEventListener('keydown', e => { if (e.key === 'Escape' && qIn.value) { qIn.value = ''; query = ''; applyFilter(); } });
      qCol.addEventListener('change', () => { qc = +qCol.value; if (query.trim()) applyFilter(); });
      jump.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const n = Math.floor(+jump.value);
        if (!(n >= 1 && n <= raws.length)) { toast(`Enter a row number from 1 to ${fmt(raws.length)}.`, 'error', 3000); return; }
        const p = posOf(n - 1);
        if (p < 0) { toast(`Row ${fmt(n)} is hidden by your search. Clear the search to see it.`, 'error', 4000); return; }
        const g = geometry();
        if (g.total <= MAX_H) sc.scrollTop = Math.max(0, p * g.rh - g.vis / 2 + g.rh / 2); else scrollToPos(p);
        select(n - 1); sc.focus({ preventScroll: true });
      });
      dlBtn.onclick = () => {
        const n = count(), parts = [];
        if (headerRaw) parts.push(/\n$/.test(headerRaw) ? headerRaw : headerRaw + '\n');
        for (let p = 0; p < n; p++) { const r = raws[at(p)]; parts.push(/\n$/.test(r) ? r : r + '\n'); }
        App.download(new Blob(parts, { type: 'text/csv' }), App.baseName(store.name) + (base ? '_search' : '_sorted') + '.csv');
        toast(`Saved ${fmt(n)} rows as UTF-8 CSV`, 'ok', 2500);
      };

      // ------------------------------------------------------------ file changes
      function reset() {
        raws = []; headerRaw = ''; key = ''; view = base = null; sel = -1; sortCol = -1; sortDir = 0;
        colCache.clear(); pcache.clear(); rowsEl.innerHTML = ''; lastRange = '';
        const has = store.ready;
        sc.hidden = !has; $('[data-empty]', card).hidden = has; note.hidden = true;
        countEl.textContent = ''; dlBtn.hidden = true; showDetail();
      }
      store.on('change', () => { if (!store.ready) reset(); });
      store.on('ready', () => { reset(); if (App.active && App.active.id === 'view') load(); });
      this._load = load;
      reset(); if (store.ready) load();
    },

    onShow() { this._load && this._load(); },
    pick() { App.file.pick(); },
    acceptFiles(files) { App.file.set(files[0]); },
  });
})();
