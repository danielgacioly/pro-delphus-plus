-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('COMPLETE_MODEL', 'COMPONENT');

-- AlterTable: add new columns to products (sector nullable for now, backfilled below)
ALTER TABLE "products" ADD COLUMN     "kind" "ProductKind" NOT NULL DEFAULT 'COMPLETE_MODEL',
ADD COLUMN     "priceBRL" DECIMAL(12,2),
ADD COLUMN     "priceUSD" DECIMAL(12,2),
ADD COLUMN     "priceUSDDistributor" DECIMAL(12,2),
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable: add description to quote_items (nullable for now, backfilled below)
ALTER TABLE "quote_items" ADD COLUMN     "description" TEXT;

-- Backfill: copy sector/prices from existing price_table_entries into matching products (by sku)
UPDATE "products" p
SET "sector" = e."sector",
    "priceBRL" = e."priceBRL",
    "priceUSD" = e."priceUSD"
FROM "price_table_entries" e
WHERE e."sku" = p."sku";

-- Backfill: any product still without a sector (never had a price entry) gets a placeholder
UPDATE "products" SET "sector" = 'Geral' WHERE "sector" IS NULL;

-- Backfill: price entries that had no matching product become new component-less products
INSERT INTO "products" ("id", "sku", "name", "description", "sector", "kind", "priceBRL", "priceUSD", "active", "createdAt", "updatedAt")
SELECT e."id", e."sku", e."description", e."description", e."sector", 'COMPLETE_MODEL', e."priceBRL", e."priceUSD", e."active", e."createdAt", e."updatedAt"
FROM "price_table_entries" e
WHERE NOT EXISTS (SELECT 1 FROM "products" p WHERE p."sku" = e."sku");

-- Backfill: quote item descriptions from the product's name at the time
UPDATE "quote_items" qi
SET "description" = p."name"
FROM "products" p
WHERE p."id" = qi."productId";

UPDATE "quote_items" SET "description" = 'Item' WHERE "description" IS NULL;

-- Enforce NOT NULL now that both columns are backfilled
ALTER TABLE "products" ALTER COLUMN "sector" SET NOT NULL;
ALTER TABLE "quote_items" ALTER COLUMN "description" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "price_table_entries" DROP CONSTRAINT "price_table_entries_updatedById_fkey";

-- DropTable
DROP TABLE "price_table_entries";

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
