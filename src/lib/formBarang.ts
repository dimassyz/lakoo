import { useCallback, useState } from "react";
import {
  api,
  type ProductCreate,
  type ProductDetail,
  type ProductPatch,
} from "./api";

/** FSD §10 — isian form barang. Angka disimpan sebagai teks supaya mudah diketik. */
export type IsianBarang = {
  nama: string;
  modal: string;
  jual: string;
  stok: string;
  satuan: string;
  kategori: string;
  pelengkap: boolean;
  batasStok: string;
};

export type GalatBarang = Partial<Record<keyof IsianBarang | "umum", string>>;

const MAKS_RUPIAH = 100_000_000;
const MAKS_STOK = 100_000;

/** Kunci `error.fields` dari server → kunci isian di form. */
const PETA_FIELD: Record<string, keyof IsianBarang> = {
  name: "nama",
  costPrice: "modal",
  sellPrice: "jual",
  openingStock: "stok",
  unit: "satuan",
  category: "kategori",
  complementaryMaxStock: "batasStok",
};

export function isianKosong(): IsianBarang {
  return {
    nama: "",
    modal: "",
    jual: "",
    stok: "",
    satuan: "pcs",
    kategori: "",
    pelengkap: false,
    batasStok: "",
  };
}

export function isianDari(p: ProductDetail): IsianBarang {
  return {
    nama: p.name,
    modal: String(p.lastCost),
    jual: String(p.sellPrice),
    stok: String(p.stock),
    satuan: p.unit,
    kategori: p.category ?? "",
    pelengkap: p.isComplementary,
    batasStok:
      p.complementaryMaxStock === null ? "" : String(p.complementaryMaxStock),
  };
}

function angka(teks: string): number | null {
  const bersih = teks.trim();
  if (bersih === "") return null;
  const n = Number(bersih);
  return Number.isFinite(n) ? n : null;
}

/** FSD §10 — validasi klien; ini UX, server tetap otoritas. */
export function cekIsian(i: IsianBarang, baru: boolean): GalatBarang {
  return { ...cekAngkaWajib(i, baru), ...cekBatasTeks(i) };
}

function cekNama(i: IsianBarang): string | undefined {
  const n = i.nama.trim();
  if (n.length === 0) return "Nama barang wajib diisi";
  if (n.length > 80) return "Nama maksimal 80 huruf";
  return undefined;
}

function cekRupiah(teks: string, label: string): string | undefined {
  const n = angka(teks);
  if (n === null) return `${label} wajib diisi`;
  if (n < 0 || n > MAKS_RUPIAH) return `${label} 0–100 juta`;
  return undefined;
}

function cekStok(teks: string): string | undefined {
  const n = angka(teks);
  if (n === null) return "Stok wajib diisi";
  if (n < 0 || n > MAKS_STOK) return "Stok 0–100.000";
  return undefined;
}

function cekAngkaWajib(i: IsianBarang, baru: boolean): GalatBarang {
  const g: GalatBarang = {};

  const nama = cekNama(i);
  if (nama) g.nama = nama;

  const jual = cekRupiah(i.jual, "Harga jual");
  if (jual) g.jual = jual;

  if (!baru) return g;

  const modal = cekRupiah(i.modal, "Harga beli");
  if (modal) g.modal = modal;

  const stok = cekStok(i.stok);
  if (stok) g.stok = stok;

  return g;
}

function cekBatasTeks(i: IsianBarang): GalatBarang {
  const g: GalatBarang = {};
  if (i.satuan.trim().length > 16) g.satuan = "Satuan maksimal 16 huruf";
  if (i.kategori.trim().length > 40) g.kategori = "Kategori maksimal 40 huruf";
  return g;
}

/** FSD §10 — peringatan kuning, tidak memblokir penyimpanan. */
export function peringatanJual(i: IsianBarang): string {
  const modal = angka(i.modal);
  const jual = angka(i.jual);
  if (modal === null || jual === null) return "";
  return jual < modal ? "Harga jual di bawah modal" : "";
}

export function bodyBaru(i: IsianBarang): ProductCreate {
  return {
    name: i.nama.trim(),
    unit: i.satuan.trim() === "" ? "pcs" : i.satuan.trim(),
    category: i.kategori.trim() === "" ? null : i.kategori.trim(),
    costPrice: angka(i.modal) ?? 0,
    sellPrice: angka(i.jual) ?? 0,
    openingStock: angka(i.stok) ?? 0,
    isComplementary: i.pelengkap,
  };
}

