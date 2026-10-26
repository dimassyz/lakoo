# BRIEF KEBUTUHAN PRODUK: Lakoo — Asisten Pintar untuk Inventaris Tokomu

### Untuk diteruskan ke Tech Lead — ditulis dari sudut pandang pemilik bisnis, bahasa manusia

---

## 1. Siapa saya

Saya pemilik toko kelontong. Toko saya menjual sekitar 100 jenis barang — mie, kopi, sabun, sampo, kecap, dan lain-lain. Saya kulakan sendiri ke distributor, kadang seminggu sekali, kadang dua minggu sekali. Saya pakai HP Android. Saya tidak terlalu paham teknologi — kalau aplikasinya ribet, saya tidak akan pakai.

## 2. Masalah saya (dengan kata-kata saya sendiri)

Uang saya sering terasa kurang buat kulakan. Tapi kalau dipikir-pikir, bukan kurang uang — **uangnya kekunci jadi barang yang tidak laku-laku di rak**. Ada kecap yang sudah 3 bulan tidak ada yang beli. Ada sampo yang menumpuk 40 botol. Saya tidak sadar berapa besar uang yang tertidur di situ, karena saya tidak pernah menghitung "barang ini terakhir laku kapan".

Kalaupun saya sadar, saya bingung harus berbuat apa. Diobral berapa? Di-bundling sama apa? Dipindah ke mana? Akhirnya barangnya didiamkan sampai menumpuk terus.

## 3. Yang saya mau dari aplikasi ini

1. **Catat barang dan penjualan dengan gampang.** Tambah barang baru maksimal 1 menit. Catat penjualan kilat (pilih barang → jumlah → simpan, ±30 detik per transaksi) — otomatis mengurangi stok. Kalau bisa import dari file, lebih bagus. **Bonus:** tempel teks nota belanja → sistem yang memecahnya jadi baris-baris barang otomatis.
2. **Dikasih tahu barang mana yang bermasalah — bahkan sebelum bermasalah.** Saya mau buka aplikasi dan langsung lihat: barang apa yang sehat, yang sekarat, yang mati — plus **berapa rupiah uang saya yang terkunci** di masing-masing. Kalau ada barang yang penjualannya melambat 3 minggu berturut-turut, kasih tahu saya duluan ("waspada") sebelum jadi sekarat. Untuk barang sehat, kasih tahu kira-kira berapa hari lagi stoknya habis.
3. **Dikasih saran konkret per barang — yang disusun secara cerdas oleh sistem (pakai teknologi AI) dan kenal toko saya.** Bukan sekadar "barang ini tidak laku", tapi: lakukan ini dulu, kalau tidak berhasil lakukan itu, lalu itu — spesifik untuk tiap barang berdasarkan data toko saya, bukan saran generik yang sama untuk semua barang. Sistem harus tahu toko saya itu warung/toko apa, di mana, pelanggannya siapa — supaya sarannya masuk akal untuk _toko saya_. Tiap saran ada hitungannya (masih untung berapa kalau diskon sekian).
4. **Dikasih ringkasan mingguan.** Tiap Minggu pagi saya mau baca 3 kalimat: apa yang terjadi seminggu ini, barang apa yang butuh perhatian, rencana mana yang selesai.
5. **Bisa menandai barang pelengkap.** Ada barang yang memang saya simpan biar warung kelihatan lengkap walau lakunya kecil. Jangan suruh saya obral barang itu — tapi ingatkan kalau jumlahnya kebanyakan.
6. **Lihat hasilnya.** Setelah saya menjalankan saran, saya mau lihat: berapa kas yang sudah pulih.
7. **Bagikan promo ke pelanggan dengan sekali klik** via WhatsApp.

**Catatan:** ini BUKAN aplikasi kasir. Saya tidak butuh metode bayar, cetak struk, atau diskon otomatis — pencatatan penjualan di sini untuk momen tutup toko, bukan melayani antrean pembeli.

## 4. Yang saya TIDAK mau

- Tidak mau input yang ribet atau banyak field wajib.
- Tidak mau aplikasi yang memaksa — semua saran adalah rekomendasi, saya yang memutuskan.
- Tidak mau data saya hilang atau aplikasi error saat dipakai.
- Tidak mau fitur kedaluwarsa dulu — itu nanti saja.

## 5. Kapan saya memakai aplikasi ini

**Setiap hari:**

