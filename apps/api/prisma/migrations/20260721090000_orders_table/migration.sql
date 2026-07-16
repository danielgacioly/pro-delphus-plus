CREATE TYPE "PrepaymentMethod" AS ENUM ('PAYPAL', 'WIRE_TRANSFER');

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "quoteId" TEXT NOT NULL,
    "purchaseOrder" TEXT,
    "orderedByEmail" TEXT NOT NULL,
    "shipDate" TIMESTAMP(3),
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billToText" TEXT NOT NULL,
    "shipToText" TEXT NOT NULL,
    "shipToNote" TEXT,
    "numberOfPackages" TEXT,
    "netWeightKg" DECIMAL(10,3),
    "grossWeightKg" DECIMAL(10,3),
    "awbNumber" TEXT,
    "incoterms" TEXT,
    "prepaymentBy" "PrepaymentMethod" NOT NULL DEFAULT 'WIRE_TRANSFER',
    "paypalFee" DECIMAL(12,2),
    "nfNumber" TEXT,
    "nfDate" TIMESTAMP(3),
    "nfDocumentUrl" TEXT,
    "awbDocumentUrl" TEXT,
    "exchangeRate" DECIMAL(10,4),
    "invoicePdfUrl" TEXT,
    "packingListPdfUrl" TEXT,
    "packingListBoxPdfUrl" TEXT,
    "exportDocXlsxUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

ALTER TABLE "orders" ADD CONSTRAINT "orders_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
