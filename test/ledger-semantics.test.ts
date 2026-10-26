import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../database/src/test/pglite.ts";
import {
  productStats,
  type ProductStat,
} from "../database/src/queries/productStats.ts";

/**
 * Verifikasi semantik ledger stok — SPEC §4.2.
 *
 * Test QA independen: fixture dibangun tangan (bukan dari generator), dan
 * setiap ekspektasi dihitung manual dari rumus SPEC §4.2:
 *
 *   stok(asOf) = Σ stock_ins.qty(received_on ≤ asOf)
 *              − Σ daily_sales.qty(sale_date ≤ asOf)
 *              + Σ stock_adjustments.qty_delta(adjusted_on ≤ asOf)
 *
 * CATATAN KONTRAK (26 Okt 2026): `week_qty` = **7 jendela × 7 hari**
 * (SPEC §4.2 `week_qty[1..7]`, FSD "Grafik 7 minggu", kontrak
 * minItems/maxItems 7). Permintaan mengubah guard jadi 8 nilai DIBATALKAN
 * tech-lead 26 Okt 2026 (instruksi 8-jendela basi); kalau muncul lagi,
 * tolak dan lapor ke tech-lead. Selama kode backend masih di state 8,
 * guard ini MERAH dengan benar — itu memang tugasnya.
 */

const AS_OF = "2026-11-09";

