-- CreateTable
CREATE TABLE "shift_penalty_segments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "timeFrameId" TEXT,
    "name" TEXT NOT NULL,
    "multiplier" DECIMAL NOT NULL,
    "hours" DECIMAL NOT NULL,
    "pay" DECIMAL NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shift_penalty_segments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shift_penalty_segments_timeFrameId_fkey" FOREIGN KEY ("timeFrameId") REFERENCES "penalty_time_frames" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shift_overtime_segments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "timeFrameId" TEXT,
    "name" TEXT NOT NULL,
    "multiplier" DECIMAL NOT NULL,
    "hours" DECIMAL NOT NULL,
    "pay" DECIMAL NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shift_overtime_segments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shift_overtime_segments_timeFrameId_fkey" FOREIGN KEY ("timeFrameId") REFERENCES "overtime_time_frames" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "shift_penalty_segments_shiftId_idx" ON "shift_penalty_segments"("shiftId");

-- CreateIndex
CREATE INDEX "shift_penalty_segments_startTime_idx" ON "shift_penalty_segments"("startTime");

-- CreateIndex
CREATE INDEX "shift_overtime_segments_shiftId_idx" ON "shift_overtime_segments"("shiftId");

-- CreateIndex
CREATE INDEX "shift_overtime_segments_startTime_idx" ON "shift_overtime_segments"("startTime");
