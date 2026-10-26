import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AnyDb } from "../../../../database/src/db.ts";
import { currentSession } from "../auth-context.ts";
import { notFound } from "../errors.ts";
import { loadProductDetail } from "../productView.ts";
import type { ProductSummary } from "../serialize.ts";
import { findProduct } from "../../repo/products.ts";
import { aiQuotaFor, recordAiUsage } from "../../repo/aiUsage.ts";
import { PLAN_GENERATE_RULE, consumeRateLimit } from "../rate-limit.ts";
import { ApiError, validationError } from "../errors.ts";
import { loadProductSummaries, loadProducts } from "../productView.ts";
import { generatePlan, readAiSettings } from "../../ai/generate.ts";
import { weekdayName } from "../../ai/prompt.ts";
import {
  validatePlan,
  type BundleCandidate,
} from "../../domain/planValidation.ts";
import { lockedValue, type ProductStatus } from "../../domain/product.ts";
import {
  currentPlanOf,
  findLivePlan,
  findPlan,
  listPlans,
  productForPlan,
  savePlan,
  startPlan,
  applyStepPrice,
  recordStepOutcome,
  stopPlan,
} from "../../repo/plans.ts";
import { todayIso } from "./products.ts";

export interface PlanDeps {
  db: AnyDb;
  now: () => Date;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

const PLANNABLE: readonly ProductStatus[] = ["waspada", "sekarat", "mati"];
const PLAN_STATES = [
  "suggested",
  "active",
  "completed",
  "exhausted",
  "stopped",
  "sold_out",
];

const generateBody = z
  .object({ regenerate: z.boolean().default(false) })
  .strict();

const stateQuery = z.object({
  state: z
    .string()
    .optional()
    .transform((raw) => (raw === undefined || raw === "" ? [] : raw.split(",")))
    .pipe(z.array(z.enum(PLAN_STATES as [string, ...string[]]))),
});

/** Barang harus ada, aktif, dan berstatus yang boleh dibuatkan rencana. */
async function requirePlannable(
  deps: PlanDeps,
  storeId: string,
  productId: string,
  today: string,
) {
  const product = await productForPlan(deps.db, storeId, productId);
  if (product === null)
    throw new ApiError(404, "not_found", "Barang tidak ditemukan.");

  const { stats, items: summaries } = await loadProducts(
    deps.db,
    storeId,
    today,
  );
  const summary = summaries.find((item) => item.id === productId);
  if (summary === undefined)
    throw new ApiError(404, "not_found", "Barang tidak ditemukan.");

  if (summary.isComplementary || !PLANNABLE.includes(summary.status)) {
    throw new ApiError(
      409,
      "plan_not_applicable",
      "Barang ini tidak bisa dibuatkan rencana.",
    );
  }
  // Riwayat 7 minggu untuk prompt AI — tanpa ini saran tidak punya dasar data.
  const weekQty =
    stats.find((stat) => stat.productId === productId)?.weekQty ?? [];
  return { summary, summaries, weekQty };
}

export function bundleCandidatesOf(
  summaries: Awaited<ReturnType<typeof loadProductSummaries>>,
  productId: string,
): BundleCandidate[] {
  return summaries
    .filter((item) => item.id !== productId && !item.isComplementary)
    .map((item) => ({
      productId: item.id,
      status: item.status,
      isComplementary: item.isComplementary,
      sellPrice: item.sellPrice,
    }));
}

function promptOf(
  store: {
    name: string;
    storeType: string | null;
    location: string | null;
    customerTypes: string[];
  },
  summary: Awaited<ReturnType<typeof loadProductSummaries>>[number],
  candidates: BundleCandidate[],
  summaries: Awaited<ReturnType<typeof loadProductSummaries>>,
  today: string,
  weekQty: readonly number[],
) {
  const names = new Map(summaries.map((item) => [item.id, item]));
  return {
    store: {
      name: store.name,
      storeType: store.storeType,
      location: store.location,
      customerTypes: store.customerTypes,
    },
    product: {
      id: summary.id,
      name: summary.name,
      category: summary.category,
      unit: summary.unit,
      sellPrice: summary.sellPrice,
      lastCost: summary.lastCost,
      stock: summary.stock,
      status: summary.status,
      daysSinceLastSale: summary.daysSinceLastSale,
      weekQty,
    },
    bundleCandidates: candidates.slice(0, 8).map((candidate) => ({
      id: candidate.productId,
      name: names.get(candidate.productId)?.name ?? "",
      category: names.get(candidate.productId)?.category ?? null,
      sellPrice: candidate.sellPrice,
      sold28: names.get(candidate.productId)?.sold28 ?? 0,
    })),
    today: { date: today, weekday: weekdayName(today) },
  };
}

async function readRegenerate(c: Context): Promise<boolean> {
  const raw = await c.req.text();
  const parsed = generateBody.safeParse(raw === "" ? {} : JSON.parse(raw));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw validationError({
      [issue?.path.join(".") ?? "body"]: issue?.message ?? "tidak valid",
    });
  }
  return parsed.data.regenerate;
}

