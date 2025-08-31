-- CreateTable
-- Add pay period preferences to users table
ALTER TABLE "users" ADD COLUMN "payPeriodFrequency" TEXT NOT NULL DEFAULT 'fortnightly';
ALTER TABLE "users" ADD COLUMN "payPeriodStartDay" INTEGER NOT NULL DEFAULT 1;