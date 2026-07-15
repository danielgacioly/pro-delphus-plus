-- CreateEnum
CREATE TYPE "QuoteLanguage" AS ENUM ('PT', 'EN', 'ES');

-- DropForeignKey
ALTER TABLE "price_change_requests" DROP CONSTRAINT "price_change_requests_priceTableEntryId_fkey";

-- DropForeignKey
ALTER TABLE "price_change_requests" DROP CONSTRAINT "price_change_requests_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "price_change_requests" DROP CONSTRAINT "price_change_requests_reviewedById_fkey";

-- AlterTable
ALTER TABLE "price_table_entries" ADD COLUMN "sector" TEXT;

-- Backfill existing test rows (created before "sector" existed) with a placeholder
UPDATE "price_table_entries" SET "sector" = 'Geral' WHERE "sector" IS NULL;

ALTER TABLE "price_table_entries" ALTER COLUMN "sector" SET NOT NULL;

-- AlterTable
ALTER TABLE "product_media" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN "language" "QuoteLanguage" NOT NULL DEFAULT 'PT',
ADD COLUMN "xlsxUrl" TEXT;

-- DropTable
DROP TABLE "price_change_requests";

-- DropEnum
DROP TYPE "PriceChangeStatus";
