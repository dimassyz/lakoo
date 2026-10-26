// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../database/src/test/pglite.ts";
import type { AnyDb } from "../../../../database/src/db.ts";
import { createApp } from "../app.ts";

const ORIGIN = "https://lakoo.test";
const NOW = new Date("2026-11-09T03:00:00Z");

let app: ReturnType<typeof createApp>;
let close: () => Promise<void>;

beforeAll(async () => {
  const { client, db } = await createTestDb();
  app = createApp({
    db: db as AnyDb,
    allowedOrigins: [ORIGIN],
    now: () => NOW,
  });
  close = () => client.close();
}, 120_000);

afterAll(async () => {
  await close();
});

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return Promise.resolve(
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
}

const get = (path: string, headers: Record<string, string> = {}) =>
  Promise.resolve(app.request(`/api/v1${path}`, { headers }));

const cookieOf = (res: Response): string => {
  const raw = res.headers
    .getSetCookie()
    .find((c) => c.startsWith("lakoo_session="));
  if (raw === undefined) throw new Error("Set-Cookie sesi tidak ada");
  return raw.split(";")[0] as string;
};

describe("POST /auth/register", () => {
  it("membuat akun + toko dan langsung memberi sesi", async () => {
    const res = await post(
      "/auth/register",
      {
        storeName: "Toko Bu Sri",
        email: "baru1@contoh.id",
        password: "rahasia123",
      },
      { "x-forwarded-for": "10.1.0.1" },
    );
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      user: { email: string; isDemo: boolean };
      store: {
        name: string;
        storeType: null;
        profileComplete: boolean;
        onboarded: boolean;
      };
    };
    expect(body.user.email).toBe("baru1@contoh.id");
    expect(body.user.isDemo).toBe(false);
    expect(body.store.name).toBe("Toko Bu Sri");
    // Registrasi belum onboarding: storeType diisi lewat PATCH /store.
    expect(body.store.storeType).toBeNull();
    expect(body.store.profileComplete).toBe(false);
    expect(body.store.onboarded).toBe(false);

    const cookie = res.headers.getSetCookie().join(" ");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=2592000");
  });

  it("menormalkan email ke huruf kecil dan trim", async () => {
    const res = await post(
      "/auth/register",
      {
        storeName: "Toko",
        email: "  BESAR2@Contoh.ID  ",
        password: "rahasia123",
      },
      { "x-forwarded-for": "10.1.0.2" },
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as { user: { email: string } }).user.email).toBe(
      "besar2@contoh.id",
    );
  });
});

describe("POST /auth/register — email & duplikat", () => {
  it("menolak email yang sudah terdaftar dengan 409 email_taken", async () => {
    const payload = {
      storeName: "Toko",
      email: "dobel@contoh.id",
      password: "rahasia123",
    };
    await post("/auth/register", payload, { "x-forwarded-for": "10.1.0.3" });
    const res = await post("/auth/register", payload, {
      "x-forwarded-for": "10.1.0.4",
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "email_taken",
    );
  });

  it("menolak field tak dikenal dengan validation_error", async () => {
    const res = await post(
      "/auth/register",
      {
        storeName: "Toko",
        email: "x5@contoh.id",
        password: "rahasia123",
        isAdmin: true,
      },
      { "x-forwarded-for": "10.1.0.5" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; fields: Record<string, string> };
    };
    expect(body.error.code).toBe("validation_error");
    expect(Object.keys(body.error.fields).length).toBeGreaterThan(0);
  });
});

describe("POST /auth/register — validasi & batas laju", () => {
  it("menolak kata sandi kurang dari 8 karakter", async () => {
    const res = await post(
      "/auth/register",
      { storeName: "Toko", email: "pendek@contoh.id", password: "rahasia" },
      { "x-forwarded-for": "10.1.0.6" },
    );
    expect(res.status).toBe(400);
    expect(
      ((await res.json()) as { error: { fields: Record<string, string> } })
        .error.fields,
    ).toHaveProperty("password");
  });

  it("membatasi 5 pendaftaran per jam per IP", async () => {
    const ip = "10.9.9.9";
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await post(
        "/auth/register",
        {
          storeName: "Toko",
          email: `banjir${i}@contoh.id`,
          password: "rahasia123",
        },
        { "x-forwarded-for": ip },
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  });
});

describe("POST /auth/login", () => {
  beforeAll(async () => {
    await post(
      "/auth/register",
      {
        storeName: "Toko Login",
        email: "login@contoh.id",
        password: "rahasia123",
      },
      { "x-forwarded-for": "10.2.0.1" },
    );
  }, 60_000);

  it("menerima kredensial yang benar", async () => {
    const res = await post(
      "/auth/login",
      { email: "login@contoh.id", password: "rahasia123" },
      { "x-forwarded-for": "10.2.1.1" },
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: { email: string } }).user.email).toBe(
      "login@contoh.id",
    );
    expect(cookieOf(res)).toMatch(/^lakoo_session=/);
  });

  it("menolak kata sandi salah dengan invalid_credentials", async () => {
    const res = await post(
      "/auth/login",
      { email: "login@contoh.id", password: "salahbanget" },
      { "x-forwarded-for": "10.2.1.2" },
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "invalid_credentials",
    );
  });

  it("memberi kode dan pesan sama untuk email tak terdaftar", async () => {
    const res = await post(
      "/auth/login",
      { email: "tidakada@contoh.id", password: "rahasia123" },
      { "x-forwarded-for": "10.2.1.3" },
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("invalid_credentials");
    // Pesan tidak boleh membedakan email ada vs tidak ada.
    expect(body.error.message).not.toMatch(/terdaftar|tidak ada|unknown/i);
  });
});

describe("GET /me", () => {
  it("mengembalikan sesi aktif", async () => {
    const reg = await post(
      "/auth/register",
      { storeName: "Toko Me", email: "me@contoh.id", password: "rahasia123" },
      { "x-forwarded-for": "10.3.0.1" },
    );
    const res = await get("/me", { cookie: cookieOf(reg) });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { store: { name: string } }).store.name).toBe(
      "Toko Me",
    );
  });

  it("menolak tanpa cookie", async () => {
    const res = await get("/me");
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "unauthenticated",
    );
  });

  it("menolak token yang tidak dikenal", async () => {
    const res = await get("/me", { cookie: "lakoo_session=palsu-palsu-palsu" });
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("menghapus sesi dan mengosongkan cookie", async () => {
    const reg = await post(
      "/auth/register",
      {
        storeName: "Toko Keluar",
        email: "keluar@contoh.id",
        password: "rahasia123",
      },
      { "x-forwarded-for": "10.4.0.1" },
    );
    const cookie = cookieOf(reg);

    const out = await post("/auth/logout", {}, { cookie });
    expect(out.status).toBe(204);
    expect(out.headers.getSetCookie().join(" ")).toContain("Max-Age=0");

    const after = await get("/me", { cookie });
    expect(after.status).toBe(401);
  });

  it("idempoten tanpa sesi", async () => {
    const res = await post("/auth/logout", {});
    expect(res.status).toBe(204);
  });
});
