# CSV Toolkit

A browser-only toolkit for **splitting, merging, inspecting, transforming and converting CSV files**, built to cope with hundreds of thousands of rows or more (tested with 200,000 rows, ~19 MB). Everything runs **in your browser**: your files are never uploaded anywhere.

![Overview](docs/overview.png?v=11)

## Privacy

**Your CSV never leaves your browser.** Files are read, processed and zipped locally by JavaScript running in the page. They are never uploaded, sent or stored anywhere, and the tools have no backend.

Out of the box the page makes no network requests at all once it has loaded (it uses the system font, and ads are off). If you turn on Google AdSense (see below), the page also loads Google's ad script, which makes its own requests and may set cookies; the privacy banner and the privacy policy then say so automatically. The ad code never receives your files.

## The tools

The app opens on an **Overview** page (on a phone, the tab bar holds the six tools and a back button returns to the Overview): open a file once, then jump straight into the tool you need. Each tool has a card that says what it does. Dropping several files on the overview takes you to Merge.


| Tool | What it does |
|---|---|
| **View** | Open a file and read all of it: scroll every row, search, sort by any column, jump to a row number and read a whole row in full. |
| **Split** | Break a big file into several smaller ones: by rows per file, number of files, maximum file size, or by the value of a column (one file per city, month, …). |
| **Merge** | Combine many files into one. Reorder them, match columns by name even when the order differs, and optionally add a column with each row's source file. |
| **Inspect** | Preview the first rows, see per-column statistics and detected types, and catch ragged rows, broken quotes, bad encodings and other data problems. |
| **Transform** | Clean cells, filter rows, remove duplicates, sample, and pick / rename / reorder columns, with a live preview. |
| **Convert** | Turn CSV into TSV, JSON, JSON Lines or a real Excel `.xlsx`, and change the output encoding. |

### View

![View: search, sort and row details](docs/view.png?v=11)

A CSV reader for files that are too big or too slow for a spreadsheet.

- **Every row**, not just the first ones. Only the rows on screen are drawn (virtual scrolling), so 200,000 rows open in about a second and scroll smoothly. Up to 1,000,000 rows are shown.
- **Search** all columns or one column; matches are highlighted and the count shows how many rows match.
- **Sort** by clicking a column name: ascending, descending, then back to the file order. Numbers sort as numbers and empty cells go last.
- **Go to row** by its number in the file, even while sorted. Row numbers always refer to the original file.
- **Row Details** shows every value of the selected row in full, with **Copy Row** (tab-separated, ready to paste into a spreadsheet). On a phone it opens as a sheet.
- **Resize columns** by dragging the edge of a column name; use the arrow keys, Page Up/Down, Home and End to move through rows.
- **Download These Rows** saves the result of a search or sort as a new CSV.

### Split

![Split tool](docs/split.png?v=11)


- **Four modes**: rows per file, number of output files, maximum file size (MB), or one file per distinct value of a column (up to 500 values).
- A live strip shows where the file will be cut, before you run anything.
- The header row is repeated in every output file.
- Output goes to a **ZIP** (compressed with Deflate), to individual downloads, or **straight into a folder** (File System Access API: Chrome, Edge, Opera). Folder mode writes while reading, so it doesn't hold the results in memory.
- Save and reload **presets** of your settings.

### Merge

- Drag to reorder files, or use the arrow buttons.
- **Keep columns as they are** (appends rows; warns when files have different columns) or **match columns by name** (output columns = every column found; missing values stay empty).
- Files may use different delimiters and encodings; each is detected automatically.
- Optional **source column** with the original file name.

![Merge tool](docs/merge.png?v=11)

### Inspect

- Instant preview of the first 20 rows with detected types (integer, decimal, date, boolean, text).
- Per column: filled %, empty count, distinct values, min / max / average, top values.
- **Validation**: wrong number of columns, unclosed quotes, undecodable characters (�), garbled text (mojibake), duplicate or missing column names, empty columns, stray leading / trailing spaces, mixed value types, mixed line endings, BOM, blank lines.
- A health ring shows the share of clean rows; issues and column statistics can be exported as CSV.

![Inspect tool](docs/inspect.png?v=11)

*(Screenshot uses `examples/messy-for-inspect.csv`.)*

### Transform

A five-step pipeline: every step can be switched on or off, and the **live preview** updates as you edit.

1. **Clean cells**: trim spaces, flatten line breaks.
2. **Filter rows**: any number of rules (equals, contains, starts / ends with, greater / less than, is empty, regular expression…), matching *all* or *any*, optionally case sensitive.
3. **Remove duplicates**: by the whole row or by selected columns, optionally ignoring case and spaces.
4. **Sample rows**: first N, random N (original order is preserved), random percentage, or every Nth row. "First N" stops reading as soon as it has enough.
5. **Columns**: keep, rename and reorder.

