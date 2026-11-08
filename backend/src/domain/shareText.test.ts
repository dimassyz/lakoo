import { describe, expect, it } from "vitest";
import {
  formatRupiah,
  formatTanggalPanjang,
  substituteShareText,
  type ShareTextValues,
} from "./shareText.ts";

const BASE: ShareTextValues = {
  storeName: "Toko Bu Sri",
  productName: "Barang Mati",
  oldPrice: 20_000,
  newPrice: 17_000,
  bundlePrice: null,
  bundleProductName: null,
  bundleProductSellPrice: null,
  dueText: "16 November 2026",
};

describe("formatRupiah", () => {
  it("integer Rupiah dengan pemisah ribuan id-ID", () => {
    expect(formatRupiah(27_500)).toBe("Rp27.500");
    expect(formatRupiah(20_000)).toBe("Rp20.000");
    expect(formatRupiah(500)).toBe("Rp500");
  });
});

describe("formatTanggalPanjang", () => {
  it("tanggal panjang Indonesia tanpa nama hari", () => {
    expect(formatTanggalPanjang("2026-11-15")).toBe("15 November 2026");
    expect(formatTanggalPanjang("2026-01-05")).toBe("5 Januari 2026");
  });
});

describe("substituteShareText", () => {
  it("mengisi placeholder promo template dengan nilai nyata", () => {
    const text = substituteShareText(
      "Promo {nama_toko}: {nama_barang} sekarang {harga_baru}. Berlaku sampai {berlaku_sampai}.",
      BASE,
    );
    expect(text).toBe(
      "Promo Toko Bu Sri: Barang Mati sekarang Rp17.000. Berlaku sampai 16 November 2026.",
    );
    expect(text).not.toContain("{");
  });

  it("mengisi harga_lama", () => {
    expect(substituteShareText("(biasanya {harga_lama})", BASE)).toBe(
      "(biasanya Rp20.000)",
    );
  });

  it("mengisi placeholder paket + hemat dari data bundle", () => {
    const text = substituteShareText(
      "Paket {nama_barang} + {nama_paket} cuma {harga_paket}, hemat {hemat}!",
      {
        ...BASE,
        bundlePrice: 28_000,
        bundleProductName: "Barang Laku",
        bundleProductSellPrice: 10_000,
      },
    );
    // hemat = 20.000 + 10.000 − 28.000 = 2.000
    expect(text).toBe(
      "Paket Barang Mati + Barang Laku cuma Rp28.000, hemat Rp2.000!",
    );
  });

  it("placeholder paket di tahap non-bundle hilang tanpa sisa kurung/spasi ganda", () => {
    const text = substituteShareText(
      "Paket {nama_paket} hemat {hemat} untuk {nama_barang}.",
      BASE,
    );
    expect(text).toBe("Paket hemat untuk Barang Mati.");
    expect(text).not.toContain("{");
    expect(text).not.toContain("  ");
  });

  it("placeholder tak dikenal ikut dibersihkan", () => {
    expect(substituteShareText("Promo {diskon_spesial} hari ini", BASE)).toBe(
      "Promo hari ini",
    );
  });
});
