import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/errors";
import { requirePosAdmin } from "@/lib/pos-auth";
import { adjustPosStock } from "@/lib/pos";
export const POST = api(async (req: Request, { params }: { params: { id: string } }) => {
  const email = await requirePosAdmin(req);
  const movement = await adjustPosStock(params.id, await req.json(), email);
  revalidatePath("/admin/pos", "layout");
  return NextResponse.json(movement);
});
