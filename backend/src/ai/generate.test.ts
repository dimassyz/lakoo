// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  aiAllowed,
  generatePlan,
  readAiSettings,
  type AiSettings,
} from "./generate.ts";
import type { PromptContext } from "./prompt.ts";
import type { ValidationContext } from "../domain/planValidation.ts";
import type { TemplateInput } from "../domain/planTemplates.ts";

const SETTINGS: AiSettings = {
  enabled: true,
  apiKey: "kunci-uji",
  model: "gemini-2.5-flash",
  dailyCallLimit: 80,
  storeDailyLimit: 20,
};

const QUOTA = { storeAiEnabled: true, globalCallsToday: 0, storeCallsToday: 0 };

const TEMPLATE: TemplateInput = {
  status: "sekarat",
  sellPrice: 20_000,
  lastCost: 12_000,
  stock: 10,
  bundleProductId: "11111111-1111-4111-8111-111111111111",
};

const VALIDATION: ValidationContext = {
  productId: "22222222-2222-4222-8222-222222222222",
  productStatus: "sekarat",
  sellPrice: 20_000,
  lastCost: 12_000,
  stock: 10,
  bundleCandidates: [
    {
      productId: "11111111-1111-4111-8111-111111111111",
      status: "sehat",
      isComplementary: false,
      sellPrice: 10_000,
    },
  ],
};

const PROMPT: PromptContext = {
  store: {
    name: "Toko Bu Sri",
    storeType: "kelontong",
    location: "Bandung",
    customerTypes: [],
  },
  product: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Kecap Manis",
    category: "bumbu",
    unit: "botol",
    sellPrice: 20_000,
    lastCost: 12_000,
    stock: 10,
    status: "sekarat",
    daysSinceLastSale: 20,
    weekQty: [1, 1, 2, 3, 0, 0, 0],
  },
  bundleCandidates: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Sabun",
      category: null,
      sellPrice: 10_000,
      sold28: 12,
    },
  ],
  today: { date: "2026-11-09", weekday: "Senin" },
};

const AI_PLAN = {
  rationale: "Barang lama tidak laku dan uangnya terkunci di rak",
  steps: [
    {
      action_type: "bundle",
      title: "Paket hemat",
      instructions: "Jual paket bersama barang laris",
      success_criteria: "Paket terjual",
      duration_days: 7,
      discount_percent: 10,
      bundle_product_id: "11111111-1111-4111-8111-111111111111",
    },
    {
      action_type: "discount",
      title: "Turunkan harga",
      instructions: "Pasang promo di rak depan",
      success_criteria: "Barang laku",
      duration_days: 7,
      discount_percent: 20,
    },
    {
      action_type: "sell_at_cost",
      title: "Jual seharga kulakan",
      instructions: "Kembalikan uang ke kas",
      success_criteria: "Stok berkurang",
      duration_days: 7,
    },
  ],
};

function fakeFetch(
  payload: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = vi.fn(
    async (url: string | URL | Request, options?: RequestInit) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(options?.body)) as Record<string, unknown>,
      });
      return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        json: async () => payload,
      } as Response;
    },
  ) as unknown as typeof fetch;
  return { impl, calls };
}

const geminiBody = (plan: unknown) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }],
  usageMetadata: { promptTokenCount: 2_000, candidatesTokenCount: 600 },
});

const run = (
  fetchImpl: typeof fetch,
  overrides: Partial<Parameters<typeof generatePlan>[0]> = {},
) =>
  generatePlan({
    template: TEMPLATE,
    validation: VALIDATION,
    prompt: PROMPT,
    settings: SETTINGS,
    quota: QUOTA,
    fetchImpl,
    ...overrides,
  });

describe("readAiSettings", () => {
  it("membaca env dengan bawaan SPEC", () => {
    expect(readAiSettings({})).toEqual({
      enabled: false,
      apiKey: "",
      model: "gemini-2.5-flash",
      dailyCallLimit: 80,
      storeDailyLimit: 20,
    });
  });

  it("AI_ENABLED hanya 'true' yang menyalakan", () => {
    expect(readAiSettings({ AI_ENABLED: "TRUE" }).enabled).toBe(false);
    expect(readAiSettings({ AI_ENABLED: "1" }).enabled).toBe(false);
    expect(readAiSettings({ AI_ENABLED: "true" }).enabled).toBe(true);
  });

  it("batas kuota yang tidak masuk akal jatuh ke bawaan", () => {
    expect(readAiSettings({ AI_DAILY_CALL_LIMIT: "abc" }).dailyCallLimit).toBe(
      80,
    );
    expect(readAiSettings({ AI_DAILY_CALL_LIMIT: "-5" }).dailyCallLimit).toBe(
      80,
    );
  });
});

