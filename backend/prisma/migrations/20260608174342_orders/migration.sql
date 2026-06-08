-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ref" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerAddress" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_ref_key" ON "Order"("ref");
