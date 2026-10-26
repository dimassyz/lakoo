// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  actionPlans,
  dailySales,
  products,
  stockIns,
  stores,
} from "../../../../database/src/schema.ts";
import { eq } from "drizzle-orm";
import { createApp } from "../app.ts";

const ORIGIN = "https://lakoo.test";
const NOW = new Date("2026-11-09T03:00:00Z"); // 10:00 WIB
const TODAY = "2026-11-09";

let db: AnyDb;
let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;
let cookie = "";
let storeId = "";
const ids: Record<string, string> = {};

interface Result {
  date: string;
  mode: string;
  lines: {
    productId: string;
    soldQty: number;
    stockAfter: number;
    status: string;
  }[];
  totalSold: number;
  totalRevenue: number;
}

const put = (
  body: unknown,
  key: string | null = crypto.randomUUID(),
  headers = {},
) =>
  Promise.resolve(
    app.request("/api/v1/sales/recap", {
      method: "PUT",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie,
        ...(key === null ? {} : { "idempotency-key": key }),
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );

const salesQty = async (
  productId: string,
  date: string,
): Promise<number | null> => {
  const rows = await db
    .select()
    .from(dailySales)
    .where(eq(dailySales.productId, productId));
  return rows.find((row) => row.saleDate === date)?.qty ?? null;
};

async function registerAndSeedProducts(): Promise<void> {
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

  await db.insert(stockIns).values([
    {
      storeId,
      productId: ids.kecap!,
      batchId: crypto.randomUUID(),
      receivedOn: "2026-11-01",
      qty: 20,
      unitCost: 12_000,
      kind: "opening",
    },
    {
      storeId,
      productId: ids.sabun!,
      batchId: crypto.randomUUID(),
      receivedOn: "2026-11-01",
      qty: 5,
      unitCost: 3_000,
      kind: "opening",
    },
  ]);
}

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
  app = createApp({ db, allowedOrigins: [ORIGIN], now: () => NOW });
  await registerAndSeedProducts();
}, 120_000);

afterAll(async () => {
  await close();
});

const line = (
  productId: string,
  field: "qty" | "countedStock",
  value: number,
) => ({
  productId,
  [field]: value,
});

describe("PUT /sales/recap — mode quantity", () => {
  it("mengganti, bukan menambah (koreksi tidak membuat data ganda)", async () => {
    await put({
      date: TODAY,
      mode: "quantity",
      lines: [line(ids.kecap!, "qty", 3)],
    });
    expect(await salesQty(ids.kecap!, TODAY)).toBe(3);

    await put({
      date: TODAY,
      mode: "quantity",
      lines: [line(ids.kecap!, "qty", 5)],
    });
    expect(await salesQty(ids.kecap!, TODAY)).toBe(5);
  });

  it("qty 0 menghapus baris", async () => {
    await put({
      date: TODAY,
      mode: "quantity",
      lines: [line(ids.kecap!, "qty", 4)],
    });
    expect(await salesQty(ids.kecap!, TODAY)).toBe(4);

    const res = await put({
      date: TODAY,
      mode: "quantity",
      lines: [line(ids.kecap!, "qty", 0)],
    });
    expect(res.status).toBe(200);
    expect(await salesQty(ids.kecap!, TODAY)).toBeNull();
  });

  it("totalSold dan totalRevenue mengikuti harga jual barang", async () => {
    const res = await put({
      date: "2026-11-08",
      mode: "quantity",
      lines: [line(ids.kecap!, "qty", 2), line(ids.sabun!, "qty", 1)],
    });
    const body = (await res.json()) as Result;
    expect(body.totalSold).toBe(3);
    expect(body.totalRevenue).toBe(2 * 20_000 + 1 * 5_000);
    expect(body.lines.find((l) => l.productId === ids.kecap!)?.stockAfter).toBe(
      18,
    );
  });
});

