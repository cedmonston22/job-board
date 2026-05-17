-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- Backfill: any user that already exists predates the onboarding step.
-- Stamp onboardedAt with their existing updatedAt so they don't get
-- bounced through onboarding the next time they hit the dashboard.
UPDATE "User" SET "onboardedAt" = "updatedAt" WHERE "onboardedAt" IS NULL;
