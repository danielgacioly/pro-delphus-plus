-- Add the new dual-currency columns first (nullable, backfilled below)
ALTER TABLE "price_table_entries" ADD COLUMN "priceBRL" DECIMAL(12,2);
ALTER TABLE "price_table_entries" ADD COLUMN "priceUSD" DECIMAL(12,2);

-- Backfill each existing row's own value based on its old market/currency
UPDATE "price_table_entries" SET "priceBRL" = "price" WHERE "market" = 'NATIONAL';
UPDATE "price_table_entries" SET "priceUSD" = "price" WHERE "market" = 'INTERNATIONAL';

-- Merge rows that share the same SKU (previously one row per market) into a single
-- row per SKU carrying both prices, keeping the lowest id as the survivor
UPDATE "price_table_entries" t
SET "priceBRL" = agg."priceBRL",
    "priceUSD" = agg."priceUSD"
FROM (
  SELECT "sku", MAX("priceBRL") AS "priceBRL", MAX("priceUSD") AS "priceUSD", MIN(id) AS keep_id
  FROM "price_table_entries"
  GROUP BY "sku"
) agg
WHERE t.id = agg.keep_id;

DELETE FROM "price_table_entries"
WHERE id NOT IN (SELECT MIN(id) FROM "price_table_entries" GROUP BY "sku");

-- DropIndex
DROP INDEX "price_table_entries_sku_market_key";

-- AlterTable
ALTER TABLE "price_table_entries" DROP COLUMN "currency",
DROP COLUMN "market",
DROP COLUMN "price";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "signatureUrl" TEXT;

-- DropEnum
DROP TYPE "Market";

-- CreateIndex
CREATE UNIQUE INDEX "price_table_entries_sku_key" ON "price_table_entries"("sku");
