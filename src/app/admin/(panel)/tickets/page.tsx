import { NavLink as Link } from "@/components/NavLink";
import { SCHEDULE } from "@/config/schedule";
import { TicketRowActions } from "@/components/admin/TicketRowActions";
import { listTickets } from "@/lib/booking";
import { formatEventDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daftar tiket" };

type Search = { date?: string; session?: string; status?: string; q?: string };

export default async function AdminTicketsPage({ searchParams }: { searchParams: Search }) {
  const date = SCHEDULE.some((d) => d.date === searchParams.date) ? searchParams.date : undefined;
  const sessionOrder = Number(searchParams.session) || undefined;
  const status =
    searchParams.status === "BOOKED" || searchParams.status === "CHECKED_IN"
      ? searchParams.status
      : undefined;
  const q = searchParams.q?.trim() || undefined;

  const tickets = await listTickets({ date, sessionOrder, status, q });
  const maxSessions = Math.max(...SCHEDULE.map((d) => d.sessions.length));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Daftar tiket</h1>
        {date && (
          <a href={`/api/admin/export?date=${date}`} className="btn-ghost" download>
            Export CSV ({date})
          </a>
        )}
      </div>

      <form method="get" className="card mt-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto]">
        <div>
          <label htmlFor="f-date" className="label">Tanggal</label>
          <select id="f-date" name="date" className="input" defaultValue={date ?? ""}>
            <option value="">Semua tanggal</option>
            {SCHEDULE.map((d) => (
              <option key={d.date} value={d.date}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-session" className="label">Sesi</label>
          <select id="f-session" name="session" className="input" defaultValue={sessionOrder ?? ""}>
            <option value="">Semua sesi</option>
            {Array.from({ length: maxSessions }, (_, i) => (
              <option key={i + 1} value={i + 1}>Sesi {i + 1}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-status" className="label">Status</label>
          <select id="f-status" name="status" className="input" defaultValue={status ?? ""}>
            <option value="">Semua status</option>
            <option value="BOOKED">Terpesan</option>
            <option value="CHECKED_IN">Sudah check-in</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-q" className="label">Cari nama / HP / kode</label>
          <input id="f-q" name="q" className="input" defaultValue={q ?? ""} />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn-primary">Terapkan</button>
          <Link href="/admin/tickets" className="btn-ghost">Reset</Link>
        </div>
      </form>

      <p className="mt-4 text-sm text-stone-400">{tickets.length} tiket</p>

      <div className="card mt-2 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-stone-400">
              <th scope="col" className="px-4 py-3 font-semibold">No.</th>
              <th scope="col" className="px-3 py-3 font-semibold">Tanggal · Sesi</th>
              <th scope="col" className="px-3 py-3 font-semibold">Nama</th>
              <th scope="col" className="px-3 py-3 font-semibold">WhatsApp</th>
              <th scope="col" className="px-3 py-3 font-semibold">Kode</th>
              <th scope="col" className="px-3 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t border-line align-middle" data-testid={`row-${t.code}`}>
                <td className="px-4 py-2.5 font-mono text-lg font-bold tabular-nums">{t.queueNumber}</td>
                <td className="px-3 py-2.5">
                  {t.dayLabel}
                  <span className="block font-mono text-xs text-stone-400">
                    Sesi {t.session.order} · {t.session.startTime}–{t.session.endTime}
                  </span>
                </td>
                <td className="max-w-[220px] px-3 py-2.5">
                  <span className="block truncate font-medium">{t.name}</span>
                  {t.email && <span className="block truncate text-xs text-stone-400">{t.email}</span>}
                </td>
                <td className="px-3 py-2.5 font-mono">{t.phone}</td>
                <td className="px-3 py-2.5 font-mono">
                  <Link href={`/ticket/${t.code}`} target="_blank" className="underline-offset-4 hover:text-primary hover:underline">
                    {t.code}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  {t.status === "CHECKED_IN" ? (
                    <>
                      <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300" data-testid="row-status">
                        CHECKED_IN
                      </span>
                      <span className="mt-1.5 block text-xs text-stone-400">
                        {t.checkedInAt && formatEventDateTime(new Date(t.checkedInAt))}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full bg-stone-700/50 px-2.5 py-1 text-xs font-semibold text-stone-200" data-testid="row-status">
                      BOOKED
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <TicketRowActions id={t.id} status={t.status} label={`${t.name} (no. ${t.queueNumber})`} />
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-stone-400">
                  Belum ada tiket yang cocok dengan filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
