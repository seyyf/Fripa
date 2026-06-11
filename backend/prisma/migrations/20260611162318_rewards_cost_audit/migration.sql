-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "images" TEXT,
    "price" INTEGER NOT NULL,
    "salePrice" INTEGER,
    "size" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cost" INTEGER NOT NULL DEFAULT 0,
    "publishAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Item" ("brand", "category", "color", "condition", "createdAt", "description", "id", "imageUrl", "images", "price", "publishAt", "salePrice", "seller", "size", "status", "title", "updatedAt") SELECT "brand", "category", "color", "condition", "createdAt", "description", "id", "imageUrl", "images", "price", "publishAt", "salePrice", "seller", "size", "status", "title", "updatedAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ref" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerAddress" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "governorate" TEXT NOT NULL DEFAULT '',
    "total" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Nouvelle',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "promoCode" TEXT,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "loyaltyApplied" BOOLEAN NOT NULL DEFAULT false,
    "referredByCode" TEXT,
    "referralDiscount" INTEGER NOT NULL DEFAULT 0,
    "referrerRewardApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Order" ("createdAt", "customerAddress", "customerEmail", "customerName", "customerPhone", "deliveryFee", "discount", "governorate", "id", "paid", "promoCode", "ref", "status", "total", "userId") SELECT "createdAt", "customerAddress", "customerEmail", "customerName", "customerPhone", "deliveryFee", "discount", "governorate", "id", "paid", "promoCode", "ref", "status", "total", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_ref_key" ON "Order"("ref");
CREATE TABLE "new_OrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "size" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrderLine" ("brand", "id", "imageUrl", "itemId", "orderId", "price", "size", "title") SELECT "brand", "id", "imageUrl", "itemId", "orderId", "price", "size", "title" FROM "OrderLine";
DROP TABLE "OrderLine";
ALTER TABLE "new_OrderLine" RENAME TO "OrderLine";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

