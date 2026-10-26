// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  dailySales,
  products,
  stockAdjustments,
  stockIns,
  stores,
} from "../../../../database/src/schema.ts";
import { createApp } from "../app.ts";

const ORIGIN = "https://lakoo.test";
const TODAY = new Date("2026-11-09T03:00:00Z");

let db: AnyDb;
let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;
let cookie = "";
const ids: Record<string, string> = {};

interface RecapLine {
  productId: string;
  name: string;
  unit: string;
  sellPrice: number;
  morningStock: number;
  stockInOnDate: number;
  recordedQty: number;
  currentStock: number;
}

interface Recap {
  date: string;
  isToday: boolean;
  hasRecord: boolean;
  lines: RecapLine[];
}

const get = (path: string) =>
  Promise.resolve(app.request(`/api/v1${path}`, { headers: { cookie } }));

async function seedStoreAndProducts(): Promise<string> {
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

  const storeId = (await db.select().from(stores).limit(1))[0]!.id;
  const inserted = await db
    .insert(products)
    .values([
      {
        storeId,
        name: "Kecap",
        nameKey: "kecap",
        unit: "botol",
        sellPrice: 20_000,
      },
      {
        storeId,
        name: "Sabun",
        nameKey: "sabun",
        unit: "pcs",
        sellPrice: 5_000,
      },
    ])
    .returning();
  ids.kecap = inserted[0]!.id;
  ids.sabun = inserted[1]!.id;
  return storeId;
}

const stockInRows = (storeId: string) =>
  [
    {
      storeId,
      productId: ids.kecap!,
      batchId: crypto.randomUUID(),
      receivedOn: "2026-11-02",
      qty: 10,
      unitCost: 12_000,
      kind: "opening",
    },
    {
      storeId,
      productId: ids.kecap!,
      batchId: crypto.randomUUID(),
      receivedOn: "2026-11-03",
      qty: 5,
      unitCost: 12_000,
      kind: "purchase",
    },
    {
      storeId,
      productId: ids.kecap!,
      batchId: crypto.randomUUID(),
      receivedOn: "2026-11-08",
      qty: 4,
      unitCost: 12_000,
      kind: "purchase",
    },
    {
      storeId,
      productId: ids.sabun!,
      batchId: crypto.randomUUID(),
      receivedOn: "2026-11-02",
      qty: 20,
      unitCost: 3_000,
      kind: "opening",
    },
  ] satisfies (typeof stockIns.$inferInsert)[];

/** Kecap: masuk 10 (2 Nov), 5 (3 Nov), 4 (8 Nov); terjual 3 (2 Nov), 2 (8 Nov). */
async function seedLedger(storeId: string): Promise<void> {
  await db.insert(stockIns).values(stockInRows(storeId));
  await db.insert(dailySales).values([
    {
      storeId,
      productId: ids.kecap!,
      saleDate: "2026-11-02",
      qty: 3,
      unitPrice: 20_000,
      source: "quantity",
    },
    {
      storeId,
      productId: ids.kecap!,
      saleDate: "2026-11-08",
      qty: 2,
      unitPrice: 20_000,
      source: "quantity",
    },
  ]);
  // Penyesuaian: sabun −1 pada 8 Nov.
  await db.insert(stockAdjustments).values({
    storeId,
    productId: ids.sabun!,
    adjustedOn: "2026-11-08",
    qtyDelta: -1,
    reason: "correction",
  });
}

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
  app = createApp({ db, allowedOrigins: [ORIGIN], now: () => TODAY });
  await seedLedger(await seedStoreAndProducts());
}, 120_000);

afterAll(async () => {
  await close();
});

const lineOf = (body: Recap, productId: string): RecapLine => {
  const found = body.lines.find((line) => line.productId === productId);
  if (found === undefined) throw new Error("baris rekap tidak ada");
  return found;
};

