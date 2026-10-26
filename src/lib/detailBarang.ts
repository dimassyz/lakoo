import { useCallback, useEffect, useState } from "react";
import { api, type Plan, type ProductDetail } from "./api";

const PESAN_SESI = "Sesi berakhir, silakan masuk lagi";
const PESAN_GANGGUAN = "Ada gangguan. Coba lagi sebentar.";

/** FSD §0.3 + §11.2 — kode 409 dipecah per arti, bukan satu pesan generik. */
function pesan(status: number, kode?: string): string {
  if (status === 401) return PESAN_SESI;
  if (status === 429) return "Terlalu banyak percobaan. Coba lagi sebentar.";
  if (status === 422) return "Tidak bisa: stok sudah terjual sebagian";
  if (status === 404) return "Barang tidak ditemukan";
  if (status === 409) {
    if (kode === "plan_already_active")
      return "Sudah ada rencana berjalan. Memuat ulang…";
    if (kode === "plan_not_applicable")
      return "Status barang sudah berubah. Memuat ulang…";
    if (kode === "step_invalid_state")
      return "Tahap ini sudah berubah. Memuat ulang…";
    if (kode === "duplicate_product_name")
      return "Nama itu sudah dipakai barang lain";
    return "Keadaan sudah berubah. Memuat ulang…";
  }
  return PESAN_GANGGUAN;
}

type Res = { response: Response; error?: unknown; data?: unknown };

/** null = berhasil; selain itu pesan siap tampil. */
async function jalankan(panggil: () => Promise<Res>): Promise<string | null> {
  const res = await panggil();
  if (res.response.ok) return null;
  const kode = (res.error as { error?: { code?: string } } | undefined)?.error
    ?.code;
  return pesan(res.response.status, kode);
}

export function useProduk(id: string | undefined) {
  const [data, setData] = useState<ProductDetail | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState(false);

  const muat = useCallback(async () => {
    if (!id) return;
    setMemuat(true);
    setGagal(false);
    const { data: hasil, error } = await api.GET("/products/{productId}", {
      params: { path: { productId: id } },
    });
    if (error || !hasil) {
      setData(null);
      setGagal(true);
    } else {
      setData(hasil);
    }
    setMemuat(false);
  }, [id]);

  useEffect(() => {
    void muat();
  }, [muat]);

  return { data, memuat, gagal, muat };
}

/** Rencana suggested/active + rencana terakhir yang sudah berakhir. */
export function useRencana(id: string | undefined) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [lastEnded, setLastEnded] = useState<Plan | null>(null);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    if (!id) return;
    setMemuat(true);
    const { data } = await api.GET("/products/{productId}/plans/current", {
      params: { path: { productId: id } },
    });
    setPlan(data?.plan ?? null);
    setLastEnded(data?.lastEnded ?? null);
    setMemuat(false);
  }, [id]);

  useEffect(() => {
    void muat();
  }, [muat]);

  return { plan, lastEnded, memuat, muat };
}

/** Semua aksi layar detail; tiap fungsi mengembalikan pesan gagal atau null. */
export function useAksiDetail(id: string, segarkan: () => Promise<void>) {
  const arsipkan = useCallback(
    (arsip: boolean) =>
      jalankan(async () => {
        const r = await api.POST("/products/{productId}/archive", {
          params: { path: { productId: id } },
          body: { archived: arsip },
        });
        if (!r.response.ok) return r as Res;
        await segarkan();
        return r as Res;
      }),
    [id, segarkan],
  );

  const pelengkap = useCallback(
    (isi: boolean) =>
      jalankan(async () => {
        const r = await api.PATCH("/products/{productId}", {
          params: { path: { productId: id } },
          body: { isComplementary: isi },
        });
        if (!r.response.ok) return r as Res;
        await segarkan();
        return r as Res;
      }),
    [id, segarkan],
  );

  const batasStok = useCallback(
    (nilai: number | null) =>
      jalankan(async () => {
        const r = await api.PATCH("/products/{productId}", {
          params: { path: { productId: id } },
          body: { complementaryMaxStock: nilai },
        });
        if (!r.response.ok) return r as Res;
        await segarkan();
        return r as Res;
      }),
    [id, segarkan],
  );

  const perbaikiStok = useCallback(
    (countedStock: number) =>
      jalankan(async () => {
        const r = await api.POST("/products/{productId}/stock-adjustments", {
          params: { path: { productId: id } },
          body: { countedStock },
        });
        if (!r.response.ok) return r as Res;
        await segarkan();
        return r as Res;
      }),
    [id, segarkan],
  );

  return { arsipkan, pelengkap, batasStok, perbaikiStok };
}

/** Aksi rencana (FSD §11.2); tiap fungsi mengembalikan pesan gagal atau null. */
export function useAksiRencana(id: string, segarkan: () => Promise<void>) {
  const buat = useCallback(
    (regenerate: boolean) =>
      jalankan(async () => {
        const r = await api.POST("/products/{productId}/plans", {
          params: { path: { productId: id } },
          body: { regenerate },
        });
        await segarkan();
        return r as Res;
      }),
    [id, segarkan],
  );

  const jalankanRencana = useCallback(
    (planId: string) =>
      jalankan(async () => {
        const r = await api.POST("/plans/{planId}/start", {
          params: { path: { planId } },
        });
        await segarkan();
        return r as Res;
      }),
    [segarkan],
  );

  const hentikan = useCallback(
    (planId: string) =>
      jalankan(async () => {
        const r = await api.POST("/plans/{planId}/stop", {
          params: { path: { planId } },
        });
        await segarkan();
        return r as Res;
      }),
    [segarkan],
  );

  return { buat, jalankanRencana, hentikan };
}

/** Aksi pada satu tahap rencana. */
export function useAksiTahap(segarkan: () => Promise<void>) {
  const hasil = useCallback(
    (planId: string, stepNo: number, outcome: "succeeded" | "failed") =>
      jalankan(async () => {
        const r = await api.POST("/plans/{planId}/steps/{stepNo}/outcome", {
          params: { path: { planId, stepNo } },
          body: { outcome },
        });
        await segarkan();
        return r as Res;
      }),
    [segarkan],
  );

  const terapkanHarga = useCallback(
    (planId: string, stepNo: number) =>
      jalankan(async () => {
        const r = await api.POST("/plans/{planId}/steps/{stepNo}/apply-price", {
          params: { path: { planId, stepNo } },
        });
        await segarkan();
        return r as Res;
      }),
    [segarkan],
  );

  return { hasil, terapkanHarga };
}
