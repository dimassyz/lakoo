import { describe, expect, it } from "vitest";
import type { ProductSummary } from "./api";
import {
  barisKosong,
  buatKunciSinkron,
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

  it("harga koma desimal dibaca sebagai rupiah bulat: 18.500,00", () => {
    const hasil = parseNota("Gula Pasir 2 18.500,00", [teh]);
    expect(hasil[0]).toMatchObject({ qty: "2", unitCost: "18500" });
  });
});

describe("parseNota format WhatsApp (QA-3)", () => {
  it("membaca pemisah x di belakang: Nama 10 x 1500", () => {
    const hasil = parseNota("Kopi Sachet 10 x 1500", [teh]);
    expect(hasil[0]).toMatchObject({
      nama: "Kopi Sachet",
      qty: "10",
      unitCost: "1500",
    });
  });

  it("membaca format WA depan: 10x Nama @1.500", () => {
    const hasil = parseNota("10x Kopi Sachet @1.500", [teh]);
    expect(hasil[0]).toMatchObject({
      nama: "Kopi Sachet",
      qty: "10",
      unitCost: "1500",
    });
  });

  it("membaca format WA depan dengan total: 10 x Nama @1.500 = 15.000", () => {
    const hasil = parseNota("10 x Kopi Sachet @1.500 = 15.000", [teh]);
    expect(hasil[0]).toMatchObject({
      nama: "Kopi Sachet",
      qty: "10",
      unitCost: "1500",
    });
  });

  it("membaca x menempel di nama: Nama x10 @1.500", () => {
    const hasil = parseNota("Kopi Sachet x10 @1.500", [teh]);
    expect(hasil[0]).toMatchObject({
      nama: "Kopi Sachet",
      qty: "10",
      unitCost: "1500",
    });
  });

  it("membersihkan awalan daftar WA (bullet dan nomor urut)", () => {
    const hasil = parseNota(
      "- Kopi Sachet Hitam 10 1.500\n• Teh Celup 10 6.200\n1. Teh Celup 2 6.200",
      [teh],
    );
    expect(hasil).toHaveLength(3);
    expect(hasil[0]).toMatchObject({
      nama: "Kopi Sachet Hitam",
      qty: "10",
      unitCost: "1500",
    });
    expect(hasil[1]).toMatchObject({ nama: "Teh Celup", productId: "p-teh" });
    expect(hasil[2]).toMatchObject({ nama: "Teh Celup", qty: "2" });
  });
});

describe("parseNota baris non-barang (QA-3)", () => {
  it("melewati baris judul dan total tanpa membuat baris sampah", () => {
    const hasil = parseNota(
      "Belanja hari ini:\nTeh Celup 10 6.200\nTotal 46.000",
      [teh],
    );
    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toMatchObject({ nama: "Teh Celup", qty: "10" });
  });

  it("nama berisi angka tetap utuh: Beras 5kg", () => {
    const hasil = parseNota("Beras 5kg 10 45.000", [teh]);
    expect(hasil[0]).toMatchObject({
      nama: "Beras 5kg",
      qty: "10",
      unitCost: "45000",
    });
  });
});

describe("buatKunciSinkron (anti simpan ganda, QA-3)", () => {
  it("hanya pemanggil pertama yang lolos sampai kunci dilepas", () => {
    const kunci = buatKunciSinkron();
    expect(kunci.ambil()).toBe(true);
    expect(kunci.ambil()).toBe(false);
    expect(kunci.ambil()).toBe(false);
    kunci.lepas();
    expect(kunci.ambil()).toBe(true);
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
