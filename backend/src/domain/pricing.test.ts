import { describe, expect, it } from "vitest";
import {
  ACTION_TYPES,
  bundlePriceFor,
  deriveStep,
  newPriceFor,
  round100,
  type PriceInput,
} from "./pricing.ts";

const base = { sellPrice: 20_000, lastCost: 12_000 };

describe("round100 (SPEC §5.4)", () => {
  it("membulatkan ke Rp100 terdekat", () => {
    expect(round100(14_940)).toBe(14_900);
    expect(round100(14_950)).toBe(15_000);
    expect(round100(20_000)).toBe(20_000);
  });

  it("tidak pernah di bawah Rp100", () => {
    expect(round100(0)).toBe(100);
    expect(round100(40)).toBe(100);
    expect(round100(-5_000)).toBe(100);
  });
});

describe("newPriceFor — tabel SPEC §5.4", () => {
  it("display_move dan stop_restock memakai harga jual apa adanya", () => {
    expect(newPriceFor({ ...base, actionType: "display_move" })).toBe(20_000);
    expect(newPriceFor({ ...base, actionType: "stop_restock" })).toBe(20_000);
  });

  it("discount memotong persen dari harga jual", () => {
    expect(
      newPriceFor({ ...base, actionType: "discount", discountPercent: 15 }),
    ).toBe(17_000);
    expect(
      newPriceFor({ ...base, actionType: "discount", discountPercent: 50 }),
    ).toBe(10_000);
  });

  it("promo_wa dengan 0% sama dengan harga tetap", () => {
    expect(
      newPriceFor({ ...base, actionType: "promo_wa", discountPercent: 0 }),
    ).toBe(20_000);
  });
});

describe("newPriceFor — bundle dan harga paket", () => {
  it("sell_at_cost memakai harga beli terakhir, minimal Rp100", () => {
    expect(newPriceFor({ ...base, actionType: "sell_at_cost" })).toBe(12_000);
    expect(
      newPriceFor({
        sellPrice: 20_000,
        lastCost: 40,
        actionType: "sell_at_cost",
      }),
    ).toBe(100);
  });

  it("clearance memotong persen dari harga beli", () => {
    expect(
      newPriceFor({ ...base, actionType: "clearance", belowCostPercent: 20 }),
    ).toBe(9_600);
  });

  it("bundle membebankan diskon ke barang A saja", () => {
    // (20.000 + 10.000) × 0,9 = 27.000; harga A = 27.000 − 10.000 = 17.000
    expect(
      newPriceFor({
        ...base,
        actionType: "bundle",
        discountPercent: 10,
        bundleSellPrice: 10_000,
      }),
    ).toBe(17_000);
  });

  it("bundlePriceFor mengembalikan harga paket yang dilihat pengguna", () => {
    expect(
      bundlePriceFor({
        ...base,
        actionType: "bundle",
        discountPercent: 10,
        bundleSellPrice: 10_000,
      }),
    ).toBe(27_000);
  });
});

describe("deriveStep (SPEC §5.4)", () => {
  const input: PriceInput = {
    actionType: "discount",
    sellPrice: 20_000,
    lastCost: 12_000,
    discountPercent: 15,
  };

  it("menghitung untung per unit dan menandai rugi", () => {
    const derived = deriveStep(input, 10);
    expect(derived.newPrice).toBe(17_000);
    expect(derived.profitPerUnit).toBe(5_000);
    expect(derived.isLoss).toBe(false);
    expect(derived.cashBackEstimate).toBe(170_000);
  });

  it("menandai is_loss untuk clearance di bawah harga beli", () => {
    const derived = deriveStep(
      { ...input, actionType: "clearance", belowCostPercent: 20 },
      5,
    );
    expect(derived.newPrice).toBe(9_600);
    expect(derived.profitPerUnit).toBe(-2_400);
    expect(derived.isLoss).toBe(true);
  });

  it("untung nol pada sell_at_cost tidak dihitung rugi", () => {
    const derived = deriveStep({ ...input, actionType: "sell_at_cost" }, 3);
    expect(derived.profitPerUnit).toBe(0);
    expect(derived.isLoss).toBe(false);
  });

  it("cash_back_estimate memakai stok apa adanya, bukan negatif", () => {
    expect(deriveStep(input, -4).cashBackEstimate).toBe(0);
  });
});

describe("ACTION_TYPES", () => {
  it("memuat tujuh aksi kontrak", () => {
    expect(ACTION_TYPES).toHaveLength(7);
    expect(ACTION_TYPES).toContain("bundle");
    expect(ACTION_TYPES).toContain("promo_wa");
  });
});
