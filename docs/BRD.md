# BRD — Lakoo: Asisten Pintar untuk Inventaris Toko

|                    |                                                                              |
| ------------------ | ---------------------------------------------------------------------------- |
| Versi              | 1.0 — draft untuk review putaran 1 (BRD + PRD)                               |
| Tanggal            | 26 Oktober 2026                                                              |
| Penyusun           | tech-lead                                                                    |
| Penyetuju          | Dimas (product owner)                                                        |
| Sumber             | `brief-lakoo.md` + `docs/KEBUTUHAN.md` (disetujui Dimas: "oke", 26 Okt 2026) |
| Dokumen berikutnya | PRD (putaran 1) → SPEC + FSD + DESIGN.md (putaran 2) → TASKS.md (putaran 3)  |

## 1. Ringkasan

Lakoo membantu pemilik toko kelontong melihat **berapa rupiah modalnya yang terkunci di barang yang tidak laku**, mendeteksi barang bermasalah **sebelum** terlambat, memberi **rencana aksi bertahap yang disusun AI** khusus untuk tokonya, lalu menunjukkan **berapa kas yang berhasil pulih**. Aplikasi menumpang kebiasaan yang sudah ada (tutup toko, buka toko, barang datang, Minggu pagi) — bukan menuntut kebiasaan baru.

## 2. Latar belakang & masalah

- Pemilik merasa modal kulakan selalu kurang. Akar masalahnya: uang **terkunci sebagai stok yang tidak bergerak** (contoh: kecap 3 bulan tidak terjual, sampo menumpuk 40 botol).
- Pemilik tidak pernah tahu "barang ini terakhir laku kapan" dan berapa nilai uang yang tertidur.
- Kalaupun sadar, pemilik bingung harus berbuat apa (obral berapa, bundling dengan apa, dipindah ke mana), sehingga barang didiamkan dan terus menumpuk.
- Aplikasi sejenis untuk warung biasanya ditinggal di minggu ketiga karena ribet dan menuntut kebiasaan baru.

## 3. Tujuan bisnis

| ID   | Tujuan                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| TB-1 | Pemilik tahu persis total rupiah yang terkunci di stok, dan di barang mana saja.                                            |
| TB-2 | Barang bermasalah terdeteksi lebih awal (status _Waspada_) sebelum menjadi _Sekarat/Mati_.                                  |
| TB-3 | Tiap barang bermasalah punya rencana aksi 3 tahap yang masuk akal untuk toko tersebut, lengkap dengan hitungan untung/rugi. |
| TB-4 | Pemilik bisa melihat kas yang pulih setelah menjalankan rencana.                                                            |
| TB-5 | Aplikasi live, publik, dan bisa didemokan end-to-end tanpa error pada 10 November 2026 (GTNIC 2026).                        |
| TB-6 | Aplikasi tetap dipakai setelah minggu pertama, karena menumpang ritual harian yang sudah ada.                               |

## 4. Stakeholder

| Stakeholder            | Peran                                                                                 | Kepentingan utama                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Pemilik toko kelontong | Pengguna utama (sendirian, 1 toko, HP Android)                                        | Cepat, tidak ribet, angka bisa dipercaya, data tidak hilang                                                  |
| Dimas                  | Product owner & peserta lomba; penyetuju dokumen                                      | Demo mulus, memenuhi standar TM GTNIC 2026                                                                   |
| Juri GTNIC 2026        | Penilai                                                                               | Live di URL publik, alur end-to-end tanpa error, fitur pintar, responsif, keamanan dasar, interaksi database |
| Pelanggan toko         | Penerima promo via WhatsApp (tidak memakai aplikasi)                                  | Info promo yang jelas                                                                                        |
| Sales/distributor      | Sumber nota barang masuk (tidak memakai aplikasi)                                     | —                                                                                                            |
| Tim IT                 | tech-lead, backend-dev, frontend-dev, qa-engineer, security-reviewer, devops-engineer | Kebutuhan jelas & stabil                                                                                     |

## 5. Prinsip produk (wajib dipatuhi semua fitur)

