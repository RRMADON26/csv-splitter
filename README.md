# CSV Splitter

A single-file web tool that **splits large CSV files into several smaller ones**. It handles hundreds of thousands of rows or more (tested with 200,000 rows, ~19 MB). Everything runs **in your browser**: your file is never uploaded anywhere.

![CSV Splitter, light theme](docs/screenshot-light.png)

<details>
<summary>Dark theme</summary>

![CSV Splitter, dark theme](docs/screenshot-dark.png)

</details>

## Features

- **Streaming**: the file is read in chunks, so the UI stays responsive even with large files.
- **Quote-aware parser (RFC 4180)**: newlines inside quoted fields (e.g. multi-line addresses) count as part of one row, so records are never cut in half.
- **Two ways to split**: by *rows per file* or by *number of output files*.
- **Header repeated** in every output file (can be turned off).
- **Encodings**: UTF-8, Windows-1252 / Latin-1, UTF-16 LE. A UTF-8 BOM is stripped automatically.
- **Download** files one by one, or all at once as a **ZIP** built in the browser (no libraries).
- **Light / dark theme**: follows your system, can be switched manually, and the choice is remembered.
- **Responsive**: works on desktop, tablet and phone.
- **Zero dependencies**: no build step, no npm, no server.

## Usage

1. Open `index.html` in a browser (double-click it, or use a local static server, see below).
2. Drag a CSV file onto the **+** tile, or click **Pilih file CSV** (Choose CSV file).
3. Wait for the row count, then configure the **Pengaturan** (Settings) card:
   - **Cara membagi** (Split by): *rows per file* or *number of output files*
   - **Awalan nama** (Name prefix): output files are named `prefix_001_originalname.csv`
   - **Encoding**, and whether the **first row is a header**
4. Click **Pecah file** (Split file).
5. Download each file with its **Unduh** (Download) button, or everything with **Unduh ZIP**.

> The interface text is currently in Indonesian.

### Example

A file with 200,000 data rows, split at 50,000 rows per file, produces 4 files:

```
part_001_data.csv   50,000 rows
part_002_data.csv   50,000 rows
part_003_data.csv   50,000 rows
part_004_data.csv   50,000 rows
```

### Run with a local server (optional)

```bash
python3 -m http.server 8765
# then open http://localhost:8765
```

## Try it with dummy data

`generate_dummy.py` creates a test CSV, including rows with commas, quotes and newlines inside fields.

```bash
python3 generate_dummy.py 200000 dummy_200k.csv
```

The result has 200,000 data rows plus 1 header. Every 1,000th row contains a multi-line address, so `wc -l` reports 200,201 physical lines, while the tool correctly reports **200,000 data rows**.

## How it works

- **Scanning**: `File.stream()` → `TextDecoderStream` → a character scanner that tracks an "inside quotes" state. A newline only ends a record when it is outside quotes.
- **Splitting**: records are collected per output file and turned into a `Blob`. The header (if any) is prepended to each part.
- **ZIP**: a minimal ZIP writer using the *store* method (no compression), with CRC-32 and UTF-8 file names.
- **Row counting**: done first so that *number of output files* mode knows how many rows go in each file.

## Limitations

- The ZIP is uncompressed and has no ZIP64 support, so it **cannot hold more than 4 GB**. For that, download files individually.
- Output files are held in browser memory until downloaded. Files of hundreds of MB are fine; multi-GB files may be heavy.
- Records are detected by `\n`, so very old files that end lines with a lone `\r` are not supported. `\r\n` works.
- The tool does not parse columns, so the delimiter (`,` `;` tab) does not matter, and column counts are not validated.
- The font is loaded from Google Fonts; offline, the system font is used instead.

## Project structure

```
index.html          The app (HTML + CSS + JS in one file)
generate_dummy.py   Dummy CSV generator for testing
docs/               Screenshots used in this README
README.md           Documentation
```

## Testing

Tested manually in a browser with `dummy_200k.csv`:

- row count detected as 200,000 (multi-line addresses are not double-counted);
- splitting at 50,000 rows per file gives 4 files × 50,000 rows in under a second;
- the header is present in every file;
- all files joined together (header taken once) are byte-for-byte identical to the original;
- the ZIP is valid and every entry's CRC matches.
