/**
 * Kas pulih (SPEC §5.7, BR-12). Angka `recovered` dihitung dari
 * `daily_sales.qty × unit_price` di rentang rencana; di sini hanya
 * persentasenya yang dihitung supaya bisa diuji tanpa DB.
 */
export function recoveredPercent(
  recovered: number,
  lockedValueAtStart: number,
): number {
  if (lockedValueAtStart <= 0) return 0;
  return Math.min(100, Math.round((100 * recovered) / lockedValueAtStart));
}
