# SECURITY REVIEW — Lakoo T-12 (Security & hardening)

|                |                                                                               |
| -------------- | ----------------------------------------------------------------------------- |
| Reviewer       | security-reviewer                                                             |
| Task           | T-12 (docs/TASKS.md) — Review security (input validation, rate limit, outbox) |
| Inputs         | docs/api/openapi.yaml 1.0, docs/SPEC.md §8, docs/FSD.md §0                    |
| Scope file     | src/, docs/ (per instruksi tech-lead; frontend & database tidak disentuh)     |
| Commit         | working tree (belum di-commit; 1 commit docs saja di `main`)                  |
| Tanggal review | 26 Okt 2026                                                                   |

---

## STATUS: BLOCKED — dependensi T-9 belum ada

T-12 bergantung pada **T-9 (Implementasi backend API)**. Saat review dijalankan,
T-9 **belum diimplementasikan**:

- `src/` hanya berisi 2 file mock frontend statis:
  - `src/pages/rekap.tsx` — UI statis, tanpa request API, tanpa state.
  - `src/components/Stepper.tsx` — UI statis, `alert()` sebagai aksi.
- Tidak ada route API, auth/sesi, validasi Zod, rate limit, outbox, atau
  lapisan database di repo.
- Tidak ada URL staging/preview (T-13 belum jalan) → **black-box pass tidak
  mungkin dijalankan**.

Konsekuensi: acceptance criteria T-12 ("semua gate security lolos") **tidak
dapat dievaluasi** untuk scope backend. Rubric `security-review` terhadap kode
server (authentication, authorization, injection, secrets, cryptography,
SSRF/XXE/deserialization, business logic, dependencies) wajib dijalankan
setelah T-9 mendarat. Daftar attack path yang akan dikejar saat itu ada di
§"Backlog verifikasi T-9" bawah.

Yang **bisa** dan **sudah** direview sekarang: kontrak (`openapi.yaml`) vs
SPEC §8, konfigurasi header keamanan, CI secret-scan, `.env.example`,
`.gitignore`, dan kode frontend yang ada.

---

## FINDINGS

### 1. [next.config.ts:18-29] (LOW) — Header keamanan: `Permissions-Policy` tidak diimplementasikan [white-box] — **CLOSED (re-verify e706f99, 26 Okt 2026)**

- **Rubric item:** Secrets & config / hardening (SPEC §8.6).
- **Attack path:** browser → request ke route apapun (`/(.*)`) →
  `next.config.ts:18-29` (satu-satunya rule header) → respons tanpa header
  `Permissions-Policy` → kamera/mikro/geolocation tidak diblokir eksplisit
  oleh origin.
- **Bukti:** `docs/SPEC.md:529` mewajibkan
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
  `next.config.ts:23-26` hanya mengeset CSP, `X-Content-Type-Options`,
  `Referrer-Policy`.
- **Fix:** tambahkan
  `{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }`
  ke rule `/(.*)`.
- **Verifikasi penutupan (commit e706f99):** header
  `Permissions-Policy: camera=(), microphone=(), geolocation=()` hadir di
  rule `/(.*)` (`next.config.ts:37-40`), nilai persis sesuai SPEC §8.6.
  Working tree identik dengan e706f99 (`git diff` kosong) — tidak ada
  regresi.

### 2. [next.config.ts:18-29] (LOW) — `X-Robots-Tag: noindex, nofollow` tidak diimplementasikan [white-box] — **CLOSED (re-verify e706f99, 26 Okt 2026)**

- **Rubric item:** hardening / information exposure (SPEC §8.6).
- **Attack path:** crawler → URL `/toko/*`, `/masuk`, `/daftar`, `/mulai`,
  `/api/*` → respons tanpa `X-Robots-Tag` → defense-in-depth indexing
  bergantung hanya pada `robots.txt` (yang bisa diabaikan crawler nakal).
- **Bukti:** `docs/SPEC.md:531` mewajibkan header tersebut untuk kelima pola
  rute; `next.config.ts` tidak memuat rule berbasis path sama sekali.
