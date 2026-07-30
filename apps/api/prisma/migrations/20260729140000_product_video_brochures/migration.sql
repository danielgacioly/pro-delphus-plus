ALTER TABLE "products" ADD COLUMN "videoLinks" TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE "product_brochures" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_brochures_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "product_brochures" ADD CONSTRAINT "product_brochures_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
