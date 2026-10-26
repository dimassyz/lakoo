# PRD — Lakoo: Asisten Pintar untuk Inventaris Tokomu

| | |
|---|---|
| Versi | 1.0 — draft untuk review putaran 1 (BRD + PRD) |
| Tanggal | 26 Oktober 2026 |
| Penyusun | tech-lead |
| Penyetuju | Dimas (product owner) |
| Input | `docs/BRD.md` v1.0, `docs/KEBUTUHAN.md` |
| Dokumen berikutnya | SPEC + FSD + DESIGN.md (putaran 2) |

Rujukan ID: `S-n` = ruang lingkup BRD §6, `BR-n` = aturan bisnis BRD §7, `R-n` = ritual BRD §5.
Dokumen ini menjelaskan **apa** yang dibangun dan **kapan dianggap benar**. **Bagaimana** cara membangunnya ditulis di SPEC dan FSD.

---

## 1. Persona

### P1 — Bu Sri, pemilik toko kelontong (pengguna utama)

| | |
|---|---|
| Profil | 45 tahun, toko kelontong di permukiman, ±100 jenis barang, jaga toko sendiri 06.00–21.00 |
| Perangkat | HP Android kelas menengah, Chrome, WhatsApp aktif; sinyal 4G kadang putus |
| Kemampuan teknologi | Lancar WhatsApp dan marketplace, tidak terbiasa dengan spreadsheet |
| Kebiasaan | Tutup toko: hitung uang laci → catat di buku. Kulakan 1–2 minggu sekali. Minggu pagi agak santai |
| Tujuan | Modal kulakan cukup; tidak ada barang yang menumpuk |
| Frustrasi | "Uang saya ke mana?" Bingung mau diobral berapa. Aplikasi yang banyak isian |
| Kutipan | "Kalau ribet, saya tidak pakai." |
| Yang dia ukur | Rupiah, bukan persen atau grafik |

### P2 — Juri GTNIC 2026 (pengguna sekunder)

| | |
|---|---|
| Profil | Menilai puluhan karya dalam waktu singkat, membuka dari laptop atau HP |
| Tujuan | Paham nilai produk dalam ≤ 2 menit; melihat fitur AI dan interaksi database bekerja |
| Frustrasi | Wajib daftar dulu, database kosong, demo error |
| Kebutuhan | Landing page jelas + "Coba akun demo" langsung berisi data |

## 2. Prioritas MoSCoW

| Prioritas | Arti untuk 10 Nov 2026 |
|---|---|
| **Must** | Wajib ada dan lolos QA. Tanpa ini demo gagal |
| **Should** | Ditargetkan; boleh dipangkas hanya dengan persetujuan Dimas |
| **Could** | Hanya dikerjakan bila semua Must + Should lolos QA |
| **Won't** | Tidak dikerjakan di versi ini (BRD §6.2) |

## 3. Ringkasan fitur

| ID | Fitur | Ritual | MoSCoW | Milestone | BRD |
|---|---|---|---|---|---|
| F-01 | Daftar, masuk, onboarding profil toko | sekali di awal | Must | M1 | S-1 |
| F-02 | Akun demo (data 90 hari, reset harian) | — (juri) | Must | M3* | S-2, BR-17 |
| F-03 | Kelola barang (tambah, ubah, arsip) | R3 | Must | M1 | S-3 |
| F-04 | Import daftar barang (CSV/Excel) | sekali di awal | Must | M1 | S-3 |
| F-05 | Catat barang masuk | R3 | Must | M1 | S-4 |
| F-06 | Rekap penjualan: jumlah terjual | R1, R1b | Must | M1 | S-5, BR-16 |
| F-07 | Rekap penjualan: opname stok malam | R1 | Must | M1 | S-5, BR-15 |
| F-08 | Import penjualan (CSV) | R1b | Must | M1 | S-5 |
| F-09 | Antrean kirim ulang saat sinyal putus | R1, R3 | Must | M1 | S-6 |
| F-10 | Dashboard: status + uang terkunci | R2 | Must | M1 | S-7, S-8, BR-2..7 |
| F-11 | Perkiraan hari stok habis | R2 | Should | M1 | S-9, BR-8 |
| F-12 | Skor prioritas barang bermasalah | R2, R4 | Must | M2 | S-10 |
| F-13 | Rencana aksi AI 3 tahap + hitungan | R4 | Must | M2 | S-11, BR-10..14 |
| F-14 | Rencana cadangan (template) | R4 | Must | M2 | S-11, BR-14 |
| F-15 | Barang pelengkap | R4 | Must | M3 | S-12, BR-9 |
| F-16 | Jalankan & lacak rencana + kas pulih | R2, R4 | Must | M3 | S-13, BR-12 |
| F-17 | Ringkasan mingguan 3 kalimat | R4 | Should | M3 | S-14 |
| F-18 | Bagikan promo ke WhatsApp | R4 | Must | M3 | S-15, BR-18 |
| F-19 | Landing page publik | — (juri/publik) | Must | M3 | S-16 |
| F-20 | Pengaturan toko | sekali / jarang | Should | M3 | S-17, BR-6 |
| F-21 | Tempel teks nota → baris barang masuk | R3 | Could | setelah M3 | C-1 |

