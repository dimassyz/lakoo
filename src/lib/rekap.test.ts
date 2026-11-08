import { describe, expect, it } from "vitest";
import type { SalesRecap } from "./api";
import { errorBaris } from "./rekap";

const data = {
  date: "2026-11-08",
  isToday: true,
  hasRecord: false,
  lines: [
    {
      productId: "p-1",
      name: "Kopi Sachet",
      unit: "pcs",
      sellPrice: 2000,
      morningStock: 10,
      stockInOnDate: 0,
      recordedQty: 0,
      currentStock: 10,
    },
  ],
} as SalesRecap;

describe("errorBaris rekap (QA-4 M-1)", () => {
  it("qty desimal ditolak di klien, tidak lolos ke antrean simpan", () => {
    expect(errorBaris(data, "quantity", { "p-1": 2.5 })).toEqual({
      "p-1": "Jumlah harus bilangan bulat",
    });
  });

  it("qty bulat dalam stok lolos; melebihi stok tetap tertahan", () => {
    expect(errorBaris(data, "quantity", { "p-1": 3 })).toEqual({});
    expect(errorBaris(data, "quantity", { "p-1": 11 })).toEqual({
      "p-1": "Stok tercatat hanya 10",
    });
  });

  it("sisa opname desimal ditolak di klien", () => {
    expect(errorBaris(data, "opname", { "p-1": 7.5 })).toEqual({
      "p-1": "Sisa stok harus bilangan bulat",
    });
  });
});
