// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import { createApp } from "../app.ts";

const ORIGIN = "https://lakoo.test";
/** Senin — ringkasan mingguan harus tampil. */
const MONDAY = new Date("2026-11-09T03:00:00Z");
/** Selasa — ringkasan mingguan harus null. */
const TUESDAY = new Date("2026-11-10T03:00:00Z");

let db: AnyDb;
let close: () => Promise<void>;
let cookie = "";

const appAt = (now: Date) =>
  createApp({ db, allowedOrigins: [ORIGIN], now: () => now });

interface Dashboard {
  asOf: string;
  store: { id: string; name: string };
  totals: {
    lockedValue: number;
    complementaryLockedValue: number;
    problemLockedValue: number;
    byStatus: Record<string, { count: number; lockedValue: number }>;
  };
  today: { statusChanges: unknown[]; dueSteps: unknown[] };
  topPriority: unknown[];
  complementaryOverstock: unknown[];
  restockSoon: unknown[];
  weeklySummary: {
    weekStart: string;
    weekEnd: string;
    sentences: string[];
  } | null;
}

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();

  const app = appAt(MONDAY);
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

  for (const product of [
    {
      name: "Kecap Manis",
      costPrice: 12_000,
      sellPrice: 20_000,
      openingStock: 10,
    },
    {
      name: "Sabun Mandi",
      costPrice: 3_000,
      sellPrice: 5_000,
      openingStock: 20,
    },
    {
      name: "Gula Pasir",
      costPrice: 14_000,
      sellPrice: 16_000,
      openingStock: 5,
    },
  ]) {
    const res = await app.request("/api/v1/products", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json", cookie },
      body: JSON.stringify(product),
    });
    if (res.status !== 201) throw new Error(`seed produk gagal: ${res.status}`);
  }
}, 120_000);

afterAll(async () => {
  await close();
});

const getDashboard = async (now: Date): Promise<Dashboard> => {
  const res = await appAt(now).request("/api/v1/dashboard", {
    headers: { cookie },
  });
  expect(res.status).toBe(200);
  return (await res.json()) as Dashboard;
};

describe("GET /dashboard", () => {
  it("mengembalikan bentuk kontrak lengkap", async () => {
    const body = await getDashboard(MONDAY);
    expect(body.asOf).toBe("2026-11-09");
    expect(body.store.name).toBe("Toko Bu Sri");
    expect(Object.keys(body.totals.byStatus).sort()).toEqual(
      ["mati", "sekarat", "sehat", "stok_habis", "waspada"].sort(),
    );
    expect(Array.isArray(body.today.statusChanges)).toBe(true);
    expect(Array.isArray(body.today.dueSteps)).toBe(true);
    expect(Array.isArray(body.topPriority)).toBe(true);
    expect(Array.isArray(body.complementaryOverstock)).toBe(true);
    expect(Array.isArray(body.restockSoon)).toBe(true);
  });

  it("menjumlahkan uang terkunci dari seluruh barang", async () => {
    const body = await getDashboard(MONDAY);
    // 10×12.000 + 20×3.000 + 5×14.000 = 250.000
    expect(body.totals.lockedValue).toBe(250_000);
    const perStatus = Object.values(body.totals.byStatus).reduce(
      (sum, bucket) => sum + bucket.lockedValue,
      0,
    );
    expect(perStatus).toBe(250_000);
    const count = Object.values(body.totals.byStatus).reduce(
      (sum, b) => sum + b.count,
      0,
    );
    expect(count).toBe(3);
  });

  it("topPriority maksimal tiga barang", async () => {
    const body = await getDashboard(MONDAY);
    expect(body.topPriority.length).toBeLessThanOrEqual(3);
  });

  it("barang baru tanpa riwayat jual tidak langsung masuk prioritas", async () => {
    const body = await getDashboard(MONDAY);
    expect(body.totals.problemLockedValue).toBe(0);
  });
});

describe("GET /dashboard — ringkasan mingguan", () => {
  it("membuat ringkasan mingguan pada hari Senin", async () => {
    const body = await getDashboard(MONDAY);
    expect(body.weeklySummary).not.toBeNull();
    expect(body.weeklySummary?.weekStart).toBe("2026-11-01");
    expect(body.weeklySummary?.weekEnd).toBe("2026-11-07");
    expect(body.weeklySummary?.sentences).toHaveLength(3);
    expect(body.weeklySummary?.sentences[0]).toBe(
      "Minggu lalu belum ada penjualan tercatat.",
    );
  });

  it("ringkasan yang sudah tersimpan dipakai ulang, bukan dibuat ulang", async () => {
    const first = await getDashboard(MONDAY);
    const second = await getDashboard(MONDAY);
    expect(second.weeklySummary?.sentences).toEqual(
      first.weeklySummary?.sentences,
    );
  });

  it("tidak menampilkan ringkasan pada hari Selasa", async () => {
    const body = await getDashboard(TUESDAY);
    expect(body.weeklySummary).toBeNull();
  });

  it("mewajibkan sesi", async () => {
    const res = await appAt(MONDAY).request("/api/v1/dashboard");
    expect(res.status).toBe(401);
  });
});
