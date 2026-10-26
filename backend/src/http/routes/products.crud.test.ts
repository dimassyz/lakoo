// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  actionPlans,
  stockAdjustments,
} from "../../../../database/src/schema.ts";
import { createApp } from "../app.ts";

const ORIGIN = "https://lakoo.test";
const NOW = new Date("2026-11-09T03:00:00Z");

let db: AnyDb;
let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;
let cookie = "";
let otherCookie = "";

interface Detail {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  sellPrice: number;
  lastCost: number;
  stock: number;
  status: string;
  archived: boolean;
  isComplementary: boolean;
  complementaryMaxStock: number | null;
  weekQty: number[];
  firstStockDate: string | null;
  createdAt: string;
}

const req = (
  path: string,
  method: string,
  body?: unknown,
  withCookie = cookie,
) =>
  Promise.resolve(
    app.request(`/api/v1${path}`, {
      method,
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: withCookie,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );

async function register(email: string, storeName: string): Promise<string> {
  const res = await Promise.resolve(
    app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ storeName, email, password: "rahasia123" }),
    }),
  );
  return (
    res.headers.getSetCookie().find((c) => c.startsWith("lakoo_session=")) ?? ""
  ).split(";")[0] as string;
}

/** Rencana `suggested` langsung di DB — jalur API menolak barang sehat. */
async function insertSuggestedPlan(productId: string): Promise<void> {
  const product = (
    await db.execute(
      sql`SELECT store_id FROM products WHERE id = ${productId} LIMIT 1`,
    )
  ).rows[0] as { store_id: string } | undefined;
  await db.insert(actionPlans).values({
    storeId: product!.store_id,
    productId,
    source: "template",
    state: "suggested",
    productStatusAtGeneration: "mati",
    rationale: "uji",
    currentStep: null,
  });
}

async function createProduct(
  name: string,
  sellPrice = 20_000,
): Promise<Detail> {
  const res = await req("/products", "POST", {
    name,
    costPrice: 12_000,
    sellPrice,
    openingStock: 10,
  });
  expect(res.status).toBe(201);
  return (await res.json()) as Detail;
}

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
  app = createApp({ db, allowedOrigins: [ORIGIN], now: () => NOW, env: {} });
  cookie = await register("sri@contoh.id", "Toko Bu Sri");
  otherCookie = await register("budi@contoh.id", "Toko Pak Budi");
}, 120_000);

afterAll(async () => {
  await close();
});

