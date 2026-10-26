import Papa from "papaparse";
import type { ImportProductsRequest, ImportSalesRequest } from "./api";

/** FSD §14 — batas baris per file. */
export const MAKS_BARANG = 500;
export const MAKS_PENJUALAN = 5000;
export const PESAN_BESAR = "File terlalu besar, pecah jadi beberapa file";

export type BarisBarang = ImportProductsRequest["rows"][number];
export type BarisJual = ImportSalesRequest["rows"][number];
export type Hasil<T> = { ok: true; rows: T[] } | { ok: false; pesan: string };

const KOLOM_BARANG = [
  "nama_barang",
  "harga_beli",
  "harga_jual",
  "stok",
] as const;
const KOLOM_JUAL = ["tanggal", "nama_barang", "jumlah"] as const;

type Sel = unknown;

/** Satu sel → teks; tanggal dari XLSX jadi YYYY-MM-DD. */
function teks(v: Sel): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** Tabel (dari CSV atau XLSX) → kepala huruf kecil + baris tanpa baris kosong. */
function keBaris(tabel: Sel[][]): { kepala: string[]; isi: string[][] } {
  const [kepala = [], ...sisa] = tabel;
  const head = (kepala as Sel[]).map((h) => teks(h).toLowerCase());
  const isi = sisa.map((r) =>
    head.map((_, i) => teks(Array.isArray(r) ? (r as Sel[])[i] : "")),
  );
  return { kepala: head, isi: isi.filter((r) => r.some((s) => s !== "")) };
}

function kurangKolom(kepala: string[], wajib: readonly string[]): string[] {
  return wajib.filter((k) => !kepala.includes(k));
}

/** Nilai dikirim apa adanya (string mentah); server yang memvalidasi (FSD §14). */
function ambil(
  baris: string[],
  kepala: string[],
  kolom: string,
): string | null {
  const i = kepala.indexOf(kolom);
  if (i < 0) return null;
  const v = baris[i];
  return v === undefined || v === "" ? null : v;
}

export function dariTabelBarang(tabel: Sel[][]): Hasil<BarisBarang> {
  const { kepala, isi } = keBaris(tabel);
  const kurang = kurangKolom(kepala, KOLOM_BARANG);
  if (kurang.length > 0)
    return { ok: false, pesan: `File tidak punya kolom: ${kurang.join(", ")}` };
  if (isi.length > MAKS_BARANG) return { ok: false, pesan: PESAN_BESAR };

  return {
    ok: true,
    rows: isi.map((r) => ({
      name: ambil(r, kepala, "nama_barang"),
      unit: ambil(r, kepala, "satuan"),
      category: ambil(r, kepala, "kategori"),
      costPrice: ambil(r, kepala, "harga_beli"),
      sellPrice: ambil(r, kepala, "harga_jual"),
      stock: ambil(r, kepala, "stok"),
    })),
  };
}

export function dariTabelJual(tabel: Sel[][]): Hasil<BarisJual> {
  const { kepala, isi } = keBaris(tabel);
  const kurang = kurangKolom(kepala, KOLOM_JUAL);
  if (kurang.length > 0)
    return { ok: false, pesan: `File tidak punya kolom: ${kurang.join(", ")}` };
  if (isi.length > MAKS_PENJUALAN) return { ok: false, pesan: PESAN_BESAR };

  return {
    ok: true,
    rows: isi.map((r) => ({
      date: ambil(r, kepala, "tanggal"),
      productName: ambil(r, kepala, "nama_barang"),
      qty: ambil(r, kepala, "jumlah"),
    })),
  };
}

export function csvKeTabel(teksCsv: string): Sel[][] {
  return Papa.parse<string[]>(teksCsv, { skipEmptyLines: "greedy" }).data;
}

/** PRD F-04 AC-3 — baris bermasalah + kolom `alasan`, dibuat di browser. */
export function csvBermasalah(
  rows: Record<string, unknown>[],
  invalid: { index: number; message: string }[],
): string {
  const kepala = [...Object.keys(rows[0] ?? {}), "alasan"];
  const isi = invalid.map(({ index, message }) => [
    ...Object.values(rows[index] ?? {}).map((v) => (v ?? "") as string),
    message,
  ]);
  return Papa.unparse([kepala, ...isi]);
}
