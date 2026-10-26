import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "drizzle-orm";
import type { AnyDb } from "../../../../database/src/db.ts";
import { shiftIsoDate } from "../../../../database/src/demo/generator.ts";
import { currentSession } from "../auth-context.ts";
import { loadWeeklySummary } from "../weeklySummaryView.ts";
import { listPlans } from "../../repo/plans.ts";
import { todayIso } from "./products.ts";

export interface ResultDeps {
  db: AnyDb;
  now: () => Date;
}

/** Rencana yang pernah dijalankan: semua state kecuali `suggested`. */
const STARTED_STATES = [
  "active",
  "completed",
  "exhausted",
  "stopped",
  "sold_out",
];
const FINISHED_STATES = ["completed", "exhausted", "stopped", "sold_out"];

interface Totals {
  total: number;
  last30: number;
}

const num = (value: unknown): number =>
  value === null || value === undefined ? 0 : Number(value);

/**
 * Kas pulih (SPEC §5.7) per rencana, dijumlahkan. Satu query dengan dua agregat
 * supaya `totalRecovered` dan `recovered30d` tidak mungkin berbeda dasarnya.
 */
async function recoveredTotals(
  db: AnyDb,
  storeId: string,
  today: string,
  from30: string,
): Promise<Totals> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(s.qty * s.unit_price), 0) AS total,
      COALESCE(SUM(s.qty * s.unit_price) FILTER (WHERE s.sale_date >= ${from30}::date), 0) AS last30
    FROM action_plans p
    JOIN daily_sales s ON s.product_id = p.product_id
    WHERE p.store_id = ${storeId}
      AND p.state <> 'suggested'
      AND p.started_on IS NOT NULL
      AND s.sale_date BETWEEN p.started_on AND COALESCE(p.ended_on, ${today}::date)`);
  const row = result.rows[0] as { total: unknown; last30: unknown } | undefined;
  return { total: num(row?.total), last30: num(row?.last30) };
}

async function countByState(
  db: AnyDb,
  storeId: string,
  states: readonly string[],
): Promise<number> {
  const list = states.map((state) => `'${state}'`).join(",");
  const result = await db.execute(
    sql`SELECT COUNT(*) AS n FROM action_plans WHERE store_id = ${storeId} AND state IN (${sql.raw(list)})`,
  );
  return num((result.rows[0] as { n: unknown } | undefined)?.n);
}

async function handleResults(c: Context, deps: ResultDeps) {
  const { store } = await currentSession(c, deps);
  const today = todayIso(deps.now());
  const from30 = shiftIsoDate(today, -29);

  const [totals, activeCount, finishedCount, plans, latestWeeklySummary] =
    await Promise.all([
      recoveredTotals(deps.db, store.id, today, from30),
      countByState(deps.db, store.id, ["active"]),
      countByState(deps.db, store.id, FINISHED_STATES),
      listPlans(deps.db, store.id, STARTED_STATES, today),
      loadWeeklySummary(deps.db, store.id, today),
    ]);

  return c.json({
    totalRecovered: totals.total,
    recovered30d: totals.last30,
    activeCount,
    finishedCount,
    plans,
    latestWeeklySummary,
  });
}

async function handleLatestSummary(c: Context, deps: ResultDeps) {
  const { store } = await currentSession(c, deps);
  return c.json(
    await loadWeeklySummary(deps.db, store.id, todayIso(deps.now())),
  );
}

export function resultRoutes(deps: ResultDeps) {
  const app = new Hono();
  app.get("/results", (c) => handleResults(c, deps));
  app.get("/weekly-summaries/latest", (c) => handleLatestSummary(c, deps));
  return app;
}
