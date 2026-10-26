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
  stockIns,
} from "../../../database/src/schema.ts";
import { notFound } from "../http/errors.ts";

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
      })
      .returning();
    const product = inserted[0];
    if (product === undefined)
      throw new Error("insert products tidak mengembalikan baris");

    // Stok awal tetap dicatat sebagai barang masuk supaya ledger-nya lengkap.
    if (input.openingStock > 0) {
      await tx.insert(stockIns).values({
        storeId,
        productId: product.id,
        batchId: randomUUID(),
        receivedOn: input.receivedOn,
        qty: input.openingStock,
        unitCost: input.costPrice,
        kind: "opening",
      });
    }
    return product;
  });
}
