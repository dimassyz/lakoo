import type { PlanDraft } from "../domain/planValidation.ts";
import { templatePlan, type TemplateInput } from "../domain/planTemplates.ts";
import {
  validatePlan,
  type ValidationContext,
} from "../domain/planValidation.ts";
import { requestPlan, type GeminiConfig } from "./gemini.ts";
import type { PromptContext } from "./prompt.ts";
import { toPlanDraft } from "./schema.ts";

/** Setelan AI dari environment (SPEC §6.1 #3). */
export interface AiSettings {
  enabled: boolean;
  apiKey: string;
  model: string;
  dailyCallLimit: number;
  storeDailyLimit: number;
}

const intFrom = (raw: string | undefined, fallback: number): number => {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export function readAiSettings(
  env: Record<string, string | undefined> = process.env,
): AiSettings {
  return {
    enabled: env.AI_ENABLED === "true",
    apiKey: env.GEMINI_API_KEY ?? "",
    model: env.AI_MODEL ?? "gemini-2.5-flash",
    dailyCallLimit: intFrom(env.AI_DAILY_CALL_LIMIT, 80),
    storeDailyLimit: intFrom(env.AI_STORE_DAILY_LIMIT, 20),
  };
}

export interface QuotaState {
  storeAiEnabled: boolean;
  globalCallsToday: number;
  storeCallsToday: number;
}

/** Kelima syarat §6.1 #3: AI_ENABLED, GEMINI_API_KEY, aiEnabled toko, kuota global, kuota toko. */
export function aiAllowed(settings: AiSettings, quota: QuotaState): boolean {
  if (!settings.enabled || settings.apiKey === "") return false;
  if (!quota.storeAiEnabled) return false;
  if (quota.globalCallsToday >= settings.dailyCallLimit) return false;
  return quota.storeCallsToday < settings.storeDailyLimit;
}

export interface GenerateInput {
  template: TemplateInput;
  validation: ValidationContext;
  prompt: PromptContext;
  settings: AiSettings;
  quota: QuotaState;
  fetchImpl?: typeof fetch;
}

export interface GenerateResult {
  draft: PlanDraft;
  source: "ai" | "template";
  inputTokens: number;
  outputTokens: number;
  /** Diisi saat AI dipakai lalu gagal — untuk log, bukan untuk pengguna (BR-14). */
  fallbackReason?: string;
}

const configOf = (settings: AiSettings): GeminiConfig => ({
  apiKey: settings.apiKey,
  model: settings.model,
});

/**
 * Rencana AI dengan template sebagai jaring pengaman (SPEC §6.1 #6).
 * Pengguna tidak pernah melihat error teknis: kegagalan apa pun → template.
 */
export async function generatePlan(
  input: GenerateInput,
): Promise<GenerateResult> {
  const fallback = (reason: string): GenerateResult => ({
    draft: templatePlan(input.template),
    source: "template",
    inputTokens: 0,
    outputTokens: 0,
    fallbackReason: reason,
  });

  if (!aiAllowed(input.settings, input.quota))
    return fallback("ai_tidak_tersedia");

  let result;
  try {
    result = await requestPlan(
      configOf(input.settings),
      input.prompt,
      input.fetchImpl,
    );
  } catch (error) {
    return fallback(error instanceof Error ? error.message : "ai_gagal");
  }

  const draft = toPlanDraft(result.plan);
  const check = validatePlan(draft, input.validation);
  if (!check.ok) return fallback(`validasi: ${check.errors.join("; ")}`);

  return {
    draft,
    source: "ai",
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
