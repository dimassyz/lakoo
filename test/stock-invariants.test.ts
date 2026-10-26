import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../database/src/test/pglite.ts";
import { findIdempotent } from "../backend/src/repo/idempotency.ts";
import { saveRecap } from "../backend/src/repo/salesRecap.ts";
import { deleteStockIn } from "../backend/src/repo/stockIns.ts";

/**
 * Invarian jalur stok/uang — lapis kedua QA (diusulkan backend-dev setelah
 * W-1/W-2/W-9 mendarat). Ekspektasi diturunkan dari SPEC §5.8 (BR-16,
 * all-or-nothing), SPEC §7 (idempotensi), dan kontrak openapi — BUKAN dari
 * membaca implementasi.
 *
 * CATATAN KETERBATASAN (jujur, bukan skip): PGlite adalah single-writer
 * in-process, jadi kondisi balap sungguhan (dua koneksi menulis bersamaan)
 * TIDAK dapat direproduksi di sini. Yang diuji adalah invariannya terhadap
 * state TER-KOMIT: penulisan yang membuat stok(today) negatif harus ditolak
 * walaupun penulisan lain sudah commit lebih dulu. Proteksi `FOR UPDATE`
 * (W-2) terhadap balap level-baris di Postgres nyata menjadi wilayah test
 * integrasi backend.
 */

type Db = Awaited<ReturnType<typeof createTestDb>>;

/** Tanggal bisnis tetap supaya hasil deterministik (SPEC §3.6). */
const TODAY = "2026-11-09";
const OPENING_ON = "2026-10-01";

let ctx: Db;
let seq = 0;

beforeAll(async () => {
  ctx = await createTestDb();
}, 60_000);

afterAll(async () => {
  await ctx.client.close();
});

async function makeStore(): Promise<string> {
  seq += 1;
  const user = await ctx.client.query<{ id: string }>(
    "INSERT INTO users (email) VALUES ($1) RETURNING id",
    [`inv${seq}@lakoo.local`],
  );
  const userId = user.rows[0]?.id;
  if (userId === undefined) throw new Error("user tidak terbuat");
  const store = await ctx.client.query<{ id: string }>(
    "INSERT INTO stores (owner_user_id, name, store_type) VALUES " +
      "($1, $2, 'toko_kelontong') RETURNING id",
    [userId, `Toko Invarian ${seq}`],
  );
  const storeId = store.rows[0]?.id;
  if (storeId === undefined) throw new Error("toko tidak terbuat");
  return storeId;
}

async function makeProduct(storeId: string, name: string): Promise<string> {
  const result = await ctx.client.query<{ id: string }>(
    "INSERT INTO products (store_id, name, name_key, sell_price) VALUES " +
      "($1, $2, $3, 24000) RETURNING id",
    [storeId, name, name.toLowerCase()],
  );
  const id = result.rows[0]?.id;
  if (id === undefined) throw new Error(`produk ${name} tidak terbuat`);
  return id;
}

async function seedOpeningStock(
  storeId: string,
  productId: string,
  qty: number,
): Promise<void> {
  await ctx.client.query(
    "INSERT INTO stock_ins (store_id, product_id, received_on, qty, " +
      "unit_cost, kind, batch_id) VALUES ($1, $2, $3, $4, 3000, " +
      "'opening', gen_random_uuid())",
    [storeId, productId, OPENING_ON, qty],
  );
}

async function salesCountOn(saleDate: string): Promise<number> {
  const result = await ctx.client.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM daily_sales WHERE sale_date = $1",
    [saleDate],
  );
  return result.rows[0]?.n ?? -1;
}

describe("BR-16 — stok tidak boleh negatif lewat rekap (SPEC §5.8)", () => {
  it("qty melebihi stok tercatat ditolak 422 dan tidak menulis apa pun", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId, "Barang Oversell");
    await seedOpeningStock(storeId, productId, 10);

    await expect(
      saveRecap(
        ctx.db,
        storeId,
        TODAY,
        "quantity",
        [{ productId, qty: 12 }],
        TODAY,
      ),
    ).rejects.toMatchObject({ status: 422, code: "insufficient_stock" });

    // All-or-nothing: baris ditolak → tidak ada penjualan tertulis.
    expect(await salesCountOn(TODAY)).toBe(0);
  });

  it("rekap kedua tetap dievaluasi terhadap stok TERKINI setelah rekap pertama commit", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId, "Barang Berurutan");
    await seedOpeningStock(storeId, productId, 10);

    // Rekap pertama menghabiskan stok: 10 terjual hari ini → stok(today) 0.
    const first = await saveRecap(
      ctx.db,
      storeId,
      TODAY,
      "quantity",
      [{ productId, qty: 10 }],
      TODAY,
    );
    expect(first.totalSold).toBe(10);

    // Rekap kedua untuk tanggal lampau: pada tanggal itu stok masih 5,
    // TAPI stok(today) akan menjadi −5. SPEC §5.8 BR-16 menuntut
    // stok(today) ≥ 0 → harus ditolak.
    const backdated = shiftIso(TODAY, -2);
    await expect(
      saveRecap(
        ctx.db,
        storeId,
        backdated,
        "quantity",
        [{ productId, qty: 5 }],
        TODAY,
      ),
    ).rejects.toMatchObject({ status: 422, code: "insufficient_stock" });

    expect(await salesCountOn(backdated)).toBe(0);
    // Penjualan rekap pertama tetap utuh (transaksi lain tidak dibatalkan).
    expect(await salesCountOn(TODAY)).toBe(1);
  });
});

