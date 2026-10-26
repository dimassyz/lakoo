# FSD — Lakoo (Functional Specification)

| | |
|---|---|
| Versi | 1.0 — **FROZEN** 26 Okt 2026 |
| Penyusun | tech-lead (disetujui atas delegasi Dimas, lihat `docs/PROJECT_LOG.md`) |
| Input | `docs/PRD.md` 1.1, `docs/SPEC.md` 1.0, `docs/api/openapi.yaml` 1.0 |
| Arah visual | `docs/DESIGN.md` |

Dokumen ini menjelaskan perilaku setiap layar: **input**, **proses**, **output**, **validasi**, **error handling**, dan **state**. Rumus ada di SPEC §5, bentuk data API di `openapi.yaml`. FSD menjawab pertanyaan "apa yang dilihat dan dialami pengguna".

---

## 0. Perilaku global (berlaku di semua layar aplikasi)

### 0.1 Kerangka aplikasi (`/toko/*`)

**Navigasi utama**
- Di HP (< 1024 px), navigasi tetap di bawah dengan 5 item:

  | Urutan | Label | Rute |
  |---|---|---|
  | 1 | Beranda | `/toko` |
  | 2 | Rekap | `/toko/rekap` |
  | 3 | Barang Masuk | `/toko/barang-masuk` |
  | 4 | Barang | `/toko/barang` |
  | 5 | Lainnya | sheet berisi Rencana, Hasil, Import, Pengaturan, Keluar |

- Di desktop (≥ 1024 px), sidebar kiri memuat item yang sama, ditambah Rencana dan Hasil sebagai item langsung.

**Header**
- Isi header: nama toko, dan tanggal hari ini dalam WIB (contoh "Senin, 3 Nov").
- Di akun demo, ada **pita demo** di atas header yang tampil di semua halaman: "Akun demo — data di-reset setiap hari", dengan tautan "Daftar gratis" (PRD F-02 AC-6).

**Guard rute**
- Pengguna tanpa sesi yang membuka `/toko/*` atau `/mulai` diarahkan ke `/masuk?lanjut=<rute>`.
- Pengguna dengan sesi yang membuka `/masuk` atau `/daftar` diarahkan ke `/toko`.
- Toko yang `onboarded = false` dan membuka `/toko/*` diarahkan ke `/mulai`.

### 0.2 State standar setiap layar data

| State | Tampilan |
|---|---|
| Memuat | Skeleton seukuran konten akhir, tanpa spinner layar penuh. Total uang terkunci di Beranda tampil lebih dulu (SPEC §10.4 F-08) |
| Kosong | Satu kalimat + satu tombol aksi (contoh: "Belum ada barang. **Tambah barang** atau **Import dari file**") |
| Error muat | "Gagal memuat. Periksa sinyal lalu coba lagi." + tombol **Coba lagi**. Data lama tetap tampil bila ada di cache |
| Offline (`navigator.onLine = false`) | Pita kecil "Tidak ada sinyal — isian tetap disimpan di HP" di atas navigasi |

### 0.3 Pemetaan error API ke UI

| Kode | UI |
|---|---|
| `validation_error` | Pesan per field di bawah input (`error.fields`), fokus ke field pertama yang salah |
| `unauthenticated` | Arahkan ke `/masuk?lanjut=…` dengan pesan "Sesi berakhir, silakan masuk lagi". Isian di outbox tidak dihapus |
| `bad_origin` / `forbidden_demo` | Toast "Aksi ini tidak bisa dilakukan" |
| `not_found` | Layar "Barang/rencana tidak ditemukan" + tombol kembali |
| `rate_limited` | Toast "Terlalu banyak percobaan. Coba lagi dalam {menit} menit" (dari `Retry-After`) |
| `internal_error` / 5xx / jaringan | Toast "Ada gangguan. Coba lagi sebentar." Untuk endpoint outbox → masuk antrean (§0.4) |
| Error per baris (`error.lines`) | Baris terkait diberi tanda merah + pesan dari server. Ringkasan di atas tombol simpan: "{n} baris perlu dicek" |

Pengguna tidak pernah melihat kode error, stack trace, atau kata "error/server/500".

### 0.4 Outbox (F-09) — berlaku untuk Rekap dan Barang Masuk

