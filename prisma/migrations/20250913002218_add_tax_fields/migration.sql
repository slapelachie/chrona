-- AlterTable
ALTER TABLE "pay_periods" ADD COLUMN "hecsHelpAmount" DECIMAL;
ALTER TABLE "pay_periods" ADD COLUMN "medicareLevy" DECIMAL;
ALTER TABLE "pay_periods" ADD COLUMN "netPay" DECIMAL;
ALTER TABLE "pay_periods" ADD COLUMN "paygWithholding" DECIMAL;
ALTER TABLE "pay_periods" ADD COLUMN "totalWithholdings" DECIMAL;

-- CreateTable
CREATE TABLE "tax_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "claimedTaxFreeThreshold" BOOLEAN NOT NULL DEFAULT true,
    "isForeignResident" BOOLEAN NOT NULL DEFAULT false,
    "hasTaxFileNumber" BOOLEAN NOT NULL DEFAULT true,
    "medicareExemption" TEXT NOT NULL DEFAULT 'none',
    "hecsHelpRate" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tax_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "year_to_date_tax" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "grossIncome" DECIMAL NOT NULL DEFAULT 0,
    "payGWithholding" DECIMAL NOT NULL DEFAULT 0,
    "medicareLevy" DECIMAL NOT NULL DEFAULT 0,
    "hecsHelpAmount" DECIMAL NOT NULL DEFAULT 0,
    "totalWithholdings" DECIMAL NOT NULL DEFAULT 0,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "year_to_date_tax_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_settings_userId_key" ON "tax_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "year_to_date_tax_userId_taxYear_key" ON "year_to_date_tax"("userId", "taxYear");
