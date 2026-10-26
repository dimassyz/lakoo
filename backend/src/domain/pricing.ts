/**
 * Kalkulator harga aksi rencana (SPEC §5.4). Murni, tanpa I/O.
 */

export type ActionType =
  | "display_move"
  | "bundle"
  | "discount"
  | "promo_wa"
  | "sell_at_cost"
  | "clearance"
  | "stop_restock";

export const ACTION_TYPES = [
  "display_move",
  "bundle",
  "discount",
  "promo_wa",
  "sell_at_cost",
  "clearance",
  "stop_restock",
] as const satisfies readonly ActionType[];

/** Rentang parameter tiap aksi (SPEC §5.4). */
export const PARAM_RANGES = {
  bundleDiscount: { min: 5, max: 30 },
  discount: { min: 5, max: 50 },
  promoWaDiscount: { min: 0, max: 50 },
  belowCost: { min: 5, max: 50 },
} as const;

/** Bulatkan ke Rp100 terdekat, minimal Rp100 (SPEC §5.4). */
export function round100(value: number): number {
  return Math.max(100, Math.round(value / 100) * 100);
}

export interface PriceInput {
  actionType: ActionType;
  sellPrice: number;
  lastCost: number;
  /** Untuk `discount`, `promo_wa`, dan `bundle`. */
  discountPercent?: number;
  /** Untuk `clearance`. */
  belowCostPercent?: number;
  /** Harga jual barang pasangan; wajib untuk `bundle`. */
  bundleSellPrice?: number;
}

const withDiscount = (price: number, percent: number | undefined): number =>
  round100(price * (1 - (percent ?? 0) / 100));

/** Satu entri per `action_type`; tabel ini yang membuat `newPriceFor` bebas cabang. */
const PRICE_OF: Record<ActionType, (input: PriceInput) => number> = {
  display_move: (input) => input.sellPrice,
  stop_restock: (input) => input.sellPrice,
  bundle: (input) => {
    // Diskon paket dibebankan ke barang A; harga B tidak berubah.
    const partner = input.bundleSellPrice ?? 0;
    return (
      withDiscount(input.sellPrice + partner, input.discountPercent) - partner
    );
  },
  discount: (input) => withDiscount(input.sellPrice, input.discountPercent),
  promo_wa: (input) => withDiscount(input.sellPrice, input.discountPercent),
  sell_at_cost: (input) => Math.max(100, input.lastCost),
  clearance: (input) =>
    round100(input.lastCost * (1 - (input.belowCostPercent ?? 0) / 100)),
};

/** Harga satuan setelah aksi diterapkan (SPEC §5.4). */
export function newPriceFor(input: PriceInput): number {
  return PRICE_OF[input.actionType](input);
}

export interface StepDerived {
  newPrice: number;
  profitPerUnit: number;
  isLoss: boolean;
  cashBackEstimate: number;
}

/** Turunan setiap tahap (SPEC §5.4). */
export function deriveStep(input: PriceInput, stock: number): StepDerived {
  const newPrice = newPriceFor(input);
  const profitPerUnit = newPrice - input.lastCost;
  return {
    newPrice,
    profitPerUnit,
    isLoss: profitPerUnit < 0,
    cashBackEstimate: newPrice * Math.max(stock, 0),
  };
}

/** Harga paket yang dilihat pengguna untuk `bundle` (SPEC §5.4). */
export function bundlePriceFor(input: PriceInput): number {
  const partner = input.bundleSellPrice ?? 0;
  return newPriceFor(input) + partner;
}
