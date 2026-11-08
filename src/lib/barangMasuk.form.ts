import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ProductSummary, type StockInBatchCreate } from "./api";
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

/** Janji yang selalu bisa ditepati: percobaan kirim ulang, bukan pengiriman. */
export const PESAN_JARINGAN = "Belum terkirim — akan dicoba lagi otomatis";
export const PESAN_SESI = "Sesi berakhir, silakan masuk lagi";
export const PESAN_GANGGUAN = "Ada gangguan. Coba lagi sebentar.";

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

/** "18.500,00" → 18500 — koma adalah desimal, titik adalah ribuan (FSD §0.5). */
export function hargaNota(token: string): number {
  const bersih = token.replace(/rp\.?/gi, "").trim();
  const [utuh] = bersih.split(",");
  return angkaDari(utuh ?? bersih);
}

const HARGA = String.raw`[\d]+(?:[.,]\d+)*`;

/** FSD §16 + format WA — pola depan: "10x Nama @1.500", "10 x Nama @1.500 = 15.000". */
const POLA_DEPAN_HARGA = new RegExp(
  String.raw`^(\d+)\s*[x×]\s+(.+?)\s*@\s*(?:rp\.?\s*)?(${HARGA})(?:\s*=\s*(?:rp\.?\s*)?${HARGA})?$`,
  "i",
);

/** Pola depan tanpa @: "10 x Nama 1500". */
const POLA_DEPAN = new RegExp(
  String.raw`^(\d+)\s*[x×]\s+(.+?)\s+(?:rp\.?\s*)?(${HARGA})$`,
  "i",
);

/** Pola belakang: "Nama 10 6.200", "Nama 10 x 1500", "Nama x10 @1.500". */
const POLA_BELAKANG = new RegExp(
  String.raw`^(.+?)\s+(?:[x×]\s*)?(\d+)\s*(?:[x×]\s*|@\s*)?(?:rp\.?\s*)?(${HARGA})$`,
  "i",
);

/** Awalan daftar pada tempelan WA: "- ", "• ", "1. ", "2) ". */
const POLA_AWALAN = /^(?:[-•*]\s+|\d{1,3}\s*[.)]\s+)/;

/**
 * Baris non-barang pada tempelan WA dilewati, bukan jadi baris sampah:
 * judul diakhiri ":" ("Belanja hari ini:"), baris total, dan baris tanpa
 * huruf sama sekali (sisa angka total dsb.).
 */
function barisLewati(teks: string): boolean {
  if (!/[a-z]/i.test(teks)) return true;
  if (/^(grand\s+)?(sub\s*)?total\b/i.test(teks)) return true;
  return teks.endsWith(":");
}

/** Grup tangkapan (nama, qty, harga) → baris form; urutan grup per pola. */
function barisTerbaca(
  cocok: RegExpExecArray,
  iNama: number,
  iQty: number,
  iHarga: number,
  produk: ProductSummary[],
): BarisMasuk {
  const nama = (cocok[iNama] ?? "").trim();
  const p = produk.find((x) => x.name.toLowerCase() === nama.toLowerCase());
  return {
    ...barisKosong(),
    nama,
    productId: p?.id ?? null,
    qty: String(Number(cocok[iQty] ?? "")),
    unitCost: String(hargaNota(cocok[iHarga] ?? "0")),
  };
}

/** Satu baris tempelan → satu baris form; null bila baris non-barang. */
function bacaBarisNota(
  baris: string,
  produk: ProductSummary[],
): BarisMasuk | null {
  if (!baris || barisLewati(baris)) return null;

  const depan = POLA_DEPAN_HARGA.exec(baris) ?? POLA_DEPAN.exec(baris);
  if (depan) return barisTerbaca(depan, 2, 1, 3, produk);

  const belakang = POLA_BELAKANG.exec(baris);
  if (belakang) return barisTerbaca(belakang, 1, 2, 3, produk);

  return { ...barisKosong(), nama: baris };
}

