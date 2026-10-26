import type { AnyDb } from "../../../database/src/db.ts";
import { DEFAULT_THRESHOLDS } from "../domain/product.ts";
import { prioritize } from "../domain/score.ts";
import { listProductStats, livePlanStates } from "../repo/products.ts";
import type { ProductStat } from "../../../database/src/queries/productStats.ts";
import {
  toProductDetail,
  toProductSummary,
  type ProductDetail,
  type ProductSummary,
} from "./serialize.ts";

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
export async function loadProducts(
  db: AnyDb,
  storeId: string,
  asOf: string,
  includeArchived = false,
): Promise<{ stats: ProductStat[]; items: ProductSummary[] }> {
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
  return { stats, items };
}

export async function loadProductSummaries(
  db: AnyDb,
  storeId: string,
  asOf: string,
  includeArchived = false,
): Promise<ProductSummary[]> {
  return (await loadProducts(db, storeId, asOf, includeArchived)).items;
}

/** `ProductDetail` satu barang (kontrak POST /products 201). */
export async function loadProductDetail(
  db: AnyDb,
  storeId: string,
  productId: string,
  asOf: string,
  createdAt: Date,
): Promise<ProductDetail | undefined> {
  // Detail harus tetap terbaca untuk barang terarsip (kontrak hanya 404 bila tidak ada).
  const { stats, items } = await loadProducts(db, storeId, asOf, true);
  const stat = stats.find((row) => row.productId === productId);
  const summary = items.find((row) => row.id === productId);
  if (stat === undefined || summary === undefined) return undefined;
  return toProductDetail(summary, stat, createdAt);
}
