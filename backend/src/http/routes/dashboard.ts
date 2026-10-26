import { Hono } from "hono";
import type { Context } from "hono";
import type { AnyDb } from "../../../../database/src/db.ts";
import { shiftIsoDate } from "../../../../database/src/demo/generator.ts";
import { currentSession } from "../auth-context.ts";
import { shouldShowWeeklySummary } from "../../domain/weeklySummary.ts";
import { loadWeeklySummary } from "../weeklySummaryView.ts";
import { loadProductSummaries } from "../productView.ts";
import { toMe, type ProductSummary } from "../serialize.ts";
import { todayIso } from "./products.ts";
import { dueSteps } from "../../repo/dashboard.ts";

export interface DashboardDeps {
  db: AnyDb;
  now: () => Date;
}

const PROBLEM = new Set(["waspada", "sekarat", "mati"]);
const STATUSES = ["sehat", "waspada", "sekarat", "mati", "stok_habis"] as const;

function totalsOf(items: readonly ProductSummary[]) {
  const byStatus = Object.fromEntries(
    STATUSES.map((status) => [status, { count: 0, lockedValue: 0 }]),
  ) as Record<
    (typeof STATUSES)[number],
    { count: number; lockedValue: number }
  >;

  let lockedValue = 0;
  let complementaryLockedValue = 0;
  let problemLockedValue = 0;

  for (const item of items) {
    lockedValue += item.lockedValue;
    if (item.isComplementary) complementaryLockedValue += item.lockedValue;
    else if (PROBLEM.has(item.status)) problemLockedValue += item.lockedValue;
    byStatus[item.status].count += 1;
    byStatus[item.status].lockedValue += item.lockedValue;
  }
  return {
    lockedValue,
    complementaryLockedValue,
    problemLockedValue,
    byStatus,
  };
}

/** Barang yang statusnya hari ini berbeda dari kemarin. */
function statusChanges(
  items: readonly ProductSummary[],
  previous: readonly ProductSummary[],
) {
  const before = new Map(previous.map((item) => [item.id, item.status]));
  return items.flatMap((item) => {
    const from = before.get(item.id);
    if (from === undefined || from === item.status) return [];
    return [{ productId: item.id, name: item.name, from, to: item.status }];
  });
}

async function weeklySummaryFor(
  deps: DashboardDeps,
  storeId: string,
  today: string,
) {
  // Gerbang tampil §5.9: ringkasan hanya muncul pada hari yang diizinkan.
  if (!shouldShowWeeklySummary(today)) return null;
  return loadWeeklySummary(deps.db, storeId, today);
}

async function handleDashboard(c: Context, deps: DashboardDeps) {
  const { store, user } = await currentSession(c, deps);
  const today = todayIso(deps.now());

  const items = await loadProductSummaries(deps.db, store.id, today);
  const previous = await loadProductSummaries(
    deps.db,
    store.id,
    shiftIsoDate(today, -1),
  );

  const topPriority = items
    .filter((item) => item.priorityScore !== null)
    .sort((a, b) => (b.priorityScore as number) - (a.priorityScore as number))
    .slice(0, 3);
  const restockSoon = items
    .filter((item) => item.restockSoon)
    .sort((a, b) => (a.daysUntilEmpty ?? 0) - (b.daysUntilEmpty ?? 0))
    .slice(0, 10);

  return c.json({
    asOf: today,
    store: toMe(user, store).store,
    totals: totalsOf(items),
    today: {
      statusChanges: statusChanges(items, previous),
      dueSteps: await dueSteps(deps.db, store.id, today),
    },
    topPriority,
    complementaryOverstock: items.filter((item) => item.complementaryOverstock),
    restockSoon,
    weeklySummary: await weeklySummaryFor(deps, store.id, today),
  });
}

export function dashboardRoutes(deps: DashboardDeps) {
  const app = new Hono();
  app.get("/dashboard", (c) => handleDashboard(c, deps));
  return app;
}
