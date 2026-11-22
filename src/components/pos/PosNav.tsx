"use client";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/NavLink";

export function PosNav() {
  const path = usePathname();
  return <nav aria-label="Menu POS" className="flex flex-wrap gap-2">{[["/admin/pos", "Kasir"], ["/admin/pos/produk", "Produk & stok"], ["/admin/pos/transaksi", "Transaksi"]].map(([href, label]) => <NavLink key={href} href={href} aria-current={path === href ? "page" : undefined} className={path === href ? "btn-primary" : "btn-ghost"}>{label}</NavLink>)}<NavLink href="/admin/pos/stok/cetak" className="btn-ghost">Cetak stok</NavLink></nav>;
}
