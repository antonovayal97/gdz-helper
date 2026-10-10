-- The onboarding tour is meant for brand-new accounts only.
-- Everyone who registered before it was introduced already knows the app,
-- so mark existing users as onboarded.

UPDATE "users" SET "onboarded_at" = CURRENT_TIMESTAMP WHERE "onboarded_at" IS NULL;
