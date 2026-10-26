import { describe, expect, it } from "vitest";
import { hasilDariStatus, jedaBerikut } from "./worker";

describe("jeda kirim ulang outbox (FSD §0.4)", () => {
  it("30 dtk → 1 → 2 → 5 → 10 mnt, lalu bertahan di 10 mnt", () => {
    expect(jedaBerikut(1)).toBe(30_000);
    expect(jedaBerikut(2)).toBe(60_000);
    expect(jedaBerikut(3)).toBe(120_000);
    expect(jedaBerikut(4)).toBe(300_000);
    expect(jedaBerikut(5)).toBe(600_000);
    expect(jedaBerikut(9)).toBe(600_000);
    expect(jedaBerikut(99)).toBe(600_000);
  });

  it("tidak pernah undefined untuk masukan aneh", () => {
    expect(jedaBerikut(0)).toBe(600_000);
    expect(Number.isFinite(jedaBerikut(99))).toBe(true);
  });
});

describe("status HTTP → tindakan antrean (FSD §0.4)", () => {
  it("2xx dan 409 dianggap selesai", () => {
    expect(hasilDariStatus(200)).toBe("terkirim");
    expect(hasilDariStatus(201)).toBe("terkirim");
    expect(hasilDariStatus(409)).toBe("terkirim");
  });

  it("sesi habis berhenti, 422 minta diperbaiki", () => {
    expect(hasilDariStatus(401)).toBe("sesi");
    expect(hasilDariStatus(422)).toBe("tinjau");
  });

  it("gangguan sementara diulang, kesalahan permanen dibuang", () => {
    expect(hasilDariStatus(408)).toBe("ulang");
    expect(hasilDariStatus(429)).toBe("ulang");
    expect(hasilDariStatus(500)).toBe("ulang");
    expect(hasilDariStatus(503)).toBe("ulang");
    expect(hasilDariStatus(400)).toBe("buang");
    expect(hasilDariStatus(404)).toBe("buang");
  });
});
