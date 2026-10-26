import { sql } from "drizzle-orm";
import { nameKeyOf } from "../../../database/src/nameKey.ts";
import { storeIdempotent, type IdempotentTag } from "./idempotency.ts";
import type { AnyDb } from "../../../database/src/db.ts";
import { ApiError, notFound } from "../http/errors.ts";
import { todayIso } from "../http/routes/products.ts";

export const EDIT_WINDOW_DAYS = 7;

export interface StockInItem {
  id: string;
  batchId: string;
  productId: string;
  productName: string;
  receivedOn: string;
  qty: number;
  unitCost: number;
  createdAt: string;
  editable: boolean;
}

export interface StockInFilter {
  from: string;
  to: string;
  productId?: string;
}

export interface NewProductInput {
  name: string;
  unit?: string;
  category?: string | null;
  sellPrice: number;
}

export interface StockInLineInput {
  productId?: string;
  newProduct?: NewProductInput;
  qty: number;
  unitCost: number;
}

const num = (value: unknown): number =>
  value === null || value === undefined
    ? 0
    : typeof value === "number"
      ? value
      : Number(value);

const str = (value: unknown): string => (value === null ? "" : String(value));

const SELECT_COLUMNS = sql`si.id, si.batch_id, si.product_id, p.name AS product_name,
  si.received_on, si.qty, si.unit_cost, si.created_at`;

function toItem(row: Record<string, unknown>, now: Date): StockInItem {
  const created = new Date(String(row.created_at));
  const ageDays = (now.getTime() - created.getTime()) / 86_400_000;
  return {
    id: str(row.id),
    batchId: str(row.batch_id),
    productId: str(row.product_id),
    productName: str(row.product_name),
    receivedOn: String(row.received_on).slice(0, 10),
    qty: num(row.qty),
    unitCost: num(row.unit_cost),
    createdAt: created.toISOString(),
    editable: String(row.kind) === "purchase" && ageDays <= EDIT_WINDOW_DAYS,
  };
}

export async function listStockIns(
  db: AnyDb,
  storeId: string,
  filter: StockInFilter,
  now: Date,
): Promise<StockInItem[]> {
  const productClause =
    filter.productId === undefined
      ? sql``
      : sql` AND si.product_id = ${filter.productId}`;
  const result = await db.execute(sql`
    SELECT ${SELECT_COLUMNS}, si.kind
    FROM stock_ins si JOIN products p ON p.id = si.product_id
    WHERE si.store_id = ${storeId} AND si.kind = 'purchase'
      AND si.received_on BETWEEN ${filter.from}::date AND ${filter.to}::date
      ${productClause}
    ORDER BY si.received_on DESC, si.created_at DESC`);
  return (result.rows as Record<string, unknown>[]).map((row) =>
    toItem(row, now),
  );
}

export async function findStockIn(
  db: AnyDb,
  storeId: string,
  id: string,
  now: Date,
): Promise<StockInItem | null> {
  const result = await db.execute(sql`
    SELECT ${SELECT_COLUMNS}, si.kind
    FROM stock_ins si JOIN products p ON p.id = si.product_id
    WHERE si.store_id = ${storeId} AND si.id = ${id} LIMIT 1`);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row === undefined ? null : toItem(row, now);
}

/**
 * Stok terendah yang pernah terjadi untuk satu barang, dihitung dari akumulasi
 * harian. Koreksi yang menurunkan qty di masa lalu menurunkan semua hari
 * sesudahnya, jadi minimum kumulatif cukup untuk membuktikan "tidak ada hari
 * yang negatif" (SPEC §5.8 / kontrak PATCH stock-ins).
 */
export async function minStockEver(
  db: AnyDb,
  storeId: string,
  productId: string,
  today: string,
): Promise<number> {
  const result = await db.execute(sql`
    WITH span AS (
      SELECT MIN(d) AS start FROM (
        SELECT MIN(received_on) AS d FROM stock_ins WHERE product_id = ${productId}
        UNION ALL SELECT MIN(sale_date) FROM daily_sales WHERE product_id = ${productId}
        UNION ALL SELECT MIN(adjusted_on) FROM stock_adjustments WHERE product_id = ${productId}
      ) t
    ),
    days AS (
      SELECT g::date AS day FROM span, generate_series(span.start, ${today}::date, '1 day') g
      WHERE span.start IS NOT NULL
    ),
    deltas AS (
      SELECT day,
        COALESCE((SELECT SUM(qty) FROM stock_ins WHERE product_id = ${productId} AND received_on = day), 0)
        - COALESCE((SELECT SUM(qty) FROM daily_sales WHERE product_id = ${productId} AND sale_date = day), 0)
        + COALESCE((SELECT SUM(qty_delta) FROM stock_adjustments WHERE product_id = ${productId} AND adjusted_on = day), 0) AS delta
      FROM days
    )
    SELECT MIN(running) AS min_stock FROM (
      SELECT SUM(delta) OVER (ORDER BY day) AS running FROM deltas
    ) r`);
  const row = result.rows[0] as { min_stock: unknown } | undefined;
  return num(row?.min_stock);
}

