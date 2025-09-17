-- CreateTable
CREATE TABLE "pay_period_extras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payPeriodId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pay_period_extras_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_stsl_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxYear" TEXT NOT NULL,
    "scale" TEXT NOT NULL,
    "earningsFrom" DECIMAL NOT NULL,
    "earningsTo" DECIMAL,
    "coefficientA" DECIMAL NOT NULL,
    "coefficientB" DECIMAL NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_stsl_rates" ("coefficientA", "coefficientB", "createdAt", "description", "earningsFrom", "earningsTo", "id", "isActive", "scale", "taxYear", "updatedAt") SELECT "coefficientA", "coefficientB", "createdAt", "description", "earningsFrom", "earningsTo", "id", "isActive", "scale", "taxYear", "updatedAt" FROM "stsl_rates";
DROP TABLE "stsl_rates";
ALTER TABLE "new_stsl_rates" RENAME TO "stsl_rates";
CREATE INDEX "stsl_rates_taxYear_scale_isActive_idx" ON "stsl_rates"("taxYear", "scale", "isActive");
CREATE UNIQUE INDEX "stsl_rates_taxYear_scale_earningsFrom_key" ON "stsl_rates"("taxYear", "scale", "earningsFrom");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "payPeriodType" TEXT NOT NULL DEFAULT 'WEEKLY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("createdAt", "email", "id", "name", "payPeriodType", "timezone", "updatedAt") SELECT "createdAt", "email", "id", "name", "payPeriodType", "timezone", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "pay_period_extras_payPeriodId_idx" ON "pay_period_extras"("payPeriodId");
