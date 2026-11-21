import { NavLink } from "@/components/NavLink";
import { ExportExcelButton } from "@/components/admin/ExportExcelButton";
import { ReportFilters } from "@/components/admin/ReportFilters";
import { getRegistrationReport, parseReportFilter, reportSearchParams, summarizeRegistrations, REPORT_STATUS_LABEL, type RegistrationRow } from "@/lib/registration-report";
import { formatEventDateTime } from "@/lib/time";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Laporan pendaftar" };
const PAGE_SIZE = 50;

function Status({ row }: { row: RegistrationRow }) {
  return <span className={"inline-flex rounded-full border px-2.5 py-1 text-xs " + (row.status === "CANCELLED" ? "border-red-400/30 text-red-200" : row.status === "CHECKED_IN" ? "border-primary/30 bg-primary/10 text-primary" : "border-white/15 text-stone-200")}>{REPORT_STATUS_LABEL[row.status]}</span>;
}

export default async function ReportPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) if (value !== undefined) params.set(key, Array.isArray(value) ? value.join(",") : value);
  let filter;
  try { filter = parseReportFilter(params); }
  catch (error) {
    if (!(error instanceof AppError)) throw error;
    return <div className="card p-6"><h1 className="text-2xl font-semibold">Laporan pendaftar</h1><p role="alert" className="mt-4 text-red-200">{error.message}</p><NavLink href="/admin/laporan" className="btn-primary mt-4">Reset filter</NavLink></div>;
  }
  const rows = await getRegistrationReport(filter);
  const totals = summarizeRegistrations(rows);
  const maxPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(maxPage, requestedPage)) : 1;
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const query = reportSearchParams(filter);
  const pageUrl = (number: number) => { const target = new URLSearchParams(query); target.set("page", String(number)); return `/admin/laporan?${target}`; };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow mb-2">Admin · Pendaftaran</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Laporan pendaftar</h1><p className="mt-2 text-sm text-stone-400">Data pendaftaran, kehadiran, dan riwayat pembatalan.</p></div><ExportExcelButton href={`/api/admin/reports/export?${query}`} /></div>
      <ReportFilters key={query.toString()} filter={filter} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Ringkasan sesuai filter">
        {[["Pendaftaran", totals.total], ["Pengunjung unik", totals.uniquePeople], ["Belum check-in", totals.booked], ["Sudah check-in", totals.checkedIn], ["Dibatalkan", totals.cancelled]].map(([label, value]) => <div className="card p-4" key={label}><p className="text-xs text-stone-400">{label}</p><p className="mt-2 text-3xl font-semibold text-primary">{value}</p></div>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400"><p>{rows.length ? `Menampilkan ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, rows.length)} dari ${rows.length} pendaftaran` : "0 pendaftaran"}</p><p>Ringkasan dan Excel mengikuti filter aktif · Waktu dalam WIB</p></div>
      {rows.length === 0 ? <div className="card p-8 text-center text-sm text-stone-300">Belum ada pendaftar yang sesuai dengan filter ini.</div> : <>
        <div className="card hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1150px] text-sm">
            <thead><tr className="border-b border-white/10 text-left text-xs text-stone-400">{["Pendaftar", "WhatsApp / Email", "Kunjungan", "Antrian / Kode", "Status", "Waktu daftar (WIB)"].map((title) => <th scope="col" className="px-5 py-4 font-medium" key={title}>{title}</th>)}</tr></thead>
            <tbody>{visible.map((row) => <tr key={`${row.status}-${row.id}`} className="border-b border-white/10 last:border-0" data-testid={`report-row-${row.code}`}>
              <td className="max-w-[220px] break-words px-5 py-4 font-medium">{row.name}</td>
              <td className="px-5 py-4"><span className="block font-mono">{row.phone}</span><span className="mt-1 block max-w-[240px] break-words text-xs text-stone-400">{row.email || "—"}</span></td>
              <td className="whitespace-nowrap px-5 py-4">{row.dayLabel} {row.date.slice(0, 4)}<span className="mt-1 block text-xs text-stone-400">{row.session ? `Sesi ${row.session.order} · ${row.session.startTime}–${row.session.endTime} WIB` : "Sesi diarsipkan"}</span></td>
              <td className="px-5 py-4"><span className="block text-lg font-semibold text-primary">#{row.queueNumber}</span><span className="mt-1 block whitespace-nowrap font-mono text-xs">{row.code}</span></td>
              <td className="px-5 py-4"><Status row={row} />{row.checkedInAt && <span className="mt-2 block whitespace-nowrap text-xs text-stone-400">{formatEventDateTime(new Date(row.checkedInAt))}</span>}</td>
              <td className="whitespace-nowrap px-5 py-4 text-xs text-stone-300">{formatEventDateTime(new Date(row.createdAt))}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <ul className="space-y-3 lg:hidden">{visible.map((row) => <li key={`${row.status}-${row.id}`} className="card p-5" data-testid={`report-card-${row.code}`}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{row.name}</p><p className="mt-1 font-mono text-sm text-stone-300">{row.phone}</p></div><span className="text-2xl font-semibold text-primary">#{row.queueNumber}</span></div>
          <p className="mt-2 break-words text-xs text-stone-400">{row.email || "Email tidak diisi"}</p>
          <div className="my-4 border-y border-white/10 py-3 text-sm"><p>{row.dayLabel} {row.date.slice(0, 4)}</p><p className="mt-1 text-xs text-stone-400">{row.session ? `Sesi ${row.session.order} · ${row.session.startTime}–${row.session.endTime} WIB` : "Sesi diarsipkan"}</p></div>
          <div className="flex flex-wrap items-center justify-between gap-2"><Status row={row} /><span className="font-mono text-xs text-stone-300">{row.code}</span></div><p className="mt-3 text-[11px] text-stone-400">Daftar: {formatEventDateTime(new Date(row.createdAt))}</p>{row.checkedInAt && <p className="mt-1 text-[11px] text-stone-400">Check-in: {formatEventDateTime(new Date(row.checkedInAt))}</p>}
        </li>)}</ul>
      </>}
      {maxPage > 1 && <nav aria-label="Halaman laporan" className="flex items-center justify-between gap-3">{page > 1 ? <NavLink className="btn-ghost" href={pageUrl(page - 1)}>Sebelumnya</NavLink> : <span />}<span className="text-xs text-stone-400">{page} / {maxPage}</span>{page < maxPage ? <NavLink className="btn-ghost" href={pageUrl(page + 1)}>Berikutnya</NavLink> : <span />}</nav>}
    </div>
  );
}
