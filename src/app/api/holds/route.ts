import { NextResponse } from "next/server";
import { createHold } from "@/lib/booking";
import { api } from "@/lib/errors";
import { createHoldSchema } from "@/lib/validation";

export const POST = api(async (req: Request) => {
  const input = createHoldSchema.parse(await req.json());
  const hold = await createHold(input);
  return NextResponse.json(hold, { status: 201 });
});
