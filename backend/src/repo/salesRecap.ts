import { and, eq, inArray, sql } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import { actionPlans } from "../../../database/src/schema.ts";
import { ApiError, type ErrorCode, type ErrorLine } from "../http/errors.ts";
import { storeIdempotent, type IdempotentTag } from "./idempotency.ts";
import { lockProduct } from "./stockIns.ts";
import { loadProductSummaries } from "../http/productView.ts";

export interface RecapRow {
  productId: string;
  name: string;
  unit: string;
  sellPrice: number;
  morningStock: number;
  stockInOnDate: number;
  recordedQty: number;
  currentStock: number;
}

export type SaleMode = "quantity" | "opname";

export interface RecapInputLine {
  productId: string;
  qty?: number;
  countedStock?: number;
}

export interface RecapResultLine {
  productId: string;
  soldQty: number;
  stockAfter: number;
  status: string;
}

export interface RecapResult {
  date: string;
  mode: SaleMode;
  lines: RecapResultLine[];
  totalSold: number;
  totalRevenue: number;
}

const num = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
};

/** Satu query: sembilan CTE jendela stok, dipisah dari pemetaan baris. */
const recapQuery = (storeId: string, date: string, today: string) => sql`
  WITH ins_before AS (
    SELECT product_id, SUM(qty) AS qty FROM stock_ins
    WHERE store_id = ${storeId} AND received_on < ${date}::date GROUP BY product_id
  ),
  ins_on AS (
    SELECT product_id, SUM(qty) AS qty FROM stock_ins
    WHERE store_id = ${storeId} AND received_on = ${date}::date GROUP BY product_id
  ),
  ins_all AS (
    SELECT product_id, SUM(qty) AS qty FROM stock_ins
    WHERE store_id = ${storeId} AND received_on <= ${today}::date GROUP BY product_id
  ),
  sales_before AS (
    SELECT product_id, SUM(qty) AS qty FROM daily_sales
    WHERE store_id = ${storeId} AND sale_date < ${date}::date GROUP BY product_id
  ),
  sales_on AS (
    SELECT product_id, SUM(qty) AS qty FROM daily_sales
    WHERE store_id = ${storeId} AND sale_date = ${date}::date GROUP BY product_id
  ),
  sales_all AS (
    SELECT product_id, SUM(qty) AS qty FROM daily_sales
    WHERE store_id = ${storeId} AND sale_date <= ${today}::date GROUP BY product_id
  ),
  adj_before AS (
    SELECT product_id, SUM(qty_delta) AS delta FROM stock_adjustments
    WHERE store_id = ${storeId} AND adjusted_on < ${date}::date GROUP BY product_id
  ),
  adj_on AS (
    SELECT product_id, SUM(qty_delta) AS delta FROM stock_adjustments
    WHERE store_id = ${storeId} AND adjusted_on = ${date}::date GROUP BY product_id
  ),
  adj_all AS (
    SELECT product_id, SUM(qty_delta) AS delta FROM stock_adjustments
    WHERE store_id = ${storeId} AND adjusted_on <= ${today}::date GROUP BY product_id
  )
  SELECT p.id AS product_id, p.name, p.unit, p.sell_price,
    COALESCE(ib.qty, 0) - COALESCE(sb.qty, 0)
      + COALESCE(ab.delta, 0) + COALESCE(ao.delta, 0) AS morning_stock,
    COALESCE(io.qty, 0) AS stock_in_on_date,
    COALESCE(so.qty, 0) AS recorded_qty,
    COALESCE(ia.qty, 0) - COALESCE(sa.qty, 0) + COALESCE(aa.delta, 0) AS current_stock
  FROM products p
  LEFT JOIN ins_before ib ON ib.product_id = p.id
  LEFT JOIN ins_on io ON io.product_id = p.id
  LEFT JOIN ins_all ia ON ia.product_id = p.id
  LEFT JOIN sales_before sb ON sb.product_id = p.id
  LEFT JOIN sales_on so ON so.product_id = p.id
  LEFT JOIN sales_all sa ON sa.product_id = p.id
  LEFT JOIN adj_before ab ON ab.product_id = p.id
  LEFT JOIN adj_on ao ON ao.product_id = p.id
  LEFT JOIN adj_all aa ON aa.product_id = p.id
  WHERE p.store_id = ${storeId} AND p.archived_at IS NULL
  ORDER BY p.name ASC`;

