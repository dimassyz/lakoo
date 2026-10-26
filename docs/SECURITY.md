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

---

# EARLY PASS — T-9 irisan 2 (auth surface), 26 Okt 2026

Diminta tech-lead: review dulu 5 file auth paling kritikal sebelum irisan
3-5 membangun di atasnya. **Early pass saja — tidak menutup apa pun.**
T-12 penuh tetap TERBUKA.

File yang direview: `backend/src/http/session.ts`, `password.ts`,
`auth-context.ts`, `rate-limit.ts`, `validate.ts`, plus pendukung yang
menyelesaikan attack path: `routes/auth.ts`, `routes/me.ts`, `repo/auth.ts`,
`errors.ts`, `serialize.ts`, `app.ts`, `node-adapter.ts`,
`database/src/schema.ts`.

Suite backend: `vitest run backend/src/http` → **52/52 lolos** (5 file).

## Verifikasi klaim backend-dev

| #   | Klaim                                               | Verdict                     | Bukti                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login timing-equalized via dummy argon2 verify      | **HOLDS**                   | `routes/auth.ts:51-54` (equalizeTiming), `:113-117` (dipakai saat user undefined ATAU passwordHash null); kode & pesan respons identik (`errors.ts:100-102`); test `auth.test.ts:222`                                                                                                               |
| 2   | Rate limit tidak bisa lolos dua request bersamaan   | **HOLDS (by construction)** | `rate-limit.ts:39-47` — satu statement atomik `INSERT … ON CONFLICT (key) DO UPDATE … RETURNING count`; target konflik = PK `rate_limits.key` (`schema.ts:472`); row lock Postgres men-serialisasi update bersamaan. Catatan: tidak ada test konkurensi; atomicity dari desain SQL, bukan dari test |
| 3   | Unique violation 23505 → 409 email_taken, bukan 500 | **HOLDS**                   | `routes/auth.ts:56-63` (isUniqueViolation), `:92-96` (catch di createAccount); pre-check `:81-82` + unique index `users_email_key` pada kolom citext (`schema.ts:107,114`) — race maupun non-race sama-sama 409; test `auth.test.ts:116`                                                            |
| 4   | x-forwarded-for trust boundary di Vercel            | **UNCERTAIN**               | Lihat Finding 3 — klaim "Vercel menimpa" belum terverifikasi; perilaku overwrite-vs-append menentukan eksploitabilitas                                                                                                                                                                              |

## FINDINGS (early pass)

### E-1. [backend/src/http/auth-context.ts:39-52] (MEDIUM) — `demo_expires_at` tidak pernah diperiksa; sesi demo kedaluwarsa tetap berlaku [white-box]

- **Rubric:** Authentication (lifecycle sesi).
- **Spec:** SPEC §8.1 (`docs/SPEC.md:473`) — "Sesi demo berakhir tepat pada
  `demo_expires_at`."
- **Attack path:** pengunjung demo lama → GET `/me` dengan cookie lama →
  `auth-context.ts:31-36` (token ditemukan) → `:39` (cek
  `session.expiresAt` = 30 hari, belum lewat) → `:45-46`
  (`isDemo` hanya dipakai untuk SKIP renew, bukan cek expiry) → `:52`
  return SessionContext → `routes/me.ts:9-10` → 200 + data toko demo.
  Tidak ada satu baris pun yang membandingkan `store.demoExpiresAt` dengan
  `now` (grep: hanya muncul di komentar, `serialize.ts:11,28`, dan cek
  `isDemo`).
- **Exploit sketch:** mulai demo di T0 (cookie Max-Age 30 hari); di
  T0+25 jam — sudah lewat jendela demo 24 jam — kirim ulang cookie →
  akses API penuh ke toko demo tersebut sampai T0+30 hari (atau sampai
  cron menghapus klon demo, yang belum diimplementasikan di irisan 2).
