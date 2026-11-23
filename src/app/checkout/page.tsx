import { NavLink as Link } from "@/components/NavLink";
import { CheckoutForm } from "@/components/CheckoutForm";
import { PageShell } from "@/components/SiteHeader";
import { redirect } from "next/navigation";
import { getSessionsForDay } from "@/lib/booking";
import { getScheduleDay } from "@/config/schedule";
export const dynamic = "force-dynamic";
export const metadata = { title: "Isi data" };
export default async function CheckoutPage({ searchParams }: { searchParams: { date?: string; session?: string } }) {
  const day = getScheduleDay(searchParams.date ?? "") ? await getSessionsForDay(searchParams.date!) : null;
  const session = day?.items.find(s => s.type === "session" && s.id === searchParams.session);
  if (day && (!session || session.type !== "session" || !session.bookable)) redirect(`/${day.date}?pilih=1`);
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        {day && session?.type === "session" ? <CheckoutForm key={session.id} day={day} session={session} /> : (
          <div className="card p-6">
            <h1 className="text-2xl font-semibold">Pilih tanggal kunjungan</h1>
            <p className="mt-3 text-sm text-stone-300">Tanggal belum dipilih atau tidak tersedia. Silakan pilih tanggal kunjungan.</p>
            <Link href="/#tanggal" className="btn-primary mt-4">Pilih tanggal</Link>
          </div>
        )}
      </div>
    </PageShell>
  );
}
