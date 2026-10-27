import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../test/pglite.ts";
import { productStats } from "./productStats.ts";

/**
 * BENCHMARK KANDIDAT 1 — artefak pengukuran, BUKAN bagian suite produksi.
 *
 * Dipakai untuk mengukur dampak kandidat 1 (single-pass stock_ins: CTE `fs`
 * dilebur ke `ins` via `MIN(received_on) FILTER (WHERE qty > 0)`).
 *
 * HASIL — dan KOREKSI PENTING soal cara mengukurnya:
 *
 * Sesi A (beban mesin tinggi, baseline & sesudah diukur terpisah):
 *   sebelum : best 313,0 / 316,8 ms
 *   sesudah : best 196,4 / 202,8 ms
 *   gain    : −116,6 / −114,0 ms   ← ANGKA INI BERGANTUNG BEBAN MESIN
 *
 * Sesi B (back-to-back, kondisi beban sama — 6 run baseline, 1 run sesudah):
 *   baseline : best 241,9 · 232,8 · 234,5 · 227,6 · 234,0 · 241,1 ms
 *              (rentang 227,6–241,9; satu sampel outlier 380,8 ms di run ke-2)
 *   sesudah  : best 198,1 ms
 *   gain     : −30 … −44 ms          ← INI angka yang bisa direproduksi
 *
 * Pelajaran: "sesudah" STABIL (196–203 ms di dua sesi), tapi "sebelum"
 * bergerak 227–317 ms tergantung beban. Gain karena itu didominasi variansi
 * beban mesin, bukan perbaikan stabil. Mengukur baseline dan sesudah di waktu
 * berbeda dengan beban berbeda = mengukur lingkungan, bukan perubahan.
 * (Satu sampel 380,8 ms di baseline run ke-2 = alasan best-of-N dipakai.)
 *
 * Kandidat 1 akhirnya DITUTUP (tidak mendarat) karena margin native sudah
 * 143,1 ms tanpa optimasi. File ini disimpan sebagai SUMBER angka di atas —
 * tanpa itu, −115 ms adalah reported data yang tak bisa direproduksi.
 *
 * Cara pakai: checkout versi productStats.ts yang diukur, jalankan
 *   ./node_modules/.bin/vitest run database/src/queries/bench-k1.test.ts
 * dan baca baris "KANDIDAT-1 best=... mean=... sampel=[...]".
 */

describe("benchmark kandidat 1 (fixture produksi)", () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;

  beforeAll(async () => {
    ctx = await createTestDb();
    await ctx.client.exec(`
      INSERT INTO users (email) VALUES ('perf@lakoo.local');
      INSERT INTO stores (owner_user_id, name, store_type)
        SELECT id, 'Perf', 'toko_kelontong' FROM users WHERE email = 'perf@lakoo.local';
      INSERT INTO products (store_id, name, name_key, sell_price)
        SELECT s.id, 'Barang ' || g, 'barang ' || g, 5000
        FROM stores s, generate_series(1, 500) g WHERE s.name = 'Perf';
      INSERT INTO stock_ins (store_id, product_id, received_on, qty, unit_cost, kind, batch_id)
        SELECT p.store_id, p.id, '2025-01-01', 10000, 3000, 'opening', gen_random_uuid()
        FROM products p JOIN stores s ON s.id = p.store_id WHERE s.name = 'Perf';
      INSERT INTO daily_sales (store_id, product_id, sale_date, qty, unit_price, source)
        SELECT p.store_id, p.id, d::date, 1, p.sell_price, 'import'
        FROM products p JOIN stores s ON s.id = p.store_id,
             generate_series('2025-01-01'::date, '2025-12-31'::date, '1 day') d
        WHERE s.name = 'Perf';
    `);
  });

  afterAll(async () => {
    await ctx.client.close();
  });

  it("ukur 5 sampel", async () => {
    const result = await ctx.db.execute(
      sql`SELECT id FROM stores WHERE name = 'Perf' LIMIT 1`,
    );
    const storeId = (result.rows[0] as { id: string } | undefined)?.id;
    expect(storeId).toBeTruthy();
    const id = storeId as string;

    await productStats(ctx.db, id, "2025-12-31"); // warmup

    const samples: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const startedAt = performance.now();
      await productStats(ctx.db, id, "2025-12-31");
      samples.push(performance.now() - startedAt);
    }
    const best = Math.min(...samples);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    process.stdout.write(
      `KANDIDAT-1 best=${best.toFixed(1)}ms mean=${mean.toFixed(1)}ms ` +
        `sampel=[${samples.map((v) => v.toFixed(1)).join(", ")}]\n`,
    );
  }, 300_000);
});
