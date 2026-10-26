import type { ProductStatus } from "./product.ts";

/** Bobot status untuk skor prioritas (SPEC §5.3). */
export const STATUS_WEIGHT = {
  waspada: 0.3,
  sekarat: 0.6,
  mati: 1,
} as const;

type ScoredStatus = keyof typeof STATUS_WEIGHT;

export interface ScoreInput {
  name: string;
  status: ProductStatus;
  isComplementary: boolean;
  lockedValue: number;
  daysSinceActivity: number;
}

export interface ScoredProduct extends ScoreInput {
  score: number;
  reason: string;
}

const rupiah = new Intl.NumberFormat("id-ID");

/** Hanya waspada/sekarat/mati dan bukan pelengkap (SPEC §5.3). */
export function isScored(
  item: ScoreInput,
): item is ScoreInput & { status: ScoredStatus } {
  if (item.isComplementary) return false;
  return (
    item.status === "waspada" ||
    item.status === "sekarat" ||
    item.status === "mati"
  );
}

function reasonFor(
  item: ScoreInput & { status: ScoredStatus },
  warningWeeks: number,
): string {
  if (item.status === "waspada") {
    return `Penjualan turun ${warningWeeks} minggu berturut-turut`;
  }
  return `Rp${rupiah.format(item.lockedValue)} terkunci, ${item.daysSinceActivity} hari tidak laku`;
}

function scoreOf(
  item: ScoreInput & { status: ScoredStatus },
  maxLocked: number,
  deadDays: number,
): number {
  const money = maxLocked > 0 ? item.lockedValue / maxLocked : 0;
  const age = Math.min(1, item.daysSinceActivity / (2 * deadDays));
  const weight = STATUS_WEIGHT[item.status];
  return Math.round(100 * (0.5 * money + 0.3 * age + 0.2 * weight));
}

/**
 * Daftar prioritas (F-12): skor turun, lalu uang terkunci turun, lalu nama naik.
 * `maxLocked` dihitung dari himpunan yang masuk skor, bukan seluruh barang.
 */
export function prioritize<T extends ScoreInput>(
  items: readonly T[],
  deadDays: number,
  warningWeeks: number,
): (T & { score: number; reason: string })[] {
  // `filter` melebarkan T ke ScoreInput; penyaringan tetap dilakukan oleh `isScored`.
  const scored = items.filter(isScored) as (T & { status: ScoredStatus })[];
  const maxLocked = scored.reduce(
    (max, item) => Math.max(max, item.lockedValue),
    0,
  );

  return scored
    .map((item) => ({
      ...item,
      score: scoreOf(item, maxLocked, deadDays),
      reason: reasonFor(item, warningWeeks),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.lockedValue !== a.lockedValue) return b.lockedValue - a.lockedValue;
      return a.name.localeCompare(b.name, "id");
    });
}