- **Keterbatasan (jujur):** path baru reachable saat `/auth/demo`
  mendarat (irisan 3+) — itu sebabnya dilaporkan SEKARANG sebagai early
  pass, sebelum irisan 3-5 membangun di atas file ini. Dampak terbatas
  pada data demo milik sendiri (bukan lintas toko), tapi melanggar
  requirement eksplisit dan menahan baris sesi 30 hari.
- **Fix:** di `currentSession`, setelah cek expiry sesi, tambahkan:
  `if (found.store.demoExpiresAt !== null && found.store.demoExpiresAt.getTime() <= now.getTime()) { await deleteSessionByHash(deps.db, tokenHash); throw unauthenticated(); }`
- **Kondisi:** wajib ditutup SEBELUM endpoint `/auth/demo` dikenalkan.

### E-2. [backend/src/http/routes/auth.ts:106-111 + rate-limit.ts:37] (MEDIUM) — kunci rate limit login memuat email yang dikontrol penyerang → anggaran per-(IP+email) bisa dihindari dari satu IP [white-box]

- **Rubric:** Business logic / DoS (S1 credential stuffing, §8.7).
- **Attack path:** penyerang → `POST /auth/login` dengan email acak baru
  setiap request → `routes/auth.ts:106-111` membentuk kunci
  `IP:email` (unik per request) → `rate-limit.ts:39-47` membuat baris
  baru, `count=1 ≤ 5` → lolos → `routes/auth.ts:113-116`
  `equalizeTiming` → satu verifikasi argon2id penuh (m=19456 → puluhan
  ms CPU) → 401. Ulangi tanpa batas dari SATU IP.
- **Dampak:** (a) batas 5/15 menit per (IP+email) tidak membatasi total
  upaya login dari satu IP — penyerang cukup memutar email; (b) setiap
  percobaan membakar CPU argon2 (amplifikasi DoS); (c) tabel
  `rate_limits` mendapat baris permanen per kunci unik — tidak ada
  cleanup di `rate-limit.ts` → pertumbuhan tak terbatas.
- **Catatan penting:** implementasi **sesuai** SPEC §8.4 apa adanya
  ("5 / 15 menit per (IP + email)") — ini celah desain spec, bukan
  penyimpangan kode. Eskalasi ke tech-lead sesuai aturan tie-breaker.
- **Fix (opsi, keputusan tech-lead):** tambah anggaran per-IP global untuk
  endpoint auth (mis. 20/jam per IP lintas semua kunci email), atau
  jadikan IP sebagai kunci utama dengan email sebagai dimensi sekunder;
  plus job cleanup `rate_limits`.

### E-3. [backend/src/http/validate.ts:32-38] (MEDIUM, ketidakpastian dinyatakan) — `clientIp` memakai entri PERTAMA `x-forwarded-for`; perilaku Vercel (overwrite vs append) belum diverifikasi [white-box]

- **Rubric:** Authentication (rate-limit integrity) / defense-in-depth.
- **Attack path:** penyerang → request auth dengan header
  `X-Forwarded-For: 1.2.3.4` (palsu) → `validate.ts:35-37` mengambil
  entri `[0]` → kunci rate limit per-IP memakai IP palsu **jika**
  platform menambah (append) IP klien di belakang alih-alih menimpa
  (overwrite) → anggaran per-IP (register 5/jam, dan aturan per-IP
  masa depan) bisa dihindari dengan memutar nilai header.
- **Keterbatasan (jujur):** komentar kode (`validate.ts:33-34`) mengklaim
  Vercel menimpa header — klaim ini BELUM diverifikasi dan keyakinan saya
  terhadap perilaku persis Vercel < 80%. Bukan jalur authz (`storeId`
  hanya dari sesi — terverifikasi); dampak terbatas pada integritas rate
  limit.
- **Fix:** ambil entri **terkanan** `x-forwarded-for` (aman baik saat
  platform menimpa maupun menambah), atau utamakan `x-real-ip`; verifikasi
  dengan black-box test di staging: 6 percobaan login dari satu IP dengan
  `X-Forwarded-For` diputar — jika percobaan ke-6 TIDAK 429, header
  dipercaya apa adanya (bisa dipalsukan).
