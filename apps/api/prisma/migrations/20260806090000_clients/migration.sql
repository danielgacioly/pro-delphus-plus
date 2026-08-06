-- Cadastro de clientes. Migração puramente aditiva: nenhuma coluna existente é
-- alterada ou removida, e quotes.clientName continua sendo a fonte histórica do
-- nome impresso no documento.

CREATE TYPE "ClientKind" AS ENUM ('INDIVIDUAL', 'INSTITUTION', 'DISTRIBUTOR');

CREATE TABLE "clients" (
  "id"          TEXT NOT NULL,
  "kind"        "ClientKind" NOT NULL DEFAULT 'INDIVIDUAL',
  "prefix"      "ClientPrefix" NOT NULL DEFAULT 'NONE',
  "name"        TEXT NOT NULL,
  "institution" TEXT,
  "email"       TEXT,
  "phone"       TEXT,
  "taxId"       TEXT,
  "website"     TEXT,
  "country"     TEXT,
  "state"       TEXT,
  "city"        TEXT,
  "billToText"  TEXT,
  "shipToText"  TEXT,
  "sectors"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes"       TEXT,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,

  CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clients_name_idx" ON "clients"("name");

ALTER TABLE "clients"
  ADD CONSTRAINT "clients_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Vínculo opcional: orçamentos antigos seguem válidos sem cliente até o backfill.
ALTER TABLE "quotes" ADD COLUMN "clientId" TEXT;

ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "quotes_clientId_idx" ON "quotes"("clientId");
