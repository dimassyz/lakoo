# Kebutuhan yang disepakati — Lakoo

Status: **DISETUJUI Dimas ("oke") — 26 Okt 2026**. Sumber: `brief-lakoo.md` + sesi klarifikasi tech-lead ↔ Dimas.
Dokumen ini adalah input wajib untuk BRD, PRD, SPEC, FSD, DESIGN.md, dan TASKS.md.

## Kebutuhan

1. **Masalah:** pemilik toko kelontong kekurangan uang kulakan karena modalnya tertahan di barang yang tidak laku. Dia tidak tahu berapa rupiahnya dan tidak tahu harus berbuat apa.
2. **Pengguna:** satu pemilik untuk satu toko. Toko menjual sekitar 100 jenis barang. Pemilik memakai HP Android (Chrome) atau laptop dan tidak terlalu paham teknologi.
3. **Aturan status barang** (angkanya bisa diubah di pengaturan toko):
   - **Sehat:** laku dalam 14 hari terakhir
   - **Sekarat:** terakhir laku 15–45 hari lalu
   - **Mati:** tidak laku lebih dari 45 hari
   - **Waspada:** penjualan per minggu turun 3 minggu berturut-turut
4. **Uang terkunci** = stok × harga beli terakhir. Ditampilkan per barang dan totalnya.
5. **Barang sehat** diberi perkiraan berapa hari lagi stoknya habis.
6. **Saran per barang dibuat AI:** rencana 3 tahap lengkap dengan hitungan untung. Saran memakai profil toko (jenis toko, kota/kecamatan, tipe pelanggan) yang ditanyakan saat daftar (±30 detik, 3 pertanyaan pilihan).
   - Kalau AI tidak tersedia, saran cadangan dari template tetap muncul.
   - Biaya AI paling besar **Rp100.000/bulan**.
   - Semua saran hanya rekomendasi; pemilik yang memutuskan.
7. **Barang pelengkap** bisa ditandai: tidak disuruh diobral, tapi pemilik tetap diingatkan kalau stoknya kebanyakan.
8. **Kas pulih** = uang hasil penjualan barang itu selama rencananya berjalan (sejak tahap 1 dimulai sampai selesai), dibandingkan dengan uang terkunci saat rencana dimulai.
9. **Ringkasan mingguan:** 3 kalimat untuk dibaca setiap Minggu pagi.
10. **Cara mencatat:**
    - Tambah barang baru ≤ 1 menit.
    - Catat barang masuk mengikuti urutan nota.
    - Rekap tutup toko dua cara: (a) isi jumlah terjual per barang, atau (b) opname stok malam (terjual = stok pagi + barang masuk − stok malam).
    - Import file **wajib**: daftar barang awal (CSV/Excel, template disediakan) + penjualan (CSV).
    - Kalau sinyal hilang, isian penjualan & barang masuk disimpan dulu di HP lalu dikirim ulang otomatis.
11. **Promo WhatsApp:** WhatsApp terbuka dengan teks promo siap kirim; pemilik memilih sendiri kontak/grup/Status. Tidak ada penyimpanan nomor pelanggan.
12. **Akses publik:**
    - Registrasi terbuka.
    - Tombol **"Coba akun demo"**: toko contoh berisi data 90 hari, di-reset otomatis setiap hari.
    - 1 landing page publik yang bisa diindeks Google (wajib lolos gate SEO/Lighthouse). Aplikasi di balik login = NOINDEX.
13. **Tidak dikerjakan:** fitur kasir (metode bayar, struk, diskon otomatis), fitur kedaluwarsa, penyimpanan kontak pelanggan, mode offline penuh, multi-pengguna per toko. Fitur "tempel teks nota" = **could-have**, hanya bila M1–M3 sudah lolos QA.
14. **Prioritas:** M1 fondasi data → M2 kecerdasan → M3 aksi & polish.
15. **Tanda berhasil:** live di URL publik dan bisa didemokan end-to-end tanpa error pada **10 Nov 2026**; pemilik tahu rupiah terkunci; setiap barang bermasalah punya rencana masuk akal; kas pulih terlihat; data tidak pernah hilang.

## Proses dokumen

- 6 dokumen terpisah, review digabung **3 putaran**: (BRD + PRD) → (SPEC + FSD + DESIGN.md) → TASKS.md.
- Target semua dokumen disetujui **≤ 29 Okt 2026**; sisa ±11 hari untuk build + QA.
- Repo: `https://github.com/dimassyz/lakoo.git` (sudah `git init` lokal di `Documents/lakoo`). Commit & push oleh devops-engineer, bertahap per dokumen.

## Arah visual (input DESIGN.md)

Referensi: 2 screenshot dari Dimas (dashboard D-inventy desktop + mobile inventory dashboard) → disimpan ke `docs/design-refs/` saat bootstrap.

- **Clean, simple, mudah** di HP dan laptop. Keputusan Dimas: HP tetap clean, **bukan** kartu warna-warni ala gambar 2.
- Latar putih / putih gading sangat lembut; teks hitam pekat.
- Warna hanya untuk: status barang (Sehat/Waspada/Sekarat/Mati, selalu disertai teks + ikon) dan satu warna aksi utama.
- Kartu putih + garis tipis, tanpa bayangan, tanpa dekorasi (dari gambar 1).
- Angka penting besar dengan label pendek di bawahnya (satu-satunya yang diambil dari gambar 2).
- Satu tujuan per layar, sedikit tombol, teks cukup besar, menu bawah di HP.
- Tidak dipakai: grafik bermotif titik/arsir, gradasi, banyak warna dalam satu layar, ikon dekoratif, nuansa biru "aplikasi kantor".
