-- CreateTable
CREATE TABLE "SwipeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SwipeEvent_itemId_idx" ON "SwipeEvent"("itemId");

-- CreateIndex
CREATE INDEX "SwipeEvent_action_idx" ON "SwipeEvent"("action");
