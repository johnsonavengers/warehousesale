export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export type ImportMode = "SET" | "ADD";
export type ImportRow = {
  row: number; sku: string; name: string; price: number; stock: number;
  before: { id: string; revision: number; name: string; price: number; stock: number } | null;
  amount: number; action: "NEW" | "UPDATE" | "UNCHANGED";
};
export type ImportPreview = {
  id: string; filename: string; mode: ImportMode; status: string;
  expiresAt: string; rows: ImportRow[];
};
export type ImportIssue = { row: number; message: string };
