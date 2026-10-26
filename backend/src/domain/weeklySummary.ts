import { shiftIsoDate } from "../../../database/src/demo/generator.ts";

/**
 * Ringkasan mingguan (SPEC §5.9) — disusun dari template, tanpa AI.
 * Minggu = Minggu–Sabtu; yang dipakai adalah minggu lengkap terakhir
 * sebelum hari ini.
 */
export interface WeekWindow {
  weekStart: string;
  weekEnd: string;
}

const rupiah = new Intl.NumberFormat("id-ID");

/** Minggu lengkap terakhir sebelum `today` (tanggal ISO, zona WIB). */
export function lastCompleteWeek(today: string): WeekWindow {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Minggu
  // Hari Sabtu sendiri belum minggu lengkap, jadi mundur tujuh hari.
  const backToSaturday = (dow + 1) % 7 || 7;
  const weekEnd = shiftIsoDate(today, -backToSaturday);
  return { weekStart: shiftIsoDate(weekEnd, -6), weekEnd };
}

/** Ringkasan hanya tampil pada hari Minggu dan Senin (WIB). */
export function shouldShowWeeklySummary(today: string): boolean {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 1;
}

export interface WeeklyFacts {
  salesTotal: number;
  productsSold: number;
  lockedStart: number;
  lockedEnd: number;
  /** Nama barang yang memburuk minggu ini, urut apa adanya dari pemanggil. */
  worsened: readonly string[];
  completedPlans: number;
  recovered: number;
}

function salesSentence(facts: WeeklyFacts): string {
  if (facts.salesTotal === 0 && facts.productsSold === 0) {
    return "Minggu lalu belum ada penjualan tercatat.";
  }
  const delta = facts.lockedEnd - facts.lockedStart;
  const arah = delta > 0 ? "naik" : delta < 0 ? "turun" : "tetap";
  return (
    `Minggu lalu terjual Rp${rupiah.format(facts.salesTotal)} dari ${facts.productsSold} barang. ` +
    `Uang terkunci ${arah} Rp${rupiah.format(Math.abs(delta))} menjadi Rp${rupiah.format(facts.lockedEnd)}.`
  );
}

function problemSentence(worsened: readonly string[]): string {
  if (worsened.length === 0)
    return "Tidak ada barang yang memburuk minggu ini.";
  const shown = worsened.slice(0, 3).join(", ");
  const rest = worsened.length > 3 ? ", dan lainnya" : "";
  return `${worsened.length} barang butuh perhatian: ${shown}${rest}.`;
}

function planSentence(facts: WeeklyFacts): string {
  if (facts.completedPlans === 0) {
    return "Belum ada rencana yang selesai — pilih satu barang di Beranda untuk mulai.";
  }
  return `${facts.completedPlans} rencana selesai, kas pulih Rp${rupiah.format(facts.recovered)} minggu ini.`;
}

export function buildWeeklySentences(
  facts: WeeklyFacts,
): [string, string, string] {
  return [
    salesSentence(facts),
    problemSentence(facts.worsened),
    planSentence(facts),
  ];
}
