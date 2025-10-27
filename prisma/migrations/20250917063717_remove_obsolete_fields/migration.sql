/*
  Warnings:

  - You are about to drop the `hecs_thresholds` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `hecsHelpAmount` on the `pay_periods` table. All the data in the column will be lost.
  - You are about to drop the column `medicareLevy` on the `pay_periods` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `pay_periods` table. All the data in the column will be lost.
  - You are about to drop the column `medicareHighIncomeThreshold` on the `tax_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `medicareLowIncomeThreshold` on the `tax_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `medicareRate` on the `tax_rate_configs` table. All the data in the column will be lost.
  - You are about to drop the column `hecsHelpRate` on the `tax_settings` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "hecs_thresholds_taxYear_incomeFrom_key";

-- DropIndex
DROP INDEX "hecs_thresholds_taxYear_isActive_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "hecs_thresholds";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pay_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
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
INSERT INTO "new_pay_periods" ("actualPay", "createdAt", "endDate", "id", "netPay", "paygWithholding", "startDate", "status", "totalHours", "totalPay", "totalWithholdings", "updatedAt", "userId") SELECT "actualPay", "createdAt", "endDate", "id", "netPay", "paygWithholding", "startDate", "status", "totalHours", "totalPay", "totalWithholdings", "updatedAt", "userId" FROM "pay_periods";
DROP TABLE "pay_periods";
ALTER TABLE "new_pay_periods" RENAME TO "pay_periods";
CREATE UNIQUE INDEX "pay_periods_userId_startDate_key" ON "pay_periods"("userId", "startDate");
CREATE TABLE "new_tax_rate_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxYear" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_tax_rate_configs" ("createdAt", "description", "id", "isActive", "taxYear", "updatedAt") SELECT "createdAt", "description", "id", "isActive", "taxYear", "updatedAt" FROM "tax_rate_configs";
DROP TABLE "tax_rate_configs";
ALTER TABLE "new_tax_rate_configs" RENAME TO "tax_rate_configs";
CREATE UNIQUE INDEX "tax_rate_configs_taxYear_key" ON "tax_rate_configs"("taxYear");
CREATE TABLE "new_tax_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "claimedTaxFreeThreshold" BOOLEAN NOT NULL DEFAULT true,
    "isForeignResident" BOOLEAN NOT NULL DEFAULT false,
    "hasTaxFileNumber" BOOLEAN NOT NULL DEFAULT true,
    "medicareExemption" TEXT NOT NULL DEFAULT 'none',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tax_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tax_settings" ("claimedTaxFreeThreshold", "createdAt", "hasTaxFileNumber", "id", "isForeignResident", "medicareExemption", "updatedAt", "userId") SELECT "claimedTaxFreeThreshold", "createdAt", "hasTaxFileNumber", "id", "isForeignResident", "medicareExemption", "updatedAt", "userId" FROM "tax_settings";
DROP TABLE "tax_settings";
ALTER TABLE "new_tax_settings" RENAME TO "tax_settings";
CREATE UNIQUE INDEX "tax_settings_userId_key" ON "tax_settings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
