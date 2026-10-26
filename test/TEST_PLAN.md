# Test Plan — Lakoo (T-11)

|                  |                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| Versi            | 1.0 — 26 Okt 2026                                                                                               |
| Penulis          | qa-engineer (T-11: "Tulis test plan & test cases")                                                              |
| Sumber kebenaran | `docs/FSD.md` 1.0 (FROZEN), `docs/SPEC.md` 1.0 (FROZEN), `docs/api/openapi.yaml` 1.0, `docs/TASKS.md`           |
| Batas file       | `test/`, `e2e/` — tidak menyentuh `src/`, `database/`, config root                                              |
| Status eksekusi  | Suite QA **ALL GREEN 50/50** (QA-01 FIXED & VERIFIED 26 Okt); verdict fitur masih BLOCKED — env/data (lihat §8) |

---

## 1. Scope

Verifikasi bahwa sistem **berjalan** memenuhi acceptance criteria FSD dan
kontrak `openapi.yaml`. Cakupan:

1. **Kontrak data** (SPEC §4.1) — constraint DB sebagai guard tingkat racun.
2. **Semantik domain terukur** (SPEC §4.2 ledger) — bisa diuji tanpa API.
3. **Fixture demo** (SPEC §10.2) — syarat demo juri.
4. **Perilaku per layar** (FSD §0–§16) — API + E2E.
5. **Discoverability** (SPEC §7b) — gate rilis untuk halaman publik.
6. **Skenario wajib delegasi tech-lead** (7 skenario, §6).

Di luar scope T-11: unit domain (§10.3 = backend-dev), kontrak Ajv
(§10.3 = backend-dev), security probe (§10.3 = security-reviewer). QA
memverifikasi ulang secara independen saat lapisan itu ada.

## 2. Entry & exit criteria

**Entry (semua wajib sebelum verdict QA diterbitkan):**

