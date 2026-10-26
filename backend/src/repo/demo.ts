import { randomUUID } from "node:crypto";
import { eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import {
  actionPlans,
  dailySales,
  planSteps,
  products,
  stockAdjustments,
  stockIns,
  stores,
  users,
} from "../../../database/src/schema.ts";
import { serviceUnavailable } from "../http/errors.ts";
import { DEMO_TTL_SECONDS } from "../http/session.ts";

/** Batas klon aktif (SPEC §10.2, risiko D1). */
export const MAX_ACTIVE_CLONES = 150;
const CHUNK = 500;

type Tx = Parameters<Parameters<AnyDb["transaction"]>[0]>[0];

export interface ClonedDemo {
  user: typeof users.$inferSelect;
  store: typeof stores.$inferSelect;
}

async function chunkedInsert<T>(
  rows: readonly T[],
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK) {
    await insert(rows.slice(index, index + CHUNK));
  }
}

/**
 * Jaga jumlah klon aktif ≤ 150 dengan menghapus yang tertua.
 * Menghapus `users` (bukan `stores`) supaya baris user ikut bersih lewat cascade.
 */
async function pruneOldestClones(tx: Tx, now: Date): Promise<void> {
  const active = await tx
    .select({ ownerUserId: stores.ownerUserId, createdAt: stores.createdAt })
    .from(stores)
    .where(isNotNull(stores.demoExpiresAt))
    .orderBy(stores.createdAt);

  const room = MAX_ACTIVE_CLONES - 1;
  const excess = active.length - room;
  if (excess <= 0) return;

  const victims = active.slice(0, excess).map((row) => row.ownerUserId);
  // Klon yang sudah kedaluwarsa tetap dihitung; cron harian yang membersihkannya.
  await tx.delete(users).where(inArray(users.id, victims));
  void now;
}

async function cloneProducts(tx: Tx, storeId: string, templateId: string) {
  const source = await tx
    .select()
    .from(products)
    .where(eq(products.storeId, templateId));
  const idMap = new Map<string, string>();

  const rows = source.map((product) => {
    const id = randomUUID();
    idMap.set(product.id, id);
    return {
      id,
      storeId,
      name: product.name,
      nameKey: product.nameKey,
      unit: product.unit,
      category: product.category,
      sellPrice: product.sellPrice,
      isComplementary: product.isComplementary,
      complementaryMaxStock: product.complementaryMaxStock,
    };
  });
  await chunkedInsert(rows, (chunk) => tx.insert(products).values(chunk));
  return idMap;
}

async function cloneLedger(
  tx: Tx,
  storeId: string,
  templateId: string,
  idMap: Map<string, string>,
) {
  const ins = await tx
    .select()
    .from(stockIns)
    .where(eq(stockIns.storeId, templateId));
  await chunkedInsert(
    ins.map((row) => ({
      storeId,
      productId: idMap.get(row.productId) as string,
      batchId: randomUUID(),
      receivedOn: row.receivedOn,
      qty: row.qty,
      unitCost: row.unitCost,
      kind: row.kind,
    })),
    (chunk) => tx.insert(stockIns).values(chunk),
  );

  const sales = await tx
    .select()
    .from(dailySales)
    .where(eq(dailySales.storeId, templateId));
  await chunkedInsert(
    sales.map((row) => ({
      storeId,
      productId: idMap.get(row.productId) as string,
      saleDate: row.saleDate,
      qty: row.qty,
      unitPrice: row.unitPrice,
      source: row.source,
    })),
    (chunk) => tx.insert(dailySales).values(chunk),
  );

  const adjustments = await tx
    .select()
    .from(stockAdjustments)
    .where(eq(stockAdjustments.storeId, templateId));
  await chunkedInsert(
    adjustments.map((row) => ({
      storeId,
      productId: idMap.get(row.productId) as string,
      adjustedOn: row.adjustedOn,
      qtyDelta: row.qtyDelta,
      reason: row.reason,
    })),
    (chunk) => tx.insert(stockAdjustments).values(chunk),
  );
}

