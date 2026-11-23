CREATE TABLE "PosStockImport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "filename" TEXT NOT NULL,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('SET', 'ADD')),
  "cashierEmail" TEXT NOT NULL,
  "rowsJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREVIEW' CHECK ("status" IN ('PREVIEW', 'APPLIED')),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "appliedAt" TIMESTAMP(3)
);
