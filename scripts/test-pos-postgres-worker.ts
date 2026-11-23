import { prisma } from "../src/lib/prisma";
import { createPosProduct, createPosSale } from "../src/lib/pos";
import { randomUUID } from "node:crypto";
import { previewPosImport, applyPosImport } from "../src/lib/pos-import";

async function run() {
  const schema = new URL(process.env.DATABASE_URL ?? "").searchParams.get("schema");
  if (!schema || !/^whs_pos_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Pengujian POS hanya boleh memakai schema sementara.");
  if (process.argv[2] === "setup") {
    const limited = await createPosProduct({ sku: "LIMITED", name: "Barang stok terbatas", price: 35_000, stock: 3 }, "test@example.test");
    const repeat = await createPosProduct({ sku: "REPEAT", name: "Pengiriman ulang", price: 35_000, stock: 1 }, "test@example.test");
    return { limited: limited.id, repeat: repeat.id };
  }
  if (process.argv[2] === "import-setup") {
    const product = await createPosProduct({ sku: "IMPORT", name: "Uji impor", price: 35_000, stock: 10 }, "test@example.test");
    const repeated = await previewPosImport(Buffer.from("SKU,Stok\nIMPORT,5"), "masuk.csv", "ADD", "test@example.test");
    return { productId: product.id, importId: repeated.id };
  }
  if (process.argv[2] === "import-preview") {
    return previewPosImport(Buffer.from("SKU,Stok\nIMPORT,100"), "akhir.csv", "SET", "test@example.test");
  }
  if (process.argv[2] === "import-apply") {
    try {
      const saved = await applyPosImport(JSON.parse(process.argv[3]).importId, "test@example.test");
      return { status: 200, id: saved.id };
    } catch (error) { return { status: (error as { status?: number }).status ?? 500 }; }
  }
  if (process.argv[2] === "import-large") {
    const file = Buffer.from("SKU,Nama,Harga,Stok\n" + Array.from({ length: 500 }, (_, i) => `BULK-${i},Produk impor ${i},10000,1`).join("\n"));
    const first = await previewPosImport(file, "500-produk.csv", "SET", "test@example.test");
    const start = Date.now();
    await applyPosImport(first.id, "test@example.test");
    const createMs = Date.now() - start;
    const second = await previewPosImport(file, "500-produk.csv", "ADD", "test@example.test");
    const updateStart = Date.now();
    await applyPosImport(second.id, "test@example.test");
    return { createMs, updateMs: Date.now() - updateStart, count: await prisma.posProduct.count({ where: { sku: { startsWith: "BULK-" }, stock: 2 } }) };
  }
  const input: { productId: string; requestKey?: string; count: number } = JSON.parse(process.argv[3]);
  return Promise.all(Array.from({ length: input.count }, async () => {
    try {
      const saved = await createPosSale({ requestKey: input.requestKey ?? randomUUID(), items: [{ productId: input.productId, quantity: 1, unitPrice: 35_000 }], discount: 0, paid: 35_000, paymentMethod: "QRIS" }, "test@example.test");
      return { status: 201, id: saved.id, invoice: saved.invoiceNumber };
    } catch (error) { return { status: (error as { status?: number }).status ?? 500, code: (error as { code?: string }).code }; }
  }));
}
run().then(data => process.send?.({ ok: true, data }))
  .catch(error => { process.send?.({ ok: false, error: error.name }); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); process.disconnect?.(); });