- [ ] Tech-lead review = **APPROVE** untuk PR yang diuji. (PR #1: BELUM)
- [ ] Preview env per PR ada dan sehat. (BELUM ADA)
- [ ] Acceptance criteria tidak ambigu. (Ada 1 adj.: QA-01, §8)
- [ ] Baseline suite hijau di env yang sama.

**Exit (syarat verdict ALL GREEN):**

- [ ] Seluruh kriteria FSD Must/Should terverifikasi di staging.
- [ ] 0 temuan HIGH/CRITICAL terbuka; MEDIUM punya keputusan tech-lead.
- [ ] AC-SYS-1..10 tuntas sesuai §7.
- [ ] Discoverability gate (§7b) lulus di staging URL.
- [ ] Smoke staging pasca-merge hijau.

## 3. Lingkungan & tooling

| Item                | Nilai                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| Runtime test        | Vitest 5 (`test/`), Playwright 1.64 (`e2e/`, menyusul)                        |
| DB test             | PGlite in-process + migrasi asli (`database/src/test/pglite.ts`)              |
| Browser E2E         | Chromium, viewport Pixel 7 (360 px) + desktop 1280 px                         |
| Audit               | Lighthouse CI, axe (`@axe-core/playwright`), Rich Results Test                |
| Perintah suite QA   | `npx vitest run --config test/vitest.config.mts`                              |
| Perintah gate penuh | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` |
| Catatan mesin ini   | `pnpm` rusak (corepack MODULE_NOT_FOUND) → pakai `npx`; node v24.16.0         |

## 4. Arsitektur test (SPEC §10.3) & kepemilikan

| Lapis                         | Alat                               | Pemilik §10.3          | File                                                                      | Status   |
| ----------------------------- | ---------------------------------- | ---------------------- | ------------------------------------------------------------------------- | -------- |
| Kontrak DB (§4.1)             | Vitest + PGlite                    | **qa-engineer (baru)** | `test/schema-contract.test.ts`                                            | ✅ jalan |
| Semantik ledger (§4.2)        | Vitest + PGlite                    | **qa-engineer (baru)** | `test/ledger-semantics.test.ts`                                           | ✅ jalan |
| Fixture demo (§10.2)          | Vitest                             | **qa-engineer (baru)** | `test/demo-fixture.test.ts`                                               | ✅ jalan |
| Invarian stok/uang (§5.8, §7) | Vitest + PGlite + repo layer       | **qa-engineer (baru)** | `test/stock-invariants.test.ts`                                           | ✅ jalan |
| Unit domain (§5)              | Vitest                             | backend-dev            | `backend/src/domain` (belum ada)                                          | ⛔       |
| Integrasi API                 | Vitest + PGlite + `app.request()`  | backend-dev            | `backend/src/http/app.test.ts` (health + guard; endpoint bisnis menyusul) | ⛔       |
| Kontrak Ajv (AC-SYS-7)        | Ajv 2020                           | backend-dev            | —                                                                         | ⛔       |
| Komponen UI                   | Vitest + Testing Library           | frontend-dev           | —                                                                         | ⛔       |
| E2E                           | Playwright                         | qa-engineer            | `e2e/` (menyusul, T-13)                                                   | ⛔       |
| Audit §7b                     | Lighthouse CI + Rich Results + axe | qa-engineer            | `e2e/` (menyusul, T-13)                                                   | ⛔       |
| Security probe §8.7           | black-box staging                  | security-reviewer      | —                                                                         | ⛔       |

## 5. Coverage matrix — FSD §0–§16

Legenda: ✅ dieksekusi & lulus · 🔴 dieksekusi & gagal (temuan) · ⛔ blocked
(butuh API/app/staging — lihat §8)

### FSD §0 Perilaku global

| #   | Kriteria                                                                                                                                                                                                                                                                                                                                                                                | Test                                 | Lapis / file                    | Status |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------- | ------ |
| 0.1 | Nav 5 item HP; sidebar desktop; header nama toko + tanggal WIB; pita demo                                                                                                                                                                                                                                                                                                               | E2E-SHELL                            | Playwright                      | ⛔     |
| 0.1 | Guard: tanpa sesi `/toko/*` → `/masuk?lanjut=`; ada sesi `/masuk` → `/toko`; `onboarded=false` → `/mulai`                                                                                                                                                                                                                                                                               | E2E-AUTH (skenario #7)               | Playwright                      | ⛔     |
| 0.2 | State: skeleton (total dulu), kosong (1 kalimat + 1 aksi), error muat + "Coba lagi" + cache, pita offline                                                                                                                                                                                                                                                                               | E2E-STATE                            | Playwright                      | ⛔     |
| 0.3 | `validation_error` → pesan per field + fokus; `unauthenticated` → redirect + outbox utuh; `bad_origin`/`forbidden_demo` → toast; `not_found` → layar khusus; `rate_limited` → toast dari `Retry-After`; `internal_error` → toast; `error.lines` → baris merah + "{n} baris perlu dicek"; tidak ada kode mentah                                                                          | API-ERR + E2E-ERR                    | API + Playwright                | ⛔     |
| 0.4 | Outbox: UUID v4 = `Idempotency-Key`; siman IndexedDB sebelum kirim; 2xx hapus; 422 `needs_review`; 401 simpan + kirim ulang setelah login; jaringan/5xx/timeout 15 dtk `pending`; retry `online`/load/30 dtk; backoff 30 dtk→1→2→5→10 mnt; id sama saat retry; badge "{n} belum terkirim"; `needs_review` Buka & perbaiki / Buang + konfirmasi; logout konfirmasi, outbox tidak dihapus | E2E-OUTBOX (skenario #2, AC-SYS-3)   | Playwright `context.setOffline` | ⛔     |
| 0.5 | Format: `Rp12.500` tanpa desimal; `−Rp1.200`; tanggal panjang/pendek; "12 pcs"; `inputmode=numeric`; kirim integer                                                                                                                                                                                                                                                                      | TC-FMT                               | komponen (frontend) + E2E spot  | ⛔     |
| 0.6 | 5 status: label + ikon + kalimat bantu; tidak hanya warna                                                                                                                                                                                                                                                                                                                               | DOM-STATUS (skenario #3) + E2E-LABEL | domain (backend) + E2E          | ⛔     |

### FSD §1–§5 Marketing, auth, onboarding

| #   | Kriteria                                                                                                                                                     | Test                    | Lapis / file                 | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ---------------------------- | ------ |
| 1   | Landing: hero copy; "Coba akun demo" (disabled + "Menyiapkan toko contoh…"); 429 & 503 punya pesan sendiri; angka statis; 3 langkah; definisi; FAQ 5; footer | E2E-LANDING             | Playwright                   | ⛔     |
| 1   | SEO & discoverability halaman publik                                                                                                                         | AUD-SEO (§7b)           | Lighthouse CI + Rich Results | ⛔     |
| 2   | `/privasi`: isi statis + `CONTACT_EMAIL`                                                                                                                     | E2E-PRIVASI             | Playwright                   | ⛔     |
| 3   | Daftar: nama 1–60, email format, sandi 8–72 + tampilkan; 201 → `/mulai`; `email_taken` → pesan + field lain tetap; state tombol; Enter                       | API-AUTH + E2E-DAFTAR   | API + Playwright             | ⛔     |
| 4   | Masuk: `lanjut` hanya path internal `/toko`; `invalid_credentials` generik + sandi dikosongkan; 429; tanpa alur reset                                        | API-AUTH + E2E-MASUK    | API + Playwright             | ⛔     |
| 5   | Onboarding 3 pertanyaan opsional; "Simpan & mulai" & "Lewati dulu" → PATCH `/store` → `/toko`; kartu `profileComplete`                                       | API-STORE + E2E-ONBOARD | API + Playwright             | ⛔     |

### FSD §6–§8 Ritual inti (rekap & barang masuk)

| #   | Kriteria                                                                                                                                                                                                                                  | Test                                | Lapis / file                   | Status |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------ | ------ |
| 6   | Beranda: hero `lockedValue`; 4 ubin → `/toko/barang?status=`; baris stok habis; "Hari ini" ≤5 baris; ringkasan minggu hanya Minggu/Senin; `topPriority` ≤3; `restockSoon` ≤10; pelengkap kebanyakan; empty state; FAB; hero ≤ 3 dtk di 4G | API-DASH + E2E-BERANDA + AUD-PERF   | API + Playwright + LHCI        | ⛔     |
| 7   | Rekap: tanggal ≤ hari ini & ≥ 365 hari; label "Sudah ada rekap…"; tab + localStorage; cari lokal; urutan API                                                                                                                              | API-RECAP + E2E-REKAP               | API + Playwright               | ⛔     |
| 7   | **Quantity**: stepper; validasi `qty > currentStock + recordedQty` → merah + "Perbaiki stok" → POST stock-adjustments → reload; hanya baris berubah dikirim; "Belum ada perubahan" disabled                                               | API-RECAP (skenario #1) + E2E-REKAP | API + Playwright               | ⛔     |
| 7   | **Opname**: sold = morning + masuk − sisa; sold < 0 → merah + simpan disabled; baris kosong tidak dikirim                                                                                                                                 | API-RECAP (skenario #1) + E2E-REKAP | API + Playwright               | ⛔     |
| 7   | Simpan via outbox; toast "{totalSold} barang, Rp{totalRevenue}"; ≤3 perubahan status; 422 `error.lines` sesuai urutan; target ±10 barang ≤ 2 menit                                                                                        | E2E-REKAP + API-RECAP               | API + Playwright               | ⛔     |
| 7   | Mekanisme "ganti, bukan tambah" di tingkat data: `unique(product_id, sale_date)`; `qty > 0` (qty 0 = hapus)                                                                                                                               | TC-DB-2x                            | `test/schema-contract.test.ts` | ✅     |
| 8   | Barang masuk: tanggal ≤ 365; baris + "+ Tambah baris"; kombobox urut `frequent`; qty ≥ 1; `lastCost` + info >20%; `newProduct` + harga jual wajib; footer total; baris kosong diabaikan; duplikat diperbolehkan                           | API-STOCKIN + E2E-BMK               | API + Playwright               | ⛔     |
| 8   | POST `/stock-ins` via outbox; riwayat 30 hari; Ubah/Hapus ≤ 7 hari; `edit_window_closed`; `insufficient_stock`                                                                                                                            | API-STOCKIN + E2E-BMK               | API + Playwright               | ⛔     |
| 8   | Constraint `stock_ins`: qty ≥ 0 (opening 0 boleh), unit_cost ≥ 0, enum `kind`                                                                                                                                                             | TC-DB-3x                            | `test/schema-contract.test.ts` | ✅     |

### FSD §9–§13 Barang, rencana, hasil

| #    | Kriteria                                                                                                                                                                                                                                                                                  | Test                                | Lapis / file                   | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------ | ------ |
| 9    | Daftar: cari, chip status, toggle arsip, query string; baris HP; tabel desktop + sort klien; empty                                                                                                                                                                                        | E2E-BARANG                          | Playwright                     | ⛔     |
| 10   | Tambah/ubah: nama 1–80; harga 0–100 jt; stok 0–100.000; unit ≤16; kategori ≤40; pelengkap toggle; "Simpan & tambah lagi"; `duplicate_product_name` + tautan; ≤ 1 menit                                                                                                                    | API-PRODUCTS + E2E-PRODUCT          | API + Playwright               | ⛔     |
| 10   | Constraint `products`: partial unique nama aktif, panjang, harga ≥ 0                                                                                                                                                                                                                      | TC-DB-5x                            | `test/schema-contract.test.ts` | ✅     |
| 11   | Detail: ringkasan + kalimat bantu; grafik 8 minggu; aksi Ubah/Perbaiki stok/pelengkap/Arsipkan + konfirmasi; info overstock + `complementaryMaxStock`                                                                                                                                     | API-PRODUCTS + E2E-DETAIL           | API + Playwright               | ⛔     |
| 11.2 | Rencana tampil hanya waspada/sekarang/mati non-pelengkap; State A loading ≤ 15 dtk; State B 3 kartu + hitungan + "Jalankan"/"Buat ulang" + konfirmasi; State C kas pulih + progres + apply-price + konfirmasi + outcome + konfirmasi + stop + konfirmasi; State D 4 pesan; error → reload | API-PLANS (skenario #4) + E2E-PLANS | API + Playwright               | ⛔     |
| 11.3 | WA: sheet + textarea + "{n}/500"; `https://wa.me/?text=` tab baru; tombol share native bila ada; edit lokal saja                                                                                                                                                                          | E2E-SHARE                           | Playwright                     | ⛔     |
| 11   | Constraint rencana: 1 rencana hidup per produk; step 1–3 unik; panjang teks; duration 3–21; diskon 0–50; below_cost 5–50; rationale ≤ 200                                                                                                                                                 | TC-DB-8x                            | `test/schema-contract.test.ts` | ✅     |
| 12   | `/toko/rencana`: tab Berjalan/Riwayat; kartu "cek {dueOn}" merah bila ≤ hari ini; empty state                                                                                                                                                                                             | E2E-RENCANA                         | Playwright                     | ⛔     |
| 13   | `/toko/hasil`: hero `totalRecovered` + `recovered30d`; angka kecil; ringkasan minggu; daftar per rencana; empty                                                                                                                                                                           | API-RESULTS + E2E-HASIL             | API + Playwright               | ⛔     |

### FSD §14–§16 Import, pengaturan, tempel nota

| #   | Kriteria                                                                                                                                                                                                                                                                                | Test                                  | Lapis / file                   | Status        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------ | ------------- |
| 14  | Import: template unduh; header case-insensitive; baris kosong diabaikan; >500 barang / >5.000 penjualan → error lokal; preview count; tabel bermasalah index+2; `onDuplicate`; commit count; unduh CSV bermasalah; format angka "12.500"/"Rp12.500"; perf 500 ≤ 10 dtk / 5.000 ≤ 15 dtk | API-IMPORT (skenario #5) + E2E-IMPORT | API + Playwright               | ⛔            |
| 15  | Pengaturan: profil PATCH; ambang (Sehat 7–60, Mati 15–180, Sehat < Mati, Waspada 2–6) + "Kembalikan ke bawaan"; toggle AI; email read-only / "Akun demo"; Keluar + konfirmasi outbox; perubahan ambang invalidasi cache                                                                 | API-STORE + E2E-PENGATURAN            | API + Playwright               | ⛔            |
| 15  | Constraint `stores`: nama 1–60, lokasi ≤ 80, ambang + relasi + rentang                                                                                                                                                                                                                  | TC-DB-6x                              | `test/schema-contract.test.ts` | ✅            |
| 16  | Tempel nota (F-21, Could — hanya bila T-C1): parser `<nama> <qty> <harga>`; baris tak terbaca ditampilkan; tidak ada simpan tanpa tombol                                                                                                                                                | TC-PARSER + E2E-TEMPEL                | komponen + Playwright          | ⛔ (deferred) |

| §5.8 | BR-16: qty > stok → 422 `insufficient_stock` + all-or-nothing; rekap berikutnya dievaluasi terhadap stok TERKINI (backdated tidak boleh membuat stok(today) negatif) | TC-INV | `test/stock-invariants.test.ts` | ✅ |
| §7 | W-9: rekaman idempotensi ≤ 7 hari diputar balik; > 7 hari diproses ulang (batas = cleanup cron) | TC-INV | `test/stock-invariants.test.ts` | ✅ |
| W-2 | deleteStockIn: hapus yang membuat stok negatif ditolak 422 + baris tetap ada (all-or-nothing); editable = kind `purchase` + umur `created_at` ≤ 7 hari; lewat window → 409 `edit_window_closed` (FSD §8) | TC-INV | `test/stock-invariants.test.ts` | ✅ |

### Kontrak data & fixture (di luar FSD per layar)

| #     | Kriteria                                                                                                                                                                                                                                                                                              | Test                   | Lapis / file                                    | Status            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------- | ----------------- |
| §4.1  | `users`: email unik citext; `password_hash` nullable demo                                                                                                                                                                                                                                             | TC-DB                  | `test/schema-contract.test.ts`                  | ✅                |
| §4.1  | `weekly_summaries` tepat 3 kalimat; `idempotency_keys` PK (store, key); cascade hapus toko                                                                                                                                                                                                            | TC-DB                  | `test/schema-contract.test.ts`                  | ✅                |
| §4.1  | `stock_adjustments.qty_delta ≠ 0`; `daily_sales.unit_price ≥ 0`                                                                                                                                                                                                                                       | TC-DB                  | `test/schema-contract.test.ts`                  | ✅                |
| §4.2  | stok(asOf) = Σins − Σsales + Σadj dengan cutoff tanggal; baris setelah asOf tidak dihitung; asOf berbeda → stok berbeda                                                                                                                                                                               | TC-LED                 | `test/ledger-semantics.test.ts`                 | ✅                |
| §4.2  | `last_cost` tie-break `created_at DESC`; `first_stock_date` MIN(qty>0) + fallback `created_at` WIB; `week_qty` 7 jendela (SPEC §4.2; permintaan ubah ke 8 DIBATALKAN tech-lead 26 Okt — instruksi basi); `sold_28`/`sale_days_28`/`sold_90`; arsip & lintas toko terisolasi; stok mentah bisa negatif | TC-LED                 | `test/ledger-semantics.test.ts`                 | ✅                |
| §4.2  | **last_cost mengikuti cutoff asOf** (TEMUAN QA-01 — FIXED & VERIFIED 26 Okt; guard hijau karena IMPL benar)                                                                                                                                                                                           | TC-LED                 | `test/ledger-semantics.test.ts`                 | ✅                |
| §10.2 | Profil toko demo; ±100 barang; riwayat ≤ 90 hari; **akhir pekan lebih ramai**; rencana active mulai 10 hari lalu                                                                                                                                                                                      | TC-DEMO                | `test/demo-fixture.test.ts`                     | ✅                |
| §10.2 | Distribusi status, kasus brief, determinisme, stok non-negatif                                                                                                                                                                                                                                        | (sudah)                | `database/src/demo/generator.test.ts` (backend) | ✅ (pemilik lain) |
| §8.1  | Sesi & cookie (`HttpOnly; Secure; SameSite=Lax`), argon2id, token hash di DB                                                                                                                                                                                                                          | API-AUTH + SEC         | API + security                                  | ⛔                |
| §8.4  | Rate limit: login 5/15 mnt (IP+email); register 5/jam; demo 10/jam; plans 20/hari; imports 20/jam; lain 300/mnt; 429 + `Retry-After`                                                                                                                                                                  | API-RATE (skenario #6) | API + E2E                                       | ⛔                |

## 6. Skenario wajib delegasi tech-lead

| #   | Skenario                 | Pemetaan test                                                           | Status          |
| --- | ------------------------ | ----------------------------------------------------------------------- | --------------- |
| 1   | Rekap quantity vs opname | API-RECAP + E2E-REKAP; guard data TC-DB (unique + qty>0)                | ⛔ / ✅ parsial |
| 2   | Outbox retry (FSD §0.4)  | E2E-OUTBOX offline (AC-SYS-3, KS-5)                                     | ⛔              |
| 3   | Status barang 5 state    | DOM-STATUS (backend) + E2E-LABEL; distribusi via TC-DEMO + test backend | ⛔ / ✅ parsial |
| 4   | Rencana 3 tahap          | API-PLANS + E2E-PLANS; guard data TC-DB (action_plans/plan_steps)       | ⛔ / ✅ parsial |
| 5   | Import preview/commit    | API-IMPORT + E2E-IMPORT                                                 | ⛔              |
| 6   | Rate limit               | API-RATE (429 + `Retry-After`)                                          | ⛔              |
| 7   | Auth redirect            | E2E-AUTH (guard rute FSD §0.1)                                          | ⛔              |

## 7. AC-SYS (SPEC §8b)

| ID        | Kriteria                                                                                         | Pemetaan                        | Status |
| --------- | ------------------------------------------------------------------------------------------------ | ------------------------------- | ------ |
| AC-SYS-1  | Semua AC PRD Must+Should lolos di staging                                                        | E2E staging run                 | ⛔     |
| AC-SYS-2  | Alur demo BRD §11 3× di 360 px & 1280 px, 1 putaran `ai_enabled=false`                           | E2E-DEMO                        | ⛔     |
| AC-SYS-3  | Outbox: offline → 3 simpanan → online → tepat 3 tersimpan tanpa duplikat                         | E2E-OUTBOX                      | ⛔     |
| AC-SYS-4  | Unit domain §5 lulus; cakupan `domain` ≥ 90%                                                     | backend lane                    | ⛔     |
| AC-SYS-5  | IDOR lintas toko → 404 untuk setiap endpoint ber-`{id}`                                          | API-IDOR                        | ⛔     |
| AC-SYS-6  | Lighthouse landing ≥ 90 ×4 (mobile+desktop); Beranda a11y ≥ 90 mobile                            | AUD-LHCI                        | ⛔     |
| AC-SYS-7  | Respons sesuai openapi.yaml (Ajv 2020)                                                           | backend lane                    | ⛔     |
| AC-SYS-8  | Gate CI hijau di `main`                                                                          | devops (PR #1 merah)            | ⛔     |
| AC-SYS-9  | Security review tanpa HIGH/CRITICAL terbuka                                                      | security-reviewer (T-12)        | ⛔     |
| AC-SYS-10 | Toko demo memenuhi PRD F-02 AC-2/3 tiap hari setelah cron; QA cek 3 hari berturut sebelum 10 Nov | AUD-DEMO-DAILY (skrip menyusul) | ⛔     |

## 8. Status eksekusi & temuan

### 8.1 Hasil run (26 Okt 2026)

Catatan: repo **aktif berubah** selama task ini berjalan (snapshot v3–v5
masuk: T-9 backend API, migrasi 0001, mount route). Angka terakhir mengacu
state working tree 26 Okt 2026 ±12:00 WIB, setelah fix QA-01 mendarat.

```
Suite QA (npx vitest run --config test/vitest.config.mts) — 26 Okt 2026, terakhir:
  Test Files  4 passed (4)
  Tests      55 passed (55)   ← ALL GREEN (50 + 5 invarian stok/uang)
```

Riwayat: 49/50 (guard QA-01 RED) → fix CTE `lc`+`fs` mendarat →
**50/50 ALL GREEN**, diverifikasi lewat protokol §9 (guard hijau karena
IMPL benar, bukan fixture berubah) → +5 test invarian (BR-16 ×2, W-9,
W-2 jalur delete: 422 stok + 409 window) → **55/55**.

Suite penuh repo (`npx vitest run`, config root): **480 passed (39 file)**
— diukur di branch lokal `1a49232` (tree saat verifikasi §9 fast-follow).
**State FINAL canonical (devops-verified, PR #7): 484/484 (40 file)** —
termasuk `lockProbe.test.ts`; eslint 0, tsc 0, prettier bersih. Dua angka
berbeda karena dua tree berbeda; canonical = state final.
Riwayat angka gate root: 18 (awal) → 28 → 291/291 (snapshot v6, QA masuk
gate) → 444/444 → 473/473 → 477/477 → 480/480 (branch verifikasi §9) →
**484/484 (state final, PR #7)** (repo bertambah; kuverifikasi ulang
26 Okt).

Perf test `productStats.test.ts` (≤ 300 ms) — riwayat karakterisasi:

- Lokal, paralel: 678.4 ms → 302.3 ms → <300 ms (noise floor mesin ini)
- Setelah `fileParallelism: false` (commit `15aa143`, gate serial):
  **3+ run berturut-turut hijau**, backend-dev mengukur 444/444.
- **Putusan tech-lead (26 Okt 2026): threshold TIDAK diubah**; CI
  (ubuntu-latest, box bersih) adalah pengukuran yang sah. CI hijau →
  threshold bertahan; CI merah → backend-dev investigasi query
  plan/index, bukan melonggarkan threshold.
- Aturan pencatatan (kesepakatan backend-dev + tech-lead): kegagalan
  lokal sekali-sekali **tidak** dicatat sebagai temuan flaky selama belum
  terlihat gagal di runner bersih; kalau gagal di CI → sinyal nyata,
  backend-dev yang perbaiki.
- Item verifikasi CI: lihat QA-04 di bawah.

**Kompatibilitas environment (26 Okt 2026):** suite QA diverifikasi hijau
di `node` (config sendiri) **dan** di `jsdom` (simulasi root config +
`setupFiles`) → **terkonfirmasi di gate nyata**: 3 file QA lulus apa
adanya di root gate (444/444, 34 file).

### 8.2 Temuan

**QA-01 — MEDIUM — `productStats` CTE `lc` mengabaikan cutoff `asOf`**

- Lokasi: `database/src/queries/productStats.ts` (CTE `lc`, ± baris 98–103)
- Fakta: dengan asOf historis (mis. `week_end` minggu lalu, SPEC §5.9),
  `lastCost` memakai `unit_cost` dari `stock_ins` yang `received_on`-nya
  SETELAH asOf. Terverifikasi: asOf−5 dengan barang masuk asOf−10 (Rp3.000)
  dan asOf−2 (Rp9.999) → `lastCost` = 9.999 (seharusnya 3.000).
- Dampak: `locked_value` historis (ringkasan mingguan §5.9, perbandingan
  "naik/turun") bisa memakai harga beli yang belum berlaku pada tanggal itu.
  Untuk asOf = hari ini tidak terpapar (API melarang `receivedOn` masa
  depan, SPEC §8.2) — tapi asOf historis adalah jalur nyata.
- Kontrak: SPEC §4.2 menaruh "harga beli terakhir" dalam query stats
  per-asOf; CTE `ins` sudah memfilter, `lc` belum → tidak konsisten.
- Guard: `test/ledger-semantics.test.ts` → "cutoff asOf untuk harga beli
  terakhir (TEMUAN QA-01)" — **RED sampai diperbaiki**.
- **Adjudikasi tech-lead (26 Okt 2026): KONFIRMASI** — SPEC §4.2 adalah
  agregat as-of; setiap turunan wajib mengikuti cutoff asOf. Untuk asOf
  historis, `lastCost` harus harga beli terakhir **pada saat itu**, bukan
  harga terkini. CTE `lc` wajib memfilter `received_on <= asOf`; untuk
  asOf = hari ini hasilnya identik sehingga fix aman untuk tampilan saat
  ini. Di-assign ke backend-dev. Guard tetap RED sampai fix mendarat —
  itu perilaku gate yang benar.
- **RESOLUSI (26 Okt 2026): FIXED & VERIFIED — guard hijau.** Diff asli
  diperiksa (4+/4−): CTE `lc` **dan** `fs` (bonus, cacat sama:
  `MIN(received_on)` tanpa cutoff) kini memfilter
  `received_on <= as_of.d`. Guard lulus karena IMPL benar, bukan fixture
  berubah (protokol §9): fixture identik (asOf−10 Rp3.000 + asOf−2
  Rp9.999, query asOf−5 → 3.000), test tetangga hijau, suite 50/50.

**QA-02 — LOW (config, bukan kode) — `vitest.config.mts` root tidak
memasukkan `test/**`**

- Fakta: `include` root hanya `src/**`, `backend/**`, `database/**`, jadi
  `pnpm test` (CI) tidak pernah menjalankan suite QA di `test/`.
- Mitigasi sementara: `test/vitest.config.mts` (milik qa-engineer) +
  perintah `npx vitest run --config test/vitest.config.mts`.
- **Keputusan tech-lead (26 Okt 2026): DITUNDA sampai suite QA 50/50
  hijau.** Urutan: backend-dev fix QA-01 → suite QA ALL GREEN → QA lapor →
  tech-lead approve `test/**` masuk `include` root → devops menerapkan.
  QA tidak menyiapkan patch config root; `test/vitest.config.mts` cukup
  untuk iterasi sampai approval.
- **UPDATE (26 Okt 2026): APPROVAL DIBERIKAN** — tech-lead menyetujui
  `test/**` upon ALL GREEN, dan ALL GREEN sudah dilaporkan (suite 50/50).
- **TERTUTUP (26 Okt 2026): include DITERAPKAN & test/ DI-SNAPSHOT** —
  commit `c177b5f` (snapshot v6): `test/**/*.{test,spec}.{ts,tsx}` masuk
  `include` root `vitest.config.mts`; 5 file `test/` masuk PR #1.
  Diverifikasi QA sendiri: root gate `npx vitest run` → **291 passed
  (21 file), exit 0** — termasuk 50 test QA. Gate CI kini menjalankan
  suite QA; QA-02 selesai.

**QA-04 — W-10 dari security review — perf test CI: SISTEMATIS DI AMBANG
(fail 2-of-3), arbitrase pertama ADA (update 26 Okt 2026)**

- Item: konfirmasi perilaku perf test `productStats.test.ts` (≤ 300 ms) di
  CI. Putusan tech-lead: threshold TIDAK diubah; kalau CI merah →
  backend-dev investigasi query plan/index, **bukan** longgarkan threshold.
- Sejarah gate (kuverifikasi sendiri via GitHub API):
  - Sampai 26 Okt pagi: 20/20 run merah, semuanya di **Format check**
    (8 file non-QA) — step Test belum pernah tercapai.
  - **Run 24 (sha `b08e9dd`, 09:26Z): merah TEPAT di step Test** — perf
    test 337,8 ms > 300 ms (angka dari log run via tech-lead/backend-dev).
  - Run 25 (sha `734df56`, 09:48Z): semua step hijau, run cancelled
    (superseded push).
  - **Run 29 (sha `1303608`, 09:55Z): gate penuh HIJAU** — Format, Lint,
    Type check, **Test**, Build, gitleaks semua success. Perf test HIJAU.
  - **Run 31 (sha `e3862de`, 10:00Z): merah TEPAT di step Test** — perf
    test 332,4 ms > 300 ms (step-level kuverifikasi via API; angka dari
    log run).
  - **Setelah merge PR #1 & #2 ke `main`**: run 38 (`18333b2`, merge PR #1)
    merah; **run 40 (`728c2e5`, merge PR #2 — docs disk-only) HIJAU**;
    **run 42 (`93a977a`, main) MERAH LAGI di step Test** → pola fail-2-of-3
    berlanjut di main (`18333b2` FAIL → `728c2e5` PASS → `93a977a` FAIL).
    Pola bergantian terus berjalan di main; hijau bukan penutupan risiko.
  - **PENUTUP (26 Okt 2026, kuverifikasi via API):** PR #6 (`f973f03` —
    menambah `postgres:16` **service container** ke workflow CI) dan PR #5
    (`9efe586` — W-2 lock + W-4 + **perf kandidat 2** `COUNT(sale_date)`)
    mendarat di main → **run 46 PASS, run 47 PASS — dua hijau
    berturut-turut**. Pola fail-2-of-3 berhenti setelah kedua perbaikan.
  - **KOREKSI ATRIBUSI (26 Okt 2026, hasil tantangan backend-dev — BENAR,
    catatan lamaku salah):** perf test di main **masih PGlite**, BUKAN
    native. Kuverifikasi di `origin/main`: `productStats.test.ts` import
    `createTestDb` dari `../test/pglite.ts`, dan `git grep PERF_DATABASE_URL`
    di `database/`+`backend/` = **nol pembaca**. Service container PR #6
    JALAN TAPI IDLE — lingkungan disiapkan, pengukuran belum pindah (harness
    switch = PR backend-dev menyusul). **Jadi tidak ada confound lingkungan:
    run 46 & 47 dua-duanya PGlite, sama seperti run merah.**
  - **Konsekuensi jujur untuk klaim kandidat 2:** run 46 hijau **SEBELUM**
    kandidat 2 mendarat (di PGlite) → salah satu hijau itu explainable sebagai
    coin flip pola fail-2-of-3. Bukti efek kandidat 2 = n=1 (run 47), dan
    dengan prior fail-2-of-3, dua hijau berturut-turut BELUM jadi bukti
    kuat query-nya diberi headroom. Yang bisa dikatakan: pola berhenti;
    angka headroom kandidat 2 menunggu pengukuran satu-variabel atau angka
    native pertama dari harness PR. Kalau perf merah setelah harness merge,
    kandidat tersangka pertama = jalur native yang belum pernah dijalankan
    (bukan query) — sesuai keputusan ownership backend-dev.
  - **Mode kegagalan KEDUA yang teramati: Format check** (run 43,
    `b7930e3`, branch `chore/readme-refresh`): merah di step PERTAMA —
    step Test tidak tercapai. Ini pola yang sama dengan era 20/20 (file
    non-QA). Artinya ada dua mode kegagalan gate: (1) perf test di step
    Test (fail-2-of-3), (2) format check file non-QA yang menahan step
    Test sebagai "sandera". Backend-dev mengamati hal sama dan menyarankan
    partisi format check (frontend-gate vs backend-gate) supaya step Test
    backend tidak ikut sandera — **usulan ke devops, belum ada keputusan**;
    dicatat di sini sebagai observasi proses dengan bukti (run 43).
  - **Pola lengkap: `b08e9dd` FAIL (337,8) → `1303608` PASS (outlier) →
    `e3862de` FAIL (332,4) = fail 2-of-3.** Karakterisasi tech-lead:
    **sistematis di atas ambang, bukan flake sekali-jadi** — query hidup
    tepat di threshold dan sensitif kecepatan runner. Di main:
    `18333b2` FAIL → `728c2e5` PASS (pola bergantian berlanjut).
- Koreksi atribusi: kegagalan 337,8 ms ada di run `b08e9dd` (step Test
  merah), **bukan** `734df56` seperti dikutip — `734df56` semua step hijau.
- Mitigasi (keputusan tech-lead): **jalur utama = backend-dev optimasi
  query** (target headroom nyata, bukan ambang); jaring sekunder =
  `retry: 1` khusus test itu + komentar karakteristik ambang di file test.
- **Trigger verifikasi ulang:** kalau run CI berikutnya merah TEPAT di perf
  test itu saja → noise yang dikenal (retry menyerap), **BUKAN regresi**.
  Regresi = merah dua kali berturut-turut. Owner observasi: qa-engineer
  (via API/devops).

**QA-03 — LOW (dokumen) — DITUTUP 26 Okt 2026**

- Keputusan tech-lead: repo TIDAK disusun ulang. SPEC §3.2 sudah
  diamendemen 26 Okt 2026: flat root + Pages Router, kode backend di
  `backend/`, mount API di `src/pages/api/[...route].ts`. Acuan = SPEC §3.2
  - amendemen + `docs/PROJECT_LOG.md`. Section "Repo layout" di AGENTS.md
    stale, tapi file itu tidak dapat diedit dari sesi ini (diblokir sistem) —
    SPEC yang berlaku. Tidak ada blok; `e2e/` tetap di root sesuai SPEC §3.2.

### 8.3 Blocker eksekusi (mengapa belum ada verdict)

| Blocker                | Detail                                                                                                                                                                                        | Pembuka                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Review gate            | PR #1 CI merah, tech-lead review ≠ APPROVE                                                                                                                                                    | tech-lead + devops         |
| Preview env            | Belum ada URL preview/staging (T-13 blocked sampai app landing)                                                                                                                               | devops (T-13)              |
| Aplikasi belum lengkap | Frontend 7 file (4 halaman, 3 komponen); `backend/src/http` (Hono + guard Origin + error envelope) ada tapi belum di-commit; domain layer & endpoint bisnis (recap, plans, imports) belum ada | frontend-dev + backend-dev |

**Update 26 Okt 2026:** QA-01 sudah FIXED & VERIFIED (guard hijau, suite
50/50); baris blocker "Fix QA-01" ditutup. Sisa blocker di atas tetap:
verdict fitur = BLOCKED — env/data (review ≠ APPROVE, preview env belum
ada, aplikasi belum lengkap). Suite QA sendiri: **ALL GREEN**.

## 9. Rencana susulan (setelah unblock)

1. **Fix QA-01 mendarat** (backend-dev) → verifikasi guard hijau **karena
   IMPL benar, bukan fixture berubah** (instruksi tech-lead 26 Okt 2026):
   (a) fixture guard tidak berubah — stock-in asOf−10 (Rp3.000) + asOf−2
   (Rp9.999), query asOf−5 → `lastCost` = 3.000;
   (b) inspeksi diff `database/src/queries/productStats.ts` — filter
   `received_on <= asOf` ditambahkan di CTE `lc`, bukan workaround/
   pelemahan test;
   (c) test tetangga tetap hijau (stok cutoff = 50, tie-break lastCost
   4.000, suite 50/50) → lapor ALL GREEN ke tech-lead + devops →
   tech-lead approve `test/**` masuk include root → devops menerapkan
   config + snapshot `test/` (QA-02). CODE_STANDARDS §7c: melemahkan
   aturan demi gate hijau = defect, bukan fix.
2. **Staging URL dari T-13** → baru mulai `e2e/`: config Playwright
   (Pixel 7 + 1280), spec per §5 (auth, rekap qty/opname, outbox offline,
   import, plans, share WA, NOINDEX), skrip audit Lighthouse CI + axe +
   Rich Results. **Jangan mulai sebelum URL ada.**
   Black-box di staging (Neon = Postgres native, konkurensi nyata) —
   kesepakatan devops, tercatat 26 Okt:
   - **Probe konkurensi**: dua operasi bersamaan di jalur delete/patch/recap
     produk yang SAMA. PGlite single-writer tidak bisa mengukur ini (batas
     lingkungan pengukuran, BUKAN bukti aman) — guard W-2/urutan lock hanya
     terbukti di Postgres bersengkala sungguhan.
   - Rate-limit absence (sudah di checklist black-box devops).
3. **API layer lengkap** → verifikasi kontrak (Ajv) & IDOR matrix; smoke
   post-merge di staging.
4. **Cron/demo** → skrip cek harian AC-SYS-10 (3 hari berturut sebelum 10 Nov).
5. Setiap temuan diperbaiki → QA verifikasi ulang (bukan Developer's test).
6. **PROTOKOL WORKING TREE (tech-lead via devops, 26 Okt 2026) —
   SELESAI:** sampai backend-dev kirim sinyal **STATE FINAL** untuk WIP
   mereka, run suite/gate di window mid-edit menghasilkan artefak merah
   palsu (insiden 19:43). **STATE FINAL sudah masuk** (PR #7 landed:
   `lockProbe.test.ts` + komentar `productStats` final) → protokol
   **terangkat**, run suite/gate boleh lagi. Verifikasi §9 fast-follow
   tetap berlaku: snapshot (**PR #5, commit `b0e1b76` → squash-merge ke
   main sebagai `9efe586`**; anchor verdict = **content**, terverifikasi di
   main: `COUNT(sale_date)` ×2, lockProduct ×3, 6 file `test/` lengkap
   dengan 5 test invarian). Catatan: branch lokal `chore/landing-1.0`
   (`1a49232`) di belakang main; angka gate selalu ditulis dengan sebutan
   tree-nya — canonical = `origin/main`.
7. **Perf kandidat 3 (bentuk array) — syarat §9 eksplisit:** kalau mendarat,
   ekuivalensi `week_qty` harus **DIBUKTIKAN**, bukan cuma "hijau":
   batas jendela 7 hari per indeks (`[k] = [asOf−(7k+6), asOf−7k]`),
   cutoff as-of, dan semantik join terhadap bentuk lama. Test pembanding
   baru masuk cakupan §9 sebelum snapshot. Devops ping QA saat landing.

## 10. Cara menjalankan

```bash
# Suite QA (test/) — dari root repo
npx vitest run --config test/vitest.config.mts

# Satu file
npx vitest run --config test/vitest.config.mts test/schema-contract.test.ts

# Gate penuh (test/** sudah masuk include root sejak snapshot v6 / c177b5f)
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Catatan: `pnpm` di mesin pengembang ini rusak (corepack); CI memakai
`pnpm/action-setup` sehingga gate CI tidak terpengaruh.