function shift(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

type Db = Awaited<ReturnType<typeof createTestDb>>;

let ctx: Db;
let seq = 0;

beforeAll(async () => {
  ctx = await createTestDb();
}, 60_000);

afterAll(async () => {
  await ctx.client.close();
});

async function insertRow(
  table: string,
  columns: Record<string, string | number | null>,
): Promise<void> {
  const entries = Object.entries(columns);
  await ctx.client.query(
    `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) ` +
      `VALUES (${entries.map((_, index) => `$${index + 1}`).join(", ")})`,
    entries.map(([, value]) => value),
  );
}

async function makeStore(): Promise<string> {
  seq += 1;
  const result = await ctx.client.query<{ id: string }>(
    "INSERT INTO users (email) VALUES ($1) RETURNING id",
    [`ledger${seq}@lakoo.local`],
  );
  const userId = result.rows[0]?.id;
  if (userId === undefined) throw new Error("user tidak terbuat");
  const store = await ctx.client.query<{ id: string }>(
    "INSERT INTO stores (owner_user_id, name, store_type) VALUES " +
      "($1, $2, 'toko_kelontong') RETURNING id",
    [userId, `Toko Ledger ${seq}`],
  );
  const storeId = store.rows[0]?.id;
  if (storeId === undefined) throw new Error("toko tidak terbuat");
  return storeId;
}

async function makeProduct(
  storeId: string,
  name: string,
  sellPrice = 5_000,
  createdAt?: string,
): Promise<string> {
  const columns: Record<string, string | number | null> = {
    store_id: storeId,
    name,
    name_key: name.toLowerCase(),
    sell_price: sellPrice,
  };
  if (createdAt !== undefined) columns.created_at = createdAt;
  const result = await ctx.client.query<{ id: string }>(
    `INSERT INTO products (${Object.keys(columns).join(", ")}) VALUES ` +
      `(${Object.keys(columns)
        .map((_, index) => `$${index + 1}`)
        .join(", ")}) ` +
      "RETURNING id",
    Object.values(columns),
  );
  const id = result.rows[0]?.id;
  if (id === undefined) throw new Error(`produk ${name} tidak terbuat`);
  return id;
}

async function insertStockIn(
  storeId: string,
  productId: string,
  receivedOn: string,
  qty: number,
  unitCost: number,
  createdAt?: string,
): Promise<void> {
  const columns: Record<string, string | number | null> = {
    store_id: storeId,
    product_id: productId,
    received_on: receivedOn,
    qty,
    unit_cost: unitCost,
    kind: "purchase",
    batch_id: crypto.randomUUID(),
  };
  if (createdAt !== undefined) columns.created_at = createdAt;
  await insertRow("stock_ins", columns);
}

async function insertSale(
  storeId: string,
  productId: string,
  saleDate: string,
  qty: number,
): Promise<void> {
  await insertRow("daily_sales", {
    store_id: storeId,
    product_id: productId,
    sale_date: saleDate,
    qty,
    unit_price: 5_000,
    source: "quantity",
  });
}

async function insertAdjustment(
  storeId: string,
  productId: string,
  adjustedOn: string,
  qtyDelta: number,
): Promise<void> {
  await insertRow("stock_adjustments", {
    store_id: storeId,
    product_id: productId,
    adjusted_on: adjustedOn,
    qty_delta: qtyDelta,
    reason: "correction",
  });
}

function statOf(stats: ProductStat[], name: string): ProductStat {
  const found = stats.find((row) => row.name === name);
  if (found === undefined) throw new Error(`statistik ${name} tidak ada`);
  return found;
}

async function seedStockIns(storeId: string, productId: string): Promise<void> {
  // 100 unit 30 hari lalu, lalu 50 + 20 pada hari yang sama (tie received_on;
  // created_at lebih baru menang → harga beli terakhir 4.000).
  await insertStockIn(storeId, productId, shift(AS_OF, -30), 100, 3_000);
  await insertStockIn(
    storeId,
    productId,
    shift(AS_OF, -10),
    50,
    3_500,
    `${shift(AS_OF, -10)} 08:00:00+00`,
  );
  await insertStockIn(
    storeId,
    productId,
    shift(AS_OF, -10),
    20,
    4_000,
    `${shift(AS_OF, -10)} 09:00:00+00`,
  );
}

async function seedSales(storeId: string, productId: string): Promise<void> {
  // Batas jendela week_qty[0] (asOf−6..asOf) dan week_qty[1] (asOf−13..asOf−7).
  await insertSale(storeId, productId, shift(AS_OF, -6), 3);
  await insertSale(storeId, productId, AS_OF, 2);
  await insertSale(storeId, productId, shift(AS_OF, -7), 4);
  // Batas sold_28 (>= asOf−27) dan di luar 28 hari.
  await insertSale(storeId, productId, shift(AS_OF, -27), 5);
  await insertSale(storeId, productId, shift(AS_OF, -28), 7);
  // Batas sold_90 (>= asOf−89) dan di luar 90 hari.
  await insertSale(storeId, productId, shift(AS_OF, -89), 1);
  await insertSale(storeId, productId, shift(AS_OF, -90), 8);
  // Penjualan masa depan: tidak boleh dihitung pada asOf.
  await insertSale(storeId, productId, shift(AS_OF, 1), 6);
}

async function seedAdjustments(
  storeId: string,
  productId: string,
): Promise<void> {
  // +10 yang berlaku pada asOf; +500 di masa depan tidak boleh dihitung.
  await insertAdjustment(storeId, productId, shift(AS_OF, -3), 10);
  await insertAdjustment(storeId, productId, shift(AS_OF, 2), 500);
}

describe("ledger stok pada satu produk (SPEC §4.2)", () => {
  let storeId = "";
  let productId = "";

  beforeAll(async () => {
    storeId = await makeStore();
    productId = await makeProduct(storeId, "Mie Instan");
    await seedStockIns(storeId, productId);
    await seedSales(storeId, productId);
    await seedAdjustments(storeId, productId);
  });

  it("stok = (100+50+20) − (3+2+4+5+7+1+8) + 10 = 150", async () => {
    const stats = await productStats(ctx.db, storeId, AS_OF);
    expect(statOf(stats, "Mie Instan").stock).toBe(150);
  });

  it("harga beli terakhir = baris dengan created_at paling baru", async () => {
    const stats = await productStats(ctx.db, storeId, AS_OF);
    expect(statOf(stats, "Mie Instan").lastCost).toBe(4_000);
  });

  it("week_qty[1..7]: [0]=asOf−6..asOf (5), [1]=asOf−13..asOf−7 (4), [3]/[4] memuat sale asOf−27/−28", async () => {
    const stats = await productStats(ctx.db, storeId, AS_OF);
    // Jendela k = [asOf−(7k+6), asOf−7k]: [3]=asOf−27..asOf−21 (5),
    // [4]=asOf−34..asOf−28 (7). Lihat CATATAN KONTRAK di header file.
    expect(statOf(stats, "Mie Instan").weekQty).toEqual([5, 4, 0, 5, 7, 0, 0]);
  });

  it("sold_28 = 14 (batas asOf−27), sale_days_28 = 4, sold_90 = 22 (batas asOf−89)", async () => {
    const stats = await productStats(ctx.db, storeId, AS_OF);
    const stat = statOf(stats, "Mie Instan");
    expect(stat.sold28).toBe(14);
    expect(stat.saleDays28).toBe(4);
    expect(stat.sold90).toBe(22);
  });

  it("last_sale_date = asOf (penjualan masa depan diabaikan)", async () => {
    const stats = await productStats(ctx.db, storeId, AS_OF);
    expect(statOf(stats, "Mie Instan").lastSaleDate).toBe(AS_OF);
  });

  it("first_stock_date = barang masuk qty > 0 paling awal", async () => {
    const stats = await productStats(ctx.db, storeId, AS_OF);
    expect(statOf(stats, "Mie Instan").firstStockDate).toBe(shift(AS_OF, -30));
  });

  it("asOf berbeda menghasilkan stok berbeda (cutoff benar-benar tanggal)", async () => {
    // Pada asOf−7 (2026-11-02): barang masuk yang berlaku = 100+50+20 = 170;
    // penjualan ≤ 2026-11-02 = 4+5+7+1+8 = 25; penyesuaian (−3 hari) belum
    // berlaku. 170 − 25 = 145.
    const stats = await productStats(ctx.db, storeId, shift(AS_OF, -7));
    expect(statOf(stats, "Mie Instan").stock).toBe(145);
  });
});

describe("first_stock_date tanpa barang masuk qty > 0 (SPEC §4.2)", () => {
  it("jatuh ke created_at produk dalam waktu WIB", async () => {
    const storeId = await makeStore();
    // created_at 2026-11-09 18:00 UTC = 2026-11-10 01:00 WIB → tanggal WIB.
    const productId = await makeProduct(
      storeId,
      "Barang Tanpa Stok",
      5_000,
      "2026-11-09 18:00:00+00",
    );
    await insertStockIn(storeId, productId, shift(AS_OF, -30), 0, 3_000);
    const stats = await productStats(ctx.db, storeId, AS_OF);
    expect(statOf(stats, "Barang Tanpa Stok").firstStockDate).toBe(
      "2026-11-10",
    );
  });
});

describe("isolasi data (SPEC §4.2, §8.1)", () => {
  it("barang arsip tidak muncul di stats", async () => {
    const storeId = await makeStore();
    await makeProduct(storeId, "Barang Aktif");
    const archived = await makeProduct(storeId, "Barang Arsip");
    await ctx.client.exec(
      `UPDATE products SET archived_at = now() WHERE id = '${archived}'`,
    );
    const stats = await productStats(ctx.db, storeId, AS_OF);
    expect(stats.map((row) => row.name)).toEqual(["Barang Aktif"]);
  });

  it("stats hanya memuat barang toko sendiri", async () => {
    const storeA = await makeStore();
    const storeB = await makeStore();
    await makeProduct(storeA, "Milik Toko A");
    await makeProduct(storeB, "Milik Toko B");
    const stats = await productStats(ctx.db, storeA, AS_OF);
    expect(stats.map((row) => row.name)).toEqual(["Milik Toko A"]);
  });
});

describe("stok negatif di stats mentah (SPEC §4.2 vs §5.1)", () => {
  it("query tidak membatasi stok ke 0 — status stok_habis ditentukan domain", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId, "Barang Minus");
    await insertStockIn(storeId, productId, shift(AS_OF, -5), 4, 3_000);
    await insertSale(storeId, productId, shift(AS_OF, -2), 10);
    const stats = await productStats(ctx.db, storeId, AS_OF);
    expect(statOf(stats, "Barang Minus").stock).toBe(-6);
  });
});

