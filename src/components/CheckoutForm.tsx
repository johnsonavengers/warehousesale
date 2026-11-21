"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { HoldView } from "@/lib/booking";

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function CheckoutForm({ hold, holdMinutes }: { hold: HoldView; holdMinutes: number }) {
  const router = useRouter();
  // Sisa waktu dihitung dari jam server (bukan jam perangkat) + waktu berjalan sejak halaman dibuka.
  const initialMs = new Date(hold.expiresAt).getTime() - new Date(hold.serverNow).getTime();
  const [remaining, setRemaining] = useState(initialMs);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const doneRef = useRef(false);

  const seatUrl = `/${hold.date}/${hold.session.id}`;

  useEffect(() => {
    const startedAt = performance.now();
    const t = setInterval(() => setRemaining(initialMs - (performance.now() - startedAt)), 250);
    return () => clearInterval(t);
  }, [initialMs]);

  // Waktu habis → lepas nomor, kembali ke denah.
  useEffect(() => {
    if (remaining > 0 || doneRef.current) return;
    doneRef.current = true;
    fetch(`/api/holds/${hold.id}`, { method: "DELETE" }).finally(() => {
      router.replace(`${seatUrl}?expired=1`);
    });
  }, [remaining, hold.id, router, seatUrl]);

  async function cancel() {
    doneRef.current = true;
    setBusy(true);
    await fetch(`/api/holds/${hold.id}`, { method: "DELETE" }).catch(() => {});
    router.replace(seatUrl);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId: hold.id, name, phone, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat tiket. Coba lagi.");
        setBusy(false);
        return;
      }
      doneRef.current = true;
      router.replace(`/ticket/${data.code}?baru=1`);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
      setBusy(false);
    }
  }

  const urgent = remaining < 60_000;

  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_1.2fr]">
      <section className="card h-fit p-5" aria-label="Ringkasan pesanan">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Nomor antrian</p>
        <p className="queue-number mt-1 text-6xl" data-testid="checkout-number">
          {hold.queueNumber}
        </p>
        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-stone-400">Tanggal</dt>
            <dd className="font-medium">{hold.dayLabel} {hold.date.slice(0, 4)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-stone-400">Sesi {hold.session.order}</dt>
            <dd className="font-mono font-medium">
              {hold.session.startTime}–{hold.session.endTime} WIB
            </dd>
          </div>
        </dl>
        <div
          role="timer"
          aria-live="off"
          className={
            "mt-4 flex items-center justify-between rounded-xl border px-4 py-3 " +
            (urgent ? "border-red-400/50 bg-red-500/10 text-red-200" : "border-white/10 bg-black/40 text-stone-200")
          }
        >
          <span className="text-xs">Nomor dikunci untuk Anda selama {holdMinutes} menit</span>
          <span className="font-mono text-xl font-bold tabular-nums" data-testid="countdown">
            {formatCountdown(remaining)}
          </span>
        </div>
      </section>

      <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
        <div>
          <label htmlFor="name" className="label">
            Nama lengkap <span className="text-primary">*</span>
          </label>
          <input
            id="name"
            name="name"
            className="input"
            autoComplete="name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="phone" className="label">
            No. WhatsApp <span className="text-primary">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="08xxxxxxxxxx"
            required
            aria-describedby="phone-help"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p id="phone-help" className="mt-1 text-xs text-stone-500">
            Format 08xx atau +628xx. Satu nomor hanya untuk 1 tiket per hari.
          </p>
        </div>
        <div>
          <label htmlFor="email" className="label">
            Email <span className="font-normal text-stone-500">(opsional)</span>
          </label>
          <input
            id="email"
            name="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" onClick={cancel} disabled={busy}>
            Ganti nomor
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Memproses…" : "Pesan tiket"}
          </button>
        </div>
      </form>
    </div>
  );
}