**Saat pengguna menekan Simpan**
1. UI membuat item outbox: `id` (UUID v4) yang sekaligus menjadi `Idempotency-Key`.
2. Item disimpan ke IndexedDB **sebelum** request dikirim.
3. Request dikirim.

**Hasil pengiriman**

| Hasil | Yang terjadi pada item | Yang dilihat pengguna |
|---|---|---|
| 2xx | Dihapus dari outbox | Toast sukses |
| 422 | Tetap di outbox dengan state `needs_review` | Layar tetap terbuka, baris bermasalah ditandai |
| 401 | Tetap di outbox | Diarahkan ke halaman masuk; setelah masuk, item dikirim ulang |
| Jaringan / 5xx / timeout 15 dtk | Tetap `pending` | Toast "Belum terkirim — akan dikirim otomatis saat ada sinyal". Form dibersihkan seolah tersimpan |

**Kirim ulang otomatis**
- Dipicu saat event `online`, saat aplikasi dimuat, dan setiap 30 dtk selama masih ada item `pending`.
- Backoff: 30 dtk, 1, 2, 5, lalu 10 menit (maksimal).
- Retry memakai `id` yang sama (dedup di server).

**Indikator dan daftar antrean**
- Badge di header: "{n} belum terkirim". Mengetuknya membuka daftar antrean berisi jenis, tanggal, jumlah baris, status, dan tombol **Kirim sekarang**.
- Item `needs_review` bisa **Buka & perbaiki**, yang membuka form terkait dengan isian itu, atau **Buang** dengan konfirmasi "Data ini akan hilang".

**Logout**
- Bila outbox tidak kosong, muncul konfirmasi: "Ada {n} isian belum terkirim. Keluar tetap menyimpannya di HP ini." Outbox tidak dihapus saat logout.

### 0.5 Format

- Rupiah: `Rp12.500`, tanpa desimal. Selisih negatif ditulis `−Rp1.200`.
- Tanggal panjang: "Senin, 3 November 2026". Tanggal pendek: "3 Nov".
- Jumlah barang: angka + satuan ("12 pcs").
- Input angka memakai `inputmode="numeric"`. Saat diketik, rupiah diformat dengan titik ribuan; nilai yang dikirim berupa integer.

### 0.6 Label status (dipakai di semua layar)

| Status | Label | Ikon (arti) | Kalimat bantu |
|---|---|---|---|
| sehat | Sehat | centang | "Laku dalam {healthyDays} hari terakhir" |
| waspada | Waspada | tanda seru segitiga | "Penjualan turun {warningWeeks} minggu berturut-turut" |
| sekarat | Sekarat | jam pasir | "{d} hari tidak laku" |
| mati | Mati | lingkaran silang | "{d} hari tidak laku" |
| stok_habis | Stok habis | kotak kosong | "Stok 0" |

Warna setiap status diatur di DESIGN.md §2. Status selalu tampil sebagai ikon + label teks.

---

## 1. Landing `/` (F-19)

- **Input:** tidak ada form.
- **Output (urutan section):**
  1. **Hero:**
     - Judul: "Berapa uangmu yang terkunci di rak?"
     - Subjudul satu kalimat: Lakoo menghitung modal yang tertahan di barang tidak laku dan memberi rencana menjualnya kembali.
     - Tombol utama **Coba akun demo** (tanpa daftar). Tombol kedua **Daftar gratis**.
     - Di bawah tombol: "Gratis. Tanpa kartu kredit. Bahasa Indonesia."
  2. **Contoh angka:** kartu statis berisi angka nyata dari data demo saat build. Contoh: "Rp1.284.000 terkunci · 9 barang mati · 8 sekarat". Angka di-hardcode saat build dari generator demo; tidak di-fetch.
  3. **Cara kerja, 3 langkah:** Catat saat tutup toko (2 menit) → Lihat barang yang sekarat dan mati → Jalankan rencana 3 tahap dan lihat kas kembali.
  4. **Definisi:** "Apa itu uang terkunci?" berisi definisi 1 paragraf + contoh hitungan "40 botol sampo × Rp18.500 = Rp740.000".
  5. **FAQ:** 5 pertanyaan dengan jawaban 40–60 kata:
     - Apakah Lakoo aplikasi kasir?
     - Apakah harus internet?
     - Bagaimana AI menyusun saran?
     - Apakah data saya aman?
     - Berapa biayanya?
  6. **Footer:** tautan Privasi, tautan GitHub repo, "Karya GTNIC 2026".
