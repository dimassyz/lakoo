import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  complementaryOverstock,
  daysBetween,
  daysSinceActivity,
  depletionEstimate,
  isWarning,
  lockedValue,
  productStatus,
  type ProductFacts,
} from "./product.ts";

const AS_OF = "2026-11-09";

function facts(overrides: Partial<ProductFacts> = {}): ProductFacts {
  return {
    stock: 10,
    lastSaleDate: "2026-11-08",
    firstStockDate: "2026-08-01",
    weekQty: [2, 2, 2, 2, 2, 2, 2],
    sold28: 20,
    saleDays28: 10,
    sold90: 60,
    ...overrides,
  };
}

describe("daysBetween", () => {
  it("menghitung hari kalender, bukan jam", () => {
    expect(daysBetween("2026-11-09", "2026-11-09")).toBe(0);
    expect(daysBetween("2026-11-08", "2026-11-09")).toBe(1);
    expect(daysBetween("2026-10-26", "2026-11-09")).toBe(14);
    expect(daysBetween("2026-09-25", "2026-11-09")).toBe(45);
  });

  it("tahan melintasi pergantian bulan dan tahun", () => {
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });
});

describe("productStatus — tabel batas SPEC §5.1", () => {
  const at = (lastSaleDate: string | null, extra: Partial<ProductFacts> = {}) =>
    productStatus(facts({ lastSaleDate, ...extra }), DEFAULT_THRESHOLDS, AS_OF);

  it("d = 14 → sehat", () => {
    expect(at("2026-10-26")).toBe("sehat");
  });

  it("d = 15 → sekarat", () => {
    expect(at("2026-10-25")).toBe("sekarat");
  });

  it("d = 45 → sekarat", () => {
    expect(at("2026-09-25")).toBe("sekarat");
  });

  it("d = 46 → mati", () => {
    expect(at("2026-09-24")).toBe("mati");
  });

  it("belum pernah laku, stok pertama 50 hari lalu → mati", () => {
    expect(at(null, { firstStockDate: "2026-09-20" })).toBe("mati");
  });

  it("d = 3 dengan 8 > 6 > 5 > 2 → waspada", () => {
    expect(at("2026-11-06", { weekQty: [2, 5, 6, 8, 0, 0, 0] })).toBe(
      "waspada",
    );
  });

  it("d = 3 dengan 3 > 2 > 1 > 0 → sehat karena basis < 4", () => {
    expect(at("2026-11-06", { weekQty: [0, 1, 2, 3, 0, 0, 0] })).toBe("sehat");
  });

  it("d = 3 dengan 8 > 6 = 6 > 2 → sehat karena tidak turun tegas", () => {
    expect(at("2026-11-06", { weekQty: [2, 6, 6, 8, 0, 0, 0] })).toBe("sehat");
  });
});

describe("productStatus — aturan lain", () => {
  it("stok ≤ 0 selalu stok_habis, walau baru laku kemarin", () => {
    expect(
      productStatus(
        facts({ stock: 0, lastSaleDate: "2026-11-08" }),
        DEFAULT_THRESHOLDS,
        AS_OF,
      ),
    ).toBe("stok_habis");
    expect(
      productStatus(
        facts({ stock: -5, lastSaleDate: "2026-11-08" }),
        DEFAULT_THRESHOLDS,
        AS_OF,
      ),
    ).toBe("stok_habis");
  });

  it("stok_habis menang atas aturan waspada", () => {
    expect(
      productStatus(
        facts({
          stock: 0,
          lastSaleDate: "2026-11-06",
          weekQty: [2, 5, 6, 8, 0, 0, 0],
        }),
        DEFAULT_THRESHOLDS,
        AS_OF,
      ),
    ).toBe("stok_habis");
  });

  it("menghormati ambang kustom per toko", () => {
    const longDead = { healthyDays: 30, deadDays: 90, warningWeeks: 3 };
    expect(
      productStatus(facts({ lastSaleDate: "2026-09-24" }), longDead, AS_OF),
    ).toBe("sekarat");
  });

  it("memakai first_stock_date saat belum pernah laku tapi masih sehat", () => {
    const never = facts({ lastSaleDate: null, firstStockDate: "2026-11-01" });
    expect(productStatus(never, DEFAULT_THRESHOLDS, AS_OF)).toBe("sehat");
  });
});

