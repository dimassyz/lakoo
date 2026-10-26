import { del, entries, get, set } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { OutboxItem } from "./outbox";

/**
 * FSD §0.4 — worker kirim-ulang outbox.
 * `id` item dipakai ulang sebagai Idempotency-Key, jadi kiriman ganda
 * ditolak server (`idempotency_key_reused`) alih-alih tercatat dua kali.
 */
export type HasilKirim = "terkirim" | "tinjau" | "sesi" | "buang" | "ulang";

/** 30 dtk → 1 → 2 → 5 → 10 mnt, lalu tetap 10 mnt. */
const JEDA = [30_000, 60_000, 120_000, 300_000, 600_000];
const KUNCI = "outbox:";
const TICK = 30_000;

/** Semua item antrean, terlama dulu. */
export async function daftarAntrean(): Promise<OutboxItem[]> {
  const semua = await entries<string, OutboxItem>();
  return semua
    .filter(([k]) => k.startsWith(KUNCI))
    .map(([, v]) => v)
    .sort((a, b) => a.dibuat.localeCompare(b.dibuat));
}

export async function ambilItem(id: string): Promise<OutboxItem | undefined> {
  return get<OutboxItem>(`${KUNCI}${id}`);
}

export async function buangItem(id: string): Promise<void> {
  await del(`${KUNCI}${id}`);
}

/** Petakan status HTTP ke tindakan antrean. */
export function hasilDariStatus(status: number): HasilKirim {
  // 409 = kunci ini sudah diproses server; mengirim lagi hanya menggandakan.
  if (status < 400 || status === 409) return "terkirim";
  if (status === 401) return "sesi";
  if (status === 422) return "tinjau";
  // 408/429 sembuh sendiri; 4xx lain tidak akan berubah dengan diulang.
  if (status === 408 || status === 429) return "ulang";
  return status < 500 ? "buang" : "ulang";
}

/** Satu item, satu percobaan. Tidak melempar — hasilnya jadi status. */
export async function kirimItem(item: OutboxItem): Promise<HasilKirim> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  const opsi = {
    params: { header: { "Idempotency-Key": item.id } },
    signal: ctrl.signal,
  };

  try {
    const { response } =
      item.kind === "recap"
        ? await api.PUT("/sales/recap", { ...opsi, body: item.payload })
        : await api.POST("/stock-ins", { ...opsi, body: item.payload });
    return hasilDariStatus(response.status);
  } catch {
    return "ulang";
  } finally {
    clearTimeout(timer);
  }
}

/** Jeda sebelum percobaan berikutnya, berdasarkan jumlah kegagalan. */
export function jedaBerikut(coba: number): number {
  return JEDA[Math.min(coba - 1, JEDA.length - 1)] ?? 600_000;
}

/** Satu putaran: kirim yang jatuh tempo, jadwalkan ulang sisanya. */
export async function jalankanAntrean(): Promise<void> {
  const sekarang = Date.now();

  for (const item of await daftarAntrean()) {
    if (item.status !== "pending") continue;
    if ((item.berikut ?? 0) > sekarang) continue;

    const hasil = await kirimItem(item);

    if (hasil === "terkirim" || hasil === "buang") {
      await buangItem(item.id);
    } else if (hasil === "sesi") {
      return; // tidak ada gunanya melanjutkan tanpa sesi
    } else if (hasil === "tinjau") {
      await set(`${KUNCI}${item.id}`, { ...item, status: "needs_review" });
    } else {
      const coba = (item.coba ?? 0) + 1;
      await set(`${KUNCI}${item.id}`, {
        ...item,
        coba,
        berikut: sekarang + jedaBerikut(coba),
      });
    }
  }
}

export type Antrean = {
  items: OutboxItem[];
  mengirim: boolean;
  kirimSekarang: () => Promise<void>;
  buang: (id: string) => Promise<void>;
};

/** Dipanggil sekali di AppShell: kirim saat app dimuat, saat online, tiap 30 dtk. */
export function useAntrean(): Antrean {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [mengirim, setMengirim] = useState(false);

  const muat = useCallback(async () => {
    setItems(await daftarAntrean());
  }, []);

  const putaran = useCallback(async () => {
    await jalankanAntrean();
    await muat();
  }, [muat]);

  const kirimSekarang = useCallback(async () => {
    setMengirim(true);
    await putaran();
    setMengirim(false);
  }, [putaran]);

  const buang = useCallback(
    async (id: string) => {
      await buangItem(id);
      await muat();
    },
    [muat],
  );

  useEffect(() => {
    void putaran();
    const jam = setInterval(() => void putaran(), TICK);
    const online = () => void putaran();
    window.addEventListener("online", online);
    return () => {
      clearInterval(jam);
      window.removeEventListener("online", online);
    };
  }, [putaran]);

  return { items, mengirim, kirimSekarang, buang };
}