Output options: delimiter, encoding, line endings, quote-everything, header on / off.

![Transform tool](docs/transform.png?v=11)

### Convert

- **CSV, TSV, JSON** (compact or pretty), **JSON Lines** and **Excel (.xlsx)**.
- JSON: rows as objects or arrays, detect numbers and `true` / `false`, choose what to do with empty cells.
- Excel: bold, frozen header row; numbers stored as numbers; `YYYY-MM-DD` stored as real dates; automatic column widths; data beyond Excel's 1,048,576-row limit continues on extra sheets.
- Output encodings: **UTF-8**, **UTF-8 with BOM** (best for Excel), **Windows-1252 / Latin-1**, **UTF-16 LE**.

![Convert tool](docs/convert.png?v=11)

## Everywhere

- **Guided flow**: every tool shows a 4-step guide (choose file, adjust settings, run, download) that tracks where you are; click a step to jump to it. Before a file is open, the work area is an empty spreadsheet you can drop a file onto. Afterwards the file and settings stay pinned on the left while the preview and results scroll on the right.
- **Hard to get lost**: the open file is shown in the header (with *Change* and *Close*), you can drop a file anywhere on the page, and when a job finishes the page scrolls to the result and offers a one-click download. An empty result is flagged instead of reported as a success.
- **Sensible defaults first**: technical settings (encoding, delimiter, line endings, quoting, file names) live under collapsible panels that show their current values.
- **Streaming**: files are read in chunks, so the UI stays responsive on large files.
- **Quote-aware parser (RFC 4180)**: newlines inside quoted fields (e.g. multi-line addresses) belong to one row; records are never cut in half.
- **Auto-detection** of encoding (UTF-8 / UTF-16 with BOM, UTF-8 vs Windows-1252) and delimiter (`,` `;` tab `|`), both overridable.
- **Output**: individual downloads, ZIP with real compression, `.gz` for single files, or save directly to a folder.
- **Presets** for your favorite settings, saved in your browser.
- **Loading animation**: a person sipping coffee with a live progress bar (respects `prefers-reduced-motion`).
- **Looks like iOS 26 (light)**: an opaque content layer of white rounded sections on a light grouped background, and a Liquid Glass layer floating above it for navigation and controls: a glass sidebar, glass toolbar buttons, a floating glass tab bar on phones, glass notification banners and loading sheet. Capsule buttons, iOS text fields, segmented controls and switches, system font and system colors. Always light; respects reduced motion, reduced transparency and increased contrast.
- **Layout**: tools in the sidebar, a large title with the open file and the main action, results in the middle and the file and its settings on the right. On phones it becomes a single column with a tab bar at the bottom.
- **Streaming**: files are read in chunks, so the UI stays responsive on large files.
- **Quote-aware parser (RFC 4180)**: newlines inside quoted fields (e.g. multi-line addresses) belong to one row; records are never cut in half.
- **Auto-detection** of encoding (UTF-8 / UTF-16 with BOM, UTF-8 vs Windows-1252) and delimiter (`,` `;` tab `|`), both overridable.
- **Output**: individual downloads, ZIP with real compression, `.gz` for single files, or save directly to a folder.
- **Presets** for your favorite settings, saved in your browser.
- **Loading animation**: a person sipping coffee with a live progress bar (respects `prefers-reduced-motion`).
- **Feels like a Mac app**: a sidebar for the tools, a toolbar with the current tool, the open file and the main action, and an inspector on the right for the file and its settings. System font, system colors, macOS-sized controls, zebra-striped tables and notification-style messages. On phones it becomes a single column.
- **Follows the system appearance** (light or dark), responsive layout, visible keyboard focus states, respects reduced motion and reduced transparency.
- **Zero dependencies**: no build step, no npm, no server.

![Loading animation](docs/loading.png?v=11)

## SEO

Every tool has its own address, so each one can rank for what people search for:

| Page | Tool |
| --- | --- |
| `index.html` | Overview |
| `csv-viewer.html` | View |
| `split-csv.html` | Split |
| `merge-csv.html` | Merge |
| `validate-csv.html` | Inspect |
| `clean-csv.html` | Transform |
| `convert-csv.html` | Convert |

Each page is the full app opened on that tool, with its own title, meta description, canonical URL, Open Graph and Twitter card tags (with a 1200×630 `og-image.png`), structured data (`WebApplication` and `BreadcrumbList`; `WebSite` on the overview; `Article` on guides) and a crawlable introduction with how-to steps and FAQs under the drop zone. The introduction disappears once a file is open, so it never gets in the way of the work.

