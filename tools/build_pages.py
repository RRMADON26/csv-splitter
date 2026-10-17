#!/usr/bin/env python3
"""Build every page of the site from one place.

Writes:
  index.html + one page per tool (split-csv.html, merge-csv.html, ...), built from index.html,
      each with its own title, description, canonical URL, Open Graph/Twitter tags, JSON-LD
      and a crawlable introduction shown under the drop zone
  guides, about, privacy, terms, contact and 404 pages
  js/seo-data.js   titles/descriptions the app uses when switching tools without a reload
  sitemap.xml, site.webmanifest

Usage:  python3 tools/build_pages.py
Edit the content below, run the script, commit the output. When deploying, run
tools/configure.py afterwards to fill in your domain and AdSense ID.
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = "2026.10.17.5"          # bump on every release so browsers refetch CSS/JS
DATE_ISO = "2026-10-17"
DATE_TEXT = "October 17, 2026"
D = "https://YOUR-DOMAIN.example"  # replaced by tools/configure.py
REPO = "https://github.com/RRMADON26/csv-splitter"
AUTHOR = {"@type": "Person", "name": "RRMADON26", "url": "https://github.com/RRMADON26"}
OG_IMAGE = f"{D}/og-image.png"
ICON = ('<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/>'
        '<path d="M3 9.5h18M9.5 9.5V20" stroke="currentColor" stroke-width="1.8"/></svg>')
AD = '<div class="ad-slot" data-ad-slot="article" hidden></div>'
esc = html.escape


def url(path):
    return f"{D}/{'' if path == 'index.html' else path}"


def head(title, desc, path, og_type="website", ld=None, robots="index, follow"):
    ld = ld or []
    tags = [
        f"<title>{esc(title)}</title>",
        f'<meta name="description" content="{esc(desc)}">',
        f'<meta name="robots" content="{robots}">',
        f'<link rel="canonical" href="{url(path)}">',
        '<meta property="og:site_name" content="CSV Toolkit">',
        f'<meta property="og:type" content="{og_type}">',
        f'<meta property="og:url" content="{url(path)}">',
        f'<meta property="og:title" content="{esc(title)}">',
        f'<meta property="og:description" content="{esc(desc)}">',
        f'<meta property="og:image" content="{OG_IMAGE}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="CSV Toolkit: split, merge, validate, clean and convert CSV files in your browser">',
        '<meta property="og:locale" content="en_US">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{esc(title)}">',
        f'<meta name="twitter:description" content="{esc(desc)}">',
        f'<meta name="twitter:image" content="{OG_IMAGE}">',
    ]
    if ld:
        data = {"@context": "https://schema.org", "@graph": ld}
        tags.append('<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "</script>")
    return "\n".join(tags)


def crumbs(*items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": url(p)} for i, (n, p) in enumerate(items)]}


WEBSITE = {"@type": "WebSite", "@id": f"{D}/#website", "name": "CSV Toolkit", "url": f"{D}/", "inLanguage": "en",
           "description": "Free CSV tools that run in your browser: split, merge, validate, clean and convert CSV files without uploading them."}


def webapp(name, path, desc, features):
    return {"@type": "WebApplication", "name": name, "url": url(path), "description": desc,
            "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
            "browserRequirements": "Requires JavaScript and a modern web browser",
            "isAccessibleForFree": True, "inLanguage": "en", "isPartOf": {"@id": f"{D}/#website"},
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "featureList": features, "image": OG_IMAGE}


def faq(items):
    return "".join(f"<h3>{esc(q)}</h3><p>{a}</p>" for q, a in items)


# ============================================================================ app pages
APP = {
 "home": dict(
  path="index.html", h1="Overview", name="CSV Toolkit",
  title="CSV Toolkit: Free Online CSV Tools, No Upload",
  desc="Free CSV tools in your browser: split large CSV files, merge files, validate data, remove duplicates and convert CSV to Excel or JSON. Nothing is uploaded.",
  features=["Split CSV files", "Merge CSV files", "Validate and preview CSV data", "Filter rows and remove duplicates", "Convert CSV to Excel, JSON and TSV"],
  intro=f"""<h2>Frequently Asked Questions</h2>
{faq([
 ("Is CSV Toolkit free?", "Yes. All five tools are free, with no sign-up and no limit on how many files you process."),
 ("Are my files uploaded anywhere?", "No. Files are read and processed by your browser on your own device. They are never sent to a server, which is why the tools also work with confidential data."),
 ("How large can a CSV file be?", "Files with hundreds of thousands of rows are handled comfortably, and much larger ones work too. Files are read in chunks, so the practical limit is your device’s memory. In Chrome and Edge you can save results straight into a folder, which avoids holding them in memory."),
 ("Does it work with Excel?", "Yes. <a href=\"convert-csv.html\">Convert</a> creates real .xlsx workbooks, and any CSV can be saved as UTF-8 with BOM so Excel shows accented characters correctly."),
 ("Which delimiters and encodings are supported?", "Comma, semicolon, tab and pipe delimiters, and UTF-8, UTF-16 and Windows-1252 encodings. Both are detected automatically and can be changed by hand."),
 ("Does it work on a phone or tablet?", "Yes. The layout adapts to small screens and every tool works on mobile browsers."),
])}"""),

 "split": dict(
  path="split-csv.html", h1="Split", name="CSV Splitter",
  title="Split CSV Files Online, Free and Private | CSV Toolkit",
  desc="Split a large CSV file into smaller files by rows, number of files, file size or column value. Keeps the header in every file. Runs in your browser, no upload.",
  features=["Split by rows per file", "Split into a number of files", "Split by maximum file size", "One file per column value", "Header repeated in every file", "Download as ZIP or save to a folder"],
  intro=f"""<h2>Split CSV files online, free and private</h2>
