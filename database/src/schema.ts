import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Skema Lakoo — kontrak `docs/SPEC.md` §4.1.
 * Konvensi: uang = integer Rupiah, id = uuid, waktu = timestamptz,
 * tanggal bisnis = date (WIB). Semua tabel data toko punya store_id CASCADE.
 */

/** `citext` tidak punya padanan bawaan di drizzle-orm; SPEC §4.1 mewajibkannya. */
const citext = customType<{ data: string; driverData: string }>({
  dataType: () => "citext",
});

/** `bytea` belum diekspor drizzle-orm 0.45; dipakai untuk `sessions.token_hash` (SHA-256). */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const storeType = pgEnum("store_type", [
  "warung_kelontong",
  "toko_kelontong",
  "minimarket_kecil",
  "warung_sembako",
  "lainnya",
]);

export const customerType = pgEnum("customer_type", [
  "warga_perumahan",
  "anak_sekolah",
  "pekerja_pabrik_kantor",
  "pedagang_lain",
  "pengendara_lewat",
  "kos_mahasiswa",
]);

export const stockInKind = pgEnum("stock_in_kind", ["opening", "purchase"]);

export const saleSource = pgEnum("sale_source", ["quantity", "opname", "import"]);

export const adjustmentReason = pgEnum("adjustment_reason", ["correction"]);

export const productStatus = pgEnum("product_status", [
  "sehat",
  "waspada",
  "sekarat",
  "mati",
  "stok_habis",
]);

export const planSource = pgEnum("plan_source", ["ai", "template"]);

export const planState = pgEnum("plan_state", [
  "suggested",
  "active",
  "completed",
  "exhausted",
  "stopped",
  "sold_out",
]);

export const actionType = pgEnum("action_type", [
  "display_move",
  "bundle",
  "discount",
  "promo_wa",
  "sell_at_cost",
  "clearance",
  "stop_restock",
]);

export const stepOutcome = pgEnum("step_outcome", [
  "pending",
  "in_progress",
  "succeeded",
  "failed",
  "skipped",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: citext("email").notNull(),
  passwordHash: text("password_hash"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_key").on(t.email)]);

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    storeType: storeType("store_type").notNull(),
    location: text("location"),
    customerTypes: customerType("customer_types").array().notNull().default(sql`'{}'::customer_type[]`),
    healthyDays: integer("healthy_days").notNull().default(14),
    deadDays: integer("dead_days").notNull().default(45),
    warningWeeks: integer("warning_weeks").notNull().default(3),
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    isDemoTemplate: boolean("is_demo_template").notNull().default(false),
    demoExpiresAt: timestamp("demo_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stores_owner_user_id_key").on(t.ownerUserId),
    index("stores_demo_expires_at_idx").on(t.demoExpiresAt),
    check("stores_name_len", sql`char_length(${t.name}) between 1 and 60`),
    check("stores_location_len", sql`${t.location} is null or char_length(${t.location}) <= 80`),
    check("stores_thresholds", sql`${t.healthyDays} < ${t.deadDays}`),
    check("stores_healthy_days_range", sql`${t.healthyDays} between 7 and 60`),
    check("stores_dead_days_range", sql`${t.deadDays} between 15 and 180`),
    check("stores_warning_weeks_range", sql`${t.warningWeeks} between 2 and 6`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: bytea("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_key").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    unit: text("unit").notNull().default("pcs"),
    category: text("category"),
    sellPrice: integer("sell_price").notNull(),
    isComplementary: boolean("is_complementary").notNull().default(false),
    complementaryMaxStock: integer("complementary_max_stock"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Partial: nama unik hanya di antara barang yang belum diarsipkan (SPEC §4.1).
    uniqueIndex("products_store_id_name_key_key")
      .on(t.storeId, t.nameKey)
      .where(sql`${t.archivedAt} is null`),
    check("products_name_len", sql`char_length(${t.name}) between 1 and 80`),
    check("products_unit_len", sql`char_length(${t.unit}) <= 16`),
    check("products_category_len", sql`${t.category} is null or char_length(${t.category}) <= 40`),
    check("products_sell_price_nonneg", sql`${t.sellPrice} >= 0`),
    check(
      "products_complementary_max_stock_nonneg",
      sql`${t.complementaryMaxStock} is null or ${t.complementaryMaxStock} >= 0`,
    ),
  ],
);

export const stockIns = pgTable(
  "stock_ins",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    receivedOn: date("received_on").notNull(),
    qty: integer("qty").notNull(),
    unitCost: integer("unit_cost").notNull(),
    kind: stockInKind("kind").notNull(),
    batchId: uuid("batch_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_ins_store_product_received_idx").on(t.storeId, t.productId, t.receivedOn),
    check("stock_ins_qty_nonneg", sql`${t.qty} >= 0`),
    check("stock_ins_unit_cost_nonneg", sql`${t.unitCost} >= 0`),
  ],
);

export const dailySales = pgTable(
  "daily_sales",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    saleDate: date("sale_date").notNull(),
    qty: integer("qty").notNull(),
    unitPrice: integer("unit_price").notNull(),
    source: saleSource("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_sales_product_id_sale_date_key").on(t.productId, t.saleDate),
    index("daily_sales_store_id_sale_date_idx").on(t.storeId, t.saleDate),
    check("daily_sales_qty_pos", sql`${t.qty} > 0`),
    check("daily_sales_unit_price_nonneg", sql`${t.unitPrice} >= 0`),
  ],
);

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    adjustedOn: date("adjusted_on").notNull(),
    qtyDelta: integer("qty_delta").notNull(),
    reason: adjustmentReason("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_adjustments_store_product_idx").on(t.storeId, t.productId),
    check("stock_adjustments_qty_delta_nonzero", sql`${t.qtyDelta} <> 0`),
  ],
);

