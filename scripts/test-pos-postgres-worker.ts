import { prisma } from "../src/lib/prisma";
import { createPosProduct, createPosSale } from "../src/lib/pos";
import { randomUUID } from "node:crypto";

async function run() {
  const schema = new URL(process.env.DATABASE_URL ?? "").searchParams.get("schema");
  if (!schema || !/^whs_pos_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Pengujian POS hanya boleh memakai schema sementara.");
  if (process.argv[2] === "setup") {
    const limited = await createPosProduct({ sku: "LIMITED", name: "Barang stok terbatas", price: 35_000, stock: 3 }, "test@example.test");
    const repeat = await createPosProduct({ sku: "REPEAT", name: "Pengiriman ulang", price: 35_000, stock: 1 }, "test@example.test");
    return { limited: limited.id, repeat: repeat.id };
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
