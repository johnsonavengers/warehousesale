export function PageLoading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="mx-auto w-full max-w-3xl px-4 py-10">
      <p className="mb-6 text-sm font-medium text-primary">Memuat halaman…</p>
      <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
        <div className="h-5 w-40 rounded-full bg-white/10" />
        <div className="h-9 w-3/4 rounded-2xl bg-white/10" />
        <div className="card h-64 bg-white/[0.03]" />
      </div>
    </div>
  );
}
