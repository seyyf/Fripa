-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Order" ("createdAt", "customerAddress", "customerEmail", "customerName", "customerPhone", "discount", "id", "paid", "promoCode", "ref", "status", "total", "userId") SELECT "createdAt", "customerAddress", "customerEmail", "customerName", "customerPhone", "discount", "id", "paid", "promoCode", "ref", "status", "total", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_ref_key" ON "Order"("ref");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
