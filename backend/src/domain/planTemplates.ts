import type { ProductStatus } from "./product.ts";
import { deriveStep } from "./pricing.ts";
import type { PlanDraft, PlanStepDraft } from "./planValidation.ts";

/**
 * Rencana cadangan (SPEC §5.6). Semua teks bebas digit dan hanya memakai
 * placeholder yang diizinkan, supaya lolos validator §5.5 tanpa pengecualian.
 */

const TEXTS = {
  displayMove: {
    title: "Pindahkan ke rak depan",
    instructions: "Taruh dekat kasir supaya pembeli melihatnya saat membayar.",
    successCriteria: "Barang laku lagi sebelum tenggat.",
  },
  bundle: {
    title: "Jual paket hemat",
    instructions: "Pasangkan dengan barang yang paling laris di toko.",
    successCriteria: "Paket terjual sebelum tenggat.",
  },
  discount: {
    title: "Turunkan harga",
    instructions: "Pasang harga promo di rak depan dan beri tanda diskon.",
    successCriteria: "Barang laku lagi sebelum tenggat.",
  },
  sellAtCost: {
    title: "Jual seharga kulakan",
    instructions: "Jual tanpa ambil untung supaya uang kembali ke kas.",
    successCriteria: "Sisa stok berkurang sebelum tenggat.",
  },
  clearance: {
    title: "Obral rugi terakhir",
    instructions: "Obral sisa stok supaya rak kosong dan uang pulih.",
    successCriteria: "Tidak ada sisa stok di rak.",
  },
  promoCopy:
    "Promo {nama_toko}: {nama_barang} sekarang {harga_baru}. Berlaku sampai {berlaku_sampai}.",
} as const;

const RATIONALE: Record<"waspada" | "sekarat" | "mati", string> = {
  waspada: "Penjualan mulai menurun, perlu digerakkan lagi.",
  sekarat: "Barang jarang laku dan uangnya terkunci di rak.",
  mati: "Barang sudah lama tidak laku dan uangnya terkunci di rak.",
};

export interface TemplateInput {
  status: ProductStatus;
  sellPrice: number;
  lastCost: number;
  stock: number;
  /** Barang pasangan terpilih; `null` membuat tahap bundle turun jadi discount. */
  bundleProductId: string | null;
  /** Harga jual barang pasangan, untuk menghitung harga paket. */
  bundleSellPrice?: number;
}

const DURATION = 7;

function step(
  stepNo: number,
  actionType: PlanStepDraft["actionType"],
  text: { title: string; instructions: string; successCriteria: string },
  extra: Partial<PlanStepDraft> = {},
): PlanStepDraft {
  return {
    stepNo,
    actionType,
    title: text.title,
    instructions: text.instructions,
    successCriteria: text.successCriteria,
    durationDays: DURATION,
    ...extra,
  };
}

/** `discount` yang membuat harga di bawah harga beli diganti `sell_at_cost`. */
function discountOrAtCost(
  stepNo: number,
  discountPercent: number,
  input: TemplateInput,
  shareCopy?: string,
): PlanStepDraft {
  const derived = deriveStep(
    {
      actionType: "discount",
      sellPrice: input.sellPrice,
      lastCost: input.lastCost,
      discountPercent,
    },
    input.stock,
  );
  if (derived.isLoss) {
    return step(
      stepNo,
      "sell_at_cost",
      TEXTS.sellAtCost,
      shareCopy === undefined ? {} : { shareCopy },
    );
  }
  return step(stepNo, "discount", TEXTS.discount, {
    discountPercent,
    ...(shareCopy === undefined ? {} : { shareCopy }),
  });
}

function waspadaPlan(input: TemplateInput): PlanDraft {
  const bundleStep =
    input.bundleProductId === null
      ? step(2, "discount", TEXTS.discount, { discountPercent: 10 })
      : step(2, "bundle", TEXTS.bundle, {
          discountPercent: 10,
          bundleProductId: input.bundleProductId,
        });

  return {
    rationale: RATIONALE.waspada,
    steps: [
      step(1, "display_move", TEXTS.displayMove),
      bundleStep,
      step(3, "discount", TEXTS.discount, { discountPercent: 10 }),
    ],
  };
}

function sekaratPlan(input: TemplateInput): PlanDraft {
  const bundleStep =
    input.bundleProductId === null
      ? discountOrAtCost(1, 10, input)
      : step(1, "bundle", TEXTS.bundle, {
          discountPercent: 10,
          bundleProductId: input.bundleProductId,
        });

  return {
    rationale: RATIONALE.sekarat,
    steps: [
      bundleStep,
      discountOrAtCost(2, 20, input),
      step(3, "sell_at_cost", TEXTS.sellAtCost, { shareCopy: TEXTS.promoCopy }),
    ],
  };
}

function matiPlan(input: TemplateInput): PlanDraft {
  return {
    rationale: RATIONALE.mati,
    steps: [
      discountOrAtCost(1, 15, input, TEXTS.promoCopy),
      step(2, "sell_at_cost", TEXTS.sellAtCost, { shareCopy: TEXTS.promoCopy }),
      step(3, "clearance", TEXTS.clearance, {
        belowCostPercent: 20,
        shareCopy: TEXTS.promoCopy,
      }),
    ],
  };
}

/** Rencana template sesuai status barang (SPEC §5.6). */
export function templatePlan(input: TemplateInput): PlanDraft {
  switch (input.status) {
    case "waspada":
      return waspadaPlan(input);
    case "sekarat":
      return sekaratPlan(input);
    case "mati":
      return matiPlan(input);
    case "sehat":
    case "stok_habis":
      throw new Error(
        `Tidak ada rencana template untuk status ${input.status}`,
      );
  }
}
