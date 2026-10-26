// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import {
  idempotencyKeys,
  rateLimits,
  sessions,
  stores,
  users,
} from "../../../../database/src/schema.ts";
import { createApp } from "../app.ts";

const ORIGIN = "https://lakoo.test";
const NOW = new Date("2026-11-09T19:00:00Z");
const SECRET = "rahasia-cron";

let db: AnyDb;
let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;

interface CronResult {
  demoTemplateRegenerated: boolean;
  plansWarmed: number;
  aiPlansWarmed: number;
  demoClonesDeleted: number;
  durationMs: number;
}

const cron = (authorization?: string) =>
  Promise.resolve(
    app.request("/api/v1/cron/daily", {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

const count = async (query: string): Promise<number> => {
  const rows = await db.execute(sql.raw(query));
  return Number((rows.rows[0] as { n: unknown }).n);
};

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
  app = createApp({
    db,
    allowedOrigins: [ORIGIN],
    now: () => NOW,
    env: { CRON_SECRET: SECRET },
  });
}, 120_000);

afterAll(async () => {
  await close();
});

describe("GET /cron/daily — otorisasi", () => {
  it("401 tanpa Authorization", async () => {
    expect((await cron()).status).toBe(401);
  });

  it("401 dengan Bearer yang salah", async () => {
    expect((await cron("Bearer salah")).status).toBe(401);
  });

  it("401 bila CRON_SECRET tidak disetel — 'Bearer ' kosong bukan kunci", async () => {
    const noSecret = createApp({
      db,
      allowedOrigins: [ORIGIN],
      now: () => NOW,
      env: {},
    });
    const res = await Promise.resolve(
      noSecret.request("/api/v1/cron/daily", {
        headers: { authorization: "Bearer " },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /cron/daily — bentuk respons", () => {
  it("mengembalikan bentuk kontrak lengkap", async () => {
    const res = await cron(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as CronResult;

    expect(Object.keys(body).sort()).toEqual([
      "aiPlansWarmed",
      "demoClonesDeleted",
      "demoTemplateRegenerated",
      "durationMs",
      "plansWarmed",
    ]);
    expect(body.demoTemplateRegenerated).toBe(true);
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
    // Tanpa AI_ENABLED, semua rencana jatuh ke template — tidak ada yang "AI".
    expect(body.aiPlansWarmed).toBe(0);
  }, 180_000);
});

describe("GET /cron/daily — pekerjaan harian", () => {
  it("membangun ulang toko template beserta rencananya", async () => {
    expect(
      await count("SELECT COUNT(*) AS n FROM stores WHERE is_demo_template"),
    ).toBe(1);
    expect(
      await count(
        "SELECT COUNT(*) AS n FROM products p JOIN stores s ON s.id = p.store_id WHERE s.is_demo_template",
      ),
    ).toBeGreaterThan(50);
    expect(
      await count(
        "SELECT COUNT(*) AS n FROM action_plans a JOIN stores s ON s.id = a.store_id WHERE s.is_demo_template",
      ),
    ).toBeGreaterThan(0);
  });

  it("menghapus klon demo yang kedaluwarsa dan menyisakan yang masih hidup", async () => {
    await db.execute(sql`
      INSERT INTO users (id, email, is_demo) VALUES
        ('11111111-1111-1111-1111-111111111111', 'mati@lakoo.local', true),
        ('22222222-2222-2222-2222-222222222222', 'hidup@lakoo.local', true)`);
    // Jam eksplisit: `now()` di sini adalah jam DB, sedangkan cron memakai jam
    // aplikasi — memakai now() membuat kedua klon tampak kedaluwarsa.
    await db.execute(sql`
      INSERT INTO stores (owner_user_id, name, demo_expires_at, is_demo_template) VALUES
        ('11111111-1111-1111-1111-111111111111', 'Demo Mati',
         ${new Date(NOW.getTime() - 3_600_000).toISOString()}, false),
        ('22222222-2222-2222-2222-222222222222', 'Demo Hidup',
         ${new Date(NOW.getTime() + 5 * 3_600_000).toISOString()}, false)`);

    const body = (await (await cron(`Bearer ${SECRET}`)).json()) as CronResult;
    expect(body.demoClonesDeleted).toBe(1);

    expect(
      await count(
        "SELECT COUNT(*) AS n FROM users WHERE email = 'mati@lakoo.local'",
      ),
    ).toBe(0);
    expect(
      await count(
        "SELECT COUNT(*) AS n FROM users WHERE email = 'hidup@lakoo.local'",
      ),
    ).toBe(1);
  }, 180_000);
});

describe("GET /cron/daily — pembersihan tabel operasional", () => {
  it("menghapus baris kedaluwarsa dan menyisakan yang masih segar", async () => {
    // Toko biasa (bukan template, bukan demo): cron membangun ulang template
    // setiap kali jalan, jadi baris milik template ikut terhapus lewat cascade.
    const owner = await db
      .insert(users)
      .values({ email: "bersih@lakoo.local", isDemo: false })
      .returning();
    const store = await db
      .insert(stores)
      .values({ ownerUserId: owner[0]!.id, name: "Toko Bersih" })
      .returning();
    const storeId = store[0]!.id;

    await db.insert(idempotencyKeys).values([
      {
        storeId,
        key: crypto.randomUUID(),
        endpoint: "x",
        statusCode: 200,
        responseBody: {},
        createdAt: new Date(NOW.getTime() - 30 * 86_400_000),
      },
      {
        storeId,
        key: crypto.randomUUID(),
        endpoint: "x",
        statusCode: 200,
        responseBody: {},
        createdAt: NOW,
      },
    ]);
    await db.insert(rateLimits).values([
      {
        key: "lama",
        windowStart: new Date(NOW.getTime() - 30 * 86_400_000),
        count: 1,
      },
      { key: "baru", windowStart: NOW, count: 1 },
    ]);
    await db.insert(sessions).values([
      {
        userId: owner[0]!.id,
        tokenHash: Buffer.from("lama"),
        expiresAt: new Date(NOW.getTime() - 1000),
      },
      {
        userId: owner[0]!.id,
        tokenHash: Buffer.from("baru"),
        expiresAt: new Date(NOW.getTime() + 1000),
      },
    ]);

    await cron(`Bearer ${SECRET}`);

    expect(await count("SELECT COUNT(*) AS n FROM idempotency_keys")).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM rate_limits")).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM sessions")).toBe(1);
  }, 180_000);
});
