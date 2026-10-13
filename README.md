# CSV Splitter

Alat web satu file untuk **memecah file CSV besar menjadi beberapa file**. Mampu menangani ratusan ribu baris atau lebih (diuji dengan 200.000 baris, ±19 MB). Semua diproses **di browser** — file tidak pernah diunggah ke server mana pun.

## Fitur

- **Streaming** — file dibaca bertahap, jadi UI tidak hang meski file besar.
- **Parser sadar kutip (RFC 4180)** — baris baru di dalam field ber-kutip (mis. alamat multi-baris) tetap dihitung sebagai satu baris, sehingga data tidak rusak.
- **Dua cara membagi** — berdasarkan *jumlah baris per file* atau *jumlah file hasil*.
- **Header diulang** di setiap file hasil (bisa dimatikan).
- **Encoding** — UTF-8, Windows-1252 / Latin-1, UTF-16 LE. BOM UTF-8 dibuang otomatis.
- **Unduh** per file atau semuanya dalam satu **ZIP** (dibuat langsung di browser, tanpa library).
- **Tema terang/gelap** — mengikuti sistem, bisa diganti manual, pilihan diingat.
- **Responsif** — tampil baik di desktop, tablet, dan ponsel.
- **Nol dependensi** — tidak perlu build, npm, atau server.

## Cara pakai

1. Buka `index.html` di browser (klik dua kali, atau jalankan server statis, lihat di bawah).
2. Seret file CSV ke kotak **+**, atau klik **Pilih file CSV**.
3. Tunggu jumlah baris dihitung, lalu atur di kartu **Pengaturan**:
   - **Cara membagi**: *Jumlah baris per file* atau *Jumlah file hasil*
   - **Awalan nama**: nama file hasil menjadi `awalan_001_namafile.csv`
   - **Encoding** dan **Baris pertama adalah header**
4. Klik **Pecah file**.
5. Unduh tiap file lewat tombol **Unduh**, atau semuanya lewat **Unduh ZIP**.

### Contoh

File 200.000 baris data dengan 50.000 baris per file menghasilkan 4 file:

```
part_001_data.csv   50.000 baris
part_002_data.csv   50.000 baris
part_003_data.csv   50.000 baris
part_004_data.csv   50.000 baris
```

### Menjalankan lewat server lokal (opsional)

```bash
python3 -m http.server 8765
# lalu buka http://localhost:8765
```

## Mencoba dengan data dummy

Skrip `generate_dummy.py` membuat CSV uji, termasuk baris dengan koma, tanda kutip, dan newline di dalam field.

```bash
python3 generate_dummy.py 200000 dummy_200k.csv
```

Hasilnya 200.000 baris data + 1 header. Setiap kelipatan 1.000 baris berisi alamat multi-baris, jadi `wc -l` akan menunjukkan 200.201 baris fisik, tetapi tool ini akan melaporkan **200.000 baris data** — itu perilaku yang benar.

## Cara kerja

- **Pemindaian**: `File.stream()` → `TextDecoderStream` → pemindai karakter yang melacak status "di dalam kutip". Newline hanya dianggap pemisah record jika berada di luar kutip.
- **Pemecahan**: record dikumpulkan per bagian dan dijadikan `Blob`. Header (jika ada) disisipkan di depan tiap bagian.
- **ZIP**: penulis ZIP minimal dengan metode *store* (tanpa kompresi), lengkap dengan CRC-32, dan nama file UTF-8.
- **Hitung baris**: dilakukan lebih dulu agar mode *jumlah file hasil* tahu berapa baris per file.

## Batasan

- ZIP tidak dikompresi dan tidak mendukung ZIP64, jadi **tidak bisa untuk hasil di atas 4 GB**. Untuk kasus itu, unduh per file.
- File hasil ditampung di memori browser sebelum diunduh. File ratusan MB aman; file beberapa GB bisa memberatkan.
- Pemisah record dikenali dari `\n`, sehingga file lama dengan akhir baris `\r` saja (Mac klasik) tidak didukung. `\r\n` didukung.
- Tool tidak mengurai kolom, jadi pemisah (`,` `;` tab) tidak berpengaruh dan tidak ada validasi jumlah kolom.
- Font diambil dari Google Fonts; tanpa internet, tampilan memakai font sistem.

## Struktur proyek

```
index.html          Aplikasi (HTML + CSS + JS dalam satu file)
generate_dummy.py   Pembuat CSV dummy untuk pengujian
README.md           Dokumentasi
```

## Pengujian

Diuji manual di browser dengan `dummy_200k.csv`:

- jumlah baris terdeteksi 200.000 (alamat multi-baris tidak dihitung ganda);
- pecah 50.000 baris per file menghasilkan 4 file × 50.000 baris, selesai < 1 detik;
- header ada di setiap file;
- gabungan semua file (header diambil sekali) identik byte-per-byte dengan file asli;
- ZIP valid, CRC semua entri cocok.