/** Nama barang unik per toko (partial index pada `name_key` untuk baris aktif). */
export async function nameKeyTaken(
  db: AnyDb,
  storeId: string,
  nameKey: string,
): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT 1 AS ada FROM products WHERE store_id = ${storeId} AND name_key = ${nameKey} AND archived_at IS NULL LIMIT 1`,
  );
  return result.rows.length > 0;
}

export interface CreatedBatch {
  batchId: string;
  items: StockInItem[];
}

/** Satu nota = satu `batch_id`; barang baru dibuat tanpa baris opening. */
export async function createStockInBatch(
  db: AnyDb,
  storeId: string,
  receivedOn: string,
  lines: StockInLineInput[],
  now: Date,
  idempotent?: IdempotentTag,
): Promise<CreatedBatch> {
  return db.transaction(async (tx) => {
    const typed = tx as unknown as AnyDb;
    const batchId = crypto.randomUUID();
    const items: StockInItem[] = [];

    for (const line of lines) {
      let productId = line.productId;
      if (productId === undefined && line.newProduct !== undefined) {
        const created = await typed.execute(sql`
          INSERT INTO products (store_id, name, name_key, unit, category, sell_price)
          VALUES (${storeId}, ${line.newProduct.name}, ${nameKeyOf(line.newProduct.name)},
                  ${line.newProduct.unit ?? "pcs"}, ${line.newProduct.category ?? null},
                  ${line.newProduct.sellPrice})
          RETURNING id`);
        productId = str((created.rows[0] as { id: unknown }).id);
      }
      if (productId === undefined) throw new Error("Baris tanpa productId");

      const inserted = await typed.execute(sql`
        INSERT INTO stock_ins (store_id, product_id, batch_id, received_on, qty, unit_cost, kind, created_at)
        VALUES (${storeId}, ${productId}, ${batchId}, ${receivedOn}::date, ${line.qty}, ${line.unitCost}, 'purchase', ${now.toISOString()}::timestamptz)
        RETURNING id`);
      const id = str((inserted.rows[0] as { id: unknown }).id);
      const item = await findStockIn(typed, storeId, id, now);
      if (item !== null) items.push(item);
    }

    const result = { batchId, items };
    // Di dalam tx yang sama: crash setelah commit tanpa rekaman = kirim ulang menggandakan stok.
    if (idempotent !== undefined) {
      await storeIdempotent(
        typed,
        storeId,
        idempotent.key,
        idempotent.endpoint,
        idempotent.statusCode,
        result,
      );
    }
    return result;
  });
}

export interface StockInPatch {
  qty?: number;
  unitCost?: number;
  receivedOn?: string;
}

/** Baris harus ada, milik toko ini, dan masih dalam jendela 7 hari. */
async function requireEditable(
  db: AnyDb,
  storeId: string,
  id: string,
  now: Date,
): Promise<StockInItem> {
  const item = await findStockIn(db, storeId, id, now);
  if (item === null) {
    throw new ApiError(404, "not_found", "Baris barang masuk tidak ditemukan.");
  }
  if (!item.editable) {
    throw new ApiError(
      409,
      "edit_window_closed",
      "Baris ini sudah lewat 7 hari dan tidak bisa diubah.",
    );
  }
  return item;
}

/**
 * W-2: serialisasi semua mutasi stok per barang. Dua PATCH bersamaan yang
 * sama-sama lolos `minStockEver` bisa membuat stok negatif; lock baris produk
 * menutup celah itu dan dilepas otomatis saat transaksi selesai.
 */
export async function lockProduct(
  db: AnyDb,
  storeId: string,
  productId: string,
): Promise<void> {
  await db.execute(
    sql`SELECT 1 FROM products WHERE id = ${productId} AND store_id = ${storeId} FOR UPDATE`,
  );
}

/** Koreksi yang membuat stok hari mana pun negatif harus ditolak (kontrak PATCH). */
async function requireNonNegativeStock(
  db: AnyDb,
  storeId: string,
  productId: string,
  today: string,
): Promise<void> {
  const lowest = await minStockEver(db, storeId, productId, today);
  if (lowest < 0) {
    throw new ApiError(
      422,
      "insufficient_stock",
      `Stok tercatat hanya ${lowest < 0 ? lowest : 0}`,
    );
  }
}

export async function updateStockIn(
  db: AnyDb,
  storeId: string,
  id: string,
  patch: StockInPatch,
  now: Date,
): Promise<StockInItem> {
  return db.transaction(async (tx) => {
    const typed = tx as unknown as AnyDb;
    const current = await requireEditable(typed, storeId, id, now);
    // Kunci sebelum membaca riwayat: dua PATCH bersamaan tidak boleh sama-sama lolos.
    await lockProduct(typed, storeId, current.productId);

    await typed.execute(sql`
      UPDATE stock_ins SET
        qty = ${patch.qty ?? current.qty},
        unit_cost = ${patch.unitCost ?? current.unitCost},
        received_on = ${patch.receivedOn ?? current.receivedOn}::date
      WHERE store_id = ${storeId} AND id = ${id}`);

    await requireNonNegativeStock(
      typed,
      storeId,
      current.productId,
      todayIso(now),
    );

    const updated = await findStockIn(typed, storeId, id, now);
    if (updated === null) throw notFound();
    return updated;
  });
}

export async function deleteStockIn(
  db: AnyDb,
  storeId: string,
  id: string,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const typed = tx as unknown as AnyDb;
    const current = await requireEditable(typed, storeId, id, now);
    // Kunci sebelum mengubah riwayat — pola yang sama dengan updateStockIn.
    await lockProduct(typed, storeId, current.productId);
    await typed.execute(
      sql`DELETE FROM stock_ins WHERE store_id = ${storeId} AND id = ${id}`,
    );
    await requireNonNegativeStock(
      typed,
      storeId,
      current.productId,
      todayIso(now),
    );
  });
}
