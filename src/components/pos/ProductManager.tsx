"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NavLink } from "@/components/NavLink";
import { rupiah, type PosProductView } from "@/config/pos";

type Editor = { mode: "create" | "edit" | "stock"; product?: PosProductView };
export function ProductManager({ initialProducts }: { initialProducts: PosProductView[] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [editor, setEditor] = useState<Editor | null>(initialProducts.length ? null : { mode: "create" });
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let current = true;
    fetch("/api/admin/pos/products", { cache: "no-store" }).then(async (response) => {
      if (response.ok && current) setProducts(await response.json());
    }).catch(() => {});
    return () => { current = false; };
  }, [initialProducts]);
  function edit(value: Editor) { setEditor(value); setMessage(""); anchor.current?.scrollIntoView({ block: "start" }); }
  async function saved() {
    const response = await fetch("/api/admin/pos/products", { cache: "no-store" });
    if (!response.ok) throw new Error("Data tersimpan, tetapi daftar belum bisa diperbarui. Muat ulang halaman.");
    setProducts(await response.json()); setEditor(null); setMessage("Perubahan produk dan stok sudah tersimpan."); router.refresh();
  }
  const visible = products.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-semibold">Produk & stok</h1><p className="mt-2 text-sm text-stone-400">Kelola harga, stok masuk, dan koreksi stok barang.</p></div><div className="flex flex-wrap gap-2"><NavLink className="btn-ghost" href="/admin/pos/impor">Impor Excel / CSV</NavLink><button className="btn-primary" onClick={() => edit({ mode: "create" })}>+ Tambah produk</button></div></div><div ref={anchor} className="scroll-mt-40" />
    {message && <p role="status" className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">{message}</p>}
    {editor && <ProductEditor key={`${editor.mode}-${editor.product?.id ?? "new"}`} editor={editor} onCancel={() => setEditor(null)} onSaved={saved} />}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Produk aktif", products.filter(p => p.active).length], ["Total stok", products.reduce((sum, p) => sum + p.stock, 0)], ["Stok habis", products.filter(p => p.active && p.stock === 0).length]].map(([label, value]) => <div className="card p-4" key={label}><p className="text-xs text-stone-400">{label}</p><p className="mt-2 text-2xl font-semibold text-primary">{value}</p></div>)}</div>
    <label className="sr-only" htmlFor="product-search">Cari produk</label><input id="product-search" className="input" type="search" placeholder="Cari nama atau SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
    {!visible.length ? <div className="card p-8 text-center text-sm text-stone-400">Belum ada produk yang sesuai.</div> : <ul className="grid gap-3 md:grid-cols-2">{visible.map((product) => <li className="card min-w-0 p-5" key={product.id} data-testid={`product-${product.sku}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-xs text-stone-400">{product.sku}</p><h2 className="mt-2 break-words font-semibold">{product.name}</h2><p className="mt-2 text-primary">{rupiah(product.price)}</p>{!product.active && <p className="mt-2 text-xs text-stone-400">Nonaktif</p>}</div><div className="text-right"><p className="text-xs text-stone-400">Stok</p><p className="mt-1 text-3xl font-semibold" data-testid="product-stock">{product.stock}</p></div></div><div className="mt-5 flex flex-wrap gap-2"><button className="btn-ghost" onClick={() => edit({ mode: "stock", product })}>Ubah stok</button><button className="btn-ghost" onClick={() => edit({ mode: "edit", product })}>Edit produk</button><NavLink className="min-h-11 py-3 text-xs text-primary" href={`/admin/pos/produk/${product.id}`}>Riwayat stok →</NavLink></div></li>)}</ul>}
  </div>;
}

function ProductEditor({ editor, onCancel, onSaved }: { editor: Editor; onCancel: () => void; onSaved: () => Promise<void> }) {
  const { mode, product } = editor;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const request = useRef<{ url: string; method: string; data: object } | null>(null);
  const inFlight = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    const fields = new FormData(event.currentTarget);
    const data = mode === "stock" ? { requestKey: crypto.randomUUID(), quantity: Number(fields.get("quantity")), reason: fields.get("reason") } : { sku: fields.get("sku"), name: fields.get("name"), price: Number(fields.get("price")), ...(mode === "create" ? { stock: Number(fields.get("stock")) } : { active: fields.get("active") === "on", revision: product!.revision }) };
    const current = request.current ?? { url: mode === "create" ? "/api/admin/pos/products" : `/api/admin/pos/products/${product!.id}${mode === "stock" ? "/stock" : ""}`, method: mode === "edit" ? "PATCH" : "POST", data };
    request.current = current; inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(current.url, { method: current.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(current.data) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) { request.current = null; setUncertain(false); }
        else setUncertain(true);
        throw new Error(result.error ?? "Belum bisa menyimpan perubahan.");
      }
      await onSaved();
    } catch (err) {
      if (request.current) setUncertain(true);
      setError(err instanceof Error ? err.message : "Koneksi terputus. Coba simpan kembali.");
    } finally { setBusy(false); inFlight.current = false; }
  }
  return <form onSubmit={submit} className="card space-y-4 p-5" aria-label={mode === "create" ? "Tambah produk" : mode === "stock" ? "Ubah stok" : "Edit produk"}>
    <div><h2 className="text-xl font-semibold">{mode === "create" ? "Produk baru" : mode === "stock" ? "Ubah stok" : "Edit produk"}</h2>{product && <p className="mt-2 break-words text-sm text-stone-400">{product.name} · {product.sku} · stok {product.stock}</p>}</div>
    <fieldset disabled={busy || uncertain} className="grid min-w-0 gap-4 sm:grid-cols-2">{mode === "stock" ? <><div><label className="label" htmlFor="stock-quantity">Perubahan jumlah</label><input id="stock-quantity" name="quantity" className="input" type="number" required min={-1_000_000} max={1_000_000} placeholder="Contoh: 10 atau -2" /><p className="mt-2 text-xs text-stone-400">Angka positif menambah, angka negatif mengurangi.</p></div><div><label className="label" htmlFor="stock-reason">Alasan perubahan</label><input id="stock-reason" name="reason" className="input" required minLength={3} maxLength={200} placeholder="Stok masuk / barang rusak / koreksi" /></div></> : <><div><label className="label" htmlFor="product-sku">SKU / kode barang</label><input id="product-sku" name="sku" className="input" defaultValue={product?.sku} required maxLength={60} autoComplete="off" /></div><div><label className="label" htmlFor="product-name">Nama produk</label><input id="product-name" name="name" className="input" defaultValue={product?.name} required minLength={2} maxLength={120} /></div><div><label className="label" htmlFor="product-price">Harga jual (Rp)</label><input id="product-price" name="price" className="input" type="number" inputMode="numeric" required min={0} max={2_000_000_000} defaultValue={product?.price} /></div>{mode === "create" ? <div><label className="label" htmlFor="product-stock">Stok awal</label><input id="product-stock" name="stock" className="input" type="number" inputMode="numeric" required min={0} max={1_000_000} defaultValue={0} /></div> : <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" name="active" defaultChecked={product?.active} className="h-5 w-5 accent-yellow-300" />Produk aktif di kasir</label>}</>}</fieldset>
    {error && <p role="alert" className="text-sm text-red-200">{error}</p>}{uncertain && <p className="text-sm text-primary">Status penyimpanan belum dipastikan. Coba simpan kembali dengan data yang sama.</p>}<div className="flex flex-wrap gap-2"><button className="btn-primary" type="submit" disabled={busy}>{busy ? "Menyimpan…" : uncertain ? "Coba simpan kembali" : "Simpan"}</button><button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>Tutup</button></div>
  </form>;
}