describe("isWarning", () => {
  it("butuh N penurunan tegas berturut-turut", () => {
    expect(isWarning([2, 5, 6, 8], 3)).toBe(true);
    expect(isWarning([2, 6, 6, 8], 3)).toBe(false);
    expect(isWarning([3, 5, 6, 8], 3)).toBe(true);
  });

  it("menghormati warning_weeks berbeda", () => {
    // N=2: hanya butuh week3 > week2 > week1
    expect(isWarning([2, 5, 8], 2)).toBe(true);
    // N=4: week5 harus ada dan lebih besar
    expect(isWarning([2, 5, 6, 8], 4)).toBe(false);
    expect(isWarning([2, 5, 6, 8, 9], 4)).toBe(true);
  });

  it("menolak data minggu yang belum lengkap", () => {
    expect(isWarning([2, 5], 3)).toBe(false);
    expect(isWarning([], 3)).toBe(false);
  });
});

describe("lockedValue (SPEC §5.2)", () => {
  it("stok positif dikali harga beli terakhir", () => {
    expect(lockedValue(10, 3000)).toBe(30_000);
  });

  it("stok nol atau minus tidak menghasilkan nilai negatif", () => {
    expect(lockedValue(0, 3000)).toBe(0);
    expect(lockedValue(-7, 3000)).toBe(0);
  });
});

describe("depletionEstimate (SPEC §5.2)", () => {
  it("null bila hari ada penjualan kurang dari 3", () => {
    expect(depletionEstimate(facts({ saleDays28: 2 }))).toEqual({
      daysUntilEmpty: null,
      restockSoon: false,
    });
  });

  it("menghitung floor(stok / rata-rata harian)", () => {
    // avg = 28/28 = 1/hari, stok 10 → 10 hari
    expect(
      depletionEstimate(facts({ sold28: 28, saleDays28: 10, stock: 10 })),
    ).toEqual({
      daysUntilEmpty: 10,
      restockSoon: false,
    });
  });

  it("menandai restockSoon bila sisa ≤ 3 hari", () => {
    // avg = 56/28 = 2/hari, stok 6 → 3 hari
    expect(
      depletionEstimate(facts({ sold28: 56, saleDays28: 12, stock: 6 })),
    ).toEqual({
      daysUntilEmpty: 3,
      restockSoon: true,
    });
  });

  it("null bila tidak ada penjualan sama sekali", () => {
    expect(depletionEstimate(facts({ sold28: 0, saleDays28: 5 }))).toEqual({
      daysUntilEmpty: null,
      restockSoon: false,
    });
  });
});

describe("complementaryOverstock (SPEC §5.2)", () => {
  it("memakai complementary_max_stock bila diisi", () => {
    const check = complementaryOverstock(
      facts({ stock: 30, sold90: 90, firstStockDate: "2026-08-11" }),
      20,
      AS_OF,
    );
    expect(check.threshold).toBe(20);
    expect(check.overstock).toBe(true);
    expect(check.message).toContain("20");
  });

  it("menghitung ambang dari rata-rata penjualan bila kosong", () => {
    // span = 90 hari, avg = 90/90 = 1, threshold = max(ceil(60), 2) = 60
    const check = complementaryOverstock(
      facts({ stock: 70, sold90: 90, firstStockDate: "2026-08-11" }),
      null,
      AS_OF,
    );
    expect(check.threshold).toBe(60);
    expect(check.overstock).toBe(true);
  });

  it("ambang minimal 2 walau penjualan hampir nol", () => {
    const check = complementaryOverstock(
      facts({ stock: 5, sold90: 0, firstStockDate: "2026-08-11" }),
      null,
      AS_OF,
    );
    expect(check.threshold).toBe(2);
    expect(check.overstock).toBe(true);
  });

  it("tidak overstock bila stok tidak melebihi ambang minimum", () => {
    const check = complementaryOverstock(
      facts({ stock: 2, sold90: 0, firstStockDate: "2026-08-11" }),
      null,
      AS_OF,
    );
    expect(check.threshold).toBe(2);
    expect(check.overstock).toBe(false);
  });
});

describe("daysSinceActivity", () => {
  it("memakai tanggal penjualan terakhir", () => {
    expect(
      daysSinceActivity(facts({ lastSaleDate: "2026-10-26" }), AS_OF),
    ).toBe(14);
  });

  it("jatuh ke stok pertama bila belum pernah laku", () => {
    expect(
      daysSinceActivity(
        facts({ lastSaleDate: null, firstStockDate: "2026-09-20" }),
        AS_OF,
      ),
    ).toBe(50);
  });
});
