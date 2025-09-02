-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "pay_guides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseRate" DECIMAL NOT NULL,
    "casualLoading" DECIMAL NOT NULL DEFAULT 0.25,
    "overtimeRules" JSONB NOT NULL,
    "description" TEXT,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "penalty_time_frames" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payGuideId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "multiplier" DECIMAL NOT NULL,
    "dayOfWeek" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    "isPublicHoliday" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "penalty_time_frames_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "payGuideId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalHours" DECIMAL,
    "basePay" DECIMAL,
    "overtimePay" DECIMAL,
    "penaltyPay" DECIMAL,
    "casualPay" DECIMAL,
    "totalPay" DECIMAL,
    "notes" TEXT,
    "payPeriodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shifts_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "shifts_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pay_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "totalHours" DECIMAL,
    "totalPay" DECIMAL,
    "actualPay" DECIMAL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pay_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pay_guides_name_key" ON "pay_guides"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pay_periods_userId_startDate_key" ON "pay_periods"("userId", "startDate");
