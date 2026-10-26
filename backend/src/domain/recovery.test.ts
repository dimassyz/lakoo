import { describe, expect, it } from "vitest";
import { recoveredPercent } from "./recovery.ts";

describe("recoveredPercent (SPEC §5.7)", () => {
  it("menghitung persentase kas pulih", () => {
    expect(recoveredPercent(60_000, 120_000)).toBe(50);
    expect(recoveredPercent(30_000, 120_000)).toBe(25);
  });

  it("dibatasi 100 walau penjualan melebihi uang terkunci", () => {
    expect(recoveredPercent(500_000, 120_000)).toBe(100);
  });

  it("nol bila uang terkunci nol atau negatif", () => {
    expect(recoveredPercent(50_000, 0)).toBe(0);
    expect(recoveredPercent(50_000, -1)).toBe(0);
  });

  it("membulatkan ke bilangan bulat terdekat", () => {
    expect(recoveredPercent(1, 3)).toBe(33);
    expect(recoveredPercent(2, 3)).toBe(67);
  });

  it("nol bila belum ada penjualan", () => {
    expect(recoveredPercent(0, 120_000)).toBe(0);
  });
});
