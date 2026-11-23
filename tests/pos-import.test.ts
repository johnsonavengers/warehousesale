import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { parsePosImport, posImportTemplate } from "@/lib/pos-import-file";
import { previewPosImport, applyPosImport, getPosImport } from "@/lib/pos-import";
import { createPosProduct, createPosSale } from "@/lib/pos";
import { ADMIN_COOKIE, expectedAdminToken } from "@/lib/auth";
import { POST as upload } from "@/app/api/admin/pos/imports/route";
import { POST as apply, GET as get } from "@/app/api/admin/pos/imports/[id]/route";
import { GET as template } from "@/app/api/admin/pos/imports/template/route";
import { resetDb } from "./helpers";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const email = "admin@example.test";
beforeEach(resetDb);
const csv = (s: string) => Buffer.from(s);
const preview = (s: string, mode = "SET") => previewPosImport(csv(s), "stok.csv", mode, email);
const product = (sku = "OLD", stock = 10) => createPosProduct({ sku, name: "Produk lama", price: 35000, stock }, email);
async function xlsx(rows: unknown[][], configure?: (sheet: ExcelJS.Worksheet) => void) {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Produk");
  sheet.addRows(rows); configure?.(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("pembacaan file impor", () => {
  it("membaca CSV BOM, tanda kutip, baris baru dan SKU dengan nol depan", async () => {
    const data = await parsePosImport(csv('\uFEFFSKU,Nama,Harga,Stok\r\n00012,"Sepatu, putih\nbaru",35000,0'), "produk.csv");
    expect(data.issues).toEqual([]);
    expect(data.rows[0]).toMatchObject({ sku: "00012", name: "Sepatu, putih\nbaru", price: 35000, stock: 0 });
  });
  it("membaca delimiter titik koma dan UTF-16 dari Excel", async () => {
    const data = await parsePosImport(Buffer.from('\uFEFFkode_barang;nama_produk;harga_jual;qty\n0001;Tas;40000;5', "utf16le"), "stok.csv");
    expect(data.rows[0]).toMatchObject({ sku: "0001", name: "Tas", stock: 5 });
  });
  it("membaca Excel dan mempertahankan SKU teks atau format nol depan", async () => {
    const data = await parsePosImport(await xlsx([["SKU", "Nama", "Harga", "Stok"], [12, "Tas", 12000, 4], ["00013", "Sepatu", 25000, 0]], s => { s.getCell("A2").numFmt = "00000"; }), "produk.xlsx");
    expect(data.issues).toEqual([]); expect(data.rows.map(r => r.sku)).toEqual(["00012", "00013"]);
  });
  it("menandai rumus, angka pecahan, stok kosong dan SKU ganda per baris", async () => {
    const file = await xlsx([["SKU", "Nama", "Harga", "Stok"], ["ABC", "Tas", 35000, 2], ["abc", "Tas", 35000, 3], ["X", "Tas", { formula: "1+1", result: 2 }, 2], ["Y", "Tas", 35000, 1.5], ["Z", "Tas", 35000, null]]);
    const result = await parsePosImport(file, "test.xlsx");
    expect(result.issues.map(i => i.row)).toEqual([3, 4, 5, 6]);
  });
  it.each(["-1", "1.5", "1,000", "1.000", "=1+1", "1000001"])("menolak nilai stok ambigu atau tidak valid %s", async stock => {
    const result = await parsePosImport(csv(`SKU;Stok\nABC;${stock}`), "test.csv");
    expect(result.issues).toHaveLength(1);
  });
  it("menolak file rusak, format lama, kolom wajib hilang, dan terlalu besar", async () => {
    for (const [data, name] of [[csv("not a zip"), "x.xlsx"], [csv("x"), "x.xls"], [csv("Nama,Harga\nTas,3"), "x.csv"], [Buffer.alloc(2 * 1024 * 1024 + 1), "x.csv"]] as const) await expect(parsePosImport(data, name)).rejects.toMatchObject({ status: 400 });
    await expect(parsePosImport(csv("SKU,Stok\n" + Array.from({ length: 501 }, (_, i) => `S${i},1`).join("\n")), "x.csv")).rejects.toMatchObject({ status: 400 });
    await expect(parsePosImport(csv("SKU,Kode,Stok\nA,B,3"), "x.csv")).rejects.toMatchObject({ status: 400 });
  });
  it("template tidak berisi produk contoh yang dapat terimpor tanpa sengaja", async () => {
    const book = new ExcelJS.Workbook(); await book.xlsx.load(await posImportTemplate());
    expect(book.getWorksheet("Produk")!.rowCount).toBe(1);
    expect(book.getWorksheet("Produk")!.getColumn(1).numFmt).toBe("@");
  });
});

describe("penyimpanan impor stok", () => {
  it("pratinjau tidak mengubah stok; simpan memperbarui SKU lama dan membuat SKU baru", async () => {
    const old = await product(); const untouched = await product("KEEP", 6);
    await prisma.posProduct.update({ where: { id: old.id }, data: { active: false } });
    const batch = await preview("SKU,Nama,Harga,Stok\nOLD,,,0\nNEW,Produk baru,12000,7");
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { id: old.id } })).stock).toBe(10);
    expect(await prisma.posProduct.count()).toBe(2);
    const result = await applyPosImport(batch.id, email);
    expect(result.status).toBe("APPLIED");
    expect(await prisma.posProduct.findUnique({ where: { id: old.id } })).toMatchObject({ stock: 0, price: 35000, name: "Produk lama", active: false });
    expect(await prisma.posProduct.findUnique({ where: { sku: "NEW" } })).toMatchObject({ stock: 7, price: 12000, active: true });
    expect(await prisma.posProduct.findUnique({ where: { id: untouched.id } })).toMatchObject({ stock: 6 });
    expect((await prisma.posStockMovement.findMany({ where: { kind: "IMPORT" }, orderBy: { quantity: "asc" } })).map(r => [r.quantity, r.balance, r.cashierEmail])).toEqual([[-10, 0, email], [7, 7, email]]);
    expect(await prisma.ticket.count()).toBe(0);
  });
  it("tambahan stok dan pembaruan harga hanya diterapkan sekali ketika dicoba ulang", async () => {
    await product(); const batch = await preview("SKU,Nama,Harga,Stok\nOLD,Nama baru,40000,5", "ADD");
    await applyPosImport(batch.id, email); await applyPosImport(batch.id, email);
    expect(await prisma.posProduct.findUnique({ where: { sku: "OLD" } })).toMatchObject({ stock: 15, price: 40000, name: "Nama baru" });
    expect(await prisma.posStockMovement.count({ where: { kind: "IMPORT" } })).toBe(1);
  });
  it("satu baris salah menolak seluruh file sebelum penyimpanan", async () => {
    await product();
    await expect(preview("SKU,Nama,Harga,Stok\nOLD,,,2\nNEW,,,3")).rejects.toMatchObject({ status: 400, extra: { issues: [{ row: 3 }] } });
    expect(await prisma.posStockImport.count()).toBe(0);
    expect(await prisma.posProduct.count()).toBe(1);
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { sku: "OLD" } })).stock).toBe(10);
  });
  it("transaksi kasir setelah pratinjau membatalkan seluruh impor tanpa menimpa stok", async () => {
    const old = await product(); const other = await product("OTHER", 7);
    const batch = await preview("SKU,Stok\nOLD,100\nOTHER,200");
    await createPosSale({ requestKey: randomUUID(), items: [{ productId: old.id, quantity: 1, unitPrice: 35000 }], paymentMethod: "CASH", paid: 35000 }, email);
    await expect(applyPosImport(batch.id, email)).rejects.toMatchObject({ status: 409 });
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { id: old.id } })).stock).toBe(9);
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { id: other.id } })).stock).toBe(7);
    expect(await prisma.posStockMovement.count({ where: { kind: "IMPORT" } })).toBe(0);
  });
  it("SKU baru yang dibuat admin lain menyebabkan rollback seluruh impor", async () => {
    await product(); const batch = await preview("SKU,Nama,Harga,Stok\nOLD,,,80\nNEW,Baru,1000,10");
    await product("NEW", 3);
    await expect(applyPosImport(batch.id, email)).rejects.toMatchObject({ status: 409 });
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { sku: "OLD" } })).stock).toBe(10);
  });
  it("membatasi akun pemilik pratinjau dan masa berlaku", async () => {
    await product(); const batch = await preview("SKU,Stok\nOLD,10");
    await expect(getPosImport(batch.id, "other@test.com")).rejects.toMatchObject({ status: 404 });
    await expect(applyPosImport(batch.id, "other@test.com")).rejects.toMatchObject({ status: 404 });
    await prisma.posStockImport.update({ where: { id: batch.id }, data: { expiresAt: new Date(0) } });
    await expect(applyPosImport(batch.id, email)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.posStockMovement.count({ where: { kind: "IMPORT" } })).toBe(0);
  });
  it("menolak penambahan melebihi batas dan mode tidak valid", async () => {
    await product("OLD", 999999);
    await expect(preview("SKU,Stok\nOLD,2", "ADD")).rejects.toMatchObject({ status: 400 });
    await expect(preview("SKU,Stok\nOLD,2", "INVALID")).rejects.toMatchObject({ status: 400 });
  });
});

