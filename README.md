# CSV Toolkit

A browser-only toolkit for **splitting, merging, inspecting, transforming and converting CSV files**, built to cope with hundreds of thousands of rows or more (tested with 200,000 rows, ~19 MB). Everything runs **in your browser**: your files are never uploaded anywhere.

![Split tool](docs/split.png?v=8)

## Privacy

**Your CSV never leaves your browser.** Files are read, processed and zipped locally by JavaScript running in the page. Nothing is uploaded, sent or stored on any server, and the app has no backend at all. You can verify this by opening your browser's developer tools (Network tab) while using any tool: once the page has loaded, it makes no network requests at all. It uses the system font, so nothing is fetched from font services either.

## The tools

| Tool | What it does |
|---|---|
| **Split** | Break a big file into several smaller ones: by rows per file, number of files, maximum file size, or by the value of a column (one file per city, month, …). |
| **Merge** | Combine many files into one. Reorder them, match columns by name even when the order differs, and optionally add a column with each row's source file. |
| **Inspect** | Preview the first rows, see per-column statistics and detected types, and catch ragged rows, broken quotes, bad encodings and other data problems. |
| **Transform** | Clean cells, filter rows, remove duplicates, sample, and pick / rename / reorder columns, with a live preview. |
| **Convert** | Turn CSV into TSV, JSON, JSON Lines or a real Excel `.xlsx`, and change the output encoding. |

### Split

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

![Merge tool](docs/merge.png?v=8)

### Inspect

- Instant preview of the first 20 rows with detected types (integer, decimal, date, boolean, text).
- Per column: filled %, empty count, distinct values, min / max / average, top values.
- **Validation**: wrong number of columns, unclosed quotes, undecodable characters (�), garbled text (mojibake), duplicate or missing column names, empty columns, stray leading / trailing spaces, mixed value types, mixed line endings, BOM, blank lines.
- A health ring shows the share of clean rows; issues and column statistics can be exported as CSV.

![Inspect tool](docs/inspect.png?v=8)

*(Screenshot uses `examples/messy-for-inspect.csv`.)*

### Transform

A five-step pipeline: every step can be switched on or off, and the **live preview** updates as you edit.

1. **Clean cells**: trim spaces, flatten line breaks.
2. **Filter rows**: any number of rules (equals, contains, starts / ends with, greater / less than, is empty, regular expression…), matching *all* or *any*, optionally case sensitive.
3. **Remove duplicates**: by the whole row or by selected columns, optionally ignoring case and spaces.
4. **Sample rows**: first N, random N (original order is preserved), random percentage, or every Nth row. "First N" stops reading as soon as it has enough.
5. **Columns**: keep, rename and reorder.

Output options: delimiter, encoding, line endings, quote-everything, header on / off.

![Transform tool](docs/transform.png?v=8)

<details>
<summary>Dark theme</summary>

![Transform tool, dark theme](docs/transform-dark.png?v=8)

</details>

### Convert

- **CSV, TSV, JSON** (compact or pretty), **JSON Lines** and **Excel (.xlsx)**.
- JSON: rows as objects or arrays, detect numbers and `true` / `false`, choose what to do with empty cells.
- Excel: bold, frozen header row; numbers stored as numbers; `YYYY-MM-DD` stored as real dates; automatic column widths; data beyond Excel's 1,048,576-row limit continues on extra sheets.
- Output encodings: **UTF-8**, **UTF-8 with BOM** (best for Excel), **Windows-1252 / Latin-1**, **UTF-16 LE**.

![Convert tool](docs/convert.png?v=8)

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
- **Feels like a Mac app**: a sidebar for the tools, a toolbar with the current tool, the open file and the main action, and an inspector on the right for the file and its settings. System font, system colors, macOS-sized controls, zebra-striped tables and notification-style messages. On phones it becomes a single column.
- **Follows the system appearance** (light or dark), responsive layout, visible keyboard focus states, respects reduced motion and reduced transparency.
- **Zero dependencies**: no build step, no npm, no server.

![Loading animation](docs/loading.png?v=8)

## Usage

1. Open `index.html` in a browser (double-click it, or use a local static server, see below).
2. Pick a tool from the top bar or the sidebar.
3. Drag a CSV onto the **+** tile, or click **Choose CSV file**. The file is shared between Split, Inspect, Transform and Convert; Merge has its own multi-file list.
4. Adjust the settings and click the main button. Download the results or save them to a folder.

### Run with a local server (optional)

```bash
python3 -m http.server 8765
# then open http://localhost:8765
```

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
index.html            App shell
css/app.css           Styles (light + dark theme)
js/csv.js             Pure CSV parser / formatter (also runs in Node)
js/core.js            Shared state, streaming scanner, sinks, ZIP, UI components, router
js/tools/             split.js, merge.js, inspect.js, transform.js, convert.js
tests/csv.test.js     Unit tests for the parser
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
