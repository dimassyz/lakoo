# Lakoo

**Uang terkunci di stok, dihitung dan dipulihkan.** Lakoo membantu pemilik
toko kelontong melihat berapa uangnya terkunci di barang tidak laku,
mengklasifikasikan kesehatan barang, menjalankan rencana likuidasi 3 tahap
(AI dengan cadangan template), lalu mengukur kas yang pulih.

> **Status: dalam pengembangan.** Staging belum live — prasyarat deploy dan
> runbook- ada di [`docs/DEPLOY.md`](docs/DEPLOY.md). URL demo publik
> mengikuti alias staging (`staging-lakoo.vercel.app`) dan akan dicantumkan
> di sini saat deploy pertama jalan.

## Dokumen

| Dokumen                                                     | Isi                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`docs/SPEC.md`](docs/SPEC.md)                              | Spesifikasi teknis (arsitektur, data model, logika domain, keamanan) — v1.0 FROZEN |
| [`docs/FSD.md`](docs/FSD.md)                                | Perilaku per layar (input, proses, output, validasi, error)                        |
| [`docs/DESIGN.md`](docs/DESIGN.md)                          | Arah visual                                                                        |
| [`docs/api/openapi.yaml`](docs/api/openapi.yaml)            | Kontrak API — sumber kebenaran                                                     |
| [`docs/BRD.md`](docs/BRD.md) / [`docs/PRD.md`](docs/PRD.md) | Kebutuhan bisnis & produk                                                          |
| [`docs/TASKS.md`](docs/TASKS.md)                            | Rincian task per role                                                              |
| [`AGENTS.md`](AGENTS.md)                                    | Konteks bersama untuk semua agent (kepemilikan file, konvensi)                     |
| [`CODE_STANDARDS.md`](CODE_STANDARDS.md)                    | Standar kode & gate CI (beku)                                                      |

## Tech stack

TypeScript (strict) di semua paket — Next.js 15 (App Router) + React 19 +
Tailwind CSS v4 di atas Hono v4 (route handler), Drizzle ORM + Neon
PostgreSQL, Zod untuk validasi, Google Gemini untuk rencana AI (dengan
cadangan template), hosting Vercel. Detail & alasan: SPEC §3.3.

## Prasyarat

- Node.js ≥ 22
- pnpm 10 (`corepack enable pnpm`; di mesin dengan corepack rusak, pasang
  `pnpm@10` via npm)

## Setup lokal

```bash
cp .env.example .env      # lalu isi nilainya (lihat docs/DEPLOY.md §Env)
pnpm install
pnpm db:migrate           # butuh DATABASE_URL (Neon) yang valid
pnpm db:seed:demo         # buat/regenerasi toko template demo
pnpm dev                  # http://localhost:3000
```

## Skrip

| Perintah                                 | Fungsi                                        |
| ---------------------------------------- | --------------------------------------------- |
| `pnpm dev`                               | Server pengembangan                           |
| `pnpm build`                             | Build produksi                                |
| `pnpm format` / `pnpm format:check`      | Prettier write / check                        |
| `pnpm lint`                              | ESLint (`--max-warnings=0`)                   |
| `pnpm typecheck`                         | `tsc --noEmit` (strict)                       |
| `pnpm test`                              | Vitest                                        |
| `pnpm db:migrate` / `pnpm db:generate`   | Migrasi Drizzle                               |
| `pnpm db:seed:demo` / `pnpm db:seed:dev` | Seed data demo / dev                          |
| `pnpm api:types`                         | Generate tipe FE dari `docs/api/openapi.yaml` |

**Gate CI (wajib hijau untuk merge):**
`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
— dijalankan oleh `.github/workflows/ci.yml` (+ gitleaks). Lihat
`CODE_STANDARDS.md`.

## Deploy

Lingkungan (preview / staging / produksi), variabel env, migrasi, cron, dan
prosedur rollback: **[`docs/DEPLOY.md`](docs/DEPLOY.md)**.

## Struktur repo

```
src/          aplikasi Next.js (pages, components, route API)
database/     skema & migrasi Drizzle, generator data demo
docs/         spesifikasi & kontrak (pemilik: tech-lead)
.github/      CI pipeline (pemilik: devops-engineer)
```

## Kepemilikan

Peta kepemilikan file dan aturan kontrak (kontrak API hanya boleh diubah
tech-lead) ada di [`AGENTS.md`](AGENTS.md).
