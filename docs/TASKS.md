# TASKS.md — Lakoo (Functional Specification)

|             |                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------- |
| Versi       | 1.0 — **FROZEN** 26 Okt 2026                                                             |
| Penyusun    | tech-lead (disetujui atas delegasi Dimas, lihat `docs/PROJECT_LOG.md`)                   |
| Input       | `docs/SPEC.md` 1.0, `docs/FSD.md` 1.0, `docs/DESIGN.md` 1.0, `docs/api/openapi.yaml` 1.0 |
| Arah visual | `docs/DESIGN.md`                                                                         |
| Target live | 10 November 2026                                                                         |

Dokumen ini adalah **breakdown tugas siap eksekusi** untuk builder (frontend-dev & backend-dev).

Setiap task punya:

- Role yang bertanggung jawab
- Task dalam satu kalimat
- Inputs & Outputs
- Batas file yang boleh disentuh
- Dependensi
- Acceptance criteria (harus lolos sebelum task dianggap selesai)

---

## T-1: Bootstrap project (CODE_STANDARDS.md + AGENTS.md)

| Role            | Task                                   | Inputs                                                                 | Outputs                                  | Allowed files       | Depends on | Acceptance criteria                                   |
| --------------- | -------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- | ------------------- | ---------- | ----------------------------------------------------- |
| devops-engineer | Buat folder dan file bootstrap standar | `shared/templates/` (template AGENTS.md, CODE_STANDARDS.md, DESIGN.md) | AGENTS.md, CODE_STANDARDS.md, .gitignore | semua file di docs/ | —          | Semua file di root repo sudah ada dan sesuai template |

## T-2: Setup repo & pipeline

| Role            | Task                                   | Inputs | Outputs                                      | Allowed files | Depends on | Acceptance criteria                                      |
| --------------- | -------------------------------------- | ------ | -------------------------------------------- | ------------- | ---------- | -------------------------------------------------------- |
| devops-engineer | Inisialisasi repo, CI/CD, dan pipeline | —      | .github/workflows, package.json, vercel.json | semua         | T-1        | CI/CD sudah jalan (test, lint, build), deploy ke staging |

## T-3: Implementasi frontend — Beranda & Navigasi

| Role         | Task                                                     | Inputs                     | Outputs                                                            | Allowed files | Depends on | Acceptance criteria                                                                            |
| ------------ | -------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------ | ------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| frontend-dev | Buat layout HP + desktop dengan navigasi bawah + sidebar | DESIGN.md, SPEC §0, FSD §6 | src/pages/index.tsx, components/NavBar.tsx, components/KPIHero.tsx | src/, docs/   | T-1, T-2   | Layout clean sesuai DESIGN.md, uang terkunci di hero terlihat, status ubin (Sehat/Waspada dll) |

## T-4: Implementasi frontend — Rekap Penjualan & Mode Opname

| Role         | Task                                                  | Inputs               | Outputs                                     | Allowed files | Depends on | Acceptance criteria                                                                |
| ------------ | ----------------------------------------------------- | -------------------- | ------------------------------------------- | ------------- | ---------- | ---------------------------------------------------------------------------------- |
| frontend-dev | Buat halaman rekap dengan stepper qty dan mode opname | FSD §7, openapi.yaml | src/pages/rekap.tsx, components/Stepper.tsx | src/, docs/   | T-3        | Stepper berfungsi, validasi qty tidak melebihi stok, mode opname hitung sold benar |

## T-5: Implementasi frontend — Barang Masuk & Tempel Nota

| Role         | Task                                              | Inputs          | Outputs                                               | Allowed files | Depends on | Acceptance criteria                                                   |
| ------------ | ------------------------------------------------- | --------------- | ----------------------------------------------------- | ------------- | ---------- | --------------------------------------------------------------------- |
| frontend-dev | Buat form catat barang masuk + parser tempel nota | FSD §8, FSD §21 | src/pages/barang-masuk.tsx, components/NotaParser.tsx | src/, docs/   | T-3        | Form lengkap, parser teks nota berfungsi, outbox (IndexedDB) berjalan |

## T-6: Implementasi frontend — Daftar Barang & Detail Barang

| Role         | Task                                                         | Inputs                      | Outputs                                                              | Allowed files | Depends on | Acceptance criteria                                                                    |
| ------------ | ------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------- | ------------- | ---------- | -------------------------------------------------------------------------------------- |
| frontend-dev | Buat daftar barang + detail dengan grafik 8 minggu + rencana | FSD §9, §10, §11, DESIGN.md | src/pages/barang.tsx, src/pages/detail.tsx, components/WeekChart.tsx | src/, docs/   | T-3, T-5   | Daftar sorted, filter status, tombol rencana muncul sesuai status, grafik 8 minggu ada |

## T-7: Implementasi frontend — Rencana & Hasil

