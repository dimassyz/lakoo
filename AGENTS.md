# AGENTS.md — shared project context (dibaca SEMUA profile)

## Project

- Name: **Lakoo** — aplikasi likuidasi stok untuk pemilik toko kelontong
  (uang terkunci di stok → rencana likuidasi 3 tahap → kas pulih terukur).
  Ringkasan produk: `docs/BRD.md`; scope fitur: `docs/PRD.md`.
- Repo layout: pnpm workspaces monorepo, **satu deployment** di Vercel:
  - `frontend/` — Next.js 15 (App Router) + React 19 + Tailwind CSS v4,
    Radix UI primitives, TanStack Query v5, klien API bertipe
  - `backend/` — Hono v4 (dimount di Next.js route handler, Node runtime),
    domain murni tanpa I/O, validasi Zod v3, adapter AI (Gemini)
  - `database/` — skema & migrasi Drizzle ORM, target Neon PostgreSQL
    (branch `main` = produksi, branch `staging`)
  - `e2e/` — Playwright, Lighthouse CI, skrip uji offline
  - `docs/` — spesifikasi & kontrak; `.github/` + konfigurasi Vercel — CI/CD
- Language & toolchain: **TypeScript (strict) di semua paket**; pnpm
  workspaces; Vitest + PGlite (unit/integrasi, tanpa Docker), Playwright
  (E2E), Lighthouse CI (rute publik).
- How to run tests: gate standar dari root repo (definisi persis di
  `CODE_STANDARDS.md` §2):
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  E2E: `pnpm --filter e2e test` (Playwright). Skrip `package.json` dikunci
  saat bootstrap pipeline (T-2).

## API surface / contracts

- Lokasi file kontrak (SPEC.md / OpenAPI): **`docs/api/openapi.yaml`** —
  sumber kebenaran API. Tipe FE diturunkan dari kontrak
  (`openapi-typescript` + `openapi-fetch`), tidak ditulis tangan. Spesifikasi
  teknis: `docs/SPEC.md` (v1.0, FROZEN); perilaku per layar: `docs/FSD.md`;
  arah visual: `docs/DESIGN.md`.
- Aturan: kontrak hanya boleh diubah tech-lead. Builder yang menemukan
  kontrak salah/ambigu harus STOP dan lapor, bukan improvise.

## Conventions

- Code style: ikuti `CODE_STANDARDS.md` di root repo (preset stack +
  ambang dibekukan tech-lead). Formatter/linter/type checker adalah
  sumber kebenaran format — jangan override lokal, jangan lemahkan
  config demi lolos gate.
- Commit/branch: satu task = satu branch (`feat/...`, `fix/...`,
  `chore/...`), masuk `main` hanya lewat PR. Merge hanya dengan
  tech-lead APPROVE + QA ALL GREEN (+ security SECURE bila di-flag);
  devops-engineer yang eksekusi merge dan deploy.
- Bahasa: seluruh copy UI, error, dan saran dalam bahasa Indonesia
  sehari-hari. Kode error API bahasa Inggris (`snake_case`); field
  `message` berbahasa Indonesia dan aman ditampilkan ke pengguna.
- Tanggal bisnis: selalu Asia/Jakarta (WIB), format `YYYY-MM-DD` di API;
  "hari ini" dihitung di server dalam WIB.
- Uang: integer Rupiah; format `Rp12.500` via
  `Intl.NumberFormat('id-ID')` dengan `tabular-nums`.
- Aksesibilitas: WCAG 2.2 AA (target sentuh ≥ 44×44 px, fokus terlihat,
  status tidak hanya dibedakan warna).

## Documentation ownership (tetap — tidak berubah per proyek)

- **API documentation = `openapi.yaml`.** The contract file IS the API
  documentation's single source of truth; human-readable docs
  (Swagger UI / Redoc / portal) are rendered from it, never written
  separately. Owner: tech-lead as contract owner. Developers never
  maintain a second, hand-written API doc — drift between a hand-written
  doc and the contract is treated as a contract violation.
- **README = devops-engineer's.** devops-engineer owns the repo README's
  content and upkeep: project summary, setup, required env, how to run,
  how to test, deployment notes. Inputs come from the SPEC (tech-lead)
  and developer completion reports. It is refreshed at every release
  tag — a README that describes the previous release is a defect.
- **Developers flag doc impact.** Every completion report states what
  changed that a README reader or API consumer must know (new env,
  changed setup step, new/changed endpoint behavior). "No doc impact"
  is a valid statement; silence is not.
- There is no technical-writer profile. User guides / help-center
  content beyond README + API docs are scoped per project by tech-lead
  in the SPEC when a project actually needs them.

## File ownership (diisi tech-lead per fitur)

- `frontend/` — frontend-dev, **kecuali**
  `frontend/src/app/api/[[...route]]/route.ts` (mount API → backend-dev)
- `backend/`, `database/` — backend-dev
- `e2e/` — qa-engineer
- `.github/`, konfigurasi Vercel, `README.md` — devops-engineer
- `docs/`, `AGENTS.md`, `CODE_STANDARDS.md` — tech-lead
  (devops-engineer melakukan commit/PR-nya)
