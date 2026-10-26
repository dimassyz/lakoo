# TASKS.md — Lakoo (Functional Specification)

| | |
|---|---|
| Versi | 1.0 — **FROZEN** 26 Okt 2026 |
| Penyusun | tech-lead (disetujui atas delegasi Dimas, lihat `docs/PROJECT_LOG.md`) |
| Input | `docs/SPEC.md` 1.0, `docs/FSD.md` 1.0, `docs/DESIGN.md` 1.0, `docs/api/openapi.yaml` 1.0 |
| Arah visual | `docs/DESIGN.md` |
| Target live | 10 November 2026 |

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

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| devops-engineer | Buat folder dan file bootstrap standar | `shared/templates/` (template AGENTS.md, CODE_STANDARDS.md, DESIGN.md) | AGENTS.md, CODE_STANDARDS.md, .gitignore | semua file di docs/ | — | Semua file di root repo sudah ada dan sesuai template |

## T-2: Setup repo & pipeline

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| devops-engineer | Inisialisasi repo, CI/CD, dan pipeline | — | .github/workflows, package.json, vercel.json | semua | T-1 | CI/CD sudah jalan (test, lint, build), deploy ke staging |

## T-3: Implementasi frontend — Beranda & Navigasi

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| frontend-dev | Buat layout HP + desktop dengan navigasi bawah + sidebar | DESIGN.md, SPEC §0, FSD §6 | src/pages/index.tsx, components/NavBar.tsx, components/KPIHero.tsx | src/, docs/ | T-1, T-2 | Layout clean sesuai DESIGN.md, uang terkunci di hero terlihat, status ubin (Sehat/Waspada dll) |

## T-4: Implementasi frontend — Rekap Penjualan & Mode Opname

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| frontend-dev | Buat halaman rekap dengan stepper qty dan mode opname | FSD §7, openapi.yaml | src/pages/rekap.tsx, components/Stepper.tsx | src/, docs/ | T-3 | Stepper berfungsi, validasi qty tidak melebihi stok, mode opname hitung sold benar |

## T-5: Implementasi frontend — Barang Masuk & Tempel Nota

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| frontend-dev | Buat form catat barang masuk + parser tempel nota | FSD §8, FSD §21 | src/pages/barang-masuk.tsx, components/NotaParser.tsx | src/, docs/ | T-3 | Form lengkap, parser teks nota berfungsi, outbox (IndexedDB) berjalan |

## T-6: Implementasi frontend — Daftar Barang & Detail Barang

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| frontend-dev | Buat daftar barang + detail dengan grafik 8 minggu + rencana | FSD §9, §10, §11, DESIGN.md | src/pages/barang.tsx, src/pages/detail.tsx, components/WeekChart.tsx | src/, docs/ | T-3, T-5 | Daftar sorted, filter status, tombol rencana muncul sesuai status, grafik 8 minggu ada |

## T-7: Implementasi frontend — Rencana & Hasil

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| frontend-dev | Buat halaman rencana aktif, hasil, dan share ke WA | FSD §11, §13, openapi.yaml | src/pages/rencana.tsx, src/pages/hasil.tsx, components/ShareWA.tsx | src/, docs/ | T-6 | Rencana 3 tahap muncul, tombol Jalankan & Bagikan WA berfungsi, hasil kas pulih tampil |

## T-8: Implementasi frontend — Import, Pengaturan & Landing

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| frontend-dev | Buat import, pengaturan, dan halaman landing | FSD §14, §15, SPEC §1 | src/pages/import.tsx, src/pages/pengaturan.tsx, src/pages/landing.tsx | src/, docs/ | T-1, T-3 | Import preview & commit, form pengaturan, landing hero + demo button |

## T-9: Implementasi backend — API (OpenAPI compliant)

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| backend-dev | Implementasi semua endpoint sesuai openapi.yaml | openapi.yaml, SPEC §5 | src/ (api routes atau express) | src/, docs/ | T-1 | Semua endpoint ada, validasi input, autentikasi dengan cookie lakoo_session |

## T-10: Integrasi database & cron

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| backend-dev + devops | Setup database + cron daily | — | schema.sql, vercel.json / vercel.json | src/, docs/ | T-9 | Database sudah ada, cron daily berjalan (regenerasi demo, warm plans) |

## T-11: Testing & QA

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| qa-engineer | Tulis test plan & test cases | FSD, openapi.yaml | test/ folder | test/, docs/ | T-8 | Semua acceptance criteria di FSD sudah ter-cover |

## T-12: Security & hardening

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| security-reviewer | Review security (input validation, rate limit, outbox) | openapi.yaml, FSD §0 | report | docs/SECURITY.md | T-9 | Semua gate security lolos |

## T-13: Deploy & demo

| Role | Task | Inputs | Outputs | Allowed files | Depends on | Acceptance criteria |
|------|------|--------|---------|---------------|------------|---------------------|
| devops-engineer | Deploy ke staging + buat demo publik | — | vercel.json, README | docs/ | T-12 | App live di staging, demo toko aktif, URL demo ada |

**Acceptance criteria keseluruhan:**
- Semua task selesai → app live di URL publik
- Demo end-to-end tanpa error (tambah barang, rekap, jalankan rencana, lihat kas pulih)
- Lolos GTNIC 2026 tanggal 10 November 2026

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