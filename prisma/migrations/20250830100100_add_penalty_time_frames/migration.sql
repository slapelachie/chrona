-- CreateTable
CREATE TABLE "penalty_time_frames" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payGuideId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "penaltyRate" DECIMAL NOT NULL,
    "dayOfWeek" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "penalty_time_frames_payGuideId_fkey" FOREIGN KEY ("payGuideId") REFERENCES "pay_guides" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
