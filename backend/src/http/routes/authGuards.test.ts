// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  products,
  sessions,
  stores,
  users,
} from "../../../../database/src/schema.ts";
import { createApp } from "../app.ts";
import { AUTH_BUDGET_RULE } from "../rate-limit.ts";

const ORIGIN = "https://lakoo.test";
const START = new Date("2026-11-09T03:00:00Z");

let db: AnyDb;
let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;
let clock = START;
let cookie = "";

const post = (path: string, body: unknown = {}, ip = "10.1.0.1") =>
  Promise.resolve(
    app.request(`/api/v1${path}`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }),
  );

const me = (ip = "10.1.0.1") =>
  Promise.resolve(
    app.request("/api/v1/me", {
      headers: { cookie, "x-forwarded-for": ip },
    }),
  );

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
  app = createApp({ db, allowedOrigins: [ORIGIN], now: () => clock });

  const owner = await db
    .insert(users)
    .values({ email: "template@lakoo.local", passwordHash: null })
    .returning();
  const store = await db
    .insert(stores)
    .values({
      ownerUserId: owner[0]!.id,
      name: "Toko Demo",
      isDemoTemplate: true,
    })
    .returning();
  await db.insert(products).values({
    storeId: store[0]!.id,
    name: "Kecap",
    nameKey: "kecap",
    sellPrice: 20_000,
  });

  const demo = await post("/auth/demo");
  cookie = (
    demo.headers.getSetCookie().find((c) => c.startsWith("lakoo_session=")) ??
    ""
  ).split(";")[0] as string;
}, 120_000);

afterAll(async () => {
  await close();
});

describe("E-1 — sesi demo berakhir tepat di demo_expires_at", () => {
  it("masih sah sebelum demo_expires_at", async () => {
    expect((await me()).status).toBe(200);
  });

  it("401 setelah demo_expires_at lewat, dan sesi dihapus", async () => {
    const before = await db.select().from(sessions);
    expect(before.length).toBeGreaterThan(0);

    // Lewatkan jam aplikasi melewati demo_expires_at (24 jam sejak dibuat).
    clock = new Date(START.getTime() + 25 * 3_600_000);

    const res = await me();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthenticated");

    // Sesi benar-benar dihapus, bukan sekadar ditolak.
    const after = await db.select().from(sessions);
    expect(after).toHaveLength(0);
  });
});

describe("E-2 — anggaran global 30/15 menit per IP untuk /auth/*", () => {
  it("aturan sesuai SPEC §8.4 amendemen", () => {
    expect(AUTH_BUDGET_RULE.limit).toBe(30);
    expect(AUTH_BUDGET_RULE.windowSeconds).toBe(900);
  });

  it("percobaan ke-31 dari IP yang sama ditolak 429", async () => {
    clock = START;
    const ip = "10.2.0.9";
    const statuses: number[] = [];
    // Email berbeda tiap percobaan: limit per-endpoint tidak akan menyala,
    // jadi yang menahan di sini hanya anggaran global.
    for (let attempt = 0; attempt < 31; attempt += 1) {
      statuses.push(
        (
          await post(
            "/auth/login",
            { email: `acak${attempt}@contoh.id`, password: "rahasia123" },
            ip,
          )
        ).status,
      );
    }
    expect(statuses.slice(0, 30).every((status) => status === 401)).toBe(true);
    expect(statuses[30]).toBe(429);
  }, 60_000);

  it("IP lain tidak terpengaruh", async () => {
    const res = await post(
      "/auth/login",
      { email: "x@contoh.id", password: "rahasia123" },
      "10.2.0.10",
    );
    expect(res.status).toBe(401);
  });
});
