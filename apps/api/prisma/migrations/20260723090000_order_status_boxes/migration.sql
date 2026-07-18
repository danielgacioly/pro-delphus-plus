-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'COMPLETED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "packageCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "orders" ADD COLUMN "boxAssignments" JSONB;
ALTER TABLE "orders" ADD COLUMN "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';
