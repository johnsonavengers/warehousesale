import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/errors";
import { requirePosAdmin } from "@/lib/pos-auth";
import { updatePosProduct } from "@/lib/pos";
export const PATCH = api(async (req: Request, { params }: { params: { id: string } }) => {
  await requirePosAdmin(req);
  const product = await updatePosProduct(params.id, await req.json());
  revalidatePath("/admin/pos", "layout");
  return NextResponse.json(product);
});
