import type { CustomerType, Store, StoreType } from "./api";

/** FSD §15 — ambang bawaan; `resetThresholds` di server memakai angka yang sama. */
export const BAWAAN = { healthyDays: 14, deadDays: 45, warningWeeks: 3 };

export const JENIS: { nilai: StoreType; label: string }[] = [
  { nilai: "warung_kelontong", label: "Warung kelontong" },
  { nilai: "toko_kelontong", label: "Toko kelontong" },
  { nilai: "minimarket_kecil", label: "Minimarket kecil" },
  { nilai: "warung_sembako", label: "Warung sembako" },
  { nilai: "lainnya", label: "Lainnya" },
];

export const PELANGGAN: { nilai: CustomerType; label: string }[] = [
  { nilai: "warga_perumahan", label: "Warga perumahan" },
  { nilai: "anak_sekolah", label: "Anak sekolah" },
  { nilai: "pekerja_pabrik_kantor", label: "Pekerja pabrik/kantor" },
  { nilai: "pedagang_lain", label: "Pedagang lain" },
  { nilai: "pengendara_lewat", label: "Pengendara lewat" },
  { nilai: "kos_mahasiswa", label: "Kos/mahasiswa" },
];

export type Isian = {
  nama: string;
  jenis: StoreType | "";
  lokasi: string;
  pelanggan: CustomerType[];
  sehat: string;
  mati: string;
  waspada: string;
  ai: boolean;
};

export type Galat = Partial<Record<keyof Isian | "umum", string>>;

export function dariStore(store: Store): Isian {
  return {
    nama: store.name,
    jenis: store.storeType ?? "",
    lokasi: store.location ?? "",
    pelanggan: store.customerTypes,
    sehat: String(store.healthyDays),
    mati: String(store.deadDays),
    waspada: String(store.warningWeeks),
    ai: store.aiEnabled,
  };
}

/** Angka dari input teks; kosong/NaN = null supaya pesan batas yang tampil. */
function angka(nilai: string): number | null {
  const n = Number(nilai.trim());
  return nilai.trim() === "" || Number.isNaN(n) ? null : n;
}

/** Satu aturan batas: kosong atau di luar rentang = tidak sah. */
function diLuar(nilai: number | null, min: number, maks: number): boolean {
  return nilai === null || nilai < min || nilai > maks;
}

/** FSD §15 — batas 7–60 / 15–180 / Sehat < Mati / 2–6, pesan langsung di field. */
export function periksaAturan(isi: Isian): Galat {
  const galat: Galat = {};
  const nama = isi.nama.trim();
  if (nama.length < 1 || nama.length > 60) galat.nama = "1–60 karakter";

  const sehat = angka(isi.sehat);
  const mati = angka(isi.mati);
  const waspada = angka(isi.waspada);

  if (diLuar(sehat, 7, 60)) galat.sehat = "Isi 7–60 hari";
  if (diLuar(mati, 15, 180)) galat.mati = "Isi 15–180 hari";
  else if (mati !== null && sehat !== null && sehat >= mati)
    galat.mati = "Harus lebih besar dari batas Sehat";
  if (diLuar(waspada, 2, 6)) galat.waspada = "Isi 2–6 minggu";

  return galat;
}

export function adaGalat(galat: Galat): boolean {
  return Object.keys(galat).length > 0;
}

/** `error.fields` dari server → kunci isian di layar ini. */
const PETA_FIELD: Record<string, keyof Isian> = {
  name: "nama",
  healthyDays: "sehat",
  deadDays: "mati",
  warningWeeks: "waspada",
  aiEnabled: "ai",
  customerTypes: "pelanggan",
  storeType: "jenis",
  location: "lokasi",
};

const PESAN_STATUS: Record<number, string> = {
  401: "Sesi berakhir, silakan masuk lagi",
  403: "Akun demo tidak bisa mengubah pengaturan",
  429: "Terlalu banyak percobaan. Coba lagi sebentar.",
};

/** `error.fields` → kunci isian; null bila tidak ada yang bisa dipetakan. */
function dariFields(fields: Record<string, string>): Galat | null {
  const galat: Galat = {};
  for (const [kunci, pesan] of Object.entries(fields)) {
    const tujuan = PETA_FIELD[kunci];
    if (tujuan) galat[tujuan] = pesan;
  }
  return adaGalat(galat) ? galat : null;
}

export function galatDariServer(status: number, error: unknown): Galat {
  const isi = (
    error as { error?: { message?: string; fields?: Record<string, string> } }
  )?.error;

  if (status === 400 && isi?.fields) {
    const galat = dariFields(isi.fields);
    if (galat) return galat;
  }

  const tetap = PESAN_STATUS[status];
  if (tetap) return { umum: tetap };
  return { umum: isi?.message ?? "Gagal menyimpan. Coba lagi sebentar." };
}
