import { LookupForm } from "@/components/LookupForm";
import { PageShell } from "@/components/SiteHeader";

export const metadata = { title: "Cari tiket saya" };

export default function LookupPage() {
  return (
    <PageShell>
      <h1 className="text-2xl font-bold tracking-tight">Cari tiket saya</h1>
      <p className="mt-1 text-sm text-stone-400">
        Masukkan nomor WhatsApp yang dipakai saat memesan.
      </p>
      <LookupForm />
    </PageShell>
  );
}
