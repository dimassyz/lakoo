import type { ProductStatus } from "./product.ts";
import {
  ACTION_TYPES,
  PARAM_RANGES,
  deriveStep,
  type ActionType,
  type PriceInput,
} from "./pricing.ts";

/** Placeholder yang boleh muncul di teks rencana (SPEC §5.5 butir 6). */
export const ALLOWED_PLACEHOLDERS: readonly string[] = [
  "nama_barang",
  "nama_toko",
  "harga_lama",
  "harga_baru",
  "hemat",
  "nama_paket",
  "harga_paket",
  "berlaku_sampai",
];

/** Batas panjang teks (SPEC §4.1). */
export const TEXT_LIMITS = {
  title: 60,
  instructions: 300,
  successCriteria: 120,
  shareCopy: 500,
  rationale: 200,
} as const;

export interface PlanStepDraft {
  stepNo: number;
  actionType: ActionType;
  title: string;
  instructions: string;
  successCriteria: string;
  durationDays: number;
  discountPercent?: number | null;
  belowCostPercent?: number | null;
  bundleProductId?: string | null;
  shareCopy?: string | null;
}

export interface PlanDraft {
  rationale: string;
  steps: PlanStepDraft[];
}

/** Kandidat barang pasangan bundle: semua produk aktif milik toko yang sama. */
export interface BundleCandidate {
  productId: string;
  status: ProductStatus;
  isComplementary: boolean;
  sellPrice: number;
}

export interface ValidationContext {
  productId: string;
  productStatus: ProductStatus;
  sellPrice: number;
  lastCost: number;
  stock: number;
  bundleCandidates: readonly BundleCandidate[];
}

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

function checkText(
  field: keyof typeof TEXT_LIMITS,
  text: string,
  errors: string[],
): void {
  if (text.length > TEXT_LIMITS[field]) {
    errors.push(`${field} maksimal ${TEXT_LIMITS[field]} karakter`);
  }
  // Angka hanya boleh masuk lewat placeholder (SPEC §5.5 butir 6).
  if (/\d/.test(text)) errors.push(`${field} tidak boleh mengandung digit`);

  for (const match of text.matchAll(/\{([^}]*)\}/g)) {
    const name = match[1] ?? "";
    if (!ALLOWED_PLACEHOLDERS.includes(name)) {
      errors.push(`${field} memakai placeholder tak dikenal: {${name}}`);
    }
  }
}

function priceInputOf(step: PlanStepDraft, ctx: ValidationContext): PriceInput {
  return {
    actionType: step.actionType,
    sellPrice: ctx.sellPrice,
    lastCost: ctx.lastCost,
    ...(step.discountPercent === null || step.discountPercent === undefined
      ? {}
      : { discountPercent: step.discountPercent }),
    ...(step.belowCostPercent === null || step.belowCostPercent === undefined
      ? {}
      : { belowCostPercent: step.belowCostPercent }),
    ...(step.bundleProductId === null || step.bundleProductId === undefined
      ? {}
      : {
          bundleSellPrice: ctx.bundleCandidates.find(
            (candidate) => candidate.productId === step.bundleProductId,
          )?.sellPrice,
        }),
  };
}

function requirePercent(
  value: number | null | undefined,
  range: { min: number; max: number },
  label: string,
  errors: string[],
): void {
  if (value === null || value === undefined) {
    errors.push(`${label} wajib diisi`);
    return;
  }
  if (value < range.min || value > range.max) {
    errors.push(`${label} harus ${range.min}–${range.max}`);
  }
}

function checkParams(step: PlanStepDraft, errors: string[]): void {
  switch (step.actionType) {
    case "bundle":
      requirePercent(
        step.discountPercent,
        PARAM_RANGES.bundleDiscount,
        "discount_percent bundle",
        errors,
      );
      break;
    case "discount":
      requirePercent(
        step.discountPercent,
        PARAM_RANGES.discount,
        "discount_percent diskon",
        errors,
      );
      break;
    case "promo_wa": {
      const percent = step.discountPercent;
      // promo_wa boleh tanpa persen (artinya harga tetap).
      if (percent !== null && percent !== undefined) {
        requirePercent(
          percent,
          PARAM_RANGES.promoWaDiscount,
          "discount_percent promo_wa",
          errors,
        );
      }
      if (
        step.shareCopy === null ||
        step.shareCopy === undefined ||
        step.shareCopy === ""
      ) {
        errors.push("promo_wa wajib punya share_copy");
      }
      break;
    }
    case "clearance":
      requirePercent(
        step.belowCostPercent,
        PARAM_RANGES.belowCost,
        "below_cost_percent",
        errors,
      );
      break;
    default:
      break;
  }
}