| Role         | Task                                               | Inputs                     | Outputs                                                            | Allowed files | Depends on | Acceptance criteria                                                                    |
| ------------ | -------------------------------------------------- | -------------------------- | ------------------------------------------------------------------ | ------------- | ---------- | -------------------------------------------------------------------------------------- |
| frontend-dev | Buat halaman rencana aktif, hasil, dan share ke WA | FSD §11, §13, openapi.yaml | src/pages/rencana.tsx, src/pages/hasil.tsx, components/ShareWA.tsx | src/, docs/   | T-6        | Rencana 3 tahap muncul, tombol Jalankan & Bagikan WA berfungsi, hasil kas pulih tampil |

## T-8: Implementasi frontend — Import, Pengaturan & Landing

| Role         | Task                                         | Inputs                | Outputs                                                               | Allowed files | Depends on | Acceptance criteria                                                  |
| ------------ | -------------------------------------------- | --------------------- | --------------------------------------------------------------------- | ------------- | ---------- | -------------------------------------------------------------------- |
| frontend-dev | Buat import, pengaturan, dan halaman landing | FSD §14, §15, SPEC §1 | src/pages/import.tsx, src/pages/pengaturan.tsx, src/pages/landing.tsx | src/, docs/   | T-1, T-3   | Import preview & commit, form pengaturan, landing hero + demo button |

## T-9: Implementasi backend — API (OpenAPI compliant)

| Role        | Task                                            | Inputs                | Outputs                                                                                   | Allowed files                   | Depends on | Acceptance criteria                                                         |
| ----------- | ----------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------- | ---------- | --------------------------------------------------------------------------- |
| backend-dev | Implementasi semua endpoint sesuai openapi.yaml | openapi.yaml, SPEC §5 | backend/src/http, backend/src/domain, backend/src/ai, src/pages/api/[...route].ts (mount) | backend/, src/pages/api/, docs/ | T-1        | Semua endpoint ada, validasi input, autentikasi dengan cookie lakoo_session |

## T-10: Integrasi database & cron

| Role                 | Task                        | Inputs | Outputs                               | Allowed files | Depends on | Acceptance criteria                                                   |
| -------------------- | --------------------------- | ------ | ------------------------------------- | ------------- | ---------- | --------------------------------------------------------------------- |
| backend-dev + devops | Setup database + cron daily | —      | schema.sql, vercel.json / vercel.json | src/, docs/   | T-9        | Database sudah ada, cron daily berjalan (regenerasi demo, warm plans) |

## T-11: Testing & QA

| Role        | Task                         | Inputs            | Outputs      | Allowed files | Depends on | Acceptance criteria                              |
| ----------- | ---------------------------- | ----------------- | ------------ | ------------- | ---------- | ------------------------------------------------ |
| qa-engineer | Tulis test plan & test cases | FSD, openapi.yaml | test/ folder | test/, docs/  | T-8        | Semua acceptance criteria di FSD sudah ter-cover |

## T-12: Security & hardening

| Role              | Task                                                   | Inputs               | Outputs | Allowed files    | Depends on | Acceptance criteria       |
| ----------------- | ------------------------------------------------------ | -------------------- | ------- | ---------------- | ---------- | ------------------------- |
| security-reviewer | Review security (input validation, rate limit, outbox) | openapi.yaml, FSD §0 | report  | docs/SECURITY.md | T-9        | Semua gate security lolos |

## T-13: Deploy & demo

| Role            | Task                                 | Inputs | Outputs             | Allowed files | Depends on | Acceptance criteria                                |
| --------------- | ------------------------------------ | ------ | ------------------- | ------------- | ---------- | -------------------------------------------------- |
| devops-engineer | Deploy ke staging + buat demo publik | —      | vercel.json, README | docs/         | T-12       | App live di staging, demo toko aktif, URL demo ada |

**Acceptance criteria keseluruhan:**

- Semua task selesai → app live di URL publik
- Demo end-to-end tanpa error (tambah barang, rekap, jalankan rencana, lihat kas pulih)
- Lolos GTNIC 2026 tanggal 10 November 2026

---

## Status & urutan kanonik (diperbarui 26 Okt 2026, tech-lead)

**Daftar task sah = T-1 sampai T-13 di atas. Tidak ada T-14+.** Pesan delegasi
bernomor T-14..T-29 yang pernah terkirim adalah kesalahan tech-lead — abaikan.

**Urutan eksekusi (dependensi):**

```
T-1 (bootstrap) ─┬─> T-2 (pipeline) ──────────────────────────────┐
                 └─> T-3..T-8 (frontend, paralel berurutan) ──────┤
T-9 (backend API, CRITICAL PATH) ─> T-10 (cron) ─> T-11 (QA) ─> T-12 (security full) ─> T-13 (deploy)
```

