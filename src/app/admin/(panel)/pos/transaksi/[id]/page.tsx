import { notFound } from "next/navigation";
import { getPosSale } from "@/lib/pos";
import { PAYMENT_LABELS, POS_STORE, rupiah, type PosPaymentMethod } from "@/config/pos";
import { formatEventDateTime } from "@/lib/time";
import { NavLink } from "@/components/NavLink";
import { PrintButton } from "@/components/pos/PrintButton";
export default async function InvoicePage({ params, searchParams }: { params: { id: string }; searchParams: { paper?: string } }) {
  const sale = await getPosSale(params.id);
  if (!sale) notFound();
  const a4 = searchParams.paper === "a4";
  const number = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
  return <div className="space-y-5"><style>{`@media print { @page { size: ${a4 ? "A4" : "98.425mm 190.5mm"}; margin: ${a4 ? "15mm" : "4mm 14mm 6mm"}; } }`}</style><div className="no-print space-y-4"><div><h1 className="text-2xl font-semibold">Invoice penjualan</h1><p className="mt-2 text-sm text-stone-400">Transaksi tersimpan. Invoice dapat dicetak ulang kapan saja.</p></div><div className="flex flex-wrap gap-2"><PrintButton /><NavLink className="btn-ghost" href={`/admin/pos/transaksi/${sale.id}${a4 ? "" : "?paper=a4"}`}>{a4 ? "Ukuran contoh DealPOS" : "Versi A4"}</NavLink><NavLink className="btn-ghost" href="/admin/pos">Transaksi baru</NavLink></div><p className="text-xs text-stone-400">{a4 ? "Kertas A4 (210 × 297 mm)." : "Ukuran contoh: 98,4 × 190,5 mm."} Gunakan skala 100% dan matikan header/footer browser pada pengaturan cetak.</p></div>
    <article className={`pos-print-document pos-receipt ${a4 ? "pos-receipt-a4" : ""}`} aria-label="Invoice penjualan" data-testid="pos-invoice"><div className="receipt-heading"><h2>{POS_STORE.name}</h2><p>{POS_STORE.tagline}</p></div><p className="receipt-payment">{PAYMENT_LABELS[sale.paymentMethod as PosPaymentMethod].toUpperCase()}</p><p className="receipt-cashier">Kasir: {sale.cashierEmail}</p><div className="receipt-meta"><strong>Invoice</strong><span>{formatEventDateTime(sale.createdAt)}</span></div><p className="receipt-number" data-testid="pos-invoice-number">{sale.invoiceNumber}</p>{sale.customerName && <p className="receipt-customer">Pelanggan: {sale.customerName}</p>}
      <div className="receipt-items">{sale.items.map((item) => <div className="receipt-item" key={item.id}><p>{item.name}</p><small>{item.sku}</small><div><span>{item.quantity} × {number(item.unitPrice)}</span><strong>{number(item.lineTotal)}</strong></div></div>)}</div>
      <dl className="receipt-totals"><div><dt>Subtotal</dt><dd>{rupiah(sale.subtotal)}</dd></div>{sale.discount > 0 && <div><dt>Diskon</dt><dd>− {rupiah(sale.discount)}</dd></div>}<div className="receipt-grand"><dt>Total</dt><dd>{rupiah(sale.total)}</dd></div><div><dt>{PAYMENT_LABELS[sale.paymentMethod as PosPaymentMethod]}</dt><dd>{rupiah(sale.paid)}</dd></div>{sale.paymentMethod === "CASH" && <div><dt>Kembalian</dt><dd>{rupiah(sale.change)}</dd></div>}</dl>
      <p className="receipt-count">{sale.items.reduce((sum, item) => sum + item.quantity, 0)} item · {sale.items.length} jenis barang</p>{sale.note && <p className="receipt-note">Catatan: {sale.note}</p>}<footer className="receipt-footer"><p>{POS_STORE.footer}</p><p>{formatEventDateTime(sale.createdAt)}</p></footer>
    </article></div>;
}
