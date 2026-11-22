import { z } from "zod";

export const POS_MONEY_MAX = 2_000_000_000;
const money = z.number().int("Nominal harus berupa rupiah bulat").min(0).max(POS_MONEY_MAX);
const text = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
const productFields = {
  sku: z.string().trim().min(1, "SKU wajib diisi").max(60).regex(/^[a-zA-Z0-9._/-]+$/, "SKU hanya boleh berisi huruf, angka, titik, garis miring, strip, atau garis bawah").transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2, "Nama produk minimal 2 karakter").max(120),
  price: money,
};
export const posProductSchema = z.object({ ...productFields, stock: z.number().int().min(0).max(1_000_000) }).strict();
export const posProductUpdateSchema = z.object({ ...productFields, active: z.boolean(), revision: z.number().int().min(0) }).strict();
export const posStockSchema = z.object({
  requestKey: z.uuid(),
  quantity: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, "Perubahan stok tidak boleh nol"),
  reason: z.string().trim().min(3, "Isi alasan perubahan stok").max(200),
}).strict();
export const posSaleSchema = z.object({
  requestKey: z.uuid(),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(10_000), unitPrice: money }).strict()).min(1, "Keranjang masih kosong").max(100),
  discount: money.default(0),
  paymentMethod: z.enum(["CASH", "QRIS", "TRANSFER", "DEBIT"]),
  paid: money,
  customerName: text(100),
  note: text(300),
}).strict().refine((value) => new Set(value.items.map((item) => item.productId)).size === value.items.length, "Produk di keranjang tidak boleh berulang");
export type PosSaleInput = z.input<typeof posSaleSchema>;
