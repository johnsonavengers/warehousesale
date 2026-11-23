import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { AppError } from "./errors";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, type ImportIssue } from "./pos-import-types";

type Field = "sku" | "name" | "price" | "stock";
export type ParsedRow = { row: number; sku: string; name?: string; price?: number; stock: number };
const aliases: Record<string, Field> = {
  sku: "sku", kode: "sku", kodebarang: "sku", code: "sku",
  nama: "name", namaproduk: "name", namabarang: "name", name: "name", productname: "name",
  harga: "price", hargajual: "price", price: "price",
  stok: "stock", stock: "stock", qty: "stock", quantity: "stock", jumlah: "stock",
};

// Check declared ZIP expansion before ExcelJS decompresses the workbook.
function checkXlsx(buffer: Buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  }
  if (end < 0) throw new Error("ZIP tidak valid");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16), size = 0;
  if (count > 1000 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error("ZIP terlalu besar");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("ZIP tidak valid");
    const flags = buffer.readUInt16LE(offset + 8);
    size += buffer.readUInt32LE(offset + 24);
    if ((flags & 1) || size > 20 * 1024 * 1024) throw new Error("Isi Excel terlalu besar");
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  if (offset !== end) throw new Error("ZIP tidak valid");
}

function value(cell: ExcelJS.Cell, sku = false): string | number {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") {
    if (sku && (!Number.isSafeInteger(v) || Math.abs(v) >= 1e15)) throw new Error("SKU angka terlalu panjang; simpan sebagai teks.");
    if (sku && /^0{2,60}$/.test(cell.numFmt)) return String(v).padStart(cell.numFmt.length, "0");
    return v;
  }
  if (typeof v === "object" && "richText" in v) return v.richText.map(t => t.text).join("").trim();
  throw new Error("Gunakan nilai biasa, bukan rumus, tanggal, atau sel error.");
}

function integer(v: string | number, label: string, max: number): number {
  // Require plain integers: grouping/decimal separators are locale-ambiguous.
  if (v === "" || (typeof v === "string" && !/^\d+$/.test(v))) throw new Error(`${label} harus angka bulat tanpa titik/koma (contoh: 35000).`);
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new Error(`${label} harus antara 0 dan ${max.toLocaleString("id-ID")}.`);
  return n;
}

export async function parsePosImport(buffer: Buffer, filename: string): Promise<{ rows: ParsedRow[]; issues: ImportIssue[] }> {
  if (!buffer.length || buffer.length > IMPORT_MAX_BYTES) throw new AppError(400, "File harus berisi data dan berukuran maksimal 2 MB.");
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension !== "xlsx" && extension !== "csv") throw new AppError(400, "Gunakan Excel .xlsx atau CSV .csv. Simpan ulang file .xls menjadi .xlsx.");
  const workbook = new ExcelJS.Workbook();
  let sheet: ExcelJS.Worksheet;
  try {
    if (extension === "xlsx") {
      checkXlsx(buffer);
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      sheet = workbook.getWorksheet("Produk") ?? workbook.worksheets[0];
    } else {
      const encoding = buffer[0] === 0xff && buffer[1] === 0xfe ? "utf-16le" : "utf-8";
      const content = new TextDecoder(encoding, { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
      const header = content.split(/\r?\n/, 1)[0];
      const delimiter = [",", ";", "\t"].sort((a, b) => header.split(b).length - header.split(a).length)[0];
      sheet = await workbook.csv.read(Readable.from([content]), { map: (v: string) => v, parserOptions: { delimiter, maxRows: IMPORT_MAX_ROWS + 2 } });
    }
  } catch { throw new AppError(400, "File tidak dapat dibaca atau isi Excel terlalu besar. Gunakan template dan simpan ulang sebagai .xlsx / CSV UTF-8."); }
  if (!sheet || sheet.rowCount < 2) throw new AppError(400, "File belum berisi produk. Isi data di bawah judul kolom.");
  if (sheet.rowCount > IMPORT_MAX_ROWS + 1 || sheet.columnCount > 30) throw new AppError(400, `Maksimal ${IMPORT_MAX_ROWS} baris produk dan 30 kolom per file.`);
  const columns = new Map<Field, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    let header: string;
    try { header = String(value(cell)).toLowerCase().replace(/[\s_-]/g, ""); }
    catch { throw new AppError(400, "Judul kolom harus berupa teks biasa."); }
    const field = aliases[header];
    if (field && columns.has(field)) throw new AppError(400, `Kolom ${header} terduplikasi.`);
    if (field) columns.set(field, col);
  });
  if (!columns.has("sku") || !columns.has("stock")) throw new AppError(400, "Baris pertama wajib berisi kolom SKU dan Stok. Kolom Nama dan Harga diperlukan untuk produk baru.");
  const rows: ParsedRow[] = [], issues: ImportIssue[] = [];
  const seen = new Map<string, number>();
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (!Array.from(columns.values()).some(col => row.getCell(col).value !== null && row.getCell(col).text.trim() !== "")) continue;
    try {
      const read = (field: Field) => columns.has(field) ? value(row.getCell(columns.get(field)!), field === "sku") : "";
      const sku = String(read("sku")).toUpperCase();
      if (!/^[A-Z0-9._/-]{1,60}$/.test(sku)) throw new Error("SKU wajib diisi (maks. 60 karakter: huruf, angka, titik, -, _, /).");
      if (seen.has(sku)) throw new Error(`SKU ${sku} sudah ada di baris ${seen.get(sku)}. Gabungkan menjadi satu baris.`);
      seen.set(sku, rowNumber);
      const name = String(read("name"));
      if (name && (name.length < 2 || name.length > 120)) throw new Error("Nama harus 2–120 karakter.");
      const price = read("price");
      rows.push({ row: rowNumber, sku, name: name || undefined, price: price === "" ? undefined : integer(price, "Harga", 2_000_000_000), stock: integer(read("stock"), "Stok", 1_000_000) });
    } catch (error) { issues.push({ row: rowNumber, message: error instanceof Error ? error.message : "Data tidak valid." }); }
  }
  if (!rows.length && !issues.length) throw new AppError(400, "File belum berisi produk.");
  return { rows, issues };
}

export async function posImportTemplate() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Produk");
  sheet.columns = [{ header: "SKU", key: "sku", width: 24 }, { header: "Nama", key: "name", width: 38 }, { header: "Harga", key: "price", width: 20 }, { header: "Stok", key: "stock", width: 16 }];
  sheet.getColumn(1).numFmt = "@";
  sheet.getRow(1).font = { bold: true };
  const guide = book.addWorksheet("Petunjuk");
  guide.getColumn(1).width = 110;
  ["Isi lembar Produk, satu baris per SKU. Maksimal 500 produk per file.", "SKU dan Stok wajib. Nama dan Harga wajib untuk SKU baru; kosongkan untuk mempertahankan produk lama.", "Harga dan Stok: angka bulat tanpa titik/koma atau simbol Rp. Stok 0 diperbolehkan.", "Simpan SKU sebagai teks agar angka 0 di depan tidak hilang. Jangan gunakan rumus.", "Pilih Stok akhir untuk mengganti stok, atau Tambah stok masuk untuk menambahkan jumlah dalam file.", "Periksa pratinjau sebelum menyimpan. Produk yang tidak ada dalam file tidak berubah."].forEach(text => guide.addRow([text]));
  return book.xlsx.writeBuffer();
}
