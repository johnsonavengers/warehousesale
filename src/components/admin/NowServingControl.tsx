"use client";

import { useState } from "react";
import type { NowServingView } from "@/lib/booking";

export function NowServingControl({ initial }: { initial: NowServingView }) {
  const [data, setData] = useState(initial);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function set(number: number) {
    if (!Number.isInteger(number) || number < 0) {
      setError("Masukkan nomor yang valid.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/now-serving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: data.date, number }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Gagal menyimpan.");
      else {
        setData(json);
        setInput("");
      }
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setBusy(false);
    }
  }

  const inputId = `now-serving-${data.date}`;
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          Sekarang dipanggil
        </p>
        <p className="queue-number text-4xl text-primary" aria-live="polite">
          {data.number ?? "—"}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={busy || (data.number ?? 0) >= data.maxNumber}
          onClick={() => set((data.number ?? 0) + 1)}
        >
          Berikutnya (+1)
        </button>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            set(Number(input));
          }}
        >
          <div>
            <label htmlFor={inputId} className="sr-only">
              Set nomor yang dipanggil untuk {data.label}
            </label>
            <input
              id={inputId}
              className="input w-24"
              type="number"
              inputMode="numeric"
              min={1}
              max={data.maxNumber}
              placeholder="No."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-ghost" disabled={busy || input === ""}>
            Set
          </button>
        </form>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || data.number === null}
          onClick={() => set(0)}
        >
          Kosongkan
        </button>
      </div>
      {error && (
        <p role="alert" className="w-full text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
