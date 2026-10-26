import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type ProductSummary,
  type StockIn,
  type StockInBatchCreate,
} from "./api";
import { hapusOutbox, idOutbox, simpanOutbox } from "./outbox";
import { hariIniWib, rupiah } from "./ui";

/** Satu baris form nota. Angka disimpan sebagai teks supaya mudah diketik. */
export type BarisMasuk = {
  kunci: string;
  nama: string;
  productId: string | null;
  baru: boolean;
  qty: string;
  unitCost: string;
  sellPrice: string;
};

export type KoreksiMasuk = {
  qty?: number;
  unitCost?: number;
  receivedOn?: string;
};

const PESAN_JARINGAN = "Belum terkirim — isian tersimpan di HP ini";
const PESAN_SESI = "Sesi berakhir, silakan masuk lagi";
const PESAN_GANGGUAN = "Ada gangguan. Coba lagi sebentar.";

export function barisKosong(): BarisMasuk {
  return {
    kunci: crypto.randomUUID(),
    nama: "",
    productId: null,
    baru: false,
    qty: "",
    unitCost: "",
    sellPrice: "",
  };
}

/** "12.500" → 12500. Titik ribuan hanya tampilan (FSD §0.5). */
export function angkaDari(teks: string): number {
  return Number(teks.replace(/\D/g, ""));
}

/** 12500 → "12.500" saat diketik. */
export function ribuan(teks: string): string {
  const digit = teks.replace(/\D/g, "");
  return digit ? Number(digit).toLocaleString("id-ID") : "";
}

