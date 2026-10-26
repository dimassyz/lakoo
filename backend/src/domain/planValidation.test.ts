import { describe, expect, it } from "vitest";
import {
  ALLOWED_PLACEHOLDERS,
  validatePlan,
  type PlanDraft,
  type ValidationContext,
} from "./planValidation.ts";

function ctx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    productId: "p1",
    productStatus: "sekarat",
    sellPrice: 20_000,
    lastCost: 12_000,
    stock: 10,
    bundleCandidates: [
      {
        productId: "b1",
        status: "sehat",
        isComplementary: false,
        sellPrice: 10_000,
      },
    ],
    ...overrides,
  };
}

function draft(): PlanDraft {
  return {
    rationale: "Barang lama tidak laku dan uangnya terkunci di rak",
    steps: [
      {
        stepNo: 1,
        actionType: "bundle",
        title: "Paket hemat",
        instructions: "Jual paket bersama barang laris",
        successCriteria: "Paket terjual",
        durationDays: 7,
        discountPercent: 10,
        bundleProductId: "b1",
      },
      {
        stepNo: 2,
        actionType: "discount",
        title: "Turunkan harga",
        instructions: "Pasang promo di rak depan",
        successCriteria: "Barang laku",
        durationDays: 7,
        discountPercent: 20,
      },
      {
        stepNo: 3,
        actionType: "sell_at_cost",
        title: "Jual seharga kulakan",
        instructions: "Kembalikan uang ke kas",
        successCriteria: "Stok berkurang",
        durationDays: 7,
      },
    ],
  };
}

const errorsOf = (plan: PlanDraft, context = ctx()): string[] => {
  const result = validatePlan(plan, context);
  return result.ok ? [] : result.errors;
};

describe("rencana valid", () => {
  it("lolos untuk rencana sekarat yang wajar", () => {
    expect(errorsOf(draft())).toEqual([]);
  });

  it("lolos untuk rencana waspada tanpa clearance/sell_at_cost", () => {
    const plan = draft();
    plan.steps[2] = {
      stepNo: 3,
      actionType: "discount",
      title: "Diskon lanjutan",
      instructions: "Turunkan lagi bila perlu",
      successCriteria: "Barang laku",
      durationDays: 7,
      discountPercent: 10,
    };
    expect(errorsOf(plan, ctx({ productStatus: "waspada" }))).toEqual([]);
  });

  it("menerima placeholder yang terdaftar", () => {
    const plan = draft();
    plan.steps[0]!.shareCopy =
      "Promo {nama_toko}: {nama_barang} jadi {harga_baru} dari {harga_lama}";
    expect(errorsOf(plan)).toEqual([]);
  });
});

describe("aturan 1 — tepat 3 tahap", () => {
  it("menolak jumlah tahap selain 3", () => {
    const plan = draft();
    plan.steps.pop();
    expect(errorsOf(plan).join(" ")).toContain("tepat 3 tahap");
  });

  it("menolak step_no duplikat", () => {
    const plan = draft();
    plan.steps[2]!.stepNo = 2;
    expect(errorsOf(plan).join(" ")).toContain("step_no");
  });
});

describe("aturan 2 — rentang parameter", () => {
  it("menolak diskon di bawah 5%", () => {
    const plan = draft();
    plan.steps[1]!.discountPercent = 4;
    expect(errorsOf(plan).join(" ")).toContain("5–50");
  });

  it("menolak diskon bundle di atas 30%", () => {
    const plan = draft();
    plan.steps[0]!.discountPercent = 31;
    expect(errorsOf(plan).join(" ")).toContain("5–30");
  });

  it("menolak clearance tanpa below_cost_percent", () => {
    const plan = draft();
    plan.steps[2] = {
      stepNo: 3,
      actionType: "clearance",
      title: "Obral",
      instructions: "Obral sisa stok",
      successCriteria: "Rak kosong",
      durationDays: 7,
    };
    expect(errorsOf(plan).join(" ")).toContain("below_cost_percent");
  });

  it("menolak promo_wa tanpa share_copy", () => {
    const plan = draft();
    plan.steps[2] = {
      stepNo: 3,
      actionType: "promo_wa",
      title: "Sebar promo",
      instructions: "Kirim ke pelanggan",
      successCriteria: "Ada yang datang",
      durationDays: 7,
      discountPercent: 0,
    };
    expect(errorsOf(plan).join(" ")).toContain("share_copy");
  });
});

describe("aturan 3 — BR-11 tahap 1 tidak boleh rugi", () => {
  it("menolak clearance di tahap 1", () => {
    const plan = draft();
    plan.steps[0] = {
      stepNo: 1,
      actionType: "clearance",
      title: "Obral",
      instructions: "Obral sisa stok",
      successCriteria: "Rak kosong",
      durationDays: 7,
      belowCostPercent: 20,
    };
    const errors = errorsOf(plan).join(" ");
    expect(errors).toContain("clearance hanya boleh di tahap 2–3");
    expect(errors).toContain("tahap 1 tidak boleh rugi");
  });

  it("menolak diskon tahap 1 yang membuat harga di bawah harga beli", () => {
    const plan = draft();
    plan.steps[0] = {
      stepNo: 1,
      actionType: "discount",
      title: "Diskon besar",
      instructions: "Turunkan harga",
      successCriteria: "Barang laku",
      durationDays: 7,
      discountPercent: 50,
    };
    // 20.000 × 0,5 = 10.000 < 12.000 → rugi
    expect(errorsOf(plan).join(" ")).toContain("tahap 1 tidak boleh rugi");
  });
});

