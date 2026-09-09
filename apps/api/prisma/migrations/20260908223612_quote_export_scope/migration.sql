-- CreateEnum
CREATE TYPE "ExportScope" AS ENUM ('NATIONAL', 'INTERNATIONAL');

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "exportScope" "ExportScope" NOT NULL DEFAULT 'INTERNATIONAL';

-- Backfill: orçamentos já existentes em BRL são, na prática, sempre vendas
-- nacionais — sem isso, todo histórico ficaria marcado Internacional.
UPDATE "quotes" SET "exportScope" = 'NATIONAL' WHERE "currency" = 'BRL';
