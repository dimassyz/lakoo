import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS } from "../domain/product.ts";
import type { ProductStat } from "../../../database/src/queries/productStats.ts";
import { toProductSummary } from "./serialize.ts";

const AS_OF = "2026-11-09";

function stat(overrides: Partial<ProductStat> = {}): ProductStat {
  return {
    productId: "11111111-1111-4111-8111-111111111111",
    name: "Kecap Manis",
    unit: "botol",
    category: null,
    sellPrice: 20_000,
    lastCost: 12_000,
    stock: 10,
    lastSaleDate: "2026-11-08",
    firstStockDate: "2026-08-01",
    weekQty: [2, 2, 2, 2, 2, 2, 2],
    sold28: 28,
    saleDays28: 10,
    sold90: 60,
    isComplementary: false,
    complementaryMaxStock: null,
    archived: false,
    ...overrides,
  } as ProductStat;
}

const summary = (overrides: Partial<ProductStat> = {}) =>
  toProductSummary(stat(overrides), DEFAULT_THRESHOLDS, AS_OF, null);

describe("toProductSummary — amendemen §5.2 (stok_habis ikut diperkirakan habis)", () => {
  it("rak kosong yang laku cepat masuk daftar kulakan", () => {
    const item = summary({ stock: 0 });
    expect(item.status).toBe("stok_habis");
    expect(item.daysUntilEmpty).toBe(0);
    expect(item.restockSoon).toBe(true);
  });

  it("rak kosong yang jarang laku tidak masuk daftar kulakan", () => {
    const item = summary({ stock: 0, saleDays28: 2, sold28: 2 });
    expect(item.status).toBe("stok_habis");
    expect(item.daysUntilEmpty).toBeNull();
    expect(item.restockSoon).toBe(false);
  });

  it("status sekarat/mati tetap tanpa perkiraan habis", () => {
    const sekarat = summary({ lastSaleDate: "2026-10-01", stock: 4 });
    expect(sekarat.status).toBe("sekarat");
    expect(sekarat.daysUntilEmpty).toBeNull();

    const mati = summary({ lastSaleDate: "2026-08-01", stock: 4 });
    expect(mati.status).toBe("mati");
    expect(mati.daysUntilEmpty).toBeNull();
  });

  it("stok_habis tetap di luar skor prioritas §5.3", () => {
    // `toProductSummary` belum menilai skor; `prioritize` yang menyaring.
    expect(summary({ stock: 0 }).priorityScore).toBeNull();
  });

  it("sehat dengan sisa ≤ 3 hari tetap ditandai", () => {
    // avg = 56/28 = 2/hari, stok 6 → 3 hari
    const item = summary({ stock: 6, sold28: 56, saleDays28: 12 });
    expect(item.status).toBe("sehat");
    expect(item.daysUntilEmpty).toBe(3);
    expect(item.restockSoon).toBe(true);
  });
});
