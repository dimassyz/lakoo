/**
 * Substitusi placeholder teks bagikan (SPEC §5.5 butir 6).
 *
 * `shareCopy` dari template/AI hanya boleh berisi placeholder; nilai nyatanya
 * baru ada di baris `plan_steps` (harga point-in-time) + nama toko/barang.
 * Substitusi dilakukan SAAT BACA di serializer rencana, bukan saat simpan:
 * baris lama yang sudah tersimpan berisi template mentah ikut terperbaiki
 * tanpa migrasi, dan tanggal berlaku otomatis menjadi tanggal nyata begitu
 * tahap berjalan (`dueOn` terisi) — kontrak "shareText diisi ulang dengan
 * tanggal berlaku nyata" terpenuhi tanpa menulis ulang teks.
 */

const rupiahFormat = new Intl.NumberFormat("id-ID");

/** Uang integer Rupiah: "Rp27.500" (AGENTS.md, Intl id-ID). */
export function formatRupiah(value: number): string {
  return `Rp${rupiahFormat.format(value)}`;
}

/** "2026-11-15" → "15 November 2026" (tanggal panjang id-ID, acuan WIB). */
export function formatTanggalPanjang(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

export interface ShareTextValues {
  storeName: string;
  productName: string;
  /** Harga jual saat rencana dibuat (kolom `old_price` tahap). */
  oldPrice: number;
  /** Harga tahap hasil derivasi (kolom `new_price` tahap). */
  newPrice: number;
  bundlePrice: number | null;
  bundleProductName: string | null;
  bundleProductSellPrice: number | null;
  /** Tanggal berakhir tahap yang sudah diformat, mis. "15 November 2026". */
  dueText: string;
}

/**
 * Isi semua placeholder yang diizinkan dengan nilai nyata. Placeholder yang
 * datanya memang tidak ada untuk tahap ini (paket di tahap non-bundle)
 * diganti string kosong lalu spasi/tanda baca yang menggantung dirapikan,
 * jadi konsumen API tidak pernah melihat kurung kurawal mentah.
 */
export function substituteShareText(
  template: string,
  values: ShareTextValues,
): string {
  // Hemat paket = harga normal kedua barang − harga paket (SPEC §5.4).
  const hemat =
    values.bundlePrice !== null && values.bundleProductSellPrice !== null
      ? values.oldPrice + values.bundleProductSellPrice - values.bundlePrice
      : null;

  const replacements: Record<string, string> = {
    nama_toko: values.storeName,
    nama_barang: values.productName,
    harga_lama: formatRupiah(values.oldPrice),
    harga_baru: formatRupiah(values.newPrice),
    harga_paket:
      values.bundlePrice === null ? "" : formatRupiah(values.bundlePrice),
    nama_paket: values.bundleProductName ?? "",
    hemat: hemat === null ? "" : formatRupiah(hemat),
    berlaku_sampai: values.dueText,
  };

  return template
    .replace(/\{([a-z_]+)\}/g, (_raw, name: string) => replacements[name] ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?:;])/g, "$1")
    .trim();
}
