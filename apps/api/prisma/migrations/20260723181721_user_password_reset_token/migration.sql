-- AlterTable
ALTER TABLE "users" ADD COLUMN "resetPasswordTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN "resetPasswordExpiresAt" TIMESTAMP(3);
