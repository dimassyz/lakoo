import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { API_BASE } from "./api";

/**
 * Regresi yang menutup seluruh app: klien memakai prefix `/api` sementara
 * backend memakai `basePath("/api/v1")` — setiap panggilan jatuh ke 404
 * sementara unit test lain hijau karena klien di-mock. Cek di sini membandingkan
 * baseUrl ke `servers:` di openapi.yaml, jadi drift kontrak gagal di gate.
 */
describe("base URL klien", () => {
  it("cocok dengan servers di openapi.yaml", () => {
    const yaml = readFileSync("docs/api/openapi.yaml", "utf8");
    const cocok = yaml.match(/^servers:\s*\n\s*-\s*url:\s*(\S+)$/m);
    expect(
      cocok,
      "openapi.yaml harus punya blok servers: - url: <prefix>",
    ).not.toBeNull();
    expect(API_BASE).toBe(cocok?.[1]);
  });

  it("tidak memakai prefix tanpa versi", () => {
    expect(API_BASE).not.toBe("/api");
    expect(API_BASE).toMatch(/^\/api\/v\d+$/);
  });
});
