import { and, eq, sql } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import { actionPlans, weeklySummaries } from "../../../database/src/schema.ts";

export interface WeeklySales {
  salesTotal: number;
  productsSold: number;
}

export interface DueStep {
  planId: string;
  productId: string;
  productName: string;
  stepNo: number;
  title: string;
  dueOn: string;
}

export interface SavedSummary {
  weekStart: string;
  weekEnd: string;
  sentences: string[];
}

const num = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
};

/** Penjualan satu minggu penuh (SPEC §5.9 kalimat 1). */
export async function weeklySales(
  db: AnyDb,
  storeId: string,
  weekStart: string,
  weekEnd: string,
): Promise<WeeklySales> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(qty * unit_price), 0) AS total,
           COUNT(DISTINCT product_id) AS products
    FROM daily_sales
    WHERE store_id = ${storeId} AND sale_date BETWEEN ${weekStart} AND ${weekEnd}`);
  const row = result.rows[0] as
    { total?: unknown; products?: unknown } | undefined;
  return {
    salesTotal: num(row?.total),
    productsSold: num(row?.products),
  };
}

/** Tahap berjalan yang sudah jatuh tempo (dashboard `today.dueSteps`). */
export async function dueSteps(
  db: AnyDb,
  storeId: string,
  today: string,
): Promise<DueStep[]> {
  const result = await db.execute(sql`
    SELECT p.id AS plan_id, p.product_id, pr.name AS product_name,
           s.step_no, s.title, s.due_on
    FROM plan_steps s
    JOIN action_plans p ON p.id = s.plan_id
    JOIN products pr ON pr.id = p.product_id
    WHERE p.store_id = ${storeId}
      AND p.state = 'active'
      AND s.outcome = 'in_progress'
      AND s.due_on <= ${today}
    ORDER BY s.due_on ASC, pr.name ASC`);
  return (result.rows as Record<string, unknown>[]).map((row) => ({
    planId: String(row.plan_id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    stepNo: num(row.step_no),
    title: String(row.title),
    dueOn: String(row.due_on),
  }));
}

/** Rencana yang masuk state akhir dalam minggu itu (kalimat 3). */
export async function completedPlansInWeek(
  db: AnyDb,
  storeId: string,
  weekStart: string,
  weekEnd: string,
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS n FROM action_plans
    WHERE store_id = ${storeId}
      AND state IN ('completed', 'stopped')
      AND ended_on BETWEEN ${weekStart} AND ${weekEnd}`);
  return num((result.rows[0] as { n?: unknown } | undefined)?.n);
}

/**
 * Kas pulih dalam minggu itu (SPEC §5.7): pendapatan barang selama rencananya
 * berjalan, dipotong `locked_value_at_start` supaya tidak melebihi uang yang
 * semula terkunci.
 */
export async function recoveredInWeek(
  db: AnyDb,
  storeId: string,
  weekStart: string,
  weekEnd: string,
): Promise<number> {
  const result = await db.execute(sql`
    WITH windowed AS (
      SELECT product_id, started_on,
             COALESCE(ended_on, ${weekEnd}::date) AS end_on,
             COALESCE(locked_value_at_start, 0) AS locked
      FROM action_plans
      WHERE store_id = ${storeId}
        AND started_on <= ${weekEnd}
        AND COALESCE(ended_on, ${weekEnd}::date) >= ${weekStart}
    )
    SELECT COALESCE(SUM(LEAST(sold.total, w.locked)), 0) AS recovered
    FROM windowed w
    JOIN LATERAL (
      SELECT COALESCE(SUM(d.qty * d.unit_price), 0) AS total
      FROM daily_sales d
      WHERE d.product_id = w.product_id
        AND d.sale_date BETWEEN GREATEST(w.started_on, ${weekStart}::date)
                            AND LEAST(w.end_on, ${weekEnd}::date)
    ) sold ON true`);
  return num(
    (result.rows[0] as { recovered?: unknown } | undefined)?.recovered,
  );
}

export async function findWeeklySummary(
  db: AnyDb,
  storeId: string,
  weekStart: string,
): Promise<SavedSummary | undefined> {
  const rows = await db
    .select()
    .from(weeklySummaries)
    .where(
      and(
        eq(weeklySummaries.storeId, storeId),
        eq(weeklySummaries.weekStart, weekStart),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (row === undefined) return undefined;
  return { weekStart: row.weekStart, weekEnd: "", sentences: row.sentences };
}

/** Lazy create (SPEC §5.9): kalau sudah ada, tidak dibuat ulang. */
export async function saveWeeklySummary(
  db: AnyDb,
  storeId: string,
  weekStart: string,
  sentences: readonly string[],
): Promise<void> {
  await db
    .insert(weeklySummaries)
    .values({ storeId, weekStart, sentences: [...sentences] })
    .onConflictDoNothing();
}

/** Rencana aktif milik produk (dipakai dashboard untuk `planState`). */
export async function hasActivePlan(
  db: AnyDb,
  storeId: string,
  productId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: actionPlans.id })
    .from(actionPlans)
    .where(
      and(
        eq(actionPlans.storeId, storeId),
        eq(actionPlans.productId, productId),
        eq(actionPlans.state, "active"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
