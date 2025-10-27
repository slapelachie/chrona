-- CreateTable
CREATE TABLE "stsl_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxYear" TEXT NOT NULL,
    "scale" TEXT NOT NULL,
    "earningsFrom" DECIMAL NOT NULL,
    "earningsTo" DECIMAL,
    "rate" DECIMAL NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "stsl_rates_taxYear_scale_isActive_idx" ON "stsl_rates"("taxYear", "scale", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "stsl_rates_taxYear_scale_earningsFrom_key" ON "stsl_rates"("taxYear", "scale", "earningsFrom");
