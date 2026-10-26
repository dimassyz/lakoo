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

let db: AnyDb;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let cookie = "";
let storeId = "";
let matiId = "";
let larisId = "";

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
      bundle_product_id: larisId,
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

const geminiBody = (plan: unknown) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }],
  usageMetadata: { promptTokenCount: 2_000, candidatesTokenCount: 600 },
});

const fetchMock = vi.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => geminiBody(aiPlan()),
}));
const fakeFetch = () => fetchMock as unknown as typeof fetch;

const req = (path: string, method = "GET") =>
  Promise.resolve(
    app.request(`/api/v1${path}`, {
      method,
      headers: { origin: ORIGIN, "content-type": "application/json", cookie },
    }),
  );

async function seedProduct(name: string, daysAgo: number): Promise<string> {
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

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();

  app = createApp({
    db,
    allowedOrigins: [ORIGIN],
    now: () => NOW,
    env: { AI_ENABLED: "true", GEMINI_API_KEY: "kunci-uji" },
    fetchImpl: fakeFetch(),
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
  cookie = (
    registered.headers
      .getSetCookie()
      .find((c) => c.startsWith("lakoo_session=")) ?? ""
  ).split(";")[0] as string;
  storeId = (await db.select().from(stores).limit(1))[0]!.id;
  await db
    .update(stores)
    .set({ aiEnabled: true })
    .where(eq(stores.id, storeId));

  larisId = await seedProduct("Barang Laris", 3);
  matiId = await seedProduct("Barang Mati", 200);
}, 120_000);

afterAll(async () => {
  await close();
});

describe("POST /products/{id}/plans — jalur AI sungguhan", () => {
  it("memakai AI, menyimpan rencana, dan mencatat ai_usage_daily", async () => {
    const res = await req(`/products/${matiId}/plans`, "POST");
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      source: string;
      steps: { actionType: string }[];
    };
    expect(body.source).toBe("ai");
    expect(body.steps).toHaveLength(3);

    const usage = await db
      .select()
      .from(aiUsageDaily)
      .where(eq(aiUsageDaily.usageDate, TODAY));
    expect(usage).toHaveLength(1);
    expect(usage[0]!.calls).toBe(1);
    // Token dari usageMetadata Gemini, bukan perkiraan.
    expect(usage[0]!.inputTokens).toBe(2_000);
    expect(usage[0]!.outputTokens).toBe(600);

    // Prompt AI wajib membawa riwayat 7 minggu — array kosong = saran tanpa data.
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    const prompt = JSON.parse(init.body) as {
      contents: { parts: { text: string }[] }[];
    };
    const sent = prompt.contents[0]!.parts[0]!.text;
    const context = JSON.parse(sent.slice(sent.indexOf("{"))) as {
      product: { week_qty: number[] };
    };
    expect(context.product.week_qty).toHaveLength(7);
  }, 60_000);
});
