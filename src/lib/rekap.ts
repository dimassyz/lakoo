import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type SalesRecap,
  type SalesRecapPut,
  type SalesRecapResult,
} from "./api";
import { hapusOutbox, idOutbox, simpanOutbox } from "./outbox";
import { hariIniWib, rupiah } from "./ui";

export type Mode = "quantity" | "opname";
export type Nilai = Record<string, number>;

/** FSD §7 — data rekap satu tanggal. */
export function useRekap(tanggal: string, mode: Mode) {
  const [data, setData] = useState<SalesRecap | null>(null);
  const [nilai, setNilai] = useState<Nilai>({});
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGagal(false);
    const { data: hasil, error } = await api.GET("/sales/recap", {
      params: { query: { date: tanggal } },
    });
    if (error || !hasil) {
      setData(null);
      setGagal(true);
    } else {
      setData(hasil);
      setNilai(
        mode === "quantity"
          ? Object.fromEntries(
              hasil.lines.map((l) => [l.productId, l.recordedQty]),
            )
          : {},
      );
    }
    setMemuat(false);
  }, [tanggal, mode]);

  useEffect(() => {
    void muat();
  }, [muat]);

  return { data, nilai, setNilai, memuat, gagal, muat };
}

/** FSD §7 — validasi klien per baris. Server tetap otoritas (BR-16). */
export function errorBaris(
  data: SalesRecap,
  mode: Mode,
  nilai: Nilai,
): Record<string, string> {
  const hasil: Record<string, string> = {};

  for (const l of data.lines) {
    const n = nilai[l.productId];
    if (mode === "quantity") {
      const isi = n ?? l.recordedQty;
      const tersedia = l.currentStock + l.recordedQty;
      if (isi > tersedia)
        hasil[l.productId] = `Stok tercatat hanya ${tersedia}`;
    } else if (n !== undefined && l.morningStock + l.stockInOnDate - n < 0) {
      hasil[l.productId] =
        "Sisa lebih banyak dari catatan. Cek lagi jumlahnya atau";
    }
  }

  return hasil;
}

/** FSD §7 — hanya baris yang berubah (quantity) atau terisi (opname) yang dikirim. */
export function payloadRekap(
  data: SalesRecap,
  mode: Mode,
  nilai: Nilai,
): SalesRecapPut["lines"] {
  if (mode === "quantity") {
    return data.lines
      .filter((l) => (nilai[l.productId] ?? l.recordedQty) !== l.recordedQty)
      .map((l) => ({
        productId: l.productId,
        qty: nilai[l.productId] ?? l.recordedQty,
      }));
  }
  return data.lines
    .filter((l) => nilai[l.productId] !== undefined)
    .map((l) => ({
      productId: l.productId,
      countedStock: nilai[l.productId] ?? 0,
    }));
}

/** Angka untuk footer lengket. */
export function ringkasan(data: SalesRecap | null, mode: Mode, nilai: Nilai) {
  let jumlah = 0;
  let total = 0;
  let estimasi = 0;
  if (!data) return { jumlah, total, estimasi };

  for (const l of data.lines) {
    const n = nilai[l.productId];
    if (mode === "quantity") {
      const isi = n ?? l.recordedQty;
      if (isi === l.recordedQty) continue;
      jumlah += 1;
      total += isi;
      estimasi += isi * l.sellPrice;
    } else if (n !== undefined) {
      const sold = l.morningStock + l.stockInOnDate - n;
      jumlah += 1;
      total += sold;
      estimasi += sold * l.sellPrice;
    }
  }

  return { jumlah, total, estimasi };
}

const PESAN_JARINGAN = "Belum terkirim — akan dikirim otomatis saat ada sinyal";

function petaBaris(
  error: unknown,
  lines: SalesRecapPut["lines"],
): Record<string, string> {
  const daftar =
    (
      error as
        { error?: { lines?: { index: number; message: string }[] } } | undefined
    )?.error?.lines ?? [];
  const hasil: Record<string, string> = {};
  for (const e of daftar) {
    const baris = lines[e.index];
    if (baris) hasil[baris.productId] = e.message;
  }
  return hasil;
}

type SimpanArgs = {
  tanggal: string;
  mode: Mode;
  data: SalesRecap | null;
  nilai: Nilai;
  onSukses: (hasil: SalesRecapResult) => void;
  onGagal: (pesan: string) => void;
  on422: (pesanPerBaris: Record<string, string>) => void;
};

