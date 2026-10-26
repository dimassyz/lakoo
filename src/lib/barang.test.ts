import { describe, expect, it } from "vitest";
import type { ProductSummary } from "./api";
import { filterDariQuery, keterangan, urutkan } from "./barang";

function barang(ubah: Partial<ProductSummary>): ProductSummary {
  return {
    id: "p1",
    name: "Teh",
    unit: "pcs",
    category: null,
    sellPrice: 7500,
    lastCost: 6200,
    stock: 10,
    lockedValue: 62000,
    status: "sehat",
    lastSaleDate: null,
    daysSinceLastSale: null,
    daysUntilEmpty: null,
    restockSoon: false,
    sold28: 0,
    isComplementary: false,
    complementaryOverstock: false,
    complementaryThreshold: null,
    priorityScore: null,
    reason: null,
    archived: false,
    ...ubah,
  } as ProductSummary;
}

describe("filter dari query string (FSD §9)", () => {
  it("menerima chip yang dikenal dan menolak yang tidak", () => {
    expect(filterDariQuery("waspada")).toBe("waspada");
    expect(filterDariQuery("pelengkap")).toBe("pelengkap");
    expect(filterDariQuery("ngawur")).toBe("semua");
    expect(filterDariQuery(undefined)).toBe("semua");
    expect(filterDariQuery(["mati", "sehat"])).toBe("semua");
  });
});

describe("urutkan tabel desktop", () => {
  it("mengurutkan angka menurun dan menaruh nilai kosong di bawah", () => {
    const items = [
      barang({ id: "a", name: "A", lockedValue: 1000 }),
      barang({ id: "b", name: "B", lockedValue: 5000 }),
      barang({ id: "c", name: "C", lockedValue: 3000 }),
    ];
    expect(urutkan(items, "lockedValue", false).map((p) => p.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("nilai null selalu di bawah, urutan naik maupun turun", () => {
    const items = [
      barang({ id: "x", name: "X", priorityScore: 4 }),
      barang({ id: "y", name: "Y", priorityScore: null }),
      barang({ id: "z", name: "Z", priorityScore: 9 }),
    ];
    expect(urutkan(items, "priorityScore", false)[2]?.id).toBe("y");
    expect(urutkan(items, "priorityScore", true)[2]?.id).toBe("y");
  });
});

describe("keterangan baris (FSD §9)", () => {
  it("pelengkap menang, lalu reason, lalu sisa hari", () => {
    expect(
      keterangan(
        barang({ isComplementary: true, reason: "abaikan", daysUntilEmpty: 9 }),
      ),
    ).toBe("pelengkap");
    expect(keterangan(barang({ reason: "Tidak laku 30 hari" }))).toBe(
      "Tidak laku 30 hari",
    );
    expect(keterangan(barang({ daysUntilEmpty: 4 }))).toBe(
      "±4 hari lagi habis",
    );
    expect(keterangan(barang({}))).toBe("");
  });
});
