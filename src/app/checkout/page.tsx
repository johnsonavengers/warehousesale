import { NavLink as Link } from "@/components/NavLink";
import { CheckoutForm } from "@/components/CheckoutForm";
import { PageShell } from "@/components/SiteHeader";
import { Stepper } from "@/components/Stepper";
import { getNow, isBookingClosed } from "@/lib/time";
import { BOOKING_RULES } from "@/config/event";
import { getScheduleDay } from "@/config/schedule";
export const dynamic = "force-dynamic";
export const metadata = { title: "Isi data" };
export default async function CheckoutPage({ searchParams }: { searchParams: { date?: string } }) {
  const day = getScheduleDay(searchParams.date ?? "");
  const now = getNow();
  const open = day?.sessions.some((s) => !isBookingClosed(day.date, s.start, now, BOOKING_RULES.bookingCutoffMinutes));
  return <PageShell><div className="mx-auto max-w-3xl"><Stepper current={1} /><p className="eyebrow mb-3">Satu langkah lagi</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tiketmu hampir siap.</h1><p className="mt-3 text-sm text-stone-400">Lengkapi data. Sistem akan mengacak sesi dan nomor antrian yang tersedia untuk tanggalmu.</p>
    {day && open ? <CheckoutForm day={day} /> : <div className="card mt-6 p-6"><p className="text-sm text-stone-300">Tanggal belum dipilih atau semua sesi sudah ditutup. Silakan pilih tanggal kunjungan.</p><Link href="/#tanggal" className="btn-primary mt-4">Pilih tanggal</Link></div>}
  </div></PageShell>;
}
