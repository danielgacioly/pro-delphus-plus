-- AlterTable
ALTER TABLE "products" ADD COLUMN     "oldPriceBRL" DECIMAL(12,2),
ADD COLUMN     "oldPriceEUR" DECIMAL(12,2),
ADD COLUMN     "oldPriceUSD" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "oldPricePromo" BOOLEAN NOT NULL DEFAULT false;
