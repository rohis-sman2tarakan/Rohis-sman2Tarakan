# Audit Teknis Awal Website Rohis

Tanggal pemeriksaan: 18 Oktober 2026  
Cakupan: pembacaan kode pada `main`; belum menjalankan situs di browser dan belum melakukan uji penetrasi. Temuan berikut adalah risiko yang perlu ditangani, bukan klaim bahwa situs sudah dieksploitasi.

## Temuan prioritas

### P1 — Konten disisipkan ke HTML tanpa escaping yang konsisten
File `js/app.js` dan `js/admin.js` membangun markup dengan template string lalu memasukkannya melalui `innerHTML`. Beberapa nilai berasal dari data konten seperti judul, kategori, isi, cover, galeri, ID, dan URL.

**Risiko:** jika konten berisi markup/atribut berbahaya dan masuk ke data yang dirender, browser dapat menafsirkannya sebagai HTML, bukan teks. Dampak potensial termasuk DOM-based/stored XSS. Belum dibuktikan melalui payload uji.

**Arah perbaikan:** buat helper escaping untuk konteks teks/atribut; utamakan `textContent` dan DOM API untuk teks; validasi URL gambar/tautan dengan protokol yang diizinkan; jangan menganggap escaping HTML biasa cukup untuk URL atau JavaScript. Lakukan perubahan terpisah dan uji semua halaman serta preview.

### P1 — Workspace admin bukan CMS aman atau kolaboratif
`kelola/` tidak memiliki autentikasi maupun backend dan menyimpan perubahan di `localStorage` browser pengguna. README telah menjelaskan batasan ini.

**Dampak:** perubahan tidak dibagikan ke pengurus lain dan tidak memperbarui berkas JSON di GitHub. Jangan gunakan halaman ini untuk mengelola konten resmi bersama atau menyimpan data privat. Jangan menambahkan klaim bahwa admin telah terlindungi login.

**Arah perbaikan:** untuk tahap sekarang, gunakan formulir eksternal yang dikelola organisasi + daftar pengajuan privat, kemudian pengelola teknis memasukkan konten yang sudah disetujui lewat Pull Request. CMS/backend baru dipertimbangkan setelah pilot.

### P1 — Konten placeholder memiliki status `published`
Pada `data/articles.json`, tulisan “Menjaga Integritas Akademik di Era Digital” berstatus `published`, tetapi isi berisi teks placeholder: `[Isi lengkap tulisan ini akan segera dilengkapi oleh Divisi Literasi.]`.

**Dampak:** pengunjung dapat mengira tulisan itu sudah lengkap dan disahkan. Ini isu kualitas editorial, bukan bukti kerentanan teknis.

**Arah perbaikan:** sebelum menerbitkan perubahan konten, lengkapi tulisan dan periksa sumber/otorisasi, atau ubah status menjadi `draft` pada PR editorial yang disetujui. Tidak diubah dalam audit ini agar konten publik tidak berubah tanpa keputusan editorial.

### P2 — Validasi CI belum menguji kualitas editorial atau keamanan markup
`.github/scripts/validate.js` memeriksa JSON, field wajib, ID duplikat, status, dan referensi root-relative. Ia tidak menolak placeholder pada konten berstatus published, tidak memvalidasi protokol URL, dan tidak menguji kemungkinan markup berbahaya.

**Arah perbaikan:** tambah validasi terarah untuk placeholder publik dan skema URL; untuk XSS, lakukan perbaikan rendering dan pengujian terpisah. Jangan mengandalkan regex sederhana sebagai pengganti sanitasi/rendering yang benar.

### P2 — Jalur root-relative berpotensi tidak cocok dengan project Pages
Beberapa tautan di workspace admin menggunakan path seperti `/kegiatan-detail.html`. Pada deployment GitHub Pages berbentuk project site di bawah `/Rohis-sman2Tarakan/`, path tersebut dapat mengarah ke root domain, bukan ke subpath proyek.

**Arah perbaikan:** gunakan helper URL berbasis base path atau path relatif yang diuji untuk local preview dan project Pages. Belum diubah karena deployment/pemindahan Pages tidak termasuk lingkup pekerjaan saat ini.

## Batas pemeriksaan
- Tidak ada pengaturan GitHub Pages yang diubah.
- Tidak ada konten publik yang diubah.
- Tidak ada formulir atau spreadsheet eksternal yang dibuat/diaktifkan.
- Belum ada uji browser, test otomatis XSS, atau deployment test.

## Urutan tindak lanjut yang disarankan
1. Selesaikan hardening rendering HTML pada `app.js` dan `admin.js` dalam PR terpisah dengan uji regresi.
2. Putuskan status tulisan placeholder bersama penyetuju editorial.
3. Perluas validator CI tanpa menghalangi konten draft yang sah.
4. Uji base path pada salinan lokal tanpa mengubah Pages.
5. Jalankan pilot alur editorial selama dua minggu sebelum mempertimbangkan backend/CMS.
