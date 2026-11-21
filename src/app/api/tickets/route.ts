import { NextResponse } from "next/server";
import { createAutomaticTicket } from "@/lib/booking";
import { api } from "@/lib/errors";
import { onTicketCreated } from "@/lib/hooks";
import { automaticTicketSchema } from "@/lib/validation";

export const POST = api(async (req: Request) => {
  const input = automaticTicketSchema.parse(await req.json());
  const ticket = await createAutomaticTicket(input);
  await onTicketCreated(ticket).catch((e) => console.error("onTicketCreated gagal:", e));
  return NextResponse.json(ticket, { status: 201 });
});
