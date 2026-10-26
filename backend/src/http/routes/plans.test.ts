// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  dailySales,
  products,
  stockIns,
  stores,
} from "../../../../database/src/schema.ts";
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

interface Step {
  stepNo: number;
  actionType: string;
  newPrice: number;
  isLoss: boolean;
  outcome: string;
  startedOn: string | null;
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
    ])
    .returning();
  matiId = inserted[0]!.id;
  sehatId = inserted[1]!.id;
  pelengkapId = inserted[2]!.id;
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
