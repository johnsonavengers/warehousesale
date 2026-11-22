import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPosProduct, updatePosProduct, adjustPosStock, createPosSale, getPosSale, getPosSales } from "@/lib/pos";
import { createAutomaticTicket } from "@/lib/booking";
import { resetDb } from "./helpers";
import { ADMIN_COOKIE, expectedAdminToken } from "@/lib/auth";
import { POST as productPost, GET as productGet } from "@/app/api/admin/pos/products/route";
import { PATCH as productPatch } from "@/app/api/admin/pos/products/[id]/route";
import { POST as stockPost } from "@/app/api/admin/pos/products/[id]/stock/route";
import { POST as salePost } from "@/app/api/admin/pos/sales/route";

const cashier = "admin@example.test";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
beforeEach(resetDb);
const product = (sku = "TEST-36", stock = 10, price = 35_000) => createPosProduct({ sku, name: `Sepatu ${sku}`, stock, price }, cashier);
function sale(id: string, overrides: Record<string, unknown> = {}) {
  return { requestKey: randomUUID(), items: [{ productId: id, quantity: 2, unitPrice: 35_000 }], paymentMethod: "CASH", discount: 5_000, paid: 100_000, ...overrides };
}
async function request(path: string, method: string, data?: unknown, authorized = true) {
  return new Request(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json", ...(authorized ? { cookie: `${ADMIN_COOKIE}=${await expectedAdminToken()}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
}
describe("produk dan stok POS", () => {
  it("menyimpan SKU unik dan riwayat stok awal", async () => {
    const row = await product("test-36", 12);
    expect(row.sku).toBe("TEST-36");
    expect(await prisma.posStockMovement.findFirst({ where: { productId: row.id } })).toMatchObject({ quantity: 12, balance: 12, kind: "OPENING", cashierEmail: cashier });
    await expect(product("TEST-36")).rejects.toMatchObject({ status: 409 });
  });
  it("perubahan stok idempotent dan tidak boleh membuat stok negatif", async () => {
    const row = await product("A", 2);
    const input = { requestKey: randomUUID(), quantity: -2, reason: "Barang rusak" };
    const first = await adjustPosStock(row.id, input, cashier);
    expect((await adjustPosStock(row.id, input, cashier)).id).toBe(first.id);
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { id: row.id } })).stock).toBe(0);
    await expect(adjustPosStock(row.id, { ...input, requestKey: randomUUID(), quantity: -1 }, cashier)).rejects.toMatchObject({ status: 409 });
    await expect(adjustPosStock(row.id, { ...input, quantity: 1 }, cashier)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.posStockMovement.count()).toBe(2);
  });
  it("menolak penyimpanan edit dari data lama", async () => {
    const row = await product();
    await adjustPosStock(row.id, { requestKey: randomUUID(), quantity: 1, reason: "Barang masuk" }, cashier);
    await expect(updatePosProduct(row.id, { sku: row.sku, name: row.name, price: row.price, active: true, revision: row.revision })).rejects.toMatchObject({ status: 409 });
  });
});
describe("penjualan POS", () => {
  it("menyimpan total, diskon, kembalian, snapshot barang dan kasir tanpa mengubah tiket", async () => {
    const ticket = await createAutomaticTicket({ date: "2026-11-27", name: "Pengunjung tetap", phone: "081234567890" });
    const row = await product();
    const invoice = await createPosSale(sale(row.id, { customerName: "Budi", note: "Dibawa pulang" }), cashier);
    expect(invoice).toMatchObject({ subtotal: 70_000, discount: 5_000, total: 65_000, paid: 100_000, change: 35_000, cashierEmail: cashier });
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{8}-[A-F0-9]{8}$/);
    expect(invoice.items[0]).toMatchObject({ sku: row.sku, name: row.name, unitPrice: 35_000, quantity: 2, lineTotal: 70_000 });
    const changed = await prisma.posProduct.findUniqueOrThrow({ where: { id: row.id } });
    expect(changed.stock).toBe(8);
    await updatePosProduct(row.id, { sku: row.sku, name: "Nama baru", price: 99_000, active: true, revision: changed.revision });
    expect((await getPosSale(invoice.id))!.items[0]).toMatchObject({ name: row.name, unitPrice: 35_000 });
    expect(await prisma.ticket.count()).toBe(1);
    expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toMatchObject({ queueNumber: ticket.queueNumber, status: "BOOKED" });
    expect(await prisma.posStockMovement.findFirst({ where: { saleId: invoice.id } })).toMatchObject({ quantity: -2, balance: 8, cashierEmail: cashier });
  });
  it("pengiriman ulang saat stok sudah habis mengembalikan invoice yang sama", async () => {
    const row = await product("A", 2);
    const input = sale(row.id);
    const first = await createPosSale(input, cashier);
    const second = await createPosSale(input, cashier);
    expect(second.id).toBe(first.id);
    expect(await prisma.posSale.count()).toBe(1);
    expect(await prisma.posStockMovement.count({ where: { kind: "SALE" } })).toBe(1);
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { id: row.id } })).stock).toBe(0);
    await expect(createPosSale({ ...input, discount: 0 }, cashier)).rejects.toMatchObject({ status: 409 });
  });
  it("gagal pada satu barang membatalkan seluruh transaksi dan pengurangan stok", async () => {
    const one = await product("A", 10);
    const two = await product("B", 0);
    await expect(createPosSale(sale(one.id, { items: [{ productId: one.id, quantity: 1, unitPrice: 35_000 }, { productId: two.id, quantity: 1, unitPrice: 35_000 }] }), cashier)).rejects.toMatchObject({ status: 409 });
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { id: one.id } })).stock).toBe(10);
    expect(await prisma.posSale.count()).toBe(0);
    expect(await prisma.posStockMovement.count({ where: { kind: "SALE" } })).toBe(0);
  });
  it("menolak harga lama dan produk nonaktif", async () => {
    const row = await product();
    await expect(createPosSale(sale(row.id, { items: [{ productId: row.id, quantity: 1, unitPrice: 1 }] }), cashier)).rejects.toMatchObject({ status: 409 });
    await updatePosProduct(row.id, { sku: row.sku, name: row.name, price: row.price, active: false, revision: 0 });
    await expect(createPosSale(sale(row.id), cashier)).rejects.toMatchObject({ status: 409 });
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { id: row.id } })).stock).toBe(10);
  });
  it.each([{ discount: 70_001 }, { paid: 1 }, { paymentMethod: "QRIS", paid: 100_000 }, { discount: -1 }, { paid: 1.5 }])("menolak pembayaran atau diskon tidak valid %#", async (overrides) => {
    const row = await product();
    await expect(createPosSale(sale(row.id, overrides), cashier)).rejects.toBeDefined();
    expect(await prisma.posSale.count()).toBe(0);
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { id: row.id } })).stock).toBe(10);
  });
  it("menolak produk duplikat dan total melebihi kapasitas bilangan", async () => {
    const row = await product("A", 10, 2_000_000_000);
    const item = { productId: row.id, quantity: 1, unitPrice: row.price };
    await expect(createPosSale(sale(row.id, { items: [item, item] }), cashier)).rejects.toBeDefined();
    await expect(createPosSale(sale(row.id, { items: [{ ...item, quantity: 2 }] }), cashier)).rejects.toMatchObject({ status: 400 });
    expect(await prisma.posSale.count()).toBe(0);
  });
  it("laporan mengikuti filter dan invoice dapat dibuka kembali", async () => {
    const row = await product();
    const saved = await createPosSale(sale(row.id, { paymentMethod: "QRIS", paid: 65_000, customerName: "Contoh pelanggan" }), cashier);
    expect((await getPosSales({ q: saved.invoiceNumber })).count).toBe(1);
    expect((await getPosSales({ date: saved.date })).total).toBe(65_000);
    expect((await getPosSales({ date: "2026-12-25" })).count).toBe(0);
    expect((await getPosSale(saved.id))!.invoiceNumber).toBe(saved.invoiceNumber);
  });
});
describe("akses API POS", () => {
  it("seluruh endpoint menolak request tanpa sesi admin", async () => {
    const plain = () => request("/api/admin/pos/products", "POST", {}, false);
    expect((await productPost(await plain())).status).toBe(401);
    expect((await productGet(await request("/api/admin/pos/products", "GET", undefined, false))).status).toBe(401);
    expect((await productPatch(await plain(), { params: { id: "any" } })).status).toBe(401);
    expect((await stockPost(await plain(), { params: { id: "any" } })).status).toBe(401);
    expect((await salePost(await plain())).status).toBe(401);
  });
  it("menentukan identitas kasir dari cookie serta menolak data kasir dari client", async () => {
    const row = await product();
    const rejected = await salePost(await request("/api/admin/pos/sales", "POST", { ...sale(row.id), cashierEmail: "fake@example.test" }));
    expect(rejected.status).toBe(400);
    const response = await salePost(await request("/api/admin/pos/sales", "POST", sale(row.id)));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect((await getPosSale(data.id))!.cashierEmail).toBe(cashier);
  });
});
