-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pay_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalHours" DECIMAL,
    "totalPay" DECIMAL,
    "paygWithholding" DECIMAL,
    "stslAmount" DECIMAL,
    "totalWithholdings" DECIMAL,
    "netPay" DECIMAL,
    "actualPay" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pay_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pay_periods" ("actualPay", "createdAt", "endDate", "id", "netPay", "paygWithholding", "startDate", "status", "stslAmount", "totalHours", "totalPay", "totalWithholdings", "updatedAt", "userId") SELECT "actualPay", "createdAt", "endDate", "id", "netPay", "paygWithholding", "startDate", "status", "stslAmount", "totalHours", "totalPay", "totalWithholdings", "updatedAt", "userId" FROM "pay_periods";
DROP TABLE "pay_periods";
ALTER TABLE "new_pay_periods" RENAME TO "pay_periods";

-- Normalize legacy status values to new enum casing
UPDATE "pay_periods"
SET "status" = CASE
  WHEN "status" IN ('open', 'processing', 'paid', 'PENDING', 'pending') THEN 'PENDING'
  WHEN "status" IN ('verified', 'VERIFIED') THEN 'VERIFIED'
  ELSE 'PENDING'
END;
CREATE UNIQUE INDEX "pay_periods_userId_startDate_key" ON "pay_periods"("userId", "startDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
