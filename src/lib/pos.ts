import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { AppError, isUniqueViolation } from "./errors";
import { getNow, todayInEventTz, isValidDateString } from "./time";
import { POS_MONEY_MAX, posProductSchema, posProductUpdateSchema, posSaleSchema, posStockSchema } from "./pos-validation";
import type { PosProductView } from "@/config/pos";

const saleInclude = { items: { orderBy: { sku: "asc" as const } } };
const productSelect = { id: true, sku: true, name: true, price: true, stock: true, active: true, revision: true, updatedAt: true };
export async function listPosProducts(activeOnly = false): Promise<PosProductView[]> {
  const rows = await prisma.posProduct.findMany({ where: activeOnly ? { active: true } : {}, select: productSelect, orderBy: [{ name: "asc" }, { sku: "asc" }] });
  return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
}

async function retry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= 4 || !["P2034", "P2028"].includes(code ?? "")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }
}

export async function createPosProduct(input: unknown, cashierEmail: string) {
  const data = posProductSchema.parse(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.posProduct.create({ data });
      if (data.stock) await tx.posStockMovement.create({ data: { productId: product.id, kind: "OPENING", quantity: data.stock, balance: data.stock, reason: "Stok awal", cashierEmail } });
      return product;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, "SKU sudah digunakan produk lain.");
    throw error;
  }
}

