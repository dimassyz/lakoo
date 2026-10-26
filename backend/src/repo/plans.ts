import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import {
  actionPlans,
  planSteps,
  products,
} from "../../../database/src/schema.ts";
import { ApiError } from "../http/errors.ts";
import type { PlanDraft, PlanStepDraft } from "../domain/planValidation.ts";
import { deriveStep } from "../domain/pricing.ts";
import { recoveredPercent } from "../domain/recovery.ts";

export interface PlanStepOut {
  stepNo: number;
  actionType: string;
  title: string;
  instructions: string;
  successCriteria: string;
  durationDays: number;
  discountPercent: number | null;
  bundleProductId: string | null;
  belowCostPercent: number | null;
  newPrice: number;
  profitPerUnit: number;
  cashBackEstimate: number;
  isLoss: boolean;
  shareText: string | null;
  outcome: string;
  startedOn: string | null;
  dueOn: string | null;
  endedOn: string | null;
}

export interface PlanOut {
  id: string;
  productId: string;
  productName: string;
  source: string;
  state: string;
  statusAtGeneration: string;
  rationale: string;
  generatedAt: string;
  startedOn: string | null;
  endedOn: string | null;
  lockedValueAtStart: number | null;
  currentStep: number | null;
  recovered: number;
  recoveredPercent: number;
  steps: PlanStepOut[];
}

export type PlanRow = typeof actionPlans.$inferSelect;
type PlanStateValue = PlanRow["state"];
const asStates = (states: readonly string[]): PlanStateValue[] =>
  states as PlanStateValue[];
export type StepRow = typeof planSteps.$inferSelect;

const isoDate = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value).slice(0, 10);

const num = (value: unknown): number =>
  value === null || value === undefined ? 0 : Number(value);

/** Kas pulih = Σ `cash_back_estimate` tahap yang berhasil (SPEC §5.7). */
function serialize(
  plan: PlanRow,
  steps: StepRow[],
  productName: string,
  recovered: number,
): PlanOut {
  const ordered = [...steps].sort((a, b) => a.stepNo - b.stepNo);

  return {
    id: plan.id,
    productId: plan.productId,
    productName,
    source: plan.source,
    state: plan.state,
    statusAtGeneration: plan.productStatusAtGeneration,
    rationale: plan.rationale,
    generatedAt: new Date(plan.generatedAt).toISOString(),
    startedOn: isoDate(plan.startedOn),
    endedOn: isoDate(plan.endedOn),
    lockedValueAtStart: plan.lockedValueAtStart ?? null,
    currentStep: plan.currentStep ?? null,
    recovered,
    recoveredPercent: recoveredPercent(recovered, plan.lockedValueAtStart ?? 0),
    steps: ordered.map((step) => ({
      stepNo: step.stepNo,
      actionType: step.actionType,
      title: step.title,
      instructions: step.instructions,
      successCriteria: step.successCriteria,
      durationDays: step.durationDays,
      discountPercent: step.discountPercent ?? null,
      bundleProductId: step.bundleProductId ?? null,
      belowCostPercent: step.belowCostPercent ?? null,
      newPrice: step.newPrice,
      profitPerUnit: step.profitPerUnit,
      cashBackEstimate: step.cashBackEstimate,
      isLoss: step.isLoss,
      shareText: step.shareText ?? null,
      outcome: step.outcome,
      startedOn: isoDate(step.startedOn),
      dueOn: isoDate(step.dueOn),
      endedOn: isoDate(step.endedOn),
    })),
  };
}

/**
 * Kas pulih (SPEC §5.7): `Σ daily_sales.qty × unit_price` di rentang rencana.
 * Sebelum rencana dimulai tidak ada rentang, jadi 0.
 */
