import { randomUUID } from "node:crypto";
import { and, eq, type ExtractTablesWithRelations } from "drizzle-orm";
import type {
  NeonDatabase,
  NeonQueryResultHKT,
} from "drizzle-orm/neon-serverless";
import type { PgliteDatabase, PgliteQueryResultHKT } from "drizzle-orm/pglite";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { DemoData } from "./generator.ts";
import * as schema from "../schema.ts";
import {
  actionPlans,
  dailySales,
  planSteps,
  products,
  stockIns,
  stores,
  users,
} from "../schema.ts";

/** Neon (produksi) dan PGlite (test) sama-sama memenuhi bentuk ini. */
export type AnyDb = NeonDatabase<typeof schema> | PgliteDatabase<typeof schema>;
type Tx = PgTransaction<
  NeonQueryResultHKT | PgliteQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export interface SeedSummary {
  storeId: string;
  products: number;
  sales: number;
  stockIns: number;
  plans: number;
}

const CHUNK = 500;

function chunked<T>(rows: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += CHUNK) {
    chunks.push(rows.slice(index, index + CHUNK));
  }
  return chunks;
}

async function upsertTemplateOwner(tx: Tx, email: string): Promise<string> {
  const existing = await tx.select().from(users).where(eq(users.email, email));
  const found = existing[0];
  if (found !== undefined) return found.id;
  const inserted = await tx
    .insert(users)
    .values({ email })
    .returning({ id: users.id });
  const created = inserted[0];
  if (created === undefined)
    throw new Error("Gagal membuat user template demo");
  return created.id;
}

async function dropPreviousTemplate(
  tx: Tx,
  ownerUserId: string,
): Promise<void> {
  await tx
    .delete(stores)
    .where(
      and(eq(stores.ownerUserId, ownerUserId), eq(stores.isDemoTemplate, true)),
    );
}

async function insertProducts(
  tx: Tx,
  storeId: string,
  data: DemoData,
): Promise<string[]> {
  const ids: string[] = [];
  for (const chunk of chunked(data.products)) {
    const inserted = await tx
      .insert(products)
      .values(
        chunk.map((product) => ({
          storeId,
          name: product.name,
          nameKey: product.nameKey,
          unit: product.unit,
          category: product.category,
          sellPrice: product.sellPrice,
          isComplementary: product.isComplementary,
          complementaryMaxStock: product.complementaryMaxStock,
        })),
      )
      .returning({ id: products.id, nameKey: products.nameKey });
    for (const row of inserted) ids.push(row.id);
  }
  return ids;
}

async function insertHistory(
  tx: Tx,
  storeId: string,
  data: DemoData,
  productIds: Map<string, string>,
): Promise<{ sales: number; stockIns: number }> {
  const insRows: (typeof stockIns.$inferInsert)[] = [];
  const saleRows: (typeof dailySales.$inferInsert)[] = [];
  for (const product of data.products) {
    const productId = productIds.get(product.nameKey);
    if (productId === undefined)
      throw new Error(`Produk ${product.name} tidak tersimpan`);
    for (const row of product.stockIns) {
      insRows.push({
        storeId,
        productId,
        receivedOn: row.receivedOn,
        qty: row.qty,
        unitCost: row.unitCost,
        kind: row.kind,
        batchId: randomUUID(),
      });
    }
    for (const sale of product.sales) {
      saleRows.push({
        storeId,
        productId,
        saleDate: sale.saleDate,
        qty: sale.qty,
        unitPrice: sale.unitPrice,
        source: "import",
      });
    }
  }
  for (const chunk of chunked(insRows)) await tx.insert(stockIns).values(chunk);
  for (const chunk of chunked(saleRows))
    await tx.insert(dailySales).values(chunk);
  return { sales: saleRows.length, stockIns: insRows.length };
}

async function insertPlans(
  tx: Tx,
  storeId: string,
  data: DemoData,
  productIds: Map<string, string>,
): Promise<number> {
  let count = 0;
  for (const plan of data.plans) {
    const productId = productIds.get(
      plan.productName.trim().toLowerCase().replace(/\s+/g, " "),
    );
    if (productId === undefined)
      throw new Error(`Produk rencana ${plan.productName} tidak ada`);
    const inserted = await tx
      .insert(actionPlans)
      .values({
        storeId,
        productId,
        source: plan.source,
        state: plan.state,
        productStatusAtGeneration: plan.productStatusAtGeneration,
        rationale: plan.rationale,
        startedOn: plan.startedOn,
        endedOn: plan.endedOn,
        lockedValueAtStart: plan.lockedValueAtStart,
        currentStep: plan.currentStep,
      })
      .returning({ id: actionPlans.id });
    const planId = inserted[0]?.id;
    if (planId === undefined) throw new Error("Gagal menyimpan rencana demo");
    await tx.insert(planSteps).values(
      plan.steps.map((step) => ({
        planId,
        stepNo: step.stepNo,
        actionType: step.actionType,
        title: step.title,
        instructions: step.instructions,
        successCriteria: step.successCriteria,
        durationDays: step.durationDays,
        discountPercent: step.discountPercent,
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
        oldPrice: step.oldPrice,
      })),
    );
    count += 1;
  }
  return count;
}

/**
 * Regenerasi toko template demo: hapus template lama lalu tulis ulang (SPEC §10.2).
 * Klon demo milik pengunjung tidak tersentuh karena hanya template yang dihapus.
 */
export async function seedDemoTemplate(
  db: AnyDb,
  data: DemoData,
): Promise<SeedSummary> {
  return db.transaction(async (tx: Tx) => {
    const ownerUserId = await upsertTemplateOwner(tx, data.templateOwnerEmail);
    await dropPreviousTemplate(tx, ownerUserId);

    const storeRows = await tx
      .insert(stores)
      .values({
        ownerUserId,
        name: data.store.name,
        storeType: data.store.storeType,
        location: data.store.location,
        customerTypes: [...data.store.customerTypes],
        healthyDays: data.store.healthyDays,
        deadDays: data.store.deadDays,
        warningWeeks: data.store.warningWeeks,
        onboardedAt: new Date(),
        isDemoTemplate: true,
      })
      .returning({ id: stores.id });
    const storeId = storeRows[0]?.id;
    if (storeId === undefined)
      throw new Error("Gagal membuat toko template demo");

    const ids = await insertProducts(tx, storeId, data);
    const names = data.products.map((product) => product.nameKey);
    const productIds = new Map(
      ids.map((id, index) => [names[index] as string, id]),
    );
    const history = await insertHistory(tx, storeId, data, productIds);
    const plans = await insertPlans(tx, storeId, data, productIds);

    return {
      storeId,
      products: ids.length,
      sales: history.sales,
      stockIns: history.stockIns,
      plans,
    };
  });
}
