-- CreateTable
CREATE TABLE "Bale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "supplier" TEXT,
    "purchasedAt" DATETIME,
    "note" TEXT,
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
    "baleId" TEXT,
    "publishAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_baleId_fkey" FOREIGN KEY ("baleId") REFERENCES "Bale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("brand", "category", "color", "condition", "cost", "createdAt", "description", "id", "imageUrl", "images", "price", "publishAt", "salePrice", "seller", "size", "status", "title", "updatedAt") SELECT "brand", "category", "color", "condition", "cost", "createdAt", "description", "id", "imageUrl", "images", "price", "publishAt", "salePrice", "seller", "size", "status", "title", "updatedAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

