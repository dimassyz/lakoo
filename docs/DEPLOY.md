# DEPLOY — Lakoo (runbook)

Runbook deploy & demo. Pemilik: devops-engineer. Acuan: SPEC §10.1
(lingkungan), §8.3 (rahasia), §10.2 (data demo). Deadline proyek: 10 Nov
2026 (`docs/PROJECT_LOG.md`).

## 1. Lingkungan

| Env      | Sumber                                                          | URL                                    | DB (Neon)        | Pemicu              |
| -------- | --------------------------------------------------------------- | -------------------------------------- | ---------------- | ------------------- |
| Preview  | branch PR                                                       | URL preview Vercel per PR              | branch `staging` | tiap push ke PR     |
| Staging  | `main`                                                          | alias tetap `staging-lakoo.vercel.app` | branch `staging` | merge ke `main`     |
| Produksi | branch `release` (fast-forward dari `main` yang sudah diterima) | domain produksi Vercel                 | branch `main`    | promote oleh devops |

Satu proyek Vercel, satu deployment (SPEC ADR-001). Hosting & database wajib
tingkat gratis.

## 2. Prasyarat akun (sekali saja, oleh Dimas)

1. **Vercel** (Hobby): buat project, hubungkan ke repo GitHub
   `dimassyz/lakoo`. Framework terdeteksi: Next.js. Branch produksi:
   `release`.
2. **Neon** (free tier): buat project + branch `staging` dan `main`.
   Catat connection string masing-masing.
3. **Environment Variables** di Vercel — **Preview dan Production
   dipisah** (SPEC §8.3):

   | Variabel                                      | Keterangan                                            |
   | --------------------------------------------- | ----------------------------------------------------- |
   | `DATABASE_URL`                                | Neon branch `staging` (Preview) / `main` (Production) |
   | `GEMINI_API_KEY`                              | API key Gemini (ADR-002)                              |
   | `CRON_SECRET`                                 | rahasia untuk endpoint cron                           |
   | `APP_ORIGIN`, `ALLOWED_ORIGINS`               | origin aplikasi per lingkungan                        |
   | `AI_ENABLED`, `AI_MODEL`                      | fitur AI (`false` → rencana pakai template)           |
   | `AI_DAILY_CALL_LIMIT`, `AI_STORE_DAILY_LIMIT` | kuota AI                                              |
   | `DEV_SEED_PASSWORD`                           | hanya lokal/preview — JANGAN di Production            |

   Rahasia tidak boleh berawalan `NEXT_PUBLIC_`. Hanya `.env.example`
   (placeholder) yang masuk repo.

## 3. Migrasi database

- Migrasi hanya **maju** (tanpa down di produksi).
- `pnpm db:migrate` dijalankan devops **sebelum build** pada setiap deploy
  ke staging/produksi (SPEC §10.1).
- Preview deployment memakai branch `staging` yang sama — migrasi yang
  masuk lewat `main` otomatis terlihat di preview.

## 4. Cron harian

TerKonfigurasi di `vercel.json`:

```json
{ "path": "/api/v1/cron/daily", "schedule": "0 19 * * *" }
```

02.00 WIB. Isi (berurutan): regenerasi toko template demo → warm rencana AI
(≤ 20 barang, konkurensi 8, timeout 12 dtk, gagal → template) → hapus klon
demo kedaluwarsa (maks 150 aktif) → bersihkan `idempotency_keys` > 7 hari,
`rate_limits`, sesi kedaluwarsa. Route wajib `export const maxDuration = 60`.

## 5. Deploy staging

1. Merge PR ke `main` (gate CI hijau: format → lint → typecheck → test →
   build + gitleaks; plus verdict tech-lead + QA).
2. Vercel otomatis build & deploy `main` ke alias staging.
3. Jalankan `pnpm db:migrate` terhadap branch `staging` sebelum/saat
   deploy bila ada migrasi baru.
4. Verifikasi: halaman hidup, alur demo berjalan (BRD §11), cron terdaftar
   di dashboard Vercel.

## 6. Uji penerimaan staging

- Penerimaan dilakukan tech-lead atas nama Dimas (delegasi, lihat
  `docs/PROJECT_LOG.md`), memakai alur demo BRD §11 + KS-1..KS-8.
- Gate QA (ALL GREEN) dan security (SECURE) **tidak** dilewati.
- Demo end-to-end yang harus lolos: tambah barang → rekap penjualan →
  jalankan rencana → lihat kas pulih.

## 7. Produksi

1. Fast-forward branch `release` dari `main` yang sudah diterima.
2. Promote deploy oleh devops (Vercel: deploy branch `release` /
   promote deployment staging yang sudah diterima).
3. Migrasi `pnpm db:migrate` terhadap Neon branch `main` sebelum build.
4. Verifikasi health + cron di produksi.

## 8. Rollback

- **Aplikasi:** rollback instant ke deployment sebelumnya di dashboard
  Vercel (artifact build sebelumnya, bukan rebuild).
- **Database:** migrasi hanya maju — rollback aplikasi yang lebih baru
  memakai skema lama harus dicek kompatibilitasnya sebelum dipromosikan
  balik; kalau tidak kompatibel, fix-forward.
- Setiap rollback dilaporkan (apa yang terjadi, apa yang dilakukan) dan
  membuat card tidak bisa masuk `done` sampai deploy hijau kembali.

## 9. Recovery: `node_modules` rusak (Windows)

Gejala: gate gagal sebelum kode dieksekusi — `vitest` `ERR_MODULE_NOT_FOUND`
(paket seperti `magic-string`/`sourcemap-codec`), eslint `MODULE_NOT_FOUND`,
isi direktori paket di `node_modules/.pnpm/...` kosong. Penyebab: install
pnpm terputus di tengah (dua install paralel pada satu `node_modules`, atau
proses mati separuh jalan).

Penting: `pnpm install --frozen-lockfile` TIDAK memulihkan ini — pnpm
melaporkan "Already up to date" karena tidak memverifikasi ISI paket, hanya
keberadaannya.

Recovery (satu working copy, satu install — jangan jalankan bersamaan dengan
install orang lain):

```bash
npx pnpm@10.34.9 install --force --frozen-lockfile
```

Catatan mesin ini: shim `pnpm` di PATH rusak sejak awal (corepack resolve
salah path MSYS), jadi `npx pnpm@<versi>` adalah cara BENAR, bukan
workaround. `package.json` + `pnpm-lock.yaml` tidak berubah oleh insiden
ini — tidak ada commit yang perlu dibuat untuk recovery itu sendiri.
