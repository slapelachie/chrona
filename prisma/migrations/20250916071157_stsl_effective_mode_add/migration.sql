PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
-- Add columns for effective date, mode, and legacy rate
ALTER TABLE stsl_rates ADD COLUMN effectiveFrom DATETIME NOT NULL DEFAULT '1970-01-01';
ALTER TABLE stsl_rates ADD COLUMN mode TEXT NOT NULL DEFAULT 'FORMULA_AB';
ALTER TABLE stsl_rates ADD COLUMN rate DECIMAL NULL;

-- Backfill effectiveFrom for existing A/B rows to switch date
UPDATE stsl_rates SET effectiveFrom = '2025-09-24' WHERE effectiveFrom = '1970-01-01';

-- Drop and recreate unique/indexes to include effectiveFrom
DROP INDEX IF EXISTS stsl_rates_taxYear_scale_earningsFrom_unique;
DROP INDEX IF EXISTS stsl_rates_taxYear_scale_isActive_idx;
CREATE UNIQUE INDEX IF NOT EXISTS stsl_rates_taxYear_scale_effectiveFrom_earningsFrom_unique ON stsl_rates(taxYear, scale, effectiveFrom, earningsFrom);
CREATE INDEX IF NOT EXISTS stsl_rates_taxYear_scale_effectiveFrom_isActive_idx ON stsl_rates(taxYear, scale, effectiveFrom, isActive);
COMMIT;
PRAGMA foreign_keys=ON;
