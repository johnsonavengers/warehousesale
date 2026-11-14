"use client";

import { useEffect, useState } from "react";
import type { NowServingView } from "@/lib/booking";

/** Layar publik "Sekarang dipanggil" — untuk TV/monitor di lokasi. Refresh tiap 3 detik. */
export function NowServingDisplay({
  initial,
  eventName,
}: {
  initial: NowServingView;
  eventName: string;
}) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/now-serving?date=${initial.date}`, { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } catch {
        /* coba lagi di putaran berikutnya */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [initial.date]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-stone-400 sm:text-lg">
        {eventName} · {data.label}
      </p>
      <h1 className="mt-4 text-2xl font-bold uppercase tracking-widest text-primary sm:text-4xl">
        Sekarang dipanggil
      </h1>
      <p
        className="queue-number mt-2 text-[38vw] text-stone-50 sm:text-[26vw]"
        aria-live="polite"
        data-testid="now-serving-number"
      >
        {data.number ?? "—"}
      </p>
      <p className="mt-2 font-mono text-lg text-stone-300 sm:text-3xl">
        {data.session
          ? `Sesi ${data.session.order} · ${data.session.startTime}–${data.session.endTime} WIB`
          : "Menunggu panggilan"}
      </p>
    </main>
  );
}
