import {
  SYSTEM_INSTRUCTION,
  buildContext,
  type PromptContext,
} from "./prompt.ts";
import { aiPlanSchema, type AiPlan } from "./schema.ts";

/** Batas keras SPEC §6.1 #4. */
export const AI_TIMEOUT_MS = 12_000;

/** Setelan client AI (OpenAI-compatible), seluruhnya dari env — lihat readAiSettings. */
export interface AiClientConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface AiPlanResult {
  plan: AiPlan;
  inputTokens: number;
  outputTokens: number;
}

interface ChatCompletionBody {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function requestBody(config: AiClientConfig, context: PromptContext): string {
  return JSON.stringify({
    model: config.model,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: buildContext(context) },
    ],
  });
}

function contentOf(body: ChatCompletionBody): string {
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string")
    throw new Error("AI tidak mengembalikan teks");
  return content;
}

/** Model kadang membungkus JSON dengan pagar markdown — lepas sebelum parse. */
function parsePlan(text: string): AiPlan {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return aiPlanSchema.parse(JSON.parse(cleaned));
}

/**
 * Satu panggilan chat-completions, tanpa retry (SPEC §6.1 #4). Kegagalan apa
 * pun (jaringan, timeout, status non-2xx termasuk 402, JSON tidak sah)
 * dilempar ke pemanggil — yang mengubahnya jadi rencana template, bukan
 * error ke pengguna.
 */
export async function requestPlan(
  config: AiClientConfig,
  context: PromptContext,
  fetchImpl: typeof fetch = fetch,
): Promise<AiPlanResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
        // Gateway menolak User-Agent bawaan Node ("node") — UA ini wajib (terverifikasi).
        "user-agent": "curl/8.5.0",
      },
      signal: controller.signal,
      body: requestBody(config, context),
    });
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);

    const body = (await response.json()) as ChatCompletionBody;
    return {
      plan: parsePlan(contentOf(body)),
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
