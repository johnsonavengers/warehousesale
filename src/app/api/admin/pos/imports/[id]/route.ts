import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/errors";
import { requirePosAdmin } from "@/lib/pos-auth";
import { applyPosImport, getPosImport } from "@/lib/pos-import";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = api(async (req: Request, { params }: { params: { id: string } }) => {
  return NextResponse.json(await getPosImport(params.id, await requirePosAdmin(req)), { headers: { "Cache-Control": "private, no-store" } });
});
export const POST = api(async (req: Request, { params }: { params: { id: string } }) => {
  const result = await applyPosImport(params.id, await requirePosAdmin(req));
  revalidatePath("/admin/pos", "layout");
  return NextResponse.json(result);
});
