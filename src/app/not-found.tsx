import Link from "next/link";
import { PageShell } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <PageShell>
      <div className="card mt-10 p-6 text-center">
        <p className="queue-number text-6xl text-primary">404</p>
        <h1 className="mt-3 text-xl font-bold">Halaman tidak ditemukan</h1>
        <p className="mt-1 text-sm text-stone-400">
          Tanggal, sesi, atau tiket yang Anda cari tidak ada.
        </p>
        <Link href="/" className="btn-primary mt-5">
          Ke halaman utama
        </Link>
      </div>
    </PageShell>
  );
}
