import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatEventDateTime } from "@/lib/time";
import { NavLink } from "@/components/NavLink";
import { rupiah } from "@/config/pos";
export default async function ProductHistory({ params }: { params: { id: string } }) {
  const product = await prisma.posProduct.findUnique({ where: { id: params.id }, include: { movements: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 } } });
  if (!product) notFound();
  return <div className="space-y-5"><div><h1 className="break-words text-2xl font-semibold">{product.name}</h1><p className="mt-2 text-sm text-stone-400">{product.sku} · {rupiah(product.price)} · Stok saat ini: {product.stock}</p></div><h2 className="font-semibold">Riwayat perubahan stok</h2><p className="text-xs text-stone-400">100 perubahan terakhir. Waktu dalam WIB.</p><ul className="space-y-3">{product.movements.map((row) => <li key={row.id} className="card p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium">{row.reason}</p><p className="mt-2 break-all text-xs text-stone-400">{formatEventDateTime(row.createdAt)} · {row.cashierEmail}</p></div><div className="shrink-0 text-right"><p className={`text-xl font-semibold ${row.quantity > 0 ? "text-primary" : "text-red-200"}`}>{row.quantity > 0 ? "+" : ""}{row.quantity}</p><p className="mt-1 text-xs text-stone-400">Saldo {row.balance}</p></div></div>{row.saleId && <NavLink href={`/admin/pos/transaksi/${row.saleId}`} className="mt-3 inline-block py-2 text-sm text-primary">Lihat invoice →</NavLink>}</li>)}</ul>{!product.movements.length && <p className="text-sm text-stone-400">Belum ada perubahan stok.</p>}<NavLink className="btn-ghost" href="/admin/pos/produk">Kembali ke produk</NavLink></div>;
}