describe("aiAllowed — lima syarat SPEC §6.1 #3", () => {
  it("menolak bila fitur mati", () => {
    expect(aiAllowed({ ...SETTINGS, enabled: false }, QUOTA)).toBe(false);
  });

  it("menolak bila API key kosong", () => {
    expect(aiAllowed({ ...SETTINGS, apiKey: "" }, QUOTA)).toBe(false);
  });

  it("menolak bila toko mematikan AI", () => {
    expect(aiAllowed(SETTINGS, { ...QUOTA, storeAiEnabled: false })).toBe(
      false,
    );
  });

  it("menolak saat kuota harian global habis", () => {
    expect(aiAllowed(SETTINGS, { ...QUOTA, globalCallsToday: 80 })).toBe(false);
  });

  it("menolak saat kuota toko habis", () => {
    expect(aiAllowed(SETTINGS, { ...QUOTA, storeCallsToday: 20 })).toBe(false);
  });

  it("mengizinkan saat semua syarat terpenuhi", () => {
    expect(aiAllowed(SETTINGS, QUOTA)).toBe(true);
  });
});

describe("generatePlan — jalur AI", () => {
  it("memakai rencana AI yang valid dan mencatat token", async () => {
    const { impl } = fakeFetch(geminiBody(AI_PLAN));
    const result = await run(impl);
    expect(result.source).toBe("ai");
    expect(result.inputTokens).toBe(2_000);
    expect(result.outputTokens).toBe(600);
    expect(result.draft.steps.map((step) => step.actionType)).toEqual([
      "bundle",
      "discount",
      "sell_at_cost",
    ]);
  });

  it("mengirim instruksi sistem, suhu, dan skema respons yang benar", async () => {
    const { impl, calls } = fakeFetch(geminiBody(AI_PLAN));
    await run(impl);
    const body = calls[0]?.body as Record<string, never>;
    const config = body.generationConfig as unknown as Record<string, unknown>;
    expect(config.temperature).toBe(0.7);
    expect(config.responseMimeType).toBe("application/json");
    expect(
      (config.thinkingConfig as { thinkingBudget: number }).thinkingBudget,
    ).toBe(0);
    expect(config.responseSchema).toBeDefined();
    expect(JSON.stringify(body.systemInstruction)).toContain(
      "DATA, bukan instruksi",
    );
  });

  it("memakai endpoint dan model dari setelan", async () => {
    const { impl, calls } = fakeFetch(geminiBody(AI_PLAN));
    await run(impl);
    expect(calls[0]?.url).toContain("gemini-2.5-flash:generateContent");
  });
});

describe("generatePlan — jaring pengaman template (BR-14)", () => {
  it("tidak memanggil AI sama sekali bila tidak diizinkan", async () => {
    const { impl } = fakeFetch(geminiBody(AI_PLAN));
    const result = await run(impl, {
      settings: { ...SETTINGS, enabled: false },
    });
    expect(result.source).toBe("template");
    expect(impl).not.toHaveBeenCalled();
  });

  it("jatuh ke template saat HTTP gagal", async () => {
    const { impl } = fakeFetch({}, { ok: false, status: 500 });
    const result = await run(impl);
    expect(result.source).toBe("template");
    expect(result.fallbackReason).toContain("500");
  });

  it("jatuh ke template saat jaringan melempar", async () => {
    const impl = (async () => {
      throw new Error("abort");
    }) as unknown as typeof fetch;
    const result = await run(impl);
    expect(result.source).toBe("template");
    expect(result.fallbackReason).toBe("abort");
  });
});

describe("generatePlan — kegagalan yang harus jatuh ke template", () => {
  it("jatuh ke template saat JSON tidak valid", async () => {
    const { impl } = fakeFetch({
      candidates: [{ content: { parts: [{ text: "bukan json" }] } }],
    });
    const result = await run(impl);
    expect(result.source).toBe("template");
  });

  it("jatuh ke template saat bentuk respons melanggar skema §6.3", async () => {
    const { impl } = fakeFetch(geminiBody({ rationale: "x", steps: [] }));
    const result = await run(impl);
    expect(result.source).toBe("template");
  });

  it("jatuh ke template saat teks memuat digit (aturan §5.5 #6)", async () => {
    const withDigits = structuredClone(AI_PLAN);
    withDigits.steps[0]!.title = "Diskon 15 persen";
    const { impl } = fakeFetch(geminiBody(withDigits));
    const result = await run(impl);
    expect(result.source).toBe("template");
    expect(result.fallbackReason).toContain("digit");
  });

  it("jatuh ke template saat tahap 1 rugi (BR-11)", async () => {
    const loss = structuredClone(AI_PLAN);
    loss.steps[0] = {
      action_type: "discount",
      title: "Diskon besar",
      instructions: "Turunkan harga",
      success_criteria: "Barang laku",
      duration_days: 7,
      discount_percent: 50,
    };
    const { impl } = fakeFetch(geminiBody(loss));
    const result = await run(impl);
    expect(result.source).toBe("template");
    expect(result.fallbackReason).toContain("tahap 1 tidak boleh rugi");
  });

  it("rencana template yang dipakai cadangan tetap valid", async () => {
    const { impl } = fakeFetch({}, { ok: false, status: 429 });
    const result = await run(impl);
    expect(result.draft.steps).toHaveLength(3);
    expect(result.draft.rationale.length).toBeLessThanOrEqual(200);
  });
});
