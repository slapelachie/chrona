/*
  Warnings:

  - You are about to drop the column `hecsHelpAmount` on the `year_to_date_tax` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_year_to_date_tax" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "grossIncome" DECIMAL NOT NULL DEFAULT 0,
    "payGWithholding" DECIMAL NOT NULL DEFAULT 0,
    "medicareLevy" DECIMAL NOT NULL DEFAULT 0,
    "totalWithholdings" DECIMAL NOT NULL DEFAULT 0,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "year_to_date_tax_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_year_to_date_tax" ("createdAt", "grossIncome", "id", "lastUpdated", "medicareLevy", "payGWithholding", "taxYear", "totalWithholdings", "updatedAt", "userId") SELECT "createdAt", "grossIncome", "id", "lastUpdated", "medicareLevy", "payGWithholding", "taxYear", "totalWithholdings", "updatedAt", "userId" FROM "year_to_date_tax";
DROP TABLE "year_to_date_tax";
ALTER TABLE "new_year_to_date_tax" RENAME TO "year_to_date_tax";
CREATE UNIQUE INDEX "year_to_date_tax_userId_taxYear_key" ON "year_to_date_tax"("userId", "taxYear");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
