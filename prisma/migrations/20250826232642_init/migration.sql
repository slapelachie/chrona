-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "taxFreeThreshold" BOOLEAN NOT NULL DEFAULT true,
    "medicareExemption" BOOLEAN NOT NULL DEFAULT false,
    "hecsDebtAmount" DECIMAL,
    "hecsThreshold" DECIMAL,
    "hecsRate" DECIMAL,
    "extraTaxWithheld" DECIMAL NOT NULL DEFAULT 0,
    "superRate" DECIMAL NOT NULL DEFAULT 11,
    "payPeriodType" TEXT NOT NULL DEFAULT 'FORTNIGHTLY',
    "payPeriodStartDay" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "pay_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseRate" DECIMAL NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "rateType" TEXT NOT NULL DEFAULT 'BASE',
    "multiplier" DECIMAL NOT NULL DEFAULT 1.0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "applyWeekend" BOOLEAN NOT NULL DEFAULT false,
    "applyPublicHoliday" BOOLEAN NOT NULL DEFAULT false,
    "applyNight" BOOLEAN NOT NULL DEFAULT false,
    "nightStart" TEXT,
    "nightEnd" TEXT,
    "overtimeThreshold" DECIMAL,
    "overtimeMultiplier" DECIMAL
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "breakTime" DECIMAL NOT NULL DEFAULT 0,
    "payRateId" TEXT NOT NULL,
    "hourlyRate" DECIMAL NOT NULL,
    "hoursWorked" DECIMAL NOT NULL,
    "regularHours" DECIMAL NOT NULL,
    "overtimeHours" DECIMAL NOT NULL DEFAULT 0,
    "penaltyHours" DECIMAL NOT NULL DEFAULT 0,
    "grossPay" DECIMAL NOT NULL,
    "isPublicHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isNightShift" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "payPeriodId" TEXT,
    CONSTRAINT "shifts_payRateId_fkey" FOREIGN KEY ("payRateId") REFERENCES "pay_rates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "shifts_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pay_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "payDate" DATETIME,
    "totalHours" DECIMAL NOT NULL,
    "regularHours" DECIMAL NOT NULL,
    "overtimeHours" DECIMAL NOT NULL,
    "penaltyHours" DECIMAL NOT NULL,
    "grossPay" DECIMAL NOT NULL,
    "taxWithheld" DECIMAL NOT NULL,
    "medicareLevy" DECIMAL NOT NULL,
    "hecsDeduction" DECIMAL NOT NULL DEFAULT 0,
    "superContrib" DECIMAL NOT NULL,
    "netPay" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FORECAST'
);

-- CreateTable
CREATE TABLE "pay_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "payPeriodId" TEXT NOT NULL,
    "actualGrossPay" DECIMAL NOT NULL,
    "actualTaxWithheld" DECIMAL NOT NULL,
    "actualMedicareLevy" DECIMAL NOT NULL,
    "actualHecsDeduction" DECIMAL NOT NULL DEFAULT 0,
    "actualSuperContrib" DECIMAL NOT NULL,
    "actualNetPay" DECIMAL NOT NULL,
    "grossPayDiff" DECIMAL NOT NULL,
    "taxWithheldDiff" DECIMAL NOT NULL,
    "medicareLevyDiff" DECIMAL NOT NULL,
    "hecsDeductionDiff" DECIMAL NOT NULL DEFAULT 0,
    "superContribDiff" DECIMAL NOT NULL,
    "netPayDiff" DECIMAL NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "hasDiscrepancies" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "pay_verifications_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tax_brackets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxYear" TEXT NOT NULL,
    "minIncome" DECIMAL NOT NULL,
    "maxIncome" DECIMAL,
    "taxRate" DECIMAL NOT NULL,
    "baseAmount" DECIMAL NOT NULL
);

-- CreateTable
CREATE TABLE "hecs_thresholds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxYear" TEXT NOT NULL,
    "minIncome" DECIMAL NOT NULL,
    "maxIncome" DECIMAL,
    "repaymentRate" DECIMAL NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "pay_verifications_payPeriodId_key" ON "pay_verifications"("payPeriodId");
