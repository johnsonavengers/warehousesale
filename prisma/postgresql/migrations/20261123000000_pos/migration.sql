-- POS terpisah; tidak mengubah tabel atau data tiket.
CREATE TABLE "PosProduct" (
 "id" TEXT NOT NULL PRIMARY KEY, "sku" TEXT NOT NULL, "name" TEXT NOT NULL,
 "price" INTEGER NOT NULL CHECK ("price" >= 0), "stock" INTEGER NOT NULL DEFAULT 0 CHECK ("stock" >= 0),
 "active" BOOLEAN NOT NULL DEFAULT true, "revision" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PosProduct_sku_key" ON "PosProduct"("sku");
CREATE TABLE "PosSale" (
 "id" TEXT NOT NULL PRIMARY KEY, "invoiceNumber" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
 "date" TEXT NOT NULL, "customerName" TEXT, "paymentMethod" TEXT NOT NULL,
 "subtotal" INTEGER NOT NULL CHECK ("subtotal" >= 0), "discount" INTEGER NOT NULL CHECK ("discount" >= 0),
 "total" INTEGER NOT NULL CHECK ("total" >= 0), "paid" INTEGER NOT NULL, "change" INTEGER NOT NULL CHECK ("change" >= 0),
 "cashierEmail" TEXT NOT NULL, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PosSale_invoiceNumber_key" ON "PosSale"("invoiceNumber");
CREATE UNIQUE INDEX "PosSale_requestKey_key" ON "PosSale"("requestKey");
CREATE INDEX "PosSale_date_createdAt_idx" ON "PosSale"("date", "createdAt");
CREATE TABLE "PosSaleItem" (
 "id" TEXT NOT NULL PRIMARY KEY, "saleId" TEXT NOT NULL, "productId" TEXT NOT NULL,
 "sku" TEXT NOT NULL, "name" TEXT NOT NULL, "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
 "unitPrice" INTEGER NOT NULL, "lineTotal" INTEGER NOT NULL,
 CONSTRAINT "PosSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PosSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PosSaleItem_saleId_idx" ON "PosSaleItem"("saleId");
CREATE TABLE "PosStockMovement" (
 "id" TEXT NOT NULL PRIMARY KEY, "productId" TEXT NOT NULL, "saleId" TEXT, "requestKey" TEXT,
 "kind" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "balance" INTEGER NOT NULL CHECK ("balance" >= 0),
 "reason" TEXT NOT NULL, "cashierEmail" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PosStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PosStockMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PosStockMovement_requestKey_key" ON "PosStockMovement"("requestKey");
CREATE INDEX "PosStockMovement_productId_createdAt_idx" ON "PosStockMovement"("productId", "createdAt");
