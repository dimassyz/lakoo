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
let productId = "";

interface Plan {
  id: string;
  state: string;
  recovered: number;
}

interface Results {
  totalRecovered: number;
  recovered30d: number;
  activeCount: number;
  finishedCount: number;
  plans: Plan[];
  latestWeeklySummary: {
    weekStart: string;
    weekEnd: string;
    sentences: string[];
  } | null;
}

const req = (path: string, method = "GET", body?: unknown) =>
  Promise.resolve(
    app.request(`/api/v1${path}`, {
      method,
      headers: { origin: ORIGIN, "content-type": "application/json", cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
  app = createApp({ db, allowedOrigins: [ORIGIN], now: () => NOW, env: {} });

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

  const inserted = await db
    .insert(products)
    .values({
      storeId,
      name: "Barang Mati",
      nameKey: "barang mati",
      unit: "pcs",
      sellPrice: 20_000,
    })
    .returning();
  productId = inserted[0]!.id;
  await db.insert(stockIns).values({
    storeId,
    productId,
    batchId: crypto.randomUUID(),
    receivedOn: "2026-08-01",
    qty: 10,
    unitCost: 12_000,
    kind: "opening",
  });
}, 120_000);

afterAll(async () => {
  await close();
});

describe("GET /results — sebelum ada rencana", () => {
  it("semua angka nol dan daftar kosong", async () => {
    const res = await req("/results");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Results;
    expect(body.totalRecovered).toBe(0);
    expect(body.recovered30d).toBe(0);
    expect(body.activeCount).toBe(0);
    expect(body.finishedCount).toBe(0);
    expect(body.plans).toEqual([]);
  });

  it("ringkasan mingguan tetap tersedia (dibuat malas)", async () => {
    const body = (await (await req("/results")).json()) as Results;
    expect(body.latestWeeklySummary).not.toBeNull();
    expect(body.latestWeeklySummary?.sentences).toHaveLength(3);
  });
});

describe("GET /results — setelah rencana berjalan", () => {
  it("menghitung kas pulih dari penjualan selama rencana", async () => {
    const plan = (await (
      await req(`/products/${productId}/plans`, "POST", {})
    ).json()) as Plan;
    await req(`/plans/${plan.id}/start`, "POST");

    // Dua penjualan selama rencana: 2×20.000 + 1×20.000 = 60.000
    await db.insert(dailySales).values([
      {
        storeId,
        productId,
        saleDate: TODAY,
        qty: 2,
        unitPrice: 20_000,
        source: "quantity",
      },
      {
        storeId,
        productId,
        saleDate: "2026-11-08",
        qty: 1,
        unitPrice: 20_000,
        source: "quantity",
      },
    ]);

    const body = (await (await req("/results")).json()) as Results;
    // Penjualan 8 Nov terjadi SEBELUM rencana mulai (hari ini) → tidak dihitung.
    expect(body.totalRecovered).toBe(40_000);
    expect(body.recovered30d).toBe(40_000);
    expect(body.activeCount).toBe(1);
    expect(body.finishedCount).toBe(0);
    expect(body.plans).toHaveLength(1);
  });

  it("rencana yang selesai pindah ke finishedCount", async () => {
    const body = (await (await req("/results")).json()) as Results;
    const planId = body.plans[0]!.id;
    await req(`/plans/${planId}/steps/1/outcome`, "POST", {
      outcome: "succeeded",
    });

    const after = (await (await req("/results")).json()) as Results;
    expect(after.activeCount).toBe(0);
    expect(after.finishedCount).toBe(1);
    expect(after.totalRecovered).toBe(40_000);
  });

  it("rencana suggested tidak masuk daftar", async () => {
    await req(`/products/${productId}/plans`, "POST", { regenerate: true });
    const body = (await (await req("/results")).json()) as Results;
    expect(body.plans.every((plan) => plan.state !== "suggested")).toBe(true);
  });
});

describe("GET /weekly-summaries/latest", () => {
  it("mengembalikan minggu lengkap terakhir dengan 3 kalimat", async () => {
    const res = await req("/weekly-summaries/latest");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      weekStart: string;
      weekEnd: string;
      sentences: string[];
    };
    expect(body.sentences).toHaveLength(3);
    // Minggu 2026-11-09 → minggu lengkap terakhir 2026-11-01..2026-11-07.
    expect(body.weekStart).toBe("2026-11-01");
    expect(body.weekEnd).toBe("2026-11-07");
  });

  it("mewajibkan sesi", async () => {
    const res = await Promise.resolve(
      app.request("/api/v1/weekly-summaries/latest"),
    );
    expect(res.status).toBe(401);
  });
});
