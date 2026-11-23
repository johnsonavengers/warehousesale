import { ProductImport } from "@/components/pos/ProductImport";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ADMIN_COOKIE, adminEmailForToken } from "@/lib/auth";
import { getPosImport } from "@/lib/pos-import";
export default async function ImportPage({ searchParams }: { searchParams: { hasil?: string } }) {
  const email = await adminEmailForToken(cookies().get(ADMIN_COOKIE)?.value);
  let initialPreview = null;
  if (searchParams.hasil && email) {
    try { initialPreview = await getPosImport(searchParams.hasil, email); }
    catch { notFound(); }
  }
  return <ProductImport initialPreview={initialPreview} />;
}