1. **Numpang ritual, jangan bikin ritual baru.** Setiap fitur wajib menyebut: numpang ritual yang mana, di momen apa, berapa lama. Fitur yang butuh ritual baru → gugur.
2. **Sekali lirik.** Layar yang dibuka saat ritual harus dipahami tanpa dibaca seperti laporan: angka besar, warna status jelas.
3. **Rekomendasi, bukan paksaan.** Sistem tidak pernah mengubah harga atau stok tanpa tindakan pemilik.
4. **Angka harus benar.** Semua angka (modal terkunci, harga promo, untung/rugi, kas pulih) dihitung sistem dari data toko — tidak boleh dikarang AI.
5. **Isian minimal.** Hanya field yang benar-benar perlu yang wajib diisi.
6. **Data tidak boleh hilang.** Isian yang gagal tersimpan (misal sinyal putus) tetap ada dan bisa dikirim ulang.
7. **Tampilan bersih, sederhana, mudah.** Warna hanya untuk status barang dan aksi utama.

### Peta ritual

| Ritual                | Momen pemicu                        | Fitur yang menumpang                                             | Durasi maks    |
| --------------------- | ----------------------------------- | ---------------------------------------------------------------- | -------------- |
| R1 Tutup toko (malam) | Selesai hitung uang laci            | Rekap penjualan hari ini / opname cepat                          | ±2 menit       |
| R1b Minggu malam      | Tidak sempat rekap harian           | Rekap penjualan seminggu sekaligus                               | ±5–10 menit    |
| R2 Buka toko (pagi)   | Sambil cek dagangan                 | Lirik dashboard: perubahan status, tahap rencana jatuh tempo     | ±1 menit       |
| R3 Barang datang      | Nota dari sales sudah di tangan     | Catat barang masuk mengikuti urutan nota                         | ±1 menit/jenis |
| R4 Minggu pagi        | Duduk memikirkan usaha minggu depan | Baca ringkasan mingguan, pilih rencana, tandai hasil minggu lalu | ±10 menit      |

Fitur yang hanya dipakai sekali di awal (daftar, onboarding, import daftar barang) dikecualikan dari aturan ritual, tetapi tetap harus singkat.

## 6. Ruang lingkup

### 6.1 IN

| ID   | Kebutuhan bisnis                                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-1  | Daftar akun (satu akun = satu toko) + onboarding profil toko: jenis toko, kota/kecamatan, tipe pelanggan utama (3 pertanyaan pilihan, ±30 detik)                                                                                                                       |
| S-2  | Tombol **"Coba akun demo"**: toko contoh berisi data 90 hari, di-reset otomatis setiap hari                                                                                                                                                                            |
| S-3  | Kelola barang: tambah barang baru ≤ 1 menit, ubah barang, import daftar barang dari file CSV/Excel (template disediakan)                                                                                                                                               |
| S-4  | Catat barang masuk mengikuti urutan nota (nama, jumlah, harga beli)                                                                                                                                                                                                    |
| S-5  | Rekap penjualan tutup toko dua cara: (a) isi jumlah terjual per barang, atau (b) opname cepat (isi stok malam, sistem menghitung yang terjual). Plus import penjualan dari CSV (template disediakan). Rekap bisa untuk hari-hari sebelumnya (rekap mingguan sekaligus) |
| S-6  | Isian penjualan dan barang masuk yang belum terkirim disimpan sementara di HP, lalu dikirim ulang otomatis saat sinyal kembali                                                                                                                                         |
| S-7  | Klasifikasi status barang: Sehat, Waspada, Sekarat, Mati (aturan di §7)                                                                                                                                                                                                |
| S-8  | Uang terkunci per barang dan total, dihitung dari harga beli                                                                                                                                                                                                           |
| S-9  | Perkiraan hari stok habis untuk barang Sehat                                                                                                                                                                                                                           |
| S-10 | Skor prioritas: barang bermasalah diurutkan dari yang paling mendesak                                                                                                                                                                                                  |
| S-11 | Rencana aksi 3 tahap per barang yang disusun AI, lengkap dengan hitungan untung/rugi. Wajib ada saran cadangan dari template bila AI tidak tersedia                                                                                                                    |
| S-12 | Tandai barang pelengkap: tidak disarankan diobral, tetapi diingatkan bila stoknya berlebih                                                                                                                                                                             |
| S-13 | Pelacakan rencana: pilih rencana, jalankan tahap, tandai tahap berhasil/gagal, lihat kas pulih                                                                                                                                                                         |
| S-14 | Ringkasan mingguan 3 kalimat untuk Minggu pagi: apa yang terjadi minggu ini, barang yang butuh perhatian, rencana yang selesai                                                                                                                                         |
| S-15 | Bagikan promo ke WhatsApp: teks promo siap kirim, pemilik memilih penerimanya sendiri (kontak, grup, atau Status)                                                                                                                                                      |
| S-16 | Satu landing page publik yang bisa ditemukan di Google                                                                                                                                                                                                                 |
| S-17 | Pengaturan toko: ubah profil toko dan ambang hari status                                                                                                                                                                                                               |

