import { NextResponse } from "next/server";
import { updateTicketStatus } from "@/lib/booking";
import { api } from "@/lib/errors";
import { updateTicketSchema } from "@/lib/validation";

export const PATCH = api(async (req: Request, { params }: { params: { id: string } }) => {
  const { status } = updateTicketSchema.parse(await req.json());
  return NextResponse.json(await updateTicketStatus(params.id, status));
});