- **Proses "Coba akun demo":**
  1. POST `/auth/demo`.
  2. Selama proses, tombol menampilkan "Menyiapkan toko contoh…" dan dalam keadaan disabled.
  3. Sukses → `/toko`.
  4. 429 → "Terlalu banyak percobaan dari jaringan ini, coba lagi nanti".
  5. 503 / jaringan → "Toko contoh sedang disiapkan, coba lagi sebentar" + tombol coba lagi.
- **SEO:** SPEC §7b.

## 2. Privasi `/privasi`

Halaman statis 1 layar:
- data yang disimpan: email, data toko
- data yang tidak disimpan: nomor pelanggan, tidak ada pelacak
- data barang dikirim ke penyedia AI (Google) **tanpa email**
- akun demo dihapus dalam 24 jam
- cara minta hapus akun: email kontak dari env `CONTACT_EMAIL`, ditampilkan sebagai teks

## 3. Daftar `/daftar` (F-01, US-01.1)

| Input | Aturan UI | Pesan |
|---|---|---|
| Nama toko | wajib, 1–60 | "Isi nama toko" |
| Email | wajib, format email | "Format email belum benar" |
| Kata sandi | wajib, 8–72, ada tombol tampilkan/sembunyikan | "Minimal 8 karakter" |

- **Proses:** POST `/auth/register` → 201 → `/mulai`.
- **Error:** `email_taken` → pesan di field email "Email ini sudah terdaftar. **Masuk?**" (tautan). Field lain tidak dikosongkan (US-01.1 AC-2).
- **State tombol:**

  | Kondisi | Tombol |
  |---|---|
  | Diam | "Daftar" |
  | Mengirim | "Mendaftarkan…" (disabled) |

- **Aturan form:** submit dengan Enter didukung. Tidak ada field lain.

## 4. Masuk `/masuk` (F-01)

- **Input:** email, kata sandi.
- **Proses:** POST `/auth/login` → arahkan ke `lanjut` (hanya path internal yang diawali `/toko`), atau ke `/toko` bila tidak ada.
- **Error:**
  - `invalid_credentials` → satu pesan di atas form: "Email atau kata sandi salah". Field kata sandi dikosongkan.
  - 429 → sesuai §0.3.
- **Lupa kata sandi:** teks kecil "Lupa kata sandi? Hubungi {CONTACT_EMAIL}". Tidak ada alur reset (SPEC §2 OUT).

## 5. Onboarding `/mulai` (F-01, US-01.2)

Satu halaman dengan 3 pertanyaan, bukan wizard. Target selesai ≤ 30 dtk.

| # | Pertanyaan | Kontrol | Pilihan |
|---|---|---|---|
| 1 | "Toko kamu jenis apa?" | pilih satu (tombol besar) | Warung kelontong, Toko kelontong, Minimarket kecil, Warung sembako, Lainnya |
| 2 | "Toko kamu di mana?" | teks 1 baris, placeholder "Contoh: Kec. Lowokwaru, Malang" | maks 80 |
| 3 | "Pembeli kamu kebanyakan siapa?" | pilih banyak (chip) | Warga perumahan, Anak sekolah, Pekerja pabrik/kantor, Pedagang lain, Orang lewat/pengendara, Anak kos/mahasiswa |

- **Tombol:**
  - **Simpan & mulai** → PATCH `/store` `{storeType, location, customerTypes, completeOnboarding: true}` → `/toko`.
  - **Lewati dulu** (tautan) → PATCH `/store` `{completeOnboarding: true}` → `/toko`.
- **Validasi:** semua pertanyaan opsional, sehingga tombol Simpan tidak pernah disabled.
- **Setelah onboarding:** bila `profileComplete = false`, Beranda menampilkan kartu kecil yang bisa ditutup: "Lengkapi profil toko supaya saran lebih pas" → `/toko/pengaturan` (US-01.2 AC-3).

## 6. Beranda `/toko` (F-10, F-11, F-12, F-17) — ritual R2, sekali lirik

