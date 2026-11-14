import { NextResponse } from "next/server";
import { cleanupExpiredHolds, getSeats } from "@/lib/booking";
import { AppError, api } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = api(async (_req: Request, { params }: { params: { id: string } }) => {
  await cleanupExpiredHolds();
  const data = await getSeats(params.id);
  if (!data) throw new AppError(404, "Sesi tidak ditemukan");
  return NextResponse.json(data);
});
