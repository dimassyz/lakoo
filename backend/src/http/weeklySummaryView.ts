import type { AnyDb } from "../../../database/src/db.ts";
import { shiftIsoDate } from "../../../database/src/demo/generator.ts";
import {
  buildWeeklySentences,
  lastCompleteWeek,
} from "../domain/weeklySummary.ts";
import { loadProductSummaries } from "./productView.ts";
import {
  completedPlansInWeek,
  findWeeklySummary,
  recoveredInWeek,
  saveWeeklySummary,
  weeklySales,
} from "../repo/dashboard.ts";

export interface WeeklySummaryView {
  weekStart: string;
  weekEnd: string;
  sentences: string[];
}

const PROBLEM = new Set(["waspada", "sekarat", "mati"]);

const sumLocked = (items: { lockedValue: number }[]): number =>
  items.reduce((sum, item) => sum + item.lockedValue, 0);

/**
 * Ringkasan minggu lengkap terakhir, dibuat malas bila belum ada (SPEC §5.9).
 * Tanpa gerbang tampil — pemanggil yang memutuskan kapan menampilkannya.
 */
export async function loadWeeklySummary(
  db: AnyDb,
  storeId: string,
  today: string,
): Promise<WeeklySummaryView> {
  const { weekStart, weekEnd } = lastCompleteWeek(today);

  const saved = await findWeeklySummary(db, storeId, weekStart);
  if (saved !== undefined) {
    return { weekStart, weekEnd, sentences: saved.sentences };
  }

  const sales = await weeklySales(db, storeId, weekStart, weekEnd);
  const atEnd = await loadProductSummaries(db, storeId, weekEnd);
  const atStart = await loadProductSummaries(
    db,
    storeId,
    shiftIsoDate(weekStart, -1),
  );
  const startStatus = new Map(atStart.map((item) => [item.id, item.status]));

  // "Memburuk" = bermasalah di akhir minggu DAN statusnya berbeda dari awal minggu.
  const worsened = atEnd
    .filter((item) => {
      if (!PROBLEM.has(item.status) || item.isComplementary) return false;
      return startStatus.get(item.id) !== item.status;
    })
    .map((item) => item.name);

  const sentences = buildWeeklySentences({
    salesTotal: sales.salesTotal,
    productsSold: sales.productsSold,
    lockedStart: sumLocked(atStart),
    lockedEnd: sumLocked(atEnd),
    worsened,
    completedPlans: await completedPlansInWeek(db, storeId, weekStart, weekEnd),
    recovered: await recoveredInWeek(db, storeId, weekStart, weekEnd),
  });
  await saveWeeklySummary(db, storeId, weekStart, sentences);
  return { weekStart, weekEnd, sentences };
}
