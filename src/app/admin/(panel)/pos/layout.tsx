import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminEmailForToken } from "@/lib/auth";
import { PosNav } from "@/components/pos/PosNav";
export const dynamic = "force-dynamic";
export const metadata = { title: "POS · Johnson Warehouse Sale" };
export default async function PosLayout({ children }: { children: React.ReactNode }) {
  if (!await adminEmailForToken(cookies().get(ADMIN_COOKIE)?.value)) redirect("/admin/login?next=/admin/pos");
  return <div className="space-y-6"><div className="no-print space-y-3"><p className="eyebrow">Point of sale</p><PosNav /></div>{children}</div>;
}
