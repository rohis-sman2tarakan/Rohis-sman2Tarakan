# Audit kualitas dan keamanan (informasi Aislop)

Tanggal: 2026-10-25. Basis: `origin/main` @ `13d69a5`.

## Cara pemindaian
- Aislop CLI **0.18.1** (MIT, npm, integritas `sha512-VHkYEr5m…`), dipasang di direktori terpisah di luar repo dengan `npm install --ignore-scripts`; tidak ada dependensi baru di proyek ini.
- Telemetri dimatikan (`DO_NOT_TRACK=1`, `AISLOP_NO_TELEMETRY=1`). Pemindaian dijalankan pada salinan checkout, bukan pada working tree.
- Cakupan: 10 file JavaScript (`js/*.js`, `.github/scripts/validate.js`, `tests/`). **HTML, CSS, dan JSON tidak dipindai** oleh Aislop; skor tidak mewakili seluruh situs.

## Hasil Aislop (CLI)
| Aturan | Jumlah awal | Penilaian |
|---|---|---|
| `eslint/no-undef` | 69 | False positive. `ContentRepository`, `RohisAuth`, `RohisUtil` dipasang ke `window` oleh `data.js`/`appwrite-repository.js` lewat urutan `<script>`. Menambah `/* global */` tidak mengubah hasil, jadi dibiarkan. Ini yang menekan skor (32/100). |
| `security/innerhtml` | 5 | Diverifikasi manual: semua nilai dinamis di template memakai `esc()`/`safeUrl()`/`encodeURIComponent`, atau konstanta kode. Tidak ada celah. |
| `ai-slop/narrative-comment` | 40 | Gaya komentar pemisah bagian yang konsisten di proyek; tidak diubah. |
| `complexity/file-too-large` | 3 | `admin.js`, `app.js`, `appwrite-repository.js`. Tidak dipecah hanya demi batas scanner. |
| `eslint/no-unused-vars` | 11 | Parameter `catch` tak terpakai; diganti `catch {` (diperbaiki). |
| `eslint/no-unused-expressions` 2, `prefer-string-starts-ends-with` 1, `no-useless-escape` 1 | 4 | Diperbaiki. |
| `unicorn/no-invalid-fetch-options` | 1 | False positive: `body` bernilai `undefined` untuk GET. |
| `ai-slop/hardcoded-url` | 1 | Disengaja: endpoint dan project ID Appwrite bersifat publik. |
| `code-quality/duplicate-block` | 1 | Daftar kegiatan vs tulisan di `admin.js`; belum layak disatukan. |
| `security/vulnerable-dependency` | 1 | `postcss-selector-parser` (moderate, dev-only) lewat Tailwind 3; perbaikannya migrasi ke Tailwind 4, tidak dilakukan. |

Setelah perbaikan: 122 temuan (awal 136), skor 33 (awal 32). Skor nyaris tidak berubah karena didominasi false positive `no-undef`.

## Temuan audit manual (bukan hasil CLI)
| Prioritas | Temuan | Status |
|---|---|---|
| P2 | `boot()` di `app.js` tanpa penanganan error. Bila satu berkas `data/*.json` gagal dimuat saat Appwrite tidak terjangkau, `initReveal()` tidak berjalan sehingga elemen `data-reveal` tetap transparan, daftar kosong, dan tidak ada pesan. Terbukti di Chromium: 12 dari 20 skenario gagal. | Diperbaiki: tiap bagian dijalankan terpisah, pesan status ditampilkan, `initReveal()` selalu jalan. 20/20 lolos. |
| P3 | Tombol hapus/ubah status/pilih media/ekspor di Kelola tanpa `try/catch`: error jadi unhandled rejection dengan toast generik "Gagal: …". Ubah status program juga memutasi objek lokal sebelum simpan. | Diperbaiki: `attempt()` menampilkan pesan spesifik; status disimpan lewat salinan. |
| P3 | Komentar usang di `admin.js` (localStorage). | Diperbaiki. |

## Belum diverifikasi / perlu tindakan manual
- Konfigurasi Appwrite (izin tabel, bucket media: batas tipe/ukuran file di sisi server, 2FA, rate limit) tidak bisa dinilai dari kode klien.
- Pemeriksaan klien `file.type` bukan kontrol keamanan; pastikan bucket membatasi ekstensi dan ukuran.
- Pengujian di Safari/Firefox dan perangkat sungguhan belum dilakukan.

## Usulan integrasi CI (belum diterapkan)
Belum layak memblokir CI: cakupan hanya JS dan skor didominasi false positive. Jika diinginkan, mulai dari mode lapor dengan versi dipatok:

```yaml
# usulan; permission minimal, tidak memblokir
- run: npm install --no-save --ignore-scripts aislop@0.18.1
- run: DO_NOT_TRACK=1 npx --no-install aislop scan --json > aislop.json || true
```
Lalu `aislop baseline write` agar `aislop ci` hanya gagal pada temuan baru, dengan `rules: eslint/no-undef: off` hanya setelah disetujui pemilik repo.
