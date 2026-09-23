-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "clientFolderId" INTEGER,
ADD COLUMN     "gnreDocumentUrl" TEXT,
ADD COLUMN     "creditCardPaymentLink" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_clientFolderId_key" ON "orders"("clientFolderId");
