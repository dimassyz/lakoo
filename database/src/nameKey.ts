/**
 * `name_key` = lower + trim + spasi tunggal (SPEC §4.1).
 * Dipakai bersama oleh seed demo, API produk, dan import — jangan diubah
 * tanpa memikirkan ketiganya.
 * Karakter format tak terlihat (kelas Unicode Cf: U+200B–U+200D, U+FEFF,
 * U+2060, dst.) dibuang lebih dulu: tanpa itu dua nama yang tampak identik
 * di daftar bisa lolos cek unik (QA-9 F4).
 */
export function nameKeyOf(name: string): string {
  return name
    .replace(/\p{Cf}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
