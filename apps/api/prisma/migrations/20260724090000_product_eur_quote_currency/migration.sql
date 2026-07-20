-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('BRL', 'USD', 'EUR');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "priceEUR" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'USD';

-- Backfill existing quotes' currency from their language (old behavior: PT
-- always meant BRL, EN/ES always meant USD) so historical quotes keep their
-- original currency now that it's an explicit, independent field.
UPDATE "quotes" SET "currency" = 'BRL' WHERE "language" = 'PT';
