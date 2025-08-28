-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "taxFileNumber" TEXT,
    "tfnDeclared" BOOLEAN NOT NULL DEFAULT false,
    "dateOfBirth" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "claimsTaxFreeThreshold" BOOLEAN NOT NULL DEFAULT true,
    "hasHECSDebt" BOOLEAN NOT NULL DEFAULT false,
    "hasStudentFinancialSupplement" BOOLEAN NOT NULL DEFAULT false,
    "medicareLevyExemption" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "pay_guides" (
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
    CONSTRAINT "pay_guides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tax_brackets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" TEXT NOT NULL,
    "minIncome" DECIMAL NOT NULL,
    "maxIncome" DECIMAL,
    "taxRate" DECIMAL NOT NULL,
    "baseTax" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "hecs_thresholds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" TEXT NOT NULL,
    "minIncome" DECIMAL NOT NULL,
    "maxIncome" DECIMAL,
    "repaymentRate" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "state" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "payGuideId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "shiftType" TEXT NOT NULL DEFAULT 'REGULAR',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "totalMinutes" INTEGER,
    "regularHours" DECIMAL,
    "overtimeHours" DECIMAL,
    "penaltyHours" DECIMAL,
    "grossPay" DECIMAL,
    "superannuation" DECIMAL,
    CONSTRAINT "shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shifts_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pay_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "payDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "weeklyHours" DECIMAL,
    "totalGrossPay" DECIMAL,
    "totalTax" DECIMAL,
    "hecsRepayment" DECIMAL,
    "medicareLevy" DECIMAL,
    "superannuation" DECIMAL,
    "totalNetPay" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pay_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pay_period_shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payPeriodId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    CONSTRAINT "pay_period_shifts_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pay_period_shifts_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pay_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "payPeriodId" TEXT NOT NULL,
    "actualGrossPay" DECIMAL NOT NULL,
    "actualTax" DECIMAL NOT NULL,
    "actualNetPay" DECIMAL NOT NULL,
    "actualSuper" DECIMAL,
    "actualHECS" DECIMAL,
    "paySlipReference" TEXT,
    "verificationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "grossPayDifference" DECIMAL,
    "taxDifference" DECIMAL,
    "netPayDifference" DECIMAL,
    CONSTRAINT "pay_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pay_verifications_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tax_brackets_year_minIncome_key" ON "tax_brackets"("year", "minIncome");

-- CreateIndex
CREATE UNIQUE INDEX "hecs_thresholds_year_minIncome_key" ON "hecs_thresholds"("year", "minIncome");

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_date_state_key" ON "public_holidays"("date", "state");

-- CreateIndex
CREATE UNIQUE INDEX "pay_periods_userId_startDate_key" ON "pay_periods"("userId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "pay_period_shifts_payPeriodId_shiftId_key" ON "pay_period_shifts"("payPeriodId", "shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "pay_verifications_userId_payPeriodId_key" ON "pay_verifications"("userId", "payPeriodId");
