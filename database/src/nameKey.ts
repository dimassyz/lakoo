/**
 * `name_key` = lower + trim + spasi tunggal (SPEC §4.1).
 * Dipakai bersama oleh seed demo, API produk, dan import — jangan diubah
 * tanpa memikirkan ketiganya.
 */
export function nameKeyOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
