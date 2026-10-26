CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE TYPE "public"."action_type" AS ENUM('display_move', 'bundle', 'discount', 'promo_wa', 'sell_at_cost', 'clearance', 'stop_restock');--> statement-breakpoint
CREATE TYPE "public"."adjustment_reason" AS ENUM('correction');--> statement-breakpoint
CREATE TYPE "public"."customer_type" AS ENUM('warga_perumahan', 'anak_sekolah', 'pekerja_pabrik_kantor', 'pedagang_lain', 'pengendara_lewat', 'kos_mahasiswa');--> statement-breakpoint
CREATE TYPE "public"."plan_source" AS ENUM('ai', 'template');--> statement-breakpoint
CREATE TYPE "public"."plan_state" AS ENUM('suggested', 'active', 'completed', 'exhausted', 'stopped', 'sold_out');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('sehat', 'waspada', 'sekarat', 'mati', 'stok_habis');--> statement-breakpoint
CREATE TYPE "public"."sale_source" AS ENUM('quantity', 'opname', 'import');--> statement-breakpoint
CREATE TYPE "public"."step_outcome" AS ENUM('pending', 'in_progress', 'succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."stock_in_kind" AS ENUM('opening', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."store_type" AS ENUM('warung_kelontong', 'toko_kelontong', 'minimarket_kecil', 'warung_sembako', 'lainnya');--> statement-breakpoint
CREATE TABLE "action_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"source" "plan_source" NOT NULL,
	"state" "plan_state" NOT NULL,
	"product_status_at_generation" "product_status" NOT NULL,
	"rationale" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ai_model" text,
	"started_on" date,
	"ended_on" date,
	"locked_value_at_start" integer,
	"current_step" smallint,
	CONSTRAINT "action_plans_rationale_len" CHECK (char_length("action_plans"."rationale") <= 200),
	CONSTRAINT "action_plans_current_step_range" CHECK ("action_plans"."current_step" is null or "action_plans"."current_step" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "ai_usage_daily" (
	"usage_date" date PRIMARY KEY NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sale_date" date NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"source" "sale_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_sales_qty_pos" CHECK ("daily_sales"."qty" > 0),
	CONSTRAINT "daily_sales_unit_price_nonneg" CHECK ("daily_sales"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"store_id" uuid NOT NULL,
	"key" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"status_code" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_store_id_key_pk" PRIMARY KEY("store_id","key")
);
--> statement-breakpoint
CREATE TABLE "plan_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"step_no" smallint NOT NULL,
	"action_type" "action_type" NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"success_criteria" text NOT NULL,
	"duration_days" smallint NOT NULL,
	"discount_percent" smallint,
	"bundle_product_id" uuid,
	"below_cost_percent" smallint,
	"new_price" integer NOT NULL,
	"profit_per_unit" integer NOT NULL,
	"cash_back_estimate" integer NOT NULL,
	"is_loss" boolean NOT NULL,
	"share_text" text,
	"outcome" "step_outcome" NOT NULL,
	"started_on" date,
	"due_on" date,
	"ended_on" date,
	CONSTRAINT "plan_steps_step_no_range" CHECK ("plan_steps"."step_no" between 1 and 3),
	CONSTRAINT "plan_steps_title_len" CHECK (char_length("plan_steps"."title") <= 60),
	CONSTRAINT "plan_steps_instructions_len" CHECK (char_length("plan_steps"."instructions") <= 300),
	CONSTRAINT "plan_steps_success_criteria_len" CHECK (char_length("plan_steps"."success_criteria") <= 120),
	CONSTRAINT "plan_steps_duration_days_range" CHECK ("plan_steps"."duration_days" between 3 and 21),
	CONSTRAINT "plan_steps_share_text_len" CHECK ("plan_steps"."share_text" is null or char_length("plan_steps"."share_text") <= 500),
	CONSTRAINT "plan_steps_discount_percent_range" CHECK ("plan_steps"."discount_percent" is null or "plan_steps"."discount_percent" between 0 and 50),
	CONSTRAINT "plan_steps_below_cost_percent_range" CHECK ("plan_steps"."below_cost_percent" is null or "plan_steps"."below_cost_percent" between 5 and 50)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"category" text,
	"sell_price" integer NOT NULL,
	"is_complementary" boolean DEFAULT false NOT NULL,
	"complementary_max_stock" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_name_len" CHECK (char_length("products"."name") between 1 and 80),
	CONSTRAINT "products_unit_len" CHECK (char_length("products"."unit") <= 16),
	CONSTRAINT "products_category_len" CHECK ("products"."category" is null or char_length("products"."category") <= 40),
	CONSTRAINT "products_sell_price_nonneg" CHECK ("products"."sell_price" >= 0),
	CONSTRAINT "products_complementary_max_stock_nonneg" CHECK ("products"."complementary_max_stock" is null or "products"."complementary_max_stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"adjusted_on" date NOT NULL,
	"qty_delta" integer NOT NULL,
	"reason" "adjustment_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_adjustments_qty_delta_nonzero" CHECK ("stock_adjustments"."qty_delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "stock_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"received_on" date NOT NULL,
	"qty" integer NOT NULL,
	"unit_cost" integer NOT NULL,
	"kind" "stock_in_kind" NOT NULL,
	"batch_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_ins_qty_nonneg" CHECK ("stock_ins"."qty" >= 0),
	CONSTRAINT "stock_ins_unit_cost_nonneg" CHECK ("stock_ins"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"store_type" "store_type" NOT NULL,
	"location" text,
	"customer_types" "customer_type"[] DEFAULT '{}'::customer_type[] NOT NULL,
	"healthy_days" integer DEFAULT 14 NOT NULL,
	"dead_days" integer DEFAULT 45 NOT NULL,
	"warning_weeks" integer DEFAULT 3 NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"onboarded_at" timestamp with time zone,
	"is_demo_template" boolean DEFAULT false NOT NULL,
	"demo_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_name_len" CHECK (char_length("stores"."name") between 1 and 60),
	CONSTRAINT "stores_location_len" CHECK ("stores"."location" is null or char_length("stores"."location") <= 80),
	CONSTRAINT "stores_thresholds" CHECK ("stores"."healthy_days" < "stores"."dead_days"),
	CONSTRAINT "stores_healthy_days_range" CHECK ("stores"."healthy_days" between 7 and 60),
	CONSTRAINT "stores_dead_days_range" CHECK ("stores"."dead_days" between 15 and 180),
	CONSTRAINT "stores_warning_weeks_range" CHECK ("stores"."warning_weeks" between 2 and 6)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"sentences" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_summaries_sentences_len" CHECK (array_length("weekly_summaries"."sentences", 1) = 3)
);
--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_sales" ADD CONSTRAINT "daily_sales_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_sales" ADD CONSTRAINT "daily_sales_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_steps" ADD CONSTRAINT "plan_steps_plan_id_action_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."action_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_steps" ADD CONSTRAINT "plan_steps_bundle_product_id_products_id_fk" FOREIGN KEY ("bundle_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ins" ADD CONSTRAINT "stock_ins_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ins" ADD CONSTRAINT "stock_ins_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_plans_store_id_state_idx" ON "action_plans" USING btree ("store_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "action_plans_product_live_key" ON "action_plans" USING btree ("product_id") WHERE "action_plans"."state" in ('suggested', 'active');--> statement-breakpoint
CREATE UNIQUE INDEX "daily_sales_product_id_sale_date_key" ON "daily_sales" USING btree ("product_id","sale_date");--> statement-breakpoint
CREATE INDEX "daily_sales_store_id_sale_date_idx" ON "daily_sales" USING btree ("store_id","sale_date");--> statement-breakpoint
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_steps_plan_id_step_no_key" ON "plan_steps" USING btree ("plan_id","step_no");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_id_name_key_key" ON "products" USING btree ("store_id","name_key") WHERE "products"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_store_product_idx" ON "stock_adjustments" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_ins_store_product_received_idx" ON "stock_ins" USING btree ("store_id","product_id","received_on");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_owner_user_id_key" ON "stores" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "stores_demo_expires_at_idx" ON "stores" USING btree ("demo_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_summaries_store_id_week_start_key" ON "weekly_summaries" USING btree ("store_id","week_start");