- **Tutup toko (±2 menit)** — rekap penjualan hari ini (atau sekalian opname cepat: stok pagi vs stok malam). Ini momen yang sudah jadi kebiasaan: hitung uang laci, sekalian catat di aplikasi.
- **Pagi hari (±1 menit, opsional)** — lirik dashboard sekilas: ada barang yang berubah status? ada tahap rencana yang jatuh tempo hari ini?

**Setiap minggu:**

- **Minggu malam** — kalau tidak sempat rekap harian, rekap seminggu sekaligus (±5–10 menit).
- **Minggu pagi (±10 menit)** — buka dashboard, lihat barang bermasalah, pilih rencana yang mau dijalankan minggu ini, tandai hasil rencana minggu lalu.

**Saat barang datang dari supplier:**

- Catat barang masuk: nama, jumlah, harga (±1 menit per jenis barang).

**Prinsip desain: numpang ritual, jangan bikin ritual baru.**

_Konsepnya (baca dulu sebelum peta di bawah):_ aplikasi untuk pemilik warung kebanyakan mati bukan karena jelek, melainkan karena menuntut kebiasaan baru — "buka aplikasi tiap hari jam 9 pagi untuk input data". Pemilik warung sibuk dan capek; minggu pertama rajin, minggu ketiga aplikasi di-uninstall. Solusinya bukan notifikasi pengingat (akan di-dismiss), melainkan **menempelkan pemakaian aplikasi ke kebiasaan yang sudah ada dan tidak bisa ditawar** — istilahnya _habit stacking_: "setelah [kebiasaan lama], saya akan [perilaku baru]". Analoginya: warteg yang buka di depan gerbang pabrik tidak perlu mencari pelanggan — karyawannya sudah pasti lewat situ tiap jam makan siang. Aplikasi ini wartegnya; ritual harian pemilik warung adalah gerbang pabriknya. Konsekuensi desainnya: (1) setiap fitur wajib punya "ritual tumpangan" — pemicunya adalah ritual itu sendiri, bukan notifikasi aplikasi; (2) durasi numpang harus jauh lebih pendek dari ritual induknya (numpang 2 menit ke ritual 5 menit = oke; numpang 15 menit = ditinggal); (3) layar yang dibuka di momen ritual harus bisa dipahami sekali lirik.

Ini ritual-ritual saya dan cara aplikasi menumpanginya:

1. **Ritual tutup toko (malam hari).** Yang sudah saya lakukan: hitung uang laci, catat pemasukan di buku, kunci toko. → _Aplikasi menumpang:_ tepat setelah saya hitung uang, saya buka aplikasi dan isi rekap penjualan hari ini (±2 menit). Pemicunya: selesai hitung uang. Form-nya harus selesai sebelum saya mengunci toko.
2. **Ritual buka toko (pagi hari).** Yang sudah saya lakukan: buka pintu, cek dagangan/display, siapkan uang kembalian. → _Aplikasi menumpang:_ sambil cek dagangan, saya lirik dashboard ±1 menit — ada barang berubah status? ada tahap rencana yang jatuh tempo? Layarnya harus bisa dipahami sekali lirik (angka besar, warna jelas), bukan dibaca seperti laporan.
3. **Ritual barang datang.** Yang sudah saya lakukan: terima barang dari sales, cek nota, bayar. → _Aplikasi menumpang:_ nota sudah di tangan saya — tinggal salin nama, jumlah, harga ke aplikasi (±1 menit per jenis barang). Form-nya minimal, mengikuti urutan nota.
4. **Ritual Minggu pagi (waktu luang).** Yang sudah saya lakukan: duduk, mikir usaha minggu depan. → _Aplikasi menumpang:_ ringkasan mingguan otomatis ("minggu ini 2 barang baru masuk status sekarat, 1 playbook selesai") + saya pilih rencana minggu ini (±10 menit).

**Aturan mainnya:** setiap fitur baru wajib menjawab tiga hal — _numpang ke ritual nomor berapa, di momen tepatnya kapan, dan berapa lama._ Kalau sebuah fitur butuh ritual baru yang belum ada (misalnya "buka aplikasi tiap 2 jam"), fitur itu gugur.

## 6. Definisi "berhasil" menurut saya

- Saya tahu persis berapa rupiah terkunci di rak saya.
- Saya dapat rencana aksi yang masuk akal untuk tiap barang bermasalah.
- Saya bisa melihat kas pulih setelah menjalankan rencana.
- Aplikasi tidak pernah error saat saya pakai; data tidak pernah hilang.

## 7. Batasan dunia nyata

- Aplikasi adalah karya lomba GTNIC 2026: **harus live, publik, dan bisa didemokan end-to-end pada 10 November 2026**.
- Bahasa Indonesia. Jalan mulus di HP Android (Chrome) dan laptop.
- Satu akun untuk satu toko cukup (saya sendirian).

