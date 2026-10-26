import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AnyDb } from "../../../../database/src/db.ts";
import { currentSession } from "../auth-context.ts";
import { ApiError, validationError } from "../errors.ts";
import { findIdempotent, storeIdempotent } from "../../repo/idempotency.ts";
import {
  createStockInBatch,
  deleteStockIn,
  listStockIns,
  nameKeyTaken,
  updateStockIn,
} from "../../repo/stockIns.ts";
import { todayIso } from "./products.ts";

export interface StockInDeps {
  db: AnyDb;
  now: () => Date;
}

const ENDPOINT = "POST /stock-ins";
const MAX_LINES = 100;
const MAX_AGE_DAYS = 365;
const DEFAULT_RANGE_DAYS = 30;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const listQuery = z.object({
  from: z
    .string()
    .regex(ISO_DATE, "tanggal harus format YYYY-MM-DD")
    .optional(),
  to: z.string().regex(ISO_DATE, "tanggal harus format YYYY-MM-DD").optional(),
  productId: z.string().uuid("productId harus UUID").optional(),
});

const newProductSchema = z
  .object({
    name: z.string().min(1).max(80),
    unit: z.string().min(1).max(16).default("pcs"),
    category: z.string().max(40).nullable().optional(),
    sellPrice: z.number().int().min(0),
  })
  .strict();

const batchBody = z
  .object({
    receivedOn: z.string().regex(ISO_DATE, "tanggal harus format YYYY-MM-DD"),
    lines: z
      .array(
        z
          .object({
            productId: z.string().uuid("productId harus UUID").optional(),
            newProduct: newProductSchema.optional(),
            qty: z.number().int().min(1).max(100_000),
            unitCost: z.number().int().min(0),
          })
          .strict()
          .refine(
            (line) =>
              (line.productId === undefined) !==
              (line.newProduct === undefined),
            { message: "isi tepat satu dari productId atau newProduct" },
          ),
      )
      .min(1, "minimal satu baris")
      .max(MAX_LINES, `maksimal ${MAX_LINES} baris`),
  })
  .strict();

const patchBody = z
  .object({
    qty: z.number().int().min(1).max(100_000).optional(),
    unitCost: z.number().int().min(0).optional(),
    receivedOn: z
      .string()
      .regex(ISO_DATE, "tanggal harus format YYYY-MM-DD")
      .optional(),
  })
  .strict();

const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

const shiftIso = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

function checkReceivedOn(receivedOn: string, today: string): void {
  if (receivedOn > today) {
    throw validationError({ receivedOn: "tanggal tidak boleh di masa depan" });
  }
  if (daysBetween(receivedOn, today) > MAX_AGE_DAYS) {
    throw validationError({
      receivedOn: `tanggal tidak boleh lebih dari ${MAX_AGE_DAYS} hari lalu`,
    });
  }
}

async function handleList(c: Context, deps: StockInDeps) {
  const { store } = await currentSession(c, deps);
  const parsed = listQuery.safeParse(c.req.query());
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw validationError({
      [String(issue?.path[0] ?? "from")]: issue?.message ?? "tidak valid",
    });
  }
  const today = todayIso(deps.now());
  const to = parsed.data.to ?? today;
  const from = parsed.data.from ?? shiftIso(to, -DEFAULT_RANGE_DAYS);
  if (from > to) throw validationError({ from: "from tidak boleh setelah to" });

  const items = await listStockIns(
    deps.db,
    store.id,
    { from, to, productId: parsed.data.productId },
    deps.now(),
  );
  return c.json({ items });
}

/** Nama barang baru harus unik per toko; dilaporkan per baris seperti kontrak. */
async function checkNewNames(
  db: AnyDb,
  storeId: string,
  lines: z.infer<typeof batchBody>["lines"],
): Promise<void> {
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (line.newProduct === undefined) continue;
    const key = line.newProduct.name.toLowerCase();
    if (seen.has(key) || (await nameKeyTaken(db, storeId, key))) {
      throw new ApiError(
        422,
        "duplicate_product_name",
        "Ada baris yang perlu dicek.",
        {
          lines: [
            {
              index,
              code: "duplicate_product_name",
              message: line.newProduct.name,
            },
          ],
        },
      );
    }
    seen.add(key);
  }
}

async function handleCreate(c: Context, deps: StockInDeps) {
  const { store } = await currentSession(c, deps);

  const key = c.req.header("idempotency-key") ?? "";
  if (!z.string().uuid().safeParse(key).success) {
    throw validationError({ "Idempotency-Key": "wajib UUID v4" });
  }

  const parsed = batchBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw validationError({
      [issue?.path.join(".") ?? "body"]: issue?.message ?? "tidak valid",
    });
  }

  const today = todayIso(deps.now());
  checkReceivedOn(parsed.data.receivedOn, today);

  const prior = await findIdempotent(deps.db, store.id, key);
  if (prior !== null) {
    if (prior.endpoint !== ENDPOINT) {
      throw new ApiError(
        409,
        "idempotency_key_reused",
        "Idempotency-Key sudah dipakai endpoint lain.",
      );
    }
    return c.json(
      prior.responseBody as Record<string, unknown>,
      prior.statusCode as 201,
    );
  }

  await checkNewNames(deps.db, store.id, parsed.data.lines);
  const created = await createStockInBatch(
    deps.db,
    store.id,
    parsed.data.receivedOn,
    parsed.data.lines,
    deps.now(),
  );
  await storeIdempotent(deps.db, store.id, key, ENDPOINT, 201, created);
  return c.json(created, 201);
}

async function handleUpdate(c: Context, deps: StockInDeps) {
  const { store } = await currentSession(c, deps);
  const parsed = patchBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw validationError({
      [issue?.path.join(".") ?? "body"]: issue?.message ?? "tidak valid",
    });
  }
  if (Object.keys(parsed.data).length === 0) {
    throw validationError({ body: "minimal satu field" });
  }
  if (parsed.data.receivedOn !== undefined) {
    checkReceivedOn(parsed.data.receivedOn, todayIso(deps.now()));
  }

  const item = await updateStockIn(
    deps.db,
    store.id,
    c.req.param("stockInId") ?? "",
    parsed.data,
    deps.now(),
  );
  return c.json(item);
}

async function handleDelete(c: Context, deps: StockInDeps) {
  const { store } = await currentSession(c, deps);
  await deleteStockIn(
    deps.db,
    store.id,
    c.req.param("stockInId") ?? "",
    deps.now(),
  );
  return c.body(null, 204);
}

export function stockInRoutes(deps: StockInDeps) {
  const app = new Hono();
  app.get("/stock-ins", (c) => handleList(c, deps));
  app.post("/stock-ins", (c) => handleCreate(c, deps));
  app.patch("/stock-ins/:stockInId", (c) => handleUpdate(c, deps));
  app.delete("/stock-ins/:stockInId", (c) => handleDelete(c, deps));
  return app;
}
