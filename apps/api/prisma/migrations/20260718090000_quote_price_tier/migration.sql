-- CreateEnum
CREATE TYPE "PriceTier" AS ENUM ('FINAL', 'DISTRIBUTOR');

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN "priceTier" "PriceTier" NOT NULL DEFAULT 'FINAL';