### 6.2 OUT (eksplisit)

| ID  | Tidak dikerjakan                                                         | Alasan                                                     |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| O-1 | Fitur kasir: metode bayar, cetak struk, diskon otomatis, antrean pembeli | Lakoo bukan aplikasi kasir (permintaan pemilik)            |
| O-2 | Fitur tanggal kedaluwarsa                                                | Ditunda ke versi berikutnya (permintaan pemilik)           |
| O-3 | Penyimpanan kontak/nomor pelanggan, pengiriman WA otomatis               | Promo cukup dibuka dari WhatsApp milik pemilik             |
| O-4 | Mode offline penuh                                                       | Risiko jadwal; cukup antrean kirim ulang untuk isian (S-6) |
| O-5 | Lebih dari satu pengguna per toko, peran karyawan, multi-cabang          | Pemilik bekerja sendiri                                    |
| O-6 | Aplikasi native Android/iOS                                              | Cukup aplikasi web responsif                               |
| O-7 | Integrasi distributor, marketplace, atau pembayaran online               | Di luar masalah inti                                       |
| O-8 | Notifikasi push/pengingat                                                | Bertentangan dengan prinsip "numpang ritual"               |
| O-9 | Pengubahan harga atau stok otomatis oleh sistem                          | Bertentangan dengan prinsip "rekomendasi, bukan paksaan"   |

### 6.3 Could-have (bersyarat)

| ID  | Kebutuhan                                                                         | Syarat dikerjakan                                                   |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| C-1 | Tempel teks nota belanja, lalu sistem memecahnya otomatis jadi baris barang masuk | Hanya bila M1–M3 sudah selesai **dan** lolos QA sebelum batas waktu |

## 7. Aturan bisnis

| ID    | Aturan                                                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-1  | Satu akun mengelola tepat satu toko. Data satu toko tidak pernah terlihat oleh toko lain                                                                                                      |
| BR-2  | **Sehat** = barang laku dalam 14 hari terakhir                                                                                                                                                |
| BR-3  | **Sekarat** = terakhir laku 15–45 hari yang lalu                                                                                                                                              |
| BR-4  | **Mati** = tidak laku lebih dari 45 hari. Barang yang belum pernah laku dihitung sejak stoknya pertama kali masuk                                                                             |
| BR-5  | **Waspada** = barang yang masih Sehat tetapi jumlah terjual per minggu turun 3 minggu berturut-turut. Peringatan dini sebelum Sekarat                                                         |
| BR-6  | Ambang 14 / 45 hari dan 3 minggu bisa diubah pemilik di pengaturan toko                                                                                                                       |
| BR-7  | **Uang terkunci** per barang = stok saat ini × harga beli terakhir. Total = jumlah seluruh barang dengan stok > 0                                                                             |
| BR-8  | **Perkiraan hari stok habis** (barang Sehat) = stok saat ini ÷ rata-rata terjual per hari pada periode terakhir                                                                               |
| BR-9  | **Barang pelengkap** tidak pernah diberi saran obral/diskon, tetapi pemilik diingatkan bila stoknya melebihi kebutuhan wajar                                                                  |
| BR-10 | **Rencana aksi** = 3 tahap berurutan; tahap berikutnya dijalankan bila tahap sebelumnya tidak berhasil. Setiap tahap memuat hitungan: harga baru, untung/rugi per unit, perkiraan kas kembali |
| BR-11 | Saran **tidak boleh menyarankan harga di bawah harga beli** tanpa menyebut ruginya dengan jelas. Tahap 1 selalu mengutamakan opsi yang masih untung                                           |
| BR-12 | **Kas pulih** = uang hasil penjualan barang tersebut sejak tahap 1 dimulai sampai rencana selesai, dibandingkan dengan uang terkunci saat rencana dimulai                                     |
| BR-13 | Saran harus spesifik per barang, berdasarkan data toko (riwayat jual, stok, harga) dan profil toko (jenis, lokasi, tipe pelanggan). Saran generik yang sama untuk semua barang tidak diterima |
| BR-14 | Bila AI tidak tersedia, saran cadangan dari template tetap muncul dengan hitungan yang sama. Pemilik tidak boleh melihat layar kosong atau pesan error teknis                                 |
| BR-15 | Opname: terjual = stok pagi + barang masuk hari itu − stok malam. Hasil negatif ditolak dan pemilik diminta mengecek ulang                                                                    |
| BR-16 | Stok tidak boleh menjadi negatif akibat pencatatan penjualan                                                                                                                                  |
| BR-17 | Toko demo di-reset ke data contoh 90 hari setiap hari. Perubahan di akun demo tidak memengaruhi akun lain                                                                                     |
| BR-18 | Promo WhatsApp hanya menyiapkan teks; aplikasi tidak mengirim pesan sendiri dan tidak menyimpan nomor pelanggan                                                                               |

