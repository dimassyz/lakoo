import { describe, expect, it } from "vitest";
import {
  STATUS_WEIGHT,
  isScored,
  prioritize,
  type ScoreInput,
} from "./score.ts";

const DEAD_DAYS = 45;
const WARNING_WEEKS = 3;

function item(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    name: "Kecap Manis Botol 600ml",
    status: "mati",
    isComplementary: false,
    lockedValue: 30_000,
    daysSinceActivity: 90,
    ...overrides,
  };
}

describe("isScored (SPEC §5.3)", () => {
  it("menyertakan waspada, sekarat, dan mati", () => {
    for (const status of ["waspada", "sekarat", "mati"] as const) {
      expect(isScored(item({ status }))).toBe(true);
    }
  });

  it("mengecualikan sehat dan stok_habis", () => {
    expect(isScored(item({ status: "sehat" }))).toBe(false);
    expect(isScored(item({ status: "stok_habis" }))).toBe(false);
  });

  it("mengecualikan pelengkap walau statusnya mati", () => {
    expect(isScored(item({ isComplementary: true }))).toBe(false);
  });
});

describe("skor", () => {
  it("memberi 100 untuk mati dengan uang terkunci maksimum dan umur maksimum", () => {
    const [scored] = prioritize([item()], DEAD_DAYS, WARNING_WEEKS);
    expect(scored?.score).toBe(100);
  });

  it("membatasi age pada 1 walau jauh melewati 2 × dead_days", () => {
    const [near] = prioritize(
      [item({ daysSinceActivity: 90 })],
      DEAD_DAYS,
      WARNING_WEEKS,
    );
    const [far] = prioritize(
      [item({ daysSinceActivity: 900 })],
      DEAD_DAYS,
      WARNING_WEEKS,
    );
    expect(far?.score).toBe(near?.score);
  });

  it("memberi skor rendah untuk waspada berumur pendek", () => {
    const [scored] = prioritize(
      [item({ status: "waspada", lockedValue: 10_000, daysSinceActivity: 3 })],
      DEAD_DAYS,
      WARNING_WEEKS,
    );
    // Satu-satunya barang di himpunan → money = 1.
    // 100 × (0.5·1 + 0.3·(3/90) + 0.2·0.3) = 100 × (0.5 + 0.01 + 0.06) = 57
    expect(scored?.score).toBe(57);
  });

  it("memakai money = 0 saat tidak ada uang terkunci sama sekali", () => {
    const [scored] = prioritize(
      [item({ lockedValue: 0, status: "sekarat", daysSinceActivity: 0 })],
      DEAD_DAYS,
      WARNING_WEEKS,
    );
    // money 0, age 0, weight 0.6 → 12
    expect(scored?.score).toBe(12);
  });

  it("menormalkan uang terkunci terhadap maksimum di himpunan skor", () => {
    const scored = prioritize(
      [
        item({ name: "A", lockedValue: 100_000 }),
        item({ name: "B", lockedValue: 50_000, daysSinceActivity: 90 }),
      ],
      DEAD_DAYS,
      WARNING_WEEKS,
    );
    expect(scored[0]?.name).toBe("A");
    expect(scored[0]?.score).toBe(100);
    expect(scored[1]?.score).toBeLessThan(100);
  });

  it("bobot status sesuai SPEC", () => {
    expect(STATUS_WEIGHT).toEqual({ waspada: 0.3, sekarat: 0.6, mati: 1 });
  });
});

describe("prioritize — urutan", () => {
  it("mengurutkan skor turun lebih dulu", () => {
    const result = prioritize(
      [
        item({
          name: "Rendah",
          status: "waspada",
          lockedValue: 1_000,
          daysSinceActivity: 1,
        }),
        item({
          name: "Tinggi",
          status: "mati",
          lockedValue: 90_000,
          daysSinceActivity: 90,
        }),
      ],
      DEAD_DAYS,
      WARNING_WEEKS,
    );
    expect(result.map((row) => row.name)).toEqual(["Tinggi", "Rendah"]);
  });

  it("memakai uang terkunci sebagai pemecah saat skor sama", () => {
    const result = prioritize(
      [
        item({ name: "Kecil", lockedValue: 10_000 }),
        item({ name: "Besar", lockedValue: 80_000 }),
      ],
      DEAD_DAYS,
      WARNING_WEEKS,
    );
    expect(result.map((row) => row.name)).toEqual(["Besar", "Kecil"]);
  });

  it("memakai nama menaik saat skor dan uang sama", () => {
    const result = prioritize(
      [item({ name: "Beras" }), item({ name: "Aqua" })],
      DEAD_DAYS,
      WARNING_WEEKS,
    );
    expect(result.map((row) => row.name)).toEqual(["Aqua", "Beras"]);
  });
});

describe("prioritize — pemecah seri", () => {
  it("membuang barang yang tidak masuk skor", () => {
    const result = prioritize(
      [
        item({ name: "Sehat", status: "sehat" }),
        item({ name: "Habis", status: "stok_habis" }),
        item({ name: "Pelengkap", isComplementary: true }),
        item({ name: "Mati" }),
      ],
      DEAD_DAYS,
      WARNING_WEEKS,
    );
    expect(result.map((row) => row.name)).toEqual(["Mati"]);
  });

  it("tidak meledak pada daftar kosong", () => {
    expect(prioritize([], DEAD_DAYS, WARNING_WEEKS)).toEqual([]);
  });
});

describe("alasan (reason)", () => {
  it("memakai format rupiah dan jumlah hari untuk sekarat/mati", () => {
    const [scored] = prioritize(
      [item({ lockedValue: 30_000, daysSinceActivity: 90 })],
      45,
      3,
    );
    expect(scored?.reason).toBe("Rp30.000 terkunci, 90 hari tidak laku");
  });

  it("menyebut jumlah minggu untuk waspada", () => {
    const [scored] = prioritize(
      [item({ status: "waspada", daysSinceActivity: 3 })],
      45,
      3,
    );
    expect(scored?.reason).toBe("Penjualan turun 3 minggu berturut-turut");
  });

  it("memakai warning_weeks dari toko, bukan konstanta", () => {
    const [scored] = prioritize([item({ status: "waspada" })], 45, 5);
    expect(scored?.reason).toContain("5 minggu");
  });
});