Inside the app, switching tools updates the address with the History API (no reload), along with the title, description and canonical link, and the back and forward buttons work. Old `index.html#/split` links still open the right tool and are tidied to the new address. Opened from `file://`, the app falls back to `#/tool` addresses.

The site also ships `sitemap.xml` (all indexable pages), `robots.txt`, a `404.html` marked `noindex`, `site.webmanifest`, and touch and app icons.

**All page heads, introductions, content pages, the sitemap and the manifest are generated** by `tools/build_pages.py` from `index.html`. Edit the content in that script and run it, rather than editing the generated pages by hand:

```bash
python3 tools/build_pages.py
```

It also sets the `?v=` asset version on every page (bump `VERSION` in the script on each release). Run it **before** `tools/configure.py`, because configure fills your real domain into the generated files.

After deploying, submit `https://your-domain.com/sitemap.xml` in [Google Search Console](https://search.google.com/search-console).

## Put it on your own site or blog

The toolkit is plain static files with relative links, so it works in a folder of an existing site, unchanged.

**In a folder** (recommended, the full UI as is): copy the files into, for example, `csv-toolkit/` on your site so it is served at `https://yourblog.com/csv-toolkit/`, then run

```bash
python3 tools/configure.py --domain https://yourblog.com/csv-toolkit
```

Search engines only read `robots.txt` and `ads.txt` at the root of a domain, so add the toolkit's `Sitemap:` line to your site's own `robots.txt` (or submit the sitemap in Search Console), and merge `ads.txt` into yours if you use AdSense. If you use `_headers`, prefix its paths with `/csv-toolkit`. Your host's own 404 page is used instead of `404.html`.

**As a subdomain** (`tools.yourblog.com`): deploy the folder as its own site and configure it with that address. Everything, including `robots.txt` and `ads.txt`, works as shipped.

**Inside a blog post**: embed it with an iframe.

```html
<iframe src="/csv-toolkit/csv-viewer.html" title="CSV Toolkit" allow="clipboard-write" style="width:100%;height:860px;border:0;border-radius:16px"></iframe>
```

In a narrow post column the app uses its compact layout (tab bar instead of sidebar). Opening, running and downloading all work inside the frame. Saving straight to a folder only works when the frame is on the same domain as the post.

## Google AdSense

The site is prepared for AdSense but **ads stay off until you configure them**, so nothing from Google loads by default.

What is already in place:

- Pages reviewers look for: [About](about.html), [Privacy policy](privacy.html) (with the cookie and personalized-ads disclosures AdSense requires), [Terms of use](terms.html), [Contact](contact.html), and three original [guides](guides.html).
- The AdSense site-verification meta tag, `ads.txt`, `robots.txt`, `sitemap.xml`, a favicon and page descriptions.
- `js/ads.js`, which loads AdSense only when a real publisher ID is set, and fills ad slots only once they are visible (needed in a single-page app, where hidden tool views have no width).
- Three placements, kept away from the controls that run the tools and download results: between the tool cards and "How it works" on the overview, at the very bottom of each tool's results column, and inside each guide. No ads appear in the loading sheet or next to Download buttons.

Steps to go live:

1. **Host it on a domain you own.** AdSense does not accept sites on a domain you don't control (for example a free `*.github.io` address). GitHub Pages with a custom domain, Netlify or Cloudflare Pages all work; the site is plain static files.
2. **Sign up at [adsense.google.com](https://adsense.google.com/)** with that domain and copy your publisher ID (`ca-pub-…`).
3. **Configure the site** (on a fresh checkout), then deploy:

   ```bash
   python3 tools/configure.py --domain https://your-domain.com --adsense ca-pub-1234567890123456
   ```

   Later, after you create ad units in AdSense (Ads → By ad unit → Display ads), add their IDs with `--slot-overview`, `--slot-tool` and `--slot-article`. Without unit IDs you can still use Auto ads from the AdSense dashboard.
4. **Request review** in AdSense. Google checks the site and `ads.txt`; approval can take from a few days to a few weeks.
5. **Turn on the consent message** in AdSense (Privacy & messaging → European regulations) so visitors from the EEA, UK and Switzerland are asked before personalized ads are shown.

## Usage

1. Open `index.html` in a browser (double-click it, or use a local static server, see below).
2. Pick a tool from the top bar or the sidebar.
3. Drag a CSV onto the **+** tile, or click **Choose CSV file**. The file is shared between Split, Inspect, Transform and Convert; Merge has its own multi-file list.
4. Adjust the settings and click the main button. Download the results or save them to a folder.

### Run with a local server (optional)

```bash
python3 tools/serve.py
```

Then open http://localhost:8765. This is `python3 -m http.server` with caching turned off, so a reload always shows your latest changes (a plain static server lets the browser keep old pages around).

When you host the site, `_headers` sets the cache rules on Netlify and Cloudflare Pages: pages are always revalidated, while CSS and JS (versioned with `?v=`) are cached for a year. On another host, set the same headers in its config.

## Try it with sample data

`examples/` has small files for trying things out:

| File | Good for |
|---|---|
| `merge-a.csv`, `merge-b-semicolon.csv`, `merge-c-latin1.csv` | **Merge**: different column order, delimiter and encoding |
| `messy-for-inspect.csv` | **Inspect**: ragged rows, bad characters, duplicate headers, stray spaces |

`generate_dummy.py` creates a large test CSV (including fields with commas, quotes and newlines):

```bash
python3 generate_dummy.py 200000 dummy_200k.csv
```

The result has 200,000 data rows plus 1 header. Every 1,000th row contains a multi-line address, so `wc -l` reports 200,201 physical lines while the tools correctly report **200,000 data rows**.

## How it works

- **Scanning**: `File.stream()` → `TextDecoderStream` → a character scanner that tracks an "inside quotes" state. A newline only ends a record when it is outside quotes. Blank lines are skipped.
- **Parsing / writing** (`js/csv.js`): a small, dependency-free, unit-tested CSV parser and formatter.
- **Sinks**: output is written through a sink that either collects `Blob` parts in memory or streams into a `FileSystemWritableFileStream`. The encoder handles UTF-8 (± BOM), Windows-1252 and UTF-16 LE.
- **ZIP**: a minimal ZIP writer with CRC-32 and Deflate through the browser's `CompressionStream`.
- **XLSX**: the workbook XML parts are generated by hand and zipped; no library.
- **Structure**: each tool registers itself with a small router in `js/core.js` and shares the same components (file card, progress ring, result panel, presets, destination picker).

## Limitations

- ZIP output cannot exceed **4 GB** (no ZIP64). Use "Save to folder" or individual downloads for bigger results.
- In download mode, output files are held in browser memory until downloaded. Hundreds of MB are fine; multi-GB results may be heavy: use "Save to folder" instead.
- "Remove duplicates" and "Random N rows" keep data in memory (every unique row / the sampled rows).
- Records are detected by `\n`, so very old files that end lines with a lone `\r` are not supported. `\r\n` works.
- Delimiters must be a single character; column counts are only validated in **Inspect**.
- Saving directly to a folder needs a Chromium-based browser (Chrome, Edge, Opera).

## Project structure

```
index.html            App shell, opened on the overview
*-csv.html, csv-viewer.html   The same app opened on one tool (view, split, merge, validate, clean, convert)
css/app.css           App styles
css/pages.css         Styles for the content pages
js/csv.js             Pure CSV parser / formatter (also runs in Node)
js/core.js            Shared state, streaming scanner, sinks, ZIP, UI components, router
js/ads.js             AdSense loader (inactive until configured)
js/seo-data.js        Titles and descriptions used when switching tools (generated)
js/tools/             home.js (overview), view.js, split.js, merge.js, inspect.js, transform.js, convert.js
tests/csv.test.js     Unit tests for the parser
tools/build_pages.py  Generates page heads, SEO content, content pages, sitemap and manifest
tools/configure.py    Sets the domain and AdSense IDs
tools/serve.py        Local server without caching
_headers              Cache rules for Netlify / Cloudflare Pages
*.html (other)        About, privacy, terms, contact, guide and 404 pages (generated)
og-image.png, icon-*.png, apple-touch-icon.png, site.webmanifest   Social preview and app icons
ads.txt, robots.txt, sitemap.xml   Site files with placeholders for your domain and publisher ID
examples/             Small sample CSV files
generate_dummy.py     Large dummy CSV generator
docs/                 Screenshots used in this README
LICENSE               MIT license
```

## Testing

Parser unit tests (Node ≥ 14, no dependencies):

```bash
node tests/csv.test.js
```

The tools themselves were tested in a real browser with `dummy_200k.csv`: row counts, byte-for-byte reassembly of split files, ZIP integrity, filter / de-duplication results compared against an independent Python implementation, JSON validity, encodings byte by byte, and `.xlsx` files re-opened with `openpyxl` (types, bold header, frozen pane, dates, multi-sheet overflow).

The layout was also checked with touch emulation at 390 px (phone) and 768 px (tablet) in light and dark: every tool completes its flow by tapping, there is no horizontal page scroll, and on touch screens buttons and fields are enlarged to at least ~40 px.

## License

[MIT](LICENSE) © 2026 RRMADON26
