import { z } from "zod";
import { ACTION_TYPES } from "../domain/pricing.ts";
import type { PlanDraft, PlanStepDraft } from "../domain/planValidation.ts";

/** Skema output model (SPEC §6.3), persis seperti yang dikirim ke Gemini. */
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

/** `responseSchema` Gemini — subset OpenAPI, tanpa kunci yang tidak dikenal model. */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    rationale: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action_type: { type: "string", enum: [...ACTION_TYPES] },
          title: { type: "string" },
          instructions: { type: "string" },
          success_criteria: { type: "string" },
          duration_days: { type: "integer" },
          discount_percent: { type: "integer" },
          bundle_product_id: { type: "string" },
          below_cost_percent: { type: "integer" },
          share_copy: { type: "string" },
        },
        required: [
          "action_type",
          "title",
          "instructions",
          "success_criteria",
          "duration_days",
        ],
      },
    },
  },
  required: ["rationale", "steps"],
} as const;
