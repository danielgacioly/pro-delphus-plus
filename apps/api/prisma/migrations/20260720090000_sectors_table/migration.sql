CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sectors_name_key" ON "sectors"("name");

-- Seed with every sector already in use so nothing already assigned to a
-- product disappears from the management list.
INSERT INTO "sectors" ("id", "name")
SELECT gen_random_uuid()::text, s.sector
FROM (SELECT DISTINCT sector FROM "products" WHERE sector <> '') s
ON CONFLICT ("name") DO NOTHING;
