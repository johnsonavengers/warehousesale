import Link from "next/link";
import { CheckoutForm } from "@/components/CheckoutForm";
import { PageShell } from "@/components/SiteHeader";
import { Stepper } from "@/components/Stepper";
import { getDaysOverview } from "@/lib/booking";
import { getScheduleDay } from "@/config/schedule";
export const dynamic = "force-dynamic";
export const metadata = { title: "Isi data" };
export default async function CheckoutPage({ searchParams }: { searchParams: { date?: string } }) {
  const day = getScheduleDay(searchParams.date ?? "") ? (await getDaysOverview()).find((d) => d.date === searchParams.date) : null;
  return <PageShell><div className="mx-auto max-w-3xl"><Stepper current={1} /><p className="eyebrow mb-3">Satu langkah lagi</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tiketmu hampir siap.</h1><p className="mt-3 text-sm text-stone-400">Lengkapi data untuk mendapatkan sesi dan nomor antrianmu.</p>
    {day && !day.isPast && day.remaining > 0 ? <CheckoutForm day={day} /> : <div className="card mt-6 p-6"><p className="text-sm text-stone-300">Tanggal belum dipilih atau kuotanya sudah tidak tersedia. Silakan pilih tanggal kunjungan.</p><Link href="/#tanggal" className="btn-primary mt-4">Pilih tanggal</Link></div>}
  </div></PageShell>;
}
