import { describe, expect, it } from "vitest";
import { CATALOG, type TargetStatus } from "./catalog.ts";
import {
  HISTORY_DAYS,
  type GeneratedProduct,
  generateDemo,
  shiftIsoDate,
  stockOn,
} from "./generator.ts";

/** Tanggal tetap supaya bobot akhir pekan dan determinisme bisa diuji. */
const AS_OF = "2026-11-09";
const data = generateDemo(AS_OF);

const HEALTHY_DAYS = 14;
const DEAD_DAYS = 45;

function daysBetween(earlier: string, later: string): number {
  return Math.round(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) /
      86_400_000,
  );
}

interface Facts {
  stock: number;
  lastSaleDate: string | null;
  firstStockDate: string | null;
  daysSinceLastSale: number;
  weekQty: number[];
}

function factsOf(product: GeneratedProduct): Facts {
  const stock = stockOn(product, AS_OF);
  const lastSale = product.sales.at(-1);
  const firstStock = product.stockIns
    .filter((row) => row.qty > 0)
    .map((row) => row.receivedOn)
    .sort()[0];
  const anchor = lastSale?.saleDate ?? firstStock ?? AS_OF;
  const weekQty = [0, 1, 2, 3].map((week) => {
    const low = week * 7;
    const high = low + 6;
    return product.sales.reduce((acc, sale) => {
      const offset = daysBetween(sale.saleDate, AS_OF);
      return offset >= low && offset <= high ? acc + sale.qty : acc;
    }, 0);
  });
  return {
    stock,
    lastSaleDate: lastSale?.saleDate ?? null,
    firstStockDate: firstStock ?? null,
    daysSinceLastSale: daysBetween(anchor, AS_OF),
    weekQty,
  };
}

/** Cermin SPEC §5.1 — test ini yang memverifikasi distribusi generator. */
function statusOf(facts: Facts): TargetStatus {
  if (facts.stock <= 0) return "stok_habis";
  const [w1 = 0, w2 = 0, w3 = 0, w4 = 0] = facts.weekQty;
  if (facts.daysSinceLastSale <= HEALTHY_DAYS) {
    const declining = w4 > w3 && w3 > w2 && w2 > w1 && w4 >= 4;
    return declining ? "waspada" : "sehat";
  }
  if (facts.daysSinceLastSale <= DEAD_DAYS) return "sekarat";
  return "mati";
}

function countByStatus(): Record<TargetStatus, number> {
  const counts: Record<TargetStatus, number> = {
    sehat: 0,
    waspada: 0,
    sekarat: 0,
    mati: 0,
    stok_habis: 0,
  };
  for (const product of data.products) {
    counts[statusOf(factsOf(product))] += 1;
  }
  return counts;
}