describe("aturan 4 — status waspada", () => {
  it("menolak clearance untuk barang waspada", () => {
    const plan = draft();
    plan.steps[2] = {
      stepNo: 3,
      actionType: "clearance",
      title: "Obral",
      instructions: "Obral sisa stok",
      successCriteria: "Rak kosong",
      durationDays: 7,
      belowCostPercent: 20,
    };
    expect(
      errorsOf(plan, ctx({ productStatus: "waspada" })).join(" "),
    ).toContain("waspada");
  });

  it("menolak sell_at_cost untuk barang waspada", () => {
    expect(
      errorsOf(draft(), ctx({ productStatus: "waspada" })).join(" "),
    ).toContain("waspada");
  });
});

describe("aturan 5 — barang pasangan bundle", () => {
  it("menolak pasangan diri sendiri", () => {
    const plan = draft();
    plan.steps[0]!.bundleProductId = "p1";
    expect(errorsOf(plan).join(" ")).toContain("dirinya sendiri");
  });

  it("menolak barang di luar toko", () => {
    const plan = draft();
    plan.steps[0]!.bundleProductId = "bukan-milik-toko";
    expect(errorsOf(plan).join(" ")).toContain(
      "bukan barang aktif milik toko ini",
    );
  });

  it("menolak barang pelengkap", () => {
    const plan = draft();
    const context = ctx({
      bundleCandidates: [
        {
          productId: "b1",
          status: "sehat",
          isComplementary: true,
          sellPrice: 10_000,
        },
      ],
    });
    expect(errorsOf(plan, context).join(" ")).toContain("pelengkap");
  });

  it("menolak pasangan yang tidak sehat/waspada", () => {
    const plan = draft();
    const context = ctx({
      bundleCandidates: [
        {
          productId: "b1",
          status: "mati",
          isComplementary: false,
          sellPrice: 10_000,
        },
      ],
    });
    expect(errorsOf(plan, context).join(" ")).toContain("sehat atau waspada");
  });
});

describe("aturan 6 — teks tanpa digit dan placeholder terdaftar", () => {
  it("menolak digit di title", () => {
    const plan = draft();
    plan.steps[0]!.title = "Diskon 15 persen";
    expect(errorsOf(plan).join(" ")).toContain("digit");
  });

  it("menolak digit di instructions", () => {
    const plan = draft();
    plan.steps[1]!.instructions = "Pasang diskon 20%";
    expect(errorsOf(plan).join(" ")).toContain("digit");
  });

  it("menolak digit di share_copy", () => {
    const plan = draft();
    plan.steps[0]!.shareCopy = "Harga jadi {harga_baru} saja";
    expect(errorsOf(plan)).toEqual([]);

    plan.steps[0]!.shareCopy = "Harga jadi 17.000 saja";
    expect(errorsOf(plan).join(" ")).toContain("digit");
  });

  it("menolak placeholder di luar daftar", () => {
    const plan = draft();
    plan.steps[0]!.shareCopy = "Promo {diskon_spesial} untuk {nama_barang}";
    expect(errorsOf(plan).join(" ")).toContain("placeholder tak dikenal");
  });

  it("daftar placeholder sesuai SPEC §5.5", () => {
    expect([...ALLOWED_PLACEHOLDERS].sort()).toEqual(
      [
        "berlaku_sampai",
        "harga_baru",
        "harga_lama",
        "harga_paket",
        "hemat",
        "nama_barang",
        "nama_paket",
        "nama_toko",
      ].sort(),
    );
  });
});

describe("aturan 7 — panjang teks dan durasi", () => {
  it("menolak duration_days di luar 3–21", () => {
    const plan = draft();
    plan.steps[0]!.durationDays = 2;
    expect(errorsOf(plan).join(" ")).toContain("3–21");

    plan.steps[0]!.durationDays = 22;
    expect(errorsOf(plan).join(" ")).toContain("3–21");
  });

  it("menolak title lebih dari 60 karakter", () => {
    const plan = draft();
    plan.steps[0]!.title = "a".repeat(61);
    expect(errorsOf(plan).join(" ")).toContain("title maksimal 60");
  });

  it("menolak instructions lebih dari 300 karakter", () => {
    const plan = draft();
    plan.steps[0]!.instructions = "a".repeat(301);
    expect(errorsOf(plan).join(" ")).toContain("instructions maksimal 300");
  });

  it("menolak rationale lebih dari 200 karakter", () => {
    const plan = draft();
    plan.rationale = "a".repeat(201);
    expect(errorsOf(plan).join(" ")).toContain("rationale maksimal 200");
  });
});
