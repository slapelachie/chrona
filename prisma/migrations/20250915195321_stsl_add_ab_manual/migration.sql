-- Add coefficientA and coefficientB to stsl_rates, and backfill from legacy rate
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
ALTER TABLE stsl_rates ADD COLUMN coefficientA DECIMAL DEFAULT 0;
ALTER TABLE stsl_rates ADD COLUMN coefficientB DECIMAL DEFAULT 0;
UPDATE stsl_rates SET coefficientA = COALESCE(rate, 0), coefficientB = 0;
COMMIT;
PRAGMA foreign_keys=ON;