async function recoveredOf(
  db: AnyDb,
  plan: PlanRow,
  today: string,
): Promise<number> {
  const start = isoDate(plan.startedOn);
  if (start === null) return 0;
  const end = isoDate(plan.endedOn) ?? today;
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(qty * unit_price), 0) AS recovered FROM daily_sales
    WHERE product_id = ${plan.productId} AND sale_date BETWEEN ${start}::date AND ${end}::date`);
  return num((result.rows[0] as { recovered: unknown } | undefined)?.recovered);
}

async function withProduct(
  db: AnyDb,
  plan: PlanRow,
  today: string,
): Promise<PlanOut> {
  const steps = await db
    .select()
    .from(planSteps)
    .where(eq(planSteps.planId, plan.id));
  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, plan.productId))
    .limit(1);
  return serialize(
    plan,
    steps,
    product[0]?.name ?? "",
    await recoveredOf(db, plan, today),
  );
}

/** Baris `action_plans` mentah milik toko ini; 404 bila tidak ada (IDOR). */
async function findPlanRow(
  db: AnyDb,
  storeId: string,
  planId: string,
): Promise<PlanRow> {
  const found = await db
    .select()
    .from(actionPlans)
    .where(and(eq(actionPlans.storeId, storeId), eq(actionPlans.id, planId)))
    .limit(1);
  const row = found[0];
  if (row === undefined)
    throw new ApiError(404, "not_found", "Rencana tidak ditemukan.");
  return row;
}

export async function findPlan(
  db: AnyDb,
  storeId: string,
  planId: string,
  today: string,
): Promise<PlanOut | null> {
  const found = await db
    .select()
    .from(actionPlans)
    .where(and(eq(actionPlans.storeId, storeId), eq(actionPlans.id, planId)))
    .limit(1);
  return found[0] === undefined ? null : withProduct(db, found[0], today);
}

/** Rencana `suggested`/`active` barang ini, plus rencana terakhir yang sudah berakhir. */
export async function currentPlanOf(
  db: AnyDb,
  storeId: string,
  productId: string,
  today: string,
): Promise<{ plan: PlanOut | null; lastEnded: PlanOut | null }> {
  const rows = await db
    .select()
    .from(actionPlans)
    .where(
      and(
        eq(actionPlans.storeId, storeId),
        eq(actionPlans.productId, productId),
      ),
    )
    .orderBy(sql`${actionPlans.generatedAt} DESC`);

  const live = rows.find(
    (row) => row.state === "suggested" || row.state === "active",
  );
  const ended = rows.find(
    (row) => row.state !== "suggested" && row.state !== "active",
  );
  return {
    plan: live === undefined ? null : await withProduct(db, live, today),
    lastEnded: ended === undefined ? null : await withProduct(db, ended, today),
  };
}

export async function findLivePlan(
  db: AnyDb,
  storeId: string,
  productId: string,
  states: readonly string[],
): Promise<PlanRow | null> {
  const found = await db
    .select()
    .from(actionPlans)
    .where(
      and(
        eq(actionPlans.storeId, storeId),
        eq(actionPlans.productId, productId),
        inArray(actionPlans.state, asStates(states)),
      ),
    )
    .limit(1);
  return found[0] ?? null;
}

export async function listPlans(
  db: AnyDb,
  storeId: string,
  states: readonly string[],
  today: string,
): Promise<PlanOut[]> {
  const filter =
    states.length === 0
      ? and(
          eq(actionPlans.storeId, storeId),
          sql`${actionPlans.state} <> 'suggested'`,
        )
      : and(
          eq(actionPlans.storeId, storeId),
          inArray(actionPlans.state, asStates(states)),
        );

  const rows = await db
    .select()
    .from(actionPlans)
    .where(filter)
    .orderBy(
      sql`${actionPlans.startedOn} DESC NULLS LAST, ${actionPlans.generatedAt} DESC`,
    );

  return Promise.all(rows.map((row) => withProduct(db, row, today)));
}

export interface SavePlanInput {
  storeId: string;
  productId: string;
  draft: PlanDraft;
  source: "ai" | "template";
  status: string;
  aiModel: string | null;
  sellPrice: number;
  lastCost: number;
  stock: number;
  bundleSellPrices: Map<string, number>;
  now: Date;
}

function stepRowOf(
  planId: string,
  draft: PlanStepDraft,
  input: SavePlanInput,
): typeof planSteps.$inferInsert {
  const bundleSellPrice =
    draft.bundleProductId === null || draft.bundleProductId === undefined
      ? undefined
      : input.bundleSellPrices.get(draft.bundleProductId);
  const derived = deriveStep(
    {
      actionType: draft.actionType,
      sellPrice: input.sellPrice,
      lastCost: input.lastCost,
      discountPercent: draft.discountPercent ?? undefined,
      belowCostPercent: draft.belowCostPercent ?? undefined,
      bundleSellPrice,
    },
    input.stock,
  );

  return {
    planId,
    stepNo: draft.stepNo,
    actionType: draft.actionType,
    title: draft.title,
    instructions: draft.instructions,
    successCriteria: draft.successCriteria,
    durationDays: draft.durationDays,
    discountPercent: draft.discountPercent ?? null,
    bundleProductId: draft.bundleProductId ?? null,
    belowCostPercent: draft.belowCostPercent ?? null,
    newPrice: derived.newPrice,
    profitPerUnit: derived.profitPerUnit,
    cashBackEstimate: derived.cashBackEstimate,
    isLoss: derived.isLoss,
    shareText: draft.shareCopy ?? null,
    outcome: "pending",
  };
}

/** Simpan rencana baru; harga per tahap dihitung sekali di sini (SPEC §5.4). */
export async function savePlan(
  db: AnyDb,
  input: SavePlanInput,
  today: string,
): Promise<PlanOut> {
  return db.transaction(async (tx) => {
    const typed = tx as unknown as AnyDb;
    // Satu barang hanya boleh punya satu rencana hidup (index unik parsial).
    // Dibuang di transaksi yang sama dengan insert supaya tidak ada celah.
    await typed.execute(
      sql`DELETE FROM plan_steps WHERE plan_id IN (
        SELECT id FROM action_plans WHERE store_id = ${input.storeId}
          AND product_id = ${input.productId} AND state = 'suggested')`,
    );
    await typed.execute(
      sql`DELETE FROM action_plans WHERE store_id = ${input.storeId}
          AND product_id = ${input.productId} AND state = 'suggested'`,
    );
    const created = await typed
      .insert(actionPlans)
      .values({
        storeId: input.storeId,
        productId: input.productId,
        source: input.source,
        state: "suggested",
        productStatusAtGeneration: input.status as "waspada",
        rationale: input.draft.rationale,
        aiModel: input.aiModel,
        generatedAt: input.now,
      })
      .returning();

    const plan = created[0];
    if (plan === undefined) throw new Error("Gagal menyimpan rencana");
    await typed
      .insert(planSteps)
      .values(input.draft.steps.map((step) => stepRowOf(plan.id, step, input)));
    return withProduct(typed, plan, today);
  });
}

/** Buang rencana `suggested` lama sebelum membuat pengganti (index unik live). */
/** `suggested` → `active`: catat mulai, nilai terkunci, dan tahap 1 berjalan. */
export async function startPlan(
  db: AnyDb,
  storeId: string,
  planId: string,
  today: string,
  lockedValue: number,
): Promise<PlanOut> {
  return db.transaction(async (tx) => {
    const typed = tx as unknown as AnyDb;
    const found = await typed
      .select()
      .from(actionPlans)
      .where(and(eq(actionPlans.storeId, storeId), eq(actionPlans.id, planId)))
      .limit(1);
    const plan = found[0];
    if (plan === undefined)
      throw new ApiError(404, "not_found", "Rencana tidak ditemukan.");
    if (plan.state !== "suggested") {
      throw new ApiError(
        409,
        "plan_invalid_state",
        "Rencana ini sudah dijalankan.",
      );
    }

    await typed
      .update(actionPlans)
      .set({
        state: "active",
        startedOn: today,
        lockedValueAtStart: lockedValue,
        currentStep: 1,
      })
      .where(and(eq(actionPlans.id, planId), eq(actionPlans.storeId, storeId)));

    await typed
      .update(planSteps)
      .set({ outcome: "in_progress", startedOn: today })
      .where(and(eq(planSteps.planId, planId), eq(planSteps.stepNo, 1)));

    const updated = await findPlan(typed, storeId, planId, today);
    if (updated === null)
      throw new ApiError(404, "not_found", "Rencana tidak ditemukan.");
    return updated;
  });
}

/** Barang pelengkap tidak pernah dapat rencana (SPEC §5.6). */
export async function productForPlan(
  db: AnyDb,
  storeId: string,
  productId: string,
): Promise<typeof products.$inferSelect | null> {
  const found = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.id, productId),
        isNull(products.archivedAt),
      ),
    )
    .limit(1);
  return found[0] ?? null;
}

export const numOf = num;

export type StepOutcomeValue = "succeeded" | "failed";

/** Tahap harus ada dan sedang berjalan (kontrak: lainnya → `step_invalid_state`). */
async function requireRunningStep(
  db: AnyDb,
  planId: string,
  stepNo: number,
): Promise<StepRow> {
  const found = await db
    .select()
    .from(planSteps)
    .where(and(eq(planSteps.planId, planId), eq(planSteps.stepNo, stepNo)))
    .limit(1);
  const step = found[0];
  if (step === undefined)
    throw new ApiError(404, "not_found", "Tahap tidak ditemukan.");
  if (step.outcome !== "in_progress") {
    throw new ApiError(
      409,
      "step_invalid_state",
      "Tahap ini tidak sedang berjalan.",
    );
  }
  return step;
}

async function finishPlan(
  db: AnyDb,
  storeId: string,
  planId: string,
  state: "completed" | "exhausted" | "stopped",
  today: string,
): Promise<void> {
  await db.execute(
    sql`UPDATE action_plans SET state = ${state}, ended_on = ${today}::date
        WHERE id = ${planId} AND store_id = ${storeId}`,
  );
}

/**
 * Hasil tahap (SPEC §5.7). `succeeded` → rencana selesai, sisa tahap `skipped`.
 * `failed` → tahap berikut mulai hari ini; gagal di tahap 3 → rencana `exhausted`.
 */
export async function recordStepOutcome(
  db: AnyDb,
  storeId: string,
  planId: string,
  stepNo: number,
  outcome: StepOutcomeValue,
  today: string,
): Promise<PlanOut> {
  return db.transaction(async (tx) => {
    const typed = tx as unknown as AnyDb;
    const plan = await typed
      .select()
      .from(actionPlans)
      .where(and(eq(actionPlans.storeId, storeId), eq(actionPlans.id, planId)))
      .limit(1);
    if (plan[0] === undefined)
      throw new ApiError(404, "not_found", "Rencana tidak ditemukan.");
    if (plan[0].state !== "active") {
      throw new ApiError(
        409,
        "plan_invalid_state",
        "Rencana ini tidak sedang berjalan.",
      );
    }

    await requireRunningStep(typed, planId, stepNo);
    // W-4: subquery satu kali supaya tiap tulis plan_steps ter-scope toko.
    const scoped = sql`(SELECT id FROM action_plans
                        WHERE id = ${planId} AND store_id = ${storeId})`;
    await typed.execute(
      sql`UPDATE plan_steps SET outcome = ${outcome}, ended_on = ${today}::date
          WHERE plan_id = ${scoped} AND step_no = ${stepNo}`,
    );

    if (outcome === "succeeded") {
      await typed.execute(
        sql`UPDATE plan_steps SET outcome = 'skipped'
            WHERE plan_id = ${scoped}
              AND step_no > ${stepNo} AND outcome = 'pending'`,
      );
      await finishPlan(typed, storeId, planId, "completed", today);
    } else if (stepNo >= 3) {
      await finishPlan(typed, storeId, planId, "exhausted", today);
    } else {
      await typed.execute(
        sql`UPDATE plan_steps SET outcome = 'in_progress', started_on = ${today}::date
            WHERE plan_id = ${scoped} AND step_no = ${stepNo + 1}`,
      );
      await typed.execute(
        sql`UPDATE action_plans SET current_step = ${stepNo + 1}
            WHERE id = ${planId} AND store_id = ${storeId}`,
      );
    }

    const updated = await findPlan(typed, storeId, planId, today);
    if (updated === null)
      throw new ApiError(404, "not_found", "Rencana tidak ditemukan.");
    return updated;
  });
}

/** Harga tahap ini belum dipakai; `null` bila sudah sama dengan harga sekarang. */
export async function stepPriceToApply(
  db: AnyDb,
  storeId: string,
  planId: string,
  stepNo: number,
): Promise<{ productId: string; newPrice: number }> {
  const plan = await db
    .select()
    .from(actionPlans)
    .where(and(eq(actionPlans.storeId, storeId), eq(actionPlans.id, planId)))
    .limit(1);
  if (plan[0] === undefined)
    throw new ApiError(404, "not_found", "Rencana tidak ditemukan.");
  if (plan[0].state !== "active") {
    throw new ApiError(
      409,
      "plan_invalid_state",
      "Rencana ini tidak sedang berjalan.",
    );
  }
  const step = await requireRunningStep(db, planId, stepNo);

  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, plan[0].productId))
    .limit(1);
  if (product[0] === undefined)
    throw new ApiError(404, "not_found", "Barang tidak ditemukan.");
  if (product[0].sellPrice === step.newPrice) {
    throw new ApiError(
      409,
      "step_invalid_state",
      "Harga jual sudah sama dengan harga tahap ini.",
    );
  }
  return { productId: plan[0].productId, newPrice: step.newPrice };
}

/** `active` → `stopped`; tahap yang sedang berjalan jadi `skipped`. */
export async function stopPlan(
  db: AnyDb,
  storeId: string,
  planId: string,
  today: string,
): Promise<PlanOut> {
  return db.transaction(async (tx) => {
    const typed = tx as unknown as AnyDb;
    const plan = await typed
      .select()
      .from(actionPlans)
      .where(and(eq(actionPlans.storeId, storeId), eq(actionPlans.id, planId)))
      .limit(1);
    if (plan[0] === undefined)
      throw new ApiError(404, "not_found", "Rencana tidak ditemukan.");
    if (plan[0].state !== "active") {
      throw new ApiError(
        409,
        "plan_invalid_state",
        "Rencana ini tidak sedang berjalan.",
      );
    }

    await typed.execute(
      sql`UPDATE plan_steps SET outcome = 'skipped'
          WHERE plan_id IN (SELECT id FROM action_plans
                            WHERE id = ${planId} AND store_id = ${storeId})
            AND outcome = 'in_progress'`,
    );
    await finishPlan(typed, storeId, planId, "stopped", today);

    const updated = await findPlan(typed, storeId, planId, today);
    if (updated === null)
      throw new ApiError(404, "not_found", "Rencana tidak ditemukan.");
    return updated;
  });
}

/**
 * Pemilik menyetujui harga tahap ini (BRD O-9: tidak pernah otomatis).
 * Mengembalikan id barang supaya pemanggil bisa menyusun `ProductDetail`.
 */
export async function applyStepPrice(
  db: AnyDb,
  storeId: string,
  planId: string,
  stepNo: number,
  now: Date,
): Promise<string> {
  const plan = await findPlanRow(db, storeId, planId);
  if (plan.state !== "active") {
    throw new ApiError(
      409,
      "step_invalid_state",
      "Rencana ini tidak sedang berjalan.",
    );
  }
  const step = await requireRunningStep(db, planId, stepNo);

  const current = await db
    .select({ sellPrice: products.sellPrice })
    .from(products)
    .where(and(eq(products.id, plan.productId), eq(products.storeId, storeId)))
    .limit(1);
  // Kontrak: harga tahap sama dengan harga sekarang bukan aksi yang sah.
  if (current[0]?.sellPrice === step.newPrice) {
    throw new ApiError(
      409,
      "step_invalid_state",
      "Harga tahap ini sama dengan harga jual sekarang.",
    );
  }

  await db
    .update(products)
    .set({ sellPrice: step.newPrice, updatedAt: now })
    .where(and(eq(products.id, plan.productId), eq(products.storeId, storeId)));
  return plan.productId;
}