/**
 * FSD §16 — per baris: `<nama> <qty> <harga>` plus format WhatsApp umum
 * (qty di depan, pemisah "x", harga "@…", awalan daftar). Baris yang tidak
 * cocok polanya tetap dikembalikan (hanya nama terisi) supaya tidak ada
 * teks yang hilang — pengguna mengetik sisanya manual.
 */
export function parseNota(
  teks: string,
  produk: ProductSummary[],
): BarisMasuk[] {
  const hasil: BarisMasuk[] = [];

  for (const mentah of teks.split(/\r?\n/)) {
    const baris = mentah.trim().replace(POLA_AWALAN, "").trim();
    const terbaca = bacaBarisNota(baris, produk);
    if (terbaca) hasil.push(terbaca);
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

/** FSD §0.4 — pulihkan isian nota yang tertahan di antrean ke form. */
export function barisDariPayload(
  payload: StockInBatchCreate,
  produk: ProductSummary[],
): BarisMasuk[] {
  return payload.lines.map((l, i) => {
    const p = produk.find((x) => x.id === l.productId);
    return {
      kunci: `antrean-${i}`,
      nama: p?.name ?? l.newProduct?.name ?? "",
      productId: l.productId ?? null,
      baru: !l.productId,
      qty: String(l.qty),
      unitCost: String(l.unitCost),
      sellPrice: l.newProduct ? String(l.newProduct.sellPrice) : "",
    };
  });
}

/**
 * Kunci sinkron anti-aktivasi-ganda. `ambil()` berhasil hanya untuk
 * pemanggil pertama sampai `lepas()` dipanggil. Berbeda dengan state React
 * (yang baru terlihat setelah render), kunci ini efektif seketika — bahkan
 * untuk dua aktivasi pada frame yang sama, sebelum await apa pun.
 */
export function buatKunciSinkron() {
  let terkunci = false;
  return {
    ambil(): boolean {
      if (terkunci) return false;
      terkunci = true;
      return true;
    },
    lepas(): void {
      terkunci = false;
    },
  };
}

/** Kirim satu nota yang sudah tersimpan di outbox; petakan hasil ke callback. */
async function kirimMasuk(
  body: StockInBatchCreate,
  id: string,
  daftar: BarisMasuk[],
  cb: Omit<SimpanArgs, "tanggal" | "daftar">,
): Promise<void> {
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
      cb.onSukses(body.lines.length);
    } else if (res.response.status === 422) {
      cb.on422(petaBaris(res.error, daftar));
    } else if (res.response.status === 401) {
      cb.onGagal(PESAN_SESI);
    } else if (res.response.status === 409) {
      // Kunci yang sama sudah diproses server — anggap selesai, jangan kirim ganda.
      await hapusOutbox(id);
      cb.onSukses(body.lines.length);
    } else {
      cb.onGagal(PESAN_JARINGAN);
    }
  } catch {
    cb.onGagal(PESAN_JARINGAN);
  } finally {
    clearTimeout(timer);
  }
}

/** FSD §0.4 — simpan lewat outbox IndexedDB; Idempotency-Key = id outbox. */
export function useSimpanMasuk({
  tanggal,
  daftar,
  onSukses,
  onGagal,
  on422,
}: SimpanArgs) {
  const [menyimpan, setMenyimpan] = useState(false);
  const kunci = useRef(buatKunciSinkron());

  const simpan = useCallback(async () => {
    // Kunci diambil sinkron SEBELUM await pertama (QA-3): dulu flag
    // `menyimpan` baru naik setelah `await simpanOutbox(...)`, jadi klik
    // kedua lolos dan membuat item outbox + Idempotency-Key kedua —
    // stok tercatat dua kali.
    if (!kunci.current.ambil()) return;
    setMenyimpan(true);
    try {
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
      await kirimMasuk(body, id, daftar, { onSukses, onGagal, on422 });
    } finally {
      kunci.current.lepas();
      setMenyimpan(false);
    }
  }, [tanggal, daftar, onSukses, onGagal, on422]);

  return { simpan, menyimpan };
}
