import { describe, expect, it } from "vitest";
import {
  bodyBaru,
  bodyUbah,
  cekIsian,
  isianKosong,
  peringatanJual,
} from "./formBarang";

function isi(ubah: Partial<ReturnType<typeof isianKosong>>) {
  return { ...isianKosong(), ...ubah };
}

describe("validasi form barang (FSD §10)", () => {
  it("menolak nama kosong dan nama lebih dari 80 huruf", () => {
    expect(
      cekIsian(isi({ jual: "5000", modal: "4000", stok: "3" }), true).nama,
    ).toBeDefined();
    expect(
      cekIsian(isi({ nama: "x".repeat(81), jual: "5000" }), false).nama,
    ).toContain("80");
    expect(
      cekIsian(isi({ nama: "Teh", jual: "5000" }), false).nama,
    ).toBeUndefined();
  });

  it("harga beli dan stok hanya wajib saat tambah barang", () => {
    const dasar = isi({ nama: "Teh", jual: "5000" });
    expect(cekIsian(dasar, true).modal).toBeDefined();
    expect(cekIsian(dasar, true).stok).toBeDefined();
    expect(cekIsian(dasar, false).modal).toBeUndefined();
    expect(cekIsian(dasar, false).stok).toBeUndefined();
  });

  it("menjaga batas atas rupiah dan stok", () => {
    const mahal = isi({
      nama: "Teh",
      jual: "100000001",
      modal: "1",
      stok: "1",
    });
    expect(cekIsian(mahal, true).jual).toContain("100 juta");

    const banyak = isi({ nama: "Teh", jual: "1", modal: "1", stok: "100001" });
    expect(cekIsian(banyak, true).stok).toContain("100.000");
  });

  it("membatasi satuan dan kategori sesuai FSD", () => {
    const panjang = isi({
      nama: "Teh",
      jual: "1",
      satuan: "x".repeat(17),
      kategori: "y".repeat(41),
    });
    expect(cekIsian(panjang, false).satuan).toBeDefined();
    expect(cekIsian(panjang, false).kategori).toBeDefined();
  });
});

describe("peringatan harga jual di bawah modal", () => {
  it("muncul tanpa memblokir, hilang saat harga wajar", () => {
    expect(peringatanJual(isi({ modal: "7000", jual: "5000" }))).toBe(
      "Harga jual di bawah modal",
    );
    expect(peringatanJual(isi({ modal: "5000", jual: "5000" }))).toBe("");
    expect(peringatanJual(isi({ modal: "", jual: "5000" }))).toBe("");
  });
});

describe("body permintaan", () => {
  it("tambah: satuan bawaan pcs, kategori kosong jadi null", () => {
    const body = bodyBaru(
      isi({
        nama: "  Teh  ",
        jual: "5000",
        modal: "4000",
        stok: "12",
        satuan: "",
      }),
    );
    expect(body).toEqual({
      name: "Teh",
      unit: "pcs",
      category: null,
      costPrice: 4000,
      sellPrice: 5000,
      openingStock: 12,
      isComplementary: false,
    });
  });

  it("ubah: batas stok hanya dikirim untuk barang pelengkap", () => {
    const biasa = bodyUbah(isi({ nama: "Teh", jual: "5000", batasStok: "9" }));
    expect(biasa.complementaryMaxStock).toBeNull();
    expect(biasa.sellPrice).toBe(5000);

    const pelengkap = bodyUbah(
      isi({ nama: "Teh", jual: "5000", pelengkap: true, batasStok: "9" }),
    );
    expect(pelengkap.complementaryMaxStock).toBe(9);
    expect(pelengkap.isComplementary).toBe(true);
  });
});
