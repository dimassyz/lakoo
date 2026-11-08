// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import { products, stockIns, stores } from "../../../../database/src/schema.ts";
import { createApp } from "../app.ts";

const ORIGIN = "https://lakoo.test";
const NOW = new Date("2026-11-09T03:00:00Z");
/** Karakter zero-width (U+200B) tanpa literal tak terlihat di sumber. */
const ZW = String.fromCharCode(0x200b);

let db: AnyDb;
let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;
let cookie = "";
let storeId = "";

interface Summary {
  id: string;
  name: string;
  sellPrice: number;
  lockedValue: number;
  priorityScore: number | null;
}

interface ErrorBody {
  error: { code: string; fields?: Record<string, string> };
}

const req = (path: string, method = "GET", body?: unknown) =>
  Promise.resolve(
    app.request(`/api/v1${path}`, {
      method,
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );

/** POST /products ringkas untuk persiapan data uji. */
const buatProduk = (name: string) =>
  req("/products", "POST", {
    name,
    costPrice: 1_000,
    sellPrice: 2_000,
    openingStock: 1,
  });

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
  app = createApp({ db, allowedOrigins: [ORIGIN], now: () => NOW });

  const registered = await req("/auth/register", "POST", {
    storeName: "Toko QA",
    email: "qa@contoh.id",
    password: "rahasia123",
  });
  // req() menyertakan cookie kosong; register tetap harus 201.
  expect(registered.status).toBe(201);
  cookie = (
    registered.headers
      .getSetCookie()
      .find((c) => c.startsWith("lakoo_session=")) ?? ""
  ).split(";")[0] as string;
  storeId = (await db.select().from(stores).limit(1))[0]!.id;
}, 120_000);

afterAll(async () => {
  await close();
});

