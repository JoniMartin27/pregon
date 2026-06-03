-- CreateTable
CREATE TABLE "ProjectSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "npmWeekly" INTEGER,
    "pypiWeekly" INTEGER,
    "githubStars" INTEGER,
    "githubForks" INTEGER,
    CONSTRAINT "ProjectSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectSnapshot_projectId_capturedAt_idx" ON "ProjectSnapshot"("projectId", "capturedAt");