| Task | Status 26 Okt 2026 | Catatan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1  | SEBAGIAN           | CODE_STANDARDS.md + .gitignore landed; AGENTS.md landed di working tree, belum di-commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| T-2  | SEBAGIAN           | package.json, pnpm-lock, CI, vercel.json, .env.example, tsconfig, eslint/prettier/vitest config landed; typecheck/test/build PASS lokal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| T-3  | DONE               | APPROVE + landed di remote (41400b0): index→toko/index, NavBar, KPIHero, DashboardSections, globals.css, _app.tsx, api-types dari openapi-typescript; gate hijau + bukti SSR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T-4  | DONE               | APPROVE + landed (41400b0): toko/rekap.tsx FSD §7 lengkap (tanggal ‹ ›, tab quantity/opname, stepper validasi stok, footer lengket), outbox IndexedDB sebelum request dengan id=UUID v4=Idempotency-Key, nol localStorage; gate nol warning                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| T-5  | BERJALAN           | frontend-dev mengerjakan: toko/barang-masuk.tsx FSD §8 (tanggal nota, baris kombobox/qty/harga auto lastCost, opsi barang baru, footer, POST /stock-ins via outbox, riwayat 30 hari + edit_window_closed/insufficient_stock) + parser tempel nota (AC T-5 baris 52 — canonical, bukan fitur terpisah); perluasan §0.4: outbox worker + badge + daftar antrean                                                                                                                                                                                                                                                                                                                |
| T-6  | REQUEST_CHANGES    | 2 dari 3 write gagal; barang.tsx tanpa filter/chip/state, detail.tsx tanpa section rencana, WeekChart pakai Math.random()                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| T-7  | BELUM DIBUKA       | menunggu T-3..T-6 lolos review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| T-8  | BELUM DIBUKA       | menunggu T-7                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T-9  | BERJALAN           | **critical path** — 32/32 endpoint kontrak terpasang & terverifikasi mekanis; selesai: auth, me, store, products (4 item RC tutup), dashboard, sales recap GET/PUT (source='opname'), stock-ins, plans lengkap incl. apply-price, results, weekly-summaries, imports, cron/daily, rate limit §8.4, kuota AI §6.1 ditegakkan (aiUsage.ts + ai_usage_daily), E-1/E-2 (sesi demo = demo_expires_at), audit jam DB, benchmark klon 590 ms; **weekQty = 7** (keputusan final; kontrak+SPEC+FSD+kode sejajar di 702dca8); 445 test; **sisa: W-1 + W-2 (MEDIUM must-fix white-box) + LOW (W-4/W-6/W-8/W-9) + handleApplyPrice unused ERROR** — detail di PROJECT_LOG STATUS TERKINI |
| T-10 | SEBAGIAN           | database/ landed & BERSIH di 702dca8 (nameKey, generator, productStats); fix QA-01 TERKONFIRMASI (lima CTE terpotong asOf; QA ALL GREEN 50/50); cron/daily sudah masuk T-9 (backend)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-11 | SIAP TEST PLAN     | qa-engineer boleh menulis test plan dari dokumen sekarang; eksekusi nunggu staging URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| T-12 | TERBUKA            | white-box PENUH selesai (2 MEDIUM must-fix W-1/W-2 + 6 LOW, 0 HIGH/CRITICAL; early-pass E-1/E-2 CLOSED); tutup setelah W-1/W-2 mendarat + black-box pass (menunggu staging URL T-13)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-13 | BLOKIR             | PR #1 (chore/landing-1.0) sekarang di 41400b0 — src/ frontend landed (T-3+T-4+rute /toko/); backend+database+kontrak di 702dca8; docs format di 1814435; CI format layer harusnya hijau, lapis Lint merah di handleApplyPrice (backend, dalam perbaikan); merge nunggu APPROVE + QA ALL GREEN + SECURE; deploy staging nunggu aksi akun (Vercel connect, env §8.3, Neon branch); pra-demo: AI_ENABLED=true + GEMINI_API_KEY + AI_DAILY_CALL_LIMIT=300                                                                                                                                                                                                                        |

**Keputusan tech-lead 26 Okt 2026 (menggantungkan agen):**

1. `allowImportingTsExtensions: true` di tsconfig.json — DISETUJUI, dieksekusi devops-engineer.
2. Cron T-10: T-9 dulu; dead code tidak diterima (CODE_STANDARDS §1).
3. `weekly_summaries` tidak di-seed; jalur lazy §5.9.
4. PR #1: REQUEST_CHANGES, opsi A (update PR setelah merah diperbaiki), bukan merge sekarang.
5. 2 LOW security findings (next.config.ts) → devops patch; kontrak (rate limit di openapi.info, path SPEC §8.6) → tech-lead, SUDAH diperbaiki.

---

**Catatan untuk builder:**

- Semua task harus pakai `Idempotency-Key` di endpoint yang wajib.
- Semua perubahan kontrak harus lewat openapi.yaml (tech-lead yang update).
- Gunakan preset clean-simple dari DESIGN.md.
- Test harus pakai acceptance criteria yang terukur.

**Next step:**  
Mau saya mulai dengan **T-1** (bootstrap) atau langsung **T-3** (frontend Beranda)?  
Atau ada yang ingin diubah di TASKS.md sebelum delegasi ke dev?

Ketik saja **"T-1"** atau **"T-3"** atau instruksi lain. Saya langsung kerjakan sesuai instruksi "selalu jalankan".