describe("QA-9 F1 — harga di atas Rp100 juta ditolak 400, bukan 500", () => {
  it("sellPrice 100.000.001 pada POST → 400 validation_error", async () => {
    const res = await req("/products", "POST", {
      name: "Barang Mahal A",
      costPrice: 1_000,
      sellPrice: 100_000_001,
      openingStock: 1,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("validation_error");
    expect(body.error.fields?.sellPrice).toBeDefined();
  });

  it("costPrice raksasa (dulu overflow int4 → 500) → 400", async () => {
    const res = await req("/products", "POST", {
      name: "Barang Mahal B",
      costPrice: 999_999_999_999,
      sellPrice: 1_000,
      openingStock: 1,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("validation_error");
  });

  it("harga tepat Rp100 juta tetap diterima", async () => {
    const res = await req("/products", "POST", {
      name: "Barang Pas Batas",
      costPrice: 100_000_000,
      sellPrice: 100_000_000,
      openingStock: 1,
    });
    expect(res.status).toBe(201);
  });

  it("PATCH sellPrice di atas batas (termasuk maks lama 1 miliar) → 400", async () => {
    const created = await req("/products", "POST", {
      name: "Barang Ubah Harga",
      costPrice: 1_000,
      sellPrice: 2_000,
      openingStock: 1,
    });
    const { id } = (await created.json()) as Summary;

    for (const sellPrice of [100_000_001, 1_000_000_000]) {
      const res = await req(`/products/${id}`, "PATCH", { sellPrice });
      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorBody;
      expect(body.error.code).toBe("validation_error");
    }

    const ok = await req(`/products/${id}`, "PATCH", {
      sellPrice: 100_000_000,
    });
    expect(ok.status).toBe(200);
  });
});

describe("QA-9 F3/F4 + QA-2 B6/B7 — higiene nama produk", () => {
  it("nama hanya spasi ditolak 400", async () => {
    const res = await req("/products", "POST", {
      name: "   ",
      costPrice: 1_000,
      sellPrice: 2_000,
      openingStock: 1,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("validation_error");
    expect(body.error.fields?.name).toBeDefined();
  });

  it("nama disimpan ter-trim", async () => {
    const res = await buatProduk("  Kopi Sachet  ");
    expect(res.status).toBe(201);
    const body = (await res.json()) as Summary;
    expect(body.name).toBe("Kopi Sachet");
  });

  it("duplikat zero-width → 409 duplicate_product_name", async () => {
    const first = await buatProduk("Kopi Hitam");
    expect(first.status).toBe(201);

    const zw = await req("/products", "POST", {
      name: `Kopi Hitam${ZW}`,
      costPrice: 1_000,
      sellPrice: 2_000,
      openingStock: 1,
    });
    expect(zw.status).toBe(409);
    const body = (await zw.json()) as ErrorBody;
    expect(body.error.code).toBe("duplicate_product_name");
  });

  it("PATCH rename ke hanya-spasi → 400; ke duplikat zero-width → 409", async () => {
    const created = await buatProduk("Teh Melati");
    const { id } = (await created.json()) as Summary;

    const blank = await req(`/products/${id}`, "PATCH", { name: "   " });
    expect(blank.status).toBe(400);

    const dup = await req(`/products/${id}`, "PATCH", {
      name: `Kopi Hitam${ZW}`,
    });
    expect(dup.status).toBe(409);
    const body = (await dup.json()) as ErrorBody;
    expect(body.error.code).toBe("duplicate_product_name");
  });
});

/** Barang mati berstok awal 10, tertanggal 2026-08-01 (100 hari sebelum asOf). */
async function seedMati(
  name: string,
  nameKey: string,
  unitCost: number,
): Promise<void> {
  const created = await db
    .insert(products)
    .values({ storeId, name, nameKey, unit: "pcs", sellPrice: 150_000 })
    .returning();
  await db.insert(stockIns).values({
    storeId,
    productId: created[0]!.id,
    batchId: crypto.randomUUID(),
    receivedOn: "2026-08-01",
    qty: 10,
    unitCost,
    kind: "opening",
  });
}

describe("QA-5/QA-2 F4 — urutan prioritas SPEC §5.3 (skor → terkunci → nama)", () => {
  it("skor sama: uang terkunci lebih besar dulu, walau namanya belakangan", async () => {
    // Dua barang mati, umur sama (age jenuh di 1). Skor dibulatkan ke 100
    // untuk keduanya: 1.000.000 → 100 pas; 995.000 → 99,75 → 100.
    await seedMati("Aaa Terkunci Kecil", "aaa terkunci kecil", 99_500);
    await seedMati("Zzz Terkunci Besar", "zzz terkunci besar", 100_000);

    const res = await req("/products");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Summary[] };
    const names = body.items.map((item) => item.name);
    const besar = body.items.find((item) => item.name === "Zzz Terkunci Besar");
    const kecil = body.items.find((item) => item.name === "Aaa Terkunci Kecil");
    expect(besar?.priorityScore).not.toBeNull();
    expect(besar?.priorityScore).toBe(kecil?.priorityScore);
    expect(besar?.lockedValue).toBe(1_000_000);
    expect(kecil?.lockedValue).toBe(995_000);
    expect(names.indexOf("Zzz Terkunci Besar")).toBeLessThan(
      names.indexOf("Aaa Terkunci Kecil"),
    );
  });
});

describe("QA-8 F-10 — parameter limit pada GET /products", () => {
  it("limit membatasi jumlah item; tanpa limit semua kembali", async () => {
    const all = (await (await req("/products")).json()) as {
      items: Summary[];
    };
    expect(all.items.length).toBeGreaterThanOrEqual(3);

    const limited = (await (await req("/products?limit=2")).json()) as {
      items: Summary[];
    };
    expect(limited.items).toHaveLength(2);
    expect(limited.items.map((item) => item.id)).toEqual(
      all.items.slice(0, 2).map((item) => item.id),
    );
  });

  it("limit tidak valid → 400", async () => {
    for (const bad of ["0", "-1", "abc", "501"]) {
      const res = await req(`/products?limit=${bad}`);
      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorBody;
      expect(body.error.code).toBe("validation_error");
      expect(body.error.fields?.limit).toBeDefined();
    }
  });
});