**Sumber:** GET `/dashboard`.

**Urutan blok di HP (atas → bawah):**

1. **Uang terkunci (hero).**
   - Label: "Uang terkunci di rak".
   - Angka terbesar di layar: `totals.lockedValue`.
   - Di bawah angka: "Rp{problemLockedValue} di barang bermasalah".
   - Bila `complementaryLockedValue > 0`: "termasuk Rp{x} di barang pelengkap".
2. **Empat ubin status** (grid 2×2 di HP, 4 kolom di desktop): Sehat, Waspada, Sekarat, Mati.
   - Setiap ubin berisi ikon + label, jumlah barang (besar), dan Rp terkunci (kecil).
   - Ketuk ubin → `/toko/barang?status=<s>`.
   - Bila `stok_habis.count > 0`, tampil baris teks di bawah grid: "{n} barang stok habis".
3. **Hari ini.**
   - `today.dueSteps`: "Tahap {n} {title} untuk {produk} sudah waktunya dicek" → detail barang di tab rencana.
   - `today.statusChanges`: "{produk}: {from} → {to}".
   - Bila keduanya kosong: "Tidak ada yang perlu dicek hari ini" (PRD F-10 AC-6).
   - Maksimal 5 baris, lalu tautan "lihat semua".
4. **Ringkasan minggu lalu.** Hanya tampil bila `weeklySummary ≠ null` (hari Minggu/Senin). Isinya 3 kalimat + tautan "Lihat hasil".
5. **Tangani dulu.**
   - `topPriority` (≤ 3 barang), masing-masing: nama, label status, `reason`, Rp terkunci, dan tombol **Lihat rencana** → `/toko/barang/{id}#rencana`.
   - Bila kosong: "Tidak ada barang bermasalah. Mantap!"
6. **Segera kulakan.** `restockSoon` dalam bentuk "{nama} — ±{n} hari lagi habis" (maks 10).
7. **Pelengkap kebanyakan.** `complementaryOverstock`: "{nama}: stok {s}, jangan kulakan dulu sampai tinggal {threshold}".

**Desktop (≥ 1024 px):**
- Baris 1: hero + 4 ubin dalam satu deretan KPI.
- Baris 2: kolom kiri berisi "Tangani dulu" + "Hari ini"; kolom kanan berisi ringkasan + kulakan + pelengkap.

**State:**
- Toko baru tanpa barang: hero tetap "Rp0". Blok lain diganti kartu kosong dengan 2 aksi: **Tambah barang**, **Import dari file**.
- Tombol utama mengambang (FAB) di HP: **Rekap hari ini** → `/toko/rekap`.

**Kinerja:** hero tampil ≤ 3 dtk di 4G (PRD F-10 AC-5).

## 7. Rekap Penjualan `/toko/rekap` (F-06, F-07) — ritual R1/R1b

**Sumber:** GET `/sales/recap?date=` (bawaan hari ini WIB).

**Kontrol atas**
- **Tanggal:** default "Hari ini". Tombol ‹ › untuk geser per hari, dan pemilih tanggal yang hanya mengizinkan ≤ hari ini dan ≥ 365 hari lalu.
- Bila `hasRecord`: label "Sudah ada rekap untuk tanggal ini — perubahan akan mengganti" (US-06.1 AC-7).
- **Tab mode:** **Jumlah terjual** (bawaan) | **Hitung sisa stok (opname)**. Pilihan terakhir disimpan di localStorage.
- **Kolom cari** nama barang (filter lokal).

**Mode Jumlah terjual (F-06)**
- Daftar baris diurutkan sesuai respons API (paling sering laku di atas).
- Setiap baris: nama, "stok {currentStock}", stepper `−` [angka] `+`. Nilai awal = `recordedQty`.
- Ketuk angka untuk mengetik langsung.
- Validasi klien: qty > `currentStock + recordedQty` (stok tersedia untuk tanggal itu) → baris merah "Stok tercatat hanya {x}" + tautan **Perbaiki stok**.
  - Tautan membuka bottom sheet "Stok sebenarnya sekarang?" berisi input angka → POST `/products/{id}/stock-adjustments` → data rekap dimuat ulang.
  - Untuk tanggal lampau, server tetap memvalidasi BR-16 secara penuh.
