/**
 * Affordance v6 (arahan PO) — SATU sumber kelas interaksi untuk chrome +
 * Beranda: harus jelas mana tombol dan mana teks biasa. Setiap elemen
 * interaktif: cursor-pointer, transisi 150ms, state hover yang terdefinisi,
 * tekan :active turun 1px, ring fokus-visible ink 2px offset 2px, dan
 * disabled pudar + cursor-not-allowed tanpa efek hover. Elemen statis
 * TIDAK memakai kelas ini — kontras itulah penandanya.
 *
 * Kelas ditulis sebagai string utuh (bukan disusun dinamis per varian):
 * Tailwind v4 memindai sumber, jadi nama utility harus literal.
 */

/** Dasar semua elemen interaktif: kursor, transisi, tekan, fokus, disabled. */
export const dasarInteraktif =
  "cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-55";

/** Tombol utama v6 — isi marigold, teks ink; hover marigold-hover + bayangan. */
export const tombolUtama = `${dasarInteraktif} bg-marigold font-semibold text-navy hover:bg-marigold-hover hover:shadow-card disabled:hover:bg-marigold disabled:hover:shadow-none`;

/** Tombol outline — hover terisi ink, teks putih. */
export const tombolGaris = `${dasarInteraktif} border border-navy font-semibold text-navy hover:bg-navy hover:text-white disabled:hover:bg-transparent disabled:hover:text-navy`;

/** Tombol ghost — border garis; hover border slate + teks ink. */
export const tombolHantu = `${dasarInteraktif} border border-muted font-semibold text-slate hover:border-slate hover:text-navy disabled:hover:border-muted disabled:hover:text-slate`;

/** Tautan teks — garis bawah tetap tampil; hover marigold-kuat + lebih tebal. */
export const tautanTeks =
  "cursor-pointer underline transition-colors duration-150 hover:text-marigold-kuat hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

/** Input — fokus: border marigold-kuat + ring marigold 25%. */
export const kelasInput =
  "transition-[border-color,box-shadow] duration-150 focus:border-marigold-kuat focus:ring-4 focus:ring-marigold/25 focus:outline-none";
