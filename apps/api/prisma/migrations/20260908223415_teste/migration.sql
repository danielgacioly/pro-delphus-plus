-- DropIndex
DROP INDEX "quotes_clientId_idx";

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "sectors" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quotes" ALTER COLUMN "updatedAt" DROP DEFAULT;
