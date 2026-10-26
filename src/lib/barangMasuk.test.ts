import { describe, expect, it } from "vitest";
import type { ProductSummary } from "./api";
import {
  barisKosong,
  cekBaris,
  parseNota,
  payloadMasuk,
  pilihBarang,
  ringkasanMasuk,
} from "./barangMasuk";

const teh = {
  id: "p-teh",
  name: "Teh Celup",
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
  archived: false,
} as ProductSummary;

describe("parseNota (FSD §16)", () => {
  it("membaca pola nama qty harga, termasuk titik ribuan dan awalan Rp", () => {
    const hasil = parseNota("Teh Celup 10 6.200\nKopi 5 Rp3.100", [teh]);
    expect(hasil).toHaveLength(2);
    expect(hasil[0]).toMatchObject({
      nama: "Teh Celup",
      productId: "p-teh",
      qty: "10",
      unitCost: "6200",
    });
    expect(hasil[1]).toMatchObject({ qty: "5", unitCost: "3100" });
  });

  it("baris tak terbaca tetap masuk form, hanya nama terisi", () => {
    const hasil = parseNota("Gula pasir sekilo", [teh]);
    expect(hasil[0]).toMatchObject({ nama: "Gula pasir sekilo", qty: "" });
    expect(hasil[0]?.productId).toBeNull();
  });
});

describe("form barang masuk (FSD §8)", () => {
  it("memilih barang mengisi productId dan harga beli terakhir", () => {
    const b = pilihBarang(barisKosong(), "teh celup", [teh]);
    expect(b.productId).toBe("p-teh");
    expect(b.unitCost).toBe("6200");
  });

  it("menolak baris tanpa barang, jumlah, atau harga", () => {
    expect(cekBaris(barisKosong())).toBe("Nama barang wajib diisi");
    const tanpaProduk = { ...barisKosong(), nama: "X", qty: "1" };
    expect(cekBaris(tanpaProduk)).toBe("Pilih barang dari daftar");
    const tanpaQty = { ...barisKosong(), nama: "Teh", productId: "p-teh" };
    expect(cekBaris(tanpaQty)).toBe("Jumlah minimal 1");
  });

  it("baris kosong diabaikan; barang baru dikirim sebagai newProduct", () => {
    const baru = {
      ...barisKosong(),
      nama: "Teh Baru",
      baru: true,
      qty: "4",
      unitCost: "2.000",
      sellPrice: "3.500",
    };
    const body = payloadMasuk("2026-11-03", [barisKosong(), baru]);
    expect(body?.lines).toHaveLength(1);
    expect(body?.lines[0]).toMatchObject({
      newProduct: { name: "Teh Baru", unit: "pcs", sellPrice: 3500 },
      qty: 4,
      unitCost: 2000,
    });
    expect(ringkasanMasuk([barisKosong(), baru])).toEqual({
      baris: 1,
      total: 8000,
    });
  });
});
