/*
  Warnings:

  - Made the column `payPeriodId` on table `shifts` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "payGuideId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "totalHours" DECIMAL,
    "basePay" DECIMAL,
    "overtimePay" DECIMAL,
    "penaltyPay" DECIMAL,
    "totalPay" DECIMAL,
    "notes" TEXT,
    "payPeriodId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shifts_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "shifts_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_shifts" ("basePay", "createdAt", "endTime", "id", "notes", "overtimePay", "payGuideId", "payPeriodId", "penaltyPay", "startTime", "totalHours", "totalPay", "updatedAt", "userId") SELECT "basePay", "createdAt", "endTime", "id", "notes", "overtimePay", "payGuideId", "payPeriodId", "penaltyPay", "startTime", "totalHours", "totalPay", "updatedAt", "userId" FROM "shifts";
DROP TABLE "shifts";
ALTER TABLE "new_shifts" RENAME TO "shifts";
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "payPeriodType" TEXT NOT NULL DEFAULT 'FORTNIGHTLY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("createdAt", "email", "id", "name", "timezone", "updatedAt") SELECT "createdAt", "email", "id", "name", "timezone", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
