"use client";

import { NavLink as Link } from "@/components/NavLink";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pos", label: "POS" },
  { href: "/admin/laporan", label: "Laporan pendaftar" },
  { href: "/admin/tickets", label: "Daftar tiket" },
  { href: "/admin/checkin", label: "Check-in" },
];

export function AdminNav() {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.assign("/admin/login");
  }

  return (
    <nav aria-label="Menu admin" className="flex flex-wrap items-center gap-1 text-sm">
      {LINKS.map((l) => {
        const active = pathname === l.href || (l.href === "/admin/pos" && pathname.startsWith("/admin/pos/"));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-lg px-3 py-2 font-medium " +
              (active ? "bg-primary text-primary-fg" : "text-stone-300 hover:bg-white/10")
            }
          >
            {l.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={logout}
        className="rounded-lg px-3 py-2 font-medium text-stone-400 hover:bg-white/10 hover:text-stone-100"
      >
        Keluar
      </button>
    </nav>
  );
}
