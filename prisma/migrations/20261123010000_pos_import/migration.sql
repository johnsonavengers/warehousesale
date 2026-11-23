CREATE TABLE "PosStockImport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "filename" TEXT NOT NULL,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('SET', 'ADD')),
  "cashierEmail" TEXT NOT NULL,
  "rowsJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREVIEW' CHECK ("status" IN ('PREVIEW', 'APPLIED')),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  "appliedAt" DATETIME
);