/**
 * TEMUAN QA-01 (dilaporkan ke tech-lead, owner perbaikan: backend-dev).
 *
 * Skenario reachable tanpa data mustahil: `productStats` dipanggil dengan asOf
 * HISTORIS (mis. `week_end` minggu lalu untuk ringkasan mingguan, SPEC §5.9).
 * Baris `stock_ins` yang `received_on`-nya setelah asOf adalah baris sah yang
 * sudah lewat validasi API (§8.2 hanya melarang tanggal MASA DEPAN).
 *
 * - CTE `ins` sudah memfilter `received_on <= as_of.d` → stok benar.
 * - CTE `lc` (harga beli terakhir) TIDAK memfilter asOf → memakai harga beli
 *   dari barang masuk yang belum terjadi pada asOf tersebut.
 *
 * SPEC §4.2 menaruh "harga beli terakhir" di dalam kontrak stats per-asOf
 * ("satu baris per produk aktif untuk parameter asOf"); pembacaan yang
 * konsisten adalah semua turunan ikut asOf.
 *
 * ADJUDIKASI tech-lead (26 Okt 2026): KONFIRMASI — SPEC §4.2 adalah agregat
 * as-of; CTE `lc` wajib memfilter `received_on <= asOf`. Fix di-assign ke
 * backend-dev. Guard ini tetap RED sampai fix mendarat; kalau impl sudah
 * diperbaiki, test ini hijau dan bisa dilepas dari daftar temuan.
 */
describe("cutoff asOf untuk harga beli terakhir (TEMUAN QA-01)", () => {
  let storeId = "";
  let productId = "";

  beforeAll(async () => {
    storeId = await makeStore();
    productId = await makeProduct(storeId, "Barang Cutoff");
    await insertStockIn(storeId, productId, shift(AS_OF, -10), 50, 3_000);
    await insertStockIn(storeId, productId, shift(AS_OF, -2), 10, 9_999);
  });

  it("stok menghormati cutoff asOf (barang masuk setelah asOf tidak dihitung)", async () => {
    const stats = await productStats(ctx.db, storeId, shift(AS_OF, -5));
    expect(statOf(stats, "Barang Cutoff").stock).toBe(50);
  });

  it("harga beli terakhir juga wajib menghormati cutoff asOf", async () => {
    const stats = await productStats(ctx.db, storeId, shift(AS_OF, -5));
    // Baris 9_999 diterima asOf−2, jadi pada asOf−5 harga beli = 3_000.
    expect(statOf(stats, "Barang Cutoff").lastCost).toBe(3_000);
  });
});