## 8. Asumsi

| ID  | Asumsi                                                                      |
| --- | --------------------------------------------------------------------------- |
| A-1 | Pemilik punya HP Android dengan Chrome versi terbaru dan WhatsApp terpasang |
| A-2 | Sinyal internet ada, walau kadang lambat atau putus sesaat                  |
| A-3 | Sekitar 100 jenis barang per toko (harus tetap lancar sampai 500)           |
| A-4 | Pemilik tahu harga beli dari nota kulakan                                   |
| A-5 | Pencatatan penjualan cukup per hari, tidak per transaksi pembeli            |
| A-6 | Juri mencoba lewat akun demo atau mendaftar sendiri                         |
| A-7 | Hosting dan database tingkat gratis cukup untuk skala lomba                 |

## 9. Batasan

| ID  | Batasan                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| K-1 | **Tenggat keras:** live dan bisa didemokan end-to-end pada 10 Nov 2026. Dokumen selesai ≤ 29 Okt 2026; sisa ±11 hari untuk build dan QA |
| K-2 | Bahasa Indonesia di seluruh antarmuka                                                                                                   |
| K-3 | Aplikasi web responsif: HP Android (Chrome), tablet, laptop                                                                             |
| K-4 | Hosting gratis; database relasional; URL publik; repo publik (`github.com/dimassyz/lakoo`)                                              |
| K-5 | Biaya layanan AI ≤ Rp100.000/bulan                                                                                                      |
| K-6 | Fitur saran wajib memakai AI (bukan hanya template), dengan fallback yang selalu berfungsi                                              |
| K-7 | Rahasia dan kredensial tidak pernah masuk repo                                                                                          |
| K-8 | Keamanan dasar: validasi input, perlindungan kredensial, isolasi data antar toko                                                        |

## 10. Kriteria keberhasilan bisnis

| ID   | Kriteria                                    | Cara mengukur                                                                                                              |
| ---- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| KS-1 | Pemilik tahu total uang terkunci            | Total uang terkunci tampil di layar utama ≤ 3 detik setelah dibuka dan cocok dengan perhitungan manual BR-7                |
| KS-2 | Setiap barang bermasalah punya rencana aksi | 100% barang Waspada/Sekarat/Mati di toko demo bisa menampilkan rencana 3 tahap (AI atau cadangan)                          |
| KS-3 | Kas pulih terlihat                          | Rencana yang dijalankan di toko demo menampilkan kas pulih yang cocok dengan BR-12                                         |
| KS-4 | Demo end-to-end tanpa error                 | Alur demo (§11) berjalan 3× berturut-turut di HP Android dan laptop tanpa error, termasuk saat AI dimatikan                |
| KS-5 | Data tidak hilang                           | Isian yang dibuat saat sinyal mati terkirim setelah sinyal kembali; nol data hilang di uji QA                              |
| KS-6 | Ritual tidak terlampaui                     | Rekap tutup toko ±10 barang ≤ 2 menit; tambah barang ≤ 1 menit; 1 baris barang masuk ≤ 1 menit (diuji QA dengan stopwatch) |
| KS-7 | Lolos syarat GTNIC                          | Live di URL publik, repo publik dengan README, responsif, ada fitur AI, ada interaksi database                             |
| KS-8 | Landing page mudah ditemukan dan cepat      | Lighthouse ≥ 90 di empat kategori (mobile dan desktop)                                                                     |