\* Generator data demo dibuat sejak M1 untuk pengujian internal; tombol "Coba akun demo" dan reset harian selesai di M3.

---

## 4. User stories dan acceptance criteria

Format kriteria: **Diberikan** (kondisi) **Ketika** (aksi) **Maka** (hasil). Semua kriteria harus bisa diuji QA. Angka waktu diukur QA dengan stopwatch di HP Android kelas menengah pada jaringan 4G.

### F-01 Daftar, masuk, onboarding — Must

**US-01.1** Sebagai pemilik toko, saya ingin daftar dengan cepat supaya bisa langsung mulai.
- AC-1: Daftar hanya meminta nama toko, email, dan kata sandi (≥ 8 karakter). Tidak ada field wajib lain.
- AC-2: Email yang sudah terdaftar ditolak dengan pesan berbahasa Indonesia yang jelas. Data yang sudah diketik tidak hilang.
- AC-3: Setelah daftar, pengguna langsung masuk ke onboarding tanpa perlu login ulang.

**US-01.2** Sebagai pemilik toko, saya ingin sistem kenal toko saya supaya sarannya masuk akal.
- AC-1: Onboarding berisi tepat 3 pertanyaan pilihan: jenis toko, kota/kecamatan, tipe pelanggan utama (boleh pilih lebih dari satu).
- AC-2: Onboarding selesai ≤ 30 detik.
- AC-3: Setiap pertanyaan bisa dilewati. Saran tetap dibuat dengan profil umum, dan dashboard menampilkan ajakan melengkapi profil.
- AC-4: Profil toko bisa diubah lagi di Pengaturan (F-20).

**US-01.3** Sebagai pemilik toko, saya ingin tetap masuk di HP saya supaya tidak login setiap kali tutup toko.
- AC-1: Sesi bertahan minimal 30 hari di perangkat yang sama, kecuali pengguna keluar.
- AC-2: Pengguna yang belum masuk dan membuka halaman aplikasi diarahkan ke halaman masuk.
- AC-3: Pengguna toko A tidak bisa melihat atau mengubah data toko B dengan cara apa pun (BR-1).

### F-02 Akun demo — Must

**US-02.1** Sebagai juri, saya ingin mencoba aplikasi tanpa daftar supaya bisa menilai dengan cepat.
- AC-1: Tombol "Coba akun demo" di landing page membuka dashboard toko contoh dalam ≤ 5 detik tanpa mengisi apa pun.
- AC-2: Toko contoh berisi ±100 barang dan riwayat 90 hari, dengan minimal 5 barang di tiap status (Sehat, Waspada, Sekarat, Mati) dan minimal 2 barang pelengkap.
- AC-3: Minimal 1 rencana sudah berjalan dengan kas pulih > Rp0, sehingga F-16 langsung terlihat.
- AC-4: Data demo di-reset otomatis ke kondisi awal setiap hari, dan tanggal-tanggalnya digeser sehingga riwayat 90 hari selalu berakhir "kemarin".
- AC-5: Perubahan yang dibuat di akun demo tidak memengaruhi akun lain (BR-17).
- AC-6: Ada penanda kecil "Akun demo — data di-reset setiap hari" yang terlihat di semua halaman aplikasi.

