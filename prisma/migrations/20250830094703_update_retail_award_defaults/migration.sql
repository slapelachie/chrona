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
    "casualLoading" DECIMAL NOT NULL DEFAULT 0.0,
    "overtimeRate1_5x" DECIMAL NOT NULL DEFAULT 1.75,
    "overtimeRate2x" DECIMAL NOT NULL DEFAULT 2.25,
    "eveningPenalty" DECIMAL NOT NULL DEFAULT 1.5,
    "nightPenalty" DECIMAL NOT NULL DEFAULT 1.30,
    "saturdayPenalty" DECIMAL NOT NULL DEFAULT 1.5,
    "sundayPenalty" DECIMAL NOT NULL DEFAULT 1.75,
    "publicHolidayPenalty" DECIMAL NOT NULL DEFAULT 2.5,
    "eveningStart" TEXT NOT NULL DEFAULT '18:00',
    "eveningEnd" TEXT NOT NULL DEFAULT '22:00',
    "nightStart" TEXT NOT NULL DEFAULT '22:00',
    "nightEnd" TEXT NOT NULL DEFAULT '06:00',
    "mondayStart" TEXT NOT NULL DEFAULT '07:00',
    "mondayEnd" TEXT NOT NULL DEFAULT '21:00',
    "tuesdayStart" TEXT NOT NULL DEFAULT '07:00',
    "tuesdayEnd" TEXT NOT NULL DEFAULT '21:00',
    "wednesdayStart" TEXT NOT NULL DEFAULT '07:00',
    "wednesdayEnd" TEXT NOT NULL DEFAULT '21:00',
    "thursdayStart" TEXT NOT NULL DEFAULT '07:00',
    "thursdayEnd" TEXT NOT NULL DEFAULT '21:00',
    "fridayStart" TEXT NOT NULL DEFAULT '07:00',
    "fridayEnd" TEXT NOT NULL DEFAULT '21:00',
    "saturdayStart" TEXT NOT NULL DEFAULT '07:00',
    "saturdayEnd" TEXT NOT NULL DEFAULT '18:00',
    "sundayStart" TEXT NOT NULL DEFAULT '09:00',
    "sundayEnd" TEXT NOT NULL DEFAULT '18:00',
    "dailyOvertimeHours" DECIMAL NOT NULL DEFAULT 9.0,
    "specialDayOvertimeHours" DECIMAL NOT NULL DEFAULT 11.0,
    "weeklyOvertimeHours" DECIMAL NOT NULL DEFAULT 38.0,
    "overtimeOnSpanBoundary" BOOLEAN NOT NULL DEFAULT true,
    "overtimeOnDailyLimit" BOOLEAN NOT NULL DEFAULT true,
    "overtimeOnWeeklyLimit" BOOLEAN NOT NULL DEFAULT true,
    "allowPenaltyCombination" BOOLEAN NOT NULL DEFAULT true,
    "penaltyCombinationRules" TEXT,
    CONSTRAINT "pay_guides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pay_guides" ("allowPenaltyCombination", "baseHourlyRate", "casualLoading", "createdAt", "dailyOvertimeHours", "effectiveFrom", "effectiveTo", "eveningEnd", "eveningPenalty", "eveningStart", "fridayEnd", "fridayStart", "id", "isActive", "mondayEnd", "mondayStart", "name", "nightEnd", "nightPenalty", "nightStart", "overtimeRate1_5x", "overtimeRate2x", "penaltyCombinationRules", "publicHolidayPenalty", "saturdayEnd", "saturdayPenalty", "saturdayStart", "sundayEnd", "sundayPenalty", "sundayStart", "thursdayEnd", "thursdayStart", "tuesdayEnd", "tuesdayStart", "updatedAt", "userId", "wednesdayEnd", "wednesdayStart", "weeklyOvertimeHours") SELECT "allowPenaltyCombination", "baseHourlyRate", "casualLoading", "createdAt", "dailyOvertimeHours", "effectiveFrom", "effectiveTo", "eveningEnd", "eveningPenalty", "eveningStart", "fridayEnd", "fridayStart", "id", "isActive", "mondayEnd", "mondayStart", "name", "nightEnd", "nightPenalty", "nightStart", "overtimeRate1_5x", "overtimeRate2x", "penaltyCombinationRules", "publicHolidayPenalty", "saturdayEnd", "saturdayPenalty", "saturdayStart", "sundayEnd", "sundayPenalty", "sundayStart", "thursdayEnd", "thursdayStart", "tuesdayEnd", "tuesdayStart", "updatedAt", "userId", "wednesdayEnd", "wednesdayStart", "weeklyOvertimeHours" FROM "pay_guides";
DROP TABLE "pay_guides";
ALTER TABLE "new_pay_guides" RENAME TO "pay_guides";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