describe("GET /sales/recap — perhitungan stok", () => {
  it("morningStock = stok akhir hari sebelumnya + penyesuaian tanggal itu", async () => {
    const body = (await (
      await get("/sales/recap?date=2026-11-08")
    ).json()) as Recap;
    // Kecap per 8 Nov pagi: 10 + 5 − 3 = 12
    expect(lineOf(body, ids.kecap!).morningStock).toBe(12);
    // Sabun: 20 − 1 (penyesuaian tanggal itu) = 19
    expect(lineOf(body, ids.sabun!).morningStock).toBe(19);
  });

  it("stockInOnDate hanya barang masuk pada tanggal itu", async () => {
    const body = (await (
      await get("/sales/recap?date=2026-11-08")
    ).json()) as Recap;
    expect(lineOf(body, ids.kecap!).stockInOnDate).toBe(4);
    expect(lineOf(body, ids.sabun!).stockInOnDate).toBe(0);
  });

  it("recordedQty hanya penjualan pada tanggal itu", async () => {
    const body = (await (
      await get("/sales/recap?date=2026-11-08")
    ).json()) as Recap;
    expect(lineOf(body, ids.kecap!).recordedQty).toBe(2);
    expect(lineOf(body, ids.sabun!).recordedQty).toBe(0);
  });

  it("currentStock memakai hari ini, bukan tanggal rekap", async () => {
    const body = (await (
      await get("/sales/recap?date=2026-11-08")
    ).json()) as Recap;
    // Kecap sampai 9 Nov: 10+5+4 − 3−2 = 14
    expect(lineOf(body, ids.kecap!).currentStock).toBe(14);
    expect(lineOf(body, ids.sabun!).currentStock).toBe(19);
  });
});

describe("GET /sales/recap — penanda tanggal", () => {
  it("tanggal tanpa catatan → recordedQty 0 dan hasRecord false", async () => {
    const body = (await (
      await get("/sales/recap?date=2026-11-05")
    ).json()) as Recap;
    expect(body.hasRecord).toBe(false);
    expect(lineOf(body, ids.kecap!).recordedQty).toBe(0);
    // Stok pagi 5 Nov = 10 + 5 − 3 = 12
    expect(lineOf(body, ids.kecap!).morningStock).toBe(12);
  });

  it("menandai isToday hanya untuk tanggal hari ini", async () => {
    const today = (await (
      await get("/sales/recap?date=2026-11-09")
    ).json()) as Recap;
    expect(today.isToday).toBe(true);
    const other = (await (
      await get("/sales/recap?date=2026-11-08")
    ).json()) as Recap;
    expect(other.isToday).toBe(false);
  });

  it("hasRecord true bila ada penjualan pada tanggal itu", async () => {
    const body = (await (
      await get("/sales/recap?date=2026-11-02")
    ).json()) as Recap;
    expect(body.hasRecord).toBe(true);
  });
});

describe("GET /sales/recap — bentuk dan validasi", () => {
  it("mengembalikan bentuk kontrak", async () => {
    const body = (await (
      await get("/sales/recap?date=2026-11-08")
    ).json()) as Recap;
    expect(body.date).toBe("2026-11-08");
    expect(body.lines).toHaveLength(2);
    const line = body.lines[0]!;
    expect(Object.keys(line).sort()).toEqual(
      [
        "currentStock",
        "morningStock",
        "name",
        "productId",
        "recordedQty",
        "sellPrice",
        "stockInOnDate",
        "unit",
      ].sort(),
    );
  });

  it("menolak tanggal tanpa format YYYY-MM-DD", async () => {
    const res = await get("/sales/recap?date=8-11-2026");
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { fields?: Record<string, string> };
    };
    expect(body.error.fields?.date).toBeDefined();
  });
});

describe("GET /sales/recap — penjagaan input", () => {
  it("menolak tanpa parameter date", async () => {
    expect((await get("/sales/recap")).status).toBe(400);
  });

  it("mewajibkan sesi", async () => {
    const res = await Promise.resolve(
      app.request("/api/v1/sales/recap?date=2026-11-08"),
    );
    expect(res.status).toBe(401);
  });
});
