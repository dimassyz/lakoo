import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "../../../database/src/db.ts";
import { nameKeyOf } from "../../../database/src/nameKey.ts";
import { products, stockIns } from "../../../database/src/schema.ts";
import { recapRows, saveRecap } from "./salesRecap.ts";

export type ImportMode = "preview" | "commit";

export type ImportErrorCode =
  | "invalid_name"
  | "invalid_price"
  | "invalid_qty"
  | "invalid_date"
  | "unknown_product"
  | "duplicate_in_file"
  | "insufficient_stock";

export interface InvalidRow {
  index: number;
  code: ImportErrorCode;
  message: string;
}

export interface ImportResult {
  mode: ImportMode;
  totalRows: number;
  validRows: number;
  invalidRows: InvalidRow[];
  created: number;
  updated: number;
  skipped: number;
}

export interface RawProductRow {
  name: string | null;
  unit?: string | null;
  category?: string | null;
  costPrice: number | string | null;
  sellPrice: number | string | null;
  stock: number | string | null;
}

export interface RawSaleRow {
  date: string | null;
  productName: string | null;
  qty: number | string | null;
}

export interface ImportProductsInput {
  mode: ImportMode;
  onDuplicate: "skip" | "update_price";
  rows: RawProductRow[];
}

export interface ImportSalesInput {
  mode: ImportMode;
  rows: RawSaleRow[];
}

const MAX_NAME = 80;
const MAX_UNIT = 16;
const MAX_CATEGORY = 40;

const invalid = (
  index: number,
  code: ImportErrorCode,
  message: string,
): InvalidRow => ({
  index,
  code,
  message,
});

/**
 * Angka dari file: bisa number atau teks mentah ("12.000", "12,000", " 12000 ").
 * Pemisah ribuan dibuang; selain itu wajib digit murni.
 */
function toInt(value: number | string | null): number | null {
  if (value === null) return null;
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  const cleaned = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[.,](?=\d{3}\b)/g, "");
  return /^-?\d+$/.test(cleaned) ? Number(cleaned) : null;
}

/** `YYYY-MM-DD` atau `DD/MM/YYYY` → `[tahun, bulan, hari]`, atau null. */
function dateParts(text: string): [string, string, string] | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso !== null) return [iso[1]!, iso[2]!, iso[3]!];
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (br !== null) return [br[3]!, br[2]!, br[1]!];
  return null;
}

/** Tanggal kalender nyata — `2026-02-31` ditolak karena Date melimpah ke Maret. */
function parseDate(value: string | null): string | null {
  if (value === null) return null;
  const parts = dateParts(value.trim());
  if (parts === null) return null;
  const candidate = parts.join("-");
  const date = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === candidate ? candidate : null;
}

function isInvalid<T extends object>(
  value: T | InvalidRow,
): value is InvalidRow {
  return "code" in value;
}

interface ProductLine {
  index: number;
  name: string;
  nameKey: string;
  unit: string;
  category: string | null;
  costPrice: number;
  sellPrice: number;
  stock: number;
}

/** Satuan & kategori opsional dengan batas panjangnya sendiri. */
function optionalText(
  row: RawProductRow,
  index: number,
): { unit: string; category: string | null } | InvalidRow {
  const unit = (row.unit ?? "").trim() || "pcs";
  if (unit.length > MAX_UNIT) {
    return invalid(
      index,
      "invalid_name",
      `Satuan maksimal ${MAX_UNIT} karakter.`,
    );
  }
  const category = (row.category ?? "").trim() || null;
  if (category !== null && category.length > MAX_CATEGORY) {
    return invalid(
      index,
      "invalid_name",
      `Kategori maksimal ${MAX_CATEGORY} karakter.`,
    );
  }
  return { unit, category };
}

/** Nama + deteksi duplikat di dalam file. */
function productName(
  row: RawProductRow,
  index: number,
  seen: Set<string>,
): { name: string; nameKey: string } | InvalidRow {
  const name = (row.name ?? "").trim();
  if (name.length < 1 || name.length > MAX_NAME) {
    return invalid(index, "invalid_name", `Nama wajib 1–${MAX_NAME} karakter.`);
  }
  const nameKey = nameKeyOf(name);
  if (seen.has(nameKey)) {
    return invalid(
      index,
      "duplicate_in_file",
      "Nama muncul lebih dari sekali di file.",
    );
  }
  seen.add(nameKey);
  return { name, nameKey };
}

