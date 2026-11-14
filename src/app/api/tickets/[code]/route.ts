import { NextResponse } from "next/server";
import { getTicketByCode } from "@/lib/booking";
import { AppError, api } from "@/lib/errors";
import { maskPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export const GET = api(async (_req: Request, { params }: { params: { code: string } }) => {
  const ticket = await getTicketByCode(params.code);
  if (!ticket) throw new AppError(404, "Tiket tidak ditemukan");
  // Detail kontak tidak diekspos di API publik.
  return NextResponse.json({ ...ticket, phone: maskPhone(ticket.phone), email: null });
});
