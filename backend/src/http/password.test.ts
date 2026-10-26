// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.ts";

describe("hashPassword", () => {
  it("memakai argon2id dengan parameter SPEC §8.1", async () => {
    const digest = await hashPassword("rahasia123");
    expect(digest).toContain("$argon2id$");
    expect(digest).toContain("m=19456");
    expect(digest).toContain("t=2");
    expect(digest).toContain("p=1");
  });

  it("tidak menyimpan kata sandi aslinya", async () => {
    const digest = await hashPassword("rahasia123");
    expect(digest).not.toContain("rahasia123");
  });

  it("menghasilkan salt berbeda untuk kata sandi yang sama", async () => {
    const [a, b] = await Promise.all([
      hashPassword("rahasia123"),
      hashPassword("rahasia123"),
    ]);
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("menerima kata sandi yang benar", async () => {
    const digest = await hashPassword("rahasia123");
    await expect(verifyPassword(digest, "rahasia123")).resolves.toBe(true);
  });

  it("menolak kata sandi yang salah", async () => {
    const digest = await hashPassword("rahasia123");
    await expect(verifyPassword(digest, "rahasia124")).resolves.toBe(false);
  });

  it("menolak kata sandi yang hanya berbeda kapitalisasi", async () => {
    const digest = await hashPassword("Rahasia123");
    await expect(verifyPassword(digest, "rahasia123")).resolves.toBe(false);
  });

  it("mengembalikan false, bukan melempar, untuk hash rusak", async () => {
    await expect(verifyPassword("bukan-hash-argon2", "apa saja")).resolves.toBe(
      false,
    );
    await expect(verifyPassword("", "apa saja")).resolves.toBe(false);
  });
});
