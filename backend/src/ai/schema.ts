import { z } from "zod";
import { ACTION_TYPES } from "../domain/pricing.ts";
import type { PlanDraft, PlanStepDraft } from "../domain/planValidation.ts";

/** Skema output model (SPEC §6.3) — bentuk JSON yang wajib dikembalikan AI. */
const stepSchema = z.object({
  action_type: z.enum(ACTION_TYPES),
  title: z.string().max(60),
  instructions: z.string().max(300),
  success_criteria: z.string().max(120),
  duration_days: z.number().int().min(3).max(21),
  discount_percent: z.number().int().optional(),
  bundle_product_id: z.string().uuid().optional(),
  below_cost_percent: z.number().int().optional(),
  share_copy: z.string().max(300).optional(),
});

export const aiPlanSchema = z.object({
  rationale: z.string().max(200),
  steps: z.array(stepSchema).length(3),
});

export type AiPlan = z.infer<typeof aiPlanSchema>;

/** Bentuk model (snake_case) → bentuk domain. Angka dihitung ulang di §5.4, bukan dari model. */
export function toPlanDraft(plan: AiPlan): PlanDraft {
  return {
    rationale: plan.rationale,
    steps: plan.steps.map((step, index): PlanStepDraft => ({
      stepNo: index + 1,
      actionType: step.action_type,
      title: step.title,
      instructions: step.instructions,
      successCriteria: step.success_criteria,
      durationDays: step.duration_days,
      discountPercent: step.discount_percent,
      bundleProductId: step.bundle_product_id,
      belowCostPercent: step.below_cost_percent,
      shareCopy: step.share_copy,
    })),
  };
}
