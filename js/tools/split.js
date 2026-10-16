/* Split tool: by rows, number of files, file size, or column value. */
(function () {
  'use strict';
  const { $, $$, h, fmt, fmtSize, icon, toast, baseName, safeName } = App;
  const store = App.file;

  App.register({
    id: 'split', label: 'Split', icon: 'split',
    short: 'Split a CSV file', blurb: 'Break a big file into smaller ones', verb: 'Split',
    hero: {
      title: 'Hi!<br>Which CSV are we splitting today?',
      text: 'Split large CSV files, hundreds of thousands of rows or more, into several smaller files. Everything is processed in your browser.',
      features: [
        ['bigfile', 'Built for big files', 'Read in chunks, so the browser never freezes'],
        ['columns', 'Split by column value', 'One file per city, month or any other value'],
        ['folder', 'Save straight to a folder', 'Skip the download dialogs (Chrome, Edge)'],
      ],
    },

    mount(root) {
      const dest = App.destinationPicker();
      const progress = App.progressCard(['rows', 'files', 'seconds']);
      const out = App.resultPanel({ zipBase: () => baseName(store.name || 'split') + '_split' });
      const summary = App.summaryCard('Summary', 'Choose another file', () => store.pick());
      const files = App.dropzoneTile({ onPick: () => store.pick(), onFiles: f => f[0] && store.set(f[0]) });

      root.appendChild(App.heroHTML(this, files));
      const grid = h('<main class="grid"></main>');
      root.appendChild(grid);

      const fc = App.fileCard(store); fc.classList.add('c4'); grid.appendChild(fc);

      const settings = h(`
<section class="card c4" data-settings>
  <div class="card-h"><h2>Settings</h2></div>
  <div data-presets></div>
  <div class="fld"><label class="lb" for="sp-mode">Split by</label>
    <select id="sp-mode" data-pref="mode">
      <option value="rows">Rows per file</option>
      <option value="parts">Number of output files</option>
      <option value="size">Maximum file size</option>
      <option value="column">Column value</option>
    </select></div>
  <div class="fld" data-f="num"><label class="lb" for="sp-val" data-l="val">Rows per file</label>
    <input id="sp-val" type="number" min="1" value="50000" data-pref="val">
    <div class="hint" data-hint></div></div>
  <div class="fld" data-f="col" hidden><label class="lb" for="sp-col">Column</label>
    <select id="sp-col" data-pref="col"></select>
    <div class="hint">One file per distinct value (up to 500).</div></div>
  <details class="more" data-keys="prefix,outEnc">
  <summary><span>File names &amp; encoding</span><small class="sum-val"></small></summary>
  <div class="more-body">
  <div class="two">
    <div class="fld"><label class="lb" for="sp-prefix">Name prefix</label><input id="sp-prefix" type="text" value="part" data-pref="prefix"></div>
    <div class="fld"><label class="lb" for="sp-enc">Output encoding</label>
      <select id="sp-enc" data-pref="outEnc"><option value="utf-8">UTF-8</option><option value="utf-8-bom">UTF-8 with BOM</option><option value="windows-1252">Windows-1252</option><option value="utf-16le">UTF-16 LE</option></select></div>
  </div>
  </div>
  </details>
  <div class="fld"><label class="lb">Save to</label><div data-dest></div></div>
  <button class="btn accent block" type="button" data-go disabled>Split file</button>
  <div class="hint center" data-note></div>
</section>`);
      grid.appendChild(settings);
      $('[data-dest]', settings).appendChild(dest.el);
      $('[data-presets]', settings).appendChild(App.presetBar('split', () => settings, update));

      const prog = progress.el; prog.classList.add('c4'); grid.appendChild(prog);
      out.results.classList.add('c5'); out.exp.classList.add('c3'); summary.el.classList.add('c4');
      grid.appendChild(out.results); grid.appendChild(out.exp); grid.appendChild(summary.el);

      const S = k => $(`[data-${k}]`, settings);
      const mode = () => $('#sp-mode', settings).value;
      const val = () => Math.max(1, parseFloat($('#sp-val', settings).value) || 1);
      const encSpec = () => { const v = $('#sp-enc', settings).value; return { enc: v === 'utf-8-bom' ? 'utf-8' : v, bom: v === 'utf-8-bom' }; };
      let busy = false;

      /** rows per file for the rows / parts modes */
      const perFile = () => mode() === 'parts' ? Math.max(1, Math.ceil(store.dataRows / Math.max(1, Math.floor(val())))) : Math.max(1, Math.floor(val()));

      function update() {
        const m = mode(), inp = $('#sp-val', settings);
        S('f="num"').hidden = m === 'column'; S('f="col"').hidden = m !== 'column';
        $('[data-l="val"]', settings).textContent = { rows: 'Rows per file', parts: 'Number of files', size: 'Max size per file (MB)' }[m] || '';
        inp.step = m === 'size' ? '0.1' : '1';
        const hint = $('[data-hint]', settings);
        if (!store.ready) hint.textContent = '';
        else if (m === 'rows' || m === 'parts') { const pf = perFile(); hint.textContent = `≈ ${fmt(Math.max(1, Math.ceil(store.dataRows / pf)))} files, up to ${fmt(pf)} data rows each`; }
        else if (m === 'size') hint.textContent = `≈ ${fmt(Math.max(1, Math.ceil(store.file.size / (val() * 1048576))))} files (estimate)`;
        $('[data-note]', settings).textContent = store.ready ? (store.hasHeader ? 'The header row is repeated in every file.' : 'No header: rows are copied as they are.') : 'Start by choosing a CSV file.';
        S('go').disabled = busy || !store.ready;
      }

      function fillColumns() {
        const sel = $('#sp-col', settings), prev = sel.value;
        sel.innerHTML = store.columns.map(c => `<option>${App.esc(c)}</option>`).join('');
        if (store.columns.includes(prev)) sel.value = prev;
      }

      const blank = () => summary.set([['Mode', '—'], ['Total output size', '—'], ['Largest file', '—'], ['Header repeated', '—']]);
      const resetOutput = () => { out.clear(); progress.reset(); blank(); progress.status(store.ready ? 'Ready to split' : 'Waiting for a file'); progress.set(0); };

      store.on('change', () => { if (store.status !== 'ready') { resetOutput(); update(); } });
      store.on('ready', () => { fillColumns(); resetOutput(); update(); });
      ['input', 'change'].forEach(ev => settings.addEventListener(ev, update));
      blank();
      if (store.ready) { fillColumns(); progress.status('Ready to split'); }
      update();

      // ------------------------------------------------------------------ run
      S('go').onclick = async () => {
        if (busy || !store.ready) return;
        try { await dest.ensure(); } catch (e) { toast(e.message, 'error'); return; }
        busy = true; update(); out.clear(); progress.reset(); progress.status('Processing…');
        const t0 = performance.now();
        const m = mode(), prefix = safeName($('#sp-prefix', settings).value.trim() || 'part'), base = safeName(baseName(store.name));
        const hasHeader = store.hasHeader, delim = store.delimiter, spec = encSpec();
        const closing = [], opened = [];
        let header = '', cur = null, idx = 0, total = 0;
        const nl = rec => rec.endsWith('\n') ? rec : rec + '\n';
        const open = name => { const s = dest.createSink(name, spec); opened.push(s); if (header) s.write(header); return s; };
        const finish = s => { closing.push(s.close()); };
        const partName = () => `${prefix}_${String(++idx).padStart(3, '0')}_${base}.csv`;

        let colIdx = -1, byValue = null, used = null;
        if (m === 'column') {
          colIdx = store.columns.indexOf($('#sp-col', settings).value);
          if (colIdx < 0) { toast('Pick a column first.', 'error'); busy = false; update(); return; }
          byValue = new Map(); used = new Set();
        }
        const limitRows = m === 'column' || m === 'size' ? 0 : perFile();
        const limitBytes = m === 'size' ? Math.max(1024, Math.floor(val() * 1048576)) : 0;
        let first = true, ok = false, enc = null;

        await App.task('Splitting your file…', 'Grab a coffee while we crunch your CSV.', async setLd => {
          const onProgress = p => { progress.set(p); progress.status(`Processing… ${Math.round(p * 100)}%`); setLd(p); };
          try {
            const res = await App.scanRecords(store.file, store.encoding, rec => {
              if (first) { first = false; if (hasHeader) { header = nl(rec); return; } }
              rec = nl(rec); total++;
              if (m === 'column') {
                const f = CSV.parseRecord(rec, delim), v = f[colIdx] == null ? '' : f[colIdx];
                let s = byValue.get(v);
                if (!s) {
                  if (byValue.size >= 500) throw new Error('This column has more than 500 distinct values. Pick a column with fewer unique values.');
                  let name = `${prefix}_${safeName(v || '(empty)')}_${base}.csv`, n = 1;
                  while (used.has(name.toLowerCase())) name = `${prefix}_${safeName(v || '(empty)')}-${++n}_${base}.csv`;
                  used.add(name.toLowerCase()); s = open(name); byValue.set(v, s);
                }
                s.write(rec); s.rows++;
              } else if (m === 'size') {
                if (cur && cur.rows > 0 && cur.size + cur.enc.byteLen(rec) > limitBytes) { finish(cur); cur = null; }
                if (!cur) cur = open(partName());
                cur.write(rec); cur.rows++;
              } else {
                if (!cur) cur = open(partName());
                cur.write(rec); cur.rows++;
                if (cur.rows >= limitRows) { finish(cur); cur = null; }
              }
            }, { onProgress });
            ok = res.ok;
            if (cur) { finish(cur); cur = null; }
            if (m === 'column') byValue.forEach(finish);
            const outputs = await Promise.all(closing);
            if (m === 'column') outputs.sort((a, b) => a.name.localeCompare(b.name));
            enc = opened[0] && opened[0].enc;
            out.show(outputs, { folderName: dest.dirName });
            const secs = ((performance.now() - t0) / 1000).toFixed(1);
            progress.set(1); progress.stats(fmt(total), fmt(outputs.length), secs);
            progress.status(`Done: ${fmt(total)} rows → ${fmt(outputs.length)} file${outputs.length === 1 ? '' : 's'}`, 'ok');
            const totalSize = outputs.reduce((s, o) => s + o.size, 0);
            summary.set([
              ['Mode', { rows: 'Rows per file', parts: 'Number of files', size: 'Max file size', column: 'By column value' }[m]],
              ['Total output size', fmtSize(totalSize)],
              ['Largest file', fmtSize(Math.max(...outputs.map(o => o.size)))],
              ['Header repeated', hasHeader ? 'Yes' : 'No'],
            ]);
            App.warnLossy(enc);
            if (dest.mode === 'folder') toast(`Saved ${fmt(outputs.length)} file${outputs.length === 1 ? '' : 's'} to “${dest.dirName}”`, 'ok');
          } catch (e) {
            await Promise.allSettled(opened.map(s => s.close()));
            progress.status('Failed: ' + e.message, 'err');
            throw e;
          }
        });
        busy = false; update();
      };
    },

    pick() { store.pick(); },
    acceptFiles(files) { store.set(files[0]); },
  });
})();