### F-03 Kelola barang — Must

**US-03.1** Sebagai pemilik toko, saya ingin menambah barang baru dalam ≤ 1 menit.
- AC-1: Field wajib hanya: nama barang, harga beli, harga jual, stok awal. Satuan bawaan "pcs"; kategori opsional.
- AC-2: Tambah 1 barang selesai ≤ 1 menit (KS-6).
- AC-3: Harga jual lebih kecil dari harga beli tetap boleh disimpan, tetapi muncul peringatan "harga jual di bawah modal".
- AC-4: Nama barang yang sama (tanpa memedulikan huruf besar/kecil dan spasi) dalam satu toko ditolak, dengan tautan ke barang yang sudah ada.
- AC-5: Angka negatif dan bukan angka ditolak. Rupiah ditampilkan berformat "Rp12.500".

**US-03.2** Sebagai pemilik toko, saya ingin mengubah atau mengarsipkan barang yang tidak saya jual lagi.
- AC-1: Nama, harga, satuan, kategori, dan tanda pelengkap bisa diubah.
- AC-2: Barang diarsipkan, tidak dihapus permanen. Riwayatnya tetap ada; barang arsip tidak muncul di dashboard maupun form rekap.
- AC-3: Daftar barang bisa dicari berdasarkan nama dan difilter berdasarkan status.

### F-04 Import daftar barang — Must

**US-04.1** Sebagai pemilik toko baru, saya ingin memasukkan semua barang sekaligus dari file.
- AC-1: Template CSV dan Excel (.xlsx) bisa diunduh dari halaman import, lengkap dengan 3 baris contoh.
- AC-2: Sebelum disimpan, sistem menampilkan pratinjau: jumlah baris valid, baris bermasalah, dan alasannya per baris dalam bahasa Indonesia.
- AC-3: Hanya baris valid yang disimpan; baris bermasalah bisa diunduh untuk diperbaiki.
- AC-4: File berisi 500 baris selesai diproses ≤ 10 detik.
- AC-5: Barang yang namanya sudah ada tidak diduplikasi; pengguna memilih "lewati" atau "perbarui harga".

### F-05 Catat barang masuk — Must

**US-05.1** Sebagai pemilik toko, saat barang datang dan nota di tangan, saya ingin mencatatnya mengikuti urutan nota.
- AC-1: Satu layar berisi banyak baris. Tiap baris: barang (cari atau ketik nama baru), jumlah, harga beli per satuan.
- AC-2: Mengetik nama barang yang belum ada menawarkan "tambah sebagai barang baru" di baris yang sama, tanpa pindah layar.
- AC-3: Satu baris selesai ≤ 1 menit (KS-6).
- AC-4: Setelah disimpan, stok bertambah sesuai jumlah, dan **harga beli terakhir** barang diperbarui (dasar BR-7).
- AC-5: Tanggal bawaan hari ini dan bisa diubah ke tanggal sebelumnya (tidak boleh tanggal mendatang).
- AC-6: Catatan barang masuk bisa dikoreksi atau dihapus dalam 7 hari, dan stok menyesuaikan.

### F-06 Rekap penjualan: jumlah terjual — Must

**US-06.1** Sebagai pemilik toko, setelah hitung uang laci saya ingin mencatat penjualan hari ini dalam ≤ 2 menit.
- AC-1: Layar rekap menampilkan daftar barang aktif. Barang yang paling sering laku ada di urutan atas, dan tersedia pencarian.
- AC-2: Jumlah diisi dengan tombol +/− atau diketik. Barang yang tidak diisi dianggap 0.
- AC-3: Rekap ±10 barang selesai ≤ 2 menit (KS-6).
- AC-4: Setelah disimpan, stok berkurang sesuai jumlah.
- AC-5: Jumlah terjual yang melebihi stok ditolak per baris dengan pesan "stok tercatat hanya X" dan tawaran memperbaiki stok (BR-16).
- AC-6: Tanggal bawaan hari ini dan bisa diganti ke tanggal sebelumnya untuk rekap mingguan sekaligus (R1b). Rekap 7 hari sekaligus selesai ≤ 10 menit.
- AC-7: Rekap untuk tanggal yang sama bisa dibuka lagi dan dikoreksi tanpa membuat penjualan ganda.

