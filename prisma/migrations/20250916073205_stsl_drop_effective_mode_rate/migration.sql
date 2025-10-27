PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Rebuild stsl_rates with formula-only columns (drop effectiveFrom, mode, rate)
CREATE TABLE stsl_rates_new (
  id TEXT PRIMARY KEY NOT NULL,
  taxYear TEXT NOT NULL,
  scale TEXT NOT NULL,
  earningsFrom DECIMAL NOT NULL,
  earningsTo DECIMAL,
  coefficientA DECIMAL NOT NULL DEFAULT 0,
  coefficientB DECIMAL NOT NULL DEFAULT 0,
  description TEXT,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO stsl_rates_new (id, taxYear, scale, earningsFrom, earningsTo, coefficientA, coefficientB, description, isActive, createdAt, updatedAt)
SELECT id, taxYear, scale, earningsFrom, earningsTo,
       COALESCE(coefficientA, 0),
       COALESCE(coefficientB, 0),
       description, isActive, createdAt, updatedAt
FROM stsl_rates
WHERE isActive = 1; -- carry over only active rows

DROP TABLE stsl_rates;
ALTER TABLE stsl_rates_new RENAME TO stsl_rates;

-- Recreate indexes
CREATE UNIQUE INDEX stsl_rates_taxYear_scale_earningsFrom_unique ON stsl_rates(taxYear, scale, earningsFrom);
CREATE INDEX stsl_rates_taxYear_scale_isActive_idx ON stsl_rates(taxYear, scale, isActive);

COMMIT;
PRAGMA foreign_keys=ON;