function validateProductRow(
  row: RawProductRow,
  index: number,
  seen: Set<string>,
): ProductLine | InvalidRow {
  const named = productName(row, index, seen);
  if (isInvalid(named)) return named;
  const text = optionalText(row, index);
  if (isInvalid(text)) return text;

  const costPrice = toInt(row.costPrice);
  const sellPrice = toInt(row.sellPrice);
  if (
    costPrice === null ||
    costPrice < 0 ||
    sellPrice === null ||
    sellPrice < 0
  ) {
    return invalid(index, "invalid_price", "Harga harus angka bulat ≥ 0.");
  }
  const stock = toInt(row.stock);
  if (stock === null || stock < 0) {
    return invalid(index, "invalid_qty", "Stok awal harus angka bulat ≥ 0.");
  }
  return { index, ...named, ...text, costPrice, sellPrice, stock };
}

async function existingByKey(
  db: AnyDb,
  storeId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: products.id, nameKey: products.nameKey })
    .from(products)
    .where(and(eq(products.storeId, storeId), isNull(products.archivedAt)));
  return new Map(rows.map((row) => [row.nameKey, row.id]));
}

async function lastCostOf(
  db: AnyDb,
  productId: string,
): Promise<number | null> {
  const rows = await db
    .select({ unitCost: stockIns.unitCost, createdAt: stockIns.createdAt })
    .from(stockIns)
    .where(eq(stockIns.productId, productId));
  if (rows.length === 0) return null;
  return rows.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b)).unitCost;
}

async function insertOpening(
  db: AnyDb,
  storeId: string,
  productId: string,
  line: { costPrice: number; stock: number },
  today: string,
): Promise<void> {
  await db.insert(stockIns).values({
    storeId,
    productId,
    batchId: crypto.randomUUID(),
    receivedOn: today,
    qty: line.stock,
    unitCost: line.costPrice,
    kind: "opening",
  });
}

type LineEffect = "created" | "updated" | "skipped";

function previewEffect(
  exists: boolean,
  onDuplicate: "skip" | "update_price",
): LineEffect {
  if (!exists) return "created";
  return onDuplicate === "skip" ? "skipped" : "updated";
}

async function applyProductLine(
  db: AnyDb,
  storeId: string,
  line: ProductLine,
  input: ImportProductsInput,
  existingId: string | undefined,
  today: string,
): Promise<LineEffect> {
  if (existingId === undefined) {
    const inserted = await db
      .insert(products)
      .values({
        storeId,
        name: line.name,
        nameKey: line.nameKey,
        unit: line.unit,
        category: line.category,
        sellPrice: line.sellPrice,
      })
      .returning();
    // qty 0 tetap dicatat: tanpa baris ini barang tidak punya basis `lastCost`.
    await insertOpening(db, storeId, inserted[0]!.id, line, today);
    return "created";
  }

  if (input.onDuplicate === "skip") return "skipped";

  await db
    .update(products)
    .set({ sellPrice: line.sellPrice })
    .where(eq(products.id, existingId));
  // Modal baru dicatat sebagai stock_ins qty 0 supaya harga modal terakhir akurat.
  if ((await lastCostOf(db, existingId)) !== line.costPrice) {
    await insertOpening(
      db,
      storeId,
      existingId,
      { costPrice: line.costPrice, stock: 0 },
      today,
    );
  }
  return "updated";
}

export async function importProducts(
  db: AnyDb,
  storeId: string,
  input: ImportProductsInput,
  today: string,
): Promise<ImportResult> {
  const seen = new Set<string>();
  const invalidRows: InvalidRow[] = [];
  const valid: ProductLine[] = [];
  input.rows.forEach((row, index) => {
    const checked = validateProductRow(row, index, seen);
    if (isInvalid(checked)) invalidRows.push(checked);
    else valid.push(checked);
  });

  const existing = await existingByKey(db, storeId);
  const counts: Record<LineEffect, number> = {
    created: 0,
    updated: 0,
    skipped: 0,
  };
  for (const line of valid) {
    const effect =
      input.mode === "preview"
        ? previewEffect(existing.has(line.nameKey), input.onDuplicate)
        : await applyProductLine(
            db,
            storeId,
            line,
            input,
            existing.get(line.nameKey),
            today,
          );
    counts[effect] += 1;
  }

  const isPreview = input.mode === "preview";
  return {
    mode: input.mode,
    totalRows: input.rows.length,
    validRows: valid.length,
    invalidRows,
    created: isPreview ? 0 : counts.created,
    updated: isPreview ? 0 : counts.updated,
    skipped: counts.skipped,
  };
}