describe("API impor", () => {
  const req = async (method = "GET", body?: FormData, authenticated = true) => new Request("http://localhost/api/admin/pos/imports", { method, body, headers: authenticated ? { cookie: `${ADMIN_COOKIE}=${await expectedAdminToken()}` } : {} });
  it("semua endpoint hanya untuk admin", async () => {
    expect((await upload(await req("POST", undefined, false))).status).toBe(401);
    expect((await template(await req("GET", undefined, false))).status).toBe(401);
    expect((await apply(await req("POST", undefined, false), { params: { id: "any" } })).status).toBe(401);
    expect((await get(await req("GET", undefined, false), { params: { id: "any" } })).status).toBe(401);
  });
  it("membaca multipart tanpa menghabiskan body saat autentikasi dan menyimpan hasil", async () => {
    const form = new FormData(); form.set("file", new Blob(["SKU,Nama,Harga,Stok\nA,Tas,20000,4"]), "stok.csv"); form.set("mode", "SET");
    const response = await upload(await req("POST", form)); expect(response.status).toBe(201);
    const result = await response.json();
    expect((await apply(await req("POST"), { params: { id: result.id } })).status).toBe(200);
    expect((await prisma.posProduct.findUniqueOrThrow({ where: { sku: "A" } })).stock).toBe(4);
    expect((await template(await req())).headers.get("content-type")).toContain("spreadsheetml");
  });
});