/** Kombobox butuh barang aktif urut `frequent` (FSD §8). */
export function useBarangAktif() {
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGagal(false);
    const { data, error } = await api.GET("/products", {
      params: { query: { sort: "frequent" } },
    });
    if (error || !data) {
      setItems([]);
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

export function useFormMasuk() {
  const [tanggal, setTanggal] = useState(hariIniWib);
  const [daftar, setDaftar] = useState<BarisMasuk[]>(() => [barisKosong()]);

  const ubah = useCallback((kunci: string, b: BarisMasuk) => {
    setDaftar((lama) => lama.map((x) => (x.kunci === kunci ? b : x)));
  }, []);
  const tambah = useCallback(() => setDaftar((l) => [...l, barisKosong()]), []);
  const buang = useCallback((kunci: string) => {
    setDaftar((l) =>
      l.length === 1 ? [barisKosong()] : l.filter((b) => b.kunci !== kunci),
    );
  }, []);
  const reset = useCallback(() => setDaftar([barisKosong()]), []);
  const isi = useCallback((baru: BarisMasuk[]) => {
    setDaftar(baru.length > 0 ? baru : [barisKosong()]);
  }, []);

  return { tanggal, setTanggal, daftar, ubah, tambah, buang, reset, isi };
}

const OPSI_BARU = /^\+ Tambah '(.*)' sebagai barang baru$/;

/** FSD §16 — pola `<nama> <qty> <harga>` per baris, tanpa AI dan tanpa API baru. */
const POLA_NOTA = /^\s*(.+?)\s+(\d+)\s+(?:Rp\.?\s*)?([\d.]+)\s*$/i;

/**
 * Baris yang tidak cocok polanya tetap dikembalikan (hanya nama terisi)
 * supaya tidak ada teks yang hilang — pengguna mengetik sisanya manual.
 */
export function parseNota(
  teks: string,
  produk: ProductSummary[],
): BarisMasuk[] {
  const hasil: BarisMasuk[] = [];

  for (const baris of teks.split(/\r?\n/)) {
    if (!baris.trim()) continue;
    const cocok = POLA_NOTA.exec(baris);
    if (!cocok) {
      hasil.push({ ...barisKosong(), nama: baris.trim() });
      continue;
    }

    const nama = (cocok[1] ?? "").trim();
    const p = produk.find((x) => x.name.toLowerCase() === nama.toLowerCase());
    hasil.push({
      ...barisKosong(),
      nama,
      productId: p?.id ?? null,
      qty: String(Number(cocok[2])),
      unitCost: String(angkaDari(cocok[3] ?? "0")),
    });
  }

  return hasil;
}

/** FSD §8 — pilih barang dari saran, atau opsi terakhir "Tambah ... sebagai barang baru". */
export function pilihBarang(
  b: BarisMasuk,
  teks: string,
  produk: ProductSummary[],
): BarisMasuk {
  const opsi = OPSI_BARU.exec(teks);
  if (opsi) return { ...b, nama: opsi[1] ?? "", productId: null, baru: true };

  const cocok = produk.find(
    (p) => p.name.toLowerCase() === teks.trim().toLowerCase(),
  );
  if (!cocok) return { ...b, nama: teks, productId: null, baru: false };

  const hargaKosong = !b.unitCost.trim() || b.productId === null;
  return {
    ...b,
    nama: cocok.name,
    productId: cocok.id,
    baru: false,
    unitCost: hargaKosong ? String(cocok.lastCost) : b.unitCost,
  };
}

/** FSD §8 — "terakhir Rp{lastCost}", plus info bila beda > 20%. */
export function bantuHarga(b: BarisMasuk, produk: ProductSummary[]): string {
  const p = produk.find((x) => x.id === b.productId);
  if (!p) return "";
  const dasar = `terakhir ${rupiah(p.lastCost)}`;
  if (!p.lastCost || !b.unitCost.trim()) return dasar;

  const persen = Math.round(
    ((angkaDari(b.unitCost) - p.lastCost) / p.lastCost) * 100,
  );
  if (Math.abs(persen) <= 20) return dasar;
  const arah = persen > 0 ? "naik" : "turun";
  return `${dasar} · Harga ${arah} ${Math.abs(persen)}% dari terakhir`;
}

/** Baris yang sepenuhnya kosong diabaikan (FSD §8). */
export function kosongTotal(b: BarisMasuk): boolean {
  return ![b.nama, b.qty, b.unitCost, b.sellPrice].some((t) => t.trim());
}

/** FSD §8 — semua field baris wajib. Server tetap otoritas. */
export function cekBaris(b: BarisMasuk): string | null {
  if (!b.nama.trim()) return "Nama barang wajib diisi";
  if (!b.baru && !b.productId) return "Pilih barang dari daftar";
  if (!b.qty.trim() || angkaDari(b.qty) < 1) return "Jumlah minimal 1";
  if (!b.unitCost.trim()) return "Harga beli wajib diisi";
  if (b.baru && !b.sellPrice.trim()) return "Harga jual wajib diisi";
  return null;
}

export function errorBaris(daftar: BarisMasuk[]): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const b of daftar) {
    if (kosongTotal(b)) continue;
    const pesan = cekBaris(b);
    if (pesan) hasil[b.kunci] = pesan;
  }
  return hasil;
}

export function payloadMasuk(
  tanggal: string,
  daftar: BarisMasuk[],
): StockInBatchCreate | null {
  const isi = daftar.filter((b) => !kosongTotal(b));
  if (isi.length === 0) return null;

  return {
    receivedOn: tanggal,
    lines: isi.map((b) =>
      b.baru
        ? {
            newProduct: {
              name: b.nama.trim(),
              unit: "pcs",
              sellPrice: angkaDari(b.sellPrice),
            },
            qty: angkaDari(b.qty),
            unitCost: angkaDari(b.unitCost),
          }
        : {
            productId: b.productId ?? "",
            qty: angkaDari(b.qty),
            unitCost: angkaDari(b.unitCost),
          },
    ),
  };
}

export function ringkasanMasuk(daftar: BarisMasuk[]) {
  let baris = 0;
  let total = 0;
  for (const b of daftar) {
    if (kosongTotal(b)) continue;
    baris += 1;
    total += angkaDari(b.qty) * angkaDari(b.unitCost);
  }
  return { baris, total };
}

