"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NavLink } from "@/components/NavLink";
import { PAYMENT_LABELS, rupiah, type PosPaymentMethod, type PosProductView } from "@/config/pos";
import type { PosSaleInput } from "@/lib/pos-validation";

const PENDING_KEY = "whs.pos.pending-sale.v1";
type CartItem = { product: PosProductView; quantity: number };
export function PosRegister({ initialProducts }: { initialProducts: PosProductView[] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [q, setQ] = useState("");
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState<PosPaymentMethod>("CASH");
  const [paid, setPaid] = useState("");
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PosSaleInput | null>(null);
  const pendingRef = useRef<PosSaleInput | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    let current = true;
    fetch("/api/admin/pos/products?active=1", { cache: "no-store" })
      .then(async (response) => { if (response.ok && current) setProducts(await response.json()); })
      .catch(() => { /* Katalog awal tetap tersedia; server memvalidasi saat checkout. */ });
    return () => { current = false; };
  }, [initialProducts]);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PENDING_KEY);
      if (stored) {
        const value = JSON.parse(stored) as PosSaleInput;
        if (typeof value.requestKey === "string" && Array.isArray(value.items)) { pendingRef.current = value; setPending(value); }
      }
    } catch { /* Penyimpanan browser opsional; request tetap memiliki id unik. */ }
  }, []);
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const amount = method === "CASH" ? Number(paid || total) : total;
  const locked = busy || !!pending;
  const visible = products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(q.trim().toLowerCase()));
  function quantity(product: PosProductView, delta: number) {
    if (locked) return;
    setCart((current) => {
      const item = current.find((row) => row.product.id === product.id);
      const next = (item?.quantity ?? 0) + delta;
      if (next <= 0) return current.filter((row) => row.product.id !== product.id);
      if (next > product.stock) { setError(`Stok ${product.name} hanya ${product.stock}.`); return current; }
      return item ? current.map((row) => row.product.id === product.id ? { ...row, quantity: next } : row) : [...current, { product, quantity: next }];
    });
  }
  function remember(value: PosSaleInput | null) {
    pendingRef.current = value; setPending(value);
    try { if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value)); else sessionStorage.removeItem(PENDING_KEY); } catch { /* Memori tetap menyimpan request untuk retry. */ }
  }
  async function refresh() {
    setRefreshing(true); setError(null);
    try {
      const response = await fetch("/api/admin/pos/products?active=1", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProducts(data);
      setCart((current) => current.map((item) => ({ ...item, product: data.find((p: PosProductView) => p.id === item.product.id) ?? { ...item.product, stock: 0 } })));
    } catch { setError("Daftar produk belum bisa diperbarui. Coba lagi."); }
    finally { setRefreshing(false); }
  }
  async function checkout() {
    if (inFlight.current) return;
    if (!pendingRef.current && (!cart.length || Number(discount) > subtotal || amount < total || !Number.isSafeInteger(amount) || !Number.isSafeInteger(Number(discount)))) { setError("Periksa keranjang, diskon, dan nominal pembayaran."); return; }
    const payload = pendingRef.current ?? { requestKey: crypto.randomUUID(), items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, unitPrice: item.product.price })), discount: Number(discount || 0), paymentMethod: method, paid: amount, customerName: customer, note };
    inFlight.current = true; setBusy(true); setError(null); remember(payload);
    let saved = false;
    try {
      const response = await fetch("/api/admin/pos/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 401) remember(null);
        throw new Error(data.error ?? "Transaksi belum dapat dipastikan. Coba simpan kembali.");
      }
      saved = true; remember(null);
      router.push(`/admin/pos/transaksi/${data.id}`);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Koneksi terputus. Coba simpan kembali untuk memeriksa transaksi yang sama."); }
    finally { if (!saved) { inFlight.current = false; setBusy(false); } }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-semibold">Kasir POS</h1><p className="mt-2 text-sm text-stone-400">Pilih barang, terima pembayaran, lalu simpan dan cetak invoice.</p></div><button className="btn-ghost" onClick={refresh} disabled={refreshing || locked}>{refreshing ? "Memuat…" : "Perbarui stok"}</button></div>
    {error && <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    {pending && !busy && <div className="card space-y-3 p-5" role="status"><p className="text-sm text-primary">Ada transaksi yang belum dikonfirmasi. Coba simpan kembali untuk memeriksa transaksi yang sama tanpa mengurangi stok dua kali.</p><button className="btn-primary" onClick={checkout}>Coba simpan kembali</button><NavLink className="btn-ghost ml-2" href="/admin/pos/transaksi">Lihat transaksi</NavLink></div>}
    <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
      <section className="card space-y-4 p-4 sm:p-5" aria-label="Katalog produk"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Produk</h2><a href="#keranjang" className="text-sm text-primary lg:hidden">Keranjang ({cart.reduce((n, item) => n + item.quantity, 0)})</a></div><label htmlFor="pos-search" className="sr-only">Cari nama atau SKU</label><input id="pos-search" className="input" type="search" placeholder="Cari nama atau SKU…" value={q} onChange={(event) => setQ(event.target.value)} />
        {products.length === 0 ? <div className="py-8 text-center"><p className="mb-4 text-sm text-stone-400">Belum ada produk aktif.</p><NavLink className="btn-primary" href="/admin/pos/produk">Tambah produk pertama</NavLink></div> : visible.length === 0 ? <p className="py-8 text-center text-sm text-stone-400">Produk tidak ditemukan.</p> : <div className="grid gap-3 sm:grid-cols-2">{visible.map((product) => <article key={product.id} className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[.025] p-4"><p className="break-all text-[10px] text-stone-400">{product.sku}</p><h3 className="mt-2 break-words font-medium">{product.name}</h3><p className="mt-3 font-semibold text-primary">{rupiah(product.price)}</p><p className="mb-4 mt-1 text-xs text-stone-400">Stok: {product.stock}</p><button className="btn-ghost mt-auto w-full" aria-label={`Tambah ${product.name}`} disabled={locked || product.stock === 0} onClick={() => quantity(product, 1)}>{product.stock ? "+ Tambah" : "Stok habis"}</button></article>)}</div>}
      </section>
      <section id="keranjang" className="card scroll-mt-36 space-y-4 p-4 sm:p-5" aria-label="Keranjang penjualan"><h2 className="font-semibold">Keranjang penjualan</h2>{!cart.length && <p className="py-4 text-sm text-stone-400">Tambahkan produk untuk mulai bertransaksi.</p>}
        <fieldset disabled={locked} className="min-w-0 space-y-4"><ul className="space-y-3">{cart.map(({ product, quantity: count }) => <li key={product.id} className="rounded-2xl border border-white/10 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-medium">{product.name}</p><p className="mt-1 text-xs text-stone-400">{rupiah(product.price)} / item</p></div><button type="button" className="min-h-11 px-2 text-xs text-red-200" onClick={() => setCart((items) => items.filter((row) => row.product.id !== product.id))} aria-label={`Hapus ${product.name}`}>Hapus</button></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-3"><button className="btn-ghost min-h-11 px-4 py-2" aria-label={`Kurangi ${product.name}`} onClick={() => quantity(product, -1)}>−</button><span aria-label={`Jumlah ${product.name}`}>{count}</span><button className="btn-ghost min-h-11 px-4 py-2" aria-label={`Tambah jumlah ${product.name}`} onClick={() => quantity(product, 1)}>+</button></div><p className="text-sm font-semibold">{rupiah(product.price * count)}</p></div></li>)}</ul>
        <div><label className="label" htmlFor="pos-customer">Nama pelanggan <span className="text-stone-400">(opsional)</span></label><input className="input" id="pos-customer" value={customer} maxLength={100} onChange={(event) => setCustomer(event.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="pos-discount">Diskon (Rp)</label><input className="input" type="number" inputMode="numeric" min={0} max={subtotal} id="pos-discount" value={discount} onChange={(event) => setDiscount(event.target.value)} /></div><div><label className="label" htmlFor="pos-payment">Pembayaran</label><select className="input" id="pos-payment" value={method} onChange={(event) => setMethod(event.target.value as PosPaymentMethod)}>{Object.entries(PAYMENT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
        <div className="space-y-2 border-y border-white/10 py-4"><p className="flex justify-between gap-3 text-sm text-stone-300"><span>Subtotal</span><span>{rupiah(subtotal)}</span></p><p className="flex justify-between gap-3 text-sm text-stone-300"><span>Diskon</span><span>{rupiah(Number(discount || 0))}</span></p><p className="flex flex-wrap justify-between gap-3 text-xl font-semibold text-primary"><span>Total</span><span data-testid="pos-total">{rupiah(total)}</span></p></div>
        {method === "CASH" && <div><label className="label" htmlFor="pos-paid">Uang diterima (Rp)</label><input className="input" type="number" inputMode="numeric" min={total} id="pos-paid" value={paid} placeholder={`Uang pas: ${total}`} onChange={(event) => setPaid(event.target.value)} /><p className="mt-2 text-sm text-stone-300">Kembalian: {rupiah(Math.max(0, amount - total))}</p></div>}
        <div><label className="label" htmlFor="pos-note">Catatan <span className="text-stone-400">(opsional)</span></label><input className="input" id="pos-note" value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} /></div></fieldset>
        <button className="btn-primary w-full" disabled={busy || (!pending && !cart.length)} onClick={checkout}>{busy ? "Menyimpan penjualan…" : pending ? "Coba simpan kembali" : "Simpan penjualan & buat invoice"}</button><p className="text-center text-xs leading-relaxed text-stone-400">Simpan setelah pembayaran diterima. Stok otomatis berkurang saat transaksi berhasil.</p>
      </section>
    </div>
  </div>;
}
