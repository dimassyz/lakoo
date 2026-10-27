-- Kontrak (openapi.yaml, PlanStep) mewajibkan `oldPrice`, `bundleProduct`, dan
-- `bundlePrice`; ketiganya belum pernah ada di `plan_steps`. `bundleProductId`
-- yang dikirim backend justru properti liar (`additionalProperties: false`).
ALTER TABLE "plan_steps" ADD COLUMN "old_price" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "plan_steps" ADD COLUMN "bundle_price" integer;--> statement-breakpoint
ALTER TABLE "plan_steps" ADD COLUMN "bundle_product_name" text;--> statement-breakpoint
ALTER TABLE "plan_steps" ADD COLUMN "bundle_product_sell_price" integer;--> statement-breakpoint
-- Backfill: harga jual barang SAAT rencana dibuat (produk bisa berubah harga
-- setelahnya, jadi rencana lama tidak boleh menampilkan harga hari ini).
UPDATE "plan_steps" AS ps
SET "old_price" = p."sell_price"
FROM "action_plans" AS ap
JOIN "products" AS p ON p."id" = ap."product_id"
WHERE ap."id" = ps."plan_id";--> statement-breakpoint
-- Backfill step bundle: nama + harga pasangan, dan harga paket = new_price +
-- harga pasangan (SPEC §5.4, `bundlePriceFor`).
UPDATE "plan_steps" AS ps
SET "bundle_product_name" = p."name",
    "bundle_product_sell_price" = p."sell_price",
    "bundle_price" = ps."new_price" + p."sell_price"
FROM "products" AS p
WHERE p."id" = ps."bundle_product_id"
  AND ps."action_type" = 'bundle';
