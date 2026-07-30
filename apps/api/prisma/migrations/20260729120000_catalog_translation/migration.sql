ALTER TABLE "products" ADD COLUMN "descriptionPt" TEXT;
ALTER TABLE "products" ADD COLUMN "componentsPt" TEXT;
ALTER TABLE "sectors" ADD COLUMN "namePt" TEXT;
ALTER TABLE "users" ADD COLUMN "catalogLanguage" TEXT NOT NULL DEFAULT 'EN';