/** error.lines[].index mengacu ke baris yang dikirim (baris kosong sudah dibuang). */
function petaBaris(
  error: unknown,
  daftar: BarisMasuk[],
): Record<string, string> {
  const isi = daftar.filter((b) => !kosongTotal(b));
  const daftarError =
    (
      error as
        { error?: { lines?: { index: number; message: string }[] } } | undefined
    )?.error?.lines ?? [];
  const hasil: Record<string, string> = {};
  for (const e of daftarError) {
    const baris = isi[e.index];
    if (baris) hasil[baris.kunci] = e.message;
  }
  return hasil;
}

type SimpanArgs = {
  tanggal: string;
  daftar: BarisMasuk[];
  onSukses: (jumlah: number) => void;
  onGagal: (pesan: string) => void;
  on422: (pesanPerBaris: Record<string, string>) => void;
};

/** FSD §0.4 — simpan lewat outbox IndexedDB; Idempotency-Key = id outbox. */
export function useSimpanMasuk({
  tanggal,
  daftar,
  onSukses,
  onGagal,
  on422,
}: SimpanArgs) {
  const [menyimpan, setMenyimpan] = useState(false);

  const simpan = useCallback(async () => {
    const body = payloadMasuk(tanggal, daftar);
    if (!body) return;

    const id = idOutbox();
    await simpanOutbox({
      id,
      kind: "stockin",
      tanggal,
      baris: body.lines.length,
      status: "pending",
      payload: body,
      dibuat: new Date().toISOString(),
    });

    setMenyimpan(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await api.POST("/stock-ins", {
        body,
        params: { header: { "Idempotency-Key": id } },
        signal: ctrl.signal,
      });
      if (res.response.ok) {
        await hapusOutbox(id);
        onSukses(body.lines.length);
      } else if (res.response.status === 422) {
        on422(petaBaris(res.error, daftar));
      } else if (res.response.status === 401) {
        onGagal(PESAN_SESI);
      } else if (res.response.status === 409) {
        // Kunci yang sama sudah diproses server — anggap selesai, jangan kirim ganda.
        await hapusOutbox(id);
        onSukses(body.lines.length);
      } else {
        onGagal(PESAN_JARINGAN);
      }
    } catch {
      onGagal(PESAN_JARINGAN);
    } finally {
      clearTimeout(timer);
      setMenyimpan(false);
    }
  }, [tanggal, daftar, onSukses, onGagal, on422]);

  return { simpan, menyimpan };
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

/** Perekat layar barang masuk. */
export function useLayarMasuk() {
  const produk = useBarangAktif();
  const riwayat = useRiwayatMasuk();
  const form = useFormMasuk();
  const [toast, setToast] = useState("");
  const [errorKirim, setErrorKirim] = useState<Record<string, string>>({});

  const { reset } = form;
  const { muat: muatRiwayat } = riwayat;

  const onSukses = useCallback(
    (jumlah: number) => {
      setToast(`Barang masuk tersimpan (${jumlah} baris)`);
      setErrorKirim({});
      reset();
      void muatRiwayat();
    },
    [reset, muatRiwayat],
  );
  const onGagal = useCallback((pesan: string) => setToast(pesan), []);
  const on422 = useCallback((peta: Record<string, string>) => {
    setErrorKirim(peta);
    setToast(`${Object.keys(peta).length} baris perlu dicek`);
  }, []);

  const { simpan, menyimpan } = useSimpanMasuk({
    tanggal: form.tanggal,
    daftar: form.daftar,
    onSukses,
    onGagal,
    on422,
  });
  const aksi = useAksiRiwayat(muatRiwayat);

  const lokal = useMemo(() => errorBaris(form.daftar), [form.daftar]);
  const error = useMemo(
    () => ({ ...lokal, ...errorKirim }),
    [lokal, errorKirim],
  );
  const angka = useMemo(() => ringkasanMasuk(form.daftar), [form.daftar]);

  return {
    produk,
    riwayat,
    form,
    aksi,
    toast,
    setToast,
    error,
    angka,
    simpan,
    menyimpan,
    bisa: angka.baris > 0 && Object.keys(error).length === 0 && !menyimpan,
  };
}

export type LayarMasuk = ReturnType<typeof useLayarMasuk>;
