// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import { products, stores, users } from "../../../../database/src/schema.ts";
import { createApp } from "../app.ts";
import { DEMO_RULE } from "../rate-limit.ts";

const ORIGIN = "https://lakoo.test";
const NOW = new Date("2026-11-09T03:00:00Z");

let db: AnyDb;
let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;
let templateStoreId = "";

/** Template kecil: cukup untuk membuktikan kloning dan wiring, tanpa 100 barang. */
async function seedTemplate(): Promise<void> {
  if (templateStoreId !== "") return; // idempoten: kedua describe boleh memanggilnya
  const owner = await db
    .insert(users)
    .values({ email: "template@lakoo.local", passwordHash: null })
    .returning();
  const store = await db
    .insert(stores)
    .values({
      ownerUserId: owner[0]!.id,
      name: "Toko Demo",
      storeType: "toko_kelontong",
      location: "Bandung",
      customerTypes: ["warga_perumahan"],
      isDemoTemplate: true,
    })
    .returning();
  templateStoreId = store[0]!.id;

  await db.insert(products).values([
    {
      storeId: templateStoreId,
      name: "Kecap Manis",
      nameKey: "kecap manis",
      sellPrice: 20_000,
      isComplementary: false,
    },
    {
      storeId: templateStoreId,
      name: "Sabun Mandi",
      nameKey: "sabun mandi",
      sellPrice: 5_000,
      isComplementary: false,
    },
  ]);
}

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

const cookieOf = (res: Response): string =>
  (
    res.headers.getSetCookie().find((c) => c.startsWith("lakoo_session=")) ?? ""
  ).split(";")[0] as string;

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db as AnyDb;
  close = () => created.client.close();
  app = createApp({ db, allowedOrigins: [ORIGIN], now: () => NOW });
}, 120_000);

afterAll(async () => {
  await close();
});

interface MeBody {
  user: {
    id: string;
    email: string | null;
    isDemo: boolean;
    demoExpiresAt: string | null;
  };
  store: { id: string; name: string; storeType: string | null };
}

describe("POST /auth/demo — template belum ada", () => {
  it("mengembalikan 503 internal_error", async () => {
    const res = await post("/auth/demo", {}, { "x-forwarded-for": "10.9.0.1" });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("internal_error");
  });
});

describe("POST /auth/demo — setelah template tersedia", () => {
  beforeAll(async () => {
    await seedTemplate();
  }, 60_000);

  it("mengkloning toko dan langsung memberi sesi 24 jam", async () => {
    const res = await post("/auth/demo", {}, { "x-forwarded-for": "10.9.0.2" });
    expect(res.status).toBe(201);

    const cookie = res.headers
      .getSetCookie()
      .find((c) => c.startsWith("lakoo_session="));
    expect(cookie).toBeDefined();
    expect(cookie).toContain("Max-Age=86400");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");

    const body = (await res.json()) as MeBody;
    expect(body.user.isDemo).toBe(true);
    expect(body.user.email).toBeNull();
    expect(body.user.demoExpiresAt).toBe("2026-11-10T03:00:00.000Z");
    expect(body.store.name).toBe("Toko Demo");
    expect(body.store.storeType).toBe("toko_kelontong");
    expect(body.store.id).not.toBe(templateStoreId);
  });

  it("klon berisi barang template dan terpisah dari klon lain", async () => {
    const first = (await (
      await post("/auth/demo", {}, { "x-forwarded-for": "10.9.0.3" })
    ).json()) as MeBody;
    const second = (await (
      await post("/auth/demo", {}, { "x-forwarded-for": "10.9.0.4" })
    ).json()) as MeBody;
    expect(first.store.id).not.toBe(second.store.id);

    const list = await Promise.resolve(
      app.request("/api/v1/products", {
        headers: {
          cookie: cookieOf(
            await post("/auth/demo", {}, { "x-forwarded-for": "10.9.0.5" }),
          ),
        },
      }),
    );
    const body = (await list.json()) as { items: { name: string }[] };
    expect(body.items.map((item) => item.name).sort()).toEqual([
      "Kecap Manis",
      "Sabun Mandi",
    ]);
  });
});

describe("POST /auth/demo — batas dan isolasi toko demo", () => {
  beforeAll(async () => {
    await seedTemplate();
  }, 60_000);

  it("toko demo tidak bisa diubah (403 forbidden_demo)", async () => {
    const demo = await post(
      "/auth/demo",
      {},
      { "x-forwarded-for": "10.9.0.6" },
    );
    const res = await Promise.resolve(
      app.request("/api/v1/store", {
        method: "PATCH",
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          cookie: cookieOf(demo),
        },
        body: JSON.stringify({ name: "Diubah" }),
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("forbidden_demo");
  });

  it("dibatasi 10 per jam per IP", async () => {
    const ip = "10.9.9.9";
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      statuses.push(
        (await post("/auth/demo", {}, { "x-forwarded-for": ip })).status,
      );
    }
    expect(statuses.slice(0, 10)).toEqual(
      Array.from({ length: 10 }, () => 201),
    );
    expect(statuses[10]).toBe(429);
  }, 60_000);

  it("aturan rate limit sesuai SPEC §8.4", () => {
    expect(DEMO_RULE.limit).toBe(10);
    expect(DEMO_RULE.windowSeconds).toBe(3_600);
  });
});