describe("GET /products/{productId}", () => {
  it("mengembalikan ProductDetail", async () => {
    const created = await createProduct("Kecap Manis");
    const res = await req(`/products/${created.id}`, "GET");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Detail;
    expect(body).toMatchObject({
      id: created.id,
      name: "Kecap Manis",
      stock: 10,
      lastCost: 12_000,
    });
    expect(body.weekQty).toHaveLength(7);
  });

  it("404 untuk barang milik toko lain (IDOR)", async () => {
    const created = await createProduct("Saus Tiram");
    const res = await req(
      `/products/${created.id}`,
      "GET",
      undefined,
      otherCookie,
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /products/{productId}", () => {
  it("mengubah harga jual dan satuan", async () => {
    const created = await createProduct("Gula Pasir");
    const res = await req(`/products/${created.id}`, "PATCH", {
      sellPrice: 25_000,
      unit: "kg",
      category: "Sembako",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Detail;
    expect(body).toMatchObject({
      sellPrice: 25_000,
      unit: "kg",
      category: "Sembako",
    });
  });

  it("409 bila nama baru sudah dipakai barang aktif lain", async () => {
    await createProduct("Kopi Bubuk");
    const target = await createProduct("Teh Celup");
    const res = await req(`/products/${target.id}`, "PATCH", {
      name: "Kopi Bubuk",
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("duplicate_product_name");
  });

  it("400 untuk body kosong", async () => {
    const created = await createProduct("Merica");
    expect((await req(`/products/${created.id}`, "PATCH", {})).status).toBe(
      400,
    );
  });

  it("menandai pelengkap menghapus rencana suggested", async () => {
    const created = await createProduct("Es Batu");
    // Rencana disisipkan langsung: barang sehat tidak bisa dibuatkan rencana
    // lewat API (409 plan_not_applicable), tapi pembersihannya tetap harus diuji.
    await insertSuggestedPlan(created.id);

    await req(`/products/${created.id}`, "PATCH", { isComplementary: true });
    const plans = await db
      .select()
      .from(actionPlans)
      .where(eq(actionPlans.productId, created.id));
    expect(plans).toHaveLength(0);
  });
});

describe("POST /products/{productId}/archive", () => {
  it("mengarsipkan lalu memulihkan", async () => {
    const created = await createProduct("Barang Lama");

    const archived = await req(`/products/${created.id}/archive`, "POST", {
      archived: true,
    });
    expect(archived.status).toBe(200);
    expect(((await archived.json()) as Detail).archived).toBe(true);

    const list = (await (await req("/products", "GET")).json()) as {
      items: Detail[];
    };
    expect(list.items.some((item) => item.id === created.id)).toBe(false);
    const withArchived = (await (
      await req("/products?includeArchived=true", "GET")
    ).json()) as { items: Detail[] };
    expect(withArchived.items.some((item) => item.id === created.id)).toBe(
      true,
    );

    const restored = await req(`/products/${created.id}/archive`, "POST", {
      archived: false,
    });
    expect(restored.status).toBe(200);
    expect(((await restored.json()) as Detail).archived).toBe(false);
  });
});

describe("POST /products/{productId}/archive — efek pada rencana", () => {
  it("menghentikan rencana aktif", async () => {
    const created = await createProduct("Barang Ditinggal");
    await insertSuggestedPlan(created.id);
    const plan = (
      await db
        .select()
        .from(actionPlans)
        .where(eq(actionPlans.productId, created.id))
    )[0]!;
    await db
      .update(actionPlans)
      .set({
        state: "active",
        startedOn: "2026-11-09",
        lockedValueAtStart: 120_000,
      })
      .where(eq(actionPlans.id, plan.id));

    await req(`/products/${created.id}/archive`, "POST", { archived: true });
    const rows = await db
      .select()
      .from(actionPlans)
      .where(eq(actionPlans.id, plan.id));
    expect(rows[0]?.state).toBe("stopped");
  });

  it("409 saat memulihkan bila namanya kini dipakai barang aktif lain", async () => {
    const first = await createProduct("Nama Rebutan");
    await req(`/products/${first.id}/archive`, "POST", { archived: true });
    await createProduct("Nama Rebutan");

    const res = await req(`/products/${first.id}/archive`, "POST", {
      archived: false,
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /products/{productId}/stock-adjustments", () => {
  it("menurunkan stok ke angka hitungan fisik", async () => {
    const created = await createProduct("Beras 5kg");
    const res = await req(`/products/${created.id}/stock-adjustments`, "POST", {
      countedStock: 7,
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as Detail).stock).toBe(7);

    const rows = await db
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.productId, created.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.qtyDelta).toBe(-3);
  });

  it("menaikkan stok bila hitungan fisik lebih besar", async () => {
    const created = await createProduct("Minyak 1L");
    const body = (await (
      await req(`/products/${created.id}/stock-adjustments`, "POST", {
        countedStock: 15,
      })
    ).json()) as Detail;
    expect(body.stock).toBe(15);
  });

  it("delta 0 tidak membuat baris", async () => {
    const created = await createProduct("Garam");
    const res = await req(`/products/${created.id}/stock-adjustments`, "POST", {
      countedStock: 10,
    });
    expect(res.status).toBe(200);
    const rows = await db
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.productId, created.id));
    expect(rows).toHaveLength(0);
  });

  it("400 untuk hitungan negatif", async () => {
    const created = await createProduct("Kunyit");
    expect(
      (
        await req(`/products/${created.id}/stock-adjustments`, "POST", {
          countedStock: -1,
        })
      ).status,
    ).toBe(400);
  });
});

describe("W-8 — id di path bukan UUID", () => {
  it("404, bukan 500 dari parser uuid Postgres", async () => {
    const res = await req("/products/bukan-uuid", "GET");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });
});

describe("23505 — unique violation dari balapan, bukan 500", () => {
  it("INSERT produk dengan name_key yang sudah ada → 409, bukan 500", async () => {
    // Pre-check `findLiveProductByNameKey` bisa kalah balapan: dua request
    // bersamaan sama-sama lolos lalu INSERT kena partial unique index
    // `products_store_id_name_key_key`. Yang harus sampai ke klien adalah
    // 409 yang bisa dibaca, bukan 500 mentah.
    const name = `Balapan ${crypto.randomUUID()}`;
    await createProduct(name);
    const res = await req("/products", "POST", {
      name,
      unit: "pcs",
      costPrice: 12_000,
      sellPrice: 20_000,
      openingStock: 10,
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("duplicate_product_name");
  });
});
