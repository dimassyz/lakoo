import { describe, expect, it } from "vitest";
import {
  adaGalat,
  dariStore,
  galatDariServer,
  periksaAturan,
  type Isian,
} from "./pengaturan";
import type { Store } from "./api";

function isi(ubah: Partial<Isian> = {}): Isian {
  return {
    nama: "Warung Bu Sri",
    jenis: "warung_kelontong",
    lokasi: "Jl. Melati 3",
    pelanggan: ["warga_perumahan"],
    sehat: "14",
    mati: "45",
    waspada: "3",
    ai: true,
    ...ubah,
  };
}

const toko: Store = {
  id: "00000000-0000-4000-8000-000000000000",
  name: "Warung Bu Sri",
  storeType: "warung_kelontong",
  location: "Jl. Melati 3",
  customerTypes: ["warga_perumahan"],
  healthyDays: 14,
  deadDays: 45,
  warningWeeks: 3,
  aiEnabled: true,
  onboarded: true,
  profileComplete: true,
  isDemo: false,
};

describe("aturan status (FSD §15)", () => {
  it("isian bawaan lolos tanpa galat", () => {
    expect(adaGalat(periksaAturan(isi()))).toBe(false);
  });

  it("menerima tepat di batas bawah dan atas", () => {
    const batas = isi({ sehat: "7", mati: "180", waspada: "2" });
    expect(adaGalat(periksaAturan(batas))).toBe(false);
    const atas = isi({ sehat: "60", mati: "61", waspada: "6" });
    expect(adaGalat(periksaAturan(atas))).toBe(false);
  });

  it("menolak sehari di luar batas dan angka kosong", () => {
    expect(periksaAturan(isi({ sehat: "6" })).sehat).toBeDefined();
    expect(periksaAturan(isi({ sehat: "61" })).sehat).toBeDefined();
    expect(periksaAturan(isi({ mati: "14" })).mati).toBeDefined();
    expect(periksaAturan(isi({ mati: "181" })).mati).toBeDefined();
    expect(periksaAturan(isi({ waspada: "1" })).waspada).toBeDefined();
    expect(periksaAturan(isi({ waspada: "7" })).waspada).toBeDefined();
    expect(periksaAturan(isi({ sehat: "" })).sehat).toBeDefined();
  });

  it("menolak Sehat yang tidak lebih kecil dari Mati", () => {
    expect(periksaAturan(isi({ sehat: "45", mati: "45" })).mati).toContain(
      "lebih besar",
    );
    expect(periksaAturan(isi({ sehat: "50", mati: "45" })).mati).toContain(
      "lebih besar",
    );
  });

  it("menolak nama kosong dan nama lebih dari 60 huruf", () => {
    expect(periksaAturan(isi({ nama: "  " })).nama).toBeDefined();
    expect(periksaAturan(isi({ nama: "x".repeat(61) })).nama).toContain("60");
  });
});

describe("pemetaan galat server", () => {
  it("memetakan error.fields ke kunci isian", () => {
    const galat = galatDariServer(400, {
      error: { fields: { name: "Nama wajib", healthyDays: "Isi 7–60 hari" } },
    });
    expect(galat.nama).toBe("Nama wajib");
    expect(galat.sehat).toBe("Isi 7–60 hari");
  });

  it("jatuh ke pesan server bila field tidak dikenal", () => {
    const galat = galatDariServer(400, {
      error: { message: "Isian belum benar", fields: { aneh: "x" } },
    });
    expect(galat.umum).toBe("Isian belum benar");
  });

  it("memakai pesan tetap untuk 401/403/429", () => {
    expect(galatDariServer(401, undefined).umum).toContain("Sesi berakhir");
    expect(galatDariServer(403, undefined).umum).toContain("Akun demo");
    expect(galatDariServer(429, undefined).umum).toContain("Terlalu banyak");
  });
});

describe("dariStore", () => {
  it("mengisi form dari data server apa adanya", () => {
    expect(dariStore(toko)).toEqual({
      nama: "Warung Bu Sri",
      jenis: "warung_kelontong",
      lokasi: "Jl. Melati 3",
      pelanggan: ["warga_perumahan"],
      sehat: "14",
      mati: "45",
      waspada: "3",
      ai: true,
    });
  });

  it("mengosongkan jenis dan lokasi bila server mengirim null", () => {
    const kosong = dariStore({ ...toko, storeType: null, location: null });
    expect(kosong.jenis).toBe("");
    expect(kosong.lokasi).toBe("");
  });
});
