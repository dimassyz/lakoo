// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import { createApp } from "../app.ts";

const ORIGIN = "https://lakoo.test";
const NOW = new Date("2026-11-09T03:00:00Z");

let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;
let cookie = "";

const post = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  Promise.resolve(
    app.request(`/api/v1${path}`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );

const get = (path: string) =>
  Promise.resolve(app.request(`/api/v1${path}`, { headers: { cookie } }));

interface Summary {
  id: string;
  name: string;
  unit: string;
  stock: number;
  sellPrice: number;
  lastCost: number;
  lockedValue: number;
  status: string;
  sold28: number;
  priorityScore: number | null;
  reason: string | null;
  archived: boolean;
  planState: string | null;
}

beforeAll(async () => {
  const { client, db } = await createTestDb();
  app = createApp({
    db: db as AnyDb,
    allowedOrigins: [ORIGIN],
    now: () => NOW,
  });
  close = () => client.close();

  const registered = await post("/auth/register", {
    storeName: "Toko Bu Sri",
    email: "sri@contoh.id",
    password: "rahasia123",
  });
  if (registered.status !== 201)
    throw new Error(`register gagal: ${registered.status}`);
  cookie = (
    registered.headers
      .getSetCookie()
      .find((c) => c.startsWith("lakoo_session=")) ?? ""
  ).split(";")[0] as string;
}, 120_000);

afterAll(async () => {
  await close();
});

describe("POST /products", () => {
  it("membuat barang dan mengembalikan 201", async () => {
    const res = await post(
      "/products",
      {
        name: "Kecap Manis 600ml",
        costPrice: 12_000,
        sellPrice: 20_000,
        openingStock: 10,
      },
      { cookie },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Summary;
    expect(body).toMatchObject({
      name: "Kecap Manis 600ml",
      unit: "pcs",
      stock: 10,
      lastCost: 12_000,
      sellPrice: 20_000,
    });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("POST /products — nama duplikat & field asing", () => {
  it("menolak nama duplikat case/spasi-insensitive dengan 409", async () => {
    const res = await post(
      "/products",
      {
        name: "  kecap   manis 600ML ",
        costPrice: 1,
        sellPrice: 2,
        openingStock: 1,
      },
      { cookie },
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: {
        code: string;
        fields?: Record<string, string>;
        existingProductId?: string;
      };
    };
    expect(body.error.code).toBe("duplicate_product_name");
    expect(body.error.fields?.name).toBeDefined();
    expect(body.error.existingProductId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("menolak field tak dikenal dan tipe salah dengan 400", async () => {
    const extra = await post(
      "/products",
      {
        name: "Gula",
        costPrice: 1,
        sellPrice: 2,
        openingStock: 1,
        warna: "merah",
      },
      { cookie },
    );
    expect(extra.status).toBe(400);

    const negative = await post(
      "/products",
      { name: "Gula", costPrice: -1, sellPrice: 2, openingStock: 1 },
      { cookie },
    );
    expect(negative.status).toBe(400);

    const tooMany = await post(
      "/products",
      { name: "Gula", costPrice: 1, sellPrice: 2, openingStock: 100_001 },
      { cookie },
    );
    expect(tooMany.status).toBe(400);
  });
});

describe("POST /products — validasi input", () => {
  it("menerima harga jual di bawah harga beli (UI yang memperingatkan)", async () => {
    const res = await post(
      "/products",
      {
        name: "Barang Rugi",
        costPrice: 5_000,
        sellPrice: 1_000,
        openingStock: 2,
      },
      { cookie },
    );
    expect(res.status).toBe(201);
  });

  it("mewajibkan sesi", async () => {
    const res = await post("/products", {
      name: "X",
      costPrice: 1,
      sellPrice: 1,
      openingStock: 0,
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /products", () => {
  it("mengembalikan items + asOf dan stok awal terhitung", async () => {
    const res = await get("/products");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { asOf: string; items: Summary[] };
    expect(body.asOf).toBe("2026-11-09");
    const kecap = body.items.find((item) => item.name === "Kecap Manis 600ml");
    expect(kecap).toBeDefined();
    expect(kecap?.stock).toBe(10);
    expect(kecap?.lockedValue).toBe(120_000);
    expect(kecap?.unit).toBe("pcs");
  });

  it("menyaring berdasarkan q (case-insensitive) dan status", async () => {
    const byQ = (await (await get("/products?q=KECAP")).json()) as {
      items: Summary[];
    };
    expect(byQ.items.map((item) => item.name)).toEqual(["Kecap Manis 600ml"]);

    const byStatus = (await (await get("/products?status=mati")).json()) as {
      items: Summary[];
    };
    expect(byStatus.items.every((item) => item.status === "mati")).toBe(true);
  });

  it("sort=frequent mengurutkan sold28 menurun", async () => {
    const body = (await (await get("/products?sort=frequent")).json()) as {
      items: Summary[];
    };
    const sold = body.items.map((item) => item.sold28);
    expect(sold).toEqual([...sold].sort((a, b) => b - a));
  });

  it("menolak sort tak dikenal dengan 400", async () => {
    const res = await get("/products?sort=termahal");
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; fields?: Record<string, string> };
    };
    expect(body.error.code).toBe("validation_error");
    expect(body.error.fields?.sort).toBeDefined();
  });

  it("menolak q lebih dari 80 karakter", async () => {
    const res = await get(`/products?q=${"a".repeat(81)}`);
    expect(res.status).toBe(400);
  });

  it("mewajibkan sesi", async () => {
    const res = await Promise.resolve(app.request("/api/v1/products"));
    expect(res.status).toBe(401);
  });
});

describe("isolasi antar toko (IDOR)", () => {
  it("toko lain tidak melihat barang toko pertama", async () => {
    const other = await post("/auth/register", {
      storeName: "Toko Lain",
      email: "lain@contoh.id",
      password: "rahasia123",
    });
    const otherCookie = (
      other.headers
        .getSetCookie()
        .find((c) => c.startsWith("lakoo_session=")) ?? ""
    ).split(";")[0] as string;

    const res = await Promise.resolve(
      app.request("/api/v1/products", { headers: { cookie: otherCookie } }),
    );
    const body = (await res.json()) as { items: Summary[] };
    expect(body.items).toEqual([]);
  });

  it("nama yang sama boleh dipakai toko berbeda", async () => {
    const other = await post("/auth/login", {
      email: "lain@contoh.id",
      password: "rahasia123",
    });
    const otherCookie = (
      other.headers
        .getSetCookie()
        .find((c) => c.startsWith("lakoo_session=")) ?? ""
    ).split(";")[0] as string;

    const res = await post(
      "/products",
      {
        name: "Kecap Manis 600ml",
        costPrice: 1,
        sellPrice: 2,
        openingStock: 1,
      },
      { cookie: otherCookie },
    );
    expect(res.status).toBe(201);
  });
});
