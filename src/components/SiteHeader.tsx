import { NavLink as Link } from "@/components/NavLink";
import { EVENT } from "@/config/event";
import { Icon } from "./Icon";

export function EventLogo({ size = 40 }: { size?: number }) {
  if (EVENT.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={EVENT.logo} alt="" width={size} height={size} className="rounded-xl" />;
  }
  return <span aria-hidden className="grid shrink-0 place-items-center rounded-[14px] border border-primary/30 bg-primary/10 text-sm font-black tracking-tighter text-primary" style={{ width: size, height: size }}>JW</span>;
}
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-6">
      <div className="glass-bar mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-[24px] border border-white/10 px-3 py-2.5 sm:px-5">
        <Link href="/" aria-label={EVENT.name} className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <EventLogo />
          <span className="text-sm font-bold leading-tight tracking-tight sm:text-base">JOHNSON<span className="mt-1 block text-[9px] font-medium uppercase tracking-[.16em] text-stone-400 sm:text-[10px]">Warehouse Sale</span></span>
        </Link>
        <span className="hidden text-xs text-stone-400 md:inline">27 Nov — 13 Des 2026</span>
        <Link href="/cari" className="btn-ghost shrink-0 px-3 text-xs sm:px-4 sm:text-sm"><Icon name="ticket" className="hidden h-4 w-4 sm:block" />Cari tiket</Link>
      </div>
    </header>
  );
}
export function PageShell({ children }: { children: React.ReactNode }) {
  return <><SiteHeader /><main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-8 sm:pt-10">{children}</main><footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 text-[11px] text-stone-400 sm:px-8"><span>© 2026 Johnson Warehouse Sale</span><span>Good finds. Great days.</span></footer></>;
}