<p>This CSV splitter breaks a large file into smaller ones inside your browser. It is built for files that are too big for Excel, an import form or an email attachment, and it keeps every record intact: line breaks inside quoted fields stay in their row, and the header is copied into each part.</p>
<h3>How to split a CSV file</h3>
<ol><li>Choose a CSV file or drop it onto the page. It is read on your device, not uploaded.</li><li>Pick how to split it: rows per file, number of files, maximum size, or one file per value of a column.</li><li>Check the strip that shows where the file will be cut, then click <em>Split File</em>.</li><li>Download the parts as one ZIP, one at a time, or save them straight into a folder.</li></ol>
<h3>Ways to split</h3>
<ul><li><strong>Rows per file</strong>, for example 500,000 rows to stay well inside Excel’s limit of 1,048,576.</li><li><strong>Number of files</strong>, to share the work out evenly.</li><li><strong>Maximum file size</strong>, for upload forms and email limits.</li><li><strong>Column value</strong>, for one file per city, region, month or customer.</li></ul>
{faq([
 ("Will rows with line breaks be cut in half?", "No. The splitter understands quoted fields, so it only cuts between complete records."),
 ("Is the header copied into every file?", "Yes, as long as “First row is a header” is ticked. Untick it for files without a header."),
 ("Can I split by a column?", "Yes. Choose <em>Column value</em> and pick the column; you get one file per distinct value, up to 500 values."),
])}
<p>Read the full guide: <a href="guide-split-large-csv.html">How to split a large CSV file</a>.</p>"""),

 "merge": dict(
  path="merge-csv.html", h1="Merge", name="CSV Merger",
  title="Merge CSV Files Online, Free and Private | CSV Toolkit",
  desc="Combine CSV files into one. Match columns by name, mix delimiters and encodings, keep a single header and add a source column. Runs in your browser, no upload.",
  features=["Combine any number of CSV files", "Match columns by name", "Mixed delimiters and encodings", "Optional source file column", "Choose output delimiter and encoding"],
  intro=f"""<h2>Merge CSV files online, free and private</h2>
<p>This tool combines several CSV files into a single file, directly in your browser. It handles the differences that usually make merging painful: columns in a different order, extra columns in some files, semicolon and comma delimiters, and files saved in different encodings.</p>
<h3>How to merge CSV files</h3>
<ol><li>Add all the files at once, by choosing them or dropping them onto the page.</li><li>Drag them into the order the rows should appear. Files whose columns differ from the first one are flagged.</li><li>Choose <em>Match columns by name</em> if any file is flagged, and optionally add a column with each row’s source file.</li><li>Click <em>Merge Files</em> and download the result.</li></ol>
{faq([
 ("What if the files have different columns?", "Match columns by name builds the output from every column found in any file and leaves cells empty where a file has no value."),
 ("Do the files need the same delimiter?", "No. Each file’s delimiter and encoding are detected separately, and you choose the delimiter and encoding of the merged file."),
 ("Is the header repeated in the middle?", "No. The merged file has a single header row at the top."),
])}
<p>Read the full guide: <a href="guide-merge-csv-files.html">How to merge CSV files</a>.</p>"""),

 "inspect": dict(
  path="validate-csv.html", h1="Inspect", name="CSV Validator and Viewer",
  title="CSV Validator and Viewer Online, No Upload | CSV Toolkit",
  desc="Check a CSV file for errors and preview it: rows with the wrong number of columns, broken quotes, bad encoding, stray spaces, plus per-column types and statistics.",
  features=["Preview the first rows", "Detected column types", "Per-column statistics", "Find rows with the wrong number of columns", "Detect broken quotes and encoding problems", "Export issues as CSV"],
  intro=f"""<h2>Validate and preview CSV files</h2>
