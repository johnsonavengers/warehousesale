import { NavLink as Link } from "@/components/NavLink";
import { NowServingControl } from "@/components/admin/NowServingControl";
import { getDashboard, getNowServing } from "@/lib/booking";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const days = await getDashboard();
  const nowServing = await Promise.all(days.map((d) => getNowServing(d.date)));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      {days.map((d, i) => (
        <section key={d.date} aria-labelledby={`day-${d.date}`} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 id={`day-${d.date}`} className="text-lg font-bold">
                {d.label}
              </h2>
              <p className="text-sm text-stone-400">
                {d.totals.booked}/{d.totals.capacity} terisi · {d.totals.remaining} sisa ·{" "}
                {d.totals.checkedIn} sudah check-in
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/tickets?date=${d.date}`} className="btn-ghost">
                Lihat tiket
              </Link>
              <a href={`/api/admin/export?date=${d.date}`} className="btn-ghost" download>
                Export CSV
              </a>
              <Link href={`/display/${d.date}`} target="_blank" className="btn-ghost">
                Buka layar ↗
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-stone-400">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Sesi</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Jam (WIB)</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">No. antrian</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Terisi</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Sisa</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Check-in</th>
                </tr>
              </thead>
              <tbody>
                {d.sessions.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <th scope="row" className="px-5 py-2.5 text-left font-semibold">
                      Sesi {s.order}
                    </th>
                    <td className="px-3 py-2.5 font-mono">
                      {s.startTime}–{s.endTime}
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      {s.queueStart}–{s.queueEnd}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {s.booked}/{s.capacity}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.remaining}</td>
                    <td className="px-5 py-2.5 text-right font-mono tabular-nums">{s.checkedIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nowServing[i] && (
            <div className="border-t border-line px-5 py-4">
              <NowServingControl initial={nowServing[i]!} />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
