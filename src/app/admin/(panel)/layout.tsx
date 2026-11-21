import { EVENT } from "@/config/event";
import { AdminNav } from "@/components/admin/AdminNav";
import { EventLogo } from "@/components/SiteHeader";

export const metadata = { title: "Admin", robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="glass-bar sticky top-0 z-30 border-b border-white/[0.07] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <EventLogo size={30} />
            <span className="text-sm font-bold">{EVENT.name} · Admin</span>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