- Footer lengket: "{n} barang · {total qty} terjual · Rp{estimasi}" + tombol **Simpan rekap**.
- **Kirim:** hanya baris yang berubah dari `recordedQty`, dalam bentuk `{productId, qty}`. Kalau tidak ada yang berubah, tombol disabled dengan teks "Belum ada perubahan".

**Mode Opname (F-07)**
- Setiap baris: nama, "pagi {morningStock}", "+masuk {stockInOnDate}" (bila > 0), dan input "sisa sekarang" yang kosong secara default.
- Saat diisi, tampil langsung: "terjual {sold}" dengan sold = morning + masuk − sisa.
- sold < 0 → baris merah: "Sisa lebih banyak dari catatan. Cek lagi jumlahnya atau **catat barang masuk**" (tautan ke `/toko/barang-masuk?date=`). Tombol simpan disabled selama ada baris merah.
- Baris yang kosong tidak dikirim (US-07.1 AC-4).
- **Kirim:** `{productId, countedStock}` untuk baris yang terisi.

**Proses simpan (kedua mode)**
- PUT `/sales/recap` melalui outbox (§0.4).
- **Sukses:** toast "Rekap tersimpan: {totalSold} barang, Rp{totalRevenue}". Bila ada baris yang `status` barunya berbeda, tampilkan maksimal 3 baris "{nama} sekarang {status}". Layar tetap di tanggal itu dengan data yang dimuat ulang.
- **422:** baris dari `error.lines[index]` ditandai sesuai urutan baris yang dikirim.

**Target waktu:** ±10 barang ≤ 2 menit; rekap 7 hari ≤ 10 menit (geser tanggal dengan ‹ ›).

## 8. Barang Masuk `/toko/barang-masuk` (F-05) — ritual R3

**Input (urutan nota)**
- **Tanggal nota:** default hari ini, bisa diubah ke tanggal lampau sampai 365 hari.
- **Daftar baris.** Baris pertama langsung tersedia. Tombol **+ Tambah baris** ada di bawah.
- Setiap baris:

  | Field | Isi | Wajib |
  |---|---|---|
  | Barang | kombobox: ketik → saran barang aktif (urut `frequent`) | ya |
  | Jumlah | angka ≥ 1 | ya |
  | Harga beli per satuan | angka; terisi otomatis `lastCost` barang terpilih, bisa diubah | ya |

- Teks bantu di bawah harga: "terakhir Rp{lastCost}". Bila berbeda > 20%: "Harga naik/turun {p}% dari terakhir" (info, bukan error).
- **Barang baru di baris yang sama:** bila nama yang diketik tidak cocok, opsi paling bawah kombobox adalah "+ Tambah '{nama}' sebagai barang baru". Memilihnya membuka 1 field tambahan di baris itu, yaitu **Harga jual** (wajib). Hasilnya dikirim sebagai `newProduct` (US-05.1 AC-2).
- Footer: "{n} baris · Rp{Σ qty×harga}" + **Simpan**.

**Validasi**
- Semua field baris wajib diisi. Baris yang sepenuhnya kosong diabaikan.
- Barang yang sama dua kali di satu nota diperbolehkan.

**Proses**
- POST `/stock-ins` lewat outbox.
- Sukses → toast "Barang masuk tersimpan" → form direset, tanggal tetap.

**Riwayat**
- Di bawah form ada bagian "Riwayat 30 hari" (GET `/stock-ins`), dikelompokkan per tanggal.
- Baris `editable` punya menu **Ubah** (qty, harga, tanggal) dan **Hapus** dengan konfirmasi.
- Error `edit_window_closed` → "Sudah lebih dari 7 hari, tidak bisa diubah". `insufficient_stock` → "Tidak bisa: stok sudah terjual sebagian".

## 9. Daftar Barang `/toko/barang` (F-03, US-03.2 AC-3)

**Kontrol**
- Kolom cari (`q`), chip filter status (Semua, Sehat, Waspada, Sekarat, Mati, Stok habis, Pelengkap), dan toggle "Tampilkan arsip".
- Query string mengikuti filter (`?status=`) agar ubin Beranda bisa menautkan langsung.

