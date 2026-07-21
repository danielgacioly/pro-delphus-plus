-- AlterTable: replace the single "sector" text column with a "sectors" array,
-- so a product can belong to more than one sector.
ALTER TABLE "products" ADD COLUMN "sectors" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: every existing product keeps its current sector as the sole entry.
UPDATE "products" SET "sectors" = ARRAY["sector"] WHERE "sector" IS NOT NULL AND "sector" <> '';

ALTER TABLE "products" DROP COLUMN "sector";
