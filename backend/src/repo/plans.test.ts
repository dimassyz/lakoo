// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb } from "../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../database/src/db.ts";
import {
  planSteps,
  products,
  stores,
  users,
} from "../../../database/src/schema.ts";
import { templatePlan } from "../domain/planTemplates.ts";
import type { PlanDraft } from "../domain/planValidation.ts";
import { recordStepOutcome, savePlan, startPlan } from "./plans.ts";

const NOW = new Date("2026-11-09T03:00:00Z");
const GEN_TODAY = "2026-11-09";
// Mulai dua hari setelah dibuat: tanggal berlaku nyata harus BERBEDA dari
// perkiraan saat pembuatan, supaya tes membuktikan pengisian ulang saat start.
const START_TODAY = "2026-11-11";

let db: AnyDb;
let close: () => Promise<void>;
let storeId = "";
let matiId = "";
let sekaratId = "";
let partnerId = "";
let planId = "";

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();

  const owner = await db
    .insert(users)
    .values({ email: "sri@contoh.id", isDemo: false })
    .returning();
  const store = await db
    .insert(stores)
    .values({ ownerUserId: owner[0]!.id, name: "Toko Bu Sri" })
    .returning();
  storeId = store[0]!.id;

  const inserted = await db
    .insert(products)
    .values([
      {
        storeId,
        name: "Barang Mati",
        nameKey: "barang mati",
        unit: "pcs",
        sellPrice: 20_000,
      },
      {
        storeId,
        name: "Barang Sekarat",
        nameKey: "barang sekarat",
        unit: "pcs",
        sellPrice: 20_000,
      },
      {
        storeId,
        name: "Barang Laku",
        nameKey: "barang laku",
        unit: "pcs",
        sellPrice: 10_000,
      },
    ])
    .returning();
  matiId = inserted[0]!.id;
  sekaratId = inserted[1]!.id;
  partnerId = inserted[2]!.id;
}, 120_000);

afterAll(async () => {
  await close();
});

describe("shareText rencana template (jalur savePlan)", () => {
  it("tersubstitusi penuh: nama toko, nama barang, harga baru terformat", async () => {
    const draft = templatePlan({
      status: "mati",
      sellPrice: 20_000,
      lastCost: 12_000,
      stock: 10,
      bundleProductId: null,
    });
    const plan = await savePlan(
      db,
      {
        storeId,
        productId: matiId,
        draft,
        source: "template",
        status: "mati",
        aiModel: null,
        sellPrice: 20_000,
        lastCost: 12_000,
        stock: 10,
        bundlePartners: new Map(),
        now: NOW,
      },
      GEN_TODAY,
    );
    planId = plan.id;

    const first = plan.steps[0]!;
    expect(first.shareText).toBe(
      "Promo Toko Bu Sri: Barang Mati sekarang Rp17.000. Berlaku sampai 16 November 2026.",
    );
    expect(first.shareText).toContain("Toko Bu Sri");
    expect(first.shareText).toContain("Barang Mati");
    expect(first.shareText).toContain("Rp17.000");
    for (const step of plan.steps) {
      expect(step.shareText ?? "").not.toContain("{");
      expect(step.shareText ?? "").not.toContain("}");
    }
  });

  it("baris tersimpan tetap template mentah — substitusi terjadi saat baca", async () => {
    const rows = await db
      .select({ shareText: planSteps.shareText })
      .from(planSteps)
      .where(and(eq(planSteps.planId, planId), eq(planSteps.stepNo, 1)));
    expect(rows[0]?.shareText).toContain("{nama_toko}");
  });
});

describe("shareText setelah rencana berjalan", () => {
  it("start mengisi dueOn nyata dan tanggal berlaku di teks ikut berubah", async () => {
    const started = await startPlan(db, storeId, planId, START_TODAY, 120_000);

    const first = started.steps[0]!;
    expect(first.startedOn).toBe(START_TODAY);
    expect(first.dueOn).toBe("2026-11-18");
    expect(first.shareText).toContain("18 November 2026");
    expect(first.shareText).not.toContain("16 November 2026");
    expect(first.shareText).not.toContain("{");
  });

  it("transisi tahap: tahap berikut dapat dueOn + tanggal berlaku nyata", async () => {
    const after = await recordStepOutcome(
      db,
      storeId,
      planId,
      1,
      "failed",
      START_TODAY,
    );

    const second = after.steps[1]!;
    expect(second.outcome).toBe("in_progress");
    expect(second.startedOn).toBe(START_TODAY);
    expect(second.dueOn).toBe("2026-11-18");
    expect(second.shareText).toContain("Rp12.000");
    expect(second.shareText).toContain("18 November 2026");
    expect(second.shareText).not.toContain("{");
  });
});

/** Draft berbentuk output AI: shareCopy memakai seluruh placeholder paket. */
function aiDraft(bundleProductId: string): PlanDraft {
  return {
    rationale: "Barang jarang laku dan uangnya terkunci di rak.",
    steps: [
      {
        stepNo: 1,
        actionType: "bundle",
        title: "Jual paket hemat",
        instructions: "Pasangkan dengan barang yang paling laris di toko.",
        successCriteria: "Paket terjual sebelum tenggat.",
        durationDays: 7,
        discountPercent: 10,
        bundleProductId,
        shareCopy:
          "Promo {nama_toko}: paket {nama_barang} + {nama_paket} cuma {harga_paket}, hemat {hemat}! Berlaku sampai {berlaku_sampai}.",
      },
      {
        stepNo: 2,
        actionType: "discount",
        title: "Turunkan harga",
        instructions: "Pasang harga promo di rak depan.",
        successCriteria: "Barang laku lagi sebelum tenggat.",
        durationDays: 7,
        discountPercent: 20,
        shareCopy:
          "Promo {nama_toko}: {nama_barang} sekarang {harga_baru} (biasanya {harga_lama}).",
      },
      {
        stepNo: 3,
        actionType: "display_move",
        title: "Pindahkan ke rak depan",
        instructions: "Taruh dekat kasir supaya pembeli melihatnya.",
        successCriteria: "Barang laku lagi sebelum tenggat.",
        durationDays: 7,
      },
    ],
  };
}

describe("shareText rencana AI (draft berplaceholder paket)", () => {
  it("placeholder paket terisi dari data bundle tahap", async () => {
    const draft = aiDraft(partnerId);

    const plan = await savePlan(
      db,
      {
        storeId,
        productId: sekaratId,
        draft,
        source: "ai",
        status: "sekarat",
        aiModel: "gemini-test",
        sellPrice: 20_000,
        lastCost: 12_000,
        stock: 10,
        bundlePartners: new Map([
          [partnerId, { name: "Barang Laku", sellPrice: 10_000 }],
        ]),
        now: NOW,
      },
      GEN_TODAY,
    );

    // Diskon 10% atas harga gabungan: paket (20.000 + 10.000) × 0,9 = 27.000;
    // hemat = 20.000 + 10.000 − 27.000 = 3.000.
    expect(plan.steps[0]!.shareText).toBe(
      "Promo Toko Bu Sri: paket Barang Sekarat + Barang Laku cuma Rp27.000, hemat Rp3.000! Berlaku sampai 16 November 2026.",
    );
    expect(plan.steps[1]!.shareText).toBe(
      "Promo Toko Bu Sri: Barang Sekarat sekarang Rp16.000 (biasanya Rp20.000).",
    );
    expect(plan.steps[2]!.shareText).toBeNull();
    for (const step of plan.steps) {
      expect(step.shareText ?? "").not.toContain("{");
    }
  });
});