async function requireNoActivePlan(
  deps: PlanDeps,
  storeId: string,
  productId: string,
): Promise<void> {
  if ((await findLivePlan(deps.db, storeId, productId, ["active"])) !== null) {
    throw new ApiError(
      409,
      "plan_already_active",
      "Barang ini sudah punya rencana berjalan.",
    );
  }
}

/** `regenerate=false` dan sudah ada `suggested` → pakai yang ada, tanpa AI. */
async function cachedPlan(
  deps: PlanDeps,
  storeId: string,
  productId: string,
  regenerate: boolean,
) {
  if (regenerate) return null;
  const suggested = await findLivePlan(deps.db, storeId, productId, [
    "suggested",
  ]);
  return suggested === null
    ? null
    : findPlan(deps.db, storeId, suggested.id, todayIso(deps.now()));
}

export interface ComposeInput {
  store: {
    id: string;
    name: string;
    storeType: string | null;
    location: string | null;
    customerTypes: string[];
  };
  productId: string;
  summary: Awaited<ReturnType<typeof loadProductSummaries>>[number];
  summaries: Awaited<ReturnType<typeof loadProductSummaries>>;
  weekQty: readonly number[];
  candidates: BundleCandidate[];
  today: string;
}

/** Masukan template §5.6 dari ringkasan barang + kandidat bundel. */
function templateOf(summary: ProductSummary, candidates: BundleCandidate[]) {
  return {
    status: summary.status,
    sellPrice: summary.sellPrice,
    lastCost: summary.lastCost,
    stock: summary.stock,
    bundleProductId: candidates[0]?.productId ?? null,
    bundleSellPrice: candidates[0]?.sellPrice,
  };
}

export async function composeAndSave(deps: PlanDeps, input: ComposeInput) {
  const { store, productId, summary, summaries, candidates, today, weekQty } =
    input;
  const settings = readAiSettings(deps.env);
  const validation = {
    productId,
    productStatus: summary.status,
    sellPrice: summary.sellPrice,
    lastCost: summary.lastCost,
    stock: summary.stock,
    bundleCandidates: candidates,
  };

  const result = await generatePlan({
    template: templateOf(summary, candidates),
    validation,
    prompt: promptOf(store, summary, candidates, summaries, today, weekQty),
    settings,
    quota: await aiQuotaFor(deps.db, store.id, today),
    fetchImpl: deps.fetchImpl,
  });

  // AI bisa mengembalikan JSON sah tapi melanggar aturan bisnis (SPEC §5.5).
  if (!validatePlan(result.draft, validation).ok) {
    throw new ApiError(500, "internal_error", "Rencana gagal disusun.");
  }

  // SPEC §6.1 #7: hanya panggilan yang benar-benar memakai AI yang dicatat.
  if (result.source === "ai") {
    await recordAiUsage(
      deps.db,
      today,
      result.inputTokens,
      result.outputTokens,
    );
  }

  return savePlan(
    deps.db,
    {
      storeId: store.id,
      productId,
      draft: result.draft,
      source: result.source,
      status: summary.status,
      aiModel: result.source === "ai" ? settings.model : null,
      sellPrice: summary.sellPrice,
      lastCost: summary.lastCost,
      stock: summary.stock,
      bundleSellPrices: new Map(
        candidates.map((item) => [item.productId, item.sellPrice]),
      ),
      now: deps.now(),
    },
    today,
  );
}

async function handleGenerate(c: Context, deps: PlanDeps) {
  const { store } = await currentSession(c, deps);
  await consumeRateLimit(deps.db, PLAN_GENERATE_RULE, store.id, deps.now());
  const productId = c.req.param("productId") ?? "";
  const regenerate = await readRegenerate(c);
  const today = todayIso(deps.now());

  const { summary, summaries, weekQty } = await requirePlannable(
    deps,
    store.id,
    productId,
    today,
  );
  await requireNoActivePlan(deps, store.id, productId);

  const cached = await cachedPlan(deps, store.id, productId, regenerate);
  if (cached !== null) return c.json(cached, 200);

  const saved = await composeAndSave(deps, {
    store,
    productId,
    summary,
    summaries,
    candidates: bundleCandidatesOf(summaries, productId),
    today,
    weekQty,
  });
  return c.json(saved, 201);
}

