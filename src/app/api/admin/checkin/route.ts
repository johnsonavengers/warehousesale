import { NextResponse } from "next/server";
import { checkInByCode } from "@/lib/booking";
import { api } from "@/lib/errors";
import { checkinSchema } from "@/lib/validation";

export const POST = api(async (req: Request) => {
  const input = checkinSchema.parse(await req.json());
  return NextResponse.json(await checkInByCode(input));
});
