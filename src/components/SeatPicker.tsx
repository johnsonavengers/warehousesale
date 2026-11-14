"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SessionSeats } from "@/lib/booking";

type Props = { initial: SessionSeats; pollMs: number; maxSelect: number };

export function SeatPicker({ initial, pollMs }: Props) {
  const router = useRouter();
  const { session } = initial;
  const [seats, setSeats] = useState(initial.seats);
  const [started, setStarted] = useState(session.started);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${session.id}/seats`, { cache: "no-store" });
      if (!res.ok) return;
      const data: SessionSeats = await res.json();
      setSeats(data.seats);
      setStarted(data.session.started);
    } catch {
      /* abaikan error jaringan sesaat; polling berikutnya akan mencoba lagi */
    }
  }, [session.id]);

  // Polling agar nomor yang baru diambil orang lain langsung abu-abu.
  useEffect(() => {
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  // Jika nomor yang dipilih ternyata diambil orang lain, batalkan pilihan.
  useEffect(() => {
    if (selected === null) return;
    const seat = seats.find((s) => s.number === selected);
    if (seat && seat.status !== "available") {
      setSelected(null);
      setError("Nomor ini baru saja diambil orang lain, silakan pilih nomor lain.");
    }
  }, [seats, selected]);

  const availableCount = seats.filter((s) => s.status === "available").length;

  function pickAuto() {
    const first = seats.find((s) => s.status === "available");
    if (first) {
      setSelected(first.number);
      setError(null);
    }
  }

  async function proceed() {
    if (selected === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, queueNumber: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengunci nomor. Coba lagi.");
        setSelected(null);
        await refresh();
        return;
      }
      router.push(`/checkout?hold=${data.id}`);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      {/* "Layar" ala denah bioskop */}
      <div aria-hidden className="mx-auto mb-6 max-w-md">
        <div className="h-2 rounded-[100%] bg-gradient-to-r from-transparent via-primary/80 to-transparent shadow-[0_8px_24px_2px_rgb(var(--primary)/0.35)]" />
        <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-stone-500">
          Meja layanan
        </p>
      </div>

      <div
        role="group"
        aria-label={`Nomor antrian ${session.queueStart} sampai ${session.queueEnd}`}
        className="mx-auto grid max-w-md grid-cols-6 gap-2"
        data-testid="seat-grid"
      >
        {seats.map((seat) => {
          const isSelected = selected === seat.number;
          const taken = seat.status !== "available";
          return (
            <button
              key={seat.number}
              type="button"
              disabled={taken || started}
              aria-pressed={isSelected}
              aria-label={`Nomor ${seat.number}, ${taken ? "terisi" : isSelected ? "dipilih" : "tersedia"}`}
              data-testid={`seat-${seat.number}`}
              data-status={isSelected ? "selected" : seat.status}
              onClick={() => {
                setSelected(isSelected ? null : seat.number);
                setError(null);
              }}
              className={
                "grid aspect-square min-h-[44px] min-w-[44px] place-items-center rounded-lg font-mono text-sm font-bold transition " +
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (taken
                  ? "cursor-not-allowed bg-stone-700/60 text-stone-500"
                  : isSelected
                    ? "scale-105 bg-primary text-primary-fg shadow-lg shadow-primary/30"
                    : "border-2 border-stone-300 bg-white text-stone-900 hover:border-primary disabled:cursor-not-allowed disabled:opacity-50")
              }
            >
              {seat.number}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <ul className="mx-auto mt-5 flex max-w-md items-center justify-center gap-5 text-xs text-stone-300" aria-label="Legenda warna">
        <li className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded border-2 border-stone-300 bg-white" /> Tersedia
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded bg-primary" /> Dipilih
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded bg-stone-700/60" /> Terisi
        </li>
      </ul>

      <div className="mx-auto mt-5 max-w-md text-center">
        <button
          type="button"
          className="btn-ghost"
          onClick={pickAuto}
          disabled={availableCount === 0 || started}
        >
          Pilih nomor otomatis
        </button>
        <p className="mt-2 text-xs text-stone-500">
          {started
            ? "Sesi ini sudah dimulai dan tidak bisa dipesan."
            : `${availableCount} dari ${seats.length} nomor tersedia · 1 nomor per pemesanan`}
        </p>
      </div>

      {error && (
        <p role="alert" className="mx-auto mt-4 max-w-md rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* Bar bawah */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div aria-live="polite">
            <p className="text-xs text-stone-400">Nomor dipilih</p>
            <p className="queue-number text-2xl" data-testid="selected-number">
              {selected ?? "—"}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary px-8"
            disabled={selected === null || busy || started}
            onClick={proceed}
          >
            {busy ? "Mengunci…" : "Lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}