export async function updatePosProduct(id: string, input: unknown) {
  const { revision, ...data } = posProductUpdateSchema.parse(input);
  try {
    const changed = await prisma.posProduct.updateMany({ where: { id, revision }, data: { ...data, revision: { increment: 1 } } });
    if (!changed.count) throw new AppError(409, "Produk berubah sejak dibuka. Muat ulang sebelum menyimpan.");
    return prisma.posProduct.findUniqueOrThrow({ where: { id } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, "SKU sudah digunakan produk lain.");
    throw error;
  }
}

export async function adjustPosStock(productId: string, input: unknown, cashierEmail: string) {
  const data = posStockSchema.parse(input);
  const existing = async () => {
    const row = await prisma.posStockMovement.findUnique({ where: { requestKey: data.requestKey } });
    if (row && (row.productId !== productId || row.quantity !== data.quantity || row.reason !== data.reason)) throw new AppError(409, "Permintaan perubahan stok berbeda dari yang sudah tersimpan.");
    return row;
  };
  const previous = await existing();
  if (previous) return previous;
  try {
    return await retry(() => prisma.$transaction(async (tx) => {
      // UPDATE mengambil kunci baris yang sama dengan checkout sebelum stok dibaca.
      const locked = await tx.posProduct.updateMany({ where: { id: productId }, data: { revision: { increment: 1 } } });
      if (!locked.count) throw new AppError(404, "Produk tidak ditemukan.");
      const saved = await tx.posStockMovement.findUnique({ where: { requestKey: data.requestKey } });
      if (saved) {
        if (saved.productId !== productId || saved.quantity !== data.quantity || saved.reason !== data.reason) throw new AppError(409, "Permintaan perubahan stok berbeda dari yang sudah tersimpan.");
        return saved;
      }
      const product = await tx.posProduct.findUniqueOrThrow({ where: { id: productId } });
      const balance = product.stock + data.quantity;
      if (balance < 0 || balance > 1_000_000) throw new AppError(409, "Stok akhir harus berada antara 0 dan 1.000.000.");
      await tx.posProduct.update({ where: { id: productId }, data: { stock: balance } });
      return tx.posStockMovement.create({ data: { ...data, productId, kind: "ADJUSTMENT", balance, cashierEmail } });
    }, { maxWait: 10_000, timeout: 20_000 }));
  } catch (error) {
    if (isUniqueViolation(error)) { const row = await existing(); if (row) return row; }
    throw error;
  }
}

export async function createPosSale(input: unknown, cashierEmail: string) {
  const data = posSaleSchema.parse(input);
  const items = [...data.items].sort((a, b) => a.productId.localeCompare(b.productId));
  const requestHash = createHash("sha256").update(JSON.stringify({ ...data, items })).digest("hex");
  const existing = async () => {
    const sale = await prisma.posSale.findUnique({ where: { requestKey: data.requestKey }, include: saleInclude });
    if (sale && sale.requestHash !== requestHash) throw new AppError(409, "Permintaan ini sudah digunakan untuk transaksi berbeda.");
    return sale;
  };
  const previous = await existing();
  if (previous) return previous;
  for (let collision = 0; collision < 3; collision++) {
    try {
      return await retry(() => prisma.$transaction(async (tx) => {
        const snapshots = [];
        let subtotal = 0;
        const balances = new Map<string, number>();
        // Urutan id konsisten menghindari deadlock antar-keranjang yang tumpang tindih.
        for (const item of items) {
          const locked = await tx.posProduct.updateMany({ where: { id: item.productId }, data: { revision: { increment: 1 } } });
          if (!locked.count) throw new AppError(404, "Salah satu produk tidak ditemukan.");
        }
        const saved = await tx.posSale.findUnique({ where: { requestKey: data.requestKey }, include: saleInclude });
        if (saved) {
          if (saved.requestHash !== requestHash) throw new AppError(409, "Permintaan ini sudah digunakan untuk transaksi berbeda.");
          return saved;
        }
        for (const item of items) {
          const product = await tx.posProduct.findUniqueOrThrow({ where: { id: item.productId } });
          if (!product.active) throw new AppError(409, `${product.name} sudah dinonaktifkan.`);
          if (product.price !== item.unitPrice) throw new AppError(409, `Harga ${product.name} berubah. Muat ulang daftar produk.`);
          if (product.stock < item.quantity) throw new AppError(409, `Stok ${product.name} hanya tersisa ${product.stock}.`);
          const lineTotal = product.price * item.quantity;
          subtotal += lineTotal;
          if (subtotal > POS_MONEY_MAX) throw new AppError(400, "Total transaksi melebihi batas nominal.");
          const balance = product.stock - item.quantity;
          await tx.posProduct.update({ where: { id: product.id }, data: { stock: balance } });
          balances.set(product.id, balance);
          snapshots.push({ productId: product.id, sku: product.sku, name: product.name, quantity: item.quantity, unitPrice: product.price, lineTotal });
        }
        if (data.discount > subtotal) throw new AppError(400, "Diskon tidak boleh melebihi subtotal.");
        const total = subtotal - data.discount;
        if (data.paid < total) throw new AppError(400, "Nominal pembayaran kurang dari total belanja.");
        if (data.paymentMethod !== "CASH" && data.paid !== total) throw new AppError(400, "Pembayaran nontunai harus sesuai total belanja.");
        const now = getNow();
        const date = todayInEventTz(now);
        const sale = await tx.posSale.create({ data: {
          requestKey: data.requestKey, requestHash, invoiceNumber: `INV-${date.replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`,
          date, customerName: data.customerName, paymentMethod: data.paymentMethod, subtotal, discount: data.discount, total,
          paid: data.paid, change: data.paid - total, cashierEmail, note: data.note, createdAt: now,
          items: { create: snapshots },
        }, include: saleInclude });
        for (const item of snapshots) await tx.posStockMovement.create({ data: {
          productId: item.productId, saleId: sale.id, kind: "SALE", quantity: -item.quantity, balance: balances.get(item.productId)!,
          reason: sale.invoiceNumber, cashierEmail, createdAt: now,
        } });
        return sale;
      }, { maxWait: 15_000, timeout: 30_000 }));
    } catch (error) {
      if (isUniqueViolation(error)) {
        const sale = await existing();
        if (sale) return sale;
        if (collision < 2) continue;
      }
      throw error;
    }
  }
  throw new AppError(409, "Transaksi belum tersimpan. Silakan coba kembali.");
}

export async function getPosSale(id: string) {
  return prisma.posSale.findUnique({ where: { id }, include: saleInclude });
}

export async function getPosSales(params: { date?: string; q?: string; page?: string }) {
  if (params.date && !isValidDateString(params.date)) throw new AppError(400, "Tanggal tidak valid.");
  const q = params.q?.trim().slice(0, 100);
  const where = { ...(params.date ? { date: params.date } : {}), ...(q ? { OR: [{ invoiceNumber: { contains: q.toUpperCase() } }, { customerName: { contains: q } }] } : {}) };
  const [count, sums] = await Promise.all([prisma.posSale.count({ where }), prisma.posSale.aggregate({ where, _sum: { total: true, discount: true } })]);
  const maxPage = Math.max(1, Math.ceil(count / 50));
  const requested = Number(params.page);
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(maxPage, requested)) : 1;
  const sales = await prisma.posSale.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, skip: (page - 1) * 50, include: { _count: { select: { items: true } } } });
  return { sales, count, total: sums._sum.total ?? 0, discount: sums._sum.discount ?? 0, page, maxPage };
}
