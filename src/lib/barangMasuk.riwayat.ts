import { useCallback, useEffect, useState } from "react";
import { api, type StockIn } from "./api";
import {
  PESAN_GANGGUAN,
  PESAN_SESI,
  type KoreksiMasuk,
} from "./barangMasuk.form";

/** Riwayat 30 hari terakhir (bawaan endpoint), urut tanggal terbaru. */
export function useRiwayatMasuk() {
  const [items, setItems] = useState<StockIn[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGagal(false);
    const { data, error } = await api.GET("/stock-ins", {});
    if (error || !data) {
      setGagal(true);
    } else {
      setItems(data.items);
    }
    setMemuat(false);
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  return { items, memuat, gagal, muat };
}

function pesanRiwayat(status: number): string {
  if (status === 409) return "Sudah lebih dari 7 hari, tidak bisa diubah";
  if (status === 422) return "Tidak bisa: stok sudah terjual sebagian";
  if (status === 404) return "Baris tidak ditemukan";
  if (status === 401) return PESAN_SESI;
  return PESAN_GANGGUAN;
}

/** Koreksi & hapus baris riwayat; null = berhasil. */
export function useAksiRiwayat(muat: () => Promise<void>) {
  const ubah = useCallback(
    async (id: string, patch: KoreksiMasuk): Promise<string | null> => {
      const { response } = await api.PATCH("/stock-ins/{stockInId}", {
        params: { path: { stockInId: id } },
        body: patch,
      });
      if (!response.ok) return pesanRiwayat(response.status);
      await muat();
      return null;
    },
    [muat],
  );

  const hapus = useCallback(
    async (id: string): Promise<string | null> => {
      const { response } = await api.DELETE("/stock-ins/{stockInId}", {
        params: { path: { stockInId: id } },
        body: {},
      });
      if (!response.ok) return pesanRiwayat(response.status);
      await muat();
      return null;
    },
    [muat],
  );

  return { ubah, hapus };
}

export function kelompokRiwayat(items: StockIn[]) {
  const peta = new Map<string, StockIn[]>();
  for (const it of items) {
    const isi = peta.get(it.receivedOn);
    if (isi) isi.push(it);
    else peta.set(it.receivedOn, [it]);
  }
  return [...peta].map(([tanggal, baris]) => ({ tanggal, baris }));
}