/** FSD §0.4 — simpan lewat outbox IndexedDB; Idempotency-Key = id outbox. */
export function useSimpanRekap({
  tanggal,
  mode,
  data,
  nilai,
  onSukses,
  onGagal,
  on422,
}: SimpanArgs) {
  const [menyimpan, setMenyimpan] = useState(false);

  const simpan = useCallback(async () => {
    if (!data) return;
    const lines = payloadRekap(data, mode, nilai);
    if (lines.length === 0) return;

    const body: SalesRecapPut = { date: tanggal, mode, lines };
    const id = idOutbox();
    await simpanOutbox({
      id,
      kind: "recap",
      tanggal,
      baris: lines.length,
      status: "pending",
      payload: body,
      dibuat: new Date().toISOString(),
    });

    setMenyimpan(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await api.PUT("/sales/recap", {
        body,
        params: { header: { "Idempotency-Key": id } },
        signal: ctrl.signal,
      });
      if (res.response.ok && res.data) {
        await hapusOutbox(id);
        onSukses(res.data);
      } else if (res.response.status === 422) {
        on422(petaBaris(res.error, lines));
      } else if (res.response.status === 401) {
        onGagal("Sesi berakhir, silakan masuk lagi");
      } else {
        onGagal(PESAN_JARINGAN);
      }
    } catch {
      onGagal(PESAN_JARINGAN);
    } finally {
      clearTimeout(timer);
      setMenyimpan(false);
    }
  }, [data, mode, nilai, tanggal, onSukses, onGagal, on422]);

  return { simpan, menyimpan };
}

/** Tanggal, mode, pencarian, isian, validasi lokal, dan ringkasan footer. */
export function useRekapTampilan() {
  const [tanggal, setTanggal] = useState(hariIniWib);
  const [mode, setMode] = useState<Mode>("quantity");
  const [cari, setCari] = useState("");
  const { data, nilai, setNilai, memuat, gagal, muat } = useRekap(
    tanggal,
    mode,
  );

  const lokal = useMemo(
    () => (data ? errorBaris(data, mode, nilai) : {}),
    [data, mode, nilai],
  );
  const angka = useMemo(
    () => ringkasan(data, mode, nilai),
    [data, mode, nilai],
  );
  const baris = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (data?.lines ?? []).filter((l) => l.name.toLowerCase().includes(q));
  }, [data, cari]);

  const ubah = useCallback(
    (id: string, n: number | undefined) => {
      setNilai((lama) => {
        const baru = { ...lama };
        if (n === undefined) delete baru[id];
        else baru[id] = n;
        return baru;
      });
    },
    [setNilai],
  );

  return {
    tanggal,
    setTanggal,
    mode,
    setMode,
    cari,
    setCari,
    data,
    nilai,
    memuat,
    gagal,
    muat,
    lokal,
    angka,
    baris,
    ubah,
  };
}

/** Toast, error dari server, dan aksi simpan. */
export function useRekapAksi(args: {
  tanggal: string;
  mode: Mode;
  data: SalesRecap | null;
  nilai: Nilai;
  muat: () => Promise<void>;
}) {
  const [toast, setToast] = useState("");
  const [errorKirim, setErrorKirim] = useState<Record<string, string>>({});

  const onSukses = useCallback(
    (hasil: SalesRecapResult) => {
      setToast(
        `Rekap tersimpan: ${hasil.totalSold} barang, ${rupiah(hasil.totalRevenue)}`,
      );
      setErrorKirim({});
      void args.muat();
    },
    [args],
  );
  const onGagal = useCallback((pesan: string) => setToast(pesan), []);
  const on422 = useCallback((peta: Record<string, string>) => {
    setErrorKirim(peta);
    setToast(`${Object.keys(peta).length} baris perlu dicek`);
  }, []);

  const { simpan, menyimpan } = useSimpanRekap({
    ...args,
    onSukses,
    onGagal,
    on422,
  });

  return { toast, setToast, errorKirim, simpan, menyimpan };
}

/** Perekat layar rekap. */
export function useRekapLayar() {
  const tampilan = useRekapTampilan();
  const aksi = useRekapAksi({
    tanggal: tampilan.tanggal,
    mode: tampilan.mode,
    data: tampilan.data,
    nilai: tampilan.nilai,
    muat: tampilan.muat,
  });
  const error = useMemo(
    () => ({ ...tampilan.lokal, ...aksi.errorKirim }),
    [tampilan.lokal, aksi.errorKirim],
  );

  return {
    ...tampilan,
    ...aksi,
    error,
    bisa: tampilan.angka.jumlah > 0 && Object.keys(error).length === 0,
  };
}

export type RekapLayar = ReturnType<typeof useRekapLayar>;
