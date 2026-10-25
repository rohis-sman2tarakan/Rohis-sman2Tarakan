# STATUS — Situs Rohis Al Ihsan (rohis-sman2tarakan.github.io)

_Disusun 25 Oktober 2026 dari isi repo (commit terakhir 25 Okt 2026, PR #14). Hanya fakta yang tertulis di repo; yang tidak bisa diverifikasi dari repo ditandai._

## Ringkasan
Website Rohis Al Ihsan SMAN 2 Tarakan. Situs statis (HTML + Tailwind hasil build yang di-commit) untuk GitHub Pages. Repo public. Paling aktif dikerjakan: banyak commit pada 19 dan 25 Okt.

## Stack
HTML statis + Tailwind (build ke `css/tailwind.css`, wajib di-commit), font Playfair Display dan Plus Jakarta Sans. Konten dibaca dari **Appwrite** (project di wilayah Frankfurt, database `rohis`, tabel `site`, `programs`, `activities`, `articles`, bucket `media`). `data/*.json` hanya data awal dan cadangan bila Appwrite tidak terjangkau.

## Sudah ada
- Halaman publik: beranda, kegiatan (filter kategori), detail kegiatan, Rohis Journal (tulisan), detail tulisan, tentang.
- Admin `/kelola/`: login kode 6 angka lewat email (tanpa password); hanya anggota tim `pengurus` di Appwrite yang bisa menulis. Dashboard, CRUD kegiatan, tulisan, program, unggah media (diperkecil ke ±1600px, maks 5 MB), pengaturan situs.
- Periode kepengurusan (kolom `period`) dengan filter arsip (19 Okt).
- Formulir pendaftaran terpasang ke semua tombol Gabung (19 Okt).
- Proteksi media: file baru privat; izin baca publik hanya diberikan bila dirujuk konten berstatus terbit.
- Refresh desain editorial (25 Okt); tab bar mobile dengan animasi Lottie (25 Okt).
- Pengamanan URL dan HTML: fungsi `escapeHtml` dan `safeUrl` dengan tes regresi; audit "Aislop" (`docs/AUDIT-AISLOP.md`).
- CI `validate.yml`: validasi JSON dan field wajib, tautan internal, sintaks JS, tes sanitizer, dan `css/tailwind.css` harus sinkron. Ada juga dua tes browser Playwright di `tests/browser/`.

## Belum / terbuka
- Data placeholder: jumlah anggota, tahun berdiri, tautan Instagram/TikTok resmi sengaja dikosongkan (README). Isi lewat `/kelola/` → Pengaturan.
- Alur editorial (pengajuan, pemeriksaan, persetujuan) baru tertulis di `docs/ALUR-EDITORIAL.md`; `templates/daftar-pengajuan.csv` menyiapkan daftar pengajuan.
- Tidak tercatat: berapa pengurus yang sudah terdaftar di tim `pengurus`, dan apakah media produksi sudah terisi.

## Hal yang perlu diwaspadai
- **`docs/ALUR-EDITORIAL.md` bertentangan dengan README.** Dokumen itu menyatakan konten disimpan di JSON repo dan `/kelola/` hanya prototipe lokal, bukan CMS bersama. README dan commit 19 Okt menyatakan `/kelola/` memakai Appwrite dengan login pengurus dan perubahan langsung terlihat publik. Anggap README yang benar sampai dibuktikan lain, dan perbarui dokumen editorial.
- Domain baru harus didaftarkan sebagai Web platform di Appwrite.
- Setelah mengubah class di HTML/JS atau `tailwind.config.js`, jalankan `npm run build:css` lalu commit `css/tailwind.css`; CI gagal bila tidak sinkron.
- Menambah pengurus: Appwrite Console → Auth → Teams → `pengurus` → Create membership.
- Perubahan lewat `/kelola/` tidak mengubah `data/*.json`; unduh cadangan lewat Kelola → Pengaturan.

## Dokumen penting
`README.md`, `docs/ALUR-EDITORIAL.md`, `docs/SPESIFIKASI-FORMULIR.md`, `docs/AUDIT-AISLOP.md`, `docs/AUDIT-TEKNIS-AWAL.md`.

## Langkah berikutnya (usulan, bukan dari repo)
Selaraskan `docs/ALUR-EDITORIAL.md` dengan cara kerja `/kelola/` yang sekarang.

---
Perbarui file ini di akhir tiap sesi kerja: tanggal, apa yang selesai, apa yang terbuka.
