-- CreateTable
CREATE TABLE "VisitorSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hour" DATETIME NOT NULL,
    "peakOnline" INTEGER NOT NULL,
    "avgOnline" INTEGER NOT NULL,
    "governorates" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitorSnapshot_hour_key" ON "VisitorSnapshot"("hour");

