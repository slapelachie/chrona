-- CreateTable
CREATE TABLE "tax_coefficients" (
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

-- CreateTable
CREATE TABLE "hecs_thresholds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxYear" TEXT NOT NULL,
    "incomeFrom" DECIMAL NOT NULL,
    "incomeTo" DECIMAL,
    "rate" DECIMAL NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tax_rate_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxYear" TEXT NOT NULL,
    "medicareRate" DECIMAL NOT NULL DEFAULT 0.02,
    "medicareLowIncomeThreshold" DECIMAL NOT NULL DEFAULT 26000,
    "medicareHighIncomeThreshold" DECIMAL NOT NULL DEFAULT 32500,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "tax_coefficients_taxYear_scale_isActive_idx" ON "tax_coefficients"("taxYear", "scale", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tax_coefficients_taxYear_scale_earningsFrom_key" ON "tax_coefficients"("taxYear", "scale", "earningsFrom");

-- CreateIndex
CREATE INDEX "hecs_thresholds_taxYear_isActive_idx" ON "hecs_thresholds"("taxYear", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "hecs_thresholds_taxYear_incomeFrom_key" ON "hecs_thresholds"("taxYear", "incomeFrom");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rate_configs_taxYear_key" ON "tax_rate_configs"("taxYear");
