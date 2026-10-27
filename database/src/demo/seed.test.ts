// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../test/pglite.ts";
import type { AnyDb } from "../db.ts";
import { actionPlans, planSteps, products } from "../schema.ts";
import { eq } from "drizzle-orm";
import { generateDemo } from "./generator.ts";
import { seedDemoTemplate } from "./seed.ts";

/** Tanggal tetap supaya determinisme generator bisa diandalkan. */
const AS_OF = "2026-11-09";

let db: AnyDb;
let close: () => Promise<void>;

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
}, 120_000);

afterAll(async () => {
  await close();
});

/**
 * Regresi: `plan_steps` hasil seed dulu lahir dengan `old_price = 0` karena
 * seed tidak mengirim field kontrak. Karena template demo diregenerasi oleh
 * cron HARIAN, nilai 0 akan kembali setiap regenerasi — dan layar rencana
 * menampilkan "Harga Rp0 → RpX" alih-alih harga sebenarnya.
 *
 * Tes ini mengunci baris yang DITULIS seed, bukan yang diserialisasi: jalur
 * seed menulis langsung ke DB dan tidak pernah lewat `serialize`, jadi tes
 * respons API (plans.test.ts) tidak bisa menangkapnya.
 */
describe("seedDemoTemplate — field kontrak pada plan_steps", () => {
  it("setiap step punya oldPrice = harga jual produk (bukan 0)", async () => {
    await seedDemoTemplate(db, generateDemo(AS_OF));

    const rows = await db
      .select({
        stepNo: planSteps.stepNo,
        oldPrice: planSteps.oldPrice,
        sellPrice: products.sellPrice,
      })
      .from(planSteps)
      .innerJoin(actionPlans, eq(actionPlans.id, planSteps.planId))
      .innerJoin(products, eq(products.id, actionPlans.productId));

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(
        row.oldPrice,
        `step ${row.stepNo}: oldPrice harus = harga jual produk`,
      ).toBe(row.sellPrice);
      expect(row.oldPrice).toBeGreaterThan(0);
    }
  });
});
