"use client";
import { useEffect, useState } from "react";
import { NavLink } from "./NavLink";
import { Icon } from "./Icon";
import type { DaySessions } from "@/lib/booking";

export function SessionPicker({ initialDay, needsSelection }: { initialDay: DaySessions; needsSelection: boolean }) {
  const [day, setDay] = useState(initialDay);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setDay(initialDay); }, [initialDay]);
  useEffect(() => {
    let current = true;
    let request: AbortController | undefined;
    async function refresh() {
      request?.abort(); request = new AbortController();
      setRefreshing(true);
      try {
        const response = await fetch(`/api/days/${initialDay.date}/sessions`, { cache: "no-store", signal: request.signal });
        if (!response.ok) throw new Error("Kuota belum bisa diperbarui. Coba perbarui kembali.");
        const data: DaySessions = await response.json();
        if (current) { setDay(data); setError(""); setRefreshing(false); }
      } catch (err) {
        if (current && !(err instanceof Error && err.name === "AbortError")) { setError("Kuota belum bisa diperbarui. Ketersediaan akan diperiksa kembali saat memesan."); setRefreshing(false); }
      }
    }
    void refresh();
    const interval = setInterval(refresh, 20_000);
    window.addEventListener("focus", refresh);
    return () => { current = false; request?.abort(); clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [initialDay, refreshKey]);
  return <div className="space-y-5">
    <div><NavLink href="/#tanggal" className="inline-flex min-h-11 items-center text-sm text-primary">← Ganti tanggal</NavLink><h1 className="mt-2 text-3xl font-semibold tracking-tight">Pilih jam kunjungan</h1><p className="mt-2 text-base text-primary">{day.label} {day.date.slice(0, 4)}</p><p className="mt-3 text-sm leading-relaxed text-stone-300">Pilih sesi yang sesuai. Nomor antrian otomatis diberikan dalam sesi pilihanmu setelah pendaftaran berhasil.</p></div>
    {needsSelection && <p role="status" className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">Pilih jam yang masih tersedia untuk melanjutkan pendaftaran.</p>}
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-xs text-stone-400"><Icon name="clock" className="h-4 w-4" />Semua jam dalam WIB</p><button type="button" className="min-h-11 text-xs text-primary" disabled={refreshing} onClick={() => setRefreshKey(k => k + 1)}>{refreshing ? "Memperbarui kuota…" : "Perbarui kuota"}</button></div>
    {error && <p role="alert" className="text-sm text-stone-300">{error}</p>}
    <ul className="grid gap-3 sm:grid-cols-2">{day.items.map(item => {
      if (item.type === "break") return <li key={`break-${item.startTime}`} className="rounded-2xl border border-dashed border-white/15 px-5 py-3 text-sm text-stone-400 sm:col-span-2">Istirahat · {item.startTime}–{item.endTime} WIB</li>;
      const content = <><div className="flex items-center justify-between gap-2"><span className="text-xs text-stone-300">Sesi {item.order}</span><span className={item.bookable ? "text-xs text-primary" : "text-xs text-stone-400"}>{item.started ? "Sudah ditutup" : item.full ? "Kuota habis" : `${item.remaining} dari ${item.capacity} tersisa`}</span></div><p className="mt-3 text-2xl font-semibold tracking-tight">{item.startTime}–{item.endTime} <span className="text-xs font-normal text-stone-400">WIB</span></p>{item.bookable && <p className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">Pilih jam ini <Icon name="arrow" className="h-4 w-4" /></p>}</>;
      return <li key={item.id}>{item.bookable ? <NavLink data-testid={`session-${item.order}`} href={`/checkout?date=${day.date}&session=${encodeURIComponent(item.id)}`} aria-label={`Pilih sesi ${item.order}, ${item.startTime}–${item.endTime} WIB`} className="card block p-5 transition hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{content}</NavLink> : <div data-testid={`session-${item.order}`} aria-disabled="true" className="card p-5 opacity-50">{content}</div>}</li>;
    })}</ul>
    <p className="text-xs leading-relaxed text-stone-400">Kuota diperbarui otomatis. Sesi yang penuh atau sudah dimulai tidak dapat dipesan. Satu nomor WhatsApp untuk satu tiket per tanggal.</p>
  </div>;
}
