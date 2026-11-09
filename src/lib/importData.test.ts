import { describe, expect, it } from "vitest";
import {
  csvBermasalah,
  csvKeTabel,
  dariTabelBarang,
  dariTabelJual,
  MAKS_BARANG,
  MAKS_PENJUALAN,
} from "./importData";

const CSV_BARANG = `Nama_Barang,Harga_Beli,Harga_Jual,Stok,Satuan,Kategori
Teh Botol,"Rp12.500","15.000",24,botol,minuman

Kopi Sachet,800,1000,120,sachet,minuman
`;

describe("import barang (FSD §14)", () => {
  it("mencocokkan header tanpa peduli huruf besar/kecil dan melewati baris kosong", () => {
    const hasil = dariTabelBarang(csvKeTabel(CSV_BARANG));
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.rows).toHaveLength(2);
    expect(hasil.rows[0]).toEqual({
      name: "Teh Botol",
      unit: "botol",
      category: "minuman",
      costPrice: "Rp12.500",
      sellPrice: "15.000",
      stock: "24",
    });
  });

  it("mengirim angka mentah apa adanya, bukan hasil konversi", () => {
    const hasil = dariTabelBarang(csvKeTabel(CSV_BARANG));
    if (!hasil.ok) throw new Error(hasil.pesan);
    expect(hasil.rows[1]?.costPrice).toBe("800");
  });

  it("menolak file tanpa kolom wajib dan menyebut kolom yang hilang", () => {
    const hasil = dariTabelBarang(csvKeTabel("nama_barang,stok\nTeh,3\n"));
    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.pesan).toContain("harga_beli");
    expect(hasil.pesan).toContain("harga_jual");
  });

  it("header saja tanpa baris data menghasilkan daftar kosong", () => {
    const hasil = dariTabelBarang(
      csvKeTabel("nama_barang,harga_beli,harga_jual,stok\n"),
    );
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.rows).toHaveLength(0);
  });

  it("menolak lebih dari 500 baris dan menyebut jumlah + batasnya (QA-8 F-04)", () => {
    const baris = Array.from(
      { length: MAKS_BARANG + 1 },
      (_, i) => `Barang ${i},1000,1500,5,pcs,lain`,
    );
    const hasil = dariTabelBarang(
      csvKeTabel(
        `nama_barang,harga_beli,harga_jual,stok,satuan,kategori\n${baris.join("\n")}`,
      ),
    );
    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.pesan).toBe(
      "File berisi 501 baris — maksimal 500 baris per impor. Pecah jadi beberapa file.",
    );
  });
});

describe("import penjualan (FSD §14)", () => {
  it("memetakan tanggal, nama barang, dan jumlah", () => {
    const hasil = dariTabelJual(
      csvKeTabel("tanggal,nama_barang,jumlah\n2026-10-01,Teh Botol,3\n"),
    );
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.rows[0]).toEqual({
      date: "2026-10-01",
      productName: "Teh Botol",
      qty: "3",
    });
  });

  it("mengubah sel tanggal XLSX menjadi YYYY-MM-DD", () => {
    const hasil = dariTabelJual([
      ["tanggal", "nama_barang", "jumlah"],
      [new Date("2026-10-02T00:00:00Z"), "Kopi", 2],
    ]);
    if (!hasil.ok) throw new Error(hasil.pesan);
    expect(hasil.rows[0]?.date).toBe("2026-10-02");
    expect(hasil.rows[0]?.qty).toBe("2");
  });

  it("menolak lebih dari 5.000 baris dan menyebut batas penjualan (QA-8 F-04)", () => {
    const baris = Array.from(
      { length: MAKS_PENJUALAN + 1 },
      (_, i) => `2026-10-01,Barang ${i},1`,
    );
    const hasil = dariTabelJual(
      csvKeTabel(`tanggal,nama_barang,jumlah\n${baris.join("\n")}`),
    );
    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.pesan).toContain("5001 baris");
    expect(hasil.pesan).toContain("maksimal 5000 baris");
  });
});

describe("unduh baris bermasalah (PRD F-04 AC-3, QA-8 F-01)", () => {
  it("barang: header kolom template dengan alasan terakhir", () => {
    const rows = [
      {
        name: "Teh",
        unit: "botol",
        category: "minuman",
        costPrice: "0",
        sellPrice: "0",
        stock: "1",
      },
    ];
    const csv = csvBermasalah("barang", rows, [
      { index: 0, message: "Harga harus angka bulat ≥ 0." },
    ]);
    const tabel = csvKeTabel(csv);
    expect(tabel[0]).toEqual([
      "nama_barang",
      "harga_beli",
      "harga_jual",
      "stok",
      "satuan",
      "kategori",
      "alasan",
    ]);
    expect(tabel[1]).toEqual([
      "Teh",
      "0",
      "0",
      "1",
      "botol",
      "minuman",
      "Harga harus angka bulat ≥ 0.",
    ]);
  });
});

describe("impor ulang file unduhan baris bermasalah (QA-8 F-01)", () => {
  it("barang: file unduhan bisa diimpor ulang apa adanya (alasan diabaikan)", () => {
    const rows = [
      {
        name: "Teh Botol",
        unit: "botol",
        category: "minuman",
        costPrice: "12000",
        sellPrice: "15000",
        stock: "24",
      },
      {
        name: "Kopi Sachet",
        unit: "sachet",
        category: "minuman",
        costPrice: "800",
        sellPrice: "1000",
        stock: "120",
      },
    ];
    const csv = csvBermasalah("barang", rows, [
      { index: 0, message: "Harga harus angka bulat ≥ 0." },
      { index: 1, message: "Stok awal harus angka bulat ≥ 0." },
    ]);
    const hasil = dariTabelBarang(csvKeTabel(csv));
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.rows).toEqual(rows);
  });

  it("jual: header template penjualan dan bisa diimpor ulang", () => {
    const rows = [{ date: "2026-10-01", productName: "Teh Botol", qty: "3" }];
    const csv = csvBermasalah("jual", rows, [
      { index: 0, message: "Stok tercatat hanya 0" },
    ]);
    const tabel = csvKeTabel(csv);
    expect(tabel[0]).toEqual(["tanggal", "nama_barang", "jumlah", "alasan"]);
    expect(tabel[1]).toEqual([
      "2026-10-01",
      "Teh Botol",
      "3",
      "Stok tercatat hanya 0",
    ]);

    const hasil = dariTabelJual(csvKeTabel(csv));
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.rows).toEqual(rows);
  });
});
