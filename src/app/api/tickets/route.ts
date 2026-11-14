import { NextResponse } from "next/server";
import { createTicketFromHold } from "@/lib/booking";
import { api } from "@/lib/errors";
import { onTicketCreated } from "@/lib/hooks";
import { createTicketSchema } from "@/lib/validation";

export const POST = api(async (req: Request) => {
  const input = createTicketSchema.parse(await req.json());
  const ticket = await createTicketFromHold(input);
  await onTicketCreated(ticket).catch((e) => console.error("onTicketCreated gagal:", e));
  return NextResponse.json(ticket, { status: 201 });
});