**Baris (HP)**
- Isi: nama, label status, "stok {s} · Rp{locked} terkunci", dan keterangan kecil berupa `reason`, "±{n} hari lagi habis", atau "pelengkap".
- Ketuk baris → detail.

**Desktop**
- Tabel dengan kolom: Nama | Status | Stok | Harga beli | Harga jual | Uang terkunci | Terakhir laku | Skor.
- Kolom bisa diurutkan di sisi klien.

**Aksi**
- **+ Tambah barang** → `/toko/barang/baru`.
- **Import** → `/toko/import`.

**Kosong:** lihat §0.2.

## 10. Tambah / Ubah Barang `/toko/barang/baru`, `/toko/barang/[id]/ubah` (F-03)

| Field | Wajib | Aturan | Catatan |
|---|---|---|---|
| Nama barang | ya | 1–80 | Autofokus |
| Harga beli | ya (hanya tambah) | 0–100 jt | Di form ubah tidak ada. Harga beli berubah lewat Barang Masuk |
| Harga jual | ya | 0–100 jt | Bila < harga beli: peringatan kuning "Harga jual di bawah modal" (tidak memblokir) |
| Stok sekarang | ya (hanya tambah) | 0–100.000 | Di form ubah tidak ada. Perbaiki stok dilakukan di detail |
| Satuan | tidak | ≤ 16, bawaan "pcs" | Di bagian "Detail lain" (terlipat) |
| Kategori | tidak | ≤ 40 | Di "Detail lain" |
| Barang pelengkap | tidak | toggle | Di "Detail lain", dengan penjelasan 1 kalimat |

**Proses**
- Tambah: POST `/products` → kembali ke halaman asal (`?kembali=`) atau ke detail barang.
- Ubah: PATCH.
- Tombol "Simpan & tambah lagi" di form tambah untuk input beruntun.

**Error**
- `duplicate_product_name` → pesan di field nama: "Nama ini sudah ada. **Buka barangnya**" (tautan ke `existingProductId`).

**Target:** tambah 1 barang ≤ 1 menit (4 field wajib).

## 11. Detail Barang `/toko/barang/[id]` (F-13..F-16, F-18) — ritual R4

**Sumber:** GET `/products/{id}` + GET `/products/{id}/plans/current`.

### 11.1 Ringkasan barang

- Isi: nama, label status + kalimat bantu (§0.6), uang terkunci (besar), stok, harga beli terakhir, harga jual, margin per unit, dan terakhir laku ("{tanggal} · {d} hari lalu" atau "Belum pernah laku").
- **Grafik 8 minggu:** batang sederhana dari `weekQty` (kiri = terlama), tanpa sumbu berlebihan, dengan label angka di atas batang.
- **Aksi:**
  - **Ubah**
  - **Perbaiki stok** (bottom sheet, sama dengan §7)
  - toggle **Barang pelengkap**
  - **Arsipkan**, dengan konfirmasi "Barang tidak muncul lagi di rekap & beranda. Riwayat tetap tersimpan."
- **Barang pelengkap:** tampil kotak info. Bila overstock: "Stok {s}, kebutuhan ±60 hari {threshold}. Jangan kulakan dulu sampai stok tinggal {threshold}." Ada input opsional "Batas stok sendiri" → PATCH `complementaryMaxStock`.

### 11.2 Rencana (`#rencana`)

**Tampil bila** status ∈ {waspada, sekarat, mati} dan bukan pelengkap. Selain itu:
- Pelengkap → teks "Barang pelengkap tidak diberi saran obral."
- Sehat → "Barang ini sehat. ±{n} hari lagi habis."

**State A — belum ada rencana (`plan = null`)**
- Tampil tombol **Buat rencana**.
- Menekannya menjalankan POST `/products/{id}/plans`.
- **Loading:** kartu skeleton 3 tahap + teks bergilir "Membaca riwayat penjualan… / Menyusun langkah…". Maksimal 15 dtk (server menjamin fallback).
- Gagal jaringan → "Gagal membuat rencana. Coba lagi."

