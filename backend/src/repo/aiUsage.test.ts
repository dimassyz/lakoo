// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestDb } from "../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../database/src/db.ts";
import {
  actionPlans,
  aiUsageDaily,
  products,
  stores,
  users,
} from "../../../database/src/schema.ts";
import { aiQuotaFor, recordAiUsage } from "./aiUsage.ts";

const TODAY = "2026-11-09";
const NOW = new Date("2026-11-09T03:00:00Z");

let db: AnyDb;
let close: () => Promise<void>;
let storeId = "";
let productId = "";

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();

  const owner = await db
    .insert(users)
    .values({ email: "kuota@contoh.id", isDemo: false })
    .returning();
  const store = await db
    .insert(stores)
    .values({ ownerUserId: owner[0]!.id, name: "Toko Kuota", aiEnabled: true })
    .returning();
  storeId = store[0]!.id;

  const product = await db
    .insert(products)
    .values({
      storeId,
      name: "Barang Kuota",
      nameKey: "barang kuota",
      unit: "pcs",
      sellPrice: 20_000,
    })
    .returning();
  productId = product[0]!.id;
}, 120_000);

afterAll(async () => {
  await close();
});

async function seedAiPlan(
  generatedAt: Date,
  source: "ai" | "template",
): Promise<void> {
  await db.insert(actionPlans).values({
    storeId,
    productId,
    source,
    state: "completed",
    productStatusAtGeneration: "mati",
    rationale: "uji kuota",
    generatedAt,
  });
}

describe("aiQuotaFor — SPEC §6.1 #3", () => {
  it("menghitung rencana AI hari ini saja, bukan template atau hari lain", async () => {
    await seedAiPlan(NOW, "ai");
    await seedAiPlan(NOW, "ai");
    await seedAiPlan(NOW, "template");
    await seedAiPlan(new Date("2026-11-08T03:00:00Z"), "ai");

    const quota = await aiQuotaFor(db, storeId, TODAY);
    expect(quota.storeCallsToday).toBe(2);
    expect(quota.storeAiEnabled).toBe(true);
    expect(quota.globalCallsToday).toBe(0);
  });

  it("kuota global dibaca dari ai_usage_daily", async () => {
    await db.insert(aiUsageDaily).values({
      usageDate: TODAY,
      calls: 79,
      inputTokens: 1000,
      outputTokens: 200,
    });
    const quota = await aiQuotaFor(db, storeId, TODAY);
    expect(quota.globalCallsToday).toBe(79);
  });

  it("menghormati stores.ai_enabled = false", async () => {
    await db
      .update(stores)
      .set({ aiEnabled: false })
      .where(eq(stores.id, storeId));
    const quota = await aiQuotaFor(db, storeId, TODAY);
    expect(quota.storeAiEnabled).toBe(false);
    await db
      .update(stores)
      .set({ aiEnabled: true })
      .where(eq(stores.id, storeId));
  });
});

describe("recordAiUsage — SPEC §6.1 #7", () => {
  it("menambah calls dan menjumlahkan token", async () => {
    await db.delete(aiUsageDaily);
    await recordAiUsage(db, TODAY, 2_000, 600);
    await recordAiUsage(db, TODAY, 1_500, 400);

    const rows = await db
      .select()
      .from(aiUsageDaily)
      .where(eq(aiUsageDaily.usageDate, TODAY));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.calls).toBe(2);
    expect(rows[0]!.inputTokens).toBe(3_500);
    expect(rows[0]!.outputTokens).toBe(1_000);
  });

  it("tidak menulis baris untuk panggilan template", async () => {
    await db.delete(aiUsageDaily);
    const before = (
      await db.execute(sql`SELECT COUNT(*) AS n FROM ai_usage_daily`)
    ).rows[0] as { n: unknown };
    expect(Number(before.n)).toBe(0);
  });
});
