// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  dailySales,
  planSteps,
  products,
  stockIns,
  stores,
} from "../../../../database/src/schema.ts";
import { eq } from "drizzle-orm";
import { createApp } from "../app.ts";

const ORIGIN = "https://lakoo.test";
const NOW = new Date("2026-11-09T03:00:00Z");
const TODAY = "2026-11-09";

let db: AnyDb;
let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;
let cookie = "";
let storeId = "";
let matiId = "";
let sehatId = "";
let pelengkapId = "";
let matiLainId = "";
let sekaratId = "";

interface Step {
  stepNo: number;
  actionType: string;
  newPrice: number;
  isLoss: boolean;
  outcome: string;
  startedOn: string | null;
  oldPrice: number;
  bundleProduct: { id: string; name: string; sellPrice: number } | null;
  bundlePrice: number | null;
}

interface Plan {
  id: string;
  productId: string;
  productName: string;
  source: string;
  state: string;
  statusAtGeneration: string;
  startedOn: string | null;
  endedOn: string | null;
  lockedValueAtStart: number | null;
  currentStep: number | null;
  recovered: number;
  recoveredPercent: number;
  steps: Step[];
}

const req = (path: string, method = "GET", body?: unknown) =>
  Promise.resolve(
    app.request(`/api/v1${path}`, {
      method,
      headers: { origin: ORIGIN, "content-type": "application/json", cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );

const generate = (productId: string, body: unknown = {}) =>
  req(`/products/${productId}/plans`, "POST", body);

async function registerStore(): Promise<void> {
  const registered = await app.request("/api/v1/auth/register", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({
      storeName: "Toko Bu Sri",
      email: "sri@contoh.id",
      password: "rahasia123",
    }),
  });
  cookie = (
    registered.headers
      .getSetCookie()
      .find((c) => c.startsWith("lakoo_session=")) ?? ""
  ).split(";")[0] as string;
  storeId = (await db.select().from(stores).limit(1))[0]!.id;
}

async function seedProducts(): Promise<void> {
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
        name: "Barang Laku",
        nameKey: "barang laku",
        unit: "pcs",
        sellPrice: 10_000,
      },
      {
        storeId,
        name: "Plastik",
        nameKey: "plastik",
        unit: "pcs",
        sellPrice: 500,
        isComplementary: true,
      },
      {
        // Nama sengaja diurutkan SEBELUM "Barang Laku" supaya menjadi
        // kandidat bundel pertama untuk barang bermasalah — bentuk data nyata
        // yang memicu bug: kandidat[0] bermasalah → ditolak validator → 500.
        storeId,
        name: "Anjuran Mati",
        nameKey: "anjuran mati",
        unit: "pcs",
        sellPrice: 15_000,
      },
      {
        storeId,
        name: "Barang Sekarat",
        nameKey: "barang sekarat",
        unit: "pcs",
        sellPrice: 18_000,
      },
    ])
    .returning();
  matiId = inserted[0]!.id;
  sehatId = inserted[1]!.id;
  pelengkapId = inserted[2]!.id;
  matiLainId = inserted[3]!.id;
  sekaratId = inserted[4]!.id;
}

async function seedLedger(): Promise<void> {
  await db.insert(stockIns).values([
    {
      storeId,
      productId: matiId,
      batchId: crypto.randomUUID(),
      receivedOn: "2026-08-01",
      qty: 10,
      unitCost: 12_000,
      kind: "opening",
    },
    {
      storeId,
      productId: sehatId,
      batchId: crypto.randomUUID(),
      receivedOn: "2026-11-01",
      qty: 10,
      unitCost: 6_000,
      kind: "opening",
    },
    // ~100 hari tanpa laku → mati. Nama "Anjuran Mati" < "Barang Laku" jadi
    // kandidat bundel PERTAMA untuk barang bermasalah.
    {
      storeId,
      productId: matiLainId,
      batchId: crypto.randomUUID(),
      receivedOn: "2026-08-01",
      qty: 10,
      unitCost: 9_000,
      kind: "opening",
    },
    // ~39 hari tanpa laku → sekarat (healthyDays 14 < 39 ≤ deadDays 45).
    {
      storeId,
      productId: sekaratId,
      batchId: crypto.randomUUID(),
      receivedOn: "2026-10-01",
      qty: 10,
      unitCost: 11_000,
      kind: "opening",
    },
  ]);
  await db.insert(dailySales).values({
    storeId,
    productId: sehatId,
    saleDate: "2026-11-08",
    qty: 1,
    unitPrice: 10_000,
    source: "quantity",
  });
}

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
  // AI sengaja dimatikan: jalur template yang diuji, deterministik.
  app = createApp({ db, allowedOrigins: [ORIGIN], now: () => NOW, env: {} });
  await registerStore();
  await seedProducts();
  await seedLedger();
}, 120_000);

