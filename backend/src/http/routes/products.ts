import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AnyDb } from "../../../../database/src/db.ts";
import { nameKeyOf } from "../../../../database/src/nameKey.ts";
import { currentSession } from "../auth-context.ts";
import { ApiError, notFound, validationError } from "../errors.ts";
import { loadProductDetail, loadProductSummaries } from "../productView.ts";
import type { ProductSummary } from "../serialize.ts";
import { readJson } from "../validate.ts";
import {
  adjustStock,
  findProduct,
  createProduct,
  findLiveProductByNameKey,
  setArchived,
  updateProduct,
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

/** `asOf` selalu tanggal WIB hari ini, supaya jendela §5.1 tidak bergeser per jam. */
export function todayIso(now: Date): string {
  // WIB = UTC+7 tanpa DST. `toISOString()` polos akan salah tanggal antara
  // 00:00–07:00 WIB (masih hari sebelumnya di UTC).
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
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
    createdAt: deps.now(),
  });

  // Kontrak: 201 → ProductDetail lengkap, bukan potongan ProductSummary.
  const detail = await loadProductDetail(
    deps.db,
    store.id,
    product.id,
    todayIso(deps.now()),
    product.createdAt,
  );
  if (detail === undefined) {
    throw new Error("barang baru tidak muncul di productStats");
  }
  return c.json(detail, 201);
}

const patchBody = z
  .object({
    name: z.string().min(1).max(80).optional(),
    unit: z.string().min(1).max(16).optional(),
    category: z.string().max(40).nullable().optional(),
    sellPrice: z.number().int().min(0).max(1_000_000_000).optional(),
    isComplementary: z.boolean().optional(),
    complementaryMaxStock: z
      .number()
      .int()
      .min(1)
      .max(100_000)
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "minimal satu field",
  });

const archiveBody = z.object({ archived: z.boolean() }).strict();

const adjustmentBody = z
  .object({ countedStock: z.number().int().min(0).max(100_000) })
  .strict();

/** `ProductDetail` segar untuk satu barang; 404 bila tidak ada di toko ini. */
async function detailOf(
  c: Context,
  deps: ProductsDeps,
  storeId: string,
  productId: string,
) {
  const product = await findProduct(deps.db, storeId, productId);
  const detail = await loadProductDetail(
    deps.db,
    storeId,
    productId,
    todayIso(deps.now()),
    product.createdAt,
  );
  if (detail === undefined) throw notFound();
  return c.json(detail);
}

async function handleDetail(c: Context, deps: ProductsDeps) {
  const { store } = await currentSession(c, deps);
  const productId = c.req.param("productId") ?? "";
  return detailOf(c, deps, store.id, productId);
}

async function handlePatch(c: Context, deps: ProductsDeps) {
  const { store } = await currentSession(c, deps);
  const productId = c.req.param("productId") ?? "";
  const body = await readJson(c, patchBody);
  await updateProduct(deps.db, store.id, productId, body, deps.now());
  return detailOf(c, deps, store.id, productId);
}

async function handleArchive(c: Context, deps: ProductsDeps) {
  const { store } = await currentSession(c, deps);
  const productId = c.req.param("productId") ?? "";
  const body = await readJson(c, archiveBody);
  await setArchived(deps.db, store.id, productId, body.archived, deps.now());
  return detailOf(c, deps, store.id, productId);
}

async function handleAdjustStock(c: Context, deps: ProductsDeps) {
  const { store } = await currentSession(c, deps);
  const productId = c.req.param("productId") ?? "";
  const body = await readJson(c, adjustmentBody);
  await adjustStock(
    deps.db,
    store.id,
    productId,
    body.countedStock,
    todayIso(deps.now()),
    deps.now(),
  );
  return detailOf(c, deps, store.id, productId);
}

export function productRoutes(deps: ProductsDeps) {
  const app = new Hono();
  app.get("/products", (c) => handleList(c, deps));
  app.post("/products", (c) => handleCreate(c, deps));
  app.get("/products/:productId", (c) => handleDetail(c, deps));
  app.patch("/products/:productId", (c) => handlePatch(c, deps));
  app.post("/products/:productId/archive", (c) => handleArchive(c, deps));
  app.post("/products/:productId/stock-adjustments", (c) =>
    handleAdjustStock(c, deps),
  );
  return app;
}
