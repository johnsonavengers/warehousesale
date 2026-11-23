import { prisma } from "./prisma";
import { AppError, isUniqueViolation } from "./errors";
import { parsePosImport } from "./pos-import-file";
import type { ImportMode, ImportPreview, ImportRow } from "./pos-import-types";

function view(batch: { id: string; filename: string; mode: string; status: string; expiresAt: Date; rowsJson: string }): ImportPreview {
  return { id: batch.id, filename: batch.filename, mode: batch.mode as ImportMode, status: batch.status, expiresAt: batch.expiresAt.toISOString(), rows: JSON.parse(batch.rowsJson) };
}
export async function previewPosImport(buffer: Buffer, filename: string, mode: string, cashierEmail: string) {
  if (mode !== "SET" && mode !== "ADD") throw new AppError(400, "Pilih cara pembaruan stok.");
  const parsed = await parsePosImport(buffer, filename);
  const products = await prisma.posProduct.findMany({ where: { sku: { in: parsed.rows.map(row => row.sku) } } });
  const bySku = new Map(products.map(product => [product.sku, product]));
  const rows: ImportRow[] = [];
  for (const row of parsed.rows) {
    const old = bySku.get(row.sku);
    if (!old && (!row.name || row.price === undefined)) { parsed.issues.push({ row: row.row, message: `SKU baru ${row.sku}: Nama dan Harga wajib diisi.` }); continue; }
    const stock = mode === "ADD" ? (old?.stock ?? 0) + row.stock : row.stock;
    if (stock > 1_000_000) { parsed.issues.push({ row: row.row, message: `Stok akhir ${row.sku} melebihi 1.000.000.` }); continue; }
    const name = row.name ?? old!.name, price = row.price ?? old!.price;
    rows.push({ row: row.row, sku: row.sku, name, price, stock, amount: row.stock,
      before: old ? { id: old.id, revision: old.revision, name: old.name, price: old.price, stock: old.stock } : null,
      action: !old ? "NEW" : old.name === name && old.price === price && old.stock === stock ? "UNCHANGED" : "UPDATE" });
  }
  if (parsed.issues.length) throw new AppError(400, "Perbaiki baris berikut lalu unggah ulang. Belum ada produk atau stok yang berubah.", { issues: parsed.issues.sort((a, b) => a.row - b.row) });
  return view(await prisma.posStockImport.create({ data: { filename: filename.replace(/[\x00-\x1f]/g, "").slice(0, 160), mode, cashierEmail, rowsJson: JSON.stringify(rows), expiresAt: new Date(Date.now() + 30 * 60_000) } }));
}

export async function getPosImport(id: string, cashierEmail: string) {
  const batch = await prisma.posStockImport.findUnique({ where: { id } });
  if (!batch || batch.cashierEmail !== cashierEmail) throw new AppError(404, "Pratinjau impor tidak ditemukan untuk akun ini.");
  return view(batch);
}

export async function applyPosImport(id: string, cashierEmail: string): Promise<ImportPreview> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        // Lock the batch before checking its status; retries share the same durable id.
        const lock = await tx.posStockImport.updateMany({ where: { id, cashierEmail }, data: { revision: { increment: 1 } } });
        if (!lock.count) throw new AppError(404, "Pratinjau impor tidak ditemukan untuk akun ini.");
        const batch = await tx.posStockImport.findUniqueOrThrow({ where: { id } });
        if (batch.status === "APPLIED") return view(batch);
        if (batch.expiresAt.getTime() < Date.now()) throw new AppError(409, "Pratinjau kedaluwarsa. Unggah ulang file untuk memeriksa stok terbaru.");
        const rows = (JSON.parse(batch.rowsJson) as ImportRow[]).sort((a, b) => (a.before?.id ?? `~${a.sku}`).localeCompare(b.before?.id ?? `~${b.sku}`));
        const movements = [];
        for (const row of rows) {
          let productId: string;
          if (row.before) {
            const changed = await tx.posProduct.updateMany({ where: { id: row.before.id, revision: row.before.revision }, data: { name: row.name, price: row.price, stock: row.stock, revision: { increment: 1 } } });
            if (!changed.count) throw new AppError(409, `Produk ${row.sku} berubah sejak pratinjau. Belum ada perubahan disimpan; unggah ulang file.`);
            productId = row.before.id;
          } else {
            productId = (await tx.posProduct.create({ data: { sku: row.sku, name: row.name, price: row.price, stock: row.stock } })).id;
          }
          const quantity = row.stock - (row.before?.stock ?? 0);
          if (quantity) movements.push({ productId, kind: "IMPORT", quantity, balance: row.stock, reason: `Impor ${batch.mode === "SET" ? "stok akhir" : "stok masuk"}: ${batch.filename} (${batch.id})`, cashierEmail });
        }
        if (movements.length) await tx.posStockMovement.createMany({ data: movements });
        return view(await tx.posStockImport.update({ where: { id }, data: { status: "APPLIED", appliedAt: new Date() } }));
      }, { maxWait: 15_000, timeout: 45_000 });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, "Salah satu SKU sudah dibuat sejak pratinjau. Belum ada perubahan disimpan; unggah ulang file.");
      if (attempt >= 3 || !["P2034", "P2028"].includes((error as { code?: string }).code ?? "")) throw error;
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}
