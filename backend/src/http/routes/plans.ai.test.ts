// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  aiUsageDaily,
  products,
  stockIns,
  stores,
} from "../../../../database/src/schema.ts";
import { createApp } from "../app.ts";

const ORIGIN = "https://lakoo.test";
const NOW = new Date("2026-11-09T03:00:00Z");
const TODAY = "2026-11-09";

/** Diisi buildWorld setelah seed — mock fetch membacanya saat request terjadi. */
const shared = { larisId: "" };

const aiPlan = () => ({
  rationale: "Barang lama tidak laku dan uangnya terkunci di rak",
  steps: [
    {
      action_type: "bundle",
      title: "Paket hemat",
      instructions: "Jual paket bersama barang laris",
      success_criteria: "Paket terjual",
      duration_days: 7,
      discount_percent: 10,
      bundle_product_id: shared.larisId,
    },
    {
      action_type: "discount",
      title: "Turunkan harga",
      instructions: "Pasang promo di rak depan",
      success_criteria: "Barang laku",
      duration_days: 7,
      discount_percent: 20,
    },
    {
      action_type: "sell_at_cost",
      title: "Jual seharga kulakan",
      instructions: "Kembalikan uang ke kas",
      success_criteria: "Stok berkurang",
      duration_days: 7,
    },
  ],
});

const chatBody = (plan: unknown) => ({
  choices: [{ message: { content: JSON.stringify(plan) } }],
  usage: { prompt_tokens: 2_000, completion_tokens: 600 },
});

interface World {
  db: AnyDb;
  close: () => Promise<void>;
  matiId: string;
  mati2Id: string;
  req: (path: string, method?: string) => Promise<Response>;
}

async function seedProduct(
  db: AnyDb,
  storeId: string,
  name: string,
  daysAgo: number,
): Promise<string> {
  const inserted = await db
    .insert(products)
    .values({
      storeId,
      name,
      nameKey: name.toLowerCase(),
      unit: "pcs",
      sellPrice: 20_000,
    })
    .returning();
  await db.insert(stockIns).values({
    storeId,
    productId: inserted[0]!.id,
    batchId: crypto.randomUUID(),
    receivedOn: new Date(NOW.getTime() - daysAgo * 86_400_000)
      .toISOString()
      .slice(0, 10),
    qty: 10,
    unitCost: 12_000,
    kind: "opening",
  });
  return inserted[0]!.id;
}

async function buildWorld(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<World> {
  const created = await createTestDb();
  const db = created.db as AnyDb;
  const app = createApp({
    db,
    allowedOrigins: [ORIGIN],
    now: () => NOW,
    env,
    fetchImpl,
  });

  const registered = await Promise.resolve(
    app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({
        storeName: "Toko AI",
        email: "ai@contoh.id",
        password: "rahasia123",
      }),
    }),
  );
  const cookie = (
    registered.headers
      .getSetCookie()
      .find((c) => c.startsWith("lakoo_session=")) ?? ""
  ).split(";")[0] as string;
  const storeId = (await db.select().from(stores).limit(1))[0]!.id;
  await db
    .update(stores)
    .set({ aiEnabled: true })
    .where(eq(stores.id, storeId));

  shared.larisId = await seedProduct(db, storeId, "Barang Laris", 3);
  const matiId = await seedProduct(db, storeId, "Barang Mati", 200);
  const mati2Id = await seedProduct(db, storeId, "Barang Mati Dua", 200);

  const req = (path: string, method = "GET") =>
    Promise.resolve(
      app.request(`/api/v1${path}`, {
        method,
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          cookie,
        },
      }),
    );

  return { db, close: () => created.client.close(), matiId, mati2Id, req };
}

const usageRows = (db: AnyDb) =>
  db.select().from(aiUsageDaily).where(eq(aiUsageDaily.usageDate, TODAY));

describe("POST /products/{id}/plans — jalur AI sungguhan", () => {
  let world: World;
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => chatBody(aiPlan()),
  }));

  beforeAll(async () => {
    world = await buildWorld(
      { AI_API_KEY: "kunci-uji" },
      fetchMock as unknown as typeof fetch,
    );
  }, 120_000);

  afterAll(async () => {
    await world.close();
  });

  it("memakai AI, menyimpan rencana, dan mencatat ai_usage_daily", async () => {
    const res = await world.req(`/products/${world.matiId}/plans`, "POST");
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      source: string;
      steps: { actionType: string }[];
    };
    expect(body.source).toBe("ai");
    expect(body.steps).toHaveLength(3);

    const usage = await usageRows(world.db);
    expect(usage).toHaveLength(1);
    expect(usage[0]!.calls).toBe(1);
    // Token dari field usage chat-completions, bukan perkiraan.
    expect(usage[0]!.inputTokens).toBe(2_000);
    expect(usage[0]!.outputTokens).toBe(600);

    // Panggilan keluar = chat-completions OpenAI-compatible dengan Bearer key.
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      {
        body: string;
        headers: Record<string, string>;
      },
    ];
    expect(url).toBe("https://my.vleee.net/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer kunci-uji");
    const sent = JSON.parse(init.body) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(sent.model).toBe("gpt-4o-mini");
    const userMessage = sent.messages.find((m) => m.role === "user");
    // Prompt AI wajib membawa riwayat 7 minggu — array kosong = saran tanpa data.
    const context = JSON.parse(userMessage?.content ?? "{}") as {
      product: { week_qty: number[] };
    };
    expect(context.product.week_qty).toHaveLength(7);
  }, 60_000);
});

describe("POST /products/{id}/plans — tanpa AI_API_KEY", () => {
  let world: World;
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => chatBody(aiPlan()),
  }));

  beforeAll(async () => {
    world = await buildWorld({}, fetchMock as unknown as typeof fetch);
  }, 120_000);

  afterAll(async () => {
    await world.close();
  });

  it("selalu jatuh ke template dan tidak memanggil gateway sama sekali", async () => {
    const res = await world.req(`/products/${world.matiId}/plans`, "POST");
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      source: string;
      steps: { actionType: string }[];
    };
    expect(body.source).toBe("template");
    expect(body.steps).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await usageRows(world.db)).toHaveLength(0);
  }, 60_000);
});

describe("POST /products/{id}/plans — gateway AI error", () => {
  let world: World;
  let errorStatus = 402;
  const fetchMock = vi.fn(async () => ({
    ok: false,
    status: errorStatus,
    json: async () => ({ error: { message: "gateway error" } }),
  }));

  beforeAll(async () => {
    world = await buildWorld(
      { AI_API_KEY: "kunci-uji" },
      fetchMock as unknown as typeof fetch,
    );
  }, 120_000);

  afterAll(async () => {
    await world.close();
  });

  it("402 (kuota gateway habis) → rencana template, tanpa usage tercatat", async () => {
    errorStatus = 402;
    const res = await world.req(`/products/${world.matiId}/plans`, "POST");
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      source: string;
      steps: { actionType: string }[];
    };
    expect(body.source).toBe("template");
    expect(body.steps).toHaveLength(3);
    expect(await usageRows(world.db)).toHaveLength(0);
  }, 60_000);

  it("500 → rencana template", async () => {
    errorStatus = 500;
    const res = await world.req(`/products/${world.mati2Id}/plans`, "POST");
    expect(res.status).toBe(201);

    const body = (await res.json()) as { source: string };
    expect(body.source).toBe("template");
  }, 60_000);
});
