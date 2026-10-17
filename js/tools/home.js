/* Overview: what the toolkit does, a quick start, and a way into each tool. */
(function () {
  'use strict';
  const { $, $$, h, fmt, fmtSize, icon, esc } = App;
  const store = App.file;

  const TOOLS = [
    { id: 'split', tint: 'blue', points: ['By rows, number of files, size or column value', 'The header is repeated in every file', 'Download a ZIP or save straight to a folder'] },
    { id: 'merge', tint: 'indigo', points: ['Drop in many files and drag them into order', 'Columns can be matched by name', 'Optionally record each row’s source file'] },
    { id: 'inspect', tint: 'orange', points: ['Preview with detected column types', 'Ragged rows, bad characters, stray spaces', 'Export the issues and column stats'] },
    { id: 'transform', tint: 'green', points: ['Filter rows with simple rules', 'Remove duplicates or take a sample', 'Pick, rename and reorder columns'] },
    { id: 'convert', tint: 'teal', points: ['Real Excel files with numbers and dates', 'JSON and JSON Lines', 'Change the delimiter or the encoding'] },
  ];

  App.register({
    id: 'home', label: 'Overview', icon: 'home', short: 'Overview', blurb: 'What each tool does',
    get cta() { return store.ready ? 'Change File…' : 'Choose File…'; }, steps: false,
    hasFile() { return false; },
    subtitle() { return store.ready ? store.name : 'Everything runs in this browser'; },

    mount(root) {
      const el = h(`
<div class="home">
  <section class="card qs" aria-labelledby="qs-title">
    <div class="qs-empty" data-qs="empty">
      <div class="qs-text">
        <h2 id="qs-title">Start with a file</h2>
        <p>Open a CSV to use it in any tool. You can also drop it anywhere on this page.</p>
      </div>
      <div class="qs-actions">
        <button type="button" class="btn accent" data-act="open">Choose File…</button>
        <button type="button" class="btn" data-go-tool="merge">Merge Several Files…</button>
      </div>
    </div>
    <div class="qs-ready" data-qs="ready" hidden>
      <div class="qs-text">
        <h2>Your file is open</h2>
        <p><b class="qs-name" data-f="name"></b><span data-f="meta"></span></p>
      </div>
      <div class="qs-actions" data-f="next"></div>
    </div>
    <div class="qs-busy" data-qs="busy" hidden><p>Reading your file…</p></div>
  </section>

  <section class="home-sec" aria-labelledby="tools-title">
    <h2 class="sec-title" id="tools-title">Tools</h2>
    <div class="tool-grid" data-grid></div>
  </section>

  <div class="ad-slot" data-ad-slot="overview" hidden></div>

  <section class="home-sec" aria-labelledby="how-title">
    <h2 class="sec-title" id="how-title">How it works</h2>
    <ol class="how">
      <li><b>Open a file</b><span>Drop it anywhere or choose it. It is read on this device and never uploaded.</span></li>
      <li><b>Pick a tool and its settings</b><span>Previews update as you change things, before anything runs.</span></li>
      <li><b>Run and download</b><span>Get a single file, a ZIP, or save the results straight into a folder.</span></li>
    </ol>
  </section>

  <section class="home-sec" aria-labelledby="learn-title">
    <h2 class="sec-title" id="learn-title">Learn more</h2>
    <div class="learn">
      <a class="learn-card" href="guide-split-large-csv.html"><b>How to split a large CSV file</b><span>When files are too big for Excel or an upload form, and how to cut them cleanly.</span></a>
      <a class="learn-card" href="guide-merge-csv-files.html"><b>How to merge CSV files</b><span>Combining exports that don’t share the same columns or delimiters.</span></a>
      <a class="learn-card" href="guide-fix-csv-encoding.html"><b>Fixing garbled characters in a CSV</b><span>Why “JosÃ©” happens and how to get “José” back.</span></a>
    </div>
  </section>

  <footer class="home-foot">
    <nav aria-label="About this site"><a href="guides.html">Guides</a><a href="about.html">About</a><a href="privacy.html">Privacy policy</a><a href="terms.html">Terms of use</a><a href="contact.html">Contact</a></nav>
    <p>CSV Toolkit is free and open source under the MIT license.</p>
  </footer>
</div>`);
      root.appendChild(el);

      const grid = $('[data-grid]', el);
      TOOLS.forEach(t => {
        const tool = App.tools[t.id];
        const card = h(`
<a class="tool-card" href="#/${t.id}">
  <span class="t-ic t-${t.tint}" aria-hidden="true">${icon(tool.icon)}</span>
  <span class="tc-body">
    <b>${esc(tool.label)}</b>
    <span class="tc-blurb">${esc(tool.blurb)}</span>
    <ul>${t.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
  </span>
  <span class="tc-open">Open ${esc(tool.label)}</span>
</a>`);
        grid.appendChild(card);
      });

      const show = s => $$('[data-qs]', el).forEach(n => n.hidden = n.dataset.qs !== s);
      function render() {
        if (store.status === 'reading') return show('busy');
        if (!store.ready) return show('empty');
        show('ready');
        $('[data-f="name"]', el).textContent = store.name;
        $('[data-f="meta"]', el).textContent = ` ${fmt(store.dataRows)} rows, ${fmt(store.columns.length)} columns, ${fmtSize(store.file.size)}`;
        $('[data-f="next"]', el).innerHTML = ['split', 'inspect', 'transform', 'convert'].map((id, i) =>
          `<button type="button" class="btn ${i === 0 ? 'accent' : ''}" data-go-tool="${id}">${icon(App.tools[id].icon)}${esc(App.tools[id].label)}</button>`).join('');
      }
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-go-tool]'); if (b) App.go(b.dataset.goTool);
        if (e.target.closest('[data-act="open"]')) store.pick();
      });
      store.on('change', render); render();
    },

    pick() { store.pick(); },
    acceptFiles(files) {
      if (files.length > 1) { App.go('merge'); App.show('merge'); App.tools.merge.acceptFiles(files); }
      else store.set(files[0]);
    },
  });
})();
