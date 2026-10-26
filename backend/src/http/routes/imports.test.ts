// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
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
let existingId = "";

interface ImportResult {
  mode: string;
  totalRows: number;
  validRows: number;
  invalidRows: { index: number; code: string; message: string }[];
  created: number;
  updated: number;
  skipped: number;
}

const req = (path: string, body: unknown) =>
  Promise.resolve(
    app.request(`/api/v1${path}`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    }),
  );

const productRows = () =>
  db.select().from(products).where(eq(products.storeId, storeId));
const stockRows = () =>
  db.select().from(stockIns).where(eq(stockIns.storeId, storeId));

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
      name: "Kopi Bubuk",
      nameKey: "kopi bubuk",
      unit: "pcs",
      sellPrice: 15_000,
    })
    .returning();
  existingId = inserted[0]!.id;
  await db.insert(stockIns).values({
    storeId,
    productId: existingId,
    batchId: crypto.randomUUID(),
    receivedOn: "2026-08-01",
    qty: 20,
    unitCost: 10_000,
    kind: "opening",
  });
}, 120_000);

afterAll(async () => {
  await close();
});

describe("POST /imports/products — preview", () => {
  it("tidak menulis apa pun", async () => {
    const before = (await productRows()).length;
    const res = await req("/imports/products", {
      mode: "preview",
      rows: [
        { name: "Teh Celup", costPrice: 5000, sellPrice: 8000, stock: 10 },
      ],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ImportResult;

    expect(body.validRows).toBe(1);
    expect(body.created).toBe(0);
    expect(body.updated).toBe(0);
    expect((await productRows()).length).toBe(before);
  });

  it("menghitung duplikat terhadap barang yang sudah ada sebagai skipped", async () => {
    const body = (await (
      await req("/imports/products", {
        mode: "preview",
        rows: [
          {
            name: "Kopi Bubuk",
            costPrice: 10_000,
            sellPrice: 16_000,
            stock: 0,
          },
        ],
      })
    ).json()) as ImportResult;
    expect(body.skipped).toBe(1);
    expect(body.created).toBe(0);
  });
});

describe("POST /imports/products — commit barang baru", () => {
  it("membuat barang baru + stok awal sebagai stock_ins opening", async () => {
    const res = await req("/imports/products", {
      mode: "commit",
      rows: [
        {
          name: "Teh Celup",
          costPrice: "5.000",
          sellPrice: "8000",
          stock: "10",
        },
      ],
    });
    const body = (await res.json()) as ImportResult;
    expect(body.created).toBe(1);

    const created = (await productRows()).find(
      (row) => row.name === "Teh Celup",
    );
    expect(created?.sellPrice).toBe(8000);
    // "5.000" dari file dibaca sebagai 5.000 rupiah, bukan 5,000.
    expect(created?.unit).toBe("pcs");

    const opening = (await stockRows()).find(
      (row) => row.productId === created!.id,
    );
    expect(opening?.qty).toBe(10);
    expect(opening?.unitCost).toBe(5000);
    expect(opening?.kind).toBe("opening");
    expect(opening?.receivedOn).toBe(TODAY);
  });

  it("stok 0 tetap membuat baris opening qty 0 sebagai basis lastCost", async () => {
    await req("/imports/products", {
      mode: "commit",
      rows: [
        { name: "Gula Pasir", costPrice: 12_000, sellPrice: 14_000, stock: 0 },
      ],
    });
    const created = (await productRows()).find(
      (row) => row.name === "Gula Pasir",
    );
    const rows = (await stockRows()).filter(
      (row) => row.productId === created!.id,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.qty).toBe(0);
    expect(rows[0]!.unitCost).toBe(12_000);
    expect(rows[0]!.kind).toBe("opening");
  });
});

describe("POST /imports/products — onDuplicate", () => {
  it("skip membiarkan harga lama", async () => {
    const body = (await (
      await req("/imports/products", {
        mode: "commit",
        onDuplicate: "skip",
        rows: [
          {
            name: "Kopi Bubuk",
            costPrice: 10_000,
            sellPrice: 99_000,
            stock: 0,
          },
        ],
      })
    ).json()) as ImportResult;
    expect(body.skipped).toBe(1);

    const row = (await productRows()).find((item) => item.id === existingId);
    expect(row?.sellPrice).toBe(15_000);
  });

  it("update_price memperbarui harga dan mencatat modal baru qty 0", async () => {
    const body = (await (
      await req("/imports/products", {
        mode: "commit",
        onDuplicate: "update_price",
        rows: [
          {
            name: "Kopi Bubuk",
            costPrice: 11_000,
            sellPrice: 16_000,
            stock: 0,
          },
        ],
      })
    ).json()) as ImportResult;
    expect(body.updated).toBe(1);

    const row = (await productRows()).find((item) => item.id === existingId);
    expect(row?.sellPrice).toBe(16_000);

    const zeroCost = (await stockRows()).filter(
      (item) => item.productId === existingId && item.qty === 0,
    );
    expect(zeroCost).toHaveLength(1);
    expect(zeroCost[0]!.unitCost).toBe(11_000);
  });
});

describe("POST /imports/products — name_key lintas jalur", () => {
  it("mengenali barang buatan POST /products lewat name_key yang dinormalkan", async () => {
    const created = await req("/products", {
      name: "Gula  Merah",
      unit: "kg",
      sellPrice: 18_000,
      costPrice: 15_000,
      openingStock: 5,
    });
    expect(created.status).toBe(201);

    const body = (await (
      await req("/imports/products", {
        mode: "commit",
        onDuplicate: "skip",
        rows: [
          {
            name: "  GULA merah ",
            costPrice: 15_000,
            sellPrice: 18_000,
            stock: 0,
          },
        ],
      })
    ).json()) as ImportResult;

    expect(body.skipped).toBe(1);
    expect(body.created).toBe(0);
    expect(
      (await productRows()).filter((row) => row.nameKey === "gula merah"),
    ).toHaveLength(1);
  });
});

describe("POST /imports/products — modal tidak berubah", () => {
  it("tidak menambah baris stock_ins", async () => {
    const before = (await stockRows()).filter(
      (item) => item.productId === existingId,
    ).length;
    await req("/imports/products", {
      mode: "commit",
      onDuplicate: "update_price",
      rows: [
        { name: "Kopi Bubuk", costPrice: 11_000, sellPrice: 17_000, stock: 0 },
      ],
    });
    const after = (await stockRows()).filter(
      (item) => item.productId === existingId,
    ).length;
    expect(after).toBe(before);
  });
});

describe("POST /imports/products — validasi per baris", () => {
  it("melaporkan kode kesalahan yang tepat beserta indeks baris", async () => {
    const body = (await (
      await req("/imports/products", {
        mode: "preview",
        rows: [
          { name: "", costPrice: 1000, sellPrice: 2000, stock: 1 },
          { name: "Barang B", costPrice: "abc", sellPrice: 2000, stock: 1 },
          { name: "Barang C", costPrice: 1000, sellPrice: 2000, stock: "-1" },
          { name: "Barang D", costPrice: 1000, sellPrice: 2000, stock: 1 },
          { name: "  barang   d ", costPrice: 1000, sellPrice: 2000, stock: 1 },
        ],
      })
    ).json()) as ImportResult;

    expect(body.invalidRows.map((row) => [row.index, row.code])).toEqual([
      [0, "invalid_name"],
      [1, "invalid_price"],
      [2, "invalid_qty"],
      [4, "duplicate_in_file"],
    ]);
    expect(body.validRows).toBe(1);
  });

  it("baris valid tetap ditulis walau baris lain tidak valid", async () => {
    const body = (await (
      await req("/imports/products", {
        mode: "commit",
        rows: [
          { name: "", costPrice: 1000, sellPrice: 2000, stock: 1 },
          { name: "Kecap Manis", costPrice: 1000, sellPrice: 2000, stock: 3 },
        ],
      })
    ).json()) as ImportResult;
    expect(body.created).toBe(1);
    expect(
      (await productRows()).some((row) => row.name === "Kecap Manis"),
    ).toBe(true);
  });

  it("menolak lebih dari 500 baris", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({
      name: `Barang ${i}`,
      costPrice: 1000,
      sellPrice: 2000,
      stock: 1,
    }));
    expect(
      (await req("/imports/products", { mode: "preview", rows })).status,
    ).toBe(400);
  });
});

