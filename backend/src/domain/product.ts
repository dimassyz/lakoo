/**
 * Fungsi murni status & metrik barang (SPEC §5.1, §5.2).
 * Tanpa I/O: seluruh input datang sebagai argumen, sehingga bisa diuji tanpa DB.
 */

export type ProductStatus =
  "sehat" | "waspada" | "sekarat" | "mati" | "stok_habis";

export interface Thresholds {
  healthyDays: number;
  deadDays: number;
  warningWeeks: number;
}

/** Nilai bawaan SPEC §5.1. */
export const DEFAULT_THRESHOLDS: Thresholds = {
  healthyDays: 14,
  deadDays: 45,
  warningWeeks: 3,
};

/** Mencegah noise seperti 1 → 0 dianggap tren turun (SPEC §5.1). */
export const WARNING_MIN_BASE_QTY = 4;

export interface ProductFacts {
  stock: number;
  lastSaleDate: string | null;
  firstStockDate: string;
  /** Index 0 = minggu terbaru, index 1 = minggu sebelumnya, dst. */
  weekQty: readonly number[];
  sold28: number;
  saleDays28: number;
  sold90: number;
}

/** Selisih hari kalender antara dua tanggal `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/**
 * Waspada: `week_qty[N+1] > week_qty[N] > … > week_qty[1]` dan `week_qty[N+1] ≥ 4`.
 * Turun harus tegas — satu minggu yang datar membatalkan aturan ini.
 */
export function isWarning(
  weekQty: readonly number[],
  warningWeeks: number,
): boolean {
  const base = weekQty[warningWeeks];
  if (base === undefined || base < WARNING_MIN_BASE_QTY) return false;
  for (let week = warningWeeks; week >= 1; week -= 1) {
    const older = weekQty[week];
    const newer = weekQty[week - 1];
    if (older === undefined || newer === undefined || older <= newer)
      return false;
  }
  return true;
}

/** Status satu barang (SPEC §5.1). Barang terarsip tidak pernah sampai ke sini. */
export function productStatus(
  facts: ProductFacts,
  thresholds: Thresholds,
  asOf: string,
): ProductStatus {
  if (facts.stock <= 0) return "stok_habis";

  const anchor = facts.lastSaleDate ?? facts.firstStockDate;
  const days = daysBetween(anchor, asOf);

  if (days <= thresholds.healthyDays) {
    return isWarning(facts.weekQty, thresholds.warningWeeks)
      ? "waspada"
      : "sehat";
  }
  if (days <= thresholds.deadDays) return "sekarat";
  return "mati";
}

/** Hari sejak penjualan terakhir, atau sejak stok pertama bila belum pernah laku. */
export function daysSinceActivity(facts: ProductFacts, asOf: string): number {
  return daysBetween(facts.lastSaleDate ?? facts.firstStockDate, asOf);
}

/** Uang terkunci: `max(stock, 0) × last_cost` (SPEC §5.2, BR-7). */
export function lockedValue(stock: number, lastCost: number): number {
  return Math.max(stock, 0) * lastCost;
}

export interface DepletionEstimate {
  /** `null` bila data penjualan belum cukup (< 3 hari ada penjualan). */
  daysUntilEmpty: number | null;
  restockSoon: boolean;
}

/** Perkiraan habis — hanya bermakna untuk status sehat/waspada (SPEC §5.2). */
export function depletionEstimate(facts: ProductFacts): DepletionEstimate {
  if (facts.saleDays28 < 3) return { daysUntilEmpty: null, restockSoon: false };
  const avgPerDay = facts.sold28 / 28;
  if (avgPerDay <= 0) return { daysUntilEmpty: null, restockSoon: false };
  const daysUntilEmpty = Math.floor(Math.max(facts.stock, 0) / avgPerDay);
  return { daysUntilEmpty, restockSoon: daysUntilEmpty <= 3 };
}

export interface ComplementaryCheck {
  threshold: number;
  overstock: boolean;
  message: string;
}

/** Pelengkap kebanyakan (SPEC §5.2). */
export function complementaryOverstock(
  facts: ProductFacts,
  maxStock: number | null,
  asOf: string,
): ComplementaryCheck {
  const span = Math.min(
    Math.max(daysBetween(facts.firstStockDate, asOf) + 1, 1),
    90,
  );
  const avgPerDay = facts.sold90 / span;
  const threshold = maxStock ?? Math.max(Math.ceil(avgPerDay * 60), 2);
  return {
    threshold,
    overstock: facts.stock > threshold,
    message: `Jangan kulakan dulu sampai stok tinggal ${threshold}`,
  };
}
