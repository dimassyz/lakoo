import type { ProductStat } from "../../../database/src/queries/productStats.ts";
import {
  complementaryOverstock,
  daysSinceActivity,
  depletionEstimate,
  lockedValue,
  productStatus,
  type ProductFacts,
  type ProductStatus,
  type Thresholds,
} from "../domain/product.ts";
import type { StoreRow, UserRow } from "../repo/auth.ts";

/** Bentuk `Me` di openapi.yaml. */
export function toMe(user: UserRow, store: StoreRow) {
  return {
    user: {
      id: user.id,
      // Akun demo tidak punya email asli; kontrak menyatakan null.
      email: user.isDemo ? null : user.email,
      isDemo: user.isDemo,
      demoExpiresAt: store.demoExpiresAt?.toISOString() ?? null,
    },
    store: {
      id: store.id,
      name: store.name,
      storeType: store.storeType,
      location: store.location,
      customerTypes: store.customerTypes,
      healthyDays: store.healthyDays,
      deadDays: store.deadDays,
      warningWeeks: store.warningWeeks,
      aiEnabled: store.aiEnabled,
      onboarded: store.onboardedAt !== null,
      profileComplete:
        store.storeType !== null &&
        store.location !== null &&
        store.customerTypes.length > 0,
      isDemo: store.demoExpiresAt !== null,
    },
  };
}

export type MeResponse = ReturnType<typeof toMe>;

/** Baris `ProductSummary` (SPEC §5.1–§5.3). Skor diisi di tingkat daftar, bukan per barang. */
export function toProductSummary(
  stat: ProductStat,
  thresholds: Thresholds,
  asOf: string,
  planState: string | null,
): ProductSummary {
  const facts: ProductFacts = {
    stock: stat.stock,
    lastSaleDate: stat.lastSaleDate,
    firstStockDate: stat.firstStockDate,
    weekQty: stat.weekQty,
    sold28: stat.sold28,
    saleDays28: stat.saleDays28,
    sold90: stat.sold90,
  };
  const status = productStatus(facts, thresholds, asOf);
  // Amendemen §5.2: stok_habis ikut diperkirakan habis (rak kosong, barang laku cepat).
  const depleting =
    status === "sehat" || status === "waspada" || status === "stok_habis";
  const depletion = depleting
    ? depletionEstimate(facts)
    : { daysUntilEmpty: null, restockSoon: false };
  const complementary = stat.isComplementary
    ? complementaryOverstock(facts, stat.complementaryMaxStock, asOf)
    : null;

  return {
    id: stat.productId,
    name: stat.name,
    unit: stat.unit,
    category: stat.category,
    sellPrice: stat.sellPrice,
    lastCost: stat.lastCost,
    stock: stat.stock,
    lockedValue: lockedValue(stat.stock, stat.lastCost),
    status,
    lastSaleDate: stat.lastSaleDate,
    daysSinceLastSale: daysSinceActivity(facts, asOf),
    daysUntilEmpty: depletion.daysUntilEmpty,
    restockSoon: depletion.restockSoon,
    sold28: stat.sold28,
    isComplementary: stat.isComplementary,
    complementaryOverstock: complementary?.overstock ?? false,
    complementaryThreshold: complementary?.threshold ?? null,
    priorityScore: null,
    reason: null,
    planState,
    archived: stat.archived,
  };
}

export interface ProductSummary {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  sellPrice: number;
  lastCost: number;
  stock: number;
  lockedValue: number;
  status: ProductStatus;
  lastSaleDate: string | null;
  daysSinceLastSale: number | null;
  daysUntilEmpty: number | null;
  restockSoon: boolean;
  sold28: number;
  isComplementary: boolean;
  complementaryOverstock: boolean;
  complementaryThreshold: number | null;
  priorityScore: number | null;
  reason: string | null;
  planState: string | null;
  archived: boolean;
}

/** Kontrak: `weekQty` selalu 7 angka, indeks 0 = 7 hari terakhir (SPEC §4.2). */

export interface ProductDetail extends ProductSummary {
  complementaryMaxStock: number | null;
  weekQty: number[];
  firstStockDate: string | null;
  createdAt: string;
}

/**
 * `ProductDetail` = `ProductSummary` + empat field. `summary` harus sudah
 * melewati `prioritize()` supaya `priorityScore`/`reason` terisi.
 */
export function toProductDetail(
  summary: ProductSummary,
  stat: ProductStat,
  createdAt: Date,
): ProductDetail {
  return {
    ...summary,
    complementaryMaxStock: stat.complementaryMaxStock,
    weekQty: stat.weekQty,
    firstStockDate: stat.firstStockDate ?? null,
    createdAt: createdAt.toISOString(),
  };
}
