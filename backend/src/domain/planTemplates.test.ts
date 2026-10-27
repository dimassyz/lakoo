import { describe, expect, it } from "vitest";
import type { ProductStatus } from "./product.ts";
import { templatePlan, type TemplateInput } from "./planTemplates.ts";
import { validatePlan, type ValidationContext } from "./planValidation.ts";

const BASE: TemplateInput = {
  status: "mati",
  sellPrice: 20_000,
  lastCost: 12_000,
  stock: 10,
  bundleProductId: "b1",
};

function contextFor(status: ProductStatus): ValidationContext {
  return {
    productId: "p1",
    productStatus: status,
    sellPrice: 20_000,
    lastCost: 12_000,
    stock: 10,
    bundleCandidates: [
      {
        productId: "b1",
        name: "Minyak Goreng",
        status: "sehat",
        isComplementary: false,
        sellPrice: 10_000,
      },
    ],
  };
}

describe("template wajib lolos validator §5.5", () => {
  for (const status of ["waspada", "sekarat", "mati"] as const) {
    it(`template ${status} valid`, () => {
      const plan = templatePlan({ ...BASE, status });
      const result = validatePlan(plan, contextFor(status));
      expect(result.ok ? [] : result.errors).toEqual([]);
    });
  }

  it("tetap valid tanpa barang pasangan (bundle turun jadi discount)", () => {
    for (const status of ["waspada", "sekarat"] as const) {
      const plan = templatePlan({ ...BASE, status, bundleProductId: null });
      expect(plan.steps.some((step) => step.actionType === "bundle")).toBe(
        false,
      );
      const result = validatePlan(plan, contextFor(status));
      expect(result.ok ? [] : result.errors).toEqual([]);
    }
  });
});

describe("isi template sesuai tabel SPEC §5.6", () => {
  it("waspada: display_move → bundle → discount", () => {
    const plan = templatePlan({ ...BASE, status: "waspada" });
    expect(plan.steps.map((step) => step.actionType)).toEqual([
      "display_move",
      "bundle",
      "discount",
    ]);
    expect(plan.steps[1]?.discountPercent).toBe(10);
    expect(plan.steps[2]?.discountPercent).toBe(10);
  });

  it("sekarat: bundle → discount → sell_at_cost", () => {
    const plan = templatePlan({ ...BASE, status: "sekarat" });
    expect(plan.steps.map((step) => step.actionType)).toEqual([
      "bundle",
      "discount",
      "sell_at_cost",
    ]);
    expect(plan.steps[1]?.discountPercent).toBe(20);
  });

  it("mati: discount → sell_at_cost → clearance", () => {
    const plan = templatePlan({ ...BASE, status: "mati" });
    expect(plan.steps.map((step) => step.actionType)).toEqual([
      "discount",
      "sell_at_cost",
      "clearance",
    ]);
    expect(plan.steps[0]?.discountPercent).toBe(15);
    expect(plan.steps[2]?.belowCostPercent).toBe(20);
  });

  it("semua tahap berdurasi 7 hari", () => {
    for (const status of ["waspada", "sekarat", "mati"] as const) {
      const plan = templatePlan({ ...BASE, status });
      expect(plan.steps.map((step) => step.durationDays)).toEqual([7, 7, 7]);
    }
  });

  it("tahap diskon yang membuat rugi diganti sell_at_cost", () => {
    // 13.000 × 0,85 = 11.050 → 11.100, di bawah harga beli 12.000
    const plan = templatePlan({ ...BASE, status: "mati", sellPrice: 13_000 });
    expect(plan.steps[0]?.actionType).toBe("sell_at_cost");
  });

  it("tahap yang butuh share memakai placeholder promo", () => {
    const plan = templatePlan({ ...BASE, status: "mati" });
    for (const step of plan.steps) {
      expect(step.shareCopy).toBeDefined();
      expect(step.shareCopy).toContain("{nama_toko}");
      expect(step.shareCopy).toContain("{harga_baru}");
    }
  });
});

describe("status tanpa rencana", () => {
  it("menolak sehat dan stok_habis", () => {
    expect(() => templatePlan({ ...BASE, status: "sehat" })).toThrow();
    expect(() => templatePlan({ ...BASE, status: "stok_habis" })).toThrow();
  });
});
