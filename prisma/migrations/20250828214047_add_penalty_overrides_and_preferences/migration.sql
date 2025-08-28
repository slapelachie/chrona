-- AlterTable
ALTER TABLE "users" ADD COLUMN "defaultPayGuideId" TEXT;
ALTER TABLE "users" ADD COLUMN "lastUsedPayGuideId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pay_guides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "baseHourlyRate" DECIMAL NOT NULL,
    "casualLoading" DECIMAL NOT NULL DEFAULT 0.25,
    "overtimeRate1_5x" DECIMAL NOT NULL DEFAULT 1.5,
    "overtimeRate2x" DECIMAL NOT NULL DEFAULT 2.0,
    "eveningPenalty" DECIMAL NOT NULL DEFAULT 1.15,
    "nightPenalty" DECIMAL NOT NULL DEFAULT 1.30,
    "saturdayPenalty" DECIMAL NOT NULL DEFAULT 1.25,
    "sundayPenalty" DECIMAL NOT NULL DEFAULT 1.75,
    "publicHolidayPenalty" DECIMAL NOT NULL DEFAULT 2.50,
    "eveningStart" TEXT NOT NULL DEFAULT '18:00',
    "eveningEnd" TEXT NOT NULL DEFAULT '22:00',
    "nightStart" TEXT NOT NULL DEFAULT '22:00',
    "nightEnd" TEXT NOT NULL DEFAULT '06:00',
    "dailyOvertimeHours" DECIMAL NOT NULL DEFAULT 8.0,
    "weeklyOvertimeHours" DECIMAL NOT NULL DEFAULT 38.0,
    "allowPenaltyCombination" BOOLEAN NOT NULL DEFAULT true,
    "penaltyCombinationRules" TEXT,
    CONSTRAINT "pay_guides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pay_guides" ("baseHourlyRate", "casualLoading", "createdAt", "dailyOvertimeHours", "effectiveFrom", "effectiveTo", "eveningEnd", "eveningPenalty", "eveningStart", "id", "isActive", "name", "nightEnd", "nightPenalty", "nightStart", "overtimeRate1_5x", "overtimeRate2x", "publicHolidayPenalty", "saturdayPenalty", "sundayPenalty", "updatedAt", "userId", "weeklyOvertimeHours") SELECT "baseHourlyRate", "casualLoading", "createdAt", "dailyOvertimeHours", "effectiveFrom", "effectiveTo", "eveningEnd", "eveningPenalty", "eveningStart", "id", "isActive", "name", "nightEnd", "nightPenalty", "nightStart", "overtimeRate1_5x", "overtimeRate2x", "publicHolidayPenalty", "saturdayPenalty", "sundayPenalty", "updatedAt", "userId", "weeklyOvertimeHours" FROM "pay_guides";
DROP TABLE "pay_guides";
ALTER TABLE "new_pay_guides" RENAME TO "pay_guides";
CREATE TABLE "new_shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "payGuideId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "shiftType" TEXT NOT NULL DEFAULT 'REGULAR',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "penaltyOverrides" TEXT,
    "autoCalculatePenalties" BOOLEAN NOT NULL DEFAULT true,
    "totalMinutes" INTEGER,
    "regularHours" DECIMAL,
    "overtimeHours" DECIMAL,
    "penaltyHours" DECIMAL,
    "grossPay" DECIMAL,
    "superannuation" DECIMAL,
    CONSTRAINT "shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shifts_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_shifts" ("breakMinutes", "createdAt", "endTime", "grossPay", "id", "location", "notes", "overtimeHours", "payGuideId", "penaltyHours", "regularHours", "shiftType", "startTime", "status", "superannuation", "totalMinutes", "updatedAt", "userId") SELECT "breakMinutes", "createdAt", "endTime", "grossPay", "id", "location", "notes", "overtimeHours", "payGuideId", "penaltyHours", "regularHours", "shiftType", "startTime", "status", "superannuation", "totalMinutes", "updatedAt", "userId" FROM "shifts";
DROP TABLE "shifts";
ALTER TABLE "new_shifts" RENAME TO "shifts";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