describe("generator data demo", () => {
  it("deterministik: dua kali generate menghasilkan data identik", () => {
    expect(generateDemo(AS_OF)).toEqual(generateDemo(AS_OF));
  });

  it("memuat 100 barang dari katalog", () => {
    expect(data.products).toHaveLength(100);
    expect(CATALOG).toHaveLength(100);
  });

  it("memenuhi distribusi status wajib SPEC §10.2", () => {
    const counts = countByStatus();
    expect(counts.sehat).toBeGreaterThanOrEqual(55);
    expect(counts.waspada).toBeGreaterThanOrEqual(6);
    expect(counts.sekarat).toBeGreaterThanOrEqual(8);
    expect(counts.mati).toBeGreaterThanOrEqual(8);
    expect(counts.stok_habis).toBeGreaterThanOrEqual(2);
  });

  it("menyediakan pelengkap dengan minimal satu kebanyakan", () => {
    const complementary = data.products.filter(
      (product) => product.isComplementary,
    );
    expect(complementary.length).toBeGreaterThanOrEqual(3);
    const overstocked = complementary.filter((product) => {
      const facts = factsOf(product);
      const span = Math.min(
        Math.max(daysBetween(facts.firstStockDate ?? AS_OF, AS_OF) + 1, 1),
        90,
      );
      const sold90 = product.sales.reduce((acc, sale) => acc + sale.qty, 0);
      const threshold =
        product.complementaryMaxStock ??
        Math.max(Math.ceil((sold90 / span) * 60), 2);
      return facts.stock > threshold;
    });
    expect(overstocked.length).toBeGreaterThanOrEqual(1);
  });

  it("memuat kasus brief: kecap mati ±90 hari dan sampo stok 40", () => {
    const kecap = data.products.find(
      (product) => product.name === "Kecap Manis Botol 600ml",
    );
    const sampo = data.products.find(
      (product) => product.name === "Sampo Botol 170ml",
    );
    expect(kecap).toBeDefined();
    expect(sampo).toBeDefined();

    const kecapFacts = factsOf(kecap as GeneratedProduct);
    expect(kecapFacts.lastSaleDate).toBeNull();
    expect(kecapFacts.daysSinceLastSale).toBe(HISTORY_DAYS);
    expect(statusOf(kecapFacts)).toBe("mati");

    expect(factsOf(sampo as GeneratedProduct).stock).toBe(40);
  });

  it("stok tidak pernah negatif sepanjang 90 hari", () => {
    for (const product of data.products) {
      for (let day = 0; day <= HISTORY_DAYS; day += 1) {
        const stock = stockOn(product, shiftIsoDate(AS_OF, -day));
        expect(
          stock,
          `${product.name} pada hari ke-${day}`,
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("barang sehat mendapat barang masuk tiap 7–14 hari", () => {
    const healthy = data.products.filter(
      (product) =>
        statusOf(factsOf(product)) === "sehat" && !product.isComplementary,
    );
    expect(healthy.length).toBeGreaterThan(0);
    for (const product of healthy) {
      const dates = product.stockIns.map((row) => row.receivedOn).sort();
      expect(dates.length).toBeGreaterThan(1);
      for (let index = 1; index < dates.length; index += 1) {
        const gap = daysBetween(
          dates[index - 1] as string,
          dates[index] as string,
        );
        expect(
          gap,
          `${product.name} jarak barang masuk`,
        ).toBeGreaterThanOrEqual(7);
        expect(gap, `${product.name} jarak barang masuk`).toBeLessThanOrEqual(
          14,
        );
      }
    }
  });

  it("setiap penjualan punya qty > 0 dan harga jual produk", () => {
    for (const product of data.products) {
      for (const sale of product.sales) {
        expect(sale.qty).toBeGreaterThan(0);
        expect(sale.unitPrice).toBe(product.sellPrice);
      }
    }
  });
});

describe("rencana demo", () => {
  it("punya satu rencana active di tahap 2 dengan kas pulih > 0", () => {
    const active = data.plans.find((plan) => plan.state === "active");
    expect(active).toBeDefined();
    const plan = active as NonNullable<typeof active>;
    expect(plan.productStatusAtGeneration).toBe("mati");
    expect(plan.currentStep).toBe(2);
    expect(plan.steps.map((step) => step.outcome)).toEqual([
      "succeeded",
      "in_progress",
      "pending",
    ]);

    const product = data.products.find(
      (item) => item.name === plan.productName,
    );
    const startedOn = plan.startedOn as string;
    const recovered = (product as GeneratedProduct).sales
      .filter((sale) => sale.saleDate >= startedOn && sale.saleDate <= AS_OF)
      .reduce((acc, sale) => acc + sale.qty * sale.unitPrice, 0);
    expect(recovered).toBeGreaterThan(0);
  });

  it("punya satu rencana completed yang berhasil di tahap pertama", () => {
    const completed = data.plans.find((plan) => plan.state === "completed");
    expect(completed).toBeDefined();
    const plan = completed as NonNullable<typeof completed>;
    expect(plan.steps[0]?.outcome).toBe("succeeded");
    expect(plan.steps[1]?.outcome).toBe("skipped");
    expect(daysBetween(plan.startedOn as string, AS_OF)).toBe(25);
  });

  it("teks tahap bebas digit dan lolos panjang SPEC §4.1", () => {
    for (const plan of data.plans) {
      expect(plan.rationale.length).toBeLessThanOrEqual(200);
      expect(plan.rationale).not.toMatch(/\d/);
      for (const step of plan.steps) {
        expect(step.title).not.toMatch(/\d/);
        expect(step.instructions).not.toMatch(/\d/);
        expect(step.successCriteria).not.toMatch(/\d/);
        expect(step.title.length).toBeLessThanOrEqual(60);
        expect(step.instructions.length).toBeLessThanOrEqual(300);
        expect(step.successCriteria.length).toBeLessThanOrEqual(120);
        expect(step.shareText === null || step.shareText.length <= 500).toBe(
          true,
        );
        expect(step.durationDays).toBeGreaterThanOrEqual(3);
        expect(step.durationDays).toBeLessThanOrEqual(21);
      }
      expect(plan.steps[0]?.isLoss).toBe(false);
    }
  });
});
