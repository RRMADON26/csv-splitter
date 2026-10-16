/* Convert tool: CSV ⇄ TSV, JSON, JSON Lines and Excel (.xlsx), with output encodings. */
(function () {
  'use strict';
  const { $, $$, h, fmt, fmtSize, icon, toast, esc } = App;
  const store = App.file;

  const FORMATS = {
    csv: { ext: 'csv', short: 'CSV', label: 'CSV', mime: 'text/csv' },
    tsv: { ext: 'tsv', short: 'TSV', label: 'TSV', mime: 'text/tab-separated-values' },
    json: { ext: 'json', short: 'JSON', label: 'JSON', mime: 'application/json' },
    jsonl: { ext: 'jsonl', short: 'JSONL', label: 'JSON Lines', mime: 'application/x-ndjson' },
    xlsx: { ext: 'xlsx', short: 'Excel', label: 'Excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  };
  const NUM = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;
  const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const digitsOf = s => s.replace(/[^0-9]/g, '').replace(/^0+/, '').length;

  // ----------------------------------------------------------------- JSON
  function uniqueKeys(names) {
    const seen = new Map();
    return names.map(n => { const base = n === '' ? 'column' : n; const c = (seen.get(base) || 0) + 1; seen.set(base, c); return c === 1 ? base : `${base}_${c}`; });
  }
  function jsonValue(v, o) {
    if (v === '') return o.empty === 'null' ? null : o.empty === 'omit' ? undefined : '';
    if (!o.types) return v;
    if (v === 'true') return true; if (v === 'false') return false;
    if (NUM.test(v) && digitsOf(v) <= 15) return Number(v);
    return v;
  }
  function jsonWriter(kind, names, o) {
    const keys = uniqueKeys(names), pretty = o.pretty && kind === 'json';
    const item = f => {
      if (o.shape === 'arrays') return keys.map((_, i) => { const x = jsonValue(f[i] == null ? '' : f[i], { ...o, empty: o.empty === 'omit' ? 'empty' : o.empty }); return x === undefined ? '' : x; });
      const obj = {};
      keys.forEach((k, i) => { const x = jsonValue(f[i] == null ? '' : f[i], o); if (x !== undefined) obj[k] = x; });
      return obj;
    };
    if (kind === 'jsonl') return { head: () => '', row: f => JSON.stringify(item(f)) + '\n', tail: () => '' };
    let first = true;
    return {
      head: () => '[' + (pretty ? '' : '\n'),
      row: f => {
        const body = pretty ? JSON.stringify(item(f), null, 2).replace(/^/gm, '  ') : JSON.stringify(item(f));
        const out = (first ? '' : ',\n') + (pretty ? (first ? '\n' : '') : '') + body;
        first = false; return out;
      },
      tail: () => (first ? '' : '\n') + ']\n',
    };
  }

  // ----------------------------------------------------------------- XLSX
  const xmlEsc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  const attrEsc = s => xmlEsc(s).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

  class Sheet {
    constructor(names, widths, o) {
      this.o = o; this.row = 0; this.parts = []; this.buf = [];
      const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
      this.parts.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0">${o.header ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>`);
      if (o.header) this.add(names, true);
    }
    add(f, isHeader) {
      const r = ++this.row; let x = `<row r="${r}">`;
      for (let i = 0; i < f.length; i++) {
        const v = f[i]; if (v == null || v === '') continue;
        const ref = colName(i) + r;
        if (isHeader) { x += `<c r="${ref}" t="inlineStr" s="1"><is><t>${xmlEsc(v)}</t></is></c>`; continue; }
        if (this.o.numbers && NUM.test(v) && digitsOf(v) <= 15) { x += `<c r="${ref}"><v>${v}</v></c>`; continue; }
        if (this.o.dates) {
          const m = DATE.exec(v);
          if (m) { const t = Date.UTC(+m[1], +m[2] - 1, +m[3]), d = new Date(t); if (d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] && +m[1] >= 1900) { x += `<c r="${ref}" s="2"><v>${t / 86400000 + 25569}</v></c>`; continue; } }
        }
        x += `<c r="${ref}" t="inlineStr"><is><t${/^\s|\s$|\n/.test(v) ? ' xml:space="preserve"' : ''}>${xmlEsc(v)}</t></is></c>`;
      }
      this.buf.push(x + '</row>');
      if (this.buf.length >= 4000) { this.parts.push(this.buf.join('')); this.buf = []; }
    }
    get dataRows() { return this.row - (this.o.header ? 1 : 0); }
    finish() { this.parts.push(this.buf.join('') + '</sheetData></worksheet>'); this.buf = []; return new Blob(this.parts, { type: 'application/xml' }); }
  }

  const sheetName = (n, i) => (n.replace(/[\[\]:*?/\\]/g, '_').slice(0, 28) || 'Sheet1') + (i ? ' ' + (i + 1) : '');
  async function buildXlsx(sheets, name, onProgress) {
    const blobs = sheets.map(s => s.finish());
    const n = blobs.length, REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const files = [
      { name: '[Content_Types].xml', blob: new Blob([`${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${blobs.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`]) },
      { name: '_rels/.rels', blob: new Blob([`${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`]) },
      { name: 'xl/workbook.xml', blob: new Blob([`${head}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${blobs.map((_, i) => `<sheet name="${attrEsc(sheetName(name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`]) },
      { name: 'xl/_rels/workbook.xml.rels', blob: new Blob([`${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${blobs.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`]) },
      { name: 'xl/styles.xml', blob: new Blob([`${head}<styleSheet xmlns="${NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]) },
    ].concat(blobs.map((b, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, blob: b })));
    return App.buildZip(files, { compress: true, onProgress });
  }
  const XLSX_ROWS = () => window.__xlsxRowLimit || 1048576;

  App.register({
    id: 'convert', label: 'Convert', icon: 'convert',
    short: 'Convert a CSV file', blurb: 'Excel, JSON, JSON Lines, TSV and encodings', verb: 'Convert',
    hero: {
      points: [
        'Make a real Excel workbook: bold frozen header, numbers stored as numbers, dates as dates.',
        'Export JSON or JSON Lines, as objects or arrays, with or without type detection.',
        'Change the delimiter or the encoding so accents and symbols survive the trip.',
      ],
    },

    mount(root) {
      const dest = App.destinationPicker();
      const progress = App.progressCard(['rows', 'size', 'seconds']);
      const out = App.resultPanel({ zipBase: () => 'converted' });
      const dz = App.dropzoneTile({ onPick: () => store.pick(), onFiles: f => f[0] && store.set(f[0]) });
      root.appendChild(App.heroHTML(this, dz));
      const { side, main } = App.workspace(root);

      const fc = App.fileCard(store);
      const settings = h(`
<section class="card" data-settings>
  <div class="card-h"><h2>Convert To</h2></div>
  <div data-presets></div>
  <div class="fmts" role="radiogroup" aria-label="Output format">
    ${Object.entries(FORMATS).map(([k, f]) => `<button type="button" role="radio" class="fmt" data-fmt="${k}"><b>${f.short}</b><span>.${f.ext}</span></button>`).join('')}
  </div>
  <input type="hidden" data-pref="format" value="csv">

  <div data-opt="csv tsv">
    <div data-out></div>
  </div>
  <div data-opt="json jsonl" hidden>
    <div class="two">
      <div class="fld"><label class="lb">Rows as</label><select data-pref="j_shape"><option value="objects">Objects {"col": value}</option><option value="arrays">Arrays [value, …]</option></select></div>
      <div class="fld"><label class="lb">Empty cells</label><select data-pref="j_empty"><option value="null">null</option><option value="empty">"" (empty text)</option><option value="omit">Leave out the key</option></select></div>
    </div>
    <div data-opt="json"><div class="fld"><label class="lb">Layout</label><select data-pref="j_pretty"><option value="">Compact: one row per line</option><option value="1">Pretty: fully indented</option></select></div></div>
    <label class="check"><input type="checkbox" checked data-pref="j_types"> Detect numbers and true / false</label>
  </div>
  <div data-opt="xlsx" hidden>
    <div class="fld"><label class="lb" for="cv-sheet">Sheet name</label><input id="cv-sheet" type="text" value="Data" maxlength="28" data-pref="x_sheet"></div>
    <label class="check"><input type="checkbox" checked data-pref="x_nums"> Store numbers as numbers</label>
    <label class="check"><input type="checkbox" checked data-pref="x_dates"> Store YYYY-MM-DD as Excel dates</label>
    <div class="hint" data-x-hint>Excel holds up to 1,048,576 rows per sheet. Longer files continue on extra sheets.</div>
  </div>

  <div class="fld mt"><label class="lb" for="cv-name">File name</label><input id="cv-name" type="text" value="converted.csv" data-pref="outName"></div>
  <div class="fld"><label class="lb">Save to</label><div data-dest></div></div>
  <button class="btn accent block" type="button" data-go disabled>Convert File</button>
  <div class="hint center" data-note></div>
</section>`);
      $('[data-out]', settings).innerHTML = App.OUT_OPTIONS_HTML;
      $('[data-dest]', settings).appendChild(dest.el);

      const prev = h(`
<section class="card">
  <div class="card-h"><h2>Output Preview</h2><span class="link" data-pnote></span></div>
  <div class="empty" data-empty>Choose a file to preview the converted output.</div>
  <pre class="code" data-code hidden></pre>
  <div class="tbl-wrap short" data-xt hidden></div>
</section>`);
      [fc, settings].forEach(n => side.appendChild(n));
      [prev, progress.el, out.exp].forEach(n => main.appendChild(n));

      const pref = k => $(`[data-pref="${k}"]`, settings);
      const fmtKey = () => pref('format').value;
      let busy = false, nameEdited = false;

      // ---------------------------------------------------------------- format switching
      function setFormat(k, fromPreset) {
        pref('format').value = k;
        $$('[data-fmt]', settings).forEach(b => { const on = b.dataset.fmt === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        $$('[data-opt]', settings).forEach(el => el.hidden = !el.dataset.opt.split(' ').includes(k));
        $('[data-opt="json"]', settings).hidden = k !== 'json';
        if (!fromPreset && (k === 'csv' || k === 'tsv')) { pref('outDelim').value = k === 'tsv' ? '\t' : ','; pref('outDelim').dispatchEvent(new Event('change', { bubbles: true })); }
        if (!fromPreset) syncName();
        update();
      }
      function syncName() {
        if (nameEdited) return;
        const base = store.ready ? App.baseName(store.name) : 'converted';
        pref('outName').value = `${base}.${FORMATS[fmtKey()].ext}`;
      }
      $$('[data-fmt]', settings).forEach(b => b.onclick = () => setFormat(b.dataset.fmt));
      pref('outName').addEventListener('input', () => { nameEdited = true; });
      $('[data-presets]', settings).appendChild(App.presetBar('convert', () => settings, () => { setFormat(fmtKey(), true); }));

      // ---------------------------------------------------------------- config / writers
      const cfg = () => ({
        types: pref('j_types').checked, shape: pref('j_shape').value, empty: pref('j_empty').value, pretty: !!pref('j_pretty').value,
        numbers: pref('x_nums').checked, dates: pref('x_dates').checked,
      });
      const textWriter = (k, names, o, oo) => {
        if (k === 'json' || k === 'jsonl') return jsonWriter(k, names, o);
        const hdr = CSV.formatRecord(names, oo.delimiter, oo.quoteAll) + oo.eol;
        return { head: () => (store.hasHeader ? hdr : ''), row: f => CSV.formatRecord(f, oo.delimiter, oo.quoteAll) + oo.eol, tail: () => '' };
      };
      const outOpts = () => {
        const k = fmtKey();
        if (k === 'csv' || k === 'tsv') return App.readOutputOptions(settings, store);
        return { delimiter: ',', enc: { enc: 'utf-8', bom: false }, eol: '\n', quoteAll: false };
      };

      function update() {
        const k = fmtKey(), box = $('[data-code]', prev), xt = $('[data-xt]', prev), empty = $('[data-empty]', prev), note = $('[data-pnote]', prev);
        $('[data-go]', settings).disabled = busy || !store.ready;
        $('[data-note]', settings).textContent = store.ready ? '' : 'Start by choosing a CSV file.';
        if (!store.ready) { box.hidden = xt.hidden = true; empty.hidden = false; note.textContent = ''; return; }
        const names = store.columns, rows = store.sample.slice(0, 5);
        empty.hidden = true;
        if (k === 'xlsx') {
          box.hidden = true; xt.hidden = false;
          const o = cfg();
          const cell = v => { if (v === '' || v == null) return '<td class="nul">empty</td>'; if (o.numbers && NUM.test(v) && digitsOf(v) <= 15) return `<td class="r">${esc(v)}</td>`; if (o.dates && DATE.test(v)) return `<td class="dt">${esc(v)}</td>`; return `<td>${esc(v.length > 50 ? v.slice(0, 50) + '…' : v)}</td>`; };
          xt.innerHTML = `<table class="tbl xl"><thead><tr><th class="rn"></th>${names.map((_, i) => `<th class="xh">${colName(i)}</th>`).join('')}</tr></thead><tbody>
<tr class="hdr"><td class="rn">1</td>${names.map(n => `<td><b>${esc(n)}</b></td>`).join('')}</tr>${rows.map((r, ri) => `<tr><td class="rn">${ri + 2}</td>${names.map((_, i) => cell(r[i])).join('')}</tr>`).join('')}</tbody></table>`;
          note.textContent = 'Numbers are right-aligned, dates are green';
        } else {
          xt.hidden = true; box.hidden = false;
          const w = textWriter(k, names, cfg(), outOpts());
          box.textContent = (w.head() + rows.map(w.row).join('') + w.tail()).slice(0, 4000);
          note.textContent = `First ${rows.length} rows`;
        }
      }
      settings.addEventListener('input', update); settings.addEventListener('change', update);
      store.on('ready', () => { nameEdited = false; syncName(); out.clear(); progress.reset(); progress.status('Ready to convert'); update(); });
      store.on('change', () => { if (!store.ready) { out.clear(); progress.reset(); progress.status('Waiting for a file'); update(); } });

      // ---------------------------------------------------------------- run
      $('[data-go]', settings).onclick = async () => {
        if (busy || !store.ready) return;
        try { await dest.ensure(); } catch (e) { toast(e.message, 'error'); return; }
        busy = true; update(); out.clear(); progress.reset(); progress.status('Converting…');
        const k = fmtKey(), o = cfg(), oo = outOpts(), t0 = performance.now(), hasH = store.hasHeader, delim = store.delimiter;
        let name = pref('outName').value.trim() || `converted.${FORMATS[k].ext}`;
        name = App.safeName(name);
        const names = store.columns;
        let rows = 0, first = true, sink = null;
        await App.task('Converting your file…', 'Grab a coffee while we convert your CSV.', async setLd => {
          const onProgress = p => { progress.set(p); progress.status('Converting…'); setLd(p); };
          try {
            sink = dest.createSink(name, k === 'xlsx' ? { enc: 'utf-8' } : oo.enc, FORMATS[k].mime);
            if (k === 'xlsx') {
              const widths = names.map((n, i) => { let m = n.length; for (const r of store.sample) if (r[i] && r[i].length > m) m = r[i].length; return Math.min(60, Math.max(10, Math.round(m * 1.15 + 2))); });
              const sheets = [], limit = XLSX_ROWS() - (hasH ? 1 : 0), sopts = { numbers: o.numbers, dates: o.dates, header: hasH };
              let cur = new Sheet(names, widths, sopts); sheets.push(cur);
              await App.scanRecords(store.file, store.encoding, rec => {
                if (first) { first = false; if (hasH) return; }
                if (cur.dataRows >= limit) { cur = new Sheet(names, widths, sopts); sheets.push(cur); }
                cur.add(CSV.parseRecord(rec, delim)); rows++;
              }, { onProgress: p => onProgress(p * 0.9) });
              progress.status('Packing the workbook…'); setLd(0.92);
              sink.writeBlob(await buildXlsx(sheets, pref('x_sheet').value.trim() || 'Data', p => setLd(0.92 + p * 0.08)));
            } else {
              const w = textWriter(k, names, o, oo);
              sink.write(w.head());
              await App.scanRecords(store.file, store.encoding, rec => {
                if (first) { first = false; if (hasH) return; }
                sink.write(w.row(CSV.parseRecord(rec, delim))); rows++;
              }, { onProgress });
              sink.write(w.tail());
            }
            sink.rows = rows;
            const res = await sink.close();
            out.show([res], { folderName: dest.dirName, gz: k !== 'xlsx' });
            progress.set(1); progress.stats(fmt(rows), fmtSize(res.size), ((performance.now() - t0) / 1000).toFixed(1));
            progress.status(`Done. Converted ${fmt(rows)} rows to ${FORMATS[k].label}.`, 'ok');
            App.warnLossy(sink.enc);
            if (k === 'xlsx' && rows > XLSX_ROWS()) toast('The data continues on extra sheets because Excel limits each sheet to 1,048,576 rows.', 'info', 6000);
            if (dest.mode === 'folder') toast(`Saved “${res.name}” to “${dest.dirName}”`, 'ok');
          } catch (e) { progress.status('Failed: ' + e.message, 'err'); if (sink) sink.close().catch(() => {}); throw e; }
        });
        busy = false; update();
      };

      setFormat('csv'); progress.status(store.ready ? 'Ready to convert' : 'Waiting for a file'); update();
    },

    pick() { store.pick(); },
    acceptFiles(files) { store.set(files[0]); },
  });
})();
