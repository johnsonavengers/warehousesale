import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOKING_RULES } from "@/config/event";
import { SeatPicker } from "@/components/SeatPicker";
import { PageShell } from "@/components/SiteHeader";
import { Stepper } from "@/components/Stepper";
import { cleanupExpiredHolds, getSeats } from "@/lib/booking";
import { isValidDateString } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function SeatsPage({
  params,
  searchParams,
}: {
  params: { date: string; sessionId: string };
  searchParams: { expired?: string };
}) {
  if (!isValidDateString(params.date)) notFound();
  await cleanupExpiredHolds();
  const data = await getSeats(params.sessionId);
  if (!data || data.session.date !== params.date) notFound();
  const { session } = data;

  return (
    <PageShell>
      <Stepper current={2} />
      <Link href={`/${session.date}`} className="text-sm text-stone-400 hover:text-primary">
        ← Ganti sesi
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Pilih nomor antrian</h1>
      <p className="mt-1 text-sm text-stone-400">
        {session.dayLabel} · Sesi {session.order} · {session.startTime}–{session.endTime} WIB
      </p>

      {searchParams.expired && (
        <p role="alert" className="mt-4 rounded-xl border border-orange-400/40 bg-orange-400/10 px-4 py-3 text-sm text-orange-200">
          Waktu pengisian data habis, nomor Anda sudah dilepas. Silakan pilih nomor lagi.
        </p>
      )}

      <SeatPicker
        initial={data}
        pollMs={BOOKING_RULES.seatPollIntervalMs}
        maxSelect={BOOKING_RULES.maxNumbersPerBooking}
      />
    </PageShell>
  );
}
