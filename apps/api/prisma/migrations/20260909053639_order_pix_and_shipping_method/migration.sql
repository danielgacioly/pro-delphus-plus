-- AlterEnum
ALTER TYPE "PrepaymentMethod" ADD VALUE 'PIX';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shippingMethod" TEXT;
