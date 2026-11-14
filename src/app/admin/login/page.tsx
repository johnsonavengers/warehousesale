import { Suspense } from "react";
import { EVENT } from "@/config/event";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { EventLogo } from "@/components/SiteHeader";

export const metadata = { title: "Login admin" };

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4">
      <div className="mb-6 flex items-center gap-2.5">
        <EventLogo />
        <span className="font-bold">{EVENT.name} · Admin</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Login admin</h1>
      <Suspense>
        <AdminLoginForm />
      </Suspense>
    </main>
  );
}