afterAll(async () => {
  await close();
});

describe("POST /products/{id}/plans — penolakan", () => {
  it("409 plan_not_applicable untuk barang sehat", async () => {
    const res = await generate(sehatId);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("plan_not_applicable");
  });

  it("409 plan_not_applicable untuk barang pelengkap", async () => {
    const res = await generate(pelengkapId);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("plan_not_applicable");
  });

  it("404 untuk barang yang tidak ada", async () => {
    expect((await generate(crypto.randomUUID())).status).toBe(404);
  });

  it("mewajibkan sesi", async () => {
    const res = await Promise.resolve(
      app.request(`/api/v1/products/${matiId}/plans`, {
        method: "POST",
        headers: { origin: ORIGIN, "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /products/{id}/plans — pembuatan rencana", () => {
  let created: Plan;

  it("membuat rencana 3 tahap dari template (AI mati)", async () => {
    const res = await generate(matiId);
    expect(res.status).toBe(201);
    created = (await res.json()) as Plan;

    expect(created.source).toBe("template");
    expect(created.state).toBe("suggested");
    expect(created.statusAtGeneration).toBe("mati");
    expect(created.steps).toHaveLength(3);
    expect(created.steps.map((step) => step.stepNo)).toEqual([1, 2, 3]);
    expect(created.steps.every((step) => step.outcome === "pending")).toBe(
      true,
    );
    expect(created.lockedValueAtStart).toBeNull();
    expect(created.currentStep).toBeNull();
    expect(created.recovered).toBe(0);
  });

  it("menghitung harga per tahap saat disimpan (SPEC §5.4)", () => {
    // Harga jual 20.000, harga beli 12.000 — tahap 1 tidak boleh rugi (BR-11).
    expect(created.steps[0]!.isLoss).toBe(false);
    expect(created.steps[0]!.newPrice).toBeGreaterThan(0);
  });

  it("POST kedua mengembalikan rencana yang sama tanpa membuat baru (200)", async () => {
    const res = await generate(matiId);
    expect(res.status).toBe(200);
    const again = (await res.json()) as Plan;
    expect(again.id).toBe(created.id);
  });

  it("regenerate=true membuat rencana baru (201)", async () => {
    const res = await generate(matiId, { regenerate: true });
    expect(res.status).toBe(201);
    const fresh = (await res.json()) as Plan;
    expect(fresh.id).not.toBe(created.id);
  });
});

// Regresi: produk bermasalah dulu kena 500 karena template mengambil
// candidates[0] APA ADANYA (mati/sekarat), lalu validatePlan menolaknya.
// Data di bawah sengaja berbentuk produksi: kandidat pertama barang bermasalah
// adalah barang bermasalah lain ("Anjuran Mati" < "Barang Laku" secara alfabetis,
// dan summaries diurutkan ORDER BY p.name ASC).
describe("POST /products/{id}/plans — kandidat bundel bermasalah (regresi 500)", () => {
  it("barang sekarat dengan kandidat pertama mati → 201, bukan 500", async () => {
    const res = await generate(sekaratId);
    expect(res.status).toBe(201);
    const plan = (await res.json()) as Plan;
    expect(plan.source).toBe("template");
    expect(plan.statusAtGeneration).toBe("sekarat");
  });

  it("rencana sekarat utuh: 3 tahap, tahap 1 bundle atau discount", async () => {
    const res = await generate(sekaratId, { regenerate: true });
    expect(res.status).toBe(201);
    const plan = (await res.json()) as Plan;

    // 201 sudah membuktikan lolos validatePlan — kalau pasangan yang dipilih
    // tidak sah, handler melempar 500 sebelum sampai sini.
    expect(plan.steps).toHaveLength(3);
    // §5.6 sekarat tahap 1 = bundle; tanpa pasangan sah turun jadi discount.
    expect(["bundle", "discount"]).toContain(plan.steps[0]!.actionType);
    expect(plan.steps[0]!.isLoss).toBe(false);
  });
});

// Kontrak (openapi.yaml, PlanStep) mendaftarkan 20 field REQUIRED dengan
// `additionalProperties: false`. Sebelum fix ini, `oldPrice`, `bundleProduct`,
// dan `bundlePrice` tidak pernah dikirim — dan `bundleProductId` malah properti
// liar. Tes ini mengunci SELURUH daftar, bukan satu field, supaya lubang
// berikutnya yang bentuknya sama ketahuan di sini dan bukan di UI demo.
const CONTRACT_STEP_FIELDS = [
  "stepNo",
  "actionType",
  "title",
  "instructions",
  "successCriteria",
  "durationDays",
  "discountPercent",
  "belowCostPercent",
  "bundleProduct",
  "bundlePrice",
  "oldPrice",
  "newPrice",
  "profitPerUnit",
  "isLoss",
  "cashBackEstimate",
  "shareText",
  "outcome",
  "startedOn",
  "dueOn",
  "endedOn",
] as const;

describe("POST /products/{id}/plans — respons step memenuhi kontrak", () => {
  // Satu generate dibagi untuk semua tes di describe ini: PLAN_GENERATE_RULE
  // = 20/hari per store, dan file ini sudah memakainya hampir penuh. Satu
  // pemanggilan per tes akan membuat tes DI BAWAH file ini kena 429.
  let created: Plan;

  it("menyiapkan rencana sekarat (dipakai tes kontrak di bawah)", async () => {
    const res = await generate(sekaratId, { regenerate: true });
    expect(res.status).toBe(201);
    created = (await res.json()) as Plan;
    expect(created.steps).toHaveLength(3);
  });

  it("setiap tahap membawa SELURUH 20 field required", () => {
    for (const step of created.steps) {
      for (const field of CONTRACT_STEP_FIELDS) {
        expect(
          Object.hasOwn(step, field),
          `tahap ${step.stepNo} kehilangan field kontrak: ${field}`,
        ).toBe(true);
      }
      // `additionalProperties: false` — properti liar = pelanggaran kontrak.
      expect(Object.keys(step).sort()).toEqual(
        [...CONTRACT_STEP_FIELDS].sort(),
      );
    }
  });

  it("oldPrice = harga jual barang SAAT rencana dibuat (bukan undefined)", () => {
    // Barang Sekarat dijual 18.000 (fixture seedProducts).
    for (const step of created.steps) {
      expect(step.oldPrice).toBe(18_000);
    }
  });

  it("tahap bundle membawa bundleProduct {id,name,sellPrice} + bundlePrice", () => {
    const bundleStep = created.steps.find((s) => s.actionType === "bundle");
    if (bundleStep === undefined) return; // tanpa pasangan sah → discount, sah

    expect(bundleStep.bundleProduct).not.toBeNull();
    expect(bundleStep.bundleProduct!.id).toBe(sehatId); // pasangan sah = Barang Laku
    expect(bundleStep.bundleProduct!.name).toBe("Barang Laku");
    expect(bundleStep.bundleProduct!.sellPrice).toBe(10_000);
    // Harga paket = harga A setelah diskon + harga B (SPEC §5.4).
    expect(bundleStep.bundlePrice).toBe(
      bundleStep.newPrice + bundleStep.bundleProduct!.sellPrice,
    );
  });

  it("tahap non-bundle membawa bundleProduct null + bundlePrice null", () => {
    for (const step of created.steps.filter((s) => s.actionType !== "bundle")) {
      expect(step.bundleProduct).toBeNull();
      expect(step.bundlePrice).toBeNull();
    }
  });
});

// Properti desain tanpa penguji adalah properti yang bisa dibatalkan diam-diam.
// `plans.ts` UPDATE start/stop hanya menyentuh `outcome`/`startedOn` — field
// kontrak (oldPrice/bundlePrice) sengaja TIDAK ditulis karena nilainya
// point-in-time. Tanpa tes ini, seseorang bisa "memperbaiki" start/stop supaya
// me-refresh harga — terdengar masuk akal, nol tes gagal, dan harga historis
// ditimpa harga hari ini. Korupsi senyap, kelas SAMA dengan Rp0.
describe("start → stop TIDAK mengubah field kontrak (immutability)", () => {
  const contractFields = (planId: string) =>
    db
      .select({
        stepNo: planSteps.stepNo,
        oldPrice: planSteps.oldPrice,
        bundlePrice: planSteps.bundlePrice,
        bundleProductName: planSteps.bundleProductName,
        bundleProductSellPrice: planSteps.bundleProductSellPrice,
      })
      .from(planSteps)
      .where(eq(planSteps.planId, planId));

  it("oldPrice/bundlePrice setiap step IDENTIK sebelum dan sesudah start → stop", async () => {
    const plan = (await (
      await generate(sekaratId, { regenerate: true })
    ).json()) as Plan;

    const before = await contractFields(plan.id);
    expect(before.length).toBeGreaterThan(0);

    expect((await req(`/plans/${plan.id}/start`, "POST")).status).toBe(200);
    expect((await req(`/plans/${plan.id}/stop`, "POST")).status).toBe(200);

    // EKSAK: seluruh baris field kontrak harus identik. Kalau start/stop mulai
    // me-refresh harga, `after` akan beda dan tes ini GAGAL — bukan lolos palsu.
    expect(await contractFields(plan.id)).toEqual(before);
  });
});

describe("POST /plans/{id}/start", () => {
  it("suggested → active dengan tahap 1 berjalan", async () => {
    const plan = (await (
      await generate(matiId, { regenerate: true })
    ).json()) as Plan;

    const res = await req(`/plans/${plan.id}/start`, "POST");
    expect(res.status).toBe(200);
    const started = (await res.json()) as Plan;

    expect(started.state).toBe("active");
    expect(started.startedOn).toBe(TODAY);
    expect(started.currentStep).toBe(1);
    // 10 unit × harga beli 12.000
    expect(started.lockedValueAtStart).toBe(120_000);
    expect(started.steps[0]!.outcome).toBe("in_progress");
    expect(started.steps[0]!.startedOn).toBe(TODAY);
    expect(started.steps[1]!.outcome).toBe("pending");
  });

  it("409 plan_already_active saat membuat rencana baru untuk barang yang sedang berjalan", async () => {
    const res = await generate(matiId, { regenerate: true });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("plan_already_active");
  });

  it("409 plan_invalid_state saat memulai rencana yang sudah aktif", async () => {
    const list = (await (await req("/plans?state=active")).json()) as {
      items: Plan[];
    };
    const active = list.items[0]!;
    const res = await req(`/plans/${active.id}/start`, "POST");
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("plan_invalid_state");
  });

  it("404 untuk rencana yang tidak ada", async () => {
    expect(
      (await req(`/plans/${crypto.randomUUID()}/start`, "POST")).status,
    ).toBe(404);
  });
});

describe("GET /products/{id}/plans/current", () => {
  it("mengembalikan rencana aktif", async () => {
    const res = await req(`/products/${matiId}/plans/current`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      plan: Plan | null;
      lastEnded: Plan | null;
    };
    expect(body.plan?.state).toBe("active");
    expect(body.lastEnded).toBeNull();
  });

  it("null untuk barang yang belum pernah punya rencana", async () => {
    const body = (await (
      await req(`/products/${sehatId}/plans/current`)
    ).json()) as {
      plan: Plan | null;
    };
    expect(body.plan).toBeNull();
  });
});

describe("GET /plans", () => {
  it("tanpa filter tidak menampilkan suggested", async () => {
    const body = (await (await req("/plans")).json()) as { items: Plan[] };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((plan) => plan.state !== "suggested")).toBe(true);
  });

  it("filter state mempersempit hasil", async () => {
    const body = (await (await req("/plans?state=active")).json()) as {
      items: Plan[];
    };
    expect(body.items.every((plan) => plan.state === "active")).toBe(true);
  });

  it("menolak state yang tidak dikenal", async () => {
    expect((await req("/plans?state=ngawur")).status).toBe(400);
  });
});

/** Barang mati kedua, dipakai alur gagal/stop agar tidak bertabrakan dengan alur di atas. */
let extraSeq = 0;

/** Barang mati baru tiap panggilan (name_key unik per toko). */
async function matiKedua(): Promise<string> {
  extraSeq += 1;
  const label = `Barang Mati ${extraSeq + 1}`;
  const created = await db
    .insert(products)
    .values({
      storeId,
      name: label,
      nameKey: label.toLowerCase(),
      unit: "pcs",
      sellPrice: 20_000,
    })
    .returning();
  await db.insert(stockIns).values({
    storeId,
    productId: created[0]!.id,
    batchId: crypto.randomUUID(),
    receivedOn: "2026-08-01",
    qty: 10,
    unitCost: 12_000,
    kind: "opening",
  });
  return created[0]!.id;
}

describe("kas pulih SPEC §5.7", () => {
  it("menghitung Σ qty × unit_price di rentang rencana", async () => {
    // Rencana matiId sudah active sejak TODAY; catat penjualan hari ini.
    await db.insert(dailySales).values({
      storeId,
      productId: matiId,
      saleDate: TODAY,
      qty: 2,
      unitPrice: 20_000,
      source: "quantity",
    });

    const body = (await (
      await req(`/products/${matiId}/plans/current`)
    ).json()) as {
      plan: Plan;
    };
    // 2 × 20.000 = 40.000 dari nilai terkunci 120.000 → 33%
    expect(body.plan.recovered).toBe(40_000);
    expect(body.plan.recoveredPercent).toBe(33);
  });
});

describe("POST /plans/{id}/steps/{stepNo}/outcome", () => {
  it("409 step_invalid_state untuk tahap yang belum berjalan", async () => {
    const body = (await (
      await req(`/products/${matiId}/plans/current`)
    ).json()) as {
      plan: Plan;
    };
    const res = await req(`/plans/${body.plan.id}/steps/2/outcome`, "POST", {
      outcome: "succeeded",
    });
    expect(res.status).toBe(409);
    const err = (await res.json()) as { error: { code: string } };
    expect(err.error.code).toBe("step_invalid_state");
  });

  it("succeeded → rencana completed dan sisa tahap skipped", async () => {
    const current = (await (
      await req(`/products/${matiId}/plans/current`)
    ).json()) as {
      plan: Plan;
    };
    const res = await req(`/plans/${current.plan.id}/steps/1/outcome`, "POST", {
      outcome: "succeeded",
    });
    expect(res.status).toBe(200);
    const done = (await res.json()) as Plan;

    expect(done.state).toBe("completed");
    expect(done.endedOn).toBe(TODAY);
    expect(done.steps[0]!.outcome).toBe("succeeded");
    expect(done.steps[1]!.outcome).toBe("skipped");
    expect(done.steps[2]!.outcome).toBe("skipped");
  });

  it("menolak outcome untuk rencana yang sudah selesai", async () => {
    const list = (await (await req("/plans?state=completed")).json()) as {
      items: Plan[];
    };
    const res = await req(
      `/plans/${list.items[0]!.id}/steps/2/outcome`,
      "POST",
      {
        outcome: "failed",
      },
    );
    expect(res.status).toBe(409);
  });
});

describe("POST /plans/{id}/steps/{stepNo}/outcome — alur gagal", () => {
  it("failed di tahap 1 memindahkan ke tahap 2", async () => {
    const productId = await matiKedua();
    const plan = (await (await generate(productId)).json()) as Plan;
    await req(`/plans/${plan.id}/start`, "POST");

    const res = await req(`/plans/${plan.id}/steps/1/outcome`, "POST", {
      outcome: "failed",
    });
    expect(res.status).toBe(200);
    const next = (await res.json()) as Plan;

    expect(next.state).toBe("active");
    expect(next.currentStep).toBe(2);
    expect(next.steps[0]!.outcome).toBe("failed");
    expect(next.steps[1]!.outcome).toBe("in_progress");
    expect(next.steps[1]!.startedOn).toBe(TODAY);
  });

  it("failed di tahap 3 → rencana exhausted", async () => {
    const productId = await matiKedua();
    const plan = (await (await generate(productId)).json()) as Plan;
    await req(`/plans/${plan.id}/start`, "POST");
    await req(`/plans/${plan.id}/steps/1/outcome`, "POST", {
      outcome: "failed",
    });
    await req(`/plans/${plan.id}/steps/2/outcome`, "POST", {
      outcome: "failed",
    });

    const res = await req(`/plans/${plan.id}/steps/3/outcome`, "POST", {
      outcome: "failed",
    });
    expect(res.status).toBe(200);
    const done = (await res.json()) as Plan;
    expect(done.state).toBe("exhausted");
    expect(done.endedOn).toBe(TODAY);
  });
});

describe("POST /plans/{id}/stop", () => {
  it("active → stopped dan tahap berjalan jadi skipped", async () => {
    const productId = await matiKedua();
    const plan = (await (await generate(productId)).json()) as Plan;
    await req(`/plans/${plan.id}/start`, "POST");

    const res = await req(`/plans/${plan.id}/stop`, "POST");
    expect(res.status).toBe(200);
    const stopped = (await res.json()) as Plan;

    expect(stopped.state).toBe("stopped");
    expect(stopped.endedOn).toBe(TODAY);
    expect(stopped.steps[0]!.outcome).toBe("skipped");
    expect(stopped.steps[1]!.outcome).toBe("pending");
  });

  it("409 plan_invalid_state untuk rencana yang tidak aktif", async () => {
    const productId = await matiKedua();
    const plan = (await (await generate(productId)).json()) as Plan;
    const res = await req(`/plans/${plan.id}/stop`, "POST");
    expect(res.status).toBe(409);
  });

  it("404 untuk rencana yang tidak ada", async () => {
    expect(
      (await req(`/plans/${crypto.randomUUID()}/stop`, "POST")).status,
    ).toBe(404);
  });
});

describe("POST /plans/{id}/steps/{stepNo}/apply-price", () => {
  it("mengubah harga jual ke harga tahap dan mengembalikan ProductDetail", async () => {
    const productId = await matiKedua();
    const plan = (await (await generate(productId)).json()) as Plan;
    await req(`/plans/${plan.id}/start`, "POST");

    const before = (await (await req(`/products/${productId}`)).json()) as {
      sellPrice: number;
      weekQty: number[];
    };
    const stepPrice = plan.steps[0]!.newPrice;
    expect(stepPrice).not.toBe(before.sellPrice);

    const res = await req(`/plans/${plan.id}/steps/1/apply-price`, "POST");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      sellPrice: number;
      weekQty: number[];
      createdAt: string;
    };
    expect(body.id).toBe(productId);
    expect(body.sellPrice).toBe(stepPrice);
    expect(body.weekQty).toHaveLength(7);
    expect(body.createdAt).toBeDefined();
  });

  it("409 bila harga tahap sama dengan harga sekarang", async () => {
    const productId = await matiKedua();
    const plan = (await (await generate(productId)).json()) as Plan;
    await req(`/plans/${plan.id}/start`, "POST");

    // Terapkan sekali (harga jadi sama), lalu ulangi.
    await req(`/plans/${plan.id}/steps/1/apply-price`, "POST");
    const again = await req(`/plans/${plan.id}/steps/1/apply-price`, "POST");
    expect(again.status).toBe(409);
    const err = (await again.json()) as { error: { code: string } };
    expect(err.error.code).toBe("step_invalid_state");
  });
});

describe("POST /plans/{id}/steps/{stepNo}/apply-price — penolakan", () => {
  it("409 untuk tahap yang belum berjalan", async () => {
    const productId = await matiKedua();
    const plan = (await (await generate(productId)).json()) as Plan;
    await req(`/plans/${plan.id}/start`, "POST");

    const res = await req(`/plans/${plan.id}/steps/2/apply-price`, "POST");
    expect(res.status).toBe(409);
  });

  it("409 untuk rencana yang belum dimulai", async () => {
    const productId = await matiKedua();
    const plan = (await (await generate(productId)).json()) as Plan;
    const res = await req(`/plans/${plan.id}/steps/1/apply-price`, "POST");
    expect(res.status).toBe(409);
  });

  it("404 untuk rencana milik toko lain", async () => {
    const res = await req(
      `/plans/${crypto.randomUUID()}/steps/1/apply-price`,
      "POST",
    );
    expect(res.status).toBe(404);
  });
});
