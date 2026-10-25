# Alur Editorial Website Rohis SMAN 2 Tarakan

Dokumen ini mengatur pengajuan, pemeriksaan, persetujuan, dan penerbitan konten. Berlaku untuk tulisan Islami, kegiatan, pengumuman, dan program kerja.

## Prinsip

- Website tetap static-first: konten yang terbit disimpan di berkas JSON dalam repositori.
- Pengajuan anggota bukan berarti konten otomatis diterbitkan.
- Setiap konten harus diperiksa dan mendapat persetujuan Ketua atau pengurus inti yang ditunjuk.
- Satu pengelola teknis menerbitkan konten yang sudah disetujui melalui perubahan Git yang dapat ditinjau.
- Jangan menaruh naskah rahasia, data pribadi, atau konten berstatus draft di berkas publik.
- Halaman `/kelola/` saat ini hanya prototipe lokal berbasis browser; bukan CMS bersama dan bukan tempat pengumpulan pengajuan.

## Peran

1. **Pengusul/kontributor** — mengirim materi dan memastikan sumber serta izin media dicantumkan.
2. **Koordinator editorial** — memeriksa kelengkapan, memberi ID pengajuan, mencatat status, dan mengirimkan materi lengkap kepada penyetuju.
3. **Penyetuju** — Ketua atau pengurus inti yang ditunjuk; memutuskan setuju, revisi, atau tolak.
4. **Pengelola teknis** — memasukkan hanya materi yang disetujui ke data situs, memeriksa perubahan, menjalankan validasi, dan memastikan hasil terbit benar.

Satu orang boleh merangkap koordinator editorial dan pengelola teknis, tetapi keputusan persetujuan harus tetap dicatat secara eksplisit.

## Alur kerja

1. Kontributor mengisi formulir pengajuan.
2. Koordinator memeriksa kelengkapan dan mencatat pengajuan di daftar internal. Beri ID, misalnya `ED-2026-001`.
3. Jika belum lengkap, ubah status menjadi **Perlu dilengkapi** dan jelaskan apa yang kurang.
4. Jika lengkap, ubah status menjadi **Menunggu persetujuan** dan kirimkan kepada penyetuju.
5. Penyetuju memilih **Disetujui**, **Perlu revisi**, atau **Ditolak**, disertai catatan dan tanggal keputusan.
6. Pengelola teknis memasukkan materi yang berstatus Disetujui ke berkas data situs pada branch terpisah dan membuat Pull Request.
7. Jalankan pemeriksaan otomatis dan pemeriksaan manual. Pastikan sumber, ejaan, tanggal, tautan, izin foto, dan data pribadi sudah ditinjau.
8. Setelah perubahan digabungkan dan deployment berhasil, verifikasi halaman publik. Catat URL dan tanggal terbit, lalu ubah status menjadi **Terbit**.

## Status yang digunakan

- **Diajukan** — formulir baru diterima.
- **Perlu dilengkapi** — informasi wajib belum lengkap.
- **Menunggu persetujuan** — materi lengkap menunggu keputusan.
- **Perlu revisi** — penyetuju meminta perbaikan.
- **Disetujui** — boleh diproses untuk penerbitan, belum berarti sudah tayang.
- **Terbit** — sudah diverifikasi pada situs publik.
- **Ditolak** — tidak diteruskan, dengan alasan singkat yang dicatat secara internal.

## Target layanan awal

Target ini merupakan pedoman operasional, bukan jaminan otomatis:

- Pemeriksaan kelengkapan: maksimal 2 hari kerja.
- Keputusan: maksimal 2 hari kerja setelah materi lengkap.
- Penerbitan: maksimal 3 hari kerja setelah disetujui.

Jika ada tenggat kegiatan, tulis tenggat itu di formulir dan daftar pengajuan.

## Daftar periksa editorial

### Semua konten
- [ ] Judul dan ringkasan jelas.
- [ ] Nama, tanggal, lokasi, dan fakta telah dikonfirmasi.
- [ ] Bahasa sopan, mudah dipahami, dan sesuai identitas Rohis.
- [ ] Tidak memuat nomor telepon pribadi, alamat, atau data siswa tanpa kebutuhan dan izin yang jelas.
- [ ] Foto/video memiliki izin publikasi dan tidak mengekspos pihak yang perlu dilindungi.
- [ ] Tautan dan sumber dapat dibuka serta relevan.
- [ ] Persetujuan penyetuju tercatat.

### Tulisan Islami
- [ ] Ayat Al-Qur'an, hadis, terjemahan, dan kutipan diperiksa.
- [ ] Sumber rujukan dicantumkan dengan cukup jelas.
- [ ] Perbedaan pendapat agama disampaikan secara bertanggung jawab; hindari klaim tanpa sumber.
- [ ] Materi tidak dipublikasikan sebagai fatwa resmi jika bukan kewenangan penulis.

### Kegiatan/pengumuman
- [ ] Waktu, tempat, penyelenggara, dan informasi pendaftaran sudah benar.
- [ ] Kontak publik memang disetujui untuk dipublikasikan.
- [ ] Informasi yang sudah kedaluwarsa ditandai atau diperbarui.

## Tata kelola repositori

- Gunakan branch untuk setiap perubahan editorial; jangan mengedit langsung `main` untuk publikasi rutin.
- Buat Pull Request dengan ringkasan materi, ID pengajuan, bukti persetujuan, dan hasil pemeriksaan.
- Jangan menyimpan kata sandi, token, data kesehatan, atau daftar kontak privat di repositori.
- File JSON di repositori adalah konten publik. Jangan memasukkan naskah yang belum disetujui atau rahasia.
- Jangan mengubah pengaturan GitHub Pages atau memindahkan deployment sebagai bagian dari alur ini tanpa keputusan terpisah.

## Pilot dua minggu

Jalankan proses manual selama dua minggu menggunakan formulir dan spreadsheet yang dikelola pengurus. Evaluasi waktu respons, pengajuan yang tidak lengkap, beban pengelola teknis, dan kebutuhan akses bersama sebelum memilih CMS atau backend.