export async function recapRows(
  db: AnyDb,
  storeId: string,
  date: string,
  today: string,
): Promise<RecapRow[]> {
  const result = await db.execute(recapQuery(storeId, date, today));

  return (result.rows as Record<string, unknown>[]).map((row) => ({
    productId: String(row.product_id),
    name: String(row.name),
    unit: String(row.unit),
    sellPrice: num(row.sell_price),
    morningStock: num(row.morning_stock),
    stockInOnDate: num(row.stock_in_on_date),
    recordedQty: num(row.recorded_qty),
    currentStock: num(row.current_stock),
  }));
}

/** Ada penjualan tercatat untuk tanggal itu. */
export async function hasSalesOn(
  db: AnyDb,
  storeId: string,
  date: string,
): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT 1 AS ada FROM daily_sales WHERE store_id = ${storeId} AND sale_date = ${date}::date LIMIT 1`,
  );
  return result.rows.length > 0;
}

/** `sold` per baris sesuai mode; `null` bila opname melebihi stok tersedia. */
function soldFor(
  line: RecapInputLine,
  mode: SaleMode,
  row: RecapRow,
): number | null {
  if (mode === "quantity") return line.qty ?? 0;
  const sold = row.morningStock + row.stockInOnDate - (line.countedStock ?? 0);
  return sold < 0 ? null : sold;
}

const lineError = (
  index: number,
  code: string,
  message: string,
): ErrorLine => ({
  index,
  code,
  message,
});

/** qty 0 menghapus baris; selain itu upsert (mengganti, bukan menambah). */
async function applyLine(
  tx: AnyDb,
  storeId: string,
  date: string,
  row: RecapRow,
  soldQty: number,
  source: SaleMode,
): Promise<void> {
  if (soldQty === 0) {
    await tx.execute(
      sql`DELETE FROM daily_sales WHERE store_id = ${storeId} AND product_id = ${row.productId} AND sale_date = ${date}::date`,
    );
    return;
  }
  await tx.execute(sql`
    INSERT INTO daily_sales (store_id, product_id, sale_date, qty, unit_price, source)
    VALUES (${storeId}, ${row.productId}, ${date}::date, ${soldQty}, ${row.sellPrice}, ${source})
    ON CONFLICT (product_id, sale_date)
    DO UPDATE SET qty = EXCLUDED.qty, unit_price = EXCLUDED.unit_price, updated_at = now()`);
}

/** Baris aktif yang stoknya kini 0 pindah ke `sold_out` (SPEC §5.8). */
async function closeSoldOutPlans(
  tx: AnyDb,
  storeId: string,
  today: string,
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) return;
  await tx
    .update(actionPlans)
    .set({ state: "sold_out", endedOn: today })
    .where(
      and(
        eq(actionPlans.storeId, storeId),
        eq(actionPlans.state, "active"),
        inArray(actionPlans.productId, productIds),
      ),
    );
}

interface AppliedLine {
  row: RecapRow;
  soldQty: number;
}

/** Terjemahkan baris masukan jadi `sold` per barang; kumpulkan penolakan per indeks. */
function resolveLines(
  rows: Map<string, RecapRow>,
  mode: SaleMode,
  input: RecapInputLine[],
): { applied: AppliedLine[]; errors: ErrorLine[] } {
  const errors: ErrorLine[] = [];
  const applied: AppliedLine[] = [];

  input.forEach((line, index) => {
    const row = rows.get(line.productId);
    if (row === undefined) {
      errors.push(lineError(index, "not_found", "Barang tidak ditemukan."));
      return;
    }
    const sold = soldFor(line, mode, row);
    if (sold === null) {
      errors.push(
        lineError(
          index,
          "opname_negative",
          `Stok opname melebihi stok tersedia (${row.morningStock + row.stockInOnDate}).`,
        ),
      );
      return;
    }
    applied.push({ row, soldQty: sold });
  });

  return { applied, errors };
}

/** BR-16: setelah semua baris diterapkan, stok hari ini tiap barang terlibat harus ≥ 0. */
function stockErrors(
  applied: AppliedLine[],
  input: RecapInputLine[],
  stockOf: (productId: string) => number,
): ErrorLine[] {
  return applied
    .filter(({ row }) => stockOf(row.productId) < 0)
    .map(({ row }) =>
      lineError(
        input.findIndex((line) => line.productId === row.productId),
        "insufficient_stock",
        `Stok tercatat hanya ${stockOf(row.productId)}`,
      ),
    );
}

function toResult(
  date: string,
  mode: SaleMode,
  applied: AppliedLine[],
  summaries: Map<string, { stock: number; status: string }>,
): RecapResult {
  const lines: RecapResultLine[] = applied.map(({ row, soldQty }) => ({
    productId: row.productId,
    soldQty,
    stockAfter: summaries.get(row.productId)?.stock ?? 0,
    status: summaries.get(row.productId)?.status ?? "sehat",
  }));
  return {
    date,
    mode,
    lines,
    totalSold: lines.reduce((sum, line) => sum + line.soldQty, 0),
    totalRevenue: applied.reduce(
      (sum, { row, soldQty }) => sum + soldQty * row.sellPrice,
      0,
    ),
  };
}

/** Terapkan semua baris lalu kembalikan ringkasan produk setelah simpan. */
async function applyAll(
  tx: AnyDb,
  storeId: string,
  date: string,
  today: string,
  applied: AppliedLine[],
  mode: SaleMode,
): Promise<Map<string, { stock: number; status: string }>> {
  for (const { row, soldQty } of applied) {
    await applyLine(tx, storeId, date, row, soldQty, mode);
  }
  return new Map(
    (await loadProductSummaries(tx, storeId, today)).map((item) => [
      item.id,
      item,
    ]),
  );
}

/**
 * Simpan rekap penjualan satu tanggal (SPEC §5.8). All-or-nothing: satu baris
 * ditolak → transaksi dibatalkan → 422 dengan daftar `lines[]`.
 */
/** Satu bentuk galat 422 untuk kedua jalur penolakan (semua-atau-tidak-sama-sekali). */
function fail(code: ErrorCode, lines: ErrorLine[]): never {
  throw new ApiError(422, code, "Ada baris yang perlu dicek.", { lines });
}

/** W-2: serialisasi per barang sebelum cek stok, supaya BR-16 tidak bisa di-race. */
async function lockAll(
  db: AnyDb,
  storeId: string,
  applied: { row: { productId: string } }[],
): Promise<void> {
  for (const { row } of applied) await lockProduct(db, storeId, row.productId);
}

export async function saveRecap(
  db: AnyDb,
  storeId: string,
  date: string,
  mode: SaleMode,
  input: RecapInputLine[],
  today: string,
  idempotent?: IdempotentTag,
): Promise<RecapResult> {
  return db.transaction(async (tx) => {
    const typed = tx as unknown as AnyDb;
    const rows = new Map(
      (await recapRows(typed, storeId, date, today)).map((row) => [
        row.productId,
        row,
      ]),
    );

    const { applied, errors } = resolveLines(rows, mode, input);
    await lockAll(typed, storeId, applied);
    if (errors.length > 0) fail("validation_error", errors);

    const summaries = await applyAll(
      typed,
      storeId,
      date,
      today,
      applied,
      mode,
    );
    const stockOf = (productId: string): number =>
      summaries.get(productId)?.stock ?? 0;

    const negative = stockErrors(applied, input, stockOf);
    if (negative.length > 0) fail("insufficient_stock", negative);

    await closeSoldOutPlans(
      typed,
      storeId,
      today,
      applied
        .filter(({ row }) => stockOf(row.productId) === 0)
        .map(({ row }) => row.productId),
    );

    const result = toResult(date, mode, applied, summaries);
    // W-1: rekaman idempotensi ikut transaksi — bukan sesudahnya.
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
