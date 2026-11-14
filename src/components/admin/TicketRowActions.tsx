"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TicketRowActions({
  id,
  status,
  label,
}: {
  id: string;
  status: string;
  label: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: "BOOKED" | "CHECKED_IN" | "CANCELLED") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Gagal");
      } else {
        setConfirming(false);
        router.refresh();
      }
    } catch {
      setError("Koneksi bermasalah");
    } finally {
      setBusy(false);
    }
  }

  const small = "min-h-[36px] rounded-lg px-3 py-1.5 text-xs";
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {confirming ? (
        <>
          <span className="text-xs text-stone-300">Batalkan tiket?</span>
          <button type="button" className={`btn-danger ${small}`} disabled={busy} onClick={() => update("CANCELLED")}>
            Ya, batalkan
          </button>
          <button type="button" className={`btn-ghost ${small}`} disabled={busy} onClick={() => setConfirming(false)}>
            Tidak
          </button>
        </>
      ) : (
        <>
          {status === "BOOKED" ? (
            <button
              type="button"
              className={`btn-ghost ${small}`}
              disabled={busy}
              aria-label={`Check-in manual ${label}`}
              onClick={() => update("CHECKED_IN")}
            >
              Check-in
            </button>
          ) : (
            <button
              type="button"
              className={`btn-ghost ${small}`}
              disabled={busy}
              aria-label={`Urungkan check-in ${label}`}
              onClick={() => update("BOOKED")}
            >
              Urungkan
            </button>
          )}
          <button
            type="button"
            className={`btn-danger ${small}`}
            disabled={busy}
            aria-label={`Batalkan tiket ${label}`}
            onClick={() => setConfirming(true)}
          >
            Batalkan
          </button>
        </>
      )}
      {error && (
        <span role="alert" className="w-full text-right text-xs text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}
