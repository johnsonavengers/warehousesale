import Link from "next/link";
import { EVENT } from "@/config/event";

export function EventLogo({ size = 36 }: { size?: number }) {
  if (EVENT.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={EVENT.logo} alt="" width={size} height={size} className="rounded-lg" />;
  }
  const initials = EVENT.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-lg bg-primary font-mono text-sm font-black text-primary-fg"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="glass-bar sticky top-0 z-30 border-b border-white/[0.07] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <EventLogo />
          <span className="text-[15px] font-bold leading-tight tracking-tight sm:text-base">{EVENT.name}</span>
        </Link>
        <Link href="/cari" className="btn-ghost shrink-0 px-3.5 text-[13px] sm:text-sm">
          <span className="sm:hidden">Cari tiket</span>
          <span className="hidden sm:inline">Cari tiket saya</span>
        </Link>
      </div>
    </header>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6">{children}</main>
    </>
  );
}
