/**
 * Benchmark sekali jalan untuk target kontrak `/auth/demo` ≤ 5 detik.
 * Bukan bagian suite: jalankan manual `node backend/src/repo/demo.bench.ts`.
 * `vitest.config.mts` hanya memuat `*.test.ts`, jadi file ini tidak ikut gate.
 */
import { createTestDb } from "../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../database/src/db.ts";
import { generateDemo } from "../../../database/src/demo/generator.ts";
import { seedDemoTemplate } from "../../../database/src/demo/seed.ts";
import { cloneDemoTemplate } from "./demo.ts";

const AS_OF = "2026-11-09";
const LIMIT_MS = 5_000;
const RUNS = 3;

const { db, client } = await createTestDb();
try {
  const seeded = await seedDemoTemplate(db as AnyDb, generateDemo(AS_OF));
  console.log(`[bench] template: ${JSON.stringify(seeded)}`);

  const runs: number[] = [];
  for (let attempt = 0; attempt < RUNS; attempt += 1) {
    const started = performance.now();
    await cloneDemoTemplate(db as AnyDb, new Date("2026-11-09T03:00:00Z"));
    runs.push(performance.now() - started);
  }

  const best = Math.min(...runs);
  console.log(
    `[bench] klon penuh: ${runs.map((r) => Math.round(r)).join(" / ")} ms`,
  );
  console.log(`[bench] terbaik ${Math.round(best)} ms — batas ${LIMIT_MS} ms`);
  console.log(best < LIMIT_MS ? "[bench] LULUS" : "[bench] MELEWATI BATAS");
  process.exitCode = best < LIMIT_MS ? 0 : 1;
} finally {
  await client.close();
}