describe("POST /imports/sales", () => {
  it("preview tidak menulis penjualan", async () => {
    const body = (await (
      await req("/imports/sales", {
        mode: "preview",
        rows: [{ date: TODAY, productName: "Kopi Bubuk", qty: 2 }],
      })
    ).json()) as ImportResult;
    expect(body.validRows).toBe(1);
    expect(body.created).toBe(0);
    expect(await db.select().from(dailySales)).toHaveLength(0);
  });

  it("commit menulis dan import ulang file yang sama tidak menggandakan", async () => {
    const payload = {
      mode: "commit",
      rows: [{ date: TODAY, productName: "Kopi Bubuk", qty: 2 }],
    };
    const first = (await (
      await req("/imports/sales", payload)
    ).json()) as ImportResult;
    expect(first.created).toBe(1);

    const second = (await (
      await req("/imports/sales", payload)
    ).json()) as ImportResult;
    expect(second.updated).toBe(1);

    const rows = await db.select().from(dailySales);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.qty).toBe(2);
  });

  it("baris (barang, tanggal) sama dijumlahkan dulu", async () => {
    await req("/imports/sales", {
      mode: "commit",
      rows: [
        { date: "2026-11-05", productName: "Kopi Bubuk", qty: 1 },
        { date: "2026-11-05", productName: "kopi bubuk", qty: 2 },
      ],
    });
    const rows = (await db.select().from(dailySales)).filter(
      (row) => row.saleDate === "2026-11-05",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.qty).toBe(3);
  });
});

