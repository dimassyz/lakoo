import { readFileSync, readdirSync } from "node:fs";
import createClient from "openapi-fetch";
import type { paths } from "./api-types";
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

/**
 * CSRF (SPEC §8.1, backend/src/http/app.ts): setiap non-GET WAJIB
 * `Content-Type: application/json`. `openapi-fetch` hanya mengirim header itu
 * kalau ada `body` — jadi POST tanpa body lolos tipe (kontrak mengizinkan
 * `requestBody: required: false`) tapi ditolak 403 `bad_origin` di server.
 * Bug itu menutup jalur demo selama dua PR. Dua tes di bawah mengunci
 * mekanismenya, bukan sekadar instance-nya.
 */
describe("request non-GET", () => {
  /**
   * Klien terpisah dengan origin absolut + `fetch` disuntik: `fetch` global di
   * jsdom menolak URL relatif, sementara `api` produksi memang relatif
   * (same-origin di browser). Yang diuji di sini adalah header yang dikirim,
   * bukan baseUrl — itu tes terpisah.
   *
   * Catatan bentuk panggilan: `POST(path)` tanpa argumen opsi sama sekali dengan
   * `POST(path, undefined)` — dan justru itu bentuk bug-nya. Menulis `{}` sebagai
   * "tanpa body" akan TETAP mengirim body `{}` (dan karena itu Content-Type),
   * jadi parameternya boolean, bukan objek.
   */
  async function contentTypeDari(denganBody: boolean): Promise<string | null> {
    let terkirim: string | null = null;
    const uji = createClient<paths>({
      baseUrl: "http://uji.local/api/v1",
      fetch: (async (input, init) => {
        // openapi-fetch membangun `new Request(url, init)` lalu memanggil
        // `fetch(request)` — header ada di Request, bukan di init.
        const headers =
          input instanceof Request ? input.headers : new Headers(init?.headers);
        terkirim = headers.get("content-type");
        return new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });
    await uji.POST("/auth/demo", denganBody ? { body: {} } : undefined);
    return terkirim;
  }

  it("dengan body {} mengirim Content-Type application/json", async () => {
    expect(await contentTypeDari(true)).toBe("application/json");
  });

  it("tanpa opsi sama sekali TIDAK mengirim Content-Type (bentuk bug 403)", async () => {
    expect(await contentTypeDari(false)).toBeNull();
  });
});

/**
 * Penjaga titik panggil. Dua tes di atas mengunci mekanisme klien, tapi tidak
 * melihat berkas pemanggil — dan justru di sanalah bug 403 lahir (enam kali:
 * demo, logout, start/stop rencana, apply-price, hapus barang masuk).
 *
 * Versi pertama penjaga ini hanya menangkap `api.POST("...")` tanpa argumen
 * sama sekali, jadi **empat dari enam pemanggil lolos** karena mereka punya
 * `{ params: ... }` tapi tanpa `body`. Itu kelas kesalahan yang sama dengan bug
 * aslinya: memeriksa hal yang benar di jalur yang salah. Karena itu di sini
 * argumen tiap pemanggil diekstrak dengan pencocokan kurung, lalu diperiksa
 * apakah memuat `body`.
 *
 * Batas yang diketahui (jangan pura-pura tutup): pemeriksaan berbasis teks, jadi
 * string yang memuat `)` atau `(` bisa mengacaukan ekstraksi; berkas tes
 * dikecualikan karena sengaja menguji berbagai bentuk panggilan.
 */
describe("titik panggil non-GET di src/", () => {
  /** Semua berkas .ts/.tsx di src/ kecuali tes dan definisi klien. */
  function berkasSumber(): string[] {
    const akar = "src";
    const keluar: string[] = [];
    const jalan = (dir: string) => {
      for (const entri of readdirSync(dir, { withFileTypes: true })) {
        const jalur = `${dir}/${entri.name}`;
        if (entri.isDirectory()) jalan(jalur);
        else if (
          /\.tsx?$/.test(entri.name) &&
          !/\.test\.tsx?$/.test(entri.name)
        )
          keluar.push(jalur);
      }
    };
    jalan(akar);
    return keluar.filter((b) => b !== "src/lib/api.ts");
  }

  /** Argumen tiap `api.<non-GET>(...)` di teks, diekstrak dengan hitung kurung. */
  function argumenNonGet(teks: string): string[] {
    const pola = /api\.(POST|PUT|PATCH|DELETE)\("/g;
    const argumen: string[] = [];
    while (pola.exec(teks) !== null) {
      const mulai = pola.lastIndex;
      let kedalaman = 1;
      let i = mulai;
      while (i < teks.length && kedalaman > 0) {
        if (teks[i] === "(") kedalaman += 1;
        else if (teks[i] === ")") kedalaman -= 1;
        i += 1;
      }
      argumen.push(teks.slice(mulai, i - 1));
    }
    return argumen;
  }

  it("setiap non-GET mengirim body (→ Content-Type → lolos CSRF)", () => {
    const pelanggar: string[] = [];
    for (const berkas of berkasSumber()) {
      const teks = readFileSync(berkas, "utf8").replace(/\s+/g, "");
      for (const argumen of argumenNonGet(teks)) {
        if (!argumen.includes("body"))
          pelanggar.push(`${berkas}: api.<non-GET>(${argumen.slice(0, 48)}…)`);
      }
    }
    expect(
      pelanggar,
      `non-GET tanpa body → tanpa Content-Type → 403 bad_origin:\n${pelanggar.join("\n")}`,
    ).toEqual([]);
  });
});
