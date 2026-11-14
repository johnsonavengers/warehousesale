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
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4">
      <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <EventLogo />
        <span className="text-base font-bold tracking-tight">{EVENT.name}</span>
      </Link>
      <Link
        href="/cari"
        className="rounded-lg px-2 py-2 text-sm font-medium text-stone-300 underline-offset-4 hover:text-primary hover:underline"
      >
        Cari tiket saya
      </Link>
    </header>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28">{children}</main>
    </>
  );
}
