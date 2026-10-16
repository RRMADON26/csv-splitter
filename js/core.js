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
    gear: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  };
  const icon = (name, cls = '') =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  const ILL = {
    bigfile: '<rect x="30" y="8" width="52" height="68" rx="6" fill="var(--card)"/><path d="M40 24h32M40 34h32M40 44h20"/><rect x="56" y="52" width="40" height="26" rx="5" fill="#6b63e6"/><path d="M66 65h20M80 59l6 6-6 6"/>',
    shield: '<path d="M60 8l32 12v24c0 20-14 32-32 40-18-8-32-20-32-40V20z" fill="var(--card)"/><rect x="46" y="40" width="28" height="22" rx="5" fill="#6b63e6"/><path d="M52 40v-6a8 8 0 0 1 16 0v6"/><circle cx="60" cy="51" r="2" fill="var(--ill)"/>',
    table: '<rect x="16" y="12" width="88" height="64" rx="8" fill="var(--card)"/><path d="M16 36h88M16 54h88M52 12v64M82 12v64"/><path d="M24 12h28v24H16V20a8 8 0 0 1 8-8z" fill="#6b63e6"/><rect x="52" y="12" width="52" height="24" fill="#6b63e6" fill-opacity=".35" stroke="none"/>',
    merge: '<rect x="12" y="10" width="34" height="24" rx="5" fill="var(--card)"/><rect x="12" y="54" width="34" height="24" rx="5" fill="var(--card)"/><path d="M20 20h18M20 26h10M20 64h18M20 70h10"/><path d="M46 22h12q10 0 10 10v8q0 10 10 10h8M46 66h12q10 0 10-10v-4"/><rect x="82" y="30" width="28" height="30" rx="5" fill="#6b63e6"/><path d="M89 40h14M89 46h14M89 52h8" stroke="#fff"/>',
    filter: '<path d="M14 12h92L70 48v28l-20 8V48z" fill="var(--card)"/><circle cx="46" cy="26" r="3.5" fill="#6b63e6" stroke="none"/><circle cx="62" cy="22" r="3.5" fill="#6b63e6" stroke="none"/><circle cx="78" cy="28" r="3.5" fill="#6b63e6" stroke="none"/><path d="M60 58v10" stroke="#6b63e6" stroke-width="3"/>',
    search: '<rect x="12" y="12" width="64" height="52" rx="7" fill="var(--card)"/><path d="M12 28h64M12 44h64M34 12v52"/><circle cx="82" cy="58" r="16" fill="var(--card)"/><path d="M94 70l12 12" stroke-width="3"/><path d="M75 58l5 5 8-9" stroke="#6b63e6" stroke-width="2.4"/>',
    convert: '<rect x="10" y="18" width="40" height="50" rx="6" fill="var(--card)"/><path d="M18 32h24M18 42h24M18 52h14"/><rect x="70" y="18" width="40" height="50" rx="6" fill="#6b63e6"/><path d="M80 34c-5 0-5 4-5 8s-2 5-5 5c3 0 5 1 5 5s0 8 5 8M100 34c5 0 5 4 5 8s2 5 5 5" stroke="#fff" transform="translate(-4 -3) scale(1)"/><path d="M52 36h16m-5-5l5 5-5 5M68 54H52m5-5l-5 5 5 5"/>',
    folder: '<path d="M12 22a6 6 0 0 1 6-6h22l8 8h44a6 6 0 0 1 6 6v36a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z" fill="var(--card)"/><circle cx="60" cy="52" r="14" fill="#6b63e6"/><path d="M53 52l5 5 9-10" stroke="#fff" stroke-width="2.4"/>',
    zip: '<rect x="26" y="8" width="68" height="76" rx="8" fill="var(--card)"/><path d="M60 8v10m0 6v6m0 6v6" stroke-dasharray="0" stroke-width="2.4"/><rect x="50" y="52" width="20" height="18" rx="4" fill="#6b63e6"/><path d="M42 24h6M72 24h6M42 34h6M72 34h6"/>',
    columns: '<rect x="14" y="12" width="92" height="64" rx="8" fill="var(--card)"/><rect x="44" y="12" width="32" height="64" fill="#6b63e6" fill-opacity=".3" stroke="none"/><path d="M14 30h92M14 48h92M14 62h92M44 12v64M76 12v64"/><path d="M52 4l8 6 8-6" stroke="#6b63e6" stroke-width="2.4"/>',
    dice: '<rect x="24" y="16" width="44" height="44" rx="9" fill="var(--card)"/><rect x="52" y="34" width="44" height="44" rx="9" fill="#6b63e6"/><circle cx="38" cy="30" r="3" fill="var(--ill)"/><circle cx="54" cy="46" r="3" fill="var(--ill)"/><circle cx="64" cy="44" r="3" fill="#fff" stroke="none"/><circle cx="84" cy="68" r="3" fill="#fff" stroke="none"/><circle cx="74" cy="56" r="3" fill="#fff" stroke="none"/>',
    bolt: '<path d="M64 6L24 50h30l-8 36 44-48H60z" fill="#6b63e6"/>',
    alert: '<path d="M60 10l46 74H14z" fill="var(--card)"/><path d="M60 38v22" stroke-width="3"/><circle cx="60" cy="70" r="2.6" fill="var(--ill)"/>',
    chart: '<rect x="14" y="12" width="92" height="64" rx="8" fill="var(--card)"/><rect x="26" y="46" width="12" height="22" fill="#6b63e6" stroke="none"/><rect x="46" y="32" width="12" height="36" fill="#6b63e6" fill-opacity=".6" stroke="none"/><rect x="66" y="40" width="12" height="28" fill="#6b63e6" stroke="none"/><rect x="86" y="24" width="12" height="44" fill="#6b63e6" fill-opacity=".6" stroke="none"/>',
    sheet: '<rect x="22" y="8" width="76" height="76" rx="7" fill="var(--card)"/><path d="M22 28h76M22 48h76M22 66h76M50 8v76"/><rect x="22" y="8" width="28" height="20" fill="#3fb08f" fill-opacity=".5" stroke="none"/>',
    encoding: '<rect x="12" y="20" width="44" height="50" rx="6" fill="var(--card)"/><text x="34" y="52" font-size="22" text-anchor="middle" fill="var(--ill)" stroke="none" font-family="sans-serif" font-weight="600">Aé</text><path d="M60 45h18m-5-5l5 5-5 5"/><rect x="82" y="20" width="26" height="50" rx="6" fill="#6b63e6"/><path d="M89 34h12M89 44h12M89 54h8" stroke="#fff"/>',
  };
  const ill = kind => `<svg viewBox="0 0 120 92" fill="none" stroke="var(--ill)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ILL[kind] || ''}</svg>`;

  // ======================================================================
  // theme + toast
  // ======================================================================
  function initTheme() {
    const light = $('#thLight'), dark = $('#thDark');
    const apply = t => {
      document.documentElement.dataset.theme = t;
      dark.classList.toggle('on', t === 'dark'); light.classList.toggle('on', t !== 'dark');
      try { localStorage.setItem('csv-theme', t); } catch (e) { /* ignore */ }
    };
    let t = null;
    try { t = localStorage.getItem('csv-theme'); } catch (e) { /* ignore */ }
    if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    apply(t);
    light.onclick = () => apply('light'); dark.onclick = () => apply('dark');
  }

  function toast(msg, type = 'info', ms = 4200) {
    let box = $('#toasts');
    if (!box) { box = h('<div id="toasts" class="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(box); }
    const t = h(`<div class="toast ${type}">${icon(type === 'error' ? 'warn' : type === 'ok' ? 'check' : 'info')}<span></span></div>`);
    t.querySelector('span').textContent = msg;
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
    <button type="button" data-m="download" class="on">${icon('download')}Download</button>
    <button type="button" data-m="folder" ${FS_OK ? '' : 'disabled title="Your browser cannot save directly to a folder (try Chrome, Edge or Opera)"'}>${icon('folder')}Save to folder</button>
  </div>
  <div class="dest-folder" hidden>
    <button type="button" class="btn soft sm" data-act="choose">Choose folder…</button>
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
        label.textContent = '📁 ' + st.dir.name;
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
  /** The big "+" tile. `onFiles(fileList)` receives dropped / chosen files. */
  function dropzoneTile({ multiple = false, onPick, onFiles, label }) {
    const dz = h(`<div class="dz" tabindex="0" role="button" aria-label="Choose or drag a file"><div class="plus">+</div><small>${label || 'Choose or drag<br>a CSV file'}</small></div>`);
    dz.onclick = () => onPick();
    dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } };
    ['dragenter', 'dragover'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => { e.stopPropagation(); onFiles(Array.from(e.dataTransfer.files)); });
    return dz;
  }

  /** The "Active file" card with encoding / delimiter / header controls, bound to App.file. */
  function fileCard(store) {
    const el = h(`
<section class="card filecard">
  <div class="card-h"><h2>Active file</h2><button type="button" class="link" data-act="pick">${icon('file')}Choose another</button></div>
  <div class="empty" data-s="empty">No file yet.<br>Choose or drag a CSV onto the <b>+</b> tile above.</div>
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
    <div class="two">
      <div class="fld"><label class="lb">Encoding</label>
        <select data-in="enc"><option value="auto">Auto-detect</option><option value="utf-8">UTF-8</option><option value="windows-1252">Windows-1252 / Latin-1</option><option value="utf-16le">UTF-16 LE</option></select></div>
      <div class="fld"><label class="lb">Delimiter</label>
        <select data-in="delim"><option value="auto">Auto-detect</option><option value=",">Comma ,</option><option value=";">Semicolon ;</option><option value="&#9;">Tab</option><option value="|">Pipe |</option></select></div>
    </div>
    <label class="check"><input type="checkbox" data-in="header"> First row is a header</label>
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
      f('sub').textContent = `${store.encoding.toUpperCase()} · ${DELIM_LABEL[store.delimiter] || 'custom'}-separated` + (store.blank ? ` · ${fmt(store.blank)} blank line${store.blank > 1 ? 's' : ''} ignored` : '');
      $('[data-in="enc"]', el).value = store.encChoice;
      $('[data-in="delim"]', el).value = store.delimChoice;
      $('[data-in="header"]', el).checked = store.hasHeader;
    };
    $('[data-act="pick"]', el).onclick = () => store.pick();
    $('[data-in="enc"]', el).onchange = e => store.setEncoding(e.target.value);
    $('[data-in="delim"]', el).onchange = e => store.setDelimiter(e.target.value);
    $('[data-in="header"]', el).onchange = e => store.setHeader(e.target.checked);
    store.on('change', render); render();
    return el;
  }

  /** Progress ring card. */
  function progressCard(labels = ['rows', 'files', 'seconds'], title = 'Progress') {
    const el = h(`
<section class="card">
  <div class="card-h"><h2>${title}</h2></div>
  <div class="ringwrap">
    <div class="ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="46"/><circle class="fg" cx="50" cy="50" r="46"/></svg><b data-r="txt">0%</b></div>
    <div class="status" data-r="status">Waiting for a file</div>
    <div class="stats">${labels.map((l, i) => `<div><strong data-r="s${i}">-</strong><small>${l}</small></div>`).join('')}</div>
  </div>
</section>`);
    const fg = $('.fg', el);
    return {
      el,
      set(p) { fg.style.strokeDashoffset = String(289 * (1 - p)); $('[data-r="txt"]', el).textContent = Math.round(p * 100) + '%'; },
      status(t, cls = '') { const s = $('[data-r="status"]', el); s.textContent = t; s.className = 'status ' + cls; },
      stats(...v) { v.forEach((x, i) => { const n = $(`[data-r="s${i}"]`, el); if (n) n.textContent = x; }); },
      reset() { this.set(0); this.stats(...labels.map(() => '-')); },
    };
  }

  /** Results card + purple export card. */
  function resultPanel({ zipBase = () => 'csv-output', itemLabel = 'rows' } = {}) {
    const results = h(`
<section class="card results">
  <div class="card-h"><h2>Results</h2><span class="link" data-r="count"></span></div>
  <div class="empty" data-r="empty">No results yet.<br>Output files will be listed here.</div>
  <div class="res-list" data-r="list" hidden></div>
</section>`);
    const exp = h(`
<section class="card promo export">
  ${ill('zip').replace('<svg', '<svg class="pi"')}
  <h3 data-e="title">Nothing yet</h3>
  <p data-e="text">Run the tool to create your file.</p>
  <label class="switch" data-e="sw" hidden><input type="checkbox" checked data-e="compress"><i></i><span>Compress (smaller ZIP)</span></label>
  <div class="export-btns">
    <button type="button" class="btn" data-e="main" disabled>Download</button>
    <button type="button" class="btn ghost-w" data-e="alt" hidden>Download .gz</button>
  </div>
  <div class="zs" data-e="status"></div>
</section>`);
    const R = k => $(`[data-r="${k}"]`, results), E = k => $(`[data-e="${k}"]`, exp);
    let outs = [], folder = '';
    const setStatus = t => { E('status').textContent = t; };
    const api = {
      results, exp,
      clear() {
        outs = []; R('list').innerHTML = ''; R('list').hidden = true; R('empty').hidden = false; R('count').textContent = '';
        E('title').textContent = 'Nothing yet'; E('text').textContent = 'Run the tool to create your file.';
        E('sw').hidden = true; E('alt').hidden = true; E('main').disabled = true; E('main').textContent = 'Download'; setStatus('');
        E('main').onclick = null;
      },
      show(outputs, { folderName = '', note = '', gz = true } = {}) {
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
          else { const b = h('<button type="button" class="btn soft sm">Download</button>'); b.onclick = () => download(o.blob, o.name); r.appendChild(b); }
          list.appendChild(r);
        });
        list.hidden = !outputs.length; R('empty').hidden = !!outputs.length;
        R('count').textContent = outputs.length ? `${fmt(outputs.length)} file${outputs.length > 1 ? 's' : ''}` : '';
        // export card
        E('alt').hidden = true; E('sw').hidden = true; E('main').disabled = false; setStatus(note);
        if (saved) {
          E('title').textContent = 'Saved to your folder';
          E('text').textContent = `${fmt(outputs.length)} file${outputs.length > 1 ? 's' : ''} written to “${folder}”.`;
          E('main').disabled = true; E('main').textContent = 'Done'; E('main').onclick = null;
        } else if (outputs.length === 1) {
          const o = outputs[0];
          E('title').textContent = 'Your file is ready'; E('text').textContent = `${o.name} · ${fmtSize(o.size)}`;
          E('main').textContent = 'Download'; E('main').onclick = () => download(o.blob, o.name);
          if (CS_OK && gz) {
            E('alt').hidden = false;
            E('alt').onclick = async () => {
              E('alt').disabled = true; setStatus('Compressing…');
              try { const gz = await gzipBlob(o.blob); download(gz, o.name + '.gz'); setStatus(`.gz ready (${fmtSize(gz.size)}, ${(100 - gz.size / o.size * 100).toFixed(0)}% smaller)`); }
              catch (e) { setStatus('Failed: ' + e.message); } finally { E('alt').disabled = false; }
            };
          }
        } else if (outputs.length > 1) {
          E('title').textContent = 'Download everything'; E('text').textContent = 'All output files bundled into one ZIP.';
          E('sw').hidden = !CS_OK; E('main').textContent = 'Download ZIP';
          E('main').onclick = async () => {
            E('main').disabled = true;
            await task('Packing your ZIP…', 'Wrapping everything up nicely.', async p => {
              const zip = await buildZip(outs, { compress: E('compress').checked, onProgress: p });
              download(zip, zipBase() + '.zip'); setStatus(`ZIP ready (${fmtSize(zip.size)})`);
            });
            E('main').disabled = false;
          };
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
  <button type="button" class="btn soft sm" data-a="save" title="Save the current settings as a preset">${icon('star')}Save</button>
  <button type="button" class="icon-btn" data-a="del" title="Delete selected preset" hidden>${icon('trash')}</button>
  <span class="preset-new" hidden><input type="text" placeholder="Preset name" maxlength="40"><button type="button" class="btn sm" data-a="ok">Save</button></span>
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
    const el = h(`<section class="card sum"><div class="card-h"><h2>${title}</h2></div><div data-rows></div>${onAction ? `<div class="acts"><button type="button" class="btn soft sm" data-act>${actionLabel}</button></div>` : ''}</section>`);
    if (onAction) $('[data-act]', el).onclick = onAction;
    return { el, set(rows) { $('[data-rows]', el).innerHTML = rows.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join(''); } };
  }

  const OUT_OPTIONS_HTML = `
<div class="two">
  <div class="fld"><label class="lb">Delimiter</label>
    <select data-pref="outDelim"><option value="input">Same as input</option><option value=",">Comma ,</option><option value=";">Semicolon ;</option><option value="&#9;">Tab</option><option value="|">Pipe |</option></select></div>
  <div class="fld"><label class="lb">Encoding</label>
    <select data-pref="outEnc"><option value="utf-8">UTF-8</option><option value="utf-8-bom">UTF-8 with BOM (Excel)</option><option value="windows-1252">Windows-1252 / Latin-1</option><option value="utf-16le">UTF-16 LE</option></select></div>
  <div class="fld"><label class="lb">Line endings</label>
    <select data-pref="outEol"><option value="lf">LF</option><option value="crlf">CRLF</option></select></div>
  <div class="fld"><label class="lb">&nbsp;</label><label class="check"><input type="checkbox" data-pref="outQuote"> Quote every field</label></div>
</div>`;
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
    const wrap = h(`
<section class="hero">
  <div class="hello"><h1>${tool.hero.title}</h1><p>${tool.hero.text}</p></div>
  <div data-dz></div>
  ${tool.hero.features.map(f => `<div class="feat">${ill(f[0])}<b>${f[1]}</b><span>${f[2]}</span></div>`).join('')}
</section>`);
    $('[data-dz]', wrap).replaceWith(dz);
    return wrap;
  }

  // ======================================================================
  // app / router
  // ======================================================================
  const App = window.App = {
    $, $$, h, esc, fmt, fmtSize, debounce, nextTick, baseName, safeName, icon, ill, toast, task,
    loaderShow, loaderSet, loaderHide, scanRecords, makeEncoder, detectEncoding, destinationPicker, buildZip, gzipBlob,
    download, dropzoneTile, fileCard, progressCard, resultPanel, summaryCard, presetBar, OUT_OPTIONS_HTML, readOutputOptions, warnLossy,
    heroHTML, DELIM_LABEL, CS_OK, FS_OK, Sink,
    file: new FileStore(),
    tools: {}, order: [], active: null,
    register(tool) { this.tools[tool.id] = tool; this.order.push(tool.id); },
    go(id) { location.hash = '#/' + id; },
    show(id) {
      const tool = this.tools[id] || this.tools[this.order[0]];
      this.active = tool;
      $$('.view').forEach(v => v.hidden = v.dataset.tool !== tool.id);
      $$('[data-nav]').forEach(a => { const on = a.dataset.nav === tool.id; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
      const view = $(`.view[data-tool="${tool.id}"]`);
      if (!tool.mounted) { tool.mounted = true; tool.mount(view); }
      tool.onShow && tool.onShow();
      document.title = `${tool.label} · CSV Toolkit`;
    },
    pickFiles() { const t = this.active; (t && t.pick) ? t.pick() : this.file.pick(); },
    start() {
      initTheme();
      const side = $('#side'), nav = $('#nav'), views = $('#views');
      this.order.forEach(id => {
        const t = this.tools[id];
        side.appendChild(h(`<a href="#/${id}" data-nav="${id}" title="${t.label}" aria-label="${t.label}">${icon(t.icon)}<span class="tip">${t.label}</span></a>`));
        nav.appendChild(h(`<a href="#/${id}" data-nav="${id}">${icon(t.icon)}${t.label}</a>`));
        views.appendChild(h(`<div class="view" data-tool="${id}" hidden></div>`));
      });
      $('#pick').onclick = () => this.pickFiles();
      const route = () => this.show((location.hash.match(/^#\/(\w+)/) || [])[1]);
      window.addEventListener('hashchange', route);
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
