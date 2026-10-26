import { describe, expect, it } from "vitest";
import {
  buildWeeklySentences,
  lastCompleteWeek,
  shouldShowWeeklySummary,
  type WeeklyFacts,
} from "./weeklySummary.ts";

const FACTS: WeeklyFacts = {
  salesTotal: 1_250_000,
  productsSold: 34,
  lockedStart: 2_000_000,
  lockedEnd: 1_800_000,
  worsened: ["Kecap Manis", "Sabun Mandi"],
  completedPlans: 2,
  recovered: 250_000,
};

describe("lastCompleteWeek", () => {
  it("hari Minggu → minggu yang baru berakhir kemarin", () => {
    expect(lastCompleteWeek("2026-11-08")).toEqual({
      weekStart: "2026-11-01",
      weekEnd: "2026-11-07",
    });
  });

  it("hari Senin → minggu yang berakhir dua hari lalu", () => {
    expect(lastCompleteWeek("2026-11-09")).toEqual({
      weekStart: "2026-11-01",
      weekEnd: "2026-11-07",
    });
  });

  it("hari Sabtu belum minggu lengkap → mundur tujuh hari", () => {
    expect(lastCompleteWeek("2026-11-07")).toEqual({
      weekStart: "2026-10-25",
      weekEnd: "2026-10-31",
    });
  });

  it("selalu Minggu–Sabtu, tujuh hari", () => {
    for (let d = 1; d <= 14; d += 1) {
      const today = `2026-11-${String(d).padStart(2, "0")}`;
      const { weekStart, weekEnd } = lastCompleteWeek(today);
      const span =
        (Date.parse(`${weekEnd}T00:00:00Z`) -
          Date.parse(`${weekStart}T00:00:00Z`)) /
        86_400_000;
      expect(span).toBe(6);
      expect(new Date(`${weekStart}T00:00:00Z`).getUTCDay()).toBe(0);
      expect(new Date(`${weekEnd}T00:00:00Z`).getUTCDay()).toBe(6);
      expect(weekEnd < today).toBe(true);
    }
  });
});

describe("shouldShowWeeklySummary", () => {
  it("hanya Minggu dan Senin", () => {
    expect(shouldShowWeeklySummary("2026-11-08")).toBe(true); // Minggu
    expect(shouldShowWeeklySummary("2026-11-09")).toBe(true); // Senin
    expect(shouldShowWeeklySummary("2026-11-10")).toBe(false); // Selasa
    expect(shouldShowWeeklySummary("2026-11-07")).toBe(false); // Sabtu
  });
});

describe("kalimat ringkasan (SPEC §5.9)", () => {
  it("tiga kalimat dengan angka terformat", () => {
    const sentences = buildWeeklySentences(FACTS);
    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toBe(
      "Minggu lalu terjual Rp1.250.000 dari 34 barang. " +
        "Uang terkunci turun Rp200.000 menjadi Rp1.800.000.",
    );
    expect(sentences[1]).toBe(
      "2 barang butuh perhatian: Kecap Manis, Sabun Mandi.",
    );
    expect(sentences[2]).toBe(
      "2 rencana selesai, kas pulih Rp250.000 minggu ini.",
    );
  });

  it("arah uang terkunci naik / turun / tetap", () => {
    const naik = buildWeeklySentences({
      ...FACTS,
      lockedStart: 100_000,
      lockedEnd: 300_000,
    });
    expect(naik[0]).toContain("naik Rp200.000");

    const tetap = buildWeeklySentences({
      ...FACTS,
      lockedStart: 300_000,
      lockedEnd: 300_000,
    });
    expect(tetap[0]).toContain("tetap Rp0");
  });

  it("minggu tanpa penjualan memakai kalimat khusus", () => {
    const sentences = buildWeeklySentences({
      ...FACTS,
      salesTotal: 0,
      productsSold: 0,
    });
    expect(sentences[0]).toBe("Minggu lalu belum ada penjualan tercatat.");
  });

  it("tanpa barang memburuk", () => {
    const sentences = buildWeeklySentences({ ...FACTS, worsened: [] });
    expect(sentences[1]).toBe("Tidak ada barang yang memburuk minggu ini.");
  });
});

describe("kalimat ringkasan — kasus tepi", () => {
  it("lebih dari tiga nama diringkas dengan 'dan lainnya'", () => {
    const sentences = buildWeeklySentences({
      ...FACTS,
      worsened: ["A", "B", "C", "D"],
    });
    expect(sentences[1]).toBe(
      "4 barang butuh perhatian: A, B, C, dan lainnya.",
    );
  });

  it("tepat tiga nama tanpa 'dan lainnya'", () => {
    const sentences = buildWeeklySentences({
      ...FACTS,
      worsened: ["A", "B", "C"],
    });
    expect(sentences[1]).toBe("3 barang butuh perhatian: A, B, C.");
  });

  it("tanpa rencana selesai", () => {
    const sentences = buildWeeklySentences({
      ...FACTS,
      completedPlans: 0,
      recovered: 0,
    });
    expect(sentences[2]).toBe(
      "Belum ada rencana yang selesai — pilih satu barang di Beranda untuk mulai.",
    );
  });
});
