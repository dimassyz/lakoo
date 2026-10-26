import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  DEMO_SEED,
  generateDemo,
  todayWib,
} from "../../../../database/src/demo/generator.ts";
import { seedDemoTemplate } from "../../../../database/src/demo/seed.ts";
import { stores } from "../../../../database/src/schema.ts";
import { unauthenticated } from "../errors.ts";
import { loadProducts } from "../productView.ts";
import { cleanupTables, deleteExpiredClones } from "../../repo/cron.ts";
import { bundleCandidatesOf, composeAndSave } from "./plans.ts";
import { todayIso } from "./products.ts";
import type { ProductSummary } from "../serialize.ts";

export interface CronDeps {
  db: AnyDb;
  now: () => Date;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

/** SPEC §10.1: warm ≤ 20 barang bermasalah teratas, konkurensi 8. */
const WARM_LIMIT = 20;
const WARM_CONCURRENCY = 8;
const PROBLEM = new Set(["waspada", "sekarat", "mati"]);

export interface CronResult {
  demoTemplateRegenerated: boolean;
  plansWarmed: number;
  aiPlansWarmed: number;
  demoClonesDeleted: number;
  durationMs: number;
}

/** Perbandingan waktu-konstan: panjang berbeda langsung ditolak tanpa bocor isinya. */
function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireCronBearer(c: Context, deps: CronDeps): void {
  const secret = deps.env?.CRON_SECRET ?? "";
  const header = c.req.header("authorization") ?? "";
  // Secret kosong = cron tidak bisa dipanggil sama sekali; jangan pernah
  // menerima "Bearer " kosong sebagai sah.
  if (secret === "" || !sameSecret(header, `Bearer ${secret}`))
    throw unauthenticated();
}

function problemProductsOf(items: ProductSummary[]): ProductSummary[] {
  return items
    .filter((item) => PROBLEM.has(item.status) && !item.isComplementary)
    .sort(
      (a, b) =>
        (b.priorityScore ?? 0) - (a.priorityScore ?? 0) ||
        b.lockedValue - a.lockedValue,
    )
    .slice(0, WARM_LIMIT);
}

async function warmOne(
  deps: CronDeps,
  store: typeof stores.$inferSelect,
  summary: ProductSummary,
  summaries: ProductSummary[],
  weekQty: readonly number[],
  today: string,
): Promise<boolean> {
  try {
    const plan = await composeAndSave(
      { db: deps.db, now: deps.now, env: deps.env, fetchImpl: deps.fetchImpl },
      {
        store,
        productId: summary.id,
        summary,
        summaries,
        candidates: bundleCandidatesOf(summaries, summary.id),
        weekQty,
        today,
      },
    );
    return plan.source === "ai";
  } catch {
    // Gagal menyusun rencana tidak boleh menggagalkan cron; template tetap ada.
    return false;
  }
}

async function warmPlans(
  deps: CronDeps,
  store: typeof stores.$inferSelect,
  today: string,
): Promise<{ plansWarmed: number; aiPlansWarmed: number }> {
  const { stats, items: summaries } = await loadProducts(
    deps.db,
    store.id,
    today,
  );
  const weekQtyOf = (productId: string): number[] =>
    stats.find((stat) => stat.productId === productId)?.weekQty ?? [];
  const targets = problemProductsOf(summaries);
  let aiPlansWarmed = 0;
  let plansWarmed = 0;

  for (let index = 0; index < targets.length; index += WARM_CONCURRENCY) {
    const batch = targets.slice(index, index + WARM_CONCURRENCY);
    const results = await Promise.all(
      batch.map((summary) =>
        warmOne(deps, store, summary, summaries, weekQtyOf(summary.id), today),
      ),
    );
    plansWarmed += results.length;
    aiPlansWarmed += results.filter(Boolean).length;
  }
  return { plansWarmed, aiPlansWarmed };
}

async function handleDaily(c: Context, deps: CronDeps) {
  requireCronBearer(c, deps);
  const started = Date.now();
  const now = deps.now();
  const today = todayIso(now);

  // 1. Regenerasi toko template demo (SPEC §10.1 langkah 1).
  const seeded = await seedDemoTemplate(
    deps.db as never,
    generateDemo(todayWib(now), DEMO_SEED),
  );

  // 2. Warm rencana AI untuk barang bermasalah di template (langkah 2).
  const template = (
    await deps.db
      .select()
      .from(stores)
      .where(eq(stores.id, seeded.storeId))
      .limit(1)
  )[0];
  const warmed =
    template === undefined
      ? { plansWarmed: 0, aiPlansWarmed: 0 }
      : await warmPlans(deps, template, today);

  // 3. Hapus klon demo kedaluwarsa (langkah 3).
  const demoClonesDeleted = await deleteExpiredClones(deps.db, now);

  // 4. Bersihkan tabel operasional (langkah 4).
  await cleanupTables(deps.db, now);

  const result: CronResult = {
    demoTemplateRegenerated: true,
    plansWarmed: warmed.plansWarmed,
    aiPlansWarmed: warmed.aiPlansWarmed,
    demoClonesDeleted,
    durationMs: Date.now() - started,
  };
  return c.json(result);
}

export function cronRoutes(deps: CronDeps) {
  const app = new Hono();
  app.get("/cron/daily", (c) => handleDaily(c, deps));
  return app;
}
