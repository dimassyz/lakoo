// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  dailySales,
  products,
  stores,
} from "../../../../database/src/schema.ts";
import { createApp } from "../app.ts";
import { sql } from "drizzle-orm";
import { createStockInBatch } from "../../repo/stockIns.ts";

const ORIGIN = "https://lakoo.test";
const NOW = new Date("2026-11-09T03:00:00Z"); // 10:00 WIB
const TODAY = "2026-11-09";

let db: AnyDb;
let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;
let cookie = "";
let storeId = "";
let kecapId = "";

interface Item {
  id: string;
  batchId: string;
  productId: string;
  productName: string;
  receivedOn: string;
  qty: number;
  unitCost: number;
  createdAt: string;
  editable: boolean;
}

const req = (path: string, method = "GET", body?: unknown, key?: string) =>
  Promise.resolve(
    app.request(`/api/v1${path}`, {
      method,
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie,
        ...(key === undefined ? {} : { "idempotency-key": key }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );

const post = (body: unknown, key: string | null = crypto.randomUUID()) =>
  Promise.resolve(
    app.request("/api/v1/stock-ins", {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie,
        ...(key === null ? {} : { "idempotency-key": key }),
      },
      body: JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
  app = createApp({ db, allowedOrigins: [ORIGIN], now: () => NOW });

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
  kecapId = (
    await db
      .insert(products)
      .values({
        storeId,
        name: "Kecap",
        nameKey: "kecap",
        unit: "botol",
        sellPrice: 20_000,
      })
      .returning()
  )[0]!.id;
}, 120_000);

afterAll(async () => {
  await close();
});

describe("POST /stock-ins — satu nota banyak baris", () => {
  it("menyimpan batch dengan satu batchId dan barang baru sekaligus", async () => {
    const res = await post({
      receivedOn: "2026-11-08",
      lines: [
        { productId: kecapId, qty: 24, unitCost: 3_100 },
        {
          newProduct: { name: "Teh Celup", sellPrice: 7_500 },
          qty: 10,
          unitCost: 6_200,
        },
      ],
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { batchId: string; items: Item[] };
    expect(body.items).toHaveLength(2);
    expect(new Set(body.items.map((item) => item.batchId))).toEqual(
      new Set([body.batchId]),
    );
    expect(body.items.map((item) => item.productName).sort()).toEqual([
      "Kecap",
      "Teh Celup",
    ]);
  });

  it("barang baru dibuat tanpa baris opening", async () => {
    const rows = await db.select().from(products);
    const teh = rows.find((row) => row.name === "Teh Celup");
    expect(teh).toBeDefined();
    const items = (await (
      await req("/stock-ins?productId=" + teh!.id)
    ).json()) as {
      items: Item[];
    };
    expect(items.items).toHaveLength(1);
    expect(items.items[0]!.qty).toBe(10);
  });
});

describe("POST /stock-ins — barang baru", () => {
  it("menolak baris yang mengisi keduanya (productId dan newProduct)", async () => {
    const res = await post({
      receivedOn: TODAY,
      lines: [
        {
          productId: kecapId,
          newProduct: { name: "Ganda", sellPrice: 1_000 },
          qty: 1,
          unitCost: 500,
        },
      ],
    });
    expect(res.status).toBe(400);
  });

  it("menolak nama barang baru yang sudah ada (422 duplicate_product_name)", async () => {
    const res = await post({
      receivedOn: TODAY,
      lines: [
        {
          newProduct: { name: "Kecap", sellPrice: 1_000 },
          qty: 1,
          unitCost: 500,
        },
      ],
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: { code: string; lines: { index: number }[] };
    };
    expect(body.error.code).toBe("duplicate_product_name");
    expect(body.error.lines[0]!.index).toBe(0);
  });
});

describe("POST /stock-ins — name_key lintas jalur", () => {
  it("mengenali nama dari POST /products walau beda spasi dan huruf", async () => {
    const created = await req("/products", "POST", {
      name: "Kecap Manis 600ml",
      unit: "botol",
      sellPrice: 15_000,
      costPrice: 12_000,
      openingStock: 3,
    });
    expect(created.status).toBe(201);

    // Spasi berlebih + huruf kecil: name_key harus sama (SPEC §4.1).
    const res = await post({
      receivedOn: TODAY,
      lines: [
        {
          newProduct: { name: "  kecap   manis 600ml  ", sellPrice: 15_000 },
          qty: 1,
          unitCost: 12_000,
        },
      ],
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("duplicate_product_name");
  });
});

describe("POST /stock-ins — validasi dan idempotensi", () => {
  it("menolak tanggal di masa depan dan lebih dari 365 hari", async () => {
    const future = await post({
      receivedOn: "2026-11-10",
      lines: [{ productId: kecapId, qty: 1, unitCost: 1 }],
    });
    expect(future.status).toBe(400);
    const old = await post({
      receivedOn: "2024-01-01",
      lines: [{ productId: kecapId, qty: 1, unitCost: 1 }],
    });
    expect(old.status).toBe(400);
  });

  it("menolak lebih dari 100 baris", async () => {
    const lines = Array.from({ length: 101 }, () => ({
      productId: kecapId,
      qty: 1,
      unitCost: 1,
    }));
    expect((await post({ receivedOn: TODAY, lines })).status).toBe(400);
  });

  it("idempotensi: key sama tidak menulis dua kali", async () => {
    const key = crypto.randomUUID();
    const body = {
      receivedOn: "2026-11-07",
      lines: [{ productId: kecapId, qty: 5, unitCost: 3_000 }],
    };
    const first = (await (await post(body, key)).json()) as { batchId: string };
    const second = (await (await post(body, key)).json()) as {
      batchId: string;
    };
    expect(second.batchId).toBe(first.batchId);
  });

  it("menolak tanpa Idempotency-Key", async () => {
    const res = await post(
      {
        receivedOn: TODAY,
        lines: [{ productId: kecapId, qty: 1, unitCost: 1 }],
      },
      null,
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /stock-ins", () => {
  it("bawaan 30 hari terakhir, urut receivedOn DESC", async () => {
    const body = (await (await req("/stock-ins")).json()) as { items: Item[] };
    expect(body.items.length).toBeGreaterThan(0);
    const dates = body.items.map((item) => item.receivedOn);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });

  it("menyaring per productId", async () => {
    const body = (await (
      await req(`/stock-ins?productId=${kecapId}`)
    ).json()) as {
      items: Item[];
    };
    expect(body.items.every((item) => item.productId === kecapId)).toBe(true);
  });

  it("menolak from setelah to", async () => {
    expect((await req("/stock-ins?from=2026-11-09&to=2026-11-01")).status).toBe(
      400,
    );
  });

  it("menandai editable untuk baris baru", async () => {
    const body = (await (await req("/stock-ins")).json()) as { items: Item[] };
    expect(body.items[0]!.editable).toBe(true);
  });
});

describe("PATCH /stock-ins/{id}", () => {
  it("mengoreksi qty dan unitCost", async () => {
    const created = (await (
      await post({
        receivedOn: "2026-11-06",
        lines: [{ productId: kecapId, qty: 8, unitCost: 2_000 }],
      })
    ).json()) as { items: Item[] };
    const id = created.items[0]!.id;

    const res = await req(`/stock-ins/${id}`, "PATCH", {
      qty: 9,
      unitCost: 2_500,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Item;
    expect(body.qty).toBe(9);
    expect(body.unitCost).toBe(2_500);
  });

  it("menolak koreksi yang membuat stok hari mana pun negatif (422)", async () => {
    const created = (await (
      await post({
        receivedOn: "2026-11-05",
        lines: [{ productId: kecapId, qty: 10, unitCost: 2_000 }],
      })
    ).json()) as { items: Item[] };
    const id = created.items[0]!.id;

    // Terjual 10 pada 5 Nov: kalau qty masuk diturunkan jadi 1, stok jadi negatif.
    await db.insert(dailySales).values({
      storeId,
      productId: kecapId,
      saleDate: "2026-11-05",
      qty: 10,
      unitPrice: 20_000,
      source: "quantity",
    });

    const res = await req(`/stock-ins/${id}`, "PATCH", { qty: 1 });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("insufficient_stock");

    // Transaksi dibatalkan: qty tetap 10.
    const after = (await (
      await req(`/stock-ins?productId=${kecapId}`)
    ).json()) as {
      items: Item[];
    };
    expect(after.items.find((item) => item.id === id)?.qty).toBe(10);
  });
});

describe("PATCH /stock-ins/{id} — penolakan", () => {
  it("404 untuk baris milik toko lain / tidak ada", async () => {
    const res = await req(`/stock-ins/${crypto.randomUUID()}`, "PATCH", {
      qty: 1,
    });
    expect(res.status).toBe(404);
  });

  it("409 edit_window_closed untuk baris lebih dari 7 hari", async () => {
    const created = (await (
      await post({
        receivedOn: "2026-10-01",
        lines: [{ productId: kecapId, qty: 3, unitCost: 1_000 }],
      })
    ).json()) as { items: Item[] };
    const id = created.items[0]!.id;
    // Mundurkan createdAt melewati jendela 7 hari.
    const { sql } = await import("drizzle-orm");
    await db.execute(
      sql`UPDATE stock_ins SET created_at = ${NOW.toISOString()}::timestamptz - interval '8 days' WHERE id = ${id}`,
    );

    const res = await req(`/stock-ins/${id}`, "PATCH", { qty: 4 });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("edit_window_closed");
  });
});

/** Skenario W-2: tambah baris masuk, jual hampir semua, coba hapus baris itu. */
async function hapusMembuatStokNegatif(productId: string) {
  const detail = (await (await req(`/products/${productId}`)).json()) as {
    stock: number;
  };
  // Q = stok sekarang + 10, lalu jual sampai sisa 2 → hapus baris Q = stok negatif,
  // apa pun baseline fixture.
  const qty = detail.stock + 10;
  await post({
    receivedOn: "2026-11-04",
    lines: [{ productId, qty, unitCost: 1_000 }],
  });
  const sold = await req(
    "/sales/recap",
    "PUT",
    { date: TODAY, mode: "quantity", lines: [{ productId, qty: qty - 2 }] },
    crypto.randomUUID(),
  );
  expect(sold.status).toBe(200);
  return qty;
}

describe("DELETE /stock-ins/{id}", () => {
  it("menghapus baris dalam jendela dan mengembalikan 204", async () => {
    const created = (await (
      await post({
        receivedOn: "2026-11-04",
        lines: [{ productId: kecapId, qty: 2, unitCost: 1_000 }],
      })
    ).json()) as { items: Item[] };
    const id = created.items[0]!.id;

    const res = await req(`/stock-ins/${id}`, "DELETE");
    expect(res.status).toBe(204);

    const after = (await (
      await req(`/stock-ins?productId=${kecapId}`)
    ).json()) as {
      items: Item[];
    };
    expect(after.items.some((item) => item.id === id)).toBe(false);
  });

  it("404 untuk id yang tidak ada", async () => {
    expect(
      (await req(`/stock-ins/${crypto.randomUUID()}`, "DELETE")).status,
    ).toBe(404);
  });

  it("W-2: hapus yang membuat stok negatif ditolak 422, baris tetap ada", async () => {
    const qty = await hapusMembuatStokNegatif(kecapId);
    const list = (await (
      await req(`/stock-ins?productId=${kecapId}`)
    ).json()) as {
      items: Item[];
    };
    const target = list.items.find((item) => item.qty === qty);
    expect(target).toBeDefined();

    const res = await req(`/stock-ins/${target!.id}`, "DELETE");
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("insufficient_stock");

    // Baris tidak terhapus — transaksi dibatalkan.
    const after = (await (
      await req(`/stock-ins?productId=${kecapId}`)
    ).json()) as {
      items: Item[];
    };
    expect(after.items.some((item) => item.id === target!.id)).toBe(true);
  });
});

describe("stock-ins — sesi", () => {
  it("mewajibkan sesi", async () => {
    const res = await Promise.resolve(app.request("/api/v1/stock-ins"));
    expect(res.status).toBe(401);
  });
});

describe("W-1 — rekaman idempotensi ada di transaksi yang sama", () => {
  it("gagal menulis rekaman → stok masuk ikut dibatalkan", async () => {
    // `idempotency_keys.key` bertipe uuid, jadi kunci non-UUID gagal DI DALAM tx.
    await expect(
      createStockInBatch(
        db,
        storeId,
        TODAY,
        [{ productId: kecapId, qty: 7, unitCost: 1_000 }],
        NOW,
        { key: "bukan-uuid", endpoint: "/stock-ins", statusCode: 201 },
      ),
    ).rejects.toThrow();

    // Kalau rekaman ditulis di luar tx, baris stok 7 tadi sudah terlanjur commit.
    const counted = await db.execute(
      sql`SELECT COUNT(*) AS n FROM stock_ins WHERE product_id = ${kecapId} AND qty = 7`,
    );
    expect(Number((counted.rows[0] as { n: unknown }).n)).toBe(0);
  });
});

describe("23505 — jaring saat pre-check route kalah balapan", () => {
  it("dua POST bersamaan nama sama → 201 + 409, bukan 500", async () => {
    // Pre-check route (`nameKeyTaken`) membaca sebelum menulis. Dua request
    // bersamaan bisa sama-sama lolos lalu salah satu kena partial unique index
    // `products_store_id_name_key_key`. Yang sampai ke klien harus 409 yang
    // bisa dibaca, bukan 500 mentah — mapping ada di `handleError` (app.ts).
    const name = `Balapan ${crypto.randomUUID()}`;
    const body = {
      receivedOn: TODAY,
      lines: [
        {
          newProduct: { name, unit: "pcs", sellPrice: 5_000 },
          qty: 1,
          unitCost: 1_000,
        },
      ],
    };
    const results = await Promise.all([post(body), post(body)]);

    const codes = results.map((r) => r.status).sort();
    expect(codes).toEqual([201, 409]);
    const conflict = results.find((r) => r.status === 409);
    expect((await conflict!.json()).error.code).toBe("duplicate_product_name");
  });
});