function checkBundle(
  step: PlanStepDraft,
  ctx: ValidationContext,
  errors: string[],
): void {
  const bundleId = step.bundleProductId;
  if (bundleId === null || bundleId === undefined) {
    errors.push("bundle wajib punya bundle_product_id");
    return;
  }
  if (bundleId === ctx.productId) {
    errors.push("barang tidak boleh dipasangkan dengan dirinya sendiri");
    return;
  }
  const candidate = ctx.bundleCandidates.find(
    (row) => row.productId === bundleId,
  );
  if (candidate === undefined) {
    errors.push("bundle_product_id bukan barang aktif milik toko ini");
    return;
  }
  if (candidate.isComplementary)
    errors.push("barang pasangan tidak boleh pelengkap");
  if (candidate.status !== "sehat" && candidate.status !== "waspada") {
    errors.push("barang pasangan harus sehat atau waspada");
  }
}

/**
 * Validasi rencana (SPEC §5.5). Dipakai untuk output AI maupun template;
 * output AI yang tidak valid diganti template seluruhnya, bukan diperbaiki sebagian.
 */
/** Aturan yang bergantung pada status barang dan jenis aksi (§5.5 #3, #4, #5). */
function checkActionRules(
  step: PlanStepDraft,
  ctx: ValidationContext,
  errors: string[],
): void {
  if (step.actionType === "clearance" && step.stepNo === 1) {
    errors.push("clearance hanya boleh di tahap 2–3");
  }
  if (
    ctx.productStatus === "waspada" &&
    (step.actionType === "clearance" || step.actionType === "sell_at_cost")
  ) {
    errors.push(
      "status waspada tidak boleh memakai clearance atau sell_at_cost",
    );
  }
  if (step.actionType === "bundle") checkBundle(step, ctx, errors);
}

function checkTexts(step: PlanStepDraft, errors: string[]): void {
  checkText("title", step.title, errors);
  checkText("instructions", step.instructions, errors);
  checkText("successCriteria", step.successCriteria, errors);
  if (step.shareCopy !== null && step.shareCopy !== undefined) {
    checkText("shareCopy", step.shareCopy, errors);
  }
}

function checkStep(
  step: PlanStepDraft,
  ctx: ValidationContext,
  errors: string[],
): void {
  if (!ACTION_TYPES.includes(step.actionType)) {
    errors.push(`action_type tidak dikenal: ${String(step.actionType)}`);
    return;
  }
  checkParams(step, errors);
  checkActionRules(step, ctx, errors);
  checkTexts(step, errors);
  if (step.durationDays < 3 || step.durationDays > 21) {
    errors.push("duration_days harus 3–21");
  }
}

/**
 * Validasi rencana (SPEC §5.5). Dipakai untuk output AI maupun template;
 * output AI yang tidak valid diganti template seluruhnya, bukan diperbaiki sebagian.
 */
export function validatePlan(
  draft: PlanDraft,
  ctx: ValidationContext,
): ValidationResult {
  const errors: string[] = [];

  if (draft.rationale.length > TEXT_LIMITS.rationale) {
    errors.push(`rationale maksimal ${TEXT_LIMITS.rationale} karakter`);
  }
  if (draft.steps.length !== 3) {
    errors.push("rencana harus tepat 3 tahap");
  }
  const stepNos = draft.steps.map((step) => step.stepNo).sort((a, b) => a - b);
  if (stepNos.join(",") !== "1,2,3") {
    errors.push("step_no harus 1, 2, dan 3 tanpa duplikat");
  }

  for (const step of draft.steps) checkStep(step, ctx, errors);

  // BR-11: tahap pertama tidak boleh rugi.
  const stepOne = draft.steps.find((step) => step.stepNo === 1);
  if (stepOne !== undefined && ACTION_TYPES.includes(stepOne.actionType)) {
    if (deriveStep(priceInputOf(stepOne, ctx), ctx.stock).isLoss) {
      errors.push("tahap 1 tidak boleh rugi");
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
