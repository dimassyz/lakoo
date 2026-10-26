// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  RENEW_BEFORE_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  clearedSessionCookie,
  generateToken,
  hashToken,
  readSessionToken,
  sessionCookie,
  shouldRenew,
} from "./session.ts";

describe("token sesi", () => {
  it("32 byte acak dalam base64url tanpa padding", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("tidak pernah menghasilkan token yang sama", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));
    expect(tokens.size).toBe(200);
  });

  it("hash token deterministik dan 32 byte", () => {
    const token = generateToken();
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).toHaveLength(32);
  });

  it("token berbeda menghasilkan hash berbeda", () => {
    expect(hashToken(generateToken())).not.toEqual(hashToken(generateToken()));
  });

  it("hash tidak memuat token aslinya", () => {
    const token = generateToken();
    expect(hashToken(token).toString("base64url")).not.toContain(token);
  });
});

describe("readSessionToken", () => {
  it("mengambil nilai dari header Cookie tunggal", () => {
    expect(readSessionToken(`${SESSION_COOKIE}=abc`)).toBe("abc");
  });

  it("melewati cookie lain dan spasi", () => {
    expect(readSessionToken(`a=1; ${SESSION_COOKIE}=abc; b=2`)).toBe("abc");
  });

  it("mengembalikan undefined bila cookie tidak ada", () => {
    expect(readSessionToken("a=1; b=2")).toBeUndefined();
    expect(readSessionToken(undefined)).toBeUndefined();
    expect(readSessionToken("")).toBeUndefined();
  });

  it("mengembalikan undefined untuk cookie kosong", () => {
    expect(readSessionToken(`${SESSION_COOKIE}=`)).toBeUndefined();
  });

  it("tidak tertukar dengan cookie yang namanya berakhiran sama", () => {
    expect(readSessionToken(`bukan_${SESSION_COOKIE}=palsu`)).toBeUndefined();
  });
});

describe("cookie sesi", () => {
  it("memakai atribut SPEC §8.1", () => {
    const header = sessionCookie("tok", SESSION_TTL_SECONDS);
    expect(header).toContain(`${SESSION_COOKIE}=tok`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(header).toContain("Max-Age=2592000");
  });

  it("cookie hapus memakai atribut sama dengan Max-Age=0", () => {
    const header = clearedSessionCookie();
    expect(header).toContain(`${SESSION_COOKIE}=;`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("Max-Age=0");
  });
});

describe("shouldRenew", () => {
  const now = new Date("2026-11-09T00:00:00Z");
  const inSeconds = (seconds: number) =>
    new Date(now.getTime() + seconds * 1000);

  it("memperpanjang bila sisa kurang dari 15 hari", () => {
    expect(shouldRenew(inSeconds(RENEW_BEFORE_SECONDS - 1), now)).toBe(true);
    expect(shouldRenew(inSeconds(24 * 60 * 60), now)).toBe(true);
  });

  it("tidak memperpanjang bila sisa masih panjang", () => {
    expect(shouldRenew(inSeconds(RENEW_BEFORE_SECONDS + 1), now)).toBe(false);
    expect(shouldRenew(inSeconds(SESSION_TTL_SECONDS), now)).toBe(false);
  });

  it("sesi yang sudah lewat tetap dianggap perlu diperpanjang", () => {
    expect(shouldRenew(inSeconds(-1), now)).toBe(true);
  });
});
