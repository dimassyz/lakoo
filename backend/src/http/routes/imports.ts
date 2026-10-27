import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AnyDb } from "../../../../database/src/db.ts";
import { currentSession } from "../auth-context.ts";
import { validationError } from "../errors.ts";
import { IMPORT_RULE, consumeRateLimit } from "../rate-limit.ts";
import { fieldMessage } from "../validate.ts";
import { importProducts, importSales } from "../../repo/imports.ts";
import { todayIso } from "./products.ts";

export interface ImportDeps {
  db: AnyDb;
  now: () => Date;
}

const nullableInt = z.union([z.number(), z.string(), z.null()]);
const nullableText = (max: number) => z.union([z.string().max(max), z.null()]);

const productsBody = z
  .object({
    mode: z.enum(["preview", "commit"]),
    onDuplicate: z.enum(["skip", "update_price"]).default("skip"),
    rows: z
      .array(
        z
          .object({
            name: nullableText(200),
            unit: nullableText(50).optional(),
            category: nullableText(100).optional(),
            costPrice: nullableInt,
            sellPrice: nullableInt,
            stock: nullableInt,
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();

const salesBody = z
  .object({
    mode: z.enum(["preview", "commit"]),
    rows: z
      .array(
        z
          .object({
            date: nullableText(20),
            productName: nullableText(200),
            qty: nullableInt,
          })
          .strict(),
      )
      .min(1)
      .max(5_000),
  })
  .strict();

function bodyOf<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const path = issue?.path.join(".") || "body";
  throw validationError({
    [path]: issue ? fieldMessage(issue) : "tidak valid",
  });
}

async function handleProducts(c: Context, deps: ImportDeps) {
  const { store } = await currentSession(c, deps);
  await consumeRateLimit(deps.db, IMPORT_RULE, store.id, deps.now());

  const body = bodyOf(productsBody, await c.req.json().catch(() => null));
  return c.json(
    await importProducts(
      deps.db,
      store.id,
      {
        mode: body.mode,
        onDuplicate: body.onDuplicate ?? "skip",
        rows: body.rows,
      },
      todayIso(deps.now()),
    ),
  );
}

async function handleSales(c: Context, deps: ImportDeps) {
  const { store } = await currentSession(c, deps);
  await consumeRateLimit(deps.db, IMPORT_RULE, store.id, deps.now());

  const body = bodyOf(salesBody, await c.req.json().catch(() => null));
  return c.json(
    await importSales(
      deps.db,
      store.id,
      { mode: body.mode, rows: body.rows },
      todayIso(deps.now()),
    ),
  );
}

export function importRoutes(deps: ImportDeps) {
  const app = new Hono();
  app.post("/imports/products", (c) => handleProducts(c, deps));
  app.post("/imports/sales", (c) => handleSales(c, deps));
  return app;
}
