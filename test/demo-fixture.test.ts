import { describe, expect, it } from "vitest";
import {
  DEMO_TEMPLATE_EMAIL,
  HISTORY_DAYS,
  type DemoData,
  generateDemo,
  shiftIsoDate,
} from "../database/src/demo/generator.ts";

/**
 * Verifikasi fixture data demo — SPEC §10.2.
 *
 * Catatan independensi: `database/src/demo/generator.test.ts` (milik
 * backend-dev) sudah memverifikasi determinisme, distribusi status, kasus
 * brief, dan stok non-negatif. Suite ini sengaja TIDAK mengulang itu; yang
 * diuji di sini adalah butir SPEC §10.2 yang belum punya pemilik: profil
 * toko, rentang riwayat, pola akhir pekan, dan waktu mulai rencana aktif.
 */

const AS_OF = "2026-11-09";
const data: DemoData = generateDemo(AS_OF);

/** 0 = Minggu … 6 = Sabtu (JS getUTCDay). */
function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

describe("profil toko demo (SPEC §10.2)", () => {
  it("Toko Bu Sri, toko_kelontong, Lowokwaru Malang, 3 tipe pelanggan", () => {
    expect(data.store.name).toBe("Toko Bu Sri");
    expect(data.store.storeType).toBe("toko_kelontong");
    expect(data.store.location).toBe("Kec. Lowokwaru, Malang");
    expect([...data.store.customerTypes]).toEqual([
      "warga_perumahan",
      "anak_sekolah",
      "kos_mahasiswa",
    ]);
  });

  it("ambang bawaan 14/45/3 (SPEC §5.1)", () => {
    expect(data.store.healthyDays).toBe(14);
    expect(data.store.deadDays).toBe(45);
    expect(data.store.warningWeeks).toBe(3);
  });

  it("email pemilik template sesuai konstrak", () => {
    expect(data.templateOwnerEmail).toBe(DEMO_TEMPLATE_EMAIL);
  });
});

describe("riwayat 90 hari (SPEC §10.2)", () => {
  it("±100 barang nyata", () => {
    expect(data.products.length).toBeGreaterThanOrEqual(90);
    expect(data.products.length).toBeLessThanOrEqual(110);
  });

  it("semua penjualan dan barang masuk berada dalam 90 hari terakhir", () => {
    const earliest = shiftIsoDate(AS_OF, -HISTORY_DAYS);
    for (const product of data.products) {
      for (const sale of product.sales) {
        expect(
          sale.saleDate >= earliest && sale.saleDate <= AS_OF,
          `${product.name} menjual ${sale.saleDate}`,
        ).toBe(true);
      }
      for (const row of product.stockIns) {
        expect(
          row.receivedOn >= earliest && row.receivedOn <= AS_OF,
          `${product.name} masuk ${row.receivedOn}`,
        ).toBe(true);
      }
    }
  });

  it("akhir pekan lebih ramai daripada hari kerja", () => {
    const perDay = new Map<string, number>();
    for (const product of data.products) {
      for (const sale of product.sales) {
        perDay.set(sale.saleDate, (perDay.get(sale.saleDate) ?? 0) + sale.qty);
      }
    }
    let weekendQty = 0;
    let weekendDays = 0;
    let weekdayQty = 0;
    let weekdayDays = 0;
    for (const [date, qty] of perDay) {
      if (isWeekend(date)) {
        weekendQty += qty;
        weekendDays += 1;
      } else {
        weekdayQty += qty;
        weekdayDays += 1;
      }
    }
    expect(weekendDays).toBeGreaterThan(0);
    expect(weekdayDays).toBeGreaterThan(0);
    expect(weekendQty / weekendDays).toBeGreaterThan(weekdayQty / weekdayDays);
  });
});

describe("rencana demo (SPEC §10.2)", () => {
  it("rencana active dimulai 10 hari sebelum asOf", () => {
    const active = data.plans.find((plan) => plan.state === "active");
    expect(active).toBeDefined();
    expect(active?.startedOn).toBe(shiftIsoDate(AS_OF, -10));
  });
});
