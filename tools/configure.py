#!/usr/bin/env python3
"""Fill in the site's domain and Google AdSense IDs.

Usage:
    python3 tools/configure.py --domain https://csvtoolkit.example \\
        --adsense ca-pub-1234567890123456 \\
        [--slot-overview 1111111111] [--slot-tool 2222222222] [--slot-article 3333333333]

It replaces the placeholders in index.html, the content pages, ads.txt, robots.txt,
sitemap.xml and js/ads.js. Run it once on a fresh checkout; to change the values later,
run `git checkout -- .` first (or edit the files by hand).
"""
import argparse, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOMAIN_PH = "https://YOUR-DOMAIN.example"
CLIENT_PH = "ca-pub-XXXXXXXXXXXXXXXX"
PUB_PH = "pub-XXXXXXXXXXXXXXXX"
SLOT_PH = {"overview": "SLOT_OVERVIEW", "tool": "SLOT_TOOL", "article": "SLOT_ARTICLE"}

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--domain", help="Site address, e.g. https://csvtoolkit.example (no trailing slash)")
    ap.add_argument("--adsense", help="AdSense publisher ID, e.g. ca-pub-1234567890123456")
    for k in SLOT_PH:
        ap.add_argument(f"--slot-{k}", help=f"Ad unit ID for the {k} placement (digits)")
    a = ap.parse_args()
    if not (a.domain or a.adsense):
        ap.error("give --domain and/or --adsense")
    if a.domain and not re.fullmatch(r"https://[a-z0-9.-]+\.[a-z]{2,}", a.domain.rstrip("/")):
        ap.error("--domain must look like https://example.com")
    if a.adsense and not re.fullmatch(r"ca-pub-\d{10,20}", a.adsense):
        ap.error("--adsense must look like ca-pub-1234567890123456")
    for k in SLOT_PH:
        v = getattr(a, f"slot_{k}")
        if v and not v.isdigit():
            ap.error(f"--slot-{k} must be digits")

    files = list(ROOT.glob("*.html")) + [ROOT / "ads.txt", ROOT / "robots.txt", ROOT / "sitemap.xml", ROOT / "js" / "ads.js"]
    changed = 0
    for f in files:
        s = f.read_text(encoding="utf-8"); orig = s
        if a.domain:
            s = s.replace(DOMAIN_PH, a.domain.rstrip("/"))
        if a.adsense:
            s = s.replace(CLIENT_PH, a.adsense).replace(PUB_PH, a.adsense[3:])
        if f.name == "ads.js":
            for k, ph in SLOT_PH.items():
                v = getattr(a, f"slot_{k}")
                if v:
                    s = s.replace(f"'{ph}'", f"'{v}'")
        if s != orig:
            f.write_text(s, encoding="utf-8"); changed += 1
            print("updated", f.relative_to(ROOT))
    left = [str(f.relative_to(ROOT)) for f in files if any(p in f.read_text(encoding="utf-8") for p in (DOMAIN_PH, CLIENT_PH, PUB_PH))]
    if left:
        print("\nPlaceholders still present in:", ", ".join(left))
    print(f"\n{changed} file(s) changed.")

if __name__ == "__main__":
    sys.exit(main())
