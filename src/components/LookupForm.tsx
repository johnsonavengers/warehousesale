"use client";

import { NavLink as Link } from "@/components/NavLink";
import { useState } from "react";

type Result = {
  code: string;
  date: string;
  dayLabel: string;
  queueNumber: number;
  name: string;
  phone: string;
  status: string;
  session: { order: number; startTime: string; endTime: string };
};

export function LookupForm() {
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`/api/tickets/lookup?phone=${encodeURIComponent(phone)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Gagal mencari tiket.");
      else setResults(data.tickets);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 max-w-md">
      <form onSubmit={submit} className="flex gap-2.5" noValidate>
        <label htmlFor="lookup-phone" className="sr-only">
          No. WhatsApp
        </label>
        <input
          id="lookup-phone"
          className="input"
          type="tel"
          inputMode="tel"
          placeholder="08xxxxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={busy}>
          {busy ? "Mencari…" : "Cari"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {results && results.length === 0 && (
        <p className="card mt-4 p-5 text-sm text-stone-300">
          Tidak ada tiket untuk nomor tersebut.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {results.map((t) => (
            <li key={t.code}>
              <Link
                href={`/ticket/${t.code}`}
                className="card flex items-center gap-4 px-5 py-4 transition hover:border-primary hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="queue-number text-4xl text-primary">{t.queueNumber}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.name}</span>
                  <span className="block text-xs text-stone-400">
                    {t.dayLabel} · Sesi {t.session.order} · {t.session.startTime}–{t.session.endTime} WIB
                  </span>
                  <span className="block font-mono text-xs text-stone-500">
                    {t.phone} · {t.code}
                  </span>
                </span>
                <span aria-hidden className="text-stone-500">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
