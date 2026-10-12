-- Custom balance top-up: packages are no longer required to create a payment.
-- package_id becomes optional, granted credits are stored directly on the payment.

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "package_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "credits" INTEGER;

-- Backfill credits for existing payments from their package
UPDATE "payments" p SET "credits" = c."credits"
FROM "credit_packages" c
WHERE p."package_id" = c."id";
