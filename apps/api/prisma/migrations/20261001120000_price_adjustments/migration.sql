-- CreateTable
CREATE TABLE "price_adjustments" (
    "id" TEXT NOT NULL,
    "priceTable" TEXT NOT NULL,
    "percent" DECIMAL(7,2) NOT NULL,
    "productCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "price_adjustments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "price_adjustments" ADD CONSTRAINT "price_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
