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
    "payPeriodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shifts_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "shifts_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_shifts" ("basePay", "createdAt", "endTime", "id", "notes", "overtimePay", "payGuideId", "payPeriodId", "penaltyPay", "startTime", "totalHours", "totalPay", "updatedAt", "userId") SELECT "basePay", "createdAt", "endTime", "id", "notes", "overtimePay", "payGuideId", "payPeriodId", "penaltyPay", "startTime", "totalHours", "totalPay", "updatedAt", "userId" FROM "shifts";
DROP TABLE "shifts";
ALTER TABLE "new_shifts" RENAME TO "shifts";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
