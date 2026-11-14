import { NextResponse } from "next/server";
import { getSessionsForDay } from "@/lib/booking";
import { AppError, api } from "@/lib/errors";
import { dateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = api(async (_req: Request, { params }: { params: { date: string } }) => {
  const date = dateSchema.parse(params.date);
  const data = await getSessionsForDay(date);
  if (!data) throw new AppError(404, "Tanggal tidak ditemukan");
  return NextResponse.json(data);
});