**State B — `suggested`**
- Header: label sumber ("Disusun AI" atau "Saran dasar") + `rationale`.
- **3 kartu tahap** berurutan, masing-masing berisi:
  - "Tahap {n} · {durationDays} hari" + `title`
  - `instructions`
  - "Berhasil kalau: {successCriteria}"
  - **Kotak hitungan:**
    - "Harga {oldPrice} → {newPrice}"
    - "Untung Rp{profitPerUnit}/unit", atau label merah **"Rugi Rp{|profit|} per unit"** bila `isLoss`
    - "Bila stok habis terjual: ±Rp{cashBackEstimate} kembali"
  - Untuk bundle: "Paket {A} + {bundleProduct.name} Rp{bundlePrice}".
- **Tombol:**
  - **Jalankan rencana ini** (utama) → POST `/plans/{id}/start`.
  - **Buat ulang saran** (sekunder) → POST `/products/{id}/plans` dengan `{regenerate: true}`, didahului konfirmasi "Saran sekarang akan diganti".
- **Catatan kaki:** "Ini saran, kamu yang memutuskan."

**State C — `active`**
- **Kas pulih** di atas: "Rp{recovered} dari Rp{lockedValueAtStart} kembali" + bar progres + {recoveredPercent}%.
- Tahap lama: tanda ✓ (succeeded), ✗ (failed), atau – (skipped).
- **Tahap `in_progress` disorot** dan memuat:
  - "Mulai {startedOn} · cek {dueOn}"
  - Bila `newPrice ≠ harga jual sekarang`: tombol **Ubah harga jual jadi Rp{newPrice}** → konfirmasi "Harga jual {nama} jadi Rp{newPrice}?" → POST `apply-price` (PRD US-16.2 AC-5).
  - Bila `shareText`: tombol **Bagikan ke WhatsApp** (§11.3).
  - Dua tombol hasil: **Berhasil** dan **Belum berhasil — lanjut tahap {n+1}**. Pada tahap 3, tombol kedua bertuliskan **Belum berhasil — akhiri**. Keduanya meminta konfirmasi lalu POST `outcome`.
- Tahap berikutnya ditampilkan redup (pending).
- Tautan **Hentikan rencana** → konfirmasi → POST `/plans/{id}/stop`.

**State D — rencana berakhir**

| State | Pesan |
|---|---|
| `completed` | "Rencana selesai di tahap {n}. Rp{recovered} kembali." |
| `sold_out` | "Stok habis terjual! Rp{recovered} kembali." |
| `exhausted` | "3 tahap sudah dicoba. Rp{recovered} kembali. Pertimbangkan berhenti kulakan barang ini." |
| `stopped` | "Rencana dihentikan." |

- Bila barang masih bermasalah, tampil tombol **Buat rencana baru** (menuju state A).
- `lastEnded` ditampilkan sebagai riwayat ringkas di bawah rencana aktif/suggested.

**Error**
- `plan_already_active` → muat ulang data.
- `plan_not_applicable` → "Status barang sudah berubah" → muat ulang.
- `step_invalid_state` → muat ulang.

### 11.3 Bagikan ke WhatsApp (F-18)

1. Tombol membuka bottom sheet berisi textarea `shareText` (bisa diedit) dan penghitung "{n}/500".
2. **Bagikan** membuka `https://wa.me/?text={encodeURIComponent(teks)}` di tab baru. Di Android, tautan ini membuka aplikasi WhatsApp; di desktop, membuka WhatsApp Web.
3. Penerima dipilih pengguna di WhatsApp (BR-18).
4. Bila `navigator.share` tersedia di HP, ada tombol kedua **Bagikan ke aplikasi lain**.
5. Teks yang diedit tidak disimpan ke server, cukup di state lokal.

## 12. Rencana `/toko/rencana` (F-16)

**Sumber:** GET `/plans?state=active` untuk tab **Berjalan**, dan GET `/plans` untuk tab **Riwayat**.

**Kartu rencana:** nama barang, tahap "{currentStep}/3 · {title}", "cek {dueOn}" (merah bila ≤ hari ini), dan progres kas pulih. Ketuk kartu → detail barang `#rencana`.

**Kosong:** "Belum ada rencana berjalan. Pilih barang di **Beranda → Tangani dulu**."

## 13. Hasil `/toko/hasil` (F-16 US-16.2, F-17)

**Sumber:** GET `/results`.