## 11. Alur demo GTNIC (acuan end-to-end)

1. Buka landing page → tekan "Coba akun demo".
2. Dashboard menampilkan total uang terkunci + jumlah barang Sehat/Waspada/Sekarat/Mati.
3. Buka barang Mati paling mendesak → lihat rencana AI 3 tahap beserta hitungannya.
4. Pilih rencana → bagikan promo tahap 1 ke WhatsApp.
5. Rekap tutup toko: catat penjualan barang itu → stok berkurang, kas pulih bertambah.
6. Catat barang masuk dari nota.
7. Lihat ringkasan mingguan.
8. Uji tahan gagal: AI dimatikan → saran cadangan tetap muncul.

## 12. Milestone

| Milestone          | Isi                                                                                                                         | Target                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| M0 Dokumen         | BRD, PRD, SPEC, FSD, DESIGN, TASKS disetujui + bootstrap repo                                                               | 29 Okt 2026                  |
| M1 Fondasi data    | Akun + onboarding, barang, barang masuk, penjualan (form + import), dashboard status + uang terkunci                        | ±2 Nov 2026                  |
| M2 Kecerdasan      | Mesin deteksi + skor prioritas, rencana AI 3 tahap + cadangan template, proyeksi kas pulih                                  | ±5 Nov 2026                  |
| M3 Aksi dan polish | Barang pelengkap, pelacakan rencana, share WA, ringkasan mingguan, generator data demo, landing page, dokumentasi, QA rilis | ±8 Nov 2026                  |
| Rilis              | Deploy produksi + uji penerimaan Dimas                                                                                      | 9 Nov 2026 (cadangan 1 hari) |

Tanggal M1–M3 adalah target; komitmen final menunggu persetujuan Dimas atas TASKS.md.

## 13. Risiko

| Risiko                                          | Kemungkinan | Dampak | Mitigasi                                                                         |
| ----------------------------------------------- | ----------- | ------ | -------------------------------------------------------------------------------- |
| Waktu build hanya ±11 hari                      | Tinggi      | Tinggi | MoSCoW ketat; C-1 hanya bila sempat; review dokumen 3 putaran                    |
| Layanan AI lambat/tidak tersedia saat demo      | Sedang      | Tinggi | Fallback template wajib; saran AI disimpan sehingga tidak dibuat ulang saat demo |
| Kuota hosting/database gratis habis             | Rendah      | Tinggi | Skala lomba kecil; dipantau devops                                               |
| Pemilik malas mencatat → data tidak akurat      | Sedang      | Sedang | Numpang ritual, dua cara rekap, rekap mingguan sebagai cadangan                  |
| Saran AI tidak masuk akal atau menyarankan rugi | Sedang      | Sedang | Angka dihitung sistem, bukan AI (prinsip 4); BR-11 divalidasi sistem             |
| Akun demo dirusak pengunjung                    | Sedang      | Sedang | Reset harian (BR-17)                                                             |
| Biaya AI melebihi anggaran                      | Rendah      | Sedang | Saran disimpan dan dipakai ulang; batas pemakaian per toko                       |

## 14. Persetujuan

| Tanggal     | Versi                                           | Oleh  | Keputusan       |
| ----------- | ----------------------------------------------- | ----- | --------------- |
| 26 Okt 2026 | Kebutuhan yang disepakati (`docs/KEBUTUHAN.md`) | Dimas | oke             |
| 26 Okt 2026 | BRD 1.0                                         | Dimas | oke (disetujui) |
