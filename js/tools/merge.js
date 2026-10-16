/* Merge tool: combine several CSV files into one. */
(function () {
  'use strict';
  const { $, $$, h, fmt, fmtSize, icon, toast, esc } = App;
  let uid = 0;

  App.register({
    id: 'merge', label: 'Merge', icon: 'merge',
    short: 'Merge CSV files', blurb: 'Combine several files into one', verb: 'Merge', stepFile: 'Add Files', cta: 'Add Files…',
    subtitle() { const n = this._count ? this._count() : 0; return n ? `${n} file${n > 1 ? 's' : ''} added` : 'No files added'; },
    hasFile() { return this._count ? this._count() > 0 : false; },
    hero: {
      points: [
        'Drop in as many files as you like, then drag them into the order you want.',
        'Files with columns in a different order still line up when you match columns by name.',
        'Optionally add a column that records which file each row came from.',
      ],
    },

    mount(root) {
      const state = { files: [], busy: false };
      const input = h('<input type="file" multiple hidden accept=".csv,.tsv,.txt,text/csv,text/plain">');
      document.body.appendChild(input);
      const dest = App.destinationPicker();
      const progress = App.progressCard(['rows', 'files', 'seconds']);
      const out = App.resultPanel({ zipBase: () => 'merged' });
      const summary = App.summaryCard('Summary', 'Start Over', () => { state.files = []; render(); resetOutput(); });
      const dz = App.dropzoneTile({ multiple: true, sub: 'or drop them anywhere on this page', onPick: () => input.click(), onFiles: f => addFiles(f) });

      root.appendChild(App.heroHTML(this, dz));
      const { side, main } = App.workspace(root);

      const filesCard = h(`
<section class="card" data-files>
  <div class="card-h"><h2>Files to Merge</h2><button type="button" class="link" data-clear hidden>Remove All</button></div>
  <div class="empty" data-empty>No files yet. Add two or more CSV files.</div>
  <div class="mf-list" data-list></div>
  <button type="button" class="btn soft sm block mt" data-add hidden>Add Files…</button>
</section>`);
      const settings = h(`
<section class="card" data-settings>
  <div class="card-h"><h2>Settings</h2></div>
  <div data-presets></div>
  <label class="check"><input type="checkbox" checked data-pref="hasHeader"> Files have a header row</label>
  <div class="fld"><label class="lb" for="mg-match">Column matching</label>
    <select id="mg-match" data-pref="match">
      <option value="asis">Keep columns as they are</option>
      <option value="name">Match columns by name</option>
    </select>
    <div class="hint" data-match-hint></div></div>
  <label class="check"><input type="checkbox" data-pref="addSource"> Add a column with the source file name</label>
  <div class="fld" data-source-name hidden><input type="text" value="source_file" data-pref="sourceName" aria-label="Source column name"></div>
  <div data-out></div>
  <div class="fld"><label class="lb" for="mg-name">Output file name</label><input id="mg-name" type="text" value="merged.csv" data-pref="outName"></div>
  <div class="fld"><label class="lb">Save to</label><div data-dest></div></div>
  <button class="btn accent block" type="button" data-go disabled>Merge Files</button>
  <div class="hint center" data-note></div>
</section>`);
      $('[data-out]', settings).innerHTML = App.OUT_OPTIONS_HTML;
      $('[data-dest]', settings).appendChild(dest.el);
      $('[data-presets]', settings).appendChild(App.presetBar('merge', () => settings, () => render()));
      side.appendChild(settings);
      [filesCard, progress.el, out.exp, out.results, summary.el].forEach(n => main.appendChild(n));

      const G = k => $(`[data-${k}]`, settings);
      const pref = k => $(`[data-pref="${k}"]`, settings);
      const hasHeader = () => pref('hasHeader').checked;
      const resetOutput = () => { out.clear(); progress.reset(); progress.set(0); progress.status(state.files.length ? 'Ready to merge' : 'Waiting for files'); blank(); };
      const blank = () => summary.set([['Files merged', '—'], ['Total rows', '—'], ['Output columns', '—'], ['Column mismatches', '—']]);

      // ---------------------------------------------------------------- files
      async function addFiles(list) {
        const arr = Array.from(list).filter(f => f.size >= 0);
        if (!arr.length) return;
        for (const f of arr) {
          try {
            const enc = await App.detectEncoding(f);
            const head = new TextDecoder(enc).decode(await f.slice(0, 65536).arrayBuffer());
            const delim = CSV.detectDelimiter(head);
            const first = CSV.splitRecords(head, 1)[0] || '';
            state.files.push({ id: ++uid, file: f, enc, delim, header: CSV.parseRecord(first, delim), rows: null });
          } catch (e) { toast(`Could not read ${f.name}: ${e.message}`, 'error'); }
        }
        resetOutput(); render();
      }
      input.onchange = () => { addFiles(input.files); input.value = ''; };
      $('[data-add]', filesCard).onclick = () => input.click();
      $('[data-clear]', filesCard).onclick = () => { state.files = []; resetOutput(); render(); };

      const sameHeader = (a, b) => a.header.length === b.header.length && (!hasHeader() || a.header.every((x, i) => x === b.header[i]));

      function render() {
        const list = $('[data-list]', filesCard), files = state.files, byName = pref('match').value === 'name';
        $('[data-empty]', filesCard).hidden = files.length > 0;
        $('[data-clear]', filesCard).hidden = !files.length;
        $('[data-add]', filesCard).hidden = !files.length;
        list.innerHTML = '';
        files.forEach((it, i) => {
          const same = i === 0 || sameHeader(files[0], it);
          const badge = i === 0 ? '<span class="pill">Reference</span>'
            : same ? `<span class="pill ok">${icon('check')}Same columns</span>`
              : byName ? `<span class="pill">${icon('info')}Matched by name</span>`
                : `<span class="pill warn" title="Has ${it.header.length} columns; the first file has ${files[0].header.length}">${icon('warn')}Different columns</span>`;
          const row = h(`
<div class="mf" draggable="true" data-id="${it.id}">
  <span class="mf-n">${i + 1}</span>
  <div class="mf-i"><div class="n" title="${esc(it.file.name)}">${esc(it.file.name)}</div>
    <div class="s">${fmtSize(it.file.size)}, ${it.enc.toUpperCase()}, ${App.DELIM_LABEL[it.delim] || 'custom'}-separated, ${it.header.length} column${it.header.length === 1 ? '' : 's'}${it.rows != null ? `, ${fmt(it.rows)} rows` : ''}</div><div class="mf-t">${badge}</div></div>
  <div class="mf-b"><button type="button" class="icon-btn" data-a="up" title="Move up" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
  <button type="button" class="icon-btn" data-a="down" title="Move down" ${i === files.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
  <button type="button" class="icon-btn" data-a="rm" title="Remove">${icon('x')}</button></div>
</div>`);
          const move = d => { const j = i + d; [files[i], files[j]] = [files[j], files[i]]; render(); };
          $('[data-a="up"]', row).onclick = () => move(-1);
          $('[data-a="down"]', row).onclick = () => move(1);
          $('[data-a="rm"]', row).onclick = () => { files.splice(i, 1); resetOutput(); render(); };
          row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-mf', String(it.id)); row.classList.add('drag'); });
          row.addEventListener('dragend', () => row.classList.remove('drag'));
          row.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/x-mf')) { e.preventDefault(); row.classList.add('over'); } });
          row.addEventListener('dragleave', () => row.classList.remove('over'));
          row.addEventListener('drop', e => {
            const id = +e.dataTransfer.getData('text/x-mf'); if (!id) return;
            e.preventDefault(); e.stopPropagation();
            const from = files.findIndex(f => f.id === id); if (from < 0 || from === i) return;
            files.splice(i, 0, files.splice(from, 1)[0]); render();
          });
          list.appendChild(row);
        });
        // settings state
        const headerless = !hasHeader();
        if (headerless && pref('match').value === 'name') pref('match').value = 'asis';
        pref('match').querySelector('[value="name"]').disabled = headerless;
        $('[data-match-hint]', settings).textContent = headerless ? 'Matching by name needs header rows.'
          : pref('match').value === 'name' ? 'Output columns = all column names found, in order of appearance. Missing values stay empty.'
            : 'Rows are appended as they are. Files should have the same columns.';
        $('[data-source-name]', settings).hidden = !pref('addSource').checked;
        const mism = files.slice(1).filter(f => !sameHeader(files[0], f)).length;
        $('[data-note]', settings).textContent = files.length < 2 ? 'Add at least two files to merge.'
          : mism && pref('match').value !== 'name' && !headerless ? `${mism} file${mism > 1 ? 's have' : ' has'} different columns. Consider “Match columns by name”.` : '';
        G('go').disabled = state.busy || files.length < 2;
        App.refreshViews();
      }
      settings.addEventListener('input', render); settings.addEventListener('change', render);

      // ---------------------------------------------------------------- run
      G('go').onclick = async () => {
        if (state.busy || state.files.length < 2) return;
        try { await dest.ensure(); } catch (e) { toast(e.message, 'error'); return; }
        state.busy = true; render(); out.clear(); progress.reset(); progress.status('Merging…');
        const t0 = performance.now(), files = state.files, header = hasHeader();
        const o = App.readOutputOptions(settings, { delimiter: files[0].delim });
        const od = o.delimiter, eol = o.eol, qa = o.quoteAll;
        const byName = pref('match').value === 'name' && header;
        const addSource = pref('addSource').checked, srcName = pref('sourceName').value.trim() || 'source_file';
        let outName = pref('outName').value.trim() || 'merged.csv';
        if (!/\.(csv|tsv|txt)$/i.test(outName)) outName += '.csv';
        outName = App.safeName(outName);
        // output columns
        let cols;
        if (byName) { const seen = new Set(); cols = []; files.forEach(f => f.header.forEach(c => { if (!seen.has(c)) { seen.add(c); cols.push(c); } })); }
        else cols = files[0].header.slice();
        const width = cols.length;
        const totalBytes = files.reduce((s, f) => s + f.file.size, 0);
        let done = 0, totalRows = 0, sink = null, enc = null;

        await App.task('Merging your files…', 'Grab a coffee while we combine them.', async setLd => {
          try {
            sink = dest.createSink(outName, o.enc); enc = sink.enc;
            if (header) sink.write(CSV.formatRecord(addSource ? cols.concat(srcName) : cols, od, qa) + eol);
            for (let fi = 0; fi < files.length; fi++) {
              const it = files[fi];
              const raw = !byName && !addSource && !qa && it.delim === od;
              const idx = byName ? cols.map(c => it.header.indexOf(c)) : null;
              const srcField = addSource ? CSV.formatField(it.file.name, od, qa) : '';
              let first = true, n = 0;
              const body = r => { let e = r.length; if (r.charCodeAt(e - 1) === 10) e--; if (e && r.charCodeAt(e - 1) === 13) e--; return e === r.length ? r : r.slice(0, e); };
              await App.scanRecords(it.file, it.enc, rec => {
                if (first) { first = false; if (header) return; }
                n++;
                if (raw) { sink.write(body(rec) + eol); return; }
                const f = CSV.parseRecord(rec, it.delim);
                let row = f;
                if (idx) { row = new Array(width); for (let k = 0; k < width; k++) row[k] = idx[k] < 0 ? '' : (f[idx[k]] == null ? '' : f[idx[k]]); }
                sink.write(CSV.formatRecord(row, od, qa) + (addSource ? od + srcField : '') + eol);
              }, { onProgress: p => { const t = (done + p * it.file.size) / totalBytes; progress.set(t); progress.status('Merging…'); setLd(t); } });
              done += it.file.size; it.rows = n; totalRows += n;
            }
            sink.rows = totalRows;
            const res = await sink.close();
            out.show([res], { folderName: dest.dirName });
            const secs = ((performance.now() - t0) / 1000).toFixed(1);
            progress.set(1); progress.stats(fmt(totalRows), fmt(files.length), secs);
            progress.status(`Done. Merged ${fmt(totalRows)} rows from ${fmt(files.length)} files.`, 'ok');
            const mism = files.slice(1).filter(f => !sameHeader(files[0], f)).length;
            summary.set([['Files merged', fmt(files.length)], ['Total rows', fmt(totalRows)], ['Output columns', fmt(width + (addSource ? 1 : 0))],
              ['Column mismatches', byName ? `${mism} (matched by name)` : (mism ? `${mism} file${mism > 1 ? 's' : ''}` : 'None')]]);
            App.warnLossy(enc);
            if (dest.mode === 'folder') toast(`Saved “${res.name}” to “${dest.dirName}”`, 'ok');
          } catch (e) { progress.status('Failed: ' + e.message, 'err'); if (sink) sink.close().catch(() => {}); throw e; }
        });
        state.busy = false; render();
      };

      this._count = () => state.files.length;
      resetOutput(); render();
      this.add = addFiles; this.openPicker = () => input.click();
    },

    pick() { this.openPicker ? this.openPicker() : App.file.pick(); },
    acceptFiles(files) { this.add && this.add(files); },
  });
})();