export const actionPlans = pgTable(
  "action_plans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    source: planSource("source").notNull(),
    state: planState("state").notNull(),
    productStatusAtGeneration: productStatus("product_status_at_generation").notNull(),
    rationale: text("rationale").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    aiModel: text("ai_model"),
    startedOn: date("started_on"),
    endedOn: date("ended_on"),
    lockedValueAtStart: integer("locked_value_at_start"),
    currentStep: smallint("current_step"),
  },
  (t) => [
    index("action_plans_store_id_state_idx").on(t.storeId, t.state),
    // Satu produk hanya boleh punya satu rencana hidup (SPEC §4.1, §4.3).
    uniqueIndex("action_plans_product_live_key")
      .on(t.productId)
      .where(sql`${t.state} in ('suggested', 'active')`),
    check("action_plans_rationale_len", sql`char_length(${t.rationale}) <= 200`),
    check(
      "action_plans_current_step_range",
      sql`${t.currentStep} is null or ${t.currentStep} between 1 and 3`,
    ),
  ],
);

export const planSteps = pgTable(
  "plan_steps",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    planId: uuid("plan_id")
      .notNull()
      .references(() => actionPlans.id, { onDelete: "cascade" }),
    stepNo: smallint("step_no").notNull(),
    actionType: actionType("action_type").notNull(),
    title: text("title").notNull(),
    instructions: text("instructions").notNull(),
    successCriteria: text("success_criteria").notNull(),
    durationDays: smallint("duration_days").notNull(),
    discountPercent: smallint("discount_percent"),
    bundleProductId: uuid("bundle_product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    belowCostPercent: smallint("below_cost_percent"),
    newPrice: integer("new_price").notNull(),
    profitPerUnit: integer("profit_per_unit").notNull(),
    cashBackEstimate: integer("cash_back_estimate").notNull(),
    isLoss: boolean("is_loss").notNull(),
    shareText: text("share_text"),
    outcome: stepOutcome("outcome").notNull(),
    startedOn: date("started_on"),
    dueOn: date("due_on"),
    endedOn: date("ended_on"),
  },
  (t) => [
    uniqueIndex("plan_steps_plan_id_step_no_key").on(t.planId, t.stepNo),
    check("plan_steps_step_no_range", sql`${t.stepNo} between 1 and 3`),
    check("plan_steps_title_len", sql`char_length(${t.title}) <= 60`),
    check("plan_steps_instructions_len", sql`char_length(${t.instructions}) <= 300`),
    check("plan_steps_success_criteria_len", sql`char_length(${t.successCriteria}) <= 120`),
    check("plan_steps_duration_days_range", sql`${t.durationDays} between 3 and 21`),
    check("plan_steps_share_text_len", sql`${t.shareText} is null or char_length(${t.shareText}) <= 500`),
    check(
      "plan_steps_discount_percent_range",
      sql`${t.discountPercent} is null or ${t.discountPercent} between 0 and 50`,
    ),
    check(
      "plan_steps_below_cost_percent_range",
      sql`${t.belowCostPercent} is null or ${t.belowCostPercent} between 5 and 50`,
    ),
  ],
);

export const weeklySummaries = pgTable(
  "weekly_summaries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    sentences: text("sentences").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("weekly_summaries_store_id_week_start_key").on(t.storeId, t.weekStart)],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    key: uuid("key").notNull(),
    endpoint: text("endpoint").notNull(),
    statusCode: integer("status_code").notNull(),
    responseBody: jsonb("response_body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.storeId, t.key] }),
    index("idempotency_keys_created_at_idx").on(t.createdAt),
  ],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export const aiUsageDaily = pgTable("ai_usage_daily", {
  usageDate: date("usage_date").primaryKey(),
  calls: integer("calls").notNull().default(0),
  inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
  outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
});