describe("POST /imports/sales — validasi baris", () => {
  it("menerima DD/MM/YYYY dan menolak tanggal tidak nyata atau masa depan", async () => {
    const body = (await (
      await req("/imports/sales", {
        mode: "preview",
        rows: [
          { date: "04/11/2026", productName: "Kopi Bubuk", qty: 1 },
          { date: "2026-02-31", productName: "Kopi Bubuk", qty: 1 },
          { date: "2026-12-01", productName: "Kopi Bubuk", qty: 1 },
        ],
      })
    ).json()) as ImportResult;

    expect(body.validRows).toBe(1);
    expect(body.invalidRows.map((row) => [row.index, row.code])).toEqual([
      [1, "invalid_date"],
      [2, "invalid_date"],
    ]);
  });

  it("unknown_product untuk nama yang tidak cocok", async () => {
    const body = (await (
      await req("/imports/sales", {
        mode: "preview",
        rows: [{ date: TODAY, productName: "Barang Hantu", qty: 1 }],
      })
    ).json()) as ImportResult;
    expect(body.invalidRows[0]!.code).toBe("unknown_product");
  });

  it("insufficient_stock hanya menggugurkan baris itu", async () => {
    // Stok Kopi Bubuk tersisa 20 − 2 − 3 = 15; minta 999.
    const body = (await (
      await req("/imports/sales", {
        mode: "commit",
        rows: [
          { date: "2026-11-06", productName: "Kopi Bubuk", qty: 999 },
          // Teh Celup baru masuk hari ini, jadi hanya bisa dijual hari ini.
          { date: TODAY, productName: "Teh Celup", qty: 1 },
        ],
      })
    ).json()) as ImportResult;

    expect(body.invalidRows).toHaveLength(1);
    expect(body.invalidRows[0]!.code).toBe("insufficient_stock");
    expect(
      (await db.select().from(dailySales)).filter(
        (row) => row.saleDate === "2026-11-06",
      ),
    ).toHaveLength(0);
    const teh = (await db.select().from(dailySales)).find(
      (row) => row.saleDate === TODAY && row.productId !== existingId,
    );
    expect(teh?.qty).toBe(1);
  });
});

describe("harga modal terakhir setelah import update_price", () => {
  it("modal dari import terbaru menang atas modal saat barang dibuat", async () => {
    const created = await req("/imports/products", {
      mode: "commit",
      rows: [
        {
          name: "Minyak Goreng 2L",
          costPrice: 30_000,
          sellPrice: 36_000,
          stock: 5,
        },
      ],
    });
    expect(created.status).toBe(200);

    // Barang yang sama, modal naik, di hari yang sama → dua baris opening
    // ber-received_on identik; `lastCost` dipilih lewat created_at DESC.
    await req("/imports/products", {
      mode: "commit",
      onDuplicate: "update_price",
      rows: [
        {
          name: "Minyak Goreng 2L",
          costPrice: 32_000,
          sellPrice: 38_000,
          stock: 0,
        },
      ],
    });

    const list = (await (
      await app.request("/api/v1/products", {
        headers: { origin: ORIGIN, cookie },
      })
    ).json()) as { items: { name: string; lastCost: number }[] };
    expect(
      list.items.find((item) => item.name === "Minyak Goreng 2L")?.lastCost,
    ).toBe(32_000);
  });
});

describe("batas 20 import per jam per toko", () => {
  it("percobaan ke-21 → 429", async () => {
    const payload = {
      mode: "preview",
      rows: [{ name: "Uji Batas", costPrice: 1000, sellPrice: 2000, stock: 1 }],
    };
    let last = 0;
    for (let i = 0; i < 21; i += 1) {
      last = (await req("/imports/products", payload)).status;
    }
    expect(last).toBe(429);
  });
});
