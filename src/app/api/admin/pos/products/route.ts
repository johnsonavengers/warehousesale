import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/errors";
import { requirePosAdmin } from "@/lib/pos-auth";
import { createPosProduct, listPosProducts } from "@/lib/pos";
export const dynamic = "force-dynamic";
export const GET = api(async (req: Request) => {
  await requirePosAdmin(req);
  return NextResponse.json(await listPosProducts(new URL(req.url).searchParams.get("active") === "1"), { headers: { "Cache-Control": "private, no-store" } });
});
export const POST = api(async (req: Request) => {
  const email = await requirePosAdmin(req);
  const product = await createPosProduct(await req.json(), email);
  revalidatePath("/admin/pos", "layout");
  return NextResponse.json(product, { status: 201 });
});
