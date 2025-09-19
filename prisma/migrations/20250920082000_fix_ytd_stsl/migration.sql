/*
  Align year_to_date_tax with schema: add stslAmount, drop medicareLevy.
*/
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_year_to_date_tax" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "grossIncome" DECIMAL NOT NULL DEFAULT 0,
    "payGWithholding" DECIMAL NOT NULL DEFAULT 0,
    "stslAmount" DECIMAL NOT NULL DEFAULT 0,
    "totalWithholdings" DECIMAL NOT NULL DEFAULT 0,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "year_to_date_tax_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Migrate existing data; set stslAmount to 0 as default
INSERT INTO "new_year_to_date_tax" ("id","userId","taxYear","grossIncome","payGWithholding","stslAmount","totalWithholdings","lastUpdated","createdAt","updatedAt")
SELECT "id","userId","taxYear","grossIncome","payGWithholding",0,"totalWithholdings","lastUpdated","createdAt","updatedAt" FROM "year_to_date_tax";
DROP TABLE "year_to_date_tax";
ALTER TABLE "new_year_to_date_tax" RENAME TO "year_to_date_tax";
CREATE UNIQUE INDEX "year_to_date_tax_userId_taxYear_key" ON "year_to_date_tax"("userId", "taxYear");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
