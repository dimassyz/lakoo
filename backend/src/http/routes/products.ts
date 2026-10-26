import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AnyDb } from "../../../../database/src/db.ts";
import { nameKeyOf } from "../../../../database/src/demo/generator.ts";
import { currentSession } from "../auth-context.ts";
import { ApiError, validationError } from "../errors.ts";
import { loadProductSummaries } from "../productView.ts";
import type { ProductSummary } from "../serialize.ts";
import { readJson } from "../validate.ts";
import {
  createProduct,
  findLiveProductByNameKey,
} from "../../repo/products.ts";

export interface ProductsDeps {
  db: AnyDb;
  now: () => Date;
}

const boolString = z.enum(["true", "false"]);

const listQuery = z.object({
  status: z
    .enum(["sehat", "waspada", "sekarat", "mati", "stok_habis"])
    .optional(),
  q: z.string().max(80).optional(),
  complementary: boolString.optional(),
  includeArchived: boolString.optional(),
  sort: z.enum(["priority", "name", "frequent"]).default("priority"),
});

const createBody = z
  .object({
    name: z.string().min(1).max(80),
    unit: z.string().min(1).max(16).default("pcs"),
    category: z.string().max(40).nullable().default(null),
    costPrice: z.number().int().min(0),
    sellPrice: z.number().int().min(0),
    openingStock: z.number().int().min(0).max(100_000),
    isComplementary: z.boolean().default(false),
  })
  .strict();

/** `asOf` selalu tanggal UTC hari ini, supaya jendela §5.1 tidak bergeser per jam. */
export function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function byPriority(a: ProductSummary, b: ProductSummary): number {
  const aScored = a.priorityScore !== null;
  const bScored = b.priorityScore !== null;
  if (aScored !== bScored) return aScored ? -1 : 1;
  if (aScored && bScored)
    return (b.priorityScore as number) - (a.priorityScore as number);
  return a.name.localeCompare(b.name, "id");
}

function sortItems(
  items: ProductSummary[],
  sort: "priority" | "name" | "frequent",
): void {
  if (sort === "frequent") {
    items.sort(
      (a, b) => b.sold28 - a.sold28 || a.name.localeCompare(b.name, "id"),
    );
  } else if (sort === "name") {
    items.sort((a, b) => a.name.localeCompare(b.name, "id"));
  } else {
    items.sort(byPriority);
  }
}

function matches(
  item: ProductSummary,
  query: z.infer<typeof listQuery>,
): boolean {
  if (query.status !== undefined && item.status !== query.status) return false;
  if (query.complementary !== undefined) {
    if (item.isComplementary !== (query.complementary === "true")) return false;
  }
  if (query.q !== undefined && query.q !== "") {
    if (!item.name.toLowerCase().includes(query.q.toLowerCase())) return false;
  }
  return true;
}

async function handleList(c: Context, deps: ProductsDeps) {
  const { store } = await currentSession(c, deps);
  const raw = c.req.query();
  const parsed = listQuery.safeParse({ ...raw, sort: raw.sort ?? "priority" });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw validationError({
      [String(issue?.path[0] ?? "query")]: issue?.message ?? "tidak valid",
    });
  }
  const query = parsed.data;

  const asOf = todayIso(deps.now());
  const items = await loadProductSummaries(
    deps.db,
    store.id,
    asOf,
    query.includeArchived === "true",
  );

  const filtered = items.filter((item) => matches(item, query));
  sortItems(filtered, query.sort);
  return c.json({ asOf, items: filtered });
}

async function handleCreate(c: Context, deps: ProductsDeps) {
  const { store } = await currentSession(c, deps);
  const body = await readJson(c, createBody);
  const nameKey = nameKeyOf(body.name);

  const existing = await findLiveProductByNameKey(deps.db, store.id, nameKey);
  if (existing !== undefined) {
    throw new ApiError(
      409,
      "duplicate_product_name",
      "Nama barang sudah dipakai",
      {
        fields: { name: "Nama barang sudah dipakai" },
        existingProductId: existing.id,
      },
    );
  }

  const product = await createProduct(deps.db, store.id, {
    name: body.name,
    nameKey,
    unit: body.unit ?? "pcs",
    category: body.category ?? null,
    sellPrice: body.sellPrice,
    costPrice: body.costPrice,
    isComplementary: body.isComplementary ?? false,
    openingStock: body.openingStock,
    receivedOn: todayIso(deps.now()),
  });

  return c.json(
    {
      id: product.id,
      name: product.name,
      unit: product.unit,
      category: product.category,
      sellPrice: product.sellPrice,
      lastCost: body.costPrice,
      stock: body.openingStock,
      isComplementary: product.isComplementary,
    },
    201,
  );
}

export function productRoutes(deps: ProductsDeps) {
  const app = new Hono();
  app.get("/products", (c) => handleList(c, deps));
  app.post("/products", (c) => handleCreate(c, deps));
  return app;
}
