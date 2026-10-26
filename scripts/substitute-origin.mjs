/**
 * Substitusi placeholder APP_ORIGIN di file statis public/ (SPEC §7b).
 *
 * robots.txt + sitemap.xml butuh URL ABSOLUT, tapi file statis tidak bisa
 * membaca env. Placeholder `https://APP_ORIGIN` diganti dengan nilai
 * APP_ORIGIN milik deployment ini (Preview vs Production dipisah per
 * SPEC §8.3 — setiap environment substitusi nilai sendiri).
 *
 * Guard: HANYA jalan di build Vercel (VERCEL=1). Lokal/CI memakai
 * placeholder supaya working tree tidak terpolusi. Di Vercel tanpa
 * APP_ORIGIN → gagal keras: deploy tanpa origin = robots.txt menunjuk host
 * yang tidak ada, dan itu baru ketahuan saat crawl (berhari-hari).
 *
 * Catatan risiko: `VERCEL=1 pnpm build` di lokal AKAN menulis ulang dua
 * file itu di working tree — itu satu-satunya jalan yang guard ini tidak
 * menutup.
 *
 * llms.txt / llms-full.txt TIDAK diproses: isinya jalur relatif, nol URL
 * absolut (sengaja), jadi nol placeholder untuk diganti.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILES = ["public/robots.txt", "public/sitemap.xml"];
const PLACEHOLDER = "https://APP_ORIGIN";

if (process.env.VERCEL !== "1") {
  console.log(
    "[substitute-origin] skip (bukan build Vercel) - placeholder dipertahankan",
  );
  process.exit(0);
}

const origin = process.env.APP_ORIGIN;
if (!origin) {
  console.error(
    "[substitute-origin] ERROR: APP_ORIGIN tidak diset di build Vercel",
  );
  process.exit(1);
}

for (const file of FILES) {
  const before = readFileSync(file, "utf8");
  if (!before.includes(PLACEHOLDER)) {
    console.log(`[substitute-origin] ${file}: nol placeholder, dilewati`);
    continue;
  }
  writeFileSync(file, before.replaceAll(PLACEHOLDER, origin));
  console.log(`[substitute-origin] ${file}: ${PLACEHOLDER} -> ${origin}`);
}