interface SaleLine {
  index: number;
  date: string;
  productId: string;
  qty: number;
}

function validateSaleRow(
  row: RawSaleRow,
  index: number,
  today: string,
  byKey: Map<string, string>,
): SaleLine | InvalidRow {
  const date = parseDate(row.date);
  if (date === null || date > today) {
    return invalid(
      index,
      "invalid_date",
      "Tanggal harus YYYY-MM-DD atau DD/MM/YYYY dan bukan masa depan.",
    );
  }
  const qty = toInt(row.qty);
  if (qty === null || qty < 1) {
    return invalid(index, "invalid_qty", "Jumlah harus angka bulat ≥ 1.");
  }
  const productId = byKey.get(nameKeyOf((row.productName ?? "").trim()));
  if (productId === undefined) {
    return invalid(index, "unknown_product", "Barang tidak ditemukan.");
  }
  return { index, date, productId, qty };
}

/** (barang, tanggal) sama dijumlahkan dulu — import ulang tidak menggandakan. */
function groupSales(lines: SaleLine[]): SaleLine[] {
  const grouped = new Map<string, SaleLine>();
  for (const line of lines) {
    const key = `${line.productId}|${line.date}`;
    const current = grouped.get(key);
    if (current === undefined) grouped.set(key, { ...line });
    else current.qty += line.qty;
  }
  return [...grouped.values()];
}

interface Feasible {
  lines: { productId: string; qty: number }[];
  created: number;
  updated: number;
}

/** BR-16 per tanggal: stok sebelum penjualan hari itu harus cukup. */
function feasibleOn(
  recap: Map<
    string,
    { morningStock: number; stockInOnDate: number; recordedQty: number }
  >,
  lines: SaleLine[],
  invalidRows: InvalidRow[],
): Feasible {
  const result: Feasible = { lines: [], created: 0, updated: 0 };
  for (const line of lines) {
    const row = recap.get(line.productId);
    if (row === undefined) {
      invalidRows.push(
        invalid(line.index, "unknown_product", "Barang tidak ditemukan."),
      );
      continue;
    }
    const available = row.morningStock + row.stockInOnDate;
    if (available - line.qty < 0) {
      invalidRows.push(
        invalid(
          line.index,
          "insufficient_stock",
          `Stok tercatat hanya ${available}`,
        ),
      );
      continue;
    }
    if (row.recordedQty > 0) result.updated += 1;
    else result.created += 1;
    result.lines.push({ productId: line.productId, qty: line.qty });
  }
  return result;
}

export async function importSales(
  db: AnyDb,
  storeId: string,
  input: ImportSalesInput,
  today: string,
): Promise<ImportResult> {
  const rows = await db
    .select({ id: products.id, nameKey: products.nameKey })
    .from(products)
    .where(and(eq(products.storeId, storeId), isNull(products.archivedAt)));
  const byKey = new Map(rows.map((row) => [row.nameKey, row.id]));

  const invalidRows: InvalidRow[] = [];
  const valid: SaleLine[] = [];
  input.rows.forEach((row, index) => {
    const checked = validateSaleRow(row, index, today, byKey);
    if (isInvalid(checked)) invalidRows.push(checked);
    else valid.push(checked);
  });

  const grouped = groupSales(valid);
  const dates = [...new Set(grouped.map((line) => line.date))].sort();
  const counts = { created: 0, updated: 0 };

  for (const date of dates) {
    const recap = new Map(
      (await recapRows(db, storeId, date, today)).map((row) => [
        row.productId,
        row,
      ]),
    );
    const feasible = feasibleOn(
      recap,
      grouped.filter((line) => line.date === date),
      invalidRows,
    );
    counts.created += feasible.created;
    counts.updated += feasible.updated;
    if (input.mode === "commit" && feasible.lines.length > 0) {
      await saveRecap(db, storeId, date, "quantity", feasible.lines, today);
    }
  }

  invalidRows.sort((a, b) => a.index - b.index);
  const isPreview = input.mode === "preview";
  return {
    mode: input.mode,
    totalRows: input.rows.length,
    validRows: input.rows.length - invalidRows.length,
    invalidRows,
    created: isPreview ? 0 : counts.created,
    updated: isPreview ? 0 : counts.updated,
    skipped: 0,
  };
}
