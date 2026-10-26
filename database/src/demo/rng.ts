/**
 * PRNG ber-seed (mulberry32) — SPEC §10.2 mewajibkan data demo deterministik
 * sehingga template yang diregenerasi cron harian identik setiap kali.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bilangan bulat inklusif [min, max]. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("pick() dari himpunan kosong");
  return item;
}

/**
 * Bagi `total` menjadi bilangan bulat sebanding `weights` dengan metode
 * sisa-terbesar, supaya jumlahnya tetap persis `total`.
 */
export function distribute(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = total - floors.reduce((acc, v) => acc + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const result = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] = (result[i] ?? 0) + 1;
    remainder -= 1;
  }
  return result;
}