- **Fix:** tambahkan rule header dengan `source` per pola rute
  (`/toko/:path*`, `/masuk`, `/daftar`, `/mulai`, `/api/:path*`) berisi
  `X-Robots-Tag: noindex, nofollow`.
- **Verifikasi penutupan (commit e706f99):** kelima pola rute hadir via
  `noindexRoutes` (`next.config.ts:19-25`) dan masing-masing dipetakan ke
  rule header `X-Robots-Tag: noindex, nofollow`
  (`next.config.ts:42-46`). Persis sesuai SPEC §8.6.

**Regresi check (e706f99):** CSP (8 direktif, tidak berubah),
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`poweredByHeader: false` — semua utuh. Tidak ada temuan baru di
`next.config.ts`.

---

## BLACK-BOX PASS

n/a: tidak ada environment preview/staging yang diserahkan (T-13 belum
dieksekusi). Wajib diulang setelah T-9 + deploy staging: personas
unauthenticated → test account; probe auth/session, authorization boundary
(horizontal IDOR lintas toko, vertical demo-vs-owner), input handling di
endpoint nyata, cookie flags, error verbosity, rate-limit absence pada aksi
sensitif.

---

## CATATAN KONTRAK (openapi.yaml vs SPEC §8) — untuk tech-lead

Bukan temuan keamanan (tidak ada path eksploitabel di level kontrak), tapi
perlu tindak lanjut pemilik kontrak:

1. **Rate limit umum tidak terdokumentasi.** SPEC §8.4 menetapkan
   "semua endpoint lain → 300/menit per store", tapi `openapi.yaml` hanya
   mencantumkan respons `429` di endpoint auth/imports/plans. Pertimbangkan
   pencatatan limit umum di deskripsi `info` agar kontrak lengkap.
2. **Path dokumen vs repo.** SPEC §8.6 mereferensikan
   `frontend/next.config.ts`; file aktual ada di root `next.config.ts`.
   Konsistensi ini milik tech-lead (SPEC frozen — perubahan hanya lewat
   tech-lead).

---

## CATATAN UNTUK FRONTEND-DEV (bukan temuan)

- `src/pages/rekap.tsx:65` memuat teks "Data akan tersimpan di localStorage
  untuk demo". FSD §0.4 dan SPEC §7c menetapkan outbox di **IndexedDB**
  (`idb-keyval` sudah ada di `package.json`). File ini masih mock statis
  tanpa path eksekusi, jadi bukan temuan — tapi jangan sampai kalimat ini
  jadi implementasi nyata: data sesi/toko tidak boleh di `localStorage`.

---

## YANG SUDAH LOLOS (terverifikasi)

- `.gitignore:13-19` — `.env`, `.env.*` di-ignore, `!.env.example`
  dikecualikan. Sesuai SPEC §8.3.
- `.env.example` — hanya placeholder (`***`, string kosong). Tidak ada
  rahasia nyata. Sesuai SPEC §8.3.
- `.github/workflows/ci.yml:52-55` — gitleaks secret scan sebagai gate CI
  blocking. Sesuai SPEC §8.3.
- `vercel.json:4-9` — cron path `/api/v1/cron/daily` sesuai kontrak.
- Kontrak `openapi.yaml`: cookie sesi didokumentasikan HttpOnly/Secure/
  SameSite=Lax; resource lintas toko → 404 (anti-enumeration); body
  `additionalProperties: false` + `.strict()` sesuai SPEC §8.2; batas baris
  (100/600/500/5.000) dan ukuran body 2 MB sesuai SPEC §8.2; error respons
  tanpa stack trace (`error.message` "aman ditampilkan ke pengguna");
  `Idempotency-Key` wajib di endpoint outbox (stock-ins, recap) sesuai
  FSD §0.4; `cronBearer` untuk `/cron/daily` sesuai SPEC S8.7/E1.

---

## BACKLOG VERIFIKASI T-9 (wajib saat backend mendarat)

White-box (kode) — setiap butuh `file:line` + exploit sketch sebelum jadi
temuan:

1. **AuthN:** argon2id param `memoryCost 19456, timeCost 2, parallelism 1`;
   token 32-byte acak, hanya SHA-256 di DB; cookie flags; perpanjangan
   sesi < 15 hari; demo expiry tepat pada `demo_expires_at`.
