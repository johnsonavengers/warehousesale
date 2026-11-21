"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { NavLink } from "@/components/NavLink";
import { SCHEDULE } from "@/config/schedule";
import type { ReportFilter } from "@/lib/registration-report";

export function ReportFilters({ filter }: { filter: ReportFilter }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form action="/admin/laporan" method="get" className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => {
      event.preventDefault();
      const params = new URLSearchParams();
      new FormData(event.currentTarget).forEach((value, key) => { if (String(value).trim()) params.set(key, String(value).trim()); });
      startTransition(() => router.push(`/admin/laporan?${params}`));
    }}>
      <div><label htmlFor="report-date" className="label">Tanggal kunjungan</label><select id="report-date" name="date" className="input" defaultValue={filter.date ?? ""}><option value="">Semua tanggal</option>{SCHEDULE.map((day) => <option key={day.date} value={day.date}>{day.label} 2026</option>)}</select></div>
      <div><label htmlFor="report-session" className="label">Sesi</label><select id="report-session" name="session" className="input" defaultValue={filter.sessionOrder ?? ""}><option value="">Semua sesi</option>{Array.from({ length: 6 }, (_, index) => <option key={index} value={index + 1}>Sesi {index + 1}</option>)}</select></div>
      <div><label htmlFor="report-status" className="label">Status pendaftaran</label><select id="report-status" name="status" className="input" defaultValue={filter.status ?? ""}><option value="">Semua status</option><option value="ACTIVE">Tiket aktif</option><option value="BOOKED">Belum check-in</option><option value="CHECKED_IN">Sudah check-in</option><option value="CANCELLED">Dibatalkan</option></select></div>
      <div><label htmlFor="report-search" className="label">Cari pendaftar</label><input id="report-search" name="q" className="input" placeholder="Nama, WA, email, kode" defaultValue={filter.q ?? ""} maxLength={120} /></div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4"><button type="submit" className="btn-primary" disabled={pending}>{pending ? "Memuat laporan…" : "Terapkan filter"}</button><NavLink href="/admin/laporan" className="btn-ghost">Reset filter</NavLink><p className="text-xs text-stone-400">File Excel mengikuti filter dan memuat seluruh hasil.</p></div>
    </form>
  );
}
