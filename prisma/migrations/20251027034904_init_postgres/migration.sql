-- CreateEnum
CREATE TYPE "public"."PayPeriodType" AS ENUM ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "public"."PayPeriodStatus" AS ENUM ('PENDING', 'VERIFIED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "payPeriodType" "public"."PayPeriodType" NOT NULL DEFAULT 'WEEKLY',
    "defaultShiftLengthMinutes" INTEGER NOT NULL DEFAULT 180,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pay_guides" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseRate" DECIMAL(65,30) NOT NULL,
    "minimumShiftHours" INTEGER,
    "maximumShiftHours" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "description" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."penalty_time_frames" (
    "id" TEXT NOT NULL,
    "payGuideId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "multiplier" DECIMAL(65,30) NOT NULL,
    "dayOfWeek" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    "isPublicHoliday" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalty_time_frames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shifts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payGuideId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "totalHours" DECIMAL(65,30),
    "basePay" DECIMAL(65,30),
    "overtimePay" DECIMAL(65,30),
    "penaltyPay" DECIMAL(65,30),
    "totalPay" DECIMAL(65,30),
    "notes" TEXT,
    "payPeriodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shift_penalty_segments" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "timeFrameId" TEXT,
    "name" TEXT NOT NULL,
    "multiplier" DECIMAL(65,30) NOT NULL,
    "hours" DECIMAL(65,30) NOT NULL,
    "pay" DECIMAL(65,30) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_penalty_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shift_overtime_segments" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "timeFrameId" TEXT,
    "name" TEXT NOT NULL,
    "multiplier" DECIMAL(65,30) NOT NULL,
    "hours" DECIMAL(65,30) NOT NULL,
    "pay" DECIMAL(65,30) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_overtime_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."break_periods" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "break_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."overtime_time_frames" (
    "id" TEXT NOT NULL,
    "payGuideId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstThreeHoursMult" DECIMAL(65,30) NOT NULL,
    "afterThreeHoursMult" DECIMAL(65,30) NOT NULL,
    "dayOfWeek" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    "isPublicHoliday" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_time_frames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."public_holidays" (
    "id" TEXT NOT NULL,
    "payGuideId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pay_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."PayPeriodStatus" NOT NULL DEFAULT 'PENDING',
    "totalHours" DECIMAL(65,30),
    "totalPay" DECIMAL(65,30),
    "paygWithholding" DECIMAL(65,30),
    "stslAmount" DECIMAL(65,30),
    "totalWithholdings" DECIMAL(65,30),
    "netPay" DECIMAL(65,30),
    "actualPay" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pay_period_extras" (
    "id" TEXT NOT NULL,
    "payPeriodId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_period_extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pay_period_extra_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_period_extra_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tax_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimedTaxFreeThreshold" BOOLEAN NOT NULL DEFAULT true,
    "isForeignResident" BOOLEAN NOT NULL DEFAULT false,
    "hasTaxFileNumber" BOOLEAN NOT NULL DEFAULT true,
    "medicareExemption" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."year_to_date_tax" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "grossIncome" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "payGWithholding" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "stslAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalWithholdings" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "year_to_date_tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tax_coefficients" (
    "id" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "scale" TEXT NOT NULL,
    "earningsFrom" DECIMAL(65,30) NOT NULL,
    "earningsTo" DECIMAL(65,30),
    "coefficientA" DECIMAL(65,30) NOT NULL,
    "coefficientB" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_coefficients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stsl_rates" (
    "id" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "scale" TEXT NOT NULL,
    "earningsFrom" DECIMAL(65,30) NOT NULL,
    "earningsTo" DECIMAL(65,30),
    "coefficientA" DECIMAL(65,30) NOT NULL,
    "coefficientB" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stsl_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tax_rate_configs" (
    "id" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rate_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pay_guides_name_key" ON "public"."pay_guides"("name");

-- CreateIndex
CREATE INDEX "shift_penalty_segments_shiftId_idx" ON "public"."shift_penalty_segments"("shiftId");

-- CreateIndex
CREATE INDEX "shift_penalty_segments_startTime_idx" ON "public"."shift_penalty_segments"("startTime");

-- CreateIndex
CREATE INDEX "shift_overtime_segments_shiftId_idx" ON "public"."shift_overtime_segments"("shiftId");

-- CreateIndex
CREATE INDEX "shift_overtime_segments_startTime_idx" ON "public"."shift_overtime_segments"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "pay_periods_userId_startDate_key" ON "public"."pay_periods"("userId", "startDate");

-- CreateIndex
CREATE INDEX "pay_period_extras_payPeriodId_idx" ON "public"."pay_period_extras"("payPeriodId");

-- CreateIndex
CREATE INDEX "pay_period_extra_templates_userId_idx" ON "public"."pay_period_extra_templates"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_settings_userId_key" ON "public"."tax_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "year_to_date_tax_userId_taxYear_key" ON "public"."year_to_date_tax"("userId", "taxYear");

-- CreateIndex
CREATE INDEX "tax_coefficients_taxYear_scale_isActive_idx" ON "public"."tax_coefficients"("taxYear", "scale", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tax_coefficients_taxYear_scale_earningsFrom_key" ON "public"."tax_coefficients"("taxYear", "scale", "earningsFrom");

-- CreateIndex
CREATE INDEX "stsl_rates_taxYear_scale_isActive_idx" ON "public"."stsl_rates"("taxYear", "scale", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "stsl_rates_taxYear_scale_earningsFrom_key" ON "public"."stsl_rates"("taxYear", "scale", "earningsFrom");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rate_configs_taxYear_key" ON "public"."tax_rate_configs"("taxYear");

-- AddForeignKey
ALTER TABLE "public"."penalty_time_frames" ADD CONSTRAINT "penalty_time_frames_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "public"."pay_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shifts" ADD CONSTRAINT "shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shifts" ADD CONSTRAINT "shifts_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "public"."pay_guides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shifts" ADD CONSTRAINT "shifts_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "public"."pay_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_penalty_segments" ADD CONSTRAINT "shift_penalty_segments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_penalty_segments" ADD CONSTRAINT "shift_penalty_segments_timeFrameId_fkey" FOREIGN KEY ("timeFrameId") REFERENCES "public"."penalty_time_frames"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_overtime_segments" ADD CONSTRAINT "shift_overtime_segments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_overtime_segments" ADD CONSTRAINT "shift_overtime_segments_timeFrameId_fkey" FOREIGN KEY ("timeFrameId") REFERENCES "public"."overtime_time_frames"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."break_periods" ADD CONSTRAINT "break_periods_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."overtime_time_frames" ADD CONSTRAINT "overtime_time_frames_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "public"."pay_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."public_holidays" ADD CONSTRAINT "public_holidays_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "public"."pay_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pay_periods" ADD CONSTRAINT "pay_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pay_period_extras" ADD CONSTRAINT "pay_period_extras_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "public"."pay_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pay_period_extra_templates" ADD CONSTRAINT "pay_period_extra_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tax_settings" ADD CONSTRAINT "tax_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."year_to_date_tax" ADD CONSTRAINT "year_to_date_tax_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
