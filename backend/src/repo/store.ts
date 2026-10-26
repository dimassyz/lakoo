import { eq } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import { stores } from "../../../database/src/schema.ts";
import { notFound } from "../http/errors.ts";

export type StoreRow = typeof stores.$inferSelect;
export type StoreUpdate = Partial<
  Pick<
    StoreRow,
    | "name"
    | "storeType"
    | "location"
    | "customerTypes"
    | "healthyDays"
    | "deadDays"
    | "warningWeeks"
    | "aiEnabled"
    | "onboardedAt"
  >
>;

export async function updateStore(
  db: AnyDb,
  storeId: string,
  patch: StoreUpdate,
): Promise<StoreRow> {
  const rows = await db
    .update(stores)
    .set(patch)
    .where(eq(stores.id, storeId))
    .returning();
  const row = rows[0];
  if (row === undefined) throw notFound();
  return row;
}
