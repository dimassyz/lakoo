import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateDemo, stockOn, type DemoData } from "../demo/generator.ts";
import { seedDemoTemplate } from "../demo/seed.ts";
import { createTestDb } from "../test/pglite.ts";
import { productStats, type ProductStat } from "./productStats.ts";

const AS_OF = "2026-11-09";
const STORE_DAYS = 90;

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let data: DemoData;
let stats: ProductStat[];

function daysBetween(earlier: string, later: string): number {
  return Math.round(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) /
      86_400_000,
  );
}

beforeAll(async () => {
  ctx = await createTestDb();
  data = generateDemo(AS_OF);
  await seedDemoTemplate(ctx.db, data);
  stats = await productStats(ctx.db, (await firstStoreId()) as string, AS_OF);
}, 120_000);

afterAll(async () => {
  await ctx.client.close();
});

async function firstStoreId(): Promise<string | undefined> {
  const result = await ctx.db.execute(
    sql`SELECT id FROM stores WHERE is_demo_template LIMIT 1`,
  );
  return (result.rows[0] as { id: string } | undefined)?.id;
}

function statFor(name: string): ProductStat {
  const found = stats.find((row) => row.name === name);
  if (found === undefined) throw new Error(`Statistik ${name} tidak ada`);
  return found;
}

describe("migrasi + productStats di PGlite", () => {
  it("menghasilkan satu baris per barang aktif", () => {
    expect(stats).toHaveLength(data.products.length);
  });

  it("stok, tanggal, dan harga beli cocok dengan ledger generator", () => {
    for (const product of data.products) {
      const stat = statFor(product.name);
      expect(stat.stock, `stok ${product.name}`).toBe(stockOn(product, AS_OF));
      expect(stat.lastSaleDate, `laku terakhir ${product.name}`).toBe(
        product.sales.at(-1)?.saleDate ?? null,
      );
      expect(stat.firstStockDate, `stok pertama ${product.name}`).toBe(
        product.stockIns
          .filter((row) => row.qty > 0)
          .map((row) => row.receivedOn)
          .sort()[0],
      );
      expect(stat.lastCost, `harga beli ${product.name}`).toBe(
        product.lastCost,
      );
      expect(stat.sellPrice).toBe(product.sellPrice);
    }
  });

  it("week_qty[1..7] cocok dengan jendela 7 hari SPEC §4.2", () => {
    for (const product of data.products) {
      const stat = statFor(product.name);
      expect(stat.weekQty).toHaveLength(7);
      stat.weekQty.forEach((qty, index) => {
        const low = index * 7;
        const high = low + 6;
        const expected = product.sales.reduce((acc, sale) => {
          const offset = daysBetween(sale.saleDate, AS_OF);
          return offset >= low && offset <= high ? acc + sale.qty : acc;
        }, 0);
        expect(qty, `${product.name} week_qty[${index + 1}]`).toBe(expected);
      });
    }
  });

  it("sold_28, sale_days_28, dan sold_90 cocok", () => {
    for (const product of data.products) {
      const stat = statFor(product.name);
      const within = (days: number) =>
        product.sales.filter(
          (sale) => daysBetween(sale.saleDate, AS_OF) < days,
        );
      expect(stat.sold28, `sold_28 ${product.name}`).toBe(
        within(28).reduce((acc, sale) => acc + sale.qty, 0),
      );
      expect(stat.saleDays28, `sale_days_28 ${product.name}`).toBe(
        within(28).length,
      );
      expect(stat.sold90, `sold_90 ${product.name}`).toBe(
        within(90).reduce((acc, sale) => acc + sale.qty, 0),
      );
    }
  });

  it("distribusi status dari query memenuhi SPEC §10.2", () => {
    const counts: Record<string, number> = {};
    for (const stat of stats) {
      const days = stat.lastSaleDate
        ? daysBetween(stat.lastSaleDate, AS_OF)
        : daysBetween(stat.firstStockDate, AS_OF);
      const [w1 = 0, w2 = 0, w3 = 0, w4 = 0] = stat.weekQty;
      let status: string;
      if (stat.stock <= 0) status = "stok_habis";
      else if (days <= 14) {
        status = w4 > w3 && w3 > w2 && w2 > w1 && w4 >= 4 ? "waspada" : "sehat";
      } else if (days <= 45) status = "sekarat";
      else status = "mati";
      counts[status] = (counts[status] ?? 0) + 1;
    }
    expect(counts.sehat).toBeGreaterThanOrEqual(55);
    expect(counts.waspada).toBeGreaterThanOrEqual(6);
    expect(counts.sekarat).toBeGreaterThanOrEqual(8);
    expect(counts.mati).toBeGreaterThanOrEqual(8);
    expect(counts.stok_habis).toBeGreaterThanOrEqual(2);
  });

  it("menyimpan 2 rencana demo dengan 3 tahap masing-masing", () => {
    return (async () => {
      const plans = await ctx.db.execute(
        sql`SELECT count(*)::int AS plans FROM action_plans`,
      );
      const steps = await ctx.db.execute(
        sql`SELECT count(*)::int AS steps FROM plan_steps`,
      );
      expect((plans.rows[0] as { plans: number }).plans).toBe(
        data.plans.length,
      );
      expect((steps.rows[0] as { steps: number }).steps).toBe(
        data.plans.length * 3,
      );
    })();
  });
});

describe("kinerja query stats (SPEC §4.2: ≤ 300 ms untuk 500 barang × 365 hari)", () => {
  it("tetap di bawah 300 ms", async () => {
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
    const storeId = await firstStoreIdOf("Perf");
    const startedAt = performance.now();
    const rows = await productStats(ctx.db, storeId, "2025-12-31");
    const elapsedMs = performance.now() - startedAt;
    expect(rows).toHaveLength(500);
    expect(elapsedMs).toBeLessThan(300);
  }, 300_000);
});

async function firstStoreIdOf(name: string): Promise<string> {
  const result = await ctx.db.execute(
    sql`SELECT id FROM stores WHERE name = ${name} LIMIT 1`,
  );
  const row = result.rows[0] as { id: string } | undefined;
  if (row === undefined) throw new Error(`Toko ${name} tidak ada`);
  return row.id;
}
