const STEPS = ["Tanggal", "Sesi", "Nomor", "Data", "Tiket"] as const;

/** Stepper: Tanggal → Sesi → Nomor → Data → Tiket. `current` = indeks langkah aktif (0-4). */
export function Stepper({ current }: { current: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <nav aria-label="Langkah pemesanan" className="mb-6">
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <div
                className="flex flex-col items-center gap-1"
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={
                    "grid h-7 w-7 place-items-center rounded-full text-xs font-bold " +
                    (active
                      ? "bg-primary text-primary-fg shadow-[0_0_16px_rgb(var(--primary)/0.55)]"
                      : done
                        ? "bg-primary/25 text-primary"
                        : "border border-white/15 bg-white/[0.06] text-stone-400")
                  }
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={
                    "text-[11px] font-medium sm:text-xs " +
                    (active ? "text-stone-50" : "text-stone-400")
                  }
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={"mx-1.5 mb-5 h-px flex-1 " + (done ? "bg-primary/60" : "bg-line")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
