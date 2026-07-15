/*
  Warnings:

  - Added the required column `clientName` to the `quotes` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClientPrefix" AS ENUM ('NONE', 'MR', 'MS');

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "clientPrefix" "ClientPrefix" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "freight" DROP NOT NULL,
ALTER COLUMN "freight" DROP DEFAULT;

-- Backfill existing test quotes (created before this field existed) with a placeholder
UPDATE "quotes" SET "clientName" = 'Cliente não informado' WHERE "clientName" IS NULL;

ALTER TABLE "quotes" ALTER COLUMN "clientName" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'PENDING';

-- Accounts that already existed before the approval workflow was introduced were already trusted/usable, so grandfather them in as approved
UPDATE "users" SET "status" = 'APPROVED';
