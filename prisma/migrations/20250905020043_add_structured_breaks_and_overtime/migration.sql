/*
  Warnings:

  - You are about to drop the column `overtimeRules` on the `pay_guides` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "break_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "break_periods_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "overtime_time_frames" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payGuideId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstThreeHoursMult" DECIMAL NOT NULL,
    "afterThreeHoursMult" DECIMAL NOT NULL,
    "dayOfWeek" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    "isPublicHoliday" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "overtime_time_frames_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payGuideId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "public_holidays_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pay_guides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseRate" DECIMAL NOT NULL,
    "minimumShiftHours" INTEGER,
    "maximumShiftHours" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "casualLoading" DECIMAL NOT NULL DEFAULT 0.25,
    "description" TEXT,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_pay_guides" ("baseRate", "casualLoading", "createdAt", "description", "effectiveFrom", "effectiveTo", "id", "isActive", "name", "updatedAt") SELECT "baseRate", "casualLoading", "createdAt", "description", "effectiveFrom", "effectiveTo", "id", "isActive", "name", "updatedAt" FROM "pay_guides";
DROP TABLE "pay_guides";
ALTER TABLE "new_pay_guides" RENAME TO "pay_guides";
CREATE UNIQUE INDEX "pay_guides_name_key" ON "pay_guides"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
