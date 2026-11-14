import { NextResponse } from "next/server";
import { getDaysOverview } from "@/lib/booking";
import { api } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  return NextResponse.json({ days: await getDaysOverview() });
});