<p>Open a CSV to see what is inside before you import it anywhere. The validator previews the first rows, works out what kind of data each column holds, and lists problems that commonly break imports, all without uploading the file.</p>
<h3>What it checks</h3>
<ul><li>Rows with more or fewer columns than the header</li><li>Unclosed quotes and undecodable characters</li><li>Garbled text caused by reading UTF-8 as Windows-1252</li><li>Duplicate or missing column names and completely empty columns</li><li>Leading and trailing spaces, mixed value types, mixed line endings</li></ul>
<h3>Column statistics</h3>
<p>For every column you get the detected type (integer, decimal, date, boolean or text), how full it is, the number of distinct values, the range of numbers or dates and the most common values. Issues and statistics can both be exported as CSV.</p>
{faq([
 ("Does the validator change my file?", "No. It only reads the file. Use <a href=\"clean-csv.html\">Clean</a> to trim spaces, filter rows or remove columns."),
 ("Why does it say my text is garbled?", "Sequences like “Ã©” usually mean the encoding is wrong. See <a href=\"guide-fix-csv-encoding.html\">fixing garbled characters</a>."),
])}"""),

 "transform": dict(
  path="clean-csv.html", h1="Transform", name="CSV Cleaner",
  title="Clean CSV: Filter Rows, Remove Duplicates | CSV Toolkit",
  desc="Clean a CSV file in your browser: trim spaces, filter rows, remove duplicates, sample rows, and pick, rename or reorder columns, with a live preview.",
  features=["Trim spaces in cells", "Filter rows with rules", "Remove duplicate rows", "Random or first-N sampling", "Pick, rename and reorder columns", "Live preview"],
  intro=f"""<h2>Clean, filter and de-duplicate CSV files</h2>
<p>Turn a messy export into the file you actually need. Each step can be switched on or off, and a live preview shows the result on the first rows of your file before anything runs.</p>
<h3>The steps</h3>
<ol><li><strong>Clean cells</strong>: trim spaces and flatten line breaks inside cells.</li><li><strong>Filter rows</strong>: keep rows that match rules such as “city equals Jakarta” or “amount is at least 100”.</li><li><strong>Remove duplicates</strong>: by the whole row or by selected columns.</li><li><strong>Sample rows</strong>: the first N rows, a random N rows, a random percentage or every Nth row.</li><li><strong>Columns</strong>: keep, rename and reorder columns.</li></ol>
{faq([
 ("How do I remove duplicate rows from a CSV?", "Turn on <em>Remove duplicates</em>. Choose whether two rows count as duplicates when the whole row matches or only selected columns, then run the tool. The first occurrence is kept."),
 ("Can I filter with more than one condition?", "Yes. Add as many rules as you need and choose whether all or any of them must match."),
 ("Is a random sample in the original order?", "Yes. Rows in a random sample keep the order they had in the file."),
])}"""),

 "convert": dict(
  path="convert-csv.html", h1="Convert", name="CSV Converter",
  title="Convert CSV to Excel, JSON or TSV Online | CSV Toolkit",
  desc="Convert CSV to Excel (.xlsx), JSON, JSON Lines or TSV in your browser, or change a CSV's delimiter and encoding. Real numbers and dates in Excel. No upload.",
  features=["CSV to Excel (.xlsx)", "CSV to JSON and JSON Lines", "CSV to TSV", "Change delimiter", "Convert to UTF-8, UTF-8 with BOM, Windows-1252 or UTF-16"],
  intro=f"""<h2>Convert CSV to Excel, JSON or TSV</h2>
