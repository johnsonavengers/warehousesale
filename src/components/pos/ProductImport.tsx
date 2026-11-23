"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NavLink } from "@/components/NavLink";
import { rupiah } from "@/config/pos";
import { IMPORT_MAX_BYTES, type ImportIssue, type ImportMode, type ImportPreview } from "@/lib/pos-import-types";

const pendingKey = "whs.pos.pending-import.v1";
export function ProductImport({ initialPreview }: { initialPreview: ImportPreview | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>("SET");
  const [preview, setPreview] = useState<ImportPreview | null>(initialPreview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [stale, setStale] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLDivElement>(null);

  useEffect(() => { try { const id = sessionStorage.getItem(pendingKey); if (id && id !== initialPreview?.id) setRecovery(id); } catch {} }, [initialPreview?.id]);
  useEffect(() => { setPreview(initialPreview); if (initialPreview) setMode(initialPreview.mode); }, [initialPreview]);
  function clearPending() { try { sessionStorage.removeItem(pendingKey); } catch {} setRecovery(null); }
  function resetPreview() { setPreview(null); setIssues([]); setError(""); setStale(false); }
  async function recover() {
    if (!recovery || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/pos/imports/${recovery}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { if (response.status === 404) clearPending(); throw new Error(data.error ?? "Belum bisa memeriksa impor."); }
      setPreview(data); setMode(data.mode); setRecovery(null);
      setUncertain(data.status !== "APPLIED");
      if (data.status === "APPLIED") { clearPending(); router.replace(`/admin/pos/impor?hasil=${data.id}`, { scroll: false }); }
    } catch (err) { setError(err instanceof Error ? err.message : "Koneksi terputus."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function upload(event: React.FormEvent) {
    event.preventDefault(); if (!file || inFlight.current) return;
    if (file.size > IMPORT_MAX_BYTES) { setError("Ukuran file maksimal 2 MB."); return; }
    inFlight.current = true; setBusy(true); resetPreview();
    try {
      const body = new FormData(); body.set("file", file); body.set("mode", mode);
      const response = await fetch("/api/admin/pos/imports", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) { setIssues(data.issues ?? []); throw new Error(data.error ?? "File belum bisa dibaca."); }
      setPreview(data);
      requestAnimationFrame(() => result.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    } catch (err) { setError(err instanceof Error ? err.message : "Koneksi terputus. Silakan unggah ulang."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function apply() {
    if (!preview || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { sessionStorage.setItem(pendingKey, preview.id); } catch {}
    setUncertain(true);
    try {
      const response = await fetch(`/api/admin/pos/imports/${preview.id}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 || response.status === 404 || response.status === 400) { setStale(true); setUncertain(false); clearPending(); }
        throw new Error(data.error ?? "Status impor belum dipastikan. Coba simpan kembali.");
      }
      setPreview(data); setUncertain(false); clearPending(); router.replace(`/admin/pos/impor?hasil=${data.id}`, { scroll: false });
    } catch (err) { setError(err instanceof Error ? err.message : "Koneksi terputus. Coba simpan kembali dengan pratinjau yang sama."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const applied = preview?.status === "APPLIED";
  const locked = busy || uncertain || !!recovery;
  return <div className="space-y-5">
    <div><NavLink href="/admin/pos/produk" className="text-sm text-primary">← Produk & stok</NavLink><h1 className="mt-4 text-3xl font-semibold">Impor produk & stok</h1><p className="mt-2 text-sm text-stone-400">Unggah Excel atau CSV. Produk dicocokkan berdasarkan SKU.</p></div>
    {recovery && <div className="card space-y-3 p-5"><p className="text-sm text-primary">Ada impor yang statusnya belum diperiksa. Periksa sebelum mengunggah file lain agar stok tidak bertambah dua kali.</p><button className="btn-primary" disabled={busy} onClick={recover}>{busy ? "Memeriksa…" : "Periksa impor sebelumnya"}</button></div>}
    {!applied && <form onSubmit={upload} className="card space-y-5 p-5">
      <div className="flex flex-wrap gap-2"><a className="btn-ghost" href="/api/admin/pos/imports/template">Unduh template Excel</a><a className="btn-ghost" href="/api/admin/pos/imports/template?format=csv">Unduh template CSV</a></div>
      <div className="rounded-2xl bg-white/5 p-4 text-sm leading-relaxed text-stone-300"><p>Kolom wajib: <strong className="text-white">SKU, Stok</strong>. Untuk produk baru, isi juga <strong className="text-white">Nama, Harga</strong>.</p><p className="mt-2">Nama / Harga yang kosong mempertahankan data lama. Gunakan angka tanpa titik/koma (contoh: 35000). Simpan SKU sebagai teks agar nol di depan tetap terbaca.</p><p className="mt-2">Excel .xlsx atau CSV UTF-8, maksimal 2 MB / 500 produk. Isi lembar <strong>Produk</strong> atau lembar pertama. Produk di luar file tidak berubah.</p></div>
      <fieldset disabled={locked} className="min-w-0 space-y-4">
        <div><label htmlFor="import-file" className="label">File produk</label><input ref={fileInput} id="import-file" className="block w-full min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-yellow-300 file:px-3 file:py-2 file:font-semibold file:text-black" type="file" accept=".xlsx,.csv" required onChange={e => { setFile(e.target.files?.[0] ?? null); resetPreview(); }} /></div>
        <div><label htmlFor="import-mode" className="label">Cara memperbarui stok</label><select id="import-mode" className="input" value={mode} onChange={e => { setMode(e.target.value as ImportMode); resetPreview(); }}><option value="SET">Stok akhir sesuai file</option><option value="ADD">Tambahkan stok masuk</option></select><p className="mt-2 text-sm text-primary">{mode === "SET" ? "Contoh: stok sekarang 10, file 7 → stok menjadi 7." : "Contoh: stok sekarang 10, file 7 → stok menjadi 17. Jangan impor pengiriman yang sama dua kali."}</p></div>
      </fieldset>
      <button className="btn-primary" type="submit" disabled={locked || !file}>{busy && !uncertain ? "Membaca file…" : stale ? "Periksa ulang file" : "Lihat pratinjau"}</button>
    </form>}
    {error && <div role="alert" className="rounded-2xl border border-red-300/20 bg-red-300/5 p-4 text-sm text-red-200"><p>{error}</p>{issues.length > 0 && <ul className="mt-3 max-h-72 space-y-2 overflow-auto">{issues.map((issue, i) => <li key={i}>Baris {issue.row}: {issue.message}</li>)}</ul>}</div>}
    {preview && <div ref={result} className="scroll-mt-36 space-y-4">
      {applied ? <div role="status" className="card space-y-3 border-primary/30 p-5"><h2 className="text-xl font-semibold text-primary">Impor berhasil disimpan</h2><p className="text-sm">{preview.rows.filter(r => r.action === "NEW").length} produk baru, {preview.rows.filter(r => r.action === "UPDATE").length} diperbarui, {preview.rows.filter(r => r.action === "UNCHANGED").length} tetap. Perubahan stok tercatat di riwayat.</p><div className="flex flex-wrap gap-2"><NavLink href="/admin/pos/produk" className="btn-primary">Lihat produk & stok</NavLink><button className="btn-ghost" onClick={() => { resetPreview(); setFile(null); if (fileInput.current) fileInput.current.value = ""; router.replace("/admin/pos/impor", { scroll: false }); }}>Impor file lain</button></div></div> : <div className="card space-y-3 p-5"><h2 className="text-xl font-semibold">Periksa {preview.rows.length} produk</h2><p className="break-all text-sm text-stone-400">{preview.filename} · {preview.mode === "SET" ? "Stok akhir sesuai file" : "Tambahkan stok masuk"}</p><p className="text-sm text-stone-300">Belum ada stok yang berubah. Pratinjau berlaku 30 menit. Jika produk berubah karena transaksi lain, periksa ulang file.</p>{uncertain && <p className="text-sm text-primary">Status belum dipastikan. Tombol di bawah memeriksa dan melanjutkan impor yang sama tanpa menggandakan stok.</p>}<button className="btn-primary w-full sm:w-auto" disabled={busy || stale} onClick={apply}>{busy ? "Menyimpan…" : uncertain ? "Coba simpan kembali" : "Simpan perubahan stok"}</button></div>}
      <ul className="grid gap-3 md:grid-cols-2">{preview.rows.map(row => <li key={row.sku} className="card min-w-0 p-4" data-testid={`import-${row.sku}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-all text-xs text-stone-400">Baris {row.row} · {row.sku}</p><span className="text-xs text-primary">{row.action === "NEW" ? "Produk baru" : row.action === "UPDATE" ? "Diperbarui" : "Tetap"}</span></div><p className="mt-2 break-words font-semibold">{row.name}</p>{row.before && row.before.name !== row.name && <p className="mt-1 break-words text-xs text-stone-400">Sebelumnya: {row.before.name}</p>}<p className="mt-1 text-sm text-stone-400">Harga: {row.before && row.before.price !== row.price ? `${rupiah(row.before.price)} → ` : ""}{rupiah(row.price)}</p><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="text-xs text-stone-400">Stok awal</p><p className="mt-1 text-xl">{row.before?.stock ?? 0}</p></div><div><p className="text-xs text-stone-400">{preview.mode === "ADD" ? "Masuk" : "Di file"}</p><p className="mt-1 text-xl">{row.amount}</p></div><div><p className="text-xs text-primary">Stok akhir</p><p className="mt-1 text-xl font-semibold text-primary">{row.stock}</p></div></div></li>)}</ul>
    </div>}
  </div>;
}