describe("PUT /sales/recap — mode opname", () => {
  it("sold = morningStock + stockInOnDate − countedStock", async () => {
    // Kecap: masuk 20 (1 Nov), terjual 2 (8 Nov) → stok pagi 9 Nov = 18.
    const res = await put({
      date: TODAY,
      mode: "opname",
      lines: [line(ids.kecap!, "countedStock", 15)],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Result;
    expect(body.lines[0]!.soldQty).toBe(3);
    expect(await salesQty(ids.kecap!, TODAY)).toBe(3);
  });

  it("mencatat source 'opname', bukan 'quantity'", async () => {
    await put({
      date: TODAY,
      mode: "opname",
      lines: [line(ids.kecap!, "countedStock", 15)],
    });
    const rows = await db
      .select()
      .from(dailySales)
      .where(eq(dailySales.productId, ids.kecap!));
    const today = rows.find((row) => row.saleDate === TODAY);
    expect(today?.source).toBe("opname");
  });

  it("menolak opname_negative bila hitungan melebihi stok tersedia", async () => {
    const res = await put({
      date: TODAY,
      mode: "opname",
      lines: [line(ids.sabun!, "countedStock", 999)],
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { lines: { code: string }[] } };
    expect(body.error.lines[0]!.code).toBe("opname_negative");
    expect(await salesQty(ids.sabun!, TODAY)).toBeNull();
  });
});

describe("PUT /sales/recap — all-or-nothing dan BR-16", () => {
  it("satu baris ditolak → tidak ada yang tersimpan", async () => {
    const res = await put({
      date: TODAY,
      mode: "opname",
      lines: [
        line(ids.kecap!, "countedStock", 10),
        line(ids.sabun!, "countedStock", 999),
      ],
    });
    expect(res.status).toBe(422);
    // Baris pertama valid tapi ikut dibatalkan.
    expect(await salesQty(ids.kecap!, TODAY)).toBe(3);
  });

  it("menolak insufficient_stock bila stok hari ini jadi negatif (BR-16)", async () => {
    const res = await put({
      date: "2026-11-09",
      mode: "quantity",
      lines: [line(ids.sabun!, "qty", 500)],
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: { code: string; lines: { message: string }[] };
    };
    expect(body.error.code).toBe("insufficient_stock");
    expect(body.error.lines[0]!.message).toContain("Stok tercatat hanya");
  });

  it("rencana aktif pindah ke sold_out saat stok jadi 0", async () => {
    const plan = await db
      .insert(actionPlans)
      .values({
        storeId,
        productId: ids.sabun!,
        source: "template",
        state: "active",
        productStatusAtGeneration: "sekarat",
        rationale: "uji",
        startedOn: "2026-11-05",
        lockedValueAtStart: 15_000,
        currentStep: 1,
      })
      .returning();

    const res = await put({
      date: TODAY,
      mode: "quantity",
      lines: [line(ids.sabun!, "qty", 4)],
    });
    expect(res.status).toBe(200);
    const after = await db
      .select()
      .from(actionPlans)
      .where(eq(actionPlans.id, plan[0]!.id));
    expect(after[0]!.state).toBe("sold_out");
    expect(after[0]!.endedOn).toBe(TODAY);
  });
});

describe("PUT /sales/recap — idempotensi", () => {
  it("key sama diputar ulang, tidak menulis dua kali", async () => {
    const key = crypto.randomUUID();
    const body = {
      date: "2026-11-07",
      mode: "quantity",
      lines: [line(ids.kecap!, "qty", 6)],
    };
    const first = (await (await put(body, key)).json()) as Result;
    const second = (await (await put(body, key)).json()) as Result;
    expect(second).toEqual(first);
    expect(await salesQty(ids.kecap!, "2026-11-07")).toBe(6);
  });

  it("key yang sudah dipakai endpoint lain → 409 idempotency_key_reused", async () => {
    const key = crypto.randomUUID();
    await db.execute(
      // Endpoint lain menulis lebih dulu dengan key yang sama.
      (await import("drizzle-orm"))
        .sql`INSERT INTO idempotency_keys (store_id, key, endpoint, status_code, response_body)
        VALUES (${storeId}, ${key}, 'POST /products', 201, '{}'::jsonb)`,
    );
    const res = await put(
      { date: TODAY, mode: "quantity", lines: [line(ids.kecap!, "qty", 1)] },
      key,
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("idempotency_key_reused");
  });

  it("menolak tanpa Idempotency-Key", async () => {
    const res = await put(
      { date: TODAY, mode: "quantity", lines: [line(ids.kecap!, "qty", 1)] },
      null,
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /sales/recap — validasi", () => {
  const ok = { date: TODAY, mode: "quantity", lines: [line("", "qty", 1)] };

  it("menolak tanggal di masa depan", async () => {
    const res = await put({
      ...ok,
      date: "2026-11-10",
      lines: [line(ids.kecap!, "qty", 1)],
    });
    expect(res.status).toBe(400);
  });

  it("menolak tanggal lebih dari 365 hari lalu", async () => {
    const res = await put({
      ...ok,
      date: "2024-01-01",
      lines: [line(ids.kecap!, "qty", 1)],
    });
    expect(res.status).toBe(400);
  });

  it("menolak productId berulang", async () => {
    const res = await put({
      date: TODAY,
      mode: "quantity",
      lines: [line(ids.kecap!, "qty", 1), line(ids.kecap!, "qty", 2)],
    });
    expect(res.status).toBe(400);
  });

  it("menolak baris tanpa qty pada mode quantity", async () => {
    const res = await put({
      date: TODAY,
      mode: "quantity",
      lines: [{ productId: ids.kecap!, countedStock: 3 }],
    });
    expect(res.status).toBe(400);
  });

  it("menolak lebih dari 600 baris", async () => {
    const lines = Array.from({ length: 601 }, () => line(ids.kecap!, "qty", 1));
    const res = await put({ date: TODAY, mode: "quantity", lines });
    expect(res.status).toBe(400);
  });
});