### F-07 Rekap penjualan: opname stok malam — Must

**US-07.1** Sebagai pemilik toko, saya ingin cukup menghitung sisa barang di rak, lalu sistem yang menghitung berapa yang terjual.
- AC-1: Layar opname menampilkan per barang: stok pagi (stok tercatat awal hari) dan barang masuk hari itu, serta isian "stok sekarang".
- AC-2: Terjual = stok pagi + barang masuk hari itu − stok sekarang (BR-15). Hasilnya terlihat sebelum disimpan.
- AC-3: Hasil negatif (stok sekarang lebih banyak dari seharusnya) ditolak di baris itu dengan pesan "cek lagi jumlahnya atau catat barang masuk".
- AC-4: Barang yang tidak diisi tidak diubah.
- AC-5: Penjualan hasil opname tercatat sama seperti F-06 dan ikut menggerakkan status barang.

### F-08 Import penjualan — Must

**US-08.1** Sebagai pemilik toko, saya ingin memasukkan catatan penjualan dari file.
- AC-1: Template CSV berisi kolom: tanggal, nama barang, jumlah.
- AC-2: Ada pratinjau dan validasi per baris seperti F-04. Nama barang yang tidak dikenali dan jumlah yang melebihi stok ditandai.
- AC-3: Import ulang file yang sama tidak membuat penjualan ganda.
- AC-4: File berisi 5.000 baris selesai ≤ 15 detik.

### F-09 Antrean kirim ulang — Must

**US-09.1** Sebagai pemilik toko, saya tidak mau rekap saya hilang hanya karena sinyal putus.
- AC-1: Bila rekap penjualan (F-06/F-07) atau barang masuk (F-05) gagal terkirim, isian disimpan di HP dan muncul tanda "Belum terkirim — akan dikirim otomatis".
- AC-2: Isian terkirim otomatis saat sinyal kembali, tanpa aksi pengguna, termasuk bila halaman ditutup lalu dibuka lagi.
- AC-3: Isian yang terkirim dua kali (karena kirim ulang) tidak menghasilkan data ganda.
- AC-4: Pengguna bisa melihat daftar isian yang belum terkirim.
- AC-5: Uji QA: matikan jaringan → simpan 3 rekap → nyalakan jaringan → ketiganya tersimpan sekali, tanpa ada yang hilang (KS-5).

### F-10 Dashboard status + uang terkunci — Must

**US-10.1** Sebagai pemilik toko, saat buka toko saya ingin sekali lirik tahu kondisi barang dan uang saya.
- AC-1: Bagian paling atas menampilkan **Total uang terkunci** (Rp) sebagai angka terbesar di layar, lalu jumlah dan rupiah untuk tiap status: Sehat, Waspada, Sekarat, Mati.
- AC-2: Setiap status ditampilkan dengan warna, teks, **dan** ikon, tidak hanya warna.
- AC-3: Uang terkunci per barang = stok × harga beli terakhir; total = jumlah semua barang aktif dengan stok > 0 (BR-7). Hasil cocok dengan perhitungan manual QA di data demo.
- AC-4: Status mengikuti BR-2..BR-5 dengan ambang dari Pengaturan (bawaan 14/45 hari, 3 minggu). Barang yang belum pernah laku dihitung sejak stok pertama masuk.
- AC-5: Dashboard tampil ≤ 3 detik di 4G (KS-1).
- AC-6: Ada bagian "Hari ini" yang hanya berisi: barang yang statusnya berubah sejak kemarin dan tahap rencana yang jatuh tempo hari ini. Bila kosong, tampil satu kalimat "Tidak ada yang perlu dicek hari ini".
- AC-7: Ketuk satu status → daftar barang berstatus itu, diurutkan menurut skor prioritas (F-12).
- AC-8: Barang aktif dengan stok 0 berstatus netral **"Stok habis"**. Barang ini tidak masuk empat status di atas dan tidak dihitung sebagai barang bermasalah, karena tidak ada uang yang terkunci di dalamnya.

