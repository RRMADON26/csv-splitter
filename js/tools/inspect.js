/* Inspect tool: preview, per-column statistics and data validation. */
(function () {
  'use strict';
  const { $, h, fmt, fmtSize, icon, toast, esc } = App;
  const store = App.file;
  const DISTINCT_CAP = 50000, PREVIEW_ROWS = 20;

  const RE_NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
  const RE_INT = /^[+-]?\d+$/;
  const RE_DATE = /^(\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})$/;
  const RE_BOOL = /^(true|false|yes|no|y|n)$/i;
  const RE_MOJI = /Ã[\u0080-¿]|â€[\u0080-¿™œ]/;

  const newCol = () => ({ filled: 0, empty: 0, int: 0, dec: 0, date: 0, bool: 0, text: 0, ws: 0, counts: new Map(), capped: false, min: Infinity, max: -Infinity, sum: 0, nums: 0, minL: Infinity, maxL: 0, dmin: null, dmax: null });

  function addValue(c, v) {
    const n = v.length;
    if (n && (v.charCodeAt(0) <= 32 || v.charCodeAt(n - 1) <= 32)) c.ws++;
    if (n === 0 || v.trim() === '') { c.empty++; return; }
    c.filled++;
    if (c.counts.has(v)) c.counts.set(v, c.counts.get(v) + 1);
    else if (c.counts.size < DISTINCT_CAP) c.counts.set(v, 1); else c.capped = true;
    if (n < c.minL) c.minL = n; if (n > c.maxL) c.maxL = n;
    const t = v.trim(), f = t.charCodeAt(0);
    const numericStart = (f >= 48 && f <= 57) || f === 45 || f === 43 || f === 46;
    if (numericStart && RE_NUM.test(t) && !/^[+-]?0\d/.test(t)) {
      const x = +t;
      if (RE_INT.test(t)) c.int++; else c.dec++;
      c.nums++; c.sum += x; if (x < c.min) c.min = x; if (x > c.max) c.max = x;
    } else if (numericStart && RE_DATE.test(t)) {
      c.date++; if (/^\d{4}-/.test(t)) { if (c.dmin === null || t < c.dmin) c.dmin = t; if (c.dmax === null || t > c.dmax) c.dmax = t; }
    } else if (n <= 5 && RE_BOOL.test(t)) c.bool++;
    else c.text++;
  }

  function typeOf(c) {
    if (!c.filled) return { t: 'Empty', odd: 0 };
    const share = [['Integer', c.int], ['Decimal', c.int + c.dec], ['Date', c.date], ['Boolean', c.bool], ['Text', c.text]];
    if (c.int === c.filled) return { t: 'Integer', odd: 0 };
    if (c.int + c.dec === c.filled) return { t: 'Decimal', odd: 0 };
    for (const [t, n] of share) if (t !== 'Text' && n / c.filled >= 0.95) return { t, odd: c.filled - n };
    return { t: 'Text', odd: 0 };
  }

  const num = x => Number.isInteger(x) ? fmt(x) : (Math.abs(x) >= 1000 ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(+x.toFixed(4)));
  function describe(c, ty) {
    if (ty.t === 'Integer' || ty.t === 'Decimal') return { range: c.nums ? `${num(c.min)} → ${num(c.max)}` : '—', extra: c.nums ? `avg ${num(c.sum / c.nums)}` : '' };
    if (ty.t === 'Date' && c.dmin) return { range: `${c.dmin} → ${c.dmax}`, extra: '' };
    if (ty.t === 'Empty') return { range: '—', extra: '' };
    return { range: c.minL === c.maxL ? `${c.minL} chars` : `${c.minL}–${c.maxL} chars`, extra: '' };
  }
  function top(c, n = 3) {
    if (c.capped || c.counts.size > 1000 || !c.counts.size) return [];
    return [...c.counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  App.register({
    id: 'inspect', label: 'Inspect', icon: 'inspect',
    short: 'Inspect a CSV file', blurb: 'Preview the data and find problems', steps: false,
    hero: {
      points: [
        'See the first rows straight away, with the type each column seems to hold.',
        'Per column: how full it is, how many distinct values, the range and the most common values.',
        'Finds rows with the wrong number of columns, broken quotes, garbled characters and stray spaces.',
      ],
    },

    mount(root) {
      const dz = App.dropzoneTile({ onPick: () => store.pick(), onFiles: f => f[0] && store.set(f[0]) });
      root.appendChild(App.heroHTML(this, dz));
      const { side, main } = App.workspace(root);
      const fc = App.fileCard(store);

      const overview = h(`<section class="card"><div class="card-h"><h2>Overview</h2></div><dl class="kv" data-tiles></dl></section>`);
      const health = h(`
<section class="card health">
  <div class="card-h"><h2>Health check</h2><span data-pill></span></div>
  <p class="hc-line"><b data-pct>—</b> of rows are clean</p>
  <div class="hc-bar"><i data-fg></i></div>
  <p class="status" data-status>Waiting for a file</p>
  <p class="hc-counts"><span><b data-e>-</b> <i data-le>errors</i></span><span><b data-w>-</b> <i data-lw>warnings</i></span><span><b data-i>-</b> <i data-li>notes</i></span></p>
</section>`);
      const preview = h(`
<section class="card">
  <div class="card-h"><h2>Preview</h2><span class="link" data-prev-note></span></div>
  <div class="empty" data-empty>Choose a file to see its first rows.</div>
  <div class="tbl-wrap" data-prev hidden></div>
</section>`);
      const stats = h(`
<section class="card">
  <div class="card-h"><h2>Columns</h2><button type="button" class="link" data-exp-stats hidden>${icon('download')}Export CSV</button></div>
  <div class="empty" data-empty>Column statistics will appear here.</div>
  <div class="tbl-wrap" data-stats hidden></div>
</section>`);
      const issues = h(`
<section class="card">
  <div class="card-h"><h2>Issues</h2><button type="button" class="link" data-exp-issues hidden>${icon('download')}Export CSV</button></div>
  <div class="empty" data-empty>Problems found in the data will be listed here.</div>
  <div class="issue-list" data-issues hidden></div>
</section>`);
      [fc, health, overview].forEach(n => side.appendChild(n));
      [issues, preview, stats].forEach(n => main.appendChild(n));

      let last = null, key = '', busy = false;
      const stale = () => store.ready && key !== [store.file.name, store.file.size, store.file.lastModified, store.encoding, store.delimiter, store.hasHeader].join('|');

      // ------------------------------------------------------------ preview (instant)
      function renderPreview() {
        const wrap = $('[data-prev]', preview), empty = $('[data-empty]', preview);
        if (!store.ready) { wrap.hidden = true; empty.hidden = false; $('[data-prev-note]', preview).textContent = ''; return; }
        const rows = store.sample.slice(0, PREVIEW_ROWS), cols = store.columns, res = last && last.key === key ? last : null;
        const typeBadge = i => res ? `<span class="typ t-${res.types[i].t.toLowerCase()}">${res.types[i].t}</span>` : '';
        wrap.innerHTML = `<table class="tbl pv"><thead><tr><th class="rn">#</th>${cols.map((c, i) => `<th><span class="cn" title="${esc(c)}">${esc(c)}</span>${typeBadge(i)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r, ri) => `<tr><td class="rn">${ri + 1}</td>${cols.map((_, i) => { const v = r[i] == null ? '' : r[i]; return v === '' ? '<td class="nul">empty</td>' : `<td title="${esc(v)}">${esc(v.length > 80 ? v.slice(0, 80) + '…' : v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
        wrap.hidden = false; empty.hidden = true;
        $('[data-prev-note]', preview).textContent = `First ${fmt(rows.length)} of ${fmt(store.dataRows)} rows`;
      }

      function renderTiles(r) {
        const eol = !r ? '—' : r.crlf && r.lf ? 'Mixed' : r.crlf ? 'CRLF' : 'LF';
        const t = [
          ['Rows', store.ready ? fmt(store.dataRows) : '—'], ['Columns', store.ready ? fmt(store.columns.length) : '—'],
          ['Size', store.ready ? fmtSize(store.file.size) : '—'], ['Encoding', store.ready ? store.encoding.toUpperCase() : '—'],
          ['Delimiter', store.ready ? (App.DELIM_LABEL[store.delimiter] || 'custom') : '—'], ['Line endings', store.ready ? eol : '—'],
        ];
        $('[data-tiles]', overview).innerHTML = t.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
      }

      // ------------------------------------------------------------ results rendering
      function renderResult(r) {
        // health
        const fg = $('[data-fg]', health), clean = r.rows ? (r.rows - r.badRows) / r.rows : 1;
        fg.style.width = (clean * 100).toFixed(1) + '%'; fg.classList.toggle('bad', clean < 0.98);
        $('[data-pct]', health).textContent = (clean >= 0.9995 && r.badRows ? 99.9 : Math.round(clean * 1000) / 10) + '%';
        const E = r.issues.filter(x => x.sev === 'error').length, W = r.issues.filter(x => x.sev === 'warn').length, I = r.issues.filter(x => x.sev === 'info').length;
        $('[data-e]', health).textContent = E; $('[data-w]', health).textContent = W; $('[data-i]', health).textContent = I;
        $('[data-le]', health).textContent = E === 1 ? 'error' : 'errors'; $('[data-lw]', health).textContent = W === 1 ? 'warning' : 'warnings'; $('[data-li]', health).textContent = I === 1 ? 'note' : 'notes';
        $('[data-status]', health).textContent = r.badRows ? `${fmt(r.badRows)} of ${fmt(r.rows)} rows have problems` : 'Every row looks clean';
        $('[data-status]', health).className = 'status ' + (E ? 'err' : W || r.badRows ? '' : 'ok');
        $('[data-pill]', health).innerHTML = E ? `<span class="pill err">${icon('warn')}Needs attention</span>` : W ? `<span class="pill warn">${icon('warn')}Review suggested</span>` : `<span class="pill ok">${icon('check')}Looks healthy</span>`;
        // issues
        const il = $('[data-issues]', issues);
        il.innerHTML = r.issues.length ? r.issues.map(x => `<div class="issue ${x.sev}"><span class="ii">${icon(x.sev === 'info' ? 'info' : 'warn')}</span><div><b>${esc(x.title)}</b><p>${esc(x.detail)}</p>${x.examples && x.examples.length ? `<ul class="ex">${x.examples.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}</div></div>`).join('')
          : `<div class="issue ok"><span class="ii">${icon('check')}</span><div><b>No problems found</b><p>Rows are consistent, quotes are balanced and the text decodes cleanly.</p></div></div>`;
        il.hidden = false; $('[data-empty]', issues).hidden = true; $('[data-exp-issues]', issues).hidden = !r.issues.length;
        // stats
        const sw = $('[data-stats]', stats);
        sw.innerHTML = `<table class="tbl"><thead><tr><th>Column</th><th>Filled</th><th>Distinct</th><th>Range</th><th>Top values</th></tr></thead><tbody>${r.cols.map(c => `
<tr><td><div class="cn" title="${esc(c.name)}">${esc(c.name)}</div><span class="typ t-${c.ty.t.toLowerCase()}">${c.ty.t}</span>${c.ty.odd ? `<span class="pill warn sm" title="Values that don't fit the ${c.ty.t.toLowerCase()} type">${fmt(c.ty.odd)} off</span>` : ''}</td>
<td><div class="fillbar"><i style="width:${(c.filledPct).toFixed(1)}%"></i></div><small>${c.filledPct.toFixed(c.filledPct === 100 || c.filledPct === 0 ? 0 : 1)}%${c.empty ? `, ${fmt(c.empty)} empty` : ''}</small></td>
<td class="r">${c.capped ? fmt(DISTINCT_CAP) + '+' : fmt(c.distinct)}</td>
<td><span class="rg">${esc(c.range)}</span>${c.extra ? `<small>${esc(c.extra)}</small>` : ''}</td>
<td>${c.top.length ? c.top.map(([v, n]) => `<span class="tv" title="${esc(v)}">${esc(v.length > 18 ? v.slice(0, 18) + '…' : v)}<em>${fmt(n)}</em></span>`).join('') : '<small>—</small>'}</td></tr>`).join('')}</tbody></table>`;
        sw.hidden = false; $('[data-empty]', stats).hidden = true; $('[data-exp-stats]', stats).hidden = false;
        renderTiles(r); renderPreview();
      }

      function reset() {
        last = null; key = '';
        $('[data-fg]', health).style.width = '0'; $('[data-pct]', health).textContent = '—';
        $('[data-status]', health).textContent = store.ready ? 'Analyzing…' : 'Waiting for a file'; $('[data-status]', health).className = 'status';
        $('[data-pill]', health).innerHTML = '';
        ['e', 'w', 'i'].forEach(k => $(`[data-${k}]`, health).textContent = '-');
        [stats, issues].forEach(c => { $('[data-empty]', c).hidden = false; });
        $('[data-stats]', stats).hidden = true; $('[data-issues]', issues).hidden = true;
        $('[data-exp-stats]', stats).hidden = true; $('[data-exp-issues]', issues).hidden = true;
        renderTiles(null); renderPreview();
      }

      // ------------------------------------------------------------ analysis
      async function analyze() {
        if (busy || !store.ready || !stale()) return;
        busy = true;
        const myKey = [store.file.name, store.file.size, store.file.lastModified, store.encoding, store.delimiter, store.hasHeader].join('|');
        await App.task('Inspecting your file…', 'Looking for anything unusual.', async setLd => {
          const d = store.delimiter, hasH = store.hasHeader, enc = store.encoding;
          const cols = store.columns.map(() => newCol());
          let expected = hasH ? store.header.length : 0, recNo = 0, rows = 0, ragged = 0, badRows = 0, crlf = 0, lf = 0, repl = 0, moji = 0, long = 0;
          const raggedEx = [], replEx = [], mojiEx = [];
          const res = await App.scanRecords(store.file, enc, rec => {
            recNo++;
            if (rec.charCodeAt(rec.length - 1) === 10) { if (rec.charCodeAt(rec.length - 2) === 13) crlf++; else lf++; }
            if (hasH && recNo === 1) return;
            const f = CSV.parseRecord(rec, d); rows++;
            if (!expected) expected = f.length;
            let bad = false;
            if (f.length !== expected) { ragged++; bad = true; if (raggedEx.length < 6) raggedEx.push(`Row ${fmt(rows)}: ${f.length} field${f.length === 1 ? '' : 's'} (expected ${expected})`); }
            if (rec.indexOf('�') !== -1) { repl++; bad = true; if (replEx.length < 5) replEx.push(`Row ${fmt(rows)}`); }
            else if (RE_MOJI.test(rec)) { moji++; if (mojiEx.length < 5) mojiEx.push(`Row ${fmt(rows)}`); }
            if (bad) badRows++;
            const n = Math.min(f.length, cols.length);
            for (let i = 0; i < n; i++) addValue(cols[i], f[i]);
            for (let i = n; i < cols.length; i++) cols[i].empty++;
          }, { onProgress: p => setLd(p) });

          // BOM
          const head = new Uint8Array(await store.file.slice(0, 3).arrayBuffer());
          const bom = (head[0] === 0xEF && head[1] === 0xBB && head[2] === 0xBF) || (head[0] === 0xFF && head[1] === 0xFE);
          const names = store.columns, issuesL = [];
          if (res.unclosedQuote) issuesL.push({ sev: 'error', title: 'Unclosed quote at the end of the file', detail: 'A field opens with a quote that is never closed. Everything after it may be read as one giant cell.' });
          if (ragged) issuesL.push({ sev: 'error', title: `${fmt(ragged)} row${ragged > 1 ? 's' : ''} with the wrong number of columns`, detail: `The header has ${expected} columns. Unquoted delimiters inside text are the usual cause.`, examples: raggedEx.concat(ragged > raggedEx.length ? [`…and ${fmt(ragged - raggedEx.length)} more`] : []) });
          if (repl) issuesL.push({ sev: 'error', title: `${fmt(repl)} row${repl > 1 ? 's' : ''} with undecodable characters (�)`, detail: `The file isn’t valid ${enc.toUpperCase()}. Try another encoding under “Encoding & delimiter” in the File panel.`, examples: replEx });
          if (moji) issuesL.push({ sev: 'warn', title: `Possible garbled text in ${fmt(moji)} row${moji > 1 ? 's' : ''}`, detail: 'Sequences like “Ã©” usually mean UTF-8 text was read as Latin-1 (or saved twice). Try switching the encoding.', examples: mojiEx });
          const dupNames = hasH ? store.header.filter((n, i) => store.header.indexOf(n) !== i) : [];
          if (dupNames.length) issuesL.push({ sev: 'warn', title: 'Duplicate column names', detail: [...new Set(dupNames)].join(', ') });
          const noName = hasH ? store.header.filter(n => !n.trim()).length : 0;
          if (noName) issuesL.push({ sev: 'warn', title: `${noName} column${noName > 1 ? 's have' : ' has'} no name`, detail: 'Unnamed columns are shown as “Column N”.' });
          const emptyCols = names.filter((_, i) => !cols[i].filled);
          if (emptyCols.length) issuesL.push({ sev: 'warn', title: `${emptyCols.length} completely empty column${emptyCols.length > 1 ? 's' : ''}`, detail: emptyCols.join(', ') });
          const wsCols = names.map((n, i) => [n, cols[i].ws]).filter(x => x[1]);
          if (wsCols.length) issuesL.push({ sev: 'warn', title: 'Cells with leading or trailing spaces', detail: 'Extra spaces break filters, lookups and de-duplication. The Transform tool can trim them.', examples: wsCols.slice(0, 6).map(([n, c]) => `${n}: ${fmt(c)} cell${c > 1 ? 's' : ''}`) });
          const mixed = names.map((n, i) => [n, typeOf(cols[i])]).filter(x => x[1].odd > 0);
          if (mixed.length) issuesL.push({ sev: 'warn', title: 'Columns with mixed value types', detail: 'Most values look like one type, but some don’t fit.', examples: mixed.slice(0, 6).map(([n, t]) => `${n}: ${fmt(t.odd)} value${t.odd > 1 ? 's' : ''} aren’t ${t.t.toLowerCase()}`) });
          if (store.blank) issuesL.push({ sev: 'info', title: `${fmt(store.blank)} blank line${store.blank > 1 ? 's' : ''} ignored`, detail: 'Empty lines are skipped by every tool here.' });
          if (crlf && lf) issuesL.push({ sev: 'info', title: 'Mixed line endings', detail: `${fmt(crlf)} lines end with CRLF and ${fmt(lf)} with LF.` });
          if (bom) issuesL.push({ sev: 'info', title: 'Byte-order mark (BOM) present', detail: 'Harmless, and helpful for Excel. It is removed when the file is read.' });

          const colRes = names.map((name, i) => {
            const c = cols[i], ty = typeOf(c), ds = describe(c, ty), tot = c.filled + c.empty;
            return { name, ty, empty: c.empty, filled: c.filled, filledPct: tot ? c.filled / tot * 100 : 0, distinct: c.counts.size, capped: c.capped, range: ds.range, extra: ds.extra, top: top(c) };
          });
          last = { key: myKey, rows, badRows, crlf, lf, issues: issuesL, cols: colRes, types: colRes.map(c => c.ty) };
          key = myKey;
          renderResult(last);
          const E = issuesL.filter(x => x.sev === 'error').length;
          toast(E ? `Found ${E} error${E > 1 ? 's' : ''} to review` : 'Inspection complete', E ? 'error' : 'ok', 3000);
        });
        busy = false;
      }

      // exports
      const dlCsv = (rows, name) => App.download(new Blob(['﻿' + rows.map(r => CSV.formatRecord(r, ',', false)).join('\r\n') + '\r\n'], { type: 'text/csv' }), name);
      $('[data-exp-stats]', stats).onclick = () => last && dlCsv([['column', 'type', 'filled', 'empty', 'filled_pct', 'distinct', 'range', 'top_values']].concat(last.cols.map(c => [c.name, c.ty.t, c.filled, c.empty, c.filledPct.toFixed(2), c.capped ? DISTINCT_CAP + '+' : c.distinct, c.range, c.top.map(([v, n]) => `${v} (${n})`).join('; ')])), App.baseName(store.name) + '_column_stats.csv');
      $('[data-exp-issues]', issues).onclick = () => last && dlCsv([['severity', 'issue', 'detail', 'examples']].concat(last.issues.map(x => [x.sev, x.title, x.detail, (x.examples || []).join(' | ')])), App.baseName(store.name) + '_issues.csv');

      store.on('change', () => { if (!store.ready) reset(); });
      store.on('ready', () => { reset(); renderPreview(); if (App.active && App.active.id === 'inspect') analyze(); });
      this._analyze = analyze;
      reset(); if (store.ready) { renderPreview(); analyze(); }
    },

    onShow() { this._analyze && this._analyze(); },
    pick() { store.pick(); },
    acceptFiles(files) { store.set(files[0]); },
  });
})();