export function bodyUbah(i: IsianBarang): ProductPatch {
  return {
    name: i.nama.trim(),
    unit: i.satuan.trim() === "" ? "pcs" : i.satuan.trim(),
    category: i.kategori.trim() === "" ? null : i.kategori.trim(),
    sellPrice: angka(i.jual) ?? 0,
    isComplementary: i.pelengkap,
    complementaryMaxStock: i.pelengkap ? angka(i.batasStok) : null,
  };
}

export type HasilSimpan =
  { ok: true; id: string } | { ok: false; galat: GalatBarang; tautan?: string };

type ErrorBody = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
    existingProductId?: string;
  };
};

const PESAN_STATUS: Record<number, string> = {
  401: "Sesi berakhir, silakan masuk lagi",
  403: "Akun demo tidak bisa mengubah barang",
  404: "Barang tidak ditemukan",
  429: "Terlalu banyak percobaan. Coba lagi sebentar.",
};

function galatValidasi(isi: NonNullable<ErrorBody["error"]>): {
  galat: GalatBarang;
} {
  const galat: GalatBarang = {};
  for (const [kunci, pesan] of Object.entries(isi.fields ?? {})) {
    const tujuan = PETA_FIELD[kunci];
    if (tujuan) galat[tujuan] = pesan;
  }
  if (Object.keys(galat).length > 0) return { galat };
  return { galat: { umum: isi.message ?? "Isian belum benar" } };
}

function galatDari(
  status: number,
  error: unknown,
): { galat: GalatBarang; tautan?: string } {
  const isi = (error as ErrorBody | undefined)?.error;

  if (status === 400 && isi) return galatValidasi(isi);

  if (status === 409 && isi?.code === "duplicate_product_name") {
    return {
      galat: { nama: "Nama ini sudah ada. Buka barangnya" },
      tautan: isi.existingProductId
        ? `/toko/barang/${isi.existingProductId}`
        : undefined,
    };
  }

  const umum = PESAN_STATUS[status] ?? "Ada gangguan. Coba lagi sebentar.";
  return { galat: { umum } };
}

/** State form + kirim; dipakai halaman tambah dan ubah. */
export function useFormBarang(
  mode: "baru" | "ubah",
  id: string | undefined,
  awal: IsianBarang | undefined,
  onSelesai: (id: string) => void,
) {
  const [isian, setIsian] = useState<IsianBarang>(awal ?? isianKosong());
  const [galat, setGalat] = useState<GalatBarang>({});
  const [tautan, setTautan] = useState<string>();
  const { simpan, menyimpan } = useSimpanBarang(mode, id);

  const ubah = (patch: Partial<IsianBarang>) =>
    setIsian((lama) => ({ ...lama, ...patch }));

  async function kirim(lagi: boolean) {
    const hasil = await simpan(isian);
    if (!hasil.ok) {
      setGalat(hasil.galat);
      setTautan(hasil.tautan);
      return;
    }
    setGalat({});
    setTautan(undefined);
    if (lagi) setIsian(isianKosong());
    else onSelesai(hasil.id);
  }

  return { isian, galat, tautan, menyimpan, ubah, kirim };
}

/** Simpan barang: POST saat tambah, PATCH saat ubah. */
export function useSimpanBarang(mode: "baru" | "ubah", id?: string) {
  const [menyimpan, setMenyimpan] = useState(false);

  const simpan = useCallback(
    async (isian: IsianBarang): Promise<HasilSimpan> => {
      const galatLokal = cekIsian(isian, mode === "baru");
      if (Object.keys(galatLokal).length > 0)
        return { ok: false, galat: galatLokal };

      setMenyimpan(true);
      try {
        const res =
          mode === "baru"
            ? await api.POST("/products", { body: bodyBaru(isian) })
            : await api.PATCH("/products/{productId}", {
                params: { path: { productId: id ?? "" } },
                body: bodyUbah(isian),
              });

        if (res.response.ok && res.data) {
          return { ok: true, id: res.data.id };
        }
        return { ok: false, ...galatDari(res.response.status, res.error) };
      } catch {
        return {
          ok: false,
          galat: { umum: "Ada gangguan. Coba lagi sebentar." },
        };
      } finally {
        setMenyimpan(false);
      }
    },
    [mode, id],
  );

  return { simpan, menyimpan };
}