### F-11 Perkiraan hari stok habis — Should

**US-11.1** Sebagai pemilik toko, saya ingin tahu kapan barang sehat akan habis supaya kulakan tepat waktu.
- AC-1: Setiap barang Sehat menampilkan "± N hari lagi habis" = stok ÷ rata-rata terjual per hari dalam 28 hari terakhir (BR-8).
- AC-2: Barang dengan perkiraan ≤ 3 hari ditandai "segera kulakan".
- AC-3: Bila data penjualan terlalu sedikit (< 3 hari ada penjualan dalam 28 hari), tampil "belum cukup data", bukan angka.

### F-12 Skor prioritas — Must

**US-12.1** Sebagai pemilik toko, saya ingin tahu barang mana yang harus ditangani duluan.
- AC-1: Barang Waspada, Sekarat, dan Mati diberi skor 0–100. Skor naik bila uang terkunci makin besar dan bila barang makin lama tidak laku. Rumus pastinya di SPEC.
- AC-2: Daftar barang bermasalah dan "3 barang paling mendesak" di dashboard diurutkan dari skor tertinggi.
- AC-3: Barang pelengkap tidak masuk daftar obral, tetapi muncul di daftar terpisah "pelengkap kebanyakan" bila memenuhi F-15.
- AC-4: Setiap barang menampilkan satu kalimat alasan, misalnya "Rp480.000 terkunci, 52 hari tidak laku".

### F-13 Rencana aksi AI 3 tahap — Must

**US-13.1** Sebagai pemilik toko, saya ingin rencana konkret per barang yang cocok untuk toko saya, bukan saran umum.
- AC-1: Setiap barang Waspada/Sekarat/Mati (bukan pelengkap) bisa menampilkan rencana berisi tepat 3 tahap berurutan. Tiap tahap berisi: nama aksi, langkah singkat (≤ 3 kalimat), lama tahap (hari), dan syarat lanjut ke tahap berikutnya.
- AC-2: Setiap tahap yang mengubah harga menampilkan hitungan dari sistem: harga baru, untung/rugi per unit, dan perkiraan kas kembali bila stok habis terjual. Angka-angka ini **dihitung sistem, bukan ditulis AI** (BRD prinsip 4).
- AC-3: Tahap 1 selalu masih untung (harga ≥ harga beli). Tahap yang di bawah modal diberi label "Rugi Rp X per unit" dengan jelas (BR-11).
- AC-4: Rencana menyebut data toko, minimal 2 dari: lama tidak laku, jumlah stok, profil toko (jenis/lokasi/tipe pelanggan), atau barang lain di toko (misalnya ide bundling dengan barang Sehat yang benar-benar ada di toko).
- AC-5: Uji spesifisitas QA: 5 barang bermasalah yang berbeda di toko demo menghasilkan 5 rencana yang berbeda isinya. Rencana yang identik untuk 2 barang berbeda = gagal (BR-13).
- AC-6: Rencana yang sudah dibuat disimpan dan langsung tampil saat dibuka lagi, tanpa menunggu AI. Ada tombol "Buat ulang saran".
- AC-7: Rencana tampil ≤ 15 detik bila AI dipanggil. Bila lewat 15 detik, rencana cadangan (F-14) tampil.
- AC-8: Ada label kecil "Disusun AI" atau "Saran dasar" sesuai sumber rencana.
- AC-9: Biaya AI tidak melebihi Rp100.000/bulan pada pemakaian lomba. Mekanismenya (batas per toko, cache) ditulis di SPEC (K-5).

### F-14 Rencana cadangan (template) — Must

**US-14.1** Sebagai pemilik toko, saya tetap ingin saran walaupun AI sedang tidak bisa dipakai.
- AC-1: Bila AI gagal, lambat (> 15 detik), atau kuotanya habis, rencana 3 tahap dari template tampil otomatis, tanpa pesan error teknis (BR-14).
- AC-2: Rencana cadangan tetap memakai angka barang itu (harga, stok, hari tidak laku) dan aturan BR-10/BR-11 yang sama.
- AC-3: Template berbeda menurut status (Waspada / Sekarat / Mati).
- AC-4: Uji QA: AI dimatikan lewat konfigurasi → seluruh alur demo tetap berjalan tanpa error (KS-4).

