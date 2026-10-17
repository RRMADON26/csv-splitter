/* Transform tool: clean → filter → de-duplicate → sample → pick / rename / reorder columns. */
(function () {
  'use strict';
  const { $, $$, h, fmt, fmtSize, icon, toast, esc } = App;
  const store = App.file;

  const OPS = [
    ['eq', 'equals'], ['ne', 'does not equal'], ['contains', 'contains'], ['ncontains', 'does not contain'],
    ['starts', 'starts with'], ['ends', 'ends with'], ['gt', 'is greater than'], ['gte', 'is at least'],
    ['lt', 'is less than'], ['lte', 'is at most'], ['empty', 'is empty'], ['nempty', 'is not empty'], ['regex', 'matches regex'],
  ];
  const NO_VALUE = new Set(['empty', 'nempty']);
  const toNum = s => { if (s == null) return null; const t = String(s).trim(); if (t === '') return null; const n = Number(t); return Number.isFinite(n) ? n : null; };

  function compileRule(r, cs) {
    const i = r.col, norm = cs ? (s => s) : (s => s.toLowerCase()), v = r.val == null ? '' : String(r.val), nv = norm(v), vn = toNum(v);
    const get = f => (f[i] == null ? '' : f[i]);
    switch (r.op) {
      case 'eq': return f => { const a = get(f); return norm(a) === nv || (vn !== null && toNum(a) === vn); };
      case 'ne': return f => { const a = get(f); return !(norm(a) === nv || (vn !== null && toNum(a) === vn)); };
      case 'contains': return f => norm(get(f)).indexOf(nv) !== -1;
      case 'ncontains': return f => norm(get(f)).indexOf(nv) === -1;
      case 'starts': return f => norm(get(f)).startsWith(nv);
      case 'ends': return f => norm(get(f)).endsWith(nv);
      case 'empty': return f => get(f).trim() === '';
      case 'nempty': return f => get(f).trim() !== '';
      case 'regex': { const re = new RegExp(v, cs ? '' : 'i'); return f => re.test(get(f)); }
      default: {
        const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
        const test = { gt: c => c > 0, gte: c => c >= 0, lt: c => c < 0, lte: c => c <= 0 }[r.op];
        return f => { const a = get(f), an = toNum(a); return test(an !== null && vn !== null ? cmp(an, vn) : cmp(norm(a), nv)); };
      }
    }
  }
  const regexError = r => { if (r.op !== 'regex') return ''; try { new RegExp(r.val || ''); return ''; } catch (e) { return e.message; } };

  /** Build a stateful row processor from a config. */
  function buildPipeline(cfg, opts = {}) {
    const P = { counts: { read: 0, filtered: 0, dups: 0, sampledOut: 0, written: 0 }, done: false };
    const c = P.counts;
    const clean = cfg.clean.on ? (cfg.clean.trim || cfg.clean.lines ? (v => { if (cfg.clean.lines) v = v.replace(/\s*[\r\n]+\s*/g, ' '); return cfg.clean.trim ? v.trim() : v; }) : null) : null;
    let pred = null;
    if (cfg.filter.on && cfg.filter.rules.length) {
      const ps = cfg.filter.rules.map(r => compileRule(r, cfg.filter.cs));
      pred = cfg.filter.any ? (f => ps.some(p => p(f))) : (f => ps.every(p => p(f)));
    }
    let seen = null, keyOf = null;
    if (cfg.dedup.on) {
      seen = new Set();
      const norm = v => { if (cfg.dedup.trim) v = v.trim(); return cfg.dedup.ci ? v.toLowerCase() : v; };
      keyOf = cfg.dedup.cols ? (f => cfg.dedup.cols.map(i => norm(f[i] == null ? '' : f[i])).join('\u0001')) : (f => f.map(norm).join('\u0001'));
    }
    const proj = cfg.columns.on ? (f => cfg.columns.map.map(i => (f[i] == null ? '' : f[i]))) : (f => f);
    const smp = cfg.sample.on && !(opts.preview && (cfg.sample.mode === 'random' || cfg.sample.mode === 'percent')) ? cfg.sample : null;
    const n = smp ? Math.max(1, Math.floor(smp.n)) : 0;
    let passed = 0, reservoir = null;
    if (smp && smp.mode === 'random') reservoir = [];
    P.process = f => {
      c.read++;
      if (clean) f = f.map(clean);
      if (pred && !pred(f)) { c.filtered++; return null; }
      if (seen) { const k = keyOf(f); if (seen.has(k)) { c.dups++; return null; } seen.add(k); }
      if (smp) {
        passed++;
        if (smp.mode === 'first') { if (passed > n) { c.sampledOut++; P.done = true; return null; } if (passed === n) P.done = true; }
        else if (smp.mode === 'nth') { if (passed % n !== 0) { c.sampledOut++; return null; } }
        else if (smp.mode === 'percent') { if (Math.random() * 100 >= smp.n) { c.sampledOut++; return null; } }
        else if (reservoir) {
          const row = proj(f);
          if (reservoir.length < n) reservoir.push([passed, row]);
          else { const j = Math.floor(Math.random() * passed); if (j < n) reservoir[j] = [passed, row]; }
          return null;
        }
      }
      c.written++; return proj(f);
    };
    P.finalize = () => {
      if (!reservoir) return [];
      reservoir.sort((a, b) => a[0] - b[0]);
      c.sampledOut += passed - reservoir.length; c.written += reservoir.length;
      return reservoir.map(x => x[1]);
    };
    return P;
  }

  App.register({
    id: 'transform', label: 'Transform', icon: 'transform',
    short: 'Transform a CSV file', blurb: 'Clean, filter, de-duplicate, sample and pick columns', verb: 'Transform File',
    hero: {
      points: [
        'Clean cells, filter rows, remove duplicates and take a sample, in that order.',
        'Keep, rename and reorder columns. The preview updates as you change each step.',
        'Choose the delimiter, encoding and line endings of the result.',
      ],
    },

    mount(root) {
      const st = { rules: [], dedupCols: new Set(), cols: [] };
      const dest = App.destinationPicker();
      const progress = App.progressCard(['rows read', 'rows kept', 'seconds']);
      const out = App.resultPanel({ zipBase: () => 'transformed' });
      const summary = App.summaryCard('What Happened');
      const dz = App.dropzoneTile({ onPick: () => store.pick(), onFiles: f => f[0] && store.set(f[0]) });
      root.appendChild(App.heroHTML(this, dz));
      const { side, main } = App.workspace(root);

      const step = (id, n, title, body) => h(`
<section class="card step" data-step="${id}">
  <div class="card-h"><div class="st"><span class="sn">${n}</span><div><h2>${title}</h2><small data-sum>Off</small></div></div>
    <label class="switch" title="Turn this step on or off"><input type="checkbox" data-pref="en_${id}" aria-label="Enable: ${title}"><i></i></label></div>
  <div class="step-body" hidden>${body}</div>
</section>`);

      const sClean = step('clean', 1, 'Clean Cells', `
<label class="check"><input type="checkbox" checked data-pref="cl_trim"> Trim spaces around every cell</label>
<label class="check"><input type="checkbox" data-pref="cl_lines"> Replace line breaks inside cells with a space</label>`);
      const sFilter = step('filter', 2, 'Filter Rows', `
<div class="rules" data-rules></div>
<button type="button" class="btn soft sm" data-add-rule>Add Rule</button>
<div class="two mt">
  <div class="fld"><label class="lb">Keep rows that match</label><select data-pref="f_mode"><option value="all">All rules</option><option value="any">Any rule</option></select></div>
  <div class="fld"><label class="lb lb-gap">&nbsp;</label><label class="check"><input type="checkbox" data-pref="f_cs"> Case sensitive</label></div>
</div>`);
      const sDedup = step('dedup', 3, 'Remove Duplicates', `
<div class="fld"><label class="lb">Two rows are duplicates when…</label>
  <select data-pref="d_mode"><option value="row">the whole row is identical</option><option value="cols">the selected columns are identical</option></select></div>
<div class="chips" data-dchips hidden></div>
<div class="two">
  <label class="check"><input type="checkbox" data-pref="d_ci"> Ignore case</label>
  <label class="check"><input type="checkbox" checked data-pref="d_trim"> Ignore surrounding spaces</label>
</div>
<div class="hint">The first occurrence is kept. Needs memory for every unique row.</div>`);
      const sSample = step('sample', 4, 'Sample Rows', `
<div class="two">
  <div class="fld"><label class="lb">Method</label><select data-pref="s_mode">
    <option value="first">First N rows</option><option value="random">Random N rows</option>
    <option value="percent">Random percentage</option><option value="nth">Every Nth row</option></select></div>
  <div class="fld"><label class="lb" data-s-label>Rows</label><input type="number" min="1" value="1000" data-pref="s_n"></div>
</div>
<div class="hint" data-s-hint></div>`);
      const sCols = step('columns', 5, 'Columns', `
<div class="col-tools"><button type="button" class="link" data-all>Select All</button><button type="button" class="link" data-none>Select None</button><button type="button" class="link" data-reset>Reset</button></div>
<div class="cols-list" data-cols></div>`);
      const steps = h('<div class="steps"></div>');
      [sClean, sFilter, sDedup, sSample, sCols].forEach(s => steps.appendChild(s));

      const fc = App.fileCard(store);
      const prev = h(`
<section class="card"><div class="card-h"><h2>Live Preview</h2><span class="link" data-pnote></span></div>
  <div class="empty" data-empty>Choose a file to see the result of your steps.</div>
  <div class="tbl-wrap short" data-pv hidden></div></section>`);
      const outCard = h(`
<section class="card" data-settings>
  <div class="card-h"><h2>Output</h2></div>
  <div data-presets></div>
  <div data-out></div>
  <div class="two">
    <div class="fld"><label class="lb" for="tf-name">File name</label><input id="tf-name" type="text" value="transformed.csv" data-pref="outName"></div>
    <div class="fld"><label class="lb lb-gap">&nbsp;</label><label class="check"><input type="checkbox" checked data-pref="outHeader"> Write a header row</label></div>
  </div>
  <div class="fld"><label class="lb">Save to</label><div data-dest></div></div>
  <button class="btn accent block" type="button" data-go disabled>Transform File</button>
  <div class="hint center" data-note></div>
</section>`);
      $('[data-out]', outCard).innerHTML = App.OUT_OPTIONS_HTML;
      $('[data-dest]', outCard).appendChild(dest.el);
      [fc, outCard].forEach(n => side.appendChild(n));
      [steps, prev, progress.el, out.exp, summary.el].forEach(n => main.appendChild(n));
      // one column on narrow screens: set up the steps first, then the output and its Transform File button
      const narrow = matchMedia('(max-width: 1000px)');
      const place = () => { if (narrow.matches) prev.after(outCard); else if (outCard.parentNode !== side) side.appendChild(outCard); };
      narrow.addEventListener('change', place); place();

      const pref = k => $(`[data-pref="${k}"]`, root);
      const on = id => pref('en_' + id).checked;

      // ---------------------------------------------------------------- state ↔ UI
      function resetCols() { st.cols = store.columns.map((name, i) => ({ src: i, name, out: name, keep: true })); st.rules = st.rules.filter(r => r.col < store.columns.length); st.dedupCols = new Set([...st.dedupCols].filter(i => i < store.columns.length)); }
      const colOptions = (sel) => store.columns.map((c, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(c)}</option>`).join('');

      function renderRules() {
        const box = $('[data-rules]', sFilter); box.innerHTML = '';
        if (!st.rules.length) box.innerHTML = '<div class="empty sm">No rules yet. Add one to start filtering.</div>';
        st.rules.forEach((r, ri) => {
          const err = regexError(r);
          const el = h(`<div class="rule"><select data-r="col" aria-label="Column">${colOptions(r.col)}</select>
<select data-r="op" aria-label="Condition">${OPS.map(([v, l]) => `<option value="${v}" ${v === r.op ? 'selected' : ''}>${l}</option>`).join('')}</select>
<input data-r="val" type="text" placeholder="value" value="${esc(r.val)}" ${NO_VALUE.has(r.op) ? 'hidden' : ''} class="${err ? 'bad' : ''}" title="${esc(err)}" aria-label="Value">
<button type="button" class="icon-btn" data-r="rm" title="Remove rule">${icon('x')}</button></div>`);
          $('[data-r="col"]', el).onchange = e => { r.col = +e.target.value; changed(); };
          $('[data-r="op"]', el).onchange = e => { r.op = e.target.value; renderRules(); changed(); };
          $('[data-r="val"]', el).oninput = e => { r.val = e.target.value; const er = regexError(r); e.target.classList.toggle('bad', !!er); e.target.title = er; changed(); };
          $('[data-r="rm"]', el).onclick = () => { st.rules.splice(ri, 1); renderRules(); changed(); };
          box.appendChild(el);
        });
      }
      function renderChips() {
        const box = $('[data-dchips]', sDedup); box.hidden = pref('d_mode').value !== 'cols'; box.innerHTML = '';
        store.columns.forEach((c, i) => {
          const b = h(`<button type="button" class="chip ${st.dedupCols.has(i) ? 'on' : ''}">${esc(c)}</button>`);
          b.onclick = () => { st.dedupCols.has(i) ? st.dedupCols.delete(i) : st.dedupCols.add(i); b.classList.toggle('on'); changed(); };
          box.appendChild(b);
        });
      }
      function renderCols() {
        const box = $('[data-cols]', sCols); box.innerHTML = '';
        st.cols.forEach((c, i) => {
          const el = h(`<div class="colrow ${c.keep ? '' : 'off'}"><input type="checkbox" ${c.keep ? 'checked' : ''} aria-label="Keep ${esc(c.name)}">
<div class="cr-n"><input type="text" value="${esc(c.out)}" aria-label="Output name for ${esc(c.name)}">${c.out !== c.name ? `<small>was “${esc(c.name)}”</small>` : ''}</div>
<button type="button" class="icon-btn" data-a="up" ${i === 0 ? 'disabled' : ''} title="Move up">${icon('up')}</button>
<button type="button" class="icon-btn" data-a="down" ${i === st.cols.length - 1 ? 'disabled' : ''} title="Move down">${icon('down')}</button></div>`);
          $('input[type=checkbox]', el).onchange = e => { c.keep = e.target.checked; el.classList.toggle('off', !c.keep); changed(); };
          $('.cr-n input', el).oninput = e => { c.out = e.target.value; changed(); };
          $('.cr-n input', el).onchange = () => renderCols();
          $('[data-a="up"]', el).onclick = () => { [st.cols[i - 1], st.cols[i]] = [st.cols[i], st.cols[i - 1]]; renderCols(); changed(); };
          $('[data-a="down"]', el).onclick = () => { [st.cols[i + 1], st.cols[i]] = [st.cols[i], st.cols[i + 1]]; renderCols(); changed(); };
          box.appendChild(el);
        });
      }
      $('[data-add-rule]', sFilter).onclick = () => { st.rules.push({ col: 0, op: 'contains', val: '' }); renderRules(); changed(); };
      $('[data-all]', sCols).onclick = () => { st.cols.forEach(c => c.keep = true); renderCols(); changed(); };
      $('[data-none]', sCols).onclick = () => { st.cols.forEach(c => c.keep = false); renderCols(); changed(); };
      $('[data-reset]', sCols).onclick = () => { resetCols(); renderCols(); changed(); };

      // ---------------------------------------------------------------- config
      function readConfig() {
        const kept = st.cols.filter(c => c.keep);
        return {
          clean: { on: on('clean'), trim: pref('cl_trim').checked, lines: pref('cl_lines').checked },
          filter: { on: on('filter'), rules: st.rules, any: pref('f_mode').value === 'any', cs: pref('f_cs').checked },
          dedup: { on: on('dedup'), cols: pref('d_mode').value === 'cols' ? [...st.dedupCols].sort((a, b) => a - b) : null, ci: pref('d_ci').checked, trim: pref('d_trim').checked },
          sample: { on: on('sample'), mode: pref('s_mode').value, n: parseFloat(pref('s_n').value) || 1 },
          columns: { on: on('columns'), map: kept.map(c => c.src), names: kept.map(c => c.out) },
        };
      }
      const outNames = cfg => cfg.columns.on ? cfg.columns.names : store.columns;

      function problems(cfg) {
        if (cfg.filter.on && cfg.filter.rules.some(r => regexError(r))) return 'A filter rule has an invalid regular expression.';
        if (cfg.dedup.on && cfg.dedup.cols && !cfg.dedup.cols.length) return 'Select at least one column for de-duplication.';
        if (cfg.columns.on && !cfg.columns.map.length) return 'Keep at least one column.';
        if (cfg.sample.on && cfg.sample.mode === 'percent' && (cfg.sample.n <= 0 || cfg.sample.n > 100)) return 'The percentage must be between 0 and 100.';
        return '';
      }

      function summaries(cfg) {
        const S = (id, t) => { const el = $(`[data-step="${id}"]`, root); $('[data-sum]', el).textContent = t; el.classList.toggle('active', on(id)); $('.step-body', el).hidden = !on(id); };
        S('clean', !on('clean') ? 'Off' : [cfg.clean.trim && 'Trim spaces', cfg.clean.lines && 'flatten line breaks'].filter(Boolean).join(', ') || 'Nothing selected');
        const nr = cfg.filter.rules.length;
        S('filter', !on('filter') ? 'Off' : nr ? `${nr} rule${nr > 1 ? 's' : ''}, ${cfg.filter.any ? 'any' : 'all'} must match` : 'No rules yet');
        S('dedup', !on('dedup') ? 'Off' : cfg.dedup.cols ? `By ${cfg.dedup.cols.length} column${cfg.dedup.cols.length === 1 ? '' : 's'}` : 'Whole row');
        const m = cfg.sample.mode;
        S('sample', !on('sample') ? 'Off' : { first: `First ${fmt(cfg.sample.n)} rows`, random: `Random ${fmt(cfg.sample.n)} rows`, percent: `Random ${cfg.sample.n}%`, nth: `Every ${fmt(cfg.sample.n)}th row` }[m]);
        const k = cfg.columns.map.length;
        S('columns', !on('columns') ? 'Off' : `${k} of ${st.cols.length} columns`);
        $('[data-s-label]', sSample).textContent = m === 'percent' ? 'Percent (%)' : m === 'nth' ? 'N' : 'Rows';
        $('[data-s-hint]', sSample).textContent = m === 'random' || m === 'percent' ? 'Random: you’ll get a different sample every run. The preview doesn’t apply it.' : m === 'first' ? 'Stops reading as soon as enough rows are found.' : '';
      }

      // ---------------------------------------------------------------- live preview
      function updatePreview() {
        const cfg = readConfig(), wrap = $('[data-pv]', prev), empty = $('[data-empty]', prev), note = $('[data-pnote]', prev);
        summaries(cfg);
        const pb = problems(cfg);
        $('[data-note]', outCard).textContent = store.ready ? pb : 'Start by choosing a CSV file.';
        $('[data-go]', outCard).disabled = busy || !store.ready || !!pb;
        if (!store.ready) { wrap.hidden = true; empty.hidden = false; note.textContent = ''; return; }
        if (pb) { wrap.hidden = true; empty.hidden = false; empty.textContent = pb; return; }
        empty.textContent = '';
        const P = buildPipeline(cfg, { preview: true }), rows = [];
        for (const f of store.sample) { if (P.done) break; const r = P.process(f.slice()); if (r) rows.push(r); }
        const names = outNames(cfg);
        wrap.innerHTML = `<table class="tbl pv"><thead><tr>${names.map(n => `<th><span class="cn">${esc(n)}</span></th>`).join('')}</tr></thead><tbody>${rows.slice(0, 8).map(r => `<tr>${names.map((_, i) => { const v = r[i] == null ? '' : r[i]; return v === '' ? '<td class="nul">empty</td>' : `<td title="${esc(v)}">${esc(v.length > 60 ? v.slice(0, 60) + '…' : v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
        wrap.hidden = rows.length === 0; empty.hidden = rows.length > 0;
        if (!rows.length) empty.textContent = 'No rows survive these steps in the first rows of the file.';
        note.textContent = `${fmt(rows.length)} of the first ${fmt(store.sample.length)} rows pass`;
      }
      const changed = App.debounce(updatePreview, 120);
      let busy = false;

      root.addEventListener('input', changed); root.addEventListener('change', e => {
        if (e.target === pref('d_mode')) renderChips();
        changed();
      });

      // ---------------------------------------------------------------- store events
      store.on('ready', () => {
        resetCols(); renderRules(); renderChips(); renderCols();
        pref('outHeader').checked = store.hasHeader;
        out.clear(); progress.reset(); blank(); progress.status('Ready'); updatePreview();
      });
      store.on('change', () => { if (!store.ready) { out.clear(); progress.reset(); blank(); progress.status('Waiting for a file'); updatePreview(); } });
      const blank = () => summary.set([['Rows read', '—'], ['Removed by filter', '—'], ['Duplicates removed', '—'], ['Left out by sample', '—'], ['Rows written', '—']]);

      $('[data-presets]', outCard).appendChild(App.presetBar('transform', () => root, () => { renderRules(); renderChips(); renderCols(); updatePreview(); }, {
        collect: () => ({
          rules: st.rules.map(r => ({ col: store.columns[r.col], op: r.op, val: r.val })),
          dedup: [...st.dedupCols].map(i => store.columns[i]),
          cols: st.cols.map(c => ({ name: store.columns[c.src], out: c.out, keep: c.keep })),
        }),
        apply: x => {
          if (!store.ready) return;
          const idx = n => store.columns.indexOf(n);
          st.rules = (x.rules || []).filter(r => idx(r.col) >= 0).map(r => ({ col: idx(r.col), op: r.op, val: r.val }));
          st.dedupCols = new Set((x.dedup || []).map(idx).filter(i => i >= 0));
          const saved = (x.cols || []).filter(c => idx(c.name) >= 0), seen = new Set(saved.map(c => idx(c.name)));
          resetCols();
          const base = st.cols.slice();
          st.cols = saved.map(c => ({ src: idx(c.name), name: c.name, out: c.out, keep: c.keep })).concat(base.filter(c => !seen.has(c.src)));
        },
      }));

      // ---------------------------------------------------------------- run
      $('[data-go]', outCard).onclick = async () => {
        const cfg = readConfig(); if (busy || !store.ready || problems(cfg)) return;
        try { await dest.ensure(); } catch (e) { toast(e.message, 'error'); return; }
        busy = true; updatePreview(); out.clear(); progress.reset(); progress.status('Transforming…');
        const o = App.readOutputOptions(outCard, store), od = o.delimiter, qa = o.quoteAll, eol = o.eol;
        let name = pref('outName').value.trim() || 'transformed.csv';
        if (!/\.(csv|tsv|txt)$/i.test(name)) name += '.csv';
        name = App.safeName(name);
        const P = buildPipeline(cfg), t0 = performance.now(), hasH = store.hasHeader;
        let first = true, sink = null;
        await App.task('Transforming your file…', 'Grab a coffee while we reshape your CSV.', async setLd => {
          try {
            sink = dest.createSink(name, o.enc);
            if (pref('outHeader').checked) sink.write(CSV.formatRecord(outNames(cfg), od, qa) + eol);
            const delim = store.delimiter;
            await App.scanRecords(store.file, store.encoding, rec => {
              if (first) { first = false; if (hasH) return; }
              const r = P.process(CSV.parseRecord(rec, delim));
              if (r) sink.write(CSV.formatRecord(r, od, qa) + eol);
            }, { isCancelled: () => P.done, onProgress: p => { progress.set(p); progress.status('Transforming…'); setLd(p); } });
            for (const r of P.finalize()) sink.write(CSV.formatRecord(r, od, qa) + eol);
            sink.rows = P.counts.written;
            const res = await sink.close();
            const c = P.counts, secs = ((performance.now() - t0) / 1000).toFixed(1), empty = c.written === 0;
            out.show([res], { folderName: dest.dirName, announce: !empty });
            progress.set(1); progress.stats(fmt(c.read), fmt(c.written), secs);
            progress.status(empty ? 'Done, but no rows matched your steps.' : `Done. Wrote ${fmt(c.written)} rows.`, empty ? 'err' : 'ok');
            if (empty) toast('No rows survived your steps, so the output only has a header row. Check your filter rules or turn a step off.', 'error', 9000);
            summary.set([['Rows read', fmt(c.read) + (P.done ? ' (stopped early)' : '')], ['Removed by filter', fmt(c.filtered)], ['Duplicates removed', fmt(c.dups)], ['Left out by sample', fmt(c.sampledOut)], ['Rows written', fmt(c.written)]]);
            App.warnLossy(sink.enc);
            if (dest.mode === 'folder') toast(`Saved “${res.name}” to “${dest.dirName}”`, 'ok');
          } catch (e) {
            if (e instanceof RangeError) e = new Error('Too many unique rows to track in memory. Turn off “Remove duplicates” or filter first.');
            progress.status('Failed: ' + e.message, 'err'); if (sink) sink.close().catch(() => {}); throw e;
          }
        });
        busy = false; updatePreview();
      };

      resetCols(); renderRules(); renderChips(); renderCols(); blank(); progress.status(store.ready ? 'Ready' : 'Waiting for a file'); updatePreview();
    },

    pick() { store.pick(); },
    acceptFiles(files) { store.set(files[0]); },
  });

  App.transformPipeline = buildPipeline; // exposed for tests
})();