function stepRowOf(
  step: typeof planSteps.$inferSelect,
  planId: string,
  idMap: Map<string, string>,
): typeof planSteps.$inferInsert {
  return {
    planId,
    stepNo: step.stepNo,
    actionType: step.actionType,
    title: step.title,
    instructions: step.instructions,
    successCriteria: step.successCriteria,
    durationDays: step.durationDays,
    discountPercent: step.discountPercent,
    bundleProductId:
      step.bundleProductId === null
        ? null
        : (idMap.get(step.bundleProductId) ?? null),
    belowCostPercent: step.belowCostPercent,
    newPrice: step.newPrice,
    profitPerUnit: step.profitPerUnit,
    cashBackEstimate: step.cashBackEstimate,
    isLoss: step.isLoss,
    shareText: step.shareText,
    outcome: step.outcome,
    startedOn: step.startedOn,
    dueOn: step.dueOn,
    endedOn: step.endedOn,
  };
}

/** Rencana + tahap ikut dikloning supaya demo langsung menampilkan rencana AI (ADR-004). */
async function clonePlans(
  tx: Tx,
  storeId: string,
  templateId: string,
  idMap: Map<string, string>,
): Promise<void> {
  const plans = await tx
    .select()
    .from(actionPlans)
    .where(eq(actionPlans.storeId, templateId));

  for (const plan of plans) {
    const productId = idMap.get(plan.productId);
    if (productId === undefined) continue;

    const inserted = await tx
      .insert(actionPlans)
      .values({
        storeId,
        productId,
        source: plan.source,
        state: plan.state,
        productStatusAtGeneration: plan.productStatusAtGeneration,
        rationale: plan.rationale,
        aiModel: plan.aiModel,
        startedOn: plan.startedOn,
        endedOn: plan.endedOn,
        lockedValueAtStart: plan.lockedValueAtStart,
        currentStep: plan.currentStep,
      })
      .returning();
    const planId = inserted[0]?.id;
    if (planId === undefined)
      throw new Error("Gagal menyimpan rencana hasil kloning");

    const steps = await tx
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, plan.id));
    if (steps.length === 0) continue;
    await tx
      .insert(planSteps)
      .values(steps.map((step) => stepRowOf(step, planId, idMap)));
  }
}

/**
 * Klon toko template demo jadi toko pribadi pengunjung (SPEC §10.2, ADR-004).
 * Satu transaksi: kalau ada langkah gagal, tidak ada toko setengah jadi.
 */
export async function cloneDemoTemplate(
  db: AnyDb,
  now: Date,
): Promise<ClonedDemo> {
  return db.transaction(async (tx) => {
    const found = await tx
      .select()
      .from(stores)
      .where(eq(stores.isDemoTemplate, true))
      .limit(1);
    const template = found[0];
    if (template === undefined) {
      // Kontrak: 503 `internal_error`, UI menampilkan "Coba lagi sebentar".
      throw serviceUnavailable();
    }

    await pruneOldestClones(tx, now);

    const demoExpiresAt = new Date(now.getTime() + DEMO_TTL_SECONDS * 1000);
    // `users.email` NOT NULL + unik, jadi demo memakai alamat sintetis.
    // Klien tidak pernah melihatnya: `toMe` mengembalikan null untuk akun demo.
    const insertedUser = await tx
      .insert(users)
      .values({
        email: `demo-${randomUUID()}@lakoo.local`,
        passwordHash: null,
        isDemo: true,
      })
      .returning();
    const user = insertedUser[0];
    if (user === undefined) throw new Error("Gagal membuat user demo");

    const insertedStore = await tx
      .insert(stores)
      .values({
        ownerUserId: user.id,
        name: template.name,
        storeType: template.storeType,
        location: template.location,
        customerTypes: template.customerTypes,
        healthyDays: template.healthyDays,
        deadDays: template.deadDays,
        warningWeeks: template.warningWeeks,
        aiEnabled: template.aiEnabled,
        onboardedAt: template.onboardedAt,
        isDemoTemplate: false,
        demoExpiresAt,
      })
      .returning();
    const store = insertedStore[0];
    if (store === undefined) throw new Error("Gagal membuat toko demo");

    const idMap = await cloneProducts(tx, store.id, template.id);
    await cloneLedger(tx, store.id, template.id, idMap);
    await clonePlans(tx, store.id, template.id, idMap);

    return { user, store };
  });
}

/** Dipakai test: hitung klon yang masih hidup. */
export async function countActiveClones(db: AnyDb): Promise<number> {
  const rows = await db.execute(
    sql`SELECT COUNT(*) AS n FROM stores WHERE demo_expires_at IS NOT NULL AND is_demo_template = false`,
  );
  const row = rows.rows[0] as { n?: unknown } | undefined;
  return Number(row?.n ?? 0);
}
