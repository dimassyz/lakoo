// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AnyDb } from "../../../database/src/db.ts";
import { createApp } from "./app.ts";

const ORIGIN = "https://lakoo.test";

function makeApp(execute: () => Promise<unknown> = async () => [{ ok: 1 }]) {
  return createApp({
    db: { execute } as unknown as AnyDb,
    allowedOrigins: [ORIGIN],
    now: () => new Date("2026-11-09T03:00:00.000Z"),
  });
}

const post = (path: string, headers: Record<string, string> = {}) =>
  makeApp().request(path, { method: "POST", headers });

describe("GET /api/v1/health", () => {
  it("menjawab 200 dengan status ok dan waktu ISO", async () => {
    const res = await makeApp().request("/api/v1/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      time: "2026-11-09T03:00:00.000Z",
    });
  });

  it("menjawab 503 internal_error saat DB tidak terjangkau", async () => {
    const res = await makeApp(async () => {
      throw new Error("connection refused");
    }).request("/api/v1/health");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("internal_error");
  });

  it("tidak membocorkan pesan error internal ke klien", async () => {
    const res = await makeApp(async () => {
      throw new Error("password=hunter2 di DSN");
    }).request("/api/v1/health");
    expect(await res.text()).not.toContain("hunter2");
  });
});

describe("guard Origin + Content-Type (SPEC §8.1)", () => {
  it("menolak POST tanpa header Origin", async () => {
    const res = await post("/api/v1/health", {
      "content-type": "application/json",
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "bad_origin",
    );
  });

  it("menolak POST dari Origin yang tidak terdaftar", async () => {
    const res = await post("/api/v1/health", {
      origin: "https://jahat.example",
      "content-type": "application/json",
    });
    expect(res.status).toBe(403);
  });

  it("menolak POST dengan Content-Type bukan JSON", async () => {
    const res = await post("/api/v1/health", {
      origin: ORIGIN,
      "content-type": "text/plain",
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "bad_origin",
    );
  });

  it("meneruskan POST yang Origin dan Content-Type-nya sah", async () => {
    const res = await post("/api/v1/health", {
      origin: ORIGIN,
      "content-type": "application/json",
    });
    // Tidak ada route POST di sini; yang diuji adalah guard-nya tidak memblokir.
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "not_found",
    );
  });

  it("tidak menuntut Origin untuk GET", async () => {
    const res = await makeApp().request("/api/v1/health");
    expect(res.status).toBe(200);
  });
});

describe("envelope error", () => {
  it("memakai bentuk { error: { code, message } } tanpa field tambahan", async () => {
    const res = await makeApp().request("/api/v1/tidak-ada");
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["error"]);
    expect(Object.keys(body.error as object).sort()).toEqual([
      "code",
      "message",
    ]);
  });

  it("tidak membalas HTML untuk path tak dikenal", async () => {
    const res = await makeApp().request("/api/v1/tidak-ada");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
