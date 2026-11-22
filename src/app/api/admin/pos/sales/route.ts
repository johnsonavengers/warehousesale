import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/errors";
import { requirePosAdmin } from "@/lib/pos-auth";
import { createPosSale } from "@/lib/pos";
export const POST = api(async (req: Request) => {
  const email = await requirePosAdmin(req);
  const sale = await createPosSale(await req.json(), email);
  revalidatePath("/admin/pos", "layout");
  return NextResponse.json({ id: sale.id, invoiceNumber: sale.invoiceNumber, total: sale.total }, { status: 201 });
});