---

## 8. INSTRUKSI UNTUK TECH LEAD

Berdasarkan brief kebutuhan di atas, hasilkan dokumen-dokumen berikut **secara berurutan**. Setiap dokumen diserahkan untuk direview Dimas sebelum lanjut ke dokumen berikutnya.

### Dokumen yang diminta

1. **BRD** (Business Requirements Document) — kebutuhan bisnis, stakeholder, ruang lingkup (in/out), asumsi, batasan, kriteria keberhasilan bisnis.
2. **PRD** (Product Requirements Document) — persona pengguna, user stories, acceptance criteria per fitur, prioritas MoSCoW, metrik keberhasilan produk.
3. **SPEC** (Technical Specification) — arsitektur sistem, ERD/skema database, API contract, alasan pemilihan tech stack, struktur repo, strategi testing, rencana deploy dan seed data demo.
4. **FSD** (Functional Specification Document) — spesifikasi fungsional per layar/fitur: input, proses, output, validasi, error handling, status/state.
5. **DESIGN.md** — artefak tersendiri (BUKAN bagian SPEC): personality produk, palet warna, tipografi, mood, referensi visual ("suka X, bukan Y"), visual non-goals.
6. **TASKS.md** — breakdown tugas siap eksekusi untuk builder (frontend-dev & backend-dev): urutan prioritas, dependensi antar tugas, definisi selesai per tugas.

### Konvensi engineering yang wajib dipatuhi

- **Contract-first antar profile:** komunikasi via SPEC.md, TASKS.md, dan completion report.
- **Kebutuhan AI (eksplisit):** fitur "saran likuidasi cerdas" WAJIB memakai AI (misalnya LLM via API) — bukan template statis. Syaratnya: (a) saran spesifik per barang berdasarkan data toko, (b) WAJIB ada fallback yang tetap berfungsi bila layanan AI tidak tersedia (demo anti-gagal; internet warung kadang lambat), (c) biaya operasional rendah. Pemilihan pendekatan dan penyedia AI spesifik adalah wewenang tech lead — tuangkan alasan di SPEC.
- **Tech stack:** wewenang penuh tech lead — tentukan best practice-nya dan tuangkan alasannya di SPEC. Preferensi dari sisi bisnis: **hosting gratis** (misalnya Vercel atau sejenisnya). Yang tidak bisa ditawar: aplikasi web responsif (HP Android + desktop), database relasional, live di URL publik, repo publik.
- **Frontend-dev HANYA memakai skill antislop** (core + ui/copywriting/layoutmobile/human). Seluruh arahan desain dituangkan di DESIGN.md + design constraints di SPEC — tulis secara konkret agar output tidak monoton.
- **Release gate SEO/AIO/AEO/GEO** untuk setiap fitur public-facing: tulis di SPEC — indexation map, Lighthouse budgets (Performance/Accessibility/Best Practices/SEO ≥ 90), Core Web Vitals (LCP ≤ 2,5 dtk, INP ≤ 200 ms, CLS ≤ 0,1), metadata strategy, JSON-LD, sitemap.xml, robots.txt, llms.txt. Builder mengimplementasikan, QA memverifikasi.
- **Repo:** struktur rapi (frontend/backend/database/docs), README lengkap, .gitignore benar, **JANGAN pernah commit secrets/.env**; git history bertahap dan bermakna (bukan satu commit raksasa).
- **Standar TM GTNIC 2026:** interaksi database + fitur pintar/otomatisasi yang relevan; alur utama terdemokan end-to-end tanpa error; responsif penuh (desktop/tablet/HP); keamanan dasar (validasi input, lindungi kredensial); website live di URL publik.
- **Data demo:** siapkan generator data sintetis ±90 hari (produk, penjualan, barang masuk) agar mesin deteksi langsung menunjukkan hasil saat demo — jangan demo dengan database kosong.

### Prioritas build (milestone)

- **M1 — Fondasi data:** produk + barang masuk + pencatatan penjualan (form + CSV) + dashboard klasifikasi sehat/sekarat/mati + total modal terkunci.
- **M2 — Kecerdasan:** mesin deteksi (skor prioritas) + playbook AI 3 tahap + fallback template + proyeksi kas pulih.
- **M3 — Aksi & polish:** tandai barang pelengkap + tracking aksi + share WA (wa.me) + generator data demo + dokumentasi + QA rilis.

Mulai dari BRD. Selamat bekerja.
