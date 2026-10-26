# CODE_STANDARDS.md — Lakoo

> Template: `shared/templates/CODE_STANDARDS.md`. Satu file per proyek, di
> root repo. Preset dibekukan tech-lead bersama SPEC pertama
> (`docs/SPEC.md` v1.0, FROZEN 26 Okt 2026): **Preset A — TypeScript**,
> berlaku untuk semua paket di monorepo. Perubahan config standar setelah
> beku = keputusan tech-lead (devops memasang wiring CI-nya; developer
> tidak melemahkan aturan demi lolos).

## 0. Prinsip penegakan

- Formatter adalah sumber kebenaran untuk format. Manusia tidak
  mendebat spasi/kurung di review; mesin yang memeriksa.
- Empat lapis gate, semuanya blocking di CI:
  `format check → lint/static analysis → type check → test → build`.
- Merah di lapis mana pun = tidak bisa APPROVE, tidak bisa merge.
- Completion report developer wajib mencantumkan perintah gate yang
  dijalankan + hasilnya. Klaim "sudah dilint" tanpa output bukan bukti.

## 1. Aturan maintainability universal (semua stack)

- **Nama mengungkapkan domain & maksud.** Hindari singkatan kecuali ada
  di glosarium proyek. Nama boolean berbunyi pertanyaan (`isReady`,
  `hasAccess`); nama fungsi berbunyi perintah/perolehan yang jelas.
- **Satu fungsi, satu tanggung jawab.** Ambang lint: kompleksitas
  siklomatis >10 = warning, >15 = error. Fungsi >60 baris wajib
  dipecah atau diberi justifikasi tertulis di review.
- **Nesting maksimal 3 level.** Gunakan early return/guard clause.
- **Rule of three untuk duplikasi:** logika sama muncul di tempat
  ketiga → ekstrak abstraksi bersama. Jangan abstraksi prematur dari
  satu kemunculan.
- **Tidak ada dead code:** kode tak terpakai, blok komentar berisi kode,
  dan TODO tanpa ID task/issue + pemilik, semuanya dilarang.
- **Komentar menjelaskan "kenapa", bukan "apa".** Keputusan non-obvious,
  workaround, dan batasan eksternal wajib dikomentari; sisanya nama yang
  baik yang berbicara.
- **Error handling eksplisit.** Tidak ada catch kosong / exception yang
  ditelan. Setiap jalur gagal: return error yang benar atau log yang
  benar.
- **Tipe eksplisit di batas modul** (signature publik, API, skema data).
  Escape hatch tipe (`any`, cast paksa, `@ts-ignore`, suppression
  sejenis) wajib menyertakan alasan + ID task/issue.
- **Test menguji perilaku, bukan detail implementasi** — dan test itu
  sendiri harus readable: nama skenario jelas, arrange/act/assert
  terpisah.
- File hasil generate & vendor dikecualikan lewat config tool, bukan
  dengan pengecualian manual per file.

## 2. Preset A — TypeScript (DIBEUKUKAN untuk Lakoo; berlaku repo-wide)

Semua paket Lakoo (`frontend/`, `backend/`, `database/`, `e2e/`) adalah
TypeScript, jadi preset ini berlaku untuk seluruh workspace — tidak ada
preset lain di repo ini.

- **Formatter:** Prettier (config di repo; Tailwind CSS v4 dipakai →
  tambah `prettier-plugin-tailwindcss` agar urutan class konsisten).
- **Lint:** ESLint flat config — `next/core-web-vitals` +
  `typescript-eslint recommended` di `frontend/`; `typescript-eslint
recommended` (tanpa plugin Next) di `backend/`, `database/`, `e2e/`.
  Aktifkan `complexity` (warn 10 / error 15) dan `max-lines-per-function`
  (warn 60). Warnings di CI = 0 (`--max-warnings=0`).
- **Type check:** TypeScript `strict: true`; perintah `tsc --noEmit`
  di setiap paket.
- **Test:** Vitest (unit + integrasi); PGlite untuk test yang menyentuh
  PostgreSQL (tanpa Docker — dev di Windows); Playwright untuk E2E;
  Lighthouse CI untuk rute publik (`/`, `/privasi`).
- **Scripts wajib** (`package.json` root, workspace-aware via pnpm):
  - `format` / `format:check` — prettier write / check
  - `lint` — eslint
  - `typecheck` — tsc --noEmit
  - `test`, `build` — sesuai proyek
- **Gate CI:** `pnpm format:check && pnpm lint && pnpm typecheck &&
pnpm test && pnpm build` — semua blocking, tidak ada yang opsional.
- **Versi persis** (Next.js 15, React 19, Hono v4, Zod v3, Drizzle,
  Vitest, Playwright, dll.) dikunci di lockfile saat bootstrap (T-2).
  Upgrade major = usulan ke tech-lead.

## 3. Preset lain

Tidak dipakai di Lakoo — seluruh paket TypeScript, jatuh ke Preset A.
Bila stack non-TS masuk di masa depan, tech-lead memetakannya ke empat
lapis yang sama (satu formatter resmi, satu linter/static analyzer,
satu type checker bila bahasanya punya, test runner proyek) dan
mencatat pemetaannya di sini.

## 4. Adopsi di repo lama (ratchet, bukan big-bang)

- Terapkan gate dulu pada file yang berubah; jangan format ulang
  seluruh repo di dalam PR fitur (diff raksasa, review mustahil).
- Format/statik massal = PR `chore` tersendiri, tanpa perubahan
  perilaku.
- Baseline utang lama hanya menyusut; pelanggaran BARU tidak boleh
  masuk baseline.

## 5. Pengecualian

- Suppression inline (`eslint-disable`, `@ts-ignore`, sejenis) wajib:
  nama aturan + alasan satu baris + ID task/issue. Tanpa itu = temuan
  review.
- Perubahan config standar diusulkan developer, diputuskan tech-lead,
  diumumkan seperti perubahan kontrak.
- Bypass darurat hanya dengan risk acceptance tertulis dari Dimas
  (tanggal + alasan) di log proyek — sama seperti melewati gate lain.

## 6. Fokus review manusia (yang tidak bisa dimesinkan)

Automation menangkap format & pelanggaran mekanis. Reviewer menilai:
kejelasan nama domain, batas tanggung jawab modul, hotspot
kompleksitas, duplikasi lintas file, dead code, dan keterbacaan test.
Preferensi style yang tidak ada di file ini / config tool BUKAN temuan.
