/* CSV Toolkit core: shared state, streaming scanner, sinks, ZIP, UI components, router. */
(function () {
  'use strict';
  const CSV = window.CSV;

  // ======================================================================
  // utils
  // ======================================================================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n).toLocaleString('en-US');
  const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB'
    : b < 1073741824 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1073741824).toFixed(2) + ' GB';
  const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const nextTick = () => new Promise(r => setTimeout(r));
  const baseName = n => n.replace(/\.[^.]+$/, '');
  const safeName = n => String(n).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || '_';

  class Emitter {
    constructor() { this.h = {}; }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); return () => { this.h[e] = this.h[e].filter(x => x !== f); }; }
    emit(e, ...a) { (this.h[e] || []).forEach(f => f(...a)); }
  }

  // ======================================================================
  // icons + illustrations
  // ======================================================================
  const ICONS = {
    split: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.17-2.87L3 3"/><path d="m15 9 6-6"/>',
    merge: '<path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.17 2.87L4 22"/><path d="m20 22-5-5"/>',
    inspect: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8.5 11.5l2 2 3.5-4"/>',
    transform: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    convert: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    rows: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    cols: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    up: '<path d="M12 19V5m0 0l-6 6m6-6l6 6"/>',
    down: '<path d="M12 5v14m0-14l-6 6m6-6l6 6" transform="rotate(180 12 12)"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.5h18M9 9.5V20"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9"/>',
    gear: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  };
  const icon = (name, cls = '') =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;


  // ======================================================================
  // theme + toast
  // ======================================================================
  function initTheme() {
    try { localStorage.removeItem('csv-theme'); } catch (e) { /* ignore */ }
    delete document.documentElement.dataset.theme;
  }

  function toast(msg, type = 'info', ms = 4200, action) {
    let box = $('#toasts');
    if (!box) { box = h('<div id="toasts" class="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(box); }
    const t = h(`<div class="toast ${type}">${icon(type === 'error' ? 'warn' : type === 'ok' ? 'check' : 'info')}<span></span></div>`);
    t.querySelector('span').textContent = msg;
    if (action) {
      $$('.toast.has-act', box).forEach(o => o.remove());
      t.classList.add('has-act');
      const b = h('<button type="button" class="toast-act"></button>');
      b.textContent = action.label;
      b.onclick = () => { action.fn(); t.classList.add('out'); setTimeout(() => t.remove(), 300); };
      t.appendChild(b);
    }
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
  }

  // ======================================================================
  // loading overlay (coffee break)
  // ======================================================================
  const LD_MIN_MS = 800;
  let ldMinUntil = 0, ldHideTimer = null, ldEl = null, ldDepth = 0;
  function ensureLoader() {
    if (ldEl) return ldEl;
    ldEl = h(`
<div class="loader" hidden role="status" aria-live="polite">
  <div class="loader-card">
    <svg class="coffee" viewBox="0 0 240 180" fill="none" stroke="var(--ill)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <ellipse cx="120" cy="170" rx="96" ry="6" fill="var(--track)" stroke="none"/>
      <rect x="22" y="150" width="196" height="9" rx="4.5" fill="var(--accent-soft)"/>
      <path d="M30 150l6-24h40l6 24z" fill="var(--card)"/><path d="M42 134h28" stroke="var(--accent)"/>
      <path d="M200 150v-10h14v10z" fill="var(--ok)"/><path d="M207 140c-8-8-8-18-2-24M207 140c6-8 8-14 4-22" stroke="var(--ok)"/>
      <g class="bob">
        <path d="M82 152v-34a30 30 0 0 1 30-30h16a30 30 0 0 1 30 30v34z" fill="var(--accent)"/>
        <rect x="113" y="78" width="14" height="14" rx="5" fill="#f2c9a5"/>
        <path d="M94 108l-8 32 20 8" stroke="var(--accent)" stroke-width="13" fill="none"/>
        <circle cx="108" cy="148" r="6.5" fill="#f2c9a5"/>
        <circle cx="120" cy="62" r="24" fill="#f2c9a5"/>
        <path d="M95.5 60a24.5 24.5 0 0 1 49 0c-9-9-31-13-49 0z" fill="#3a3170"/>
        <g class="blink"><circle cx="111" cy="64" r="2" fill="var(--ill)" stroke="none"/></g>
        <g class="blink"><circle cx="129" cy="64" r="2" fill="var(--ill)" stroke="none"/></g>
        <path d="M114 74q6 4 12 0" stroke-width="1.6"/>
        <path d="M146 106l10 40" stroke="var(--accent)" stroke-width="13" fill="none"/>
        <g class="sip">
          <path d="M156 146l14-54" stroke="var(--accent)" stroke-width="13" fill="none"/>
          <g class="steam"><path d="M166 62q-4-5 0-10t0-10"/><path d="M174 64q-4-5 0-10t0-10"/><path d="M182 62q-4-5 0-10t0-10"/></g>
          <path d="M186 76h5a6 6 0 0 1 0 12h-6" fill="none"/>
          <path d="M160 68h26v14a13 13 0 0 1-13 13a13 13 0 0 1-13-13z" fill="#fff"/>
          <path d="M162 72h22" stroke="#8a5a3c" stroke-width="3"/>
          <circle cx="170" cy="92" r="7" fill="#f2c9a5"/>
        </g>
      </g>
    </svg>
    <h3 data-ld="title">Working on it…</h3>
    <p data-ld="sub">Grab a coffee while we crunch your CSV.</p>
    <div class="lbar"><i data-ld="bar"></i></div>
    <div class="lpct" data-ld="pct">0%</div>
  </div>
</div>`);
    document.body.appendChild(ldEl);
    return ldEl;
  }
  const ld = k => ensureLoader().querySelector(`[data-ld="${k}"]`);
  function loaderShow(title, sub) {
    clearTimeout(ldHideTimer);
    ld('title').textContent = title || 'Working on it…';
    ld('sub').textContent = sub || 'Grab a coffee while we crunch your CSV.';
    loaderSet(0);
    ensureLoader().hidden = false;
    ldMinUntil = performance.now() + LD_MIN_MS;
  }
  function loaderSet(p) {
    ld('bar').style.width = (p * 100).toFixed(1) + '%';
    ld('pct').textContent = Math.round(p * 100) + '%';
  }
  function loaderHide() {
    clearTimeout(ldHideTimer);
    loaderSet(1);
    ldHideTimer = setTimeout(() => { ensureLoader().hidden = true; }, Math.max(0, ldMinUntil - performance.now()));
  }
  /** Run fn(progress) behind the loader; errors become toasts. Returns fn's result or undefined on error. */
  async function task(title, sub, fn) {
    loaderShow(title, sub);
    try { return await fn(loaderSet); }
    catch (e) { console.error(e); toast(e.message || String(e), 'error', 7000); }
    finally { loaderHide(); }
  }

  // ======================================================================
  // encodings
  // ======================================================================
  const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };

  async function detectEncoding(file) {
    const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    if (head[0] === 0xEF && head[1] === 0xBB && head[2] === 0xBF) return 'utf-8';
    if (head[0] === 0xFF && head[1] === 0xFE) return 'utf-16le';
    if (head[0] === 0xFE && head[1] === 0xFF) return 'utf-16be';
    const tryUtf8 = b => { try { new TextDecoder('utf-8', { fatal: true }).decode(b); return true; } catch (e) { return false; } };
    if (tryUtf8(head) || (head.length === 65536 && tryUtf8(head.subarray(0, 65533)))) return 'utf-8';
    return 'windows-1252';
  }

  /** spec: {enc:'utf-8'|'windows-1252'|'utf-16le', bom:boolean} */
  function makeEncoder(spec) {
    const enc = spec.enc || 'utf-8';
    const e = { enc, lossy: 0, prefix: null };
    if (enc === 'utf-8') {
      e.encode = s => s; e.byteLen = CSV.utf8len;
      if (spec.bom) e.prefix = '﻿';
    } else if (enc === 'utf-16le') {
      e.byteLen = s => s.length * 2;
      e.encode = s => { const u = new Uint16Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
      e.prefix = new Uint16Array([0xFEFF]);
    } else { // windows-1252
      e.byteLen = s => s.length;
      e.encode = s => {
        const u = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) {
          const c = s.charCodeAt(i);
          if (c < 0x80 || (c >= 0xA0 && c <= 0xFF)) u[i] = c;
          else if (CP1252[c]) u[i] = CP1252[c];
          else { u[i] = 0x3F; e.lossy++; }
        }
        return u;
      };
    }
    return e;
  }
  const prefixBytes = p => p == null ? 0 : typeof p === 'string' ? CSV.utf8len(p) : p.byteLength;

  // ======================================================================
  // streaming scanner
  // ======================================================================
  /**
   * Stream `file`, calling onRecord(rawText) for each CSV record (newlines inside quotes
   * are part of the record). Blank lines are skipped (reported via onBlank).
   */
  async function scanRecords(file, encoding, onRecord, opts = {}) {
    const { onProgress, isCancelled, onBlank } = opts;
    let read = 0;
    const counter = new TransformStream({ transform(chunk, ctl) { read += chunk.length; ctl.enqueue(chunk); } });
    const reader = file.stream().pipeThrough(counter).pipeThrough(new TextDecoderStream(encoding)).getReader();
    let carry = '', inQ = false, first = true, lastTick = 0, records = 0, blank = 0;
    const emit = rec => {
      if (rec.length <= 2 && rec.trim() === '') { blank++; onBlank && onBlank(rec); return; }
      records++; onRecord(rec);
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (isCancelled && isCancelled()) { reader.cancel(); return { ok: false, records, blank }; }
      const buf = carry + value;
      let start = 0;
      if (first) { first = false; if (buf.charCodeAt(0) === 0xFEFF) start = 1; }
      for (let i = carry.length; i < buf.length; i++) {
        const c = buf.charCodeAt(i);
        if (c === 34) inQ = !inQ;
        else if (c === 10 && !inQ) { emit(buf.slice(start, i + 1)); start = i + 1; }
      }
      carry = buf.slice(start);
      const now = performance.now();
      if (now - lastTick > 80) {
        lastTick = now;
        onProgress && onProgress(Math.min(1, read / Math.max(1, file.size)));
        await nextTick();
      }
    }
    if (carry.length) emit(carry);
    onProgress && onProgress(1);
    return { ok: true, records, blank, unclosedQuote: inQ };
  }

  // ======================================================================
  // shared file store (single-file tools)
  // ======================================================================
  const SAMPLE_ROWS = 200;
  class FileStore extends Emitter {
    constructor() {
      super();
      this.status = 'idle'; this.file = null; this.token = 0;
      this.encChoice = 'auto'; this.delimChoice = 'auto'; this.hasHeader = true;
      this.encoding = 'utf-8'; this.delimiter = ','; this.detectedEnc = ''; this.detectedDelim = '';
      this.records = 0; this.blank = 0; this.raw = []; this.header = []; this.columns = []; this.sample = [];
      this.input = h('<input type="file" hidden accept=".csv,.tsv,.txt,text/csv,text/plain">');
      document.body.appendChild(this.input);
      this.input.onchange = () => { if (this.input.files[0]) this.set(this.input.files[0]); this.input.value = ''; };
    }
    pick() { this.input.click(); }
    clear() { this.token++; this.file = null; this.status = 'idle'; this.raw = []; this.records = 0; this.blank = 0; this.header = []; this.columns = []; this.sample = []; loaderHide(); this.emit('change'); }
    get ready() { return this.status === 'ready'; }
    get name() { return this.file ? this.file.name : ''; }
    get dataRows() { return Math.max(0, this.records - (this.hasHeader ? 1 : 0)); }

    async set(file) { this.file = file; this.encChoice = 'auto'; this.delimChoice = 'auto'; this.hasHeader = true; await this.scan(); }
    async setEncoding(v) { this.encChoice = v; await this.scan(); }
    setDelimiter(v) { this.delimChoice = v; this.derive(); this.emit('change'); this.emit('ready'); }
    setHeader(v) { this.hasHeader = v; this.derive(); this.emit('change'); this.emit('ready'); }

    async scan() {
      const my = ++this.token, file = this.file;
      this.status = 'reading'; this.emit('change');
      try {
        this.detectedEnc = await detectEncoding(file);
        this.encoding = this.encChoice === 'auto' ? this.detectedEnc : this.encChoice;
        const headText = new TextDecoder(this.encoding).decode(await file.slice(0, 65536).arrayBuffer());
        this.detectedDelim = CSV.detectDelimiter(headText);
        loaderShow('Reading your file…', 'Counting rows, this only takes a moment.');
        const raw = [];
        const res = await scanRecords(file, this.encoding, rec => { if (raw.length <= SAMPLE_ROWS) raw.push(rec); },
          { onProgress: loaderSet, isCancelled: () => my !== this.token });
        if (my !== this.token) return;
        this.raw = raw; this.records = res.records; this.blank = res.blank;
        this.derive();
        this.status = this.records ? 'ready' : 'error';
        this.error = this.records ? '' : 'This file has no rows.';
      } catch (e) {
        console.error(e); this.status = 'error'; this.error = e.message || String(e);
      } finally {
        if (my === this.token) loaderHide();
      }
      if (my === this.token) { this.emit('change'); if (this.status === 'ready') this.emit('ready'); }
    }
    derive() {
      this.delimiter = this.delimChoice === 'auto' ? this.detectedDelim : this.delimChoice;
      const rows = this.raw.map(r => CSV.parseRecord(r, this.delimiter));
      const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
      const first = rows[0] || [];
      const names = this.hasHeader ? first : Array.from({ length: width }, (_, i) => 'Column ' + (i + 1));
      this.header = names;
      this.columns = Array.from({ length: this.hasHeader ? names.length : width }, (_, i) => (names[i] != null && names[i] !== '') ? names[i] : 'Column ' + (i + 1));
      this.sample = (this.hasHeader ? rows.slice(1) : rows).slice(0, SAMPLE_ROWS);
    }
  }
  const DELIM_LABEL = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };

  // ======================================================================
  // sinks (memory or folder)
  // ======================================================================
  class Sink {
    /** open: optional async fn returning {writable, name} (folder mode). Writes are queued until it resolves. */
    constructor(name, enc, mime, open) {
      this.name = name; this.enc = enc; this.mime = mime; this.direct = !!open;
      this.parts = []; this.buf = []; this.bufLen = 0; this.rows = 0; this.err = null; this.writable = null;
      this.size = prefixBytes(enc.prefix);
      this.chain = open ? open().then(o => { this.writable = o.writable; this.name = o.name; }) : Promise.resolve();
      this.chain = this.chain.catch(e => { this.err = this.err || e; });
      if (enc.prefix != null) this.emitChunk(enc.prefix);
    }
    emitChunk(c) {
      if (!this.direct) { this.parts.push(c); return; }
      this.chain = this.chain.then(() => this.err || this.writable.write(c)).catch(e => { this.err = this.err || e; });
    }
    write(s) { this.buf.push(s); this.bufLen += s.length; this.size += this.enc.byteLen(s); if (this.bufLen >= 262144) this.flush(); }
    /** Append an already-encoded Blob (e.g. a finished .xlsx). */
    writeBlob(b) { this.flush(); this.emitChunk(b); this.size += b.size; }
    flush() { if (!this.buf.length) return; const c = this.enc.encode(this.buf.join('')); this.buf = []; this.bufLen = 0; this.emitChunk(c); }
    async close() {
      this.flush();
      await this.chain;
      if (this.direct) {
        if (this.writable) { try { await this.writable.close(); } catch (e) { this.err = this.err || e; } }
        if (this.err) throw this.err;
        return { name: this.name, size: this.size, rows: this.rows, saved: true };
      }
      return { name: this.name, size: this.size, rows: this.rows, blob: new Blob(this.parts, { type: this.mime }) };
    }
  }

  const FS_OK = typeof window.showDirectoryPicker === 'function';
  function destinationPicker() {
    const el = h(`
<div class="dest">
  <div class="seg wide" role="group" aria-label="Output destination">
    <button type="button" data-m="download" class="on">Download</button>
    <button type="button" data-m="folder" ${FS_OK ? '' : 'disabled title="This browser can’t save straight to a folder. Try Chrome, Edge or Opera."'}>Save to Folder</button>
  </div>
  <div class="dest-folder" hidden>
    <button type="button" class="btn sm" data-act="choose">Choose Folder…</button>
    <span class="hint" data-label>No folder chosen</span>
  </div>
</div>`);
    const st = { mode: 'download', dir: null };
    const folderRow = $('.dest-folder', el), label = $('[data-label]', el);
    const setMode = m => {
      st.mode = m;
      $$('[data-m]', el).forEach(b => b.classList.toggle('on', b.dataset.m === m));
      folderRow.hidden = m !== 'folder';
    };
    const choose = async () => {
      try {
        st.dir = await window.showDirectoryPicker({ mode: 'readwrite' });
        label.textContent = st.dir.name;
      } catch (e) { if (e.name !== 'AbortError') toast('Could not open that folder: ' + e.message, 'error'); }
      return st.dir;
    };
    $$('[data-m]', el).forEach(b => b.onclick = () => setMode(b.dataset.m));
    $('[data-act="choose"]', el).onclick = choose;
    return {
      el,
      get mode() { return st.mode; },
      get dirName() { return st.dir ? st.dir.name : ''; },
      setMode,
      async ensure() {
        if (st.mode === 'folder' && !st.dir && !(await choose())) throw new Error('Choose a folder first, or switch to Download.');
      },
      /** Synchronous: in folder mode the file is opened in the background and writes are queued. */
      createSink(name, encSpec, mime = 'text/csv') {
        const enc = makeEncoder(encSpec || { enc: 'utf-8' });
        if (st.mode !== 'folder') return new Sink(name, enc, mime, null);
        const dir = st.dir;
        return new Sink(name, enc, mime, async () => {
          let finalName = name, n = 0;
          for (;;) {
            try { await dir.getFileHandle(finalName); n++; finalName = name.replace(/(\.[^.]*)?$/, ` (${n})$1`); }
            catch (e) { if (e.name === 'NotFoundError') break; throw e; }
          }
          const fh = await dir.getFileHandle(finalName, { create: true });
          return { writable: await fh.createWritable(), name: finalName };
        });
      },
    };
  }

  // ======================================================================
  // zip / gzip / download
  // ======================================================================
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  async function crc32(blob) {
    let crc = 0xFFFFFFFF;
    const reader = blob.stream().getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (let i = 0; i < value.length; i++) crc = CRC_TABLE[(crc ^ value[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  const CS_OK = typeof CompressionStream === 'function';
  async function compressBlob(blob, format) {
    return new Response(blob.stream().pipeThrough(new CompressionStream(format))).blob();
  }
  const gzipBlob = blob => compressBlob(blob, 'gzip');

  async function buildZip(files, { compress = true, onProgress } = {}) {
    const enc = new TextEncoder();
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parts = [], central = [];
    let offset = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const name = enc.encode(f.name);
      const size = f.blob.size;
      const crc = await crc32(f.blob);
      let data = f.blob, method = 0;
      if (compress && CS_OK && size > 0) {
        const z = await compressBlob(f.blob, 'deflate-raw');
        if (z.size < size) { data = z; method = 8; }
      }
      if (size >= 0xFFFFFFFF || offset >= 0xFFFFFFFF) throw new Error('ZIP is limited to 4 GB. Download the files individually, or use "Save to folder".');
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, method, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.size, true); lh.setUint32(22, size, true);
      lh.setUint16(26, name.length, true);
      parts.push(lh.buffer, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true); ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.size, true);
      ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.size;
      onProgress && onProgress((i + 1) / files.length);
    }
    const cdSize = central.reduce((s, p) => s + (p.byteLength ?? p.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ======================================================================
  // UI components
  // ======================================================================
  /** Empty state: a drop well with a document icon. */
  function dropzoneTile({ multiple = false, onPick, onFiles, title, sub }) {
    title = title || (multiple ? 'Drop CSV Files Here' : 'Drop a CSV File Here');
    sub = sub || (multiple ? 'Or choose them from your computer. They stay on this device.' : 'Or choose one from your computer. It stays on this device.');
    const dz = h(`
<div class="dropsheet" tabindex="0" role="button" aria-label="${title}. ${sub}">
  <div class="dw">
    <svg class="dw-doc" viewBox="0 0 64 80" aria-hidden="true">
      <path d="M8 2h34l20 20v50a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" fill="var(--doc)" stroke="var(--doc-edge)" stroke-width="1.5"/>
      <path d="M42 2v14a6 6 0 0 0 6 6h14" fill="var(--doc-fold)" stroke="var(--doc-edge)" stroke-width="1.5"/>
      <path d="M14 36h36M14 46h36M14 56h36M27 30v32M39 30v32" stroke="var(--doc-grid)" stroke-width="1.5"/>
      <rect x="10" y="62" width="44" height="12" rx="3" fill="var(--accent)"/>
      <text x="32" y="71" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff" font-family="-apple-system, system-ui, sans-serif">CSV</text>
    </svg>
    <h2>${title}</h2>
    <p>${sub}</p>
    <span class="btn accent">${multiple ? 'Choose Files…' : 'Choose File…'}</span>
    <ul class="ds-points"></ul>
  </div>
</div>`);
    dz.onclick = () => onPick();
    dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } };
    ['dragenter', 'dragover'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => { e.stopPropagation(); onFiles(Array.from(e.dataTransfer.files)); });
    return dz;
  }

  /** Two-column workspace: a sticky rail for input + settings, a stage for preview + output. */
  function workspace(root) {
    const w = h('<div class="workspace"><aside class="rail"></aside><div class="stage"></div></div>');
    root.appendChild(w);
    return { side: $('.rail', w), main: $('.stage', w) };
  }

  /** The "Active file" card with encoding / delimiter / header controls, bound to App.file. */
  function fileCard(store) {
    const el = h(`
<section class="card filecard">
  <div class="card-h"><h2>File</h2><span class="card-acts"><button type="button" class="btn sm" data-act="pick">Change…</button><button type="button" class="btn sm" data-act="close">Close</button></span></div>
  <div class="empty" data-s="empty">No file open.</div>
  <div data-s="busy" hidden><div class="empty">Reading your file…</div></div>
  <div data-s="error" hidden><div class="empty err" data-err></div></div>
  <div data-s="ready" hidden>
    <div class="event">
      <div class="t"><i></i><span data-f="name">-</span></div>
      <div class="sub" data-f="sub">-</div>
      <div class="meta">
        <span>${icon('file')}<b data-f="size">-</b></span>
        <span>${icon('rows')}<b data-f="rows">-</b> data rows</span>
        <span>${icon('cols')}<b data-f="cols">-</b> columns</span>
      </div>
    </div>
    <label class="check"><input type="checkbox" data-in="header"> First row is a header</label>
    <details class="more">
      <summary><span>Encoding and delimiter</span><small class="sum-val" data-f="readsum"></small></summary>
      <div class="more-body">
        <div class="two">
          <div class="fld"><label class="lb">Encoding</label>
            <select data-in="enc"><option value="auto">Auto-detect</option><option value="utf-8">UTF-8</option><option value="windows-1252">Windows-1252 / Latin-1</option><option value="utf-16le">UTF-16 LE</option></select></div>
          <div class="fld"><label class="lb">Delimiter</label>
            <select data-in="delim"><option value="auto">Auto-detect</option><option value=",">Comma ,</option><option value=";">Semicolon ;</option><option value="&#9;">Tab</option><option value="|">Pipe |</option></select></div>
        </div>
        <div class="hint">Auto-detect is right for almost every file. Change it only if characters look wrong or the columns don’t split correctly.</div>
      </div>
    </details>
  </div>
</section>`);
    const show = s => $$('[data-s]', el).forEach(n => n.hidden = n.dataset.s !== s);
    const f = k => $(`[data-f="${k}"]`, el);
    const render = () => {
      if (store.status === 'idle') return show('empty');
      if (store.status === 'reading') return show('busy');
      if (store.status === 'error') { $('[data-err]', el).textContent = store.error; return show('error'); }
      show('ready');
      f('name').textContent = store.name;
      f('size').textContent = fmtSize(store.file.size);
      f('rows').textContent = fmt(store.dataRows);
      f('cols').textContent = fmt(store.columns.length);
      f('sub').textContent = `${store.encoding.toUpperCase()}, ${DELIM_LABEL[store.delimiter] || 'custom'}-separated` + (store.blank ? `. ${fmt(store.blank)} blank line${store.blank > 1 ? 's' : ''} skipped.` : '');
      f('readsum').textContent = `${store.encoding.toUpperCase()}, ${DELIM_LABEL[store.delimiter] || 'custom'}`;
      $('[data-in="enc"]', el).value = store.encChoice;
      $('[data-in="delim"]', el).value = store.delimChoice;
      $('[data-in="header"]', el).checked = store.hasHeader;
    };
    $('[data-act="pick"]', el).onclick = () => store.pick();
    $('[data-act="close"]', el).onclick = () => store.clear();
    $('[data-in="enc"]', el).onchange = e => store.setEncoding(e.target.value);
    $('[data-in="delim"]', el).onchange = e => store.setDelimiter(e.target.value);
    $('[data-in="header"]', el).onchange = e => store.setHeader(e.target.checked);
    store.on('change', render); render();
    return el;
  }

  /** Status line with a thin progress bar (replaces the old ring card). */
  function progressCard(labels = ['rows', 'files', 'seconds']) {
    const el = h(`
<section class="runline" aria-live="polite">
  <div class="rl-top"><p class="status" data-r="status">Waiting for a file</p><span class="rl-pct" data-r="txt"></span></div>
  <div class="rl-bar"><i class="fg"></i></div>
  <p class="rl-stats" hidden>${labels.map((l, i) => `<span><b data-r="s${i}">-</b> ${l}</span>`).join('')}</p>
</section>`);
    const fg = $('.fg', el), st = $('.rl-stats', el);
    return {
      el,
      set(p) { fg.style.width = (p * 100).toFixed(1) + '%'; $('[data-r="txt"]', el).textContent = p > 0 && p < 1 ? Math.round(p * 100) + '%' : ''; el.classList.toggle('full', p >= 1); },
      status(t, cls = '') { const s = $('[data-r="status"]', el); s.textContent = t; s.className = 'status ' + cls; },
      stats(...v) { v.forEach((x, i) => { const n = $(`[data-r="s${i}"]`, el); if (n) n.textContent = x; }); st.hidden = v.every(x => x === '-'); },
      reset() { this.set(0); this.stats(...labels.map(() => '-')); },
    };
  }

  /** Results card + purple export card. */
  function resultPanel({ zipBase = () => 'csv-output', itemLabel = 'rows' } = {}) {
    const results = h(`
<section class="card results" hidden>
  <div class="card-h"><h2>Output Files</h2><span class="link" data-r="count"></span></div>
  <div class="empty" data-r="empty" hidden></div>
  <div class="res-list" data-r="list" hidden></div>
</section>`);
    const exp = h(`
<section class="exportbar">
  <div class="eb-text"><h3 data-e="title">No output yet</h3><p data-e="text">Run the tool to create your files.</p></div>
  <div class="eb-actions">
    <label class="check" data-e="sw" hidden><input type="checkbox" checked data-e="compress"> Compress ZIP</label>
    <button type="button" class="btn" data-e="alt" hidden>Download .gz</button>
    <button type="button" class="btn accent" data-e="main" disabled>Download</button>
  </div>
  <div class="zs" data-e="status"></div>
</section>`);
    const R = k => $(`[data-r="${k}"]`, results), E = k => $(`[data-e="${k}"]`, exp);
    let outs = [], folder = '';
    const setStatus = t => { E('status').textContent = t; };
    const view = () => results.closest('.view') || exp.closest('.view');
    const stage = s => { const v = view(); if (v) v.dataset.stage = s; };
    const markDone = () => stage('done');
    const api = {
      results, exp,
      clear() {
        outs = []; R('list').innerHTML = ''; R('list').hidden = true; R('count').textContent = ''; results.hidden = true;
        exp.classList.remove('ready');
        E('title').textContent = 'No output yet'; E('text').textContent = 'Run the tool to create your files.';
        E('sw').hidden = true; E('alt').hidden = true; E('main').disabled = true; E('main').textContent = 'Download'; setStatus('');
        E('main').onclick = null; E('alt').onclick = null;   // let go of the previous output's blobs
        // a "files are ready · Download" notification would now point at output that no longer exists
        $$('#toasts .toast.has-act').forEach(t => t.remove());
        const v = view(); if (v) v.dataset.stage = v.classList.contains('has-file') ? 'file' : '';
      },
      show(outputs, { folderName = '', note = '', gz = true, announce = true } = {}) {
        outs = outputs; folder = folderName;
        const saved = outputs.length && outputs[0].saved;
        const max = Math.max(...outputs.map(o => o.size), 1);
        const list = R('list'); list.innerHTML = '';
        outputs.forEach(o => {
          const r = h(`<div class="res"><div class="rn"><div class="n"></div><div class="s"></div></div><div class="bar"><i></i></div><div class="sz"></div></div>`);
          $('.n', r).textContent = o.name; $('.n', r).title = o.name;
          $('.s', r).textContent = o.rows != null ? `${fmt(o.rows)} ${itemLabel}` : '';
          $('.bar i', r).style.width = (o.size / max * 100).toFixed(0) + '%';
          $('.sz', r).textContent = fmtSize(o.size);
          if (saved) r.appendChild(h(`<span class="pill ok">${icon('check')}Saved</span>`));
          else { const b = h('<button type="button" class="btn sm">Download</button>'); b.onclick = () => { download(o.blob, o.name); markDone(); }; r.appendChild(b); }
          list.appendChild(r);
        });
        list.hidden = !outputs.length; results.hidden = outputs.length < 2 && !saved; exp.classList.toggle('ready', !!outputs.length);
        R('count').textContent = outputs.length ? `${fmt(outputs.length)} file${outputs.length > 1 ? 's' : ''}` : '';
        // export card
        E('alt').hidden = true; E('sw').hidden = true; E('main').disabled = false; setStatus(note);
        if (saved) {
          E('title').textContent = folder ? `Saved to “${folder}”` : 'Saved to your folder';
          E('text').textContent = `${fmt(outputs.length)} file${outputs.length > 1 ? 's were' : ' was'} written straight to the folder.`;
          E('main').disabled = true; E('main').textContent = 'Done'; E('main').onclick = null;
        } else if (outputs.length === 1) {
          const o = outputs[0];
          E('title').textContent = o.rows === 0 ? 'The output is empty' : 'Ready to download';
          E('text').textContent = o.rows === 0 ? `${o.name} has a header row but no data.` : `${o.name}, ${fmtSize(o.size)}${o.rows != null ? `, ${fmt(o.rows)} ${itemLabel}` : ''}`;
          E('main').textContent = 'Download'; E('main').onclick = () => { download(o.blob, o.name); markDone(); };
          if (CS_OK && gz) {
            E('alt').hidden = false;
            E('alt').onclick = async () => {
              E('alt').disabled = true; setStatus('Compressing…');
              try { const gz = await gzipBlob(o.blob); download(gz, o.name + '.gz'); markDone(); setStatus(`.gz ready (${fmtSize(gz.size)}, ${(100 - gz.size / o.size * 100).toFixed(0)}% smaller)`); }
              catch (e) { setStatus('Failed: ' + e.message); } finally { E('alt').disabled = false; }
            };
          }
        } else if (outputs.length > 1) {
          E('title').textContent = `${fmt(outputs.length)} files ready`; E('text').textContent = 'Download them together as one ZIP, or one at a time from the list.';
          E('sw').hidden = !CS_OK; E('main').textContent = 'Download ZIP';
          E('main').onclick = async () => {
            E('main').disabled = true;
            await task('Packing your ZIP…', 'Wrapping everything up nicely.', async p => {
              const zip = await buildZip(outs, { compress: E('compress').checked, onProgress: p });
              download(zip, zipBase() + '.zip'); markDone(); setStatus(`ZIP ready (${fmtSize(zip.size)})`);
            });
            E('main').disabled = false;
          };
        }
        // make the result impossible to miss
        stage(saved ? 'done' : 'ran');
        const target = results.isConnected ? results : exp;
        [results, exp].forEach(c => { c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); });
        setTimeout(() => {
          const r = target.getBoundingClientRect();
          if (r.top < 0 || r.top > innerHeight * 0.6) target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }, 80);
        if (announce && !saved && outputs.length) {
          toast(outputs.length > 1 ? `${fmt(outputs.length)} files are ready` : `“${outputs[0].name}” is ready`, 'ok', 8000,
            { label: outputs.length > 1 ? 'Download ZIP' : 'Download', fn: () => E('main').click() });
        }
      },
    };
    api.clear();
    return api;
  }

  /** Preset bar: saves/loads every [data-pref] control inside `rootFn()`. */
  function presetBar(toolId, rootFn, afterApply, hooks) {
    const KEY = 'csvkit.presets.v1';
    const load = () => { try { return (JSON.parse(localStorage.getItem(KEY)) || {})[toolId] || {}; } catch (e) { return {}; } };
    const save = obj => { try { const all = JSON.parse(localStorage.getItem(KEY)) || {}; all[toolId] = obj; localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { toast('Could not save presets in this browser.', 'error'); } };
    const el = h(`
<div class="presets">
  <select aria-label="Presets"><option value="">Presets…</option></select>
  <button type="button" class="btn sm" data-a="save" title="Save the current settings as a preset">Save Preset…</button>
  <button type="button" class="icon-btn" data-a="del" title="Delete selected preset" hidden>${icon('trash')}</button>
  <span class="preset-new" hidden><input type="text" placeholder="Preset name" maxlength="40"><button type="button" class="btn accent sm" data-a="ok">Save</button></span>
</div>`);
    const sel = $('select', el), del = $('[data-a="del"]', el), box = $('.preset-new', el), inp = $('input', box);
    const refresh = (pick = '') => {
      const names = Object.keys(load());
      sel.innerHTML = '<option value="">Presets…</option>' + names.map(n => `<option>${esc(n)}</option>`).join('');
      sel.value = names.includes(pick) ? pick : ''; del.hidden = !sel.value;
    };
    const collect = () => { const o = {}; $$('[data-pref]', rootFn()).forEach(c => { o[c.dataset.pref] = c.type === 'checkbox' ? c.checked : c.value; }); if (hooks && hooks.collect) o.__extra = hooks.collect(); return o; };
    const apply = o => {
      $$('[data-pref]', rootFn()).forEach(c => {
        const v = o[c.dataset.pref]; if (v === undefined) return;
        if (c.type === 'checkbox') c.checked = !!v; else if (c.tagName === 'SELECT') { if ([...c.options].some(op => op.value === String(v))) c.value = v; } else c.value = v;
        c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true }));
      });
      if (hooks && hooks.apply && o.__extra) hooks.apply(o.__extra);
      afterApply && afterApply();
    };
    sel.onchange = () => { del.hidden = !sel.value; if (sel.value) { apply(load()[sel.value]); toast(`Preset “${sel.value}” applied`, 'ok', 2200); } };
    $('[data-a="save"]', el).onclick = () => { box.hidden = !box.hidden; if (!box.hidden) { inp.value = sel.value || ''; inp.focus(); } };
    const commit = () => {
      const name = inp.value.trim(); if (!name) { inp.focus(); return; }
      const all = load(); all[name] = collect(); save(all); box.hidden = true; refresh(name); toast(`Preset “${name}” saved`, 'ok', 2200);
    };
    $('[data-a="ok"]', el).onclick = commit;
    inp.onkeydown = e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') box.hidden = true; };
    del.onclick = () => { const all = load(); delete all[sel.value]; save(all); toast('Preset deleted', 'info', 2000); refresh(); };
    refresh();
    return el;
  }

  /** Key/value summary card. */
  function summaryCard(title = 'Summary', actionLabel = 'Choose another file', onAction) {
    const el = h(`<section class="card sum"><div class="card-h"><h2>${title}</h2></div><div data-rows></div>${onAction ? `<div class="acts"><button type="button" class="btn sm" data-act>${actionLabel}</button></div>` : ''}</section>`);
    if (onAction) $('[data-act]', el).onclick = onAction;
    return { el, set(rows) { el.hidden = !rows.length || rows.every(r => r[1] === '—'); $('[data-rows]', el).innerHTML = rows.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join(''); } };
  }

  const OUT_OPTIONS_HTML = `
<details class="more" data-keys="outDelim,outEnc,outEol,outQuote">
<summary><span>Format details</span><small class="sum-val"></small></summary>
<div class="more-body">
<div class="two">
  <div class="fld"><label class="lb">Delimiter</label>
    <select data-pref="outDelim"><option value="input">Same as input</option><option value=",">Comma ,</option><option value=";">Semicolon ;</option><option value="&#9;">Tab</option><option value="|">Pipe |</option></select></div>
  <div class="fld"><label class="lb">Encoding</label>
    <select data-pref="outEnc"><option value="utf-8">UTF-8</option><option value="utf-8-bom">UTF-8 with BOM (Excel)</option><option value="windows-1252">Windows-1252 / Latin-1</option><option value="utf-16le">UTF-16 LE</option></select></div>
  <div class="fld"><label class="lb">Line endings</label>
    <select data-pref="outEol"><option value="lf">LF</option><option value="crlf">CRLF</option></select></div>
  <div class="fld"><label class="lb lb-gap">&nbsp;</label><label class="check"><input type="checkbox" data-pref="outQuote" data-sum="quoted"> Quote every field</label></div>
</div>
</div>
</details>`;
  function readOutputOptions(root, store) {
    const g = k => $(`[data-pref="${k}"]`, root);
    const encVal = g('outEnc').value;
    return {
      delimiter: g('outDelim').value === 'input' ? store.delimiter : g('outDelim').value,
      enc: { enc: encVal === 'utf-8-bom' ? 'utf-8' : encVal, bom: encVal === 'utf-8-bom' },
      eol: g('outEol').value === 'crlf' ? '\r\n' : '\n',
      quoteAll: g('outQuote').checked,
    };
  }
  /** Warn about lossy encodings once the sink is closed. */
  const warnLossy = enc => { if (enc && enc.lossy) toast(`${fmt(enc.lossy)} character${enc.lossy > 1 ? 's' : ''} can't be represented in this encoding and became “?”.`, 'error', 8000); };

  /** Hero block: title/description + dropzone tile + 3 feature cards. */
  function heroHTML(tool, dz) {
    const steps = tool.steps === false ? '' : `<ol class="stepper" aria-label="Steps">${[
      ['file', tool.stepFile || 'Choose File'], ['settings', 'Adjust Settings'], ['run', tool.verb || 'Run'], ['result', 'Download'],
    ].map(([k, l], i) => `<li data-s="${k}"><button type="button" data-goto="${k}"><i><b>${i + 1}</b>${icon('check')}</i><span>${l}</span></button></li>`).join('')}</ol>`;
    const wrap = h(`
<div class="hero-wrap">
  <header class="toolhead"><p>${tool.blurb || ''}</p>${steps}</header>
  <div data-dz></div>
</div>`);
    $('.ds-points', dz).innerHTML = (tool.hero.points || []).map(p => `<li>${p}</li>`).join('');
    $('[data-dz]', wrap).replaceWith(dz);
    return wrap;
  }

  /** Keep the "More options" summaries in sync with the controls inside them. */
  function syncMore(root) {
    $$('details.more[data-keys]', root).forEach(d => {
      const upd = () => {
        const parts = d.dataset.keys.split(',').map(k => {
          const c = $(`[data-pref="${k}"]`, d); if (!c) return '';
          if (c.type === 'checkbox') return c.checked ? (c.dataset.sum || '') : '';
          if (c.tagName === 'SELECT') { const o = c.options[c.selectedIndex]; return o ? o.text.replace(/\s*\(.*\)$/, '').replace(/\s+\/.*$/, '') : ''; }
          return c.value;
        }).filter(Boolean);
        const sv = $('.sum-val', d); if (sv) sv.textContent = parts.join(', ');
      };
      if (!d._bound) { d._bound = true; d.addEventListener('change', upd); d.addEventListener('input', upd); }
      upd();
    });
  }

  // ======================================================================
  // app / router
  // ======================================================================
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const MOD = IS_MAC ? '⌘' : 'Ctrl+';
  const App = window.App = {
    $, $$, h, esc, fmt, fmtSize, debounce, nextTick, baseName, safeName, icon, toast, task,
    loaderShow, loaderSet, loaderHide, scanRecords, makeEncoder, detectEncoding, destinationPicker, buildZip, gzipBlob,
    download, dropzoneTile, fileCard, progressCard, resultPanel, summaryCard, presetBar, OUT_OPTIONS_HTML, readOutputOptions, warnLossy,
    heroHTML, workspace, DELIM_LABEL, CS_OK, FS_OK, Sink,
    file: new FileStore(),
    tools: {}, order: [], active: null,
    register(tool) { this.tools[tool.id] = tool; this.order.push(tool.id); },
    /** Each tool has its own crawlable page; inside the app we switch views without reloading. */
    PATHS: { home: 'index.html', view: 'csv-viewer.html', split: 'split-csv.html', merge: 'merge-csv.html', inspect: 'validate-csv.html', transform: 'clean-csv.html', convert: 'convert-csv.html' },
    pathFor(id) { return this.PATHS[id] || this.PATHS.home; },
    idFromLocation() {
      const hash = (location.hash.match(/^#\/(\w+)/) || [])[1];
      if (hash && this.tools[hash]) return hash;
      const file = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
      const byPath = Object.keys(this.PATHS).find(k => this.PATHS[k] === file);
      return byPath || document.documentElement.dataset.route || this.order[0];
    },
    go(id) {
      if (!this.tools[id]) return;
      try {
        if (location.protocol === 'file:') throw new Error('no pushState on file://');
        history.pushState({ id }, '', this.pathFor(id));
      } catch (e) { location.hash = '#/' + id; return; }
      this.show(id);
    },
    show(id) {
      const tool = this.tools[id] || this.tools[this.order[0]];
      if (this.active && this.active !== tool) $$('.toast').forEach(o => o.remove());
      // the tool being left tidies up anything that floats above the page (sheets, backdrops)
      if (this.active && this.active !== tool && this.active.onHide) this.active.onHide();
      this.active = tool;
      $$('.view').forEach(v => v.hidden = v.dataset.tool !== tool.id);
      $$('[data-nav]').forEach(a => { const on = a.dataset.nav === tool.id; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
      const view = $(`.view[data-tool="${tool.id}"]`);
      if (!tool.mounted) {
        tool.mounted = true; tool.mount(view);
        const intro = document.getElementById('seo-intro');
        if (intro && intro.dataset.route === tool.id) {
          const foot = $('.home-foot', view), hero = $('.hero-wrap', view);
          if (foot) foot.before(intro); else if (hero) hero.appendChild(intro); else view.appendChild(intro);
          intro.hidden = false;
        }
        // one ad slot at the very end of each tool, below the results and summary
        const stage = $('.stage', view);
        if (stage) stage.appendChild(h('<div class="ad-slot" data-ad-slot="tool" hidden></div>'));
      }
      // a page's intro belongs to its own tool; opened on another tool (an old #/tool link) it stays out of sight
      const strayIntro = document.getElementById('seo-intro');
      if (strayIntro && !strayIntro.closest('.view')) strayIntro.hidden = true;
      tool.onShow && tool.onShow();
      this.refreshViews(); syncMore(view);
      this.applySeo(tool.id);
    },
    /** Keep title, description and canonical in step with the visible tool. */
    applySeo(id) {
      const d = (window.SEO_PAGES || {})[id];
      if (!d) { document.title = `${this.tools[id].label}: CSV Toolkit`; return; }
      document.title = d.title;
      const set = (sel, attr, val) => { const el = document.head.querySelector(sel); if (el) el.setAttribute(attr, val); };
      set('meta[name="description"]', 'content', d.description);
      set('meta[property="og:title"]', 'content', d.title);
      set('meta[property="og:description"]', 'content', d.description);
      const canon = document.head.querySelector('link[rel="canonical"]');
      if (canon) { const base = canon.href.replace(/[^/]*$/, ''); canon.href = base + (id === 'home' ? '' : this.pathFor(id)); }
    },
    /** Sync per-view state (has a file? which step?) and the header chrome. */
    refreshViews() {
      $$('.view').forEach(v => {
        const t = this.tools[v.dataset.tool], has = !!(t.hasFile ? t.hasFile() : this.file.ready);
        v.classList.toggle('has-file', has);
        if (!has) v.dataset.stage = ''; else if (!v.dataset.stage) v.dataset.stage = 'file';
      });
      const av = this.active && $(`.view[data-tool="${this.active.id}"]`);
      document.body.classList.toggle('has-file', !!(av && av.classList.contains('has-file')));
      const t = this.active, pick = $('#pick'), run = $('#tbRun');
      if (!t) return;
      $('#winTitle').textContent = t.label;
      const shared = !t.hasFile;
      const sub = shared ? (this.file.status === 'reading' ? 'Reading…' : this.file.ready ? this.file.name : 'No file open') : (t.subtitle ? t.subtitle() : '');
      $('#winSub').textContent = sub; $('#winSub').title = sub;
      pick.textContent = shared ? (this.file.ready ? 'Change File…' : 'Choose File…') : (t.cta || 'Add Files…');
      const go = av && $('[data-go]', av);
      run.hidden = !go; run.textContent = t.verb || 'Run'; run.disabled = !go || go.disabled;
      pick.title = `${pick.textContent} (${MOD}O)`; run.title = `${run.textContent} (${MOD}↩)`;
      $('#tbInspector').hidden = !(av && av.classList.contains('has-file'));
      document.body.classList.toggle('on-home', t.id === 'home');
    },
    goto(step) {
      const v = $(`.view[data-tool="${this.active.id}"]`);
      const sel = { file: '.filecard, [data-files], .dropsheet', settings: '[data-settings], .card.step', run: '[data-go]', result: '.exportbar, .results' }[step];
      const el = sel && $$(sel, v).find(n => n.isConnected && n.offsetParent !== null);
      if (!el) return;
      el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: step === 'run' ? 'center' : 'start' });
      const card = el.closest('.card') || el; card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse');
      if (step === 'run') setTimeout(() => el.focus({ preventScroll: true }), 400);
    },
    pickFiles() { const t = this.active; (t && t.pick) ? t.pick() : this.file.pick(); },
    start() {
      initTheme();
      const nav = $('#nav'), views = $('#views');
      this.order.forEach(id => {
        const t = this.tools[id];
        nav.appendChild(h(`<a href="${this.pathFor(id)}" data-nav="${id}" title="${t.blurb || t.label}">${icon(t.icon)}<span>${t.label}</span></a>`));
        views.appendChild(h(`<div class="view" data-tool="${id}" hidden></div>`));
      });
      // the overview sits above the tools group
      if (this.order[0] === 'home') nav.insertBefore($('#sbTools'), nav.children[1]);
      $('#pick').onclick = () => this.pickFiles();
      $('#tbRun').onclick = () => { const go = $(`.view[data-tool="${this.active.id}"] [data-go]`); if (go && !go.disabled) go.click(); };
      const toggle = (cls, btn, on, off) => { const hidden = document.body.classList.toggle(cls); btn.setAttribute('aria-pressed', String(!hidden)); btn.title = hidden ? on : off; btn.setAttribute('aria-label', btn.title); };
      $('#tbSidebar').onclick = e => toggle('no-sidebar', e.currentTarget, 'Show Sidebar', 'Hide Sidebar');
      $('#tbInspector').onclick = e => toggle('no-inspector', e.currentTarget, 'Show Inspector', 'Hide Inspector');
      new MutationObserver(() => { const t = this.active; if (!t) return; const go = $(`.view[data-tool="${t.id}"] [data-go]`); if (go) $('#tbRun').disabled = go.disabled; })
        .observe(views, { attributes: true, attributeFilter: ['disabled'], subtree: true });
      this.file.on('change', () => this.refreshViews());
      document.addEventListener('click', e => { const b = e.target.closest('[data-goto]'); if (b) this.goto(b.dataset.goto); });
      const route = () => this.show(this.idFromLocation());
      window.addEventListener('hashchange', route);
      window.addEventListener('popstate', route);
      // in-app links to tool pages switch views instead of reloading
      document.addEventListener('click', e => {
        const a = e.target.closest('a[href]');
        if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
        const file = a.getAttribute('href').split('#')[0].split('/').pop();
        const id = Object.keys(this.PATHS).find(k => this.PATHS[k] === file);
        if (!id || !this.tools[id] || /^(https?:)?\/\//.test(a.getAttribute('href'))) return;
        e.preventDefault(); this.go(id);
      });
      // keyboard: ⌘O / Ctrl+O opens a file, ⌘↩ / Ctrl+Enter runs the current tool
      document.addEventListener('keydown', e => {
        if (!(IS_MAC ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey) return;
        if (e.key === 'o' || e.key === 'O') { e.preventDefault(); this.pickFiles(); }
        else if (e.key === 'Enter') { const r = $('#tbRun'); if (!r.hidden && !r.disabled) { e.preventDefault(); r.click(); } }
      });
      // an old #/tool link on any page: show the tool and tidy the address
      const initial = this.idFromLocation();
      if (location.hash && location.protocol !== 'file:') { try { history.replaceState({ id: initial }, '', this.pathFor(initial)); } catch (e) { /* keep the hash */ } }
      // full-window drop target
      const ov = h(`<div class="drop-ov" hidden><div class="drop-box">${icon('download')}<b data-t>Drop to Open</b><span>Your file stays on this device.</span></div></div>`);
      document.body.appendChild(ov);
      let depth = 0;
      const isFiles = e => Array.from((e.dataTransfer && e.dataTransfer.types) || []).includes('Files');
      const hideOv = () => { depth = 0; ov.hidden = true; };
      window.addEventListener('dragenter', e => {
        if (!isFiles(e)) return;
        depth++; const t = this.active;
        $('[data-t]', ov).textContent = t && t.hasFile ? `Drop to Add to ${t.label}` : `Drop to Open in ${t ? t.label : 'CSV Toolkit'}`;
        ov.hidden = false;
      });
      window.addEventListener('dragleave', e => { if (!isFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) ov.hidden = true; });
      window.addEventListener('drop', hideOv, true);
      window.addEventListener('dragend', hideOv);
      window.addEventListener('dragover', e => e.preventDefault());
      window.addEventListener('drop', e => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files); if (!files.length) return;
        const t = this.active; (t && t.acceptFiles) ? t.acceptFiles(files) : this.file.set(files[0]);
      });
      route();
    },
  };
})();
