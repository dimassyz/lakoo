# DESIGN.md — Lakoo

**Produk:** Lakoo — Asisten inventaris pintar untuk toko kelontong  
**Versi:** 1.0 — **FROZEN** 26 Okt 2026  
**Author:** tech-lead (disetujui atas delegasi Dimas)  
**Referensi visual:** dimasyz/lakoo repo root `docs/design-refs/` (screenshot yang dikirim Dimas)

## 1. Product personality (1–2 kalimat)

Kita desain Lakoo sebagai aplikasi yang **bersih, ringan, dan benar-benar milik pemilik warung**.  
Tidak ada warna berlebihan, tidak ada animasi berlebihan, tidak ada font keren.  
Yang terpenting: setiap angka besar, setiap status jelas, dan setiap tombol besar.  
Pengguna yang paling jarang menggunakan HP akan tetap merasa nyaman karena semuanya mudah dibaca dalam 2 detik.

## 2. Palette (max 3 core + 1 accent, setiap satu dengan 1 alasan)

| Warna                           | Hex    | Alasan                                                                                           |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| **Gading putih** (#F8F7F4)      | Core   | Latar paling bersih dan nyaman untuk mata pemilik warung yang sudah 8 jam melihat barang di rak. |
| **Hitam pekat** (#1F1F1F)       | Core   | Untuk nama barang dan angka penting — sangat mudah dibaca meski HP di bawah cahaya terang.       |
| **Abu-abu lembut** (#6B7280)    | Core   | Untuk label status (Sehat/Waspada/Sekarat/Mati) dan teks bantu.                                  |
| **Hijau keselamatan** (#10B981) | Accent | Hanya dipakai untuk status Sehat dan tombol utama.                                               |

## 3. Typography

| Tipe               | Ukuran | Font           | Alasan                                                             |
| ------------------ | ------ | -------------- | ------------------------------------------------------------------ |
| **Judul halaman**  | 24px   | Inter Bold     | Nama barang dan halaman penting selalu besar & tebal.              |
| **Isi utama**      | 17px   | Inter Regular  | Teks utama (nama barang, status, uang terkunci).                   |
| **Kecil & status** | 15px   | Inter Regular  | Label status, harga, dan teks bantu.                               |
| **Tombol**         | 16px   | Inter SemiBold | Tombol utama (Rekap, Tambah barang, Jalankan rencana) selalu bold. |

## 4. ENERGY / RHYTHM / MOTION dials

**ENERGY**

- Rendah. Tidak ada efek hover, ripple, atau animasi panas.
- Hanya perubahan warna saat tombol ditekan (hitam pekat).
- Tidak ada scroll animasi atau loading spinner yang berputar.

**RHYTHM**

- Sangat konsisten:
  - Hero selalu 3 blok besar.
  - Daftar barang selalu 1 baris kartunya.
  - Rekap selalu 1 baris per barang.
- Tidak ada halaman yang terlalu panjang.

**MOTION**

- Hanya 1 jenis animasi:
  - Ketika status berubah (warna dari hijau ke kuning ke merah).
  - Ketika tombol ditekan (skala 95% lalu kembali).
- Tidak ada animasi masuk atau transisi halaman.

## 5. Motion & decoration rules

- **Tidak ada** border radius besar (hanya 8px).
- **Tidak ada** bayangan atau shadow sama sekali (hanya border tipis 1px).
- **Tidak ada** icon bergerak atau dot loading.
- Setiap kartu memiliki border tipis abu-abu (#6B7280) dan padding 16px.

## 6. Feel-line per page (inventory)

| Halaman         | Feel-line satu kalimat                   |
| --------------- | ---------------------------------------- |
| Beranda         | "Uang terkunci di rak"                   |
| Rekap Penjualan | "Catat penjualan dengan cepat"           |
| Barang Masuk    | "Tambah barang dari nota"                |
| Daftar Barang   | "Lihat semua barang sekaligus"           |
| Detail Barang   | "Saran obral 3 tahap"                    |
| Rencana         | "Jalankan rencana dan lihat kas kembali" |
| Hasil           | "Ringkasan mingguan"                     |
| Import          | "Import cepat dari file"                 |

## 7. References & visual non-goals

**Diambil dari:**

- Screenshot dashboard yang kamu kirim (D-inventy + HP mockup)  
  → Ambil: ukuran kartu, posisi tombol, warna status, dan layout HP.  
  **Bukan:** warna biru kantor, animasi yang berlebihan, atau desain yang terlalu formal.

**Visual non-goals:**

- Tidak mau warna pink/muda atau orange cerah (terlalu anak-anak).
- Tidak mau font yang miring atau decorative.
- Tidak mau efek bayangan atau shadow.
- Tidak mau loading spinner berputar (hanya teks "Memuat…").

**Approval history:**

- Versi 1.0 disetujui bersama SPEC.md pada 26 Okt 2026.

---

**Catatan khusus untuk developer:**  
Gunakan preset `clean-simple` yang sudah dibuat di CODE_STANDARDS.md.  
Semua warna harus diambil dari tabel di atas. Tidak boleh ada warna lain.  
Status selalu pakai ikon + label sesuai tabel di FSD §0.6.

Lihat juga `docs/api/openapi.yaml` untuk API yang sama dengan warna ini.