async function handleCurrent(c: Context, deps: PlanDeps) {
  const { store } = await currentSession(c, deps);
  const productId = c.req.param("productId") ?? "";
  const product = await productForPlan(deps.db, store.id, productId);
  if (product === null)
    throw new ApiError(404, "not_found", "Barang tidak ditemukan.");
  return c.json(
    await currentPlanOf(deps.db, store.id, productId, todayIso(deps.now())),
  );
}

async function handleList(c: Context, deps: PlanDeps) {
  const { store } = await currentSession(c, deps);
  const parsed = stateQuery.safeParse(c.req.query());
  if (!parsed.success) {
    throw validationError({ state: "state tidak dikenal" });
  }
  return c.json({
    items: await listPlans(
      deps.db,
      store.id,
      parsed.data.state,
      todayIso(deps.now()),
    ),
  });
}

async function handleStart(c: Context, deps: PlanDeps) {
  const { store } = await currentSession(c, deps);
  const planId = c.req.param("planId") ?? "";
  const today = todayIso(deps.now());
  const existing = await findPlan(deps.db, store.id, planId, today);
  if (existing === null)
    throw new ApiError(404, "not_found", "Rencana tidak ditemukan.");

  const summaries = await loadProductSummaries(deps.db, store.id, today);
  const summary = summaries.find((item) => item.id === existing.productId);
  const locked =
    summary === undefined ? 0 : lockedValue(summary.stock, summary.lastCost);

  return c.json(await startPlan(deps.db, store.id, planId, today, locked));
}

const outcomeBody = z
  .object({ outcome: z.enum(["succeeded", "failed"]) })
  .strict();

async function handleOutcome(c: Context, deps: PlanDeps) {
  const { store } = await currentSession(c, deps);
  const planId = c.req.param("planId") ?? "";
  const stepNo = Number(c.req.param("stepNo"));

  const parsed = outcomeBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    throw validationError({ outcome: "harus succeeded atau failed" });
  }
  if (!Number.isInteger(stepNo) || stepNo < 1 || stepNo > 3) {
    throw validationError({ stepNo: "harus 1 sampai 3" });
  }

  return c.json(
    await recordStepOutcome(
      deps.db,
      store.id,
      planId,
      stepNo,
      parsed.data.outcome,
      todayIso(deps.now()),
    ),
  );
}

async function handleStop(c: Context, deps: PlanDeps) {
  const { store } = await currentSession(c, deps);
  const planId = c.req.param("planId") ?? "";
  return c.json(
    await stopPlan(deps.db, store.id, planId, todayIso(deps.now())),
  );
}

async function handleApplyPrice(c: Context, deps: PlanDeps) {
  const { store } = await currentSession(c, deps);
  const planId = c.req.param("planId") ?? "";
  const stepNo = Number(c.req.param("stepNo"));
  if (!Number.isInteger(stepNo) || stepNo < 1 || stepNo > 3) {
    throw validationError({ stepNo: "harus 1 sampai 3" });
  }

  const productId = await applyStepPrice(
    deps.db,
    store.id,
    planId,
    stepNo,
    deps.now(),
  );
  const product = await findProduct(deps.db, store.id, productId);
  const detail = await loadProductDetail(
    deps.db,
    store.id,
    productId,
    todayIso(deps.now()),
    product.createdAt,
  );
  if (detail === undefined) throw notFound();
  return c.json(detail);
}

export function planRoutes(deps: PlanDeps) {
  const app = new Hono();
  app.post("/products/:productId/plans", (c) => handleGenerate(c, deps));
  app.get("/products/:productId/plans/current", (c) => handleCurrent(c, deps));
  app.get("/plans", (c) => handleList(c, deps));
  app.post("/plans/:planId/start", (c) => handleStart(c, deps));
  app.post("/plans/:planId/steps/:stepNo/outcome", (c) =>
    handleOutcome(c, deps),
  );
  app.post("/plans/:planId/steps/:stepNo/apply-price", (c) =>
    handleApplyPrice(c, deps),
  );
  app.post("/plans/:planId/stop", (c) => handleStop(c, deps));
  return app;
}
