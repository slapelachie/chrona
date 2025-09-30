/*
  Warnings:

  - You are about to alter the column `createdAt` on the `pay_period_extra_templates` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("timestamp(3)")` to `DateTime`.
  - You are about to alter the column `updatedAt` on the `pay_period_extra_templates` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("timestamp(3)")` to `DateTime`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pay_period_extra_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pay_period_extra_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pay_period_extra_templates" ("active", "amount", "createdAt", "description", "id", "label", "sortOrder", "taxable", "updatedAt", "userId") SELECT "active", "amount", "createdAt", "description", "id", "label", "sortOrder", "taxable", "updatedAt", "userId" FROM "pay_period_extra_templates";
DROP TABLE "pay_period_extra_templates";
ALTER TABLE "new_pay_period_extra_templates" RENAME TO "pay_period_extra_templates";
CREATE INDEX "pay_period_extra_templates_userId_idx" ON "pay_period_extra_templates"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
