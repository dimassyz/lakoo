import { useCallback, useEffect, useState } from "react";
import { api, type ProductStatus, type ProductSummary } from "./api";

/** FSD §9 — chip filter. "Pelengkap" bukan status, jadi dipisah. */
export type Filter = ProductStatus | "semua" | "pelengkap";

export const CHIP: { kunci: Filter; label: string }[] = [
  { kunci: "semua", label: "Semua" },
  { kunci: "sehat", label: "Sehat" },
  { kunci: "waspada", label: "Waspada" },
  { kunci: "sekarat", label: "Sekarat" },
  { kunci: "mati", label: "Mati" },
  { kunci: "stok_habis", label: "Stok habis" },
  { kunci: "pelengkap", label: "Pelengkap" },
];

/** `?status=` dari Beranda; nilai asing jatuh ke "semua". */
export function filterDariQuery(nilai: unknown): Filter {
  const teks = typeof nilai === "string" ? nilai : "";
  return CHIP.some((c) => c.kunci === teks) ? (teks as Filter) : "semua";
}

function query(filter: Filter, cari: string, arsip: boolean) {
  const q = cari.trim().slice(0, 80);
  return {
    ...(filter === "pelengkap"
      ? { complementary: true }
      : filter === "semua"
        ? {}
        : { status: filter }),
    ...(q ? { q } : {}),
    ...(arsip ? { includeArchived: true } : {}),
    sort: "priority" as const,
  };
}

export function useDaftarBarang(filter: Filter, cari: string, arsip: boolean) {
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGagal(false);
    const { data, error } = await api.GET("/products", {
      params: { query: query(filter, cari, arsip) },
    });
    if (error || !data) {
      setGagal(true);
    } else {
      setItems(data.items);
    }
    setMemuat(false);
  }, [filter, cari, arsip]);

  // 300 ms: satu request per jeda ketik, bukan satu per huruf.
  useEffect(() => {
    const t = setTimeout(() => void muat(), 300);
    return () => clearTimeout(t);
  }, [muat]);

  return { items, memuat, gagal, muat };
}

export type Kolom =
  | "name"
  | "status"
  | "stock"
  | "lastCost"
  | "sellPrice"
  | "lockedValue"
  | "lastSaleDate"
  | "priorityScore";

export const KOLOM: { kunci: Kolom; label: string }[] = [
  { kunci: "name", label: "Nama" },
  { kunci: "status", label: "Status" },
  { kunci: "stock", label: "Stok" },
  { kunci: "lastCost", label: "Harga beli" },
  { kunci: "sellPrice", label: "Harga jual" },
  { kunci: "lockedValue", label: "Uang terkunci" },
  { kunci: "lastSaleDate", label: "Terakhir laku" },
  { kunci: "priorityScore", label: "Skor" },
];

/** Urutan klien untuk tabel desktop; nilai kosong selalu di bawah. */
export function urutkan(
  items: ProductSummary[],
  kolom: Kolom,
  naik: boolean,
): ProductSummary[] {
  const arah = naik ? 1 : -1;
  return [...items].sort((a, b) => {
    const x = a[kolom];
    const y = b[kolom];
    if (x === y) return a.name.localeCompare(b.name);
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === "string" && typeof y === "string") {
      return x.localeCompare(y) * arah;
    }
    return (Number(x) - Number(y)) * arah;
  });
}

/** FSD §9 — keterangan kecil di bawah nama: reason, sisa hari, atau pelengkap. */
export function keterangan(p: ProductSummary): string {
  if (p.isComplementary) return "pelengkap";
  if (p.reason) return p.reason;
  if (p.daysUntilEmpty !== null) return `±${p.daysUntilEmpty} hari lagi habis`;
  return "";
}
