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

interface StoreBody {
  id: string;
  name: string;
  storeType: string | null;
  location: string | null;
  customerTypes: string[];
  healthyDays: number;
  deadDays: number;
  warningWeeks: number;
  onboarded: boolean;
}

const patch = (body: unknown, headers: Record<string, string> = {}) =>
  Promise.resolve(
    app.request("/api/v1/store", {
      method: "PATCH",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  const created = await createTestDb();
  app = createApp({
    db: created.db as AnyDb,
    allowedOrigins: [ORIGIN],
    now: () => NOW,
  });
  close = () => created.client.close();

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
}, 120_000);

afterAll(async () => {
  await close();
});

const bodyOf = async (res: Response): Promise<StoreBody> =>
  (await res.json()) as StoreBody;

describe("PATCH /store — profil", () => {
  it("mengubah nama, jenis, lokasi, dan tipe pelanggan", async () => {
    const res = await patch({
      name: "Toko Bu Sri Jaya",
      storeType: "warung_kelontong",
      location: "Bandung",
      customerTypes: ["warga_perumahan", "anak_sekolah"],
    });
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.name).toBe("Toko Bu Sri Jaya");
    expect(body.storeType).toBe("warung_kelontong");
    expect(body.location).toBe("Bandung");
    expect(body.customerTypes).toEqual(["warga_perumahan", "anak_sekolah"]);
  });

  it("mengosongkan storeType dan location dengan null", async () => {
    const res = await patch({ storeType: null, location: null });
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.storeType).toBeNull();
    expect(body.location).toBeNull();
  });

  it("menolak body kosong", async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
  });

  it("menolak field tak dikenal", async () => {
    const res = await patch({ warna: "merah" });
    expect(res.status).toBe(400);
  });

  it("menolak customerTypes duplikat dan lebih dari enam", async () => {
    const dup = await patch({
      customerTypes: ["anak_sekolah", "anak_sekolah"],
    });
    expect(dup.status).toBe(400);

    const tooMany = await patch({
      customerTypes: [
        "warga_perumahan",
        "anak_sekolah",
        "pekerja_pabrik_kantor",
        "pedagang_lain",
        "pengendara_lewat",
        "kos_mahasiswa",
        "kos_mahasiswa",
      ],
    });
    expect(tooMany.status).toBe(400);
  });
});

describe("PATCH /store — ambang status", () => {
  it("menyimpan ambang yang sah", async () => {
    const res = await patch({ healthyDays: 20, deadDays: 60, warningWeeks: 4 });
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect([body.healthyDays, body.deadDays, body.warningWeeks]).toEqual([
      20, 60, 4,
    ]);
  });

  it("menolak ambang di luar rentang", async () => {
    expect((await patch({ healthyDays: 6 })).status).toBe(400);
    expect((await patch({ healthyDays: 61 })).status).toBe(400);
    expect((await patch({ deadDays: 14 })).status).toBe(400);
    expect((await patch({ deadDays: 181 })).status).toBe(400);
    expect((await patch({ warningWeeks: 1 })).status).toBe(400);
    expect((await patch({ warningWeeks: 7 })).status).toBe(400);
  });

  it("menolak healthyDays >= deadDays terhadap nilai hasil gabungan", async () => {
    // Saat ini 20/60. Menurunkan deadDays ke 10 harus ditolak walau healthyDays tidak dikirim.
    const res = await patch({ deadDays: 15 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { fields?: Record<string, string> };
    };
    expect(body.error.fields?.healthyDays).toBeDefined();
  });

  it("resetThresholds mengembalikan 14/45/3 dan mengabaikan ambang lain", async () => {
    const res = await patch({
      resetThresholds: true,
      healthyDays: 50,
      deadDays: 100,
    });
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect([body.healthyDays, body.deadDays, body.warningWeeks]).toEqual([
      14, 45, 3,
    ]);
  });
});

describe("PATCH /store — onboarding dan AI", () => {
  it("completeOnboarding mengisi onboardedAt", async () => {
    const before = await bodyOf(await patch({ name: "Toko Bu Sri Jaya" }));
    expect(before.onboarded).toBe(false);

    const after = await bodyOf(await patch({ completeOnboarding: true }));
    expect(after.onboarded).toBe(true);
  });

  it("completeOnboarding: false tidak mengisi apa pun", async () => {
    const body = await bodyOf(
      await patch({ completeOnboarding: false, name: "Toko Bu Sri" }),
    );
    expect(body.name).toBe("Toko Bu Sri");
  });

  it("aiEnabled bisa dimatikan", async () => {
    const res = await patch({ aiEnabled: false });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /store — batas akses", () => {
  it("mewajibkan sesi", async () => {
    const res = await Promise.resolve(
      app.request("/api/v1/store", {
        method: "PATCH",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("menolak Origin asing", async () => {
    const res = await patch({ name: "X" }, { origin: "https://jahat.test" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("bad_origin");
  });
});
