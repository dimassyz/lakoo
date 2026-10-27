import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AnyDb } from "../../../../database/src/db.ts";
import { currentSession } from "../auth-context.ts";
import { ApiError, validationError } from "../errors.ts";
import { findIdempotent } from "../../repo/idempotency.ts";
import { listProductStats } from "../../repo/products.ts";
import { hasSalesOn, recapRows, saveRecap } from "../../repo/salesRecap.ts";
import { fieldMessage } from "../validate.ts";
import { todayIso } from "./products.ts";

export interface SalesDeps {
  db: AnyDb;
  now: () => Date;
}

const ENDPOINT = "PUT /sales/recap";
const MAX_LINES = 600;
const MAX_AGE_DAYS = 365;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "tanggal harus format YYYY-MM-DD"),
});

const recapBody = z
  .object({
    date: z.string().regex(ISO_DATE, "tanggal harus format YYYY-MM-DD"),
    mode: z.enum(["quantity", "opname"]),
    lines: z
      .array(
        z
          .object({
            productId: z.string().uuid("productId harus UUID"),
            qty: z.number().int().min(0).max(100_000).optional(),
            countedStock: z.number().int().min(0).max(100_000).optional(),
          })
          .strict(),
      )
      .min(1, "minimal satu baris")
      .max(MAX_LINES, `maksimal ${MAX_LINES} baris`),
  })
  .strict();

type RecapBody = z.infer<typeof recapBody>;

const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

/** `sale_date` tidak di masa depan (WIB) dan tidak lebih dari 365 hari lalu. */
function checkDate(date: string, today: string): void {
  if (date > today) {
    throw validationError({ date: "tanggal tidak boleh di masa depan" });
  }
  if (daysBetween(date, today) > MAX_AGE_DAYS) {
    throw validationError({
      date: `tanggal tidak boleh lebih dari ${MAX_AGE_DAYS} hari lalu`,
    });
  }
}

/** Mode menentukan field wajib per baris; `productId` tidak boleh berulang. */
function checkLines(body: RecapBody): void {
  const seen = new Set<string>();
  body.lines.forEach((line, index) => {
    const key = body.mode === "quantity" ? "qty" : "countedStock";
    if (line[key] === undefined) {
      throw validationError({
        [`lines.${index}.${key}`]: `wajib pada mode ${body.mode}`,
      });
    }
    if (seen.has(line.productId)) {
      throw validationError({
        [`lines.${index}.productId`]: "productId tidak boleh berulang",
      });
    }
    seen.add(line.productId);
  });
}

async function handleRecapGet(c: Context, deps: SalesDeps) {
  const { store } = await currentSession(c, deps);
  const parsed = dateQuery.safeParse(c.req.query());
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw validationError({
      [String(issue?.path[0] ?? "date")]: issue?.message ?? "tidak valid",
    });
  }

  const today = todayIso(deps.now());
  const date = parsed.data.date;

  const [rows, stats, hasRecord] = await Promise.all([
    recapRows(deps.db, store.id, date, today),
    listProductStats(deps.db, store.id, today, false),
    hasSalesOn(deps.db, store.id, date),
  ]);

  // Urutan kontrak: sold28 DESC lalu nama.
  const sold28 = new Map(stats.map((stat) => [stat.productId, stat.sold28]));
  const lines = rows.sort((a, b) => {
    const delta =
      (sold28.get(b.productId) ?? 0) - (sold28.get(a.productId) ?? 0);
    return delta !== 0 ? delta : a.name.localeCompare(b.name, "id");
  });

  return c.json({ date, isToday: date === today, hasRecord, lines });
}

/** Kirim ulang dengan key sama → respons lama diputar ulang, bukan ditulis dua kali. */
async function replayOrNull(
  c: Context,
  deps: SalesDeps,
  storeId: string,
  key: string,
) {
  const prior = await findIdempotent(deps.db, storeId, key);
  if (prior === null) return null;
  if (prior.endpoint !== ENDPOINT) {
    throw new ApiError(
      409,
      "idempotency_key_reused",
      "Idempotency-Key sudah dipakai endpoint lain.",
    );
  }
  return c.json(
    prior.responseBody as Record<string, unknown>,
    prior.statusCode as 200,
  );
}

async function handleRecapPut(c: Context, deps: SalesDeps) {
  const { store } = await currentSession(c, deps);

  const key = c.req.header("idempotency-key") ?? "";
  if (!z.string().uuid().safeParse(key).success) {
    throw validationError({ "Idempotency-Key": "wajib UUID v4" });
  }

  const parsed = recapBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "body";
    throw validationError({
      [path]: issue ? fieldMessage(issue) : "tidak valid",
    });
  }

  const today = todayIso(deps.now());
  checkDate(parsed.data.date, today);
  checkLines(parsed.data);

  const replay = await replayOrNull(c, deps, store.id, key);
  if (replay !== null) return replay;

  const result = await saveRecap(
    deps.db,
    store.id,
    parsed.data.date,
    parsed.data.mode,
    parsed.data.lines,
    today,
    { key, endpoint: ENDPOINT, statusCode: 200 },
  );
  return c.json(result, 200);
}

export function salesRoutes(deps: SalesDeps) {
  const app = new Hono();
  app.get("/sales/recap", (c) => handleRecapGet(c, deps));
  app.put("/sales/recap", (c) => handleRecapPut(c, deps));
  return app;
}
