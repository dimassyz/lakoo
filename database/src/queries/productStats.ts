import { sql, type SQL } from "drizzle-orm";

/**
 * Satu query agregat, satu baris per barang aktif (SPEC §4.2).
 * Jendela `week_qty[k]` = `asOf − (7k−1) … asOf − 7(k−1)`; `week_qty[1]` = 7 hari terakhir.
 */
export const WEEK_WINDOWS = 7;

/** Cukup sempit supaya klien Neon maupun PGlite sama-sama memenuhi. */
export interface SqlRunner {
  execute(query: SQL): Promise<{ rows: unknown[] }>;
}

export interface ProductStat {
  productId: string;
  name: string;
  nameKey: string;
  unit: string;
  category: string | null;
  sellPrice: number;
  isComplementary: boolean;
  complementaryMaxStock: number | null;
  stock: number;
  lastCost: number;
  lastSaleDate: string | null;
  firstStockDate: string;
  /** `weekQty[0]` = minggu terakhir; 7 nilai. */
  weekQty: number[];
  sold28: number;
  saleDays28: number;
  sold90: number;
  archived: boolean;
}

interface RawStatRow {
  product_id: string;
  name: string;
  name_key: string;
  unit: string;
  category: string | null;
  sell_price: number | string;
  is_complementary: boolean;
  complementary_max_stock: number | string | null;
  stock: number | string;
  last_cost: number | string;
  last_sale_date: string | null;
  first_stock_date: string;
  week_qty: Array<number | string>;
  sold_28: number | string;
  sale_days_28: number | string;
  sold_90: number | string;
  archived: boolean;
}

const num = (value: number | string | null): number =>
  value === null ? 0 : Number(value);

function weekColumns(): SQL[] {
  return Array.from({ length: WEEK_WINDOWS }, (_, index) => {
    const high = WEEK_WINDOWS * index;
    const low = high + WEEK_WINDOWS - 1;
    return sql`SUM(qty) FILTER (WHERE sale_date >= as_of.d - ${sql.raw(String(low))} AND sale_date <= as_of.d - ${sql.raw(String(high))}) AS ${sql.raw(`week_${index + 1}`)}`;
  });
}

function weekArray(): SQL[] {
  return Array.from(
    { length: WEEK_WINDOWS },
    (_, index) => sql`COALESCE(sales.${sql.raw(`week_${index + 1}`)}, 0)`,
  );
}

/**
 * `COUNT(sale_date)` (bukan `COUNT(DISTINCT sale_date)`): ekuivalen karena
 * unique index `daily_sales_product_id_sale_date_key` pada (product_id,
 * sale_date) — dalam satu grup produk tiap tanggal muncul paling banyak sekali.
 * Bentuk DISTINCT memaksa Postgres men-de-duplikasi yang sudah dijamin unik;
 * EXPLAIN ANALYZE security-reviewer: Sort 182.500 baris ≈ 320–336 ms dari
 * 335–359 ms total. Satu baris, 359 → 239 ms, cross-check nilai IDENTICAL.
 */
function salesCte(storeId: string): SQL {
  return sql`sales AS (
      SELECT product_id,
        SUM(qty) AS sold,
        MAX(sale_date) AS last_sale_date,
        SUM(qty) FILTER (WHERE sale_date >= as_of.d - 27) AS sold_28,
        COUNT(sale_date) FILTER (WHERE sale_date >= as_of.d - 27) AS sale_days_28,
        SUM(qty) FILTER (WHERE sale_date >= as_of.d - 89) AS sold_90,
        ${sql.join(weekColumns(), sql`, `)}
      FROM daily_sales, as_of
      WHERE store_id = ${storeId} AND sale_date <= as_of.d
      GROUP BY product_id
    )`;
}

function statSelect(storeId: string, includeArchived: boolean): SQL {
  return sql`SELECT
      p.id AS product_id,
      p.name,
      p.name_key,
      p.unit,
      p.category,
      p.sell_price,
      p.is_complementary,
      p.complementary_max_stock,
      COALESCE(ins.qty, 0) - COALESCE(sales.sold, 0) + COALESCE(adj.delta, 0) AS stock,
      COALESCE(lc.unit_cost, 0) AS last_cost,
      sales.last_sale_date,
      COALESCE(fs.first_stock_date, (p.created_at AT TIME ZONE 'Asia/Jakarta')::date) AS first_stock_date,
      ARRAY[${sql.join(weekArray(), sql`, `)}] AS week_qty,
      COALESCE(sales.sold_28, 0) AS sold_28,
      COALESCE(sales.sale_days_28, 0) AS sale_days_28,
      COALESCE(sales.sold_90, 0) AS sold_90,
      (p.archived_at IS NOT NULL) AS archived
    FROM products p
    LEFT JOIN ins ON ins.product_id = p.id
    LEFT JOIN sales ON sales.product_id = p.id
    LEFT JOIN adj ON adj.product_id = p.id
    LEFT JOIN fs ON fs.product_id = p.id
    LEFT JOIN lc ON lc.product_id = p.id
    WHERE p.store_id = ${storeId} AND (${includeArchived} OR p.archived_at IS NULL)
    ORDER BY p.name ASC`;
}

function buildQuery(
  storeId: string,
  asOf: string,
  includeArchived: boolean,
): SQL {
  return sql`
    WITH as_of AS (SELECT ${asOf}::date AS d),
    ins AS (
      SELECT product_id, SUM(qty) AS qty
      FROM stock_ins, as_of
      WHERE store_id = ${storeId} AND received_on <= as_of.d
      GROUP BY product_id
    ),
    ${salesCte(storeId)},
    adj AS (
      SELECT product_id, SUM(qty_delta) AS delta
      FROM stock_adjustments, as_of
      WHERE store_id = ${storeId} AND adjusted_on <= as_of.d
      GROUP BY product_id
    ),
    fs AS (
      SELECT product_id, MIN(received_on) AS first_stock_date
      FROM stock_ins, as_of
      WHERE store_id = ${storeId} AND qty > 0 AND received_on <= as_of.d
      GROUP BY product_id
    ),
    lc AS (
      SELECT DISTINCT ON (product_id) product_id, unit_cost
      FROM stock_ins, as_of
      WHERE store_id = ${storeId} AND received_on <= as_of.d
      ORDER BY product_id, received_on DESC, created_at DESC
    )
    ${statSelect(storeId, includeArchived)}
  `;
}

function toStat(row: RawStatRow): ProductStat {
  return {
    productId: row.product_id,
    name: row.name,
    nameKey: row.name_key,
    unit: row.unit,
    category: row.category,
    sellPrice: num(row.sell_price),
    isComplementary: row.is_complementary,
    complementaryMaxStock:
      row.complementary_max_stock === null
        ? null
        : num(row.complementary_max_stock),
    stock: num(row.stock),
    lastCost: num(row.last_cost),
    lastSaleDate: row.last_sale_date,
    firstStockDate: row.first_stock_date,
    weekQty: row.week_qty.map(num),
    sold28: num(row.sold_28),
    saleDays28: num(row.sale_days_28),
    sold90: num(row.sold_90),
    archived: row.archived,
  };
}

/** Statistik semua barang aktif satu toko pada `asOf` (tanggal WIB `YYYY-MM-DD`). */
export async function productStats(
  db: SqlRunner,
  storeId: string,
  asOf: string,
  includeArchived = false,
): Promise<ProductStat[]> {
  const result = await db.execute(buildQuery(storeId, asOf, includeArchived));
  return (result.rows as unknown as RawStatRow[]).map(toStat);
}