<p>Change a CSV into the format the next tool expects, without uploading it. The converter writes real Excel workbooks, JSON for developers, and CSV or TSV with the delimiter and encoding of your choice.</p>
<h3>Formats</h3>
<ul><li><strong>Excel (.xlsx)</strong> with a bold, frozen header row, numbers stored as numbers, YYYY-MM-DD dates stored as Excel dates and data beyond Excel’s row limit continued on extra sheets.</li><li><strong>JSON</strong> as an array of objects or arrays, compact or indented, with optional number and true/false detection.</li><li><strong>JSON Lines</strong>, one object per line, for streaming and log tools.</li><li><strong>CSV and TSV</strong> with a different delimiter, line endings or quoting.</li></ul>
{faq([
 ("How do I convert CSV to Excel?", "Choose <em>Excel</em>, keep “Store numbers as numbers” on, and click <em>Convert File</em>. The result opens directly in Excel, Numbers or Google Sheets."),
 ("Why do accents look wrong when Excel opens my CSV?", "Excel needs a hint that the file is UTF-8. Convert to CSV with the encoding <em>UTF-8 with BOM</em>, or convert to .xlsx."),
 ("Is my JSON valid?", "Yes. The output is standard JSON; empty cells can become null, empty strings or be left out."),
])}"""),
}

SEO_PAGES = {k: {"title": v["title"], "description": v["desc"], "path": v["path"]} for k, v in APP.items()}


def app_ld(k, v):
    if k == "home":
        return [WEBSITE, webapp("CSV Toolkit", "index.html", v["desc"], v["features"])]
    return [webapp(v["name"], v["path"], v["desc"], v["features"]),
            crumbs(("CSV Toolkit", "index.html"), (v["name"], v["path"]))]


def build_app_pages():
    tpl = (ROOT / "index.html").read_text(encoding="utf-8")
    for k, v in APP.items():
        s = tpl
        s = re.sub(r'<html lang="en" data-route="\w+">', f'<html lang="en" data-route="{k}">', s)
        s = re.sub(r"<!--seo:head-->.*?<!--/seo:head-->", lambda m: "<!--seo:head-->\n" + head(v["title"], v["desc"], v["path"], ld=app_ld(k, v)) + "\n<!--/seo:head-->", s, flags=re.S)
        intro = f'<section id="seo-intro" class="seo-intro card" data-route="{k}">\n{v["intro"]}\n</section>'
        s = re.sub(r"<!--seo:intro-->.*?<!--/seo:intro-->", lambda m: "<!--seo:intro-->\n" + intro + "\n<!--/seo:intro-->", s, flags=re.S)
        s = re.sub(r'(<h1 id="winTitle">)[^<]*(</h1>)', lambda m: m.group(1) + v["h1"] + m.group(2), s)
        s = re.sub(r"\?v=[0-9.]+", f"?v={VERSION}", s)
        (ROOT / v["path"]).write_text(s, encoding="utf-8")


# ============================================================================ content pages
def page(fname, title, desc, body, current="", og_type="website", ld=None, robots="index, follow"):
    nav = "".join(f'<a href="{h}"{" aria-current=\"page\"" if h == current else ""}>{t}</a>'
                  for h, t in [("index.html", "Tools"), ("guides.html", "Guides"), ("about.html", "About")])
    doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
{head(title, desc, fname, og_type, ld, robots)}
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<meta name="theme-color" content="#F2F2F7">
<meta name="google-adsense-account" content="ca-pub-XXXXXXXXXXXXXXXX">
<link rel="stylesheet" href="css/app.css?v={VERSION}">
<link rel="stylesheet" href="css/pages.css?v={VERSION}">
</head>
<body class="page">
<header class="page-top">
  <a class="brand" href="index.html"><span class="app-icon" aria-hidden="true">{ICON}</span>CSV Toolkit</a>
  <nav aria-label="Site">{nav}</nav>
  <a class="btn accent" href="index.html">Open the Tools</a>
</header>
<main class="page-main">
{body}
</main>
<footer class="page-foot">
  <nav aria-label="Tools"><a href="split-csv.html">Split CSV</a><a href="merge-csv.html">Merge CSV</a><a href="validate-csv.html">Validate CSV</a><a href="clean-csv.html">Clean CSV</a><a href="convert-csv.html">Convert CSV</a></nav>
  <nav aria-label="About this site"><a href="guides.html">Guides</a><a href="about.html">About</a><a href="privacy.html">Privacy policy</a><a href="terms.html">Terms of use</a><a href="contact.html">Contact</a></nav>
  <p>CSV Toolkit is free and open source under the <a href="{REPO}/blob/main/LICENSE">MIT license</a>. Your CSV files are processed in your browser and never uploaded.</p>
</footer>
<script src="js/ads.js?v={VERSION}"></script>
</body>
</html>
'''
    (ROOT / fname).write_text(doc, encoding="utf-8")


def simple(fname, name, title, desc, body, **kw):
    page(fname, title, desc, body, ld=[{"@type": "WebPage", "name": name, "url": url(fname), "description": desc, "isPartOf": {"@id": f"{D}/#website"}},
                                        crumbs(("CSV Toolkit", "index.html"), (name, fname))], **kw)


def build_content_pages():
    simple("about.html", "About", "About CSV Toolkit", "What CSV Toolkit is, how it works, and why your files never leave your browser.", f'''<article class="prose">
<h1>About CSV Toolkit</h1>
<p class="lead">CSV Toolkit is a set of free tools for everyday work with CSV files: splitting big files, merging several files, finding problems in the data, cleaning and filtering rows, and converting to Excel or JSON.</p>

<h2>How it works</h2>
<p>Everything happens inside your web browser. When you open a file, the page reads it in small chunks with JavaScript, does the work on your own computer or phone, and hands the result back to you as a download. There is no server that receives your data, so the tools work the same whether your file holds a shopping list or customer records.</p>
<p>Reading in chunks is also what lets the tools handle large files. A CSV with hundreds of thousands of rows is processed without freezing the page, and line breaks inside quoted fields (an address on two lines, for example) are kept inside their row instead of breaking the file apart.</p>

<h2>The tools</h2>
<ul>
<li><a href="split-csv.html">Split</a> breaks a file into parts by row count, number of files, file size, or by the value of a column.</li>
<li><a href="merge-csv.html">Merge</a> combines several files into one and can match columns by name.</li>
<li><a href="validate-csv.html">Inspect</a> previews the data, describes every column and lists problems such as rows with the wrong number of columns.</li>
<li><a href="clean-csv.html">Transform</a> trims cells, filters rows, removes duplicates, takes samples and picks, renames or reorders columns.</li>
<li><a href="convert-csv.html">Convert</a> produces TSV, JSON, JSON Lines or a real Excel workbook, and can change the text encoding.</li>
</ul>

<h2>Who makes it</h2>
<p>CSV Toolkit is an open-source project maintained by <a href="https://github.com/RRMADON26">RRMADON26</a>. The full source code is on <a href="{REPO}">GitHub</a>, where you can read exactly what the page does with your files, report a problem or suggest a feature.</p>

<h2>How it stays free</h2>
<p>The tools cost nothing to use.<span data-ads-note hidden> The site shows a small number of ads from Google AdSense to cover hosting. Ads are kept away from the buttons you use to run the tools and download results, and they never have access to your files. See the <a href="privacy.html">privacy policy</a> for how ad cookies work.</span></p>
</article>''', current="about.html")

    simple("privacy.html", "Privacy policy", "Privacy policy | CSV Toolkit", "How CSV Toolkit handles your files and data, including cookies used by Google AdSense.", f'''<article class="prose">
<h1>Privacy policy</h1>
<p class="meta">Last updated {DATE_TEXT}</p>
<p class="lead">The short version: the files you open in CSV Toolkit are processed on your device and are never uploaded. This page explains that in detail, along with the few other kinds of data involved in visiting the site.</p>

<h2>Your files</h2>
<p>When you choose or drop a file, it is read by JavaScript running in your browser. Splitting, merging, inspecting, transforming and converting all happen on your own device, and the results are given to you as downloads or saved to a folder you pick. Your files and their contents are not sent to us or to anyone else, and we have no way to see them.</p>

<h2>Data stored in your browser</h2>
<p>If you save settings as a preset, the preset is stored in your browser’s local storage under the name <code>csvkit.presets.v1</code>. It stays on your device and is not transmitted. You can remove it at any time by clearing this site’s data in your browser settings.</p>

<h2>Server logs</h2>
<p>Like any website, the host that delivers these pages may keep standard access logs, such as your IP address, browser type and the pages requested, for security and to keep the service running. These logs never include the contents of your files, because your files are never sent to the server.</p>

<h2>Advertising and cookies</h2>
<p>This site may show ads served by Google AdSense. When it does:</p>
<ul>
<li>Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites.</li>
<li>Google’s use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and other sites on the internet.</li>
<li>You may opt out of personalized advertising by visiting Google’s <a href="https://myadcenter.google.com/">My Ad Center</a>. You can also opt out of some third-party vendors’ use of cookies for personalized advertising at <a href="https://www.aboutads.info/choices/">aboutads.info</a>.</li>
<li>Google explains how it uses information from sites that show its ads in <a href="https://policies.google.com/technologies/partner-sites">How Google uses information from sites or apps that use our services</a>.</li>
</ul>
<p>If you visit from the European Economic Area, the United Kingdom or Switzerland, you will be asked for consent before personalized ads are shown, through a consent message provided by Google. You can change your choice later from the link in that message.</p>
<p>Ad code runs separately from the tools and never receives your files.</p>

<h2>Analytics</h2>
<p>CSV Toolkit does not use analytics or tracking scripts of its own.</p>

<h2>Children</h2>
<p>The site is a general-purpose utility and is not directed at children under 13. We do not knowingly collect personal information from children.</p>

<h2>Changes to this policy</h2>
<p>If this policy changes, the new version will be posted on this page with a new date at the top.</p>

<h2>Contact</h2>
<p>Questions about privacy can be sent through the <a href="contact.html">contact page</a>.</p>
</article>''')

    simple("terms.html", "Terms of use", "Terms of use | CSV Toolkit", "The terms for using CSV Toolkit.", f'''<article class="prose">
<h1>Terms of use</h1>
<p class="meta">Last updated {DATE_TEXT}</p>
<p class="lead">By using CSV Toolkit you agree to these terms. They are short because the service is simple: the tools run in your browser and work on files you choose.</p>

<h2>Using the tools</h2>
<p>You may use CSV Toolkit for personal or commercial work at no cost. You are responsible for the files you open and for having the right to process them. Do not use the site to break the law or to interfere with its operation, for example by trying to overload or attack it.</p>

<h2>Your data</h2>
<p>Your files are processed on your own device and are not uploaded. You keep all rights to your files and to the results the tools produce. Because nothing is stored on our side, we cannot recover a file for you, so keep your own copies of anything important.</p>

<h2>No warranty</h2>
<p>The tools are provided “as is”, without warranty of any kind. They have been tested carefully, but you should check important results before relying on them, especially before replacing original data. To the extent the law allows, the maintainers are not liable for any loss or damage that comes from using the site.</p>

<h2>Open source</h2>
<p>The source code is available under the <a href="{REPO}/blob/main/LICENSE">MIT license</a>. That license governs your use of the code itself; these terms cover your use of the website.</p>

<h2>Advertising</h2>
<p>The site may display ads provided by Google. Ads are governed by Google’s own policies, and the <a href="privacy.html">privacy policy</a> describes the cookies they may use.</p>

<h2>Changes</h2>
<p>These terms may be updated from time to time. The date at the top shows when they last changed. Continuing to use the site after a change means you accept the new terms.</p>

<h2>Contact</h2>
<p>See the <a href="contact.html">contact page</a>.</p>
</article>''')

    simple("contact.html", "Contact", "Contact | CSV Toolkit", "How to get in touch about CSV Toolkit: bug reports, feature ideas and privacy questions.", f'''<article class="prose">
<h1>Contact</h1>
<p class="lead">CSV Toolkit is developed in the open, so the best way to reach the maintainer is on GitHub.</p>

<h2>Report a problem or suggest a feature</h2>
<p>Open an issue on the <a href="{REPO}/issues">GitHub issue tracker</a>. Describe what you were doing, what you expected and what happened instead. If a file causes the problem, please share a small sample with any private data removed, never the original.</p>

<h2>Privacy and other questions</h2>
<p>Questions about privacy, the terms or anything else are welcome on the same <a href="{REPO}/issues">issue tracker</a>. Please don’t post personal information there, since issues are public.</p>

<h2>Source code</h2>
<p>The code is available at <a href="{REPO}">{REPO.replace("https://", "")}</a>.</p>
</article>''')

    for g in GUIDES:
        f, t, d, body = g
        page(f, f"{t} | CSV Toolkit", d, body, "guides.html", og_type="article", ld=[
            {"@type": "Article", "headline": t, "description": d, "image": OG_IMAGE, "datePublished": DATE_ISO, "dateModified": DATE_ISO,
             "author": AUTHOR, "publisher": AUTHOR, "mainEntityOfPage": url(f), "inLanguage": "en", "isPartOf": {"@id": f"{D}/#website"}},
            crumbs(("CSV Toolkit", "index.html"), ("Guides", "guides.html"), (t, f))])

    cards = "".join(f'<a class="guide-card" href="{f}"><b>{esc(t)}</b><span>{esc(d)}</span></a>' for f, t, d, _ in GUIDES)
    simple("guides.html", "Guides", "CSV Guides: Split, Merge and Fix Encodings | CSV Toolkit", "Practical guides for working with CSV files: splitting large files, merging exports and fixing garbled characters.", f'''<article class="prose wide">
<h1>Guides</h1>
<p class="lead">Short, practical guides to the CSV problems people run into most often, with steps for the tools on this site.</p>
<div class="guide-list">{cards}</div>
</article>''', current="guides.html")

    page("404.html", "Page not found | CSV Toolkit", "This page doesn’t exist. Open one of the CSV tools or read a guide instead.", '''<article class="prose">
<h1>Page not found</h1>
<p class="lead">The page you were looking for doesn’t exist, or it has moved.</p>
<p>Try one of the tools:</p>
<ul><li><a href="split-csv.html">Split a CSV file</a></li><li><a href="merge-csv.html">Merge CSV files</a></li><li><a href="validate-csv.html">Validate a CSV file</a></li><li><a href="clean-csv.html">Clean a CSV file</a></li><li><a href="convert-csv.html">Convert a CSV file</a></li></ul>
<p>Or go to the <a href="index.html">overview</a> or the <a href="guides.html">guides</a>.</p>
</article>''', robots="noindex, follow")


GUIDES = [
 ("guide-split-large-csv.html", "How to split a large CSV file", "When a CSV is too big for Excel, an upload form or an email, here is how to break it into smaller files without corrupting rows or losing the header.",
 f'''<article class="prose">
<p class="meta"><a href="guides.html">Guides</a> · Updated {DATE_TEXT}</p>
<h1>How to split a large CSV file</h1>
<p class="lead">Big CSV exports run into limits all the time: Excel stops at 1,048,576 rows, import forms reject files above a certain size, and email providers cap attachments. Splitting the file into smaller parts is usually the simplest fix, as long as it is done carefully.</p>

<h2>Why splitting “by lines” can go wrong</h2>
<p>A CSV looks like one record per line, but that is not always true. A field wrapped in double quotes may contain a line break, for example an address written on two lines or a comment with several paragraphs. A tool that cuts the file every <em>n</em> lines, such as the Unix <code>split -l</code> command, can slice one of those records in half. The result is two broken files: one ending with half a row, the next starting with the other half.</p>
<p>The second common problem is the header. Only the first part keeps the column names, so every later part is harder to import and easy to misread.</p>
<p>A safe split therefore needs to understand quotes, so that it only cuts between records, and it should repeat the header in every part.</p>

{AD}

<h2>Choose how to divide the file</h2>
<ul>
<li><strong>Rows per file</strong> is the most common choice. Pick a number below the limit of wherever the files are going, for example 500,000 rows for comfortable work in Excel.</li>
<li><strong>Number of files</strong> is useful when you want to share the work out, for example four equal parts for four people.</li>
<li><strong>Maximum file size</strong> fits upload forms and email: tell it “10 MB” and each part stays under that size, including the header.</li>
<li><strong>Column value</strong> creates one file per distinct value, such as one file per city, region or month. This is often what people really want when they split a report.</li>
</ul>

<h2>Step by step</h2>
<ol>
<li>Open the <a href="split-csv.html">Split tool</a> and choose your file, or drop it onto the page. The file is read on your device and is not uploaded.</li>
<li>Check the file panel. It shows the number of rows and columns, and whether the first row is treated as a header. Untick that box if your file has no header.</li>
<li>Pick how to split and enter a number. The strip at the top shows where the file will be cut before anything runs.</li>
<li>Click <em>Split File</em>. When it finishes, download every part as one ZIP, download parts one at a time, or, in Chrome and Edge, save them straight into a folder.</li>
</ol>

<h2>Check the result</h2>
<p>A quick sanity check catches most mistakes. The row counts of the parts should add up to the row count of the original file, and every part should open with the same header. If you split by column value, the summary lists how many rows went into each file.</p>

<h2>Tips</h2>
<ul>
<li>If accents or symbols look wrong in the parts, the original was probably read with the wrong encoding. See <a href="guide-fix-csv-encoding.html">fixing garbled characters</a>.</li>
<li>Keep the original file. Splitting never changes it, but it is the copy you will want if you need to split differently later.</li>
<li>For files with more than a few million rows, saving to a folder avoids holding every part in memory at once.</li>
</ul>
</article>'''),

 ("guide-merge-csv-files.html", "How to merge CSV files", "Combine several CSV exports into one file, even when their columns are in a different order, use different delimiters or come in different encodings.",
 f'''<article class="prose">
<p class="meta"><a href="guides.html">Guides</a> · Updated {DATE_TEXT}</p>
<h1>How to merge CSV files</h1>
<p class="lead">Merging CSV files sounds like copying one file under another, and sometimes it is. More often the files came from different exports, and small differences between them turn a simple paste into a mess.</p>

<h2>What usually differs between files</h2>
<ul>
<li><strong>Column order.</strong> One export lists <code>name, id, city</code>, another <code>id, name, city</code>. Pasting them together puts names under the id column.</li>
<li><strong>Extra or missing columns.</strong> A newer export added a column, or an older one lacks it.</li>
<li><strong>Delimiters.</strong> Spreadsheet programs in many European locales save CSV files with semicolons instead of commas.</li>
<li><strong>Encodings.</strong> Files saved on different systems may use UTF-8 or Windows-1252, so the same name appears correctly in one and garbled in the other.</li>
<li><strong>Repeated headers.</strong> Gluing files together by hand leaves a header row in the middle of the data.</li>
</ul>

{AD}

<h2>Two ways to combine rows</h2>
<p><strong>Keep columns as they are</strong> appends the rows of each file in order and keeps a single header at the top. It is the right choice when every file has exactly the same columns in the same order.</p>
<p><strong>Match columns by name</strong> builds the output from every column name found in any file, in order of first appearance, and puts each value under its own column. Cells for columns a file doesn’t have are left empty. Use it whenever the files are not identical.</p>

<h2>Step by step</h2>
<ol>
<li>Open the <a href="merge-csv.html">Merge tool</a> and add all the files at once. Each file’s encoding and delimiter are detected automatically.</li>
<li>Drag the files into the order you want the rows to appear. The first file is the reference, and any file whose columns differ from it is flagged.</li>
<li>Choose <em>Match columns by name</em> if any file is flagged.</li>
<li>Optionally tick <em>Add a column with the source file name</em>. It makes it easy to see later which rows came from where.</li>
<li>Under <em>Format details</em>, pick the delimiter and encoding of the result, then click <em>Merge Files</em>.</li>
</ol>

<h2>Check the result</h2>
<p>The merged file should contain as many rows as all the input files together. The summary after merging shows that total and how many files had different columns. Open the result and look at a few rows from each source, especially near the start of the second and third files, where problems tend to show up.</p>

<h2>Tips</h2>
<ul>
<li>Column names must match exactly to be combined. “Email” and “E-mail” count as two different columns; rename one first in the <a href="clean-csv.html">Transform tool</a>.</li>
<li>If the same records appear in several files, run the result through Transform’s <em>Remove duplicates</em> step.</li>
</ul>
</article>'''),

 ("guide-fix-csv-encoding.html", "Fixing garbled characters in a CSV file", "Why names like José turn into JosÃ© or show question marks, and how to read and save a CSV with the right encoding.",
 f'''<article class="prose">
<p class="meta"><a href="guides.html">Guides</a> · Updated {DATE_TEXT}</p>
<h1>Fixing garbled characters in a CSV file</h1>
<p class="lead">You open a CSV and “José” shows up as “JosÃ©”, “Zürich” as “ZÃ¼rich”, or curly quotes as “â€™”. Nothing is wrong with the data itself; it is being read with the wrong text encoding.</p>

<h2>What an encoding is</h2>
<p>A file stores text as bytes, and an encoding is the rule that turns those bytes back into letters. Plain English letters look the same in almost every encoding, which is why the problem only appears with accents, symbols and non-Latin scripts. The two encodings you meet most often in CSV files are:</p>
<ul>
<li><strong>UTF-8</strong>, the modern standard, which can represent every language. Most databases, web apps and APIs export UTF-8.</li>
<li><strong>Windows-1252</strong> (often called Latin-1 or ANSI), an older Western European encoding still used by some Windows programs.</li>
</ul>
<p>In UTF-8, “é” is stored as two bytes. Read those two bytes as Windows-1252 and you get two characters, “Ã©”. That pattern of an “Ã” or “â€” followed by another symbol is the signature of UTF-8 text read as Windows-1252.</p>

{AD}

<h2>The other symptom: question marks and �</h2>
<p>The opposite mistake looks different. If a Windows-1252 file is read as UTF-8, some bytes are simply invalid, and they show up as the replacement character “�” or as question marks. The <a href="validate-csv.html">Inspect tool</a> reports both symptoms: it counts rows with undecodable characters and warns about likely garbled text.</p>

<h2>How to fix it</h2>
<ol>
<li>Open the file in any tool and expand <em>Encoding and delimiter</em> in the file panel. The detected encoding is shown there.</li>
<li>If the preview shows “Ã©”-style text, choose UTF-8. If it shows � or question marks, choose Windows-1252. The preview and row counts update straight away.</li>
<li>Once the text looks right, use the <a href="convert-csv.html">Convert tool</a> to save a clean copy. For general use pick UTF-8. If the file is going to be opened in Excel by double-clicking, pick <em>UTF-8 with BOM</em>.</li>
</ol>

<h2>Why Excel needs the BOM</h2>
<p>When Excel opens a CSV by double-click, it guesses the encoding, and without a hint it usually guesses the local Windows encoding. A byte-order mark (BOM) is a short invisible marker at the start of the file that tells Excel the file is UTF-8. Adding it is the simplest way to make accents survive a double-click.</p>

<h2>When the damage is permanent</h2>
<p>If a file has already been opened with the wrong encoding and then saved, the garbled text is now the actual content, sometimes several layers deep. Re-reading it with a different encoding may not help. In that case the most reliable fix is to go back to the original export. To avoid the problem next time, export as UTF-8 and keep the original file untouched.</p>
</article>'''),
]


# ============================================================================ site files
def build_site_files():
    (ROOT / "js" / "seo-data.js").write_text(
        "/* Generated by tools/build_pages.py. Titles and descriptions for in-app navigation. */\n"
        "window.SEO_PAGES = " + json.dumps(SEO_PAGES, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    pages = [v["path"] for v in APP.values()] + ["guides.html"] + [g[0] for g in GUIDES] + ["about.html", "privacy.html", "terms.html", "contact.html"]
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml += [f"  <url><loc>{url(p)}</loc><lastmod>{DATE_ISO}</lastmod></url>" for p in pages]
    xml.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(xml) + "\n", encoding="utf-8")
    manifest = {"name": "CSV Toolkit", "short_name": "CSV Toolkit",
                "description": "Split, merge, validate, clean and convert CSV files in your browser.",
                "start_url": "index.html", "display": "standalone", "background_color": "#F2F2F7", "theme_color": "#F2F2F7",
                "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                          {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
                          {"src": "favicon.svg", "sizes": "any", "type": "image/svg+xml"}]}
    (ROOT / "site.webmanifest").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build_app_pages()
    build_content_pages()
    build_site_files()
    print("Built", len(APP), "app pages,", len(GUIDES) + 6, "content pages, seo-data.js, sitemap.xml and site.webmanifest.")