**Isi halaman (urutan):**
1. **Hero:** "Kas pulih dari rencana" `totalRecovered` (besar), lalu "Rp{recovered30d} dalam 30 hari terakhir".
2. **Angka kecil:** "{activeCount} rencana berjalan · {finishedCount} selesai".
3. **Ringkasan minggu lalu:** `latestWeeklySummary`, 3 kalimat, dengan label "Minggu {weekStart}–{weekEnd}".
4. **Daftar per rencana:** nama barang, state, "Rp{recovered} dari Rp{lockedValueAtStart}", dan bar progres.

**Kosong:** "Belum ada hasil. Jalankan satu rencana dulu — hasilnya muncul di sini."

## 14. Import `/toko/import` (F-04, F-08)

Dua tab: **Daftar barang** dan **Penjualan**.

**Langkah (sama untuk kedua tab)**
1. **Unduh template:**
   - Barang: CSV + XLSX dengan kolom `nama_barang, harga_beli, harga_jual, stok, satuan, kategori`, berisi 3 baris contoh (PRD F-04 AC-1).
   - Penjualan: CSV dengan kolom `tanggal, nama_barang, jumlah`.
   - Template berupa file statis di `frontend/public/templates/`.
2. **Pilih file** (`.csv`, `.xlsx`, maks 2 MB). Di-parse di browser:
   - header dicocokkan tanpa memedulikan huruf besar/kecil
   - baris kosong diabaikan
   - lebih dari 500 baris barang atau 5.000 baris penjualan → error lokal "File terlalu besar, pecah jadi beberapa file"
3. **Preview:**
   - POST `mode: preview` → tampil "{validRows} baris siap, {invalidRows.length} baris bermasalah, {skipped} sudah ada".
   - Tabel baris bermasalah: nomor baris (index+2, sesuai baris di Excel) dan pesan.
   - Tab barang punya pilihan duplikat "Lewati" / "Perbarui harga" (`onDuplicate`).
4. **Simpan {validRows} baris:** POST `mode: commit` → "Selesai: {created} dibuat, {updated} diperbarui, {skipped} dilewati".
5. **Unduh baris bermasalah:** CSV dibuat di browser dari baris asli + kolom `alasan` (PRD F-04 AC-3).

**Konversi:** angka dari file boleh berformat "12.500", "Rp12.500", atau "12500". UI mengirim nilainya apa adanya sebagai string, dan server yang memvalidasi.

**Kinerja:** 500 baris barang ≤ 10 dtk; 5.000 baris penjualan ≤ 15 dtk (end-to-end termasuk parsing).

## 15. Pengaturan `/toko/pengaturan` (F-20)

| Bagian | Isi | Validasi | API |
|---|---|---|---|
| Profil toko | Nama toko, jenis, lokasi, tipe pelanggan (kontrol sama dengan §5) | nama 1–60 | PATCH `/store` |
| Aturan status | "Sehat bila laku dalam [14] hari", "Mati bila tidak laku lebih dari [45] hari", "Waspada bila turun [3] minggu berturut-turut", tombol **Kembalikan ke bawaan** | Sehat 7–60, Mati 15–180, Sehat < Mati, Waspada 2–6. Pesan langsung di field | PATCH `/store` (`resetThresholds` untuk bawaan) |
| Saran AI | Toggle "Gunakan AI untuk menyusun saran" (bawaan aktif) + 1 kalimat: "Bila mati, Lakoo memakai saran dasar." | — | PATCH `/store` `{aiEnabled}` |
| Akun | Email (hanya baca; untuk demo tertulis "Akun demo"), tombol **Keluar** | konfirmasi bila outbox berisi (§0.4) | POST `/auth/logout` → `/` |

Perubahan ambang langsung menginvalidasi cache dashboard/produk (PRD F-20 AC-2).

## 16. Tempel teks nota (F-21, Could) — hanya bila T-C1 dijalankan

- Di layar Barang Masuk, tombol **Tempel dari nota** membuka textarea.
- Parser di browser (tanpa AI, tanpa API baru) memecah per baris dengan pola `<nama> <qty> <harga>`.
- Baris yang terbaca mengisi form §8 untuk diperiksa. Baris yang tidak terbaca ditampilkan apa adanya untuk diketik manual.
- Tidak ada yang tersimpan tanpa menekan **Simpan** (PRD US-21.1 AC-1).