### F-15 Barang pelengkap — Must

**US-15.1** Sebagai pemilik toko, ada barang yang sengaja saya simpan biar warung terlihat lengkap; jangan suruh saya obral.
- AC-1: Barang bisa ditandai/dilepas sebagai "pelengkap" dengan satu ketukan, dari detail barang maupun dari daftar bermasalah.
- AC-2: Barang pelengkap tidak pernah mendapat rencana obral/diskon (BR-9) dan tidak dihitung dalam daftar "paling mendesak".
- AC-3: Barang pelengkap diberi peringatan "kebanyakan" bila stoknya melebihi perkiraan kebutuhan 60 hari (dari rata-rata penjualan 90 hari), atau melebihi batas stok yang diisi pemilik sendiri (opsional).
- AC-4: Peringatan "kebanyakan" menyarankan *tidak kulakan lagi sampai stok ≤ X*, bukan obral.
- AC-5: Uang terkunci barang pelengkap tetap dihitung di total (BR-7), dan ditampilkan terpisah sebagai "termasuk Rp X di barang pelengkap".

### F-16 Jalankan & lacak rencana + kas pulih — Must

**US-16.1** Sebagai pemilik toko, saya ingin memilih rencana dan tahu kapan harus lanjut ke tahap berikutnya.
- AC-1: Tombol "Jalankan rencana" mencatat tanggal mulai tahap 1 dan **uang terkunci awal** (stok × harga beli saat itu).
- AC-2: Satu barang hanya bisa punya 1 rencana aktif.
- AC-3: Tiap tahap bisa ditandai "berhasil" (rencana selesai), "belum berhasil — lanjut tahap berikutnya", atau "hentikan rencana". Pemilik yang memutuskan; sistem tidak mengubah status tahap sendiri (BRD prinsip 3).
- AC-4: Saat lama tahap berakhir, tahap itu muncul di bagian "Hari ini" dashboard sebagai "jatuh tempo" (R2).
- AC-5: Rencana otomatis ditandai "selesai — stok habis" bila stok barang itu mencapai 0.

**US-16.2** Sebagai pemilik toko, saya ingin melihat berapa uang yang sudah kembali.
- AC-1: Kas pulih per rencana = jumlah (jumlah terjual × harga jual yang tercatat saat terjual) untuk barang itu, sejak tanggal mulai tahap 1 sampai rencana selesai (BR-12).
- AC-2: Ditampilkan sebagai "Rp X dari Rp Y kembali" (Y = uang terkunci awal) + persentase + bar progres sederhana.
- AC-3: Halaman Hasil menampilkan total kas pulih dari semua rencana, jumlah rencana aktif/selesai, dan daftar per rencana.
- AC-4: Angka kas pulih di data demo cocok dengan perhitungan manual QA (KS-3).
- AC-5: Saat menjalankan tahap yang mengubah harga, sistem menawarkan "Ubah harga jual jadi Rp X?". Harga baru hanya berlaku bila pemilik menekan setuju (O-9).

### F-17 Ringkasan mingguan — Should

**US-17.1** Sebagai pemilik toko, setiap Minggu pagi saya ingin membaca 3 kalimat tentang minggu ini.
- AC-1: Ringkasan berisi tepat 3 kalimat: (1) apa yang terjadi seminggu ini (total terjual Rp, perubahan uang terkunci), (2) barang yang butuh perhatian (baru masuk Sekarat/Mati/Waspada), (3) rencana yang selesai dan kas pulih minggu ini.
- AC-2: Ringkasan mencakup 7 hari Minggu–Sabtu yang berakhir Sabtu kemarin, sehingga sudah lengkap saat dibaca Minggu pagi. Ringkasan tampil di dashboard pada hari Minggu dan Senin, dan selalu bisa dibuka di halaman Hasil.
- AC-3: Kalimat boleh disusun AI, tetapi semua angkanya dari sistem. Bila AI gagal, ringkasan dari template tampil dengan angka yang sama.
- AC-4: Minggu tanpa aktivitas tetap menghasilkan ringkasan yang jujur ("Minggu ini belum ada penjualan tercatat…").