describe("W-9 — jendela replay idempotensi 7 hari (SPEC §7)", () => {
  it("rekaman fresh diputar balik; rekaman lebih tua dari 7 hari diproses ulang", async () => {
    const storeId = await makeStore();
    const freshKey = crypto.randomUUID();
    const staleKey = crypto.randomUUID();
    const insert = (key: string, age: string) =>
      ctx.client.query(
        "INSERT INTO idempotency_keys (store_id, key, endpoint, " +
          "status_code, response_body, created_at) VALUES " +
          "($1, $2, 'PUT /sales/recap', 200, '{\"ok\":true}'::jsonb, " +
          `now() - interval '${age}')`,
        [storeId, key],
      );
    await insert(freshKey, "1 day");
    await insert(staleKey, "8 days");

    const fresh = await findIdempotent(ctx.db, storeId, freshKey);
    expect(fresh).toMatchObject({ statusCode: 200 });

    // Lebih tua dari jendela → null → pemanggil memproses ulang, bukan
    // memutar balik respons basi (batas sama dengan cleanup cron).
    expect(await findIdempotent(ctx.db, storeId, staleKey)).toBeNull();
  });
});

function shiftIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

describe("W-2 jalur ketiga — deleteStockIn tidak boleh membuat stok negatif", () => {
  it("hapus barang masuk ditolak bila stok jadi negatif; baris tetap ada", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId, "Barang Delete Guard");
    // created_at dekat fixture TODAY + kind 'purchase' (baris 'opening'
    // memang tidak editable by design) supaya lolos window 7 hari dan
    // sampai ke guard stok.
    await ctx.client.query(
      "INSERT INTO stock_ins (store_id, product_id, received_on, qty, " +
        "unit_cost, kind, batch_id, created_at) VALUES " +
        "($1, $2, $3, 10, 3000, 'purchase', gen_random_uuid(), $4)",
      [storeId, productId, OPENING_ON, "2026-11-08 10:00:00+00"],
    );
    // Jual 8 hari ini → stok 2.
    await saveRecap(
      ctx.db,
      storeId,
      TODAY,
      "quantity",
      [{ productId, qty: 8 }],
      TODAY,
    );
    const row = await ctx.client.query<{ id: string }>(
      "SELECT id FROM stock_ins WHERE product_id = $1",
      [productId],
    );
    const stockInId = row.rows[0]?.id;
    expect(stockInId).toBeDefined();

    // Hapus barang masuk 10 unit → stok jadi −8 di setiap tanggal → DITOLAK.
    await expect(
      deleteStockIn(
        ctx.db,
        storeId,
        stockInId ?? "",
        new Date(`${TODAY}T10:00:00+07:00`),
      ),
    ).rejects.toMatchObject({ status: 422 });

    // All-or-nothing: baris barang masuk masih ada.
    const after = await ctx.client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM stock_ins WHERE product_id = $1",
      [productId],
    );
    expect(after.rows[0]?.n).toBe(1);
  });
});

describe("W-2 jalur ketiga — window edit 7 hari (FSD §8)", () => {
  it("hapus barang masuk yang sudah lewat 7 hari ditolak 409 edit_window_closed", async () => {
    const storeId = await makeStore();
    const productId = await makeProduct(storeId, "Barang Window Closed");
    // Umur dihitung dari created_at (bukan received_on); 20 hari > 7.
    await ctx.client.query(
      "INSERT INTO stock_ins (store_id, product_id, received_on, qty, " +
        "unit_cost, kind, batch_id, created_at) VALUES " +
        "($1, $2, $3, 10, 3000, 'purchase', gen_random_uuid(), $4)",
      [storeId, productId, OPENING_ON, "2026-10-20 10:00:00+00"],
    );
    const row = await ctx.client.query<{ id: string }>(
      "SELECT id FROM stock_ins WHERE product_id = $1",
      [productId],
    );
    const stockInId = row.rows[0]?.id;
    expect(stockInId).toBeDefined();

    await expect(
      deleteStockIn(
        ctx.db,
        storeId,
        stockInId ?? "",
        new Date(`${TODAY}T10:00:00+07:00`),
      ),
    ).rejects.toMatchObject({ status: 409, code: "edit_window_closed" });

    const after = await ctx.client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM stock_ins WHERE product_id = $1",
      [productId],
    );
    expect(after.rows[0]?.n).toBe(1);
  });
});