2. **CSRF/Origin:** cek `Origin == APP_ORIGIN`/`ALLOWED_ORIGINS` +
   `Content-Type: application/json` untuk semua non-GET; uji POST tanpa
   Origin → 403 `bad_origin`.
3. **AuthZ/IDOR:** `storeId` hanya dari sesi; test lintas toko untuk setiap
   endpoint ber-`{id}` → 404 (AC-SYS-5).
4. **Injeksi:** semua input user-controlled → sink (SQL via Drizzle
   parameterized; render React); uji nama barang `'; DROP TABLE--` dan
   payload XSS tersimpan apa adanya.
5. **Rate limit:** tabel `rate_limits` fixed window; batas per §8.4;
   **verifikasi trust boundary `x-forwarded-for`** (entri pertama) di
   Vercel — pastikan platform overwrite header, bukan append.
6. **Idempotency:** key sama + endpoint sama ≤ 7 hari → replay respons
   tersimpan; key sama + endpoint beda → 409.
7. **Outbox:** IndexedDB, UUID v4 sebagai `Idempotency-Key`, backoff
   30 dtk→10 mnt, tanpa duplikat saat kirim ulang (AC-SYS-3).
8. **Cron:** `CRON_SECRET` constant-time compare; tanpa token → 401.
9. **Error & log:** 500 tanpa stack trace ke klien; larangan log kata
   sandi/token/`Authorization`/email utuh/prompt AI (§8.5).
10. **Bisnis:** qty/harga negatif, stok minus → 422 `insufficient_stock`
    dalam transaksi; manipulasi `resetThresholds`/`completeOnboarding`.
11. **AI (T3):** prompt injection via nama barang → output ber-skema,
    validasi §5.5, fallback template; angka dihitung sistem.
12. **Dependensi:** audit lockfile (`pnpm-lock.yaml`) untuk pakar
    rentanan dikenal.

Black-box (setelah staging ada): personas unauthenticated → test account;
probe session behavior, horizontal/vertical authorization, input handling,
cookie flags, verbose errors, rate-limit absence, exposed paths. Evidence
standard: request shape + status + fragmen decisive (redacted); berhenti
saat reachability terbukti.

---

## TINDAK LANJUT TECH-LEAD (26 Okt 2026)

1. **2 LOW findings** (`next.config.ts`) → di-assign ke devops-engineer,
   patch bersama PR #1. **Re-verify dijadwalkan** setelah PR #1 diupdate
   (tech-lead kirim notifikasi). Yang akan diverifikasi: header
   `Permissions-Policy: camera=(), microphone=(), geolocation=()` dan
   `X-Robots-Tag: noindex, nofollow` untuk `/toko/*`, `/masuk`, `/daftar`,
   `/mulai`, `/api/*`; patch tidak merusak CSP/header lain yang sudah lolos.
2. **2 catatan kontrak** (rate limit 300/menit di `openapi.info`; path
   `frontend/next.config.ts` di SPEC §8.6) → diperbaiki tech-lead sebagai
   pemilik kontrak.
3. **Backlog 12 poin** → diteruskan ke backend-dev sebagai input wajib
   sebelum T-9 mulai.
4. **Staging URL** → akan dikirim tech-lead saat T-13 deploy jalan.
   Black-box pass dieksekusi begitu URL tersedia.

---

## VERDICT

**RE-VERIFY e706f99 (26 Okt 2026): SECURE** untuk surface yang di-review —
2 LOW findings CLOSED (Permissions-Policy + X-Robots-Tag hadir dengan nilai
persis SPEC §8.6), tanpa regresi pada CSP/X-Content-Type-Options/
Referrer-Policy, tanpa temuan baru di `next.config.ts`.

**FINDINGS — Lakoo T-12: 0 terbuka, 2 LOW sudah ditutup.**
**T-12 TIDAK BISA ditutup:** acceptance "semua gate security lolos"
mensyaratkan review backend (T-9) yang belum ada + black-box pass yang
belum mungkin. Re-review penuh dijadwalkan ulang setelah T-9
diimplementasikan dan staging URL tersedia.