### F-18 Bagikan promo ke WhatsApp — Must

**US-18.1** Sebagai pemilik toko, saya ingin mengirim promo ke pelanggan dengan sekali ketuk.
- AC-1: Tahap rencana yang berupa promo/diskon/bundling punya tombol "Bagikan ke WhatsApp".
- AC-2: Tombol membuka WhatsApp (aplikasi di HP, WhatsApp Web di laptop) dengan teks promo yang sudah terisi: nama toko, nama barang, harga promo, dan masa berlaku. Pemilik sendiri yang memilih kontak, grup, atau Status (BR-18).
- AC-3: Teks bisa diubah dulu di aplikasi sebelum dibagikan. Panjangnya ≤ 500 karakter.
- AC-4: Aplikasi tidak meminta, menyimpan, atau membaca nomor pelanggan (O-3).

### F-19 Landing page publik — Must

**US-19.1** Sebagai juri atau pemilik toko yang mencari di Google, saya ingin paham Lakoo dalam sekali baca dan langsung mencobanya.
- AC-1: Satu halaman di alamat utama: masalah (modal terkunci), cara kerja (3 langkah), contoh hasil (angka dari toko demo), tombol "Coba akun demo" dan "Daftar gratis", serta FAQ singkat.
- AC-2: Lighthouse ≥ 90 untuk Performance, Accessibility, Best Practices, dan SEO, di mobile dan desktop (KS-8).
- AC-3: Core Web Vitals: LCP ≤ 2,5 detik, INP ≤ 200 ms, CLS ≤ 0,1.
- AC-4: Landing page bisa diindeks. Semua halaman aplikasi (di balik login, termasuk akun demo) NOINDEX.
- AC-5: Ada metadata judul/deskripsi, Open Graph, JSON-LD, sitemap.xml, robots.txt, dan llms.txt. Detailnya di SPEC.

### F-20 Pengaturan toko — Should

**US-20.1** Sebagai pemilik toko, saya ingin menyesuaikan aturan status dengan kondisi toko saya.
- AC-1: Ambang Sehat (bawaan 14 hari), Mati (bawaan 45 hari), dan Waspada (bawaan 3 minggu) bisa diubah, dengan validasi Sehat < Mati dan rentang yang wajar (Sehat 7–60 hari, Mati 15–180 hari, Waspada 2–6 minggu).
- AC-2: Perubahan ambang langsung mengubah status di dashboard.
- AC-3: Profil toko (F-01) bisa diubah. Tersedia tombol "Kembalikan ke bawaan".
- AC-4: Pengguna bisa keluar (logout) dari halaman ini.

### F-21 Tempel teks nota — Could

**US-21.1** Sebagai pemilik toko, saya ingin menempel teks nota supaya tidak mengetik baris satu per satu.
- AC-1: Kolom tempel teks di layar barang masuk → sistem mengusulkan baris (nama, jumlah, harga) → pemilik memeriksa dan mengubah sebelum menyimpan. Tidak ada yang tersimpan tanpa konfirmasi.
- AC-2: Dikerjakan hanya bila semua Must + Should lolos QA (C-1).

---

## 5. Kebutuhan non-fungsional (tingkat produk)

| ID | Kebutuhan | Ukuran |
|---|---|---|
| NF-1 | Responsif | Layak dipakai di lebar layar 360 px (HP), 768 px (tablet), dan ≥ 1280 px (laptop). Tidak ada scroll horizontal di HP |
| NF-2 | Kecepatan | Dashboard ≤ 3 detik di 4G; aksi simpan memberi tanggapan ≤ 1 detik (tanda "tersimpan" atau "belum terkirim") |
| NF-3 | Bahasa | Seluruh teks antarmuka, pesan error, dan saran dalam bahasa Indonesia sehari-hari, tanpa istilah teknis |
| NF-4 | Aksesibilitas | Target sentuh ≥ 44 px; teks utama ≥ 16 px; kontras sesuai WCAG 2.2 AA; status tidak hanya dibedakan dengan warna |
| NF-5 | Keandalan data | Nol data hilang di uji F-09; penghapusan berupa arsip, bukan hapus permanen (kecuali koreksi ≤ 7 hari) |
| NF-6 | Keamanan dasar | Kata sandi tidak disimpan dalam bentuk asli; data antar toko terisolasi; semua input divalidasi di server; kredensial tidak ada di repo |
| NF-7 | Skala | Lancar sampai 500 barang dan 1 tahun riwayat per toko |
| NF-8 | Biaya | Hosting dan database tingkat gratis; AI ≤ Rp100.000/bulan |

