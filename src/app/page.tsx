import Link from "next/link";
import { EVENT } from "@/config/event";
import { PageShell } from "@/components/SiteHeader";
import { Stepper } from "@/components/Stepper";
import { getDaysOverview } from "@/lib/booking";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const days = await getDaysOverview();
  return (
    <PageShell>
      <Stepper current={0} />
      <h1 className="text-2xl font-bold tracking-tight">Pilih tanggal</h1>
      <p className="mt-1 text-sm text-stone-400">{EVENT.tagline}</p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {days.map((d) => {
          const [weekday, rest] = d.label.split(", ");
          const disabled = d.isPast || d.remaining === 0;
          const body = (
            <>
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">
                {weekday}
              </span>
              <span className="mt-1 block text-3xl font-black tracking-tight">{rest}</span>
              <span className="mt-1 block text-xs text-stone-400">
                {d.firstStart}–{d.lastEnd} WIB
              </span>
              <span
                className={
                  "mt-4 inline-block rounded-full px-2.5 py-1 text-xs font-semibold " +
                  (disabled ? "bg-stone-700/50 text-stone-400" : "bg-emerald-400/15 text-emerald-300")
                }
              >
                {d.isPast
                  ? "Sudah lewat"
                  : d.remaining === 0
                    ? "Habis"
                    : `${d.remaining}/${d.capacity} tersisa`}
              </span>
            </>
          );
          return (
            <li key={d.date}>
              {disabled ? (
                <div
                  aria-disabled="true"
                  data-testid={`day-${d.date}`}
                  className="card block cursor-not-allowed p-5 opacity-60"
                >
                  {body}
                </div>
              ) : (
                <Link
                  href={`/${d.date}`}
                  data-testid={`day-${d.date}`}
                  className="card block p-5 transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {days.length === 0 && (
        <p className="card mt-6 p-5 text-sm text-stone-300">
          Jadwal belum tersedia. Jalankan <code className="font-mono">npm run seed</code>.
        </p>
      )}
    </PageShell>
  );
}
