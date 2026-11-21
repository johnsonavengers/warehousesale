import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/SiteHeader";
import { Stepper } from "@/components/Stepper";
import { getSessionsForDay } from "@/lib/booking";
import { isValidDateString } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function SessionsPage({ params }: { params: { date: string } }) {
  if (!isValidDateString(params.date)) notFound();
  const day = await getSessionsForDay(params.date);
  if (!day) notFound();

  return (
    <PageShell>
      <Stepper current={1} />
      <Link href="/" className="text-sm text-stone-400 hover:text-primary">
        ← Ganti tanggal
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Pilih sesi</h1>
      <p className="mt-1 text-sm text-stone-400">{day.label} {day.date.slice(0, 4)} · waktu dalam WIB</p>

      <ol className="mt-6 space-y-2.5" data-testid="session-list">
        {day.items.map((item) => {
          if (item.type === "break") {
            return (
              <li
                key={`break-${item.startTime}`}
                data-testid="break"
                aria-label={`Istirahat ${item.startTime} sampai ${item.endTime}, tidak bisa dipesan`}
                className="flex items-center justify-between rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-4 text-stone-500"
              >
                <span className="font-mono text-sm">
                  {item.startTime} – {item.endTime}
                </span>
                <span className="text-sm font-semibold uppercase tracking-widest">Istirahat</span>
              </li>
            );
          }
          const disabled = !item.bookable || day.isPast;
          const status = item.started || day.isPast
            ? "Sudah dimulai"
            : item.full
              ? "Penuh"
              : `${item.remaining}/${item.capacity} tersisa`;
          const inner = (
            <>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Sesi {item.order}
                </span>
                <span className="mt-0.5 block font-mono text-xl font-bold">
                  {item.startTime} – {item.endTime}
                </span>
                <span className="mt-0.5 block text-xs text-stone-400">
                  No. antrian {item.queueStart}–{item.queueEnd}
                </span>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold " +
                  (disabled
                    ? "bg-stone-700/50 text-stone-400"
                    : item.remaining <= 5
                      ? "bg-orange-400/15 text-orange-300"
                      : "bg-emerald-400/15 text-emerald-300")
                }
              >
                {status}
              </span>
            </>
          );
          return (
            <li key={item.id} data-testid={`session-${item.order}`}>
              {disabled ? (
                <div
                  aria-disabled="true"
                  className="card flex cursor-not-allowed items-center justify-between gap-3 px-5 py-4 opacity-60"
                >
                  {inner}
                </div>
              ) : (
                <Link
                  href={`/${day.date}/${item.id}`}
                  className="card flex items-center justify-between gap-3 px-5 py-4 transition hover:border-primary hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </PageShell>
  );
}