## 6. Metrik keberhasilan produk

Metrik dihitung dari data di database aplikasi sendiri (tanpa alat analitik berbayar) dan ditampilkan di halaman Hasil.

### North Star

| Metrik | Definisi | Kenapa |
|---|---|---|
| **Kas pulih per toko per bulan (Rp)** | Jumlah kas pulih (BR-12) dari semua rencana dalam 30 hari terakhir | Langsung mengukur janji produk: modal yang terkunci kembali jadi uang kulakan |

### Metrik input (penggerak North Star)

| Metrik | Definisi | Target |
|---|---|---|
| Kepatuhan rekap | % hari dalam 14 hari terakhir yang punya rekap penjualan | ≥ 70% (5 dari 7 hari) |
| Cakupan rencana | % barang bermasalah (bukan pelengkap) yang punya rencana aktif atau selesai | ≥ 50% |
| Rencana selesai | Jumlah rencana berstatus selesai per bulan | ≥ 3 per toko |
| Penurunan uang terkunci di Sekarat + Mati | Perubahan Rp vs 30 hari lalu | Turun |

### Metrik kesehatan (guardrail)

| Metrik | Definisi | Batas |
|---|---|---|
| Tingkat cadangan AI | % rencana yang memakai template karena AI gagal | ≤ 20% dalam kondisi normal |
| Waktu rekap | Waktu dari buka layar rekap sampai simpan (diukur QA) | ≤ 2 menit untuk ±10 barang |
| Error saat demo | Error yang terlihat pengguna selama alur demo BRD §11 | 0 |
| Isian belum terkirim > 24 jam | Jumlah isian di antrean yang tertahan lebih dari 1 hari | 0 |

### Metrik lomba (untuk 10 Nov 2026)

| Metrik | Target |
|---|---|
| Alur demo BRD §11 tanpa error | 3× berturut-turut di HP Android dan laptop, termasuk saat AI dimatikan |
| Lighthouse landing page | ≥ 90 di empat kategori, mobile dan desktop |
| Uptime URL publik di minggu demo | Bisa diakses saat dicek QA setiap hari 4–10 Nov |

## 7. Ketergantungan dan urutan

```
F-01 ─┬─ F-03 ─┬─ F-05 ─┬─ F-06/F-07/F-08 ─┬─ F-10 ─┬─ F-12 ─┬─ F-13/F-14 ─┬─ F-16 ─┬─ F-17
      │        └─ F-04  │                  │        └─ F-11  └─ F-15       └─ F-18  │
      │                 └─ F-09 (dipakai F-05/06/07)                                │
      └─ F-20                                                                       │
Generator data demo (mulai M1) ───────────────────────────────────────── F-02 ── F-19
```

## 8. Pertanyaan terbuka

Tidak ada. Semua keputusan bisnis sudah ada di `docs/KEBUTUHAN.md`. Detail teknis berikut menjadi wewenang tech-lead dan akan ditulis di SPEC:
- rumus skor prioritas (F-12)
- penyedia AI dan mekanisme kontrol biaya (F-13)
- mekanisme antrean kirim ulang (F-09)
- mekanisme reset akun demo (F-02)

## 9. Persetujuan

| Tanggal | Versi | Oleh | Keputusan |
|---|---|---|---|
| 26 Okt 2026 | PRD 1.0 | Dimas | oke (disetujui) |
| 26 Okt 2026 | PRD 1.1 | tech-lead (delegasi Dimas, lihat `docs/PROJECT_LOG.md`) | Penyelarasan dengan SPEC: F-10 menambah status netral "Stok habis"; F-17 AC-2 mengubah definisi minggu ringkasan |
