import { NextResponse } from "next/server";
import { getHold, releaseHold } from "@/lib/booking";
import { AppError, api } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = api(async (_req: Request, { params }: { params: { id: string } }) => {
  const hold = await getHold(params.id);
  if (!hold) throw new AppError(404, "Kunci nomor tidak ditemukan atau sudah kedaluwarsa");
  return NextResponse.json(hold);
});

export const DELETE = api(async (_req: Request, { params }: { params: { id: string } }) => {
  await releaseHold(params.id);
  return NextResponse.json({ ok: true });
});
