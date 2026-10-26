import {
  SYSTEM_INSTRUCTION,
  buildContext,
  type PromptContext,
} from "./prompt.ts";
import { GEMINI_RESPONSE_SCHEMA, aiPlanSchema, type AiPlan } from "./schema.ts";

/** Batas keras SPEC §6.1 #4. */
export const AI_TIMEOUT_MS = 12_000;
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export interface GeminiResult {
  plan: AiPlan;
  inputTokens: number;
  outputTokens: number;
}

interface GeminiBody {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/**
 * Satu panggilan, tanpa retry (SPEC §6.1 #4). Kegagalan apa pun dilempar ke
 * pemanggil — yang mengubahnya jadi rencana template, bukan error ke pengguna.
 */
function requestBody(context: PromptContext): string {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: buildContext(context) }] }],
    generationConfig: {
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  });
}

function textOf(body: GeminiBody): string {
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string")
    throw new Error("Gemini tidak mengembalikan teks");
  return text;
}

/**
 * Satu panggilan, tanpa retry (SPEC §6.1 #4). Kegagalan apa pun dilempar ke
 * pemanggil — yang mengubahnya jadi rencana template, bukan error ke pengguna.
 */
export async function requestPlan(
  config: GeminiConfig,
  context: PromptContext,
  fetchImpl: typeof fetch = fetch,
): Promise<GeminiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetchImpl(
      `${ENDPOINT}/${config.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": config.apiKey,
        },
        signal: controller.signal,
        body: requestBody(context),
      },
    );
    if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);

    const body = (await response.json()) as GeminiBody;
    return {
      plan: aiPlanSchema.parse(JSON.parse(textOf(body))),
      inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
