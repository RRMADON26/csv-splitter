#!/usr/bin/env python3
"""Generate a dummy CSV for testing CSV Splitter.

Usage:
    python3 generate_dummy.py [rows] [output_file]

Example:
    python3 generate_dummy.py 200000 dummy_200k.csv
"""
import csv
import random
import sys

rows = int(sys.argv[1]) if len(sys.argv) > 1 else 200_000
out = sys.argv[2] if len(sys.argv) > 2 else "dummy_200k.csv"

random.seed(1)
names = ["Budi", "Siti", "Andi", "Dewi", "Agus", "Rina", "Joko", "Lestari", "Hendra", "Putri", "Eko", "Wati"]
cities = ["Jakarta", "Bandung", "Surabaya", "Medan", "Semarang", "Makassar", "Yogyakarta", "Denpasar"]

with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["id", "nama", "email", "kota", "umur", "saldo", "alamat", "tanggal_daftar"])
    for i in range(1, rows + 1):
        nama = random.choice(names) + " " + random.choice(names)
        alamat = f"Jl. Mawar No. {random.randint(1, 99)}, RT {random.randint(1, 9)}"
        if i % 1000 == 0:  # address with a newline and quotes, to exercise the parser
            alamat += '\nLantai 2, "Blok A"'
        w.writerow([
            i, nama, f"user{i}@example.com", random.choice(cities), random.randint(18, 65),
            round(random.uniform(0, 1e7), 2), alamat,
            f"2025-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
        ])

print(f"Wrote {rows} data rows to {out}")