- **Test staging (definisi):** dari satu IP asli, kirim 6× POST
  `/auth/login` (email valid, password salah) dengan XFF
  `10.0.0.1` … `10.0.0.6`. 429 pada percobaan ke-6 = XFF ditimpa
  platform (aman). Tidak ada 429 = XFF dipercaya (perlu fix).

## Terverifikasi baik (tidak perlu ditindaklanjuti)

- Token 32-byte `randomBytes` → base64url (`session.ts:14-16`); hanya
  SHA-256 di DB (`session.ts:22-24`); unique index `sessions_token_hash_key`
  (`schema.ts:180`).
- Cookie `HttpOnly; Secure; SameSite=Lax; Path=/` + Max-Age
  (`session.ts:41-43`); logout clear dengan atribut sama (`session.ts:49`).
- Sesi kedaluwarsa dihapus saat dipakai (`auth-context.ts:39-42`); renew
  < 15 hari, sesi demo tidak pernah di-renews (`auth-context.ts:44-50`).
- argon2id eksplisit m=19456/t=2/p=1 (`password.ts:8-13`); verify gagal
  tidak melempar (`password.ts:23-27`).
- `storeId` hanya dari sesi — tidak ada `storeId` dari body/query di
  seluruh surface (`auth-context.ts:27-52`, `routes/me.ts`).
- Zod `.strict()` di skema auth (`routes/auth.ts:30-43`); field tak dikenal
  → 400 (`validate.ts:9-28`); test `auth.test.ts:132`.
- Gate Origin + `Content-Type: application/json` untuk semua non-GET
  (`app.ts:31-42`).
- Body di-cap 2 MB SEBELUM buffering (`node-adapter.ts:5,14-25`).
- Error handler: non-ApiError → pesan generik, tanpa stack trace ke klien
  (`app.ts:56-66`).
- `serialize.ts` memilih field eksplisit — `passwordHash` tidak pernah
  masuk respons (`serialize.ts:4-31`).
- Email di-lowercase sebelum dipakai; kolom citext konsisten dengan unique
  index (`schema.ts:107,114`; `routes/auth.ts:79,105`).

## VERDICT (early pass)

**FINDINGS — T-9 irisan 2: 3 MEDIUM (E-1, E-2, E-3), 0 HIGH/CRITICAL,
0 must-fix-blocks-merge.** Klaim 1-3 backend-dev HOLDS; klaim 4 UNCERTAIN
(lihat E-3). E-1 wajib ditutup sebelum `/auth/demo` mendarat. E-2 & E-3
menunggu adjudikasi tech-lead (E-2 = celah desain SPEC §8.4; E-3 butuh
verifikasi perilaku Vercel / black-box test di staging). Early pass tidak
menutup T-12; white-box penuh 12 attack point + black-box pass tetap
dijadwalkan setelah semua irisan T-9 mendarat + staging URL.

## DISPOSISI TECH-LEAD (26 Okt 2026)

- **E-1 → MUST-FIX, masuk slice sekarang.** Backend-dev sedang membangun
  `/auth/demo`; path jadi reachable di slice ini, jadi fix wajib mendarat
  bersamaan: cek `demoExpiresAt <= now` → hapus sesi + 401, lengkap dengan
  test. **Re-verify dijadwalkan** saat slice tersebut mendarat.
- **E-2 → SPEC §8.4 di-amendemen.** Tambahan anggaran global 30/15 menit
  per IP untuk semua endpoint `/auth/*`, di luar limit per-endpoint.
  Pertumbuhan tabel `rate_limits` ditangani cron harian. Implementasi
  diverifikasi bersama slice berikutnya.
- **E-3 → tanpa perubahan kode sekarang.** Rate limit adalah
  defense-in-depth, bukan authz. Black-box test security-reviewer di
  staging yang memutuskan; bila gagal → entri terkanan atau `x-real-ip`.
  Dicatat di SPEC §8.4.
