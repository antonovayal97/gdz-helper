-- Email registration support:
-- an account is either Telegram-based (telegram_id) or email-based (email + password_hash).

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "telegram_id" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "email" TEXT;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Drop the legacy development mock user (cascades to its solutions/payments/referrals).
DELETE FROM "users" WHERE "telegram_id" = '1000000000000' AND "username" = 'dev_user';
