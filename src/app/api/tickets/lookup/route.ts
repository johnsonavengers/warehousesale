import { NextResponse } from "next/server";
import { findTicketsByPhone } from "@/lib/booking";
import { api } from "@/lib/errors";
import { maskPhone } from "@/lib/phone";
import { phoneSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = api(async (req: Request) => {
  const phone = phoneSchema.parse(new URL(req.url).searchParams.get("phone") ?? "");
  const tickets = await findTicketsByPhone(phone);
  return NextResponse.json({
    tickets: tickets.map((t) => ({
      code: t.code,
      date: t.date,
      dayLabel: t.dayLabel,
      queueNumber: t.queueNumber,
      name: t.name,
      phone: maskPhone(t.phone),
      status: t.status,
      session: t.session,
    })),
  });
});
