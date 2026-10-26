import type { AnyDb } from "../../../database/src/db.ts";
import { DEFAULT_THRESHOLDS } from "../domain/product.ts";
import { prioritize } from "../domain/score.ts";
import { listProductStats, livePlanStates } from "../repo/products.ts";
import { toProductSummary, type ProductSummary } from "./serialize.ts";

/** Skor §5.3 butuh seluruh himpunan (max_locked), jadi dihitung sekali per respons. */
function applyScores(items: ProductSummary[]): void {
  const scored = prioritize(
    items.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      isComplementary: item.isComplementary,
      lockedValue: item.lockedValue,
      daysSinceActivity: item.daysSinceLastSale ?? 0,
    })),
    DEFAULT_THRESHOLDS.deadDays,
    DEFAULT_THRESHOLDS.warningWeeks,
  );
  const byId = new Map(scored.map((row) => [row.id, row]));
  for (const item of items) {
    const row = byId.get(item.id);
    if (row !== undefined) {
      item.priorityScore = row.score;
      item.reason = row.reason;
    }
  }
}

/** Satu-satunya tempat `ProductSummary` dibentuk — dipakai /products dan /dashboard. */
export async function loadProductSummaries(
  db: AnyDb,
  storeId: string,
  asOf: string,
  includeArchived = false,
): Promise<ProductSummary[]> {
  const stats = await listProductStats(db, storeId, asOf, includeArchived);
  const planStates = await livePlanStates(db, storeId);
  const items = stats.map((stat) =>
    toProductSummary(
      stat,
      DEFAULT_THRESHOLDS,
      asOf,
      planStates.get(stat.productId) ?? null,
    ),
  );
  applyScores(items);
  return items;
}
