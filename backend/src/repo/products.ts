import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import {
  productStats,
  type ProductStat,
} from "../../../database/src/queries/productStats.ts";
import {
  actionPlans,
  products,
  stockAdjustments,
  stockIns,
} from "../../../database/src/schema.ts";
import { ApiError, notFound } from "../http/errors.ts";
import { nameKeyOf } from "../../../database/src/nameKey.ts";

export type ProductRow = typeof products.$inferSelect;
export type LivePlanState = "suggested" | "active";

export async function listProductStats(
  db: AnyDb,
  storeId: string,
  asOf: string,
  includeArchived: boolean,
): Promise<ProductStat[]> {
  return productStats(db, storeId, asOf, includeArchived);
}

/** Hanya state yang masih berjalan; selesai/dihentikan tidak ditampilkan sebagai `planState`. */
export async function livePlanStates(
  db: AnyDb,
  storeId: string,
): Promise<Map<string, LivePlanState>> {
  const rows = await db
    .select({ productId: actionPlans.productId, state: actionPlans.state })
    .from(actionPlans)
    .where(
      and(
        eq(actionPlans.storeId, storeId),
        inArray(actionPlans.state, [
          "suggested",
          "active",
        ] satisfies LivePlanState[]),
      ),
    );
  return new Map(
    rows.map((row) => [row.productId, row.state as LivePlanState]),
  );
}

/** Nama unik per toko di antara barang aktif (case/spasi-insensitive, SPEC §4.1). */
export async function findLiveProductByNameKey(
  db: AnyDb,
  storeId: string,
  nameKey: string,
): Promise<ProductRow | undefined> {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.nameKey, nameKey),
        isNull(products.archivedAt),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function findProduct(
  db: AnyDb,
  storeId: string,
  id: string,
): Promise<ProductRow> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.id, id)))
    .limit(1);
  const row = rows[0];
  // Barang toko lain sengaja tidak dibedakan dari barang yang tidak ada (IDOR → 404).
  if (row === undefined) throw notFound();
  return row;
}

export interface NewProduct {
  name: string;
  nameKey: string;
  unit: string;
  category: string | null;
  sellPrice: number;
  costPrice: number;
  isComplementary: boolean;
  openingStock: number;
  receivedOn: string;
  createdAt: Date;
}

/** Barang + baris `stock_ins` jenis `opening`, satu transaksi (SPEC §5.4 endpoint create). */
export async function createProduct(
  db: AnyDb,
  storeId: string,
  input: NewProduct,
): Promise<ProductRow> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(products)
      .values({
        storeId,
        name: input.name,
        nameKey: input.nameKey,
        unit: input.unit,
        category: input.category,
        sellPrice: input.sellPrice,
        isComplementary: input.isComplementary,
        // Jam aplikasi, bukan DEFAULT now() (jam DB) — `firstStockDate` untuk
        // barang tanpa stok jatuh ke tanggal ini, dan jam DB bisa beda hari.
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning();
    const product = inserted[0];
    if (product === undefined)
      throw new Error("insert products tidak mengembalikan baris");

    // Stok awal tetap dicatat sebagai barang masuk supaya ledger-nya lengkap —
    // termasuk saat qty 0, karena baris inilah satu-satunya sumber `lastCost`
    // (tanpa itu produk tidak punya basis biaya sama sekali).
    await tx.insert(stockIns).values({
      storeId,
      productId: product.id,
      batchId: randomUUID(),
      receivedOn: input.receivedOn,
      qty: input.openingStock,
      unitCost: input.costPrice,
      kind: "opening",
    });
    return product;
  });
}

export interface ProductPatchInput {
  name?: string;
  unit?: string;
  category?: string | null;
  sellPrice?: number;
  isComplementary?: boolean;
  complementaryMaxStock?: number | null;
}

/**
 * Ubah barang (SPEC §4.1). Menandai pelengkap menghapus rencana `suggested`;
 * rencana `active` dibiarkan berjalan sampai pemilik menghentikannya.
 */
export async function updateProduct(
  db: AnyDb,
  storeId: string,
  id: string,
  patch: ProductPatchInput,
  now: Date,
): Promise<ProductRow> {
  await findProduct(db, storeId, id);

  if (patch.name !== undefined) {
    const nameKey = nameKeyOf(patch.name);
    const clash = await findLiveProductByNameKey(db, storeId, nameKey);
    if (clash !== undefined && clash.id !== id) {
      throw duplicateName(clash.id);
    }
    patch = { ...patch, nameKey } as ProductPatchInput & { nameKey: string };
  }

  const rows = await db.transaction(async (tx) => {
    if (patch.isComplementary === true) {
      await tx
        .delete(actionPlans)
        .where(
          and(
            eq(actionPlans.productId, id),
            eq(actionPlans.state, "suggested"),
          ),
        );
    }
    return tx
      .update(products)
      .set({
        ...patch,
        nameKey: (patch as { nameKey?: string }).nameKey,
        updatedAt: now,
      })
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning();
  });
  const row = rows[0];
  if (row === undefined) throw notFound();
  return row;
}

/** Arsipkan (`archived: true`) atau pulihkan barang. */
export async function setArchived(
  db: AnyDb,
  storeId: string,
  id: string,
  archived: boolean,
  now: Date,
): Promise<ProductRow> {
  const current = await findProduct(db, storeId, id);

  if (!archived) {
    const clash = await findLiveProductByNameKey(db, storeId, current.nameKey);
    if (clash !== undefined && clash.id !== id) throw duplicateName(clash.id);
  }

  const rows = await db.transaction(async (tx) => {
    if (archived) {
      // Rencana hidup tidak boleh menggantung pada barang yang hilang dari daftar.
      await tx
        .delete(actionPlans)
        .where(
          and(
            eq(actionPlans.productId, id),
            eq(actionPlans.state, "suggested"),
          ),
        );
      await tx
        .update(actionPlans)
        .set({ state: "stopped", endedOn: now.toISOString().slice(0, 10) })
        .where(
          and(eq(actionPlans.productId, id), eq(actionPlans.state, "active")),
        );
    }
    return tx
      .update(products)
      .set({ archivedAt: archived ? now : null, updatedAt: now })
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning();
  });
  const row = rows[0];
  if (row === undefined) throw notFound();
  return row;
}

/**
 * Perbaiki stok tercatat hari ini menjadi `countedStock` (PRD US-06.1 AC-5).
 * Delta 0 → tidak ada baris, tetap 200.
 */
export async function adjustStock(
  db: AnyDb,
  storeId: string,
  id: string,
  countedStock: number,
  today: string,
  now: Date,
): Promise<ProductRow> {
  const product = await findProduct(db, storeId, id);
  const stats = await listProductStats(db, storeId, today, true);
  const current = stats.find((row) => row.productId === id)?.stock ?? 0;
  const delta = countedStock - current;

  if (delta !== 0) {
    await db.insert(stockAdjustments).values({
      storeId,
      productId: id,
      adjustedOn: today,
      qtyDelta: delta,
      reason: "correction",
      createdAt: now,
    });
  }
  return product;
}

function duplicateName(existingProductId: string): ApiError {
  return new ApiError(
    409,
    "duplicate_product_name",
    "Nama barang sudah dipakai",
    {
      fields: { name: "Nama barang sudah dipakai" },
      existingProductId,
    },
  );
}
