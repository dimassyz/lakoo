# Lakoo

**Uang terkunci di stok, dihitung dan dipulihkan.** Lakoo membantu pemilik
toko kelontong melihat berapa uangnya terkunci di barang tidak laku,
mengklasifikasikan kesehatan barang, menjalankan rencana likuidasi 3 tahap
(AI dengan cadangan template), lalu mengukur kas yang pulih.

> **Status: dalam pengembangan.** Staging belum live — prasyarat deploy ada
> di bagian [Deploy](#deploy). URL demo mengikuti alias staging
> (`staging-lakoo.vercel.app`) dan akan dicantumkan di sini saat deploy
> pertama jalan.

## Apa yang bisa dilakukan

- **Lihat uang terkunci** — berapa modal mengendap di barang tidak laku,
  dikelompokkan per kategori dan umur stok
- **Klasifikasi kesehatan barang** — mana yang sehat, mana yang menumpuk
- **Rencana likuidasi 3 tahap** — rencana aksi per barang; dihasilkan AI
  (Gemini) dengan cadangan template saat AI tidak aktif
- **Ukur kas pulih** — rekap penjualan dan progres rencana, sebelum vs
  sesudah
- **Catat barang masuk** — input barang masuk + riwayat 30 hari
- **Toko demo** — data contoh siap pakai untuk dicoba tanpa setup

## Quick start

Prasyarat: **Node.js ≥ 22** dan **pnpm 10**
(`corepack enable pnpm`; di mesin dengan corepack rusak, pasang `pnpm@10`
via npm).

```bash
cp .env.example .env      # lalu isi nilainya (lihat tabel di bawah)
pnpm install
pnpm db:migrate           # butuh DATABASE_URL (Neon) yang valid
pnpm db:seed:demo         # buat/regenerasi toko template demo
pnpm dev                  # http://localhost:3000
```

Minimal untuk jalan lokal: **`DATABASE_URL` saja.** Fitur AI opsional —
biarkan `AI_ENABLED="false"` (atau `GEMINI_API_KEY` kosong) dan rencana
memakai template, tanpa perlu key Gemini.

### Variabel lingkungan

| Variabel                                       | Wajib?    | Keterangan                                           |
| ---------------------------------------------- | --------- | ---------------------------------------------------- |
| `DATABASE_URL`                                 | ya        | PostgreSQL (Neon)                                    |
| `AI_ENABLED`                                   | tidak     | `false` → rencana pakai template (default aman)      |
| `GEMINI_API_KEY`                               | untuk AI  | kosong → rencana pakai template                      |
| `AI_MODEL`                                     | tidak     | default `gemini-2.5-flash`                           |
| `AI_DAILY_CALL_LIMIT` / `AI_STORE_DAILY_LIMIT` | tidak     | kuota pemakaian AI                                   |
| `CRON_SECRET`                                  | produksi  | rahasia endpoint cron harian                         |
| `APP_ORIGIN` / `ALLOWED_ORIGINS`               | produksi  | origin aplikasi (CORS/redirect & validasi sesi)      |
| `DEV_SEED_PASSWORD`                            | seed saja | hanya lokal/preview — **jangan** dipakai di produksi |

Rahasia **tidak boleh** berawalan `NEXT_PUBLIC_`. Nilai asli untuk
staging/produksi disimpan di Vercel Environment Variables (Preview &
Production terpisah), tidak di repo.

## Tech stack

TypeScript (strict) di semua paket — Next.js 15 (App Router) + React 19 +
Tailwind CSS v4 di atas Hono v4 (route handler), Drizzle ORM + Neon
PostgreSQL, Zod untuk validasi, Google Gemini untuk rencana AI (dengan
cadangan template), hosting Vercel. Detail & alasan: SPEC §3.3.

## Skrip

| Perintah                                 | Fungsi                                        |
| ---------------------------------------- | --------------------------------------------- |
| `pnpm dev`                               | Server pengembangan                           |
| `pnpm build`                             | Build produksi                                |
| `pnpm format` / `pnpm format:check`      | Prettier write / check                        |
| `pnpm lint`                              | ESLint (`--max-warnings=0`)                   |
| `pnpm typecheck`                         | `tsc --noEmit` (strict)                       |
| `pnpm test`                              | Vitest (unit + integrasi)                     |
| `pnpm db:migrate` / `pnpm db:generate`   | Migrasi Drizzle                               |
| `pnpm db:seed:demo` / `pnpm db:seed:dev` | Seed data demo / dev                          |
| `pnpm api:types`                         | Generate tipe FE dari `docs/api/openapi.yaml` |

**Gate CI (wajib hijau untuk merge):**
`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
— dijalankan oleh `.github/workflows/ci.yml` sebagai dua job paralel
(frontend-gate & backend-gate) + gitleaks. Aturan lengkap:
`CODE_STANDARDS.md`.

## Troubleshooting

- **`node_modules` rusak** (paket kosong, `ERR_MODULE_NOT_FOUND`, eslint
  `MODULE_NOT_FOUND`): jalankan
  `npx pnpm@10.34.9 install --force --frozen-lockfile` — pnpm tidak
  memverifikasi isi paket, jadi `install` biasa bilang "up to date" walau
  isinya hampa. Satu install pada satu waktu; dua install paralel di repo
  yang sama adalah penyebab keadaan ini.
- **Test gagal hanya di CI, lolos lokal**: cek dulu line-ending
  (`core.autocrlf`) sebelum curiga kode.

## Dokumen

**Di repo** (bisa dibuka dari halaman ini):

| Dokumen                                          | Isi                                                            |
| ------------------------------------------------ | -------------------------------------------------------------- |
| [`docs/api/openapi.yaml`](docs/api/openapi.yaml) | Kontrak API — sumber kebenaran; input build `pnpm api:types`   |
| [`AGENTS.md`](AGENTS.md)                         | Konteks bersama untuk semua agent (kepemilikan file, konvensi) |
| [`CODE_STANDARDS.md`](CODE_STANDARDS.md)         | Standar kode & gate CI (beku)                                  |

**Internal tim** (tidak dipublikasikan di repo ini — tersimpan di working tree tim):

| Dokumen         | Isi                                                                         |
| --------------- | --------------------------------------------------------------------------- |
| SPEC.md         | Spesifikasi teknis (arsitektur, data model, domain, keamanan) — v1.0 FROZEN |
| FSD.md          | Perilaku per layar (input, proses, output, validasi, error)                 |
| DESIGN.md       | Arah visual                                                                 |
| BRD.md / PRD.md | Kebutuhan bisnis & produk                                                   |
| TASKS.md        | Rincian task per role                                                       |
| DEPLOY.md       | Runbook deploy: lingkungan, env, migrasi, cron, rollback                    |

> Dokumen internal hanya hidup di working tree tim — fresh clone tidak
> memuatnya (kecuali `docs/api/openapi.yaml` yang di repo karena input
> build). Kalau kamu baru clone dan butuh SPEC/FSD, minta salinannya ke
> tim dulu.

## Deploy

Lingkungan (preview / staging / produksi), variabel env, migrasi cron, dan
prosedur rollback ada di runbook deploy internal tim (`DEPLOY.md` — lihat
§Dokumen). Alurnya: merge ke `main` → Vercel build staging →
`pnpm db:migrate` ke Neon branch `staging` → verifikasi → produksi lewat
branch `release` setelah acceptance.

## Struktur repo

```
src/          aplikasi Next.js (pages, components, klien API)
backend/      Hono v4 (dimount di route handler Next.js), domain, repo
database/     skema & migrasi Drizzle, generator data demo
test/         suite QA (integrasi & guard kontrak)
docs/         spesifikasi & kontrak — disk-only (kecuali docs/api/openapi.yaml)
.github/      CI pipeline (pemilik: devops-engineer)
```

## Kepemilikan

Peta kepemilikan file dan aturan kontrak (kontrak API hanya boleh diubah
tech-lead) ada di [`AGENTS.md`](AGENTS.md).
