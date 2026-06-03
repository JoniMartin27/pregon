/*
  Warnings:

  - Added the required column `channel` to the `Publication` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'post',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "targetUrl" TEXT,
    "tags" TEXT,
    "images" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("body", "createdAt", "id", "images", "link", "projectId", "scheduledAt", "status", "tags", "title", "updatedAt") SELECT "body", "createdAt", "id", "images", "link", "projectId", "scheduledAt", "status", "tags", "title", "updatedAt" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE INDEX "Post_projectId_idx" ON "Post"("projectId");
CREATE TABLE "new_Publication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "accountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "error" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Publication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Publication_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Publication" ("accountId", "createdAt", "error", "externalId", "externalUrl", "id", "postId", "publishedAt", "status", "updatedAt") SELECT "accountId", "createdAt", "error", "externalId", "externalUrl", "id", "postId", "publishedAt", "status", "updatedAt" FROM "Publication";
DROP TABLE "Publication";
ALTER TABLE "new_Publication" RENAME TO "Publication";
CREATE INDEX "Publication_postId_idx" ON "Publication"("postId");
CREATE INDEX "Publication_accountId_idx" ON "Publication"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
