/*
  Warnings:

  - You are about to drop the column `casualLoading` on the `pay_guides` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pay_guides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseRate" DECIMAL NOT NULL,
    "minimumShiftHours" INTEGER,
    "maximumShiftHours" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "description" TEXT,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_pay_guides" ("baseRate", "createdAt", "description", "effectiveFrom", "effectiveTo", "id", "isActive", "maximumShiftHours", "minimumShiftHours", "name", "timezone", "updatedAt") SELECT "baseRate", "createdAt", "description", "effectiveFrom", "effectiveTo", "id", "isActive", "maximumShiftHours", "minimumShiftHours", "name", "timezone", "updatedAt" FROM "pay_guides";
DROP TABLE "pay_guides";
ALTER TABLE "new_pay_guides" RENAME TO "pay_guides";
CREATE UNIQUE INDEX "pay_guides_name_key" ON "pay_guides"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
